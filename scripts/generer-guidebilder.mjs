#!/usr/bin/env node
// Genererer instruksjonsbildene til demo-guiden (static/guide/steg-*.png)
// ved å bygge nøkkelring-merkelappen steg for steg i en ekte Akse-økt og
// ta skjermbilde etter hvert steg. Kjør på nytt når UI-et endrer utseende:
//
//   npm run guidebilder
//
// Krav: Node ≥ 22 (innebygd WebSocket og fetch) og Google Chrome.
// Overstyr Chrome-sti med CHROME_BIN ved behov. Skriptet starter sin egen
// dev-server og headless Chrome, og rydder opp etter seg.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UT_MAPPE = join(ROT, 'static', 'guide');
const CHROME =
  process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9333;
const VINDU = { bredde: 1440, hoyde: 900 };
// Utsnittet rundt arbeidsplaten (CSS-piksler i 1440×900-vinduet).
const UTSNITT = { x: 430, y: 320, width: 560, height: 330, scale: 1 };
// Utsnitt for Plantegning-modalen (verktøy + canvas + egenskapspanel), nedskalert.
const UTSNITT_MODAL = { x: 30, y: 95, width: 1380, height: 690, scale: 0.42 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const barn = [];

function dø(melding, kode = 1) {
  console.error(melding);
  prosessOpprydding();
  process.exit(kode);
}

function prosessOpprydding() {
  for (const p of barn) {
    try {
      p.kill('SIGTERM');
    } catch {}
  }
}
process.on('exit', prosessOpprydding);
process.on('SIGINT', () => dø('Avbrutt', 130));

// ── 1. Start dev-server og les hvilken port den fikk ────────────────────────
async function startDevServer() {
  const vite = spawn('npm', ['run', 'dev'], { cwd: ROT, stdio: ['ignore', 'pipe', 'pipe'] });
  barn.push(vite);
  return new Promise((resolve, reject) => {
    const tidsavbrudd = setTimeout(() => reject(new Error('vite startet ikke innen 30s')), 30_000);
    let buffer = '';
    vite.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const m = buffer.match(/Local:\s+(http:\/\/localhost:\d+)/);
      if (m) {
        clearTimeout(tidsavbrudd);
        resolve(m[1].replace(/\/$/, ''));
      }
    });
    vite.on('exit', (code) => reject(new Error(`vite avsluttet (kode ${code})`)));
  });
}

// ── 2. Start headless Chrome med CDP ────────────────────────────────────────
async function startChrome() {
  const profil = join(ROT, 'node_modules', '.cache', 'guidebilder-chrome-profil');
  const chrome = spawn(
    CHROME,
    [
      '--headless',
      `--remote-debugging-port=${CDP_PORT}`,
      `--window-size=${VINDU.bredde},${VINDU.hoyde}`,
      `--user-data-dir=${profil}`,
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  barn.push(chrome);
  // Vent til CDP-endepunktet svarer
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json`);
      if (res.ok) return res.json();
    } catch {}
  }
  throw new Error('Chrome CDP svarte ikke innen 15s');
}

// ── 3. Minimal CDP-klient ────────────────────────────────────────────────────
function lagCdpKlient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const ventende = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && ventende.has(msg.id)) {
      ventende.get(msg.id)(msg.result ?? msg.error);
      ventende.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const m = ++id;
      ventende.set(m, resolve);
      ws.send(JSON.stringify({ id: m, method, params }));
    });
  return {
    klar: new Promise((r) => (ws.onopen = r)),
    send,
    lukk: () => ws.close(),
    async evalJs(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    },
    async klikk(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', {
          type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse',
        });
      }
    },
    async tast(key, code, modifiers = 0) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
    },
    async bilde(filnavn, utsnitt = UTSNITT) {
      const res = await send('Page.captureScreenshot', { format: 'png', clip: utsnitt });
      writeFileSync(join(UT_MAPPE, filnavn), Buffer.from(res.data, 'base64'));
      console.log('  skrev', filnavn);
    },
    async dra(x1, y1, x2, y2) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1, pointerType: 'mouse',
      });
      for (let i = 1; i <= 10; i++) {
        await send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: x1 + ((x2 - x1) * i) / 10,
          y: y1 + ((y2 - y1) * i) / 10,
          button: 'left', pointerType: 'mouse',
        });
        await sleep(30);
      }
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1, pointerType: 'mouse',
      });
    },
  };
}

// ── 4. Selve oppskriften ─────────────────────────────────────────────────────
async function kjør() {
  mkdirSync(UT_MAPPE, { recursive: true });

  console.log('Starter dev-server …');
  const baseUrl = await startDevServer();
  console.log('  ' + baseUrl);

  console.log('Starter headless Chrome …');
  const mål = await startChrome();
  const side = mål.find((t) => t.type === 'page');
  if (!side) throw new Error('Fant ingen Chrome-fane');
  const cdp = lagCdpKlient(side.webSocketDebuggerUrl);
  await cdp.klar;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  console.log('Laster Akse …');
  await cdp.send('Page.navigate', { url: baseUrl + '/' });
  let c = null;
  for (let i = 0; i < 20 && !c; i++) {
    await sleep(1500);
    c = await cdp.evalJs(
      `(() => { const el = document.querySelector('.scene-slot canvas'); if (!el) return null;
         const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height*0.55 }; })()`,
    );
  }
  if (!c) throw new Error('Fant aldri 3D-canvasen — feiler Akse i konsollen?');
  await sleep(2000);

  // Hjelpere mot Akse-UI-et
  const klikkFigurKnapp = (navn) =>
    cdp.evalJs(
      `[...document.querySelectorAll('button.figure-btn')].find(b => b.textContent.includes('${navn}'))?.click()`,
    );
  // Setter et panel-input (id «size-B», «pos-X», …) med Svelte-kompatible events.
  const settFelt = (idStr, verdi) =>
    cdp.evalJs(`(() => {
      const input = document.getElementById('${idStr}');
      if (!input) return 'FANT IKKE ${idStr}';
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '${verdi}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.blur();
      return 'ok';
    })()`);

  console.log('Bygger modellen og tar bilder …');

  // Steg: sylinder midt på platen (valgt → målelinjer vises)
  await klikkFigurKnapp('Sylinder');
  await sleep(250);
  await cdp.klikk(c.x, c.y);
  await sleep(800);
  await cdp.bilde('steg-sylinder.png');

  // Steg: flat skive 40×40×6, sentrert i origo (posisjonsfeltene er hjørne-koordinater)
  await settFelt('size-B', 40); await sleep(250);
  await settFelt('size-D', 40); await sleep(250);
  await settFelt('size-H', 6); await sleep(400);
  await settFelt('pos-X', -20); await sleep(250);
  await settFelt('pos-Y', -20); await sleep(900);
  await cdp.bilde('steg-flat-skive.png');

  // Steg: liten sylinder Ø8 ved siden av skiven
  await klikkFigurKnapp('Sylinder');
  await sleep(250);
  await cdp.klikk(c.x + 170, c.y + 30);
  await sleep(700);
  await settFelt('size-B', 8); await sleep(250);
  await settFelt('size-D', 8); await sleep(900);
  await cdp.bilde('steg-liten-sylinder.png');

  // Steg: H → hull-modus (rød/gjennomsiktig). Den lille er fortsatt valgt.
  await cdp.tast('h', 'KeyH');
  await sleep(900);
  await cdp.bilde('steg-hull.png');

  // Steg: plasser hullet på skiven — senter (12, 0) → hjørne (8, −4).
  // Ikke klikk først: et klikk kan treffe en måletikett og åpne redigeringsfeltet.
  await settFelt('pos-X', 8); await sleep(250);
  await settFelt('pos-Y', -4); await sleep(900);
  await cdp.bilde('steg-plasser-hull.png');

  // Steg: velg alt, grupper, fjern valget → ferdig merkelapp med utskåret hull
  await cdp.tast('a', 'KeyA', 2); // Ctrl+A
  await sleep(400);
  await cdp.tast('g', 'KeyG', 2); // Ctrl+G
  await sleep(1000);
  await cdp.klikk(c.x - 250, c.y + 150); // klikk tom plate → deselect
  await sleep(800);
  await cdp.bilde('steg-ferdig.png');

  // Sanity: ferdigbildet skal vise et utskåret hull. Gruppen skal nå være
  // 40×40×20 — er dybden ~55 har hullet bommet på skiven.
  await cdp.tast('a', 'KeyA', 2);
  await sleep(400);
  const gruppeD = await cdp.evalJs(`document.getElementById('gsize-D')?.value ?? null`);
  if (gruppeD === null || Math.abs(parseFloat(String(gruppeD).replace(',', '.')) - 40) > 1) {
    throw new Error(`Uventet gruppe-dybde (${gruppeD}) — hullet traff ikke skiven, bildene er feil.`);
  }

  // ── Guide 2: navneskilt (Plantegning + tekst) ──────────────────────────────
  console.log('Bygger navneskiltet og tar bilder …');
  await cdp.send('Page.navigate', { url: baseUrl + '/' }); // nytt, blankt prosjekt
  await sleep(4000);

  // Setter et input som ligger inni en <label> i Plantegning-egenskapspanelet
  // (feltene der har ikke id-er — finnes via label-teksten, f.eks. «B (mm)»).
  const settSkisseFelt = (labelTekst, verdi) =>
    cdp.evalJs(`(() => {
      const lab = [...document.querySelectorAll('label')]
        .find(l => l.textContent.trim().startsWith('${labelTekst}'));
      const input = lab?.querySelector('input');
      if (!input) return 'FANT IKKE ${labelTekst}';
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '${verdi}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.blur();
      return 'ok';
    })()`);

  // Åpne Plantegning og finn skisse-canvasen
  await klikkFigurKnapp('Plantegning');
  await sleep(1200);
  const skisse = await cdp.evalJs(
    `(() => { const el = document.querySelector('svg.canvas') ?? document.querySelector('.modal svg');
       if (!el) return null; const r = el.getBoundingClientRect();
       return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`,
  );
  if (!skisse) throw new Error('Fant ikke Plantegning-canvasen');

  // Avrundet rektangel: tegn omtrentlig, sett så eksakte verdier i panelet
  await cdp.tast('o', 'KeyO');
  await sleep(300);
  await cdp.dra(skisse.x - 160, skisse.y - 70, skisse.x + 160, skisse.y + 70);
  await sleep(500);
  await settSkisseFelt('X (mm)', 0); await sleep(200);
  await settSkisseFelt('Y (mm)', 0); await sleep(200);
  await settSkisseFelt('B (mm)', 100); await sleep(200);
  await settSkisseFelt('H (mm)', 50); await sleep(200);
  await settSkisseFelt('3D-høyde (mm)', 2); await sleep(700);
  await cdp.bilde('skilt-skisse.png', UTSNITT_MODAL);

  // Lite hull i øvre venstre hjørne: sirkel r=3 på (−42, 17), modus hull
  await cdp.tast('s', 'KeyS');
  await sleep(300);
  await cdp.dra(skisse.x - 120, skisse.y - 50, skisse.x - 100, skisse.y - 35);
  await sleep(500);
  await settSkisseFelt('Radius (mm)', 3); await sleep(200);
  await settSkisseFelt('X (mm)', -42); await sleep(200);
  await settSkisseFelt('Y (mm)', 17); await sleep(300);
  await cdp.evalJs(`document.querySelector('input[name="mode"][value="hole"]')?.click()`);
  await sleep(800);
  await cdp.bilde('skilt-hull.png', UTSNITT_MODAL);

  // Lag 3D-modellen
  await cdp.evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Lag 3D-modell'))?.click()`,
  );
  await sleep(1500);
  await cdp.klikk(c.x - 320, c.y + 170); // deselect
  await sleep(700);
  await cdp.bilde('skilt-3d.png');

  // Tekst «Navnet» ved siden av skiltet
  await klikkFigurKnapp('Tekst');
  await sleep(300);
  await cdp.klikk(c.x + 150, c.y + 120);
  await sleep(800);
  await cdp.evalJs(`(() => {
    const input = [...document.querySelectorAll('.panel-slot input')].find(i => i.value === 'Tekst');
    if (!input) return 'FANT IKKE tekst-feltet';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Navnet');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    return 'ok';
  })()`);
  await sleep(1200);
  await cdp.bilde('skilt-tekst.png');

  // Flytt teksten inn på skiltet (hjørnefelt: senter (0,0) → −20, −4)
  await settFelt('pos-X', -20); await sleep(250);
  await settFelt('pos-Y', -4); await sleep(1200);
  await cdp.klikk(c.x - 320, c.y + 170); // deselect
  await sleep(800);
  await cdp.bilde('skilt-ferdig.png');

  // Sanity: tekst + skilt skal overlappe → to figurer, og skiltet er 100 bredt
  await cdp.tast('a', 'KeyA', 2);
  await sleep(400);
  const gruppeB = await cdp.evalJs(`document.getElementById('gsize-B')?.value ?? null`);
  if (gruppeB === null || Math.abs(parseFloat(String(gruppeB).replace(',', '.')) - 100) > 3) {
    throw new Error(`Uventet skilt-bredde (${gruppeB}) — navneskilt-bildene er feil.`);
  }

  cdp.lukk();
  console.log('Ferdig — bildene ligger i static/guide/.');
}

kjør()
  .then(() => {
    prosessOpprydding();
    process.exit(0);
  })
  .catch((e) => dø('Feil: ' + (e?.message ?? e)));

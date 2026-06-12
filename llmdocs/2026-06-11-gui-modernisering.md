# GUI-modernisering av Akse — 2026-06-11

Designretning: **«vennlig presisjonsverksted»** — myke glass-paneler over 3D-scenen,
én samlet aksentfarge, konsistente radius-/skygge-tokens og lekne mikrointeraksjoner
tilpasset målgruppen (barn og unge), uten å bryte host-kontrakten (CSS-variablene).

## Designtokens (nytt)

Definert på `.akse-root` i `Akse.svelte` og arves av alle etterkommere, inkludert
fixed-posisjonerte modaler (de er DOM-barn av rota):

- `--akse-radius-sm/md/lg/xl` (8/12/16/20 px)
- `--akse-ring`, `--akse-tint`, `--akse-tint-strong`, `--akse-glass`, `--akse-glass-border`
  — avledet fra `--primary-color`/`--card-bg` via `color-mix` (degraderer pent)
- `--akse-shadow-sm/md/lg` — lagdelte, myke skygger
- `font-family: var(--akse-font, inherit)` — host arver appens font; standalone får
  Nunito via `akse-theme.css` (+ Google Fonts-link i dev-`+layout.svelte`)

Alle brukssteder har statiske fallbacks (`var(--akse-radius-sm, 8px)` osv.), så
komponentene fungerer også uten tokens.

## Samlet aksentfarge

Tidligere tre konkurrerende aksenter — `#4a90e2` (scene-verktøy), `#10b981`/`#4caf50`
(modal-knapper), `#007bff`/host-blå (resten) — er samlet til `var(--primary-color)`.
Fallback-paletten i `akse-theme.css` er modernisert (`#2563eb` m.fl.).
Aktiv-tilstanden i Plantegning-verktøylinjen (oransje amber) er også flyttet til primær.

Beholdt med vilje: aksefargene X/Y/Z (rød/grønn/blå), amber «Rediger plantegning»
(egen affordance), oransje seleksjon/snap i 2D-skissen (funksjonelle tegnefarger),
figurpaletten i `models.ts` (innhold, ikke chrome).

## Per komponent

- **Akse.svelte**: tokens; topbar med subtil skygge; kant-faner som glass-piller med
  blur og hover-utvidelse; feil-/skrivebeskyttet-banner som avrundede piller.
- **TopBar.svelte**: logo i gradient-badge; prosjektnavn som «ghost»-felt (ramme kun
  ved hover/fokus); verktøyknapper med tint-hover, trykk-skala og `:focus-visible`-ring;
  STL-knapp som gradient-pille-CTA; pulserende «ulagret»-prikk (respekterer
  `prefers-reduced-motion`).
- **ShapeLibrary.svelte**: seksjonstitler med aksent-strek; figurknapper som kort med
  hover-løft og fylt aktiv tilstand.
- **TransformPanel.svelte**: fokus-ringer på alle felt; finere toggle (med sprett),
  fargeswatcher med ring-aktiv, piller for snap, FA-ikon i stedet for 📐.
- **SceneCanvas.svelte**: emoji (🏠 🤚 ↻ ↺) erstattet med FontAwesome; flytende paneler
  med backdrop-blur («glass»); dimensjonsetikettene i scenen (CSS2D) samlet i delte
  konstanter `DIM_LABEL_CSS`/`DIM_INPUT_CSS` som piller i primærfarge;
  gruppe-handlingsknapper som mørk glass-pille; animert plasserings-hint.
- **Modalene** (Åpne/Lagre/Tegning/Plantegning): felles rammespråk — blurret mørk
  backdrop, radius 20px, inntoningsanimasjon, rund ikon-lukkeknapp, primærfargede
  CTA-er, fokus-ringer; Poppins-hardkoding fjernet (font arves).
- **Plantegning-komponentene**: verktøylinje med hvite knapper på sekundær flate og
  fylt primær aktiv-tilstand; FA-ikoner for grupper/avgrupper/angre; panel/preview
  med 12px radius.

## Verifisering

- `npm run check`: 0 feil (advarslene er pre-eksisterende reaktivitets-hint).
- Visuelt verifisert med headless Chrome (playwright-core + system-Chrome) mot
  `npm run dev` (`/?cloud`): hovedvisning, valgt figur + rotasjonsmodus,
  Åpne-/Lagre-modal, Tegning- og Plantegning-editor.
- Kjente pre-eksisterende konsollmeldinger i dev (urelatert til styling):
  favicon-404 og `THREE.Object3D.add: … TransformControls`.

## Følgefiks underveis

FA-solid-ikoner krever `font-weight: 900` — en tidligere `font-weight: 400` på
`.rot-icon` ga tofu-tegn; fjernet.

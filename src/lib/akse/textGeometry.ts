// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/textGeometry.ts

import * as THREE from 'three';
// @ts-ignore -- opentype.js ships uten egne TypeScript-typer
import opentype from 'opentype.js';

let cachedFont: any = null;
let cachedFontPromise: Promise<any> | null = null;

const DEFAULT_FONT_URL = '/fonts/inter-regular.ttf';

async function loadFont(url: string = DEFAULT_FONT_URL): Promise<any> {
  if (cachedFont) return cachedFont;
  if (cachedFontPromise) return cachedFontPromise;

  cachedFontPromise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load font: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const font = opentype.parse(buf);
      cachedFont = font;
      return font;
    })
    .catch((err) => {
      cachedFontPromise = null;  // clear so next call can retry
      throw err;
    });

  return cachedFontPromise;
}

/**
 * Bygg en 3D ekstrudert tekst-geometri sentrert i origo.
 * - text: strengen
 * - size: [w, d, h] der w = total bredde i mm, h = tykkelse (høyden teksten reiser
 *   seg fra arbeidsflaten), d ignoreres (tekst-dybden følger fontens bokstavhøyde)
 *
 * Geometrien legges flatt i arbeidsflate-planet (se rotateX nederst), slik at
 * teksten ligger på arbeidsflaten i stedet for å stå oppreist mot betrakteren.
 *
 * Returnerer null hvis fonten ikke er lastet ennå (caller bør re-rendere når den er).
 *
 * MERK: Caller eier resultatet og må kalle .dispose() på forrige geometri før
 * den overskrives, ellers lekker GPU-minne ved gjentatte kall (f.eks. ved
 * live-redigering av tekst-input).
 */
export function buildTextGeometrySync(
  text: string,
  size: [number, number, number],
): THREE.BufferGeometry | null {
  if (!cachedFont || !text) return null;

  const targetWidth = size[0];
  const extrudeDepth = size[2];

  // Bygg paths fra opentype med en arbitrær fontsize, så skaler etterpå
  const paths = cachedFont.getPaths(text, 0, 0, 100);
  const shapes: THREE.Shape[] = [];

  for (const path of paths) {
    const cmds = path.commands;
    const subShapes = pathCommandsToShapes(cmds);
    shapes.push(...subShapes);
  }

  if (shapes.length === 0) return null;

  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: extrudeDepth,
    bevelEnabled: false,
    // Lav curve-oppløsning: færre trekanter i tekst-geometrien gir proporsjonalt
    // raskere CSG ved gruppering/gravering av tekst (three-bvh-csg skalerer med
    // trekant-antall). 3 segmenter per kurve er nok for tekst i de størrelsene
    // Akse bruker — kurvene blir så vidt mer kantete, men knapt merkbart.
    curveSegments: 3,
  });

  // Skaler til target-bredde og sentrér
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const currentWidth = bbox.max.x - bbox.min.x;
  const scale = currentWidth > 0 ? targetWidth / currentWidth : 1;
  // Uniform, positiv skalering på alle akser — bevarer trekant-viklingen og gir
  // korrekte utovervendte normaler. Y er allerede vendt riktig vei i
  // pathCommandsToShapes (font-Y negeres der), så ingen speiling trengs her.
  geom.scale(scale, scale, 1);
  geom.computeBoundingBox();
  const bbox2 = geom.boundingBox!;
  geom.translate(
    -(bbox2.min.x + bbox2.max.x) / 2,
    -(bbox2.min.y + bbox2.max.y) / 2,
    -extrudeDepth / 2,
  );
  // Legg teksten flatt på arbeidsflaten. Etter ekstruderingen står bokstavene
  // oppreist i XY-planet med tykkelsen langs Z. En rotasjon på -90° om X legger
  // bokstavene ned i arbeidsflate-planet, slik at ekstrusjons-tykkelsen peker
  // oppover (bruker-Z) — teksten ligger da på flaten i stedet for å stå reist.
  geom.rotateX(-Math.PI / 2);
  return geom;
}

/**
 * Kall denne tidlig (f.eks. i Akse.svelte sin onMount) for å pre-loade fonten.
 * Komponenter kan kalle buildTextGeometrySync() og få null hvis ikke klar,
 * og prøve igjen i et $effect når fonten er lastet.
 */
export function preloadFont(url: string = DEFAULT_FONT_URL): Promise<any> {
  return loadFont(url);
}

/**
 * Konverter opentype.js path-commands til Three.js Shapes — med ekte hull.
 * En sub-path starter ved 'M' og lukkes ved 'Z'. Kurver tegnes med quadraticCurveTo /
 * bezierCurveTo.
 *
 * Hver lukket sub-path samples til et polygon. En sub-path som ligger inne i et
 * oddetall andre sub-paths regnes som et hull (counter) — den kobles på den nærmeste
 * omsluttende formen via Shape.holes, slik at hullet i bokstaver som a, o, e, b, d,
 * p, q, A, B, O, R blir et gjennomgående hull i den ekstruderte geometrien.
 * (THREE's ExtrudeGeometry retter selv opp viklerretningen på hull.)
 */
function pathCommandsToShapes(cmds: any[]): THREE.Shape[] {
  // 1. Bygg én THREE.Shape per lukket sub-path
  const subPaths: THREE.Shape[] = [];
  let current: THREE.Shape | null = null;

  // OpenType-fonter bruker font-design-units med Y-aksen pekende NED. Vi negerer
  // Y her slik at konturene blir Y-opp (riktig vei). Det MÅ gjøres som en ekte
  // negering av koordinatene — ikke som en negativ skalering av den ferdige
  // geometrien — for en speil-skalering snur trekant-viklingen og gir innvendt-ut
  // geometri (frontflater kulleres bort → "opprevet", uleselig rendering).
  for (const c of cmds) {
    if (c.type === 'M') {
      current = new THREE.Shape();
      current.moveTo(c.x, -c.y);
    } else if (current) {
      if (c.type === 'L') current.lineTo(c.x, -c.y);
      else if (c.type === 'Q') current.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') current.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
      else if (c.type === 'Z') {
        subPaths.push(current);
        current = null;
      }
    }
  }
  if (current) subPaths.push(current);

  // 2. Sample hvert polygon for inneslutnings-testing; dropp degenererte konturer
  const built = subPaths
    .map((shape) => ({ shape, poly: shape.getPoints(8) }))
    .filter((b) => b.poly.length >= 3);

  // Én eller ingen kontur — ingen hull mulig
  if (built.length <= 1) return built.map((b) => b.shape);

  // 3. Nesting-dybde: hvor mange andre konturer omslutter denne?
  //    Partall (0, 2, …) = fylt form, oddetall (1, 3, …) = hull.
  const depth = built.map((b, i) => {
    const ref = b.poly[0];
    let d = 0;
    for (let j = 0; j < built.length; j++) {
      if (j !== i && pointInPolygon(ref, built[j].poly)) d++;
    }
    return d;
  });

  // 4. Fylte former blir top-level Shapes; hull kobles på nærmeste forelder.
  const result: THREE.Shape[] = [];
  for (let i = 0; i < built.length; i++) {
    if (depth[i] % 2 === 0) result.push(built[i].shape);
  }
  for (let i = 0; i < built.length; i++) {
    if (depth[i] % 2 === 1) {
      const parent = findEnclosingShape(i, built, depth);
      if (parent) parent.holes.push(built[i].shape);
      else result.push(built[i].shape);  // foreldreløst — fall tilbake til fylt
    }
  }
  return result;
}

/** Finn den nærmeste (minste) omsluttende fylte formen for et hull. */
function findEnclosingShape(
  holeIdx: number,
  built: Array<{ shape: THREE.Shape; poly: THREE.Vector2[] }>,
  depth: number[],
): THREE.Shape | null {
  const ref = built[holeIdx].poly[0];
  let best: number | null = null;
  for (let j = 0; j < built.length; j++) {
    if (j === holeIdx) continue;
    if (depth[j] !== depth[holeIdx] - 1) continue;  // kun nivået rett over
    if (!pointInPolygon(ref, built[j].poly)) continue;
    if (best === null || polygonArea(built[j].poly) < polygonArea(built[best].poly)) {
      best = j;
    }
  }
  return best === null ? null : built[best].shape;
}

/** Ray-casting: ligger punktet inne i polygonet? */
function pointInPolygon(pt: THREE.Vector2, poly: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Absolutt areal av polygon (shoelace) — brukt til å velge minste forelder. */
function polygonArea(poly: THREE.Vector2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a) / 2;
}

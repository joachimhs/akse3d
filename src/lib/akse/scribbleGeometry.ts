import * as THREE from 'three';
import polygonClipping, { type MultiPolygon } from 'polygon-clipping';

const STROKE_WIDTH_MM = 3;  // tykkelse på hver strek i mm
const SAMPLES_PER_SEGMENT = 6;  // glatthet — flere = mykere kurver, mer geometri

/**
 * Bygg en 3D-geometri fra én eller flere streker.
 * For hver strek:
 *   1) smooth punktene med en CatmullRom-kurve (centripetal, ingen overshoots),
 *   2) generer offset-polygon (venstre/høyre kanter perpendikulært til tangenten),
 *   3) ekstruder vertikalt med ExtrudeGeometry.
 * Resultatet er én sammenhengende mesh per strek (ingen indre kanter mellom bokser).
 *
 * Returnerer null hvis ingen meningsfulle streker.
 */
export function buildScribbleGeometryFromPaths(
  paths: number[][],
  size: [number, number, number],
): THREE.BufferGeometry | null {
  if (!paths || paths.length === 0) return null;

  const extrudeHeight = size[2];
  const parts: THREE.BufferGeometry[] = [];

  for (const path of paths) {
    if (path.length < 4) continue;
    const geom = buildSmoothStrokeGeometry(path, extrudeHeight);
    if (geom) parts.push(geom);
  }

  if (parts.length === 0) return null;

  const merged = mergeBufferGeometries(parts);
  for (const p of parts) p.dispose();
  if (!merged) return null;

  // Skaler geometrien til target-size i X (bredde) og Z (dybde, etter swap).
  // Y-aksen (høyde) er allerede ekstrudert til extrudeHeight, så holdes som er.
  merged.computeBoundingBox();
  const bbox = merged.boundingBox!;
  const currentW = bbox.max.x - bbox.min.x;
  const currentD = bbox.max.z - bbox.min.z;
  const targetW = size[0];
  const targetD = size[1];
  const scaleW = currentW > 0 ? targetW / currentW : 1;
  const scaleD = currentD > 0 ? targetD / currentD : 1;
  merged.scale(scaleW, 1, scaleD);

  // Sentrer om origo (samme som andre figurer)
  merged.computeBoundingBox();
  const bbox2 = merged.boundingBox!;
  merged.translate(
    -(bbox2.min.x + bbox2.max.x) / 2,
    -(bbox2.min.y + bbox2.max.y) / 2,
    -(bbox2.min.z + bbox2.max.z) / 2,
  );

  return merged;
}

/**
 * Bygg én glatt strek-geometri (offset-polygon ekstrudert).
 * Punktene er flat [x0,y0,x1,y1,...] i bruker-XY-rom (mm).
 */
function buildSmoothStrokeGeometry(points: number[], extrudeHeight: number): THREE.BufferGeometry | null {
  // Konverter til 2D-vektorer i bruker-rom
  const original: THREE.Vector2[] = [];
  for (let i = 0; i < points.length; i += 2) {
    original.push(new THREE.Vector2(points[i], points[i + 1]));
  }

  // Smooth med CatmullRom hvis 3+ punkter
  let smooth: THREE.Vector2[];
  if (original.length >= 3) {
    // Bruk CatmullRomCurve3 i 2D (Z=0)
    const points3D = original.map((p) => new THREE.Vector3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(points3D, false, 'centripetal');
    const numSamples = Math.max(8, (original.length - 1) * SAMPLES_PER_SEGMENT);
    const samples = curve.getPoints(numSamples);
    smooth = samples.map((p) => new THREE.Vector2(p.x, p.y));
  } else {
    smooth = original;
  }

  if (smooth.length < 2) return null;

  // Bygg offset-polygon (venstre + høyre kanter)
  const halfWidth = STROKE_WIDTH_MM / 2;
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];

  for (let i = 0; i < smooth.length; i++) {
    // Tangent: gjennomsnitt av forrige og neste segment-retning
    let tx = 0, ty = 0;
    if (i > 0) {
      const dx = smooth[i].x - smooth[i - 1].x;
      const dy = smooth[i].y - smooth[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      tx += dx / len;
      ty += dy / len;
    }
    if (i < smooth.length - 1) {
      const dx = smooth[i + 1].x - smooth[i].x;
      const dy = smooth[i + 1].y - smooth[i].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      tx += dx / len;
      ty += dy / len;
    }
    const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= tlen;
    ty /= tlen;
    // Perpendikulær (90° rotasjon mot venstre)
    const nx = -ty;
    const ny = tx;
    left.push(new THREE.Vector2(smooth[i].x + nx * halfWidth, smooth[i].y + ny * halfWidth));
    right.push(new THREE.Vector2(smooth[i].x - nx * halfWidth, smooth[i].y - ny * halfWidth));
  }

  // Lukket polygon: venstre kant fremover, så høyre kant bakover
  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) {
    shape.lineTo(left[i].x, left[i].y);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    shape.lineTo(right[i].x, right[i].y);
  }
  shape.closePath();

  // Ekstruder i Z (Three.js Z = depth aksen). Vi konverterer til vår koordinat-konvensjon
  // ved å rotere -90° rundt X etterpå (Three.js Z → Y, og Y → -Z).
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeHeight,
    bevelEnabled: false,
    curveSegments: 1,
  });

  // Etter rotateX(-π/2): Shape's (sx, sy, 0..depth) → (sx, depth..0, -sy)
  // Det gir: bruker (x, y, z_lift) → three (x, z, -y) — matcher swap-konvensjonen.
  geom.rotateX(-Math.PI / 2);

  return geom;
}

/**
 * Bygg 3D-geometri ved å behandle hver strek som lukket polygon, så union av alle,
 * og deretter ekstrudere det resulterende fyllet. Brukes når brukeren har valgt
 * "Fyll figur" i ScribbleEditor.
 */
export function buildScribbleFilledGeometryFromPaths(
  paths: number[][],
  size: [number, number, number],
): THREE.BufferGeometry | null {
  if (!paths || paths.length === 0) return null;
  const extrudeHeight = size[2];

  // Konverter hver strek til en lukket polygon-ring (siste punkt = første),
  // pakket som single-polygon MultiPolygon
  const multiPolys: MultiPolygon[] = [];
  for (const path of paths) {
    if (path.length < 6) continue;  // trenger minst 3 punkter (6 tall)
    const ring: Array<[number, number]> = [];
    for (let i = 0; i < path.length; i += 2) {
      ring.push([path[i], path[i + 1]]);
    }
    // polygon-clipping krever lukket ring
    ring.push([ring[0][0], ring[0][1]]);
    multiPolys.push([[ring]]);
  }
  if (multiPolys.length === 0) return null;

  // Union av alle streker
  let result: MultiPolygon = multiPolys[0];
  for (let i = 1; i < multiPolys.length; i++) {
    result = polygonClipping.union(result, multiPolys[i]);
  }
  if (result.length === 0) return null;

  // Bygg THREE.Shape per resulterende polygon (ytre + hull)
  const shapes: THREE.Shape[] = result.map(poly => {
    const [outer, ...holes] = poly;
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    }
    return shape;
  });

  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: extrudeHeight,
    bevelEnabled: false,
    curveSegments: 1,
  });

  // Akse-konvensjon: Y er opp (samme som ribbon-varianten)
  geom.rotateX(-Math.PI / 2);

  // Skaler til target-størrelse i X og Z (samme prinsipp som ribbon-varianten)
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const currentW = bbox.max.x - bbox.min.x;
  const currentD = bbox.max.z - bbox.min.z;
  const scaleW = currentW > 0 ? size[0] / currentW : 1;
  const scaleD = currentD > 0 ? size[1] / currentD : 1;
  geom.scale(scaleW, 1, scaleD);

  // Sentrer om origo
  geom.computeBoundingBox();
  const bbox2 = geom.boundingBox!;
  geom.translate(
    -(bbox2.min.x + bbox2.max.x) / 2,
    -(bbox2.min.y + bbox2.max.y) / 2,
    -(bbox2.min.z + bbox2.max.z) / 2,
  );

  return geom;
}

/**
 * Backwards-compat wrapper for den gamle `points`-baserte API-en.
 * Behandler `points` som én lukket eller åpen sti (én strek).
 */
export function buildScribbleGeometry(
  points: number[],
  size: [number, number, number],
): THREE.BufferGeometry | null {
  if (!points || points.length < 4) return null;
  return buildScribbleGeometryFromPaths([points], size);
}

/**
 * Manuell merge av BufferGeometries.
 */
function mergeBufferGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geoms.length === 0) return null;

  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geoms) {
    const pos = g.getAttribute('position');
    if (!pos) return null;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    totalVerts += pos.count;
    const idx = g.getIndex();
    if (idx) totalIdx += idx.count;
    else totalIdx += pos.count;
  }

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const idxArr = totalIdx <= 65535 ? new Uint16Array(totalIdx) : new Uint32Array(totalIdx);

  let vOff = 0, iOff = 0;
  for (const g of geoms) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    posArr.set(pos.array as ArrayLike<number>, vOff * 3);
    normArr.set(norm.array as ArrayLike<number>, vOff * 3);
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        idxArr[iOff + i] = idx.getX(i) + vOff;
      }
      iOff += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        idxArr[iOff + i] = i + vOff;
      }
      iOff += pos.count;
    }
    vOff += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
  // Dummy UV for three-bvh-csg compat
  merged.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(totalVerts * 2), 2));
  return merged;
}

// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/csgEngine.ts

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// three-bvh-csg's .d.ts har Brush extends Mesh fra 'three' — siden 'three' ikke har
// type-deklarasjoner i prosjektet, ender Brush opp uten Mesh-medlemmer (geometry,
// updateMatrixWorld, etc). Vi caster derfor til any der vi trenger Mesh-API-et.
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import type { Shape } from '$lib/models';
import { buildGeometry, applyTransform } from './shapes';
import { buildTextGeometrySync } from './textGeometry';
import { buildScribbleGeometry, buildScribbleGeometryFromPaths, buildScribbleFilledGeometryFromPaths } from './scribbleGeometry';
import { extrudeSketch } from './plantegning/sketchExtrude';
import { buildStlGeometry } from './stlImport';

export interface CompiledMesh {
  groupId: string | null;
  mesh: THREE.Mesh | null;
  shapeIds: string[];
}

/** Context-nøkkel for den delte CsgEngine-instansen (scene-visning + STL-eksport). */
export const CSG_ENGINE_CONTEXT_KEY = Symbol('akse-csg-engine');

const SOLID_MATERIAL_DEFAULTS = {
  metalness: 0.1,
  roughness: 0.7,
  flatShading: false,
};

export class CsgEngine {
  private evaluator = new Evaluator();
  private cache = new Map<string, CompiledMesh>();

  compile(shapes: Shape[]): CompiledMesh[] {
    // 1. Group shapes by groupId. Ugrupperte = en gruppe per shape.
    const groups = new Map<string, Shape[]>();
    for (const s of shapes) {
      const key = s.groupId ?? `__solo_${s.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const result: CompiledMesh[] = [];
    const seenKeys = new Set<string>();

    for (const [key, groupShapes] of groups) {
      const hash = hashGroup(groupShapes);
      seenKeys.add(hash);

      const cached = this.cache.get(hash);
      if (cached) {
        result.push(cached);
        continue;
      }

      const compiled = this.compileGroup(
        groupShapes[0].groupId,
        groupShapes,
      );
      this.cache.set(hash, compiled);
      result.push(compiled);
    }

    // Evict cache entries we didn't use
    for (const k of [...this.cache.keys()]) {
      if (!seenKeys.has(k)) {
        const c = this.cache.get(k);
        if (c) this.disposeCompiled(c);
        this.cache.delete(k);
      }
    }

    return result;
  }

  private compileGroup(groupId: string | null, shapes: Shape[]): CompiledMesh {
    const solids = shapes.filter((s) => s.mode === 'solid');
    const holes = shapes.filter((s) => s.mode === 'hole');
    const shapeIds = shapes.map((s) => s.id);

    // Ingen solider (kun hull — enkeltstående ELLER en gruppe av bare hull):
    // vis hullene som halv-transparente røde ghosts. De har ingenting å trekkes
    // fra ennå, men skal ikke bli usynlige.
    if (solids.length === 0) {
      if (holes.length === 0) return { groupId, mesh: null, shapeIds };
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.4,
        ...SOLID_MATERIAL_DEFAULTS,
      });
      const ghosts: THREE.Mesh[] = [];
      for (const h of holes) {
        const brush = this.makeBrush(h);
        if (!brush) continue;
        ghosts.push(new THREE.Mesh((brush as any).geometry.clone(), mat));
        (brush as any).geometry.dispose();
      }
      if (ghosts.length === 0) return { groupId, mesh: null, shapeIds };
      if (ghosts.length === 1) return { groupId, mesh: ghosts[0], shapeIds };
      // Flere hull → pakk i en Group (samme cast-presedens som CSG-fallbacken under)
      const ghostGroup = new THREE.Group();
      for (const g of ghosts) ghostGroup.add(g);
      return { groupId, mesh: ghostGroup as unknown as THREE.Mesh, shapeIds };
    }

    const solidBrushes = solids.map((s) => this.makeBrush(s)).filter(Boolean) as Brush[];
    const holeBrushes = holes.map((s) => this.makeBrush(s)).filter(Boolean) as Brush[];

    if (solidBrushes.length === 0) {
      return { groupId, mesh: null, shapeIds };
    }

    try {
      const intermediates: Brush[] = [];

      // 1. Kombinér solidene til ett resultat-brush. Adskilte solider slås
      //    sammen uten CSG (lineært, raskt) — union av adskilte volumer er bare
      //    volumene satt sammen. Kun overlappende solider krever ekte boolsk
      //    union via three-bvh-csg, som er tregt på kompleks geometri.
      let result: Brush;
      if (solidBrushes.length === 1) {
        result = solidBrushes[0];
      } else {
        const mergedSolids = anyBrushesOverlap(solidBrushes)
          ? null
          : mergeDisjointBrushGeometries(solidBrushes);
        if (mergedSolids) {
          result = makeGeometryBrush(mergedSolids);
          intermediates.push(result);
        } else {
          result = solidBrushes[0];
          for (let i = 1; i < solidBrushes.length; i++) {
            result = this.evaluator.evaluate(result, solidBrushes[i], ADDITION);
            intermediates.push(result);
          }
        }
      }

      // 2. Trekk fra hullene. Flere adskilte hull (f.eks. gravert tekst + en
      //    stjerne) slås først sammen til ETT brush, så det blir én subtraksjon
      //    på det enkle solidet i stedet for flere sekvensielle subtraksjoner
      //    der hver re-prosesserer et stadig mer komplekst mellomresultat.
      if (holeBrushes.length > 0) {
        let toSubtract = holeBrushes;
        if (holeBrushes.length >= 2 && !anyBrushesOverlap(holeBrushes)) {
          const mergedHoles = mergeDisjointBrushGeometries(holeBrushes);
          if (mergedHoles) {
            const holeBrush = makeGeometryBrush(mergedHoles);
            intermediates.push(holeBrush);
            toSubtract = [holeBrush];
          }
        }
        for (const h of toSubtract) {
          result = this.evaluator.evaluate(result, h, SUBTRACTION);
          intermediates.push(result);
        }
      }

      // Hent farge fra første solid-shape (visning kun)
      const color = solids[0].color || '#4a90e2';
      const material = new THREE.MeshStandardMaterial({
        color,
        ...SOLID_MATERIAL_DEFAULTS,
      });

      const mesh = new THREE.Mesh((result as any).geometry.clone(), material);

      // Dispose input-brushes og alle mellomresultater (siste resultat er
      // allerede klonet inn i mesh-en over)
      for (const b of solidBrushes) (b as any).geometry.dispose();
      for (const b of holeBrushes) (b as any).geometry.dispose();
      for (const b of intermediates) (b as any).geometry.dispose();

      return { groupId, mesh, shapeIds };
    } catch (err) {
      const kindSummary = shapes.map((s) => s.kind).join('+');
      console.warn(
        `Akse CSG: evaluation failed for group ${groupId ?? '(solo)'} ` +
        `(${shapes.length} shapes: ${kindSummary}, ${solids.length} solid + ${holes.length} hole). ` +
        `Faller tilbake til å vise solidene uten boolean-kombinasjon. Feil:`,
        err,
      );
      // Cleanup input brushes
      for (const b of solidBrushes) (b as any).geometry.dispose();
      for (const b of holeBrushes) (b as any).geometry.dispose();

      // FALLBACK: vis hver solid som separat mesh i en Group, så brukeren
      // ihvertfall ser figurene (uten CSG-kombinasjon, uten hull).
      const fallbackGroup = new THREE.Group();
      const color = solids[0].color || '#4a90e2';
      const material = new THREE.MeshStandardMaterial({
        color,
        ...SOLID_MATERIAL_DEFAULTS,
      });
      for (const s of solids) {
        try {
          const fbBrush = this.makeBrush(s);
          if (fbBrush) {
            const mesh = new THREE.Mesh((fbBrush as any).geometry.clone(), material);
            fallbackGroup.add(mesh);
            (fbBrush as any).geometry.dispose();
          }
        } catch {
          // skip individual shape if it also fails
        }
      }
      // Wrap in a Mesh-like object: vi trenger en mesh-typed felt for CompiledMesh,
      // men kan ikke direkte returnere en Group. Bruk en dummy mesh som peker på Group-children.
      // Enklest: returner Group som om det var en mesh (CompiledMesh.mesh er typed THREE.Mesh,
      // men vi caster). SceneCanvas legger den bare til shapeRoot — fungerer for Group også.
      const fakeMesh = fallbackGroup as unknown as THREE.Mesh;
      return { groupId, mesh: fakeMesh, shapeIds };
    }
  }

  private makeBrush(shape: Shape): Brush | null {
    const geom = buildShapeGeometry(shape);
    if (!geom) return null;
    const transformed = applyTransform(geom, shape);
    geom.dispose();
    const brush = new (Brush as any)(transformed) as Brush;
    (brush as any).updateMatrixWorld();
    return brush;
  }

  private disposeCompiled(c: CompiledMesh): void {
    if (!c.mesh) return;
    // c.mesh kan være en ekte Mesh ELLER en Group av mesher (hull-ghosts, CSG-fallback)
    const targets: THREE.Mesh[] = (c.mesh as any).isGroup
      ? ((c.mesh as unknown as THREE.Group).children.filter((ch) => (ch as any).isMesh) as THREE.Mesh[])
      : [c.mesh];
    for (const m of targets) {
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose();  // delt materiale: dispose() flere ganger er trygt i three.js
    }
  }

  dispose(): void {
    for (const c of this.cache.values()) {
      this.disposeCompiled(c);
    }
    this.cache.clear();
  }
}

/**
 * Bygg utransformert (origo-sentrert) geometri for én enkelt shape, uavhengig av
 * CSG. Brukes av makeBrush og av ghost-previews (f.eks. juster/fordel-hover).
 * Returnerer null hvis geometrien ikke kan bygges ennå (font ikke lastet, tom data).
 */
export function buildShapeGeometry(shape: Shape): THREE.BufferGeometry | null {
  if (shape.kind === 'text') {
    return buildTextGeometrySync(shape.text ?? '', shape.size);  // null: font ikke lastet, eller tom tekst
  }
  if (shape.kind === 'scribble') {
    // Foretrekk paths (multi-strek), fall back til points (single-strek, gammel modell)
    if (shape.scribbleFill && shape.paths && shape.paths.length > 0) {
      // "Fyll figur" — behandler streker som lukkede polygoner
      return buildScribbleFilledGeometryFromPaths(shape.paths, shape.size);
    }
    if (shape.paths && shape.paths.length > 0) {
      return buildScribbleGeometryFromPaths(shape.paths, shape.size);
    }
    return buildScribbleGeometry(shape.points ?? [], shape.size);
  }
  if (shape.kind === 'sketch') {
    if (!shape.sketchData) return null;
    return extrudeSketch(shape.sketchData);
  }
  if (shape.kind === 'stl') {
    return buildStlGeometry(shape);
  }
  return buildGeometry(shape);
}

/**
 * True hvis minst to av brush-geometriene har overlappende bounding-bokser.
 * Berøring teller som overlapp (intersectsBox) — da skal CSG sveise sammen
 * flatene i stedet for å la to sammenfallende flater bli liggende oppå hverandre.
 */
function anyBrushesOverlap(brushes: Brush[]): boolean {
  const boxes = brushes.map((b) => {
    const g = (b as any).geometry as THREE.BufferGeometry;
    g.computeBoundingBox();
    return g.boundingBox as THREE.Box3;
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].intersectsBox(boxes[j])) return true;
    }
  }
  return false;
}

/**
 * Slå sammen flere adskilte brush-geometrier til én BufferGeometry uten CSG.
 * Normaliserer til non-indexed så mergeGeometries kan kombinere geometrier med
 * ulik indeksering (bokser er indekserte, ekstrudert tekst er det ikke).
 * Returnerer null hvis sammenslåingen feiler (caller faller da tilbake til CSG).
 */
function mergeDisjointBrushGeometries(brushes: Brush[]): THREE.BufferGeometry | null {
  const temps: THREE.BufferGeometry[] = [];
  for (const b of brushes) {
    const g = (b as any).geometry as THREE.BufferGeometry;
    // toNonIndexed() returnerer self for allerede non-indexed geometri — derfor
    // clone() i det tilfellet, så temps alltid er trygge å dispose etterpå.
    temps.push(g.index ? g.toNonIndexed() : g.clone());
  }
  let merged: THREE.BufferGeometry | null = null;
  try {
    merged = mergeGeometries(temps, false);
  } catch {
    merged = null;
  }
  for (const t of temps) t.dispose();
  return merged;
}

/** Pakk en BufferGeometry inn i et three-bvh-csg Brush klart for evaluering. */
function makeGeometryBrush(geometry: THREE.BufferGeometry): Brush {
  const brush = new (Brush as any)(geometry) as Brush;
  (brush as any).updateMatrixWorld();
  return brush;
}

/**
 * Stabil hash av en gruppe-shapes basert på deres innhold.
 * Lik hash = lik output (cache hit).
 */
function hashGroup(shapes: Shape[]): string {
  const parts = [...shapes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      // color inkluderes i hash så fargeendring trigger cache-miss og nytt material
      const base = `${s.id}|${s.kind}|${s.mode}|${s.color}|${s.position.join(',')}|${s.rotation.join(',')}|${s.size.join(',')}`;
      if (s.kind === 'text') {
        return `${base}|${s.text}|${s.textHeight ?? ''}`;
      }
      if (s.kind === 'scribble') {
        // Hash basert på paths (eller fallback til points). Bruk total lengde + sum av første 20 tall.
        const allNums: number[] = [];
        if (s.paths) {
          for (const p of s.paths) allNums.push(...p);
        } else if (s.points) {
          allNums.push(...s.points);
        }
        const checksum = allNums.slice(0, 20).reduce((acc, n) => acc + n, 0);
        return `${base}|scr:${allNums.length}:${checksum.toFixed(2)}|fill:${s.scribbleFill ? '1' : '0'}`;
      }
      if (s.kind === 'stl') {
        // stlData er immutabel per shape, men duplikater kan dele id-uavhengig
        // innhold — lengde holder som innholds-fingerprint sammen med id i base.
        return `${base}|stl:${s.stlData?.length ?? 0}`;
      }
      if (s.kind === 'sketch' && s.sketchData) {
        const figs = s.sketchData.figures
          .map(f => `${f.id}|${f.kind}|${f.mode}|${f.position.x},${f.position.y}|${f.rotation}|${f.width ?? ''}|${f.height ?? ''}|${f.radius ?? ''}|${f.radiusX ?? ''}|${f.radiusY ?? ''}|${f.cornerRadius ?? ''}|${f.sides ?? ''}|${f.apexX ?? ''}|${f.starMode ? '1' : '0'}|${f.innerRadius ?? ''}`)
          .join(';');
        return `${base}|${figs}|${s.sketchData.extrudeHeight}`;
      }
      return base;
    });
  return parts.join('::');
}

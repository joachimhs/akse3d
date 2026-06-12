// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// @skaperiet/akse — interaktive guider.
//
// En guide sendes inn til <Akse>-komponenten som prop (samme port-tankegang som
// storage/session: host eier datakilden, pakken eier visningen). Mønsteret
// speiler Blockuino-/Vektor-guidene i skaperiet-ny-front: steg med markdown,
// bilde og en validator som enten er 'info' (manuelt «Forstått»-klikk) eller
// sjekkes reaktivt mot prosjektets figurer.

import type { Shape, ShapeKind } from './models';
import type { SketchData, SketchFigure, SketchFigureKind } from './akse/plantegning/sketchTypes';

/**
 * Validator per steg. 'info' passeres manuelt av brukeren; resten evalueres
 * automatisk mot prosjektets figurliste hver gang den endres.
 */
export type AkseValidator =
  /** Rent informasjonssteg — brukeren bekrefter med «Forstått, gå videre». */
  | { type: 'info' }
  /** Prosjektet har minst `minCount` (default 1) figurer av `kind`, ev. filtrert på `mode`. */
  | { type: 'hasShapeKind'; kind: ShapeKind; minCount?: number; mode?: 'solid' | 'hole' }
  /** Prosjektet har minst `minCount` figurer totalt. */
  | { type: 'shapeCount'; minCount: number }
  /**
   * Minst én figur (ev. filtrert på `kind`/`mode`) har en størrelse innenfor
   * grensene. `dim` er 'b' (bredde), 'd' (dybde) eller 'h' (høyde) — samme
   * navn som Størrelse-feltene i egenskapspanelet. Bruk til konkrete
   * instruksjoner som «sett H til 6».
   */
  | {
      type: 'shapeSize';
      kind?: ShapeKind;
      mode?: 'solid' | 'hole';
      dim: 'b' | 'd' | 'h';
      min?: number;
      max?: number;
    }
  /** Minst én figur er satt til hull-modus. */
  | { type: 'hasHole' }
  /**
   * Minst ett hull overlapper (bounding-boks, > 0.5 mm på alle akser) en solid
   * figur. Med `sameGroup: true` må de to også være gruppert sammen.
   */
  | { type: 'holeOverlapsSolid'; sameGroup?: boolean }
  /** En figur av `kindA` overlapper (bounding-boks) en figur av `kindB`. */
  | { type: 'shapesOverlap'; kindA: ShapeKind; kindB: ShapeKind }
  /**
   * En plantegning (åpen i editoren ELLER allerede lagt på arbeidsplaten)
   * inneholder minst `minCount` figurer av `figureKind`, ev. filtrert på
   * `mode` og med bredde/høyde (mm) innenfor grensene. Sirkel/polygon måles
   * som diameter.
   */
  | {
      type: 'sketchFigure';
      figureKind: SketchFigureKind;
      mode?: 'solid' | 'hole';
      minCount?: number;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
    }
  /** En plantegning har 3D-høyde (mm) innenfor grensene. */
  | { type: 'sketchExtrudeHeight'; min?: number; max?: number }
  /**
   * Minst to figurer er gruppert sammen. Med `withHole: true` må gruppen
   * inneholde både et hull og en solid figur (hull skjærer kun figurer i
   * samme gruppe — slik «ser man resultatet»).
   */
  | { type: 'hasGroup'; withHole?: boolean }
  /** Minst én figur (ev. av `kind`) har fargen `color` (hex, case-insensitiv). */
  | { type: 'hasColor'; color: string; kind?: ShapeKind };

export interface AkseGuideStep {
  id: string;
  /** Kort steg-tittel, f.eks. «Legg til en smultring». */
  title: string;
  /** Brødtekst i markdown (rendres med marked). */
  bodyMarkdown?: string | null;
  /** Valgfritt instruksjonsbilde; kan klikkes for stor visning. */
  imageUrl?: string | null;
  validator: AkseValidator;
}

export interface AkseGuide {
  id: string;
  name: string;
  description?: string | null;
  steps: AkseGuideStep[];
}

/** AABB-overlapp (> 0.5 mm på alle akser); position = senter, bbox = position ± size/2. */
function shapesAabbOverlap(a: Shape, b: Shape): boolean {
  const MIN_OVERLAP = 0.5;
  for (let axis = 0; axis < 3; axis++) {
    const lo = Math.max(a.position[axis] - a.size[axis] / 2, b.position[axis] - b.size[axis] / 2);
    const hi = Math.min(a.position[axis] + a.size[axis] / 2, b.position[axis] + b.size[axis] / 2);
    if (hi - lo < MIN_OVERLAP) return false;
  }
  return true;
}

/** Bredde/høyde i mm for en skissefigur (sirkel/polygon = diameter). */
function sketchFigureDims(f: SketchFigure): { w: number; h: number } {
  switch (f.kind) {
    case 'rectangle':
    case 'roundedRect':
    case 'triangle':
      return { w: f.width ?? 0, h: f.height ?? 0 };
    case 'circle':
    case 'polygon':
      return { w: 2 * (f.radius ?? 0), h: 2 * (f.radius ?? 0) };
    case 'ellipse':
      return { w: 2 * (f.radiusX ?? 0), h: 2 * (f.radiusY ?? 0) };
  }
}

/** Alle skisser som kan valideres: den som er åpen i editoren + de på arbeidsplaten. */
function relevantSketches(shapes: Shape[], activeSketch: SketchData | null | undefined): SketchData[] {
  const result: SketchData[] = [];
  if (activeSketch) result.push(activeSketch);
  for (const s of shapes) {
    if (s.kind === 'sketch' && s.sketchData) result.push(s.sketchData);
  }
  return result;
}

/**
 * Evaluer en validator mot prosjektets figurer. 'info' er alltid false (manuell).
 * `activeSketch` er skissen som ev. er åpen i Plantegning-editoren — den lar
 * sketch-validatorer gi grønn hake live, mens brukeren fortsatt tegner.
 */
export function runAkseValidator(
  v: AkseValidator,
  shapes: Shape[],
  activeSketch?: SketchData | null,
): boolean {
  switch (v.type) {
    case 'info':
      return false;
    case 'hasShapeKind': {
      const min = v.minCount ?? 1;
      let n = 0;
      for (const s of shapes) {
        if (s.kind !== v.kind) continue;
        if (v.mode && s.mode !== v.mode) continue;
        n++;
        if (n >= min) return true;
      }
      return false;
    }
    case 'shapeCount':
      return shapes.length >= v.minCount;
    case 'shapeSize': {
      const dimIndex = v.dim === 'b' ? 0 : v.dim === 'd' ? 1 : 2;
      return shapes.some((s) => {
        if (v.kind && s.kind !== v.kind) return false;
        if (v.mode && s.mode !== v.mode) return false;
        const value = s.size[dimIndex];
        if (v.min !== undefined && value < v.min) return false;
        if (v.max !== undefined && value > v.max) return false;
        return true;
      });
    }
    case 'hasHole':
      return shapes.some((s) => s.mode === 'hole');
    case 'holeOverlapsSolid': {
      for (const hole of shapes) {
        if (hole.mode !== 'hole') continue;
        for (const solid of shapes) {
          if (solid.mode !== 'solid') continue;
          if (v.sameGroup && (!hole.groupId || hole.groupId !== solid.groupId)) continue;
          if (shapesAabbOverlap(hole, solid)) return true;
        }
      }
      return false;
    }
    case 'shapesOverlap': {
      for (const a of shapes) {
        if (a.kind !== v.kindA) continue;
        for (const b of shapes) {
          if (b.kind !== v.kindB || b === a) continue;
          if (shapesAabbOverlap(a, b)) return true;
        }
      }
      return false;
    }
    case 'sketchFigure': {
      const min = v.minCount ?? 1;
      let n = 0;
      for (const sketch of relevantSketches(shapes, activeSketch)) {
        for (const f of sketch.figures) {
          if (f.kind !== v.figureKind) continue;
          if (v.mode && f.mode !== v.mode) continue;
          const { w, h } = sketchFigureDims(f);
          if (v.minWidth !== undefined && w < v.minWidth) continue;
          if (v.maxWidth !== undefined && w > v.maxWidth) continue;
          if (v.minHeight !== undefined && h < v.minHeight) continue;
          if (v.maxHeight !== undefined && h > v.maxHeight) continue;
          n++;
          if (n >= min) return true;
        }
      }
      return false;
    }
    case 'sketchExtrudeHeight': {
      for (const sketch of relevantSketches(shapes, activeSketch)) {
        const h = sketch.extrudeHeight;
        if (v.min !== undefined && h < v.min) continue;
        if (v.max !== undefined && h > v.max) continue;
        return true;
      }
      return false;
    }
    case 'hasGroup': {
      const groups = new Map<string, Shape[]>();
      for (const s of shapes) {
        if (!s.groupId) continue;
        const members = groups.get(s.groupId);
        if (members) members.push(s);
        else groups.set(s.groupId, [s]);
      }
      for (const members of groups.values()) {
        if (members.length < 2) continue;
        if (!v.withHole) return true;
        if (members.some((m) => m.mode === 'hole') && members.some((m) => m.mode === 'solid')) {
          return true;
        }
      }
      return false;
    }
    case 'hasColor': {
      const target = v.color.toLowerCase();
      return shapes.some(
        (s) => s.color.toLowerCase() === target && (!v.kind || s.kind === v.kind),
      );
    }
  }
}

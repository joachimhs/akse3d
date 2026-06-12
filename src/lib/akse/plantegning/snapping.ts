// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/plantegning/snapping.ts
import type { SketchFigure } from './sketchTypes';
import { polygonize } from './polygonize';
import { SNAP_GRID_MM } from './sketchTypes';

export interface SnapResult {
  x: number;                    // snappet X i mm
  y: number;                    // snappet Y i mm
  guides: SnapGuide[];          // smart-guide-linjer å vise
  snapPoint: { x: number; y: number } | null;  // visuell snap-prikk
}

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;             // y for horizontal, x for vertical (mm)
  from: number;                 // mm start-koord (langs aksen)
  to: number;                   // mm slutt-koord
}

const SNAP_TOLERANCE_MM = 1.5;   // tilsvarer ~4px på ~250px/200mm rendering

/**
 * Beregn snap for en figur som dras til (rawX, rawY).
 * `draggedId` ekskluderes fra snap-mål (vi snapper aldri til oss selv).
 * `snapEnabled` styres av Shift-tasten.
 */
export function computeSnap(
  rawX: number,
  rawY: number,
  draggedId: string,
  figures: SketchFigure[],
  snapEnabled: boolean,
): SnapResult {
  if (!snapEnabled) {
    return { x: rawX, y: rawY, guides: [], snapPoint: null };
  }

  // Samle snap-kandidater fra andre figurer: X (venstre/sentrum/høyre), Y (topp/sentrum/bunn)
  const xCandidates: number[] = [0];        // arbeidsplate-sentrum
  const yCandidates: number[] = [0];
  for (const fig of figures) {
    if (fig.id === draggedId) continue;
    const bbox = bboxOf(fig);
    xCandidates.push(bbox.minX, bbox.midX, bbox.maxX);
    yCandidates.push(bbox.minY, bbox.midY, bbox.maxY);
  }

  // Smart-guide snap (kant-til-kant)
  let snappedX = rawX;
  let snappedY = rawY;
  let guideX: number | null = null;
  let guideY: number | null = null;
  for (const cx of xCandidates) {
    if (Math.abs(rawX - cx) < SNAP_TOLERANCE_MM) {
      snappedX = cx;
      guideX = cx;
      break;
    }
  }
  for (const cy of yCandidates) {
    if (Math.abs(rawY - cy) < SNAP_TOLERANCE_MM) {
      snappedY = cy;
      guideY = cy;
      break;
    }
  }

  // Grid snap som fallback (kun hvis ikke smart-guided)
  if (guideX === null) snappedX = Math.round(rawX / SNAP_GRID_MM) * SNAP_GRID_MM;
  if (guideY === null) snappedY = Math.round(rawY / SNAP_GRID_MM) * SNAP_GRID_MM;

  // Bygg guide-linjer for de aksene som faktisk snappet
  const guides: SnapGuide[] = [];
  if (guideX !== null) {
    guides.push({ orientation: 'vertical', position: guideX, from: -100, to: 100 });
  }
  if (guideY !== null) {
    guides.push({ orientation: 'horizontal', position: guideY, from: -100, to: 100 });
  }

  return {
    x: snappedX,
    y: snappedY,
    guides,
    snapPoint: guideX !== null || guideY !== null
      ? { x: snappedX, y: snappedY }
      : null,
  };
}

function bboxOf(fig: SketchFigure): { minX: number; minY: number; midX: number; midY: number; maxX: number; maxY: number } {
  const ring = polygonize(fig).ring;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    minX, maxX, midX: (minX + maxX) / 2,
    minY, maxY, midY: (minY + maxY) / 2,
  };
}

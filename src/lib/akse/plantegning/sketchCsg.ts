// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/plantegning/sketchCsg.ts
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { PolygonFigure } from './polygonize';

/**
 * Beregn (union av solid-figurer) - (union av hull-figurer).
 * Returnerer en MultiPolygon: array av polygoner, hver med [ytre, hull1, hull2, ...].
 * Tomt array hvis ingen solid-figurer.
 */
export function csg2d(figures: PolygonFigure[]): MultiPolygon {
  const solids = figures.filter(f => f.mode === 'solid').map(toMultiPolygon);
  const holes  = figures.filter(f => f.mode === 'hole' ).map(toMultiPolygon);

  if (solids.length === 0) return [];

  let result: MultiPolygon = solids[0];
  for (let i = 1; i < solids.length; i++) {
    result = polygonClipping.union(result, solids[i]);
  }
  for (const h of holes) {
    result = polygonClipping.difference(result, h);
  }
  return result;
}

/** Konverter én PolygonFigure til en single-poly MultiPolygon for polygon-clipping. */
function toMultiPolygon(fig: PolygonFigure): MultiPolygon {
  // polygon-clipping vil ha lukket ring: første punkt repeteres til slutt.
  const closed: Polygon = [[...fig.ring, fig.ring[0]]];
  return [closed];
}

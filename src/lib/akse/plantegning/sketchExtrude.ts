// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/plantegning/sketchExtrude.ts
import * as THREE from 'three';
import type { SketchData } from './sketchTypes';
import { polygonize } from './polygonize';
import { csg2d } from './sketchCsg';

/**
 * Bygg 3D-geometri fra en SketchData. Returnerer null hvis resultatet er tomt.
 * Resultatet er sentrert om origo (matche andre Akse-shapes).
 */
export function extrudeSketch(data: SketchData): THREE.BufferGeometry | null {
  if (data.figures.length === 0) return null;

  const polys = data.figures.map(polygonize);
  const result = csg2d(polys);
  if (result.length === 0) return null;

  const shapes: THREE.Shape[] = result.map(poly => {
    const [outer, ...holes] = poly;
    const shape = new THREE.Shape(
      outer.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(
        hole.map(([x, y]) => new THREE.Vector2(x, y)),
      ));
    }
    return shape;
  });

  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: data.extrudeHeight,
    bevelEnabled: false,
    curveSegments: 1,
  });

  // Akse-konvensjon: Y er opp. ExtrudeGeometry ekstruderer langs +Z;
  // rotateX(-π/2) bytter til Y-opp.
  geom.rotateX(-Math.PI / 2);

  // Sentrer om origo
  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  geom.translate(
    -(bbox.min.x + bbox.max.x) / 2,
    -(bbox.min.y + bbox.max.y) / 2,
    -(bbox.min.z + bbox.max.z) / 2,
  );

  return geom;
}

/**
 * Beregn 2D-bounding-box for sketchen. Brukes til å sette `Shape.size`
 * ved addShape og updateShape.
 */
export function computeSketchBbox(data: SketchData): { width: number; height: number } {
  if (data.figures.length === 0) return { width: 0, height: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const fig of data.figures) {
    const ring = polygonize(fig).ring;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { width: maxX - minX, height: maxY - minY };
}

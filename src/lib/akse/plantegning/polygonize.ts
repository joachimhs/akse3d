// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/plantegning/polygonize.ts
import type { SketchFigure } from './sketchTypes';

export interface PolygonFigure {
  ring: Array<[number, number]>;   // CCW, lukket men siste != første
  mode: 'solid' | 'hole';
}

const CIRCLE_SAMPLES = 48;
const CIRCLE_SAMPLES_PER_QUARTER = 8;

export function polygonize(fig: SketchFigure): PolygonFigure {
  switch (fig.kind) {
    case 'rectangle':       return { ring: rectanglePoints(fig), mode: fig.mode };
    case 'roundedRect':     return { ring: roundedRectPoints(fig), mode: fig.mode };
    case 'circle':          return { ring: circlePoints(fig), mode: fig.mode };
    case 'ellipse':         return { ring: ellipsePoints(fig), mode: fig.mode };
    case 'triangle':        return { ring: trianglePoints(fig), mode: fig.mode };
    case 'polygon':         return { ring: polygonPoints(fig), mode: fig.mode };
  }
}

/** Rotér + translatér en lokal ring til figurens posisjon/rotasjon. */
function transform(local: Array<[number, number]>, fig: SketchFigure): Array<[number, number]> {
  const rad = (fig.rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return local.map(([lx, ly]) => [
    fig.position.x + lx * cos - ly * sin,
    fig.position.y + lx * sin + ly * cos,
  ]);
}

function rectanglePoints(fig: SketchFigure): Array<[number, number]> {
  const w = (fig.width ?? 20) / 2;
  const h = (fig.height ?? 20) / 2;
  // CCW fra venstre-bunn
  const local: Array<[number, number]> = [
    [-w, -h], [w, -h], [w, h], [-w, h],
  ];
  return transform(local, fig);
}

function roundedRectPoints(fig: SketchFigure): Array<[number, number]> {
  const w = (fig.width ?? 20) / 2;
  const h = (fig.height ?? 20) / 2;
  const r = Math.min(fig.cornerRadius ?? 4, w, h);
  const local: Array<[number, number]> = [];
  // CCW: bunn-høyre, topp-høyre, topp-venstre, bunn-venstre
  const corners: Array<[number, number, number]> = [
    [ w - r, -h + r, -Math.PI / 2],  // bunn-høyre senter, start-vinkel -π/2
    [ w - r,  h - r,  0],            // topp-høyre, start 0
    [-w + r,  h - r,  Math.PI / 2],  // topp-venstre, start π/2
    [-w + r, -h + r,  Math.PI],      // bunn-venstre, start π
  ];
  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= CIRCLE_SAMPLES_PER_QUARTER; i++) {
      const t = i / CIRCLE_SAMPLES_PER_QUARTER;
      const a = startAngle + t * (Math.PI / 2);
      local.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return transform(local, fig);
}

function circlePoints(fig: SketchFigure): Array<[number, number]> {
  const r = fig.radius ?? 10;
  const local: Array<[number, number]> = [];
  for (let i = 0; i < CIRCLE_SAMPLES; i++) {
    const a = (i / CIRCLE_SAMPLES) * Math.PI * 2;
    local.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return transform(local, fig);
}

function ellipsePoints(fig: SketchFigure): Array<[number, number]> {
  const rx = fig.radiusX ?? 15;
  const ry = fig.radiusY ?? 10;
  const local: Array<[number, number]> = [];
  for (let i = 0; i < CIRCLE_SAMPLES; i++) {
    const a = (i / CIRCLE_SAMPLES) * Math.PI * 2;
    local.push([rx * Math.cos(a), ry * Math.sin(a)]);
  }
  return transform(local, fig);
}

function trianglePoints(fig: SketchFigure): Array<[number, number]> {
  // Parametrisk: width (base), height, apexX (toppens X-offset fra base-sentrum).
  // Legacy fallback: bare `radius` gitt → likesidet trekant av samme størrelse.
  let b: number, h: number, ax: number;
  if (fig.width !== undefined && fig.height !== undefined) {
    b = fig.width;
    h = fig.height;
    ax = fig.apexX ?? 0;
  } else {
    const r = fig.radius ?? 10;
    b = r * Math.sqrt(3);
    h = r * 1.5;
    ax = 0;
  }
  // Lokale vertices: base langs Y = -h/2, apex ved Y = +h/2.
  // Sentrer i bbox (også når apex stikker utenfor base) ved å forskyve X.
  const bboxMinX = Math.min(-b / 2, ax);
  const bboxMaxX = Math.max(b / 2, ax);
  const offsetX = (bboxMinX + bboxMaxX) / 2;
  const local: Array<[number, number]> = [
    [-b / 2 - offsetX, -h / 2],
    [ b / 2 - offsetX, -h / 2],
    [ ax    - offsetX,  h / 2],
  ];
  return transform(local, fig);
}

function polygonPoints(fig: SketchFigure): Array<[number, number]> {
  const r = fig.radius ?? 10;
  const n = Math.max(3, fig.sides ?? 6);
  const local: Array<[number, number]> = [];
  if (fig.starMode) {
    // Stjerne: 2n punkter, alternerende ytre og indre radius. Antall "tagger" = n.
    const ri = fig.innerRadius ?? r * 0.5;
    const total = n * 2;
    for (let i = 0; i < total; i++) {
      const a = Math.PI / 2 + (i / total) * Math.PI * 2;
      const radius = i % 2 === 0 ? r : ri;
      local.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }
  } else {
    // Regulær n-kant — start ved 90° så polygonet "peker opp"
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i / n) * Math.PI * 2;
      local.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  return transform(local, fig);
}

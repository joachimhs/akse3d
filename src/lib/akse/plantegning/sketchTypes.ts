// src/lib/akse/plantegning/sketchTypes.ts

export type SketchFigureKind =
  | 'rectangle'
  | 'roundedRect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon';

export type SketchMode = 'solid' | 'hole';

export interface SketchFigure {
  id: string;
  kind: SketchFigureKind;
  mode: SketchMode;
  position: { x: number; y: number };  // mm, origo midt på arbeidsplate
  rotation: number;                    // grader, mot klokken
  groupId?: string;                    // figurer med samme groupId vises med
                                       // edge-til-edge-avstandsguider når valgt

  // Kind-spesifikke felter (kun det som er gyldig for `kind` settes):
  width?: number;          // rectangle, roundedRect, triangle (mm)
  height?: number;         // rectangle, roundedRect, triangle (mm)
  cornerRadius?: number;   // roundedRect (mm)
  radius?: number;         // circle, polygon (mm); legacy for triangle
  radiusX?: number;        // ellipse (mm)
  radiusY?: number;        // ellipse (mm)
  sides?: number;          // polygon, default 6
  apexX?: number;          // triangle: toppens X-offset fra base-sentrum (mm)
  starMode?: boolean;      // polygon: rendres som stjerne i stedet for regulær n-kant
  innerRadius?: number;    // polygon (star): indre radius i mm (default = radius * 0.5)
}

export interface SketchData {
  figures: SketchFigure[];
  extrudeHeight: number;           // mm, default 10
}

export const WORKPLANE_SIZE_MM = 200;
export const DEFAULT_EXTRUDE_HEIGHT_MM = 10;
export const SNAP_GRID_MM = 1;

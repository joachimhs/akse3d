// @skaperiet/akse — rene datatyper som krysser porten
import type { SketchData } from '$lib/akse/plantegning/sketchTypes';
import { generateUuidIsh } from '$lib/util/uuid';

export type ShapeKind =
  | 'box' | 'cylinder' | 'sphere'
  | 'cone' | 'pyramid' | 'wedge'
  | 'torus' | 'text' | 'scribble'
  | 'sketch' | 'stl';

export type Vec3 = [number, number, number];

export interface Shape {
  id: string;
  kind: ShapeKind;
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  color: string;
  mode: 'solid' | 'hole';
  groupId: string | null;
  text?: string;
  textHeight?: number;
  points?: number[];        // DEPRECATED — bruk `paths`. Backwards-compat.
  paths?: number[][];       // kind='scribble'
  scribbleFill?: boolean;
  sketchData?: SketchData;  // kind='sketch'
  stlData?: string;         // kind='stl': base64 Float32Array, unit-bbox-normaliserte
                            // trekant-vertekser i Three.js-rom (Y-opp). Skaleres av `size`.
  stlName?: string;         // kind='stl': opprinnelig filnavn (visning)
}

export interface AkseProject {
  id: string;
  name: string;
  description?: string;
  shapes: Shape[];
  workplaneSize: Vec3;
  user: string;
  createdDate: string;   // ISO-streng
  lastUsedDate: string;  // ISO-streng
}

export interface AkseProjectSummary {
  id: string;
  name: string;
  description?: string;
  user: string;
  lastUsedDate: string;
}

export const DEFAULT_WORKPLANE: Vec3 = [200, 200, 200];
export const DEFAULT_SHAPE_SIZE: Vec3 = [20, 20, 20];
export const DEFAULT_COLORS = [
  '#4a90e2', '#e74c3c', '#27ae60', '#f39c12',
  '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
];

export function blankProject(user: string, idOverride?: string): AkseProject {
  const now = new Date().toISOString();
  return {
    id: idOverride ?? generateUuidIsh(),
    name: 'Nytt prosjekt',
    shapes: [],
    workplaneSize: DEFAULT_WORKPLANE,
    user,
    createdDate: now,
    lastUsedDate: now,
  };
}

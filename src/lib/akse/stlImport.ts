// src/lib/akse/stlImport.ts

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { Shape, Vec3 } from '$lib/models';

export interface ParsedStl {
  /** Base64-kodet Float32Array: unit-bbox-normaliserte vertekser i Three.js-rom (Y-opp). */
  data: string;
  /** Opprinnelig størrelse i mm, bruker-rom [bredde, dybde, høyde]. */
  size: Vec3;
  triangleCount: number;
}

/**
 * Parse en STL-fil (binær eller ASCII) til shape-data.
 *
 * STL-filer er Z-opp (samme som bruker-rommet i Akse); internt bruker Three.js
 * Y-opp. Verteksene mappes bruker (x, y, z) → Three (x, z, -y) — samme mapping
 * som applyTransform — og normaliseres så til unit-bbox sentrert i origo, slik
 * at shape.size styrer faktisk størrelse på samme måte som for primitivene.
 */
export function parseStl(buffer: ArrayBuffer): ParsedStl {
  const loader = new STLLoader();
  const geom = loader.parse(buffer);
  const src = (geom.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const n = src.length;

  // Bruker/STL (x, y, z) → Three (x, z, -y). Ren rotasjon (det=+1), bevarer vinding.
  const out = new Float32Array(n);
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i += 3) {
    const x = src[i], y = src[i + 2], z = -src[i + 1];
    out[i] = x; out[i + 1] = y; out[i + 2] = z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  geom.dispose();

  if (n === 0) {
    return { data: '', size: [1, 1, 1], triangleCount: 0 };
  }

  // Senter + unit-normalisering (bbox → [-0.5, 0.5] per akse)
  const dimX = Math.max(maxX - minX, 0.001);
  const dimY = Math.max(maxY - minY, 0.001);
  const dimZ = Math.max(maxZ - minZ, 0.001);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  for (let i = 0; i < n; i += 3) {
    out[i] = (out[i] - cx) / dimX;
    out[i + 1] = (out[i + 1] - cy) / dimY;
    out[i + 2] = (out[i + 2] - cz) / dimZ;
  }

  // Bruker-rom: bredde = Three X, dybde = Three Z, høyde = Three Y
  return {
    data: floatsToBase64(out),
    size: [dimX, dimZ, dimY],
    triangleCount: n / 9,
  };
}

/**
 * Bygg BufferGeometry for en stl-shape: dekod lagrede unit-vertekser og skaler
 * med shape.size. Sentrert i origo — posisjon/rotasjon påføres av applyTransform.
 */
export function buildStlGeometry(shape: Shape): THREE.BufferGeometry | null {
  if (!shape.stlData) return null;
  const unit = base64ToFloats(shape.stlData);
  if (unit.length === 0) return null;

  // size = [bredde (Three X), dybde (Three Z), høyde (Three Y)]
  const [w, d, h] = shape.size;
  const positions = new Float32Array(unit.length);
  for (let i = 0; i < unit.length; i += 3) {
    positions[i] = unit[i] * w;
    positions[i + 1] = unit[i + 1] * h;
    positions[i + 2] = unit[i + 2] * d;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Dummy UV så CSG-output får matchende attributter mot primitivene (som wedge)
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  geom.computeVertexNormals();
  return geom;
}

const B64_CHUNK = 0x8000;

function floatsToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let binary = '';
  // Chunket konvertering — String.fromCharCode med hele arrayet sprenger call-stacken
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  return btoa(binary);
}

function base64ToFloats(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

import * as THREE from 'three';
import type { Shape, ShapeKind, Vec3 } from '$lib/models';

/**
 * Genererer en BufferGeometry for en gitt shape, sentrert i origo,
 * med størrelse i mm. Posisjon/rotasjon påføres senere som matrix-transform.
 */
export function buildGeometry(shape: Shape): THREE.BufferGeometry {
  const [w, d, h] = shape.size;

  switch (shape.kind) {
    case 'box':
      return new THREE.BoxGeometry(w, h, d);

    case 'cylinder': {
      // Bygg ved unit-radius, scale non-uniformly for å støtte oval base
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      g.scale(w, h, d);
      return g;
    }

    case 'sphere': {
      // Bygg unit-kule, scale non-uniformly for å støtte ellipsoide
      const g = new THREE.SphereGeometry(0.5, 32, 16);
      g.scale(w, h, d);
      return g;
    }

    case 'cone': {
      const g = new THREE.ConeGeometry(0.5, 1, 32);
      g.scale(w, h, d);
      return g;
    }

    case 'pyramid': {
      const g = new THREE.ConeGeometry(0.5, 1, 4);
      g.scale(w, h, d);
      return g;
    }

    case 'wedge':
      return buildWedgeGeometry(w, d, h);

    case 'torus': {
      // Bygg unit-torus (ring-radius=0.375, tube-radius=0.125 → bbox 1×1×0.25)
      // og legg den flatt på arbeidsplaten (hull-aksen opp). Tube-halvtykkelsen
      // er 0.125, så Y skaleres med 4h for at total høyde skal bli nøyaktig h.
      const g = new THREE.TorusGeometry(0.375, 0.125, 12, 32);
      g.rotateX(Math.PI / 2);
      g.scale(w, 4 * h, d);
      return g;
    }

    case 'text':
      // Tekst håndteres separat — kall buildTextGeometry fra textGeometry.ts
      throw new Error('Bruk buildTextGeometry for kind=text');

    case 'scribble':
      throw new Error('Bruk buildScribbleGeometry for kind=scribble');

    case 'sketch':
      throw new Error('Bruk extrudeSketch for kind=sketch');

    case 'stl':
      throw new Error('Bruk buildStlGeometry for kind=stl');
  }
}

/**
 * Wedge = halv-kube (rettvinklet trekantsprisma).
 * Bredde w (X), dybde d (Z), høyde h (Y). Skråningen går fra (–w/2, h/2) ned til (w/2, –h/2).
 *
 * Vinkling: Alle trekanter er CCW sett utenfra (yttersiden), slik at
 * computeVertexNormals() gir utovervendte normaler og CSG-operasjoner virker.
 */
function buildWedgeGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const hw = w / 2, hd = d / 2, hh = h / 2;

  // 6 vertices: 4 på bunn, 2 på topp (langs X=-hw kanten)
  const v = new Float32Array([
    -hw, -hh, -hd,  // 0: bunn-front-venstre
     hw, -hh, -hd,  // 1: bunn-front-høyre
     hw, -hh,  hd,  // 2: bunn-bak-høyre
    -hw, -hh,  hd,  // 3: bunn-bak-venstre
    -hw,  hh, -hd,  // 4: topp-front-venstre
    -hw,  hh,  hd,  // 5: topp-bak-venstre
  ]);

  // 8 trekanter (5 flater: bunn, venstre side, front, bak, skrå-topp).
  // Alle CCW sett utenfra.
  const idx = new Uint16Array([
    // bunn (Y=-hh, normal -Y): 0,1,2 og 0,2,3
    0, 1, 2,  0, 2, 3,
    // venstre side (X=-hw, normal -X): 0,3,5 og 0,5,4
    0, 3, 5,  0, 5, 4,
    // front (Z=-hd, normal -Z, trekant): 0,4,1
    0, 4, 1,
    // bak (Z=+hd, normal +Z, trekant): 3,2,5
    3, 2, 5,
    // skrå-topp (normal mot +X/+Y): 1,5,2 og 1,4,5
    1, 5, 2,  1, 4, 5,
  ]);

  geom.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  // three-bvh-csg trenger UV for at output-meshen skal ha matching attributter når
  // wedge kombineres med boxer/cylindre (som har UV by default). Dummy zero UV holder.
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(v.length / 3 * 2), 2));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Påfør shape sin posisjon, rotasjon og (for tekst) ekstra senter-justering
 * på en allerede generert geometri. Returnerer ny geometri (med matrix bakt inn)
 * — viktig for CSG som bruker world-space brushes.
 */
export function applyTransform(
  geom: THREE.BufferGeometry,
  shape: Shape,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(shape.rotation[0]),
    THREE.MathUtils.degToRad(shape.rotation[1]),
    THREE.MathUtils.degToRad(shape.rotation[2]),
    'XYZ',
  );
  m.makeRotationFromEuler(euler);
  m.setPosition(shape.position[0], shape.position[2], -shape.position[1]);
  // User (X-right, Y-depth, Z-up) → Three.js Y-up (X-right, Y-up, Z-towards-viewer):
  // user_y maps to -three_z. Vi bruker Y-up internt i Three.js, men brukeren tenker
  // Z-up (standard for 3D-printing). Vi mapper Z (bruker) → Y (Three.js) gjennomgående.

  const out = geom.clone();
  out.applyMatrix4(m);
  return out;
}

/**
 * Default-størrelse og posisjon for nye shapes basert på kind.
 * Lander på arbeidsplaten (z=0 i bruker-koordinater = Y=size/2 i Three.js).
 */
export function defaultsForKind(kind: ShapeKind): Pick<Shape, 'size' | 'position'> {
  const size: Vec3 =
    kind === 'torus'    ? [40, 40, 10] :
    kind === 'text'     ? [40, 8, 5] :
    kind === 'scribble' ? [60, 60, 20] :
    kind === 'sketch'   ? [60, 60, 10] :   // bbox overskrives ved commit
                          [20, 20, 20];

  // position[2] = z (høyde) i bruker-koordinater. Sentrum = halve høyden.
  const position: Vec3 = [0, 0, size[2] / 2];
  return { size, position };
}

<!-- src/lib/components/ScribblePreview3D.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import {
    buildScribbleGeometryFromPaths,
    buildScribbleFilledGeometryFromPaths,
  } from '$lib/akse/scribbleGeometry';

  // Levende 3D-forhåndsvisning for tegneverktøyet — samme uttrykk som
  // PlantegningPreview3D, men drevet av props (mm-stier + fyllmodus)
  // i stedet for sketch-store.
  let { paths, fill } = $props<{ paths: number[][]; fill: boolean }>();

  let containerEl: HTMLDivElement;
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let modelGroup: THREE.Group;
  let frameId: number | null = null;
  let resizeObserver: ResizeObserver | undefined;

  const ROTATION_SPEED = 0.3; // rad/s om Y-aksen
  const DEBOUNCE_MS = 250;
  // Matcher defaultsForKind('scribble') og bbox-logikken i addScribbleShape.
  const EXTRUDE_HEIGHT_MM = 20;
  const STROKE_BUFFER = 4;

  const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });

  let mesh: THREE.Mesh | null = null;
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let status = $state<'empty' | 'ok' | 'error'>('empty');

  onMount(() => {
    const w = Math.max(containerEl.clientWidth, 1);
    const h = Math.max(containerEl.clientHeight, 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);

    camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);
    camera.position.set(120, 100, 120);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    containerEl.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 200, 100);
    scene.add(dir);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    resizeObserver = new ResizeObserver(() => {
      const cw = containerEl.clientWidth;
      const ch = containerEl.clientHeight;
      if (cw === 0 || ch === 0) return;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer!.setSize(cw, ch);
    });
    resizeObserver.observe(containerEl);

    let last = performance.now();
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = (now - last) / 1000;
      last = now;
      modelGroup.rotation.y += ROTATION_SPEED * dt;
      renderer!.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    rebuild(paths.map((p: number[]) => [...p]), fill);
  });

  onDestroy(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (rebuildTimer !== null) clearTimeout(rebuildTimer);
    resizeObserver?.disconnect();
    mesh?.geometry.dispose();
    material.dispose();
    renderer?.dispose();
  });

  // Debounced re-ekstrudering når streker eller fyllmodus endres.
  $effect(() => {
    const p = paths.map((path: number[]) => [...path]); // les dypt = reaktiv sporing
    const f = fill;
    if (rebuildTimer !== null) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => rebuild(p, f), DEBOUNCE_MS);
  });

  /** Samme størrelses-konvensjon som addScribbleShape i ProjectStore. */
  function computeSize(p: number[][]): [number, number, number] {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const path of p) {
      for (let i = 0; i < path.length; i += 2) {
        if (path[i] < minX) minX = path[i];
        if (path[i] > maxX) maxX = path[i];
        if (path[i + 1] < minY) minY = path[i + 1];
        if (path[i + 1] > maxY) maxY = path[i + 1];
      }
    }
    const w = Math.max(10, Math.ceil(maxX - minX) + STROKE_BUFFER);
    const d = Math.max(10, Math.ceil(maxY - minY) + STROKE_BUFFER);
    return [w, d, EXTRUDE_HEIGHT_MM];
  }

  function removeMesh() {
    if (mesh) {
      modelGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
  }

  function rebuild(p: number[][], f: boolean) {
    if (!modelGroup) return; // scenen er ikke satt opp ennå

    if (p.length === 0) {
      removeMesh();
      status = 'empty';
      return;
    }

    let geom: THREE.BufferGeometry | null = null;
    try {
      const size = computeSize(p);
      geom = f
        ? buildScribbleFilledGeometryFromPaths(p, size)
        : buildScribbleGeometryFromPaths(p, size);
    } catch (e) {
      console.warn('[Tegning] 3D-preview kunne ikke bygges:', e);
      status = 'error';
      return; // behold forrige gyldige mesh
    }

    if (!geom) {
      removeMesh();
      status = 'empty';
      return;
    }

    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geom;
    } else {
      mesh = new THREE.Mesh(geom, material);
      modelGroup.add(mesh);
    }
    fitCamera(geom);
    status = 'ok';
  }

  // Plasser kameraet slik at geometrien (sentrert om origo) fyller ruten.
  function fitCamera(geom: THREE.BufferGeometry) {
    geom.computeBoundingSphere();
    const radius = geom.boundingSphere?.radius ?? 100;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * 1.2; // 1.2 = litt luft rundt
    const dir = new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(dist);
    camera.position.copy(dir);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
</script>

<div class="preview3d">
  <div class="canvas-host" bind:this={containerEl}></div>
  {#if status === 'empty'}
    <div class="overlay">Tegn en strek for å se 3D-modellen</div>
  {:else if status === 'error'}
    <div class="overlay note">Kunne ikke oppdatere 3D</div>
  {/if}
</div>

<style>
  .preview3d {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    flex: 0 0 auto;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
    overflow: hidden;
    background: #2a2a2a;
  }
  .canvas-host {
    width: 100%;
    height: 100%;
  }
  .canvas-host :global(canvas) {
    display: block;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
    pointer-events: none;
  }
  .overlay.note {
    align-items: flex-end;
    color: #fca5a5;
    font-size: 12px;
  }
</style>

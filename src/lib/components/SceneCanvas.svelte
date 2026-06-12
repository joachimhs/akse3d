<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<!-- src/lib/components/akse/SceneCanvas.svelte -->
<script lang="ts">
  import { getContext, onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
  import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
  import { Line2 } from 'three/examples/jsm/lines/Line2.js';
  import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
  import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { CsgEngine, CSG_ENGINE_CONTEXT_KEY, buildShapeGeometry, type CompiledMesh } from '$lib/akse/csgEngine';
  import { buildGeometry, defaultsForKind, applyTransform } from '$lib/akse/shapes';
  import type { Shape, ShapeKind } from '$lib/models';

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);
  // Delt CsgEngine — opprettet og eid av Akse.svelte. Gjenbrukes av STL-eksporten,
  // så geometrien ikke må re-kompileres fra bunnen av ved nedlasting.
  const csgEngine = getContext<CsgEngine>(CSG_ENGINE_CONTEXT_KEY);

  // Bakgrunnsfarger for de to scene-temaene (styres av toggle i TopBar).
  const SCENE_BG = { dark: 0x2a2a2a, light: 0xf2f4f7 } as const;

  // Kameraets startvinkel (Hjem). Brukes både ved oppsett og av resetCameraView().
  // Løftet Y gir et tydeligere ovenfra-perspektiv på arbeidsplaten ved oppstart.
  const HOME_CAMERA_POS: [number, number, number] = [0, 200, 280];
  const HOME_CAMERA_TARGET: [number, number, number] = [0, 30, 0];

  let containerEl: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let frameId: number | null = null;
  let resizeObserver: ResizeObserver;
  let shapeRoot: THREE.Group;
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let transformControls: TransformControls;
  let gizmoTarget: THREE.Object3D | null = null;
  let gizmoMode = $state<'translate' | 'rotate' | 'scale'>('translate');

  // Vis mode-bar når minst én figur (eller gruppe) er valgt og vi er i mus-modus
  const showModeBar = $derived(
    store.inputMode === 'pointer' &&
    store.selectedShapes().length >= 1 &&
    !store.readOnly,
  );
  let labelRenderer: CSS2DRenderer;
  let dimensionRoot: THREE.Group;
  let isDragging = false;
  let dragShapeId: string | null = null;
  let dragOffset = new THREE.Vector3();
  let dragPlane = new THREE.Plane();

  // Group-drag state: når man drar en gruppe, husk start-posisjoner for alle medlemmer
  let groupDragStartPositions = new Map<string, [number, number, number]>();

  // Rotate-drag state (når gizmoMode === 'rotate' og bruker drar på meshen)
  let isRotating = false;
  let rotateShapeId: string | null = null;
  let rotateStartX = 0;
  let rotateStartDeg = 0;
  let rotateAxis = $state<0 | 1 | 2>(2);  // 0=X, 1=Y, 2=Z. Default Z (vertikal — vanligst for "dreie").
  // Rotasjons-snap bor i store.rotateSnapDeg (deles med Egenskaper-panelet)
  let moveSnapMm = $state<number>(1);  // 0.1 / 0.5 / 1 / 10 — steg ved piltast-flytting + gizmo-snap

  // Akse-definisjon for rotér-knappene (↻ X osv.) + aksefarge.
  const ROTATE_AXES: { axis: 0 | 1 | 2; label: string; cls: string; color: string }[] = [
    { axis: 0, label: 'X', cls: 'axis-x', color: '#d33' },
    { axis: 1, label: 'Y', cls: 'axis-y', color: '#2a7' },
    { axis: 2, label: 'Z', cls: 'axis-z', color: '#07c' },
  ];

  // Gruppe-rotasjon: husk start-posisjoner OG start-rotasjoner for alle medlemmer + senter
  let groupRotateStartShapes = new Map<string, { position: [number, number, number]; rotation: [number, number, number] }>();
  let groupRotateCenter: [number, number, number] = [0, 0, 0];

  // Ghost-preview state for click-to-place
  let previewMesh: THREE.Mesh | null = null;

  // Skygge-figurer for juster/fordel-hover (store.alignPreview)
  let alignGhostGroup: THREE.Group | null = null;

  function disposeAlignGhosts() {
    if (!alignGhostGroup) return;
    scene?.remove(alignGhostGroup);
    for (const child of alignGhostGroup.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    alignGhostGroup = null;
  }

  // Tegn skygge-figurer på posisjonene figurene ville fått, mens brukeren
  // hovrer en Juster/Fordel-knapp i panelet.
  $effect(() => {
    const preview = store.alignPreview;
    disposeAlignGhosts();
    if (!preview || !scene) return;

    const group = new THREE.Group();
    for (const [id, pos] of preview) {
      const shape = store.project.shapes.find((s) => s.id === id);
      if (!shape) continue;
      let geom: THREE.BufferGeometry | null = null;
      try {
        geom = buildShapeGeometry(shape);
      } catch {
        geom = null;
      }
      if (!geom) continue;
      const transformed = applyTransform(geom, { ...shape, position: pos });
      geom.dispose();
      const mat = new THREE.MeshStandardMaterial({
        color: shape.color || '#4a90e2',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(transformed, mat));
    }
    scene.add(group);
    alignGhostGroup = group;
  });

  // Rubber-band (drag-rectangle) selection state
  let isBoxSelecting = $state(false);
  let boxStartX = $state(0);
  let boxStartY = $state(0);
  let boxEndX = $state(0);
  let boxEndY = $state(0);
  let boxSelectShiftKey = false;
  const showBoxSelect = $derived(isBoxSelecting);

  onMount(() => {
    setupScene();
    startRenderLoop();
    setupResize();

    // Detect input type on first interaction
    containerEl.addEventListener('pointerdown', detectPointerType, { once: true });
    renderer.domElement.addEventListener('pointerdown', handleSelectClick);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    renderer.domElement.removeEventListener('pointermove', handlePointerMove);
    renderer.domElement.removeEventListener('pointerup', handlePointerUp);
    renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
    renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
    if (previewMesh) {
      previewMesh.geometry.dispose();
      (previewMesh.material as THREE.Material).dispose();
    }
    disposeAlignGhosts();
    if (rebuildTimer) clearTimeout(rebuildTimer);
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (viewAnimId !== null) cancelAnimationFrame(viewAnimId);
    if (deferredRebuildRaf !== null) cancelAnimationFrame(deferredRebuildRaf);
    resizeObserver?.disconnect();
    if (labelRenderer?.domElement?.parentNode) {
      labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
    }
    transformControls?.dispose();
    controls?.dispose();
    renderer?.dispose();
  });

  function setupScene() {
    // Bruk minimum 1 for å unngå NaN aspect hvis container ikke er målt ennå.
    // ResizeObserver vil korrigere på første fire.
    const w = Math.max(containerEl.clientWidth, 1);
    const h = Math.max(containerEl.clientHeight, 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG[store.sceneTheme]);

    camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);
    // Front-on view: kameraet litt forhøyet, ser arbeidsflaten "rett frem".
    // X går horisontalt på skjermen, Z (høyde) går oppover, Y (dybde) går inn i skjermen.
    camera.position.set(...HOME_CAMERA_POS);
    camera.lookAt(...HOME_CAMERA_TARGET);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = false;
    containerEl.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';  // children re-enable
    containerEl.appendChild(labelRenderer.domElement);

    dimensionRoot = new THREE.Group();
    scene.add(dimensionRoot);

    // Lys
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 200, 100);
    scene.add(dir);

    addWorkplane(scene, store.project.workplaneSize);

    shapeRoot = new THREE.Group();
    scene.add(shapeRoot);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(...HOME_CAMERA_TARGET);
    controls.mouseButtons = {
      LEFT: undefined as any,           // venstre brukes til å velge shapes (Task 18)
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(gizmoMode);
    transformControls.setTranslationSnap(moveSnapMm);  // 0.1/0.5/1/10mm (move-snap)
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
    transformControls.addEventListener('dragging-changed', (ev: any) => {
      controls.enabled = !ev.value;  // disable orbit while gizmo dragged
      // Grupper gizmo-drag-bevegelser til én undo-step
      if (ev.value) store.beginTransaction();
      else store.endTransaction();
    });
    transformControls.addEventListener('objectChange', onGizmoChange);
    scene.add(transformControls as any);  // TransformControls extends Object3D in newer three
  }

  function addWorkplane(scene: THREE.Scene, size: [number, number, number]) {
    const [w, d, _h] = size;

    // Bunnplate (lys grå, semi-transparent)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    );
    plate.rotation.x = -Math.PI / 2;  // ligger i XZ-planet (= XY i bruker-rom)
    scene.add(plate);

    // Hovedrutenett (10mm)
    const grid10 = new THREE.GridHelper(Math.max(w, d), Math.max(w, d) / 10, 0x888888, 0x888888);
    (grid10.material as THREE.Material).opacity = 0.4;
    (grid10.material as THREE.Material).transparent = true;
    scene.add(grid10);

    // Sub-rutenett (1mm) — svakt
    const grid1 = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0xaaaaaa, 0xaaaaaa);
    (grid1.material as THREE.Material).opacity = 0.08;
    (grid1.material as THREE.Material).transparent = true;
    scene.add(grid1);

    // Akse-piler i front-venstre hjørne av arbeidsflaten (med etiketter X/Y/Z).
    // Hjørne-posisjon: bruker(x=-w/2, y=-d/2, z=0) → three(-w/2, 0, +d/2)
    const cornerThree = new THREE.Vector3(-w / 2, 0, d / 2);
    const axisLen = 35;
    addAxisArrow(scene, cornerThree, new THREE.Vector3(1, 0, 0), 0xff0000, axisLen, 'X');   // X
    addAxisArrow(scene, cornerThree, new THREE.Vector3(0, 0, -1), 0x00aa00, axisLen, 'Y');  // Y bruker
    addAxisArrow(scene, cornerThree, new THREE.Vector3(0, 1, 0), 0x0080ff, axisLen, 'Z');   // Z bruker
  }

  function addAxisArrow(
    scene: THREE.Scene,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    color: number,
    len: number,
    label: string,
  ) {
    const normalized = dir.clone().normalize();
    const arrow = new THREE.ArrowHelper(normalized, origin, len, color, 6, 4);
    scene.add(arrow);

    // CSS2D-etikett ved spissen av pilen
    const tip = origin.clone().add(normalized.clone().multiplyScalar(len + 4));
    const div = document.createElement('div');
    div.textContent = label;
    // Liten hvit pille i stedet for mørk glød — skarp på både lys og mørk scene.
    div.style.cssText = `
      pointer-events: none;
      color: #${color.toString(16).padStart(6, '0')};
      background: rgba(255, 255, 255, 0.85);
      border-radius: 999px;
      padding: 0 6px;
      font-size: 12px;
      font-weight: 700;
      line-height: 18px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
      user-select: none;
    `;
    const obj = new CSS2DObject(div);
    obj.position.copy(tip);
    scene.add(obj);
  }

  function startRenderLoop() {
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    loop();
  }

  let viewAnimId: number | null = null;

  /** Animer kameraet jevnt tilbake til startvinkelen (Hjem-knapp). */
  function resetCameraView() {
    if (!camera || !controls) return;
    if (viewAnimId !== null) cancelAnimationFrame(viewAnimId);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(...HOME_CAMERA_POS);
    const endTarget = new THREE.Vector3(...HOME_CAMERA_TARGET);
    const duration = 450;
    const t0 = performance.now();

    // Slå av damping under animasjonen så OrbitControls ikke "drar imot".
    const prevDamping = controls.enableDamping;
    controls.enableDamping = false;

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // easeInOutQuad
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, endPos, e);
      controls.target.lerpVectors(startTarget, endTarget, e);
      controls.update();
      if (t < 1) {
        viewAnimId = requestAnimationFrame(step);
      } else {
        viewAnimId = null;
        controls.enableDamping = prevDamping;
      }
    };
    viewAnimId = requestAnimationFrame(step);
  }

  function setupResize() {
    resizeObserver = new ResizeObserver(() => {
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      // Oppdater alle Line2-materialer (LineMaterial.resolution er pixel-basert)
      dimensionRoot.traverse((obj) => {
        const mat = (obj as any).material;
        if (mat && mat.isLineMaterial) {
          mat.resolution.set(w, h);
        }
      });
    });
    resizeObserver.observe(containerEl);
  }

  function detectPointerType(e: PointerEvent) {
    if (e.pointerType === 'touch') store.setInputMode('touch');
    else store.setInputMode('pointer');
  }

  function handleDoubleClick(e: MouseEvent) {
    if (e.target !== renderer.domElement) return;
    if (store.readOnly) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(shapeRoot.children, false);
    if (hits.length === 0) return;
    const hit = hits[0].object;
    const shapeIds: string[] = hit.userData.shapeIds ?? [];
    for (const id of shapeIds) {
      const shape = store.project.shapes.find(s => s.id === id);
      if (shape?.kind === 'sketch') {
        store.requestEditSketch(id);
        return;
      }
    }
  }

  function handleSelectClick(e: PointerEvent) {
    // Kun venstre-knapp eller touch
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target !== renderer.domElement) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    // PLACE-MODE: hvis det er en pending shape-type, plasser den ved klikk-punktet
    if (store.pendingShapeKind && !store.readOnly) {
      // Raycast mot arbeidsflaten (Y=0 i three.js)
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        // Konverter three (x, 0, z) → user (x, -z, 0)
        const userX = Math.round(hitPoint.x);
        const userY = Math.round(-hitPoint.z);
        store.addShape(store.pendingShapeKind, [userX, userY, 0]);
      }
      return;  // ikke kjør vanlig select/drag-logikk
    }

    const hits = raycaster.intersectObjects(shapeRoot.children, false);
    if (hits.length === 0) {
      // Start rubber-band-selection (i stedet for å deselect umiddelbart;
      // deselect skjer ved pointerup om brukeren ikke har dratt)
      isBoxSelecting = true;
      boxSelectShiftKey = e.shiftKey;
      const rect = renderer.domElement.getBoundingClientRect();
      boxStartX = e.clientX - rect.left;
      boxStartY = e.clientY - rect.top;
      boxEndX = boxStartX;
      boxEndY = boxStartY;
      controls.enabled = false;
      return;
    }
    const hit = hits[0].object;
    const shapeIds: string[] = hit.userData.shapeIds ?? [];
    if (shapeIds.length === 0) return;

    if (e.shiftKey) {
      // Multi-select: toggle alle ids i gruppen
      for (const id of shapeIds) store.toggleSelect(id);
      return;
    }

    // Hvis ikke allerede valgt → bare velg
    const isAlreadySelected = shapeIds.every((id) => store.selectedIds.has(id));
    if (!isAlreadySelected) {
      store.selectedIds = new Set(shapeIds);
      return;
    }

    // Allerede valgt → start drag (single ELLER hele gruppen)
    if (store.readOnly) return;

    // For gruppe-drag: bruker alle valgte ids (ikke bare hit-meshens shapeIds)
    const dragIds = store.selectedIds.size > 0 ? [...store.selectedIds] : shapeIds;
    const dragShapes = store.project.shapes.filter((s) => dragIds.includes(s.id));
    if (dragShapes.length === 0) return;

    // Bruk den FØRSTE shape som "anker" for drag-plane og offset.
    // Alle andre flyttes relativt til denne.
    const shape = dragShapes[0];

    // I Roter-mode: start rotate-drag rundt valgt akse.
    if (gizmoMode === 'rotate') {
      // For gruppe-rotasjon: bruk alle valgte ids (ikke bare hit-meshens shapeIds)
      const rotIds = store.selectedIds.size > 0 ? [...store.selectedIds] : shapeIds;
      const rotShapes = store.project.shapes.filter((s) => rotIds.includes(s.id));
      if (rotShapes.length === 0) return;

      // Lagre start-state for alle medlemmer
      groupRotateStartShapes.clear();
      for (const rs of rotShapes) {
        groupRotateStartShapes.set(rs.id, {
          position: [...rs.position] as [number, number, number],
          rotation: [...rs.rotation] as [number, number, number],
        });
      }

      // Beregn gruppe-senter (eller bare shape-senter hvis kun én)
      if (rotShapes.length === 1) {
        groupRotateCenter = [...rotShapes[0].position] as [number, number, number];
      } else {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const s of rotShapes) {
          minX = Math.min(minX, s.position[0] - s.size[0] / 2);
          maxX = Math.max(maxX, s.position[0] + s.size[0] / 2);
          minY = Math.min(minY, s.position[1] - s.size[1] / 2);
          maxY = Math.max(maxY, s.position[1] + s.size[1] / 2);
          minZ = Math.min(minZ, s.position[2] - s.size[2] / 2);
          maxZ = Math.max(maxZ, s.position[2] + s.size[2] / 2);
        }
        groupRotateCenter = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
      }

      isRotating = true;
      rotateShapeId = shape.id;  // bare brukt som "noe er valgt"-flagg
      rotateStartX = e.clientX;
      rotateStartDeg = 0;  // gruppe-modus: vi sporer delta, ikke absolutt
      controls.enabled = false;
      store.beginTransaction();
      return;
    }

    // Translate-mode: konstruer drag-plane (horisontalt) gjennom shape sin høyde.
    const dragHeight = shape.position[2];
    dragPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, dragHeight, 0),
    );

    // Beregn offset fra shape-midtpunkt til hit-punkt, slik at draget "henger" der bruker klikket.
    // Y-komponenten må være 0 — drag er låst til horisontalt plan, så vertikal offset
    // (om brukeren klikket høyt eller lavt på figuren) skal IKKE påvirke høyden.
    const hitPoint = hits[0].point;
    const shapeCenterThree = new THREE.Vector3(shape.position[0], shape.position[2], -shape.position[1]);
    dragOffset.copy(hitPoint).sub(shapeCenterThree);
    dragOffset.y = 0;

    // Lagre start-posisjoner for alle drag-medlemmer (for relativ flytting)
    groupDragStartPositions.clear();
    for (const ds of dragShapes) {
      groupDragStartPositions.set(ds.id, [...ds.position] as [number, number, number]);
    }

    isDragging = true;
    dragShapeId = shape.id;
    controls.enabled = false;
    store.beginTransaction();
  }

  function handlePointerMove(e: PointerEvent) {
    // Ghost-preview: følg muse-pekeren langs arbeidsflaten når en figur er pending
    if (previewMesh && store.pendingShapeKind) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const { size } = defaultsForKind(store.pendingShapeKind);
        // Plassere preview slik at bunnen ligger på arbeidsflaten (Y = size[2]/2 i Three.js)
        previewMesh.position.set(Math.round(hitPoint.x), size[2] / 2, Math.round(hitPoint.z));
        previewMesh.visible = true;
      }
    }

    if (isBoxSelecting) {
      const rect = renderer.domElement.getBoundingClientRect();
      boxEndX = e.clientX - rect.left;
      boxEndY = e.clientY - rect.top;
      return;
    }

    // Rotate-drag: horisontal mus-bevegelse roterer alle valgte rundt gruppe-senter
    if (isRotating) {
      const dx = e.clientX - rotateStartX;
      const pxPerDeg = store.rotateSnapDeg <= 1 ? 2 : 0.5;
      const rawDeg = dx / pxPerDeg;
      const snappedDelta = Math.round(rawDeg / store.rotateSnapDeg) * store.rotateSnapDeg;

      // Anvend rotasjon på alle gruppe-medlemmer
      const radDelta = (snappedDelta * Math.PI) / 180;
      const cos = Math.cos(radDelta);
      const sin = Math.sin(radDelta);

      for (const [id, start] of groupRotateStartShapes.entries()) {
        // 1) Roter posisjon rundt gruppe-senter
        const rx = start.position[0] - groupRotateCenter[0];
        const ry = start.position[1] - groupRotateCenter[1];
        const rz = start.position[2] - groupRotateCenter[2];
        let nx = rx, ny = ry, nz = rz;
        if (rotateAxis === 0) {
          // Rundt X: roter (Y, Z)
          ny = ry * cos - rz * sin;
          nz = ry * sin + rz * cos;
        } else if (rotateAxis === 1) {
          // Rundt Y: roter (X, Z)
          nx = rx * cos + rz * sin;
          nz = -rx * sin + rz * cos;
        } else {
          // Rundt Z: roter (X, Y)
          nx = rx * cos - ry * sin;
          ny = rx * sin + ry * cos;
        }
        const newPos: [number, number, number] = [
          Math.round(groupRotateCenter[0] + nx),
          Math.round(groupRotateCenter[1] + ny),
          Math.round(groupRotateCenter[2] + nz),
        ];

        // 2) Legg delta til figurens egen rotasjon på samme akse.
        // (Forenklet: ignorerer at Euler-rotasjons-orden kan gjøre dette unøyaktig
        //  for kombinerte ikke-uniforme rotasjoner. OK for kjernebruk.)
        const newRot = [...start.rotation] as [number, number, number];
        let r = start.rotation[rotateAxis] + snappedDelta;
        r = r % 360;
        if (r > 180) r -= 360;
        if (r < -180) r += 360;
        newRot[rotateAxis] = r;

        const current = store.project.shapes.find((s) => s.id === id);
        if (current && (
          current.position[0] !== newPos[0] ||
          current.position[1] !== newPos[1] ||
          current.position[2] !== newPos[2] ||
          current.rotation[rotateAxis] !== r
        )) {
          store.updateShape(id, { position: newPos, rotation: newRot });
        }
      }
      return;
    }

    // Translate-drag (mesh-drag i Flytt-mode)
    if (!isDragging || !dragShapeId) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

    // Trekk fra offset for å få nytt midt-punkt i Three.js-rom
    const newCenterThree = hitPoint.clone().sub(dragOffset);

    // Map tilbake til user-rom: three (x, y, z) → user (x, -z, y)
    const newUserX = Math.round(newCenterThree.x);
    const newUserY = Math.round(-newCenterThree.z);
    const newUserZ = Math.round(newCenterThree.y);  // beholdes lik (drag-plane låser høyden)

    // Beregn delta fra anker-shapens start-posisjon
    const ankerStart = groupDragStartPositions.get(dragShapeId);
    if (!ankerStart) return;
    const dxUser = newUserX - ankerStart[0];
    const dyUser = newUserY - ankerStart[1];
    // Z er låst (drag-plane), så ingen delta i Z

    // Anvend delta på alle drag-medlemmene
    for (const [id, startPos] of groupDragStartPositions.entries()) {
      const newPos: [number, number, number] = [
        startPos[0] + dxUser,
        startPos[1] + dyUser,
        startPos[2],
      ];
      store.updateShape(id, { position: newPos });
    }
  }

  function handlePointerUp(_e: PointerEvent) {
    if (isBoxSelecting) {
      isBoxSelecting = false;
      controls.enabled = true;

      // Hvis musen ikke har beveget seg merkbart (= klikk, ikke drag): tom-klikk → deselect.
      const dx = boxEndX - boxStartX;
      const dy = boxEndY - boxStartY;
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      if (dragDist < 4) {
        if (!boxSelectShiftKey) store.deselectAll();
        return;
      }

      // Beregn hvilke figurer som har sentrum innenfor box.
      const xMin = Math.min(boxStartX, boxEndX);
      const xMax = Math.max(boxStartX, boxEndX);
      const yMin = Math.min(boxStartY, boxEndY);
      const yMax = Math.max(boxStartY, boxEndY);

      const rect = renderer.domElement.getBoundingClientRect();
      const matched = new Set<string>();
      for (const shape of store.project.shapes) {
        // Project shape-senter (i Three.js-rom) til skjerm-koordinater
        const centerThree = new THREE.Vector3(shape.position[0], shape.position[2], -shape.position[1]);
        const projected = centerThree.clone().project(camera);
        const sx = (projected.x * 0.5 + 0.5) * rect.width;
        const sy = (1 - (projected.y * 0.5 + 0.5)) * rect.height;
        if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
          matched.add(shape.id);
        }
      }

      if (matched.size === 0 && !boxSelectShiftKey) {
        store.deselectAll();
        return;
      }

      // For grupper: utvid utvalg til å inkludere alle medlemmer av berørte grupper
      const expanded = new Set(matched);
      for (const s of store.project.shapes) {
        if (s.groupId && [...matched].some((id) => store.project.shapes.find(x => x.id === id)?.groupId === s.groupId)) {
          expanded.add(s.id);
        }
      }

      if (boxSelectShiftKey) {
        // Toggle-modus: legg til de nye uten å fjerne eksisterende
        const next = new Set(store.selectedIds);
        for (const id of expanded) next.add(id);
        store.selectedIds = next;
      } else {
        store.selectedIds = expanded;
      }
      return;
    }

    if (isRotating) {
      isRotating = false;
      rotateShapeId = null;
      groupRotateStartShapes.clear();
      controls.enabled = true;
      store.endTransaction();
    }
    if (isDragging) {
      isDragging = false;
      dragShapeId = null;
      groupDragStartPositions.clear();
      controls.enabled = true;
      store.endTransaction();
    }
  }

  // Oppdater scene-bakgrunn når brukeren bytter tema i TopBar.
  $effect(() => {
    const theme = store.sceneTheme;
    if (!scene) return;
    scene.background = new THREE.Color(SCENE_BG[theme]);
  });

  $effect(() => {
    // Track shapes (Svelte 5 reactivity)
    const shapes = store.project.shapes;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => rebuildMeshes(shapes), 50);
  });

  $effect(() => {
    const _ = store.selectedIds;
    if (!shapeRoot) return;
    rebuildMeshes(store.project.shapes);
    updateGizmo();
  });

  $effect(() => {
    // Track selection AND project shapes (so labels move when shape moves)
    const _ids = store.selectedIds;
    const _shapes = store.project.shapes;
    if (!dimensionRoot || !labelRenderer) return;
    updateDimensionLabels();
  });

  // Ghost-preview: lag/oppdater preview-mesh når pendingShapeKind endres
  $effect(() => {
    const kind = store.pendingShapeKind;
    if (!scene) return;
    // Fjern eksisterende preview
    if (previewMesh) {
      scene.remove(previewMesh);
      previewMesh.geometry.dispose();
      (previewMesh.material as THREE.Material).dispose();
      previewMesh = null;
    }
    if (!kind) return;
    // Bygg preview-geometri (skip scribble — den åpner modal i stedet)
    if (kind === 'scribble') return;
    const previewGeom = makePreviewGeometry(kind);
    if (!previewGeom) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    previewMesh = new THREE.Mesh(previewGeom, mat);
    previewMesh.visible = false;  // gjøres synlig på første pointermove
    scene.add(previewMesh);
  });

  function makePreviewGeometry(kind: ShapeKind): THREE.BufferGeometry | null {
    const { size } = defaultsForKind(kind);
    if (kind === 'text' || kind === 'scribble') {
      // Tekst trenger font-loading; bruk en enkel boks som placeholder.
      // Scribble håndteres ikke (modal-flow).
      return new THREE.BoxGeometry(size[0], size[2], size[1]);
    }
    const dummyShape: Shape = {
      id: 'preview',
      kind,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size,
      color: '#4a90e2',
      mode: 'solid',
      groupId: null,
    };
    try {
      return buildGeometry(dummyShape);
    } catch {
      return null;
    }
  }

  function updateDimensionLabels() {
    // Ikke bygg om mens brukeren redigerer et dimensjon-felt: en reaktiv re-render
    // (f.eks. når selectedIds re-tilordnes) ville ellers ødelagt input-et og fokus
    // midt i redigeringen — slik at f.eks. spinner-pilene "resettes" tilbake.
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.closest('.akse-dim-label')) {
      return;
    }

    while (dimensionRoot.children.length > 0) {
      const c = dimensionRoot.children[0];
      dimensionRoot.remove(c);
    }

    if (store.inputMode !== 'pointer') return;
    const selected = store.selectedShapes();
    if (selected.length === 0) return;

    if (selected.length === 1) {
      renderSingleShapeDimensions(selected[0]);
    } else {
      renderGroupDimensions(selected);
    }
  }

  function renderSingleShapeDimensions(s: typeof store.project.shapes[0]) {
    const isSketch = s.kind === 'sketch';
    const px = s.position[0], py = s.position[1], pz = s.position[2];
    const w = s.size[0], d = s.size[1], h = s.size[2];

    const offset = 10;

    // For sketch-shapes endres B og D inne i Plantegning-editoren, ikke her —
    // skjul dem så de ikke ser ut til å være redigerbare.
    if (!isSketch) {
      addLabel(s.id, 'size', 0, 'B', s.size[0],
        new THREE.Vector3(px, pz - h / 2, -py + d / 2 + offset));
      addLabel(s.id, 'size', 1, 'D', s.size[1],
        new THREE.Vector3(px - w / 2 - offset, pz - h / 2, -py));
    }
    addLabel(s.id, 'size', 2, 'H', s.size[2],
      new THREE.Vector3(px + w / 2 + offset, pz, -py - d / 2));

    const cornerZ = Math.round(pz - h / 2);
    addZLiftLabel(s.id, cornerZ, s.size[2], new THREE.Vector3(px, pz + h / 2 + offset, -py));

    if (isSketch) {
      // Floating "Rediger plantegning"-knapp like over Z-løft-labelen
      addEditSketchButton(s.id, new THREE.Vector3(px, pz + h / 2 + offset + 14, -py));
    }

    // Guide-linjer som viser hvilken kant hver etikett måler
    // B (bredde, langs X): linje fra venstre-front-bunn til høyre-front-bunn, ved label-offset
    addGuideLine(
      new THREE.Vector3(px - w / 2, pz - h / 2, -py + d / 2 + offset),
      new THREE.Vector3(px + w / 2, pz - h / 2, -py + d / 2 + offset),
    );
    // D (dybde, langs Three.js Z): linje fra venstre-bunn-front til venstre-bunn-bak
    addGuideLine(
      new THREE.Vector3(px - w / 2 - offset, pz - h / 2, -py + d / 2),
      new THREE.Vector3(px - w / 2 - offset, pz - h / 2, -py - d / 2),
    );
    // H (høyde, langs Three.js Y): linje fra høyre-bak-bunn til høyre-bak-topp
    addGuideLine(
      new THREE.Vector3(px + w / 2 + offset, pz - h / 2, -py - d / 2),
      new THREE.Vector3(px + w / 2 + offset, pz + h / 2, -py - d / 2),
    );
    // Z-løft: vertikal linje fra arbeidsflaten (Y=0) til figurens bunn (Y=pz-h/2),
    // ved figurens midt-front (litt bortenfor offset).
    if (pz - h / 2 > 0) {
      addGuideLine(
        new THREE.Vector3(px, 0, -py),
        new THREE.Vector3(px, pz - h / 2, -py),
      );
    }
  }

  function renderGroupDimensions(shapes: typeof store.project.shapes) {
    // Beregn samlet bounding-box i bruker-rom
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const s of shapes) {
      minX = Math.min(minX, s.position[0] - s.size[0] / 2);
      maxX = Math.max(maxX, s.position[0] + s.size[0] / 2);
      minY = Math.min(minY, s.position[1] - s.size[1] / 2);
      maxY = Math.max(maxY, s.position[1] + s.size[1] / 2);
      minZ = Math.min(minZ, s.position[2] - s.size[2] / 2);
      maxZ = Math.max(maxZ, s.position[2] + s.size[2] / 2);
    }
    const w = maxX - minX;
    const d = maxY - minY;
    const h = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const offset = 10;
    const ids = shapes.map((s) => s.id);

    addGroupSizeLabel(ids, 0, 'B', w, new THREE.Vector3(cx, cz - h / 2, -cy + d / 2 + offset));
    addGroupSizeLabel(ids, 1, 'D', d, new THREE.Vector3(cx - w / 2 - offset, cz - h / 2, -cy));
    addGroupSizeLabel(ids, 2, 'H', h, new THREE.Vector3(cx + w / 2 + offset, cz, -cy - d / 2));

    const cornerZ = Math.round(minZ);
    addGroupZLiftLabel(ids, cornerZ, new THREE.Vector3(cx, cz + h / 2 + offset, -cy));

    // Lag knapper for grupper/avgrupper øverst-foran på gruppen
    addGroupActionButtons(shapes, new THREE.Vector3(cx, cz + h / 2 + offset + 18, -cy));

    // Guide-linjer for gruppe (samme mønster som single shape)
    addGuideLine(
      new THREE.Vector3(cx - w / 2, cz - h / 2, -cy + d / 2 + offset),
      new THREE.Vector3(cx + w / 2, cz - h / 2, -cy + d / 2 + offset),
    );
    addGuideLine(
      new THREE.Vector3(cx - w / 2 - offset, cz - h / 2, -cy + d / 2),
      new THREE.Vector3(cx - w / 2 - offset, cz - h / 2, -cy - d / 2),
    );
    addGuideLine(
      new THREE.Vector3(cx + w / 2 + offset, cz - h / 2, -cy - d / 2),
      new THREE.Vector3(cx + w / 2 + offset, cz + h / 2, -cy - d / 2),
    );
    if (cz - h / 2 > 0) {
      addGuideLine(
        new THREE.Vector3(cx, 0, -cy),
        new THREE.Vector3(cx, cz - h / 2, -cy),
      );
    }
  }

  // Felles utseende for de klikkbare dimensjons-etikettene i scenen (CSS2D).
  // Elementene ligger i DOM-en under .akse-root, så CSS-variablene arves.
  const DIM_LABEL_CSS = `
    pointer-events: auto;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.92);
    color: var(--primary-color, #2563eb);
    border: 1px solid var(--akse-ring, rgba(37, 99, 235, 0.4));
    border-radius: 999px;
    padding: 2px 9px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
    user-select: none;
    white-space: nowrap;
  `;
  const DIM_INPUT_CSS = `
    width: 56px;
    padding: 2px 6px;
    border: 1px solid var(--primary-color, #2563eb);
    border-radius: 999px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
  `;

  /**
   * Klikkbar B/D/H-etikett for en gruppe. Endring skalerer alle figurer proporsjonalt
   * rundt gruppens senter på den valgte aksen.
   */
  function addGroupSizeLabel(
    ids: string[],
    axis: 0 | 1 | 2,
    abbr: string,
    currentValue: number,
    threePos: THREE.Vector3,
  ) {
    const div = document.createElement('div');
    div.className = 'akse-dim-label';
    div.style.cssText = DIM_LABEL_CSS;
    div.textContent = `${abbr}: ${Math.round(currentValue)} mm`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      // Allerede i redigeringsmodus? Da bobler klikket fra input-et (f.eks. spinner-
      // pilene) opp hit — ikke gjenskap feltet, ellers nullstilles verdien.
      if (div.querySelector('input')) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.value = String(Math.round(currentValue));
      input.style.cssText = DIM_INPUT_CSS;
      div.replaceChildren(input);
      input.focus();
      input.select();

      const commit = () => {
        const newVal = Math.max(1, Number(input.value) || 1);
        if (newVal === Math.round(currentValue)) return;

        // Skalér gruppen rundt senter på valgt akse
        const factor = newVal / currentValue;
        const groupShapes = store.project.shapes.filter((s) => ids.includes(s.id));
        // Beregn senter (samme som i renderGroupDimensions)
        let lo = Infinity, hi = -Infinity;
        for (const s of groupShapes) {
          lo = Math.min(lo, s.position[axis] - s.size[axis] / 2);
          hi = Math.max(hi, s.position[axis] + s.size[axis] / 2);
        }
        const center = (lo + hi) / 2;

        for (const s of groupShapes) {
          const newPos = [...s.position] as [number, number, number];
          const newSize = [...s.size] as [number, number, number];
          newPos[axis] = center + (s.position[axis] - center) * factor;
          newSize[axis] = Math.max(1, s.size[axis] * factor);
          store.updateShape(s.id, { position: newPos, size: newSize });
        }
      };
      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        else if (ke.key === 'Escape') {
          input.value = String(Math.round(currentValue));
          input.blur();
        }
        ke.stopPropagation();
      });
    });

    const obj = new CSS2DObject(div);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  function addGroupZLiftLabel(ids: string[], cornerZ: number, threePos: THREE.Vector3) {
    const div = document.createElement('div');
    div.className = 'akse-dim-label';
    div.style.cssText = DIM_LABEL_CSS;
    div.textContent = `Z: ${Math.round(cornerZ)} mm`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      // Allerede i redigeringsmodus? Da bobler klikket fra input-et (f.eks. spinner-
      // pilene) opp hit — ikke gjenskap feltet, ellers nullstilles verdien.
      if (div.querySelector('input')) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(Math.round(cornerZ));
      input.style.cssText = DIM_INPUT_CSS;
      div.replaceChildren(input);
      input.focus();
      input.select();

      const commit = () => {
        const newCornerZ = Math.max(0, Number(input.value) || 0);
        const delta = newCornerZ - cornerZ;
        if (delta === 0) return;
        // Flytt hele gruppen vertikalt
        const groupShapes = store.project.shapes.filter((s) => ids.includes(s.id));
        for (const s of groupShapes) {
          const newPos = [s.position[0], s.position[1], s.position[2] + delta] as [number, number, number];
          store.updateShape(s.id, { position: newPos });
        }
      };
      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        else if (ke.key === 'Escape') {
          input.value = String(Math.round(cornerZ));
          input.blur();
        }
        ke.stopPropagation();
      });
    });

    const obj = new CSS2DObject(div);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  function addGroupActionButtons(shapes: typeof store.project.shapes, threePos: THREE.Vector3) {
    if (shapes.length < 2) return;  // ingen knapper for én

    // Detekter om ALLE valgte deler samme groupId (= "kan avgruppere")
    const firstGroupId = shapes[0].groupId;
    const allSameGroup = firstGroupId !== null && shapes.every((s) => s.groupId === firstGroupId);

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      pointer-events: auto;
      display: flex;
      gap: 4px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 999px;
      padding: 4px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
      user-select: none;
    `;

    const ACTION_BTN_CSS = (bg: string) => `
      padding: 4px 12px;
      background: ${bg}; color: white;
      border: none; border-radius: 999px;
      font-size: 12px; font-weight: 600; font-family: inherit;
      cursor: pointer;
    `;

    if (!allSameGroup) {
      const btn = document.createElement('button');
      btn.textContent = 'Grupper';
      btn.style.cssText = ACTION_BTN_CSS('var(--primary-color, #2563eb)');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.groupSelected();
      });
      wrap.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Avgrupper';
      btn.style.cssText = ACTION_BTN_CSS('#f59e0b');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.ungroupSelected();
      });
      wrap.appendChild(btn);
    }

    // Slett-knapp for begge tilstander
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Slett';
    delBtn.style.cssText = ACTION_BTN_CSS('#ef4444');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteShapes([...store.selectedIds]);
    });
    wrap.appendChild(delBtn);

    const obj = new CSS2DObject(wrap);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  function makeGuideMaterial(): LineMaterial {
    // Line2/LineMaterial gir ekte tykke linjer via shader (linewidth funker IKKE
    // med vanlig LineBasicMaterial pga WebGL-begrensning til 1px).
    const mat = new LineMaterial({
      color: 0x00aaff,
      linewidth: 4,  // i pixels
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      worldUnits: false,
    });
    mat.resolution.set(
      renderer.domElement.clientWidth,
      renderer.domElement.clientHeight,
    );
    return mat;
  }

  function makeGuideLine(start: THREE.Vector3, end: THREE.Vector3, mat: LineMaterial): Line2 {
    const geom = new LineGeometry();
    geom.setPositions([start.x, start.y, start.z, end.x, end.y, end.z]);
    const line = new Line2(geom, mat);
    line.computeLineDistances();
    line.renderOrder = 999;
    return line;
  }

  function addGuideLine(start: THREE.Vector3, end: THREE.Vector3) {
    const mat = makeGuideMaterial();
    dimensionRoot.add(makeGuideLine(start, end, mat));

    // Tick-merker (små perpendikulære streker) ved hver ende
    const dir = end.clone().sub(start).normalize();
    const candidates = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const tickDir = candidates
      .map((c) => ({ axis: c, score: Math.abs(c.dot(dir)) }))
      .sort((a, b) => a.score - b.score)[0].axis.clone().multiplyScalar(3);

    for (const pt of [start, end]) {
      dimensionRoot.add(makeGuideLine(pt.clone().sub(tickDir), pt.clone().add(tickDir), mat));
    }
  }

  function addLabel(
    shapeId: string,
    field: 'size',
    axis: 0 | 1 | 2,
    abbr: string,
    value: number,
    threePos: THREE.Vector3,
  ) {
    const div = document.createElement('div');
    div.className = 'akse-dim-label';
    div.style.cssText = DIM_LABEL_CSS;
    div.textContent = `${abbr}: ${Math.round(value)} mm`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      // Allerede i redigeringsmodus? Da bobler klikket fra input-et (f.eks. spinner-
      // pilene) opp hit — ikke gjenskap feltet, ellers nullstilles verdien.
      if (div.querySelector('input')) return;
      // Switch to input
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.value = String(Math.round(value));
      input.style.cssText = DIM_INPUT_CSS;
      div.replaceChildren(input);
      input.focus();
      input.select();

      const commit = () => {
        const newVal = Math.max(1, Number(input.value) || 1);
        const shape = store.project.shapes.find((sh) => sh.id === shapeId);
        if (shape) {
          const oldSize = shape[field][axis];
          const newSize = [...shape[field]] as [number, number, number];
          newSize[axis] = newVal;
          // Bevar corner-posisjon (samme logikk som TransformPanel) så Z ikke
          // endres når H endres, X ikke endres når B endres, osv.
          const delta = (newVal - oldSize) / 2;
          const newPos = [...shape.position] as [number, number, number];
          newPos[axis] = shape.position[axis] + delta;
          store.updateShape(shapeId, { [field]: newSize, position: newPos });
        }
        // The $effect will rebuild labels with new value
      };
      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          input.blur();
        } else if (ke.key === 'Escape') {
          // Restore label without committing
          input.value = String(Math.round(value));
          input.blur();
        }
        ke.stopPropagation();  // Don't trigger Akse.svelte's keyboard shortcuts
      });
    });

    const obj = new CSS2DObject(div);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  /**
   * Z-løft-etikett: viser hvor høyt over arbeidsflaten figurens bunn er.
   * Klikkbar — bruker kan endre løfte-høyden direkte. Z=0 = på arbeidsflaten.
   * Konverterer mellom corner-Z (det brukeren ser) og center-Z (intern: corner + size_z/2).
   */
  function addZLiftLabel(
    shapeId: string,
    cornerZ: number,
    sizeZ: number,
    threePos: THREE.Vector3,
  ) {
    const div = document.createElement('div');
    div.className = 'akse-dim-label';
    div.style.cssText = DIM_LABEL_CSS;
    div.textContent = `Z: ${Math.round(cornerZ)} mm`;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      // Allerede i redigeringsmodus? Da bobler klikket fra input-et (f.eks. spinner-
      // pilene) opp hit — ikke gjenskap feltet, ellers nullstilles verdien.
      if (div.querySelector('input')) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(Math.round(cornerZ));
      input.style.cssText = DIM_INPUT_CSS;
      div.replaceChildren(input);
      input.focus();
      input.select();

      const commit = () => {
        const newCornerZ = Math.max(0, Number(input.value) || 0);
        const shape = store.project.shapes.find((s) => s.id === shapeId);
        if (shape) {
          const newCenterZ = newCornerZ + sizeZ / 2;
          const newPos: [number, number, number] = [
            shape.position[0],
            shape.position[1],
            newCenterZ,
          ];
          store.updateShape(shapeId, { position: newPos });
        }
      };
      input.addEventListener('blur', commit, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        else if (ke.key === 'Escape') {
          input.value = String(Math.round(cornerZ));
          input.blur();
        }
        ke.stopPropagation();
      });
    });

    const obj = new CSS2DObject(div);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  /** Flytende "Rediger plantegning"-knapp over sketch-figurer. */
  function addEditSketchButton(shapeId: string, threePos: THREE.Vector3) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'akse-edit-sketch-btn';
    btn.style.cssText = `
      pointer-events: auto;
      cursor: pointer;
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fcd34d;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      user-select: none;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
    `;
    btn.innerHTML = '<i class="fa-solid fa-compass-drafting" aria-hidden="true"></i> Rediger plantegning';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.requestEditSketch(shapeId);
    });
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());

    const obj = new CSS2DObject(btn);
    obj.position.copy(threePos);
    dimensionRoot.add(obj);
  }

  function updateGizmo() {
    // Kun i pointer-modus
    if (store.inputMode !== 'pointer') {
      transformControls?.detach();
      return;
    }
    const selected = store.selectedShapes();
    if (selected.length !== 1) {
      transformControls?.detach();
      return;
    }
    const s = selected[0];
    if (!gizmoTarget) {
      gizmoTarget = new THREE.Object3D();
      scene.add(gizmoTarget);
    }
    // User Z-up → Three.js Y-up swap
    gizmoTarget.position.set(s.position[0], s.position[2], -s.position[1]);
    gizmoTarget.rotation.set(
      THREE.MathUtils.degToRad(s.rotation[0]),
      THREE.MathUtils.degToRad(s.rotation[2]),
      THREE.MathUtils.degToRad(s.rotation[1]),
    );
    transformControls.attach(gizmoTarget);
  }

  function onGizmoChange() {
    if (!gizmoTarget || store.selectedShapes().length !== 1) return;
    const s = store.selectedShapes()[0];
    const p = gizmoTarget.position;
    const r = gizmoTarget.rotation;
    store.updateShape(s.id, {
      position: [Math.round(p.x), Math.round(-p.z), Math.round(p.y)],
      rotation: [
        Math.round(THREE.MathUtils.radToDeg(r.x)),
        Math.round(THREE.MathUtils.radToDeg(r.z)),
        Math.round(THREE.MathUtils.radToDeg(r.y)),
      ],
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 't' || e.key === 'T') {
      setGizmoMode('translate');
    } else if (e.key === 'r' || e.key === 'R') {
      // R = roter rundt sist valgte akse (default Z)
      setRotateAxis(rotateAxis);
    } else if (
      gizmoMode === 'translate' &&
      store.selectedIds.size > 0 &&
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      // Piltaster flytter valgte figurer ett move-snap-steg.
      // Shift+opp/ned = langs Z (opp/ned); ellers i arbeidsplanet (X/Y).
      e.preventDefault();
      const s = moveSnapMm;
      if (e.shiftKey && e.key === 'ArrowUp') nudgePosition(0, 0, s);
      else if (e.shiftKey && e.key === 'ArrowDown') nudgePosition(0, 0, -s);
      else if (e.key === 'ArrowLeft') nudgePosition(-s, 0);
      else if (e.key === 'ArrowRight') nudgePosition(s, 0);
      else if (e.key === 'ArrowUp') nudgePosition(0, s);
      else nudgePosition(0, -s);
    }
    // Scale via panel — ikke gizmo (Task 20)
  }

  function setGizmoMode(mode: 'translate' | 'rotate') {
    gizmoMode = mode;
    transformControls?.setMode(mode);
  }

  function setRotateSnap(deg: number) {
    store.rotateSnapDeg = deg;
    transformControls?.setRotationSnap(THREE.MathUtils.degToRad(deg));
  }

  function setRotateAxis(axis: 0 | 1 | 2) {
    rotateAxis = axis;
    setGizmoMode('rotate');
    // Vise kun valgt akse-ring på gizmo for tydelighet
    if (transformControls) {
      transformControls.showX = axis === 0;
      transformControls.showY = axis === 2;  // user Z = three Y
      transformControls.showZ = axis === 1;  // user Y = three Z (med swap)
    }
  }

  // Vinkel-slider: absolutt rotasjon (0–360°) rundt den aktive aksen for valgt(e)
  // figur(er). Verdien speiler første valgte figur og holdes i sync med gizmo-drag.
  // Aktiv rotasjons-akse (for visuell indikasjon: farge på slider/piler + akse-merke).
  let activeAxis = $derived(ROTATE_AXES[rotateAxis]);

  let sliderAngle = $derived.by(() => {
    const sel = store.selectedShapes();
    if (sel.length === 0) return 0;
    const raw = sel[0].rotation[rotateAxis] ?? 0;
    return ((raw % 360) + 360) % 360;  // normaliser til [0, 360)
  });

  /** Sett absolutt rotasjon rundt aktiv akse for alle valgte figurer. */
  function applyRotationAngle(value: number) {
    if (store.readOnly) return;
    for (const id of [...store.selectedIds]) {
      const sh = store.project.shapes.find((s) => s.id === id);
      if (!sh) continue;
      const newRot = [...sh.rotation] as [number, number, number];
      newRot[rotateAxis] = value;
      store.updateShape(id, { rotation: newRot });
    }
  }

  /** Velg snap-steg for flytting (piltaster + gizmo-drag). */
  function setMoveSnap(mm: number) {
    moveSnapMm = mm;
    transformControls?.setTranslationSnap(mm);
  }

  /** Roter valgte figurer ett snap-steg (dir=±1) rundt aksen, og velg aksen. */
  function nudgeRotation(axis: 0 | 1 | 2, dir: 1 | -1) {
    if (store.readOnly) return;
    setRotateAxis(axis);  // velg akse + gå til rotér-modus (slider følger)
    store.beginTransaction();
    for (const id of [...store.selectedIds]) {
      const sh = store.project.shapes.find((s) => s.id === id);
      if (!sh) continue;
      const newRot = [...sh.rotation] as [number, number, number];
      newRot[axis] = sh.rotation[axis] + dir * store.rotateSnapDeg;
      store.updateShape(id, { rotation: newRot });
    }
    store.endTransaction();
  }

  /** Flytt valgte figurer (dx,dy,dz i mm). dz>0 = oppover langs Z. Ett angre-steg.
   *  clampToGround i store hindrer at figuren går under arbeidsflaten. */
  function nudgePosition(dx: number, dy: number, dz = 0) {
    if (store.readOnly) return;
    store.beginTransaction();
    for (const id of [...store.selectedIds]) {
      const sh = store.project.shapes.find((s) => s.id === id);
      if (!sh) continue;
      const newPos = [
        sh.position[0] + dx,
        sh.position[1] + dy,
        sh.position[2] + dz,
      ] as [number, number, number];
      store.updateShape(id, { position: newPos });
    }
    store.endTransaction();
  }

  // rAF-id for en utsatt tung rebuild (se rebuildMeshes).
  let deferredRebuildRaf: number | null = null;

  function rebuildMeshes(shapes: typeof store.project.shapes) {
    if (!csgEngine || !shapeRoot) return;

    // Når en tung kompilering er flagget (gruppering av tekst e.l.): utsett selve
    // compile-en til etter at nettleseren har rukket å tegne spinneren. Uten dette
    // kjøres compile synkront i samme oppdatering som flagget settes (selectedIds-
    // effekten kaller rebuildMeshes umiddelbart), tråden blokkeres, og spinneren
    // rekker aldri å vises. Dobbel rAF garanterer minst én paint før vi blokkerer.
    if (store.isCompiling) {
      if (deferredRebuildRaf !== null) return;  // allerede planlagt
      deferredRebuildRaf = requestAnimationFrame(() => {
        deferredRebuildRaf = requestAnimationFrame(() => {
          deferredRebuildRaf = null;
          doRebuildMeshes(store.project.shapes);
          store.isCompiling = false;
        });
      });
      return;
    }

    doRebuildMeshes(shapes);
  }

  function doRebuildMeshes(shapes: typeof store.project.shapes) {
    if (!csgEngine || !shapeRoot) return;

    // Tøm eksisterende
    while (shapeRoot.children.length > 0) {
      const c = shapeRoot.children[0];
      shapeRoot.remove(c);
      // ikke disposere geometrier her — csgEngine eier dem
    }

    const compiled = csgEngine.compile(shapes);
    for (const c of compiled) {
      if (c.mesh) {
        c.mesh.userData = { groupId: c.groupId, shapeIds: c.shapeIds };
        shapeRoot.add(c.mesh);
      }
    }
  }
</script>

<div class="scene-wrapper" class:place-mode={store.pendingShapeKind}>
  <div bind:this={containerEl} class="scene-container"></div>

  {#if store.pendingShapeKind}
    <div class="place-hint">
      Klikk på arbeidsflaten for å plassere figuren — eller trykk Esc for å avbryte
    </div>
  {/if}

  {#if showBoxSelect}
    <div
      class="select-box"
      style="
        left: {Math.min(boxStartX, boxEndX)}px;
        top: {Math.min(boxStartY, boxEndY)}px;
        width: {Math.abs(boxEndX - boxStartX)}px;
        height: {Math.abs(boxEndY - boxStartY)}px;
      "
    ></div>
  {/if}

  <div class="top-left-controls">
    <button
      type="button"
      class="home-btn"
      onclick={resetCameraView}
      title="Hjem — roter kameraet tilbake til startvinkelen"
      aria-label="Hjem — tilbake til startvinkelen"
    >
      <i class="fa-solid fa-house icon" aria-hidden="true"></i>
      <span class="label">Hjem</span>
    </button>

    {#if showModeBar}
      <div class="tool-panel">
        <div class="mode-bar">
          <button
            type="button"
            class="mode-btn"
            class:active={gizmoMode === 'translate'}
            onclick={() => setGizmoMode('translate')}
            title="Flytt (T)"
          >
            <i class="fa-solid fa-up-down-left-right icon" aria-hidden="true"></i>
            <span class="label">Flytt</span>
          </button>
          <div class="divider"></div>
          {#each ROTATE_AXES as a}
            <button
              type="button"
              class="axis-btn {a.cls}"
              class:active={gizmoMode === 'rotate' && rotateAxis === a.axis}
              onclick={() => setRotateAxis(a.axis)}
              title={`Roter rundt ${a.label}-aksen`}
            >
              <i class="fa-solid fa-rotate-right rot-icon" aria-hidden="true"></i>{a.label}
            </button>
          {/each}
        </div>

        {#if gizmoMode === 'rotate'}
          <div class="rotate-row">
              <button
                type="button"
                class="dir-btn"
                style:color={activeAxis.color}
                onclick={() => nudgeRotation(rotateAxis, -1)}
                title={`Roter mot klokka rundt ${activeAxis.label} (−${store.rotateSnapDeg}°)`}
                aria-label="Roter mot klokka"
              ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
              <input
                type="range"
                class="rotate-slider"
                style:accent-color={activeAxis.color}
                min="0"
                max="360"
                step={store.rotateSnapDeg}
                value={sliderAngle}
                oninput={(e) => applyRotationAngle(Number(e.currentTarget.value))}
                onfocus={() => store.beginTransaction()}
                onblur={() => store.endTransaction()}
                aria-label={`Roter valgt figur rundt ${activeAxis.label}-aksen`}
              />
              <button
                type="button"
                class="dir-btn"
                style:color={activeAxis.color}
                onclick={() => nudgeRotation(rotateAxis, 1)}
                title={`Roter med klokka rundt ${activeAxis.label} (+${store.rotateSnapDeg}°)`}
                aria-label="Roter med klokka"
              ><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>
              <span class="rotate-value">
                <span class="rotate-axis" style:color={activeAxis.color}>{activeAxis.label}</span>
                {Math.round(sliderAngle)}°
              </span>
            </div>
            <div class="snap-row">
              <span class="snap-label">Snap:</span>
              {#each [1, 22.5, 45, 90] as deg}
                <button
                  type="button"
                  class="snap-pill"
                  class:active={store.rotateSnapDeg === deg}
                  onclick={() => setRotateSnap(deg)}
                >{deg}°</button>
              {/each}
            </div>
        {/if}

        {#if gizmoMode === 'translate'}
          <div class="snap-row">
            <span class="snap-label">Snap:</span>
            {#each [0.1, 0.5, 1, 10] as mm}
              <button
                type="button"
                class="snap-pill"
                class:active={moveSnapMm === mm}
                onclick={() => setMoveSnap(mm)}
              >{mm} mm</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if store.isCompiling}
    <div class="compiling-overlay">
      <div class="compiling-box">
        <div class="spinner" aria-hidden="true"></div>
        <span>Kombinerer figurer…</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .scene-container {
    width: 100%;
    height: 100%;
    position: relative;
    touch-action: none;  /* viktig for pinch/orbit på touch */
  }
  .scene-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }
  /* Felles container øverst til venstre: Hjem-knapp + (ved utvalg) modus-baren. */
  .top-left-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    z-index: 5;
  }
  /* Ett samlet panel: modus-rad øverst, og (i rotér-modus) vinkel-slider + snap
     under — panelet utvider seg nedover når rotasjon er valgt.
     Flytende paneler over scenen bruker "glass"-uttrykket: blur + myk skygge. */
  .tool-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(12px) saturate(1.4);
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: var(--akse-radius-md, 12px);
    padding: 6px;
    box-shadow: var(--akse-shadow-md, 0 2px 6px rgba(0, 0, 0, 0.15));
    font-family: inherit;
    font-size: 12px;
  }
  .home-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 13px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(12px) saturate(1.4);
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: var(--akse-radius-md, 12px);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    box-shadow: var(--akse-shadow-md, 0 2px 6px rgba(0, 0, 0, 0.15));
    transition: color 0.15s, transform 0.1s;
  }
  .home-btn:hover { color: var(--primary-color, #2563eb); }
  .home-btn:active { transform: scale(0.95); }
  .home-btn .icon { font-size: 14px; line-height: 1; }

  .mode-bar {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mode-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: var(--akse-radius-sm, 8px);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    transition: background 0.15s, color 0.15s;
  }
  .mode-btn:hover { background: var(--akse-tint, #e8f0fe); }
  .mode-btn.active {
    background: var(--primary-color, #2563eb);
    color: white;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.3));
  }
  .mode-btn .icon { font-size: 15px; line-height: 1; }
  .divider {
    width: 1px;
    background: rgba(15, 23, 42, 0.12);
    margin: 4px 2px;
  }
  /* Akse-velgere (↻ X / ↻ Y / ↻ Z). Retningspilene ↺/↻ ligger ved slideren. */
  .axis-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 8px 10px;
    border-radius: var(--akse-radius-sm, 8px);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }
  .axis-btn:hover { background: var(--akse-tint, #e8f0fe); }
  .axis-btn .rot-icon { font-size: 12px; color: #64748b; }
  .axis-btn.axis-x { color: #d33; }
  .axis-btn.axis-y { color: #2a7; }
  .axis-btn.axis-z { color: #07c; }
  .axis-btn.active {
    background: var(--primary-color, #2563eb);
    color: white;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.3));
  }
  .axis-btn.active .rot-icon { color: white; }
  /* Retningspiler ↺/↻ (ved slideren) */
  .dir-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 5px 7px;
    border-radius: var(--akse-radius-sm, 8px);
    font-size: 14px;
    line-height: 1;
    color: var(--primary-color, #2563eb);
    transition: background 0.15s, transform 0.1s;
  }
  .dir-btn:hover { background: var(--akse-tint, #dbe7fb); }
  .dir-btn:active { transform: scale(0.9); }

  .rotate-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rotate-slider {
    flex: 1;
    accent-color: var(--primary-color, #2563eb);
    cursor: pointer;
  }
  .rotate-value {
    min-width: 48px;
    text-align: right;
    color: #334155;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .rotate-axis { font-weight: 700; }
  .snap-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .snap-label { color: #64748b; margin-right: 4px; }
  .snap-pill {
    padding: 4px 10px;
    background: rgba(15, 23, 42, 0.05);
    border: 1px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    color: #334155;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .snap-pill:hover {
    background: var(--akse-tint, #e8f0fe);
    color: var(--primary-color, #2563eb);
  }
  .snap-pill.active {
    background: var(--primary-color, #2563eb);
    color: white;
    border-color: var(--primary-color, #2563eb);
  }

  .select-box {
    position: absolute;
    border: 1.5px dashed var(--primary-color, #2563eb);
    background: var(--akse-ring, rgba(37, 99, 235, 0.1));
    border-radius: 4px;
    pointer-events: none;
    z-index: 20;
  }
  .scene-wrapper.place-mode .scene-container {
    cursor: crosshair;
  }
  .place-hint {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary-color, #2563eb);
    color: white;
    padding: 9px 18px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    z-index: 6;
    box-shadow: var(--akse-shadow-md, 0 2px 6px rgba(0, 0, 0, 0.2));
    animation: akse-hint-in 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
  }
  @keyframes akse-hint-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* Spinner-overlay mens en tung CSG-kompilering pågår (gruppering av tekst e.l.) */
  .compiling-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.25);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 30;
  }
  .compiling-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;
    padding: 16px 24px;
    border-radius: var(--akse-radius-lg, 16px);
    box-shadow: var(--akse-shadow-lg, 0 4px 16px rgba(0, 0, 0, 0.25));
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }
  .spinner {
    width: 22px;
    height: 22px;
    border: 3px solid #e2e8f0;
    border-top-color: var(--primary-color, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .place-hint { animation: none; }
  }
</style>

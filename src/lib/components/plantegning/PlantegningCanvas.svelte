<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigure, SketchFigureKind } from '$lib/akse/plantegning/sketchTypes';
  import { polygonize } from '$lib/akse/plantegning/polygonize';
  import { WORKPLANE_SIZE_MM } from '$lib/akse/plantegning/sketchTypes';
  import { computeSnap, type SnapGuide } from '$lib/akse/plantegning/snapping';
  import PlantegningSelectionDimensions from './PlantegningSelectionDimensions.svelte';
  import PlantegningResizeHandles from './PlantegningResizeHandles.svelte';
  import PlantegningGroupGuides from './PlantegningGroupGuides.svelte';

  const store = getContext<SketchStore>('sketchStore');
  const multiSelectModeGetter = getContext<() => boolean>('multiSelectMode');

  // SVG viewBox: vi rendrer i mm-koordinater direkte, sentrert om origo.
  // Y flippes i en outer <g transform="scale(1,-1)"> så +y er opp.
  const VB = WORKPLANE_SIZE_MM;
  const HALF = VB / 2;

  let svgEl: SVGSVGElement;

  // --- Drag state ---
  let dragState = $state<{
    active: boolean;
    startMouseMM: { x: number; y: number };
    startPositions: Map<string, { x: number; y: number }>;
    pointerId: number;
  } | null>(null);

  let activeGuides = $state<SnapGuide[]>([]);
  let snapPoint = $state<{ x: number; y: number } | null>(null);

  // --- Draw state ---
  let drawState = $state<{
    active: boolean;
    startMM: { x: number; y: number };
    currentMM: { x: number; y: number };
    pointerId: number;
  } | null>(null);

  // --- Box-select state (rubber-band) ---
  let boxSelectState = $state<{
    active: boolean;
    startMM: { x: number; y: number };
    currentMM: { x: number; y: number };
    additive: boolean;
    initialIds: Set<string>;
    pointerId: number;
  } | null>(null);

  function isDrawTool(t: typeof store.activeTool): t is SketchFigureKind {
    return t !== 'select';
  }

  function figurePath(fig: SketchFigure): string {
    const ring = polygonize(fig).ring;
    if (ring.length === 0) return '';
    let d = `M ${ring[0][0]} ${ring[0][1]}`;
    for (let i = 1; i < ring.length; i++) {
      d += ` L ${ring[i][0]} ${ring[i][1]}`;
    }
    return d + ' Z';
  }

  function strokeFor(fig: SketchFigure): string {
    return fig.mode === 'solid' ? '#1d4ed8' : '#991b1b';
  }
  function strokeDashFor(fig: SketchFigure): string {
    // Hull-figurer markeres med stiplet strek
    return fig.mode === 'hole' ? '2 1.2' : '';
  }

  function clientToMm(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgEl.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    const xMm = nx * VB - HALF;
    const yMm = -(ny * VB - HALF);
    return { x: xMm, y: yMm };
  }

  function handleFigurePointerDown(e: PointerEvent, id: string) {
    if (store.activeTool !== 'select') return;
    if (e.button !== 0) return;
    // Alt+klikk: la SVG-handler ta over for å cycle gjennom stablede figurer
    if (e.altKey) return;
    e.stopPropagation();

    const additive = e.shiftKey || (multiSelectModeGetter?.() ?? false);
    if (!store.selectedIds.has(id)) {
      store.select([id], additive);
    }

    const mm = clientToMm(e.clientX, e.clientY);
    store.beginDrag();
    dragState = {
      active: true,
      startMouseMM: mm,
      startPositions: new Map(
        [...store.selectedIds]
          .map(sid => store.figures.find(f => f.id === sid))
          .filter((f): f is SketchFigure => Boolean(f))
          .map(f => [f.id, { ...f.position }]),
      ),
      pointerId: e.pointerId,
    };
    svgEl.setPointerCapture(e.pointerId);
  }

  function handleFigureClick(e: MouseEvent, id: string) {
    if (store.activeTool !== 'select') return;
    e.stopPropagation();
    // Selection er allerede satt i pointerdown — her er det bare ren klikk uten drag,
    // og additive-shift håndtert. Ingen ekstra logikk nødvendig.
  }

  function handleSvgPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const mm = clientToMm(e.clientX, e.clientY);
    if (!isDrawTool(store.activeTool)) {
      // Alt+klikk: cycle gjennom figurer som ligger oppå hverandre i klikk-punktet
      if (e.altKey) {
        const stack = figuresContainingPoint(mm);
        if (stack.length === 0) {
          if (!e.shiftKey) store.deselectAll();
          return;
        }
        // Finn nåværende valg i stacken; velg neste (under den i z-order)
        const currentIdx = stack.findIndex(f => store.selectedIds.has(f.id));
        const next = stack[(currentIdx + 1) % stack.length];
        store.select([next.id], false);
        return;
      }
      // I select-modus: figurer og etiketter kaller stopPropagation, så hvis vi når
      // hit kom klikket fra arbeidsplate-bakgrunn eller rutenett. Start box-select
      // (rubber-band) — committes ved pointerup. Plain klikk uten dra = deselect.
      const additive = e.shiftKey || (multiSelectModeGetter?.() ?? false);
      boxSelectState = {
        active: true,
        startMM: mm,
        currentMM: mm,
        additive,
        initialIds: new Set(store.selectedIds),
        pointerId: e.pointerId,
      };
      svgEl.setPointerCapture(e.pointerId);
      return;
    }
    drawState = {
      active: true,
      startMM: mm,
      currentMM: mm,
      pointerId: e.pointerId,
    };
    svgEl.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (dragState?.active) {
      const mm = clientToMm(e.clientX, e.clientY);
      const dx = mm.x - dragState.startMouseMM.x;
      const dy = mm.y - dragState.startMouseMM.y;
      const snapEnabled = !e.shiftKey;
      let combinedGuides: SnapGuide[] = [];
      let combinedSnapPoint: { x: number; y: number } | null = null;

      for (const [id, startPos] of dragState.startPositions) {
        const rawX = startPos.x + dx;
        const rawY = startPos.y + dy;
        const result = computeSnap(rawX, rawY, id, store.figures, snapEnabled);
        store.updateFigurePosition(id, result.x, result.y);
        combinedGuides = combinedGuides.concat(result.guides);
        if (result.snapPoint) combinedSnapPoint = result.snapPoint;
      }
      activeGuides = combinedGuides;
      snapPoint = combinedSnapPoint;
      return;
    }
    if (drawState?.active) {
      drawState = { ...drawState, currentMM: clientToMm(e.clientX, e.clientY) };
      return;
    }
    if (boxSelectState?.active) {
      boxSelectState = { ...boxSelectState, currentMM: clientToMm(e.clientX, e.clientY) };
      return;
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (dragState?.active) {
      if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
      dragState = null;
      activeGuides = [];
      snapPoint = null;
      return;
    }
    if (drawState?.active) {
      if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
      const tool = store.activeTool;
      if (isDrawTool(tool)) {
        const fig = buildFigureFromDrag(tool, drawState.startMM, drawState.currentMM, e.shiftKey);
        if (fig) {
          const created = store.addFigure(fig);
          // Bytt tilbake til select-modus og velg den nye figuren
          store.activeTool = 'select';
          store.select([created.id], false);
        }
      }
      drawState = null;
      return;
    }
    if (boxSelectState?.active) {
      if (svgEl.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
      const dx = boxSelectState.currentMM.x - boxSelectState.startMM.x;
      const dy = boxSelectState.currentMM.y - boxSelectState.startMM.y;
      // Klikk uten dra (< 1mm bevegelse) = deselect (eller behold ved Shift)
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        if (!boxSelectState.additive) store.deselectAll();
      } else {
        const hitIds = figuresInBox(boxSelectState.startMM, boxSelectState.currentMM);
        if (boxSelectState.additive) {
          const merged = new Set(boxSelectState.initialIds);
          for (const id of hitIds) merged.add(id);
          store.select([...merged], false);
        } else {
          store.select(hitIds, false);
        }
      }
      boxSelectState = null;
    }
  }

  /** Returner alle figurer som inneholder punktet, fra topp z-order til bunn. */
  function figuresContainingPoint(p: { x: number; y: number }): SketchFigure[] {
    const hits: SketchFigure[] = [];
    for (let i = store.figures.length - 1; i >= 0; i--) {
      const fig = store.figures[i];
      const ring = polygonize(fig).ring;
      if (pointInPolygon(p, ring)) hits.push(fig);
    }
    return hits;
  }

  /** Ray-casting: returnerer true hvis punktet er innenfor polygon-ringen. */
  function pointInPolygon(p: { x: number; y: number }, ring: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect =
        (yi > p.y) !== (yj > p.y) &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Returner alle figur-ids hvis bbox overlapper med box-select-rektangelet. */
  function figuresInBox(p1: { x: number; y: number }, p2: { x: number; y: number }): string[] {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const hits: string[] = [];
    for (const fig of store.figures) {
      const ring = polygonize(fig).ring;
      let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
      for (const [x, y] of ring) {
        if (x < fMinX) fMinX = x;
        if (x > fMaxX) fMaxX = x;
        if (y < fMinY) fMinY = y;
        if (y > fMaxY) fMaxY = y;
      }
      // Bbox-overlap-test
      if (fMaxX >= minX && fMinX <= maxX && fMaxY >= minY && fMinY <= maxY) {
        hits.push(fig.id);
      }
    }
    return hits;
  }

  function buildFigureFromDrag(
    kind: SketchFigureKind,
    start: { x: number; y: number },
    end: { x: number; y: number },
    shift: boolean,
  ): Omit<SketchFigure, 'id'> | null {
    // Rund alle mål til 0.1mm — barnvennlige, lesbare verdier
    const r1 = (n: number) => Math.round(n * 10) / 10;
    if (Math.abs(end.x - start.x) < 1 && Math.abs(end.y - start.y) < 1) {
      return null;
    }
    const base = { kind, mode: 'solid' as const, rotation: 0 };
    if (kind === 'rectangle' || kind === 'roundedRect' || kind === 'triangle') {
      let w = end.x - start.x;
      let h = end.y - start.y;
      if (shift) {
        const m = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * m;
        h = Math.sign(h || 1) * m;
      }
      return {
        ...base,
        position: { x: r1(start.x + w / 2), y: r1(start.y + h / 2) },
        width: r1(Math.abs(w)),
        height: r1(Math.abs(h)),
        ...(kind === 'roundedRect' ? { cornerRadius: r1(Math.min(Math.abs(w), Math.abs(h)) * 0.15) } : {}),
        ...(kind === 'triangle' ? { apexX: 0 } : {}),
      };
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (kind === 'ellipse') {
      return { ...base, position: { x: r1(start.x), y: r1(start.y) }, radiusX: r1(Math.abs(dx)), radiusY: r1(Math.abs(dy)) };
    }
    if (kind === 'polygon') {
      return { ...base, position: { x: r1(start.x), y: r1(start.y) }, radius: r1(r), sides: 6 };
    }
    return { ...base, position: { x: r1(start.x), y: r1(start.y) }, radius: r1(r) };
  }
</script>

<svg
  class="canvas"
  bind:this={svgEl}
  viewBox="{-HALF} {-HALF} {VB} {VB}"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMidYMid meet"
  onpointerdown={handleSvgPointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  <!-- Outer g: flip Y så +y er opp -->
  <g transform="scale(1, -1)">
    <!-- Arbeidsplate-bakgrunn -->
    <rect x={-HALF} y={-HALF} width={VB} height={VB} fill="#f9fafb" stroke="#d1d5db" stroke-width="0.3" />

    <!-- 1mm sub-rutenett -->
    <g stroke="#e5e7eb" stroke-width="0.05">
      {#each Array.from({length: VB + 1}, (_, i) => i - HALF) as v}
        {#if v % 10 !== 0}
          <line x1={v} y1={-HALF} x2={v} y2={HALF} />
          <line x1={-HALF} y1={v} x2={HALF} y2={v} />
        {/if}
      {/each}
    </g>
    <!-- 10mm hovedrutenett -->
    <g stroke="#cbd5e1" stroke-width="0.2">
      {#each Array.from({length: VB / 10 + 1}, (_, i) => i * 10 - HALF) as v}
        <line x1={v} y1={-HALF} x2={v} y2={HALF} />
        <line x1={-HALF} y1={v} x2={HALF} y2={v} />
      {/each}
    </g>
    <!-- Figurer: kun omriss, ingen fyll. Hit-test path fanger klikk innenfor ~2.5mm av omrisset. -->
    <g>
      {#each store.figures as fig (fig.id)}
        <path
          d={figurePath(fig)}
          fill="none"
          stroke="transparent"
          stroke-width="2.5"
          pointer-events="stroke"
          onpointerdown={(e) => handleFigurePointerDown(e, fig.id)}
          onclick={(e) => handleFigureClick(e, fig.id)}
          style="cursor: {store.activeTool === 'select' ? 'pointer' : 'crosshair'};"
        />
        <path
          d={figurePath(fig)}
          fill="none"
          stroke={store.selectedIds.has(fig.id) ? '#f97316' : strokeFor(fig)}
          stroke-width={store.selectedIds.has(fig.id) ? 1.6 : 0.9}
          stroke-dasharray={strokeDashFor(fig)}
          pointer-events="none"
        />
      {/each}
    </g>

    <!-- Selection-dimensjons-etiketter (W under, H til høyre) -->
    <PlantegningSelectionDimensions />

    <!-- Resize-håndtak på valgt figur (hjørner + kantmidtpunkter) -->
    <PlantegningResizeHandles />

    <!-- Gruppe-guider mellom kantene av figurer i samme gruppe -->
    <PlantegningGroupGuides />

    <!-- Aksepiler (X rød, Y grønn) — tegnet sist så de aldri skjules av labels -->
    <line x1={-HALF} y1={0} x2={HALF} y2={0} stroke="#ef4444" stroke-width="0.3" pointer-events="none" />
    <line x1={0} y1={-HALF} x2={0} y2={HALF} stroke="#10b981" stroke-width="0.3" pointer-events="none" />

    <!-- Smart guides + snap-prikk -->
    <g>
      {#each activeGuides as guide}
        {#if guide.orientation === 'vertical'}
          <line x1={guide.position} y1={guide.from} x2={guide.position} y2={guide.to}
                stroke="#ec4899" stroke-width="0.2" stroke-dasharray="1 1" />
        {:else}
          <line x1={guide.from} y1={guide.position} x2={guide.to} y2={guide.position}
                stroke="#ec4899" stroke-width="0.2" stroke-dasharray="1 1" />
        {/if}
      {/each}
      {#if snapPoint}
        <circle cx={snapPoint.x} cy={snapPoint.y} r="0.8" fill="#f97316" />
      {/if}
    </g>

    <!-- Rubber-band box-select -->
    {#if boxSelectState?.active}
      {@const bs = boxSelectState}
      {@const bx = Math.min(bs.startMM.x, bs.currentMM.x)}
      {@const by = Math.min(bs.startMM.y, bs.currentMM.y)}
      {@const bw = Math.abs(bs.currentMM.x - bs.startMM.x)}
      {@const bh = Math.abs(bs.currentMM.y - bs.startMM.y)}
      <rect x={bx} y={by} width={bw} height={bh}
            fill="#3b82f6" fill-opacity="0.08"
            stroke="#3b82f6" stroke-width="0.2" stroke-dasharray="1 0.5" />
    {/if}

    <!-- Live preview under tegning -->
    {#if drawState?.active && isDrawTool(store.activeTool)}
      {@const previewFig = buildFigureFromDrag(store.activeTool, drawState.startMM, drawState.currentMM, false)}
      {#if previewFig}
        <path
          d={figurePath({ ...previewFig, id: '__preview__' })}
          fill="none"
          stroke="#1d4ed8"
          stroke-width="0.5"
          stroke-dasharray="1 1"
        />
      {/if}
    {/if}
  </g>
</svg>

<style>
  .canvas {
    width: 100%; height: 100%;
    background: white;
    user-select: none;
    touch-action: none;
  }
</style>

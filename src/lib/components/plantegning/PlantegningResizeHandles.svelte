<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigure } from '$lib/akse/plantegning/sketchTypes';
  import { polygonize } from '$lib/akse/plantegning/polygonize';

  const store = getContext<SketchStore>('sketchStore');

  type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

  // Aktiver kun ved nøyaktig ett valgt figur (samme regel som dimensjons-etikettene)
  let single = $derived.by<SketchFigure | null>(() => {
    if (store.selectedIds.size !== 1) return null;
    const id = [...store.selectedIds][0];
    return store.figures.find(f => f.id === id) ?? null;
  });

  let isGrouped = $derived(!!single?.groupId);

  let bbox = $derived.by(() => {
    if (!single) return null;
    return ringBbox(polygonize(single).ring);
  });

  function ringBbox(ring: Array<[number, number]>) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }

  // Y er flippet i ytre <g> så +y er opp på skjermen — 'n' er derfor maxY
  let handles = $derived.by<Array<{ dir: HandleDir; x: number; y: number }>>(() => {
    if (!bbox) return [];
    const { minX, maxX, minY, maxY } = bbox;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return [
      { dir: 'nw', x: minX, y: maxY },
      { dir: 'n',  x: cx,   y: maxY },
      { dir: 'ne', x: maxX, y: maxY },
      { dir: 'w',  x: minX, y: cy },
      { dir: 'e',  x: maxX, y: cy },
      { dir: 'sw', x: minX, y: minY },
      { dir: 's',  x: cx,   y: minY },
      { dir: 'se', x: maxX, y: minY },
    ];
  });

  const CURSORS: Record<HandleDir, string> = {
    n: 'ns-resize', s: 'ns-resize',
    e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    nw: 'nwse-resize', se: 'nwse-resize',
  };

  const HANDLE_SIZE = 2.4;     // synlig firkant (mm i viewBox)
  const HIT_SIZE = 5;          // usynlig treff-flate, romsligere for touch
  const MIN_DIM_MM = 1;

  let gEl: SVGGElement;

  let resizeState = $state<{
    dir: HandleDir;
    pointerId: number;
    figId: string;
    startFig: SketchFigure;
    startBbox: { minX: number; maxX: number; minY: number; maxY: number; w: number; h: number };
  } | null>(null);

  function clientToMm(clientX: number, clientY: number): { x: number; y: number } {
    const ctm = gEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  function startResize(e: PointerEvent, dir: HandleDir) {
    if (!single || !bbox || isGrouped) return;
    if (store.activeTool !== 'select') return;
    if (e.button !== 0) return;
    e.stopPropagation();
    store.beginDrag();
    resizeState = {
      dir,
      pointerId: e.pointerId,
      figId: single.id,
      startFig: { ...single, position: { ...single.position } },
      startBbox: { ...bbox },
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function moveResize(e: PointerEvent) {
    if (!resizeState) return;
    const { dir, startFig, startBbox } = resizeState;
    const mm = clientToMm(e.clientX, e.clientY);

    // Ønsket bbox-størrelse ut fra hvilken kant/hjørne som dras;
    // motsatt kant er anker og holdes fast.
    let desiredW = startBbox.w;
    let desiredH = startBbox.h;
    if (dir.includes('e')) desiredW = mm.x - startBbox.minX;
    if (dir.includes('w')) desiredW = startBbox.maxX - mm.x;
    if (dir.includes('n')) desiredH = mm.y - startBbox.minY;
    if (dir.includes('s')) desiredH = startBbox.maxY - mm.y;
    desiredW = Math.max(MIN_DIM_MM, desiredW);
    desiredH = Math.max(MIN_DIM_MM, desiredH);

    const ratioW = desiredW / Math.max(startBbox.w, 0.1);
    const ratioH = desiredH / Math.max(startBbox.h, 0.1);

    const patch = buildResizePatch(startFig, dir, ratioW, ratioH);

    // Anker-korreksjon: regn ut ny bbox og flytt posisjonen slik at
    // kanten(e) motsatt håndtaket blir stående.
    const newBbox = ringBbox(polygonize({ ...startFig, ...patch }).ring);
    let posX = startFig.position.x;
    let posY = startFig.position.y;
    if (dir.includes('e')) posX += startBbox.minX - newBbox.minX;
    if (dir.includes('w')) posX += startBbox.maxX - newBbox.maxX;
    if (dir.includes('n')) posY += startBbox.minY - newBbox.minY;
    if (dir.includes('s')) posY += startBbox.maxY - newBbox.maxY;

    store.updateFigureLive(resizeState.figId, {
      ...patch,
      position: { x: r1(posX), y: r1(posY) },
    });
  }

  function endResize(e: PointerEvent) {
    if (!resizeState) return;
    const target = e.currentTarget as Element;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    resizeState = null;
  }

  // Rund til 0.1mm — barnvennlige, lesbare verdier
  const r1 = (n: number) => Math.round(n * 10) / 10;

  function buildResizePatch(
    fig: SketchFigure,
    dir: HandleDir,
    ratioW: number,
    ratioH: number,
  ): Partial<SketchFigure> {
    // Ved ~90° rotasjon styrer width bbox-høyden og omvendt — bytt akser
    const rot = ((fig.rotation % 180) + 180) % 180;
    const swapAxes = rot > 45 && rot <= 135;
    const [rw, rh] = swapAxes ? [ratioH, ratioW] : [ratioW, ratioH];

    switch (fig.kind) {
      case 'rectangle':
      case 'roundedRect':
        return { width: r1((fig.width ?? 20) * rw), height: r1((fig.height ?? 20) * rh) };

      case 'triangle':
        // apexX skaleres med bredden så trekanten beholder formen
        return {
          width: r1((fig.width ?? 20) * rw),
          apexX: r1((fig.apexX ?? 0) * rw),
          height: r1((fig.height ?? 20) * rh),
        };

      case 'ellipse':
        return { radiusX: r1((fig.radiusX ?? 15) * rw), radiusY: r1((fig.radiusY ?? 10) * rh) };

      case 'circle':
      case 'polygon': {
        // Én radius styrer begge akser — bruk aksen med størst endring
        const isCorner = dir.length === 2;
        const ratio = isCorner
          ? (Math.abs(ratioW - 1) >= Math.abs(ratioH - 1) ? ratioW : ratioH)
          : (dir === 'e' || dir === 'w' ? ratioW : ratioH);
        const patch: Partial<SketchFigure> = { radius: r1((fig.radius ?? 10) * ratio) };
        if (fig.innerRadius !== undefined) patch.innerRadius = r1(fig.innerRadius * ratio);
        return patch;
      }
    }
  }
</script>

{#if single && bbox && !isGrouped && store.activeTool === 'select'}
  <g bind:this={gEl}>
    {#each handles as h (h.dir)}
      <g>
        <rect
          x={h.x - HANDLE_SIZE / 2} y={h.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE} height={HANDLE_SIZE}
          fill="white" stroke="#f97316" stroke-width="0.3" rx="0.4"
          pointer-events="none"
        />
        <rect
          x={h.x - HIT_SIZE / 2} y={h.y - HIT_SIZE / 2}
          width={HIT_SIZE} height={HIT_SIZE}
          fill="transparent"
          onpointerdown={(e) => startResize(e, h.dir)}
          onpointermove={moveResize}
          onpointerup={endResize}
          onpointercancel={endResize}
          style="cursor: {CURSORS[h.dir]};"
        />
      </g>
    {/each}
  </g>
{/if}

<script lang="ts">
  import ScribblePreview3D from './ScribblePreview3D.svelte';

  let { onCommit, onClose } = $props<{
    onCommit: (paths: number[][], fill: boolean) => void;
    onClose: () => void;
  }>();

  const CANVAS_SIZE = 400;
  const STROKE_WIDTH_PX = 12;  // visuell tykkelse på canvas (skaleres til 3mm i 3D)

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isDrawing = $state(false);
  let allPaths = $state<number[][]>([]);  // flat [x0,y0,x1,y1,...] per strek
  let currentPath: number[] = [];
  let fillMode = $state(false);  // toggle: tegn fylt figur vs ribbon-strek

  // Undo/redo: snapshots av allPaths (dypkopiert via JSON for enkelhet)
  let undoStack = $state<number[][][]>([]);
  let redoStack = $state<number[][][]>([]);
  const MAX_UNDO = 50;
  let canUndo = $derived(undoStack.length > 0);
  let canRedo = $derived(redoStack.length > 0);

  function snapshot() {
    undoStack.push(allPaths.map(p => [...p]));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(allPaths.map(p => [...p]));
    const prev = undoStack.pop()!;
    allPaths = prev;
    redraw();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(allPaths.map(p => [...p]));
    const next = redoStack.pop()!;
    allPaths = next;
    redraw();
  }

  function handleKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  }

  $effect(() => {
    if (canvasEl && !ctx) {
      ctx = canvasEl.getContext('2d');
      redraw();
    }
  });

  function redraw() {
    if (!ctx) return;
    // Bakgrunn + rutenett
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.strokeStyle = '#eef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_SIZE);
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_SIZE, i);
      ctx.stroke();
    }

    // Tegn alle ferdige streker
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = STROKE_WIDTH_PX;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const path of allPaths) {
      drawPath(path);
    }
    // Tegn current path under tegning
    if (currentPath.length >= 2) drawPath(currentPath);
  }

  function drawPath(path: number[]) {
    if (!ctx || path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) {
      ctx.lineTo(path[i], path[i + 1]);
    }
    ctx.stroke();
  }

  function getPointerPos(e: PointerEvent): [number, number] {
    const rect = canvasEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    return [x, y];
  }

  function handlePointerDown(e: PointerEvent) {
    canvasEl.setPointerCapture(e.pointerId);
    isDrawing = true;
    currentPath = [];
    const [x, y] = getPointerPos(e);
    currentPath.push(x, y);
    redraw();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing) return;
    const [x, y] = getPointerPos(e);
    const lastX = currentPath[currentPath.length - 2];
    const lastY = currentPath[currentPath.length - 1];
    const dx = x - lastX, dy = y - lastY;
    if (dx * dx + dy * dy < 9) return;  // sample threshold 3px
    currentPath.push(x, y);
    redraw();
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentPath.length >= 4) {
      snapshot();
      allPaths.push([...currentPath]);
    }
    currentPath = [];
    redraw();
  }

  function handleClear() {
    if (allPaths.length === 0) return;
    snapshot();
    allPaths = [];
    currentPath = [];
    redraw();
  }

  // Konverter pixel-koords (0..400, y-down) til mm (sentrert om origo, y-up).
  function toMmPaths(paths: number[][]): number[][] {
    const PIXEL_TO_MM = 100 / CANVAS_SIZE;  // 0.25
    return paths.map((path) => {
      const out: number[] = [];
      for (let i = 0; i < path.length; i += 2) {
        out.push(
          (path[i] - CANVAS_SIZE / 2) * PIXEL_TO_MM,
          -(path[i + 1] - CANVAS_SIZE / 2) * PIXEL_TO_MM,
        );
      }
      return out;
    });
  }

  // Mates inn i 3D-forhåndsvisningen — oppdateres per fullført strek.
  let mmPaths = $derived(toMmPaths(allPaths));

  function handleCommit() {
    if (allPaths.length === 0) {
      alert('Tegn minst én strek først');
      return;
    }
    onCommit(toMmPaths(allPaths), fillMode);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="modal-header">
      <h2><i class="fa-solid fa-pencil" aria-hidden="true"></i> Tegn en figur</h2>
      <button type="button" class="close" onclick={onClose} aria-label="Lukk" title="Lukk">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <p class="hint">
      Tegn én eller flere streker.
      {#if fillMode}
        Streken behandles som en lukket figur som fylles og ekstruderes.
      {:else}
        Hver strek blir til en tykk linje (3mm) ekstrudert til 20mm høy.
      {/if}
    </p>
    <label class="fill-toggle">
      <input type="checkbox" bind:checked={fillMode} />
      Fyll figur (lukk og fyll streken)
    </label>
    <div class="editor-row">
      <canvas
        bind:this={canvasEl}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
      ></canvas>
      <div class="side">
        <span class="side-label">3D-forhåndsvisning</span>
        <ScribblePreview3D paths={mmPaths} fill={fillMode} />
      </div>
    </div>
    <div class="actions">
      <button type="button" class="secondary" onclick={undo} disabled={!canUndo} title="Angre (Ctrl/Cmd+Z)">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Angre
      </button>
      <button type="button" class="secondary" onclick={redo} disabled={!canRedo} title="Gjør om (Ctrl/Cmd+Shift+Z)">
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Gjør om
      </button>
      <button type="button" class="secondary" onclick={handleClear} disabled={allPaths.length === 0}>
        <i class="fa-solid fa-eraser" aria-hidden="true"></i> Tøm
      </button>
      <button type="button" class="secondary" onclick={onClose}>Avbryt</button>
      <button type="button" class="primary" onclick={handleCommit}>
        <i class="fa-solid fa-cube" aria-hidden="true"></i> Lag 3D-modell
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 100;
    animation: akse-backdrop-in 0.18s ease-out;
  }
  .modal {
    background: white; border-radius: var(--akse-radius-lg, 16px); padding: 20px 24px 24px;
    max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; gap: 12px;
    box-shadow: var(--akse-shadow-lg, 0 24px 64px rgba(15, 23, 42, 0.25));
    animation: akse-modal-in 0.22s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
  @keyframes akse-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes akse-modal-in {
    from { opacity: 0; transform: scale(0.96) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop, .modal { animation: none; }
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .modal h2 {
    margin: 0; font-size: 17px; font-weight: 700;
    display: flex; align-items: center; gap: 10px;
  }
  .modal h2 i { color: var(--primary-color, #2563eb); font-size: 15px; }
  .close {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
    background: white; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: 50%;
    font-size: 14px; color: var(--text-secondary, #64748b);
    cursor: pointer; padding: 0; font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }
  .close:hover { background: #f3f4f6; color: var(--text-primary, #1e293b); }
  .hint { color: #666; font-size: 13px; margin: 0; max-width: 400px; }
  .fill-toggle {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 500; color: #334155;
    padding: 8px 12px;
    background: var(--bg-secondary, #f4f6fb); border-radius: var(--akse-radius-sm, 8px);
    cursor: pointer;
    user-select: none;
  }
  .fill-toggle input { margin: 0; cursor: pointer; accent-color: var(--primary-color, #2563eb); }
  canvas {
    border: 1px solid var(--border-color, #e3e8f0); border-radius: var(--akse-radius-md, 12px);
    box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.05);
    cursor: crosshair; touch-action: none;
    width: 400px; height: 400px;
    max-width: 80vw; max-height: 60vh;
    display: block;
  }
  .editor-row { display: flex; gap: 14px; align-items: flex-start; }
  .side {
    width: 220px; flex: 0 0 auto;
    display: flex; flex-direction: column; gap: 6px;
  }
  .side-label {
    font-size: 11px; font-weight: 700;
    color: var(--text-secondary, #6b7280);
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  @media (max-width: 760px) {
    .editor-row { flex-direction: column; align-items: center; }
    .side { width: 100%; max-width: 300px; }
  }
  .actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .actions button {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    background: white; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
    color: #374151;
    transition: background 0.15s, filter 0.15s, transform 0.1s;
  }
  .actions button:active:not(:disabled) { transform: scale(0.97); }
  .actions button.primary {
    background: var(--primary-color, #2563eb); color: white; border-color: transparent;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
  }
  .actions button.primary:hover { filter: brightness(1.08); }
  .actions button.secondary:hover:not(:disabled) { background: #f8fafc; }
  .actions button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

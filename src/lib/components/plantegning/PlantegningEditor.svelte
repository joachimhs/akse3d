<script lang="ts">
  import { setContext } from 'svelte';
  import type { SketchData, SketchFigureKind } from '$lib/akse/plantegning/sketchTypes';
  import { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import PlantegningCanvas from './PlantegningCanvas.svelte';
  import PlantegningToolbar from './PlantegningToolbar.svelte';
  import PlantegningPropertyPanel from './PlantegningPropertyPanel.svelte';
  import PlantegningPreview3D from './PlantegningPreview3D.svelte';

  let { initialData, onCommit, onClose } = $props<{
    initialData: SketchData;
    onCommit: (data: SketchData) => void;
    onClose: () => void;
  }>();

  const store = new SketchStore(initialData);
  setContext('sketchStore', store);

  // Input-mode-deteksjon for touch-tilpasninger
  let inputMode = $state<'pointer' | 'touch'>('pointer');
  function detectInputMode(e: PointerEvent) {
    if (inputMode === 'touch') return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') inputMode = 'touch';
  }
  setContext('inputMode', () => inputMode);

  // Multi-select-toggle for touch
  let multiSelectMode = $state(false);
  setContext('multiSelectMode', () => multiSelectMode);
  setContext('setMultiSelectMode', (v: boolean) => (multiSelectMode = v));

  function handleCommit() {
    if (store.figures.length === 0) {
      alert('Tegn minst én figur før du lager 3D-modell');
      return;
    }
    onCommit(store.toSketchData());
  }

  const TOOL_KEYS: Record<string, SketchFigureKind | 'select'> = {
    r: 'rectangle',
    o: 'roundedRect',
    s: 'circle',
    e: 'ellipse',
    t: 'triangle',
    p: 'polygon',
    v: 'select',
  };

  function handleKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      store.activeTool = 'select';
      store.deselectAll();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      store.deleteFigures([...store.selectedIds]);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      const newIds = store.duplicateFigures([...store.selectedIds]);
      store.select(newIds);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      store.redo();
      return;
    }
    if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
      store.toggleMode();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      for (const id of store.selectedIds) {
        const f = store.figures.find(x => x.id === id);
        if (f) store.updateFigure(id, { position: { x: f.position.x + dx, y: f.position.y + dy } });
      }
      return;
    }
    const tool = TOOL_KEYS[e.key.toLowerCase()];
    if (tool) {
      store.activeTool = tool;
      if (tool !== 'select') store.deselectAll();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} onpointerdown={detectInputMode} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="header">
      <h2><i class="fa-solid fa-compass-drafting" aria-hidden="true"></i> Plantegning</h2>
      <button class="close" onclick={onClose} aria-label="Lukk" title="Lukk">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="body">
      <PlantegningToolbar />
      <div class="canvas-area">
        <PlantegningCanvas />
      </div>
      <div class="right-col">
        <PlantegningPropertyPanel />
        <PlantegningPreview3D />
      </div>
    </div>
    <div class="footer">
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
    background: white; border-radius: var(--akse-radius-xl, 20px);
    width: 95vw; height: 90vh;
    display: flex; flex-direction: column;
    overflow: hidden;
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
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid var(--border-color, #e3e8f0);
  }
  .header h2 {
    margin: 0; font-size: 17px; font-weight: 700;
    display: flex; align-items: center; gap: 10px;
  }
  .header h2 i { color: var(--primary-color, #2563eb); font-size: 15px; }
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
  .body {
    flex: 1; display: grid;
    grid-template-columns: 200px 1fr 300px;
    gap: 12px; padding: 12px; min-height: 0;
  }
  .canvas-area {
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
    overflow: hidden;
    display: flex;
    background: white;
  }
  .right-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
  .right-col > :global(.panel) {
    flex: 1 1 auto;
    min-height: 0;
  }
  .footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 20px; border-top: 1px solid var(--border-color, #e3e8f0);
  }
  .footer button {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 16px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    background: white; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
    color: #374151;
    transition: background 0.15s, filter 0.15s, transform 0.1s;
  }
  .footer button:active { transform: scale(0.97); }
  .footer button.primary {
    background: var(--primary-color, #2563eb); color: white; border-color: transparent;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
  }
  .footer button.primary:hover { filter: brightness(1.08); }
  .footer button.secondary:hover { background: #f8fafc; }

  @media (max-width: 1023px) {
    .body {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }
  }
</style>

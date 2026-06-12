<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigureKind } from '$lib/akse/plantegning/sketchTypes';

  const store = getContext<SketchStore>('sketchStore');
  const inputModeGetter = getContext<() => 'pointer' | 'touch'>('inputMode');
  const multiSelectModeGetter = getContext<() => boolean>('multiSelectMode');
  const setMultiSelectMode = getContext<(v: boolean) => void>('setMultiSelectMode');

  let inputMode = $derived(inputModeGetter ? inputModeGetter() : 'pointer');
  let multiSelectMode = $derived(multiSelectModeGetter ? multiSelectModeGetter() : false);

  // shortcut speiler TOOL_KEYS i PlantegningEditor.svelte
  const tools: Array<{ id: SketchFigureKind | 'select'; label: string; icon: string; shortcut: string }> = [
    { id: 'select',      label: 'Velg',           icon: '↖', shortcut: 'V' },
    { id: 'rectangle',   label: 'Rektangel',      icon: '▭', shortcut: 'R' },
    { id: 'roundedRect', label: 'Avrundet rekt.', icon: '▢', shortcut: 'O' },
    { id: 'circle',      label: 'Sirkel',         icon: '◯', shortcut: 'S' },
    { id: 'ellipse',     label: 'Ellipse',        icon: '⬭', shortcut: 'E' },
    { id: 'triangle',    label: 'Trekant',        icon: '△', shortcut: 'T' },
    { id: 'polygon',     label: 'Polygon',        icon: '⬡', shortcut: 'P' },
  ];

  function activate(id: typeof tools[number]['id']) {
    store.activeTool = id;
    if (id !== 'select') store.deselectAll();
  }

  let canGroup = $derived.by(() => {
    if (store.selectedIds.size < 2) return false;
    // Tillat hvis ikke alle deler én og samme groupId
    const groupIds = new Set<string | undefined>();
    for (const f of store.figures) {
      if (store.selectedIds.has(f.id)) groupIds.add(f.groupId);
    }
    return !(groupIds.size === 1 && [...groupIds][0]);
  });

  let canUngroup = $derived.by(() => {
    if (store.selectedIds.size === 0) return false;
    return store.figures.some(f => store.selectedIds.has(f.id) && f.groupId);
  });

</script>

<div class="toolbar">
  <h3>Verktøy</h3>
  <div class="tools">
    {#each tools as t}
      <button
        class:active={store.activeTool === t.id}
        onclick={() => activate(t.id)}
        title={`${t.label} (${t.shortcut})`}
      >
        <span class="icon">{t.icon}</span>
        <span class="label">{t.label}</span>
        <kbd class="shortcut">{t.shortcut}</kbd>
      </button>
    {/each}
  </div>

  <hr />

  <button
    onclick={() => store.groupSelected()}
    disabled={!canGroup}
    title={canGroup ? 'Grupper valgte figurer (viser avstandsguider)' : 'Velg minst to figurer som ikke alle deler samme gruppe'}
  >
    <span class="icon"><i class="fa-solid fa-object-group" aria-hidden="true"></i></span> Grupper
  </button>

  <button
    onclick={() => store.ungroupSelected()}
    disabled={!canUngroup}
    title={canUngroup ? 'Fjern gruppe fra valgte figurer' : 'Ingen valgte figurer er gruppert'}
  >
    <span class="icon"><i class="fa-solid fa-object-ungroup" aria-hidden="true"></i></span> Avgrupper
  </button>

  {#if inputMode === 'touch'}
    <button
      class:active={multiSelectMode}
      onclick={() => setMultiSelectMode(!multiSelectMode)}
    >
      {multiSelectMode ? '✓ Velger flere' : 'Velg flere'}
    </button>
  {/if}

  <hr />

  <button onclick={() => store.undo()} disabled={!store.canUndo}>
    <span class="icon"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></span> Angre
  </button>
  <button onclick={() => store.redo()} disabled={!store.canRedo}>
    <span class="icon"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></span> Gjør om
  </button>
</div>

<style>
  .toolbar {
    display: flex; flex-direction: column; gap: 6px;
    padding: 8px; overflow-y: auto;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
    background: var(--bg-secondary, #f4f6fb);
    position: relative;
  }
  .toolbar h3 {
    margin: 0 0 4px 0; font-size: 12px; font-weight: 700;
    color: var(--text-secondary, #6b7280);
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .tools { display: flex; flex-direction: column; gap: 4px; }
  button {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    background: white; cursor: pointer; text-align: left;
    font-family: inherit; font-size: 14px; font-weight: 500;
    color: var(--text-primary, #1e293b);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  button:hover:not(:disabled) {
    background: var(--akse-tint, #e8f0fe);
    color: var(--primary-color, #2563eb);
  }
  button.active {
    background: var(--primary-color, #2563eb);
    border-color: var(--primary-color, #2563eb);
    color: white;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.3));
  }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .icon { font-size: 16px; width: 20px; text-align: center; }
  .label { flex: 1; }
  .shortcut {
    font-family: inherit; font-size: 11px; font-weight: 600;
    color: #6b7280; background: var(--bg-secondary, #f3f4f6);
    border: 1px solid var(--border-color, #d1d5db); border-radius: 4px;
    padding: 1px 5px; min-width: 16px; text-align: center;
  }
  button.active .shortcut {
    color: white; background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }
  hr { border: none; border-top: 1px solid var(--border-color, #e5e7eb); margin: 4px 0; }

  @media (max-width: 1023px) {
    .toolbar {
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .toolbar h3 { display: none; }
    .tools { flex-direction: row; }
  }
</style>

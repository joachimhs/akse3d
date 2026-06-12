<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigure } from '$lib/akse/plantegning/sketchTypes';
  import { polygonize } from '$lib/akse/plantegning/polygonize';

  const store = getContext<SketchStore>('sketchStore');

  // Aktiver kun ved nøyaktig ett valgt figur
  let single = $derived.by<SketchFigure | null>(() => {
    if (store.selectedIds.size !== 1) return null;
    const id = [...store.selectedIds][0];
    return store.figures.find(f => f.id === id) ?? null;
  });

  // Bbox av valgt figur i mm
  let bbox = $derived.by(() => {
    if (!single) return null;
    const ring = polygonize(single).ring;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  });

  let editing = $state<'w' | 'h' | null>(null);
  let editValue = $state<number>(0);
  let isGrouped = $derived(!!single?.groupId);

  function startEdit(axis: 'w' | 'h') {
    if (!bbox || isGrouped) return;
    editing = axis;
    const v = axis === 'w' ? bbox.w : bbox.h;
    editValue = Math.round(v * 10) / 10;
  }

  function commitEdit() {
    if (editing === null || !single || !bbox) {
      editing = null;
      return;
    }
    const newVal = editValue;
    if (!Number.isFinite(newVal) || newVal <= 0) {
      editing = null;
      return;
    }
    applyDimension(single, editing, newVal, bbox);
    editing = null;
  }

  function applyDimension(
    fig: SketchFigure,
    axis: 'w' | 'h',
    newVal: number,
    currentBbox: { w: number; h: number },
  ) {
    switch (fig.kind) {
      case 'rectangle':
      case 'roundedRect':
        if (axis === 'w') {
          const ratio = newVal / currentBbox.w;
          store.updateFigure(fig.id, { width: (fig.width ?? 20) * ratio });
        } else {
          const ratio = newVal / currentBbox.h;
          store.updateFigure(fig.id, { height: (fig.height ?? 20) * ratio });
        }
        return;

      case 'triangle':
        if (axis === 'w') {
          // Skaler width OG apexX proporsjonalt, slik at trekanten beholder formen
          const ratio = newVal / currentBbox.w;
          store.updateFigure(fig.id, {
            width: (fig.width ?? 20) * ratio,
            apexX: (fig.apexX ?? 0) * ratio,
          });
        } else {
          const ratio = newVal / currentBbox.h;
          store.updateFigure(fig.id, { height: (fig.height ?? 20) * ratio });
        }
        return;

      case 'ellipse':
        if (axis === 'w') {
          const ratio = newVal / currentBbox.w;
          store.updateFigure(fig.id, { radiusX: (fig.radiusX ?? 15) * ratio });
        } else {
          const ratio = newVal / currentBbox.h;
          store.updateFigure(fig.id, { radiusY: (fig.radiusY ?? 10) * ratio });
        }
        return;

      case 'circle':
      case 'polygon': {
        const referenceBboxDim = axis === 'w' ? currentBbox.w : currentBbox.h;
        if (referenceBboxDim <= 0) return;
        const ratio = newVal / referenceBboxDim;
        const patch: Partial<SketchFigure> = { radius: (fig.radius ?? 10) * ratio };
        if (fig.innerRadius !== undefined) patch.innerRadius = fig.innerRadius * ratio;
        store.updateFigure(fig.id, patch);
        return;
      }
    }
  }

  function cancelEdit() {
    editing = null;
  }

  function stop(e: Event) {
    e.stopPropagation();
  }

  /** Svelte-action: fokuser inputen og marker innholdet ved mount. */
  function focusSelect(node: HTMLInputElement) {
    // requestAnimationFrame så foreignObject rekker å mountes før select()
    requestAnimationFrame(() => {
      node.focus();
      node.select();
    });
  }
</script>

{#if single && bbox && !isGrouped}
  {@const cx = (bbox.minX + bbox.maxX) / 2}
  {@const cy = (bbox.minY + bbox.maxY) / 2}
  {@const labelOffset = 6}
  <!-- W (X-akse) under figuren -->
  <g class="axis-label">
    <line
      x1={bbox.minX} y1={bbox.minY - labelOffset}
      x2={bbox.maxX} y2={bbox.minY - labelOffset}
      stroke="#6b7280" stroke-width="0.15"
    />
    <line x1={bbox.minX} y1={bbox.minY - labelOffset - 1} x2={bbox.minX} y2={bbox.minY - labelOffset + 1}
          stroke="#6b7280" stroke-width="0.15" />
    <line x1={bbox.maxX} y1={bbox.minY - labelOffset - 1} x2={bbox.maxX} y2={bbox.minY - labelOffset + 1}
          stroke="#6b7280" stroke-width="0.15" />
    <g transform="translate({cx}, {bbox.minY - labelOffset - 3}) scale(1, -1)">
      {#if editing === 'w'}
        <foreignObject x="-11" y="-2.6" width="22" height="5.2">
          <div xmlns="http://www.w3.org/1999/xhtml" class="dim-edit-wrap">
            <input class="dim-edit-input" type="number" step="0.1" min="0.1" bind:value={editValue}
                   use:focusSelect
                   onpointerdown={stop} onclick={stop}
                   onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                   onblur={commitEdit} />
          </div>
        </foreignObject>
      {:else}
        <rect x="-11" y="-2.6" width="22" height="5.2" fill="#3b82f6" stroke="#1d4ed8" stroke-width="0.1" rx="0.8" />
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
              font-size="2.8" font-family="sans-serif" fill="white" font-weight="600"
              onpointerdown={stop}
              onclick={(e) => { e.stopPropagation(); startEdit('w'); }}
              style="cursor: {isGrouped ? 'default' : 'pointer'};">
          B {bbox.w.toFixed(1)} mm
        </text>
      {/if}
    </g>
  </g>

  <!-- H (Y-akse) til høyre for figuren -->
  <g class="axis-label">
    <line
      x1={bbox.maxX + labelOffset} y1={bbox.minY}
      x2={bbox.maxX + labelOffset} y2={bbox.maxY}
      stroke="#6b7280" stroke-width="0.15"
    />
    <line x1={bbox.maxX + labelOffset - 1} y1={bbox.minY} x2={bbox.maxX + labelOffset + 1} y2={bbox.minY}
          stroke="#6b7280" stroke-width="0.15" />
    <line x1={bbox.maxX + labelOffset - 1} y1={bbox.maxY} x2={bbox.maxX + labelOffset + 1} y2={bbox.maxY}
          stroke="#6b7280" stroke-width="0.15" />
    <g transform="translate({bbox.maxX + labelOffset + 3}, {cy}) scale(1, -1)">
      {#if editing === 'h'}
        <foreignObject x="-11" y="-2.6" width="22" height="5.2">
          <div xmlns="http://www.w3.org/1999/xhtml" class="dim-edit-wrap">
            <input class="dim-edit-input" type="number" step="0.1" min="0.1" bind:value={editValue}
                   use:focusSelect
                   onpointerdown={stop} onclick={stop}
                   onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                   onblur={commitEdit} />
          </div>
        </foreignObject>
      {:else}
        <rect x="-11" y="-2.6" width="22" height="5.2" fill="#3b82f6" stroke="#1d4ed8" stroke-width="0.1" rx="0.8" />
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
              font-size="2.8" font-family="sans-serif" fill="white" font-weight="600"
              onpointerdown={stop}
              onclick={(e) => { e.stopPropagation(); startEdit('h'); }}
              style="cursor: {isGrouped ? 'default' : 'pointer'};">
          H {bbox.h.toFixed(1)} mm
        </text>
      {/if}
    </g>
  </g>
{/if}

<style>
  :global(.dim-edit-wrap) {
    width: 100%; height: 100%; display: flex; align-items: stretch;
  }
  :global(.dim-edit-input) {
    width: 100%; height: 100%;
    font-size: 3px; line-height: 1;
    padding: 0; margin: 0;
    border: 0.15px solid #3b82f6; border-radius: 0.8px;
    box-sizing: border-box;
    font-family: sans-serif;
    background: white; color: #3b82f6;
    text-align: center;
    outline: none;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  :global(.dim-edit-input::-webkit-outer-spin-button),
  :global(.dim-edit-input::-webkit-inner-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
</style>

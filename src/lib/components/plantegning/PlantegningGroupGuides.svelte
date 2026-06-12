<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigure } from '$lib/akse/plantegning/sketchTypes';
  import { polygonize } from '$lib/akse/plantegning/polygonize';

  const store = getContext<SketchStore>('sketchStore');

  interface Box {
    minX: number; maxX: number; minY: number; maxY: number;
    midX: number; midY: number;
  }
  function bboxOf(fig: SketchFigure): Box {
    const ring = polygonize(fig).ring;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY, midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 };
  }

  /** Avstandslinje + tall langs X- eller Y-aksen. */
  interface GuideLabel {
    id: string;                   // unik id (par + edge-kind) for keying/editing
    axis: 'x' | 'y';
    x1: number; y1: number;       // start-punkt for guide-linje
    x2: number; y2: number;       // slutt-punkt for guide-linje
    distance: number;             // mm
    moveFigureId: string;         // figur som flyttes ved edit av denne avstanden
    deltaSign: 1 | -1;            // pos[axis] += (newVal - distance) * deltaSign
  }

  /** Hopp over labels for avstander mindre enn dette (mm) — null/nær-null gir bare støy. */
  const MIN_LABEL_DISTANCE = 0.5;

  /** Returner alle guide-labels mellom paret (a, b). */
  function pairGuides(a: SketchFigure, b: SketchFigure): GuideLabel[] {
    const A = bboxOf(a);
    const B = bboxOf(b);
    const out: GuideLabel[] = [];

    const push = (g: GuideLabel) => {
      if (Math.abs(g.distance) >= MIN_LABEL_DISTANCE) out.push(g);
    };

    // --- X-akse ---
    if (A.maxX <= B.minX) {
      // A helt til venstre for B. Edit øker gap → B flytter høyre (deltaSign +1)
      const y = clampOverlap(A.minY, A.maxY, B.minY, B.maxY);
      push({ id: `${a.id}_${b.id}_x_gap`, axis: 'x', x1: A.maxX, y1: y, x2: B.minX, y2: y, distance: B.minX - A.maxX, moveFigureId: b.id, deltaSign: 1 });
    } else if (B.maxX <= A.minX) {
      // B helt til venstre for A. Edit øker gap → B flytter venstre (deltaSign -1)
      const y = clampOverlap(A.minY, A.maxY, B.minY, B.maxY);
      push({ id: `${a.id}_${b.id}_x_gap`, axis: 'x', x1: B.maxX, y1: y, x2: A.minX, y2: y, distance: A.minX - B.maxX, moveFigureId: b.id, deltaSign: -1 });
    } else if (A.minX >= B.minX && A.maxX <= B.maxX) {
      // A inni B horisontalt — A flytter
      const y = (A.minY + A.maxY) / 2;
      push({ id: `${a.id}_${b.id}_x_leftInset`, axis: 'x', x1: B.minX, y1: y, x2: A.minX, y2: y, distance: A.minX - B.minX, moveFigureId: a.id, deltaSign: 1 });
      push({ id: `${a.id}_${b.id}_x_rightInset`, axis: 'x', x1: A.maxX, y1: y, x2: B.maxX, y2: y, distance: B.maxX - A.maxX, moveFigureId: a.id, deltaSign: -1 });
    } else if (B.minX >= A.minX && B.maxX <= A.maxX) {
      // B inni A horisontalt — B flytter
      const y = (B.minY + B.maxY) / 2;
      push({ id: `${a.id}_${b.id}_x_leftInset`, axis: 'x', x1: A.minX, y1: y, x2: B.minX, y2: y, distance: B.minX - A.minX, moveFigureId: b.id, deltaSign: 1 });
      push({ id: `${a.id}_${b.id}_x_rightInset`, axis: 'x', x1: B.maxX, y1: y, x2: A.maxX, y2: y, distance: A.maxX - B.maxX, moveFigureId: b.id, deltaSign: -1 });
    }

    // --- Y-akse ---
    if (A.maxY <= B.minY) {
      const x = clampOverlap(A.minX, A.maxX, B.minX, B.maxX);
      push({ id: `${a.id}_${b.id}_y_gap`, axis: 'y', x1: x, y1: A.maxY, x2: x, y2: B.minY, distance: B.minY - A.maxY, moveFigureId: b.id, deltaSign: 1 });
    } else if (B.maxY <= A.minY) {
      const x = clampOverlap(A.minX, A.maxX, B.minX, B.maxX);
      push({ id: `${a.id}_${b.id}_y_gap`, axis: 'y', x1: x, y1: B.maxY, x2: x, y2: A.minY, distance: A.minY - B.maxY, moveFigureId: b.id, deltaSign: -1 });
    } else if (A.minY >= B.minY && A.maxY <= B.maxY) {
      const x = (A.minX + A.maxX) / 2;
      push({ id: `${a.id}_${b.id}_y_bottomInset`, axis: 'y', x1: x, y1: B.minY, x2: x, y2: A.minY, distance: A.minY - B.minY, moveFigureId: a.id, deltaSign: 1 });
      push({ id: `${a.id}_${b.id}_y_topInset`, axis: 'y', x1: x, y1: A.maxY, x2: x, y2: B.maxY, distance: B.maxY - A.maxY, moveFigureId: a.id, deltaSign: -1 });
    } else if (B.minY >= A.minY && B.maxY <= A.maxY) {
      const x = (B.minX + B.maxX) / 2;
      push({ id: `${a.id}_${b.id}_y_bottomInset`, axis: 'y', x1: x, y1: A.minY, x2: x, y2: B.minY, distance: B.minY - A.minY, moveFigureId: b.id, deltaSign: 1 });
      push({ id: `${a.id}_${b.id}_y_topInset`, axis: 'y', x1: x, y1: B.maxY, x2: x, y2: A.maxY, distance: A.maxY - B.maxY, moveFigureId: b.id, deltaSign: -1 });
    }

    return out;
  }

  function clampOverlap(a1: number, a2: number, b1: number, b2: number): number {
    const lo = Math.max(a1, b1);
    const hi = Math.min(a2, b2);
    if (lo <= hi) return (lo + hi) / 2;
    return (Math.max(a2, b2) + Math.min(a1, b1)) / 2;
  }

  let activeGroupIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const f of store.figures) {
      if (store.selectedIds.has(f.id) && f.groupId) ids.add(f.groupId);
    }
    return ids;
  });

  let guides = $derived.by(() => {
    if (activeGroupIds.size === 0) return [];
    const all: GuideLabel[] = [];
    for (const gid of activeGroupIds) {
      const members = store.figures.filter(f => f.groupId === gid);
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          all.push(...pairGuides(members[i], members[j]));
        }
      }
    }
    return all;
  });

  let editingId = $state<string | null>(null);
  let editValue = $state<number>(0);

  function startEdit(g: GuideLabel) {
    editingId = g.id;
    editValue = Math.round(g.distance * 10) / 10;
  }

  function commitEdit() {
    if (editingId === null) {
      return;
    }
    const g = guides.find(x => x.id === editingId);
    if (!g) { editingId = null; return; }
    const fig = store.figures.find(f => f.id === g.moveFigureId);
    if (!fig) { editingId = null; return; }
    const change = editValue - g.distance;
    const newPos = { x: fig.position.x, y: fig.position.y };
    if (g.axis === 'x') newPos.x += change * g.deltaSign;
    else newPos.y += change * g.deltaSign;
    store.updateFigure(g.moveFigureId, { position: newPos });
    editingId = null;
  }

  function cancelEdit() {
    editingId = null;
  }

  function stop(e: Event) { e.stopPropagation(); }

  function focusSelect(node: HTMLInputElement) {
    requestAnimationFrame(() => {
      node.focus();
      node.select();
    });
  }
</script>

{#each guides as g (g.id)}
  {@const midX = (g.x1 + g.x2) / 2}
  {@const midY = (g.y1 + g.y2) / 2}
  {@const isActive = editingId === g.id}
  <g class="group-guide">
    <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
          stroke="#0ea5e9" stroke-width="0.15" />
    {#if g.axis === 'x'}
      <line x1={g.x1} y1={g.y1 - 1} x2={g.x1} y2={g.y1 + 1} stroke="#0ea5e9" stroke-width="0.15" />
      <line x1={g.x2} y1={g.y2 - 1} x2={g.x2} y2={g.y2 + 1} stroke="#0ea5e9" stroke-width="0.15" />
    {:else}
      <line x1={g.x1 - 1} y1={g.y1} x2={g.x1 + 1} y2={g.y1} stroke="#0ea5e9" stroke-width="0.15" />
      <line x1={g.x2 - 1} y1={g.y2} x2={g.x2 + 1} y2={g.y2} stroke="#0ea5e9" stroke-width="0.15" />
    {/if}
    <g transform="translate({midX}, {midY}) scale(1, -1)">
      {#if isActive}
        <foreignObject x="-7" y="-2" width="14" height="4">
          <div xmlns="http://www.w3.org/1999/xhtml" class="dim-edit-wrap">
            <input class="group-edit-input" type="number" step="0.1" bind:value={editValue}
                   use:focusSelect
                   onpointerdown={stop} onclick={stop}
                   onkeydown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                   onblur={commitEdit} />
          </div>
        </foreignObject>
      {:else}
        <rect x="-5" y="-1.8" width="10" height="3.6" fill="white" fill-opacity="0.85" stroke="#0ea5e9" stroke-width="0.1" rx="0.6" />
        <text x="0" y="0" text-anchor="middle" dominant-baseline="middle"
              font-size="2.2" font-family="sans-serif" fill="#0369a1"
              onpointerdown={stop}
              onclick={(e) => { e.stopPropagation(); startEdit(g); }}
              style="cursor: pointer;">
          {g.distance.toFixed(1)}
        </text>
      {/if}
    </g>
  </g>
{/each}

<style>
  :global(.group-edit-input) {
    width: 100%; height: 100%;
    font-size: 2.2px; line-height: 1;
    padding: 0; margin: 0;
    border: 0.15px solid #0ea5e9; border-radius: 0.6px;
    box-sizing: border-box;
    font-family: sans-serif;
    background: white; color: #0369a1;
    text-align: center;
    outline: none;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  :global(.group-edit-input::-webkit-outer-spin-button),
  :global(.group-edit-input::-webkit-inner-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
</style>

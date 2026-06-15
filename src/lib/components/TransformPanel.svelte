<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<!-- src/lib/components/akse/TransformPanel.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { DEFAULT_COLORS } from '$lib/models';
  import { getAkseConfig } from '$lib/config';
  import { interpolate, type AkseTexts } from '$lib/texts';

  const config = getAkseConfig();

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);

  const selected = $derived(store.selectedShapes());
  const single = $derived(selected.length === 1 ? selected[0] : null);

  function patch(field: 'position' | 'rotation' | 'size', axis: 0 | 1 | 2, value: number) {
    if (!single) return;
    const newVec = [...single[field]] as [number, number, number];
    newVec[axis] = value;
    if (field === 'size') {
      // Bevar corner-posisjon (= position[axis] - size[axis]/2) når størrelse endres.
      // Center forskyves med halve delta, slik at venstre/bunn-kanten holdes fast.
      const oldSize = single.size[axis];
      const delta = (value - oldSize) / 2;
      const newPos = [...single.position] as [number, number, number];
      newPos[axis] = single.position[axis] + delta;
      store.updateShape(single.id, { size: newVec, position: newPos });
    } else {
      store.updateShape(single.id, { [field]: newVec });
    }
  }

  // Aksefarger (matcher scene-verktøylinjen) + normalisering for rotasjons-sliderne.
  const ROT_AXIS_COLORS = ['#d33', '#2a7', '#07c'];  // X, Y, Z
  function normRot(v: number): number {
    return ((v % 360) + 360) % 360;  // til [0, 360)
  }

  // Hjørne-koordinater = senter - size/2. Brukeren ser hjørnet av figuren, ikke senteret.
  function getCorner(axis: 0 | 1 | 2): number {
    if (!single) return 0;
    return Math.round(single.position[axis] - single.size[axis] / 2);
  }

  function patchCornerPosition(axis: 0 | 1 | 2, cornerValue: number) {
    if (!single) return;
    const newCenter = cornerValue + single.size[axis] / 2;
    const newPos = [...single.position] as [number, number, number];
    newPos[axis] = newCenter;
    store.updateShape(single.id, { position: newPos });
  }

  function patchColor(c: string) {
    if (!single) return;
    store.updateShape(single.id, { color: c });
  }

  function patchMode(m: 'solid' | 'hole') {
    for (const s of selected) store.updateShape(s.id, { mode: m });
  }

  function patchText(t: string) {
    if (!single || single.kind !== 'text') return;
    store.updateShape(single.id, { text: t });
  }

  // Gruppe-bounding-box (kun når 2+ valgt)
  type GroupBox = {
    cx: number; cy: number; cz: number;
    w: number; d: number; h: number;
    minX: number; minY: number; minZ: number;
  };

  const groupBox = $derived.by<GroupBox | null>(() => {
    if (selected.length < 2) return null;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const s of selected) {
      minX = Math.min(minX, s.position[0] - s.size[0] / 2);
      maxX = Math.max(maxX, s.position[0] + s.size[0] / 2);
      minY = Math.min(minY, s.position[1] - s.size[1] / 2);
      maxY = Math.max(maxY, s.position[1] + s.size[1] / 2);
      minZ = Math.min(minZ, s.position[2] - s.size[2] / 2);
      maxZ = Math.max(maxZ, s.position[2] + s.size[2] / 2);
    }
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX,
      d: maxY - minY,
      h: maxZ - minZ,
      minX, minY, minZ,
    };
  });

  function patchGroupCornerPosition(axis: 0 | 1 | 2, newCorner: number) {
    if (!groupBox) return;
    const oldCorner = axis === 0 ? groupBox.minX : axis === 1 ? groupBox.minY : groupBox.minZ;
    const delta = newCorner - oldCorner;
    if (delta === 0) return;
    for (const s of selected) {
      const newPos = [...s.position] as [number, number, number];
      newPos[axis] = s.position[axis] + delta;
      store.updateShape(s.id, { position: newPos });
    }
  }

  // --- Skaler (%) ---
  let scalePercent = $state(100);
  // Sketch-figurer får bredde/dybde fra sketchData — skalering må skje i Plantegning-editoren
  const scaleLocked = $derived(single?.kind === 'sketch');
  const r1 = (n: number) => Math.round(n * 10) / 10;

  function scaleFactor(): number | null {
    const pct = scalePercent;
    if (!Number.isFinite(pct) || pct <= 0) return null;
    const factor = pct / 100;
    return factor === 1 ? null : factor;
  }

  function applyScale() {
    if (!single || scaleLocked) return;
    const factor = scaleFactor();
    if (!factor) return;
    const newSize = single.size.map((v) => Math.max(1, r1(v * factor))) as [number, number, number];
    // Behold senter i X/Y og bunnen i Z, så figuren blir stående der den står
    const bottom = single.position[2] - single.size[2] / 2;
    const newPos: [number, number, number] = [
      single.position[0],
      single.position[1],
      bottom + newSize[2] / 2,
    ];
    store.updateShape(single.id, { size: newSize, position: newPos });
    scalePercent = 100;
  }

  function applyGroupScale() {
    if (!groupBox) return;
    const factor = scaleFactor();
    if (!factor) return;
    const { cx, cy, minZ } = groupBox;
    store.beginTransaction();
    for (const s of selected) {
      const newSize = s.size.map((v) => Math.max(1, r1(v * factor))) as [number, number, number];
      // Skaler posisjoner om gruppens senter i X/Y og gruppens bunn i Z
      const bottom = s.position[2] - s.size[2] / 2;
      const newPos: [number, number, number] = [
        r1(cx + (s.position[0] - cx) * factor),
        r1(cy + (s.position[1] - cy) * factor),
        r1(minZ + (bottom - minZ) * factor + newSize[2] / 2),
      ];
      store.updateShape(s.id, { size: newSize, position: newPos });
    }
    store.endTransaction();
    scalePercent = 100;
  }

  // --- Juster-matrise (3×3, sett ovenfra) ---
  // Rader topp→bunn på skjermen: «Topp» = bak i scenen (+Y), «Bunn» = foran (−Y).
  type AlignEdge = 'min' | 'mid' | 'max';
  const ALIGN_MATRIX: { x: AlignEdge; y: AlignEdge; labelKey: keyof AkseTexts }[] = [
    { x: 'min', y: 'max', labelKey: 'transformAlignTopLeft' },
    { x: 'mid', y: 'max', labelKey: 'transformAlignTopCenter' },
    { x: 'max', y: 'max', labelKey: 'transformAlignTopRight' },
    { x: 'min', y: 'mid', labelKey: 'transformAlignMiddleLeft' },
    { x: 'mid', y: 'mid', labelKey: 'transformAlignMiddleCenter' },
    { x: 'max', y: 'mid', labelKey: 'transformAlignMiddleRight' },
    { x: 'min', y: 'min', labelKey: 'transformAlignBottomLeft' },
    { x: 'mid', y: 'min', labelKey: 'transformAlignBottomCenter' },
    { x: 'max', y: 'min', labelKey: 'transformAlignBottomRight' },
  ];
  // Prikk-posisjon i ikonet (SVG viewBox 0–20): venstre/topp=6, midt=10, høyre/bunn=14
  const dotPos = (edge: AlignEdge, invert = false): number =>
    edge === 'mid' ? 10 : (edge === 'min') !== invert ? 6 : 14;

  // --- Live skalering via slider ---
  // Sliderens prosent regnes alltid relativt til størrelsen ved drag-start
  // (liveBase), ikke nåværende — ellers ville hver oninput komponere på forrige.
  let liveBase: Map<string, { size: [number, number, number]; position: [number, number, number] }> | null = null;
  let liveGroupBase: { cx: number; cy: number; minZ: number } | null = null;

  function beginLiveScale() {
    if (liveBase) return;  // allerede i gang
    if (single && scaleLocked) return;
    store.beginTransaction();
    liveBase = new Map(
      selected.map((s) => [
        s.id,
        { size: [...s.size] as [number, number, number], position: [...s.position] as [number, number, number] },
      ]),
    );
    liveGroupBase = groupBox ? { cx: groupBox.cx, cy: groupBox.cy, minZ: groupBox.minZ } : null;
  }

  function liveScale(pct: number) {
    if (!liveBase) return;
    if (!Number.isFinite(pct) || pct <= 0) return;
    const factor = pct / 100;
    for (const s of selected) {
      const base = liveBase.get(s.id);
      if (!base) continue;
      const newSize = base.size.map((v) => Math.max(1, r1(v * factor))) as [number, number, number];
      const bottom = base.position[2] - base.size[2] / 2;
      let newPos: [number, number, number];
      if (liveGroupBase) {
        const { cx, cy, minZ } = liveGroupBase;
        newPos = [
          r1(cx + (base.position[0] - cx) * factor),
          r1(cy + (base.position[1] - cy) * factor),
          r1(minZ + (bottom - minZ) * factor + newSize[2] / 2),
        ];
      } else {
        newPos = [base.position[0], base.position[1], bottom + newSize[2] / 2];
      }
      store.updateShape(s.id, { size: newSize, position: newPos });
    }
  }

  function endLiveScale() {
    if (!liveBase) return;
    store.endTransaction();
    liveBase = null;
    liveGroupBase = null;
    scalePercent = 100;  // slider tilbake til nøytral; resultatet er allerede committet
  }

  function patchGroupSize(axis: 0 | 1 | 2, newSize: number) {
    if (!groupBox) return;
    const oldSize = axis === 0 ? groupBox.w : axis === 1 ? groupBox.d : groupBox.h;
    if (oldSize <= 0 || newSize <= 0) return;
    const factor = newSize / oldSize;
    if (factor === 1) return;
    const center = axis === 0 ? groupBox.cx : axis === 1 ? groupBox.cy : groupBox.cz;
    for (const s of selected) {
      const newPos = [...s.position] as [number, number, number];
      const newSz = [...s.size] as [number, number, number];
      newPos[axis] = center + (s.position[axis] - center) * factor;
      newSz[axis] = Math.max(1, s.size[axis] * factor);
      store.updateShape(s.id, { position: newPos, size: newSz });
    }
  }

</script>

<div class="transform-panel">
  {#if selected.length === 0}
    <p class="empty">{config.texts.transformEmptyState}</p>
  {:else if single}
    <div class="panel-header">{config.texts.transformPropertiesHeader}</div>

    {#if single.kind === 'text'}
      <div class="prop-section">
        <h4 class="property-label">{config.texts.transformText}</h4>
        <input
          type="text"
          class="dim-input text-field"
          value={single.text ?? ''}
          oninput={(e) => patchText(e.currentTarget.value)}
        />
      </div>
    {/if}

    {#if single.kind === 'sketch'}
      <div class="prop-section">
        <button type="button" class="edit-sketch-btn" onclick={() => store.requestEditSketch(single.id)}>
          <i class="fa-solid fa-compass-drafting" aria-hidden="true"></i> {config.texts.transformEditSketch}
        </button>
      </div>
    {/if}

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformPositionLabel}</h4>
      <div class="vec3">
        {#each ['X', 'Y', 'Z'] as axis, i}
          <div class="dim-field">
            <label for="pos-{axis}">{axis}</label>
            <div class="input-row">
              {#if store.inputMode === 'touch'}
                <button type="button" class="step-btn" onclick={() => patchCornerPosition(i as 0|1|2, getCorner(i as 0|1|2) - 1)} aria-label={interpolate(config.texts.transformDecreaseAxis, { axis })}>−</button>
              {/if}
              <input
                id="pos-{axis}"
                type="number"
                step="1"
                class="dim-input"
                value={getCorner(i as 0|1|2)}
                oninput={(e) => patchCornerPosition(i as 0|1|2, Number(e.currentTarget.value))}
              />
              {#if store.inputMode === 'touch'}
                <button type="button" class="step-btn" onclick={() => patchCornerPosition(i as 0|1|2, getCorner(i as 0|1|2) + 1)} aria-label={interpolate(config.texts.transformIncreaseAxis, { axis })}>+</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformRotationLabel}</h4>
      <div class="snap-row">
        <span class="snap-label">{config.texts.transformSnap}</span>
        {#each [1, 22.5, 45, 90] as deg}
          <button
            type="button"
            class="snap-pill"
            class:active={store.rotateSnapDeg === deg}
            onclick={() => (store.rotateSnapDeg = deg)}
          >{deg}°</button>
        {/each}
      </div>
      <div class="rot-sliders">
        {#each ['X', 'Y', 'Z'] as axis, i}
          <div class="rot-slider-row">
            <span class="rot-axis" style:color={ROT_AXIS_COLORS[i]}>{axis}</span>
            <input
              type="range"
              min="0"
              max="360"
              step={store.rotateSnapDeg}
              style:accent-color={ROT_AXIS_COLORS[i]}
              value={normRot(single.rotation[i])}
              oninput={(e) => patch('rotation', i as 0|1|2, Number(e.currentTarget.value))}
              onfocus={() => store.beginTransaction()}
              onblur={() => store.endTransaction()}
              aria-label={interpolate(config.texts.transformRotateAxis, { axis })}
            />
            <input
              type="number"
              class="dim-input rot-deg-input"
              min="0"
              max="360"
              step="1"
              value={Math.round(normRot(single.rotation[i]))}
              oninput={(e) => patch('rotation', i as 0|1|2, Number(e.currentTarget.value))}
              aria-label={interpolate(config.texts.transformRotationAxisDegrees, { axis })}
            />
            <span class="rot-unit">°</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformSizeLabel}</h4>
      <div class="vec3">
        {#each ['B', 'D', 'H'] as axis, i}
          {@const sketchLocked = single.kind === 'sketch' && (i === 0 || i === 1)}
          <div class="dim-field">
            <label for="size-{axis}">{axis}</label>
            <div class="input-row">
              {#if store.inputMode === 'touch' && !sketchLocked}
                <button type="button" class="step-btn" onclick={() => patch('size', i as 0|1|2, Math.max(1, single.size[i] - 1))} aria-label={interpolate(config.texts.transformDecreaseSize, { axis })}>−</button>
              {/if}
              <input
                id="size-{axis}"
                type="number"
                step="1"
                min="1"
                class="dim-input"
                value={single.size[i]}
                disabled={sketchLocked}
                title={sketchLocked ? config.texts.transformSketchLockedTooltip : ''}
                oninput={(e) => patch('size', i as 0|1|2, Number(e.currentTarget.value))}
              />
              {#if store.inputMode === 'touch' && !sketchLocked}
                <button type="button" class="step-btn" onclick={() => patch('size', i as 0|1|2, single.size[i] + 1)} aria-label={interpolate(config.texts.transformIncreaseSize, { axis })}>+</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      {#if single.kind === 'sketch'}
        <p class="hint">{config.texts.transformSizeSketchHint}</p>
      {/if}
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformScaleLabel}</h4>
      <div class="scale-row">
        <input
          type="number"
          step="5"
          min="1"
          max="1000"
          class="dim-input"
          bind:value={scalePercent}
          disabled={scaleLocked}
          title={scaleLocked ? config.texts.transformScaleSketchLockedTooltip : config.texts.transformScalePercentTooltip}
          onkeydown={(e) => { if (e.key === 'Enter') applyScale(); }}
          aria-label={config.texts.transformScalePercent}
        />
        <button
          type="button"
          class="scale-apply-btn"
          onclick={applyScale}
          disabled={scaleLocked}
        >
          {config.texts.transformScaleApply}
        </button>
      </div>
      <div class="scale-slider-row">
        <span class="scale-slider-label">50%</span>
        <input
          type="range"
          min="50"
          max="300"
          step="1"
          value={scalePercent}
          disabled={scaleLocked}
          oninput={(e) => { scalePercent = Number(e.currentTarget.value); liveScale(scalePercent); }}
          onfocus={beginLiveScale}
          onblur={endLiveScale}
          aria-label={config.texts.transformScaleSlider}
        />
        <span class="scale-slider-label">300%</span>
      </div>
      {#if scaleLocked}
        <p class="hint">{config.texts.transformScaleSketchHint}</p>
      {:else}
        <p class="hint">{config.texts.transformScaleHint}</p>
      {/if}
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformModeLabel} <span class="hotkey-hint">{config.texts.transformModeHotkey}</span></h4>
      <label class="toggle-row mode-toggle-row">
        <span class="mode-option" class:active={single.mode === 'solid'}>{config.texts.transformSolid}</span>
        <button
          type="button"
          class="toggle-switch"
          class:on={single.mode === 'hole'}
          aria-label={config.texts.transformToggleSolidHole}
          aria-pressed={single.mode === 'hole'}
          onclick={() => patchMode(single.mode === 'hole' ? 'solid' : 'hole')}
        >
          <span class="toggle-slider"></span>
        </button>
        <span class="mode-option" class:active={single.mode === 'hole'}>{config.texts.transformHole}</span>
      </label>
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformColorLabel}</h4>
      <div class="color-grid">
        {#each DEFAULT_COLORS as c}
          <button
            type="button"
            class="color-swatch"
            class:active={single.color === c}
            style="background: {c};"
            aria-label={interpolate(config.texts.transformColorSwatch, { color: c })}
            title={c}
            onclick={() => patchColor(c)}
          ></button>
        {/each}
      </div>
      <input
        type="color"
        class="color-input-fallback"
        value={single.color}
        oninput={(e) => patchColor(e.currentTarget.value)}
        title={config.texts.transformCustomColor}
        aria-label={config.texts.transformCustomColor}
      />
    </div>
  {:else if groupBox}
    <div class="panel-header">{interpolate(config.texts.transformMultiSelectHeader, { count: selected.length })}</div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformGroupPositionLabel}</h4>
      <div class="vec3">
        {#each ['X', 'Y', 'Z'] as axis, i}
          <div class="dim-field">
            <label for="gpos-{axis}">{axis}</label>
            <input
              id="gpos-{axis}"
              type="number"
              step="1"
              class="dim-input"
              value={Math.round(i === 0 ? groupBox.minX : i === 1 ? groupBox.minY : groupBox.minZ)}
              oninput={(e) => patchGroupCornerPosition(i as 0|1|2, Number(e.currentTarget.value))}
            />
          </div>
        {/each}
      </div>
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformGroupSizeLabel}</h4>
      <div class="vec3">
        {#each ['B', 'D', 'H'] as axis, i}
          <div class="dim-field">
            <label for="gsize-{axis}">{axis}</label>
            <input
              id="gsize-{axis}"
              type="number"
              step="1"
              min="1"
              class="dim-input"
              value={Math.round(i === 0 ? groupBox.w : i === 1 ? groupBox.d : groupBox.h)}
              oninput={(e) => patchGroupSize(i as 0|1|2, Number(e.currentTarget.value))}
            />
          </div>
        {/each}
      </div>
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformAlignLabel}</h4>
      <div class="align-matrix" role="group" aria-label={config.texts.transformAlignGroup}>
        {#each ALIGN_MATRIX as cell (cell.labelKey)}
          <button
            type="button"
            class="matrix-btn"
            disabled={store.readOnly}
            onclick={() => store.alignSelectedXY(cell.x, cell.y)}
            onmouseenter={() => store.previewAlignXY(cell.x, cell.y)}
            onmouseleave={() => store.clearAlignPreview()}
            onfocus={() => store.previewAlignXY(cell.x, cell.y)}
            onblur={() => store.clearAlignPreview()}
            title={config.texts[cell.labelKey]}
            aria-label={config.texts[cell.labelKey]}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <rect x="2" y="2" width="16" height="16" rx="2"
                    fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4" />
              {#if cell.x !== 'mid' || cell.y !== 'mid'}
                <circle cx="10" cy="10" r="1.2" fill="currentColor" opacity="0.3" />
              {/if}
              <circle cx={dotPos(cell.x)} cy={dotPos(cell.y, true)} r="2.6" fill="currentColor" />
            </svg>
          </button>
        {/each}
      </div>
      {#if selected.length >= 3}
        <h4 class="property-label distribute-label">{config.texts.transformDistributeLabel}</h4>
        <div class="distribute-row">
          <button
            type="button"
            class="align-btn"
            disabled={store.readOnly}
            onclick={() => store.distributeSelected(0)}
            onmouseenter={() => store.previewDistribute(0)}
            onmouseleave={() => store.clearAlignPreview()}
            onfocus={() => store.previewDistribute(0)}
            onblur={() => store.clearAlignPreview()}
            title={config.texts.transformDistributeWidthTooltip}
          >
            {config.texts.transformDistributeWidth}
          </button>
          <button
            type="button"
            class="align-btn"
            disabled={store.readOnly}
            onclick={() => store.distributeSelected(1)}
            onmouseenter={() => store.previewDistribute(1)}
            onmouseleave={() => store.clearAlignPreview()}
            onfocus={() => store.previewDistribute(1)}
            onblur={() => store.clearAlignPreview()}
            title={config.texts.transformDistributeDepthTooltip}
          >
            {config.texts.transformDistributeDepth}
          </button>
        </div>
      {/if}
    </div>

    <div class="prop-section">
      <h4 class="property-label">{config.texts.transformGroupScaleLabel}</h4>
      <div class="scale-row">
        <input
          type="number"
          step="5"
          min="1"
          max="1000"
          class="dim-input"
          bind:value={scalePercent}
          title={config.texts.transformGroupScaleTooltip}
          onkeydown={(e) => { if (e.key === 'Enter') applyGroupScale(); }}
          aria-label={config.texts.transformGroupScalePercent}
        />
        <button type="button" class="scale-apply-btn" onclick={applyGroupScale}>
          {config.texts.transformGroupScaleApply}
        </button>
      </div>
      <div class="scale-slider-row">
        <span class="scale-slider-label">50%</span>
        <input
          type="range"
          min="50"
          max="300"
          step="1"
          value={scalePercent}
          oninput={(e) => { scalePercent = Number(e.currentTarget.value); liveScale(scalePercent); }}
          onfocus={beginLiveScale}
          onblur={endLiveScale}
          aria-label={config.texts.transformGroupScaleSlider}
        />
        <span class="scale-slider-label">300%</span>
      </div>
      <p class="hint">{config.texts.transformGroupScaleHint}</p>
    </div>

  {/if}
</div>

<style>
  .edit-sketch-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    color: #92400e;
    border-radius: var(--akse-radius-sm, 8px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .edit-sketch-btn:hover {
    background: #fef3c7;
    box-shadow: var(--akse-shadow-sm);
  }
  .hint {
    margin: 4px 0 0 0;
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  input.dim-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-secondary, #f5f5f5);
  }

  .transform-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    color: var(--text-primary);
    font-size: 0.85rem;
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .panel-header::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: var(--primary-color);
  }
  .empty {
    color: var(--text-secondary);
    font-style: italic;
    margin: 0;
  }

  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .property-label {
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
    margin: 0 0 0.25rem 0;
  }
  .hotkey-hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
  }

  .vec3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }
  .dim-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .dim-field label {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  .dim-input {
    width: 100%;
    font-size: 0.8rem;
    padding: 5px 7px;
    border: 1px solid var(--border-color);
    border-radius: var(--akse-radius-sm, 8px);
    background: var(--card-bg);
    color: var(--text-primary);
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .dim-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg));
  }
  .text-field {
    width: 100%;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .step-btn {
    width: 24px;
    height: 28px;
    padding: 0;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--akse-radius-sm, 8px);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    transition: filter 0.15s, transform 0.1s;
  }
  .step-btn:hover { filter: brightness(1.1); }
  .step-btn:active { transform: scale(0.92); }

  .align-matrix {
    display: grid;
    grid-template-columns: repeat(3, 34px);
    gap: 4px;
    justify-content: start;
  }
  .matrix-btn {
    width: 34px;
    height: 34px;
    padding: 4px;
    background: var(--bg-secondary, #f4f6fb);
    border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .matrix-btn svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .matrix-btn:hover:not(:disabled) {
    background: var(--primary-light-bg);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  .matrix-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .align-btn {
    padding: 5px 2px;
    background: var(--bg-secondary, #f4f6fb);
    border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    color: var(--text-primary);
    font-size: 0.7rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .align-btn:hover:not(:disabled) {
    background: var(--primary-light-bg);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  .align-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .distribute-label {
    margin-top: 0.5rem;
  }
  .distribute-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .scale-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .scale-row .dim-input {
    flex: 1;
  }
  .scale-apply-btn {
    padding: 6px 14px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .scale-apply-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .scale-apply-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .scale-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .scale-slider-row input[type='range'] {
    flex: 1;
    cursor: pointer;
    min-width: 0;
    accent-color: var(--primary-color);
  }
  .scale-slider-row input[type='range']:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
  .scale-slider-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: var(--text-primary);
  }
  .mode-toggle-row {
    cursor: pointer;
  }
  .mode-option {
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    padding-bottom: 1px;
    transition: color 0.2s, border-color 0.2s;
  }
  .mode-option.active {
    color: var(--primary-color);
    font-weight: 600;
    border-bottom-color: var(--primary-color);
  }
  .toggle-switch {
    position: relative;
    width: 40px;
    height: 22px;
    background: #cbd5e1;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.2s;
    padding: 0;
  }
  .toggle-switch.on {
    background: var(--primary-color);
  }
  .toggle-switch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg));
  }
  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
    transition: left 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .toggle-switch.on .toggle-slider {
    left: 20px;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
  }
  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--akse-radius-sm, 8px);
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s;
    padding: 0;
  }
  .color-swatch:hover {
    transform: scale(1.08);
    box-shadow: var(--akse-shadow-sm);
  }
  .color-swatch.active {
    border-color: var(--card-bg);
    box-shadow: 0 0 0 2px var(--primary-color);
  }
  .color-input-fallback {
    margin-top: 4px;
    width: 100%;
    height: 28px;
    border: 1px solid var(--border-color);
    border-radius: var(--akse-radius-sm, 8px);
    cursor: pointer;
    padding: 2px;
    background: var(--card-bg);
  }

  /* Rotasjons-slidere (X/Y/Z) under tall-feltene. */
  .rot-sliders {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .rot-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rot-slider-row .rot-axis {
    width: 12px;
    font-weight: 700;
    font-size: 0.8rem;
    text-align: center;
  }
  .rot-slider-row input[type='range'] {
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }
  .rot-deg-input {
    width: 52px;
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .rot-unit {
    font-size: 0.78rem;
    color: var(--text-secondary, #64748b);
  }

  /* Snap-piller — samme visuelle språk som scene-verktøylinjen */
  .snap-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }
  .snap-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    margin-right: 4px;
  }
  .snap-pill {
    padding: 3px 9px;
    background: var(--bg-secondary, #f4f6fb);
    border: 1px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--text-primary);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .snap-pill:hover {
    background: var(--akse-tint, var(--primary-light-bg));
    border-color: var(--akse-ring, var(--primary-color));
    color: var(--primary-color);
  }
  .snap-pill.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
</style>

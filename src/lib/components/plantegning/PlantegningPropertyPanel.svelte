<script lang="ts">
  import { getContext } from 'svelte';
  import type { SketchStore } from '$lib/akse/plantegning/SketchStore.svelte';
  import type { SketchFigure } from '$lib/akse/plantegning/sketchTypes';

  const store = getContext<SketchStore>('sketchStore');
  const inputModeGetter = getContext<() => 'pointer' | 'touch'>('inputMode');
  let inputMode = $derived(inputModeGetter ? inputModeGetter() : 'pointer');

  let selectedFigures = $derived(
    store.figures.filter(f => store.selectedIds.has(f.id)),
  );

  let single = $derived(selectedFigures.length === 1 ? selectedFigures[0] : null);
  let multi = $derived(selectedFigures.length > 1);
  let isGrouped = $derived(!!single?.groupId);

  function updateNumber(field: keyof SketchFigure, value: number) {
    if (!single) return;
    store.updateFigure(single.id, { [field]: value } as Partial<SketchFigure>);
  }

  function updatePos(axis: 'x' | 'y', value: number) {
    if (!single) return;
    store.updateFigure(single.id, {
      position: { ...single.position, [axis]: value },
    });
  }

  function setMode(mode: 'solid' | 'hole') {
    if (!single) return;
    if (single.mode === mode) return;
    store.toggleMode();
  }

  // Justering (multi-select)
  function alignLeft() {
    const minX = Math.min(...selectedFigures.map(f => f.position.x));
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: minX, y: f.position.y } });
    }
  }
  function alignRight() {
    const maxX = Math.max(...selectedFigures.map(f => f.position.x));
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: maxX, y: f.position.y } });
    }
  }
  function alignTop() {
    const maxY = Math.max(...selectedFigures.map(f => f.position.y));
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: f.position.x, y: maxY } });
    }
  }
  function alignBottom() {
    const minY = Math.min(...selectedFigures.map(f => f.position.y));
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: f.position.x, y: minY } });
    }
  }
  function centerH() {
    const xs = selectedFigures.map(f => f.position.x);
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: center, y: f.position.y } });
    }
  }
  function centerV() {
    const ys = selectedFigures.map(f => f.position.y);
    const center = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const f of selectedFigures) {
      store.updateFigure(f.id, { position: { x: f.position.x, y: center } });
    }
  }

  function setPolygonMode(star: boolean) {
    if (!single || single.kind !== 'polygon') return;
    if (star) {
      // Sett innerRadius til ~50% av outer ved første aktivering
      const ir = single.innerRadius ?? (single.radius ?? 10) * 0.5;
      store.updateFigure(single.id, { starMode: true, innerRadius: ir });
    } else {
      store.updateFigure(single.id, { starMode: false });
    }
  }

  function presetTriangle(kind: 'equilateral' | 'rightLeft' | 'rightRight') {
    if (!single || single.kind !== 'triangle') return;
    const w = single.width ?? 20;
    switch (kind) {
      case 'equilateral':
        store.updateFigure(single.id, {
          height: Math.round((w * Math.sqrt(3)) / 2 * 10) / 10,
          apexX: 0,
        });
        return;
      case 'rightLeft':
        store.updateFigure(single.id, { apexX: -w / 2 });
        return;
      case 'rightRight':
        store.updateFigure(single.id, { apexX: w / 2 });
        return;
    }
  }

  function stepValue(field: keyof SketchFigure, delta: number) {
    if (!single) return;
    const current = (single[field] as number) ?? 0;
    updateNumber(field, current + delta);
  }
</script>

<div class="panel">
  <h3>Egenskaper</h3>
  {#if !single && !multi}
    <p class="empty">Velg en figur for å redigere</p>
  {:else if single}
    <div class="grid">
      <label>X (mm)
        <div class="num-wrap">
          {#if inputMode === 'touch'}
            <button class="step" onclick={() => updatePos('x', single.position.x - 1)}>−</button>
          {/if}
          <input type="number" step="0.1" value={single.position.x.toFixed(2)}
                 oninput={(e) => updatePos('x', +e.currentTarget.value)} />
          {#if inputMode === 'touch'}
            <button class="step" onclick={() => updatePos('x', single.position.x + 1)}>+</button>
          {/if}
        </div>
      </label>
      <label>Y (mm)
        <div class="num-wrap">
          {#if inputMode === 'touch'}
            <button class="step" onclick={() => updatePos('y', single.position.y - 1)}>−</button>
          {/if}
          <input type="number" step="0.1" value={single.position.y.toFixed(2)}
                 oninput={(e) => updatePos('y', +e.currentTarget.value)} />
          {#if inputMode === 'touch'}
            <button class="step" onclick={() => updatePos('y', single.position.y + 1)}>+</button>
          {/if}
        </div>
      </label>

      {#if single.kind === 'rectangle' || single.kind === 'roundedRect' || single.kind === 'triangle'}
        <label>B (mm)
          <div class="num-wrap">
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('width', -1)}>−</button>
            {/if}
            <input type="number" step="0.1" min="0.1" value={(single.width ?? 0).toFixed(2)}
                   disabled={isGrouped}
                   title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                   oninput={(e) => updateNumber('width', +e.currentTarget.value)} />
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('width', 1)}>+</button>
            {/if}
          </div>
        </label>
        <label>H (mm)
          <div class="num-wrap">
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('height', -1)}>−</button>
            {/if}
            <input type="number" step="0.1" min="0.1" value={(single.height ?? 0).toFixed(2)}
                   disabled={isGrouped}
                   title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                   oninput={(e) => updateNumber('height', +e.currentTarget.value)} />
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('height', 1)}>+</button>
            {/if}
          </div>
        </label>
      {/if}
      {#if single.kind === 'roundedRect'}
        <label>Hjørne-r (mm)
          <input type="number" step="0.1" min="0" value={(single.cornerRadius ?? 0).toFixed(2)}
                 disabled={isGrouped}
                 title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                 oninput={(e) => updateNumber('cornerRadius', +e.currentTarget.value)} />
        </label>
      {/if}
      {#if single.kind === 'circle' || single.kind === 'polygon'}
        <label>Radius (mm)
          <div class="num-wrap">
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('radius', -1)}>−</button>
            {/if}
            <input type="number" step="0.1" min="0.1" value={(single.radius ?? 0).toFixed(2)}
                   disabled={isGrouped}
                   title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                   oninput={(e) => updateNumber('radius', +e.currentTarget.value)} />
            {#if inputMode === 'touch' && !isGrouped}
              <button class="step" onclick={() => stepValue('radius', 1)}>+</button>
            {/if}
          </div>
        </label>
      {/if}
      {#if single.kind === 'polygon'}
        <label>{single.starMode ? 'Tagger' : 'Sider'}
          <input type="number" step="1" min="3" max="12" value={single.sides ?? 6}
                 disabled={isGrouped}
                 title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                 oninput={(e) => updateNumber('sides', +e.currentTarget.value)} />
        </label>
        {#if single.starMode}
          <label>Innerradius (mm)
            <input type="number" step="0.1" min="0.1"
                   value={(single.innerRadius ?? (single.radius ?? 10) * 0.5).toFixed(2)}
                   disabled={isGrouped}
                   title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                   oninput={(e) => updateNumber('innerRadius', +e.currentTarget.value)} />
          </label>
        {/if}
      {/if}
      {#if single.kind === 'triangle'}
        <label class="span-2">Topp-X (mm)
          <input type="number" step="0.1" value={(single.apexX ?? 0).toFixed(2)}
                 disabled={isGrouped}
                 title={isGrouped ? 'Avgrupper først for å endre størrelse' : 'Toppens X-offset fra base-sentrum'}
                 oninput={(e) => updateNumber('apexX', +e.currentTarget.value)} />
        </label>
      {/if}
      {#if single.kind === 'ellipse'}
        <label>Radius X (mm)
          <input type="number" step="0.1" min="0.1" value={(single.radiusX ?? 0).toFixed(2)}
                 disabled={isGrouped}
                 title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                 oninput={(e) => updateNumber('radiusX', +e.currentTarget.value)} />
        </label>
        <label>Radius Y (mm)
          <input type="number" step="0.1" min="0.1" value={(single.radiusY ?? 0).toFixed(2)}
                 disabled={isGrouped}
                 title={isGrouped ? 'Avgrupper først for å endre størrelse' : ''}
                 oninput={(e) => updateNumber('radiusY', +e.currentTarget.value)} />
        </label>
      {/if}

      {#if isGrouped}
        <p class="grouped-hint"><i class="fa-solid fa-object-group" aria-hidden="true"></i> I gruppe — avgrupper for å endre størrelse</p>
      {/if}

      <label>Rotasjon (°)
        <input type="number" step="1" value={single.rotation.toFixed(0)}
               oninput={(e) => updateNumber('rotation', +e.currentTarget.value)} />
      </label>
    </div>

    {#if single.kind === 'triangle' && !isGrouped}
      <div class="presets">
        <div class="presets-label">Standardtrekanter</div>
        <div class="presets-row">
          <button type="button" class="preset-btn" title="Likesidet (60-60-60)" onclick={() => presetTriangle('equilateral')}>△</button>
          <button type="button" class="preset-btn" title="Rettvinklet venstre" onclick={() => presetTriangle('rightLeft')}>◣</button>
          <button type="button" class="preset-btn" title="Rettvinklet høyre" onclick={() => presetTriangle('rightRight')}>◢</button>
        </div>
      </div>
    {/if}

    {#if single.kind === 'polygon' && !isGrouped}
      <div class="presets">
        <div class="presets-label">Form</div>
        <div class="presets-row two-col">
          <button type="button" class="preset-btn" class:active={!single.starMode}
                  title="Regulær n-kant" onclick={() => setPolygonMode(false)}>⬡ Normal</button>
          <button type="button" class="preset-btn" class:active={single.starMode}
                  title="Stjerne med valgt antall tagger" onclick={() => setPolygonMode(true)}>★ Stjerne</button>
        </div>
      </div>
    {/if}

    <fieldset class="mode">
      <legend>Modus</legend>
      <label><input type="radio" name="mode" value="solid" checked={single.mode === 'solid'} onchange={() => setMode('solid')} /> Solid</label>
      <label><input type="radio" name="mode" value="hole" checked={single.mode === 'hole'} onchange={() => setMode('hole')} /> Hull</label>
    </fieldset>
  {:else if multi}
    <p class="multi-info">{selectedFigures.length} figurer valgt</p>
    <div class="align-grid">
      <button onclick={alignLeft}    title="Venstre-juster">⟸</button>
      <button onclick={centerH}      title="Sentrer horisontalt">⇔</button>
      <button onclick={alignRight}   title="Høyre-juster">⟹</button>
      <button onclick={alignTop}     title="Topp-juster">⤒</button>
      <button onclick={centerV}      title="Sentrer vertikalt">⇕</button>
      <button onclick={alignBottom}  title="Bunn-juster">⤓</button>
    </div>
  {/if}

  <hr />

  <label class="height">3D-høyde (mm)
    <input type="number" step="0.5" min="0.5" bind:value={store.extrudeHeight} />
  </label>
</div>

<style>
  .panel {
    padding: 12px; display: flex; flex-direction: column; gap: 12px;
    overflow-y: auto;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
  }
  .panel h3 {
    margin: 0; font-size: 12px; font-weight: 700;
    color: var(--text-secondary, #6b7280);
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .empty, .multi-info { color: #9ca3af; font-size: 13px; }
  .grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  }
  label {
    display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6b7280;
  }
  input[type="number"] {
    padding: 6px 8px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    font-size: 14px; font-family: inherit;
    width: 100%; box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type="number"]:focus {
    outline: none; border-color: var(--primary-color, #2563eb);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg, #e8f0fe));
  }
  input[type="number"]:disabled {
    background: #f3f4f6; color: #9ca3af; cursor: not-allowed;
  }
  label.span-2 {
    grid-column: 1 / -1;
  }
  .presets {
    display: flex; flex-direction: column; gap: 4px;
  }
  .presets-label {
    font-size: 12px; color: #6b7280;
  }
  .presets-row {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
  }
  .presets-row.two-col {
    grid-template-columns: 1fr 1fr;
  }
  .preset-btn {
    padding: 6px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px); cursor: pointer;
    background: white; font-size: 14px; line-height: 1; font-family: inherit;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .preset-btn:hover { background: var(--akse-tint, #e8f0fe); color: var(--primary-color, #2563eb); }
  .preset-btn.active {
    background: var(--primary-color, #2563eb);
    border-color: var(--primary-color, #2563eb);
    color: white;
  }
  .grouped-hint {
    grid-column: 1 / -1;
    margin: 4px 0 0 0;
    font-size: 11px; color: #0369a1;
    background: #ecfeff;
    padding: 5px 8px;
    border-radius: var(--akse-radius-sm, 8px);
    border: 1px solid #bae6fd;
  }
  .num-wrap { display: flex; align-items: center; gap: 4px; }
  .num-wrap input { flex: 1; min-width: 0; }
  .step {
    width: 32px; height: 32px; font-size: 18px;
    border: 1px solid var(--border-color, #e3e8f0); background: white; cursor: pointer;
    border-radius: var(--akse-radius-sm, 8px);
    padding: 0;
    transition: background 0.15s, transform 0.1s;
  }
  .step:hover { background: var(--akse-tint, #e8f0fe); }
  .step:active { transform: scale(0.92); }
  fieldset.mode {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: var(--akse-radius-sm, 8px); padding: 8px;
    display: flex; gap: 12px;
  }
  fieldset legend { font-size: 12px; color: #6b7280; padding: 0 4px; }
  fieldset label { flex-direction: row; align-items: center; gap: 4px; font-size: 13px; }
  fieldset input[type="radio"] { accent-color: var(--primary-color, #2563eb); }
  .align-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
  }
  .align-grid button {
    padding: 8px; border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px); cursor: pointer;
    background: var(--bg-secondary, #f4f6fb); font-size: 16px;
    transition: background 0.15s, color 0.15s;
  }
  .align-grid button:hover { background: var(--akse-tint, #e8f0fe); color: var(--primary-color, #2563eb); }
  hr { border: none; border-top: 1px solid var(--border-color, #e5e7eb); }
  .height { font-size: 12px; }
</style>

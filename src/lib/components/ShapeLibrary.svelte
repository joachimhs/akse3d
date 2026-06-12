<!-- src/lib/components/akse/ShapeLibrary.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import type { ShapeKind } from '$lib/models';
  import ScribbleEditor from './ScribbleEditor.svelte';
  import PlantegningEditor from './plantegning/PlantegningEditor.svelte';
  import type { SketchData } from '$lib/akse/plantegning/sketchTypes';
  import { DEFAULT_EXTRUDE_HEIGHT_MM } from '$lib/akse/plantegning/sketchTypes';
  import { parseStl } from '$lib/akse/stlImport';
  import { getAkseConfig } from '$lib/config';

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);
  const config = getAkseConfig();

  // Tegneverktøyene bruker FontAwesome; grunnfigurene bruker inline-SVG-er
  // (samme ikoner som på landingssiden) med tre fylltoner styrt via CSS.
  type Figure = {
    kind: ShapeKind;
    label: string;
    icon?: string;        // FontAwesome class (uten "fa-solid")
    iconStyle?: string;   // ekstra inline-stil (rotasjon osv.)
    svg?: string;         // inline-SVG-innhold (viewBox 0 0 64 64)
    hotkey?: string;      // tastatursnarvei (stor bokstav); understrekes i label
  };

  const drawingTools: Figure[] = [
    { kind: 'scribble', label: 'Tegning',     icon: 'fa-pencil' },
    { kind: 'sketch',   label: 'Plantegning', icon: 'fa-drafting-compass' },
    { kind: 'text',     label: 'Tekst',       icon: 'fa-font' },
  ];

  // Fylltoner: f-mid = hovedflate, f-light = topp/lysflate, f-dark = skyggeflate.
  // Fargene settes i CSS (via :global siden innholdet injiseres med {@html}).
  const shapeSvgs: Record<string, string> = {
    box: '<path class="f-mid" d="M32 8 54 19v22L32 52 10 41V19z"/><path class="f-light" d="M32 8 54 19 32 30 10 19z"/><path class="f-dark" d="M32 30v22L10 41V19z"/>',
    cylinder: '<rect class="f-mid" x="16" y="16" width="32" height="32"/><ellipse class="f-dark" cx="32" cy="48" rx="16" ry="7"/><ellipse class="f-light" cx="32" cy="16" rx="16" ry="7"/>',
    sphere: '<circle class="f-mid" cx="32" cy="32" r="22"/><ellipse class="f-light" cx="25" cy="25" rx="8" ry="5" transform="rotate(-30 25 25)"/>',
    cone: '<path class="f-mid" d="M32 8 50 48H14z"/><ellipse class="f-dark" cx="32" cy="48" rx="18" ry="7"/>',
    pyramid: '<path class="f-mid" d="M32 8 54 48H10z"/><path class="f-dark" d="M32 8 54 48 32 42z"/>',
    wedge: '<path class="f-mid" d="M10 50V22l44 28z"/><path class="f-dark" d="M10 50h44L10 22z" opacity=".45"/>',
    torus: '<path class="f-mid" fill-rule="evenodd" d="M32 10a22 22 0 1 0 0 44 22 22 0 0 0 0-44Zm0 13a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z"/>',
  };

  // Hotkeys: K/S er opptatt av forbokstav-kollisjoner (Kube/Kule/Kjegle/Kile,
  // Sylinder/Smultring) — bruk en distinkt bokstav fra hvert ord, understreket i label.
  // T og R er reservert av scene-snarveiene (flytt/roter gizmo).
  const primitives: Figure[] = [
    { kind: 'box',      label: 'Kube',      svg: shapeSvgs.box,      hotkey: 'K' },
    { kind: 'cylinder', label: 'Sylinder',  svg: shapeSvgs.cylinder, hotkey: 'S' },
    { kind: 'sphere',   label: 'Kule',      svg: shapeSvgs.sphere,   hotkey: 'U' },
    { kind: 'cone',     label: 'Kjegle',    svg: shapeSvgs.cone,     hotkey: 'J' },
    { kind: 'pyramid',  label: 'Pyramide',  svg: shapeSvgs.pyramid,  hotkey: 'P' },
    { kind: 'wedge',    label: 'Kile',      svg: shapeSvgs.wedge,    hotkey: 'I' },
    { kind: 'torus',    label: 'Smultring', svg: shapeSvgs.torus,    hotkey: 'M' },
  ];

  /** Del label i [før, hotkey-bokstav, etter] for understreking. */
  function splitLabel(label: string, hotkey?: string): [string, string, string] {
    if (!hotkey) return [label, '', ''];
    const idx = label.toUpperCase().indexOf(hotkey);
    if (idx === -1) return [label, '', ''];
    return [label.slice(0, idx), label[idx], label.slice(idx + 1)];
  }

  function handleHotkey(e: KeyboardEvent) {
    if (store.readOnly) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (showScribbleEditor || showPlantegningEditor) return;
    const t = e.target as HTMLElement | null;
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t && t.isContentEditable)
    ) return;
    const fig = primitives.find((f) => f.hotkey === e.key.toUpperCase());
    if (!fig) return;
    e.preventDefault();
    add(fig.kind);  // samme som klikk: toggler place-mode for figuren
  }

  let showScribbleEditor = $state(false);
  let showPlantegningEditor = $state(false);
  let plantegningInitialData = $state<SketchData | null>(null);
  let plantegningEditingId = $state<string | null>(null);

  function add(kind: ShapeKind) {
    if (store.readOnly) return;
    if (kind === 'scribble') {
      showScribbleEditor = true;
      return;
    }
    if (kind === 'sketch') {
      plantegningInitialData = {
        figures: [],
        extrudeHeight: DEFAULT_EXTRUDE_HEIGHT_MM,
      };
      plantegningEditingId = null;
      showPlantegningEditor = true;
      return;
    }
    if (store.pendingShapeKind === kind) {
      store.setPendingShape(null);
    } else {
      store.setPendingShape(kind);
    }
  }

  function handleScribbleCommit(paths: number[][], fill: boolean) {
    store.addScribbleShape(paths, fill);
    showScribbleEditor = false;
  }

  function handlePlantegningCommit(data: SketchData) {
    if (plantegningEditingId) {
      store.updateSketchShape(plantegningEditingId, data);
    } else {
      store.addSketchShape(data);
    }
    showPlantegningEditor = false;
    plantegningInitialData = null;
    plantegningEditingId = null;
  }

  let stlInput: HTMLInputElement;

  // Trekant-antall der CSG og visning begynner å hakke merkbart
  const STL_TRIANGLE_WARN_LIMIT = 100_000;

  const fmtCount = (n: number) => Math.round(n).toLocaleString('nb-NO');

  async function handleStlFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';  // tillat re-import av samme fil
    if (!file || store.readOnly) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseStl(buffer);
      if (parsed.triangleCount === 0) {
        alert('Fant ingen trekanter i STL-filen.');
        return;
      }
      // Hard grense satt av host (lagringshensyn — meshen lagres i prosjekt-JSON-en)
      if (parsed.triangleCount > config.maxStlTriangles) {
        alert(
          `Modellen har ${fmtCount(parsed.triangleCount)} trekanter — grensen her er ` +
          `${fmtCount(config.maxStlTriangles)}. Forenkle modellen (f.eks. med «decimate» ` +
          `i et 3D-program eller i sliceren) og prøv igjen.`,
        );
        return;
      }
      if (
        parsed.triangleCount > STL_TRIANGLE_WARN_LIMIT &&
        !confirm(
          `Modellen har ${fmtCount(parsed.triangleCount)} trekanter ` +
          `og kan gjøre Akse treg. Vil du importere likevel?`,
        )
      ) {
        return;
      }
      store.addStlShape(parsed, file.name.replace(/\.stl$/i, ''));
    } catch (err) {
      console.error('STL-import feilet:', err);
      alert('Kunne ikke lese STL-filen. Sjekk at den er en gyldig STL.');
    }
  }

  // Observer store.editingSketchId og åpne editor når den settes.
  $effect(() => {
    const id = store.editingSketchId;
    if (!id) return;
    const shape = store.project.shapes.find(s => s.id === id);
    if (!shape || !shape.sketchData) {
      store.editingSketchId = null;
      return;
    }
    plantegningInitialData = shape.sketchData;
    plantegningEditingId = id;
    showPlantegningEditor = true;
    // Clear flagget — modalen er åpen nå
    store.editingSketchId = null;
  });
</script>

<svelte:window onkeydown={handleHotkey} />

<div class="shape-library">
  <h3 class="property-label">Tegneverktøy</h3>
  <div class="figure-grid">
    {#each drawingTools as fig}
      <button
        type="button"
        class="figure-btn"
        class:active={store.pendingShapeKind === fig.kind}
        onclick={() => add(fig.kind)}
        disabled={store.readOnly}
        title={fig.label}
      >
        {#if fig.svg}
          <svg class="icon shape-icon" viewBox="0 0 64 64" aria-hidden="true">{@html fig.svg}</svg>
        {:else if fig.icon}
          <i class="fa-solid {fig.icon} icon" style={fig.iconStyle ?? ''}></i>
        {/if}
        <span class="label">{fig.label}</span>
      </button>
    {/each}
  </div>

  <h3 class="property-label">Grunnfigurer</h3>
  <div class="figure-grid">
    {#each primitives as fig}
      {@const [pre, hot, post] = splitLabel(fig.label, fig.hotkey)}
      <button
        type="button"
        class="figure-btn"
        class:active={store.pendingShapeKind === fig.kind}
        onclick={() => add(fig.kind)}
        disabled={store.readOnly}
        title={fig.hotkey ? `${fig.label} (tast ${fig.hotkey})` : fig.label}
      >
        {#if fig.svg}
          <svg class="icon shape-icon" viewBox="0 0 64 64" aria-hidden="true">{@html fig.svg}</svg>
        {:else if fig.icon}
          <i class="fa-solid {fig.icon} icon" style={fig.iconStyle ?? ''}></i>
        {/if}
        <span class="label">
          {#if hot}{pre}<span class="hotkey-letter">{hot}</span>{post}{:else}{fig.label}{/if}
        </span>
      </button>
    {/each}
  </div>

  <h3 class="property-label">Importer</h3>
  <div class="figure-grid">
    <button
      type="button"
      class="figure-btn"
      onclick={() => stlInput.click()}
      disabled={store.readOnly}
      title="Importer STL-fil"
    >
      <i class="fa-solid fa-file-import icon"></i>
      <span class="label">STL-fil</span>
    </button>
  </div>
  <input
    type="file"
    accept=".stl,model/stl"
    bind:this={stlInput}
    onchange={handleStlFile}
    style="display: none;"
  />
</div>

{#if showScribbleEditor}
  <ScribbleEditor
    onCommit={handleScribbleCommit}
    onClose={() => (showScribbleEditor = false)}
  />
{/if}

{#if showPlantegningEditor && plantegningInitialData}
  <PlantegningEditor
    initialData={plantegningInitialData}
    onCommit={handlePlantegningCommit}
    onClose={() => {
      showPlantegningEditor = false;
      plantegningInitialData = null;
      plantegningEditingId = null;
    }}
  />
{/if}

<style>
  .shape-library {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .property-label {
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.07em;
    margin: 0 0 0.5rem 0;
  }
  /* Liten aksent-strek foran seksjonstitlene */
  .property-label::before {
    content: '';
    width: 3px;
    height: 12px;
    border-radius: 2px;
    background: var(--primary-color);
    opacity: 0.8;
  }
  .property-label + .figure-grid + .property-label {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border-color);
  }
  .figure-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }
  .figure-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 6px 8px;
    background: var(--bg-secondary, #f4f6fb);
    border: 1px solid transparent;
    border-radius: var(--akse-radius-md, 12px);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.7rem;
    transition: background 0.15s, border-color 0.15s, color 0.15s,
      transform 0.12s, box-shadow 0.15s;
  }
  .figure-btn:hover:not(:disabled) {
    background: var(--akse-tint, var(--primary-light-bg));
    border-color: var(--akse-ring, var(--primary-color));
    color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: var(--akse-shadow-sm);
  }
  .figure-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }
  .figure-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg));
  }
  .figure-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .figure-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
    box-shadow: 0 3px 10px var(--akse-ring, rgba(37, 99, 235, 0.3));
  }
  .icon {
    font-size: 1.2rem;
    line-height: 1;
  }
  .shape-icon {
    width: 26px;
    height: 26px;
  }
  /* Fylltoner — :global fordi SVG-innholdet injiseres med {@html} og
     dermed ikke får Sveltes scoping-attributt. */
  .shape-icon :global(.f-mid)   { fill: #4a90e2; }
  .shape-icon :global(.f-light) { fill: #6aa9ec; }
  .shape-icon :global(.f-dark)  { fill: #3a7bc8; }
  .figure-btn.active .shape-icon :global(.f-mid)   { fill: rgba(255, 255, 255, 0.95); }
  .figure-btn.active .shape-icon :global(.f-light) { fill: rgba(255, 255, 255, 0.7); }
  .figure-btn.active .shape-icon :global(.f-dark)  { fill: rgba(255, 255, 255, 0.5); }
  .label {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }
  .hotkey-letter {
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 600;
  }
  .figure-btn:hover:not(:disabled) .label {
    color: var(--primary-color);
  }
  .figure-btn.active .label {
    color: rgba(255, 255, 255, 0.9);
  }
  @media (prefers-reduced-motion: reduce) {
    .figure-btn,
    .figure-btn:hover:not(:disabled),
    .figure-btn:active:not(:disabled) {
      transform: none;
    }
  }
</style>

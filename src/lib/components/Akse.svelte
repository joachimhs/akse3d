<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<!-- @skaperiet/akse — mount-punkt -->
<script lang="ts">
  import { setContext, onMount, onDestroy } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { CsgEngine, CSG_ENGINE_CONTEXT_KEY } from '$lib/akse/csgEngine';
  import SceneCanvas from './SceneCanvas.svelte';
  import ShapeLibrary from './ShapeLibrary.svelte';
  import TransformPanel from './TransformPanel.svelte';
  import TopBar from './TopBar.svelte';
  import AkseGuideRunner from './AkseGuideRunner.svelte';
  import type { AkseGuide } from '$lib/guide';
  import type { AkseProject } from '$lib/models';
  import { blankProject } from '$lib/models';
  import { preloadFont } from '$lib/akse/textGeometry';
  import { setAkseConfig, type AkseStoragePort, type AkseSession } from '$lib/config';
  import { detectBrowserStorage, type StorageCapabilities } from '$lib/capabilities';
  import { resolveTexts, type AkseTexts, type AkseLocale } from '$lib/texts';

  let {
    storage,
    session,
    initialProject = null,
    requestedId = null,
    onProjectIdChange,
    fontUrl = '/fonts/inter-regular.ttf',
    loadError = null,
    texts = undefined,
    locale = 'no',
    maxStlTriangles = 500_000,
    guide = null,
    onGuideClose,
    onOpenGuides,
  } = $props<{
    storage?: AkseStoragePort;
    session: AkseSession;
    initialProject?: AkseProject | null;
    requestedId?: string | null;
    onProjectIdChange?: (id: string) => void;
    fontUrl?: string;
    loadError?: string | null;
    texts?: Partial<AkseTexts>;
    /** Startspråk. localStorage (akse-locale) vinner hvis satt. */
    locale?: AkseLocale;
    /** Maks trekanter ved STL-import (~48 B/trekant i lagret JSON). Sky-hosts bør sette lavere. */
    maxStlTriangles?: number;
    /** Interaktiv steg-for-steg guide som vises som boble nede til høyre. */
    guide?: AkseGuide | null;
    /** Kalles når brukeren lukker guiden (host nullstiller typisk `guide`-prop-en). */
    onGuideClose?: () => void;
    /** Vis «Start en guide»-knapp i toolbaren; host åpner sin guide-velger. */
    onOpenGuides?: () => void;
  }>();

  // ── Språk: localStorage (akse-locale) vinner over prop-default ─────────────
  const LOCALE_KEY = 'akse-locale';
  function readStoredLocale(): AkseLocale | null {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(LOCALE_KEY);
    return v === 'no' || v === 'en' ? v : null;
  }
  let localeState = $state<AkseLocale>(readStoredLocale() ?? locale);
  function setLocale(l: AkseLocale) {
    localeState = l;
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, l);
  }

  // Tekstene er reaktive: bytter ordbok når localeState endres; host-overstyringer flettes over.
  const resolvedTexts = $derived(resolveTexts(localeState, texts));

  // Browser-kapabiliteter avhenger av tekstene (tooltip-forklaringer) → derived.
  const browserCaps = $derived(detectBrowserStorage(resolvedTexts));
  const capabilities = $derived<StorageCapabilities>({
    cloud: storage
      ? {
          available: true,
          canWrite: session.authenticated,
          reason: session.authenticated ? undefined : resolvedTexts.cloudLoginToWrite,
        }
      : {
          available: false,
          canWrite: false,
          reason: resolvedTexts.cloudUnavailable,
        },
    diskFile: browserCaps.diskFile,
    download: browserCaps.download,
  });

  // Gjør host-konfig tilgjengelig for alle barn-komponenter. Reaktive verdier
  // eksponeres via getter slik at de alltid leses ferskt (ikke som øyeblikksbilde).
  setAkseConfig({
    get storage() {
      return storage;
    },
    get session() {
      return session;
    },
    get capabilities() {
      return capabilities;
    },
    get texts() {
      return resolvedTexts;
    },
    get locale() {
      return localeState;
    },
    setLocale,
    onProjectIdChange,
    onOpenGuides,
    fontUrl,
    maxStlTriangles,
  });

  const store = new ProjectStore(storage);
  setContext(STORE_CONTEXT_KEY, store);

  // Én delt CsgEngine for hele Akse-økten — SceneCanvas kompilerer for visning
  // (med cache), STL-eksporten i TopBar gjenbruker samme cache.
  const csgEngine = new CsgEngine();
  setContext(CSG_ENGINE_CONTEXT_KEY, csgEngine);
  onDestroy(() => csgEngine.dispose());

  $effect(() => {
    const user = session.user ?? 'anonymous';
    if (initialProject) {
      const readOnly = initialProject.user !== user;
      store.init(initialProject, user, readOnly);
    } else {
      const blank = blankProject(user, requestedId ?? undefined);
      store.init(blank, user, false, false);
    }
  });

  // URL-synk delegeres til host via callback.
  $effect(() => {
    const id = store.project?.id;
    if (id && onProjectIdChange) onProjectIdChange(id);
  });

  // Auto-save: kun for prosjekter som allerede finnes i cloud.
  $effect(() => {
    const _ = store.project.shapes;
    if (store.readOnly) return;
    if (!capabilities.cloud.canWrite) return;
    if (!store.isInCloud) return;
    const timer = setTimeout(async () => {
      if (store.readOnly) return;
      if (!store.isInCloud) return;
      if (store.project.shapes.length === 0) return;
      if (!store.hasUnsavedChanges()) return;
      try {
        await store.save();
      } catch (e) {
        console.warn('Akse auto-save feilet:', e);
      }
    }, 30_000);
    return () => clearTimeout(timer);
  });

  onMount(() => {
    preloadFont(fontUrl).catch((e) => console.warn('Font preload feilet:', e));
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function handleKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (store.readOnly) return;
    // Når en modal (Plantegning eller Tegning) er åpen, eier den sine egne snarveier.
    if (document.querySelector('.modal-backdrop')) return;

    const meta = e.ctrlKey || e.metaKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (store.selectedIds.size === 0) return;
      e.preventDefault();
      store.deleteShapes([...store.selectedIds]);
    } else if (meta && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      store.duplicateSelected();
    } else if (meta && e.key.toLowerCase() === 'c') {
      // Ikke preventDefault uten valg — la nettleserens vanlige kopiering virke
      if (store.selectedIds.size === 0) return;
      e.preventDefault();
      store.copySelected();
    } else if (meta && e.key.toLowerCase() === 'v') {
      if (!store.canPaste) return;
      e.preventDefault();
      store.paste();
    } else if (meta && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      store.selectAll();
    } else if (meta && !e.shiftKey && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      store.groupSelected();
    } else if (meta && e.shiftKey && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      store.ungroupSelected();
    } else if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      store.undo();
    } else if (meta && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      store.redo();
    } else if (e.key === 'h' || e.key === 'H') {
      const sel = store.selectedShapes();
      if (sel.length > 0) {
        const newMode = sel[0].mode === 'solid' ? 'hole' : 'solid';
        store.updateShapes([...store.selectedIds], { mode: newMode });
      }
    } else if (e.key === 'Escape') {
      if (store.pendingShapeKind) {
        store.setPendingShape(null);
      } else {
        store.deselectAll();
      }
    }
  }

  // ── Responsiv layout: kollapsbare sidepaneler ──────────────────────────────
  // Root-elementets faktiske bredde (ResizeObserver — robust også om Akse embeddes,
  // ikke bare i full viewport).
  let rootEl = $state<HTMLDivElement>();
  let rootWidth = $state(1200);
  let libraryOpen = $state(true);
  let panelOpen = $state(true);
  // Når bruker selv har togglet et panel, slutter auto-defaulten å overstyre det.
  let libraryTouched = false;
  let panelTouched = false;

  // Auto-default ut fra bredde (kun til bruker tar over via fanene).
  $effect(() => {
    const w = rootWidth;
    if (!libraryTouched) libraryOpen = w >= 1100;
    if (!panelTouched) panelOpen = w >= 820;
  });

  // Grid-kolonner følger kollaps-tilstanden; scenen bruker minmax(0,1fr) så den
  // alltid kan krympe i stedet for å flyte utenfor.
  const gridCols = $derived(
    `${libraryOpen ? '210px' : '0px'} minmax(0, 1fr) ${panelOpen ? '230px' : '0px'}`,
  );

  function toggleLibrary() {
    libraryOpen = !libraryOpen;
    libraryTouched = true;
  }
  function togglePanel() {
    panelOpen = !panelOpen;
    panelTouched = true;
  }

  $effect(() => {
    if (!rootEl) return;
    const ro = new ResizeObserver((entries) => {
      rootWidth = entries[0].contentRect.width;
    });
    ro.observe(rootEl);
    return () => ro.disconnect();
  });
</script>

<div class="akse-root" bind:this={rootEl} style:grid-template-columns={gridCols}>
  {#if loadError}
    <div class="error-banner">{loadError}</div>
  {/if}
  {#if store.readOnly}
    <div class="readonly-banner">
      {resolvedTexts.akseReadOnlyBanner}
    </div>
  {/if}
  <div class="topbar-slot">
    <TopBar />
  </div>
  <div class="library-slot" class:collapsed={!libraryOpen}>
    <ShapeLibrary />
  </div>
  <div class="scene-slot" style:background={store.sceneTheme === 'dark' ? '#2a2a2a' : '#f2f4f7'}>
    <SceneCanvas />
    <button
      type="button"
      class="edge-tab edge-left"
      onclick={toggleLibrary}
      title={libraryOpen ? resolvedTexts.akseHideLibrary : resolvedTexts.akseShowLibrary}
      aria-label={libraryOpen ? resolvedTexts.akseHideLibrary : resolvedTexts.akseShowLibrary}
      aria-expanded={libraryOpen}
    >{libraryOpen ? '‹' : '›'}</button>
    <button
      type="button"
      class="edge-tab edge-right"
      onclick={togglePanel}
      title={panelOpen ? resolvedTexts.akseHidePanel : resolvedTexts.akseShowPanel}
      aria-label={panelOpen ? resolvedTexts.akseHidePanel : resolvedTexts.akseShowPanel}
      aria-expanded={panelOpen}
    >{panelOpen ? '›' : '‹'}</button>
  </div>
  <div class="panel-slot" class:collapsed={!panelOpen}>
    <TransformPanel />
  </div>
  {#if guide}
    {#key guide.id}
      <AkseGuideRunner {guide} onClose={() => onGuideClose?.()} />
    {/key}
  {/if}
</div>

<style>
  .akse-root {
    /* ── Akse-designtokens — avledet fra host-variablene ─────────────────────
       Arves av alle etterkommere (også fixed-posisjonerte modaler, som er
       DOM-barn av rota). Farger som trenger gjennomsiktighet bygges med
       color-mix; degraderer pent (mister kun dekor) i eldre nettlesere. */
    --akse-radius-sm: 8px;
    --akse-radius-md: 12px;
    --akse-radius-lg: 16px;
    --akse-radius-xl: 20px;
    --akse-ring: color-mix(in srgb, var(--primary-color) 22%, transparent);
    --akse-tint: color-mix(in srgb, var(--primary-color) 7%, var(--card-bg));
    --akse-tint-strong: color-mix(in srgb, var(--primary-color) 14%, var(--card-bg));
    --akse-glass: color-mix(in srgb, var(--card-bg) 84%, transparent);
    --akse-glass-border: color-mix(in srgb, var(--text-primary) 12%, transparent);
    --akse-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 8px rgba(15, 23, 42, 0.06);
    --akse-shadow-md: 0 2px 6px rgba(15, 23, 42, 0.07), 0 10px 28px rgba(15, 23, 42, 0.12);
    --akse-shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.14), 0 24px 64px rgba(15, 23, 42, 0.18);

    /* Host: --akse-font er udefinert → inherit (appens egen font).
       Standalone: akse-theme.css definerer --akse-font. */
    font-family: var(--akse-font, inherit);

    display: grid;
    grid-template-areas:
      "topbar topbar topbar"
      "library scene panel";
    /* grid-template-columns settes inline (reaktivt fra kollaps-tilstand). */
    grid-template-rows: 48px 1fr;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: 100dvh;
    overflow: hidden;
  }
  .topbar-slot {
    grid-area: topbar;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--akse-shadow-sm);
    position: relative;
    z-index: 7;  /* skyggen skal ligge over sidepanelene */
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    container-type: inline-size;  /* lar TopBar bruke container-queries */
  }
  .library-slot {
    grid-area: library;
    background: var(--card-bg);
    border-right: 1px solid var(--border-color);
    padding: 1rem;
    overflow: auto;
    min-width: 0;
  }
  .scene-slot {
    grid-area: scene;
    background: #2a2a2a;
    position: relative;  /* anker for kant-fanene */
    min-width: 0;
    overflow: hidden;
  }
  .panel-slot {
    grid-area: panel;
    background: var(--card-bg);
    border-left: 1px solid var(--border-color);
    overflow: auto;
    min-width: 0;
  }
  /* Kollapset kolonne: skjul innhold helt (kolonnen er 0px via inline grid). */
  .library-slot.collapsed,
  .panel-slot.collapsed {
    padding: 0;
    border: none;
    overflow: hidden;
  }

  /* Kant-faner for å vise/skjule sidepanelene. */
  .edge-tab {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 6;
    width: 20px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--akse-glass-border, var(--border-color));
    background: var(--akse-glass, var(--card-bg));
    backdrop-filter: blur(8px) saturate(1.3);
    -webkit-backdrop-filter: blur(8px) saturate(1.3);
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    box-shadow: var(--akse-shadow-sm);
    opacity: 0.9;
    transition: opacity 0.15s, color 0.15s, width 0.15s;
  }
  .edge-tab:hover {
    opacity: 1;
    color: var(--primary-color);
    width: 24px;
  }
  .edge-left {
    left: 0;
    border-left: none;
    border-radius: 0 var(--akse-radius-sm) var(--akse-radius-sm) 0;
  }
  .edge-right {
    right: 0;
    border-right: none;
    border-radius: var(--akse-radius-sm) 0 0 var(--akse-radius-sm);
  }
  .error-banner {
    position: absolute; top: 58px; left: 50%; transform: translateX(-50%);
    background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
    padding: 8px 18px; border-radius: 999px;
    box-shadow: var(--akse-shadow-md);
    font-size: 13px; font-weight: 500;
    z-index: 10;
  }
  .readonly-banner {
    position: absolute; top: 58px; left: 50%; transform: translateX(-50%);
    background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
    padding: 8px 18px; border-radius: 999px;
    box-shadow: var(--akse-shadow-md);
    z-index: 10; font-size: 13px; font-weight: 500;
  }
</style>

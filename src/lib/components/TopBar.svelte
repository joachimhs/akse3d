<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<!-- src/lib/components/akse/TopBar.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { CsgEngine, CSG_ENGINE_CONTEXT_KEY } from '$lib/akse/csgEngine';
  import { exportProjectToSTL, validateForExport } from '$lib/akse/stlExporter';
  import { saveAs } from 'file-saver';
  import AkseOpenProjectModal from './AkseOpenProjectModal.svelte';
  import AkseSaveProjectModal from './AkseSaveProjectModal.svelte';
  import { getAkseConfig } from '$lib/config';
  import { generateUuidIsh } from '$lib/util/uuid';
  import { selectAllOnFocus } from '$lib/util/selectAllOnFocus';

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);
  // Delt CsgEngine fra Akse.svelte — geometrien er allerede kompilert og cachet
  // av SceneCanvas, så STL-eksporten slipper å re-kjøre CSG.
  const csgEngine = getContext<CsgEngine>(CSG_ENGINE_CONTEXT_KEY);
  const config = getAkseConfig();

  let showOpenModal = $state(false);
  let showSaveModal = $state(false);

  function handleExportSTL() {
    // Gjenbruk den delte motoren: compile() blir cache-treff på geometri som
    // SceneCanvas allerede har kompilert, så eksporten er rask. Motoren disposes
    // IKKE her — den eies av Akse.svelte og deles med scenen.
    const compiled = csgEngine.compile(store.project.shapes);
    const validation = validateForExport(compiled, store.project.workplaneSize);

    if (!validation.ok) {
      alert(validation.warning);
      return;
    }
    if (validation.outOfBounds && !confirm(validation.warning!)) {
      return;
    }
    const result = exportProjectToSTL(compiled);
    const filename = (store.project.name || `akse-prosjekt-${store.project.id.slice(0, 8)}`) + '.stl';
    saveAs(new Blob([result.buffer], { type: 'model/stl' }), filename);
  }

  function handleNewProject() {
    if (store.readOnly) return;
    if (!confirm(config.texts.topbarConfirmNewProject)) return;
    const user = store.currentUser;
    store.init(
      { ...store.project, id: generateUuidIsh(), name: config.texts.topbarNewProject, shapes: [], user } as any,
      user,
      false,
      false,  // ikke i cloud før første save
    );
  }

  function handleClone() {
    if (!config.session.authenticated) {
      alert(config.texts.topbarLoginRequiredForClone);
      return;
    }
    const user = config.session.user!;
    store.init(
      { ...store.project, id: generateUuidIsh(), user, name: store.project.name + config.texts.topbarClonedProjectSuffix } as any,
      user,
      false,
      false,  // klonen er ikke i cloud før første save
    );
  }

  // Reactive flag for dirty state on save button
  let isDirty = $derived(store.hasUnsavedChanges());
</script>

<div class="toolbar">
  <div class="akse-logo" title={config.texts.topbarLogoTitle}>
    <i class="fa-solid fa-cube logo-icon"></i>
    <span class="logo-stack">
      <span class="logo-text">Akse</span>
      <span class="logo-tagline">{config.texts.topbarLogoTaglineBefore}<strong>Skaperiet</strong>{config.texts.topbarLogoTaglineAfter}</span>
    </span>
  </div>

  <input
    type="text"
    class="project-name"
    value={store.project.name}
    oninput={(e) => store.setName(e.currentTarget.value)}
    onfocus={selectAllOnFocus}
    disabled={store.readOnly}
    placeholder={config.texts.topbarProjectNamePlaceholder}
  />

  <div class="divider"></div>

  <div class="tool-group">
    <button
      type="button"
      class="tool-button"
      onclick={handleNewProject}
      disabled={store.readOnly}
      title={config.texts.topbarNewProject}
      aria-label={config.texts.topbarNewProject}
    >
      <i class="fa-solid fa-file"></i>
    </button>
    {#if config.onOpenGuides}
      <button
        type="button"
        class="tool-button"
        onclick={() => config.onOpenGuides?.()}
        title={config.texts.topbarStartGuide}
        aria-label={config.texts.topbarStartGuide}
      >
        <i class="fa-solid fa-graduation-cap"></i>
      </button>
    {/if}
    <button
      type="button"
      class="tool-button"
      onclick={() => (showOpenModal = true)}
      title={config.texts.topbarOpenProject}
      aria-label={config.texts.topbarOpenProject}
    >
      <i class="fa-solid fa-folder-open"></i>
    </button>
    <button
      type="button"
      class="tool-button"
      onclick={() => (showSaveModal = true)}
      disabled={store.readOnly}
      title={config.texts.topbarSaveProject}
      aria-label={config.texts.topbarSaveProject}
    >
      <i class="fa-solid fa-floppy-disk"></i>
      {#if isDirty && !store.readOnly}
        <span class="dirty-dot" aria-hidden="true"></span>
      {/if}
    </button>
  </div>

  <div class="divider"></div>

  <div class="tool-group">
    <button
      type="button"
      class="tool-button"
      onclick={() => store.undo()}
      disabled={!store.canUndo || store.readOnly}
      title={config.texts.topbarUndoTitle}
      aria-label={config.texts.topbarUndo}
    >
      <i class="fa-solid fa-rotate-left"></i>
    </button>
    <button
      type="button"
      class="tool-button"
      onclick={() => store.redo()}
      disabled={!store.canRedo || store.readOnly}
      title={config.texts.topbarRedoTitle}
      aria-label={config.texts.topbarRedo}
    >
      <i class="fa-solid fa-rotate-right"></i>
    </button>
  </div>

  <div class="divider"></div>

  <div class="tool-group">
    <button
      type="button"
      class="tool-button"
      onclick={() => store.copySelected()}
      disabled={store.selectedIds.size === 0 || store.readOnly}
      title={config.texts.topbarCopyTitle}
      aria-label={config.texts.topbarCopy}
    >
      <i class="fa-solid fa-copy"></i>
    </button>
    <button
      type="button"
      class="tool-button"
      onclick={() => store.paste()}
      disabled={!store.canPaste || store.readOnly}
      title={config.texts.topbarPasteTitle}
      aria-label={config.texts.topbarPaste}
    >
      <i class="fa-solid fa-paste"></i>
    </button>
    <button
      type="button"
      class="tool-button"
      onclick={() => store.duplicateSelected()}
      disabled={store.selectedIds.size === 0 || store.readOnly}
      title={config.texts.topbarDuplicateTitle}
      aria-label={config.texts.topbarDuplicate}
    >
      <i class="fa-solid fa-clone"></i>
    </button>
  </div>

  <div class="divider"></div>

  <div class="tool-group">
    <button
      type="button"
      class="tool-button stl-button"
      onclick={handleExportSTL}
      title={config.texts.topbarExportStlTitle}
      aria-label={config.texts.topbarExportStl}
    >
      <i class="fa-solid fa-cube"></i>
      <span class="stl-label">STL</span>
    </button>
  </div>

  <div class="spacer"></div>

  <button
    type="button"
    class="tool-button theme-button"
    onclick={() => store.toggleSceneTheme()}
    title={store.sceneTheme === 'dark' ? config.texts.topbarThemeToLight : config.texts.topbarThemeToDark}
    aria-label={config.texts.topbarThemeToggle}
    aria-pressed={store.sceneTheme === 'light'}
  >
    <i class="fa-solid fa-circle-half-stroke"></i>
    <span class="theme-label">{store.sceneTheme === 'dark' ? config.texts.topbarThemeDark : config.texts.topbarThemeLight}</span>
  </button>

  <button
    type="button"
    class="tool-btn lang-toggle"
    onclick={() => config.setLocale(config.locale === 'no' ? 'en' : 'no')}
    title={config.texts.topbarLanguageToggle}
    aria-label={config.texts.topbarLanguageToggle}
  >{config.locale === 'no' ? 'EN' : 'NO'}</button>

  {#if store.readOnly}
    <button type="button" class="primary-btn" onclick={handleClone} title={config.texts.topbarCloneTitle}>
      <i class="fa-solid fa-copy"></i>
      {config.texts.topbarClone}
    </button>
  {/if}
</div>

{#if showOpenModal}
  <AkseOpenProjectModal onClose={() => (showOpenModal = false)} />
{/if}

{#if showSaveModal}
  <AkseSaveProjectModal onClose={() => (showSaveModal = false)} />
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0 1rem;
    width: 100%;
    height: 100%;
  }

  .akse-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    padding-right: 0.85rem;
    border-right: 1px solid var(--border-color);
    user-select: none;
  }
  .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 0.85rem;
    color: #fff;
    background: linear-gradient(
      135deg,
      var(--primary-color),
      color-mix(in srgb, var(--primary-color) 70%, #0ea5e9)
    );
    border-radius: var(--akse-radius-sm, 8px);
    box-shadow: 0 2px 6px var(--akse-ring, rgba(37, 99, 235, 0.25));
  }
  .logo-stack {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }
  .logo-text {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  /* Tagline under ordmerket — samme uttrykk som Blockuino-logoen. */
  .logo-tagline {
    font-size: 0.5rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--text-secondary, #64748b);
    white-space: nowrap;
  }
  .logo-tagline strong {
    font-weight: 700;
  }

  /* "Ghost"-felt: smelter inn til du peker på eller redigerer det. */
  .project-name {
    padding: 0.4rem 0.6rem;
    border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    min-width: 180px;
    max-width: 240px;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .project-name:hover:not(:disabled) {
    background: var(--bg-secondary, #f4f6fb);
    border-color: var(--border-color);
  }
  .project-name:focus {
    outline: none;
    background: var(--card-bg);
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg));
  }
  .project-name:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .divider {
    width: 1px;
    background: var(--border-color);
    height: 22px;
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .tool-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
  }
  .tool-button:hover:not(:disabled) {
    background: var(--akse-tint, var(--primary-light-bg));
    color: var(--primary-color);
  }
  .tool-button:active:not(:disabled) {
    transform: scale(0.92);
  }
  .tool-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg));
  }
  .tool-button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .tool-button:disabled:hover {
    background: transparent;
    border-color: transparent;
    color: var(--text-primary);
  }

  .stl-button {
    width: auto;
    padding: 0 0.75rem;
    gap: 0.4rem;
    color: #fff;
    border: none;
    border-radius: 999px;
    background: linear-gradient(
      135deg,
      var(--primary-color),
      color-mix(in srgb, var(--primary-color) 72%, #0ea5e9)
    );
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
    font-weight: 600;
  }
  .stl-button:hover:not(:disabled) {
    background: var(--primary-color);
    color: #fff;
    filter: brightness(1.08);
    box-shadow: 0 4px 12px var(--akse-ring, rgba(37, 99, 235, 0.35));
  }
  .stl-label {
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  .theme-button {
    width: auto;
    height: 30px;
    padding: 0 0.7rem;
    gap: 0.45rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-secondary, #f4f6fb);
    font-weight: 500;
  }
  .theme-button:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: var(--akse-tint, var(--primary-light-bg));
    color: var(--primary-color);
  }
  /* Aktiv = lys bakgrunn valgt: gi knappen et tydelig "på"-uttrykk */
  .theme-button[aria-pressed="true"] {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
  }
  .theme-button[aria-pressed="true"]:hover {
    background: var(--primary-color);
    color: #fff;
    filter: brightness(1.05);
  }
  .theme-label {
    font-size: 0.8rem;
    letter-spacing: 0.01em;
  }

  .dirty-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f59e0b;
    box-shadow: 0 0 0 2px var(--card-bg);
    animation: akse-dirty-pulse 2s ease-in-out infinite;
  }
  @keyframes akse-dirty-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.75); opacity: 0.65; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dirty-dot { animation: none; }
  }

  .spacer { flex: 1; }

  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border: none;
    border-radius: 999px;
    background: var(--primary-color);
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
    transition: filter 0.15s, box-shadow 0.15s;
  }
  .primary-btn:hover {
    filter: brightness(1.08);
    box-shadow: 0 4px 12px var(--akse-ring, rgba(37, 99, 235, 0.35));
  }

  /* Komprimer til ikoner når toolbar-en blir trang (container = .topbar-slot). */
  @container (max-width: 720px) {
    .toolbar { gap: 0.5rem; padding: 0 0.5rem; }
    .project-name { min-width: 90px; max-width: 160px; }
    .theme-label { display: none; }
    .stl-label { display: none; }
    .logo-tagline { display: none; }
  }
  @container (max-width: 560px) {
    .akse-logo { padding-right: 0.4rem; }
    .logo-stack { display: none; }
    .project-name { min-width: 60px; }
  }
</style>

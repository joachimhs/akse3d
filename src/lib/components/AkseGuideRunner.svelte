<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<!-- src/lib/components/AkseGuideRunner.svelte
     Steg-for-steg guide-boble nede til høyre — samme mønster som
     BlockuinoGuideRunner i skaperiet-ny-front, tilpasset Akse:
     validatorer sjekkes reaktivt mot prosjektets figurer ($derived av
     ProjectStore.shapes), uten endrings-lyttere. -->
<script lang="ts">
  import { getContext } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import type { AkseGuide, AkseGuideStep } from '$lib/guide';
  import { runAkseValidator } from '$lib/guide';
  import { renderGuideMarkdown } from '$lib/akse/guideMarkdown';

  let { guide, onClose = () => {} } = $props<{
    guide: AkseGuide;
    onClose?: () => void;
  }>();

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);

  let currentStepIndex = $state(0);
  let showAllSteps = $state(false);
  let imageModalOpen = $state(false);
  let minimized = $state(false);
  // Passert-status er «klebrig»: et steg som er gjort forblir grønt selv om
  // brukeren senere endrer prosjektet — vennligere for barn enn å miste haker.
  let passed = $state<Record<string, boolean>>({});

  let steps = $derived<AkseGuideStep[]>(guide.steps);
  let currentStep = $derived<AkseGuideStep | null>(steps[currentStepIndex] ?? null);
  let isFirstStep = $derived(currentStepIndex === 0);
  let isLastStep = $derived(currentStepIndex >= steps.length - 1);
  let progress = $derived(steps.filter((s) => passed[s.id]).length);
  let allDone = $derived(steps.length > 0 && progress === steps.length);

  let bodyHtml = $derived(renderGuideMarkdown(currentStep?.bodyMarkdown));

  // ─── Persistens (localStorage) ───────────────────────────────
  // Validator-steg re-evalueres uansett mot prosjektet; bare info-steg
  // gjenopprettes fra lagret progress (samme valg som Blockuino-runneren).
  function progressKey(): string {
    return `akse-guide-progress-${guide.id}`;
  }

  try {
    const raw = localStorage.getItem(progressKey());
    if (raw) {
      const stored = JSON.parse(raw) as { passedStepIds?: string[] };
      for (const id of stored.passedStepIds ?? []) {
        const step = guide.steps.find((s: AkseGuideStep) => s.id === id);
        if (step?.validator.type === 'info') passed[id] = true;
      }
    }
  } catch {
    /* korrupt lagring ignoreres */
  }

  function persistProgress() {
    const data = {
      passedStepIds: steps.filter((s) => passed[s.id]).map((s) => s.id),
      completedAt: allDone ? new Date().toISOString() : null,
    } satisfies { passedStepIds: string[]; completedAt: string | null };
    try {
      localStorage.setItem(progressKey(), JSON.stringify(data));
    } catch {
      /* full/utilgjengelig lagring ignoreres */
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(progressKey());
    } catch {}
  }

  // ─── Reaktiv validering mot prosjektets figurer ──────────────
  // Leser også activeSketchData så sketch-steg valideres live mens
  // Plantegning-editoren er åpen.
  $effect(() => {
    const shapes = store.project.shapes;
    const activeSketch = store.activeSketchData;
    const newlyPassed: string[] = [];
    for (const s of steps) {
      if (s.validator.type === 'info') continue;
      if (passed[s.id]) continue;
      if (runAkseValidator(s.validator, shapes, activeSketch)) newlyPassed.push(s.id);
    }
    if (newlyPassed.length > 0) {
      for (const id of newlyPassed) passed[id] = true;
      persistProgress();
    }
  });

  // ─── Navigasjon ──────────────────────────────────────────────
  function next() {
    if (!isLastStep) currentStepIndex += 1;
  }
  function prev() {
    if (!isFirstStep) currentStepIndex -= 1;
  }
  function markInfoPassed() {
    if (!currentStep) return;
    passed[currentStep.id] = true;
    persistProgress();
  }
  function jumpToStep(index: number) {
    currentStepIndex = index;
    showAllSteps = false;
  }
  function close() {
    persistProgress();
    onClose();
  }
  function finishAndClose() {
    clearProgress();
    onClose();
  }
</script>

{#if guide && currentStep && minimized}
  <!-- Minimert: kompakt pille som ikke dekker modal-knapper (f.eks. Plantegning) -->
  <button
    type="button"
    class="guide-pill"
    class:passed={!!passed[currentStep.id]}
    class:venstre={store.editorModalOpen}
    onclick={() => (minimized = false)}
    title="Vis guiden"
  >
    <span class="pill-check">{#if passed[currentStep.id]}✓{:else}{currentStepIndex + 1}{/if}</span>
    Steg {currentStepIndex + 1} av {steps.length}
  </button>
{/if}

{#if guide && currentStep && !minimized}
  <!-- Når en editor-modal er åpen flyttes boblen til venstre side, slik at
       modalens «Avbryt»/«Lag 3D-modell»-knapper nede til høyre er frie. -->
  <div
    class="guide-bubble"
    class:passed={!allDone && !!passed[currentStep.id]}
    class:venstre={store.editorModalOpen}
  >
    {#if allDone}
      <div class="celebration">
        <div class="celebration-emoji">🎉</div>
        <h3>Gratulerer!</h3>
        <p>Du har fullført «{guide.name}».</p>
        <button class="btn-primary" onclick={finishAndClose}>Lukk guiden</button>
      </div>
    {:else}
      {#if showAllSteps}
        <div class="step-list">
          {#each steps as s, i}
            <button
              type="button"
              class="step-list-item"
              class:passed={passed[s.id]}
              class:active={i === currentStepIndex}
              onclick={() => jumpToStep(i)}
            >
              <span class="step-list-check">{#if passed[s.id]}✓{:else}{i + 1}{/if}</span>
              <span class="step-list-label">{s.title}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="bubble-toggles">
        <button
          type="button"
          class="show-steps-toggle"
          onclick={() => (showAllSteps = !showAllSteps)}
          aria-expanded={showAllSteps}
        >
          <span>{showAllSteps ? 'Skjul steg' : 'Vis steg'}</span>
          <span class="caret">{showAllSteps ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          class="minimize-toggle"
          onclick={() => (minimized = true)}
          title="Minimer guiden"
          aria-label="Minimer guiden"
        >–</button>
      </div>

      <div class="step-num">Steg {currentStepIndex + 1} av {steps.length}</div>
      <h3 class="step-title">{currentStep.title}</h3>

      {#if currentStep.validator.type !== 'info'}
        {#if passed[currentStep.id]}
          <div class="status-pill passed">✓ Du har gjort det!</div>
        {:else}
          <div class="status-pill waiting">⏳ Venter på handling…</div>
        {/if}
      {/if}

      <div class="progress-row">
        <div class="progress-bar">
          <div class="fill" style:width="{(progress / Math.max(steps.length, 1)) * 100}%"></div>
        </div>
        <span class="progress-text">{progress} / {steps.length}</span>
      </div>

      {#if currentStep.imageUrl}
        <button
          type="button"
          class="image-thumb"
          onclick={() => (imageModalOpen = true)}
          aria-label="Vis bilde i stort format"
        >
          <img src={currentStep.imageUrl} alt="Instruksjon for {currentStep.title}" />
        </button>
      {/if}

      {#if currentStep.bodyMarkdown}
        <div class="body-text">{@html bodyHtml}</div>
      {/if}

      <div class="controls">
        <button class="btn-secondary" onclick={prev} disabled={isFirstStep}>Tilbake</button>
        {#if currentStep.validator.type === 'info'}
          <button
            class="btn-primary"
            onclick={() => {
              markInfoPassed();
              next();
            }}
          >
            {passed[currentStep.id] ? 'Neste →' : 'Forstått, gå videre'}
          </button>
        {:else if passed[currentStep.id]}
          <button class="btn-primary" onclick={next} disabled={isLastStep}>Neste →</button>
        {:else}
          <button class="btn-secondary" onclick={next} disabled={isLastStep}>Hopp over</button>
        {/if}
        <button class="close-btn" onclick={close} aria-label="Lukk guiden" title="Lukk guiden">×</button>
      </div>
    {/if}
  </div>

  {#if imageModalOpen && currentStep.imageUrl}
    <div
      class="image-modal-backdrop"
      onclick={() => (imageModalOpen = false)}
      onkeydown={(e) => {
        if (e.key === 'Escape') imageModalOpen = false;
      }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <button class="image-modal-close" onclick={() => (imageModalOpen = false)} aria-label="Lukk">×</button>
      <img class="image-modal-img" src={currentStep.imageUrl} alt="Instruksjon for {currentStep.title}" />
    </div>
  {/if}
{/if}

<style>
  .guide-bubble {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    width: 340px;
    box-sizing: border-box;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
    box-shadow: var(--akse-shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.18));
    padding: 0.9rem 1.1rem 1rem;
    font-family: inherit;
    color: var(--text-primary, #1e293b);
    /* Over Akse-modalene (z 100) så guiden kan følges inne i Plantegning/
       Tegning — minimer-knappen finnes for når boblen er i veien. */
    z-index: 105;
  }
  /* Editor-modal åpen: flytt til venstre så modal-knappene nede til høyre er frie. */
  .guide-bubble.venstre,
  .guide-pill.venstre {
    right: auto;
    left: 1.25rem;
  }
  .guide-pill {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 105;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.9rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: 999px;
    box-shadow: var(--akse-shadow-md, 0 6px 18px rgba(0, 0, 0, 0.15));
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary, #1e293b);
    cursor: pointer;
  }
  .guide-pill.passed {
    border-color: #16a34a;
  }
  .pill-check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--bg-secondary, #e2e8f0);
    color: var(--text-secondary, #64748b);
    font-size: 0.65rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .guide-pill.passed .pill-check {
    background: #4ade80;
    color: #fff;
  }
  .bubble-toggles {
    position: absolute;
    top: 0.6rem;
    right: 0.7rem;
    display: inline-flex;
    gap: 0.3rem;
    z-index: 1;
  }
  .minimize-toggle {
    background: transparent;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: 6px;
    padding: 0.25rem 0.55rem;
    font-family: inherit;
    font-size: 0.75rem;
    line-height: 1;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
  }
  .minimize-toggle:hover {
    background: var(--bg-secondary, #f1f5f9);
    color: var(--text-primary, #0f172a);
  }
  .guide-bubble.passed {
    border: 2px solid #16a34a;
    box-shadow: 0 12px 32px rgba(22, 163, 74, 0.25);
  }
  @media (max-width: 600px) {
    .guide-bubble {
      left: 1rem;
      right: 1rem;
      bottom: 1rem;
      width: auto;
    }
  }

  .show-steps-toggle {
    background: transparent;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: 6px;
    padding: 0.25rem 0.55rem;
    font-family: inherit;
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    line-height: 1;
  }
  .show-steps-toggle:hover {
    background: var(--bg-secondary, #f1f5f9);
    color: var(--text-primary, #0f172a);
  }
  .show-steps-toggle .caret {
    font-size: 0.65rem;
  }

  .step-num {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-right: 7.5rem; /* unngå overlapp med Vis steg-/minimer-knappene */
  }
  .step-title {
    margin: 0.3rem 0 0.6rem 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    padding-right: 7.5rem;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .status-pill.waiting {
    background: #fef3c7;
    border: 1px solid #eab308;
    color: #854d0e;
  }
  .status-pill.passed {
    background: #dcfce7;
    border: 1px solid #4ade80;
    color: #166534;
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.4rem 0;
  }
  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--bg-secondary, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-bar .fill {
    height: 100%;
    background: #4ade80;
    transition: width 0.3s ease;
  }
  .progress-text {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
  }

  .image-thumb {
    display: block;
    width: 100%;
    background: transparent;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    padding: 0;
    cursor: zoom-in;
    overflow: hidden;
    margin: 0.4rem 0;
  }
  .image-thumb:hover {
    border-color: var(--primary-color, #2563eb);
  }
  .image-thumb img {
    display: block;
    width: 100%;
    max-height: 160px;
    object-fit: contain;
  }

  .body-text {
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0.4rem 0;
  }
  .body-text :global(p) {
    margin: 0.3rem 0;
  }
  .body-text :global(ul),
  .body-text :global(ol) {
    margin: 0.3rem 0;
    padding-left: 1.3rem;
  }
  .body-text :global(code) {
    background: var(--bg-secondary, #f1f5f9);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
  }
  .body-text :global(img) {
    max-width: 100%;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.7rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--border-color, #e3e8f0);
  }
  .btn-primary {
    background: var(--primary-color, #2563eb);
    color: #fff;
    border: none;
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn-secondary {
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    border: 1px solid var(--border-color, #e3e8f0);
    background: var(--bg-secondary, #f1f5f9);
    color: var(--text-primary, #1e293b);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--akse-tint, #e8f0fe);
  }
  .btn-secondary:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--text-secondary, #64748b);
    padding: 0 0.4rem;
    margin-left: auto;
  }
  .close-btn:hover {
    color: var(--text-primary, #1e293b);
  }

  .step-list {
    max-height: 40vh;
    overflow-y: auto;
    margin: 0 -0.4rem 0.6rem;
    padding: 0.2rem;
    border-bottom: 1px solid var(--border-color, #e3e8f0);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .step-list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
    color: var(--text-primary, #1e293b);
    text-align: left;
    width: 100%;
  }
  .step-list-item:hover {
    background: var(--bg-secondary, #f1f5f9);
  }
  .step-list-item.passed {
    color: #166534;
  }
  .step-list-item.active {
    background: #fef3c7;
    font-weight: 600;
  }
  .step-list-check {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--bg-secondary, #e2e8f0);
    color: var(--text-secondary, #64748b);
    font-size: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .step-list-item.passed .step-list-check {
    background: #4ade80;
    color: #fff;
  }
  .step-list-item.active .step-list-check {
    background: #eab308;
    color: #fff;
  }
  .step-list-label {
    flex: 1;
    line-height: 1.3;
  }

  .celebration {
    text-align: center;
    padding: 0.5rem 0 0.2rem;
  }
  .celebration-emoji {
    font-size: 2.2rem;
    line-height: 1;
    margin-bottom: 0.4rem;
  }
  .celebration h3 {
    margin: 0 0 0.3rem;
    font-size: 1.15rem;
  }
  .celebration p {
    margin: 0 0 0.8rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #64748b);
  }

  .image-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.78);
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    cursor: zoom-out;
  }
  .image-modal-img {
    max-width: 80vw;
    max-height: 80vh;
    object-fit: contain;
    border-radius: var(--akse-radius-sm, 8px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    background: #fff;
  }
  .image-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    font-size: 1.4rem;
    cursor: pointer;
    line-height: 1;
    color: #1e293b;
  }
  .image-modal-close:hover {
    background: #fff;
  }
</style>

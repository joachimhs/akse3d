<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
  import { getContext } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { getAkseConfig } from '$lib/config';
  import { saveTextToFile } from '$lib/akse/diskFile';
  import { selectAllOnFocus } from '$lib/util/selectAllOnFocus';
  import { saveAs } from 'file-saver';

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);
  const config = getAkseConfig();

  let { onClose } = $props<{ onClose: () => void }>();

  let saving = $state(false);
  let saveErr = $state<string | null>(null);
  let saveOk = $state(false);
  let localFilename = $state(store.project.name || 'akse-prosjekt');
  let diskErr = $state<string | null>(null);

  function safeFileName(): string {
    return (localFilename || 'akse-prosjekt').replace(/[^a-zA-Z0-9æøåÆØÅ_\-]+/g, '_');
  }

  async function saveToDisk() {
    diskErr = null;
    try {
      const ok = await saveTextToFile(store.exportLocalJSONText(), `${safeFileName()}.json`);
      if (ok) onClose();
    } catch (e) {
      console.error(e);
      diskErr = config.texts.modalSaveWriteFileError;
    }
  }

  async function saveOnline() {
    if (store.readOnly) {
      saveErr = config.texts.modalSaveReadOnlyError;
      return;
    }
    saving = true;
    saveErr = null;
    try {
      await store.save();
      saveOk = true;
      setTimeout(onClose, 700);
    } catch (e) {
      console.error(e);
      saveErr = config.texts.modalSaveOnlineError;
    } finally {
      saving = false;
    }
  }

  function downloadJson() {
    saveAs(store.exportLocalJSON(), `${safeFileName()}.json`);
    onClose();
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <button class="close" onclick={onClose} aria-label={config.texts.commonClose} title={config.texts.commonClose}>
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="grid">
      <div class="col left">
        <div class="section">
          <div class="section-title"><i class="fa-solid fa-floppy-disk"></i> {config.texts.modalSaveLocalSectionTitle}</div>
          <p>{config.texts.modalSaveLocalSectionDesc}</p>
          <label class="field">
            {config.texts.modalSaveFilename}
            <input type="text" bind:value={localFilename} onfocus={selectAllOnFocus} placeholder={config.texts.modalSaveFilenamePlaceholder} />
          </label>
          {#if diskErr}<div class="error-msg">{diskErr}</div>{/if}
          <button
            class="btn primary big"
            onclick={saveToDisk}
            disabled={!config.capabilities.diskFile.available}
            title={config.capabilities.diskFile.available ? '' : config.capabilities.diskFile.reason}
          >
            <i class="fa-solid fa-floppy-disk"></i> {config.texts.modalSaveToFile}
          </button>
          <button
            class="btn big"
            onclick={downloadJson}
            disabled={!config.capabilities.download.available}
            title={config.capabilities.download.available ? '' : config.capabilities.download.reason}
          >
            <i class="fa-solid fa-download"></i> {config.texts.modalSaveDownload}
          </button>
        </div>
      </div>

      <div class="col right">
        <div class="section">
          <div class="section-title"><i class="fa-solid fa-cloud-arrow-up"></i> {config.texts.cloudSaveTitle}</div>
          {#if !config.capabilities.cloud.available}
            <p class="login-msg">{config.capabilities.cloud.reason}</p>
          {:else if !config.session.authenticated}
            <p class="login-msg">{config.texts.cloudSaveLoginRequired}</p>
          {:else if store.readOnly}
            <p class="login-msg">{config.texts.modalSaveSharedMsg}</p>
          {:else}
            <p>{config.texts.cloudSaveIntro}</p>
            <label class="field">
              {config.texts.modalSaveName}
              <input type="text"
                     value={store.project.name}
                     oninput={(e) => store.setName(e.currentTarget.value)}
                     onfocus={selectAllOnFocus}
                     placeholder={config.texts.modalSaveNamePlaceholder} />
            </label>
            <label class="field">
              {config.texts.modalSaveDescription}
              <textarea maxlength="150"
                        value={store.project.description ?? ''}
                        oninput={(e) => store.setDescription(e.currentTarget.value)}
                        placeholder={config.texts.modalSaveDescriptionPlaceholder}
                        rows="3"></textarea>
            </label>
            {#if saveErr}<div class="error-msg">{saveErr}</div>{/if}
            <button class="btn primary big" disabled={saving} onclick={saveOnline}>
              {#if saving}
                <i class="fa-solid fa-spinner fa-spin"></i> {config.texts.modalSaveSaving}
              {:else if saveOk}
                <i class="fa-solid fa-check"></i> {config.texts.modalSaveSaved}
              {:else}
                <i class="fa-solid fa-cloud-arrow-up"></i> {config.texts.cloudSaveTitle}
              {/if}
            </button>
          {/if}
        </div>
      </div>
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
    width: 95vw; max-width: 1100px;
    height: auto; max-height: 90vh;
    display: flex; flex-direction: column;
    position: relative;
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
  .close {
    position: absolute; top: 14px; right: 14px;
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px;
    background: white; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: 50%;
    font-size: 15px; color: var(--text-secondary, #64748b);
    cursor: pointer; font-family: inherit;
    box-shadow: var(--akse-shadow-sm, 0 1px 4px rgba(15, 23, 42, 0.08));
    transition: background 0.15s, color 0.15s, transform 0.1s;
    z-index: 2;
  }
  .close:hover { background: #f3f4f6; color: var(--text-primary, #1e293b); }
  .close:active { transform: scale(0.92); }
  .grid {
    flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    overflow: hidden;
  }
  .col {
    padding: 32px;
    overflow-y: auto;
    display: flex; flex-direction: column; gap: 24px;
  }
  .col.left { background: white; }
  .col.right {
    background: linear-gradient(
      180deg,
      var(--akse-tint, var(--primary-light-bg, #e8f0fe)),
      var(--akse-tint-strong, var(--primary-light-bg, #e8f0fe))
    );
  }
  .section {
    background: rgba(255,255,255,0.72); border-radius: var(--akse-radius-md, 12px);
    padding: 20px; display: flex; flex-direction: column; gap: 12px;
  }
  .col.left .section { background: var(--bg-secondary, #f4f6fb); }
  .section-title {
    font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 10px;
    color: var(--text-primary, #1e293b);
  }
  .section-title i { color: var(--primary-color, #2563eb); font-size: 15px; }
  .section p { margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; }
  .field {
    display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #374151;
  }
  .field input, .field textarea {
    padding: 9px 11px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    font-family: inherit; font-size: 14px; box-sizing: border-box;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field input:focus, .field textarea:focus {
    outline: none; border-color: var(--primary-color, #2563eb);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg, #e8f0fe));
  }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 16px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
    background: white; color: #374151;
    transition: background 0.15s, filter 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .btn:hover:not(:disabled) { background: #f8fafc; }
  .btn:active:not(:disabled) { transform: scale(0.98); }
  .btn.primary {
    background: var(--primary-color, #2563eb); color: white; border-color: transparent;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
  }
  .btn.primary:hover:not(:disabled) { background: var(--primary-color, #2563eb); filter: brightness(1.08); }
  .btn.primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .btn.big { padding: 14px; font-size: 15px; }
  .login-msg { color: #6b7280; font-style: italic; }
  .error-msg {
    background: #fee2e2; color: #991b1b; padding: 8px 12px;
    border-radius: var(--akse-radius-sm, 8px);
    font-size: 13px;
  }

  @media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; }
    .col { padding: 16px; }
  }
</style>

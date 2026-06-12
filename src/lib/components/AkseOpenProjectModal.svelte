<!-- Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie) — SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { ProjectStore, STORE_CONTEXT_KEY } from '$lib/akse/ProjectStore.svelte';
  import { getAkseConfig } from '$lib/config';
  import { openTextFromFile } from '$lib/akse/diskFile';
  import type { AkseProjectSummary } from '$lib/models';

  const store = getContext<ProjectStore>(STORE_CONTEXT_KEY);
  const config = getAkseConfig();

  let { onClose } = $props<{ onClose: () => void }>();

  let projects = $state<AkseProjectSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let projectFilter = $state('');
  let projectIdToCopyFrom = $state('');
  let copying = $state(false);
  let fileInputEl: HTMLInputElement;

  onMount(() => {
    loadProjects();
  });

  async function loadProjects() {
    if (!config.storage || !config.session.authenticated) {
      loading = false;
      return;
    }
    try {
      const list = await config.storage.list();
      const me = config.session.user;
      projects = list.filter((p) => p.user === me)
        .sort((a, b) => {
          const da = a.lastUsedDate ? new Date(a.lastUsedDate).getTime() : 0;
          const db = b.lastUsedDate ? new Date(b.lastUsedDate).getTime() : 0;
          return db - da;  // nyeste først
        });
    } catch (e) {
      console.error(e);
      error = 'Klarte ikke laste prosjekter';
    } finally {
      loading = false;
    }
  }

  let filteredProjects = $derived.by(() => {
    const q = projectFilter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      (p.name?.toLowerCase().includes(q)) ||
      (p.description?.toLowerCase().includes(q)),
    );
  });

  async function openProject(p: AkseProjectSummary) {
    try {
      await store.load(p.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Klarte ikke åpne prosjekt');
    }
  }

  async function deleteProject(p: AkseProjectSummary) {
    if (!config.storage) return;
    if (!confirm(`Slette "${p.name || 'uten navn'}" permanent?`)) return;
    try {
      await config.storage.remove(p.id);
      projects = projects.filter((x) => x.id !== p.id);
    } catch (e) {
      console.error(e);
      alert('Klarte ikke slette');
    }
  }

  async function openFile() {
    // Bruk File System Access API når tilgjengelig (ekte fil-velger), ellers fil-input.
    if (config.capabilities.diskFile.available) {
      try {
        const text = await openTextFromFile();
        if (text === null) return; // bruker avbrøt
        store.importLocalJSON(text);
        onClose();
      } catch (err) {
        console.error(err);
        alert('Klarte ikke å lese filen — sjekk at det er et gyldig Akse-prosjekt.');
      }
      return;
    }
    fileInputEl?.click();
  }

  async function onFileChosen(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importLocalJSON(text);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Klarte ikke å lese filen — sjekk at det er et gyldig Akse-prosjekt.');
    } finally {
      input.value = '';
    }
  }

  async function copyFromProjectId() {
    const id = projectIdToCopyFrom.trim();
    if (!id) {
      alert('Skriv inn prosjekt-ID');
      return;
    }
    copying = true;
    try {
      await store.cloneFromCloud(id);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Fant ikke prosjektet, eller klarte ikke åpne det.');
    } finally {
      copying = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <button class="close" onclick={onClose} aria-label="Lukk" title="Lukk">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="grid">
      <div class="col left">
        <div class="section">
          <div class="section-title"><i class="fa-solid fa-folder-open"></i> Åpne fra datamaskinen</div>
          <p>Hvis du tidligere har lagret et Akse-prosjekt som JSON-fil, eller fått en fra noen andre, kan du åpne det her.</p>
          <button class="btn primary big" onclick={openFile}>
            <i class="fa-solid fa-folder-open"></i> Åpne prosjektfil (.json)
          </button>
          <input bind:this={fileInputEl} type="file" accept=".json,application/json" style="display:none" onchange={onFileChosen} />
        </div>

        <div class="section">
          <div class="section-title"><i class="fa-solid fa-copy"></i> Kopier fra et annet prosjekt</div>
          {#if !config.capabilities.cloud.available}
            <p class="login-msg">{config.capabilities.cloud.reason}</p>
          {:else}
            <div class="warn">Ved å kopiere et annet prosjekt opprettes en kopi for deg — originalen røres ikke.</div>
            <label class="field">
              Prosjekt-ID:
              <input type="text" placeholder="Lim inn ID her" bind:value={projectIdToCopyFrom} />
            </label>
            <button class="btn primary" disabled={copying || !projectIdToCopyFrom.trim()} onclick={copyFromProjectId}>
              {#if copying}<i class="fa-solid fa-spinner fa-spin"></i> Kopierer…{:else}<i class="fa-solid fa-copy"></i> Kopier prosjekt{/if}
            </button>
          {/if}
        </div>
      </div>

      <div class="col right">
        <div class="section">
          <div class="section-title"><i class="fa-solid fa-database"></i> {config.texts.cloudOpenTitle}</div>
          {#if !config.capabilities.cloud.available}
            <p class="login-msg">{config.capabilities.cloud.reason}</p>
          {:else if !config.session.authenticated}
            <p class="login-msg">{config.texts.cloudOpenLoginRequired}</p>
          {:else}
            <p>{config.texts.cloudOpenIntro}</p>
            <input type="text" class="filter-input" placeholder="Filtrer prosjekter…" bind:value={projectFilter} />
            {#if loading}
              <div class="status"><i class="fa-solid fa-spinner fa-spin"></i> Laster…</div>
            {:else if error}
              <div class="status error">{error}</div>
            {:else if filteredProjects.length === 0}
              <div class="status">
                {projectFilter.trim() ? 'Ingen prosjekter matcher filteret.' : 'Du har ingen lagrede prosjekter ennå.'}
              </div>
            {:else}
              <div class="project-list">
                {#each filteredProjects as p (p.id)}
                  <div class="project-item">
                    <div class="project-main">
                      <div class="project-name">{p.name || '(uten navn)'}</div>
                      {#if p.description}<div class="project-desc">{p.description}</div>{/if}
                      <div class="project-meta">{p.lastUsedDate ? new Date(p.lastUsedDate).toLocaleString('no-NO') : ''}</div>
                    </div>
                    <div class="project-actions">
                      <button class="btn small primary" onclick={() => openProject(p)}>Åpne</button>
                      <button class="btn small danger" onclick={() => deleteProject(p)} aria-label="Slett">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
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
    width: 95vw; height: 90vh; max-width: 1200px;
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
  .warn {
    font-size: 12px; color: #92400e; background: #fef3c7;
    padding: 7px 11px; border-radius: var(--akse-radius-sm, 8px);
  }
  .field {
    display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #374151;
  }
  .field input {
    padding: 9px 11px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    font-family: inherit; font-size: 14px; box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field input:focus {
    outline: none; border-color: var(--primary-color, #2563eb);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg, #e8f0fe));
  }
  .filter-input {
    padding: 9px 11px; border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-sm, 8px);
    font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .filter-input:focus {
    outline: none; border-color: var(--primary-color, #2563eb);
    box-shadow: 0 0 0 3px var(--akse-ring, var(--primary-light-bg, #e8f0fe));
  }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 10px 16px; border: 1px solid transparent;
    border-radius: var(--akse-radius-sm, 8px);
    cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
    background: white; color: #374151;
    transition: background 0.15s, filter 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .btn:active:not(:disabled) { transform: scale(0.98); }
  .btn.primary {
    background: var(--primary-color, #2563eb); color: white;
    box-shadow: 0 2px 8px var(--akse-ring, rgba(37, 99, 235, 0.25));
  }
  .btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
  .btn.primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .btn.danger { background: white; color: #b91c1c; border-color: #fca5a5; }
  .btn.danger:hover { background: #fee2e2; }
  .btn.big { padding: 15px; font-size: 15px; }
  .btn.small { padding: 5px 11px; font-size: 12px; }
  .login-msg {
    color: #6b7280; font-style: italic;
  }
  .project-list {
    display: flex; flex-direction: column; gap: 7px;
    max-height: calc(90vh - 320px); overflow-y: auto;
  }
  .project-item {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    background: white;
    border: 1px solid var(--border-color, #e3e8f0);
    border-radius: var(--akse-radius-md, 12px);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .project-item:hover {
    border-color: var(--primary-color, #2563eb);
    box-shadow: var(--akse-shadow-sm, 0 2px 8px rgba(15, 23, 42, 0.08));
  }
  .project-main { flex: 1; min-width: 0; }
  .project-name { font-weight: 600; color: #111827; }
  .project-desc { font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .project-meta { font-size: 11px; color: #9ca3af; }
  .project-actions { display: flex; gap: 5px; }
  .status {
    text-align: center; color: #6b7280; padding: 16px;
  }
  .status.error { color: #b91c1c; }

  @media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    .col { padding: 16px; }
  }
</style>

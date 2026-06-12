<!--
  Dev-preview for pakken.
  - Default (`/`): SKY-LØS standalone — ingen storage injiseres → sky-UI gråes ut
    (som akse3d.no vil være). Slik ser du kapabilitets-deaktiveringen.
  - `/?cloud`: injiserer en localStorage-basert storage + innlogget session, så du
    kan teste sky-stien (Lagre online / Hent fra Skaperiet / Kopier fra ID).
-->
<script lang="ts">
  import { page } from '$app/stores';
  import { Akse } from '$lib/index';
  import type {
    AkseProject,
    AkseProjectSummary,
    AkseStoragePort,
    AkseSession,
  } from '$lib/index';

  // Sky på kun når ?cloud er i URL-en.
  const cloudEnabled = $derived($page.url.searchParams.has('cloud'));

  const KEY = 'akse-dev-projects';

  function readAll(): Record<string, AkseProject> {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }
  function writeAll(m: Record<string, AkseProject>): void {
    localStorage.setItem(KEY, JSON.stringify(m));
  }

  const localStorageAdapter: AkseStoragePort = {
    async load(id) {
      return readAll()[id] ?? null;
    },
    async create(p) {
      const m = readAll();
      m[p.id] = p;
      writeAll(m);
      return p;
    },
    async update(id, p) {
      const m = readAll();
      m[id] = p;
      writeAll(m);
      return p;
    },
    async list() {
      return Object.values(readAll()).map(
        (p): AkseProjectSummary => ({
          id: p.id,
          name: p.name,
          description: p.description,
          user: p.user,
          lastUsedDate: p.lastUsedDate,
        }),
      );
    },
    async remove(id) {
      const m = readAll();
      delete m[id];
      writeAll(m);
    },
  };

  // Med ?cloud: innlogget; ellers anonym (sky-løs standalone).
  const storage = $derived(cloudEnabled ? localStorageAdapter : undefined);
  const session = $derived<AkseSession>(
    cloudEnabled ? { user: 'dev', authenticated: true } : { user: null, authenticated: false },
  );
</script>

<Akse
  {storage}
  {session}
  fontUrl="/fonts/inter-regular.ttf"
  texts={{ cloudUnavailable: 'Skylagring er ikke aktivert i denne demoen.' }}
/>

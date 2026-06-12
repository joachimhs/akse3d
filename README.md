# @skaperiet/akse

Akse — 3D-modelleringsverktøy for barn og unge ([akse3d.no](https://akse3d.no) / akse3d.com).

Primitiv-basert 3D-modellering (kube, sylinder, kule, … + boolske hull), plantegning og
frihåndstegning, med STL-eksport for 3D-printing. Bygget på Svelte 5, Three.js og
three-bvh-csg. Pakken er **backend-agnostisk**: den henter/lagrer data via porter som host
implementerer.

## Bruk

```svelte
<script>
  import { Akse } from '@skaperiet/akse';
  import '@skaperiet/akse/akse-theme.css'; // valgfritt — host kan definere CSS-variablene selv
</script>

<Akse {storage} {session} fontUrl="/fonts/inter-regular.ttf" />
```

### Props

| Prop | Type | Beskrivelse |
|---|---|---|
| `storage` | `AkseStoragePort` | Persistens: `load/create/update/list/remove`. Påkrevd. |
| `session` | `AkseSession` | `{ user, authenticated }`. Send en reaktiv verdi for live-oppdatering. Påkrevd. |
| `initialProject` | `AkseProject \| null` | Forhåndslastet prosjekt (f.eks. delt lenke). Valgfritt. |
| `requestedId` | `string \| null` | Id-anker fra URL for nytt prosjekt. Valgfritt. |
| `onProjectIdChange` | `(id: string) => void` | Kalles når prosjekt-id endres (host synker URL). Valgfritt. |
| `fontUrl` | `string` | URL til `.ttf`/`.otf`-font for 3D-tekst. Default `/fonts/inter-regular.ttf`. |
| `loadError` | `string \| null` | Vis en feilbanner (f.eks. fra host-load). Valgfritt. |
| `maxStlTriangles` | `number` | Hard grense for STL-import. Default `500000` (standalone). Mesh lagres i prosjekt-JSON (~48 B/trekant), så sky-hosts bør sette lavere — skaperiet.no bruker `100000`. |

### Portene

```ts
interface AkseStoragePort {
  load(id: string): Promise<AkseProject | null>;
  create(project: AkseProject): Promise<AkseProject>;
  update(id: string, project: AkseProject): Promise<AkseProject>;
  list(): Promise<AkseProjectSummary[]>;
  remove(id: string): Promise<void>;
}
interface AkseSession {
  readonly user: string | null;
  readonly authenticated: boolean;
}
```

`AkseProject.shapes` er et ekte array og `createdDate`/`lastUsedDate` er ISO-strenger.
Backend-spesifikk serialisering (f.eks. JSON-kolonner) hører hjemme i host-adapteren, ikke her.

## Krav til host

- **Svelte 5**, **three 0.171**, **three-bvh-csg** — `peerDependencies`. Disse MÅ deles med
  host (én three-instans) — ellers knekker raycasting/CSG. I host-vite:
  `resolve.dedupe = ['three', 'three-bvh-csg', 'svelte']`.
- **FontAwesome 6** lastet globalt (ikon-klasser `fa-solid …`).
- En font på `fontUrl` (default `/fonts/inter-regular.ttf`). Pakken bundler Inter Regular
  under `static/fonts/` som referanse.

## Utvikling

```bash
npm install
npm run dev      # isolert preview med localStorage-adapter (http://localhost:5173)
npm run check    # svelte-check
npm run package  # bygg dist/ (svelte-package + publint)
```

## Lokal link mot skaperiet-ny-front

```bash
cd akse && npm link
cd ../skaperiet-ny-front && npm link @skaperiet/akse
# host vite.config: resolve.dedupe = ['three','three-bvh-csg','svelte']
#                   optimizeDeps.exclude = ['@skaperiet/akse']
```

Etter endringer i pakken: kjør `npm run package` på nytt, så plukker host opp ny `dist/`.

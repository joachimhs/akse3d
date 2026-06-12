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
| `guide` | `AkseGuide \| null` | Interaktiv steg-for-steg guide, vist som boble nede til høyre. Valgfritt. |
| `onGuideClose` | `() => void` | Kalles når brukeren lukker guiden (host nullstiller typisk `guide`). Valgfritt. |

### Interaktive guider

Samme mønster som Blockuino-/Vektor-guidene i skaperiet-ny-front: host eier
guide-dataene (f.eks. fra backend) og sender dem inn som prop. Hvert steg har
tittel, markdown-brødtekst, valgfritt bilde og en **validator** — `'info'`-steg
bekreftes manuelt («Forstått, gå videre»), resten sjekkes automatisk mot
prosjektets figurer mens brukeren jobber:

```ts
import type { AkseGuide } from '@skaperiet/akse';

const guide: AkseGuide = {
  id: 'nokkelring',
  name: 'Lag en nøkkelring',
  steps: [
    { id: 's1', title: 'Velkommen!', bodyMarkdown: 'Vi lager en **nøkkelring**.',
      validator: { type: 'info' } },
    { id: 's2', title: 'Legg til en smultring',
      validator: { type: 'hasShapeKind', kind: 'torus' } },
    { id: 's3', title: 'Lag et hull',
      validator: { type: 'hasHole' } },
  ],
};
```

Validatorer: `info`, `hasShapeKind` (kind + valgfri `minCount`/`mode`),
`shapeCount`, `shapeSize` (B/D/H innenfor `min`/`max` — for konkrete mål),
`hasHole`, `holeOverlapsSolid` (et hull overlapper en solid figur, valgfri
`sameGroup`), `shapesOverlap` (to figur-typer overlapper — f.eks. tekst på
skilt), `hasGroup` (valgfri `withHole: true` krever en gruppe med både hull og
solid), `hasColor`, samt sketch-validatorene `sketchFigure` (figurtype/modus/mål
i en plantegning) og `sketchExtrudeHeight` (3D-høyde). Sketch-validatorene
sjekkes **live mens Plantegning-editoren er åpen** (guideboblen ligger over
modalen og kan minimeres med `–`). Skriv stegene konkret (eksakte mål og
plassering) og bruk validatorer som sjekker resultatet — da kan ikke brukeren
få grønn hake uten at modellen faktisk blir riktig.

Dev-previewen har to demoguider: `/?guide` (nøkkelring-merkelapp, grunnfigurer)
og `/?guide=navneskilt` (Plantegning + 3D-tekst). Fullførte steg huskes i
`localStorage` per guide-id (kun info-steg gjenopprettes — validator-steg
re-evalueres mot prosjektet). Prøv demoen med `npm run dev` → `/?guide`.

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
npm run dev          # isolert preview med localStorage-adapter (http://localhost:5173)
npm run check        # svelte-check
npm run package      # bygg dist/ (svelte-package + publint)
npm run guidebilder  # regenerer demo-guidens instruksjonsbilder (static/guide/)
```

`guidebilder` bygger nøkkelring-merkelappen steg for steg i en ekte Akse-økt
(headless Chrome via CDP) og tar skjermbilde etter hvert steg — kjør den når
UI-et har endret utseende. Krever Node ≥ 22 og Chrome (overstyr sti med
`CHROME_BIN`).

## Lokal link mot skaperiet-ny-front

```bash
cd akse && npm link
cd ../skaperiet-ny-front && npm link @skaperiet/akse
# host vite.config: resolve.dedupe = ['three','three-bvh-csg','svelte']
#                   optimizeDeps.exclude = ['@skaperiet/akse']
```

Etter endringer i pakken: kjør `npm run package` på nytt, så plukker host opp ny `dist/`.

## Lisens

Akse er **dual-lisensiert**:

- **[AGPL-3.0](LICENSE)** — fri programvare. Gratis for all bruk, også
  kommersiell, så lenge du oppfyller lisensvilkårene. Merk at AGPL også gjelder
  bruk **over nett**: bygger du Akse inn i en nettjeneste, må tjenestens
  fullstendige kildekode gjøres tilgjengelig for brukerne under AGPL-3.0.
- **[Kommersiell lisens](LICENSE-COMMERCIAL.md)** — for deg som vil bruke Akse
  i lukkede produkter, SaaS-tjenester eller plattformer uten å dele kildekoden.
  Kontakt Skaperiet: <joachim@skeiene.no>.

Navnet «Akse», logoen og domenene akse3d.no/akse3d.com er Skaperiets varemerker
og omfattes ikke av AGPL-lisensen.

Bidrag er velkomne, men krever signert [CLA](CLA.md) — se
[CONTRIBUTING.md](CONTRIBUTING.md).

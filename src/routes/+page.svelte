<!--
  Dev-preview for pakken.
  - Default (`/`): SKY-LØS standalone — ingen storage injiseres → sky-UI gråes ut
    (som akse3d.no vil være). Slik ser du kapabilitets-deaktiveringen.
  - `/?cloud`: injiserer en localStorage-basert storage + innlogget session, så du
    kan teste sky-stien (Lagre online / Hent fra Skaperiet / Kopier fra ID).
  - `/?guide`: viser nøkkelring-demoguiden (steg-for-steg, med validatorer).
  - `/?guide=navneskilt`: viser navneskilt-guiden (Plantegning + tekst).
-->
<script lang="ts">
  import { page } from '$app/stores';
  import { Akse } from '$lib/index';
  import type {
    AkseProject,
    AkseProjectSummary,
    AkseStoragePort,
    AkseSession,
    AkseGuide,
  } from '$lib/index';

  // Sky på kun når ?cloud er i URL-en.
  const cloudEnabled = $derived($page.url.searchParams.has('cloud'));

  // Demo-guide på når ?guide er i URL-en (kan lukkes; gjenåpnes ved reload).
  // Konkret oppskrift: en rund nøkkelring-merkelapp (flat skive Ø40 med
  // Ø8-hull nær kanten) — hvert steg validerer at modellen faktisk blir slik.
  const demoGuide: AkseGuide = {
    id: 'demo-nokkelring',
    name: 'Lag en nøkkelring-merkelapp',
    steps: [
      {
        id: 'intro',
        title: 'Velkommen til Akse!',
        imageUrl: '/guide/steg-ferdig.png',
        bodyMarkdown:
          'Vi skal lage en **nøkkelring-merkelapp**: en rund, flat skive med et lite hull ' +
          'nær kanten, som nøkkelringen kan tres gjennom. Underveis lærer du å legge til ' +
          'figurer, sette nøyaktige mål, lage hull og gruppere.',
        validator: { type: 'info' },
      },
      {
        id: 'skive',
        title: 'Legg til en sylinder',
        imageUrl: '/guide/steg-sylinder.png',
        bodyMarkdown:
          'Klikk på **Sylinder** i figurbiblioteket til venstre (eller trykk `S`), og klikk ' +
          'midt på arbeidsplaten for å plassere den. Den skal bli selve skiven.',
        validator: { type: 'hasShapeKind', kind: 'cylinder' },
      },
      {
        id: 'flat-skive',
        title: 'Gjør den til en flat skive',
        imageUrl: '/guide/steg-flat-skive.png',
        bodyMarkdown:
          'Med sylinderen valgt: gå til **Størrelse (mm)** i panelet til høyre og sett\n\n' +
          '- **B** = `40`\n- **D** = `40`\n- **H** = `6`\n\n' +
          'Da blir det en flat skive på 4 cm — passe for en merkelapp.',
        validator: { type: 'shapeSize', kind: 'cylinder', dim: 'h', max: 8 },
      },
      {
        id: 'liten-sylinder',
        title: 'Legg til en liten sylinder',
        imageUrl: '/guide/steg-liten-sylinder.png',
        bodyMarkdown:
          'Legg til **én sylinder til** et stykke unna skiven. Sett størrelsen til ' +
          '**B** = `8` og **D** = `8` — den skal bli hullet til nøkkelringen.',
        validator: { type: 'shapeSize', kind: 'cylinder', dim: 'b', max: 10 },
      },
      {
        id: 'hull',
        title: 'Gjør den lille til et hull',
        imageUrl: '/guide/steg-hull.png',
        bodyMarkdown:
          'Velg den lille sylinderen og trykk `H` (eller bruk **Modus**-bryteren i panelet). ' +
          'Den blir rød og gjennomsiktig — det betyr at den skjærer seg ut av andre figurer.',
        validator: { type: 'shapeSize', kind: 'cylinder', mode: 'hole', dim: 'b', max: 10 },
      },
      {
        id: 'plasser-hull',
        title: 'Plasser hullet på skiven',
        imageUrl: '/guide/steg-plasser-hull.png',
        bodyMarkdown:
          'Dra den lille hull-sylinderen **inn på skiven, nær kanten** — den må overlappe ' +
          'skiven, men la det være igjen noen millimeter til kanten så merkelappen ikke ryker.',
        validator: { type: 'holeOverlapsSolid' },
      },
      {
        id: 'grupper',
        title: 'Grupper for å skjære hullet',
        imageUrl: '/guide/steg-ferdig.png',
        bodyMarkdown:
          'Velg **begge** figurene (dra en boks rundt dem, eller Shift-klikk) og trykk ' +
          '`Ctrl+G` eller **Grupper**-knappen. Nå skjæres hullet ut — merkelappen er ferdig!',
        validator: { type: 'hasGroup', withHole: true },
      },
      {
        id: 'ferdig',
        title: 'Ferdig — gjør den til din egen!',
        bodyMarkdown:
          'Flott jobbet! 🎉 Prøv gjerne å:\n\n' +
          '- legge på **Tekst** med navnet ditt\n' +
          '- endre **farge** i panelet til høyre\n' +
          '- eksportere **STL** fra knappen øverst når du vil 3D-printe',
        validator: { type: 'info' },
      },
    ],
  };

  // Navneskilt-guide: viser frem Plantegning-verktøyet. Sketch-stegene
  // valideres live mens editoren er åpen (via activeSketchData-speilet).
  const navneskiltGuide: AkseGuide = {
    id: 'demo-navneskilt',
    name: 'Lag et navneskilt',
    steps: [
      {
        id: 'intro',
        title: 'Vi lager et navneskilt!',
        imageUrl: '/guide/skilt-ferdig.png',
        bodyMarkdown:
          'Et **navneskilt** med avrundede hjørner, hull til nøkkelring og navnet ditt i 3D-tekst. ' +
          'Denne gangen tegner vi formen i **Plantegning** — skisseverktøyet der du tegner i 2D ' +
          'og løfter resultatet opp til 3D.',
        validator: { type: 'info' },
      },
      {
        id: 'avrundet-rektangel',
        title: 'Tegn et avrundet rektangel',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Klikk på **Plantegning** i biblioteket til venstre. Velg verktøyet ' +
          '**Avrundet rekt.** (tast `O`) og dra opp et rektangel midt på rutenettet. ' +
          'Guiden følger med mens du tegner.',
        validator: { type: 'sketchFigure', figureKind: 'roundedRect' },
      },
      {
        id: 'maal',
        title: 'Sett målene: 100 × 50',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Velg rektangelet med **Velg**-verktøyet (`V`) og sett i Egenskaper til høyre:\n\n' +
          '- **B (mm)** = `100`\n- **H (mm)** = `50`',
        validator: {
          type: 'sketchFigure',
          figureKind: 'roundedRect',
          minWidth: 95, maxWidth: 105,
          minHeight: 45, maxHeight: 55,
        },
      },
      {
        id: 'hoyde',
        title: 'Gjør skiltet 2 mm tynt',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Sett **3D-høyde (mm)** i panelet til høyre til `2` — et tynt og lett skilt.',
        validator: { type: 'sketchExtrudeHeight', min: 1, max: 3 },
      },
      {
        id: 'hjornehull',
        title: 'Lag hull i hjørnet',
        imageUrl: '/guide/skilt-hull.png',
        bodyMarkdown:
          'Velg **Sirkel** (`S`) og tegn en liten sirkel (radius ca. `3` mm) i det ene hjørnet — ' +
          'hold litt avstand til kanten. Sett **Modus** til **Hull**, så blir den oransje og stiplet.',
        validator: { type: 'sketchFigure', figureKind: 'circle', mode: 'hole', maxWidth: 12 },
      },
      {
        id: 'lag-3d',
        title: 'Lag 3D-modellen',
        imageUrl: '/guide/skilt-3d.png',
        bodyMarkdown:
          'Sjekk forhåndsvisningen nede til høyre, og trykk **Lag 3D-modell** — ' +
          'skiltet lander på arbeidsplaten med hullet ferdig utskåret.',
        validator: { type: 'hasShapeKind', kind: 'sketch' },
      },
      {
        id: 'tekst',
        title: 'Legg på navnet',
        imageUrl: '/guide/skilt-tekst.png',
        bodyMarkdown:
          'Klikk **Tekst** i biblioteket og plasser teksten på arbeidsplaten. ' +
          'Skriv navnet (f.eks. «Navnet») i **Tekst**-feltet i panelet til høyre.',
        validator: { type: 'hasShapeKind', kind: 'text' },
      },
      {
        id: 'plasser-tekst',
        title: 'Plasser navnet på skiltet',
        imageUrl: '/guide/skilt-ferdig.png',
        bodyMarkdown:
          'Dra teksten **inn på skiltet** og gjør den gjerne større — den må ligge oppå skiltet. ' +
          'Bytt gjerne farge på teksten i panelet, så navnet synes godt.',
        validator: { type: 'shapesOverlap', kindA: 'text', kindB: 'sketch' },
      },
      {
        id: 'ferdig',
        title: 'Navneskiltet er klart!',
        bodyMarkdown:
          'Supert! 🎉 Vil du justere formen? Velg skiltet og trykk **Rediger plantegning** — ' +
          'skissen kan alltid endres. Eksporter **STL** fra knappen øverst når du vil printe.',
        validator: { type: 'info' },
      },
    ],
  };

  let guideOpen = $state(false);
  $effect(() => {
    guideOpen = $page.url.searchParams.has('guide');
  });
  const aktivGuide = $derived(
    $page.url.searchParams.get('guide') === 'navneskilt' ? navneskiltGuide : demoGuide,
  );

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
  guide={guideOpen ? aktivGuide : null}
  onGuideClose={() => (guideOpen = false)}
/>

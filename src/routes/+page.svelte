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
    AkseLocale,
  } from '$lib/index';

  // Default to English; ?lang=no gives Norwegian.
  const initialLocale: AkseLocale = $derived(
    $page.url.searchParams.get('lang') === 'no' ? 'no' : 'en',
  );

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

  // ── English twins of the two demo guides ────────────────────────────────────
  // Same id / validator / imageUrl — only name, title, bodyMarkdown translated.
  const demoGuideEn: AkseGuide = {
    id: 'demo-nokkelring',
    name: 'Make a key fob tag',
    steps: [
      {
        id: 'intro',
        title: 'Welcome to Akse!',
        imageUrl: '/guide/steg-ferdig.png',
        bodyMarkdown:
          "We'll make a **key fob tag**: a round, flat disc with a small hole near the edge " +
          'that the key ring can thread through. Along the way you\'ll learn to add shapes, ' +
          'set exact measurements, make holes and group.',
        validator: { type: 'info' },
      },
      {
        id: 'skive',
        title: 'Add a cylinder',
        imageUrl: '/guide/steg-sylinder.png',
        bodyMarkdown:
          'Click **Cylinder** in the shape library on the left (or press `S`), and click ' +
          'in the middle of the work plane to place it. It will become the disc itself.',
        validator: { type: 'hasShapeKind', kind: 'cylinder' },
      },
      {
        id: 'flat-skive',
        title: 'Make it a flat disc',
        imageUrl: '/guide/steg-flat-skive.png',
        bodyMarkdown:
          'With the cylinder selected: go to **Size (mm)** in the panel on the right and set\n\n' +
          '- **W** = `40`\n- **D** = `40`\n- **H** = `6`\n\n' +
          'This gives a flat disc 4 cm across — just right for a tag.',
        validator: { type: 'shapeSize', kind: 'cylinder', dim: 'h', max: 8 },
      },
      {
        id: 'liten-sylinder',
        title: 'Add a small cylinder',
        imageUrl: '/guide/steg-liten-sylinder.png',
        bodyMarkdown:
          'Add **one more cylinder** a bit away from the disc. Set its size to ' +
          '**W** = `8` and **D** = `8` — it will become the key-ring hole.',
        validator: { type: 'shapeSize', kind: 'cylinder', dim: 'b', max: 10 },
      },
      {
        id: 'hull',
        title: 'Turn the small one into a hole',
        imageUrl: '/guide/steg-hull.png',
        bodyMarkdown:
          'Select the small cylinder and press `H` (or use the **Mode** toggle in the panel). ' +
          'It turns red and transparent — that means it cuts out of other shapes.',
        validator: { type: 'shapeSize', kind: 'cylinder', mode: 'hole', dim: 'b', max: 10 },
      },
      {
        id: 'plasser-hull',
        title: 'Position the hole on the disc',
        imageUrl: '/guide/steg-plasser-hull.png',
        bodyMarkdown:
          'Drag the small hole cylinder **onto the disc, near the edge** — it must overlap ' +
          'the disc, but leave a few millimetres to the edge so the tag does not break.',
        validator: { type: 'holeOverlapsSolid' },
      },
      {
        id: 'grupper',
        title: 'Group to cut the hole',
        imageUrl: '/guide/steg-ferdig.png',
        bodyMarkdown:
          'Select **both** shapes (drag a box around them, or Shift-click) and press ' +
          '`Ctrl+G` or the **Group** button. The hole is now cut out — your tag is done!',
        validator: { type: 'hasGroup', withHole: true },
      },
      {
        id: 'ferdig',
        title: 'Done — make it your own!',
        bodyMarkdown:
          'Great work! 🎉 Feel free to:\n\n' +
          '- add **Text** with your name\n' +
          '- change the **color** in the panel on the right\n' +
          '- export **STL** from the button at the top when you want to 3D-print',
        validator: { type: 'info' },
      },
    ],
  };

  const navneskiltGuideEn: AkseGuide = {
    id: 'demo-navneskilt',
    name: 'Make a name tag',
    steps: [
      {
        id: 'intro',
        title: "Let's make a name tag!",
        imageUrl: '/guide/skilt-ferdig.png',
        bodyMarkdown:
          'A **name tag** with rounded corners, a key-ring hole and your name in 3D text. ' +
          'This time we draw the shape in **Blueprint** — the sketch tool where you draw in 2D ' +
          'and lift the result up into 3D.',
        validator: { type: 'info' },
      },
      {
        id: 'avrundet-rektangel',
        title: 'Draw a rounded rectangle',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Click **Blueprint** in the library on the left. Choose the ' +
          '**Rounded rect.** tool (key `O`) and drag a rectangle in the middle of the grid. ' +
          'The guide follows along as you draw.',
        validator: { type: 'sketchFigure', figureKind: 'roundedRect' },
      },
      {
        id: 'maal',
        title: 'Set the dimensions: 100 × 50',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Select the rectangle with the **Select** tool (`V`) and set in Properties on the right:\n\n' +
          '- **W (mm)** = `100`\n- **H (mm)** = `50`',
        validator: {
          type: 'sketchFigure',
          figureKind: 'roundedRect',
          minWidth: 95, maxWidth: 105,
          minHeight: 45, maxHeight: 55,
        },
      },
      {
        id: 'hoyde',
        title: 'Make the tag 2 mm thin',
        imageUrl: '/guide/skilt-skisse.png',
        bodyMarkdown:
          'Set **3D height (mm)** in the panel on the right to `2` — a thin and lightweight tag.',
        validator: { type: 'sketchExtrudeHeight', min: 1, max: 3 },
      },
      {
        id: 'hjornehull',
        title: 'Make a hole in the corner',
        imageUrl: '/guide/skilt-hull.png',
        bodyMarkdown:
          'Choose **Circle** (`S`) and draw a small circle (radius about `3` mm) in one corner — ' +
          'keep a little distance from the edge. Set **Mode** to **Hole**, so it turns orange and dashed.',
        validator: { type: 'sketchFigure', figureKind: 'circle', mode: 'hole', maxWidth: 12 },
      },
      {
        id: 'lag-3d',
        title: 'Create the 3D model',
        imageUrl: '/guide/skilt-3d.png',
        bodyMarkdown:
          'Check the preview in the lower right, then click **Make 3D model** — ' +
          'the tag lands on the work plane with the hole already cut out.',
        validator: { type: 'hasShapeKind', kind: 'sketch' },
      },
      {
        id: 'tekst',
        title: 'Add your name',
        imageUrl: '/guide/skilt-tekst.png',
        bodyMarkdown:
          'Click **Text** in the library and place the text on the work plane. ' +
          'Type your name (e.g. "Your Name") in the **Text** field in the panel on the right.',
        validator: { type: 'hasShapeKind', kind: 'text' },
      },
      {
        id: 'plasser-tekst',
        title: 'Place the name on the tag',
        imageUrl: '/guide/skilt-ferdig.png',
        bodyMarkdown:
          'Drag the text **onto the tag** and make it a bit bigger — it must sit on top of the tag. ' +
          'Try changing the color of the text in the panel so the name stands out.',
        validator: { type: 'shapesOverlap', kindA: 'text', kindB: 'sketch' },
      },
      {
        id: 'ferdig',
        title: 'The name tag is ready!',
        bodyMarkdown:
          'Fantastic! 🎉 Want to adjust the shape? Select the tag and click **Edit blueprint** — ' +
          'the sketch can always be changed. Export **STL** from the button at the top when you want to print.',
        validator: { type: 'info' },
      },
    ],
  };

  // Select guide variant based on locale.
  const activeDemoGuide = $derived(initialLocale === 'en' ? demoGuideEn : demoGuide);
  const activeNavneskiltGuide = $derived(
    initialLocale === 'en' ? navneskiltGuideEn : navneskiltGuide,
  );

  let guideOpen = $state(false);
  $effect(() => {
    guideOpen = $page.url.searchParams.has('guide');
  });
  const aktivGuide = $derived(
    $page.url.searchParams.get('guide') === 'navneskilt' ? activeNavneskiltGuide : activeDemoGuide,
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
  locale={initialLocale}
  fontUrl="/fonts/inter-regular.ttf"
  texts={{ cloudUnavailable: 'Skylagring er ikke aktivert i denne demoen.' }}
  guide={guideOpen ? aktivGuide : null}
  onGuideClose={() => (guideOpen = false)}
/>

// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// @skaperiet/akse — UI-tekster med norsk + engelsk. Host kan overstyre enkelt-
// nøkler via <Akse texts={{ ... }} />. Interpolerte strenger bruker {token}-
// plassholdere fylt av interpolate().

export type AkseLocale = 'no' | 'en';

export interface AkseTexts {
  // ── Akse-root (Akse.svelte) ───────────────────────────────────────────────
  akseReadOnlyBanner: string;
  akseHideLibrary: string;
  akseShowLibrary: string;
  akseHidePanel: string;
  akseShowPanel: string;

  // ── TopBar ──────────────────────────────────────────────────────────────
  topbarLogoTitle: string;
  topbarLogoTaglineBefore: string;   // før «Skaperiet» (som står i <strong>)
  topbarLogoTaglineAfter: string;    // etter «Skaperiet»
  topbarProjectNamePlaceholder: string;
  topbarConfirmNewProject: string;
  topbarLoginRequiredForClone: string;
  topbarClonedProjectSuffix: string; // « (kopi)» / « (copy)»
  topbarNewProject: string;
  topbarStartGuide: string;
  topbarOpenProject: string;
  topbarSaveProject: string;
  topbarUndoTitle: string;
  topbarUndo: string;
  topbarRedoTitle: string;
  topbarRedo: string;
  topbarCopyTitle: string;
  topbarCopy: string;
  topbarPasteTitle: string;
  topbarPaste: string;
  topbarDuplicateTitle: string;
  topbarDuplicate: string;
  topbarExportStlTitle: string;
  topbarExportStl: string;
  topbarThemeToLight: string;
  topbarThemeToDark: string;
  topbarThemeToggle: string;
  topbarThemeDark: string;
  topbarThemeLight: string;
  topbarCloneTitle: string;
  topbarClone: string;
  topbarLanguageToggle: string;      // aria-label på NO/EN-veksleren

  // ── ShapeLibrary ────────────────────────────────────────────────────────
  shapeDrawing: string;
  shapeSketch: string;
  shapeText: string;
  shapeBox: string;
  shapeCylinder: string;
  shapeSphere: string;
  shapeCone: string;
  shapePyramid: string;
  shapeWedge: string;
  shapeTorus: string;
  shapeDrawingToolsHeading: string;
  shapePrimitivesHeading: string;
  shapeWithHotkey: string;           // '{label} (tast {hotkey})'
  shapeImportHeading: string;
  shapeImportStlTitle: string;
  shapeImportStlLabel: string;
  shapeStlNoTriangles: string;
  shapeStlTooMany: string;           // '...{count}...{limit}...'
  shapeStlWarningSlowdown: string;   // '...{count}...'
  shapeStlInvalid: string;

  // ── TransformPanel ──────────────────────────────────────────────────────
  transformEmptyState: string;
  transformPropertiesHeader: string;
  transformText: string;
  transformEditSketch: string;
  transformPositionLabel: string;
  transformDecreaseAxis: string;     // '{axis}'
  transformIncreaseAxis: string;     // '{axis}'
  transformRotationLabel: string;
  transformSnap: string;
  transformRotateAxis: string;       // '{axis}'
  transformRotationAxisDegrees: string; // '{axis}'
  transformSizeLabel: string;
  transformDecreaseSize: string;     // '{axis}'
  transformIncreaseSize: string;     // '{axis}'
  transformSketchLockedTooltip: string;
  transformSizeSketchHint: string;
  transformScaleLabel: string;
  transformScaleSketchLockedTooltip: string;
  transformScalePercentTooltip: string;
  transformScalePercent: string;
  transformScaleApply: string;
  transformScaleSlider: string;
  transformScaleSketchHint: string;
  transformScaleHint: string;
  transformModeLabel: string;
  transformModeHotkey: string;
  transformSolid: string;
  transformToggleSolidHole: string;
  transformHole: string;
  transformColorLabel: string;
  transformColorSwatch: string;      // '{color}'
  transformCustomColor: string;
  transformMultiSelectHeader: string; // '{count}'
  transformGroupPositionLabel: string;
  transformGroupSizeLabel: string;
  transformAlignLabel: string;
  transformAlignGroup: string;
  transformAlignTopLeft: string;
  transformAlignTopCenter: string;
  transformAlignTopRight: string;
  transformAlignMiddleLeft: string;
  transformAlignMiddleCenter: string;
  transformAlignMiddleRight: string;
  transformAlignBottomLeft: string;
  transformAlignBottomCenter: string;
  transformAlignBottomRight: string;
  transformDistributeLabel: string;
  transformDistributeWidthTooltip: string;
  transformDistributeWidth: string;
  transformDistributeDepthTooltip: string;
  transformDistributeDepth: string;
  transformGroupScaleLabel: string;
  transformGroupScaleTooltip: string;
  transformGroupScalePercent: string;
  transformGroupScaleApply: string;
  transformGroupScaleSlider: string;
  transformGroupScaleHint: string;

  // ── Modaler: Åpne ─────────────────────────────────────────────────────────
  modalOpenLoadError: string;
  modalOpenOpenError: string;
  modalOpenDeleteConfirm: string;    // '{name}'
  modalOpenDeleteError: string;
  modalOpenReadFileError: string;
  modalOpenEnterIdError: string;
  modalOpenCloneError: string;
  modalOpenLocalSectionTitle: string;
  modalOpenLocalSectionDesc: string;
  modalOpenFileButton: string;
  modalOpenCopySectionTitle: string;
  modalOpenCopyWarning: string;
  modalOpenProjectId: string;
  modalOpenProjectIdPlaceholder: string;
  modalOpenCopying: string;
  modalOpenCopy: string;
  modalOpenFilterPlaceholder: string;
  modalOpenLoading: string;
  modalOpenNoMatch: string;
  modalOpenNoProjects: string;
  modalOpenUnnamed: string;
  modalOpenOpen: string;
  modalOpenDelete: string;

  // ── Modaler: Lagre ────────────────────────────────────────────────────────
  modalSaveWriteFileError: string;
  modalSaveReadOnlyError: string;
  modalSaveOnlineError: string;
  modalSaveLocalSectionTitle: string;
  modalSaveLocalSectionDesc: string;
  modalSaveFilename: string;
  modalSaveFilenamePlaceholder: string;
  modalSaveToFile: string;
  modalSaveDownload: string;
  modalSaveSharedMsg: string;
  modalSaveName: string;
  modalSaveNamePlaceholder: string;
  modalSaveDescription: string;
  modalSaveDescriptionPlaceholder: string;
  modalSaveSaving: string;
  modalSaveSaved: string;

  // ── ScribbleEditor ──────────────────────────────────────────────────────
  scribbleNoPathsError: string;
  scribbleTitle: string;
  scribbleHintIntro: string;
  scribbleHintFillMode: string;
  scribbleHintLineMode: string;
  scribbleDrawTooltip: string;
  scribbleDraw: string;
  scribbleEraseTooltip: string;
  scribbleErase: string;
  scribbleUndoTooltip: string;
  scribbleRedoTooltip: string;
  scribbleFillToggle: string;
  scribblePreview3D: string;
  scribblePreviewEmpty: string;
  scribbleClear: string;

  // ── Plantegning ───────────────────────────────────────────────────────────
  plantegningTitle: string;
  plantegningMinFigureRequired: string;
  plantegningCreateModel: string;
  plantegningToolsHeading: string;
  plantegningSelectTool: string;
  plantegningRectangle: string;
  plantegningRoundedRect: string;
  plantegningCircle: string;
  plantegningEllipse: string;
  plantegningTriangle: string;
  plantegningPolygon: string;
  plantegningToolWithShortcut: string; // '{label} ({shortcut})'
  plantegningGroupTooltip: string;
  plantegningGroupDisabledTooltip: string;
  plantegningGroup: string;
  plantegningUngroupTooltip: string;
  plantegningUngroupDisabledTooltip: string;
  plantegningUngroup: string;
  plantegningMultiSelectActive: string;
  plantegningMultiSelect: string;
  plantegningPropertiesPanel: string;
  plantegningSelectToEdit: string;
  plantegningX: string;
  plantegningY: string;
  plantegningWidth: string;
  plantegningHeight: string;
  plantegningDimWidth: string;   // kort akse-bokstav foran mm-verdi (dimensjonslinje)
  plantegningDimHeight: string;
  plantegningCornerRadius: string;
  plantegningRadius: string;
  plantegningPolygonTags: string;
  plantegningPolygonSides: string;
  plantegningInnerRadius: string;
  plantegningApexX: string;
  plantegningApexXInfo: string;
  plantegningRadiusX: string;
  plantegningRadiusY: string;
  plantegningUngroupToResize: string;
  plantegningGroupedHint: string;
  plantegningRotation: string;
  plantegningPresetTriangles: string;
  plantegningTriangleEquilateral: string;
  plantegningTriangleRightLeft: string;
  plantegningTriangleRightRight: string;
  plantegningPolygonForm: string;
  plantegningPolygonRegular: string;
  plantegningPolygonStar: string;
  plantegningMode: string;
  plantegningModeSolid: string;
  plantegningModeHole: string;
  plantegningSelectedCount: string;  // '{count}'
  plantegningAlignLeft: string;
  plantegningAlignCenterH: string;
  plantegningAlignRight: string;
  plantegningAlignTop: string;
  plantegningAlignCenterV: string;
  plantegningAlignBottom: string;
  plantegning3DHeight: string;
  plantegning3DEmpty: string;
  plantegning3DError: string;

  // ── Guide-chrome (AkseGuideRunner) ────────────────────────────────────────
  guideChromeStepOf: string;         // 'Steg {current} av {total}'
  guideChromeCongrats: string;
  guideChromeCompletion: string;     // '{name}'
  guideChromeCloseGuide: string;
  guideChromeHideSteps: string;
  guideChromeShowSteps: string;
  guideChromeMinimize: string;
  guideChromeShowGuide: string;
  guideChromeStepPassed: string;
  guideChromeStepWaiting: string;
  guideChromeShowImageLarge: string;
  guideChromeBack: string;
  guideChromeNext: string;
  guideChromeMarkPassed: string;
  guideChromeSkip: string;

  // ── SceneCanvas ──────────────────────────────────────────────────────────
  sceneHomeTooltip: string;           // title på Hjem-knappen
  sceneHomeAria: string;              // aria-label på Hjem-knappen
  sceneHome: string;                  // label-tekst på Hjem-knappen
  sceneMoveTip: string;               // title på Flytt-knappen (inkl. hurtigtast)
  sceneMove: string;                  // label-tekst på Flytt-knappen
  sceneRotateAxis: string;            // title på akse-knapp: '{axis}'
  sceneRotateCCWTooltip: string;      // title CCW-knapp: '{axis}' og '{deg}'
  sceneRotateCCW: string;             // aria-label CCW-knapp
  sceneRotateFigure: string;          // aria-label på slider: '{axis}'
  sceneRotateCWTooltip: string;       // title CW-knapp: '{axis}' og '{deg}'
  sceneRotateCW: string;              // aria-label CW-knapp
  sceneCompiling: string;             // tekst i kompilerings-overlay

  // ── Felles ──────────────────────────────────────────────────────────────
  commonClose: string;
  commonCancel: string;

  // ── Sky/disk/nedlasting (uendret fra før, nå med EN) ──────────────────────
  cloudSaveTitle: string;
  cloudSaveIntro: string;
  cloudSaveLoginRequired: string;
  cloudOpenTitle: string;
  cloudOpenIntro: string;
  cloudOpenLoginRequired: string;
  cloudUnavailable: string;
  cloudLoginToWrite: string;
  diskFileUnsupported: string;
  downloadUnsupported: string;
}

export const NB_TEXTS: AkseTexts = {
  akseReadOnlyBanner: 'Du ser et delt prosjekt. Trykk "Ta en kopi" for å redigere.',
  akseHideLibrary: 'Skjul figurbibliotek',
  akseShowLibrary: 'Vis figurbibliotek',
  akseHidePanel: 'Skjul egenskaper',
  akseShowPanel: 'Vis egenskaper',
  topbarLogoTitle: 'Akse — en Skaperiet tjeneste',
  topbarLogoTaglineBefore: 'En ',
  topbarLogoTaglineAfter: ' tjeneste',
  topbarProjectNamePlaceholder: 'Navn på prosjekt',
  topbarConfirmNewProject: 'Forkast nåværende prosjekt og start på nytt?',
  topbarLoginRequiredForClone: 'Du må være logget inn for å lage en kopi',
  topbarClonedProjectSuffix: ' (kopi)',
  topbarNewProject: 'Nytt prosjekt',
  topbarStartGuide: 'Start en guide',
  topbarOpenProject: 'Åpne prosjekt',
  topbarSaveProject: 'Lagre prosjekt',
  topbarUndoTitle: 'Angre (Ctrl+Z)',
  topbarUndo: 'Angre',
  topbarRedoTitle: 'Gjør om (Ctrl+Shift+Z)',
  topbarRedo: 'Gjør om',
  topbarCopyTitle: 'Kopier valgte figurer (Ctrl+C)',
  topbarCopy: 'Kopier',
  topbarPasteTitle: 'Lim inn (Ctrl+V)',
  topbarPaste: 'Lim inn',
  topbarDuplicateTitle: 'Klon og kopier (Ctrl+D) — flytt klonen og klikk igjen for å gjenta mønsteret',
  topbarDuplicate: 'Klon og kopier',
  topbarExportStlTitle: 'Eksporter STL (for 3D-printing)',
  topbarExportStl: 'Eksporter STL',
  topbarThemeToLight: 'Bytt til lys bakgrunn',
  topbarThemeToDark: 'Bytt til mørk bakgrunn',
  topbarThemeToggle: 'Bytt bakgrunn i hovedområdet',
  topbarThemeDark: 'Mørk',
  topbarThemeLight: 'Lys',
  topbarCloneTitle: 'Ta en kopi du kan redigere',
  topbarClone: 'Ta en kopi',
  topbarLanguageToggle: 'Bytt språk',
  shapeDrawing: 'Tegning',
  shapeSketch: 'Plantegning',
  shapeText: 'Tekst',
  shapeBox: 'Kube',
  shapeCylinder: 'Sylinder',
  shapeSphere: 'Kule',
  shapeCone: 'Kjegle',
  shapePyramid: 'Pyramide',
  shapeWedge: 'Kile',
  shapeTorus: 'Smultring',
  shapeDrawingToolsHeading: 'Tegneverktøy',
  shapePrimitivesHeading: 'Grunnfigurer',
  shapeWithHotkey: '{label} (tast {hotkey})',
  shapeImportHeading: 'Importer',
  shapeImportStlTitle: 'Importer STL-fil',
  shapeImportStlLabel: 'STL-fil',
  shapeStlNoTriangles: 'Fant ingen trekanter i STL-filen.',
  shapeStlTooMany: 'Modellen har {count} trekanter — grensen her er {limit}. Forenkle modellen (f.eks. med «decimate» i et 3D-program eller i sliceren) og prøv igjen.',
  shapeStlWarningSlowdown: 'Modellen har {count} trekanter og kan gjøre Akse treg. Vil du importere likevel?',
  shapeStlInvalid: 'Kunne ikke lese STL-filen. Sjekk at den er en gyldig STL.',
  transformEmptyState: 'Velg en figur for å redigere',
  transformPropertiesHeader: 'Egenskaper',
  transformText: 'Tekst',
  transformEditSketch: 'Rediger plantegning',
  transformPositionLabel: 'Posisjon (mm) — venstre hjørne',
  transformDecreaseAxis: 'Reduser {axis}',
  transformIncreaseAxis: 'Øk {axis}',
  transformRotationLabel: 'Rotasjon (°)',
  transformSnap: 'Snap:',
  transformRotateAxis: 'Roter rundt {axis}-aksen',
  transformRotationAxisDegrees: 'Rotasjon rundt {axis}-aksen i grader',
  transformSizeLabel: 'Størrelse (mm)',
  transformDecreaseSize: 'Reduser størrelse {axis}',
  transformIncreaseSize: 'Øk størrelse {axis}',
  transformSketchLockedTooltip: 'Endre i Plantegning-editor',
  transformSizeSketchHint: 'Bredde og dybde redigeres i Plantegning-editoren.',
  transformScaleLabel: 'Skaler (%)',
  transformScaleSketchLockedTooltip: 'Skaler i Plantegning-editoren',
  transformScalePercentTooltip: 'Prosent av nåværende størrelse',
  transformScalePercent: 'Skaleringsprosent',
  transformScaleApply: 'Skaler',
  transformScaleSlider: 'Skaler figuren med slider',
  transformScaleSketchHint: 'Plantegninger skaleres i Plantegning-editoren.',
  transformScaleHint: '100 % = uendret, 200 % = dobbel størrelse, 50 % = halv.',
  transformModeLabel: 'Modus',
  transformModeHotkey: '(H)',
  transformSolid: 'Solid',
  transformToggleSolidHole: 'Veksle mellom solid og hull',
  transformHole: 'Hull',
  transformColorLabel: 'Farge',
  transformColorSwatch: 'Farge {color}',
  transformCustomColor: 'Egendefinert farge',
  transformMultiSelectHeader: '{count} figurer valgt',
  transformGroupPositionLabel: 'Gruppe-posisjon (mm)',
  transformGroupSizeLabel: 'Gruppe-størrelse (mm)',
  transformAlignLabel: 'Juster',
  transformAlignGroup: 'Juster figurene (sett ovenfra)',
  transformAlignTopLeft: 'Topp venstre',
  transformAlignTopCenter: 'Topp midt',
  transformAlignTopRight: 'Topp høyre',
  transformAlignMiddleLeft: 'Senter venstre',
  transformAlignMiddleCenter: 'Midtstilt',
  transformAlignMiddleRight: 'Senter høyre',
  transformAlignBottomLeft: 'Bunn venstre',
  transformAlignBottomCenter: 'Bunn midt',
  transformAlignBottomRight: 'Bunn høyre',
  transformDistributeLabel: 'Fordel jevnt',
  transformDistributeWidthTooltip: 'Lik avstand mellom figurene i bredden',
  transformDistributeWidth: 'I bredden',
  transformDistributeDepthTooltip: 'Lik avstand mellom figurene i dybden',
  transformDistributeDepth: 'I dybden',
  transformGroupScaleLabel: 'Skaler (%)',
  transformGroupScaleTooltip: 'Prosent av nåværende størrelse',
  transformGroupScalePercent: 'Skaleringsprosent for gruppen',
  transformGroupScaleApply: 'Skaler',
  transformGroupScaleSlider: 'Skaler gruppen med slider',
  transformGroupScaleHint: 'Skalerer alle valgte figurer rundt gruppens midtpunkt.',
  modalOpenLoadError: 'Klarte ikke laste prosjekter',
  modalOpenOpenError: 'Klarte ikke åpne prosjekt',
  modalOpenDeleteConfirm: 'Slette "{name}" permanent?',
  modalOpenDeleteError: 'Klarte ikke slette',
  modalOpenReadFileError: 'Klarte ikke å lese filen — sjekk at det er et gyldig Akse-prosjekt.',
  modalOpenEnterIdError: 'Skriv inn prosjekt-ID',
  modalOpenCloneError: 'Fant ikke prosjektet, eller klarte ikke åpne det.',
  modalOpenLocalSectionTitle: 'Åpne fra datamaskinen',
  modalOpenLocalSectionDesc: 'Hvis du tidligere har lagret et Akse-prosjekt som JSON-fil, eller fått en fra noen andre, kan du åpne det her.',
  modalOpenFileButton: 'Åpne prosjektfil (.json)',
  modalOpenCopySectionTitle: 'Kopier fra et annet prosjekt',
  modalOpenCopyWarning: 'Ved å kopiere et annet prosjekt opprettes en kopi for deg — originalen røres ikke.',
  modalOpenProjectId: 'Prosjekt-ID:',
  modalOpenProjectIdPlaceholder: 'Lim inn ID her',
  modalOpenCopying: 'Kopierer…',
  modalOpenCopy: 'Kopier prosjekt',
  modalOpenFilterPlaceholder: 'Filtrer prosjekter…',
  modalOpenLoading: 'Laster…',
  modalOpenNoMatch: 'Ingen prosjekter matcher filteret.',
  modalOpenNoProjects: 'Du har ingen lagrede prosjekter ennå.',
  modalOpenUnnamed: '(uten navn)',
  modalOpenOpen: 'Åpne',
  modalOpenDelete: 'Slett',
  modalSaveWriteFileError: 'Klarte ikke lagre til fil.',
  modalSaveReadOnlyError: 'Prosjektet er skrivebeskyttet — bruk "Ta en kopi" først.',
  modalSaveOnlineError: 'Klarte ikke lagre — sjekk at du er innlogget og prøv igjen.',
  modalSaveLocalSectionTitle: 'Lagre til fil',
  modalSaveLocalSectionDesc: 'Lagre prosjektet som JSON-fil på din egen PC. Du kan dele filen med andre, eller åpne den i Akse later.',
  modalSaveFilename: 'Filnavn:',
  modalSaveFilenamePlaceholder: 'Filnavn (uten .json)',
  modalSaveToFile: 'Lagre til fil…',
  modalSaveDownload: 'Last ned (.json)',
  modalSaveSharedMsg: 'Dette prosjektet er delt fra en annen bruker. Trykk "Ta en kopi" i toppmenyen for å lagre din egen versjon.',
  modalSaveName: 'Navn:',
  modalSaveNamePlaceholder: 'Navngi prosjektet ditt',
  modalSaveDescription: 'Beskrivelse (maks 150 tegn):',
  modalSaveDescriptionPlaceholder: 'Beskriv prosjektet ditt',
  modalSaveSaving: 'Lagrer…',
  modalSaveSaved: 'Lagret!',
  scribbleNoPathsError: 'Tegn minst én strek først',
  scribbleTitle: 'Tegn en figur',
  scribbleHintIntro: 'Tegn én eller flere streker.',
  scribbleHintFillMode: 'Streken behandles som en lukket figur som fylles og ekstruderes.',
  scribbleHintLineMode: 'Hver strek blir til en tykk linje (3mm) ekstrudert til 20mm høy.',
  scribbleDrawTooltip: 'Tegn streker',
  scribbleDraw: 'Tegn',
  scribbleEraseTooltip: 'Visk bort der du gnir',
  scribbleErase: 'Viskelær',
  scribbleUndoTooltip: 'Angre (Ctrl/Cmd+Z)',
  scribbleRedoTooltip: 'Gjør om (Ctrl/Cmd+Shift+Z)',
  scribbleFillToggle: 'Fyll figur (lukk og fyll streken)',
  scribblePreview3D: '3D-forhåndsvisning',
  scribblePreviewEmpty: 'Tegn en strek for å se 3D-modellen',
  scribbleClear: 'Tøm',
  plantegningTitle: 'Plantegning',
  plantegningMinFigureRequired: 'Tegn minst én figur før du lager 3D-modell',
  plantegningCreateModel: 'Lag 3D-modell',
  plantegningToolsHeading: 'Verktøy',
  plantegningSelectTool: 'Velg',
  plantegningRectangle: 'Rektangel',
  plantegningRoundedRect: 'Avrundet rekt.',
  plantegningCircle: 'Sirkel',
  plantegningEllipse: 'Ellipse',
  plantegningTriangle: 'Trekant',
  plantegningPolygon: 'Polygon',
  plantegningToolWithShortcut: '{label} ({shortcut})',
  plantegningGroupTooltip: 'Grupper valgte figurer (viser avstandsguider)',
  plantegningGroupDisabledTooltip: 'Velg minst to figurer som ikke alle deler samme gruppe',
  plantegningGroup: 'Grupper',
  plantegningUngroupTooltip: 'Fjern gruppe fra valgte figurer',
  plantegningUngroupDisabledTooltip: 'Ingen valgte figurer er gruppert',
  plantegningUngroup: 'Avgrupper',
  plantegningMultiSelectActive: '✓ Velger flere',
  plantegningMultiSelect: 'Velg flere',
  plantegningPropertiesPanel: 'Egenskaper',
  plantegningSelectToEdit: 'Velg en figur for å redigere',
  plantegningX: 'X (mm)',
  plantegningY: 'Y (mm)',
  plantegningWidth: 'B (mm)',
  plantegningHeight: 'H (mm)',
  plantegningDimWidth: 'B',
  plantegningDimHeight: 'H',
  plantegningCornerRadius: 'Hjørne-r (mm)',
  plantegningRadius: 'Radius (mm)',
  plantegningPolygonTags: 'Tagger',
  plantegningPolygonSides: 'Sider',
  plantegningInnerRadius: 'Innerradius (mm)',
  plantegningApexX: 'Topp-X (mm)',
  plantegningApexXInfo: 'Toppens X-offset fra base-sentrum',
  plantegningRadiusX: 'Radius X (mm)',
  plantegningRadiusY: 'Radius Y (mm)',
  plantegningUngroupToResize: 'Avgrupper først for å endre størrelse',
  plantegningGroupedHint: 'I gruppe — avgrupper for å endre størrelse',
  plantegningRotation: 'Rotasjon (°)',
  plantegningPresetTriangles: 'Standardtrekanter',
  plantegningTriangleEquilateral: 'Likesidet (60-60-60)',
  plantegningTriangleRightLeft: 'Rettvinklet venstre',
  plantegningTriangleRightRight: 'Rettvinklet høyre',
  plantegningPolygonForm: 'Form',
  plantegningPolygonRegular: 'Regulær n-kant',
  plantegningPolygonStar: 'Stjerne med valgt antall tagger',
  plantegningMode: 'Modus',
  plantegningModeSolid: 'Solid',
  plantegningModeHole: 'Hull',
  plantegningSelectedCount: '{count} figurer valgt',
  plantegningAlignLeft: 'Venstre-juster',
  plantegningAlignCenterH: 'Sentrer horisontalt',
  plantegningAlignRight: 'Høyre-juster',
  plantegningAlignTop: 'Topp-juster',
  plantegningAlignCenterV: 'Sentrer vertikalt',
  plantegningAlignBottom: 'Bunn-juster',
  plantegning3DHeight: '3D-høyde (mm)',
  plantegning3DEmpty: 'Tegn en figur for å se 3D-modellen',
  plantegning3DError: 'Kunne ikke oppdatere 3D',
  guideChromeStepOf: 'Steg {current} av {total}',
  guideChromeCongrats: 'Gratulerer!',
  guideChromeCompletion: 'Du har fullført «{name}».',
  guideChromeCloseGuide: 'Lukk guiden',
  guideChromeHideSteps: 'Skjul steg',
  guideChromeShowSteps: 'Vis steg',
  guideChromeMinimize: 'Minimer guiden',
  guideChromeShowGuide: 'Vis guiden',
  guideChromeStepPassed: '✓ Du har gjort det!',
  guideChromeStepWaiting: '⏳ Venter på handling…',
  guideChromeShowImageLarge: 'Vis bilde i stort format',
  guideChromeBack: 'Tilbake',
  guideChromeNext: 'Neste →',
  guideChromeMarkPassed: 'Forstått, gå videre',
  guideChromeSkip: 'Hopp over',
  sceneHomeTooltip: 'Hjem — roter kameraet tilbake til startvinkelen',
  sceneHomeAria: 'Hjem — tilbake til startvinkelen',
  sceneHome: 'Hjem',
  sceneMoveTip: 'Flytt (T)',
  sceneMove: 'Flytt',
  sceneRotateAxis: 'Roter rundt {axis}-aksen',
  sceneRotateCCWTooltip: 'Roter mot klokka rundt {axis} ({deg}°)',
  sceneRotateCCW: 'Roter mot klokka',
  sceneRotateFigure: 'Roter valgt figur rundt {axis}-aksen',
  sceneRotateCWTooltip: 'Roter med klokka rundt {axis} ({deg}°)',
  sceneRotateCW: 'Roter med klokka',
  sceneCompiling: 'Kombinerer figurer…',
  commonClose: 'Lukk',
  commonCancel: 'Avbryt',
  cloudSaveTitle: 'Lagre online',
  cloudSaveIntro: 'Lagre prosjektet på din Skaperiet-konto. Etter lagring kan du dele lenken og finne det igjen.',
  cloudSaveLoginRequired: 'Du må være logget inn for å lagre prosjekter på Skaperiet-kontoen din. Det er gratis å opprette en konto.',
  cloudOpenTitle: 'Hent fra skyen',
  cloudOpenIntro: 'Her finner du prosjekter du har lagret på din Skaperiet-konto.',
  cloudOpenLoginRequired: 'Du må være logget inn for å laste inn lagrede prosjekter. Det er gratis å opprette en konto hos Skaperiet.',
  cloudUnavailable: 'Sky-lagring er ikke tilgjengelig i denne versjonen av Akse.',
  cloudLoginToWrite: 'Logg inn for å lagre i skyen.',
  diskFileUnsupported: 'Nettleseren din støtter ikke direkte fil-lagring. Bruk "Last ned" i stedet.',
  downloadUnsupported: 'Fil-nedlasting er ikke tilgjengelig i denne nettleseren.',
};

export const EN_TEXTS: AkseTexts = {
  akseReadOnlyBanner: 'You are viewing a shared project. Click "Make a copy" to edit.',
  akseHideLibrary: 'Hide shape library',
  akseShowLibrary: 'Show shape library',
  akseHidePanel: 'Hide properties',
  akseShowPanel: 'Show properties',
  topbarLogoTitle: 'Akse — a Skaperiet service',
  topbarLogoTaglineBefore: 'A ',
  topbarLogoTaglineAfter: ' service',
  topbarProjectNamePlaceholder: 'Project name',
  topbarConfirmNewProject: 'Discard the current project and start over?',
  topbarLoginRequiredForClone: 'You must be logged in to make a copy',
  topbarClonedProjectSuffix: ' (copy)',
  topbarNewProject: 'New project',
  topbarStartGuide: 'Start a guide',
  topbarOpenProject: 'Open project',
  topbarSaveProject: 'Save project',
  topbarUndoTitle: 'Undo (Ctrl+Z)',
  topbarUndo: 'Undo',
  topbarRedoTitle: 'Redo (Ctrl+Shift+Z)',
  topbarRedo: 'Redo',
  topbarCopyTitle: 'Copy selected shapes (Ctrl+C)',
  topbarCopy: 'Copy',
  topbarPasteTitle: 'Paste (Ctrl+V)',
  topbarPaste: 'Paste',
  topbarDuplicateTitle: 'Clone and copy (Ctrl+D) — move the clone and click again to repeat the pattern',
  topbarDuplicate: 'Clone and copy',
  topbarExportStlTitle: 'Export STL (for 3D printing)',
  topbarExportStl: 'Export STL',
  topbarThemeToLight: 'Switch to light background',
  topbarThemeToDark: 'Switch to dark background',
  topbarThemeToggle: 'Toggle background in the main area',
  topbarThemeDark: 'Dark',
  topbarThemeLight: 'Light',
  topbarCloneTitle: 'Make a copy you can edit',
  topbarClone: 'Make a copy',
  topbarLanguageToggle: 'Change language',
  shapeDrawing: 'Drawing',
  shapeSketch: 'Blueprint',
  shapeText: 'Text',
  shapeBox: 'Box',
  shapeCylinder: 'Cylinder',
  shapeSphere: 'Sphere',
  shapeCone: 'Cone',
  shapePyramid: 'Pyramid',
  shapeWedge: 'Wedge',
  shapeTorus: 'Torus',
  shapeDrawingToolsHeading: 'Drawing tools',
  shapePrimitivesHeading: 'Basic shapes',
  shapeWithHotkey: '{label} (key {hotkey})',
  shapeImportHeading: 'Import',
  shapeImportStlTitle: 'Import STL file',
  shapeImportStlLabel: 'STL file',
  shapeStlNoTriangles: 'No triangles found in the STL file.',
  shapeStlTooMany: 'The model has {count} triangles — the limit here is {limit}. Simplify the model (e.g. with "decimate" in a 3D program or in the slicer) and try again.',
  shapeStlWarningSlowdown: 'The model has {count} triangles and may make Akse slow. Import anyway?',
  shapeStlInvalid: 'Could not read the STL file. Check that it is a valid STL.',
  transformEmptyState: 'Select a shape to edit',
  transformPropertiesHeader: 'Properties',
  transformText: 'Text',
  transformEditSketch: 'Edit blueprint',
  transformPositionLabel: 'Position (mm) — left corner',
  transformDecreaseAxis: 'Decrease {axis}',
  transformIncreaseAxis: 'Increase {axis}',
  transformRotationLabel: 'Rotation (°)',
  transformSnap: 'Snap:',
  transformRotateAxis: 'Rotate around the {axis} axis',
  transformRotationAxisDegrees: 'Rotation around the {axis} axis in degrees',
  transformSizeLabel: 'Size (mm)',
  transformDecreaseSize: 'Decrease size {axis}',
  transformIncreaseSize: 'Increase size {axis}',
  transformSketchLockedTooltip: 'Change in the Blueprint editor',
  transformSizeSketchHint: 'Width and depth are edited in the Blueprint editor.',
  transformScaleLabel: 'Scale (%)',
  transformScaleSketchLockedTooltip: 'Scale in the Blueprint editor',
  transformScalePercentTooltip: 'Percent of current size',
  transformScalePercent: 'Scale percentage',
  transformScaleApply: 'Scale',
  transformScaleSlider: 'Scale the shape with a slider',
  transformScaleSketchHint: 'Blueprints are scaled in the Blueprint editor.',
  transformScaleHint: '100 % = unchanged, 200 % = double size, 50 % = half.',
  transformModeLabel: 'Mode',
  transformModeHotkey: '(H)',
  transformSolid: 'Solid',
  transformToggleSolidHole: 'Toggle between solid and hole',
  transformHole: 'Hole',
  transformColorLabel: 'Color',
  transformColorSwatch: 'Color {color}',
  transformCustomColor: 'Custom color',
  transformMultiSelectHeader: '{count} shapes selected',
  transformGroupPositionLabel: 'Group position (mm)',
  transformGroupSizeLabel: 'Group size (mm)',
  transformAlignLabel: 'Align',
  transformAlignGroup: 'Align the shapes (top view)',
  transformAlignTopLeft: 'Top left',
  transformAlignTopCenter: 'Top center',
  transformAlignTopRight: 'Top right',
  transformAlignMiddleLeft: 'Center left',
  transformAlignMiddleCenter: 'Centered',
  transformAlignMiddleRight: 'Center right',
  transformAlignBottomLeft: 'Bottom left',
  transformAlignBottomCenter: 'Bottom center',
  transformAlignBottomRight: 'Bottom right',
  transformDistributeLabel: 'Distribute evenly',
  transformDistributeWidthTooltip: 'Equal spacing between shapes across the width',
  transformDistributeWidth: 'Across width',
  transformDistributeDepthTooltip: 'Equal spacing between shapes across the depth',
  transformDistributeDepth: 'Across depth',
  transformGroupScaleLabel: 'Scale (%)',
  transformGroupScaleTooltip: 'Percent of current size',
  transformGroupScalePercent: 'Scale percentage for the group',
  transformGroupScaleApply: 'Scale',
  transformGroupScaleSlider: 'Scale the group with a slider',
  transformGroupScaleHint: 'Scales all selected shapes around the group’s center.',
  modalOpenLoadError: 'Could not load projects',
  modalOpenOpenError: 'Could not open project',
  modalOpenDeleteConfirm: 'Delete "{name}" permanently?',
  modalOpenDeleteError: 'Could not delete',
  modalOpenReadFileError: 'Could not read the file — check that it is a valid Akse project.',
  modalOpenEnterIdError: 'Enter a project ID',
  modalOpenCloneError: 'Project not found, or could not open it.',
  modalOpenLocalSectionTitle: 'Open from your computer',
  modalOpenLocalSectionDesc: 'If you previously saved an Akse project as a JSON file, or received one from someone else, you can open it here.',
  modalOpenFileButton: 'Open project file (.json)',
  modalOpenCopySectionTitle: 'Copy from another project',
  modalOpenCopyWarning: 'Copying another project creates a copy for you — the original is not touched.',
  modalOpenProjectId: 'Project ID:',
  modalOpenProjectIdPlaceholder: 'Paste ID here',
  modalOpenCopying: 'Copying…',
  modalOpenCopy: 'Copy project',
  modalOpenFilterPlaceholder: 'Filter projects…',
  modalOpenLoading: 'Loading…',
  modalOpenNoMatch: 'No projects match the filter.',
  modalOpenNoProjects: 'You have no saved projects yet.',
  modalOpenUnnamed: '(untitled)',
  modalOpenOpen: 'Open',
  modalOpenDelete: 'Delete',
  modalSaveWriteFileError: 'Could not save to file.',
  modalSaveReadOnlyError: 'The project is read-only — use "Make a copy" first.',
  modalSaveOnlineError: 'Could not save — check that you are logged in and try again.',
  modalSaveLocalSectionTitle: 'Save to file',
  modalSaveLocalSectionDesc: 'Save the project as a JSON file on your own computer. You can share the file with others, or open it in Akse later.',
  modalSaveFilename: 'Filename:',
  modalSaveFilenamePlaceholder: 'Filename (without .json)',
  modalSaveToFile: 'Save to file…',
  modalSaveDownload: 'Download (.json)',
  modalSaveSharedMsg: 'This project is shared from another user. Click "Make a copy" in the top bar to save your own version.',
  modalSaveName: 'Name:',
  modalSaveNamePlaceholder: 'Name your project',
  modalSaveDescription: 'Description (max 150 chars):',
  modalSaveDescriptionPlaceholder: 'Describe your project',
  modalSaveSaving: 'Saving…',
  modalSaveSaved: 'Saved!',
  scribbleNoPathsError: 'Draw at least one stroke first',
  scribbleTitle: 'Draw a shape',
  scribbleHintIntro: 'Draw one or more strokes.',
  scribbleHintFillMode: 'The stroke is treated as a closed shape that is filled and extruded.',
  scribbleHintLineMode: 'Each stroke becomes a thick line (3mm) extruded to 20mm high.',
  scribbleDrawTooltip: 'Draw strokes',
  scribbleDraw: 'Draw',
  scribbleEraseTooltip: 'Erase where you rub',
  scribbleErase: 'Eraser',
  scribbleUndoTooltip: 'Undo (Ctrl/Cmd+Z)',
  scribbleRedoTooltip: 'Redo (Ctrl/Cmd+Shift+Z)',
  scribbleFillToggle: 'Fill shape (close and fill the stroke)',
  scribblePreview3D: '3D preview',
  scribblePreviewEmpty: 'Draw a stroke to see the 3D model',
  scribbleClear: 'Clear',
  plantegningTitle: 'Blueprint',
  plantegningMinFigureRequired: 'Draw at least one figure before creating a 3D model',
  plantegningCreateModel: 'Make 3D model',
  plantegningToolsHeading: 'Tools',
  plantegningSelectTool: 'Select',
  plantegningRectangle: 'Rectangle',
  plantegningRoundedRect: 'Rounded rect.',
  plantegningCircle: 'Circle',
  plantegningEllipse: 'Ellipse',
  plantegningTriangle: 'Triangle',
  plantegningPolygon: 'Polygon',
  plantegningToolWithShortcut: '{label} ({shortcut})',
  plantegningGroupTooltip: 'Group selected figures (shows distance guides)',
  plantegningGroupDisabledTooltip: 'Select at least two figures that don’t all share the same group',
  plantegningGroup: 'Group',
  plantegningUngroupTooltip: 'Remove group from selected figures',
  plantegningUngroupDisabledTooltip: 'No selected figures are grouped',
  plantegningUngroup: 'Ungroup',
  plantegningMultiSelectActive: '✓ Selecting multiple',
  plantegningMultiSelect: 'Select multiple',
  plantegningPropertiesPanel: 'Properties',
  plantegningSelectToEdit: 'Select a figure to edit',
  plantegningX: 'X (mm)',
  plantegningY: 'Y (mm)',
  plantegningWidth: 'W (mm)',
  plantegningHeight: 'H (mm)',
  plantegningDimWidth: 'W',
  plantegningDimHeight: 'H',
  plantegningCornerRadius: 'Corner r (mm)',
  plantegningRadius: 'Radius (mm)',
  plantegningPolygonTags: 'Points',
  plantegningPolygonSides: 'Sides',
  plantegningInnerRadius: 'Inner radius (mm)',
  plantegningApexX: 'Apex X (mm)',
  plantegningApexXInfo: 'Apex X offset from the base center',
  plantegningRadiusX: 'Radius X (mm)',
  plantegningRadiusY: 'Radius Y (mm)',
  plantegningUngroupToResize: 'Ungroup first to change the size',
  plantegningGroupedHint: 'In a group — ungroup to change the size',
  plantegningRotation: 'Rotation (°)',
  plantegningPresetTriangles: 'Standard triangles',
  plantegningTriangleEquilateral: 'Equilateral (60-60-60)',
  plantegningTriangleRightLeft: 'Right-angled left',
  plantegningTriangleRightRight: 'Right-angled right',
  plantegningPolygonForm: 'Form',
  plantegningPolygonRegular: 'Regular polygon',
  plantegningPolygonStar: 'Star with the chosen number of points',
  plantegningMode: 'Mode',
  plantegningModeSolid: 'Solid',
  plantegningModeHole: 'Hole',
  plantegningSelectedCount: '{count} figures selected',
  plantegningAlignLeft: 'Align left',
  plantegningAlignCenterH: 'Center horizontally',
  plantegningAlignRight: 'Align right',
  plantegningAlignTop: 'Align top',
  plantegningAlignCenterV: 'Center vertically',
  plantegningAlignBottom: 'Align bottom',
  plantegning3DHeight: '3D height (mm)',
  plantegning3DEmpty: 'Draw a figure to see the 3D model',
  plantegning3DError: 'Could not update the 3D model',
  guideChromeStepOf: 'Step {current} of {total}',
  guideChromeCongrats: 'Congratulations!',
  guideChromeCompletion: 'You completed "{name}".',
  guideChromeCloseGuide: 'Close the guide',
  guideChromeHideSteps: 'Hide steps',
  guideChromeShowSteps: 'Show steps',
  guideChromeMinimize: 'Minimize the guide',
  guideChromeShowGuide: 'Show the guide',
  guideChromeStepPassed: '✓ You did it!',
  guideChromeStepWaiting: '⏳ Waiting for action…',
  guideChromeShowImageLarge: 'Show image at full size',
  guideChromeBack: 'Back',
  guideChromeNext: 'Next →',
  guideChromeMarkPassed: 'Got it, continue',
  guideChromeSkip: 'Skip',
  sceneHomeTooltip: 'Home — rotate the camera back to the starting angle',
  sceneHomeAria: 'Home — back to the starting angle',
  sceneHome: 'Home',
  sceneMoveTip: 'Move (T)',
  sceneMove: 'Move',
  sceneRotateAxis: 'Rotate around the {axis} axis',
  sceneRotateCCWTooltip: 'Rotate counter-clockwise around {axis} ({deg}°)',
  sceneRotateCCW: 'Rotate counter-clockwise',
  sceneRotateFigure: 'Rotate the selected shape around the {axis} axis',
  sceneRotateCWTooltip: 'Rotate clockwise around {axis} ({deg}°)',
  sceneRotateCW: 'Rotate clockwise',
  sceneCompiling: 'Combining shapes…',
  commonClose: 'Close',
  commonCancel: 'Cancel',
  cloudSaveTitle: 'Save online',
  cloudSaveIntro: 'Save the project to your Skaperiet account. After saving you can share the link and find it again.',
  cloudSaveLoginRequired: 'You must be logged in to save projects to your Skaperiet account. Creating an account is free.',
  cloudOpenTitle: 'Open from the cloud',
  cloudOpenIntro: 'Here you’ll find projects you’ve saved to your Skaperiet account.',
  cloudOpenLoginRequired: 'You must be logged in to load saved projects. Creating a Skaperiet account is free.',
  cloudUnavailable: 'Cloud storage is not available in this version of Akse.',
  cloudLoginToWrite: 'Log in to save to the cloud.',
  diskFileUnsupported: 'Your browser does not support direct file saving. Use "Download" instead.',
  downloadUnsupported: 'File download is not available in this browser.',
};

const DICTS: Record<AkseLocale, AkseTexts> = { no: NB_TEXTS, en: EN_TEXTS };

/** Velg språk-ordbok og flett host-overstyringer over. */
export function resolveTexts(locale: AkseLocale, overrides?: Partial<AkseTexts>): AkseTexts {
  return { ...DICTS[locale], ...overrides };
}

/** Erstatt {token} i en mal med verdier. Ukjente tokens står urørt. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}

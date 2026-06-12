// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// @skaperiet/akse — ProjectStore

import type { AkseProject, Shape, ShapeKind } from '$lib/models';
import { blankProject, DEFAULT_COLORS, DEFAULT_WORKPLANE } from '$lib/models';
import { defaultsForKind } from './shapes';
import type { SketchData } from './plantegning/sketchTypes';
import { DEFAULT_EXTRUDE_HEIGHT_MM } from './plantegning/sketchTypes';
import { computeSketchBbox } from './plantegning/sketchExtrude';
import { generateUuidIsh } from '$lib/util/uuid';
import type { AkseStoragePort } from '$lib/config';

export type InputMode = 'pointer' | 'touch';
export type SceneTheme = 'dark' | 'light';

export class ProjectStore {
  project = $state<AkseProject>(blankProject('anonymous'));
  selectedIds = $state<Set<string>>(new Set());
  inputMode = $state<InputMode>('pointer');
  // Bakgrunns-tema for 3D-scenen. Per-sesjon UX-preferanse (som inputMode) —
  // bevisst IKKE en del av prosjekt-state, og bevares på tvers av init().
  sceneTheme = $state<SceneTheme>('light');
  // Rotasjons-snap i grader (1/22.5/45/90). Per-sesjon UX-preferanse delt mellom
  // scene-verktøylinjen og rotasjons-sliderne i Egenskaper-panelet.
  rotateSnapDeg = $state<number>(22.5);
  // True mens en tung CSG-kompilering pågår (f.eks. gruppering av tekst). Settes
  // av groupSelected() og nullstilles av SceneCanvas når rebuild er ferdig —
  // brukes til å vise en spinner.
  isCompiling = $state(false);
  currentUser = $state<string>('anonymous');
  readOnly = $state<boolean>(false);
  pendingShapeKind = $state<ShapeKind | null>(null);

  // ID til sketch-shape som skal re-redigeres. ShapeLibrary observerer dette
  // og åpner PlantegningEditor med shape.sketchData.
  editingSketchId = $state<string | null>(null);

  // Live speil av skissen som er åpen i Plantegning-editoren (null når lukket).
  // Settes av PlantegningEditor; brukes av guide-validatorene så steg kan få
  // grønn hake mens brukeren fortsatt tegner. Ikke en del av prosjekt-state.
  activeSketchData = $state<SketchData | null>(null);

  // True mens en editor-modal (Plantegning/Tegning) er åpen. Settes av
  // ShapeLibrary; guideboblen flytter seg til venstre side så den ikke
  // dekker modalens «Lag 3D-modell»-knapp nede til høyre.
  editorModalOpen = $state(false);

  // Persistens-porten host injiserer. ProjectStore kjenner ingen konkret backend.
  private storage?: AkseStoragePort;

  constructor(storage?: AkseStoragePort) {
    this.storage = storage;
  }

  /** Be ShapeLibrary åpne PlantegningEditor for en eksisterende sketch-shape. */
  requestEditSketch(id: string): void {
    if (this.readOnly) return;
    const shape = this.project.shapes.find(s => s.id === id);
    if (!shape || shape.kind !== 'sketch') return;
    this.editingSketchId = id;
  }

  // Fargerotasjon for nye shapes. Bevisst IKKE $state: aldri lest fra UI,
  // og er ikke en del av undo/redo-historikken (resetter ved init).
  private nextColorIndex = 0;

  // Sporer om dette prosjektet er lagret til cloud minst én gang.
  // $state slik at hasUnsavedChanges() er reaktivt i komponenter.
  private savedToCloud = $state(false);

  // $state-arrays så canUndo/canRedo blir reaktivt og knappene i TopBar viser riktig state
  private undoStack = $state<Shape[][]>([]);
  private redoStack = $state<Shape[][]>([]);
  private readonly MAX_HISTORY = 50;

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  /** True hvis prosjektet finnes i cloud (har vært lagret minst én gang). */
  isInCloud = $derived(this.savedToCloud);

  init(project: AkseProject, user: string, readOnly = false, isFromCloud = true): void {
    // inputMode er med vilje BEVART — det er en per-sesjon UX-preferanse, ikke prosjekt-state.
    // Defensiv: sikre at shapes/workplaneSize er gyldige arrays selv om innkommende data er ufullstendig.
    const safeProject: AkseProject = {
      ...project,
      shapes: Array.isArray(project.shapes) ? project.shapes : [],
      workplaneSize: Array.isArray(project.workplaneSize) ? project.workplaneSize : DEFAULT_WORKPLANE,
    };
    this.project = safeProject;
    this.currentUser = user;
    this.readOnly = readOnly;
    this.selectedIds = new Set();
    this.nextColorIndex = safeProject.shapes.length;
    this.undoStack = [];
    this.redoStack = [];
    this.savedToCloud = isFromCloud;
  }

  /**
   * Legg til en ny shape. Returnerer den nye shape-en (med ny uuid).
   * MERK: Dette er den ENESTE mutasjons-metoden som THROWER på readOnly —
   * andre metoder returnerer void/no-op stille. Årsak: callers forventer
   * et returverdi-objekt, og en silent no-op ville gitt `.id`-crash nedstrøms.
   * Caller bør sjekke `store.readOnly` selv før kall.
   */
  addShape(kind: ShapeKind, positionOverride?: [number, number, number]): Shape {
    if (this.readOnly) throw new Error('read-only');
    this.snapshot();
    const { size, position: defaultPos } = defaultsForKind(kind);
    // Hvis posisjon overstyres (f.eks. fra click-to-place), behold default Z (size[2]/2)
    // for å sørge for at figuren lander på arbeidsflaten.
    const position: [number, number, number] = positionOverride
      ? [positionOverride[0], positionOverride[1], defaultPos[2]]
      : defaultPos;
    const shape: Shape = {
      id: crypto.randomUUID(),
      kind,
      position,
      rotation: [0, 0, 0],
      size,
      color: DEFAULT_COLORS[this.nextColorIndex % DEFAULT_COLORS.length],
      mode: 'solid',
      groupId: null,
      ...(kind === 'text' ? { text: 'Tekst', textHeight: 5 } : {}),
    };
    this.nextColorIndex++;
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, shape],
    };
    this.selectedIds = new Set([shape.id]);
    this.pendingShapeKind = null;  // avslutt place-mode etter plassering
    return shape;
  }

  /**
   * Sett en figur-type som "pending" — neste klikk på arbeidsflaten plasserer den.
   * Sett til null for å avbryte.
   */
  setPendingShape(kind: ShapeKind | null): void {
    if (this.readOnly) return;
    this.pendingShapeKind = kind;
  }

  /**
   * Spesialisert variant av addShape for 'scribble' — krever et punktarray.
   * Punktene er flat [x0,y0,x1,y1,...] i mm sentrert om origo.
   */
  addScribbleShape(paths: number[][], fill = false): Shape {
    if (this.readOnly) throw new Error('read-only');
    this.snapshot();

    // Beregn bbox av tegnede punkter (i mm) for å sette initial size som matcher
    // brukerens faktiske tegning. Plus litt buffer for strek-tykkelsen.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const path of paths) {
      for (let i = 0; i < path.length; i += 2) {
        if (path[i] < minX) minX = path[i];
        if (path[i] > maxX) maxX = path[i];
        if (path[i + 1] < minY) minY = path[i + 1];
        if (path[i + 1] > maxY) maxY = path[i + 1];
      }
    }
    const STROKE_BUFFER = 4;  // ~1.5× strek-tykkelse for å fange inn ribbon-overflødigheter
    const drawnW = Math.max(10, Math.ceil(maxX - minX) + STROKE_BUFFER);
    const drawnD = Math.max(10, Math.ceil(maxY - minY) + STROKE_BUFFER);
    const defaults = defaultsForKind('scribble');
    const size: [number, number, number] = [drawnW, drawnD, defaults.size[2]];
    const position: [number, number, number] = [0, 0, defaults.size[2] / 2];

    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: 'scribble',
      position,
      rotation: [0, 0, 0],
      size,
      color: DEFAULT_COLORS[this.nextColorIndex % DEFAULT_COLORS.length],
      mode: 'solid',
      groupId: null,
      paths,
      scribbleFill: fill,
    };
    this.nextColorIndex++;
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, shape],
    };
    this.selectedIds = new Set([shape.id]);
    return shape;
  }

  /**
   * Spesialisert variant av addShape for 'sketch' — krever SketchData (figurer + dimensjoner).
   * Bbox av sketchen overskriver default size.
   */
  addSketchShape(data: SketchData): Shape {
    if (this.readOnly) throw new Error('read-only');
    this.snapshot();
    const bbox = computeSketchBbox(data);
    const drawnW = Math.max(10, bbox.width);
    const drawnD = Math.max(10, bbox.height);
    const extrudeHeight = data.extrudeHeight || DEFAULT_EXTRUDE_HEIGHT_MM;
    const size: [number, number, number] = [drawnW, drawnD, extrudeHeight];
    const position: [number, number, number] = [0, 0, extrudeHeight / 2];

    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: 'sketch',
      position,
      rotation: [0, 0, 0],
      size,
      color: DEFAULT_COLORS[this.nextColorIndex % DEFAULT_COLORS.length],
      mode: 'solid',
      groupId: null,
      sketchData: data,
    };
    this.nextColorIndex++;
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, shape],
    };
    this.selectedIds = new Set([shape.id]);
    return shape;
  }

  /**
   * Spesialisert variant av addShape for 'stl' — krever parsede STL-data
   * (fra parseStl i stlImport.ts). Modeller større enn arbeidsplaten skaleres
   * uniformt ned så de passer; ellers beholdes faktisk mm-størrelse fra filen.
   */
  addStlShape(parsed: { data: string; size: [number, number, number] }, name?: string): Shape {
    if (this.readOnly) throw new Error('read-only');
    this.snapshot();

    const [pw, pd, ph] = parsed.size;
    const [wpW, wpD, wpH] = this.project.workplaneSize;
    const fit = Math.min(1, wpW / pw, wpD / pd, wpH / ph);
    const r1 = (n: number) => Math.max(0.1, Math.round(n * 10) / 10);
    const size: [number, number, number] = [r1(pw * fit), r1(pd * fit), r1(ph * fit)];
    const position: [number, number, number] = [0, 0, size[2] / 2];

    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: 'stl',
      position,
      rotation: [0, 0, 0],
      size,
      color: DEFAULT_COLORS[this.nextColorIndex % DEFAULT_COLORS.length],
      mode: 'solid',
      groupId: null,
      stlData: parsed.data,
      ...(name ? { stlName: name } : {}),
    };
    this.nextColorIndex++;
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, shape],
    };
    this.selectedIds = new Set([shape.id]);
    return shape;
  }

  /**
   * Oppdater sketchData på en eksisterende sketch-shape, og rekompute bbox-baserte
   * size[0] og size[2] (size[1] = høyde styres separat).
   */
  updateSketchShape(id: string, data: SketchData): void {
    if (this.readOnly) return;
    this.snapshot();
    const bbox = computeSketchBbox(data);
    const drawnW = Math.max(10, bbox.width);
    const drawnD = Math.max(10, bbox.height);
    this.project = {
      ...this.project,
      shapes: this.project.shapes.map((s) => {
        if (s.id !== id) return s;
        // size[0]=width, size[1]=depth, size[2]=height (samme konvensjon som scribble)
        const newSize: [number, number, number] = [drawnW, drawnD, data.extrudeHeight];
        return { ...s, sketchData: data, size: newSize };
      }),
    };
  }

  updateShape(id: string, patch: Partial<Shape>): void {
    if (this.readOnly) return;
    this.snapshot();
    this.project = {
      ...this.project,
      shapes: this.project.shapes.map((s) =>
        s.id === id ? clampToGround(syncSketchHeight({ ...s, ...patch })) : s,
      ),
    };
  }

  updateShapes(ids: string[], patch: Partial<Shape>): void {
    if (this.readOnly) return;
    this.snapshot();
    const idSet = new Set(ids);
    this.project = {
      ...this.project,
      shapes: this.project.shapes.map((s) =>
        idSet.has(s.id) ? clampToGround(syncSketchHeight({ ...s, ...patch })) : s,
      ),
    };
  }

  deleteShapes(ids: string[]): void {
    if (this.readOnly) return;
    this.snapshot();
    const idSet = new Set(ids);
    this.project = {
      ...this.project,
      shapes: this.project.shapes.filter((s) => !idSet.has(s.id)),
    };
    this.selectedIds = new Set();
  }

  // «Klon og gjenta»: husk forrige klon (ids, posisjon ved kloning, steg-vektor).
  // Klones samme utvalg igjen etter at brukeren har flyttet det, gjentas flyttingen —
  // slik bygger man rekker/mønstre med gjentatte kloninger (Tinkercad-style Ctrl+D).
  private lastDup: {
    ids: Set<string>;
    spawn: Map<string, [number, number, number]>;
    step: [number, number, number];
  } | null = null;

  duplicateSelected(): void {
    if (this.readOnly) return;
    const selected = this.project.shapes.filter((s) => this.selectedIds.has(s.id));
    if (selected.length === 0) return;
    this.snapshot();

    // Steg: standard +10/+10. Men er utvalget forrige klon, blir steget
    // forrige steg + det brukeren har flyttet klonen siden den ble laget.
    let step: [number, number, number] = [10, 10, 0];
    const ld = this.lastDup;
    if (
      ld &&
      ld.ids.size === this.selectedIds.size &&
      [...this.selectedIds].every((id) => ld.ids.has(id))
    ) {
      const ref = selected[0];
      const spawn = ld.spawn.get(ref.id);
      if (spawn) {
        step = [
          ld.step[0] + (ref.position[0] - spawn[0]),
          ld.step[1] + (ref.position[1] - spawn[1]),
          ld.step[2] + (ref.position[2] - spawn[2]),
        ];
      }
    }

    const newShapes = selected.map((s) => clampToGround({
      ...s,
      id: crypto.randomUUID(),
      position: [
        s.position[0] + step[0],
        s.position[1] + step[1],
        s.position[2] + step[2],
      ] as [number, number, number],
      groupId: null,  // duplikater er alltid ugrupperte
    }));
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, ...newShapes],
    };
    this.selectedIds = new Set(newShapes.map((s) => s.id));
    this.lastDup = {
      ids: new Set(newShapes.map((s) => s.id)),
      spawn: new Map(newShapes.map((s) => [s.id, [...s.position] as [number, number, number]])),
      step,
    };
  }

  // --- Utklippstavle (kopier/lim inn, intern per økt) ---

  private clipboard = $state<Shape[] | null>(null);
  private pasteCount = 0;

  canPaste = $derived(this.clipboard !== null && this.clipboard.length > 0);

  copySelected(): void {
    const sel = this.selectedShapes();
    if (sel.length === 0) return;
    this.clipboard = $state.snapshot(sel) as Shape[];
    this.pasteCount = 0;
  }

  paste(): void {
    if (this.readOnly || !this.clipboard || this.clipboard.length === 0) return;
    this.snapshot();
    // Kumulativ forskyvning så gjentatte lim-inn ikke lander oppå hverandre
    this.pasteCount++;
    const offset = 10 * this.pasteCount;
    // Behold gruppering innad i det limte: remap gamle groupId-er til nye
    const groupMap = new Map<string, string>();
    const newShapes = this.clipboard.map((s) => {
      let groupId: string | null = null;
      if (s.groupId) {
        if (!groupMap.has(s.groupId)) groupMap.set(s.groupId, crypto.randomUUID());
        groupId = groupMap.get(s.groupId)!;
      }
      return clampToGround({
        ...s,
        id: crypto.randomUUID(),
        groupId,
        position: [s.position[0] + offset, s.position[1] + offset, s.position[2]] as [number, number, number],
      });
    });
    this.project = {
      ...this.project,
      shapes: [...this.project.shapes, ...newShapes],
    };
    this.selectedIds = new Set(newShapes.map((s) => s.id));
  }

  groupSelected(): void {
    if (this.readOnly) return;
    const ids = [...this.selectedIds];
    if (ids.length < 2) return;  // gruppe trenger minst 2
    this.snapshot();
    const newGroupId = crypto.randomUUID();
    this.updateShapes(ids, { groupId: newGroupId });
    // Tung geometri (tekst/plantegning/scribble) i gruppen betyr at CSG-
    // kompileringen kan ta tid — vis spinner. Enkle primitiver kompileres raskt
    // nok til at en spinner bare ville blinket. SceneCanvas nullstiller flagget
    // når den påfølgende rebuild-en er ferdig.
    const grouped = this.project.shapes.filter((s) => ids.includes(s.id));
    if (grouped.some((s) => s.kind === 'text' || s.kind === 'sketch' || s.kind === 'scribble' || s.kind === 'stl')) {
      this.isCompiling = true;
    }
  }

  ungroupSelected(): void {
    if (this.readOnly) return;
    const ids = [...this.selectedIds];
    if (ids.length === 0) return;
    // Plukk alle medlemmer av gruppene som er valgt (ikke bare de eksplisitt valgte)
    const affectedGroups = new Set(
      this.project.shapes
        .filter((s) => this.selectedIds.has(s.id) && s.groupId)
        .map((s) => s.groupId!),
    );
    if (affectedGroups.size === 0) return;
    const allIds = this.project.shapes
      .filter((s) => s.groupId && affectedGroups.has(s.groupId))
      .map((s) => s.id);
    this.snapshot();
    this.updateShapes(allIds, { groupId: null });
  }

  // --- Juster/fordel ---

  // Hover-preview: id → posisjonen figuren ville fått. SceneCanvas tegner
  // skygge-figurer fra denne; TransformPanel setter/nullstiller den på hover.
  alignPreview = $state<Map<string, [number, number, number]> | null>(null);

  /**
   * Juster valgte figurer langs en akse mot utvalgets felles bounding-boks.
   * edge: 'min' = venstre/foran/bunn, 'mid' = midt, 'max' = høyre/bak/topp.
   * Bbox per figur = position ± size/2 (samme tilnærming som groupBox i panelet).
   */
  alignSelected(axis: 0 | 1 | 2, edge: 'min' | 'mid' | 'max'): void {
    if (this.readOnly) return;
    this.applyMoves(computeAlignedPositions(this.selectedShapes(), axis, edge));
  }

  /**
   * Fordel valgte figurer jevnt langs en akse (krever 3+). Ytterste to figurer
   * ligger fast; de mellom flyttes så luften (kant-til-kant) blir lik. Hvis
   * figurene overlapper (negativ luft), fordeles sentrene jevnt i stedet.
   */
  distributeSelected(axis: 0 | 1 | 2): void {
    if (this.readOnly) return;
    this.applyMoves(computeDistributedPositions(this.selectedShapes(), axis));
  }

  /**
   * Juster valgte figurer i begge plan-aksene samtidig (3×3-rutenettet i panelet,
   * sett ovenfra): xEdge = venstre/midt/høyre, yEdge = foran(bunn)/senter/bak(topp).
   */
  alignSelectedXY(xEdge: 'min' | 'mid' | 'max', yEdge: 'min' | 'mid' | 'max'): void {
    if (this.readOnly) return;
    this.applyMoves(computeAlignedPositionsXY(this.selectedShapes(), xEdge, yEdge));
  }

  /** Vis skygge-preview av alignSelected uten å endre noe. */
  previewAlign(axis: 0 | 1 | 2, edge: 'min' | 'mid' | 'max'): void {
    const moves = computeAlignedPositions(this.selectedShapes(), axis, edge);
    this.alignPreview = moves.size > 0 ? moves : null;
  }

  /** Vis skygge-preview av alignSelectedXY uten å endre noe. */
  previewAlignXY(xEdge: 'min' | 'mid' | 'max', yEdge: 'min' | 'mid' | 'max'): void {
    const moves = computeAlignedPositionsXY(this.selectedShapes(), xEdge, yEdge);
    this.alignPreview = moves.size > 0 ? moves : null;
  }

  /** Vis skygge-preview av distributeSelected uten å endre noe. */
  previewDistribute(axis: 0 | 1 | 2): void {
    const moves = computeDistributedPositions(this.selectedShapes(), axis);
    this.alignPreview = moves.size > 0 ? moves : null;
  }

  clearAlignPreview(): void {
    this.alignPreview = null;
  }

  private applyMoves(moves: Map<string, [number, number, number]>): void {
    this.alignPreview = null;
    if (moves.size === 0) return;
    this.snapshot();
    this.project = {
      ...this.project,
      shapes: this.project.shapes.map((s) => {
        const p = moves.get(s.id);
        return p ? { ...s, position: p } : s;
      }),
    };
  }

  selectOne(id: string): void {
    this.selectedIds = new Set([id]);
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds = next;
  }

  deselectAll(): void {
    this.selectedIds = new Set();
  }

  selectAll(): void {
    this.selectedIds = new Set(this.project.shapes.map((s) => s.id));
  }

  setName(name: string): void {
    if (this.readOnly) return;
    this.project = { ...this.project, name };
  }

  setDescription(description: string): void {
    if (this.readOnly) return;
    this.project = { ...this.project, description };
  }

  setInputMode(mode: InputMode): void {
    this.inputMode = mode;
  }

  /** Veksle 3D-scenens bakgrunn mellom mørk og lys. */
  toggleSceneTheme(): void {
    this.sceneTheme = this.sceneTheme === 'dark' ? 'light' : 'dark';
  }

  /**
   * Lagre prosjektet via storage-porten.
   * create() første gang (savedToCloud=false), update() ellers.
   * Backend-spesifikke detaljer (f.eks. JSON.stringify av shapes for SequelAPI)
   * er host-adapterens ansvar — porten ser rene AkseProject-objekter.
   */
  async save(): Promise<void> {
    if (this.readOnly) throw new Error('read-only');
    if (!this.storage) throw new Error('Sky-lagring er ikke tilgjengelig');
    const now = new Date().toISOString();
    const projectToSave: AkseProject = { ...this.project, lastUsedDate: now };
    if (this.savedToCloud) {
      await this.storage.update(projectToSave.id, projectToSave);
    } else {
      await this.storage.create(projectToSave);
      this.savedToCloud = true;
    }
    this.project = projectToSave;
  }

  /**
   * Last et prosjekt via storage-porten og initier storen.
   */
  async load(id: string): Promise<void> {
    if (!this.storage) throw new Error('Sky-lagring er ikke tilgjengelig');
    const project = await this.storage.load(id);
    if (!project) throw new Error('Prosjekt ikke funnet');
    this.init(project, this.currentUser, project.user !== this.currentUser);
  }

  /**
   * Klon et prosjekt (ev. eid av annen bruker) inn som nytt fresh prosjekt
   * med gjeldende bruker som eier. Brukes til "kopier fra annet prosjekt" i Åpne-modalen.
   */
  async cloneFromCloud(id: string): Promise<void> {
    if (!this.storage) throw new Error('Sky-lagring er ikke tilgjengelig');
    const project = await this.storage.load(id);
    if (!project) throw new Error('Prosjekt ikke funnet');
    this.init(
      {
        ...project,
        id: generateUuidIsh(),
        user: this.currentUser,
        name: `${project.name} (kopi)`,
      },
      this.currentUser,
      false,
    );
    this.savedToCloud = false;
  }

  /**
   * Eksporter prosjektet som JSON (lokal fil-nedlasting). Caller bruker file-saver.
   */
  /** Prosjektet som pen JSON-streng (delt av nedlasting og direkte fil-lagring). */
  exportLocalJSONText(): string {
    return JSON.stringify(this.project, null, 2);
  }

  exportLocalJSON(): Blob {
    return new Blob([this.exportLocalJSONText()], { type: 'application/json' });
  }

  /**
   * Importer et prosjekt fra lokal JSON-fil. Tildeler ny id og setter currentUser
   * som eier — derfor er ikke readOnly relevant her (importen er en fresh start
   * uavhengig av om forrige prosjekt var read-only).
   */
  importLocalJSON(text: string): void {
    const parsed = JSON.parse(text) as AkseProject;
    if (
      !parsed ||
      !Array.isArray(parsed.shapes) ||
      typeof parsed.name !== 'string' ||
      !Array.isArray(parsed.workplaneSize)
    ) {
      throw new Error('Ugyldig prosjekt-fil');
    }
    this.init(
      { ...parsed, id: generateUuidIsh(), user: this.currentUser } as AkseProject,
      this.currentUser,
      false,  // import gir alltid en eid kopi
    );
    // Importert prosjekt finnes ikke i cloud ennå (init satte true, vi overrider)
    this.savedToCloud = false;
  }

  // Når true, dropper snapshot() for å gruppere drag-bevegelser til én undo-step.
  // Settes av beginTransaction()/endTransaction().
  private snapshotSuspended = false;

  private snapshot(): void {
    if (this.snapshotSuspended) return;
    const current = $state.snapshot(this.project.shapes) as Shape[];
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(current)) return;
    this.undoStack.push(current);
    if (this.undoStack.length > this.MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Start en batch-operasjon (f.eks. drag eller rotasjon).
   *  Tar én snapshot, og hopper over påfølgende snapshots til endTransaction() kalles. */
  beginTransaction(): void {
    if (this.readOnly) return;
    if (this.snapshotSuspended) return;  // allerede i en transaksjon
    this.snapshot();
    this.snapshotSuspended = true;
  }

  /** Avslutt batch-operasjonen. */
  endTransaction(): void {
    this.snapshotSuspended = false;
  }

  undo(): void {
    if (this.readOnly) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push($state.snapshot(this.project.shapes) as Shape[]);
    this.project = { ...this.project, shapes: prev };
  }

  redo(): void {
    if (this.readOnly) return;
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push($state.snapshot(this.project.shapes) as Shape[]);
    this.project = { ...this.project, shapes: next };
  }


  /** True hvis prosjektet har endringer som ikke er lagret til cloud. */
  hasUnsavedChanges(): boolean {
    return !this.savedToCloud || this.undoStack.length > 0;
  }

  // Derived: hentes i komponenter med store.selectedShapes() eller via $derived
  selectedShapes(): Shape[] {
    if (!Array.isArray(this.project.shapes)) return [];
    return this.project.shapes.filter((s) => this.selectedIds.has(s.id));
  }
}

export const STORE_CONTEXT_KEY = Symbol('akse-store');

/**
 * Beregn nye posisjoner for justering mot utvalgets felles bounding-boks.
 * Returnerer kun figurer som faktisk flytter seg (delt av apply og hover-preview).
 */
function computeAlignedPositions(
  shapes: Shape[],
  axis: 0 | 1 | 2,
  edge: 'min' | 'mid' | 'max',
): Map<string, [number, number, number]> {
  const moves = new Map<string, [number, number, number]>();
  if (shapes.length < 2) return moves;

  let min = Infinity, max = -Infinity;
  for (const s of shapes) {
    min = Math.min(min, s.position[axis] - s.size[axis] / 2);
    max = Math.max(max, s.position[axis] + s.size[axis] / 2);
  }
  const target = edge === 'min' ? min : edge === 'max' ? max : (min + max) / 2;

  const r1 = (n: number) => Math.round(n * 10) / 10;
  for (const s of shapes) {
    const half = s.size[axis] / 2;
    const newCoord = r1(edge === 'min' ? target + half : edge === 'max' ? target - half : target);
    if (newCoord === s.position[axis]) continue;
    const newPos = [...s.position] as [number, number, number];
    newPos[axis] = newCoord;
    // Bunn-klamp (kun relevant for Z-justering) — speiler clampToGround
    if (newPos[2] < s.size[2] / 2) newPos[2] = s.size[2] / 2;
    moves.set(s.id, newPos);
  }
  return moves;
}

/**
 * Kombinert X+Y-justering: slå sammen per-akse-resultatene til én flytting
 * per figur. Begge aksene regnes fra de opprinnelige posisjonene.
 */
function computeAlignedPositionsXY(
  shapes: Shape[],
  xEdge: 'min' | 'mid' | 'max',
  yEdge: 'min' | 'mid' | 'max',
): Map<string, [number, number, number]> {
  const mx = computeAlignedPositions(shapes, 0, xEdge);
  const my = computeAlignedPositions(shapes, 1, yEdge);
  const moves = new Map<string, [number, number, number]>();
  for (const s of shapes) {
    const px = mx.get(s.id);
    const py = my.get(s.id);
    if (!px && !py) continue;
    const newPos = [...s.position] as [number, number, number];
    if (px) newPos[0] = px[0];
    if (py) newPos[1] = py[1];
    moves.set(s.id, newPos);
  }
  return moves;
}

/**
 * Beregn nye posisjoner for jevn fordeling langs en akse (3+ figurer).
 * Lik luft kant-til-kant; senterfordeling som fallback ved overlapp.
 * Returnerer kun figurer som faktisk flytter seg (delt av apply og hover-preview).
 */
function computeDistributedPositions(
  shapes: Shape[],
  axis: 0 | 1 | 2,
): Map<string, [number, number, number]> {
  const moves = new Map<string, [number, number, number]>();
  if (shapes.length < 3) return moves;

  const sorted = [...shapes].sort((a, b) => a.position[axis] - b.position[axis]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanMin = first.position[axis] - first.size[axis] / 2;
  const spanMax = last.position[axis] + last.size[axis] / 2;
  const sumSizes = sorted.reduce((acc, s) => acc + s.size[axis], 0);
  const gap = (spanMax - spanMin - sumSizes) / (sorted.length - 1);

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const newCoords = new Map<string, number>();
  if (gap >= 0) {
    // Lik luft mellom figurene. Første/siste blir stående per konstruksjon.
    let cursor = spanMin;
    for (const s of sorted) {
      newCoords.set(s.id, r1(cursor + s.size[axis] / 2));
      cursor += s.size[axis] + gap;
    }
  } else {
    // Overlappende figurer: fordel sentrene jevnt mellom første og siste
    const cFirst = first.position[axis];
    const cLast = last.position[axis];
    sorted.forEach((s, i) => {
      newCoords.set(s.id, r1(cFirst + ((cLast - cFirst) * i) / (sorted.length - 1)));
    });
  }

  for (const s of sorted) {
    const c = newCoords.get(s.id);
    if (c === undefined || c === s.position[axis]) continue;
    const newPos = [...s.position] as [number, number, number];
    newPos[axis] = c;
    if (newPos[2] < s.size[2] / 2) newPos[2] = s.size[2] / 2;
    moves.set(s.id, newPos);
  }
  return moves;
}

/**
 * Sørger for at shapen ikke går under arbeidsflaten.
 * Internt er position[2] sentret; bunn = position[2] - size[2]/2.
 * Bunn må være ≥ 0, så minimum center_z = size_z/2.
 */
function clampToGround(s: Shape): Shape {
  const minCenterZ = s.size[2] / 2;
  if (s.position[2] < minCenterZ) {
    return { ...s, position: [s.position[0], s.position[1], minCenterZ] };
  }
  return s;
}

/**
 * For sketch-shapes: hold sketchData.extrudeHeight i sync med size[2].
 * Brukeren redigerer H i TransformPanel som size[2]; den faktiske 3D-ekstrusjonen
 * leser sketchData.extrudeHeight, så de må holdes sammen for at endringen skal
 * få effekt på geometrien (ikke bare bounding-boxen).
 */
function syncSketchHeight(s: Shape): Shape {
  if (s.kind !== 'sketch' || !s.sketchData) return s;
  if (s.sketchData.extrudeHeight === s.size[2]) return s;
  return {
    ...s,
    sketchData: { ...s.sketchData, extrudeHeight: s.size[2] },
  };
}

// Copyright (C) 2026 Skaperiet (Joachim Haagen Skeie)
// SPDX-License-Identifier: AGPL-3.0-only
// src/lib/akse/plantegning/SketchStore.svelte.ts
import type { SketchData, SketchFigure, SketchFigureKind } from './sketchTypes';
import { DEFAULT_EXTRUDE_HEIGHT_MM } from './sketchTypes';

let uuidCounter = 0;
function uuid(): string {
  uuidCounter++;
  return `sk_${Date.now().toString(36)}_${uuidCounter}`;
}

/** Konverter eldre triangle-figurer (kun `radius`) til parametrisk (width/height/apexX). */
function migrateLegacy(f: SketchFigure): SketchFigure {
  if (f.kind === 'triangle' && f.radius !== undefined && f.width === undefined) {
    const r = f.radius;
    const { radius, ...rest } = f;
    return {
      ...rest,
      width: r * Math.sqrt(3),
      height: r * 1.5,
      apexX: 0,
    };
  }
  return f;
}

export class SketchStore {
  figures = $state<SketchFigure[]>([]);
  extrudeHeight = $state<number>(DEFAULT_EXTRUDE_HEIGHT_MM);
  selectedIds = $state<Set<string>>(new Set());

  // Tegne-modus
  activeTool = $state<SketchFigureKind | 'select'>('select');

  // --- Undo/redo ($state-arrays så canUndo/canRedo blir reaktivt) ---
  private undoStack = $state<SketchData[]>([]);
  private redoStack = $state<SketchData[]>([]);
  private readonly MAX_UNDO = 50;

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  constructor(initial: SketchData) {
    this.figures = initial.figures.map(f => migrateLegacy({ ...f, position: { ...f.position } }));
    this.extrudeHeight = initial.extrudeHeight;
  }

  toSketchData(): SketchData {
    return {
      figures: this.figures.map(f => ({ ...f, position: { ...f.position } })),
      extrudeHeight: this.extrudeHeight,
    };
  }

  // --- Snapshot/undo helpers ---

  private snapshot(): void {
    this.undoStack.push(this.toSketchData());
    if (this.undoStack.length > this.MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.toSketchData());
    const prev = this.undoStack.pop()!;
    this.restore(prev);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.toSketchData());
    const next = this.redoStack.pop()!;
    this.restore(next);
  }

  private restore(data: SketchData): void {
    this.figures = data.figures.map(f => ({ ...f, position: { ...f.position } }));
    this.extrudeHeight = data.extrudeHeight;
    // Behold selection som er fortsatt gyldig
    const validIds = new Set(this.figures.map(f => f.id));
    this.selectedIds = new Set([...this.selectedIds].filter(id => validIds.has(id)));
  }

  // --- Figur-CRUD ---

  addFigure(partial: Omit<SketchFigure, 'id'>): SketchFigure {
    this.snapshot();
    const fig: SketchFigure = { ...partial, id: uuid() };
    this.figures = [...this.figures, fig];
    return fig;
  }

  updateFigure(id: string, patch: Partial<SketchFigure>): void {
    this.snapshot();
    this.figures = this.figures.map(f =>
      f.id === id ? { ...f, ...patch, position: patch.position ? { ...patch.position } : f.position } : f,
    );
  }

  deleteFigures(ids: string[]): void {
    if (ids.length === 0) return;
    this.snapshot();
    const idSet = new Set(ids);
    this.figures = this.figures.filter(f => !idSet.has(f.id));
    const newSel = new Set(this.selectedIds);
    for (const id of ids) newSel.delete(id);
    this.selectedIds = newSel;
  }

  duplicateFigures(ids: string[]): string[] {
    if (ids.length === 0) return [];
    this.snapshot();
    const idSet = new Set(ids);
    const newIds: string[] = [];
    const toAdd = this.figures
      .filter(f => idSet.has(f.id))
      .map(f => {
        const copy: SketchFigure = {
          ...f,
          id: uuid(),
          position: { x: f.position.x + 5, y: f.position.y + 5 },
        };
        newIds.push(copy.id);
        return copy;
      });
    this.figures = [...this.figures, ...toAdd];
    return newIds;
  }

  // Drag-start: ta én snapshot for hele drag-operasjonen
  beginDrag(): void {
    this.snapshot();
  }

  // Resize-bevegelse: ingen snapshot (allerede tatt i beginDrag)
  updateFigureLive(id: string, patch: Partial<SketchFigure>): void {
    this.figures = this.figures.map(f =>
      f.id === id ? { ...f, ...patch, position: patch.position ? { ...patch.position } : f.position } : f,
    );
  }

  // Drag-bevegelse: ingen snapshot (allerede tatt i beginDrag)
  updateFigurePosition(id: string, x: number, y: number): void {
    this.figures = this.figures.map(f =>
      f.id === id ? { ...f, position: { x, y } } : f,
    );
  }

  // --- Selection ---

  select(ids: string[], additive = false): void {
    if (additive) {
      const next = new Set(this.selectedIds);
      for (const id of ids) next.add(id);
      this.selectedIds = next;
    } else {
      this.selectedIds = new Set(ids);
    }
  }

  deselectAll(): void {
    this.selectedIds = new Set();
  }

  toggleMode(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.snapshot();
    this.figures = this.figures.map(f => {
      if (!ids.includes(f.id)) return f;
      return { ...f, mode: f.mode === 'solid' ? 'hole' : 'solid' };
    });
  }

  // --- Grupper (visuelle, ikke posisjons-låste) ---

  /** Sett samme nye groupId på alle valgte figurer. */
  groupSelected(): void {
    const ids = [...this.selectedIds];
    if (ids.length < 2) return;
    this.snapshot();
    const newGroupId = uuid();
    this.figures = this.figures.map(f =>
      this.selectedIds.has(f.id) ? { ...f, groupId: newGroupId } : f,
    );
  }

  /** Fjern groupId fra alle valgte figurer. */
  ungroupSelected(): void {
    const ids = [...this.selectedIds];
    if (ids.length === 0) return;
    const anyGrouped = this.figures.some(f => ids.includes(f.id) && f.groupId);
    if (!anyGrouped) return;
    this.snapshot();
    this.figures = this.figures.map(f => {
      if (!this.selectedIds.has(f.id)) return f;
      const { groupId, ...rest } = f;
      return rest;
    });
  }

  /** Returnerer alle figurer som deler en groupId med en valgt figur. */
  groupedWithSelected(): SketchFigure[] {
    const groupIds = new Set<string>();
    for (const f of this.figures) {
      if (this.selectedIds.has(f.id) && f.groupId) groupIds.add(f.groupId);
    }
    if (groupIds.size === 0) return [];
    return this.figures.filter(f => f.groupId && groupIds.has(f.groupId));
  }
}

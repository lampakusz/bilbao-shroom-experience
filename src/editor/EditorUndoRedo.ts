export interface EditorAction {
  name: string;
  undo: () => void;
  redo: () => void;
}

export type UndoRedoListener = (canUndo: boolean, canRedo: boolean, toastMessage?: string) => void;

export class EditorUndoRedo {
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];
  private maxHistory: number = 60;
  private listeners: Set<UndoRedoListener> = new Set();

  // Batch / compound action support (e.g. continuous brush strokes or box fills)
  private isBatching = false;
  private currentBatchName = '';
  private currentBatchUndoSteps: Array<() => void> = [];
  private currentBatchRedoSteps: Array<() => void> = [];

  constructor(maxHistory: number = 60) {
    this.maxHistory = maxHistory;
  }

  public subscribe(listener: UndoRedoListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(toastMessage?: string): void {
    const cu = this.canUndo();
    const cr = this.canRedo();
    this.listeners.forEach((fn) => {
      try {
        fn(cu, cr, toastMessage);
      } catch (err) {
        console.error('Error in UndoRedo listener:', err);
      }
    });
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoName(): string | undefined {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].name : undefined;
  }

  public getRedoName(): string | undefined {
    return this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].name : undefined;
  }

  public push(action: EditorAction): void {
    if (this.isBatching) {
      this.currentBatchUndoSteps.push(action.undo);
      this.currentBatchRedoSteps.push(action.redo);
      return;
    }

    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  public beginBatch(name: string): void {
    this.isBatching = true;
    this.currentBatchName = name;
    this.currentBatchUndoSteps = [];
    this.currentBatchRedoSteps = [];
  }

  public addBatchStep(undo: () => void, redo: () => void): void {
    if (!this.isBatching) {
      this.push({ name: 'Akció', undo, redo });
      return;
    }
    this.currentBatchUndoSteps.push(undo);
    this.currentBatchRedoSteps.push(redo);
  }

  public commitBatch(): void {
    if (!this.isBatching) return;
    this.isBatching = false;

    if (this.currentBatchUndoSteps.length === 0) {
      return;
    }

    const undoSteps = [...this.currentBatchUndoSteps];
    const redoSteps = [...this.currentBatchRedoSteps];
    const name = this.currentBatchName || 'Összetett szerkesztés';

    const compoundAction: EditorAction = {
      name,
      undo: () => {
        // Run undo steps in reverse order
        for (let i = undoSteps.length - 1; i >= 0; i--) {
          undoSteps[i]();
        }
      },
      redo: () => {
        // Run redo steps in forward order
        for (let i = 0; i < redoSteps.length; i++) {
          redoSteps[i]();
        }
      },
    };

    this.undoStack.push(compoundAction);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  public cancelBatch(): void {
    this.isBatching = false;
    this.currentBatchUndoSteps = [];
    this.currentBatchRedoSteps = [];
  }

  public undo(): boolean {
    if (this.isBatching) {
      this.commitBatch();
    }
    const action = this.undoStack.pop();
    if (!action) return false;

    try {
      action.undo();
      this.redoStack.push(action);
      this.notify(`↺ Visszavonva: ${action.name}`);
      return true;
    } catch (err) {
      console.error('Error executing undo action:', err);
      return false;
    }
  }

  public redo(): boolean {
    if (this.isBatching) {
      this.commitBatch();
    }
    const action = this.redoStack.pop();
    if (!action) return false;

    try {
      action.redo();
      this.undoStack.push(action);
      this.notify(`↻ Újraalkalmazva: ${action.name}`);
      return true;
    } catch (err) {
      console.error('Error executing redo action:', err);
      return false;
    }
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.isBatching = false;
    this.currentBatchUndoSteps = [];
    this.currentBatchRedoSteps = [];
    this.notify();
  }
}

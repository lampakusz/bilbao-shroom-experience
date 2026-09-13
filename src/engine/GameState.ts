export enum GameMode {
  MENU = 'menu',
  PLAYING = 'playing',
  SETTINGS = 'settings',
  EDITOR = 'editor',
}

export type ModeChangeCallback = (newMode: GameMode, oldMode: GameMode) => void;

export class GameStateManager {
  private static instance: GameStateManager | null = null;
  private currentMode: GameMode = GameMode.MENU;
  private listeners = new Set<ModeChangeCallback>();
  private flags = new Map<string, any>();

  private constructor() {}

  public setFlag(key: string, value: any): void {
    this.flags.set(key, value);
  }

  public getFlag<T = any>(key: string): T | undefined {
    return this.flags.get(key) as T | undefined;
  }

  public hasFlag(key: string): boolean {
    return this.flags.has(key);
  }

  public clearFlag(key: string): void {
    this.flags.delete(key);
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  public getMode(): GameMode {
    return this.currentMode;
  }

  public setMode(newMode: GameMode): void {
    if (this.currentMode === newMode) return;
    const oldMode = this.currentMode;
    this.currentMode = newMode;

    for (const listener of this.listeners) {
      listener(newMode, oldMode);
    }
  }

  public onModeChange(callback: ModeChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const gameState = GameStateManager.getInstance();

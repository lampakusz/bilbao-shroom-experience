import type { LevelData } from './Level.ts';
import { ALL_LEVELS } from './levelsData.ts';
import { TileTheme, TileType } from './TileTypes.ts';
import { musicManager } from '../audio/MusicManager.ts';

export const STORAGE_KEY_CAMPAIGN = 'custom_campaign_data';
export const CAMPAIGN_VERSION = 'v5.0_custom_save_persistent';

export interface CampaignData {
  version?: string;
  id: string;
  name: string;
  levels: LevelData[];
}

export function createBlankLevel(index: number): LevelData {
  return {
    id: `custom_level_${Date.now()}_${index}`,
    name: `Szint ${index + 1}`,
    theme: TileTheme.DOWNTOWN,
    spawnP1: [2, 2],
    spawnP2: [2, 4],
    tiles: [
      { id: TileType.DOWNTOWN_SIDEWALK, x: 2, y: 0, z: 2, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 2, y: 0, z: 3, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 2, y: 0, z: 4, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 3, y: 0, z: 2, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 3, y: 0, z: 3, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 3, y: 0, z: 4, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 4, y: 0, z: 2, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 4, y: 0, z: 3, solid: false },
      { id: TileType.DOWNTOWN_SIDEWALK, x: 4, y: 0, z: 4, solid: false },
    ],
    exitPortal: [4, 4],
  };
}

export class CampaignManager {
  private campaign: CampaignData;
  private activeLevelIndex = 0;
  private listeners: Array<(campaign: CampaignData) => void> = [];

  constructor() {
    this.campaign = this.loadFromLocalStorage() || this.createDefaultCampaign();
  }

  private createDefaultCampaign(): CampaignData {
    return {
      version: CAMPAIGN_VERSION,
      id: 'bilbao_campaign',
      name: 'Bilbao Shroom Odüsszeia',
      levels: JSON.parse(JSON.stringify(ALL_LEVELS)),
    };
  }

  public getCampaign(): CampaignData {
    return this.campaign;
  }

  public getLevels(): LevelData[] {
    return this.campaign.levels;
  }

  public getActiveIndex(): number {
    return this.activeLevelIndex;
  }

  public setActiveIndex(index: number): void {
    if (index >= 0 && index < this.campaign.levels.length) {
      this.activeLevelIndex = index;
      musicManager.playLevelMusic(index);
    }
  }

  public loadLevel(levelIndex: number): LevelData | undefined {
    musicManager.playLevelMusic(levelIndex);
    if (levelIndex >= 0 && levelIndex < this.campaign.levels.length) {
      this.activeLevelIndex = levelIndex;
      const lvl = this.campaign.levels[this.activeLevelIndex];
      this.saveToLocalStorage();
      this.notifyListeners();
      return lvl;
    }
    return undefined;
  }

  public restartCurrentLevel(): LevelData {
    const idx = this.activeLevelIndex;
    musicManager.playLevelMusic(idx);
    const lvl = this.campaign.levels[idx] || this.getActiveLevel();
    return lvl;
  }

  public nextLevel(): LevelData | null {
    try {
      const nextIndex = this.activeLevelIndex + 1;
      console.log('[CampaignManager] Transitioning to level index:', nextIndex);
      musicManager.playLevelMusic(nextIndex);
      if (nextIndex >= this.campaign.levels.length) {
        console.log('[CampaignManager] Reached end of campaign!');
        return null;
      }
      return this.loadLevel(nextIndex) || null;
    } catch (err) {
      console.error('[CampaignManager] Error advancing to next level:', err);
      return null;
    }
  }

  public getActiveLevel(): LevelData {
    if (this.campaign.levels.length === 0) {
      this.campaign.levels.push(createBlankLevel(0));
    }
    const idx = Math.min(this.activeLevelIndex, this.campaign.levels.length - 1);
    this.activeLevelIndex = Math.max(0, idx);
    return this.campaign.levels[this.activeLevelIndex];
  }

  public getLevel(index: number): LevelData | undefined {
    return this.campaign.levels[index];
  }

  public updateLevel(index: number, levelData: LevelData): void {
    if (index >= 0 && index < this.campaign.levels.length) {
      this.campaign.levels[index] = { ...levelData };
      this.saveToLocalStorage();
      this.notifyListeners();
    }
  }

  public renameLevel(index: number, newName: string): void {
    if (index >= 0 && index < this.campaign.levels.length) {
      this.campaign.levels[index].name = newName;
      this.saveToLocalStorage();
      this.notifyListeners();
    }
  }

  public moveLevel(fromIndex: number, toIndex: number): void {
    const len = this.campaign.levels.length;
    if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len || fromIndex === toIndex) {
      return;
    }

    const [moved] = this.campaign.levels.splice(fromIndex, 1);
    this.campaign.levels.splice(toIndex, 0, moved);

    if (this.activeLevelIndex === fromIndex) {
      this.activeLevelIndex = toIndex;
    } else if (fromIndex < this.activeLevelIndex && toIndex >= this.activeLevelIndex) {
      this.activeLevelIndex--;
    } else if (fromIndex > this.activeLevelIndex && toIndex <= this.activeLevelIndex) {
      this.activeLevelIndex++;
    }

    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public addLevel(levelData?: LevelData): LevelData {
    const newLevel = levelData || createBlankLevel(this.campaign.levels.length);
    this.campaign.levels.push(newLevel);
    this.activeLevelIndex = this.campaign.levels.length - 1;
    this.saveToLocalStorage();
    this.notifyListeners();
    return newLevel;
  }

  public cloneLevel(index: number): LevelData | undefined {
    if (index < 0 || index >= this.campaign.levels.length) return undefined;
    const source = this.campaign.levels[index];
    const cloned: LevelData = JSON.parse(JSON.stringify(source));
    cloned.id = `${source.id}_copy_${Date.now()}`;
    cloned.name = `${source.name} (Másolat)`;
    this.campaign.levels.splice(index + 1, 0, cloned);
    this.activeLevelIndex = index + 1;
    this.saveToLocalStorage();
    this.notifyListeners();
    return cloned;
  }

  public deleteLevel(index: number): boolean {
    if (this.campaign.levels.length <= 1) {
      return false;
    }
    if (index < 0 || index >= this.campaign.levels.length) return false;

    this.campaign.levels.splice(index, 1);
    if (this.activeLevelIndex >= this.campaign.levels.length) {
      this.activeLevelIndex = this.campaign.levels.length - 1;
    }
    this.saveToLocalStorage();
    this.notifyListeners();
    return true;
  }

  public saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(this.campaign));
    } catch (err) {
      console.warn('Failed to save campaign to localStorage:', err);
    }
  }

  // Campaign Run Statistics
  private runPlayTime = 0;
  private runTotalRelicsCollected = 0;
  private runStunCount = 0;

  public resetRunStats(): void {
    this.runPlayTime = 0;
    this.runTotalRelicsCollected = 0;
    this.runStunCount = 0;
  }

  public addPlayTime(delta: number): void {
    this.runPlayTime += delta;
  }

  public getPlayTime(): number {
    return this.runPlayTime;
  }

  public addRelicCollected(): void {
    this.runTotalRelicsCollected++;
  }

  public getTotalRelicsCollected(): number {
    return this.runTotalRelicsCollected;
  }

  public addStun(): void {
    this.runStunCount++;
  }

  public getStunCount(): number {
    return this.runStunCount;
  }

  public resetToDefault(): CampaignData {
    this.campaign = this.createDefaultCampaign();
    this.activeLevelIndex = 0;
    this.resetRunStats();
    this.saveToLocalStorage();
    this.notifyListeners();
    return this.campaign;
  }

  public resetCampaignToFactory(): CampaignData {
    try {
      localStorage.removeItem(STORAGE_KEY_CAMPAIGN);
      localStorage.removeItem('custom_edited_level');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('bilbao_campaign_') || k.startsWith('custom_campaign_'))) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore
    }

    this.campaign = this.createDefaultCampaign();
    this.activeLevelIndex = 0;
    this.resetRunStats();
    this.saveToLocalStorage();
    this.notifyListeners();
    return this.campaign;
  }

  public loadFromLocalStorage(): CampaignData | null {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY_CAMPAIGN);
      if (dataStr) {
        const parsed = JSON.parse(dataStr) as CampaignData;
        if (
          parsed &&
          parsed.version === CAMPAIGN_VERSION &&
          Array.isArray(parsed.levels) &&
          parsed.levels.length >= 6
        ) {
          // Preserve user-edited campaign data as-is (no overwrite with defaults)
          return parsed;
        }
        console.warn(`Upgrading campaign data in localStorage to ${CAMPAIGN_VERSION} with 6 levels.`);
        const defaultCamp = this.createDefaultCampaign();
        localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(defaultCamp));
        return defaultCamp;
      }
    } catch (err) {
      console.warn('Failed to load campaign from localStorage, resetting cleanly to default 5 levels:', err);
      const defaultCamp = this.createDefaultCampaign();
      try {
        localStorage.setItem(STORAGE_KEY_CAMPAIGN, JSON.stringify(defaultCamp));
      } catch (saveErr) {
        console.warn('Failed to save reset campaign:', saveErr);
      }
      return defaultCamp;
    }
    return null;
  }

  public exportCampaignJSON(): void {
    const jsonStr = JSON.stringify(this.campaign, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campaign.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  public importCampaignJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);

      // Format 1: Full campaign object { levels: [...], id, name, ... }
      if (parsed && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
        this.campaign = parsed as CampaignData;
        this.campaign.version = CAMPAIGN_VERSION;
        this.activeLevelIndex = 0;
        this.saveToLocalStorage();
        this.notifyListeners();
        return true;
      }

      // Format 2: Array of level objects [ { tiles: [...], ... }, ... ]
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.tiles) {
        this.campaign.levels = parsed;
        this.campaign.version = CAMPAIGN_VERSION;
        this.activeLevelIndex = 0;
        this.saveToLocalStorage();
        this.notifyListeners();
        return true;
      }

      // Format 3: Single level object { tiles: [...], spawnP1, ... }
      if (parsed && Array.isArray(parsed.tiles)) {
        const idx = this.activeLevelIndex;
        this.campaign.levels[idx] = parsed;
        this.campaign.version = CAMPAIGN_VERSION;
        this.saveToLocalStorage();
        this.notifyListeners();
        return true;
      }
    } catch (err) {
      console.warn('Failed to import campaign JSON:', err);
    }
    return false;
  }

  public onChange(fn: (campaign: CampaignData) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.campaign);
    }
  }
}

export const campaignManager = new CampaignManager();

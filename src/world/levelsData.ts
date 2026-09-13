import type { LevelData } from './Level.ts';

// Level data now comes from the redesigned campaign exports the user placed in
// src/world/data/ (copied from public/textures/level_*_1.json, which stays untouched as the
// user's own working copy). Each file is a full Level.toJSON() snapshot produced by the
// in-game Level Editor's per-level save button, so it already carries grid/tiles, platePairs,
// switches, keypads, relics, heavyObstacles, enemies, cars, dialogue and objectives.
import level1Json from './data/level_1_apartment.json';
import level2Json from './data/level_2_street.json';
import level3Json from './data/level_3_metro.json';
import level4Json from './data/level_4_suburban.json';
import level5Json from './data/level_5_sopelana.json';
import level6Json from './data/level_6_etxebarria.json';

export const LEVEL_1: LevelData = level1Json as unknown as LevelData;
export const LEVEL_2: LevelData = level2Json as unknown as LevelData;
export const LEVEL_3: LevelData = level3Json as unknown as LevelData;
export const LEVEL_4: LevelData = level4Json as unknown as LevelData;
export const LEVEL_5: LevelData = level5Json as unknown as LevelData;
export const LEVEL_6: LevelData = level6Json as unknown as LevelData;

export const ALL_LEVELS: LevelData[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6];
export const ALL_6_LEVELS = ALL_LEVELS;
export const ALL_5_LEVELS = ALL_LEVELS;
export const LEVEL_1_DOWNTOWN = LEVEL_1;
export const LEVEL_2_METRO = LEVEL_3;
export const LEVEL_3_SOPELANA = LEVEL_5;
export const LEVEL_ETXEBARRIA = LEVEL_6;

import type { EnemyConfig } from '../entities/EnemyTypes.ts';

import { TileTheme, TileType } from '../types/LevelTypes.ts';
import type { HeavyObstacleData } from '../types/LevelTypes.ts';
export { TileTheme, TileType };

export interface SwitchButtonData {
  id: string;
  position: [number, number]; // [gx, gz]
  targetDoorId?: string;
  targetObstacle?: [number, number];
  isPressed?: boolean;
}

export interface KeypadTerminalData {
  id: string;
  position: [number, number]; // [gx, gz]
  targetDoorId?: string;
  targetObstacle?: [number, number];
  code?: string; // default "420"
  isUnlocked?: boolean;
}

export interface CarConfig {
  spawnPos: [number, number, number]; // [worldX, worldY, worldZ]
  axis?: 'x' | 'z'; // default 'x'
  direction?: 1 | -1; // default 1
  speed?: number; // m/s, default 10.0
  boundsMin: number;
  boundsMax: number;
  colorHex?: number;
}

export type StairDirection = 'north' | 'south' | 'east' | 'west';

export type RelicType = 'mushroom' | 'joint';

export interface RelicData {
  id: string;
  type?: RelicType;
  position: [number, number]; // [gx, gz]
  x?: number;
  z?: number;
}

export interface TileData {
  id: TileType;
  x: number;
  y?: number; // integer layer index, where worldY = y * 2.0 (default 0)
  z: number;
  rotationY?: number;
  rotation?: number;
  solid: boolean;
  isStair?: boolean;
  stairDirection?: StairDirection;
  targetDoorId?: string;
  targetObstacle?: [number, number];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  durationSec?: number;
  voiceKey?: string;
}

export interface LevelData {
  id: string;
  name: string;
  theme: TileTheme;
  spawnP1: [number, number]; // grid coordinates [gx, gz]
  spawnP2: [number, number];
  tiles?: TileData[];
  grid?: Record<string, import('../types/LevelTypes.ts').GridCell>;
  platePairs?: Array<{
    id: string;
    plate1: [number, number];
    plate2: [number, number];
    targetObstacle?: [number, number];
    targetDoorId?: string;
  }>;
  switches?: SwitchButtonData[];
  keypads?: KeypadTerminalData[];
  relics?: RelicData[];
  heavyObstacles?: HeavyObstacleData[];
  exitPortal?: [number, number];
  cameraWaypoints?: Array<[number, number, number]>;
  cameraMode?: 'isometric' | 'interior';
  sunIntensity?: number;
  fixtureIntensity?: number;
  enemies?: EnemyConfig[];
  cars?: CarConfig[];
  introDialogue?: DialogueLine;
  outroDialogue?: DialogueLine;
}

export type { GridCell, LayerType } from '../types/LevelTypes.ts';
export type { HeavyObstacleData };
export {
  FLOOR_TILE_SET,
  WALL_TILE_SET,
  FLOOR_DECOR_TILE_SET,
  WALL_DECOR_TILE_SET,
  isFloorDecorType,
  isWallDecorType,
  isFloorType,
  isWallType,
  isPropType,
  getLayerForTileType,
  isSolidTileType,
  getDefaultFloorForTheme,
  migrateLegacyTilesToGrid,
} from '../types/LevelTypes.ts';


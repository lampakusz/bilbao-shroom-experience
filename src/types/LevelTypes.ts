import type { StairDirection, TileData } from '../world/TileTypes.ts';

export enum TileTheme {
  DOWNTOWN = 'downtown',
  METRO = 'metro',
  SOPELANA = 'sopelana',
  APARTMENT = 'apartment',
  PARK = 'park',
}

export enum TileType {
  EMPTY = 0,
  DOWNTOWN_BRICK_WALL = 1,
  DOWNTOWN_SIDEWALK = 2,
  DOWNTOWN_ROAD_ZEBRA = 3,
  METRO_VAULT_WALL = 4,
  METRO_PLATFORM = 5,
  METRO_RAIL = 6,
  METRO_TRAIN_CAR = 7,
  SOPELANA_STONE_WALL = 8,
  SOPELANA_CLIFF_STAIRS = 9,
  SOPELANA_SAND = 10,
  DOWNTOWN_FACADE = 11,
  DOWNTOWN_BIKELANE = 12,
  DOWNTOWN_TREE = 13,
  METRO_SEAT_DOUBLE = 14,
  METRO_POLE = 15,
  METRO_INTERIOR_CEILING = 16,
  SOPELANA_STONE_PARAPET = 17,
  SOPELANA_PAVEMENT = 18,
  SOPELANA_CLIFF_GRASS = 19,
  LIGHT_STREET_LAMP = 20,
  LIGHT_CEILING_FIXTURE = 21,
  LIGHT_METRO_NEON = 22,
  WATER_BLOCK = 23,
  BUILDING_BLOCK_LARGE = 24,
  SUBURBAN_HOUSE = 25,
  HEDGE_ROW = 26,
  RELIC_MUSHROOM = 27,
  RELIC_JOINT = 28,
  DOWNTOWN_ROAD_MULTILANE = 29,
  APARTMENT_WALL = 30,
  WALL_INTERIOR = 30,
  APARTMENT_FLOOR = 31,
  FURNITURE_SOFA = 32,
  FURNITURE_KITCHEN_COUNTER = 33,
  FURNITURE_BED = 34,
  FURNITURE_DINING_TABLE = 35,
  APARTMENT_BALCONY_RAILING = 36,
  FURNITURE_KITCHEN_STOVE = 37,
  FURNITURE_TV_STAND = 38,
  GROCERY_SHELF = 39,
  GROCERY_COUNTER = 40,
  SUBURBAN_VILLA = 41,
  METRO_GLASS_PARTITION = 42,
  APARTMENT_CORNER_WALL = 43,
  METRO_FLOOR = 44,
  FLOOR_METRO = 44,
  WALL_PILLAR = 45,
  APARTMENT_PILLAR = 45,
  DOOR_APARTMENT = 46,
  DOOR_STORE = 47,
  DOOR_METRO = 48,
  DOOR_SUBURBAN_GATE = 49,
  DOOR_SOPELANA_IRON = 50,
  SWITCH_BUTTON = 51,

  // Floor Attachments (Decals / Rugs)
  RUG_PERSIAN = 52,
  RUG_BATH_MAT = 53,
  BEACH_TOWEL_BLUE = 54,
  BEACH_TOWEL_STRIPED = 55,
  RUG_MODERN = 80,

  // Wall Attachments (Paintings / Signs)
  WALL_ART_PSYCHEDELIC = 56,
  WALL_ART_BASQUE_MAP = 57,
  WALL_ART_POSTER = 58,
  STORE_SIGN_NEON = 59,

  // Modular & Interior Furniture
  WARDROBE = 60,
  DRESSER = 61,
  NIGHTSTAND = 62,
  SOFA_CORNER = 63,
  SOFA_STRAIGHT = 64,
  SOFA_CHAISE = 65,
  KITCHEN_COUNTER_SINK = 66,
  KITCHEN_COUNTER_STOVE = 67,
  KITCHEN_COUNTER_STRAIGHT = 68,
  KITCHEN_UPPER_CABINET = 69,
  POTTED_MONSTERA = 70,
  POTTED_FICUS = 71,

  // Grocery Store & Urban Retail
  GROCERY_MEAT_DISPLAY = 72,
  GROCERY_VEG_STAND = 73,
  GROCERY_DRINK_FRIDGE = 74,
  STORE_CHECKOUT_DESK = 75,

  // Coastal Beach Assets
  BEACH_UMBRELLA = 76,
  BEACH_TOWEL = 77,
  BEACH_COOLER = 78,
  COASTAL_CLIFF_BUSH = 79,

  // Interactive & Puzzles
  KEYPAD_TERMINAL = 81,
  STICKY_NOTE_CLUE = 82,
  HEAVY_OBSTACLE = 83,

  // Etxebarria Park & Hillside Assets
  CONCRETE_RETAINING_WALL = 84,
  SOCCER_PITCH_TURF = 85,
  SOCCER_FLOODLIGHT = 86,
  WALL_CHILL_SPOT = 87,
}

export interface HeavyObstacleData {
  id: string;
  position: [number, number]; // [gx, gz]
  startPos?: [number, number, number];
  targetPos?: [number, number, number];
  pushDirection?: 'east' | 'west' | 'north' | 'south'; // default 'east'
  pushDistance?: number; // default 3.0 meters
  width?: number; // default 2.4
  height?: number; // default 1.2
  depth?: number; // default 1.0
  isFullyPushed?: boolean;
  pushProgress?: number; // 0.0 to 1.0
  targetDoorId?: string;
  targetObstacle?: [number, number];
}

export type LayerType = 'floor' | 'wall' | 'prop' | 'wallDecor' | 'floorDecor';

export interface GridCell {
  floor?: TileType;       // e.g. APARTMENT_FLOOR, METRO_FLOOR, SOPELANA_SAND
  wall?: TileType;        // e.g. APARTMENT_WALL, DOWNTOWN_BRICK_WALL, DOOR_APARTMENT
  prop?: TileType;        // e.g. DRESSER, WARDROBE, SOFA_CORNER, POTTED_MONSTERA
  wallDecor?: TileType;   // e.g. WALL_ART_PSYCHEDELIC, WALL_ART_POSTER
  floorDecor?: TileType;  // e.g. RUG_PERSIAN, BEACH_TOWEL
  rotation?: number;      // 0, 90, 180, 270 (fallback rotation)
  wallRotation?: number;
  propRotation?: number;
  wallDecorRotation?: number;
  floorDecorRotation?: number;
  floorRotation?: number;
  y?: number;             // vertical elevation layer index (worldY = y * 2.0)
  solid?: boolean;        // manual solid override
  targetDoorId?: string;  // wire binding target
  targetObstacle?: [number, number];
  isStair?: boolean;
  stairDirection?: StairDirection;
}

export const FLOOR_TILE_SET = new Set<TileType>([
  TileType.DOWNTOWN_SIDEWALK,
  TileType.DOWNTOWN_ROAD_ZEBRA,
  TileType.METRO_PLATFORM,
  TileType.METRO_RAIL,
  TileType.SOPELANA_SAND,
  TileType.DOWNTOWN_BIKELANE,
  TileType.SOPELANA_PAVEMENT,
  TileType.WATER_BLOCK,
  TileType.DOWNTOWN_ROAD_MULTILANE,
  TileType.APARTMENT_FLOOR,
  TileType.METRO_FLOOR,
  TileType.FLOOR_METRO,
  TileType.SOCCER_PITCH_TURF,
]);

export const WALL_TILE_SET = new Set<TileType>([
  TileType.DOWNTOWN_BRICK_WALL,
  TileType.METRO_VAULT_WALL,
  TileType.METRO_TRAIN_CAR,
  TileType.SOPELANA_STONE_WALL,
  TileType.SOPELANA_CLIFF_STAIRS,
  TileType.DOWNTOWN_FACADE,
  TileType.METRO_INTERIOR_CEILING,
  TileType.SOPELANA_STONE_PARAPET,
  TileType.SOPELANA_CLIFF_GRASS,
  TileType.BUILDING_BLOCK_LARGE,
  TileType.SUBURBAN_HOUSE,
  TileType.HEDGE_ROW,
  TileType.APARTMENT_WALL,
  TileType.WALL_INTERIOR,
  TileType.APARTMENT_BALCONY_RAILING,
  TileType.SUBURBAN_VILLA,
  TileType.METRO_GLASS_PARTITION,
  TileType.APARTMENT_CORNER_WALL,
  TileType.WALL_PILLAR,
  TileType.APARTMENT_PILLAR,
  TileType.DOOR_APARTMENT,
  TileType.DOOR_STORE,
  TileType.DOOR_METRO,
  TileType.DOOR_SUBURBAN_GATE,
  TileType.DOOR_SOPELANA_IRON,
  TileType.CONCRETE_RETAINING_WALL,
]);

export const FLOOR_DECOR_TILE_SET = new Set<TileType>([
  TileType.RUG_PERSIAN,
  TileType.RUG_BATH_MAT,
  TileType.RUG_MODERN,
  TileType.BEACH_TOWEL_BLUE,
  TileType.BEACH_TOWEL_STRIPED,
  TileType.BEACH_TOWEL,
  TileType.STICKY_NOTE_CLUE,
  TileType.WALL_CHILL_SPOT,
]);

export const WALL_DECOR_TILE_SET = new Set<TileType>([
  TileType.WALL_ART_PSYCHEDELIC,
  TileType.WALL_ART_BASQUE_MAP,
  TileType.WALL_ART_POSTER,
  TileType.STORE_SIGN_NEON,
  TileType.KEYPAD_TERMINAL,
]);

export function isFloorDecorType(type: TileType): boolean {
  return FLOOR_DECOR_TILE_SET.has(type);
}

export function isWallDecorType(type: TileType): boolean {
  return WALL_DECOR_TILE_SET.has(type);
}

export function isFloorType(type: TileType): boolean {
  return FLOOR_TILE_SET.has(type);
}

export function isWallType(type: TileType): boolean {
  return WALL_TILE_SET.has(type);
}

export function isPropType(type: TileType): boolean {
  if (type === TileType.EMPTY) return false;
  return !isFloorType(type) && !isWallType(type) && !isFloorDecorType(type) && !isWallDecorType(type);
}

export function getLayerForTileType(type: TileType): LayerType {
  if (isFloorDecorType(type)) return 'floorDecor';
  if (isWallDecorType(type)) return 'wallDecor';
  if (isWallType(type)) return 'wall';
  if (isFloorType(type)) return 'floor';
  return 'prop';
}

export function isSolidTileType(type: TileType): boolean {
  // Explicitly non-solid items
  if (isFloorType(type)) return false;
  if (isFloorDecorType(type)) return false;
  if (isWallDecorType(type)) return false;
  if (
    type === TileType.EMPTY ||
    type === TileType.KITCHEN_UPPER_CABINET ||
    type === TileType.METRO_POLE ||
    type === TileType.LIGHT_CEILING_FIXTURE ||
    type === TileType.LIGHT_METRO_NEON ||
    type === TileType.SWITCH_BUTTON ||
    type === TileType.KEYPAD_TERMINAL ||
    type === TileType.STICKY_NOTE_CLUE ||
    type === TileType.WALL_CHILL_SPOT ||
    type === TileType.RELIC_MUSHROOM ||
    type === TileType.RELIC_JOINT ||
    type === TileType.SOPELANA_CLIFF_STAIRS
  ) {
    return false;
  }

  // All wall types and furniture props are solid colliders
  return true;
}

export function getDefaultFloorForTheme(theme?: TileTheme): TileType {
  switch (theme) {
    case TileTheme.APARTMENT:
      return TileType.APARTMENT_FLOOR;
    case TileTheme.METRO:
      return TileType.FLOOR_METRO;
    case TileTheme.SOPELANA:
      return TileType.SOPELANA_SAND;
    case TileTheme.DOWNTOWN:
    default:
      return TileType.DOWNTOWN_SIDEWALK;
  }
}

/**
 * Migrates a legacy flat array of TileData into a multi-layer GridCell map.
 * - Stacks props and furniture on top of theme base floors.
 * - Mounts wall decor and attaches walls while preserving underlying floors.
 */
export function migrateLegacyTilesToGrid(tiles: TileData[], theme?: TileTheme): Record<string, GridCell> {
  const grid: Record<string, GridCell> = {};
  const defaultFloor = getDefaultFloorForTheme(theme);

  for (const tile of tiles) {
    if (tile.id === TileType.EMPTY) continue;
    const gy = tile.y ?? 0;
    const key = `${tile.x},${gy},${tile.z}`;
    let cell = grid[key];
    if (!cell) {
      cell = { y: gy };
      grid[key] = cell;
    }

    const layer = getLayerForTileType(tile.id);
    const rotDeg =
      tile.rotation !== undefined
        ? tile.rotation
        : tile.rotationY !== undefined
        ? Math.round(tile.rotationY * (180 / Math.PI)) % 360
        : undefined;

    switch (layer) {
      case 'floor':
        cell.floor = tile.id;
        if (rotDeg !== undefined) cell.floorRotation = rotDeg;
        break;

      case 'wall':
        cell.wall = tile.id;
        if (rotDeg !== undefined) {
          cell.wallRotation = rotDeg;
          cell.rotation = rotDeg;
        }
        if (tile.isStair) cell.isStair = true;
        if (tile.stairDirection) cell.stairDirection = tile.stairDirection;
        // Ensure an enclosed room wall has a floor beneath it unless it's a sheer cliff / outer wall
        if (!cell.floor && theme === TileTheme.APARTMENT) {
          cell.floor = defaultFloor;
        }
        break;

      case 'prop':
        cell.prop = tile.id;
        if (rotDeg !== undefined) {
          cell.propRotation = rotDeg;
          cell.rotation = rotDeg;
        }
        if (tile.targetDoorId) cell.targetDoorId = tile.targetDoorId;
        if (tile.targetObstacle) cell.targetObstacle = tile.targetObstacle;
        // Props require a floor underneath
        if (!cell.floor) {
          cell.floor = defaultFloor;
        }
        break;

      case 'wallDecor':
        cell.wallDecor = tile.id;
        if (rotDeg !== undefined) {
          cell.wallDecorRotation = rotDeg;
          cell.rotation = rotDeg;
        }
        break;

      case 'floorDecor':
        cell.floorDecor = tile.id;
        if (rotDeg !== undefined) {
          cell.floorDecorRotation = rotDeg;
          cell.rotation = rotDeg;
        }
        if (!cell.floor) {
          cell.floor = defaultFloor;
        }
        break;
    }
  }

  return grid;
}

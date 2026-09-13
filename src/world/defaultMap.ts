import type { LevelData } from './Level.ts';
import type { TileData } from './TileTypes.ts';
import { TileTheme, TileType } from './TileTypes.ts';

function buildDefaultMap(): TileData[] {
  const tiles: TileData[] = [];
  const mapSize = 14;

  for (let x = 0; x < mapSize; x++) {
    for (let z = 0; z < mapSize; z++) {
      const isBoundary = x === 0 || x === mapSize - 1 || z === 0 || z === mapSize - 1;

      if (isBoundary) {
        tiles.push({
          id: TileType.DOWNTOWN_BRICK_WALL,
          x,
          y: 0,
          z,
          solid: true,
        });
      } else if (x === 5 && (z === 4 || z === 5)) {
        // Stairs facing East (ascending from Y=0 to Y=1 towards x=6)
        tiles.push({
          id: TileType.SOPELANA_CLIFF_STAIRS,
          x,
          y: 0,
          z,
          solid: false,
          isStair: true,
          stairDirection: 'east',
          rotationY: -Math.PI / 2,
        });
      } else if (x >= 6 && x <= 8 && z >= 4 && z <= 6) {
        // Elevated terrace platform: brick wall foundation at Y=0
        tiles.push({
          id: TileType.DOWNTOWN_BRICK_WALL,
          x,
          y: 0,
          z,
          solid: true,
        });

        // Elevated surface at Y=1 (World Y = 2.0m)
        const isTerraceBarrier = x === 6 && z === 6;
        if (isTerraceBarrier) {
          // Gate obstacle unlocked by pressure plates
          tiles.push({
            id: TileType.DOWNTOWN_BRICK_WALL,
            x,
            y: 1,
            z,
            solid: true,
          });
        } else {
          tiles.push({
            id: TileType.DOWNTOWN_SIDEWALK,
            x,
            y: 1,
            z,
            solid: false,
          });
        }
      } else if (z === 3 || z === 10) {
        // Crosswalk road zebra stripes for visual variety
        tiles.push({
          id: TileType.DOWNTOWN_ROAD_ZEBRA,
          x,
          y: 0,
          z,
          solid: false,
        });
      } else {
        // Standard sidewalk floor
        tiles.push({
          id: TileType.DOWNTOWN_SIDEWALK,
          x,
          y: 0,
          z,
          solid: false,
        });
      }
    }
  }

  return tiles;
}

export const DEFAULT_LEVEL: LevelData = {
  id: 'level_downtown_01',
  name: 'Downtown Bilbao Plaza',
  theme: TileTheme.DOWNTOWN,
  spawnP1: [2, 2],
  spawnP2: [2, 4],
  tiles: buildDefaultMap(),
  platePairs: [
    {
      id: 'puzzle_barrier_1',
      plate1: [4, 4],
      plate2: [4, 8],
      targetObstacle: [6, 6],
    },
  ],
  relics: [
    {
      id: 'golden_shroom_relic',
      position: [10, 10],
    },
  ],
  exitPortal: [11, 11],
  cameraWaypoints: [
    [4, 0, 4],
    [8, 0, 8],
    [8, 0, 16],
    [16, 0, 16],
  ],
};

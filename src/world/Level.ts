import * as THREE from 'three';
import type { TileData, StairDirection, DialogueLine, RelicData, RelicType, CarConfig, SwitchButtonData, KeypadTerminalData, HeavyObstacleData, GridCell, LayerType } from './TileTypes.ts';
import { TileTheme, TileType, getLayerForTileType, isSolidTileType, getDefaultFloorForTheme, migrateLegacyTilesToGrid } from './TileTypes.ts';
import { createTileMesh, createApartmentPillarMesh, applyDoorOpenProgress, GRID_CELL_SIZE } from './BlockFactory.ts';
import type { EnemyConfig } from '../entities/EnemyTypes.ts';
import { Enemy } from '../entities/Enemy.ts';
import { Car } from '../entities/Car.ts';
import type { Player } from '../entities/Player.ts';
import type { CameraRig } from '../engine/CameraRig.ts';
import { gameState } from '../engine/GameState.ts';

export type { RelicData, RelicType, CarConfig };

export function stairDirToRotation(dir: StairDirection): number {
  switch (dir) {
    case 'north':
      return 0;
    case 'west':
      return Math.PI / 2;
    case 'south':
      return Math.PI;
    case 'east':
      return -Math.PI / 2;
  }
}

export function rotationToStairDir(rot: number): StairDirection {
  let angle = rot % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;

  if (Math.abs(angle) < Math.PI / 4) return 'north';
  if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) return 'west';
  if (angle <= -Math.PI / 4 && angle > (-3 * Math.PI) / 4) return 'east';
  return 'south';
}

export interface PlatePairData {
  id: string;
  plate1: [number, number];
  plate2: [number, number];
  targetObstacle?: [number, number];
}

export interface LevelObjectiveDef {
  relicText: string;
  platesText: string;
  exitText: string;
}

export interface LevelObjectiveStatus {
  id: 'relics' | 'plates' | 'exit' | 'gorka_gate' | string;
  text: string;
  completed: boolean;
}

export const CANONICAL_LEVEL_OBJECTIVES: Record<string, LevelObjectiveDef> = {
  level_1_apartment: {
    relicText: 'Gombák felvétele: mindkettőtöknek 1-1 darab (🍄 {relics}/{totalRelics})',
    platesText: 'Nyomólapok aktiválása a lakásban ({active}/{total})',
    exitText: 'Lépjetek a bejárati ajtóhoz / portálhoz',
  },
  level_2_street: {
    relicText: 'Látogassatok el a sarki boltba és szerezzetek 1-1 spanglit (🚬 {relics}/{totalRelics})',
    platesText: 'Nyomjátok le az utcai átkelő paneleket ({active}/{total})',
    exitText: 'Irány a Deusto metróállomás lejárója',
  },
  level_3_metro: {
    relicText: 'Szedjétek össze a 2 spanglit a vagonokból (🚬 {relics}/{totalRelics})',
    platesText: 'Nyissátok ki az átjáró ajtókat a kapcsolókkal ({active}/{total})',
    exitText: 'Jussatok el a vezetőfülke kijáratához',
  },
  level_4_suburban: {
    relicText: 'Keressetek 1-1 spanglit a külvárosi kertekben (🚬 {relics}/{totalRelics})',
    platesText: 'Kapcsoljátok le a partszakasz kapuját a panelekkel ({active}/{total})',
    exitText: 'Sétáljatok le a sziklák mentén a part felé',
  },
  level_5_sopelana: {
    relicText: 'Gyűjtsétek be az utolsó spanglikat a tengerparton (🚬 {relics}/{totalRelics})',
    platesText: 'Aktiváljátok a két parti flysch kőtömböt ({active}/{total})',
    exitText: 'Gyújtsátok meg a záró tábortüzet!',
  },
  level_6_etxebarria: {
    relicText: 'Szedjétek össze a 2 spanglit a parkban (🚬 {relics}/{totalRelics})',
    platesText: 'Üljetek le a fal tövébe pihenni',
    exitText: 'Lépjetek át a focipályán megnyílt portálon!',
  },
  level_3_sopelana: {
    relicText: 'Gyűjtsétek be az utolsó spanglikat a tengerparton (🚬 {relics}/{totalRelics})',
    platesText: 'Aktiváljátok a két parti flysch kőtömböt ({active}/{total})',
    exitText: 'Gyújtsátok meg a záró tábortüzet!',
  },
};

export interface LevelData {
  id: string;
  name: string;
  theme: TileTheme;
  spawnP1: [number, number]; // grid coordinates [gx, gz]
  spawnP2: [number, number];
  tiles?: TileData[];
  grid?: Record<string, GridCell>;
  platePairs?: PlatePairData[];
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
  objectives?: LevelObjectiveDef;
}

export class Level {
  public readonly group: THREE.Group;
  public hasTriggeredExit: boolean = false;
  public activePlates: any[] = [];
  public relics: any[] = [];
  private gridMap = new Map<string, GridCell>();
  private layerMeshes = new Map<string, THREE.Object3D>();
  private tileMap = new Map<string, TileData>();
  private meshMap = new Map<string, THREE.Object3D>();
  private columnMap = new Map<string, TileData[]>();
  private currentData: LevelData | null = null;
  private sunIntensity?: number;
  private fixtureIntensity?: number;
  private waterTileMeshes: Array<{ key: string; mesh: THREE.Object3D; basePosY: number; worldX: number; worldZ: number }> = [];
  public relicMeshes: Array<{ key: string; mesh: THREE.Object3D; basePosY: number; type: RelicType; light?: THREE.PointLight }> = [];
  private enemies: Enemy[] = [];
  private enemyGroup = new THREE.Group();
  private cars: Car[] = [];
  private carGroup = new THREE.Group();
  private bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
  private animatingDoors: Array<{ mesh: THREE.Object3D; gx: number; gz: number; gy: number; progress: number; duration: number }> = [];
  private cameraRig?: CameraRig;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'LevelGroup';
    this.enemyGroup.name = 'Enemies';
    this.group.add(this.enemyGroup);
    this.carGroup.name = 'Cars';
    this.group.add(this.carGroup);
  }

  public getDefaultFloorForTheme(): TileType {
    return getDefaultFloorForTheme(this.currentData?.theme);
  }

  public getFloorSurfaceOffset(floorType?: TileType): number {
    if (!floorType) return 0;
    if (
      floorType === TileType.DOWNTOWN_SIDEWALK ||
      floorType === TileType.DOWNTOWN_ROAD_ZEBRA ||
      floorType === TileType.DOWNTOWN_BIKELANE ||
      floorType === TileType.DOWNTOWN_ROAD_MULTILANE ||
      floorType === TileType.SOPELANA_SAND ||
      floorType === TileType.SOPELANA_PAVEMENT
    ) {
      return 0.20;
    }
    if (floorType === TileType.METRO_PLATFORM) {
      return 0.30;
    }
    // APARTMENT_FLOOR, METRO_FLOOR, etc. (standard 0.10m height box slab)
    return 0.10;
  }

  private spawnLayerMesh(
    gx: number,
    gy: number,
    gz: number,
    layer: LayerType,
    tileId: TileType,
    rotationDeg: number = 0,
    cell: GridCell
  ): THREE.Object3D | null {
    if (tileId === TileType.EMPTY) return null;

    if (tileId === TileType.RELIC_MUSHROOM || tileId === TileType.RELIC_JOINT) {
      // Relics are dynamic interactive collectibles managed by TriggerSystem, not static world tiles.
      if (this.currentData) {
        if (!this.currentData.relics) {
          this.currentData.relics = [];
        }
        const exists = this.currentData.relics.some(
          (r) => (r.position && r.position[0] === gx && r.position[1] === gz) || (r.x === gx && r.z === gz)
        );
        if (!exists) {
          this.currentData.relics.push({
            id: `relic_${tileId === TileType.RELIC_MUSHROOM ? 'mushroom' : 'joint'}_${gx}_${gz}`,
            type: tileId === TileType.RELIC_MUSHROOM ? 'mushroom' : 'joint',
            position: [gx, gz],
            x: gx,
            z: gz,
          });
        }
      }
      return null;
    }

    const mesh = createTileMesh(tileId, rotationDeg);
    if (!mesh) return null;

    const key = `${gx},${gy},${gz}`;
    const layerKey = `${key}:${layer}`;

    let yOffset = 0;
    if (layer === 'floorDecor') {
      yOffset = this.getFloorSurfaceOffset(cell.floor);
    }

    mesh.position.set(gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE + yOffset, gz * GRID_CELL_SIZE);
    const rotRad = (rotationDeg * Math.PI) / 180;
    mesh.rotation.y = rotRad;

    mesh.userData.isTileMesh = true;
    mesh.userData.layer = layer;
    mesh.userData.cellKey = key;
    mesh.userData.cell = cell;
    mesh.userData.gx = gx;
    mesh.userData.gy = gy;
    mesh.userData.gz = gz;
    mesh.userData.tileId = tileId;

    if (layer === 'floor') {
      mesh.userData.isFloor = true;
    } else if (layer === 'floorDecor') {
      mesh.userData.isSolid = false;
      mesh.userData.isFloorDecor = true;
      mesh.traverse((c) => {
        c.userData.isSolid = false;
        c.userData.isFloorDecor = true;
      });
    } else if (layer === 'wall') {
      const isDoor =
        tileId === TileType.DOOR_APARTMENT ||
        tileId === TileType.DOOR_STORE ||
        tileId === TileType.DOOR_METRO ||
        tileId === TileType.DOOR_SUBURBAN_GATE ||
        tileId === TileType.DOOR_SOPELANA_IRON;

      if (!isDoor) {
        mesh.userData.isWall = true;
        mesh.userData.isOccluder = true;
        mesh.traverse((c) => {
          if (!c.userData?.isFloor) {
            c.userData.isWall = true;
            c.userData.isOccluder = true;
          }
        });
      }
      // Door meshes already carry the correct string userData.doorType ('single_hinge' /
      // 'double_hinge' / 'sliding') plus hinge/slide refs from their own factory function in
      // BlockFactory.ts - overwriting it with the numeric TileType id here breaks
      // applyDoorOpenProgress's animation lookup, leaving doors passable but visually closed.
    } else if (layer === 'prop') {
      if (isSolidTileType(tileId)) {
        mesh.userData.isWall = true;
        mesh.traverse((c) => {
          c.userData.isWall = true;
        });
      }
    }

    if (
      tileId === TileType.METRO_INTERIOR_CEILING ||
      tileId === TileType.LIGHT_METRO_NEON ||
      (gy >= 1 && this.currentData?.theme === TileTheme.METRO)
    ) {
      mesh.userData.isRoof = true;
      mesh.traverse((c) => {
        c.userData.isRoof = true;
      });
    }

    if (tileId === TileType.WATER_BLOCK || mesh.userData?.isWaterTile) {
      this.waterTileMeshes.push({
        key: layerKey,
        mesh,
        basePosY: gy * GRID_CELL_SIZE,
        worldX: gx * GRID_CELL_SIZE,
        worldZ: gz * GRID_CELL_SIZE,
      });
    }

    this.group.add(mesh);
    this.layerMeshes.set(layerKey, mesh);
    this.meshMap.set(key, mesh);
    return mesh;
  }

  private rebuildColumnForCell(gx: number, gz: number, gy: number, cell: GridCell | undefined): void {
    const colKey = `${gx},${gz}`;
    let list = this.columnMap.get(colKey);
    if (!list) {
      list = [];
      this.columnMap.set(colKey, list);
    } else {
      const filtered = list.filter((t) => (t.y ?? 0) !== gy);
      list.length = 0;
      list.push(...filtered);
    }

    if (!cell) {
      if (list.length === 0) {
        this.columnMap.delete(colKey);
      }
      return;
    }

    if (cell.floor) {
      list.push({
        id: cell.floor,
        x: gx,
        y: gy,
        z: gz,
        solid: false,
        rotation: cell.floorRotation,
      });
    }
    if (cell.floorDecor) {
      list.push({
        id: cell.floorDecor,
        x: gx,
        y: gy,
        z: gz,
        solid: false,
        rotation: cell.floorDecorRotation ?? cell.rotation,
      });
    }
    if (cell.prop) {
      list.push({
        id: cell.prop,
        x: gx,
        y: gy,
        z: gz,
        solid: isSolidTileType(cell.prop),
        rotation: cell.propRotation ?? cell.rotation,
        targetDoorId: cell.targetDoorId,
        targetObstacle: cell.targetObstacle,
      });
    }
    if (cell.wall) {
      const isDoor =
        cell.wall === TileType.DOOR_APARTMENT ||
        cell.wall === TileType.DOOR_STORE ||
        cell.wall === TileType.DOOR_METRO ||
        cell.wall === TileType.DOOR_SUBURBAN_GATE ||
        cell.wall === TileType.DOOR_SOPELANA_IRON;
      list.push({
        id: cell.wall,
        x: gx,
        y: gy,
        z: gz,
        solid: isDoor ? true : isSolidTileType(cell.wall),
        rotation: cell.wallRotation ?? cell.rotation,
        isStair: cell.isStair,
        stairDirection: cell.stairDirection,
      });
    }
    if (cell.wallDecor) {
      list.push({
        id: cell.wallDecor,
        x: gx,
        y: gy,
        z: gz,
        solid: false,
        rotation: cell.wallDecorRotation ?? cell.wallRotation ?? cell.rotation,
      });
    }

    if (list.length === 0) {
      this.columnMap.delete(colKey);
    }
  }

  private updateBoundsForCell(gx: number, gz: number): void {
    if (gx < this.bounds.minX) this.bounds.minX = gx;
    if (gx > this.bounds.maxX) this.bounds.maxX = gx;
    if (gz < this.bounds.minZ) this.bounds.minZ = gz;
    if (gz > this.bounds.maxZ) this.bounds.maxZ = gz;
  }

  public loadLevel(
    data: LevelData,
    scene?: THREE.Scene,
    p1?: Player,
    p2?: Player,
    cameraRig?: CameraRig
  ): void {
    this.dispose(p1, p2);
    this.hasTriggeredExit = false;
    this.cameraRig = cameraRig;
    this.animatingDoors = [];

    this.currentData = data;
    this.sunIntensity = data.sunIntensity;
    this.fixtureIntensity = data.fixtureIntensity;
    gameState.setFlag('current_level_id', data.id);
    gameState.setFlag('current_level_theme', data.theme);

    const grid: Record<string, GridCell> =
      data.grid && Object.keys(data.grid).length > 0
        ? data.grid
        : migrateLegacyTilesToGrid(data.tiles ?? [], data.theme);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const [key, cell] of Object.entries(grid)) {
      const parts = key.split(',').map(Number);
      const gx = parts[0];
      const gy = parts.length > 2 ? parts[1] : (cell.y ?? 0);
      const gz = parts.length > 2 ? parts[2] : parts[1];
      cell.y = gy;

      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gz < minZ) minZ = gz;
      if (gz > maxZ) maxZ = gz;

      this.gridMap.set(`${gx},${gy},${gz}`, cell);

      if (cell.floor) {
        this.spawnLayerMesh(gx, gy, gz, 'floor', cell.floor, cell.floorRotation ?? 0, cell);
      }
      if (cell.floorDecor) {
        this.spawnLayerMesh(gx, gy, gz, 'floorDecor', cell.floorDecor, cell.floorDecorRotation ?? cell.rotation ?? 0, cell);
      }
      if (cell.prop) {
        this.spawnLayerMesh(gx, gy, gz, 'prop', cell.prop, cell.propRotation ?? cell.rotation ?? 0, cell);
      }
      if (cell.wall) {
        this.spawnLayerMesh(gx, gy, gz, 'wall', cell.wall, cell.wallRotation ?? cell.rotation ?? 0, cell);
      }
      if (cell.wallDecor) {
        this.spawnLayerMesh(gx, gy, gz, 'wallDecor', cell.wallDecor, cell.wallDecorRotation ?? cell.wallRotation ?? cell.rotation ?? 0, cell);
      }

      this.rebuildColumnForCell(gx, gz, gy, cell);
    }

    this.bounds = {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 50,
      minZ: Number.isFinite(minZ) ? minZ : 0,
      maxZ: Number.isFinite(maxZ) ? maxZ : 50,
    };

    if (scene) {
      if (!scene.children.includes(this.group)) {
        scene.add(this.group);
      }
      if (p1 && !scene.children.includes(p1.mesh)) {
        scene.add(p1.mesh);
      }
      if (p2 && !scene.children.includes(p2.mesh)) {
        scene.add(p2.mesh);
      }
    }

    // Seamless Wall T-Junctions & Intersections Cap:
    // When in apartment interior theme, automatically cap any wall coordinate where horizontal and vertical walls meet
    if (data.theme === TileTheme.APARTMENT) {
      for (const [key, cell] of this.gridMap.entries()) {
        if (cell.wall === TileType.APARTMENT_WALL || cell.wall === TileType.WALL_PILLAR) {
          const parts = key.split(',').map(Number);
          const gx = parts[0];
          const gy = parts.length > 2 ? parts[1] : (cell.y ?? 0);
          const gz = parts.length > 2 ? parts[2] : parts[1];

          const isWallAt = (dx: number, dz: number) => {
            const neighbor = this.gridMap.get(`${gx + dx},${gy},${gz + dz}`);
            return (
              neighbor &&
              (neighbor.wall === TileType.APARTMENT_WALL ||
                neighbor.wall === TileType.APARTMENT_CORNER_WALL ||
                neighbor.wall === TileType.WALL_PILLAR ||
                neighbor.wall === TileType.DOOR_APARTMENT)
            );
          };
          const negX = Boolean(isWallAt(-1, 0));
          const posX = Boolean(isWallAt(1, 0));
          const negZ = Boolean(isWallAt(0, -1));
          const posZ = Boolean(isWallAt(0, 1));
          const hasX = negX || posX;
          const hasZ = negZ || posZ;
          if (hasX && hasZ) {
            const pillarMesh = createApartmentPillarMesh({ posX, negX, posZ, negZ });
            pillarMesh.position.set(gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
            this.group.add(pillarMesh);
          }
        }
      }
    }

    // Load and spawn configured enemies
    this.loadEnemies(data.enemies);
    // Load and spawn hazard cars
    this.loadCars(data.cars);

    // Reposition players safely to designated spawn coordinates
    if (p1 && data.spawnP1) {
      const y = this.getElevationAt(data.spawnP1[0] * GRID_CELL_SIZE, data.spawnP1[1] * GRID_CELL_SIZE);
      p1.position.set(data.spawnP1[0] * GRID_CELL_SIZE, y, data.spawnP1[1] * GRID_CELL_SIZE);
      p1.velocity.set(0, 0, 0);
      p1.velocityY = 0;
      p1.hasRelic = false;
      p1.resetState();
      p1.update(0);
    }
    if (p2 && data.spawnP2) {
      const y = this.getElevationAt(data.spawnP2[0] * GRID_CELL_SIZE, data.spawnP2[1] * GRID_CELL_SIZE);
      p2.position.set(data.spawnP2[0] * GRID_CELL_SIZE, y, data.spawnP2[1] * GRID_CELL_SIZE);
      p2.velocity.set(0, 0, 0);
      p2.velocityY = 0;
      p2.hasRelic = false;
      p2.resetState();
      p2.update(0);
    }

    if (cameraRig && p1 && p2) {
      const midPoint = new THREE.Vector3().addVectors(p1.position, p2.position).multiplyScalar(0.5);
      cameraRig.snapToTarget(midPoint);
      cameraRig.clearOcclusion();
      p1.update(0, { x: 0, y: 0 }, cameraRig, this);
      p2.update(0, { x: 0, y: 0 }, cameraRig, this);
    }
  }

  public getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number; centerX: number; centerZ: number; width: number; depth: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    if (this.gridMap.size === 0 && this.tileMap.size === 0) {
      return { minX: 0, maxX: 40, minZ: 0, maxZ: 40, centerX: 20, centerZ: 20, width: 40, depth: 40 };
    }

    for (const key of this.gridMap.keys()) {
      const parts = key.split(',').map(Number);
      const gx = parts[0];
      const gz = parts.length > 2 ? parts[2] : parts[1];
      const wx = gx * GRID_CELL_SIZE;
      const wz = gz * GRID_CELL_SIZE;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }

    for (const tile of this.tileMap.values()) {
      const wx = tile.x * GRID_CELL_SIZE;
      const wz = tile.z * GRID_CELL_SIZE;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }

    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const width = Math.max(20, maxX - minX);
    const depth = Math.max(20, maxZ - minZ);

    return { minX, maxX, minZ, maxZ, centerX, centerZ, width, depth };
  }

  public getTotalRelics(): number {
    return this.currentData?.relics?.length ?? 2;
  }

  public getTotalPlates(): number {
    return (this.currentData?.platePairs?.length ?? 0) * 2;
  }

  public getPlatePairs(): PlatePairData[] {
    return this.currentData?.platePairs ?? [];
  }

  public getObjectives(
    relicsCollected: number,
    totalRelics: number,
    activePlatesCount: number,
    totalPlatesCount: number,
    exitReady: boolean,
    vibeComplete?: boolean
  ): LevelObjectiveStatus[] {
    const id = this.currentData?.id || '';
    const def = this.currentData?.objectives || CANONICAL_LEVEL_OBJECTIVES[id] || {
      relicText: 'Relikviák összegyűjtése (✨ {relics}/{totalRelics})',
      platesText: 'Nyomólapok aktiválása ({active}/{total})',
      exitText: 'Lépjetek a bejárati ajtóhoz / portálhoz',
    };

    const isMushroom = this.currentData?.theme === TileTheme.APARTMENT || id === 'level_1_apartment';
    const relicIcon = isMushroom ? '🍄' : '🚬';

    const relicCompleted = totalRelics === 0 || relicsCollected >= totalRelics;
    const relicFormatted = def.relicText
      .replace('{relics}', relicsCollected.toString())
      .replace('{totalRelics}', totalRelics.toString())
      .replace('{icon}', relicIcon);

    const platesCompleted = totalPlatesCount === 0 || activePlatesCount >= totalPlatesCount;
    const platesFormatted = def.platesText
      .replace('{active}', activePlatesCount.toString())
      .replace('{total}', totalPlatesCount.toString());

    const exitCompleted = exitReady;

    const list: LevelObjectiveStatus[] = [];

    if (totalRelics > 0 || !this.currentData) {
      list.push({
        id: 'relics',
        text: relicFormatted,
        completed: relicCompleted,
      });
    }

    if (totalPlatesCount > 0 || !this.currentData) {
      list.push({
        id: 'plates',
        text: platesFormatted,
        completed: platesCompleted,
      });
    }

    if (id === 'level_2_street' && gameState.getFlag('gorka_code_known')) {
      const gateUnlocked = !!(gameState.getFlag('service_door_unlocked') || gameState.getFlag('service_gate_unlocked'));
      list.push({
        id: 'gorka_gate',
        text: 'A kapu kódja: 1984 - Nyissátok ki a szervizajtót!',
        completed: gateUnlocked,
      });
    }

    if (id === 'level_6_etxebarria' || this.currentData?.theme === TileTheme.PARK) {
      list.push({
        id: 'vibe',
        text: 'Üljetek le a fal tövébe és érjétek el a 100% tudat-fúziót',
        completed: Boolean(vibeComplete),
      });
    }

    list.push({
      id: 'exit',
      text: def.exitText,
      completed: exitCompleted,
    });

    return list;
  }

  public getCurrentData(): LevelData | null {
    return this.currentData;
  }

  public getCell(gx: number, gz: number, gy: number = 0): GridCell | undefined {
    return this.gridMap.get(`${gx},${gy},${gz}`);
  }

  public getLayerMesh(gx: number, gz: number, layer: LayerType, gy: number = 0): THREE.Object3D | undefined {
    return this.layerMeshes.get(`${gx},${gy},${gz}:${layer}`);
  }

  public setCellLayer(
    gx: number,
    gz: number,
    layer: LayerType,
    type: TileType,
    rotation: number = 0,
    gy: number = 0
  ): void {
    const key = `${gx},${gy},${gz}`;
    const layerKey = `${key}:${layer}`;

    if (type === TileType.EMPTY) {
      this.removeCellLayer(gx, gz, layer, gy);
      return;
    }

    let cell = this.gridMap.get(key);
    if (!cell) {
      cell = { y: gy };
      this.gridMap.set(key, cell);
    }

    const oldMesh = this.layerMeshes.get(layerKey);
    if (oldMesh) {
      this.group.remove(oldMesh);
      this.disposeObject(oldMesh);
      this.layerMeshes.delete(layerKey);
    }

    const waterIdx = this.waterTileMeshes.findIndex((w) => w.key === layerKey);
    if (waterIdx !== -1) this.waterTileMeshes.splice(waterIdx, 1);
    const relicIdx = this.relicMeshes.findIndex((r) => r.key === layerKey);
    if (relicIdx !== -1) this.relicMeshes.splice(relicIdx, 1);

    cell[layer] = type;
    if (layer === 'floor') {
      cell.floorRotation = rotation;
    } else if (layer === 'wall') {
      cell.wallRotation = rotation;
      cell.rotation = rotation;
      if (type === TileType.SOPELANA_CLIFF_STAIRS) {
        cell.isStair = true;
        const rad = (rotation * Math.PI) / 180;
        cell.stairDirection = rotationToStairDir(rad);
      }
    } else if (layer === 'prop') {
      cell.propRotation = rotation;
      cell.rotation = rotation;
    } else if (layer === 'wallDecor') {
      cell.wallDecorRotation = rotation;
      cell.rotation = rotation;
    } else if (layer === 'floorDecor') {
      cell.floorDecorRotation = rotation;
      cell.rotation = rotation;
    }

    this.spawnLayerMesh(gx, gy, gz, layer, type, rotation, cell);
    this.rebuildColumnForCell(gx, gz, gy, cell);
    this.updateBoundsForCell(gx, gz);
  }

  public removeCellLayer(gx: number, gz: number, layer: LayerType, gy: number = 0): void {
    const key = `${gx},${gy},${gz}`;
    const layerKey = `${key}:${layer}`;

    const oldMesh = this.layerMeshes.get(layerKey);
    if (oldMesh) {
      this.group.remove(oldMesh);
      this.disposeObject(oldMesh);
      this.layerMeshes.delete(layerKey);
    }

    const waterIdx = this.waterTileMeshes.findIndex((w) => w.key === layerKey);
    if (waterIdx !== -1) this.waterTileMeshes.splice(waterIdx, 1);
    const relicIdx = this.relicMeshes.findIndex((r) => r.key === layerKey);
    if (relicIdx !== -1) this.relicMeshes.splice(relicIdx, 1);

    const cell = this.gridMap.get(key);
    if (cell) {
      delete cell[layer];
      if (
        !cell.floor &&
        !cell.wall &&
        !cell.prop &&
        !cell.wallDecor &&
        !cell.floorDecor
      ) {
        this.gridMap.delete(key);
        this.rebuildColumnForCell(gx, gz, gy, undefined);
      } else {
        this.rebuildColumnForCell(gx, gz, gy, cell);
      }
    }
  }

  public removeAllLayersAt(gx: number, gz: number, gy: number = 0): void {
    const layers: LayerType[] = ['wallDecor', 'floorDecor', 'prop', 'wall', 'floor'];
    for (const layer of layers) {
      this.removeCellLayer(gx, gz, layer, gy);
    }
  }

  public setTile(
    gx: number,
    gz: number,
    type: TileType,
    _solid: boolean = true,
    gy: number = 0,
    rotationY: number = 0,
    isStair: boolean = false,
    stairDir?: StairDirection,
    rotation?: number
  ): void {
    if (type === TileType.EMPTY) {
      this.removeTile(gx, gz, gy);
      return;
    }

    let rotDeg = rotation;
    if (rotDeg === undefined && rotationY !== 0) {
      rotDeg = Math.round(rotationY * (180 / Math.PI)) % 360;
    }
    if (rotDeg === undefined) rotDeg = 0;

    const layer = getLayerForTileType(type);
    this.setCellLayer(gx, gz, layer, type, rotDeg, gy);

    if (isStair || type === TileType.SOPELANA_CLIFF_STAIRS) {
      const cell = this.gridMap.get(`${gx},${gy},${gz}`);
      if (cell) {
        cell.isStair = true;
        if (stairDir) cell.stairDirection = stairDir;
      }
    }
  }

  public removeTile(gx: number, gz: number, gy: number = 0): void {
    const key = `${gx},${gy},${gz}`;
    const cell = this.gridMap.get(key);
    if (!cell) {
      const mesh = this.meshMap.get(key);
      if (mesh) {
        this.group.remove(mesh);
        this.meshMap.delete(key);
      }
      this.tileMap.delete(key);
      return;
    }

    // Safe peel-back removal: wallDecor -> floorDecor -> prop -> wall -> floor
    if (cell.wallDecor) {
      this.removeCellLayer(gx, gz, 'wallDecor', gy);
    } else if (cell.floorDecor) {
      this.removeCellLayer(gx, gz, 'floorDecor', gy);
    } else if (cell.prop) {
      this.removeCellLayer(gx, gz, 'prop', gy);
    } else if (cell.wall) {
      this.removeCellLayer(gx, gz, 'wall', gy);
    } else if (cell.floor) {
      this.removeCellLayer(gx, gz, 'floor', gy);
    }
  }

  public getMeshAtGrid(gx: number, gz: number, gy: number = 0): THREE.Object3D | undefined {
    return this.getMeshAt(gx, gz, gy);
  }

  public getMeshAt(gx: number, gz: number, gy: number = 0): THREE.Object3D | undefined {
    const key = `${gx},${gy},${gz}`;
    return (
      this.layerMeshes.get(`${key}:wall`) ??
      this.layerMeshes.get(`${key}:prop`) ??
      this.layerMeshes.get(`${key}:floorDecor`) ??
      this.layerMeshes.get(`${key}:wallDecor`) ??
      this.layerMeshes.get(`${key}:floor`) ??
      this.meshMap.get(key)
    );
  }

  public setCameraRig(rig: CameraRig): void {
    this.cameraRig = rig;
  }

  public getCameraRig(): CameraRig | undefined {
    return this.cameraRig;
  }

  /**
   * Opens a door at (gx, gz):
   * Immediately clears collider and occlusion so players and tether pass unobstructed,
   * then registers door mesh for smooth physical opening animation over 0.8s.
   * Returns true if a door was found and opened.
   */
  public openDoorAt(gx: number, gz: number, gy: number = 0): boolean {
    const colTiles = this.getColumnTiles(gx, gz);
    const doorTile =
      colTiles.find((t) => {
        const isDoor =
          t.id === TileType.DOOR_APARTMENT ||
          t.id === TileType.DOOR_STORE ||
          t.id === TileType.DOOR_METRO ||
          t.id === TileType.DOOR_SUBURBAN_GATE ||
          t.id === TileType.DOOR_SOPELANA_IRON;
        return isDoor && (gy === undefined || gy === 0 || (t.y ?? 0) === gy);
      }) ||
      colTiles.find((t) => {
        return (
          t.id === TileType.DOOR_APARTMENT ||
          t.id === TileType.DOOR_STORE ||
          t.id === TileType.DOOR_METRO ||
          t.id === TileType.DOOR_SUBURBAN_GATE ||
          t.id === TileType.DOOR_SOPELANA_IRON
        );
      });

    if (doorTile) {
      const targetGy = doorTile.y ?? 0;
      doorTile.solid = false;
      const key = `${gx},${targetGy},${gz}`;
      const mesh = this.meshMap.get(key);
      if (mesh) {
        mesh.userData.isWall = false;
        mesh.userData.isOccluder = false;
        mesh.userData.isOpen = true;
        mesh.traverse((c) => {
          c.userData.isWall = false;
          c.userData.isOccluder = false;
        });

        const existing = this.animatingDoors.find((d) => d.gx === gx && d.gz === gz && d.gy === targetGy);
        if (!existing) {
          this.animatingDoors.push({
            mesh,
            gx,
            gz,
            gy: targetGy,
            progress: 0,
            duration: 0.8,
          });
        }
      }
      return true;
    }

    // Fallback: If no door tile, clear obstacle tile if solid
    const solidTiles = colTiles.filter((t) => t.solid);
    for (const solidTile of solidTiles) {
      const targetGy = solidTile.y ?? 0;
      this.removeTile(gx, gz, targetGy);
      const theme = this.currentData?.theme;
      let floorType = TileType.DOWNTOWN_SIDEWALK;
      if (theme === TileTheme.METRO) {
        floorType = TileType.FLOOR_METRO;
      } else if (theme === TileTheme.APARTMENT) {
        floorType = TileType.APARTMENT_FLOOR;
      } else if (theme === TileTheme.SOPELANA) {
        floorType = targetGy >= 2 ? TileType.SOPELANA_PAVEMENT : TileType.SOPELANA_SAND;
      }
      this.setTile(gx, gz, floorType, false, targetGy);
    }
    return false;
  }

  /**
   * Clears collision & occlusion for a pushed HEAVY_OBSTACLE tile at (gx, gz):
   * Mirrors openDoorAt's mutation approach but leaves the mesh in place (and un-disposed)
   * so TriggerSystem can keep animating it sliding to its resting position.
   * Returns true if an obstacle tile was found and cleared.
   */
  public clearHeavyObstacleAt(gx: number, gz: number, gy: number = 0): boolean {
    const colTiles = this.getColumnTiles(gx, gz);
    const obstacleTile = colTiles.find((t) => t.id === TileType.HEAVY_OBSTACLE && (t.y ?? 0) === gy);
    if (!obstacleTile) return false;

    obstacleTile.solid = false;

    const mesh = this.getMeshAt(gx, gz, gy);
    if (mesh) {
      mesh.userData.isWall = false;
      mesh.userData.isOccluder = false;
      mesh.traverse((c) => {
        c.userData.isWall = false;
        c.userData.isOccluder = false;
      });
    }
    return true;
  }

  public getColumnTiles(gx: number, gz: number): TileData[] {
    return this.columnMap.get(`${gx},${gz}`) ?? [];
  }

  public hasStairLeadingTo(gx: number, gz: number, gy: number, wx?: number, wz?: number): boolean {
    // West neighbor (gx - 1, gz) ascending East (+X) into (gx, gz) at layer gy
    const west = this.columnMap.get(`${gx - 1},${gz}`);
    if (west) {
      for (const t of west) {
        if ((t.isStair || t.id === TileType.SOPELANA_CLIFF_STAIRS) && (t.y ?? 0) + 1 === gy) {
          const dir = t.stairDirection || (t.rotationY !== undefined ? rotationToStairDir(t.rotationY) : 'north');
          if (dir === 'east') {
            if (wx === undefined || wx <= gx * GRID_CELL_SIZE + 0.5) return true;
          }
        }
      }
    }
    // East neighbor (gx + 1, gz) ascending West (-X) into (gx, gz) at layer gy
    const east = this.columnMap.get(`${gx + 1},${gz}`);
    if (east) {
      for (const t of east) {
        if ((t.isStair || t.id === TileType.SOPELANA_CLIFF_STAIRS) && (t.y ?? 0) + 1 === gy) {
          const dir = t.stairDirection || (t.rotationY !== undefined ? rotationToStairDir(t.rotationY) : 'west');
          if (dir === 'west') {
            if (wx === undefined || wx >= gx * GRID_CELL_SIZE - 0.5) return true;
          }
        }
      }
    }
    // South neighbor (gx, gz + 1) ascending North (-Z) into (gx, gz) at layer gy
    const south = this.columnMap.get(`${gx},${gz + 1}`);
    if (south) {
      for (const t of south) {
        if ((t.isStair || t.id === TileType.SOPELANA_CLIFF_STAIRS) && (t.y ?? 0) + 1 === gy) {
          const dir = t.stairDirection || (t.rotationY !== undefined ? rotationToStairDir(t.rotationY) : 'north');
          if (dir === 'north') {
            if (wz === undefined || wz <= gz * GRID_CELL_SIZE + 0.5) return true;
          }
        }
      }
    }
    // North neighbor (gx, gz - 1) ascending South (+Z) into (gx, gz) at layer gy
    const north = this.columnMap.get(`${gx},${gz - 1}`);
    if (north) {
      for (const t of north) {
        if ((t.isStair || t.id === TileType.SOPELANA_CLIFF_STAIRS) && (t.y ?? 0) + 1 === gy) {
          const dir = t.stairDirection || (t.rotationY !== undefined ? rotationToStairDir(t.rotationY) : 'south');
          if (dir === 'south') {
            if (wz === undefined || wz >= gz * GRID_CELL_SIZE - 0.5) return true;
          }
        }
      }
    }
    return false;
  }

  public getElevationAt(wx: number, wz: number, currentY: number = 0): number {
    const gx = Math.round(wx / GRID_CELL_SIZE);
    const gz = Math.round(wz / GRID_CELL_SIZE);
    const tilesInCol = this.columnMap.get(`${gx},${gz}`);

    if (!tilesInCol || tilesInCol.length === 0) {
      return 0.0;
    }

    // 1. Check if column contains a stair
    const stairTile = tilesInCol.find(
      (t) => Boolean(t.isStair || t.id === TileType.SOPELANA_CLIFF_STAIRS)
    );
    if (stairTile) {
      const gy = stairTile.y ?? 0;
      const baseElevation = gy * GRID_CELL_SIZE;
      const stairDir = stairTile.stairDirection || (stairTile.rotationY !== undefined ? rotationToStairDir(stairTile.rotationY) : 'north');
      let t = 0;

      if (stairDir === 'east') {
        // East (+X): t = (wx - (gx * 2.0 - 1.0)) / 2.0
        t = (wx - (gx * GRID_CELL_SIZE - 1.0)) / GRID_CELL_SIZE;
      } else if (stairDir === 'west') {
        // West (-X): t = 1.0 - (wx - (gx * 2.0 - 1.0)) / 2.0
        t = 1.0 - (wx - (gx * GRID_CELL_SIZE - 1.0)) / GRID_CELL_SIZE;
      } else if (stairDir === 'south') {
        // South (+Z): t = (wz - (gz * 2.0 - 1.0)) / 2.0
        t = (wz - (gz * GRID_CELL_SIZE - 1.0)) / GRID_CELL_SIZE;
      } else if (stairDir === 'north') {
        // North (-Z): t = 1.0 - (wz - (gz * 2.0 - 1.0)) / 2.0
        t = 1.0 - (wz - (gz * GRID_CELL_SIZE - 1.0)) / GRID_CELL_SIZE;
      }

      t = Math.max(0.0, Math.min(1.0, t));
      return baseElevation + t * GRID_CELL_SIZE;
    }

    // 2. Scan all walkable floor tiles across Y layers supporting the player's height
    let bestElevation = 0.0;
    let foundSupporting = false;

    // Filter to strictly walkable non-solid floor tiles
    const walkableTiles = tilesInCol
      .filter((t) => !t.solid && !t.isStair && t.id !== TileType.SOPELANA_CLIFF_STAIRS)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

    if (walkableTiles.length === 0) {
      return 0.0;
    }

    if (currentY === undefined) {
      const topWalkable = walkableTiles[walkableTiles.length - 1];
      return (topWalkable.y ?? 0) * GRID_CELL_SIZE + 0.2;
    }

    for (const tile of walkableTiles) {
      const gy = tile.y ?? 0;
      const surfaceElevation = gy * GRID_CELL_SIZE + 0.2;

      // If player is at or within step-up reach of this surface
      if (currentY >= surfaceElevation - 0.6) {
        bestElevation = surfaceElevation;
        foundSupporting = true;
      } else if (!foundSupporting && bestElevation === 0.0) {
        bestElevation = surfaceElevation;
      }
    }

    return bestElevation;
  }

  public isSolidAtWorldPos(wx: number, wz: number, currentY: number = 0): boolean {
    const gx = Math.round(wx / GRID_CELL_SIZE);
    const gz = Math.round(wz / GRID_CELL_SIZE);

    // Hard boundary check: anything outside level tile bounds is strictly solid
    if (
      gx < this.bounds.minX ||
      gx > this.bounds.maxX ||
      gz < this.bounds.minZ ||
      gz > this.bounds.maxZ
    ) {
      return true;
    }

    const tilesInCol = this.columnMap.get(`${gx},${gz}`);

    // If an in-bounds cell has no tiles, it's open void / boundary gap - block movement!
    if (!tilesInCol || tilesInCol.length === 0) {
      return true;
    }

    // 1. If any tile in query cell is a stair, NEVER treat it as a solid horizontal blocking wall
    const hasStair = tilesInCol.some(
      (tile) => Boolean(tile.isStair || tile.id === TileType.SOPELANA_CLIFF_STAIRS)
    );
    if (hasStair) {
      return false;
    }

    // 2. Check for walkable floors in this column
    // A walkable floor at layer gy with surfaceY = gy * 2.0 + 0.2 is walkable if Math.abs(currentY - surfaceY) < 0.6,
    // OR if an adjacent stair leads directly into layer gy of this cell.
    let accessibleWalkableGy: number | null = null;
    for (const tile of tilesInCol) {
      if (!tile.solid && !tile.isStair && tile.id !== TileType.SOPELANA_CLIFF_STAIRS) {
        const gy = tile.y ?? 0;
        const surfaceY = gy * GRID_CELL_SIZE + 0.2;
        const isNearSurface = Math.abs(currentY - surfaceY) < 0.6;
        const hasStairEntry = this.hasStairLeadingTo(gx, gz, gy, wx, wz) && currentY >= gy * GRID_CELL_SIZE - 0.8;
        if (isNearSurface || hasStairEntry) {
          accessibleWalkableGy = gy;
          break;
        }
      }
    }

    // 3. Check for solid obstacles in this column
    for (const tile of tilesInCol) {
      if (tile.solid) {
        const gy = tile.y ?? 0;
        // If this solid tile is beneath an accessible walkable floor, it is just the foundation!
        if (accessibleWalkableGy !== null && gy < accessibleWalkableGy) {
          continue;
        }

        const blockBottom = gy * GRID_CELL_SIZE;
        const blockTop = blockBottom + GRID_CELL_SIZE;

        // Block movement if the player's vertical height collides with this solid block
        if (currentY < blockTop && currentY + 1.6 > blockBottom) {
          return true;
        }
      }
    }

    // 4. If no accessible walkable floor was found in this column, player cannot step into empty space or cliff drops
    if (accessibleWalkableGy === null) {
      return true;
    }

    return false;
  }

  public getPlayableBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return this.bounds;
  }

  public getTileAtGrid(gx: number, gz: number, gy: number = 0): TileData | undefined {
    const fromMap = this.tileMap.get(`${gx},${gy},${gz}`);
    if (fromMap) return fromMap;
    const cell = this.gridMap.get(`${gx},${gy},${gz}`);
    if (!cell) return undefined;
    const primaryId = cell.wall ?? cell.prop ?? cell.floorDecor ?? cell.floor ?? cell.wallDecor;
    if (!primaryId) return undefined;
    const rotDeg = cell.wallRotation ?? cell.propRotation ?? cell.floorDecorRotation ?? cell.rotation ?? 0;
    return {
      id: primaryId,
      x: gx,
      y: gy,
      z: gz,
      solid: isSolidTileType(primaryId),
      rotation: rotDeg,
      rotationY: (rotDeg * Math.PI) / 180,
      isStair: cell.isStair,
      stairDirection: cell.stairDirection,
      targetDoorId: cell.targetDoorId,
      targetObstacle: cell.targetObstacle,
    };
  }

  public get data(): LevelData | null {
    return this.currentData;
  }

  public getTheme(): TileTheme {
    return this.currentData?.theme ?? TileTheme.DOWNTOWN;
  }

  public setName(name: string): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    this.currentData.name = name;
  }

  public setTheme(theme: TileTheme): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    this.currentData.theme = theme;
  }

  public setCameraWaypoints(waypoints?: Array<[number, number, number]>): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    this.currentData.cameraWaypoints = waypoints ? [...waypoints] : undefined;
  }

  public getCameraWaypoints(): Array<[number, number, number]> | undefined {
    return this.currentData?.cameraWaypoints;
  }

  public setCameraMode(mode?: 'isometric' | 'interior'): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    this.currentData.cameraMode = mode;
  }

  public getCameraMode(): 'isometric' | 'interior' {
    return this.currentData?.cameraMode ?? 'isometric';
  }

  public update(time: number, delta: number = 0.016): void {
    for (const item of this.waterTileMeshes) {
      const y_offset =
        Math.sin(item.worldX * 1.5 + time * 2.0) * 0.12 +
        Math.cos(item.worldZ * 1.5 + time * 1.5) * 0.08;
      item.mesh.position.y = item.basePosY + y_offset;
    }

    for (const relic of this.relicMeshes) {
      relic.mesh.rotation.y += delta * 1.8;
      relic.mesh.position.y = relic.basePosY + Math.sin(time * 3.0) * 0.12;
      if (relic.light) {
        if (relic.type === 'joint') {
          relic.light.intensity = 1.2 + Math.sin(time * 5.0) * 0.35;
        } else {
          relic.light.intensity = 1.0 + Math.sin(time * 3.0) * 0.25;
        }
      }
    }

    for (let i = this.animatingDoors.length - 1; i >= 0; i--) {
      const door = this.animatingDoors[i];
      door.progress = Math.min(1.0, door.progress + delta / door.duration);
      applyDoorOpenProgress(door.mesh, door.progress);
      if (door.progress >= 1.0) {
        this.animatingDoors.splice(i, 1);
      }
    }
  }

  public getSunIntensity(): number | undefined {
    return this.sunIntensity;
  }

  public setSunIntensity(val?: number): void {
    this.sunIntensity = val;
    if (this.currentData) {
      this.currentData.sunIntensity = val;
    }
  }

  public getFixtureIntensity(): number | undefined {
    return this.fixtureIntensity;
  }

  public setFixtureIntensity(val?: number): void {
    this.fixtureIntensity = val;
    if (this.currentData) {
      this.currentData.fixtureIntensity = val;
    }
  }

  public loadEnemies(configs?: EnemyConfig[]): void {
    this.clearEnemies();
    if (!configs) return;
    for (const cfg of configs) {
      this.addEnemy(cfg);
    }
  }

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public addEnemy(config: EnemyConfig): Enemy {
    const enemy = new Enemy(config);
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.mesh);
    return enemy;
  }

  public removeEnemy(enemy: Enemy): void {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
      enemy.dispose();
    }
  }

  public clearEnemies(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
    while (this.enemyGroup.children.length > 0) {
      this.enemyGroup.remove(this.enemyGroup.children[0]);
    }
  }

  public loadCars(configs?: CarConfig[]): void {
    this.clearCars();
    if (!configs || configs.length === 0) return;
    for (const cfg of configs) {
      this.addCar(cfg);
    }
  }

  public getCars(): Car[] {
    return this.cars;
  }

  public addCar(config: CarConfig): Car {
    const car = new Car(config);
    this.cars.push(car);
    this.carGroup.add(car.mesh);
    return car;
  }

  public clearCars(): void {
    for (const car of this.cars) {
      car.dispose();
    }
    this.cars = [];
    while (this.carGroup.children.length > 0) {
      this.carGroup.remove(this.carGroup.children[0]);
    }
  }

  private disposeObject(obj: THREE.Object3D, p1?: Player, p2?: Player): void {
    if (
      obj.userData?.isPlayer ||
      (p1 && (obj === p1.mesh || obj === p1.spriteMesh || obj === p1.billboardGroup)) ||
      (p2 && (obj === p2.mesh || obj === p2.spriteMesh || obj === p2.billboardGroup))
    ) {
      return;
    }

    obj.traverse((child) => {
      if (
        child.userData?.isPlayer ||
        (p1 && (child === p1.mesh || child === p1.spriteMesh || child === p1.billboardGroup)) ||
        (p2 && (child === p2.mesh || child === p2.spriteMesh || child === p2.billboardGroup))
      ) {
        return;
      }
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      } else if (child instanceof THREE.Light) {
        child.dispose?.();
      }
    });
    if (obj.parent) {
      obj.parent.remove(obj);
    }
  }

  public clear(p1?: Player, p2?: Player): void {
    this.dispose(p1, p2);
  }

  public destroy(p1?: Player, p2?: Player): void {
    this.dispose(p1, p2);
  }

  public dispose(p1?: Player, p2?: Player): void {
    this.activePlates = [];
    this.relics = [];
    this.clearEnemies();
    this.clearCars();

    this.waterTileMeshes = [];
    this.relicMeshes = [];

    if (p1) {
      p1.hasRelic = false;
      p1.velocity.set(0, 0, 0);
      p1.velocityY = 0;
      p1.mesh.visible = true;
      if (p1.spriteMesh) p1.spriteMesh.visible = true;
    }
    if (p2) {
      p2.hasRelic = false;
      p2.velocity.set(0, 0, 0);
      p2.velocityY = 0;
      p2.mesh.visible = true;
      if (p2.spriteMesh) p2.spriteMesh.visible = true;
    }

    for (const mesh of this.meshMap.values()) {
      this.disposeObject(mesh, p1, p2);
    }
    for (const mesh of this.layerMeshes.values()) {
      this.disposeObject(mesh, p1, p2);
    }
    this.meshMap.clear();
    this.layerMeshes.clear();
    this.gridMap.clear();
    this.tileMap.clear();
    this.columnMap.clear();

    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child !== this.enemyGroup && child !== this.carGroup) {
        this.disposeObject(child, p1, p2);
      }
    }

    this.group.add(this.enemyGroup);
    this.group.add(this.carGroup);
  }

  public getRelics(): RelicData[] {
    return this.currentData?.relics ?? [];
  }

  public addRelic(relic: RelicData): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    if (!this.currentData.relics) {
      this.currentData.relics = [];
    }
    this.currentData.relics.push(relic);
  }

  public removeRelicAt(gx: number, gz: number): boolean {
    if (!this.currentData?.relics) return false;
    const idx = this.currentData.relics.findIndex(
      (r) =>
        (r.position && r.position[0] === gx && r.position[1] === gz) ||
        (r.x === gx && r.z === gz)
    );
    if (idx !== -1) {
      this.currentData.relics.splice(idx, 1);
      return true;
    }
    return false;
  }

  public removeRelicMeshNear(worldX: number, worldZ: number, radius = 2.5): void {
    for (let i = this.relicMeshes.length - 1; i >= 0; i--) {
      const rm = this.relicMeshes[i];
      const dist = Math.hypot(rm.mesh.position.x - worldX, rm.mesh.position.z - worldZ);
      if (dist <= radius) {
        rm.mesh.visible = false;
        rm.mesh.position.set(0, -999, 0);
        if (rm.light) {
          rm.light.intensity = 0;
          rm.light.visible = false;
        }
        if (rm.mesh.parent) {
          rm.mesh.parent.remove(rm.mesh);
        }
        this.group.remove(rm.mesh);
        this.relicMeshes.splice(i, 1);
      }
    }
  }

  public addPlatePair(
    id: string,
    plate1: [number, number],
    plate2: [number, number],
    targetObstacle?: [number, number]
  ): boolean {
    if (!this.currentData) return false;
    if (!this.currentData.platePairs) this.currentData.platePairs = [];
    this.currentData.platePairs.push({ id, plate1, plate2, targetObstacle });
    return true;
  }

  public updatePlatePosition(pairId: string, plateNum: 1 | 2, gx: number, gz: number): boolean {
    if (!this.currentData?.platePairs) return false;
    const pair = this.currentData.platePairs.find((p) => p.id === pairId);
    if (!pair) return false;
    if (plateNum === 1) {
      pair.plate1 = [gx, gz];
    } else {
      pair.plate2 = [gx, gz];
    }
    return true;
  }

  public updateObstaclePosition(pairId: string, gx: number, gz: number): boolean {
    if (!this.currentData?.platePairs) return false;
    const pair = this.currentData.platePairs.find((p) => p.id === pairId);
    if (!pair) return false;
    pair.targetObstacle = [gx, gz];
    return true;
  }

  public removePlatePair(pairId: string): boolean {
    if (!this.currentData?.platePairs) return false;
    const idx = this.currentData.platePairs.findIndex((p) => p.id === pairId);
    if (idx !== -1) {
      this.currentData.platePairs.splice(idx, 1);
      return true;
    }
    return false;
  }

  public updateSwitchPosition(switchId: string, gx: number, gz: number): boolean {
    if (!this.currentData) return false;
    if (!this.currentData.switches) this.currentData.switches = [];
    const sw = this.currentData.switches.find((s) => s.id === switchId);
    if (sw) {
      sw.position = [gx, gz];
      return true;
    }
    return false;
  }

  public updateSwitchTargetObstacle(switchId: string, targetObstacle?: [number, number], targetDoorId?: string): boolean {
    if (!this.currentData) return false;
    if (!this.currentData.switches) this.currentData.switches = [];
    let sw = this.currentData.switches.find((s) => s.id === switchId);
    if (!sw) {
      sw = { id: switchId, position: [0, 0] };
      this.currentData.switches.push(sw);
    }
    sw.targetObstacle = targetObstacle;
    if (targetDoorId) sw.targetDoorId = targetDoorId;
    return true;
  }

  public removeSwitch(switchId: string): boolean {
    if (!this.currentData?.switches) return false;
    const idx = this.currentData.switches.findIndex((s) => s.id === switchId);
    if (idx !== -1) {
      this.currentData.switches.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getExitPortal(): [number, number] | undefined {
    return this.currentData?.exitPortal;
  }

  public setExitPortal(portal?: [number, number]): void {
    if (!this.currentData) {
      this.currentData = this.toJSON();
    }
    this.currentData.exitPortal = portal ? [portal[0], portal[1]] : undefined;
  }

  public updateRelicPosition(relicId: string, gx: number, gz: number): boolean {
    if (!this.currentData?.relics) return false;
    const relic = this.currentData.relics.find((r) => r.id === relicId);
    if (!relic) return false;
    relic.position = [gx, gz];
    relic.x = gx;
    relic.z = gz;
    return true;
  }

  public removeRelicById(relicId: string): boolean {
    if (!this.currentData?.relics) return false;
    const idx = this.currentData.relics.findIndex((r) => r.id === relicId);
    if (idx !== -1) {
      this.currentData.relics.splice(idx, 1);
      return true;
    }
    return false;
  }

  public onRelicCollide(player: Player, relicMesh?: THREE.Object3D): boolean {
    if (player.hasRelic) {
      player.rejectRelic();
      return false;
    }
    player.hasRelic = true;
    if (relicMesh) {
      this.group.remove(relicMesh);
    }
    return true;
  }

  public exportTilesArray(): TileData[] {
    const tiles: TileData[] = [];
    for (const [key, cell] of this.gridMap.entries()) {
      const parts = key.split(',').map(Number);
      const gx = parts[0];
      const gy = parts.length > 2 ? parts[1] : (cell.y ?? 0);
      const gz = parts.length > 2 ? parts[2] : parts[1];

      if (cell.floor) {
        tiles.push({
          id: cell.floor,
          x: gx,
          y: gy,
          z: gz,
          solid: false,
          rotation: cell.floorRotation,
          rotationY: ((cell.floorRotation ?? 0) * Math.PI) / 180,
        });
      }
      if (cell.floorDecor) {
        tiles.push({
          id: cell.floorDecor,
          x: gx,
          y: gy,
          z: gz,
          solid: false,
          rotation: cell.floorDecorRotation ?? cell.rotation,
          rotationY: ((cell.floorDecorRotation ?? cell.rotation ?? 0) * Math.PI) / 180,
        });
      }
      if (cell.prop) {
        tiles.push({
          id: cell.prop,
          x: gx,
          y: gy,
          z: gz,
          solid: isSolidTileType(cell.prop),
          rotation: cell.propRotation ?? cell.rotation,
          rotationY: ((cell.propRotation ?? cell.rotation ?? 0) * Math.PI) / 180,
          targetDoorId: cell.targetDoorId,
          targetObstacle: cell.targetObstacle,
        });
      }
      if (cell.wall) {
        tiles.push({
          id: cell.wall,
          x: gx,
          y: gy,
          z: gz,
          solid: isSolidTileType(cell.wall),
          rotation: cell.wallRotation ?? cell.rotation,
          rotationY: ((cell.wallRotation ?? cell.rotation ?? 0) * Math.PI) / 180,
          isStair: cell.isStair,
          stairDirection: cell.stairDirection,
        });
      }
      if (cell.wallDecor) {
        tiles.push({
          id: cell.wallDecor,
          x: gx,
          y: gy,
          z: gz,
          solid: false,
          rotation: cell.wallDecorRotation ?? cell.wallRotation ?? cell.rotation,
          rotationY: ((cell.wallDecorRotation ?? cell.wallRotation ?? cell.rotation ?? 0) * Math.PI) / 180,
        });
      }
    }
    if (tiles.length === 0 && this.tileMap.size > 0) {
      return Array.from(this.tileMap.values());
    }
    return tiles;
  }

  public toJSON(): LevelData {
    const enemies = this.enemies.map((e) => e.toConfig());
    const cars = this.cars.map((c) => c.toConfig());
    const tiles = this.exportTilesArray();
    const gridObj: Record<string, GridCell> = Object.fromEntries(this.gridMap.entries());

    if (this.currentData) {
      return {
        ...this.currentData,
        theme: this.currentData.theme ?? TileTheme.DOWNTOWN,
        grid: gridObj,
        tiles,
        platePairs: this.currentData.platePairs ? JSON.parse(JSON.stringify(this.currentData.platePairs)) : undefined,
        switches: this.currentData.switches ? JSON.parse(JSON.stringify(this.currentData.switches)) : undefined,
        exitPortal: this.currentData.exitPortal ? [...this.currentData.exitPortal] : undefined,
        relics: this.currentData.relics ? JSON.parse(JSON.stringify(this.currentData.relics)) : undefined,
        cameraWaypoints: this.currentData.cameraWaypoints ? [...this.currentData.cameraWaypoints] : undefined,
        cameraMode: this.currentData.cameraMode,
        sunIntensity: this.sunIntensity,
        fixtureIntensity: this.fixtureIntensity,
        enemies: enemies.length > 0 ? enemies : undefined,
        cars: cars.length > 0 ? cars : undefined,
      };
    }
    return {
      id: 'custom_level',
      name: 'Custom Level',
      theme: TileTheme.DOWNTOWN,
      spawnP1: [2, 2],
      spawnP2: [2, 4],
      grid: gridObj,
      tiles,
      sunIntensity: this.sunIntensity,
      fixtureIntensity: this.fixtureIntensity,
      enemies: enemies.length > 0 ? enemies : undefined,
      cars: cars.length > 0 ? cars : undefined,
    };
  }
}

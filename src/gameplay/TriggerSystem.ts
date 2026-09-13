import * as THREE from 'three';
import type { Level } from '../world/Level.ts';
import { rotationToStairDir } from '../world/Level.ts';
import { GRID_CELL_SIZE, createMushroomRelicMesh, createJointRelicMesh, setSwitchButtonVisual, setKeypadTerminalVisual, setHeavyObstacleGripVisual } from '../world/BlockFactory.ts';
import type { RelicType, SwitchButtonData, KeypadTerminalData, HeavyObstacleData, StairDirection } from '../world/TileTypes.ts';
import { TileType, TileTheme } from '../world/TileTypes.ts';
import type { Player } from '../entities/Player.ts';
import { audioManager } from '../audio/AudioManager.ts';
import { voiceManager } from '../audio/VoiceManager.ts';
import type { CameraRig } from '../engine/CameraRig.ts';
import { inputManager } from '../engine/InputManager.ts';
import { keypadUI } from '../ui/KeypadUI.ts';
import { stickyNoteModal } from '../ui/StickyNoteModal.ts';
import type { PostProcessManager } from '../engine/PostProcessManager.ts';
import {
  createNpcSpeechBubble,
  showNpcSpeech,
  hideNpcSpeech,
  updateNpcSpeechPosition,
  destroyNpcSpeechBubble,
  type NpcSpeechBubble,
} from '../ui/NpcSpeechOverlay.ts';
import { vibePuzzle } from './VibePuzzle.ts';

// Shown above interactable world objects (keypad, clue note, heavy obstacle, wall chill) whenever a
// player is close enough to use them - names the Xbox controller face button since that's
// the primary co-op input, with the keyboard fallback noted alongside it.
const XBOX_ACTION_HINT = '🅰️ Xbox A gomb  ·  Space / Enter';

export interface ActiveWallChillSpot {
  id: string;
  gx: number;
  gz: number;
  worldPos: THREE.Vector3;
  facingAngle: number;
  promptBubble: NpcSpeechBubble;
  mesh?: THREE.Object3D;
}

export enum TriggerType {
  PRESSURE_PLATE = 'pressure_plate',
  RELIC = 'relic',
  EXIT_PORTAL = 'exit_portal',
}

export interface ActiveKeypad {
  data: KeypadTerminalData;
  mesh?: THREE.Object3D;
  isUnlocked: boolean;
  worldPos: THREE.Vector3;
  promptBubble: NpcSpeechBubble;
}

export interface ActiveClueNote {
  id: string;
  text: string;
  mesh?: THREE.Object3D;
  worldPos: THREE.Vector3;
  promptBubble: NpcSpeechBubble;
}

export interface ActivePlate {
  id: string;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  isPressed: boolean;
  pairId: string;
}

export interface PlatePair {
  id: string;
  plate1Pos: THREE.Vector3;
  plate2Pos: THREE.Vector3;
  plate1Mesh: THREE.Mesh;
  plate2Mesh: THREE.Mesh;
  p1Active: boolean;
  p2Active: boolean;
  isUnlocked: boolean;
  targetObstaclePos?: THREE.Vector3; // grid cell to clear when both are pressed
}

export interface RelicItem {
  id: string;
  type: RelicType;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  collected: boolean;
  baseY: number;
  smokeMeshes?: THREE.Mesh[];
  light?: THREE.PointLight;
}

export interface ExitPortalItem {
  id: string;
  position: THREE.Vector3;
  group: THREE.Group;
  outerRing: THREE.Mesh;
  innerDisc: THREE.Mesh;
  barrierGroup: THREE.Group;
  barrierMesh: THREE.Mesh;
  barrierRings: THREE.Mesh[];
  barrierLight: THREE.PointLight;
  locked: boolean;
  active: boolean;
}

export interface ActiveSwitch {
  data: SwitchButtonData;
  mesh?: THREE.Object3D;
  isPressed: boolean;
  worldPos: THREE.Vector3;
}

const HEAVY_PUSH_DIRECTIONS: Record<StairDirection, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 },
};

export interface ActiveHeavyObstacle {
  data: HeavyObstacleData;
  mesh?: THREE.Object3D;
  gx: number;
  gz: number;
  gy: number;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  dir: { x: number; z: number };
  perp: { x: number; z: number };
  pushProgress: number;
  isFullyPushed: boolean;
  dragSfxTimer: number;
  soloGruntTimer: number;
  effortVoiceTimer: number;
  promptBubble: NpcSpeechBubble;
}

export class TriggerSystem {
  public readonly group = new THREE.Group();

  public activePlates: ActivePlate[] = [];
  public isTransitioning: boolean = false;
  public isCheatActive: boolean = false;
  public cameraRig?: CameraRig;
  public switches: ActiveSwitch[] = [];
  public keypads: ActiveKeypad[] = [];
  public heavyObstacles: ActiveHeavyObstacle[] = [];
  public clueNotes: ActiveClueNote[] = [];
  public wallChillSpots: ActiveWallChillSpot[] = [];
  public postProcessManager?: PostProcessManager;
  public onToast?: (message: string) => void;
  private clueHintCooldown = 0;
  private platePairs: PlatePair[] = [];
  private relics: RelicItem[] = [];
  public exitPortal: ExitPortalItem | null = null;

  public hideExitPortal(): void {
    if (this.exitPortal) {
      this.exitPortal.group.visible = false;
    }
  }

  private time = 0;
  private collectedCount = 0;

  public onRelicCollected?: (relic: RelicItem, totalCollected: number, collector: 'p1' | 'p2') => void;
  public onPlateUnlocked?: (pair: PlatePair) => void;
  public onPlateChange?: (activeCount: number, totalCount: number) => void;
  public onLevelComplete?: () => void;
  public onLockedPortalContact?: () => void;

  constructor(scene?: THREE.Scene, cameraRig?: CameraRig) {
    if (scene) {
      scene.add(this.group);
    }
    this.cameraRig = cameraRig;
  }

  public setCameraRig(cameraRig: CameraRig): void {
    this.cameraRig = cameraRig;
  }

  public addSwitch(switchData: SwitchButtonData, level?: Level): void {
    const [gx, gz] = switchData.position;
    const elevation = level ? level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE) : 0;
    const worldPos = new THREE.Vector3(gx * GRID_CELL_SIZE, elevation, gz * GRID_CELL_SIZE);
    let mesh: THREE.Object3D | undefined;
    if (level) {
      mesh = level.getMeshAt(gx, gz) ?? undefined;
    }
    this.switches.push({
      data: switchData,
      mesh,
      isPressed: switchData.isPressed ?? false,
      worldPos,
    });
  }

  public initSwitchesFromLevel(level: Level, levelData?: any): void {
    this.switches = [];
    const switchesList: SwitchButtonData[] = levelData?.switches ? [...levelData.switches] : [];

    if (levelData?.tiles) {
      for (const t of levelData.tiles) {
        if (t.id === TileType.SWITCH_BUTTON) {
          const already = switchesList.some((s) => s.position[0] === t.x && s.position[1] === t.z);
          if (!already) {
            switchesList.push({
              id: `switch_${t.x}_${t.z}`,
              position: [t.x, t.z],
              targetDoorId: t.targetDoorId,
              targetObstacle: t.targetObstacle,
            });
          }
        }
      }
    }

    for (const sw of switchesList) {
      this.addSwitch(sw, level);
    }
  }

  /**
   * Finds the closest door tile directly adjacent (N/S/E/W) to a grid cell, used to let a
   * keypad auto-target "the door next to it" when the level data doesn't explicitly wire a
   * targetObstacle.
   */
  private findAdjacentDoorTarget(level: Level, gx: number, gz: number): [number, number] | undefined {
    const doorTypes = new Set<TileType>([
      TileType.DOOR_APARTMENT,
      TileType.DOOR_STORE,
      TileType.DOOR_METRO,
      TileType.DOOR_SUBURBAN_GATE,
      TileType.DOOR_SOPELANA_IRON,
    ]);
    const neighbors: Array<[number, number]> = [
      [gx + 1, gz],
      [gx - 1, gz],
      [gx, gz + 1],
      [gx, gz - 1],
    ];
    for (const [nx, nz] of neighbors) {
      const tile = level.getTileAtGrid(nx, nz, 0);
      if (tile && doorTypes.has(tile.id)) {
        return [nx, nz];
      }
    }
    return undefined;
  }

  public addKeypad(keypadData: KeypadTerminalData, level?: Level): void {
    // Clone so runtime state (isUnlocked, auto-resolved targetObstacle) never mutates the
    // shared level-data constant - otherwise a keypad can appear permanently solved after a
    // Quick Restart within the same session (see levelsdata-shared-state-mutation memory).
    const data: KeypadTerminalData = { ...keypadData };
    const gx = data.position[0];
    const gz = data.position[1];
    const elevation = level ? level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE) : 0;
    const worldPos = new THREE.Vector3(gx * GRID_CELL_SIZE, elevation, gz * GRID_CELL_SIZE);
    let mesh: THREE.Object3D | undefined;
    if (level) {
      mesh = level.getMeshAt(gx, gz) ?? undefined;
      if (!data.targetObstacle) {
        data.targetObstacle = this.findAdjacentDoorTarget(level, gx, gz);
      }
    }
    this.keypads.push({
      data,
      mesh,
      isUnlocked: data.isUnlocked ?? false,
      worldPos,
      promptBubble: createNpcSpeechBubble(),
    });
  }

  public initKeypadsFromLevel(level: Level, levelData?: any): void {
    this.keypads = [];
    const keypadsList: KeypadTerminalData[] = levelData?.keypads ? [...levelData.keypads] : [];

    if (levelData?.tiles) {
      for (const t of levelData.tiles) {
        if (t.id === TileType.KEYPAD_TERMINAL) {
          const already = keypadsList.some((k) => k.position[0] === t.x && k.position[1] === t.z);
          if (!already) {
            keypadsList.push({
              id: `keypad_${t.x}_${t.z}`,
              position: [t.x, t.z],
              targetDoorId: t.targetDoorId,
              targetObstacle: t.targetObstacle,
              code: '420',
            });
          }
        }
      }
    }

    if (levelData?.grid) {
      for (const [key, cell] of Object.entries(levelData.grid as Record<string, import('../types/LevelTypes.ts').GridCell>)) {
        if (cell.wallDecor === TileType.KEYPAD_TERMINAL || cell.prop === TileType.KEYPAD_TERMINAL || cell.wall === TileType.KEYPAD_TERMINAL) {
          const parts = key.split(',').map(Number);
          const gx = parts[0];
          const gz = parts.length === 3 ? parts[2] : parts[1];
          const already = keypadsList.some((k) => k.position[0] === gx && k.position[1] === gz);
          if (!already) {
            keypadsList.push({
              id: `keypad_${gx}_${gz}`,
              position: [gx, gz],
              targetDoorId: cell.targetDoorId,
              targetObstacle: cell.targetObstacle,
              code: '420',
            });
          }
        }
      }
    }

    for (const kp of keypadsList) {
      this.addKeypad(kp, level);
    }
  }

  private static readonly DEFAULT_CLUE_TEXT = 'Kód: a délutáni rituálé ideje... 🌿';

  public addClueNote(id: string, gx: number, gz: number, text: string, level?: Level): void {
    const elevation = level ? level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE) : 0;
    const worldPos = new THREE.Vector3(gx * GRID_CELL_SIZE, elevation, gz * GRID_CELL_SIZE);
    let mesh: THREE.Object3D | undefined;
    if (level) {
      mesh = level.getMeshAt(gx, gz) ?? undefined;
    }
    this.clueNotes.push({
      id,
      text,
      mesh,
      worldPos,
      promptBubble: createNpcSpeechBubble(),
    });
  }

  /**
   * Every STICKY_NOTE_CLUE tile placed on the level's floorDecor layer becomes a readable
   * clue - the note's own screen position is purely decorative, so this scans wherever it
   * was actually placed in the (possibly redesigned) level data instead of a hardcoded spot.
   */
  public initClueNotesFromLevel(level: Level, levelData?: any): void {
    this.clueNotes = [];
    const seen = new Set<string>();

    const register = (gx: number, gz: number) => {
      const key = `${gx},${gz}`;
      if (seen.has(key)) return;
      seen.add(key);
      this.addClueNote(`clue_${gx}_${gz}`, gx, gz, TriggerSystem.DEFAULT_CLUE_TEXT, level);
    };

    if (levelData?.tiles) {
      for (const t of levelData.tiles) {
        if (t.id === TileType.STICKY_NOTE_CLUE) {
          register(t.x, t.z);
        }
      }
    }

    if (levelData?.grid) {
      for (const [key, cell] of Object.entries(levelData.grid as Record<string, import('../types/LevelTypes.ts').GridCell>)) {
        if (cell.floorDecor === TileType.STICKY_NOTE_CLUE) {
          const parts = key.split(',').map(Number);
          const gx = parts[0];
          const gz = parts.length === 3 ? parts[2] : parts[1];
          register(gx, gz);
        }
      }
    }
  }

  public addHeavyObstacle(rawData: HeavyObstacleData, level?: Level): ActiveHeavyObstacle {
    // Clone so per-run push progress never mutates the shared level-data constant
    // (which would otherwise leave the obstacle permanently "pushed" after a restart/replay).
    const data: HeavyObstacleData = { ...rawData };
    const [gx, gz] = data.position;
    const gy = 0;
    const elevation = level ? level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE) : 0;
    const startPos = new THREE.Vector3(gx * GRID_CELL_SIZE, elevation, gz * GRID_CELL_SIZE);

    const dir = HEAVY_PUSH_DIRECTIONS[data.pushDirection ?? 'east'];
    const distance = data.pushDistance ?? 3.0;
    const targetPos = new THREE.Vector3(startPos.x + dir.x * distance, startPos.y, startPos.z + dir.z * distance);

    const mesh = level ? level.getMeshAt(gx, gz, gy) ?? undefined : undefined;

    const obstacle: ActiveHeavyObstacle = {
      data,
      mesh,
      gx,
      gz,
      gy,
      startPos,
      targetPos,
      dir,
      perp: { x: -dir.z, z: dir.x },
      pushProgress: data.pushProgress ?? 0,
      isFullyPushed: data.isFullyPushed ?? false,
      dragSfxTimer: 0,
      soloGruntTimer: 0,
      effortVoiceTimer: 0,
      promptBubble: createNpcSpeechBubble(),
    };

    if (obstacle.isFullyPushed) {
      if (mesh) mesh.position.copy(targetPos);
      level?.clearHeavyObstacleAt(gx, gz, gy);
    }

    this.heavyObstacles.push(obstacle);
    return obstacle;
  }

  public initHeavyObstaclesFromLevel(level: Level, levelData?: any): void {
    this.heavyObstacles = [];
    const obstacleList: HeavyObstacleData[] = levelData?.heavyObstacles ? [...levelData.heavyObstacles] : [];

    const registerIfNew = (
      gx: number,
      gz: number,
      rotationDeg?: number,
      targetDoorId?: string,
      targetObstacle?: [number, number]
    ) => {
      if (obstacleList.some((o) => o.position[0] === gx && o.position[1] === gz)) return;
      const pushDirection: StairDirection =
        rotationDeg !== undefined ? rotationToStairDir((rotationDeg * Math.PI) / 180) : 'east';
      obstacleList.push({
        id: `heavy_${gx}_${gz}`,
        position: [gx, gz],
        pushDirection,
        targetDoorId,
        targetObstacle,
      });
    };

    if (levelData?.tiles) {
      for (const t of levelData.tiles) {
        if (t.id === TileType.HEAVY_OBSTACLE) {
          registerIfNew(t.x, t.z, t.rotation, t.targetDoorId, t.targetObstacle);
        }
      }
    }

    if (levelData?.grid) {
      for (const [key, cell] of Object.entries(levelData.grid as Record<string, import('../types/LevelTypes.ts').GridCell>)) {
        if (cell.prop === TileType.HEAVY_OBSTACLE) {
          const parts = key.split(',').map(Number);
          const gx = parts[0];
          const gz = parts.length === 3 ? parts[2] : parts[1];
          registerIfNew(gx, gz, cell.propRotation ?? cell.rotation, cell.targetDoorId, cell.targetObstacle);
        }
      }
    }

    for (const ob of obstacleList) {
      this.addHeavyObstacle(ob, level);
    }
  }

  public initWallChillSpotsFromLevel(level: Level, levelData?: any): void {
    this.wallChillSpots = [];
    const spots: Array<{ gx: number; gz: number; rotation?: number }> = [];

    if (levelData?.tiles) {
      for (const t of levelData.tiles) {
        if (t.id === TileType.WALL_CHILL_SPOT) {
          spots.push({ gx: t.x, gz: t.z, rotation: t.rotation ?? t.rotationY ?? 0 });
        }
      }
    }

    if (levelData?.grid) {
      for (const [key, cell] of Object.entries(levelData.grid as Record<string, any>)) {
        if (
          cell.floorDecor === TileType.WALL_CHILL_SPOT ||
          cell.prop === TileType.WALL_CHILL_SPOT ||
          cell.floor === TileType.WALL_CHILL_SPOT
        ) {
          const parts = key.split(',').map(Number);
          const gx = parts[0];
          const gz = parts.length === 3 ? parts[2] : parts[1];
          spots.push({ gx, gz, rotation: cell.rotation ?? 0 });
        }
      }
    }

    for (const s of spots) {
      const elev = level ? level.getElevationAt(s.gx * GRID_CELL_SIZE, s.gz * GRID_CELL_SIZE) : 0;
      const worldPos = new THREE.Vector3(s.gx * GRID_CELL_SIZE, elev, s.gz * GRID_CELL_SIZE);
      const mesh = level ? (level.getMeshAt(s.gx, s.gz) ?? undefined) : undefined;
      const facingAngle = s.rotation ? (s.rotation * Math.PI) / 180 : 0;
      this.wallChillSpots.push({
        id: `wall_chill_${s.gx}_${s.gz}`,
        gx: s.gx,
        gz: s.gz,
        worldPos,
        facingAngle,
        promptBubble: createNpcSpeechBubble(),
        mesh,
      });
    }
  }

  private isNearHeavyGrip(playerPos: THREE.Vector3, obstaclePos: THREE.Vector3, dir: { x: number; z: number }): boolean {
    const dx = playerPos.x - obstaclePos.x;
    const dz = playerPos.z - obstaclePos.z;
    if (Math.hypot(dx, dz) > 2.0) return false;
    if (Math.abs(playerPos.y - obstaclePos.y) > 1.4) return false;
    // Must be roughly behind the obstacle (opposite of push direction), not out ahead of it
    const forwardDot = dx * dir.x + dz * dir.z;
    return forwardDot < 0.6;
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => m.dispose());
          } else if (c.material) {
            c.material.dispose();
          }
        } else if (c instanceof THREE.Light) {
          c.dispose?.();
        }
      });
    }
    for (const kp of this.keypads) destroyNpcSpeechBubble(kp.promptBubble);
    for (const note of this.clueNotes) destroyNpcSpeechBubble(note.promptBubble);
    for (const ob of this.heavyObstacles) destroyNpcSpeechBubble(ob.promptBubble);
    for (const spot of this.wallChillSpots) destroyNpcSpeechBubble(spot.promptBubble);
    this.wallChillSpots = [];
    if (vibePuzzle.isActive) {
      vibePuzzle.stopChillMode();
    }

    this.activePlates = [];
    this.platePairs = [];
    this.relics = [];
    this.switches = [];
    this.keypads = [];
    this.heavyObstacles = [];
    this.clueNotes = [];
    this.exitPortal = null;
    this.collectedCount = 0;
    this.isTransitioning = false;
    this.isCheatActive = false;
  }

  public addExitPortal(id: string, gridPos: [number, number], level?: Level, levelData?: any): ExitPortalItem {
    const portalGroup = new THREE.Group();
    portalGroup.name = 'ExitPortalGroup';
    const groundY = level ? level.getElevationAt(gridPos[0] * GRID_CELL_SIZE, gridPos[1] * GRID_CELL_SIZE) : 0;
    const position = new THREE.Vector3(
      gridPos[0] * GRID_CELL_SIZE,
      groundY + 0.02,
      gridPos[1] * GRID_CELL_SIZE
    );
    portalGroup.position.copy(position);

    // Initial locked status: locked if there are any plate pairs, relics, or vibe chill spots
    const hasRelics = this.relics.length > 0 || (levelData?.relics && levelData.relics.length > 0);
    const hasPlates = this.platePairs.length > 0 || (levelData?.platePairs && levelData.platePairs.length > 0);
    const hasWallChill =
      this.wallChillSpots.length > 0 ||
      levelData?.id === 'level_6_etxebarria' ||
      levelData?.theme === TileTheme.PARK ||
      Boolean(levelData?.tiles?.some((t: any) => t.id === TileType.WALL_CHILL_SPOT));

    const isLockedByDefault = hasPlates || hasRelics || hasWallChill;

    // Outer Ring (Cyan when unlocked, Deep Crimson when locked)
    const outerGeo = new THREE.RingGeometry(0.85, 1.25, 32);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshStandardMaterial({
      color: isLockedByDefault ? 0x991b1b : 0x06b6d4,
      emissive: isLockedByDefault ? 0xef4444 : 0x06b6d4,
      emissiveIntensity: isLockedByDefault ? 0.6 : 1.0,
      side: THREE.DoubleSide,
      roughness: 0.2,
      metalness: 0.6,
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    portalGroup.add(outerRing);

    // Inner Disc (Magenta when unlocked, Deep Red when locked)
    const innerGeo = new THREE.CircleGeometry(0.65, 32);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshStandardMaterial({
      color: isLockedByDefault ? 0x7f1d1d : 0xd946ef,
      emissive: isLockedByDefault ? 0xb91c1c : 0xd946ef,
      emissiveIntensity: isLockedByDefault ? 0.7 : 1.2,
      side: THREE.DoubleSide,
      roughness: 0.2,
      metalness: 0.5,
    });
    const innerDisc = new THREE.Mesh(innerGeo, innerMat);
    innerDisc.position.y = 0.005;
    portalGroup.add(innerDisc);

    // Physical Energy Barrier Field (Visible when locked)
    const barrierGroup = new THREE.Group();
    barrierGroup.name = 'PortalBarrierField';

    // Translucent Energy Cylinder
    const barrierGeo = new THREE.CylinderGeometry(1.25, 1.25, 2.6, 24, 1, true);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.2,
      depthWrite: false,
    });
    const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
    barrierMesh.position.y = 1.3;
    barrierGroup.add(barrierMesh);

    // 3 Horizontal Glowing Energy Laser Rings around the barrier
    const barrierRings: THREE.Mesh[] = [];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.8,
    });
    const ringHeights = [0.4, 1.3, 2.2];
    for (const rh of ringHeights) {
      const ringGeo = new THREE.TorusGeometry(1.26, 0.03, 8, 24);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = rh;
      barrierGroup.add(ringMesh);
      barrierRings.push(ringMesh);
    }

    // Barrier Warning Point Light
    const barrierLight = new THREE.PointLight(0xef4444, 2.4, 6.0);
    barrierLight.position.set(0, 1.5, 0);
    barrierGroup.add(barrierLight);

    barrierGroup.visible = isLockedByDefault;
    portalGroup.add(barrierGroup);

    this.group.add(portalGroup);

    const item: ExitPortalItem = {
      id,
      position,
      group: portalGroup,
      outerRing,
      innerDisc,
      barrierGroup,
      barrierMesh,
      barrierRings,
      barrierLight,
      locked: isLockedByDefault,
      active: false,
    };
    this.exitPortal = item;
    return item;
  }

  public addPlatePair(
    id: string,
    plate1Grid: [number, number],
    plate2Grid: [number, number],
    targetObstacleGrid?: [number, number],
    level?: Level
  ): PlatePair {
    const plateGeo = new THREE.BoxGeometry(1.2, 0.08, 1.2);

    // Initial inactive state: warm amber emissive
    const createPlateMaterial = () =>
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.35,
        metalness: 0.7,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
      });

    const groundY1 = level ? level.getElevationAt(plate1Grid[0] * GRID_CELL_SIZE, plate1Grid[1] * GRID_CELL_SIZE) : 0;
    const groundY2 = level ? level.getElevationAt(plate2Grid[0] * GRID_CELL_SIZE, plate2Grid[1] * GRID_CELL_SIZE) : 0;

    const plate1Pos = new THREE.Vector3(
      plate1Grid[0] * GRID_CELL_SIZE,
      groundY1 + 0.04,
      plate1Grid[1] * GRID_CELL_SIZE
    );
    const plate2Pos = new THREE.Vector3(
      plate2Grid[0] * GRID_CELL_SIZE,
      groundY2 + 0.04,
      plate2Grid[1] * GRID_CELL_SIZE
    );

    const createBeacon = () => {
      const beaconGeo = new THREE.CylinderGeometry(0.35, 0.48, 2.0, 16, 1, true);
      beaconGeo.translate(0, 1.0, 0);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.userData.isBeacon = true;
      return beaconMesh;
    };

    const plate1Mesh = new THREE.Mesh(plateGeo, createPlateMaterial());
    plate1Mesh.position.copy(plate1Pos);
    plate1Mesh.receiveShadow = true;
    plate1Mesh.add(createBeacon());
    this.group.add(plate1Mesh);

    const plate2Mesh = new THREE.Mesh(plateGeo, createPlateMaterial());
    plate2Mesh.position.copy(plate2Pos);
    plate2Mesh.receiveShadow = true;
    plate2Mesh.add(createBeacon());
    this.group.add(plate2Mesh);

    let targetObstaclePos: THREE.Vector3 | undefined;
    if (targetObstacleGrid) {
      const obstacleY = level ? level.getElevationAt(targetObstacleGrid[0] * GRID_CELL_SIZE, targetObstacleGrid[1] * GRID_CELL_SIZE) : 0;
      targetObstaclePos = new THREE.Vector3(
        targetObstacleGrid[0] * GRID_CELL_SIZE,
        obstacleY,
        targetObstacleGrid[1] * GRID_CELL_SIZE
      );
    }

    const pair: PlatePair = {
      id,
      plate1Pos,
      plate2Pos,
      plate1Mesh,
      plate2Mesh,
      p1Active: false,
      p2Active: false,
      isUnlocked: false,
      targetObstaclePos,
    };

    this.platePairs.push(pair);

    // Register active individual plates for dynamic counting
    this.activePlates.push(
      {
        id: `${id}_p1`,
        pairId: id,
        position: plate1Pos,
        mesh: plate1Mesh,
        isPressed: false,
      },
      {
        id: `${id}_p2`,
        pairId: id,
        position: plate2Pos,
        mesh: plate2Mesh,
        isPressed: false,
      }
    );

    // If an exit portal was added previously, ensure it is locked by default
    if (this.exitPortal) {
      this.exitPortal.locked = true;
      this.exitPortal.barrierGroup.visible = true;
      this.setPortalLockedVisuals(this.exitPortal, true);
    }

    return pair;
  }

  public addRelic(
    id: string,
    gridPos: [number, number],
    level?: Level,
    relicType: RelicType = 'mushroom'
  ): RelicItem {
    const groundY = level ? level.getElevationAt(gridPos[0] * GRID_CELL_SIZE, gridPos[1] * GRID_CELL_SIZE) : 0;
    const mesh = relicType === 'joint' ? createJointRelicMesh() : createMushroomRelicMesh();

    const baseY = groundY + 0.15;
    const position = new THREE.Vector3(
      gridPos[0] * GRID_CELL_SIZE,
      baseY,
      gridPos[1] * GRID_CELL_SIZE
    );
    mesh.position.copy(position);
    this.group.add(mesh);

    const smokeMeshes = mesh.userData?.smokeMeshes as THREE.Mesh[] | undefined;
    const light =
      (mesh.userData?.light as THREE.PointLight | undefined) ||
      (mesh.children.find((c) => c instanceof THREE.PointLight) as THREE.PointLight | undefined);

    const relic: RelicItem = {
      id,
      type: relicType,
      mesh,
      position,
      collected: false,
      baseY,
      smokeMeshes,
      light,
    };

    this.relics.push(relic);
    return relic;
  }

  public onRelicCollide(player: Player, relic: RelicItem, level?: Level): boolean {
    if (relic.collected) return false;

    // Hard 1-relic-per-player lock
    if (player.hasRelic) {
      player.rejectRelic();
      return false;
    }

    player.hasRelic = true;
    relic.collected = true;
    relic.mesh.visible = false;
    relic.mesh.position.set(0, -999, 0);
    if (relic.light) {
      relic.light.intensity = 0;
      relic.light.visible = false;
    }
    if (relic.mesh.parent) {
      relic.mesh.parent.remove(relic.mesh);
    }
    this.group.remove(relic.mesh);
    if (level) {
      level.removeRelicMeshNear(relic.position.x, relic.position.z);
    }
    this.collectedCount++;

    audioManager.playPickup();
    // Character-specific lines per VOICE_SCRIPTS.md (relic_pickup)
    const pickupLine = player.id === 'p2' ? 'Egy nálam van, keresd a másikat!' : 'Nálam a gomba, megvan az egyik!';
    player.say(pickupLine, 2.6, 'relic_pickup');

    if (this.onRelicCollected) {
      this.onRelicCollected(relic, this.collectedCount, player.id);
    }
    return true;
  }

  public update(
    delta: number,
    p1Pos: THREE.Vector3,
    p2Pos: THREE.Vector3,
    level: Level,
    player1?: Player | boolean,
    player2?: Player | boolean
  ): void {
    this.time += delta;

    const p1Obj = player1 && typeof player1 === 'object' && 'hasRelic' in player1 ? (player1 as Player) : null;
    const p2Obj = player2 && typeof player2 === 'object' && 'hasRelic' in player2 ? (player2 as Player) : null;
    const p1HasRelic = p1Obj ? p1Obj.hasRelic : Boolean(player1);
    const p2HasRelic = p2Obj ? p2Obj.hasRelic : Boolean(player2);

    const prevPressedCount = this.getPressedPlatesCount();

    // --- 1. Dual Pressure Plates Logic ---
    for (const pair of this.platePairs) {
      for (const pMesh of [pair.plate1Mesh, pair.plate2Mesh]) {
        const b = pMesh.children.find((c) => (c as any).userData?.isBeacon) as THREE.Mesh | undefined;
        if (b) {
          b.rotation.y += delta * 1.0;
          b.scale.y = 1.0 + Math.sin(this.time * 3.5) * 0.08;
        }
      }

      const ap1 = this.activePlates.find((p) => p.id === `${pair.id}_p1`);
      const ap2 = this.activePlates.find((p) => p.id === `${pair.id}_p2`);

      if (pair.isUnlocked) {
        if (ap1) ap1.isPressed = true;
        if (ap2) ap2.isPressed = true;
        this.setPlateEmissive(pair.plate1Mesh, 0x22c55e, 1.2);
        this.setPlateEmissive(pair.plate2Mesh, 0x22c55e, 1.2);
        continue;
      }

      const d1_p1 = Math.hypot(p1Pos.x - pair.plate1Pos.x, p1Pos.z - pair.plate1Pos.z);
      const d1_p2 = Math.hypot(p2Pos.x - pair.plate1Pos.x, p2Pos.z - pair.plate1Pos.z);
      const d2_p1 = Math.hypot(p1Pos.x - pair.plate2Pos.x, p1Pos.z - pair.plate2Pos.z);
      const d2_p2 = Math.hypot(p2Pos.x - pair.plate2Pos.x, p2Pos.z - pair.plate2Pos.z);

      const h1_p1 = Math.abs(p1Pos.y - (pair.plate1Pos.y - 0.22));
      const h1_p2 = Math.abs(p2Pos.y - (pair.plate1Pos.y - 0.22));
      const h2_p1 = Math.abs(p1Pos.y - (pair.plate2Pos.y - 0.22));
      const h2_p2 = Math.abs(p2Pos.y - (pair.plate2Pos.y - 0.22));

      const plate1Occupied = (d1_p1 < 0.9 && h1_p1 < 1.0) || (d1_p2 < 0.9 && h1_p2 < 1.0);
      const plate2Occupied = (d2_p1 < 0.9 && h2_p1 < 1.0) || (d2_p2 < 0.9 && h2_p2 < 1.0);

      if (plate1Occupied && !pair.p1Active) {
        audioManager.playPlateStep(true, false);
        voiceManager.playShuffle('plate', ['p1_plate_1.mp3', 'p2_plate_1.mp3']);
      }
      if (plate2Occupied && !pair.p2Active) {
        audioManager.playPlateStep(true, false);
        voiceManager.playShuffle('plate', ['p1_plate_1.mp3', 'p2_plate_1.mp3']);
      }

      const bothOccupiedDifferentPlates =
        (d1_p1 < 0.9 && h1_p1 < 1.0 && d2_p2 < 0.9 && h2_p2 < 1.0) ||
        (d1_p2 < 0.9 && h1_p2 < 1.0 && d2_p1 < 0.9 && h2_p1 < 1.0);

      pair.p1Active = plate1Occupied;
      pair.p2Active = plate2Occupied;
      if (ap1) ap1.isPressed = plate1Occupied;
      if (ap2) ap2.isPressed = plate2Occupied;

      if (bothOccupiedDifferentPlates) {
        pair.isUnlocked = true;
        if (ap1) ap1.isPressed = true;
        if (ap2) ap2.isPressed = true;

        this.setPlateEmissive(pair.plate1Mesh, 0x22c55e, 1.4);
        this.setPlateEmissive(pair.plate2Mesh, 0x22c55e, 1.4);

        audioManager.playPlateStep(true, true);
        voiceManager.playShuffle('puzzle', ['p1_plate_1.mp3', 'p2_plate_1.mp3']);

        if (pair.targetObstaclePos) {
          const gx = Math.round(pair.targetObstaclePos.x / GRID_CELL_SIZE);
          const gz = Math.round(pair.targetObstaclePos.z / GRID_CELL_SIZE);
          const theme = level.getCurrentData()?.theme;

          let zOffsets = [0];
          if (theme === TileTheme.METRO) {
            zOffsets = [-1, 0, 1];
          } else if (theme === TileTheme.DOWNTOWN && gx === 24) {
            zOffsets = [-2, -1, 0, 1, 2];
          }

          const doorWorldPos = new THREE.Vector3(gx * GRID_CELL_SIZE, 0, gz * GRID_CELL_SIZE);
          const doorMesh = level.getMeshAt(gx, gz);
          const doorNormal = new THREE.Vector3(0, 0, 1);
          if (doorMesh) {
            doorNormal.applyEuler(doorMesh.rotation).normalize();
          }

          const openDoors = () => {
            for (const dz of zOffsets) {
              const curZ = gz + dz;
              level.openDoorAt(gx, curZ);
            }
            audioManager.playDoorOpen();
          };

          if (this.cameraRig) {
            this.cameraRig.focusOnDoor(doorWorldPos, doorNormal, openDoors);
          } else {
            openDoors();
          }
        }

        if (this.onPlateUnlocked) {
          this.onPlateUnlocked(pair);
        }
      } else {
        if (plate1Occupied) {
          this.setPlateEmissive(pair.plate1Mesh, 0x06b6d4, 0.9);
        } else {
          this.setPlateEmissive(pair.plate1Mesh, 0xd97706, 0.4);
        }

        if (plate2Occupied) {
          this.setPlateEmissive(pair.plate2Mesh, 0x06b6d4, 0.9);
        } else {
          this.setPlateEmissive(pair.plate2Mesh, 0xd97706, 0.4);
        }
      }
    }

    const currentPressedCount = this.getPressedPlatesCount();
    if (currentPressedCount !== prevPressedCount && this.onPlateChange) {
      this.onPlateChange(currentPressedCount, this.activePlates.length);
    }

    // --- 1.5. Interactive Switch Buttons Logic ---
    for (const sw of this.switches) {
      if (sw.isPressed) continue;

      if (!sw.mesh) {
        const gx = sw.data.position[0];
        const gz = sw.data.position[1];
        sw.mesh = level.getMeshAt(gx, gz) ?? undefined;
      }

      const d1 = Math.hypot(p1Pos.x - sw.worldPos.x, p1Pos.z - sw.worldPos.z);
      const d2 = Math.hypot(p2Pos.x - sw.worldPos.x, p2Pos.z - sw.worldPos.z);
      const h1 = Math.abs(p1Pos.y - sw.worldPos.y);
      const h2 = Math.abs(p2Pos.y - sw.worldPos.y);

      const near1 = d1 < 1.3 && h1 < 1.5;
      const near2 = d2 < 1.3 && h2 < 1.5;

      if (near1 || near2) {
        const action1 = near1 && (inputManager.getP1Action() || inputManager.isP1Action());
        const action2 = near2 && (inputManager.getP2Action() || inputManager.isP2Action());
        const contact = d1 < 0.75 || d2 < 0.75; // direct touch/contact trigger fallback

        if (action1 || action2 || contact) {
          sw.isPressed = true;
          sw.data.isPressed = true;
          if (sw.mesh) {
            setSwitchButtonVisual(sw.mesh, true);
          }
          audioManager.playSwitchClick();

          if (sw.data.targetObstacle) {
            const [doorGx, doorGz] = sw.data.targetObstacle;
            const doorWorldPos = new THREE.Vector3(doorGx * GRID_CELL_SIZE, 0, doorGz * GRID_CELL_SIZE);
            const doorMesh = level.getMeshAt(doorGx, doorGz);
            const doorNormal = new THREE.Vector3(0, 0, 1);
            if (doorMesh) {
              doorNormal.applyEuler(doorMesh.rotation).normalize();
            }

            const openDoor = () => {
              level.openDoorAt(doorGx, doorGz);
              audioManager.playDoorOpen();
            };

            if (this.cameraRig) {
              this.cameraRig.focusOnDoor(doorWorldPos, doorNormal, openDoor);
            } else {
              openDoor();
            }
          }
        }
      }
    }

    // --- 1.6. Interactive Keypad Terminals Logic ---
    if (this.clueHintCooldown > 0) {
      this.clueHintCooldown -= delta;
    }

    for (const kp of this.keypads) {
      if (kp.isUnlocked) continue;

      if (!kp.mesh) {
        const gx = kp.data.position[0];
        const gz = kp.data.position[1];
        kp.mesh = level.getMeshAt(gx, gz) ?? undefined;
      }

      const d1 = Math.hypot(p1Pos.x - kp.worldPos.x, p1Pos.z - kp.worldPos.z);
      const d2 = Math.hypot(p2Pos.x - kp.worldPos.x, p2Pos.z - kp.worldPos.z);
      const h1 = Math.abs(p1Pos.y - kp.worldPos.y);
      const h2 = Math.abs(p2Pos.y - kp.worldPos.y);

      const near1 = d1 < 1.4 && h1 < 1.6;
      const near2 = d2 < 1.4 && h2 < 1.6;
      const nearAny = near1 || near2;

      if (nearAny && !keypadUI.isKeypadOpen()) {
        showNpcSpeech(kp.promptBubble, 'Kód megadása', XBOX_ACTION_HINT);
      } else {
        hideNpcSpeech(kp.promptBubble);
      }
      if (this.cameraRig?.camera) {
        updateNpcSpeechPosition(kp.promptBubble, kp.worldPos, this.cameraRig.camera, 1.7);
      }

      if (nearAny) {
        const action1 = near1 && (inputManager.getP1Action() || inputManager.isP1Action());
        const action2 = near2 && (inputManager.getP2Action() || inputManager.isP2Action());

        if ((action1 || action2) && !keypadUI.isKeypadOpen()) {
          hideNpcSpeech(kp.promptBubble);
          const triggeringPlayer = action1 ? p1Obj : p2Obj;
          keypadUI.open({
            code: kp.data.code ?? '420',
            title: 'STORE SECURITY ACCESS // 4:20',
            onSuccess: () => {
              kp.isUnlocked = true;
              kp.data.isUnlocked = true;
              if (kp.mesh) {
                setKeypadTerminalVisual(kp.mesh, true);
              }
              if (this.onToast) {
                this.onToast('🔓 Hozzáférés megadva! Az ajtó kinyílt.');
              }
              // Character-specific lines per VOICE_SCRIPTS.md (pin_correct)
              const correctLine =
                triggeringPlayer?.id === 'p2' ? 'Négy-húsz... mi más lett volna.' : 'Nyílik! Mondtam, hogy ez lesz az.';
              triggeringPlayer?.say(correctLine, 2.6, 'pin_correct');

              if (kp.data.targetObstacle) {
                const [doorGx, doorGz] = kp.data.targetObstacle;
                const doorWorldPos = new THREE.Vector3(doorGx * GRID_CELL_SIZE, 0, doorGz * GRID_CELL_SIZE);
                const doorMesh = level.getMeshAt(doorGx, doorGz);
                const doorNormal = new THREE.Vector3(0, 0, 1);
                if (doorMesh) {
                  doorNormal.applyEuler(doorMesh.rotation).normalize();
                }

                const openDoor = () => {
                  level.openDoorAt(doorGx, doorGz);
                  audioManager.playDoorOpen();
                };

                if (this.cameraRig) {
                  this.cameraRig.focusOnDoor(doorWorldPos, doorNormal, openDoor);
                } else {
                  openDoor();
                }
              }
            },
            onFail: () => {
              // Increase Paranoia by +15%
              if (this.postProcessManager) {
                this.postProcessManager.addIntensity(0.15);
              }
              if (this.cameraRig) {
                this.cameraRig.addShake(0.35);
              }
              if (this.onToast) {
                this.onToast('⚠️ HIBÁS KÓD! Paranoia +15%!');
              }
              // Character-specific lines per VOICE_SCRIPTS.md (pin_wrong)
              const wrongLine =
                triggeringPlayer?.id === 'p2' ? 'Ez nem jó, próbáld újra!' : 'Rossz kód, mindjárt lebukunk!';
              triggeringPlayer?.say(wrongLine, 2.4, 'pin_wrong');
            },
          });
        }
      }
    }

    // --- 1.7. Readable Clue Notes (any placed STICKY_NOTE_CLUE tile) ---
    for (const note of this.clueNotes) {
      const dNote1 = Math.hypot(p1Pos.x - note.worldPos.x, p1Pos.z - note.worldPos.z);
      const dNote2 = Math.hypot(p2Pos.x - note.worldPos.x, p2Pos.z - note.worldPos.z);
      const noteNear = dNote1 < 1.6 || dNote2 < 1.6;

      if (noteNear && !keypadUI.isKeypadOpen() && !stickyNoteModal.isOpen()) {
        showNpcSpeech(note.promptBubble, 'Elolvasás', XBOX_ACTION_HINT);
      } else {
        hideNpcSpeech(note.promptBubble);
      }
      if (this.cameraRig?.camera) {
        updateNpcSpeechPosition(note.promptBubble, note.worldPos, this.cameraRig.camera, 1.2);
      }

      if (noteNear && this.clueHintCooldown <= 0 && !keypadUI.isKeypadOpen() && !stickyNoteModal.isOpen() && !stickyNoteModal.justClosed) {
        const action1 = dNote1 < 1.6 && (inputManager.getP1Action() || inputManager.isP1Action());
        const action2 = dNote2 < 1.6 && (inputManager.getP2Action() || inputManager.isP2Action());
        if (action1 || action2) {
          hideNpcSpeech(note.promptBubble);
          stickyNoteModal.open();
          this.clueHintCooldown = 1.0;
        }
      }
    }

    // --- 1.8. Cooperative Heavy Object Push Obstacles ---
    for (const ob of this.heavyObstacles) {
      if (ob.isFullyPushed) continue;

      if (!ob.mesh) {
        ob.mesh = level.getMeshAt(ob.gx, ob.gz, ob.gy) ?? undefined;
      }

      const currentPos = ob.mesh ? ob.mesh.position : ob.startPos;
      const p1Near = this.isNearHeavyGrip(p1Pos, currentPos, ob.dir);
      const p2Near = this.isNearHeavyGrip(p2Pos, currentPos, ob.dir);
      const p1Holding = p1Near && (inputManager.getP1Action() || inputManager.isP1Action());
      const p2Holding = p2Near && (inputManager.getP2Action() || inputManager.isP2Action());

      const bothPushing = p1Holding && p2Holding;
      if ((p1Near || p2Near) && !bothPushing) {
        showNpcSpeech(ob.promptBubble, 'Tolás - mindkét játékos egyszerre!', XBOX_ACTION_HINT);
      } else {
        hideNpcSpeech(ob.promptBubble);
      }
      if (this.cameraRig?.camera) {
        updateNpcSpeechPosition(ob.promptBubble, currentPos, this.cameraRig.camera, 1.7);
      }

      if (bothPushing) {
        ob.pushProgress = Math.min(1.0, ob.pushProgress + delta / 2.8);
        ob.data.pushProgress = ob.pushProgress;

        if (ob.mesh) {
          ob.mesh.position.lerpVectors(ob.startPos, ob.targetPos, ob.pushProgress);
          setHeavyObstacleGripVisual(ob.mesh, 'active');
        }

        // Lock walk input by snapping both players into a flanking pushing pose that
        // rides along with the obstacle as it slides forward.
        const slidePos = ob.mesh ? ob.mesh.position : currentPos;
        const gripBack = 0.85;
        p1Pos.x = slidePos.x - ob.dir.x * gripBack + ob.perp.x * 0.5;
        p1Pos.z = slidePos.z - ob.dir.z * gripBack + ob.perp.z * 0.5;
        p2Pos.x = slidePos.x - ob.dir.x * gripBack - ob.perp.x * 0.5;
        p2Pos.z = slidePos.z - ob.dir.z * gripBack - ob.perp.z * 0.5;
        if (p1Obj) p1Obj.velocity.set(0, 0, 0);
        if (p2Obj) p2Obj.velocity.set(0, 0, 0);

        ob.dragSfxTimer -= delta;
        if (ob.dragSfxTimer <= 0) {
          ob.dragSfxTimer = 0.38;
          audioManager.playHeavyDragScrape();
          this.cameraRig?.addShake(0.04);
        }

        // Wordless effort grunt/panting (push_effort) — no subtitle, just the clip.
        ob.effortVoiceTimer -= delta;
        if (ob.effortVoiceTimer <= 0) {
          ob.effortVoiceTimer = 1.4;
          const grunter = Math.random() < 0.5 ? 'viki' : 'kristof';
          voiceManager.playCharacterClip(grunter, 'push_effort').catch(() => {});
        }

        if (ob.pushProgress >= 1.0) {
          ob.isFullyPushed = true;
          ob.data.isFullyPushed = true;
          hideNpcSpeech(ob.promptBubble);
          if (ob.mesh) {
            ob.mesh.position.copy(ob.targetPos);
            setHeavyObstacleGripVisual(ob.mesh, 'idle');
          }
          level.clearHeavyObstacleAt(ob.gx, ob.gz, ob.gy);
          audioManager.playDoorOpen();
          if (this.onToast) {
            this.onToast('💪 Sikerült arrébb tolni az akadályt!');
          }
          // Character-specific lines per VOICE_SCRIPTS.md (push_success)
          p1Obj?.say('Meeegvan, átférünk!', 2.4, 'push_success');
          p2Obj?.say('Király, szabaddá vált az út!', 2.4, 'push_success');
          if (ob.data.targetObstacle) {
            level.openDoorAt(ob.data.targetObstacle[0], ob.data.targetObstacle[1]);
          }
        }
      } else if (p1Holding || p2Holding) {
        if (ob.mesh) setHeavyObstacleGripVisual(ob.mesh, 'solo');

        // Character-specific lines per VOICE_SCRIPTS.md (push_struggle)
        const soloPlayer = p1Holding ? p1Obj : p2Obj;
        const struggleLine =
          soloPlayer?.id === 'p2' ? 'Ezt egyedül nem bírom el, segíts már tolni!' : 'Öcsém, ez rohadt nehéz, gyere már segíteni!';
        soloPlayer?.say(struggleLine, 1.6, 'push_struggle');

        ob.soloGruntTimer -= delta;
        if (ob.soloGruntTimer <= 0) {
          ob.soloGruntTimer = 1.3;
          audioManager.playHeavyPushGrunt();
        }
      } else if (ob.mesh) {
        setHeavyObstacleGripVisual(ob.mesh, 'idle');
      }
    }

    // --- 1.9. Wall Chill Spot & Vibe Mode Interaction ---
    for (const spot of this.wallChillSpots) {
      const d1 = Math.hypot(p1Pos.x - spot.worldPos.x, p1Pos.z - spot.worldPos.z);
      const d2 = Math.hypot(p2Pos.x - spot.worldPos.x, p2Pos.z - spot.worldPos.z);
      const near1 = d1 < 2.2;
      const near2 = d2 < 2.2;
      const bothNear = near1 && near2;
      const eitherNear = near1 || near2;

      if (!vibePuzzle.isActive) {
        if (bothNear) {
          showNpcSpeech(spot.promptBubble, 'Üljetek le a fal tövébe pihenni', XBOX_ACTION_HINT);
        } else if (eitherNear) {
          showNpcSpeech(spot.promptBubble, 'Hívd ide a társadat, és üljetek le a falhoz pihenni!', '');
        } else {
          hideNpcSpeech(spot.promptBubble);
        }
      } else {
        hideNpcSpeech(spot.promptBubble);
      }

      if (this.cameraRig?.camera) {
        updateNpcSpeechPosition(spot.promptBubble, spot.worldPos, this.cameraRig.camera, 1.2);
      }

      if (bothNear && !vibePuzzle.isActive) {
        const p1Act = near1 && (inputManager.getP1Action() || inputManager.isP1Action());
        const p2Act = near2 && (inputManager.getP2Action() || inputManager.isP2Action());
        if (p1Act || p2Act) {
          hideNpcSpeech(spot.promptBubble);
          if (p1Obj && p2Obj && this.cameraRig && this.postProcessManager) {
            vibePuzzle.startChillMode(
              p1Obj,
              p2Obj,
              spot.worldPos,
              spot.facingAngle,
              this.cameraRig,
              this.postProcessManager,
              level
            );
            if (this.onToast) {
              this.onToast('🌿 Leültetek a fal tövébe... indul a tudat-összhang!');
            }
          }
        }
      }
    }

    // --- 2. Dynamic Pressure Plate Counting & Relic Acquisition Check ---
    const totalPlates = this.activePlates.length;
    const allPlatesPressed = totalPlates === 0 || this.activePlates.every((plate) => plate.isPressed);

    const totalRelics = this.relics.length;
    const relicsSatisfied = totalRelics === 0 || (p1HasRelic && p2HasRelic) || this.isCheatActive;
    const vibeSatisfied = this.wallChillSpots.length === 0 || vibePuzzle.isComplete || this.isCheatActive;

    const isExitReady = (allPlatesPressed && relicsSatisfied && vibeSatisfied) || this.isCheatActive;

    if (this.exitPortal) {
      const portal = this.exitPortal;

      // Gate unlocking transition when all plates and both relics are acquired
      if (portal.locked && isExitReady) {
        portal.locked = false;
        // Dissolve / hide barrier cylinder
        portal.barrierMesh.visible = false;
        portal.barrierRings.forEach((r) => (r.visible = false));
        portal.barrierLight.color.setHex(0x22c55e);
        portal.barrierLight.intensity = 1.0;

        // Switch portal visuals to glowing emissive cyan / green
        this.setPortalReadyVisuals(portal);
        audioManager.playPlateStep(true, true);
        audioManager.playDoorOpen();

        // Cinematic camera fly-to: pan to the newly opened exit portal
        if (this.cameraRig) {
          // Face the portal from the south (positive Z normal) for a clear view
          const portalNormal = new THREE.Vector3(0, 0, 1);
          this.cameraRig.focusOnDoor(portal.position.clone(), portalNormal);
        }
      }

      if (portal.locked) {
        // Barrier active animations: pulsing red light & slow spin
        portal.barrierMesh.rotation.y += 0.9 * delta;
        portal.barrierLight.intensity = 1.8 + Math.sin(this.time * 6.0) * 0.7;

        // Physical collision & warning when approaching locked barrier
        const distP1 = Math.hypot(p1Pos.x - portal.position.x, p1Pos.z - portal.position.z);
        const distP2 = Math.hypot(p2Pos.x - portal.position.x, p2Pos.z - portal.position.z);

        const barrierRadius = 1.35;
        let contacted = false;

        if (distP1 < barrierRadius) {
          contacted = true;
          // Soft physical pushback
          const angle = Math.atan2(p1Pos.z - portal.position.z, p1Pos.x - portal.position.x);
          p1Pos.x = portal.position.x + Math.cos(angle) * barrierRadius;
          p1Pos.z = portal.position.z + Math.sin(angle) * barrierRadius;
        }

        if (distP2 < barrierRadius) {
          contacted = true;
          const angle = Math.atan2(p2Pos.z - portal.position.z, p2Pos.x - portal.position.x);
          p2Pos.x = portal.position.x + Math.cos(angle) * barrierRadius;
          p2Pos.z = portal.position.z + Math.sin(angle) * barrierRadius;
        }

        if (contacted && this.onLockedPortalContact) {
          this.onLockedPortalContact();
        }
      } else {
        // Unlocked Exit Portal active animation
        portal.outerRing.rotation.z += 1.2 * delta;
        portal.innerDisc.rotation.z -= 2.0 * delta;

        const pulse = 1.0 + Math.sin(this.time * 4.5) * 0.45;
        if (portal.outerRing.material instanceof THREE.MeshStandardMaterial) {
          portal.outerRing.material.emissiveIntensity = pulse;
        }
        if (portal.innerDisc.material instanceof THREE.MeshStandardMaterial) {
          portal.innerDisc.material.emissiveIntensity = 1.6 - (pulse - 1.0);
        }

        const distP1 = Math.hypot(p1Pos.x - portal.position.x, p1Pos.z - portal.position.z);
        const distP2 = Math.hypot(p2Pos.x - portal.position.x, p2Pos.z - portal.position.z);
        const hP1 = Math.abs(p1Pos.y - (portal.position.y - 0.22));
        const hP2 = Math.abs(p2Pos.y - (portal.position.y - 0.22));

        const isAtPortal = this.isCheatActive
          ? (distP1 < 2.2 && hP1 < 2.2) || (distP2 < 2.2 && hP2 < 2.2)
          : (distP1 < 1.8 && hP1 < 1.6 && distP2 < 1.8 && hP2 < 1.6);

        if (isAtPortal) {
          if (this.isTransitioning || level.hasTriggeredExit) return;
          this.isTransitioning = true;
          level.hasTriggeredExit = true;
          portal.active = true;
          if (this.onLevelComplete) {
            this.onLevelComplete();
          }
        }
      }
    }

    // --- 3. Relics Logic ---
    for (const relic of this.relics) {
      if (relic.collected) continue;

      // Continuous slow Y-axis rotation
      relic.mesh.rotation.y += delta * 1.8;
      // Floating hover bobbing
      relic.mesh.position.y = relic.baseY + Math.sin(this.time * 3.0) * 0.12;

      // Floating rotating marker & beacon
      const marker = relic.mesh.children.find((c) => (c as any).userData?.isRelicMarker) as THREE.Mesh | undefined;
      if (marker) {
        marker.rotation.y += delta * 2.5;
        marker.rotation.x += delta * 1.5;
        marker.position.y = 1.6 + Math.sin(this.time * 4.0) * 0.1;
      }
      const beacon = relic.mesh.children.find((c) => (c as any).userData?.isRelicBeacon) as THREE.Mesh | undefined;
      if (beacon) {
        beacon.rotation.y += delta * 0.8;
        beacon.scale.y = 1.0 + Math.sin(this.time * 3.0) * 0.08;
      }

      // Attached PointLight pulsing
      if (relic.light) {
        if (relic.type === 'joint') {
          relic.light.intensity = 2.2 + Math.sin(this.time * 5.0) * 0.5;
        } else {
          relic.light.intensity = 2.0 + Math.sin(this.time * 3.0) * 0.4;
        }
      }

      // Rising animated smoke rings for joint
      if (relic.smokeMeshes) {
        for (let i = 0; i < relic.smokeMeshes.length; i++) {
          const sm = relic.smokeMeshes[i];
          sm.rotation.z += (i % 2 === 0 ? 1 : -1) * 0.6 * delta;
          sm.position.y += 0.08 * delta;
          if (sm.position.y > 1.4) {
            sm.position.y = 0.78;
          }
        }
      }

      const distP1 = Math.hypot(p1Pos.x - relic.position.x, p1Pos.z - relic.position.z);
      const distP2 = Math.hypot(p2Pos.x - relic.position.x, p2Pos.z - relic.position.z);
      const hP1 = Math.abs(p1Pos.y - (relic.baseY - 0.2));
      const hP2 = Math.abs(p2Pos.y - (relic.baseY - 0.2));

      const p1InRange = distP1 < 1.8 && hP1 < 1.8;
      const p2InRange = distP2 < 1.8 && hP2 < 1.8;

      if (p1InRange || p2InRange) {
        if (p1Obj && p2Obj) {
          if (distP1 <= distP2) {
            if (p1InRange) {
              const collected = this.onRelicCollide(p1Obj, relic, level);
              if (!collected && p2InRange) {
                this.onRelicCollide(p2Obj, relic, level);
              }
            } else if (p2InRange) {
              this.onRelicCollide(p2Obj, relic, level);
            }
          } else {
            if (p2InRange) {
              const collected = this.onRelicCollide(p2Obj, relic, level);
              if (!collected && p1InRange) {
                this.onRelicCollide(p1Obj, relic, level);
              }
            } else if (p1InRange) {
              this.onRelicCollide(p1Obj, relic, level);
            }
          }
        } else {
          // Fallback if full Player instances were not passed
          relic.collected = true;
          relic.mesh.visible = false;
          relic.mesh.position.set(0, -999, 0);
          if (relic.light) {
            relic.light.intensity = 0;
            relic.light.visible = false;
          }
          if (relic.mesh.parent) {
            relic.mesh.parent.remove(relic.mesh);
          }
          this.group.remove(relic.mesh);
          if (level) {
            level.removeRelicMeshNear(relic.position.x, relic.position.z);
          }
          this.collectedCount++;

          audioManager.playPickup();
          voiceManager.playShuffle('relic', ['p1_relic_1.mp3', 'p2_relic_1.mp3']);

          const collector: 'p1' | 'p2' = distP1 <= distP2 ? 'p1' : 'p2';
          if (this.onRelicCollected) {
            this.onRelicCollected(relic, this.collectedCount, collector);
          }
        }
      }
    }
  }

  private setPortalLockedVisuals(portal: ExitPortalItem, locked: boolean): void {
    if (portal.outerRing.material instanceof THREE.MeshStandardMaterial) {
      portal.outerRing.material.color.setHex(locked ? 0x991b1b : 0x06b6d4);
      portal.outerRing.material.emissive.setHex(locked ? 0xef4444 : 0x06b6d4);
      portal.outerRing.material.emissiveIntensity = locked ? 0.6 : 1.2;
    }
    if (portal.innerDisc.material instanceof THREE.MeshStandardMaterial) {
      portal.innerDisc.material.color.setHex(locked ? 0x7f1d1d : 0xd946ef);
      portal.innerDisc.material.emissive.setHex(locked ? 0xb91c1c : 0xd946ef);
      portal.innerDisc.material.emissiveIntensity = locked ? 0.7 : 1.4;
    }
  }

  public setPortalReadyVisuals(portal: ExitPortalItem): void {
    if (portal.outerRing.material instanceof THREE.MeshStandardMaterial) {
      portal.outerRing.material.color.setHex(0x06b6d4);
      portal.outerRing.material.emissive.setHex(0x06b6d4);
      portal.outerRing.material.emissiveIntensity = 1.3;
    }
    if (portal.innerDisc.material instanceof THREE.MeshStandardMaterial) {
      portal.innerDisc.material.color.setHex(0x22c55e);
      portal.innerDisc.material.emissive.setHex(0x22c55e);
      portal.innerDisc.material.emissiveIntensity = 1.5;
    }
  }

  private setPlateEmissive(mesh: THREE.Mesh, colorHex: number, intensity: number): void {
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissive.setHex(colorHex);
      mesh.material.emissiveIntensity = intensity;
    }
    const beacon = mesh.children.find((c) => (c as any).userData?.isBeacon) as THREE.Mesh | undefined;
    if (beacon && beacon.material instanceof THREE.MeshBasicMaterial) {
      beacon.material.color.setHex(colorHex);
      beacon.material.opacity = colorHex === 0x22c55e ? 0.65 : colorHex === 0x06b6d4 ? 0.5 : 0.35;
    }
  }

  public getCollectedCount(): number {
    return this.collectedCount;
  }

  public getTotalRelics(): number {
    return this.relics.length;
  }

  public getPlatePairs(): PlatePair[] {
    return this.platePairs;
  }

  public getTotalPlates(): number {
    return this.activePlates.length;
  }

  public getPressedPlatesCount(): number {
    return this.activePlates.filter((p) => p.isPressed).length;
  }

  public areAllPlatesPressed(): boolean {
    return this.activePlates.length === 0 || this.activePlates.every((p) => p.isPressed);
  }

  public areAllPlatesUnlocked(): boolean {
    return this.platePairs.length === 0 || this.platePairs.every((p) => p.isUnlocked);
  }

  public isExitLocked(): boolean {
    return Boolean(this.exitPortal?.locked);
  }

  public unlockAllForCheat(level: Level, p1?: any, p2?: any): void {
    this.isCheatActive = true;

    // 1. Unlock all plate pairs and clear all obstacles
    for (const pair of this.platePairs) {
      pair.isUnlocked = true;
      pair.p1Active = true;
      pair.p2Active = true;
      this.setPlateEmissive(pair.plate1Mesh, 0x22c55e, 1.4);
      this.setPlateEmissive(pair.plate2Mesh, 0x22c55e, 1.4);

      if (pair.targetObstaclePos) {
        const gx = Math.round(pair.targetObstaclePos.x / GRID_CELL_SIZE);
        const gz = Math.round(pair.targetObstaclePos.z / GRID_CELL_SIZE);
        const theme = level.getCurrentData()?.theme;

        let zOffsets = [0];
        if (theme === TileTheme.METRO) {
          zOffsets = [-1, 0, 1];
        } else if (theme === TileTheme.DOWNTOWN && gx === 24) {
          zOffsets = [-2, -1, 0, 1, 2];
        }

        const doorWorldPos = new THREE.Vector3(gx * GRID_CELL_SIZE, 0, gz * GRID_CELL_SIZE);
        const doorMesh = level.getMeshAt(gx, gz);
        const doorNormal = new THREE.Vector3(0, 0, 1);
        if (doorMesh) {
          doorNormal.applyEuler(doorMesh.rotation).normalize();
        }

        const openDoors = () => {
          for (const dz of zOffsets) {
            const curZ = gz + dz;
            level.openDoorAt(gx, curZ);
          }
          audioManager.playDoorOpen();
        };

        if (this.cameraRig) {
          this.cameraRig.focusOnDoor(doorWorldPos, doorNormal, openDoors);
        } else {
          openDoors();
        }
      }
      if (this.onPlateUnlocked) {
        this.onPlateUnlocked(pair);
      }
    }

    // 1.5. Activate all switches
    for (const sw of this.switches) {
      sw.isPressed = true;
      sw.data.isPressed = true;
      if (sw.mesh) {
        setSwitchButtonVisual(sw.mesh, true);
      }
      if (sw.data.targetObstacle) {
        level.openDoorAt(sw.data.targetObstacle[0], sw.data.targetObstacle[1]);
      }
    }

    // 2. Mark all active individual plates as pressed
    for (const plate of this.activePlates) {
      plate.isPressed = true;
    }
    if (this.onPlateChange) {
      this.onPlateChange(this.activePlates.length, this.activePlates.length);
    }

    // 3. Mark all relics as collected
    for (const relic of this.relics) {
      if (!relic.collected) {
        relic.collected = true;
        relic.mesh.visible = false;
        relic.mesh.position.set(0, -999, 0);
        if (relic.light) {
          relic.light.intensity = 0;
          relic.light.visible = false;
        }
        if (relic.mesh.parent) {
          relic.mesh.parent.remove(relic.mesh);
        }
        this.group.remove(relic.mesh);
        if (level) {
          level.removeRelicMeshNear(relic.position.x, relic.position.z);
        }
      }
    }
    this.collectedCount = Math.max(this.collectedCount, this.relics.length, 2);
    if (p1) p1.hasRelic = true;
    if (p2) p2.hasRelic = true;

    // 4. Complete Vibe Puzzle
    vibePuzzle.tripLevel = 1.0;
    vibePuzzle.isComplete = true;

    // 5. Fully unlock the exit portal
    if (this.exitPortal) {
      const portal = this.exitPortal;
      portal.locked = false;
      portal.barrierMesh.visible = false;
      portal.barrierRings.forEach((r) => (r.visible = false));
      portal.barrierLight.color.setHex(0x22c55e);
      portal.barrierLight.intensity = 1.0;
      this.setPortalReadyVisuals(portal);
      // Cinematic camera fly-to portal
      if (this.cameraRig) {
        this.cameraRig.focusOnDoor(portal.position.clone(), new THREE.Vector3(0, 0, 1));
      }
    }

    audioManager.playPlateStep(true, true);
    audioManager.playDoorOpen();
    audioManager.playPickup();
  }
}

import * as THREE from 'three';
import type { StairDirection, RelicType, SwitchButtonData, LayerType } from '../world/TileTypes.ts';
import { TileTheme, TileType, getLayerForTileType, isFloorDecorType } from '../world/TileTypes.ts';
import { EnemyType } from '../entities/EnemyTypes.ts';
import type { LevelData, PlatePairData } from '../world/Level.ts';
import type { Enemy } from '../entities/Enemy.ts';
import { Level, stairDirToRotation } from '../world/Level.ts';
import { GRID_CELL_SIZE, createTileMesh } from '../world/BlockFactory.ts';
import { gameState, GameMode } from '../engine/GameState.ts';
import type { EnvironmentBackdrop } from '../world/EnvironmentBackdrop.ts';
import { campaignManager } from '../world/CampaignManager.ts';
import { InputManager } from '../engine/InputManager.ts';
import { AudioManager } from '../audio/AudioManager.ts';

import { EditorUndoRedo } from './EditorUndoRedo.ts';
import { SimsAssetCatalog } from './SimsAssetCatalog.ts';

export const STORAGE_KEY_CUSTOM_LEVEL = 'custom_edited_level';
export const EDITOR_LAYERS = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface TileOption {
  type: TileType;
  name: string;
  defaultSolid: boolean;
  theme: string;
}

const TILE_OPTIONS: TileOption[] = [
  // 🛋️ Bútorok (Lakás & Konyha)
  { type: TileType.FURNITURE_SOFA, name: 'Nappali Kanapé (Sofa)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.SOFA_CORNER, name: 'Sarok Kanapé Modul (Corner Sofa)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.SOFA_STRAIGHT, name: 'Egyenes Kanapé Modul (Straight Sofa)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.SOFA_CHAISE, name: 'Chaise Longue Kanapé (Chaise Lounge)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.FURNITURE_BED, name: 'Franciaágy (Bed)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.FURNITURE_DINING_TABLE, name: 'Étkezőasztal & Székek (Dining Table)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.WARDROBE, name: 'Kétszárnyú Ruhásszekrény (Wardrobe)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.DRESSER, name: '3-Fiókos Komód (Dresser)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.NIGHTSTAND, name: 'Éjjeliszekrény Olvasólámpával (Nightstand)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.FURNITURE_TV_STAND, name: 'TV Állvány & OLED Képernyő (TV Stand)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.KITCHEN_COUNTER_SINK, name: 'Konyhapult Mosogatóval (Kitchen Sink)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.KITCHEN_COUNTER_STOVE, name: 'Konyhai Tűzhely & Sütő (Stove & Oven)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.KITCHEN_COUNTER_STRAIGHT, name: 'Konyhai Előkészítő Pult (Prep Counter)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.KITCHEN_UPPER_CABINET, name: 'Fali Felső Konyhaszekrény (Upper Cabinet)', defaultSolid: false, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.POTTED_MONSTERA, name: 'Cserepes Szoba-Monstera (Monstera Plant)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.POTTED_FICUS, name: 'Cserepes Fikusz (Ficus Plant)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.FURNITURE_KITCHEN_COUNTER, name: 'Konyhapult (Klasszikus)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },
  { type: TileType.FURNITURE_KITCHEN_STOVE, name: 'Konyhai Tűzhely & Elszívó (Klasszikus)', defaultSolid: true, theme: '🛋️ Bútorok (Lakás & Konyha)' },

  // 🖼️ Fali & Padló Díszek (Képek, Szőnyegek)
  { type: TileType.RUG_PERSIAN, name: 'Perzsa Szőnyeg (Persian Rug)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.RUG_BATH_MAT, name: 'Fürdőszoba Kilépő Szőnyeg (Bath Mat)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.RUG_MODERN, name: 'Modern Mintás Szőnyeg (Modern Rug)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.BEACH_TOWEL_BLUE, name: 'Kék Fürdőlepedő (Blue Towel)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.BEACH_TOWEL_STRIPED, name: 'Csíkos Strandtörölköző (Striped Towel)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.WALL_ART_PSYCHEDELIC, name: 'Pszichedelikus Fali Kép (Psychedelic Art)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.WALL_ART_BASQUE_MAP, name: 'Baszkföld Térkép Keretben (Basque Map)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.WALL_ART_POSTER, name: 'Retro Zenei Poszter (Festival Poster)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },
  { type: TileType.STORE_SIGN_NEON, name: 'Világító Neon Cégér (Neon Sign)', defaultSolid: false, theme: '🖼️ Fali & Padló Díszek (Képek, Szőnyegek)' },

  // 🛒 Bolt & Kereskedelem
  { type: TileType.GROCERY_MEAT_DISPLAY, name: 'Hűtött Húspult & Sajtok (Meat Display)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.GROCERY_VEG_STAND, name: 'Rusztikus Zöldséges Stand (Veg Stand)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.GROCERY_DRINK_FRIDGE, name: 'Világító Italhűtő Szekrény (Drink Fridge)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.STORE_CHECKOUT_DESK, name: 'Kasszapult & POS Terminál (Checkout)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.GROCERY_SHELF, name: 'Közért Polc Élelmiszerekkel (Grocery Shelf)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.GROCERY_COUNTER, name: 'Közért Kasszapult & Hűtő (Counter)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },
  { type: TileType.DOOR_STORE, name: '🚪 Közért Alumínium Üvegajtó (Store Door)', defaultSolid: true, theme: '🛒 Bolt & Kereskedelem' },

  // 🏖️ Tengerpart & Természet
  { type: TileType.BEACH_UMBRELLA, name: 'Strand Napernyő (Beach Parasol)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.BEACH_TOWEL, name: 'Strandtörölköző Kellékekkel (Towel & Props)', defaultSolid: false, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.BEACH_COOLER, name: 'Hűtőtáska / Kemping Hűtőláda (Cooler Box)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.COASTAL_CLIFF_BUSH, name: 'Tengerparti Sziklacserje & Fű (Cliff Bush)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_SAND, name: 'Finom Tengerparti Homok (Sand)', defaultSolid: false, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.WATER_BLOCK, name: 'Animált Hullámzó Víz (Water)', defaultSolid: false, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_STONE_WALL, name: 'Tengerparti Kőfal (Stone Wall)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_STONE_PARAPET, name: 'Kő Sétány Mellvéd (Parapet)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_PAVEMENT, name: 'Sétány Kőburkolat (Flagstones)', defaultSolid: false, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_CLIFF_GRASS, name: 'Sziklafennsík Gyep (Cliff Grass)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SOPELANA_CLIFF_STAIRS, name: 'Sziklalépcső (Cliff Stairs)', defaultSolid: false, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.DOOR_SOPELANA_IRON, name: '🚪 Sopelana Kovácsoltvas Kapu (Iron Gate)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SUBURBAN_VILLA, name: 'Baszk Villa Épület (Basque Villa)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.SUBURBAN_HOUSE, name: 'Baszk Külvárosi Ház (Basque House)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.HEDGE_ROW, name: 'Kerti Élősövény (Hedge Row)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },
  { type: TileType.DOOR_SUBURBAN_GATE, name: '🚪 Külvárosi Kerti Kiskapu (Garden Gate)', defaultSolid: true, theme: '🏖️ Tengerpart & Természet' },

  // 🏙️ Belváros (Downtown)
  { type: TileType.DOWNTOWN_BRICK_WALL, name: 'Téglafal (Brick Wall)', defaultSolid: true, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_FACADE, name: 'Lakóház Homlokzat (Residential Facade)', defaultSolid: true, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_SIDEWALK, name: 'Járda (Sidewalk)', defaultSolid: false, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_BIKELANE, name: 'Piros Biciklisáv (Bike Lane)', defaultSolid: false, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_ROAD_ZEBRA, name: 'Gyalogátkelő / Zebra (Road Zebra)', defaultSolid: false, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_ROAD_MULTILANE, name: 'Többsávos Úttest (Multi-Lane)', defaultSolid: false, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.DOWNTOWN_TREE, name: 'Utcai Lombos Fa (Street Tree)', defaultSolid: true, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.LIGHT_STREET_LAMP, name: 'Utcai Lámpaoszlop (Street Lamp)', defaultSolid: true, theme: '🏙️ Belváros (Downtown)' },
  { type: TileType.BUILDING_BLOCK_LARGE, name: 'Nagy 3-Szintes Épület (3x3 Building)', defaultSolid: true, theme: '🏙️ Belváros (Downtown)' },

  // 🚇 Metró (Metro)
  { type: TileType.METRO_VAULT_WALL, name: 'Metró Íves Betonfal (Vault Wall)', defaultSolid: true, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_TRAIN_CAR, name: 'Metró Vagon (Train Car)', defaultSolid: true, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_PLATFORM, name: 'Metró Peron (Platform)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_RAIL, name: 'Vasúti Sínpár (Metro Rail)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_SEAT_DOUBLE, name: 'Metró Dupla Ülés (Double Seat)', defaultSolid: true, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_POLE, name: 'Kapaszkodó Rúd (Grab Pole)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_INTERIOR_CEILING, name: 'Mennyezeti Világítás (Ceiling Light)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.METRO_GLASS_PARTITION, name: 'Metró Üveg Válaszfal (Glass Partition)', defaultSolid: true, theme: '🚇 Metró (Metro)' },
  { type: TileType.FLOOR_METRO, name: 'Metró Csúszásgátló Padló (Metro Floor)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.LIGHT_METRO_NEON, name: 'Metró Neon Fénycső (Metro Neon)', defaultSolid: false, theme: '🚇 Metró (Metro)' },
  { type: TileType.DOOR_METRO, name: '🚪 Metró Vagon Tolóajtó (Metro Door)', defaultSolid: true, theme: '🚇 Metró (Metro)' },

  // 🏠 Lakás Építészet (Apartment)
  { type: TileType.APARTMENT_WALL, name: 'Lakás Vakolt Fal (Plaster Wall)', defaultSolid: true, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.APARTMENT_CORNER_WALL, name: 'Lakás Sarokfal (Corner Wall)', defaultSolid: true, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.WALL_PILLAR, name: 'Lakás Támasztópillér (Pillar)', defaultSolid: true, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.APARTMENT_FLOOR, name: 'Tölgyfa Parketta (Parquet Floor)', defaultSolid: false, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.APARTMENT_BALCONY_RAILING, name: 'Erkély Üvegkorlát (Balcony Railing)', defaultSolid: true, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.LIGHT_CEILING_FIXTURE, name: 'Mennyezeti Csillár (Ceiling Lamp)', defaultSolid: false, theme: '🏠 Lakás Építészet (Apartment)' },
  { type: TileType.DOOR_APARTMENT, name: '🚪 Lakás Kazettás Faajtó (Apartment Door)', defaultSolid: true, theme: '🏠 Lakás Építészet (Apartment)' },

  // 🍄 Relikviák & Interaktív
  { type: TileType.RELIC_MUSHROOM, name: '🍄 Gomba Relikvia (Mushroom)', defaultSolid: false, theme: '🍄 Relikviák & Interaktív' },
  { type: TileType.RELIC_JOINT, name: '🚬 Joint Relikvia (Rolled Joint)', defaultSolid: false, theme: '🍄 Relikviák & Interaktív' },
  { type: TileType.SWITCH_BUTTON, name: '🔘 Kapcsoló Gomb (Switch Button)', defaultSolid: false, theme: '🍄 Relikviák & Interaktív' },
  { type: TileType.KEYPAD_TERMINAL, name: '🔢 Számkódos Terminál (Keypad)', defaultSolid: false, theme: '🍄 Relikviák & Interaktív' },
  { type: TileType.STICKY_NOTE_CLUE, name: '📝 Sárga Jegyzet Clue (Sticky Note)', defaultSolid: false, theme: '🍄 Relikviák & Interaktív' },
  { type: TileType.HEAVY_OBSTACLE, name: '📦 Nehéz Akadály (Heavy Obstacle - Kooperatív Tolás)', defaultSolid: true, theme: '🍄 Relikviák & Interaktív' },
];

export type EditorTool = 'block' | 'wall' | 'box' | 'pipette' | 'move' | 'wire' | 'enemy' | 'waypoint' | 'demolish';

export interface MovableEntity {
  type: 'plate' | 'door' | 'portal' | 'relic' | 'enemy' | 'switch' | 'tile';
  id: string;
  name: string;
  gx: number;
  gz: number;
  mesh: THREE.Object3D;
  data?: any;
}

export class LevelEditor {
  private active = false;
  private currentTool: EditorTool = 'wall';
  private selectedTileType: TileType = TileType.APARTMENT_WALL;
  private isSolidBrush = true;
  private currentElevationY = 0;
  private selectedStairDir: StairDirection = 'north';
  private selectedRotationDeg = 0;
  private selectedEnemyType: EnemyType = EnemyType.GRANNY;
  private enemyFacingAngle = 0;

  // Undo / Redo system
  private undoRedo = new EditorUndoRedo(60);
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private historyStatusSpan!: HTMLSpanElement;

  // Sims-like Visual Asset Catalog
  private assetCatalog!: SimsAssetCatalog;

  // Elevation & Cutaway Focus
  private elevationDisplaySpan!: HTMLSpanElement;
  private floorCutawayActive = false;
  private floorCutawayBtn!: HTMLButtonElement;
  private clearLayerBtn!: HTMLButtonElement;

  // Move Tool Upgrades (Ghost preview & cloning)
  private ghostPreviewMesh: THREE.Object3D | null = null;
  private isAltCloning = false;
  private isDraggingEntity = false;
  private dragEntityStartGrid: { gx: number; gz: number } | null = null;
  private dragPointerStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private draggedCatalogTile: { tileType: TileType; defaultSolid: boolean } | null = null;

  // Sims-like Dedicated Wall Tool (Straight line & Room perimeter drag)
  private wallToolBtn!: HTMLButtonElement;
  private isDrawingWall = false;
  private wallDrawStart: { gx: number; gz: number } | null = null;
  private wallDrawButton = 0;
  private wallPreviewGroup = new THREE.Group();

  // Additional Fast-Building Tools
  private pipetteToolBtn!: HTMLButtonElement;
  private boxToolBtn!: HTMLButtonElement;
  private isBoxFilling = false;
  private boxFillStart: { gx: number; gz: number } | null = null;
  private boxFillPreviewMesh: THREE.LineSegments | null = null;

  // Movable entity tool state
  private selectedEntity: MovableEntity | null = null;
  private wireSourceEntity: MovableEntity | null = null;
  private selectionBox: THREE.BoxHelper | null = null;
  private entityPreviewGroup = new THREE.Group();

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private level: Level;
  private canvas: HTMLCanvasElement;
  public environmentBackdrop?: EnvironmentBackdrop;
  public dirLight?: THREE.DirectionalLight;
  public ambientLight?: THREE.AmbientLight;

  private cursorMesh: THREE.Mesh;
  private cursorWire: THREE.LineSegments;
  private cursorBrushGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-999, -999);
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private isPainting = false;
  private paintButton = 0; // 0 = left, 2 = right
  private lastPaintedCell: string | null = null;
  private currentGridPos: { gx: number; gz: number } | null = null;

  // Free Camera Navigation (Editor Mode)
  private editorLookAt = new THREE.Vector3(13, 0, 13);
  private editorDistance = 22;
  private editorYaw = 0;
  private editorPitch = Math.PI / 4;
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private isOrbiting = false;
  private orbitStart = { x: 0, y: 0 };
  private didOrbitDrag = false;
  private keysDown = new Set<string>();

  // Waypoint management
  private cameraWaypoints: Array<[number, number, number]> = [];
  private waypointGroup = new THREE.Group();
  private waypointCountSpan!: HTMLSpanElement;

  // DOM elements
  private hudContainer: HTMLDivElement;
  private blockToolBtn!: HTMLButtonElement;
  private sledgehammerBtn!: HTMLButtonElement;
  private waypointToolBtn!: HTMLButtonElement;
  private enemyToolBtn!: HTMLButtonElement;
  private moveToolBtn!: HTMLButtonElement;
  private wireToolBtn!: HTMLButtonElement;
  private entityInfoCard!: HTMLDivElement;
  private guideEl!: HTMLDivElement;
  private enemySelectContainer!: HTMLDivElement;
  private enemyFacingBtn!: HTMLButtonElement;
  private themeSelect!: HTMLSelectElement;
  private solidCheckbox!: HTMLInputElement;
  private tileSelect!: HTMLSelectElement;
  private palettePreviewContainer!: HTMLDivElement;
  private palettePreviewCanvas!: HTMLCanvasElement;
  private palettePreviewBadge!: HTMLSpanElement;
  private palettePreviewDesc!: HTMLSpanElement;
  private stairControlsContainer!: HTMLDivElement;
  private stairDirButton!: HTMLButtonElement;
  private rotationBtn!: HTMLButtonElement;
  private layerButtons: HTMLButtonElement[] = [];
  private sunSlider!: HTMLInputElement;
  private sunValueSpan!: HTMLSpanElement;
  private fixtureSlider!: HTMLInputElement;
  private fixtureValueSpan!: HTMLSpanElement;
  private saveStorageBtn!: HTMLButtonElement;

  // Campaign & Levels DOM elements
  private campaignLevelsListEl!: HTMLDivElement;
  private campaignTitleSpan!: HTMLSpanElement;

  public onLevelLoaded?: (data: LevelData) => void;
  public onPlaytest?: (data: LevelData) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    level: Level,
    canvas: HTMLCanvasElement,
    environmentBackdrop?: EnvironmentBackdrop,
    dirLight?: THREE.DirectionalLight,
    ambientLight?: THREE.AmbientLight
  ) {
    this.scene = scene;
    this.camera = camera;
    this.level = level;
    this.canvas = canvas;
    this.environmentBackdrop = environmentBackdrop;
    this.dirLight = dirLight;
    this.ambientLight = ambientLight;

    // Load active level from CampaignManager or localStorage
    const activeLevelData = campaignManager.getActiveLevel();
    if (activeLevelData && Array.isArray(activeLevelData.tiles)) {
      this.level.loadLevel(activeLevelData, this.scene);
      if (activeLevelData.cameraWaypoints) {
        this.cameraWaypoints = [...activeLevelData.cameraWaypoints];
      }
    } else {
      const initialWaypoints = this.level.getCameraWaypoints();
      if (initialWaypoints) {
        this.cameraWaypoints = [...initialWaypoints];
      }
    }

    // 1. Create Cursor Mesh
    const cursorGeo = new THREE.BoxGeometry(GRID_CELL_SIZE, 0.1, GRID_CELL_SIZE);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);

    const wireGeo = new THREE.EdgesGeometry(cursorGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    this.cursorWire = new THREE.LineSegments(wireGeo, wireMat);
    this.cursorMesh.add(this.cursorWire);

    // Orientation arrow indicator (pointing along local -Z)
    const arrowGeo = new THREE.ConeGeometry(0.25, 0.5, 3);
    arrowGeo.rotateX(-Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.set(0, 0.08, -0.6);
    this.cursorMesh.add(arrowMesh);

    this.cursorMesh.add(this.cursorBrushGroup);

    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);

    // 2. Waypoint preview group in scene
    this.scene.add(this.waypointGroup);
    this.waypointGroup.visible = false;

    // 2b. Interactive entity preview group in scene
    this.scene.add(this.entityPreviewGroup);
    this.entityPreviewGroup.visible = false;

    // 2c. Wall drawing preview group in scene
    this.scene.add(this.wallPreviewGroup);

    // 3. Setup HUD Overlay
    this.hudContainer = this.createHUD();

    // 3b. Setup Sims-style Asset Catalog
    this.assetCatalog = new SimsAssetCatalog({
      onSelectTile: (tileType, defaultSolid) => {
        this.selectedTileType = tileType;
        this.isSolidBrush = defaultSolid;
        if (this.solidCheckbox) this.solidCheckbox.checked = defaultSolid;
        if (this.tileSelect) this.tileSelect.value = tileType.toString();
        this.updatePalettePreview();
        this.updateCursorBrushPreview();
        if (this.currentTool !== 'block' && this.currentTool !== 'box') {
          this.currentTool = 'block';
          this.updateToolButtons();
        }
      },
      onDragStartTile: (tileType, defaultSolid) => {
        this.selectedTileType = tileType;
        this.isSolidBrush = defaultSolid;
        this.draggedCatalogTile = { tileType, defaultSolid };
        this.updatePalettePreview();
        this.updateCursorBrushPreview();
      },
      onDragEndTile: () => {
        this.draggedCatalogTile = null;
        if (this.ghostPreviewMesh) {
          this.scene.remove(this.ghostPreviewMesh);
          this.ghostPreviewMesh = null;
        }
      },
    });
    document.body.appendChild(this.assetCatalog.getElement());
    this.assetCatalog.setSelectedTile(this.selectedTileType);
    this.assetCatalog.setVisible(gameState.getMode() === GameMode.EDITOR);

    this.updatePalettePreview();
    this.updateCursorBrushPreview();

    // 4. Update initial waypoint & entity visuals
    this.updateWaypointVisuals();
    this.refreshEntityPreviews();

    // 5. Initial campaign levels list rendering & change hook
    this.renderCampaignLevels();
    campaignManager.onChange(() => this.renderCampaignLevels());

    // 6. Register Event Listeners
    this.initEventListeners();

    // 7. Sync with GameStateManager
    gameState.onModeChange((mode) => {
      this.setVisible(mode === GameMode.EDITOR);
    });
    this.setVisible(gameState.getMode() === GameMode.EDITOR);
  }

  private createHUD(): HTMLDivElement {
    // Root full-screen transparent overlay: pointer-events none allows 3D scene clicks everywhere
    const hud = document.createElement('div');
    hud.id = 'level-editor-hud';
    hud.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
      display: none;
      overflow: hidden;
      box-sizing: border-box;
    `;

    // 1. Top Center Floating Sims 4 Utility Toolbar
    const topToolbar = document.createElement('div');
    topToolbar.id = 'sims-top-toolbar';
    topToolbar.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: auto;
      background: rgba(244, 246, 250, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 9999px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 3px 10px;
      height: 40px;
      box-sizing: border-box;
      z-index: 1010;
    `;

    const makeSimsBtn = (icon: string, title: string, hotkey?: string) => {
      const btn = document.createElement('button');
      btn.innerHTML = `<span style="font-size: 15px;">${icon}</span>`;
      btn.title = hotkey ? `${title} (${hotkey})` : title;
      btn.style.cssText = `
        width: 32px;
        height: 32px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 9999px;
        color: #334155;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.12s ease;
        padding: 0;
        box-sizing: border-box;
      `;
      btn.onmouseenter = () => {
        if (btn.style.background === 'transparent' || btn.style.background === '') {
          btn.style.background = 'rgba(0, 0, 0, 0.06)';
        }
      };
      btn.onmouseleave = () => {
        if (btn.style.color !== '#ffffff' && btn.style.color !== 'rgb(255, 255, 255)') {
          btn.style.background = 'transparent';
        }
      };
      return btn;
    };

    const makeDivider = () => {
      const div = document.createElement('div');
      div.style.cssText = 'width: 1px; height: 18px; background: #cbd5e1; margin: 0 3px; flex-shrink: 0;';
      return div;
    };

    // Tools in Top Toolbar
    this.moveToolBtn = makeSimsBtn('✋', 'Kéz / Mozgatás & Forgatás', 'M');
    this.wallToolBtn = makeSimsBtn('🧱', 'Falak & Szobák rajzolása', 'W');
    this.blockToolBtn = makeSimsBtn('🖌️', 'Ecset / Elem lerakása', '2');
    this.boxToolBtn = makeSimsBtn('⏹️', 'Keret kitöltése húzással', 'B');
    this.pipetteToolBtn = makeSimsBtn('🧪', 'Pipetta minta', 'P');
    this.sledgehammerBtn = makeSimsBtn('🔨', 'Bontókalapács / Törlés', 'Del');

    this.moveToolBtn.addEventListener('click', () => {
      this.currentTool = 'move';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    this.wallToolBtn.addEventListener('click', () => {
      this.currentTool = 'wall';
      this.wireSourceEntity = null;
      this.updateToolButtons();
      this.assetCatalog?.setCategory('walls');
    });
    this.blockToolBtn.addEventListener('click', () => {
      this.currentTool = 'block';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    this.boxToolBtn.addEventListener('click', () => {
      this.currentTool = 'box';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    this.pipetteToolBtn.addEventListener('click', () => {
      this.currentTool = 'pipette';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    this.sledgehammerBtn.addEventListener('click', () => {
      this.currentTool = this.currentTool === 'demolish' ? 'block' : 'demolish';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });

    topToolbar.appendChild(this.moveToolBtn);
    topToolbar.appendChild(this.wallToolBtn);
    topToolbar.appendChild(this.blockToolBtn);
    topToolbar.appendChild(this.boxToolBtn);
    topToolbar.appendChild(this.pipetteToolBtn);
    topToolbar.appendChild(this.sledgehammerBtn);

    topToolbar.appendChild(makeDivider());

    // Undo / Redo
    this.undoBtn = makeSimsBtn('↺', 'Visszavonás', 'Ctrl+Z');
    this.redoBtn = makeSimsBtn('↻', 'Újra', 'Ctrl+Y');
    this.undoBtn.addEventListener('click', () => this.undoRedo.undo());
    this.redoBtn.addEventListener('click', () => this.undoRedo.redo());

    this.undoRedo.subscribe((canUndo, canRedo, toast) => {
      this.undoBtn.disabled = !canUndo;
      this.undoBtn.style.opacity = canUndo ? '1' : '0.35';
      this.redoBtn.disabled = !canRedo;
      this.redoBtn.style.opacity = canRedo ? '1' : '0.35';
      if (toast) this.notifyHistoryToast(toast);
    });

    topToolbar.appendChild(this.undoBtn);
    topToolbar.appendChild(this.redoBtn);

    topToolbar.appendChild(makeDivider());

    // Floor Elevation Level Controls
    const floorDownBtn = makeSimsBtn('▼', 'Egy szinttel lejjebb', 'PgDn / Q');
    floorDownBtn.addEventListener('click', () => this.setElevationLayer(this.currentElevationY - 1));
    topToolbar.appendChild(floorDownBtn);

    this.elevationDisplaySpan = document.createElement('div');
    this.elevationDisplaySpan.style.cssText = `
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      background: #ffffff;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid #cbd5e1;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      transition: all 0.15s;
    `;
    this.elevationDisplaySpan.title = 'Kattints az emeletválasztó megnyitásához';
    topToolbar.appendChild(this.elevationDisplaySpan);

    const floorUpBtn = makeSimsBtn('▲', 'Egy szinttel feljebb', 'PgUp / E');
    floorUpBtn.addEventListener('click', () => this.setElevationLayer(this.currentElevationY + 1));
    topToolbar.appendChild(floorUpBtn);

    // Wall Cutaway View Toggle (👁️)
    this.floorCutawayBtn = makeSimsBtn('👁️', 'The Sims Metszetnézet: Felső szintek elrejtése');
    this.floorCutawayBtn.addEventListener('click', () => this.toggleFloorCutaway());
    topToolbar.appendChild(this.floorCutawayBtn);

    topToolbar.appendChild(makeDivider());

    // Rotation Button
    this.rotationBtn = document.createElement('button');
    this.rotationBtn.style.cssText = `
      font-size: 10.5px;
      font-weight: 700;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 9999px;
      padding: 3px 8px;
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 3px;
    `;
    this.updateRotationButtonText();
    this.rotationBtn.addEventListener('click', () => this.cycleRotation());
    topToolbar.appendChild(this.rotationBtn);

    // Lighting & Environment Theme Popover Toggle Button
    const lightingBtn = makeSimsBtn('☀️', 'Világítás és Környezet Téma');
    topToolbar.appendChild(lightingBtn);

    hud.appendChild(topToolbar);

    // 2. Top Right Action Buttons Group (Playtest, Save, Campaign Drawer, Exit)
    const topRightBar = document.createElement('div');
    topRightBar.style.cssText = `
      position: absolute;
      top: 10px;
      right: 14px;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 1010;
    `;

    const playtestBtn = document.createElement('button');
    playtestBtn.id = 'editor-playtest-btn';
    playtestBtn.innerHTML = '▶️ <b>TESZT</b>';
    playtestBtn.title = 'Pálya azonnali tesztelése (F5 / Playtest)';
    playtestBtn.style.cssText = `
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      border-radius: 9999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.3px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      transition: filter 0.15s, transform 0.1s;
    `;
    playtestBtn.onmouseenter = () => (playtestBtn.style.filter = 'brightness(1.1)');
    playtestBtn.onmouseleave = () => (playtestBtn.style.filter = 'none');
    playtestBtn.addEventListener('click', () => {
      this.level.setCameraWaypoints(this.cameraWaypoints);
      this.saveToLocalStorage(false);
      const data = this.level.toJSON();
      data.cameraWaypoints = [...this.cameraWaypoints];
      campaignManager.updateLevel(campaignManager.getActiveIndex(), data);

      (document.activeElement as HTMLElement)?.blur();
      window.focus();
      this.canvas.focus();
      InputManager.getInstance().reset();

      if (this.onPlaytest) this.onPlaytest(data);
      gameState.setMode(GameMode.PLAYING);
    });
    topRightBar.appendChild(playtestBtn);

    this.saveStorageBtn = document.createElement('button');
    this.saveStorageBtn.id = 'editor-save-storage-btn';
    this.saveStorageBtn.innerHTML = '💾 <b>Mentés</b>';
    this.saveStorageBtn.title = 'Szint mentése a kampányba';
    this.saveStorageBtn.style.cssText = `
      background: #0284c7;
      color: white;
      border: none;
      border-radius: 9999px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
      transition: background 0.15s;
    `;
    this.saveStorageBtn.addEventListener('click', () => this.saveToLocalStorage(true));
    topRightBar.appendChild(this.saveStorageBtn);

    const campaignToggleBtn = document.createElement('button');
    campaignToggleBtn.innerHTML = '🗺️ <b>Pályák</b>';
    campaignToggleBtn.title = 'Kampány szintek és sorrend kezelése';
    campaignToggleBtn.style.cssText = `
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      transition: all 0.15s;
    `;
    topRightBar.appendChild(campaignToggleBtn);

    const exitBtn = document.createElement('button');
    exitBtn.innerHTML = '🚪 <b>Kilépés</b>';
    exitBtn.title = 'Visszatérés a Főmenübe';
    exitBtn.style.cssText = `
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 9999px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      transition: filter 0.15s;
    `;
    exitBtn.addEventListener('click', () => gameState.setMode(GameMode.MENU));
    topRightBar.appendChild(exitBtn);

    hud.appendChild(topRightBar);

    // 3. Campaign Drawer (Slide-out panel from top right)
    const campaignDrawer = document.createElement('div');
    campaignDrawer.id = 'editor-campaign-drawer';
    campaignDrawer.style.cssText = `
      position: absolute;
      top: 54px;
      right: 14px;
      width: 320px;
      max-height: calc(100vh - 250px);
      background: rgba(244, 246, 250, 0.98);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 8px;
      z-index: 1040;
      pointer-events: auto;
      box-sizing: border-box;
      overflow-y: auto;
    `;

    const campDrawerHeader = document.createElement('div');
    campDrawerHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;';
    this.campaignTitleSpan = document.createElement('span');
    this.campaignTitleSpan.style.cssText = 'font-size: 11.5px; font-weight: 800; color: #0284c7;';
    this.campaignTitleSpan.innerHTML = `🗺️ <b>Kampány Pályák</b> (${campaignManager.getLevels().length})`;
    campDrawerHeader.appendChild(this.campaignTitleSpan);

    const closeCampBtn = document.createElement('button');
    closeCampBtn.innerHTML = '✕';
    closeCampBtn.style.cssText = 'background: transparent; border: none; font-size: 13px; color: #64748b; cursor: pointer; padding: 2px 6px;';
    closeCampBtn.addEventListener('click', () => (campaignDrawer.style.display = 'none'));
    campDrawerHeader.appendChild(closeCampBtn);
    campaignDrawer.appendChild(campDrawerHeader);

    campaignToggleBtn.addEventListener('click', () => {
      const isShowing = campaignDrawer.style.display === 'flex';
      campaignDrawer.style.display = isShowing ? 'none' : 'flex';
    });

    this.campaignLevelsListEl = document.createElement('div');
    this.campaignLevelsListEl.id = 'editor-campaign-list';
    this.campaignLevelsListEl.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: 200px;
      overflow-y: auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px;
      gap: 4px;
      box-sizing: border-box;
      scrollbar-width: thin;
    `;
    campaignDrawer.appendChild(this.campaignLevelsListEl);

    // Campaign Action Buttons
    const addLevelBtn = document.createElement('button');
    addLevelBtn.innerHTML = '➕ <b>Új Pálya Hozzáadása</b>';
    addLevelBtn.style.cssText = `
      background: #0284c7;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    `;
    addLevelBtn.addEventListener('click', () => this.addNewCampaignLevel());
    campaignDrawer.appendChild(addLevelBtn);

    const campBtnRow = document.createElement('div');
    campBtnRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

    const exportCampBtn = document.createElement('button');
    exportCampBtn.innerHTML = '💾 Export JSON';
    exportCampBtn.style.cssText = 'background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 0; font-size: 10.5px; font-weight: 600; cursor: pointer;';
    exportCampBtn.addEventListener('click', () => {
      this.level.setCameraWaypoints(this.cameraWaypoints);
      campaignManager.updateLevel(campaignManager.getActiveIndex(), this.level.toJSON());
      campaignManager.exportCampaignJSON();
    });
    campBtnRow.appendChild(exportCampBtn);

    const importCampBtn = document.createElement('button');
    importCampBtn.innerHTML = '📂 Import JSON';
    importCampBtn.style.cssText = 'background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 0; font-size: 10.5px; font-weight: 600; cursor: pointer;';

    const campFileInput = document.createElement('input');
    campFileInput.type = 'file';
    campFileInput.accept = '.json';
    campFileInput.style.display = 'none';
    campFileInput.addEventListener('change', (e) => this.handleCampaignImport(e));
    campaignDrawer.appendChild(campFileInput);
    importCampBtn.addEventListener('click', () => campFileInput.click());
    campBtnRow.appendChild(importCampBtn);

    campaignDrawer.appendChild(campBtnRow);

    // Special tools inside Campaign Drawer (Wire, Plate, Waypoint, Enemy)
    const specialDivider = document.createElement('div');
    specialDivider.style.cssText = 'border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 6px; font-size: 10.5px; font-weight: 800; color: #64748b;';
    specialDivider.textContent = 'SPECIÁLIS ESZKÖZÖK';
    campaignDrawer.appendChild(specialDivider);

    const specialGrid = document.createElement('div');
    specialGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 4px;';

    this.wireToolBtn = document.createElement('button');
    this.wireToolBtn.innerHTML = '🔗 <b>Huzal (6)</b>';
    this.wireToolBtn.style.cssText = 'background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; font-size: 10px; font-weight: 600; cursor: pointer;';
    this.wireToolBtn.addEventListener('click', () => {
      this.currentTool = 'wire';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    specialGrid.appendChild(this.wireToolBtn);

    const addPlatePairBtn = document.createElement('button');
    addPlatePairBtn.innerHTML = '➕ <b>Nyomólap</b>';
    addPlatePairBtn.style.cssText = 'background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; font-size: 10px; font-weight: 600; cursor: pointer;';
    addPlatePairBtn.addEventListener('click', () => {
      const base = this.currentGridPos ?? {
        gx: Math.round(this.editorLookAt.x / GRID_CELL_SIZE),
        gz: Math.round(this.editorLookAt.z / GRID_CELL_SIZE),
      };
      const id = `plate_pair_${Date.now()}`;
      this.level.addPlatePair(id, [base.gx - 1, base.gz], [base.gx + 1, base.gz]);
      this.currentTool = 'move';
      this.updateToolButtons();
      this.refreshEntityPreviews();
      this.saveToLocalStorage(false);
      this.saveCurrentLevelToCampaign();
    });
    specialGrid.appendChild(addPlatePairBtn);

    this.enemyToolBtn = document.createElement('button');
    this.enemyToolBtn.innerHTML = '👾 <b>Ellenség (7)</b>';
    this.enemyToolBtn.style.cssText = 'background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; font-size: 10px; font-weight: 600; cursor: pointer;';
    this.enemyToolBtn.addEventListener('click', () => {
      this.currentTool = 'enemy';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    specialGrid.appendChild(this.enemyToolBtn);

    this.waypointToolBtn = document.createElement('button');
    this.waypointToolBtn.innerHTML = '🎥 <b>Kamera (8)</b>';
    this.waypointToolBtn.style.cssText = 'background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; font-size: 10px; font-weight: 600; cursor: pointer;';
    this.waypointToolBtn.addEventListener('click', () => {
      this.currentTool = 'waypoint';
      this.wireSourceEntity = null;
      this.updateToolButtons();
    });
    specialGrid.appendChild(this.waypointToolBtn);

    campaignDrawer.appendChild(specialGrid);

    // Waypoint counter & add/clear
    this.waypointCountSpan = document.createElement('span');
    this.waypointCountSpan.style.cssText = 'display: none;';
    campaignDrawer.appendChild(this.waypointCountSpan);

    hud.appendChild(campaignDrawer);

    // 4. Lighting & Environment Popover
    const lightingPopover = document.createElement('div');
    lightingPopover.id = 'editor-lighting-popover';
    lightingPopover.style.cssText = `
      position: absolute;
      top: 54px;
      left: 50%;
      transform: translateX(-50%);
      width: 280px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.25);
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 10px;
      z-index: 1040;
      pointer-events: auto;
      box-sizing: border-box;
    `;

    const lightHeader = document.createElement('div');
    lightHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;';
    lightHeader.innerHTML = '<span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">☀️ Világítás & Környezet</span>';
    const closeLightBtn = document.createElement('button');
    closeLightBtn.innerHTML = '✕';
    closeLightBtn.style.cssText = 'background: transparent; border: none; font-size: 13px; color: #64748b; cursor: pointer;';
    closeLightBtn.addEventListener('click', () => (lightingPopover.style.display = 'none'));
    lightHeader.appendChild(closeLightBtn);
    lightingPopover.appendChild(lightHeader);

    lightingBtn.addEventListener('click', () => {
      const isShowing = lightingPopover.style.display === 'flex';
      lightingPopover.style.display = isShowing ? 'none' : 'flex';
    });

    // Theme selector
    const themeCol = document.createElement('div');
    themeCol.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';
    const themeLbl = document.createElement('span');
    themeLbl.textContent = 'Környezeti Téma (Sky & Fog):';
    themeLbl.style.cssText = 'font-size: 10.5px; font-weight: 700; color: #475569;';
    themeCol.appendChild(themeLbl);

    this.themeSelect = document.createElement('select');
    this.themeSelect.style.cssText = 'background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; font-size: 11px; outline: none; cursor: pointer;';
    const themeOpts: Array<{ value: TileTheme; label: string }> = [
      { value: TileTheme.DOWNTOWN, label: '🏙️ Belváros (Downtown)' },
      { value: TileTheme.APARTMENT, label: '🏠 Viki lakása (Apartment)' },
      { value: TileTheme.METRO, label: '🚇 Metró (Metro)' },
      { value: TileTheme.SOPELANA, label: '🌊 Sopelana (Tengerpart)' },
    ];
    for (const opt of themeOpts) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      this.themeSelect.appendChild(el);
    }
    this.themeSelect.value = this.level.getTheme();
    this.themeSelect.addEventListener('change', () => {
      const newTheme = this.themeSelect.value as TileTheme;
      this.level.setTheme(newTheme);
      if (this.environmentBackdrop) {
        this.environmentBackdrop.setTheme(newTheme, this.scene, this.dirLight, this.ambientLight, undefined, this.level.getBounds());
      }
      this.saveToLocalStorage(false);
    });
    themeCol.appendChild(this.themeSelect);
    lightingPopover.appendChild(themeCol);

    // Sun intensity slider
    const sunRow = document.createElement('div');
    sunRow.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const sunHeader = document.createElement('div');
    sunHeader.style.cssText = 'display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 600; color: #475569;';
    sunHeader.innerHTML = '<span>☀️ Napfény:</span>';
    this.sunValueSpan = document.createElement('span');
    const initSun = this.level.getSunIntensity() ?? 1.4;
    this.sunValueSpan.textContent = `${initSun.toFixed(1)}x`;
    this.sunValueSpan.style.color = '#eab308';
    this.sunValueSpan.style.fontWeight = '700';
    sunHeader.appendChild(this.sunValueSpan);
    sunRow.appendChild(sunHeader);

    this.sunSlider = document.createElement('input');
    this.sunSlider.type = 'range';
    this.sunSlider.min = '0.0';
    this.sunSlider.max = '3.0';
    this.sunSlider.step = '0.1';
    this.sunSlider.value = initSun.toString();
    this.sunSlider.style.cssText = 'width: 100%; cursor: pointer; accent-color: #eab308;';
    this.sunSlider.addEventListener('input', () => {
      const val = parseFloat(this.sunSlider.value);
      this.sunValueSpan.textContent = `${val.toFixed(1)}x`;
      this.level.setSunIntensity(val);
      if (this.environmentBackdrop) this.environmentBackdrop.setSunIntensity(val);
      this.saveToLocalStorage(false);
    });
    sunRow.appendChild(this.sunSlider);
    lightingPopover.appendChild(sunRow);

    // Fixture intensity slider
    const fixRow = document.createElement('div');
    fixRow.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const fixHeader = document.createElement('div');
    fixHeader.style.cssText = 'display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 600; color: #475569;';
    fixHeader.innerHTML = '<span>💡 Beltéri lámpák:</span>';
    this.fixtureValueSpan = document.createElement('span');
    const initFix = this.level.getFixtureIntensity() ?? 1.2;
    this.fixtureValueSpan.textContent = `${initFix.toFixed(1)}x`;
    this.fixtureValueSpan.style.color = '#0284c7';
    this.fixtureValueSpan.style.fontWeight = '700';
    fixHeader.appendChild(this.fixtureValueSpan);
    fixRow.appendChild(fixHeader);

    this.fixtureSlider = document.createElement('input');
    this.fixtureSlider.type = 'range';
    this.fixtureSlider.min = '0.0';
    this.fixtureSlider.max = '3.0';
    this.fixtureSlider.step = '0.1';
    this.fixtureSlider.value = initFix.toString();
    this.fixtureSlider.style.cssText = 'width: 100%; cursor: pointer; accent-color: #0284c7;';
    this.fixtureSlider.addEventListener('input', () => {
      const val = parseFloat(this.fixtureSlider.value);
      this.fixtureValueSpan.textContent = `${val.toFixed(1)}x`;
      this.level.setFixtureIntensity(val);
      if (this.environmentBackdrop) this.environmentBackdrop.setFixtureIntensity(val, this.scene);
      this.saveToLocalStorage(false);
    });
    fixRow.appendChild(this.fixtureSlider);
    lightingPopover.appendChild(fixRow);

    hud.appendChild(lightingPopover);

    // 5. Floor Level Picker Popover
    const floorPickerPopover = document.createElement('div');
    floorPickerPopover.id = 'editor-floor-popover';
    floorPickerPopover.style.cssText = `
      position: absolute;
      top: 54px;
      left: 50%;
      transform: translateX(-50%);
      width: 360px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.25);
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 10px;
      z-index: 1040;
      pointer-events: auto;
      box-sizing: border-box;
    `;

    const floorPopHeader = document.createElement('div');
    floorPopHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;';
    floorPopHeader.innerHTML = '<span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">🏢 Emelet Magasság (-2-től +12-ig)</span>';
    const closeFloorPopBtn = document.createElement('button');
    closeFloorPopBtn.innerHTML = '✕';
    closeFloorPopBtn.style.cssText = 'background: transparent; border: none; font-size: 13px; color: #64748b; cursor: pointer;';
    closeFloorPopBtn.addEventListener('click', () => (floorPickerPopover.style.display = 'none'));
    floorPopHeader.appendChild(closeFloorPopBtn);
    floorPickerPopover.appendChild(floorPopHeader);

    this.elevationDisplaySpan.addEventListener('click', () => {
      const isShowing = floorPickerPopover.style.display === 'flex';
      floorPickerPopover.style.display = isShowing ? 'none' : 'flex';
    });

    const floorPillsRow = document.createElement('div');
    floorPillsRow.style.cssText = 'display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin;';

    this.layerButtons = [];
    for (const lvl of EDITOR_LAYERS) {
      const btn = document.createElement('button');
      btn.textContent = lvl > 0 ? `+${lvl}` : `${lvl}`;
      btn.title = `Ugrás az Y = ${lvl} szintre`;
      btn.dataset.level = lvl.toString();
      btn.style.cssText = `
        min-width: 30px;
        height: 26px;
        background: ${lvl === this.currentElevationY ? '#0284c7' : '#f1f5f9'};
        color: ${lvl === this.currentElevationY ? '#ffffff' : '#334155'};
        border: 1px solid ${lvl === this.currentElevationY ? '#0284c7' : '#cbd5e1'};
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.12s;
      `;
      btn.addEventListener('click', () => {
        this.setElevationLayer(lvl);
      });
      this.layerButtons.push(btn);
      floorPillsRow.appendChild(btn);
    }
    floorPickerPopover.appendChild(floorPillsRow);

    // Clear Layer Button
    this.clearLayerBtn = document.createElement('button');
    this.clearLayerBtn.innerHTML = '🗑️ <b>Aktuális szint összes elemének törlése</b>';
    this.clearLayerBtn.style.cssText = `
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      padding: 6px 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    `;
    this.clearLayerBtn.addEventListener('click', () => this.clearCurrentLayer());
    floorPickerPopover.appendChild(this.clearLayerBtn);

    hud.appendChild(floorPickerPopover);

    // 6. Selected Entity Info Card (Floating top left)
    this.entityInfoCard = document.createElement('div');
    this.entityInfoCard.id = 'editor-selected-entity-card';
    this.entityInfoCard.style.cssText = `
      position: absolute;
      top: 14px;
      left: 14px;
      width: 240px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      border: 1.5px solid #10b981;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 11px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      gap: 4px;
      z-index: 1020;
      pointer-events: auto;
      box-sizing: border-box;
    `;
    hud.appendChild(this.entityInfoCard);

    // 7. Context Action Guide Tooltip (Floating above bottom catalog, on the left)
    this.guideEl = document.createElement('div');
    this.guideEl.style.cssText = `
      position: absolute;
      bottom: 194px;
      left: 16px;
      background: rgba(15, 23, 42, 0.85);
      color: #f1f5f9;
      backdrop-filter: blur(8px);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 10.5px;
      line-height: 1.35;
      max-width: 320px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      pointer-events: auto;
      z-index: 980;
    `;
    hud.appendChild(this.guideEl);

    // 8. Toast / History Status Notification
    this.historyStatusSpan = document.createElement('span');
    this.historyStatusSpan.style.cssText = `
      position: absolute;
      top: 54px;
      left: 50%;
      transform: translateX(-50%);
      background: #0284c7;
      color: white;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 1050;
    `;
    hud.appendChild(this.historyStatusSpan);

    // 9. Preserved Compatibility Elements (Palette preview, Tile select, Solid checkbox, Enemy select, Stair direction)
    this.solidCheckbox = document.createElement('input');
    this.solidCheckbox.type = 'checkbox';
    this.solidCheckbox.checked = this.isSolidBrush;

    this.tileSelect = document.createElement('select');
    this.tileSelect.style.display = 'none';
    for (const opt of TILE_OPTIONS) {
      const el = document.createElement('option');
      el.value = opt.type.toString();
      this.tileSelect.appendChild(el);
    }
    hud.appendChild(this.tileSelect);

    this.palettePreviewContainer = document.createElement('div');
    this.palettePreviewContainer.style.display = 'none';
    this.palettePreviewCanvas = document.createElement('canvas');
    this.palettePreviewCanvas.width = 64;
    this.palettePreviewCanvas.height = 44;
    this.palettePreviewBadge = document.createElement('span');
    this.palettePreviewDesc = document.createElement('span');
    this.palettePreviewContainer.appendChild(this.palettePreviewCanvas);
    this.palettePreviewContainer.appendChild(this.palettePreviewBadge);
    this.palettePreviewContainer.appendChild(this.palettePreviewDesc);
    hud.appendChild(this.palettePreviewContainer);

    this.enemySelectContainer = document.createElement('div');
    this.enemySelectContainer.style.cssText = `
      position: absolute;
      top: 54px;
      left: 14px;
      width: 220px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.18);
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 6px;
      z-index: 1030;
      pointer-events: auto;
    `;
    const enemyTitle = document.createElement('span');
    enemyTitle.textContent = '👾 Ellenség Típus:';
    enemyTitle.style.cssText = 'font-size: 11px; font-weight: 800; color: #9333ea;';
    this.enemySelectContainer.appendChild(enemyTitle);

    const enemySelect = document.createElement('select');
    enemySelect.style.cssText = 'background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; font-size: 11px; outline: none; cursor: pointer;';
    const enemyOptions: Array<{ value: EnemyType; label: string }> = [
      { value: EnemyType.GRANNY, label: '👵 Nagymama (Sikoly & Lökés)' },
      { value: EnemyType.DOG, label: '🐕 Kutya (Ráugrás & Lassítás)' },
      { value: EnemyType.CASHIER, label: '🛒 Pénztáros (Fagyasztás)' },
      { value: EnemyType.PASSENGER, label: '🚇 Utas (Paranoia Aura)' },
      { value: EnemyType.NPC_BEACH_WALKER, label: '🏖️ Strandoló (Bámulás)' },
      { value: EnemyType.NPC_VAGRANT, label: '🧘 Gorka (Kapukód)' },
    ];
    for (const opt of enemyOptions) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      enemySelect.appendChild(el);
    }
    enemySelect.value = this.selectedEnemyType;
    enemySelect.addEventListener('change', () => (this.selectedEnemyType = enemySelect.value as EnemyType));
    this.enemySelectContainer.appendChild(enemySelect);

    this.enemyFacingBtn = document.createElement('button');
    this.enemyFacingBtn.style.cssText = 'background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px; font-size: 10px; cursor: pointer; font-weight: 600;';
    this.enemyFacingBtn.textContent = '⬇️ Dél (+Z)';
    this.enemySelectContainer.appendChild(this.enemyFacingBtn);
    hud.appendChild(this.enemySelectContainer);

    this.stairControlsContainer = document.createElement('div');
    this.stairControlsContainer.style.display = 'none';
    this.stairDirButton = document.createElement('button');
    this.updateStairButtonText();
    this.stairControlsContainer.appendChild(this.stairDirButton);
    hud.appendChild(this.stairControlsContainer);

    document.body.appendChild(hud);

    this.updateToolButtons();
    this.updateElevationUI();
    this.renderCampaignLevels();

    return hud;
  }

  public updateToolButtons(): void {
    const isWall = this.currentTool === 'wall';
    const isBlock = this.currentTool === 'block';
    const isBox = this.currentTool === 'box';
    const isPipette = this.currentTool === 'pipette';
    const isWaypoint = this.currentTool === 'waypoint';
    const isEnemy = this.currentTool === 'enemy';
    const isMove = this.currentTool === 'move';
    const isWire = this.currentTool === 'wire';

    const isDemolish = this.currentTool === 'demolish';

    if (!isMove && !isWire) {
      this.clearSelection();
    }

    const setBtnActive = (btn: HTMLButtonElement | undefined, active: boolean, activeBg = '#0284c7', activeColor = '#ffffff') => {
      if (!btn) return;
      btn.dataset.active = active ? 'true' : '';
      btn.style.background = active ? activeBg : 'transparent';
      btn.style.color = active ? activeColor : '#334155';
      btn.style.border = active ? `1px solid ${activeBg}` : '1px solid transparent';
      btn.style.boxShadow = active ? `0 0 10px ${activeBg}77` : 'none';
    };

    setBtnActive(this.moveToolBtn, isMove);
    setBtnActive(this.wallToolBtn, isWall);
    setBtnActive(this.blockToolBtn, isBlock);
    setBtnActive(this.boxToolBtn, isBox);
    setBtnActive(this.pipetteToolBtn, isPipette);
    setBtnActive(this.sledgehammerBtn, isDemolish, '#ef4444');
    setBtnActive(this.waypointToolBtn, isWaypoint, '#ca8a04');
    setBtnActive(this.enemyToolBtn, isEnemy, '#c026d3');
    setBtnActive(this.wireToolBtn, isWire, '#7c3aed');

    if (this.enemySelectContainer) {
      this.enemySelectContainer.style.display = isEnemy ? 'flex' : 'none';
    }

    if (this.guideEl) {
      const actionHelp = isDemolish
        ? `• <b>Bal egér</b>: Elem / Fal bontása és törlése (Kalapács mód)<br>• <b>Del / Backspace</b>: Visszalépés szerkesztőbe`
        : isWall
        ? `• <b>Bal egér húzás</b>: Egyenes fal / kerítés rajzolása<br>• <b>Shift + Húzás</b>: Zárt szoba (4 fal)<br>• <b>Jobb egér húzás</b>: Falszakasz bontása`
        : isBlock
        ? `• <b>Bal egér / Húzás</b>: Elem lerakása<br>• <b>Jobb egér</b>: Törlés<br>• <b>Alt+Bal</b>: Pipetta minta`
        : isBox
        ? `• <b>Bal egér húzás</b>: Terület kitöltése<br>• <b>Jobb egér húzás</b>: Terület törlése`
        : isPipette
        ? `• <b>Kattintás</b>: Elem mintavételezése a kurzorba`
        : isWaypoint
        ? `• <b>Bal egér</b>: Útvonal pont (+2.0m)<br>• <b>Jobb egér</b>: Pont törlése`
        : isEnemy
        ? `• <b>Bal egér</b>: Ellenség lerakása<br>• <b>Jobb egér</b>: Ellenség törlése`
        : isWire
        ? `• <b>1. Kattintás</b>: Kapcsoló / Nyomólap<br>• <b>2. Kattintás</b>: Cél Ajtó`
        : `• <b>Kattintás / Húzás</b>: Elem mozgatása a padlón<br>• <b>Jobb klikk / R</b>: Forgatás 90°-kal<br>• <b>Del</b>: Törlés`;
      const camHelp = `<br>• <b>Középső egér / IJKL</b>: Pásztázás<br>• <b>Jobb egér / Alt+Bal</b>: Forgatás<br>• <b>PgUp / PgDn</b>: Szintváltás<br>• <b>Ctrl+Z / Ctrl+Y</b>: Visszavonás/Újra`;
      this.guideEl.innerHTML = actionHelp + camHelp;
    }
    this.updateCursorVisual();
    this.updateCursorBrushPreview();
  }

  private notifyHistoryToast(message: string): void {
    if (!this.historyStatusSpan) return;
    this.historyStatusSpan.textContent = message;
    this.historyStatusSpan.style.opacity = '1';
    setTimeout(() => {
      if (this.historyStatusSpan) {
        this.historyStatusSpan.style.opacity = '0.7';
      }
    }, 2400);
  }

  private captureCellState(gx: number, gz: number, gy: number): any {
    const cell = this.level.getCell(gx, gz, gy);
    return cell ? JSON.parse(JSON.stringify(cell)) : null;
  }

  private restoreCellState(gx: number, gz: number, gy: number, state: any): void {
    this.level.removeCellLayer(gx, gz, 'wallDecor', gy);
    this.level.removeCellLayer(gx, gz, 'floorDecor', gy);
    this.level.removeCellLayer(gx, gz, 'prop', gy);
    this.level.removeCellLayer(gx, gz, 'wall', gy);
    this.level.removeCellLayer(gx, gz, 'floor', gy);

    if (!state) {
      this.level.removeTile(gx, gz, gy);
      return;
    }

    if (state.floor) {
      this.level.setCellLayer(gx, gz, 'floor', state.floor, state.floorRotation ?? 0, gy);
    }
    if (state.wall) {
      this.level.setCellLayer(gx, gz, 'wall', state.wall, state.wallRotation ?? state.rotation ?? 0, gy);
    }
    if (state.prop) {
      this.level.setCellLayer(gx, gz, 'prop', state.prop, state.propRotation ?? state.rotation ?? 0, gy);
    }
    if (state.floorDecor) {
      this.level.setCellLayer(gx, gz, 'floorDecor', state.floorDecor, state.floorDecorRotation ?? state.rotation ?? 0, gy);
    }
    if (state.wallDecor) {
      this.level.setCellLayer(gx, gz, 'wallDecor', state.wallDecor, state.wallDecorRotation ?? state.rotation ?? 0, gy);
    }
  }

  private getFloorName(y: number): string {
    if (y === -2) return 'Mélygarázs / Alagút (-2)';
    if (y === -1) return 'Pince / Metró (-1)';
    if (y === 0) return 'Földszint (0)';
    if (y === 1) return '1. Emelet (+1)';
    if (y === 2) return '2. Emelet (+2)';
    if (y === 3) return '3. Emelet / Tető (+3)';
    return `${y}. Emelet (+${y})`;
  }

  private updateElevationUI(): void {
    if (this.elevationDisplaySpan) {
      this.elevationDisplaySpan.innerHTML = `🏢 <b>Szint:</b> ${this.getFloorName(this.currentElevationY)}`;
    }
    this.layerButtons.forEach((btn) => {
      const lvl = parseInt(btn.dataset.level || '0', 10);
      const isSelected = lvl === this.currentElevationY;
      btn.style.background = isSelected ? '#0284c7' : '#0f172a';
      btn.style.borderColor = isSelected ? '#38bdf8' : 'rgba(255,255,255,0.12)';
      btn.style.boxShadow = isSelected ? '0 0 8px rgba(56, 189, 248, 0.4)' : 'none';
      if (isSelected) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });
  }

  private setElevationLayer(layer: number): void {
    const clamped = Math.max(-2, Math.min(12, layer));
    this.currentElevationY = clamped;
    this.groundPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -(this.currentElevationY * GRID_CELL_SIZE)
    );
    this.updateElevationUI();
    this.updateFloorCutaway();
  }

  private toggleFloorCutaway(): void {
    this.floorCutawayActive = !this.floorCutawayActive;
    if (this.floorCutawayBtn) {
      this.floorCutawayBtn.innerHTML = this.floorCutawayActive
        ? '🏠 <b>Szintfókusz: BE</b>'
        : '🏠 <b>Szintfókusz: KI</b>';
      this.floorCutawayBtn.style.background = this.floorCutawayActive ? '#059669' : '#1e293b';
      this.floorCutawayBtn.style.color = this.floorCutawayActive ? '#ffffff' : '#94a3b8';
      this.floorCutawayBtn.style.borderColor = this.floorCutawayActive ? '#10b981' : 'rgba(255,255,255,0.15)';
    }
    this.updateFloorCutaway();
  }

  private updateFloorCutaway(): void {
    if (!this.floorCutawayActive) {
      this.level.group.traverse((obj) => {
        if (obj.userData?.isTileMesh || obj.userData?.layer !== undefined) {
          obj.visible = true;
        }
      });
      return;
    }

    this.level.group.traverse((obj) => {
      if (obj.userData && obj.userData.gy !== undefined) {
        obj.visible = obj.userData.gy <= this.currentElevationY;
      } else if (obj.userData?.isTileMesh) {
        const meshGy = Math.round(obj.position.y / GRID_CELL_SIZE);
        obj.visible = meshGy <= this.currentElevationY;
      }
    });
  }

  private clearCurrentLayer(): void {
    const gy = this.currentElevationY;
    const floorName = this.getFloorName(gy);
    if (!window.confirm(`Biztosan törölni szeretnéd az összes blokkot ezen a szinten?\n${floorName}`)) {
      return;
    }

    const cellsToClear: Array<{ gx: number; gz: number; prevCell: any }> = [];
    const bounds = this.level.getBounds();
    for (let gx = bounds.minX - 5; gx <= bounds.maxX + 5; gx++) {
      for (let gz = bounds.minZ - 5; gz <= bounds.maxZ + 5; gz++) {
        const cell = this.level.getCell(gx, gz, gy);
        if (cell && (cell.floor || cell.wall || cell.prop || cell.wallDecor || cell.floorDecor)) {
          cellsToClear.push({ gx, gz, prevCell: this.captureCellState(gx, gz, gy) });
        }
      }
    }

    if (cellsToClear.length === 0) {
      alert('Ezen a szinten nincsenek blokkok.');
      return;
    }

    this.undoRedo.beginBatch(`Szint ürítése: ${floorName}`);
    for (const item of cellsToClear) {
      this.undoRedo.addBatchStep(
        () => this.restoreCellState(item.gx, item.gz, gy, item.prevCell),
        () => this.restoreCellState(item.gx, item.gz, gy, null)
      );
      this.restoreCellState(item.gx, item.gz, gy, null);
    }
    this.undoRedo.commitBatch();
    this.saveToLocalStorage(false);
    this.saveCurrentLevelToCampaign();
  }

  private nudgeSelectedEntity(dx: number, dz: number): void {
    if (!this.selectedEntity) return;
    const targetGx = this.selectedEntity.gx + dx;
    const targetGz = this.selectedEntity.gz + dz;
    this.relocateSelectedEntity(targetGx, targetGz);
  }

  private handlePipetteClick(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates: THREE.Object3D[] = [...this.level.group.children];
    for (const rm of this.level.relicMeshes) {
      candidates.push(rm.mesh);
    }

    const hits = this.raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur && cur !== this.scene) {
        if (cur.userData?.tileId !== undefined) {
          const tileId = cur.userData.tileId as TileType;
          const rotDeg = cur.userData.rotation ?? Math.round((cur.rotation.y * 180) / Math.PI);
          this.selectedTileType = tileId;
          this.selectedRotationDeg = ((rotDeg % 360) + 360) % 360;
          if (this.rotationBtn) this.updateRotationButtonText();
          if (this.cursorMesh) {
            this.cursorMesh.rotation.y = (this.selectedRotationDeg * Math.PI) / 180;
          }
          const opt = TILE_OPTIONS.find((t) => t.type === tileId);
          if (opt) {
            this.isSolidBrush = opt.defaultSolid;
            if (this.solidCheckbox) this.solidCheckbox.checked = this.isSolidBrush;
          }
          if (this.tileSelect) this.tileSelect.value = tileId.toString();
          if (this.assetCatalog) this.assetCatalog.setSelectedTile(tileId);
          this.updatePalettePreview();
          this.updateCursorBrushPreview();

          AudioManager.getInstance().playSwitchClick();
          this.notifyHistoryToast(`🧪 Pipetta: ${opt ? opt.name : '#' + tileId}`);

          // Switch back to block tool so user can paint right away
          this.currentTool = 'block';
          this.updateToolButtons();
          return;
        }
        cur = cur.parent;
      }
    }
  }

  private updateGhostPreview(): void {
    if (this.draggedCatalogTile && this.currentGridPos) {
      const gx = this.currentGridPos.gx;
      const gz = this.currentGridPos.gz;
      const gy = this.currentElevationY;

      if (!this.ghostPreviewMesh) {
        const mesh = createTileMesh(this.draggedCatalogTile.tileType);
        if (mesh) {
          mesh.traverse((c) => {
            if (c instanceof THREE.Mesh && c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              for (const m of mats) {
                m.transparent = true;
                m.opacity = 0.65;
              }
            }
          });
          this.ghostPreviewMesh = mesh;
          this.scene.add(this.ghostPreviewMesh);
        }
      }

      if (this.ghostPreviewMesh) {
        this.ghostPreviewMesh.position.set(gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE + 0.1, gz * GRID_CELL_SIZE);
        this.ghostPreviewMesh.rotation.y = (this.selectedRotationDeg * Math.PI) / 180;
      }
      return;
    }

    if (this.currentTool !== 'move' || !this.selectedEntity || !this.currentGridPos) {
      if (this.ghostPreviewMesh) {
        this.scene.remove(this.ghostPreviewMesh);
        this.ghostPreviewMesh = null;
      }
      return;
    }

    const gx = this.currentGridPos.gx;
    const gz = this.currentGridPos.gz;
    const gy = this.selectedEntity.data?.gy ?? this.currentElevationY;

    if (!this.ghostPreviewMesh) {
      if (this.selectedEntity.type === 'tile') {
        const tileId = this.selectedEntity.data?.tileId;
        if (tileId !== undefined) {
          const mesh = createTileMesh(tileId);
          if (mesh) {
            mesh.traverse((c) => {
              if (c instanceof THREE.Mesh && c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                for (const m of mats) {
                  m.transparent = true;
                  m.opacity = 0.55;
                }
              }
            });
            this.ghostPreviewMesh = mesh;
            this.scene.add(this.ghostPreviewMesh);
          }
        }
      } else {
        const ghostGeo = new THREE.BoxGeometry(GRID_CELL_SIZE * 0.9, 0.5, GRID_CELL_SIZE * 0.9);
        const ghostMat = new THREE.MeshBasicMaterial({ color: this.isAltCloning ? 0x34d399 : 0x10b981, transparent: true, opacity: 0.45, depthWrite: false });
        this.ghostPreviewMesh = new THREE.Mesh(ghostGeo, ghostMat);
        this.scene.add(this.ghostPreviewMesh);
      }
    }

    if (this.ghostPreviewMesh) {
      this.ghostPreviewMesh.position.set(gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE + 0.1, gz * GRID_CELL_SIZE);
      if (this.selectedEntity.mesh) {
        this.ghostPreviewMesh.rotation.y = this.selectedEntity.mesh.rotation.y;
      }
    }
  }

  private updateMoveHoverCursor(): void {
    if (this.currentTool !== 'move') return;
    if (this.isDraggingEntity) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates: THREE.Object3D[] = [
      ...this.entityPreviewGroup.children,
      ...this.level.getEnemies().map((e) => e.mesh),
      ...this.level.group.children,
    ];
    for (const rm of this.level.relicMeshes) {
      candidates.push(rm.mesh);
    }
    const hits = this.raycaster.intersectObjects(candidates, true);
    let found = false;
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur && cur !== this.scene) {
        if (cur.userData?.isInteractiveEntity || cur.userData?.isTileMesh) {
          found = true;
          break;
        }
        cur = cur.parent;
      }
      if (found) break;
    }
    this.canvas.style.cursor = found ? 'grab' : 'default';
  }

  private updateBoxFillPreview(): void {
    if (!this.isBoxFilling || !this.boxFillStart || !this.currentGridPos) {
      if (this.boxFillPreviewMesh) {
        this.scene.remove(this.boxFillPreviewMesh);
        this.boxFillPreviewMesh = null;
      }
      return;
    }

    const minX = Math.min(this.boxFillStart.gx, this.currentGridPos.gx);
    const maxX = Math.max(this.boxFillStart.gx, this.currentGridPos.gx);
    const minZ = Math.min(this.boxFillStart.gz, this.currentGridPos.gz);
    const maxZ = Math.max(this.boxFillStart.gz, this.currentGridPos.gz);

    const spanX = (maxX - minX + 1) * GRID_CELL_SIZE;
    const spanZ = (maxZ - minZ + 1) * GRID_CELL_SIZE;
    const centerX = ((minX + maxX) / 2) * GRID_CELL_SIZE;
    const centerZ = ((minZ + maxZ) / 2) * GRID_CELL_SIZE;
    const centerY = this.currentElevationY * GRID_CELL_SIZE + 0.15;

    if (!this.boxFillPreviewMesh) {
      const geo = new THREE.BoxGeometry(1, 0.3, 1);
      const wire = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
      this.boxFillPreviewMesh = new THREE.LineSegments(wire, mat);
      this.boxFillPreviewMesh.renderOrder = 9999;
      this.scene.add(this.boxFillPreviewMesh);
    }

    this.boxFillPreviewMesh.scale.set(spanX, 1, spanZ);
    this.boxFillPreviewMesh.position.set(centerX, centerY, centerZ);
  }

  private getWallDrawCells(start: { gx: number; gz: number }, current: { gx: number; gz: number }, isRoom: boolean): Array<{ gx: number; gz: number }> {
    const cells: Array<{ gx: number; gz: number }> = [];
    if (isRoom) {
      const minX = Math.min(start.gx, current.gx);
      const maxX = Math.max(start.gx, current.gx);
      const minZ = Math.min(start.gz, current.gz);
      const maxZ = Math.max(start.gz, current.gz);
      for (let x = minX; x <= maxX; x++) {
        cells.push({ gx: x, gz: minZ });
        if (maxZ !== minZ) cells.push({ gx: x, gz: maxZ });
      }
      for (let z = minZ + 1; z < maxZ; z++) {
        cells.push({ gx: minX, gz: z });
        if (maxX !== minX) cells.push({ gx: maxX, gz: z });
      }
    } else {
      const dx = current.gx - start.gx;
      const dz = current.gz - start.gz;
      if (Math.abs(dx) >= Math.abs(dz)) {
        const step = dx >= 0 ? 1 : -1;
        for (let x = start.gx; ; x += step) {
          cells.push({ gx: x, gz: start.gz });
          if (x === current.gx) break;
        }
      } else {
        const step = dz >= 0 ? 1 : -1;
        for (let z = start.gz; ; z += step) {
          cells.push({ gx: start.gx, gz: z });
          if (z === current.gz) break;
        }
      }
    }
    return cells;
  }

  private updateWallDrawingPreview(isRoom = false): void {
    while (this.wallPreviewGroup.children.length > 0) {
      const c = this.wallPreviewGroup.children[0];
      this.wallPreviewGroup.remove(c);
      if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material?.dispose();
      }
    }

    if (!this.isDrawingWall || !this.wallDrawStart || !this.currentGridPos) {
      return;
    }

    const cells = this.getWallDrawCells(this.wallDrawStart, this.currentGridPos, isRoom);
    const gy = this.currentElevationY;
    const isErase = this.wallDrawButton === 2;

    for (const cell of cells) {
      if (isErase) {
        const boxGeo = new THREE.BoxGeometry(GRID_CELL_SIZE * 0.95, 2.0, GRID_CELL_SIZE * 0.95);
        const boxMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.45,
          wireframe: true,
        });
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        mesh.position.set(cell.gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE + 1.0, cell.gz * GRID_CELL_SIZE);
        this.wallPreviewGroup.add(mesh);
      } else {
        const mesh = createTileMesh(this.selectedTileType, this.selectedRotationDeg);
        if (mesh) {
          mesh.position.set(cell.gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE, cell.gz * GRID_CELL_SIZE);
          mesh.rotation.y = (this.selectedRotationDeg * Math.PI) / 180;
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const m of mats) {
                m.transparent = true;
                m.opacity = 0.65;
              }
            }
          });
          this.wallPreviewGroup.add(mesh);
        } else {
          const boxGeo = new THREE.BoxGeometry(GRID_CELL_SIZE * 0.95, 2.0, GRID_CELL_SIZE * 0.95);
          const boxMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.5,
          });
          const bMesh = new THREE.Mesh(boxGeo, boxMat);
          bMesh.position.set(cell.gx * GRID_CELL_SIZE, gy * GRID_CELL_SIZE + 1.0, cell.gz * GRID_CELL_SIZE);
          this.wallPreviewGroup.add(bMesh);
        }
      }
    }
  }

  private cycleRotation(): void {
    this.selectedRotationDeg = (this.selectedRotationDeg + 90) % 360;
    this.updateRotationButtonText();
    if (this.selectedTileType === TileType.SOPELANA_CLIFF_STAIRS) {
      const directions: StairDirection[] = ['north', 'east', 'south', 'west'];
      const idx = Math.floor(this.selectedRotationDeg / 90) % 4;
      this.selectedStairDir = directions[idx];
      this.updateStairButtonText();
    }
    if (this.cursorMesh) {
      this.cursorMesh.rotation.y = (this.selectedRotationDeg * Math.PI) / 180;
    }
  }

  private updateRotationButtonText(): void {
    if (this.rotationBtn) {
      this.rotationBtn.textContent = `🔄 Forgatás: ${this.selectedRotationDeg}°`;
    }
  }

  public cycleStairDirection(): void {
    const directions: StairDirection[] = ['north', 'east', 'south', 'west'];
    const nextIdx = (directions.indexOf(this.selectedStairDir) + 1) % directions.length;
    this.selectedStairDir = directions[nextIdx];
    this.selectedRotationDeg = nextIdx * 90;
    this.updateStairButtonText();
    this.updateRotationButtonText();
    if (this.cursorMesh) {
      this.cursorMesh.rotation.y = stairDirToRotation(this.selectedStairDir);
    }
  }

  private updateStairButtonText(): void {
    const labels: Record<StairDirection, string> = {
      north: '⬆️ Észak (-Z)',
      east: '➡️ Kelet (+X)',
      south: '⬇️ Dél (+Z)',
      west: '⬅️ Nyugat (-X)',
    };
    if (this.stairDirButton) {
      this.stairDirButton.textContent = labels[this.selectedStairDir];
    }
  }

  private getCameraHorizontalVectors(): { right: THREE.Vector3; forward: THREE.Vector3 } {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    return { right, forward };
  }

  public syncEditorCamera(): void {
    const cosPitch = Math.cos(this.editorPitch);
    const sinPitch = Math.sin(this.editorPitch);
    const cosYaw = Math.cos(this.editorYaw);
    const sinYaw = Math.sin(this.editorYaw);

    const offsetX = this.editorDistance * cosPitch * sinYaw;
    const offsetY = this.editorDistance * sinPitch;
    const offsetZ = this.editorDistance * cosPitch * cosYaw;

    this.camera.position.set(
      this.editorLookAt.x + offsetX,
      this.editorLookAt.y + offsetY,
      this.editorLookAt.z + offsetZ
    );
    this.camera.lookAt(this.editorLookAt);
  }

  private initEventListeners(): void {
    this.canvas.addEventListener('pointermove', (event: PointerEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;

      if (this.isPanning) {
        const panSpeed = this.editorDistance / 700;
        const deltaX = (event.clientX - this.panStart.x) * panSpeed;
        const deltaY = (event.clientY - this.panStart.y) * panSpeed;
        this.panStart = { x: event.clientX, y: event.clientY };

        const { right, forward } = this.getCameraHorizontalVectors();
        this.editorLookAt.addScaledVector(right, -deltaX);
        this.editorLookAt.addScaledVector(forward, deltaY);
        this.syncEditorCamera();
        return;
      }

      // Check Orbit Drag (Right Click Drag OR Alt + Left Click Drag)
      const isOrbitHeld = (event.buttons & 2) !== 0 || ((event.buttons & 1) !== 0 && event.altKey);
      if (isOrbitHeld) {
        const dist = Math.hypot(event.clientX - this.orbitStart.x, event.clientY - this.orbitStart.y);
        if (dist > 3 || this.isOrbiting) {
          this.isOrbiting = true;
          this.didOrbitDrag = true;
          const deltaX = event.clientX - this.orbitStart.x;
          const deltaY = event.clientY - this.orbitStart.y;
          this.orbitStart = { x: event.clientX, y: event.clientY };

          this.editorYaw -= deltaX * 0.006;
          this.editorPitch = THREE.MathUtils.clamp(
            this.editorPitch + deltaY * 0.006,
            0.05,
            Math.PI / 2 - 0.02
          );
          this.syncEditorCamera();
          return;
        }
      }

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridCursor();

      // In Wall tool mode, update wall line / room preview
      if (this.isDrawingWall && this.wallDrawStart && this.currentGridPos) {
        this.updateWallDrawingPreview(event.shiftKey);
        return;
      }

      // In Move tool mode, update ghost preview or hover cursor
      if (this.currentTool === 'move') {
        if (this.selectedEntity) {
          this.canvas.style.cursor = this.isDraggingEntity ? 'grabbing' : 'grab';
          this.updateGhostPreview();
        } else {
          this.updateMoveHoverCursor();
        }
      } else {
        if (this.canvas.style.cursor === 'grab' || this.canvas.style.cursor === 'grabbing') {
          this.canvas.style.cursor = 'default';
        }
      }

      // In Box tool mode, update box preview
      if (this.isBoxFilling && this.boxFillStart && this.currentGridPos) {
        this.updateBoxFillPreview();
      }

      if (this.isPainting && this.currentGridPos) {
        if (this.currentTool === 'block') {
          this.applyBrush(this.currentGridPos.gx, this.currentGridPos.gz);
        } else if (this.currentTool === 'demolish') {
          this.applyBrush(this.currentGridPos.gx, this.currentGridPos.gz);
          this.demolishAtCell(this.currentGridPos.gx, this.currentGridPos.gz);
        }
      }
    });

    this.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;
      if (event.target !== this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridCursor();

      // Pan with Middle Mouse Button OR Left Click with Shift (unless in block/wall/box/demolish mode)
      const isPanTrigger =
        event.button === 1 ||
        (event.button === 0 && event.shiftKey && this.currentTool !== 'block' && this.currentTool !== 'wall' && this.currentTool !== 'demolish');

      if (isPanTrigger) {
        this.isPanning = true;
        this.panStart = { x: event.clientX, y: event.clientY };
        event.preventDefault();
        return;
      }

      // Move tool: Right-click rotates currently selected/held entity 90° (Sims style)
      if (this.currentTool === 'move' && event.button === 2 && this.selectedEntity) {
        this.rotateSelectedEntity();
        AudioManager.getInstance().playSwitchClick();
        event.preventDefault();
        return;
      }

      // Orbit Trigger: Right Click OR Left Click with Alt (unless in painting/drawing/move/demolish mode)
      const isOrbitTrigger =
        event.button === 2 &&
        this.currentTool !== 'block' &&
        this.currentTool !== 'box' &&
        this.currentTool !== 'wall' &&
        this.currentTool !== 'demolish' &&
        (this.currentTool !== 'move' || !this.selectedEntity);
      if (isOrbitTrigger) {
        this.orbitStart = { x: event.clientX, y: event.clientY };
        this.isOrbiting = false;
        this.didOrbitDrag = false;
        event.preventDefault();
        return;
      }

      // Tool Mode: Demolish / Sledgehammer (Sims 4 style sledgehammer)
      if (this.currentTool === 'demolish') {
        if ((event.button === 0 || event.button === 2) && this.currentGridPos) {
          this.isPainting = true;
          this.paintButton = 2; // Erase mode
          this.undoRedo.beginBatch('Bontás (Kalapács)');
          this.applyBrush(this.currentGridPos.gx, this.currentGridPos.gz);
          this.demolishAtCell(this.currentGridPos.gx, this.currentGridPos.gz);
        }
        event.preventDefault();
        return;
      }

      // Tool Mode: Wall Drawing (Sims-style line & room drag)
      if (this.currentTool === 'wall') {
        if ((event.button === 0 || event.button === 2) && this.currentGridPos) {
          this.isDrawingWall = true;
          this.wallDrawButton = event.button;
          this.wallDrawStart = { gx: this.currentGridPos.gx, gz: this.currentGridPos.gz };
          this.updateWallDrawingPreview(event.shiftKey);
        }
        event.preventDefault();
        return;
      }

      // Tool Mode: Pipette (or Alt + Left Click in Block mode)
      if (this.currentTool === 'pipette' || (event.altKey && event.button === 0 && this.currentTool === 'block')) {
        if (event.button === 0) {
          this.handlePipetteClick();
        }
        event.preventDefault();
        return;
      }

      // Tool Mode: Box Fill (or Shift + Left/Right Click in Block mode)
      if (this.currentTool === 'box' || (event.shiftKey && (event.button === 0 || event.button === 2) && this.currentTool === 'block')) {
        if (this.currentGridPos) {
          this.isBoxFilling = true;
          this.paintButton = event.button;
          this.boxFillStart = { gx: this.currentGridPos.gx, gz: this.currentGridPos.gz };
          this.updateBoxFillPreview();
        }
        event.preventDefault();
        return;
      }

      // Tool Mode: Move Interactive Entities & Blocks
      if (this.currentTool === 'move') {
        if (event.button === 0) {
          this.isAltCloning = event.altKey;
          this.dragPointerStartPos = { x: event.clientX, y: event.clientY };
          this.handleMoveToolDown();
        }
        return;
      }

      // Tool Mode: Wire Interactive Connections
      if (this.currentTool === 'wire') {
        if (event.button === 0) {
          this.handleWireToolClick();
        }
        return;
      }

      // Tool Mode: Camera Waypoint
      if (this.currentTool === 'waypoint') {
        if (event.button === 0 && this.currentGridPos) {
          const wx = this.currentGridPos.gx * GRID_CELL_SIZE;
          const wy = this.currentElevationY * GRID_CELL_SIZE + 2.0;
          const wz = this.currentGridPos.gz * GRID_CELL_SIZE;
          const wp: [number, number, number] = [wx, wy, wz];
          this.undoRedo.push({
            name: 'Kamera útvonalpont lerakása',
            undo: () => {
              const idx = this.cameraWaypoints.indexOf(wp);
              if (idx !== -1) {
                this.cameraWaypoints.splice(idx, 1);
                this.level.setCameraWaypoints(this.cameraWaypoints);
                this.updateWaypointVisuals();
                this.saveToLocalStorage(false);
              }
            },
            redo: () => {
              this.cameraWaypoints.push(wp);
              this.level.setCameraWaypoints(this.cameraWaypoints);
              this.updateWaypointVisuals();
              this.saveToLocalStorage(false);
            },
          });
          this.cameraWaypoints.push(wp);
          this.level.setCameraWaypoints(this.cameraWaypoints);
          this.updateWaypointVisuals();
          this.saveToLocalStorage(false);
        }
        return;
      }

      // Tool Mode: Enemy Placement
      if (this.currentTool === 'enemy') {
        if (event.button === 0 && this.currentGridPos) {
          const wx = this.currentGridPos.gx * GRID_CELL_SIZE;
          const wy = this.currentElevationY * GRID_CELL_SIZE;
          const wz = this.currentGridPos.gz * GRID_CELL_SIZE;
          const enemyConfig = {
            type: this.selectedEnemyType,
            spawnPos: [wx, wy, wz] as [number, number, number],
            facingAngle: this.enemyFacingAngle,
          };
          this.undoRedo.push({
            name: 'Ellenség lerakása',
            undo: () => {
              const enemies = this.level.getEnemies();
              const found = enemies.find((e) => Math.hypot(e.mesh.position.x - wx, e.mesh.position.z - wz) < 1.0);
              if (found) {
                this.level.removeEnemy(found);
                this.saveToLocalStorage(false);
              }
            },
            redo: () => {
              this.level.addEnemy(enemyConfig);
              this.saveToLocalStorage(false);
            },
          });
          this.level.addEnemy(enemyConfig);
          this.saveToLocalStorage(false);
        }
        return;
      }

      // Tool Mode: Block Painting (Left = Paint, Right = Erase)
      if (event.button === 0 || event.button === 2) {
        this.isPainting = true;
        this.paintButton = event.button;
        this.undoRedo.beginBatch(this.paintButton === 0 ? 'Blokk lerakása' : 'Blokk törlése');
        if (this.currentGridPos) {
          this.applyBrush(this.currentGridPos.gx, this.currentGridPos.gz);
        }
      }
    });

    window.addEventListener('pointerup', (event: PointerEvent) => {
      // Wall tool: line or room drag completion
      if (this.isDrawingWall && this.wallDrawStart && this.currentGridPos) {
        const cells = this.getWallDrawCells(this.wallDrawStart, this.currentGridPos, event.shiftKey);
        const isDelete = event.button === 2 || this.wallDrawButton === 2;
        this.undoRedo.beginBatch(isDelete ? 'Falszakasz törlése' : 'Falszakasz rajzolása');
        this.paintButton = isDelete ? 2 : 0;
        for (const cell of cells) {
          this.applyBrush(cell.gx, cell.gz);
        }
        this.undoRedo.commitBatch();

        this.isDrawingWall = false;
        this.wallDrawStart = null;
        while (this.wallPreviewGroup.children.length > 0) {
          const c = this.wallPreviewGroup.children[0];
          this.wallPreviewGroup.remove(c);
          if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
            c.geometry?.dispose();
            if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
            else c.material?.dispose();
          }
        }
        AudioManager.getInstance().playSwitchClick();
        this.notifyHistoryToast(isDelete ? '🧱 Falszakasz törölve' : '🧱 Falszakasz felépítve');
        this.saveToLocalStorage(false);
        this.saveCurrentLevelToCampaign();
      }

      // Move tool: Drag-and-drop completion or click-to-pick
      if (this.currentTool === 'move' && this.isDraggingEntity && this.selectedEntity && this.dragEntityStartGrid) {
        const dist = Math.hypot(event.clientX - this.dragPointerStartPos.x, event.clientY - this.dragPointerStartPos.y);
        const hasMovedCell = this.currentGridPos && (
          this.currentGridPos.gx !== this.dragEntityStartGrid.gx ||
          this.currentGridPos.gz !== this.dragEntityStartGrid.gz
        );

        if (dist > 6 && hasMovedCell && this.currentGridPos) {
          this.relocateSelectedEntity(this.currentGridPos.gx, this.currentGridPos.gz);
          AudioManager.getInstance().playSwitchClick();
          if (this.ghostPreviewMesh) {
            this.scene.remove(this.ghostPreviewMesh);
            this.ghostPreviewMesh = null;
          }
        } else {
          // It was a click: keep entity picked up so it floats with cursor (Sims style)
          this.updateGhostPreview();
        }

        this.isDraggingEntity = false;
        this.dragEntityStartGrid = null;
        this.canvas.style.cursor = 'grab';
      }

      // Box fill completion
      if (this.isBoxFilling && this.boxFillStart && this.currentGridPos) {
        const minX = Math.min(this.boxFillStart.gx, this.currentGridPos.gx);
        const maxX = Math.max(this.boxFillStart.gx, this.currentGridPos.gx);
        const minZ = Math.min(this.boxFillStart.gz, this.currentGridPos.gz);
        const maxZ = Math.max(this.boxFillStart.gz, this.currentGridPos.gz);

        const isDelete = event.button === 2 || this.paintButton === 2;
        this.undoRedo.beginBatch(isDelete ? 'Téglalap törlése' : 'Téglalap kitöltése');
        this.paintButton = isDelete ? 2 : 0;
        for (let gx = minX; gx <= maxX; gx++) {
          for (let gz = minZ; gz <= maxZ; gz++) {
            this.applyBrush(gx, gz);
          }
        }
        this.undoRedo.commitBatch();

        this.isBoxFilling = false;
        this.boxFillStart = null;
        if (this.boxFillPreviewMesh) {
          this.scene.remove(this.boxFillPreviewMesh);
          this.boxFillPreviewMesh = null;
        }
        this.saveToLocalStorage(false);
        this.saveCurrentLevelToCampaign();
      }

      // If right click was released without dragging in specific tool modes
      if (event.button === 2 && !this.didOrbitDrag && this.currentGridPos) {
        if (this.currentTool === 'waypoint') {
          const wx = this.currentGridPos.gx * GRID_CELL_SIZE;
          const wz = this.currentGridPos.gz * GRID_CELL_SIZE;
          const idx = this.cameraWaypoints.findIndex(
            (wp) => Math.hypot(wp[0] - wx, wp[2] - wz) < 1.5
          );
          if (idx !== -1) {
            const removedWp = this.cameraWaypoints[idx];
            this.undoRedo.push({
              name: 'Kamera pont törlése',
              undo: () => {
                this.cameraWaypoints.splice(idx, 0, removedWp);
                this.level.setCameraWaypoints(this.cameraWaypoints);
                this.updateWaypointVisuals();
                this.saveToLocalStorage(false);
              },
              redo: () => {
                this.cameraWaypoints.splice(idx, 1);
                this.level.setCameraWaypoints(this.cameraWaypoints);
                this.updateWaypointVisuals();
                this.saveToLocalStorage(false);
              },
            });
            this.cameraWaypoints.splice(idx, 1);
            this.level.setCameraWaypoints(this.cameraWaypoints);
            this.updateWaypointVisuals();
            this.saveToLocalStorage(false);
          }
        } else if (this.currentTool === 'enemy') {
          const wx = this.currentGridPos.gx * GRID_CELL_SIZE;
          const wz = this.currentGridPos.gz * GRID_CELL_SIZE;
          const enemies = this.level.getEnemies();
          const targetEnemy = enemies.find(
            (e) => Math.hypot(e.mesh.position.x - wx, e.mesh.position.z - wz) < 2.0
          );
          if (targetEnemy) {
            const cfg = { ...targetEnemy.config };
            this.undoRedo.push({
              name: 'Ellenség törlése',
              undo: () => {
                this.level.addEnemy(cfg);
                this.saveToLocalStorage(false);
              },
              redo: () => {
                const cur = this.level.getEnemies().find((e) => Math.hypot(e.mesh.position.x - wx, e.mesh.position.z - wz) < 1.0);
                if (cur) this.level.removeEnemy(cur);
                this.saveToLocalStorage(false);
              },
            });
            this.level.removeEnemy(targetEnemy);
            this.saveToLocalStorage(false);
          }
        }
      }

      if (this.isPainting) {
        this.undoRedo.commitBatch();
        this.saveToLocalStorage(false);
        this.saveCurrentLevelToCampaign();
      }

      this.isPainting = false;
      this.isPanning = false;
      this.isOrbiting = false;
      this.didOrbitDrag = false;
      this.lastPaintedCell = null;
    });

    window.addEventListener('contextmenu', (event: MouseEvent) => {
      if (this.active && gameState.getMode() === GameMode.EDITOR) {
        event.preventDefault();
      }
    });

    // Mouse Wheel Zoom
    this.canvas.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
        this.editorDistance = THREE.MathUtils.clamp(this.editorDistance * zoomFactor, 4.0, 80.0);
        this.syncEditorCamera();
      },
      { passive: false }
    );

    // HTML5 Drag-and-Drop from Sims Asset Catalog onto 3D Scene
    this.canvas.addEventListener('dragover', (e: DragEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridCursor();
      this.updateGhostPreview();
      this.updateCursorBrushPreview();
    });

    this.canvas.addEventListener('drop', (e: DragEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.updateGridCursor();
      if (this.currentGridPos) {
        this.undoRedo.beginBatch('Elem behúzása katalógusból');
        this.paintButton = 0;
        this.applyBrush(this.currentGridPos.gx, this.currentGridPos.gz);
        this.undoRedo.commitBatch();
        AudioManager.getInstance().playSwitchClick();
        this.notifyHistoryToast(`🧱 Elem lehelyezve: (${this.currentGridPos.gx}, ${this.currentGridPos.gz})`);
        this.saveToLocalStorage(false);
        this.saveCurrentLevelToCampaign();
      }
      this.draggedCatalogTile = null;
      if (this.ghostPreviewMesh) {
        this.scene.remove(this.ghostPreviewMesh);
        this.ghostPreviewMesh = null;
      }
    });

    // Keyboard Pan & Orbit Controls & Shortcuts
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const code = event.code;

      // Undo / Redo shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if (event.ctrlKey || event.metaKey) {
        if (code === 'KeyZ') {
          if (event.shiftKey) {
            this.undoRedo.redo();
          } else {
            this.undoRedo.undo();
          }
          event.preventDefault();
          return;
        }
        if (code === 'KeyY') {
          this.undoRedo.redo();
          event.preventDefault();
          return;
        }
      }

      // Height Floor Navigation (PageUp / PageDown)
      if (code === 'PageUp') {
        this.setElevationLayer(this.currentElevationY + 1);
        event.preventDefault();
        return;
      }
      if (code === 'PageDown') {
        this.setElevationLayer(this.currentElevationY - 1);
        event.preventDefault();
        return;
      }

      // Toggle Sims Asset Catalog (Space)
      if (code === 'Space' && !this.selectedEntity) {
        this.assetCatalog?.toggleExpanded();
        event.preventDefault();
        return;
      }

      // Quick Wall Tool key (KeyW)
      if (code === 'KeyW') {
        this.currentTool = 'wall';
        this.wireSourceEntity = null;
        this.updateToolButtons();
        this.assetCatalog?.setCategory('walls');
        event.preventDefault();
        return;
      }

      // Quick Move Tool key (KeyM)
      if (code === 'KeyM') {
        this.currentTool = 'move';
        this.wireSourceEntity = null;
        this.updateToolButtons();
        event.preventDefault();
        return;
      }

      // Quick Number Row Tool Switcher (1-8)
      const numberTools: Record<string, EditorTool> = {
        Digit1: 'wall',
        Digit2: 'block',
        Digit3: 'box',
        Digit4: 'pipette',
        Digit5: 'move',
        Digit6: 'wire',
        Digit7: 'enemy',
        Digit8: 'waypoint',
      };
      if (numberTools[code]) {
        this.currentTool = numberTools[code];
        this.wireSourceEntity = null;
        this.updateToolButtons();
        if (this.currentTool === 'wall') {
          this.assetCatalog?.setCategory('walls');
        }
        event.preventDefault();
        return;
      }

      // Quick Pipette Tool key (KeyP)
      if (code === 'KeyP') {
        this.currentTool = 'pipette';
        this.updateToolButtons();
        event.preventDefault();
        return;
      }

      // Quick Box Tool key (KeyB)
      if (code === 'KeyB') {
        this.currentTool = 'box';
        this.updateToolButtons();
        event.preventDefault();
        return;
      }

      // Quick Sledgehammer Tool key (KeyK)
      if (code === 'KeyK') {
        this.currentTool = this.currentTool === 'demolish' ? 'block' : 'demolish';
        this.updateToolButtons();
        event.preventDefault();
        return;
      }

      if (this.currentTool === 'move' && this.selectedEntity) {
        if (code === 'Delete' || code === 'Backspace') {
          this.deleteSelectedEntity();
          event.preventDefault();
          return;
        }
        if (code === 'Escape') {
          this.clearSelection();
          event.preventDefault();
          return;
        }
        // Arrow keys nudge
        if (code === 'ArrowUp') {
          this.nudgeSelectedEntity(0, -1);
          event.preventDefault();
          return;
        }
        if (code === 'ArrowDown') {
          this.nudgeSelectedEntity(0, 1);
          event.preventDefault();
          return;
        }
        if (code === 'ArrowLeft') {
          this.nudgeSelectedEntity(-1, 0);
          event.preventDefault();
          return;
        }
        if (code === 'ArrowRight') {
          this.nudgeSelectedEntity(1, 0);
          event.preventDefault();
          return;
        }
      }

      if (this.currentTool === 'wire' && (code === 'Escape' || code === 'Delete' || code === 'Backspace')) {
        this.clearSelection();
        this.wireSourceEntity = null;
        if (this.guideEl) {
          this.guideEl.innerHTML = `• <b>1. Kattintás</b>: Kapcsoló gomb vagy Nyomólap kijelölése<br>• <b>2. Kattintás</b>: Cél Ajtó kijelölése összekötéshez`;
        }
        event.preventDefault();
        return;
      }

      if ((code === 'Delete' || code === 'Backspace') && this.currentTool !== 'move' && this.currentTool !== 'wire') {
        this.currentTool = this.currentTool === 'demolish' ? 'block' : 'demolish';
        this.updateToolButtons();
        event.preventDefault();
        return;
      }

      if (code === 'KeyR') {
        if (this.currentTool === 'move' && this.selectedEntity) {
          this.rotateSelectedEntity();
          event.preventDefault();
          return;
        }
        this.cycleRotation();
        event.preventDefault();
        return;
      }
      if (code === 'KeyQ') {
        this.editorYaw -= Math.PI / 8;
        this.syncEditorCamera();
        event.preventDefault();
        return;
      }
      if (code === 'KeyE') {
        this.editorYaw += Math.PI / 8;
        this.syncEditorCamera();
        event.preventDefault();
        return;
      }
      if (
        code === 'KeyI' ||
        code === 'KeyK' ||
        code === 'KeyJ' ||
        code === 'KeyL'
      ) {
        this.keysDown.add(code);
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      if (!this.active || gameState.getMode() !== GameMode.EDITOR) return;
      this.keysDown.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.isPanning = false;
    });
  }

  public saveToLocalStorage(showFeedback = false): void {
    try {
      this.level.setCameraWaypoints(this.cameraWaypoints);
      const data = this.level.toJSON();
      localStorage.setItem(STORAGE_KEY_CUSTOM_LEVEL, JSON.stringify(data));
      campaignManager.updateLevel(campaignManager.getActiveIndex(), data);
      if (showFeedback && this.saveStorageBtn) {
        const origText = this.saveStorageBtn.innerHTML;
        this.saveStorageBtn.innerHTML = '✓ <b>Sikeresen mentve!</b>';
        this.saveStorageBtn.style.background = '#059669';
        setTimeout(() => {
          if (this.saveStorageBtn) {
            this.saveStorageBtn.innerHTML = origText;
            this.saveStorageBtn.style.background = '#0284c7';
          }
        }, 1800);
      }
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
    }
  }

  private applyBrush(gx: number, gz: number): void {
    if (this.currentTool === 'move') return;
    const cellKey = `${gx},${this.currentElevationY},${gz}`;
    if (this.lastPaintedCell === cellKey) return;
    this.lastPaintedCell = cellKey;

    const gy = this.currentElevationY;
    const prevCell = this.captureCellState(gx, gz, gy);
    const layer = getLayerForTileType(this.selectedTileType);

    if (this.paintButton === 0) {
      // Left Click: Place Tile / Relic
      const cell = this.level.getCell(gx, gz, gy);
      // If cell has no floor yet and we are placing a prop, wall, or decor, ensure base floor exists
      if ((!cell || !cell.floor) && layer !== 'floor') {
        const defFloor = this.level.getDefaultFloorForTheme();
        this.level.setCellLayer(gx, gz, 'floor', defFloor, 0, gy);
      }

      this.level.setCellLayer(
        gx,
        gz,
        layer,
        this.selectedTileType,
        this.selectedRotationDeg,
        gy
      );

      if (this.selectedTileType === TileType.RELIC_MUSHROOM || this.selectedTileType === TileType.RELIC_JOINT) {
        const relicType: RelicType = this.selectedTileType === TileType.RELIC_MUSHROOM ? 'mushroom' : 'joint';
        this.level.removeRelicAt(gx, gz);
        this.level.addRelic({
          id: `relic_${relicType}_${gx}_${gz}`,
          type: relicType,
          position: [gx, gz],
          x: gx,
          z: gz,
        });
      }
    } else if (this.paintButton === 2) {
      // Right Click: Safe layer-aware peel-back removal
      const cell = this.level.getCell(gx, gz, gy);
      if (cell) {
        // If current brush corresponds to a layer present on the cell, delete that layer first
        if (cell[layer]) {
          this.level.removeCellLayer(gx, gz, layer, gy);
        } else {
          // Peel back: wallDecor -> floorDecor -> prop -> wall -> floor
          if (cell.wallDecor) {
            this.level.removeCellLayer(gx, gz, 'wallDecor', gy);
          } else if (cell.floorDecor) {
            this.level.removeCellLayer(gx, gz, 'floorDecor', gy);
          } else if (cell.prop) {
            this.level.removeCellLayer(gx, gz, 'prop', gy);
          } else if (cell.wall) {
            this.level.removeCellLayer(gx, gz, 'wall', gy);
          } else if (cell.floor && (layer === 'floor' || (!cell.wallDecor && !cell.floorDecor && !cell.prop && !cell.wall))) {
            this.level.removeCellLayer(gx, gz, 'floor', gy);
          }
        }
      } else {
        this.level.removeTile(gx, gz, gy);
      }

      this.level.removeRelicAt(gx, gz);
    }

    const nextCell = this.captureCellState(gx, gz, gy);
    this.undoRedo.addBatchStep(
      () => this.restoreCellState(gx, gz, gy, prevCell),
      () => this.restoreCellState(gx, gz, gy, nextCell)
    );

    this.saveToLocalStorage(false);
  }

  private demolishAtCell(gx: number, gz: number): void {
    const wx = gx * GRID_CELL_SIZE;
    const wz = gz * GRID_CELL_SIZE;

    // Remove enemy at cell if any
    const enemies = this.level.getEnemies();
    const enemy = enemies.find((e) => Math.hypot(e.mesh.position.x - wx, e.mesh.position.z - wz) < 1.0);
    if (enemy) {
      this.level.removeEnemy(enemy);
      this.refreshEntityPreviews();
    }

    // Remove relic at cell if any
    this.level.removeRelicAt(gx, gz);

    // Remove exit portal at cell if any
    const data = this.level.data || campaignManager.getActiveLevel();
    if (data?.exitPortal && data.exitPortal[0] === gx && data.exitPortal[1] === gz) {
      this.level.setExitPortal(undefined);
      this.refreshEntityPreviews();
    }

    // Remove switches at cell if any
    if (data?.switches) {
      const sIdx = data.switches.findIndex((s) => s.position[0] === gx && s.position[1] === gz);
      if (sIdx !== -1) {
        data.switches.splice(sIdx, 1);
        this.refreshEntityPreviews();
      }
    }

    // Remove pressure plate pairs at cell if any
    if (data?.platePairs) {
      const pIdx = data.platePairs.findIndex(
        (p) =>
          (p.plate1[0] === gx && p.plate1[1] === gz) ||
          (p.plate2 && p.plate2[0] === gx && p.plate2[1] === gz) ||
          (p.targetObstacle && p.targetObstacle[0] === gx && p.targetObstacle[1] === gz)
      );
      if (pIdx !== -1) {
        data.platePairs.splice(pIdx, 1);
        this.refreshEntityPreviews();
      }
    }
  }

  public setRoofVisibility(visible: boolean): void {
    this.scene.traverse((obj) => {
      if (obj.userData?.isRoof) {
        obj.visible = visible;
      }
    });
  }

  public setVisible(visible: boolean): void {
    const isEditor = visible && gameState.getMode() === GameMode.EDITOR;
    this.active = isEditor;
    if (this.hudContainer) {
      this.hudContainer.style.display = isEditor ? 'flex' : 'none';
    }
    if (this.assetCatalog) {
      this.assetCatalog.setVisible(isEditor);
    }
    this.cursorMesh.visible = isEditor;
    this.waypointGroup.visible = isEditor;
    this.entityPreviewGroup.visible = isEditor;

    if (!isEditor) {
      this.clearSelection();
      if (this.ghostPreviewMesh) {
        this.scene.remove(this.ghostPreviewMesh);
        this.ghostPreviewMesh = null;
      }
      if (this.boxFillPreviewMesh) {
        this.scene.remove(this.boxFillPreviewMesh);
        this.boxFillPreviewMesh = null;
      }
      while (this.wallPreviewGroup.children.length > 0) {
        const c = this.wallPreviewGroup.children[0];
        this.wallPreviewGroup.remove(c);
        if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material?.dispose();
        }
      }
      this.isDrawingWall = false;
      this.wallDrawStart = null;
      this.isPainting = false;
      this.isPanning = false;
      this.isOrbiting = false;
      this.didOrbitDrag = false;
      this.keysDown.clear();
      this.lastPaintedCell = null;
      this.setRoofVisibility(true);
    } else {
      this.refreshEntityPreviews();
      this.isPanning = false;
      this.isOrbiting = false;
      this.didOrbitDrag = false;
      this.keysDown.clear();
      if (this.themeSelect) {
        this.themeSelect.value = this.level.getTheme();
      }
      this.renderCampaignLevels();

      // Reset camera FOV to 45 in editor mode
      this.camera.fov = 45;
      this.camera.updateProjectionMatrix();

      // Temporarily hide carriage roofs for unobstructed top-down view
      this.setRoofVisibility(false);

      // Center editor camera on level bounds
      const bounds = this.level.getBounds();
      if (bounds && bounds.maxX > bounds.minX) {
        const centerX = (bounds.minX + bounds.maxX) * 0.5 * GRID_CELL_SIZE;
        const centerZ = (bounds.minZ + bounds.maxZ) * 0.5 * GRID_CELL_SIZE;
        this.editorLookAt.set(centerX, 0, centerZ);
        const span = Math.max((bounds.maxX - bounds.minX) * GRID_CELL_SIZE, (bounds.maxZ - bounds.minZ) * GRID_CELL_SIZE);
        this.editorDistance = THREE.MathUtils.clamp(span * 0.8, 12.0, 50.0);
      } else {
        this.editorLookAt.set(13, 0, 13);
        this.editorDistance = 22.0;
      }
      this.syncEditorCamera();
    }
  }

  public setActive(active: boolean): void {
    this.setVisible(active);
  }

  public toggle(): void {
    this.setActive(!this.active);
  }

  public isActive(): boolean {
    return this.active;
  }

  public addWaypointAtCursor(): void {
    if (!this.currentGridPos) return;
    const wx = this.currentGridPos.gx * GRID_CELL_SIZE;
    const wy = this.currentElevationY * GRID_CELL_SIZE + 2.0;
    const wz = this.currentGridPos.gz * GRID_CELL_SIZE;

    this.cameraWaypoints.push([wx, wy, wz]);
    this.level.setCameraWaypoints(this.cameraWaypoints);
    this.updateWaypointVisuals();
    this.saveToLocalStorage(false);
  }

  public clearWaypoints(): void {
    this.cameraWaypoints = [];
    this.level.setCameraWaypoints([]);
    this.updateWaypointVisuals();
    this.saveToLocalStorage(false);
  }

  public syncWaypointsFromLevel(): void {
    const wp = this.level.getCameraWaypoints();
    this.cameraWaypoints = wp ? [...wp] : [];
    this.updateWaypointVisuals();
  }

  private updateWaypointVisuals(): void {
    // Clear existing visual objects
    while (this.waypointGroup.children.length > 0) {
      const child = this.waypointGroup.children[0];
      this.waypointGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    if (this.waypointCountSpan) {
      this.waypointCountSpan.textContent = `${this.cameraWaypoints.length} db`;
    }

    if (this.cameraWaypoints.length === 0) return;

    // Yellow sphere markers at each waypoint node
    const sphereGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.4,
      transparent: true,
      opacity: 0.9,
    });

    const points: THREE.Vector3[] = [];

    for (let i = 0; i < this.cameraWaypoints.length; i++) {
      const [wx, wy, wz] = this.cameraWaypoints[i];
      const pos = new THREE.Vector3(wx, wy, wz);
      points.push(pos);

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      this.waypointGroup.add(sphere);

      // Vertical marker pin to ground
      const groundY = Math.max(0, wy - 2.0);
      const pinHeight = Math.max(0.2, wy - groundY);
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, pinHeight, 8);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(wx, groundY + pinHeight * 0.5, wz);
      this.waypointGroup.add(pin);
    }

    // Render smooth spline curve preview if 2 or more waypoints exist (bright yellow THREE.Line)
    if (points.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
      const curvePoints = curve.getPoints(Math.max(60, points.length * 20));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffeb3b,
        linewidth: 3,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      this.waypointGroup.add(line);
    }
  }

  // ==========================================================================
  // Movable Interactive Entities (Plates, Doors, Portals, Relics, Enemies)
  // ==========================================================================

  private createEditorBadge(text: string, bgColor: string, textColor = '#ffffff'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 0.55, 1.0);
    return sprite;
  }

  private createEditorPlateMesh(pairId: string, plateNum: 1 | 2, gx: number, gz: number, pair: PlatePairData): THREE.Group {
    const group = new THREE.Group();
    const groundY = this.level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
    group.position.set(gx * GRID_CELL_SIZE, groundY + 0.04, gz * GRID_CELL_SIZE);

    // Plate base disc
    const discGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(0.75, 0.95, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.05;
    group.add(ring);

    // Vertical beacon pin
    const pinGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.8, 12, 1, true);
    pinGeo.translate(0, 0.9, 0);
    const pinMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    group.add(pin);

    // Badge
    const badge = this.createEditorBadge(`P${plateNum} [${pairId.slice(0, 8)}]`, '#b45309');
    badge.position.set(0, 2.1, 0);
    group.add(badge);

    group.userData = {
      isInteractiveEntity: true,
      entityType: 'plate',
      pairId,
      plateNum,
      pair,
      gx,
      gz,
      entityName: `Nyomólap ${plateNum} (${pairId})`,
    };

    return group;
  }

  private createEditorDoorMesh(pairId: string, gx: number, gz: number, pair: PlatePairData): THREE.Group {
    const group = new THREE.Group();
    const groundY = this.level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
    group.position.set(gx * GRID_CELL_SIZE, groundY + 1.2, gz * GRID_CELL_SIZE);

    // Red obstacle barrier box
    const boxGeo = new THREE.BoxGeometry(GRID_CELL_SIZE * 0.9, 2.4, 0.35);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.75,
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    group.add(box);

    const wireGeo = new THREE.EdgesGeometry(boxGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xfca5a5, depthTest: false });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    group.add(wire);

    // Badge
    const badge = this.createEditorBadge(`🔒 Kapu [${pairId.slice(0, 8)}]`, '#7f1d1d');
    badge.position.set(0, 1.5, 0);
    group.add(badge);

    group.userData = {
      isInteractiveEntity: true,
      entityType: 'door',
      pairId,
      pair,
      gx,
      gz,
      entityName: `Ajtó / Kapu (${pairId})`,
    };

    return group;
  }

  private createEditorSwitchMesh(id: string, gx: number, gz: number, swData?: any): THREE.Group {
    const group = new THREE.Group();
    const groundY = this.level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
    group.position.set(gx * GRID_CELL_SIZE, groundY, gz * GRID_CELL_SIZE);

    const badge = this.createEditorBadge(`🔘 Kapcsoló [${id.slice(0, 8)}]`, '#047857');
    badge.position.set(0, 1.8, 0);
    group.add(badge);

    group.userData = {
      isInteractiveEntity: true,
      entityType: 'switch',
      switchId: id,
      swData,
      gx,
      gz,
      entityName: `🔘 Kapcsoló Gomb (${id})`,
    };

    return group;
  }

  private createEditorPortalMesh(gx: number, gz: number): THREE.Group {
    const group = new THREE.Group();
    const groundY = this.level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
    group.position.set(gx * GRID_CELL_SIZE, groundY + 0.05, gz * GRID_CELL_SIZE);

    // Outer cyan ring
    const ringGeo = new THREE.RingGeometry(0.85, 1.25, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.2,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Inner green disc
    const discGeo = new THREE.CircleGeometry(0.8, 32);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.4,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.01;
    group.add(disc);

    // Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 16, 1, true);
    beaconGeo.translate(0, 1.25, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    group.add(beacon);

    // Badge
    const badge = this.createEditorBadge('🌀 Kijárati Portál', '#0e7490');
    badge.position.set(0, 2.7, 0);
    group.add(badge);

    group.userData = {
      isInteractiveEntity: true,
      entityType: 'portal',
      gx,
      gz,
      entityName: 'Kijárati Portál',
    };

    return group;
  }

  private createEditorRelicMesh(id: string, type: RelicType, gx: number, gz: number, relic: any): THREE.Group {
    const group = new THREE.Group();
    const groundY = this.level.getElevationAt(gx * GRID_CELL_SIZE, gz * GRID_CELL_SIZE);
    group.position.set(gx * GRID_CELL_SIZE, groundY + 0.05, gz * GRID_CELL_SIZE);

    const isMushroom = type === 'mushroom';
    const colorHex = isMushroom ? 0x38bdf8 : 0xf59e0b;

    // Beacon
    const beaconGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 16, 1, true);
    beaconGeo.translate(0, 1.1, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    group.add(beacon);

    // Octahedron marker
    const markerGeo = new THREE.OctahedronGeometry(0.2, 0);
    const markerMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 1.5,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 1.4, 0);
    group.add(marker);

    // Badge
    const badge = this.createEditorBadge(isMushroom ? '🍄 Gomba Relikvia' : '🚬 Spangli Relikvia', isMushroom ? '#0284c7' : '#d97706');
    badge.position.set(0, 2.2, 0);
    group.add(badge);

    group.userData = {
      isInteractiveEntity: true,
      entityType: 'relic',
      relicId: id,
      relicType: type,
      relic,
      gx,
      gz,
      entityName: isMushroom ? '🍄 Gomba Relikvia' : '🚬 Spangli Relikvia',
    };

    return group;
  }

  public refreshEntityPreviews(): void {
    // 1. Clear existing preview meshes
    while (this.entityPreviewGroup.children.length > 0) {
      const child = this.entityPreviewGroup.children[0];
      this.entityPreviewGroup.remove(child);
      child.traverse((c) => {
        if (c instanceof THREE.Mesh || c instanceof THREE.Line) {
          c.geometry?.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => m.dispose());
          } else if (c.material) {
            c.material.dispose();
          }
        }
      });
    }

    const data = this.level.data || campaignManager.getActiveLevel();
    if (!data) return;

    // 2. Pressure Plates & Puzzle Doors
    if (data.platePairs && data.platePairs.length > 0) {
      for (const pair of data.platePairs) {
        // Plate 1
        const p1Mesh = this.createEditorPlateMesh(pair.id, 1, pair.plate1[0], pair.plate1[1], pair);
        this.entityPreviewGroup.add(p1Mesh);

        // Plate 2
        const p2Mesh = this.createEditorPlateMesh(pair.id, 2, pair.plate2[0], pair.plate2[1], pair);
        this.entityPreviewGroup.add(p2Mesh);

        // Target Obstacle / Door
        if (pair.targetObstacle && pair.targetObstacle[0] >= 0 && pair.targetObstacle[1] >= 0) {
          const doorMesh = this.createEditorDoorMesh(pair.id, pair.targetObstacle[0], pair.targetObstacle[1], pair);
          this.entityPreviewGroup.add(doorMesh);

          // Connection guide lines
          const p1Pos = new THREE.Vector3(pair.plate1[0] * GRID_CELL_SIZE, 0.25, pair.plate1[1] * GRID_CELL_SIZE);
          const p2Pos = new THREE.Vector3(pair.plate2[0] * GRID_CELL_SIZE, 0.25, pair.plate2[1] * GRID_CELL_SIZE);
          const doorPos = new THREE.Vector3(pair.targetObstacle[0] * GRID_CELL_SIZE, 0.25, pair.targetObstacle[1] * GRID_CELL_SIZE);

          const lineGeo1 = new THREE.BufferGeometry().setFromPoints([p1Pos, doorPos]);
          const lineMat1 = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.4, gapSize: 0.2, depthTest: false });
          const line1 = new THREE.Line(lineGeo1, lineMat1);
          line1.computeLineDistances();
          this.entityPreviewGroup.add(line1);

          const lineGeo2 = new THREE.BufferGeometry().setFromPoints([p2Pos, doorPos]);
          const lineMat2 = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.4, gapSize: 0.2, depthTest: false });
          const line2 = new THREE.Line(lineGeo2, lineMat2);
          line2.computeLineDistances();
          this.entityPreviewGroup.add(line2);
        }
      }
    }

    // 3. Exit Portal
    if (data.exitPortal && data.exitPortal[0] >= 0 && data.exitPortal[1] >= 0) {
      const portalMesh = this.createEditorPortalMesh(data.exitPortal[0], data.exitPortal[1]);
      this.entityPreviewGroup.add(portalMesh);
    }

    // 4. Relics (from data.relics)
    if (data.relics && data.relics.length > 0) {
      for (const relic of data.relics) {
        const [rx, rz] = relic.position || [relic.x ?? 0, relic.z ?? 0];
        const rType = relic.type || (data.theme === TileTheme.APARTMENT ? 'mushroom' : 'joint');
        const relicMesh = this.createEditorRelicMesh(relic.id || `relic_${rx}_${rz}`, rType, rx, rz, relic);
        this.entityPreviewGroup.add(relicMesh);
      }
    }

    // 5. Enemies (tag meshes in this.level.getEnemies())
    for (const enemy of this.level.getEnemies()) {
      const gx = Math.round(enemy.mesh.position.x / GRID_CELL_SIZE);
      const gz = Math.round(enemy.mesh.position.z / GRID_CELL_SIZE);
      enemy.mesh.userData.isInteractiveEntity = true;
      enemy.mesh.userData.entityType = 'enemy';
      enemy.mesh.userData.enemyInstance = enemy;
      enemy.mesh.userData.gx = gx;
      enemy.mesh.userData.gz = gz;
      enemy.mesh.userData.entityName = `Ellenség: ${enemy.config.type}`;
    }

    // 5.5. Switches & wire connections
    const switchList = [...(data.switches || [])];
    if (data.tiles) {
      for (const t of data.tiles) {
        if (t.id === TileType.SWITCH_BUTTON) {
          if (!switchList.some((s) => s.position[0] === t.x && s.position[1] === t.z)) {
            switchList.push({
              id: `switch_${t.x}_${t.z}`,
              position: [t.x, t.z],
              targetObstacle: t.targetObstacle,
              targetDoorId: t.targetDoorId,
            });
          }
        }
      }
    }

    for (const sw of switchList) {
      const [sx, sz] = sw.position;
      const swMesh = this.createEditorSwitchMesh(sw.id, sx, sz, sw);
      this.entityPreviewGroup.add(swMesh);

      if (sw.targetObstacle && sw.targetObstacle[0] >= 0 && sw.targetObstacle[1] >= 0) {
        const swPos = new THREE.Vector3(sx * GRID_CELL_SIZE, 0.5, sz * GRID_CELL_SIZE);
        const doorPos = new THREE.Vector3(sw.targetObstacle[0] * GRID_CELL_SIZE, 0.5, sw.targetObstacle[1] * GRID_CELL_SIZE);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([swPos, doorPos]);
        const lineMat = new THREE.LineDashedMaterial({ color: 0x10b981, dashSize: 0.4, gapSize: 0.2, depthTest: false });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        this.entityPreviewGroup.add(line);
      }
    }

    // 6. If an entity was selected, re-attach bounding box
    if (this.selectedEntity) {
      this.rebindSelectionBox();
    }
  }

  private selectEntity(obj: THREE.Object3D): void {
    const data = obj.userData;
    if (!data?.isInteractiveEntity) return;

    this.clearSelection();

    this.selectedEntity = {
      type: data.entityType,
      id: data.pairId || data.relicId || data.enemyInstance?.id || `${data.entityType}_${data.gx}_${data.gz}`,
      name: data.entityName || data.entityType,
      gx: data.gx,
      gz: data.gz,
      mesh: obj,
      data,
    };

    // Bright neon wireframe box
    this.selectionBox = new THREE.BoxHelper(obj, 0x10b981);
    const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
    boxMat.color.setHex(0x38bdf8);
    boxMat.depthTest = false;
    boxMat.linewidth = 2;
    this.selectionBox.renderOrder = 9999;
    this.scene.add(this.selectionBox);

    this.updateEntityInfoCard();
  }

  private clearSelection(): void {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.dispose();
      this.selectionBox = null;
    }
    if (this.ghostPreviewMesh) {
      this.scene.remove(this.ghostPreviewMesh);
      this.ghostPreviewMesh = null;
    }
    this.selectedEntity = null;
    if (this.entityInfoCard) {
      this.entityInfoCard.style.display = 'none';
    }
  }

  private rebindSelectionBox(): void {
    if (!this.selectedEntity) return;
    let foundMesh: THREE.Object3D | null = null;

    if (this.selectedEntity.type === 'enemy') {
      const enemy = this.level.getEnemies().find((e) => e === this.selectedEntity!.data?.enemyInstance);
      if (enemy) foundMesh = enemy.mesh;
    } else if (this.selectedEntity.type === 'tile') {
      const gy = this.selectedEntity.data?.gy ?? 0;
      foundMesh = this.level.getMeshAtGrid(this.selectedEntity.gx, this.selectedEntity.gz, gy) || null;
    } else {
      this.entityPreviewGroup.traverse((obj) => {
        if (obj.userData?.isInteractiveEntity) {
          if (
            this.selectedEntity!.type === 'plate' &&
            obj.userData.entityType === 'plate' &&
            obj.userData.pairId === this.selectedEntity!.data.pairId &&
            obj.userData.plateNum === this.selectedEntity!.data.plateNum
          ) {
            foundMesh = obj;
          } else if (
            this.selectedEntity!.type === 'door' &&
            obj.userData.entityType === 'door' &&
            obj.userData.pairId === this.selectedEntity!.data.pairId
          ) {
            foundMesh = obj;
          } else if (
            this.selectedEntity!.type === 'portal' &&
            obj.userData.entityType === 'portal'
          ) {
            foundMesh = obj;
          } else if (
            this.selectedEntity!.type === 'relic' &&
            obj.userData.entityType === 'relic' &&
            obj.userData.relicId === this.selectedEntity!.id
          ) {
            foundMesh = obj;
          } else if (
            this.selectedEntity!.type === 'switch' &&
            obj.userData.entityType === 'switch' &&
            (obj.userData.switchId === this.selectedEntity!.id ||
              (obj.userData.gx === this.selectedEntity!.gx && obj.userData.gz === this.selectedEntity!.gz))
          ) {
            foundMesh = obj;
          }
        }
      });
    }

    if (foundMesh) {
      this.selectedEntity.mesh = foundMesh;
      if (this.selectionBox) {
        this.scene.remove(this.selectionBox);
        this.selectionBox.dispose();
      }
      this.selectionBox = new THREE.BoxHelper(foundMesh, 0x10b981);
      const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
      boxMat.color.setHex(0x38bdf8);
      boxMat.depthTest = false;
      boxMat.linewidth = 2;
      this.selectionBox.renderOrder = 9999;
      this.scene.add(this.selectionBox);
    } else {
      this.clearSelection();
    }
  }

  private selectTileEntity(obj: THREE.Object3D): void {
    const tileId = obj.userData?.tileId ?? obj.userData?.tileData?.id;
    if (tileId === undefined) return;

    this.clearSelection();

    const tileOpt = TILE_OPTIONS.find((t) => t.type === tileId);
    const tileName = tileOpt ? tileOpt.name : `Elem #${tileId}`;
    const gx = obj.userData.gx ?? obj.userData?.tileData?.x ?? 0;
    const gy = obj.userData.gy ?? obj.userData?.tileData?.y ?? 0;
    const gz = obj.userData.gz ?? obj.userData?.tileData?.z ?? 0;
    const layer: LayerType = obj.userData.layer ?? getLayerForTileType(tileId);

    this.selectedEntity = {
      type: 'tile',
      id: `tile_${gx}_${gy}_${gz}_${layer}`,
      name: `${tileName} [${layer}]`,
      gx,
      gz,
      mesh: obj,
      data: {
        tileId,
        layer,
        gx,
        gy,
        gz,
        tileData: obj.userData?.tileData,
      },
    };

    this.selectionBox = new THREE.BoxHelper(obj, 0x38bdf8);
    const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
    boxMat.color.setHex(0x38bdf8);
    boxMat.depthTest = false;
    boxMat.linewidth = 2;
    this.selectionBox.renderOrder = 9999;
    this.scene.add(this.selectionBox);

    this.updateEntityInfoCard();
  }

  private rotateSelectedEntity(): void {
    if (!this.selectedEntity) return;

    if (this.selectedEntity.type === 'tile') {
      const tileId = this.selectedEntity.data?.tileId ?? this.selectedEntity.data?.tileData?.id;
      const layer: LayerType = this.selectedEntity.data?.layer ?? getLayerForTileType(tileId);
      const gx = this.selectedEntity.gx;
      const gz = this.selectedEntity.gz;
      const gy = this.selectedEntity.data?.gy ?? 0;

      const cell = this.level.getCell(gx, gz, gy);
      let curRotDeg = 0;
      if (cell) {
        if (layer === 'prop') curRotDeg = cell.propRotation ?? cell.rotation ?? 0;
        else if (layer === 'wall') curRotDeg = cell.wallRotation ?? cell.rotation ?? 0;
        else if (layer === 'wallDecor') curRotDeg = cell.wallDecorRotation ?? cell.rotation ?? 0;
        else if (layer === 'floorDecor') curRotDeg = cell.floorDecorRotation ?? cell.rotation ?? 0;
        else if (layer === 'floor') curRotDeg = cell.floorRotation ?? 0;
      } else if (this.selectedEntity.data?.tileData) {
        const td = this.selectedEntity.data.tileData;
        curRotDeg = td.rotation !== undefined ? td.rotation : Math.round((td.rotationY ?? 0) * (180 / Math.PI));
      }

      const newRotDeg = (curRotDeg + 90) % 360;
      const prevCell = this.captureCellState(gx, gz, gy);

      this.level.setCellLayer(gx, gz, layer, tileId, newRotDeg, gy);
      const newMesh = this.level.getLayerMesh(gx, gz, layer, gy);
      if (newMesh) {
        this.selectedEntity.mesh = newMesh;
        if (this.selectionBox) {
          this.scene.remove(this.selectionBox);
          this.selectionBox = new THREE.BoxHelper(newMesh, 0x38bdf8);
          const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
          boxMat.color.setHex(0x38bdf8);
          boxMat.depthTest = false;
          boxMat.linewidth = 2;
          this.selectionBox.renderOrder = 9999;
          this.scene.add(this.selectionBox);
        }
      }

      const nextCell = this.captureCellState(gx, gz, gy);
      this.undoRedo.push({
        name: `Elem forgatása: ${newRotDeg}°`,
        undo: () => {
          this.restoreCellState(gx, gz, gy, prevCell);
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.restoreCellState(gx, gz, gy, nextCell);
          this.saveToLocalStorage(false);
        },
      });

      this.updateEntityInfoCard();
      this.saveToLocalStorage(false);
      this.saveCurrentLevelToCampaign();
    } else if (this.selectedEntity.type === 'enemy') {
      const enemy = this.selectedEntity.data?.enemyInstance as Enemy;
      if (enemy) {
        const prevAngle = enemy.facingAngle;
        const nextAngle = (prevAngle + Math.PI / 2) % (Math.PI * 2);
        this.undoRedo.push({
          name: 'Ellenség elforgatása',
          undo: () => {
            enemy.facingAngle = prevAngle;
            enemy.mesh.rotation.y = prevAngle;
            if (this.selectionBox) this.selectionBox.update();
            this.saveToLocalStorage(false);
          },
          redo: () => {
            enemy.facingAngle = nextAngle;
            enemy.mesh.rotation.y = nextAngle;
            if (this.selectionBox) this.selectionBox.update();
            this.saveToLocalStorage(false);
          },
        });
        enemy.facingAngle = nextAngle;
        enemy.mesh.rotation.y = enemy.facingAngle;
        if (this.selectionBox) this.selectionBox.update();
        this.saveToLocalStorage(false);
        this.saveCurrentLevelToCampaign();
      }
    }
  }

  private handleMoveToolDown(): void {
    this.updateGridCursor();
    if (!this.currentGridPos) return;

    const targetGx = this.currentGridPos.gx;
    const targetGz = this.currentGridPos.gz;

    // 1. If an entity is ALREADY picked up / selected:
    if (this.selectedEntity) {
      const isDifferentCell = targetGx !== this.selectedEntity.gx || targetGz !== this.selectedEntity.gz;

      if (isDifferentCell) {
        // Check if the user specifically clicked on ANOTHER interactive entity or non-floor prop
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const candidates: THREE.Object3D[] = [
          ...this.entityPreviewGroup.children,
          ...this.level.getEnemies().map((e) => e.mesh),
          ...this.level.group.children,
        ];
        for (const rm of this.level.relicMeshes) candidates.push(rm.mesh);

        const hits = this.raycaster.intersectObjects(candidates, true);
        let distinctNonFloorEntity: THREE.Object3D | null = null;
        for (const hit of hits) {
          let cur: THREE.Object3D | null = hit.object;
          while (cur && cur !== this.scene) {
            if (cur.userData?.isInteractiveEntity) {
              distinctNonFloorEntity = cur;
              break;
            }
            if (cur.userData?.isTileMesh && cur.userData?.layer !== 'floor' && !cur.userData?.isFloor) {
              distinctNonFloorEntity = cur;
              break;
            }
            cur = cur.parent;
          }
          if (distinctNonFloorEntity) break;
        }

        // If not clicking a different furniture/entity, this is a placement drop onto the cell!
        if (!distinctNonFloorEntity || distinctNonFloorEntity === this.selectedEntity.mesh) {
          this.relocateSelectedEntity(targetGx, targetGz);
          AudioManager.getInstance().playSwitchClick();
          if (this.ghostPreviewMesh) {
            this.scene.remove(this.ghostPreviewMesh);
            this.ghostPreviewMesh = null;
          }
          return;
        }
      }
    }

    // 2. Pick up an entity under the cursor:
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates: THREE.Object3D[] = [
      ...this.entityPreviewGroup.children,
      ...this.level.getEnemies().map((e) => e.mesh),
      ...this.level.group.children,
    ];
    for (const rm of this.level.relicMeshes) candidates.push(rm.mesh);

    const hits = this.raycaster.intersectObjects(candidates, true);
    if (hits.length > 0) {
      let entityObj: THREE.Object3D | null = null;
      let isTile = false;

      // Prefer non-floor entities first (furniture, props, walls, decor, interactive entities, enemies)
      for (const hit of hits) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== this.scene) {
          if (cur.userData?.isInteractiveEntity) {
            entityObj = cur;
            isTile = false;
            break;
          }
          if (cur.userData?.isTileMesh && cur.userData?.layer !== 'floor' && !cur.userData?.isFloor) {
            entityObj = cur;
            isTile = true;
            break;
          }
          cur = cur.parent;
        }
        if (entityObj) break;
      }

      // Fallback: if no prop/wall/entity was hit, allow picking up floor tile
      if (!entityObj) {
        for (const hit of hits) {
          let cur: THREE.Object3D | null = hit.object;
          while (cur && cur !== this.scene) {
            if (cur.userData?.isTileMesh) {
              entityObj = cur;
              isTile = true;
              break;
            }
            cur = cur.parent;
          }
          if (entityObj) break;
        }
      }

      if (entityObj) {
        if (isTile) {
          this.selectTileEntity(entityObj);
        } else {
          this.selectEntity(entityObj);
        }

        if (this.selectedEntity) {
          this.isDraggingEntity = true;
          this.dragEntityStartGrid = { gx: this.selectedEntity.gx, gz: this.selectedEntity.gz };
          this.canvas.style.cursor = 'grabbing';
          this.updateGhostPreview();
        }
        return;
      }
    }

    // 3. Fallback: if an entity was selected and we clicked empty ground:
    if (this.selectedEntity && this.currentGridPos) {
      this.relocateSelectedEntity(this.currentGridPos.gx, this.currentGridPos.gz);
      if (this.ghostPreviewMesh) {
        this.scene.remove(this.ghostPreviewMesh);
        this.ghostPreviewMesh = null;
      }
    }
  }

  private handleWireToolClick(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates: THREE.Object3D[] = [
      ...this.entityPreviewGroup.children,
      ...this.level.group.children,
    ];
    const hits = this.raycaster.intersectObjects(candidates, true);

    let clickedEntity: THREE.Object3D | null = null;
    let clickedDoorGx = -1;
    let clickedDoorGz = -1;

    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur && cur !== this.scene) {
        if (cur.userData?.isInteractiveEntity) {
          clickedEntity = cur;
          break;
        }
        if (cur.userData?.doorType !== undefined) {
          clickedDoorGx = Math.round(cur.position.x / GRID_CELL_SIZE);
          clickedDoorGz = Math.round(cur.position.z / GRID_CELL_SIZE);
          break;
        }
        cur = cur.parent;
      }
      if (clickedEntity || clickedDoorGx !== -1) break;
    }

    let targetGx = clickedEntity?.userData?.gx ?? (clickedDoorGx !== -1 ? clickedDoorGx : (this.currentGridPos ? this.currentGridPos.gx : -1));
    let targetGz = clickedEntity?.userData?.gz ?? (clickedDoorGz !== -1 ? clickedDoorGz : (this.currentGridPos ? this.currentGridPos.gz : -1));

    if (targetGx === -1 || targetGz === -1) return;

    const tileAtGrid =
      this.level.getTileAtGrid(targetGx, targetGz, this.currentElevationY) ||
      this.level.getTileAtGrid(targetGx, targetGz, 0);

    const isSwitchTile = tileAtGrid?.id === TileType.SWITCH_BUTTON;
    const isSwitchEntity = clickedEntity?.userData?.entityType === 'switch';
    const isPlateEntity = clickedEntity?.userData?.entityType === 'plate';

    // STEP 1: If no wire source is selected yet, pick switch or plate
    if (!this.wireSourceEntity) {
      if (isSwitchEntity || isSwitchTile || isPlateEntity) {
        const entityType = isPlateEntity ? 'plate' : 'switch';
        const id =
          clickedEntity?.userData?.switchId ||
          clickedEntity?.userData?.pairId ||
          `switch_${targetGx}_${targetGz}`;
        const name = isPlateEntity
          ? `Nyomólap [${clickedEntity?.userData?.pairId?.slice(0, 8) || ''}]`
          : `🔘 Kapcsoló (${targetGx}, ${targetGz})`;

        this.wireSourceEntity = {
          type: entityType,
          id,
          name,
          gx: targetGx,
          gz: targetGz,
          mesh: clickedEntity || this.cursorMesh,
          data: clickedEntity?.userData || { gx: targetGx, gz: targetGz },
        };

        if (this.selectionBox) {
          this.scene.remove(this.selectionBox);
          this.selectionBox.dispose();
        }
        if (clickedEntity) {
          this.selectionBox = new THREE.BoxHelper(clickedEntity, 0xa855f7);
          const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
          boxMat.depthTest = false;
          boxMat.linewidth = 2;
          this.selectionBox.renderOrder = 9999;
          this.scene.add(this.selectionBox);
        }

        if (this.guideEl) {
          this.guideEl.innerHTML = `
            🔗 <b>Forrás kiválasztva:</b> <span style="color:#34d399;">${name}</span><br>
            👉 <b>2. Kattintás:</b> Kattints a cél <b>Ajtóra</b> a huzal bekötéséhez!
          `;
        }
        AudioManager.getInstance().playSwitchClick();
      } else {
        if (this.guideEl) {
          this.guideEl.innerHTML = `
            ⚠️ <b>Nincs forrás kijelölve!</b><br>
            Kattints először egy <b>Kapcsoló gombra</b> vagy <b>Nyomólapra</b>!
          `;
        }
      }
      return;
    }

    // STEP 2: Wire source is selected. Check if clicked target is a Door.
    const isDoorEntity = clickedEntity?.userData?.entityType === 'door';
    const isDoorTile =
      tileAtGrid !== undefined &&
      (tileAtGrid.id === TileType.DOOR_APARTMENT ||
        tileAtGrid.id === TileType.DOOR_STORE ||
        tileAtGrid.id === TileType.DOOR_METRO ||
        tileAtGrid.id === TileType.DOOR_SUBURBAN_GATE ||
        tileAtGrid.id === TileType.DOOR_SOPELANA_IRON);

    const levelData = this.level.data || campaignManager.getActiveLevel();
    const hasObstaclePair = levelData?.platePairs?.some(
      (p) => p.targetObstacle && p.targetObstacle[0] === targetGx && p.targetObstacle[1] === targetGz
    );

    if (isDoorEntity || isDoorTile || hasObstaclePair || clickedDoorGx !== -1) {
      const doorPairId = clickedEntity?.userData?.pairId;

      if (this.wireSourceEntity.type === 'switch') {
        if (levelData) {
          if (!levelData.switches) levelData.switches = [];
          let sw = levelData.switches.find(
            (s) =>
              s.id === this.wireSourceEntity!.id ||
              (s.position[0] === this.wireSourceEntity!.gx && s.position[1] === this.wireSourceEntity!.gz)
          );
          if (!sw) {
            sw = {
              id: this.wireSourceEntity.id,
              position: [this.wireSourceEntity.gx, this.wireSourceEntity.gz],
            };
            levelData.switches.push(sw);
          }
          sw.targetObstacle = [targetGx, targetGz];
          if (doorPairId) sw.targetDoorId = doorPairId;

          const swTile =
            this.level.getTileAtGrid(this.wireSourceEntity.gx, this.wireSourceEntity.gz, this.currentElevationY) ||
            this.level.getTileAtGrid(this.wireSourceEntity.gx, this.wireSourceEntity.gz, 0);
          if (swTile) {
            swTile.targetObstacle = [targetGx, targetGz];
            if (doorPairId) swTile.targetDoorId = doorPairId;
          }
        }
      } else if (this.wireSourceEntity.type === 'plate') {
        const pairId = this.wireSourceEntity.data?.pairId;
        if (pairId) {
          this.level.updateObstaclePosition(pairId, targetGx, targetGz);
        }
      }

      AudioManager.getInstance().playSwitchClick();
      const srcName = this.wireSourceEntity.name;

      this.clearSelection();
      this.wireSourceEntity = null;

      this.refreshEntityPreviews();
      this.saveToLocalStorage(false);
      this.saveCurrentLevelToCampaign();

      if (this.guideEl) {
        this.guideEl.innerHTML = `
          ✅ <b>Sikeres huzalozás!</b><br>
          ${srcName} összekötve az ajtóval: (${targetGx}, ${targetGz}).
        `;
      }
      return;
    }

    // If user clicked another switch or plate, switch selection to that
    if (isSwitchEntity || isSwitchTile || isPlateEntity) {
      this.wireSourceEntity = null;
      this.handleWireToolClick();
      return;
    }

    // Otherwise cancel wiring
    this.clearSelection();
    this.wireSourceEntity = null;
    if (this.guideEl) {
      this.guideEl.innerHTML = `
        ℹ️ Huzalozás megszakítva.<br>
        Kattints egy kapcsolóra vagy nyomólapra az újrakezdéshez.
      `;
    }
  }

  private relocateSelectedEntity(gx: number, gz: number): void {
    if (!this.selectedEntity) return;
    if (gx === this.selectedEntity.gx && gz === this.selectedEntity.gz) return;

    const oldGx = this.selectedEntity.gx;
    const oldGz = this.selectedEntity.gz;
    const isClone = this.isAltCloning && this.selectedEntity.type === 'tile';

    if (this.selectedEntity.type === 'plate') {
      const pairId = this.selectedEntity.data.pairId;
      const plateNum = this.selectedEntity.data.plateNum;
      this.undoRedo.push({
        name: `Nyomólap mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          this.level.updatePlatePosition(pairId, plateNum, oldGx, oldGz);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.updatePlatePosition(pairId, plateNum, gx, gz);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.updatePlatePosition(pairId, plateNum, gx, gz);
      this.notifyHistoryToast(`✋ Nyomólap áthelyezve: (${gx}, ${gz})`);
    } else if (this.selectedEntity.type === 'door') {
      const pairId = this.selectedEntity.data.pairId;
      this.undoRedo.push({
        name: `Ajtó mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          this.level.updateObstaclePosition(pairId, oldGx, oldGz);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.updateObstaclePosition(pairId, gx, gz);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.updateObstaclePosition(pairId, gx, gz);
      this.notifyHistoryToast(`🚪 Ajtó áthelyezve: (${gx}, ${gz})`);
    } else if (this.selectedEntity.type === 'portal') {
      this.undoRedo.push({
        name: `Portál mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          this.level.setExitPortal([oldGx, oldGz]);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.setExitPortal([gx, gz]);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.setExitPortal([gx, gz]);
      this.notifyHistoryToast(`🌀 Portál áthelyezve: (${gx}, ${gz})`);
    } else if (this.selectedEntity.type === 'relic') {
      const relicId = this.selectedEntity.id;
      const prevTileOld = this.captureCellState(oldGx, oldGz, this.currentElevationY);
      const prevTileNew = this.captureCellState(gx, gz, this.currentElevationY);
      this.level.updateRelicPosition(relicId, gx, gz);
      const existingTile = this.level.getTileAtGrid(oldGx, oldGz, this.currentElevationY);
      if (existingTile && (existingTile.id === TileType.RELIC_MUSHROOM || existingTile.id === TileType.RELIC_JOINT)) {
        const tileType = existingTile.id;
        this.level.removeTile(oldGx, oldGz, this.currentElevationY);
        this.level.setTile(gx, gz, tileType, false, this.currentElevationY);
      }
      const nextTileOld = this.captureCellState(oldGx, oldGz, this.currentElevationY);
      const nextTileNew = this.captureCellState(gx, gz, this.currentElevationY);
      this.undoRedo.push({
        name: `Relikvia mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          this.level.updateRelicPosition(relicId, oldGx, oldGz);
          this.restoreCellState(oldGx, oldGz, this.currentElevationY, prevTileOld);
          this.restoreCellState(gx, gz, this.currentElevationY, prevTileNew);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.updateRelicPosition(relicId, gx, gz);
          this.restoreCellState(oldGx, oldGz, this.currentElevationY, nextTileOld);
          this.restoreCellState(gx, gz, this.currentElevationY, nextTileNew);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.notifyHistoryToast(`🍄 Relikvia áthelyezve: (${gx}, ${gz})`);
    } else if (this.selectedEntity.type === 'switch') {
      const switchId = this.selectedEntity.id;
      const data = this.level.data || campaignManager.getActiveLevel();
      const prevTileOld = this.captureCellState(oldGx, oldGz, this.currentElevationY);
      const prevTileNew = this.captureCellState(gx, gz, this.currentElevationY);
      if (data?.switches) {
        const sw = data.switches.find(
          (s) => s.id === switchId || (s.position[0] === oldGx && s.position[1] === oldGz)
        );
        if (sw) {
          sw.position = [gx, gz];
        }
      }
      const existingTile =
        this.level.getTileAtGrid(oldGx, oldGz, this.currentElevationY) ||
        this.level.getTileAtGrid(oldGx, oldGz, 0);
      if (existingTile && existingTile.id === TileType.SWITCH_BUTTON) {
        const targetObstacle = existingTile.targetObstacle;
        const targetDoorId = existingTile.targetDoorId;
        this.level.removeTile(oldGx, oldGz, existingTile.y ?? this.currentElevationY);
        this.level.setTile(gx, gz, TileType.SWITCH_BUTTON, false, this.currentElevationY);
        const newTile = this.level.getTileAtGrid(gx, gz, this.currentElevationY);
        if (newTile) {
          newTile.targetObstacle = targetObstacle;
          newTile.targetDoorId = targetDoorId;
        }
      }
      const nextTileOld = this.captureCellState(oldGx, oldGz, this.currentElevationY);
      const nextTileNew = this.captureCellState(gx, gz, this.currentElevationY);
      this.undoRedo.push({
        name: `Kapcsoló mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          if (data?.switches) {
            const sw = data.switches.find(
              (s) => s.id === switchId || (s.position[0] === gx && s.position[1] === gz)
            );
            if (sw) sw.position = [oldGx, oldGz];
          }
          this.restoreCellState(oldGx, oldGz, this.currentElevationY, prevTileOld);
          this.restoreCellState(gx, gz, this.currentElevationY, prevTileNew);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          if (data?.switches) {
            const sw = data.switches.find(
              (s) => s.id === switchId || (s.position[0] === oldGx && s.position[1] === oldGz)
            );
            if (sw) sw.position = [gx, gz];
          }
          this.restoreCellState(oldGx, oldGz, this.currentElevationY, nextTileOld);
          this.restoreCellState(gx, gz, this.currentElevationY, nextTileNew);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.notifyHistoryToast(`🔘 Kapcsoló áthelyezve: (${gx}, ${gz})`);
    } else if (this.selectedEntity.type === 'tile') {
      const tileId = this.selectedEntity.data.tileId ?? this.selectedEntity.data.tileData?.id;
      const layer: LayerType = this.selectedEntity.data.layer ?? getLayerForTileType(tileId);
      const gy = this.selectedEntity.data.gy ?? 0;
      const oldCell = this.level.getCell(oldGx, oldGz, gy);
      const rotDeg =
        layer === 'prop' ? (oldCell?.propRotation ?? oldCell?.rotation ?? 0) :
        layer === 'wall' ? (oldCell?.wallRotation ?? oldCell?.rotation ?? 0) :
        layer === 'wallDecor' ? (oldCell?.wallDecorRotation ?? oldCell?.rotation ?? 0) :
        layer === 'floorDecor' ? (oldCell?.floorDecorRotation ?? oldCell?.rotation ?? 0) :
        (oldCell?.floorRotation ?? 0);

      const prevOldCell = this.captureCellState(oldGx, oldGz, gy);
      const prevTargetCell = this.captureCellState(gx, gz, gy);

      if (!isClone) {
        // Remove just this layer from old cell
        this.level.removeCellLayer(oldGx, oldGz, layer, gy);
      }

      // In target cell, if placing prop/wall/decor on empty space, ensure base floor exists
      const targetCell = this.level.getCell(gx, gz, gy);
      if ((!targetCell || !targetCell.floor) && layer !== 'floor') {
        const defFloor = this.level.getDefaultFloorForTheme();
        this.level.setCellLayer(gx, gz, 'floor', defFloor, 0, gy);
      }

      // Set layer at target
      this.level.setCellLayer(gx, gz, layer, tileId, rotDeg, gy);

      const nextOldCell = this.captureCellState(oldGx, oldGz, gy);
      const nextTargetCell = this.captureCellState(gx, gz, gy);

      if (isClone) {
        this.undoRedo.push({
          name: `Elem klónozása: (${gx}, ${gz})`,
          undo: () => {
            this.restoreCellState(gx, gz, gy, prevTargetCell);
            this.saveToLocalStorage(false);
          },
          redo: () => {
            this.restoreCellState(gx, gz, gy, nextTargetCell);
            this.saveToLocalStorage(false);
          },
        });
        this.notifyHistoryToast(`📋 Elem klónozva: (${gx}, ${gz})`);
      } else {
        this.undoRedo.push({
          name: `Elem mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
          undo: () => {
            this.restoreCellState(oldGx, oldGz, gy, prevOldCell);
            this.restoreCellState(gx, gz, gy, prevTargetCell);
            this.saveToLocalStorage(false);
          },
          redo: () => {
            this.restoreCellState(oldGx, oldGz, gy, nextOldCell);
            this.restoreCellState(gx, gz, gy, nextTargetCell);
            this.saveToLocalStorage(false);
          },
        });
        this.notifyHistoryToast(`✋ Elem mozgatva: (${gx}, ${gz})`);
      }

      const newMesh = this.level.getLayerMesh(gx, gz, layer, gy);
      if (newMesh) {
        this.selectedEntity.mesh = newMesh;
        this.selectedEntity.gx = gx;
        this.selectedEntity.gz = gz;
        this.selectedEntity.data.gx = gx;
        this.selectedEntity.data.gz = gz;
        if (this.selectionBox) {
          this.scene.remove(this.selectionBox);
          this.selectionBox = new THREE.BoxHelper(newMesh, 0x38bdf8);
          const boxMat = this.selectionBox.material as THREE.LineBasicMaterial;
          boxMat.color.setHex(0x38bdf8);
          boxMat.depthTest = false;
          boxMat.linewidth = 2;
          this.selectionBox.renderOrder = 9999;
          this.scene.add(this.selectionBox);
        }
      }
    } else if (this.selectedEntity.type === 'enemy') {
      const enemy = this.selectedEntity.data.enemyInstance as Enemy;
      const oldWx = oldGx * GRID_CELL_SIZE;
      const oldWz = oldGz * GRID_CELL_SIZE;
      const oldWy = this.level.getElevationAt(oldWx, oldWz);
      const wx = gx * GRID_CELL_SIZE;
      const wz = gz * GRID_CELL_SIZE;
      const wy = this.level.getElevationAt(wx, wz);

      this.undoRedo.push({
        name: `Ellenség mozgatása: (${oldGx}, ${oldGz}) ➔ (${gx}, ${gz})`,
        undo: () => {
          enemy.mesh.position.set(oldWx, oldWy, oldWz);
          enemy.config.spawnPos = [oldWx, oldWy, oldWz];
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          enemy.mesh.position.set(wx, wy, wz);
          enemy.config.spawnPos = [wx, wy, wz];
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });

      enemy.mesh.position.set(wx, wy, wz);
      enemy.config.spawnPos = [wx, wy, wz];
      this.notifyHistoryToast(`👾 Ellenség áthelyezve: (${gx}, ${gz})`);
    }

    if (this.ghostPreviewMesh) {
      this.scene.remove(this.ghostPreviewMesh);
      this.ghostPreviewMesh = null;
    }

    this.selectedEntity.gx = gx;
    this.selectedEntity.gz = gz;
    this.isAltCloning = false;

    this.refreshEntityPreviews();
    this.updateEntityInfoCard();
    this.saveToLocalStorage(false);
    this.saveCurrentLevelToCampaign();
  }

  private deleteSelectedEntity(): void {
    if (!this.selectedEntity) return;

    if (this.selectedEntity.type === 'plate') {
      const pairId = this.selectedEntity.data.pairId;
      const pairData = (this.level.data?.platePairs || []).find((p) => p.id === pairId);
      if (pairData) {
        const clonedPair = JSON.parse(JSON.stringify(pairData));
        this.undoRedo.push({
          name: `Nyomólappár törlése: ${pairId}`,
          undo: () => {
            if (!this.level.data) return;
            if (!this.level.data.platePairs) this.level.data.platePairs = [];
            this.level.data.platePairs.push(clonedPair);
            this.refreshEntityPreviews();
            this.saveToLocalStorage(false);
          },
          redo: () => {
            this.level.removePlatePair(pairId);
            this.refreshEntityPreviews();
            this.saveToLocalStorage(false);
          },
        });
      }
      this.level.removePlatePair(this.selectedEntity.data.pairId);
      this.notifyHistoryToast('🗑️ Nyomólap törölve');
    } else if (this.selectedEntity.type === 'door') {
      const pairId = this.selectedEntity.data.pairId;
      const oldTarget = this.selectedEntity.data?.pair?.targetObstacle
        ? [...this.selectedEntity.data.pair.targetObstacle]
        : [this.selectedEntity.gx, this.selectedEntity.gz];
      this.undoRedo.push({
        name: `Ajtó törlése: ${pairId}`,
        undo: () => {
          this.level.updateObstaclePosition(pairId, oldTarget[0], oldTarget[1]);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.updateObstaclePosition(pairId, -999, -999);
          if (this.selectedEntity?.data?.pair) {
            this.selectedEntity.data.pair.targetObstacle = undefined;
          }
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.updateObstaclePosition(this.selectedEntity.data.pairId, -999, -999);
      if (this.selectedEntity.data?.pair) {
        this.selectedEntity.data.pair.targetObstacle = undefined;
      }
      this.notifyHistoryToast('🗑️ Ajtó törölve');
    } else if (this.selectedEntity.type === 'portal') {
      const oldPortal = [this.selectedEntity.gx, this.selectedEntity.gz] as [number, number];
      this.undoRedo.push({
        name: 'Portál törlése',
        undo: () => {
          this.level.setExitPortal(oldPortal);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.setExitPortal(undefined);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.setExitPortal(undefined);
      this.notifyHistoryToast('🗑️ Portál törölve');
    } else if (this.selectedEntity.type === 'relic') {
      const relicId = this.selectedEntity.id;
      const rGx = this.selectedEntity.gx;
      const rGz = this.selectedEntity.gz;
      const relicData = (this.level.data?.relics || []).find((r) => r.id === relicId || (r.x === rGx && r.z === rGz));
      const clonedRelic = relicData ? JSON.parse(JSON.stringify(relicData)) : null;
      const prevTile = this.captureCellState(rGx, rGz, this.currentElevationY);
      this.undoRedo.push({
        name: `Relikvia törlése: ${relicId}`,
        undo: () => {
          if (clonedRelic) {
            this.level.addRelic(clonedRelic);
          }
          this.restoreCellState(rGx, rGz, this.currentElevationY, prevTile);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.removeRelicById(relicId);
          this.level.removeRelicAt(rGx, rGz);
          this.level.removeTile(rGx, rGz, this.currentElevationY);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.removeRelicById(this.selectedEntity.id);
      this.level.removeRelicAt(this.selectedEntity.gx, this.selectedEntity.gz);
      this.level.removeTile(this.selectedEntity.gx, this.selectedEntity.gz, this.currentElevationY);
      this.notifyHistoryToast('🗑️ Relikvia törölve');
    } else if (this.selectedEntity.type === 'switch') {
      const switchId = this.selectedEntity.id;
      const sGx = this.selectedEntity.gx;
      const sGz = this.selectedEntity.gz;
      const data = this.level.data || campaignManager.getActiveLevel();
      const existingSw = data?.switches?.find((s) => s.id === switchId || (s.position[0] === sGx && s.position[1] === sGz));
      const clonedSw = existingSw ? JSON.parse(JSON.stringify(existingSw)) : null;
      const prevTileElev = this.captureCellState(sGx, sGz, this.currentElevationY);
      const prevTile0 = this.captureCellState(sGx, sGz, 0);
      this.undoRedo.push({
        name: `Kapcsoló törlése: ${switchId}`,
        undo: () => {
          if (clonedSw && data?.switches) {
            data.switches.push(clonedSw);
          }
          this.restoreCellState(sGx, sGz, this.currentElevationY, prevTileElev);
          this.restoreCellState(sGx, sGz, 0, prevTile0);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          if (data?.switches) {
            const idx = data.switches.findIndex(
              (s) => s.id === switchId || (s.position[0] === sGx && s.position[1] === sGz)
            );
            if (idx !== -1) data.switches.splice(idx, 1);
          }
          this.level.removeTile(sGx, sGz, this.currentElevationY);
          this.level.removeTile(sGx, sGz, 0);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      if (data?.switches) {
        const idx = data.switches.findIndex(
          (s) => s.id === switchId || (s.position[0] === this.selectedEntity!.gx && s.position[1] === this.selectedEntity!.gz)
        );
        if (idx !== -1) {
          data.switches.splice(idx, 1);
        }
      }
      this.level.removeTile(this.selectedEntity.gx, this.selectedEntity.gz, this.currentElevationY);
      this.level.removeTile(this.selectedEntity.gx, this.selectedEntity.gz, 0);
      this.notifyHistoryToast('🗑️ Kapcsoló törölve');
    } else if (this.selectedEntity.type === 'tile') {
      const gy = this.selectedEntity.data?.gy ?? 0;
      const tGx = this.selectedEntity.gx;
      const tGz = this.selectedEntity.gz;
      const prevCell = this.captureCellState(tGx, tGz, gy);
      this.undoRedo.push({
        name: `Elem törlése: (${tGx}, ${tGz})`,
        undo: () => {
          this.restoreCellState(tGx, tGz, gy, prevCell);
          this.saveToLocalStorage(false);
        },
        redo: () => {
          this.level.removeTile(tGx, tGz, gy);
          this.saveToLocalStorage(false);
        },
      });
      this.level.removeTile(this.selectedEntity.gx, this.selectedEntity.gz, gy);
      this.notifyHistoryToast('🗑️ Elem törölve');
    } else if (this.selectedEntity.type === 'enemy') {
      const enemy = this.selectedEntity.data.enemyInstance as Enemy;
      const cfg = { ...enemy.config };
      this.undoRedo.push({
        name: `Ellenség törlése: ${cfg.type}`,
        undo: () => {
          this.level.addEnemy(cfg);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
        redo: () => {
          const cur = this.level.getEnemies().find((e) => Math.hypot(e.mesh.position.x - cfg.spawnPos[0], e.mesh.position.z - cfg.spawnPos[2]) < 1.0);
          if (cur) this.level.removeEnemy(cur);
          this.refreshEntityPreviews();
          this.saveToLocalStorage(false);
        },
      });
      this.level.removeEnemy(this.selectedEntity.data.enemyInstance);
      this.notifyHistoryToast('🗑️ Ellenség törölve');
    }

    this.clearSelection();
    this.refreshEntityPreviews();
    this.saveToLocalStorage(false);
    this.saveCurrentLevelToCampaign();
  }

  private updateEntityInfoCard(): void {
    if (!this.entityInfoCard) return;
    if (!this.selectedEntity) {
      this.entityInfoCard.style.display = 'none';
      return;
    }

    const e = this.selectedEntity;
    let extraInfo = '';
    if (e.type === 'plate') {
      const pair = e.data?.pair as PlatePairData | undefined;
      const doorCoord = pair?.targetObstacle ? `(${pair.targetObstacle[0]}, ${pair.targetObstacle[1]})` : 'Nincs';
      extraInfo = `Kapcsolt ajtó: <b style="color:#f59e0b;">${doorCoord}</b>`;
    } else if (e.type === 'door') {
      const pair = e.data?.pair as PlatePairData | undefined;
      const p1 = pair?.plate1 ? `(${pair.plate1[0]}, ${pair.plate1[1]})` : '?';
      const p2 = pair?.plate2 ? `(${pair.plate2[0]}, ${pair.plate2[1]})` : '?';
      extraInfo = `Lapok: <b style="color:#f59e0b;">P1: ${p1}, P2: ${p2}</b>`;
    } else if (e.type === 'switch') {
      const swData = e.data?.swData as SwitchButtonData | undefined;
      const doorCoord = swData?.targetObstacle ? `(${swData.targetObstacle[0]}, ${swData.targetObstacle[1]})` : 'Nincs bekötve';
      extraInfo = `Kapcsolt ajtó: <b style="color:#10b981;">${doorCoord}</b>`;
    } else if (e.type === 'tile') {
      const tileData = e.data?.tileData;
      const rot = tileData?.rotation !== undefined ? tileData.rotation : Math.round(((tileData?.rotationY ?? 0) * 180) / Math.PI);
      const isSolid = tileData?.solid ? 'Igen' : 'Nem';
      extraInfo = `Forgatás: <b style="color:#38bdf8;">${rot}°</b> | Szilárd: <b style="color:${tileData?.solid ? '#ef4444' : '#22c55e'};">${isSolid}</b>`;
    }

    this.entityInfoCard.style.display = 'flex';
    this.entityInfoCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(16, 185, 129, 0.4); padding-bottom: 4px;">
        <span style="font-weight: 700; color: #34d399;">✋ ${e.name}</span>
        <button id="btn-deselect-entity" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; padding: 0 4px;" title="Kijelölés megszüntetése">✕</button>
      </div>
      <div style="color: #cbd5e1; font-size: 10px; display: flex; flex-direction: column; gap: 2px;">
        <div>Pozíció: <b style="color: #38bdf8;">(X: ${e.gx}, Z: ${e.gz})</b></div>
        ${extraInfo ? `<div>${extraInfo}</div>` : ''}
        <div style="color: #94a3b8; font-style: italic; margin-top: 2px;">Kattints egy üres mezőre az áthelyezéshez!</div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
        <button id="btn-rotate-entity" style="background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; cursor: pointer;" title="Forgatás 90 fokkal">🔄 Forgatás (R)</button>
        <button id="btn-delete-entity" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">🗑️ Törlés (Del)</button>
      </div>
    `;

    this.entityInfoCard.querySelector('#btn-deselect-entity')?.addEventListener('click', () => {
      this.clearSelection();
    });
    this.entityInfoCard.querySelector('#btn-rotate-entity')?.addEventListener('click', () => {
      this.rotateSelectedEntity();
    });
    this.entityInfoCard.querySelector('#btn-delete-entity')?.addEventListener('click', () => {
      this.deleteSelectedEntity();
    });
  }

  private updateCursorVisual(): void {
    const isBlock = this.currentTool === 'block';
    const isWaypoint = this.currentTool === 'waypoint';
    const isMove = this.currentTool === 'move';
    const isWire = this.currentTool === 'wire';
    const colorHex = isBlock ? 0x38bdf8 : isWaypoint ? 0xfacc15 : isMove ? 0x10b981 : isWire ? 0xa855f7 : 0xd946ef;
    const wireHex = isBlock ? 0x38bdf8 : isWaypoint ? 0xffeb3b : isMove ? 0x34d399 : isWire ? 0xc084fc : 0xf472b6;

    if (this.cursorMesh && this.cursorMesh.material instanceof THREE.MeshBasicMaterial) {
      this.cursorMesh.material.color.setHex(colorHex);
    }
    if (this.cursorWire && this.cursorWire.material instanceof THREE.LineBasicMaterial) {
      this.cursorWire.material.color.setHex(wireHex);
    }
  }

  private updatePalettePreview(): void {
    if (!this.palettePreviewCanvas) return;
    const ctx = this.palettePreviewCanvas.getContext('2d');
    if (!ctx) return;
    const w = this.palettePreviewCanvas.width;
    const h = this.palettePreviewCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const layer = getLayerForTileType(this.selectedTileType);

    if (this.selectedTileType === TileType.RUG_PERSIAN) {
      // Burgundy Persian rug thumbnail
      ctx.fillStyle = '#8b1e2d';
      ctx.fillRect(4, 4, w - 8, h - 8);
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(9, 9, w - 18, h - 18);
      // Diamond medallion
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(w / 2, 10);
      ctx.lineTo(w / 2 + 12, h / 2);
      ctx.lineTo(w / 2, h - 10);
      ctx.lineTo(w / 2 - 12, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // Fringe tassels
      ctx.fillStyle = '#fef9c3';
      for (let y = 6; y < h - 6; y += 4) {
        ctx.fillRect(2, y, 3, 2);
        ctx.fillRect(w - 5, y, 3, 2);
      }
      this.palettePreviewBadge.textContent = '🏷️ Padlódísz (FloorDecor)';
      this.palettePreviewBadge.style.color = '#f43f5e';
      this.palettePreviewDesc.textContent = '🧵 Perzsa szőnyeg: meglévő padlóra feszül, nem törli';
    } else if (this.selectedTileType === TileType.RUG_BATH_MAT) {
      // Teal bath mat thumbnail
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(6, 6, w - 12, h - 12);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
      for (let x = 14; x < w - 14; x += 6) {
        ctx.fillRect(x, 10, 3, h - 20);
      }
      this.palettePreviewBadge.textContent = '🏷️ Padlódísz (FloorDecor)';
      this.palettePreviewBadge.style.color = '#06b6d4';
      this.palettePreviewDesc.textContent = '🧵 Fürdőszobai kilépő: puha plüss textil';
    } else if (this.selectedTileType === TileType.RUG_MODERN) {
      // Modern geometric carpet thumbnail
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(4, 4);
      ctx.lineTo(w * 0.65, 4);
      ctx.lineTo(4, h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(w * 0.45, 4);
      ctx.lineTo(w - 4, 4);
      ctx.lineTo(w * 0.6, h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(w * 0.6, h - 4);
      ctx.lineTo(w - 4, h - 4);
      ctx.lineTo(w - 4, h * 0.4);
      ctx.closePath();
      ctx.fill();
      this.palettePreviewBadge.textContent = '🏷️ Padlódísz (FloorDecor)';
      this.palettePreviewBadge.style.color = '#eab308';
      this.palettePreviewDesc.textContent = '🧵 Modern szőnyeg: skandináv geometrikus minta';
    } else if (this.selectedTileType === TileType.BEACH_TOWEL_BLUE) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(10, 4, w - 20, h - 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(10, 10, w - 20, 3);
      ctx.fillRect(10, h - 14, w - 20, 3);
      this.palettePreviewBadge.textContent = '🏷️ Padlódísz (FloorDecor)';
      this.palettePreviewBadge.style.color = '#38bdf8';
      this.palettePreviewDesc.textContent = '🏖️ Kék strandtörölköző';
    } else if (this.selectedTileType === TileType.BEACH_TOWEL_STRIPED) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(10, 4, w - 20, h - 8);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(16, 4, 6, h - 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(28, 4, 6, h - 8);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(40, 4, 6, h - 8);
      this.palettePreviewBadge.textContent = '🏷️ Padlódísz (FloorDecor)';
      this.palettePreviewBadge.style.color = '#fbbf24';
      this.palettePreviewDesc.textContent = '🏖️ Csíkos strandtörölköző';
    } else {
      // General tile representation
      ctx.fillStyle = layer === 'floor' ? '#78716c' : layer === 'wall' ? '#dc2626' : layer === 'prop' ? '#10b981' : '#a855f7';
      ctx.fillRect(6, 6, w - 12, h - 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      const layerLabels: Record<LayerType, string> = {
        floor: '🧱 Alap Padló',
        wall: '🧱 Fal elem',
        prop: '🛋️ Bútor / Prop',
        wallDecor: '🖼️ Fali Dísz',
        floorDecor: '🏷️ Padló Dísz',
      };
      this.palettePreviewBadge.textContent = layerLabels[layer] || 'Elem';
      this.palettePreviewBadge.style.color = '#38bdf8';
      this.palettePreviewDesc.textContent = this.isSolidBrush ? '🔒 Szilárd ütköző' : '🚶 Szabadon átjárható';
    }
  }

  private updateCursorBrushPreview(): void {
    while (this.cursorBrushGroup.children.length > 0) {
      const child = this.cursorBrushGroup.children[0];
      this.cursorBrushGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    if (this.currentTool !== 'block') return;

    const previewMesh = createTileMesh(this.selectedTileType);
    if (!previewMesh) return;

    if (isFloorDecorType(this.selectedTileType)) {
      if (this.cursorMesh && this.cursorMesh.material instanceof THREE.MeshBasicMaterial) {
        this.cursorMesh.material.opacity = 0.15;
      }
      previewMesh.position.y = 0.03;
      previewMesh.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) {
            m.transparent = true;
            m.opacity = 0.9;
          }
        }
      });
    } else {
      if (this.cursorMesh && this.cursorMesh.material instanceof THREE.MeshBasicMaterial) {
        this.cursorMesh.material.opacity = 0.45;
      }
      previewMesh.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) {
            m.transparent = true;
            m.opacity = 0.55;
          }
        }
      });
    }

    this.cursorBrushGroup.add(previewMesh);
  }

  public update(delta: number = 0.016): void {
    if (!this.active || gameState.getMode() !== GameMode.EDITOR) {
      this.cursorMesh.visible = false;
      return;
    }

    // Keyboard Pan Handling
    if (this.keysDown.size > 0) {
      const panSpeed = Math.max(14, this.editorDistance * 0.8) * delta;
      const { right, forward } = this.getCameraHorizontalVectors();
      const move = new THREE.Vector3();

      if (this.keysDown.has('ArrowUp') || this.keysDown.has('KeyI')) {
        move.add(forward);
      }
      if (this.keysDown.has('ArrowDown') || this.keysDown.has('KeyK')) {
        move.sub(forward);
      }
      if (this.keysDown.has('ArrowRight') || this.keysDown.has('KeyL')) {
        move.add(right);
      }
      if (this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyJ')) {
        move.sub(right);
      }

      if (move.lengthSq() > 0) {
        move.normalize();
        this.editorLookAt.addScaledVector(move, panSpeed);
        this.syncEditorCamera();
      }
    }

    this.updateGridCursor();
  }

  private updateGridCursor(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersectPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);

    if (hit) {
      const gx = Math.round(intersectPoint.x / GRID_CELL_SIZE);
      const gz = Math.round(intersectPoint.z / GRID_CELL_SIZE);

      this.currentGridPos = { gx, gz };
      this.cursorMesh.position.set(
        gx * GRID_CELL_SIZE,
        this.currentElevationY * GRID_CELL_SIZE + 0.06,
        gz * GRID_CELL_SIZE
      );
      if (this.selectedTileType === TileType.SOPELANA_CLIFF_STAIRS) {
        this.cursorMesh.rotation.y = stairDirToRotation(this.selectedStairDir);
      } else {
        this.cursorMesh.rotation.y = (this.selectedRotationDeg * Math.PI) / 180;
      }
      this.cursorMesh.visible = true;
    } else {
      this.cursorMesh.visible = false;
    }
  }

  public exportLevelJSON(): void {
    this.level.setCameraWaypoints(this.cameraWaypoints);
    const data = this.level.toJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.id || 'level'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  public handleFileImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsedData = JSON.parse(text) as LevelData;
        if (parsedData && Array.isArray(parsedData.tiles)) {
          this.level.loadLevel(parsedData, this.scene);
          this.level.setCameraMode(parsedData.cameraMode || 'isometric');
          if (parsedData.theme) {
            this.level.setTheme(parsedData.theme);
            if (this.themeSelect) {
              this.themeSelect.value = parsedData.theme;
            }
            if (this.environmentBackdrop) {
              this.environmentBackdrop.setTheme(parsedData.theme, this.scene, this.dirLight, this.ambientLight, undefined, parsedData);
            }
          }
          if (parsedData.cameraWaypoints) {
            this.cameraWaypoints = [...parsedData.cameraWaypoints];
          } else {
            this.cameraWaypoints = [];
          }
          this.level.setCameraWaypoints(this.cameraWaypoints);
          this.updateWaypointVisuals();

          const defaultSun = parsedData.theme === TileTheme.METRO || parsedData.theme === TileTheme.APARTMENT ? 0.05 : 1.4;
          const sunVal = parsedData.sunIntensity ?? defaultSun;
          const fixtureVal = parsedData.fixtureIntensity ?? 1.2;
          if (this.sunSlider) {
            this.sunSlider.value = sunVal.toString();
            this.sunValueSpan.textContent = `${sunVal.toFixed(1)}x`;
          }
          if (this.fixtureSlider) {
            this.fixtureSlider.value = fixtureVal.toString();
            this.fixtureValueSpan.textContent = `${fixtureVal.toFixed(1)}x`;
          }
          if (this.environmentBackdrop) {
            if (parsedData.sunIntensity !== undefined) {
              this.environmentBackdrop.setSunIntensity(parsedData.sunIntensity);
            }
            if (parsedData.fixtureIntensity !== undefined) {
              this.environmentBackdrop.setFixtureIntensity(parsedData.fixtureIntensity, this.scene);
            }
          }

          this.saveToLocalStorage(false);
          this.clearSelection();
          this.refreshEntityPreviews();
          if (this.onLevelLoaded) {
            this.onLevelLoaded(parsedData);
          }
        } else {
          alert('Érvénytelen pálya JSON formátum.');
        }
      } catch (err) {
        alert('Hiba a pálya betöltésekor: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  public renderCampaignList(): void {
    this.renderCampaignLevels();
  }

  public populateCampaignList(): void {
    this.renderCampaignLevels();
  }

  private renderCampaignLevels(): void {
    if (!this.campaignLevelsListEl) return;
    this.campaignLevelsListEl.innerHTML = '';

    // Defensive error handling: if levels is empty or undefined, force-load 5 default canonical levels
    let levels = campaignManager.getLevels();
    if (!levels || !Array.isArray(levels) || levels.length === 0) {
      console.warn('campaignManager.levels was empty or undefined; force-loading default 5 levels.');
      campaignManager.resetToDefault();
      levels = campaignManager.getLevels();
    }

    const activeIdx = campaignManager.getActiveIndex();

    if (this.campaignTitleSpan) {
      this.campaignTitleSpan.innerHTML = `🗺️ <b>Kampány Pályák (Sorrend & Átnevezés)</b> (${levels.length})`;
    }

    const themeColors: Record<TileTheme, { name: string; bg: string; color: string }> = {
      [TileTheme.DOWNTOWN]: { name: 'Város', bg: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' },
      [TileTheme.APARTMENT]: { name: 'Lakás', bg: 'rgba(251, 146, 60, 0.2)', color: '#fb923c' },
      [TileTheme.METRO]: { name: 'Metró', bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' },
      [TileTheme.SOPELANA]: { name: 'Tenger', bg: 'rgba(52, 211, 153, 0.2)', color: '#34d399' },
      [TileTheme.PARK]: { name: 'Park', bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' },
    };

    levels.forEach((lvl, idx) => {
      const isActive = idx === activeIdx;
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        background: ${isActive ? 'rgba(3, 105, 161, 0.75)' : 'rgba(30, 41, 59, 0.8)'};
        border: 1px solid ${isActive ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)'};
        border-radius: 4px;
        padding: 2px 4px;
        gap: 4px;
        cursor: pointer;
        box-sizing: border-box;
      `;
      row.title = 'Kattints a szint betöltéséhez a szerkesztőbe';

      // Click on row (outside input & buttons) switches active level
      row.addEventListener('click', () => {
        if (idx !== activeIdx) {
          this.saveCurrentLevelToCampaign();
          this.loadLevelFromCampaign(idx);
        }
      });

      // Left part: badge & editable input & theme tag
      const leftEl = document.createElement('div');
      leftEl.style.cssText = 'display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;';

      const numSpan = document.createElement('span');
      numSpan.style.cssText = `font-weight: 700; font-size: 11px; color: ${isActive ? '#38bdf8' : '#94a3b8'}; width: 14px; flex-shrink: 0;`;
      numSpan.textContent = `${idx + 1}.`;
      leftEl.appendChild(numSpan);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'level-name-input';
      nameInput.setAttribute('data-index', `${idx}`);
      nameInput.value = lvl.name;
      nameInput.title = 'Kattints a pálya nevének átírásához';
      nameInput.style.cssText = `
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid ${isActive ? '#38bdf8' : '#475569'};
        border-radius: 3px;
        padding: 2px 4px;
        font-size: 11px;
        width: 110px;
        flex-shrink: 1;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s, background 0.15s;
      `;

      nameInput.onfocus = () => {
        nameInput.style.borderColor = '#38bdf8';
        nameInput.style.background = '#1e293b';
      };
      nameInput.onblur = () => {
        nameInput.style.borderColor = isActive ? '#38bdf8' : '#475569';
        nameInput.style.background = '#0f172a';
      };

      // Prevent triggering level selection or global hotkeys while editing
      nameInput.addEventListener('click', (e) => e.stopPropagation());
      nameInput.addEventListener('keydown', (e) => e.stopPropagation());
      nameInput.addEventListener('keyup', (e) => e.stopPropagation());
      nameInput.addEventListener('keypress', (e) => e.stopPropagation());

      const handleNameChange = () => {
        const newName = nameInput.value.trim() || `Szint ${idx + 1}`;
        lvl.name = newName;
        campaignManager.renameLevel(idx, newName);
        if (idx === activeIdx) {
          this.level.setName(newName);
        }
      };

      nameInput.addEventListener('input', handleNameChange);
      nameInput.addEventListener('change', handleNameChange);
      leftEl.appendChild(nameInput);

      const th = themeColors[lvl.theme] || themeColors[TileTheme.DOWNTOWN];
      const tagSpan = document.createElement('span');
      tagSpan.style.cssText = `
        font-size: 9px;
        font-weight: 600;
        padding: 1px 3px;
        border-radius: 3px;
        flex-shrink: 0;
        background: ${th.bg};
        color: ${th.color};
      `;
      tagSpan.textContent = th.name;
      leftEl.appendChild(tagSpan);

      row.appendChild(leftEl);

      // Action controls right part: Up, Down, Clone, Delete
      const actionsEl = document.createElement('div');
      actionsEl.style.cssText = 'display: flex; align-items: center; gap: 2px; flex-shrink: 0;';

      // Move Up [⬆]
      const upBtn = document.createElement('button');
      upBtn.textContent = '⬆';
      upBtn.title = 'Előrébb mozgatás';
      upBtn.disabled = idx === 0;
      upBtn.style.cssText = `
        background: none; border: none; color: ${idx === 0 ? '#475569' : '#38bdf8'};
        cursor: ${idx === 0 ? 'default' : 'pointer'}; font-size: 10px; padding: 2px 4px; min-width: 20px; line-height: 1; text-align: center;
      `;
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentLevelToCampaign();
        campaignManager.moveLevel(idx, idx - 1);
        this.renderCampaignLevels();
      });
      actionsEl.appendChild(upBtn);

      // Move Down [⬇]
      const downBtn = document.createElement('button');
      downBtn.textContent = '⬇';
      downBtn.title = 'Hátrébb mozgatás';
      downBtn.disabled = idx === levels.length - 1;
      downBtn.style.cssText = `
        background: none; border: none; color: ${idx === levels.length - 1 ? '#475569' : '#38bdf8'};
        cursor: ${idx === levels.length - 1 ? 'default' : 'pointer'}; font-size: 10px; padding: 2px 4px; min-width: 20px; line-height: 1; text-align: center;
      `;
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentLevelToCampaign();
        campaignManager.moveLevel(idx, idx + 1);
        this.renderCampaignLevels();
      });
      actionsEl.appendChild(downBtn);

      // Clone [📋]
      const cloneBtn = document.createElement('button');
      cloneBtn.textContent = '📋';
      cloneBtn.title = 'Szint másolása';
      cloneBtn.style.cssText = 'background: none; border: none; color: #a78bfa; cursor: pointer; font-size: 10px; padding: 2px 4px; min-width: 20px; line-height: 1; text-align: center;';
      cloneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.saveCurrentLevelToCampaign();
        const cloned = campaignManager.cloneLevel(idx);
        if (cloned) {
          this.loadLevelFromCampaign(campaignManager.getActiveIndex());
        }
      });
      actionsEl.appendChild(cloneBtn);

      // Delete [🗑️] (disabled if only 1 level remains)
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.title = levels.length <= 1 ? 'Az utolsó szint nem törölhető' : 'Szint törlése a kampányból';
      delBtn.disabled = levels.length <= 1;
      delBtn.style.cssText = `
        background: none; border: none; color: ${levels.length <= 1 ? '#475569' : '#f87171'};
        cursor: ${levels.length <= 1 ? 'default' : 'pointer'}; font-size: 10px; padding: 2px 4px; min-width: 20px; line-height: 1; text-align: center;
        opacity: ${levels.length <= 1 ? '0.4' : '1.0'};
      `;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (levels.length <= 1) return;
        if (confirm(`Biztosan törlöd ezt a szintet: "${lvl.name}"?`)) {
          campaignManager.deleteLevel(idx);
          this.loadLevelFromCampaign(campaignManager.getActiveIndex());
        }
      });
      actionsEl.appendChild(delBtn);

      row.appendChild(actionsEl);
      this.campaignLevelsListEl.appendChild(row);
    });
  }

  private saveCurrentLevelToCampaign(): void {
    this.level.setCameraWaypoints(this.cameraWaypoints);
    const data = this.level.toJSON();
    campaignManager.updateLevel(campaignManager.getActiveIndex(), data);
  }

  public loadLevelFromCampaign(index: number): void {
    const data = campaignManager.getLevel(index);
    if (!data) return;

    campaignManager.setActiveIndex(index);
    this.level.loadLevel(data, this.scene);
    this.level.setCameraMode(data.cameraMode || 'isometric');
    this.cameraWaypoints = data.cameraWaypoints ? [...data.cameraWaypoints] : [];
    this.level.setCameraWaypoints(this.cameraWaypoints);
    this.updateWaypointVisuals();

    if (this.themeSelect) {
      this.themeSelect.value = data.theme;
    }
    if (this.environmentBackdrop) {
      this.environmentBackdrop.setTheme(data.theme, this.scene, this.dirLight, this.ambientLight, undefined, data);
    }

    const defaultSun = data.theme === TileTheme.METRO || data.theme === TileTheme.APARTMENT ? 0.05 : 1.4;
    const sunVal = data.sunIntensity ?? defaultSun;
    const fixtureVal = data.fixtureIntensity ?? 1.2;
    if (this.sunSlider) {
      this.sunSlider.value = sunVal.toString();
      this.sunValueSpan.textContent = `${sunVal.toFixed(1)}x`;
    }
    if (this.fixtureSlider) {
      this.fixtureSlider.value = fixtureVal.toString();
      this.fixtureValueSpan.textContent = `${fixtureVal.toFixed(1)}x`;
    }
    if (this.environmentBackdrop) {
      if (data.sunIntensity !== undefined) {
        this.environmentBackdrop.setSunIntensity(data.sunIntensity);
      }
      if (data.fixtureIntensity !== undefined) {
        this.environmentBackdrop.setFixtureIntensity(data.fixtureIntensity, this.scene);
      }
    }

    this.saveToLocalStorage(false);
    this.clearSelection();
    this.refreshEntityPreviews();
    this.renderCampaignLevels();
    if (this.onLevelLoaded) {
      this.onLevelLoaded(data);
    }
  }

  private addNewCampaignLevel(): void {
    this.saveCurrentLevelToCampaign();
    campaignManager.addLevel();
    this.loadLevelFromCampaign(campaignManager.getActiveIndex());
  }

  private handleCampaignImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const success = campaignManager.importCampaignJSON(text);
        if (success) {
          this.loadLevelFromCampaign(0);
          alert('Kampány sikeresen importálva!');
        } else {
          alert('Érvénytelen kampány JSON fájlformátum.');
        }
      } catch (err) {
        alert('Hiba a kampány importálásakor: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
}

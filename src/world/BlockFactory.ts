import * as THREE from 'three';
import { TileType } from './TileTypes.ts';
import { resolveAssetPath } from '../utils/assetPath.ts';

export const GRID_CELL_SIZE = 2.0;

// Shared Material Cache
class MaterialCache {
  private materials = new Map<string, THREE.MeshStandardMaterial>();

  public get(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial(params);
      this.materials.set(key, mat);
    }
    return mat;
  }

  public clear(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
  }
}

// Shared Geometry Cache
class GeometryCache {
  private geometries = new Map<string, THREE.BufferGeometry>();

  public get<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    let geo = this.geometries.get(key);
    if (!geo) {
      geo = factory();
      this.geometries.set(key, geo);
    }
    return geo as T;
  }

  public clear(): void {
    this.geometries.forEach((geo) => geo.dispose());
    this.geometries.clear();
  }
}

// Shared Texture Cache
class TextureCache {
  private textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();

  public get(path: string): THREE.Texture {
    let tex = this.textures.get(path);
    if (!tex) {
      if (typeof document === 'undefined') {
        tex = new THREE.Texture();
        this.textures.set(path, tex);
        return tex;
      }
      const resolvedPath = resolveAssetPath(path);
      tex = this.loader.load(
        resolvedPath,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[BlockFactory] Failed to load texture '${path}':`, err);
        }
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(path, tex);
    }
    return tex;
  }

  public clear(): void {
    this.textures.forEach((tex) => tex.dispose());
    this.textures.clear();
  }
}

const materials = new MaterialCache();
const geometries = new GeometryCache();
const textures = new TextureCache();

function applyShadows(obj: THREE.Object3D): void {
  // Optimization: Disable castShadow on static map tiles, streetlamps, facade blocks and trees
  // Real-time shadows are reserved for dynamic moving entities (Players, Enemies, Cars)
  obj.castShadow = false;
  obj.receiveShadow = true;
  for (const child of obj.children) {
    applyShadows(child);
  }
}

export function createTileMesh(type: TileType, rotation?: number): THREE.Group | THREE.Mesh | null {
  const mesh = createTileMeshBase(type);
  if (mesh) {
    if (rotation !== undefined) {
      const rotRad = Math.abs(rotation) > 6.3 ? rotation * (Math.PI / 180) : rotation;
      mesh.rotation.y = rotRad;
    }
    const isWallType =
      type === TileType.APARTMENT_WALL ||
      type === TileType.APARTMENT_CORNER_WALL ||
      type === TileType.WALL_PILLAR ||
      type === TileType.METRO_VAULT_WALL ||
      type === TileType.DOWNTOWN_BRICK_WALL ||
      type === TileType.DOWNTOWN_FACADE ||
      type === TileType.SOPELANA_STONE_WALL ||
      type === TileType.BUILDING_BLOCK_LARGE ||
      type === TileType.SUBURBAN_HOUSE ||
      type === TileType.SUBURBAN_VILLA;
    if (isWallType) {
      mesh.userData.isWall = true;
      mesh.userData.isOccluder = true;
      mesh.traverse((c) => {
        c.userData.isWall = true;
        c.userData.isOccluder = true;
      });
    }
    const isDoorType =
      type === TileType.DOOR_APARTMENT ||
      type === TileType.DOOR_STORE ||
      type === TileType.DOOR_METRO ||
      type === TileType.DOOR_SUBURBAN_GATE ||
      type === TileType.DOOR_SOPELANA_IRON;
    if (isDoorType) {
      mesh.userData.isDoor = true;
      mesh.userData.isWall = true;
      mesh.userData.isOccluder = true;
      mesh.traverse((c) => {
        c.userData.isDoor = true;
        c.userData.isWall = true;
        c.userData.isOccluder = true;
      });
    }
    if (type === TileType.SWITCH_BUTTON) {
      mesh.userData.isSwitch = true;
    }
  }
  return mesh;
}

function createTileMeshBase(type: TileType): THREE.Group | THREE.Mesh | null {
  switch (type) {
    case TileType.EMPTY:
      return null;

    case TileType.DOWNTOWN_BRICK_WALL: {
      const geo = geometries.get('downtown_brick_wall', () => new THREE.BoxGeometry(2.0, 2.0, 2.0));
      const mat = materials.get('downtown_brick_wall', {
        color: 0x8b3528,
        roughness: 0.9,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.0;
      applyShadows(mesh);
      return mesh;
    }

    case TileType.DOWNTOWN_SIDEWALK: {
      const geo = geometries.get('downtown_sidewalk', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
      const mat = materials.get('downtown_sidewalk', {
        color: 0xb5b8bf,
        roughness: 0.75,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.1;
      applyShadows(mesh);
      return mesh;
    }

    case TileType.DOWNTOWN_ROAD_ZEBRA: {
      const group = new THREE.Group();

      const roadGeo = geometries.get('downtown_road_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
      const roadMat = materials.get('downtown_road_base', {
        color: 0x22232a,
        roughness: 0.85,
        metalness: 0.1,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.y = 0.1;
      group.add(roadMesh);

      const stripeGeo = geometries.get('downtown_zebra_stripe', () => new THREE.BoxGeometry(0.35, 0.01, 1.4));
      const stripeMat = materials.get('downtown_zebra_stripe', {
        color: 0xf3f4f6,
        roughness: 0.6,
        metalness: 0.05,
      });

      const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
      stripe1.position.set(-0.45, 0.206, 0);
      group.add(stripe1);

      const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
      stripe2.position.set(0.45, 0.206, 0);
      group.add(stripe2);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_VAULT_WALL: {
      const group = new THREE.Group();
      group.userData.isWall = true;

      // Concrete vault back wall (2.0 x 3.8 x 0.8)
      const baseGeo = geometries.get('metro_vault_base_38', () => new THREE.BoxGeometry(2.0, 3.8, 0.8));
      const concreteMat = materials.get('metro_concrete', {
        color: 0x5a606d,
        roughness: 0.82,
        metalness: 0.2,
        transparent: true,
        opacity: 1.0,
      });
      const baseMesh = new THREE.Mesh(baseGeo, concreteMat);
      baseMesh.position.set(0, 1.9, 0.6);
      baseMesh.userData.isWall = true;
      group.add(baseMesh);

      // Curved vault arch slice
      const archGeo = geometries.get('metro_vault_arch_38', () => {
        const geo = new THREE.CylinderGeometry(1.8, 1.8, 2.0, 24, 1, false, 0, Math.PI);
        geo.rotateZ(Math.PI / 2);
        geo.rotateY(Math.PI / 2);
        return geo;
      });
      const archMesh = new THREE.Mesh(archGeo, concreteMat);
      archMesh.position.set(0, 2.2, 0.2);
      archMesh.userData.isWall = true;
      group.add(archMesh);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_PLATFORM: {
      const group = new THREE.Group();

      const platformGeo = geometries.get('metro_platform_base', () => new THREE.BoxGeometry(2.0, 0.3, 2.0));
      const platformMat = materials.get('metro_platform_base', {
        color: 0x8e94a0,
        roughness: 0.65,
        metalness: 0.15,
      });
      const platformMesh = new THREE.Mesh(platformGeo, platformMat);
      platformMesh.position.y = 0.15;
      group.add(platformMesh);

      // Yellow textured tactile safety edge strip
      const edgeGeo = geometries.get('metro_platform_edge', () => new THREE.BoxGeometry(2.0, 0.02, 0.28));
      const edgeMat = materials.get('metro_tactile_yellow', {
        color: 0xfacc15,
        roughness: 0.45,
        metalness: 0.1,
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.position.set(0, 0.31, 0.85);
      group.add(edgeMesh);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_RAIL: {
      const group = new THREE.Group();

      // Sunken ballast base
      const baseGeo = geometries.get('metro_rail_base', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
      const ballastMat = materials.get('metro_ballast', {
        color: 0x2a2b33,
        roughness: 0.95,
        metalness: 0.05,
      });
      const baseMesh = new THREE.Mesh(baseGeo, ballastMat);
      baseMesh.position.y = 0.05;
      group.add(baseMesh);

      // Wooden cross-ties
      const tieGeo = geometries.get('metro_rail_tie', () => new THREE.BoxGeometry(1.6, 0.05, 0.22));
      const tieMat = materials.get('metro_rail_tie', {
        color: 0x48382c,
        roughness: 0.85,
        metalness: 0.05,
      });
      const tieZPositions = [-0.65, 0, 0.65];
      for (const z of tieZPositions) {
        const tieMesh = new THREE.Mesh(tieGeo, tieMat);
        tieMesh.position.set(0, 0.125, z);
        group.add(tieMesh);
      }

      // Two steel rails
      const railGeo = geometries.get('metro_steel_rail', () => new THREE.BoxGeometry(0.09, 0.12, 2.0));
      const steelMat = materials.get('metro_rail_steel', {
        color: 0xd4d8e0,
        roughness: 0.25,
        metalness: 0.85,
      });

      const rail1 = new THREE.Mesh(railGeo, steelMat);
      rail1.position.set(-0.45, 0.16, 0);
      group.add(rail1);

      const rail2 = new THREE.Mesh(railGeo, steelMat);
      rail2.position.set(0.45, 0.16, 0);
      group.add(rail2);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_TRAIN_CAR: {
      const group = new THREE.Group();

      // Stainless steel car body
      const bodyGeo = geometries.get('metro_train_body', () => new THREE.BoxGeometry(1.85, 1.8, 2.0));
      const steelMat = materials.get('metro_train_steel', {
        color: 0xd8dbe3,
        roughness: 0.22,
        metalness: 0.82,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, steelMat);
      bodyMesh.position.y = 1.05;
      group.add(bodyMesh);

      // Tinted window stripe
      const windowGeo = geometries.get('metro_train_window', () => new THREE.BoxGeometry(1.88, 0.42, 1.9));
      const windowMat = materials.get('metro_train_window', {
        color: 0x181e29,
        roughness: 0.15,
        metalness: 0.9,
      });
      const windowMesh = new THREE.Mesh(windowGeo, windowMat);
      windowMesh.position.y = 1.35;
      group.add(windowMesh);

      // Red passenger seats
      const seatGeo = geometries.get('metro_train_seat', () => new THREE.BoxGeometry(0.38, 0.35, 0.45));
      const seatMat = materials.get('metro_train_seat', {
        color: 0xdc2626,
        roughness: 0.5,
        metalness: 0.1,
      });

      const seat1 = new THREE.Mesh(seatGeo, seatMat);
      seat1.position.set(-0.55, 2.05, -0.4);
      group.add(seat1);

      const seat2 = new THREE.Mesh(seatGeo, seatMat);
      seat2.position.set(0.55, 2.05, 0.4);
      group.add(seat2);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_STONE_WALL: {
      const group = new THREE.Group();

      // Rough beige/brown stone parapet
      const wallGeo = geometries.get('sopelana_stone_wall', () => new THREE.BoxGeometry(2.0, 1.2, 0.6));
      const stoneMat = materials.get('sopelana_stone_wall', {
        color: 0xbe9f76,
        roughness: 0.94,
        metalness: 0.06,
      });
      const wallMesh = new THREE.Mesh(wallGeo, stoneMat);
      wallMesh.position.set(0, 0.6, 0);
      group.add(wallMesh);

      // Weathered top cap
      const capGeo = geometries.get('sopelana_stone_cap', () => new THREE.BoxGeometry(2.0, 0.1, 0.7));
      const capMat = materials.get('sopelana_stone_cap', {
        color: 0xa8875e,
        roughness: 0.9,
        metalness: 0.05,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(0, 1.25, 0);
      group.add(capMesh);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_CLIFF_STAIRS: {
      const group = new THREE.Group();

      const stairsMat = materials.get('sopelana_cliff_stairs', {
        color: 0xd2bea0,
        roughness: 0.92,
        metalness: 0.05,
      });

      // 4 stepped risers along Z axis (North ascent: 2.0m rise over 2.0m run)
      const stepGeo1 = geometries.get('sopelana_stair_step_1', () => new THREE.BoxGeometry(2.0, 0.5, 0.5));
      const step1 = new THREE.Mesh(stepGeo1, stairsMat);
      step1.position.set(0, 0.25, 0.75);
      group.add(step1);

      const stepGeo2 = geometries.get('sopelana_stair_step_2', () => new THREE.BoxGeometry(2.0, 1.0, 0.5));
      const step2 = new THREE.Mesh(stepGeo2, stairsMat);
      step2.position.set(0, 0.5, 0.25);
      group.add(step2);

      const stepGeo3 = geometries.get('sopelana_stair_step_3', () => new THREE.BoxGeometry(2.0, 1.5, 0.5));
      const step3 = new THREE.Mesh(stepGeo3, stairsMat);
      step3.position.set(0, 0.75, -0.25);
      group.add(step3);

      const stepGeo4 = geometries.get('sopelana_stair_step_4', () => new THREE.BoxGeometry(2.0, 2.0, 0.5));
      const step4 = new THREE.Mesh(stepGeo4, stairsMat);
      step4.position.set(0, 1.0, -0.75);
      group.add(step4);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_SAND: {
      const geo = geometries.get('sopelana_sand', () => new THREE.BoxGeometry(2.0, 0.15, 2.0));
      const mat = materials.get('sopelana_sand', {
        color: 0xe5caa0,
        roughness: 0.96,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.075;
      applyShadows(mesh);
      return mesh;
    }

    case TileType.DOWNTOWN_FACADE: {
      const group = new THREE.Group();

      // Multi-story red brick residential facade body (4m high)
      const wallGeo = geometries.get('dt_facade_body', () => new THREE.BoxGeometry(2.0, 4.0, 1.9));
      const brickMat = materials.get('dt_facade_brick', {
        color: 0x8c3528,
        roughness: 0.85,
        metalness: 0.05,
      });
      const wallMesh = new THREE.Mesh(wallGeo, brickMat);
      wallMesh.position.set(0, 2.0, 0);
      group.add(wallMesh);

      // Inset dark glass windows with white frame trims
      const windowFrameGeo = geometries.get('dt_facade_win_frame', () => new THREE.BoxGeometry(0.56, 0.76, 0.06));
      const frameMat = materials.get('dt_facade_frame', {
        color: 0xf1f5f9,
        roughness: 0.5,
        metalness: 0.1,
      });

      const glassGeo = geometries.get('dt_facade_win_glass', () => new THREE.BoxGeometry(0.48, 0.68, 0.08));
      const glassMat = materials.get('dt_facade_glass', {
        color: 0x1a2332,
        roughness: 0.1,
        metalness: 0.9,
      });

      // 2 rows of windows on front (+Z) and back (-Z) faces
      const winXOffsets = [-0.5, 0.5];
      const winYOffsets = [1.3, 2.7];

      for (const wx of winXOffsets) {
        for (const wy of winYOffsets) {
          // Front (+Z)
          const frameFront = new THREE.Mesh(windowFrameGeo, frameMat);
          frameFront.position.set(wx, wy, 0.96);
          group.add(frameFront);

          const glassFront = new THREE.Mesh(glassGeo, glassMat);
          glassFront.position.set(wx, wy, 0.965);
          group.add(glassFront);

          // Back (-Z)
          const frameBack = new THREE.Mesh(windowFrameGeo, frameMat);
          frameBack.position.set(wx, wy, -0.96);
          group.add(frameBack);

          const glassBack = new THREE.Mesh(glassGeo, glassMat);
          glassBack.position.set(wx, wy, -0.965);
          group.add(glassBack);
        }
      }

      // Decorative stone cornice header at roofline
      const corniceGeo = geometries.get('dt_facade_cornice', () => new THREE.BoxGeometry(2.06, 0.16, 2.0));
      const corniceMat = materials.get('dt_facade_cornice', {
        color: 0xdbd5cc,
        roughness: 0.7,
        metalness: 0.1,
      });
      const corniceMesh = new THREE.Mesh(corniceGeo, corniceMat);
      corniceMesh.position.set(0, 4.0, 0);
      group.add(corniceMesh);

      applyShadows(group);
      return group;
    }

    case TileType.DOWNTOWN_BIKELANE: {
      const group = new THREE.Group();

      // Dark asphalt street base
      const roadGeo = geometries.get('dt_bikelane_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
      const roadMat = materials.get('downtown_road_base', {
        color: 0x22232a,
        roughness: 0.85,
        metalness: 0.1,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.y = 0.1;
      group.add(roadMesh);

      // Authentic Basque bordeaux/red bike lane track (0.8m wide)
      const laneGeo = geometries.get('dt_bikelane_red_track', () => new THREE.BoxGeometry(0.8, 0.01, 2.0));
      const laneMat = materials.get('dt_bikelane_red', {
        color: 0xa33835,
        roughness: 0.7,
        metalness: 0.05,
      });
      const laneMesh = new THREE.Mesh(laneGeo, laneMat);
      laneMesh.position.set(0, 0.205, 0);
      group.add(laneMesh);

      // Clean white boundary delineator lines on both sides of bike lane
      const lineGeo = geometries.get('dt_bikelane_white_line', () => new THREE.BoxGeometry(0.06, 0.012, 2.0));
      const lineMat = materials.get('downtown_zebra_stripe', {
        color: 0xf3f4f6,
        roughness: 0.6,
        metalness: 0.05,
      });

      const lineLeft = new THREE.Mesh(lineGeo, lineMat);
      lineLeft.position.set(-0.43, 0.207, 0);
      group.add(lineLeft);

      const lineRight = new THREE.Mesh(lineGeo, lineMat);
      lineRight.position.set(0.43, 0.207, 0);
      group.add(lineRight);

      // Stylized white bicycle silhouette icon in center
      const bikeIconGeo = geometries.get('dt_bikelane_icon', () => new THREE.BoxGeometry(0.24, 0.013, 0.45));
      const bikeIcon = new THREE.Mesh(bikeIconGeo, lineMat);
      bikeIcon.position.set(0, 0.208, 0);
      group.add(bikeIcon);

      applyShadows(group);
      return group;
    }

    case TileType.DOWNTOWN_TREE: {
      const group = new THREE.Group();

      // Tree basin stone pavement rim
      const basinGeo = geometries.get('dt_tree_basin', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
      const basinMat = materials.get('downtown_sidewalk', {
        color: 0xb5b8bf,
        roughness: 0.75,
        metalness: 0.1,
      });
      const basinMesh = new THREE.Mesh(basinGeo, basinMat);
      basinMesh.position.y = 0.1;
      group.add(basinMesh);

      // Cast-iron tree grate ring around trunk
      const grateGeo = geometries.get('dt_tree_grate', () => new THREE.CylinderGeometry(0.48, 0.48, 0.02, 16));
      const grateMat = materials.get('dt_tree_grate', {
        color: 0x1f242d,
        roughness: 0.85,
        metalness: 0.6,
      });
      const grateMesh = new THREE.Mesh(grateGeo, grateMat);
      grateMesh.position.y = 0.21;
      group.add(grateMesh);

      // Dark wood tree trunk (2.4m tall)
      const trunkGeo = geometries.get('dt_tree_trunk', () => new THREE.CylinderGeometry(0.12, 0.16, 2.4, 10));
      const trunkMat = materials.get('dt_tree_bark', {
        color: 0x3d271d,
        roughness: 0.92,
        metalness: 0.04,
      });
      const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
      trunkMesh.position.set(0, 1.25, 0);
      group.add(trunkMesh);

      // Stylized leafy green foliage canopy clusters
      const foliageMat = materials.get('dt_tree_foliage', {
        color: 0x2e6f40,
        roughness: 0.78,
        metalness: 0.05,
      });

      // Main central crown
      const crownGeo = geometries.get('dt_tree_crown_main', () => new THREE.DodecahedronGeometry(0.85, 1));
      const crownMesh = new THREE.Mesh(crownGeo, foliageMat);
      crownMesh.position.set(0, 2.9, 0);
      group.add(crownMesh);

      // Offset cluster 1
      const crownGeo2 = geometries.get('dt_tree_crown_sub1', () => new THREE.DodecahedronGeometry(0.65, 1));
      const crownMesh2 = new THREE.Mesh(crownGeo2, foliageMat);
      crownMesh2.position.set(-0.35, 2.65, 0.3);
      group.add(crownMesh2);

      // Offset cluster 2
      const crownGeo3 = geometries.get('dt_tree_crown_sub2', () => new THREE.DodecahedronGeometry(0.68, 1));
      const crownMesh3 = new THREE.Mesh(crownGeo3, foliageMat);
      crownMesh3.position.set(0.35, 2.7, -0.25);
      group.add(crownMesh3);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_SEAT_DOUBLE: {
      const group = new THREE.Group();

      // Metro floor underneath
      const floor = createMetroFloorMesh();
      group.add(floor);

      // Cantilevered dark charcoal structural base frame
      const frameGeo = geometries.get('metro_seat_frame', () => new THREE.BoxGeometry(1.5, 0.42, 0.65));
      const frameMat = materials.get('metro_seat_frame', {
        color: 0x334155,
        roughness: 0.65,
        metalness: 0.25,
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(0, 0.21 + 0.1, 0);
      group.add(frameMesh);

      // Two vibrant Basque metro red upholstered seat pads
      const cushionGeo = geometries.get('metro_seat_cushion', () => new THREE.BoxGeometry(0.65, 0.12, 0.52));
      const cushionMat = materials.get('metro_seat_cushion', {
        color: 0xd4182b,
        roughness: 0.45,
        metalness: 0.05,
      });

      const padLeft = new THREE.Mesh(cushionGeo, cushionMat);
      padLeft.position.set(-0.38, 0.47 + 0.1, 0.03);
      group.add(padLeft);

      const padRight = new THREE.Mesh(cushionGeo, cushionMat);
      padRight.position.set(0.38, 0.47 + 0.1, 0.03);
      group.add(padRight);

      // Two contoured backrests
      const backGeo = geometries.get('metro_seat_back', () => new THREE.BoxGeometry(0.65, 0.48, 0.1));
      const backLeft = new THREE.Mesh(backGeo, cushionMat);
      backLeft.position.set(-0.38, 0.75 + 0.1, -0.22);
      group.add(backLeft);

      const backRight = new THREE.Mesh(backGeo, cushionMat);
      backRight.position.set(0.38, 0.75 + 0.1, -0.22);
      group.add(backRight);

      // Stainless steel grab rail and side handles
      const railGeo = geometries.get('metro_seat_rail', () => new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8));
      const steelMat = materials.get('metro_seat_steel', {
        color: 0xd8dbe3,
        roughness: 0.15,
        metalness: 0.9,
      });

      const topRail = new THREE.Mesh(railGeo, steelMat);
      topRail.rotation.z = Math.PI / 2;
      topRail.position.set(0, 1.02 + 0.1, -0.24);
      group.add(topRail);

      // Side armrest posts
      const armGeo = geometries.get('metro_seat_arm', () => new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8));
      const armLeft = new THREE.Mesh(armGeo, steelMat);
      armLeft.position.set(-0.72, 0.65 + 0.1, 0.05);
      group.add(armLeft);

      const armRight = new THREE.Mesh(armGeo, steelMat);
      armRight.position.set(0.72, 0.65 + 0.1, 0.05);
      group.add(armRight);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_POLE: {
      const group = new THREE.Group();

      // Metro floor underneath
      const floor = createMetroFloorMesh();
      group.add(floor);

      // Stainless steel floor-to-ceiling stanchion pole (walkable/non-solid: allows aisle passage without snagging)
      // Height 2.3m, extending from top of floor (Y = 0.1m) to ceiling (Y = 2.4m)
      const poleGeo = geometries.get('metro_pole_body', () => new THREE.CylinderGeometry(0.04, 0.04, 2.3, 12));
      const poleMat = materials.get('metro_pole_steel', {
        color: 0xe2e8f0,
        roughness: 0.1,
        metalness: 0.95,
      });
      const poleMesh = new THREE.Mesh(poleGeo, poleMat);
      poleMesh.position.set(0, 1.25, 0);
      group.add(poleMesh);

      // Floor & ceiling mounting flanges
      // Floor flange sits flush on top of the 0.1m floor slab at Y = 0.12m
      const flangeGeo = geometries.get('metro_pole_flange', () => new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12));
      const flangeFloor = new THREE.Mesh(flangeGeo, poleMat);
      flangeFloor.position.set(0, 0.12, 0);
      group.add(flangeFloor);

      const flangeCeil = new THREE.Mesh(flangeGeo, poleMat);
      flangeCeil.position.set(0, 2.38, 0);
      group.add(flangeCeil);

      // Vibrant yellow tactile grab grip sleeve in middle
      const gripGeo = geometries.get('metro_pole_grip', () => new THREE.CylinderGeometry(0.048, 0.048, 0.6, 12));
      const gripMat = materials.get('metro_tactile_yellow', {
        color: 0xfacc15,
        roughness: 0.45,
        metalness: 0.1,
      });
      const gripMesh = new THREE.Mesh(gripGeo, gripMat);
      gripMesh.position.set(0, 1.25, 0);
      group.add(gripMesh);

      applyShadows(group);
      return group;
    }

    case TileType.METRO_INTERIOR_CEILING: {
      const group = new THREE.Group();
      group.userData.isRoof = true;

      // Curved overhead carriage ceiling arch shell along X
      const ceilGeo = geometries.get('metro_ceil_shell', () => {
        const geo = new THREE.CylinderGeometry(2.2, 2.2, 2.0, 24, 1, false, 0, Math.PI);
        geo.rotateZ(Math.PI / 2);
        return geo;
      });
      const ceilMat = materials.get('metro_ceil_mat', {
        color: 0xd1d5db,
        roughness: 0.55,
        metalness: 0.2,
      });
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
      ceilMesh.position.set(0, 2.5, 0);
      ceilMesh.userData.isRoof = true;
      group.add(ceilMesh);

      // Longitudinal fluorescent emissive lighting strip along X (carriage direction)
      const lightGeo = geometries.get('metro_ceil_light_x', () => new THREE.BoxGeometry(2.0, 0.06, 0.45));
      const lightMat = materials.get('metro_ceil_emissive_light_bright', {
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0xf0f6fc,
        emissiveIntensity: 2.5,
      });
      const lightMesh = new THREE.Mesh(lightGeo, lightMat);
      lightMesh.position.set(0, 2.35, 0);
      lightMesh.userData.isRoof = true;
      group.add(lightMesh);

      // Performance Optimization: Metro interior ceiling uses high-intensity emissive panel (2.5)
      // without instantiating expensive real-time PointLights per block, vastly reducing GPU shader overhead.

      // Overhead handrails on both sides of ceiling along X
      const handrailGeo = geometries.get('metro_ceil_handrail_x', () => new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8));
      const handrailMat = materials.get('metro_pole_steel', {
        color: 0xe2e8f0,
        roughness: 0.1,
        metalness: 0.95,
      });

      const railLeft = new THREE.Mesh(handrailGeo, handrailMat);
      railLeft.rotation.z = Math.PI / 2;
      railLeft.position.set(0, 2.15, -0.65);
      railLeft.userData.isRoof = true;
      group.add(railLeft);

      const railRight = new THREE.Mesh(handrailGeo, handrailMat);
      railRight.rotation.z = Math.PI / 2;
      railRight.position.set(0, 2.15, 0.65);
      railRight.userData.isRoof = true;
      group.add(railRight);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_STONE_PARAPET: {
      const group = new THREE.Group();

      // Rustic weathered stone barrier wall
      const wallGeo = geometries.get('sopelana_parapet_body', () => new THREE.BoxGeometry(2.0, 0.85, 0.48));
      const stoneMat = materials.get('sopelana_parapet_stone', {
        color: 0xb8a287,
        roughness: 0.92,
        metalness: 0.05,
      });
      const wallMesh = new THREE.Mesh(wallGeo, stoneMat);
      wallMesh.position.set(0, 0.425, 0);
      group.add(wallMesh);

      // Chiseled flat sandstone coping slab cap
      const capGeo = geometries.get('sopelana_parapet_cap', () => new THREE.BoxGeometry(2.0, 0.1, 0.62));
      const capMat = materials.get('sopelana_parapet_cap', {
        color: 0x9e886d,
        roughness: 0.85,
        metalness: 0.06,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(0, 0.9, 0);
      group.add(capMesh);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_PAVEMENT: {
      const group = new THREE.Group();

      // Flagstone slab paved promenade surface
      const paveGeo = geometries.get('sopelana_pavement_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
      const paveMat = materials.get('sopelana_pavement_mat', {
        color: 0xc4b7a6,
        roughness: 0.88,
        metalness: 0.04,
      });
      const paveMesh = new THREE.Mesh(paveGeo, paveMat);
      paveMesh.position.y = 0.1;
      group.add(paveMesh);

      // Irregular rustic joint stone pattern strips
      const jointMat = materials.get('sopelana_pavement_joint', {
        color: 0x9c8e7e,
        roughness: 0.95,
        metalness: 0.02,
      });

      const jointGeo1 = geometries.get('sopelana_joint_1', () => new THREE.BoxGeometry(0.04, 0.01, 1.8));
      const joint1 = new THREE.Mesh(jointGeo1, jointMat);
      joint1.position.set(-0.25, 0.205, 0);
      group.add(joint1);

      const jointGeo2 = geometries.get('sopelana_joint_2', () => new THREE.BoxGeometry(1.2, 0.01, 0.04));
      const joint2 = new THREE.Mesh(jointGeo2, jointMat);
      joint2.position.set(0.3, 0.205, 0.4);
      group.add(joint2);

      applyShadows(group);
      return group;
    }

    case TileType.SOPELANA_CLIFF_GRASS: {
      const group = new THREE.Group();

      // Lower flysch coastal shale/rock block
      const rockGeo = geometries.get('sopelana_cliff_rock', () => new THREE.BoxGeometry(2.0, 1.84, 2.0));
      const rockMat = materials.get('sopelana_cliff_rock', {
        color: 0x5c5043,
        roughness: 0.95,
        metalness: 0.05,
      });
      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      rockMesh.position.set(0, 0.92, 0);
      group.add(rockMesh);

      // Lush green coastal clifftop turf crown
      const grassGeo = geometries.get('sopelana_cliff_turf', () => new THREE.BoxGeometry(2.02, 0.18, 2.02));
      const grassMat = materials.get('sopelana_cliff_turf', {
        color: 0x3b7a32,
        roughness: 0.8,
        metalness: 0.02,
      });
      const grassMesh = new THREE.Mesh(grassGeo, grassMat);
      grassMesh.position.set(0, 1.92, 0);
      group.add(grassMesh);

      applyShadows(group);
      return group;
    }

    case TileType.LIGHT_STREET_LAMP: {
      const group = new THREE.Group();
      group.userData = { isLightFixture: true, fixtureType: 'street_lamp' };

      const ironMat = materials.get('street_lamp_iron', {
        color: 0x1a202c,
        roughness: 0.45,
        metalness: 0.85,
      });

      // Octagonal cast-iron decorative base
      const baseGeo = geometries.get('street_lamp_base', () => new THREE.CylinderGeometry(0.24, 0.32, 0.4, 8));
      const baseMesh = new THREE.Mesh(baseGeo, ironMat);
      baseMesh.position.set(0, 0.2, 0);
      group.add(baseMesh);

      // Fluted vertical lamppost shaft (height 2.5m)
      const shaftGeo = geometries.get('street_lamp_shaft', () => new THREE.CylinderGeometry(0.05, 0.075, 2.5, 8));
      const shaftMesh = new THREE.Mesh(shaftGeo, ironMat);
      shaftMesh.position.set(0, 1.65, 0);
      group.add(shaftMesh);

      // Decorative neck and bracket
      const neckGeo = geometries.get('street_lamp_neck', () => new THREE.CylinderGeometry(0.12, 0.05, 0.15, 8));
      const neckMesh = new THREE.Mesh(neckGeo, ironMat);
      neckMesh.position.set(0, 2.95, 0);
      group.add(neckMesh);

      // Emissive lantern head (amber / warm yellow 0xffe082, roughness: 0.2)
      const lanternMat = materials.get('street_lamp_lantern', {
        color: 0xffe082,
        emissive: 0xffe082,
        emissiveIntensity: 2.2,
        roughness: 0.2,
        metalness: 0.1,
      });
      const lanternGeo = geometries.get('street_lamp_lantern', () => new THREE.CylinderGeometry(0.16, 0.11, 0.32, 6));
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
      lanternMesh.position.set(0, 3.12, 0);
      group.add(lanternMesh);

      // Lantern top cap
      const capGeo = geometries.get('street_lamp_cap', () => new THREE.ConeGeometry(0.2, 0.16, 6));
      const capMesh = new THREE.Mesh(capGeo, ironMat);
      capMesh.position.set(0, 3.34, 0);
      group.add(capMesh);

      // Performance Optimization: Streetlamps use high-intensity emissive materials without instantiating
      // expensive real-time Three.js PointLights, vastly reducing GPU fill-rate and draw call overhead.

      applyShadows(group);
      return group;
    }

    case TileType.LIGHT_CEILING_FIXTURE: {
      const group = new THREE.Group();
      group.userData = { isLightFixture: true, fixtureType: 'ceiling_fixture' };

      const baseMat = materials.get('ceiling_fixture_base', {
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.7,
      });

      // Flush-mount ceiling base plate at Y = 2.22m
      const baseGeo = geometries.get('ceiling_fixture_base', () => new THREE.BoxGeometry(0.65, 0.04, 0.65));
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(0, 2.22, 0);
      group.add(baseMesh);

      // Emissive white panel (warm neutral 0xffeedd)
      const panelMat = materials.get('ceiling_fixture_panel_bright', {
        color: 0xffffff,
        emissive: 0xffeedd,
        emissiveIntensity: 2.2,
        roughness: 0.1,
        metalness: 0.05,
      });
      const panelGeo = geometries.get('ceiling_fixture_panel', () => new THREE.BoxGeometry(0.55, 0.05, 0.55));
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.set(0, 2.18, 0);
      group.add(panelMesh);

      // PointLight: warm neutral 0xffeedd, distance 12.0m, intensity 1.8
      const light = new THREE.PointLight(0xffeedd, 1.8, 12.0, 1.2);
      light.position.set(0, 2.1, 0);
      light.userData = { isFixtureLight: true };
      group.add(light);

      applyShadows(group);
      return group;
    }

    case TileType.LIGHT_METRO_NEON: {
      const group = new THREE.Group();
      group.userData = { isLightFixture: true, fixtureType: 'metro_neon', isRoof: true };

      const frameMat = materials.get('metro_neon_frame', {
        color: 0x475569,
        roughness: 0.35,
        metalness: 0.85,
      });

      // Overhead industrial housing channel along X at Y = 2.25m
      const housingGeo = geometries.get('metro_neon_housing_x', () => new THREE.BoxGeometry(2.0, 0.06, 0.45));
      const housingMesh = new THREE.Mesh(housingGeo, frameMat);
      housingMesh.position.set(0, 2.25, 0);
      housingMesh.userData.isRoof = true;
      group.add(housingMesh);

      // Fluorescent tube with bright cool white emissive glow (0xf0f6fc) along X
      const tubeMat = materials.get('metro_neon_tube_bright', {
        color: 0xf0f6fc,
        emissive: 0xf0f6fc,
        emissiveIntensity: 2.5,
        roughness: 0.1,
        metalness: 0.05,
      });
      const tubeGeo = geometries.get('metro_neon_tube_x', () => new THREE.CylinderGeometry(0.04, 0.04, 1.85, 8));
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.rotation.z = Math.PI / 2;
      tubeMesh.position.set(0, 2.19, 0);
      tubeMesh.userData.isRoof = true;
      group.add(tubeMesh);

      // Performance Optimization: Metro neon tube fixtures use high-intensity emissive tubes (2.5)
      // without instantiating expensive real-time PointLights per block, vastly reducing GPU shader overhead.

      applyShadows(group);
      return group;
    }

    case TileType.WATER_BLOCK: {
      const group = new THREE.Group();
      group.userData = { isWaterTile: true };

      const waterMat = materials.get('tile_water_mat', {
        color: 0x187bcd,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0.8,
      });

      // Translucent undulating water volume block
      const waterGeo = geometries.get('tile_water_block', () => new THREE.BoxGeometry(2.0, 1.6, 2.0, 4, 1, 4));
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(0, 0.8, 0);
      waterMesh.userData = { isWaterTile: true };
      waterMesh.receiveShadow = true;
      group.add(waterMesh);

      // Subtle surface foam / ripple border
      const foamMat = materials.get('tile_water_foam', {
        color: 0x93c5fd,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.45,
      });
      const foamGeo = geometries.get('tile_water_foam_geo', () => new THREE.PlaneGeometry(1.92, 1.92));
      const foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.set(0, 1.61, 0);
      foamMesh.rotation.x = -Math.PI / 2;
      group.add(foamMesh);

      return group;
    }

    case TileType.BUILDING_BLOCK_LARGE: {
      const group = new THREE.Group();

      // Main 3-story brick facade monolith (approx 3x3 tiles = 5.8m x 9.0m x 5.8m)
      const brickMat = materials.get('tile_building_large_brick', {
        color: 0x8b3a2b, // Basque terracotta red brick
        roughness: 0.85,
        metalness: 0.1,
      });
      const bodyGeo = geometries.get('tile_building_large_body', () => new THREE.BoxGeometry(5.8, 9.0, 5.8));
      const body = new THREE.Mesh(bodyGeo, brickMat);
      body.position.set(0, 4.5, 0);
      group.add(body);

      // Stone Ground Plinth (First 0.8m)
      const plinthMat = materials.get('tile_building_large_plinth', {
        color: 0x475569, // Gray stone foundation
        roughness: 0.9,
      });
      const plinthGeo = geometries.get('tile_building_large_plinth_geo', () => new THREE.BoxGeometry(5.95, 0.8, 5.95));
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.set(0, 0.4, 0);
      group.add(plinth);

      // Roof Gravel / Parapet Cap (height 9.2m)
      const roofMat = materials.get('tile_building_large_roof', {
        color: 0x334155,
        roughness: 0.95,
      });
      const roofGeo = geometries.get('tile_building_large_roof_geo', () => new THREE.BoxGeometry(5.9, 0.4, 5.9));
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 9.1, 0);
      group.add(roof);

      // Windows and Balconies
      const windowMat = materials.get('tile_building_large_window', {
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.2,
      });
      const windowLightMat = materials.get('tile_building_large_window_light', {
        color: 0xfef08a,
        emissive: 0xfef08a,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      });
      const balconyMat = materials.get('tile_building_large_balcony', {
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.4,
      });

      const winGeo = geometries.get('tile_building_win_geo', () => new THREE.BoxGeometry(0.9, 1.2, 0.1));
      const balconyGeo = geometries.get('tile_building_balcony_geo', () => new THREE.BoxGeometry(1.2, 0.12, 0.6));
      const railingGeo = geometries.get('tile_building_railing_geo', () => new THREE.BoxGeometry(1.2, 0.6, 0.05));

      const floorYLevels = [2.4, 5.2, 7.6];
      const xOffsets = [-1.8, 0, 1.8];

      // Front (+Z) & Back (-Z) Facades
      for (const fz of [2.92, -2.92]) {
        for (let fi = 0; fi < floorYLevels.length; fi++) {
          const fy = floorYLevels[fi];
          for (let xi = 0; xi < xOffsets.length; xi++) {
            const xo = xOffsets[xi];
            const useLight = (fi + xi) % 3 === 0;
            const win = new THREE.Mesh(winGeo, useLight ? windowLightMat : windowMat);
            win.position.set(xo, fy, fz);
            group.add(win);

            // Add balcony to second floor windows
            if (fi === 1) {
              const bZ = fz > 0 ? fz + 0.3 : fz - 0.3;
              const rZ = fz > 0 ? fz + 0.6 : fz - 0.6;
              const balc = new THREE.Mesh(balconyGeo, balconyMat);
              balc.position.set(xo, fy - 0.6, bZ);
              group.add(balc);

              const rail = new THREE.Mesh(railingGeo, balconyMat);
              rail.position.set(xo, fy - 0.3, rZ);
              group.add(rail);
            }
          }
        }
      }

      applyShadows(group);
      return group;
    }

    case TileType.SUBURBAN_HOUSE: {
      const group = new THREE.Group();

      // 2-story Basque suburban house module (size ~ 3.8m x 5.8m footprint, height 6.0m)
      const wallMat = materials.get('tile_suburban_wall', {
        color: 0xf1f5f9, // Warm off-white stucco
        roughness: 0.9,
      });
      const wallGeo = geometries.get('tile_suburban_wall_geo', () => new THREE.BoxGeometry(3.8, 3.8, 5.8));
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(0, 1.9, 0);
      group.add(wall);

      // Stone plinth base
      const plinthMat = materials.get('tile_suburban_plinth', {
        color: 0x64748b, // Basque gray stone
        roughness: 0.9,
      });
      const plinthGeo = geometries.get('tile_suburban_plinth_geo', () => new THREE.BoxGeometry(3.95, 0.6, 5.95));
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.set(0, 0.3, 0);
      group.add(plinth);

      // Basque timber framework accents (dark brown beams)
      const timberMat = materials.get('tile_suburban_timber', {
        color: 0x451a03,
        roughness: 0.7,
      });
      const beamGeo = geometries.get('tile_suburban_beam_geo', () => new THREE.BoxGeometry(3.85, 0.15, 5.85));
      const beam = new THREE.Mesh(beamGeo, timberMat);
      beam.position.set(0, 2.8, 0);
      group.add(beam);

      // Pitched Terracotta Roof (Gable roof, ridge along Z)
      const roofMat = materials.get('tile_suburban_roof', {
        color: 0xc2410c, // Basque terracotta orange/red
        roughness: 0.75,
      });
      const roofGeo = geometries.get('tile_suburban_roof_geo', () => {
        const prism = new THREE.CylinderGeometry(0, 2.4, 6.2, 4, 1, false, 0);
        prism.rotateY(Math.PI / 4);
        prism.scale(1.2, 1.0, 0.9);
        return prism;
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 4.8, 0);
      group.add(roof);

      // Wooden Window Shutters (Basque green)
      const shutterMat = materials.get('tile_suburban_shutter', {
        color: 0x15803d, // Basque green shutters
        roughness: 0.6,
      });
      const glassMat = materials.get('tile_suburban_glass', {
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.2,
      });

      const winGeo = geometries.get('tile_suburban_win_geo', () => new THREE.BoxGeometry(0.8, 0.9, 0.1));
      const shutterGeo = geometries.get('tile_suburban_shutter_geo', () => new THREE.BoxGeometry(0.28, 0.9, 0.08));

      for (const zOffset of [-1.8, 0, 1.8]) {
        for (const xSide of [1.92, -1.92]) {
          const win = new THREE.Mesh(winGeo, glassMat);
          win.position.set(xSide, 2.0, zOffset);
          win.rotateY(Math.PI / 2);
          group.add(win);

          const s1 = new THREE.Mesh(shutterGeo, shutterMat);
          s1.position.set(xSide, 2.0, zOffset - 0.5);
          s1.rotateY(Math.PI / 2);
          group.add(s1);

          const s2 = new THREE.Mesh(shutterGeo, shutterMat);
          s2.position.set(xSide, 2.0, zOffset + 0.5);
          s2.rotateY(Math.PI / 2);
          group.add(s2);
        }
      }

      applyShadows(group);
      return group;
    }

    case TileType.HEDGE_ROW: {
      const group = new THREE.Group();

      // Lush green perimeter garden hedge (blocks path, height 1.2m)
      const hedgeMat = materials.get('tile_hedge_mat', {
        color: 0x15803d, // Deep garden green
        roughness: 0.85,
        metalness: 0.05,
      });
      const hedgeGeo = geometries.get('tile_hedge_geo', () => new THREE.BoxGeometry(1.9, 1.2, 1.9));
      const hedge = new THREE.Mesh(hedgeGeo, hedgeMat);
      hedge.position.set(0, 0.6, 0);
      group.add(hedge);

      // Lighter foliage clumps on top
      const clumpMat = materials.get('tile_hedge_clump', {
        color: 0x22c55e,
        roughness: 0.8,
      });
      const clumpGeo = geometries.get('tile_hedge_clump_geo', () => new THREE.SphereGeometry(0.35, 6, 6));

      const offsets = [
        [-0.45, 1.15, -0.45],
        [0.4, 1.18, 0.35],
        [-0.3, 1.14, 0.4],
        [0.35, 1.16, -0.4],
      ];
      for (const [cx, cy, cz] of offsets) {
        const clump = new THREE.Mesh(clumpGeo, clumpMat);
        clump.position.set(cx, cy, cz);
        clump.scale.set(1.1, 0.7, 1.1);
        group.add(clump);
      }

      applyShadows(group);
      return group;
    }

    case TileType.RELIC_MUSHROOM:
      return createMushroomRelicMesh();

    case TileType.RELIC_JOINT:
      return createJointRelicMesh();

    case TileType.DOWNTOWN_ROAD_MULTILANE:
      return createMultiLaneRoadMesh();

    case TileType.APARTMENT_WALL:
      return createApartmentWallMesh();

    case TileType.APARTMENT_CORNER_WALL:
      return createApartmentCornerWallMesh();

    case TileType.WALL_PILLAR:
    case TileType.APARTMENT_PILLAR:
      return createApartmentPillarMesh();

    case TileType.APARTMENT_FLOOR:
      return createApartmentFloorMesh();

    case TileType.FURNITURE_SOFA:
      return createFurnitureSofaMesh();

    case TileType.FURNITURE_KITCHEN_COUNTER:
      return createFurnitureKitchenCounterMesh();

    case TileType.FURNITURE_BED:
      return createFurnitureBedMesh();

    case TileType.FURNITURE_DINING_TABLE:
      return createFurnitureDiningTableMesh();

    case TileType.APARTMENT_BALCONY_RAILING:
      return createApartmentBalconyRailingMesh();

    case TileType.FURNITURE_KITCHEN_STOVE:
      return createFurnitureKitchenStoveMesh();

    case TileType.FURNITURE_TV_STAND:
      return createFurnitureTVStandMesh();

    case TileType.GROCERY_SHELF:
      return createGroceryShelfMesh();

    case TileType.GROCERY_COUNTER:
      return createGroceryCounterMesh();

    case TileType.SUBURBAN_VILLA:
      return createSuburbanVillaMesh();

    case TileType.METRO_GLASS_PARTITION:
      return createMetroGlassPartitionMesh();

    case TileType.METRO_FLOOR:
    case TileType.FLOOR_METRO:
      return createMetroFloorMesh();

    case TileType.DOOR_APARTMENT:
      return createDoorApartmentMesh();

    case TileType.DOOR_STORE:
      return createDoorStoreMesh();

    case TileType.DOOR_METRO:
      return createDoorMetroMesh();

    case TileType.DOOR_SUBURBAN_GATE:
      return createDoorSuburbanGateMesh();

    case TileType.DOOR_SOPELANA_IRON:
      return createDoorSopelanaIronMesh();

    case TileType.SWITCH_BUTTON:
      return createSwitchButtonMesh();

    // Floor Attachments (Decals / Rugs)
    case TileType.RUG_PERSIAN:
      return createRugPersianMesh();
    case TileType.RUG_BATH_MAT:
      return createRugBathMatMesh();
    case TileType.RUG_MODERN:
      return createRugModernMesh();
    case TileType.BEACH_TOWEL_BLUE:
      return createBeachTowelBlueMesh();
    case TileType.BEACH_TOWEL_STRIPED:
      return createBeachTowelStripedMesh();

    // Wall Attachments (Paintings / Signs)
    case TileType.WALL_ART_PSYCHEDELIC:
      return createWallArtPsychedelicMesh();
    case TileType.WALL_ART_BASQUE_MAP:
      return createWallArtBasqueMapMesh();
    case TileType.WALL_ART_POSTER:
      return createWallArtPosterMesh();
    case TileType.STORE_SIGN_NEON:
      return createStoreSignNeonMesh();
    case TileType.KEYPAD_TERMINAL:
      return createKeypadTerminalMesh();
    case TileType.STICKY_NOTE_CLUE:
      return createStickyNoteClueMesh();

    // Modular & Interior Furniture
    case TileType.WARDROBE:
      return createWardrobeMesh();
    case TileType.DRESSER:
      return createDresserMesh();
    case TileType.NIGHTSTAND:
      return createNightstandMesh();
    case TileType.SOFA_CORNER:
      return createSofaCornerMesh();
    case TileType.SOFA_STRAIGHT:
      return createSofaStraightMesh();
    case TileType.SOFA_CHAISE:
      return createSofaChaiseMesh();
    case TileType.KITCHEN_COUNTER_SINK:
      return createKitchenCounterSinkMesh();
    case TileType.KITCHEN_COUNTER_STOVE:
      return createKitchenCounterStoveMesh();
    case TileType.KITCHEN_COUNTER_STRAIGHT:
      return createKitchenCounterStraightMesh();
    case TileType.KITCHEN_UPPER_CABINET:
      return createKitchenUpperCabinetMesh();
    case TileType.POTTED_MONSTERA:
      return createPottedMonsteraMesh();
    case TileType.POTTED_FICUS:
      return createPottedFicusMesh();

    // Grocery Store & Urban Retail
    case TileType.GROCERY_MEAT_DISPLAY:
      return createGroceryMeatDisplayMesh();
    case TileType.GROCERY_VEG_STAND:
      return createGroceryVegStandMesh();
    case TileType.GROCERY_DRINK_FRIDGE:
      return createGroceryDrinkFridgeMesh();
    case TileType.STORE_CHECKOUT_DESK:
      return createStoreCheckoutDeskMesh();

    // Coastal Beach Assets
    case TileType.BEACH_UMBRELLA:
      return createBeachUmbrellaMesh();
    case TileType.BEACH_TOWEL:
      return createBeachTowelPropMesh();
    case TileType.BEACH_COOLER:
      return createBeachCoolerMesh();
    case TileType.COASTAL_CLIFF_BUSH:
      return createCoastalCliffBushMesh();

    case TileType.HEAVY_OBSTACLE:
      return createHeavyObstacleMesh();

    // Etxebarria Park & Hillside Assets
    case TileType.CONCRETE_RETAINING_WALL:
      return createConcreteRetainingWallMesh();

    case TileType.SOCCER_PITCH_TURF:
      return createSoccerPitchTurfMesh();

    case TileType.SOCCER_FLOODLIGHT:
      return createSoccerFloodlightMesh();

    case TileType.WALL_CHILL_SPOT:
      return createWallChillSpotMesh();

    default:
      return null;
  }
}

export function createMushroomRelicMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Relic_Mushroom';
  group.userData.relicType = 'mushroom';

  // Load 2.5D illustrated mushroom sprite texture
  const texture = textures.get('/textures/relic_mushroom.png');

  // Geometry: PlaneGeometry (width: 0.85m, height: 0.85m)
  const planeGeo = geometries.get('relic_shroom_plane_085', () => new THREE.PlaneGeometry(0.85, 0.85));

  // Material: MeshBasicMaterial for 100% vibrant, full-bright illustrated rendering
  const planeMat = materials.get('relic_shroom_sprite_mat', {
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
  });

  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.position.set(0, 0.55, 0);
  planeMesh.renderOrder = 9;
  group.add(planeMesh);

  // 1. Tall vertical glowing beacon light pillar (height 2.8m)
  const beaconGeo = geometries.get('relic_shroom_beacon_geo', () => {
    const g = new THREE.CylinderGeometry(0.28, 0.45, 2.8, 16, 1, true);
    g.translate(0, 1.4, 0);
    return g;
  });
  const beaconMat = materials.get('relic_shroom_beacon_mat', {
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.userData.isRelicBeacon = true;
  group.add(beaconMesh);

  // 2. Hovering rotating diamond star marker at Y = 1.6m
  const markerGeo = geometries.get('relic_shroom_marker_geo', () => new THREE.OctahedronGeometry(0.18, 0));
  const markerMat = materials.get('relic_shroom_marker_mat', {
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const markerMesh = new THREE.Mesh(markerGeo, markerMat);
  markerMesh.position.set(0, 1.6, 0);
  markerMesh.userData.isRelicMarker = true;
  group.add(markerMesh);

  // 3. Attached PointLight with high range and gentle aura glow
  const auraLight = new THREE.PointLight(0x38bdf8, 2.2, 5.5);
  auraLight.position.set(0, 0.6, 0.04);
  group.add(auraLight);
  group.userData.light = auraLight;

  // 4. Gentle glowing ground halo aura disc
  const haloGeo = geometries.get('relic_shroom_halo_disc', () => {
    const g = new THREE.RingGeometry(0.12, 0.65, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const haloMat = materials.get('relic_shroom_halo_disc_mat', {
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.04;
  group.add(haloMesh);

  applyShadows(group);
  return group;
}

export function createJointRelicMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Relic_Joint';
  group.userData.relicType = 'joint';

  // Load 2.5D illustrated joint sprite texture
  const texture = textures.get('/textures/relic_joint.png');

  // Geometry: PlaneGeometry (width: 0.95m, height: 0.95m)
  const planeGeo = geometries.get('relic_joint_plane_095', () => new THREE.PlaneGeometry(0.95, 0.95));

  // Material: MeshBasicMaterial for 100% vibrant, full-bright illustrated rendering
  const planeMat = materials.get('relic_joint_sprite_mat', {
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
  });

  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.position.set(0, 0.6, 0);
  planeMesh.renderOrder = 9;
  group.add(planeMesh);

  // 1. Tall vertical glowing beacon light pillar (height 2.8m, warm golden amber)
  const beaconGeo = geometries.get('relic_joint_beacon_geo', () => {
    const g = new THREE.CylinderGeometry(0.28, 0.45, 2.8, 16, 1, true);
    g.translate(0, 1.4, 0);
    return g;
  });
  const beaconMat = materials.get('relic_joint_beacon_mat', {
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.userData.isRelicBeacon = true;
  group.add(beaconMesh);

  // 2. Hovering rotating diamond star marker at Y = 1.6m (golden)
  const markerGeo = geometries.get('relic_joint_marker_geo', () => new THREE.OctahedronGeometry(0.18, 0));
  const markerMat = materials.get('relic_joint_marker_mat', {
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const markerMesh = new THREE.Mesh(markerGeo, markerMat);
  markerMesh.position.set(0, 1.6, 0);
  markerMesh.userData.isRelicMarker = true;
  group.add(markerMesh);

  // 3. Attached PointLight at the ember tip (color: 0xff3b00, intensity: 2.4, distance: 6.0m)
  const emberLight = new THREE.PointLight(0xff3b00, 2.4, 6.0);
  emberLight.position.set(0.18, 0.72, 0.04);
  group.add(emberLight);
  group.userData.light = emberLight;

  // 4. Ground halo aura disc
  const haloGeo = geometries.get('relic_joint_halo_disc', () => {
    const g = new THREE.RingGeometry(0.12, 0.65, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const haloMat = materials.get('relic_joint_halo_disc_mat', {
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.04;
  group.add(haloMesh);

  // 5. Subtle rising smoke rings floating from the glowing ember tip
  const smokeGroup = new THREE.Group();
  smokeGroup.name = 'JointSmoke';
  const smokeMat = materials.get('relic_joint_smoke_mat', {
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.45,
    roughness: 0.9,
  });

  const smokeMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ringGeo = geometries.get(`relic_joint_smoke_ring_${i}`, () =>
      new THREE.TorusGeometry(0.04 + i * 0.025, 0.01, 6, 16)
    );
    const ringMesh = new THREE.Mesh(ringGeo, smokeMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(
      0.18 + (Math.random() - 0.5) * 0.04,
      0.78 + i * 0.16,
      0.04 + (Math.random() - 0.5) * 0.04
    );
    smokeGroup.add(ringMesh);
    smokeMeshes.push(ringMesh);
  }
  group.add(smokeGroup);
  group.userData.smokeMeshes = smokeMeshes;

  applyShadows(group);
  return group;
}

export function createMultiLaneRoadMesh(): THREE.Group {
  const group = new THREE.Group();

  // Dark asphalt base (2.0 x 0.2 x 2.0)
  const roadGeo = geometries.get('downtown_road_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
  const roadMat = materials.get('downtown_road_base', {
    color: 0x22232a,
    roughness: 0.85,
    metalness: 0.1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.y = 0.1;
  group.add(roadMesh);

  // Dashed white center lane line (parallel to X axis)
  const dashGeo = geometries.get('multilane_road_dash', () => new THREE.BoxGeometry(1.2, 0.01, 0.08));
  const dashMat = materials.get('multilane_road_dash_mat', {
    color: 0xf8fafc,
    roughness: 0.5,
    metalness: 0.05,
  });
  const dashMesh = new THREE.Mesh(dashGeo, dashMat);
  dashMesh.position.set(0, 0.206, 0);
  group.add(dashMesh);

  // Outer boundary line along Z edges
  const edgeGeo = geometries.get('multilane_road_edge', () => new THREE.BoxGeometry(2.0, 0.01, 0.06));
  const edgeMat = materials.get('multilane_road_edge_mat', {
    color: 0xe2e8f0,
    roughness: 0.6,
  });
  const edgeTop = new THREE.Mesh(edgeGeo, edgeMat);
  edgeTop.position.set(0, 0.206, 0.94);
  group.add(edgeTop);

  const edgeBot = new THREE.Mesh(edgeGeo, edgeMat);
  edgeBot.position.set(0, 0.206, -0.94);
  group.add(edgeBot);

  applyShadows(group);
  return group;
}

export function createApartmentWallMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isWall = true;
  group.userData.isOccluder = true;

  // Solid oak parquet floor underneath drywall partition
  const floor = createApartmentFloorMesh();
  floor.traverse((c) => {
    c.userData.isFloor = true;
  });
  group.add(floor);

  // Drywall partition (2.5 x 3.2 x 0.28) - generous centered overlap (0.25m past each boundary) to fully penetrate crossing wall cores
  const wallGeo = geometries.get('apt_wall_drywall_32_wide_25', () => new THREE.BoxGeometry(2.5, 3.2, 0.28));
  const wallMat = materials.get('apt_wall_plaster_mat', {
    color: 0xf3ede2, // Warm cream plaster
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 1.0,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(0, 1.6, 0);
  wallMesh.castShadow = false;
  wallMesh.receiveShadow = true;
  wallMesh.userData.isWall = true;
  wallMesh.userData.isOccluder = true;
  group.add(wallMesh);

  // Dark oak baseboard molding trim along bottom (2.52 x 0.12 x 0.32) at y = 0.06
  const baseboardGeo = geometries.get('apt_wall_baseboard_32_wide_25', () => new THREE.BoxGeometry(2.52, 0.12, 0.32));
  const baseboardMat = materials.get('apt_wall_baseboard_mat', {
    color: 0x3e2723, // Dark oak trim
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });
  const baseboardMesh = new THREE.Mesh(baseboardGeo, baseboardMat);
  baseboardMesh.position.set(0, 0.06, 0);
  baseboardMesh.userData.isWall = true;
  group.add(baseboardMesh);

  // Crown molding trim at ceiling (2.52 x 0.08 x 0.32) at y = 3.16
  const crownGeo = geometries.get('apt_wall_crown_32_wide_25', () => new THREE.BoxGeometry(2.52, 0.08, 0.32));
  const crownMat = materials.get('apt_wall_crown_mat', {
    color: 0xe8dfd1,
    roughness: 0.7,
    transparent: true,
    opacity: 1.0,
  });
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.set(0, 3.16, 0);
  crownMesh.userData.isWall = true;
  group.add(crownMesh);

  applyShadows(group);
  return group;
}

export function createApartmentCornerWallMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isWall = true;
  group.userData.isOccluder = true;

  // Solid oak parquet floor underneath corner junction
  const floor = createApartmentFloorMesh();
  floor.traverse((c) => {
    c.userData.isFloor = true;
  });
  group.add(floor);

  const wallMat = materials.get('apt_wall_plaster_mat', {
    color: 0xf3ede2,
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 1.0,
  });

  const baseboardMat = materials.get('apt_wall_baseboard_mat', {
    color: 0x3e2723,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });

  const crownMat = materials.get('apt_wall_crown_mat', {
    color: 0xe8dfd1,
    roughness: 0.7,
    transparent: true,
    opacity: 1.0,
  });

  // Central corner pillar (0.38 x 3.2 x 0.38)
  const pillarGeo = geometries.get('apt_corner_pillar_wide', () => new THREE.BoxGeometry(0.38, 3.2, 0.38));
  const pillarMesh = new THREE.Mesh(pillarGeo, wallMat);
  pillarMesh.position.set(0, 1.6, 0);
  pillarMesh.receiveShadow = true;
  pillarMesh.userData.isWall = true;
  pillarMesh.userData.isOccluder = true;
  group.add(pillarMesh);

  // Pillar baseboard (0.42 x 0.12 x 0.42)
  const pillarBaseGeo = geometries.get('apt_corner_pillar_base_wide', () => new THREE.BoxGeometry(0.42, 0.12, 0.42));
  const pillarBaseMesh = new THREE.Mesh(pillarBaseGeo, baseboardMat);
  pillarBaseMesh.position.set(0, 0.06, 0);
  pillarBaseMesh.userData.isWall = true;
  group.add(pillarBaseMesh);

  // Pillar crown (0.42 x 0.08 x 0.42)
  const pillarCrownGeo = geometries.get('apt_corner_pillar_crown_wide', () => new THREE.BoxGeometry(0.42, 0.08, 0.42));
  const pillarCrownMesh = new THREE.Mesh(pillarCrownGeo, crownMat);
  pillarCrownMesh.position.set(0, 3.16, 0);
  pillarCrownMesh.userData.isWall = true;
  group.add(pillarCrownMesh);

  // Wing 1 along +X (length 1.15, width 0.28, centered at x = 0.575, z = 0)
  const wingXGeo = geometries.get('apt_corner_wing_x_wide', () => new THREE.BoxGeometry(1.15, 3.2, 0.28));
  const wingXMesh = new THREE.Mesh(wingXGeo, wallMat);
  wingXMesh.position.set(0.575, 1.6, 0);
  wingXMesh.receiveShadow = true;
  wingXMesh.userData.isWall = true;
  wingXMesh.userData.isOccluder = true;
  group.add(wingXMesh);

  const wingXBaseGeo = geometries.get('apt_corner_wing_x_base_wide', () => new THREE.BoxGeometry(1.15, 0.12, 0.32));
  const wingXBaseMesh = new THREE.Mesh(wingXBaseGeo, baseboardMat);
  wingXBaseMesh.position.set(0.575, 0.06, 0);
  wingXBaseMesh.userData.isWall = true;
  group.add(wingXBaseMesh);

  const wingXCrownGeo = geometries.get('apt_corner_wing_x_crown_wide', () => new THREE.BoxGeometry(1.15, 0.08, 0.32));
  const wingXCrownMesh = new THREE.Mesh(wingXCrownGeo, crownMat);
  wingXCrownMesh.position.set(0.575, 3.16, 0);
  wingXCrownMesh.userData.isWall = true;
  group.add(wingXCrownMesh);

  // Wing 2 along +Z (length 1.15, width 0.28, centered at x = 0, z = 0.575)
  const wingZGeo = geometries.get('apt_corner_wing_z_wide', () => new THREE.BoxGeometry(0.28, 3.2, 1.15));
  const wingZMesh = new THREE.Mesh(wingZGeo, wallMat);
  wingZMesh.position.set(0, 1.6, 0.575);
  wingZMesh.receiveShadow = true;
  wingZMesh.userData.isWall = true;
  wingZMesh.userData.isOccluder = true;
  group.add(wingZMesh);

  const wingZBaseGeo = geometries.get('apt_corner_wing_z_base_wide', () => new THREE.BoxGeometry(0.32, 0.12, 1.15));
  const wingZBaseMesh = new THREE.Mesh(wingZBaseGeo, baseboardMat);
  wingZBaseMesh.position.set(0, 0.06, 0.575);
  wingZBaseMesh.userData.isWall = true;
  group.add(wingZBaseMesh);

  const wingZCrownGeo = geometries.get('apt_corner_wing_z_crown_wide', () => new THREE.BoxGeometry(0.32, 0.08, 1.15));
  const wingZCrownMesh = new THREE.Mesh(wingZCrownGeo, crownMat);
  wingZCrownMesh.position.set(0, 3.16, 0.575);
  wingZCrownMesh.userData.isWall = true;
  group.add(wingZCrownMesh);

  applyShadows(group);
  return group;
}

/**
 * Dedicated vertical junction pillar cap (0.36m x 3.2m x 0.36m)
 * Placed at wall intersection coordinates to seamlessly cap T-junctions and perpendicular joints.
 */
export function createApartmentPillarMesh(wings?: { posX?: boolean; negX?: boolean; posZ?: boolean; negZ?: boolean }): THREE.Group {
  const group = new THREE.Group();
  group.userData.isWall = true;
  group.userData.isOccluder = true;

  // Solid oak floor underneath
  const floor = createApartmentFloorMesh();
  floor.traverse((c) => {
    c.userData.isFloor = true;
  });
  group.add(floor);

  const wallMat = materials.get('apt_wall_plaster_mat', {
    color: 0xf3ede2,
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 1.0,
  });

  const baseboardMat = materials.get('apt_wall_baseboard_mat', {
    color: 0x3e2723,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });

  const crownMat = materials.get('apt_wall_crown_mat', {
    color: 0xe8dfd1,
    roughness: 0.7,
    transparent: true,
    opacity: 1.0,
  });

  // Central junction pillar (0.44 x 3.2 x 0.44)
  const pillarGeo = geometries.get('apt_junc_pillar_44', () => new THREE.BoxGeometry(0.44, 3.2, 0.44));
  const pillarMesh = new THREE.Mesh(pillarGeo, wallMat);
  pillarMesh.position.set(0, 1.6, 0);
  pillarMesh.receiveShadow = true;
  pillarMesh.userData.isWall = true;
  pillarMesh.userData.isOccluder = true;
  group.add(pillarMesh);

  // Baseboard trim (0.48 x 0.12 x 0.48)
  const baseGeo = geometries.get('apt_junc_pillar_base_48', () => new THREE.BoxGeometry(0.48, 0.12, 0.48));
  const baseMesh = new THREE.Mesh(baseGeo, baseboardMat);
  baseMesh.position.set(0, 0.06, 0);
  baseMesh.userData.isWall = true;
  group.add(baseMesh);

  // Crown trim (0.48 x 0.08 x 0.48)
  const crownGeo = geometries.get('apt_junc_pillar_crown_48', () => new THREE.BoxGeometry(0.48, 0.08, 0.48));
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.set(0, 3.16, 0);
  crownMesh.userData.isWall = true;
  group.add(crownMesh);

  // Optional Directional Connector Wings:
  // Each wing extends 1.15m from center (penetrates 0.40m into adjacent 2.5m wall)
  const wingXGeo = geometries.get('apt_junc_wing_x_115', () => new THREE.BoxGeometry(1.15, 3.2, 0.28));
  const wingZGeo = geometries.get('apt_junc_wing_z_115', () => new THREE.BoxGeometry(0.28, 3.2, 1.15));
  const wingXBaseGeo = geometries.get('apt_junc_wing_x_base_115', () => new THREE.BoxGeometry(1.15, 0.12, 0.32));
  const wingZBaseGeo = geometries.get('apt_junc_wing_z_base_115', () => new THREE.BoxGeometry(0.32, 0.12, 1.15));
  const wingXCrownGeo = geometries.get('apt_junc_wing_x_crown_115', () => new THREE.BoxGeometry(1.15, 0.08, 0.32));
  const wingZCrownGeo = geometries.get('apt_junc_wing_z_crown_115', () => new THREE.BoxGeometry(0.32, 0.08, 1.15));

  if (wings?.posX) {
    const w = new THREE.Mesh(wingXGeo, wallMat);
    w.position.set(0.575, 1.6, 0);
    w.userData.isWall = true;
    w.userData.isOccluder = true;
    group.add(w);
    const b = new THREE.Mesh(wingXBaseGeo, baseboardMat);
    b.position.set(0.575, 0.06, 0);
    b.userData.isWall = true;
    group.add(b);
    const c = new THREE.Mesh(wingXCrownGeo, crownMat);
    c.position.set(0.575, 3.16, 0);
    c.userData.isWall = true;
    group.add(c);
  }
  if (wings?.negX) {
    const w = new THREE.Mesh(wingXGeo, wallMat);
    w.position.set(-0.575, 1.6, 0);
    w.userData.isWall = true;
    w.userData.isOccluder = true;
    group.add(w);
    const b = new THREE.Mesh(wingXBaseGeo, baseboardMat);
    b.position.set(-0.575, 0.06, 0);
    b.userData.isWall = true;
    group.add(b);
    const c = new THREE.Mesh(wingXCrownGeo, crownMat);
    c.position.set(-0.575, 3.16, 0);
    c.userData.isWall = true;
    group.add(c);
  }
  if (wings?.posZ) {
    const w = new THREE.Mesh(wingZGeo, wallMat);
    w.position.set(0, 1.6, 0.575);
    w.userData.isWall = true;
    w.userData.isOccluder = true;
    group.add(w);
    const b = new THREE.Mesh(wingZBaseGeo, baseboardMat);
    b.position.set(0, 0.06, 0.575);
    b.userData.isWall = true;
    group.add(b);
    const c = new THREE.Mesh(wingZCrownGeo, crownMat);
    c.position.set(0, 3.16, 0.575);
    c.userData.isWall = true;
    group.add(c);
  }
  if (wings?.negZ) {
    const w = new THREE.Mesh(wingZGeo, wallMat);
    w.position.set(0, 1.6, -0.575);
    w.userData.isWall = true;
    w.userData.isOccluder = true;
    group.add(w);
    const b = new THREE.Mesh(wingZBaseGeo, baseboardMat);
    b.position.set(0, 0.06, -0.575);
    b.userData.isWall = true;
    group.add(b);
    const c = new THREE.Mesh(wingZCrownGeo, crownMat);
    c.position.set(0, 3.16, -0.575);
    c.userData.isWall = true;
    group.add(c);
  }

  applyShadows(group);
  return group;
}

export const createWallPillarMesh = createApartmentPillarMesh;

export const createWallInteriorMesh = createApartmentWallMesh;

export function createApartmentFloorMesh(): THREE.Group {
  const group = new THREE.Group();

  // Hardwood oak parquet flooring (2.0 x 0.1 x 2.0)
  const floorGeo = geometries.get('apt_floor_parquet', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
  const floorMat = materials.get('apt_floor_parquet_mat', {
    color: 0xbd8b57, // Warm oak wood
    roughness: 0.45,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0.05;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Subtle inlaid parquet board dividers
  const seamGeo = geometries.get('apt_floor_seam', () => new THREE.BoxGeometry(2.0, 0.005, 0.015));
  const seamMat = materials.get('apt_floor_seam_mat', {
    color: 0x935f34,
    roughness: 0.8,
  });
  const seam1 = new THREE.Mesh(seamGeo, seamMat);
  seam1.position.set(0, 0.103, -0.5);
  group.add(seam1);

  const seam2 = new THREE.Mesh(seamGeo, seamMat);
  seam2.position.set(0, 0.103, 0.5);
  group.add(seam2);

  return group;
}

export function createFurnitureSofaMesh(): THREE.Group {
  const group = new THREE.Group();

  // Parquet floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Plush sofa main seat cushion
  const seatGeo = geometries.get('sofa_seat', () => new THREE.BoxGeometry(1.7, 0.35, 0.85));
  const sofaMat = materials.get('sofa_fabric_teal', {
    color: 0x0e7490, // Deep cyan/teal fabric
    roughness: 0.82,
    metalness: 0.05,
  });
  const seatMesh = new THREE.Mesh(seatGeo, sofaMat);
  seatMesh.position.set(0, 0.35, 0.05);
  seatMesh.castShadow = true;
  group.add(seatMesh);

  // Backrest cushion
  const backGeo = geometries.get('sofa_back', () => new THREE.BoxGeometry(1.7, 0.55, 0.25));
  const backMesh = new THREE.Mesh(backGeo, sofaMat);
  backMesh.position.set(0, 0.65, -0.28);
  backMesh.castShadow = true;
  group.add(backMesh);

  // Left & Right Armrests
  const armGeo = geometries.get('sofa_arm', () => new THREE.BoxGeometry(0.2, 0.45, 0.9));
  const armL = new THREE.Mesh(armGeo, sofaMat);
  armL.position.set(-0.85, 0.5, 0.05);
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, sofaMat);
  armR.position.set(0.85, 0.5, 0.05);
  armR.castShadow = true;
  group.add(armR);

  // 4 wooden peg legs
  const legGeo = geometries.get('sofa_leg', () => new THREE.CylinderGeometry(0.04, 0.025, 0.18, 8));
  const legMat = materials.get('furniture_wood_leg', {
    color: 0x451a03,
    roughness: 0.6,
  });
  const legPositions = [
    [-0.75, 0.09, -0.32],
    [0.75, 0.09, -0.32],
    [-0.75, 0.09, 0.42],
    [0.75, 0.09, 0.42],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  // Cozy decorative throw pillow
  const pillowGeo = geometries.get('sofa_pillow', () => new THREE.BoxGeometry(0.35, 0.35, 0.12));
  const pillowMat = materials.get('sofa_pillow_gold', {
    color: 0xf59e0b, // Golden velvet
    roughness: 0.7,
  });
  const pillow = new THREE.Mesh(pillowGeo, pillowMat);
  pillow.position.set(-0.55, 0.58, -0.15);
  pillow.rotation.set(0.2, 0.3, 0.1);
  group.add(pillow);

  applyShadows(group);
  return group;
}

export function createFurnitureKitchenCounterMesh(): THREE.Group {
  const group = new THREE.Group();

  // Parquet floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Lower cabinet base (charcoal slate)
  const cabGeo = geometries.get('kitchen_cab', () => new THREE.BoxGeometry(1.85, 0.82, 0.85));
  const cabMat = materials.get('kitchen_cab_mat', {
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.1,
  });
  const cabMesh = new THREE.Mesh(cabGeo, cabMat);
  cabMesh.position.set(0, 0.41 + 0.1, 0);
  cabMesh.castShadow = true;
  group.add(cabMesh);

  // Polished marble countertop slab
  const topGeo = geometries.get('kitchen_top', () => new THREE.BoxGeometry(1.95, 0.08, 0.92));
  const topMat = materials.get('kitchen_top_marble', {
    color: 0xf1f5f9,
    roughness: 0.25,
    metalness: 0.15,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.set(0, 0.86 + 0.1, 0);
  topMesh.castShadow = true;
  group.add(topMesh);

  // Stainless steel sink basin inset
  const sinkGeo = geometries.get('kitchen_sink', () => new THREE.BoxGeometry(0.55, 0.02, 0.45));
  const sinkMat = materials.get('kitchen_sink_mat', {
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });
  const sinkMesh = new THREE.Mesh(sinkGeo, sinkMat);
  sinkMesh.position.set(-0.5, 0.905 + 0.1, 0);
  group.add(sinkMesh);

  // Induction stovetop (glass ceramic with 2 glowing burner rings)
  const stoveGeo = geometries.get('kitchen_stove', () => new THREE.BoxGeometry(0.55, 0.015, 0.45));
  const stoveMat = materials.get('kitchen_stove_mat', {
    color: 0x09090b,
    roughness: 0.1,
    metalness: 0.9,
  });
  const stoveMesh = new THREE.Mesh(stoveGeo, stoveMat);
  stoveMesh.position.set(0.48, 0.905 + 0.1, 0);
  group.add(stoveMesh);

  // Burner ring
  const burnerGeo = geometries.get('kitchen_burner', () => new THREE.RingGeometry(0.08, 0.15, 16));
  const burnerMat = materials.get('kitchen_burner_mat', {
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.5,
  });
  const burner = new THREE.Mesh(burnerGeo, burnerMat);
  burner.rotation.x = -Math.PI / 2;
  burner.position.set(0.48, 0.915 + 0.1, 0);
  group.add(burner);

  applyShadows(group);
  return group;
}

export function createFurnitureBedMesh(): THREE.Group {
  const group = new THREE.Group();

  // Parquet floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Natural oak bedframe
  const frameGeo = geometries.get('bed_frame', () => new THREE.BoxGeometry(1.65, 0.32, 1.85));
  const frameMat = materials.get('bed_wood_mat', {
    color: 0x78350f, // Warm rich amber wood
    roughness: 0.6,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.set(0, 0.16 + 0.1, 0.05);
  frameMesh.castShadow = true;
  group.add(frameMesh);

  // Tall headboard at -Z
  const headboardGeo = geometries.get('bed_headboard', () => new THREE.BoxGeometry(1.7, 0.9, 0.12));
  const headboard = new THREE.Mesh(headboardGeo, frameMat);
  headboard.position.set(0, 0.55 + 0.1, -0.85);
  headboard.castShadow = true;
  group.add(headboard);

  // White mattress
  const mattGeo = geometries.get('bed_mattress', () => new THREE.BoxGeometry(1.5, 0.22, 1.7));
  const mattMat = materials.get('bed_mattress_mat', {
    color: 0xfafafa,
    roughness: 0.9,
  });
  const mattMesh = new THREE.Mesh(mattGeo, mattMat);
  mattMesh.position.set(0, 0.38 + 0.1, 0.05);
  group.add(mattMesh);

  // Indigo/blue duvet blanket draped over lower 2/3
  const duvetGeo = geometries.get('bed_duvet', () => new THREE.BoxGeometry(1.52, 0.12, 1.15));
  const duvetMat = materials.get('bed_duvet_mat', {
    color: 0x1d4ed8, // Royal cobalt blue duvet
    roughness: 0.75,
  });
  const duvetMesh = new THREE.Mesh(duvetGeo, duvetMat);
  duvetMesh.position.set(0, 0.46 + 0.1, 0.32);
  duvetMesh.castShadow = true;
  group.add(duvetMesh);

  // Two fluffy sleeping pillows
  const pillowGeo = geometries.get('bed_sleeping_pillow', () => new THREE.BoxGeometry(0.55, 0.12, 0.35));
  const pillowMat = materials.get('bed_sleeping_pillow_mat', {
    color: 0xffffff,
    roughness: 0.8,
  });
  const pillowL = new THREE.Mesh(pillowGeo, pillowMat);
  pillowL.position.set(-0.4, 0.52 + 0.1, -0.55);
  group.add(pillowL);

  const pillowR = new THREE.Mesh(pillowGeo, pillowMat);
  pillowR.position.set(0.4, 0.52 + 0.1, -0.55);
  group.add(pillowR);

  applyShadows(group);
  return group;
}

export function createFurnitureDiningTableMesh(): THREE.Group {
  const group = new THREE.Group();

  // Parquet floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Oak tabletop (1.5 x 0.06 x 0.95)
  const tableGeo = geometries.get('dining_table_top', () => new THREE.BoxGeometry(1.5, 0.06, 0.95));
  const tableMat = materials.get('dining_wood_mat', {
    color: 0x92400e,
    roughness: 0.55,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.set(0, 0.72 + 0.1, 0);
  tableMesh.castShadow = true;
  group.add(tableMesh);

  // 4 Table legs
  const legGeo = geometries.get('dining_table_leg', () => new THREE.CylinderGeometry(0.035, 0.025, 0.72, 8));
  const legPositions = [
    [-0.65, 0.36 + 0.1, -0.38],
    [0.65, 0.36 + 0.1, -0.38],
    [-0.65, 0.36 + 0.1, 0.38],
    [0.65, 0.36 + 0.1, 0.38],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    group.add(leg);
  }

  // 2 Dining chairs tucked on north and south sides
  const chairSeatGeo = geometries.get('dining_chair_seat', () => new THREE.BoxGeometry(0.42, 0.04, 0.42));
  const chairBackGeo = geometries.get('dining_chair_back', () => new THREE.BoxGeometry(0.42, 0.42, 0.04));
  const chairMat = materials.get('dining_chair_mat', {
    color: 0x1e293b, // Modern matte dark chair
    roughness: 0.7,
  });

  // Chair North
  const chair1 = new THREE.Group();
  const c1Seat = new THREE.Mesh(chairSeatGeo, chairMat);
  c1Seat.position.set(0, 0.44 + 0.1, 0);
  chair1.add(c1Seat);
  const c1Back = new THREE.Mesh(chairBackGeo, chairMat);
  c1Back.position.set(0, 0.65 + 0.1, -0.19);
  chair1.add(c1Back);
  chair1.position.set(0, 0, -0.58);
  group.add(chair1);

  // Chair South
  const chair2 = new THREE.Group();
  const c2Seat = new THREE.Mesh(chairSeatGeo, chairMat);
  c2Seat.position.set(0, 0.44 + 0.1, 0);
  chair2.add(c2Seat);
  const c2Back = new THREE.Mesh(chairBackGeo, chairMat);
  c2Back.position.set(0, 0.65 + 0.1, 0.19);
  chair2.add(c2Back);
  chair2.position.set(0, 0, 0.58);
  group.add(chair2);

  applyShadows(group);
  return group;
}

export function createApartmentBalconyRailingMesh(): THREE.Group {
  const group = new THREE.Group();

  // Floor terrace tile underneath
  const floorGeo = geometries.get('apt_balcony_floor', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
  const floorMat = materials.get('apt_balcony_floor_mat', {
    color: 0x94a3b8, // Light concrete terrace slab
    roughness: 0.8,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0.05;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Low concrete curb along outer edge (2.0 x 0.16 x 0.18)
  const curbGeo = geometries.get('balcony_curb', () => new THREE.BoxGeometry(2.0, 0.16, 0.18));
  const curbMat = materials.get('balcony_curb_mat', {
    color: 0x64748b,
    roughness: 0.75,
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.position.set(0, 0.18, 0.91);
  group.add(curbMesh);

  // Sleek black steel handrail and vertical posts
  const railMat = materials.get('balcony_steel_mat', {
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8,
  });
  const topRailGeo = geometries.get('balcony_top_rail', () => new THREE.BoxGeometry(2.0, 0.05, 0.05));
  const topRail = new THREE.Mesh(topRailGeo, railMat);
  topRail.position.set(0, 1.05, 0.91);
  topRail.castShadow = true;
  group.add(topRail);

  // Steel posts
  const postGeo = geometries.get('balcony_post', () => new THREE.CylinderGeometry(0.025, 0.025, 0.82, 8));
  const postPositions = [-0.95, -0.32, 0.32, 0.95];
  for (const px of postPositions) {
    const post = new THREE.Mesh(postGeo, railMat);
    post.position.set(px, 0.65, 0.91);
    group.add(post);
  }

  // Tinted tempered glass windbreak panel (semi-transparent)
  const glassGeo = geometries.get('balcony_glass', () => new THREE.BoxGeometry(1.88, 0.68, 0.02));
  const glassMat = materials.get('balcony_glass_mat', {
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.85,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.set(0, 0.62, 0.91);
  group.add(glassMesh);

  applyShadows(group);
  return group;
}

export function createFurnitureKitchenStoveMesh(): THREE.Group {
  const group = new THREE.Group();

  // Floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Modern matte charcoal kitchen cabinet base
  const cabGeo = geometries.get('kitchen_stove_cab', () => new THREE.BoxGeometry(1.85, 0.82, 0.85));
  const cabMat = materials.get('kitchen_cab_mat', {
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.1,
  });
  const cabMesh = new THREE.Mesh(cabGeo, cabMat);
  cabMesh.position.set(0, 0.41 + 0.1, 0);
  cabMesh.castShadow = true;
  group.add(cabMesh);

  // Stainless steel oven door in the center
  const ovenGeo = geometries.get('kitchen_oven_door', () => new THREE.BoxGeometry(0.8, 0.6, 0.04));
  const ovenMat = materials.get('kitchen_oven_mat', {
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  });
  const ovenMesh = new THREE.Mesh(ovenGeo, ovenMat);
  ovenMesh.position.set(0, 0.42 + 0.1, 0.44);
  group.add(ovenMesh);

  // Oven handle
  const handleGeo = geometries.get('kitchen_oven_handle', () => new THREE.BoxGeometry(0.65, 0.03, 0.04));
  const handleMat = materials.get('kitchen_stainless_mat', {
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const handleMesh = new THREE.Mesh(handleGeo, handleMat);
  handleMesh.position.set(0, 0.65 + 0.1, 0.48);
  group.add(handleMesh);

  // Black ceramic glass stovetop
  const topGeo = geometries.get('kitchen_stove_top', () => new THREE.BoxGeometry(1.9, 0.05, 0.9));
  const topMat = materials.get('kitchen_stove_top_mat', {
    color: 0x09090b,
    roughness: 0.1,
    metalness: 0.9,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.set(0, 0.845 + 0.1, 0);
  topMesh.castShadow = true;
  group.add(topMesh);

  // 4 glowing induction burner rings
  const burnerGeo = geometries.get('kitchen_stove_burner', () => new THREE.RingGeometry(0.1, 0.18, 16));
  const burnerMat = materials.get('kitchen_stove_burner_mat', {
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.7,
    side: THREE.DoubleSide,
  });
  const burnerOffsets = [
    [-0.45, -0.2],
    [-0.45, 0.2],
    [0.45, -0.2],
    [0.45, 0.2],
  ];
  for (const [bx, bz] of burnerOffsets) {
    const ring = new THREE.Mesh(burnerGeo, burnerMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(bx, 0.875 + 0.1, bz);
    group.add(ring);
  }

  // Range hood extractor above
  const hoodGeo = geometries.get('kitchen_hood', () => new THREE.BoxGeometry(1.2, 0.25, 0.7));
  const hood = new THREE.Mesh(hoodGeo, handleMat);
  hood.position.set(0, 2.1, 0);
  hood.castShadow = true;
  group.add(hood);

  // Vent chimney pipe up to ceiling
  const pipeGeo = geometries.get('kitchen_hood_pipe', () => new THREE.BoxGeometry(0.35, 1.0, 0.35));
  const pipe = new THREE.Mesh(pipeGeo, handleMat);
  pipe.position.set(0, 2.7, 0);
  group.add(pipe);

  applyShadows(group);
  return group;
}

export function createFurnitureTVStandMesh(): THREE.Group {
  const group = new THREE.Group();

  // Floor underneath
  const floor = createApartmentFloorMesh();
  group.add(floor);

  // Walnut wood TV console body
  const standGeo = geometries.get('tv_stand_body', () => new THREE.BoxGeometry(1.8, 0.42, 0.6));
  const standMat = materials.get('tv_stand_wood', {
    color: 0x5c2b14, // Warm walnut wood
    roughness: 0.6,
  });
  const standMesh = new THREE.Mesh(standGeo, standMat);
  standMesh.position.set(0, 0.26 + 0.1, 0);
  standMesh.castShadow = true;
  group.add(standMesh);

  // Black metal legs
  const legGeo = geometries.get('tv_stand_leg', () => new THREE.CylinderGeometry(0.025, 0.02, 0.15, 8));
  const legMat = materials.get('tv_stand_leg_mat', {
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8,
  });
  const legPositions = [
    [-0.8, 0.075 + 0.1, -0.22],
    [0.8, 0.075 + 0.1, -0.22],
    [-0.8, 0.075 + 0.1, 0.22],
    [0.8, 0.075 + 0.1, 0.22],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  }

  // Soundbar on console
  const soundbarGeo = geometries.get('tv_soundbar', () => new THREE.BoxGeometry(0.9, 0.06, 0.1));
  const soundbarMat = materials.get('tv_soundbar_mat', {
    color: 0x18181b,
    roughness: 0.5,
  });
  const soundbar = new THREE.Mesh(soundbarGeo, soundbarMat);
  soundbar.position.set(0, 0.5 + 0.1, 0.15);
  group.add(soundbar);

  // Sleek OLED Flat Screen TV
  // Stand base and neck
  const tvBaseGeo = geometries.get('tv_base_plate', () => new THREE.BoxGeometry(0.5, 0.02, 0.25));
  const tvBase = new THREE.Mesh(tvBaseGeo, legMat);
  tvBase.position.set(0, 0.48 + 0.1, -0.05);
  group.add(tvBase);

  const tvStemGeo = geometries.get('tv_stem', () => new THREE.BoxGeometry(0.1, 0.25, 0.04));
  const tvStem = new THREE.Mesh(tvStemGeo, legMat);
  tvStem.position.set(0, 0.6 + 0.1, -0.08);
  group.add(tvStem);

  // Ultra-thin TV panel bezel
  const tvPanelGeo = geometries.get('tv_panel', () => new THREE.BoxGeometry(1.6, 0.92, 0.04));
  const tvPanelMat = materials.get('tv_bezel_mat', {
    color: 0x09090b,
    roughness: 0.2,
    metalness: 0.9,
  });
  const tvPanel = new THREE.Mesh(tvPanelGeo, tvPanelMat);
  tvPanel.position.set(0, 1.15 + 0.1, -0.06);
  tvPanel.castShadow = true;
  group.add(tvPanel);

  // TV Screen with subtle glowing ambient display (psilocybin cyan display)
  const screenGeo = geometries.get('tv_screen', () => new THREE.BoxGeometry(1.54, 0.86, 0.01));
  const screenMat = materials.get('tv_screen_mat', {
    color: 0x0284c7, // Vibrant cyan
    emissive: 0x0369a1,
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.15 + 0.1, -0.035);
  group.add(screen);

  applyShadows(group);
  return group;
}

export function createGroceryShelfMesh(): THREE.Group {
  const group = new THREE.Group();

  // Supermarket light grey tiled floor underneath
  const floorGeo = geometries.get('grocery_floor', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
  const floorMat = materials.get('grocery_floor_mat', {
    color: 0xd1d5db,
    roughness: 0.4,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  group.add(floor);

  // Gondola metal shelving upright back panel
  const shelfBackGeo = geometries.get('grocery_shelf_back', () => new THREE.BoxGeometry(1.95, 1.9, 0.08));
  const shelfMetalMat = materials.get('grocery_shelf_metal', {
    color: 0x9ca3af,
    roughness: 0.4,
    metalness: 0.6,
  });
  const shelfBack = new THREE.Mesh(shelfBackGeo, shelfMetalMat);
  shelfBack.position.set(0, 1.05, 0);
  shelfBack.castShadow = true;
  group.add(shelfBack);

  // Side endcaps
  const endcapGeo = geometries.get('grocery_endcap', () => new THREE.BoxGeometry(0.06, 1.9, 0.7));
  const endcapL = new THREE.Mesh(endcapGeo, shelfMetalMat);
  endcapL.position.set(-0.95, 1.05, 0);
  group.add(endcapL);

  const endcapR = new THREE.Mesh(endcapGeo, shelfMetalMat);
  endcapR.position.set(0.95, 1.05, 0);
  group.add(endcapR);

  // 4 horizontal shelves (front and back)
  const tierY = [0.35, 0.75, 1.15, 1.55];
  const shelfTierGeo = geometries.get('grocery_tier', () => new THREE.BoxGeometry(1.85, 0.04, 0.6));
  for (const y of tierY) {
    const tier = new THREE.Mesh(shelfTierGeo, shelfMetalMat);
    tier.position.set(0, y, 0);
    tier.castShadow = true;
    group.add(tier);
  }

  // Colorful grocery merchandise items on shelves
  const itemColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];
  const itemBoxGeo = geometries.get('grocery_box', () => new THREE.BoxGeometry(0.22, 0.28, 0.18));
  for (let t = 0; t < tierY.length; t++) {
    const y = tierY[t] + 0.16;
    for (let i = -3; i <= 3; i++) {
      const color = itemColors[Math.abs(t * 3 + i) % itemColors.length];
      const itemMat = materials.get(`grocery_item_${color}`, {
        color,
        roughness: 0.6,
      });
      // Front side
      const itemF = new THREE.Mesh(itemBoxGeo, itemMat);
      itemF.position.set(i * 0.26, y, 0.18);
      itemF.castShadow = true;
      group.add(itemF);

      // Back side
      const itemB = new THREE.Mesh(itemBoxGeo, itemMat);
      itemB.position.set(i * 0.26, y, -0.18);
      itemB.castShadow = true;
      group.add(itemB);
    }
  }

  applyShadows(group);
  return group;
}

export function createGroceryCounterMesh(): THREE.Group {
  const group = new THREE.Group();

  // Floor underneath
  const floorGeo = geometries.get('grocery_floor', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
  const floorMat = materials.get('grocery_floor_mat', {
    color: 0xd1d5db,
    roughness: 0.4,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.05;
  group.add(floor);

  // Counter main body
  const bodyGeo = geometries.get('grocery_counter_body', () => new THREE.BoxGeometry(1.85, 0.85, 0.8));
  const bodyMat = materials.get('grocery_counter_body_mat', {
    color: 0x334155, // Dark slate supermarket checkout
    roughness: 0.7,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.425 + 0.1, 0);
  body.castShadow = true;
  group.add(body);

  // Black rubber conveyor belt
  const beltGeo = geometries.get('grocery_belt', () => new THREE.BoxGeometry(1.2, 0.02, 0.45));
  const beltMat = materials.get('grocery_belt_mat', {
    color: 0x09090b,
    roughness: 0.9,
  });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.set(-0.25, 0.86 + 0.1, 0);
  group.add(belt);

  // Cashier POS terminal / monitor
  const posStemGeo = geometries.get('grocery_pos_stem', () => new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8));
  const posMat = materials.get('grocery_pos_metal', {
    color: 0x18181b,
    roughness: 0.4,
    metalness: 0.7,
  });
  const stem = new THREE.Mesh(posStemGeo, posMat);
  stem.position.set(0.65, 0.975 + 0.1, -0.15);
  group.add(stem);

  const screenGeo = geometries.get('grocery_pos_screen', () => new THREE.BoxGeometry(0.32, 0.24, 0.04));
  const screenMat = materials.get('grocery_pos_screen_mat', {
    color: 0x22c55e, // Glowing green cash register screen
    emissive: 0x15803d,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0.65, 1.15 + 0.1, -0.15);
  screen.rotation.y = -0.3;
  group.add(screen);

  // Barcode scanner red glass plate
  const scanGeo = geometries.get('grocery_scanner', () => new THREE.BoxGeometry(0.2, 0.01, 0.2));
  const scanMat = materials.get('grocery_scanner_mat', {
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.8,
  });
  const scanner = new THREE.Mesh(scanGeo, scanMat);
  scanner.position.set(0.42, 0.865 + 0.1, 0);
  group.add(scanner);

  // Acrylic customer sneeze guard / divider
  const guardGeo = geometries.get('grocery_guard', () => new THREE.BoxGeometry(1.85, 0.55, 0.02));
  const guardMat = materials.get('grocery_guard_mat', {
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    metalness: 0.9,
  });
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.set(0, 1.15 + 0.1, 0.35);
  group.add(guard);

  // Environmental Clue: Scribbled sticky note decal on counter next to POS
  const clueNoteGeo = geometries.get('counter_clue_note_geo', () => new THREE.PlaneGeometry(0.24, 0.24));
  const clueNoteMat = new THREE.MeshStandardMaterial({
    map: getStickyNoteTexture(),
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
  });
  const clueNote = new THREE.Mesh(clueNoteGeo, clueNoteMat);
  clueNote.rotation.x = -Math.PI / 2;
  clueNote.rotation.z = 0.14;
  clueNote.position.set(0.12, 0.865 + 0.1 + 0.005, -0.12);
  group.add(clueNote);

  applyShadows(group);
  return group;
}

export function createSuburbanVillaMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isWall = true;

  // Sturdy whitewashed masonry ground floor (2.0 x 1.6 x 2.0)
  const baseGeo = geometries.get('villa_base', () => new THREE.BoxGeometry(2.0, 1.6, 2.0));
  const baseMat = materials.get('villa_stucco_mat', {
    color: 0xf5f5f4, // Whitewash stone plaster
    roughness: 0.9,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.set(0, 0.8, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData.isWall = true;
  group.add(baseMesh);

  // Upper floor (2.0 x 1.6 x 2.0)
  const upperGeo = geometries.get('villa_upper', () => new THREE.BoxGeometry(2.0, 1.6, 2.0));
  const upperMesh = new THREE.Mesh(upperGeo, baseMat);
  upperMesh.position.set(0, 2.4, 0);
  upperMesh.castShadow = true;
  upperMesh.userData.isWall = true;
  group.add(upperMesh);

  // Dark timber framework beams (horizontal and vertical balks)
  const timberMat = materials.get('villa_timber_mat', {
    color: 0x451a03, // Dark Basque brown timber
    roughness: 0.8,
  });
  const beamHGeo = geometries.get('villa_timber_h', () => new THREE.BoxGeometry(2.02, 0.12, 0.08));
  const beamH1 = new THREE.Mesh(beamHGeo, timberMat);
  beamH1.position.set(0, 1.6, 1.01);
  group.add(beamH1);

  const beamH2 = new THREE.Mesh(beamHGeo, timberMat);
  beamH2.position.set(0, 3.1, 1.01);
  group.add(beamH2);

  const beamVGeo = geometries.get('villa_timber_v', () => new THREE.BoxGeometry(0.12, 1.5, 0.08));
  const beamV1 = new THREE.Mesh(beamVGeo, timberMat);
  beamV1.position.set(-0.65, 2.35, 1.01);
  group.add(beamV1);

  const beamV2 = new THREE.Mesh(beamVGeo, timberMat);
  beamV2.position.set(0.65, 2.35, 1.01);
  group.add(beamV2);

  // Terracotta red pitched gable roof
  const roofGeo = geometries.get('villa_roof', () => new THREE.ConeGeometry(1.65, 1.1, 4));
  const roofMat = materials.get('villa_roof_mat', {
    color: 0xb91c1c, // Basque red terracotta tile
    roughness: 0.7,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 3.75, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  roof.userData.isWall = true;
  group.add(roof);

  // Traditional wooden window shutters (Basque green)
  const shutterGeo = geometries.get('villa_shutter', () => new THREE.BoxGeometry(0.18, 0.45, 0.04));
  const shutterMat = materials.get('villa_shutter_mat', {
    color: 0x15803d, // Basque green
    roughness: 0.7,
  });
  const shutterL = new THREE.Mesh(shutterGeo, shutterMat);
  shutterL.position.set(-0.35, 2.4, 1.02);
  group.add(shutterL);

  const shutterR = new THREE.Mesh(shutterGeo, shutterMat);
  shutterR.position.set(0.35, 2.4, 1.02);
  group.add(shutterR);

  // Window pane (warm glowing glass)
  const windowGeo = geometries.get('villa_window', () => new THREE.BoxGeometry(0.4, 0.45, 0.02));
  const windowMat = materials.get('villa_window_mat', {
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  const windowPane = new THREE.Mesh(windowGeo, windowMat);
  windowPane.position.set(0, 2.4, 1.02);
  group.add(windowPane);

  // Wooden flower balcony with colorful blossoms
  const balconyGeo = geometries.get('villa_balcony', () => new THREE.BoxGeometry(1.2, 0.35, 0.3));
  const balcony = new THREE.Mesh(balconyGeo, timberMat);
  balcony.position.set(0, 1.7, 1.15);
  group.add(balcony);

  const flowerGeo = geometries.get('villa_flowers', () => new THREE.BoxGeometry(1.1, 0.15, 0.25));
  const flowerMat = materials.get('villa_flower_mat', {
    color: 0xec4899, // Geranium blossoms
    roughness: 0.9,
  });
  const flowers = new THREE.Mesh(flowerGeo, flowerMat);
  flowers.position.set(0, 1.9, 1.15);
  group.add(flowers);

  applyShadows(group);
  return group;
}

export function createMetroFloorMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isFloor = true;

  // Non-slip dark charcoal/slate rubber terrazzo floor slab (2.0 x 0.1 x 2.0)
  const floorGeo = geometries.get('metro_floor_slab_20', () => new THREE.BoxGeometry(2.0, 0.1, 2.0));
  const floorMat = materials.get('metro_floor_slab_mat', {
    color: 0x334155, // Dark slate non-slip rubber
    roughness: 0.85,
    metalness: 0.1,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0.05;
  floorMesh.receiveShadow = true;
  floorMesh.userData.isFloor = true;
  group.add(floorMesh);

  // Inlaid tactile longitudinal grip ribs along X
  const ribGeo = geometries.get('metro_floor_rib_20', () => new THREE.BoxGeometry(2.0, 0.008, 0.04));
  const ribMat = materials.get('metro_floor_rib_mat', {
    color: 0x1e293b,
    roughness: 0.95,
  });
  for (const zOffset of [-0.6, -0.2, 0.2, 0.6]) {
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(0, 0.104, zOffset);
    rib.userData.isFloor = true;
    group.add(rib);
  }

  return group;
}

export function createMetroGlassPartitionMesh(): THREE.Group {
  const group = new THREE.Group();

  // Metro floor base underneath
  const floor = createMetroFloorMesh();
  group.add(floor);

  // Stainless steel mounting floor bracket
  const bracketGeo = geometries.get('metro_glass_bracket', () => new THREE.BoxGeometry(1.8, 0.08, 0.12));
  const steelMat = materials.get('metro_stainless_mat', {
    color: 0xd1d5db,
    roughness: 0.2,
    metalness: 0.85,
  });
  const bracket = new THREE.Mesh(bracketGeo, steelMat);
  bracket.position.set(0, 0.14, 0);
  bracket.castShadow = true;
  group.add(bracket);

  // Upright steel post columns on left and right
  const postGeo = geometries.get('metro_part_post', () => new THREE.CylinderGeometry(0.03, 0.03, 1.9, 12));
  const postL = new THREE.Mesh(postGeo, steelMat);
  postL.position.set(-0.88, 1.05, 0);
  postL.castShadow = true;
  group.add(postL);

  const postR = new THREE.Mesh(postGeo, steelMat);
  postR.position.set(0.88, 1.05, 0);
  postR.castShadow = true;
  group.add(postR);

  // Large tempered glass windbreak panel
  const glassGeo = geometries.get('metro_windbreak_glass', () => new THREE.BoxGeometry(1.7, 1.7, 0.03));
  const glassMat = materials.get('metro_windbreak_glass_mat', {
    color: 0x67e8f9, // Light cyan tempered glass
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0.8,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 1.02, 0);
  group.add(glass);

  // Red Bilbao Metro horizontal safety accent bar across glass at eye-height
  const accentGeo = geometries.get('metro_glass_accent', () => new THREE.BoxGeometry(1.72, 0.08, 0.04));
  const accentMat = materials.get('metro_red_accent_mat', {
    color: 0xef4444, // Foster Bilbao Metro red
    roughness: 0.4,
    metalness: 0.3,
  });
  const accent = new THREE.Mesh(accentGeo, accentMat);
  accent.position.set(0, 1.25, 0);
  group.add(accent);

  // Horizontal stainless steel grab handle
  const handleGeo = geometries.get('metro_glass_rail', () => new THREE.CylinderGeometry(0.02, 0.02, 1.72, 8));
  const rail = new THREE.Mesh(handleGeo, steelMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 0.95, 0.08);
  rail.castShadow = true;
  group.add(rail);

  applyShadows(group);
  return group;
}

export function applyDoorOpenProgress(doorMesh: THREE.Object3D, progress: number): void {
  const p = Math.max(0, Math.min(1, progress));
  const e = 1 - Math.pow(1 - p, 3); // Cubic ease-out
  const u = doorMesh.userData;
  if (!u) return;

  if (u.doorType === 'single_hinge' && u.hinge) {
    u.hinge.rotation.y = (Math.PI / 2) * e;
  } else if (u.doorType === 'double_hinge') {
    if (u.hingeL) u.hingeL.rotation.y = (-Math.PI / 2) * e;
    if (u.hingeR) u.hingeR.rotation.y = (Math.PI / 2) * e;
  } else if (u.doorType === 'sliding') {
    if (u.slideL) u.slideL.position.x = -0.72 * e;
    if (u.slideR) u.slideR.position.x = 0.72 * e;
  }
}

export function createSwitchButtonMesh(isPressed = false): THREE.Group {
  const group = new THREE.Group();
  group.userData.isSwitch = true;
  group.userData.isPressed = isPressed;

  // Dark slate metal pedestal housing
  const metalMat = materials.get('switch_metal_body', {
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.8,
  });
  const baseGeo = geometries.get('switch_pedestal_base', () => new THREE.BoxGeometry(0.38, 0.9, 0.32));
  const baseMesh = new THREE.Mesh(baseGeo, metalMat);
  baseMesh.position.set(0, 0.45, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Angled top console face
  const topGeo = geometries.get('switch_console_top', () => new THREE.BoxGeometry(0.36, 0.14, 0.28));
  const topMesh = new THREE.Mesh(topGeo, metalMat);
  topMesh.position.set(0, 0.94, 0);
  topMesh.rotation.x = -0.22;
  topMesh.castShadow = true;
  group.add(topMesh);

  // Chrome button bezel ring
  const bezelMat = materials.get('switch_bezel_mat', {
    color: 0x94a3b8,
    roughness: 0.15,
    metalness: 0.95,
  });
  const bezelGeo = geometries.get('switch_bezel_ring', () => new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16));
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.set(0, 0.99, 0.03);
  bezelMesh.rotation.x = -0.22;
  group.add(bezelMesh);

  // Push button cap
  const btnMat = materials.get('switch_button_cap_mat', {
    color: 0xd97706,
    roughness: 0.3,
    metalness: 0.2,
  });
  const btnGeo = geometries.get('switch_button_cap', () => new THREE.CylinderGeometry(0.062, 0.062, 0.03, 16));
  const buttonMesh = new THREE.Mesh(btnGeo, btnMat);
  buttonMesh.position.set(0, isPressed ? 0.99 : 1.005, 0.03);
  buttonMesh.rotation.x = -0.22;
  group.add(buttonMesh);

  // Glowing Indicator Lamp dome
  const lampCol = isPressed ? 0x22c55e : 0xef4444;
  const lampMat = new THREE.MeshStandardMaterial({
    color: lampCol,
    emissive: lampCol,
    emissiveIntensity: isPressed ? 1.4 : 0.6,
    roughness: 0.2,
  });
  const lampGeo = geometries.get('switch_lamp_dome', () => new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16));
  const lampMesh = new THREE.Mesh(lampGeo, lampMat);
  lampMesh.position.set(0, 1.01, -0.06);
  lampMesh.rotation.x = -0.22;
  group.add(lampMesh);

  // Local point light
  const light = new THREE.PointLight(lampCol, isPressed ? 1.4 : 0.6, 3.5);
  light.position.set(0, 1.08, -0.06);
  group.add(light);

  group.userData.lampMesh = lampMesh;
  group.userData.lampLight = light;
  group.userData.buttonMesh = buttonMesh;

  applyShadows(group);
  return group;
}

export function setSwitchButtonVisual(mesh: THREE.Object3D, isPressed: boolean): void {
  mesh.userData.isPressed = isPressed;
  const col = isPressed ? 0x22c55e : 0xef4444;
  if (mesh.userData.lampMesh && mesh.userData.lampMesh.material) {
    const mat = mesh.userData.lampMesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(col);
    mat.emissive.setHex(col);
    mat.emissiveIntensity = isPressed ? 1.4 : 0.6;
  }
  if (mesh.userData.lampLight) {
    const light = mesh.userData.lampLight as THREE.PointLight;
    light.color.setHex(col);
    light.intensity = isPressed ? 1.4 : 0.6;
  }
  if (mesh.userData.buttonMesh) {
    mesh.userData.buttonMesh.position.y = isPressed ? 0.99 : 1.005;
  }
}

/**
 * Heavy cooperative-push obstacle: a battered industrial dumpster.
 * Local convention matches stair/door rotation: at rotation 0 the grip handles face
 * +Z ("south", where players approach from) and the object pushes toward -Z ("north").
 */
export function createHeavyObstacleMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isHeavyObstacle = true;

  const bodyMat = materials.get('heavy_obstacle_body', {
    color: 0x3f6b3a,
    roughness: 0.85,
    metalness: 0.35,
  });
  const bodyGeo = geometries.get('heavy_obstacle_body', () => new THREE.BoxGeometry(1.9, 1.05, 1.05));
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 0.525, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Rusty grime streaks
  const rustMat = materials.get('heavy_obstacle_rust', {
    color: 0x78350f,
    roughness: 0.95,
    metalness: 0.1,
  });
  const rustGeo = geometries.get('heavy_obstacle_rust_streak', () => new THREE.BoxGeometry(0.1, 0.9, 0.02));
  for (const rx of [-0.65, 0.2, 0.7]) {
    const rust = new THREE.Mesh(rustGeo, rustMat);
    rust.position.set(rx, 0.5, 0.535);
    group.add(rust);
  }

  // Angled hinged lid, propped slightly open
  const lidMat = materials.get('heavy_obstacle_lid', {
    color: 0x2f5228,
    roughness: 0.8,
    metalness: 0.3,
  });
  const lidGeo = geometries.get('heavy_obstacle_lid', () => new THREE.BoxGeometry(1.95, 0.06, 1.1));
  const lidMesh = new THREE.Mesh(lidGeo, lidMat);
  lidMesh.position.set(0, 1.06, -0.15);
  lidMesh.rotation.x = 0.28;
  lidMesh.castShadow = true;
  group.add(lidMesh);

  // Psychedelic graffiti tag decal
  const graffitiMat = materials.get('heavy_obstacle_graffiti', {
    color: 0xd946ef,
    emissive: 0xd946ef,
    emissiveIntensity: 0.3,
    roughness: 0.6,
    metalness: 0.1,
  });
  const graffitiGeo = geometries.get('heavy_obstacle_graffiti', () => new THREE.PlaneGeometry(0.7, 0.4));
  const graffitiMesh = new THREE.Mesh(graffitiGeo, graffitiMat);
  graffitiMesh.position.set(-0.3, 0.55, 0.536);
  group.add(graffitiMesh);

  // Caster wheels
  const wheelMat = materials.get('heavy_obstacle_wheel', {
    color: 0x18181b,
    roughness: 0.6,
    metalness: 0.2,
  });
  const wheelGeo = geometries.get('heavy_obstacle_wheel', () => new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10));
  for (const wx of [-0.78, 0.78]) {
    for (const wz of [-0.42, 0.42]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.09, wz);
      group.add(wheel);
    }
  }

  // Two grip-point handle bars on the +Z ("south"/approach) face
  const handleMat = materials.get('heavy_obstacle_handle', {
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.85,
  });
  const handleGeo = geometries.get('heavy_obstacle_handle', () => new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8));

  const makeGrip = (gx: number) => {
    const gripGroup = new THREE.Group();
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(gx, 0.62, 0.56);
    gripGroup.add(handle);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.1,
    });
    const lampGeo = geometries.get('heavy_obstacle_lamp', () => new THREE.SphereGeometry(0.05, 10, 10));
    const lampMesh = new THREE.Mesh(lampGeo, lampMat);
    lampMesh.position.set(gx, 0.62, 0.62);
    gripGroup.add(lampMesh);

    const light = new THREE.PointLight(0xef4444, 0.5, 1.8);
    light.position.set(gx, 0.68, 0.62);
    gripGroup.add(light);

    group.add(gripGroup);
    return { lampMesh, light };
  };

  const gripLeft = makeGrip(-0.5);
  const gripRight = makeGrip(0.5);
  group.userData.gripLeftLamp = gripLeft.lampMesh;
  group.userData.gripLeftLight = gripLeft.light;
  group.userData.gripRightLamp = gripRight.lampMesh;
  group.userData.gripRightLight = gripRight.light;

  applyShadows(bodyMesh);
  applyShadows(lidMesh);
  return group;
}

/**
 * Toggles the heavy obstacle's grip-point indicator lamps:
 * 'idle' = dim red (unattended), 'solo' = pulsing amber (needs a second player), 'active' = green (pushing).
 */
export function setHeavyObstacleGripVisual(mesh: THREE.Object3D, state: 'idle' | 'solo' | 'active'): void {
  const col = state === 'active' ? 0x22c55e : state === 'solo' ? 0xf59e0b : 0xef4444;
  const intensity = state === 'active' ? 1.6 : state === 'solo' ? 1.1 : 0.6;
  for (const key of ['gripLeftLamp', 'gripRightLamp'] as const) {
    const lamp = mesh.userData[key] as THREE.Mesh | undefined;
    if (lamp && lamp.material instanceof THREE.MeshStandardMaterial) {
      lamp.material.color.setHex(col);
      lamp.material.emissive.setHex(col);
      lamp.material.emissiveIntensity = intensity;
    }
  }
  for (const key of ['gripLeftLight', 'gripRightLight'] as const) {
    const light = mesh.userData[key] as THREE.PointLight | undefined;
    if (light) {
      light.color.setHex(col);
      light.intensity = intensity * 0.6;
    }
  }
}

export function createDoorApartmentMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isDoor = true;
  group.userData.isWall = true;
  group.userData.isOccluder = true;

  // Solid oak parquet floor underneath doorway
  const floor = createApartmentFloorMesh();
  floor.traverse((c) => {
    c.userData.isFloor = true;
  });
  group.add(floor);

  // --- INTEGRATED WALL UNIT FRAMING ---
  const wallMat = materials.get('apt_wall_plaster_mat', {
    color: 0xf3ede2, // Warm cream plaster matching apartment walls
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 1.0,
  });
  const baseboardMat = materials.get('apt_wall_baseboard_mat', {
    color: 0x3e2723, // Dark oak trim
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });
  const crownMat = materials.get('apt_wall_crown_mat', {
    color: 0xe8dfd1,
    roughness: 0.7,
    transparent: true,
    opacity: 1.0,
  });

  // 1. Unified 1.0m x 3.2m x 0.25m Enclosure Core:
  // - Left jamb wall section: from X = -0.5m to X = -0.35m (width 0.15m, full height 3.2m, depth 0.25m, center X = -0.425m, Y = 1.6m)
  const leftJambCoreGeo = geometries.get('apt_door_left_jamb_core_w15_h32', () => new THREE.BoxGeometry(0.15, 3.2, 0.25));
  const leftJambCore = new THREE.Mesh(leftJambCoreGeo, wallMat);
  leftJambCore.position.set(-0.425, 1.6, 0);
  leftJambCore.receiveShadow = true;
  leftJambCore.userData.isWall = true;
  leftJambCore.userData.isDoor = true;
  leftJambCore.userData.isOccluder = true;
  group.add(leftJambCore);

  // - Right jamb wall section: from X = 0.35m to X = 0.5m (width 0.15m, full height 3.2m, depth 0.25m, center X = 0.425m, Y = 1.6m)
  const rightJambCoreGeo = geometries.get('apt_door_right_jamb_core_w15_h32', () => new THREE.BoxGeometry(0.15, 3.2, 0.25));
  const rightJambCore = new THREE.Mesh(rightJambCoreGeo, wallMat);
  rightJambCore.position.set(0.425, 1.6, 0);
  rightJambCore.receiveShadow = true;
  rightJambCore.userData.isWall = true;
  rightJambCore.userData.isDoor = true;
  rightJambCore.userData.isOccluder = true;
  group.add(rightJambCore);

  // - Top lintel / transom drywall: from Y = 2.1m to Y = 3.2m bridging the entire 1.0m width (width 1.0m, height 1.1m, depth 0.25m, center Y = 2.65m)
  const transomGeo = geometries.get('apt_door_transom_core_w10_h11', () => new THREE.BoxGeometry(1.0, 1.1, 0.25));
  const transomMesh = new THREE.Mesh(transomGeo, wallMat);
  transomMesh.position.set(0, 2.65, 0);
  transomMesh.receiveShadow = true;
  transomMesh.userData.isWall = true;
  transomMesh.userData.isDoor = true;
  transomMesh.userData.isOccluder = true;
  group.add(transomMesh);

  // 2. Full Grid Tile Wall Wing Extensions (Spans X = -1.25m to -0.5m and X = 0.5m to 1.25m, height 3.2m):
  // Ensures 100% seamless overlap with adjacent wall tiles on standard 2.0m grid (zero open air / daylight on sides)
  const outerWingGeo = geometries.get('apt_door_outer_wing_w75_h32', () => new THREE.BoxGeometry(0.75, 3.2, 0.25));

  const leftWing = new THREE.Mesh(outerWingGeo, wallMat);
  leftWing.position.set(-0.875, 1.6, 0);
  leftWing.receiveShadow = true;
  leftWing.userData.isWall = true;
  leftWing.userData.isDoor = true;
  leftWing.userData.isOccluder = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(outerWingGeo, wallMat);
  rightWing.position.set(0.875, 1.6, 0);
  rightWing.receiveShadow = true;
  rightWing.userData.isWall = true;
  rightWing.userData.isDoor = true;
  rightWing.userData.isOccluder = true;
  group.add(rightWing);

  // Continuous ceiling header extension bridging across entire 2.5m span above Y = 2.1m
  const headerGeo = geometries.get('apt_door_header_ext_w25_h11', () => new THREE.BoxGeometry(2.5, 1.1, 0.26));
  const headerMesh = new THREE.Mesh(headerGeo, wallMat);
  headerMesh.position.set(0, 2.65, 0);
  headerMesh.receiveShadow = true;
  headerMesh.userData.isWall = true;
  headerMesh.userData.isDoor = true;
  headerMesh.userData.isOccluder = true;
  group.add(headerMesh);

  // Ceiling crown molding trim across full span (2.52m x 0.08m x 0.32m at Y = 3.16m)
  const crownGeo = geometries.get('apt_door_crown_full_w252', () => new THREE.BoxGeometry(2.52, 0.08, 0.32));
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.position.set(0, 3.16, 0);
  crownMesh.userData.isWall = true;
  crownMesh.userData.isDoor = true;
  crownMesh.userData.isOccluder = true;
  group.add(crownMesh);

  // Baseboard moldings along bottom of wall wings at Y = 0.06m (height 0.12m)
  const wingBaseGeo = geometries.get('apt_door_wing_base_w90', () => new THREE.BoxGeometry(0.90, 0.12, 0.30));
  const leftBase = new THREE.Mesh(wingBaseGeo, baseboardMat);
  leftBase.position.set(-0.80, 0.06, 0);
  leftBase.userData.isWall = true;
  leftBase.userData.isDoor = true;
  group.add(leftBase);

  const rightBase = new THREE.Mesh(wingBaseGeo, baseboardMat);
  rightBase.position.set(0.80, 0.06, 0);
  rightBase.userData.isWall = true;
  rightBase.userData.isDoor = true;
  group.add(rightBase);

  // --- DOOR CASING & RIGGED LEAF (Clear opening 0.70m x 2.10m) ---
  const casingMat = materials.get('apt_door_casing_mat', {
    color: 0xf8fafc,
    roughness: 0.4,
    metalness: 0.05,
  });

  // Top header casing (spans 0.80m from -0.40 to +0.40 at Y = 2.14m)
  const lintelGeo = geometries.get('apt_door_casing_lintel_w80', () => new THREE.BoxGeometry(0.80, 0.08, 0.28));
  const lintel = new THREE.Mesh(lintelGeo, casingMat);
  lintel.position.set(0, 2.14, 0);
  lintel.userData.isWall = true;
  lintel.userData.isDoor = true;
  lintel.userData.isOccluder = true;
  group.add(lintel);

  // Left & right casing jamb strips at +/-0.36m (height 2.10m, center Y = 1.05m)
  const jambGeo = geometries.get('apt_door_casing_jamb_h21', () => new THREE.BoxGeometry(0.04, 2.10, 0.28));
  const leftCasing = new THREE.Mesh(jambGeo, casingMat);
  leftCasing.position.set(-0.36, 1.05, 0);
  leftCasing.userData.isWall = true;
  leftCasing.userData.isDoor = true;
  leftCasing.userData.isOccluder = true;
  group.add(leftCasing);

  const rightCasing = new THREE.Mesh(jambGeo, casingMat);
  rightCasing.position.set(0.36, 1.05, 0);
  rightCasing.userData.isWall = true;
  rightCasing.userData.isDoor = true;
  rightCasing.userData.isOccluder = true;
  group.add(rightCasing);

  // Brass threshold transition strip (0.70m wide x 0.02m high at Y = 0.01m)
  const brassMat = materials.get('apt_door_brass_mat', {
    color: 0xfacc15,
    roughness: 0.2,
    metalness: 0.92,
  });
  const stripGeo = geometries.get('apt_door_threshold_w70', () => new THREE.BoxGeometry(0.70, 0.02, 0.14));
  const strip = new THREE.Mesh(stripGeo, brassMat);
  strip.position.set(0, 0.01, 0);
  group.add(strip);

  // --- HINGE RIGGED DOOR LEAF (0.70m x 2.10m x 0.06m) ---
  const hingeGroup = new THREE.Group();
  hingeGroup.position.set(-0.35, 0, 0); // Pivot at left jamb inner edge (X = -0.35m)

  const woodMat = materials.get('apt_door_wood_mat', {
    color: 0x78350f, // Warm rich walnut
    roughness: 0.55,
    metalness: 0.08,
  });
  // Door leaf panel: 0.70m wide x 2.10m high x 0.06m thick
  const doorLeafGeo = geometries.get('apt_door_leaf_w70_h21', () => new THREE.BoxGeometry(0.70, 2.10, 0.06));
  const doorLeaf = new THREE.Mesh(doorLeafGeo, woodMat);
  doorLeaf.position.set(0.35, 1.05, 0); // Centered relative to hinge, bottom baseline locked at Y = 0.0m
  doorLeaf.userData.isWall = true;
  doorLeaf.userData.isDoor = true;
  doorLeaf.userData.isOccluder = true;
  hingeGroup.add(doorLeaf);

  // Recessed rectangular molded panels (kazetták)
  const panelMat = materials.get('apt_door_recess_panel_mat', {
    color: 0x542308,
    roughness: 0.6,
    metalness: 0.05,
  });
  const upperPanelGeo = geometries.get('apt_door_recess_upper_w70', () => new THREE.BoxGeometry(0.48, 0.65, 0.07));
  const lowerPanelGeo = geometries.get('apt_door_recess_lower_w70', () => new THREE.BoxGeometry(0.48, 0.55, 0.07));

  const upPanel = new THREE.Mesh(upperPanelGeo, panelMat);
  upPanel.position.set(0.35, 1.50, 0);
  upPanel.userData.isWall = true;
  upPanel.userData.isDoor = true;
  hingeGroup.add(upPanel);

  const lowPanel = new THREE.Mesh(lowerPanelGeo, panelMat);
  lowPanel.position.set(0.35, 0.55, 0);
  lowPanel.userData.isWall = true;
  lowPanel.userData.isDoor = true;
  hingeGroup.add(lowPanel);

  // Brass plate and lever handles near swing edge (X = 0.62 inside hinge)
  const plateGeo = geometries.get('apt_door_brass_plate_w70', () => new THREE.BoxGeometry(0.05, 0.22, 0.08));
  const plate = new THREE.Mesh(plateGeo, brassMat);
  plate.position.set(0.62, 1.02, 0);
  plate.userData.isWall = true;
  plate.userData.isDoor = true;
  hingeGroup.add(plate);

  const handleGeo = geometries.get('apt_door_brass_lever_w70', () => new THREE.BoxGeometry(0.12, 0.025, 0.025));
  const handleFront = new THREE.Mesh(handleGeo, brassMat);
  handleFront.position.set(0.64, 1.04, 0.055);
  handleFront.userData.isWall = true;
  handleFront.userData.isDoor = true;
  hingeGroup.add(handleFront);

  const handleBack = new THREE.Mesh(handleGeo, brassMat);
  handleBack.position.set(0.64, 1.04, -0.055);
  handleBack.userData.isWall = true;
  handleBack.userData.isDoor = true;
  hingeGroup.add(handleBack);

  group.add(hingeGroup);
  group.userData.doorType = 'single_hinge';
  group.userData.hinge = hingeGroup;
  group.userData.doorFacingNormal = new THREE.Vector3(0, 0, 1);

  applyShadows(group);
  return group;
}

export function createDoorStoreMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isDoor = true;
  group.userData.isWall = true;

  // Sidewalk concrete base
  const sidewalkGeo = geometries.get('downtown_sidewalk', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
  const sidewalkMat = materials.get('downtown_sidewalk', {
    color: 0xb5b8bf,
    roughness: 0.75,
    metalness: 0.1,
  });
  const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
  sidewalk.position.y = 0.1;
  group.add(sidewalk);

  // Commercial brushed aluminum frame (Clear opening 2.32m >= 2.2m)
  const aluMat = materials.get('store_door_alu_mat', {
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.85,
  });
  // Top header spanning 2.56m
  const lintelGeo = geometries.get('store_door_lintel_w256', () => new THREE.BoxGeometry(2.56, 0.14, 0.18));
  const lintel = new THREE.Mesh(lintelGeo, aluMat);
  lintel.position.set(0, 2.35, 0);
  group.add(lintel);

  // Side posts at +/-1.22m (inner edge +/-1.16m -> 2.32m clear opening)
  const postGeo = geometries.get('store_door_post', () => new THREE.BoxGeometry(0.12, 2.3, 0.18));
  const postL = new THREE.Mesh(postGeo, aluMat);
  postL.position.set(-1.22, 1.25, 0);
  group.add(postL);

  const postR = new THREE.Mesh(postGeo, aluMat);
  postR.position.set(1.22, 1.25, 0);
  group.add(postR);

  // Translucent safety glass & aluminum materials
  const glassMat = materials.get('store_door_glass_mat', {
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.82,
    roughness: 0.1,
    metalness: 0.25,
  });
  const barMat = materials.get('store_door_pushbar_mat', {
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.95,
  });
  const glassGeo = geometries.get('store_door_glass_w115', () => new THREE.BoxGeometry(1.15, 2.16, 0.04));
  const kickPlateGeo = geometries.get('store_door_kickplate_w115', () => new THREE.BoxGeometry(1.15, 0.36, 0.06));
  const pushBarGeo = geometries.get('store_door_pushbar_w105', () => new THREE.CylinderGeometry(0.025, 0.025, 1.05, 12));

  // Left door leaf rigged to hingeL (at X = -1.16m)
  const hingeL = new THREE.Group();
  hingeL.position.set(-1.16, 0, 0);

  const glassL = new THREE.Mesh(glassGeo, glassMat);
  glassL.position.set(0.575, 1.24, 0);
  hingeL.add(glassL);

  const kickL = new THREE.Mesh(kickPlateGeo, aluMat);
  kickL.position.set(0.575, 0.36, 0);
  hingeL.add(kickL);

  const pushBarFrontL = new THREE.Mesh(pushBarGeo, barMat);
  pushBarFrontL.rotation.z = Math.PI / 2;
  pushBarFrontL.position.set(0.575, 1.05, 0.06);
  hingeL.add(pushBarFrontL);

  const pushBarBackL = new THREE.Mesh(pushBarGeo, barMat);
  pushBarBackL.rotation.z = Math.PI / 2;
  pushBarBackL.position.set(0.575, 1.05, -0.06);
  hingeL.add(pushBarBackL);

  const decalMat = materials.get('store_door_decal_mat', {
    color: 0x15803d,
    emissive: 0x166534,
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });
  const decalGeo = geometries.get('store_door_decal', () => new THREE.BoxGeometry(0.38, 0.14, 0.05));
  const decal = new THREE.Mesh(decalGeo, decalMat);
  decal.position.set(0.575, 1.55, 0);
  hingeL.add(decal);

  group.add(hingeL);

  // Right door leaf rigged to hingeR (at X = +1.16m)
  const hingeR = new THREE.Group();
  hingeR.position.set(1.16, 0, 0);

  const glassR = new THREE.Mesh(glassGeo, glassMat);
  glassR.position.set(-0.575, 1.24, 0);
  hingeR.add(glassR);

  const kickR = new THREE.Mesh(kickPlateGeo, aluMat);
  kickR.position.set(-0.575, 0.36, 0);
  hingeR.add(kickR);

  const pushBarFrontR = new THREE.Mesh(pushBarGeo, barMat);
  pushBarFrontR.rotation.z = Math.PI / 2;
  pushBarFrontR.position.set(-0.575, 1.05, 0.06);
  hingeR.add(pushBarFrontR);

  const pushBarBackR = new THREE.Mesh(pushBarGeo, barMat);
  pushBarBackR.rotation.z = Math.PI / 2;
  pushBarBackR.position.set(-0.575, 1.05, -0.06);
  hingeR.add(pushBarBackR);

  group.add(hingeR);

  group.userData.doorType = 'double_hinge';
  group.userData.hingeL = hingeL;
  group.userData.hingeR = hingeR;
  group.userData.doorFacingNormal = new THREE.Vector3(0, 0, 1);

  applyShadows(group);
  return group;
}

export function createDoorMetroMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isDoor = true;
  group.userData.isWall = true;

  // Metro floor base underneath
  const floor = createMetroFloorMesh();
  group.add(floor);

  // Stainless steel top slider track & pocket frame
  const steelMat = materials.get('metro_door_steel_mat', {
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const topTrackGeo = geometries.get('metro_door_track_w25', () => new THREE.BoxGeometry(2.5, 0.12, 0.16));
  const topTrack = new THREE.Mesh(topTrackGeo, steelMat);
  topTrack.position.set(0, 2.24, 0);
  group.add(topTrack);

  // Left and right outer door frames (X = +/-1.20m)
  const sideGeo = geometries.get('metro_door_side_frame', () => new THREE.BoxGeometry(0.12, 2.2, 0.16));
  const sideL = new THREE.Mesh(sideGeo, steelMat);
  sideL.position.set(-1.20, 1.14, 0);
  group.add(sideL);

  const sideR = new THREE.Mesh(sideGeo, steelMat);
  sideR.position.set(1.20, 1.14, 0);
  group.add(sideR);

  // High-visibility yellow safety edge material & tinted glass
  const yellowMat = materials.get('metro_door_yellow_edge', {
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  const winMat = materials.get('metro_door_window_mat', {
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    roughness: 0.15,
    metalness: 0.5,
  });
  const leafGeo = geometries.get('metro_door_leaf_w80', () => new THREE.BoxGeometry(0.80, 2.08, 0.05));
  const yellowStripeGeo = geometries.get('metro_door_yellow_stripe', () => new THREE.BoxGeometry(0.06, 2.08, 0.055));
  const winGeo = geometries.get('metro_door_window', () => new THREE.BoxGeometry(0.42, 0.72, 0.06));
  const handleGeo = geometries.get('metro_door_handle', () => new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8));

  // Left sliding pocket group
  const slideL = new THREE.Group();
  const leafL = new THREE.Mesh(leafGeo, steelMat);
  leafL.position.set(-0.41, 1.12, 0);
  slideL.add(leafL);

  const yL = new THREE.Mesh(yellowStripeGeo, yellowMat);
  yL.position.set(-0.04, 1.12, 0);
  slideL.add(yL);

  const winL = new THREE.Mesh(winGeo, winMat);
  winL.position.set(-0.44, 1.35, 0);
  slideL.add(winL);

  const handleL = new THREE.Mesh(handleGeo, steelMat);
  handleL.position.set(-0.14, 1.05, 0.04);
  slideL.add(handleL);

  group.add(slideL);

  // Right sliding pocket group
  const slideR = new THREE.Group();
  const leafR = new THREE.Mesh(leafGeo, steelMat);
  leafR.position.set(0.41, 1.12, 0);
  slideR.add(leafR);

  const yR = new THREE.Mesh(yellowStripeGeo, yellowMat);
  yR.position.set(0.04, 1.12, 0);
  slideR.add(yR);

  const winR = new THREE.Mesh(winGeo, winMat);
  winR.position.set(0.44, 1.35, 0);
  slideR.add(winR);

  const handleR = new THREE.Mesh(handleGeo, steelMat);
  handleR.position.set(0.14, 1.05, 0.04);
  slideR.add(handleR);

  // Rubber seal on right leaf inner edge
  const rubberMat = materials.get('metro_door_rubber_mat', {
    color: 0x0f172a,
    roughness: 0.95,
  });
  const rubberGeo = geometries.get('metro_door_rubber', () => new THREE.BoxGeometry(0.04, 2.08, 0.06));
  const rubber = new THREE.Mesh(rubberGeo, rubberMat);
  rubber.position.set(-0.01, 1.12, 0);
  slideR.add(rubber);

  group.add(slideR);

  group.userData.doorType = 'sliding';
  group.userData.slideL = slideL;
  group.userData.slideR = slideR;
  group.userData.doorFacingNormal = new THREE.Vector3(0, 0, 1);

  applyShadows(group);
  return group;
}

export function createDoorSuburbanGateMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isDoor = true;
  group.userData.isWall = true;

  // Flagstone pavement / grass base
  const baseGeo = geometries.get('suburban_gate_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
  const baseMat = materials.get('sopelana_pavement', {
    color: 0x94a3b8,
    roughness: 0.85,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.1;
  group.add(base);

  // Two painted wooden gate posts at +/-0.78m (inner edge +/-0.67m -> 1.34m clear opening >= 1.2m)
  const postMat = materials.get('suburban_post_wood', {
    color: 0xf8fafc,
    roughness: 0.6,
    metalness: 0.05,
  });
  const postGeo = geometries.get('suburban_gate_post', () => new THREE.BoxGeometry(0.22, 1.6, 0.22));
  const capGeo = geometries.get('suburban_gate_cap', () => new THREE.ConeGeometry(0.18, 0.16, 4));
  capGeo.rotateY(Math.PI / 4);

  for (const px of [-0.78, 0.78]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, 0.9, 0);
    group.add(post);

    const cap = new THREE.Mesh(capGeo, postMat);
    cap.position.set(px, 1.78, 0);
    group.add(cap);
  }

  // Wooden picket gate rigged to hingeGroup (at X = -0.67m)
  const hingeGroup = new THREE.Group();
  hingeGroup.position.set(-0.67, 0, 0);

  const gateWoodMat = materials.get('suburban_gate_wood', {
    color: 0x166534, // Basque green
    roughness: 0.65,
    metalness: 0.08,
  });
  const railGeo = geometries.get('suburban_gate_rail_w132', () => new THREE.BoxGeometry(1.32, 0.08, 0.05));
  const railTop = new THREE.Mesh(railGeo, gateWoodMat);
  railTop.position.set(0.66, 1.25, 0);
  hingeGroup.add(railTop);

  const railBot = new THREE.Mesh(railGeo, gateWoodMat);
  railBot.position.set(0.66, 0.45, 0);
  hingeGroup.add(railBot);

  const braceGeo = geometries.get('suburban_gate_brace_w146', () => new THREE.BoxGeometry(1.46, 0.06, 0.04));
  const brace = new THREE.Mesh(braceGeo, gateWoodMat);
  brace.position.set(0.66, 0.85, 0.01);
  brace.rotation.z = 0.55;
  hingeGroup.add(brace);

  // 8 Vertical pointed pickets across 1.32m width
  const picketGeo = geometries.get('suburban_picket', () => new THREE.BoxGeometry(0.09, 1.15, 0.035));
  const tipGeo = geometries.get('suburban_picket_tip', () => new THREE.ConeGeometry(0.065, 0.12, 4));
  tipGeo.rotateY(Math.PI / 4);

  for (let i = 0; i < 8; i++) {
    const xPos = 0.10 + i * 0.16;
    const picket = new THREE.Mesh(picketGeo, gateWoodMat);
    picket.position.set(xPos, 0.85, 0.02);
    hingeGroup.add(picket);

    const tip = new THREE.Mesh(tipGeo, gateWoodMat);
    tip.position.set(xPos, 1.48, 0.02);
    hingeGroup.add(tip);
  }

  // Wrought iron hinges & latch
  const ironMat = materials.get('suburban_gate_iron', {
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.85,
  });
  const hingeGeo = geometries.get('suburban_hinge', () => new THREE.BoxGeometry(0.42, 0.04, 0.05));
  const hingeTop = new THREE.Mesh(hingeGeo, ironMat);
  hingeTop.position.set(0.15, 1.25, 0.035);
  hingeGroup.add(hingeTop);

  const hingeBot = new THREE.Mesh(hingeGeo, ironMat);
  hingeBot.position.set(0.15, 0.45, 0.035);
  hingeGroup.add(hingeBot);

  const latchGeo = geometries.get('suburban_latch', () => new THREE.TorusGeometry(0.05, 0.012, 8, 16));
  const latch = new THREE.Mesh(latchGeo, ironMat);
  latch.position.set(1.26, 0.95, 0.04);
  hingeGroup.add(latch);

  group.add(hingeGroup);

  group.userData.doorType = 'single_hinge';
  group.userData.hinge = hingeGroup;
  group.userData.doorFacingNormal = new THREE.Vector3(0, 0, 1);

  applyShadows(group);
  return group;
}

export function createDoorSopelanaIronMesh(): THREE.Group {
  const group = new THREE.Group();
  group.userData.isDoor = true;
  group.userData.isWall = true;

  // Cliffside stone pavement base
  const baseGeo = geometries.get('sopelana_stone_base', () => new THREE.BoxGeometry(2.0, 0.2, 2.0));
  const baseMat = materials.get('sopelana_pavement', {
    color: 0x78716c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.1;
  group.add(base);

  // Two massive carved granite pillars at +/-1.35m (inner edge +/-1.17m -> 2.34m clear opening >= 2.2m)
  const pillarMat = materials.get('sopelana_iron_pillar_mat', {
    color: 0x57534e,
    roughness: 0.95,
    metalness: 0.02,
  });
  const pillarGeo = geometries.get('sopelana_gate_pillar', () => new THREE.BoxGeometry(0.36, 2.2, 0.36));
  const capGeo = geometries.get('sopelana_gate_pillar_cap', () => new THREE.ConeGeometry(0.28, 0.24, 4));
  capGeo.rotateY(Math.PI / 4);

  for (const px of [-1.35, 1.35]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 1.2, 0);
    group.add(pillar);

    const cap = new THREE.Mesh(capGeo, pillarMat);
    cap.position.set(px, 2.42, 0);
    group.add(cap);
  }

  // Black wrought-iron double gate wings
  const ironMat = materials.get('sopelana_wrought_iron_mat', {
    color: 0x1c1917,
    roughness: 0.3,
    metalness: 0.88,
  });
  const botRailGeo = geometries.get('sopelana_iron_bot_rail_w116', () => new THREE.BoxGeometry(1.16, 0.06, 0.06));
  const midRailGeo = geometries.get('sopelana_iron_mid_rail_w116', () => new THREE.BoxGeometry(1.16, 0.05, 0.05));
  const topRailGeo = geometries.get('sopelana_iron_top_rail_w116', () => new THREE.BoxGeometry(1.16, 0.06, 0.06));
  const barGeo = geometries.get('sopelana_iron_bar', () => new THREE.CylinderGeometry(0.016, 0.016, 1.85, 8));
  const spearGeo = geometries.get('sopelana_iron_spear', () => new THREE.ConeGeometry(0.04, 0.14, 4));
  const scrollGeo = geometries.get('sopelana_iron_scroll', () => new THREE.TorusGeometry(0.08, 0.014, 8, 16));
  const halfLockGeo = geometries.get('sopelana_iron_halflock', () => new THREE.BoxGeometry(0.08, 0.22, 0.08));

  // Left iron wing rigged to hingeL (at X = -1.17m)
  const hingeL = new THREE.Group();
  hingeL.position.set(-1.17, 0, 0);

  const botL = new THREE.Mesh(botRailGeo, ironMat);
  botL.position.set(0.58, 0.32, 0);
  hingeL.add(botL);

  const midL = new THREE.Mesh(midRailGeo, ironMat);
  midL.position.set(0.58, 1.15, 0);
  hingeL.add(midL);

  const topL = new THREE.Mesh(topRailGeo, ironMat);
  topL.position.set(0.58, 1.95, 0);
  hingeL.add(topL);

  for (let i = 0; i < 5; i++) {
    const bx = 0.14 + i * 0.22;
    const bar = new THREE.Mesh(barGeo, ironMat);
    bar.position.set(bx, 1.15, 0);
    hingeL.add(bar);

    const spear = new THREE.Mesh(spearGeo, ironMat);
    spear.position.set(bx, 2.14, 0);
    hingeL.add(spear);
  }

  for (const sx of [0.36, 0.80]) {
    const scroll = new THREE.Mesh(scrollGeo, ironMat);
    scroll.position.set(sx, 1.55, 0);
    hingeL.add(scroll);
  }

  const lockL = new THREE.Mesh(halfLockGeo, ironMat);
  lockL.position.set(1.12, 1.15, 0);
  hingeL.add(lockL);

  group.add(hingeL);

  // Right iron wing rigged to hingeR (at X = +1.17m)
  const hingeR = new THREE.Group();
  hingeR.position.set(1.17, 0, 0);

  const botR = new THREE.Mesh(botRailGeo, ironMat);
  botR.position.set(-0.58, 0.32, 0);
  hingeR.add(botR);

  const midR = new THREE.Mesh(midRailGeo, ironMat);
  midR.position.set(-0.58, 1.15, 0);
  hingeR.add(midR);

  const topR = new THREE.Mesh(topRailGeo, ironMat);
  topR.position.set(-0.58, 1.95, 0);
  hingeR.add(topR);

  for (let i = 0; i < 5; i++) {
    const bx = -0.14 - i * 0.22;
    const bar = new THREE.Mesh(barGeo, ironMat);
    bar.position.set(bx, 1.15, 0);
    hingeR.add(bar);

    const spear = new THREE.Mesh(spearGeo, ironMat);
    spear.position.set(bx, 2.14, 0);
    hingeR.add(spear);
  }

  for (const sx of [-0.36, -0.80]) {
    const scroll = new THREE.Mesh(scrollGeo, ironMat);
    scroll.position.set(sx, 1.55, 0);
    hingeR.add(scroll);
  }

  const lockR = new THREE.Mesh(halfLockGeo, ironMat);
  lockR.position.set(-1.12, 1.15, 0);
  hingeR.add(lockR);

  group.add(hingeR);

  group.userData.doorType = 'double_hinge';
  group.userData.hingeL = hingeL;
  group.userData.hingeR = hingeR;
  group.userData.doorFacingNormal = new THREE.Vector3(0, 0, 1);

  applyShadows(group);
  return group;
}

// ============================================================================
// Floor Attachments (Decals / Rugs)
// ============================================================================

const rugTextureCache = new Map<string, THREE.CanvasTexture>();

export function getRugTexture(style: 'persian' | 'bath_mat' | 'modern' | string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  let cached = rugTextureCache.get(style);
  if (cached) return cached;

  const width = 512;
  const height = 352;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (style === 'persian') {
    // 1. Base deep burgundy / crimson (#8b1e2d)
    ctx.fillStyle = '#8b1e2d';
    ctx.fillRect(0, 0, width, height);

    // Subtle woven fabric cross-hatch texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let x = 0; x < width; x += 4) {
      ctx.fillRect(x, 0, 1, height);
    }
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }

    // 2. Wide ornamental navy blue border frame (#1e1b4b)
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 26;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    // 3. Ornate gold / amber filigree ribbons (#d97706)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.strokeRect(31, 31, width - 62, height - 62);

    // Ornate border floral/geometric dots along navy ribbon
    ctx.fillStyle = '#fef08a';
    for (let x = 36; x < width - 36; x += 22) {
      ctx.beginPath();
      ctx.arc(x, 18, 3, 0, Math.PI * 2);
      ctx.arc(x, height - 18, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let y = 36; y < height - 36; y += 22) {
      ctx.beginPath();
      ctx.arc(18, y, 3, 0, Math.PI * 2);
      ctx.arc(width - 18, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Corner quarter-medallions (navy & gold)
    const cornerOffsets = [
      [31, 31],
      [width - 31, 31],
      [31, height - 31],
      [width - 31, height - 31],
    ];
    for (const [ox, oy] of cornerOffsets) {
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(ox, oy, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(ox, oy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Central Grand Medallion (Navy & Gold Diamond with floral core)
    const cx = width / 2;
    const cy = height / 2;
    ctx.save();
    ctx.translate(cx, cy);

    // Outer diamond (navy)
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(0, -85);
    ctx.lineTo(125, 0);
    ctx.lineTo(0, 85);
    ctx.lineTo(-125, 0);
    ctx.closePath();
    ctx.fill();

    // Diamond gold rim
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Inner gold diamond
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(90, 0);
    ctx.lineTo(0, 60);
    ctx.lineTo(-90, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center cream flower/star
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b1e2d';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 6. Fringe details at the short edges (left and right)
    ctx.fillStyle = '#fef9c3';
    for (let y = 6; y < height - 6; y += 6) {
      ctx.fillRect(0, y, 6, 3);
      ctx.fillRect(width - 6, y, 6, 3);
    }
  } else if (style === 'bath_mat') {
    // Soft textured teal/cyan base
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(0, 0, width, height);

    // Soft rounded embossed border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Cream / soft cyan ribbed geometric stripes
    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    for (let x = 30; x < width - 30; x += 28) {
      ctx.fillRect(x, 22, 14, height - 44);
    }

    // Soft geometric diamond relief pattern in center
    ctx.strokeStyle = '#cffafe';
    ctx.lineWidth = 4;
    for (let x = 44; x < width - 44; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, height / 2 - 38);
      ctx.lineTo(x + 28, height / 2);
      ctx.lineTo(x, height / 2 + 38);
      ctx.lineTo(x - 28, height / 2);
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    // Modern Scandinavian / Bauhaus geometric rug
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    // Cream triangle
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.62, 0);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Mustard yellow wedge
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(width * 0.38, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width * 0.68, height);
    ctx.closePath();
    ctx.fill();

    // Terracotta warm accent
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(width * 0.68, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, height * 0.38);
    ctx.closePath();
    ctx.fill();

    // Dusty teal curved circle
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(width * 0.36, height * 0.64, 76, 0, Math.PI * 2);
    ctx.fill();

    // Clean crisp border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, width - 12, height - 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  rugTextureCache.set(style, texture);
  return texture;
}

export function createRugMesh(style: 'persian' | 'bath_mat' | 'modern' | string = 'persian'): THREE.Group {
  const group = new THREE.Group();
  group.name = `Rug_${style}`;
  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;

  // Geometry: 1.6m x 1.1m horizontal flat plane facing up
  const geo = geometries.get(`rug_plane_16_11_${style}`, () => {
    const plane = new THREE.PlaneGeometry(1.6, 1.1);
    plane.rotateX(-Math.PI / 2);
    return plane;
  });

  const texture = getRugTexture(style);
  const fallbackColor = style === 'persian' ? 0x8b1e2d : style === 'bath_mat' ? 0x0891b2 : 0x1e293b;

  const matKey = `rug_pbr_mat_${style}`;
  const matParams: THREE.MeshStandardMaterialParameters = {
    color: texture ? 0xffffff : fallbackColor,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  };
  if (texture) {
    matParams.map = texture;
  }
  let mat = materials.get(matKey, matParams);
  if (texture && mat.map !== texture) {
    mat.map = texture;
    mat.needsUpdate = true;
  }
  mat.depthWrite = true;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1.0;
  mat.polygonOffsetUnits = -1.0;

  const rugMesh = new THREE.Mesh(geo, mat);
  rugMesh.position.y = 0.025; // Base elevation strictly at y = 0.025m
  rugMesh.receiveShadow = true;
  rugMesh.userData.isSolid = false;
  rugMesh.userData.isFloorDecor = true;
  group.add(rugMesh);

  // For Persian style: add fine physical 3D fringe tassel ribbons at short edges
  if (style === 'persian') {
    const fringeGeo = geometries.get('rug_persian_fringe_ribbon', () => {
      const p = new THREE.PlaneGeometry(0.06, 1.1);
      p.rotateX(-Math.PI / 2);
      return p;
    });
    const fringeMat = materials.get('rug_persian_fringe_tassels', {
      color: 0xfef9c3,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    fringeMat.depthWrite = true;
    fringeMat.polygonOffset = true;
    fringeMat.polygonOffsetFactor = -1.0;
    fringeMat.polygonOffsetUnits = -1.0;

    for (const fx of [-0.83, 0.83]) {
      const fringe = new THREE.Mesh(fringeGeo, fringeMat);
      fringe.position.set(fx, 0.0252, 0);
      fringe.userData.isSolid = false;
      fringe.userData.isFloorDecor = true;
      group.add(fringe);
    }
  }

  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;
  group.traverse((c) => {
    c.userData.isSolid = false;
    c.userData.isFloorDecor = true;
  });

  applyShadows(group);
  return group;
}

export function createRugPersianMesh(): THREE.Group {
  return createRugMesh('persian');
}

export function createRugBathMatMesh(): THREE.Group {
  return createRugMesh('bath_mat');
}

export function createRugModernMesh(): THREE.Group {
  return createRugMesh('modern');
}

export function createBeachTowelBlueMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Beach_Towel_Blue';
  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;

  const baseGeo = geometries.get('beach_towel_base', () => {
    const geo = new THREE.PlaneGeometry(0.8, 1.6);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const baseMat = materials.get('beach_towel_blue_mat', {
    color: 0x0284c7, // Mediterranean azure
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  baseMat.depthWrite = true;
  baseMat.polygonOffset = true;
  baseMat.polygonOffsetFactor = -1.0;
  baseMat.polygonOffsetUnits = -1.0;

  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.025;
  base.receiveShadow = true;
  base.userData.isSolid = false;
  base.userData.isFloorDecor = true;
  group.add(base);

  // Crisp white decorative border bands at top & bottom ends
  const bandGeo = geometries.get('beach_towel_band', () => {
    const geo = new THREE.PlaneGeometry(0.74, 0.08);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const bandMat = materials.get('beach_towel_white_band', {
    color: 0xf8fafc,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  bandMat.depthWrite = true;
  bandMat.polygonOffset = true;
  bandMat.polygonOffsetFactor = -1.0;
  bandMat.polygonOffsetUnits = -1.0;

  for (const bz of [-0.62, -0.48, 0.48, 0.62]) {
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(0, 0.0252, bz);
    band.userData.isSolid = false;
    band.userData.isFloorDecor = true;
    group.add(band);
  }

  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;
  group.traverse((c) => {
    c.userData.isSolid = false;
    c.userData.isFloorDecor = true;
  });

  applyShadows(group);
  return group;
}

export function createBeachTowelStripedMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Beach_Towel_Striped';
  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;

  const baseGeo = geometries.get('beach_towel_base', () => {
    const geo = new THREE.PlaneGeometry(0.8, 1.6);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const baseMat = materials.get('beach_towel_white_mat', {
    color: 0xf8fafc,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  baseMat.depthWrite = true;
  baseMat.polygonOffset = true;
  baseMat.polygonOffsetFactor = -1.0;
  baseMat.polygonOffsetUnits = -1.0;

  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.025;
  base.receiveShadow = true;
  base.userData.isSolid = false;
  base.userData.isFloorDecor = true;
  group.add(base);

  // Alternating cabana stripes along length (amber gold & coral red)
  const stripeGeo = geometries.get('beach_towel_stripe_geo', () => {
    const geo = new THREE.PlaneGeometry(0.12, 1.56);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const stripeGold = materials.get('beach_towel_gold_stripe', {
    color: 0xf59e0b,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  stripeGold.depthWrite = true;
  stripeGold.polygonOffset = true;
  stripeGold.polygonOffsetFactor = -1.0;
  stripeGold.polygonOffsetUnits = -1.0;

  const stripeCoral = materials.get('beach_towel_coral_stripe', {
    color: 0xef4444,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  stripeCoral.depthWrite = true;
  stripeCoral.polygonOffset = true;
  stripeCoral.polygonOffsetFactor = -1.0;
  stripeCoral.polygonOffsetUnits = -1.0;

  const offsets = [-0.28, -0.10, 0.10, 0.28];
  offsets.forEach((ox, idx) => {
    const stripe = new THREE.Mesh(stripeGeo, idx % 2 === 0 ? stripeGold : stripeCoral);
    stripe.position.set(ox, 0.0252, 0);
    stripe.userData.isSolid = false;
    stripe.userData.isFloorDecor = true;
    group.add(stripe);
  });

  group.userData.isSolid = false;
  group.userData.isFloorDecor = true;
  group.traverse((c) => {
    c.userData.isSolid = false;
    c.userData.isFloorDecor = true;
  });

  applyShadows(group);
  return group;
}

// ============================================================================
// Wall Attachments (Paintings / Signs - Eye level Y = 1.6m, Z = +0.145m)
// ============================================================================

export function createWallArtPsychedelicMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wall_Art_Psychedelic';

  const artGroup = new THREE.Group();
  artGroup.position.set(0, 1.6, 0.145);

  // Outer picture frame (matte black aluminium: 1.0m x 0.75m x 0.03m)
  const frameGeo = geometries.get('wall_art_frame_100_75', () => new THREE.BoxGeometry(1.0, 0.75, 0.03));
  const frameMat = materials.get('wall_art_black_frame', {
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.7,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  artGroup.add(frame);

  // Inner canvas backing (0.92m x 0.67m)
  const canvasGeo = geometries.get('wall_art_canvas_92_67', () => new THREE.PlaneGeometry(0.92, 0.67));
  const canvasMat = materials.get('wall_art_psych_bg', {
    color: 0x4c1d95, // Deep violet purple background
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const canvas = new THREE.Mesh(canvasGeo, canvasMat);
  canvas.position.z = 0.016;
  artGroup.add(canvas);

  // Concentric psychedelic rings / spiral shapes (electric magenta, lime, neon cyan)
  const ring1Geo = geometries.get('wall_art_ring_1', () => new THREE.RingGeometry(0.18, 0.28, 24));
  const ring1Mat = materials.get('wall_art_psych_magenta', {
    color: 0xd946ef,
    emissive: 0xd946ef,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
  ring1.position.z = 0.018;
  artGroup.add(ring1);

  const ring2Geo = geometries.get('wall_art_ring_2', () => new THREE.RingGeometry(0.08, 0.15, 24));
  const ring2Mat = materials.get('wall_art_psych_cyan', {
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.position.z = 0.019;
  artGroup.add(ring2);

  const centerDiscGeo = geometries.get('wall_art_disc_center', () => new THREE.CircleGeometry(0.06, 16));
  const centerDiscMat = materials.get('wall_art_psych_yellow', {
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  const centerDisc = new THREE.Mesh(centerDiscGeo, centerDiscMat);
  centerDisc.position.z = 0.02;
  artGroup.add(centerDisc);

  group.add(artGroup);
  applyShadows(group);
  return group;
}

export function createWallArtBasqueMapMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wall_Art_Basque_Map';

  const artGroup = new THREE.Group();
  artGroup.position.set(0, 1.6, 0.145);

  // Rustic oak wood frame (1.1m x 0.8m x 0.03m)
  const frameGeo = geometries.get('wall_art_frame_110_80', () => new THREE.BoxGeometry(1.1, 0.8, 0.03));
  const frameMat = materials.get('wall_art_oak_frame', {
    color: 0x78350f,
    roughness: 0.75,
    metalness: 0.05,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  artGroup.add(frame);

  // Parchment vintage paper canvas (1.02m x 0.72m)
  const canvasGeo = geometries.get('wall_art_canvas_102_72', () => new THREE.PlaneGeometry(1.02, 0.72));
  const canvasMat = materials.get('wall_art_parchment', {
    color: 0xfef3c7,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const canvas = new THREE.Mesh(canvasGeo, canvasMat);
  canvas.position.z = 0.016;
  artGroup.add(canvas);

  // Basque coastline and mountains (Bay of Biscay sea block)
  const seaGeo = geometries.get('basque_map_sea', () => new THREE.PlaneGeometry(0.96, 0.28));
  const seaMat = materials.get('basque_map_sea_mat', {
    color: 0x38bdf8,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(0, 0.18, 0.018);
  artGroup.add(sea);

  // Basque green hills / province shapes
  const landGeo = geometries.get('basque_map_land', () => new THREE.PlaneGeometry(0.94, 0.36));
  const landMat = materials.get('basque_map_land_mat', {
    color: 0x15803d,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const land = new THREE.Mesh(landGeo, landMat);
  land.position.set(0, -0.12, 0.018);
  artGroup.add(land);

  // Ikurriña cross badge in bottom-right corner
  const badgeBackGeo = geometries.get('basque_badge_back', () => new THREE.PlaneGeometry(0.24, 0.16));
  const badgeBackMat = materials.get('basque_red_mat', {
    color: 0xb91c1c,
    side: THREE.DoubleSide,
  });
  const badgeBack = new THREE.Mesh(badgeBackGeo, badgeBackMat);
  badgeBack.position.set(0.32, -0.22, 0.02);
  artGroup.add(badgeBack);

  const crossHGeo = geometries.get('basque_cross_h', () => new THREE.PlaneGeometry(0.24, 0.035));
  const whiteMat = materials.get('basque_white_mat', { color: 0xffffff, side: THREE.DoubleSide });
  const crossH = new THREE.Mesh(crossHGeo, whiteMat);
  crossH.position.set(0.32, -0.22, 0.022);
  artGroup.add(crossH);

  const crossVGeo = geometries.get('basque_cross_v', () => new THREE.PlaneGeometry(0.035, 0.16));
  const crossV = new THREE.Mesh(crossVGeo, whiteMat);
  crossV.position.set(0.32, -0.22, 0.022);
  artGroup.add(crossV);

  group.add(artGroup);
  applyShadows(group);
  return group;
}

export function createWallArtPosterMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wall_Art_Poster';

  const artGroup = new THREE.Group();
  artGroup.position.set(0, 1.6, 0.145);

  // Slim aluminum frame (0.75m x 1.05m x 0.025m)
  const frameGeo = geometries.get('wall_art_poster_frame', () => new THREE.BoxGeometry(0.75, 1.05, 0.025));
  const frameMat = materials.get('wall_art_poster_frame_mat', {
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.6,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  artGroup.add(frame);

  // Dark music/festival graphic poster background
  const posterGeo = geometries.get('wall_art_poster_canvas', () => new THREE.PlaneGeometry(0.7, 1.0));
  const posterMat = materials.get('wall_art_poster_bg', {
    color: 0x0f172a,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const poster = new THREE.Mesh(posterGeo, posterMat);
  poster.position.z = 0.014;
  artGroup.add(poster);

  // Glowing retro sunset half-sun (orange-to-gold)
  const sunGeo = geometries.get('wall_art_poster_sun', () => new THREE.CircleGeometry(0.24, 24, 0, Math.PI));
  const sunMat = materials.get('wall_art_poster_sun_mat', {
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 0.15, 0.016);
  artGroup.add(sun);

  // Graphic horizontal stripes below sun
  const stripeGeo = geometries.get('wall_art_poster_stripe', () => new THREE.PlaneGeometry(0.55, 0.03));
  const stripeColors = [0xfbbf24, 0xf43f5e, 0x8b5cf6, 0x06b6d4];
  stripeColors.forEach((col, idx) => {
    const sMat = materials.get(`poster_stripe_${col}`, { color: col, side: THREE.DoubleSide });
    const sMesh = new THREE.Mesh(stripeGeo, sMat);
    sMesh.position.set(0, -0.05 - idx * 0.06, 0.017);
    artGroup.add(sMesh);
  });

  group.add(artGroup);
  applyShadows(group);
  return group;
}

export function createStoreSignNeonMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Store_Sign_Neon';

  const signGroup = new THREE.Group();
  signGroup.position.set(0, 1.6, 0.145);

  // Sleek black acrylic mounting panel (1.0m x 0.5m x 0.03m)
  const backGeo = geometries.get('neon_sign_back', () => new THREE.BoxGeometry(1.0, 0.5, 0.03));
  const backMat = materials.get('neon_sign_back_mat', {
    color: 0x09090b,
    roughness: 0.2,
    metalness: 0.8,
  });
  const back = new THREE.Mesh(backGeo, backMat);
  signGroup.add(back);

  // Neon glowing outer border (0.92m x 0.42m wire rectangle)
  const borderGeo = geometries.get('neon_sign_border', () => new THREE.BoxGeometry(0.92, 0.42, 0.015));
  const neonCyanMat = materials.get('neon_sign_cyan_mat', {
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const border = new THREE.Mesh(borderGeo, neonCyanMat);
  border.position.z = 0.02;
  signGroup.add(border);

  // Center neon tube typography blocks
  const textBarGeo = geometries.get('neon_sign_bar', () => new THREE.BoxGeometry(0.72, 0.08, 0.02));
  const neonPinkMat = materials.get('neon_sign_pink_mat', {
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });
  const barTop = new THREE.Mesh(textBarGeo, neonPinkMat);
  barTop.position.set(0, 0.06, 0.025);
  signGroup.add(barTop);

  const barBot = new THREE.Mesh(textBarGeo, neonCyanMat);
  barBot.position.set(0, -0.06, 0.025);
  signGroup.add(barBot);

  // Point light providing vibrant atmospheric neon emission
  const neonLight = new THREE.PointLight(0x06b6d4, 0.9, 3.5);
  neonLight.position.set(0, 0, 0.15);
  signGroup.add(neonLight);

  group.add(signGroup);
  applyShadows(group);
  return group;
}

// ============================================================================
// Interactive Puzzle Entities (Keypad Terminal & Clues)
// ============================================================================

let cachedStickyNoteCanvas: HTMLCanvasElement | null = null;
let cachedStickyNoteTexture: THREE.CanvasTexture | null = null;

export function getStickyNoteCanvas(): HTMLCanvasElement {
  if (cachedStickyNoteCanvas) return cachedStickyNoteCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Classic Post-it bright yellow paper background
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, 0, 512, 512);

  // 2. Top glue strip (slightly darker warm yellow)
  ctx.fillStyle = '#fde047';
  ctx.fillRect(0, 0, 512, 50);

  // 3. Subtle paper noise / grain
  ctx.fillStyle = 'rgba(0,0,0,0.025)';
  for (let i = 0; i < 600; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // 4. Scribbled handwritten clue text
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';

  // "KÓD:"
  ctx.font = 'bold 44px "Caveat", "Comic Sans MS", cursive, sans-serif';
  ctx.fillText('KÓD:', 256, 145);

  // "a délutáni rituálé"
  ctx.font = '36px "Caveat", "Comic Sans MS", cursive, sans-serif';
  ctx.fillText('a délutáni rituálé', 256, 225);

  // "ideje... 🌿"
  ctx.font = '36px "Caveat", "Comic Sans MS", cursive, sans-serif';
  ctx.fillText('ideje... 🌿', 256, 295);

  // Decorative squiggly underline
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(140, 320);
  ctx.quadraticCurveTo(256, 335, 372, 320);
  ctx.stroke();

  // "4:20" clock motif
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('🕒 4:20', 256, 420);

  cachedStickyNoteCanvas = canvas;
  return canvas;
}

export function getStickyNoteTexture(): THREE.CanvasTexture {
  if (cachedStickyNoteTexture) return cachedStickyNoteTexture;
  const canvas = getStickyNoteCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  cachedStickyNoteTexture = texture;
  return texture;
}

export function createStickyNoteClueMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sticky_Note_Clue';
  group.userData.isFloorDecor = true;
  group.userData.isSolid = false;

  const noteGeo = geometries.get('sticky_note_plane_geo', () => new THREE.PlaneGeometry(0.32, 0.32));
  const noteMat = new THREE.MeshStandardMaterial({
    map: getStickyNoteTexture(),
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
  });

  const noteMesh = new THREE.Mesh(noteGeo, noteMat);
  noteMesh.rotation.x = -Math.PI / 2;
  noteMesh.rotation.z = 0.12;
  noteMesh.position.set(0, 0.965, 0);

  group.add(noteMesh);
  return group;
}

export function createKeypadTerminalMesh(isUnlocked: boolean = false): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Keypad_Terminal';
  group.userData.isKeypad = true;
  group.userData.isUnlocked = isUnlocked;

  const terminalGroup = new THREE.Group();
  // Standard eye/hand interaction height (y = 1.35m, flush on wall face z = 0.145m)
  terminalGroup.position.set(0, 1.35, 0.145);

  // 1. Back wall bracket / mounting plate
  const backGeo = geometries.get('keypad_back_plate', () => new THREE.BoxGeometry(0.38, 0.52, 0.04));
  const backMat = materials.get('keypad_back_mat', {
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.8,
  });
  const back = new THREE.Mesh(backGeo, backMat);
  terminalGroup.add(back);

  // 2. Beveled industrial keypad housing
  const bodyGeo = geometries.get('keypad_body', () => new THREE.BoxGeometry(0.34, 0.48, 0.045));
  const bodyMat = materials.get('keypad_body_mat', {
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.85,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = 0.02;
  terminalGroup.add(body);

  // 3. CRT readout display screen (at top of unit)
  const screenGeo = geometries.get('keypad_screen', () => new THREE.BoxGeometry(0.24, 0.085, 0.015));
  const screenMat = materials.get('keypad_screen_mat', {
    color: 0x052e16,
    emissive: 0x14532d,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.14, 0.045);
  terminalGroup.add(screen);

  // 4. Bi-color status LED (Red when locked, Green when unlocked)
  const ledCol = isUnlocked ? 0x22c55e : 0xef4444;
  const ledMat = new THREE.MeshStandardMaterial({
    color: ledCol,
    emissive: ledCol,
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });
  const ledGeo = geometries.get('keypad_led_dome', () => new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16));
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.rotation.x = Math.PI / 2;
  ledMesh.position.set(0.12, 0.14, 0.048);
  terminalGroup.add(ledMesh);

  // Point light for subtle ambient emission
  const ledLight = new THREE.PointLight(ledCol, isUnlocked ? 1.0 : 0.6, 2.0);
  ledLight.position.set(0.12, 0.14, 0.1);
  terminalGroup.add(ledLight);

  // 5. Tactile 3x4 numeric keypad buttons (0-9, *, #)
  const btnGeo = geometries.get('keypad_btn', () => new THREE.BoxGeometry(0.055, 0.042, 0.02));
  const btnMat = materials.get('keypad_btn_mat', {
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.3,
  });

  const cols = [-0.075, 0, 0.075];
  const rows = [0.04, -0.03, -0.1, -0.17];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.set(cols[c], rows[r], 0.045);
      terminalGroup.add(btn);
    }
  }

  group.userData.ledMesh = ledMesh;
  group.userData.ledLight = ledLight;
  group.userData.terminalGroup = terminalGroup;

  group.add(terminalGroup);
  applyShadows(group);
  return group;
}

export function setKeypadTerminalVisual(group: THREE.Object3D, isUnlocked: boolean): void {
  group.userData.isUnlocked = isUnlocked;
  const col = isUnlocked ? 0x22c55e : 0xef4444;

  let ledMesh = group.userData.ledMesh as THREE.Mesh | undefined;
  let ledLight = group.userData.ledLight as THREE.PointLight | undefined;

  if (!ledMesh || !ledLight) {
    group.traverse((c) => {
      if (c instanceof THREE.Mesh && c.geometry?.type === 'CylinderGeometry') {
        ledMesh = c;
      } else if (c instanceof THREE.PointLight) {
        ledLight = c;
      }
    });
  }

  if (ledMesh && ledMesh.material) {
    const mat = ledMesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(col);
    mat.emissive.setHex(col);
    mat.emissiveIntensity = isUnlocked ? 2.2 : 1.4;
  }
  if (ledLight) {
    ledLight.color.setHex(col);
    ledLight.intensity = isUnlocked ? 1.0 : 0.6;
  }
}

// ============================================================================
// Modular & Interior Furniture
// ============================================================================

export function createWardrobeMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wardrobe';

  const woodMat = materials.get('wardrobe_wood_mat', {
    color: 0x5c3a21,
    roughness: 0.65,
    metalness: 0.08,
  });

  // Main cabinet carcass (1.0m x 2.1m x 0.6m)
  const bodyGeo = geometries.get('wardrobe_body', () => new THREE.BoxGeometry(1.0, 2.1, 0.6));
  const body = new THREE.Mesh(bodyGeo, woodMat);
  body.position.set(0, 1.1, 0);
  group.add(body);

  // Top decorative crown molding (1.04m x 0.08m x 0.64m)
  const crownGeo = geometries.get('wardrobe_crown', () => new THREE.BoxGeometry(1.04, 0.08, 0.64));
  const crown = new THREE.Mesh(crownGeo, woodMat);
  crown.position.set(0, 2.19, 0);
  group.add(crown);

  // Plinth base (0.98m x 0.08m x 0.58m)
  const plinthGeo = geometries.get('wardrobe_plinth', () => new THREE.BoxGeometry(0.98, 0.08, 0.58));
  const plinth = new THREE.Mesh(plinthGeo, woodMat);
  plinth.position.set(0, 0.04, 0);
  group.add(plinth);

  // Left & Right door panels with bevel relief
  const doorGeo = geometries.get('wardrobe_door', () => new THREE.BoxGeometry(0.47, 1.96, 0.02));
  const doorL = new THREE.Mesh(doorGeo, woodMat);
  doorL.position.set(-0.245, 1.1, 0.31);
  group.add(doorL);

  const doorR = new THREE.Mesh(doorGeo, woodMat);
  doorR.position.set(0.245, 1.1, 0.31);
  group.add(doorR);

  // Sleek brushed nickel handles
  const handleGeo = geometries.get('wardrobe_handle', () => new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8));
  const handleMat = materials.get('wardrobe_handle_mat', {
    color: 0xd1d5db,
    roughness: 0.25,
    metalness: 0.85,
  });
  const handleL = new THREE.Mesh(handleGeo, handleMat);
  handleL.position.set(-0.06, 1.1, 0.33);
  group.add(handleL);

  const handleR = new THREE.Mesh(handleGeo, handleMat);
  handleR.position.set(0.06, 1.1, 0.33);
  group.add(handleR);

  applyShadows(group);
  return group;
}

export function createDresserMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Dresser';

  const oakMat = materials.get('dresser_oak_mat', {
    color: 0x92400e,
    roughness: 0.6,
    metalness: 0.05,
  });

  // Carcass box (1.0m x 0.72m x 0.5m)
  const bodyGeo = geometries.get('dresser_body', () => new THREE.BoxGeometry(1.0, 0.72, 0.5));
  const body = new THREE.Mesh(bodyGeo, oakMat);
  body.position.set(0, 0.54, 0);
  group.add(body);

  // 3 stacked drawer front faces (0.94m x 0.21m x 0.02m)
  const drawerGeo = geometries.get('dresser_drawer_face', () => new THREE.BoxGeometry(0.94, 0.21, 0.02));
  const handleGeo = geometries.get('dresser_handle', () => new THREE.BoxGeometry(0.24, 0.02, 0.02));
  const handleMat = materials.get('dresser_handle_mat', {
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.8,
  });

  for (let i = 0; i < 3; i++) {
    const dy = 0.29 + i * 0.24;
    const drawer = new THREE.Mesh(drawerGeo, oakMat);
    drawer.position.set(0, dy, 0.26);
    group.add(drawer);

    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, dy, 0.28);
    group.add(handle);
  }

  // 4 angled tapered legs (height 0.18m)
  const legGeo = geometries.get('dresser_leg', () => new THREE.CylinderGeometry(0.02, 0.035, 0.18, 8));
  const legPositions = [
    [-0.42, 0.09, -0.2],
    [0.42, 0.09, -0.2],
    [-0.42, 0.09, 0.2],
    [0.42, 0.09, 0.2],
  ];
  legPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, oakMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
  });

  applyShadows(group);
  return group;
}

export function createNightstandMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Nightstand';

  const woodMat = materials.get('nightstand_wood', {
    color: 0x78350f,
    roughness: 0.65,
    metalness: 0.05,
  });

  // Table body (0.5m x 0.52m x 0.45m)
  const bodyGeo = geometries.get('nightstand_body', () => new THREE.BoxGeometry(0.5, 0.52, 0.45));
  const body = new THREE.Mesh(bodyGeo, woodMat);
  body.position.set(0, 0.32, 0);
  group.add(body);

  // Bottom drawer face
  const drawerGeo = geometries.get('nightstand_drawer', () => new THREE.BoxGeometry(0.44, 0.2, 0.02));
  const drawer = new THREE.Mesh(drawerGeo, woodMat);
  drawer.position.set(0, 0.2, 0.235);
  group.add(drawer);

  const knobGeo = geometries.get('nightstand_knob', () => new THREE.SphereGeometry(0.018, 8, 8));
  const knobMat = materials.get('nightstand_knob_mat', {
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.8,
  });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.position.set(0, 0.2, 0.255);
  group.add(knob);

  // 4 small tapered feet
  const footGeo = geometries.get('nightstand_foot', () => new THREE.CylinderGeometry(0.015, 0.025, 0.08, 8));
  for (const [fx, fz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) {
    const foot = new THREE.Mesh(footGeo, woodMat);
    foot.position.set(fx, 0.04, fz);
    group.add(foot);
  }

  // Bedside ceramic reading lamp
  const lampBaseGeo = geometries.get('lamp_base_geo', () => new THREE.CylinderGeometry(0.06, 0.09, 0.12, 12));
  const lampBaseMat = materials.get('lamp_ceramic_mat', {
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.1,
  });
  const lampBase = new THREE.Mesh(lampBaseGeo, lampBaseMat);
  lampBase.position.set(0, 0.64, 0);
  group.add(lampBase);

  const shadeGeo = geometries.get('lamp_shade_geo', () => new THREE.CylinderGeometry(0.1, 0.14, 0.16, 16, 1, true));
  const shadeMat = materials.get('lamp_shade_mat', {
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.45,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.set(0, 0.78, 0);
  group.add(shade);

  const lampLight = new THREE.PointLight(0xffeedd, 0.7, 2.8);
  lampLight.position.set(0, 0.8, 0);
  group.add(lampLight);

  applyShadows(group);
  return group;
}

export function createSofaCornerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sofa_Corner';

  const fabMat = materials.get('sofa_fabric_charcoal', {
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Base plinth frame (1.0m x 0.15m x 1.0m)
  const baseGeo = geometries.get('sofa_corner_base', () => new THREE.BoxGeometry(1.0, 0.15, 1.0));
  const woodFootMat = materials.get('sofa_foot_wood', { color: 0x1c1917, roughness: 0.7 });
  const base = new THREE.Mesh(baseGeo, woodFootMat);
  base.position.set(0, 0.075, 0);
  group.add(base);

  // Seat cushion (0.75m x 0.28m x 0.75m)
  const seatGeo = geometries.get('sofa_corner_seat', () => new THREE.BoxGeometry(0.75, 0.28, 0.75));
  const seat = new THREE.Mesh(seatGeo, fabMat);
  seat.position.set(-0.125, 0.29, -0.125);
  group.add(seat);

  // Backrest along +Z (1.0m x 0.48m x 0.25m)
  const backZGeo = geometries.get('sofa_back_z', () => new THREE.BoxGeometry(1.0, 0.48, 0.25));
  const backZ = new THREE.Mesh(backZGeo, fabMat);
  backZ.position.set(0, 0.47, 0.375);
  group.add(backZ);

  // Backrest along +X (0.25m x 0.48m x 0.75m)
  const backXGeo = geometries.get('sofa_back_x', () => new THREE.BoxGeometry(0.25, 0.48, 0.75));
  const backX = new THREE.Mesh(backXGeo, fabMat);
  backX.position.set(0.375, 0.47, -0.125);
  group.add(backX);

  // Throw pillow in the corner
  const pillowGeo = geometries.get('sofa_pillow_geo', () => new THREE.BoxGeometry(0.28, 0.28, 0.12));
  const pillowMat = materials.get('sofa_pillow_coral', {
    color: 0xf97316,
    roughness: 0.8,
  });
  const pillow = new THREE.Mesh(pillowGeo, pillowMat);
  pillow.position.set(0.22, 0.48, 0.22);
  pillow.rotation.y = Math.PI / 4;
  group.add(pillow);

  applyShadows(group);
  return group;
}

export function createSofaStraightMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sofa_Straight';

  const fabMat = materials.get('sofa_fabric_charcoal', {
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.05,
  });
  const woodFootMat = materials.get('sofa_foot_wood', { color: 0x1c1917, roughness: 0.7 });

  // Base plinth frame (1.0m x 0.15m x 0.85m)
  const baseGeo = geometries.get('sofa_straight_base', () => new THREE.BoxGeometry(1.0, 0.15, 0.85));
  const base = new THREE.Mesh(baseGeo, woodFootMat);
  base.position.set(0, 0.075, 0);
  group.add(base);

  // Seat cushion (1.0m x 0.28m x 0.6m)
  const seatGeo = geometries.get('sofa_straight_seat', () => new THREE.BoxGeometry(1.0, 0.28, 0.6));
  const seat = new THREE.Mesh(seatGeo, fabMat);
  seat.position.set(0, 0.29, -0.125);
  group.add(seat);

  // Backrest along +Z (1.0m x 0.48m x 0.25m)
  const backGeo = geometries.get('sofa_back_z', () => new THREE.BoxGeometry(1.0, 0.48, 0.25));
  const back = new THREE.Mesh(backGeo, fabMat);
  back.position.set(0, 0.47, 0.3);
  group.add(back);

  applyShadows(group);
  return group;
}

export function createSofaChaiseMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sofa_Chaise';

  const fabMat = materials.get('sofa_fabric_charcoal', {
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.05,
  });
  const woodFootMat = materials.get('sofa_foot_wood', { color: 0x1c1917, roughness: 0.7 });

  // Base plinth (0.9m x 0.15m x 1.5m)
  const baseGeo = geometries.get('sofa_chaise_base', () => new THREE.BoxGeometry(0.9, 0.15, 1.5));
  const base = new THREE.Mesh(baseGeo, woodFootMat);
  base.position.set(0, 0.075, 0);
  group.add(base);

  // Long seat cushion (0.9m x 0.28m x 1.25m)
  const seatGeo = geometries.get('sofa_chaise_seat', () => new THREE.BoxGeometry(0.9, 0.28, 1.25));
  const seat = new THREE.Mesh(seatGeo, fabMat);
  seat.position.set(0, 0.29, -0.125);
  group.add(seat);

  // Backrest at +Z end (0.9m x 0.48m x 0.25m)
  const backGeo = geometries.get('sofa_chaise_back', () => new THREE.BoxGeometry(0.9, 0.48, 0.25));
  const back = new THREE.Mesh(backGeo, fabMat);
  back.position.set(0, 0.47, 0.625);
  group.add(back);

  // Side armrest along +X (0.2m x 0.35m x 1.0m)
  const armGeo = geometries.get('sofa_chaise_arm', () => new THREE.BoxGeometry(0.2, 0.35, 1.0));
  const arm = new THREE.Mesh(armGeo, fabMat);
  arm.position.set(0.35, 0.4, 0.15);
  group.add(arm);

  applyShadows(group);
  return group;
}

export function createKitchenCounterSinkMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Kitchen_Counter_Sink';

  const cabMat = materials.get('kitchen_cabinet_white', {
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.05,
  });
  const counterTopMat = materials.get('kitchen_countertop_quartz', {
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.1,
  });

  // Base cabinet (1.0m x 0.85m x 0.65m)
  const baseGeo = geometries.get('kitchen_base_cabinet', () => new THREE.BoxGeometry(1.0, 0.85, 0.65));
  const base = new THREE.Mesh(baseGeo, cabMat);
  base.position.set(0, 0.425, 0);
  group.add(base);

  // Countertop slab (1.0m x 0.05m x 0.68m)
  const topGeo = geometries.get('kitchen_counter_top', () => new THREE.BoxGeometry(1.0, 0.05, 0.68));
  const top = new THREE.Mesh(topGeo, counterTopMat);
  top.position.set(0, 0.875, 0.01);
  group.add(top);

  // Stainless steel sink basin cutout
  const sinkGeo = geometries.get('kitchen_sink_basin', () => new THREE.BoxGeometry(0.55, 0.02, 0.42));
  const steelMat = materials.get('kitchen_steel_mat', {
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });
  const sink = new THREE.Mesh(sinkGeo, steelMat);
  sink.position.set(0, 0.902, 0.02);
  group.add(sink);

  // Chrome gooseneck faucet
  const faucetBaseGeo = geometries.get('faucet_base_geo', () => new THREE.CylinderGeometry(0.02, 0.025, 0.08, 12));
  const faucetBase = new THREE.Mesh(faucetBaseGeo, steelMat);
  faucetBase.position.set(0, 0.94, -0.16);
  group.add(faucetBase);

  const faucetSpoutGeo = geometries.get('faucet_spout_geo', () => new THREE.TorusGeometry(0.09, 0.015, 8, 16, Math.PI));
  const faucetSpout = new THREE.Mesh(faucetSpoutGeo, steelMat);
  faucetSpout.position.set(0, 1.05, -0.16);
  faucetSpout.rotation.z = Math.PI / 2;
  faucetSpout.rotation.y = -Math.PI / 2;
  group.add(faucetSpout);

  applyShadows(group);
  return group;
}

export function createKitchenCounterStoveMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Kitchen_Counter_Stove';

  const cabMat = materials.get('kitchen_cabinet_white', {
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.05,
  });
  const counterTopMat = materials.get('kitchen_countertop_quartz', {
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.1,
  });

  // Base cabinet
  const baseGeo = geometries.get('kitchen_base_cabinet', () => new THREE.BoxGeometry(1.0, 0.85, 0.65));
  const base = new THREE.Mesh(baseGeo, cabMat);
  base.position.set(0, 0.425, 0);
  group.add(base);

  // Countertop slab
  const topGeo = geometries.get('kitchen_counter_top', () => new THREE.BoxGeometry(1.0, 0.05, 0.68));
  const top = new THREE.Mesh(topGeo, counterTopMat);
  top.position.set(0, 0.875, 0.01);
  group.add(top);

  // Glass-ceramic induction cooktop
  const hobGeo = geometries.get('kitchen_induction_hob', () => new THREE.BoxGeometry(0.65, 0.012, 0.52));
  const hobMat = materials.get('kitchen_hob_mat', {
    color: 0x09090b,
    roughness: 0.1,
    metalness: 0.8,
  });
  const hob = new THREE.Mesh(hobGeo, hobMat);
  hob.position.set(0, 0.905, 0.02);
  group.add(hob);

  // 4 red indicator cooking rings
  const ringGeo = geometries.get('kitchen_hob_ring', () => new THREE.RingGeometry(0.06, 0.08, 16));
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = materials.get('kitchen_ring_mat', {
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const ringPositions = [
    [-0.18, 0.912, -0.1],
    [0.18, 0.912, -0.1],
    [-0.18, 0.912, 0.14],
    [0.18, 0.912, 0.14],
  ];
  ringPositions.forEach(([rx, ry, rz]) => {
    const rMesh = new THREE.Mesh(ringGeo, ringMat);
    rMesh.position.set(rx, ry, rz);
    group.add(rMesh);
  });

  // Front oven door with smoked glass & handle
  const ovenDoorGeo = geometries.get('kitchen_oven_door', () => new THREE.BoxGeometry(0.64, 0.55, 0.02));
  const ovenDoorMat = materials.get('kitchen_oven_door_mat', {
    color: 0x18181b,
    roughness: 0.2,
    metalness: 0.6,
  });
  const ovenDoor = new THREE.Mesh(ovenDoorGeo, ovenDoorMat);
  ovenDoor.position.set(0, 0.42, 0.33);
  group.add(ovenDoor);

  const ovenHandleGeo = geometries.get('kitchen_oven_handle', () => new THREE.BoxGeometry(0.48, 0.03, 0.04));
  const steelMat = materials.get('kitchen_steel_mat', {
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });
  const ovenHandle = new THREE.Mesh(ovenHandleGeo, steelMat);
  ovenHandle.position.set(0, 0.64, 0.36);
  group.add(ovenHandle);

  applyShadows(group);
  return group;
}

export function createKitchenCounterStraightMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Kitchen_Counter_Straight';

  const cabMat = materials.get('kitchen_cabinet_white', {
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.05,
  });
  const counterTopMat = materials.get('kitchen_countertop_quartz', {
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.1,
  });

  // Base cabinet
  const baseGeo = geometries.get('kitchen_base_cabinet', () => new THREE.BoxGeometry(1.0, 0.85, 0.65));
  const base = new THREE.Mesh(baseGeo, cabMat);
  base.position.set(0, 0.425, 0);
  group.add(base);

  // Countertop
  const topGeo = geometries.get('kitchen_counter_top', () => new THREE.BoxGeometry(1.0, 0.05, 0.68));
  const top = new THREE.Mesh(topGeo, counterTopMat);
  top.position.set(0, 0.875, 0.01);
  group.add(top);

  // 2 under-counter drawers
  const drawerGeo = geometries.get('kitchen_straight_drawer', () => new THREE.BoxGeometry(0.92, 0.35, 0.02));
  const handleGeo = geometries.get('kitchen_straight_handle', () => new THREE.BoxGeometry(0.32, 0.02, 0.02));
  const steelMat = materials.get('kitchen_steel_mat', {
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });

  for (let i = 0; i < 2; i++) {
    const dy = 0.24 + i * 0.4;
    const drawer = new THREE.Mesh(drawerGeo, cabMat);
    drawer.position.set(0, dy, 0.33);
    group.add(drawer);

    const handle = new THREE.Mesh(handleGeo, steelMat);
    handle.position.set(0, dy + 0.1, 0.35);
    group.add(handle);
  }

  applyShadows(group);
  return group;
}

export function createKitchenUpperCabinetMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Kitchen_Upper_Cabinet';

  const cabMat = materials.get('kitchen_cabinet_white', {
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.05,
  });

  // Upper cabinet box mounted at Y = 2.35m (height 0.7m, walk-under clearance 2.0m)
  const bodyGeo = geometries.get('kitchen_upper_cab_body', () => new THREE.BoxGeometry(1.0, 0.7, 0.35));
  const body = new THREE.Mesh(bodyGeo, cabMat);
  body.position.set(0, 2.35, -0.15);
  group.add(body);

  // 2 cabinet doors
  const doorGeo = geometries.get('kitchen_upper_cab_door', () => new THREE.BoxGeometry(0.48, 0.66, 0.02));
  for (const dx of [-0.245, 0.245]) {
    const door = new THREE.Mesh(doorGeo, cabMat);
    door.position.set(dx, 2.35, 0.03);
    group.add(door);
  }

  // Under-cabinet LED downlight strip
  const ledGeo = geometries.get('kitchen_under_led', () => new THREE.BoxGeometry(0.85, 0.015, 0.05));
  const ledMat = materials.get('kitchen_under_led_mat', {
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 1.99, -0.15);
  group.add(led);

  const downLight = new THREE.PointLight(0xfff7ed, 0.5, 2.2);
  downLight.position.set(0, 1.95, -0.15);
  group.add(downLight);

  applyShadows(group);
  return group;
}

export function createPottedMonsteraMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Potted_Monstera';

  // Ceramic white cylindrical pot
  const potGeo = geometries.get('monstera_pot_geo', () => new THREE.CylinderGeometry(0.24, 0.18, 0.48, 16));
  const potMat = materials.get('pot_ceramic_white', {
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.05,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.set(0, 0.24, 0);
  group.add(pot);

  // Soil disk
  const soilGeo = geometries.get('pot_soil_geo', () => new THREE.CylinderGeometry(0.23, 0.23, 0.02, 16));
  const soilMat = materials.get('pot_soil_mat', { color: 0x3e2723, roughness: 0.95 });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.set(0, 0.47, 0);
  group.add(soil);

  // Central stem
  const stemMat = materials.get('plant_stem_mat', { color: 0x2e7d32, roughness: 0.8 });
  const stemGeo = geometries.get('monstera_stem_geo', () => new THREE.CylinderGeometry(0.018, 0.024, 0.65, 8));
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.set(0, 0.75, 0);
  group.add(stem);

  // 6 large arching Monstera leaves (emerald green)
  const leafMat = materials.get('monstera_leaf_mat', {
    color: 0x15803d,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const leafGeo = geometries.get('monstera_leaf_geo', () => {
    const geo = new THREE.PlaneGeometry(0.38, 0.52);
    geo.translate(0, 0.26, 0);
    return geo;
  });

  const leafAngles = [0, 1.05, 2.1, 3.14, 4.2, 5.25];
  leafAngles.forEach((angle, i) => {
    const leafGroup = new THREE.Group();
    leafGroup.position.set(0, 0.7 + (i % 3) * 0.15, 0);
    leafGroup.rotation.y = angle;

    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.rotation.x = 0.55 + (i % 2) * 0.25;
    leafMesh.scale.set(0.9 + (i % 3) * 0.15, 0.9 + (i % 3) * 0.15, 1);
    leafGroup.add(leafMesh);

    group.add(leafGroup);
  });

  applyShadows(group);
  return group;
}

export function createPottedFicusMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Potted_Ficus';

  // Terracotta pot
  const potGeo = geometries.get('ficus_pot_geo', () => new THREE.CylinderGeometry(0.25, 0.19, 0.52, 16));
  const potMat = materials.get('pot_terracotta', {
    color: 0xc2410c,
    roughness: 0.85,
    metalness: 0.05,
  });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.set(0, 0.26, 0);
  group.add(pot);

  // Soil
  const soilGeo = geometries.get('pot_soil_geo', () => new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16));
  const soilMat = materials.get('pot_soil_mat', { color: 0x3e2723, roughness: 0.95 });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.set(0, 0.51, 0);
  group.add(soil);

  // Tall slender trunk
  const trunkMat = materials.get('ficus_trunk_mat', { color: 0x78350f, roughness: 0.9 });
  const trunkGeo = geometries.get('ficus_trunk_geo', () => new THREE.CylinderGeometry(0.025, 0.035, 1.1, 8));
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(0, 1.05, 0);
  group.add(trunk);

  // Upright Fiddle Leaf Fig leaves (deep forest green)
  const leafMat = materials.get('ficus_leaf_mat', {
    color: 0x166534,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const leafGeo = geometries.get('ficus_leaf_geo', () => {
    const geo = new THREE.PlaneGeometry(0.28, 0.42);
    geo.translate(0, 0.21, 0);
    return geo;
  });

  for (let i = 0; i < 8; i++) {
    const leafGroup = new THREE.Group();
    leafGroup.position.set(0, 0.85 + i * 0.1, 0);
    leafGroup.rotation.y = i * 1.25;

    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.rotation.x = 0.4;
    leafGroup.add(leafMesh);

    group.add(leafGroup);
  }

  applyShadows(group);
  return group;
}

// ============================================================================
// Grocery Store & Urban Retail Assets
// ============================================================================

export function createGroceryMeatDisplayMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Grocery_Meat_Display';

  // Base stainless steel cabinet (1.6m x 0.55m x 0.85m)
  const baseGeo = geometries.get('meat_display_base', () => new THREE.BoxGeometry(1.6, 0.55, 0.85));
  const steelMat = materials.get('meat_display_steel', {
    color: 0x64748b,
    roughness: 0.3,
    metalness: 0.8,
  });
  const base = new THREE.Mesh(baseGeo, steelMat);
  base.position.set(0, 0.275, 0);
  group.add(base);

  // Black display tray tiers
  const trayGeo = geometries.get('meat_display_tray', () => new THREE.BoxGeometry(1.52, 0.04, 0.75));
  const trayMat = materials.get('meat_display_tray_mat', { color: 0x0f172a, roughness: 0.5 });
  const tray = new THREE.Mesh(trayGeo, trayMat);
  tray.position.set(0, 0.57, 0);
  group.add(tray);

  // Jamón & cheese wheels
  const meatMat = materials.get('meat_jamon_mat', { color: 0x991b1b, roughness: 0.6 });
  const cheeseMat = materials.get('cheese_idiazabal_mat', { color: 0xfde047, roughness: 0.7 });
  const roastGeo = geometries.get('meat_roast_geo', () => {
    const g = new THREE.CylinderGeometry(0.08, 0.09, 0.35, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const cheeseGeo = geometries.get('cheese_wheel_geo', () => new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12));

  for (let i = -2; i <= 2; i++) {
    if (i % 2 === 0) {
      const meat = new THREE.Mesh(roastGeo, meatMat);
      meat.position.set(i * 0.3, 0.66, i % 2 === 0 ? -0.1 : 0.1);
      group.add(meat);
    } else {
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set(i * 0.3, 0.63, 0);
      group.add(cheese);
    }
  }

  // Curved transparent glass display case cover
  const glassGeo = geometries.get('meat_display_glass', () => new THREE.BoxGeometry(1.56, 0.45, 0.82));
  const glassMat = materials.get('meat_display_glass_mat', {
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.2,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 0.8, 0);
  group.add(glass);

  // Internal LED cold illumination
  const led = new THREE.PointLight(0xe0f2fe, 0.5, 2.2);
  led.position.set(0, 0.95, 0);
  group.add(led);

  applyShadows(group);
  return group;
}

export function createGroceryVegStandMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Grocery_Veg_Stand';

  const pineMat = materials.get('veg_stand_pine', {
    color: 0xb45309,
    roughness: 0.8,
    metalness: 0.05,
  });

  // 4 corner support posts
  const postGeo = geometries.get('veg_stand_post', () => new THREE.BoxGeometry(0.06, 0.95, 0.06));
  for (const [px, pz] of [[-0.56, -0.35], [0.56, -0.35], [-0.56, 0.35], [0.56, 0.35]]) {
    const post = new THREE.Mesh(postGeo, pineMat);
    post.position.set(px, 0.475, pz);
    group.add(post);
  }

  // Lower crate tier
  const crateGeo = geometries.get('veg_stand_crate', () => new THREE.BoxGeometry(1.16, 0.16, 0.72));
  const crateLower = new THREE.Mesh(crateGeo, pineMat);
  crateLower.position.set(0, 0.38, 0);
  group.add(crateLower);

  // Upper tilted crate tier
  const crateUpper = new THREE.Mesh(crateGeo, pineMat);
  crateUpper.position.set(0, 0.78, 0);
  crateUpper.rotation.x = 0.22;
  group.add(crateUpper);

  // Colorful produce
  const produceGeo = geometries.get('veg_produce_sphere', () => new THREE.SphereGeometry(0.08, 8, 8));
  const redMat = materials.get('produce_tomato', { color: 0xef4444, roughness: 0.4 });
  const greenMat = materials.get('produce_lettuce', { color: 0x22c55e, roughness: 0.7 });
  const orangeMat = materials.get('produce_orange', { color: 0xf97316, roughness: 0.5 });
  const purpleMat = materials.get('produce_eggplant', { color: 0x581c87, roughness: 0.4 });

  const produceItems = [
    { x: -0.4, y: 0.86, z: 0.05, mat: redMat },
    { x: -0.15, y: 0.86, z: 0.05, mat: orangeMat },
    { x: 0.15, y: 0.86, z: 0.05, mat: greenMat },
    { x: 0.4, y: 0.86, z: 0.05, mat: purpleMat },
    { x: -0.3, y: 0.46, z: 0, mat: greenMat },
    { x: 0.0, y: 0.46, z: 0, mat: redMat },
    { x: 0.3, y: 0.46, z: 0, mat: orangeMat },
  ];

  produceItems.forEach((p) => {
    for (let ox = -0.05; ox <= 0.05; ox += 0.05) {
      const prod = new THREE.Mesh(produceGeo, p.mat);
      prod.position.set(p.x + ox, p.y, p.z);
      group.add(prod);
    }
  });

  applyShadows(group);
  return group;
}

export function createGroceryDrinkFridgeMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Grocery_Drink_Fridge';

  const bodyMat = materials.get('fridge_body_mat', {
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.7,
  });

  // Tall cabinet body (1.0m x 2.0m x 0.75m)
  const bodyGeo = geometries.get('fridge_body_geo', () => new THREE.BoxGeometry(1.0, 2.0, 0.75));
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 1.0, 0);
  group.add(body);

  // Top illuminated marquee banner ("BEBIDAS")
  const bannerGeo = geometries.get('fridge_banner_geo', () => new THREE.BoxGeometry(0.92, 0.22, 0.02));
  const bannerMat = materials.get('fridge_banner_mat', {
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.2,
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 1.84, 0.385);
  group.add(banner);

  // Glass display door (0.92m x 1.48m x 0.02m)
  const glassGeo = geometries.get('fridge_glass_door', () => new THREE.BoxGeometry(0.92, 1.48, 0.02));
  const glassMat = materials.get('fridge_glass_mat', {
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 0.94, 0.385);
  group.add(glass);

  // Door handle
  const handleGeo = geometries.get('fridge_handle', () => new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8));
  const handleMat = materials.get('fridge_handle_mat', { color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0.38, 0.94, 0.41);
  group.add(handle);

  // 4 lit shelves with colorful rows of soda cans
  const shelfGeo = geometries.get('fridge_shelf', () => new THREE.BoxGeometry(0.88, 0.02, 0.6));
  const canGeo = geometries.get('fridge_can_geo', () => new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8));
  const canColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b];

  for (let s = 0; s < 4; s++) {
    const sy = 0.4 + s * 0.35;
    const shelf = new THREE.Mesh(shelfGeo, bodyMat);
    shelf.position.set(0, sy, 0.05);
    group.add(shelf);

    for (let c = -3; c <= 3; c++) {
      const col = canColors[Math.abs(c + s) % canColors.length];
      const cMat = materials.get(`fridge_can_${col}`, { color: col, roughness: 0.3, metalness: 0.7 });
      const can = new THREE.Mesh(canGeo, cMat);
      can.position.set(c * 0.12, sy + 0.07, 0.15);
      group.add(can);
    }
  }

  // Internal cool light
  const internalLight = new THREE.PointLight(0xe0f2fe, 0.8, 2.6);
  internalLight.position.set(0, 1.3, 0.2);
  group.add(internalLight);

  applyShadows(group);
  return group;
}

export function createStoreCheckoutDeskMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Store_Checkout_Desk';

  const cabMat = materials.get('checkout_cab_mat', {
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.1,
  });

  // Base counter block (1.6m x 0.85m x 0.9m)
  const baseGeo = geometries.get('checkout_base', () => new THREE.BoxGeometry(1.6, 0.85, 0.9));
  const base = new THREE.Mesh(baseGeo, cabMat);
  base.position.set(0, 0.425, 0);
  group.add(base);

  // Black conveyor belt
  const beltGeo = geometries.get('checkout_belt', () => new THREE.BoxGeometry(1.0, 0.02, 0.45));
  const beltMat = materials.get('checkout_belt_mat', { color: 0x18181b, roughness: 0.9 });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.set(-0.25, 0.86, 0.15);
  group.add(belt);

  // Barcode scanner glass window
  const scanGeo = geometries.get('checkout_scanner', () => new THREE.BoxGeometry(0.18, 0.01, 0.18));
  const scanMat = materials.get('checkout_scanner_mat', {
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
  });
  const scanner = new THREE.Mesh(scanGeo, scanMat);
  scanner.position.set(0.35, 0.865, 0.15);
  group.add(scanner);

  // Swivel pole & POS card payment terminal
  const poleGeo = geometries.get('checkout_pos_pole', () => new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8));
  const poleMat = materials.get('checkout_pos_pole_mat', { color: 0x64748b, metalness: 0.8 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0.48, 0.98, -0.2);
  group.add(pole);

  const posGeo = geometries.get('checkout_pos_terminal', () => new THREE.BoxGeometry(0.12, 0.04, 0.18));
  const posMat = materials.get('checkout_pos_mat', { color: 0x0f172a, roughness: 0.4 });
  const pos = new THREE.Mesh(posGeo, posMat);
  pos.position.set(0.48, 1.1, -0.2);
  pos.rotation.x = -0.35;
  group.add(pos);

  // Transparent acrylic sneeze shield
  const shieldGeo = geometries.get('checkout_shield', () => new THREE.BoxGeometry(1.4, 0.6, 0.015));
  const shieldMat = materials.get('checkout_shield_mat', {
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.set(0, 1.15, -0.42);
  group.add(shield);

  applyShadows(group);
  return group;
}

// ============================================================================
// Coastal Beach Assets
// ============================================================================

export function createBeachUmbrellaMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Beach_Umbrella';

  // Base weighted disc on sand
  const baseGeo = geometries.get('umbrella_base_disc', () => new THREE.CylinderGeometry(0.25, 0.28, 0.06, 16));
  const baseMat = materials.get('umbrella_base_mat', { color: 0xf8fafc, roughness: 0.6 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(0, 0.03, 0);
  group.add(base);

  // Mast pole tilted at 7 degrees
  const poleGeo = geometries.get('umbrella_pole', () => new THREE.CylinderGeometry(0.024, 0.024, 2.2, 8));
  const poleMat = materials.get('umbrella_pole_mat', { color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
  const poleGroup = new THREE.Group();
  poleGroup.position.set(0, 0.05, 0);
  poleGroup.rotation.z = 0.12;

  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 1.1, 0);
  poleGroup.add(pole);

  // Wide 8-panel conical fabric canopy (radius 1.1m)
  const canopyGeo = geometries.get('umbrella_canopy_geo', () => new THREE.ConeGeometry(1.1, 0.35, 8, 1, true));
  const canopyMat = materials.get('umbrella_canopy_mat', {
    color: 0x06b6d4, // Mediterranean turquoise
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 2.15, 0);
  poleGroup.add(canopy);

  // Alternating white decorative trim
  const trimGeo = geometries.get('umbrella_trim_geo', () => new THREE.ConeGeometry(1.12, 0.06, 8, 1, true));
  const trimMat = materials.get('umbrella_trim_mat', {
    color: 0xf8fafc,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, 2.0, 0);
  poleGroup.add(trim);

  group.add(poleGroup);
  applyShadows(group);
  return group;
}

export function createBeachTowelPropMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Beach_Towel_Prop';

  // Towel fabric base (coral red)
  const towelGeo = geometries.get('beach_towel_prop_base', () => {
    const geo = new THREE.PlaneGeometry(0.8, 1.5);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const towelMat = materials.get('beach_towel_coral_mat', {
    color: 0xf43f5e,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const towel = new THREE.Mesh(towelGeo, towelMat);
  towel.position.y = 0.02;
  group.add(towel);

  // Sunglasses prop on towel
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0.18, 0.035, -0.55);
  glassesGroup.rotation.y = 0.3;

  const glassLensGeo = geometries.get('towel_sunglass_lens', () => new THREE.BoxGeometry(0.07, 0.035, 0.01));
  const lensMat = materials.get('sunglass_lens_mat', { color: 0x09090b, roughness: 0.1, metalness: 0.9 });
  const lensL = new THREE.Mesh(glassLensGeo, lensMat);
  lensL.position.set(-0.045, 0, 0);
  glassesGroup.add(lensL);

  const lensR = new THREE.Mesh(glassLensGeo, lensMat);
  lensR.position.set(0.045, 0, 0);
  glassesGroup.add(lensR);

  group.add(glassesGroup);

  // Sunscreen bottle prop
  const bottleGeo = geometries.get('sunscreen_bottle_geo', () => {
    const g = new THREE.CylinderGeometry(0.025, 0.028, 0.12, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const bottleMat = materials.get('sunscreen_bottle_mat', { color: 0xfbbf24, roughness: 0.4 });
  const bottle = new THREE.Mesh(bottleGeo, bottleMat);
  bottle.position.set(-0.22, 0.035, -0.55);
  group.add(bottle);

  applyShadows(group);
  return group;
}

export function createBeachCoolerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Beach_Cooler';

  const bodyMat = materials.get('cooler_body_blue', {
    color: 0x0284c7,
    roughness: 0.4,
    metalness: 0.05,
  });
  const lidMat = materials.get('cooler_lid_white', {
    color: 0xf8fafc,
    roughness: 0.3,
    metalness: 0.05,
  });

  // Cooler tub body (0.6m x 0.34m x 0.4m)
  const bodyGeo = geometries.get('cooler_tub', () => new THREE.BoxGeometry(0.6, 0.34, 0.4));
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.17, 0);
  group.add(body);

  // Insulated lid with lip (0.62m x 0.08m x 0.42m)
  const lidGeo = geometries.get('cooler_lid', () => new THREE.BoxGeometry(0.62, 0.08, 0.42));
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.set(0, 0.38, 0);
  group.add(lid);

  // Molded cup holders on lid
  const cupGeo = geometries.get('cooler_cup_indent', () => new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12));
  for (const cx of [-0.15, 0.15]) {
    const cup = new THREE.Mesh(cupGeo, bodyMat);
    cup.position.set(cx, 0.421, 0);
    group.add(cup);
  }

  // Side carry handles
  const handleGeo = geometries.get('cooler_side_handle', () => new THREE.BoxGeometry(0.04, 0.12, 0.18));
  for (const hx of [-0.31, 0.31]) {
    const handle = new THREE.Mesh(handleGeo, lidMat);
    handle.position.set(hx, 0.24, 0);
    group.add(handle);
  }

  applyShadows(group);
  return group;
}

export function createCoastalCliffBushMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Coastal_Cliff_Bush';

  // Smooth weathered beach pebble cluster at base
  const pebbleMat = materials.get('coastal_pebble_mat', { color: 0x78716c, roughness: 0.85 });
  const pebbleGeo = geometries.get('coastal_pebble_geo', () => new THREE.DodecahedronGeometry(0.18, 1));
  const pebbleOffsets = [
    [-0.25, 0.08, -0.2],
    [0.22, 0.09, 0.22],
    [-0.18, 0.07, 0.25],
    [0.26, 0.08, -0.18],
  ];
  pebbleOffsets.forEach(([px, py, pz]) => {
    const pebble = new THREE.Mesh(pebbleGeo, pebbleMat);
    pebble.position.set(px, py, pz);
    pebble.scale.set(1.2, 0.6, 1.0);
    group.add(pebble);
  });

  // Dense coastal scrub bush (hardy olive-green)
  const bushGeo = geometries.get('coastal_bush_geo', () => new THREE.DodecahedronGeometry(0.42, 1));
  const bushMat = materials.get('coastal_bush_mat', {
    color: 0x3f6212,
    roughness: 0.9,
  });
  const bush1 = new THREE.Mesh(bushGeo, bushMat);
  bush1.position.set(0, 0.36, 0);
  bush1.scale.set(1.1, 0.85, 1.0);
  group.add(bush1);

  const bush2 = new THREE.Mesh(bushGeo, bushMat);
  bush2.position.set(0.18, 0.32, -0.15);
  bush2.scale.set(0.8, 0.75, 0.85);
  group.add(bush2);

  // Wild dune sea grass stalks (golden wheat tone)
  const grassMat = materials.get('coastal_grass_mat', {
    color: 0xd97706,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const stalkGeo = geometries.get('coastal_stalk_geo', () => {
    const geo = new THREE.PlaneGeometry(0.08, 0.55);
    geo.translate(0, 0.275, 0);
    return geo;
  });

  for (let i = 0; i < 6; i++) {
    const stalk = new THREE.Mesh(stalkGeo, grassMat);
    const angle = i * 1.05;
    stalk.position.set(Math.cos(angle) * 0.28, 0.15, Math.sin(angle) * 0.28);
    stalk.rotation.y = angle;
    stalk.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(stalk);
  }

  applyShadows(group);
  return group;
}

// ============================================================================
// ETXEBARRIA PARK & HILLSIDE ASSETS
// ============================================================================

export function createConcreteRetainingWallMesh(rotation?: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ConcreteRetainingWall';

  const concreteMat = materials.get('concrete_retaining_wall_mat', {
    color: 0x8a929a,
    roughness: 0.9,
    metalness: 0.05,
  });

  const copingMat = materials.get('concrete_coping_mat', {
    color: 0x9ca3af,
    roughness: 0.82,
    metalness: 0.05,
  });

  // Main 1.8m height retaining wall slab
  const wallGeo = geometries.get('concrete_retaining_wall_geo', () => {
    return new THREE.BoxGeometry(GRID_CELL_SIZE, 1.8, 0.55);
  });
  const wallMesh = new THREE.Mesh(wallGeo, concreteMat);
  wallMesh.position.set(0, 0.9, 0);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // Protruding horizontal coping ledge at top (Y = 1.8m -> 1.94m)
  const copingGeo = geometries.get('concrete_coping_geo', () => {
    return new THREE.BoxGeometry(GRID_CELL_SIZE + 0.04, 0.14, 0.72);
  });
  const copingMesh = new THREE.Mesh(copingGeo, copingMat);
  copingMesh.position.set(0, 1.87, 0);
  copingMesh.castShadow = true;
  copingMesh.receiveShadow = true;
  group.add(copingMesh);

  // Drainage weep hole details near base
  const weepMat = new THREE.MeshBasicMaterial({ color: 0x374151 });
  const weepGeo = geometries.get('concrete_weep_geo', () => {
    return new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8);
  });
  for (const wx of [-0.6, 0.6]) {
    const weep = new THREE.Mesh(weepGeo, weepMat);
    weep.rotation.x = Math.PI / 2;
    weep.position.set(wx, 0.25, 0.28);
    group.add(weep);
  }

  if (rotation !== undefined) {
    group.rotation.y = rotation * (Math.PI / 180);
  }

  applyShadows(group);
  return group;
}

export function createSoccerPitchTurfMesh(rotation?: number): THREE.Mesh {
  let canvasTex: THREE.Texture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e5e3a';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#227246';
      for (let i = 0; i < 60; i++) {
        const rx = Math.random() * 128;
        const ry = Math.random() * 128;
        ctx.fillRect(rx, ry, 2, 4);
      }
      canvasTex = new THREE.CanvasTexture(canvas);
      canvasTex.wrapS = THREE.RepeatWrapping;
      canvasTex.wrapT = THREE.RepeatWrapping;
    }
  }

  const turfMat = materials.get('soccer_pitch_turf_mat', {
    color: 0x22c55e,
    map: canvasTex,
    roughness: 0.94,
    metalness: 0.0,
  });

  const turfGeo = geometries.get('soccer_pitch_turf_geo', () => {
    const geo = new THREE.BoxGeometry(GRID_CELL_SIZE, 0.15, GRID_CELL_SIZE);
    geo.translate(0, 0.075, 0);
    return geo;
  });

  const mesh = new THREE.Mesh(turfGeo, turfMat);
  mesh.name = 'SoccerPitchTurf';
  mesh.receiveShadow = true;

  if (rotation !== undefined) {
    mesh.rotation.y = rotation * (Math.PI / 180);
  }

  return mesh;
}

export function createSoccerFloodlightMesh(rotation?: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SoccerFloodlight';

  const mastMat = materials.get('soccer_mast_mat', {
    color: 0x475569,
    roughness: 0.45,
    metalness: 0.85,
  });

  const concreteMat = materials.get('soccer_base_mat', {
    color: 0x64748b,
    roughness: 0.9,
    metalness: 0.05,
  });

  const lampMat = materials.get('soccer_lamp_lens_mat', {
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 2.2,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Base concrete pedestal
  const baseGeo = geometries.get('soccer_base_geo', () => {
    return new THREE.BoxGeometry(0.55, 0.4, 0.55);
  });
  const baseMesh = new THREE.Mesh(baseGeo, concreteMat);
  baseMesh.position.set(0, 0.2, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Tall metal mast (7.0m)
  const mastGeo = geometries.get('soccer_mast_geo', () => {
    const geo = new THREE.CylinderGeometry(0.1, 0.2, 6.6, 8);
    geo.translate(0, 3.5, 0);
    return geo;
  });
  const mastMesh = new THREE.Mesh(mastGeo, mastMat);
  mastMesh.castShadow = true;
  group.add(mastMesh);

  // Crossbar head bracket at top
  const crossbarGeo = geometries.get('soccer_crossbar_geo', () => {
    return new THREE.BoxGeometry(1.6, 0.12, 0.2);
  });
  const crossbar = new THREE.Mesh(crossbarGeo, mastMat);
  crossbar.position.set(0, 6.8, 0);
  crossbar.castShadow = true;
  group.add(crossbar);

  // 4 angled floodlight fixtures
  const fixtureGeo = geometries.get('soccer_fixture_geo', () => {
    return new THREE.BoxGeometry(0.32, 0.22, 0.25);
  });
  const fixturePositions = [-0.6, -0.2, 0.2, 0.6];
  for (const fx of fixturePositions) {
    const fixture = new THREE.Mesh(fixtureGeo, mastMat);
    fixture.position.set(fx, 6.85, 0.15);
    fixture.rotation.x = 0.55; // Angled downwards toward field
    fixture.castShadow = true;
    group.add(fixture);

    // Emissive front lens
    const lensGeo = geometries.get('soccer_lens_geo', () => {
      return new THREE.PlaneGeometry(0.28, 0.18);
    });
    const lens = new THREE.Mesh(lensGeo, lampMat);
    lens.position.set(0, 0, 0.13);
    fixture.add(lens);
  }

  // Realistic sports floodlight light
  const light = new THREE.PointLight(0xfef9c3, 3.5, 18.0);
  light.position.set(0, 6.8, 0.5);
  group.add(light);

  // Radiating Psychedelic Trip Halo (activates in trip mode!)
  const haloGeo = geometries.get('floodlight_trip_halo_geo', () => {
    return new THREE.SphereGeometry(0.65, 16, 16);
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.name = 'TripFloodlightHalo';
  halo.position.set(0, 6.85, 0.2);
  halo.userData.isTripHalo = true;
  group.add(halo);

  // Downward radiating beam rays (matching the user's hand-drawn lines on scenery.png!)
  const raysGroup = new THREE.Group();
  raysGroup.name = 'TripBeamRays';
  raysGroup.visible = false;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const rayGeo = geometries.get('floodlight_ray_geo', () => {
    const geo = new THREE.PlaneGeometry(0.08, 6.0);
    geo.translate(0, -3.0, 0);
    return geo;
  });
  for (let r = 0; r < 5; r++) {
    const ray = new THREE.Mesh(rayGeo, beamMat);
    const angle = (r - 2) * 0.12;
    ray.position.set(0, 6.8, 0.2);
    ray.rotation.z = angle;
    ray.rotation.x = 0.35;
    raysGroup.add(ray);
  }
  group.add(raysGroup);

  if (rotation !== undefined) {
    group.rotation.y = rotation * (Math.PI / 180);
  }

  applyShadows(group);
  return group;
}

export function setFloodlightTripGlow(floodlightGroup: THREE.Object3D, tripLevel: number): void {
  const halo = floodlightGroup.getObjectByName('TripFloodlightHalo') as THREE.Mesh | undefined;
  if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
    if (tripLevel > 0.5) {
      const t = (tripLevel - 0.5) / 0.5; // 0.0 to 1.0
      halo.material.opacity = t * 0.85;
      const s = 1.0 + t * 1.5;
      halo.scale.set(s, s, s);
    } else {
      halo.material.opacity = 0;
    }
  }

  const raysGroup = floodlightGroup.getObjectByName('TripBeamRays') as THREE.Group | undefined;
  if (raysGroup) {
    if (tripLevel > 0.5) {
      raysGroup.visible = true;
      const t = (tripLevel - 0.5) / 0.5;
      raysGroup.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial) {
          c.material.opacity = t * 0.75;
        }
      });
    } else {
      raysGroup.visible = false;
    }
  }
}

export function createWallChillSpotMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WallChillSpot';

  // Ambient pulsating circular ground decal
  const ringGeo = geometries.get('wall_chill_ring_geo', () => {
    const geo = new THREE.RingGeometry(0.4, 0.9, 32);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.025;
  group.add(ring);

  // Inner disc
  const discGeo = geometries.get('wall_chill_disc_geo', () => {
    const geo = new THREE.CircleGeometry(0.35, 32);
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = 0.026;
  group.add(disc);

  // Ambient beacon point light
  const light = new THREE.PointLight(0x06b6d4, 1.2, 4.0);
  light.position.set(0, 0.6, 0);
  group.add(light);

  return group;
}

export function createBilbaoPanoramaBackdrop(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BilbaoPanoramaBackdrop';

  // 1. Base Realistic Dusk Skyline Layer (Visible at lower trip < 50%)
  const duskGeo = new THREE.CylinderGeometry(45.5, 45.5, 26, 32, 1, true, Math.PI * 0.65, Math.PI * 0.7);
  let duskTex: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.0, '#0a0d18'); // Deep midnight sky
      grad.addColorStop(0.35, '#1e1b4b'); // Twilight indigo
      grad.addColorStop(0.65, '#4c1d95'); // Purple mountain ridge
      grad.addColorStop(0.82, '#b45309'); // Warm amber horizon
      grad.addColorStop(1.0, '#1c1917'); // Dark city base
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Distant city silhouette & Torre Iberdrola
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      // Central Torre Iberdrola skyscraper silhouette
      ctx.moveTo(480, 512);
      ctx.lineTo(490, 160);
      ctx.lineTo(512, 140); // Tapered spire top
      ctx.lineTo(534, 160);
      ctx.lineTo(544, 512);
      ctx.fill();

      // Surrounding rooftops & hillside
      for (let x = 0; x < 1024; x += 36) {
        const h = 80 + Math.sin(x * 0.05) * 45 + Math.random() * 30;
        ctx.fillRect(x, 512 - h, 34, h);
      }
    }
    duskTex = new THREE.CanvasTexture(canvas);
    duskTex.wrapS = THREE.ClampToEdgeWrapping;
    duskTex.wrapT = THREE.ClampToEdgeWrapping;
  }
  const duskMat = new THREE.MeshBasicMaterial({
    map: duskTex,
    color: duskTex ? 0xffffff : 0x1e1b4b,
    side: THREE.BackSide,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const duskMesh = new THREE.Mesh(duskGeo, duskMat);
  duskMesh.name = 'DuskSkylineLayer';
  duskMesh.position.set(0, 10, 0);
  group.add(duskMesh);

  // 2. Psychedelic Hand-Drawn Scenery Layer (scenery.png - blends in above 50% trip)
  const backdropGeo = new THREE.CylinderGeometry(45, 45, 26, 32, 1, true, Math.PI * 0.65, Math.PI * 0.7);
  const tex = textures.get('/textures/scenery.png');
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  const backdropMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
  backdropMesh.name = 'PsychedelicSceneryLayer';
  backdropMesh.position.set(0, 10, 0);
  group.add(backdropMesh);

  // 3. Floating Neon Capsules in the Sky (matching scenery.png capsules: cyan, magenta, yellow, lavender)
  const capsulesGroup = new THREE.Group();
  capsulesGroup.name = 'FloatingNeonCapsules';
  capsulesGroup.visible = false;

  const capsuleGeo = geometries.get('floating_neon_capsule_geo', () => {
    return new THREE.CapsuleGeometry(0.35, 1.3, 8, 16);
  });
  const capsuleColors = [0x06b6d4, 0xd946ef, 0xfacc15, 0xc084fc, 0x38bdf8, 0xf43f5e];

  for (let i = 0; i < 10; i++) {
    const color = capsuleColors[i % capsuleColors.length];
    const cMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const cMesh = new THREE.Mesh(capsuleGeo, cMat);
    // Disperse across panoramic sky arc
    const angle = Math.PI * 0.75 + (i / 9) * Math.PI * 0.5 + (Math.random() - 0.5) * 0.2;
    const dist = 32 + Math.random() * 6;
    const cx = Math.sin(angle) * dist;
    const cz = Math.cos(angle) * dist;
    const cy = 14 + (i % 3) * 2.8 + (Math.random() - 0.5) * 1.5;

    cMesh.position.set(cx, cy, cz);
    cMesh.rotation.set(0.2, (Math.random() - 0.5) * 0.8, 0.45 + (i % 2 === 0 ? 0.3 : -0.3));
    cMesh.userData = {
      baseY: cy,
      rotSpeedY: 0.4 + Math.random() * 0.6,
      floatSpeed: 1.2 + Math.random() * 0.8,
      seed: Math.random() * 10,
    };
    capsulesGroup.add(cMesh);
  }
  group.add(capsulesGroup);

  return group;
}

export function setPanoramaTripLevel(backdropGroup: THREE.Group, tripLevel: number): void {
  const duskLayer = backdropGroup.getObjectByName('DuskSkylineLayer') as THREE.Mesh | undefined;
  const psychLayer = backdropGroup.getObjectByName('PsychedelicSceneryLayer') as THREE.Mesh | undefined;
  const capsules = backdropGroup.getObjectByName('FloatingNeonCapsules') as THREE.Group | undefined;

  // Keep realistic dusk skyline clear and avoid obscuring drawn scenery
  if (duskLayer && duskLayer.material instanceof THREE.MeshBasicMaterial) {
    duskLayer.material.opacity = 1.0;
  }
  if (psychLayer && psychLayer.material instanceof THREE.MeshBasicMaterial) {
    psychLayer.material.opacity = 0.0;
  }
  if (capsules) {
    capsules.visible = tripLevel > 0.5;
    if (capsules.visible) {
      const t = (tripLevel - 0.5) / 0.5;
      capsules.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshBasicMaterial) {
          c.material.opacity = 0.3 + t * 0.65;
        }
      });
    }
  }
}

export class BlockFactory {
  public static createTileMesh(type: TileType, rotation?: number): THREE.Group | THREE.Mesh | null {
    return createTileMesh(type, rotation);
  }

  public static createMesh(type: TileType, rotation?: number): THREE.Group | THREE.Mesh | null {
    return createTileMesh(type, rotation);
  }

  public static createBlockMesh(type: TileType, rotation?: number): THREE.Group | THREE.Mesh | null {
    return createTileMesh(type, rotation);
  }

  public static clearCache(): void {
    materials.clear();
    geometries.clear();
    textures.clear();
  }
}

export const createMesh = createTileMesh;
export const createBlockMesh = createTileMesh;

import * as THREE from 'three';
import { TileTheme } from './TileTypes.ts';
import { createBilbaoPanoramaBackdrop } from './BlockFactory.ts';

export interface LevelBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export class EnvironmentBackdrop {
  public readonly group: THREE.Group;
  public currentTheme: TileTheme = TileTheme.DOWNTOWN;

  private dirLight?: THREE.DirectionalLight;
  private ambientLight?: THREE.AmbientLight;
  private hemiLight?: THREE.HemisphereLight;
  private sceneRef?: THREE.Scene;
  private waterMesh?: THREE.Mesh;
  private waterGeometry?: THREE.PlaneGeometry;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'EnvironmentBackdrop';
  }

  public extractBounds(input?: any): LevelBounds {
    if (input && typeof input.getBounds === 'function') {
      return input.getBounds();
    }
    if (input && input.centerX !== undefined && input.centerZ !== undefined && input.width !== undefined) {
      return {
        minX: input.minX ?? (input.centerX - input.width / 2),
        maxX: input.maxX ?? (input.centerX + input.width / 2),
        minZ: input.minZ ?? (input.centerZ - (input.depth ?? input.width) / 2),
        maxZ: input.maxZ ?? (input.centerZ + (input.depth ?? input.width) / 2),
        centerX: input.centerX,
        centerZ: input.centerZ,
        width: input.width,
        depth: input.depth ?? input.width,
      };
    }
    const tiles: Array<{ x: number; z: number }> | undefined = input?.tiles;
    if (Array.isArray(tiles) && tiles.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const t of tiles) {
        const wx = t.x * 2.0;
        const wz = t.z * 2.0;
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
    return { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 };
  }

  public setTheme(
    theme: TileTheme,
    scene: THREE.Scene,
    dirLight?: THREE.DirectionalLight,
    ambientLight?: THREE.AmbientLight,
    hemiLight?: THREE.HemisphereLight,
    boundsOrLevel?: any
  ): void {
    this.currentTheme = theme;
    this.sceneRef = scene;
    this.clear();

    const bounds = this.extractBounds(boundsOrLevel);

    if (dirLight) this.dirLight = dirLight;
    if (ambientLight) this.ambientLight = ambientLight;
    if (hemiLight) {
      this.hemiLight = hemiLight;
    } else if (!this.hemiLight) {
      const existingHemi = scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight | undefined;
      if (existingHemi) {
        this.hemiLight = existingHemi;
      } else {
        this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x8b7355, 0.6);
        scene.add(this.hemiLight);
      }
    }

    switch (theme) {
      case TileTheme.DOWNTOWN:
        this.applyOutdoorLighting();
        this.buildDowntown(scene, this.dirLight, this.ambientLight, bounds);
        break;
      case TileTheme.SOPELANA:
        this.applyOutdoorLighting();
        this.buildSopelana(scene, this.dirLight, this.ambientLight, bounds);
        break;
      case TileTheme.METRO:
        this.applyIndoorLighting();
        this.buildMetro(scene, this.dirLight, this.ambientLight, bounds);
        break;
      case TileTheme.APARTMENT:
        this.applyIndoorLighting();
        this.buildApartment(scene, bounds);
        break;
      case TileTheme.PARK:
        this.applyParkLighting();
        this.buildPark(scene, this.dirLight, this.ambientLight, bounds);
        break;
      default:
        this.applyOutdoorLighting();
        this.buildDowntown(scene, this.dirLight, this.ambientLight, bounds);
        break;
    }
  }

  private applyOutdoorLighting(): void {
    if (this.dirLight) {
      this.dirLight.visible = true;
      this.dirLight.color.setHex(0xfffaed);
      this.dirLight.intensity = 1.4;
      this.dirLight.position.set(20, 35, 15);
      this.dirLight.target.position.set(13, 0, 13);
      this.dirLight.castShadow = true;
    }
    if (this.hemiLight) {
      this.hemiLight.visible = true;
      this.hemiLight.color.setHex(0xddeeff);
      this.hemiLight.groundColor.setHex(0x8b7355);
      this.hemiLight.intensity = 0.6;
    }
    if (this.ambientLight) {
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.35;
    }
  }

  private applyIndoorLighting(): void {
    const isMetro = this.currentTheme === TileTheme.METRO;

    if (this.dirLight) {
      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = isMetro ? 0.1 : 0.12;
      this.dirLight.position.set(13, 20, 13);
      this.dirLight.target.position.set(13, 0, 13);
      this.dirLight.castShadow = false;
    }
    if (this.hemiLight) {
      this.hemiLight.visible = true;
      if (isMetro) {
        this.hemiLight.color.setHex(0xf0f6fc);
        this.hemiLight.groundColor.setHex(0x334155);
        this.hemiLight.intensity = 0.55;
      } else {
        this.hemiLight.color.setHex(0xffeedd);
        this.hemiLight.groundColor.setHex(0x5c3d2e);
        this.hemiLight.intensity = 0.5;
      }
    }
    if (this.ambientLight) {
      if (isMetro) {
        // Clean neutral white fluorescent tone (0xf0f6fc) at 0.9 intensity
        this.ambientLight.color.setHex(0xf0f6fc);
        this.ambientLight.intensity = 0.9;
      } else {
        // Warm home incandescent tone (0xffeedd) at 0.85 intensity
        this.ambientLight.color.setHex(0xffeedd);
        this.ambientLight.intensity = 0.85;
      }
    }
  }

  public setSunIntensity(val: number): void {
    if (this.dirLight) {
      this.dirLight.intensity = val;
    }
  }

  public setFixtureIntensity(val: number, scene?: THREE.Scene): void {
    const targetScene = scene || this.sceneRef;
    if (!targetScene) return;

    targetScene.traverse((child) => {
      if (child instanceof THREE.PointLight && child.userData?.isFixtureLight) {
        if (child.userData.baseIntensity === undefined) {
          child.userData.baseIntensity = child.intensity;
        }
        child.intensity = child.userData.baseIntensity * (val / 1.2);
      }
    });
  }

  public clear(): void {
    this.waterMesh = undefined;
    this.waterGeometry = undefined;
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => m.dispose());
        } else if (node.material) {
          node.material.dispose();
        }
      }
    });
  }

  /**
   * TileTheme.DOWNTOWN (Bilbao urban look):
   * - Sky: Warm daylight fog (0xd4e2e8), fog near 35, far 95.
   * - Distant city backdrop: 15-20 low-poly building monoliths.
   * - Iberdrola tower tapered glass monolith in the distance.
   * - Flat asphalt extension plane (scale 220x220, Y = -0.1).
   */
  /**
   * TileTheme.DOWNTOWN (Bilbao urban look):
   * - Sky: Warm daylight fog (0xd4e2e8).
   * - Distant city backdrop: 17 low-poly building monoliths with >= 55m buffer outside level bounds.
   * - Iberdrola tower tapered glass monolith in the distance with >= 65m buffer outside level bounds.
   * - Flat asphalt extension plane dynamically scaled.
   */
  private buildDowntown(
    scene: THREE.Scene,
    dirLight?: THREE.DirectionalLight,
    ambientLight?: THREE.AmbientLight,
    bounds: LevelBounds = { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 }
  ): void {
    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;
    const halfW = bounds.width * 0.5;
    const halfD = bounds.depth * 0.5;
    const buffer = 55;

    // 1. Sky & Fog
    scene.background = new THREE.Color(0xd4e2e8);
    const fogNear = Math.max(45, Math.min(halfW, halfD) + 30);
    const fogFar = Math.max(halfW, halfD) + buffer + 160;
    scene.fog = new THREE.Fog(0xd4e2e8, fogNear, fogFar);

    // 2. Lighting tuning
    if (ambientLight) {
      ambientLight.color.setHex(0xffffff);
      ambientLight.intensity = 0.8;
    }
    if (dirLight) {
      dirLight.color.setHex(0xfffaed);
      dirLight.intensity = 1.35;
      dirLight.target.position.set(centerX, 0, centerZ);
    }

    // 3. Flat asphalt extension plane
    const asphaltW = Math.max(500, bounds.width + 300);
    const asphaltD = Math.max(500, bounds.depth + 300);
    const asphaltGeo = new THREE.PlaneGeometry(asphaltW, asphaltD);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e222b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphaltMesh.position.set(centerX, -0.1, centerZ);
    asphaltMesh.rotation.x = -Math.PI / 2;
    asphaltMesh.receiveShadow = true;
    this.group.add(asphaltMesh);

    // 4. Distant city buildings (17 low-poly monoliths) placed OUTSIDE the level bounds with >= 55m buffer
    const buildingSpecs = [
      { angle: 0.18, extra: 8, w: 9, d: 8, h: 28, color: 0x8c4636 },
      { angle: 0.52, extra: 16, w: 12, d: 10, h: 36, color: 0x2d3748 },
      { angle: 0.88, extra: 12, w: 10, d: 11, h: 22, color: 0x9a5b4f },
      { angle: 1.25, extra: 24, w: 14, d: 12, h: 42, color: 0x3b4454 },
      { angle: 1.62, extra: 6, w: 8, d: 8, h: 18, color: 0x7a3d31 },
      { angle: 1.95, extra: 15, w: 11, d: 9, h: 32, color: 0x1f2937 },
      { angle: 2.32, extra: 25, w: 13, d: 11, h: 38, color: 0x8b5a4a },
      { angle: 2.68, extra: 10, w: 9, d: 10, h: 24, color: 0x334155 },
      { angle: 3.08, extra: 20, w: 12, d: 12, h: 44, color: 0x6e382d },
      { angle: 3.48, extra: 14, w: 10, d: 8, h: 26, color: 0x475569 },
      { angle: 3.86, extra: 18, w: 11, d: 10, h: 34, color: 0xa05244 },
      { angle: 4.22, extra: 8, w: 9, d: 9, h: 20, color: 0x242d3d },
      { angle: 4.58, extra: 28, w: 15, d: 13, h: 40, color: 0x7c4338 },
      { angle: 4.96, extra: 12, w: 10, d: 11, h: 30, color: 0x374151 },
      { angle: 5.38, extra: 22, w: 12, d: 9, h: 38, color: 0x945344 },
      { angle: 5.72, extra: 10, w: 8, d: 10, h: 22, color: 0x1e293b },
      { angle: 6.08, extra: 16, w: 10, d: 12, h: 35, color: 0x854437 },
    ];

    const mechMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
    });

    for (const b of buildingSpecs) {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.65,
        metalness: 0.25,
        flatShading: true,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);

      const cosA = Math.cos(b.angle);
      const sinA = Math.sin(b.angle);
      const radialDist =
        Math.min(
          (halfW + buffer) / Math.max(0.05, Math.abs(cosA)),
          (halfD + buffer) / Math.max(0.05, Math.abs(sinA))
        ) + b.extra;

      const posX = centerX + cosA * radialDist;
      const posZ = centerZ + sinA * radialDist;

      bMesh.position.set(posX, b.h * 0.5, posZ);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      this.group.add(bMesh);

      // Rooftop utility box
      const mechGeo = new THREE.BoxGeometry(b.w * 0.45, 3.2, b.d * 0.45);
      const mechMesh = new THREE.Mesh(mechGeo, mechMat);
      mechMesh.position.set(posX, b.h + 1.6, posZ);
      this.group.add(mechMesh);
    }

    // 5. Iberdrola Tower silhouette (iconic Bilbao tapered glass landmark) - pushed > 65m outside bounds
    const towerHeight = 72;
    const towerGeo = new THREE.CylinderGeometry(3.5, 7.5, towerHeight, 6, 1);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x336b87,
      roughness: 0.12,
      metalness: 0.82,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });
    const towerMesh = new THREE.Mesh(towerGeo, towerMat);
    const towerX = centerX + halfW + 68;
    const towerZ = centerZ - halfD - 62;
    towerMesh.position.set(towerX, towerHeight * 0.5, towerZ);
    towerMesh.castShadow = true;
    this.group.add(towerMesh);

    // Tower Spire / illuminated crown
    const spireGeo = new THREE.ConeGeometry(3.0, 10, 6);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x58a6cf,
      emissive: 0x1e4b6e,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const spireMesh = new THREE.Mesh(spireGeo, spireMat);
    spireMesh.position.set(towerX, towerHeight + 5, towerZ);
    this.group.add(spireMesh);
  }

  /**
   * TileTheme.METRO (Norman Foster underground station):
   * - Vault arch ribs repeat along the Z-axis of the level.
   */
  private buildMetro(
    scene: THREE.Scene,
    dirLight?: THREE.DirectionalLight,
    ambientLight?: THREE.AmbientLight,
    bounds: LevelBounds = { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 }
  ): void {
    // 1. Sky & Fog
    scene.background = new THREE.Color(0x181a1d);
    scene.fog = new THREE.Fog(0x181a1d, 25, 75);

    // 2. Lighting tuning (moody underground station with crisp carriage visibility)
    if (ambientLight) {
      ambientLight.color.setHex(0x94a3b8);
      ambientLight.intensity = 0.65;
    }
    if (dirLight) {
      dirLight.color.setHex(0xfff1b0);
      dirLight.intensity = 0.95;
      dirLight.target.position.set(bounds.centerX, 0, bounds.centerZ);
    }

    const centerX = bounds.centerX;
    const archRadius = 14;

    const archMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.35,
      metalness: 0.75,
    });

    const zStart = Math.floor(bounds.minZ - 18);
    const zEnd = Math.ceil(bounds.maxZ + 18);
    const zStep = 6;

    for (let z = zStart; z <= zEnd; z += zStep) {
      const torusGeo = new THREE.TorusGeometry(archRadius, 0.45, 8, 28, Math.PI);
      const archMesh = new THREE.Mesh(torusGeo, archMat);
      archMesh.position.set(centerX, 0, z);
      this.group.add(archMesh);

      const footGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
      const footMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const footLeft = new THREE.Mesh(footGeo, footMat);
      footLeft.position.set(centerX - archRadius, 0.4, z);
      this.group.add(footLeft);

      const footRight = new THREE.Mesh(footGeo, footMat);
      footRight.position.set(centerX + archRadius, 0.4, z);
      this.group.add(footRight);
    }

    const beamLength = zEnd - zStart + 16;
    const beamZ = (zStart + zEnd) * 0.5;

    const girderGeo = new THREE.BoxGeometry(0.5, 0.6, beamLength);
    const girderMesh = new THREE.Mesh(girderGeo, archMat);
    girderMesh.position.set(centerX, archRadius + 0.1, beamZ);
    this.group.add(girderMesh);

    const lightStripGeo = new THREE.BoxGeometry(0.3, 0.15, beamLength);
    const lightStripMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const lightStrip = new THREE.Mesh(lightStripGeo, lightStripMat);
    lightStrip.position.set(centerX, archRadius - 0.2, beamZ);
    this.group.add(lightStrip);

    const tunnelFloorGeo = new THREE.PlaneGeometry(36, beamLength + 40);
    const tunnelFloorMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.95,
      metalness: 0.1,
    });
    const tunnelFloorMesh = new THREE.Mesh(tunnelFloorGeo, tunnelFloorMat);
    tunnelFloorMesh.position.set(centerX, -0.05, beamZ);
    tunnelFloorMesh.rotation.x = -Math.PI / 2;
    tunnelFloorMesh.receiveShadow = true;
    this.group.add(tunnelFloorMesh);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.9,
    });
    const railXOffsets = [-6.0, -4.5, 4.5, 6.0];
    for (const ox of railXOffsets) {
      const railGeo = new THREE.BoxGeometry(0.14, 0.2, beamLength);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.position.set(centerX + ox, 0.1, beamZ);
      this.group.add(railMesh);
    }
  }

  /**
   * TileTheme.SOPELANA (Basque cliffs & ocean):
   * - Sky: Coastal blue sky with distant headlands pushed >= 65m away from playable area.
   * - Ocean plane: Scaled dynamically to horizon.
   */
  private buildSopelana(
    scene: THREE.Scene,
    dirLight?: THREE.DirectionalLight,
    ambientLight?: THREE.AmbientLight,
    bounds: LevelBounds = { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 }
  ): void {
    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;
    const halfW = bounds.width * 0.5;
    const halfD = bounds.depth * 0.5;
    const buffer = 65;

    // 1. Sky & Fog
    scene.background = new THREE.Color(0x7ec0ee);
    const fogNear = Math.max(55, Math.min(halfW, halfD) + 35);
    const fogFar = Math.max(halfW, halfD) + buffer + 200;
    scene.fog = new THREE.Fog(0xbfe3ff, fogNear, fogFar);

    // 2. Lighting tuning (bright Atlantic ocean sunlight)
    if (ambientLight) {
      ambientLight.color.setHex(0xdbeafe);
      ambientLight.intensity = 0.85;
    }
    if (dirLight) {
      dirLight.color.setHex(0xfffbeb);
      dirLight.intensity = 1.45;
      dirLight.target.position.set(centerX, 0, centerZ);
    }

    // 3. Animated Ocean Water Surface
    const waterW = Math.max(600, bounds.width + 350);
    const waterD = Math.max(600, bounds.depth + 350);
    const waterGeo = new THREE.PlaneGeometry(waterW, waterD, 64, 64);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x104e68,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(centerX, -1.2, centerZ);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    this.waterMesh = waterMesh;
    this.waterGeometry = waterGeo;

    // 4. Low-poly sandy beach extension plane
    const sandW = Math.max(400, bounds.width + 200);
    const sandD = Math.max(400, bounds.depth + 200);
    const sandGeo = new THREE.PlaneGeometry(sandW, sandD);
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xd4b483,
      roughness: 0.92,
      metalness: 0.05,
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(centerX, -0.08, centerZ);
    sandMesh.rotation.x = -Math.PI / 2;
    sandMesh.receiveShadow = true;
    this.group.add(sandMesh);

    // 5. White foam surf boundary strip
    const foamGeo = new THREE.RingGeometry(halfW + 40, halfW + 55, 32);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.position.set(centerX, -1.15, centerZ);
    foamMesh.rotation.x = -Math.PI / 2;
    this.group.add(foamMesh);

    // 6. Coastal headlands pushed >= 65m away from playable bounds into horizon
    const cliffSpecs = [
      { angle: 0.35, extra: 15, rTop: 9, rBottom: 26, height: 32, rot: 0.4 },
      { angle: 1.15, extra: 25, rTop: 10, rBottom: 30, height: 38, rot: 1.2 },
      { angle: 2.10, extra: 18, rTop: 8, rBottom: 26, height: 30, rot: 2.3 },
      { angle: 3.20, extra: 30, rTop: 12, rBottom: 34, height: 42, rot: 0.7 },
      { angle: 4.45, extra: 22, rTop: 11, rBottom: 32, height: 38, rot: 1.8 },
      { angle: 5.60, extra: 16, rTop: 9, rBottom: 28, height: 30, rot: 2.8 },
    ];

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5c5042,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true,
    });

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c3f,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });

    for (const spec of cliffSpecs) {
      const cosA = Math.cos(spec.angle);
      const sinA = Math.sin(spec.angle);
      const radialDist =
        Math.min(
          (halfW + buffer) / Math.max(0.05, Math.abs(cosA)),
          (halfD + buffer) / Math.max(0.05, Math.abs(sinA))
        ) + spec.extra;

      const posX = centerX + cosA * radialDist;
      const posZ = centerZ + sinA * radialDist;

      // Rocky cliff body
      const cliffGeo = new THREE.CylinderGeometry(
        spec.rTop,
        spec.rBottom,
        spec.height,
        6,
        1
      );
      const cliffMesh = new THREE.Mesh(cliffGeo, rockMat);
      cliffMesh.position.set(posX, spec.height * 0.5 - 2.0, posZ);
      cliffMesh.rotation.y = spec.rot;
      cliffMesh.castShadow = true;
      cliffMesh.receiveShadow = true;
      this.group.add(cliffMesh);

      // Lush green plateau top
      const topGeo = new THREE.CylinderGeometry(
        spec.rTop * 0.9,
        spec.rTop * 1.05,
        2.6,
        6,
        1
      );
      const topMesh = new THREE.Mesh(topGeo, grassMat);
      topMesh.position.set(posX, spec.height - 1.0, posZ);
      topMesh.rotation.y = spec.rot;
      topMesh.receiveShadow = true;
      this.group.add(topMesh);
    }
  }

  /**
   * TileTheme.APARTMENT (Cozy indoor apartment environment):
   */
  private buildApartment(
    scene: THREE.Scene,
    bounds: LevelBounds = { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 }
  ): void {
    // 1. Sky & Fog
    scene.background = new THREE.Color(0x12141a);
    scene.fog = new THREE.Fog(0x12141a, 22, 65);

    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;

    // 2. Dark exterior foundation extension plane
    const floorGeo = new THREE.PlaneGeometry(Math.max(220, bounds.width + 120), Math.max(220, bounds.depth + 120));
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.95,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(centerX, -0.15, centerZ);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // 3. Subtle distant dark city window silhouettes outside
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.45,
    });
    const distGeo = new THREE.BoxGeometry(14, 28, 6);
    const b1 = new THREE.Mesh(distGeo, windowMat);
    b1.position.set(centerX + 34, 10, centerZ - 30);
    this.group.add(b1);

    const b2 = new THREE.Mesh(distGeo, windowMat);
    b2.position.set(centerX - 36, 12, centerZ + 32);
    this.group.add(b2);
  }

  /**
   * TileTheme.PARK (Etxebarria Park & Bilbao Panorama Hillside):
   * - Twilight lighting with amber sunset glow and deep indigo ambient.
   * - Nocturnal grass hillside ground plane.
   * - Curved Bilbao Panorama Backdrop with Torre Iberdrola, city lights, and floating neon capsules.
   */
  private applyParkLighting(): void {
    if (this.dirLight) {
      this.dirLight.visible = true;
      this.dirLight.color.setHex(0xf59e0b); // Warm twilight amber
      this.dirLight.intensity = 0.95;
      this.dirLight.position.set(25, 20, -15);
      this.dirLight.target.position.set(15, 0, 15);
      this.dirLight.castShadow = true;
    }
    if (this.hemiLight) {
      this.hemiLight.visible = true;
      this.hemiLight.color.setHex(0x312e81); // Deep twilight purple/indigo
      this.hemiLight.groundColor.setHex(0x1e293b); // Dark hillside turf
      this.hemiLight.intensity = 0.65;
    }
    if (this.ambientLight) {
      this.ambientLight.color.setHex(0x3730a3);
      this.ambientLight.intensity = 0.45;
    }
  }

  private buildPark(
    scene: THREE.Scene,
    _dirLight?: THREE.DirectionalLight,
    _ambientLight?: THREE.AmbientLight,
    bounds: LevelBounds = { minX: 0, maxX: 30, minZ: 0, maxZ: 30, centerX: 15, centerZ: 15, width: 30, depth: 30 }
  ): void {
    const centerX = bounds.centerX;
    const centerZ = bounds.centerZ;

    // 1. Midnight Sky & Subtle Fog
    scene.background = new THREE.Color(0x0a0c16);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.012);

    // 2. Dark Green Hillside Grass Extension Plane
    const grassW = Math.max(500, bounds.width + 300);
    const grassD = Math.max(500, bounds.depth + 300);
    const grassGeo = new THREE.PlaneGeometry(grassW, grassD);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x14281d, // Dark nocturnal lawn
      roughness: 0.95,
      metalness: 0.05,
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.set(centerX, -0.1, centerZ);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.receiveShadow = true;
    this.group.add(grassMesh);

    // 3. Curved Bilbao Panorama Backdrop
    const panorama = createBilbaoPanoramaBackdrop();
    panorama.position.set(centerX, 0, centerZ - 5);
    this.group.add(panorama);
  }

  /**
   * Animated wave update loop for ocean surface (Sopelana):
   * Modulates vertex Z (world Y) with sine/cosine waves and recomputes normals.
   */
  public update(_delta: number, elapsedTime: number): void {
    if (this.currentTheme === TileTheme.SOPELANA && this.waterGeometry) {
      const posAttr = this.waterGeometry.attributes.position;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        // Plane is rotated -Math.PI / 2 around X -> world Z corresponds to -vy
        const worldZ = -vy;
        const waveY =
          Math.sin(vx * 0.15 + elapsedTime * 1.8) * 0.25 +
          Math.cos(worldZ * 0.12 + elapsedTime * 1.4) * 0.2;
        posAttr.setZ(i, waveY);
      }
      posAttr.needsUpdate = true;
      this.waterGeometry.computeVertexNormals();
    }
  }

  public getWaterMesh(): THREE.Mesh | undefined {
    return this.waterMesh;
  }
}

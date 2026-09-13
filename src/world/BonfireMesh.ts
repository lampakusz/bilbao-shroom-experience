import * as THREE from 'three';

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class BonfireMesh {
  public readonly group: THREE.Group;
  private flameMeshes: THREE.Mesh[] = [];
  private flameLight: THREE.PointLight;
  private sparks: SparkParticle[] = [];
  private smokeMeshes: THREE.Mesh[] = [];
  private time = 0;

  constructor(position: THREE.Vector3) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = 'sopelana-beach-bonfire';

    this.buildCampfireBase();
    this.buildFlames();

    // Warm, roaring campfire PointLight
    this.flameLight = new THREE.PointLight(0xff6600, 3.8, 22.0);
    this.flameLight.position.set(0, 0.85, 0);
    this.flameLight.castShadow = true;
    this.group.add(this.flameLight);

    this.initParticles();
  }

  private buildCampfireBase(): void {
    // 1. Charcoal / Glowing Coal Bed
    const coalGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.15, 10);
    const coalMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      emissive: 0xef4444,
      emissiveIntensity: 0.95,
      roughness: 0.9,
    });
    const coalMesh = new THREE.Mesh(coalGeo, coalMat);
    coalMesh.position.set(0, 0.08, 0);
    this.group.add(coalMesh);

    // 2. Perimeter Stone Ring (8 natural boulders)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.1,
    });
    const stoneCount = 8;
    const ringRadius = 0.95;
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const sx = 0.28 + Math.random() * 0.1;
      const sy = 0.22 + Math.random() * 0.08;
      const sz = 0.28 + Math.random() * 0.1;
      const stoneGeo = new THREE.DodecahedronGeometry(0.2, 0);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.scale.set(sx / 0.2, sy / 0.2, sz / 0.2);
      stone.position.set(Math.cos(angle) * ringRadius, sy * 0.5, Math.sin(angle) * ringRadius);
      stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.group.add(stone);
    }

    // 3. Wooden Logs in Teepee / Criss-Cross Formation
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.8,
      metalness: 0.05,
    });
    const logGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 7);
    const logCount = 6;
    for (let i = 0; i < logCount; i++) {
      const angle = (i / logCount) * Math.PI * 2;
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(Math.cos(angle) * 0.35, 0.45, Math.sin(angle) * 0.35);
      log.rotation.y = angle;
      log.rotation.x = 0.45;
      this.group.add(log);
    }
  }

  private buildFlames(): void {
    // Multi-layered animated fire cones
    const flameConfigs = [
      { color: 0xff3b00, emissive: 0xff2200, scale: [0.65, 1.3, 0.65], height: 0.65, y: 0.4 },
      { color: 0xf97316, emissive: 0xea580c, scale: [0.5, 1.5, 0.5], height: 0.75, y: 0.5 },
      { color: 0xfde047, emissive: 0xfacc15, scale: [0.35, 1.65, 0.35], height: 0.85, y: 0.55 },
    ];

    for (let i = 0; i < flameConfigs.length; i++) {
      const cfg = flameConfigs[i];
      const geo = new THREE.ConeGeometry(cfg.height, 1.4, 8, 1, true);
      geo.translate(0, 0.7, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.82 - i * 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
      mesh.position.set(0, cfg.y, 0);
      this.group.add(mesh);
      this.flameMeshes.push(mesh);
    }
  }

  private initParticles(): void {
    // 1. Fiery ember sparks
    const sparkGeo = new THREE.SphereGeometry(0.025, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < 18; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.visible = false;
      this.group.add(spark);
      this.sparks.push({
        mesh: spark,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.0,
      });
    }

    // 2. Rising soft smoke quads
    const smokeGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    for (let i = 0; i < 8; i++) {
      const sm = new THREE.Mesh(smokeGeo, smokeMat);
      sm.position.set(0, 1.2 + i * 0.25, 0);
      sm.visible = true;
      this.group.add(sm);
      this.smokeMeshes.push(sm);
    }
  }

  public update(delta: number): void {
    this.time += delta;

    // 1. Animated flame scale & flutter
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const fl = this.flameMeshes[i];
      const speed = 7.0 + i * 2.5;
      const wobble = Math.sin(this.time * speed) * 0.08;
      const stretch = 1.0 + Math.cos(this.time * (speed + 2.0)) * 0.12;

      fl.scale.y = (1.2 + i * 0.2) * stretch;
      fl.rotation.y += delta * (1.2 + i * 0.8);
      fl.rotation.z = wobble * (i % 2 === 0 ? 1 : -1);
    }

    // 2. Flickering bonfire point light
    const flicker = Math.sin(this.time * 12.0) * 0.35 + Math.cos(this.time * 23.0) * 0.25;
    this.flameLight.intensity = Math.max(2.5, 3.8 + flicker);

    // 3. Update fiery sparks
    for (const spark of this.sparks) {
      if (!spark.mesh.visible) {
        if (Math.random() < 0.15) {
          spark.mesh.visible = true;
          spark.mesh.position.set(
            (Math.random() - 0.5) * 0.4,
            0.6 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.4
          );
          spark.vx = (Math.random() - 0.5) * 0.3 + 0.15; // coastal ocean drift (+X)
          spark.vy = 1.2 + Math.random() * 1.4;
          spark.vz = (Math.random() - 0.5) * 0.3;
          spark.life = 0;
          spark.maxLife = 0.8 + Math.random() * 0.6;
        }
      } else {
        spark.life += delta;
        spark.mesh.position.x += spark.vx * delta;
        spark.mesh.position.y += spark.vy * delta;
        spark.mesh.position.z += spark.vz * delta;

        const progress = spark.life / spark.maxLife;
        if (progress >= 1.0) {
          spark.mesh.visible = false;
        } else {
          spark.mesh.scale.setScalar(Math.max(0.1, 1.0 - progress));
        }
      }
    }

    // 4. Update smoke drift
    for (let i = 0; i < this.smokeMeshes.length; i++) {
      const sm = this.smokeMeshes[i];
      sm.position.y += delta * 0.45;
      sm.position.x += delta * 0.18; // gentle coastal breeze toward water
      sm.rotation.z += delta * 0.2;
      const cycleY = (sm.position.y - 1.0) % 2.5;
      if (cycleY > 2.2) {
        sm.position.y = 1.0;
        sm.position.x = 0;
      }
    }
  }

  public dispose(): void {
    this.group.traverse((child) => {
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

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

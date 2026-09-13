import * as THREE from 'three';

export type TetherState = 'safe' | 'warning' | 'critical';

export interface TetherStatus {
  distance: number;
  state: TetherState;
}

export class TetherRenderer {
  public readonly group: THREE.Group;
  private tubeMesh: THREE.Mesh;
  private tubeMaterial: THREE.MeshStandardMaterial;
  private midLight: THREE.PointLight;

  private currentGeometry: THREE.TubeGeometry | null = null;
  private time = 0;

  // Cached vectors to prevent GC allocations
  private p1Waist = new THREE.Vector3();
  private p2Waist = new THREE.Vector3();
  private midPoint = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'tether-beam-group';

    this.tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.2,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    // Dummy initial geometry
    const dummyCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(1, 0.6, 0)
    );
    this.currentGeometry = new THREE.TubeGeometry(dummyCurve, 10, 0.045, 6, false);
    this.tubeMesh = new THREE.Mesh(this.currentGeometry, this.tubeMaterial);
    this.tubeMesh.renderOrder = 8;
    this.group.add(this.tubeMesh);

    // Glowing PointLight at midpoint
    this.midLight = new THREE.PointLight(0x38bdf8, 1.2, 5.0);
    this.midLight.position.set(0, 0.6, 0);
    this.group.add(this.midLight);

    // Hidden tether visual geometry per requirements
    this.tubeMesh.visible = false;
    this.midLight.visible = false;
    this.group.visible = false;

    scene.add(this.group);
  }

  public update(p1Pos: THREE.Vector3, p2Pos: THREE.Vector3, delta: number): TetherStatus {
    this.time += delta;

    this.p1Waist.set(p1Pos.x, p1Pos.y + 0.62, p1Pos.z);
    this.p2Waist.set(p2Pos.x, p2Pos.y + 0.62, p2Pos.z);

    const dist = this.p1Waist.distanceTo(this.p2Waist);

    // Determine state based on distance thresholds
    // Max allowable L = 16.0m
    let state: TetherState = 'safe';
    let targetColor = 0x38bdf8; // Cyan / sky blue
    let emissiveIntensity = 1.0;
    let radius = 0.045;

    if (dist >= 14.0) {
      state = 'critical';
      targetColor = 0xef4444; // Crimson red
      const flicker = Math.sin(this.time * 16.0);
      emissiveIntensity = 1.8 + flicker * 0.7;
      radius = 0.045 + Math.abs(Math.sin(this.time * 20.0)) * 0.035;
    } else if (dist >= 11.0) {
      state = 'warning';
      targetColor = 0xf59e0b; // Amber / gold
      const pulse = Math.sin(this.time * 6.0);
      emissiveIntensity = 1.2 + pulse * 0.45;
      radius = 0.055;
    } else {
      state = 'safe';
      targetColor = 0x38bdf8;
      emissiveIntensity = 1.1 + Math.sin(this.time * 2.5) * 0.15;
      radius = 0.042;
    }

    // If mesh is invisible (hidden), skip expensive TubeGeometry rebuilding
    if (!this.group.visible || !this.tubeMesh.visible) {
      return {
        distance: dist,
        state,
      };
    }

    // Dynamic catenary sag: greater when close, tightens as distance increases
    const sag = Math.max(0.04, 0.32 * (1.0 - Math.min(1.0, dist / 16.0)));

    this.midPoint.addVectors(this.p1Waist, this.p2Waist).multiplyScalar(0.5);
    this.midPoint.y -= sag;

    // Create 3-point CatmullRom curve for natural organic energy beam
    const curve = new THREE.CatmullRomCurve3(
      [this.p1Waist, this.midPoint, this.p2Waist],
      false,
      'catmullrom',
      0.3
    );

    // Rebuild tube geometry
    if (this.currentGeometry) {
      this.currentGeometry.dispose();
    }
    this.currentGeometry = new THREE.TubeGeometry(curve, 12, radius, 6, false);
    this.tubeMesh.geometry = this.currentGeometry;

    // Update material visuals
    this.tubeMaterial.color.setHex(targetColor);
    this.tubeMaterial.emissive.setHex(targetColor);
    this.tubeMaterial.emissiveIntensity = emissiveIntensity;

    // Update attached point light
    this.midLight.position.copy(this.midPoint);
    this.midLight.color.setHex(targetColor);
    this.midLight.intensity = emissiveIntensity * 0.9;
    this.midLight.distance = state === 'critical' ? 7.0 : 5.0;

    return {
      distance: dist,
      state,
    };
  }

  public setVisible(_visible: boolean): void {
    // Kept invisible per requirement: tether mesh hidden, physical tether and audio active
    this.group.visible = false;
    this.tubeMesh.visible = false;
    this.midLight.visible = false;
  }

  public dispose(): void {
    if (this.currentGeometry) {
      this.currentGeometry.dispose();
      this.currentGeometry = null;
    }
    this.tubeMaterial.dispose();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

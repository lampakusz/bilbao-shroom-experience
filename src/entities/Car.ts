import * as THREE from 'three';
import type { CarConfig } from '../world/TileTypes.ts';
import type { Player } from './Player.ts';
import type { AudioManager } from '../audio/AudioManager.ts';
import type { CameraRig } from '../engine/CameraRig.ts';

export class Car {
  public readonly config: CarConfig;
  public readonly mesh: THREE.Group;

  public axis: 'x' | 'z';
  public direction: 1 | -1;
  public speed: number;
  public boundsMin: number;
  public boundsMax: number;

  private wheels: THREE.Mesh[] = [];
  private playerCooldowns = new Map<Player, number>();

  constructor(config: CarConfig) {
    this.config = config;
    this.axis = config.axis ?? 'x';
    this.direction = config.direction ?? 1;
    this.speed = config.speed ?? 10.0;
    this.boundsMin = config.boundsMin;
    this.boundsMax = config.boundsMax;

    this.mesh = new THREE.Group();
    this.mesh.position.set(config.spawnPos[0], config.spawnPos[1], config.spawnPos[2]);

    this.buildCarMesh(config.colorHex);
    this.updateFacing();
  }

  private buildCarMesh(colorHex?: number): void {
    const isTaxi = colorHex === undefined;
    const bodyColor = colorHex ?? 0xf8fafc; // Bilbao Taxi: white

    // 1. Lower chassis / body
    const bodyGeo = new THREE.BoxGeometry(3.0, 0.6, 1.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.35,
      metalness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    // If Bilbao taxi, add Basque red diagonal stripe decal on sides
    if (isTaxi) {
      const stripeGeo = new THREE.BoxGeometry(0.12, 0.5, 1.42);
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626, // Basque crimson red
        roughness: 0.4,
        metalness: 0.1,
      });
      const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
      stripeMesh.position.set(0.2, 0.55, 0);
      this.mesh.add(stripeMesh);

      // Taxi roof sign
      const signGeo = new THREE.BoxGeometry(0.5, 0.18, 0.25);
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0, 1.5, 0);
      this.mesh.add(signMesh);
    }

    // 2. Cabin & Roof
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.52, 1.26);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.35,
      metalness: 0.25,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(-0.1, 1.08, 0);
    cabinMesh.castShadow = true;
    this.mesh.add(cabinMesh);

    // 3. Tinted Windows (Front windshield, rear, sides)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    // Front windshield
    const frontWindshieldGeo = new THREE.BoxGeometry(0.04, 0.42, 1.18);
    const frontWindshield = new THREE.Mesh(frontWindshieldGeo, glassMat);
    frontWindshield.position.set(0.72, 1.05, 0);
    frontWindshield.rotation.z = -0.3;
    this.mesh.add(frontWindshield);

    // Rear window
    const rearWindshieldGeo = new THREE.BoxGeometry(0.04, 0.42, 1.18);
    const rearWindshield = new THREE.Mesh(rearWindshieldGeo, glassMat);
    rearWindshield.position.set(-0.92, 1.05, 0);
    rearWindshield.rotation.z = 0.3;
    this.mesh.add(rearWindshield);

    // Side windows
    const sideWindowGeo = new THREE.BoxGeometry(1.4, 0.38, 1.28);
    const sideWindows = new THREE.Mesh(sideWindowGeo, glassMat);
    sideWindows.position.set(-0.1, 1.06, 0);
    this.mesh.add(sideWindows);

    // 4. Headlights (Facing forward +X)
    const lightGeo = new THREE.BoxGeometry(0.05, 0.16, 0.26);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 1.8,
    });
    const headL = new THREE.Mesh(lightGeo, headMat);
    headL.position.set(1.52, 0.58, 0.44);
    this.mesh.add(headL);

    const headR = new THREE.Mesh(lightGeo, headMat);
    headR.position.set(1.52, 0.58, -0.44);
    this.mesh.add(headR);

    // 5. Taillights (Facing backward -X)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.5,
    });
    const tailL = new THREE.Mesh(lightGeo, tailMat);
    tailL.position.set(-1.52, 0.58, 0.44);
    this.mesh.add(tailL);

    const tailR = new THREE.Mesh(lightGeo, tailMat);
    tailR.position.set(-1.52, 0.58, -0.44);
    this.mesh.add(tailR);

    // 6. 4 Wheels & Hubcaps
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.9,
      metalness: 0.1,
    });

    const wheelPositions = [
      [0.9, 0.32, 0.72],   // Front Right
      [0.9, 0.32, -0.72],  // Front Left
      [-0.9, 0.32, 0.72],  // Rear Right
      [-0.9, 0.32, -0.72], // Rear Left
    ];

    for (const [wx, wy, wz] of wheelPositions) {
      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.position.set(wx, wy, wz);
      wheelMesh.castShadow = true;
      this.mesh.add(wheelMesh);
      this.wheels.push(wheelMesh);
    }
  }

  private updateFacing(): void {
    if (this.axis === 'x') {
      this.mesh.rotation.y = this.direction === 1 ? 0 : Math.PI;
    } else {
      this.mesh.rotation.y = this.direction === 1 ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  public update(
    delta: number,
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    cameraRig?: CameraRig
  ): void {
    // 1. Advance position along axis
    const moveAmount = this.direction * this.speed * delta;
    this.mesh.position[this.axis] += moveAmount;

    // 2. Spin wheels
    for (const wheel of this.wheels) {
      wheel.rotation.z -= (moveAmount / 0.32);
    }

    // 3. Boundary Turnaround
    if (this.direction === 1 && this.mesh.position[this.axis] >= this.boundsMax) {
      this.direction = -1;
      this.updateFacing();
    } else if (this.direction === -1 && this.mesh.position[this.axis] <= this.boundsMin) {
      this.direction = 1;
      this.updateFacing();
    }

    // 4. Update player collision cooldowns
    for (const [player, cd] of this.playerCooldowns.entries()) {
      if (cd > 0) {
        this.playerCooldowns.set(player, cd - delta);
      } else {
        this.playerCooldowns.delete(player);
      }
    }

    // 5. Collision detection against P1 & P2
    this.checkPlayerCollision(p1, audioManager, cameraRig);
    this.checkPlayerCollision(p2, audioManager, cameraRig);
  }

  private checkPlayerCollision(
    player: Player,
    audioManager?: AudioManager,
    cameraRig?: CameraRig
  ): void {
    if (this.playerCooldowns.has(player)) return;

    // Check distances along car primary and lateral axes
    const dx = Math.abs(player.position.x - this.mesh.position.x);
    const dz = Math.abs(player.position.z - this.mesh.position.z);

    const isHit =
      this.axis === 'x'
        ? dx < 2.0 && dz < 1.2
        : dz < 2.0 && dx < 1.2;

    if (isHit) {
      this.playerCooldowns.set(player, 1.5);

      // Strong knockback impulse in movement direction + away from car
      const knockback = new THREE.Vector3();
      if (this.axis === 'x') {
        knockback.set(this.direction * 12.0, 0, (player.position.z - this.mesh.position.z) * 6.0);
      } else {
        knockback.set((player.position.x - this.mesh.position.x) * 6.0, 0, this.direction * 12.0);
      }

      player.applyKnockback(knockback);
      player.applyStun(1.0);
      player.say('Áúúú, elütött egy autó!', 2.5);

      if (cameraRig) {
        cameraRig.addShake(0.4);
      }

      if (audioManager) {
        audioManager.playCarCrash();
        audioManager.playHostileThreat();
      }
    }
  }

  public toConfig(): CarConfig {
    return {
      spawnPos: [this.mesh.position.x, this.mesh.position.y, this.mesh.position.z],
      axis: this.axis,
      direction: this.direction,
      speed: this.speed,
      boundsMin: this.boundsMin,
      boundsMax: this.boundsMax,
      colorHex: this.config.colorHex,
    };
  }

  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}

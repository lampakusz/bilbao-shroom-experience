import * as THREE from 'three';
import { GRID_CELL_SIZE } from '../world/BlockFactory.ts';
import { InputManager } from './InputManager.ts';

export interface CameraRigOptions {
  minDistance?: number;
  maxDistance?: number;
  baseHeight?: number;
  heightScale?: number;
  baseOffsetZ?: number;
  offsetZScale?: number;
  lerpFactor?: number;
}

export type CameraMode = 'isometric' | 'interior';

export const CAM_MODE_ISOMETRIC = {
  baseHeight: 12.0,
  baseOffsetZ: 14.0,
  fov: 60,
  minDistance: 8.0,
  maxDistance: 25.0,
  heightScale: 0.6,
  offsetZScale: 0.5,
};

export const CAM_MODE_INTERIOR_CARRIAGE = {
  baseHeight: 2.5,
  baseOffsetZ: 5.0,
  fov: 50,
  minDistance: 3.0,
  maxDistance: 10.0,
  heightScale: 0.2,
  offsetZScale: 0.3,
};

export class CameraRig {
  public readonly camera: THREE.PerspectiveCamera;

  public minDistance: number;
  public maxDistance: number;
  public baseHeight: number;
  public heightScale: number;
  public baseOffsetZ: number;
  public offsetZScale: number;
  public lerpFactor: number;

  private cameraMode: CameraMode = 'isometric';
  private currentLookAt: THREE.Vector3;
  private isInitialized = false;

  private curve: THREE.CatmullRomCurve3 | null = null;
  private waypoints?: Array<[number, number, number]>;
  private currentT = 0;
  private currentAngle = 0;
  private shakeIntensity = 0;

  private occlusionRaycaster = new THREE.Raycaster();
  private fadedMeshes = new Set<THREE.Mesh>();
  private isCinematic = false;

  // Optimized Occlusion Culling state
  private occlusionFrameCounter = 0;
  private occlusionTimer = 0;
  private cachedCurrentHits = new Set<THREE.Mesh>();
  private cachedOccluders: THREE.Mesh[] = [];
  private occluderCacheTimestamp = 0;

  // Non-blocking camera peek state
  private peekTarget: THREE.Vector3 | null = null;
  private peekDuration = 1.6;
  private peekTimer = 0;

  // Cinematic door fly-to state
  private isDoorCinematic = false;
  private doorCinematicTimer = 0;
  private doorCinematicDuration = 2.5;
  private doorStartCamPos = new THREE.Vector3();
  private doorStartLookAt = new THREE.Vector3();
  private doorTargetCamPos = new THREE.Vector3();
  private doorTargetLookAt = new THREE.Vector3();
  private doorOpenTriggered = false;
  private onDoorOpenCallback?: () => void;
  private onDoorCinematicComplete?: () => void;

  /**
   * Cinematic close-up camera fly-to for door opening:
   * - Locks player controls briefly during the transition to prevent blind movement.
   * - 0.0s - 0.6s: Smooth flight from overhead position to close-up framing:
   *                targetCamPos = doorPosition + doorFacingNormal * 3.5m + Vector3(0, 1.8m, 0),
   *                targetLookAt = doorPosition + Vector3(0, 1.2m, 0).
   * - 0.6s - 1.4s: Door hinges physically open / slides apart while framed in premier plan, playing mechanical audio.
   * - 1.4s - 1.9s: Hold view for 0.5s to register the newly cleared passage.
   * - 1.9s - 2.5s: Smooth flight back to the players' midpoint, unlocking player controls.
   */
  public focusOnDoor(
    doorPosition: THREE.Vector3,
    param2?: number | THREE.Vector3 | (() => void),
    param3?: THREE.Vector3 | (() => void),
    param4?: () => void,
    param5?: number
  ): void {
    let duration = 2.5;
    let normal = new THREE.Vector3(0, 0, 1);
    let onDoorOpen: (() => void) | undefined;
    let onComplete: (() => void) | undefined;

    if (typeof param2 === 'number') {
      duration = param2;
      if (param3 instanceof THREE.Vector3) {
        normal = param3.clone();
      } else if (typeof param3 === 'function') {
        onDoorOpen = param3;
      }
      if (typeof param4 === 'function') onComplete = param4;
    } else if (param2 instanceof THREE.Vector3) {
      normal = param2.clone();
      if (typeof param3 === 'function') onDoorOpen = param3;
      if (typeof param4 === 'function') onComplete = param4;
      if (typeof param5 === 'number') duration = param5;
    } else if (typeof param2 === 'function') {
      onDoorOpen = param2;
      if (typeof param3 === 'function') onComplete = param3 as () => void;
    }

    if (normal.lengthSq() > 0.001) {
      normal.normalize();
    } else {
      normal.set(0, 0, 1);
    }

    this.isDoorCinematic = true;
    this.isCinematic = true;
    this.clearOcclusion();

    // Lock player controls during transition to prevent blind movement
    InputManager.getInstance().lockControls(true);

    this.doorCinematicTimer = 0;
    this.doorCinematicDuration = duration;
    this.doorOpenTriggered = false;
    this.onDoorOpenCallback = onDoorOpen;
    this.onDoorCinematicComplete = onComplete;

    this.doorStartCamPos.copy(this.camera.position);
    this.doorStartLookAt.copy(this.currentLookAt);

    // targetCamPos = doorPosition + doorFacingNormal * 3.5m + Vector3(0, 1.8m, 0)
    this.doorTargetCamPos.copy(doorPosition)
      .addScaledVector(normal, 3.5)
      .add(new THREE.Vector3(0, 1.8, 0));

    // targetLookAt = doorPosition + Vector3(0, 1.2m, 0)
    this.doorTargetLookAt.copy(doorPosition).add(new THREE.Vector3(0, 1.2, 0));
  }

  /**
   * Smoothly pans the camera focus toward a target (e.g. an opening door).
   * Forwards to focusOnDoor for consistent cinematic close-up behavior.
   */
  public peekAtTarget(targetPos: THREE.Vector3, duration = 1.6): void {
    this.focusOnDoor(targetPos, duration);
  }

  /**
   * Cinematic focus on a floor-level exit portal using the standard isometric
   * overhead perspective (same height/angle as normal gameplay).
   * - Flies to a position directly above-and-behind the portal (isometric offset)
   * - Looks straight at the portal centre
   * - Then returns smoothly to the players after the hold phase
   */
  public focusOnPortal(portalPos: THREE.Vector3, duration = 2.5): void {
    this.isDoorCinematic = true;
    this.isCinematic = true;
    this.clearOcclusion();
    InputManager.getInstance().lockControls(true);

    this.doorCinematicTimer = 0;
    this.doorCinematicDuration = duration;
    this.doorOpenTriggered = true; // no separate "door open" callback needed
    this.onDoorOpenCallback = undefined;
    this.onDoorCinematicComplete = undefined;

    this.doorStartCamPos.copy(this.camera.position);
    this.doorStartLookAt.copy(this.currentLookAt);

    // Isometric overhead target — same offset ratios as normal gameplay
    // baseHeight=12, baseOffsetZ=14 from CAM_MODE_ISOMETRIC
    const isoHeight = this.baseHeight;     // ~12m above ground
    const isoOffsetZ = this.baseOffsetZ;   // ~14m behind along Z

    // If there's a path curve, derive the angle from it; otherwise use 0 (straight back on Z)
    let angle = 0;
    if (this.curve) {
      const t = this.sampleCurveClosestT(portalPos);
      const T = this.curve.getTangentAt(t).normalize();
      angle = Math.atan2(-T.z, T.x);
    }

    this.doorTargetCamPos.set(
      portalPos.x + Math.sin(angle) * isoOffsetZ,
      portalPos.y + isoHeight,
      portalPos.z + Math.cos(angle) * isoOffsetZ
    );
    // Look straight at portal centre (Y stays at ground level)
    this.doorTargetLookAt.copy(portalPos);
  }

  public startCinematic(initialCamPos?: THREE.Vector3, initialLookAt?: THREE.Vector3): void {
    this.isCinematic = true;
    this.clearOcclusion();
    if (initialCamPos) this.camera.position.copy(initialCamPos);
    if (initialLookAt) {
      this.currentLookAt.copy(initialLookAt);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  public setCinematicTransform(camPos: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.isCinematic = true;
    this.camera.position.copy(camPos);
    this.currentLookAt.copy(lookAt);
    this.camera.lookAt(this.currentLookAt);
  }

  public stopCinematic(): void {
    if (this.isDoorCinematic) {
      this.isDoorCinematic = false;
      InputManager.getInstance().lockControls(false);
    }
    this.isCinematic = false;
  }

  private savedFov = 45;
  private savedCamPos = new THREE.Vector3();
  private savedLookAt = new THREE.Vector3();

  /**
   * Fallout Cinematic Dialogue Bust Shot:
   * Zooms into medium bust shot of the NPC, narrows FOV to 28 degrees.
   */
  public startDialogueBust(npcPos: THREE.Vector3, npcFacingAngle = 0): void {
    this.isCinematic = true;
    this.clearOcclusion();

    this.savedFov = this.camera.fov;
    this.savedCamPos.copy(this.camera.position);
    this.savedLookAt.copy(this.currentLookAt);

    // Bust shot target: Frame NPC chest level (Y + 0.65m) so the face is positioned
    // in the upper half of the screen, safely above the dialogue box
    const targetLookAt = new THREE.Vector3(npcPos.x, npcPos.y + 0.65, npcPos.z);

    // Camera positioned directly in FRONT of NPC at distance 2.2m
    const forwardX = Math.sin(npcFacingAngle);
    const forwardZ = Math.cos(npcFacingAngle);
    const camX = npcPos.x + forwardX * 2.2;
    const camZ = npcPos.z + forwardZ * 2.2;
    const camY = npcPos.y + 0.95;

    this.camera.position.set(camX, camY, camZ);
    this.currentLookAt.copy(targetLookAt);
    this.camera.lookAt(this.currentLookAt);

    // Crisp 30° FOV for cinematic dialogue framing
    this.camera.fov = 30;
    this.camera.updateProjectionMatrix();
  }

  public endDialogueBust(): void {
    this.isCinematic = false;
    this.camera.fov = this.savedFov || (this.cameraMode === 'interior' ? 50 : 60);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Wall Chill Mode Camera Framing:
   * Transitions camera to a low, cinematic three-quarter perspective framing the seated players
   * in the foreground with the background city skyline and Torre Iberdrola in view.
   */
  public startWallChillCamera(spotPos: THREE.Vector3, wallAngle: number = 0): void {
    this.isCinematic = true;
    this.clearOcclusion();

    this.savedFov = this.camera.fov;
    this.savedCamPos.copy(this.camera.position);
    this.savedLookAt.copy(this.currentLookAt);

    // Target look-at: midpoint between players and horizon, around head height (Y + 0.85)
    const targetLookAt = new THREE.Vector3(spotPos.x, spotPos.y + 0.85, spotPos.z);

    // Low three-quarter angle offset:
    // Sitting at retaining wall facing out towards Bilbao panorama
    // Low camera: Y around 0.75m above ground, distance ~3.8m, rotated at 45 degrees
    const camAngle = wallAngle + Math.PI * 0.25;
    const camDist = 3.8;
    const camX = spotPos.x + Math.sin(camAngle) * camDist;
    const camZ = spotPos.z + Math.cos(camAngle) * camDist;
    const camY = spotPos.y + 0.75;

    this.camera.position.set(camX, camY, camZ);
    this.currentLookAt.copy(targetLookAt);
    this.camera.lookAt(this.currentLookAt);

    this.camera.fov = 42; // Panoramic cinematic wide-angle framing
    this.camera.updateProjectionMatrix();
  }

  public endWallChillCamera(): void {
    this.isCinematic = false;
    this.camera.fov = this.savedFov || (this.cameraMode === 'interior' ? 50 : 60);
    this.camera.updateProjectionMatrix();
  }

  public isCinematicActive(): boolean {
    return this.isCinematic;
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(this.shakeIntensity + amount, 1.0);
  }

  constructor(camera: THREE.PerspectiveCamera, options: CameraRigOptions = {}) {
    this.camera = camera;

    this.minDistance = options.minDistance ?? CAM_MODE_ISOMETRIC.minDistance;
    this.maxDistance = options.maxDistance ?? CAM_MODE_ISOMETRIC.maxDistance;
    this.baseHeight = options.baseHeight ?? CAM_MODE_ISOMETRIC.baseHeight;
    this.heightScale = options.heightScale ?? CAM_MODE_ISOMETRIC.heightScale;
    this.baseOffsetZ = options.baseOffsetZ ?? CAM_MODE_ISOMETRIC.baseOffsetZ;
    this.offsetZScale = options.offsetZScale ?? CAM_MODE_ISOMETRIC.offsetZScale;
    this.lerpFactor = options.lerpFactor ?? 5.0;

    this.currentLookAt = new THREE.Vector3(0, 0, 0);
  }

  public setCameraMode(mode: CameraMode = 'isometric'): void {
    this.cameraMode = mode;
    const profile = mode === 'interior' ? CAM_MODE_INTERIOR_CARRIAGE : CAM_MODE_ISOMETRIC;
    this.baseHeight = profile.baseHeight;
    this.baseOffsetZ = profile.baseOffsetZ;
    this.minDistance = profile.minDistance;
    this.maxDistance = profile.maxDistance;
    this.heightScale = profile.heightScale;
    this.offsetZScale = profile.offsetZScale;

    if (Math.abs(this.camera.fov - profile.fov) > 0.5) {
      this.camera.fov = profile.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public resetForEditor(): void {
    if (this.isDoorCinematic) {
      this.isDoorCinematic = false;
      InputManager.getInstance().lockControls(false);
    }
    this.isCinematic = false;
    this.clearOcclusion();
    this.setCameraMode('isometric');
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
  }

  public setPath(waypoints?: Array<[number, number, number]>): void {
    if (waypoints && waypoints.length >= 2) {
      const points = waypoints.map((w) => new THREE.Vector3(w[0] * GRID_CELL_SIZE, w[1] * GRID_CELL_SIZE, w[2] * GRID_CELL_SIZE));
      this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
      this.waypoints = waypoints;
    } else {
      this.curve = null;
      this.waypoints = undefined;
      this.currentT = 0;
      this.currentAngle = 0;
    }
  }

  public getCurve(): THREE.CatmullRomCurve3 | null {
    return this.curve;
  }

  public getWaypoints(): Array<[number, number, number]> | undefined {
    return this.waypoints;
  }

  private sampleCurveClosestT(point: THREE.Vector3): number {
    if (!this.curve) return 0;
    const SAMPLES = 80;
    let bestT = 0;
    let minDistSq = Infinity;

    // 1. Coarse search across subdivisions
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const p = this.curve.getPointAt(t);
      const dSq = point.distanceToSquared(p);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestT = t;
      }
    }

    // 2. Fine search (local trisection refinement)
    const step = 1 / SAMPLES;
    let low = Math.max(0, bestT - step);
    let high = Math.min(1, bestT + step);
    for (let iter = 0; iter < 8; iter++) {
      const t1 = low + (high - low) * (1 / 3);
      const t2 = low + (high - low) * (2 / 3);
      const p1 = this.curve.getPointAt(t1);
      const p2 = this.curve.getPointAt(t2);
      if (point.distanceToSquared(p1) < point.distanceToSquared(p2)) {
        high = t2;
      } else {
        low = t1;
      }
    }

    return (low + high) * 0.5;
  }

  public snapToTarget(target: THREE.Vector3): void {
    if (!target) return;
    this.snap(target, target);
  }

  public snap(p1Pos: THREE.Vector3, p2Pos: THREE.Vector3): void {
    if (!p1Pos || !p2Pos) return;
    this.clearOcclusion();
    const midpoint = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
    const rawDist = p1Pos.distanceTo(p2Pos);

    if (this.curve) {
      this.currentT = this.sampleCurveClosestT(midpoint);
      const T = this.curve.getTangentAt(this.currentT).normalize();
      this.currentAngle = Math.atan2(-T.z, T.x);

      const dist = THREE.MathUtils.clamp(rawDist, this.minDistance, this.maxDistance);
      const radius = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;
      const height = this.baseHeight + (dist - this.minDistance) * this.heightScale;

      const camOffset = new THREE.Vector3(
        Math.sin(this.currentAngle) * radius,
        height,
        Math.cos(this.currentAngle) * radius
      );

      const targetLookAt = this.cameraMode === 'interior'
        ? new THREE.Vector3(midpoint.x, midpoint.y + 1.1, midpoint.z)
        : midpoint;

      this.camera.position.copy(midpoint).add(camOffset);
      this.currentLookAt.copy(targetLookAt);
      this.camera.lookAt(this.currentLookAt);
      this.isInitialized = true;
      return;
    }

    // Default isometric fallback
    const dist = THREE.MathUtils.clamp(rawDist, this.minDistance, this.maxDistance);
    const height = this.baseHeight + (dist - this.minDistance) * this.heightScale;
    const offsetZ = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;

    const targetLookAt = this.cameraMode === 'interior'
      ? new THREE.Vector3(midpoint.x, midpoint.y + 1.1, midpoint.z)
      : midpoint;

    this.currentAngle = 0;
    this.currentT = 0;
    this.camera.position.set(midpoint.x, midpoint.y + height, midpoint.z + offsetZ);
    this.currentLookAt.copy(targetLookAt);
    this.camera.lookAt(this.currentLookAt);
    this.isInitialized = true;
  }

  public update(delta: number, p1Pos: THREE.Vector3, p2Pos: THREE.Vector3): void {
    if (this.isDoorCinematic) {
      this.updateDoorCinematic(delta, p1Pos, p2Pos);
      return;
    }

    if (this.isCinematic) {
      return;
    }

    const midpoint = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
    const rawDist = p1Pos.distanceTo(p2Pos);

    if (!this.isInitialized) {
      this.snap(p1Pos, p2Pos);
      return;
    }

    const targetLookAt = this.cameraMode === 'interior'
      ? new THREE.Vector3(midpoint.x, midpoint.y + 1.1, midpoint.z)
      : midpoint.clone();

    if (this.peekTimer > 0 && this.peekTarget) {
      this.peekTimer = Math.max(0, this.peekTimer - delta);
      const p = 1.0 - this.peekTimer / this.peekDuration;
      const peekWeight = Math.sin(p * Math.PI) * 0.75;
      targetLookAt.lerp(this.peekTarget, peekWeight);
    }

    if (this.curve) {
      const targetT = this.sampleCurveClosestT(midpoint);
      this.currentT = THREE.MathUtils.damp(this.currentT, targetT, 4.0, delta);

      const T = this.curve.getTangentAt(this.currentT).normalize();
      const targetAngle = Math.atan2(-T.z, T.x);

      let diff = Math.atan2(Math.sin(targetAngle - this.currentAngle), Math.cos(targetAngle - this.currentAngle));
      this.currentAngle += diff * (1.0 - Math.exp(-4.0 * delta));

      const dist = THREE.MathUtils.clamp(rawDist, this.minDistance, this.maxDistance);
      const radius = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;
      const height = this.baseHeight + (dist - this.minDistance) * this.heightScale;

      const camOffset = new THREE.Vector3(
        Math.sin(this.currentAngle) * radius,
        height,
        Math.cos(this.currentAngle) * radius
      );

      const targetPos = new THREE.Vector3().copy(midpoint).add(camOffset);
      const alpha = 1.0 - Math.exp(-this.lerpFactor * delta);
      this.camera.position.lerp(targetPos, alpha);
      this.currentLookAt.lerp(targetLookAt, alpha);
      this.applyShake(delta);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    // Default isometric offset mode fallback
    const dist = THREE.MathUtils.clamp(rawDist, this.minDistance, this.maxDistance);
    const height = this.baseHeight + (dist - this.minDistance) * this.heightScale;
    const offsetZ = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;

    const targetPos = new THREE.Vector3(midpoint.x, midpoint.y + height, midpoint.z + offsetZ);
    const alpha = 1.0 - Math.exp(-this.lerpFactor * delta);
    this.camera.position.lerp(targetPos, alpha);
    this.currentLookAt.lerp(targetLookAt, alpha);
    this.applyShake(delta);
    this.camera.lookAt(this.currentLookAt);
  }

  private updateDoorCinematic(delta: number, p1Pos: THREE.Vector3, p2Pos: THREE.Vector3): void {
    this.doorCinematicTimer += delta;
    const t = this.doorCinematicTimer;

    const easeInOutCubic = (x: number): number => {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    };

    if (t < 0.6) {
      // Phase 1: 0.0s - 0.6s: Smooth flight to close-up framing
      const progress = Math.min(1.0, t / 0.6);
      const ease = easeInOutCubic(progress);
      this.camera.position.lerpVectors(this.doorStartCamPos, this.doorTargetCamPos, ease);
      this.currentLookAt.lerpVectors(this.doorStartLookAt, this.doorTargetLookAt, ease);
      this.camera.lookAt(this.currentLookAt);
    } else {
      // Trigger door opening at 0.6s
      if (!this.doorOpenTriggered) {
        this.doorOpenTriggered = true;
        if (this.onDoorOpenCallback) {
          this.onDoorOpenCallback();
        }
      }

      const totalDuration = this.doorCinematicDuration;
      const returnStart = Math.max(1.4, totalDuration - 0.6);

      if (t < returnStart) {
        // Phase 2 & 3: 0.6s - 1.4s (door hinges open) + hold view on cleared passage
        this.camera.position.copy(this.doorTargetCamPos);
        this.currentLookAt.copy(this.doorTargetLookAt);
        this.camera.lookAt(this.currentLookAt);
      } else if (t < totalDuration) {
        // Phase 4: Smooth flight back to the players' midpoint
        const returnProgress = Math.min(1.0, (t - returnStart) / Math.max(0.001, totalDuration - returnStart));
        const returnEase = easeInOutCubic(returnProgress);

        const midpoint = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
        const rawDist = p1Pos.distanceTo(p2Pos);
        const dist = THREE.MathUtils.clamp(rawDist, this.minDistance, this.maxDistance);
        const height = this.baseHeight + (dist - this.minDistance) * this.heightScale;
        const offsetZ = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;

        let returnCamPos: THREE.Vector3;
        let returnLookAt = this.cameraMode === 'interior'
          ? new THREE.Vector3(midpoint.x, midpoint.y + 1.1, midpoint.z)
          : midpoint.clone();

        if (this.curve) {
          const targetT = this.sampleCurveClosestT(midpoint);
          const T = this.curve.getTangentAt(targetT).normalize();
          const targetAngle = Math.atan2(-T.z, T.x);
          const radius = this.baseOffsetZ + (dist - this.minDistance) * this.offsetZScale;
          returnCamPos = new THREE.Vector3(
            Math.sin(targetAngle) * radius,
            height,
            Math.cos(targetAngle) * radius
          ).add(midpoint);
        } else {
          returnCamPos = new THREE.Vector3(midpoint.x, midpoint.y + height, midpoint.z + offsetZ);
        }

        this.camera.position.lerpVectors(this.doorTargetCamPos, returnCamPos, returnEase);
        this.currentLookAt.lerpVectors(this.doorTargetLookAt, returnLookAt, returnEase);
        this.camera.lookAt(this.currentLookAt);
      } else {
        // Finished (t >= totalDuration)
        this.isDoorCinematic = false;
        this.isCinematic = false;
        InputManager.getInstance().lockControls(false);
        if (this.onDoorCinematicComplete) {
          this.onDoorCinematicComplete();
        }
      }
    }
  }

  private applyShake(delta: number): void {
    if (this.shakeIntensity > 0.001) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.45;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.35;
      const shakeZ = (Math.random() - 0.5) * this.shakeIntensity * 0.45;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.camera.position.z += shakeZ;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - delta * 2.5);
    }
  }

  /**
   * Returns the current horizontal yaw angle of the camera in radians.
   */
  public getYawAngle(): number {
    if (this.curve) {
      return this.currentAngle;
    }
    return Math.atan2(
      this.camera.position.x - this.currentLookAt.x,
      this.camera.position.z - this.currentLookAt.z
    );
  }

  /**
   * Transforms a 2D screen/stick movement input vector ({ x, y }) into
   * a 3D world-space movement vector ({ x, z }) relative to the camera's
   * current horizontal viewpoint:
   *   - "Up" (W / stick up, y = -1) -> moves along horizontal camera forward (away from camera screen)
   *   - "Down" (S / stick down, y = +1) -> moves towards camera screen
   *   - "Right" (D / stick right, x = +1) -> moves towards screen right
   *   - "Left" (A / stick left, x = -1) -> moves towards screen left
   */
  public transformInput(input: { x: number; y: number }): { x: number; z: number } {
    if (Math.hypot(input.x, input.y) < 0.0001) {
      return { x: 0, z: 0 };
    }

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) {
      forward.normalize();
    } else {
      forward.set(0, 0, -1);
    }

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // combine input: moveVec = forward * (-input.y) + right * input.x
    const moveX = forward.x * (-input.y) + right.x * input.x;
    const moveZ = forward.z * (-input.y) + right.z * input.x;

    return { x: moveX, z: moveZ };
  }

  /**
   * Raycasts from camera position to both player target positions.
   * Any intersecting solid walls, facades, buildings, or obstacles
   * that block the direct line of sight are made semi-transparent (opacity: 0.25).
   * Once line of sight clears, original materials are restored smoothly.
   */
  public updateOcclusion(
    scene: THREE.Scene,
    p1Pos: THREE.Vector3,
    p2Pos: THREE.Vector3,
    delta: number = 0.016,
    p1?: any,
    p2?: any
  ): void {
    if (!scene || !p1Pos || !p2Pos) return;

    // Ensure Player meshes are explicitly forced visible
    if (p1) {
      if (p1.mesh) {
        p1.mesh.visible = true;
        if ((p1.mesh as any).material) {
          (p1.mesh as any).material.opacity = 1.0;
          (p1.mesh as any).material.transparent = true;
          (p1.mesh as any).material.depthWrite = true;
        }
      }
      if (p1.spriteMesh) {
        p1.spriteMesh.visible = true;
        if (p1.spriteMesh.material) {
          (p1.spriteMesh.material as THREE.Material).opacity = 1.0;
          (p1.spriteMesh.material as any).transparent = true;
          (p1.spriteMesh.material as any).depthWrite = true;
        }
      }
    }
    if (p2) {
      if (p2.mesh) {
        p2.mesh.visible = true;
        if ((p2.mesh as any).material) {
          (p2.mesh as any).material.opacity = 1.0;
          (p2.mesh as any).material.transparent = true;
          (p2.mesh as any).material.depthWrite = true;
        }
      }
      if (p2.spriteMesh) {
        p2.spriteMesh.visible = true;
        if (p2.spriteMesh.material) {
          (p2.spriteMesh.material as THREE.Material).opacity = 1.0;
          (p2.spriteMesh.material as any).transparent = true;
          (p2.spriteMesh.material as any).depthWrite = true;
        }
      }
    }

    try {
      this.occlusionFrameCounter++;
      this.occlusionTimer += delta;

      // Throttle occlusion raycasting to run once every 4 frames (or every 60ms)
      const shouldRecalculateRaycasts =
        this.occlusionFrameCounter % 4 === 0 || this.occlusionTimer >= 0.06 || this.cachedCurrentHits.size === 0;

      if (shouldRecalculateRaycasts) {
        this.occlusionTimer = 0;

        // Cache occluder meshes, refreshing periodically or when empty
        const now = performance.now();
        if (this.cachedOccluders.length === 0 || now - this.occluderCacheTimestamp > 1500) {
          this.occluderCacheTimestamp = now;
          this.cachedOccluders = [];
          scene.traverse((obj) => {
            if (
              obj instanceof THREE.Mesh &&
              (obj.userData?.isOccluder || obj.userData?.isWall || obj.userData?.isObstacle) &&
              !obj.userData?.isPlayer &&
              obj.visible
            ) {
              // Ignore road, sidewalk, cars, and bike lane tiles completely
              if (!obj.userData?.isRoad && !obj.userData?.isCar && !obj.userData?.isSidewalk) {
                this.cachedOccluders.push(obj);
              }
            }
          });
        }

        const currentHits = new Set<THREE.Mesh>();
        const camPos = this.camera.position;

        const centerPos = new THREE.Vector3(
          (p1Pos.x + p2Pos.x) * 0.5,
          (p1Pos.y + p2Pos.y) * 0.5 + 1.0,
          (p1Pos.z + p2Pos.z) * 0.5
        );

        const targets = [
          new THREE.Vector3(p1Pos.x, p1Pos.y + 0.6, p1Pos.z),
          new THREE.Vector3(p1Pos.x, p1Pos.y + 1.2, p1Pos.z),
          new THREE.Vector3(p2Pos.x, p2Pos.y + 0.6, p2Pos.z),
          new THREE.Vector3(p2Pos.x, p2Pos.y + 1.2, p2Pos.z),
          centerPos,
        ];

        for (const target of targets) {
          const diff = new THREE.Vector3().subVectors(target, camPos);
          const dist = diff.length();
          if (dist < 0.6) continue;

          const dir = diff.normalize();
          this.occlusionRaycaster.set(camPos, dir);
          this.occlusionRaycaster.near = 0.5;
          this.occlusionRaycaster.far = Math.max(0.6, dist - 0.35);

          // Raycast strictly against objects tagged with userData.isOccluder / walls
          const intersections = this.occlusionRaycaster.intersectObjects(this.cachedOccluders, false);

          for (const hit of intersections) {
            const obj = hit.object;
            if (!obj || !(obj instanceof THREE.Mesh) || !obj.parent || !obj.geometry || !obj.material || !obj.visible) continue;

            // NEVER test, hide, or fade meshes associated with Player 1 or Player 2!
            if (
              (p1 && (hit.object === p1.mesh || hit.object === p1.spriteMesh)) ||
              (p2 && (hit.object === p2.mesh || hit.object === p2.spriteMesh)) ||
              hit.object.userData?.isPlayer
            ) {
              continue;
            }

            // Check if object or any parent is tagged with isPlayer
            let isPlayerObject = false;
            let checkParent: THREE.Object3D | null = obj;
            while (checkParent && checkParent !== scene) {
              if (
                checkParent.userData?.isPlayer ||
                (p1 && (checkParent === p1.mesh || checkParent === p1.spriteMesh || checkParent === p1.billboardGroup)) ||
                (p2 && (checkParent === p2.mesh || checkParent === p2.spriteMesh || checkParent === p2.billboardGroup))
              ) {
                isPlayerObject = true;
                break;
              }
              checkParent = checkParent.parent;
            }
            if (isPlayerObject) continue;

            // Find the highest ancestor that is tagged with isOccluder, isWall or isObstacle
            let topWallAncestor: THREE.Object3D | null = null;
            let curr: THREE.Object3D | null = obj;
            while (curr && curr !== scene) {
              if (curr.userData?.isOccluder || curr.userData?.isWall || curr.userData?.isObstacle) {
                topWallAncestor = curr;
              }
              curr = curr.parent;
            }

            if (!topWallAncestor) {
              currentHits.add(obj);
              continue;
            }

            // Add ALL visible mesh descendants of this wall / building tile so the entire compound group fades together!
            topWallAncestor.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material && child.visible) {
                if (
                  (p1 && (child === p1.mesh || child === p1.spriteMesh || child.userData?.isPlayer)) ||
                  (p2 && (child === p2.mesh || child === p2.spriteMesh || child.userData?.isPlayer)) ||
                  child.userData?.isPlayer
                ) {
                  return;
                }
                currentHits.add(child);
              }
            });
          }
        }

        this.cachedCurrentHits = currentHits;
      }

      // 1. Instantly fade newly occluding meshes down to 0.18
      for (const mesh of this.cachedCurrentHits) {
        if (!mesh || !mesh.parent || !mesh.material) continue;
        if (
          (p1 && (mesh === p1.mesh || mesh === p1.spriteMesh || mesh.userData?.isPlayer)) ||
          (p2 && (mesh === p2.mesh || mesh === p2.spriteMesh || mesh.userData?.isPlayer)) ||
          mesh.userData?.isPlayer
        ) {
          continue;
        }

        if (!this.fadedMeshes.has(mesh)) {
          mesh.userData.__origMaterial = mesh.material;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => {
              const c = m.clone();
              c.transparent = true;
              c.opacity = 0.18;
              c.depthWrite = false;
              return c;
            });
          } else if (mesh.material) {
            const c = (mesh.material as THREE.Material).clone();
            c.transparent = true;
            c.opacity = 0.18;
            (c as any).depthWrite = false;
            mesh.material = c;
          }
          this.fadedMeshes.add(mesh);
        } else {
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => { m.opacity = 0.18; });
          } else if (mat) {
            mat.opacity = 0.18;
          }
        }
      }

      // 2. Restore meshes that are no longer occluding smoothly to 1.0
      for (const mesh of Array.from(this.fadedMeshes)) {
        if (!mesh || !mesh.parent || !mesh.material) {
          this.fadedMeshes.delete(mesh);
          continue;
        }

        if (
          (p1 && (mesh === p1.mesh || mesh === p1.spriteMesh || mesh.userData?.isPlayer)) ||
          (p2 && (mesh === p2.mesh || mesh === p2.spriteMesh || mesh.userData?.isPlayer)) ||
          mesh.userData?.isPlayer
        ) {
          this.fadedMeshes.delete(mesh);
          if (mesh.userData.__origMaterial) {
            mesh.material = mesh.userData.__origMaterial;
            delete mesh.userData.__origMaterial;
          }
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => { m.opacity = 1.0; (m as any).depthWrite = true; });
          } else if (mesh.material) {
            mesh.material.opacity = 1.0;
            (mesh.material as any).depthWrite = true;
          }
          continue;
        }

        if (!this.cachedCurrentHits.has(mesh)) {
          let isDone = false;
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              m.opacity = Math.min(1.0, m.opacity + delta * 5.0);
              if (m.opacity >= 0.99) isDone = true;
            });
          } else if (mat) {
            mat.opacity = Math.min(1.0, mat.opacity + delta * 5.0);
            if (mat.opacity >= 0.99) isDone = true;
          } else {
            isDone = true;
          }

          if (isDone) {
            if (mesh.userData.__origMaterial) {
              const cloned = mesh.material;
              mesh.material = mesh.userData.__origMaterial;
              delete mesh.userData.__origMaterial;
              if (Array.isArray(cloned)) {
                cloned.forEach((m) => m.dispose());
              } else if (cloned) {
                cloned.dispose();
              }
            }
            this.fadedMeshes.delete(mesh);
          }
        }
      }
    } catch (err) {
      console.warn('[CameraRig] updateOcclusion caught error:', err);
    }

    // Force Player meshes visible at end of pass as well
    if (p1) {
      if (p1.mesh) p1.mesh.visible = true;
      if (p1.spriteMesh) {
        p1.spriteMesh.visible = true;
        if (p1.spriteMesh.material) (p1.spriteMesh.material as THREE.Material).opacity = 1.0;
      }
      if ((p1.mesh as any)?.material) (p1.mesh as any).material.opacity = 1.0;
    }
    if (p2) {
      if (p2.mesh) p2.mesh.visible = true;
      if (p2.spriteMesh) {
        p2.spriteMesh.visible = true;
        if (p2.spriteMesh.material) (p2.spriteMesh.material as THREE.Material).opacity = 1.0;
      }
      if ((p2.mesh as any)?.material) (p2.mesh as any).material.opacity = 1.0;
    }
  }

  public clearOcclusion(): void {
    this.cachedOccluders = [];
    this.cachedCurrentHits.clear();
    for (const mesh of this.fadedMeshes) {
      if (mesh.userData.__origMaterial) {
        const cloned = mesh.material;
        mesh.material = mesh.userData.__origMaterial;
        delete mesh.userData.__origMaterial;
        if (Array.isArray(cloned)) {
          cloned.forEach((m) => m.dispose());
        } else if (cloned) {
          cloned.dispose();
        }
      } else {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => { m.opacity = 1.0; (m as any).depthWrite = true; });
        } else if (mesh.material) {
          mesh.material.opacity = 1.0;
          (mesh.material as any).depthWrite = true;
        }
      }
    }
    this.fadedMeshes.clear();
  }
}

import * as THREE from 'three';
import type { Level } from '../world/Level.ts';
import type { CameraRig } from '../engine/CameraRig.ts';
import { GRID_CELL_SIZE } from '../world/BlockFactory.ts';
import { voiceManager } from '../audio/VoiceManager.ts';
import { resolveAssetPath } from '../utils/assetPath.ts';

export interface PlayerOptions {
  id?: 'p1' | 'p2';
  color?: THREE.ColorRepresentation;
  initialPosition?: THREE.Vector3;
  speed?: number;
  texturePath?: string;
  characterName?: string;
  jointOffset?: THREE.Vector3;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
}

function createPlaceholderTexture(name: string, colorHex: string): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([50, 50, 60, 255]);
    const dt = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    dt.needsUpdate = true;
    return dt as unknown as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Semi-transparent dark card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 304, 16);
    ctx.fill();

    // Player color border
    ctx.lineWidth = 6;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    // Circular avatar badge
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(128, 85, 42, 0, Math.PI * 2);
    ctx.fill();

    // Initial letter in avatar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), 128, 85);

    // Full character name
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.fillText(name, 128, 175);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('Bilbao Explorer', 128, 210);

    // Glowing joint placeholder illustration at bottom
    ctx.fillStyle = '#78350f';
    ctx.fillRect(90, 248, 60, 8);
    ctx.fillStyle = '#ff4500';
    ctx.beginPath();
    ctx.arc(152, 252, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(152, 252, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Player {
  public readonly id: 'p1' | 'p2';
  public readonly mesh: THREE.Group;
  public readonly position: THREE.Vector3;
  public speed: number = 8.0;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public velocityY: number = 0;
  public isGrounded: boolean = true;
  public stunDuration: number = 0;
  public speedMultiplier: number = 1.0;
  public hasRelic: boolean = false;
  public isSitting: boolean = false;
  public isChilling: boolean = false;
  public customFacingAngle?: number;
  private lastRelicRejectTime: number = 0;

  public static onStunOccurred?: () => void;

  public rejectRelic(): void {
    const now = performance.now() / 1000;
    if (now - this.lastRelicRejectTime > 2.5) {
      this.lastRelicRejectTime = now;
      // Character-specific lines per VOICE_SCRIPTS.md (relic_reject)
      const quote = this.id === 'p2' ? 'Már van nálam egy, szedd fel te!' : 'Ezt nem tudom felvenni, ez a tiéd!';
      this.say(quote, 2.8, 'relic_reject');
    }
  }

  // 2.5D Billboard Sprite & Animation Elements
  public readonly billboardGroup: THREE.Group;
  public readonly spriteMesh: THREE.Mesh;
  public readonly texturePath: string;
  public readonly characterName: string;
  public readonly jointOffset: THREE.Vector3;

  public resetState(spawnPosition?: THREE.Vector3): void {
    this.hasRelic = false;
    this.isSitting = false;
    this.isChilling = false;
    this.customFacingAngle = undefined;
    this.velocity.set(0, 0, 0);
    this.velocityY = 0;
    this.stunDuration = 0;
    this.isGrounded = true;
    this.speedMultiplier = 1.0;
    if (spawnPosition) {
      this.position.copy(spawnPosition);
    }
    this.mesh.visible = true;
    if (this.billboardGroup) {
      this.billboardGroup.visible = true;
      this.billboardGroup.rotation.z = 0;
    }
    if (this.spriteMesh) {
      this.spriteMesh.visible = true;
      this.spriteMesh.position.y = 0;
      this.spriteMesh.scale.set(1.0, 1.0, 1.0);
      if (this.spriteMesh.material) {
        const mat = this.spriteMesh.material as THREE.MeshBasicMaterial;
        mat.transparent = true;
        mat.opacity = 1.0;
        mat.depthWrite = true;
        mat.needsUpdate = true;
      }
    }
  }

  public setSitting(sitting: boolean, facingAngle?: number): void {
    this.isSitting = sitting;
    this.velocity.set(0, 0, 0);
    this.velocityY = 0;
    this.customFacingAngle = facingAngle;
    if (sitting) {
      this.spriteMesh.position.y = -0.42;
      this.spriteMesh.scale.set(1.0, 0.78, 1.0);
      if (facingAngle !== undefined) {
        this.billboardGroup.rotation.y = facingAngle;
      }
    } else {
      this.spriteMesh.position.y = 0;
      this.spriteMesh.scale.set(1.0, 1.0, 1.0);
    }
  }

  /**
   * Wall Chill Mode:
   * Relaxes player at retaining wall base, locks locomotion, applies wall-leaning tilt,
   * and prepares intense joint smoke puffs.
   */
  public setChillMode(active: boolean, seatPosition?: THREE.Vector3, wallAngle?: number): void {
    this.isChilling = active;
    this.isSitting = active;
    this.velocity.set(0, 0, 0);
    this.velocityY = 0;
    this.customFacingAngle = wallAngle;
    if (active) {
      if (seatPosition) {
        this.position.copy(seatPosition);
      }
      this.spriteMesh.position.y = -0.42;
      this.spriteMesh.scale.set(1.0, 0.78, 1.0);
      this.billboardGroup.rotation.z = this.id === 'p1' ? -0.08 : 0.08;
      if (wallAngle !== undefined) {
        this.billboardGroup.rotation.y = wallAngle;
      }
    } else {
      this.billboardGroup.rotation.z = 0;
      this.spriteMesh.position.y = 0;
      this.spriteMesh.scale.set(1.0, 1.0, 1.0);
      this.customFacingAngle = undefined;
    }
  }

  public isDialogueFaded: boolean = false;

  public setDialogueFade(faded: boolean): void {
    this.isDialogueFaded = faded;
    this.mesh.visible = !faded;
    if (this.billboardGroup) this.billboardGroup.visible = !faded;
    if (this.spriteMesh) {
      this.spriteMesh.visible = !faded;
      if (this.spriteMesh.material) {
        const mat = this.spriteMesh.material as THREE.MeshBasicMaterial;
        mat.transparent = true;
        mat.opacity = faded ? 0.0 : 1.0;
        mat.depthWrite = !faded;
        mat.needsUpdate = true;
      }
    }
    this.billboardGroup.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach((m) => {
            m.transparent = true;
            m.opacity = faded ? 0.0 : 1.0;
            m.needsUpdate = true;
          });
        } else {
          c.material.transparent = true;
          c.material.opacity = faded ? 0.0 : 1.0;
          c.material.needsUpdate = true;
        }
      }
    });
  }

  private walkTime: number = 0;
  private idleTime: number = 0;
  private fxTime: number = 0;
  private lastCamera: THREE.Camera | null = null;

  // Glowing Joint & Smoke Particle FX
  private emberMesh: THREE.Mesh;
  private emberMaterial: THREE.MeshStandardMaterial;
  private emberLight: THREE.PointLight;
  private smokeGroup: THREE.Group;
  private smokePuffs: SmokePuff[] = [];
  private smokeSpawnTimer: number = 0;

  // Optional tether visual mesh reference (hidden)
  public tetherLineMesh: THREE.Mesh | null = null;
  public static tetherLineMesh: THREE.Object3D | null = null;

  // Screen-Space DOM Speech Bubble (Immune to WebGL post-process shaders)
  private static domOverlayContainer: HTMLDivElement | null = null;
  private domBubble: HTMLDivElement | null = null;
  private domBubbleText: HTMLSpanElement | null = null;
  private speechTimer: number = 0;
  private playerColorHex: string = '#38bdf8';

  constructor(
    colorOrOptions: THREE.ColorRepresentation | PlayerOptions,
    initialPosition?: THREE.Vector3,
    speed = 8.0
  ) {
    let color: THREE.ColorRepresentation = 0x3b82f6;
    let startPos = initialPosition ?? new THREE.Vector3(0, 0, 0);
    let playerSpeed = speed;
    let customId: 'p1' | 'p2' | undefined;
    let customTexture: string | undefined;
    let customName: string | undefined;
    let customJointOffset: THREE.Vector3 | undefined;

    if (typeof colorOrOptions === 'object' && !(colorOrOptions instanceof THREE.Color) && 'color' in colorOrOptions) {
      if (colorOrOptions.id) customId = colorOrOptions.id;
      if (colorOrOptions.color !== undefined) color = colorOrOptions.color;
      if (colorOrOptions.initialPosition) startPos = colorOrOptions.initialPosition;
      if (colorOrOptions.speed !== undefined) playerSpeed = colorOrOptions.speed;
      customTexture = colorOrOptions.texturePath;
      customName = colorOrOptions.characterName;
      customJointOffset = colorOrOptions.jointOffset;
    } else if (typeof colorOrOptions === 'number' || colorOrOptions instanceof THREE.Color || typeof colorOrOptions === 'string') {
      color = colorOrOptions;
    }

    this.speed = playerSpeed;
    const threeColor = new THREE.Color(color);
    this.playerColorHex = '#' + threeColor.getHexString();

    // Distinguish Player 1 (Viki) vs Player 2 (Kristóf) based on options or color
    const isP2 = customId === 'p2' || this.playerColorHex.toLowerCase().includes('ef4444') || customName === 'Kristóf';
    this.id = customId ?? (isP2 ? 'p2' : 'p1');
    this.characterName = customName ?? (isP2 ? 'Kristóf' : 'Viki');
    this.texturePath = customTexture ? resolveAssetPath(customTexture) : resolveAssetPath(isP2 ? '/textures/player2_kristof.png' : '/textures/player1_viki.png');

    // Joint tip position on sprite: mouth offset in local billboard coordinates
    // Viki: mouth anchor at (x: 0.1, y: 1.15, z: 0.05)
    // Kristóf: mouth anchor at (x: 0.2, y: 1.05, z: 0.05)
    this.jointOffset = customJointOffset ?? (isP2
      ? new THREE.Vector3(0.2, 1.05, 0.05)
      : new THREE.Vector3(0.1, 1.15, 0.05));

    // Root Group
    this.mesh = new THREE.Group();
    this.mesh.userData.isPlayer = true;
    this.mesh.position.copy(startPos);
    this.position = this.mesh.position;

    // Billboard Group: Always oriented towards the camera on the Y-axis
    this.billboardGroup = new THREE.Group();
    this.billboardGroup.userData.isPlayer = true;
    this.mesh.add(this.billboardGroup);

    // 1. Illustrated Sprite Plane: width 1.6m, height 2.0m, bottom anchored at Y=0
    const spriteGeometry = new THREE.PlaneGeometry(1.6, 2.0);
    spriteGeometry.translate(0, 1.0, 0); // Ground feet at Y=0

    // Robust Fallback Texture: clean 2D placeholder card rendered immediately
    const fallbackTexture = createPlaceholderTexture(this.characterName, this.playerColorHex);

    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: fallbackTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    spriteMaterial.needsUpdate = true;

    // Asynchronously load custom illustrated art
    if (typeof document !== 'undefined') {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        this.texturePath,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          spriteMaterial.map = loadedTex;
          spriteMaterial.transparent = true;
          spriteMaterial.opacity = 1.0;
          spriteMaterial.depthWrite = true;
          spriteMaterial.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`[Player] Using fallback card for ${this.characterName}, failed to load '${this.texturePath}':`, err);
        }
      );
    }

    this.spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
    this.spriteMesh.userData.isPlayer = true;
    this.spriteMesh.castShadow = true;
    this.spriteMesh.receiveShadow = false;
    this.spriteMesh.renderOrder = 10;
    this.billboardGroup.add(this.spriteMesh);
    (this.mesh as any).material = spriteMaterial;

    // 2. Glowing Joint Particle FX:
    // Red/orange glowing emissive sphere (radius: 0.04m, emissive 0xff3b00)
    const emberGeometry = new THREE.SphereGeometry(0.04, 10, 10);
    this.emberMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff3b00,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.0,
    });
    this.emberMesh = new THREE.Mesh(emberGeometry, this.emberMaterial);
    this.emberMesh.renderOrder = 998;
    this.emberMesh.position.copy(this.jointOffset);
    this.spriteMesh.add(this.emberMesh);

    // PointLight at the ember (small pulsing orange ember: 0xff3b00, intensity: 0.8, distance: 1.2m)
    this.emberLight = new THREE.PointLight(0xff3b00, 0.8, 1.2);
    this.emberLight.position.copy(this.jointOffset);
    this.spriteMesh.add(this.emberLight);

    // Intermittent Smoke Puffs pool (translucent rising gray quads)
    this.smokeGroup = new THREE.Group();
    this.smokeGroup.renderOrder = 999;
    this.spriteMesh.add(this.smokeGroup);

    const smokeQuadGeo = new THREE.PlaneGeometry(0.09, 0.09);
    for (let i = 0; i < 12; i++) {
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const puffMesh = new THREE.Mesh(smokeQuadGeo, smokeMat);
      puffMesh.renderOrder = 999;
      puffMesh.visible = false;
      this.smokeGroup.add(puffMesh);

      this.smokePuffs.push({
        mesh: puffMesh,
        material: smokeMat,
        life: 0,
        maxLife: 1.0,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 1.0,
      });
    }

    this.initDomSpeechBubble();
  }

  private static getDomOverlayContainer(): HTMLDivElement {
    if (!Player.domOverlayContainer && typeof document !== 'undefined') {
      let container = document.getElementById('speech-bubble-overlay') as HTMLDivElement;
      if (!container) {
        container = document.createElement('div');
        container.id = 'speech-bubble-overlay';
        container.style.cssText = `
          position: fixed;
          inset: 0;
          pointer-events: none;
          user-select: none;
          z-index: 9999;
          overflow: hidden;
        `;
        document.body.appendChild(container);
      }
      Player.domOverlayContainer = container;
    }
    return Player.domOverlayContainer!;
  }

  private initDomSpeechBubble(): void {
    if (typeof document === 'undefined') return;

    const container = Player.getDomOverlayContainer();
    this.domBubble = document.createElement('div');
    this.domBubble.className = 'player-speech-bubble';
    this.domBubble.style.cssText = `
      position: fixed;
      transform: translate(-50%, -100%);
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid ${this.playerColorHex};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 14px;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s ease;
      display: none;
      z-index: 9999;
    `;

    this.domBubbleText = document.createElement('span');
    this.domBubble.appendChild(this.domBubbleText);

    // Downward triangle caret pointer
    const caretBorder = document.createElement('div');
    caretBorder.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-top: 8px solid ${this.playerColorHex};
    `;
    const caretInner = document.createElement('div');
    caretInner.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid rgba(15, 23, 42, 0.95);
    `;
    this.domBubble.appendChild(caretBorder);
    this.domBubble.appendChild(caretInner);
    container.appendChild(this.domBubble);
  }

  /**
   * Display an overhead screen-space speech bubble above the player's head.
   */
  /**
   * Show an overhead subtitle bubble, optionally paired with a recorded voice line.
   * @param voiceClipId Optional clip id from VOICE_SCRIPTS.md, e.g. 'relic_pickup'. Resolves
   * to public/audio/voice/{viki|kristof}/{voiceClipId}.mp3 based on this player's character.
   * Missing/not-yet-recorded clips fail silently (VoiceManager's zero-crash fallback) — the
   * subtitle always shows regardless of whether the audio file exists on disk.
   */
  public say(message: string, durationSec = 3.0, voiceClipId?: string): void {
    if (!message || message.trim() === '' || durationSec <= 0) {
      this.speechTimer = 0;
      if (this.domBubble) {
        this.domBubble.style.display = 'none';
        this.domBubble.style.opacity = '0';
      }
      if (this.domBubbleText) {
        this.domBubbleText.textContent = '';
      }
      return;
    }
    this.speechTimer = durationSec;
    if (this.domBubble && this.domBubbleText) {
      this.domBubbleText.textContent = message;
      this.domBubble.style.display = 'block';
      this.domBubble.style.opacity = '1';
    }
    if (voiceClipId) {
      const character = this.id === 'p2' ? 'kristof' : 'viki';
      voiceManager.playCharacterClip(character, voiceClipId).catch(() => {});
    }
  }

  /**
   * Update 2D screen coordinate projection for the DOM speech bubble.
   */
  public updateScreenPosition(camera: THREE.Camera): void {
    if (!this.mesh || !this.mesh.parent || !this.billboardGroup || !camera) return;
    this.lastCamera = camera;

    // Billboard orientation update ensures proper facing even when paused or in menu
    const dx = camera.position.x - this.position.x;
    const dz = camera.position.z - this.position.z;
    const camAngle = Math.atan2(dx, dz);
    this.billboardGroup.rotation.y = camAngle;

    if (!this.domBubble) return;
    if (this.speechTimer <= 0) {
      this.domBubble.style.display = 'none';
      return;
    }

    // Head position is above the 2.0m sprite
    const headPos = this.position.clone();
    headPos.y += 2.15;
    headPos.project(camera);

    if (headPos.z > 1.0) {
      this.domBubble.style.display = 'none';
      return;
    }

    const screenX = (headPos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(headPos.y * 0.5) + 0.5) * window.innerHeight;

    this.domBubble.style.display = 'block';
    this.domBubble.style.left = `${screenX}px`;
    this.domBubble.style.top = `${screenY - 12}px`;
  }

  public jump(): void {
    if (this.stunDuration > 0) return;
    if (this.isGrounded) {
      this.velocityY = 5.5; // Jump physics: velocityY = 5.5 m/s
      this.isGrounded = false;
    }
  }

  public applyStun(duration: number): void {
    if (this.stunDuration <= 0 && duration > 0) {
      Player.onStunOccurred?.();
    }
    this.stunDuration = Math.max(this.stunDuration, duration);
  }

  public applyKnockback(impulse: THREE.Vector3): void {
    this.velocity.add(impulse);
  }

  public isStunned(): boolean {
    return this.stunDuration > 0;
  }

  /**
   * Spawn a rising smoke puff from the burning joint ember.
   */
  private spawnSmokePuff(): void {
    const puff = this.smokePuffs.find((p) => !p.mesh.visible);
    if (!puff) return;

    puff.life = 0;
    puff.maxLife = 1.1 + Math.random() * 0.5;
    puff.mesh.visible = true;
    puff.mesh.position.set(
      this.jointOffset.x + (Math.random() - 0.5) * 0.02,
      this.jointOffset.y + (Math.random() - 0.5) * 0.02,
      this.jointOffset.z + 0.01
    );
    // Drift gently rightward and upward
    puff.vx = 0.06 + Math.random() * 0.06;
    puff.vy = (this.isChilling ? 0.22 : 0.32) + Math.random() * 0.14;
    puff.vz = (Math.random() - 0.5) * 0.03;
    puff.baseScale = (this.isChilling ? 1.5 : 0.8) + Math.random() * 0.4;
    puff.material.opacity = this.isChilling ? 0.75 : 0.55;
    puff.mesh.scale.setScalar(puff.baseScale);
  }

  /**
   * Update joint ember glow pulsation and active smoke puffs.
   */
  private updateJointFX(delta: number): void {
    this.fxTime += delta;

    // Glowing ember breathing pulse
    const pulseSpeed = this.isChilling ? 3.5 : 7.0;
    const pulse = 0.8 + Math.sin(this.fxTime * pulseSpeed) * (this.isChilling ? 0.45 : 0.35);
    this.emberMaterial.emissiveIntensity = (this.isChilling ? 2.5 : 1.8) * pulse;
    this.emberLight.intensity = (this.isChilling ? 1.3 : 0.8) * pulse;
    this.emberMesh.scale.setScalar(0.85 + pulse * 0.25);

    // Intermittent smoke puffs (every ~0.18s when chilling, ~0.35s normal)
    this.smokeSpawnTimer += delta;
    const spawnThreshold = this.isChilling ? 0.18 : 0.35;
    if (this.smokeSpawnTimer > spawnThreshold) {
      this.smokeSpawnTimer = 0;
      this.spawnSmokePuff();
    }

    // Update active smoke puffs
    for (const puff of this.smokePuffs) {
      if (!puff.mesh.visible) continue;

      puff.life += delta;
      if (puff.life >= puff.maxLife) {
        puff.mesh.visible = false;
        continue;
      }

      const progress = puff.life / puff.maxLife;
      puff.mesh.position.x += (puff.vx + Math.sin(puff.life * 4.0) * 0.03) * delta;
      puff.mesh.position.y += puff.vy * delta;
      puff.mesh.position.z += puff.vz * delta;

      const scale = puff.baseScale * (1.0 + progress * 2.2);
      puff.mesh.scale.set(scale, scale, 1.0);
      puff.material.opacity = Math.max(0, (1.0 - progress) * (this.isChilling ? 0.75 : 0.55));
    }
  }

  public update(
    delta: number,
    moveInput: { x: number; y: number } = { x: 0, y: 0 },
    cameraRig?: CameraRig,
    level?: Level,
    jumpRequested = false
  ): void {
    if (this.isChilling) {
      moveInput = { x: 0, y: 0 };
    }
    if (this.isDialogueFaded) {
      this.mesh.visible = false;
      if (this.billboardGroup) this.billboardGroup.visible = false;
      if (this.spriteMesh) this.spriteMesh.visible = false;
    } else {
      this.mesh.visible = true;
      if (this.billboardGroup) this.billboardGroup.visible = true;
      if (this.spriteMesh) this.spriteMesh.visible = true;
    }

    // 0. Process DOM Speech Bubble Timer
    if (this.speechTimer > 0) {
      this.speechTimer -= delta;
      if (this.speechTimer <= 0 && this.domBubble) {
        this.domBubble.style.opacity = '0';
        setTimeout(() => {
          if (this.speechTimer <= 0 && this.domBubble) {
            this.domBubble.style.display = 'none';
          }
        }, 200);
      }
    }

    // 1. Process Stun Duration
    if (this.stunDuration > 0) {
      this.stunDuration -= delta;
      moveInput = { x: 0, y: 0 };
    }

    // 2. Jump / Unstuck Physics
    if (jumpRequested) {
      this.jump();
    }

    // 3. Apply Velocity Impulse with Exponential Friction Damping
    if (this.velocity.lengthSq() > 0.0001) {
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.velocity.multiplyScalar(Math.exp(-6.0 * delta));
    }

    let rig: CameraRig | undefined;
    let lvl: Level | undefined = level;

    if (cameraRig && typeof (cameraRig as any).transformInput === 'function') {
      rig = cameraRig;
    } else if (cameraRig && typeof (cameraRig as any).getElevationAt === 'function') {
      lvl = cameraRig as unknown as Level;
    }

    let worldMoveX = moveInput.x;
    let worldMoveZ = moveInput.y;

    if (rig) {
      const transformed = rig.transformInput(moveInput);
      worldMoveX = transformed.x;
      worldMoveZ = transformed.z;
    }

    const moveLen = Math.hypot(worldMoveX, worldMoveZ);
    if (moveLen > 0.001 && this.stunDuration <= 0 && !this.isSitting) {
      // Update position along XZ plane with speed multiplier
      const effectiveSpeed = this.speed * this.speedMultiplier;
      this.position.x += worldMoveX * effectiveSpeed * delta;
      this.position.z += worldMoveZ * effectiveSpeed * delta;
    }

    // 4. Billboard Behavior: Rotate mesh towards camera orientation or fixed facing angle
    if (this.isSitting && this.customFacingAngle !== undefined) {
      this.billboardGroup.rotation.y = this.customFacingAngle;
    } else {
      const cam = cameraRig?.camera ?? this.lastCamera;
      if (cam) {
        this.lastCamera = cam;
        const dx = cam.position.x - this.position.x;
        const dz = cam.position.z - this.position.z;
        const camAngle = Math.atan2(dx, dz);
        this.billboardGroup.rotation.y = camAngle;
      }
    }

    // 5. Expressive Walking, Idle, and Sitting Animation:
    if (this.isSitting) {
      this.idleTime += delta;
      this.spriteMesh.rotation.z = 0;
      this.spriteMesh.position.y = -0.42;
      this.spriteMesh.scale.set(1.0, 0.78 + Math.sin(this.idleTime * 2.0) * 0.02, 1.0);
    } else {
      const isMoving = this.velocity.lengthSq() > 0.05 || (moveLen > 0.05 && this.stunDuration <= 0);
      if (isMoving) {
        this.walkTime += delta;
        this.spriteMesh.rotation.z = Math.sin(this.walkTime * 14.0) * 0.12;
        this.spriteMesh.position.y = Math.abs(Math.sin(this.walkTime * 14.0)) * 0.15;
        this.spriteMesh.scale.set(1.0, 1.0, 1.0);
      } else {
        this.idleTime += delta;
        this.spriteMesh.rotation.z = 0;
        this.spriteMesh.position.y = 0;
        this.spriteMesh.scale.set(1.0, 1.0 + Math.sin(this.idleTime * 3.0) * 0.03, 1.0);
      }
    }

    // 6. Update Glowing Joint & Smoke Particle FX
    this.updateJointFX(delta);

    if (lvl) {
      this.updateElevation(lvl, delta);
    }
  }

  public updateElevation(level: Level, delta: number): void {
    const groundY = level.getElevationAt(this.position.x, this.position.z, this.position.y);

    if (!this.isGrounded) {
      // Jump vertical physics: gravity = 16.0 m/s^2
      this.velocityY -= 16.0 * delta;
      this.position.y += this.velocityY * delta;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    } else {
      if (this.position.y < groundY) {
        this.position.y = groundY; // Instant step-up on solid terrain / platforms
      } else if (this.position.y > groundY + 0.08) {
        // Fall if terrain dropped away beneath player
        this.isGrounded = false;
        this.velocityY = 0;
      } else {
        this.position.y = groundY;
      }
    }
  }

  public static enforceTether(p1: Player, p2: Player, maxRadius = 16.0): void {
    const dx = p2.position.x - p1.position.x;
    const dz = p2.position.z - p1.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance > maxRadius && distance > 0.0001) {
      const excess = distance - maxRadius;
      const shiftScale = (excess * 0.5) / distance;
      const shiftX = dx * shiftScale;
      const shiftZ = dz * shiftScale;

      p1.position.x += shiftX;
      p1.position.z += shiftZ;

      p2.position.x -= shiftX;
      p2.position.z -= shiftZ;
    }
  }

  private checkCollisionAt(level: Level, x: number, z: number): boolean {
    return level.isSolidAtWorldPos(x, z, this.position.y);
  }

  public resolveCollisions(level: Level, prevPos: THREE.Vector3, radius = 0.32, delta = 0.016): void {
    // 1. Test X-axis movement independently against oldZ (smooth wall sliding along X)
    const testX = this.position.x;
    const oldZ = prevPos.z;

    const collidesX =
      this.checkCollisionAt(level, testX + radius, oldZ) ||
      this.checkCollisionAt(level, testX - radius, oldZ) ||
      this.checkCollisionAt(level, testX + radius, oldZ + radius * 0.7) ||
      this.checkCollisionAt(level, testX + radius, oldZ - radius * 0.7) ||
      this.checkCollisionAt(level, testX - radius, oldZ + radius * 0.7) ||
      this.checkCollisionAt(level, testX - radius, oldZ - radius * 0.7);

    if (collidesX) {
      this.position.x = prevPos.x;
    }

    // 2. Test Z-axis movement independently against resolved X (smooth wall sliding along Z)
    const currentX = this.position.x;
    const testZ = this.position.z;

    const collidesZ =
      this.checkCollisionAt(level, currentX, testZ + radius) ||
      this.checkCollisionAt(level, currentX, testZ - radius) ||
      this.checkCollisionAt(level, currentX + radius * 0.7, testZ + radius) ||
      this.checkCollisionAt(level, currentX - radius * 0.7, testZ + radius) ||
      this.checkCollisionAt(level, currentX + radius * 0.7, testZ - radius) ||
      this.checkCollisionAt(level, currentX - radius * 0.7, testZ - radius);

    if (collidesZ) {
      this.position.z = prevPos.z;
    }

    // 3. Hard-clamp player strictly inside playable level bounds
    const bounds = level.getPlayableBounds();
    const minX = bounds.minX * GRID_CELL_SIZE + 0.3;
    const maxX = bounds.maxX * GRID_CELL_SIZE - 0.3;
    const minZ = bounds.minZ * GRID_CELL_SIZE + 0.3;
    const maxZ = bounds.maxZ * GRID_CELL_SIZE - 0.3;
    this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
    this.position.z = Math.max(minZ, Math.min(maxZ, this.position.z));

    // 4. Smooth vertical elevation tracking and jump physics
    this.updateElevation(level, delta);
  }
}

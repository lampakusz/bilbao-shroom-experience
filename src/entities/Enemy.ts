import * as THREE from 'three';
import { EnemyType, type EnemyConfig } from './EnemyTypes.ts';
import type { Player } from './Player.ts';
import type { AudioManager } from '../audio/AudioManager.ts';
import type { PostProcessManager } from '../engine/PostProcessManager.ts';
import type { CameraRig } from '../engine/CameraRig.ts';
import { falloutDialogue, type DialogueChoice } from '../ui/FalloutDialogue.ts';
import {
  type NpcSpeechBubble,
  createNpcSpeechBubble,
  showNpcSpeech,
  hideNpcSpeech,
  updateNpcSpeechPosition,
  destroyNpcSpeechBubble,
} from '../ui/NpcSpeechOverlay.ts';
import { InputManager } from '../engine/InputManager.ts';
import { gameState } from '../engine/GameState.ts';
import { resolveAssetPath } from '../utils/assetPath.ts';

function showGameToast(message: string): void {
  if (typeof document === 'undefined') return;
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 3200);
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  currentRadius: number;
  maxRadius: number;
  lifetime: number;
  maxLifetime: number;
  hitPlayers: Set<Player>;
}

export class Enemy {
  public readonly type: EnemyType;
  public readonly config: EnemyConfig;
  public readonly mesh: THREE.Group;

  public state: 'idle' | 'patrol' | 'attack' | 'alert' | 'cooldown' = 'idle';
  public facingAngle: number = 0;
  public isPacified: boolean = false;

  // Timers & Cooldowns
  private timer = 0;
  private attackCooldown = 0;

  // Type specific components
  // Dog
  private latchedPlayer: Player | null = null;
  private dogLegs: THREE.Mesh[] = [];
  private dogTail?: THREE.Mesh;
  private patrolDirection = 1; // 1 = to target, -1 = to spawn

  // Granny
  private shockwaves: ShockwaveRing[] = [];
  private caneMesh?: THREE.Mesh;

  // Cashier
  private visionConeMesh?: THREE.Mesh;
  private cashierAlertTimer = 0;

  // Passenger
  private static lastPassengerParanoiaSoundTime = 0;
  private paranoiaAuraMesh?: THREE.Mesh;
  private paranoiaCooldown = 0;

  // Beach Walker
  private walkerLegs: THREE.Mesh[] = [];
  private walkerDialogueCooldown = 0;
  private walkerWhisperCooldown = 0;
  private walkerWalkTime = 0;
  private walkerPatrolDirection = 1;
  private walkerCurrentWaypointIdx = 0;

  // Vagrant (Gorka)
  private vagrantPromptBubble?: NpcSpeechBubble;
  private vagrantDialogueCooldown = 0;
  private vagrantSmokeParticles: THREE.Mesh[] = [];
  private vagrantEmberLight?: THREE.PointLight;

  // Screen-Space DOM Speech Bubble (Bypasses WebGL trip/wobble shader)
  private speechBubble?: NpcSpeechBubble;
  private speechTimer = 0;

  private static readonly BEACH_QUOTES = [
    'Mit bámulnak ezek ketten?',
    'Jézusom, tiszta vörös a szemük...',
    'Hú, ezek nagyon nincsenek itt fejben.',
    'Mióta állnak ott és néznek rám?',
  ];

  constructor(config: EnemyConfig) {
    this.type = config.type;
    this.config = config;
    this.facingAngle = config.facingAngle ?? 0;

    this.mesh = new THREE.Group();
    this.mesh.position.set(config.spawnPos[0], config.spawnPos[1], config.spawnPos[2]);
    this.mesh.rotation.y = this.facingAngle;

    this.buildMesh();
  }

  private buildMesh(): void {
    switch (this.type) {
      case EnemyType.GRANNY:
        this.buildGranny();
        break;
      case EnemyType.DOG:
        this.buildDog();
        break;
      case EnemyType.CASHIER:
        this.buildCashier();
        break;
      case EnemyType.PASSENGER:
        this.buildPassenger();
        break;
      case EnemyType.NPC_BEACH_WALKER:
        this.buildBeachWalker();
        break;
      case EnemyType.NPC_VAGRANT:
        this.buildVagrant();
        break;
    }
  }

  // ==========================================================================
  // 1. GRANNY (Nagymama) MESH
  // ==========================================================================
  private buildGranny(): void {
    // 1. Long robe / cardigan skirt (tapered cylinder)
    const skirtGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.0, 16);
    skirtGeo.translate(0, 0.5, 0);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed, // Purple cardigan
      roughness: 0.8,
      metalness: 0.1,
    });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    this.mesh.add(skirt);

    // 2. Torso with knit shawl
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.6, 16);
    torsoGeo.translate(0, 1.25, 0);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.7,
      metalness: 0.1,
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.castShadow = true;
    this.mesh.add(torso);

    // 3. Head
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    headGeo.translate(0, 1.7, 0);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfed7aa,
      roughness: 0.6,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    this.mesh.add(head);

    // 4. Gray bun hair
    const bunGeo = new THREE.SphereGeometry(0.16, 12, 12);
    bunGeo.translate(0, 1.88, -0.12);
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Gray hair
      roughness: 0.9,
    });
    const bun = new THREE.Mesh(bunGeo, hairMat);
    bun.castShadow = true;
    this.mesh.add(bun);

    // 5. Angry glasses / brow ridge
    const glassesGeo = new THREE.BoxGeometry(0.28, 0.08, 0.08);
    glassesGeo.translate(0, 1.74, 0.22);
    const glassesMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    this.mesh.add(glasses);

    // 6. Walking wooden cane in hand
    const caneGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
    caneGeo.translate(0.4, 0.55, 0.3);
    const caneMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Dark wood
      roughness: 0.7,
    });
    this.caneMesh = new THREE.Mesh(caneGeo, caneMat);
    this.caneMesh.castShadow = true;
    this.mesh.add(this.caneMesh);
  }

  // ==========================================================================
  // 2. DOG (Kutya) MESH
  // ==========================================================================
  private buildDog(): void {
    const dogMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Warm golden brown
      roughness: 0.75,
      metalness: 0.1,
    });

    // 1. Torso body
    const bodyGeo = new THREE.BoxGeometry(0.42, 0.35, 0.75);
    bodyGeo.translate(0, 0.45, 0);
    const body = new THREE.Mesh(bodyGeo, dogMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // 2. Head & Snout
    const headGeo = new THREE.BoxGeometry(0.3, 0.28, 0.35);
    headGeo.translate(0, 0.65, 0.42);
    const head = new THREE.Mesh(headGeo, dogMat);
    head.castShadow = true;
    this.mesh.add(head);

    const snoutGeo = new THREE.BoxGeometry(0.18, 0.14, 0.2);
    snoutGeo.translate(0, 0.6, 0.62);
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    this.mesh.add(snout);

    // Nose tip
    const noseGeo = new THREE.BoxGeometry(0.08, 0.06, 0.06);
    noseGeo.translate(0, 0.64, 0.73);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    this.mesh.add(nose);

    // 3. Ears
    const earGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    const leftEar = new THREE.Mesh(earGeo, dogMat);
    leftEar.position.set(0.12, 0.82, 0.38);
    leftEar.rotation.z = -0.25;
    this.mesh.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, dogMat);
    rightEar.position.set(-0.12, 0.82, 0.38);
    rightEar.rotation.z = 0.25;
    this.mesh.add(rightEar);

    // 4. Four Legs (front-left, front-right, back-left, back-right)
    const legGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);
    const legPositions: Array<[number, number, number]> = [
      [0.15, 0.18, 0.25],   // FL
      [-0.15, 0.18, 0.25],  // FR
      [0.15, 0.18, -0.25],  // BL
      [-0.15, 0.18, -0.25], // BR
    ];
    this.dogLegs = [];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, dogMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      this.mesh.add(leg);
      this.dogLegs.push(leg);
    }

    // 5. Wagging Tail
    const tailGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.35, 6);
    tailGeo.translate(0, 0.18, 0);
    this.dogTail = new THREE.Mesh(tailGeo, dogMat);
    this.dogTail.position.set(0, 0.55, -0.38);
    this.dogTail.rotation.x = -0.65;
    this.mesh.add(this.dogTail);
  }

  // ==========================================================================
  // 3. CASHIER (Pénztáros) MESH
  // ==========================================================================
  private buildCashier(): void {
    // 1. Checkout Counter in front
    const counterGeo = new THREE.BoxGeometry(1.2, 0.85, 0.6);
    counterGeo.translate(0, 0.42, 0.4);
    const counterMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Gray counter
      roughness: 0.5,
      metalness: 0.2,
    });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.mesh.add(counter);

    // Cash Register Box on counter
    const regGeo = new THREE.BoxGeometry(0.35, 0.25, 0.3);
    regGeo.translate(0.2, 0.95, 0.35);
    const regMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const register = new THREE.Mesh(regGeo, regMat);
    this.mesh.add(register);

    // Beep Screen
    const screenGeo = new THREE.PlaneGeometry(0.16, 0.1);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0.2, 1.05, 0.51);
    this.mesh.add(screen);

    // 2. Cashier Body with Supermarket Vest
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.35, 1.2, 16);
    bodyGeo.translate(0, 0.6, -0.1);
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x059669, // Supermarket green apron
      roughness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeo, vestMat);
    body.castShadow = true;
    this.mesh.add(body);

    // 3. Head & Cap
    const headGeo = new THREE.SphereGeometry(0.23, 16, 16);
    headGeo.translate(0, 1.35, -0.1);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    this.mesh.add(head);

    const capGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
    capGeo.translate(0, 1.5, -0.08);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x047857 });
    const cap = new THREE.Mesh(capGeo, capMat);
    this.mesh.add(cap);

    // 4. Ground Vision Cone (60° arc, 4.0m radius projecting forward on the ground)
    this.buildVisionCone();
  }

  private buildVisionCone(): void {
    const fov = Math.PI / 3; // 60 degrees
    const radius = 4.0;
    const segments = 24;

    const coneShape = new THREE.Shape();
    coneShape.moveTo(0, 0);
    const startAngle = -fov / 2 + Math.PI / 2;
    const endAngle = fov / 2 + Math.PI / 2;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + ((endAngle - startAngle) * i) / segments;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      coneShape.lineTo(x, z);
    }
    coneShape.closePath();

    const coneGeo = new THREE.ShapeGeometry(coneShape);
    coneGeo.rotateX(Math.PI / 2); // Flat on ground

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.visionConeMesh = new THREE.Mesh(coneGeo, coneMat);
    this.visionConeMesh.position.set(0, 0.04, 0.4);
    this.mesh.add(this.visionConeMesh);
  }

  // ==========================================================================
  // 4. PASSENGER (Utas) MESH
  // ==========================================================================
  private buildPassenger(): void {
    // 1. Commuter Trenchcoat / Torso
    const coatGeo = new THREE.CylinderGeometry(0.35, 0.42, 1.3, 16);
    coatGeo.translate(0, 0.65, 0);
    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Dark slate overcoat
      roughness: 0.8,
      metalness: 0.1,
    });
    const coat = new THREE.Mesh(coatGeo, coatMat);
    coat.castShadow = true;
    coat.receiveShadow = true;
    this.mesh.add(coat);

    // Scarf / Collar
    const scarfGeo = new THREE.TorusGeometry(0.26, 0.08, 8, 16);
    scarfGeo.rotateX(Math.PI / 2);
    scarfGeo.translate(0, 1.25, 0);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x991b1b }); // Bordeaux red scarf
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    this.mesh.add(scarf);

    // 2. Head with Deadpan Stare
    const headGeo = new THREE.SphereGeometry(0.23, 16, 16);
    headGeo.translate(0, 1.5, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.castShadow = true;
    this.mesh.add(head);

    // Staring Eyes
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.08, 1.52, 0.21);
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    leftPupil.position.set(0.08, 1.52, 0.245);
    this.mesh.add(leftEye);
    this.mesh.add(leftPupil);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.08, 1.52, 0.21);
    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), pupilMat);
    rightPupil.position.set(-0.08, 1.52, 0.245);
    this.mesh.add(rightEye);
    this.mesh.add(rightPupil);

    // Briefcase at side
    const caseGeo = new THREE.BoxGeometry(0.12, 0.35, 0.45);
    caseGeo.translate(0.42, 0.35, 0.1);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
    const briefcase = new THREE.Mesh(caseGeo, caseMat);
    briefcase.castShadow = true;
    this.mesh.add(briefcase);

    // 3. Paranoia Aura (Faint pulsing purple circle on ground, 2.5m radius)
    const auraGeo = new THREE.RingGeometry(2.35, 2.5, 32);
    auraGeo.rotateX(-Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.paranoiaAuraMesh = new THREE.Mesh(auraGeo, auraMat);
    this.paranoiaAuraMesh.position.set(0, 0.03, 0);
    this.mesh.add(this.paranoiaAuraMesh);
  }

  // ==========================================================================
  // 5. BEACH WALKER (Strandoló) MESH
  // ==========================================================================
  private buildBeachWalker(): void {
    const swimwearColor = this.config.swimwearColor ?? 0x06b6d4;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const swimwearMat = new THREE.MeshStandardMaterial({ color: swimwearColor, roughness: 0.6 });

    // 1. Torso (lower = swimwear trunks, upper = sun-tanned bare chest)
    const trunksGeo = new THREE.BoxGeometry(0.44, 0.35, 0.28);
    trunksGeo.translate(0, 0.72, 0);
    const trunks = new THREE.Mesh(trunksGeo, swimwearMat);
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    this.mesh.add(trunks);

    const chestGeo = new THREE.BoxGeometry(0.42, 0.45, 0.26);
    chestGeo.translate(0, 1.1, 0);
    const chest = new THREE.Mesh(chestGeo, skinMat);
    chest.castShadow = true;
    chest.receiveShadow = true;
    this.mesh.add(chest);

    // 2. Beach Towel draped over one shoulder
    const towelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Vibrant amber towel
      roughness: 0.9,
    });
    const towelGeo = new THREE.BoxGeometry(0.16, 0.6, 0.32);
    towelGeo.translate(0.18, 1.15, 0);
    const towel = new THREE.Mesh(towelGeo, towelMat);
    towel.castShadow = true;
    this.mesh.add(towel);

    // 3. Head with Straw Hat & Sunglasses
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    headGeo.translate(0, 1.55, 0);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    this.mesh.add(head);

    // Straw sun hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.85 });
    const brimGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16);
    brimGeo.translate(0, 1.72, 0);
    const hatBrim = new THREE.Mesh(brimGeo, hatMat);
    hatBrim.castShadow = true;
    this.mesh.add(hatBrim);

    const crownGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.14, 16);
    crownGeo.translate(0, 1.8, 0);
    const hatCrown = new THREE.Mesh(crownGeo, hatMat);
    hatCrown.castShadow = true;
    this.mesh.add(hatCrown);

    // Dark Sunglasses
    const glassesGeo = new THREE.BoxGeometry(0.3, 0.065, 0.06);
    glassesGeo.translate(0, 1.58, 0.2);
    const glassesMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.8,
    });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    this.mesh.add(glasses);

    // 4. Arms
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
    armGeo.translate(0, -0.25, 0);

    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.27, 1.3, 0);
    leftArm.castShadow = true;
    this.mesh.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.27, 1.3, 0);
    rightArm.castShadow = true;
    this.mesh.add(rightArm);

    // 5. Walking Legs (pivoted at hip height y = 0.55)
    // Left Leg
    const legGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.55, 8);
    legGeo.translate(0, -0.275, 0);

    const leftLeg = new THREE.Mesh(legGeo, skinMat);
    leftLeg.position.set(-0.12, 0.55, 0);
    leftLeg.castShadow = true;
    this.mesh.add(leftLeg);

    // Right Leg
    const rightLeg = new THREE.Mesh(legGeo, skinMat);
    rightLeg.position.set(0.12, 0.55, 0);
    rightLeg.castShadow = true;
    this.mesh.add(rightLeg);

    this.walkerLegs = [leftLeg, rightLeg];

  }

  private showBeachDialogue(quote: string): void {
    this.say(quote, 2.8, '👀 STRANDOLÓ');
  }

  // ==========================================================================
  // 6. VAGRANT / GORKA (A Park Filozófusa) MESH & PROPS
  // ==========================================================================
  private buildVagrant(): void {
    // 1. Illustrated vertical sprite cutout billboard
    const spriteGeo = new THREE.PlaneGeometry(1.5, 1.8);
    spriteGeo.translate(0, 0.9, 0);

    const spriteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05,
      emissive: new THREE.Color(0x443322),
      emissiveIntensity: 0.35,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      depthWrite: true,
    });

    if (typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();
      loader.load(
        resolveAssetPath('/sprites/npc_vagrant.png'),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          spriteMat.map = tex;
          spriteMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('[Enemy] Failed to load /sprites/npc_vagrant.png:', err);
        }
      );
    }

    const vagrantMesh = new THREE.Mesh(spriteGeo, spriteMat);
    vagrantMesh.castShadow = true;
    vagrantMesh.receiveShadow = false;
    this.mesh.add(vagrantMesh);

    // Warm facial key/fill light so Gorka's portrait is crisp and clearly visible
    const faceLight = new THREE.PointLight(0xffedd5, 1.8, 3.5);
    faceLight.position.set(0, 1.15, 0.45);
    this.mesh.add(faceLight);

    // 2. Weathered park bench prop behind Gorka
    const benchGroup = new THREE.Group();

    // Wooden slats for bench seat
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.8,
      metalness: 0.05,
    });
    const seatGeo = new THREE.BoxGeometry(1.9, 0.06, 0.52);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.set(0, 0.48, -0.15);
    seat.castShadow = true;
    seat.receiveShadow = true;
    benchGroup.add(seat);

    // Backrest
    const backGeo = new THREE.BoxGeometry(1.9, 0.42, 0.06);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.82, -0.38);
    back.rotation.x = -0.12;
    back.castShadow = true;
    benchGroup.add(back);

    // Cast iron ornate bench legs
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.85,
    });
    for (const lx of [-0.85, 0.85]) {
      const legGeo = new THREE.BoxGeometry(0.08, 0.48, 0.5);
      const leg = new THREE.Mesh(legGeo, ironMat);
      leg.position.set(lx, 0.24, -0.15);
      leg.castShadow = true;
      benchGroup.add(leg);

      const armGeo = new THREE.BoxGeometry(0.06, 0.26, 0.5);
      const arm = new THREE.Mesh(armGeo, ironMat);
      arm.position.set(lx, 0.61, -0.15);
      benchGroup.add(arm);
    }

    this.mesh.add(benchGroup);

    // 3. Cardboard box sheet on the ground
    const boxGeo = new THREE.BoxGeometry(1.35, 0.025, 1.1);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x9a6b43,
      roughness: 0.95,
      metalness: 0.0,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.set(0.12, 0.013, 0.35);
    boxMesh.rotation.y = 0.14;
    boxMesh.receiveShadow = true;
    this.mesh.add(boxMesh);

    // 4. Tin can / coffee cup with euro coins
    const canGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.13, 16);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.85,
    });
    const can = new THREE.Mesh(canGeo, canMat);
    can.position.set(0.48, 0.07, 0.48);
    can.castShadow = true;
    this.mesh.add(can);

    const coinGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.007, 12);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.95,
    });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.position.set(0.48, 0.13, 0.48);
    coin.rotation.x = 0.25;
    this.mesh.add(coin);

    // 5. Glowing ember point light & rising smoke particles
    this.vagrantEmberLight = new THREE.PointLight(0xf97316, 0.8, 1.4);
    this.vagrantEmberLight.position.set(0.18, 0.85, 0.1);
    this.mesh.add(this.vagrantEmberLight);

    this.vagrantSmokeParticles = [];
    for (let i = 0; i < 3; i++) {
      const smokeGeo = new THREE.SphereGeometry(0.035 + i * 0.015, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.38 - i * 0.09,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.18, 0.9 + i * 0.14, 0.1);
      this.mesh.add(smoke);
      this.vagrantSmokeParticles.push(smoke);
    }
  }

  // ==========================================================================
  // MAIN UPDATE LOOP
  // ==========================================================================
  public update(
    delta: number,
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    postProcessManager?: PostProcessManager,
    cameraRig?: CameraRig
  ): void {
    // Update Screen-Space DOM Speech Bubble Timer
    if (this.speechTimer > 0) {
      this.speechTimer -= delta;
      if (this.speechTimer <= 0 && this.speechBubble) {
        hideNpcSpeech(this.speechBubble);
      }
    }

    if (falloutDialogue.isActive) {
      return;
    }

    switch (this.type) {
      case EnemyType.GRANNY:
        this.updateGranny(delta, p1, p2, audioManager);
        break;
      case EnemyType.DOG:
        this.updateDog(delta, p1, p2, audioManager);
        break;
      case EnemyType.CASHIER:
        this.updateCashier(delta, p1, p2, audioManager);
        break;
      case EnemyType.PASSENGER:
        this.updatePassenger(delta, p1, p2, audioManager, postProcessManager, cameraRig);
        break;
      case EnemyType.NPC_BEACH_WALKER:
        this.updateBeachWalker(delta, p1, p2, audioManager, postProcessManager, cameraRig);
        break;
      case EnemyType.NPC_VAGRANT:
        this.updateVagrant(delta, p1, p2, audioManager, postProcessManager, cameraRig);
        break;
    }
  }

  // ==========================================================================
  // 1. GRANNY AI & SHOCKWAVE ATTACK
  // ==========================================================================
  private updateGranny(delta: number, p1: Player, p2: Player, audioManager?: AudioManager): void {
    this.timer += delta;

    // Face the closest player slightly
    const d1 = this.mesh.position.distanceTo(p1.position);
    const d2 = this.mesh.position.distanceTo(p2.position);
    const targetPlayer = d1 < d2 ? p1 : p2;
    const dx = targetPlayer.position.x - this.mesh.position.x;
    const dz = targetPlayer.position.z - this.mesh.position.z;
    const targetAngle = Math.atan2(dx, dz);
    this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, targetAngle, 3.0, delta);

    // Every 3.5s screams and spawns expanding shockwave ring
    if (this.timer >= 3.5) {
      this.timer = 0;
      this.spawnGrannyShockwave(audioManager);
    }

    // Update active shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.lifetime += delta;
      const progress = wave.lifetime / wave.maxLifetime;

      if (progress >= 1.0) {
        // Dispose
        this.mesh.parent?.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        if (wave.mesh.material instanceof THREE.Material) wave.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Expand radius: 0.4m -> 6.0m
      wave.currentRadius = THREE.MathUtils.lerp(0.4, wave.maxRadius, Math.pow(progress, 0.7));
      const scale = wave.currentRadius;
      wave.mesh.scale.set(scale, scale, 1.0);

      // Fade opacity
      const mat = wave.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1.0 - progress) * 0.85;

      // Check collision with P1 and P2
      this.checkShockwaveHit(wave, p1);
      this.checkShockwaveHit(wave, p2);
    }
  }

  private spawnGrannyShockwave(audioManager?: AudioManager): void {
    if (audioManager) {
      audioManager.playGrannyScream();
      audioManager.playHostileThreat();
    }
    this.say('Hé! Takarodjatok innen!', 2.2, '👵 NAGYMAMA');

    // Shake cane in anger
    if (this.caneMesh) {
      this.caneMesh.rotation.x = -0.5;
      setTimeout(() => {
        if (this.caneMesh) this.caneMesh.rotation.x = 0;
      }, 400);
    }

    // Ring mesh in world coordinates
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Bright warning red
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(this.mesh.position.x, this.mesh.position.y + 0.08, this.mesh.position.z);

    if (this.mesh.parent) {
      this.mesh.parent.add(ringMesh);
    } else {
      this.mesh.add(ringMesh);
    }

    this.shockwaves.push({
      mesh: ringMesh,
      currentRadius: 0.4,
      maxRadius: 6.0,
      lifetime: 0,
      maxLifetime: 1.25,
      hitPlayers: new Set<Player>(),
    });
  }

  private checkShockwaveHit(wave: ShockwaveRing, player: Player): void {
    if (wave.hitPlayers.has(player)) return;

    const wavePos = wave.mesh.position;
    const dist = Math.hypot(player.position.x - wavePos.x, player.position.z - wavePos.z);

    // If within ring boundary thickness (0.6m)
    if (Math.abs(dist - wave.currentRadius) < 0.65) {
      wave.hitPlayers.add(player);

      // Knockback impulse: direction * 8.0
      const dirX = player.position.x - wavePos.x;
      const dirZ = player.position.z - wavePos.z;
      const len = Math.hypot(dirX, dirZ);
      const normDir = len > 0.001 ? new THREE.Vector3(dirX / len, 0, dirZ / len) : new THREE.Vector3(0, 0, 1);

      player.applyKnockback(normDir.clone().multiplyScalar(8.0));
      player.applyStun(0.8);
      player.say("Ez meg mi a franc volt?!", 3.0);
    }
  }

  // ==========================================================================
  // 2. DOG AI (Sprint & Latch, Rescue Mechanic)
  // ==========================================================================
  private updateDog(delta: number, p1: Player, p2: Player, audioManager?: AudioManager): void {
    // Tail wagging animation
    if (this.dogTail) {
      this.dogTail.rotation.z = Math.sin(performance.now() * 0.015) * 0.4;
    }

    // 1. If currently latched onto a player:
    if (this.latchedPlayer) {
      this.state = 'attack';
      // Glue dog to latched player's position
      this.mesh.position.set(
        this.latchedPlayer.position.x + 0.35,
        this.latchedPlayer.position.y,
        this.latchedPlayer.position.z
      );
      this.latchedPlayer.speedMultiplier = 0.25;

      // Check if OTHER player comes within 1.5m to scare the dog off
      const rescuer = this.latchedPlayer === p1 ? p2 : p1;
      const rescuerDist = this.mesh.position.distanceTo(rescuer.position);

      if (rescuerDist <= 1.5) {
        // Scared off!
        if (audioManager) audioManager.playDogBark();
        this.latchedPlayer.speedMultiplier = 1.0;
        this.latchedPlayer = null;
        this.state = 'cooldown';
        this.attackCooldown = 3.5; // Flee / cooldown for 3.5s
      }
      return;
    }

    // 2. If in cooldown / flee state:
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      // Trot back towards spawnPos
      const spawnVec = new THREE.Vector3(this.config.spawnPos[0], this.config.spawnPos[1], this.config.spawnPos[2]);
      const toSpawn = new THREE.Vector3().subVectors(spawnVec, this.mesh.position);
      toSpawn.y = 0;
      if (toSpawn.length() > 0.4) {
        toSpawn.normalize();
        this.mesh.position.addScaledVector(toSpawn, 3.2 * delta);
        this.mesh.rotation.y = Math.atan2(toSpawn.x, toSpawn.z);
        this.animateDogLegs(12);
      }
      return;
    }

    // 3. Normal detection & chase state
    const d1 = this.mesh.position.distanceTo(p1.position);
    const d2 = this.mesh.position.distanceTo(p2.position);
    const closestDist = Math.min(d1, d2);
    const closestPlayer = d1 < d2 ? p1 : p2;

    // Detect closest player within 6.0m
    if (closestDist <= 6.0) {
      if (this.state !== 'attack' && audioManager) {
        audioManager.playHostileThreat();
      }
      this.state = 'attack';
      const toPlayer = new THREE.Vector3().subVectors(closestPlayer.position, this.mesh.position);
      toPlayer.y = 0;
      toPlayer.normalize();

      // Sprint at 4.5 m/s
      this.mesh.position.addScaledVector(toPlayer, 4.5 * delta);
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      this.animateDogLegs(18);

      // Check contact to latch onto player (< 0.75m)
      if (closestDist <= 0.75) {
        if (audioManager) audioManager.playDogBark();
        this.latchedPlayer = closestPlayer;
        closestPlayer.speedMultiplier = 0.25;
        this.say('VAU! VAU! GRRR!', 2.2, '🐕 KUTYA');
        closestPlayer.say("Szedd le rólam!", 3.0);
      }
    } else {
      // 4. Patrol between spawnPos and patrolTarget if specified
      if (this.config.patrolTarget) {
        this.state = 'patrol';
        const targetPos = this.patrolDirection === 1
          ? new THREE.Vector3(...this.config.patrolTarget)
          : new THREE.Vector3(...this.config.spawnPos);

        const toTarget = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
        toTarget.y = 0;
        const dist = toTarget.length();

        if (dist < 0.3) {
          this.patrolDirection = -this.patrolDirection;
        } else {
          toTarget.normalize();
          this.mesh.position.addScaledVector(toTarget, 1.8 * delta);
          this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);
          this.animateDogLegs(8);
        }
      } else {
        this.state = 'idle';
        this.resetDogLegs();
      }
    }
  }

  private animateDogLegs(speed = 12): void {
    const time = performance.now() * 0.001 * speed;
    if (this.dogLegs.length >= 4) {
      this.dogLegs[0].rotation.x = Math.sin(time) * 0.6;
      this.dogLegs[1].rotation.x = -Math.sin(time) * 0.6;
      this.dogLegs[2].rotation.x = -Math.sin(time) * 0.6;
      this.dogLegs[3].rotation.x = Math.sin(time) * 0.6;
    }
  }

  private resetDogLegs(): void {
    for (const leg of this.dogLegs) {
      leg.rotation.x = 0;
    }
  }

  // ==========================================================================
  // 3. CASHIER AI (Vision Cone Freeze & Speech Bubble)
  // ==========================================================================
  private updateCashier(delta: number, p1: Player, p2: Player, audioManager?: AudioManager): void {
    if (this.isPacified) {
      if (this.visionConeMesh) {
        this.visionConeMesh.visible = false;
      }
      return;
    }

    // Vision cone alert highlight reset timer
    if (this.cashierAlertTimer > 0) {
      this.cashierAlertTimer -= delta;
      if (this.cashierAlertTimer <= 0 && this.visionConeMesh) {
        (this.visionConeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
        (this.visionConeMesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      return;
    }

    // Cashier forward vector on XZ plane
    const forwardX = Math.sin(this.mesh.rotation.y);
    const forwardZ = Math.cos(this.mesh.rotation.y);

    const players = [p1, p2];
    for (const player of players) {
      const dx = player.position.x - this.mesh.position.x;
      const dz = player.position.z - this.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      // Vision cone: length 4.0m
      if (dist <= 4.0 && dist > 0.01) {
        const normX = dx / dist;
        const normZ = dz / dist;
        // Dot product: cos(30 degrees) = 0.866
        const dot = normX * forwardX + normZ * forwardZ;

        if (dot >= 0.866) {
          // Inside 60-degree vision cone! Trigger freeze!
          this.state = 'alert';
          player.applyStun(2.0);

          if (audioManager) {
            audioManager.playCashierAlert();
            audioManager.playHostileThreat();
          }

          // Show floating speech bubble via DOM overlay (bypassing trip shader)
          this.say('Kér szatyrot?! Blokk mehet?!', 2.8, '🛒 PÉNZTÁROS');

          // Highlight vision cone red
          if (this.visionConeMesh) {
            (this.visionConeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xef4444);
            (this.visionConeMesh.material as THREE.MeshBasicMaterial).opacity = 0.55;
          }
          this.cashierAlertTimer = 2.0;

          // Cooldown so players can escape once stun wears off
          this.attackCooldown = 4.2;
          break;
        }
      }
    }
  }

  // ==========================================================================
  // 4. PASSENGER AI (Paranoia Aura & Screen Distortion)
  // ==========================================================================
  private updatePassenger(
    delta: number,
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    postProcessManager?: PostProcessManager,
    cameraRig?: CameraRig
  ): void {
    // Subtle pulse on paranoia aura ring
    if (this.paranoiaAuraMesh) {
      const pulse = 0.3 + Math.sin(performance.now() * 0.004) * 0.15;
      (this.paranoiaAuraMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    if (this.paranoiaCooldown > 0) {
      this.paranoiaCooldown -= delta;
      return;
    }

    const players = [p1, p2];
    for (const player of players) {
      const dist = this.mesh.position.distanceTo(player.position);

      // If within 2.5m paranoia aura
      if (dist <= 2.5) {
        // Check if player is moving fast (has velocity or active movement)
        const velLen = player.velocity.length();
        const isSprinting = velLen > 1.5 || (player.speedMultiplier >= 0.5 && !player.isStunned());

        if (isSprinting) {
          // Trigger paranoia hazard with shared sound cooldown
          if (cameraRig) {
            cameraRig.addShake(0.2);
          }
          const now = performance.now();
          if (now - Enemy.lastPassengerParanoiaSoundTime > 12000) {
            Enemy.lastPassengerParanoiaSoundTime = now;
            if (postProcessManager) {
              postProcessManager.addIntensity(0.08);
            }
            if (audioManager) {
              audioManager.playParanoiaHum();
            }
            this.say('Ne szaladgáljatok körülöttem...', 2.2, '👤 UTAS');
          }

          this.paranoiaCooldown = 5.0;
          break;
        }
      }
    }
  }

  // ==========================================================================
  // 5. BEACH WALKER AI (Relaxed Pacing, Scrutiny Stare & Paranoia Infliction)
  // ==========================================================================
  private updateBeachWalker(
    delta: number,
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    postProcessManager?: PostProcessManager,
    _cameraRig?: CameraRig
  ): void {
    if (this.walkerDialogueCooldown > 0) {
      this.walkerDialogueCooldown -= delta;
    }
    if (this.walkerWhisperCooldown > 0) {
      this.walkerWhisperCooldown -= delta;
    }

    // Distance to players
    const d1 = this.mesh.position.distanceTo(p1.position);
    const d2 = this.mesh.position.distanceTo(p2.position);
    const minDist = Math.min(d1, d2);
    const closestPlayer = d1 < d2 ? p1 : p2;

    // 2. Scrutiny / Paranoia state (< 3.5m)
    if (minDist < 3.5) {
      this.state = 'alert';
      this.resetWalkerLegs();

      // Smoothly turn to face the closer player
      const dx = closestPlayer.position.x - this.mesh.position.x;
      const dz = closestPlayer.position.z - this.mesh.position.z;
      const targetAngle = Math.atan2(dx, dz);
      this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, targetAngle, 4.0, delta);

      // Cause Paranoia tick: +2% per second (+0.02 * delta)
      if (postProcessManager) {
        postProcessManager.addIntensity(0.02 * delta);
      }

      // Audio whisper and scrutiny chime SFX while inside scrutiny radius
      if (this.walkerWhisperCooldown <= 0) {
        if (audioManager) {
          audioManager.playPassiveScrutinyChime();
        }
        this.walkerWhisperCooldown = 2.4;
      }

      // Trigger overhead judgmental quote every 3s
      if (this.walkerDialogueCooldown <= 0) {
        const quotes = Enemy.BEACH_QUOTES;
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        this.showBeachDialogue(quote);
        this.walkerDialogueCooldown = 3.0;
      }

      return;
    }

    // 3. Normal walking / patrol state (minDist >= 3.5m)
    this.state = 'patrol';

    // Determine target position: waypoints array or patrolTarget or spawnPos
    let targetPos: THREE.Vector3 | null = null;
    const waypoints = this.config.waypoints;

    if (waypoints && waypoints.length > 0) {
      const currentWP = waypoints[this.walkerCurrentWaypointIdx];
      targetPos = new THREE.Vector3(currentWP[0], currentWP[1], currentWP[2]);
    } else if (this.config.patrolTarget) {
      targetPos = this.walkerPatrolDirection === 1
        ? new THREE.Vector3(...this.config.patrolTarget)
        : new THREE.Vector3(...this.config.spawnPos);
    }

    if (targetPos) {
      const toTarget = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist < 0.35) {
        // Arrived at destination waypoint / target
        if (waypoints && waypoints.length > 0) {
          this.walkerCurrentWaypointIdx = (this.walkerCurrentWaypointIdx + 1) % waypoints.length;
        } else {
          this.walkerPatrolDirection = -this.walkerPatrolDirection;
        }
      } else {
        toTarget.normalize();
        const walkSpeed = 1.2; // 1.2 m/s
        this.mesh.position.addScaledVector(toTarget, walkSpeed * delta);
        const desiredAngle = Math.atan2(toTarget.x, toTarget.z);
        this.mesh.rotation.y = THREE.MathUtils.damp(this.mesh.rotation.y, desiredAngle, 6.0, delta);

        this.walkerWalkTime += delta;
        this.animateWalkerLegs();
      }
    } else {
      this.state = 'idle';
      this.resetWalkerLegs();
    }
  }

  private animateWalkerLegs(): void {
    const swing = Math.sin(this.walkerWalkTime * 6.5) * 0.45;
    if (this.walkerLegs.length >= 2) {
      this.walkerLegs[0].rotation.x = swing;
      this.walkerLegs[1].rotation.x = -swing;
    }
  }

  private resetWalkerLegs(): void {
    for (const leg of this.walkerLegs) {
      leg.rotation.x = 0;
    }
  }

  // ==========================================================================
  // 6. VAGRANT / GORKA AI & CINEMATIC ENCOUNTER
  // ==========================================================================
  private updateVagrant(
    delta: number,
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    postProcessManager?: PostProcessManager,
    cameraRig?: CameraRig
  ): void {
    if (this.vagrantDialogueCooldown > 0) {
      this.vagrantDialogueCooldown -= delta;
    }

    // Animate ember light flicker
    if (this.vagrantEmberLight) {
      this.vagrantEmberLight.intensity = 0.7 + Math.sin(Date.now() * 0.007) * 0.3;
    }

    // Animate rising smoke
    for (let i = 0; i < this.vagrantSmokeParticles.length; i++) {
      const sm = this.vagrantSmokeParticles[i];
      sm.position.y += delta * 0.09;
      sm.position.x += Math.sin(Date.now() * 0.003 + i * 1.5) * 0.015 * delta;
      if (sm.position.y > 1.45) {
        sm.position.y = 0.9;
      }
    }

    // Check distance to players
    const d1 = this.mesh.position.distanceTo(p1.position);
    const d2 = this.mesh.position.distanceTo(p2.position);
    const inRange = d1 < 2.5 || d2 < 2.5;

    // Show proximity speech bubble
    if (inRange && !falloutDialogue.isActive) {
      if (!this.vagrantPromptBubble) {
        this.vagrantPromptBubble = createNpcSpeechBubble();
      }
      showNpcSpeech(this.vagrantPromptBubble, 'Beszélgetés (E / Ⓐ gomb)', 'Gorka');
    } else if (this.vagrantPromptBubble && this.vagrantPromptBubble.visible) {
      hideNpcSpeech(this.vagrantPromptBubble);
    }

    // Interaction trigger
    if (inRange && !falloutDialogue.isActive && this.vagrantDialogueCooldown <= 0) {
      const input = InputManager.getInstance();
      const p1Action = d1 < 2.5 && (input.getP1Action() || input.isP1Action());
      const p2Action = d2 < 2.5 && (input.getP2Action() || input.isP2Action());

      if (p1Action || p2Action) {
        this.startVagrantCinematic(p1, p2, audioManager, postProcessManager, cameraRig);
      }
    }
  }

  private startVagrantCinematic(
    p1: Player,
    p2: Player,
    audioManager?: AudioManager,
    postProcessManager?: PostProcessManager,
    cameraRig?: CameraRig
  ): void {
    // 1. Halt player movement
    p1.velocity.set(0, 0, 0);
    p2.velocity.set(0, 0, 0);

    // 2. Clear line of sight
    p1.setDialogueFade(true);
    p2.setDialogueFade(true);

    // 3. Hide prompt
    if (this.vagrantPromptBubble) {
      hideNpcSpeech(this.vagrantPromptBubble);
    }

    // 4. Fallout cinematic bust framing
    if (cameraRig) {
      cameraRig.startDialogueBust(this.mesh.position, this.facingAngle);
    }

    // 5. Ambient mystique/threat audio
    audioManager?.playHostileThreat();

    // Check if we are in Etxebarria Park
    const currentLevelId = gameState.getFlag('current_level_id');
    const isParkLevel = currentLevelId === 'level_6_etxebarria' || gameState.getFlag('current_level_theme') === 'park';

    if (isParkLevel) {
      if (gameState.getFlag('gorka_park_wisdom')) {
        falloutDialogue.startEncounter({
          speakerName: 'GORKA - A PARK FILOZÓFUSA',
          speakerPrompt: 'Üljetek csak le a betonfal tövébe a kék fénynél, relaxáljatok, és szívjátok a spanglit... A 100%-os tudat-fúzió után a focipályán megnyílik az átjáró!',
          choices: [
            {
              key: '1',
              text: 'Köszönjük a bölcsességet, Gorka! Megyünk a falhoz relaxálni.',
              response: 'Menjetek csak, kölykök. Nézzétek, ahogy a Torre Iberdrola szétolvad a kozmikus fényben...',
              onSelect: () => {
                audioManager?.playPickup();
                showGameToast('🧘 Gorka: Pihenjetek a fal tövében!');
              },
            },
          ],
          onComplete: () => {
            cameraRig?.endDialogueBust();
            p1.setDialogueFade(false);
            p2.setDialogueFade(false);
            this.vagrantDialogueCooldown = 1.0;
          },
        });
        return;
      }

      // Initial Park Encounter
      const parkChoice1: DialogueChoice = {
        key: '1',
        text: '[Filozófia] Gorka, mi a titka ennek a helynek? Hogyan jutunk tovább?',
        response: 'Menjetek a betonfal tövéhez a kék fénynél, és üljetek le a fűre chill-ezni! Hangoljátok össze a légzéseteket és a gondolataitokat. Amikor a trip eléri a 100%-ot, a város megnyílik előttetek a focipályán!',
        onSelect: () => {
          gameState.setFlag('gorka_park_wisdom', true);
          postProcessManager?.addIntensity(0.1);
          audioManager?.playPickup();
          showGameToast('🧘 Gorka tanácsa: Üljetek le a fal tövébe chill-ezni! (Trip +10%)');
        },
      };

      const parkChoice2: DialogueChoice = {
        key: '2',
        text: '[Spangli megosztása] Szívsz velünk egyet a panoráma előtt, Gorka?',
        response: '*Mélyet szippant a füstből, szelíden mosolyog* A hegyi szellő és a jó fű a lélek orvossága... Köszönöm, kölykök! Cserébe itt egy kis kozmikus ráhangolódás!',
        onSelect: () => {
          gameState.setFlag('gorka_park_wisdom', true);
          postProcessManager?.addIntensity(0.15);
          audioManager?.playPickup();
          showGameToast('🌿 Békekötés a parkban! (Trip +15%)');
        },
      };

      const parkChoice3: DialogueChoice = {
        key: '3',
        text: '[Paranoia] Te követsz minket az egész városon át?! Ki vagy te valójában?!',
        response: 'Hahaha! Én mindenhol ott vagyok, ahol a beton találkozik az éggel... Nyugalom, a paranoia csak az egótok utolsó kapálózása!',
        onSelect: () => {
          postProcessManager?.addIntensity(0.15);
          cameraRig?.addShake(0.4);
          audioManager?.playHostileThreat();
          showGameToast('⚠️ Paranoia +15%! Gorka agresszívan rátok mordult!');
        },
      };

      falloutDialogue.startEncounter({
        speakerName: 'GORKA - A PARK FILOZÓFUSA',
        speakerPrompt: 'Üdv a hegyen, testvéreim! Tágul a tudatotok, mi? Odalent Bilbao fényei égnek, idefent meg a fű illata száll. Mit kerestek a zónámban?',
        choices: [parkChoice1, parkChoice2, parkChoice3],
        onComplete: () => {
          cameraRig?.endDialogueBust();
          p1.setDialogueFade(false);
          p2.setDialogueFade(false);
          this.vagrantDialogueCooldown = 1.0;
        },
      });
      return;
    }

    // If the code is already known, provide a friendly review encounter (Level 2 Street)
    if (gameState.getFlag('gorka_code_known')) {
      falloutDialogue.startEncounter({
        speakerName: 'GORKA - A PARK FILOZÓFUSA',
        speakerPrompt: 'Mit akartok még, kölykök? Megmondtam már: a szervizkapu kódja 1984. Nyissátok ki és siessetek a partra, a sztráda túloldalán már vár a tengerparti szellő!',
        choices: [
          {
            key: '1',
            text: 'Köszönjük még egyszer a segítséget, Gorka! Vigyázz magadra!',
            response: 'Menjetek csak békével, fiatalok. És ne feledjétek: a valóság csak egy kollektív hallucináció.',
            onSelect: () => {
              audioManager?.playPickup();
              showGameToast('🚪 A szervizkapu kódja: 1984');
            },
          },
        ],
        onComplete: () => {
          cameraRig?.endDialogueBust();
          p1.setDialogueFade(false);
          p2.setDialogueFade(false);
          this.vagrantDialogueCooldown = 1.0;
        },
      });
      return;
    }

    // Initial / Unsolved Dialogue Encounter
    const choice1: DialogueChoice = {
      key: '1',
      text: '[Karizma 40%] Látom, vágod a dörgést errefelé. Nem tudod a kapu kódját? Sietnénk a partra.',
      response: '',
      onSelect: () => {
        const success = Math.random() < 0.4;
        if (success) {
          choice1.response = 'Na jó, úgy tűnik, vágod a szitut. A szervizkapu kódja 1984. George Orwell is büszke lenne rátok!';
          gameState.setFlag('gorka_code_known', true);
          gameState.setFlag('service_gate_code', '1984');
          audioManager?.playPickup();
          showGameToast('✅ Karizma siker! Megkaptátok a kódot: 1984');
        } else {
          choice1.response = 'Nem hat meg a dumátok, kölykök. Húzzatok a szemem elől, vagy ráuszítom a galambokat!';
          audioManager?.playHostileThreat();
          showGameToast('❌ Karizma kudarc! Gorka nem bízik bennetek.');
        }
      },
    };

    const choice2: DialogueChoice = {
      key: '2',
      text: '[Spangli átadása] Nesztek egy slukk ebből, cserébe a kódért.',
      response: '*Mélyet szippant a füstből, szemei felragyognak* Ó, ez az igazi baszk hegyi nektár! Rendben vagytok, kölykök. A kapu kódja: 1984. Használjátok egészséggel a kapunál!',
      onSelect: () => {
        gameState.setFlag('gorka_code_known', true);
        gameState.setFlag('service_gate_code', '1984');
        postProcessManager?.addIntensity(0.1);
        audioManager?.playPickup();
        showGameToast('🌿 Békekötés! Trip +10% és a kód megszervezve: 1984');
      },
    };

    const choice3: DialogueChoice = {
      key: '3',
      text: '[Paranoia] Honnan tudod, hova megyünk?! Te kinek dolgozol?!',
      response: 'Kinek dolgoznék, te agyament?! Talán a köztisztaságiaknak?! Tűnés a dobozom mellől, mielőtt rátok borítom a szemetet!',
      onSelect: () => {
        postProcessManager?.addIntensity(0.2);
        cameraRig?.addShake(0.4);
        audioManager?.playHostileThreat();
        showGameToast('⚠️ Paranoia +20%! Gorka agresszívan rátok mordult!');
      },
    };

    falloutDialogue.startEncounter({
      speakerName: 'GORKA - A PARK FILOZÓFUSA',
      speakerPrompt: 'Mit bámultok úgy, kölykök? Tágabb a szemetek, mint a telehold. Mit akartok a zónámban?',
      choices: [choice1, choice2, choice3],
      onComplete: () => {
        cameraRig?.endDialogueBust();
        p1.setDialogueFade(false);
        p2.setDialogueFade(false);
        this.vagrantDialogueCooldown = 1.0;
      },
    });
  }

  // ==========================================================================
  // SERIALIZATION & CLEANUP
  // ==========================================================================
  public toConfig(): EnemyConfig {
    return {
      type: this.type,
      spawnPos: [this.mesh.position.x, this.mesh.position.y, this.mesh.position.z],
      patrolTarget: this.config.patrolTarget ? [...this.config.patrolTarget] : undefined,
      waypoints: this.config.waypoints ? this.config.waypoints.map((w) => [...w]) : undefined,
      swimwearColor: this.config.swimwearColor,
      facingAngle: this.mesh.rotation.y,
    };
  }

  /**
   * Triggers a screen-space HTML speech bubble over the enemy's head,
   * completely bypassing WebGL post-processing shaders.
   */
  public say(text: string, durationSec = 3.0, title?: string): void {
    if (!this.speechBubble) {
      this.speechBubble = createNpcSpeechBubble();
    }
    this.speechTimer = durationSec;
    showNpcSpeech(this.speechBubble, text, title);
  }

  /**
   * Projects the 3D enemy head position to 2D screen coordinates and updates
   * the DOM speech bubble position.
   */
  public updateScreenPosition(camera: THREE.Camera): void {
    if (this.vagrantPromptBubble && this.vagrantPromptBubble.visible) {
      updateNpcSpeechPosition(this.vagrantPromptBubble, this.mesh.position, camera, 1.95);
    }

    if (!this.speechBubble || !this.speechBubble.visible) return;
    let headOffset = 2.0;
    if (this.type === EnemyType.DOG) headOffset = 0.85;
    else if (this.type === EnemyType.GRANNY) headOffset = 1.85;
    else if (this.type === EnemyType.CASHIER) headOffset = 1.7;
    else if (this.type === EnemyType.PASSENGER) headOffset = 1.85;
    else if (this.type === EnemyType.NPC_BEACH_WALKER) headOffset = 2.05;
    else if (this.type === EnemyType.NPC_VAGRANT) headOffset = 1.95;

    updateNpcSpeechPosition(this.speechBubble, this.mesh.position, camera, headOffset);
  }

  public dispose(): void {
    if (this.latchedPlayer) {
      this.latchedPlayer.speedMultiplier = 1.0;
      this.latchedPlayer = null;
    }

    if (this.speechBubble) {
      destroyNpcSpeechBubble(this.speechBubble);
      this.speechBubble = undefined;
    }

    if (this.vagrantPromptBubble) {
      destroyNpcSpeechBubble(this.vagrantPromptBubble);
      this.vagrantPromptBubble = undefined;
    }

    // Clean shockwaves
    for (const wave of this.shockwaves) {
      this.mesh.parent?.remove(wave.mesh);
      wave.mesh.geometry.dispose();
      if (wave.mesh.material instanceof THREE.Material) wave.mesh.material.dispose();
    }
    this.shockwaves = [];

    // Traverse and dispose geometries and materials
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      } else if (child instanceof THREE.Sprite) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });

    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}

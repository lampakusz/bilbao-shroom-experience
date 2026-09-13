import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager.ts';
import { inputManager, XboxButton } from '../engine/InputManager.ts';
import type { Player } from '../entities/Player.ts';
import type { CameraRig } from '../engine/CameraRig.ts';
import type { PostProcessManager } from '../engine/PostProcessManager.ts';
import type { Level } from '../world/Level.ts';
import { setFloodlightTripGlow, setPanoramaTripLevel } from '../world/BlockFactory.ts';

export interface VibeStage {
  name: string;
  targetFreq: number;
  subtext: string;
  p1Quote: string;
  p2Quote: string;
  ambientNote: string;
}

const VIBE_STAGES: VibeStage[] = [
  {
    name: 'I. FÁZIS: A Torony Magenta Rezgése',
    targetFreq: 2.2,
    subtext: 'Hangoljátok be az elméteket az Iberdrola torony magenta frekvenciájára!',
    p1Quote: 'Nézd a tornyot a horizonton... tiszta magenta hullámokat sugároz!',
    p2Quote: 'Én is látom a lila csíkot a közepén! Ráhangolódtunk a jövőre!',
    ambientNote: 'Torony frekvencia rögzítve (40%)',
  },
  {
    name: 'II. FÁZIS: A San Mamés Szívverése',
    targetFreq: 3.5,
    subtext: 'A hegytetőn lüktetnek a reflektorok... találjátok meg a stadion ritmusát!',
    p1Quote: 'Hallod a távoli meccset a hegytetőn? A labda pattogása a kozmosz szívverése!',
    p2Quote: 'A reflektorok sárga napként ragyognak ránk a műfű felett!',
    ambientNote: 'Stadion lüktetés szinkronizálva (60%)',
  },
  {
    name: 'III. FÁZIS: A Nervión Folyó Rezonanciája',
    targetFreq: 1.6,
    subtext: 'A hideg kőfal mögöttetek... érezzétek a folyó és a hidak éjszakai áramlását!',
    p1Quote: 'A betonfal mögöttünk... Bilbao velünk együtt lélegzik az éjszakában!',
    p2Quote: 'Egyetlen nagy lüktető organizmus vagyunk a füvön ülve!',
    ambientNote: 'Folyó áramlás aktiválva (80%)',
  },
  {
    name: 'IV. FÁZIS: Teljes Kozmikus Tudat-Fúzió',
    targetFreq: 4.8,
    subtext: 'A végső harmonizáció! Egyesítsétek a tudatotokat a csúcsfrekvencián!',
    p1Quote: '🌟 Teljes tudati fúzió! A színek megnyíltak, Bilbao életre kelt előttünk!',
    p2Quote: '✨ Megvan a megvilágosodás! Szabad a portál a hegytetőn a műfüves pályánál!',
    ambientNote: 'Tudat-fúzió 100% - Portál feloldva!',
  },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export class VibePuzzle {
  private static instance: VibePuzzle | null = null;

  public isActive = false;
  public tripLevel = 0.20; // Starts at 20% baseline
  public isComplete = false;

  private p1Ref: Player | null = null;
  private p2Ref: Player | null = null;
  private cameraRigRef: CameraRig | null = null;
  private postProcessRef: PostProcessManager | null = null;
  private levelRef: Level | null = null;

  // Mini-game State
  private stageIndex = 0; // 0..3
  private p1Freq = 1.0;
  private p2Freq = 4.4;
  private targetFreq = 2.2;
  private readonly tolerance = 0.32; // resonance window

  // Rhythm Pulse Ring State
  private pulseTimer = 0;
  private readonly pulseDuration = 1.35; // seconds per pulse
  private readonly targetRadius = 30; // target circle radius px
  private isResonanceLocked = false;
  private lockHoldTime = 0;
  private animPhase = 0;

  // Feedback & Banter
  private hitFeedbackText = '';
  private hitFeedbackTimer = 0;
  private hitFeedbackColor = '#38bdf8';
  private banterSpeaker = '';
  private banterQuote = '';
  private banterTimer = 0;

  // Canvas Particles
  private particles: Particle[] = [];

  // Keyboard tracking
  private heldKeys = new Set<string>();

  // UI DOM Elements
  private overlay: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tripBarFill: HTMLDivElement | null = null;
  private tripText: HTMLSpanElement | null = null;
  private stageTitleEl: HTMLDivElement | null = null;
  private stageSubtextEl: HTMLDivElement | null = null;
  private statusBannerEl: HTMLDivElement | null = null;
  private p1FreqBadge: HTMLSpanElement | null = null;
  private p2FreqBadge: HTMLSpanElement | null = null;
  private targetFreqBadge: HTMLSpanElement | null = null;
  private dialogueBox: HTMLDivElement | null = null;
  private dialogueSpeakerEl: HTMLDivElement | null = null;
  private dialogueTextEl: HTMLDivElement | null = null;

  public static getInstance(): VibePuzzle {
    if (!VibePuzzle.instance) {
      VibePuzzle.instance = new VibePuzzle();
    }
    return VibePuzzle.instance;
  }

  constructor() {
    this.buildDOM();
  }

  private buildDOM(): void {
    if (typeof document === 'undefined') return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'vibe-puzzle-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 120;
      display: none;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      background: radial-gradient(circle at 50% 100%, rgba(15, 23, 42, 0.45) 0%, rgba(2, 6, 23, 0.88) 100%);
      transition: opacity 0.4s ease-in-out;
      opacity: 0;
    `;

    // 1. Top Bar: Mind-Meld & Trip Progress Bar
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: min(780px, 94vw);
    `;
    topBar.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%; font-size: 15px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">
        <span id="vibe-stage-title" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">✨</span> I. FÁZIS: A Torony Magenta Rezgése
        </span>
        <span id="vibe-trip-text" style="color: #ec4899; font-size: 20px; font-weight: 900; text-shadow: 0 0 12px rgba(236, 72, 153, 0.6);">TRIP: 20%</span>
      </div>
      <div style="width: 100%; height: 16px; background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(56, 189, 248, 0.5); border-radius: 9999px; overflow: hidden; box-shadow: 0 0 20px rgba(56, 189, 248, 0.3);">
        <div id="vibe-trip-bar" style="width: 20%; height: 100%; background: linear-gradient(90deg, #06b6d4, #a855f7, #ec4899); border-radius: 9999px; transition: width 0.25s ease;"></div>
      </div>
      <div id="vibe-stage-subtext" style="font-size: 13px; font-weight: 600; color: #94a3b8; text-align: center; margin-top: 2px;">
        Hangoljátok be az elméteket az Iberdrola torony magenta frekvenciájára!
      </div>
    `;
    this.overlay.appendChild(topBar);

    // 2. Center Section: High-Tech Psychedelic Oscilloscope
    const centerSection = document.createElement('div');
    centerSection.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: min(780px, 94vw);
    `;

    // Frequency Badges Row
    const badgesRow = document.createElement('div');
    badgesRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0 8px;
    `;
    badgesRow.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1.5px solid #38bdf8; padding: 4px 10px; border-radius: 8px;">
          👤 Viki: <b id="vibe-p1-freq" style="font-size: 15px;">1.00 Hz</b>
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 800; color: #fbbf24; background: rgba(251, 191, 36, 0.15); border: 1.5px solid #fbbf24; padding: 4px 12px; border-radius: 8px; box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);">
          ⚡ Cél: <b id="vibe-target-freq" style="font-size: 15px;">2.20 Hz</b>
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 800; color: #ec4899; background: rgba(236, 72, 153, 0.15); border: 1.5px solid #ec4899; padding: 4px 10px; border-radius: 8px;">
          👤 Kristóf: <b id="vibe-p2-freq" style="font-size: 15px;">4.40 Hz</b>
        </span>
      </div>
    `;
    centerSection.appendChild(badgesRow);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'vibe-oscilloscope';
    this.canvas.style.cssText = `
      width: 100%;
      height: 180px;
      background: rgba(2, 6, 23, 0.88);
      border: 2px solid rgba(56, 189, 248, 0.45);
      border-radius: 14px;
      box-shadow: inset 0 0 35px rgba(0, 0, 0, 0.9), 0 0 25px rgba(56, 189, 248, 0.25);
    `;
    this.canvas.width = 780;
    this.canvas.height = 180;
    this.ctx = this.canvas.getContext('2d');
    centerSection.appendChild(this.canvas);

    // Status Banner under Oscilloscope
    this.statusBannerEl = document.createElement('div');
    this.statusBannerEl.style.cssText = `
      font-size: 16px;
      font-weight: 800;
      color: #cbd5e1;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 6px 16px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.15);
      width: 100%;
      box-sizing: border-box;
      transition: all 0.2s ease;
    `;
    this.statusBannerEl.textContent = 'Hangoljátok a hullámokat az arany kozmikus frekvenciára!';
    centerSection.appendChild(this.statusBannerEl);

    this.overlay.appendChild(centerSection);

    // 3. Lower Section: Telepathic Banter Card & Controls Guide
    const lowerCard = document.createElement('div');
    lowerCard.style.cssText = `
      width: min(780px, 94vw);
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid rgba(236, 72, 153, 0.45);
      border-radius: 14px;
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
    `;

    // Banter box (speech bubbles)
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 12px;
      background: rgba(2, 6, 23, 0.6);
      border-radius: 8px;
      border-left: 3.5px solid #38bdf8;
    `;
    this.dialogueSpeakerEl = document.createElement('div');
    this.dialogueSpeakerEl.style.cssText = `
      font-size: 13px;
      font-weight: 900;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    `;
    this.dialogueSpeakerEl.textContent = '💭 Telepatikus Kapcsolat';
    this.dialogueTextEl = document.createElement('div');
    this.dialogueTextEl.style.cssText = `
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      line-height: 1.35;
    `;
    this.dialogueTextEl.textContent = 'Üljetek a fal tövébe... a tudat összeolvad Bilbao éjszakai ritmusával.';
    this.dialogueBox.appendChild(this.dialogueSpeakerEl);
    this.dialogueBox.appendChild(this.dialogueTextEl);
    lowerCard.appendChild(this.dialogueBox);

    // Controls Guide (Grid)
    const controlsGuide = document.createElement('div');
    controlsGuide.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px;
    `;
    controlsGuide.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 3px; font-size: 13px;">
        <span style="font-weight: 800; color: #38bdf8;">👤 Viki frekvencia-hangolás:</span>
        <span style="color: #cbd5e1;">🎮 <b>Bal Kar (LS ◄►)</b> / D-Pad &bull; ⌨️ <b>[A] / [D]</b></span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 3px; font-size: 13px;">
        <span style="font-weight: 800; color: #ec4899;">👤 Kristóf frekvencia-hangolás:</span>
        <span style="color: #cbd5e1;">🎮 <b>Jobb Kar (RS ◄►)</b> / LB-RB / GP2 &bull; ⌨️ <b>Nyilak [◄] [►]</b></span>
      </div>
    `;
    lowerCard.appendChild(controlsGuide);

    // Action Hit & Exit Bar
    const actionRow = document.createElement('div');
    actionRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 6px;
    `;
    actionRow.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="color: #fbbf24; font-weight: 900;">⚡ Pulzus ritmus-ütés:</span>
        <kbd style="background: rgba(251, 191, 36, 0.2); border: 1px solid #fbbf24; padding: 2px 6px; border-radius: 4px; color: #fbbf24; font-weight: 800;">(A) / RT / [Space]</kbd>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span>Felállás a falból:</span>
        <kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #f8fafc;">[Esc] / [E] / 🎮 (B / Back)</kbd>
      </div>
    `;
    lowerCard.appendChild(actionRow);

    this.overlay.appendChild(lowerCard);
    document.body.appendChild(this.overlay);

    // Cache elements
    this.stageTitleEl = this.overlay.querySelector('#vibe-stage-title');
    this.stageSubtextEl = this.overlay.querySelector('#vibe-stage-subtext');
    this.tripBarFill = this.overlay.querySelector('#vibe-trip-bar');
    this.tripText = this.overlay.querySelector('#vibe-trip-text');
    this.p1FreqBadge = this.overlay.querySelector('#vibe-p1-freq');
    this.p2FreqBadge = this.overlay.querySelector('#vibe-p2-freq');
    this.targetFreqBadge = this.overlay.querySelector('#vibe-target-freq');

    this.setupKeyboardListeners();
  }

  private setupKeyboardListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;

      this.heldKeys.add(e.code);
      this.heldKeys.add(e.key);

      // Exit / Stand up
      if (e.key === 'Escape') {
        this.stopChillMode();
        return;
      }

      // Rhythm Sync Pulse Action Hit on Keydown
      if (
        (e.code === 'Space' || e.key === ' ' || e.key.toLowerCase() === 'e' || e.code === 'Enter') &&
        !e.repeat
      ) {
        this.handlePulseTap();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.heldKeys.delete(e.code);
      this.heldKeys.delete(e.key);
    });
  }

  public startChillMode(
    p1: Player,
    p2: Player,
    spotPos: THREE.Vector3,
    wallFacingAngle: number,
    cameraRig: CameraRig,
    postProcess: PostProcessManager,
    level: Level
  ): void {
    this.isActive = true;
    this.p1Ref = p1;
    this.p2Ref = p2;
    this.cameraRigRef = cameraRig;
    this.postProcessRef = postProcess;
    this.levelRef = level;

    // Seating positions against retaining wall (spaced ~0.9m apart)
    const perpX = Math.cos(wallFacingAngle);
    const perpZ = -Math.sin(wallFacingAngle);

    const seatP1 = new THREE.Vector3(
      spotPos.x - perpX * 0.45,
      spotPos.y,
      spotPos.z - perpZ * 0.45
    );
    const seatP2 = new THREE.Vector3(
      spotPos.x + perpX * 0.45,
      spotPos.y,
      spotPos.z + perpZ * 0.45
    );

    p1.setChillMode(true, seatP1, wallFacingAngle);
    p2.setChillMode(true, seatP2, wallFacingAngle);

    // Switch camera to low 3/4 panoramic angle framing seated players and city skyline
    cameraRig.startWallChillCamera(spotPos, wallFacingAngle);

    // Start audio ambience
    audioManager.startEtxebarriaParkAmbience();
    audioManager.setParkTripIntensity(this.tripLevel);

    // Reset minigame parameters if not completed
    if (!this.isComplete) {
      this.stageIndex = Math.min(3, Math.floor((this.tripLevel - 0.20) / 0.20));
      this.targetFreq = VIBE_STAGES[this.stageIndex]?.targetFreq ?? 2.2;
      this.p1Freq = Math.max(0.8, this.targetFreq - 1.2);
      this.p2Freq = Math.min(5.2, this.targetFreq + 1.8);
      this.pulseTimer = 0;
      this.hitFeedbackText = '';
      this.particles = [];
      this.applyStageDetails();
    } else {
      this.showCompletedState();
    }

    // Fade in UI
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      setTimeout(() => {
        if (this.overlay) this.overlay.style.opacity = '1';
      }, 50);
    }
  }

  public stopChillMode(): void {
    if (!this.isActive) return;
    this.isActive = false;

    if (this.p1Ref) this.p1Ref.setChillMode(false);
    if (this.p2Ref) this.p2Ref.setChillMode(false);

    if (this.cameraRigRef) {
      this.cameraRigRef.endWallChillCamera();
    }

    audioManager.stopEtxebarriaParkAmbience();

    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay && !this.isActive) {
          this.overlay.style.display = 'none';
        }
      }, 350);
    }
  }

  private applyStageDetails(): void {
    const stage = VIBE_STAGES[this.stageIndex] || VIBE_STAGES[0];
    this.targetFreq = stage.targetFreq;

    if (this.stageTitleEl) {
      this.stageTitleEl.innerHTML = `<span style="font-size: 18px;">✨</span> ${stage.name}`;
    }
    if (this.stageSubtextEl) {
      this.stageSubtextEl.textContent = stage.subtext;
    }
    if (this.targetFreqBadge) {
      this.targetFreqBadge.textContent = `${this.targetFreq.toFixed(2)} Hz`;
    }
  }

  private showCompletedState(): void {
    if (this.stageTitleEl) {
      this.stageTitleEl.innerHTML = `🌟 100% TUDAT-FÚZIÓ ELÉRVE`;
    }
    if (this.stageSubtextEl) {
      this.stageSubtextEl.textContent = 'A tudat-összhang teljes! A focipálya portálja nyitva áll a hegytetőn!';
    }
    if (this.statusBannerEl) {
      this.statusBannerEl.textContent = '✨ A PORTÁL NYITVA! ÁLLJATOK FEL ÉS LÉPJETEK BE!';
      this.statusBannerEl.style.color = '#34d399';
      this.statusBannerEl.style.borderColor = '#34d399';
    }
    if (this.dialogueTextEl) {
      this.dialogueTextEl.textContent = 'Minden rezgés a helyére került. Mehetünk a portálhoz!';
    }
  }

  private handlePulseTap(): void {
    if (this.isComplete) {
      // Completed, pulse just plays pleasant chord
      audioManager.playVibeChord(3);
      return;
    }

    const pulsePhase = (this.pulseTimer % this.pulseDuration) / this.pulseDuration;
    // Ring shrinks from 65px down to 20px
    const currentRadius = 65 - pulsePhase * 45;
    const isTimingAccurate = Math.abs(currentRadius - this.targetRadius) <= 7.0;

    if (this.isResonanceLocked && isTimingAccurate) {
      // --- PERFECT RHYTHM SYNC HIT! ---
      this.handlePerfectHit();
    } else if (!this.isResonanceLocked) {
      // Miss: Frequencies not yet aligned
      audioManager.playParanoidGiggle();
      this.hitFeedbackText = '⚠️ A hullámok nincsenek összhangban! Előbb hangoljatok!';
      this.hitFeedbackColor = '#f87171';
      this.hitFeedbackTimer = 1.6;
    } else {
      // Miss: Rhythm timing off
      audioManager.playParanoidGiggle();
      this.hitFeedbackText = '⚠️ Rossz ütem! A gyűrű egyezésekor nyomd a gombot!';
      this.hitFeedbackColor = '#fbbf24';
      this.hitFeedbackTimer = 1.6;
    }
  }

  private handlePerfectHit(): void {
    const curStage = VIBE_STAGES[this.stageIndex] || VIBE_STAGES[0];

    // Spawn fireworks / spark particles on canvas
    this.spawnParticles(40);

    // Audio harmonic progression chord
    audioManager.playVibeChord(this.stageIndex);

    // Advance Trip Intensity by +20%
    this.advanceTrip(0.20);

    // Display stoner dialogue banter
    this.banterSpeaker = 'Viki & Kristóf';
    this.banterQuote = `Viki: "${curStage.p1Quote}"\nKristóf: "${curStage.p2Quote}"`;
    this.banterTimer = 5.0;

    if (this.p1Ref) this.p1Ref.say(curStage.p1Quote, 4.0);
    setTimeout(() => {
      if (this.p2Ref) this.p2Ref.say(curStage.p2Quote, 4.0);
    }, 1400);

    // Feedback message
    this.hitFeedbackText = `⚡ TÖKÉLETES SZINKRON! (+20% TUDAT-FÚZIÓ)`;
    this.hitFeedbackColor = '#34d399';
    this.hitFeedbackTimer = 2.0;

    // Advance to next stage or finish
    this.stageIndex++;
    if (this.stageIndex >= VIBE_STAGES.length || this.tripLevel >= 1.0) {
      this.triggerClimaxCompletion();
    } else {
      this.applyStageDetails();
      // Scatter player waves slightly away for the next stage challenge
      this.p1Freq = Math.max(0.8, this.targetFreq - 1.4);
      this.p2Freq = Math.min(5.2, this.targetFreq + 1.4);
    }
  }

  public advanceTrip(amount: number): void {
    this.tripLevel = Math.min(1.0, this.tripLevel + amount);
    this.updateTripVisuals();

    if (this.tripLevel >= 1.0 && !this.isComplete) {
      this.triggerClimaxCompletion();
    }
  }

  private updateTripVisuals(): void {
    const percent = Math.round(this.tripLevel * 100);
    if (this.tripText) {
      this.tripText.textContent = `TRIP: ${percent}%`;
    }
    if (this.tripBarFill) {
      this.tripBarFill.style.width = `${percent}%`;
    }

    if (this.postProcessRef) {
      this.postProcessRef.setIntensity(this.tripLevel);
    }

    audioManager.setParkTripIntensity(this.tripLevel);

    if (this.levelRef) {
      this.levelRef.group.traverse((obj) => {
        if (obj instanceof THREE.Group) {
          if (obj.name === 'SoccerFloodlight') {
            setFloodlightTripGlow(obj, this.tripLevel);
          } else if (obj.name === 'BilbaoPanoramaBackdrop') {
            setPanoramaTripLevel(obj, this.tripLevel);
          }
        }
      });
    }
  }

  private triggerClimaxCompletion(): void {
    this.isComplete = true;
    this.tripLevel = 1.0;
    this.updateTripVisuals();
    this.showCompletedState();

    audioManager.playVibeChord(3);

    if (this.p1Ref && this.p2Ref) {
      this.p1Ref.say('🌟 Teljes tudati fúzió! Bilbao panorámája megnyílt előttünk!', 4.5);
      setTimeout(() => {
        this.p2Ref?.say('✨ Megvan a megvilágosodás! Szabad a portál a hegytetőn!', 4.5);
      }, 1500);
    }
  }

  private spawnParticles(count: number): void {
    if (!this.canvas) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    const colors = ['#38bdf8', '#ec4899', '#fbbf24', '#34d399', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 0.8 + Math.random() * 0.7,
        size: 2.5 + Math.random() * 3.5,
      });
    }
  }

  public update(delta: number): void {
    if (!this.isActive) return;

    // 1. Controller & Keyboard Exit Polling
    if (
      inputManager.isAnyButtonJustPressed(XboxButton.BACK) ||
      inputManager.isAnyButtonJustPressed(XboxButton.START) ||
      (this.isComplete && inputManager.isAnyButtonJustPressed(XboxButton.B))
    ) {
      this.stopChillMode();
      return;
    }

    // 2. Controller Action Pulse Hit Polling
    if (
      inputManager.isAnyButtonJustPressed(XboxButton.A) ||
      inputManager.isAnyButtonJustPressed(XboxButton.X) ||
      inputManager.isAnyButtonJustPressed(XboxButton.RT)
    ) {
      this.handlePulseTap();
    }

    // 3. Frequency Steering Controls
    const steerSpeed = 2.4; // Hz per second

    // Player 1 (Viki) Steering: Gamepad 0 LS ◄► / D-Pad, or Keyboard A / D
    let p1Dir = 0;
    const gp0 = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp0 && gp0.connected) {
      const stickX = inputManager.applyDeadzone(gp0.axes[0] ?? 0);
      if (Math.abs(stickX) > 0.15) p1Dir = stickX;
      if (inputManager.isButtonDown(0, XboxButton.DPAD_LEFT)) p1Dir = -1;
      if (inputManager.isButtonDown(0, XboxButton.DPAD_RIGHT)) p1Dir = 1;
    }
    if (p1Dir === 0) {
      if (this.heldKeys.has('KeyA') || this.heldKeys.has('a') || this.heldKeys.has('1')) p1Dir -= 1;
      if (this.heldKeys.has('KeyD') || this.heldKeys.has('d') || this.heldKeys.has('2')) p1Dir += 1;
    }
    this.p1Freq = Math.max(0.6, Math.min(5.6, this.p1Freq + p1Dir * steerSpeed * delta));

    // Player 2 (Kristóf) Steering:
    // If Gamepad 1 connected: Gamepad 1 LS ◄► / D-Pad
    // If 1 Gamepad: Gamepad 0 RS ◄► (axes[2]) or Bumpers LB/RB
    // Keyboard: ArrowLeft / ArrowRight / J / L
    let p2Dir = 0;
    const gp1 = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads()[1] : null;
    if (gp1 && gp1.connected) {
      const stickX2 = inputManager.applyDeadzone(gp1.axes[0] ?? 0);
      if (Math.abs(stickX2) > 0.15) p2Dir = stickX2;
      if (inputManager.isButtonDown(1, XboxButton.DPAD_LEFT)) p2Dir = -1;
      if (inputManager.isButtonDown(1, XboxButton.DPAD_RIGHT)) p2Dir = 1;
    } else if (gp0 && gp0.connected) {
      // Couch co-op sharing Gamepad 0
      const rsX = inputManager.applyDeadzone(gp0.axes[2] ?? 0);
      if (Math.abs(rsX) > 0.15) p2Dir = rsX;
      if (inputManager.isButtonDown(0, XboxButton.LB)) p2Dir -= 1;
      if (inputManager.isButtonDown(0, XboxButton.RB)) p2Dir += 1;
    }
    if (p2Dir === 0) {
      if (this.heldKeys.has('ArrowLeft') || this.heldKeys.has('KeyJ') || this.heldKeys.has('j') || this.heldKeys.has('7')) p2Dir -= 1;
      if (this.heldKeys.has('ArrowRight') || this.heldKeys.has('KeyL') || this.heldKeys.has('l') || this.heldKeys.has('9')) p2Dir += 1;
    }
    this.p2Freq = Math.max(0.6, Math.min(5.6, this.p2Freq + p2Dir * steerSpeed * delta));

    // Subtle magnetic tactile notch when close to target frequency
    const p1Dist = Math.abs(this.p1Freq - this.targetFreq);
    if (p1Dist < 0.22 && p1Dir === 0) {
      this.p1Freq += (this.targetFreq - this.p1Freq) * delta * 2.0;
    }
    const p2Dist = Math.abs(this.p2Freq - this.targetFreq);
    if (p2Dist < 0.22 && p2Dir === 0) {
      this.p2Freq += (this.targetFreq - this.p2Freq) * delta * 2.0;
    }

    // 4. Resonance Lock Evaluation
    const p1InSync = p1Dist <= this.tolerance;
    const p2InSync = p2Dist <= this.tolerance;
    const wasLocked = this.isResonanceLocked;
    this.isResonanceLocked = p1InSync && p2InSync;

    if (this.isResonanceLocked) {
      this.lockHoldTime += delta;
      if (!wasLocked) {
        audioManager.playMindMeldSync();
      }
    } else {
      this.lockHoldTime = 0;
    }

    // Update Frequency Badges Text
    if (this.p1FreqBadge) {
      this.p1FreqBadge.textContent = `${this.p1Freq.toFixed(2)} Hz`;
      this.p1FreqBadge.style.color = p1InSync ? '#34d399' : '#38bdf8';
    }
    if (this.p2FreqBadge) {
      this.p2FreqBadge.textContent = `${this.p2Freq.toFixed(2)} Hz`;
      this.p2FreqBadge.style.color = p2InSync ? '#34d399' : '#ec4899';
    }

    // 5. Update Status Banner & Feedback
    if (this.hitFeedbackTimer > 0) {
      this.hitFeedbackTimer -= delta;
      if (this.statusBannerEl) {
        this.statusBannerEl.textContent = this.hitFeedbackText;
        this.statusBannerEl.style.color = this.hitFeedbackColor;
        this.statusBannerEl.style.borderColor = this.hitFeedbackColor;
      }
    } else if (this.isComplete) {
      this.showCompletedState();
    } else if (this.isResonanceLocked) {
      if (this.statusBannerEl) {
        this.statusBannerEl.textContent = '⚡ TÖKÉLETES ÖSSZHANG! NYOMJÁTOK MEG AZ (A) / [SPACE] GOMBOT A GYŰRŰNÉL!';
        this.statusBannerEl.style.color = '#34d399';
        this.statusBannerEl.style.borderColor = '#34d399';
      }
    } else if (p1InSync && !p2InSync) {
      if (this.statusBannerEl) {
        this.statusBannerEl.textContent = '✨ Viki ráhangolódott! Kristóf, keresd meg a frekvenciát!';
        this.statusBannerEl.style.color = '#38bdf8';
        this.statusBannerEl.style.borderColor = '#38bdf8';
      }
    } else if (!p1InSync && p2InSync) {
      if (this.statusBannerEl) {
        this.statusBannerEl.textContent = '✨ Kristóf ráhangolódott! Viki, keresd meg a frekvenciát!';
        this.statusBannerEl.style.color = '#ec4899';
        this.statusBannerEl.style.borderColor = '#ec4899';
      }
    } else {
      if (this.statusBannerEl) {
        this.statusBannerEl.textContent = 'Hangoljátok a hullámokat az arany kozmikus frekvenciára!';
        this.statusBannerEl.style.color = '#cbd5e1';
        this.statusBannerEl.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }
    }

    // 6. Banter Dialogue Box timer
    if (this.banterTimer > 0) {
      this.banterTimer -= delta;
      if (this.dialogueTextEl) {
        this.dialogueTextEl.textContent = this.banterQuote;
      }
      if (this.dialogueSpeakerEl) {
        this.dialogueSpeakerEl.textContent = `💭 ${this.banterSpeaker}`;
      }
    }

    // 7. Oscilloscope Animation & Canvas Render
    this.pulseTimer += delta;
    this.animPhase += delta * 4.0;
    this.renderOscilloscope(p1InSync, p2InSync);

    // 8. Particle updates
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 40 * delta; // slight gravity
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 9. Floating neon capsules subtle bobbing in scene
    if (this.levelRef && this.tripLevel > 0.5) {
      this.levelRef.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.rotSpeedY) {
          obj.rotation.y += delta * obj.userData.rotSpeedY;
          obj.position.y =
            obj.userData.baseY +
            Math.sin(this.pulseTimer * obj.userData.floatSpeed + obj.userData.seed) * 0.8;
        }
      });
    }
  }

  private renderOscilloscope(p1InSync: boolean, p2InSync: boolean): void {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerY = h / 2;

    // Clear background
    ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
    ctx.fillRect(0, 0, w, h);

    // Draw CRT subtle grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const stepX = 40;
    for (let x = 0; x < w; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    const stepY = 30;
    for (let y = 0; y < h; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center horizontal dashed baseline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- A. Target Golden Cosmic Wave ---
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = this.isResonanceLocked ? 4.0 : 3.0;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = this.isResonanceLocked ? 18 : 8;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const normX = x / w;
      const y =
        centerY +
        Math.sin(normX * this.targetFreq * Math.PI * 4 + this.animPhase * 0.6) * 36 +
        Math.sin(normX * (this.targetFreq * 2) * Math.PI * 2 + this.animPhase * 1.2) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // --- B. Player 1 (Viki) Electric Cyan Wave ---
    ctx.save();
    ctx.strokeStyle = p1InSync ? '#bae6fd' : '#38bdf8';
    ctx.lineWidth = p1InSync ? 3.5 : 2.5;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = p1InSync ? 14 : 5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const normX = x / w;
      const y = centerY + Math.sin(normX * this.p1Freq * Math.PI * 4 + this.animPhase) * 30;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // --- C. Player 2 (Kristóf) Neon Pink Wave ---
    ctx.save();
    ctx.strokeStyle = p2InSync ? '#fce7f3' : '#ec4899';
    ctx.lineWidth = p2InSync ? 3.5 : 2.5;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = p2InSync ? 14 : 5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const normX = x / w;
      const y = centerY + Math.sin(normX * this.p2Freq * Math.PI * 4 + this.animPhase) * 30;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // --- D. Luminous Harmonic Merger when Resonance Locked ---
    if (this.isResonanceLocked) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
      ctx.lineWidth = 4.5;
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const normX = x / w;
        const wave1 = Math.sin(normX * this.p1Freq * Math.PI * 4 + this.animPhase);
        const wave2 = Math.sin(normX * this.p2Freq * Math.PI * 4 + this.animPhase);
        const y = centerY + ((wave1 + wave2) / 2) * 34;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- E. Central Cosmic Rhythm Pulse Ring ---
    const cx = w / 2;
    const cy = centerY;

    // Target golden ring (dashed)
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, this.targetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Contracting Pulse Circle
    const pulsePhase = (this.pulseTimer % this.pulseDuration) / this.pulseDuration;
    const ringRadius = 65 - pulsePhase * 45;
    const isTimingSweetSpot = Math.abs(ringRadius - this.targetRadius) <= 7.0;

    ctx.save();
    let ringColor = '#ec4899';
    if (this.isResonanceLocked) {
      ringColor = isTimingSweetSpot ? '#34d399' : '#38bdf8';
    }
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = isTimingSweetSpot && this.isResonanceLocked ? 4.5 : 2.5;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = isTimingSweetSpot && this.isResonanceLocked ? 18 : 6;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(8, ringRadius), 0, Math.PI * 2);
    ctx.stroke();

    // Subtle fill on pulse hit window
    if (this.isResonanceLocked && isTimingSweetSpot) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
      ctx.fill();
    }
    ctx.restore();

    // Center Action Button Prompt (Pulsing)
    ctx.save();
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isResonanceLocked && isTimingSweetSpot) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 12;
      ctx.fillText('MOST! (A)', cx, cy);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText('(A)', cx, cy);
    }
    ctx.restore();

    // --- F. Spark Particles ---
    for (const p of this.particles) {
      const alpha = Math.max(0, 1.0 - p.life / p.maxLife);
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export const vibePuzzle = VibePuzzle.getInstance();

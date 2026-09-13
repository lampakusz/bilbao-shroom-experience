export class AudioManager {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  private sfxVolume = 0.8;

  private lastTetherWarningTime = 0;
  private isUnlocked = false;

  private constructor() {
    this.loadSettings();
    this.setupUnlockListeners();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('sfx_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.sfxVolume = parsed;
        }
      }
    } catch {}
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  public setVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('sfx_volume', this.sfxVolume.toString());
    } catch {}
  }

  public getVolume(): number {
    return this.sfxVolume;
  }

  public async resumeContext(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isUnlocked = true;
      } catch {
        // Ignored if user hasn't interacted yet
      }
    } else {
      this.isUnlocked = true;
    }
  }

  private setupUnlockListeners(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.resumeContext();
      if (this.isUnlocked) {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  /**
   * Procedural SFX: Pressure Plate Step
   * Sine wave beep: 440Hz for single plate, 880Hz chord for dual unlocked
   */
  public playPlateStep(active: boolean, dual = false): void {
    if (!active) return;
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        this.resumeContext();
      }

      const now = ctx.currentTime;

      if (dual) {
        // Dual chord: 880Hz (A5) + 1108.73Hz (C#6) + 1318.51Hz (E6)
        const frequencies = [880, 1108.73, 1318.51];
        for (const freq of frequencies) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

          osc.connect(gain);
          gain.connect(this.sfxGain ?? this.masterGain!);

          osc.start(now);
          osc.stop(now + 0.36);
        }
      } else {
        // Single plate: 440Hz (A4)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain ?? this.masterGain!);

        osc.start(now);
        osc.stop(now + 0.19);
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Interactive Switch / Button Click
   * Crisp tactile mechanical micro-switch click: high transient pop + resonant metal snap
   */
  public playSwitchClick(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // 1. High transient click pulse (1400Hz -> 600Hz, 15ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.015);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      osc.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.02);

      // 2. Resonant mechanical snap (320Hz -> 180Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(320, now + 0.003);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain2.gain.setValueAtTime(0.001, now + 0.003);
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.006);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain ?? this.masterGain!);
      osc2.start(now + 0.003);
      osc2.stop(now + 0.055);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Retro Keypad Button Press Beep
   * Crisp electronic beep (950Hz - 1200Hz)
   */
  public playKeypadBeep(frequency = 1050): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.065);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Keypad Access Granted Positive Chime
   * Ascending high two-tone electronic harmonic (1046Hz [C6] -> 1567Hz [G6] -> 2093Hz [C7])
   */
  public playKeypadSuccess(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      const notes = [
        { freq: 1046.5, time: 0, dur: 0.12 },
        { freq: 1567.98, time: 0.1, dur: 0.15 },
        { freq: 2093.0, time: 0.22, dur: 0.35 },
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.001, now + n.time);
        gain.gain.linearRampToValueAtTime(0.25, now + n.time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(this.sfxGain ?? this.masterGain!);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur + 0.02);
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Door Opening / Barrier Removal
   * Mechanical latch click followed by realistic door hinge swing creak & low rumble
   */
  public playDoorOpen(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        this.resumeContext();
      }

      const now = ctx.currentTime;
      const duration = 0.9;

      // 1. Initial mechanical latch unclamp click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(950, now);
      clickOsc.frequency.exponentialRampToValueAtTime(250, now + 0.025);
      clickGain.gain.setValueAtTime(0.35, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      clickOsc.connect(clickGain);
      clickGain.connect(this.sfxGain ?? this.masterGain!);
      clickOsc.start(now);
      clickOsc.stop(now + 0.035);

      // 2. Door hinge creak / scrape (frequency-modulated bandpass friction)
      const creakOsc = ctx.createOscillator();
      const creakGain = ctx.createGain();
      creakOsc.type = 'sawtooth';
      creakOsc.frequency.setValueAtTime(240, now + 0.02);
      creakOsc.frequency.linearRampToValueAtTime(380, now + 0.25);
      creakOsc.frequency.exponentialRampToValueAtTime(110, now + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 0.3);
      filter.frequency.exponentialRampToValueAtTime(280, now + duration);
      filter.Q.setValueAtTime(3.5, now);

      creakGain.gain.setValueAtTime(0.001, now + 0.02);
      creakGain.gain.linearRampToValueAtTime(0.3, now + 0.1);
      creakGain.gain.linearRampToValueAtTime(0.18, now + duration * 0.6);
      creakGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      creakOsc.connect(filter);
      filter.connect(creakGain);
      creakGain.connect(this.sfxGain ?? this.masterGain!);
      creakOsc.start(now + 0.02);
      creakOsc.stop(now + duration + 0.05);

      // 3. Low-frequency resonant body movement rumble
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumbleOsc.type = 'triangle';
      rumbleOsc.frequency.setValueAtTime(120, now + 0.04);
      rumbleOsc.frequency.exponentialRampToValueAtTime(45, now + duration);

      rumbleGain.gain.setValueAtTime(0.001, now + 0.04);
      rumbleGain.gain.linearRampToValueAtTime(0.25, now + 0.15);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(this.sfxGain ?? this.masterGain!);
      rumbleOsc.start(now + 0.04);
      rumbleOsc.stop(now + duration + 0.05);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Relic Pickup
   * Two quick rising chimes: D5 (587.33Hz) -> A5 (880Hz) with gentle exponential decay
   */
  public playPickup(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        this.resumeContext();
      }

      const now = ctx.currentTime;

      // Note 1: D5 (587.33Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(this.sfxGain ?? this.masterGain!);
      osc1.start(now);
      osc1.stop(now + 0.23);

      // Note 2: A5 (880Hz) slightly delayed
      const t2 = now + 0.08;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, t2);
      gain2.gain.setValueAtTime(0.001, t2);
      gain2.gain.exponentialRampToValueAtTime(0.4, t2 + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.4);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain ?? this.masterGain!);
      osc2.start(t2);
      osc2.stop(t2 + 0.41);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Tether Tension Warning
   * Short dampened low click (120Hz, 40ms duration) with minimum 0.4s cooldown
   */
  public playTetherWarning(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastTetherWarningTime < 400) {
      return;
    }
    this.lastTetherWarningTime = nowMs;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        this.resumeContext();
      }

      const now = ctx.currentTime;
      const duration = 0.04;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // Safe fallback
    }
  }

  private lastCriticalHeartbeatTime = 0;

  /**
   * Procedural SFX: Critical Tether Tension Heartbeat & Low-Pitch Hum
   * Emits faint rhythmic sub-bass pulses (55Hz / 45Hz) when players are stretched beyond 14m
   */
  public playTetherCriticalHeartbeat(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastCriticalHeartbeatTime < 580) {
      return;
    }
    this.lastCriticalHeartbeatTime = nowMs;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // 1. First Heartbeat Thump (lub)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(58, now);
      osc1.frequency.exponentialRampToValueAtTime(42, now + 0.12);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.38, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(this.sfxGain ?? this.masterGain!);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // 2. Second Heartbeat Thump (dub) after 130ms
      const t2 = now + 0.13;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(48, t2);
      osc2.frequency.exponentialRampToValueAtTime(36, t2 + 0.14);

      gain2.gain.setValueAtTime(0.001, t2);
      gain2.gain.linearRampToValueAtTime(0.32, t2 + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.14);

      osc2.connect(gain2);
      gain2.connect(this.sfxGain ?? this.masterGain!);
      osc2.start(t2);
      osc2.stop(t2 + 0.15);

      // 3. Faint low-pitch tension sub-bass drone
      const droneOsc = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc.type = 'triangle';
      droneOsc.frequency.setValueAtTime(65, now);
      droneOsc.frequency.linearRampToValueAtTime(75, now + 0.45);

      droneGain.gain.setValueAtTime(0.001, now);
      droneGain.gain.linearRampToValueAtTime(0.08, now + 0.08);
      droneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      droneOsc.connect(droneGain);
      droneGain.connect(this.sfxGain ?? this.masterGain!);
      droneOsc.start(now);
      droneOsc.stop(now + 0.46);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Ambient Ocean Wave Wash
   * Sweeping ocean surf sound synthesized with pink/brown noise and dynamic resonant filter
   */
  public playOceanWaveWash(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 4.5;

      // 1. Noise buffer for wave foam & spray
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // 2. Modulated low-pass / band-pass filter simulating wave cresting and receding
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.exponentialRampToValueAtTime(750, now + 1.8);
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      noise.start(now);
      noise.stop(now + duration + 0.05);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Finale Sunset Victory Chord Progression
   * Lush, warm ambient pad chords echoing across the ocean horizon
   */
  public playFinaleChords(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // Dsus2 -> Gmaj7 chord notes (frequencies in Hz)
      const chordNotes = [
        146.83, // D3
        220.0,  // A3
        293.66, // D4
        329.63, // E4
        369.99, // F#4
        440.0,  // A4
        587.33  // D5
      ];

      for (let i = 0; i < chordNotes.length; i++) {
        const freq = chordNotes[i];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.6 + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);

        osc.connect(gain);
        gain.connect(this.sfxGain ?? this.masterGain!);

        osc.start(now + i * 0.04);
        osc.stop(now + 5.6);
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Granny Screech Shockwave
   */
  public playGrannyScream(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.55;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      // Pitch sweep with vibrato
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(540, now + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(3.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Dog Bark
   */
  public playDogBark(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.14;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Cashier Register Alert Chime
   */
  public playCashierAlert(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.4;

      // Two high chime tones
      const freqs = [1760, 2637];
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain ?? this.masterGain!);

        osc.start(now);
        osc.stop(now + duration + 0.02);
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Car Horn & Crash / Bump
   */
  public playCarCrash(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // 1. Dual horn honk (F4 + A4)
      const hornFreqs = [349.23, 440.0];
      for (const f of hornFreqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain.gain.setValueAtTime(0.18, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxGain ?? this.masterGain!);

        osc.start(now);
        osc.stop(now + 0.5);
      }

      // 2. Low crunch impact noise
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain ?? this.masterGain!);

      noise.start(now);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Passenger Paranoia Sub Drone
   */
  public playParanoiaHum(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.8;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.linearRampToValueAtTime(65, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Eerie Whispering Murmur for Paranoia / Stares
   */
  public playWhisperParanoia(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 1.2;

      // Bandpass filtered noise with gentle frequency sweep resembling whispers
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.linearRampToValueAtTime(2600, now + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(1800, now + duration);
      filter.Q.setValueAtTime(4.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);

      noise.start(now);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Harsh Hostile / Threat Cue (Sawtooth buzz + metallic scrape + aggressive bite)
   * Triggered when players enter enemy or vehicle aggro / attack radius.
   */
  public playHostileThreat(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.65;

      // 1. Harsh low-frequency dual detuned sawtooth buzz (58Hz and 63Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const subGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(58, now);
      osc2.frequency.setValueAtTime(63.5, now);
      osc1.frequency.exponentialRampToValueAtTime(38, now + duration);
      osc2.frequency.exponentialRampToValueAtTime(42, now + duration);

      // Low-pass filter with resonant grit
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(280, now);
      subFilter.Q.setValueAtTime(5.0, now);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.28, now + 0.03);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(subFilter);
      osc2.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(this.sfxGain ?? this.masterGain!);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + duration + 0.05);

      // 2. High metallic scrape / screech (bandpass filtered noise with fast sweep)
      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.1);
      }
      const scrapeSource = ctx.createBufferSource();
      scrapeSource.buffer = noiseBuffer;

      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.setValueAtTime(2600, now);
      scrapeFilter.frequency.exponentialRampToValueAtTime(750, now + 0.35);
      scrapeFilter.Q.setValueAtTime(8.0, now);

      const scrapeGain = ctx.createGain();
      scrapeGain.gain.setValueAtTime(0.001, now);
      scrapeGain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      scrapeSource.connect(scrapeFilter);
      scrapeFilter.connect(scrapeGain);
      scrapeGain.connect(this.sfxGain ?? this.masterGain!);

      scrapeSource.start(now);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Eerie Passive Scrutiny Chime (High-pitch binaural chime with stereo flanging)
   * Triggered when bystanders or beach walkers observe players within scrutiny radius.
   */
  public playPassiveScrutinyChime(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 1.35;

      // 1. Binaural detuned high crystal bells (1760Hz and 1766Hz -> 6Hz uncanny binaural beat)
      const f1 = 1760;
      const f2 = 1766;

      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      oscLeft.type = 'sine';
      oscRight.type = 'sine';
      oscLeft.frequency.setValueAtTime(f1, now);
      oscRight.frequency.setValueAtTime(f2, now);
      oscLeft.frequency.exponentialRampToValueAtTime(f1 * 0.96, now + duration);
      oscRight.frequency.exponentialRampToValueAtTime(f2 * 0.96, now + duration);

      // High harmonic overtone for glass resonance
      const oscHarmonic = ctx.createOscillator();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(f1 * 2, now);
      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.04, now);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      oscHarmonic.connect(harmGain);
      harmGain.connect(chimeGain);
      oscHarmonic.start(now);
      oscHarmonic.stop(now + 0.65);

      chimeGain.gain.setValueAtTime(0.001, now);
      chimeGain.gain.linearRampToValueAtTime(0.14, now + 0.05);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscLeft.connect(chimeGain);
      oscRight.connect(chimeGain);

      // Stereo flange panner
      if ('createStereoPanner' in ctx) {
        const panner = (ctx as any).createStereoPanner();
        panner.pan.setValueAtTime(-0.4, now);
        panner.pan.linearRampToValueAtTime(0.4, now + duration);
        chimeGain.connect(panner);
        panner.connect(this.sfxGain ?? this.masterGain!);
      } else {
        chimeGain.connect(this.sfxGain ?? this.masterGain!);
      }

      oscLeft.start(now);
      oscRight.start(now);
      oscLeft.stop(now + duration + 0.05);
      oscRight.stop(now + duration + 0.05);
    } catch {
      // Safe fallback
    }
  }

  private lastHeavyGruntTime = 0;

  /**
   * Procedural SFX: Solo Heavy-Push Effort Grunt
   * Short strained human grunt (sawtooth pitch drop + breathy noise burst) when a lone
   * player fails to budge a cooperative heavy obstacle. Self-throttled to avoid spam.
   */
  public playHeavyPushGrunt(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHeavyGruntTime < 700) return;
    this.lastHeavyGruntTime = nowMs;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.28;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + duration);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);
      osc.start(now);
      osc.stop(now + duration + 0.02);

      // Breathy noise burst layered under the grunt
      const bufferSize = Math.floor(ctx.sampleRate * 0.15);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(700, now);
      noiseFilter.Q.setValueAtTime(1.2, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain ?? this.masterGain!);
      noise.start(now);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Procedural SFX: Heavy Object Drag / Scrape
   * Gritty low-frequency scraping friction, meant to be re-triggered periodically
   * while both players are actively channeling a cooperative push.
   */
  public playHeavyDragScrape(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;
      const duration = 0.4;

      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = data[i];
        data[i] *= 2.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.linearRampToValueAtTime(340, now + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(160, now + duration);
      filter.Q.setValueAtTime(2.2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain ?? this.masterGain!);
      noise.start(now);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Play narrative or character voice clip via VoiceManager.
   * Gracefully ignores missing files or network errors.
   */
  public async playVoice(voiceKey?: string): Promise<void> {
    if (!voiceKey) return;
    try {
      const { VoiceManager } = await import('./VoiceManager.ts');
      const filename = voiceKey.endsWith('.mp3') ? voiceKey : `${voiceKey}.mp3`;
      VoiceManager.getInstance().playVoice('narrative', filename);
    } catch {
      // Safe fallback
    }
  }

  // ==========================================================================
  // Etxebarria Park & Bilbao Panorama Vibe Ambience System
  // ==========================================================================
  private parkAmbienceNodes?: {
    masterGain: GainNode;
    padFilter: BiquadFilterNode;
    padGain: GainNode;
    sources: (AudioNode | OscillatorNode)[];
  };
  private parkSoccerTimer?: number;

  /**
   * Starts ambient audio for Etxebarria Park:
   * - Distant city hum & highway rumble.
   * - Downtempo ambient lofi synth chord pad whose low-pass filter dynamically opens up with tripLevel.
   * - Muffled distant football kicks and shouts from the upper pitch.
   */
  public startEtxebarriaParkAmbience(): void {
    if (this.parkAmbienceNodes) return;
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.7, now + 2.0);
      masterGain.connect(this.masterGain!);

      // 1. Distant City Hum (Sub Rumble + Filtered Pink Noise)
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.18, now);
      subOsc.connect(subGain);
      subGain.connect(masterGain);
      subOsc.start(now);

      // Lowpass city noise buffer
      const noiseSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < noiseSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.08;
        b2 = 0.90 * b2 + white * 0.12;
        output[i] = (b0 + b1 + b2) * 0.4;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const cityFilter = ctx.createBiquadFilter();
      cityFilter.type = 'lowpass';
      cityFilter.frequency.setValueAtTime(240, now);
      const cityNoiseGain = ctx.createGain();
      cityNoiseGain.gain.setValueAtTime(0.25, now);

      noiseSource.connect(cityFilter);
      cityFilter.connect(cityNoiseGain);
      cityNoiseGain.connect(masterGain);
      noiseSource.start(now);

      // 2. Downtempo Ambient Lofi Synth Pad (Dm9 chord: D3, F3, A3, C4, E4)
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(320, now); // Starts warm and muted
      padFilter.Q.setValueAtTime(2.5, now);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.14, now);
      padGain.connect(masterGain);
      padFilter.connect(padGain);

      const chordFreqs = [146.83, 174.61, 220.0, 261.63, 329.63]; // D3, F3, A3, C4, E4
      const padOscs: OscillatorNode[] = [];
      chordFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        // Subtle slow chorus detune
        osc.detune.setValueAtTime((idx - 2) * 3.5, now);
        osc.connect(padFilter);
        osc.start(now);
        padOscs.push(osc);
      });

      this.parkAmbienceNodes = {
        masterGain,
        padFilter,
        padGain,
        sources: [subOsc, noiseSource, ...padOscs],
      };

      // 3. Intermittent Muffled Soccer Kicks
      this.parkSoccerTimer = window.setInterval(() => {
        if (Math.random() > 0.4) {
          this.playDistantSoccerKick();
        }
      }, 7000);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Modulates park ambient synth filter based on trip intensity.
   * Opens cutoff from 320Hz up to 2800Hz as tripLevel advances.
   */
  public setParkTripIntensity(tripLevel: number): void {
    if (!this.parkAmbienceNodes) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const t = Math.max(0, Math.min(1, tripLevel));
      // Exponential sweep: 320Hz (dusk chill) -> 2600Hz (radiant psychedelic vibe)
      const targetFreq = 320 + Math.pow(t, 1.4) * 2280;
      this.parkAmbienceNodes.padFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
      this.parkAmbienceNodes.padGain.gain.setTargetAtTime(0.14 + t * 0.16, now, 0.15);
    } catch {}
  }

  /**
   * Stops park ambient soundscape.
   */
  public stopEtxebarriaParkAmbience(): void {
    if (this.parkSoccerTimer) {
      clearInterval(this.parkSoccerTimer);
      this.parkSoccerTimer = undefined;
    }
    if (!this.parkAmbienceNodes) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const nodes = this.parkAmbienceNodes;
      nodes.masterGain.gain.setTargetAtTime(0.001, now, 0.4);
      setTimeout(() => {
        nodes.sources.forEach((s) => {
          if (s instanceof AudioScheduledSourceNode) {
            try { s.stop(); } catch {}
          }
        });
      }, 1200);
      this.parkAmbienceNodes = undefined;
    } catch {
      this.parkAmbienceNodes = undefined;
    }
  }

  /**
   * Procedural SFX: Muffled soccer ball thump from the upper terrace pitch.
   */
  public playDistantSoccerKick(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  /**
   * Procedural SFX: Harmonic Telepathic Resonance Chord.
   * Plays a lush 4-note ethereal synth chord when players synchronize thoughts in the Vibe Puzzle.
   */
  public playVibeChord(step: number = 0): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // Chord progressions: Fmaj9 -> Am9 -> Dm9 -> Cmaj7
      const chords = [
        [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
        [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
        [146.83, 220.0, 261.63, 349.23, 440.0], // Dm9
        [261.63, 329.63, 392.0, 493.88, 523.25], // Cmaj7
      ];
      const selectedChord = chords[step % chords.length];

      selectedChord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const delay = idx * 0.04;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.16 / selectedChord.length, now + delay + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.8);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + delay);
        osc.stop(now + delay + 2.0);
      });
    } catch {}
  }

  /**
   * Procedural SFX: Mind-Meld Rhythm Sync Chime.
   * Played when players tap action in sync with the breathing rhythm circle.
   */
  public playMindMeldSync(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(528, now); // Solfeggio 528Hz love/miracle tone
      osc2.frequency.setValueAtTime(1056, now); // 1-octave harmonic

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.9);
      osc2.stop(now + 0.9);
    } catch {}
  }

  /**
   * Procedural SFX: Gentle Shroom Giggle / Chuckle.
   * Played on thought desynchronization (humorous and friendly, zero penalty).
   */
  public playParanoidGiggle(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') this.resumeContext();
      const now = ctx.currentTime;

      // 4 bouncy staccato chuckles with formant sweep
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startPitch = 340 + i * 25 + Math.random() * 20;
        osc.frequency.setValueAtTime(startPitch, now + i * 0.11);
        osc.frequency.linearRampToValueAtTime(startPitch + 60, now + i * 0.11 + 0.04);
        osc.frequency.linearRampToValueAtTime(startPitch - 20, now + i * 0.11 + 0.09);

        gain.gain.setValueAtTime(0.001, now + i * 0.11);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.11);
      }
    } catch {}
  }
}

export const audioManager = AudioManager.getInstance();

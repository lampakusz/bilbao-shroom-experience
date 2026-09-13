import { audioManager } from './AudioManager.ts';

const APP_BASE = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
const BASE_PATH = APP_BASE.replace(/\/$/, '') + '/audio/voices/';

// Per-character scripted line clips (see VOICE_SCRIPTS.md), one subfolder per character:
// public/audio/voice/viki/<clipId>.mp3, public/audio/voice/kristof/<clipId>.mp3
const CHARACTER_VOICE_BASE_PATH = APP_BASE.replace(/\/$/, '') + '/audio/voice/';

export type VoiceCharacter = 'viki' | 'kristof';

interface ShuffleBag {
  available: string[];
  spent: string[];
}

export class VoiceManager {
  private static instance: VoiceManager | null = null;

  private bufferCache = new Map<string, AudioBuffer | null>();
  private shuffleBags = new Map<string, ShuffleBag>();
  private lastPlayedTimestamps = new Map<string, number>();

  // Cooldown durations in seconds per category
  private categoryCooldowns = new Map<string, number>([
    ['plate', 5.0],
    ['puzzle', 5.0],
    ['relic', 4.0],
    ['tether', 6.0],
    ['idle', 10.0],
    ['narrative', 0.5],
  ]);

  private voiceVolume = 0.8;
  private voiceGain: GainNode | null = null;

  private constructor() {
    try {
      const saved = localStorage.getItem('voice_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.voiceVolume = parsed;
        }
      }
    } catch {}
  }

  public static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  public getVoiceGain(): GainNode | null {
    if (!this.voiceGain) {
      try {
        const ctx = audioManager.getContext();
        this.voiceGain = ctx.createGain();
        this.voiceGain.gain.setValueAtTime(this.voiceVolume, ctx.currentTime);
        this.voiceGain.connect(audioManager.masterGain ?? ctx.destination);
      } catch {}
    }
    return this.voiceGain;
  }

  public setVolume(vol: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, vol));
    try {
      const gain = this.getVoiceGain();
      if (gain) {
        const ctx = audioManager.getContext();
        gain.gain.setValueAtTime(this.voiceVolume, ctx.currentTime);
      }
      localStorage.setItem('voice_volume', this.voiceVolume.toString());
    } catch {}
  }

  public getVolume(): number {
    return this.voiceVolume;
  }

  public setCategoryCooldown(category: string, seconds: number): void {
    this.categoryCooldowns.set(category, seconds);
  }

  /**
   * Play a specific voice file if cooldown allows and audio asset is valid.
   * Silently skips missing files, 404s, or SPA HTML fallbacks.
   */
  public async playVoice(category: string, filename: string): Promise<void> {
    return this.loadAndPlay(category, filename, `${BASE_PATH}${filename}`);
  }

  /**
   * Play a scripted per-character line (VOICE_SCRIPTS.md), e.g.
   * playCharacterClip('viki', 'relic_pickup') -> public/audio/voice/viki/relic_pickup.m4a
   * .m4a (not .mp3) because that's the format the actual recorded clips were delivered in -
   * Chromium's decodeAudioData handles AAC-in-M4A natively, no transcoding needed.
   * Same zero-crash guarantee as playVoice: a clip that hasn't been recorded yet just
   * silently does nothing, so callers can always pair it with Player.say() for the subtitle.
   */
  public async playCharacterClip(character: VoiceCharacter, clipId: string, category?: string): Promise<void> {
    const cacheKey = `character/${character}/${clipId}`;
    const url = `${CHARACTER_VOICE_BASE_PATH}${character}/${clipId}.m4a`;
    return this.loadAndPlay(category ?? clipId, cacheKey, url);
  }

  /**
   * Shared fetch/decode/cooldown/cache pipeline behind playVoice and playCharacterClip.
   * Silently skips missing files, non-2xx responses, or SPA index.html fallbacks so a
   * not-yet-recorded voice clip never throws or blocks the caller.
   */
  private async loadAndPlay(category: string, cacheKey: string, url: string): Promise<void> {
    const now = performance.now();
    const lastPlayed = this.lastPlayedTimestamps.get(category) ?? -Infinity;
    const cooldownMs = (this.categoryCooldowns.get(category) ?? 5.0) * 1000;

    if (now - lastPlayed < cooldownMs) {
      return;
    }

    // Check buffer cache
    if (this.bufferCache.has(cacheKey)) {
      const cached = this.bufferCache.get(cacheKey);
      if (cached) {
        this.lastPlayedTimestamps.set(category, now);
        this.playBuffer(cached);
      }
      return;
    }

    // Fetch and decode safely
    try {
      const response = await fetch(url);

      if (!response.ok) {
        this.bufferCache.set(cacheKey, null);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      // Ensure Vite/SPA hasn't returned index.html fallback
      if (contentType.toLowerCase().includes('text/html')) {
        this.bufferCache.set(cacheKey, null);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const ctx = audioManager.getContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      this.bufferCache.set(cacheKey, decodedBuffer);
      this.lastPlayedTimestamps.set(category, now);
      this.playBuffer(decodedBuffer);
    } catch {
      // Return silently on network or decode failures to guarantee zero-crash behavior
      this.bufferCache.set(cacheKey, null);
    }
  }

  /**
   * Shuffle Bag Pattern:
   * Guarantees all clips in a pool are played once before shuffling and repeating.
   */
  public async playShuffle(category: string, filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;

    let bag = this.shuffleBags.get(category);
    if (!bag) {
      bag = { available: [], spent: [] };
      this.shuffleBags.set(category, bag);
    }

    if (bag.available.length === 0) {
      bag.available = [...filenames];
      // Fisher-Yates shuffle
      for (let i = bag.available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag.available[i], bag.available[j]] = [bag.available[j], bag.available[i]];
      }
      bag.spent = [];
    }

    const nextFile = bag.available.pop();
    if (nextFile) {
      bag.spent.push(nextFile);
      await this.playVoice(category, nextFile);
    }
  }

  private playBuffer(buffer: AudioBuffer): void {
    try {
      const ctx = audioManager.getContext();
      if (ctx.state === 'suspended') {
        audioManager.resumeContext();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const voiceGain = this.getVoiceGain();
      if (voiceGain) {
        source.connect(voiceGain);
      } else {
        source.connect(audioManager.masterGain ?? ctx.destination);
      }
      source.start(0);
    } catch {
      // Safe fallback
    }
  }
}

export const voiceManager = VoiceManager.getInstance();

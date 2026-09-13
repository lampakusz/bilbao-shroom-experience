/**
 * MusicManager.ts
 * Manages dynamic per-level background music (BGM) with smooth 1.2s crossfading,
 * browser autoplay policy handling, graceful 404 fallback, and volume/mute controls.
 */

export class MusicManager {
  private static instance: MusicManager | null = null;

  private currentAudio: HTMLAudioElement | null = null;
  private currentLevelIndex: number | null = null;
  private pendingLevelIndex: number | null = null;

  private masterVolume = 0.5;
  private isMuted = false;
  private isUnlocked = false;

  private activeCrossfadeCancel: (() => void) | null = null;
  private volumeListeners: Array<(volume: number, isMuted: boolean) => void> = [];

  private constructor() {
    this.loadSettings();
    this.setupAutoplayUnlock();
  }

  public static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }

  private loadSettings(): void {
    try {
      const savedVol = localStorage.getItem('bgm_volume');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.masterVolume = parsed;
        }
      }
      const savedMute = localStorage.getItem('bgm_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    } catch {
      // localStorage may be unavailable in some sandboxes
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('bgm_volume', this.masterVolume.toString());
      localStorage.setItem('bgm_muted', this.isMuted ? 'true' : 'false');
    } catch {
      // Ignore
    }
  }

  private setupAutoplayUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.isUnlocked = true;
      if (this.pendingLevelIndex !== null) {
        const lvl = this.pendingLevelIndex;
        this.pendingLevelIndex = null;
        this.playLevelMusic(lvl);
      } else if (this.currentAudio && this.currentAudio.paused) {
        this.currentAudio.play().catch(() => {});
      }

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  /**
   * Normalizes level identifier (0-based or 1-based index, or level ID string)
   * into a canonical 1-based level number (1..5).
   */
  public resolveLevelNumber(levelIndex: number | string): number {
    if (typeof levelIndex === 'string') {
      const match = levelIndex.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        return Math.max(1, Math.min(5, num));
      }
      if (levelIndex.includes('apartment')) return 1;
      if (levelIndex.includes('street') || levelIndex.includes('downtown')) return 2;
      if (levelIndex.includes('metro')) return 3;
      if (levelIndex.includes('suburban') || levelIndex.includes('coast')) return 4;
      if (levelIndex.includes('beach') || levelIndex.includes('sopelana')) return 5;
      if (levelIndex.includes('park') || levelIndex.includes('etxebarria')) return 6;
      return 1;
    }

    // Numerical index:
    // 0-based campaign indices: 0 -> 1, ..., 5 -> 6
    if (levelIndex >= 0 && levelIndex <= 5) {
      return Math.floor(levelIndex) + 1;
    }
    return Math.max(1, Math.min(6, Math.floor(levelIndex)));
  }

  /**
   * Returns the asset URL for a given level.
   * e.g. '/audio/music/level1.mp3'
   */
  public getTrackUrl(levelNum: number): string {
    const basePath = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
      ? import.meta.env.BASE_URL.replace(/\/$/, '')
      : '';
    return `${basePath}/audio/music/level${levelNum}.mp3`;
  }

  /**
   * Plays the background music for the designated level.
   * Checks if currently playing track belongs to levelIndex. If not, forces a smooth 1.0s crossfade.
   * Ensures isMuted flag does not permanently block playback if volume > 0.
   */
  public playLevelMusic(levelIndex: number | string): void {
    const levelNum = this.resolveLevelNumber(levelIndex);
    const trackUrl = this.getTrackUrl(levelNum);

    // If currently playing track actually belongs to levelIndex and is active, do nothing
    const isSameTrack =
      this.currentLevelIndex === levelNum &&
      this.currentAudio !== null &&
      !this.currentAudio.paused &&
      this.currentAudio.src.includes(`level${levelNum}.mp3`);

    if (isSameTrack) {
      return;
    }

    this.currentLevelIndex = levelNum;

    // Cancel any running crossfade
    if (this.activeCrossfadeCancel) {
      this.activeCrossfadeCancel();
      this.activeCrossfadeCancel = null;
    }

    const previousAudio = this.currentAudio;
    let nextAudio: HTMLAudioElement;

    try {
      nextAudio = new Audio();
      nextAudio.loop = true;
      nextAudio.preload = 'auto';
      nextAudio.src = trackUrl;
      nextAudio.muted = this.isMuted;
      nextAudio.volume = 0;

      // Graceful error handling for missing files or 404s
      nextAudio.onerror = () => {
        console.warn(`[MusicManager] Audio track not found or failed to load: ${trackUrl}`);
      };
    } catch (err) {
      console.warn('[MusicManager] Failed to instantiate Audio element:', err);
      return;
    }

    this.currentAudio = nextAudio;

    // Start playing new track immediately
    const playPromise = nextAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay policy prevented playback until user interaction
        console.log('[MusicManager] Autoplay prevented, waiting for interaction:', err?.name);
        this.pendingLevelIndex = levelNum;
      });
    }

    // Perform smooth 1.0-second crossfade
    const fadeDurationSec = 1.0;
    const startTime = performance.now();
    const startPrevVol = previousAudio ? previousAudio.volume : 0;
    const targetNextVol = this.isMuted ? 0 : this.masterVolume;

    let isCancelled = false;
    this.activeCrossfadeCancel = () => {
      isCancelled = true;
      if (previousAudio) {
        try {
          previousAudio.pause();
          previousAudio.src = '';
          previousAudio.remove();
        } catch {}
      }
    };

    const animateFade = (now: number) => {
      if (isCancelled) return;

      // If muted mid-crossfade, immediately kill sound and terminate fade
      if (this.isMuted) {
        if (previousAudio) {
          try {
            previousAudio.pause();
            previousAudio.src = '';
            previousAudio.remove();
          } catch {}
        }
        if (nextAudio) {
          nextAudio.muted = true;
          nextAudio.volume = 0;
        }
        this.activeCrossfadeCancel = null;
        return;
      }

      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(1.0, elapsed / fadeDurationSec);

      // Fade out previous audio over 1.0s
      if (previousAudio) {
        previousAudio.volume = Math.min(1.0, Math.max(0.0, startPrevVol * (1.0 - progress)));
      }

      // Fade in new audio over 1.0s to current active volume
      if (nextAudio && !this.isMuted) {
        nextAudio.muted = false;
        nextAudio.volume = Math.min(1.0, Math.max(0.0, targetNextVol * progress));
      }

      if (progress < 1.0) {
        requestAnimationFrame(animateFade);
      } else {
        // Cleanup old audio
        if (previousAudio) {
          try {
            previousAudio.pause();
            previousAudio.src = '';
            previousAudio.remove();
          } catch {}
        }
        if (nextAudio && !this.isMuted) {
          nextAudio.muted = false;
          nextAudio.volume = Math.min(1.0, Math.max(0.0, targetNextVol));
        }
        this.activeCrossfadeCancel = null;
      }
    };

    requestAnimationFrame(animateFade);
  }

  /**
   * Stops any currently playing music with an optional fade-out.
   */
  public stop(fadeDurationSec = 1.2): void {
    if (!this.currentAudio) return;

    if (this.activeCrossfadeCancel) {
      this.activeCrossfadeCancel();
      this.activeCrossfadeCancel = null;
    }

    const audioToStop = this.currentAudio;
    this.currentAudio = null;
    this.currentLevelIndex = null;

    if (fadeDurationSec <= 0) {
      try {
        audioToStop.pause();
        audioToStop.src = '';
        audioToStop.remove();
      } catch {}
      return;
    }

    const startTime = performance.now();
    const startVol = audioToStop.volume;

    const fadeStep = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(1.0, elapsed / fadeDurationSec);
      audioToStop.volume = Math.min(1.0, Math.max(0.0, startVol * (1.0 - progress)));

      if (progress < 1.0) {
        requestAnimationFrame(fadeStep);
      } else {
        try {
          audioToStop.pause();
          audioToStop.src = '';
          audioToStop.remove();
        } catch {}
      }
    };

    requestAnimationFrame(fadeStep);
  }

  /**
   * Sets master music volume (0.0 to 1.0).
   */
  public setMasterVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    if (clamped === 0) {
      this.masterVolume = 0;
      this.setMuted(true);
      return;
    }

    this.masterVolume = clamped;
    this.isMuted = false;
    if (this.currentAudio) {
      this.currentAudio.muted = false;
      this.currentAudio.volume = this.masterVolume;
    }
    this.saveSettings();
    this.notifyVolumeListeners();
  }

  public setVolume(vol: number): void {
    this.setMasterVolume(vol);
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getVolume(): number {
    return this.getMasterVolume();
  }

  /**
   * Sets mute state.
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;

    if (muted) {
      if (this.activeCrossfadeCancel) {
        this.activeCrossfadeCancel();
        this.activeCrossfadeCancel = null;
      }
      if (this.currentAudio) {
        this.currentAudio.muted = true;
        this.currentAudio.volume = 0;
      }
    } else {
      if (this.currentAudio) {
        this.currentAudio.muted = false;
        this.currentAudio.volume = this.masterVolume;
      }
    }

    this.saveSettings();
    this.notifyVolumeListeners();
  }

  /**
   * Toggles mute state and returns the new state.
   */
  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public isMute(): boolean {
    return this.isMuted;
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  public getCurrentLevelIndex(): number | null {
    return this.currentLevelIndex;
  }

  public onVolumeChange(callback: (volume: number, isMuted: boolean) => void): () => void {
    this.volumeListeners.push(callback);
    callback(this.masterVolume, this.isMuted);
    return () => {
      this.volumeListeners = this.volumeListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyVolumeListeners(): void {
    for (const listener of this.volumeListeners) {
      listener(this.masterVolume, this.isMuted);
    }
  }
}

export const musicManager = MusicManager.getInstance();

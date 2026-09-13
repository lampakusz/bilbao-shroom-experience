import { gameState, GameMode } from '../engine/GameState.ts';
import { audioManager } from '../audio/AudioManager.ts';
import { musicManager } from '../audio/MusicManager.ts';
import { voiceManager } from '../audio/VoiceManager.ts';
import { campaignManager } from '../world/CampaignManager.ts';
import { inputManager, XboxButton } from '../engine/InputManager.ts';
import type { PostProcessManager } from '../engine/PostProcessManager.ts';

export interface MainMenuOptions {
  onStartGame?: () => void;
  onSelectLevel?: (levelIndex: number) => void;
  onFactoryReset?: () => void;
  postProcessManager?: PostProcessManager;
}

export class MainMenu {
  private menuContainer!: HTMLDivElement;
  private settingsContainer!: HTMLDivElement;
  private editorExitBtn!: HTMLButtonElement;

  private menuButtons: HTMLButtonElement[] = [];
  private menuFocusIndex = 0;

  private settingsRowElements: HTMLElement[] = [];
  private settingsFocusIndex = 0;

  private sliderMusic!: HTMLInputElement;
  private musicVal!: HTMLSpanElement;
  private sliderVoice!: HTMLInputElement;
  private voiceVal!: HTMLSpanElement;
  private sliderSfx!: HTMLInputElement;
  private sfxVal!: HTMLSpanElement;
  private bgmMuteBtn!: HTMLButtonElement;
  private distortionToggle!: HTMLInputElement;
  private factoryResetBtn!: HTMLButtonElement | null;
  private backBtn!: HTMLButtonElement;

  private levelSelectContainer!: HTMLDivElement;
  private levelButtons: HTMLButtonElement[] = [];
  private levelFocusIndex = 0;
  private isLevelSelectOpen = false;

  private onStartGame?: () => void;
  private onSelectLevel?: (levelIndex: number) => void;
  private onFactoryReset?: () => void;
  private postProcessManager?: PostProcessManager;

  constructor(options: MainMenuOptions = {}) {
    this.onStartGame = options.onStartGame;
    this.onSelectLevel = options.onSelectLevel;
    this.onFactoryReset = options.onFactoryReset;
    this.postProcessManager = options.postProcessManager;

    this.createMainMenuUI();
    this.createSettingsUI();
    this.createLevelSelectUI();
    this.createEditorExitButton();

    // Listen to mode changes
    gameState.onModeChange((mode) => {
      this.syncVisibility(mode);
    });

    // Listen to Escape key: return from settings or level select
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isLevelSelectOpen) {
          this.hideLevelSelect();
        } else if (gameState.getMode() === GameMode.SETTINGS) {
          gameState.setMode(GameMode.MENU);
        }
      }
    });

    // Initial state sync
    this.syncVisibility(gameState.getMode());
  }

  private createMainMenuUI(): void {
    this.menuContainer = document.createElement('div');
    this.menuContainer.id = 'main-menu-overlay';
    this.menuContainer.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.85) 0%, rgba(8, 10, 18, 0.95) 100%);
      backdrop-filter: blur(10px);
      z-index: 200;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
    `;

    this.menuContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 640px; padding: 28px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 32px;">🍄</span>
          <span style="background: rgba(220, 38, 38, 0.25); border: 1.5px solid rgba(220, 38, 38, 0.6); color: #f87171; font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 1.2px;">BILBAO CO-OP</span>
        </div>
        
        <h1 style="font-size: 46px; font-weight: 900; letter-spacing: 2.5px; margin: 0 0 12px 0; background: linear-gradient(135deg, #38bdf8 0%, #c084fc 50%, #f43f5e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          BILBAO SHROOM EXPERIENCE
        </h1>
        
        <p style="color: #cbd5e1; font-size: 16px; font-weight: 600; margin: 0 0 36px 0; line-height: 1.6; max-width: 540px;">
          Lokális 2-személyes pszichedelikus co-op kaland. Lépjetek a nyomólapokra, nyissátok ki a kapukat, és jussatok el Sopelana partjaira!
        </p>

        <!-- Menu Buttons -->
        <div style="display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 380px;">
          <button id="btn-start" style="
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 16px 24px;
            font-size: 19px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          ">🎮 Játék indítása</button>

          <button id="btn-level-select" style="
            background: rgba(30, 41, 59, 0.9);
            color: #f1f5f9;
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 14px 24px;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
          ">🗺️ Pályaválasztó</button>

          <button id="btn-editor" style="
            background: rgba(30, 41, 59, 0.9);
            color: #f1f5f9;
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 14px 24px;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
          ">🛠️ Pályaszerkesztő</button>

          <button id="btn-settings" style="
            background: rgba(30, 41, 59, 0.9);
            color: #f1f5f9;
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 14px 24px;
            font-size: 17px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
          ">⚙️ Beállítások</button>
        </div>

        <!-- Controls Overview -->
        <div style="margin-top: 32px; padding: 16px 22px; background: rgba(30, 41, 59, 0.65); border: 1.5px solid rgba(255, 255, 255, 0.12); border-radius: 12px; font-size: 14px; color: #cbd5e1; display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <span style="color: #60a5fa; font-size: 15px; font-weight: 800;">1. Játékos (Kék / Viki):</span><br>
              <span style="font-weight: 600;">WASD / Bal Stick • Space / A / X</span>
            </div>
            <div>
              <span style="color: #f87171; font-size: 15px; font-weight: 800;">2. Játékos (Piros / Kristóf):</span><br>
              <span style="font-weight: 600;">Nyilak / Bal Stick 2 • Enter / A</span>
            </div>
          </div>
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; font-size: 13px; color: #38bdf8; font-weight: 700; text-align: center;">
            🎮 Xbox: [D-Pad] Menüválasztás • [A] Indítás / Megnyitás • [Start] Szünet
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.menuContainer);

    // Event listeners
    const startBtn = this.menuContainer.querySelector('#btn-start') as HTMLButtonElement;
    startBtn.onclick = () => {
      audioManager.resumeContext();
      if (this.onStartGame) {
        this.onStartGame();
      }
      gameState.setMode(GameMode.PLAYING);
    };

    const levelSelectBtn = this.menuContainer.querySelector('#btn-level-select') as HTMLButtonElement;
    levelSelectBtn.onclick = () => {
      audioManager.resumeContext();
      this.showLevelSelect();
    };

    const editorBtn = this.menuContainer.querySelector('#btn-editor') as HTMLButtonElement;
    editorBtn.onclick = () => {
      audioManager.resumeContext();
      gameState.setMode(GameMode.EDITOR);
    };

    const settingsBtn = this.menuContainer.querySelector('#btn-settings') as HTMLButtonElement;
    settingsBtn.onclick = () => {
      gameState.setMode(GameMode.SETTINGS);
    };

    this.menuButtons = [startBtn, levelSelectBtn, editorBtn, settingsBtn];
    this.menuFocusIndex = 0;
    this.updateMenuFocusVisuals();
  }

  private createSettingsUI(): void {
    this.settingsContainer = document.createElement('div');
    this.settingsContainer.id = 'settings-overlay';
    this.settingsContainer.style.cssText = `
      position: fixed;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.9) 0%, rgba(8, 10, 18, 0.98) 100%);
      backdrop-filter: blur(12px);
      z-index: 210;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
    `;

    this.settingsContainer.innerHTML = `
      <div style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 28px; width: 360px; max-width: 90vw; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
          ⚙️ Beállítások
        </h2>

        <!-- Audio Controls (3 Independent Channels) -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- 1. Music Slider -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;">🎵 Zene (Music Volume)</span>
              <span id="music-val" style="color: #38bdf8; font-weight: 700;">50%</span>
            </div>
            <input type="range" id="slider-music" min="0" max="100" value="50" style="accent-color: #38bdf8; cursor: pointer;">
          </div>

          <!-- 2. Voice Slider -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;">🗣️ Beszéd (Voice Volume)</span>
              <span id="voice-val" style="color: #c084fc; font-weight: 700;">80%</span>
            </div>
            <input type="range" id="slider-voice" min="0" max="100" value="80" style="accent-color: #c084fc; cursor: pointer;">
          </div>

          <!-- 3. SFX Slider -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;">💥 Hangeffektek (SFX Volume)</span>
              <span id="sfx-val" style="color: #f59e0b; font-weight: 700;">80%</span>
            </div>
            <input type="range" id="slider-sfx" min="0" max="100" value="80" style="accent-color: #f59e0b; cursor: pointer;">
          </div>
        </div>

        <!-- Background Music (BGM) Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.1);">
          <div>
            <div style="font-size: 14px; font-weight: 600;">Háttérzene (BGM)</div>
            <div style="font-size: 12px; color: #94a3b8;">Dinamikus pályazene átúszással</div>
          </div>
          <button id="btn-bgm-mute" style="
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: #38bdf8;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
          ">🔊 Be</button>
        </div>

        <!-- Visual Distortion Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div>
            <div style="font-size: 14px; font-weight: 600;">Vizuális torzítás</div>
            <div style="font-size: 12px; color: #94a3b8;" id="distortion-desc">Full Trip (Pszichedelikus hullámzás)</div>
          </div>
          <input type="checkbox" id="distortion-toggle" checked style="width: 20px; height: 20px; accent-color: #c084fc; cursor: pointer;">
        </div>

        <!-- Factory Reset Button -->
        <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.08);">
          <button id="btn-factory-reset" style="
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
          ">⚠️ Gyári szintek visszaállítása</button>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">
            Törli a szerkesztőben mentett módosításokat és újraindítja a kampányt.
          </div>
        </div>

        <!-- Controller Legend -->
        <div style="border-top: 1px solid rgba(255,255,255,0.12); padding-top: 8px; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: center;">
          🎮 [D-Pad Fel/Le] Navigáció • [Bal/Jobb] Hangerő • [A] Módosítás • [B] Vissza
        </div>

        <!-- Back Button -->
        <button id="btn-settings-back" style="
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        ">↩️ Vissza a menübe</button>
      </div>
    `;

    document.body.appendChild(this.settingsContainer);

    this.sliderMusic = this.settingsContainer.querySelector('#slider-music') as HTMLInputElement;
    this.musicVal = this.settingsContainer.querySelector('#music-val') as HTMLSpanElement;
    this.sliderVoice = this.settingsContainer.querySelector('#slider-voice') as HTMLInputElement;
    this.voiceVal = this.settingsContainer.querySelector('#voice-val') as HTMLSpanElement;
    this.sliderSfx = this.settingsContainer.querySelector('#slider-sfx') as HTMLInputElement;
    this.sfxVal = this.settingsContainer.querySelector('#sfx-val') as HTMLSpanElement;
    this.bgmMuteBtn = this.settingsContainer.querySelector('#btn-bgm-mute') as HTMLButtonElement;

    // Collect settings rows for gamepad focus navigation
    const musicRow = this.sliderMusic.parentElement as HTMLElement;
    const voiceRow = this.sliderVoice.parentElement as HTMLElement;
    const sfxRow = this.sliderSfx.parentElement as HTMLElement;
    const bgmRow = this.bgmMuteBtn.parentElement as HTMLElement;
    this.distortionToggle = this.settingsContainer.querySelector('#distortion-toggle') as HTMLInputElement;
    const distortionRow = this.distortionToggle.parentElement as HTMLElement;
    this.factoryResetBtn = this.settingsContainer.querySelector('#btn-factory-reset') as HTMLButtonElement | null;
    const resetRow = this.factoryResetBtn ? (this.factoryResetBtn.parentElement as HTMLElement) : null;
    this.backBtn = this.settingsContainer.querySelector('#btn-settings-back') as HTMLButtonElement;

    this.settingsRowElements = [
      musicRow,
      voiceRow,
      sfxRow,
      bgmRow,
      distortionRow,
      ...(resetRow ? [resetRow] : []),
      this.backBtn,
    ].filter(Boolean) as HTMLElement[];

    const initialMusic = Math.round(musicManager.getVolume() * 100);
    this.sliderMusic.value = initialMusic.toString();
    this.musicVal.textContent = `${initialMusic}%`;

    const initialVoice = Math.round(voiceManager.getVolume() * 100);
    this.sliderVoice.value = initialVoice.toString();
    this.voiceVal.textContent = `${initialVoice}%`;

    const initialSfx = Math.round(audioManager.getVolume() * 100);
    this.sliderSfx.value = initialSfx.toString();
    this.sfxVal.textContent = `${initialSfx}%`;

    this.sliderMusic.oninput = () => {
      const val = parseInt(this.sliderMusic.value, 10);
      this.musicVal.textContent = `${val}%`;
      musicManager.setVolume(val / 100);
    };

    this.sliderVoice.oninput = () => {
      const val = parseInt(this.sliderVoice.value, 10);
      this.voiceVal.textContent = `${val}%`;
      voiceManager.setVolume(val / 100);
    };

    this.sliderSfx.oninput = () => {
      const val = parseInt(this.sliderSfx.value, 10);
      this.sfxVal.textContent = `${val}%`;
      audioManager.setVolume(val / 100);
    };

    const updateBgmBtnState = (isMuted: boolean) => {
      if (this.bgmMuteBtn) {
        this.bgmMuteBtn.textContent = isMuted ? '🔇 Némítva' : '🔊 Be';
        this.bgmMuteBtn.style.color = isMuted ? '#94a3b8' : '#38bdf8';
        this.bgmMuteBtn.style.borderColor = isMuted ? 'rgba(255, 255, 255, 0.1)' : 'rgba(56, 189, 248, 0.5)';
      }
    };
    updateBgmBtnState(musicManager.isMute());

    this.bgmMuteBtn.onclick = () => {
      const isMuted = musicManager.toggleMute();
      updateBgmBtnState(isMuted);
    };

    musicManager.onVolumeChange((vol, isMuted) => {
      const percent = Math.round(vol * 100);
      if (document.activeElement !== this.sliderMusic) {
        this.sliderMusic.value = percent.toString();
        this.musicVal.textContent = `${percent}%`;
      }
      updateBgmBtnState(isMuted);
    });

    const distortionDesc = this.settingsContainer.querySelector('#distortion-desc') as HTMLDivElement;
    this.distortionToggle.onchange = () => {
      const enabled = this.distortionToggle.checked;
      distortionDesc.textContent = enabled ? 'Full Trip (Pszichedelikus hullámzás)' : 'Clean (Torzítás kikapcsolva)';
      if (this.postProcessManager) {
        this.postProcessManager.setDistortionEnabled(enabled);
      }
    };

    this.factoryResetBtn?.addEventListener('click', () => {
      const confirmed = window.confirm(
        'Biztosan visszaállítod a gyári szinteket?\n\nMinden pályaszerkesztős és kampánymódosítás törlődik a böngészőből, és az eredeti pályák töltődnek be.'
      );
      if (!confirmed) return;

      campaignManager.resetCampaignToFactory();
      if (this.onFactoryReset) {
        this.onFactoryReset();
      }
      gameState.setMode(GameMode.MENU);
    });

    this.backBtn.onclick = () => {
      gameState.setMode(GameMode.MENU);
    };

    this.settingsFocusIndex = 0;
    this.updateSettingsFocusVisuals();
  }

  private createEditorExitButton(): void {
    this.editorExitBtn = document.createElement('button');
    this.editorExitBtn.id = 'editor-exit-btn';
    this.editorExitBtn.textContent = '🚪 Kilépés a menübe';
    this.editorExitBtn.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: rgba(220, 38, 38, 0.85);
      backdrop-filter: blur(8px);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px 16px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: none;
      z-index: 250;
      box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
      transition: background 0.2s, transform 0.15s;
    `;
    this.editorExitBtn.onmouseenter = () => (this.editorExitBtn.style.background = '#b91c1c');
    this.editorExitBtn.onmouseleave = () => (this.editorExitBtn.style.background = 'rgba(220, 38, 38, 0.85)');
    this.editorExitBtn.onclick = () => {
      gameState.setMode(GameMode.MENU);
    };
    document.body.appendChild(this.editorExitBtn);
  }

  private createLevelSelectUI(): void {
    this.levelSelectContainer = document.createElement('div');
    this.levelSelectContainer.id = 'level-select-overlay';
    this.levelSelectContainer.style.cssText = `
      position: fixed;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.92) 0%, rgba(8, 10, 18, 0.98) 100%);
      backdrop-filter: blur(14px);
      z-index: 220;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: rgba(30, 41, 59, 0.95);
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      border-radius: 16px;
      padding: 24px 30px;
      width: 600px;
      max-width: 92vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.25);
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 12px;
    `;
    titleRow.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 26px;">🗺️</span>
        <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #38bdf8;">Pályaválasztó</h2>
      </div>
      <span style="font-size: 13px; color: #94a3b8; font-weight: 600;">Válassz egy szintet az induláshoz</span>
    `;
    box.appendChild(titleRow);

    const list = document.createElement('div');
    list.id = 'level-select-list';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      max-height: 52vh;
      padding-right: 4px;
    `;

    const themeBadges: Record<string, { icon: string; label: string; color: string }> = {
      apartment: { icon: '🏠', label: 'Apartman', color: '#60a5fa' },
      downtown: { icon: '🏙️', label: 'Belváros', color: '#fbbf24' },
      metro: { icon: '🚇', label: 'Metró', color: '#cbd5e1' },
      suburban: { icon: '🏡', label: 'Kertváros', color: '#34d399' },
      sopelana: { icon: '🌊', label: 'Tengerpart', color: '#38bdf8' },
      park: { icon: '🏞️', label: 'Etxebarria Park', color: '#c084fc' },
    };

    const levels = campaignManager.getLevels();
    this.levelButtons = [];

    levels.forEach((lvl, idx) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        background: rgba(15, 23, 42, 0.85);
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 12px 18px;
        color: #f1f5f9;
        font-family: inherit;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
        transition: all 0.15s ease;
      `;

      const badge = themeBadges[lvl.theme] || { icon: '📍', label: lvl.theme, color: '#f59e0b' };

      btn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">${badge.icon}</span>
          <span style="font-weight: 800; color: #f8fafc;">${lvl.name}</span>
        </div>
        <span style="font-size: 12px; font-weight: 800; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; padding: 3px 8px; color: ${badge.color}; flex-shrink: 0;">
          ${badge.label}
        </span>
      `;

      btn.onmouseenter = () => {
        this.levelFocusIndex = idx;
        this.updateLevelFocusVisuals();
      };

      btn.onclick = () => {
        audioManager.resumeContext();
        audioManager.playSwitchClick();
        this.hideLevelSelect();
        if (this.onSelectLevel) {
          this.onSelectLevel(idx);
        } else {
          campaignManager.loadLevel(idx);
          if (this.onStartGame) {
            this.onStartGame();
          }
        }
        gameState.setMode(GameMode.PLAYING);
      };

      list.appendChild(btn);
      this.levelButtons.push(btn);
    });

    box.appendChild(list);

    const backBtn = document.createElement('button');
    backBtn.style.cssText = `
      background: rgba(51, 65, 85, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px;
      color: #f1f5f9;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: background 0.15s;
    `;
    backBtn.textContent = '← Vissza a főmenübe (Esc)';
    backBtn.onclick = () => this.hideLevelSelect();
    box.appendChild(backBtn);

    window.addEventListener('keydown', (e) => {
      if (this.isLevelSelectOpen) {
        if (e.key === 'Escape') {
          this.hideLevelSelect();
        } else if (e.key === 'ArrowUp') {
          this.levelFocusIndex = (this.levelFocusIndex - 1 + this.levelButtons.length) % this.levelButtons.length;
          this.updateLevelFocusVisuals();
        } else if (e.key === 'ArrowDown') {
          this.levelFocusIndex = (this.levelFocusIndex + 1) % this.levelButtons.length;
          this.updateLevelFocusVisuals();
        } else if (e.key === 'Enter') {
          this.levelButtons[this.levelFocusIndex]?.click();
        }
      }
    });

    this.levelSelectContainer.appendChild(box);
    document.body.appendChild(this.levelSelectContainer);
  }

  public showLevelSelect(): void {
    this.isLevelSelectOpen = true;
    this.levelFocusIndex = campaignManager.getActiveIndex();
    this.levelSelectContainer.style.display = 'flex';
    this.updateLevelFocusVisuals();
  }

  public hideLevelSelect(): void {
    this.isLevelSelectOpen = false;
    this.levelSelectContainer.style.display = 'none';
  }

  private updateLevelFocusVisuals(): void {
    this.levelButtons.forEach((btn, idx) => {
      if (idx === this.levelFocusIndex) {
        btn.style.outline = '2.5px solid #38bdf8';
        btn.style.background = 'rgba(56, 189, 248, 0.2)';
        btn.style.transform = 'translateX(4px)';
        btn.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)';
      } else {
        btn.style.outline = 'none';
        btn.style.background = 'rgba(15, 23, 42, 0.85)';
        btn.style.transform = 'none';
        btn.style.boxShadow = 'none';
      }
    });
  }

  private syncVisibility(mode: GameMode): void {
    this.menuContainer.style.display = mode === GameMode.MENU ? 'flex' : 'none';
    this.settingsContainer.style.display = mode === GameMode.SETTINGS ? 'flex' : 'none';
    this.editorExitBtn.style.display = mode === GameMode.EDITOR ? 'block' : 'none';
    if (mode === GameMode.MENU) {
      this.menuFocusIndex = 0;
      this.updateMenuFocusVisuals();
    } else if (mode === GameMode.SETTINGS) {
      this.settingsFocusIndex = 0;
      this.updateSettingsFocusVisuals();
    }
  }

  private updateMenuFocusVisuals(): void {
    this.menuButtons.forEach((btn, idx) => {
      if (idx === this.menuFocusIndex) {
        btn.style.outline = '3px solid #38bdf8';
        btn.style.boxShadow = '0 0 25px rgba(56, 189, 248, 0.7), 0 8px 25px rgba(0, 0, 0, 0.5)';
        btn.style.transform = 'scale(1.04)';
      } else {
        btn.style.outline = 'none';
        btn.style.boxShadow = idx === 0 ? '0 6px 20px rgba(37, 99, 235, 0.5)' : 'none';
        btn.style.transform = 'none';
      }
    });
  }

  private updateSettingsFocusVisuals(): void {
    this.settingsRowElements.forEach((el, idx) => {
      if (idx === this.settingsFocusIndex) {
        el.style.outline = '2.5px solid #38bdf8';
        el.style.borderRadius = '8px';
        el.style.background = 'rgba(56, 189, 248, 0.12)';
        el.style.padding = '4px 8px';
      } else {
        el.style.outline = 'none';
        el.style.background = 'transparent';
        el.style.padding = '0px';
      }
    });
  }

  public update(): void {
    const mode = gameState.getMode();

    if (mode === GameMode.MENU) {
      if (this.isLevelSelectOpen) {
        if (
          inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP) ||
          inputManager.isButtonJustPressed(0, XboxButton.DPAD_UP)
        ) {
          this.levelFocusIndex = (this.levelFocusIndex - 1 + this.levelButtons.length) % this.levelButtons.length;
          audioManager.playKeypadBeep(650);
          this.updateLevelFocusVisuals();
        } else if (
          inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN) ||
          inputManager.isButtonJustPressed(0, XboxButton.DPAD_DOWN)
        ) {
          this.levelFocusIndex = (this.levelFocusIndex + 1) % this.levelButtons.length;
          audioManager.playKeypadBeep(650);
          this.updateLevelFocusVisuals();
        }

        if (
          inputManager.isAnyButtonJustPressed(XboxButton.A) ||
          inputManager.isAnyButtonJustPressed(XboxButton.START)
        ) {
          this.levelButtons[this.levelFocusIndex]?.click();
        } else if (
          inputManager.isAnyButtonJustPressed(XboxButton.B) ||
          inputManager.isAnyButtonJustPressed(XboxButton.BACK)
        ) {
          this.hideLevelSelect();
        }
        return;
      }

      if (
        inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP) ||
        inputManager.isButtonJustPressed(0, XboxButton.DPAD_UP)
      ) {
        this.menuFocusIndex = (this.menuFocusIndex - 1 + this.menuButtons.length) % this.menuButtons.length;
        audioManager.playKeypadBeep(650);
        this.updateMenuFocusVisuals();
      } else if (
        inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN) ||
        inputManager.isButtonJustPressed(0, XboxButton.DPAD_DOWN)
      ) {
        this.menuFocusIndex = (this.menuFocusIndex + 1) % this.menuButtons.length;
        audioManager.playKeypadBeep(650);
        this.updateMenuFocusVisuals();
      }

      if (
        inputManager.isAnyButtonJustPressed(XboxButton.A) ||
        inputManager.isAnyButtonJustPressed(XboxButton.START)
      ) {
        this.menuButtons[this.menuFocusIndex]?.click();
      }
      return;
    }

    if (mode === GameMode.SETTINGS) {
      // Exit settings on B or Back
      if (
        inputManager.isAnyButtonJustPressed(XboxButton.B) ||
        inputManager.isAnyButtonJustPressed(XboxButton.BACK)
      ) {
        gameState.setMode(GameMode.MENU);
        return;
      }

      // Up / Down
      if (
        inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP) ||
        inputManager.isButtonJustPressed(0, XboxButton.DPAD_UP)
      ) {
        this.settingsFocusIndex = (this.settingsFocusIndex - 1 + this.settingsRowElements.length) % this.settingsRowElements.length;
        audioManager.playKeypadBeep(700);
        this.updateSettingsFocusVisuals();
      } else if (
        inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN) ||
        inputManager.isButtonJustPressed(0, XboxButton.DPAD_DOWN)
      ) {
        this.settingsFocusIndex = (this.settingsFocusIndex + 1) % this.settingsRowElements.length;
        audioManager.playKeypadBeep(700);
        this.updateSettingsFocusVisuals();
      }

      // Left / Right volume adjustments for sliders (0, 1, 2)
      const dpadLeft = inputManager.isAnyButtonJustPressed(XboxButton.DPAD_LEFT);
      const dpadRight = inputManager.isAnyButtonJustPressed(XboxButton.DPAD_RIGHT);

      if (dpadLeft || dpadRight) {
        const delta = dpadRight ? 5 : -5;
        if (this.settingsFocusIndex === 0 && this.sliderMusic) {
          const val = Math.max(0, Math.min(100, parseInt(this.sliderMusic.value, 10) + delta));
          this.sliderMusic.value = val.toString();
          this.musicVal.textContent = `${val}%`;
          musicManager.setVolume(val / 100);
        } else if (this.settingsFocusIndex === 1 && this.sliderVoice) {
          const val = Math.max(0, Math.min(100, parseInt(this.sliderVoice.value, 10) + delta));
          this.sliderVoice.value = val.toString();
          this.voiceVal.textContent = `${val}%`;
          voiceManager.setVolume(val / 100);
        } else if (this.settingsFocusIndex === 2 && this.sliderSfx) {
          const val = Math.max(0, Math.min(100, parseInt(this.sliderSfx.value, 10) + delta));
          this.sliderSfx.value = val.toString();
          this.sfxVal.textContent = `${val}%`;
          audioManager.setVolume(val / 100);
        }
      }

      // Button A actions
      if (inputManager.isAnyButtonJustPressed(XboxButton.A)) {
        if (this.settingsFocusIndex === 3) {
          this.bgmMuteBtn?.click();
        } else if (this.settingsFocusIndex === 4 && this.distortionToggle) {
          this.distortionToggle.checked = !this.distortionToggle.checked;
          this.distortionToggle.dispatchEvent(new Event('change'));
        } else if (this.settingsFocusIndex === 5) {
          this.factoryResetBtn?.click();
        } else if (this.settingsFocusIndex === 6) {
          this.backBtn?.click();
        }
      }
    }
  }
}

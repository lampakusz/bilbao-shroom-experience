import './style.css';
import * as THREE from 'three';
import { inputManager, XboxButton } from './engine/InputManager.ts';
import { CameraRig } from './engine/CameraRig.ts';
import { Player } from './entities/Player.ts';
import type { LevelData } from './world/Level.ts';
import { Level } from './world/Level.ts';
import { TileTheme } from './world/TileTypes.ts';
import { ALL_LEVELS } from './world/levelsData.ts';
import { DEFAULT_LEVEL } from './world/defaultMap.ts';
import { GRID_CELL_SIZE } from './world/BlockFactory.ts';
import { LevelEditor } from './editor/LevelEditor.ts';
import { TriggerSystem } from './gameplay/TriggerSystem.ts';
import { PostProcessManager } from './engine/PostProcessManager.ts';
import { audioManager } from './audio/AudioManager.ts';
import { gameState, GameMode } from './engine/GameState.ts';
import { MainMenu } from './ui/MainMenu.ts';
import { EnvironmentBackdrop } from './world/EnvironmentBackdrop.ts';
import { campaignManager } from './world/CampaignManager.ts';
import { DialogueOverlay } from './ui/DialogueOverlay.ts';
import { musicManager } from './audio/MusicManager.ts';
import { TetherRenderer } from './entities/TetherRenderer.ts';
import { BonfireMesh } from './world/BonfireMesh.ts';
import { victoryScreen } from './ui/VictoryScreen.ts';
import { falloutDialogue } from './ui/FalloutDialogue.ts';
import { EnemyType } from './entities/EnemyTypes.ts';
import { vibePuzzle } from './gameplay/VibePuzzle.ts';
import { keypadUI } from './ui/KeypadUI.ts';
import { stickyNoteModal } from './ui/StickyNoteModal.ts';
import { resolveAssetPath } from './utils/assetPath.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11131c);

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Camera Rig
const cameraRig = new CameraRig(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Post-Processing Manager (Progressive Psychedelic Distortion)
const postProcessManager = new PostProcessManager(renderer, scene, camera);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x8b7355, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
dirLight.position.set(20, 35, 15);
dirLight.target.position.set(13, 0, 13);
scene.add(dirLight.target);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -25;
dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25;
dirLight.shadow.camera.bottom = -25;
scene.add(dirLight);

// Ground Plane & Grid under level
const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x161822,
  roughness: 0.95,
  metalness: 0.05,
});
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.position.set(13, -0.01, 13);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
groundMesh.visible = false; // Theme-appropriate ground plane provided by EnvironmentBackdrop
scene.add(groundMesh);

const gridHelper = new THREE.GridHelper(80, 40, 0x3b4261, 0x1e2235);
gridHelper.position.set(13, 0.0, 13);
gridHelper.visible = false;
scene.add(gridHelper);

// Parametric low-poly environment backdrops, sky and fog per theme
const environmentBackdrop = new EnvironmentBackdrop();
scene.add(environmentBackdrop.group);

// Level Loader
const level = new Level();

// Trigger System (Co-op Pressure Plates, Collectible Relics, & Exit Portals)
const triggerSystem = new TriggerSystem(scene, cameraRig);
triggerSystem.postProcessManager = postProcessManager;
triggerSystem.onToast = showToast;

// Players (2.5D Illustrated Billboard Sprites)
// P1: Viki (Blue theme)
const p1 = new Player({
  id: 'p1',
  color: 0x3b82f6,
  initialPosition: new THREE.Vector3(4, 0, 4),
  characterName: 'Viki',
  texturePath: resolveAssetPath('/textures/player1_viki.png'),
  jointOffset: new THREE.Vector3(0.20, 1.02, 0.04),
});
scene.add(p1.mesh);

// P2: Kristóf (Red theme)
const p2 = new Player({
  id: 'p2',
  color: 0xef4444,
  initialPosition: new THREE.Vector3(4, 0, 8),
  characterName: 'Kristóf',
  texturePath: resolveAssetPath('/textures/player2_kristof.png'),
  jointOffset: new THREE.Vector3(0.26, 0.92, 0.04),
});
scene.add(p2.mesh);

// Dynamic 3D Distance-Based Tether Renderer
const tetherRenderer = new TetherRenderer(scene);

// Track player stuns in campaign statistics
Player.onStunOccurred = () => {
  campaignManager.addStun();
};

let currentBonfire: BonfireMesh | null = null;
let isFinaleCinematic = false;

// Level State Tracking
let currentLevelIndex = 0;
let lastTetherBarkTime = 0;
let lastParanoiaBarkTime = 0;
let cashierEncounterTriggered = false;

// Story Narration & Subtitle Dialogue Overlay
const dialogueOverlay = new DialogueOverlay();

// HUD Overlay for Level, Relics, and Trip Level
const hud = document.createElement('div');
hud.id = 'gameplay-hud';
hud.style.cssText = `
  position: fixed;
  top: 12px;
  right: 16px;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 9999px;
  padding: 6px 16px;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  display: none;
  align-items: center;
  gap: 12px;
  z-index: 80;
  user-select: none;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  transition: opacity 0.25s ease;
`;
// State tracking for 2-player relics
let p1RelicCollected = false;
let p2RelicCollected = false;

hud.innerHTML = `
  <div style="display: flex; align-items: center; gap: 6px;">
    <span style="color: #38bdf8; font-weight: 800; font-size: 15px;" id="level-name">Level 1</span>
  </div>
  <div style="border-left: 1.5px solid rgba(255,255,255,0.18); padding-left: 12px; display: flex; align-items: center; gap: 6px; font-size: 13px;">
    <span style="color: #f59e0b; font-size: 16px;">✨</span>
    <span id="relic-hud-status" style="font-weight: 700;">Relics: <span id="p1-relic-status" style="color: #64748b;">P1 🍄 [✗]</span> &nbsp; <span id="p2-relic-status" style="color: #64748b;">P2 🍄 [✗]</span> &nbsp; (<b id="relic-count" style="color: #f59e0b; font-size: 14px;">0</b> / <span id="relic-total" style="font-size: 14px;">2</span>)</span>
  </div>
  <div style="border-left: 1.5px solid rgba(255,255,255,0.18); padding-left: 12px; display: flex; align-items: center; gap: 6px; font-size: 13px;">
    <span style="font-size: 15px;">🌀</span>
    <span style="font-weight: 700;">Trip: <b id="trip-level" style="color: #38bdf8; font-size: 14px;">0%</b></span>
  </div>
  <div style="border-left: 1.5px solid rgba(255,255,255,0.18); padding-left: 12px; display: flex; align-items: center; gap: 8px;">
    <button id="btn-hud-restart" title="Pálya újraindítása (vagy tartsd a Back / R gombot)" style="
      background: rgba(245, 158, 11, 0.16);
      border: 1.5px solid rgba(245, 158, 11, 0.6);
      border-radius: 9999px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
      color: #f59e0b;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    ">
      <span style="font-size: 13px;">🔄</span>
      <span style="font-size: 12px; font-weight: 800;">Újra</span>
    </button>
    <button id="btn-hud-bgm" title="Zene némítása / visszahangosítása (M)" style="
      background: rgba(56, 189, 248, 0.16);
      border: 1.5px solid #38bdf8;
      border-radius: 9999px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      opacity: 1;
      transition: background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s;
    ">
      <span id="hud-bgm-icon" style="font-size: 13px;">🔊</span>
      <span id="hud-bgm-text" style="font-size: 12px; font-weight: 800;">BGM</span>
    </button>
  </div>
`;
document.body.appendChild(hud);

const hudBgmBtn = hud.querySelector('#btn-hud-bgm') as HTMLButtonElement | null;
const hudBgmIcon = hud.querySelector('#hud-bgm-icon') as HTMLSpanElement | null;
const hudBgmText = hud.querySelector('#hud-bgm-text') as HTMLSpanElement | null;
const updateHudBgmDisplay = (_vol: number, isMuted: boolean) => {
  if (hudBgmBtn && hudBgmIcon && hudBgmText) {
    hudBgmIcon.textContent = isMuted ? '🔇' : '🔊';
    hudBgmText.textContent = isMuted ? 'BGM (Néma)' : 'BGM';
    hudBgmBtn.style.color = isMuted ? '#ef4444' : '#38bdf8';
    hudBgmBtn.style.borderColor = isMuted ? '#ef4444' : '#38bdf8';
    hudBgmBtn.style.background = isMuted ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)';
    hudBgmBtn.style.opacity = isMuted ? '0.6' : '1.0';
  }
};
updateHudBgmDisplay(musicManager.getMasterVolume(), musicManager.isMute());

hudBgmBtn?.addEventListener('click', () => {
  const isMuted = musicManager.toggleMute();
  showToast(isMuted ? '🔇 Zene elnémítva' : '🔊 Zene bekapcsolva');
});

musicManager.onVolumeChange((vol, isMuted) => {
  updateHudBgmDisplay(vol, isMuted);
});

const hudRestartBtn = hud.querySelector('#btn-hud-restart') as HTMLButtonElement | null;
hudRestartBtn?.addEventListener('mouseenter', () => {
  hudRestartBtn.style.background = 'rgba(245, 158, 11, 0.25)';
  hudRestartBtn.style.borderColor = '#f59e0b';
});
hudRestartBtn?.addEventListener('mouseleave', () => {
  hudRestartBtn.style.background = 'rgba(245, 158, 11, 0.12)';
  hudRestartBtn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
});
hudRestartBtn?.addEventListener('click', () => {
  restartCurrentLevel();
});

// Toast Notification
const toast = document.createElement('div');
toast.id = 'game-toast';
toast.style.cssText = `
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(56, 189, 248, 0.6);
  border-radius: 12px;
  padding: 14px 32px;
  color: #38bdf8;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 800;
  pointer-events: none;
  user-select: none;
  z-index: 95;
  opacity: 0;
  transition: opacity 0.35s ease, transform 0.35s ease;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3);
`;
document.body.appendChild(toast);

// Level Transition Fade Overlay (0.4s fade-out / fade-in)
const transitionOverlay = document.createElement('div');
transitionOverlay.id = 'level-transition-overlay';
transitionOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  background: #000000;
  opacity: 0;
  pointer-events: none;
  user-select: none;
  z-index: 150;
  transition: opacity 0.4s ease-in-out;
`;
document.body.appendChild(transitionOverlay);

// Dedicated Floating Objective Mission Tracker Card (Top-Left under Level Title)
const objectiveCard = document.createElement('div');
objectiveCard.id = 'objective-card';
objectiveCard.style.cssText = `
  position: fixed;
  top: 12px;
  left: 16px;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 12px;
  padding: 8px 14px;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  display: none;
  flex-direction: column;
  gap: 6px;
  z-index: 80;
  user-select: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  max-width: 320px;
  transition: all 0.2s ease;
`;

let isObjectivesCollapsed = false;
objectiveCard.innerHTML = `
  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer;" id="objective-header-toggle">
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 14px;">🎯</span>
      <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.6px;">Célok</span>
      <span id="objective-level-title" style="font-size: 11px; font-weight: 700; color: #94a3b8; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></span>
    </div>
    <button id="btn-toggle-objectives" title="Célok összecsukása / kinyitása (Tab)" style="background: rgba(255,255,255,0.1); border: none; border-radius: 4px; color: #94a3b8; cursor: pointer; font-size: 11px; font-weight: 900; padding: 2px 6px; font-family: monospace;">−</button>
  </div>
  <div id="objective-items-list" style="display: flex; flex-direction: column; gap: 5px; margin-top: 2px;"></div>
`;
document.body.appendChild(objectiveCard);

const toggleObjectivesBtn = objectiveCard.querySelector('#btn-toggle-objectives') as HTMLButtonElement | null;
const objectiveHeaderToggle = objectiveCard.querySelector('#objective-header-toggle') as HTMLDivElement | null;
const objectiveListDiv = objectiveCard.querySelector('#objective-items-list') as HTMLDivElement | null;

const toggleObjectivesCollapse = () => {
  isObjectivesCollapsed = !isObjectivesCollapsed;
  if (objectiveListDiv && toggleObjectivesBtn) {
    objectiveListDiv.style.display = isObjectivesCollapsed ? 'none' : 'flex';
    toggleObjectivesBtn.textContent = isObjectivesCollapsed ? '+' : '−';
    objectiveCard.style.padding = isObjectivesCollapsed ? '6px 12px' : '8px 14px';
    objectiveCard.style.borderRadius = isObjectivesCollapsed ? '9999px' : '12px';
  }
};
objectiveHeaderToggle?.addEventListener('click', toggleObjectivesCollapse);

// Allow Tab key to toggle objective list collapse
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.repeat) {
    e.preventDefault();
    toggleObjectivesCollapse();
  }
});

let toastTimer: number | null = null;
function showToast(message: string): void {
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 3000);
}

// Dedicated Neon Cheat Notification Banner (Center Top)
const cheatBanner = document.createElement('div');
cheatBanner.id = 'cheat-notification-banner';
cheatBanner.style.cssText = `
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%) translateY(-30px);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(6, 182, 212, 0.95));
  border: 2px solid #34d399;
  border-radius: 12px;
  padding: 12px 28px;
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  text-align: center;
  box-shadow: 0 0 30px rgba(52, 211, 153, 0.75), 0 8px 32px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  user-select: none;
  opacity: 0;
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
cheatBanner.innerHTML = `
  <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-shadow: 0 0 12px rgba(255, 255, 255, 0.9);">⚡ CHEAT KÓD AKTIVÁLVA (V + K + C) ⚡</div>
  <div style="font-size: 13px; font-weight: 700; opacity: 0.95;">Minden kapu, nyomólap és relikvia feloldva! Szabad az átjárás a portálon!</div>
`;
document.body.appendChild(cheatBanner);

let cheatBannerTimer: number | null = null;
function showCheatNotification(): void {
  cheatBanner.style.opacity = '1';
  cheatBanner.style.transform = 'translateX(-50%) translateY(0)';
  if (cheatBannerTimer) clearTimeout(cheatBannerTimer);
  cheatBannerTimer = window.setTimeout(() => {
    cheatBanner.style.opacity = '0';
    cheatBanner.style.transform = 'translateX(-50%) translateY(-30px)';
  }, 4500);
}

let cheatTriggeredThisPress = false;
function activateCheatCode(): void {
  console.log('[CHEAT] V+K+C triggered! Fully unlocking level progression...');
  triggerSystem.unlockAllForCheat(level, p1, p2);
  p1RelicCollected = true;
  p2RelicCollected = true;
  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  updateHUD(activeLevel);

  showCheatNotification();
  showToast('⚡ CHEAT AKTIVÁLVA: Minden kapu és relikvia feloldva!');
  p1.say('⚡ V+K+C Cheat! Szabad az út a portálhoz!', 3.5);
  p2.say('⚡ Minden feloldva, mehetünk át!', 3.5);
}

function updateHUD(currentData: LevelData): void {
  const levelNameEl = document.querySelector('#level-name');
  const countEl = document.querySelector('#relic-count');
  const totalEl = document.querySelector('#relic-total');
  const p1StatusEl = document.querySelector('#p1-relic-status');
  const p2StatusEl = document.querySelector('#p2-relic-status');
  const tripEl = document.querySelector('#trip-level');

  if (levelNameEl) levelNameEl.textContent = currentData.name;

  const totalRelics = level.getTotalRelics();
  const collectedCount = triggerSystem.getCollectedCount();

  if (countEl) countEl.textContent = collectedCount.toString();
  if (totalEl) totalEl.textContent = totalRelics.toString();

  const isMushroom = currentData.theme === TileTheme.APARTMENT || currentData.id === 'level_1_apartment';
  const relicIcon = isMushroom ? '🍄' : '🌿';

  if (p1StatusEl) {
    p1StatusEl.innerHTML = p1RelicCollected
      ? `<span style="color: #38bdf8; font-weight: 700;">P1 ${relicIcon} [<span style="color: #10b981;">✓</span>]</span>`
      : `<span style="color: #64748b; font-weight: 600;">P1 ${relicIcon} [✗]</span>`;
  }

  if (p2StatusEl) {
    p2StatusEl.innerHTML = p2RelicCollected
      ? `<span style="color: #ef4444; font-weight: 700;">P2 ${relicIcon} [<span style="color: #10b981;">✓</span>]</span>`
      : `<span style="color: #64748b; font-weight: 600;">P2 ${relicIcon} [✗]</span>`;
  }

  if (tripEl) {
    const percent = Math.round(postProcessManager.getTargetIntensity() * 100);
    tripEl.textContent = `${percent}%`;
    if (percent > 60) {
      tripEl.setAttribute('style', 'color: #ec4899; font-weight: 700;');
    } else if (percent > 0) {
      tripEl.setAttribute('style', 'color: #a855f7; font-weight: 600;');
    } else {
      tripEl.setAttribute('style', 'color: #38bdf8; font-weight: 600;');
    }
  }

  // --- Dynamic Objective Mission Tracker HUD Update ---
  const objTitleEl = document.querySelector('#objective-level-title');
  const objListEl = document.querySelector('#objective-items-list');

  if (objTitleEl) {
    objTitleEl.textContent = currentData.name;
  }

  if (objListEl) {
    const activePlatesCount = triggerSystem.getPressedPlatesCount();
    const totalPlatesCount = triggerSystem.getTotalPlates();
    const exitReady = !triggerSystem.isExitLocked();

    const objectives = level.getObjectives(
      collectedCount,
      totalRelics,
      activePlatesCount,
      totalPlatesCount,
      exitReady,
      vibePuzzle.isComplete
    );

    objListEl.innerHTML = objectives
      .map((obj) => {
        if (obj.completed) {
          return `
            <div style="font-size: 13px; font-weight: 700; color: #4ade80; display: flex; align-items: flex-start; gap: 6px; line-height: 1.35; text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);">
              <span style="font-family: monospace; font-size: 14px; font-weight: 900; white-space: nowrap;">[✓]</span>
              <span style="text-decoration: line-through; opacity: 0.85;">${obj.text}</span>
            </div>
          `;
        } else {
          return `
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; display: flex; align-items: flex-start; gap: 6px; line-height: 1.35;">
              <span style="color: #94a3b8; font-family: monospace; font-size: 14px; font-weight: 900; white-space: nowrap;">[ ]</span>
              <span>${obj.text}</span>
            </div>
          `;
        }
      })
      .join('');
  }
}

// Relic Collection callback with 2-player dynamic tracking
triggerSystem.onRelicCollected = (_relic, _totalCollected, collector) => {
  postProcessManager.addIntensity(0.35);
  campaignManager.addRelicCollected();

  if (collector === 'p1') {
    p1.hasRelic = true;
  } else {
    p2.hasRelic = true;
  }
  p1RelicCollected = p1.hasRelic;
  p2RelicCollected = p2.hasRelic;

  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  updateHUD(activeLevel);

  const bothAcquired = p1.hasRelic && p2.hasRelic;
  if (bothAcquired) {
    showToast('✨ Mindkét relikvia összegyűjtve! (2 / 2)');
    p1.say('Mindkettőnknek megvan a cucc, indulás a kijárathoz!', 3.5);
    window.setTimeout(() => {
      p2.say('Ott a kapu, gyerünk Sopelana felé!', 3.0);
    }, 1500);
  } else if (collector === 'p1') {
    p1.say('Megvan az egyik relikvia! Keresd meg a tiédet is!', 3.0);
  } else {
    p2.say('Nekem is megvan a cuccom! Mehet a menet!', 3.0);
  }
};

triggerSystem.onPlateUnlocked = () => {
  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  updateHUD(activeLevel);
};

triggerSystem.onPlateChange = () => {
  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  updateHUD(activeLevel);
};

let lastLockedToastTime = 0;
triggerSystem.onLockedPortalContact = () => {
  const now = performance.now() / 1000;
  if (now - lastLockedToastTime > 3.0) {
    lastLockedToastTime = now;
    audioManager.playTetherWarning();

    const missingRelics = (!p1.hasRelic || !p2.hasRelic) && level.getTotalRelics() > 0;
    const missingPlates = !triggerSystem.areAllPlatesPressed();
    const missingVibe = triggerSystem.wallChillSpots.length > 0 && !vibePuzzle.isComplete;

    if (missingVibe) {
      showToast('🔒 A portál zárva! Üljetek le a fal tövébe és érjétek el a 100% tudat-fúziót!');
      p1.say('Zárva a portál! Előbb el kell érnünk a 100% tudat-fúziót a falnál!', 3.2);
    } else if (missingRelics && missingPlates) {
      showToast('🔒 A kapu le van zárva! Szerezzétek meg mindkét relikviát és lépjetek a lapokra!');
      p1.say('Zárva van a kapu! A cuccok és a nyomólapok is kellenek!', 3.0);
    } else if (missingRelics) {
      showToast('🔒 A kapu le van zárva! Mindkét relikviát össze kell gyűjtenetek!');
      p1.say('Még nincs meg mindkét relikvia! Keresd meg a tiédet!', 3.0);
    } else {
      showToast('🔒 A kapu le van zárva! Mindkét nyomólapot aktiválnotok kell!');
      p1.say('Le van zárva a kapu! Meg kell oldanunk a puzzle-t!', 3.0);
    }
  }
};

// Safe spawn finder: searches nearest non-solid cell if desired spawn is obstructed
function findSafeSpawn(desiredX: number, desiredZ: number, lvl: Level): THREE.Vector3 {
  const elev = lvl.getElevationAt(desiredX, desiredZ);
  if (!lvl.isSolidAtWorldPos(desiredX, desiredZ, elev)) {
    return new THREE.Vector3(desiredX, elev, desiredZ);
  }
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === r) {
          const testX = desiredX + dx * GRID_CELL_SIZE;
          const testZ = desiredZ + dz * GRID_CELL_SIZE;
          const testY = lvl.getElevationAt(testX, testZ);
          if (!lvl.isSolidAtWorldPos(testX, testZ, testY)) {
            return new THREE.Vector3(testX, testY, testZ);
          }
        }
      }
    }
  }
  return new THREE.Vector3(desiredX, elev, desiredZ);
}

// Retrieves active playable level from CampaignManager (custom from localStorage or default)
function getPlayableLevel(): LevelData {
  return campaignManager.getActiveLevel() || ALL_LEVELS[0] || DEFAULT_LEVEL;
}

// Victory Overlay UI for Campaign Completion
const victoryOverlay = document.createElement('div');
victoryOverlay.id = 'victory-overlay';
victoryOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 200;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
  text-align: center;
  padding: 20px;
`;

victoryOverlay.innerHTML = `
  <div style="font-size: 56px; filter: drop-shadow(0 0 24px rgba(56, 189, 248, 0.6));">🏆</div>
  <h1 style="font-size: 32px; font-weight: 800; margin: 0; background: linear-gradient(135deg, #38bdf8, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
    KAMPÁNY TELJESÍTVE!
  </h1>
  <p style="font-size: 15px; color: #94a3b8; max-width: 460px; margin: 0; line-height: 1.5;">
    Gratulálunk! Az összes szintet sikeresen teljesítettétek! Bilbaó felfedezve, a shroom relikviák összegyűjtve.
  </p>
  <div style="display: flex; gap: 12px; margin-top: 10px;">
    <button id="victory-replay-btn" style="
      background: linear-gradient(135deg, #059669, #10b981);
      color: white; border: 1px solid #34d399; border-radius: 8px; padding: 12px 24px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    ">🔄 Újrajátszás</button>
    <button id="victory-menu-btn" style="
      background: #1e293b; color: white; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
    ">🚪 Főmenü</button>
  </div>
  <div style="font-size: 12px; color: #94a3b8; font-weight: 700; margin-top: 6px;">
    🎮 [D-Pad] Választás • [A] Kiválasztás
  </div>
`;
document.body.appendChild(victoryOverlay);

const victoryButtons: HTMLButtonElement[] = [];
let victoryFocusIndex = 0;

function initVictoryButtons(): void {
  const replay = victoryOverlay.querySelector('#victory-replay-btn') as HTMLButtonElement;
  const menu = victoryOverlay.querySelector('#victory-menu-btn') as HTMLButtonElement;
  if (replay && menu) {
    victoryButtons.length = 0;
    victoryButtons.push(replay, menu);
  }
}
initVictoryButtons();

function updateVictoryFocusVisuals(): void {
  victoryButtons.forEach((btn, idx) => {
    if (idx === victoryFocusIndex) {
      btn.style.outline = '3px solid #38bdf8';
      btn.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.8)';
      btn.style.transform = 'scale(1.05)';
    } else {
      btn.style.outline = 'none';
      btn.style.boxShadow = idx === 0 ? '0 4px 14px rgba(16, 185, 129, 0.4)' : 'none';
      btn.style.transform = 'none';
    }
  });
}

function updateVictoryController(): void {
  if (victoryOverlay.style.display !== 'flex') return;
  if (
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_LEFT) ||
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP)
  ) {
    victoryFocusIndex = 0;
    audioManager.playKeypadBeep(700);
    updateVictoryFocusVisuals();
  } else if (
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_RIGHT) ||
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN)
  ) {
    victoryFocusIndex = 1;
    audioManager.playKeypadBeep(700);
    updateVictoryFocusVisuals();
  }
  if (inputManager.isAnyButtonJustPressed(XboxButton.A)) {
    victoryButtons[victoryFocusIndex]?.click();
  }
}

victoryOverlay.querySelector('#victory-replay-btn')?.addEventListener('click', () => {
  victoryOverlay.style.display = 'none';
  currentLevelIndex = 0;
  campaignManager.setActiveIndex(0);
  const firstLvl = campaignManager.getActiveLevel();
  loadCurrentLevel(firstLvl);
  showToast(`Újrajátszás: ${firstLvl.name}`);
});

victoryOverlay.querySelector('#victory-menu-btn')?.addEventListener('click', () => {
  victoryOverlay.style.display = 'none';
  gameState.setMode(GameMode.MENU);
});

// ============================================================================
// In-Game Pause Menu & Hold-'R' Quick Restart Overlays
// ============================================================================

// 1. Pause Menu Overlay (Esc key in playing mode)
const pauseMenuOverlay = document.createElement('div');
pauseMenuOverlay.id = 'pause-menu-overlay';
pauseMenuOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 180;
  color: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
`;

pauseMenuOverlay.innerHTML = `
  <div style="
    background: rgba(30, 41, 59, 0.96);
    border: 2px solid rgba(56, 189, 248, 0.5);
    border-radius: 18px;
    padding: 34px 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-width: 400px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.2);
  ">
    <div style="font-size: 16px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.2px;">
      ⏸️ Játék Szüneteltetve
    </div>
    <div id="pause-level-title" style="font-size: 24px; font-weight: 900; color: #f8fafc; text-align: center; margin-bottom: 4px;">
      Szint
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
      <button id="pause-btn-resume" style="
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: white; border: 1.5px solid #38bdf8; border-radius: 10px; padding: 14px 22px;
        font-size: 17px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
      ">
        <span>▶️ Folytatás</span>
        <kbd style="background: rgba(255,255,255,0.25); font-size: 13px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">Esc / (B)</kbd>
      </button>

      <button id="pause-btn-restart" style="
        background: rgba(245, 158, 11, 0.18);
        color: #f59e0b; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 14px 22px;
        font-size: 17px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
      ">
        <span>🔄 Pálya újraindítása</span>
        <kbd style="background: rgba(245, 158, 11, 0.3); font-size: 13px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">R</kbd>
      </button>

      <button id="pause-btn-editor" style="
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8; border: 1.5px solid rgba(56, 189, 248, 0.5); border-radius: 10px; padding: 12px 22px;
        font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      ">
        <span>🛠️ Szerkesztő</span>
      </button>

      <button id="pause-btn-menu" style="
        background: rgba(239, 68, 68, 0.12);
        color: #f87171; border: 1.5px solid rgba(239, 68, 68, 0.5); border-radius: 10px; padding: 12px 22px;
        font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      ">
        <span>🚪 Kilépés a Főmenübe</span>
      </button>
    </div>
    <div id="pause-controller-info" style="font-size: 13px; color: #38bdf8; font-weight: 700; text-align: center; background: rgba(56, 189, 248, 0.1); border-radius: 8px; padding: 8px 12px; width: 100%;">
      🎮 Irányítás: Bal kar = Viki, Jobb kar = Kristóf | Nyilak / IJKL = Kristóf
    </div>
    <div style="font-size: 13px; color: #94a3b8; font-weight: 700; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; width: 100%;">
      🎮 [D-Pad] Navigáció • [A] Kiválasztás • [B / Start] Folytatás
    </div>
  </div>
`;
document.body.appendChild(pauseMenuOverlay);

const pauseButtons: HTMLButtonElement[] = [];
let pauseFocusIndex = 0;

function initPauseButtons(): void {
  const resume = pauseMenuOverlay.querySelector('#pause-btn-resume') as HTMLButtonElement;
  const restart = pauseMenuOverlay.querySelector('#pause-btn-restart') as HTMLButtonElement;
  const editor = pauseMenuOverlay.querySelector('#pause-btn-editor') as HTMLButtonElement;
  const menu = pauseMenuOverlay.querySelector('#pause-btn-menu') as HTMLButtonElement;
  if (resume && restart && editor && menu) {
    pauseButtons.length = 0;
    pauseButtons.push(resume, restart, editor, menu);
  }
}
initPauseButtons();

function updatePauseFocusVisuals(): void {
  pauseButtons.forEach((btn, idx) => {
    if (idx === pauseFocusIndex) {
      btn.style.outline = '3px solid #38bdf8';
      btn.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.8)';
      btn.style.transform = 'scale(1.02)';
    } else {
      btn.style.outline = 'none';
      btn.style.boxShadow = idx === 0 ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none';
      btn.style.transform = 'none';
    }
  });
}

function updatePauseController(): void {
  if (!isPauseMenuOpen) return;
  if (
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP) ||
    inputManager.isButtonJustPressed(0, XboxButton.DPAD_UP)
  ) {
    pauseFocusIndex = (pauseFocusIndex - 1 + pauseButtons.length) % pauseButtons.length;
    audioManager.playKeypadBeep(700);
    updatePauseFocusVisuals();
  } else if (
    inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN) ||
    inputManager.isButtonJustPressed(0, XboxButton.DPAD_DOWN)
  ) {
    pauseFocusIndex = (pauseFocusIndex + 1) % pauseButtons.length;
    audioManager.playKeypadBeep(700);
    updatePauseFocusVisuals();
  }

  if (inputManager.isAnyButtonJustPressed(XboxButton.A)) {
    pauseButtons[pauseFocusIndex]?.click();
  }

  if (
    inputManager.isAnyButtonJustPressed(XboxButton.B) ||
    inputManager.isAnyButtonJustPressed(XboxButton.START)
  ) {
    hidePauseMenu();
  }
}

// 2. Hold-'R' Circular Progress Bar Indicator
const restartHoldIndicator = document.createElement('div');
restartHoldIndicator.id = 'restart-hold-indicator';
restartHoldIndicator.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 16px;
  padding: 18px 26px;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 210;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.25);
  pointer-events: none;
  user-select: none;
  transition: transform 0.15s ease, opacity 0.15s ease;
  opacity: 0;
`;

restartHoldIndicator.innerHTML = `
  <div style="position: relative; width: 68px; height: 68px; display: flex; align-items: center; justify-content: center;">
    <svg width="68" height="68" viewBox="0 0 68 68" style="position: absolute; inset: 0;">
      <circle cx="34" cy="34" r="28" stroke="rgba(255, 255, 255, 0.15)" stroke-width="5" fill="none" />
      <circle id="r-hold-progress-circle" cx="34" cy="34" r="28" stroke="#38bdf8" stroke-width="5" fill="none"
              stroke-dasharray="175.9" stroke-dashoffset="175.9" stroke-linecap="round"
              transform="rotate(-90 34 34)" style="transition: stroke-dashoffset 0.04s linear;" />
    </svg>
    <span style="font-size: 24px; z-index: 1;">🔄</span>
  </div>
  <div style="font-size: 13px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px;">Pálya újraindítása...</div>
  <div style="font-size: 11px; color: #94a3b8;">Tartsd nyomva az <b style="color:#f8fafc;">[R]</b> gombot (1 mp)</div>
`;
document.body.appendChild(restartHoldIndicator);

let isPauseMenuOpen = false;
let rKeyHoldStartTime: number | null = null;
let rKeyHoldRaf: number | null = null;
const R_HOLD_DURATION_MS = 1000;

function updateRHoldProgress(progress: number): void {
  const circle = document.querySelector('#r-hold-progress-circle') as SVGCircleElement | null;
  if (circle) {
    const totalLength = 175.9;
    const offset = totalLength * (1.0 - Math.min(1.0, Math.max(0, progress)));
    circle.style.strokeDashoffset = offset.toFixed(1);
    if (progress > 0.8) {
      circle.style.stroke = '#f59e0b';
    } else {
      circle.style.stroke = '#38bdf8';
    }
  }
}

function showRHoldIndicator(): void {
  updateRHoldProgress(0);
  restartHoldIndicator.style.display = 'flex';
  requestAnimationFrame(() => {
    restartHoldIndicator.style.opacity = '1';
    restartHoldIndicator.style.transform = 'translate(-50%, -50%) scale(1.0)';
  });
}

function hideRHoldIndicator(): void {
  restartHoldIndicator.style.opacity = '0';
  restartHoldIndicator.style.transform = 'translate(-50%, -50%) scale(0.9)';
  window.setTimeout(() => {
    if (rKeyHoldStartTime === null) {
      restartHoldIndicator.style.display = 'none';
    }
  }, 150);
}

function startRHold(): void {
  if (rKeyHoldStartTime !== null || isPauseMenuOpen || isFinaleCinematic || isLevelTransitioning) return;
  rKeyHoldStartTime = performance.now();
  showRHoldIndicator();

  const tick = () => {
    if (rKeyHoldStartTime === null) return;
    const elapsed = performance.now() - rKeyHoldStartTime;
    const progress = Math.min(1.0, elapsed / R_HOLD_DURATION_MS);
    updateRHoldProgress(progress);

    if (progress >= 1.0) {
      cancelRHold();
      restartCurrentLevel();
    } else {
      rKeyHoldRaf = requestAnimationFrame(tick);
    }
  };
  rKeyHoldRaf = requestAnimationFrame(tick);
}

function cancelRHold(): void {
  rKeyHoldStartTime = null;
  if (rKeyHoldRaf !== null) {
    cancelAnimationFrame(rKeyHoldRaf);
    rKeyHoldRaf = null;
  }
  hideRHoldIndicator();
}

function showPauseMenu(): void {
  if (gameState.getMode() !== GameMode.PLAYING) return;
  isPauseMenuOpen = true;
  cancelRHold();
  pauseFocusIndex = 0;
  updatePauseFocusVisuals();
  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  const titleEl = pauseMenuOverlay.querySelector('#pause-level-title');
  if (titleEl && activeLevel) {
    titleEl.textContent = activeLevel.name;
  }
  const ctrlInfoEl = pauseMenuOverlay.querySelector('#pause-controller-info');
  if (ctrlInfoEl) {
    ctrlInfoEl.textContent = '🎮 ' + inputManager.getControllerSchemeInfo().description;
  }
  pauseMenuOverlay.style.display = 'flex';
}

function hidePauseMenu(): void {
  isPauseMenuOpen = false;
  pauseMenuOverlay.style.display = 'none';
}

function togglePauseMenu(): void {
  if (isPauseMenuOpen) {
    hidePauseMenu();
  } else {
    showPauseMenu();
  }
}

pauseMenuOverlay.querySelector('#pause-btn-resume')?.addEventListener('click', () => {
  hidePauseMenu();
});

pauseMenuOverlay.querySelector('#pause-btn-restart')?.addEventListener('click', () => {
  hidePauseMenu();
  restartCurrentLevel();
});

pauseMenuOverlay.querySelector('#pause-btn-editor')?.addEventListener('click', () => {
  hidePauseMenu();
  gameState.setMode(GameMode.EDITOR);
  showToast('🛠️ Visszatérés a szerkesztőbe');
});

pauseMenuOverlay.querySelector('#pause-btn-menu')?.addEventListener('click', () => {
  hidePauseMenu();
  gameState.setMode(GameMode.MENU);
});

// Level loading helper
function loadCurrentLevel(levelData: LevelData): void {
  // Reset any active finale cinematic states
  if (currentBonfire) {
    currentBonfire.dispose();
    currentBonfire = null;
  }
  isFinaleCinematic = false;
  cashierEncounterTriggered = false;
  falloutDialogue.closeEncounter();
  cameraRig.stopCinematic();
  p1.setSitting(false);
  p2.setSitting(false);
  if (vibePuzzle.isActive) {
    vibePuzzle.stopChillMode();
  }
  p1.setDialogueFade(false);
  p2.setDialogueFade(false);
  tetherRenderer.setVisible(true);

  // Smoothly trigger dynamic BGM for current level
  musicManager.playLevelMusic(levelData.id || campaignManager.getActiveIndex());

  // 1. Load world tiles
  level.loadLevel(levelData, scene, p1, p2, cameraRig);

  // Ensure player meshes are attached to scene graph and visible
  if (!scene.children.includes(p1.mesh)) {
    scene.add(p1.mesh);
  }
  if (!scene.children.includes(p2.mesh)) {
    scene.add(p2.mesh);
  }
  p1.mesh.visible = true;
  p2.mesh.visible = true;
  if (p1.spriteMesh) {
    p1.spriteMesh.visible = true;
    if (p1.spriteMesh.material) {
      (p1.spriteMesh.material as THREE.Material).opacity = 1.0;
      (p1.spriteMesh.material as any).depthWrite = true;
    }
  }
  if (p2.spriteMesh) {
    p2.spriteMesh.visible = true;
    if (p2.spriteMesh.material) {
      (p2.spriteMesh.material as THREE.Material).opacity = 1.0;
      (p2.spriteMesh.material as any).depthWrite = true;
    }
  }

  // 2. Position players safely at designated spawn coordinates
  const p1DesiredX = (levelData.spawnP1 ? levelData.spawnP1[0] : 2) * GRID_CELL_SIZE;
  const p1DesiredZ = (levelData.spawnP1 ? levelData.spawnP1[1] : 2) * GRID_CELL_SIZE;
  const p1Spawn = findSafeSpawn(p1DesiredX, p1DesiredZ, level);
  p1.resetState(p1Spawn);
  p1.updateElevation(level, 0.016);

  const p2DesiredX = (levelData.spawnP2 ? levelData.spawnP2[0] : 2) * GRID_CELL_SIZE;
  const p2DesiredZ = (levelData.spawnP2 ? levelData.spawnP2[1] : 4) * GRID_CELL_SIZE;
  const p2Spawn = findSafeSpawn(p2DesiredX, p2DesiredZ, level);
  p2.resetState(p2Spawn);
  p2.updateElevation(level, 0.016);

  // 3. Set camera spline path & snap camera framing immediately
  cameraRig.setCameraMode(levelData.cameraMode || 'isometric');
  cameraRig.setPath(levelData.cameraWaypoints);
  cameraRig.snap(p1.position, p2.position);
  cameraRig.clearOcclusion();

  // Orient player sprites toward camera immediately after spawn positioning
  p1.update(0, { x: 0, y: 0 }, cameraRig, level);
  p2.update(0, { x: 0, y: 0 }, cameraRig, level);
  p1.updateScreenPosition(camera);
  p2.updateScreenPosition(camera);

  // 4. Populate gameplay triggers
  cameraRig.clearOcclusion();
  triggerSystem.clear();
  p1RelicCollected = false;
  p2RelicCollected = false;

  if (levelData.platePairs) {
    for (const pair of levelData.platePairs) {
      triggerSystem.addPlatePair(pair.id, pair.plate1, pair.plate2, pair.targetObstacle, level);
    }
  }

  if (levelData.relics) {
    for (const relic of levelData.relics) {
      const pos: [number, number] = relic.position || [relic.x ?? 0, relic.z ?? 0];
      const rType = relic.type || (levelData.theme === TileTheme.APARTMENT ? 'mushroom' : 'joint');
      triggerSystem.addRelic(relic.id, pos, level, rType);
    }
  }

  triggerSystem.initSwitchesFromLevel(level, levelData);
  triggerSystem.initKeypadsFromLevel(level, levelData);
  triggerSystem.initHeavyObstaclesFromLevel(level, levelData);
  triggerSystem.initClueNotesFromLevel(level, levelData);
  triggerSystem.initWallChillSpotsFromLevel(level, levelData);

  if (levelData.exitPortal) {
    triggerSystem.addExitPortal('level_exit', levelData.exitPortal, level, levelData);
  }

  // Psychedelic baselines
  if (levelData.theme === TileTheme.PARK || levelData.id === 'level_6_etxebarria') {
    vibePuzzle.tripLevel = 0.20;
    vibePuzzle.isComplete = false;
    postProcessManager.setIntensity(0.20);
  } else if (levelData.id === 'level_3_sopelana' || levelData.id === 'level_5_sopelana') {
    postProcessManager.setIntensity(0.5);
  } else {
    postProcessManager.setIntensity(0.0);
  }

  // 5. Update parametric low-poly environment backdrop, lighting, and sky/fog per theme
  environmentBackdrop.setTheme(levelData.theme, scene, dirLight, ambientLight, hemiLight, levelData);
  if (levelData.sunIntensity !== undefined) {
    environmentBackdrop.setSunIntensity(levelData.sunIntensity);
  }
  if (levelData.fixtureIntensity !== undefined) {
    environmentBackdrop.setFixtureIntensity(levelData.fixtureIntensity, scene);
  }

  updateHUD(levelData);
  if (gameState.getMode() === GameMode.PLAYING) {
    showToast(`Belépés: ${levelData.name}`);
    if (levelData.introDialogue) {
      dialogueOverlay.showDialogue(
        levelData.introDialogue.speaker,
        levelData.introDialogue.text,
        0,
        levelData.introDialogue.voiceKey
      );
    }
  }
}

// Single-Level Quick Restart Helper
function restartCurrentLevel(): void {
  hidePauseMenu();
  cancelRHold();

  if (currentBonfire) {
    currentBonfire.dispose();
    currentBonfire = null;
  }
  isFinaleCinematic = false;
  isLevelTransitioning = false;
  cashierEncounterTriggered = false;
  falloutDialogue.closeEncounter();
  cameraRig.stopCinematic();
  p1.setSitting(false);
  p2.setSitting(false);
  if (vibePuzzle.isActive) {
    vibePuzzle.stopChillMode();
  }
  vibePuzzle.isComplete = false;
  vibePuzzle.tripLevel = 0.20;
  tetherRenderer.setVisible(true);

  dialogueOverlay.clearQueue();
  dialogueOverlay.hideDialogue();
  p1.say('', 0);
  p2.say('', 0);

  p1.hasRelic = false;
  p2.hasRelic = false;
  p1RelicCollected = false;
  p2RelicCollected = false;

  const restartedLevelData = campaignManager.restartCurrentLevel();
  loadCurrentLevel(restartedLevelData);

  showToast('🔄 Pálya újraindítva!');
}

// Sopelana Beach Finale Sequence
function startSopelanaFinaleSequence(): void {
  isLevelTransitioning = true;
  isFinaleCinematic = true;

  // 1. Despawn the teleporter ring
  if (triggerSystem.exitPortal) {
    triggerSystem.exitPortal.group.visible = false;
  }

  // 2. Spawn roaring 3D beach bonfire mesh
  const bonfireGridX = 58;
  const bonfireGridZ = 17;
  const elev = level.getElevationAt(bonfireGridX * GRID_CELL_SIZE, bonfireGridZ * GRID_CELL_SIZE);
  const bonfirePos = new THREE.Vector3(bonfireGridX * GRID_CELL_SIZE, elev, bonfireGridZ * GRID_CELL_SIZE);

  if (currentBonfire) {
    currentBonfire.dispose();
  }
  currentBonfire = new BonfireMesh(bonfirePos);
  scene.add(currentBonfire.group);

  // 3. Lock input and snap both characters into sitting positions facing the sunset ocean (+X)
  p1.position.set((bonfireGridX - 1.2) * GRID_CELL_SIZE, elev, (bonfireGridZ - 0.8) * GRID_CELL_SIZE);
  p2.position.set((bonfireGridX - 1.2) * GRID_CELL_SIZE, elev, (bonfireGridZ + 0.8) * GRID_CELL_SIZE);
  p1.setSitting(true, -Math.PI / 2);
  p2.setSitting(true, -Math.PI / 2);
  tetherRenderer.setVisible(false);

  p1.say('Megcsináltuk, Viki... Végre itt vagyunk a parton.', 4.2);
  window.setTimeout(() => {
    p2.say('Nézd a naplementét... Ennél szebb befejezést nem is kívánhatnék.', 4.5);
  }, 2200);

  // 4. Audio: ambient ocean wave wash, lush finale chords & sunset music
  audioManager.playOceanWaveWash();
  audioManager.playFinaleChords();
  musicManager.playLevelMusic(5);

  // 5. Trip post-processing flare-up -> mellow warm golden hour
  postProcessManager.setIntensity(1.0);

  // 6. Camera smooth dolly back along -X and rise up +Y along Flysch cliffs
  const startCamPos = new THREE.Vector3(bonfirePos.x - 7.0, elev + 2.8, bonfirePos.z);
  const endCamPos = new THREE.Vector3(bonfirePos.x - 28.0, elev + 18.0, bonfirePos.z - 3.5);
  const startLookAt = new THREE.Vector3(bonfirePos.x + 4.0, elev + 1.2, bonfirePos.z);
  const endLookAt = new THREE.Vector3(bonfirePos.x + 20.0, elev + 3.0, bonfirePos.z);

  cameraRig.startCinematic(startCamPos, startLookAt);

  const cinematicStartTime = performance.now();
  const cinematicDurationMs = 4500;

  const updateCinematic = (now: number) => {
    if (!isFinaleCinematic) return;

    const elapsed = now - cinematicStartTime;
    const t = Math.min(1.0, elapsed / cinematicDurationMs);
    // Smooth easeInOutCubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const currentCam = new THREE.Vector3().lerpVectors(startCamPos, endCamPos, ease);
    const currentLook = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, ease);
    cameraRig.setCinematicTransform(currentCam, currentLook);

    // Trip shader transition: radiant sunset flare (1.0) gradually eases to golden hour (0.15)
    postProcessManager.setIntensity(1.0 - ease * 0.85);

    if (t < 1.0) {
      requestAnimationFrame(updateCinematic);
    } else {
      // 7. Show End-Game Statistics Screen & Victory Modal
      victoryScreen.show({
        playTimeSeconds: campaignManager.getPlayTime(),
        relicsCollected: Math.min(10, Math.max(10, campaignManager.getTotalRelicsCollected())),
        totalRelics: 10,
        tripLevel: 100,
        stunCount: campaignManager.getStunCount(),
        onReplay: () => {
          isFinaleCinematic = false;
          isLevelTransitioning = false;
          cameraRig.stopCinematic();
          if (currentBonfire) {
            currentBonfire.dispose();
            currentBonfire = null;
          }
          campaignManager.resetRunStats();
          campaignManager.setActiveIndex(0);
          const firstLevel = campaignManager.getActiveLevel();
          loadCurrentLevel(firstLevel);
          showToast('🔄 Újrajátszás: 1. Viki lakása');
        },
        onMainMenu: () => {
          isFinaleCinematic = false;
          isLevelTransitioning = false;
          cameraRig.stopCinematic();
          if (currentBonfire) {
            currentBonfire.dispose();
            currentBonfire = null;
          }
          gameState.setMode(GameMode.MENU);
        },
      });
    }
  };

  requestAnimationFrame(updateCinematic);
}

// Exit Portal Trigger -> Advance Level Progression
let isLoopPaused = false;
let isLevelTransitioning = false;
triggerSystem.onLevelComplete = () => {
  if (isLevelTransitioning || isFinaleCinematic) return;
  level.hasTriggeredExit = true;

  audioManager.playPlateStep(true, true);
  audioManager.playPickup();

  const activeLevel = campaignManager.getActiveLevel() || ALL_LEVELS[currentLevelIndex];
  const isSopelanaFinale =
    activeLevel.id === 'level_5_sopelana' ||
    activeLevel.id === 'level_3_sopelana' ||
    campaignManager.getActiveIndex() >= campaignManager.getLevels().length - 1;

  if (isSopelanaFinale) {
    startSopelanaFinaleSequence();
    return;
  }

  isLevelTransitioning = true;

  const proceedWithTransition = () => {
    // 1. Fade-out black screen overlay (0.4s)
    transitionOverlay.style.opacity = '1';

    window.setTimeout(() => {
      isLoopPaused = true;
      try {
        const nextIndex = campaignManager.getActiveIndex() + 1;
        console.log(`[Transition] Switching to level index: ${nextIndex}`);

        // 2. Stop and clear active dialogue/speech bubble timers
        dialogueOverlay.clearQueue();
        dialogueOverlay.hideDialogue();
        p1.say('', 0);
        p2.say('', 0);

        // 3. Safely dispose previous level Three.js resources and triggers
        level.dispose(p1, p2);
        triggerSystem.clear();

        // 4. Advance level via campaignManager
        const nextLevelData = campaignManager.nextLevel();
        if (!nextLevelData) {
          // Reached end of campaign!
          transitionOverlay.style.opacity = '0';
          isLevelTransitioning = false;
          triggerSystem.isTransitioning = false;
          level.hasTriggeredExit = false;
          showToast('🎉 GYŐZELEM! A KAMPÁNY MINDEN PÁLYÁJA TELJESÍTVE! 🎉');
          victoryOverlay.style.display = 'flex';
          return;
        }

        currentLevelIndex = campaignManager.getActiveIndex();

        // 5. Reset player state and load new level
        p1.resetState();
        p2.resetState();
        p1RelicCollected = false;
        p2RelicCollected = false;

        loadCurrentLevel(nextLevelData);

        // 6. Camera snap & re-attachment at new level spawn
        const midPoint = new THREE.Vector3().addVectors(p1.position, p2.position).multiplyScalar(0.5);
        cameraRig.snapToTarget(midPoint);
        cameraRig.clearOcclusion();
        level.hasTriggeredExit = false;

        // 7. Fade back in smoothly after rendering tick
        window.setTimeout(() => {
          transitionOverlay.style.opacity = '0';
          window.setTimeout(() => {
            isLevelTransitioning = false;
            triggerSystem.isTransitioning = false;
            level.hasTriggeredExit = false;
          }, 400);
        }, 50);
      } catch (err) {
        console.error('[Transition ERROR] Failed to load level:', err);
        transitionOverlay.style.opacity = '0';
        isLevelTransitioning = false;
        triggerSystem.isTransitioning = false;
        level.hasTriggeredExit = false;
      } finally {
        isLoopPaused = false;
      }
    }, 400);
  };

  if (activeLevel && activeLevel.outroDialogue) {
    dialogueOverlay.showDialogue(
      activeLevel.outroDialogue.speaker,
      activeLevel.outroDialogue.text,
      0,
      activeLevel.outroDialogue.voiceKey,
      () => {
        proceedWithTransition();
      }
    );
  } else {
    proceedWithTransition();
  }
};

// Initial Level Load (loads active level from campaign)
loadCurrentLevel(getPlayableLevel());

let isPlaytestMode = false;

// Initialize Level Editor
const editor = new LevelEditor(scene, camera, level, canvas, environmentBackdrop, dirLight, ambientLight);
editor.syncWaypointsFromLevel();
editor.onLevelLoaded = (data: LevelData) => {
  loadCurrentLevel(data);
};
editor.onPlaytest = (data: LevelData) => {
  isPlaytestMode = true;
  objectiveCard.style.top = '64px';
  currentLevelIndex = campaignManager.getActiveIndex();
  loadCurrentLevel(data);
};

// "Vissza a szerkesztőbe" top-left quick button (visible only in playtest mode)
const returnToEditorBtn = document.createElement('button');
returnToEditorBtn.id = 'btn-return-to-editor';
returnToEditorBtn.innerHTML = '🛠️ <b>Vissza a szerkesztőbe</b> <kbd style="background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">Esc</kbd>';
returnToEditorBtn.style.cssText = `
  position: fixed;
  top: 16px;
  left: 16px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(8px);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: none;
  align-items: center;
  z-index: 120;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  transition: background 0.2s, border-color 0.2s, transform 0.1s;
`;
returnToEditorBtn.onmouseenter = () => {
  returnToEditorBtn.style.background = 'rgba(30, 41, 59, 0.98)';
  returnToEditorBtn.style.borderColor = '#38bdf8';
};
returnToEditorBtn.onmouseleave = () => {
  returnToEditorBtn.style.background = 'rgba(15, 23, 42, 0.92)';
  returnToEditorBtn.style.borderColor = 'rgba(56, 189, 248, 0.4)';
};
returnToEditorBtn.onclick = () => {
  gameState.setMode(GameMode.EDITOR);
  showToast('🛠️ Visszatérés a szerkesztőbe');
};
document.body.appendChild(returnToEditorBtn);

let isKeyboardRDown = false;

// Keyboard shortcut: Escape toggles in-game pause menu, and KeyR hold quick restarts level
window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

  if (e.key === 'Escape' && gameState.getMode() === GameMode.PLAYING) {
    e.preventDefault();
    togglePauseMenu();
    return;
  }

  if (e.code === 'KeyR' && gameState.getMode() === GameMode.PLAYING && !e.repeat) {
    isKeyboardRDown = true;
    if (isPauseMenuOpen) {
      e.preventDefault();
      hidePauseMenu();
      restartCurrentLevel();
    } else {
      e.preventDefault();
      startRHold();
    }
    return;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyR') {
    isKeyboardRDown = false;
    cancelRHold();
  }
});

window.addEventListener('blur', () => {
  isKeyboardRDown = false;
  cancelRHold();
});

// Keyboard shortcut: V + K + C Cheat Code Listener
window.addEventListener('keydown', () => {
  if (gameState.getMode() === GameMode.PLAYING) {
    if (inputManager.isCheatComboPressed() && !cheatTriggeredThisPress) {
      cheatTriggeredThisPress = true;
      activateCheatCode();
    }
  }
});
window.addEventListener('keyup', () => {
  if (!inputManager.isCheatComboPressed()) {
    cheatTriggeredThisPress = false;
  }
});

// Initialize Main Menu & Settings UI
const mainMenu = new MainMenu({
  onStartGame: () => {
    isPlaytestMode = false;
    objectiveCard.style.top = '16px';
    currentLevelIndex = 0;
    campaignManager.resetRunStats();
    campaignManager.setActiveIndex(0);
    const levelToPlay = campaignManager.getActiveLevel();
    loadCurrentLevel(levelToPlay);
    showToast(`Játék indult: ${levelToPlay.name}`);
  },
  onSelectLevel: (levelIndex: number) => {
    isPlaytestMode = false;
    objectiveCard.style.top = '16px';
    currentLevelIndex = levelIndex;
    campaignManager.resetRunStats();
    campaignManager.loadLevel(levelIndex);
    const levelToPlay = campaignManager.getActiveLevel();
    loadCurrentLevel(levelToPlay);
    showToast(`Pálya betöltve: ${levelToPlay.name}`);
  },
  onFactoryReset: () => {
    isPlaytestMode = false;
    currentLevelIndex = 0;
    campaignManager.resetRunStats();
    campaignManager.setActiveIndex(0);
    const levelToPlay = campaignManager.getActiveLevel();
    loadCurrentLevel(levelToPlay);
    showToast('⚠️ Gyári szintek visszaállítva! Kampány újraindult a Szint 1-ről.');
  },
  postProcessManager,
});

// Keyboard shortcut: M / m toggles background music mute
window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

  if (e.key === 'm' || e.key === 'M') {
    const isMuted = musicManager.toggleMute();
    showToast(isMuted ? '🔇 Zene elnémítva (M)' : '🔊 Zene bekapcsolva (M)');
  }
});

// Sync HUD and return-to-editor button visibility with GameMode
gameState.onModeChange((newMode) => {
  const isPlaying = newMode === GameMode.PLAYING;
  hud.style.display = isPlaying ? 'flex' : 'none';
  objectiveCard.style.display = isPlaying ? 'flex' : 'none';
  objectiveCard.style.top = isPlaying && isPlaytestMode ? '64px' : '16px';
  returnToEditorBtn.style.display = isPlaying && isPlaytestMode ? 'flex' : 'none';
  gridHelper.visible = newMode === GameMode.EDITOR;
  if (!isPlaying) {
    hidePauseMenu();
    cancelRHold();
    victoryOverlay.style.display = 'none';
    dialogueOverlay.clearQueue();
    dialogueOverlay.hideDialogue();
    p1.say('', 0);
    p2.say('', 0);
  }

  if (isPlaying) {
    if (!isPlaytestMode) {
      const levelToPlay = getPlayableLevel();
      loadCurrentLevel(levelToPlay);
    }
    cameraRig.setCameraMode(level.getCameraMode());
    editor.setRoofVisibility(true);
    cameraRig.snap(p1.position, p2.position);
    inputManager.reset();
  } else if (newMode === GameMode.EDITOR) {
    cameraRig.resetForEditor();
    editor.setRoofVisibility(false);
    musicManager.stop(1.0);
    environmentBackdrop.setTheme(level.getTheme(), scene, dirLight, ambientLight, hemiLight, level.getBounds());
  } else if (newMode === GameMode.MENU) {
    editor.setRoofVisibility(true);
    musicManager.stop(1.0);
  }
});

// Clock
const clock = new THREE.Clock();
let menuTime = 0;

// Resize listener
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  postProcessManager.resize(window.innerWidth, window.innerHeight);
});

// Render loop: Mode-based dispatch
function animate(): void {
  requestAnimationFrame(animate);

  // Poll controller and keyboard edge detection every frame
  inputManager.update();

  if (isLoopPaused || !level || !p1 || !p2) {
    renderer.render(scene, camera);
    return;
  }

  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();
  const mode = gameState.getMode();

  // Update animated environment (e.g. Sopelana coastal wave ripples)
  environmentBackdrop.update(delta, elapsedTime);

  // Update animated water and relic tiles in level
  level.update(elapsedTime, delta);

  // --- 1. MENU & SETTINGS MODES ---
  if (mode === GameMode.MENU || mode === GameMode.SETTINGS) {
    mainMenu.update();
    tetherRenderer.setVisible(false);
    menuTime += delta;
    // Slow cinematic pan around the city plaza
    camera.position.x = 13 + Math.sin(menuTime * 0.15) * 20;
    camera.position.z = 13 + Math.cos(menuTime * 0.15) * 20;
    camera.position.y = 16;
    camera.lookAt(13, 1.0, 13);

    // Keep ambient trigger animations alive (relic spinning, etc.)
    triggerSystem.update(delta, p1.position, p2.position, level);

    postProcessManager.update(delta);
    postProcessManager.render();
    return;
  }

  // --- 2. EDITOR MODE ---
  if (mode === GameMode.EDITOR) {
    tetherRenderer.setVisible(false);
    editor.update(delta);
    postProcessManager.update(delta);
    postProcessManager.render();
    return;
  }

  // --- 3. PLAYING MODE ---
  // Modal updates with Gamepad support
  if (keypadUI.isKeypadOpen()) {
    keypadUI.update();
  }
  if (stickyNoteModal.isOpen()) {
    stickyNoteModal.update();
  }

  if (victoryOverlay.style.display === 'flex') {
    updateVictoryController();
  }

  // Start button toggles in-game pause menu
  if (inputManager.isAnyButtonJustPressed(XboxButton.START)) {
    togglePauseMenu();
  }

  if (isPauseMenuOpen) {
    updatePauseController();
    postProcessManager.render();
    return;
  }

  // Auto-hide gameplay HUD, Objectives tracker, and return-to-editor button during dialogue scenes and Vibe Puzzle minigame
  const hideHUDs = falloutDialogue.isActive || vibePuzzle.isActive;
  if (hud.style.opacity !== (hideHUDs ? '0' : '1')) {
    hud.style.opacity = hideHUDs ? '0' : '1';
    hud.style.pointerEvents = hideHUDs ? 'none' : 'auto';
  }
  if (objectiveCard.style.opacity !== (hideHUDs ? '0' : '1')) {
    objectiveCard.style.opacity = hideHUDs ? '0' : '1';
    objectiveCard.style.pointerEvents = hideHUDs ? 'none' : 'auto';
  }
  if (returnToEditorBtn && returnToEditorBtn.style.opacity !== (hideHUDs ? '0' : '1')) {
    returnToEditorBtn.style.opacity = hideHUDs ? '0' : '1';
    returnToEditorBtn.style.pointerEvents = hideHUDs ? 'none' : 'auto';
  }

  // Quick restart: hold Controller Back button (1.0s)
  if (inputManager.isAnyButtonDown(XboxButton.BACK)) {
    if (rKeyHoldStartTime === null && !isPauseMenuOpen && !isFinaleCinematic && !isLevelTransitioning) {
      startRHold();
    }
  } else if (rKeyHoldStartTime !== null && !isKeyboardRDown) {
    cancelRHold();
  }

  // Dynamic 3D Tether Visuals & Audio Warning
  if (!isFinaleCinematic) {
    campaignManager.addPlayTime(delta);
    tetherRenderer.setVisible(true);
    const tetherStatus = tetherRenderer.update(p1.position, p2.position, delta);
    if (tetherStatus.state === 'critical') {
      audioManager.playTetherCriticalHeartbeat();
      if (elapsedTime - lastTetherBarkTime > 6.0) {
        lastTetherBarkTime = elapsedTime;
        const p1DistFromOrigin = Math.hypot(p1.position.x, p1.position.z);
        const p2DistFromOrigin = Math.hypot(p2.position.x, p2.position.z);
        const trailingPlayer = p1DistFromOrigin < p2DistFromOrigin ? p1 : p2;
        // Character-specific lines per VOICE_SCRIPTS.md (tether_warn)
        const tetherLine =
          trailingPlayer.id === 'p2' ? 'Várj meg, mindjárt elszakadunk!' : 'Hová mész?! Ne rohanj előre!';
        trailingPlayer.say(tetherLine, 3.0, 'tether_warn');
      }
    } else if (tetherStatus.state === 'warning') {
      audioManager.playTetherWarning();
    }

    // High-paranoia player reaction bark (bystander scrutiny built up over time).
    if (postProcessManager.getIntensity() > 0.65 && elapsedTime - lastParanoiaBarkTime > 50.0) {
      lastParanoiaBarkTime = elapsedTime;
      const speaker = Math.random() < 0.5 ? p1 : p2;
      // Character-specific lines per VOICE_SCRIPTS.md (paranoia_high)
      const paranoiaLine =
        speaker.id === 'p2' ? 'Ne nézz a szemükbe, menjünk tovább!' : 'Minket néznek, látod?! Viselkedj normálisan...';
      speaker.say(paranoiaLine, 3.0, 'paranoia_high');
    }
  } else {
    tetherRenderer.setVisible(false);
  }

  // Update active 3D bonfire if present
  if (currentBonfire) {
    currentBonfire.update(delta);
  }

  // Check V + K + C Cheat Code Shortcut
  if (inputManager.isCheatComboPressed()) {
    if (!cheatTriggeredThisPress) {
      cheatTriggeredThisPress = true;
      activateCheatCode();
    }
  } else {
    cheatTriggeredThisPress = false;
  }

  // Check Level 2 Grocery Store Clerk Fallout Cinematic Dialogue Trigger
  if (
    currentLevelIndex === 1 &&
    !cashierEncounterTriggered &&
    !falloutDialogue.isActive &&
    !isLevelTransitioning &&
    !isFinaleCinematic
  ) {
    const cashierPos = new THREE.Vector3(34 * GRID_CELL_SIZE, 0, 22 * GRID_CELL_SIZE);
    const dP1 = p1.position.distanceTo(cashierPos);
    const dP2 = p2.position.distanceTo(cashierPos);

    if (dP1 < 4.2 || dP2 < 4.2) {
      cashierEncounterTriggered = true;
      p1.velocity.set(0, 0, 0);
      p2.velocity.set(0, 0, 0);

      // Fade player meshes so line of sight to NPC is completely clear
      p1.setDialogueFade(true);
      p2.setDialogueFade(true);

      const cashierEnemy = level.getEnemies().find((e) => e.type === EnemyType.CASHIER);
      const cashierFacing = cashierEnemy ? cashierEnemy.facingAngle : Math.PI;
      const targetCashierPos = cashierEnemy ? cashierEnemy.mesh.position : cashierPos;

      // Camera zooms directly in front of Cashier face looking slightly down with 28° FOV
      cameraRig.startDialogueBust(targetCashierPos, cashierFacing);
      audioManager.playHostileThreat();

      falloutDialogue.startEncounter({
        speakerName: 'Bask bolti eladó',
        speakerPrompt: 'Hová-hová ilyen tág pupillákkal, fiatalok? Fizettetek a pultnál?',
        choices: [
          {
            key: '1',
            text: '[Karizma 45%] <Hazugság> Csak a barátnőmnek keresek rágót, mindjárt fizetünk.',
            response: 'Hát jó... De ne bámuljatok úgy a hűtőre, megfagy a tej! Menjetek, intézzétek a dolgotokat.',
            onSelect: () => {
              if (cashierEnemy) cashierEnemy.isPacified = true;
              audioManager.playPickup();
              showToast('✅ Karizma siker: Az eladó megnyugodott és elenged békésen.');
            },
          },
          {
            key: '2',
            text: '[Paranoia] *Rémülten nézel rá és megpróbálod eltakarni a szemed.*',
            response: 'Hé! Mi a bajod velem?! Látom én a szemeteken... Hívom a biztonságiakat!',
            onSelect: () => {
              postProcessManager.addIntensity(0.25);
              cameraRig.addShake(0.5);
              audioManager.playHostileThreat();
              audioManager.playCashierAlert();
              showToast('⚠️ Paranoia +25%! Az eladó agresszívvé vált és riasztott!');
            },
          },
          {
            key: '3',
            text: '[Spangli átadása] Adsz neki egy füstöt békepipának.',
            response: 'Na várj csak... Ez igazi baszk hegyi fű? Na jól van kölykök, hátul kinyitom nektek a vészkijáratot, mehettek!',
            onSelect: () => {
              if (cashierEnemy) cashierEnemy.isPacified = true;
              audioManager.playPickup();
              audioManager.playDoorOpen();
              showToast('✨ Békekötés: A hátsó kijárat kinyílt, szabad az út a metró felé!');
            },
          },
        ],
        onComplete: () => {
          cameraRig.endDialogueBust();
          p1.setDialogueFade(false);
          p2.setDialogueFade(false);
        },
      });
    }
  }

  if (dialogueOverlay.isOpen()) {
    dialogueOverlay.checkGamepadInput();
  }

  // When Fallout Dialogue is active, pause world input and updates
  if (falloutDialogue.isActive) {
    falloutDialogue.update();
    p1.velocity.set(0, 0, 0);
    p2.velocity.set(0, 0, 0);
    p1.update(delta, { x: 0, y: 0 }, cameraRig, level);
    p2.update(delta, { x: 0, y: 0 }, cameraRig, level);
    p1.updateScreenPosition(camera);
    p2.updateScreenPosition(camera);

    postProcessManager.update(delta);
    postProcessManager.render();
    return;
  }

  const prevP1 = p1.position.clone();
  const prevP2 = p2.position.clone();

  if (!isFinaleCinematic) {
    p1.update(delta, inputManager.getP1Vector(), cameraRig, level, inputManager.getP1Jump());
    p2.update(delta, inputManager.getP2Vector(), cameraRig, level, inputManager.getP2Jump());

    p1.resolveCollisions(level, prevP1, 0.32, delta);
    p2.resolveCollisions(level, prevP2, 0.32, delta);

    // Maximum allowable tether distance between P1 and P2: 16.0m
    Player.enforceTether(p1, p2, 16.0);
  } else {
    p1.update(delta, { x: 0, y: 0 }, cameraRig, level);
    p2.update(delta, { x: 0, y: 0 }, cameraRig, level);
  }

  triggerSystem.update(delta, p1.position, p2.position, level, p1, p2);
  vibePuzzle.update(delta);

  // Update enemy AI behaviors and attack hazards
  const enemies = level.getEnemies();
  for (const enemy of enemies) {
    enemy.update(delta, p1, p2, audioManager, postProcessManager, cameraRig);
  }

  // Update moving hazard cars
  const cars = level.getCars();
  for (const car of cars) {
    car.update(delta, p1, p2, audioManager, cameraRig);
  }

  cameraRig.update(delta, p1.position, p2.position);
  cameraRig.updateOcclusion(scene, p1.position, p2.position, delta, p1, p2);

  // Update screen-space DOM speech bubble projections
  p1.updateScreenPosition(camera);
  p2.updateScreenPosition(camera);
  for (const enemy of enemies) {
    enemy.updateScreenPosition(camera);
  }

  // Update progressive post-processing & render
  postProcessManager.update(delta);
  postProcessManager.render();
}

animate();

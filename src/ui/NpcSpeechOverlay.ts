import * as THREE from 'three';

export interface NpcSpeechBubble {
  el: HTMLDivElement;
  contentEl: HTMLDivElement;
  visible: boolean;
}

export function getOrCreateSpeechOverlayContainer(): HTMLDivElement {
  if (typeof document === 'undefined') return null as any;
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
  return container;
}

export function createNpcSpeechBubble(): NpcSpeechBubble {
  const container = getOrCreateSpeechOverlayContainer();
  const bubble = document.createElement('div');
  bubble.className = 'npc-speech-bubble';
  bubble.style.cssText = `
    position: fixed;
    transform: translate(-50%, -100%);
    background: rgba(10, 15, 25, 0.95);
    border: 2.5px solid #38bdf8;
    border-radius: 10px;
    padding: 8px 16px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.7), 0 0 14px rgba(56, 189, 248, 0.35);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 19px;
    font-weight: 800;
    color: #ffffff;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.18s ease;
    display: none;
    z-index: 9999;
    line-height: 1.35;
    text-align: center;
  `;

  const contentEl = document.createElement('div');
  bubble.appendChild(contentEl);

  // Downward triangle caret pointer pointing towards NPC head
  const caretBorder = document.createElement('div');
  caretBorder.style.cssText = `
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    border-top: 10px solid #38bdf8;
  `;
  const caretInner = document.createElement('div');
  caretInner.style.cssText = `
    position: absolute;
    bottom: -7px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 8px solid rgba(10, 15, 25, 0.95);
  `;
  bubble.appendChild(caretBorder);
  bubble.appendChild(caretInner);

  if (container) {
    container.appendChild(bubble);
  }

  return { el: bubble, contentEl, visible: false };
}

export function showNpcSpeech(bubble: NpcSpeechBubble, text: string, title?: string): void {
  if (!bubble || !bubble.el || !bubble.contentEl) return;
  if (!text || text.trim() === '') {
    hideNpcSpeech(bubble);
    return;
  }

  if (title) {
    bubble.contentEl.innerHTML = `
      <div style="font-size: 14px; color: #38bdf8; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 3px;">${title}</div>
      <div style="font-size: 19px; font-weight: 800; color: #ffffff;">${text}</div>
    `;
  } else {
    bubble.contentEl.innerHTML = `<div style="font-size: 19px; font-weight: 800; color: #ffffff;">${text}</div>`;
  }

  bubble.el.style.display = 'block';
  bubble.el.style.opacity = '1';
  bubble.visible = true;
}

export function hideNpcSpeech(bubble: NpcSpeechBubble): void {
  if (!bubble || !bubble.el) return;
  bubble.visible = false;
  bubble.el.style.opacity = '0';
  setTimeout(() => {
    if (!bubble.visible && bubble.el) {
      bubble.el.style.display = 'none';
    }
  }, 180);
}

export function updateNpcSpeechPosition(
  bubble: NpcSpeechBubble,
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  headOffset = 2.15
): void {
  if (!bubble || !bubble.el || !bubble.visible || !camera) return;

  const headPos = worldPos.clone();
  headPos.y += headOffset;
  headPos.project(camera);

  // If behind camera or outside clip space, hide bubble
  if (headPos.z > 1.0 || headPos.z < -1.0) {
    bubble.el.style.display = 'none';
    return;
  }

  const screenX = (headPos.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-(headPos.y * 0.5) + 0.5) * window.innerHeight;

  // Distance Capping & Clamping:
  // Scale text slightly based on distance, but clamp to minimum 15px bold
  const dist = camera.position.distanceTo(worldPos);
  const distanceScale = THREE.MathUtils.clamp(14.0 / Math.max(7.0, dist), 0.9, 1.3);
  const fontSize = Math.max(15, Math.round(16 * distanceScale));

  bubble.el.style.fontSize = `${fontSize}px`;
  bubble.el.style.display = 'block';
  bubble.el.style.left = `${screenX}px`;
  bubble.el.style.top = `${screenY - 14}px`;
}

export function destroyNpcSpeechBubble(bubble: NpcSpeechBubble): void {
  if (bubble && bubble.el && bubble.el.parentElement) {
    bubble.el.parentElement.removeChild(bubble.el);
  }
}

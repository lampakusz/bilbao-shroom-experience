/**
 * StickyNoteModal.ts
 * High-res popup modal displaying the handwritten yellow post-it note asset,
 * clearly readable with drop shadow and tactile close interaction.
 */

import { audioManager } from '../audio/AudioManager.ts';
import { inputManager, XboxButton } from '../engine/InputManager.ts';
import { getStickyNoteCanvas } from '../world/BlockFactory.ts';

export class StickyNoteModal {
  private static instance: StickyNoteModal | null = null;
  private container!: HTMLDivElement;
  private noteImg!: HTMLImageElement;
  private isModalOpen = false;
  private onCloseCallback?: () => void;

  private constructor() {
    if (typeof document === 'undefined') return;
    this.buildDOM();
  }

  public static getInstance(): StickyNoteModal {
    if (!StickyNoteModal.instance) {
      StickyNoteModal.instance = new StickyNoteModal();
    }
    return StickyNoteModal.instance;
  }

  private buildDOM(): void {
    this.container = document.createElement('div');
    this.container.id = 'sticky-note-modal';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.78) 0%, rgba(2, 6, 23, 0.94) 100%);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 340;
      user-select: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      cursor: pointer;
    `;

    // Note wrapper container with subtle rotation
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      transform: rotate(-1.5deg);
      cursor: default;
      transition: transform 0.2s ease;
    `;

    // Sticky Note Paper Card
    const noteCard = document.createElement('div');
    noteCard.style.cssText = `
      position: relative;
      width: 380px;
      height: 380px;
      max-width: 86vw;
      max-height: 86vw;
      border-radius: 4px 4px 18px 4px;
      overflow: hidden;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.85),
        0 0 40px rgba(254, 240, 138, 0.2),
        inset 0 -4px 8px rgba(0, 0, 0, 0.05);
      background: #fef08a;
      border: 1px solid rgba(0, 0, 0, 0.08);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;

    this.noteImg = document.createElement('img');
    this.noteImg.alt = 'Sárga jegyzet cetli';
    this.noteImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    `;
    noteCard.appendChild(this.noteImg);

    // Close button on top-right of note
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Bezárás (Esc)';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.14);
      border: none;
      color: #713f12;
      font-size: 17px;
      font-weight: 900;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, transform 0.15s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(239, 68, 68, 0.35)';
      closeBtn.style.transform = 'scale(1.1)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(0, 0, 0, 0.14)';
      closeBtn.style.transform = 'none';
    };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.close();
    };
    noteCard.appendChild(closeBtn);

    // Hint Banner below note
    const hintBanner = document.createElement('div');
    hintBanner.style.cssText = `
      background: rgba(15, 23, 42, 0.88);
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 8px 20px;
      color: #cbd5e1;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    `;
    hintBanner.innerHTML = `
      <span>⌨️ [Esc / Space / Enter] Bezárás</span>
      <span style="color: #64748b;">•</span>
      <span>🎮 [A / B] Bezárás</span>
    `;

    wrapper.appendChild(noteCard);
    wrapper.appendChild(hintBanner);
    this.container.appendChild(wrapper);

    // Clicking backdrop closes modal
    this.container.onclick = () => this.close();
    wrapper.onclick = (e) => e.stopPropagation();

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.isModalOpen) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.close();
        }
      }
    });

    document.body.appendChild(this.container);
  }

  public open(onClose?: () => void): void {
    if (typeof document === 'undefined' || !this.container || this.isModalOpen) return;

    this.isModalOpen = true;
    this.onCloseCallback = onClose;

    // Refresh canvas image data
    try {
      const canvas = getStickyNoteCanvas();
      this.noteImg.src = canvas.toDataURL('image/png');
    } catch {
      // fallback
    }

    audioManager.playSwitchClick();
    inputManager.lockControls(true);
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }

  public close(): void {
    if (!this.isModalOpen) return;
    this.isModalOpen = false;
    audioManager.playSwitchClick();
    inputManager.lockControls(false);

    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 200);

    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = undefined;
    }
  }

  public isOpen(): boolean {
    return this.isModalOpen;
  }

  public update(): void {
    if (!this.isModalOpen) return;

    if (
      inputManager.isAnyButtonJustPressed(XboxButton.A) ||
      inputManager.isAnyButtonJustPressed(XboxButton.B) ||
      inputManager.isAnyButtonJustPressed(XboxButton.START) ||
      inputManager.isAnyButtonJustPressed(XboxButton.BACK)
    ) {
      this.close();
    }
  }
}

export const stickyNoteModal = StickyNoteModal.getInstance();

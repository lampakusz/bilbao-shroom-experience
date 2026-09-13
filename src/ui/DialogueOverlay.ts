import { audioManager } from '../audio/AudioManager.ts';
import { inputManager, XboxButton } from '../engine/InputManager.ts';

export interface DialogueItem {
  speaker: string;
  text: string;
  durationSec?: number;
  voiceKey?: string;
  onComplete?: () => void;
}

export class DialogueOverlay {
  private container: HTMLDivElement;
  private speakerEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private actionHintEl: HTMLDivElement;
  private queue: DialogueItem[] = [];
  private isShowing = false;
  private currentItem: DialogueItem | null = null;
  private openedTimestamp = 0;
  private fadeTimer: number | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private globalClickListener: ((e: MouseEvent) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'cinematic-dialogue-overlay';
    this.container.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%) translateY(16px);
      max-width: 880px;
      width: calc(100% - 48px);
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 2.5px solid rgba(251, 191, 36, 0.7);
      border-radius: 16px;
      padding: 18px 28px;
      color: #ffffff;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 12px 36px -5px rgba(0, 0, 0, 0.8), 0 0 25px rgba(251, 191, 36, 0.35);
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      user-select: none;
      cursor: pointer;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    this.container.addEventListener('mouseenter', () => {
      if (this.isShowing) {
        this.container.style.borderColor = '#fbbf24';
        this.container.style.boxShadow = '0 12px 36px -5px rgba(0, 0, 0, 0.9), 0 0 32px rgba(251, 191, 36, 0.55)';
      }
    });

    this.container.addEventListener('mouseleave', () => {
      if (this.isShowing) {
        this.container.style.borderColor = 'rgba(251, 191, 36, 0.7)';
        this.container.style.boxShadow = '0 12px 36px -5px rgba(0, 0, 0, 0.8), 0 0 25px rgba(251, 191, 36, 0.35)';
      }
    });

    // Header with Speaker
    this.speakerEl = document.createElement('div');
    this.speakerEl.style.cssText = `
      font-size: 16px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #fbbf24;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Main Subtitle Text
    this.textEl = document.createElement('div');
    this.textEl.style.cssText = `
      font-size: 22px;
      line-height: 1.45;
      color: #ffffff;
      font-weight: 800;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
    `;

    // Bottom Action Prompt Button / Hint
    this.actionHintEl = document.createElement('div');
    this.actionHintEl.style.cssText = `
      align-self: flex-end;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.16);
      border: 1.5px solid rgba(245, 158, 11, 0.5);
      border-radius: 9999px;
      padding: 5px 14px;
      letter-spacing: 0.04em;
      transition: background 0.15s, border-color 0.15s;
    `;
    this.actionHintEl.innerHTML = `
      <span style="font-size: 15px;">🖱️</span>
      <span>Kattints a továbbhaladáshoz</span>
      <span style="color: #cbd5e1; font-weight: 700; font-size: 12px;">• [Space / Enter / (A)] ▸</span>
    `;

    this.container.appendChild(this.speakerEl);
    this.container.appendChild(this.textEl);
    this.container.appendChild(this.actionHintEl);
    document.body.appendChild(this.container);

    // Clicking container advances
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.advance();
    });

    // Global click listener to allow clicking anywhere on screen to proceed
    this.globalClickListener = () => {
      if (this.isShowing) {
        this.advance();
      }
    };
    document.addEventListener('click', this.globalClickListener);

    // Global keyboard listener (Space, Enter, Escape, E)
    this.keyListener = (e: KeyboardEvent) => {
      if (!this.isShowing) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      }
    };
    window.addEventListener('keydown', this.keyListener, true);
  }

  public isOpen(): boolean {
    return this.isShowing;
  }

  /**
   * Check controller input during game loop
   */
  public checkGamepadInput(): void {
    if (!this.isShowing) return;
    if (
      inputManager.isAnyButtonJustPressed(XboxButton.A) ||
      inputManager.isAnyButtonJustPressed(XboxButton.B) ||
      inputManager.isAnyButtonJustPressed(XboxButton.START)
    ) {
      this.advance();
    }
  }

  /**
   * Display a dialogue line. Dialogue remains visible until player clicks or presses a continue key.
   */
  public showDialogue(
    speaker: string,
    text: string,
    durationSec = 0,
    voiceKey?: string,
    onComplete?: () => void
  ): void {
    const item: DialogueItem = { speaker, text, durationSec, voiceKey, onComplete };

    if (this.isShowing) {
      this.queue.push(item);
      return;
    }

    this.displayItem(item);
  }

  private displayItem(item: DialogueItem): void {
    this.isShowing = true;
    this.currentItem = item;
    this.openedTimestamp = performance.now();

    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    this.speakerEl.innerHTML = `<span>🎙️</span> <span>${item.speaker}</span>`;
    this.textEl.textContent = item.text;

    // Trigger voice audio if provided
    if (item.voiceKey) {
      audioManager.playVoice(item.voiceKey);
    }

    // Make clickable and animate in
    this.container.style.pointerEvents = 'auto';
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateX(-50%) translateY(0)';
  }

  /**
   * Advance to the next queued dialogue or dismiss active dialogue.
   */
  public advance(): void {
    if (!this.isShowing) return;
    // 250ms debouncing to prevent accidental instant skip upon popup
    if (performance.now() - this.openedTimestamp < 250) return;

    const completedItem = this.currentItem;

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        if (completedItem?.onComplete) {
          try {
            completedItem.onComplete();
          } catch (e) {
            console.error('Error in dialogue onComplete callback:', e);
          }
        }
        this.displayItem(next);
        return;
      }
    }

    this.hideDialogue(completedItem);
  }

  /**
   * Smoothly hide the active dialogue and invoke completion callback.
   */
  public hideDialogue(completedItem?: DialogueItem | null): void {
    const itemToComplete = completedItem ?? this.currentItem;
    this.isShowing = false;
    this.currentItem = null;

    this.container.style.pointerEvents = 'none';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(-50%) translateY(16px)';

    if (itemToComplete?.onComplete) {
      try {
        itemToComplete.onComplete();
      } catch (e) {
        console.error('Error in dialogue onComplete callback:', e);
      }
    }

    this.fadeTimer = window.setTimeout(() => {
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) {
          this.displayItem(next);
        }
      }
    }, 320);
  }

  /**
   * Clear all pending queued dialogues and immediately dismiss active dialogue.
   */
  public clearQueue(): void {
    this.queue = [];
    this.hideDialogue();
  }

  public destroy(): void {
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener, true);
      this.keyListener = null;
    }
    if (this.globalClickListener) {
      document.removeEventListener('click', this.globalClickListener);
      this.globalClickListener = null;
    }
    this.queue = [];
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

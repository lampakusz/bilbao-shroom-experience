/**
 * KeypadUI.ts
 * Stylized CRT retro numeric keypad overlay modal for puzzle terminals.
 */

import { audioManager } from '../audio/AudioManager.ts';
import { inputManager, InputManager, XboxButton } from '../engine/InputManager.ts';
import { gameState } from '../engine/GameState.ts';

export interface KeypadOptions {
  code?: string;
  validCodes?: string[];
  title?: string;
  hint?: string;
  onSuccess?: () => void;
  onFail?: () => void;
  onClose?: () => void;
}

export class KeypadUI {
  private static instance: KeypadUI | null = null;
  private container: HTMLDivElement;
  private displayElement!: HTMLDivElement;
  private statusLed!: HTMLDivElement;
  private statusText!: HTMLSpanElement;
  private subHeader!: HTMLDivElement;

  private isOpen = false;
  private isProcessing = false;
  private currentInput = '';
  private targetCode = '420';
  private validCodes: string[] = ['420'];

  private onSuccessCallback?: () => void;
  private onFailCallback?: () => void;
  private onCloseCallback?: () => void;

  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private gridButtons: HTMLButtonElement[] = [];
  private focusedGridIndex = 0;

  private constructor() {
    if (typeof document === 'undefined') {
      this.container = null as any;
      this.boundKeyDownHandler = () => {};
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'retro-keypad-modal';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.78) 0%, rgba(2, 6, 23, 0.94) 100%);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 350;
      user-select: none;
      font-family: 'Courier New', Courier, monospace;
      opacity: 0;
      transition: opacity 0.25s ease;
    `;

    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.buildDOM();
    document.body.appendChild(this.container);
  }

  public static getInstance(): KeypadUI {
    if (!KeypadUI.instance) {
      KeypadUI.instance = new KeypadUI();
    }
    return KeypadUI.instance;
  }

  private buildDOM(): void {
    // Outer Terminal Chassis
    const chassis = document.createElement('div');
    chassis.style.cssText = `
      width: 440px;
      background: #0f172a;
      border: 3.5px solid #334155;
      border-radius: 18px;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.8),
        0 0 30px rgba(34, 197, 94, 0.2),
        inset 0 1px 1px rgba(255, 255, 255, 0.1);
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
    `;

    // 1. Header Bar with LED and Title
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid #1e293b;
      padding-bottom: 10px;
    `;

    const titleGroup = document.createElement('div');
    titleGroup.style.cssText = `display: flex; align-items: center; gap: 10px;`;

    this.statusLed = document.createElement('div');
    this.statusLed.style.cssText = `
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 10px #ef4444;
      transition: background 0.3s, box-shadow 0.3s;
    `;
    titleGroup.appendChild(this.statusLed);

    this.statusText = document.createElement('span');
    this.statusText.textContent = 'ACCESS TERMINAL // LOCKED';
    this.statusText.style.cssText = `
      font-size: 14px;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    `;
    titleGroup.appendChild(this.statusText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Bezárás (Esc)';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = '#f87171';
      closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = '#64748b';
      closeBtn.style.background = 'transparent';
    };
    closeBtn.onclick = () => this.close();

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);
    chassis.appendChild(header);

    // 2. CRT Screen Display
    const screenFrame = document.createElement('div');
    screenFrame.style.cssText = `
      background: #022c22;
      border: 2px solid #065f46;
      border-radius: 8px;
      padding: 14px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.85);
    `;

    // CRT scanline gradient overlay
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.22) 0px,
        rgba(0, 0, 0, 0.22) 1px,
        transparent 1px,
        transparent 3px
      );
      opacity: 0.85;
    `;
    screenFrame.appendChild(scanlines);

    this.subHeader = document.createElement('div');
    this.subHeader.textContent = 'ENTER PIN (3 DIGITS):';
    this.subHeader.style.cssText = `
      font-size: 10px;
      color: #34d399;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
      opacity: 0.8;
      text-transform: uppercase;
    `;
    screenFrame.appendChild(this.subHeader);

    this.displayElement = document.createElement('div');
    this.displayElement.style.cssText = `
      font-size: 34px;
      font-weight: 900;
      color: #4ade80;
      text-shadow: 0 0 12px rgba(74, 222, 128, 0.9), 0 0 24px rgba(34, 197, 94, 0.5);
      letter-spacing: 8px;
      text-align: center;
      padding: 10px 0;
      transition: color 0.15s, text-shadow 0.15s;
    `;
    this.renderDisplay();
    screenFrame.appendChild(this.displayElement);
    chassis.appendChild(screenFrame);

    // 3. Tactile Push Button Grid (3 x 4)
    const buttonGrid = document.createElement('div');
    buttonGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    `;

    const keys: Array<{ label: string; action: () => void; isSpecial?: 'clear' | 'enter' }> = [
      { label: '1', action: () => this.appendDigit('1') },
      { label: '2', action: () => this.appendDigit('2') },
      { label: '3', action: () => this.appendDigit('3') },
      { label: '4', action: () => this.appendDigit('4') },
      { label: '5', action: () => this.appendDigit('5') },
      { label: '6', action: () => this.appendDigit('6') },
      { label: '7', action: () => this.appendDigit('7') },
      { label: '8', action: () => this.appendDigit('8') },
      { label: '9', action: () => this.appendDigit('9') },
      { label: 'CLR', action: () => this.clearInput(), isSpecial: 'clear' },
      { label: '0', action: () => this.appendDigit('0') },
      { label: 'ENTER ↵', action: () => this.submitCode(), isSpecial: 'enter' },
    ];

    keys.forEach((k) => {
      const btn = document.createElement('button');
      btn.textContent = k.label;

      let bg = '#1e293b';
      let border = '#334155';
      let color = '#f8fafc';
      let shadowColor = '#0b1329';

      if (k.isSpecial === 'clear') {
        bg = '#78350f';
        border = '#d97706';
        color = '#fde68a';
        shadowColor = '#451a03';
      } else if (k.isSpecial === 'enter') {
        bg = '#064e3b';
        border = '#059669';
        color = '#a7f3d0';
        shadowColor = '#022c22';
      }

      btn.style.cssText = `
        background: ${bg};
        border: 2px solid ${border};
        border-radius: 10px;
        color: ${color};
        font-family: inherit;
        font-size: ${k.isSpecial ? '16px' : '22px'};
        font-weight: 800;
        padding: 16px 6px;
        cursor: pointer;
        box-shadow: 0 5px 0 ${shadowColor};
        transition: transform 0.08s, box-shadow 0.08s, filter 0.08s;
      `;

      btn.onmousedown = () => {
        btn.style.transform = 'translateY(3px)';
        btn.style.boxShadow = `0 1px 0 ${shadowColor}`;
        btn.style.filter = 'brightness(1.2)';
      };
      btn.onmouseup = () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = `0 4px 0 ${shadowColor}`;
        btn.style.filter = 'none';
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = `0 4px 0 ${shadowColor}`;
        btn.style.filter = 'none';
      };

      btn.dataset.shadow = shadowColor;
      btn.onclick = () => {
        if (!this.isProcessing) {
          k.action();
        }
      };

      buttonGrid.appendChild(btn);
      this.gridButtons.push(btn);
    });

    chassis.appendChild(buttonGrid);

    // 4. Subtle Footer Instructions
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
      border-top: 1px solid #1e293b;
      padding-top: 8px;
    `;
    footer.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <span>🎮 [D-Pad] Mozgás • [A] Bevitel • [X] CLR • [Y] ENTER</span>
        <span>[B] Kilépés</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 10px;">
        <span>⌨️ [0-9] Számok • [Enter] Bevitel</span>
        <span>[ESC] Bezárás</span>
      </div>
    `;
    chassis.appendChild(footer);

    this.container.appendChild(chassis);

    // Clicking outside chassis closes modal
    this.container.onclick = (e) => {
      if (e.target === this.container && !this.isProcessing) {
        this.close();
      }
    };
  }

  private getMaxCodeLength(): number {
    const lengths = [this.targetCode.length, ...this.validCodes.map((c) => c.length)];
    return Math.max(1, ...lengths);
  }

  private renderDisplay(): void {
    const maxLen = this.getMaxCodeLength();
    const chars = this.currentInput.split('');
    const slots: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      slots.push(chars[i] ?? '_');
    }
    this.displayElement.textContent = `[ ${slots.join(' ')} ]`;
  }

  public appendDigit(digit: string): void {
    const maxLen = this.getMaxCodeLength();
    if (this.isProcessing || this.currentInput.length >= maxLen) return;
    this.currentInput += digit;
    audioManager.playKeypadBeep(900 + this.currentInput.length * 150);
    this.renderDisplay();

    // Check if input directly matches targetCode or any valid code
    const isDirectMatch =
      this.currentInput === this.targetCode || this.validCodes.includes(this.currentInput);
    if (isDirectMatch) {
      setTimeout(() => {
        if (this.isOpen && !this.isProcessing) {
          this.submitCode();
        }
      }, 180);
      return;
    }

    // If maxLen digits entered, automatically validate
    if (this.currentInput.length >= maxLen) {
      setTimeout(() => {
        if (this.isOpen && !this.isProcessing) {
          this.submitCode();
        }
      }, 180);
    }
  }

  public clearInput(): void {
    if (this.isProcessing) return;
    this.currentInput = '';
    audioManager.playKeypadBeep(650);
    this.renderDisplay();
  }

  public submitCode(): void {
    if (this.isProcessing || !this.isOpen) return;

    if (this.currentInput.length === 0) {
      audioManager.playKeypadBeep(500);
      return;
    }

    this.isProcessing = true;

    const isMatch =
      this.currentInput === this.targetCode || this.validCodes.includes(this.currentInput);

    if (isMatch) {
      // SUCCESS!
      gameState.setFlag('service_door_unlocked', true);
      this.displayElement.textContent = '[ ACCESSED / NYITVA ]';
      this.displayElement.style.color = '#34d399';
      this.displayElement.style.textShadow = '0 0 12px #34d399, 0 0 24px #059669';

      this.statusLed.style.background = '#22c55e';
      this.statusLed.style.boxShadow = '0 0 12px #22c55e';
      this.statusText.textContent = 'ACCESS GRANTED // NYITVA';
      this.statusText.style.color = '#34d399';

      audioManager.playKeypadSuccess();

      if (this.onSuccessCallback) {
        this.onSuccessCallback();
      }

      // Automatically close modal after 0.8s to allow cinematic fly-to
      setTimeout(() => {
        this.close();
      }, 800);
    } else {
      // FAILURE!
      this.displayElement.textContent = '[ ERR / HIBÁS ]';
      this.displayElement.style.color = '#f87171';
      this.displayElement.style.textShadow = '0 0 12px #ef4444, 0 0 24px #b91c1c';

      this.statusLed.style.background = '#ef4444';
      this.statusLed.style.boxShadow = '0 0 14px #ef4444';
      this.statusText.textContent = 'ACCESS DENIED // HIBA';
      this.statusText.style.color = '#f87171';

      audioManager.playHostileThreat();

      if (this.onFailCallback) {
        this.onFailCallback();
      }

      // Reset after 0.7s penalty flash
      setTimeout(() => {
        if (this.isOpen) {
          this.currentInput = '';
          this.isProcessing = false;
          this.displayElement.style.color = '#4ade80';
          this.displayElement.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.8), 0 0 20px rgba(34, 197, 94, 0.4)';
          this.statusText.textContent = 'ACCESS TERMINAL // LOCKED';
          this.statusText.style.color = '#94a3b8';
          this.renderDisplay();
        }
      }, 700);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    if (this.isProcessing) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      e.stopPropagation();
      this.appendDigit(e.key);
    } else if (e.code.startsWith('Numpad') && e.code.length === 7) {
      const digit = e.code.replace('Numpad', '');
      if (digit >= '0' && digit <= '9') {
        e.preventDefault();
        e.stopPropagation();
        this.appendDigit(digit);
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      if (this.currentInput.length > 0) {
        this.currentInput = this.currentInput.slice(0, -1);
        audioManager.playKeypadBeep(700);
        this.renderDisplay();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      e.stopPropagation();
      this.clearInput();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.submitCode();
    }
  }

  public open(options: KeypadOptions = {}): void {
    if (typeof document === 'undefined' || !this.container || this.isOpen) return;

    this.isOpen = true;
    this.isProcessing = false;
    this.currentInput = '';
    this.targetCode = options.code ?? '420';
    this.validCodes = options.validCodes ? [...options.validCodes] : [this.targetCode];
    if (!this.validCodes.includes(this.targetCode)) {
      this.validCodes.push(this.targetCode);
    }
    const stateCode = gameState.getFlag<string>('service_gate_code');
    if (stateCode && !this.validCodes.includes(stateCode)) {
      this.validCodes.push(stateCode);
    }
    if (this.subHeader) {
      this.subHeader.textContent = `ENTER PIN (${this.getMaxCodeLength()} DIGITS):`;
    }
    this.onSuccessCallback = options.onSuccess;
    this.onFailCallback = options.onFail;
    this.onCloseCallback = options.onClose;

    // Reset visuals
    this.statusLed.style.background = '#ef4444';
    this.statusLed.style.boxShadow = '0 0 8px #ef4444';
    this.statusText.textContent = options.title ?? 'ACCESS TERMINAL // LOCKED';
    this.statusText.style.color = '#94a3b8';
    this.displayElement.style.color = '#4ade80';
    this.displayElement.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.8), 0 0 20px rgba(34, 197, 94, 0.4)';
    this.renderDisplay();

    this.focusedGridIndex = 0;
    this.updateGridFocusVisuals();

    // Lock player movement to prevent moving while typing
    InputManager.getInstance().lockControls(true);

    this.container.style.display = 'flex';
    // Trigger transition
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });

    window.addEventListener('keydown', this.boundKeyDownHandler, true);
  }

  private updateGridFocusVisuals(): void {
    this.gridButtons.forEach((btn, idx) => {
      const shadowColor = btn.dataset.shadow || '#0b1329';
      if (idx === this.focusedGridIndex) {
        btn.style.outline = '3px solid #38bdf8';
        btn.style.boxShadow = `0 0 16px rgba(56, 189, 248, 0.85), 0 5px 0 ${shadowColor}`;
        btn.style.filter = 'brightness(1.25)';
        btn.style.transform = 'translateY(-2px) scale(1.04)';
        btn.style.zIndex = '2';
      } else {
        btn.style.outline = 'none';
        btn.style.boxShadow = `0 5px 0 ${shadowColor}`;
        btn.style.filter = 'none';
        btn.style.transform = 'none';
        btn.style.zIndex = '1';
      }
    });
  }

  public update(): void {
    if (!this.isOpen || this.isProcessing) return;

    // D-Pad Navigation on 3x4 Grid:
    if (inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP)) {
      this.focusedGridIndex = (this.focusedGridIndex - 3 + 12) % 12;
      audioManager.playKeypadBeep(750);
      this.updateGridFocusVisuals();
    } else if (inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN)) {
      this.focusedGridIndex = (this.focusedGridIndex + 3) % 12;
      audioManager.playKeypadBeep(750);
      this.updateGridFocusVisuals();
    } else if (inputManager.isAnyButtonJustPressed(XboxButton.DPAD_LEFT)) {
      const row = Math.floor(this.focusedGridIndex / 3);
      const col = (this.focusedGridIndex % 3 - 1 + 3) % 3;
      this.focusedGridIndex = row * 3 + col;
      audioManager.playKeypadBeep(750);
      this.updateGridFocusVisuals();
    } else if (inputManager.isAnyButtonJustPressed(XboxButton.DPAD_RIGHT)) {
      const row = Math.floor(this.focusedGridIndex / 3);
      const col = (this.focusedGridIndex % 3 + 1) % 3;
      this.focusedGridIndex = row * 3 + col;
      audioManager.playKeypadBeep(750);
      this.updateGridFocusVisuals();
    }

    // Press focused button with Button A
    if (inputManager.isAnyButtonJustPressed(XboxButton.A)) {
      const btn = this.gridButtons[this.focusedGridIndex];
      if (btn) {
        btn.click();
      }
      return;
    }

    // Quick shortcuts
    if (inputManager.isAnyButtonJustPressed(XboxButton.X)) {
      this.clearInput();
    } else if (
      inputManager.isAnyButtonJustPressed(XboxButton.Y) ||
      inputManager.isAnyButtonJustPressed(XboxButton.START)
    ) {
      this.submitCode();
    } else if (
      inputManager.isAnyButtonJustPressed(XboxButton.B) ||
      inputManager.isAnyButtonJustPressed(XboxButton.BACK)
    ) {
      this.close();
    }
  }

  public close(): void {
    if (typeof document === 'undefined' || !this.container || !this.isOpen) return;

    this.isOpen = false;
    this.isProcessing = false;
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);

    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.style.display = 'none';
      // Restore player movement controls
      InputManager.getInstance().lockControls(false);
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }, 200);
  }

  public isKeypadOpen(): boolean {
    return this.isOpen;
  }
}

export const keypadUI = KeypadUI.getInstance();

import { inputManager, XboxButton } from '../engine/InputManager.ts';

export interface DialogueChoice {
  key: string;
  text: string;
  response: string;
  onSelect: () => void;
}

export interface DialogueEncounterConfig {
  speakerName: string;
  speakerPrompt: string;
  choices: DialogueChoice[];
  onComplete?: () => void;
}

export class FalloutDialogue {
  private static instance: FalloutDialogue | null = null;
  private container: HTMLDivElement | null = null;
  private speakerBox: HTMLDivElement | null = null;
  private promptBox: HTMLDivElement | null = null;
  private choicesContainer: HTMLDivElement | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  public isActive = false;
  private currentConfig: DialogueEncounterConfig | null = null;
  private isResponding = false;
  private responseTimestamp = 0;
  private focusedChoiceIndex = 0;
  private choiceButtons: HTMLButtonElement[] = [];

  public static getInstance(): FalloutDialogue {
    if (!FalloutDialogue.instance) {
      FalloutDialogue.instance = new FalloutDialogue();
    }
    return FalloutDialogue.instance;
  }

  constructor() {
    this.buildDOM();
  }

  private buildDOM(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'fallout-dialogue-overlay';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      pointer-events: none;
      background: transparent;
      box-shadow: none;
      font-family: 'Courier New', Courier, monospace;
      color: #fbbf24;
      user-select: none;
      overflow: hidden;
    `;

    // Dialog Modal Box strictly in lower third (bottom: 16px, compact height)
    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = `
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: min(840px, 92vw);
      max-height: 42vh;
      overflow-y: auto;
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid #f59e0b;
      box-shadow: 0 0 24px rgba(245, 158, 11, 0.35), inset 0 0 16px rgba(245, 158, 11, 0.15);
      border-radius: 10px;
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      backdrop-filter: blur(12px);
      box-sizing: border-box;
    `;

    dialogBox.addEventListener('click', (e) => {
      if (this.isResponding && performance.now() - this.responseTimestamp >= 200) {
        e.stopPropagation();
        this.closeEncounter();
      }
    });

    // Scanlines localized strictly within the dialog box itself
    const scanlines = document.createElement('div');
    scanlines.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.15) 0px,
        rgba(0, 0, 0, 0.15) 2px,
        transparent 2px,
        transparent 4px
      );
      opacity: 0.6;
      border-radius: 8px;
    `;
    dialogBox.appendChild(scanlines);

    // Header with Speaker & Pip-boy status
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(245, 158, 11, 0.4);
      padding-bottom: 4px;
      flex-shrink: 0;
    `;

    this.speakerBox = document.createElement('div');
    this.speakerBox.style.cssText = `
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 1.2px;
      color: #fde047;
      text-shadow: 0 0 8px rgba(253, 224, 71, 0.7);
      text-transform: uppercase;
    `;
    this.speakerBox.textContent = '[NPC]';
    header.appendChild(this.speakerBox);

    const crtIndicator = document.createElement('div');
    crtIndicator.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    crtIndicator.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span> DIALOGUE INTERFACE v2.4';
    header.appendChild(crtIndicator);

    dialogBox.appendChild(header);

    // Main NPC Quote Box (flex-shrink: 0 prevents overlap)
    this.promptBox = document.createElement('div');
    this.promptBox.style.cssText = `
      font-size: 18px;
      line-height: 1.45;
      font-weight: 700;
      color: #fef3c7;
      text-shadow: 0 0 8px rgba(254, 243, 199, 0.4);
      flex-shrink: 0;
      box-sizing: border-box;
      padding: 2px 0;
    `;
    dialogBox.appendChild(this.promptBox);

    // Multi-Choice Options Container (flex-shrink: 0 prevents flex compression)
    this.choicesContainer = document.createElement('div');
    this.choicesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
      flex-shrink: 0;
      box-sizing: border-box;
    `;
    dialogBox.appendChild(this.choicesContainer);

    const controllerFooter = document.createElement('div');
    controllerFooter.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(245, 158, 11, 0.3);
      padding-top: 4px;
      margin-top: 2px;
      font-size: 12px;
      color: #94a3b8;
      font-weight: 700;
      flex-shrink: 0;
    `;
    controllerFooter.innerHTML = `
      <span>🎮 [D-Pad] Navigáció • [A] Kiválasztás • [X, Y, B] Gyorsgombok</span>
      <span>⌨️ [1, 2, 3] Számok</span>
    `;
    dialogBox.appendChild(controllerFooter);

    this.container.appendChild(dialogBox);
    document.body.appendChild(this.container);
  }

  public startEncounter(config: DialogueEncounterConfig): void {
    if (this.isActive || !this.container) return;
    this.isActive = true;
    this.isResponding = false;
    this.currentConfig = config;
    this.focusedChoiceIndex = 0;

    if (this.speakerBox) {
      this.speakerBox.textContent = `[${config.speakerName}]`;
    }
    if (this.promptBox) {
      this.promptBox.textContent = config.speakerPrompt;
    }

    this.renderChoices(config.choices);
    this.container.style.display = 'block';

    // Keyboard navigation (1, 2, 3...) and Continue
    this.keyListener = (e: KeyboardEvent) => {
      if (!this.isActive) return;
      if (this.isResponding) {
        if (performance.now() - this.responseTimestamp < 200) return;
        if (
          e.key === ' ' ||
          e.key === 'Enter' ||
          e.key === 'Escape' ||
          e.key === 'e' ||
          e.key === 'E' ||
          e.key === '1' ||
          e.key === '2' ||
          e.key === '3'
        ) {
          e.preventDefault();
          this.closeEncounter();
        }
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= config.choices.length) {
        this.selectChoice(config.choices[num - 1]);
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  private renderChoices(choices: DialogueChoice[]): void {
    if (!this.choicesContainer) return;
    this.choicesContainer.innerHTML = '';
    this.choiceButtons = [];

    const badges = [
      { text: 'X', bg: '#2563eb', color: '#ffffff' },
      { text: 'Y', bg: '#eab308', color: '#000000' },
      { text: 'B', bg: '#ef4444', color: '#ffffff' },
    ];

    choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        background: rgba(30, 41, 59, 0.85);
        border: 2px solid rgba(245, 158, 11, 0.45);
        border-radius: 8px;
        padding: 9px 14px;
        text-align: left;
        font-family: inherit;
        font-size: 16px;
        line-height: 1.35;
        font-weight: 800;
        color: #fde047;
        cursor: pointer;
        transition: all 0.15s ease;
        outline: none;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      `;

      const badge = badges[index] || { text: `${index + 1}`, bg: '#f59e0b', color: '#000' };
      btn.innerHTML = `
        <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:${badge.bg}; color:${badge.color}; font-size:12px; font-weight:900; flex-shrink:0; box-shadow:0 0 6px ${badge.bg};">${badge.text}</span>
        <span style="color:#fbbf24; margin-right:4px;">${index + 1}.</span>
        <span>${choice.text}</span>
      `;

      btn.addEventListener('mouseenter', () => {
        this.focusedChoiceIndex = index;
        this.updateChoiceFocusVisuals();
      });

      btn.addEventListener('click', () => {
        if (!this.isResponding) {
          this.selectChoice(choice);
        }
      });

      this.choicesContainer!.appendChild(btn);
      this.choiceButtons.push(btn);
    });

    this.updateChoiceFocusVisuals();
  }

  private updateChoiceFocusVisuals(): void {
    this.choiceButtons.forEach((btn, idx) => {
      if (idx === this.focusedChoiceIndex) {
        btn.style.background = 'rgba(245, 158, 11, 0.32)';
        btn.style.borderColor = '#fde047';
        btn.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.65)';
        btn.style.color = '#ffffff';
        btn.style.transform = 'translateX(4px)';
      } else {
        btn.style.background = 'rgba(30, 41, 59, 0.85)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.45)';
        btn.style.boxShadow = 'none';
        btn.style.color = '#fde047';
        btn.style.transform = 'none';
      }
    });
  }

  public update(): void {
    if (!this.isActive || !this.currentConfig) return;

    if (this.isResponding) {
      if (performance.now() - this.responseTimestamp < 200) return;
      if (
        inputManager.isAnyButtonJustPressed(XboxButton.A) ||
        inputManager.isAnyButtonJustPressed(XboxButton.B) ||
        inputManager.isAnyButtonJustPressed(XboxButton.X) ||
        inputManager.isAnyButtonJustPressed(XboxButton.Y) ||
        inputManager.isAnyButtonJustPressed(XboxButton.START)
      ) {
        this.closeEncounter();
      }
      return;
    }

    const choicesCount = this.currentConfig.choices.length;
    if (choicesCount === 0) return;

    // Up / Down navigation
    if (
      inputManager.isAnyButtonJustPressed(XboxButton.DPAD_UP) ||
      inputManager.isButtonJustPressed(0, XboxButton.DPAD_UP)
    ) {
      this.focusedChoiceIndex = (this.focusedChoiceIndex - 1 + choicesCount) % choicesCount;
      this.updateChoiceFocusVisuals();
    } else if (
      inputManager.isAnyButtonJustPressed(XboxButton.DPAD_DOWN) ||
      inputManager.isButtonJustPressed(0, XboxButton.DPAD_DOWN)
    ) {
      this.focusedChoiceIndex = (this.focusedChoiceIndex + 1) % choicesCount;
      this.updateChoiceFocusVisuals();
    }

    // Confirm button A
    if (
      inputManager.isAnyButtonJustPressed(XboxButton.A) ||
      inputManager.isAnyButtonJustPressed(XboxButton.START)
    ) {
      const selected = this.currentConfig.choices[this.focusedChoiceIndex];
      if (selected) {
        this.selectChoice(selected);
        return;
      }
    }

    // Direct button shortcuts (X = 1, Y = 2, B = 3)
    if (inputManager.isAnyButtonJustPressed(XboxButton.X) && this.currentConfig.choices[0]) {
      this.selectChoice(this.currentConfig.choices[0]);
    } else if (inputManager.isAnyButtonJustPressed(XboxButton.Y) && this.currentConfig.choices[1]) {
      this.selectChoice(this.currentConfig.choices[1]);
    } else if (inputManager.isAnyButtonJustPressed(XboxButton.B) && this.currentConfig.choices[2]) {
      this.selectChoice(this.currentConfig.choices[2]);
    }
  }

  private selectChoice(choice: DialogueChoice): void {
    this.isResponding = true;
    this.responseTimestamp = performance.now();

    // Trigger specific gameplay outcome
    choice.onSelect();

    // Show NPC reaction in prompt box
    if (this.promptBox) {
      this.promptBox.style.color = '#38bdf8';
      this.promptBox.textContent = `"${choice.response}"`;
    }

    if (this.choicesContainer) {
      this.choicesContainer.innerHTML = '';

      const continueBtn = document.createElement('button');
      continueBtn.id = 'fallout-dialogue-continue-btn';
      continueBtn.style.cssText = `
        background: rgba(245, 158, 11, 0.22);
        border: 2px solid #f59e0b;
        border-radius: 8px;
        padding: 14px 22px;
        text-align: center;
        font-family: inherit;
        font-size: 18px;
        line-height: 1.4;
        font-weight: 800;
        color: #fef3c7;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.45);
        outline: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: all 0.15s ease;
        width: 100%;
        box-sizing: border-box;
        margin-top: 6px;
      `;
      continueBtn.innerHTML = `
        <span style="font-size: 22px;">🖱️</span>
        <span>Kattints a folytatáshoz</span>
        <span style="font-size: 13px; color: #cbd5e1; font-weight: 700;">[Space / Enter / (A)] ▸</span>
      `;
      continueBtn.addEventListener('mouseenter', () => {
        continueBtn.style.background = 'rgba(245, 158, 11, 0.38)';
        continueBtn.style.borderColor = '#fde047';
        continueBtn.style.transform = 'scale(1.01)';
      });
      continueBtn.addEventListener('mouseleave', () => {
        continueBtn.style.background = 'rgba(245, 158, 11, 0.22)';
        continueBtn.style.borderColor = '#f59e0b';
        continueBtn.style.transform = 'none';
      });
      continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() - this.responseTimestamp >= 200) {
          this.closeEncounter();
        }
      });

      this.choicesContainer.appendChild(continueBtn);
    }
  }

  public closeEncounter(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.isResponding = false;

    if (this.container) {
      this.container.style.display = 'none';
    }

    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }

    if (this.currentConfig?.onComplete) {
      this.currentConfig.onComplete();
    }
    this.currentConfig = null;
  }
}

export const falloutDialogue = FalloutDialogue.getInstance();

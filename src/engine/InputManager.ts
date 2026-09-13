export interface Vector2D {
  x: number;
  y: number;
}

export enum XboxButton {
  A = 0,             // Bottom action button (South)
  B = 1,             // Right action button (East)
  X = 2,             // Left action button (West)
  Y = 3,             // Top action button (North)
  LB = 4,            // Left Bumper
  RB = 5,            // Right Bumper
  LT = 6,            // Left Trigger
  RT = 7,            // Right Trigger
  BACK = 8,          // Back / View / Select
  START = 9,         // Start / Menu
  LS_CLICK = 10,     // Left stick click
  RS_CLICK = 11,     // Right stick click
  DPAD_UP = 12,      // D-Pad Up
  DPAD_DOWN = 13,    // D-Pad Down
  DPAD_LEFT = 14,    // D-Pad Left
  DPAD_RIGHT = 15,   // D-Pad Right
}

export class InputManager {
  private static instance: InputManager | null = null;
  private pressedKeys = new Set<string>();

  private p1Vector: Vector2D = { x: 0, y: 0 };
  private p2Vector: Vector2D = { x: 0, y: 0 };
  private p1Action = false;
  private p2Action = false;
  private controlsLocked = false;

  // Gamepad button history for edge detection (single frame just-pressed / just-released)
  private prevButtonStates: Map<number, boolean[]> = new Map();
  private currentButtonStates: Map<number, boolean[]> = new Map();
  private connectedGamepadIndices: Set<number> = new Set();

  public readonly deadzone: number;

  constructor(deadzone = 0.20) {
    this.deadzone = deadzone;
    this.initKeyboardListeners();
  }

  public lockControls(locked = true): void {
    this.controlsLocked = locked;
    if (locked) {
      this.resetMovementAndActions();
    }
  }

  public areControlsLocked(): boolean {
    return this.controlsLocked;
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private initKeyboardListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      // Prevent browser default window scrolling for game controls
      if (
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown' ||
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight' ||
        event.code === 'Space'
      ) {
        event.preventDefault();
      }
      this.pressedKeys.add(event.code);
      this.pressedKeys.add(event.key);
    });

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      this.pressedKeys.delete(event.code);
      this.pressedKeys.delete(event.key);
    });

    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
    });
  }

  public reset(): void {
    this.pressedKeys.clear();
    this.resetMovementAndActions();
    this.prevButtonStates.clear();
    this.currentButtonStates.clear();
  }

  private resetMovementAndActions(): void {
    this.p1Vector = { x: 0, y: 0 };
    this.p2Vector = { x: 0, y: 0 };
    this.p1Action = false;
    this.p2Action = false;
  }

  private isKeyDown(...keys: string[]): boolean {
    return keys.some((k) => this.pressedKeys.has(k));
  }

  public applyDeadzone(val: number): number {
    if (Math.abs(val) < this.deadzone) {
      return 0;
    }
    return Math.sign(val) * ((Math.abs(val) - this.deadzone) / (1 - this.deadzone));
  }

  public applyRadialDeadzone(x: number, y: number, deadzone = this.deadzone): { x: number; y: number } {
    const mag = Math.hypot(x, y);
    if (mag < deadzone) {
      return { x: 0, y: 0 };
    }
    const scaled = Math.min(1.0, (mag - deadzone) / (1 - deadzone));
    return {
      x: (x / mag) * scaled,
      y: (y / mag) * scaled,
    };
  }

  public getConnectedValidGamepads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    const raw = Array.from(navigator.getGamepads()).filter(
      (gp): gp is Gamepad => Boolean(gp && gp.connected && gp.buttons && gp.buttons.length >= 4)
    );

    // On Windows, Bluetooth Xbox controllers often register both a standard XInput device
    // and a duplicate raw HID device where triggers are mapped to axes[1] (causing phantom stuck-down drift).
    // If standard-mapped gamepads are present, prioritize and use only standard gamepads!
    const standardPads = raw.filter((gp) => gp.mapping === 'standard');
    if (standardPads.length > 0) {
      return standardPads;
    }
    return raw;
  }

  public getControllerSchemeInfo(): { count: number; description: string } {
    const pads = this.getConnectedValidGamepads();
    if (pads.length >= 2) {
      return { count: 2, description: '2 kontroller: 1. kontroller = Viki, 2. kontroller = Kristóf' };
    } else if (pads.length === 1) {
      return { count: 1, description: '1 kontroller: Bal kar = Viki, Jobb kar = Kristóf (vagy Nyilak / IJKL)' };
    } else {
      return { count: 0, description: 'Billentyűzet: WASD = Viki, Nyilak / IJKL = Kristóf' };
    }
  }

  public hasGamepad(index: number): boolean {
    return this.connectedGamepadIndices.has(index);
  }

  public getConnectedGamepadCount(): number {
    return this.connectedGamepadIndices.size;
  }

  public isButtonDown(gpIndex: number, btn: XboxButton | number): boolean {
    const states = this.currentButtonStates.get(gpIndex);
    return !!states && !!states[btn];
  }

  public isButtonJustPressed(gpIndex: number, btn: XboxButton | number): boolean {
    const current = this.currentButtonStates.get(gpIndex)?.[btn] ?? false;
    const prev = this.prevButtonStates.get(gpIndex)?.[btn] ?? false;
    return current && !prev;
  }

  public isButtonJustReleased(gpIndex: number, btn: XboxButton | number): boolean {
    const current = this.currentButtonStates.get(gpIndex)?.[btn] ?? false;
    const prev = this.prevButtonStates.get(gpIndex)?.[btn] ?? false;
    return !current && prev;
  }

  public isAnyButtonDown(btn: XboxButton | number): boolean {
    for (const gpIndex of this.connectedGamepadIndices) {
      if (this.isButtonDown(gpIndex, btn)) return true;
    }
    return false;
  }

  public isAnyButtonJustPressed(btn: XboxButton | number): boolean {
    for (const gpIndex of this.connectedGamepadIndices) {
      if (this.isButtonJustPressed(gpIndex, btn)) return true;
    }
    return false;
  }

  public getDpad(gpIndex: number): Vector2D {
    const states = this.currentButtonStates.get(gpIndex);
    if (!states) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (states[XboxButton.DPAD_LEFT]) x -= 1;
    if (states[XboxButton.DPAD_RIGHT]) x += 1;
    if (states[XboxButton.DPAD_UP]) y -= 1;
    if (states[XboxButton.DPAD_DOWN]) y += 1;
    return { x, y };
  }

  public update(): void {
    const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : [];

    // --- 1. Update Gamepad Button Edge History ---
    this.connectedGamepadIndices.clear();

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp || !gp.connected) continue;

      this.connectedGamepadIndices.add(i);

      // Save previous frame states
      const prev = this.currentButtonStates.get(i) ? [...this.currentButtonStates.get(i)!] : [];
      this.prevButtonStates.set(i, prev);

      // Read new states
      const current: boolean[] = [];
      for (let b = 0; b < gp.buttons.length; b++) {
        const btn = gp.buttons[b];
        current[b] = btn ? (btn.pressed || btn.value > 0.4) : false;
      }
      this.currentButtonStates.set(i, current);
    }

    // If gameplay controls are locked (e.g. cutscene, modal open), zero out movement and action vectors
    if (this.controlsLocked) {
      this.resetMovementAndActions();
      return;
    }

    const activePads = this.getConnectedValidGamepads();
    const gp1 = activePads[0] ?? null;
    const gp2 = activePads.length >= 2 ? activePads[1] : null;

    let p1X = 0;
    let p1Y = 0;
    let p1Action = false;

    let p2X = 0;
    let p2Y = 0;
    let p2Action = false;

    // --- 2. Gamepad Input for Player 1 (gp1 Left Stick & D-Pad) ---
    if (gp1) {
      const stick1 = this.applyRadialDeadzone(gp1.axes[0] ?? 0, gp1.axes[1] ?? 0);
      p1X = stick1.x;
      p1Y = stick1.y;

      const dpad1 = this.getDpad(gp1.index);
      if (p1X === 0 && p1Y === 0) {
        p1X = dpad1.x;
        p1Y = dpad1.y;
      }

      // Action: Button A (0), Button X (2), RT (7), LT (6)
      const btnA = gp1.buttons[XboxButton.A];
      const btnX = gp1.buttons[XboxButton.X];
      const btnRT = gp1.buttons[XboxButton.RT];
      const btnLT = gp1.buttons[XboxButton.LT];
      if (
        (btnA && (btnA.pressed || btnA.value > 0.4)) ||
        (btnX && (btnX.pressed || btnX.value > 0.4)) ||
        (btnRT && (btnRT.pressed || btnRT.value > 0.4)) ||
        (btnLT && (btnLT.pressed || btnLT.value > 0.4))
      ) {
        p1Action = true;
      }

      // If ONLY 1 controller is connected: Gamepad 0 Right Stick + Bumpers control Player 2!
      if (!gp2) {
        const stickShared = this.applyRadialDeadzone(gp1.axes[2] ?? 0, gp1.axes[3] ?? 0);
        if (stickShared.x !== 0 || stickShared.y !== 0) {
          p2X = stickShared.x;
          p2Y = stickShared.y;
        }

        const btnRB = gp1.buttons[XboxButton.RB];
        const btnLB = gp1.buttons[XboxButton.LB];
        const btnB = gp1.buttons[XboxButton.B];
        const btnY = gp1.buttons[XboxButton.Y];
        const btnRS = gp1.buttons[XboxButton.RS_CLICK];
        if (
          (btnRB && (btnRB.pressed || btnRB.value > 0.4)) ||
          (btnLB && (btnLB.pressed || btnLB.value > 0.4)) ||
          (btnB && (btnB.pressed || btnB.value > 0.4)) ||
          (btnY && (btnY.pressed || btnY.value > 0.4)) ||
          (btnRS && (btnRS.pressed || btnRS.value > 0.4))
        ) {
          p2Action = true;
        }
      }
    }

    // --- 3. Gamepad Input for Player 2 (gp2 Left Stick & D-Pad) ---
    if (gp2) {
      const stick2 = this.applyRadialDeadzone(gp2.axes[0] ?? 0, gp2.axes[1] ?? 0);
      p2X = stick2.x;
      p2Y = stick2.y;

      const dpad2 = this.getDpad(gp2.index);
      if (p2X === 0 && p2Y === 0) {
        p2X = dpad2.x;
        p2Y = dpad2.y;
      }

      const btnA2 = gp2.buttons[XboxButton.A];
      const btnX2 = gp2.buttons[XboxButton.X];
      const btnRT2 = gp2.buttons[XboxButton.RT];
      const btnLT2 = gp2.buttons[XboxButton.LT];
      const btnRB2 = gp2.buttons[XboxButton.RB];
      const btnLB2 = gp2.buttons[XboxButton.LB];
      const btnB2 = gp2.buttons[XboxButton.B];
      if (
        (btnA2 && (btnA2.pressed || btnA2.value > 0.4)) ||
        (btnX2 && (btnX2.pressed || btnX2.value > 0.4)) ||
        (btnRT2 && (btnRT2.pressed || btnRT2.value > 0.4)) ||
        (btnLT2 && (btnLT2.pressed || btnLT2.value > 0.4)) ||
        (btnRB2 && (btnRB2.pressed || btnRB2.value > 0.4)) ||
        (btnLB2 && (btnLB2.pressed || btnLB2.value > 0.4)) ||
        (btnB2 && (btnB2.pressed || btnB2.value > 0.4))
      ) {
        p2Action = true;
      }

      // Also allow controller 1 right stick as co-op fallback if gp2 stick is neutral
      if (p2X === 0 && p2Y === 0 && gp1) {
        const stickShared = this.applyRadialDeadzone(gp1.axes[2] ?? 0, gp1.axes[3] ?? 0);
        if (stickShared.x !== 0 || stickShared.y !== 0) {
          p2X = stickShared.x;
          p2Y = stickShared.y;
        }
      }
    }

    // --- 4. Keyboard Controls (Always active, authoritative override / blend) ---
    // Player 1 Keyboard: WASD + Space / E
    let k1x = 0;
    let k1y = 0;
    if (this.isKeyDown('KeyD', 'Keyd', 'd', 'D')) k1x += 1;
    if (this.isKeyDown('KeyA', 'Keya', 'a', 'A')) k1x -= 1;
    if (this.isKeyDown('KeyS', 'Keys', 's', 'S')) k1y += 1;
    if (this.isKeyDown('KeyW', 'Keyw', 'w', 'W')) k1y -= 1;

    if (k1x !== 0 || k1y !== 0) {
      const mag = Math.hypot(k1x, k1y);
      p1X = k1x / mag;
      p1Y = k1y / mag;
    }
    if (this.isKeyDown('Space', ' ', 'KeyE', 'e', 'E')) {
      p1Action = true;
    }

    // Player 2 Keyboard: Arrow keys, IJKL, Numpad 8426 + Enter / Shift / Numpad0 / O / U
    let k2x = 0;
    let k2y = 0;
    if (this.isKeyDown('ArrowRight', 'KeyL', 'l', 'L', 'Numpad6')) k2x += 1;
    if (this.isKeyDown('ArrowLeft', 'KeyJ', 'j', 'J', 'Numpad4')) k2x -= 1;
    if (this.isKeyDown('ArrowDown', 'KeyK', 'k', 'K', 'Numpad2')) k2y += 1;
    if (this.isKeyDown('ArrowUp', 'KeyI', 'i', 'I', 'Numpad8')) k2y -= 1;

    if (k2x !== 0 || k2y !== 0) {
      const mag = Math.hypot(k2x, k2y);
      p2X = k2x / mag;
      p2Y = k2y / mag;
    }
    if (
      this.isKeyDown('Enter', 'Numpad0', 'NumpadEnter', 'ShiftRight', 'ShiftLeft', 'KeyO', 'KeyU', 'o', 'u')
    ) {
      p2Action = true;
    }

    // Clamp maximum magnitudes
    const p1Mag = Math.hypot(p1X, p1Y);
    if (p1Mag > 1.0) {
      p1X /= p1Mag;
      p1Y /= p1Mag;
    }
    const p2Mag = Math.hypot(p2X, p2Y);
    if (p2Mag > 1.0) {
      p2X /= p2Mag;
      p2Y /= p2Mag;
    }

    this.p1Vector = { x: p1X, y: p1Y };
    this.p1Action = p1Action;
    this.p2Vector = { x: p2X, y: p2Y };
    this.p2Action = p2Action;
  }

  public getP1Vector(): Vector2D {
    if (this.controlsLocked) return { x: 0, y: 0 };
    return { ...this.p1Vector };
  }

  public getP2Vector(): Vector2D {
    if (this.controlsLocked) return { x: 0, y: 0 };
    return { ...this.p2Vector };
  }

  public getP1Action(): boolean {
    if (this.controlsLocked) return false;
    return this.p1Action;
  }

  public getP2Action(): boolean {
    if (this.controlsLocked) return false;
    return this.p2Action;
  }

  public isP1Action(): boolean {
    if (this.controlsLocked) return false;
    return this.p1Action;
  }

  public isP2Action(): boolean {
    if (this.controlsLocked) return false;
    return this.p2Action;
  }

  public getP1Jump(): boolean {
    if (this.controlsLocked) return false;
    return this.p1Action;
  }

  public getP2Jump(): boolean {
    if (this.controlsLocked) return false;
    return this.p2Action;
  }

  public isCheatComboPressed(): boolean {
    const hasV = this.pressedKeys.has('KeyV') || this.pressedKeys.has('v') || this.pressedKeys.has('V');
    const hasK = this.pressedKeys.has('KeyK') || this.pressedKeys.has('k') || this.pressedKeys.has('K');
    const hasC = this.pressedKeys.has('KeyC') || this.pressedKeys.has('c') || this.pressedKeys.has('C');
    return hasV && hasK && hasC;
  }
}

export const inputManager = InputManager.getInstance();

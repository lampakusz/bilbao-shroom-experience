/**
 * VictoryScreen.ts
 * Celebratory stylized end-game statistics modal shown upon completing
 * the Sopelana Beach finale sequence.
 */

export interface EndGameStats {
  playTimeSeconds: number;
  relicsCollected: number;
  totalRelics: number;
  tripLevel: number;
  stunCount: number;
  onReplay?: () => void;
  onMainMenu?: () => void;
}

export class VictoryScreen {
  private static instance: VictoryScreen | null = null;
  private container: HTMLDivElement;

  private constructor() {
    this.container = document.createElement('div');
    this.container.id = 'endgame-victory-screen';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 23, 42, 0.88) 0%, rgba(2, 6, 23, 0.98) 100%);
      backdrop-filter: blur(16px);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 300;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      padding: 24px;
      opacity: 0;
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(this.container);
  }

  public static getInstance(): VictoryScreen {
    if (!VictoryScreen.instance) {
      VictoryScreen.instance = new VictoryScreen();
    }
    return VictoryScreen.instance;
  }

  public static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const mStr = mins.toString().padStart(2, '0');
    const sStr = secs.toString().padStart(2, '0');
    return `${mStr}:${sStr}`;
  }

  public show(stats: EndGameStats): void {
    const formattedTime = VictoryScreen.formatTime(stats.playTimeSeconds);
    const stunDisplay = stats.stunCount === 0
      ? '0 (✨ Zen Mester!)'
      : `${stats.stunCount} ütközés`;

    this.container.innerHTML = `
      <div style="
        background: rgba(30, 41, 59, 0.85);
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-radius: 18px;
        padding: 36px 32px;
        width: 480px;
        max-width: 92vw;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 20px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.25);
        animation: modalScaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      ">
        <!-- Glowing Badge -->
        <div style="font-size: 52px; filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.6)); line-height: 1;">
          🌅🔥🌊
        </div>

        <!-- Headers -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h1 style="
            margin: 0;
            font-size: 28px;
            font-weight: 900;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, #38bdf8 0%, #f472b6 60%, #fbbf24 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(56, 189, 248, 0.4);
          ">SOPELANA BEACH ELÉRVE!</h1>
          <div style="font-size: 14px; font-weight: 700; color: #34d399; letter-spacing: 1px; text-transform: uppercase;">
            ✨ A Trip Beteljesült ✨
          </div>
        </div>

        <!-- Narrative Description -->
        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; max-width: 400px;">
          Sikeresen végigjártátok a várost Viki lakásától a Deusto metrón át a vadregényes tengerpartig. A tábortűz ropog, a hullámok zúgnak a naplementében.
        </p>

        <!-- Stats Grid (2x2 Tiles) -->
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 100%;
          margin: 6px 0;
        ">
          <!-- Time -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">⏱️ Menetidő</span>
            <span style="font-size: 20px; font-weight: 800; color: #38bdf8;">${formattedTime}</span>
          </div>

          <!-- Relics -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">🍄 Relikviák</span>
            <span style="font-size: 20px; font-weight: 800; color: #f59e0b;">${stats.relicsCollected} / ${stats.totalRelics}</span>
            <span style="font-size: 10px; color: #64748b;">(2 gomba + 8 spangli)</span>
          </div>

          <!-- Trip Level -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">🌀 Trip Szint</span>
            <span style="font-size: 20px; font-weight: 800; color: #c084fc;">100%</span>
            <span style="font-size: 10px; color: #64748b;">Full Cosmic Harmony</span>
          </div>

          <!-- Paranoia / Stuns -->
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">⚡ Paranoia / Stun</span>
            <span style="font-size: 17px; font-weight: 800; color: ${stats.stunCount === 0 ? '#34d399' : '#f87171'};">${stunDisplay}</span>
            <span style="font-size: 10px; color: #64748b;">Ütközések száma</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; width: 100%; margin-top: 4px;">
          <button id="btn-victory-replay" style="
            flex: 1;
            background: linear-gradient(135deg, #059669, #10b981);
            color: white;
            border: 1px solid #34d399;
            border-radius: 10px;
            padding: 13px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
            transition: transform 0.15s, filter 0.15s;
          ">🔄 Újrajátszás (Elejétől)</button>

          <button id="btn-victory-menu" style="
            flex: 1;
            background: rgba(30, 41, 59, 0.95);
            color: #f1f5f9;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 13px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
          ">🏠 Vissza a Főmenübe</button>
        </div>
      </div>
    `;

    this.container.style.display = 'flex';
    // Smooth fade in
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });

    const replayBtn = this.container.querySelector('#btn-victory-replay') as HTMLButtonElement | null;
    replayBtn?.addEventListener('click', () => {
      this.hide();
      stats.onReplay?.();
    });

    const menuBtn = this.container.querySelector('#btn-victory-menu') as HTMLButtonElement | null;
    menuBtn?.addEventListener('click', () => {
      this.hide();
      stats.onMainMenu?.();
    });
  }

  public hide(): void {
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 400);
  }
}

export const victoryScreen = VictoryScreen.getInstance();

import { AudioManager } from '../../core/AudioManager';
import { SaveManager } from '../../core/SaveManager';

export interface TopHudCallbacks {
  onRestart: () => void;
  onOpenLevelMenu: () => void;
  onToggleSound: () => void;
  onToggleSpeed?: () => void;
}

export class TopHudView {
  private levelTextEl: HTMLElement;
  private subTitleEl: HTMLElement;
  private progressFillEl: HTMLElement;
  private coinsTextEl: HTMLElement;
  private soundBtnEl: HTMLButtonElement;
  private speedBtnEl: HTMLButtonElement | null;
  private speedLabelEl: HTMLElement | null;

  constructor(callbacks: TopHudCallbacks) {
    this.levelTextEl = document.getElementById('hud-level-title')!;
    this.subTitleEl = document.getElementById('hud-level-sub')!;
    this.progressFillEl = document.getElementById('hud-progress-fill')!;
    this.coinsTextEl = document.getElementById('hud-coins-text')!;
    this.soundBtnEl = document.getElementById('btn-sound') as HTMLButtonElement;
    this.speedBtnEl = document.getElementById('btn-speed') as HTMLButtonElement | null;
    this.speedLabelEl = document.getElementById('speed-label');

    this.speedBtnEl?.addEventListener('click', () => {
      callbacks.onToggleSpeed?.();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      AudioManager.playUiClick();
      callbacks.onRestart();
    });
    document.getElementById('btn-levels')?.addEventListener('click', () => {
      AudioManager.playUiClick();
      callbacks.onOpenLevelMenu();
    });
    document.getElementById('btn-level-pill')?.addEventListener('click', () => {
      AudioManager.playUiClick();
      callbacks.onOpenLevelMenu();
    });
    document.getElementById('btn-add-coins')?.addEventListener('click', () => {
      AudioManager.playBoosterExtraSlot();
      SaveManager.addCoins(500);
      this.coinsTextEl.textContent = String(SaveManager.getData().coins);
    });
    this.soundBtnEl?.addEventListener('click', () => {
      callbacks.onToggleSound();
      AudioManager.playUiClick();
    });
  }

  update(levelId: number, title: string, progressRatio: number): void {
    const save = SaveManager.getData();
    this.levelTextEl.textContent = `Level ${levelId}`;
    this.subTitleEl.textContent = title;
    this.progressFillEl.style.width = `${Math.min(100, Math.round(progressRatio * 100))}%`;
    this.coinsTextEl.textContent = String(save.coins);
    this.soundBtnEl.classList.toggle('muted', !AudioManager.isSoundEnabled());
  }

  setSpeed(speed: number): void {
    if (this.speedLabelEl) {
      this.speedLabelEl.textContent = `${speed}x`;
    }
    if (this.speedBtnEl) {
      this.speedBtnEl.classList.remove('speed-1x', 'speed-2x', 'speed-5x');
      this.speedBtnEl.classList.add(`speed-${speed}x`);
    }
  }
}

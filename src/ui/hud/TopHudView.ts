import { AudioManager } from '../../core/AudioManager';
import { SaveManager } from '../../core/SaveManager';

export interface TopHudCallbacks {
  onRestart: () => void;
  onOpenLevelMenu: () => void;
  onToggleSound: () => void;
}

export class TopHudView {
  private levelTextEl: HTMLElement;
  private subTitleEl: HTMLElement;
  private progressFillEl: HTMLElement;
  private coinsTextEl: HTMLElement;
  private soundBtnEl: HTMLButtonElement;

  constructor(callbacks: TopHudCallbacks) {
    this.levelTextEl = document.getElementById('hud-level-title')!;
    this.subTitleEl = document.getElementById('hud-level-sub')!;
    this.progressFillEl = document.getElementById('hud-progress-fill')!;
    this.coinsTextEl = document.getElementById('hud-coins-text')!;
    this.soundBtnEl = document.getElementById('btn-sound') as HTMLButtonElement;

    document.getElementById('btn-restart')?.addEventListener('click', () => callbacks.onRestart());
    document.getElementById('btn-levels')?.addEventListener('click', () => callbacks.onOpenLevelMenu());
    this.soundBtnEl?.addEventListener('click', () => callbacks.onToggleSound());
  }

  update(levelId: number, title: string, progressRatio: number): void {
    const save = SaveManager.getData();
    this.levelTextEl.textContent = `LEVEL ${levelId}`;
    this.subTitleEl.textContent = title;
    this.progressFillEl.style.width = `${Math.min(100, Math.round(progressRatio * 100))}%`;
    this.coinsTextEl.textContent = String(save.coins);
    this.soundBtnEl.textContent = AudioManager.isSoundEnabled() ? '🔊' : '🔇';
  }
}


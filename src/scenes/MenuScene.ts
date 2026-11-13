import { AssetLoader } from '../core/AssetLoader';
import { SaveManager } from '../core/SaveManager';

export class MenuScene {
  private modalEl: HTMLElement;
  private listEl: HTMLElement;
  private onSelectLevel: (levelId: number) => void;

  constructor(onSelectLevel: (levelId: number) => void) {
    this.onSelectLevel = onSelectLevel;
    this.modalEl = document.getElementById('level-menu-modal')!;
    this.listEl = document.getElementById('level-menu-list')!;

    document.getElementById('btn-close-menu')?.addEventListener('click', () => this.hide());
    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      SaveManager.resetAll();
      this.onSelectLevel(1);
      this.hide();
    });
  }

  show(currentLevelId: number): void {
    const levels = AssetLoader.getAllLevels();
    const save = SaveManager.getData();
    this.listEl.innerHTML = '';

    for (const lv of levels) {
      const done = save.completedLevels[lv.levelId];
      const item = document.createElement('button');
      item.className = `level-item-btn ${lv.levelId === currentLevelId ? 'current' : ''}`;
      item.innerHTML = `
        <div class="lv-left">
          <span class="lv-badge">Level ${lv.levelId}</span>
          <div class="lv-info">
            <strong>${lv.title}</strong>
            <small>Grid ${lv.sandBoard.width}×${lv.sandBoard.height} • ${lv.bucketQueue.length} Xô • ${lv.queueColumns.length} Cột Queue</small>
          </div>
        </div>
        <div class="lv-right">
          ${done ? '⭐⭐⭐' : lv.difficulty.toUpperCase()}
        </div>
      `;
      item.addEventListener('click', () => {
        this.hide();
        this.onSelectLevel(lv.levelId);
      });
      this.listEl.appendChild(item);
    }

    this.modalEl.hidden = false;
  }

  hide(): void {
    this.modalEl.hidden = true;
  }
}


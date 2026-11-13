export interface ResultCallbacks {
  onNextLevel: () => void;
  onRetryLevel: () => void;
  onReviveBuffer: () => void;
}

export class ResultScene {
  private overlayEl: HTMLElement;
  private eyebrowEl: HTMLElement;
  private titleEl: HTMLElement;
  private descEl: HTMLElement;
  private btnPrimary: HTMLButtonElement;
  private btnRevive: HTMLButtonElement;

  constructor(private callbacks: ResultCallbacks) {
    this.overlayEl = document.getElementById('result-overlay')!;
    this.eyebrowEl = document.getElementById('result-eyebrow')!;
    this.titleEl = document.getElementById('result-title')!;
    this.descEl = document.getElementById('result-desc')!;
    this.btnPrimary = document.getElementById('btn-result-primary') as HTMLButtonElement;
    this.btnRevive = document.getElementById('btn-result-revive') as HTMLButtonElement;
  }

  showWin(levelId: number, rewardCoins: number): void {
    this.eyebrowEl.textContent = `HOÀN THÀNH LEVEL ${levelId}`;
    this.titleEl.textContent = 'Tuyệt vời! 🎉';
    this.descEl.textContent = `Toàn bộ tranh cát đã được hút sạch! Thưởng +${rewardCoins} 🪙`;
    this.btnRevive.hidden = true;
    this.btnPrimary.textContent = 'Màn tiếp theo ➔';
    this.btnPrimary.onclick = () => {
      this.hide();
      this.callbacks.onNextLevel();
    };
    this.overlayEl.hidden = false;
  }

  showLose(drainedPercent: number, canRevive: boolean): void {
    this.eyebrowEl.textContent = 'KHAY CHỜ ĐÃ ĐẦY (5/5)';
    this.titleEl.textContent = 'Hết chỗ chứa vít!';
    this.descEl.textContent = `Đã hút được ${drainedPercent}% lượng cát trên tranh.`;
    this.btnRevive.hidden = !canRevive;
    this.btnRevive.textContent = '+1 Lỗ chờ & Chơi tiếp';
    this.btnRevive.onclick = () => {
      this.hide();
      this.callbacks.onReviveBuffer();
    };
    this.btnPrimary.textContent = 'Chơi lại màn này';
    this.btnPrimary.onclick = () => {
      this.hide();
      this.callbacks.onRetryLevel();
    };
    this.overlayEl.hidden = false;
  }

  hide(): void {
    this.overlayEl.hidden = true;
  }
}


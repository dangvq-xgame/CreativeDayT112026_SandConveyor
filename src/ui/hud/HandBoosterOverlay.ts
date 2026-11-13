export class HandBoosterOverlay {
  private bannerEl: HTMLElement;

  constructor(onCancel: () => void) {
    this.bannerEl = document.getElementById('hand-booster-banner')!;
    document.getElementById('btn-cancel-hand')?.addEventListener('click', () => onCancel());
  }

  setVisible(visible: boolean): void {
    this.bannerEl.hidden = !visible;
  }
}


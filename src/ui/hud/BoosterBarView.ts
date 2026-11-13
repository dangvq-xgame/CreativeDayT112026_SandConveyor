import { BalanceConfig } from '../../config/game.config';
import { SaveManager } from '../../core/SaveManager';
import { LinearConveyorModel } from '../../game/models/LinearConveyorModel';

export interface BoosterBarCallbacks {
  onUseExtraSlot: () => void;
  onUseHand: () => void;
  onUseShuffle: () => void;
}

export class BoosterBarView {
  private btnExtraSlot: HTMLButtonElement;
  private btnHand: HTMLButtonElement;
  private btnShuffle: HTMLButtonElement;
  private badgeExtraSlot: HTMLElement;
  private badgeHand: HTMLElement;
  private badgeShuffle: HTMLElement;
  private slotSubLabel: HTMLElement;

  constructor(callbacks: BoosterBarCallbacks) {
    this.btnExtraSlot = document.getElementById('booster-extra-slot') as HTMLButtonElement;
    this.btnHand = document.getElementById('booster-hand') as HTMLButtonElement;
    this.btnShuffle = document.getElementById('booster-shuffle') as HTMLButtonElement;

    this.badgeExtraSlot = document.getElementById('badge-extra-slot')!;
    this.badgeHand = document.getElementById('badge-hand')!;
    this.badgeShuffle = document.getElementById('badge-shuffle')!;
    this.slotSubLabel = document.getElementById('label-slot-status')!;

    this.btnExtraSlot.addEventListener('click', () => callbacks.onUseExtraSlot());
    this.btnHand.addEventListener('click', () => callbacks.onUseHand());
    this.btnShuffle.addEventListener('click', () => callbacks.onUseShuffle());
  }

  update(
    conveyor: LinearConveyorModel,
    hasLockedBuckets: boolean,
    totalQueueScrews: number,
    isHandSelecting: boolean
  ): void {
    const save = SaveManager.getData();
    const { extraSlot, hand, shuffle } = save.boosters;

    // Booster 1: ExtraSlot
    const maxedOutSlots = conveyor.activeSlots >= conveyor.maxActiveSlots;
    this.slotSubLabel.textContent = `Slot ${conveyor.activeSlots}/${conveyor.maxActiveSlots}`;
    this.badgeExtraSlot.textContent = maxedOutSlots
      ? 'MAX'
      : extraSlot > 0
        ? String(extraSlot)
        : `${BalanceConfig.boosters.extraSlot.coinCost}`;
    this.btnExtraSlot.disabled = maxedOutSlots;

    // Booster 2: Hand
    this.badgeHand.textContent =
      hand > 0 ? String(hand) : `${BalanceConfig.boosters.hand.coinCost}`;
    this.btnHand.disabled = !hasLockedBuckets;
    this.btnHand.classList.toggle('active-mode', isHandSelecting);

    // Booster 3: Shuffle
    this.badgeShuffle.textContent =
      shuffle > 0 ? String(shuffle) : `${BalanceConfig.boosters.shuffle.coinCost}`;
    this.btnShuffle.disabled = totalQueueScrews < 2;
  }
}

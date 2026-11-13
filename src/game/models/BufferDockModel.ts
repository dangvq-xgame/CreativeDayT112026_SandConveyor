import { BalanceConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';

export interface BufferSlotItem {
  colorId: ColorId;
  landed: boolean;
}

export class BufferDockModel {
  readonly maxReviveSlots: number;
  slots: Array<BufferSlotItem | null>;

  constructor(
    defaultSlots = BalanceConfig.bufferDock.defaultSlots,
    maxReviveSlots = BalanceConfig.bufferDock.maxReviveSlots
  ) {
    this.maxReviveSlots = maxReviveSlots;
    this.slots = Array.from({ length: defaultSlots }, () => null);
  }

  getCapacity(): number {
    return this.slots.length;
  }

  getUsedCount(): number {
    return this.slots.filter((s) => s !== null).length;
  }

  isFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  findFirstEmptySlotIndex(): number {
    return this.slots.findIndex((s) => s === null);
  }

  reserveSlot(slotIndex: number, colorId: ColorId): boolean {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return false;
    if (this.slots[slotIndex] !== null) return false;
    this.slots[slotIndex] = { colorId, landed: false };
    return true;
  }

  markSlotLanded(slotIndex: number): void {
    const item = this.slots[slotIndex];
    if (item) {
      item.landed = true;
    }
  }

  takeScrewAt(slotIndex: number): BufferSlotItem | null {
    const item = this.slots[slotIndex];
    if (!item) return null;
    this.slots[slotIndex] = null;
    return item;
  }

  canAddReviveSlot(): boolean {
    return this.slots.length < this.maxReviveSlots;
  }

  addReviveSlot(): boolean {
    if (!this.canAddReviveSlot()) return false;
    this.slots.push(null);
    return true;
  }
}


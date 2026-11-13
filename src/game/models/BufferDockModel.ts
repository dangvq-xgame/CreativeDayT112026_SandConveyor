import { BalanceConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';
import { toIntAtLeast } from '../../utils/math.utils';

export interface BufferSlotItem {
  colorId: ColorId;
  /** `false` while the screw is still flying towards the slot. */
  landed: boolean;
  /**
   * Unique token of this reservation. Pass it to {@link BufferDockModel.markSlotLanded} so a late
   * landing can never mark a *different* screw that re-used the same slot.
   */
  reservationId: number;
}

/** The temporary screw rack under the conveyor (5 slots, up to 7 with revives). */
export class BufferDockModel {
  readonly maxReviveSlots: number;
  slots: Array<BufferSlotItem | null>;
  private nextReservationId = 1;

  constructor(
    defaultSlots: number = BalanceConfig.bufferDock.defaultSlots,
    maxReviveSlots: number = BalanceConfig.bufferDock.maxReviveSlots
  ) {
    const initial = toIntAtLeast(defaultSlots, 1, BalanceConfig.bufferDock.defaultSlots);
    this.maxReviveSlots = Math.max(initial, toIntAtLeast(maxReviveSlots, 1, initial));
    this.slots = Array.from({ length: initial }, () => null);
  }

  getCapacity(): number {
    return this.slots.length;
  }

  /** Slots holding a screw (landed or in flight). */
  getUsedCount(): number {
    return this.slots.filter((s) => s !== null).length;
  }

  /** Slots holding a screw that has already landed. */
  getLandedCount(): number {
    return this.slots.filter((s) => s !== null && s.landed).length;
  }

  isFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  findFirstEmptySlotIndex(): number {
    return this.slots.findIndex((s) => s === null);
  }

  /** First slot whose screw has `colorId`; `landedOnly` skips screws still in flight. -1 if none. */
  findSlotOfColor(colorId: ColorId, landedOnly = true): number {
    return this.slots.findIndex((s) => s !== null && s.colorId === colorId && (!landedOnly || s.landed));
  }

  /** Reserves an empty slot for a screw in flight. */
  reserveSlot(slotIndex: number, colorId: ColorId): boolean {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.slots.length) return false;
    if (this.slots[slotIndex] !== null) return false;
    this.slots[slotIndex] = { colorId, landed: false, reservationId: this.nextReservationId++ };
    return true;
  }

  /** Reservation token of the screw in `slotIndex`, or `null`. */
  getReservationId(slotIndex: number): number | null {
    return this.slots[slotIndex]?.reservationId ?? null;
  }

  /**
   * Marks the screw in `slotIndex` as landed. When `reservationId` is given, the call is ignored unless
   * it matches the current occupant (the original screw may have been taken by the Hand booster and
   * the slot re-used meanwhile). Returns `true` if a screw was marked.
   */
  markSlotLanded(slotIndex: number, reservationId?: number): boolean {
    const item = this.slots[slotIndex];
    if (!item) return false;
    if (reservationId !== undefined && item.reservationId !== reservationId) return false;
    item.landed = true;
    return true;
  }

  /** Removes and returns the screw in `slotIndex` (landed or in flight). */
  takeScrewAt(slotIndex: number): BufferSlotItem | null {
    const item = this.slots[slotIndex];
    if (!item) return null;
    this.slots[slotIndex] = null;
    return item;
  }

  canAddReviveSlot(): boolean {
    return this.slots.length < this.maxReviveSlots;
  }

  /** Revive: appends one empty slot (up to `maxReviveSlots`). */
  addReviveSlot(): boolean {
    if (!this.canAddReviveSlot()) return false;
    this.slots.push(null);
    return true;
  }
}

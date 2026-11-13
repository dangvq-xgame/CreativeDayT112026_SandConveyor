import { ColorId, SandBucketDef } from '../../types/level.types';

export interface BucketHoleState {
  reserved: boolean;
  landed: boolean;
  landedAtMs: number | null;
  colorId: ColorId | null;
}

export class SandBucketModel {
  readonly id: number;
  readonly colorId: ColorId;
  readonly capacity: number;
  readonly requiredScrews: number;
  readonly holes: BucketHoleState[];
  readonly spawnSeq: number;

  collected = 0;
  /** True once all 3 screws have landed and the lid has unlocked */
  isOpen = false;
  openStartedAtMs: number | null = null;
  completedAtMs: number | null = null;
  waitingForSand = false;
  /** Current visual X position on the linear belt */
  visualX = 0;

  constructor(def: SandBucketDef, spawnSeq: number) {
    this.id = def.id;
    this.colorId = def.colorId;
    this.capacity = def.capacity;
    this.requiredScrews = def.requiredScrews || 3;
    this.spawnSeq = spawnSeq;
    this.holes = Array.from({ length: this.requiredScrews }, () => ({
      reserved: false,
      landed: false,
      landedAtMs: null,
      colorId: null
    }));
  }

  /** Returns the index of the first hole that is neither reserved nor landed, or -1 if all 3 holes are taken. */
  getFirstAvailableHoleIndex(): number {
    if (this.isOpen) return -1;
    return this.holes.findIndex((h) => !h.reserved && !h.landed);
  }

  getMissingScrewsCount(): number {
    if (this.isOpen) return 0;
    return this.holes.filter((h) => !h.reserved && !h.landed).length;
  }

  reserveHole(holeIndex: number, colorId: ColorId): boolean {
    if (holeIndex < 0 || holeIndex >= this.holes.length) return false;
    const h = this.holes[holeIndex];
    if (h.reserved || h.landed) return false;
    h.reserved = true;
    h.colorId = colorId;
    return true;
  }

  landScrewInHole(holeIndex: number, nowMs: number): boolean {
    if (holeIndex < 0 || holeIndex >= this.holes.length) return false;
    const h = this.holes[holeIndex];
    h.reserved = true;
    h.landed = true;
    h.landedAtMs = nowMs;
    h.colorId = this.colorId;

    if (!this.isOpen && this.holes.every((seat) => seat.landed)) {
      this.isOpen = true;
      this.openStartedAtMs = nowMs;
      return true; // Just unlocked!
    }
    return false;
  }

  getPercentage(): number {
    if (this.capacity <= 0) return 100;
    return Math.min(100, Math.round((this.collected / this.capacity) * 100));
  }

  isFull(): boolean {
    return this.collected >= this.capacity;
  }
}


import { BalanceConfig } from '../../config/game.config';
import { ColorId, SandBucketDef } from '../../types/level.types';
import { toIntAtLeast } from '../../utils/math.utils';

/** State of one screw hole on a bucket. A hole is "taken" once reserved (screw in flight) or landed. */
export interface BucketHoleState {
  reserved: boolean;
  landed: boolean;
  landedAtMs: number | null;
  colorId: ColorId | null;
}

/** Percentage shown while a bucket is not full yet (100% is reserved for a really full bucket). */
const MAX_PERCENT_WHILE_FILLING = 99;

/**
 * A sand bucket on the conveyor.
 *
 * Lifecycle: LOCKED (holes filling) → OPEN (all holes landed; `isOpen`) → FILLING (`collected` grows)
 * → COMPLETED (`completedAtMs` set once `collected >= capacity`).
 */
export class SandBucketModel {
  readonly id: number;
  readonly colorId: ColorId;
  /** Sand cells needed to fill the bucket (>= 0). */
  readonly capacity: number;
  /** Screws needed to unlock the lid (>= 1, defaults to `balance.conveyor.holesPerBucket`). */
  readonly requiredScrews: number;
  readonly holes: BucketHoleState[];
  /** Spawn order on the belt (1-based). Older buckets win ties in suction/screw routing. */
  readonly spawnSeq: number;

  /** Sand cells collected so far (0..capacity). */
  collected = 0;
  /** Sand cells visually arrived into the mouth (smoothly catches up as grains land). */
  displayCollected = 0;
  /** True once every hole has a landed screw and the lid has unlocked. */
  isOpen = false;
  openStartedAtMs: number | null = null;
  completedAtMs: number | null = null;
  /** Set by the suction rule when the bucket is open but no sand of its color is reachable. */
  waitingForSand = false;
  /** Current visual X position on the linear belt. */
  visualX = 0;
  /** Smooth entrance offset from the left tunnel when spawned mid-game. */
  spawnEnterOffsetPx = 0;

  constructor(def: SandBucketDef, spawnSeq: number) {
    this.id = def.id;
    this.colorId = def.colorId;
    this.capacity = toIntAtLeast(def.capacity, 0, 0);
    this.requiredScrews = toIntAtLeast(def.requiredScrews, 1, BalanceConfig.conveyor.holesPerBucket);
    this.spawnSeq = spawnSeq;
    this.holes = Array.from({ length: this.requiredScrews }, () => ({
      reserved: false,
      landed: false,
      landedAtMs: null,
      colorId: null
    }));
  }

  /** Index of the first hole that is neither reserved nor landed, or -1 (also -1 once open). */
  getFirstAvailableHoleIndex(): number {
    if (this.isOpen) return -1;
    return this.holes.findIndex((h) => !h.reserved && !h.landed);
  }

  /** Holes still waiting for a screw (not reserved, not landed). 0 once open. */
  getMissingScrewsCount(): number {
    if (this.isOpen) return 0;
    return this.holes.filter((h) => !h.reserved && !h.landed).length;
  }

  /** Holes that are reserved or landed. */
  getTakenHolesCount(): number {
    return this.holes.filter((h) => h.reserved || h.landed).length;
  }

  /** Holes with a screw physically seated. */
  getLandedScrewsCount(): number {
    return this.holes.filter((h) => h.landed).length;
  }

  /** `true` if a screw of `colorId` can be routed here right now. */
  canAcceptScrew(colorId: ColorId): boolean {
    return colorId === this.colorId && this.getFirstAvailableHoleIndex() >= 0;
  }

  /** Reserves a free hole for a screw that is flying in. Fails on open buckets / taken holes. */
  reserveHole(holeIndex: number, colorId: ColorId): boolean {
    if (this.isOpen) return false;
    const h = this.holes[holeIndex];
    if (!Number.isInteger(holeIndex) || !h) return false;
    if (h.reserved || h.landed) return false;
    h.reserved = true;
    h.colorId = colorId;
    return true;
  }

  /**
   * Seats a screw in `holeIndex` (reserved or not). Returns `true` only on the call that unlocks the
   * lid (all holes landed). Landing twice in the same hole is ignored.
   */
  landScrewInHole(holeIndex: number, nowMs: number): boolean {
    const h = this.holes[holeIndex];
    if (!Number.isInteger(holeIndex) || !h || h.landed) return false;
    h.reserved = true;
    h.landed = true;
    h.landedAtMs = nowMs;
    h.colorId = this.colorId;

    if (!this.isOpen && this.holes.every((seat) => seat.landed)) {
      this.isOpen = true;
      this.openStartedAtMs = nowMs;
      return true;
    }
    return false;
  }

  /** `true` once the lid animation finished and sand may flow in. */
  isReadyForSand(nowMs: number, lidOpenReadyDelayMs: number): boolean {
    return (
      this.isOpen &&
      !this.isFull() &&
      this.openStartedAtMs !== null &&
      nowMs - this.openStartedAtMs >= lidOpenReadyDelayMs
    );
  }

  /**
   * Adds up to `amount` sand cells without overflowing. Returns how many were accepted.
   * Stamps `completedAtMs` the first time the bucket becomes full.
   */
  addSand(amount: number, nowMs: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const accepted = Math.min(Math.floor(amount), this.capacity - this.collected);
    if (accepted <= 0) return 0;
    this.collected += accepted;
    this.markCompletedIfFull(nowMs);
    return accepted;
  }

  /** Stamps `completedAtMs` if the bucket is open and full. Returns `true` if it just completed. */
  markCompletedIfFull(nowMs: number): boolean {
    if (!this.isOpen || !this.isFull() || this.completedAtMs !== null) return false;
    this.completedAtMs = nowMs;
    return true;
  }

  /**
   * Fill percentage for the label: `round(collected / capacity * 100)`, but never shows 100 before the
   * bucket is really full (large capacities would otherwise round 99.5% up to 100%).
   * When `useDisplay = true`, uses visually arrived sand count (`displayCollected`).
   */
  getPercentage(useDisplay = false): number {
    if (this.capacity <= 0) return 100;
    const count = useDisplay ? (this.displayCollected || this.collected) : this.collected;
    if (this.isFull() && count >= this.capacity) return 100;
    const pct = Math.round((count / this.capacity) * 100);
    return Math.max(0, Math.min(MAX_PERCENT_WHILE_FILLING, pct));
  }

  isFull(): boolean {
    return this.collected >= this.capacity;
  }

  isCompleted(): boolean {
    return this.completedAtMs !== null;
  }
}

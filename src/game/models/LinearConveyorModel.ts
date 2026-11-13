import { BalanceConfig, GameplayConfig } from '../../config/game.config';
import { ColorId, SandBucketDef } from '../../types/level.types';
import { positiveMod, toIntAtLeast } from '../../utils/math.utils';
import { SandBucketModel } from './SandBucketModel';

/** Where a screw of a given color should go on the belt. */
export interface BucketScrewTarget {
  bucket: SandBucketModel;
  slotIndex: number;
  holeIndex: number;
}

/** A bucket together with the belt slot it occupies. */
export interface SlottedBucket {
  bucket: SandBucketModel;
  slotIndex: number;
}

const TRACK = GameplayConfig.defaultTrack;

/**
 * The linear conveyor: `activeSlots` evenly spaced slots (2 by default, up to `maxActiveSlots` via the
 * ExtraSlot booster) travelling left → right and wrapping around through the tunnels.
 * Buckets come from `queue` (FIFO) into empty active slots.
 */
export class LinearConveyorModel {
  readonly maxActiveSlots: number;
  /** Number of usable slots (`1..maxActiveSlots`). Slots `>= activeSlots` are always empty. */
  activeSlots: number;
  readonly slots: Array<SandBucketModel | null>;
  /** Completed buckets rolling into the right tunnel (visual only, no longer on a slot). */
  readonly leavingBuckets: SandBucketModel[] = [];
  /** Buckets not spawned yet (front = next). */
  readonly queue: SandBucketDef[];
  private spawnCounter = 0;
  private beltTravelDistancePx = 0;

  constructor(
    bucketQueue: SandBucketDef[],
    initialActiveSlots: number = BalanceConfig.conveyor.defaultActiveSlots,
    maxActiveSlots: number = BalanceConfig.conveyor.maxActiveSlots
  ) {
    this.maxActiveSlots = toIntAtLeast(maxActiveSlots, 1, BalanceConfig.conveyor.maxActiveSlots);
    const initial = toIntAtLeast(initialActiveSlots, 1, BalanceConfig.conveyor.defaultActiveSlots);
    this.activeSlots = Math.min(this.maxActiveSlots, initial);
    this.slots = Array.from({ length: this.maxActiveSlots }, () => null);
    this.queue = (Array.isArray(bucketQueue) ? bucketQueue : []).map((b) => ({ ...b }));
  }

  /** Moves the belt. Negative / NaN `dtSec` or multipliers are ignored. */
  advanceBelt(dtSec: number, speedMultiplier = 1): void {
    if (!Number.isFinite(dtSec) || dtSec <= 0) return;
    const mult = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
    this.beltTravelDistancePx += BalanceConfig.conveyor.beltSpeedPxPerSec * mult * dtSec;
  }

  getBeltTravelDistancePx(): number {
    return this.beltTravelDistancePx;
  }

  /**
   * Horizontal X of slot `slotIndex` along the track `[trackStartX .. trackEndX)`, spacing active slots
   * evenly (1 / activeSlots of the span) with the classic belt phase offset.
   */
  getSlotX(slotIndex: number, trackStartX: number = TRACK.startX, trackEndX: number = TRACK.endX): number {
    const span = Math.max(1, trackEndX - trackStartX);
    const count = Math.max(1, this.activeSlots);
    const phaseRatio = (GameplayConfig.slotPhaseOffsetRatio + positiveMod(slotIndex, count) / count) % 1;
    return trackStartX + positiveMod(phaseRatio * span + this.beltTravelDistancePx, span);
  }

  /**
   * Horizontal center X of the fixed Fish Jam Fever bay `slotIndex` (0 .. maxActiveSlots - 1)
   * evenly spaced across the visible conveyor span [visibleMinX .. visibleMaxX].
   * Bay 0 & Bay 1 are unlocked by default; Bay 2 & Bay 3 can be unlocked by the player.
   */
  getBayX(
    slotIndex: number,
    visibleMinX: number = TRACK.visibleMinX,
    visibleMaxX: number = TRACK.visibleMaxX
  ): number {
    const span = Math.max(1, visibleMaxX - visibleMinX);
    const count = Math.max(1, this.maxActiveSlots);
    const idx = positiveMod(slotIndex, count);
    return visibleMinX + ((idx + 0.5) / count) * span;
  }

  /**
   * Spawns waiting buckets from `queue` into empty active slots (0 .. activeSlots - 1).
   * Freshly spawned buckets slide out of the left tunnel (`trackStartX`) to their assigned bay.
   */
  refillSlots(
    trackStartX: number = TRACK.startX,
    trackEndX: number = TRACK.endX,
    visibleMinX: number = TRACK.visibleMinX,
    visibleMaxX: number = TRACK.visibleMaxX,
    forceImmediate = false,
    slideFromTunnel = false
  ): SandBucketModel[] {
    const spawned: SandBucketModel[] = [];
    for (let i = 0; i < this.activeSlots && this.queue.length > 0; i++) {
      if (this.slots[i] !== null) continue;
      const x = this.getSlotX(i, trackStartX, trackEndX);
      const isInTunnel = x <= visibleMinX || x >= visibleMaxX;
      if (!forceImmediate && !isInTunnel) continue;

      const def = this.queue.shift()!;
      const bucket = new SandBucketModel(def, ++this.spawnCounter);
      if (slideFromTunnel && x > visibleMinX) {
        bucket.spawnEnterOffsetPx = x - trackStartX;
        bucket.visualX = trackStartX;
      } else {
        bucket.spawnEnterOffsetPx = 0;
        bucket.visualX = x;
      }
      this.slots[i] = bucket;
      spawned.push(bucket);
    }
    return spawned;
  }

  /** `true` while ExtraSlot can still add a slot. */
  canUnlockExtraSlot(): boolean {
    return this.activeSlots < this.maxActiveSlots;
  }

  /**
   * Booster 1 (ExtraSlot): activeSlots += slotIncrement (capped at maxActiveSlots: 2 → 3 → 4) and
   * immediately fills the new slot from the queue.
   */
  unlockExtraSlot(trackStartX: number = TRACK.startX, trackEndX: number = TRACK.endX): boolean {
    if (!this.canUnlockExtraSlot()) return false;
    const increment = Math.max(1, BalanceConfig.boosters.extraSlot.slotIncrement);
    this.activeSlots = Math.min(this.maxActiveSlots, this.activeSlots + increment);
    this.refillSlots(trackStartX, trackEndX, 0, 0, true);
    return true;
  }

  /**
   * Picks the locked active bucket of `colorId` that should receive the next screw: the one closest to
   * opening (most holes taken), then the oldest (`spawnSeq`). This never splits screws between two
   * same-color buckets (which would delay both lids).
   */
  findTargetBucketForScrew(colorId: ColorId): BucketScrewTarget | null {
    let best: BucketScrewTarget | null = null;
    let bestTaken = -1;
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (!b || b.isOpen || b.colorId !== colorId) continue;
      const holeIndex = b.getFirstAvailableHoleIndex();
      if (holeIndex < 0) continue;
      const taken = b.getTakenHolesCount();
      if (!best || taken > bestTaken || (taken === bestTaken && b.spawnSeq < best.bucket.spawnSeq)) {
        best = { bucket: b, slotIndex: i, holeIndex };
        bestTaken = taken;
      }
    }
    return best;
  }

  /** Locked active buckets that still miss at least one screw (Hand booster targets). */
  getLockedActiveBuckets(): SlottedBucket[] {
    const list: SlottedBucket[] = [];
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (b && !b.isOpen && b.getMissingScrewsCount() > 0) {
        list.push({ bucket: b, slotIndex: i });
      }
    }
    return list;
  }

  /** Buckets currently on active slots (slot order). */
  getActiveBuckets(): SandBucketModel[] {
    const list: SandBucketModel[] = [];
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (b) list.push(b);
    }
    return list;
  }

  /** Buckets still to complete: queued + on the belt and not full. */
  getRemainingBucketCount(): number {
    return this.queue.length + this.getActiveBuckets().filter((b) => !b.isFull()).length;
  }

  /**
   * Per-frame visual update of buckets on the belt: follows their slot X and consumes the
   * slide-in offset of freshly spawned buckets.
   */
  updateBucketPositions(
    dtSec: number,
    trackStartX: number = TRACK.startX,
    trackEndX: number = TRACK.endX,
    slideSpeedPxPerSec: number = GameplayConfig.bucketSpawnSlideSpeedPxPerSec,
    visibleMinX?: number,
    visibleMaxX?: number
  ): void {
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
    const span = Math.max(1, trackEndX - trackStartX);
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (!b) continue;
      if (b.spawnEnterOffsetPx > 0) {
        b.spawnEnterOffsetPx = Math.max(0, b.spawnEnterOffsetPx - slideSpeedPxPerSec * dt);
      }
      if (visibleMinX !== undefined && visibleMaxX !== undefined) {
        const targetX = this.getSlotX(i, trackStartX, trackEndX, visibleMinX, visibleMaxX);
        b.visualX = targetX - b.spawnEnterOffsetPx;
      } else {
        const slotX = this.getSlotX(i, trackStartX, trackEndX);
        b.visualX = trackStartX + positiveMod(slotX - trackStartX - b.spawnEnterOffsetPx, span);
      }
    }
  }

  /**
   * Moves completed buckets (completed for more than `delayMs`) off their slot into `leavingBuckets`,
   * freeing the slot for the next queued bucket. Returns the released buckets.
   */
  releaseCompletedBuckets(nowMs: number, delayMs: number = GameplayConfig.bucketDespawnDelayMs): SandBucketModel[] {
    const released: SandBucketModel[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const b = this.slots[i];
      if (b && b.completedAtMs !== null && nowMs - b.completedAtMs > delayMs) {
        this.slots[i] = null;
        this.leavingBuckets.push(b);
        released.push(b);
      }
    }
    return released;
  }

  /** Rolls leaving buckets to the right; drops those past `exitX`. Returns the removed ones. */
  advanceLeavingBuckets(
    dtSec: number,
    exitX: number,
    speedPxPerSec: number = GameplayConfig.bucketLeaveSpeedPxPerSec
  ): SandBucketModel[] {
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
    const removed: SandBucketModel[] = [];
    for (let i = this.leavingBuckets.length - 1; i >= 0; i--) {
      const lb = this.leavingBuckets[i];
      lb.visualX += speedPxPerSec * dt;
      if (lb.visualX >= exitX) {
        this.leavingBuckets.splice(i, 1);
        removed.push(lb);
      }
    }
    return removed;
  }
}

import { BalanceConfig } from '../../config/game.config';
import { ColorId, SandBucketDef } from '../../types/level.types';
import { SandBucketModel } from './SandBucketModel';

const SLOT_PHASES = [0.14, 0.64, 0.39, 0.89];

export class LinearConveyorModel {
  readonly maxActiveSlots: number;
  activeSlots: number;
  readonly slots: Array<SandBucketModel | null>;
  readonly leavingBuckets: SandBucketModel[] = [];
  readonly queue: SandBucketDef[];
  private spawnCounter = 0;
  private beltTravelDistancePx = 0;

  constructor(
    bucketQueue: SandBucketDef[],
    initialActiveSlots = BalanceConfig.conveyor.defaultActiveSlots,
    maxActiveSlots = BalanceConfig.conveyor.maxActiveSlots
  ) {
    this.maxActiveSlots = maxActiveSlots;
    this.activeSlots = Math.min(maxActiveSlots, Math.max(1, initialActiveSlots));
    this.slots = Array.from({ length: maxActiveSlots }, () => null);
    this.queue = bucketQueue.map((b) => ({ ...b }));
  }

  advanceBelt(dtSec: number, speedMultiplier = 1): void {
    const speed = BalanceConfig.conveyor.beltSpeedPxPerSec * speedMultiplier;
    this.beltTravelDistancePx += speed * dtSec;
  }

  getBeltTravelDistancePx(): number {
    return this.beltTravelDistancePx;
  }

  /**
   * Computes the horizontal X coordinate of slot i along the linear track [trackStartX .. trackEndX].
   */
  getSlotX(slotIndex: number, trackStartX: number, trackEndX: number): number {
    const span = Math.max(1, trackEndX - trackStartX);
    const phaseOffset = (SLOT_PHASES[slotIndex % SLOT_PHASES.length] ?? 0) * span;
    return trackStartX + ((phaseOffset + this.beltTravelDistancePx) % span);
  }

  /**
   * Spawns waiting buckets from queue into empty active slots (0 .. activeSlots - 1).
   */
  refillSlots(
    trackStartX = 0,
    trackEndX = 500,
    visibleMinX = 40,
    visibleMaxX = 460,
    forceImmediate = false
  ): SandBucketModel[] {
    const spawned: SandBucketModel[] = [];
    for (let i = 0; i < this.activeSlots; i++) {
      if (this.slots[i] === null && this.queue.length > 0) {
        const x = this.getSlotX(i, trackStartX, trackEndX);
        const isInTunnel = x <= visibleMinX || x >= visibleMaxX;
        if (forceImmediate || isInTunnel) {
          const def = this.queue.shift()!;
          const bucket = new SandBucketModel(def, ++this.spawnCounter);
          bucket.visualX = x;
          this.slots[i] = bucket;
          spawned.push(bucket);
        }
      }
    }
    return spawned;
  }

  /**
   * Booster 1 (ExtraSlot): Increases activeSlots by +1 up to maxActiveSlots (2 -> 3 -> 4).
   */
  unlockExtraSlot(trackStartX = 0, trackEndX = 500): boolean {
    if (this.activeSlots >= this.maxActiveSlots) return false;
    this.activeSlots++;
    this.refillSlots(trackStartX, trackEndX, 0, 0, true);
    return true;
  }

  /**
   * Finds the first active locked bucket matching colorId that still has an unreserved screw hole.
   */
  findTargetBucketForScrew(
    colorId: ColorId
  ): { bucket: SandBucketModel; slotIndex: number; holeIndex: number } | null {
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (b && !b.isOpen && b.colorId === colorId) {
        const holeIndex = b.getFirstAvailableHoleIndex();
        if (holeIndex >= 0) {
          return { bucket: b, slotIndex: i, holeIndex };
        }
      }
    }
    return null;
  }

  getLockedActiveBuckets(): Array<{ bucket: SandBucketModel; slotIndex: number }> {
    const list: Array<{ bucket: SandBucketModel; slotIndex: number }> = [];
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (b && !b.isOpen && b.getMissingScrewsCount() > 0) {
        list.push({ bucket: b, slotIndex: i });
      }
    }
    return list;
  }

  getActiveBuckets(): SandBucketModel[] {
    const list: SandBucketModel[] = [];
    for (let i = 0; i < this.activeSlots; i++) {
      const b = this.slots[i];
      if (b) list.push(b);
    }
    return list;
  }
}

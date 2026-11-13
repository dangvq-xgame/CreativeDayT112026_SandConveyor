import { BalanceConfig, GameplayConfig } from '../../config/game.config';
import { ColorId, QueueScrewDef } from '../../types/level.types';
import { RandomFn, shuffleInPlace } from '../../utils/random';
import { BufferDockModel } from '../models/BufferDockModel';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { QueueColumnModel } from '../models/QueueColumnModel';
import { SandBucketModel } from '../models/SandBucketModel';
import { ScrewFlightPlan } from './ScrewMatchRule';

/** Result of the Hand booster. */
export interface HandBoosterResult {
  ok: boolean;
  flights: ScrewFlightPlan[];
}

/** Result of the Shuffle booster. */
export interface ShuffleBoosterResult {
  ok: boolean;
  totalScrews: number;
  /** How many column tops ended up matching a priority color. */
  priorityTopMatches?: number;
}

const TRACK = GameplayConfig.defaultTrack;

export class BoosterRule {
  /** `true` if ExtraSlot would add a slot (not at max yet). */
  static canUseExtraSlot(conveyor: LinearConveyorModel): boolean {
    return conveyor.canUnlockExtraSlot();
  }

  /** `true` if at least one locked bucket on the belt still misses screws. */
  static canUseHand(conveyor: LinearConveyorModel): boolean {
    return conveyor.getLockedActiveBuckets().length > 0;
  }

  /** `true` if there are at least 2 screws left in the columns. */
  static canUseShuffle(columns: readonly QueueColumnModel[]): boolean {
    return columns.reduce((acc, c) => acc + c.getItemCount(), 0) >= 2;
  }

  /**
   * Booster 1 (ExtraSlot): Increases active slots on the LinearConveyor by +1 (from default 2 up to max 4).
   */
  static useExtraSlot(
    conveyor: LinearConveyorModel,
    trackStartX: number = TRACK.startX,
    trackEndX: number = TRACK.endX
  ): boolean {
    return conveyor.unlockExtraSlot(trackStartX, trackEndX);
  }

  /**
   * Booster 2 (Hand): fills every missing hole of the selected locked bucket so its lid opens.
   * Screws are taken, per hole, from:
   * 1. a landed BufferDock screw of the bucket color,
   * 2. the shallowest matching screw across all QueueColumns (any depth, mystery included),
   * 3. a BufferDock screw of that color still in flight (its landing is then ignored thanks to the
   *    reservation token),
   * 4. as a last resort (inconsistent data only) a conjured screw flagged `isPhantom`.
   * Returns `ok: false` with no flights if the bucket is open or no hole is missing.
   */
  static useHandOnBucket(
    targetBucket: SandBucketModel,
    targetSlotIndex: number,
    bufferDock: BufferDockModel,
    columns: QueueColumnModel[]
  ): HandBoosterResult {
    if (targetBucket.isOpen) {
      return { ok: false, flights: [] };
    }

    const flights: ScrewFlightPlan[] = [];
    const colorId = targetBucket.colorId;
    const base = { colorId, targetType: 'bucket' as const, targetBucket, targetSlotIndex };

    for (let holeIdx = targetBucket.getFirstAvailableHoleIndex(); holeIdx >= 0; holeIdx = targetBucket.getFirstAvailableHoleIndex()) {
      targetBucket.reserveHole(holeIdx, colorId);

      const landedSlot = bufferDock.findSlotOfColor(colorId, true);
      if (landedSlot >= 0) {
        bufferDock.takeScrewAt(landedSlot);
        flights.push({ ...base, sourceType: 'buffer', sourceIndex: landedSlot, targetHoleIndex: holeIdx });
        continue;
      }

      const fromQueue = BoosterRule.findShallowestScrew(columns, colorId);
      if (fromQueue) {
        fromQueue.column.removeAt(fromQueue.depth);
        flights.push({
          ...base,
          sourceType: 'queue',
          sourceIndex: fromQueue.column.columnIndex,
          sourceDepthIndex: fromQueue.depth,
          targetHoleIndex: holeIdx
        });
        continue;
      }

      const inFlightSlot = bufferDock.findSlotOfColor(colorId, false);
      if (inFlightSlot >= 0) {
        bufferDock.takeScrewAt(inFlightSlot);
        flights.push({ ...base, sourceType: 'buffer', sourceIndex: inFlightSlot, targetHoleIndex: holeIdx });
        continue;
      }

      // Inconsistent data: no screw of this color left anywhere. Still unlock (booster promise).
      flights.push({
        ...base,
        sourceType: 'queue',
        sourceIndex: 0,
        sourceDepthIndex: 0,
        targetHoleIndex: holeIdx,
        isPhantom: true
      });
    }

    return { ok: flights.length > 0, flights };
  }

  /**
   * Booster 3 (Shuffle): collects every screw of the QueueColumns, shuffles them (Fisher–Yates with the
   * injected `rng`) and redistributes them keeping each column's length, while guaranteeing that up to
   * `minPriorityTopMatches` column tops match a *priority color* (`EnsureMinPrioritizeColor`).
   *
   * Priority colors = colors of locked active buckets that still miss screws; if there is none, the
   * color of the next queued bucket. Tops are assigned to colors with remaining demand first (a bucket
   * missing 1 screw gets at most 1 dedicated top before others are served).
   *
   * With fewer than 2 screws the columns are left unchanged and `ok` is `false`.
   */
  static useShuffleWithPriority(
    conveyor: LinearConveyorModel,
    columns: QueueColumnModel[],
    minPriorityTopMatches: number = BalanceConfig.boosters.shuffle.minPriorityTopMatches,
    rng: RandomFn = Math.random
  ): ShuffleBoosterResult {
    const capacities = columns.map((c) => c.getItemCount());
    const totalScrews = capacities.reduce((a, b) => a + b, 0);
    if (totalScrews < 2) {
      return { ok: false, totalScrews };
    }

    const pool: QueueScrewDef[] = [];
    for (const col of columns) pool.push(...col.takeAll());
    shuffleInPlace(pool, rng);

    const demand = BoosterRule.getPriorityDemand(conveyor);

    // Shuffle column order so priority tops appear on varied columns.
    const nonEmptyColIndices = shuffleInPlace(
      capacities.map((cap, idx) => (cap > 0 ? idx : -1)).filter((idx) => idx >= 0),
      rng
    );
    const targetPriorityCount = Math.min(Math.max(0, Math.floor(minPriorityTopMatches)), nonEmptyColIndices.length);
    const topAssignments = new Map<number, QueueScrewDef>();
    for (let k = 0; k < targetPriorityCount; k++) {
      const picked = BoosterRule.takePriorityScrew(pool, demand);
      if (!picked) break;
      picked.isMystery = false;
      topAssignments.set(nonEmptyColIndices[k], picked);
    }

    // Rebuild each column up to its exact previous length.
    for (let c = 0; c < columns.length; c++) {
      const targetLen = capacities[c];
      if (targetLen === 0) continue;
      const items: QueueScrewDef[] = [];
      const top = topAssignments.get(c);
      if (top) items.push(top);
      while (items.length < targetLen && pool.length > 0) items.push(pool.shift()!);
      columns[c].setItems(items);
    }

    const priorityTopMatches = columns.filter((col) => {
      const top = col.peekTop();
      return top !== null && demand.has(top.colorId);
    }).length;
    return { ok: true, totalScrews, priorityTopMatches };
  }

  /** Shallowest screw of `colorId` across columns (ties → leftmost column). */
  private static findShallowestScrew(
    columns: readonly QueueColumnModel[],
    colorId: ColorId
  ): { column: QueueColumnModel; depth: number } | null {
    let best: { column: QueueColumnModel; depth: number } | null = null;
    for (const column of columns) {
      const depth = column.findDepthOfColor(colorId);
      if (depth >= 0 && (!best || depth < best.depth)) best = { column, depth };
    }
    return best;
  }

  /** colorId → screws still needed by locked active buckets (fallback: next queued bucket's color). */
  private static getPriorityDemand(conveyor: LinearConveyorModel): Map<ColorId, number> {
    const demand = new Map<ColorId, number>();
    for (const { bucket } of conveyor.getLockedActiveBuckets()) {
      demand.set(bucket.colorId, (demand.get(bucket.colorId) ?? 0) + bucket.getMissingScrewsCount());
    }
    if (demand.size === 0 && conveyor.queue.length > 0) {
      const next = conveyor.queue[0];
      demand.set(next.colorId, Math.max(1, next.requiredScrews || BalanceConfig.conveyor.holesPerBucket));
    }
    return demand;
  }

  /**
   * Removes from `pool` the first screw of a color that still has demand (decrementing it); if all
   * demand is met, the first screw of any priority color. `null` if the pool has no priority screw.
   */
  private static takePriorityScrew(pool: QueueScrewDef[], demand: Map<ColorId, number>): QueueScrewDef | null {
    let idx = pool.findIndex((s) => (demand.get(s.colorId) ?? 0) > 0);
    if (idx < 0) idx = pool.findIndex((s) => demand.has(s.colorId));
    if (idx < 0) return null;
    const [picked] = pool.splice(idx, 1);
    const left = demand.get(picked.colorId) ?? 0;
    if (left > 0) demand.set(picked.colorId, left - 1);
    return picked;
  }
}

import { BalanceConfig } from '../../config/game.config';
import { ColorId, QueueScrewDef } from '../../types/level.types';
import { BufferDockModel } from '../models/BufferDockModel';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { QueueColumnModel } from '../models/QueueColumnModel';
import { SandBucketModel } from '../models/SandBucketModel';
import { ScrewFlightPlan } from './ScrewMatchRule';

export class BoosterRule {
  /**
   * Booster 1 (ExtraSlot): Increases active slots on the LinearConveyor by +1 (from default 2 up to max 4).
   */
  static useExtraSlot(
    conveyor: LinearConveyorModel,
    trackStartX = 0,
    trackEndX = 500
  ): boolean {
    return conveyor.unlockExtraSlot(trackStartX, trackEndX);
  }

  /**
   * Booster 2 (Hand): Immediately pulls all remaining required matching screws (up to 3)
   * from BufferDock first, then from any depth across QueueColumns, to unlock the selected locked bucket.
   */
  static useHandOnBucket(
    targetBucket: SandBucketModel,
    targetSlotIndex: number,
    bufferDock: BufferDockModel,
    columns: QueueColumnModel[]
  ): { ok: boolean; flights: ScrewFlightPlan[] } {
    if (targetBucket.isOpen) {
      return { ok: false, flights: [] };
    }

    const flights: ScrewFlightPlan[] = [];
    const colorId = targetBucket.colorId;

    while (targetBucket.getFirstAvailableHoleIndex() >= 0) {
      const holeIdx = targetBucket.getFirstAvailableHoleIndex();

      // 1. Check BufferDock first
      let foundInBuffer = -1;
      for (let b = 0; b < bufferDock.slots.length; b++) {
        const s = bufferDock.slots[b];
        if (s && s.landed && s.colorId === colorId) {
          foundInBuffer = b;
          break;
        }
      }

      if (foundInBuffer >= 0) {
        bufferDock.takeScrewAt(foundInBuffer);
        targetBucket.reserveHole(holeIdx, colorId);
        flights.push({
          colorId,
          sourceType: 'buffer',
          sourceIndex: foundInBuffer,
          targetType: 'bucket',
          targetBucket,
          targetSlotIndex,
          targetHoleIndex: holeIdx
        });
        continue;
      }

      // 2. Search across all QueueColumns (preferring shallowest depth)
      let bestColIdx = -1;
      let bestDepthIdx = 9999;
      for (let c = 0; c < columns.length; c++) {
        const idx = columns[c].items.findIndex((it) => it.colorId === colorId);
        if (idx >= 0 && idx < bestDepthIdx) {
          bestDepthIdx = idx;
          bestColIdx = c;
        }
      }

      if (bestColIdx >= 0) {
        const col = columns[bestColIdx];
        col.items.splice(bestDepthIdx, 1);
        col.revealTopIfNeeded();
        targetBucket.reserveHole(holeIdx, colorId);
        flights.push({
          colorId,
          sourceType: 'queue',
          sourceIndex: col.columnIndex,
          sourceDepthIndex: bestDepthIdx,
          targetType: 'bucket',
          targetBucket,
          targetSlotIndex,
          targetHoleIndex: holeIdx
        });
        continue;
      }

      // Fallback if no matching screw exists anywhere (still reserve & fill hole so booster always unlocks)
      targetBucket.reserveHole(holeIdx, colorId);
      flights.push({
        colorId,
        sourceType: 'queue',
        sourceIndex: 0,
        sourceDepthIndex: 0,
        targetType: 'bucket',
        targetBucket,
        targetSlotIndex,
        targetHoleIndex: holeIdx
      });
    }

    return { ok: flights.length > 0, flights };
  }

  /**
   * Booster 3 (Shuffle): Collects all screws across all QueueColumns, and redistributes them
   * while guaranteeing that at least `minPriorityTopMatches` (default 2) top screws (items[0])
   * match the `colorId` of locked buckets currently on the LinearConveyor (`EnsureMinPrioritizeColor`).
   */
  static useShuffleWithPriority(
    conveyor: LinearConveyorModel,
    columns: QueueColumnModel[],
    minPriorityTopMatches = BalanceConfig.boosters.shuffle.minPriorityTopMatches,
    rng: () => number = Math.random
  ): { ok: boolean; totalScrews: number } {
    const capacities = columns.map((c) => c.items.length);
    const pool: QueueScrewDef[] = [];
    for (const col of columns) {
      while (col.items.length > 0) {
        pool.push(col.items.shift()!);
      }
    }

    if (pool.length < 2) {
      // Restore if too few screws
      let idx = 0;
      for (let c = 0; c < columns.length; c++) {
        for (let k = 0; k < capacities[c]; k++) {
          if (idx < pool.length) columns[c].items.push(pool[idx++]);
        }
      }
      return { ok: false, totalScrews: pool.length };
    }

    // Collect priority colorIds from locked buckets currently on the conveyor (or next in queue)
    const priorityColors = new Set<ColorId>();
    for (let i = 0; i < conveyor.activeSlots; i++) {
      const b = conveyor.slots[i];
      if (b && !b.isOpen) {
        priorityColors.add(b.colorId);
      }
    }
    if (priorityColors.size === 0 && conveyor.queue.length > 0) {
      priorityColors.add(conveyor.queue[0].colorId);
    }

    // Fisher-Yates shuffle the pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Separate up to `minPriorityTopMatches` priority screws to place at the top (items[0]) of non-empty columns
    const nonEmptyColIndices = columns
      .map((_, idx) => idx)
      .filter((idx) => capacities[idx] > 0);
    // Shuffle column order so priority tops appear on varied columns
    for (let i = nonEmptyColIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [nonEmptyColIndices[i], nonEmptyColIndices[j]] = [
        nonEmptyColIndices[j],
        nonEmptyColIndices[i]
      ];
    }

    const targetPriorityCount = Math.min(minPriorityTopMatches, nonEmptyColIndices.length);
    const topAsignments = new Map<number, QueueScrewDef>();

    for (let k = 0; k < targetPriorityCount; k++) {
      const pIdx = pool.findIndex((s) => priorityColors.has(s.colorId));
      if (pIdx >= 0) {
        const [picked] = pool.splice(pIdx, 1);
        picked.isMystery = false;
        topAsignments.set(nonEmptyColIndices[k], picked);
      }
    }

    // Rebuild each column up to its exact previous length
    for (let c = 0; c < columns.length; c++) {
      const targetLen = capacities[c];
      if (targetLen === 0) continue;

      if (topAsignments.has(c)) {
        columns[c].items.push(topAsignments.get(c)!);
      }
      while (columns[c].items.length < targetLen && pool.length > 0) {
        columns[c].items.push(pool.shift()!);
      }
      columns[c].revealTopIfNeeded();
    }

    return { ok: true, totalScrews: capacities.reduce((a, b) => a + b, 0) };
  }
}


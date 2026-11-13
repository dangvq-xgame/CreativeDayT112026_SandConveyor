import { ColorId } from '../../types/level.types';
import { BufferDockModel } from '../models/BufferDockModel';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { QueueColumnModel } from '../models/QueueColumnModel';
import { SandBucketModel } from '../models/SandBucketModel';

/** Describes one screw flight for the view layer (source → target). The model is already updated. */
export interface ScrewFlightPlan {
  colorId: ColorId;
  sourceType: 'queue' | 'buffer';
  /** Column index (queue) or buffer slot index (buffer). */
  sourceIndex: number;
  /** Depth in the column the screw came from (0 = top). */
  sourceDepthIndex?: number;
  targetType: 'bucket' | 'buffer';
  targetBucket?: SandBucketModel;
  /** Conveyor slot (bucket target) or buffer slot (buffer target). */
  targetSlotIndex: number;
  targetHoleIndex?: number;
  /**
   * Buffer target only: reservation token to pass to `BufferDockModel.markSlotLanded(slot, id)` when
   * the flight lands.
   */
  bufferReservationId?: number;
  /**
   * Hand booster only: no real screw of this color was left anywhere, so the hole was filled with a
   * conjured screw (only happens with inconsistent level data).
   */
  isPhantom?: boolean;
}

/** Result of tapping a queue column. */
export interface PopColumnResult {
  ok: boolean;
  /** `true` = buffer full and no bucket accepts the screw → lose / revive. */
  outOfSpace: boolean;
  flight?: ScrewFlightPlan;
}

/** Where the top screw of a column would go if tapped now. */
export type ScrewRoute = 'bucket' | 'buffer' | 'out_of_space' | 'empty';

export class ScrewMatchRule {
  /** Predicts the outcome of {@link popColumnTop} without changing anything. */
  static predictRoute(
    column: QueueColumnModel,
    conveyor: LinearConveyorModel,
    bufferDock: BufferDockModel
  ): ScrewRoute {
    const top = column.peekTop();
    if (!top) return 'empty';
    if (conveyor.findTargetBucketForScrew(top.colorId)) return 'bucket';
    return bufferDock.findFirstEmptySlotIndex() >= 0 ? 'buffer' : 'out_of_space';
  }

  /**
   * Pops the top screw of `column` and routes it to:
   * 1. a locked bucket of the same color with a free hole (see `findTargetBucketForScrew`), or
   * 2. the first empty BufferDock slot.
   * If neither is possible the column is left untouched, `lastBonkTimeMs` is stamped and
   * `{ ok: false, outOfSpace: true }` is returned (lose condition).
   */
  static popColumnTop(
    column: QueueColumnModel,
    conveyor: LinearConveyorModel,
    bufferDock: BufferDockModel,
    nowMs: number
  ): PopColumnResult {
    const top = column.peekTop();
    if (!top) {
      return { ok: false, outOfSpace: false };
    }

    const bucketMatch = conveyor.findTargetBucketForScrew(top.colorId);
    if (bucketMatch) {
      column.popTop(nowMs);
      bucketMatch.bucket.reserveHole(bucketMatch.holeIndex, top.colorId);
      return {
        ok: true,
        outOfSpace: false,
        flight: {
          colorId: top.colorId,
          sourceType: 'queue',
          sourceIndex: column.columnIndex,
          sourceDepthIndex: 0,
          targetType: 'bucket',
          targetBucket: bucketMatch.bucket,
          targetSlotIndex: bucketMatch.slotIndex,
          targetHoleIndex: bucketMatch.holeIndex
        }
      };
    }

    const emptyBufIdx = bufferDock.findFirstEmptySlotIndex();
    if (emptyBufIdx < 0) {
      column.lastBonkTimeMs = nowMs;
      return { ok: false, outOfSpace: true };
    }

    column.popTop(nowMs);
    bufferDock.reserveSlot(emptyBufIdx, top.colorId);
    return {
      ok: true,
      outOfSpace: false,
      flight: {
        colorId: top.colorId,
        sourceType: 'queue',
        sourceIndex: column.columnIndex,
        sourceDepthIndex: 0,
        targetType: 'buffer',
        targetSlotIndex: emptyBufIdx,
        bufferReservationId: bufferDock.getReservationId(emptyBufIdx) ?? undefined
      }
    };
  }

  /**
   * Sends every *landed* BufferDock screw that now has a matching locked bucket (e.g. a newly spawned
   * one) up to that bucket. Screws still in flight are left alone until they land.
   */
  static flushBufferToConveyor(
    conveyor: LinearConveyorModel,
    bufferDock: BufferDockModel
  ): ScrewFlightPlan[] {
    const plans: ScrewFlightPlan[] = [];
    for (let b = 0; b < bufferDock.slots.length; b++) {
      const slot = bufferDock.slots[b];
      if (!slot || !slot.landed) continue;

      const match = conveyor.findTargetBucketForScrew(slot.colorId);
      if (match) {
        bufferDock.takeScrewAt(b);
        match.bucket.reserveHole(match.holeIndex, slot.colorId);
        plans.push({
          colorId: slot.colorId,
          sourceType: 'buffer',
          sourceIndex: b,
          targetType: 'bucket',
          targetBucket: match.bucket,
          targetSlotIndex: match.slotIndex,
          targetHoleIndex: match.holeIndex
        });
      }
    }
    return plans;
  }

  /**
   * `true` when at least one column can be tapped without losing (its top goes to a bucket or there is
   * buffer room). `false` means every possible tap is a lose — useful for a "no moves" hint.
   */
  static hasSafeMove(
    columns: readonly QueueColumnModel[],
    conveyor: LinearConveyorModel,
    bufferDock: BufferDockModel
  ): boolean {
    return columns.some((col) => {
      const route = ScrewMatchRule.predictRoute(col, conveyor, bufferDock);
      return route === 'bucket' || route === 'buffer';
    });
  }
}

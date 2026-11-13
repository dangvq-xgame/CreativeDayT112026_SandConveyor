import { ColorId } from '../../types/level.types';
import { BufferDockModel } from '../models/BufferDockModel';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { QueueColumnModel } from '../models/QueueColumnModel';
import { SandBucketModel } from '../models/SandBucketModel';

export interface ScrewFlightPlan {
  colorId: ColorId;
  sourceType: 'queue' | 'buffer';
  sourceIndex: number;
  sourceDepthIndex?: number;
  targetType: 'bucket' | 'buffer';
  targetBucket?: SandBucketModel;
  targetSlotIndex: number;
  targetHoleIndex?: number;
}

export class ScrewMatchRule {
  /**
   * Attempts to pop the top screw from a QueueColumn and route it to either:
   * 1) A matching locked bucket on the LinearConveyor (if one has an open hole), or
   * 2) The first empty slot in BufferDock.
   * If BufferDock is full and no bucket matches, returns `{ ok: false, outOfSpace: true }`.
   */
  static popColumnTop(
    column: QueueColumnModel,
    conveyor: LinearConveyorModel,
    bufferDock: BufferDockModel,
    nowMs: number
  ): { ok: boolean; outOfSpace: boolean; flight?: ScrewFlightPlan } {
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
        targetSlotIndex: emptyBufIdx
      }
    };
  }

  /**
   * Checks if any landed screws sitting in BufferDock can now fly up into newly spawned buckets on the conveyor.
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
}


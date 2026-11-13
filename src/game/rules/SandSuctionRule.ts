import { ColorId } from '../../types/level.types';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { SandBoardModel } from '../models/SandBoardModel';
import { SandBucketModel } from '../models/SandBucketModel';

export interface SandDrainEvent {
  bucket: SandBucketModel;
  slotIndex: number;
  col: number;
  row: number;
  colorId: ColorId;
  bucketCompleted: boolean;
}

export class SandSuctionRule {
  /**
   * Checks open buckets on the conveyor (sorted by spawnSeq) and pulls 1 matching bottom cell from SandBoard.
   */
  static stepSuction(
    board: SandBoardModel,
    conveyor: LinearConveyorModel,
    nowMs: number,
    lidOpenReadyDelayMs = 630,
    cellSizePx = 20,
    boardLeftX = 60
  ): SandDrainEvent | null {
    const openCandidates: Array<{ bucket: SandBucketModel; slotIndex: number }> = [];
    for (let i = 0; i < conveyor.activeSlots; i++) {
      const b = conveyor.slots[i];
      if (
        b &&
        b.isOpen &&
        !b.isFull() &&
        b.openStartedAtMs !== null &&
        nowMs - b.openStartedAtMs >= lidOpenReadyDelayMs
      ) {
        openCandidates.push({ bucket: b, slotIndex: i });
      }
    }

    if (openCandidates.length === 0) return null;
    openCandidates.sort((a, b) => a.bucket.spawnSeq - b.bucket.spawnSeq);

    for (const cand of openCandidates) {
      const preferredCol = Math.round((cand.bucket.visualX - boardLeftX) / Math.max(1, cellSizePx));
      const pulled = board.pullBottomCellOfColor(cand.bucket.colorId, cellSizePx, preferredCol);
      if (!pulled) {
        cand.bucket.waitingForSand = true;
        continue;
      }

      cand.bucket.waitingForSand = false;
      cand.bucket.collected++;
      let completed = false;
      if (cand.bucket.isFull() && cand.bucket.completedAtMs === null) {
        cand.bucket.completedAtMs = nowMs;
        completed = true;
      }

      return {
        bucket: cand.bucket,
        slotIndex: cand.slotIndex,
        col: pulled.col,
        row: pulled.row,
        colorId: pulled.colorId,
        bucketCompleted: completed
      };
    }

    return null;
  }
}


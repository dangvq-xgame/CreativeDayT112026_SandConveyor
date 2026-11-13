import { GameplayConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';
import { LinearConveyorModel, SlottedBucket } from '../models/LinearConveyorModel';
import { SandBoardModel } from '../models/SandBoardModel';
import { SandBucketModel } from '../models/SandBucketModel';
import { clamp } from '../../utils/math.utils';

/** One sand cell drained into a bucket. */
export interface SandDrainEvent {
  bucket: SandBucketModel;
  slotIndex: number;
  col: number;
  row: number;
  colorId: ColorId;
  /** `true` on the drain that filled the bucket (play the "bucket done" feedback). */
  bucketCompleted: boolean;
}

export class SandSuctionRule {
  /**
   * Board column under a bucket (used as a tie-breaker so sand flows from right above it).
   * The column containing `visualX`, clamped to the board.
   */
  static getPreferredColumn(
    bucketVisualX: number,
    boardLeftX: number,
    cellSizePx: number,
    boardWidth: number
  ): number {
    const col = Math.floor((bucketVisualX - boardLeftX) / Math.max(1, cellSizePx));
    return clamp(col, 0, Math.max(0, boardWidth - 1));
  }

  /** Open, not-full buckets whose lid animation is over, in suction priority order. */
  static getSuctionCandidates(
    conveyor: LinearConveyorModel,
    nowMs: number,
    lidOpenReadyDelayMs: number = GameplayConfig.lidOpenReadyDelayMs
  ): SlottedBucket[] {
    const list: SlottedBucket[] = [];
    for (let i = 0; i < conveyor.activeSlots; i++) {
      const b = conveyor.slots[i];
      if (b && b.isReadyForSand(nowMs, lidOpenReadyDelayMs)) list.push({ bucket: b, slotIndex: i });
    }
    // Partially-filled buckets first so two open buckets of one color never split the sand,
    // then the oldest bucket.
    list.sort((a, b) => b.bucket.collected - a.bucket.collected || a.bucket.spawnSeq - b.bucket.spawnSeq);
    return list;
  }

  /**
   * Drains at most ONE sand cell into the highest-priority ready bucket that has reachable sand of its
   * color. Buckets without reachable sand get `waitingForSand = true`. Also completes open buckets that
   * are already full (e.g. capacity 0) so they can leave the belt.
   */
  static stepSuction(
    board: SandBoardModel,
    conveyor: LinearConveyorModel,
    nowMs: number,
    lidOpenReadyDelayMs: number = GameplayConfig.lidOpenReadyDelayMs,
    cellSizePx: number = GameplayConfig.defaultCellSizePx,
    boardLeftX: number = GameplayConfig.defaultBoardLeftX,
    allowBuriedFallback = false
  ): SandDrainEvent | null {
    for (const b of conveyor.getActiveBuckets()) {
      b.markCompletedIfFull(nowMs);
    }

    const candidates = SandSuctionRule.getSuctionCandidates(conveyor, nowMs, lidOpenReadyDelayMs);

    // Strictly exposed surface sand (closest to the bucket mouth first).
    // When sand is blocked by another color, the bucket stops and waits ("ngung").
    // When blocking sand is cleared and gravity drops this color, it resumes ("chay tiep").
    for (const cand of candidates) {
      if (cand.bucket.spawnEnterOffsetPx > 0) continue;

      const preferredCol = SandSuctionRule.getPreferredColumn(
        cand.bucket.visualX,
        boardLeftX,
        cellSizePx,
        board.width
      );
      const pulled = board.pullBottomCellOfColor(cand.bucket.colorId, cellSizePx, preferredCol, false);
      if (!pulled) {
        cand.bucket.waitingForSand = true;
        continue;
      }

      cand.bucket.waitingForSand = false;
      cand.bucket.collected++;
      const completed = cand.bucket.markCompletedIfFull(nowMs);
      return {
        bucket: cand.bucket,
        slotIndex: cand.slotIndex,
        col: pulled.col,
        row: pulled.row,
        colorId: pulled.colorId,
        bucketCompleted: completed
      };
    }

    // Fallback only if explicitly enabled (e.g. validator / bot solver)
    if (allowBuriedFallback) {
      for (const cand of candidates) {
        if (cand.bucket.spawnEnterOffsetPx > 0) continue;
        const preferredCol = SandSuctionRule.getPreferredColumn(
          cand.bucket.visualX,
          boardLeftX,
          cellSizePx,
          board.width
        );
        const pulled = board.pullBottomCellOfColor(cand.bucket.colorId, cellSizePx, preferredCol, true);
        if (pulled) {
          cand.bucket.waitingForSand = false;
          cand.bucket.collected++;
          const completed = cand.bucket.markCompletedIfFull(nowMs);
          return {
            bucket: cand.bucket,
            slotIndex: cand.slotIndex,
            col: pulled.col,
            row: pulled.row,
            colorId: pulled.colorId,
            bucketCompleted: completed
          };
        }
      }
    }

    return null;
  }
}

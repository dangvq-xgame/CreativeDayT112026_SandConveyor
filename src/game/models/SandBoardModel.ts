import { GameConfig, GameplayConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';
import { toIntAtLeast } from '../../utils/math.utils';

export interface SandCell {
  colorId: ColorId;
  /** Original row index (0 .. height-1) so lower strata always drain before upper strata */
  originY: number;
  /** Vertical pixel offset for smooth gravity falling animation (negative while falling down to 0) */
  offsetY: number;
  velocityY: number;
}

/** A cell picked for suction. */
export interface SandPullResult {
  col: number;
  row: number;
  colorId: ColorId;
}

interface PullCandidate {
  col: number;
  row: number;
  originY: number;
  dist: number;
}

function isSandColor(value: unknown): value is ColorId {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * The sand picture. `cells[y][x]` (y = 0 is the top row, `height - 1` the bottom row touching the belt).
 * Sand is pulled from the bottom of a column and everything above falls down one row (gravity).
 */
export class SandBoardModel {
  readonly width: number;
  readonly height: number;
  readonly subDivision: number;
  /** Always exactly `height` rows × `width` columns, whatever the shape of the source grid. */
  readonly cells: Array<Array<SandCell | null>>;
  readonly totalInitialCells: number;
  private drainedCells = 0;

  /**
   * @param grid Row-major colorIds (`0` = empty). Rows/columns missing from `grid` are treated as empty,
   *             extra ones are ignored, and invalid values (negative, non-integer, NaN) become empty.
   */
  constructor(width: number, height: number, subDivision: number, grid: ColorId[][]) {
    this.width = toIntAtLeast(width, 0, 0);
    this.height = toIntAtLeast(height, 0, 0);
    this.subDivision = toIntAtLeast(subDivision, 1, GameplayConfig.defaultSubDivision);
    let count = 0;
    this.cells = Array.from({ length: this.height }, (_, y) => {
      const row = Array.isArray(grid?.[y]) ? grid[y] : [];
      return Array.from({ length: this.width }, (_, x): SandCell | null => {
        const cid = row[x];
        if (!isSandColor(cid)) return null;
        count++;
        return { colorId: cid, originY: y, offsetY: 0, velocityY: 0 };
      });
    });
    this.totalInitialCells = count;
  }

  getDrainedCells(): number {
    return this.drainedCells;
  }

  getRemainingCells(): number {
    return this.totalInitialCells - this.drainedCells;
  }

  /** Drained ratio in `[0, 1]` (an empty board counts as fully drained). */
  getProgressRatio(): number {
    return this.totalInitialCells > 0 ? this.drainedCells / this.totalInitialCells : 1;
  }

  /** `true` once every sand cell has been drained. */
  isCleared(): boolean {
    return this.getRemainingCells() <= 0;
  }

  /** Cell at (x, y) or `null` if empty / out of bounds. */
  getCell(x: number, y: number): SandCell | null {
    return this.cells[y]?.[x] ?? null;
  }

  /** Remaining cells of `colorId` anywhere on the board. */
  countCellsOfColor(colorId: ColorId): number {
    let n = 0;
    for (const row of this.cells) {
      for (const cell of row) {
        if (cell && cell.colorId === colorId) n++;
      }
    }
    return n;
  }

  /** Remaining cell count per colorId. */
  getRemainingColorCounts(): Map<ColorId, number> {
    const out = new Map<ColorId, number>();
    for (const row of this.cells) {
      for (const cell of row) {
        if (cell) out.set(cell.colorId, (out.get(cell.colorId) ?? 0) + 1);
      }
    }
    return out;
  }

  /** `true` when no cell is still falling (all offsets settled at 0). */
  isSettled(): boolean {
    return this.cells.every((row) => row.every((cell) => !cell || cell.offsetY >= 0));
  }

  /**
   * Returns the lowest non-empty row index y in column x (from height-1 down to 0), or -1 if column is empty.
   */
  getLowestRow(x: number): number {
    if (x < 0 || x >= this.width) return -1;
    for (let y = this.height - 1; y >= 0; y--) {
      if (this.cells[y][x] !== null) return y;
    }
    return -1;
  }

  /**
   * Picks (without removing) the cell `pullBottomCellOfColor` would drain, or `null`.
   *
   * 1. Columns whose bottom-most cell has `colorId`, prioritizing proximity to `preferredColX` (funnel zones),
   *    then lowest current row, then closer column distance. Sand flows from directly above/near the bucket!
   * 2. If no column exposes `colorId` at its bottom, returns `null` so the bucket waits for blocking sand
   *    to drain and gravity to drop its color down ("ngung" / "chay tiep").
   *    Only if `allowBuriedFallback = true` (last-resort safety) will it search buried cells.
   */
  findPullCandidate(
    colorId: ColorId,
    preferredColX?: number,
    allowBuriedFallback = false
  ): SandPullResult | null {
    const distOf = (x: number): number => (preferredColX !== undefined ? Math.abs(x - preferredColX) : x);
    const candidates: PullCandidate[] = [];
    for (let x = 0; x < this.width; x++) {
      const y = this.getLowestRow(x);
      const cell = y >= 0 ? this.cells[y][x] : null;
      if (cell && cell.colorId === colorId) {
        candidates.push({ col: x, row: y, originY: cell.originY, dist: distOf(x) });
      }
    }

    if (candidates.length === 0 && allowBuriedFallback) {
      for (let x = 0; x < this.width; x++) {
        for (let y = this.height - 1; y >= 0; y--) {
          const cell = this.cells[y][x];
          if (cell && cell.colorId === colorId) {
            candidates.push({ col: x, row: y, originY: cell.originY, dist: distOf(x) });
            break; // Only the lowest matching cell in this column
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (compareCandidates(candidates[i], best) < 0) best = candidates[i];
    }
    return { col: best.col, row: best.row, colorId };
  }

  /**
   * Drains one cell of `colorId` (see {@link findPullCandidate}) and lets the column above fall by one
   * row (cells get a negative `offsetY` of one cell so {@link updateGravity} can animate the fall).
   */
  pullBottomCellOfColor(
    colorId: ColorId,
    cellSizePx: number = GameplayConfig.defaultCellSizePx,
    preferredColX?: number,
    allowBuriedFallback = true
  ): SandPullResult | null {
    const chosen = this.findPullCandidate(colorId, preferredColX, allowBuriedFallback);
    if (!chosen) return null;
    this.removeCellAndCollapse(chosen.col, chosen.row, cellSizePx);
    return chosen;
  }

  /** Advances the falling animation. Invalid / non-positive `dtSec` is ignored. */
  updateGravity(dtSec: number, gravityPxPerSecSq: number = GameConfig.gravityPxPerSecSq): void {
    if (!Number.isFinite(dtSec) || dtSec <= 0) return;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell && cell.offsetY < 0) {
          cell.velocityY += gravityPxPerSecSq * dtSec;
          cell.offsetY = Math.min(0, cell.offsetY + cell.velocityY * dtSec);
          if (cell.offsetY === 0) {
            cell.velocityY = 0;
          }
        }
      }
    }
  }

  private removeCellAndCollapse(col: number, row: number, cellSizePx: number): void {
    for (let yy = row; yy > 0; yy--) {
      const above = this.cells[yy - 1][col];
      this.cells[yy][col] = above;
      if (above) above.offsetY -= cellSizePx;
    }
    this.cells[0][col] = null;
    this.drainedCells++;
  }
}

/**
 * Prioritizes proximity to the bucket mouth (column distance),
 * then lowest row (bottom-most exposed cell),
 * then lower origin stratum, then leftmost column.
 */
function compareCandidates(a: PullCandidate, b: PullCandidate): number {
  if (a.dist !== b.dist) return a.dist - b.dist;
  if (b.row !== a.row) return b.row - a.row;
  if (b.originY !== a.originY) return b.originY - a.originY;
  return a.col - b.col;
}

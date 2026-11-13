import { ColorId } from '../../types/level.types';

export interface SandCell {
  colorId: ColorId;
  /** Vertical pixel offset for smooth gravity falling animation (negative while falling down to 0) */
  offsetY: number;
  velocityY: number;
}

export class SandBoardModel {
  readonly width: number;
  readonly height: number;
  readonly subDivision: number;
  readonly cells: Array<Array<SandCell | null>>;
  readonly totalInitialCells: number;
  private drainedCells = 0;

  constructor(width: number, height: number, subDivision: number, grid: ColorId[][]) {
    this.width = width;
    this.height = height;
    this.subDivision = subDivision;
    let count = 0;
    this.cells = grid.map((row) =>
      row.map((cid) => {
        if (cid > 0) {
          count++;
          return { colorId: cid, offsetY: 0, velocityY: 0 };
        }
        return null;
      })
    );
    this.totalInitialCells = count;
  }

  getDrainedCells(): number {
    return this.drainedCells;
  }

  getRemainingCells(): number {
    return this.totalInitialCells - this.drainedCells;
  }

  getProgressRatio(): number {
    return this.totalInitialCells > 0 ? this.drainedCells / this.totalInitialCells : 1;
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
   * Finds a column whose bottom-most cell has matching colorId, preferring columns closest to preferredColX.
   * Removes that cell and shifts all cells above it in that column down by 1 row (applying cellSizePx to offsetY).
   */
  pullBottomCellOfColor(
    colorId: ColorId,
    cellSizePx = 20,
    preferredColX?: number
  ): { col: number; row: number; colorId: ColorId } | null {
    const candidates: Array<{ col: number; row: number; dist: number }> = [];
    for (let x = 0; x < this.width; x++) {
      const y = this.getLowestRow(x);
      if (y >= 0 && this.cells[y][x]?.colorId === colorId) {
        const dist = preferredColX !== undefined ? Math.abs(x - preferredColX) : x;
        candidates.push({ col: x, row: y, dist });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist || a.col - b.col);
    const chosen = candidates[0];
    const { col, row } = chosen;

    // Shift column down via gravity
    for (let yy = row; yy > 0; yy--) {
      this.cells[yy][col] = this.cells[yy - 1][col];
      const cell = this.cells[yy][col];
      if (cell) {
        cell.offsetY -= cellSizePx;
      }
    }
    this.cells[0][col] = null;
    this.drainedCells++;

    return { col, row, colorId };
  }

  updateGravity(dtSec: number, gravityPxPerSecSq = 2400): void {
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
}


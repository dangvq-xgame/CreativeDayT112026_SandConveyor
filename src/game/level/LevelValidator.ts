import { ColorId, LevelData } from '../../types/level.types';

export interface LevelValidationResult {
  valid: boolean;
  errors: string[];
}

export class LevelValidator {
  static validate(level: LevelData): LevelValidationResult {
    const errors: string[] = [];
    const { width, height, grid } = level.sandBoard;

    if (grid.length !== height) {
      errors.push(`Grid height ${grid.length} !== sandBoard.height ${height}`);
    }

    const sandCounts = new Map<ColorId, number>();
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      if (row.length !== width) {
        errors.push(`Row ${y} width ${row.length} !== sandBoard.width ${width}`);
      }
      for (const cid of row) {
        if (!Number.isInteger(cid) || cid < 0) {
          errors.push(`Invalid colorId ${cid} at row ${y}`);
        }
        if (cid > 0) {
          sandCounts.set(cid, (sandCounts.get(cid) ?? 0) + 1);
        }
      }
    }

    const bucketCaps = new Map<ColorId, number>();
    const bucketCounts = new Map<ColorId, number>();
    for (const b of level.bucketQueue) {
      if (!Number.isInteger(b.colorId) || b.colorId <= 0) {
        errors.push(`Invalid bucket colorId ${b.colorId}`);
      }
      bucketCaps.set(b.colorId, (bucketCaps.get(b.colorId) ?? 0) + b.capacity);
      bucketCounts.set(b.colorId, (bucketCounts.get(b.colorId) ?? 0) + 1);
    }

    const screwCounts = new Map<ColorId, number>();
    for (const col of level.queueColumns) {
      for (const s of col.items) {
        if (!Number.isInteger(s.colorId) || s.colorId <= 0) {
          errors.push(`Invalid screw colorId ${s.colorId}`);
        }
        screwCounts.set(s.colorId, (screwCounts.get(s.colorId) ?? 0) + 1);
      }
    }

    for (const [cid, sandTotal] of sandCounts.entries()) {
      const capTotal = bucketCaps.get(cid) ?? 0;
      if (sandTotal !== capTotal) {
        errors.push(`colorId ${cid}: sand cells (${sandTotal}) !== bucket capacity (${capTotal})`);
      }
      const bCount = bucketCounts.get(cid) ?? 0;
      const sCount = screwCounts.get(cid) ?? 0;
      if (sCount !== bCount * 3) {
        errors.push(`colorId ${cid}: screws (${sCount}) !== 3 * buckets (${bCount * 3})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}


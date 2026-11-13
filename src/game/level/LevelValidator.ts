import { BalanceConfig } from '../../config/game.config';
import { ColorId, LevelData } from '../../types/level.types';

export interface LevelValidationResult {
  valid: boolean;
  errors: string[];
}

export interface LevelValidationOptions {
  /** Palette colorIds. When given, every color used by the level must be in it. */
  knownColorIds?: Iterable<ColorId>;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function addCount(map: Map<ColorId, number>, key: ColorId, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n);
}

/**
 * Static checks of a level file. Never throws, even on garbage input.
 *
 * Checks: header fields, conveyor config, grid shape & colorIds, bucket fields (capacity >= 1,
 * requiredScrews >= 1, unique ids), queue columns, palette membership (optional) and, for EVERY color
 * used anywhere: `sand cells === Σ bucket capacity` and `screws === Σ bucket requiredScrews`.
 */
export class LevelValidator {
  static validate(level: LevelData | unknown, options: LevelValidationOptions = {}): LevelValidationResult {
    const errors: string[] = [];
    if (!isObj(level)) {
      return { valid: false, errors: ['Level is not an object'] };
    }
    const known = options.knownColorIds ? new Set(options.knownColorIds) : null;
    const checkColor = (cid: unknown, where: string, allowZero = false): cid is ColorId => {
      const ok = allowZero ? isNonNegInt(cid) : isPosInt(cid);
      if (!ok) {
        errors.push(`Invalid colorId ${String(cid)} at ${where}`);
        return false;
      }
      if (known && (cid as number) > 0 && !known.has(cid as number)) {
        errors.push(`colorId ${cid} at ${where} is not in the palette`);
      }
      return true;
    };

    // Header
    if (level.version !== 1) errors.push(`Unsupported version ${String(level.version)} (expected 1)`);
    if (!isPosInt(level.levelId)) errors.push(`levelId must be a positive integer (got ${String(level.levelId)})`);
    if (!isNonNegInt(level.rewardCoins)) errors.push(`rewardCoins must be an integer >= 0`);

    // Conveyor config
    const cc = level.conveyorConfig;
    if (!isObj(cc)) {
      errors.push('conveyorConfig is missing');
    } else {
      if (!isPosInt(cc.initialActiveSlots)) errors.push('conveyorConfig.initialActiveSlots must be >= 1');
      if (!isPosInt(cc.maxActiveSlots)) errors.push('conveyorConfig.maxActiveSlots must be >= 1');
      if (isPosInt(cc.initialActiveSlots) && isPosInt(cc.maxActiveSlots) && cc.initialActiveSlots > cc.maxActiveSlots) {
        errors.push('conveyorConfig.initialActiveSlots must be <= maxActiveSlots');
      }
      if (!isPosInt(cc.bufferSlots)) errors.push('conveyorConfig.bufferSlots must be >= 1');
    }

    // Sand board
    const sandCounts = new Map<ColorId, number>();
    const board = level.sandBoard;
    if (!isObj(board) || !Array.isArray(board.grid)) {
      errors.push('sandBoard.grid is missing');
    } else {
      const { width, height, grid } = board as { width: unknown; height: unknown; grid: unknown[] };
      if (!isPosInt(width)) errors.push(`sandBoard.width must be a positive integer`);
      if (!isPosInt(height)) errors.push(`sandBoard.height must be a positive integer`);
      if (board.subDivision !== undefined && !isPosInt(board.subDivision)) {
        errors.push('sandBoard.subDivision must be a positive integer');
      }
      if (grid.length !== height) errors.push(`Grid height ${grid.length} !== sandBoard.height ${String(height)}`);
      grid.forEach((row, y) => {
        if (!Array.isArray(row)) {
          errors.push(`Row ${y} is not an array`);
          return;
        }
        if (row.length !== width) errors.push(`Row ${y} width ${row.length} !== sandBoard.width ${String(width)}`);
        row.forEach((cid, x) => {
          if (checkColor(cid, `grid[${y}][${x}]`, true) && cid > 0) addCount(sandCounts, cid, 1);
        });
      });
    }

    // Buckets
    const bucketCaps = new Map<ColorId, number>();
    const bucketScrews = new Map<ColorId, number>();
    const bucketIds = new Set<unknown>();
    if (!Array.isArray(level.bucketQueue) || level.bucketQueue.length === 0) {
      errors.push('bucketQueue must be a non-empty array');
    } else {
      level.bucketQueue.forEach((b: unknown, i) => {
        if (!isObj(b)) {
          errors.push(`bucketQueue[${i}] is not an object`);
          return;
        }
        if (bucketIds.has(b.id)) errors.push(`Duplicate bucket id ${String(b.id)}`);
        bucketIds.add(b.id);
        const colorOk = checkColor(b.colorId, `bucketQueue[${i}]`);
        if (!isPosInt(b.capacity)) errors.push(`bucketQueue[${i}].capacity must be a positive integer`);
        const required = b.requiredScrews ?? BalanceConfig.conveyor.holesPerBucket;
        if (!isPosInt(required)) errors.push(`bucketQueue[${i}].requiredScrews must be a positive integer`);
        if (colorOk) {
          addCount(bucketCaps, b.colorId as ColorId, isPosInt(b.capacity) ? b.capacity : 0);
          addCount(bucketScrews, b.colorId as ColorId, isPosInt(required) ? required : 0);
        }
      });
    }

    // Queue columns
    const screwCounts = new Map<ColorId, number>();
    if (!Array.isArray(level.queueColumns) || level.queueColumns.length === 0) {
      errors.push('queueColumns must be a non-empty array');
    } else {
      level.queueColumns.forEach((col: unknown, c) => {
        if (!isObj(col) || !Array.isArray(col.items)) {
          errors.push(`queueColumns[${c}].items is missing`);
          return;
        }
        if (col.columnIndex !== c) errors.push(`queueColumns[${c}].columnIndex is ${String(col.columnIndex)} (expected ${c})`);
        checkColor(col.rimColorId, `queueColumns[${c}].rimColorId`);
        col.items.forEach((s: unknown, d) => {
          const cid = isObj(s) ? s.colorId : undefined;
          if (checkColor(cid, `queueColumns[${c}].items[${d}]`)) addCount(screwCounts, cid, 1);
        });
      });
    }

    // Per-color conservation (union of all colors so orphan buckets / screws are caught too)
    const allColors = new Set<ColorId>([...sandCounts.keys(), ...bucketCaps.keys(), ...screwCounts.keys()]);
    for (const cid of [...allColors].sort((a, b) => a - b)) {
      const sand = sandCounts.get(cid) ?? 0;
      const cap = bucketCaps.get(cid) ?? 0;
      if (sand !== cap) errors.push(`colorId ${cid}: sand cells (${sand}) !== bucket capacity (${cap})`);
      const screws = screwCounts.get(cid) ?? 0;
      const needed = bucketScrews.get(cid) ?? 0;
      if (screws !== needed) errors.push(`colorId ${cid}: screws (${screws}) !== required screws of its buckets (${needed})`);
    }

    return { valid: errors.length === 0, errors };
  }
}

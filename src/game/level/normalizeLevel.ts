import { BalanceConfig, GameplayConfig } from '../../config/game.config';
import { LevelData, QueueColumnDef, SandBucketDef } from '../../types/level.types';
import { toIntAtLeast } from '../../utils/math.utils';

/**
 * Returns a deep copy of `level` with every optional / missing field filled with its default
 * (conveyor config, subDivision, requiredScrews, columnIndex...). Never mutates the input.
 * Content errors (sand vs capacity...) are NOT fixed here — see `LevelValidator`.
 */
export function normalizeLevelData(level: LevelData): LevelData {
  const src = level as Partial<LevelData>;
  const cc: Partial<LevelData['conveyorConfig']> = src.conveyorConfig ?? {};
  const maxActiveSlots = toIntAtLeast(cc.maxActiveSlots, 1, BalanceConfig.conveyor.maxActiveSlots);
  const initialActiveSlots = Math.min(
    maxActiveSlots,
    toIntAtLeast(cc.initialActiveSlots, 1, BalanceConfig.conveyor.defaultActiveSlots)
  );

  const board: Partial<LevelData['sandBoard']> = src.sandBoard ?? {};
  const grid = Array.isArray(board.grid) ? board.grid.map((row) => (Array.isArray(row) ? [...row] : [])) : [];
  const height = toIntAtLeast(board.height, 0, grid.length);
  const width = toIntAtLeast(board.width, 0, grid.reduce((m, row) => Math.max(m, row.length), 0));

  const bucketQueue: SandBucketDef[] = (Array.isArray(src.bucketQueue) ? src.bucketQueue : []).map((b) => ({
    id: b.id,
    colorId: b.colorId,
    capacity: b.capacity,
    requiredScrews: toIntAtLeast(b.requiredScrews, 1, BalanceConfig.conveyor.holesPerBucket)
  }));

  const queueColumns: QueueColumnDef[] = (Array.isArray(src.queueColumns) ? src.queueColumns : []).map(
    (col, idx) => ({
      columnIndex: toIntAtLeast(col.columnIndex, 0, idx),
      rimColorId: col.rimColorId,
      items: (Array.isArray(col.items) ? col.items : []).map((it) => ({
        colorId: it.colorId,
        isMystery: Boolean(it.isMystery)
      }))
    })
  );

  return {
    version: 1,
    levelId: toIntAtLeast(src.levelId, 1, 1),
    title: typeof src.title === 'string' ? src.title : '',
    difficulty: src.difficulty ?? 'easy',
    rewardCoins: toIntAtLeast(src.rewardCoins, 0, 0),
    conveyorConfig: {
      initialActiveSlots,
      maxActiveSlots,
      bufferSlots: toIntAtLeast(cc.bufferSlots, 1, BalanceConfig.bufferDock.defaultSlots)
    },
    sandBoard: {
      width,
      height,
      subDivision: toIntAtLeast(board.subDivision, 1, GameplayConfig.defaultSubDivision),
      grid
    },
    bucketQueue,
    queueColumns
  };
}

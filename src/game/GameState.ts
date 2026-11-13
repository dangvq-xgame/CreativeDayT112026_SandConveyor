import { BalanceConfig, GameplayConfig } from '../config/game.config';
import { LevelData } from '../types/level.types';
import { normalizeLevelData } from './level/normalizeLevel';
import { BufferDockModel } from './models/BufferDockModel';
import { LinearConveyorModel } from './models/LinearConveyorModel';
import { QueueColumnModel } from './models/QueueColumnModel';
import { SandBoardModel } from './models/SandBoardModel';
import { ScrewMatchRule } from './rules/ScrewMatchRule';

/** All mutable gameplay state of one level attempt. Pure logic: no DOM, no timers. */
export class GameState {
  /** The level definition, with defaults filled in (see `normalizeLevelData`). */
  readonly levelData: LevelData;
  readonly sandBoard: SandBoardModel;
  readonly conveyor: LinearConveyorModel;
  readonly bufferDock: BufferDockModel;
  readonly queueColumns: QueueColumnModel[];
  revivesRemaining: number = GameplayConfig.revivesPerLevel;
  nextSuctionAtMs = 0;

  constructor(levelData: LevelData) {
    const level = normalizeLevelData(levelData);
    this.levelData = level;
    this.sandBoard = new SandBoardModel(
      level.sandBoard.width,
      level.sandBoard.height,
      level.sandBoard.subDivision,
      level.sandBoard.grid
    );
    this.conveyor = new LinearConveyorModel(
      level.bucketQueue,
      level.conveyorConfig.initialActiveSlots,
      level.conveyorConfig.maxActiveSlots
    );
    this.bufferDock = new BufferDockModel(
      level.conveyorConfig.bufferSlots,
      Math.max(level.conveyorConfig.bufferSlots, BalanceConfig.bufferDock.maxReviveSlots)
    );
    this.queueColumns = level.queueColumns.map((col) => new QueueColumnModel(col));
  }

  /** Win: board drained, no bucket left in the queue and every bucket on the belt full. */
  isLevelWon(): boolean {
    if (this.sandBoard.getRemainingCells() > 0) return false;
    if (this.conveyor.queue.length > 0) return false;
    return this.conveyor.getActiveBuckets().every((b) => b.isFull());
  }

  /** Screws left in all queue columns. */
  getTotalQueueScrews(): number {
    return this.queueColumns.reduce((acc, c) => acc + c.getItemCount(), 0);
  }

  /** `true` if some column tap would not lose (see `ScrewMatchRule.hasSafeMove`). */
  hasSafeMove(): boolean {
    return ScrewMatchRule.hasSafeMove(this.queueColumns, this.conveyor, this.bufferDock);
  }

  /** `true` if the "+1 buffer slot" revive is still available. */
  canRevive(): boolean {
    return this.revivesRemaining > 0 && this.bufferDock.canAddReviveSlot();
  }

  /** Consumes a revive and adds one buffer slot. Returns `false` if not possible. */
  revive(): boolean {
    if (!this.canRevive()) return false;
    if (!this.bufferDock.addReviveSlot()) return false;
    this.revivesRemaining--;
    return true;
  }
}

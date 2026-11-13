import { BalanceConfig } from '../config/game.config';
import { LevelData } from '../types/level.types';
import { BufferDockModel } from './models/BufferDockModel';
import { LinearConveyorModel } from './models/LinearConveyorModel';
import { QueueColumnModel } from './models/QueueColumnModel';
import { SandBoardModel } from './models/SandBoardModel';

export class GameState {
  readonly levelData: LevelData;
  readonly sandBoard: SandBoardModel;
  readonly conveyor: LinearConveyorModel;
  readonly bufferDock: BufferDockModel;
  readonly queueColumns: QueueColumnModel[];
  revivesRemaining = 1;
  nextSuctionAtMs = 0;

  constructor(levelData: LevelData) {
    this.levelData = levelData;
    this.sandBoard = new SandBoardModel(
      levelData.sandBoard.width,
      levelData.sandBoard.height,
      levelData.sandBoard.subDivision || 4,
      levelData.sandBoard.grid
    );
    this.conveyor = new LinearConveyorModel(
      levelData.bucketQueue,
      levelData.conveyorConfig.initialActiveSlots ?? BalanceConfig.conveyor.defaultActiveSlots,
      levelData.conveyorConfig.maxActiveSlots ?? BalanceConfig.conveyor.maxActiveSlots
    );
    this.bufferDock = new BufferDockModel(
      levelData.conveyorConfig.bufferSlots ?? BalanceConfig.bufferDock.defaultSlots,
      BalanceConfig.bufferDock.maxReviveSlots
    );
    this.queueColumns = levelData.queueColumns.map((col) => new QueueColumnModel(col));
  }

  isLevelWon(): boolean {
    if (this.sandBoard.getRemainingCells() > 0) return false;
    if (this.conveyor.queue.length > 0) return false;
    return this.conveyor.getActiveBuckets().every((b) => b.isFull());
  }
}


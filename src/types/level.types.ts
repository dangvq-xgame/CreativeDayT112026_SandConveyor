export type ColorId = number;

export interface ColorPaletteItem {
  /** Integer ID (1..12). 0 is reserved for empty cell. */
  colorId: ColorId;
  name: string;
  bodyHex: string;
  shadowHex: string;
  handleHex: string;
  sandHex: string;
}

export interface GameBalanceConfig {
  conveyor: {
    isLinear: boolean;
    defaultActiveSlots: number;
    maxActiveSlots: number;
    holesPerBucket: number;
    beltSpeedPxPerSec: number;
    holdSpeedMultiplier: number;
    holdThresholdMs: number;
    suctionIntervalMs: number;
  };
  bufferDock: {
    defaultSlots: number;
    maxReviveSlots: number;
  };
  queueColumns: {
    visibleDepth: number;
    slideUpDurationMs: number;
  };
  boosters: {
    extraSlot: {
      id: 1;
      key: 'extra_slot';
      slotIncrement: number;
      initialCount: number;
      coinCost: number;
    };
    hand: {
      id: 2;
      key: 'hand';
      mode: 'unlock_selected_bucket' | 'pick_any_screw';
      initialCount: number;
      coinCost: number;
    };
    shuffle: {
      id: 3;
      key: 'shuffle';
      minPriorityTopMatches: number;
      animDurationMs: number;
      initialCount: number;
      coinCost: number;
    };
  };
}

export interface SandBucketDef {
  id: number;
  colorId: ColorId;
  capacity: number;
  requiredScrews: number;
}

export interface QueueScrewDef {
  colorId: ColorId;
  isMystery?: boolean;
}

export interface QueueColumnDef {
  columnIndex: number;
  rimColorId: ColorId;
  items: QueueScrewDef[];
}

export interface LevelData {
  version: 1;
  levelId: number;
  title: string;
  difficulty: 'tutorial' | 'easy' | 'medium' | 'hard';
  rewardCoins: number;
  conveyorConfig: {
    initialActiveSlots: number;
    maxActiveSlots: number;
    bufferSlots: number;
  };
  sandBoard: {
    width: number;
    height: number;
    subDivision: number;
    grid: ColorId[][];
  };
  bucketQueue: SandBucketDef[];
  queueColumns: QueueColumnDef[];
}

/** UI languages shipped in `src/i18n`. */
export type LanguageCode = 'vi' | 'en';

/** Keys of the persistent booster inventory. */
export type BoosterKey = 'extraSlot' | 'hand' | 'shuffle';

/** Player preferences persisted in {@link SaveData.settings}. */
export interface SaveSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  language: LanguageCode;
}

export interface SaveData {
  version: 1;
  currentLevel: number;
  coins: number;
  boosters: Record<BoosterKey, number>;
  settings: SaveSettings;
  completedLevels: Record<number, { stars: number; bestTimeSec: number }>;
}


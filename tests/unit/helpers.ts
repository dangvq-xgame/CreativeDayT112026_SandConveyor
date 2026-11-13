import { KeyValueStorage, SettingsStore } from '../../src/core/SaveManager';
import { LinearConveyorModel } from '../../src/game/models/LinearConveyorModel';
import { QueueColumnModel } from '../../src/game/models/QueueColumnModel';
import { SandBucketModel } from '../../src/game/models/SandBucketModel';
import { LevelData, QueueScrewDef, SandBucketDef, SaveSettings } from '../../src/types/level.types';

export function bucketDef(id: number, colorId: number, capacity = 4, requiredScrews = 3): SandBucketDef {
  return { id, colorId, capacity, requiredScrews };
}

/** Conveyor with buckets spawned immediately into the first `active` slots. */
export function makeConveyor(defs: SandBucketDef[], active = 2, max = 4): LinearConveyorModel {
  const conveyor = new LinearConveyorModel(defs, active, max);
  conveyor.refillSlots(0, 500, 40, 460, true);
  return conveyor;
}

/** `colors` top → bottom. A negative number means "mystery screw of that color". */
export function makeColumn(columnIndex: number, colors: number[], rimColorId = 1): QueueColumnModel {
  const items: QueueScrewDef[] = colors.map((c) => (c < 0 ? { colorId: -c, isMystery: true } : { colorId: c }));
  return new QueueColumnModel({ columnIndex, rimColorId, items });
}

/** Lands every hole → lid opens. */
export function openBucket(bucket: SandBucketModel, nowMs = 0): void {
  bucket.holes.forEach((_, i) => bucket.landScrewInHole(i, nowMs));
}

export function columnColors(col: QueueColumnModel): number[] {
  return col.items.map((it) => it.colorId);
}

/** Small valid level: 2 colors, 2 buckets (cap 2), 2 columns of 3 screws. */
export function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
  return {
    version: 1,
    levelId: 1,
    title: 'Test',
    difficulty: 'easy',
    rewardCoins: 10,
    conveyorConfig: { initialActiveSlots: 2, maxActiveSlots: 4, bufferSlots: 5 },
    sandBoard: {
      width: 2,
      height: 2,
      subDivision: 4,
      grid: [
        [1, 2],
        [1, 2]
      ]
    },
    bucketQueue: [bucketDef(1, 1, 2), bucketDef(2, 2, 2)],
    queueColumns: [
      { columnIndex: 0, rimColorId: 1, items: [{ colorId: 1 }, { colorId: 2 }, { colorId: 1 }] },
      { columnIndex: 1, rimColorId: 2, items: [{ colorId: 2 }, { colorId: 1 }, { colorId: 2 }] }
    ],
    ...overrides
  };
}

/** In-memory Web Storage. */
export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** In-memory SettingsStore with subscription support. */
export class FakeSettingsStore implements SettingsStore {
  settings: SaveSettings;
  updates: Array<Partial<SaveSettings>> = [];
  private listeners = new Set<() => void>();

  constructor(initial: Partial<SaveSettings> = {}) {
    this.settings = { soundEnabled: true, musicEnabled: true, vibrationEnabled: true, language: 'vi', ...initial };
  }
  getSettings(): SaveSettings {
    return this.settings;
  }
  updateSettings(partial: Partial<SaveSettings>): void {
    this.updates.push(partial);
    this.settings = { ...this.settings, ...partial };
    for (const l of [...this.listeners]) l();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

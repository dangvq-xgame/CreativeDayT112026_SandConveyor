import { BalanceConfig } from '../config/game.config';
import { STORAGE_KEY } from '../config/constants';
import { SaveData } from '../types/level.types';

function createDefaultSaveData(): SaveData {
  return {
    version: 1,
    currentLevel: 1,
    coins: 500,
    boosters: {
      extraSlot: BalanceConfig.boosters.extraSlot.initialCount,
      hand: BalanceConfig.boosters.hand.initialCount,
      shuffle: BalanceConfig.boosters.shuffle.initialCount
    },
    settings: {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      language: 'vi'
    },
    completedLevels: {}
  };
}

export function migrateSaveData(raw: unknown): SaveData {
  const def = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Partial<SaveData>;
  return {
    version: 1,
    currentLevel: typeof obj.currentLevel === 'number' && obj.currentLevel >= 1 ? obj.currentLevel : def.currentLevel,
    coins: typeof obj.coins === 'number' && obj.coins >= 0 ? obj.coins : def.coins,
    boosters: {
      extraSlot:
        typeof obj.boosters?.extraSlot === 'number'
          ? obj.boosters.extraSlot
          : def.boosters.extraSlot,
      hand: typeof obj.boosters?.hand === 'number' ? obj.boosters.hand : def.boosters.hand,
      shuffle:
        typeof obj.boosters?.shuffle === 'number' ? obj.boosters.shuffle : def.boosters.shuffle
    },
    settings: {
      soundEnabled: obj.settings?.soundEnabled ?? def.settings.soundEnabled,
      musicEnabled: obj.settings?.musicEnabled ?? def.settings.musicEnabled,
      vibrationEnabled: obj.settings?.vibrationEnabled ?? def.settings.vibrationEnabled,
      language: obj.settings?.language === 'en' ? 'en' : 'vi'
    },
    completedLevels: obj.completedLevels && typeof obj.completedLevels === 'object' ? obj.completedLevels : {}
  };
}

class SaveManagerImpl {
  private data: SaveData = createDefaultSaveData();

  constructor() {
    this.load();
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = migrateSaveData(JSON.parse(raw));
      } else {
        this.data = createDefaultSaveData();
      }
    } catch {
      this.data = createDefaultSaveData();
    }
    return this.data;
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors
    }
  }

  getData(): SaveData {
    return this.data;
  }

  setCurrentLevel(levelId: number): void {
    this.data.currentLevel = levelId;
    this.save();
  }

  addCoins(amount: number): void {
    this.data.coins = Math.max(0, this.data.coins + amount);
    this.save();
  }

  useBooster(key: 'extraSlot' | 'hand' | 'shuffle'): boolean {
    if (this.data.boosters[key] <= 0) return false;
    this.data.boosters[key]--;
    this.save();
    return true;
  }

  buyBooster(key: 'extraSlot' | 'hand' | 'shuffle', cost: number): boolean {
    if (this.data.coins < cost) return false;
    this.data.coins -= cost;
    this.data.boosters[key]++;
    this.save();
    return true;
  }

  markLevelCompleted(levelId: number, stars = 3, timeSec = 30): void {
    const prev = this.data.completedLevels[levelId];
    this.data.completedLevels[levelId] = {
      stars: Math.max(prev?.stars ?? 0, stars),
      bestTimeSec: prev ? Math.min(prev.bestTimeSec, timeSec) : timeSec
    };
    this.save();
  }

  resetAll(): void {
    this.data = createDefaultSaveData();
    this.save();
  }
}

export const SaveManager = new SaveManagerImpl();


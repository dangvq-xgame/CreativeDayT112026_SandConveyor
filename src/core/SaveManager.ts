import { BalanceConfig } from '../config/game.config';
import { DEFAULT_LANGUAGE, SAVE_DEFAULTS, STORAGE_KEY, SUPPORTED_LANGUAGES } from '../config/constants';
import { BoosterKey, LanguageCode, SaveData, SaveSettings } from '../types/level.types';
import { isFiniteNumber, toIntAtLeast } from '../utils/math.utils';

/** Minimal subset of the Web Storage API used by {@link SaveManagerImpl} (injectable for tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Called after every persisted change. Receives the live save object (treat as read-only). */
export type SaveListener = (data: Readonly<SaveData>) => void;

/**
 * Narrow settings persistence contract used by `AudioManager` and `Haptics`
 * ({@link SaveManagerImpl} implements it; tests can pass an in-memory fake).
 */
export interface SettingsStore {
  getSettings(): Readonly<SaveSettings>;
  updateSettings(partial: Partial<SaveSettings>): void;
  subscribe?(listener: () => void): () => void;
}

/** Current schema version written by {@link SaveManagerImpl.save}. */
export const SAVE_VERSION = 1 as const;

/** Builds a fresh save with default coins, boosters and settings. */
export function createDefaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    currentLevel: 1,
    coins: SAVE_DEFAULTS.coins,
    boosters: {
      extraSlot: BalanceConfig.boosters.extraSlot.initialCount,
      hand: BalanceConfig.boosters.hand.initialCount,
      shuffle: BalanceConfig.boosters.shuffle.initialCount
    },
    settings: {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      language: DEFAULT_LANGUAGE
    },
    completedLevels: {}
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function sanitizeCompletedLevels(raw: unknown): SaveData['completedLevels'] {
  const out: SaveData['completedLevels'] = {};
  if (!isRecord(raw)) return out;
  for (const [key, entry] of Object.entries(raw)) {
    const levelId = Number(key);
    if (!Number.isInteger(levelId) || levelId < 1 || !isRecord(entry)) continue;
    const stars = toIntAtLeast(entry.stars, 0, 0);
    const bestTimeSec = isFiniteNumber(entry.bestTimeSec) && entry.bestTimeSec >= 0 ? entry.bestTimeSec : 0;
    out[levelId] = { stars: Math.min(SAVE_DEFAULTS.maxStars, stars), bestTimeSec };
  }
  return out;
}

/**
 * Converts any parsed JSON (possibly corrupt, partial, from an older/newer version)
 * into a valid {@link SaveData}. Never throws. Invalid fields fall back to defaults:
 * negative/NaN/non-integer counters, non-boolean settings, unknown languages, etc.
 */
export function migrateSaveData(raw: unknown): SaveData {
  const def = createDefaultSaveData();
  if (!isRecord(raw)) return def;
  const boosters = isRecord(raw.boosters) ? raw.boosters : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  return {
    version: SAVE_VERSION,
    currentLevel: toIntAtLeast(raw.currentLevel, 1, def.currentLevel),
    coins: toIntAtLeast(raw.coins, 0, def.coins),
    boosters: {
      extraSlot: toIntAtLeast(boosters.extraSlot, 0, def.boosters.extraSlot),
      hand: toIntAtLeast(boosters.hand, 0, def.boosters.hand),
      shuffle: toIntAtLeast(boosters.shuffle, 0, def.boosters.shuffle)
    },
    settings: {
      soundEnabled: sanitizeBool(settings.soundEnabled, def.settings.soundEnabled),
      musicEnabled: sanitizeBool(settings.musicEnabled, def.settings.musicEnabled),
      vibrationEnabled: sanitizeBool(settings.vibrationEnabled, def.settings.vibrationEnabled),
      language: isLanguage(settings.language) ? settings.language : def.settings.language
    },
    completedLevels: sanitizeCompletedLevels(raw.completedLevels)
  };
}

/** Resolves `window.localStorage` lazily; accessing it can throw (Safari private mode, sandboxed iframes). */
function defaultStorageProvider(): KeyValueStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Persistent player progress (coins, boosters, settings, completed levels).
 * All mutators validate their input, persist immediately and notify subscribers.
 * Storage failures (quota, private mode, corrupt JSON) never throw: the game keeps
 * running with in-memory data.
 */
export class SaveManagerImpl {
  private data: SaveData = createDefaultSaveData();
  private readonly listeners = new Set<SaveListener>();

  constructor(private readonly storageProvider: () => KeyValueStorage | null = defaultStorageProvider) {
    this.load();
  }

  /** Reloads from storage (corrupt or missing data → defaults). Returns the live data object. */
  load(): SaveData {
    let next = createDefaultSaveData();
    try {
      const raw = this.storageProvider()?.getItem(STORAGE_KEY);
      if (raw) next = migrateSaveData(JSON.parse(raw));
    } catch {
      next = createDefaultSaveData();
    }
    this.data = next;
    return this.data;
  }

  /** Writes the current data to storage (errors are swallowed) and notifies subscribers. */
  save(): void {
    try {
      this.storageProvider()?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Quota exceeded / storage disabled: keep the in-memory state.
    }
    this.notify();
  }

  /** Live save object. Prefer the mutator methods over writing to it directly. */
  getData(): SaveData {
    return this.data;
  }

  /** Read-only view of the player settings. */
  getSettings(): Readonly<SaveSettings> {
    return this.data.settings;
  }

  /** Merges `partial` into the settings (invalid values are ignored) and persists. */
  updateSettings(partial: Partial<SaveSettings>): void {
    const s = this.data.settings;
    s.soundEnabled = sanitizeBool(partial.soundEnabled, s.soundEnabled);
    s.musicEnabled = sanitizeBool(partial.musicEnabled, s.musicEnabled);
    s.vibrationEnabled = sanitizeBool(partial.vibrationEnabled, s.vibrationEnabled);
    if (isLanguage(partial.language)) s.language = partial.language;
    this.save();
  }

  /** Registers a change listener; returns an unsubscribe function. */
  subscribe(listener: SaveListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Sets the level to resume from (ignored unless an integer `>= 1`). */
  setCurrentLevel(levelId: number): void {
    const next = toIntAtLeast(levelId, 1, this.data.currentLevel);
    this.data.currentLevel = next;
    this.save();
  }

  /** Adds (or with a negative amount, removes) coins, clamped at 0. Non-finite amounts are ignored. */
  addCoins(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.data.coins = Math.max(0, Math.floor(this.data.coins + amount));
    this.save();
  }

  /** Spends `amount` coins if affordable. Returns `false` (and changes nothing) otherwise. */
  spendCoins(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0 || this.data.coins < amount) return false;
    this.data.coins = Math.floor(this.data.coins - amount);
    this.save();
    return true;
  }

  /** Current owned count of a booster. */
  getBoosterCount(key: BoosterKey): number {
    return this.data.boosters[key];
  }

  /** Consumes one booster if owned. */
  useBooster(key: BoosterKey): boolean {
    if (this.data.boosters[key] <= 0) return false;
    this.data.boosters[key]--;
    this.save();
    return true;
  }

  /** Grants `count` boosters (non-positive / non-integer counts are ignored). */
  addBooster(key: BoosterKey, count = 1): void {
    if (!Number.isInteger(count) || count <= 0) return;
    this.data.boosters[key] += count;
    this.save();
  }

  /** Buys one booster for `cost` coins. Returns `false` if the cost is invalid or unaffordable. */
  buyBooster(key: BoosterKey, cost: number): boolean {
    if (!this.spendCoins(cost)) return false;
    this.data.boosters[key]++;
    this.save();
    return true;
  }

  /** Records a level clear, keeping the best stars and the best (lowest) time. */
  markLevelCompleted(levelId: number, stars: number = SAVE_DEFAULTS.maxStars, timeSec = 30): void {
    if (!Number.isInteger(levelId) || levelId < 1) return;
    const safeStars = Math.min(SAVE_DEFAULTS.maxStars, toIntAtLeast(stars, 0, 0));
    const safeTime = isFiniteNumber(timeSec) && timeSec >= 0 ? timeSec : 0;
    const prev = this.data.completedLevels[levelId];
    this.data.completedLevels[levelId] = {
      stars: Math.max(prev?.stars ?? 0, safeStars),
      bestTimeSec: prev ? Math.min(prev.bestTimeSec, safeTime) : safeTime
    };
    this.save();
  }

  /**
   * Wipes progress (level, coins, boosters, completed levels) back to defaults.
   * Player preferences (sound/music/vibration/language) are kept unless
   * `options.includeSettings` is `true`.
   */
  resetAll(options: { includeSettings?: boolean } = {}): void {
    const keptSettings = { ...this.data.settings };
    this.data = createDefaultSaveData();
    if (!options.includeSettings) this.data.settings = keptSettings;
    this.save();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.data);
      } catch (err) {
        console.error('[SaveManager] listener failed', err);
      }
    }
  }
}

/** Global save singleton backed by `localStorage`. */
export const SaveManager = new SaveManagerImpl();

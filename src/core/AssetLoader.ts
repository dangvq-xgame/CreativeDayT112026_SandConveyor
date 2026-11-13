import { TOTAL_LEVELS } from '../config/constants';
import { LevelData } from '../types/level.types';
import { positiveMod } from '../utils/math.utils';
import { ColorManager, ColorManagerImpl } from './ColorManager';

/** A data file that could not be loaded (network error, HTTP error, invalid JSON / shape). */
export interface FailedAsset {
  url: string;
  reason: string;
}

/** Summary of {@link AssetLoaderImpl.init}. */
export interface AssetLoadReport {
  paletteLoaded: boolean;
  loadedLevelIds: number[];
  failed: FailedAsset[];
}

type FetchFn = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export interface AssetLoaderOptions {
  fetchFn?: FetchFn;
  levelCount?: number;
  basePath?: string;
  colorManager?: Pick<ColorManagerImpl, 'setPalette'>;
}

/** Minimal shape check so a broken file is reported instead of crashing the game later. */
function isLevelDataLike(v: unknown): v is LevelData {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const board = o.sandBoard as Record<string, unknown> | undefined;
  return (
    typeof o.levelId === 'number' &&
    typeof board === 'object' &&
    board !== null &&
    Array.isArray(board.grid) &&
    Array.isArray(o.bucketQueue) &&
    Array.isArray(o.queueColumns)
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const defaultFetch: FetchFn = (url) => fetch(url);

/**
 * Loads `palette.json` and `levels/level-XXX.json` (in parallel). Individual failures never reject
 * {@link init}: they are reported in {@link getLoadReport} and the game keeps the built-in palette /
 * the levels that did load. Concurrent `init()` calls share one load.
 */
export class AssetLoaderImpl {
  private readonly levels = new Map<number, LevelData>();
  private initPromise: Promise<void> | null = null;
  private report: AssetLoadReport = { paletteLoaded: false, loadedLevelIds: [], failed: [] };
  private readonly fetchFn: FetchFn;
  private readonly levelCount: number;
  private readonly basePath: string;
  private readonly colorManager: Pick<ColorManagerImpl, 'setPalette'>;

  constructor(options: AssetLoaderOptions = {}) {
    this.fetchFn = options.fetchFn ?? defaultFetch;
    this.levelCount = Math.max(1, Math.floor(options.levelCount ?? TOTAL_LEVELS));
    this.basePath = options.basePath ?? './assets/data';
    this.colorManager = options.colorManager ?? ColorManager;
  }

  /** Loads all data once; later calls return the same promise. Never rejects. */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.loadAll();
    return this.initPromise;
  }

  /** URL of a level file, e.g. `./assets/data/levels/level-001.json`. */
  getLevelUrl(levelId: number): string {
    return `${this.basePath}/levels/level-${String(levelId).padStart(3, '0')}.json`;
  }

  /**
   * Deep copy of a level. Ids wrap around the level count (6 → 1, 0 → 5); non-integer ids are floored.
   * If that level failed to load, the first loaded level is returned instead.
   * @throws only when no level at all could be loaded.
   */
  getLevel(levelId: number): LevelData {
    const normalized = this.normalizeLevelId(levelId);
    const found = this.levels.get(normalized) ?? this.getAllLevels()[0];
    if (!found) {
      throw new Error(`Level ${normalized} not loaded (no level data available)`);
    }
    return structuredClone(found);
  }

  /** Maps any number onto `1..levelCount` (looping). */
  normalizeLevelId(levelId: number): number {
    const id = Number.isFinite(levelId) ? Math.floor(levelId) : 1;
    return positiveMod(id - 1, this.levelCount) + 1;
  }

  hasLevel(levelId: number): boolean {
    return this.levels.has(levelId);
  }

  /** Loaded levels sorted by id (shared references: do not mutate). */
  getAllLevels(): LevelData[] {
    return Array.from(this.levels.values()).sort((a, b) => a.levelId - b.levelId);
  }

  getLevelCount(): number {
    return this.levelCount;
  }

  /** What loaded and what failed during {@link init}. */
  getLoadReport(): AssetLoadReport {
    return { ...this.report, loadedLevelIds: [...this.report.loadedLevelIds], failed: [...this.report.failed] };
  }

  private async loadAll(): Promise<void> {
    const failed: FailedAsset[] = [];
    const paletteUrl = `${this.basePath}/palette.json`;
    const levelUrls = Array.from({ length: this.levelCount }, (_, i) => this.getLevelUrl(i + 1));

    const [paletteRes, ...levelResults] = await Promise.allSettled([
      this.fetchJson(paletteUrl),
      ...levelUrls.map((url) => this.fetchJson(url))
    ]);

    let paletteLoaded = false;
    if (paletteRes.status === 'fulfilled') {
      const accepted = Array.isArray(paletteRes.value) ? this.colorManager.setPalette(paletteRes.value) : 0;
      paletteLoaded = accepted > 0;
      if (!paletteLoaded) failed.push({ url: paletteUrl, reason: 'palette has no valid entry' });
    } else {
      failed.push({ url: paletteUrl, reason: errorMessage(paletteRes.reason) });
    }

    levelResults.forEach((res, i) => {
      const url = levelUrls[i];
      if (res.status === 'rejected') {
        failed.push({ url, reason: errorMessage(res.reason) });
      } else if (!isLevelDataLike(res.value)) {
        failed.push({ url, reason: 'invalid level structure' });
      } else {
        this.levels.set(res.value.levelId, res.value);
      }
    });

    this.report = { paletteLoaded, loadedLevelIds: [...this.levels.keys()].sort((a, b) => a - b), failed };
    if (failed.length > 0) {
      console.warn('[AssetLoader] some data files failed to load:', failed);
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

/** Global asset loader singleton. */
export const AssetLoader = new AssetLoaderImpl();

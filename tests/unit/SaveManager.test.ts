import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../../src/config/constants';
import { BalanceConfig } from '../../src/config/game.config';
import { createDefaultSaveData, migrateSaveData, SaveManagerImpl } from '../../src/core/SaveManager';
import { MemoryStorage } from './helpers';

function managerWith(raw: string | null): { mgr: SaveManagerImpl; storage: MemoryStorage } {
  const storage = new MemoryStorage();
  if (raw !== null) storage.setItem(STORAGE_KEY, raw);
  return { mgr: new SaveManagerImpl(() => storage), storage };
}

describe('SaveManager — loading', () => {
  it('uses defaults when nothing is stored', () => {
    const { mgr } = managerWith(null);
    expect(mgr.getData()).toEqual(createDefaultSaveData());
    expect(mgr.getData().boosters.hand).toBe(BalanceConfig.boosters.hand.initialCount);
  });

  it('falls back to defaults on corrupt JSON', () => {
    const { mgr } = managerWith('{not json');
    expect(mgr.getData()).toEqual(createDefaultSaveData());
  });

  it('survives a storage provider that throws (Safari private mode / sandboxed iframe)', () => {
    const mgr = new SaveManagerImpl(() => {
      throw new Error('SecurityError');
    });
    expect(mgr.getData().coins).toBe(createDefaultSaveData().coins);
    expect(() => mgr.addCoins(5)).not.toThrow();
    expect(mgr.getData().coins).toBe(createDefaultSaveData().coins + 5);
  });

  it('survives getItem/setItem throwing (quota exceeded)', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('denied');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      })
    };
    const mgr = new SaveManagerImpl(() => storage);
    const listener = vi.fn();
    mgr.subscribe(listener);
    expect(() => mgr.addCoins(10)).not.toThrow();
    expect(mgr.getData().coins).toBe(createDefaultSaveData().coins + 10);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('works without any storage (node / SSR)', () => {
    const mgr = new SaveManagerImpl(() => null);
    mgr.setCurrentLevel(3);
    expect(mgr.getData().currentLevel).toBe(3);
  });

  it('round-trips through storage', () => {
    const { mgr, storage } = managerWith(null);
    mgr.addCoins(25);
    mgr.useBooster('shuffle');
    mgr.updateSettings({ musicEnabled: false, language: 'en' });
    mgr.markLevelCompleted(2, 3, 40);
    const reloaded = new SaveManagerImpl(() => storage);
    expect(reloaded.getData()).toEqual(mgr.getData());
  });
});

describe('migrateSaveData — sanitizing', () => {
  it('returns defaults for non-object input', () => {
    for (const raw of [null, undefined, 42, 'x', [], true]) {
      expect(migrateSaveData(raw)).toEqual(createDefaultSaveData());
    }
  });

  it('rejects negative / NaN / Infinity / non-number counters', () => {
    const def = createDefaultSaveData();
    const out = migrateSaveData({
      currentLevel: -3,
      coins: Number.NaN,
      boosters: { extraSlot: -1, hand: Number.POSITIVE_INFINITY, shuffle: '7' }
    });
    expect(out.currentLevel).toBe(def.currentLevel);
    expect(out.coins).toBe(def.coins);
    expect(out.boosters).toEqual(def.boosters);
  });

  it('floors fractional counters', () => {
    const out = migrateSaveData({ currentLevel: 2.9, coins: 10.7, boosters: { extraSlot: 1.5, hand: 0, shuffle: 4 } });
    expect(out.currentLevel).toBe(2);
    expect(out.coins).toBe(10);
    expect(out.boosters).toEqual({ extraSlot: 1, hand: 0, shuffle: 4 });
  });

  it('only accepts real booleans and supported languages in settings (regression: "false" string was kept)', () => {
    const out = migrateSaveData({
      settings: { soundEnabled: 'false', musicEnabled: false, vibrationEnabled: 0, language: 'fr' }
    });
    expect(out.settings).toEqual({ soundEnabled: true, musicEnabled: false, vibrationEnabled: true, language: 'vi' });
    expect(migrateSaveData({ settings: { language: 'en' } }).settings.language).toBe('en');
  });

  it('sanitizes completedLevels entries', () => {
    const out = migrateSaveData({
      completedLevels: {
        1: { stars: 9, bestTimeSec: 12.5 },
        2: { stars: -1, bestTimeSec: -4 },
        abc: { stars: 3, bestTimeSec: 1 },
        0: { stars: 3, bestTimeSec: 1 },
        3: 'garbage'
      }
    });
    expect(out.completedLevels).toEqual({ 1: { stars: 3, bestTimeSec: 12.5 }, 2: { stars: 0, bestTimeSec: 0 } });
  });

  it('migrates any version to the current one, keeping valid data', () => {
    const out = migrateSaveData({ version: 99, coins: 77 });
    expect(out.version).toBe(1);
    expect(out.coins).toBe(77);
  });
});

describe('SaveManager — mutators', () => {
  it('addCoins ignores non-finite amounts (regression: NaN poisoned the balance) and clamps at 0', () => {
    const { mgr } = managerWith(null);
    const start = mgr.getData().coins;
    mgr.addCoins(Number.NaN);
    mgr.addCoins(Number.POSITIVE_INFINITY);
    expect(mgr.getData().coins).toBe(start);
    mgr.addCoins(-1e9);
    expect(mgr.getData().coins).toBe(0);
  });

  it('spendCoins only succeeds when affordable and valid', () => {
    const { mgr } = managerWith(JSON.stringify({ coins: 100 }));
    expect(mgr.spendCoins(150)).toBe(false);
    expect(mgr.spendCoins(-10)).toBe(false);
    expect(mgr.spendCoins(Number.NaN)).toBe(false);
    expect(mgr.getData().coins).toBe(100);
    expect(mgr.spendCoins(100)).toBe(true);
    expect(mgr.getData().coins).toBe(0);
  });

  it('buyBooster rejects negative costs (regression: a negative cost minted coins)', () => {
    const { mgr } = managerWith(JSON.stringify({ coins: 100, boosters: { extraSlot: 0, hand: 0, shuffle: 0 } }));
    expect(mgr.buyBooster('hand', -50)).toBe(false);
    expect(mgr.getData().coins).toBe(100);
    expect(mgr.buyBooster('hand', 60)).toBe(true);
    expect(mgr.getData()).toMatchObject({ coins: 40, boosters: { hand: 1 } });
    expect(mgr.buyBooster('hand', 60)).toBe(false);
  });

  it('useBooster never goes below zero', () => {
    const { mgr } = managerWith(JSON.stringify({ boosters: { extraSlot: 1, hand: 0, shuffle: 0 } }));
    expect(mgr.useBooster('extraSlot')).toBe(true);
    expect(mgr.useBooster('extraSlot')).toBe(false);
    expect(mgr.getBoosterCount('extraSlot')).toBe(0);
  });

  it('addBooster ignores invalid counts', () => {
    const { mgr } = managerWith(null);
    const start = mgr.getBoosterCount('shuffle');
    mgr.addBooster('shuffle', 0);
    mgr.addBooster('shuffle', -2);
    mgr.addBooster('shuffle', 1.5);
    expect(mgr.getBoosterCount('shuffle')).toBe(start);
    mgr.addBooster('shuffle');
    mgr.addBooster('shuffle', 2);
    expect(mgr.getBoosterCount('shuffle')).toBe(start + 3);
  });

  it('setCurrentLevel ignores invalid ids', () => {
    const { mgr } = managerWith(null);
    mgr.setCurrentLevel(4);
    mgr.setCurrentLevel(0);
    mgr.setCurrentLevel(Number.NaN);
    expect(mgr.getData().currentLevel).toBe(4);
  });

  it('markLevelCompleted keeps the best stars and best time', () => {
    const { mgr } = managerWith(null);
    mgr.markLevelCompleted(1, 2, 50);
    mgr.markLevelCompleted(1, 1, 30);
    expect(mgr.getData().completedLevels[1]).toEqual({ stars: 2, bestTimeSec: 30 });
    mgr.markLevelCompleted(1, 7, 99);
    expect(mgr.getData().completedLevels[1]).toEqual({ stars: 3, bestTimeSec: 30 });
    mgr.markLevelCompleted(0, 3, 1);
    expect(mgr.getData().completedLevels[0]).toBeUndefined();
  });

  it('updateSettings merges valid fields, ignores invalid ones and persists', () => {
    const { mgr, storage } = managerWith(null);
    mgr.updateSettings({ soundEnabled: false });
    mgr.updateSettings({ language: 'xx' as never, musicEnabled: 'no' as never });
    expect(mgr.getSettings()).toEqual({ soundEnabled: false, musicEnabled: true, vibrationEnabled: true, language: 'vi' });
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).settings.soundEnabled).toBe(false);
  });

  it('notifies subscribers, supports unsubscribe and isolates throwing listeners', () => {
    const { mgr } = managerWith(null);
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mgr.subscribe(bad);
    const off = mgr.subscribe(good);
    mgr.addCoins(1);
    expect(good).toHaveBeenCalledTimes(1);
    off();
    mgr.addCoins(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(bad).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });

  it('resetAll keeps player settings by default, wipes them with includeSettings', () => {
    const { mgr } = managerWith(null);
    mgr.addCoins(999);
    mgr.updateSettings({ soundEnabled: false, language: 'en' });
    mgr.resetAll();
    expect(mgr.getData().coins).toBe(createDefaultSaveData().coins);
    expect(mgr.getSettings()).toMatchObject({ soundEnabled: false, language: 'en' });
    mgr.resetAll({ includeSettings: true });
    expect(mgr.getSettings()).toEqual(createDefaultSaveData().settings);
  });
});

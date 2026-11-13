import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetLoaderImpl } from '../../src/core/AssetLoader';
import { makeLevel } from './helpers';

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

function ok(body: unknown): FakeResponse {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}
function notFound(): FakeResponse {
  return { ok: false, status: 404, json: () => Promise.reject(new Error('no body')) };
}

const palette = [{ colorId: 1, name: 'A', bodyHex: '#111111', shadowHex: '#222222', handleHex: '#333333', sandHex: '#444444' }];

function makeLoader(routes: Record<string, () => Promise<FakeResponse>>, levelCount = 3) {
  const fetchFn = vi.fn((url: string) => (routes[url] ? routes[url]() : Promise.resolve(notFound())));
  const colorManager = { setPalette: vi.fn((items: readonly unknown[]) => items.length) };
  const loader = new AssetLoaderImpl({ fetchFn, levelCount, basePath: '/d', colorManager });
  return { loader, fetchFn, colorManager };
}

const lv = (id: number) => makeLevel({ levelId: id, title: `L${id}` });

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe('AssetLoader', () => {
  it('loads palette and levels in parallel', async () => {
    const { loader, colorManager } = makeLoader({
      '/d/palette.json': async () => ok(palette),
      '/d/levels/level-001.json': async () => ok(lv(1)),
      '/d/levels/level-002.json': async () => ok(lv(2)),
      '/d/levels/level-003.json': async () => ok(lv(3))
    });
    await loader.init();
    expect(colorManager.setPalette).toHaveBeenCalledWith(palette);
    expect(loader.getAllLevels().map((l) => l.levelId)).toEqual([1, 2, 3]);
    expect(loader.getLoadReport()).toEqual({ paletteLoaded: true, loadedLevelIds: [1, 2, 3], failed: [] });
  });

  it('does not reject on network errors / 404 / bad JSON shape (regression: one failure aborted boot)', async () => {
    const { loader } = makeLoader({
      '/d/palette.json': () => Promise.reject(new TypeError('Failed to fetch')),
      '/d/levels/level-001.json': async () => ok(lv(1)),
      '/d/levels/level-003.json': async () => ok({ hello: 'world' })
    });
    await expect(loader.init()).resolves.toBeUndefined();
    const report = loader.getLoadReport();
    expect(report.paletteLoaded).toBe(false);
    expect(report.loadedLevelIds).toEqual([1]);
    expect(report.failed.map((f) => f.url).sort()).toEqual(
      ['/d/levels/level-002.json', '/d/levels/level-003.json', '/d/palette.json'].sort()
    );
    expect(report.failed.find((f) => f.url.endsWith('002.json'))?.reason).toBe('HTTP 404');
  });

  it('shares one load between concurrent init() calls', async () => {
    const { loader, fetchFn } = makeLoader({ '/d/levels/level-001.json': async () => ok(lv(1)) }, 1);
    await Promise.all([loader.init(), loader.init(), loader.init()]);
    expect(fetchFn).toHaveBeenCalledTimes(2); // palette + 1 level
  });

  it('wraps level ids into 1..count (incl. 0, negatives, NaN, fractions)', () => {
    const { loader } = makeLoader({}, 5);
    expect([1, 5, 6, 10, 11, 0, -1, 2.7, Number.NaN].map((id) => loader.normalizeLevelId(id))).toEqual([
      1, 5, 1, 5, 1, 5, 4, 2, 1
    ]);
  });

  it('returns deep copies and falls back to the first loaded level', async () => {
    const { loader } = makeLoader({
      '/d/levels/level-002.json': async () => ok(lv(2)),
      '/d/levels/level-003.json': async () => ok(lv(3))
    });
    await loader.init();
    const a = loader.getLevel(2);
    a.sandBoard.grid[0][0] = 99;
    expect(loader.getLevel(2).sandBoard.grid[0][0]).toBe(1);
    expect(loader.getLevel(1).levelId).toBe(2); // level 1 missing → first loaded
    expect(loader.hasLevel(1)).toBe(false);
  });

  it('throws only when no level could be loaded', async () => {
    const { loader } = makeLoader({});
    await loader.init();
    expect(() => loader.getLevel(1)).toThrow(/not loaded/);
  });

  it('builds zero-padded level URLs', () => {
    const { loader } = makeLoader({});
    expect(loader.getLevelUrl(7)).toBe('/d/levels/level-007.json');
  });
});

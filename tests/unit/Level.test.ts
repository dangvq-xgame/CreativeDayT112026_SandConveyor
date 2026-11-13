import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BalanceConfig, GameplayConfig } from '../../src/config/game.config';
import { GameState } from '../../src/game/GameState';
import { LevelValidator } from '../../src/game/level/LevelValidator';
import { settleState, simulateGreedyBot, stressTestRandomUnlockOrder } from '../../src/game/level/LevelSimulator';
import { normalizeLevelData } from '../../src/game/level/normalizeLevel';
import { ScrewMatchRule } from '../../src/game/rules/ScrewMatchRule';
import { LevelData } from '../../src/types/level.types';
import { createSeededRandom } from '../../src/utils/random';
import { bucketDef, makeLevel } from './helpers';

const ROOT = path.resolve(__dirname, '../..');
const LEVELS_DIR = path.join(ROOT, 'public/assets/data/levels');
const DOCS_LEVELS_DIR = path.join(ROOT, '_Docs/levels');
const palette: Array<{ colorId: number }> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/assets/data/palette.json'), 'utf8')
);
const levelFiles = fs.readdirSync(LEVELS_DIR).filter((f) => f.endsWith('.json')).sort();
const readLevel = (file: string): LevelData => JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, file), 'utf8'));

describe('LevelValidator', () => {
  it('accepts a consistent level', () => {
    expect(LevelValidator.validate(makeLevel())).toEqual({ valid: true, errors: [] });
  });

  it('never throws on garbage', () => {
    for (const bad of [null, 1, 'x', [], {}, { sandBoard: 5 }, { bucketQueue: [null], queueColumns: [{}] }]) {
      const res = LevelValidator.validate(bad);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });

  it('checks grid shape and colorIds', () => {
    const level = makeLevel();
    level.sandBoard.grid = [[1, 2, 1], [1.5, -2]];
    level.sandBoard.height = 3;
    const errors = LevelValidator.validate(level).errors.join('\n');
    expect(errors).toMatch(/Grid height 2 !== sandBoard.height 3/);
    expect(errors).toMatch(/Row 0 width 3/);
    expect(errors).toMatch(/Invalid colorId 1.5/);
    expect(errors).toMatch(/Invalid colorId -2/);
  });

  it('flags a bucket color that has no sand (regression: only sand colors were checked → unwinnable level passed)', () => {
    const level = makeLevel();
    level.bucketQueue.push(bucketDef(3, 7, 5));
    level.queueColumns[0].items.push({ colorId: 7 }, { colorId: 7 }, { colorId: 7 });
    const errors = LevelValidator.validate(level).errors;
    expect(errors).toContain('colorId 7: sand cells (0) !== bucket capacity (5)');
  });

  it('flags orphan screws of a color without bucket', () => {
    const level = makeLevel();
    level.queueColumns[1].items.push({ colorId: 9 });
    expect(LevelValidator.validate(level).errors).toContain(
      'colorId 9: screws (1) !== required screws of its buckets (0)'
    );
  });

  it('uses each bucket requiredScrews instead of a hard-coded 3 (regression)', () => {
    const level = makeLevel();
    level.bucketQueue[0].requiredScrews = 2;
    level.queueColumns[0].items.pop(); // one screw of color 1 less → 2 screws for 2 holes
    expect(LevelValidator.validate(level).valid).toBe(true);
  });

  it('checks bucket fields, ids and conveyor config', () => {
    const level = makeLevel();
    level.bucketQueue[1] = { id: 1, colorId: 2, capacity: 0, requiredScrews: -1 };
    level.conveyorConfig = { initialActiveSlots: 5, maxActiveSlots: 4, bufferSlots: 0 };
    const errors = LevelValidator.validate(level).errors.join('\n');
    expect(errors).toMatch(/Duplicate bucket id 1/);
    expect(errors).toMatch(/capacity must be a positive integer/);
    expect(errors).toMatch(/requiredScrews must be a positive integer/);
    expect(errors).toMatch(/initialActiveSlots must be <= maxActiveSlots/);
    expect(errors).toMatch(/bufferSlots must be >= 1/);
  });

  it('checks palette membership when a palette is given', () => {
    const level = makeLevel();
    expect(LevelValidator.validate(level, { knownColorIds: [1] }).errors.join('\n')).toMatch(/colorId 2 .* not in the palette/);
    expect(LevelValidator.validate(level, { knownColorIds: [1, 2] }).valid).toBe(true);
  });

  it('checks queue column indexes', () => {
    const level = makeLevel();
    level.queueColumns[1].columnIndex = 5;
    expect(LevelValidator.validate(level).errors.join('\n')).toMatch(/queueColumns\[1\].columnIndex is 5/);
  });
});

describe('normalizeLevelData', () => {
  it('fills defaults without mutating the input', () => {
    const raw = makeLevel() as Partial<LevelData>;
    delete raw.conveyorConfig;
    delete (raw.sandBoard as Partial<LevelData['sandBoard']>).subDivision;
    raw.bucketQueue![0] = { id: 1, colorId: 1, capacity: 2 } as never;
    const out = normalizeLevelData(raw as LevelData);
    expect(out.conveyorConfig).toEqual({
      initialActiveSlots: BalanceConfig.conveyor.defaultActiveSlots,
      maxActiveSlots: BalanceConfig.conveyor.maxActiveSlots,
      bufferSlots: BalanceConfig.bufferDock.defaultSlots
    });
    expect(out.sandBoard.subDivision).toBe(GameplayConfig.defaultSubDivision);
    expect(out.bucketQueue[0].requiredScrews).toBe(BalanceConfig.conveyor.holesPerBucket);
    expect(raw.conveyorConfig).toBeUndefined();
    out.sandBoard.grid[0][0] = 9;
    expect(raw.sandBoard!.grid[0][0]).toBe(1);
  });

  it('clamps initial slots to max and derives board size from the grid', () => {
    const raw = makeLevel({ conveyorConfig: { initialActiveSlots: 9, maxActiveSlots: 3, bufferSlots: 5 } });
    (raw.sandBoard as Partial<LevelData['sandBoard']>).width = undefined;
    const out = normalizeLevelData(raw);
    expect(out.conveyorConfig.initialActiveSlots).toBe(3);
    expect(out.sandBoard.width).toBe(2);
  });
});

describe('GameState', () => {
  it('builds every model from the level (GameState crashed on a missing conveyorConfig before)', () => {
    const raw = makeLevel() as Partial<LevelData>;
    delete raw.conveyorConfig;
    const state = new GameState(raw as LevelData);
    expect(state.conveyor.activeSlots).toBe(BalanceConfig.conveyor.defaultActiveSlots);
    expect(state.bufferDock.getCapacity()).toBe(BalanceConfig.bufferDock.defaultSlots);
    expect(state.queueColumns).toHaveLength(2);
    expect(state.getTotalQueueScrews()).toBe(6);
    expect(state.revivesRemaining).toBe(GameplayConfig.revivesPerLevel);
  });

  it('revive adds one buffer slot per available revive', () => {
    const state = new GameState(makeLevel());
    expect(state.canRevive()).toBe(true);
    expect(state.revive()).toBe(true);
    expect(state.bufferDock.getCapacity()).toBe(BalanceConfig.bufferDock.defaultSlots + 1);
    expect(state.canRevive()).toBe(false);
    expect(state.revive()).toBe(false);
  });

  it('is won only when the board is clear, the queue empty and every bucket full', () => {
    const state = new GameState(makeLevel());
    expect(state.isLevelWon()).toBe(false);
    const result = simulateGreedyBot(makeLevel());
    expect(result).toMatchObject({ won: true, steps: 6, remainingSand: 0 });
  });

  it('hasSafeMove reflects the lose condition', () => {
    const state = new GameState(
      makeLevel({ conveyorConfig: { initialActiveSlots: 1, maxActiveSlots: 4, bufferSlots: 1 } })
    );
    settleState(state, 0);
    expect(state.hasSafeMove()).toBe(true);
    state.bufferDock.reserveSlot(0, 2);
    // column tops: 1 (matches the only bucket) and 2 (would need the full buffer)
    expect(state.hasSafeMove()).toBe(true);
    state.queueColumns[0].popTop();
    expect(ScrewMatchRule.predictRoute(state.queueColumns[0], state.conveyor, state.bufferDock)).toBe('out_of_space');
    expect(state.hasSafeMove()).toBe(false); // both tops are color 2, buffer full → any tap loses
  });
});

describe('LevelSimulator', () => {
  it('reports out_of_space when the buffer is too small to dig', () => {
    const level = makeLevel({
      conveyorConfig: { initialActiveSlots: 1, maxActiveSlots: 4, bufferSlots: 1 },
      queueColumns: [
        { columnIndex: 0, rimColorId: 1, items: [{ colorId: 2 }, { colorId: 2 }, { colorId: 1 }] },
        { columnIndex: 1, rimColorId: 2, items: [{ colorId: 2 }, { colorId: 1 }, { colorId: 1 }] }
      ]
    });
    const res = simulateGreedyBot(level);
    expect(res.won).toBe(false);
    expect(['out_of_space', 'stuck']).toContain(res.reason);
  });

  it('stress test detects a sand deadlock (bucket capacity larger than its sand)', () => {
    const level = makeLevel({ bucketQueue: [bucketDef(1, 1, 5), bucketDef(2, 2, 2)] });
    expect(stressTestRandomUnlockOrder(level, 2, 5, createSeededRandom(1))).toBe(5);
    expect(stressTestRandomUnlockOrder(makeLevel(), 2, 20, createSeededRandom(1))).toBe(0);
  });
});

describe('shipped levels', () => {
  it('has 5 levels', () => {
    expect(levelFiles).toHaveLength(5);
  });

  for (const file of levelFiles) {
    describe(file, () => {
      const level = readLevel(file);

      it('is mirrored identically in _Docs/levels', () => {
        const a = fs.readFileSync(path.join(LEVELS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
        const b = fs.readFileSync(path.join(DOCS_LEVELS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
        expect(b).toBe(a);
      });

      it('passes LevelValidator with the shipped palette', () => {
        expect(LevelValidator.validate(level, { knownColorIds: palette.map((p) => p.colorId) }).errors).toEqual([]);
      });

      it('is solved by the greedy bot using the real rules', () => {
        const res = simulateGreedyBot(level);
        expect(res.won).toBe(true);
        expect(res.steps).toBe(level.queueColumns.reduce((a, c) => a + c.items.length, 0));
      });

      it('never sand-deadlocks with 2/3/4 slots (seeded random unlock order)', () => {
        for (const slots of [2, 3, 4]) {
          expect(stressTestRandomUnlockOrder(level, slots, 25, createSeededRandom(slots))).toBe(0);
        }
      });
    });
  }
});

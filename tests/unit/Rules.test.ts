import { describe, expect, it } from 'vitest';
import { GameplayConfig } from '../../src/config/game.config';
import { BufferDockModel } from '../../src/game/models/BufferDockModel';
import { SandBoardModel } from '../../src/game/models/SandBoardModel';
import { BoosterRule } from '../../src/game/rules/BoosterRule';
import { SandSuctionRule } from '../../src/game/rules/SandSuctionRule';
import { ScrewMatchRule } from '../../src/game/rules/ScrewMatchRule';
import { createSeededRandom } from '../../src/utils/random';
import { bucketDef, columnColors, makeColumn, makeConveyor, openBucket } from './helpers';

describe('ScrewMatchRule.popColumnTop', () => {
  it('sends a matching screw to the bucket hole and reveals the next mystery screw', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(5, 7);
    const col = makeColumn(2, [3, -4]);
    const res = ScrewMatchRule.popColumnTop(col, conveyor, dock, 50);
    expect(res.ok).toBe(true);
    expect(res.flight).toMatchObject({
      colorId: 3,
      sourceType: 'queue',
      sourceIndex: 2,
      sourceDepthIndex: 0,
      targetType: 'bucket',
      targetSlotIndex: 0,
      targetHoleIndex: 0
    });
    expect(conveyor.slots[0]!.holes[0].reserved).toBe(true);
    expect(col.peekTop()).toEqual({ colorId: 4, isMystery: false });
    expect(col.lastPopTimeMs).toBe(50);
    expect(dock.getUsedCount()).toBe(0);
  });

  it('sends a non-matching screw to the first free buffer slot with a reservation token', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(5, 7);
    dock.reserveSlot(0, 9);
    const res = ScrewMatchRule.popColumnTop(makeColumn(0, [8]), conveyor, dock, 0);
    expect(res.flight).toMatchObject({ targetType: 'buffer', targetSlotIndex: 1 });
    expect(res.flight!.bufferReservationId).toBe(dock.getReservationId(1));
    expect(dock.slots[1]).toMatchObject({ colorId: 8, landed: false });
  });

  it('sends a screw to the buffer when the matching bucket has all holes reserved', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const b = conveyor.slots[0]!;
    b.reserveHole(0, 3);
    b.reserveHole(1, 3);
    b.reserveHole(2, 3);
    const res = ScrewMatchRule.popColumnTop(makeColumn(0, [3]), conveyor, new BufferDockModel(5, 7), 0);
    expect(res.flight?.targetType).toBe('buffer');
  });

  it('never routes to an open bucket', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    openBucket(conveyor.slots[0]!);
    const res = ScrewMatchRule.popColumnTop(makeColumn(0, [3]), conveyor, new BufferDockModel(5, 7), 0);
    expect(res.flight?.targetType).toBe('buffer');
  });

  it('buffer full + no matching bucket → outOfSpace, column untouched, bonk stamped', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(2, 7);
    dock.reserveSlot(0, 1);
    dock.reserveSlot(1, 1);
    const col = makeColumn(0, [8, 3]);
    expect(ScrewMatchRule.predictRoute(col, conveyor, dock)).toBe('out_of_space');
    const res = ScrewMatchRule.popColumnTop(col, conveyor, dock, 77);
    expect(res).toEqual({ ok: false, outOfSpace: true });
    expect(columnColors(col)).toEqual([8, 3]);
    expect(col.lastBonkTimeMs).toBe(77);
  });

  it('buffer full but the screw matches a bucket → still OK (not a lose)', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(1, 7);
    dock.reserveSlot(0, 1);
    expect(ScrewMatchRule.popColumnTop(makeColumn(0, [3]), conveyor, dock, 0).ok).toBe(true);
  });

  it('empty column → not ok, not out of space', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const col = makeColumn(0, []);
    expect(ScrewMatchRule.predictRoute(col, conveyor, new BufferDockModel())).toBe('empty');
    expect(ScrewMatchRule.popColumnTop(col, conveyor, new BufferDockModel(), 0)).toEqual({ ok: false, outOfSpace: false });
  });

  it('hasSafeMove is false only when every tap would lose', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(1, 7);
    dock.reserveSlot(0, 1);
    const cols = [makeColumn(0, [8]), makeColumn(1, [])];
    expect(ScrewMatchRule.hasSafeMove(cols, conveyor, dock)).toBe(false);
    cols.push(makeColumn(2, [3]));
    expect(ScrewMatchRule.hasSafeMove(cols, conveyor, dock)).toBe(true);
  });
});

describe('ScrewMatchRule.flushBufferToConveyor', () => {
  it('only flushes landed screws, into the matching bucket', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(5, 7);
    dock.reserveSlot(0, 3); // still flying
    dock.reserveSlot(1, 3);
    dock.markSlotLanded(1);
    dock.reserveSlot(2, 5);
    dock.markSlotLanded(2);
    const plans = ScrewMatchRule.flushBufferToConveyor(conveyor, dock);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ sourceType: 'buffer', sourceIndex: 1, targetType: 'bucket', targetHoleIndex: 0 });
    expect(dock.slots[0]).not.toBeNull();
    expect(dock.slots[1]).toBeNull();
    expect(dock.slots[2]?.colorId).toBe(5);
  });

  it('stops when the bucket has no free hole left', () => {
    const conveyor = makeConveyor([bucketDef(1, 3)], 1);
    const dock = new BufferDockModel(5, 7);
    for (let i = 0; i < 4; i++) {
      dock.reserveSlot(i, 3);
      dock.markSlotLanded(i);
    }
    expect(ScrewMatchRule.flushBufferToConveyor(conveyor, dock)).toHaveLength(3);
    expect(dock.getUsedCount()).toBe(1);
  });
});

describe('SandSuctionRule', () => {
  it('waits for the lid animation before draining (default delay from config)', () => {
    const board = new SandBoardModel(1, 1, 4, [[2]]);
    const conveyor = makeConveyor([bucketDef(1, 2, 1)], 1);
    openBucket(conveyor.slots[0]!, 1000);
    expect(SandSuctionRule.stepSuction(board, conveyor, 1000 + GameplayConfig.lidOpenReadyDelayMs - 1)).toBeNull();
    const ev = SandSuctionRule.stepSuction(board, conveyor, 1000 + GameplayConfig.lidOpenReadyDelayMs);
    expect(ev).toMatchObject({ col: 0, row: 0, colorId: 2, bucketCompleted: true, slotIndex: 0 });
  });

  it('never over-fills a bucket', () => {
    const board = new SandBoardModel(3, 1, 4, [[2, 2, 2]]);
    const conveyor = makeConveyor([bucketDef(1, 2, 2)], 1);
    const b = conveyor.slots[0]!;
    openBucket(b, 0);
    expect(SandSuctionRule.stepSuction(board, conveyor, 0, 0)?.bucketCompleted).toBe(false);
    expect(SandSuctionRule.stepSuction(board, conveyor, 0, 0)?.bucketCompleted).toBe(true);
    expect(SandSuctionRule.stepSuction(board, conveyor, 0, 0)).toBeNull();
    expect(b.collected).toBe(2);
    expect(board.getRemainingCells()).toBe(1);
  });

  it('flags waitingForSand when no sand of the color is left and tries the next bucket', () => {
    const board = new SandBoardModel(1, 1, 4, [[5]]);
    const conveyor = makeConveyor([bucketDef(1, 2, 3), bucketDef(2, 5, 1)], 2);
    const [a, b] = conveyor.getActiveBuckets();
    openBucket(a, 0);
    openBucket(b, 0);
    const ev = SandSuctionRule.stepSuction(board, conveyor, 0, 0);
    expect(ev?.bucket).toBe(b);
    expect(a.waitingForSand).toBe(true);
    expect(b.waitingForSand).toBe(false);
  });

  it('completes an open zero-capacity bucket so it can leave the belt (regression: blocked the slot forever)', () => {
    const board = new SandBoardModel(1, 1, 4, [[1]]);
    const conveyor = makeConveyor([bucketDef(1, 2, 0)], 1);
    openBucket(conveyor.slots[0]!, 0);
    expect(SandSuctionRule.stepSuction(board, conveyor, 10, 0)).toBeNull();
    expect(conveyor.slots[0]!.completedAtMs).toBe(10);
    expect(conveyor.releaseCompletedBuckets(1000)).toHaveLength(1);
  });

  it('prefers the board column right above the bucket', () => {
    expect(SandSuctionRule.getPreferredColumn(65, 60, 10, 5)).toBe(0);
    expect(SandSuctionRule.getPreferredColumn(79, 60, 10, 5)).toBe(1); // floor, not round
    expect(SandSuctionRule.getPreferredColumn(-500, 60, 10, 5)).toBe(0);
    expect(SandSuctionRule.getPreferredColumn(5000, 60, 10, 5)).toBe(4);

    const board = new SandBoardModel(3, 1, 4, [[4, 4, 4]]);
    const conveyor = makeConveyor([bucketDef(1, 4, 3)], 1);
    const b = conveyor.slots[0]!;
    openBucket(b, 0);
    b.visualX = 60 + 2 * 10 + 5; // over column 2
    expect(SandSuctionRule.stepSuction(board, conveyor, 0, 0, 10, 60)?.col).toBe(2);
  });

  it('orders candidates: most collected first, then oldest', () => {
    const conveyor = makeConveyor([bucketDef(1, 4, 9), bucketDef(2, 4, 9)], 2);
    const [a, b] = conveyor.getActiveBuckets();
    openBucket(a, 0);
    openBucket(b, 0);
    expect(SandSuctionRule.getSuctionCandidates(conveyor, 0, 0).map((c) => c.bucket)).toEqual([a, b]);
    b.collected = 1;
    expect(SandSuctionRule.getSuctionCandidates(conveyor, 0, 0).map((c) => c.bucket)).toEqual([b, a]);
  });
});

describe('BoosterRule — availability helpers', () => {
  it('reports when each booster can be used', () => {
    const conveyor = makeConveyor([bucketDef(1, 3), bucketDef(2, 4)], 2, 3);
    expect(BoosterRule.canUseExtraSlot(conveyor)).toBe(true);
    expect(BoosterRule.useExtraSlot(conveyor)).toBe(true);
    expect(BoosterRule.canUseExtraSlot(conveyor)).toBe(false);
    expect(BoosterRule.useExtraSlot(conveyor)).toBe(false);
    expect(BoosterRule.canUseHand(conveyor)).toBe(true);
    conveyor.getActiveBuckets().forEach((b) => openBucket(b));
    expect(BoosterRule.canUseHand(conveyor)).toBe(false);
    expect(BoosterRule.canUseShuffle([makeColumn(0, [1])])).toBe(false);
    expect(BoosterRule.canUseShuffle([makeColumn(0, [1]), makeColumn(1, [2])])).toBe(true);
  });
});

describe('BoosterRule.useHandOnBucket', () => {
  it('pulls landed buffer screws first, then the shallowest queue screw at any depth', () => {
    const conveyor = makeConveyor([bucketDef(1, 6)], 1);
    const bucket = conveyor.slots[0]!;
    const dock = new BufferDockModel(5, 7);
    dock.reserveSlot(2, 6);
    dock.markSlotLanded(2);
    const cols = [makeColumn(0, [1, 1, 1, 6]), makeColumn(1, [2, -6, 6])];
    const res = BoosterRule.useHandOnBucket(bucket, 0, dock, cols);
    expect(res.ok).toBe(true);
    expect(res.flights.map((f) => [f.sourceType, f.sourceIndex, f.sourceDepthIndex, f.targetHoleIndex])).toEqual([
      ['buffer', 2, undefined, 0],
      ['queue', 1, 1, 1],
      ['queue', 1, 1, 2]
    ]);
    expect(dock.getUsedCount()).toBe(0);
    expect(columnColors(cols[1])).toEqual([2]);
    expect(columnColors(cols[0])).toEqual([1, 1, 1, 6]);
    expect(bucket.getMissingScrewsCount()).toBe(0);
    expect(res.flights.every((f) => !f.isPhantom)).toBe(true);
  });

  it('only fills the missing holes', () => {
    const conveyor = makeConveyor([bucketDef(1, 6)], 1);
    const bucket = conveyor.slots[0]!;
    bucket.landScrewInHole(0, 0);
    bucket.reserveHole(1, 6);
    const cols = [makeColumn(0, [6, 6, 6])];
    const res = BoosterRule.useHandOnBucket(bucket, 0, new BufferDockModel(), cols);
    expect(res.flights).toHaveLength(1);
    expect(res.flights[0].targetHoleIndex).toBe(2);
    expect(cols[0].getItemCount()).toBe(2);
  });

  it('takes an in-flight buffer screw before conjuring one (regression: phantom screw + stranded buffer screw)', () => {
    const conveyor = makeConveyor([bucketDef(1, 6)], 1);
    const bucket = conveyor.slots[0]!;
    bucket.landScrewInHole(0, 0);
    bucket.landScrewInHole(1, 0);
    const dock = new BufferDockModel(5, 7);
    dock.reserveSlot(0, 6); // the last screw of color 6 is still flying to the buffer
    const staleToken = dock.getReservationId(0)!;
    const res = BoosterRule.useHandOnBucket(bucket, 0, dock, [makeColumn(0, [1])]);
    expect(res.flights).toHaveLength(1);
    expect(res.flights[0]).toMatchObject({ sourceType: 'buffer', sourceIndex: 0 });
    expect(res.flights[0].isPhantom).toBeUndefined();
    expect(dock.getUsedCount()).toBe(0);
    // A new screw re-uses slot 0; the old flight landing must not mark it.
    dock.reserveSlot(0, 2);
    expect(dock.markSlotLanded(0, staleToken)).toBe(false);
  });

  it('still unlocks with phantom screws when none exist anywhere (inconsistent data)', () => {
    const conveyor = makeConveyor([bucketDef(1, 6)], 1);
    const res = BoosterRule.useHandOnBucket(conveyor.slots[0]!, 0, new BufferDockModel(), [makeColumn(0, [1])]);
    expect(res.ok).toBe(true);
    expect(res.flights).toHaveLength(3);
    expect(res.flights.every((f) => f.isPhantom)).toBe(true);
  });

  it('refuses open buckets and buckets with every hole already taken', () => {
    const conveyor = makeConveyor([bucketDef(1, 6), bucketDef(2, 7)], 2);
    const [open, reserved] = conveyor.getActiveBuckets();
    openBucket(open);
    [0, 1, 2].forEach((h) => reserved.reserveHole(h, 7));
    expect(BoosterRule.useHandOnBucket(open, 0, new BufferDockModel(), [])).toEqual({ ok: false, flights: [] });
    expect(BoosterRule.useHandOnBucket(reserved, 1, new BufferDockModel(), [])).toEqual({ ok: false, flights: [] });
  });
});

describe('BoosterRule.useShuffleWithPriority', () => {
  function setup() {
    const conveyor = makeConveyor([bucketDef(1, 4), bucketDef(2, 10)], 2);
    const cols = [
      makeColumn(0, [1, 1, 4, 9]),
      makeColumn(1, [6, 6, 10]),
      makeColumn(2, [9, -9, 4]),
      makeColumn(3, [])
    ];
    return { conveyor, cols };
  }

  it('is deterministic for a seeded RNG and keeps every column length and the screw multiset', () => {
    const a = setup();
    const b = setup();
    BoosterRule.useShuffleWithPriority(a.conveyor, a.cols, 2, createSeededRandom(1));
    BoosterRule.useShuffleWithPriority(b.conveyor, b.cols, 2, createSeededRandom(1));
    expect(a.cols.map(columnColors)).toEqual(b.cols.map(columnColors));
    expect(a.cols.map((c) => c.getItemCount())).toEqual([4, 3, 3, 0]);
    const all = a.cols.flatMap(columnColors).sort((x, y) => x - y);
    expect(all).toEqual([1, 1, 4, 4, 6, 6, 9, 9, 9, 10]);
  });

  it('guarantees >= 2 priority tops for many seeds and reveals every top', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { conveyor, cols } = setup();
      const res = BoosterRule.useShuffleWithPriority(conveyor, cols, 2, createSeededRandom(seed));
      expect(res.ok).toBe(true);
      expect(res.totalScrews).toBe(10);
      expect(res.priorityTopMatches).toBeGreaterThanOrEqual(2);
      const tops = cols.map((c) => c.peekTop()).filter((t) => t !== null);
      expect(tops.filter((t) => t!.colorId === 4 || t!.colorId === 10).length).toBeGreaterThanOrEqual(2);
      expect(tops.every((t) => !t!.isMystery)).toBe(true);
    }
  });

  it('ignores buckets that need no more screws (regression: prioritized a fully-reserved bucket)', () => {
    const conveyor = makeConveyor([bucketDef(1, 4), bucketDef(2, 10)], 2);
    const [full] = conveyor.getActiveBuckets();
    [0, 1, 2].forEach((h) => full.reserveHole(h, 4)); // color 4 needs nothing anymore
    for (let seed = 0; seed < 50; seed++) {
      const cols = [makeColumn(0, [4, 4, 1]), makeColumn(1, [4, 10, 1]), makeColumn(2, [1, 1, 10])];
      BoosterRule.useShuffleWithPriority(conveyor, cols, 2, createSeededRandom(seed));
      const tops = cols.map((c) => c.peekTop()!.colorId);
      expect(tops.filter((t) => t === 10)).toHaveLength(2);
    }
  });

  it('uses the next queued bucket color when no locked bucket is on the belt', () => {
    const conveyor = makeConveyor([bucketDef(1, 4), bucketDef(2, 7)], 1);
    openBucket(conveyor.slots[0]!);
    const cols = [makeColumn(0, [1, 1, 7]), makeColumn(1, [1, 7, 1])];
    BoosterRule.useShuffleWithPriority(conveyor, cols, 2, createSeededRandom(3));
    expect(cols.map((c) => c.peekTop()!.colorId)).toEqual([7, 7]);
  });

  it('is robust to an RNG returning 1 (regression: out-of-range swap corrupted columns)', () => {
    const { conveyor, cols } = setup();
    const res = BoosterRule.useShuffleWithPriority(conveyor, cols, 2, () => 1);
    expect(res.ok).toBe(true);
    expect(cols.flatMap((c) => c.items).every((it) => it && typeof it.colorId === 'number')).toBe(true);
    expect(cols.flatMap(columnColors)).toHaveLength(10);
  });

  it('does nothing with fewer than 2 screws', () => {
    const conveyor = makeConveyor([bucketDef(1, 4)], 1);
    const cols = [makeColumn(0, [9]), makeColumn(1, [])];
    expect(BoosterRule.useShuffleWithPriority(conveyor, cols, 2, createSeededRandom(1))).toEqual({ ok: false, totalScrews: 1 });
    expect(columnColors(cols[0])).toEqual([9]);
  });

  it('handles minPriorityTopMatches larger than the column count or zero', () => {
    const { conveyor, cols } = setup();
    expect(BoosterRule.useShuffleWithPriority(conveyor, cols, 99, createSeededRandom(5)).ok).toBe(true);
    expect(cols.map((c) => c.getItemCount())).toEqual([4, 3, 3, 0]);
    expect(BoosterRule.useShuffleWithPriority(conveyor, cols, 0, createSeededRandom(5)).ok).toBe(true);
  });
});

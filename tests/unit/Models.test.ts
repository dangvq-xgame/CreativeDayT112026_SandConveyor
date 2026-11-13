import { describe, expect, it } from 'vitest';
import { BalanceConfig, GameplayConfig } from '../../src/config/game.config';
import { BufferDockModel } from '../../src/game/models/BufferDockModel';
import { LinearConveyorModel } from '../../src/game/models/LinearConveyorModel';
import { QueueColumnModel } from '../../src/game/models/QueueColumnModel';
import { SandBoardModel } from '../../src/game/models/SandBoardModel';
import { SandBucketModel } from '../../src/game/models/SandBucketModel';
import { bucketDef, columnColors, makeColumn, makeConveyor, openBucket } from './helpers';

describe('SandBucketModel', () => {
  it('defaults requiredScrews to balance.holesPerBucket and sanitizes capacity', () => {
    const b = new SandBucketModel({ id: 1, colorId: 3, capacity: -5, requiredScrews: 0 }, 1);
    expect(b.requiredScrews).toBe(BalanceConfig.conveyor.holesPerBucket);
    expect(b.holes).toHaveLength(BalanceConfig.conveyor.holesPerBucket);
    expect(b.capacity).toBe(0);
  });

  it('tracks holes: reserve → land → lid opens only on the last landing', () => {
    const b = new SandBucketModel(bucketDef(1, 6, 10), 1);
    expect(b.getFirstAvailableHoleIndex()).toBe(0);
    expect(b.reserveHole(0, 6)).toBe(true);
    expect(b.reserveHole(0, 6)).toBe(false);
    expect(b.getMissingScrewsCount()).toBe(2);
    expect(b.getTakenHolesCount()).toBe(1);
    expect(b.landScrewInHole(0, 10)).toBe(false);
    expect(b.landScrewInHole(1, 20)).toBe(false);
    expect(b.isOpen).toBe(false);
    expect(b.landScrewInHole(2, 30)).toBe(true);
    expect(b.isOpen).toBe(true);
    expect(b.openStartedAtMs).toBe(30);
    expect(b.getFirstAvailableHoleIndex()).toBe(-1);
    expect(b.getMissingScrewsCount()).toBe(0);
    expect(b.reserveHole(1, 6)).toBe(false);
  });

  it('ignores invalid hole indexes and double landings', () => {
    const b = new SandBucketModel(bucketDef(1, 6), 1);
    expect(b.reserveHole(-1, 6)).toBe(false);
    expect(b.reserveHole(3, 6)).toBe(false);
    expect(b.reserveHole(0.5, 6)).toBe(false);
    expect(b.landScrewInHole(7, 0)).toBe(false);
    b.landScrewInHole(0, 100);
    expect(b.landScrewInHole(0, 200)).toBe(false);
    expect(b.holes[0].landedAtMs).toBe(100);
    expect(b.getLandedScrewsCount()).toBe(1);
  });

  it('canAcceptScrew requires the same color and a free hole', () => {
    const b = new SandBucketModel(bucketDef(1, 4), 1);
    expect(b.canAcceptScrew(4)).toBe(true);
    expect(b.canAcceptScrew(5)).toBe(false);
    b.reserveHole(0, 4);
    b.reserveHole(1, 4);
    b.reserveHole(2, 4);
    expect(b.canAcceptScrew(4)).toBe(false);
  });

  it('fills 0 → 100% without overflow and completes once', () => {
    const b = new SandBucketModel(bucketDef(1, 2, 4), 1);
    openBucket(b, 0);
    expect(b.getPercentage()).toBe(0);
    expect(b.addSand(1, 10)).toBe(1);
    expect(b.getPercentage()).toBe(25);
    expect(b.addSand(10, 20)).toBe(3); // clamped
    expect(b.collected).toBe(4);
    expect(b.isFull()).toBe(true);
    expect(b.getPercentage()).toBe(100);
    expect(b.completedAtMs).toBe(20);
    expect(b.addSand(1, 30)).toBe(0);
    expect(b.completedAtMs).toBe(20);
    expect(b.addSand(Number.NaN, 30)).toBe(0);
  });

  it('never shows 100% before really full (regression: 199/200 rounded to 100%)', () => {
    const b = new SandBucketModel(bucketDef(1, 2, 200), 1);
    openBucket(b);
    b.collected = 199;
    expect(b.isFull()).toBe(false);
    expect(b.getPercentage()).toBe(99);
    b.collected = 1;
    expect(b.getPercentage()).toBe(1); // 0.5% rounds to 1 as before
  });

  it('isReadyForSand waits for the lid animation', () => {
    const b = new SandBucketModel(bucketDef(1, 2, 4), 1);
    expect(b.isReadyForSand(1000, 0)).toBe(false);
    openBucket(b, 100);
    expect(b.isReadyForSand(500, 630)).toBe(false);
    expect(b.isReadyForSand(730, 630)).toBe(true);
  });

  it('a zero-capacity bucket completes as soon as it opens', () => {
    const b = new SandBucketModel(bucketDef(1, 2, 0), 1);
    expect(b.markCompletedIfFull(5)).toBe(false); // still locked
    openBucket(b, 5);
    expect(b.markCompletedIfFull(6)).toBe(true);
    expect(b.isCompleted()).toBe(true);
  });
});

describe('SandBoardModel', () => {
  it('normalizes the grid to width × height (regression: ragged grid made the board unwinnable)', () => {
    const board = new SandBoardModel(2, 2, 4, [[1, 2, 3], [4], [5, 5]]);
    expect(board.cells).toHaveLength(2);
    expect(board.cells.every((r) => r.length === 2)).toBe(true);
    expect(board.totalInitialCells).toBe(3); // 1,2 + 4 (third value and third row dropped)
    expect(board.getCell(1, 1)).toBeNull();
  });

  it('treats invalid colorIds as empty', () => {
    const board = new SandBoardModel(3, 1, 4, [[-1, 1.5, Number.NaN]]);
    expect(board.totalInitialCells).toBe(0);
    expect(board.getProgressRatio()).toBe(1);
    expect(board.isCleared()).toBe(true);
  });

  it('defaults an invalid subDivision', () => {
    expect(new SandBoardModel(1, 1, 0, [[1]]).subDivision).toBe(GameplayConfig.defaultSubDivision);
  });

  it('drains bottom cells, applies gravity and tracks progress', () => {
    const board = new SandBoardModel(1, 3, 4, [[2], [1], [1]]);
    expect(board.getLowestRow(0)).toBe(2);
    const p = board.pullBottomCellOfColor(1, 10);
    expect(p).toEqual({ col: 0, row: 2, colorId: 1 });
    expect(board.getCell(0, 2)?.colorId).toBe(1);
    expect(board.getCell(0, 2)?.offsetY).toBe(-10);
    expect(board.getCell(0, 1)?.colorId).toBe(2);
    expect(board.getCell(0, 0)).toBeNull();
    expect(board.getRemainingCells()).toBe(2);
    expect(board.getProgressRatio()).toBeCloseTo(1 / 3);
    expect(board.countCellsOfColor(1)).toBe(1);
    expect([...board.getRemainingColorCounts()]).toEqual([
      [2, 1],
      [1, 1]
    ]);
    expect(board.isSettled()).toBe(false);
    for (let i = 0; i < 60; i++) board.updateGravity(1 / 60, 2400);
    expect(board.isSettled()).toBe(true);
    expect(board.getCell(0, 2)?.velocityY).toBe(0);
  });

  it('ignores invalid gravity steps', () => {
    const board = new SandBoardModel(1, 2, 4, [[1], [1]]);
    board.pullBottomCellOfColor(1, 10);
    board.updateGravity(-1);
    board.updateGravity(Number.NaN);
    expect(board.getCell(0, 1)?.offsetY).toBe(-10);
  });

  it('prefers the lowest row, then lowest origin stratum, then the preferred column', () => {
    const board = new SandBoardModel(3, 2, 4, [
      [0, 0, 0],
      [1, 1, 1]
    ]);
    expect(board.findPullCandidate(1, 2)?.col).toBe(2);
    expect(board.findPullCandidate(1)?.col).toBe(0);
    expect(board.findPullCandidate(9)).toBeNull();
  });

  it('falls back to buried cells so an open bucket never deadlocks', () => {
    const board = new SandBoardModel(1, 3, 4, [[1], [2], [3]]);
    const p = board.pullBottomCellOfColor(2, 10);
    expect(p).toEqual({ col: 0, row: 1, colorId: 2 });
    expect(board.getCell(0, 2)?.colorId).toBe(3); // untouched below
    expect(board.getCell(0, 1)?.colorId).toBe(1); // fell from above
  });

  it('becomes cleared after draining every cell', () => {
    const board = new SandBoardModel(2, 1, 4, [[1, 2]]);
    board.pullBottomCellOfColor(1);
    board.pullBottomCellOfColor(2);
    expect(board.pullBottomCellOfColor(1)).toBeNull();
    expect(board.isCleared()).toBe(true);
    expect(board.getProgressRatio()).toBe(1);
  });
});

describe('BufferDockModel', () => {
  it('reserves, lands and takes screws', () => {
    const dock = new BufferDockModel(3, 5);
    expect(dock.getCapacity()).toBe(3);
    expect(dock.reserveSlot(0, 4)).toBe(true);
    expect(dock.reserveSlot(0, 5)).toBe(false);
    expect(dock.reserveSlot(9, 5)).toBe(false);
    expect(dock.reserveSlot(1.5, 5)).toBe(false);
    expect(dock.getUsedCount()).toBe(1);
    expect(dock.getLandedCount()).toBe(0);
    expect(dock.findSlotOfColor(4)).toBe(-1);
    expect(dock.findSlotOfColor(4, false)).toBe(0);
    expect(dock.markSlotLanded(0)).toBe(true);
    expect(dock.findSlotOfColor(4)).toBe(0);
    expect(dock.takeScrewAt(0)?.colorId).toBe(4);
    expect(dock.takeScrewAt(0)).toBeNull();
    expect(dock.markSlotLanded(0)).toBe(false);
  });

  it('a stale landing cannot mark another screw that re-used the slot (reservation token)', () => {
    const dock = new BufferDockModel(2, 2);
    dock.reserveSlot(0, 4);
    const first = dock.getReservationId(0)!;
    dock.takeScrewAt(0); // e.g. taken mid-flight by the Hand booster
    dock.reserveSlot(0, 7);
    expect(dock.markSlotLanded(0, first)).toBe(false);
    expect(dock.slots[0]?.landed).toBe(false);
    expect(dock.markSlotLanded(0, dock.getReservationId(0)!)).toBe(true);
  });

  it('is full when every slot is used (lose condition input)', () => {
    const dock = new BufferDockModel(2, 3);
    dock.reserveSlot(0, 1);
    expect(dock.isFull()).toBe(false);
    dock.reserveSlot(1, 1);
    expect(dock.isFull()).toBe(true);
    expect(dock.findFirstEmptySlotIndex()).toBe(-1);
  });

  it('revive adds slots up to the max', () => {
    const dock = new BufferDockModel(5, 7);
    expect(dock.addReviveSlot()).toBe(true);
    expect(dock.addReviveSlot()).toBe(true);
    expect(dock.canAddReviveSlot()).toBe(false);
    expect(dock.addReviveSlot()).toBe(false);
    expect(dock.getCapacity()).toBe(7);
  });

  it('sanitizes constructor arguments', () => {
    const dock = new BufferDockModel(0, 2);
    expect(dock.getCapacity()).toBe(BalanceConfig.bufferDock.defaultSlots);
    expect(dock.maxReviveSlots).toBe(BalanceConfig.bufferDock.defaultSlots);
    expect(new BufferDockModel(4, 1).maxReviveSlots).toBe(4);
  });
});

describe('QueueColumnModel', () => {
  it('reveals the top mystery screw, pops FIFO and reveals the next one', () => {
    const col = makeColumn(0, [-3, -4, 5, -6]);
    expect(col.peekTop()).toEqual({ colorId: 3, isMystery: false });
    expect(col.isHiddenAt(0)).toBe(false);
    expect(col.isHiddenAt(1)).toBe(true);
    expect(col.popTop(123)?.colorId).toBe(3);
    expect(col.lastPopTimeMs).toBe(123);
    expect(col.peekTop()).toEqual({ colorId: 4, isMystery: false });
    expect(columnColors(col)).toEqual([4, 5, 6]);
  });

  it('visible window and +N hidden count', () => {
    const col = makeColumn(0, [1, 2, 3, 4, 5]);
    expect(col.getVisibleItems(3).map((i) => i.colorId)).toEqual([1, 2, 3]);
    expect(col.getHiddenCount(3)).toBe(2);
    expect(col.getHiddenCount(10)).toBe(0);
    expect(col.getVisibleItems(-1)).toEqual([]);
  });

  it('removeAt / findDepthOfColor / takeAll / setItems', () => {
    const col = makeColumn(0, [1, -2, 3]);
    expect(col.findDepthOfColor(2)).toBe(1);
    expect(col.removeAt(0)?.colorId).toBe(1);
    expect(col.peekTop()).toEqual({ colorId: 2, isMystery: false });
    expect(col.removeAt(5)).toBeNull();
    expect(col.takeAll().map((i) => i.colorId)).toEqual([2, 3]);
    expect(col.isEmpty()).toBe(true);
    expect(col.popTop()).toBeNull();
    col.setItems([{ colorId: 9, isMystery: true }]);
    expect(col.peekTop()).toEqual({ colorId: 9, isMystery: false });
  });

  it('starts with neutral "never" timestamps and copies its definition', () => {
    const def = { columnIndex: 2, rimColorId: 1, items: [{ colorId: 1 }] };
    const col = new QueueColumnModel(def);
    col.popTop();
    expect(def.items).toHaveLength(1);
    expect(new QueueColumnModel(def).lastBonkTimeMs).toBe(GameplayConfig.neverMs);
  });
});

describe('LinearConveyorModel', () => {
  const defs = [bucketDef(1, 9), bucketDef(2, 10), bucketDef(3, 9), bucketDef(4, 10), bucketDef(5, 1)];

  it('clamps slot configuration', () => {
    expect(new LinearConveyorModel(defs, 9, 4).activeSlots).toBe(4);
    expect(new LinearConveyorModel(defs, 0, 4).activeSlots).toBe(BalanceConfig.conveyor.defaultActiveSlots);
    const c = new LinearConveyorModel(defs, 2, 0);
    expect(c.maxActiveSlots).toBe(BalanceConfig.conveyor.maxActiveSlots);
    expect(c.slots).toHaveLength(c.maxActiveSlots);
  });

  it('does not mutate the level definition queue', () => {
    const src = [bucketDef(1, 9)];
    const c = makeConveyor(src);
    expect(c.queue).toHaveLength(0);
    expect(src).toHaveLength(1);
  });

  it('spawns into active slots only, 2 → 3 → 4 via ExtraSlot', () => {
    const c = makeConveyor(defs, 2, 4);
    expect(c.getActiveBuckets().map((b) => b.id)).toEqual([1, 2]);
    expect(c.canUnlockExtraSlot()).toBe(true);
    expect(c.unlockExtraSlot()).toBe(true);
    expect(c.getActiveBuckets().map((b) => b.id)).toEqual([1, 2, 3]);
    expect(c.unlockExtraSlot()).toBe(true);
    expect(c.activeSlots).toBe(4);
    expect(c.unlockExtraSlot()).toBe(false);
    expect(c.getActiveBuckets().map((b) => b.spawnSeq)).toEqual([1, 2, 3, 4]);
    expect(c.queue.map((q) => q.id)).toEqual([5]);
  });

  it('without forceImmediate only spawns while the slot is inside a tunnel', () => {
    const c = new LinearConveyorModel(defs, 1, 4);
    // slot 0 at phase 0.14 * 500 = 70 → visible between 40 and 460
    expect(c.getSlotX(0, 0, 500)).toBeCloseTo(70);
    expect(c.refillSlots(0, 500, 40, 460)).toHaveLength(0);
    c.advanceBelt(400 / BalanceConfig.conveyor.beltSpeedPxPerSec); // +400px → x = 470 (right tunnel)
    expect(c.getSlotX(0, 0, 500)).toBeCloseTo(470);
    expect(c.refillSlots(0, 500, 40, 460)).toHaveLength(1);
  });

  it('slides a bucket spawned in the visible area in from the left tunnel', () => {
    const c = new LinearConveyorModel(defs, 1, 4);
    const [b] = c.refillSlots(0, 500, 40, 460, true, true);
    expect(b.visualX).toBe(0);
    expect(b.spawnEnterOffsetPx).toBeCloseTo(70);
    c.updateBucketPositions(0.1, 0, 500, 340);
    expect(b.spawnEnterOffsetPx).toBeCloseTo(36);
    expect(b.visualX).toBeCloseTo(34);
    c.updateBucketPositions(1, 0, 500, 340);
    expect(b.spawnEnterOffsetPx).toBe(0);
    expect(b.visualX).toBeCloseTo(70);
  });

  it('spaces active slots evenly and wraps around the track', () => {
    const c = new LinearConveyorModel(defs, 2, 4);
    expect(c.getSlotX(1, 0, 500) - c.getSlotX(0, 0, 500)).toBeCloseTo(250);
    c.advanceBelt(1000);
    const x = c.getSlotX(0, 0, 500);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(500);
  });

  it('ignores invalid belt steps', () => {
    const c = new LinearConveyorModel(defs, 2, 4);
    c.advanceBelt(-1);
    c.advanceBelt(Number.NaN);
    c.advanceBelt(1, Number.NaN); // invalid multiplier → 1
    expect(c.getBeltTravelDistancePx()).toBeCloseTo(BalanceConfig.conveyor.beltSpeedPxPerSec);
    c.advanceBelt(1, 2);
    expect(c.getBeltTravelDistancePx()).toBeCloseTo(3 * BalanceConfig.conveyor.beltSpeedPxPerSec);
  });

  it('routes a screw to the same-color bucket closest to opening (regression: split screws between buckets)', () => {
    const c = makeConveyor([bucketDef(1, 7), bucketDef(2, 7)], 2, 4);
    const [older, newer] = c.getActiveBuckets();
    newer.reserveHole(0, 7);
    newer.reserveHole(1, 7);
    const target = c.findTargetBucketForScrew(7)!;
    expect(target.bucket).toBe(newer);
    expect(target.holeIndex).toBe(2);
    newer.reserveHole(2, 7);
    expect(c.findTargetBucketForScrew(7)!.bucket).toBe(older);
    expect(c.findTargetBucketForScrew(8)).toBeNull();
  });

  it('ties go to the oldest bucket', () => {
    const c = makeConveyor([bucketDef(1, 7), bucketDef(2, 7)], 2, 4);
    expect(c.findTargetBucketForScrew(7)!.bucket.spawnSeq).toBe(1);
  });

  it('releases completed buckets after the despawn delay and refills the slot', () => {
    const c = makeConveyor([bucketDef(1, 7, 1), bucketDef(2, 8, 1), bucketDef(3, 9, 1)], 2, 4);
    const first = c.slots[0]!;
    openBucket(first, 0);
    first.addSand(1, 1000);
    expect(c.getRemainingBucketCount()).toBe(2);
    expect(c.releaseCompletedBuckets(1000 + GameplayConfig.bucketDespawnDelayMs)).toHaveLength(0);
    expect(c.releaseCompletedBuckets(1001 + GameplayConfig.bucketDespawnDelayMs)).toEqual([first]);
    expect(c.slots[0]).toBeNull();
    expect(c.leavingBuckets).toEqual([first]);
    expect(c.refillSlots(0, 500, 40, 460, true).map((b) => b.id)).toEqual([3]);

    first.visualX = 400;
    expect(c.advanceLeavingBuckets(0.1, 500, 420)).toHaveLength(0);
    expect(first.visualX).toBeCloseTo(442);
    expect(c.advanceLeavingBuckets(0.2, 500, 420)).toEqual([first]);
    expect(c.leavingBuckets).toHaveLength(0);
  });

  it('lists locked buckets that still need screws', () => {
    const c = makeConveyor([bucketDef(1, 7), bucketDef(2, 8)], 2, 4);
    const [a, b] = c.getActiveBuckets();
    a.reserveHole(0, 7);
    a.reserveHole(1, 7);
    a.reserveHole(2, 7); // all reserved → no longer a Hand target
    openBucket(b);
    expect(c.getLockedActiveBuckets()).toEqual([]);
  });
});

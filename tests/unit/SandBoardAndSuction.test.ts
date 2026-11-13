import { describe, expect, it } from 'vitest';
import { LinearConveyorModel } from '../../src/game/models/LinearConveyorModel';
import { SandBoardModel } from '../../src/game/models/SandBoardModel';
import { SandSuctionRule } from '../../src/game/rules/SandSuctionRule';

describe('SandBoardModel & SandSuctionRule', () => {
  it('only drains bottom-row sand when bucket lid is open and drops upper sand via gravity', () => {
    const grid = [
      [9, 9],
      [10, 10]
    ];
    const board = new SandBoardModel(2, 2, 4, grid);
    const conveyor = new LinearConveyorModel(
      [
        { id: 1, colorId: 10, capacity: 2, requiredScrews: 3 },
        { id: 2, colorId: 9, capacity: 2, requiredScrews: 3 }
      ],
      2,
      4
    );
    conveyor.refillSlots(0, 500, 40, 460, true);

    // While buckets are locked, no sand drains
    expect(SandSuctionRule.stepSuction(board, conveyor, 1000, 0)).toBeNull();
    expect(board.getRemainingCells()).toBe(4);

    // Unlock bucket 0 (colorId: 10) with 3 screws
    const b0 = conveyor.slots[0]!;
    b0.landScrewInHole(0, 100);
    b0.landScrewInHole(1, 100);
    b0.landScrewInHole(2, 100);
    expect(b0.isOpen).toBe(true);

    // Drain both cells of colorId 10 from the bottom row
    const ev1 = SandSuctionRule.stepSuction(board, conveyor, 1000, 0);
    expect(ev1?.colorId).toBe(10);
    const ev2 = SandSuctionRule.stepSuction(board, conveyor, 1000, 0);
    expect(ev2?.colorId).toBe(10);
    expect(ev2?.bucketCompleted).toBe(true);
    expect(b0.isFull()).toBe(true);

    // Now colorId 9 has fallen to the bottom row!
    expect(board.cells[1][0]?.colorId).toBe(9);
    expect(board.cells[1][1]?.colorId).toBe(9);
  });
});


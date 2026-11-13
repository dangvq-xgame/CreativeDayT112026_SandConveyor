import { describe, expect, it } from 'vitest';
import { BufferDockModel } from '../../src/game/models/BufferDockModel';
import { LinearConveyorModel } from '../../src/game/models/LinearConveyorModel';
import { QueueColumnModel } from '../../src/game/models/QueueColumnModel';
import { BoosterRule } from '../../src/game/rules/BoosterRule';

describe('BoosterRule (Boosters 1, 2, 3)', () => {
  it('Booster 2 (Hand): pulls remaining matching screws from BufferDock & QueueColumns to unlock selected bucket', () => {
    const conveyor = new LinearConveyorModel(
      [{ id: 1, colorId: 6, capacity: 16, requiredScrews: 3 }],
      2,
      4
    );
    conveyor.refillSlots(0, 500, 40, 460, true);
    const bucket = conveyor.slots[0]!;

    // Pre-fill 1 hole on the bucket
    bucket.landScrewInHole(0, 100);
    expect(bucket.getMissingScrewsCount()).toBe(2);

    const buffer = new BufferDockModel(5, 7);
    buffer.reserveSlot(0, 6);
    buffer.markSlotLanded(0);

    const columns = [
      new QueueColumnModel({
        columnIndex: 0,
        rimColorId: 9,
        items: [{ colorId: 9 }, { colorId: 10 }, { colorId: 6, isMystery: true }]
      })
    ];

    const res = BoosterRule.useHandOnBucket(bucket, 0, buffer, columns);
    expect(res.ok).toBe(true);
    expect(res.flights.length).toBe(2);
    expect(buffer.getUsedCount()).toBe(0);
    expect(columns[0].items.length).toBe(2);
  });

  it('Booster 3 (Shuffle): guarantees at least 2 top screws match locked buckets on conveyor', () => {
    const conveyor = new LinearConveyorModel(
      [
        { id: 1, colorId: 4, capacity: 15, requiredScrews: 3 },
        { id: 2, colorId: 10, capacity: 15, requiredScrews: 3 }
      ],
      2,
      4
    );
    conveyor.refillSlots(0, 500, 40, 460, true);

    const columns = [
      new QueueColumnModel({
        columnIndex: 0,
        rimColorId: 1,
        items: [{ colorId: 1 }, { colorId: 1 }, { colorId: 4 }]
      }),
      new QueueColumnModel({
        columnIndex: 1,
        rimColorId: 6,
        items: [{ colorId: 6 }, { colorId: 6 }, { colorId: 10 }]
      }),
      new QueueColumnModel({
        columnIndex: 2,
        rimColorId: 9,
        items: [{ colorId: 9 }, { colorId: 9 }, { colorId: 4 }]
      })
    ];

    for (let run = 0; run < 25; run++) {
      const res = BoosterRule.useShuffleWithPriority(conveyor, columns, 2);
      expect(res.ok).toBe(true);
      const topMatches = columns.filter((col) => {
        const top = col.peekTop();
        return top && (top.colorId === 4 || top.colorId === 10);
      }).length;
      expect(topMatches).toBeGreaterThanOrEqual(2);
    }
  });
});


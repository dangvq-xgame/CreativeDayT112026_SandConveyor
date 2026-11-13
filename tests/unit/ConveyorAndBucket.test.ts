import { describe, expect, it } from 'vitest';
import { BufferDockModel } from '../../src/game/models/BufferDockModel';
import { LinearConveyorModel } from '../../src/game/models/LinearConveyorModel';
import { QueueColumnModel } from '../../src/game/models/QueueColumnModel';
import { ScrewMatchRule } from '../../src/game/rules/ScrewMatchRule';

describe('LinearConveyorModel & SandBucketModel (3 holes)', () => {
  it('starts with defaultActiveSlots = 2 and expands up to maxActiveSlots = 4 via ExtraSlot', () => {
    const conveyor = new LinearConveyorModel(
      [
        { id: 1, colorId: 9, capacity: 15, requiredScrews: 3 },
        { id: 2, colorId: 10, capacity: 15, requiredScrews: 3 },
        { id: 3, colorId: 9, capacity: 15, requiredScrews: 3 },
        { id: 4, colorId: 10, capacity: 15, requiredScrews: 3 }
      ],
      2,
      4
    );

    expect(conveyor.activeSlots).toBe(2);
    conveyor.refillSlots(0, 500, 40, 460, true);
    expect(conveyor.getActiveBuckets().length).toBe(2);

    expect(conveyor.unlockExtraSlot(0, 500)).toBe(true);
    expect(conveyor.activeSlots).toBe(3);
    expect(conveyor.getActiveBuckets().length).toBe(3);

    expect(conveyor.unlockExtraSlot(0, 500)).toBe(true);
    expect(conveyor.activeSlots).toBe(4);
    expect(conveyor.getActiveBuckets().length).toBe(4);

    // Cannot exceed maxActiveSlots = 4
    expect(conveyor.unlockExtraSlot(0, 500)).toBe(false);
    expect(conveyor.activeSlots).toBe(4);
  });

  it('requires all 3 screw holes to be filled before opening bucket lid', () => {
    const conveyor = new LinearConveyorModel(
      [{ id: 1, colorId: 6, capacity: 16, requiredScrews: 3 }],
      2,
      4
    );
    conveyor.refillSlots(0, 500, 40, 460, true);
    const bucket = conveyor.slots[0]!;
    expect(bucket.isOpen).toBe(false);

    // Land 1st and 2nd screws -> still locked
    bucket.reserveHole(0, 6);
    expect(bucket.landScrewInHole(0, 100)).toBe(false);
    expect(bucket.isOpen).toBe(false);

    bucket.reserveHole(1, 6);
    expect(bucket.landScrewInHole(1, 200)).toBe(false);
    expect(bucket.isOpen).toBe(false);

    // Land 3rd screw -> lid unlocks!
    bucket.reserveHole(2, 6);
    expect(bucket.landScrewInHole(2, 300)).toBe(true);
    expect(bucket.isOpen).toBe(true);
  });

  it('routes non-matching screws to BufferDock and auto-flushes when matching bucket spawns', () => {
    const conveyor = new LinearConveyorModel(
      [
        { id: 1, colorId: 9, capacity: 15, requiredScrews: 3 },
        { id: 2, colorId: 10, capacity: 15, requiredScrews: 3 }
      ],
      1,
      4
    );
    conveyor.refillSlots(0, 500, 40, 460, true);
    const buffer = new BufferDockModel(5, 7);
    const col = new QueueColumnModel({
      columnIndex: 0,
      rimColorId: 10,
      items: [{ colorId: 10 }, { colorId: 9 }]
    });

    // Only bucket 1 (colorId: 9) is active on the 1-slot belt; popping colorId: 10 goes to buffer
    const res1 = ScrewMatchRule.popColumnTop(col, conveyor, buffer, 100);
    expect(res1.ok).toBe(true);
    expect(res1.flight?.targetType).toBe('buffer');
    buffer.markSlotLanded(res1.flight!.targetSlotIndex);
    expect(buffer.getUsedCount()).toBe(1);

    // Unlock extra slot so bucket 2 (colorId: 10) spawns onto slot 1
    conveyor.unlockExtraSlot(0, 500);
    const flushed = ScrewMatchRule.flushBufferToConveyor(conveyor, buffer);
    expect(flushed.length).toBe(1);
    expect(flushed[0].targetBucket?.colorId).toBe(10);
    expect(buffer.getUsedCount()).toBe(0);
  });
});


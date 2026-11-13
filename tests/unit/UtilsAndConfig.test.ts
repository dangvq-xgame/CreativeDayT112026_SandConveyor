import { describe, expect, it } from 'vitest';
import { BalanceConfig, validateBalanceConfig } from '../../src/config/game.config';
import { InputManager } from '../../src/core/InputManager';
import { clamp, clamp01, isFiniteNumber, positiveMod, toIntAtLeast } from '../../src/utils/math.utils';
import { createSeededRandom, randomInt, shuffleInPlace } from '../../src/utils/random';

describe('random utils', () => {
  it('seeded RNG is deterministic and in [0, 1)', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 200 }, a);
    expect(Array.from({ length: 200 }, b)).toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(Array.from({ length: 5 }, createSeededRandom(43))).not.toEqual(seqA.slice(0, 5));
  });

  it('randomInt stays in range even with a broken RNG (regression: rng()=1 indexed out of bounds)', () => {
    expect(randomInt(() => 1, 5)).toBe(4);
    expect(randomInt(() => -0.5, 5)).toBe(0);
    expect(randomInt(() => Number.NaN, 5)).toBe(0);
    expect(randomInt(() => 0.99, 1)).toBe(0);
    expect(randomInt(() => 0.5, 0)).toBe(0);
  });

  it('shuffleInPlace returns a permutation, deterministic for a seed', () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    const s1 = shuffleInPlace([...src], createSeededRandom(7));
    const s2 = shuffleInPlace([...src], createSeededRandom(7));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(src);
    expect(s1).not.toEqual(src);
    expect(shuffleInPlace([1, 2, 3], () => 1)).toHaveLength(3);
  });
});

describe('math utils', () => {
  it('clamp / clamp01 / positiveMod / toIntAtLeast / isFiniteNumber', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(Number.NaN, 1, 3)).toBe(1);
    expect(clamp01(-2)).toBe(0);
    expect(positiveMod(-1, 5)).toBe(4);
    expect(toIntAtLeast(3.9, 1, 7)).toBe(3);
    expect(toIntAtLeast(0, 1, 7)).toBe(7);
    expect(toIntAtLeast('3', 1, 7)).toBe(7);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('balance config', () => {
  it('shipped balance.json is valid', () => {
    expect(validateBalanceConfig(BalanceConfig)).toEqual([]);
  });

  it('reports broken values', () => {
    const broken = structuredClone(BalanceConfig);
    broken.conveyor.defaultActiveSlots = 5;
    broken.conveyor.holesPerBucket = 0;
    broken.bufferDock.maxReviveSlots = 2;
    broken.boosters.hand.coinCost = -1;
    const errors = validateBalanceConfig(broken);
    expect(errors.join('\n')).toMatch(/defaultActiveSlots must be <= /);
    expect(errors.join('\n')).toMatch(/holesPerBucket/);
    expect(errors.join('\n')).toMatch(/maxReviveSlots must be >=/);
    expect(errors.join('\n')).toMatch(/hand.coinCost/);
  });
});

describe('InputManager', () => {
  it('fast-forwards only after the hold threshold and stops on release/reset', () => {
    const input = new InputManager(100, 2, () => 0);
    expect(input.getSpeedMultiplier(0)).toBe(1);
    input.onPointerDown(1000);
    expect(input.getSpeedMultiplier(1050)).toBe(1);
    expect(input.isHoldingFastForward(1100)).toBe(true);
    expect(input.getSpeedMultiplier(1100)).toBe(2);
    input.onPointerUp();
    expect(input.getSpeedMultiplier(2000)).toBe(1);
    input.onPointerDown(3000);
    input.reset();
    expect(input.getSpeedMultiplier(4000)).toBe(1);
  });

  it('defaults to balance.json values', () => {
    let now = 0;
    const input = new InputManager(undefined, undefined, () => now);
    input.onPointerDown();
    now = BalanceConfig.conveyor.holdThresholdMs;
    expect(input.getSpeedMultiplier()).toBe(BalanceConfig.conveyor.holdSpeedMultiplier);
  });
});

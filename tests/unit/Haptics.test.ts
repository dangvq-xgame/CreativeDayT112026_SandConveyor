import { describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS } from '../../src/config/haptics.config';
import { HapticsImpl, VibrateCapable } from '../../src/core/Haptics';
import { FakeSettingsStore } from './helpers';

/** A navigator whose `vibrate` needs a correct `this` (like the real one). */
function makeNavigator(result = true) {
  const calls: Array<number | number[]> = [];
  const nav = {
    vibrate(this: unknown, pattern: number | number[]): boolean {
      if (this !== nav) throw new TypeError('Illegal invocation');
      calls.push(pattern);
      return result;
    }
  };
  return { nav, calls };
}

describe('Haptics', () => {
  it('is a safe no-op without navigator (SSR / tests)', () => {
    const h = new HapticsImpl(new FakeSettingsStore(), () => null);
    expect(h.isSupported()).toBe(false);
    expect(h.light()).toBe(false);
    expect(h.error()).toBe(false);
  });

  it('is a safe no-op when vibrate is missing (iOS Safari / desktop)', () => {
    const h = new HapticsImpl(new FakeSettingsStore(), () => ({}) as VibrateCapable);
    expect(h.isSupported()).toBe(false);
    expect(h.medium()).toBe(false);
  });

  it('never throws when vibrate throws', () => {
    const h = new HapticsImpl(new FakeSettingsStore(), () => ({
      vibrate: () => {
        throw new Error('blocked');
      }
    }));
    expect(() => h.success()).not.toThrow();
    expect(h.success()).toBe(false);
  });

  it('vibrates with the configured patterns (called as a method)', () => {
    const { nav, calls } = makeNavigator();
    const h = new HapticsImpl(new FakeSettingsStore(), () => nav);
    expect(h.isSupported()).toBe(true);
    expect(h.light()).toBe(true);
    expect(h.medium()).toBe(true);
    expect(h.success()).toBe(true);
    expect(h.error()).toBe(true);
    expect(calls).toEqual([
      HAPTIC_PATTERNS.light,
      HAPTIC_PATTERNS.medium,
      [...HAPTIC_PATTERNS.success],
      [...HAPTIC_PATTERNS.error]
    ]);
  });

  it('reports false when the browser refuses the pattern', () => {
    const { nav } = makeNavigator(false);
    expect(new HapticsImpl(new FakeSettingsStore(), () => nav).light()).toBe(false);
  });

  it('respects and persists the vibration setting', () => {
    const store = new FakeSettingsStore({ vibrationEnabled: false });
    const { nav, calls } = makeNavigator();
    const h = new HapticsImpl(store, () => nav);
    expect(h.isEnabled()).toBe(false);
    expect(h.light()).toBe(false);
    expect(calls).toHaveLength(0);

    h.setEnabled(true);
    expect(store.settings.vibrationEnabled).toBe(true);
    expect(h.light()).toBe(true);
  });

  it('disabling cancels a running vibration', () => {
    const store = new FakeSettingsStore();
    const { nav, calls } = makeNavigator();
    const h = new HapticsImpl(store, () => nav);
    h.setEnabled(false);
    expect(store.updates).toContainEqual({ vibrationEnabled: false });
    expect(calls).toEqual([0]);
  });

  it('accepts custom patterns', () => {
    const vibrate = vi.fn(() => true);
    const h = new HapticsImpl(new FakeSettingsStore(), () => ({ vibrate }));
    h.vibrate([5, 5, 5]);
    expect(vibrate).toHaveBeenCalledWith([5, 5, 5]);
  });
});

import { HAPTIC_PATTERNS, VibrationPattern } from '../config/haptics.config';
import { SaveManager, SettingsStore } from './SaveManager';

/** The part of `Navigator` used for haptics (injectable for tests). */
export interface VibrateCapable {
  vibrate?: (pattern: number | number[]) => boolean;
}

function defaultNavigatorProvider(): VibrateCapable | null {
  return typeof navigator === 'undefined' ? null : (navigator as VibrateCapable);
}

/**
 * Vibration feedback through `navigator.vibrate`.
 *
 * Silently does nothing when vibration is disabled in settings or unsupported
 * (desktop, iOS Safari, insecure context, missing user activation). Never throws.
 */
export class HapticsImpl {
  constructor(
    private readonly store: SettingsStore = SaveManager,
    private readonly navigatorProvider: () => VibrateCapable | null = defaultNavigatorProvider
  ) {}

  /** `true` if the platform exposes `navigator.vibrate` (may still be a no-op on desktop). */
  isSupported(): boolean {
    return typeof this.navigatorProvider()?.vibrate === 'function';
  }

  /** User preference (persisted as `settings.vibrationEnabled`). */
  isEnabled(): boolean {
    return this.store.getSettings().vibrationEnabled;
  }

  /** Persists the vibration preference. Disabling also cancels any running vibration. */
  setEnabled(enabled: boolean): void {
    this.store.updateSettings({ vibrationEnabled: enabled });
    if (!enabled) this.callVibrate(0);
  }

  /** Short tick for taps. */
  light(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.light);
  }

  /** Stronger tick for notable events. */
  medium(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.medium);
  }

  /** Double pulse for positive outcomes. */
  success(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.success);
  }

  /** Buzz pattern for invalid actions / losing. */
  error(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.error);
  }

  /** Vibrates with a custom pattern if enabled. Returns `true` if the browser accepted it. */
  vibrate(pattern: VibrationPattern): boolean {
    if (!this.isEnabled()) return false;
    return this.callVibrate(pattern);
  }

  private callVibrate(pattern: VibrationPattern): boolean {
    const nav = this.navigatorProvider();
    if (!nav || typeof nav.vibrate !== 'function') return false;
    try {
      // Called as a method: an unbound `vibrate` throws "Illegal invocation".
      return nav.vibrate(typeof pattern === 'number' ? pattern : [...pattern]) === true;
    } catch {
      return false;
    }
  }
}

/** Global haptics singleton (preference persisted via SaveManager). */
export const Haptics = new HapticsImpl();

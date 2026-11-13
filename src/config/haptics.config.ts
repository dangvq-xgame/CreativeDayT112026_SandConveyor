/** A `navigator.vibrate` pattern: a single duration or alternating vibrate/pause durations (ms). */
export type VibrationPattern = number | readonly number[];

/** Vibration patterns used by {@link Haptics}. Kept short: long buzzes feel cheap on phones. */
export const HAPTIC_PATTERNS = {
  /** Tap feedback (screw pop, UI button). */
  light: 10,
  /** Notable event (lid opens, booster used). */
  medium: 22,
  /** Positive outcome (bucket complete, level won). */
  success: [14, 40, 26],
  /** Invalid action / lose. */
  error: [40, 30, 40]
} as const satisfies Record<string, VibrationPattern>;

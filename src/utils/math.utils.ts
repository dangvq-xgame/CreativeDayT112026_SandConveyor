/** Clamps `value` into `[min, max]`. NaN becomes `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Clamps into `[0, 1]`. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** `true` for finite numbers (rejects NaN, ±Infinity and non-number values). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns `Math.floor(value)` when `value` is a finite number `>= min`, otherwise `fallback`.
 * Handy for sanitizing counters read from JSON / localStorage.
 */
export function toIntAtLeast(value: unknown, min: number, fallback: number): number {
  if (!isFiniteNumber(value) || value < min) return fallback;
  return Math.floor(value);
}

/** Positive modulo: result is always in `[0, divisor)` (for `divisor > 0`). */
export function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

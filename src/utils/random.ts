/** A source of floats in `[0, 1)` — drop-in compatible with `Math.random`. */
export type RandomFn = () => number;

/**
 * Deterministic, seedable PRNG (mulberry32). Same seed → same sequence, on every platform.
 * Use it in tests, replays and tools; gameplay defaults to `Math.random`.
 */
export function createSeededRandom(seed: number): RandomFn {
  let state = (Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Integer in `[0, maxExclusive)`. Robust against misbehaving RNGs that return `1`, negatives or NaN
 * (the index is always clamped into range). Returns 0 when `maxExclusive <= 1`.
 */
export function randomInt(rng: RandomFn, maxExclusive: number): number {
  if (!(maxExclusive > 1)) return 0;
  const r = rng();
  const idx = Math.floor((Number.isFinite(r) ? r : 0) * maxExclusive);
  return Math.min(maxExclusive - 1, Math.max(0, idx));
}

/** Unbiased in-place Fisher–Yates shuffle. Returns the same array for chaining. */
export function shuffleInPlace<T>(items: T[], rng: RandomFn = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

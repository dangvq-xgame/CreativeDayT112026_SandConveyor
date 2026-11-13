import { ColorId, ColorPaletteItem } from '../types/level.types';
import { clamp01 } from '../utils/math.utils';

/** Built-in palette (mirror of `public/assets/data/palette.json`), used until/unless that file loads. */
export const DEFAULT_PALETTE: readonly ColorPaletteItem[] = [
  { colorId: 1, name: 'Sky Blue', bodyHex: '#3898FF', shadowHex: '#0058C4', handleHex: '#003980', sandHex: '#2C7BDB' },
  { colorId: 2, name: 'Royal Blue', bodyHex: '#2D4AB0', shadowHex: '#14249E', handleHex: '#0A1766', sandHex: '#2D4AC4' },
  { colorId: 3, name: 'Charcoal Black', bodyHex: '#3A3A42', shadowHex: '#202026', handleHex: '#141418', sandHex: '#2E2E32' },
  { colorId: 4, name: 'Leaf Green', bodyHex: '#3FAC1D', shadowHex: '#28840B', handleHex: '#155602', sandHex: '#499431' },
  { colorId: 5, name: 'Vibrant Orange', bodyHex: '#FF7A29', shadowHex: '#C44B00', handleHex: '#803100', sandHex: '#F06E22' },
  { colorId: 6, name: 'Candy Pink', bodyHex: '#FF66B5', shadowHex: '#C73882', handleHex: '#851D52', sandHex: '#F27BB8' },
  { colorId: 7, name: 'Royal Violet', bodyHex: '#8A4FFF', shadowHex: '#5411AD', handleHex: '#320570', sandHex: '#9662F0' },
  { colorId: 8, name: 'Ruby Red', bodyHex: '#F0524F', shadowHex: '#B52422', handleHex: '#75100E', sandHex: '#E03E3B' },
  { colorId: 9, name: 'Aqua Cyan', bodyHex: '#36C5F0', shadowHex: '#1880A0', handleHex: '#0A5168', sandHex: '#45C4E6' },
  { colorId: 10, name: 'Sunny Gold', bodyHex: '#FFD13B', shadowHex: '#C99610', handleHex: '#825E04', sandHex: '#F7C843' },
  { colorId: 11, name: 'Cream White', bodyHex: '#F5EFE0', shadowHex: '#B8AE99', handleHex: '#807764', sandHex: '#FFFFFF' },
  { colorId: 12, name: 'Lime Meadow', bodyHex: '#A8E028', shadowHex: '#78A810', handleHex: '#4E7006', sandHex: '#9BE01E' }
];

/** Neutral gray used for colorIds missing from the palette (clearly "wrong", never mistaken for a real color). */
export const UNKNOWN_COLOR_HEX = {
  bodyHex: '#9AA3AD',
  shadowHex: '#6B737C',
  handleHex: '#454B52',
  sandHex: '#A7AFB8'
} as const;

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Max cached `mixHex` results (render loops call it every frame with a small set of inputs). */
const MIX_CACHE_LIMIT = 2048;

function isPaletteItem(v: unknown): v is ColorPaletteItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.colorId === 'number' &&
    Number.isInteger(o.colorId) &&
    o.colorId > 0 &&
    ['bodyHex', 'shadowHex', 'handleHex', 'sandHex'].every((k) => typeof o[k] === 'string' && HEX_RE.test(o[k] as string))
  );
}

/** colorId → display colors, plus small color math helpers. */
export class ColorManagerImpl {
  private readonly map = new Map<ColorId, ColorPaletteItem>();
  private readonly unknownCache = new Map<ColorId, ColorPaletteItem>();
  private readonly mixCache = new Map<string, string>();

  constructor(initial: readonly ColorPaletteItem[] = DEFAULT_PALETTE) {
    this.setPalette(initial);
  }

  /**
   * Replaces the palette. Invalid entries are skipped. If `items` contains no valid entry at all
   * (corrupt palette.json), the current palette is kept. Returns the number of accepted entries.
   */
  setPalette(items: readonly unknown[]): number {
    const valid = Array.isArray(items) ? items.filter(isPaletteItem) : [];
    if (valid.length === 0) return 0;
    this.map.clear();
    for (const item of valid) {
      this.map.set(item.colorId, { ...item });
    }
    return valid.length;
  }

  /** Palette entry for `colorId`; unknown ids get a (cached) neutral gray entry. */
  getColor(colorId: ColorId): ColorPaletteItem {
    const found = this.map.get(colorId);
    if (found) return found;
    let fallback = this.unknownCache.get(colorId);
    if (!fallback) {
      fallback = { colorId, name: `Unknown ${colorId}`, ...UNKNOWN_COLOR_HEX };
      this.unknownCache.set(colorId, fallback);
    }
    return fallback;
  }

  hasColor(colorId: ColorId): boolean {
    return this.map.has(colorId);
  }

  /** All colorIds of the current palette (ascending). */
  getColorIds(): ColorId[] {
    return [...this.map.keys()].sort((a, b) => a - b);
  }

  /** `'#RRGGBB'` / `'#RGB'` (with or without `#`) → `0xRRGGBB`. Invalid input → `0`. */
  hexToNumber(hex: string): number {
    const m = HEX_RE.exec(typeof hex === 'string' ? hex.trim() : '');
    if (!m) return 0;
    const clean = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
    return parseInt(clean, 16);
  }

  hexToRgb(hex: string): [number, number, number] {
    const n = this.hexToNumber(hex);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Linear RGB blend `a → b` (`ratio` clamped to [0, 1]); returns lowercase `#rrggbb`. Memoized. */
  mixHex(hexA: string, hexB: string, ratio: number): string {
    const t = clamp01(ratio);
    const key = `${hexA}|${hexB}|${t}`;
    const cached = this.mixCache.get(key);
    if (cached !== undefined) return cached;

    const a = this.hexToRgb(hexA);
    const b = this.hexToRgb(hexB);
    const ch = (i: number): number => Math.round(a[i] + (b[i] - a[i]) * t);
    const out = `#${((1 << 24) + (ch(0) << 16) + (ch(1) << 8) + ch(2)).toString(16).slice(1)}`;
    if (this.mixCache.size >= MIX_CACHE_LIMIT) this.mixCache.clear();
    this.mixCache.set(key, out);
    return out;
  }

  mixNumber(hexA: string, hexB: string, ratio: number): number {
    return this.hexToNumber(this.mixHex(hexA, hexB, ratio));
  }
}

/** Global palette singleton. */
export const ColorManager = new ColorManagerImpl();

/**
 * Shared rendering helpers for all Canvas2D gameplay views.
 *
 * - `getRenderScale(ctx)`  : effective device-pixel scale of the current transform (DPR-aware baking).
 * - `createLayer(...)`     : offscreen canvas pre-scaled so painters work in CSS pixels.
 * - `SpriteCache`          : bounded cache of baked sprites, keyed by number (hot paths) or string.
 * - `ImageStore`           : decode-once image loader with failure tracking (callers fall back to
 *                            procedural drawing whenever `get()` returns null).
 */

export interface CachedSprite {
  canvas: HTMLCanvasElement;
  /** CSS-pixel width/height the bitmap maps to (canvas.width / dpr). */
  w: number;
  h: number;
  /** CSS-pixel offset of the sprite's anchor (draw at x - ax, y - ay). */
  ax: number;
  ay: number;
  dpr: number;
}

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const HAS_DOM = typeof document !== 'undefined';

/** Effective device scale of ctx's current transform, quantized to 0.25 and clamped to [1, 4]. */
export function getRenderScale(ctx: CanvasRenderingContext2D): number {
  if (typeof ctx.getTransform !== 'function') return 1;
  const t = ctx.getTransform();
  const s = Math.hypot(t.a, t.b);
  if (!Number.isFinite(s) || s <= 0) return 1;
  return Math.min(4, Math.max(1, Math.round(s * 4) / 4));
}

/** Creates an offscreen canvas of w x h CSS px at `dpr` (ctx already scaled by dpr). */
export function createLayer(w: number, h: number, dpr: number): Layer | null {
  if (!HAS_DOM) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx };
}

export type SpritePainter = (c: CanvasRenderingContext2D, w: number, h: number) => void;

class SpriteCacheImpl {
  private readonly sprites = new Map<number | string, CachedSprite>();
  private readonly maxEntries = 700;

  /**
   * Returns a baked sprite for `key`, painting it once with `paint` (CSS-px space, origin top-left).
   * `ax/ay` is the anchor inside the sprite (usually its visual center).
   */
  get(
    key: number | string,
    w: number,
    h: number,
    dpr: number,
    ax: number,
    ay: number,
    paint: SpritePainter
  ): CachedSprite | null {
    const hit = this.sprites.get(key);
    if (hit) return hit;
    const layer = createLayer(w, h, dpr);
    if (!layer) return null;
    paint(layer.ctx, w, h);
    const sprite: CachedSprite = {
      canvas: layer.canvas,
      w: layer.canvas.width / dpr,
      h: layer.canvas.height / dpr,
      ax,
      ay,
      dpr
    };
    if (this.sprites.size >= this.maxEntries) {
      // Drop the oldest ~20% (Map preserves insertion order) to stay bounded on long sessions.
      let drop = Math.ceil(this.maxEntries * 0.2);
      for (const k of this.sprites.keys()) {
        this.sprites.delete(k);
        if (--drop <= 0) break;
      }
    }
    this.sprites.set(key, sprite);
    return sprite;
  }

  clear(): void {
    this.sprites.clear();
  }

  get size(): number {
    return this.sprites.size;
  }
}

export const SpriteCache = new SpriteCacheImpl();

/** Draws a cached sprite so that its anchor lands on (x, y), optionally scaled uniformly. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: CachedSprite,
  x: number,
  y: number,
  scale = 1
): void {
  if (scale === 1) {
    ctx.drawImage(s.canvas, x - s.ax, y - s.ay, s.w, s.h);
  } else {
    ctx.drawImage(s.canvas, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
  }
}

/** Numeric cache key helper: packs small non-negative integers (each < 2^bits) into one number. */
export function packKey(a: number, b: number, c: number, d = 0): number {
  // a: kind/variant (< 64), b: colorId-ish (< 256), c: size quantum (< 65536), d: flags (< 64)
  return (((a & 63) * 256 + (b & 255)) * 65536 + (c & 65535)) * 64 + (d & 63);
}

type ImageState = 'loading' | 'ready' | 'failed';

interface ImageEntry {
  img: HTMLImageElement;
  state: ImageState;
}

class ImageStoreImpl {
  private readonly entries = new Map<string, ImageEntry>();

  /** Starts loading (once) and returns the decoded image, or null while loading / after failure. */
  get(url: string): HTMLImageElement | null {
    const e = this.entries.get(url) ?? this.load(url);
    if (!e) return null;
    return e.state === 'ready' ? e.img : null;
  }

  /** True once the image definitively failed — callers keep their procedural fallback. */
  hasFailed(url: string): boolean {
    return this.entries.get(url)?.state === 'failed';
  }

  preload(urls: string[]): void {
    for (const u of urls) this.get(u);
  }

  private load(url: string): ImageEntry | null {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.decoding = 'async';
    const entry: ImageEntry = { img, state: 'loading' };
    this.entries.set(url, entry);
    const markReady = (): void => {
      if (img.naturalWidth > 0) entry.state = 'ready';
      else entry.state = 'failed';
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady, markReady);
      } else {
        markReady();
      }
    };
    img.onerror = () => {
      entry.state = 'failed';
    };
    img.src = url;
    return entry;
  }
}

export const ImageStore = new ImageStoreImpl();

/** Gameplay sprite URLs (copied byte-identical from SandLoopGame into public/assets/images/game). */
export const GameSprites = {
  bucketShadow: './assets/images/game/xo_shadow.png',
  lock: './assets/images/game/lock.png',
  hand: './assets/images/ui/icon_hand.png'
} as const;

/** Small deterministic hash → [0, 1). Used for per-grain jitter without per-frame Math.random. */
export function hash01(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

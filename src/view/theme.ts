/**
 * Visual theme for the in-game Canvas2D layer (matches _Docs/image.png art direction):
 * soft sky-blue world, white/periwinkle bezels, indigo plank conveyor, royal-blue perspective tray.
 * Gameplay colors (buckets, screws, sand) always come from ColorManager via colorId.
 */

export const FONT_FAMILY = "'RoyalKingdom', 'Fredoka', 'Arial Rounded MT Bold', system-ui, sans-serif";

export const Theme = {
  // Sand picture bezel
  frameOuterTop: '#ffffff',
  frameOuterMid: '#eef3ff',
  frameOuterBottom: '#cbdaf7',
  frameOutline: '#86a6e2',
  frameLipTop: '#97b4ec',
  frameLipBottom: '#c9daf9',
  frameShadow: 'rgba(36, 70, 150, 0.30)',
  trayEmptyTop: '#d6e5fb',
  trayEmptyBottom: '#e9f2ff',

  // Conveyor
  deckBack: '#6e70c6',
  deckFront: '#5a5cb3',
  plankLineDark: 'rgba(40, 40, 120, 0.55)',
  plankLineLight: 'rgba(165, 170, 255, 0.35)',
  railTop: '#f4f5ff',
  railBottom: '#c3c8f1',
  railOutline: '#8d93d8',
  archLight: '#ffffff',
  archMid: '#e4e7ff',
  archDark: '#b3b9ef',
  archOutline: '#8e95d9',
  tunnelDeep: '#2c2f78',
  tunnelMouth: '#4a4fa6',

  // Tray (queue columns)
  trayTop: '#7091ea',
  trayMid: '#5c7fdc',
  trayBottom: '#4f70cf',
  trayRim: '#a9c0fa',
  trayEdge: '#4161bd',

  // Dock / pills
  pillNavy: '#283a78',
  pillNavyDeep: '#1d2a5c',
  pillText: '#ffffff',
  labelInk: '#27306a',
  greenTop: '#7be85f',
  greenMid: '#3dc63c',
  greenBottom: '#1f8f2c',
  dangerRed: '#e2464a',
  warnOrange: '#ff9d2e',

  // Metals
  silverLight: '#f6f8ff',
  silverMid: '#aeb8cf',
  silverDark: '#5f6a85'
} as const;

/** Rounded rectangle with independent top/bottom radii (path only). */
export function roundRectPath2(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rTop: number,
  rBottom: number
): void {
  const rt = Math.max(0, Math.min(rTop, w / 2, h / 2));
  const rb = Math.max(0, Math.min(rBottom, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rt, y);
  ctx.lineTo(x + w - rt, y);
  if (rt > 0) ctx.arcTo(x + w, y, x + w, y + rt, rt);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - rb);
  if (rb > 0) ctx.arcTo(x + w, y + h, x + w - rb, y + h, rb);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + rb, y + h);
  if (rb > 0) ctx.arcTo(x, y + h, x, y + h - rb, rb);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + rt);
  if (rt > 0) ctx.arcTo(x, y, x + rt, y, rt);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

/** Font string cache so per-frame text drawing doesn't rebuild template strings. */
const fontCache = new Map<number, string>();
export function gameFont(sizePx: number, weight = 900): string {
  const size = Math.max(6, Math.round(sizePx * 2) / 2);
  const key = weight * 10000 + size * 2;
  let f = fontCache.get(key);
  if (!f) {
    f = `${weight} ${size}px ${FONT_FAMILY}`;
    fontCache.set(key, f);
  }
  return f;
}

/** Outlined (stroke then fill) centered text — Unity-style label. Caller sets nothing else. */
export function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  sizePx: number,
  fill: string,
  stroke: string,
  strokeW: number
): void {
  ctx.font = gameFont(sizePx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (strokeW > 0) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeW;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Cached "N%" / "+N" / "a/b" strings so the hot path avoids template allocations. */
const pctStrings: string[] = [];
export function percentText(p: number): string {
  const v = Math.max(0, Math.min(100, Math.round(p)));
  let s = pctStrings[v];
  if (!s) {
    s = `${v}%`;
    pctStrings[v] = s;
  }
  return s;
}

const plusStrings: string[] = [];
export function plusText(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v > 999) return `+${v}`;
  let s = plusStrings[v];
  if (!s) {
    s = `+${v}`;
    plusStrings[v] = s;
  }
  return s;
}

const ratioStrings = new Map<number, string>();
export function ratioText(a: number, b: number): string {
  const key = a * 1000 + b;
  let s = ratioStrings.get(key);
  if (!s) {
    s = `${a}/${b}`;
    ratioStrings.set(key, s);
  }
  return s;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeOutBack(t: number, s = 1.70158): number {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

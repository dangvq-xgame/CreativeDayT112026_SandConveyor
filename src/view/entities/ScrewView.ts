import { ColorManager } from '../../core/ColorManager';
import { ColorId } from '../../types/level.types';
import { CachedSprite, getRenderScale, packKey, SpriteCache } from '../SpriteCache';
import { Theme } from '../theme';

export interface ScrewDrawOptions {
  rotation?: number;
  alpha?: number;
  isMystery?: boolean;
  scale?: number;
  /** When true (flying), renders the silver threaded shaft under a top-view head. */
  showShaft?: boolean;
  /**
   * 'face' = head seen front-on (bucket holes, buffer dock), 'top' = thick head seen from above
   * (glass tubes / flight). Defaults to 'top' when `showShaft`, otherwise 'face'.
   */
  view?: 'face' | 'top';
  /** 0..1 white glow ring (tap / seat feedback). */
  glow?: number;
}

/** Sprite kinds (packed into numeric cache keys — no per-frame string allocation). */
const K_FACE = 1;
const K_CROSS = 2;
const K_TOP = 3;
const K_SHAFT = 4;
const K_QMARK = 5;
const K_COIL = 6;

/** Vertical squash of the top face for the 'top' view (camera ~38° above). */
export const SCREW_TOP_RY = 0.6;
/** Thickness of the head's side band in 'top' view, as a fraction of radius. */
export const SCREW_TOP_SIDE = 0.3;

const MYSTERY_PAL = {
  bodyHex: '#d7deef',
  shadowHex: '#8e9aba',
  handleHex: '#5f6b8c'
};

interface ScrewPal {
  bodyHex: string;
  shadowHex: string;
  handleHex: string;
}

function palFor(colorId: ColorId, mystery: boolean): ScrewPal {
  return mystery ? MYSTERY_PAL : ColorManager.getColor(colorId);
}

function paintFaceHead(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pal: ScrewPal): void {
  const mix = ColorManager.mixHex.bind(ColorManager);

  // Soft contact shadow
  const sg = c.createRadialGradient(cx, cy + r * 0.16, r * 0.55, cx, cy + r * 0.16, r * 1.12);
  sg.addColorStop(0, 'rgba(10, 20, 60, 0.42)');
  sg.addColorStop(1, 'rgba(10, 20, 60, 0)');
  c.fillStyle = sg;
  c.beginPath();
  c.arc(cx, cy + r * 0.16, r * 1.12, 0, Math.PI * 2);
  c.fill();

  // Outer bevel ring
  const rg = c.createLinearGradient(0, cy - r, 0, cy + r);
  rg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.55));
  rg.addColorStop(0.45, pal.bodyHex);
  rg.addColorStop(1, mix(pal.shadowHex, '#0b1230', 0.25));
  c.fillStyle = rg;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();

  // Domed face
  const fg = c.createRadialGradient(cx - r * 0.3, cy - r * 0.36, r * 0.05, cx, cy, r * 0.86);
  fg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.42));
  fg.addColorStop(0.55, pal.bodyHex);
  fg.addColorStop(1, mix(pal.bodyHex, pal.shadowHex, 0.55));
  c.fillStyle = fg;
  c.beginPath();
  c.arc(cx, cy + r * 0.02, r * 0.8, 0, Math.PI * 2);
  c.fill();

  // Thin separation line between ring and face
  c.strokeStyle = mix(pal.shadowHex, '#000000', 0.1);
  c.globalAlpha = 0.45;
  c.lineWidth = Math.max(0.6, r * 0.05);
  c.beginPath();
  c.arc(cx, cy + r * 0.02, r * 0.8, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = 1;

  // Top-left gloss
  c.save();
  c.translate(cx - r * 0.34, cy - r * 0.46);
  c.rotate(-0.55);
  const gg = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.34);
  gg.addColorStop(0, 'rgba(255,255,255,0.85)');
  gg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gg;
  c.scale(1, 0.48);
  c.beginPath();
  c.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function paintCross(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pal: ScrewPal): void {
  const mix = ColorManager.mixHex.bind(ColorManager);
  const L = r * 0.46;
  const t = Math.max(1.2, r * 0.25);
  c.lineCap = 'round';

  const arms = (dx: number, dy: number): void => {
    c.beginPath();
    c.moveTo(cx - L + dx, cy + dy);
    c.lineTo(cx + L + dx, cy + dy);
    c.moveTo(cx + dx, cy - L + dy);
    c.lineTo(cx + dx, cy + L + dy);
    c.stroke();
  };

  // Light lower edge (bevel) → recessed groove → deeper core (Phillips slot)
  c.strokeStyle = mix(pal.bodyHex, '#ffffff', 0.7);
  c.lineWidth = t;
  arms(r * 0.04, r * 0.06);
  c.strokeStyle = mix(pal.shadowHex, pal.handleHex, 0.45);
  c.lineWidth = t;
  arms(0, 0);
  c.strokeStyle = mix(pal.handleHex, '#000000', 0.15);
  c.globalAlpha = 0.7;
  c.lineWidth = t * 0.42;
  arms(-r * 0.01, -r * 0.02);
  c.globalAlpha = 1;
}

function paintTopHead(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pal: ScrewPal): void {
  const mix = ColorManager.mixHex.bind(ColorManager);
  const ry = r * SCREW_TOP_RY;
  const side = r * SCREW_TOP_SIDE;

  // Contact shadow under the head
  c.save();
  c.translate(cx + r * 0.05, cy + side + ry * 0.55);
  c.scale(1, 0.42);
  const sg = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.1);
  sg.addColorStop(0, 'rgba(8, 18, 58, 0.36)');
  sg.addColorStop(1, 'rgba(8, 18, 58, 0)');
  c.fillStyle = sg;
  c.beginPath();
  c.arc(0, 0, r * 1.1, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Cylinder side band
  const sideGrad = c.createLinearGradient(cx - r, 0, cx + r, 0);
  sideGrad.addColorStop(0, mix(pal.bodyHex, pal.shadowHex, 0.2));
  sideGrad.addColorStop(0.22, mix(pal.bodyHex, '#ffffff', 0.18));
  sideGrad.addColorStop(0.55, mix(pal.bodyHex, pal.shadowHex, 0.45));
  sideGrad.addColorStop(1, mix(pal.shadowHex, '#060b20', 0.3));
  c.fillStyle = sideGrad;
  c.beginPath();
  c.moveTo(cx - r, cy);
  c.lineTo(cx - r, cy + side);
  c.ellipse(cx, cy + side, r, ry, 0, Math.PI, 0, true);
  c.lineTo(cx + r, cy);
  c.ellipse(cx, cy, r, ry, 0, 0, Math.PI, false);
  c.closePath();
  c.fill();

  // Top face
  const fg = c.createRadialGradient(cx - r * 0.32, cy - ry * 0.45, r * 0.05, cx, cy, r);
  fg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.5));
  fg.addColorStop(0.5, mix(pal.bodyHex, '#ffffff', 0.12));
  fg.addColorStop(1, mix(pal.bodyHex, pal.shadowHex, 0.3));
  c.fillStyle = fg;
  c.beginPath();
  c.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
  c.fill();

  // Rim highlight on the far edge + crisp outline on the near edge
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = Math.max(0.8, r * 0.07);
  c.beginPath();
  c.ellipse(cx, cy, r * 0.93, ry * 0.9, 0, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  c.strokeStyle = mix(pal.shadowHex, '#000000', 0.15);
  c.globalAlpha = 0.35;
  c.lineWidth = Math.max(0.6, r * 0.04);
  c.beginPath();
  c.ellipse(cx, cy, r, ry, 0, 0, Math.PI);
  c.stroke();
  c.globalAlpha = 1;

  // Gloss
  c.save();
  c.translate(cx - r * 0.42, cy - ry * 0.4);
  c.rotate(-0.25);
  c.scale(1, 0.4);
  const gg = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
  gg.addColorStop(0, 'rgba(255,255,255,0.8)');
  gg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gg;
  c.beginPath();
  c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function paintShaft(c: CanvasRenderingContext2D, cx: number, top: number, r: number): void {
  const wTop = r * 0.52;
  const wBot = r * 0.22;
  const len = r * 1.05;
  const g = c.createLinearGradient(cx - wTop / 2, 0, cx + wTop / 2, 0);
  g.addColorStop(0, Theme.silverDark);
  g.addColorStop(0.35, Theme.silverLight);
  g.addColorStop(0.7, Theme.silverMid);
  g.addColorStop(1, Theme.silverDark);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(cx - wTop / 2, top);
  c.lineTo(cx + wTop / 2, top);
  c.lineTo(cx + wBot / 2, top + len * 0.86);
  c.lineTo(cx, top + len);
  c.lineTo(cx - wBot / 2, top + len * 0.86);
  c.closePath();
  c.fill();

  c.strokeStyle = 'rgba(52, 62, 92, 0.75)';
  c.lineWidth = Math.max(0.8, r * 0.07);
  c.lineCap = 'round';
  for (let k = 1; k <= 4; k++) {
    const y = top + (len * 0.8 * k) / 5;
    const hw = (wTop + (wBot - wTop) * (k / 5)) / 2;
    c.beginPath();
    c.moveTo(cx - hw, y - r * 0.05);
    c.lineTo(cx + hw, y + r * 0.07);
    c.stroke();
  }
}

function paintQuestion(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  c.font = `900 ${Math.round(r * 1.05 * 10) / 10}px 'Arial Black', 'Fredoka', system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = '#3c4769';
  c.lineWidth = Math.max(1.5, r * 0.2);
  c.strokeText('?', cx, cy + r * 0.04);
  c.fillStyle = '#ffffff';
  c.fillText('?', cx, cy + r * 0.04);
}

function paintCoil(c: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  const rx = w * 0.5;
  const ry = w * 0.17;
  const t = Math.max(1, w * 0.13);
  c.lineCap = 'round';
  // Back half (darker, behind)
  c.strokeStyle = '#59647f';
  c.lineWidth = t * 0.9;
  c.beginPath();
  c.ellipse(cx, cy, rx - t / 2, ry, 0, Math.PI * 1.02, Math.PI * 1.98);
  c.stroke();
  // Front half: bright metallic
  const g = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, '#7d88a3');
  g.addColorStop(0.3, '#ffffff');
  g.addColorStop(0.62, '#b9c3d8');
  g.addColorStop(1, '#5d6883');
  c.strokeStyle = g;
  c.lineWidth = t;
  c.beginPath();
  c.ellipse(cx, cy, rx - t / 2, ry, 0, -0.05, Math.PI + 0.05);
  c.stroke();
}

export class ScrewView {
  private static faceSprite(colorId: ColorId, mystery: boolean, rq: number, dpr: number): CachedSprite | null {
    const r = rq / dpr;
    const key = packKey(K_FACE, mystery ? 0 : colorId, rq, Math.round(dpr * 4));
    const S = r * 2.5;
    return SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) =>
      paintFaceHead(c, S / 2, S / 2, r, palFor(colorId, mystery))
    );
  }

  private static topSprite(colorId: ColorId, mystery: boolean, rq: number, dpr: number): CachedSprite | null {
    const r = rq / dpr;
    const key = packKey(K_TOP, mystery ? 0 : colorId, rq, Math.round(dpr * 4));
    const W = r * 2.4;
    const ay = r * 0.85;
    const H = ay + r * (SCREW_TOP_RY + SCREW_TOP_SIDE) + r * 0.75;
    return SpriteCache.get(key, W, H, dpr, W / 2, ay, (c) =>
      paintTopHead(c, W / 2, ay, r, palFor(colorId, mystery))
    );
  }

  private static crossSprite(colorId: ColorId, rq: number, dpr: number): CachedSprite | null {
    const r = rq / dpr;
    const key = packKey(K_CROSS, colorId, rq, Math.round(dpr * 4));
    const S = r * 1.35;
    return SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) =>
      paintCross(c, S / 2, S / 2, r, palFor(colorId, false))
    );
  }

  private static questionSprite(rq: number, dpr: number): CachedSprite | null {
    const r = rq / dpr;
    const key = packKey(K_QMARK, 0, rq, Math.round(dpr * 4));
    const S = r * 1.6;
    return SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) => paintQuestion(c, S / 2, S / 2, r));
  }

  private static shaftSprite(rq: number, dpr: number): CachedSprite | null {
    const r = rq / dpr;
    const key = packKey(K_SHAFT, 0, rq, Math.round(dpr * 4));
    const W = r * 0.8;
    const H = r * 1.2;
    return SpriteCache.get(key, W, H, dpr, W / 2, 0, (c) => paintShaft(c, W / 2, 0, r));
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    colorId: ColorId,
    opts: ScrewDrawOptions = {}
  ): void {
    const scale = opts.scale ?? 1;
    const r = radius * scale;
    if (r <= 1) return;

    const dpr = getRenderScale(ctx);
    const rq = Math.max(2, Math.round(radius * dpr));
    const k = r / (rq / dpr); // draw scale relative to the baked radius
    const mystery = Boolean(opts.isMystery);
    const view = opts.view ?? (opts.showShaft ? 'top' : 'face');
    const rotation = opts.rotation ?? 0;

    const prevAlpha = ctx.globalAlpha;
    if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * Math.max(0, Math.min(1, opts.alpha));

    // Optional glow ring behind the head
    const glow = opts.glow ?? 0;
    if (glow > 0.01) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, glow);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.beginPath();
      if (view === 'top') ctx.ellipse(x, y, r * 1.16, r * SCREW_TOP_RY * 1.2, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, r * 1.14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const head =
      view === 'top'
        ? ScrewView.topSprite(colorId, mystery, rq, dpr)
        : ScrewView.faceSprite(colorId, mystery, rq, dpr);

    if (!head) {
      ScrewView.drawFallback(ctx, x, y, r, colorId, mystery);
      ctx.globalAlpha = prevAlpha;
      return;
    }

    if (view === 'top' && opts.showShaft) {
      const shaft = ScrewView.shaftSprite(rq, dpr);
      if (shaft) {
        ctx.drawImage(
          shaft.canvas,
          x - shaft.ax * k,
          y + r * (SCREW_TOP_RY * 0.6),
          shaft.w * k,
          shaft.h * k
        );
      }
    }

    ctx.drawImage(head.canvas, x - head.ax * k, y - head.ay * k, head.w * k, head.h * k);

    // Cross (rotates with the screw) or "?" mark
    const mark = mystery ? ScrewView.questionSprite(rq, dpr) : ScrewView.crossSprite(colorId, rq, dpr);
    if (mark) {
      const faceY = view === 'top' ? y : y + r * 0.02;
      const squash = view === 'top' ? SCREW_TOP_RY : 1;
      if (rotation === 0 || mystery) {
        const mw = mark.w * k;
        const mh = mark.h * k * squash;
        ctx.drawImage(mark.canvas, x - mw / 2, faceY - mh / 2, mw, mh);
      } else {
        ctx.save();
        ctx.translate(x, faceY);
        if (squash !== 1) ctx.scale(1, squash);
        ctx.rotate(rotation);
        ctx.drawImage(mark.canvas, -mark.ax * k, -mark.ay * k, mark.w * k, mark.h * k);
        ctx.restore();
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  /**
   * Draws a silver coil spring between yTop and yBottom (used between screws inside glass tubes).
   * Coil density follows the spring length, so slide-up animations compress/extend it naturally.
   */
  static drawSpring(
    ctx: CanvasRenderingContext2D,
    x: number,
    yTop: number,
    yBottom: number,
    width: number
  ): void {
    const len = yBottom - yTop;
    if (len <= 1 || width <= 2) return;
    const dpr = getRenderScale(ctx);
    const wq = Math.max(3, Math.round(width * dpr));
    const wCss = wq / dpr;
    const key = packKey(K_COIL, 0, wq, Math.round(dpr * 4));
    const S = wCss * 1.15;
    const H = wCss * 0.5;
    const coil = SpriteCache.get(key, S, H, dpr, S / 2, H / 2, (c) => paintCoil(c, S / 2, H / 2, wCss));
    const n = Math.max(2, Math.round(len / (wCss * 0.3)));
    const step = len / n;
    if (!coil) {
      ctx.strokeStyle = Theme.silverMid;
      ctx.lineWidth = Math.max(1, width * 0.12);
      for (let i = 0; i < n; i++) {
        const cy = yTop + (i + 0.5) * step;
        ctx.beginPath();
        ctx.ellipse(x, cy, width * 0.45, width * 0.15, 0, 0, Math.PI);
        ctx.stroke();
      }
      return;
    }
    const k = width / wCss;
    for (let i = 0; i < n; i++) {
      const cy = yTop + (i + 0.5) * step;
      ctx.drawImage(coil.canvas, x - coil.ax * k, cy - coil.ay * k, coil.w * k, coil.h * k);
    }
  }

  /** Procedural fallback (no DOM canvas available, e.g. headless tests). */
  private static drawFallback(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    colorId: ColorId,
    mystery: boolean
  ): void {
    const pal = palFor(colorId, mystery);
    ctx.fillStyle = pal.shadowHex;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.bodyHex;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
}

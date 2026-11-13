import { GameConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { SandBucketModel } from '../../game/models/SandBucketModel';
import { ColorId } from '../../types/level.types';
import {
  CachedSprite,
  GameSprites,
  getRenderScale,
  hash01,
  ImageStore,
  packKey,
  SpriteCache
} from '../SpriteCache';
import {
  clamp01,
  drawOutlinedText,
  easeOutBack,
  easeOutCubic,
  percentText,
  roundRectPath2,
  Theme
} from '../theme';
import { ScrewView } from './ScrewView';

/** Bucket height relative to its width (jar proportions from _Docs/image.png). */
const H_RATIO = 0.96;

// Geometry relative to the bucket center: x in units of w, y in units of h.
const BODY_HALF_W = 0.465;
const BODY_TOP = -0.17;
const BODY_BOT = 0.475;
const LID_CY = -0.33;
const LID_HALF_W = 0.49;
const LID_HALF_H = 0.18;
const LABEL_HALF_W = 0.34;
const LABEL_TOP = 0.19;
const LABEL_BOT = 0.425;
const MOUTH_RX = 0.4;
const MOUTH_RY = 0.075;
const HOLE_SPACING = 0.29;
const HOLE_R = 0.118;

const K_BODY_LOCKED = 10;
const K_BODY_OPEN = 11;
const K_LID = 12;
const K_SAND_TOP = 13;
const K_GLOW = 14;
const K_SHADOW = 15;

type Pal = ReturnType<typeof ColorManager.getColor>;

function mix(a: string, b: string, t: number): string {
  return ColorManager.mixHex(a, b, t);
}

function paintBody(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, pal: Pal, open: boolean): void {
  const h = w * H_RATIO;
  const x0 = cx - BODY_HALF_W * w;
  const bw = BODY_HALF_W * 2 * w;
  const y0 = cy + BODY_TOP * h;
  const bh = (BODY_BOT - BODY_TOP) * h;

  // Body cylinder
  const g = c.createLinearGradient(x0, 0, x0 + bw, 0);
  g.addColorStop(0, mix(pal.bodyHex, pal.shadowHex, 0.15));
  g.addColorStop(0.1, mix(pal.bodyHex, '#ffffff', 0.28));
  g.addColorStop(0.32, mix(pal.bodyHex, '#ffffff', 0.08));
  g.addColorStop(0.7, pal.bodyHex);
  g.addColorStop(1, mix(pal.bodyHex, pal.shadowHex, 0.6));
  c.fillStyle = g;
  roundRectPath2(c, x0, y0, bw, bh, w * 0.07, w * 0.21);
  c.fill();

  // Vertical shading (bottom darker) clipped to body
  c.save();
  roundRectPath2(c, x0, y0, bw, bh, w * 0.07, w * 0.21);
  c.clip();
  const vg = c.createLinearGradient(0, y0, 0, y0 + bh);
  vg.addColorStop(0, 'rgba(255,255,255,0.10)');
  vg.addColorStop(0.55, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,16,48,0.22)');
  c.fillStyle = vg;
  c.fillRect(x0, y0, bw, bh);
  // Left gloss strip
  const gl = c.createLinearGradient(cx - 0.4 * w, 0, cx - 0.3 * w, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl;
  c.fillRect(cx - 0.4 * w, y0 + h * 0.08, w * 0.1, bh * 0.72);
  c.restore();

  // Outline
  c.strokeStyle = mix(pal.shadowHex, '#0b1030', 0.35);
  c.globalAlpha = 0.45;
  c.lineWidth = Math.max(1, w * 0.016);
  roundRectPath2(c, x0, y0, bw, bh, w * 0.07, w * 0.21);
  c.stroke();
  c.globalAlpha = 1;

  // Label plate
  const lx = cx - LABEL_HALF_W * w;
  const lw = LABEL_HALF_W * 2 * w;
  const ly = cy + LABEL_TOP * h;
  const lh = (LABEL_BOT - LABEL_TOP) * h;
  const lg = c.createLinearGradient(0, ly, 0, ly + lh);
  lg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.55));
  lg.addColorStop(1, mix(pal.bodyHex, '#ffffff', 0.72));
  c.fillStyle = lg;
  roundRectPath2(c, lx, ly, lw, lh, w * 0.1, w * 0.1);
  c.fill();
  c.strokeStyle = mix(pal.bodyHex, pal.shadowHex, 0.45);
  c.globalAlpha = 0.6;
  c.lineWidth = Math.max(1, w * 0.014);
  c.stroke();
  c.globalAlpha = 1;
  // inner top shadow on the label
  c.save();
  roundRectPath2(c, lx, ly, lw, lh, w * 0.1, w * 0.1);
  c.clip();
  const ls = c.createLinearGradient(0, ly, 0, ly + lh * 0.4);
  ls.addColorStop(0, 'rgba(20,30,80,0.18)');
  ls.addColorStop(1, 'rgba(20,30,80,0)');
  c.fillStyle = ls;
  c.fillRect(lx, ly, lw, lh * 0.4);
  c.restore();

  if (open) {
    // Rim + dark interior (sand is drawn per frame on top)
    const my = cy + BODY_TOP * h;
    c.fillStyle = mix(pal.bodyHex, '#ffffff', 0.38);
    c.beginPath();
    c.ellipse(cx, my, BODY_HALF_W * w, MOUTH_RY * h * 1.32, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = mix(pal.bodyHex, pal.shadowHex, 0.4);
    c.lineWidth = Math.max(1, w * 0.014);
    c.stroke();
    const ig = c.createLinearGradient(0, my - MOUTH_RY * h, 0, my + MOUTH_RY * h);
    ig.addColorStop(0, mix(pal.shadowHex, '#05081a', 0.55));
    ig.addColorStop(1, mix(pal.shadowHex, '#05081a', 0.25));
    c.fillStyle = ig;
    c.beginPath();
    c.ellipse(cx, my, MOUTH_RX * w, MOUTH_RY * h, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    // Rim ridge where the lid sits
    c.fillStyle = mix(pal.shadowHex, '#0b1030', 0.25);
    c.globalAlpha = 0.35;
    c.fillRect(x0 + w * 0.02, y0, bw - w * 0.04, h * 0.035);
    c.globalAlpha = 1;

    // 3 screw sockets
    for (let k = 0; k < 3; k++) {
      const hx = cx + (k - 1) * HOLE_SPACING * w;
      const hy = cy;
      const r = HOLE_R * w;
      // raised light ring
      const rg = c.createLinearGradient(0, hy - r * 1.2, 0, hy + r * 1.2);
      rg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.7));
      rg.addColorStop(1, mix(pal.bodyHex, '#ffffff', 0.3));
      c.fillStyle = rg;
      c.beginPath();
      c.arc(hx, hy, r * 1.16, 0, Math.PI * 2);
      c.fill();
      // dark recess
      const dg = c.createRadialGradient(hx, hy - r * 0.35, r * 0.1, hx, hy, r);
      dg.addColorStop(0, mix(pal.shadowHex, '#05081a', 0.6));
      dg.addColorStop(1, mix(pal.shadowHex, '#05081a', 0.3));
      c.fillStyle = dg;
      c.beginPath();
      c.arc(hx, hy, r * 0.86, 0, Math.PI * 2);
      c.fill();
      // lower inner highlight (depth)
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = Math.max(0.8, r * 0.12);
      c.beginPath();
      c.arc(hx, hy, r * 0.78, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
      // ghost "+" hint
      c.strokeStyle = mix(pal.bodyHex, '#ffffff', 0.2);
      c.globalAlpha = 0.35;
      c.lineWidth = Math.max(1, r * 0.2);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(hx - r * 0.38, hy);
      c.lineTo(hx + r * 0.38, hy);
      c.moveTo(hx, hy - r * 0.38);
      c.lineTo(hx, hy + r * 0.38);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
}

function paintLid(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, pal: Pal): void {
  const h = w * H_RATIO;
  const hw = LID_HALF_W * w;
  const hh = LID_HALF_H * h;
  const x0 = cx - hw;
  const y0 = cy - hh;

  // Soft shadow under the lid lip
  c.fillStyle = 'rgba(10,16,48,0.22)';
  roundRectPath2(c, x0 + w * 0.01, y0 + h * 0.03, hw * 2 - w * 0.02, hh * 2, w * 0.2, w * 0.08);
  c.fill();

  // Cap side
  const g = c.createLinearGradient(x0, 0, x0 + hw * 2, 0);
  g.addColorStop(0, mix(pal.bodyHex, pal.shadowHex, 0.12));
  g.addColorStop(0.12, mix(pal.bodyHex, '#ffffff', 0.32));
  g.addColorStop(0.4, mix(pal.bodyHex, '#ffffff', 0.1));
  g.addColorStop(0.75, pal.bodyHex);
  g.addColorStop(1, mix(pal.bodyHex, pal.shadowHex, 0.55));
  c.fillStyle = g;
  roundRectPath2(c, x0, y0, hw * 2, hh * 2, w * 0.2, w * 0.08);
  c.fill();

  // Bottom lip band (darker)
  c.save();
  roundRectPath2(c, x0, y0, hw * 2, hh * 2, w * 0.2, w * 0.08);
  c.clip();
  const lip = c.createLinearGradient(0, cy + hh * 0.35, 0, cy + hh);
  lip.addColorStop(0, 'rgba(10,16,48,0)');
  lip.addColorStop(1, 'rgba(10,16,48,0.28)');
  c.fillStyle = lip;
  c.fillRect(x0, cy + hh * 0.35, hw * 2, hh * 0.7);
  c.restore();

  // Top face (lighter ellipse)
  const tg = c.createLinearGradient(0, y0, 0, cy + hh * 0.2);
  tg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.55));
  tg.addColorStop(1, mix(pal.bodyHex, '#ffffff', 0.22));
  c.fillStyle = tg;
  c.beginPath();
  c.ellipse(cx, cy - hh * 0.3, hw * 0.86, hh * 0.52, 0, 0, Math.PI * 2);
  c.fill();

  // Gloss
  c.save();
  c.translate(cx - hw * 0.45, cy - hh * 0.5);
  c.rotate(-0.12);
  c.scale(1, 0.32);
  const gg = c.createRadialGradient(0, 0, 0, 0, 0, hw * 0.32);
  gg.addColorStop(0, 'rgba(255,255,255,0.85)');
  gg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gg;
  c.beginPath();
  c.arc(0, 0, hw * 0.32, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Outline
  c.strokeStyle = mix(pal.shadowHex, '#0b1030', 0.35);
  c.globalAlpha = 0.5;
  c.lineWidth = Math.max(1, w * 0.016);
  roundRectPath2(c, x0, y0, hw * 2, hh * 2, w * 0.2, w * 0.08);
  c.stroke();
  c.globalAlpha = 1;
}

function paintSandTop(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, pal: Pal): void {
  const h = w * H_RATIO;
  const rx = MOUTH_RX * w;
  const ry = MOUTH_RY * h * 1.25;
  const g = c.createRadialGradient(cx - rx * 0.2, cy - ry * 0.4, rx * 0.05, cx, cy, rx);
  g.addColorStop(0, mix(pal.sandHex, '#ffffff', 0.45));
  g.addColorStop(0.6, pal.sandHex);
  g.addColorStop(1, mix(pal.sandHex, pal.shadowHex, 0.5));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();

  // Bead dots
  c.save();
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.clip();
  const br = Math.max(1, w * 0.026);
  const light = mix(pal.sandHex, '#ffffff', 0.6);
  const dark = mix(pal.sandHex, pal.shadowHex, 0.45);
  for (let i = 0; i < 70; i++) {
    const a = hash01(i, 7) * Math.PI * 2;
    const d = Math.sqrt(hash01(i, 13));
    const px = cx + Math.cos(a) * d * rx;
    const py = cy + Math.sin(a) * d * ry;
    c.fillStyle = dark;
    c.beginPath();
    c.arc(px + br * 0.25, py + br * 0.3, br, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = i % 3 === 0 ? light : pal.sandHex;
    c.beginPath();
    c.arc(px, py, br, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function paintGlow(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const g = c.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, 'rgba(255, 236, 120, 0.85)');
  g.addColorStop(0.55, 'rgba(255, 210, 60, 0.45)');
  g.addColorStop(1, 'rgba(255, 200, 40, 0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
}

function paintShadowBlob(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx);
  g.addColorStop(0, 'rgba(14, 18, 60, 0.42)');
  g.addColorStop(1, 'rgba(14, 18, 60, 0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export class SandBucketView {
  /** Hole row offset from the bucket center, in units of bucket width. */
  static readonly HOLE_DY_RATIO = 0;

  static getHolePosition(
    bucketX: number,
    bucketY: number,
    bucketW: number,
    holeIndex: number
  ): [number, number] {
    const hx = bucketX + (holeIndex - 1) * bucketW * HOLE_SPACING;
    const hy = bucketY + bucketW * SandBucketView.HOLE_DY_RATIO;
    return [hx, hy];
  }

  /** Y of the bucket mouth (where sand enters) relative to the bucket center, in px. */
  static getMouthOffsetY(bucketW: number): number {
    return BODY_TOP * bucketW * H_RATIO;
  }

  private static sprite(
    kind: number,
    colorId: ColorId,
    w: number,
    dpr: number
  ): CachedSprite | null {
    const wq = Math.max(8, Math.round(w * dpr));
    const wc = wq / dpr;
    const key = packKey(kind, colorId, wq, Math.round(dpr * 4));
    const pal = ColorManager.getColor(colorId);
    const h = wc * H_RATIO;
    switch (kind) {
      case K_BODY_LOCKED:
      case K_BODY_OPEN: {
        const W = wc * 1.04;
        const H = h * 0.86;
        const ay = h * 0.31; // center sits 0.31h below the sprite top (open rim reaches -0.27h)
        return SpriteCache.get(key, W, H, dpr, W / 2, ay, (c) =>
          paintBody(c, W / 2, ay, wc, pal, kind === K_BODY_OPEN)
        );
      }
      case K_LID: {
        const W = wc * 1.04;
        const H = h * 0.46;
        return SpriteCache.get(key, W, H, dpr, W / 2, H / 2, (c) => paintLid(c, W / 2, H / 2, wc, pal));
      }
      case K_SAND_TOP: {
        const W = wc * 0.86;
        const H = h * 0.22;
        return SpriteCache.get(key, W, H, dpr, W / 2, H / 2, (c) => paintSandTop(c, W / 2, H / 2, wc, pal));
      }
      case K_GLOW: {
        const S = wc * 1.7;
        return SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) => paintGlow(c, S / 2, S / 2, S / 2));
      }
      case K_SHADOW: {
        const W = wc * 1.2;
        const H = wc * 0.36;
        return SpriteCache.get(key, W, H, dpr, W / 2, H / 2, (c) =>
          paintShadowBlob(c, W / 2, H / 2, W / 2, H / 2)
        );
      }
      default:
        return null;
    }
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    bucket: SandBucketModel,
    nowMs: number,
    highlightForHandBooster = false
  ): void {
    const h = w * H_RATIO;
    const dpr = getRenderScale(ctx);
    const colorId = bucket.colorId;
    const twistMs = GameConfig.lidTwistDurationMs;
    const flipMs = GameConfig.lidFlipDurationMs;

    const openElapsed = bucket.isOpen
      ? bucket.openStartedAtMs !== null
        ? nowMs - bucket.openStartedAtMs
        : twistMs + flipMs
      : -1;
    const completeElapsed = bucket.completedAtMs !== null ? nowMs - bucket.completedAtMs : -1;

    // --- Lid pose (0 = closed, 1 = propped open) & twist wiggle --------------------------------
    let lidPose = 0;
    let lidWiggle = 0;
    let shakeX = 0;
    let bodyOpenAlpha = 0;
    if (openElapsed >= 0) {
      if (openElapsed < twistMs) {
        const q = openElapsed / twistMs;
        lidWiggle = Math.sin(q * Math.PI * 4) * 0.07 * (1 - q * 0.5);
        shakeX = Math.sin(q * Math.PI * 6) * w * 0.015;
      } else {
        const q = clamp01((openElapsed - twistMs) / flipMs);
        lidPose = easeOutBack(q, 2.2);
        bodyOpenAlpha = clamp01(q * 1.6);
      }
    }
    let popScale = 1;
    if (completeElapsed >= 0) {
      const c = clamp01(completeElapsed / 200);
      lidPose *= 1 - easeOutCubic(c);
      popScale = 1 + Math.sin(clamp01(completeElapsed / 260) * Math.PI) * 0.08;
    }

    const bx = x + shakeX;
    const scaled = popScale !== 1;
    if (scaled) {
      ctx.save();
      ctx.translate(bx, y + h * 0.47);
      ctx.scale(popScale, popScale);
      ctx.translate(-bx, -(y + h * 0.47));
    }

    // 1. Hand-booster glow
    const handMode = highlightForHandBooster && !bucket.isOpen;
    if (handMode) {
      const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.008);
      const glow = SandBucketView.sprite(K_GLOW, 0, w, dpr);
      if (glow) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (0.55 + pulse * 0.45);
        ctx.drawImage(glow.canvas, bx - glow.ax, y - glow.ay, glow.w, glow.h);
        ctx.globalAlpha = prev;
      }
    }

    // 2. Contact shadow (SandLoopGame xo_shadow.png, procedural fallback)
    const shadowImg = ImageStore.get(GameSprites.bucketShadow);
    if (shadowImg) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.6;
      ctx.drawImage(shadowImg, bx - w * 0.6, y + h * 0.32, w * 1.22, w * 0.34);
      ctx.globalAlpha = prev;
    } else {
      const sh = SandBucketView.sprite(K_SHADOW, 0, w, dpr);
      if (sh) ctx.drawImage(sh.canvas, bx - sh.ax + w * 0.03, y + h * 0.47 - sh.ay, sh.w, sh.h);
    }

    // 3. Body (locked ↔ open crossfade)
    const bodyLocked = SandBucketView.sprite(K_BODY_LOCKED, colorId, w, dpr);
    const bodyOpen = bodyOpenAlpha > 0 ? SandBucketView.sprite(K_BODY_OPEN, colorId, w, dpr) : null;
    if (!bodyLocked) {
      SandBucketView.drawFallback(ctx, bx, y, w, bucket);
      if (scaled) ctx.restore();
      return;
    }
    if (bodyOpen && bodyOpenAlpha >= 1) {
      ctx.drawImage(bodyOpen.canvas, bx - bodyOpen.ax, y - bodyOpen.ay, bodyOpen.w, bodyOpen.h);
    } else {
      ctx.drawImage(bodyLocked.canvas, bx - bodyLocked.ax, y - bodyLocked.ay, bodyLocked.w, bodyLocked.h);
      if (bodyOpen) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * bodyOpenAlpha;
        ctx.drawImage(bodyOpen.canvas, bx - bodyOpen.ax, y - bodyOpen.ay, bodyOpen.w, bodyOpen.h);
        ctx.globalAlpha = prev;
      }
    }

    // 4. Sand inside the open mouth (rises with fill ratio)
    const fillRatio = bucket.capacity > 0 ? clamp01(bucket.collected / bucket.capacity) : 0;
    if (bodyOpenAlpha > 0 && fillRatio > 0) {
      const sandTop = SandBucketView.sprite(K_SAND_TOP, colorId, w, dpr);
      if (sandTop) {
        const my = y + BODY_TOP * h;
        const surfaceY = my + (1 - fillRatio) * h * 0.16 - fillRatio * fillRatio * fillRatio * h * 0.045;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(bx, my, MOUTH_RX * w, MOUTH_RY * h, 0, 0, Math.PI * 2);
        ctx.rect(bx - MOUTH_RX * w, my - h * 0.3, MOUTH_RX * 2 * w, h * 0.3);
        ctx.clip();
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * bodyOpenAlpha;
        ctx.drawImage(sandTop.canvas, bx - sandTop.ax, surfaceY - sandTop.ay, sandTop.w, sandTop.h);
        ctx.globalAlpha = prev;
        ctx.restore();
      }
    }

    // 5. Screws seated in the 3 holes (pop on landing, unscrew + fade while the lid twists)
    const holeR = HOLE_R * w;
    if (bodyOpenAlpha < 1) {
      const unscrew = openElapsed >= 0 ? clamp01(openElapsed / twistMs) : 0;
      const n = Math.min(3, bucket.holes.length);
      for (let k = 0; k < n; k++) {
        const hole = bucket.holes[k];
        if (!hole || !hole.landed) continue;
        const hx = bx + (k - 1) * HOLE_SPACING * w;
        const hy = y + w * SandBucketView.HOLE_DY_RATIO;
        const t = hole.landedAtMs !== null ? clamp01((nowMs - hole.landedAtMs) / 240) : 1;
        let rot = -(1 - t) * 6.5;
        let scale = 1 + Math.sin(t * Math.PI) * 0.24;
        let alpha = 1;
        let lift = 0;
        if (unscrew > 0) {
          rot += unscrew * Math.PI * 3;
          scale *= 1 - unscrew * 0.3;
          alpha = 1 - unscrew;
          lift = unscrew * h * 0.08;
        }
        ScrewView.draw(ctx, hx, hy - lift, holeR, colorId, {
          view: 'face',
          rotation: rot,
          scale,
          alpha,
          glow: t < 1 ? (1 - t) * 0.9 : 0
        });
      }
    }

    // 6. Percentage label (outlined text) — turns green when complete
    const labelY = y + ((LABEL_TOP + LABEL_BOT) / 2) * h + h * 0.005;
    const done = bucket.completedAtMs !== null || bucket.isFull();
    if (done) {
      const lx = bx - LABEL_HALF_W * w;
      const ly = y + LABEL_TOP * h;
      ctx.fillStyle = Theme.greenMid;
      roundRectPath2(ctx, lx, ly, LABEL_HALF_W * 2 * w, (LABEL_BOT - LABEL_TOP) * h, w * 0.1, w * 0.1);
      ctx.fill();
      drawOutlinedText(ctx, percentText(100), bx, labelY, w * 0.2, '#ffffff', Theme.greenBottom, w * 0.05);
    } else {
      drawOutlinedText(
        ctx,
        percentText(bucket.getPercentage()),
        bx,
        labelY,
        w * 0.2,
        Theme.labelInk,
        'rgba(255,255,255,0.9)',
        w * 0.045
      );
    }

    // 7. Lid (closed → twist wiggle → propped open, closes again on completion)
    const lid = SandBucketView.sprite(K_LID, colorId, w, dpr);
    if (lid) {
      const lcx = bx + lidPose * w * 0.08;
      const lcy = y + LID_CY * h - lidPose * h * 0.2;
      const rot = lidWiggle - lidPose * 0.38;
      if (rot === 0) {
        ctx.drawImage(lid.canvas, lcx - lid.ax, lcy - lid.ay, lid.w, lid.h);
      } else {
        ctx.save();
        ctx.translate(lcx, lcy);
        ctx.rotate(rot);
        ctx.drawImage(lid.canvas, -lid.ax, -lid.ay, lid.w, lid.h);
        ctx.restore();
      }
    }

    // 8. Completion sparkle ring
    if (completeElapsed >= 0 && completeElapsed < 320) {
      const q = completeElapsed / 320;
      ctx.save();
      ctx.globalAlpha *= 1 - q;
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = Math.max(1.5, w * 0.04 * (1 - q));
      ctx.beginPath();
      ctx.ellipse(bx, y, w * (0.5 + q * 0.25), h * (0.5 + q * 0.25), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 9. Hand-booster pointer (bouncing hand icon)
    if (handMode) {
      const bob = Math.sin(nowMs * 0.01) * h * 0.05;
      const hand = ImageStore.get(GameSprites.hand);
      const s = w * 0.5;
      if (hand) {
        ctx.drawImage(hand, bx + w * 0.12, y - h * 0.62 + bob - s * 0.3, s, s);
      } else {
        drawOutlinedText(ctx, '👆', bx + w * 0.3, y - h * 0.5 + bob, w * 0.3, '#ffe552', '#141e3c', 3);
      }
    }

    if (scaled) ctx.restore();
  }

  private static drawFallback(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    bucket: SandBucketModel
  ): void {
    const h = w * H_RATIO;
    const pal = ColorManager.getColor(bucket.colorId);
    ctx.fillStyle = pal.bodyHex;
    roundRectPath2(ctx, x - w * 0.46, y - h * 0.5, w * 0.92, h * 0.97, w * 0.2, w * 0.2);
    ctx.fill();
    drawOutlinedText(ctx, percentText(bucket.getPercentage()), x, y + h * 0.3, w * 0.2, '#fff', '#000', 2);
  }
}

import { LinearConveyorModel } from '../../game/models/LinearConveyorModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { createLayer, GameSprites, getRenderScale, ImageStore, Layer } from '../SpriteCache';
import { roundRectPath2, Theme } from '../theme';
import { SandBucketView } from './SandBucketView';

export interface ConveyorLayout {
  beltLeftX: number;
  beltRightX: number;
  tunnelWidth: number;
  visibleMinX: number;
  visibleMaxX: number;
  trackStartX: number;
  trackEndX: number;
  bucketCenterY: number;
  bucketWidth: number;
}

interface BeltGeom {
  w: number;
  cy: number;
  deckTop: number;
  deckBot: number;
  railH: number;
  railBot: number;
  beltLeft: number;
  beltRight: number;
  archW: number;
  archT: number;
  archTop: number;
  leftArchX: number;
  rightArchX: number;
  clipMinX: number;
  clipMaxX: number;
  plankP: number;
}

interface BeltLayers {
  key: Float64Array;
  dpr: number;
  g: BeltGeom;
  ox: number;
  oy: number;
  back: Layer;
  front: Layer;
  strip: Layer;
  stripW: number;
}

function computeGeom(L: ConveyorLayout): BeltGeom {
  const w = L.bucketWidth;
  const h = w * 0.96;
  const cy = L.bucketCenterY;
  const deckTop = cy - w * 0.05;
  const deckBot = cy + w * 0.5;
  const railH = w * 0.12;
  const railBot = deckBot + railH;
  const archW = Math.max(L.tunnelWidth * 1.25, w * 0.5);
  const archT = archW * 0.3;
  const archTop = cy - h * 0.58;
  const leftArchX = L.beltLeftX - w * 0.06;
  const rightArchX = L.beltRightX + w * 0.06 - archW;
  return {
    w,
    cy,
    deckTop,
    deckBot,
    railH,
    railBot,
    beltLeft: L.beltLeftX,
    beltRight: L.beltRightX,
    archW,
    archT,
    archTop,
    leftArchX,
    rightArchX,
    clipMinX: leftArchX - w * 0.25,
    clipMaxX: rightArchX + archW + w * 0.25,
    plankP: Math.max(10, w * 0.2)
  };
}

/** ∩ outline: rounded top, flat bottom. */
function archPath(c: CanvasRenderingContext2D, x: number, top: number, w: number, bottom: number): void {
  const r = w / 2;
  c.moveTo(x, bottom);
  c.lineTo(x, top + r);
  c.arc(x + r, top + r, r, Math.PI, 0, false);
  c.lineTo(x + w, bottom);
  c.closePath();
}

function paintBack(c: CanvasRenderingContext2D, g: BeltGeom): void {
  const beltW = g.beltRight - g.beltLeft;

  // Shadow under the whole conveyor
  const sh = c.createLinearGradient(0, g.railBot - 2, 0, g.railBot + g.w * 0.14);
  sh.addColorStop(0, 'rgba(24, 34, 96, 0.34)');
  sh.addColorStop(1, 'rgba(24, 34, 96, 0)');
  c.fillStyle = sh;
  c.fillRect(g.beltLeft + 4, g.railBot - 2, beltW - 8, g.w * 0.14);

  // Back rail (far edge of the belt)
  const br = g.w * 0.06;
  const bg = c.createLinearGradient(0, g.deckTop - br, 0, g.deckTop + 1);
  bg.addColorStop(0, '#b9bdf6');
  bg.addColorStop(1, '#8589d9');
  c.fillStyle = bg;
  drawRoundedRect(c, g.beltLeft, g.deckTop - br, beltW, br + 2, br * 0.5);
  c.fill();

  // Front rail (white/lavender lip)
  const rg = c.createLinearGradient(0, g.deckBot, 0, g.railBot);
  rg.addColorStop(0, Theme.railTop);
  rg.addColorStop(0.55, '#dfe2fb');
  rg.addColorStop(1, Theme.railBottom);
  c.fillStyle = rg;
  drawRoundedRect(c, g.beltLeft, g.deckBot - 1, beltW, g.railH + 1, g.railH * 0.35);
  c.fill();
  c.strokeStyle = Theme.railOutline;
  c.lineWidth = 1.2;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(g.beltLeft + 4, g.deckBot + 1);
  c.lineTo(g.beltRight - 4, g.deckBot + 1);
  c.stroke();

  // Arch back faces + dark tunnel interiors
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? g.leftArchX : g.rightArchX;
    const depth = g.w * 0.07 * (side === 0 ? -1 : 1);
    c.fillStyle = Theme.archDark;
    c.beginPath();
    archPath(c, x + depth, g.archTop - g.w * 0.04, g.archW, g.railBot);
    c.fill();

    const ix = x + g.archT;
    const iw = g.archW - g.archT * 2;
    const it = g.archTop + g.archT;
    const tg = c.createLinearGradient(0, it, 0, g.deckBot);
    tg.addColorStop(0, Theme.tunnelDeep);
    tg.addColorStop(1, Theme.tunnelMouth);
    c.fillStyle = tg;
    c.beginPath();
    archPath(c, ix + depth * 0.5, it, iw, g.railBot);
    c.fill();
  }
}

function paintStrip(c: CanvasRenderingContext2D, g: BeltGeom, stripW: number): void {
  const deckH = g.deckBot - g.deckTop;
  const base = c.createLinearGradient(0, 0, 0, deckH);
  base.addColorStop(0, Theme.deckBack);
  base.addColorStop(1, Theme.deckFront);
  c.fillStyle = base;
  c.fillRect(0, 0, stripW, deckH);

  const P = g.plankP;
  const n = Math.ceil(stripW / P) + 1;
  for (let i = 0; i < n; i++) {
    const x = i * P;
    if (i % 2 === 0) {
      c.fillStyle = 'rgba(255,255,255,0.045)';
      c.fillRect(x, 0, P, deckH);
    }
    c.fillStyle = Theme.plankLineDark;
    c.fillRect(x, 0, 1.3, deckH);
    c.fillStyle = Theme.plankLineLight;
    c.fillRect(x + 1.3, 0, 1, deckH);
  }

  // Back-edge occlusion + front-edge sheen
  const occ = c.createLinearGradient(0, 0, 0, deckH * 0.35);
  occ.addColorStop(0, 'rgba(12, 10, 60, 0.35)');
  occ.addColorStop(1, 'rgba(12, 10, 60, 0)');
  c.fillStyle = occ;
  c.fillRect(0, 0, stripW, deckH * 0.35);
  c.fillStyle = 'rgba(255,255,255,0.14)';
  c.fillRect(0, deckH - 2, stripW, 2);
}

function paintFront(c: CanvasRenderingContext2D, g: BeltGeom): void {
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? g.leftArchX : g.rightArchX;

    // Tunnel floor darkness over the deck inside the opening
    const ox0 = x + g.archT;
    const ow = g.archW - g.archT * 2;
    const fg = c.createLinearGradient(side === 0 ? ox0 : ox0 + ow, 0, side === 0 ? ox0 + ow : ox0, 0);
    fg.addColorStop(0, 'rgba(18, 18, 70, 0.75)');
    fg.addColorStop(1, 'rgba(18, 18, 70, 0.25)');
    c.fillStyle = fg;
    c.fillRect(ox0, g.deckTop - 1, ow, g.deckBot - g.deckTop + 1);

    // Front ∩ face (even-odd: outer minus opening)
    const ag = c.createLinearGradient(x, 0, x + g.archW, 0);
    if (side === 0) {
      ag.addColorStop(0, Theme.archDark);
      ag.addColorStop(0.18, Theme.archLight);
      ag.addColorStop(0.6, Theme.archMid);
      ag.addColorStop(1, Theme.archDark);
    } else {
      ag.addColorStop(0, Theme.archDark);
      ag.addColorStop(0.4, Theme.archMid);
      ag.addColorStop(0.82, Theme.archLight);
      ag.addColorStop(1, Theme.archDark);
    }
    c.fillStyle = ag;
    c.beginPath();
    archPath(c, x, g.archTop, g.archW, g.railBot);
    archPath(c, x + g.archT, g.archTop + g.archT, g.archW - g.archT * 2, g.railBot + 1);
    c.fill('evenodd');
    c.strokeStyle = Theme.archOutline;
    c.lineWidth = 1.4;
    c.stroke();

    // Top gloss along the arch
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = Math.max(1.5, g.archT * 0.22);
    c.lineCap = 'round';
    c.beginPath();
    const r = g.archW / 2;
    c.arc(x + r, g.archTop + r, r - g.archT * 0.38, Math.PI * 1.12, Math.PI * 1.55);
    c.stroke();

    // Chunky white foot / end cap at the rail end
    const fx = x - g.w * 0.05;
    const fw = g.archW + g.w * 0.1;
    const fy = g.deckBot - g.railH * 0.15;
    const fh = g.railH * 1.45;
    const footG = c.createLinearGradient(0, fy, 0, fy + fh);
    footG.addColorStop(0, '#ffffff');
    footG.addColorStop(1, '#c9cef4');
    c.fillStyle = footG;
    roundRectPath2(c, fx, fy, fw, fh, g.w * 0.06, g.w * 0.08);
    c.fill();
    c.strokeStyle = Theme.archOutline;
    c.lineWidth = 1.2;
    c.stroke();
  }
}

export class LinearConveyorView {
  private static layers: BeltLayers | null = null;
  private static readonly keyScratch = new Float64Array(8);

  private static ensureLayers(layout: ConveyorLayout, dpr: number): BeltLayers | null {
    const k = LinearConveyorView.keyScratch;
    k[0] = layout.beltLeftX;
    k[1] = layout.beltRightX;
    k[2] = layout.tunnelWidth;
    k[3] = layout.bucketCenterY;
    k[4] = layout.bucketWidth;
    k[5] = layout.visibleMinX;
    k[6] = layout.visibleMaxX;
    k[7] = dpr;
    const cur = LinearConveyorView.layers;
    if (cur) {
      let same = true;
      for (let i = 0; i < 8; i++) {
        if (cur.key[i] !== k[i]) {
          same = false;
          break;
        }
      }
      if (same) return cur;
    }

    const g = computeGeom(layout);
    const ox = Math.floor(Math.min(g.leftArchX - g.w * 0.15, g.beltLeft - g.w * 0.15));
    const oy = Math.floor(g.archTop - g.w * 0.12);
    const lw = Math.ceil(Math.max(g.rightArchX + g.archW + g.w * 0.15, g.beltRight + g.w * 0.15) - ox);
    const lh = Math.ceil(g.railBot + g.w * 0.2 - oy);

    const back = createLayer(lw, lh, dpr);
    const front = createLayer(lw, lh, dpr);
    const beltW = g.beltRight - g.beltLeft;
    const stripW = Math.ceil(beltW + g.plankP * 2);
    const strip = createLayer(stripW, g.deckBot - g.deckTop, dpr);
    if (!back || !front || !strip) return null;

    back.ctx.translate(-ox, -oy);
    paintBack(back.ctx, g);
    front.ctx.translate(-ox, -oy);
    paintFront(front.ctx, g);
    paintStrip(strip.ctx, g, stripW);

    const next: BeltLayers = { key: Float64Array.from(k), dpr, g, ox, oy, back, front, strip, stripW };
    LinearConveyorView.layers = next;
    return next;
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    conveyor: LinearConveyorModel,
    layout: ConveyorLayout,
    nowMs: number,
    isFastForward: boolean,
    highlightLockedBuckets: boolean,
    speedMultiplier = 1
  ): void {
    const dpr = getRenderScale(ctx);
    const L = LinearConveyorView.ensureLayers(layout, dpr);
    const { trackStartX, trackEndX, bucketCenterY, bucketWidth } = layout;

    if (L) {
      const g = L.g;
      const lw = L.back.canvas.width / dpr;
      const lh = L.back.canvas.height / dpr;
      ctx.drawImage(L.back.canvas, L.ox, L.oy, lw, lh);

      // Scrolling planks: one blit from the periodic strip (travel distance drives the offset)
      const P = g.plankP;
      const travel = conveyor.getBeltTravelDistancePx();
      const o = ((travel % P) + P) % P;
      const beltW = g.beltRight - g.beltLeft;
      const deckH = g.deckBot - g.deckTop;
      ctx.drawImage(
        L.strip.canvas,
        (P - o) * dpr,
        0,
        beltW * dpr,
        L.strip.canvas.height,
        g.beltLeft,
        g.deckTop,
        beltW,
        deckH
      );
      if (isFastForward) {
        ctx.fillStyle = 'rgba(255, 244, 170, 0.08)';
        ctx.fillRect(g.beltLeft, g.deckTop, beltW, deckH);
      }

      LinearConveyorView.drawSlotIndicators(ctx, conveyor, g, nowMs, isFastForward);
    } else {
      // Procedural fallback (no offscreen canvas support)
      ctx.fillStyle = Theme.deckFront;
      ctx.fillRect(layout.beltLeftX, bucketCenterY - bucketWidth * 0.05, layout.beltRightX - layout.beltLeftX, bucketWidth * 0.55);
    }

    // 2. Buckets & Fish Jam Fever Bay Platforms, clipped between the tunnel arches
    const clipMinX = L ? L.g.clipMinX : layout.visibleMinX;
    const clipMaxX = L ? L.g.clipMaxX : layout.visibleMaxX;
    const clipBottom = L ? L.g.railBot + bucketWidth * 0.1 : bucketCenterY + bucketWidth;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipMinX, 0, clipMaxX - clipMinX, clipBottom);
    ctx.clip();

    // Draw all 4 Bay Stations (Fish Jam Fever style: open bays have buckets, locked bays have 3D lock pads)
    for (let i = 0; i < conveyor.maxActiveSlots; i++) {
      const bayX = conveyor.getBayX(i, layout.visibleMinX, layout.visibleMaxX);
      const isLocked = i >= conveyor.activeSlots;

      if (isLocked) {
        // 3D Locked Bay Pad (tap to unlock directly!)
        LinearConveyorView.drawLockedBay(ctx, bayX, bucketCenterY, bucketWidth, nowMs);
      } else {
        // Active Bay: draw subtle docking station under the bucket
        LinearConveyorView.drawActiveBayPad(ctx, bayX, bucketCenterY, bucketWidth);
        const bucket = conveyor.slots[i];
        if (bucket) {
          const bx = bucket.visualX || bayX;
          SandBucketView.draw(ctx, bx, bucketCenterY, bucketWidth, bucket, nowMs, highlightLockedBuckets, speedMultiplier);
        }
      }
    }

    for (const leaving of conveyor.leavingBuckets) {
      SandBucketView.draw(ctx, leaving.visualX, bucketCenterY, bucketWidth, leaving, nowMs, false, speedMultiplier);
    }
    ctx.restore();

    if (L) {
      const lw = L.front.canvas.width / dpr;
      const lh = L.front.canvas.height / dpr;
      ctx.drawImage(L.front.canvas, L.ox, L.oy, lw, lh);
    }
  }

  /**
   * Draws a subtle recessed bay station on the conveyor belt under an active bucket.
   */
  private static drawActiveBayPad(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number
  ): void {
    const rx = w * 0.44;
    const ry = w * 0.16;
    const cy = y + w * 0.38;

    // Recessed dark pad shadow
    ctx.fillStyle = 'rgba(18, 24, 60, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle periwinkle rim ring
    ctx.strokeStyle = 'rgba(180, 195, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, cy, rx * 0.92, ry * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Draws a 3D Fish Jam Fever Locked Bay Pad with a golden padlock and [+] button.
   * Player can tap directly on this bay to unlock it!
   */
  private static drawLockedBay(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    nowMs: number
  ): void {
    const rx = w * 0.44;
    const ry = w * 0.24;
    const cy = y + w * 0.28;
    const bob = Math.sin(nowMs * 0.005) * 2;

    // 1. Recessed platform dock pad
    ctx.fillStyle = 'rgba(12, 18, 50, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, cy + 4, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    const padGrad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    padGrad.addColorStop(0, '#535c98');
    padGrad.addColorStop(0.5, '#3b4375');
    padGrad.addColorStop(1, '#242a52');
    ctx.fillStyle = padGrad;
    ctx.beginPath();
    ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dashed glowing border indicating available slot bay
    ctx.strokeStyle = 'rgba(255, 235, 120, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(x, cy, rx * 0.92, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. 3D Golden Padlock & [+] Pill (bobbing gently)
    const lockY = y - w * 0.04 + bob;
    const lockW = w * 0.38;
    const lockH = lockW * 1.15;

    // Lock shackle (curved golden bar)
    const shackleR = lockW * 0.32;
    ctx.strokeStyle = '#f5c338';
    ctx.lineWidth = Math.max(2.5, lockW * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, lockY - lockH * 0.12, shackleR, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = '#fff29c';
    ctx.lineWidth = Math.max(1, lockW * 0.08);
    ctx.beginPath();
    ctx.arc(x - 1, lockY - lockH * 0.13, shackleR * 0.88, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Lock body
    const bodyW = lockW;
    const bodyH = lockH * 0.62;
    const bodyX = x - bodyW / 2;
    const bodyY = lockY - lockH * 0.05;
    const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
    bodyGrad.addColorStop(0, '#ffea6c');
    bodyGrad.addColorStop(0.45, '#f5af19');
    bodyGrad.addColorStop(1, '#d47805');
    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyW * 0.22);
    ctx.fill();

    ctx.strokeStyle = '#9e4e00';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyW * 0.22);
    ctx.stroke();

    // Specular gloss on lock body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    drawRoundedRect(ctx, bodyX + 2, bodyY + 2, bodyW - 4, bodyH * 0.3, bodyW * 0.12);
    ctx.fill();

    // Green [+] badge at the bottom of the lock
    const plusSize = lockW * 0.44;
    const plusY = bodyY + bodyH * 0.55;
    ctx.fillStyle = '#2fb33d';
    ctx.beginPath();
    ctx.arc(x, plusY, plusSize * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(plusSize * 0.9)}px 'RoyalKingdom', 'Fredoka', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', x, plusY + 0.5);

    // 3. Outlined "Mở bệ" Pill under the lock
    const pillW = w * 0.62;
    const pillH = 17;
    const pillX = x - pillW / 2;
    const pillY = y + w * 0.42;

    ctx.fillStyle = 'rgba(16, 26, 60, 0.85)';
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe45e';
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.stroke();

    ctx.font = `900 10px 'RoyalKingdom', 'Fredoka', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe855';
    ctx.fillText('MỞ BỆ', x, pillY + pillH / 2 + 0.5);
  }

  /** Front-rail slot lamps: lit = active conveyor slot, padlock = still locked (ExtraSlot booster). */
  private static drawSlotIndicators(
    ctx: CanvasRenderingContext2D,
    conveyor: LinearConveyorModel,
    g: BeltGeom,
    nowMs: number,
    isFastForward: boolean
  ): void {
    const max = conveyor.maxActiveSlots;
    const midX = (g.beltLeft + g.beltRight) / 2;
    const cy = g.deckBot + g.railH * 0.5;
    const pipW = g.w * 0.24;
    const pipH = Math.max(4, g.railH * 0.5);
    const gap = g.w * 0.36;
    const lock = ImageStore.get(GameSprites.lock);

    for (let i = 0; i < max; i++) {
      const x = midX + (i - (max - 1) / 2) * gap;
      const active = i < conveyor.activeSlots;
      drawRoundedRect(ctx, x - pipW / 2, cy - pipH / 2, pipW, pipH, pipH / 2);
      if (active) {
        ctx.fillStyle = '#3fcf4e';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        drawRoundedRect(ctx, x - pipW * 0.36, cy - pipH * 0.38, pipW * 0.72, pipH * 0.3, pipH * 0.15);
        ctx.fill();
      } else {
        ctx.fillStyle = '#8a8fcf';
        ctx.fill();
        const lh = g.railH * 1.35;
        const lw = lh * 0.78;
        if (lock) {
          ctx.drawImage(lock, x - lw / 2, cy - lh * 0.55, lw, lh);
        } else {
          // tiny procedural padlock
          ctx.strokeStyle = '#c98a10';
          ctx.lineWidth = Math.max(1, lw * 0.16);
          ctx.beginPath();
          ctx.arc(x, cy - lh * 0.12, lw * 0.28, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = '#ffbf2e';
          drawRoundedRect(ctx, x - lw * 0.42, cy - lh * 0.12, lw * 0.84, lh * 0.55, lw * 0.15);
          ctx.fill();
        }
      }
    }

    if (isFastForward) {
      // Animated chevrons on both sides of the lamps
      const t = (nowMs * 0.004) % 1;
      ctx.strokeStyle = '#ffd43b';
      ctx.lineWidth = Math.max(1.5, g.railH * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const span = (max - 1) * gap * 0.5 + pipW;
      const ch = g.railH * 0.3;
      ctx.beginPath();
      for (let s = -1; s <= 1; s += 2) {
        for (let k = 0; k < 3; k++) {
          const x = midX + s * (span + g.w * 0.12 + (k + t) * g.w * 0.16);
          ctx.moveTo(x - ch * 0.6, cy - ch);
          ctx.lineTo(x + ch * 0.4, cy);
          ctx.lineTo(x - ch * 0.6, cy + ch);
        }
      }
      ctx.stroke();
    }
  }
}

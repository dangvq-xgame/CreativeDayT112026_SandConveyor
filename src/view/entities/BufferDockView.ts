import { BufferDockModel } from '../../game/models/BufferDockModel';
import { LinearConveyorModel } from '../../game/models/LinearConveyorModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { createLayer, getRenderScale, Layer, packKey, SpriteCache } from '../SpriteCache';
import { drawOutlinedText, ratioText, roundRectPath2, Theme } from '../theme';
import { ScrewView } from './ScrewView';

/** Slot spacing as a multiple of slot size (GameScene passes `slotSize * 1.24` to getSlotX). */
const SPACING_RATIO = 1.24;
const COUNT_W = 1.5;
const PAD = 0.62;
const GAP = 0.3;
const BTN = 1.12;

interface DockGeom {
  s: number;
  spacing: number;
  barX: number;
  barW: number;
  barH: number;
  countW: number;
  firstX: number;
  btnX: number;
  btnSize: number;
}

/**
 * Single source of truth for the dock layout: [count | sockets…] [+]. The whole group is centered
 * on `centerX` and shrinks to fit narrow screens / revive slots (viewW = 2 * centerX).
 */
function dockGeom(centerX: number, total: number, slotSize: number): DockGeom {
  const units = COUNT_W + PAD * 2 + GAP + BTN + Math.max(0, total - 1) * SPACING_RATIO;
  const s = Math.max(14, Math.min(slotSize, (centerX * 2 - 16) / units));
  const spacing = s * SPACING_RATIO;
  const countW = s * COUNT_W;
  const barW = countW + s * PAD * 2 + Math.max(0, total - 1) * spacing;
  const btnSize = s * BTN;
  const groupW = barW + s * GAP + btnSize;
  const barX = centerX - groupW / 2;
  return {
    s,
    spacing,
    barX,
    barW,
    barH: s * 1.18,
    countW,
    firstX: barX + countW + s * PAD,
    btnX: barX + barW + s * GAP + btnSize / 2,
    btnSize
  };
}

interface DockLayer {
  centerX: number;
  dockY: number;
  total: number;
  slotSize: number;
  dpr: number;
  ox: number;
  oy: number;
  layer: Layer;
}

const K_BTN = 30;

function paintButton(c: CanvasRenderingContext2D, cx: number, cy: number, size: number, enabled: boolean): void {
  const r = size * 0.26;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const top = enabled ? Theme.greenTop : '#b7c3c9';
  const mid = enabled ? Theme.greenMid : '#8d9aa3';
  const bot = enabled ? Theme.greenBottom : '#5f6b74';

  c.fillStyle = 'rgba(16, 30, 70, 0.3)';
  drawRoundedRect(c, x, y + size * 0.1, size, size, r);
  c.fill();
  c.fillStyle = bot;
  drawRoundedRect(c, x, y + size * 0.06, size, size, r);
  c.fill();
  const g = c.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, top);
  g.addColorStop(1, mid);
  c.fillStyle = g;
  drawRoundedRect(c, x, y, size, size * 0.97, r);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.75)';
  c.lineWidth = 1.2;
  drawRoundedRect(c, x + 1.5, y + 1.5, size - 3, size * 0.97 - 3, r - 1.5);
  c.stroke();
  // gloss
  c.fillStyle = 'rgba(255,255,255,0.28)';
  drawRoundedRect(c, x + size * 0.12, y + size * 0.08, size * 0.76, size * 0.3, size * 0.15);
  c.fill();

  // "+" with soft shadow
  const arm = size * 0.27;
  const t = size * 0.15;
  c.lineCap = 'round';
  c.strokeStyle = enabled ? 'rgba(18, 90, 30, 0.55)' : 'rgba(40,50,60,0.45)';
  c.lineWidth = t;
  c.beginPath();
  c.moveTo(cx - arm, cy + size * 0.04);
  c.lineTo(cx + arm, cy + size * 0.04);
  c.moveTo(cx, cy - arm + size * 0.04);
  c.lineTo(cx, cy + arm + size * 0.04);
  c.stroke();
  c.strokeStyle = '#ffffff';
  c.beginPath();
  c.moveTo(cx - arm, cy);
  c.lineTo(cx + arm, cy);
  c.moveTo(cx, cy - arm);
  c.lineTo(cx, cy + arm);
  c.stroke();
}

export class BufferDockView {
  private static cache: DockLayer | null = null;

  static getSlotX(centerX: number, slotIndex: number, totalSlots: number, slotSpacing: number): number {
    const g = dockGeom(centerX, totalSlots, slotSpacing / SPACING_RATIO);
    return g.firstX + slotIndex * g.spacing;
  }

  static getExtraSlotButtonCenter(
    centerX: number,
    dockY: number,
    totalSlots: number,
    slotSize: number
  ): { x: number; y: number; radius: number } {
    const g = dockGeom(centerX, totalSlots, slotSize);
    return { x: g.btnX, y: dockY, radius: Math.max(18, g.btnSize * 0.55) };
  }

  private static ensureLayer(
    centerX: number,
    dockY: number,
    total: number,
    slotSize: number,
    dpr: number
  ): DockLayer | null {
    const cur = BufferDockView.cache;
    if (
      cur &&
      cur.centerX === centerX &&
      cur.dockY === dockY &&
      cur.total === total &&
      cur.slotSize === slotSize &&
      cur.dpr === dpr
    ) {
      return cur;
    }
    const g = dockGeom(centerX, total, slotSize);
    const ox = Math.floor(g.barX - 8);
    const oy = Math.floor(dockY - g.barH / 2 - 6);
    const layer = createLayer(g.barW + 16, g.barH + 16, dpr);
    if (!layer) return null;
    const c = layer.ctx;
    c.translate(-ox, -oy);

    const x = g.barX;
    const y = dockY - g.barH / 2;
    const R = g.barH / 2;

    // Drop shadow + bezel
    c.fillStyle = 'rgba(22, 42, 100, 0.28)';
    drawRoundedRect(c, x, y + 3, g.barW, g.barH, R);
    c.fill();
    const fg = c.createLinearGradient(0, y, 0, y + g.barH);
    fg.addColorStop(0, '#ffffff');
    fg.addColorStop(1, '#cbd8f6');
    c.fillStyle = fg;
    drawRoundedRect(c, x, y, g.barW, g.barH, R);
    c.fill();
    c.strokeStyle = Theme.frameOutline;
    c.lineWidth = 1.3;
    c.stroke();

    // Dark navy inset
    const inset = g.s * 0.13;
    const ix = x + inset;
    const iy = y + inset;
    const iw = g.barW - inset * 2;
    const ih = g.barH - inset * 2;
    const ig = c.createLinearGradient(0, iy, 0, iy + ih);
    ig.addColorStop(0, Theme.pillNavyDeep);
    ig.addColorStop(1, '#34488f');
    c.fillStyle = ig;
    drawRoundedRect(c, ix, iy, iw, ih, ih / 2);
    c.fill();
    c.save();
    drawRoundedRect(c, ix, iy, iw, ih, ih / 2);
    c.clip();
    const ts = c.createLinearGradient(0, iy, 0, iy + ih * 0.4);
    ts.addColorStop(0, 'rgba(0,0,20,0.4)');
    ts.addColorStop(1, 'rgba(0,0,20,0)');
    c.fillStyle = ts;
    c.fillRect(ix, iy, iw, ih * 0.4);
    c.restore();

    // Divider between the count and the sockets
    const dx = x + g.countW + inset * 0.2;
    c.strokeStyle = 'rgba(160, 185, 255, 0.35)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(dx, iy + ih * 0.2);
    c.lineTo(dx, iy + ih * 0.8);
    c.stroke();

    // Sockets
    const sr = g.s * 0.4;
    for (let i = 0; i < total; i++) {
      const sx = g.firstX + i * g.spacing;
      c.fillStyle = 'rgba(150, 175, 240, 0.35)';
      c.beginPath();
      c.arc(sx, dockY + 1, sr, 0, Math.PI * 2);
      c.fill();
      const sg = c.createRadialGradient(sx, dockY - sr * 0.4, sr * 0.1, sx, dockY, sr);
      sg.addColorStop(0, '#0d1436');
      sg.addColorStop(1, '#1f2b62');
      c.fillStyle = sg;
      c.beginPath();
      c.arc(sx, dockY, sr * 0.92, 0, Math.PI * 2);
      c.fill();
    }

    const next: DockLayer = { centerX, dockY, total, slotSize, dpr, ox, oy, layer };
    BufferDockView.cache = next;
    return next;
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    bufferDock: BufferDockModel,
    centerX: number,
    dockY: number,
    slotSize: number,
    conveyor?: LinearConveyorModel
  ): void {
    const total = bufferDock.getCapacity();
    const dpr = getRenderScale(ctx);
    const g = dockGeom(centerX, total, slotSize);
    const L = BufferDockView.ensureLayer(centerX, dockY, total, slotSize, dpr);
    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0;

    if (L) {
      ctx.drawImage(L.layer.canvas, L.ox, L.oy, L.layer.canvas.width / dpr, L.layer.canvas.height / dpr);
    } else {
      ctx.fillStyle = Theme.pillNavy;
      drawRoundedRect(ctx, g.barX, dockY - g.barH / 2, g.barW, g.barH, g.barH / 2);
      ctx.fill();
    }

    // Count "used/total" (warning colors as the dock fills up)
    const used = bufferDock.getUsedCount();
    const countCx = g.barX + g.countW * 0.56;
    const inset = g.s * 0.13;
    if (used >= total - 1 && used > 0) {
      const full = used >= total;
      const pulse = full ? 0.6 + 0.4 * Math.sin(nowMs * 0.012) : 1;
      ctx.save();
      ctx.globalAlpha *= pulse;
      ctx.fillStyle = full ? Theme.dangerRed : Theme.warnOrange;
      roundRectPath2(
        ctx,
        g.barX + inset,
        dockY - g.barH / 2 + inset,
        g.countW - inset * 0.6,
        g.barH - inset * 2,
        (g.barH - inset * 2) / 2,
        (g.barH - inset * 2) / 2
      );
      ctx.fill();
      ctx.restore();
    }
    drawOutlinedText(ctx, ratioText(used, total), countCx, dockY + 0.5, g.s * 0.46, '#ffffff', '#0e1638', 3);

    // Seated / incoming screws
    const screwR = g.s * 0.38;
    for (let i = 0; i < total; i++) {
      const item = bufferDock.slots[i];
      if (!item) continue;
      const sx = g.firstX + i * g.spacing;
      if (item.landed) {
        ScrewView.draw(ctx, sx, dockY, screwR, item.colorId, { view: 'face' });
      } else {
        // reserved: faint pulsing ghost while the screw is in flight
        const a = 0.25 + 0.15 * Math.sin(nowMs * 0.02);
        ScrewView.draw(ctx, sx, dockY, screwR, item.colorId, { view: 'face', alpha: a });
      }
    }

    // ExtraSlot [+] button (active/max conveyor slots are shown by the lamps on the belt rail)
    if (conveyor) {
      const isMax = conveyor.activeSlots >= conveyor.maxActiveSlots;
      const sizeQ = Math.max(8, Math.round(g.btnSize * dpr));
      const key = packKey(K_BTN, isMax ? 0 : 1, sizeQ, Math.round(dpr * 4));
      const S = (sizeQ / dpr) * 1.3;
      const btn = SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) =>
        paintButton(c, S / 2, S / 2, sizeQ / dpr, !isMax)
      );
      const bob = isMax ? 0 : Math.sin(nowMs * 0.004) * 0.6;
      if (btn) {
        const prev = ctx.globalAlpha;
        if (isMax) ctx.globalAlpha = prev * 0.75;
        ctx.drawImage(btn.canvas, g.btnX - btn.ax, dockY - btn.ay + bob, btn.w, btn.h);
        ctx.globalAlpha = prev;
      }
    }
  }
}

import { BalanceConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { QueueColumnModel } from '../../game/models/QueueColumnModel';
import { ColorId } from '../../types/level.types';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { createLayer, getRenderScale, Layer, packKey, SpriteCache } from '../SpriteCache';
import { drawOutlinedText, plusText, Theme } from '../theme';
import { SCREW_TOP_RY, SCREW_TOP_SIDE, ScrewView } from './ScrewView';

export interface QueueColumnsLayout {
  zoneX: number;
  zoneY: number;
  zoneW: number;
  zoneH: number;
  tubeWidth: number;
  screwRadius: number;
  rowStepY: number;
  visibleDepth: number;
}

/** Derived tube geometry (all views/helpers use this so flights start exactly on the screws). */
interface TubeGeom {
  tW: number;
  glassW: number;
  capW: number;
  capRy: number;
  capSide: number;
  headR: number;
  firstRowOffset: number;
  /** y of the cap's top-face center */
  capY: number;
  glassTop: number;
  glassBot: number;
  pillY: number;
  pillH: number;
}

function tubeGeom(L: QueueColumnsLayout): TubeGeom {
  const tW = L.tubeWidth;
  const glassW = tW * 0.84;
  const capW = tW * 1.0;
  const capRy = tW * 0.13;
  const capSide = tW * 0.14;
  const headR = Math.min(L.screwRadius * 0.9, glassW * 0.42);
  const pillH = Math.max(16, Math.min(22, tW * 0.3));
  const rowsOffset = capRy + capSide + headR * SCREW_TOP_RY + tW * 0.05;
  const glassBotRel =
    rowsOffset +
    Math.max(0, L.visibleDepth - 1) * L.rowStepY +
    headR * (SCREW_TOP_RY + SCREW_TOP_SIDE) +
    L.rowStepY * 0.5 +
    glassW * 0.22;
  // On tall screens the zone is taller than the tubes: sink the tube row a little so the tray
  // doesn't look empty under the "+N" pills (stays inside GameScene's tap zone).
  const slack = L.zoneH - (glassBotRel + 5 + pillH + 6);
  const sink = Math.max(0, Math.min(slack * 0.3, L.rowStepY * 0.8));
  const firstRowOffset = sink + rowsOffset;
  const glassTop = L.zoneY + sink + capRy * 0.5;
  const glassBot = L.zoneY + sink + glassBotRel;
  return {
    tW,
    glassW,
    capW,
    capRy,
    capSide,
    headR,
    firstRowOffset,
    capY: L.zoneY + sink,
    glassTop,
    glassBot,
    pillY: glassBot + 5,
    pillH
  };
}

function glassPath(c: CanvasRenderingContext2D, cx: number, top: number, bot: number, w: number): void {
  const r = w / 2;
  c.beginPath();
  c.moveTo(cx - r, top);
  c.lineTo(cx - r, bot - r);
  c.arc(cx, bot - r, r, Math.PI, 0, true);
  c.lineTo(cx + r, top);
  c.closePath();
}

interface TrayLayers {
  key: Float64Array;
  dpr: number;
  back: Layer;
  front: Layer;
  ox: number;
  oy: number;
}

const K_CAP = 40;

function paintCap(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, ry: number, side: number, colorId: ColorId): void {
  const pal = ColorManager.getColor(colorId);
  const mix = ColorManager.mixHex.bind(ColorManager);
  const rx = w / 2;

  // shadow cast on the glass under the cap
  c.fillStyle = 'rgba(10, 20, 60, 0.28)';
  c.beginPath();
  c.ellipse(cx, cy + side + ry * 0.5, rx * 0.86, ry * 0.9, 0, 0, Math.PI * 2);
  c.fill();

  // side band
  const sg = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
  sg.addColorStop(0, mix(pal.bodyHex, pal.shadowHex, 0.25));
  sg.addColorStop(0.18, mix(pal.bodyHex, '#ffffff', 0.25));
  sg.addColorStop(0.55, pal.bodyHex);
  sg.addColorStop(1, mix(pal.shadowHex, '#060b20', 0.25));
  c.fillStyle = sg;
  c.beginPath();
  c.moveTo(cx - rx, cy);
  c.lineTo(cx - rx, cy + side);
  c.ellipse(cx, cy + side, rx, ry, 0, Math.PI, 0, true);
  c.lineTo(cx + rx, cy);
  c.closePath();
  c.fill();

  // top face
  const tg = c.createLinearGradient(0, cy - ry, 0, cy + ry);
  tg.addColorStop(0, mix(pal.bodyHex, '#ffffff', 0.5));
  tg.addColorStop(1, mix(pal.bodyHex, '#ffffff', 0.15));
  c.fillStyle = tg;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = Math.max(1, w * 0.025);
  c.beginPath();
  c.ellipse(cx, cy, rx * 0.94, ry * 0.86, 0, Math.PI * 1.08, Math.PI * 1.92);
  c.stroke();
  c.strokeStyle = mix(pal.shadowHex, '#000000', 0.2);
  c.globalAlpha = 0.4;
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(cx, cy + side, rx, ry, 0, 0, Math.PI);
  c.stroke();
  c.globalAlpha = 1;
}

export class QueueColumnView {
  private static layers: TrayLayers | null = null;
  private static readonly keyScratch = new Float64Array(12);

  static getTubeCenterX(
    colIndex: number,
    totalCols: number,
    zoneCenterX: number,
    zoneW: number
  ): number {
    return zoneCenterX + (colIndex - (totalCols - 1) / 2) * ((zoneW - 20) / totalCols);
  }

  static getScrewRowY(depthIndex: number, layout: QueueColumnsLayout): number {
    const g = tubeGeom(layout);
    return layout.zoneY + g.firstRowOffset + depthIndex * layout.rowStepY;
  }

  /** Bottom of the "+N" pill under the tubes (for layout clearance checks). */
  static getContentBottomY(layout: QueueColumnsLayout): number {
    const g = tubeGeom(layout);
    return g.pillY + g.pillH;
  }

  private static ensureLayers(
    layout: QueueColumnsLayout,
    numCols: number,
    centerX: number,
    canvasH: number,
    dpr: number
  ): TrayLayers | null {
    const k = QueueColumnView.keyScratch;
    k[0] = layout.zoneX;
    k[1] = layout.zoneY;
    k[2] = layout.zoneW;
    k[3] = layout.zoneH;
    k[4] = layout.tubeWidth;
    k[5] = layout.screwRadius;
    k[6] = layout.rowStepY;
    k[7] = layout.visibleDepth;
    k[8] = numCols;
    k[9] = centerX;
    k[10] = canvasH;
    k[11] = dpr;
    const cur = QueueColumnView.layers;
    if (cur) {
      let same = true;
      for (let i = 0; i < 12; i++) {
        if (cur.key[i] !== k[i]) {
          same = false;
          break;
        }
      }
      if (same) return cur;
    }

    const g = tubeGeom(layout);
    const { zoneX, zoneY, zoneW } = layout;
    const trayTop = zoneY - g.capRy - Math.max(6, g.tW * 0.14);
    const bottom = Math.max(canvasH, g.pillY + g.pillH + 20);
    const ox = Math.floor(zoneX - 30);
    const oy = Math.floor(trayTop - 12);
    const lw = Math.ceil(zoneW + 60);
    const lh = Math.ceil(bottom - oy + 2);
    const back = createLayer(lw, lh, dpr);
    const front = createLayer(lw, lh, dpr);
    if (!back || !front) return null;

    // ---------- BACK: perspective tray + tube shadows + glass back walls ----------
    {
      const c = back.ctx;
      c.translate(-ox, -oy);
      const insetTop = zoneW * 0.035;
      const tlx = zoneX + insetTop;
      const trx = zoneX + zoneW - insetTop;
      const blx = zoneX - 16;
      const brx = zoneX + zoneW + 16;
      const R = Math.min(26, g.tW * 0.4);

      const trayPath = (): void => {
        c.beginPath();
        c.moveTo(blx, bottom);
        c.lineTo(tlx, trayTop + R);
        c.quadraticCurveTo(tlx + 1, trayTop, tlx + R, trayTop);
        c.lineTo(trx - R, trayTop);
        c.quadraticCurveTo(trx - 1, trayTop, trx, trayTop + R);
        c.lineTo(brx, bottom);
        c.closePath();
      };

      // outer shadow
      c.save();
      c.shadowColor = 'rgba(20, 40, 110, 0.35)';
      c.shadowBlur = 12 * dpr;
      c.shadowOffsetY = -2 * dpr;
      c.fillStyle = Theme.trayEdge;
      trayPath();
      c.fill();
      c.restore();

      const tg = c.createLinearGradient(0, trayTop, 0, bottom);
      tg.addColorStop(0, Theme.trayTop);
      tg.addColorStop(0.3, Theme.trayMid);
      tg.addColorStop(1, Theme.trayBottom);
      c.fillStyle = tg;
      trayPath();
      c.fill();

      // rim highlight + edge bevel
      c.save();
      trayPath();
      c.clip();
      const rim = c.createLinearGradient(0, trayTop, 0, trayTop + 16);
      rim.addColorStop(0, 'rgba(210, 225, 255, 0.75)');
      rim.addColorStop(0.3, 'rgba(210, 225, 255, 0.15)');
      rim.addColorStop(1, 'rgba(210, 225, 255, 0)');
      c.fillStyle = rim;
      c.fillRect(blx, trayTop, brx - blx, 16);
      c.strokeStyle = Theme.trayRim;
      c.lineWidth = 3;
      trayPath();
      c.stroke();
      c.restore();

      // tubes: drop shadows on the tray + glass back walls
      for (let t = 0; t < numCols; t++) {
        const tx = QueueColumnView.getTubeCenterX(t, numCols, centerX, zoneW);
        // soft contact shadow below the tube
        c.save();
        c.translate(tx + g.glassW * 0.12, g.glassBot - g.glassW * 0.05);
        c.scale(1, 0.35);
        const sg = c.createRadialGradient(0, 0, g.glassW * 0.1, 0, 0, g.glassW * 0.75);
        sg.addColorStop(0, 'rgba(16, 28, 90, 0.4)');
        sg.addColorStop(1, 'rgba(16, 28, 90, 0)');
        c.fillStyle = sg;
        c.beginPath();
        c.arc(0, 0, g.glassW * 0.75, 0, Math.PI * 2);
        c.fill();
        c.restore();
        // long side shadow (light from top-left)
        c.fillStyle = 'rgba(20, 34, 100, 0.16)';
        glassPath(c, tx + g.glassW * 0.14, g.glassTop + 4, g.glassBot + 3, g.glassW);
        c.fill();

        // glass back wall
        const gb = c.createLinearGradient(tx - g.glassW / 2, 0, tx + g.glassW / 2, 0);
        gb.addColorStop(0, 'rgba(225, 238, 255, 0.42)');
        gb.addColorStop(0.25, 'rgba(225, 238, 255, 0.14)');
        gb.addColorStop(0.7, 'rgba(200, 222, 255, 0.10)');
        gb.addColorStop(1, 'rgba(225, 238, 255, 0.38)');
        c.fillStyle = gb;
        glassPath(c, tx, g.glassTop, g.glassBot, g.glassW);
        c.fill();
        // inner bottom ellipse
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.beginPath();
        c.ellipse(tx, g.glassBot - g.glassW * 0.3, g.glassW * 0.36, g.glassW * 0.12, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // ---------- FRONT: glass highlights over the screws ----------
    {
      const c = front.ctx;
      c.translate(-ox, -oy);
      for (let t = 0; t < numCols; t++) {
        const tx = QueueColumnView.getTubeCenterX(t, numCols, centerX, zoneW);
        const gw = g.glassW;
        // outline
        c.strokeStyle = 'rgba(240, 248, 255, 0.85)';
        c.lineWidth = 1.6;
        glassPath(c, tx, g.glassTop, g.glassBot, gw);
        c.stroke();
        c.strokeStyle = 'rgba(70, 100, 190, 0.35)';
        c.lineWidth = 1;
        glassPath(c, tx, g.glassTop, g.glassBot + 1, gw + 2);
        c.stroke();
        // left vertical specular streak
        const top = g.glassTop + g.tW * 0.3;
        const bot = g.glassBot - gw * 0.42;
        const lg = c.createLinearGradient(0, top, 0, bot);
        lg.addColorStop(0, 'rgba(255,255,255,0.75)');
        lg.addColorStop(1, 'rgba(255,255,255,0.18)');
        c.fillStyle = lg;
        drawRoundedRect(c, tx - gw * 0.38, top, gw * 0.1, bot - top, gw * 0.05);
        c.fill();
        // right thin streak
        c.fillStyle = 'rgba(255,255,255,0.3)';
        drawRoundedRect(c, tx + gw * 0.3, top + 6, gw * 0.045, (bot - top) * 0.8, gw * 0.02);
        c.fill();
        // bottom curve reflection
        c.strokeStyle = 'rgba(255,255,255,0.45)';
        c.lineWidth = Math.max(1.2, gw * 0.04);
        c.lineCap = 'round';
        c.beginPath();
        c.arc(tx, g.glassBot - gw / 2, gw / 2 - gw * 0.1, Math.PI * 0.62, Math.PI * 0.9);
        c.stroke();
      }
    }

    const next: TrayLayers = { key: Float64Array.from(k), dpr, back, front, ox, oy };
    QueueColumnView.layers = next;
    return next;
  }

  static drawAll(
    ctx: CanvasRenderingContext2D,
    columns: QueueColumnModel[],
    layout: QueueColumnsLayout,
    centerX: number,
    nowMs: number,
    hideScrewsForShuffle = false
  ): void {
    const { zoneW, rowStepY, visibleDepth } = layout;
    const slideMs = BalanceConfig.queueColumns.slideUpDurationMs;
    const dpr = getRenderScale(ctx);
    const canvasH = ctx.canvas.height / dpr;
    const g = tubeGeom(layout);
    const L = QueueColumnView.ensureLayers(layout, columns.length, centerX, canvasH, dpr);

    if (L) {
      ctx.drawImage(L.back.canvas, L.ox, L.oy, L.back.canvas.width / dpr, L.back.canvas.height / dpr);
    }

    const springW = g.headR * 1.05;
    const capQ = Math.max(8, Math.round(g.capW * dpr));

    for (let t = 0; t < columns.length; t++) {
      const col = columns[t];
      const tx = QueueColumnView.getTubeCenterX(t, columns.length, centerX, zoneW);

      const popElapsed = nowMs - col.lastPopTimeMs;
      const sliding = popElapsed >= 0 && popElapsed < slideMs;
      const slideQ = sliding ? popElapsed / slideMs : 1;
      // ease-out slide so the stack "springs" up
      const slideRest = 1 - slideQ;
      const slideOffset = sliding ? slideRest * slideRest * rowStepY : 0;

      const bonkElapsed = nowMs - col.lastBonkTimeMs;
      const bonking = bonkElapsed >= 0 && bonkElapsed < 260;
      const shakeX = bonking ? Math.sin((bonkElapsed / 260) * Math.PI * 5) * 4 * (1 - bonkElapsed / 260) : 0;

      // Screws + springs (bottom-up so upper heads overlap the springs below)
      if (!hideScrewsForShuffle && !col.isEmpty()) {
        const items = col.getVisibleItems(visibleDepth);
        const clip = sliding;
        if (clip) {
          ctx.save();
          glassPath(ctx, tx, g.glassTop, g.glassBot, g.glassW);
          ctx.clip();
        }
        const bottomInner = g.glassBot - g.glassW * 0.14;
        for (let k = items.length - 1; k >= 0; k--) {
          const item = items[k];
          const sy = QueueColumnView.getScrewRowY(k, layout) + slideOffset;
          const sx = tx + (k === 0 ? shakeX : 0);
          const springTop = sy + g.headR * 0.3;
          const springBot =
            k + 1 < items.length
              ? QueueColumnView.getScrewRowY(k + 1, layout) + slideOffset - g.headR * 0.45
              : bottomInner;
          ScrewView.drawSpring(ctx, tx, springTop, springBot, springW);
          ScrewView.draw(ctx, sx, sy, g.headR, item.colorId, {
            view: 'top',
            isMystery: Boolean(item.isMystery && k > 0)
          });
        }
        if (clip) ctx.restore();
      } else if (col.isEmpty()) {
        // relaxed spring in an empty tube
        ScrewView.drawSpring(
          ctx,
          tx,
          g.glassTop + g.capSide + g.capRy,
          g.glassBot - g.glassW * 0.14,
          springW
        );
      }

      // Bonk red flash on the glass
      if (bonking) {
        ctx.save();
        ctx.globalAlpha *= 0.35 * (1 - bonkElapsed / 260);
        ctx.fillStyle = Theme.dangerRed;
        glassPath(ctx, tx, g.glassTop, g.glassBot, g.glassW);
        ctx.fill();
        ctx.restore();
      }
    }

    if (L) {
      ctx.drawImage(L.front.canvas, L.ox, L.oy, L.front.canvas.width / dpr, L.front.canvas.height / dpr);
    }

    // Caps (hop on tap) + "+N" pills + empty check
    for (let t = 0; t < columns.length; t++) {
      const col = columns[t];
      const tx = QueueColumnView.getTubeCenterX(t, columns.length, centerX, zoneW);
      const popElapsed = nowMs - col.lastPopTimeMs;
      const hopQ = popElapsed >= 0 && popElapsed < 240 ? popElapsed / 240 : 1;
      const hop = hopQ < 1 ? -Math.sin(hopQ * Math.PI) * g.tW * 0.09 : 0;

      const rimColor = col.rimColorId || 1;
      const key = packKey(K_CAP, rimColor, capQ, Math.round(dpr * 4));
      const capWc = capQ / dpr;
      const ry = g.capRy;
      const side = g.capSide;
      const W = capWc * 1.1;
      const H = (ry * 2 + side) * 1.6;
      const ay = ry * 1.3;
      const cap = SpriteCache.get(key, W, H, dpr, W / 2, ay, (c) =>
        paintCap(c, W / 2, ay, capWc, ry, side, rimColor)
      );
      const capY = g.capY + hop;
      if (cap) {
        const k = g.capW / capWc;
        ctx.drawImage(cap.canvas, tx - cap.ax * k, capY - cap.ay * k, cap.w * k, cap.h * k);
      }
      if (hopQ < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - hopQ;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tx, capY, g.capW * (0.5 + hopQ * 0.3), ry * (1 + hopQ * 0.8), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const hidden = col.getHiddenCount(visibleDepth);
      if (hidden > 0) {
        const pw = Math.max(34, g.tW * 0.74);
        const ph = g.pillH;
        const px = tx - pw / 2;
        ctx.fillStyle = 'rgba(22, 32, 82, 0.72)';
        drawRoundedRect(ctx, px, g.pillY, pw, ph, ph / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 190, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        drawOutlinedText(ctx, plusText(hidden), tx, g.pillY + ph / 2 + 0.5, ph * 0.72, '#ffffff', '#0d1533', 2.5);
      } else if (col.isEmpty()) {
        const r = Math.max(8, g.tW * 0.16);
        const cy = (g.glassTop + g.glassBot) / 2;
        ctx.fillStyle = Theme.greenMid;
        ctx.beginPath();
        ctx.arc(tx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, r * 0.28);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(tx - r * 0.45, cy + r * 0.02);
        ctx.lineTo(tx - r * 0.1, cy + r * 0.38);
        ctx.lineTo(tx + r * 0.5, cy - r * 0.35);
        ctx.stroke();
      }
    }
  }
}

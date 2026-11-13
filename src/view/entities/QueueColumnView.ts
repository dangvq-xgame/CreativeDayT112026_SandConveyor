import { BalanceConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { QueueColumnModel } from '../../game/models/QueueColumnModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { ScrewView } from './ScrewView';

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

export class QueueColumnView {
  static getTubeCenterX(
    colIndex: number,
    totalCols: number,
    zoneCenterX: number,
    zoneW: number
  ): number {
    return zoneCenterX + (colIndex - (totalCols - 1) / 2) * ((zoneW - 12) / totalCols);
  }

  static getScrewRowY(depthIndex: number, layout: QueueColumnsLayout): number {
    return (
      layout.zoneY +
      layout.tubeWidth * 0.42 +
      depthIndex * layout.rowStepY +
      layout.screwRadius
    );
  }

  static drawAll(
    ctx: CanvasRenderingContext2D,
    columns: QueueColumnModel[],
    layout: QueueColumnsLayout,
    centerX: number,
    nowMs: number,
    hideScrewsForShuffle = false
  ): void {
    const { zoneX, zoneY, zoneW, zoneH, tubeWidth, screwRadius, rowStepY, visibleDepth } = layout;
    const slideMs = BalanceConfig.queueColumns.slideUpDurationMs;

    // Bottom shelf bar
    ctx.fillStyle = '#97b7e6';
    drawRoundedRect(ctx, zoneX, zoneY + zoneH - 14, zoneW, 14, 7);
    ctx.fill();

    const tubeBodyH = visibleDepth * rowStepY + tubeWidth * 0.44 + 8;

    for (let t = 0; t < columns.length; t++) {
      const col = columns[t];
      const tx = QueueColumnView.getTubeCenterX(t, columns.length, centerX, zoneW);
      const rimPal = ColorManager.getColor(col.rimColorId);

      // Slide-up offset when top screw was just popped
      const popElapsed = nowMs - col.lastPopTimeMs;
      const slideOffset =
        popElapsed >= 0 && popElapsed < slideMs
          ? (1 - popElapsed / slideMs) * rowStepY
          : 0;

      // Bonk horizontal shake when buffer is full
      const bonkElapsed = nowMs - col.lastBonkTimeMs;
      const shakeX =
        bonkElapsed >= 0 && bonkElapsed < 260
          ? Math.sin((bonkElapsed / 260) * Math.PI * 5) * 3.5
          : 0;

      // Glass tube shadow
      ctx.fillStyle = 'rgba(35, 58, 108, 0.16)';
      drawRoundedRect(ctx, tx - tubeWidth / 2 + 4, zoneY + 6, tubeWidth, tubeBodyH, tubeWidth * 0.45);
      ctx.fill();

      // Translucent glass tube body
      drawRoundedRect(ctx, tx - tubeWidth / 2, zoneY, tubeWidth, tubeBodyH, tubeWidth * 0.45);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Colored tube top rim (tinted by rimColorId from palette.json)
      drawRoundedRect(ctx, tx - tubeWidth / 2 - 5, zoneY - 5, tubeWidth + 10, 12, 6);
      ctx.fillStyle = rimPal.bodyHex;
      ctx.fill();
      ctx.strokeStyle = rimPal.shadowHex;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Visible screws inside the tube (top 3 items)
      if (!hideScrewsForShuffle) {
        const visibleItems = col.getVisibleItems(visibleDepth);
        for (let k = 0; k < visibleItems.length; k++) {
          const item = visibleItems[k];
          const sy = QueueColumnView.getScrewRowY(k, layout) + slideOffset;
          const sx = tx + (k === 0 ? shakeX : 0);
          ScrewView.draw(ctx, sx, sy, screwRadius, item.colorId, {
            isMystery: Boolean(item.isMystery && k > 0)
          });
        }
      }

      // Left vertical glass specular highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx - tubeWidth * 0.31, zoneY + tubeWidth * 0.4);
      ctx.lineTo(tx - tubeWidth * 0.31, zoneY + tubeBodyH - tubeWidth * 0.4);
      ctx.stroke();

      // Bottom '+N' hidden queue count badge (Color Blast style)
      const hiddenCount = col.getHiddenCount(visibleDepth);
      if (hiddenCount > 0) {
        drawRoundedRect(
          ctx,
          tx - tubeWidth * 0.38,
          zoneY + tubeBodyH - 4,
          tubeWidth * 0.76,
          20,
          10
        );
        ctx.fillStyle = '#3b4e76';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 12px Fredoka, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${hiddenCount}`, tx, zoneY + tubeBodyH + 6);
      } else if (col.isEmpty()) {
        ctx.fillStyle = 'rgba(65, 82, 118, 0.45)';
        ctx.font = `600 11px Fredoka, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TRỐNG', tx, zoneY + tubeBodyH / 2);
      }
    }
  }
}


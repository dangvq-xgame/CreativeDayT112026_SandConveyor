import { LinearConveyorModel } from '../../game/models/LinearConveyorModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
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

export class LinearConveyorView {
  static draw(
    ctx: CanvasRenderingContext2D,
    conveyor: LinearConveyorModel,
    layout: ConveyorLayout,
    nowMs: number,
    isFastForward: boolean,
    highlightLockedBuckets: boolean
  ): void {
    const {
      beltLeftX,
      beltRightX,
      tunnelWidth,
      visibleMinX,
      visibleMaxX,
      trackStartX,
      trackEndX,
      bucketCenterY,
      bucketWidth
    } = layout;

    const beltY = bucketCenterY + bucketWidth * 0.47;
    const beltH = bucketWidth * 0.25;
    const r = beltH / 2;
    const travelPx = conveyor.getBeltTravelDistancePx();

    // 1. Belt track drop shadow & metallic casing
    ctx.fillStyle = 'rgba(30, 50, 95, 0.22)';
    drawRoundedRect(ctx, beltLeftX, beltY + 4, beltRightX - beltLeftX, beltH, r);
    ctx.fill();

    drawRoundedRect(ctx, beltLeftX, beltY, beltRightX - beltLeftX, beltH, r);
    ctx.fillStyle = '#425070';
    ctx.fill();

    drawRoundedRect(ctx, beltLeftX + 3, beltY + 2, beltRightX - beltLeftX - 6, beltH - 4, r - 2);
    ctx.fillStyle = '#5a6b92';
    ctx.fill();

    // Moving diagonal belt treads
    ctx.save();
    drawRoundedRect(ctx, beltLeftX + 3, beltY + 2, beltRightX - beltLeftX - 6, beltH - 4, r - 2);
    ctx.clip();
    ctx.strokeStyle = isFastForward ? 'rgba(255, 230, 100, 0.35)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2.2;
    const gap = 14;
    for (let x = beltLeftX - gap + (travelPx % gap); x < beltRightX + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, beltY + 2);
      ctx.lineTo(x + 4, beltY + beltH - 2);
      ctx.stroke();
    }
    ctx.restore();

    // Rotating conveyor rollers at both ends
    for (const cx of [beltLeftX + r, beltRightX - r]) {
      ctx.fillStyle = '#d3dbea';
      ctx.beginPath();
      ctx.arc(cx, beltY + r, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, beltY + r);
      ctx.rotate(travelPx / Math.max(1, r * 0.62));
      ctx.strokeStyle = '#7e8ca8';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.52, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Directional arrows & active slot badge on belt
    ctx.fillStyle = '#ffd43b';
    ctx.font = `700 13px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const midX = (beltLeftX + beltRightX) / 2;
    ctx.fillText('»', midX - 95, beltY + r + 4);
    ctx.fillText('»', midX + 95, beltY + r + 4);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = `700 11px Fredoka, system-ui, sans-serif`;
    ctx.fillText(
      `LINEAR BELT • SLOTS ${conveyor.activeSlots}/${conveyor.maxActiveSlots}${isFastForward ? ' ⚡1.85x' : ''}`,
      midX,
      beltY + r + 4
    );

    // 2. Active Sand Buckets clipped between left & right tunnels
    ctx.save();
    ctx.beginPath();
    ctx.rect(visibleMinX, 0, visibleMaxX - visibleMinX, beltY + beltH + 20);
    ctx.clip();

    for (let i = 0; i < conveyor.activeSlots; i++) {
      const bucket = conveyor.slots[i];
      if (!bucket) continue;
      const bx = bucket.visualX || conveyor.getSlotX(i, trackStartX, trackEndX);
      SandBucketView.draw(
        ctx,
        bx,
        bucketCenterY,
        bucketWidth,
        bucket,
        nowMs,
        highlightLockedBuckets
      );
    }

    for (const leaving of conveyor.leavingBuckets) {
      SandBucketView.draw(ctx, leaving.visualX, bucketCenterY, bucketWidth, leaving, nowMs, false);
    }
    ctx.restore();

    // 3. Left & Right Tunnels (startTunnel & endTunnel)
    const archW = tunnelWidth;
    const archH = bucketWidth * 1.14;
    const topY = beltY + beltH - archH;

    for (const [ax, side] of [
      [beltLeftX, 1],
      [beltRightX - archW, -1]
    ] as const) {
      ctx.fillStyle = 'rgba(30, 50, 95, 0.2)';
      drawRoundedRect(ctx, ax + 3, topY + 4, archW, archH, archW * 0.46);
      ctx.fill();

      const grad = ctx.createLinearGradient(ax, 0, ax + archW, 0);
      grad.addColorStop(0, '#e5ecff');
      grad.addColorStop(1, '#b8c3eb');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, ax, topY, archW, archH, archW * 0.46);
      ctx.fill();

      // Dark tunnel portal mouth
      ctx.fillStyle = '#333d66';
      const mouthX = side > 0 ? ax + archW * 0.54 : ax;
      drawRoundedRect(ctx, mouthX, topY + archW * 0.28, archW * 0.46, archH - archW * 0.28, archW * 0.2);
      ctx.fill();

      // Highlight strip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      drawRoundedRect(ctx, ax + archW * 0.08, topY + archW * 0.2, archW * 0.09, archH * 0.58, archW * 0.04);
      ctx.fill();
    }
  }
}


import { GameConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { SandBucketModel } from '../../game/models/SandBucketModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { ScrewView } from './ScrewView';

export class SandBucketView {
  static readonly HOLE_DY_RATIO = 0.03;

  static getHolePosition(
    bucketX: number,
    bucketY: number,
    bucketW: number,
    holeIndex: number
  ): [number, number] {
    const hx = bucketX + (holeIndex - 1) * bucketW * 0.25;
    const hy = bucketY + bucketW * SandBucketView.HOLE_DY_RATIO;
    return [hx, hy];
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
    const h = w * 0.96;
    const pal = ColorManager.getColor(bucket.colorId);

    const openElapsed = bucket.openStartedAtMs !== null ? nowMs - bucket.openStartedAtMs : -1;
    const twistMs = GameConfig.lidTwistDurationMs;
    const flipMs = GameConfig.lidFlipDurationMs;

    let lidAngle = 0;
    let lidLift = 0;
    let shakeX = 0;

    if (openElapsed >= 0) {
      if (openElapsed < twistMs) {
        shakeX = Math.sin((openElapsed / twistMs) * Math.PI * 6) * w * 0.02;
      }
      if (openElapsed >= twistMs) {
        const q = Math.min(1, (openElapsed - twistMs) / flipMs);
        const easeBack = 1 + 2.7 * Math.pow(q - 1, 3) + 1.7 * Math.pow(q - 1, 2);
        lidAngle = -1.95 * easeBack;
        lidLift = Math.sin(q * Math.PI) * h * 0.08;
      }
    }

    const bx = x + shakeX;

    // Hand Booster glowing pulse ring
    if (highlightForHandBooster && !bucket.isOpen) {
      const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.008);
      ctx.save();
      drawRoundedRect(ctx, bx - w * 0.5, y - h * 0.56, w, h * 1.12, w * 0.2);
      ctx.strokeStyle = `rgba(255, 215, 50, ${0.65 + pulse * 0.35})`;
      ctx.lineWidth = 4 + pulse * 2;
      ctx.stroke();
      ctx.restore();
    }

    // Contact shadow on belt
    ctx.fillStyle = 'rgba(15, 25, 50, 0.2)';
    ctx.beginPath();
    ctx.ellipse(bx, y + h * 0.5, w * 0.43, w * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bucket lower shadow rim
    drawRoundedRect(ctx, bx - w * 0.44, y - h * 0.3, w * 0.88, h * 0.8, w * 0.16);
    ctx.fillStyle = pal.shadowHex;
    ctx.fill();

    // Bucket main body gradient
    const bodyGrad = ctx.createLinearGradient(0, y - h * 0.34, 0, y + h * 0.48);
    bodyGrad.addColorStop(0, ColorManager.mixHex(pal.bodyHex, '#ffffff', 0.32));
    bodyGrad.addColorStop(0.6, pal.bodyHex);
    bodyGrad.addColorStop(1, ColorManager.mixHex(pal.bodyHex, pal.shadowHex, 0.45));
    drawRoundedRect(ctx, bx - w * 0.44, y - h * 0.34, w * 0.88, h * 0.78, w * 0.16);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Left vertical specular gloss strip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    drawRoundedRect(ctx, bx - w * 0.37, y - h * 0.29, w * 0.08, h * 0.52, w * 0.04);
    ctx.fill();

    // Open mouth & rising colored sand heap once lid flips open
    const fillRatio = bucket.capacity > 0 ? Math.min(1, bucket.collected / bucket.capacity) : 0;
    if (openElapsed >= twistMs) {
      ctx.fillStyle = pal.handleHex;
      ctx.beginPath();
      ctx.ellipse(bx, y - h * 0.34, w * 0.38, w * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();

      if (fillRatio > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(bx, y - h * 0.34, w * 0.38, w * 0.085, 0, 0, Math.PI * 2);
        ctx.rect(bx - w * 0.38, y - h * 0.34 - w * 0.22, w * 0.76, w * 0.22);
        ctx.clip();

        const moundHeight = w * 0.035 + fillRatio * w * 0.14;
        ctx.fillStyle = pal.sandHex;
        ctx.beginPath();
        ctx.ellipse(bx, y - h * 0.34 + w * 0.02, w * 0.35, moundHeight, 0, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = ColorManager.mixHex(pal.sandHex, '#ffffff', 0.45);
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9 + 0.3;
          ctx.fillRect(
            bx + Math.cos(a) * w * 0.22 - 1,
            y - h * 0.34 - Math.abs(Math.sin(a)) * moundHeight * 0.6,
            2,
            2
          );
        }
        ctx.restore();
      }
    }

    // 3-Screw-Hole Lock Strip across the bucket waist
    const stripY = y + w * SandBucketView.HOLE_DY_RATIO;
    drawRoundedRect(ctx, bx - w * 0.41, stripY - h * 0.145, w * 0.82, h * 0.29, h * 0.14);
    ctx.fillStyle = '#e3f3ff';
    ctx.fill();
    ctx.strokeStyle = pal.shadowHex;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let k = 0; k < 3; k++) {
      const [hx, hy] = SandBucketView.getHolePosition(bx, y, w, k);
      // Empty socket rim & depth
      ctx.fillStyle = '#253f6e';
      ctx.beginPath();
      ctx.arc(hx, hy, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4772b8';
      ctx.beginPath();
      ctx.arc(hx, hy + 1, w * 0.064, 0, Math.PI * 2);
      ctx.fill();

      const hole = bucket.holes[k];
      if (hole && hole.landed) {
        const landElapsed = hole.landedAtMs !== null ? Math.min(1, (nowMs - hole.landedAtMs) / 240) : 1;
        let rot = -(1 - landElapsed) * 6.5;
        const popScale = 1 + Math.sin(landElapsed * Math.PI) * 0.2;
        if (openElapsed >= 0) {
          rot += Math.min(1, openElapsed / twistMs) * Math.PI * 2.5;
        }
        ScrewView.draw(ctx, hx, hy, w * 0.092, bucket.colorId, {
          rotation: rot,
          scale: popScale
        });
      }
    }

    // Percentage label pill ('0%' -> '100%')
    const pillY = y + h * 0.32;
    drawRoundedRect(ctx, bx - w * 0.28, pillY - h * 0.095, w * 0.56, h * 0.19, h * 0.095);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.fillStyle = '#1e2c54';
    ctx.font = `700 ${Math.round(w * 0.175)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${bucket.getPercentage()}%`, bx, pillY + 1);

    // Hinged Lid on top of the bucket (stays closed until all 3 screw holes are filled!)
    ctx.save();
    const hingeX = bx - w * 0.46;
    const hingeY = y - h * 0.38;
    ctx.translate(hingeX, hingeY - lidLift);
    ctx.rotate(lidAngle);
    ctx.translate(-hingeX, -hingeY);

    drawRoundedRect(ctx, bx - w * 0.47, y - h * 0.47, w * 0.94, h * 0.18, w * 0.08);
    ctx.fillStyle = pal.shadowHex;
    ctx.fill();

    drawRoundedRect(ctx, bx - w * 0.47, y - h * 0.5, w * 0.94, h * 0.17, w * 0.08);
    ctx.fillStyle = pal.bodyHex;
    ctx.fill();

    // Lid top handle / gloss bar
    ctx.fillStyle = ColorManager.mixHex(pal.bodyHex, '#ffffff', 0.42);
    drawRoundedRect(ctx, bx - w * 0.39, y - h * 0.49, w * 0.78, h * 0.045, w * 0.02);
    ctx.fill();
    ctx.restore();

    if (highlightForHandBooster && !bucket.isOpen) {
      ctx.fillStyle = '#ffe552';
      ctx.font = `700 ${Math.round(w * 0.14)}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('👆 MỞ NGAY', bx, y - h * 0.62);
    }
  }
}


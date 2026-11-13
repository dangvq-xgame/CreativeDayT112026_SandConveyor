import { ColorManager } from '../../core/ColorManager';
import { SandBoardModel } from '../../game/models/SandBoardModel';
import { drawRoundedRect } from '../../utils/canvas.utils';

export class SandBoardView {
  static draw(
    ctx: CanvasRenderingContext2D,
    board: SandBoardModel,
    frameX: number,
    frameY: number,
    cellSize: number
  ): void {
    const fw = board.width * cellSize;
    const fh = board.height * cellSize;

    // Outer 3D Frame shadow & border
    ctx.fillStyle = 'rgba(34, 58, 108, 0.22)';
    drawRoundedRect(ctx, frameX - 14, frameY - 8, fw + 28, fh + 28, 18);
    ctx.fill();

    ctx.fillStyle = '#6f8fd1';
    drawRoundedRect(ctx, frameX - 12, frameY - 12, fw + 24, fh + 24, 16);
    ctx.fill();

    // Inner bright frame backing
    ctx.fillStyle = '#eaf2ff';
    drawRoundedRect(ctx, frameX - 6, frameY - 6, fw + 12, fh + 12, 10);
    ctx.fill();

    // Subtle empty grid background
    ctx.fillStyle = '#dce7fa';
    ctx.fillRect(frameX, frameY, fw, fh);

    // Clip inside the sand picture box so falling cells stay cleanly inside
    ctx.save();
    ctx.beginPath();
    ctx.rect(frameX, frameY, fw, fh);
    ctx.clip();

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.cells[y][x];
        if (!cell) continue;

        const pal = ColorManager.getColor(cell.colorId);
        const cx = frameX + x * cellSize;
        const cy = frameY + y * cellSize + cell.offsetY;
        const seed = x * 131 + y * 17 + cell.colorId * 31;

        // Base sand cell fill
        ctx.fillStyle = pal.sandHex;
        ctx.fillRect(cx, cy, cellSize + 0.6, cellSize + 0.6);

        // Textured sand grains (sub-division visual feel)
        ctx.fillStyle = pal.shadowHex;
        const dotSize = Math.max(1.2, cellSize * 0.16);
        for (let i = 0; i < 3; i++) {
          const rx = ((seed * 9301 + i * 49297) % 233280) / 233280;
          const ry = ((seed * 7919 + i * 1237) % 233280) / 233280;
          ctx.fillRect(cx + rx * cellSize * 0.78, cy + ry * cellSize * 0.78, dotSize, dotSize);
        }

        ctx.fillStyle = ColorManager.mixHex(pal.sandHex, '#ffffff', 0.32);
        const hx = ((seed * 4111) % 997) / 997;
        ctx.fillRect(
          cx + hx * cellSize * 0.68,
          cy + (1 - hx) * cellSize * 0.62,
          dotSize,
          dotSize
        );
      }
    }

    // Subtle glass reflection sheen on left side of frame
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(frameX, frameY, fw * 0.06, fh);
    ctx.restore();
  }
}


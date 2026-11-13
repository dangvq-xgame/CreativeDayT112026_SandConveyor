import { BufferDockModel } from '../../game/models/BufferDockModel';
import { drawRoundedRect } from '../../utils/canvas.utils';
import { ScrewView } from './ScrewView';

export class BufferDockView {
  static getSlotX(centerX: number, slotIndex: number, totalSlots: number, slotSpacing: number): number {
    return centerX + (slotIndex - (totalSlots - 1) / 2) * slotSpacing;
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    bufferDock: BufferDockModel,
    centerX: number,
    dockY: number,
    slotSize: number
  ): void {
    const total = bufferDock.getCapacity();
    const spacing = slotSize * 1.28;
    const firstX = BufferDockView.getSlotX(centerX, 0, total, spacing);
    const lastX = BufferDockView.getSlotX(centerX, total - 1, total, spacing);
    const barW = lastX - firstX + slotSize * 1.55;
    const barH = slotSize * 1.12;
    const barX = firstX - slotSize * 0.775;
    const barY = dockY - barH / 2;

    // Dock bar shadow & white pill body
    ctx.fillStyle = 'rgba(35, 55, 100, 0.16)';
    drawRoundedRect(ctx, barX, barY + 3, barW, barH, barH / 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    ctx.strokeStyle = '#d5e2f7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw each waiting hole & seated screw
    for (let i = 0; i < total; i++) {
      const sx = BufferDockView.getSlotX(centerX, i, total, spacing);
      ctx.fillStyle = '#c5d1e8';
      ctx.beginPath();
      ctx.arc(sx, dockY, slotSize * 0.33, 0, Math.PI * 2);
      ctx.fill();

      const item = bufferDock.slots[i];
      if (item && item.landed) {
        ScrewView.draw(ctx, sx, dockY, slotSize * 0.36, item.colorId);
      }
    }

    // Used / Capacity badge on the right side of the dock bar
    const used = bufferDock.getUsedCount();
    const badgeX = barX + barW + 24;
    drawRoundedRect(ctx, badgeX - 20, dockY - 11, 40, 22, 11);
    ctx.fillStyle = used >= total ? '#f0524f' : '#4a5c82';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 11px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${used}/${total}`, badgeX, dockY + 1);
  }
}


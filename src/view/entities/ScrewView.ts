import { ColorManager } from '../../core/ColorManager';
import { ColorId } from '../../types/level.types';

export interface ScrewDrawOptions {
  rotation?: number;
  alpha?: number;
  isMystery?: boolean;
  scale?: number;
}

export class ScrewView {
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

    ctx.save();
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, opts.alpha));

    // Drop shadow
    ctx.fillStyle = 'rgba(18, 30, 62, 0.24)';
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.22, r * 1.06, 0, Math.PI * 2);
    ctx.fill();

    if (opts.isMystery) {
      // Mystery '?' screw cap
      ctx.fillStyle = '#6c7896';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.04, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.28, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#b5c0da');
      grad.addColorStop(1, '#7a86a4');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(r * 1.05)}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
      ctx.restore();
      return;
    }

    const pal = ColorManager.getColor(colorId);

    // Outer metallic/glass rim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Colored screw body gradient (tinted dynamically from palette.json via colorId)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.95);
    grad.addColorStop(0, ColorManager.mixHex(pal.bodyHex, '#ffffff', 0.36));
    grad.addColorStop(0.7, pal.bodyHex);
    grad.addColorStop(1, pal.shadowHex);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Inner sand speckles
    ctx.fillStyle = pal.shadowHex;
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + 0.4;
      const d = r * (0.55 + (k % 2) * 0.16);
      ctx.fillRect(Math.cos(a) * d - 1, Math.sin(a) * d - 1, 2.2, 2.2);
    }

    // Center screw cap & Phillips '+' cross slot
    ctx.fillStyle = ColorManager.mixHex(pal.handleHex, '#ffffff', 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = 'round';
    const crossLen = r * 0.26;
    ctx.beginPath();
    ctx.moveTo(-crossLen, 0);
    ctx.lineTo(crossLen, 0);
    ctx.moveTo(0, -crossLen);
    ctx.lineTo(0, crossLen);
    ctx.stroke();

    // Specular highlight dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.34, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}


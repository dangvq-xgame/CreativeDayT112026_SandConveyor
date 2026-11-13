import { ColorManager } from '../../core/ColorManager';

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  w: number;
  h: number;
  hex: string;
}

export class ConfettiFX {
  private pieces: ConfettiPiece[] = [];

  burst(width: number, height: number): void {
    this.pieces = [];
    for (let i = 0; i < 65; i++) {
      const cid = (i % 12) + 1;
      const pal = ColorManager.getColor(cid);
      this.pieces.push({
        x: width * (0.2 + Math.random() * 0.6),
        y: height * 0.35,
        vx: (Math.random() - 0.5) * 360,
        vy: -180 - Math.random() * 280,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        w: 7 + Math.random() * 5,
        h: 4 + Math.random() * 4,
        hex: pal.bodyHex
      });
    }
  }

  update(dtSec: number): void {
    for (const p of this.pieces) {
      p.vy += 460 * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rot += p.vRot * dtSec;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.hex;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }

  clear(): void {
    this.pieces.length = 0;
  }
}


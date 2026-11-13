import { BalanceConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';
import { ScrewView } from '../entities/ScrewView';
import { getRenderScale, packKey, SpriteCache } from '../SpriteCache';

interface SpiralScrewNode {
  colorId: ColorId;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angleOffset: number;
}

const K_VORTEX = 60;

function paintVortex(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  g.addColorStop(0.25, 'rgba(190, 225, 255, 0.55)');
  g.addColorStop(0.6, 'rgba(140, 170, 255, 0.22)');
  g.addColorStop(1, 'rgba(120, 150, 255, 0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  // swirl arms
  c.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = r * 0.07;
    c.beginPath();
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      const ang = a0 + t * Math.PI * 1.3;
      const rr = r * (0.15 + t * 0.7);
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      if (s === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
}

export class ShuffleSpiralFX {
  private nodes: SpiralScrewNode[] = [];
  private startedAtMs = -1;
  private centerX = 0;
  private centerY = 0;
  private radius = 16;

  isActive(nowMs: number): boolean {
    if (this.startedAtMs < 0) return false;
    return nowMs - this.startedAtMs < BalanceConfig.boosters.shuffle.animDurationMs;
  }

  start(
    nodes: Array<{ colorId: ColorId; x: number; y: number }>,
    centerX: number,
    centerY: number,
    screwRadius: number,
    nowMs: number
  ): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = screwRadius;
    this.startedAtMs = nowMs;
    this.nodes = nodes.map((n, idx) => ({
      colorId: n.colorId,
      startX: n.x,
      startY: n.y,
      endX: n.x,
      endY: n.y,
      angleOffset: (idx / Math.max(1, nodes.length)) * Math.PI * 2
    }));
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number): void {
    if (!this.isActive(nowMs)) return;
    const duration = BalanceConfig.boosters.shuffle.animDurationMs;
    const progress = Math.min(1, Math.max(0, (nowMs - this.startedAtMs) / duration));
    const intensity = Math.sin(progress * Math.PI); // 0 → 1 → 0

    // Vortex glow (cached sprite, rotated)
    const dpr = getRenderScale(ctx);
    const vr = Math.max(40, this.radius * 3.6);
    const vq = Math.round(vr * dpr);
    const S = (vq / dpr) * 2;
    const vortex = SpriteCache.get(packKey(K_VORTEX, 0, vq, Math.round(dpr * 4)), S, S, dpr, S / 2, S / 2, (c) =>
      paintVortex(c, S / 2, S / 2, S / 2)
    );
    if (vortex) {
      ctx.save();
      ctx.globalAlpha *= intensity;
      ctx.translate(this.centerX, this.centerY);
      ctx.rotate(progress * Math.PI * 4);
      const k = 0.7 + intensity * 0.5;
      ctx.drawImage(vortex.canvas, -vortex.ax * k, -vortex.ay * k, vortex.w * k, vortex.h * k);
      ctx.restore();
    }

    const maxOrbitR = 78;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      let x: number;
      let y: number;
      if (progress < 0.5) {
        // Phase 1: swirl inward toward the vortex center
        const p = progress * 2;
        const e = p * p * (3 - 2 * p);
        const theta = node.angleOffset + p * Math.PI * 3;
        const orbitR = (1 - e) * maxOrbitR;
        const vx = this.centerX + Math.cos(theta) * orbitR;
        const vy = this.centerY + Math.sin(theta) * orbitR * 0.75;
        x = node.startX + (vx - node.startX) * e;
        y = node.startY + (vy - node.startY) * e;
      } else {
        // Phase 2: deal outward from the vortex back into the columns
        const p = (progress - 0.5) * 2;
        const e = p * p * (3 - 2 * p);
        const theta = node.angleOffset + (1 - p) * Math.PI * 3;
        const orbitR = (1 - e) * maxOrbitR * 0.6;
        const vx = this.centerX + Math.cos(theta) * orbitR;
        const vy = this.centerY + Math.sin(theta) * orbitR * 0.75;
        x = vx + (node.endX - vx) * e;
        y = vy + (node.endY - vy) * e;
      }

      ScrewView.draw(ctx, x, y, this.radius * 0.9, node.colorId, {
        view: 'top',
        rotation: progress * Math.PI * 8,
        scale: 1 + intensity * 0.22
      });
    }
  }
}

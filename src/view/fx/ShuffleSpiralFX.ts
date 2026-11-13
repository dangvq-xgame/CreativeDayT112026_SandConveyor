import { BalanceConfig } from '../../config/game.config';
import { ColorId } from '../../types/level.types';
import { ScrewView } from '../entities/ScrewView';

interface SpiralScrewNode {
  colorId: ColorId;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angleOffset: number;
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

    const maxOrbitR = 78;
    for (const node of this.nodes) {
      let x = 0;
      let y = 0;
      if (progress < 0.5) {
        // Phase 1: Swirl inward toward vortex center
        const p = progress * 2;
        const theta = node.angleOffset + p * Math.PI * 3;
        const orbitR = (1 - p) * maxOrbitR;
        const vx = this.centerX + Math.cos(theta) * orbitR;
        const vy = this.centerY + Math.sin(theta) * orbitR;
        x = node.startX + (vx - node.startX) * p;
        y = node.startY + (vy - node.startY) * p;
      } else {
        // Phase 2: Deal outward from vortex center back into columns
        const p = (progress - 0.5) * 2;
        const theta = node.angleOffset + (1 - p) * Math.PI * 3;
        const orbitR = (1 - p) * maxOrbitR * 0.6;
        const vx = this.centerX + Math.cos(theta) * orbitR;
        const vy = this.centerY + Math.sin(theta) * orbitR;
        x = vx + (node.endX - vx) * p;
        y = vy + (node.endY - vy) * p;
      }

      ScrewView.draw(ctx, x, y, this.radius, node.colorId, {
        rotation: progress * Math.PI * 8,
        scale: 1 + Math.sin(progress * Math.PI) * 0.22
      });
    }
  }
}


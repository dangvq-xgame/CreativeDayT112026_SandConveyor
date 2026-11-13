import { GameConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { SandBucketModel } from '../../game/models/SandBucketModel';
import { ColorId } from '../../types/level.types';

export interface ActiveSandGrain {
  startX: number;
  startY: number;
  targetBucket: SandBucketModel;
  targetOffsetY: number;
  startedAtMs: number;
  colorId: ColorId;
}

export interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hex: string;
  size: number;
}

export class SandStreamFX {
  readonly grains: ActiveSandGrain[] = [];
  readonly particles: BurstParticle[] = [];

  spawnGrain(
    startX: number,
    startY: number,
    targetBucket: SandBucketModel,
    targetOffsetY: number,
    colorId: ColorId,
    nowMs: number
  ): void {
    this.grains.push({
      startX,
      startY,
      targetBucket,
      targetOffsetY,
      startedAtMs: nowMs,
      colorId
    });
  }

  spawnUnlockBurst(x: number, y: number, colorId: ColorId): void {
    const pal = ColorManager.getColor(colorId);
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 140,
        life: 0.68,
        maxLife: 0.68,
        hex: i % 3 === 0 ? '#ffffff' : pal.bodyHex,
        size: 3 + (i % 3)
      });
    }
  }

  update(nowMs: number, dtSec: number): void {
    const streamMs = GameConfig.sandStreamDurationMs;
    for (let i = this.grains.length - 1; i >= 0; i--) {
      if (nowMs - this.grains[i].startedAtMs >= streamMs) {
        this.grains.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtSec;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number, bucketCenterY: number): void {
    const streamMs = GameConfig.sandStreamDurationMs;
    for (const g of this.grains) {
      const t = Math.min(1, Math.max(0, (nowMs - g.startedAtMs) / streamMs));
      const tx = g.targetBucket.visualX;
      const ty = bucketCenterY + g.targetOffsetY;
      const x = g.startX + (tx - g.startX) * t;
      const y = g.startY + (ty - g.startY) * t - Math.sin(t * Math.PI) * 18;
      const pal = ColorManager.getColor(g.colorId);

      ctx.fillStyle = pal.sandHex;
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      ctx.globalAlpha = 0.42;
      ctx.fillRect(x - 1.5, y - 12 * (1 - t), 3, 10);
      ctx.globalAlpha = 1;
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.hex;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.grains.length = 0;
    this.particles.length = 0;
  }
}


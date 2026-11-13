import { GameConfig } from '../../config/game.config';
import { ColorManager } from '../../core/ColorManager';
import { SandBucketModel } from '../../game/models/SandBucketModel';
import { ColorId } from '../../types/level.types';
import { CachedSprite, getRenderScale, packKey, SpriteCache } from '../SpriteCache';

export interface ActiveSandGrain {
  startX: number;
  startY: number;
  targetBucket: SandBucketModel;
  targetOffsetY: number;
  startedAtMs: number;
  colorId: ColorId;
  jitterX: number;
  radius: number;
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
  /** colorId used for the bead sprite (0 = white sparkle) */
  colorId?: ColorId;
}

const K_BEAD = 50;
const K_SPARK = 51;

function paintBead(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, colorId: ColorId): void {
  const pal = ColorManager.getColor(colorId);
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, ColorManager.mixHex(pal.sandHex, '#ffffff', 0.55));
  g.addColorStop(0.55, pal.sandHex);
  g.addColorStop(1, ColorManager.mixHex(pal.sandHex, pal.shadowHex, 0.6));
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.beginPath();
  c.arc(cx - r * 0.35, cy - r * 0.38, r * 0.26, 0, Math.PI * 2);
  c.fill();
}

function paintSpark(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,250,210,0.85)');
  g.addColorStop(1, 'rgba(255,240,170,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
}

export class SandStreamFX {
  readonly grains: ActiveSandGrain[] = [];
  readonly particles: BurstParticle[] = [];
  private readonly grainPool: ActiveSandGrain[] = [];
  private readonly particlePool: BurstParticle[] = [];

  spawnGrain(
    startX: number,
    startY: number,
    targetBucket: SandBucketModel,
    targetOffsetY: number,
    colorId: ColorId,
    nowMs: number
  ): void {
    // A cluster of 5 beads per drained logical cell keeps the stream lush & continuous
    for (let k = 0; k < 5; k++) {
      const g = this.grainPool.pop() ?? ({} as ActiveSandGrain);
      g.startX = startX + (k - 2) * 2.2 + (Math.random() - 0.5) * 2.5;
      g.startY = startY + (k % 2) * 2;
      g.targetBucket = targetBucket;
      g.targetOffsetY = targetOffsetY + (k % 3) * 1.4;
      g.startedAtMs = nowMs + k * 8;
      g.colorId = colorId;
      g.jitterX = (Math.random() - 0.5) * 8;
      g.radius = 2.2 + (k % 2) * 0.6;
      this.grains.push(g);
    }
  }

  spawnUnlockBurst(x: number, y: number, colorId: ColorId): void {
    const pal = ColorManager.getColor(colorId);
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 170;
      const p = this.particlePool.pop() ?? ({} as BurstParticle);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 150;
      p.maxLife = 0.6 + Math.random() * 0.2;
      p.life = p.maxLife;
      const sparkle = i % 3 === 0;
      p.hex = sparkle ? '#ffffff' : pal.bodyHex;
      p.colorId = sparkle ? 0 : colorId;
      p.size = 3 + (i % 3);
      this.particles.push(p);
    }
  }

  update(nowMs: number, dtSec: number): void {
    const streamMs = GameConfig.sandStreamDurationMs;
    const grains = this.grains;
    for (let i = grains.length - 1; i >= 0; i--) {
      if (nowMs - grains[i].startedAtMs >= streamMs) {
        const g = grains[i];
        grains[i] = grains[grains.length - 1];
        grains.pop();
        this.grainPool.push(g);
      }
    }

    const parts = this.particles;
    const drag = Math.pow(0.985, dtSec * 60);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dtSec;
      if (p.life <= 0) {
        parts[i] = parts[parts.length - 1];
        parts.pop();
        this.particlePool.push(p);
        continue;
      }
      p.vy += 560 * dtSec;
      p.vx *= drag;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }
  }

  private beadSprite(colorId: ColorId, r: number, dpr: number): CachedSprite | null {
    const rq = Math.max(2, Math.round(r * dpr * 2));
    const rc = rq / (dpr * 2);
    const key = packKey(K_BEAD, colorId, rq, Math.round(dpr * 4));
    const S = rc * 2 + 2;
    return SpriteCache.get(key, S, S, dpr, S / 2, S / 2, (c) => paintBead(c, S / 2, S / 2, rc, colorId));
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number, bucketCenterY: number): void {
    if (this.grains.length === 0 && this.particles.length === 0) return;
    const dpr = getRenderScale(ctx);
    const streamMs = GameConfig.sandStreamDurationMs;
    const prevAlpha = ctx.globalAlpha;

    for (let i = 0; i < this.grains.length; i++) {
      const g = this.grains[i];
      if (nowMs < g.startedAtMs) continue;
      const t = Math.min(1, Math.max(0, (nowMs - g.startedAtMs) / streamMs));
      const sprite = this.beadSprite(g.colorId, g.radius, dpr);
      const tx = g.targetBucket.visualX + g.jitterX * (1 - t * 0.5);
      const ty = bucketCenterY + g.targetOffsetY;
      const shrink = t > 0.85 ? 1 - (t - 0.85) / 0.15 * 0.6 : 1;

      // trailing bead (motion blur) + main bead, both on the same gravity curve
      for (let pass = 0; pass < 2; pass++) {
        const tt = pass === 0 ? Math.max(0, t - 0.09) : t;
        const easeY = tt * tt * 0.65 + tt * 0.35;
        const x = g.startX + (tx - g.startX) * tt;
        const y = g.startY + (ty - g.startY) * easeY - Math.sin(tt * Math.PI) * 10;
        const s = pass === 0 ? 0.8 * shrink : shrink;
        ctx.globalAlpha = prevAlpha * (pass === 0 ? 0.4 : 1);
        if (sprite) {
          const w = sprite.w * s;
          ctx.drawImage(sprite.canvas, x - w / 2, y - w / 2, w, w);
        } else {
          ctx.fillStyle = ColorManager.getColor(g.colorId).sandHex;
          ctx.beginPath();
          ctx.arc(x, y, g.radius * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = prevAlpha * Math.min(1, a * 1.4);
      const r = p.size * 0.6 * (0.6 + 0.4 * a);
      let sprite: CachedSprite | null;
      if (p.colorId) {
        sprite = this.beadSprite(p.colorId, p.size * 0.6, dpr);
      } else {
        const rq = Math.max(2, Math.round(p.size * dpr));
        const rc = rq / dpr;
        const S = rc * 2.4;
        sprite = SpriteCache.get(packKey(K_SPARK, 0, rq, Math.round(dpr * 4)), S, S, dpr, S / 2, S / 2, (c) =>
          paintSpark(c, S / 2, S / 2, S / 2)
        );
      }
      if (sprite) {
        const k = r / (p.size * 0.6);
        const w = sprite.w * k;
        ctx.drawImage(sprite.canvas, p.x - w / 2, p.y - w / 2, w, w);
      } else {
        ctx.fillStyle = p.hex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  clear(): void {
    while (this.grains.length) this.grainPool.push(this.grains.pop()!);
    while (this.particles.length) this.particlePool.push(this.particles.pop()!);
  }
}

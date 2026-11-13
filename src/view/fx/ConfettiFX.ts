import { ColorManager } from '../../core/ColorManager';

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  /** flutter phase: the piece's apparent height follows cos(phase) (3D flip) */
  phase: number;
  vPhase: number;
  w: number;
  h: number;
  hex: string;
  shape: 0 | 1 | 2; // 0 ribbon, 1 square, 2 dot
  age: number;
  maxAge: number;
}

const EXTRA_COLORS = ['#ffffff', '#ffd84a', '#ff5fa8', '#59d8ff'];

export class ConfettiFX {
  private pieces: ConfettiPiece[] = [];
  private pool: ConfettiPiece[] = [];
  private viewH = 900;

  burst(width: number, height: number): void {
    this.clear();
    this.viewH = height;
    const total = 110;
    for (let i = 0; i < total; i++) {
      const p = this.pool.pop() ?? ({} as ConfettiPiece);
      const cannon = i % 3; // 0 = left cannon, 1 = right cannon, 2 = top shower
      if (cannon === 2) {
        p.x = width * (0.1 + Math.random() * 0.8);
        p.y = -10 - Math.random() * height * 0.15;
        p.vx = (Math.random() - 0.5) * 80;
        p.vy = 40 + Math.random() * 120;
      } else {
        const dir = cannon === 0 ? 1 : -1;
        p.x = cannon === 0 ? -6 : width + 6;
        p.y = height * (0.55 + Math.random() * 0.1);
        const ang = (-62 - Math.random() * 18) * (Math.PI / 180);
        const speed = 520 + Math.random() * 380;
        p.vx = Math.cos(ang) * speed * dir;
        p.vy = Math.sin(ang) * speed;
      }
      p.rot = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 9;
      p.phase = Math.random() * Math.PI * 2;
      p.vPhase = 6 + Math.random() * 8;
      const shape = (i % 7 === 0 ? 2 : i % 2) as 0 | 1 | 2;
      p.shape = shape;
      p.w = shape === 0 ? 5 + Math.random() * 3 : 6 + Math.random() * 4;
      p.h = shape === 0 ? 11 + Math.random() * 6 : p.w;
      p.hex =
        i % 5 === 0
          ? EXTRA_COLORS[i % EXTRA_COLORS.length]
          : ColorManager.getColor((i % 12) + 1).bodyHex;
      p.age = 0;
      p.maxAge = 2.6 + Math.random() * 1.4;
      this.pieces.push(p);
    }
  }

  update(dtSec: number): void {
    if (this.pieces.length === 0) return;
    const drag = Math.pow(0.986, dtSec * 60);
    const ps = this.pieces;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dtSec;
      // terminal velocity + air drag make the flutter feel papery
      p.vy = Math.min(p.vy + 620 * dtSec, 240);
      p.vx *= drag;
      p.x += p.vx * dtSec + Math.sin(p.phase) * 18 * dtSec;
      p.y += p.vy * dtSec;
      p.rot += p.vRot * dtSec;
      p.phase += p.vPhase * dtSec;
      if (p.age >= p.maxAge || p.y > this.viewH + 30) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        this.pool.push(p);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.pieces.length === 0) return;
    const base = ctx.getTransform();
    const s = Math.hypot(base.a, base.b) || 1;
    const e = base.e;
    const f = base.f;
    const prevAlpha = ctx.globalAlpha;

    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      const fade = p.maxAge - p.age < 0.6 ? Math.max(0, (p.maxAge - p.age) / 0.6) : 1;
      const flip = Math.cos(p.phase);
      const cr = Math.cos(p.rot);
      const sr = Math.sin(p.rot);
      // transform = base(scale s) · translate(x,y) · rotate(rot) · scale(1, flip)
      ctx.setTransform(s * cr, s * sr, -s * sr * flip, s * cr * flip, s * p.x + e, s * p.y + f);
      ctx.globalAlpha = prevAlpha * fade;
      ctx.fillStyle = p.hex;
      if (p.shape === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        // shading on the back side of the flip
        if (flip < 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
    }
    ctx.setTransform(base);
    ctx.globalAlpha = prevAlpha;
  }

  clear(): void {
    while (this.pieces.length) this.pool.push(this.pieces.pop()!);
  }
}

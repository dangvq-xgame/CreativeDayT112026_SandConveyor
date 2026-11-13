import { BalanceConfig } from '../config/game.config';

const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Tracks press-and-hold to fast-forward the conveyor. */
export class InputManager {
  private pointerDownTime = 0;
  private isPointerDown = false;

  constructor(
    private readonly holdThresholdMs: number = BalanceConfig.conveyor.holdThresholdMs,
    private readonly holdSpeedMultiplier: number = BalanceConfig.conveyor.holdSpeedMultiplier,
    private readonly now: () => number = defaultNow
  ) {}

  onPointerDown(nowMs: number = this.now()): void {
    this.isPointerDown = true;
    this.pointerDownTime = nowMs;
  }

  onPointerUp(): void {
    this.isPointerDown = false;
  }

  /** Releases the hold (e.g. when the page is hidden or a popup opens). */
  reset(): void {
    this.isPointerDown = false;
  }

  isHoldingFastForward(nowMs: number = this.now()): boolean {
    if (!this.isPointerDown) return false;
    return nowMs - this.pointerDownTime >= this.holdThresholdMs;
  }

  /** Belt speed multiplier: `holdSpeedMultiplier` while held long enough, else 1. */
  getSpeedMultiplier(nowMs: number = this.now()): number {
    return this.isHoldingFastForward(nowMs) ? this.holdSpeedMultiplier : 1;
  }
}

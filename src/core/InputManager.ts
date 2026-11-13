import { BalanceConfig } from '../config/game.config';

export class InputManager {
  private pointerDownTime = 0;
  private isPointerDown = false;

  onPointerDown(): void {
    this.isPointerDown = true;
    this.pointerDownTime = performance.now();
  }

  onPointerUp(): void {
    this.isPointerDown = false;
  }

  isHoldingFastForward(now = performance.now()): boolean {
    if (!this.isPointerDown) return false;
    return now - this.pointerDownTime >= BalanceConfig.conveyor.holdThresholdMs;
  }

  getSpeedMultiplier(now = performance.now()): number {
    return this.isHoldingFastForward(now) ? BalanceConfig.conveyor.holdSpeedMultiplier : 1;
  }
}


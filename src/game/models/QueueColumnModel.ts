import { BalanceConfig } from '../../config/game.config';
import { ColorId, QueueColumnDef, QueueScrewDef } from '../../types/level.types';

export class QueueColumnModel {
  readonly columnIndex: number;
  readonly rimColorId: ColorId;
  readonly items: QueueScrewDef[];
  lastPopTimeMs = -9999;
  lastBonkTimeMs = -9999;

  constructor(def: QueueColumnDef) {
    this.columnIndex = def.columnIndex;
    this.rimColorId = def.rimColorId;
    this.items = def.items.map((it) => ({
      colorId: it.colorId,
      isMystery: Boolean(it.isMystery)
    }));
    this.revealTopIfNeeded();
  }

  /** Top screw at index 0 is always revealed if it was mystery */
  revealTopIfNeeded(): void {
    if (this.items.length > 0 && this.items[0].isMystery) {
      this.items[0].isMystery = false;
    }
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  peekTop(): QueueScrewDef | null {
    return this.items.length > 0 ? this.items[0] : null;
  }

  popTop(nowMs = 0): QueueScrewDef | null {
    if (this.items.length === 0) return null;
    const top = this.items.shift()!;
    this.lastPopTimeMs = nowMs;
    this.revealTopIfNeeded();
    return top;
  }

  getVisibleItems(visibleDepth = BalanceConfig.queueColumns.visibleDepth): QueueScrewDef[] {
    return this.items.slice(0, visibleDepth);
  }

  getHiddenCount(visibleDepth = BalanceConfig.queueColumns.visibleDepth): number {
    return Math.max(0, this.items.length - visibleDepth);
  }
}


import { BalanceConfig, GameplayConfig } from '../../config/game.config';
import { ColorId, QueueColumnDef, QueueScrewDef } from '../../types/level.types';

/**
 * One glass queue column (FIFO). `items[0]` is the top screw (tappable, always revealed);
 * `items[1..]` slide up when it leaves. Mystery screws (`isMystery`) show `?` until they reach the top.
 */
export class QueueColumnModel {
  readonly columnIndex: number;
  readonly rimColorId: ColorId;
  /** Top → bottom. Prefer the methods below over mutating it directly. */
  readonly items: QueueScrewDef[];
  lastPopTimeMs: number = GameplayConfig.neverMs;
  lastBonkTimeMs: number = GameplayConfig.neverMs;

  constructor(def: QueueColumnDef) {
    this.columnIndex = def.columnIndex;
    this.rimColorId = def.rimColorId;
    this.items = (Array.isArray(def.items) ? def.items : []).map((it) => ({
      colorId: it.colorId,
      isMystery: Boolean(it.isMystery)
    }));
    this.revealTopIfNeeded();
  }

  /** The top screw (index 0) is always revealed. */
  revealTopIfNeeded(): void {
    if (this.items.length > 0 && this.items[0].isMystery) {
      this.items[0].isMystery = false;
    }
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  getItemCount(): number {
    return this.items.length;
  }

  peekTop(): QueueScrewDef | null {
    return this.items.length > 0 ? this.items[0] : null;
  }

  /** Removes the top screw, stamps `lastPopTimeMs` and reveals the new top. */
  popTop(nowMs = 0): QueueScrewDef | null {
    if (this.items.length === 0) return null;
    const top = this.items.shift()!;
    this.lastPopTimeMs = nowMs;
    this.revealTopIfNeeded();
    return top;
  }

  /** Removes the screw at `depth` (0 = top) and reveals the new top. */
  removeAt(depth: number): QueueScrewDef | null {
    if (!Number.isInteger(depth) || depth < 0 || depth >= this.items.length) return null;
    const [removed] = this.items.splice(depth, 1);
    this.revealTopIfNeeded();
    return removed;
  }

  /** Shallowest depth holding `colorId` (mystery or not), or -1. */
  findDepthOfColor(colorId: ColorId): number {
    return this.items.findIndex((it) => it.colorId === colorId);
  }

  /** Empties the column and returns its screws (top first). */
  takeAll(): QueueScrewDef[] {
    return this.items.splice(0, this.items.length);
  }

  /** Replaces the content (top first) and reveals the new top. */
  setItems(items: QueueScrewDef[]): void {
    this.items.splice(0, this.items.length, ...items);
    this.revealTopIfNeeded();
  }

  /** `true` if the screw at `depth` must be drawn as a hidden `?` (never the top screw). */
  isHiddenAt(depth: number): boolean {
    return depth > 0 && Boolean(this.items[depth]?.isMystery);
  }

  getVisibleItems(visibleDepth = BalanceConfig.queueColumns.visibleDepth): QueueScrewDef[] {
    return this.items.slice(0, Math.max(0, visibleDepth));
  }

  /** Screws below the visible window (the `+N` badge). */
  getHiddenCount(visibleDepth = BalanceConfig.queueColumns.visibleDepth): number {
    return Math.max(0, this.items.length - Math.max(0, visibleDepth));
  }
}

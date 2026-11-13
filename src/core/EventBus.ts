/** Listener for an event payload. */
export type Handler<T = unknown> = (payload: T) => void;

type ListenerTable<Events> = { [K in keyof Events]?: Set<Handler<Events[K]>> };

/**
 * Minimal typed pub/sub.
 *
 * Emit semantics (same as DOM `EventTarget`):
 * - a handler added during an emit is NOT called by that emit (so a handler that re-subscribes
 *   itself cannot loop forever);
 * - a handler removed during an emit (before its turn) is NOT called anymore — `off()` is immediate;
 * - a throwing handler is logged and does not prevent the other handlers from running.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private listeners: ListenerTable<Events> = {};

  /** Subscribes; returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribes for a single emit. */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const wrapper: Handler<Events[K]> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const set = this.listeners[event];
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) delete this.listeners[event];
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const fn of [...set]) {
      if (!set.has(fn)) continue; // removed by an earlier handler of this emit
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${String(event)}" failed`, err);
      }
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners[event]?.size ?? 0;
  }

  clear(): void {
    this.listeners = {};
  }
}

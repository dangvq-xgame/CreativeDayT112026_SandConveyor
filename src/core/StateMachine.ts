import { GamePhase } from '../config/constants';

export type PhaseChangeListener = (from: GamePhase, to: GamePhase) => void;

/**
 * Current gameplay phase + change notifications.
 *
 * Listeners are called on a snapshot: unsubscribing during a notification never skips ANOTHER
 * listener (old bug), an unsubscribed listener is not called anymore, and one subscribed during a
 * notification waits for the next change. A throwing listener does not block the others.
 * A transition requested from inside a listener is applied immediately and notified (in order)
 * after the current round.
 */
export class StateMachine {
  private current: GamePhase;
  private listeners: PhaseChangeListener[] = [];
  private pending: Array<[GamePhase, GamePhase]> = [];
  private notifying = false;

  constructor(initial: GamePhase = 'PLAYING') {
    this.current = initial;
  }

  get phase(): GamePhase {
    return this.current;
  }

  /** `true` if the current phase is one of `phases`. */
  is(...phases: GamePhase[]): boolean {
    return phases.includes(this.current);
  }

  /** Changes phase and notifies listeners. No-op (no notification) if already in `next`. */
  transitionTo(next: GamePhase): void {
    if (this.current === next) return;
    this.pending.push([this.current, next]);
    this.current = next;
    if (this.notifying) return; // re-entrant call: delivered by the outer loop, in order
    this.notifying = true;
    try {
      for (let change = this.pending.shift(); change; change = this.pending.shift()) {
        const [from, to] = change;
        for (const cb of [...this.listeners]) {
          if (!this.listeners.includes(cb)) continue; // unsubscribed by an earlier listener
          try {
            cb(from, to);
          } catch (err) {
            console.error('[StateMachine] listener failed', err);
          }
        }
      }
    } finally {
      this.notifying = false;
      this.pending.length = 0;
    }
  }

  /** Subscribes; returns an unsubscribe function. */
  onChange(cb: PhaseChangeListener): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
}

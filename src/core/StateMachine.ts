import { GamePhase } from '../config/constants';

export class StateMachine {
  private current: GamePhase = 'PLAYING';
  private listeners: Array<(from: GamePhase, to: GamePhase) => void> = [];

  get phase(): GamePhase {
    return this.current;
  }

  transitionTo(next: GamePhase): void {
    if (this.current === next) return;
    const prev = this.current;
    this.current = next;
    for (const cb of this.listeners) {
      cb(prev, next);
    }
  }

  onChange(cb: (from: GamePhase, to: GamePhase) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
}


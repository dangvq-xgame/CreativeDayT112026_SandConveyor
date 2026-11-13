import { describe, expect, it, vi } from 'vitest';
import { GamePhase } from '../../src/config/constants';
import { EventBus } from '../../src/core/EventBus';
import { StateMachine } from '../../src/core/StateMachine';

type Events = { tap: number; win: { level: number } };

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<Events>();
    const h = vi.fn();
    const off = bus.on('tap', h);
    bus.emit('tap', 3);
    off();
    bus.emit('tap', 4);
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith(3);
    expect(bus.listenerCount('tap')).toBe(0);
  });

  it('once fires a single time', () => {
    const bus = new EventBus<Events>();
    const h = vi.fn();
    bus.once('win', h);
    bus.emit('win', { level: 1 });
    bus.emit('win', { level: 2 });
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ level: 1 });
  });

  it('a handler removing itself during emit does not skip the next handler', () => {
    const bus = new EventBus<Events>();
    const order: string[] = [];
    const a = (): void => {
      order.push('a');
      bus.off('tap', a);
    };
    bus.on('tap', a);
    bus.on('tap', () => order.push('b'));
    bus.emit('tap', 1);
    bus.emit('tap', 2);
    expect(order).toEqual(['a', 'b', 'b']);
  });

  it('a handler removed by an earlier handler is not called (off is immediate)', () => {
    const bus = new EventBus<Events>();
    const b = vi.fn();
    bus.on('tap', () => bus.off('tap', b));
    bus.on('tap', b);
    bus.emit('tap', 1);
    expect(b).not.toHaveBeenCalled();
  });

  it('handlers added during emit wait for the next emit (regression: self re-subscribe looped forever)', () => {
    const bus = new EventBus<Events>();
    let calls = 0;
    const h = (): void => {
      calls++;
      bus.off('tap', h);
      bus.on('tap', h); // re-added at the end of the Set
    };
    bus.on('tap', h);
    bus.emit('tap', 1);
    expect(calls).toBe(1);
    bus.emit('tap', 1);
    expect(calls).toBe(2);
  });

  it('a throwing handler does not stop the others', () => {
    const bus = new EventBus<Events>();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    bus.on('tap', () => {
      throw new Error('boom');
    });
    bus.on('tap', after);
    expect(() => bus.emit('tap', 1)).not.toThrow();
    expect(after).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('clear removes everything; emit without listeners is a no-op', () => {
    const bus = new EventBus<Events>();
    const h = vi.fn();
    bus.on('tap', h);
    bus.clear();
    bus.emit('tap', 1);
    bus.emit('win', { level: 1 });
    expect(h).not.toHaveBeenCalled();
  });
});

describe('StateMachine', () => {
  it('starts in PLAYING (or the given phase) and notifies transitions', () => {
    expect(new StateMachine().phase).toBe('PLAYING');
    const fsm = new StateMachine('PAUSED');
    const cb = vi.fn();
    fsm.onChange(cb);
    fsm.transitionTo('PLAYING');
    expect(cb).toHaveBeenCalledWith('PAUSED', 'PLAYING');
    expect(fsm.is('PLAYING', 'WIN')).toBe(true);
    expect(fsm.is('LOSE')).toBe(false);
  });

  it('does not notify a transition to the same phase', () => {
    const fsm = new StateMachine();
    const cb = vi.fn();
    fsm.onChange(cb);
    fsm.transitionTo('PLAYING');
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribing inside a listener does not skip the next listener (regression)', () => {
    const fsm = new StateMachine();
    const calls: string[] = [];
    const offA = fsm.onChange(() => {
      calls.push('a');
      offA();
    });
    fsm.onChange(() => calls.push('b'));
    fsm.transitionTo('WIN');
    expect(calls).toEqual(['a', 'b']);
    fsm.transitionTo('PLAYING');
    expect(calls).toEqual(['a', 'b', 'b']);
  });

  it('delivers nested transitions in order', () => {
    const fsm = new StateMachine();
    const seen: Array<[GamePhase, GamePhase, string]> = [];
    fsm.onChange((from, to) => {
      seen.push([from, to, 'first']);
      if (to === 'WAIT_REVIVE') fsm.transitionTo('LOSE');
    });
    fsm.onChange((from, to) => seen.push([from, to, 'second']));
    fsm.transitionTo('WAIT_REVIVE');
    expect(fsm.phase).toBe('LOSE');
    expect(seen).toEqual([
      ['PLAYING', 'WAIT_REVIVE', 'first'],
      ['PLAYING', 'WAIT_REVIVE', 'second'],
      ['WAIT_REVIVE', 'LOSE', 'first'],
      ['WAIT_REVIVE', 'LOSE', 'second']
    ]);
  });

  it('isolates a throwing listener', () => {
    const fsm = new StateMachine();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = vi.fn();
    fsm.onChange(() => {
      throw new Error('x');
    });
    fsm.onChange(ok);
    fsm.transitionTo('WIN');
    expect(ok).toHaveBeenCalled();
    fsm.transitionTo('PLAYING');
    expect(ok).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });
});

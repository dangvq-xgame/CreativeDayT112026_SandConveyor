import { GameplayConfig } from '../../config/game.config';
import { LevelData } from '../../types/level.types';
import { RandomFn, randomInt } from '../../utils/random';
import { GameState } from '../GameState';
import { LinearConveyorModel } from '../models/LinearConveyorModel';
import { SandBoardModel } from '../models/SandBoardModel';
import { SandSuctionRule } from '../rules/SandSuctionRule';
import { ScrewFlightPlan, ScrewMatchRule } from '../rules/ScrewMatchRule';
import { normalizeLevelData } from './normalizeLevel';

/**
 * Headless level simulation driven by the REAL models and rules (no duplicated game logic), used by
 * `tools/validate-levels.mjs` and the unit tests to prove every shipped level is solvable.
 *
 * Time is simulated: screw flights land instantly and lid / despawn delays are skipped.
 */

export type BotFailureReason = 'stuck' | 'out_of_space' | 'max_steps';

export interface BotResult {
  won: boolean;
  /** Number of column taps performed. */
  steps: number;
  remainingSand: number;
  reason?: BotFailureReason;
}

const TRACK = GameplayConfig.defaultTrack;
/** Simulated time between two taps (larger than every gameplay delay). */
const SIM_TICK_MS = 1000;
/** Safety cap on settle iterations (a settle normally needs a handful). */
const MAX_SETTLE_ITERATIONS = 100_000;

function landFlight(state: GameState, plan: ScrewFlightPlan | undefined, nowMs: number): void {
  if (!plan) return;
  if (plan.targetType === 'bucket' && plan.targetBucket) {
    plan.targetBucket.landScrewInHole(plan.targetHoleIndex ?? 0, nowMs);
  } else if (plan.targetType === 'buffer') {
    state.bufferDock.markSlotLanded(plan.targetSlotIndex, plan.bufferReservationId);
  }
}

/** Drains every open bucket as far as possible (one cell at a time, real suction priority). */
function drainAll(board: SandBoardModel, conveyor: LinearConveyorModel, nowMs: number): boolean {
  let drained = false;
  while (SandSuctionRule.stepSuction(board, conveyor, nowMs, 0, undefined, undefined, true)) drained = true;
  return drained;
}

/**
 * Runs spawn → buffer flush → suction → despawn until nothing changes (what the game loop does over
 * many frames).
 */
export function settleState(state: GameState, nowMs: number): void {
  const { conveyor, bufferDock, sandBoard } = state;
  for (let i = 0; i < MAX_SETTLE_ITERATIONS; i++) {
    let changed = conveyor.refillSlots(TRACK.startX, TRACK.endX, TRACK.visibleMinX, TRACK.visibleMaxX, true).length > 0;
    for (const plan of ScrewMatchRule.flushBufferToConveyor(conveyor, bufferDock)) {
      landFlight(state, plan, nowMs);
      changed = true;
    }
    if (drainAll(sandBoard, conveyor, nowMs)) changed = true;
    if (conveyor.releaseCompletedBuckets(nowMs, -1).length > 0) changed = true;
    if (!changed) return;
  }
}

/**
 * Greedy bot without boosters (same strategy as the original validator):
 * 1. tap a column whose top goes straight into a bucket;
 * 2. otherwise, if the buffer has room, dig the column with the shallowest screw a locked bucket needs;
 * 3. otherwise give up (`stuck`).
 * Note: the bot can see mystery screws (it is a solvability check, not a fair player).
 */
export function simulateGreedyBot(level: LevelData, options: { maxSteps?: number } = {}): BotResult {
  const maxSteps = options.maxSteps ?? 1000;
  const state = new GameState(level);
  const { conveyor, bufferDock, queueColumns: cols, sandBoard } = state;
  let nowMs = 0;
  let steps = 0;
  settleState(state, nowMs);

  while (steps < maxSteps) {
    if (state.isLevelWon()) return { won: true, steps, remainingSand: 0 };

    let pick = cols.findIndex((c) => ScrewMatchRule.predictRoute(c, conveyor, bufferDock) === 'bucket');
    if (pick < 0 && bufferDock.findFirstEmptySlotIndex() >= 0) {
      let bestDepth = Number.POSITIVE_INFINITY;
      cols.forEach((col, c) => {
        const depth = col.items.findIndex((it, d) => d >= 1 && conveyor.findTargetBucketForScrew(it.colorId) !== null);
        if (depth >= 1 && depth < bestDepth) {
          bestDepth = depth;
          pick = c;
        }
      });
    }
    if (pick < 0) return { won: false, steps, remainingSand: sandBoard.getRemainingCells(), reason: 'stuck' };

    steps++;
    const res = ScrewMatchRule.popColumnTop(cols[pick], conveyor, bufferDock, nowMs);
    if (!res.ok) {
      return {
        won: false,
        steps,
        remainingSand: sandBoard.getRemainingCells(),
        reason: res.outOfSpace ? 'out_of_space' : 'stuck'
      };
    }
    landFlight(state, res.flight, nowMs);
    nowMs += SIM_TICK_MS;
    settleState(state, nowMs);
  }
  if (state.isLevelWon()) return { won: true, steps, remainingSand: 0 };
  return { won: false, steps, remainingSand: sandBoard.getRemainingCells(), reason: 'max_steps' };
}

/**
 * Sand-deadlock stress test: buckets are unlocked in a random order (ignoring screws) with `slots`
 * active slots, using the real board + suction rule. A trial fails if every bucket on the belt is open
 * but none can drain, or if the run ends with sand left. Returns the number of failed trials.
 */
export function stressTestRandomUnlockOrder(
  level: LevelData,
  slots: number,
  trials: number,
  rng: RandomFn = Math.random
): number {
  const lv = normalizeLevelData(level);
  let failures = 0;
  for (let t = 0; t < trials; t++) {
    const board = new SandBoardModel(lv.sandBoard.width, lv.sandBoard.height, lv.sandBoard.subDivision, lv.sandBoard.grid);
    const conveyor = new LinearConveyorModel(lv.bucketQueue, slots, Math.max(slots, lv.conveyorConfig.maxActiveSlots));
    let nowMs = 0;
    let failed = true;
    for (let guard = 0; guard < MAX_SETTLE_ITERATIONS; guard++) {
      conveyor.refillSlots(TRACK.startX, TRACK.endX, TRACK.visibleMinX, TRACK.visibleMaxX, true);
      drainAll(board, conveyor, nowMs);
      if (conveyor.releaseCompletedBuckets(nowMs, -1).length > 0) continue;
      if (conveyor.queue.length === 0 && conveyor.getActiveBuckets().length === 0) {
        failed = !board.isCleared();
        break;
      }
      const locked = conveyor.getLockedActiveBuckets();
      if (locked.length === 0) break; // every bucket open, none can drain → deadlock
      const { bucket } = locked[randomInt(rng, locked.length)];
      bucket.holes.forEach((_, h) => bucket.landScrewInHole(h, nowMs));
      nowMs += SIM_TICK_MS;
    }
    if (failed) failures++;
  }
  return failures;
}

import balanceJson from './balance.json';
import { GameBalanceConfig } from '../types/level.types';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './constants';

/** Designer-tunable balance values (`balance.json`). */
export const BalanceConfig: GameBalanceConfig = balanceJson as GameBalanceConfig;

/** Rendering / animation timings shared by scenes and views. */
export const GameConfig = {
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  backgroundColor: 0xbfe3fb,
  maxDevicePixelRatio: 2,
  gravityPxPerSecSq: 2400,
  screwFlightDurationMs: 390,
  lidTwistDurationMs: 250,
  lidFlipDurationMs: 380,
  sandStreamDurationMs: 350
};

/**
 * Core-logic constants that used to be magic numbers inside models/rules.
 * Values are unchanged from the original hard-coded defaults.
 */
export const GameplayConfig = {
  /** Fallback when a level omits `sandBoard.subDivision`. */
  defaultSubDivision: 4,
  /** Revives granted per level attempt (buffer +1 slot popup). */
  revivesPerLevel: 1,
  /** Time from "3rd screw landed" until sand may flow (lid twist + lid flip animations). */
  lidOpenReadyDelayMs: GameConfig.lidTwistDurationMs + GameConfig.lidFlipDurationMs,
  /** A completed bucket stays on its slot this long before rolling away (`> delay`). */
  bucketDespawnDelayMs: 280,
  /** Speed at which a freshly spawned bucket slides out of the left tunnel. */
  bucketSpawnSlideSpeedPxPerSec: 340,
  /** Speed of a completed bucket rolling into the right tunnel. */
  bucketLeaveSpeedPxPerSec: 420,
  /** Phase of slot 0 along the belt, as a ratio of the track span (SandLoop ConveyorLinear). */
  slotPhaseOffsetRatio: 0.14,
  /** Default board cell size / left edge used when a caller does not pass real layout values. */
  defaultCellSizePx: 20,
  defaultBoardLeftX: 60,
  /** Default (layout-less) track geometry for model-only usage such as tests and the level bot. */
  defaultTrack: {
    startX: 0,
    endX: 500,
    visibleMinX: 40,
    visibleMaxX: 460
  },
  /** Sentinel timestamp meaning "never happened" for pop/bonk animations. */
  neverMs: -9999
} as const;

/**
 * Sanity-checks a balance config. Returns human-readable problems (empty array = OK).
 * Used by tests so a bad `balance.json` edit is caught before it reaches players.
 */
export function validateBalanceConfig(cfg: GameBalanceConfig): string[] {
  const errors: string[] = [];
  const posInt = (v: number, name: string): void => {
    if (!Number.isInteger(v) || v <= 0) errors.push(`${name} must be a positive integer (got ${v})`);
  };
  const posNum = (v: number, name: string): void => {
    if (!Number.isFinite(v) || v <= 0) errors.push(`${name} must be a positive number (got ${v})`);
  };
  const nonNegInt = (v: number, name: string): void => {
    if (!Number.isInteger(v) || v < 0) errors.push(`${name} must be an integer >= 0 (got ${v})`);
  };

  const c = cfg.conveyor;
  posInt(c.defaultActiveSlots, 'conveyor.defaultActiveSlots');
  posInt(c.maxActiveSlots, 'conveyor.maxActiveSlots');
  if (c.defaultActiveSlots > c.maxActiveSlots) {
    errors.push('conveyor.defaultActiveSlots must be <= conveyor.maxActiveSlots');
  }
  posInt(c.holesPerBucket, 'conveyor.holesPerBucket');
  posNum(c.beltSpeedPxPerSec, 'conveyor.beltSpeedPxPerSec');
  posNum(c.holdSpeedMultiplier, 'conveyor.holdSpeedMultiplier');
  posNum(c.holdThresholdMs, 'conveyor.holdThresholdMs');
  posNum(c.suctionIntervalMs, 'conveyor.suctionIntervalMs');

  posInt(cfg.bufferDock.defaultSlots, 'bufferDock.defaultSlots');
  posInt(cfg.bufferDock.maxReviveSlots, 'bufferDock.maxReviveSlots');
  if (cfg.bufferDock.maxReviveSlots < cfg.bufferDock.defaultSlots) {
    errors.push('bufferDock.maxReviveSlots must be >= bufferDock.defaultSlots');
  }

  posInt(cfg.queueColumns.visibleDepth, 'queueColumns.visibleDepth');

  for (const key of ['extraSlot', 'hand', 'shuffle'] as const) {
    nonNegInt(cfg.boosters[key].initialCount, `boosters.${key}.initialCount`);
    nonNegInt(cfg.boosters[key].coinCost, `boosters.${key}.coinCost`);
  }
  posInt(cfg.boosters.extraSlot.slotIncrement, 'boosters.extraSlot.slotIncrement');
  nonNegInt(cfg.boosters.shuffle.minPriorityTopMatches, 'boosters.shuffle.minPriorityTopMatches');
  return errors;
}

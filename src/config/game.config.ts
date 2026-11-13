import balanceJson from './balance.json';
import { GameBalanceConfig } from '../types/level.types';

export const BalanceConfig: GameBalanceConfig = balanceJson as GameBalanceConfig;

export const GameConfig = {
  designWidth: 540,
  designHeight: 960,
  backgroundColor: 0xbfe3fb,
  maxDevicePixelRatio: 2,
  gravityPxPerSecSq: 2400,
  screwFlightDurationMs: 390,
  lidTwistDurationMs: 250,
  lidFlipDurationMs: 380,
  sandStreamDurationMs: 350
};


export const DESIGN_WIDTH = 540;
export const DESIGN_HEIGHT = 960;

export const STORAGE_KEY = 'sand_conveyor_save_v1';
export const TOTAL_LEVELS = 5;

/** Languages accepted by the save file / I18n. The first entry is the default. */
export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0];

/** Defaults and limits for a fresh save file. */
export const SAVE_DEFAULTS = {
  coins: 500,
  maxStars: 3
} as const;

export type GamePhase =
  | 'PLAYING'
  | 'BOOSTER_HAND_SELECT'
  | 'BOOSTER_SHUFFLE_ANIM'
  | 'PAUSED'
  | 'WAIT_REVIVE'
  | 'WIN'
  | 'LOSE';


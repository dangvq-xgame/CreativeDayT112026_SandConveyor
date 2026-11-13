export const DESIGN_WIDTH = 540;
export const DESIGN_HEIGHT = 960;

export const STORAGE_KEY = 'sand_conveyor_save_v1';
export const TOTAL_LEVELS = 5;

export type GamePhase =
  | 'PLAYING'
  | 'BOOSTER_HAND_SELECT'
  | 'BOOSTER_SHUFFLE_ANIM'
  | 'PAUSED'
  | 'WAIT_REVIVE'
  | 'WIN'
  | 'LOSE';


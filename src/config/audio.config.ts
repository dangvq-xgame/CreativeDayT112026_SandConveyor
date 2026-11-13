/** Sound-effect keys known by {@link AudioManager}. */
export type SfxKey =
  | 'tap_screw'
  | 'match_pop'
  | 'twist'
  | 'sand_flow'
  | 'bucket_done'
  | 'swipe'
  | 'punch'
  | 'ui_click'
  | 'win_level'
  | 'lose_level';

/** Relative URLs (served from `public/`) of every sound-effect file. */
export const SFX_FILES: Readonly<Record<SfxKey, string>> = {
  tap_screw: './assets/audio/sfx/tap_screw.wav',
  match_pop: './assets/audio/sfx/match_pop.wav',
  twist: './assets/audio/sfx/twist.mp3',
  sand_flow: './assets/audio/sfx/sand_flow.wav',
  bucket_done: './assets/audio/sfx/bucket_done.mp3',
  swipe: './assets/audio/sfx/swipe.mp3',
  punch: './assets/audio/sfx/punch.mp3',
  ui_click: './assets/audio/sfx/ui_click.wav',
  win_level: './assets/audio/sfx/win_level.wav',
  lose_level: './assets/audio/sfx/lose_level.mp3'
};

/** Looping background music. */
export const BGM_FILE = './assets/audio/bgm/ingame_bg.mp3';

export const AudioConfig = {
  /** Background music volume (0..1). */
  bgmVolume: 0.35,
  /** Minimum gap between two sand-grain ticks, so a stream does not spam the mixer. */
  sandGrainMinIntervalMs: 42,
  /** Random pitch spread of the sand-grain tick: rate = base + random * spread. */
  sandGrainRateBase: 0.92,
  sandGrainRateSpread: 0.2,
  /** Pitch step per hole index when a screw lands (1st/2nd/3rd hole sound higher). */
  screwLandRateBase: 0.96,
  screwLandRateStep: 0.08,
  /** Lowest frequency allowed for synthesized fallback tones (exponential ramps cannot reach 0). */
  minToneHz: 20,
  /** Gain floor for the exponential fade-out of synthesized tones. */
  toneFadeFloor: 0.001,
  /** Extra time after a tone ends before its oscillator is stopped. */
  toneStopPaddingSec: 0.02
} as const;

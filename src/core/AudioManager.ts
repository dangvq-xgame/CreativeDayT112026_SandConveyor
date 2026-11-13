import { AudioConfig, BGM_FILE, SFX_FILES, SfxKey } from '../config/audio.config';
import { clamp01 } from '../utils/math.utils';
import { SaveManager, SettingsStore } from './SaveManager';

/** The subset of `HTMLAudioElement` used by {@link AudioManagerImpl} (fakeable in tests). */
export interface AudioClipLike {
  volume: number;
  playbackRate: number;
  loop: boolean;
  preload: string;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: 'error', listener: () => void): void;
}

/** Platform hooks, injectable so the manager can be unit-tested without a browser. */
export interface AudioBackend {
  /** Creates a (not yet playing) clip for `src`, or `null` when HTML audio is unavailable. */
  createClip(src: string): AudioClipLike | null;
  /** Creates an independent voice of `base` so overlapping plays do not cut each other. */
  cloneClip(base: AudioClipLike): AudioClipLike | null;
  /** Creates a Web Audio context for synthesized fallback tones, or `null` if unsupported. */
  createContext(): AudioContext | null;
  now(): number;
  random(): number;
}

type GlobalWithAudioContext = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

const noop = (): void => {};

/** Browser implementation of {@link AudioBackend}. Every factory is defensive (never throws). */
export const browserAudioBackend: AudioBackend = {
  createClip(src) {
    if (typeof Audio === 'undefined') return null;
    try {
      return new Audio(src);
    } catch {
      return null;
    }
  },
  cloneClip(base) {
    try {
      return (base as unknown as HTMLAudioElement).cloneNode() as HTMLAudioElement;
    } catch {
      return null;
    }
  },
  createContext() {
    try {
      const w = globalThis as GlobalWithAudioContext;
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    } catch {
      return null;
    }
  },
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  random: () => Math.random()
};

/**
 * Sound effects (file clips with synthesized Web Audio fallback) + looping background music.
 *
 * - Sound / music toggles are persisted through the {@link SettingsStore} (SaveManager by default)
 *   and read from it on every call, so the save file is the single source of truth.
 * - Music only starts after {@link unlock} has been called from a user gesture (autoplay policy).
 * - {@link pauseAll} / {@link resumeAll} are meant for `visibilitychange`.
 * - A clip whose file fails to load is marked broken and the synth fallback is used instead.
 */
export class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private lastGrainTick = Number.NEGATIVE_INFINITY;
  private readonly clips = new Map<SfxKey, AudioClipLike>();
  private readonly brokenClips = new Set<SfxKey>();
  private bgm: AudioClipLike | null = null;
  private bgmBroken = false;
  private unlocked = false;
  private musicRequested = true;
  private suspended = false;
  private resumeMusicAfterSuspend = false;

  constructor(
    private readonly store: SettingsStore = SaveManager,
    private readonly backend: AudioBackend = browserAudioBackend
  ) {
    for (const [key, src] of Object.entries(SFX_FILES) as Array<[SfxKey, string]>) {
      const clip = backend.createClip(src);
      if (!clip) continue;
      clip.preload = 'auto';
      clip.addEventListener('error', () => this.brokenClips.add(key));
      this.clips.set(key, clip);
    }
    store.subscribe?.(() => this.syncMusic());
  }

  // ---------------------------------------------------------------- settings

  /** Enables/disables sound effects and persists the choice. */
  setSoundEnabled(enabled: boolean): void {
    this.store.updateSettings({ soundEnabled: enabled });
  }

  isSoundEnabled(): boolean {
    return this.store.getSettings().soundEnabled;
  }

  /** Enables/disables background music (persisted) and starts/stops the BGM loop accordingly. */
  setMusicEnabled(enabled: boolean): void {
    this.store.updateSettings({ musicEnabled: enabled });
    this.syncMusic();
  }

  isMusicEnabled(): boolean {
    return this.store.getSettings().musicEnabled;
  }

  // ------------------------------------------------------------------- music

  /** Requests the BGM loop (default on). It actually plays once unlocked, enabled and not paused. */
  playMusic(): void {
    this.musicRequested = true;
    this.syncMusic();
  }

  /** Stops the BGM loop until {@link playMusic} is called again (the setting is not changed). */
  stopMusic(): void {
    this.musicRequested = false;
    this.syncMusic();
  }

  /** `true` while the BGM element is actually playing. */
  isMusicPlaying(): boolean {
    return this.bgm !== null && !this.bgm.paused;
  }

  // -------------------------------------------------------------- lifecycle

  /**
   * Call from a user gesture (pointerdown/click). Creates/resumes the AudioContext and starts the
   * BGM if music is enabled. Safe to call repeatedly.
   */
  unlock(): void {
    this.unlocked = true;
    if (!this.suspended) {
      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(noop);
    }
    this.syncMusic();
  }

  /** Pauses everything (e.g. page hidden): suspends the AudioContext and pauses the BGM. */
  pauseAll(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.resumeMusicAfterSuspend = this.isMusicPlaying();
    this.bgm?.pause();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(noop);
  }

  /** Undoes {@link pauseAll}. BGM resumes only if it was playing before and music is still enabled. */
  resumeAll(): void {
    if (!this.suspended) return;
    this.suspended = false;
    if (this.unlocked && this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(noop);
    const resumeMusic = this.resumeMusicAfterSuspend;
    this.resumeMusicAfterSuspend = false;
    if (resumeMusic) this.syncMusic();
  }

  /** `true` between {@link pauseAll} and {@link resumeAll}. */
  isPaused(): boolean {
    return this.suspended;
  }

  // -------------------------------------------------------------------- sfx

  playUiClick(): void {
    if (!this.playClip('ui_click', 0.5)) {
      this.tone(720, 960, 0.06, 'sine', 0.05);
    }
  }

  playScrewPop(): void {
    if (!this.playClip('tap_screw', 0.65)) {
      this.tone(680, 1120, 0.08, 'triangle', 0.07);
    }
  }

  /** Screw lands in a bucket hole; pitch rises with the hole index (0..2). */
  playScrewLand(holeIndex = 0): void {
    const idx = Number.isFinite(holeIndex) ? Math.max(0, holeIndex) : 0;
    const rate = AudioConfig.screwLandRateBase + idx * AudioConfig.screwLandRateStep;
    if (!this.playClip('match_pop', 0.55, rate)) {
      const base = 980 + idx * 140;
      this.tone(base, base * 0.78, 0.055, 'square', 0.035);
    }
  }

  playLidOpen(): void {
    if (!this.playClip('twist', 0.65)) {
      this.tone(880, 1280, 0.05, 'square', 0.04, 0);
      this.tone(1080, 1480, 0.05, 'square', 0.04, 0.08);
      this.tone(1480, 820, 0.07, 'square', 0.05, 0.22);
      this.tone(520, 1020, 0.16, 'triangle', 0.075, 0.36);
    }
  }

  /** Throttled sand-grain tick (call every suction step; extra calls are dropped). */
  playSandGrain(): void {
    const now = this.backend.now();
    if (now - this.lastGrainTick < AudioConfig.sandGrainMinIntervalMs) return;
    this.lastGrainTick = now;
    const rate = AudioConfig.sandGrainRateBase + this.backend.random() * AudioConfig.sandGrainRateSpread;
    if (!this.playClip('sand_flow', 0.24, rate)) {
      const f = 1350 + this.backend.random() * 450;
      this.tone(f, 960, 0.032, 'sine', 0.018);
    }
  }

  playBucketComplete(): void {
    if (!this.playClip('bucket_done', 0.65)) {
      this.tone(784, 1240, 0.15, 'triangle', 0.065);
    }
  }

  playBoosterExtraSlot(): void {
    if (!this.playClip('match_pop', 0.75, 1.12)) {
      this.tone(520, 880, 0.12, 'triangle', 0.07, 0);
      this.tone(880, 1320, 0.16, 'triangle', 0.07, 0.1);
    }
  }

  playBoosterHandSelect(): void {
    if (!this.playClip('ui_click', 0.6)) {
      this.tone(600, 900, 0.1, 'sine', 0.06);
    }
  }

  playBoosterHandExecute(): void {
    if (!this.playClip('punch', 0.7)) {
      this.tone(540, 1080, 0.12, 'triangle', 0.08, 0);
      this.tone(1080, 1560, 0.18, 'triangle', 0.08, 0.09);
    }
  }

  playBoosterShuffle(): void {
    if (!this.playClip('swipe', 0.75)) {
      for (let i = 0; i < 6; i++) {
        this.tone(420 + i * 110, 720 + i * 120, 0.09, 'sine', 0.05, i * 0.07);
      }
    }
  }

  playErrorBonk(): void {
    this.tone(280, 150, 0.22, 'sawtooth', 0.06);
  }

  playWin(): void {
    if (!this.playClip('win_level', 0.75)) {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        this.tone(freq, freq * 1.02, 0.28, 'triangle', 0.08, idx * 0.09);
      });
    }
  }

  playLose(): void {
    if (!this.playClip('lose_level', 0.75)) {
      this.tone(320, 160, 0.38, 'triangle', 0.07, 0);
      this.tone(240, 120, 0.42, 'triangle', 0.07, 0.18);
    }
  }

  // --------------------------------------------------------------- internals

  private canPlaySfx(): boolean {
    return !this.suspended && this.isSoundEnabled();
  }

  /**
   * Plays a file clip. Returns `true` when handled (played, or intentionally silent because sound is
   * off / paused) and `false` when the caller should fall back to a synthesized tone.
   */
  private playClip(key: SfxKey, volume = 0.55, playbackRate = 1.0): boolean {
    if (!this.canPlaySfx()) return true;
    const base = this.clips.get(key);
    if (!base || this.brokenClips.has(key)) return false;
    const voice = this.backend.cloneClip(base);
    if (!voice) return false;
    try {
      voice.volume = clamp01(volume);
      voice.playbackRate = playbackRate;
      voice.play().catch((err: unknown) => {
        // NotSupportedError = missing/undecodable file → use the synth fallback from now on.
        if (err instanceof Error && err.name === 'NotSupportedError') this.brokenClips.add(key);
      });
      return true;
    } catch {
      return false;
    }
  }

  private tone(
    f0: number,
    f1: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delaySec = 0
  ): void {
    if (!this.canPlaySfx()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(AudioConfig.minToneHz, f1), t + durationSec);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(AudioConfig.toneFadeFloor, t + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + durationSec + AudioConfig.toneStopPaddingSec);
    } catch {
      // Ignore audio errors (closed context, invalid params on exotic browsers).
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) this.ctx = this.backend.createContext();
    return this.ctx;
  }

  private ensureBgm(): AudioClipLike | null {
    if (this.bgm || this.bgmBroken) return this.bgm;
    const clip = this.backend.createClip(BGM_FILE);
    if (!clip) {
      this.bgmBroken = true;
      return null;
    }
    clip.loop = true;
    clip.preload = 'auto';
    clip.volume = AudioConfig.bgmVolume;
    clip.addEventListener('error', () => {
      this.bgmBroken = true;
    });
    this.bgm = clip;
    return clip;
  }

  /** Starts or pauses the BGM so it matches unlocked && !paused && requested && enabled. */
  private syncMusic(): void {
    const shouldPlay = this.unlocked && !this.suspended && this.musicRequested && this.isMusicEnabled();
    if (!shouldPlay) {
      if (this.bgm && !this.bgm.paused) this.bgm.pause();
      return;
    }
    const bgm = this.ensureBgm();
    if (!bgm || this.bgmBroken || !bgm.paused) return;
    try {
      // Rejection = autoplay blocked or file missing; the next unlock() retries.
      bgm.play().catch(noop);
    } catch {
      // Older browsers: play() may throw synchronously.
    }
  }
}

/** Global audio singleton (settings persisted via SaveManager). */
export const AudioManager = new AudioManagerImpl();

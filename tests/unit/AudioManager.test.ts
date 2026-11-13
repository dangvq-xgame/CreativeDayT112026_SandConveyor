import { beforeEach, describe, expect, it } from 'vitest';
import { BGM_FILE, SFX_FILES } from '../../src/config/audio.config';
import { AudioBackend, AudioClipLike, AudioManagerImpl } from '../../src/core/AudioManager';
import { FakeSettingsStore } from './helpers';

class FakeClip implements AudioClipLike {
  volume = 1;
  playbackRate = 1;
  loop = false;
  preload = '';
  paused = true;
  playCalls = 0;
  rejectWith: Error | null = null;
  private errorListeners: Array<() => void> = [];
  constructor(readonly src: string) {}
  play(): Promise<void> {
    this.playCalls++;
    this.paused = false;
    return this.rejectWith ? Promise.reject(this.rejectWith) : Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  addEventListener(_type: 'error', listener: () => void): void {
    this.errorListeners.push(listener);
  }
  fireError(): void {
    this.errorListeners.forEach((l) => l());
  }
}

class FakeAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'suspended';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  resumeCalls = 0;
  suspendCalls = 0;
  resume(): Promise<void> {
    this.resumeCalls++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  createOscillator(): unknown {
    this.oscillators++;
    const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
    return { type: 'sine', frequency: param, connect: () => {}, start: () => {}, stop: () => {} };
  }
  createGain(): unknown {
    const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
    return { gain: param, connect: () => {} };
  }
}

class FakeBackend implements AudioBackend {
  bases = new Map<string, FakeClip>();
  voices: FakeClip[] = [];
  ctx = new FakeAudioContext();
  clock = 0;
  supportsAudio = true;
  createClip(src: string): AudioClipLike | null {
    if (!this.supportsAudio) return null;
    const clip = new FakeClip(src);
    this.bases.set(src, clip);
    return clip;
  }
  cloneClip(base: AudioClipLike): AudioClipLike | null {
    const voice = new FakeClip((base as FakeClip).src);
    voice.rejectWith = (base as FakeClip).rejectWith;
    this.voices.push(voice);
    return voice;
  }
  createContext(): AudioContext | null {
    return this.ctx as unknown as AudioContext;
  }
  now(): number {
    return this.clock;
  }
  random(): number {
    return 0.5;
  }
  bgm(): FakeClip | undefined {
    return this.bases.get(BGM_FILE);
  }
}

let store: FakeSettingsStore;
let backend: FakeBackend;
let audio: AudioManagerImpl;

beforeEach(() => {
  store = new FakeSettingsStore();
  backend = new FakeBackend();
  audio = new AudioManagerImpl(store, backend);
});

describe('AudioManager — settings', () => {
  it('reads and persists the sound toggle through the settings store', () => {
    expect(audio.isSoundEnabled()).toBe(true);
    audio.setSoundEnabled(false);
    expect(store.settings.soundEnabled).toBe(false);
    expect(audio.isSoundEnabled()).toBe(false);
  });

  it('initializes from the saved settings', () => {
    const muted = new AudioManagerImpl(new FakeSettingsStore({ soundEnabled: false, musicEnabled: false }), backend);
    expect(muted.isSoundEnabled()).toBe(false);
    expect(muted.isMusicEnabled()).toBe(false);
  });

  it('preloads every SFX file', () => {
    for (const src of Object.values(SFX_FILES)) {
      expect(backend.bases.get(src)?.preload).toBe('auto');
    }
  });
});

describe('AudioManager — background music', () => {
  it('does not start BGM before a user gesture (autoplay policy)', () => {
    audio.setMusicEnabled(true);
    expect(audio.isMusicPlaying()).toBe(false);
    expect(backend.bgm()).toBeUndefined(); // not even downloaded yet
  });

  it('starts a looping BGM on unlock and toggles it with setMusicEnabled', () => {
    audio.unlock();
    const bgm = backend.bgm()!;
    expect(bgm.loop).toBe(true);
    expect(audio.isMusicPlaying()).toBe(true);
    audio.setMusicEnabled(false);
    expect(store.settings.musicEnabled).toBe(false);
    expect(audio.isMusicPlaying()).toBe(false);
    audio.setMusicEnabled(true);
    expect(audio.isMusicPlaying()).toBe(true);
    expect(bgm.playCalls).toBe(2);
  });

  it('repeated unlocks do not restart a playing BGM', () => {
    audio.unlock();
    audio.unlock();
    audio.unlock();
    expect(backend.bgm()!.playCalls).toBe(1);
  });

  it('does not play when music is disabled in the save', () => {
    const quiet = new AudioManagerImpl(new FakeSettingsStore({ musicEnabled: false }), backend);
    quiet.unlock();
    expect(quiet.isMusicPlaying()).toBe(false);
  });

  it('stopMusic / playMusic control the loop without touching the setting', () => {
    audio.unlock();
    audio.stopMusic();
    expect(audio.isMusicPlaying()).toBe(false);
    audio.unlock();
    expect(audio.isMusicPlaying()).toBe(false);
    expect(store.settings.musicEnabled).toBe(true);
    audio.playMusic();
    expect(audio.isMusicPlaying()).toBe(true);
  });

  it('follows settings changed elsewhere (store subscription)', () => {
    audio.unlock();
    store.updateSettings({ musicEnabled: false });
    expect(audio.isMusicPlaying()).toBe(false);
  });

  it('keeps working when the BGM file fails to load', () => {
    audio.unlock();
    backend.bgm()!.fireError();
    audio.setMusicEnabled(false);
    expect(() => audio.setMusicEnabled(true)).not.toThrow();
  });
});

describe('AudioManager — pauseAll / resumeAll', () => {
  it('pauses BGM + suspends the context and restores both', () => {
    audio.unlock();
    expect(backend.ctx.state).toBe('running');
    audio.pauseAll();
    expect(audio.isPaused()).toBe(true);
    expect(audio.isMusicPlaying()).toBe(false);
    expect(backend.ctx.state).toBe('suspended');
    audio.resumeAll();
    expect(audio.isPaused()).toBe(false);
    expect(audio.isMusicPlaying()).toBe(true);
    expect(backend.ctx.state).toBe('running');
  });

  it('does not start music on resume if it was not playing before', () => {
    audio.setMusicEnabled(false);
    audio.unlock();
    audio.pauseAll();
    audio.resumeAll();
    expect(audio.isMusicPlaying()).toBe(false);
  });

  it('does not restore music that was disabled while paused', () => {
    audio.unlock();
    audio.pauseAll();
    audio.setMusicEnabled(false);
    audio.resumeAll();
    expect(audio.isMusicPlaying()).toBe(false);
  });

  it('unlock while paused does not start anything', () => {
    audio.pauseAll();
    audio.unlock();
    expect(audio.isMusicPlaying()).toBe(false);
  });

  it('is idempotent', () => {
    audio.unlock();
    audio.pauseAll();
    audio.pauseAll();
    audio.resumeAll();
    audio.resumeAll();
    expect(audio.isMusicPlaying()).toBe(true);
    expect(backend.ctx.suspendCalls).toBe(1);
  });

  it('mutes SFX while paused', () => {
    audio.pauseAll();
    audio.playUiClick();
    audio.playErrorBonk();
    expect(backend.voices).toHaveLength(0);
    expect(backend.ctx.oscillators).toBe(0);
  });
});

describe('AudioManager — sound effects', () => {
  it('plays a cloned voice of the clip with clamped volume', () => {
    audio.playUiClick();
    expect(backend.voices).toHaveLength(1);
    expect(backend.voices[0].src).toBe(SFX_FILES.ui_click);
    expect(backend.voices[0].volume).toBeGreaterThanOrEqual(0);
    expect(backend.voices[0].volume).toBeLessThanOrEqual(1);
  });

  it('is silent when sound is disabled (no clip, no synth)', () => {
    audio.setSoundEnabled(false);
    audio.playWin();
    audio.playErrorBonk();
    expect(backend.voices).toHaveLength(0);
    expect(backend.ctx.oscillators).toBe(0);
  });

  it('falls back to a synthesized tone when a file fails to load (regression: missing file = silence)', () => {
    backend.bases.get(SFX_FILES.bucket_done)!.fireError();
    audio.playBucketComplete();
    expect(backend.voices).toHaveLength(0);
    expect(backend.ctx.oscillators).toBeGreaterThan(0);
  });

  it('marks a clip broken when play() rejects with NotSupportedError', async () => {
    const err = new Error('no source');
    err.name = 'NotSupportedError';
    backend.bases.get(SFX_FILES.swipe)!.rejectWith = err;
    audio.playBoosterShuffle();
    await Promise.resolve();
    await Promise.resolve();
    audio.playBoosterShuffle();
    expect(backend.voices).toHaveLength(1);
    expect(backend.ctx.oscillators).toBeGreaterThan(0);
  });

  it('uses the synth when HTML audio is unavailable', () => {
    backend.supportsAudio = false;
    const synthOnly = new AudioManagerImpl(store, backend);
    expect(() => synthOnly.playLidOpen()).not.toThrow();
    expect(backend.ctx.oscillators).toBe(4);
  });

  it('throttles sand grain ticks with the injected clock', () => {
    backend.clock = 1000;
    audio.playSandGrain();
    backend.clock = 1010;
    audio.playSandGrain();
    backend.clock = 1100;
    audio.playSandGrain();
    expect(backend.voices).toHaveLength(2);
  });

  it('raises the pitch per landed hole and tolerates invalid indexes', () => {
    audio.playScrewLand(0);
    audio.playScrewLand(2);
    audio.playScrewLand(Number.NaN);
    const [a, b, c] = backend.voices;
    expect(b.playbackRate).toBeGreaterThan(a.playbackRate);
    expect(c.playbackRate).toBe(a.playbackRate);
  });
});

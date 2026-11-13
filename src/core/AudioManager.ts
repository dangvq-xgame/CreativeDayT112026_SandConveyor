class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private lastGrainTick = 0;

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch {
      // Ignore if Web Audio is unavailable
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
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime + delaySec;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + durationSec);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + durationSec + 0.02);
    } catch {
      // Ignore audio errors
    }
  }

  playScrewPop(): void {
    this.tone(680, 1120, 0.08, 'triangle', 0.07);
  }

  playScrewLand(holeIndex = 0): void {
    const base = 980 + holeIndex * 140;
    this.tone(base, base * 0.78, 0.055, 'square', 0.035);
  }

  playLidOpen(): void {
    this.tone(880, 1280, 0.05, 'square', 0.04, 0);
    this.tone(1080, 1480, 0.05, 'square', 0.04, 0.08);
    this.tone(1480, 820, 0.07, 'square', 0.05, 0.22);
    this.tone(520, 1020, 0.16, 'triangle', 0.075, 0.36);
  }

  playSandGrain(): void {
    const now = performance.now();
    if (now - this.lastGrainTick < 28) return;
    this.lastGrainTick = now;
    const f = 1350 + Math.random() * 450;
    this.tone(f, 960, 0.032, 'sine', 0.018);
  }

  playBucketComplete(): void {
    this.tone(784, 1240, 0.15, 'triangle', 0.065);
  }

  playBoosterExtraSlot(): void {
    this.tone(520, 880, 0.12, 'triangle', 0.07, 0);
    this.tone(880, 1320, 0.16, 'triangle', 0.07, 0.1);
  }

  playBoosterHandSelect(): void {
    this.tone(600, 900, 0.1, 'sine', 0.06);
  }

  playBoosterHandExecute(): void {
    this.tone(540, 1080, 0.12, 'triangle', 0.08, 0);
    this.tone(1080, 1560, 0.18, 'triangle', 0.08, 0.09);
  }

  playBoosterShuffle(): void {
    for (let i = 0; i < 6; i++) {
      this.tone(420 + i * 110, 720 + i * 120, 0.09, 'sine', 0.05, i * 0.07);
    }
  }

  playErrorBonk(): void {
    this.tone(280, 150, 0.22, 'sawtooth', 0.06);
  }

  playWin(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.tone(freq, freq * 1.02, 0.28, 'triangle', 0.08, idx * 0.09);
    });
  }

  playLose(): void {
    this.tone(320, 160, 0.38, 'triangle', 0.07, 0);
    this.tone(240, 120, 0.42, 'triangle', 0.07, 0.18);
  }
}

export const AudioManager = new AudioManagerImpl();


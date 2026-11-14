// Note frequencies in Hz for 8-bit "Für Elise" (獻給愛麗絲)
const NOTE_FREQ: Record<string, number> = {
  E3: 164.81,
  G3s: 207.65,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  G4s: 415.3,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  D5s: 622.25,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
};

interface BgmStep {
  melody: string | null;
  bass: string | null;
  beats: number; // duration in eighth-note steps
}

// Beethoven - Für Elise (WoO 59) A & B sections arranged for 8-bit chiptune
const FUR_ELISE_SCORE: BgmStep[] = [
  // Motif 1
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5s', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5s', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'B4', bass: null, beats: 1 },
  { melody: 'D5', bass: null, beats: 1 },
  { melody: 'C5', bass: null, beats: 1 },
  { melody: 'A4', bass: 'A3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'C4', bass: 'A3', beats: 1 },
  { melody: 'E4', bass: null, beats: 1 },
  { melody: 'A4', bass: null, beats: 1 },
  { melody: 'B4', bass: 'E3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'E4', bass: 'G3s', beats: 1 },
  { melody: 'G4s', bass: null, beats: 1 },
  { melody: 'B4', bass: null, beats: 1 },
  { melody: 'C5', bass: 'A3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'E4', bass: 'A3', beats: 1 },

  // Motif 2 (ending on A4)
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5s', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5s', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'B4', bass: null, beats: 1 },
  { melody: 'D5', bass: null, beats: 1 },
  { melody: 'C5', bass: null, beats: 1 },
  { melody: 'A4', bass: 'A3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'C4', bass: 'A3', beats: 1 },
  { melody: 'E4', bass: null, beats: 1 },
  { melody: 'A4', bass: null, beats: 1 },
  { melody: 'B4', bass: 'E3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'E4', bass: 'G3s', beats: 1 },
  { melody: 'C5', bass: null, beats: 1 },
  { melody: 'B4', bass: null, beats: 1 },
  { melody: 'A4', bass: 'A3', beats: 2 },
  { melody: null, bass: 'E4', beats: 1 },

  // B Section bridge
  { melody: 'B4', bass: 'G3s', beats: 1 },
  { melody: 'C5', bass: null, beats: 1 },
  { melody: 'D5', bass: null, beats: 1 },
  { melody: 'E5', bass: 'C4', beats: 3 },
  { melody: 'G4', bass: 'G4', beats: 1 },
  { melody: 'F5', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5', bass: 'G3s', beats: 3 },
  { melody: 'F4', bass: 'G4', beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
  { melody: 'D5', bass: null, beats: 1 },
  { melody: 'C5', bass: 'A3', beats: 3 },
  { melody: 'E4', bass: 'E4', beats: 1 },
  { melody: 'D5', bass: null, beats: 1 },
  { melody: 'C5', bass: null, beats: 1 },
  { melody: 'B4', bass: 'E3', beats: 3 },
  { melody: null, bass: 'E4', beats: 1 },
  { melody: 'E4', bass: null, beats: 1 },
  { melody: 'E5', bass: null, beats: 1 },
];

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private bgmEnabled: boolean = true;

  private bgmPlaying: boolean = false;
  private bgmTimerId: number | null = null;
  private bgmStepIndex: number = 0;
  private nextNoteTime: number = 0;
  private readonly eighthNoteDuration: number = 0.235; // ~127 BPM eighth feel

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopBgm();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (!enabled) {
      this.stopBgm();
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startBgm(resetToStart: boolean = false): void {
    if (this.muted || !this.bgmEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    if (resetToStart) {
      this.bgmStepIndex = 0;
    }

    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.06;

    this.bgmTimerId = window.setInterval(() => {
      this.scheduleBgm();
    }, 40);
  }

  public stopBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  private scheduleBgm(): void {
    if (!this.bgmPlaying || !this.ctx || this.muted || !this.bgmEnabled) return;

    const lookahead = 0.14;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const step = FUR_ELISE_SCORE[this.bgmStepIndex];
      const dur = step.beats * this.eighthNoteDuration;

      if (step.melody && NOTE_FREQ[step.melody]) {
        this.scheduleBgmVoice(NOTE_FREQ[step.melody], this.nextNoteTime, dur * 0.9, 'triangle', 0.062);
      }
      if (step.bass && NOTE_FREQ[step.bass]) {
        this.scheduleBgmVoice(NOTE_FREQ[step.bass], this.nextNoteTime, dur * 0.85, 'sine', 0.04);
      }

      this.nextNoteTime += dur;
      this.bgmStepIndex = (this.bgmStepIndex + 1) % FUR_ELISE_SCORE.length;
    }
  }

  private scheduleBgmVoice(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.04, duration));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay: number = 0
  ): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playDrop(): void {
    this.playTone(520, 220, 0.11, 'triangle', 0.12);
  }

  public playLandSoft(): void {
    this.playTone(170, 95, 0.09, 'square', 0.11);
  }

  public playSlice(): void {
    this.playTone(440, 140, 0.09, 'sawtooth', 0.1);
    this.playTone(190, 90, 0.1, 'square', 0.12, 0.02);
  }

  public playPerfect(combo: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const base = scale[Math.min(combo - 1, scale.length - 1)] || 523.25;
    this.playTone(base, base, 0.09, 'square', 0.09, 0);
    this.playTone(base * 1.25, base * 1.25, 0.12, 'square', 0.09, 0.055);
  }

  public playWidthUp(): void {
    this.playTone(523.25, 523.25, 0.08, 'square', 0.09, 0);
    this.playTone(659.25, 659.25, 0.08, 'square', 0.09, 0.07);
    this.playTone(783.99, 783.99, 0.08, 'square', 0.09, 0.14);
    this.playTone(1046.5, 1046.5, 0.16, 'square', 0.1, 0.21);
  }

  public playBombDefused(): void {
    this.playTone(659.25, 659.25, 0.07, 'square', 0.09, 0);
    this.playTone(880.0, 1046.5, 0.12, 'square', 0.09, 0.06);
  }

  public playExplosion(): void {
    // 8-bit crunchy noise + low boom
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    this.playTone(140, 38, 0.34, 'sawtooth', 0.18, 0);
    this.playTone(95, 30, 0.38, 'square', 0.15, 0.03);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  public playMilestone(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const delays = [0, 0.08, 0.16, 0.24, 0.34, 0.42];
    const durs = [0.08, 0.08, 0.08, 0.1, 0.08, 0.24];
    notes.forEach((n, idx) => {
      this.playTone(n, n, durs[idx], 'square', 0.1, delays[idx]);
    });
  }

  public playMiss(): void {
    this.playTone(340, 180, 0.18, 'sawtooth', 0.12, 0);
    this.playTone(220, 95, 0.28, 'sawtooth', 0.13, 0.14);
  }

  public playUiClick(): void {
    this.playTone(660, 880, 0.045, 'square', 0.07);
  }
}

export const retroAudio = new RetroAudioEngine();

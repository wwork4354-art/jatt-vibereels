/**
 * Web Audio Procedural Sound Engine
 * Provides haptic-like UI audio feedback and synthesized musical loops for video tracks.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private currentTrackStop: (() => void) | null = null;
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.6;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.6, this.ctx.currentTime);
    }
    if (muted && this.currentTrackStop) {
      this.currentTrackStop();
      this.currentTrackStop = null;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // UI Sound: Like heart pop
  public playLikeSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.2);
    } catch {
      // AudioContext policy safe guard
    }
  }

  // UI Sound: Comment post chime
  public playCommentSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.16); // G5

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.35);
    } catch {
      // AudioContext policy safe guard
    }
  }

  // UI Sound: Live Stream Gift fanfare sound
  public playGiftSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;

      // Arpeggiated golden fanfare
      [587.33, 739.99, 880, 1174.66].forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.07);
        gain.gain.setValueAtTime(0.3, t + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t + i * 0.07);
        osc.stop(t + i * 0.07 + 0.3);
      });
    } catch {
      // safe guard
    }
  }

  // UI Sound: Live stream start
  public playLiveStartSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.09);
        gain.gain.setValueAtTime(0.25, t + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t + i * 0.09);
        osc.stop(t + i * 0.09 + 0.25);
      });
    } catch {
      // safe guard
    }
  }

  // Play a procedural musical beat loop matching the video's theme
  public playTrack(trackType: string) {
    if (this.currentTrackStop) {
      this.currentTrackStop();
      this.currentTrackStop = null;
    }

    if (this.isMuted) return;

    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;

      const ctx = this.ctx;
      const trackGain = ctx.createGain();
      trackGain.gain.value = 0.35;
      trackGain.connect(this.masterGain);

      let isRunning = true;
      let timer: number | null = null;
      let step = 0;

      // Note scales based on track
      const scales: Record<string, number[]> = {
        ambient_lofi: [220, 261.63, 293.66, 329.63, 392], // Am pentatonic
        future_bass: [261.63, 329.63, 392, 493.88, 523.25], // Cmaj7
        chill_synth: [196, 246.94, 293.66, 370, 440], // Gmaj7
        cosmic_pulse: [146.83, 174.61, 220, 261.63, 293.66], // Dm7
        tokyo_drift: [164.81, 196, 220, 246.94, 293.66], // Em pentatonic
      };

      const scale = scales[trackType] || scales.ambient_lofi;
      const bpm = trackType === 'tokyo_drift' ? 120 : trackType === 'future_bass' ? 110 : 85;
      const stepDuration = 60 / bpm / 2; // eighth notes

      const playStep = () => {
        if (!isRunning || !ctx) return;
        const now = ctx.currentTime;

        // Kick drum on 1 and 3 (step 0, 4)
        if (step % 4 === 0) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(120, now);
          kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
          kickGain.gain.setValueAtTime(0.5, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          kickOsc.connect(kickGain);
          kickGain.connect(trackGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.18);
        }

        // Snare / clap on 2 and 4 (step 2, 6)
        if (step % 8 === 4) {
          const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 1000;
          const snareGain = ctx.createGain();
          snareGain.gain.setValueAtTime(0.2, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          whiteNoise.connect(filter);
          filter.connect(snareGain);
          snareGain.connect(trackGain);
          whiteNoise.start(now);
        }

        // Melodic synth note on rhythmic pulses
        if (step % 2 === 0 || (step % 7 === 0 && Math.random() > 0.4)) {
          const noteIndex = (step * 2 + Math.floor(step / 3)) % scale.length;
          const freq = scale[noteIndex];
          const melOsc = ctx.createOscillator();
          const melGain = ctx.createGain();
          melOsc.type = 'sine';
          melOsc.frequency.setValueAtTime(freq, now);
          melGain.gain.setValueAtTime(0.18, now);
          melGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);
          melOsc.connect(melGain);
          melGain.connect(trackGain);
          melOsc.start(now);
          melOsc.stop(now + stepDuration * 1.8);
        }

        step = (step + 1) % 16;
        timer = window.setTimeout(playStep, stepDuration * 1000);
      };

      playStep();

      this.currentTrackStop = () => {
        isRunning = false;
        if (timer) clearTimeout(timer);
        try {
          trackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          setTimeout(() => {
            trackGain.disconnect();
          }, 200);
        } catch {
          // ignore
        }
      };
    } catch {
      // AudioContext policy
    }
  }

  public playCameraShutter() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.06);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // safe guard
    }
  }

  public playRecordBeep(isStart: boolean = true) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStart ? 880 : 440, t);
      if (isStart) {
        osc.frequency.setValueAtTime(1320, t + 0.08);
      }
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isStart ? 0.18 : 0.12));
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + (isStart ? 0.18 : 0.12));
    } catch {
      // safe guard
    }
  }

  public playDownloadStart() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(960, t + 0.15);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch {
      // safe guard
    }
  }

  public playDownloadComplete() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        gain.gain.setValueAtTime(0.3, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.25);
      });
    } catch {
      // safe guard
    }
  }

  public stopTrack() {
    if (this.currentTrackStop) {
      this.currentTrackStop();
      this.currentTrackStop = null;
    }
  }
}

export const soundEngine = new SoundEngine();


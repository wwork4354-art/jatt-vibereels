/**
 * Web Audio Procedural Sound Engine
 * Provides haptic-like UI audio feedback and synthesized musical/devotional loops for video & audio-visual posts.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private currentTrackStop: (() => void) | null = null;
  private previewTrackStop: (() => void) | null = null;
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.6;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
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

  private startSynthesizedLoop(
    trackType: string,
    volumeMultiplier: number,
    bypassMasterMute: boolean
  ): () => void {
    this.initContext();
    if (!this.ctx || !this.masterGain) return () => {};

    const ctx = this.ctx;
    const trackGain = ctx.createGain();
    const clampedVol = Math.max(0, Math.min(1, volumeMultiplier));
    trackGain.gain.value = 0.38 * clampedVol;

    if (bypassMasterMute) {
      trackGain.connect(ctx.destination);
    } else {
      trackGain.connect(this.masterGain);
    }

    return this.runSynthesizedLoopOnNode(ctx, trackGain, trackType);
  }

  private runSynthesizedLoopOnNode(
    ctx: AudioContext,
    trackGain: GainNode,
    trackType: string
  ): () => void {
    let isRunning = true;
    let timer: number | null = null;
    let step = 0;

    const scales: Record<string, number[]> = {
      ambient_lofi: [220, 261.63, 293.66, 329.63, 392], // Am pentatonic
      future_bass: [261.63, 329.63, 392, 493.88, 523.25], // Cmaj7
      chill_synth: [196, 246.94, 293.66, 370, 440], // Gmaj7
      cosmic_pulse: [146.83, 174.61, 220, 261.63, 293.66], // Dm7
      tokyo_drift: [164.81, 196, 220, 246.94, 293.66], // Em pentatonic
      naat_serene: [293.66, 311.13, 370.0, 392.0, 440.0, 466.16, 523.25], // D Hijaz serene
      naat_medina: [261.63, 293.66, 311.13, 392.0, 440.0, 523.25], // Warm devotional scale
      punjabi_dhol: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0], // Energetic G pentatonic
      sufi_acoustic: [220.0, 246.94, 261.63, 329.63, 349.23, 440.0], // Soulful A natural minor
      punjabi_tribute: [146.83, 164.81, 174.61, 220.0, 233.08, 293.66], // Deep Dm Phrygian-minor tumbi + 808
    };

    const isDevotional = trackType === 'naat_serene' || trackType === 'naat_medina';
    const isSufi = trackType === 'sufi_acoustic';
    const isPunjabi = trackType === 'punjabi_dhol';
    const isTribute = trackType === 'punjabi_tribute';

    const scale = scales[trackType] || scales.ambient_lofi;
    const bpm = isPunjabi
      ? 128
      : isTribute
      ? 92
      : trackType === 'tokyo_drift'
      ? 120
      : trackType === 'future_bass'
      ? 110
      : isDevotional
      ? 68
      : isSufi
      ? 78
      : 85;
    const stepDuration = 60 / bpm / 2;

    const playStep = () => {
      if (!isRunning || !ctx) return;
      const now = ctx.currentTime;

      if (isDevotional || isSufi) {
        // Gentle sustained warm drone root every 8 steps
        if (step % 8 === 0) {
          const droneOsc = ctx.createOscillator();
          const droneGain = ctx.createGain();
          droneOsc.type = 'sine';
          droneOsc.frequency.setValueAtTime(scale[0] / 2, now);
          droneGain.gain.setValueAtTime(0.01, now);
          droneGain.gain.linearRampToValueAtTime(0.14, now + 0.25);
          droneGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 7.5);
          droneOsc.connect(droneGain);
          droneGain.connect(trackGain);
          droneOsc.start(now);
          droneOsc.stop(now + stepDuration * 7.5);
        }

        // Expressive devotional chime / vocal-like triangle-sine phrase
        if (step % 2 === 0 || step % 5 === 0) {
          const idx = (step + Math.floor(step / 4)) % scale.length;
          const freq = scale[idx];
          const melOsc = ctx.createOscillator();
          const overOsc = ctx.createOscillator();
          const melGain = ctx.createGain();

          melOsc.type = 'sine';
          melOsc.frequency.setValueAtTime(freq, now);
          overOsc.type = 'triangle';
          overOsc.frequency.setValueAtTime(freq * 2, now);

          const overGain = ctx.createGain();
          overGain.gain.setValueAtTime(0.05, now);

          melGain.gain.setValueAtTime(0.01, now);
          melGain.gain.linearRampToValueAtTime(0.22, now + 0.06);
          melGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 2.6);

          melOsc.connect(melGain);
          overOsc.connect(overGain);
          overGain.connect(melGain);
          melGain.connect(trackGain);

          melOsc.start(now);
          overOsc.start(now);
          melOsc.stop(now + stepDuration * 2.6);
          overOsc.stop(now + stepDuration * 2.6);
        }
      } else {
        // Kick drum on 1 and 3 (or heavier syncopation for Punjabi Dhol / 808 Tribute)
        if (step % 4 === 0 || (isPunjabi && step % 8 === 6) || (isTribute && step % 16 === 10)) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(isTribute ? 110 : isPunjabi ? 145 : 120, now);
          kickOsc.frequency.exponentialRampToValueAtTime(
            isTribute ? 32 : isPunjabi ? 48 : 35,
            now + (isTribute ? 0.28 : 0.16)
          );
          kickGain.gain.setValueAtTime(isTribute ? 0.65 : isPunjabi ? 0.58 : 0.5, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + (isTribute ? 0.34 : 0.19));
          kickOsc.connect(kickGain);
          kickGain.connect(trackGain);
          kickOsc.start(now);
          kickOsc.stop(now + (isTribute ? 0.34 : 0.19));
        }

        // Snare / clap on 2 and 4
        if (step % 8 === 4 || (isPunjabi && step % 8 === 2) || (isTribute && step % 4 === 2)) {
          const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = isTribute && step % 8 !== 4 ? 4200 : 1000;
          const snareGain = ctx.createGain();
          snareGain.gain.setValueAtTime(isTribute && step % 8 !== 4 ? 0.08 : 0.2, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          whiteNoise.connect(filter);
          filter.connect(snareGain);
          snareGain.connect(trackGain);
          whiteNoise.start(now);
        }

        // Melodic synth note / emotional tumbi pluck on rhythmic pulses
        if (step % 2 === 0 || isTribute || (step % 7 === 0 && Math.random() > 0.4)) {
          const tributePattern = [0, 3, 2, 1, 0, 4, 3, 2];
          const noteIndex = isTribute
            ? tributePattern[step % tributePattern.length] % scale.length
            : (step * 2 + Math.floor(step / 3)) % scale.length;
          const freq = scale[noteIndex] * (isTribute ? 2 : 1);
          const melOsc = ctx.createOscillator();
          const melGain = ctx.createGain();
          melOsc.type = isTribute ? 'sawtooth' : isPunjabi ? 'triangle' : 'sine';
          if (isTribute) {
            const pluckFilter = ctx.createBiquadFilter();
            pluckFilter.type = 'lowpass';
            pluckFilter.frequency.setValueAtTime(1850, now);
            pluckFilter.frequency.exponentialRampToValueAtTime(420, now + stepDuration * 1.4);
            melOsc.frequency.setValueAtTime(freq, now);
            melGain.gain.setValueAtTime(0.16, now);
            melGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.45);
            melOsc.connect(pluckFilter);
            pluckFilter.connect(melGain);
            melGain.connect(trackGain);
          } else {
            melOsc.frequency.setValueAtTime(freq, now);
            melGain.gain.setValueAtTime(0.18, now);
            melGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);
            melOsc.connect(melGain);
            melGain.connect(trackGain);
          }
          melOsc.start(now);
          melOsc.stop(now + stepDuration * 1.8);
        }
      }

      step = (step + 1) % 16;
      timer = window.setTimeout(playStep, stepDuration * 1000);
    };

    playStep();

    return () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
      try {
        trackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        setTimeout(() => {
          trackGain.disconnect();
        }, 160);
      } catch {
        // ignore
      }
    };
  }

  // Play a procedural musical beat loop matching the video's theme
  public playTrack(trackType: string, volumeMultiplier: number = 1) {
    if (this.currentTrackStop) {
      this.currentTrackStop();
      this.currentTrackStop = null;
    }

    if (this.isMuted || volumeMultiplier <= 0.01) return;

    try {
      this.currentTrackStop = this.startSynthesizedLoop(trackType, volumeMultiplier, false);
    } catch {
      // AudioContext policy
    }
  }

  // Preview a Song / Naat / Beat in UploadModal regardless of feed mute state
  public playPreviewTrack(trackType: string, volumeMultiplier: number = 0.8) {
    this.stopPreviewTrack();
    try {
      this.previewTrackStop = this.startSynthesizedLoop(trackType, volumeMultiplier, true);
    } catch {
      // AudioContext policy
    }
  }

  public stopPreviewTrack() {
    if (this.previewTrackStop) {
      this.previewTrackStop();
      this.previewTrackStop = null;
    }
  }

  /**
   * Creates an isolated Web Audio stream for MediaRecorder template video export
   * so built-in beats and songs are baked into saved/published video files.
   */
  public createExportAudioStream(
    trackType: string,
    volumeMultiplier: number = 0.85,
    fadeOptions?: { fadeInSec?: number; fadeOutSec?: number; totalDurationSec?: number }
  ): { stream: MediaStream; stop: () => void } | null {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const exportCtx = new AudioContextClass();
      const dest = exportCtx.createMediaStreamDestination();
      const exportGain = exportCtx.createGain();
      const targetGain = Math.max(0.001, 0.42 * Math.max(0, Math.min(1, volumeMultiplier)));
      const now = exportCtx.currentTime;
      const fadeIn = Math.max(0, fadeOptions?.fadeInSec || 0);
      const fadeOut = Math.max(0, fadeOptions?.fadeOutSec || 0);
      const totalDur = Math.max(0.5, fadeOptions?.totalDurationSec || 0);

      if (fadeIn > 0.05) {
        exportGain.gain.setValueAtTime(0.001, now);
        exportGain.gain.linearRampToValueAtTime(targetGain, now + fadeIn);
      } else {
        exportGain.gain.setValueAtTime(targetGain, now);
      }

      if (fadeOut > 0.05 && totalDur > fadeOut + 0.1) {
        const fadeOutStart = now + Math.max(fadeIn, totalDur - fadeOut);
        exportGain.gain.setValueAtTime(targetGain, fadeOutStart);
        exportGain.gain.linearRampToValueAtTime(0.001, now + totalDur);
      }

      exportGain.connect(dest);

      const stopLoop = this.runSynthesizedLoopOnNode(exportCtx, exportGain, trackType);

      return {
        stream: dest.stream,
        stop: () => {
          stopLoop();
          void exportCtx.close().catch(() => {});
        },
      };
    } catch {
      return null;
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

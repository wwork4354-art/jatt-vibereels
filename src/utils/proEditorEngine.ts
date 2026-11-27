export type ProFilterLutId =
  | 'original'
  | 'cinematic'
  | 'warm_golden'
  | 'cool_ice'
  | 'moody_dark'
  | 'vibrant'
  | 'vintage'
  | 'neon_cyber'
  | 'bw_noir';

export interface ProFilterLut {
  id: ProFilterLutId;
  label: string;
  brightness: number; // baseline 100
  contrast: number;   // baseline 100
  saturate: number;   // baseline 100
  hueRotate: number;  // baseline 0 deg
  sepia: number;      // baseline 0 %
  grayscale: number;  // baseline 0 %
  tintRgba: string;   // optional tonal LUT overlay color
  tintAlpha: number;  // max overlay alpha at 100% intensity
  vignette: number;   // 0..1 baseline vignette
  swatchGradient: string;
}

export type ClipTransitionType = 'none' | 'fade' | 'zoom_punch' | 'glitch' | 'swipe';

export type SpeedCurvePresetId = 'linear' | 'bullet_ramp' | 'hero_slow' | 'jump_cut';

export type TextAnimationStyle = 'none' | 'pop' | 'neon_pulse' | 'slide_up' | 'typewriter' | 'float';

export type TextFontStyleId = 'modern' | 'impact' | 'editorial' | 'cyber' | 'script';

export type VisualEffectType =
  | 'none'
  | 'glitch'
  | 'blur'
  | 'neon_glow'
  | 'vhs'
  | 'shake'
  | 'sparkle'
  | 'vignette';

export interface VisualEffectConfig {
  type: VisualEffectType;
  intensity: number; // 0..100
}

export type BgRemovalMode = 'off' | 'chroma_green' | 'person_cutout';
export type BgReplaceMode = 'dark' | 'color' | 'blur' | 'image';

export interface BgRemovalConfig {
  mode: BgRemovalMode;
  keyColor: string; // hex e.g. #00ff00
  tolerance: number; // 10..90
  feather: number; // 0..30
  replaceMode: BgReplaceMode;
  replaceColor: string;
  replaceImageSourceId?: string | null;
}

export const DEFAULT_BG_REMOVAL_CONFIG: BgRemovalConfig = {
  mode: 'off',
  keyColor: '#00d24d',
  tolerance: 42,
  feather: 8,
  replaceMode: 'dark',
  replaceColor: '#0f172a',
  replaceImageSourceId: null,
};

export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  style: 'clean_pill' | 'karaoke_glow' | 'bold_cinema';
  yPercent: number;
}

export interface TickerConfig {
  enabled: boolean;
  text: string;
  position: 'top' | 'bottom';
  speed: number; // 1..5
  textColor: string;
  bgColor: string;
}

export const DEFAULT_TICKER_CONFIG: TickerConfig = {
  enabled: false,
  text: 'BREAKING VIBES  ★  SUBSCRIBE & FOLLOW FOR DAILY REELS  ★  JATT VIBEREELS PRO  ★  ',
  position: 'bottom',
  speed: 2.2,
  textColor: '#ffffff',
  bgColor: '#e11d48',
};

export type CropAspectPreset = '9:16' | '16:9' | '1:1' | 'freeform';

export interface CropConfig {
  aspect: CropAspectPreset;
  zoom: number; // 1..3
  panXPercent: number; // -50..50
  panYPercent: number; // -50..50
  freeRect: {
    x: number; // 0..45
    y: number; // 0..45
    w: number; // 25..100
    h: number; // 25..100
  };
}

export const DEFAULT_CROP_CONFIG: CropConfig = {
  aspect: '9:16',
  zoom: 1,
  panXPercent: 0,
  panYPercent: 0,
  freeRect: { x: 8, y: 12, w: 84, h: 76 },
};

export type ClipAnimPreset =
  | 'none'
  | 'fade'
  | 'slide_up'
  | 'slide_down'
  | 'zoom_in'
  | 'zoom_out'
  | 'pop'
  | 'spin';

export interface AnimationConfig {
  inAnim: ClipAnimPreset;
  outAnim: ClipAnimPreset;
  comboAnim: ClipAnimPreset;
  durationSec: number; // 0.3..2.0
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  inAnim: 'none',
  outAnim: 'none',
  comboAnim: 'none',
  durationSec: 0.7,
};

export interface KeyframeMarker {
  id: string;
  target: 'main' | 'text' | 'overlay';
  timeSec: number;
  xPercent: number; // 0..100 (50 = center)
  yPercent: number; // 0..100 (50 = center)
  scale: number; // 0.3..3.0 (1 = normal)
  rotationDeg: number; // -180..180
  opacity: number; // 0..100
}

export interface EnhanceConfig {
  enabled: boolean;
  sharpness: number; // 0..100
  clarity: number; // 0..100
}

export const DEFAULT_ENHANCE_CONFIG: EnhanceConfig = {
  enabled: false,
  sharpness: 65,
  clarity: 30,
};

export type EditorMaskShape =
  | 'none'
  | 'diamond'
  | 'circle'
  | 'heart'
  | 'star'
  | 'split'
  | 'rectangle';

export interface EditorMaskConfig {
  shape: EditorMaskShape;
  sizePercent: number; // 15..140
  xPercent: number; // 10..90
  yPercent: number; // 10..90
  rotationDeg: number; // -180..180
  featherPx: number; // 0..40
  invert: boolean;
}

export const DEFAULT_MASK_CONFIG: EditorMaskConfig = {
  shape: 'none',
  sizePercent: 72,
  xPercent: 50,
  yPercent: 50,
  rotationDeg: 0,
  featherPx: 8,
  invert: false,
};

export interface EditorOverlayLayer {
  id: string;
  sourceId: string;
  name: string;
  mediaType: 'video' | 'image';
  url: string;
  file: File;
  naturalDuration: number;
  xPercent: number; // 8..92
  yPercent: number; // 8..92
  scale: number; // 0.2..2.0 (relative to stage width 45%)
  rotationDeg: number; // -180..180
  opacity: number; // 0..100
  startTime: number;
  endTime: number;
  mask: EditorMaskConfig;
}

export interface TimelineClipItem {
  id: string;
  sourceId: string;
  name: string;
  mediaType: 'video' | 'image';
  url: string;
  file: File;
  naturalDuration: number; // full source length (for images default e.g. 10s max, initial 4s)
  trimStart: number;
  trimEnd: number;
  speed: number; // 0.25..4.0
  speedCurve: SpeedCurvePresetId;
  transitionAfter: ClipTransitionType;
  transitionDuration: number; // seconds e.g. 0.45
  photoFit: 'contain' | 'cover';
}

export interface EditorTextLayer {
  id?: string;
  text: string;
  fontId: TextFontStyleId;
  color: string;
  size: number; // 16..64
  xPercent: number; // 8..92
  yPercent: number; // 8..92
  rotationDeg?: number; // -180..180
  neonGlow: boolean;
  outline: boolean;
  backdrop: boolean;
  animation: TextAnimationStyle;
  animConfig?: AnimationConfig;
}

export interface EditorStickerLayer {
  id: string;
  emoji: string;
  xPercent: number;
  yPercent: number;
  size: number;
}

export interface TimelineRenderOptions {
  filterLut: ProFilterLut;
  lutIntensity: number; // 0..100
  brightnessAdj: number; // -40..+40
  contrastAdj: number; // -40..+40
  saturateAdj: number; // -60..+60
  vignetteAdj: number; // 0..100
  mainMask?: EditorMaskConfig;
  overlays?: EditorOverlayLayer[];
  textLayer: EditorTextLayer;
  textLayers?: EditorTextLayer[];
  stickers: EditorStickerLayer[];
  visualEffect?: VisualEffectConfig;
  bgRemoval?: BgRemovalConfig;
  captions?: SubtitleSegment[];
  ticker?: TickerConfig;
  crop?: CropConfig;
  clipAnimation?: AnimationConfig;
  keyframes?: KeyframeMarker[];
  enhance?: EnhanceConfig;
}

export interface ComputedClipSpan {
  clip: TimelineClipItem;
  index: number;
  timelineStart: number;
  timelineEnd: number;
  effectiveDuration: number;
}

export const PRO_FILTER_LUTS: ProFilterLut[] = [
  {
    id: 'original',
    label: 'Original',
    brightness: 100,
    contrast: 100,
    saturate: 100,
    hueRotate: 0,
    sepia: 0,
    grayscale: 0,
    tintRgba: 'rgba(0,0,0,0)',
    tintAlpha: 0,
    vignette: 0,
    swatchGradient: 'from-neutral-700 to-neutral-900',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    brightness: 98,
    contrast: 122,
    saturate: 108,
    hueRotate: -6,
    sepia: 8,
    grayscale: 0,
    tintRgba: 'rgb(14, 116, 144)',
    tintAlpha: 0.14,
    vignette: 0.35,
    swatchGradient: 'from-cyan-700 via-slate-800 to-amber-700',
  },
  {
    id: 'warm_golden',
    label: 'Warm',
    brightness: 107,
    contrast: 112,
    saturate: 130,
    hueRotate: -8,
    sepia: 22,
    grayscale: 0,
    tintRgba: 'rgb(245, 158, 11)',
    tintAlpha: 0.16,
    vignette: 0.22,
    swatchGradient: 'from-amber-500 via-orange-500 to-rose-600',
  },
  {
    id: 'cool_ice',
    label: 'Cool',
    brightness: 102,
    contrast: 114,
    saturate: 112,
    hueRotate: 10,
    sepia: 0,
    grayscale: 0,
    tintRgba: 'rgb(56, 189, 248)',
    tintAlpha: 0.16,
    vignette: 0.18,
    swatchGradient: 'from-sky-500 via-blue-700 to-indigo-900',
  },
  {
    id: 'vibrant',
    label: 'Vivid',
    brightness: 106,
    contrast: 118,
    saturate: 155,
    hueRotate: 0,
    sepia: 0,
    grayscale: 0,
    tintRgba: 'rgb(236, 72, 153)',
    tintAlpha: 0.08,
    vignette: 0.12,
    swatchGradient: 'from-pink-500 via-rose-500 to-amber-400',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    brightness: 97,
    contrast: 96,
    saturate: 76,
    hueRotate: -4,
    sepia: 46,
    grayscale: 0,
    tintRgba: 'rgb(180, 130, 70)',
    tintAlpha: 0.15,
    vignette: 0.42,
    swatchGradient: 'from-amber-800 via-stone-700 to-neutral-900',
  },
  {
    id: 'bw_noir',
    label: 'B&W',
    brightness: 100,
    contrast: 136,
    saturate: 0,
    hueRotate: 0,
    sepia: 0,
    grayscale: 100,
    tintRgba: 'rgb(0, 0, 0)',
    tintAlpha: 0.05,
    vignette: 0.45,
    swatchGradient: 'from-neutral-400 via-neutral-700 to-black',
  },
  {
    id: 'moody_dark',
    label: 'Moody',
    brightness: 88,
    contrast: 134,
    saturate: 82,
    hueRotate: 4,
    sepia: 10,
    grayscale: 0,
    tintRgba: 'rgb(30, 27, 75)',
    tintAlpha: 0.22,
    vignette: 0.55,
    swatchGradient: 'from-slate-900 via-indigo-950 to-neutral-950',
  },
  {
    id: 'neon_cyber',
    label: 'Neon Cyber',
    brightness: 104,
    contrast: 128,
    saturate: 152,
    hueRotate: 14,
    sepia: 0,
    grayscale: 0,
    tintRgba: 'rgb(168, 85, 247)',
    tintAlpha: 0.14,
    vignette: 0.3,
    swatchGradient: 'from-cyan-500 via-purple-600 to-pink-500',
  },
];

export const VISUAL_EFFECT_PRESETS: {
  id: VisualEffectType;
  label: string;
  desc: string;
}[] = [
  { id: 'none', label: 'None', desc: 'Clean image' },
  { id: 'glitch', label: 'Glitch', desc: 'RGB cyber split' },
  { id: 'blur', label: 'Soft Blur', desc: 'Dreamy haze lens' },
  { id: 'neon_glow', label: 'Neon Glow', desc: 'Luminous halo' },
  { id: 'vhs', label: 'VHS', desc: 'Retro tape scan' },
  { id: 'shake', label: 'Shake', desc: 'Beat camera shake' },
  { id: 'sparkle', label: 'Sparkle', desc: 'Twinkle stars' },
  { id: 'vignette', label: 'Vignette', desc: 'Dramatic frame' },
];

export const TEXT_FONT_STYLES: {
  id: TextFontStyleId;
  label: string;
  fontFamily: string;
  weight: string;
}[] = [
  { id: 'modern', label: 'Modern Bold', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', weight: '900' },
  { id: 'impact', label: 'Headline', fontFamily: 'Impact, "Arial Black", sans-serif', weight: '900' },
  { id: 'editorial', label: 'Editorial', fontFamily: 'Georgia, "Times New Roman", serif', weight: '700' },
  { id: 'cyber', label: 'Cyber Mono', fontFamily: '"JetBrains Mono", ui-monospace, monospace', weight: '800' },
  { id: 'script', label: 'Signature', fontFamily: '"Brush Script MT", cursive, sans-serif', weight: '700' },
];

export const SPEED_CURVE_PRESETS: {
  id: SpeedCurvePresetId;
  label: string;
  points: [number, number, number, number, number];
}[] = [
  { id: 'linear', label: 'Constant', points: [1, 1, 1, 1, 1] },
  { id: 'bullet_ramp', label: 'Bullet Ramp', points: [1.5, 1.3, 0.55, 1.25, 1.6] },
  { id: 'hero_slow', label: 'Hero Slow-Dip', points: [1.35, 0.6, 0.5, 0.65, 1.4] },
  { id: 'jump_cut', label: 'Flash Surge', points: [0.7, 1.5, 1.6, 0.65, 1.45] },
];

export function getStageDimensions(
  aspect: CropAspectPreset,
  mode: 'preview' | '1080p' | '4k'
): { width: number; height: number } {
  if (mode === 'preview') {
    if (aspect === '16:9') return { width: 640, height: 360 };
    if (aspect === '1:1') return { width: 480, height: 480 };
    return { width: 360, height: 640 };
  }
  const is4k = mode === '4k';
  if (aspect === '16:9') {
    return is4k ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };
  }
  if (aspect === '1:1') {
    return is4k ? { width: 2160, height: 2160 } : { width: 1080, height: 1080 };
  }
  return is4k ? { width: 2160, height: 3840 } : { width: 1080, height: 1920 };
}

export function evaluateSpeedMultiplierAtProgress(
  baseSpeed: number,
  curve: SpeedCurvePresetId,
  progress01: number
): number {
  const p = Math.max(0, Math.min(1, progress01));
  let factor = 1;
  if (curve === 'bullet_ramp') {
    factor = 1 + 0.45 * Math.cos(p * Math.PI * 2);
  } else if (curve === 'hero_slow') {
    const dip = Math.sin(p * Math.PI);
    factor = 1.35 - 0.8 * dip;
  } else if (curve === 'jump_cut') {
    factor = 1 + 0.48 * Math.sin(p * Math.PI * 2);
  }
  return Math.max(0.25, Math.min(4.0, baseSpeed * factor));
}

export function getClipEffectiveDuration(clip: TimelineClipItem): number {
  const sourceLen = Math.max(0.25, clip.trimEnd - clip.trimStart);
  const safeSpeed = Math.max(0.25, clip.speed);
  return Math.max(0.25, sourceLen / safeSpeed);
}

export function computeTimelineSpans(clips: TimelineClipItem[]): {
  spans: ComputedClipSpan[];
  totalDuration: number;
} {
  const spans: ComputedClipSpan[] = [];
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const effectiveDuration = getClipEffectiveDuration(clip);
    spans.push({
      clip,
      index: i,
      timelineStart: cursor,
      timelineEnd: cursor + effectiveDuration,
      effectiveDuration,
    });
    cursor += effectiveDuration;
  }
  return { spans, totalDuration: cursor };
}

export function mapClipProgressToSourceTime(
  clip: TimelineClipItem,
  progress01: number
): number {
  const clamped = Math.max(0, Math.min(1, progress01));
  const span = Math.max(0.1, clip.trimEnd - clip.trimStart);
  let warped = clamped;
  if (clip.speedCurve === 'hero_slow') {
    warped = clamped - 0.08 * Math.sin(clamped * Math.PI * 2);
  } else if (clip.speedCurve === 'bullet_ramp') {
    warped = clamped + 0.07 * Math.sin(clamped * Math.PI * 2);
  } else if (clip.speedCurve === 'jump_cut') {
    warped = clamped - 0.06 * (1 - Math.cos(clamped * Math.PI * 2));
  }
  warped = Math.max(0, Math.min(1, warped));
  return clip.trimStart + warped * span;
}

export function buildBlendedCssFilter(options: TimelineRenderOptions): string {
  const lut = options.filterLut;
  const k = Math.max(0, Math.min(1, options.lutIntensity / 100));
  const enhanceClarity = options.enhance?.enabled ? (options.enhance.clarity / 100) * 18 : 0;
  const enhanceBright = options.enhance?.enabled ? (options.enhance.sharpness / 100) * 4 : 0;
  const b = 100 + (lut.brightness - 100) * k + options.brightnessAdj + enhanceBright;
  const c = 100 + (lut.contrast - 100) * k + options.contrastAdj + enhanceClarity;
  const s = Math.max(0, 100 + (lut.saturate - 100) * k + options.saturateAdj + enhanceClarity * 0.4);
  const h = lut.hueRotate * k;
  const sep = lut.sepia * k;
  const gs = lut.grayscale * k;
  const blurPx =
    options.visualEffect?.type === 'blur'
      ? ((options.visualEffect.intensity / 100) * 7).toFixed(1)
      : '0';
  return `brightness(${Math.round(b)}%) contrast(${Math.round(c)}%) saturate(${Math.round(
    s
  )}%) hue-rotate(${h.toFixed(1)}deg) sepia(${Math.round(sep)}%) grayscale(${Math.round(gs)}%)${
    Number(blurPx) > 0 ? ` blur(${blurPx}px)` : ''
  }`;
}

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - c, 3);
}

function easeInOutSine(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return -(Math.cos(Math.PI * c) - 1) / 2;
}

export function interpolateKeyframesAtTime(
  keyframes: KeyframeMarker[] | undefined,
  target: 'main' | 'text' | 'overlay',
  timeSec: number
): {
  active: boolean;
  xPercent: number;
  yPercent: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
} {
  const list = (keyframes || [])
    .filter((k) => k.target === target)
    .sort((a, b) => a.timeSec - b.timeSec);
  if (list.length === 0) {
    return { active: false, xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0, opacity: 100 };
  }
  if (timeSec <= list[0].timeSec) {
    const f = list[0];
    return {
      active: true,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      scale: f.scale,
      rotationDeg: f.rotationDeg,
      opacity: f.opacity,
    };
  }
  const last = list[list.length - 1];
  if (timeSec >= last.timeSec) {
    return {
      active: true,
      xPercent: last.xPercent,
      yPercent: last.yPercent,
      scale: last.scale,
      rotationDeg: last.rotationDeg,
      opacity: last.opacity,
    };
  }
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (timeSec >= a.timeSec && timeSec <= b.timeSec) {
      const span = Math.max(0.001, b.timeSec - a.timeSec);
      const t = easeInOutSine((timeSec - a.timeSec) / span);
      return {
        active: true,
        xPercent: a.xPercent + (b.xPercent - a.xPercent) * t,
        yPercent: a.yPercent + (b.yPercent - a.yPercent) * t,
        scale: a.scale + (b.scale - a.scale) * t,
        rotationDeg: a.rotationDeg + (b.rotationDeg - a.rotationDeg) * t,
        opacity: a.opacity + (b.opacity - a.opacity) * t,
      };
    }
  }
  return { active: false, xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0, opacity: 100 };
}

function evaluateAnimTransform(
  animConfig: AnimationConfig | undefined,
  localTime: number,
  totalDur: number,
  w: number,
  h: number
): { scale: number; offsetX: number; offsetY: number; rotDeg: number; alpha: number } {
  const res = { scale: 1, offsetX: 0, offsetY: 0, rotDeg: 0, alpha: 1 };
  if (!animConfig) return res;
  const dur = Math.max(0.2, Math.min(totalDur * 0.65, animConfig.durationSec || 0.7));

  const applyPreset = (preset: ClipAnimPreset, p01: number, isOut: boolean) => {
    const p = isOut ? 1 - easeOutCubic(p01) : easeOutCubic(p01);
    switch (preset) {
      case 'fade':
        res.alpha *= p;
        break;
      case 'slide_up':
        res.offsetY += (1 - p) * h * 0.25 * (isOut ? -1 : 1);
        res.alpha *= Math.min(1, p * 1.4);
        break;
      case 'slide_down':
        res.offsetY -= (1 - p) * h * 0.25 * (isOut ? -1 : 1);
        res.alpha *= Math.min(1, p * 1.4);
        break;
      case 'zoom_in':
        res.scale *= isOut ? 1 + (1 - p) * 0.35 : 0.72 + p * 0.28;
        res.alpha *= Math.min(1, p * 1.3);
        break;
      case 'zoom_out':
        res.scale *= isOut ? 1 - (1 - p) * 0.32 : 1.35 - p * 0.35;
        res.alpha *= Math.min(1, p * 1.3);
        break;
      case 'pop':
        res.scale *= isOut ? p : p < 0.7 ? 0.55 + (p / 0.7) * 0.57 : 1.12 - ((p - 0.7) / 0.3) * 0.12;
        res.alpha *= Math.min(1, p * 1.8);
        break;
      case 'spin':
        res.rotDeg += (1 - p) * 180 * (isOut ? 1 : -1);
        res.scale *= 0.65 + p * 0.35;
        res.alpha *= Math.min(1, p * 1.5);
        break;
      default:
        break;
    }
  };

  if (animConfig.inAnim !== 'none' && localTime < dur) {
    applyPreset(animConfig.inAnim, localTime / dur, false);
  }
  const timeFromEnd = Math.max(0, totalDur - localTime);
  if (animConfig.outAnim !== 'none' && timeFromEnd < dur) {
    applyPreset(animConfig.outAnim, 1 - timeFromEnd / dur, true);
  }
  if (animConfig.comboAnim !== 'none') {
    const cycle = (localTime % Math.max(0.8, dur * 2)) / Math.max(0.8, dur * 2);
    if (animConfig.comboAnim === 'pop') {
      res.scale *= 1 + 0.05 * Math.sin(cycle * Math.PI * 2);
    } else if (animConfig.comboAnim === 'spin') {
      res.rotDeg += Math.sin(cycle * Math.PI * 2) * 8;
    } else if (animConfig.comboAnim === 'zoom_in') {
      res.scale *= 1 + 0.08 * cycle;
    } else if (animConfig.comboAnim === 'slide_up') {
      res.offsetY += Math.sin(cycle * Math.PI * 2) * (h * 0.025);
    } else if (animConfig.comboAnim === 'fade') {
      res.alpha *= 0.85 + 0.15 * Math.cos(cycle * Math.PI * 2);
    }
  }
  void w;
  return res;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 0, g: 210, b: 77 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function drawMediaFit(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  fitMode: 'contain' | 'cover',
  scale = 1,
  offsetX = 0,
  offsetY = 0
) {
  if (!srcW || !srcH) return;
  const srcRatio = srcW / srcH;
  const destRatio = destW / destH;
  let drawW = destW;
  let drawH = destH;

  if (fitMode === 'cover') {
    if (srcRatio > destRatio) {
      drawH = destH * scale;
      drawW = drawH * srcRatio;
    } else {
      drawW = destW * scale;
      drawH = drawW / srcRatio;
    }
  } else {
    if (srcRatio > destRatio) {
      drawW = destW * scale;
      drawH = drawW / srcRatio;
    } else {
      drawH = destH * scale;
      drawW = drawH * srcRatio;
    }
  }

  const dx = (destW - drawW) / 2 + offsetX;
  const dy = (destH - drawH) / 2 + offsetY;
  ctx.drawImage(media, dx, dy, drawW, drawH);
}

// Reusable scratch canvases for buttery 60fps feathered shape masking & background matting
let cachedScratchLayer: HTMLCanvasElement | null = null;
let cachedScratchMask: HTMLCanvasElement | null = null;
let cachedMatteSmall: HTMLCanvasElement | null = null;

function getMaskScratchCanvases(w: number, h: number): {
  layerCanvas: HTMLCanvasElement;
  layerCtx: CanvasRenderingContext2D;
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
} | null {
  if (typeof document === 'undefined') return null;
  if (!cachedScratchLayer) cachedScratchLayer = document.createElement('canvas');
  if (!cachedScratchMask) cachedScratchMask = document.createElement('canvas');

  if (cachedScratchLayer.width !== w || cachedScratchLayer.height !== h) {
    cachedScratchLayer.width = w;
    cachedScratchLayer.height = h;
  }
  if (cachedScratchMask.width !== w || cachedScratchMask.height !== h) {
    cachedScratchMask.width = w;
    cachedScratchMask.height = h;
  }
  const layerCtx = cachedScratchLayer.getContext('2d');
  const maskCtx = cachedScratchMask.getContext('2d');
  if (!layerCtx || !maskCtx) return null;
  return {
    layerCanvas: cachedScratchLayer,
    layerCtx,
    maskCanvas: cachedScratchMask,
    maskCtx,
  };
}

function applyBgRemovalMatte(
  layerCanvas: HTMLCanvasElement,
  layerCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cfg: BgRemovalConfig
) {
  if (cfg.mode === 'off' || typeof document === 'undefined') return;
  if (!cachedMatteSmall) cachedMatteSmall = document.createElement('canvas');

  // Downsample matte computation cleanly to max ~180px wide so mobile stays 60fps
  const mW = Math.max(90, Math.min(200, Math.round(w * 0.45)));
  const mH = Math.max(90, Math.round((mW / w) * h));
  if (cachedMatteSmall.width !== mW || cachedMatteSmall.height !== mH) {
    cachedMatteSmall.width = mW;
    cachedMatteSmall.height = mH;
  }
  const mCtx = cachedMatteSmall.getContext('2d', { willReadFrequently: true });
  if (!mCtx) return;

  mCtx.clearRect(0, 0, mW, mH);
  mCtx.drawImage(layerCanvas, 0, 0, mW, mH);

  let imgData: ImageData;
  try {
    imgData = mCtx.getImageData(0, 0, mW, mH);
  } catch {
    return;
  }
  const d = imgData.data;

  if (cfg.mode === 'chroma_green') {
    const key = hexToRgb(cfg.keyColor);
    const maxDist = Math.max(18, (cfg.tolerance / 100) * 260);
    const softBand = Math.max(8, (cfg.feather / 30) * 55 + 18);

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const dist = Math.hypot(r - key.r, g - key.g, b - key.b);
      if (dist < maxDist) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 0;
      } else if (dist < maxDist + softBand) {
        const a = Math.round(((dist - maxDist) / softBand) * 255);
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = a;
      } else {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    }
  } else if (cfg.mode === 'person_cutout') {
    // Edge-sampled color difference + center subject weight segmentation
    let br = 0;
    let bg = 0;
    let bb = 0;
    let sampleCount = 0;
    const step = 4;
    for (let x = 0; x < mW; x += step) {
      const topIdx = x * 4;
      const botIdx = ((mH - 1) * mW + x) * 4;
      br += d[topIdx] + d[botIdx];
      bg += d[topIdx + 1] + d[botIdx + 1];
      bb += d[topIdx + 2] + d[botIdx + 2];
      sampleCount += 2;
    }
    for (let y = 0; y < mH; y += step) {
      const leftIdx = y * mW * 4;
      const rightIdx = (y * mW + (mW - 1)) * 4;
      br += d[leftIdx] + d[rightIdx];
      bg += d[leftIdx + 1] + d[rightIdx + 1];
      bb += d[leftIdx + 2] + d[rightIdx + 2];
      sampleCount += 2;
    }
    br /= Math.max(1, sampleCount);
    bg /= Math.max(1, sampleCount);
    bb /= Math.max(1, sampleCount);

    const thresh = Math.max(24, (cfg.tolerance / 100) * 145);
    const soft = 26 + cfg.feather * 1.4;
    const cx = mW * 0.5;
    const cy = mH * 0.52;

    for (let y = 0; y < mH; y++) {
      const ny = (y - cy) / (mH * 0.48);
      for (let x = 0; x < mW; x++) {
        const nx = (x - cx) / (mW * 0.42);
        const radial = Math.hypot(nx, ny);
        const idx = (y * mW + x) * 4;
        const colorDiff = Math.hypot(d[idx] - br, d[idx + 1] - bg, d[idx + 2] - bb);
        // Inner portrait bias preserves skin/torso inside center silhouette while dropping uniform edges
        const score = colorDiff + (radial < 0.72 ? (0.72 - radial) * 44 : -(radial - 0.72) * 32);
        let alpha = 255;
        if (score < thresh) {
          alpha = 0;
        } else if (score < thresh + soft) {
          alpha = Math.round(((score - thresh) / soft) * 255);
        }
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
        d[idx + 3] = alpha;
      }
    }
  }

  mCtx.putImageData(imgData, 0, 0);

  layerCtx.save();
  layerCtx.globalCompositeOperation = 'destination-in';
  if ('filter' in layerCtx && cfg.feather > 0) {
    layerCtx.filter = `blur(${Math.max(0.5, cfg.feather * 0.35).toFixed(1)}px)`;
  }
  layerCtx.drawImage(cachedMatteSmall, 0, 0, w, h);
  layerCtx.restore();
}

export function applyEnhanceSharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength01: number
): void {
  if (strength01 <= 0.02 || width < 4 || height < 4 || width * height > 8_500_000) return;
  try {
    const amount = Math.min(0.45, strength01 * 0.38);
    const imageData = ctx.getImageData(0, 0, width, height);
    const src = imageData.data;
    const copy = new Uint8ClampedArray(src);
    const stride = width * 4;
    const centerWeight = 1 + 4 * amount;
    const edgeWeight = -amount;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * stride;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x * 4;
        const up = idx - stride;
        const down = idx + stride;
        const left = idx - 4;
        const right = idx + 4;
        for (let c = 0; c < 3; c++) {
          const val =
            copy[idx + c] * centerWeight +
            (copy[up + c] + copy[down + c] + copy[left + c] + copy[right + c]) * edgeWeight;
          src[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // ignore tainted/memory-constrained canvas cleanly
  }
}

function traceMaskShapePath(
  ctx: CanvasRenderingContext2D,
  shape: EditorMaskShape,
  halfW: number,
  halfH: number,
  stageW: number,
  stageH: number
) {
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, 0);
    ctx.lineTo(0, halfH);
    ctx.lineTo(-halfW, 0);
    ctx.closePath();
  } else if (shape === 'circle') {
    const r = Math.min(halfW, halfH);
    ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
  } else if (shape === 'rectangle') {
    const cr = Math.min(halfW, halfH) * 0.14;
    ctx.roundRect(-halfW, -halfH, halfW * 2, halfH * 2, cr);
  } else if (shape === 'split') {
    const big = Math.max(stageW, stageH) * 2.5;
    ctx.rect(-big, -big, big, big * 2);
  } else if (shape === 'star') {
    const outerR = Math.min(halfW, halfH);
    const innerR = outerR * 0.44;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'heart') {
    const s = Math.min(halfW, halfH);
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 1.1, -s * 0.78, 0, -s * 0.25);
    ctx.bezierCurveTo(s * 1.1, -s * 0.78, s * 1.15, s * 0.15, 0, s * 0.85);
    ctx.closePath();
  }
}

function buildFeatheredMaskAlpha(
  maskCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mask: EditorMaskConfig,
  overrideCenterPx?: { cx: number; cy: number; refHalfW: number; refHalfH: number }
) {
  maskCtx.save();
  maskCtx.clearRect(0, 0, w, h);

  const cx = overrideCenterPx ? overrideCenterPx.cx : (mask.xPercent / 100) * w;
  const cy = overrideCenterPx ? overrideCenterPx.cy : (mask.yPercent / 100) * h;
  const k = Math.max(0.12, Math.min(1.8, mask.sizePercent / 100));
  const halfW = (overrideCenterPx ? overrideCenterPx.refHalfW : w * 0.46) * k;
  const halfH = (overrideCenterPx ? overrideCenterPx.refHalfH : h * 0.46) * k;
  const scaledFeather = Math.max(0, (mask.featherPx / 360) * w);

  if (mask.invert) {
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, w, h);
  }

  maskCtx.save();
  maskCtx.translate(cx, cy);
  maskCtx.rotate((mask.rotationDeg * Math.PI) / 180);
  if ('filter' in maskCtx && scaledFeather > 0.5) {
    maskCtx.filter = `blur(${scaledFeather.toFixed(1)}px)`;
  }
  maskCtx.globalCompositeOperation = mask.invert ? 'destination-out' : 'source-over';
  maskCtx.fillStyle = '#ffffff';
  traceMaskShapePath(maskCtx, mask.shape, halfW, halfH, w, h);
  maskCtx.fill();
  maskCtx.restore();

  maskCtx.restore();
}

function drawTextLayerItem(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  totalDuration: number,
  layer: EditorTextLayer,
  keyframe?: ReturnType<typeof interpolateKeyframesAtTime>
) {
  const rawText = layer.text.trim();
  if (!rawText) return;
  const fontMeta = TEXT_FONT_STYLES.find((f) => f.id === layer.fontId) || TEXT_FONT_STYLES[0];
  const scaledFont = Math.max(16, Math.round((layer.size / 360) * w));

  let displayText = rawText;
  let textScale = 1;
  let textAlpha = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotDeg = layer.rotationDeg || 0;
  let glowExtra = 0;

  if (layer.animation === 'pop') {
    const popT = Math.min(1, (timeSec % 3.5) / 0.35);
    textScale = popT < 0.7 ? 0.65 + (popT / 0.7) * 0.47 : 1.12 - ((popT - 0.7) / 0.3) * 0.12;
    textAlpha = Math.min(1, popT * 2);
  } else if (layer.animation === 'neon_pulse') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.2);
    glowExtra = Math.round(w * 0.04 * pulse);
    textScale = 1 + 0.03 * pulse;
  } else if (layer.animation === 'slide_up') {
    const slideT = easeOutCubic(Math.min(1, (timeSec % 4) / 0.45));
    offsetY = (1 - slideT) * (h * 0.055);
    textAlpha = slideT;
  } else if (layer.animation === 'typewriter') {
    const cycleT = (timeSec % 4.5) / 2.2;
    const charCount = Math.max(1, Math.min(rawText.length, Math.ceil(rawText.length * cycleT)));
    displayText = rawText.slice(0, charCount);
  } else if (layer.animation === 'float') {
    offsetY = Math.sin(timeSec * 2.6) * (h * 0.012);
  }

  if (layer.animConfig) {
    const anim = evaluateAnimTransform(layer.animConfig, timeSec, Math.max(0.5, totalDuration), w, h);
    textScale *= anim.scale;
    textAlpha *= anim.alpha;
    offsetX += anim.offsetX;
    offsetY += anim.offsetY;
    rotDeg += anim.rotDeg;
  }

  let baseX = layer.xPercent;
  let baseY = layer.yPercent;
  if (keyframe?.active) {
    baseX = keyframe.xPercent;
    baseY = keyframe.yPercent;
    textScale *= keyframe.scale;
    rotDeg += keyframe.rotationDeg;
    textAlpha *= keyframe.opacity / 100;
  }

  const xPos = (baseX / 100) * w + offsetX;
  const yPos = (baseY / 100) * h + offsetY;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, textAlpha));
  ctx.translate(xPos, yPos);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.scale(textScale, textScale);
  ctx.font = `${fontMeta.weight} ${scaledFont}px ${fontMeta.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(displayText);
  const padX = scaledFont * 0.55;
  const padY = scaledFont * 0.38;

  if (layer.backdrop) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.64)';
    const boxW = Math.min(w * 0.9, metrics.width + padX * 2);
    const boxH = scaledFont + padY * 1.4;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.max(8, scaledFont * 0.35));
    ctx.fill();
  }

  if (layer.neonGlow || layer.animation === 'neon_pulse') {
    ctx.shadowColor = layer.color === '#000000' ? '#22d3ee' : layer.color;
    ctx.shadowBlur = Math.round(w * 0.04) + glowExtra;
  }

  if (layer.outline) {
    ctx.lineWidth = Math.max(2, scaledFont * 0.11);
    ctx.strokeStyle = layer.color === '#000000' ? '#ffffff' : 'rgba(0, 0, 0, 0.88)';
    ctx.lineJoin = 'round';
    ctx.strokeText(displayText, 0, 0, w * 0.88);
  }

  ctx.fillStyle = layer.color;
  ctx.fillText(displayText, 0, 0, w * 0.88);
  ctx.restore();
}

export function drawProTimelineFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  spans: ComputedClipSpan[],
  mediaCache: Map<string, HTMLImageElement | HTMLVideoElement>,
  options: TimelineRenderOptions
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, w, h);

  if (spans.length === 0) {
    ctx.restore();
    return;
  }

  let activeIdx = spans.findIndex(
    (s) => timeSec >= s.timelineStart && timeSec <= s.timelineEnd
  );
  if (activeIdx === -1) {
    activeIdx = timeSec <= 0 ? 0 : spans.length - 1;
  }
  const activeSpan = spans[activeIdx];
  const totalTimelineDur = spans[spans.length - 1]?.timelineEnd || activeSpan.effectiveDuration;
  const localTime = Math.max(0, timeSec - activeSpan.timelineStart);
  const filterCss = buildBlendedCssFilter(options);

  // Evaluate Crop, Clip Entrance/Exit/Combo Animations, Keyframes, and Shake effect
  const crop = options.crop;
  const cropZoom = crop ? Math.max(1, crop.zoom) : 1;
  const cropPanX = crop ? (crop.panXPercent / 100) * w * cropZoom : 0;
  const cropPanY = crop ? (crop.panYPercent / 100) * h * cropZoom : 0;

  const mainKf = interpolateKeyframesAtTime(options.keyframes, 'main', timeSec);
  const clipAnim = evaluateAnimTransform(
    options.clipAnimation,
    localTime,
    activeSpan.effectiveDuration,
    w,
    h
  );

  const fx = options.visualEffect;
  const fx01 = fx && fx.type !== 'none' ? Math.max(0, Math.min(1, fx.intensity / 100)) : 0;
  let shakeX = 0;
  let shakeY = 0;
  let shakeRot = 0;
  if (fx?.type === 'shake' && fx01 > 0.01) {
    shakeX = Math.sin(timeSec * 42) * (w * 0.025 * fx01);
    shakeY = Math.cos(timeSec * 37) * (h * 0.02 * fx01);
    shakeRot = Math.sin(timeSec * 29) * 2.4 * fx01;
  }

  // Optional Freeform crop viewport clipping
  if (crop?.aspect === 'freeform') {
    const rx = (crop.freeRect.x / 100) * w;
    const ry = (crop.freeRect.y / 100) * h;
    const rw = (crop.freeRect.w / 100) * w;
    const rh = (crop.freeRect.h / 100) * h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
  }

  const renderMainContentTo = (targetCtx: CanvasRenderingContext2D) => {
    const drawSingleSpan = (
      span: ComputedClipSpan,
      scale = 1,
      offsetX = 0,
      offsetY = 0,
      alpha = 1
    ) => {
      const el = mediaCache.get(span.clip.sourceId);
      if (!el) return;
      const isImg = span.clip.mediaType === 'image';
      const srcW = isImg
        ? (el as HTMLImageElement).naturalWidth
        : (el as HTMLVideoElement).videoWidth;
      const srcH = isImg
        ? (el as HTMLImageElement).naturalHeight
        : (el as HTMLVideoElement).videoHeight;
      if (!srcW || !srcH) return;

      const kfScale = mainKf.active ? mainKf.scale : 1;
      const kfOffX = mainKf.active ? ((mainKf.xPercent - 50) / 100) * w : 0;
      const kfOffY = mainKf.active ? ((mainKf.yPercent - 50) / 100) * h : 0;
      const kfRot = mainKf.active ? mainKf.rotationDeg : 0;
      const kfAlpha = mainKf.active ? mainKf.opacity / 100 : 1;

      const finalScale = scale * cropZoom * clipAnim.scale * kfScale;
      const finalOffX = offsetX + cropPanX + clipAnim.offsetX + kfOffX + shakeX;
      const finalOffY = offsetY + cropPanY + clipAnim.offsetY + kfOffY + shakeY;
      const finalRot = clipAnim.rotDeg + kfRot + shakeRot;
      const finalAlpha = Math.max(0, Math.min(1, alpha * clipAnim.alpha * kfAlpha));

      targetCtx.save();
      targetCtx.globalAlpha = finalAlpha;
      try {
        if ('filter' in targetCtx) {
          targetCtx.filter = filterCss;
        }
      } catch {
        // ignore fallback
      }
      if (Math.abs(finalRot) > 0.05) {
        targetCtx.translate(w / 2, h / 2);
        targetCtx.rotate((finalRot * Math.PI) / 180);
        targetCtx.translate(-w / 2, -h / 2);
      }
      drawMediaFit(
        targetCtx,
        el,
        srcW,
        srcH,
        w,
        h,
        span.clip.mediaType === 'image' ? span.clip.photoFit : 'contain',
        finalScale,
        finalOffX,
        finalOffY
      );
      targetCtx.restore();
    };

    let renderedWithTransition = false;
    if (activeIdx > 0) {
      const prevSpan = spans[activeIdx - 1];
      const trType = prevSpan.clip.transitionAfter;
      const trDur = Math.min(
        prevSpan.clip.transitionDuration || 0.45,
        activeSpan.effectiveDuration * 0.6,
        prevSpan.effectiveDuration * 0.6
      );
      if (trType !== 'none' && localTime < trDur && trDur > 0.05) {
        const p = Math.max(0, Math.min(1, localTime / trDur));
        const ease = easeOutCubic(p);
        renderedWithTransition = true;

        if (trType === 'fade') {
          drawSingleSpan(prevSpan, 1, 0, 0, 1 - p);
          drawSingleSpan(activeSpan, 1, 0, 0, p);
        } else if (trType === 'zoom_punch') {
          drawSingleSpan(prevSpan, 1 + ease * 0.35, 0, 0, Math.max(0, 1 - p * 1.4));
          drawSingleSpan(activeSpan, 1.3 - ease * 0.3, 0, 0, Math.min(1, p * 1.35));
          if (p > 0.35 && p < 0.72) {
            const flashA = Math.sin(((p - 0.35) / 0.37) * Math.PI) * 0.42;
            targetCtx.fillStyle = `rgba(255,255,255,${flashA})`;
            targetCtx.fillRect(0, 0, w, h);
          }
        } else if (trType === 'swipe') {
          drawSingleSpan(prevSpan, 1, -ease * w, 0, 1);
          drawSingleSpan(activeSpan, 1, (1 - ease) * w, 0, 1);
          const seamX = (1 - ease) * w;
          const seam = targetCtx.createLinearGradient(seamX - w * 0.06, 0, seamX, 0);
          seam.addColorStop(0, 'rgba(0,0,0,0)');
          seam.addColorStop(1, 'rgba(0,0,0,0.45)');
          targetCtx.fillStyle = seam;
          targetCtx.fillRect(seamX - w * 0.06, 0, w * 0.06, h);
        } else if (trType === 'glitch') {
          const showNew = p > 0.45;
          const target = showNew ? activeSpan : prevSpan;
          drawSingleSpan(target, 1.03, 0, 0, 1);
          const sliceCount = 6;
          const sliceH = h / sliceCount;
          for (let s = 0; s < sliceCount; s++) {
            if ((s + Math.floor(p * 20)) % 2 === 0) {
              const jitterX =
                Math.sin(p * 60 + s * 4.1) * (w * 0.065) * (1 - Math.abs(p - 0.5) * 1.6);
              const bandColor =
                s % 2 === 0 ? 'rgba(34, 211, 238, 0.24)' : 'rgba(244, 63, 94, 0.24)';
              targetCtx.fillStyle = bandColor;
              targetCtx.fillRect(jitterX, s * sliceH, w, sliceH * 0.42);
            }
          }
        }
      }
    }

    if (!renderedWithTransition) {
      drawSingleSpan(activeSpan, 1, 0, 0, 1);
    }
  };

  // Optional Background Removal + Replacement Layer
  const bgCfg = options.bgRemoval;
  const hasBgRemoval = Boolean(bgCfg && bgCfg.mode !== 'off');
  if (hasBgRemoval && bgCfg) {
    // Draw replacement backdrop first
    if (bgCfg.replaceMode === 'color') {
      ctx.fillStyle = bgCfg.replaceColor || '#0f172a';
      ctx.fillRect(0, 0, w, h);
    } else if (bgCfg.replaceMode === 'blur') {
      ctx.save();
      if ('filter' in ctx) ctx.filter = 'blur(18px) brightness(0.75)';
      renderMainContentTo(ctx);
      ctx.restore();
    } else if (bgCfg.replaceMode === 'image' && bgCfg.replaceImageSourceId) {
      const bgEl = mediaCache.get(bgCfg.replaceImageSourceId);
      if (bgEl instanceof HTMLImageElement && bgEl.naturalWidth > 0) {
        drawMediaFit(ctx, bgEl, bgEl.naturalWidth, bgEl.naturalHeight, w, h, 'cover', 1, 0, 0);
      } else {
        ctx.fillStyle = '#07070c';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      // Checkered subtle studio dark slate
      ctx.fillStyle = '#090910';
      ctx.fillRect(0, 0, w, h);
    }

    const scratch = getMaskScratchCanvases(w, h);
    if (scratch) {
      scratch.layerCtx.clearRect(0, 0, w, h);
      renderMainContentTo(scratch.layerCtx);
      applyBgRemovalMatte(scratch.layerCanvas, scratch.layerCtx, w, h, bgCfg);

      if (options.mainMask && options.mainMask.shape !== 'none') {
        buildFeatheredMaskAlpha(scratch.maskCtx, w, h, options.mainMask);
        scratch.layerCtx.save();
        scratch.layerCtx.globalCompositeOperation = 'destination-in';
        scratch.layerCtx.drawImage(scratch.maskCanvas, 0, 0);
        scratch.layerCtx.restore();
      }
      ctx.drawImage(scratch.layerCanvas, 0, 0);
    } else {
      renderMainContentTo(ctx);
    }
  } else if (options.mainMask && options.mainMask.shape !== 'none') {
    const scratch = getMaskScratchCanvases(w, h);
    if (scratch) {
      scratch.layerCtx.clearRect(0, 0, w, h);
      renderMainContentTo(scratch.layerCtx);
      buildFeatheredMaskAlpha(scratch.maskCtx, w, h, options.mainMask);
      scratch.layerCtx.save();
      scratch.layerCtx.globalCompositeOperation = 'destination-in';
      scratch.layerCtx.drawImage(scratch.maskCanvas, 0, 0);
      scratch.layerCtx.restore();
      ctx.drawImage(scratch.layerCanvas, 0, 0);
    } else {
      renderMainContentTo(ctx);
    }
  } else {
    renderMainContentTo(ctx);
  }

  // CapCut Overlay (PIP) Layers: photo/video overlays with drag position, pinch scale, rotation, opacity & shape mask
  const ovKf = interpolateKeyframesAtTime(options.keyframes, 'overlay', timeSec);
  const overlays = options.overlays || [];
  for (let ovIdx = 0; ovIdx < overlays.length; ovIdx++) {
    const ov = overlays[ovIdx];
    if (timeSec < ov.startTime || timeSec > ov.endTime) continue;
    const ovEl = mediaCache.get(ov.sourceId);
    if (!ovEl) continue;
    const isImg = ov.mediaType === 'image';
    const srcW = isImg
      ? (ovEl as HTMLImageElement).naturalWidth
      : (ovEl as HTMLVideoElement).videoWidth;
    const srcH = isImg
      ? (ovEl as HTMLImageElement).naturalHeight
      : (ovEl as HTMLVideoElement).videoHeight;
    if (!srcW || !srcH) continue;

    const useKf = ovIdx === 0 && ovKf.active;
    const effScale = ov.scale * (useKf ? ovKf.scale : 1);
    const effRot = ov.rotationDeg + (useKf ? ovKf.rotationDeg : 0);
    const effAlpha = Math.max(0, Math.min(1, (ov.opacity / 100) * (useKf ? ovKf.opacity / 100 : 1)));
    const baseWidth = w * 0.46 * Math.max(0.15, Math.min(2.5, effScale));
    const drawW = baseWidth;
    const drawH = drawW * (srcH / srcW);
    const cx = ((useKf ? ovKf.xPercent : ov.xPercent) / 100) * w;
    const cy = ((useKf ? ovKf.yPercent : ov.yPercent) / 100) * h;

    if (ov.mask && ov.mask.shape !== 'none') {
      const scratch = getMaskScratchCanvases(w, h);
      if (scratch) {
        scratch.layerCtx.save();
        scratch.layerCtx.clearRect(0, 0, w, h);
        scratch.layerCtx.translate(cx, cy);
        scratch.layerCtx.rotate((effRot * Math.PI) / 180);
        scratch.layerCtx.drawImage(ovEl, -drawW / 2, -drawH / 2, drawW, drawH);
        scratch.layerCtx.restore();

        buildFeatheredMaskAlpha(scratch.maskCtx, w, h, ov.mask, {
          cx: cx + ((ov.mask.xPercent - 50) / 100) * drawW,
          cy: cy + ((ov.mask.yPercent - 50) / 100) * drawH,
          refHalfW: drawW * 0.5,
          refHalfH: drawH * 0.5,
        });

        scratch.layerCtx.save();
        scratch.layerCtx.globalCompositeOperation = 'destination-in';
        scratch.layerCtx.drawImage(scratch.maskCanvas, 0, 0);
        scratch.layerCtx.restore();

        ctx.save();
        ctx.globalAlpha = effAlpha;
        ctx.drawImage(scratch.layerCanvas, 0, 0);
        ctx.restore();
        continue;
      }
    }

    ctx.save();
    ctx.globalAlpha = effAlpha;
    ctx.translate(cx, cy);
    ctx.rotate((effRot * Math.PI) / 180);
    ctx.drawImage(ovEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  // LUT Tonal Wash Overlay
  const lutIntensity01 = Math.max(0, Math.min(1, options.lutIntensity / 100));
  const washAlpha = options.filterLut.tintAlpha * lutIntensity01;
  if (washAlpha > 0.005) {
    ctx.save();
    ctx.globalAlpha = washAlpha;
    ctx.fillStyle = options.filterLut.tintRgba;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Visual Shader / FX Overlays (Glitch, Neon Glow, VHS, Sparkle, Vignette)
  if (fx && fx.type !== 'none' && fx01 > 0.02) {
    if (fx.type === 'glitch') {
      ctx.save();
      const count = 8;
      const sliceH = h / count;
      for (let i = 0; i < count; i++) {
        const wave = Math.sin(timeSec * 24 + i * 3.1);
        if (Math.abs(wave) > 0.35) {
          const jitter = wave * w * 0.05 * fx01;
          ctx.fillStyle =
            i % 2 === 0
              ? `rgba(34, 211, 238, ${0.24 * fx01})`
              : `rgba(244, 63, 94, ${0.24 * fx01})`;
          ctx.fillRect(jitter, i * sliceH, w, Math.max(3, sliceH * 0.28));
        }
      }
      ctx.restore();
    } else if (fx.type === 'neon_glow') {
      ctx.save();
      const pulse = 0.72 + 0.28 * Math.sin(timeSec * 4.5);
      const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, h * 0.65);
      grad.addColorStop(0, 'rgba(34,211,238,0)');
      grad.addColorStop(0.75, `rgba(236,72,153,${0.18 * fx01 * pulse})`);
      grad.addColorStop(1, `rgba(34,211,238,${0.42 * fx01 * pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(34,211,238,${0.7 * fx01 * pulse})`;
      ctx.lineWidth = Math.max(3, w * 0.015);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      ctx.restore();
    } else if (fx.type === 'vhs') {
      ctx.save();
      ctx.fillStyle = `rgba(18, 12, 28, ${0.14 * fx01})`;
      ctx.fillRect(0, 0, w, h);
      const step = Math.max(4, Math.round(h / 95));
      ctx.fillStyle = `rgba(255,255,255,${0.08 * fx01})`;
      for (let y = (Math.floor(timeSec * 40) % step); y < h; y += step * 2) {
        ctx.fillRect(0, y, w, 1.2);
      }
      const barY = ((timeSec * 0.28) % 1) * h;
      ctx.fillStyle = `rgba(255,255,255,${0.16 * fx01})`;
      ctx.fillRect(0, barY, w, Math.max(3, h * 0.015));
      ctx.font = `700 ${Math.max(10, Math.round(w * 0.036))}px ui-monospace, monospace`;
      ctx.fillStyle = `rgba(255,255,255,${0.78 * fx01})`;
      ctx.fillText(`PLAY ▶ ${timeSec.toFixed(1)}s`, w * 0.06, h * 0.07);
      ctx.restore();
    } else if (fx.type === 'sparkle') {
      ctx.save();
      const stars = 18;
      for (let i = 0; i < stars; i++) {
        const sx = ((Math.sin(i * 19.7 + 1.2) * 0.5 + 0.5) * 0.88 + 0.06) * w;
        const sy = ((Math.cos(i * 11.3 + 2.8) * 0.5 + 0.5) * 0.88 + 0.06) * h;
        const twinkle = Math.max(0, Math.sin(timeSec * 5.4 + i * 1.7));
        const r = Math.max(3, w * 0.025) * twinkle * fx01;
        if (r > 1) {
          ctx.translate(sx, sy);
          ctx.fillStyle = `rgba(255, 250, 220, ${0.9 * twinkle * fx01})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, r, r * 0.22, 0, 0, Math.PI * 2);
          ctx.ellipse(0, 0, r * 0.22, r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
      ctx.restore();
    }
  }

  // Cinematic Vignette (from LUT, slider, or Vignette Effect)
  const fxVig = fx?.type === 'vignette' ? fx01 * 0.85 : 0;
  const vigAmount = Math.max(
    options.filterLut.vignette * lutIntensity01,
    options.vignetteAdj / 100,
    fxVig
  );
  if (vigAmount > 0.02) {
    ctx.save();
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.24, w / 2, h / 2, h * 0.68);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, vigAmount)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Draggable, Resizable, Rotatable Text Overlays (multi-layer + active textLayer fallback)
  const textKf = interpolateKeyframesAtTime(options.keyframes, 'text', timeSec);
  const layersList =
    options.textLayers && options.textLayers.length > 0
      ? options.textLayers
      : options.textLayer.text.trim()
      ? [options.textLayer]
      : [];
  for (let i = 0; i < layersList.length; i++) {
    drawTextLayerItem(
      ctx,
      w,
      h,
      timeSec,
      totalTimelineDur,
      layersList[i],
      i === 0 ? textKf : undefined
    );
  }

  // Auto-Captions / Timed Subtitle Blocks
  const captions = options.captions || [];
  const activeCaptions = captions.filter(
    (c) => c.text.trim() && timeSec >= c.startTime && timeSec <= c.endTime
  );
  for (const cap of activeCaptions) {
    const capFont = Math.max(14, Math.round(w * 0.048));
    const cx = w * 0.5;
    const cy = (cap.yPercent / 100) * h;
    ctx.save();
    ctx.font = `900 ${capFont}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = Math.min(w * 0.86, ctx.measureText(cap.text).width + capFont * 1.1);
    const boxH = capFont * 1.75;

    if (cap.style === 'clean_pill') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.beginPath();
      ctx.roundRect(cx - textW / 2, cy - boxH / 2, textW, boxH, capFont * 0.5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(cap.text, cx, cy, w * 0.84);
    } else if (cap.style === 'karaoke_glow') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.beginPath();
      ctx.roundRect(cx - textW / 2, cy - boxH / 2, textW, boxH, capFont * 0.45);
      ctx.fill();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = Math.round(w * 0.03);
      ctx.fillStyle = '#facc15';
      ctx.fillText(cap.text, cx, cy, w * 0.84);
    } else {
      ctx.lineWidth = Math.max(3, capFont * 0.16);
      ctx.strokeStyle = 'rgba(0,0,0,0.95)';
      ctx.lineJoin = 'round';
      ctx.strokeText(cap.text.toUpperCase(), cx, cy, w * 0.88);
      ctx.fillStyle = '#fde047';
      ctx.fillText(cap.text.toUpperCase(), cx, cy, w * 0.88);
    }
    ctx.restore();
  }

  // Scrolling News / Promo Ticker Bar
  const ticker = options.ticker;
  if (ticker && ticker.enabled && ticker.text.trim()) {
    const barH = Math.max(24, Math.round(h * 0.056));
    const barY = ticker.position === 'top' ? Math.round(h * 0.03) : h - barH - Math.round(h * 0.03);
    ctx.save();
    ctx.fillStyle = ticker.bgColor || '#e11d48';
    ctx.fillRect(0, barY, w, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, barY, w, 1.5);
    ctx.fillRect(0, barY + barH - 1.5, w, 1.5);

    const fontPx = Math.max(12, Math.round(barH * 0.54));
    ctx.font = `900 ${fontPx}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillStyle = ticker.textColor || '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const loopMsg = `${ticker.text.trim()}   •   `;
    const msgW = Math.max(w * 0.5, ctx.measureText(loopMsg).width);
    const speedPxPerSec = (w * 0.24) * Math.max(0.5, ticker.speed || 2);
    const scrollOffset = (timeSec * speedPxPerSec) % msgW;
    let drawX = -scrollOffset;
    while (drawX < w + msgW) {
      ctx.fillText(loopMsg, drawX, barY + barH / 2);
      drawX += msgW;
    }
    ctx.restore();
  }

  // Draggable Sticker Layers
  for (const stk of options.stickers) {
    const fontPx = Math.max(24, Math.round((stk.size / 360) * w));
    ctx.save();
    ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stk.emoji, (stk.xPercent / 100) * w, (stk.yPercent / 100) * h);
    ctx.restore();
  }

  if (crop?.aspect === 'freeform') {
    ctx.restore();
  }

  ctx.restore();
}

export type ProFilterLutId =
  | 'original'
  | 'cinematic'
  | 'warm_golden'
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
  speed: number; // 0.5, 1, 1.5, 2 etc.
  speedCurve: SpeedCurvePresetId;
  transitionAfter: ClipTransitionType;
  transitionDuration: number; // seconds e.g. 0.45
  photoFit: 'contain' | 'cover';
}

export interface EditorTextLayer {
  text: string;
  fontId: TextFontStyleId;
  color: string;
  size: number; // 18..54
  xPercent: number; // 10..90
  yPercent: number; // 10..90
  neonGlow: boolean;
  outline: boolean;
  backdrop: boolean;
  animation: TextAnimationStyle;
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
  stickers: EditorStickerLayer[];
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
    label: 'Warm Golden',
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
    id: 'moody_dark',
    label: 'Moody Dark',
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
    id: 'vibrant',
    label: 'Vibrant',
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
  {
    id: 'bw_noir',
    label: 'B&W Noir',
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
  return Math.max(0.25, Math.min(3.0, baseSpeed * factor));
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
  const b = 100 + (lut.brightness - 100) * k + options.brightnessAdj;
  const c = 100 + (lut.contrast - 100) * k + options.contrastAdj;
  const s = Math.max(0, 100 + (lut.saturate - 100) * k + options.saturateAdj);
  const h = lut.hueRotate * k;
  const sep = lut.sepia * k;
  const gs = lut.grayscale * k;
  return `brightness(${Math.round(b)}%) contrast(${Math.round(c)}%) saturate(${Math.round(
    s
  )}%) hue-rotate(${h.toFixed(1)}deg) sepia(${Math.round(sep)}%) grayscale(${Math.round(gs)}%)`;
}

function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - c, 3);
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

// Reusable scratch canvases for buttery 60fps feathered shape masking
let cachedScratchLayer: HTMLCanvasElement | null = null;
let cachedScratchMask: HTMLCanvasElement | null = null;

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
  const localTime = Math.max(0, timeSec - activeSpan.timelineStart);
  const filterCss = buildBlendedCssFilter(options);

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

      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      try {
        if ('filter' in targetCtx) {
          targetCtx.filter = filterCss;
        }
      } catch {
        // ignore fallback
      }
      drawMediaFit(
        targetCtx,
        el,
        srcW,
        srcH,
        w,
        h,
        span.clip.mediaType === 'image' ? span.clip.photoFit : 'contain',
        scale,
        offsetX,
        offsetY
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

  // Apply Main Track Shape Mask (Diamond, Circle, Heart, Star, Split, Rectangle) with Feather if active
  const mainMask = options.mainMask;
  if (mainMask && mainMask.shape !== 'none') {
    const scratch = getMaskScratchCanvases(w, h);
    if (scratch) {
      scratch.layerCtx.clearRect(0, 0, w, h);
      renderMainContentTo(scratch.layerCtx);
      buildFeatheredMaskAlpha(scratch.maskCtx, w, h, mainMask);
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
  const overlays = options.overlays || [];
  for (const ov of overlays) {
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

    const baseWidth = w * 0.46 * Math.max(0.15, Math.min(2.5, ov.scale));
    const drawW = baseWidth;
    const drawH = drawW * (srcH / srcW);
    const cx = (ov.xPercent / 100) * w;
    const cy = (ov.yPercent / 100) * h;
    const alpha = Math.max(0, Math.min(1, ov.opacity / 100));

    if (ov.mask && ov.mask.shape !== 'none') {
      const scratch = getMaskScratchCanvases(w, h);
      if (scratch) {
        scratch.layerCtx.save();
        scratch.layerCtx.clearRect(0, 0, w, h);
        scratch.layerCtx.translate(cx, cy);
        scratch.layerCtx.rotate((ov.rotationDeg * Math.PI) / 180);
        scratch.layerCtx.drawImage(ovEl, -drawW / 2, -drawH / 2, drawW, drawH);
        scratch.layerCtx.restore();

        // When masking an overlay, center the mask on the overlay center unless user moved mask coords manually
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
        ctx.globalAlpha = alpha;
        ctx.drawImage(scratch.layerCanvas, 0, 0);
        ctx.restore();
        continue;
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate((ov.rotationDeg * Math.PI) / 180);
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

  // Cinematic Vignette
  const vigAmount = Math.max(
    options.filterLut.vignette * lutIntensity01,
    options.vignetteAdj / 100
  );
  if (vigAmount > 0.02) {
    ctx.save();
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.24, w / 2, h / 2, h * 0.68);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, vigAmount)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Animated Text & Captions Layer
  const { textLayer } = options;
  const rawText = textLayer.text.trim();
  if (rawText) {
    const fontMeta =
      TEXT_FONT_STYLES.find((f) => f.id === textLayer.fontId) || TEXT_FONT_STYLES[0];
    const scaledFont = Math.max(18, Math.round((textLayer.size / 360) * w));

    let displayText = rawText;
    let textScale = 1;
    let textAlpha = 1;
    let offsetY = 0;
    let glowExtra = 0;

    if (textLayer.animation === 'pop') {
      const popT = Math.min(1, (timeSec % 3.5) / 0.35);
      textScale = popT < 0.7 ? 0.65 + (popT / 0.7) * 0.47 : 1.12 - ((popT - 0.7) / 0.3) * 0.12;
      textAlpha = Math.min(1, popT * 2);
    } else if (textLayer.animation === 'neon_pulse') {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.2);
      glowExtra = Math.round(w * 0.04 * pulse);
      textScale = 1 + 0.03 * pulse;
    } else if (textLayer.animation === 'slide_up') {
      const slideT = easeOutCubic(Math.min(1, (timeSec % 4) / 0.45));
      offsetY = (1 - slideT) * (h * 0.055);
      textAlpha = slideT;
    } else if (textLayer.animation === 'typewriter') {
      const cycleT = (timeSec % 4.5) / 2.2;
      const charCount = Math.max(1, Math.min(rawText.length, Math.ceil(rawText.length * cycleT)));
      displayText = rawText.slice(0, charCount);
    } else if (textLayer.animation === 'float') {
      offsetY = Math.sin(timeSec * 2.6) * (h * 0.012);
    }

    const xPos = (textLayer.xPercent / 100) * w;
    const yPos = (textLayer.yPercent / 100) * h + offsetY;

    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.translate(xPos, yPos);
    ctx.scale(textScale, textScale);
    ctx.font = `${fontMeta.weight} ${scaledFont}px ${fontMeta.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(displayText);
    const padX = scaledFont * 0.55;
    const padY = scaledFont * 0.38;

    if (textLayer.backdrop) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.64)';
      const boxW = Math.min(w * 0.9, metrics.width + padX * 2);
      const boxH = scaledFont + padY * 1.4;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.max(8, scaledFont * 0.35));
      ctx.fill();
    }

    if (textLayer.neonGlow || textLayer.animation === 'neon_pulse') {
      ctx.shadowColor = textLayer.color === '#000000' ? '#22d3ee' : textLayer.color;
      ctx.shadowBlur = Math.round(w * 0.04) + glowExtra;
    }

    if (textLayer.outline) {
      ctx.lineWidth = Math.max(2, scaledFont * 0.11);
      ctx.strokeStyle = textLayer.color === '#000000' ? '#ffffff' : 'rgba(0, 0, 0, 0.88)';
      ctx.lineJoin = 'round';
      ctx.strokeText(displayText, 0, 0, w * 0.88);
    }

    ctx.fillStyle = textLayer.color;
    ctx.fillText(displayText, 0, 0, w * 0.88);
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

  ctx.restore();
}

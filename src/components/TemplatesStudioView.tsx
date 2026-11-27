import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wand2,
  Sparkles,
  Play,
  Pause,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Music,
  Volume2,
  VolumeX,
  Download,
  Send,
  Upload,
  Image as ImageIcon,
  Film,
  Lock,
  Globe,
  Check,
  X,
  Sliders,
  Type,
  Loader2,
  Palette,
  Zap,
  Crop,
  RefreshCw,
  ZoomIn,
} from 'lucide-react';
import {
  VideoPost,
  UserAccount,
  CreatorProfileData,
  AudioTrackOption,
} from '../types';
import {
  VIDEO_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_COLOR_GRADES,
  formatTemplateDuration,
  TemplateCategory,
  TemplateEffectTransition,
  VideoTemplateDef,
  ColorGradePreset,
} from '../data/videoTemplates';
import { CURATED_AUDIO_LIBRARY } from '../data/audioLibrary';
import { soundEngine } from '../utils/soundEngine';
import {
  validateSafeMediaFile,
  validateSafeAudioFile,
  sanitizeInputLive,
  sanitizeText,
  checkRateLimit,
  recordRateLimitEvent,
} from '../utils/security';
import {
  savePostAudioMeta,
  savePostPrivacyMeta,
  saveLocalPostRecord,
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  fileToPersistentDataUrl,
} from '../lib/supabaseService';
import { savePostForOffline } from '../lib/offlineMediaStore';
import {
  StudioMusicPickerDrawer,
  AttachedOnlineSong,
} from './StudioMusicPickerDrawer';

interface TemplatesStudioViewProps {
  currentUser: UserAccount | null;
  creatorProfile: CreatorProfileData;
  onPostSuccess: (newPost: VideoPost) => void;
  onPostSynced: (tempId: string, syncedPost: VideoPost) => void;
  onBackToFeed: () => void;
  onShowToast: (msg: string) => void;
}

interface LoadedMediaClip {
  id: string;
  file: File;
  url: string;
  mediaType: 'image' | 'video';
  name: string;
  durationSec: number;
  imageEl?: HTMLImageElement;
  videoEl?: HTMLVideoElement;
  cropZoom?: number;
  cropPanX?: number;
  cropPanY?: number;
}

interface SlotWindow {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  label: string;
}

const TRANSITION_OPTIONS: { id: TemplateEffectTransition; label: string }[] = [
  { id: 'zoom-in', label: 'Zoom-In' },
  { id: 'flash', label: 'Flash' },
  { id: 'shake', label: 'Shake' },
  { id: 'slide', label: 'Slide' },
];

function easeOutCubic(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - clamped, 3);
}

function getTemplateSlotWindows(
  template: VideoTemplateDef,
  slotCount: number,
  speedMultiplier: number
): { windows: SlotWindow[]; totalDurationSec: number } {
  const count = Math.max(1, slotCount);
  const baseDurations =
    template.slotDurations && template.slotDurations.length >= count
      ? template.slotDurations.slice(0, count)
      : Array.from({ length: count }, () =>
          Number((template.durationSec / count).toFixed(1))
        );

  const safeSpeed = Math.max(0.5, speedMultiplier || 1);
  const windows: SlotWindow[] = [];
  let cursor = 0;

  for (let i = 0; i < count; i++) {
    const rawDur = Math.max(0.8, baseDurations[i] || template.durationSec / count);
    const dur = Math.max(0.7, rawDur / safeSpeed);
    windows.push({
      index: i,
      startSec: cursor,
      endSec: cursor + dur,
      durationSec: dur,
      label: template.slotLabels?.[i] || `Slot ${i + 1}`,
    });
    cursor += dur;
  }

  return { windows, totalDurationSec: Math.max(3, cursor) };
}

function drawCoverImageOrVideo(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  scale = 1,
  offsetX = 0,
  offsetY = 0
) {
  if (!srcW || !srcH) return;
  const srcRatio = srcW / srcH;
  const destRatio = destW / destH;
  let drawW = destW;
  let drawH = destH;
  if (srcRatio > destRatio) {
    drawH = destH * scale;
    drawW = drawH * srcRatio;
  } else {
    drawW = destW * scale;
    drawH = drawW / srcRatio;
  }
  const dx = (destW - drawW) / 2 + offsetX;
  const dy = (destH - drawH) / 2 + offsetY;
  ctx.drawImage(media, dx, dy, drawW, drawH);
}

// Renders rich, distinct animated visual scenes per shot slot so feed cards look like live reels
function drawProceduralScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  template: VideoTemplateDef,
  clipSlot: number,
  beatPulse = 0
) {
  const [c0, c1, c2] = template.previewColors;
  const slotMod = ((clipSlot % 5) + 5) % 5;

  // Base sky / studio gradient tailored to slot
  const skyGrad = ctx.createLinearGradient(0, 0, w * 0.25, h);
  if (slotMod === 0) {
    skyGrad.addColorStop(0, c0);
    skyGrad.addColorStop(0.52, c1);
    skyGrad.addColorStop(1, '#09090d');
  } else if (slotMod === 1) {
    skyGrad.addColorStop(0, '#070914');
    skyGrad.addColorStop(0.45, c0);
    skyGrad.addColorStop(1, c2);
  } else if (slotMod === 2) {
    skyGrad.addColorStop(0, c1);
    skyGrad.addColorStop(0.55, c0);
    skyGrad.addColorStop(1, '#050508');
  } else if (slotMod === 3) {
    skyGrad.addColorStop(0, c2);
    skyGrad.addColorStop(0.48, c0);
    skyGrad.addColorStop(1, '#060609');
  } else {
    skyGrad.addColorStop(0, '#090912');
    skyGrad.addColorStop(0.5, c1);
    skyGrad.addColorStop(1, c0);
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  if (slotMod === 0) {
    // Scene 0: Golden Horizon / Sunset Sun Disc & Silhouetted Ridge + Motion Clouds
    const sunY = h * (0.37 + 0.02 * Math.sin(t * 1.1));
    const sunR = w * (0.21 + beatPulse * 0.02);
    const halo = ctx.createRadialGradient(w * 0.5, sunY, sunR * 0.2, w * 0.5, sunY, sunR * 2.2);
    halo.addColorStop(0, 'rgba(255, 245, 220, 0.92)');
    halo.addColorStop(0.32, `${c2}cc`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(w * 0.5, sunY, sunR * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 248, 232, 0.95)';
    ctx.fill();

    // Parallax mountain & skyline ridge
    ctx.fillStyle = '#09090f';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.56);
    ctx.lineTo(w * 0.24, h * 0.49);
    ctx.lineTo(w * 0.46, h * 0.55);
    ctx.lineTo(w * 0.72, h * 0.46);
    ctx.lineTo(w, h * 0.54);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle foreground portrait silhouette head & shoulders
    ctx.fillStyle = 'rgba(10, 10, 14, 0.96)';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.44, w * 0.095, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.66, w * 0.25, h * 0.16, 0, Math.PI, 0, false);
    ctx.fill();
  } else if (slotMod === 1) {
    // Scene 1: Cyber Night Ride / Perspective Neon Grid Highway + Light Trails
    const horizonY = h * 0.43;
    const vanishX = w * (0.5 + 0.06 * Math.sin(t * 1.4));
    ctx.save();
    ctx.strokeStyle = c2;
    ctx.globalAlpha = 0.45 + beatPulse * 0.35;
    ctx.lineWidth = Math.max(1.2, w * 0.004);
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(vanishX + i * w * 0.26, h);
      ctx.stroke();
    }
    const scroll = (t * 2.2) % 1;
    for (let r = 0; r < 7; r++) {
      const frac = Math.pow((r + scroll) / 7, 1.7);
      const y = horizonY + frac * (h - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Glowing portal diamond
    const diamScale = 1 + beatPulse * 0.16;
    ctx.translate(w / 2, h * 0.36);
    ctx.scale(diamScale, diamScale);
    ctx.rotate(Math.sin(t * 1.2) * 0.06);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.01);
    ctx.strokeRect(-w * 0.16, -w * 0.16, w * 0.32, w * 0.32);
    ctx.restore();
  } else if (slotMod === 2) {
    // Scene 2: Stage Spotlights + Beat Shockwaves & Sparks
    ctx.save();
    for (let b = 0; b < 3; b++) {
      const angle = (b - 1) * 0.36 + Math.sin(t * 2.1 + b) * 0.18;
      ctx.save();
      ctx.translate(w * (0.2 + b * 0.3), -h * 0.04);
      ctx.rotate(angle);
      const beam = ctx.createLinearGradient(0, 0, 0, h * 0.85);
      beam.addColorStop(0, `${b % 2 === 0 ? c2 : c1}aa`);
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-w * 0.04, 0);
      ctx.lineTo(w * 0.04, 0);
      ctx.lineTo(w * 0.24, h * 0.85);
      ctx.lineTo(-w * 0.24, h * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Center shockwave ring pulsing with beat
    const ringR = w * (0.18 + ((t * 1.3) % 1) * 0.3);
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = Math.max(0.1, 0.7 - ((t * 1.3) % 1) * 0.6);
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.44, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Floating beat sparks
    ctx.globalAlpha = 0.85;
    for (let s = 0; s < 14; s++) {
      const px = w * ((0.15 + ((s * 0.23 + t * 0.18) % 0.72)));
      const py = h * (0.16 + ((s * 0.19 - t * 0.25 + 10) % 0.56));
      ctx.fillStyle = s % 2 === 0 ? '#ffffff' : c2;
      ctx.beginPath();
      ctx.arc(px, py, w * (0.008 + beatPulse * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (slotMod === 3) {
    // Scene 3: Editorial Split-Frame Portrait Card + Optical Prism Flares
    ctx.save();
    const cardW = w * 0.62;
    const cardH = h * 0.48;
    const cx = w * 0.5;
    const cy = h * 0.41;
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 1.5) * 0.05);
    const cardGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
    cardGrad.addColorStop(0, c1);
    cardGrad.addColorStop(1, c2);
    ctx.fillStyle = cardGrad;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

    // Stylized silhouette inside card
    ctx.fillStyle = 'rgba(10,10,16,0.88)';
    ctx.beginPath();
    ctx.arc(0, -cardH * 0.1, cardW * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, cardH * 0.3, cardW * 0.42, cardH * 0.26, 0, Math.PI, 0, false);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.restore();
  } else {
    // Scene 4: Kinetic Bokeh + Equalizer Wave Field
    for (let i = 0; i < 6; i++) {
      const ang = t * (0.7 + i * 0.14) + i * 1.3;
      const bx = w * (0.5 + 0.34 * Math.cos(ang));
      const by = h * (0.28 + 0.32 * Math.sin(ang * 0.9));
      const br = w * (0.18 + 0.05 * Math.sin(t * 2 + i));
      const orb = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      orb.addColorStop(0, `${i % 2 === 0 ? c2 : c1}99`);
      orb.addColorStop(1, 'transparent');
      ctx.fillStyle = orb;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    const bars = 13;
    const bw = w / (bars * 1.9);
    const sx = (w - bars * bw * 1.45) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (let b = 0; b < bars; b++) {
      const bh = h * (0.04 + 0.12 * Math.abs(Math.sin(t * 5.2 + b * 0.6)));
      ctx.fillRect(sx + b * bw * 1.45, h * 0.44 - bh / 2, bw, bh);
    }
  }

  // Subtle film sprocket edge accent on side margins for realistic reel vibe
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  const notchH = h * 0.018;
  const notchW = Math.max(3, w * 0.018);
  const offset = (t * h * 0.12) % (notchH * 2.4);
  for (let y = -notchH * 2; y < h; y += notchH * 2.4) {
    ctx.fillRect(w * 0.018, y + offset, notchW, notchH);
    ctx.fillRect(w - w * 0.018 - notchW, y + offset, notchW, notchH);
  }
  ctx.restore();
}

function drawTemplateFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsedSec: number,
  template: VideoTemplateDef,
  slotClips: (LoadedMediaClip | null)[],
  slotWindows: SlotWindow[],
  overlayText: string,
  secondaryText: string,
  speedMultiplier: number,
  activeTransitions: TemplateEffectTransition[],
  colorGrade: Pick<ColorGradePreset, 'filterCss' | 'tintRgba'>
): number {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, w, h);

  const beatsPerSec = (template.bpm / 60) * speedMultiplier;
  const beatPos = elapsedSec * beatsPerSec;
  const beatFraction = beatPos - Math.floor(beatPos);
  const beatPulse = Math.exp(-beatFraction * 5.2);

  // Locate exact active slot window based on elapsedSec
  let activeSlotIdx = 0;
  let activeWin = slotWindows[0] || {
    index: 0,
    startSec: 0,
    endSec: 3,
    durationSec: 3,
    label: 'Slot 1',
  };
  for (let i = 0; i < slotWindows.length; i++) {
    if (elapsedSec >= slotWindows[i].startSec && elapsedSec < slotWindows[i].endSec) {
      activeSlotIdx = i;
      activeWin = slotWindows[i];
      break;
    }
    if (i === slotWindows.length - 1 && elapsedSec >= slotWindows[i].startSec) {
      activeSlotIdx = i;
      activeWin = slotWindows[i];
    }
  }

  const prevSlotIdx =
    (activeSlotIdx - 1 + Math.max(1, slotWindows.length)) % Math.max(1, slotWindows.length);
  const timeInCut = Math.max(0, elapsedSec - activeWin.startSec);
  const clipLocalT = Math.min(1, timeInCut / Math.max(0.4, activeWin.durationSec));
  const totalEffectiveDuration =
    slotWindows.length > 0
      ? slotWindows[slotWindows.length - 1].endSec
      : Math.max(4, template.durationSec / speedMultiplier);

  const transitionsPool =
    activeTransitions.length > 0 ? activeTransitions : template.transitions;
  const currentTransition = transitionsPool[activeSlotIdx % transitionsPool.length];
  const hasZoom = transitionsPool.includes('zoom-in') || currentTransition === 'zoom-in';
  const hasShake = transitionsPool.includes('shake') || currentTransition === 'shake';
  const hasFlash = transitionsPool.includes('flash') || currentTransition === 'flash';
  const hasSlide = currentTransition === 'slide';

  const transitionWindowSec = 0.28;
  const inTransition = activeSlotIdx > 0 && timeInCut < transitionWindowSec;
  const slideEase = inTransition ? easeOutCubic(timeInCut / transitionWindowSec) : 1;

  let scale = 1.03;
  let tx = 0;
  let ty = 0;
  let tiltRad = 0;

  if (hasZoom) {
    const entryBoost = inTransition ? (1 - slideEase) * 0.14 : 0;
    scale += clipLocalT * 0.14 + beatPulse * 0.08 + entryBoost;
  } else {
    scale += beatPulse * 0.05;
  }

  if (template.transitionStyle === '3d_zoom') {
    const swing = Math.sin(clipLocalT * Math.PI);
    scale += 0.08 + swing * 0.16;
    tx += Math.sin(elapsedSec * 2.1) * (w * 0.025);
    ty += Math.cos(elapsedSec * 1.7) * (h * 0.015);
    tiltRad += Math.sin(elapsedSec * 1.9) * 0.024;
  } else if (template.transitionStyle === 'velocity_edit') {
    const ramp = Math.pow(clipLocalT, 2.2);
    scale += ramp * 0.18 + beatPulse * 0.09;
  } else if (template.transitionStyle === 'blur_glow') {
    scale += clipLocalT * 0.08;
  }

  if (template.transitionStyle === 'ken_burns') {
    scale += clipLocalT * 0.06;
    tx += (clipLocalT - 0.5) * (w * 0.035);
    ty += (0.5 - clipLocalT) * (h * 0.02);
  }

  if (hasShake) {
    const cutDecay = Math.exp(-timeInCut * 8.5);
    const shakeStrength =
      currentTransition === 'shake'
        ? Math.max(beatPulse, cutDecay)
        : beatPulse * 0.65;
    tx += Math.sin(elapsedSec * 42) * shakeStrength * (w * 0.022);
    ty += Math.cos(elapsedSec * 34) * shakeStrength * (h * 0.013);
    tiltRad = Math.sin(elapsedSec * 38) * shakeStrength * 0.018;
  }

  ctx.save();
  try {
    if ('filter' in ctx) {
      const blurPx =
        template.transitionStyle === 'blur_glow' && timeInCut < 0.35
          ? Math.max(0, (1 - timeInCut / 0.35) * 6).toFixed(1)
          : '0';
      ctx.filter =
        blurPx !== '0'
          ? `${colorGrade.filterCss} blur(${blurPx}px)`
          : colorGrade.filterCss;
    }
  } catch {
    // ignore unsupported canvas filter fallback
  }

  const renderSlotContent = (
    slotIdx: number,
    sc: number,
    ox: number,
    oy: number,
    rot = 0,
    alpha = 1
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (rot !== 0) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rot);
      ctx.translate(-w / 2, -h / 2);
    }

    const c = slotClips[slotIdx] || null;
    if (c) {
      const cropZoom = c.cropZoom || 1;
      const cropOx = (c.cropPanX || 0) * w * 0.3;
      const cropOy = (c.cropPanY || 0) * h * 0.3;
      if (
        c.mediaType === 'image' &&
        c.imageEl &&
        c.imageEl.complete &&
        c.imageEl.naturalWidth > 0
      ) {
        drawCoverImageOrVideo(
          ctx,
          c.imageEl,
          c.imageEl.naturalWidth,
          c.imageEl.naturalHeight,
          w,
          h,
          sc * cropZoom,
          ox + cropOx,
          oy + cropOy
        );
        ctx.restore();
        return;
      }
      if (c.mediaType === 'video' && c.videoEl && c.videoEl.videoWidth > 0) {
        drawCoverImageOrVideo(
          ctx,
          c.videoEl,
          c.videoEl.videoWidth,
          c.videoEl.videoHeight,
          w,
          h,
          sc * cropZoom,
          ox + cropOx,
          oy + cropOy
        );
        ctx.restore();
        return;
      }
    }

    ctx.save();
    ctx.translate(w / 2 + ox, h / 2 + oy);
    ctx.scale(sc, sc);
    ctx.translate(-w / 2, -h / 2);
    drawProceduralScene(ctx, w, h, elapsedSec, template, slotIdx, beatPulse);
    ctx.restore();
    ctx.restore();
  };

  if (hasSlide && inTransition) {
    const outX = -slideEase * w;
    const inX = (1 - slideEase) * w;
    renderSlotContent(prevSlotIdx, 1.04, outX, 0, 0, 1);
    renderSlotContent(activeSlotIdx, scale, inX + tx, ty, tiltRad, 1);

    const seamGrad = ctx.createLinearGradient(inX - w * 0.06, 0, inX, 0);
    seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
    seamGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = seamGrad;
    ctx.fillRect(inX - w * 0.06, 0, w * 0.06, h);
  } else {
    renderSlotContent(activeSlotIdx, scale, tx, ty, tiltRad, 1);
    if (!hasSlide && slotWindows.length > 1 && clipLocalT > 0.88 && !hasFlash) {
      const nextIdx = (activeSlotIdx + 1) % slotWindows.length;
      const fadeAlpha = (clipLocalT - 0.88) / 0.12;
      renderSlotContent(nextIdx, 1.03, 0, 0, 0, Math.min(1, fadeAlpha));
    }
  }
  ctx.restore();

  if (colorGrade.tintRgba) {
    ctx.save();
    ctx.fillStyle = colorGrade.tintRgba;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (template.transitionStyle === 'blur_glow') {
    const glowAlpha = Math.min(
      0.55,
      (timeInCut < 0.45 ? (1 - timeInCut / 0.45) * 0.48 : 0.12) + beatPulse * 0.15
    );
    const bloom = ctx.createRadialGradient(
      w / 2,
      h * 0.42,
      w * 0.04,
      w / 2,
      h * 0.42,
      w * 0.78
    );
    bloom.addColorStop(0, `rgba(255, 228, 246, ${glowAlpha})`);
    bloom.addColorStop(0.55, `rgba(236, 72, 153, ${glowAlpha * 0.45})`);
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);
  }

  if (hasFlash) {
    const cutFlash = activeSlotIdx > 0 ? Math.exp(-timeInCut * 14) * 0.72 : 0;
    const beatFlash = currentTransition === 'flash' ? beatPulse * 0.16 : 0;
    const flashAlpha = Math.min(0.82, cutFlash + beatFlash);
    if (flashAlpha > 0.015) {
      ctx.fillStyle =
        template.category === 'neon_glow' || template.transitionStyle === '3d_zoom'
          ? `rgba(224, 242, 254, ${flashAlpha})`
          : `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  if (template.category === 'neon_glow' || template.transitionStyle === 'neon_flash') {
    ctx.save();
    ctx.strokeStyle = beatPulse > 0.45 ? '#ec4899' : '#06b6d4';
    ctx.lineWidth = Math.max(2.5, w * 0.01);
    ctx.globalAlpha = 0.42 + beatPulse * 0.45;
    ctx.strokeRect(w * 0.025, h * 0.025, w * 0.95, h * 0.95);
    ctx.restore();
  } else if (template.transitionStyle === 'ken_burns') {
    const barH = h * 0.105;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillRect(0, h - barH, w, barH);
  } else if (template.transitionStyle === 'lyrics_frame') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    const padX = w * 0.075;
    const padY = h * 0.11;
    ctx.strokeRect(padX, padY, w - padX * 2, h - padY * 2.4);
    ctx.restore();
  } else if (template.transitionStyle === 'spiritual_aura') {
    const aura = ctx.createRadialGradient(
      w / 2,
      h * 0.42,
      w * 0.08,
      w / 2,
      h * 0.42,
      w * 0.72
    );
    aura.addColorStop(0, `rgba(251, 191, 36, ${0.14 + beatPulse * 0.1})`);
    aura.addColorStop(0.65, 'rgba(16, 185, 129, 0.08)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);
  } else {
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.24, w / 2, h / 2, h * 0.68);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.42 + beatPulse * 0.14})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Bottom legibility scrim
  const scrim = ctx.createLinearGradient(0, h * 0.52, 0, h);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.55, 'rgba(0,0,0,0.48)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  // Kinetic Typography & Song-Synced Lyrics Overlay
  const mainTitle = overlayText.trim();
  let subTitle = secondaryText.trim();
  if (
    template.lyricLines &&
    template.lyricLines.length > 0 &&
    subTitle === template.defaultSecondaryText.trim()
  ) {
    const lineIdx =
      Math.floor((elapsedSec / totalEffectiveDuration) * template.lyricLines.length) %
      template.lyricLines.length;
    subTitle = template.lyricLines[lineIdx] || subTitle;
  }

  const titleScale = 1 + beatPulse * 0.055;
  const titleFontSize = Math.round(w * 0.072);
  const subFontSize = Math.round(w * 0.036);

  if (mainTitle) {
    ctx.save();
    ctx.translate(w / 2, template.transitionStyle === 'lyrics_frame' ? h * 0.7 : h * 0.73);
    ctx.scale(titleScale, titleScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${titleFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.shadowColor = template.accentColor;
    ctx.shadowBlur = Math.round(w * 0.045);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mainTitle.slice(0, 26), 0, 0, w * 0.86);
    ctx.restore();
  }

  if (subTitle) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${subFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(244, 244, 245, 0.94)';
    const lyricY = template.transitionStyle === 'lyrics_frame' ? h * 0.775 : h * 0.8;
    ctx.fillText(subTitle.slice(0, 48), w / 2, lyricY, w * 0.84);
    ctx.restore();
  }

  if (
    template.category === 'beat_sync' ||
    template.category === 'bhangra_punjabi' ||
    template.category === 'neon_glow' ||
    template.category === 'tiktok_viral'
  ) {
    const barCount = 9;
    const bw = Math.max(2, w * 0.008);
    const gap = bw * 1.8;
    const totalW = barCount * bw + (barCount - 1) * gap;
    const sx = (w - totalW) / 2;
    ctx.save();
    ctx.fillStyle = template.accentColor;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < barCount; i++) {
      const barH =
        h *
        (0.01 +
          0.022 * Math.abs(Math.sin(elapsedSec * 6.5 + i * 0.8)) * (0.5 + beatPulse));
      ctx.fillRect(sx + i * (bw + gap), h * 0.865 - barH / 2, bw, barH);
    }
    ctx.restore();
  }

  ctx.restore();
  return activeSlotIdx;
}

const TemplateAnimatedPreview: React.FC<{ template: VideoTemplateDef }> = React.memo(
  ({ template }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    const previewWindows = useMemo(
      () =>
        getTemplateSlotWindows(
          template,
          template.requiredClips,
          template.defaultSpeedMultiplier
        ).windows,
      [template]
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (typeof IntersectionObserver !== 'undefined') {
        const obs = new IntersectionObserver(
          (entries) => {
            setIsVisible(Boolean(entries[0]?.isIntersecting));
          },
          { threshold: 0.05 }
        );
        obs.observe(canvas);
        return () => obs.disconnect();
      }
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !isVisible) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let rafId = 0;
      let lastDraw = 0;
      const startAt = performance.now();
      const totalDur =
        previewWindows.length > 0
          ? previewWindows[previewWindows.length - 1].endSec
          : template.durationSec;

      const tick = (now: number) => {
        if (now - lastDraw >= 33) {
          lastDraw = now;
          const elapsed = ((now - startAt) / 1000) % Math.max(3, totalDur);
          drawTemplateFrame(
            ctx,
            canvas.width,
            canvas.height,
            elapsed,
            template,
            [],
            previewWindows,
            template.defaultOverlayText,
            template.defaultSecondaryText,
            template.defaultSpeedMultiplier,
            template.transitions,
            {
              filterCss: template.filterCss,
              tintRgba: template.colorTintRgba,
            }
          );
        }
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, [template, previewWindows, isVisible]);

    return (
      <canvas
        ref={canvasRef}
        width={216}
        height={360}
        className="w-full h-full object-cover block gpu-accelerated"
      />
    );
  }
);

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

const TemplatesStudioViewComponent: React.FC<TemplatesStudioViewProps> = ({
  currentUser,
  creatorProfile,
  onPostSuccess,
  onPostSynced,
  onBackToFeed,
  onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [activeTemplate, setActiveTemplate] = useState<VideoTemplateDef | null>(null);

  // Per-slot media clips (index 0..requiredClips-1, fixed CapCut tray slots)
  const [slotClips, setSlotClips] = useState<(LoadedMediaClip | null)[]>([]);
  const [selectedSlotForAction, setSelectedSlotForAction] = useState<number | null>(null);
  const [croppingSlotIndex, setCroppingSlotIndex] = useState<number | null>(null);
  const [trayMode, setTrayMode] = useState<'slots' | 'customize'>('slots');

  // Studio customization state
  const [overlayText, setOverlayText] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [activeTransitions, setActiveTransitions] = useState<TemplateEffectTransition[]>([
    'zoom-in',
  ]);
  const [selectedColorGrade, setSelectedColorGrade] = useState<ColorGradePreset>(
    TEMPLATE_COLOR_GRADES[0]
  );
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrackOption | null>(null);
  const [selectedOnlineSong, setSelectedOnlineSong] = useState<AttachedOnlineSong | null>(null);
  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = useState(false);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [previewProgressPct, setPreviewProgressPct] = useState(0);
  const [activePlayingSlotIdx, setActivePlayingSlotIdx] = useState(0);
  const [previewElapsedSec, setPreviewElapsedSec] = useState(0);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);

  // Export sheet & progress state
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressPct, setExportProgressPct] = useState(0);
  const [exportActionLabel, setExportActionLabel] = useState('');

  // Crop drag refs
  const cropDragRef = useRef<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const mediaPickerRef = useRef<HTMLInputElement | null>(null);
  const singleSlotPickerRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const customAudioElRef = useRef<HTMLAudioElement | null>(null);
  const exportCancelledRef = useRef(false);
  const activeTemplateRef = useRef<VideoTemplateDef | null>(null);
  const targetSlotIndexRef = useRef<number | null>(null);
  targetSlotIndexRef.current = targetSlotIndex;
  const slotClipsRef = useRef<(LoadedMediaClip | null)[]>([]);
  slotClipsRef.current = slotClips;

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return VIDEO_TEMPLATES;
    return VIDEO_TEMPLATES.filter(
      (t) => t.category === selectedCategory || t.categories.includes(selectedCategory)
    );
  }, [selectedCategory]);

  const { windows: slotWindows, totalDurationSec } = useMemo(() => {
    if (!activeTemplate) return { windows: [] as SlotWindow[], totalDurationSec: 12 };
    return getTemplateSlotWindows(
      activeTemplate,
      Math.max(activeTemplate.requiredClips, slotClips.length),
      speedMultiplier
    );
  }, [activeTemplate, slotClips.length, speedMultiplier]);

  const beatCutMarkersPct = useMemo(() => {
    if (slotWindows.length <= 1 || totalDurationSec <= 0) return [];
    return slotWindows.slice(1).map((win) => (win.startSec / totalDurationSec) * 100);
  }, [slotWindows, totalDurationSec]);

  const filledSlotsCount = useMemo(
    () => slotClips.filter((c): c is LoadedMediaClip => c !== null).length,
    [slotClips]
  );

  const allSlotsFilled = useMemo(() => {
    if (!activeTemplate) return false;
    return filledSlotsCount >= activeTemplate.requiredClips;
  }, [activeTemplate, filledSlotsCount]);

  const currentSongLabel = useMemo(() => {
    if (customAudioFile) {
      return customAudioFile.name.replace(/\.[^/.]+$/, '');
    }
    if (selectedOnlineSong) {
      return selectedOnlineSong.title;
    }
    return selectedAudioTrack?.title || 'Template Beat';
  }, [customAudioFile, selectedOnlineSong, selectedAudioTrack]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      soundEngine.stopPreviewTrack();
      if (customAudioElRef.current) {
        customAudioElRef.current.pause();
        customAudioElRef.current = null;
      }
      for (const c of slotClipsRef.current) {
        if (!c) continue;
        try {
          c.videoEl?.pause();
          URL.revokeObjectURL(c.url);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopPreviewAudio = useCallback(() => {
    soundEngine.stopPreviewTrack();
    if (customAudioElRef.current) {
      customAudioElRef.current.pause();
    }
  }, []);

  const startPreviewAudio = useCallback(
    (track: AudioTrackOption | null, customUrl: string, muted: boolean) => {
      stopPreviewAudio();
      if (muted) return;
      if (customUrl) {
        try {
          const audio = new Audio(customUrl);
          audio.loop = true;
          audio.volume = 0.85;
          customAudioElRef.current = audio;
          void audio.play().catch(() => {
            // browser autoplay guard
          });
          return;
        } catch {
          // fallback to synth
        }
      }
      if (track) {
        soundEngine.playPreviewTrack(track.trackType, 0.78);
      }
    },
    [stopPreviewAudio]
  );

  const initializeTemplateEditor = useCallback(
    (tpl: VideoTemplateDef) => {
      for (const c of slotClipsRef.current) {
        if (!c) continue;
        try {
          c.videoEl?.pause();
          URL.revokeObjectURL(c.url);
        } catch {
          // ignore
        }
      }
      const initialSlots = Array.from({ length: tpl.requiredClips }, () => null);
      slotClipsRef.current = initialSlots;
      setSlotClips(initialSlots);
      setSelectedSlotForAction(null);
      setCroppingSlotIndex(null);
      setTrayMode('slots');
      setIsExportSheetOpen(false);

      activeTemplateRef.current = tpl;
      setActiveTemplate(tpl);
      setOverlayText(tpl.defaultOverlayText);
      setSecondaryText(tpl.defaultSecondaryText);
      setSpeedMultiplier(tpl.defaultSpeedMultiplier);
      setActiveTransitions([...tpl.transitions]);
      setSelectedColorGrade({
        id: 'tpl_preset',
        name: tpl.colorGradeName,
        filterCss: tpl.filterCss,
        tintRgba: tpl.colorTintRgba,
      });
      setCustomAudioFile(null);
      if (customAudioUrl) {
        try {
          URL.revokeObjectURL(customAudioUrl);
        } catch {
          // ignore
        }
      }
      setCustomAudioUrl('');
      setAllowDownload(true);
      setIsAudioMuted(false);
      setIsPreviewPlaying(true);
      setPreviewProgressPct(0);
      setActivePlayingSlotIdx(0);
      setPreviewElapsedSec(0);

      const defaultTrack =
        CURATED_AUDIO_LIBRARY.find((a) => a.id === tpl.defaultAudioTrackId) ||
        CURATED_AUDIO_LIBRARY[0];
      setSelectedAudioTrack(defaultTrack);
      setSelectedOnlineSong(null);
      setTargetSlotIndex(null);
      startPreviewAudio(defaultTrack, '', false);
    },
    [customAudioUrl, startPreviewAudio]
  );

  const handleUseTemplate = (tpl: VideoTemplateDef) => {
    initializeTemplateEditor(tpl);
    onShowToast(`Tap + on each slot below to add ${tpl.requiredClips} clips`);
  };

  const handleCloseEditor = () => {
    exportCancelledRef.current = true;
    stopPreviewAudio();
    for (const c of slotClipsRef.current) {
      if (!c) continue;
      try {
        c.videoEl?.pause();
        URL.revokeObjectURL(c.url);
      } catch {
        // ignore
      }
    }
    slotClipsRef.current = [];
    setSlotClips([]);
    setSelectedSlotForAction(null);
    setCroppingSlotIndex(null);
    setIsExportSheetOpen(false);
    activeTemplateRef.current = null;
    setActiveTemplate(null);
    setSelectedOnlineSong(null);
    setTargetSlotIndex(null);
  };

  const loadSingleMediaFile = async (file: File): Promise<LoadedMediaClip | null> => {
    const check = validateSafeMediaFile(file);
    if (!check.valid) {
      onShowToast(
        check.reason ||
          'Blocked unsafe file. Only .mp4, .webm, .jpg, .png, .webp allowed.'
      );
      return null;
    }

    const url = URL.createObjectURL(file);
    const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (check.mediaType === 'image' || file.type.startsWith('image/')) {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        window.setTimeout(resolve, 1500);
      });
      return {
        id: clipId,
        file,
        url,
        mediaType: 'image',
        name: file.name,
        durationSec: 3,
        imageEl: img,
        cropZoom: 1,
        cropPanX: 0,
        cropPanY: 0,
      };
    }

    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.playsInline = true;
    vid.loop = true;
    vid.preload = 'auto';
    await new Promise<void>((resolve) => {
      vid.onloadeddata = () => resolve();
      vid.onerror = () => resolve();
      window.setTimeout(resolve, 2000);
    });
    void vid.play().catch(() => {
      // ignore autoplay restriction
    });
    return {
      id: clipId,
      file,
      url,
      mediaType: 'video',
      name: file.name,
      durationSec: Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 4,
      videoEl: vid,
      cropZoom: 1,
      cropPanX: 0,
      cropPanY: 0,
    };
  };

  // Batch-select multiple photos/videos into empty slots first
  const handlePickGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    const tpl = activeTemplateRef.current || activeTemplate;
    if (fileList.length === 0 || !tpl) return;

    const currentSlots = [...slotClipsRef.current];
    const emptyIndices: number[] = [];
    for (let i = 0; i < currentSlots.length; i++) {
      if (!currentSlots[i]) emptyIndices.push(i);
    }

    if (emptyIndices.length === 0) {
      onShowToast('All slots are already filled. Tap any slot to Replace or Crop.');
      return;
    }

    const toProcess = fileList.slice(0, emptyIndices.length);
    let filled = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const item = await loadSingleMediaFile(toProcess[i]);
      if (item) {
        currentSlots[emptyIndices[i]] = item;
        filled += 1;
      }
    }

    if (filled > 0) {
      setSlotClips(currentSlots);
      setSelectedSlotForAction(null);
      setIsPreviewPlaying(true);
      startPreviewAudio(
        selectedAudioTrack,
        customAudioUrl || selectedOnlineSong?.streamUrl || '',
        isAudioMuted
      );
      onShowToast(
        `Added ${filled} clip${filled === 1 ? '' : 's'} into template slots!`
      );
    }
  };

  // Pick a file specifically for tapped slotIdx
  const handlePickSingleSlotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const tpl = activeTemplateRef.current || activeTemplate;
    const slotIdx = targetSlotIndexRef.current;
    setTargetSlotIndex(null);
    if (!file || !tpl || slotIdx === null) return;

    const item = await loadSingleMediaFile(file);
    if (!item) return;

    setSlotClips((prev) => {
      const next = [...prev];
      const old = next[slotIdx];
      if (old) {
        try {
          old.videoEl?.pause();
          URL.revokeObjectURL(old.url);
        } catch {
          // ignore
        }
      }
      next[slotIdx] = item;
      return next;
    });
    setSelectedSlotForAction(slotIdx);
    setIsPreviewPlaying(true);
    startPreviewAudio(
      selectedAudioTrack,
      customAudioUrl || selectedOnlineSong?.streamUrl || '',
      isAudioMuted
    );
    onShowToast(`Slot ${slotIdx + 1} updated`);
  };

  const handleClearSlot = (slotIdx: number) => {
    setSlotClips((prev) => {
      const next = [...prev];
      const target = next[slotIdx];
      if (target) {
        try {
          target.videoEl?.pause();
          URL.revokeObjectURL(target.url);
        } catch {
          // ignore
        }
      }
      next[slotIdx] = null;
      return next;
    });
    setSelectedSlotForAction(null);
  };

  const handleMoveSlot = (index: number, direction: -1 | 1) => {
    setSlotClips((prev) => {
      const nextIdx = index + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
    setSelectedSlotForAction((prev) => (prev === index ? index + direction : prev));
  };

  const handleUpdateSlotCrop = (
    slotIdx: number,
    patch: Partial<Pick<LoadedMediaClip, 'cropZoom' | 'cropPanX' | 'cropPanY'>>
  ) => {
    setSlotClips((prev) =>
      prev.map((c, idx) => (idx === slotIdx && c ? { ...c, ...patch } : c))
    );
  };

  const handleToggleTransition = (tr: TemplateEffectTransition) => {
    setActiveTransitions((prev) => {
      if (prev.includes(tr)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== tr);
      }
      return [...prev, tr];
    });
  };

  // Sync video clips play/pause with preview playback state
  useEffect(() => {
    for (const c of slotClips) {
      if (!c) continue;
      if (c.videoEl) {
        c.videoEl.playbackRate = speedMultiplier;
        if (isPreviewPlaying && !isExporting) {
          void c.videoEl.play().catch(() => {
            // ignore
          });
        } else if (!isExporting) {
          c.videoEl.pause();
        }
      }
    }
  }, [slotClips, isPreviewPlaying, speedMultiplier, isExporting]);

  // Real-time interactive Canvas preview loop inside CapCut Editor
  useEffect(() => {
    if (!activeTemplate || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let startAt = performance.now();
    let pausedAtSec = 0;

    const drawLoop = (now: number) => {
      const elapsed = isPreviewPlaying ? (now - startAt) / 1000 : pausedAtSec;
      pausedAtSec = elapsed;
      const loopT = elapsed % totalDurationSec;
      setPreviewProgressPct((loopT / totalDurationSec) * 100);
      setPreviewElapsedSec(loopT);

      const activeIdx = drawTemplateFrame(
        ctx,
        canvas.width,
        canvas.height,
        loopT,
        activeTemplate,
        slotClips,
        slotWindows,
        overlayText,
        secondaryText,
        speedMultiplier,
        activeTransitions,
        selectedColorGrade
      );
      setActivePlayingSlotIdx(activeIdx);

      if (isPreviewPlaying) {
        rafId = requestAnimationFrame(drawLoop);
      }
    };

    if (!isPreviewPlaying) {
      drawLoop(performance.now());
      return;
    }

    startAt = performance.now();
    rafId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeTemplate,
    slotClips,
    slotWindows,
    totalDurationSec,
    overlayText,
    secondaryText,
    speedMultiplier,
    activeTransitions,
    selectedColorGrade,
    isPreviewPlaying,
  ]);

  // Render full 720x1280 video blob + poster snapshot
  const renderTemplateToVideoBlob = async (): Promise<{
    blob: Blob;
    posterDataUrl: string;
    mimeType: string;
  }> => {
    if (!activeTemplate) throw new Error('No template selected');
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = 720;
    renderCanvas.height = 1280;
    const ctx = renderCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const totalSec = Math.max(4, Math.min(25, Math.round(totalDurationSec * 10) / 10));

    for (const c of slotClips) {
      if (c?.videoEl) {
        try {
          c.videoEl.currentTime = 0;
          c.videoEl.playbackRate = speedMultiplier;
          await c.videoEl.play().catch(() => {});
        } catch {
          // ignore
        }
      }
    }

    drawTemplateFrame(
      ctx,
      720,
      1280,
      0,
      activeTemplate,
      slotClips,
      slotWindows,
      overlayText,
      secondaryText,
      speedMultiplier,
      activeTransitions,
      selectedColorGrade
    );
    let posterDataUrl = '';
    try {
      posterDataUrl = renderCanvas.toDataURL('image/jpeg', 0.85);
    } catch {
      posterDataUrl = '';
    }

    if (
      typeof renderCanvas.captureStream !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      const blob = await new Promise<Blob>((resolve) =>
        renderCanvas.toBlob(
          (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
          'image/jpeg',
          0.92
        )
      );
      return { blob, posterDataUrl, mimeType: blob.type || 'image/jpeg' };
    }

    const mimeType = pickSupportedRecorderMime();
    const canvasStream = renderCanvas.captureStream(30);

    let audioCtx: AudioContext | null = null;
    let exportAudioEl: HTMLAudioElement | null = null;
    let synthExportHandle: { stream: MediaStream; stop: () => void } | null = null;
    const activeAudioSrc = customAudioUrl || selectedOnlineSong?.streamUrl || '';
    if (!isAudioMuted && activeAudioSrc) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioCtx();
        exportAudioEl = new Audio(activeAudioSrc);
        exportAudioEl.crossOrigin = 'anonymous';
        exportAudioEl.loop = true;
        const srcNode = audioCtx.createMediaElementSource(exportAudioEl);
        const dest = audioCtx.createMediaStreamDestination();
        srcNode.connect(dest);
        dest.stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));
        void exportAudioEl.play().catch(() => {});
      } catch {
        // Fallback: video stream only, feed plays soundEngine
      }
    } else if (!isAudioMuted && selectedAudioTrack) {
      synthExportHandle = soundEngine.createExportAudioStream(
        selectedAudioTrack.trackType,
        0.85
      );
      if (synthExportHandle) {
        synthExportHandle.stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));
      }
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 4_500_000,
    });
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const stoppedPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' }));
      };
    });

    exportCancelledRef.current = false;
    recorder.start(200);

    const startTime = performance.now();
    let capturedMidPoster = false;

    await new Promise<void>((resolve) => {
      const step = () => {
        if (exportCancelledRef.current) {
          resolve();
          return;
        }
        const elapsed = (performance.now() - startTime) / 1000;
        const pct = Math.min(100, Math.round((elapsed / totalSec) * 100));
        setExportProgressPct(pct);

        drawTemplateFrame(
          ctx,
          720,
          1280,
          elapsed,
          activeTemplate,
          slotClips,
          slotWindows,
          overlayText,
          secondaryText,
          speedMultiplier,
          activeTransitions,
          selectedColorGrade
        );

        if (!capturedMidPoster && elapsed >= totalSec * 0.35) {
          capturedMidPoster = true;
          try {
            posterDataUrl = renderCanvas.toDataURL('image/jpeg', 0.85);
          } catch {
            // ignore
          }
        }

        if (elapsed >= totalSec) {
          resolve();
        } else {
          window.setTimeout(step, 33);
        }
      };
      step();
    });

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch {
      // ignore
    }

    if (exportAudioEl) {
      exportAudioEl.pause();
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
    }
    if (synthExportHandle) {
      synthExportHandle.stop();
    }
    canvasStream.getTracks().forEach((t) => t.stop());

    const blob = await stoppedPromise;
    return {
      blob,
      posterDataUrl,
      mimeType: blob.type || 'video/webm',
    };
  };

  const handleOpenExportSheet = () => {
    if (!activeTemplate) return;
    if (filledSlotsCount === 0) {
      onShowToast('Add at least 1 photo or video slot before exporting.');
      const firstEmpty = slotClips.findIndex((c) => c === null);
      if (firstEmpty >= 0) {
        setTargetSlotIndex(firstEmpty);
        singleSlotPickerRef.current?.click();
      }
      return;
    }
    setIsExportSheetOpen(true);
  };

  const handleSaveToGallery = async () => {
    if (!activeTemplate || isExporting) return;
    if (filledSlotsCount < activeTemplate.minClips) {
      onShowToast(`Please fill at least ${activeTemplate.minClips} slot first.`);
      return;
    }

    stopPreviewAudio();
    setIsPreviewPlaying(false);
    setIsExporting(true);
    setExportProgressPct(0);
    setExportActionLabel('Rendering 9:16 HD Video...');

    try {
      const { blob, mimeType } = await renderTemplateToVideoBlob();
      if (exportCancelledRef.current) {
        onShowToast('Export cancelled');
        return;
      }

      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('jpeg') ? 'jpg' : 'webm';
      const safeFileSlug = activeTemplate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `jatt-vibereels-${safeFileSlug}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(dlUrl), 10_000);

      setIsExportSheetOpen(false);
      onShowToast('Synced template video exported to your device!');
    } catch (err) {
      console.error('Template export failed:', err);
      onShowToast('Could not render template video on this device.');
    } finally {
      setIsExporting(false);
      setExportProgressPct(0);
      setExportActionLabel('');
    }
  };

  const handlePostToFeed = async () => {
    if (!activeTemplate || isExporting) return;
    if (filledSlotsCount < activeTemplate.minClips) {
      onShowToast(`Please fill at least ${activeTemplate.minClips} slot before posting.`);
      return;
    }

    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast(
        `Anti-spam protection: Max 5 uploads per minute. Wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }

    stopPreviewAudio();
    setIsPreviewPlaying(false);
    setIsExporting(true);
    setExportProgressPct(0);
    setExportActionLabel('Rendering & Publishing Template Reel...');

    try {
      const { blob, posterDataUrl, mimeType } = await renderTemplateToVideoBlob();
      if (exportCancelledRef.current) {
        onShowToast('Publish cancelled');
        return;
      }

      recordRateLimitEvent('upload');
      const isStillFallback = mimeType.startsWith('image/');
      const ext = mimeType.includes('mp4') ? 'mp4' : isStillFallback ? 'jpg' : 'webm';
      const fileName = `template-${activeTemplate.id}-${Date.now()}.${ext}`;
      const renderedFile = new File([blob], fileName, { type: mimeType });

      const cleanTitle =
        sanitizeText(overlayText, 70) || sanitizeText(activeTemplate.name, 70);
      const cleanSecondary = sanitizeText(secondaryText, 120);
      const caption = [
        cleanTitle,
        cleanSecondary,
        `Made with ${activeTemplate.name} Template`,
        activeTemplate.hashtags.map((h) => `#${h}`).join(' '),
      ]
        .filter(Boolean)
        .join(' · ');

      const activeAuthorName = currentUser?.name || creatorProfile.name;
      const activeAuthorUsername = currentUser?.username || creatorProfile.username;
      const activeAuthorAvatar = currentUser?.avatar || creatorProfile.avatar;

      const instantUrl = URL.createObjectURL(blob);
      const trackToUse = selectedAudioTrack || CURATED_AUDIO_LIBRARY[0];

      const soundMeta: VideoPost['sound'] = {
        title: customAudioFile
          ? sanitizeText(customAudioFile.name.replace(/\.[^/.]+$/, ''), 60)
          : selectedOnlineSong
          ? selectedOnlineSong.title
          : trackToUse.title,
        artist: customAudioFile
          ? activeAuthorName
          : selectedOnlineSong
          ? selectedOnlineSong.artist
          : trackToUse.artist,
        trackType: trackToUse.trackType,
        audioUrl: customAudioUrl || selectedOnlineSong?.streamUrl || undefined,
        category: customAudioFile ? 'original' : selectedOnlineSong ? 'song' : trackToUse.category,
        originalVolume: 0.7,
        bgAudioVolume: isAudioMuted ? 0 : 0.85,
        hasAttachedAudio: !isAudioMuted,
      };

      const tempPostId = `tpl-post-${Date.now()}`;
      const optimisticPost: VideoPost = {
        id: tempPostId,
        title: cleanTitle,
        description: caption,
        hashtags: activeTemplate.hashtags,
        videoUrl: instantUrl,
        posterUrl: posterDataUrl || undefined,
        fallbackGradient: `bg-gradient-to-br ${activeTemplate.accentGradient}`,
        category: 'trending',
        userId: creatorProfile.id,
        mediaType: isStillFallback ? 'image' : 'video',
        allowDownload,
        isUserUploaded: true,
        createdAt: new Date().toISOString(),
        creator: {
          name: activeAuthorName,
          username: activeAuthorUsername,
          avatar: activeAuthorAvatar,
          isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
          isFollowing: false,
          bio: currentUser?.bio || creatorProfile.bio,
        },
        sound: soundMeta,
        stats: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          downloads: 0,
        },
        isLiked: false,
        isSaved: false,
        commentsList: [],
      };

      savePostAudioMeta([tempPostId, instantUrl], soundMeta);
      savePostPrivacyMeta([tempPostId, instantUrl], allowDownload);
      saveLocalPostRecord(optimisticPost);
      void savePostForOffline(optimisticPost, {
        sourceType: 'uploaded',
        mediaBlob: blob,
      });

      handleCloseEditor();
      onPostSuccess(optimisticPost);

      void (async () => {
        try {
          const uploadedUrl = await uploadMediaToReelsBucket(
            renderedFile,
            'posts',
            renderedFile.name
          );
          let finalUrl = uploadedUrl || instantUrl;
          if (!uploadedUrl) {
            const persistentDataUrl = await fileToPersistentDataUrl(renderedFile);
            if (persistentDataUrl) {
              finalUrl = persistentDataUrl;
            }
          }

          let finalAudioUrl = soundMeta.audioUrl;
          if (customAudioFile) {
            const uploadedAudio = await uploadMediaToReelsBucket(
              customAudioFile,
              'audio',
              customAudioFile.name
            );
            if (uploadedAudio) finalAudioUrl = uploadedAudio;
          }

          const finalSound: VideoPost['sound'] = {
            ...soundMeta,
            audioUrl: finalAudioUrl,
          };

          const cloudPost = await createGlobalPostInSupabase({
            userId: creatorProfile.id,
            username: activeAuthorUsername,
            displayName: activeAuthorName,
            avatarUrl: activeAuthorAvatar,
            mediaUrl: finalUrl,
            mediaType: isStillFallback ? 'image' : 'video',
            caption,
            allowDownload,
            sound: finalSound,
          });

          if (cloudPost) {
            const reconciled: VideoPost = {
              ...cloudPost,
              title: cleanTitle,
              posterUrl: posterDataUrl || cloudPost.posterUrl,
              allowDownload,
              sound: finalSound,
            };
            savePostAudioMeta([reconciled.id, finalUrl], finalSound);
            savePostPrivacyMeta([reconciled.id, finalUrl], allowDownload);
            saveLocalPostRecord(reconciled);
            onPostSynced(tempPostId, reconciled);
          }
        } catch (syncErr) {
          console.warn('Background template cloud sync failed:', syncErr);
        }
      })();
    } catch (err) {
      console.error('Template post failed:', err);
      onShowToast('Failed to render template video. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgressPct(0);
      setExportActionLabel('');
    }
  };

  const croppingClip =
    croppingSlotIndex !== null ? slotClips[croppingSlotIndex] || null : null;

  return (
    <div className="w-full h-full bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Unconditional Hidden File Inputs for Gallery Picking */}
      <input
        ref={mediaPickerRef}
        type="file"
        multiple
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePickGalleryFiles}
      />
      <input
        ref={singleSlotPickerRef}
        type="file"
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePickSingleSlotFile}
      />

      {activeTemplate ? (
        /* =================================================================
           CAPCUT-STYLE BOTTOM CLIP-SLOT TRAY EDITOR SCREEN
           ================================================================= */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-neutral-950">
          {/* Compact Top Header */}
          <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-neutral-800/80 bg-neutral-950/95">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-center gap-1.5 text-xs font-bold text-neutral-200 cursor-pointer shrink-0"
                aria-label="Back to templates"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Templates</span>
              </button>
              <div className="min-w-0">
                <h2 className="text-sm font-black tracking-tight truncate text-white">
                  {activeTemplate.name}
                </h2>
                <p className="text-[11px] text-neutral-400 truncate tabular-nums">
                  {activeTemplate.requiredClips} Clips • {formatTemplateDuration(totalDurationSec)} •{' '}
                  {activeTemplate.aspectRatio}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isAudioMuted;
                  setIsAudioMuted(nextMuted);
                  if (nextMuted) {
                    stopPreviewAudio();
                  } else if (isPreviewPlaying) {
                    startPreviewAudio(
                      selectedAudioTrack,
                      customAudioUrl || selectedOnlineSong?.streamUrl || '',
                      false
                    );
                  }
                }}
                className={`min-w-[44px] min-h-[44px] px-2.5 rounded-xl border flex items-center justify-center cursor-pointer ${
                  isAudioMuted
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    : 'bg-neutral-900 border-cyan-500/40 text-cyan-300'
                }`}
                title={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
                aria-label={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleOpenExportSheet}
                className={`min-h-[44px] px-3.5 sm:px-4 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                  allSlotsFilled
                    ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-neutral-950 shadow-lg shadow-cyan-500/25 hover:brightness-105'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Video</span>
              </button>
            </div>
          </header>

          {/* Top / Center: Live 9:16 Preview Stage */}
          <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-3 py-2.5 sm:py-4 bg-gradient-to-b from-neutral-950 via-neutral-900/35 to-neutral-950 overflow-hidden">
            <div className="relative h-full max-h-full aspect-[9/16] max-w-[290px] sm:max-w-[330px] rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-2xl gpu-accelerated">
              <canvas
                ref={previewCanvasRef}
                width={360}
                height={640}
                onClick={() => {
                  const nextPlaying = !isPreviewPlaying;
                  setIsPreviewPlaying(nextPlaying);
                  if (nextPlaying) {
                    startPreviewAudio(
                      selectedAudioTrack,
                      customAudioUrl || selectedOnlineSong?.streamUrl || '',
                      isAudioMuted
                    );
                  } else {
                    stopPreviewAudio();
                  }
                }}
                className="w-full h-full object-cover block cursor-pointer"
              />

              {/* Subtle Top Scrim & Active Slot Counter */}
              <div className="absolute top-0 left-0 right-0 px-3 py-2 bg-gradient-to-b from-black/75 to-transparent flex items-center justify-between gap-2 pointer-events-none">
                <span className="text-[11px] font-bold text-white/90 tabular-nums truncate">
                  Clip {activePlayingSlotIdx + 1}/{slotWindows.length} ·{' '}
                  {slotWindows[activePlayingSlotIdx]?.label || `Slot ${activePlayingSlotIdx + 1}`}
                </span>
                <span className="text-[11px] font-bold text-cyan-300 tabular-nums shrink-0">
                  {previewElapsedSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
                </span>
              </div>

              {/* Center Play Indicator when Paused */}
              {!isPreviewPlaying && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewPlaying(true);
                    startPreviewAudio(
                      selectedAudioTrack,
                      customAudioUrl || selectedOnlineSong?.streamUrl || '',
                      isAudioMuted
                    );
                  }}
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/70 border border-white/25 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Play preview"
                >
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </button>
              )}

              {/* Bottom Controls Overlay */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextPlaying = !isPreviewPlaying;
                    setIsPreviewPlaying(nextPlaying);
                    if (nextPlaying) {
                      startPreviewAudio(
                        selectedAudioTrack,
                        customAudioUrl || selectedOnlineSong?.streamUrl || '',
                        isAudioMuted
                      );
                    } else {
                      stopPreviewAudio();
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
                  aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMusicDrawerOpen(true)}
                  className="min-h-[38px] px-3 rounded-xl bg-black/80 hover:bg-black border border-white/20 text-[11px] font-bold text-white flex items-center gap-1.5 truncate cursor-pointer"
                >
                  <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate max-w-[130px]">{currentSongLabel}</span>
                </button>
              </div>

              {/* Bottom Beat-Synced Timeline Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15">
                {beatCutMarkersPct.map((pct, i) => (
                  <span
                    key={i}
                    style={{ left: `${pct}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-white/65 z-10 pointer-events-none"
                  />
                ))}
                <div
                  style={{ width: `${Math.min(100, Math.max(0, previewProgressPct))}%` }}
                  className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 transition-[width] duration-75"
                />
              </div>
            </div>
          </main>

          {/* Bottom CapCut Clip-Slot Tray & Customize Controls */}
          <section className="shrink-0 bg-neutral-900/95 border-t border-neutral-800 pb-safe">
            <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-2.5 pb-3 space-y-2.5">
              {/* Tray Top Controls: Mode Switcher + Change Music + Batch Select */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-950 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setTrayMode('slots')}
                    className={`px-3 min-h-[36px] rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      trayMode === 'slots'
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Clips ({filledSlotsCount}/{slotClips.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrayMode('customize')}
                    className={`px-3 min-h-[36px] rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      trayMode === 'customize'
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Text &amp; Style
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMusicDrawerOpen(true)}
                    className="min-h-[38px] px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-cyan-500/35 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Change Music</span>
                  </button>

                  {!allSlotsFilled && (
                    <button
                      type="button"
                      onClick={() => mediaPickerRef.current?.click()}
                      className="min-h-[38px] px-3 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-xs font-bold text-pink-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select All</span>
                    </button>
                  )}
                </div>
              </div>

              {trayMode === 'slots' ? (
                <>
                  {/* Contextual Action Bar when user taps a filled slot */}
                  {selectedSlotForAction !== null && slotClips[selectedSlotForAction] && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-neutral-950 border border-cyan-500/40">
                      <span className="text-xs font-bold text-white tabular-nums">
                        Slot {selectedSlotForAction + 1} ·{' '}
                        {(slotWindows[selectedSlotForAction]?.durationSec || 2).toFixed(1)}s
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetSlotIndex(selectedSlotForAction);
                            singleSlotPickerRef.current?.click();
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCroppingSlotIndex(selectedSlotForAction)}
                          className="min-h-[36px] px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Crop</span>
                        </button>
                        {slotClips.length > 1 && (
                          <>
                            <button
                              type="button"
                              disabled={selectedSlotForAction === 0}
                              onClick={() => handleMoveSlot(selectedSlotForAction, -1)}
                              className="min-w-[36px] min-h-[36px] rounded-lg bg-neutral-800 text-neutral-200 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                              aria-label="Swap clip left"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={selectedSlotForAction === slotClips.length - 1}
                              onClick={() => handleMoveSlot(selectedSlotForAction, 1)}
                              className="min-w-[36px] min-h-[36px] rounded-lg bg-neutral-800 text-neutral-200 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                              aria-label="Swap clip right"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleClearSlot(selectedSlotForAction)}
                          className="min-w-[36px] min-h-[36px] rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer"
                          aria-label="Clear slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Numbered CapCut Media Slots Tray */}
                  <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    {slotClips.map((clip, idx) => {
                      const winDur = (
                        slotWindows[idx]?.durationSec ||
                        activeTemplate.durationSec / activeTemplate.requiredClips
                      ).toFixed(1);
                      const isPlayingHere = activePlayingSlotIdx === idx;
                      const isSelected = selectedSlotForAction === idx;

                      if (!clip) {
                        return (
                          <button
                            key={`tray-empty-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedSlotForAction(null);
                              setTargetSlotIndex(idx);
                              singleSlotPickerRef.current?.click();
                            }}
                            className={`w-[78px] sm:w-[92px] aspect-[9/12] shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-between p-2 transition-all cursor-pointer group ${
                              isPlayingHere
                                ? 'border-pink-400 bg-pink-500/10'
                                : 'border-neutral-700 hover:border-cyan-400 bg-neutral-950'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-neutral-400 self-start tabular-nums">
                              {idx + 1}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-neutral-800 group-hover:bg-cyan-500/20 border border-neutral-700 group-hover:border-cyan-400 flex items-center justify-center text-white transition-colors">
                              <Plus className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-200 tabular-nums whitespace-nowrap">
                              Slot {idx + 1} • {winDur}s
                            </span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() =>
                            setSelectedSlotForAction((prev) => (prev === idx ? null : idx))
                          }
                          className={`relative w-[78px] sm:w-[92px] aspect-[9/12] shrink-0 rounded-xl overflow-hidden border-2 bg-black transition-all cursor-pointer ${
                            isSelected
                              ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                              : isPlayingHere
                              ? 'border-pink-500'
                              : 'border-neutral-700 hover:border-white/50'
                          }`}
                        >
                          {clip.mediaType === 'image' ? (
                            <img
                              src={clip.url}
                              alt={`Slot ${idx + 1}`}
                              loading="lazy"
                              decoding="async"
                              style={{
                                transform: `scale(${clip.cropZoom || 1}) translate(${
                                  (clip.cropPanX || 0) * 18
                                }%, ${(clip.cropPanY || 0) * 18}%)`,
                              }}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={clip.url}
                              muted
                              playsInline
                              preload="metadata"
                              style={{
                                transform: `scale(${clip.cropZoom || 1}) translate(${
                                  (clip.cropPanX || 0) * 18
                                }%, ${(clip.cropPanY || 0) * 18}%)`,
                              }}
                              className="w-full h-full object-cover"
                            />
                          )}

                          <div className="absolute top-1 left-1 right-1 flex items-center justify-between pointer-events-none">
                            <span className="px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-black text-white flex items-center gap-0.5">
                              {clip.mediaType === 'image' ? (
                                <ImageIcon className="w-2.5 h-2.5 text-cyan-400" />
                              ) : (
                                <Film className="w-2.5 h-2.5 text-pink-400" />
                              )}
                              {idx + 1}
                            </span>
                            {(clip.cropZoom && clip.cropZoom > 1.02) ||
                            clip.cropPanX ||
                            clip.cropPanY ? (
                              <span className="p-0.5 rounded bg-cyan-500 text-neutral-950">
                                <Crop className="w-2.5 h-2.5" />
                              </span>
                            ) : null}
                          </div>

                          <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/95 via-black/65 to-transparent text-center pointer-events-none">
                            <span className="text-[9px] font-bold text-white tabular-nums block whitespace-nowrap">
                              Slot {idx + 1} • {winDur}s
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Customize Text, Transitions, Speed & Color Grade inside Tray */
                <div className="max-h-52 overflow-y-auto no-scrollbar space-y-3 py-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1 flex items-center gap-1">
                        <Type className="w-3 h-3 text-cyan-400" />
                        <span>Headline Text</span>
                      </label>
                      <input
                        type="text"
                        maxLength={32}
                        value={overlayText}
                        onChange={(e) => setOverlayText(sanitizeInputLive(e.target.value, 32))}
                        placeholder="e.g. JATT DA SWAG"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        Lyrics / Subtitle
                      </label>
                      <input
                        type="text"
                        maxLength={54}
                        value={secondaryText}
                        onChange={(e) => setSecondaryText(sanitizeInputLive(e.target.value, 54))}
                        placeholder="Subtitle or poetic line..."
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-pink-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Beat Transitions & Tempo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1 mr-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Effects:</span>
                    </span>
                    {TRANSITION_OPTIONS.map((opt) => {
                      const isActive = activeTransitions.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleToggleTransition(opt.id)}
                          className={`px-2.5 min-h-[34px] rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            isActive
                              ? 'bg-pink-500/20 border-pink-400 text-white'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3 text-pink-400" />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}

                    <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1 ml-1">
                      <Sliders className="w-3 h-3 text-amber-400" />
                      <span>Speed:</span>
                    </span>
                    {[0.65, 0.75, 1, 1.25].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSpeedMultiplier(spd)}
                        className={`px-2.5 min-h-[34px] rounded-lg border text-[11px] font-bold cursor-pointer ${
                          speedMultiplier === spd
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Color Grading */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
                    {[
                      {
                        id: 'tpl_preset',
                        name: `${activeTemplate.colorGradeName} (Preset)`,
                        filterCss: activeTemplate.filterCss,
                        tintRgba: activeTemplate.colorTintRgba,
                      },
                      ...TEMPLATE_COLOR_GRADES.filter(
                        (g) => g.name !== activeTemplate.colorGradeName
                      ),
                    ].map((grade) => {
                      const selected =
                        selectedColorGrade.name === grade.name ||
                        (selectedColorGrade.id === 'tpl_preset' && grade.id === 'tpl_preset');
                      return (
                        <button
                          key={grade.id}
                          type="button"
                          onClick={() => setSelectedColorGrade(grade)}
                          className={`px-2.5 min-h-[34px] rounded-lg border text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                            selected
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {grade.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Export Action Row */}
              <div className="flex items-center justify-between gap-2.5 pt-1 border-t border-neutral-800/80">
                <p className="text-[11px] text-neutral-400 truncate">
                  {allSlotsFilled ? (
                    <span className="text-emerald-400 font-bold">
                      All {activeTemplate.requiredClips} slots ready for export
                    </span>
                  ) : (
                    <span>
                      Tap any <strong className="text-white">+</strong> slot to add media (
                      {activeTemplate.requiredClips - filledSlotsCount} left)
                    </span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={handleOpenExportSheet}
                  className={`min-h-[44px] px-5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    allSlotsFilled
                      ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-neutral-950 shadow-lg shadow-cyan-500/30 hover:brightness-105 active:scale-[0.98]'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {allSlotsFilled
                      ? 'Export Video'
                      : `Export Video (${filledSlotsCount}/${activeTemplate.requiredClips})`}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* =================================================================
           SCREEN 1: CAPCUT-STYLE ANIMATED TEMPLATES FEED
           ================================================================= */
        <>
          {/* Header */}
          <div className="shrink-0 px-4 sm:px-6 pt-3 pb-3 border-b border-neutral-800/80 bg-neutral-950/95 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onBackToFeed}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white cursor-pointer"
                  aria-label="Back to video feed"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-pink-400 shrink-0" />
                    <h1 className="text-base sm:text-lg font-black tracking-tight truncate">
                      Templates Studio
                    </h1>
                  </div>
                  <p className="text-xs text-neutral-400 truncate">
                    Tap Use Template, fill each slot with your clips &amp; export in seconds
                  </p>
                </div>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 min-h-[44px] rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                      active
                        ? 'bg-gradient-to-r from-pink-600 to-rose-500 border-pink-400 text-white shadow-md shadow-pink-600/20'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animated Template Feed Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-6 pb-28">
            <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {filteredTemplates.map((tpl) => {
                const trackName =
                  CURATED_AUDIO_LIBRARY.find((a) => a.id === tpl.defaultAudioTrackId)?.title ||
                  'Auto Beat';
                const formattedDuration = formatTemplateDuration(tpl.durationSec);
                return (
                  <article
                    key={tpl.id}
                    className="group rounded-2xl bg-neutral-900/90 border border-neutral-800 hover:border-white/30 overflow-hidden flex flex-col transition-all shadow-lg"
                  >
                    {/* Live Looping 9:16 Visual Preview Reel */}
                    <div
                      onClick={() => handleUseTemplate(tpl)}
                      className="relative aspect-[9/15] w-full bg-black overflow-hidden cursor-pointer gpu-accelerated"
                    >
                      <TemplateAnimatedPreview template={tpl} />

                      {/* Top Category + BPM over gradient scrim */}
                      <div className="absolute top-0 left-0 right-0 p-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between gap-1 pointer-events-none">
                        <span className="text-[10px] font-bold text-white/95 truncate">
                          {tpl.categoryLabel}
                        </span>
                        <span className="text-[10px] font-bold text-cyan-300 tabular-nums shrink-0">
                          {tpl.bpm} BPM
                        </span>
                      </div>

                      {/* Bottom-left Clip Count, Duration & Aspect Ratio Tag */}
                      <div className="absolute bottom-0 left-0 right-0 pt-8 pb-2.5 px-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                        <span className="px-2 py-1 rounded-md bg-black/80 border border-white/15 text-[10px] font-extrabold text-white tabular-nums whitespace-nowrap">
                          {tpl.requiredClips} Clips • {formattedDuration} • {tpl.aspectRatio}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Title, Sound & Bold "Use Template" Button */}
                    <div className="p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 flex-1 bg-neutral-950/75">
                      <div className="space-y-1">
                        <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-snug line-clamp-1">
                          {tpl.name}
                        </h2>
                        <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 truncate">
                          <Music className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate font-semibold">{trackName}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tpl)}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-black/40 border border-white cursor-pointer active:scale-[0.98] transition-all"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-pink-600" />
                        <span>Use Template</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Interactive Slot Crop & Framing Modal */}
      {croppingSlotIndex !== null && croppingClip && (
        <div className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crop className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  Crop &amp; Frame Slot {croppingSlotIndex + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCroppingSlotIndex(null)}
                className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center cursor-pointer"
                aria-label="Close crop dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Draggable 9:16 Crop Frame */}
            <div
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                cropDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origPanX: croppingClip.cropPanX || 0,
                  origPanY: croppingClip.cropPanY || 0,
                };
              }}
              onPointerMove={(e) => {
                if (!cropDragRef.current) return;
                const dx = (e.clientX - cropDragRef.current.startX) / 140;
                const dy = (e.clientY - cropDragRef.current.startY) / 220;
                const nextX = Math.max(-1, Math.min(1, cropDragRef.current.origPanX + dx));
                const nextY = Math.max(-1, Math.min(1, cropDragRef.current.origPanY + dy));
                handleUpdateSlotCrop(croppingSlotIndex, { cropPanX: nextX, cropPanY: nextY });
              }}
              onPointerUp={() => {
                cropDragRef.current = null;
              }}
              className="relative mx-auto w-48 aspect-[9/16] rounded-xl overflow-hidden border-2 border-cyan-400 bg-black cursor-move touch-none"
            >
              {croppingClip.mediaType === 'image' ? (
                <img
                  src={croppingClip.url}
                  alt="Crop preview"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{
                    transform: `scale(${croppingClip.cropZoom || 1}) translate(${
                      (croppingClip.cropPanX || 0) * 30
                    }%, ${(croppingClip.cropPanY || 0) * 30}%)`,
                  }}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              ) : (
                <video
                  src={croppingClip.url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  style={{
                    transform: `scale(${croppingClip.cropZoom || 1}) translate(${
                      (croppingClip.cropPanX || 0) * 30
                    }%, ${(croppingClip.cropPanY || 0) * 30}%)`,
                  }}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              )}
              <div className="absolute inset-x-0 bottom-1.5 text-center pointer-events-none">
                <span className="px-2 py-0.5 rounded bg-black/75 text-[10px] font-bold text-neutral-200">
                  Drag to reposition
                </span>
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Zoom</span>
                </span>
                <span className="tabular-nums text-cyan-300">
                  {(croppingClip.cropZoom || 1).toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={2.2}
                step={0.05}
                value={croppingClip.cropZoom || 1}
                onChange={(e) =>
                  handleUpdateSlotCrop(croppingSlotIndex, {
                    cropZoom: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleUpdateSlotCrop(croppingSlotIndex, {
                    cropZoom: 1,
                    cropPanX: 0,
                    cropPanY: 0,
                  })
                }
                className="min-h-[42px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 cursor-pointer"
              >
                Reset Frame
              </button>
              <button
                type="button"
                onClick={() => setCroppingSlotIndex(null)}
                className="min-h-[42px] rounded-xl bg-cyan-400 hover:bg-cyan-300 text-xs font-black text-neutral-950 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export & Publish Action Sheet Modal */}
      {isExportSheetOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-neutral-900 border-t sm:border border-neutral-800 p-5 space-y-4 shadow-2xl pb-safe">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-white">Export Template Reel</h3>
                <p className="text-xs text-neutral-400 tabular-nums">
                  {activeTemplate.name} · {filledSlotsCount}/{activeTemplate.requiredClips} Clips ·{' '}
                  {formatTemplateDuration(totalDurationSec)} · {currentSongLabel}
                </p>
              </div>
              {!isExporting && (
                <button
                  type="button"
                  onClick={() => setIsExportSheetOpen(false)}
                  className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center cursor-pointer"
                  aria-label="Close export modal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Download Privacy Option */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-neutral-400">
                Allow viewers to download your reel?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setAllowDownload(true)}
                  className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    allowDownload
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Allow Download</span>
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setAllowDownload(false)}
                  className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    !allowDownload
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Keep Private</span>
                </button>
              </div>
            </div>

            {isExporting && (
              <div className="rounded-xl bg-neutral-950 border border-cyan-500/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-cyan-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {exportActionLabel}
                  </span>
                  <span className="tabular-nums text-white">{exportProgressPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    style={{ width: `${exportProgressPct}%` }}
                    className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-400 transition-all duration-150"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    exportCancelledRef.current = true;
                  }}
                  className="text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel Export
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isExporting}
                onClick={handlePostToFeed}
                className="min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xl shadow-pink-600/25 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Post to Jatt VibeReels</span>
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleSaveToGallery}
                className="min-h-[46px] px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 border border-neutral-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Save Video to Device Gallery</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full CapCut Music & Online Song Picker Drawer */}
      <StudioMusicPickerDrawer
        isOpen={isMusicDrawerOpen}
        onClose={() => setIsMusicDrawerOpen(false)}
        initialTab="online"
        selectedLibraryTrack={selectedAudioTrack}
        selectedAudioFile={customAudioFile}
        selectedAudioPreviewUrl={customAudioUrl || null}
        selectedOnlineSong={selectedOnlineSong}
        volume={0.85}
        onAttachLibraryTrack={(track) => {
          setSelectedAudioTrack(track);
          setSelectedOnlineSong(null);
          setCustomAudioFile(null);
          setCustomAudioUrl('');
          setIsAudioMuted(false);
          setIsPreviewPlaying(true);
          startPreviewAudio(track, '', false);
        }}
        onAttachDeviceFile={(file, url) => {
          setCustomAudioFile(file);
          setCustomAudioUrl(url);
          setSelectedOnlineSong(null);
          setIsAudioMuted(false);
          setIsPreviewPlaying(true);
          startPreviewAudio(selectedAudioTrack, url, false);
        }}
        onAttachOnlineSong={(song) => {
          setSelectedOnlineSong(song);
          setCustomAudioFile(null);
          setCustomAudioUrl('');
          setIsAudioMuted(false);
          setIsPreviewPlaying(true);
          startPreviewAudio(selectedAudioTrack, song.streamUrl || '', false);
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};

export const TemplatesStudioView = React.memo(TemplatesStudioViewComponent);

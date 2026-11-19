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

function formatTransitionLabel(tr: TemplateEffectTransition): string {
  switch (tr) {
    case 'zoom-in':
      return 'Zoom-In';
    case 'flash':
      return 'Flash';
    case 'shake':
      return 'Shake';
    case 'slide':
      return 'Slide';
  }
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

function drawProceduralScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  template: VideoTemplateDef,
  clipSlot: number
) {
  const [c0, c1, c2] = template.previewColors;
  const slotMod = ((clipSlot % 4) + 4) % 4;
  const shift = slotMod * 0.35;

  const grad = ctx.createLinearGradient(
    slotMod === 1 ? w : 0,
    0,
    w * (0.55 + 0.4 * Math.sin(t * 0.8 + shift)),
    h
  );
  grad.addColorStop(0, slotMod % 2 === 0 ? c0 : c1);
  grad.addColorStop(0.5, slotMod === 2 ? c2 : slotMod % 2 === 0 ? c1 : c2);
  grad.addColorStop(1, '#050507');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Moving bokeh orbs / studio light plates
  for (let i = 0; i < 5; i++) {
    const angle = t * (0.55 + i * 0.14) + i * 1.4 + slotMod * 1.25;
    const cx = w * (0.5 + 0.35 * Math.cos(angle));
    const cy = h * (0.26 + 0.4 * Math.sin(angle * 0.85));
    const rad = w * (0.22 + 0.08 * Math.sin(t * 1.7 + i));
    const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const tint = (i + slotMod) % 2 === 0 ? c2 : c1;
    orb.addColorStop(0, `${tint}8c`);
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stylized geometric silhouette & beat visuals distinct per cut slot
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  if (template.transitionStyle === 'neon_flash' || slotMod === 2) {
    for (let g = 0; g < 6; g++) {
      const y = h * 0.48 + g * (h * 0.078);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + ((g % 2 === 0 ? 1 : -1) * w * 0.05));
      ctx.stroke();
    }
  } else if (template.transitionStyle === 'spiritual_aura') {
    const cx = w / 2;
    const cy = h * 0.42;
    for (let r = 1; r <= 3; r++) {
      const radius = w * (0.14 * r + 0.02 * Math.sin(t * 2 + r));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const bars = 11;
    const barW = w / (bars * 1.85);
    const startX = (w - bars * barW * 1.4) / 2;
    for (let b = 0; b < bars; b++) {
      const bh = h * (0.05 + 0.1 * Math.abs(Math.sin(t * 4.4 + b * 0.65 + slotMod)));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(startX + b * barW * 1.4, h * 0.46 - bh / 2, barW, bh);
    }
  }
  ctx.restore();
}

function drawTemplateFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsedSec: number,
  template: VideoTemplateDef,
  clips: LoadedMediaClip[],
  overlayText: string,
  secondaryText: string,
  speedMultiplier: number,
  activeTransitions: TemplateEffectTransition[],
  colorGrade: Pick<ColorGradePreset, 'filterCss' | 'tintRgba'>
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, w, h);

  const beatsPerSec = (template.bpm / 60) * speedMultiplier;
  const beatPos = elapsedSec * beatsPerSec;
  const beatFraction = beatPos - Math.floor(beatPos);
  const beatPulse = Math.exp(-beatFraction * 5.2);

  const effectiveDuration = Math.max(4, template.durationSec / speedMultiplier);
  const rawCutInterval =
    (template.beatCutIntervalBeats * 60) / Math.max(40, template.bpm * speedMultiplier);
  const cutIntervalSec = Math.max(0.85, Math.min(effectiveDuration / 2, rawCutInterval));

  const cutIndex = Math.floor(elapsedSec / cutIntervalSec);
  const timeInCut = elapsedSec - cutIndex * cutIntervalSec;
  const clipLocalT = Math.min(1, timeInCut / cutIntervalSec);

  const totalClips = clips.length;
  const activeClipIdx = totalClips > 0 ? cutIndex % totalClips : cutIndex % 4;
  const prevClipIdx =
    totalClips > 0 ? (cutIndex - 1 + totalClips) % totalClips : (cutIndex + 3) % 4;

  const transitionsPool =
    activeTransitions.length > 0 ? activeTransitions : template.transitions;
  const currentTransition = transitionsPool[cutIndex % transitionsPool.length];
  const hasZoom = transitionsPool.includes('zoom-in') || currentTransition === 'zoom-in';
  const hasShake = transitionsPool.includes('shake') || currentTransition === 'shake';
  const hasFlash = transitionsPool.includes('flash') || currentTransition === 'flash';
  const hasSlide = currentTransition === 'slide';

  // Entry transition progress (first 0.28s of each beat cut)
  const transitionWindowSec = 0.28;
  const inTransition = cutIndex > 0 && timeInCut < transitionWindowSec;
  const slideEase = inTransition ? easeOutCubic(timeInCut / transitionWindowSec) : 1;

  // Compute kinetic camera transforms (Zoom-In, Shake, Ken Burns)
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

  // Render media layer with template Color Grading Filter
  ctx.save();
  try {
    if ('filter' in ctx) {
      ctx.filter = colorGrade.filterCss;
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

    if (totalClips > 0) {
      const c = clips[slotIdx % totalClips];
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
          sc,
          ox,
          oy
        );
      } else if (c.mediaType === 'video' && c.videoEl && c.videoEl.videoWidth > 0) {
        drawCoverImageOrVideo(
          ctx,
          c.videoEl,
          c.videoEl.videoWidth,
          c.videoEl.videoHeight,
          w,
          h,
          sc,
          ox,
          oy
        );
      } else {
        drawProceduralScene(ctx, w, h, elapsedSec, template, slotIdx);
      }
    } else {
      ctx.save();
      ctx.translate(w / 2 + ox, h / 2 + oy);
      ctx.scale(sc, sc);
      ctx.translate(-w / 2, -h / 2);
      drawProceduralScene(ctx, w, h, elapsedSec, template, slotIdx);
      ctx.restore();
    }
    ctx.restore();
  };

  if (hasSlide && inTransition) {
    // Outgoing clip slides left while incoming clip slides in from right
    const outX = -slideEase * w;
    const inX = (1 - slideEase) * w;
    renderSlotContent(prevClipIdx, 1.04, outX, 0, 0, 1);
    renderSlotContent(activeClipIdx, scale, inX + tx, ty, tiltRad, 1);

    // Subtle crisp vertical seam shadow between sliding clips
    const seamGrad = ctx.createLinearGradient(inX - w * 0.06, 0, inX, 0);
    seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
    seamGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = seamGrad;
    ctx.fillRect(inX - w * 0.06, 0, w * 0.06, h);
  } else {
    renderSlotContent(activeClipIdx, scale, tx, ty, tiltRad, 1);
    // Gentle micro crossfade only when Slide isn't active and multiple clips exist
    if (!hasSlide && totalClips > 1 && clipLocalT > 0.88 && !hasFlash) {
      const nextIdx = (activeClipIdx + 1) % totalClips;
      const fadeAlpha = (clipLocalT - 0.88) / 0.12;
      renderSlotContent(nextIdx, 1.03, 0, 0, 0, Math.min(1, fadeAlpha));
    }
  }
  ctx.restore();

  // Cross-browser Color Grading tonal wash (ensures vivid grading on iOS WebKit too)
  if (colorGrade.tintRgba) {
    ctx.save();
    ctx.fillStyle = colorGrade.tintRgba;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Flash Transition & Beat Strobe
  if (hasFlash) {
    const cutFlash = cutIndex > 0 ? Math.exp(-timeInCut * 14) * 0.72 : 0;
    const beatFlash = currentTransition === 'flash' ? beatPulse * 0.16 : 0;
    const flashAlpha = Math.min(0.82, cutFlash + beatFlash);
    if (flashAlpha > 0.015) {
      ctx.fillStyle =
        template.category === 'neon_glow'
          ? `rgba(224, 242, 254, ${flashAlpha})`
          : `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Template-specific signature frames & lighting
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
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
      Math.floor((elapsedSec / effectiveDuration) * template.lyricLines.length) %
      template.lyricLines.length;
    subTitle = template.lyricLines[lineIdx] || subTitle;
  }

  const titleScale = 1 + beatPulse * 0.055;
  const titleFontSize = Math.round(w * 0.072);
  const subFontSize = Math.round(w * 0.036);

  if (mainTitle) {
    ctx.save();
    ctx.translate(w / 2, template.transitionStyle === 'lyrics_frame' ? h * 0.72 : h * 0.75);
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
    const lyricY = template.transitionStyle === 'lyrics_frame' ? h * 0.795 : h * 0.82;
    ctx.fillText(subTitle.slice(0, 48), w / 2, lyricY, w * 0.84);
    ctx.restore();
  }

  // Subtle beat equalizer strip
  if (
    template.category === 'beat_sync' ||
    template.category === 'bhangra_punjabi' ||
    template.category === 'neon_glow'
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
      ctx.fillRect(sx + i * (bw + gap), h * 0.875 - barH / 2, bw, barH);
    }
    ctx.restore();
  }

  ctx.restore();
}

const TemplateAnimatedPreview: React.FC<{ template: VideoTemplateDef }> = React.memo(
  ({ template }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isVisible, setIsVisible] = useState(true);

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

      const tick = (now: number) => {
        if (now - lastDraw >= 33) {
          lastDraw = now;
          const elapsed = (now - startAt) / 1000;
          drawTemplateFrame(
            ctx,
            canvas.width,
            canvas.height,
            elapsed,
            template,
            [],
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
    }, [template, isVisible]);

    return (
      <canvas
        ref={canvasRef}
        width={216}
        height={336}
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

  // Studio customization state
  const [clips, setClips] = useState<LoadedMediaClip[]>([]);
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
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [previewProgressPct, setPreviewProgressPct] = useState(0);

  // Export progress state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressPct, setExportProgressPct] = useState(0);
  const [exportActionLabel, setExportActionLabel] = useState('');

  const mediaPickerRef = useRef<HTMLInputElement | null>(null);
  const customAudioPickerRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const customAudioElRef = useRef<HTMLAudioElement | null>(null);
  const exportCancelledRef = useRef(false);
  const activeTemplateRef = useRef<VideoTemplateDef | null>(null);
  const clipsRef = useRef<LoadedMediaClip[]>([]);
  clipsRef.current = clips;

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return VIDEO_TEMPLATES;
    return VIDEO_TEMPLATES.filter(
      (t) => t.category === selectedCategory || t.categories.includes(selectedCategory)
    );
  }, [selectedCategory]);

  // Compute beat-cut tick positions (%) along the preview timeline bar
  const beatCutMarkersPct = useMemo(() => {
    if (!activeTemplate) return [];
    const effectiveDur = Math.max(4, activeTemplate.durationSec / speedMultiplier);
    const rawCut =
      (activeTemplate.beatCutIntervalBeats * 60) /
      Math.max(40, activeTemplate.bpm * speedMultiplier);
    const cutSec = Math.max(0.85, Math.min(effectiveDur / 2, rawCut));
    const markers: number[] = [];
    for (let t = cutSec; t < effectiveDur - 0.15; t += cutSec) {
      markers.push((t / effectiveDur) * 100);
    }
    return markers;
  }, [activeTemplate, speedMultiplier]);

  // Clean up object URLs on unmount or clip removal
  useEffect(() => {
    return () => {
      soundEngine.stopPreviewTrack();
      if (customAudioElRef.current) {
        customAudioElRef.current.pause();
        customAudioElRef.current = null;
      }
      for (const c of clipsRef.current) {
        try {
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
      for (const c of clipsRef.current) {
        try {
          c.videoEl?.pause();
          URL.revokeObjectURL(c.url);
        } catch {
          // ignore
        }
      }
      clipsRef.current = [];
      setClips([]);
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

      const defaultTrack =
        CURATED_AUDIO_LIBRARY.find((a) => a.id === tpl.defaultAudioTrackId) ||
        CURATED_AUDIO_LIBRARY[0];
      setSelectedAudioTrack(defaultTrack);
      startPreviewAudio(defaultTrack, '', false);
    },
    [customAudioUrl, startPreviewAudio]
  );

  // One-Tap "Use Template": applies preset effects + immediately opens gallery to pick 1-5 clips
  const handleUseTemplate = (tpl: VideoTemplateDef) => {
    initializeTemplateEditor(tpl);
    mediaPickerRef.current?.click();
  };

  // Tap preview thumbnail directly to inspect live demo studio first before picking files
  const handlePreviewTemplateFirst = (tpl: VideoTemplateDef) => {
    initializeTemplateEditor(tpl);
  };

  const handleCloseEditor = () => {
    exportCancelledRef.current = true;
    stopPreviewAudio();
    for (const c of clipsRef.current) {
      try {
        c.videoEl?.pause();
        URL.revokeObjectURL(c.url);
      } catch {
        // ignore
      }
    }
    clipsRef.current = [];
    setClips([]);
    activeTemplateRef.current = null;
    setActiveTemplate(null);
  };

  // Handle selecting 1 to 5 photos or videos from device gallery
  const handlePickGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    const tpl = activeTemplateRef.current || activeTemplate;
    if (fileList.length === 0 || !tpl) return;

    const existingCount = clipsRef.current.length;
    const remainingSlots = Math.max(0, tpl.maxClips - existingCount);
    if (remainingSlots <= 0) {
      onShowToast(`Maximum ${tpl.maxClips} clips reached for this template.`);
      return;
    }

    if (fileList.length > remainingSlots) {
      onShowToast(`Using first ${remainingSlots} clips (max ${tpl.maxClips} photos/videos per template).`);
    }

    const toProcess = fileList.slice(0, remainingSlots);
    const loaded: LoadedMediaClip[] = [];

    for (const file of toProcess) {
      const check = validateSafeMediaFile(file);
      if (!check.valid) {
        onShowToast(
          check.reason ||
            'Blocked unsafe file. Only .mp4, .webm, .jpg, .png, .webp allowed.'
        );
        continue;
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
        loaded.push({
          id: clipId,
          file,
          url,
          mediaType: 'image',
          name: file.name,
          durationSec: 3,
          imageEl: img,
        });
      } else {
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
        loaded.push({
          id: clipId,
          file,
          url,
          mediaType: 'video',
          name: file.name,
          durationSec: Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 4,
          videoEl: vid,
        });
      }
    }

    if (loaded.length > 0) {
      setClips((prev) => [...prev, ...loaded]);
      setIsPreviewPlaying(true);
      setPreviewProgressPct(0);
      startPreviewAudio(selectedAudioTrack, customAudioUrl, isAudioMuted);
      onShowToast(
        `Auto-synced ${loaded.length} clip${loaded.length === 1 ? '' : 's'} with "${tpl.name}" (${tpl.requiredClips} Clips • ${formatTemplateDuration(tpl.durationSec)})!`
      );
    }
  };

  const handleRemoveClip = (clipId: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === clipId);
      if (target) {
        try {
          target.videoEl?.pause();
          URL.revokeObjectURL(target.url);
        } catch {
          // ignore
        }
      }
      return prev.filter((c) => c.id !== clipId);
    });
  };

  const handleMoveClip = (index: number, direction: -1 | 1) => {
    setClips((prev) => {
      const nextIdx = index + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const handleToggleTransition = (tr: TemplateEffectTransition) => {
    setActiveTransitions((prev) => {
      if (prev.includes(tr)) {
        if (prev.length === 1) return prev; // Keep at least 1 active transition
        return prev.filter((t) => t !== tr);
      }
      return [...prev, tr];
    });
  };

  const handlePickCustomAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateSafeAudioFile(file);
    if (!check.valid) {
      onShowToast(
        check.reason || 'Only safe audio formats (.mp3, .m4a, .wav, .ogg, .aac) are allowed.'
      );
      return;
    }
    if (customAudioUrl) {
      try {
        URL.revokeObjectURL(customAudioUrl);
      } catch {
        // ignore
      }
    }
    const url = URL.createObjectURL(file);
    setCustomAudioFile(file);
    setCustomAudioUrl(url);
    if (!isAudioMuted && isPreviewPlaying) {
      startPreviewAudio(selectedAudioTrack, url, false);
    }
    onShowToast(`Attached custom sound: ${file.name}`);
  };

  // Sync video clips play/pause with preview playback state
  useEffect(() => {
    for (const c of clips) {
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
  }, [clips, isPreviewPlaying, speedMultiplier, isExporting]);

  // Real-time interactive Canvas preview loop inside Editor
  useEffect(() => {
    if (!activeTemplate || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let startAt = performance.now();
    let pausedAtSec = 0;
    const effectiveDuration = Math.max(4, activeTemplate.durationSec / speedMultiplier);

    const drawLoop = (now: number) => {
      const elapsed = isPreviewPlaying ? (now - startAt) / 1000 : pausedAtSec;
      pausedAtSec = elapsed;
      const loopT = elapsed % effectiveDuration;
      setPreviewProgressPct((loopT / effectiveDuration) * 100);

      drawTemplateFrame(
        ctx,
        canvas.width,
        canvas.height,
        loopT,
        activeTemplate,
        clips,
        overlayText,
        secondaryText,
        speedMultiplier,
        activeTransitions,
        selectedColorGrade
      );

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
    clips,
    overlayText,
    secondaryText,
    speedMultiplier,
    activeTransitions,
    selectedColorGrade,
    isPreviewPlaying,
  ]);

  // Render full 720x1280 video blob + poster snapshot via offscreen canvas captureStream
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

    const totalSec = Math.max(
      4,
      Math.min(25, Math.round(activeTemplate.durationSec / speedMultiplier))
    );

    // Prepare video clips from start
    for (const c of clips) {
      if (c.videoEl) {
        try {
          c.videoEl.currentTime = 0;
          c.videoEl.playbackRate = speedMultiplier;
          await c.videoEl.play().catch(() => {});
        } catch {
          // ignore
        }
      }
    }

    // Draw first frame immediately and grab fallback poster
    drawTemplateFrame(
      ctx,
      720,
      1280,
      0,
      activeTemplate,
      clips,
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
    if (!isAudioMuted && customAudioUrl) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioCtx();
        exportAudioEl = new Audio(customAudioUrl);
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
          clips,
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

  const handleSaveToGallery = async () => {
    if (!activeTemplate || isExporting) return;
    if (clips.length < activeTemplate.minClips) {
      onShowToast('Please choose 1 to 5 photos or videos from your device first.');
      mediaPickerRef.current?.click();
      return;
    }

    stopPreviewAudio();
    setIsPreviewPlaying(false);
    setIsExporting(true);
    setExportProgressPct(0);
    setExportActionLabel('Rendering HD Video for Gallery...');

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

      onShowToast('Template reel exported to your device downloads!');
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
    if (clips.length < activeTemplate.minClips) {
      onShowToast('Pick 1 to 5 photos or videos from your device before posting.');
      mediaPickerRef.current?.click();
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
          : trackToUse.title,
        artist: customAudioFile ? activeAuthorName : trackToUse.artist,
        trackType: trackToUse.trackType,
        audioUrl: customAudioUrl || undefined,
        category: customAudioFile ? 'original' : trackToUse.category,
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

  return (
    <div className="w-full h-full bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Unconditional Hidden File Inputs so one-tap "Use Template" works straight from Gallery */}
      <input
        ref={mediaPickerRef}
        type="file"
        multiple
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePickGalleryFiles}
      />
      <input
        ref={customAudioPickerRef}
        type="file"
        accept=".mp3,.m4a,.wav,.ogg,.aac,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/aac"
        className="hidden"
        onChange={handlePickCustomAudio}
      />

      {activeTemplate ? (
        /* =================================================================
           INTERACTIVE TEMPLATE EDITOR STUDIO
           ================================================================= */
        <>
          {/* Top Editor Header */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 border-b border-neutral-800/80 bg-neutral-950/95">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-center gap-1.5 text-xs font-bold text-neutral-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Templates</span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <h2 className="text-sm font-black tracking-tight truncate">
                    {activeTemplate.name}
                  </h2>
                </div>
                <p className="text-[11px] text-neutral-400 truncate tabular-nums">
                  {activeTemplate.requiredClips} Clips • {formatTemplateDuration(activeTemplate.durationSec)} ·{' '}
                  {activeTemplate.bpm} BPM · {clips.length}/{activeTemplate.requiredClips} Selected ·{' '}
                  {selectedColorGrade.name}
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
                    startPreviewAudio(selectedAudioTrack, customAudioUrl, false);
                  }
                }}
                className={`min-w-[44px] min-h-[44px] px-2.5 rounded-xl border flex items-center justify-center text-xs font-bold cursor-pointer ${
                  isAudioMuted
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-400'
                    : 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                }`}
                title={isAudioMuted ? 'Unmute beat' : 'Mute beat'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Studio Workspace */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 sm:p-5 pb-28">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left: Live 9:16 Canvas Preview */}
              <div className="lg:col-span-5 flex flex-col items-center gap-3 lg:sticky lg:top-4">
                <div className="relative w-full max-w-[270px] sm:max-w-[300px] aspect-[9/16] rounded-3xl overflow-hidden border border-neutral-800 bg-black shadow-2xl gpu-accelerated">
                  <canvas
                    ref={previewCanvasRef}
                    width={360}
                    height={640}
                    className="w-full h-full object-cover block"
                  />

                  {/* Top Preview Status Line */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-bold tracking-wide text-cyan-300 border border-white/15">
                      {activeTemplate.previewBadge}
                    </span>
                    {clips.length === 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-pink-600/90 text-[10px] font-bold text-white">
                        Demo Preview
                      </span>
                    )}
                  </div>

                  {/* Play/Pause Tap Target */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextPlaying = !isPreviewPlaying;
                      setIsPreviewPlaying(nextPlaying);
                      if (nextPlaying) {
                        startPreviewAudio(selectedAudioTrack, customAudioUrl, isAudioMuted);
                      } else {
                        stopPreviewAudio();
                      }
                    }}
                    className="absolute bottom-4 left-3 w-11 h-11 rounded-full bg-black/75 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </button>

                  {/* Quick Pick Clips Overlay CTA when empty */}
                  {clips.length === 0 && (
                    <button
                      type="button"
                      onClick={() => mediaPickerRef.current?.click()}
                      className="absolute bottom-4 right-3 px-3.5 min-h-[44px] rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow-xl cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4 text-pink-600" />
                      <span>Select {activeTemplate.requiredClips} Clips</span>
                    </button>
                  )}

                  {/* Bottom Beat-Synced Timeline Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/15">
                    {beatCutMarkersPct.map((pct, i) => (
                      <span
                        key={i}
                        style={{ left: `${pct}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10 pointer-events-none"
                      />
                    ))}
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, previewProgressPct))}%` }}
                      className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-cyan-400 transition-[width] duration-75"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Clip Strip, Transitions/Color Grade, Text & Sound Controls, Export */}
              <div className="lg:col-span-7 space-y-4">
                {/* Step 1: 1-5 Gallery Clip Timeline */}
                <div className="rounded-2xl bg-neutral-900/75 border border-neutral-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-pink-400" />
                        <span>
                          1. Select 1–{activeTemplate.maxClips} Clips ({clips.length}/
                          {activeTemplate.maxClips})
                        </span>
                      </h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Auto-cut on {activeTemplate.bpm} BPM beats · Photos &amp; videos supported
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={clips.length >= activeTemplate.maxClips}
                      onClick={() => mediaPickerRef.current?.click()}
                      className="min-h-[44px] px-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-45 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{clips.length === 0 ? 'Choose Clips' : 'Add More'}</span>
                    </button>
                  </div>

                  {clips.length > 0 && (
                    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                      {clips.map((clip, idx) => (
                        <div
                          key={clip.id}
                          className="relative w-20 shrink-0 rounded-xl overflow-hidden border border-neutral-700 bg-black"
                        >
                          <div className="aspect-[9/14] w-full bg-neutral-900 relative">
                            {clip.mediaType === 'image' ? (
                              <img
                                src={clip.url}
                                alt={clip.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={clip.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-black text-white flex items-center gap-0.5">
                              {clip.mediaType === 'image' ? (
                                <ImageIcon className="w-2.5 h-2.5 text-cyan-400" />
                              ) : (
                                <Film className="w-2.5 h-2.5 text-pink-400" />
                              )}
                              {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveClip(clip.id)}
                              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/80 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                              aria-label="Remove clip"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between px-1 py-1 bg-neutral-900 border-t border-neutral-800">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveClip(idx, -1)}
                              className="min-w-[28px] min-h-[28px] flex items-center justify-center text-neutral-300 disabled:opacity-30 cursor-pointer"
                              aria-label="Move clip left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === clips.length - 1}
                              onClick={() => handleMoveClip(idx, 1)}
                              className="min-w-[28px] min-h-[28px] flex items-center justify-center text-neutral-300 disabled:opacity-30 cursor-pointer"
                              aria-label="Move clip right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: Beat Cuts, Transitions & Color Grading */}
                <div className="rounded-2xl bg-neutral-900/75 border border-neutral-800 p-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>2. Auto Beat Transitions &amp; Color Grade</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">
                      {beatCutMarkersPct.length + 1} Beat Cuts
                    </span>
                  </div>

                  {/* Transitions Selector (Zoom-In, Flash, Shake, Slide) */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-neutral-400">
                      Beat Transitions (tap to mix)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TRANSITION_OPTIONS.map((opt) => {
                        const isActive = activeTransitions.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleTransition(opt.id)}
                            className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              isActive
                                ? 'bg-pink-500/20 border-pink-400 text-white'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {isActive && <Check className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Grading Selector */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Color Grading Filter</span>
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
                            className={`px-3 min-h-[40px] rounded-xl border text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                              selected
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {grade.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Step 3: Text Overlays & Pace */}
                <div className="rounded-2xl bg-neutral-900/75 border border-neutral-800 p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3. Customize Text, Lyrics &amp; Velocity</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        Main Headline / Hook Text
                      </label>
                      <input
                        type="text"
                        maxLength={32}
                        value={overlayText}
                        onChange={(e) => setOverlayText(sanitizeInputLive(e.target.value, 32))}
                        placeholder="e.g. JATT DA SWAG"
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-pink-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                        Lyrics / Subtitle Line
                      </label>
                      <input
                        type="text"
                        maxLength={54}
                        value={secondaryText}
                        onChange={(e) => setSecondaryText(sanitizeInputLive(e.target.value, 54))}
                        placeholder="Subtitle or poetic line..."
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Speed / Beat Pace */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Tempo / Slow-Mo</span>
                    </span>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {[
                        { val: 0.65, label: '0.65x Velvet' },
                        { val: 0.75, label: '0.75x Slow-Mo' },
                        { val: 1, label: '1x Normal' },
                        { val: 1.25, label: '1.25x Hype' },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setSpeedMultiplier(opt.val)}
                          className={`px-3 min-h-[40px] rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            speedMultiplier === opt.val
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 4: Audio Track & Privacy */}
                <div className="rounded-2xl bg-neutral-900/75 border border-neutral-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-emerald-400" />
                      <span>4. Background Music &amp; Privacy</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => customAudioPickerRef.current?.click()}
                      className="min-h-[38px] px-3 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-[11px] font-bold text-cyan-300 cursor-pointer"
                    >
                      + Custom Audio
                    </button>
                  </div>

                  {customAudioFile ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
                      <span className="truncate font-bold text-cyan-200">
                        Custom Audio: {customAudioFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomAudioFile(null);
                          setCustomAudioUrl('');
                          if (isPreviewPlaying && !isAudioMuted) {
                            startPreviewAudio(selectedAudioTrack, '', false);
                          }
                        }}
                        className="text-neutral-300 hover:text-white p-1.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                      {CURATED_AUDIO_LIBRARY.map((track) => {
                        const active = selectedAudioTrack?.id === track.id;
                        return (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => {
                              setSelectedAudioTrack(track);
                              if (!isAudioMuted) {
                                setIsPreviewPlaying(true);
                                startPreviewAudio(track, '', false);
                              }
                            }}
                            className={`text-left px-3 py-2 min-h-[44px] rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              active
                                ? 'bg-pink-500/15 border-pink-500/50 text-white'
                                : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate">{track.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {track.artist} · {track.duration}
                              </p>
                            </div>
                            {active && <Check className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Download Privacy */}
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <p className="text-[11px] font-bold text-neutral-300">
                      Allow others to download your video?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowDownload(true)}
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                          allowDownload
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Yes, Allow Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowDownload(false)}
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                          !allowDownload
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>No, Keep Private</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Export Progress Bar when Rendering */}
                {isExporting && (
                  <div className="rounded-2xl bg-neutral-900 border border-pink-500/40 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2 text-pink-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {exportActionLabel}
                      </span>
                      <span className="tabular-nums text-white">{exportProgressPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        style={{ width: `${exportProgressPct}%` }}
                        className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-cyan-400 transition-all duration-150"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportCancelledRef.current = true;
                      }}
                      className="min-h-[36px] text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                    >
                      Cancel Export
                    </button>
                  </div>
                )}

                {/* Primary Export & Post Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleSaveToGallery}
                    className="min-h-[48px] px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-neutral-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>Save Video to Gallery</span>
                  </button>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handlePostToFeed}
                    className="min-h-[48px] px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 shadow-xl shadow-pink-600/25 cursor-pointer active:scale-[0.99] transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Post to Jatt VibeReels</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* =================================================================
           TRENDING VIDEO & PHOTO TEMPLATES GALLERY
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
                    Create trending reels in one tap · Select 1–5 clips &amp; auto-sync
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

          {/* Templates Grid */}
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
                    {/* Live Animated 9:14 Template Preview */}
                    <div
                      onClick={() => handlePreviewTemplateFirst(tpl)}
                      className="relative aspect-[9/14] w-full bg-black overflow-hidden cursor-pointer gpu-accelerated"
                    >
                      <TemplateAnimatedPreview template={tpl} />

                      {/* Top Category + BPM Header over gradient scrim */}
                      <div className="absolute top-0 left-0 right-0 p-2.5 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between gap-1 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[10px] font-bold text-white truncate">
                          {tpl.categoryLabel}
                        </span>
                        <span className="text-[10px] font-bold text-cyan-300 tabular-nums shrink-0">
                          {tpl.bpm} BPM
                        </span>
                      </div>

                      {/* Subtle Preview Hint Overlay */}
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 border border-white/15 text-[10px] font-bold text-neutral-200 pointer-events-none">
                        Preview
                      </div>
                    </div>

                    {/* Card Body: Bold Title, Subtitle Badge (X Clips • 0:XX) & High-Contrast Use Template CTA */}
                    <div className="p-3 sm:p-3.5 flex flex-col justify-between gap-3 flex-1 bg-neutral-950/60">
                      <div className="space-y-2">
                        <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-snug line-clamp-1">
                          {tpl.name}
                        </h2>

                        {/* Required Clip Count & Duration Subtitle Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/95 border border-neutral-700 text-[11px] font-extrabold text-pink-300 tabular-nums">
                          <Film className="w-3 h-3 text-pink-400 shrink-0" />
                          <span>
                            {tpl.requiredClips} Clips • {formattedDuration}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {tpl.tagline}
                        </p>

                        <p className="text-[10px] text-neutral-400 flex items-center gap-1 truncate pt-0.5">
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
    </div>
  );
};

export const TemplatesStudioView = React.memo(TemplatesStudioViewComponent);

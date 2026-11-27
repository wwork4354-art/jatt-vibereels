import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Scissors,
  Sliders,
  Type,
  Smile,
  Music,
  Upload,
  Download,
  Sparkles,
  Trash2,
  FileAudio,
  Search,
  Check,
  Volume2,
  Lock,
  Image as ImageIcon,
  Video as VideoIcon,
  RotateCcw,
  Gauge,
  ArrowLeftRight,
  Copy,
  Send,
  Move,
  Play,
  Pause,
  Globe,
  SlidersHorizontal,
  Layers,
  Diamond,
  Plus,
  Captions,
  Megaphone,
  Wand2,
  Eraser,
  Crop,
  Zap,
  RotateCw,
} from 'lucide-react';
import { AudioTrackOption, CreatorProfileData, UserAccount, VideoPost } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { compressImageFile } from '../utils/imageOptimize';
import { savePostForOffline } from '../lib/offlineMediaStore';
import {
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  getOrCreateUserProfileId,
  fileToPersistentDataUrl,
  saveLocalPostRecord,
  savePostAudioMeta,
  savePostPrivacyMeta,
} from '../lib/supabaseService';
import {
  checkRateLimit,
  recordRateLimitEvent,
  sanitizeHashtagsInput,
  sanitizeInputLive,
  sanitizeText,
  sanitizeUsername,
  validateSafeAudioFile,
  validateSafeMediaFile,
} from '../utils/security';
import {
  PRO_FILTER_LUTS,
  TEXT_FONT_STYLES,
  SPEED_CURVE_PRESETS,
  DEFAULT_MASK_CONFIG,
  DEFAULT_BG_REMOVAL_CONFIG,
  DEFAULT_TICKER_CONFIG,
  DEFAULT_CROP_CONFIG,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_ENHANCE_CONFIG,
  ProFilterLut,
  TimelineClipItem,
  ClipTransitionType,
  SpeedCurvePresetId,
  TextAnimationStyle,
  EditorTextLayer,
  EditorStickerLayer,
  EditorOverlayLayer,
  EditorMaskConfig,
  EditorMaskShape,
  VisualEffectConfig,
  BgRemovalConfig,
  SubtitleSegment,
  TickerConfig,
  CropConfig,
  AnimationConfig,
  KeyframeMarker,
  EnhanceConfig,
  computeTimelineSpans,
  drawProTimelineFrame,
  evaluateSpeedMultiplierAtProgress,
  mapClipProgressToSourceTime,
  applyEnhanceSharpen,
  getStageDimensions,
  TimelineRenderOptions,
} from '../utils/proEditorEngine';
import { ProTimeline } from './ProTimeline';
import { StudioProToolPanels } from './StudioProToolPanels';
import {
  AttachedOnlineSong,
  MusicDrawerTab,
  StudioMusicPickerDrawer,
} from './StudioMusicPickerDrawer';

interface PhotoVideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  creatorProfile?: CreatorProfileData;
  initialFile?: File | null;
  onUploadSuccess: (newPost: VideoPost) => void;
  onUploadCloudSynced?: (tempId: string, syncedPost: VideoPost) => void;
  onShowToast?: (msg: string) => void;
}

type EditorToolTab =
  | 'trim'
  | 'text'
  | 'captions'
  | 'ticker'
  | 'effects'
  | 'filters'
  | 'bg_remove'
  | 'music'
  | 'volume'
  | 'speed'
  | 'crop'
  | 'animation'
  | 'keyframe'
  | 'enhance'
  | 'overlay'
  | 'mask'
  | 'stickers'
  | 'transitions'
  | 'post';

const MASK_SHAPE_OPTIONS: { id: EditorMaskShape; label: string; desc: string }[] = [
  { id: 'none', label: 'None', desc: 'Full frame' },
  { id: 'diamond', label: 'Diamond', desc: '4-point gem' },
  { id: 'circle', label: 'Circle', desc: 'Spotlight' },
  { id: 'heart', label: 'Heart', desc: 'Soft romance' },
  { id: 'star', label: 'Star', desc: '5-point star' },
  { id: 'split', label: 'Split', desc: 'Linear divider' },
  { id: 'rectangle', label: 'Film Box', desc: 'Rounded frame' },
];

type ExportResolution = '1080p' | '4k';

const TEXT_COLOR_SWATCHES = [
  '#ffffff',
  '#22d3ee',
  '#f43f5e',
  '#facc15',
  '#a855f7',
  '#10b981',
  '#000000',
];

const TEXT_ANIMATION_OPTIONS: { id: TextAnimationStyle; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'pop', label: 'Pop In' },
  { id: 'neon_pulse', label: 'Neon Pulse' },
  { id: 'slide_up', label: 'Slide Up' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'float', label: 'Float' },
];

const TRANSITION_PRESETS: { id: ClipTransitionType; label: string; desc: string }[] = [
  { id: 'none', label: 'Cut', desc: 'Instant clean cut' },
  { id: 'fade', label: 'Fade', desc: 'Smooth cross dissolve' },
  { id: 'zoom_punch', label: 'Zoom Punch', desc: 'High-impact lens punch' },
  { id: 'glitch', label: 'Glitch', desc: 'Cyber RGB slice glitch' },
  { id: 'swipe', label: 'Swipe', desc: 'Fast horizontal wipe' },
];

const SPEED_QUICK_PRESETS = [
  { val: 0.25, label: '0.25x Slow-Mo' },
  { val: 0.5, label: '0.5x Slow' },
  { val: 1, label: '1x Normal' },
  { val: 1.5, label: '1.5x Fast' },
  { val: 2, label: '2x Speed' },
  { val: 4, label: '4x Hyper' },
];

const STICKER_OPTIONS = [
  '🔥',
  '❤️',
  '😂',
  '🎵',
  '👑',
  '😎',
  '✨',
  '💯',
  '🕺',
  '🎬',
  '🦁',
  '🌟',
  '💥',
  '🥳',
  '🚀',
  '💎',
  '🙌',
  '🎶',
];

const QUICK_CAPTION_PRESETS = [
  'JATT VIBES 🔥',
  'NEW REEL 🎬',
  'WAIT FOR IT...',
  'PUNJABI BEAT 🎵',
];

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export const PhotoVideoEditorModal: React.FC<PhotoVideoEditorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  creatorProfile,
  initialFile,
  onUploadSuccess,
  onUploadCloudSynced,
  onShowToast,
}) => {
  // Multi-clip timeline state
  const [clips, setClips] = useState<TimelineClipItem[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<EditorToolTab>('trim');
  const [zoomLevel, setZoomLevel] = useState<number>(1.5);

  // Real-time 60fps Playback & Playhead
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playheadTime, setPlayheadTime] = useState<number>(0);

  // Pro Filters & LUTs
  const [selectedLut, setSelectedLut] = useState<ProFilterLut>(PRO_FILTER_LUTS[0]);
  const [lutIntensity, setLutIntensity] = useState<number>(100);
  const [brightnessAdj, setBrightnessAdj] = useState<number>(0);
  const [contrastAdj, setContrastAdj] = useState<number>(0);
  const [saturateAdj, setSaturateAdj] = useState<number>(0);
  const [vignetteAdj, setVignetteAdj] = useState<number>(0);

  // Draggable, Resizable, Rotatable Text Overlays (supports multi-layer + duplicate/delete)
  const [textLayer, setTextLayer] = useState<EditorTextLayer>({
    id: 'txt-main',
    text: '',
    fontId: 'modern',
    color: '#ffffff',
    size: 30,
    xPercent: 50,
    yPercent: 72,
    rotationDeg: 0,
    neonGlow: false,
    outline: true,
    backdrop: true,
    animation: 'pop',
    animConfig: { ...DEFAULT_ANIMATION_CONFIG },
  });
  const [extraTextLayers, setExtraTextLayers] = useState<EditorTextLayer[]>([]);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number>(0);

  // Auto-Captions, Ticker, Visual Effects, BG Remove, Crop, Animations, Keyframes, Enhance
  const [captions, setCaptions] = useState<SubtitleSegment[]>([]);
  const [ticker, setTicker] = useState<TickerConfig>({ ...DEFAULT_TICKER_CONFIG });
  const [visualEffect, setVisualEffect] = useState<VisualEffectConfig>({
    type: 'none',
    intensity: 70,
  });
  const [bgRemoval, setBgRemoval] = useState<BgRemovalConfig>({ ...DEFAULT_BG_REMOVAL_CONFIG });
  const [captionsAndEffectsActive] = useState(true);
  void captionsAndEffectsActive;
  const [cropConfig, setCropConfig] = useState<CropConfig>({ ...DEFAULT_CROP_CONFIG });
  const [clipAnimation, setClipAnimation] = useState<AnimationConfig>({
    ...DEFAULT_ANIMATION_CONFIG,
  });
  const [keyframes, setKeyframes] = useState<KeyframeMarker[]>([]);
  const [enhanceConfig, setEnhanceConfig] = useState<EnhanceConfig>({
    ...DEFAULT_ENHANCE_CONFIG,
  });

  // Draggable Stickers
  const [stickers, setStickers] = useState<EditorStickerLayer[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<'text' | 'mask' | 'crop' | string | null>(null);

  // CapCut Overlay (PIP) Multi-Layers & Shape Masks (Diamond, Circle, Heart, Star, Split, Rectangle)
  const [overlays, setOverlays] = useState<EditorOverlayLayer[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [mainMask, setMainMask] = useState<EditorMaskConfig>({ ...DEFAULT_MASK_CONFIG });
  const [maskTarget, setMaskTarget] = useState<'main' | 'overlay'>('main');

  // Audio / Music Mixer + CapCut Sound Picker Drawer
  const [isMusicDrawerOpen, setIsMusicDrawerOpen] = useState(false);
  const [musicDrawerTab, setMusicDrawerTab] = useState<MusicDrawerTab>('online');
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<AudioTrackOption | null>(null);
  const [selectedOnlineSong, setSelectedOnlineSong] = useState<AttachedOnlineSong | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedAudioPreviewUrl, setSelectedAudioPreviewUrl] = useState<string | null>(null);
  const [previewingAudioId, setPreviewingAudioId] = useState<string | null>(null);
  const [originalVolume, setOriginalVolume] = useState<number>(100);
  const [bgAudioVolume, setBgAudioVolume] = useState<number>(80);
  const [audioStartOffset, setAudioStartOffset] = useState<number>(0);
  const [audioFadeIn, setAudioFadeIn] = useState<number>(0);
  const [audioFadeOut, setAudioFadeOut] = useState<number>(0);
  const [customAudioDuration, setCustomAudioDuration] = useState<number>(120);

  // Export & Post Metadata
  const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');
  const [postTitle, setPostTitle] = useState('');
  const [hashtagsStr, setHashtagsStr] = useState('#jattvibereels #capcutpro #trending');
  const [allowDownload, setAllowDownload] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [editorError, setEditorError] = useState('');

  // Refs for DOM, 60fps Canvas Loop & Media Cache
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overlayFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const inspectorBodyRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaElementCacheRef = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);
  const playheadRef = useRef<number>(0);
  const exportCancelRef = useRef<boolean>(false);
  const audioBoostCtxRef = useRef<AudioContext | null>(null);
  const audioGainNodeMapRef = useRef<WeakMap<HTMLMediaElement, GainNode>>(new WeakMap());
  const pinchGestureRef = useRef<{
    overlayId: string;
    startDist: number;
    startScale: number;
    startAngleDeg: number;
    startRotDeg: number;
  } | null>(null);

  playheadRef.current = playheadTime;

  const activateEditorTool = useCallback(
    (tool: EditorToolTab) => {
      setActiveTool(tool);
      window.requestAnimationFrame(() => {
        inspectorBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        if (tool === 'text') {
          window.setTimeout(() => {
            textInputRef.current?.focus();
          }, 40);
        }
      });
    },
    []
  );

  const { spans, totalDuration } = useMemo(() => computeTimelineSpans(clips), [clips]);

  const selectedClip = useMemo(() => {
    if (clips.length === 0) return null;
    return clips.find((c) => c.id === selectedClipId) || clips[0];
  }, [clips, selectedClipId]);

  const hasAttachedMusic = Boolean(
    selectedAudioFile || selectedLibraryTrack || selectedOnlineSong
  );

  const allTextLayers = useMemo(() => {
    return [textLayer, ...extraTextLayers];
  }, [textLayer, extraTextLayers]);

  const activeTextLayer = useMemo(() => {
    return allTextLayers[selectedTextIndex] || textLayer;
  }, [allTextLayers, selectedTextIndex, textLayer]);

  const updateActiveTextLayer = useCallback(
    (updater: (prev: EditorTextLayer) => EditorTextLayer) => {
      if (selectedTextIndex === 0 || selectedTextIndex >= allTextLayers.length) {
        setTextLayer((prev) => updater(prev));
      } else {
        const extraIdx = selectedTextIndex - 1;
        setExtraTextLayers((prev) =>
          prev.map((layer, idx) => (idx === extraIdx ? updater(layer) : layer))
        );
      }
    },
    [selectedTextIndex, allTextLayers.length]
  );

  const stagePreviewDims = useMemo(
    () => getStageDimensions(cropConfig.aspect, 'preview'),
    [cropConfig.aspect]
  );

  const renderOptions: TimelineRenderOptions = useMemo(
    () => ({
      filterLut: selectedLut,
      lutIntensity,
      brightnessAdj,
      contrastAdj,
      saturateAdj,
      vignetteAdj,
      mainMask,
      overlays,
      textLayer,
      textLayers: allTextLayers,
      stickers,
      visualEffect,
      bgRemoval,
      captions,
      ticker,
      crop: cropConfig,
      clipAnimation,
      keyframes,
      enhance: enhanceConfig,
    }),
    [
      selectedLut,
      lutIntensity,
      brightnessAdj,
      contrastAdj,
      saturateAdj,
      vignetteAdj,
      mainMask,
      overlays,
      textLayer,
      allTextLayers,
      stickers,
      visualEffect,
      bgRemoval,
      captions,
      ticker,
      cropConfig,
      clipAnimation,
      keyframes,
      enhanceConfig,
    ]
  );

  const hasVideoInTimeline = useMemo(
    () => clips.some((c) => c.mediaType === 'video'),
    [clips]
  );

  const hasAnyEdits = useMemo(() => {
    const lutChanged =
      selectedLut.id !== 'original' ||
      brightnessAdj !== 0 ||
      contrastAdj !== 0 ||
      saturateAdj !== 0 ||
      vignetteAdj !== 0;
    const speedOrTrimChanged = clips.some(
      (c) =>
        c.speed !== 1 ||
        c.speedCurve !== 'linear' ||
        c.trimStart > 0.15 ||
        Math.abs(c.naturalDuration - c.trimEnd) > 0.25 ||
        c.photoFit === 'cover'
    );
    const cropChanged =
      cropConfig.aspect !== '9:16' ||
      cropConfig.zoom !== 1 ||
      cropConfig.panXPercent !== 0 ||
      cropConfig.panYPercent !== 0;
    const animChanged =
      clipAnimation.inAnim !== 'none' ||
      clipAnimation.outAnim !== 'none' ||
      clipAnimation.comboAnim !== 'none';
    return (
      clips.length > 1 ||
      lutChanged ||
      speedOrTrimChanged ||
      mainMask.shape !== 'none' ||
      overlays.length > 0 ||
      allTextLayers.some((t) => t.text.trim().length > 0) ||
      stickers.length > 0 ||
      captions.length > 0 ||
      ticker.enabled ||
      visualEffect.type !== 'none' ||
      bgRemoval.mode !== 'off' ||
      cropChanged ||
      animChanged ||
      keyframes.length > 0 ||
      enhanceConfig.enabled ||
      originalVolume !== 100
    );
  }, [
    clips,
    selectedLut.id,
    brightnessAdj,
    contrastAdj,
    saturateAdj,
    vignetteAdj,
    mainMask.shape,
    overlays.length,
    allTextLayers,
    stickers.length,
    captions.length,
    ticker.enabled,
    visualEffect.type,
    bgRemoval.mode,
    cropConfig,
    clipAnimation,
    keyframes.length,
    enhanceConfig.enabled,
    originalVolume,
  ]);

  // Add one or multiple media files cleanly onto the timeline
  const addMediaFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return;
      setEditorError('');
      const added: TimelineClipItem[] = [];

      for (const file of fileList) {
        const check = validateSafeMediaFile(file);
        if (!check.valid) {
          const msg =
            check.reason || 'Only safe .mp4, .webm, .jpg, .png, and .webp files are allowed.';
          setEditorError(msg);
          onShowToast?.(msg);
          continue;
        }

        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        const sourceId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const clipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        if (check.mediaType === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            window.setTimeout(resolve, 1500);
          });
          mediaElementCacheRef.current.set(sourceId, img);
          added.push({
            id: clipId,
            sourceId,
            name: file.name,
            mediaType: 'image',
            url,
            file,
            naturalDuration: 10,
            trimStart: 0,
            trimEnd: 4,
            speed: 1,
            speedCurve: 'linear',
            transitionAfter: 'fade',
            transitionDuration: 0.45,
            photoFit: 'contain',
          });
        } else {
          const vid = document.createElement('video');
          vid.src = url;
          vid.crossOrigin = 'anonymous';
          vid.muted = true;
          vid.playsInline = true;
          vid.preload = 'auto';
          await new Promise<void>((resolve) => {
            vid.onloadedmetadata = () => resolve();
            vid.onerror = () => resolve();
            window.setTimeout(resolve, 2500);
          });
          const dur =
            Number.isFinite(vid.duration) && vid.duration > 0.3 ? vid.duration : 6;
          mediaElementCacheRef.current.set(sourceId, vid);
          added.push({
            id: clipId,
            sourceId,
            name: file.name,
            mediaType: 'video',
            url,
            file,
            naturalDuration: dur,
            trimStart: 0,
            trimEnd: dur,
            speed: 1,
            speedCurve: 'linear',
            transitionAfter: 'fade',
            transitionDuration: 0.45,
            photoFit: 'contain',
          });
        }
      }

      if (added.length > 0) {
        setClips((prev) => [...prev, ...added]);
        setSelectedClipId((prev) => prev || added[0].id);
        setIsPlaying(true);
        setPostTitle((prev) => {
          if (prev.trim()) return prev;
          return sanitizeText(
            added[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            90
          );
        });
        if (added.length > 1) {
          onShowToast?.(`Added ${added.length} clips to timeline`);
        }
      }
    },
    [onShowToast]
  );

  // Add CapCut Overlay (PIP) photo or video layers on top of main video
  const addOverlayFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return;
      const newOverlays: EditorOverlayLayer[] = [];
      const durSpan = Math.max(4, totalDuration || 8);

      for (const file of fileList) {
        const check = validateSafeMediaFile(file);
        if (!check.valid) {
          onShowToast?.(check.reason || 'Only safe .mp4, .webm, .jpg, .png, .webp allowed.');
          continue;
        }
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        const sourceId = `ov-src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const ovId = `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        if (check.mediaType === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            window.setTimeout(resolve, 1500);
          });
          mediaElementCacheRef.current.set(sourceId, img);
          newOverlays.push({
            id: ovId,
            sourceId,
            name: file.name,
            mediaType: 'image',
            url,
            file,
            naturalDuration: durSpan,
            xPercent: 50 + (overlays.length % 2 === 0 ? 14 : -14),
            yPercent: 32 + (overlays.length % 3) * 10,
            scale: 0.9,
            rotationDeg: 0,
            opacity: 100,
            startTime: 0,
            endTime: 999,
            mask: { ...DEFAULT_MASK_CONFIG },
          });
        } else {
          const vid = document.createElement('video');
          vid.src = url;
          vid.crossOrigin = 'anonymous';
          vid.muted = true;
          vid.loop = true;
          vid.playsInline = true;
          vid.preload = 'auto';
          await new Promise<void>((resolve) => {
            vid.onloadedmetadata = () => resolve();
            vid.onerror = () => resolve();
            window.setTimeout(resolve, 2500);
          });
          const dur = Number.isFinite(vid.duration) && vid.duration > 0.3 ? vid.duration : 6;
          mediaElementCacheRef.current.set(sourceId, vid);
          newOverlays.push({
            id: ovId,
            sourceId,
            name: file.name,
            mediaType: 'video',
            url,
            file,
            naturalDuration: dur,
            xPercent: 50 + (overlays.length % 2 === 0 ? 14 : -14),
            yPercent: 32 + (overlays.length % 3) * 10,
            scale: 0.9,
            rotationDeg: 0,
            opacity: 100,
            startTime: 0,
            endTime: 999,
            mask: { ...DEFAULT_MASK_CONFIG },
          });
        }
      }

      if (newOverlays.length > 0) {
        setOverlays((prev) => [...prev, ...newOverlays]);
        setActiveOverlayId(newOverlays[newOverlays.length - 1].id);
        setActiveTool('overlay');
        onShowToast?.(
          `Added ${newOverlays.length} PIP Overlay${newOverlays.length > 1 ? 's' : ''} — Drag or pinch to resize!`
        );
      }
    },
    [onShowToast, overlays.length, totalDuration]
  );

  // Load initialFile cleanly when opened with one
  useEffect(() => {
    if (isOpen && initialFile && clips.length === 0) {
      void addMediaFiles([initialFile]);
    }
  }, [isOpen, initialFile, clips.length, addMediaFiles]);

  // Cleanup URLs and audio on unmount, close, or app backgrounding
  useEffect(() => {
    const pauseStudioPlayback = () => {
      setIsPlaying(false);
      soundEngine.suspendAll();
      setPreviewingAudioId(null);
      if (previewAudioRef.current) {
        previewAudioRef.current.muted = true;
        previewAudioRef.current.pause();
      }
      mediaElementCacheRef.current.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
          el.muted = true;
          el.pause();
        }
      });
      if (audioBoostCtxRef.current && audioBoostCtxRef.current.state === 'running') {
        void audioBoostCtxRef.current.suspend().catch(() => {});
      }
    };

    if (!isOpen) {
      pauseStudioPlayback();
      return () => {
        soundEngine.stopPreviewTrack();
      };
    }

    const handleVisibility = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        pauseStudioPlayback();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('freeze', pauseStudioPlayback as EventListener);
    window.addEventListener('pagehide', pauseStudioPlayback);
    window.addEventListener('blur', pauseStudioPlayback);
    window.addEventListener('jatt-app-backgrounded', pauseStudioPlayback as EventListener);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('freeze', pauseStudioPlayback as EventListener);
      window.removeEventListener('pagehide', pauseStudioPlayback);
      window.removeEventListener('blur', pauseStudioPlayback);
      window.removeEventListener('jatt-app-backgrounded', pauseStudioPlayback as EventListener);
      soundEngine.stopPreviewTrack();
    };
  }, [isOpen]);

  useEffect(() => {
    const cache = mediaElementCacheRef.current;
    const urls = objectUrlsRef.current;
    return () => {
      cache.forEach((el) => {
        if (el instanceof HTMLVideoElement) el.pause();
      });
      cache.clear();
      for (const u of urls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Sync preview audio element volume (with Fade-In / Fade-Out envelope) and start offset
  useEffect(() => {
    const el = previewAudioRef.current;
    if (!el || !selectedAudioPreviewUrl || !isOpen) return;

    const fadeInGain =
      audioFadeIn > 0.05 ? Math.min(1, Math.max(0, playheadTime / audioFadeIn)) : 1;
    const fadeOutGain =
      audioFadeOut > 0.05 && totalDuration > audioFadeOut
        ? Math.min(1, Math.max(0, (totalDuration - playheadTime) / audioFadeOut))
        : 1;
    const targetBoostGain = Math.max(0, Math.min(2, (bgAudioVolume / 100) * Math.min(fadeInGain, fadeOutGain)));
    el.volume = Math.max(0, Math.min(1, targetBoostGain));
    if (bgAudioVolume > 100) {
      try {
        let gainNode = audioGainNodeMapRef.current.get(el);
        if (!gainNode) {
          const ACtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!audioBoostCtxRef.current) audioBoostCtxRef.current = new ACtx();
          const src = audioBoostCtxRef.current.createMediaElementSource(el);
          gainNode = audioBoostCtxRef.current.createGain();
          src.connect(gainNode);
          gainNode.connect(audioBoostCtxRef.current.destination);
          audioGainNodeMapRef.current.set(el, gainNode);
        }
        if (audioBoostCtxRef.current?.state === 'suspended') {
          void audioBoostCtxRef.current.resume().catch(() => {});
        }
        gainNode.gain.value = targetBoostGain;
      } catch {
        // fallback cleanly to native HTMLMediaElement volume
      }
    } else {
      const existingGain = audioGainNodeMapRef.current.get(el);
      if (existingGain) existingGain.gain.value = targetBoostGain;
    }

    const maxAudioDur = Number.isFinite(el.duration) && el.duration > 1 ? el.duration : 0;
    const desiredRawTime = audioStartOffset + playheadTime;
    const desiredTime = maxAudioDur > 0 ? desiredRawTime % maxAudioDur : desiredRawTime;

    if (Math.abs(el.currentTime - desiredTime) > 0.45 && el.readyState >= 1) {
      try {
        el.currentTime = desiredTime;
      } catch {
        // ignore seek before ready
      }
    }

    if (isPlaying && !isExporting && bgAudioVolume > 1) {
      if (el.paused) {
        void el.play().catch(() => {});
      }
    } else if (!el.paused) {
      el.pause();
    }
  }, [
    isOpen,
    isPlaying,
    isExporting,
    playheadTime,
    totalDuration,
    bgAudioVolume,
    audioStartOffset,
    audioFadeIn,
    audioFadeOut,
    selectedAudioPreviewUrl,
  ]);

  // Real-time 60fps Canvas Preview Engine synced to Playhead + Speed Curves + Video Elements
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current || spans.length === 0) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastNow = performance.now();

    const syncVideosToTime = (tSec: number, playing: boolean) => {
      const span =
        spans.find((s) => tSec >= s.timelineStart && tSec <= s.timelineEnd) ||
        spans[spans.length - 1];
      if (!span) return;

      const localElapsed = Math.max(0, tSec - span.timelineStart);
      const progress01 = Math.max(0, Math.min(1, localElapsed / span.effectiveDuration));
      const targetSrcTime = mapClipProgressToSourceTime(span.clip, progress01);
      const instantSpeed = evaluateSpeedMultiplierAtProgress(
        span.clip.speed,
        span.clip.speedCurve,
        progress01
      );

      const overlayVideoSrcIds = new Set(
        overlays.filter((o) => o.mediaType === 'video').map((o) => o.sourceId)
      );

      mediaElementCacheRef.current.forEach((el, srcId) => {
        if (!(el instanceof HTMLVideoElement)) return;
        const isOverlayVid = overlayVideoSrcIds.has(srcId);
        if (isOverlayVid) {
          const matchedOv = overlays.find((o) => o.sourceId === srcId);
          if (!matchedOv || tSec < matchedOv.startTime || tSec > matchedOv.endTime) {
            if (!el.paused) el.pause();
            return;
          }
          el.muted = true;
          const ovElapsed = Math.max(0, tSec - matchedOv.startTime);
          const ovDur = Number.isFinite(el.duration) && el.duration > 0.2 ? el.duration : 6;
          const ovTargetT = ovElapsed % ovDur;
          if (playing) {
            if (Math.abs(el.currentTime - ovTargetT) > 0.35) {
              try {
                el.currentTime = ovTargetT;
              } catch {
                // ignore
              }
            }
            if (el.paused) {
              void el.play().catch(() => {});
            }
          } else {
            if (!el.paused) el.pause();
            if (Math.abs(el.currentTime - ovTargetT) > 0.05) {
              try {
                el.currentTime = ovTargetT;
              } catch {
                // ignore
              }
            }
          }
          return;
        }

        const isCurrentSource = srcId === span.clip.sourceId;
        if (!isCurrentSource) {
          if (!el.paused) el.pause();
          return;
        }
        const clipGainFactor = Math.max(0, Math.min(2, originalVolume / 100));
        el.volume = Math.max(0, Math.min(1, clipGainFactor));
        el.muted = originalVolume <= 1 || !playing;
        if (originalVolume > 100 && playing) {
          try {
            let vGain = audioGainNodeMapRef.current.get(el);
            if (!vGain) {
              const ACtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                  .webkitAudioContext;
              if (!audioBoostCtxRef.current) audioBoostCtxRef.current = new ACtx();
              const src = audioBoostCtxRef.current.createMediaElementSource(el);
              vGain = audioBoostCtxRef.current.createGain();
              src.connect(vGain);
              vGain.connect(audioBoostCtxRef.current.destination);
              audioGainNodeMapRef.current.set(el, vGain);
            }
            if (audioBoostCtxRef.current?.state === 'suspended') {
              void audioBoostCtxRef.current.resume().catch(() => {});
            }
            vGain.gain.value = clipGainFactor;
          } catch {
            // ignore WebAudio boost fallback
          }
        } else {
          const existingVGain = audioGainNodeMapRef.current.get(el);
          if (existingVGain) existingVGain.gain.value = clipGainFactor;
        }
        try {
          el.playbackRate = instantSpeed;
        } catch {
          // ignore out-of-range browser rate
        }

        if (playing) {
          if (Math.abs(el.currentTime - targetSrcTime) > 0.32) {
            try {
              el.currentTime = targetSrcTime;
            } catch {
              // ignore
            }
          }
          if (el.paused) {
            void el.play().catch(() => {});
          }
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - targetSrcTime) > 0.04) {
            try {
              el.currentTime = targetSrcTime;
            } catch {
              // ignore
            }
          }
        }
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;

      let currentT = playheadRef.current;
      if (isPlaying && !isExporting && totalDuration > 0) {
        currentT += dt;
        if (currentT >= totalDuration) {
          currentT = 0;
        }
        playheadRef.current = currentT;
        setPlayheadTime(currentT);
      }

      syncVideosToTime(currentT, isPlaying && !isExporting);
      drawProTimelineFrame(
        ctx,
        canvas.width,
        canvas.height,
        currentT,
        spans,
        mediaElementCacheRef.current,
        renderOptions
      );
      if (enhanceConfig.enabled) {
        applyEnhanceSharpen(ctx, canvas.width, canvas.height, enhanceConfig.sharpness / 100);
      }

      if (isPlaying && !isExporting) {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying && !isExporting) {
      rafId = requestAnimationFrame(tick);
    } else {
      syncVideosToTime(playheadRef.current, false);
      drawProTimelineFrame(
        ctx,
        canvas.width,
        canvas.height,
        playheadRef.current,
        spans,
        mediaElementCacheRef.current,
        renderOptions
      );
      if (enhanceConfig.enabled) {
        applyEnhanceSharpen(ctx, canvas.width, canvas.height, enhanceConfig.sharpness / 100);
      }
    }

    return () => cancelAnimationFrame(rafId);
  }, [
    isOpen,
    spans,
    overlays,
    totalDuration,
    isPlaying,
    isExporting,
    originalVolume,
    renderOptions,
    playheadTime,
  ]);

  if (!isOpen) return null;

  // Helpers to mutate selected clip
  const updateSelectedClip = (updater: (clip: TimelineClipItem) => TimelineClipItem) => {
    if (!selectedClip) return;
    setClips((prev) => prev.map((c) => (c.id === selectedClip.id ? updater(c) : c)));
  };

  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) {
      if (selectedAudioPreviewUrl && previewAudioRef.current) {
        try {
          if (previewAudioRef.current.readyState >= 1) {
            previewAudioRef.current.currentTime = audioStartOffset + playheadTime;
          }
        } catch {
          // ignore
        }
        previewAudioRef.current.volume = Math.max(0, Math.min(1, bgAudioVolume / 100));
        void previewAudioRef.current.play().catch(() => {});
      } else if (selectedLibraryTrack) {
        soundEngine.playPreviewTrack(selectedLibraryTrack.trackType, bgAudioVolume / 100);
        setPreviewingAudioId(selectedLibraryTrack.id);
      }
    } else {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      soundEngine.stopPreviewTrack();
      setPreviewingAudioId(null);
    }
  };

  const handleScrub = (nextTimeSec: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, nextTimeSec));
    playheadRef.current = clamped;
    setPlayheadTime(clamped);
    if (selectedAudioPreviewUrl && previewAudioRef.current && previewAudioRef.current.readyState >= 1) {
      try {
        const dur =
          Number.isFinite(previewAudioRef.current.duration) && previewAudioRef.current.duration > 1
            ? previewAudioRef.current.duration
            : 0;
        const target = audioStartOffset + clamped;
        previewAudioRef.current.currentTime = dur > 0 ? target % dur : target;
      } catch {
        // ignore
      }
    }
    // Select whichever clip lies under the playhead needle
    const hit = spans.find((s) => clamped >= s.timelineStart && clamped <= s.timelineEnd);
    if (hit && hit.clip.id !== selectedClipId) {
      setSelectedClipId(hit.clip.id);
    }
  };

  // One-Tap Split Clip right at Playhead Needle
  const handleSplitAtPlayhead = () => {
    if (spans.length === 0) return;
    const hit =
      spans.find(
        (s) => playheadTime > s.timelineStart + 0.15 && playheadTime < s.timelineEnd - 0.15
      ) || spans.find((s) => s.clip.id === selectedClip?.id);

    if (!hit) {
      onShowToast?.('Move playhead inside a clip (away from edges) to split.');
      return;
    }

    const spanDuration = hit.effectiveDuration;
    if (spanDuration < 0.7) {
      onShowToast?.('Clip is too short to split further.');
      return;
    }

    // If playhead wasn't inside selected clip, split nicely at midpoint
    const inside =
      playheadTime > hit.timelineStart + 0.15 && playheadTime < hit.timelineEnd - 0.15;
    const progress01 = inside
      ? (playheadTime - hit.timelineStart) / spanDuration
      : 0.5;
    const splitSourceTime = Number(
      mapClipProgressToSourceTime(hit.clip, progress01).toFixed(2)
    );

    if (
      splitSourceTime <= hit.clip.trimStart + 0.2 ||
      splitSourceTime >= hit.clip.trimEnd - 0.2
    ) {
      onShowToast?.('Move playhead closer to middle of clip to split.');
      return;
    }

    const partA: TimelineClipItem = {
      ...hit.clip,
      trimEnd: splitSourceTime,
      transitionAfter: hit.clip.transitionAfter === 'none' ? 'fade' : hit.clip.transitionAfter,
    };
    const partB: TimelineClipItem = {
      ...hit.clip,
      id: `clip-split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trimStart: splitSourceTime,
    };

    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === hit.clip.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1, partA, partB);
      return copy;
    });
    setSelectedClipId(partB.id);
    onShowToast?.('Split clip cleanly at playhead!');
  };

  const handleDuplicateSelectedClip = () => {
    if (!selectedClip) return;
    const copy: TimelineClipItem = {
      ...selectedClip,
      id: `clip-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedClip.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedClipId(copy.id);
    onShowToast?.('Duplicated clip segment');
  };

  const handleDeleteSelectedClip = () => {
    if (!selectedClip) return;
    if (clips.length <= 1) {
      onShowToast?.('Keep at least 1 clip in timeline or tap Add Clip.');
      return;
    }
    setClips((prev) => {
      const filtered = prev.filter((c) => c.id !== selectedClip.id);
      setSelectedClipId(filtered[0]?.id || null);
      return filtered;
    });
    setPlayheadTime(0);
    onShowToast?.('Deleted selected clip');
  };

  // Contextual 1-Click Duplicate & Delete across Clip, Text, Sticker, or Overlay
  const handleDuplicateActiveItem = () => {
    if (activeTool === 'stickers' && activeStickerId) {
      const target = stickers.find((s) => s.id === activeStickerId);
      if (target) {
        const clone: EditorStickerLayer = {
          ...target,
          id: `stk-dup-${Date.now()}`,
          xPercent: Math.min(88, target.xPercent + 8),
          yPercent: Math.min(88, target.yPercent + 6),
        };
        setStickers((prev) => [...prev, clone]);
        setActiveStickerId(clone.id);
        onShowToast?.('Duplicated sticker');
        return;
      }
    }
    if (activeTool === 'overlay' && activeOverlayId) {
      const target = overlays.find((o) => o.id === activeOverlayId);
      if (target) {
        const clone: EditorOverlayLayer = {
          ...target,
          id: `ov-dup-${Date.now()}`,
          xPercent: Math.min(86, target.xPercent + 8),
          yPercent: Math.min(86, target.yPercent + 6),
        };
        setOverlays((prev) => [...prev, clone]);
        setActiveOverlayId(clone.id);
        onShowToast?.('Duplicated overlay layer');
        return;
      }
    }
    if (activeTool === 'text' && activeTextLayer.text.trim()) {
      const clone: EditorTextLayer = {
        ...activeTextLayer,
        id: `txt-dup-${Date.now()}`,
        xPercent: Math.min(86, activeTextLayer.xPercent + 6),
        yPercent: Math.max(14, activeTextLayer.yPercent - 10),
      };
      setExtraTextLayers((prev) => [...prev, clone]);
      setSelectedTextIndex(allTextLayers.length);
      onShowToast?.('Duplicated text layer');
      return;
    }
    handleDuplicateSelectedClip();
  };

  const handleDeleteActiveItem = () => {
    if (activeTool === 'stickers' && activeStickerId) {
      setStickers((prev) => prev.filter((s) => s.id !== activeStickerId));
      setActiveStickerId(null);
      onShowToast?.('Deleted sticker');
      return;
    }
    if (activeTool === 'overlay' && activeOverlayId) {
      setOverlays((prev) => prev.filter((o) => o.id !== activeOverlayId));
      setActiveOverlayId(null);
      onShowToast?.('Deleted overlay layer');
      return;
    }
    if (activeTool === 'text' && activeTextLayer.text.trim()) {
      if (selectedTextIndex > 0 && selectedTextIndex - 1 < extraTextLayers.length) {
        const dropIdx = selectedTextIndex - 1;
        setExtraTextLayers((prev) => prev.filter((_, i) => i !== dropIdx));
        setSelectedTextIndex(0);
      } else if (extraTextLayers.length > 0) {
        const [promoted, ...rest] = extraTextLayers;
        setTextLayer(promoted);
        setExtraTextLayers(rest);
        setSelectedTextIndex(0);
      } else {
        setTextLayer((p) => ({ ...p, text: '' }));
      }
      onShowToast?.('Deleted text layer');
      return;
    }
    if (activeTool === 'captions' && captions.length > 0) {
      setCaptions((prev) => prev.slice(0, -1));
      onShowToast?.('Removed last caption block');
      return;
    }
    handleDeleteSelectedClip();
  };

  const handlePickBgReplacementImage = async (file: File) => {
    const check = validateSafeMediaFile(file);
    if (!check.valid || check.mediaType !== 'image') {
      onShowToast?.('Please choose a safe image (.jpg, .png, .webp) for background replacement.');
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    const srcId = `bg-rep-${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      window.setTimeout(resolve, 1500);
    });
    mediaElementCacheRef.current.set(srcId, img);
    setBgRemoval((prev) => ({
      ...prev,
      mode: prev.mode === 'off' ? 'person_cutout' : prev.mode,
      replaceMode: 'image',
      replaceImageSourceId: srcId,
    }));
    onShowToast?.('Background image applied!');
  };

  const handleAddOrUpdateKeyframe = (target: 'main' | 'text' | 'overlay') => {
    const t = Number(playheadTime.toFixed(2));
    const existing = keyframes.find(
      (k) => k.target === target && Math.abs(k.timeSec - t) < 0.25
    );
    const snapshot: Omit<KeyframeMarker, 'id'> =
      target === 'text'
        ? {
            target,
            timeSec: t,
            xPercent: activeTextLayer.xPercent,
            yPercent: activeTextLayer.yPercent,
            scale: 1,
            rotationDeg: activeTextLayer.rotationDeg || 0,
            opacity: 100,
          }
        : target === 'overlay' && activeOverlay
        ? {
            target,
            timeSec: t,
            xPercent: activeOverlay.xPercent,
            yPercent: activeOverlay.yPercent,
            scale: activeOverlay.scale,
            rotationDeg: activeOverlay.rotationDeg,
            opacity: activeOverlay.opacity,
          }
        : {
            target: 'main',
            timeSec: t,
            xPercent: 50,
            yPercent: 50,
            scale: cropConfig.zoom,
            rotationDeg: 0,
            opacity: 100,
          };

    if (existing) {
      setKeyframes((prev) =>
        prev.map((k) => (k.id === existing.id ? { ...k, ...snapshot } : k))
      );
      onShowToast?.(`Updated ◆ keyframe at ${t.toFixed(1)}s`);
    } else {
      setKeyframes((prev) => [
        ...prev,
        { id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...snapshot },
      ]);
      onShowToast?.(`Added ◆ keyframe at ${t.toFixed(1)}s`);
    }
  };

  const handleTrimClip = (clipId: string, nextTrimStart: number, nextTrimEnd: number) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId ? { ...c, trimStart: nextTrimStart, trimEnd: nextTrimEnd } : c
      )
    );
  };

  const resetAllEdits = () => {
    setSelectedLut(PRO_FILTER_LUTS[0]);
    setLutIntensity(100);
    setBrightnessAdj(0);
    setContrastAdj(0);
    setSaturateAdj(0);
    setVignetteAdj(0);
    setTextLayer({
      id: 'txt-main',
      text: '',
      fontId: 'modern',
      color: '#ffffff',
      size: 30,
      xPercent: 50,
      yPercent: 72,
      rotationDeg: 0,
      neonGlow: false,
      outline: true,
      backdrop: true,
      animation: 'pop',
      animConfig: { ...DEFAULT_ANIMATION_CONFIG },
    });
    setExtraTextLayers([]);
    setSelectedTextIndex(0);
    setCaptions([]);
    setTicker({ ...DEFAULT_TICKER_CONFIG });
    setVisualEffect({ type: 'none', intensity: 70 });
    setBgRemoval({ ...DEFAULT_BG_REMOVAL_CONFIG });
    setCropConfig({ ...DEFAULT_CROP_CONFIG });
    setClipAnimation({ ...DEFAULT_ANIMATION_CONFIG });
    setKeyframes([]);
    setEnhanceConfig({ ...DEFAULT_ENHANCE_CONFIG });
    setOriginalVolume(100);
    setBgAudioVolume(80);
    setStickers([]);
    setActiveStickerId(null);
    setOverlays([]);
    setActiveOverlayId(null);
    setMainMask({ ...DEFAULT_MASK_CONFIG });
    setMaskTarget('main');
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        trimStart: 0,
        trimEnd: c.mediaType === 'image' ? 4 : c.naturalDuration,
        speed: 1,
        speedCurve: 'linear',
        transitionAfter: 'fade',
      }))
    );
    setSelectedLibraryTrack(null);
    setSelectedOnlineSong(null);
    setSelectedAudioFile(null);
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    setSelectedAudioPreviewUrl(null);
    setAudioStartOffset(0);
    setAudioFadeIn(0);
    setAudioFadeOut(0);
    soundEngine.stopPreviewTrack();
    setPreviewingAudioId(null);
    setPlayheadTime(0);
    onShowToast?.('All studio edits reset');
  };

  const handleAddSticker = (emoji: string) => {
    const newItem: EditorStickerLayer = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      xPercent: 50 + ((stickers.length % 3) - 1) * 12,
      yPercent: 30 + (stickers.length % 3) * 10,
      size: 46,
    };
    setStickers((prev) => [...prev, newItem]);
    setActiveStickerId(newItem.id);
  };

  // Active Overlay & Mask Helpers
  const activeOverlay = useMemo(
    () => overlays.find((o) => o.id === activeOverlayId) || overlays[0] || null,
    [overlays, activeOverlayId]
  );

  const effectiveMaskTarget: 'main' | 'overlay' =
    maskTarget === 'overlay' && activeOverlay ? 'overlay' : 'main';

  const currentMaskConfig: EditorMaskConfig =
    effectiveMaskTarget === 'overlay' && activeOverlay ? activeOverlay.mask : mainMask;

  const updateCurrentMask = (updater: (prev: EditorMaskConfig) => EditorMaskConfig) => {
    if (effectiveMaskTarget === 'overlay' && activeOverlay) {
      setOverlays((prev) =>
        prev.map((o) => (o.id === activeOverlay.id ? { ...o, mask: updater(o.mask) } : o))
      );
    } else {
      setMainMask((prev) => updater(prev));
    }
  };

  // Drag-to-Position Overlays, Masks, Text, or Stickers directly on 9:16 Video Canvas
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // 1. Check Mask drag when Mask tab active and shape != none
    if (activeTool === 'mask' && currentMaskConfig.shape !== 'none') {
      setDraggingTarget('mask');
      stage.setPointerCapture?.(e.pointerId);
      const updateMaskCoords = (clientX: number, clientY: number) => {
        const r = stage.getBoundingClientRect();
        const nx = Math.max(10, Math.min(90, ((clientX - r.left) / r.width) * 100));
        const ny = Math.max(10, Math.min(90, ((clientY - r.top) / r.height) * 100));
        const sx = Math.abs(nx - 50) < 2.2 ? 50 : Number(nx.toFixed(1));
        const sy = Math.abs(ny - 50) < 2.2 ? 50 : Number(ny.toFixed(1));
        updateCurrentMask((m) => ({ ...m, xPercent: sx, yPercent: sy }));
      };
      const handleMove = (ev: PointerEvent) => updateMaskCoords(ev.clientX, ev.clientY);
      const handleUp = () => {
        setDraggingTarget(null);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
      return;
    }

    // 1.5 Check Crop drag-to-pan when Crop tool active
    if (activeTool === 'crop') {
      setDraggingTarget('crop');
      stage.setPointerCapture?.(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const origPanX = cropConfig.panXPercent;
      const origPanY = cropConfig.panYPercent;
      const handleMove = (ev: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        const dxPct = ((ev.clientX - startX) / r.width) * 100;
        const dyPct = ((ev.clientY - startY) / r.height) * 100;
        setCropConfig((c) => ({
          ...c,
          panXPercent: Math.max(-40, Math.min(40, Math.round(origPanX + dxPct))),
          panYPercent: Math.max(-40, Math.min(40, Math.round(origPanY + dyPct))),
        }));
      };
      const handleUp = () => {
        setDraggingTarget(null);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
      return;
    }

    // 2. Check Stickers
    let hitStickerId: string | null = null;
    let bestStickerDist = 18;
    for (const stk of stickers) {
      const dist = Math.hypot(clickX - stk.xPercent, clickY - stk.yPercent);
      if (dist < bestStickerDist) {
        bestStickerDist = dist;
        hitStickerId = stk.id;
      }
    }

    // 3. Check Text Layers
    let hitTextIdx: number | null = null;
    for (let i = 0; i < allTextLayers.length; i++) {
      const tl = allTextLayers[i];
      if (tl.text.trim() && Math.hypot(clickX - tl.xPercent, clickY - tl.yPercent) < 24) {
        hitTextIdx = i;
        break;
      }
    }

    // 4. Check Overlay (PIP) layers
    let hitOverlayId: string | null = null;
    let bestOverlayDist = 28;
    for (const ov of overlays) {
      const dist = Math.hypot(clickX - ov.xPercent, clickY - ov.yPercent);
      if (dist < bestOverlayDist * Math.max(0.8, ov.scale)) {
        bestOverlayDist = dist;
        hitOverlayId = ov.id;
      }
    }

    let target: string | null = null;
    if (hitStickerId) {
      target = hitStickerId;
      setActiveStickerId(hitStickerId);
      setActiveTool('stickers');
    } else if (hitTextIdx !== null) {
      target = `txtidx-${hitTextIdx}`;
      setSelectedTextIndex(hitTextIdx);
      setActiveTool('text');
    } else if (hitOverlayId) {
      target = hitOverlayId;
      setActiveOverlayId(hitOverlayId);
      setActiveTool('overlay');
    } else if (activeTextLayer.text.trim() && activeTool === 'text') {
      target = `txtidx-${selectedTextIndex}`;
    } else if (activeOverlay && activeTool === 'overlay') {
      target = activeOverlay.id;
    }

    if (!target) return;
    setDraggingTarget(target);
    stage.setPointerCapture?.(e.pointerId);

    const updateCoords = (clientX: number, clientY: number) => {
      if (pinchGestureRef.current) return; // Ignore single drag while 2-finger pinch-to-resize is active
      const r = stage.getBoundingClientRect();
      const nx = Math.max(8, Math.min(92, ((clientX - r.left) / r.width) * 100));
      const ny = Math.max(8, Math.min(92, ((clientY - r.top) / r.height) * 100));
      const snappedX = Math.abs(nx - 50) < 2 ? 50 : Number(nx.toFixed(1));
      const snappedY = Number(ny.toFixed(1));

      if (target.startsWith('txtidx-')) {
        const idx = Number(target.replace('txtidx-', ''));
        if (idx === 0) {
          setTextLayer((prev) => ({ ...prev, xPercent: snappedX, yPercent: snappedY }));
        } else {
          setExtraTextLayers((prev) =>
            prev.map((layer, li) =>
              li === idx - 1 ? { ...layer, xPercent: snappedX, yPercent: snappedY } : layer
            )
          );
        }
      } else if (target.startsWith('ov-')) {
        setOverlays((prev) =>
          prev.map((o) =>
            o.id === target ? { ...o, xPercent: snappedX, yPercent: snappedY } : o
          )
        );
      } else {
        setStickers((prev) =>
          prev.map((s) =>
            s.id === target ? { ...s, xPercent: snappedX, yPercent: snappedY } : s
          )
        );
      }
    };

    const handleMove = (ev: PointerEvent) => {
      updateCoords(ev.clientX, ev.clientY);
    };
    const handleUp = () => {
      setDraggingTarget(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // Multi-Touch Pinch-to-Resize & Rotate for Text, Overlay (PIP) Layers, and Shape Masks
  const handleStageTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const angle = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;

    if (activeTool === 'mask' && currentMaskConfig.shape !== 'none') {
      pinchGestureRef.current = {
        overlayId: '__mask__',
        startDist: Math.max(10, dist),
        startScale: currentMaskConfig.sizePercent,
        startAngleDeg: angle,
        startRotDeg: currentMaskConfig.rotationDeg,
      };
      return;
    }

    if (activeTool === 'text' && activeTextLayer.text.trim()) {
      pinchGestureRef.current = {
        overlayId: '__text__',
        startDist: Math.max(10, dist),
        startScale: activeTextLayer.size,
        startAngleDeg: angle,
        startRotDeg: activeTextLayer.rotationDeg || 0,
      };
      return;
    }

    if (activeOverlay) {
      pinchGestureRef.current = {
        overlayId: activeOverlay.id,
        startDist: Math.max(10, dist),
        startScale: activeOverlay.scale,
        startAngleDeg: angle,
        startRotDeg: activeOverlay.rotationDeg,
      };
    }
  };

  const handleStageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchGestureRef.current) return;
    const g = pinchGestureRef.current;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const angle = (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;
    const ratio = dist / g.startDist;
    const deltaAngle = angle - g.startAngleDeg;

    if (g.overlayId === '__mask__') {
      const nextSize = Math.max(15, Math.min(140, Math.round(g.startScale * ratio)));
      const nextRot = Math.max(-180, Math.min(180, Math.round(g.startRotDeg + deltaAngle)));
      updateCurrentMask((m) => ({ ...m, sizePercent: nextSize, rotationDeg: nextRot }));
    } else if (g.overlayId === '__text__') {
      const nextFontSize = Math.max(16, Math.min(64, Math.round(g.startScale * ratio)));
      const nextRot = Math.max(-180, Math.min(180, Math.round(g.startRotDeg + deltaAngle)));
      updateActiveTextLayer((t) => ({ ...t, size: nextFontSize, rotationDeg: nextRot }));
    } else {
      const nextScale = Math.max(0.25, Math.min(2.2, Number((g.startScale * ratio).toFixed(2))));
      const nextRot = Math.max(-180, Math.min(180, Math.round(g.startRotDeg + deltaAngle)));
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === g.overlayId ? { ...o, scale: nextScale, rotationDeg: nextRot } : o
        )
      );
    }
  };

  const handleStageTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchGestureRef.current = null;
    }
  };

  const openMusicDrawer = (tab: MusicDrawerTab = 'online') => {
    setIsPlaying(false);
    if (previewAudioRef.current) previewAudioRef.current.pause();
    soundEngine.stopPreviewTrack();
    setPreviewingAudioId(null);
    setMusicDrawerTab(tab);
    setIsMusicDrawerOpen(true);
  };

  const handlePickAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateSafeAudioFile(file);
    if (!check.valid) {
      onShowToast?.(check.reason || 'Only .mp3, .m4a, .wav, and .ogg audio allowed.');
      return;
    }
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    const url = URL.createObjectURL(file);
    soundEngine.stopPreviewTrack();
    setSelectedLibraryTrack(null);
    setSelectedOnlineSong(null);
    setSelectedAudioFile(file);
    setSelectedAudioPreviewUrl(url);
    setAudioStartOffset(0);
    setPreviewingAudioId('custom-audio');
    setActiveTool('music');
  };

  const handleAttachDeviceAudioFromDrawer = (
    file: File,
    objectUrl: string,
    durationSec?: number
  ) => {
    if (
      selectedAudioPreviewUrl &&
      selectedAudioPreviewUrl.startsWith('blob:') &&
      selectedAudioPreviewUrl !== objectUrl
    ) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    soundEngine.stopPreviewTrack();
    setSelectedLibraryTrack(null);
    setSelectedOnlineSong(null);
    setSelectedAudioFile(file);
    setSelectedAudioPreviewUrl(objectUrl);
    setCustomAudioDuration(durationSec && durationSec > 2 ? durationSec : 120);
    setAudioStartOffset(0);
    setPreviewingAudioId('custom-audio');
    setActiveTool('music');
    setIsPlaying(true);
  };

  const handleAttachLibraryTrackFromDrawer = (track: AudioTrackOption) => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    setSelectedAudioFile(null);
    setSelectedOnlineSong(null);
    setSelectedAudioPreviewUrl(null);
    setSelectedLibraryTrack(track);
    setAudioStartOffset(0);
    setCustomAudioDuration(120);
    setActiveTool('music');
    soundEngine.playPreviewTrack(track.trackType, bgAudioVolume / 100);
    setPreviewingAudioId(track.id);
    setIsPlaying(true);
  };

  const handleAttachOnlineSong = (song: AttachedOnlineSong) => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    soundEngine.stopPreviewTrack();
    setSelectedAudioFile(null);
    setSelectedLibraryTrack(null);
    setSelectedOnlineSong(song);
    setSelectedAudioPreviewUrl(song.streamUrl || null);
    setCustomAudioDuration(song.durationSeconds && song.durationSeconds > 2 ? song.durationSeconds : 180);
    setAudioStartOffset(0);
    setPreviewingAudioId(song.id);
    setActiveTool('music');
    setIsPlaying(true);
  };

  const handleRemoveAudioTrack = () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    soundEngine.stopPreviewTrack();
    setSelectedLibraryTrack(null);
    setSelectedOnlineSong(null);
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl(null);
    setPreviewingAudioId(null);
    setAudioStartOffset(0);
    setAudioFadeIn(0);
    setAudioFadeOut(0);
    onShowToast?.('Removed attached music track');
  };

  // High-Def 1080p / 4K Photo Export (for static single-image timelines)
  const renderProPhotoExport = async (): Promise<File> => {
    const primary = clips[0];
    if (!primary) throw new Error('No media to export');
    if (!hasAnyEdits) return primary.file;

    const { width: outW, height: outH } = getStageDimensions(cropConfig.aspect, exportResolution);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return primary.file;

    const hasText = allTextLayers.some((t) => t.text.trim().length > 0);
    drawProTimelineFrame(
      ctx,
      outW,
      outH,
      hasText ? 0.6 : 0,
      spans,
      mediaElementCacheRef.current,
      renderOptions
    );
    if (enhanceConfig.enabled) {
      applyEnhanceSharpen(ctx, outW, outH, enhanceConfig.sharpness / 100);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.96)
    );
    if (!blob) return primary.file;
    return new File([blob], `jatt-pro-${exportResolution}-${Date.now()}.png`, {
      type: 'image/png',
    });
  };

  // High-Def 1080p / 4K 60fps Video Export
  const renderProTimelineVideo = async (): Promise<{
    file: File;
    posterDataUrl: string;
    isVideo: boolean;
  }> => {
    if (clips.length === 0) throw new Error('Add at least 1 clip before exporting.');

    const hasAnimatedText = allTextLayers.some(
      (t) =>
        t.text.trim().length > 0 &&
        ((t.animation !== 'none' && t.animation !== 'pop') ||
          Boolean(
            t.animConfig &&
              (t.animConfig.inAnim !== 'none' ||
                t.animConfig.outAnim !== 'none' ||
                t.animConfig.comboAnim !== 'none')
          ))
    );
    const hasMotionFeatures =
      hasAnimatedText ||
      captions.length > 0 ||
      ticker.enabled ||
      visualEffect.type !== 'none' ||
      keyframes.length > 0 ||
      clipAnimation.inAnim !== 'none' ||
      clipAnimation.outAnim !== 'none' ||
      clipAnimation.comboAnim !== 'none';

    const isStaticSinglePhoto =
      clips.length === 1 &&
      clips[0].mediaType === 'image' &&
      !hasMotionFeatures &&
      !hasAttachedMusic;

    if (isStaticSinglePhoto) {
      const photoFile = await renderProPhotoExport();
      const photoUrl = URL.createObjectURL(photoFile);
      return { file: photoFile, posterDataUrl: photoUrl, isVideo: false };
    }

    if (
      clips.length === 1 &&
      clips[0].mediaType === 'video' &&
      !hasAnyEdits &&
      !hasAttachedMusic
    ) {
      return { file: clips[0].file, posterDataUrl: '', isVideo: true };
    }

    if (typeof MediaRecorder === 'undefined') {
      const fallbackPhoto = await renderProPhotoExport();
      return { file: fallbackPhoto, posterDataUrl: '', isVideo: false };
    }

    const attemptRender = async (res: ExportResolution): Promise<{ file: File; posterDataUrl: string }> => {
      const { width: outW, height: outH } = getStageDimensions(cropConfig.aspect, res);
      const bps = res === '4k' ? 22_000_000 : 12_000_000;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');

      setExportStatusText(
        `Rendering ${res.toUpperCase()} (${outW}×${outH}) at 60fps...`
      );

      // Draw initial poster frame
      drawProTimelineFrame(
        ctx,
        outW,
        outH,
        0,
        spans,
        mediaElementCacheRef.current,
        renderOptions
      );
      if (enhanceConfig.enabled) {
        applyEnhanceSharpen(ctx, outW, outH, enhanceConfig.sharpness / 100);
      }
      let posterDataUrl = '';
      try {
        posterDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      } catch {
        posterDataUrl = '';
      }

      const canvasStream =
        typeof canvas.captureStream === 'function'
          ? canvas.captureStream(60)
          : null;
      if (!canvasStream) throw new Error('captureStream unsupported');

      // Best-effort attach background song (device MP3 / online stream) or synth stream with start offset & Fade-In / Fade-Out + 200% boost
      const renderDur = Math.max(0.5, totalDuration);
      let audioCtx: AudioContext | null = null;
      let exportAudioEl: HTMLAudioElement | null = null;
      let synthHandle: { stream: MediaStream; stop: () => void } | null = null;

      if (selectedAudioPreviewUrl && bgAudioVolume > 1) {
        let attachedElementAudio = false;
        try {
          const ACtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          audioCtx = new ACtx();
          exportAudioEl = new Audio(selectedAudioPreviewUrl);
          exportAudioEl.crossOrigin = 'anonymous';
          exportAudioEl.loop = true;
          if (audioStartOffset > 0) {
            const targetStart = audioStartOffset;
            exportAudioEl.addEventListener(
              'loadedmetadata',
              () => {
                if (!exportAudioEl) return;
                try {
                  const d =
                    Number.isFinite(exportAudioEl.duration) && exportAudioEl.duration > 1
                      ? exportAudioEl.duration
                      : 0;
                  exportAudioEl.currentTime = d > 0 ? targetStart % d : targetStart;
                } catch {
                  // ignore
                }
              },
              { once: true }
            );
          }

          const srcNode = audioCtx.createMediaElementSource(exportAudioEl);
          const gainNode = audioCtx.createGain();
          const targetVol = Math.max(0.001, Math.min(2, bgAudioVolume / 100));
          const now = audioCtx.currentTime;

          if (audioFadeIn > 0.05) {
            gainNode.gain.setValueAtTime(0.001, now);
            gainNode.gain.linearRampToValueAtTime(targetVol, now + audioFadeIn);
          } else {
            gainNode.gain.setValueAtTime(targetVol, now);
          }
          if (audioFadeOut > 0.05 && renderDur > audioFadeOut + 0.1) {
            const fadeOutStart = now + Math.max(audioFadeIn, renderDur - audioFadeOut);
            gainNode.gain.setValueAtTime(targetVol, fadeOutStart);
            gainNode.gain.linearRampToValueAtTime(0.001, now + renderDur);
          }

          const dest = audioCtx.createMediaStreamDestination();
          srcNode.connect(gainNode);
          gainNode.connect(dest);

          await exportAudioEl.play();
          dest.stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));
          attachedElementAudio = true;
        } catch {
          if (exportAudioEl) exportAudioEl.pause();
          if (audioCtx) {
            void audioCtx.close().catch(() => {});
            audioCtx = null;
          }
        }

        if (!attachedElementAudio) {
          synthHandle = soundEngine.createExportAudioStream(
            selectedLibraryTrack?.trackType || 'punjabi_dhol',
            Math.min(2, bgAudioVolume / 100),
            {
              fadeInSec: audioFadeIn,
              fadeOutSec: audioFadeOut,
              totalDurationSec: renderDur,
            }
          );
          if (synthHandle) {
            synthHandle.stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));
          }
        }
      } else if ((selectedLibraryTrack || selectedOnlineSong) && bgAudioVolume > 1) {
        synthHandle = soundEngine.createExportAudioStream(
          selectedLibraryTrack?.trackType || 'punjabi_dhol',
          Math.min(2, bgAudioVolume / 100),
          {
            fadeInSec: audioFadeIn,
            fadeOutSec: audioFadeOut,
            totalDurationSec: renderDur,
          }
        );
        if (synthHandle) {
          synthHandle.stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));
        }
      }

      const mimeType = pickSupportedRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: bps })
        : new MediaRecorder(canvasStream, { videoBitsPerSecond: bps });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stoppedPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(
            new Blob(chunks, { type: (mimeType || 'video/webm').split(';')[0] })
          );
        };
      });

      const renderDuration = Math.max(0.5, totalDuration);
      exportCancelRef.current = false;
      recorder.start(150);

      // Pause interactive preview videos cleanly and step timeline deterministically
      mediaElementCacheRef.current.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
          el.pause();
          el.muted = true;
        }
      });

      const startWall = performance.now();
      await new Promise<void>((resolve) => {
        const frameTick = () => {
          if (exportCancelRef.current) {
            resolve();
            return;
          }
          const elapsed = (performance.now() - startWall) / 1000;
          const pct = Math.min(99, Math.round((elapsed / renderDuration) * 100));
          setExportProgress(pct);

          const activeSpan =
            spans.find((s) => elapsed >= s.timelineStart && elapsed <= s.timelineEnd) ||
            spans[spans.length - 1];
          if (activeSpan && activeSpan.clip.mediaType === 'video') {
            const vid = mediaElementCacheRef.current.get(activeSpan.clip.sourceId);
            if (vid instanceof HTMLVideoElement) {
              const localElapsed = Math.max(0, elapsed - activeSpan.timelineStart);
              const prog = Math.max(
                0,
                Math.min(1, localElapsed / activeSpan.effectiveDuration)
              );
              const desiredT = mapClipProgressToSourceTime(activeSpan.clip, prog);
              try {
                vid.playbackRate = evaluateSpeedMultiplierAtProgress(
                  activeSpan.clip.speed,
                  activeSpan.clip.speedCurve,
                  prog
                );
              } catch {
                // ignore
              }
              if (Math.abs(vid.currentTime - desiredT) > 0.25) {
                try {
                  vid.currentTime = desiredT;
                } catch {
                  // ignore
                }
              }
              if (vid.paused) {
                void vid.play().catch(() => {});
              }
            }
          }

          // Sync any video PIP overlays during deterministic export
          for (const ov of overlays) {
            if (ov.mediaType === 'video' && elapsed >= ov.startTime && elapsed <= ov.endTime) {
              const ovEl = mediaElementCacheRef.current.get(ov.sourceId);
              if (ovEl instanceof HTMLVideoElement) {
                const ovDur = Number.isFinite(ovEl.duration) && ovEl.duration > 0.2 ? ovEl.duration : 6;
                const ovT = Math.max(0, elapsed - ov.startTime) % ovDur;
                if (Math.abs(ovEl.currentTime - ovT) > 0.3) {
                  try {
                    ovEl.currentTime = ovT;
                  } catch {
                    // ignore
                  }
                }
                if (ovEl.paused) {
                  void ovEl.play().catch(() => {});
                }
              }
            }
          }

          drawProTimelineFrame(
            ctx,
            outW,
            outH,
            Math.min(elapsed, renderDuration),
            spans,
            mediaElementCacheRef.current,
            renderOptions
          );
          if (enhanceConfig.enabled) {
            applyEnhanceSharpen(ctx, outW, outH, enhanceConfig.sharpness / 100);
          }

          if (elapsed >= renderDuration) {
            resolve();
          } else {
            window.setTimeout(frameTick, 16); // ~60fps cadence
          }
        };
        frameTick();
      });

      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      mediaElementCacheRef.current.forEach((el) => {
        if (el instanceof HTMLVideoElement) el.pause();
      });
      if (exportAudioEl) exportAudioEl.pause();
      if (audioCtx) void audioCtx.close().catch(() => {});
      if (synthHandle) synthHandle.stop();
      canvasStream.getTracks().forEach((tr) => tr.stop());

      const blob = await stoppedPromise;
      if (blob.size < 1024) {
        throw new Error('Rendered video buffer was empty');
      }
      const ext = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      return {
        file: new File([blob], `jatt-pro-${res}-${Date.now()}.${ext}`, {
          type: blob.type || 'video/webm',
        }),
        posterDataUrl,
      };
    };

    try {
      const result = await attemptRender(exportResolution);
      return { ...result, isVideo: true };
    } catch (err) {
      if (exportResolution === '4k') {
        onShowToast?.('Device encoder busy at 4K — cleanly falling back to 1080p HD...');
        const fallback = await attemptRender('1080p');
        return { ...fallback, isVideo: true };
      }
      throw err;
    }
  };

  const handleSaveToDevice = async () => {
    if (clips.length === 0 || isExporting) {
      onShowToast?.('Add at least 1 photo or video clip first.');
      return;
    }
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText(`Preparing ${exportResolution.toUpperCase()} export...`);
    try {
      const { file, isVideo } = await renderProTimelineVideo();
      if (exportCancelRef.current) {
        onShowToast?.('Export cancelled');
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onShowToast?.(
        `Saved ${isVideo ? 'video' : 'photo'} (${exportResolution.toUpperCase()}) directly to your device gallery!`
      );
    } catch (err) {
      console.error('Export failed:', err);
      onShowToast?.('Could not save media on this device.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  };

  const handlePostToFeed = async () => {
    if (clips.length === 0 || isExporting) {
      onShowToast?.('Add at least 1 photo or video clip first.');
      return;
    }

    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast?.(
        `Anti-spam limit: Max 5 uploads per minute. Wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }

    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText(`Rendering ${exportResolution.toUpperCase()} Reel...`);

    try {
      const { file: exportedFile, posterDataUrl, isVideo } = await renderProTimelineVideo();
      if (exportCancelRef.current) {
        onShowToast?.('Publish cancelled');
        return;
      }

      recordRateLimitEvent('upload');
      const finalMediaType: 'video' | 'image' = isVideo ? 'video' : 'image';
      const instantMediaUrl = URL.createObjectURL(exportedFile);
      const cleanTitle =
        sanitizeText(postTitle, 120) ||
        `Edited ${finalMediaType === 'image' ? 'Photo' : 'Reel'} (${exportResolution.toUpperCase()})`;

      const tags = hashtagsStr
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)
        .map((t) => sanitizeText(t, 40))
        .filter(Boolean);

      const hashtagsLine = tags.length ? tags.map((t) => `#${t}`).join(' ') : '#jattvibereels';
      const captionText = `${cleanTitle} ${hashtagsLine}`.trim();

      const authorName =
        sanitizeText(currentUser?.name || creatorProfile?.name || 'Jatt Creator', 60) ||
        'Jatt Creator';
      const authorUsername =
        sanitizeUsername(currentUser?.username || creatorProfile?.username || 'jatt_creator') ||
        'jatt_creator';
      const authorAvatar =
        currentUser?.avatar ||
        creatorProfile?.avatar ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';
      const userId = creatorProfile?.id || getOrCreateUserProfileId();

      const instantAudioUrl = selectedAudioPreviewUrl || undefined;
      const hasPostAudio = Boolean(
        selectedAudioFile || selectedLibraryTrack || selectedOnlineSong
      );

      const instantSound: VideoPost['sound'] = selectedAudioFile
        ? {
            title: sanitizeText(selectedAudioFile.name.replace(/\.[^/.]+$/, ''), 80),
            artist: authorName,
            trackType: 'ambient_lofi',
            audioUrl: instantAudioUrl,
            category: 'song',
            originalVolume: hasVideoInTimeline ? originalVolume / 100 : 0,
            bgAudioVolume: bgAudioVolume / 100,
            hasAttachedAudio: true,
          }
        : selectedOnlineSong
        ? {
            title: selectedOnlineSong.title,
            artist: selectedOnlineSong.artist,
            trackType: 'punjabi_dhol',
            audioUrl: selectedOnlineSong.streamUrl || undefined,
            category: 'song',
            originalVolume: hasVideoInTimeline ? originalVolume / 100 : 0,
            bgAudioVolume: bgAudioVolume / 100,
            hasAttachedAudio: true,
          }
        : selectedLibraryTrack
        ? {
            title: selectedLibraryTrack.title,
            artist: selectedLibraryTrack.artist,
            trackType: selectedLibraryTrack.trackType,
            category: selectedLibraryTrack.category,
            originalVolume: hasVideoInTimeline ? originalVolume / 100 : 0,
            bgAudioVolume: bgAudioVolume / 100,
            hasAttachedAudio: true,
          }
        : {
            title: `Original Sound - ${authorName}`,
            artist: authorName,
            trackType: 'tokyo_drift',
            category: finalMediaType === 'image' ? 'beat' : 'original',
            originalVolume: hasVideoInTimeline ? originalVolume / 100 : 0,
            bgAudioVolume: finalMediaType === 'image' ? bgAudioVolume / 100 : 0,
            hasAttachedAudio: finalMediaType === 'image',
          };

      const tempPostId = `user-edit-${Date.now()}`;
      const optimisticPost: VideoPost = {
        id: tempPostId,
        title: cleanTitle,
        description: captionText,
        hashtags: tags.length ? tags : ['jattvibereels', 'capcutpro', 'trending'],
        videoUrl: instantMediaUrl,
        posterUrl:
          posterDataUrl || (finalMediaType === 'image' ? instantMediaUrl : undefined),
        fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
        category: 'trending',
        userId,
        mediaType: finalMediaType,
        allowDownload,
        isUserUploaded: true,
        createdAt: new Date().toISOString(),
        creator: {
          name: authorName,
          username: authorUsername,
          avatar: authorAvatar,
          isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
          isFollowing: false,
          bio: currentUser?.bio || creatorProfile?.bio || 'Creator on Jatt VibeReels',
        },
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
        sound: instantSound,
        commentsList: [],
      };

      savePostPrivacyMeta([tempPostId, instantMediaUrl], allowDownload);
      savePostAudioMeta([tempPostId, instantMediaUrl], instantSound);
      saveLocalPostRecord(optimisticPost);
      onUploadSuccess(optimisticPost);
      setIsExporting(false);
      onClose();

      const pickedAudio = selectedAudioFile;
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      void (async () => {
        try {
          let finalMediaUrl = instantMediaUrl;
          const fileToUpload =
            finalMediaType === 'image'
              ? await compressImageFile(exportedFile, 1440, 0.9)
              : exportedFile;

          if (isOnline) {
            const uploadedUrl = await uploadMediaToReelsBucket(
              fileToUpload,
              'posts',
              fileToUpload.name
            );
            if (uploadedUrl) {
              finalMediaUrl = uploadedUrl;
            } else {
              const dataUrl = await fileToPersistentDataUrl(fileToUpload);
              if (dataUrl) finalMediaUrl = dataUrl;
            }
          }

          let finalAudioUrl: string | undefined = instantAudioUrl;
          if (pickedAudio && isOnline) {
            const uploadedAudioUrl = await uploadMediaToReelsBucket(
              pickedAudio,
              'audio',
              pickedAudio.name
            );
            if (uploadedAudioUrl) {
              finalAudioUrl = uploadedAudioUrl;
            } else {
              const audioDataUrl = await fileToPersistentDataUrl(pickedAudio, 3_500_000);
              if (audioDataUrl) finalAudioUrl = audioDataUrl;
            }
          }

          const syncedSound: VideoPost['sound'] = pickedAudio
            ? { ...instantSound, audioUrl: finalAudioUrl }
            : instantSound;

          const supabasePost = isOnline
            ? await createGlobalPostInSupabase({
                userId,
                username: authorUsername,
                displayName: authorName,
                avatarUrl: authorAvatar,
                mediaUrl: finalMediaUrl,
                mediaType: finalMediaType,
                caption: captionText,
                allowDownload,
                sound: syncedSound,
              })
            : null;

          const finalSyncedPost: VideoPost = supabasePost
            ? {
                ...supabasePost,
                posterUrl: posterDataUrl || supabasePost.posterUrl,
                allowDownload,
                sound: syncedSound,
              }
            : {
                ...optimisticPost,
                videoUrl: finalMediaUrl,
                posterUrl:
                  posterDataUrl ||
                  (finalMediaType === 'image' ? finalMediaUrl : undefined),
                sound: syncedSound,
              };

          savePostPrivacyMeta([finalSyncedPost.id, finalMediaUrl, tempPostId], allowDownload);
          savePostAudioMeta([finalSyncedPost.id, finalMediaUrl], syncedSound);
          saveLocalPostRecord(finalSyncedPost);

          await savePostForOffline(finalSyncedPost, {
            mediaBlob: fileToUpload,
            audioBlob: pickedAudio || undefined,
            sourceType: 'uploaded',
            skipRemoteFetch: true,
          });

          onUploadCloudSynced?.(tempPostId, finalSyncedPost);
        } catch (err) {
          console.warn('Background editor post sync warning:', err);
        }
      })();

      onShowToast?.(
        hasPostAudio
          ? `Published ${exportResolution.toUpperCase()} edit with music to Jatt VibeReels!`
          : `Published ${exportResolution.toUpperCase()} edit to Jatt VibeReels!`
      );
    } catch (err) {
      console.error('Post failed:', err);
      onShowToast?.('Failed to publish edited media.');
      setIsExporting(false);
      setExportProgress(0);
      setExportStatusText('');
    }
  };

  const activeSticker = stickers.find((s) => s.id === activeStickerId) || null;
  const currentAudioLabel = selectedAudioFile
    ? selectedAudioFile.name
    : selectedOnlineSong
    ? `${selectedOnlineSong.title} · ${selectedOnlineSong.artist}`
    : selectedLibraryTrack
    ? `${selectedLibraryTrack.title} · ${selectedLibraryTrack.artist}`
    : hasVideoInTimeline
    ? `No music attached (${originalVolume}% orig) · Tap to add track`
    : 'No music attached · Tap to add track';

  const maxAudioTrimStart = Math.max(
    15,
    Math.floor((selectedOnlineSong?.durationSeconds || customAudioDuration || 120) - 2)
  );

  return (
    <div
      className="fixed inset-0 z-55 bg-[#050508] text-white flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={previewAudioRef}
        src={selectedAudioPreviewUrl || undefined}
        crossOrigin="anonymous"
        loop
        onEnded={() => setPreviewingAudioId(null)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          e.target.value = '';
          if (picked.length > 0) void addMediaFiles(picked);
        }}
      />
      <input
        ref={overlayFileInputRef}
        type="file"
        multiple
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          e.target.value = '';
          if (picked.length > 0) void addOverlayFiles(picked);
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        className="hidden"
        onChange={handlePickAudioFile}
      />

      {/* Sleek Dark Pro Studio Top Bar */}
      <header className="shrink-0 h-14 px-3 sm:px-5 border-b border-neutral-800/90 bg-[#0b0b10] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close studio"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black tracking-tight truncate">
                Jatt Pro Studio
              </h2>
            </div>
            <p className="text-[10px] text-neutral-400 truncate hidden sm:block">
              60fps Canvas · Multi-Track Timeline · LUTs &amp; Keyframe Speed
            </p>
          </div>
        </div>

        {/* Right Header Controls: Resolution Switcher (1080p / 4K), Reset, Next / Save to Gallery, Post Now */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {clips.length > 0 && (
            <>
              <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-0.5">
                {(['1080p', '4k'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setExportResolution(res)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-colors ${
                      exportResolution === res
                        ? 'bg-cyan-500 text-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={resetAllEdits}
                className="min-w-[38px] min-h-[38px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
                title="Reset edits"
                aria-label="Reset edits"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleSaveToDevice}
                className="hidden md:flex min-h-[38px] px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-cyan-500/50 text-cyan-300 text-xs font-black items-center gap-1.5 cursor-pointer transition-colors"
                title="Save photo or video directly to your device gallery"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Next / Save to Gallery</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handlePostToFeed}
                className="hidden md:flex min-h-[38px] px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black items-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Now</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Clear Action Bar: Next / Save to Gallery & Post Now (editing optional) */}
      {clips.length > 0 && (
        <div className="md:hidden shrink-0 px-3 py-2 bg-[#0b0b10] border-b border-neutral-800/80 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleSaveToDevice}
            className="min-h-[38px] px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-cyan-500/50 text-cyan-300 text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Next / Save to Gallery</span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handlePostToFeed}
            className="min-h-[38px] px-3 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>Post Now</span>
          </button>
        </div>
      )}

      {/* Export Rendering Overlay Banner */}
      {isExporting && (
        <div className="shrink-0 px-4 py-2 bg-[#12121a] border-b border-pink-500/35 flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-pink-300">{exportStatusText || 'Rendering...'}</span>
              <span className="tabular-nums text-white">{exportProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                style={{ width: `${Math.max(4, exportProgress)}%` }}
                className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-cyan-400 transition-all duration-100"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              exportCancelRef.current = true;
            }}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-[11px] font-bold text-neutral-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Studio Body */}
      {clips.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {editorError && (
            <div className="w-full max-w-md mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-semibold">
              {editorError}
            </div>
          )}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = Array.from(e.dataTransfer.files || []);
              if (dropped.length > 0) void addMediaFiles(dropped);
            }}
            className="w-full max-w-lg border-2 border-dashed border-neutral-700 hover:border-pink-500 rounded-3xl p-8 sm:p-12 bg-[#0d0d14] hover:bg-pink-950/10 transition-all cursor-pointer space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600/25 to-cyan-500/25 border border-pink-500/40 mx-auto flex items-center justify-center gap-1.5">
              <VideoIcon className="w-6 h-6 text-pink-400" />
              <ImageIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white">Open Media in Pro Studio</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Select one or more videos (.mp4, .webm) and photos (.jpg, .png, .webp) to trim,
                split at playhead, apply LUTs, speed curves, animated text, and 1080p/4K export.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-black shadow-lg">
              <Upload className="w-4 h-4" />
              <span>Select Videos or Photos</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Upper Workspace: 60fps Canvas Preview + Side/Bottom Tool Inspector */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Live 60fps 9:16 Video Canvas Stage */}
            <div className="relative bg-[#040407] flex-1 min-h-[230px] lg:min-h-0 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
              <div
                ref={canvasStageRef}
                onPointerDown={handleStagePointerDown}
                onTouchStart={handleStageTouchStart}
                onTouchMove={handleStageTouchMove}
                onTouchEnd={handleStageTouchEnd}
                className={`relative max-h-full rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl touch-none select-none gpu-accelerated ${
                  cropConfig.aspect === '16:9'
                    ? 'aspect-video w-full max-w-full'
                    : cropConfig.aspect === '1:1'
                    ? 'aspect-square h-full'
                    : 'aspect-[9/16] h-full'
                }`}
              >
                <canvas
                  ref={previewCanvasRef}
                  width={stagePreviewDims.width}
                  height={stagePreviewDims.height}
                  className="w-full h-full object-contain block"
                />

                {/* Interactive Visual Drag Guides for Text, Stickers, Overlays & Masks */}
                {activeTool === 'overlay' &&
                  overlays.map((ov) => {
                    const isAct = ov.id === (activeOverlay?.id || null);
                    return (
                      <div
                        key={`ov-guide-${ov.id}`}
                        style={{
                          left: `${ov.xPercent}%`,
                          top: `${ov.yPercent}%`,
                          transform: `translate(-50%, -50%) rotate(${ov.rotationDeg}deg)`,
                          width: `${Math.min(84, Math.max(18, Math.round(46 * ov.scale)))}%`,
                          height: `${Math.min(58, Math.max(14, Math.round(28 * ov.scale)))}%`,
                        }}
                        className={`absolute rounded-xl border-2 border-dashed pointer-events-none transition-colors ${
                          isAct
                            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                            : 'border-white/30'
                        }`}
                      >
                        {isAct && (
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 rounded bg-cyan-400 text-black text-[8px] font-black uppercase tracking-wider whitespace-nowrap">
                            Drag / Pinch PIP
                          </span>
                        )}
                      </div>
                    );
                  })}

                {activeTool === 'mask' && currentMaskConfig.shape !== 'none' && (
                  <div
                    style={{
                      left: `${
                        effectiveMaskTarget === 'overlay' && activeOverlay
                          ? activeOverlay.xPercent + ((currentMaskConfig.xPercent - 50) * 0.4)
                          : currentMaskConfig.xPercent
                      }%`,
                      top: `${
                        effectiveMaskTarget === 'overlay' && activeOverlay
                          ? activeOverlay.yPercent + ((currentMaskConfig.yPercent - 50) * 0.4)
                          : currentMaskConfig.yPercent
                      }%`,
                      transform: `translate(-50%, -50%) rotate(${currentMaskConfig.rotationDeg}deg)`,
                    }}
                    className="absolute w-24 h-24 rounded-full border-2 border-dashed border-purple-400/85 bg-purple-500/10 pointer-events-none flex items-center justify-center"
                  >
                    <span className="px-1.5 rounded bg-purple-500 text-white text-[8px] font-black uppercase tracking-wider whitespace-nowrap">
                      {currentMaskConfig.shape}
                    </span>
                  </div>
                )}

                {activeTool === 'text' && activeTextLayer.text.trim() && (
                  <div
                    style={{
                      left: `${activeTextLayer.xPercent}%`,
                      top: `${activeTextLayer.yPercent}%`,
                      transform: `translate(-50%, -50%) rotate(${activeTextLayer.rotationDeg || 0}deg)`,
                    }}
                    className="absolute px-3 py-2 min-w-[90px] min-h-[34px] rounded-xl border-2 border-dashed border-cyan-400/85 bg-cyan-500/10 pointer-events-none flex items-center justify-center"
                  >
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded bg-cyan-500 text-black text-[8px] font-black uppercase tracking-wider whitespace-nowrap">
                      Drag / Pinch Text #{selectedTextIndex + 1}
                    </span>
                  </div>
                )}

                {activeTool === 'stickers' &&
                  stickers.map((stk) => {
                    const isActiveStk = stk.id === activeStickerId;
                    return (
                      <div
                        key={`guide-${stk.id}`}
                        style={{ left: `${stk.xPercent}%`, top: `${stk.yPercent}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl border-2 border-dashed pointer-events-none ${
                          isActiveStk
                            ? 'border-pink-400 bg-pink-500/15'
                            : 'border-white/35'
                        }`}
                      />
                    );
                  })}

                {/* Center Snapping Crosshair Guide while dragging */}
                {draggingTarget && (
                  <>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400/55 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/55 pointer-events-none" />
                  </>
                )}

                {/* Subtle Drag Affordance */}
                {(activeTool === 'text' ||
                  activeTool === 'stickers' ||
                  activeTool === 'overlay' ||
                  activeTool === 'mask' ||
                  activeTool === 'crop') && (
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[10px] font-bold text-cyan-300 flex items-center gap-1 pointer-events-none">
                    <Move className="w-3 h-3" />
                    <span>
                      {activeTool === 'overlay'
                        ? 'Drag & pinch PIP'
                        : activeTool === 'mask'
                        ? 'Drag / pinch mask'
                        : activeTool === 'crop'
                        ? 'Drag stage to pan crop'
                        : activeTool === 'text'
                        ? 'Drag / 2-finger pinch & rotate'
                        : 'Drag on canvas'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right / Lower Editing Inspector Panel */}
            <aside className="w-full lg:w-[400px] xl:w-[430px] max-h-[42vh] lg:max-h-none bg-[#0d0d13] border-t lg:border-t-0 lg:border-l border-neutral-800/90 flex flex-col shrink-0 overflow-hidden">
              {/* Compact Active Tool Inspector Header */}
              <div className="shrink-0 px-3.5 py-2 border-b border-neutral-800/90 flex items-center justify-between gap-2 bg-[#111119]">
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-200 truncate">
                    {activeTool === 'trim'
                      ? 'Edit & Split'
                      : activeTool === 'text'
                      ? 'Text Overlays'
                      : activeTool === 'captions'
                      ? 'Auto-Captions & Subtitles'
                      : activeTool === 'ticker'
                      ? 'Scrolling Ticker Bar'
                      : activeTool === 'effects'
                      ? 'Visual Effects & Shaders'
                      : activeTool === 'filters'
                      ? 'Filters, LUTs & Color'
                      : activeTool === 'bg_remove'
                      ? 'BG Remove & Chroma Key'
                      : activeTool === 'music'
                      ? 'Audio Track & Mixer'
                      : activeTool === 'volume'
                      ? 'Volume & Audio Boost'
                      : activeTool === 'speed'
                      ? 'Speed (0.25x – 4x)'
                      : activeTool === 'crop'
                      ? 'Crop & Aspect Ratio'
                      : activeTool === 'animation'
                      ? 'In / Out / Combo Anim'
                      : activeTool === 'keyframe'
                      ? 'Keyframe Animation'
                      : activeTool === 'enhance'
                      ? 'Enhance 4K / Full HD'
                      : activeTool === 'overlay'
                      ? 'Overlay (PIP Layers)'
                      : activeTool === 'mask'
                      ? 'CapCut Shape Masks'
                      : activeTool === 'stickers'
                      ? 'Stickers & Emojis'
                      : activeTool === 'transitions'
                      ? 'Transitions'
                      : 'Publish Settings'}
                  </span>
                </div>
                {hasAttachedMusic && activeTool !== 'music' && (
                  <button
                    type="button"
                    onClick={() => openMusicDrawer('online')}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0 max-w-[165px]"
                  >
                    <Music className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {selectedOnlineSong?.title ||
                        selectedLibraryTrack?.title ||
                        selectedAudioFile?.name ||
                        'Audio'}
                    </span>
                  </button>
                )}
              </div>

              {/* Active Inspector Panel Body */}
              <div
                ref={inspectorBodyRef}
                className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4 no-scrollbar"
              >
                {/* 1. TRIM & SPLIT */}
                {activeTool === 'trim' && selectedClip && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white">Trim &amp; Split Clip</h4>
                        <p className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                          {selectedClip.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSplitAtPlayhead}
                          className="min-h-[38px] px-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Split Here</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDuplicateSelectedClip}
                          className="min-w-[38px] min-h-[38px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 flex items-center justify-center cursor-pointer"
                          title="Duplicate clip"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedClip}
                          className="min-w-[38px] min-h-[38px] rounded-xl bg-neutral-900 hover:bg-rose-900/50 border border-neutral-700 text-rose-400 flex items-center justify-center cursor-pointer"
                          title="Delete selected clip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {selectedClip.mediaType === 'video' ? (
                      <div className="space-y-3 bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">Clip Start (In)</span>
                            <span className="text-pink-400 font-bold tabular-nums">
                              {selectedClip.trimStart.toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={Math.max(0.4, selectedClip.trimEnd - 0.4)}
                            step={0.1}
                            value={selectedClip.trimStart}
                            onChange={(e) => {
                              const nextStart = Number(e.target.value);
                              updateSelectedClip((c) => ({ ...c, trimStart: nextStart }));
                            }}
                            className="w-full accent-pink-500 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">Clip End (Out)</span>
                            <span className="text-cyan-400 font-bold tabular-nums">
                              {selectedClip.trimEnd.toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={Math.min(
                              selectedClip.naturalDuration,
                              selectedClip.trimStart + 0.4
                            )}
                            max={Math.max(0.5, selectedClip.naturalDuration)}
                            step={0.1}
                            value={selectedClip.trimEnd}
                            onChange={(e) => {
                              const nextEnd = Number(e.target.value);
                              updateSelectedClip((c) => ({ ...c, trimEnd: nextEnd }));
                            }}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">Photo Duration</span>
                            <span className="text-cyan-400 font-bold tabular-nums">
                              {(selectedClip.trimEnd - selectedClip.trimStart).toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1.5}
                            max={10}
                            step={0.5}
                            value={selectedClip.trimEnd - selectedClip.trimStart}
                            onChange={(e) => {
                              const dur = Number(e.target.value);
                              updateSelectedClip((c) => ({
                                ...c,
                                trimStart: 0,
                                trimEnd: dur,
                              }));
                            }}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedClip((c) => ({ ...c, photoFit: 'contain' }))}
                            className={`min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                              selectedClip.photoFit === 'contain'
                                ? 'bg-pink-600/20 border-pink-500 text-white'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            Fit Full Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedClip((c) => ({ ...c, photoFit: 'cover' }))}
                            className={`min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                              selectedClip.photoFit === 'cover'
                                ? 'bg-pink-600/20 border-pink-500 text-white'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            9:16 Full Reel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SPEED CURVE */}
                {activeTool === 'speed' && selectedClip && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">Speed &amp; Velocity Curve</h4>
                      <span className="text-xs font-black text-amber-300 tabular-nums">
                        {selectedClip.speed}x
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {SPEED_QUICK_PRESETS.map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => updateSelectedClip((c) => ({ ...c, speed: opt.val }))}
                          className={`min-h-[42px] px-2 rounded-xl border text-[11px] font-black cursor-pointer transition-all ${
                            selectedClip.speed === opt.val
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3.5 space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-300 font-semibold">Fine Speed Control (0.25x–4x)</span>
                        <span className="text-cyan-400 font-bold tabular-nums">
                          {selectedClip.speed.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={selectedClip.speed}
                        onChange={(e) => {
                          const s = Number(e.target.value);
                          updateSelectedClip((c) => ({ ...c, speed: s }));
                        }}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-neutral-400">Speed Curve Profiles</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SPEED_CURVE_PRESETS.map((preset) => {
                          const active = selectedClip.speedCurve === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                updateSelectedClip((c) => ({
                                  ...c,
                                  speedCurve: preset.id as SpeedCurvePresetId,
                                }))
                              }
                              className={`p-2.5 rounded-xl border text-left space-y-2 cursor-pointer transition-all ${
                                active
                                  ? 'bg-pink-600/20 border-pink-400 text-white'
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                              }`}
                            >
                              <span className="text-[11px] font-bold block">{preset.label}</span>
                              {/* Visual Mini Curve Bars */}
                              <div className="flex items-end gap-1 h-5">
                                {preset.points.map((pt, idx) => (
                                  <span
                                    key={idx}
                                    style={{ height: `${Math.min(100, Math.round(pt * 52))}%` }}
                                    className={`flex-1 rounded-xs ${
                                      active ? 'bg-pink-400' : 'bg-neutral-600'
                                    }`}
                                  />
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PRO FILTERS & LUTs */}
                {activeTool === 'filters' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">Pro Filters &amp; LUTs</h4>
                      <span className="text-[11px] font-bold text-cyan-300 tabular-nums">
                        {selectedLut.label} · {lutIntensity}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PRO_FILTER_LUTS.map((lut) => {
                        const active = selectedLut.id === lut.id;
                        return (
                          <button
                            key={lut.id}
                            type="button"
                            onClick={() => setSelectedLut(lut)}
                            className={`p-2 rounded-xl border text-center space-y-1.5 cursor-pointer transition-all ${
                              active
                                ? 'bg-pink-600/20 border-pink-400 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                            }`}
                          >
                            <div
                              className={`w-full h-5 rounded-md bg-gradient-to-r ${lut.swatchGradient}`}
                            />
                            <span className="text-[10px] font-bold block truncate">{lut.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* LUT Intensity Slider */}
                    <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3.5 space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white font-bold">LUT Intensity</span>
                          <span className="text-pink-400 font-bold tabular-nums">{lutIntensity}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={lutIntensity}
                          onChange={(e) => setLutIntensity(Number(e.target.value))}
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-800/80">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-300 font-semibold">Exposure</span>
                            <span className="text-cyan-300 font-bold tabular-nums">
                              {brightnessAdj > 0 ? `+${brightnessAdj}` : brightnessAdj}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            value={brightnessAdj}
                            onChange={(e) => setBrightnessAdj(Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-300 font-semibold">Contrast</span>
                            <span className="text-amber-300 font-bold tabular-nums">
                              {contrastAdj > 0 ? `+${contrastAdj}` : contrastAdj}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-40}
                            max={40}
                            value={contrastAdj}
                            onChange={(e) => setContrastAdj(Number(e.target.value))}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-300 font-semibold">Saturation</span>
                            <span className="text-pink-300 font-bold tabular-nums">
                              {saturateAdj > 0 ? `+${saturateAdj}` : saturateAdj}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-60}
                            max={60}
                            value={saturateAdj}
                            onChange={(e) => setSaturateAdj(Number(e.target.value))}
                            className="w-full accent-pink-500 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-300 font-semibold">Vignette</span>
                            <span className="text-purple-300 font-bold tabular-nums">
                              {vignetteAdj}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={85}
                            value={vignetteAdj}
                            onChange={(e) => setVignetteAdj(Number(e.target.value))}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. MULTI-LAYER DRAGGABLE, RESIZABLE & ROTATABLE TEXT OVERLAYS */}
                {activeTool === 'text' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-black text-white">Text Overlays</h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const nextLayer: EditorTextLayer = {
                              id: `txt-${Date.now()}`,
                              text: 'NEW TEXT ✨',
                              fontId: activeTextLayer.fontId,
                              color: '#ffffff',
                              size: 28,
                              xPercent: 50,
                              yPercent: 28 + ((allTextLayers.length * 14) % 42),
                              rotationDeg: 0,
                              neonGlow: false,
                              outline: true,
                              backdrop: true,
                              animation: 'pop',
                              animConfig: { ...DEFAULT_ANIMATION_CONFIG },
                            };
                            setExtraTextLayers((prev) => [...prev, nextLayer]);
                            setSelectedTextIndex(allTextLayers.length);
                          }}
                          className="px-2 py-1 rounded-lg bg-pink-600/25 border border-pink-500/50 text-pink-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Layer</span>
                        </button>
                        {activeTextLayer.text.trim() && (
                          <button
                            type="button"
                            onClick={handleDuplicateActiveItem}
                            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                            title="Duplicate text layer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        {activeTextLayer.text.trim() && (
                          <button
                            type="button"
                            onClick={handleDeleteActiveItem}
                            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-rose-400 hover:text-rose-300 cursor-pointer"
                            title="Delete text layer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Multi-Text Layer Selector */}
                    {allTextLayers.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {allTextLayers.map((tl, idx) => (
                          <button
                            key={tl.id || `tl-${idx}`}
                            type="button"
                            onClick={() => setSelectedTextIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap cursor-pointer shrink-0 ${
                              selectedTextIndex === idx
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            Text #{idx + 1}: {tl.text.trim().slice(0, 12) || 'Empty'}
                          </button>
                        ))}
                      </div>
                    )}

                    <input
                      ref={textInputRef}
                      type="text"
                      value={activeTextLayer.text}
                      onChange={(e) => {
                        const val = sanitizeInputLive(e.target.value, 80);
                        updateActiveTextLayer((prev) => ({ ...prev, text: val }));
                      }}
                      placeholder="Type headline or caption (drag/pinch on stage)..."
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
                    />

                    {/* Quick Tap Starter Captions */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {QUICK_CAPTION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateActiveTextLayer((prev) => ({ ...prev, text: preset }))}
                          className="px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-neutral-300 hover:text-white whitespace-nowrap cursor-pointer shrink-0"
                        >
                          + {preset}
                        </button>
                      ))}
                      {activeTextLayer.text.trim() && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTextLayer((p) => ({
                              ...p,
                              xPercent: 50,
                              yPercent: 72,
                              rotationDeg: 0,
                            }))
                          }
                          className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-cyan-300 whitespace-nowrap cursor-pointer shrink-0"
                        >
                          Center
                        </button>
                      )}
                    </div>

                    {/* Stylish Fonts */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Typography Font
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {TEXT_FONT_STYLES.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => updateActiveTextLayer((p) => ({ ...p, fontId: f.id }))}
                            className={`px-3 min-h-[36px] rounded-lg border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                              activeTextLayer.fontId === f.id
                                ? 'bg-pink-600/20 border-pink-400 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation Presets */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Text Style Animation
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TEXT_ANIMATION_OPTIONS.map((anim) => (
                          <button
                            key={anim.id}
                            type="button"
                            onClick={() => updateActiveTextLayer((p) => ({ ...p, animation: anim.id }))}
                            className={`min-h-[36px] px-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                              activeTextLayer.animation === anim.id
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                            }`}
                          >
                            {anim.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Colors + Neon Glow / Outline / Backdrop Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        {TEXT_COLOR_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateActiveTextLayer((p) => ({ ...p, color: hex }))}
                            style={{ backgroundColor: hex }}
                            className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                              activeTextLayer.color === hex
                                ? 'border-cyan-400 scale-110'
                                : 'border-neutral-700'
                            }`}
                            aria-label={`Text color ${hex}`}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTextLayer((p) => ({ ...p, neonGlow: !p.neonGlow }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            activeTextLayer.neonGlow
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Neon Glow
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTextLayer((p) => ({ ...p, outline: !p.outline }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            activeTextLayer.outline
                              ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Outline
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTextLayer((p) => ({ ...p, backdrop: !p.backdrop }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            activeTextLayer.backdrop
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Box
                        </button>
                      </div>
                    </div>

                    {/* Size & Rotation sliders */}
                    <div className="grid grid-cols-2 gap-2.5 bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Size</span>
                          <span className="text-pink-400 font-bold tabular-nums">
                            {activeTextLayer.size}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={16}
                          max={64}
                          value={activeTextLayer.size}
                          onChange={(e) =>
                            updateActiveTextLayer((p) => ({ ...p, size: Number(e.target.value) }))
                          }
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Rotate</span>
                          <span className="text-amber-300 font-bold tabular-nums">
                            {activeTextLayer.rotationDeg || 0}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={activeTextLayer.rotationDeg || 0}
                          onChange={(e) =>
                            updateActiveTextLayer((p) => ({
                              ...p,
                              rotationDeg: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. TRANSITIONS */}
                {activeTool === 'transitions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">Clip Transitions</h4>
                      {clips.length > 1 && selectedClip && (
                        <button
                          type="button"
                          onClick={() => {
                            const tr = selectedClip.transitionAfter;
                            const dur = selectedClip.transitionDuration;
                            setClips((prev) =>
                              prev.map((c) => ({
                                ...c,
                                transitionAfter: tr,
                                transitionDuration: dur,
                              }))
                            );
                            onShowToast?.('Applied transition to all clip cuts');
                          }}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Apply to All
                        </button>
                      )}
                    </div>

                    {clips.length < 2 ? (
                      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-4 space-y-3">
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          Transitions blend smoothly between two clips. Split your current clip at
                          the playhead or add another clip to activate transitions.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSplitAtPlayhead}
                            className="min-h-[40px] px-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            <span>Split Clip Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="min-h-[40px] px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-bold cursor-pointer"
                          >
                            + Add 2nd Clip
                          </button>
                        </div>
                      </div>
                    ) : (
                      selectedClip && (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {TRANSITION_PRESETS.map((tr) => {
                              const active = selectedClip.transitionAfter === tr.id;
                              return (
                                <button
                                  key={tr.id}
                                  type="button"
                                  onClick={() =>
                                    updateSelectedClip((c) => ({
                                      ...c,
                                      transitionAfter: tr.id,
                                    }))
                                  }
                                  className={`p-2.5 rounded-xl border text-left space-y-0.5 cursor-pointer transition-all ${
                                    active
                                      ? 'bg-pink-600/20 border-pink-400 text-white'
                                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                                  }`}
                                >
                                  <span className="text-xs font-black block">{tr.label}</span>
                                  <span className="text-[10px] text-neutral-400 block">
                                    {tr.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-neutral-300 font-semibold">
                                Transition Duration
                              </span>
                              <span className="text-cyan-400 font-bold tabular-nums">
                                {selectedClip.transitionDuration.toFixed(2)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.2}
                              max={1.0}
                              step={0.05}
                              value={selectedClip.transitionDuration}
                              onChange={(e) => {
                                const d = Number(e.target.value);
                                updateSelectedClip((c) => ({ ...c, transitionDuration: d }));
                              }}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                        </>
                      )
                    )}
                  </div>
                )}

                {/* 6. STICKERS */}
                {activeTool === 'stickers' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">
                        Emoji &amp; Sticker Picker
                      </h4>
                      <span className="text-[10px] font-semibold text-pink-300">
                        Tap to place · Drag on video
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {STICKER_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddSticker(emoji)}
                          className="h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 hover:border-pink-500/60 border border-neutral-800 text-xl flex items-center justify-center cursor-pointer active:scale-90 transition-all"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {activeSticker && (
                      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Sticker {activeSticker.emoji}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setStickers((prev) =>
                                prev.filter((s) => s.id !== activeSticker.id)
                              );
                              setActiveStickerId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">Sticker Size</span>
                            <span className="text-amber-400 font-bold tabular-nums">
                              {activeSticker.size}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={24}
                            max={96}
                            value={activeSticker.size}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setStickers((prev) =>
                                prev.map((s) =>
                                  s.id === activeSticker.id ? { ...s, size: val } : s
                                )
                              );
                            }}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. AUDIO / MUSIC TIMELINE CONTROLS (CAPCUT STYLE) */}
                {activeTool === 'music' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white">Audio Track &amp; Mixer</h4>
                        <p className="text-[10px] text-neutral-400">
                          Trim audio start point, mix volumes &amp; set fade curves
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openMusicDrawer('online')}
                        className="min-h-[36px] px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>{hasAttachedMusic ? 'Change Song' : 'Sounds Library'}</span>
                      </button>
                    </div>

                    {!hasAttachedMusic ? (
                      <button
                        type="button"
                        onClick={() => openMusicDrawer('online')}
                        className="w-full p-4 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-pink-500 bg-neutral-900/60 hover:bg-pink-950/15 text-left flex items-center justify-between gap-3 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-400 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white">
                              No music attached · Tap to add track
                            </p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              Search songs worldwide, pick trending beats, or upload MP3
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1.5 rounded-lg bg-pink-600 text-white text-[10px] font-black shrink-0">
                          Browse
                        </span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {/* Attached Track Card */}
                        <div className="p-3 rounded-2xl bg-emerald-950/35 border border-emerald-500/40 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={handleTogglePlay}
                              className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center shrink-0 cursor-pointer"
                              aria-label={isPlaying ? 'Pause' : 'Play'}
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4 fill-black" />
                              ) : (
                                <Play className="w-4 h-4 fill-black ml-0.5" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-white truncate">
                                {selectedAudioFile
                                  ? selectedAudioFile.name
                                  : selectedOnlineSong
                                  ? selectedOnlineSong.title
                                  : selectedLibraryTrack?.title}
                              </p>
                              <p className="text-[10px] text-emerald-300 truncate">
                                {selectedAudioFile
                                  ? 'Device Audio File'
                                  : selectedOnlineSong
                                  ? `${selectedOnlineSong.artist} · ${selectedOnlineSong.durationLabel}`
                                  : `${selectedLibraryTrack?.artist} · ${selectedLibraryTrack?.mood}`}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveAudioTrack}
                            className="w-8 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer shrink-0"
                            title="Remove attached audio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick Switch Source Buttons */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMusicDrawer('online')}
                            className="py-1.5 px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-neutral-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Globe className="w-3 h-3 text-pink-400" />
                            <span>Search Online</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openMusicDrawer('trending')}
                            className="py-1.5 px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-neutral-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Trending</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openMusicDrawer('device')}
                            className="py-1.5 px-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-neutral-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileAudio className="w-3 h-3 text-cyan-400" />
                            <span>My MP3</span>
                          </button>
                        </div>

                        {/* Trim / Slide Audio Start Point */}
                        <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3 space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-200 font-bold">
                              Trim / Slide Audio Start Point
                            </span>
                            <span className="text-emerald-400 font-black tabular-nums">
                              Starts at {audioStartOffset.toFixed(1)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={maxAudioTrimStart}
                            step={0.5}
                            value={audioStartOffset}
                            onChange={(e) => setAudioStartOffset(Number(e.target.value))}
                            className="w-full accent-emerald-400 cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-neutral-500 tabular-nums">
                            <span>0:00</span>
                            <span>
                              Reel spans {audioStartOffset.toFixed(1)}s →{' '}
                              {(audioStartOffset + totalDuration).toFixed(1)}s
                            </span>
                          </div>
                        </div>

                        {/* Fade-In / Fade-Out Curves */}
                        <div className="grid grid-cols-2 gap-2.5 bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-neutral-300 font-semibold">Fade In</span>
                              <span className="text-cyan-300 font-bold tabular-nums">
                                {audioFadeIn.toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={3}
                              step={0.2}
                              value={audioFadeIn}
                              onChange={(e) => setAudioFadeIn(Number(e.target.value))}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-neutral-300 font-semibold">Fade Out</span>
                              <span className="text-pink-300 font-bold tabular-nums">
                                {audioFadeOut.toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={3}
                              step={0.2}
                              value={audioFadeOut}
                              onChange={(e) => setAudioFadeOut(Number(e.target.value))}
                              className="w-full accent-pink-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Music Volume vs Original Video Volume Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold flex items-center gap-1">
                            <Volume2 className="w-3 h-3 text-cyan-400" /> Original Video Vol
                          </span>
                          <span className="text-cyan-300 font-bold tabular-nums">
                            {hasVideoInTimeline ? `${originalVolume}%` : 'Photo'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          disabled={!hasVideoInTimeline}
                          value={originalVolume}
                          onChange={(e) => setOriginalVolume(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold flex items-center gap-1">
                            <Music className="w-3 h-3 text-pink-400" /> Music Vol
                          </span>
                          <span className="text-pink-300 font-bold tabular-nums">
                            {bgAudioVolume}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          value={bgAudioVolume}
                          onChange={(e) => setBgAudioVolume(Number(e.target.value))}
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. PUBLISH & EXPORT SETTINGS */}
                {activeTool === 'post' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1">
                        Post Caption / Title
                      </label>
                      <input
                        type="text"
                        value={postTitle}
                        onChange={(e) => setPostTitle(sanitizeInputLive(e.target.value, 120))}
                        placeholder="Write a catchy title..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1">
                        Hashtags
                      </label>
                      <input
                        type="text"
                        value={hashtagsStr}
                        onChange={(e) =>
                          setHashtagsStr(sanitizeHashtagsInput(e.target.value, 180))
                        }
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                      />
                    </div>
                    <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-3 space-y-2">
                      <p className="text-xs font-black text-white">
                        Allow others to download your video?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAllowDownload(true)}
                          className={`min-h-[40px] p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                            allowDownload
                              ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Yes, Allow</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllowDownload(false)}
                          className={`min-h-[40px] p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                            !allowDownload
                              ? 'bg-rose-500/15 border-rose-400 text-rose-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>No, Private</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handleSaveToDevice}
                        className="min-h-[42px] px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-cyan-500/50 text-cyan-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Next / Save to Gallery</span>
                      </button>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handlePostToFeed}
                        className="min-h-[42px] px-3 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 shrink-0" />
                        <span>Post Now</span>
                      </button>
                    </div>
                  </div>
                )}
                {/* 9. OVERLAY (PIP MULTI-LAYER STUDIO) */}
                {activeTool === 'overlay' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white">Overlay (PIP Layers)</h4>
                        <p className="text-[10px] text-neutral-400">
                          Add multiple photos/videos · Drag &amp; pinch on stage
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => overlayFileInputRef.current?.click()}
                        className="min-h-[38px] px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Overlay</span>
                      </button>
                    </div>

                    {overlays.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => overlayFileInputRef.current?.click()}
                        className="w-full p-5 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-cyan-500 bg-neutral-900/60 text-center space-y-2 cursor-pointer transition-colors"
                      >
                        <Layers className="w-6 h-6 text-cyan-400 mx-auto" />
                        <p className="text-xs font-black text-white">
                          Tap to add Photo or Video Overlay (PIP)
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          Layer reactions, logos, B-roll clips, or cutouts right above your reel
                        </p>
                      </button>
                    ) : (
                      <>
                        {/* Overlay Layer Strip */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                          {overlays.map((ov, idx) => {
                            const selected = activeOverlay?.id === ov.id;
                            return (
                              <button
                                key={ov.id}
                                type="button"
                                onClick={() => setActiveOverlayId(ov.id)}
                                className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                  selected
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                                }`}
                              >
                                {ov.mediaType === 'video' ? (
                                  <VideoIcon className="w-3 h-3 text-pink-400" />
                                ) : (
                                  <ImageIcon className="w-3 h-3 text-cyan-400" />
                                )}
                                <span className="truncate max-w-[85px]">
                                  PIP #{idx + 1}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {activeOverlay && (
                          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white truncate max-w-[160px]">
                                {activeOverlay.name}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMaskTarget('overlay');
                                    activateEditorTool('mask');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/50 text-purple-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Diamond className="w-3 h-3" />
                                  <span>Mask PIP</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverlays((prev) =>
                                      prev.filter((o) => o.id !== activeOverlay.id)
                                    );
                                    setActiveOverlayId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-300 font-semibold">Opacity</span>
                                <span className="text-cyan-400 font-bold tabular-nums">
                                  {activeOverlay.opacity}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={100}
                                value={activeOverlay.opacity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setOverlays((prev) =>
                                    prev.map((o) =>
                                      o.id === activeOverlay.id ? { ...o, opacity: val } : o
                                    )
                                  );
                                }}
                                className="w-full accent-cyan-400 cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-300 font-semibold">
                                  Resize (Scale / Pinch)
                                </span>
                                <span className="text-pink-400 font-bold tabular-nums">
                                  {Math.round(activeOverlay.scale * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={25}
                                max={220}
                                value={Math.round(activeOverlay.scale * 100)}
                                onChange={(e) => {
                                  const val = Number(e.target.value) / 100;
                                  setOverlays((prev) =>
                                    prev.map((o) =>
                                      o.id === activeOverlay.id ? { ...o, scale: val } : o
                                    )
                                  );
                                }}
                                className="w-full accent-pink-500 cursor-pointer"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-300 font-semibold">Rotation</span>
                                <span className="text-amber-400 font-bold tabular-nums">
                                  {activeOverlay.rotationDeg}°
                                </span>
                              </div>
                              <input
                                type="range"
                                min={-180}
                                max={180}
                                value={activeOverlay.rotationDeg}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setOverlays((prev) =>
                                    prev.map((o) =>
                                      o.id === activeOverlay.id
                                        ? { ...o, rotationDeg: val }
                                        : o
                                    )
                                  );
                                }}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 10. CAPCUT SHAPE MASKS (DIAMOND, CIRCLE, HEART, STAR, SPLIT, RECTANGLE) */}
                {activeTool === 'mask' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-white">Shape Masks &amp; Feather</h4>
                        <p className="text-[10px] text-neutral-400">
                          Diamond, Circle, Heart, Star, Split &amp; Feather Edges
                        </p>
                      </div>
                      {currentMaskConfig.shape !== 'none' && (
                        <button
                          type="button"
                          onClick={() => updateCurrentMask(() => ({ ...DEFAULT_MASK_CONFIG }))}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-[10px] font-bold text-rose-300 cursor-pointer"
                        >
                          Clear Mask
                        </button>
                      )}
                    </div>

                    {/* Apply Target Toggle: Main Video vs Active Overlay Layer */}
                    {overlays.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setMaskTarget('main')}
                          className={`min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
                            effectiveMaskTarget === 'main'
                              ? 'bg-purple-600 text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Main Video
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaskTarget('overlay')}
                          className={`min-h-[34px] rounded-lg text-[11px] font-bold cursor-pointer ${
                            effectiveMaskTarget === 'overlay'
                              ? 'bg-cyan-500 text-black font-black'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Active Overlay PIP
                        </button>
                      </div>
                    )}

                    {/* Mask Shape Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {MASK_SHAPE_OPTIONS.map((opt) => {
                        const selected = currentMaskConfig.shape === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              updateCurrentMask((prev) => ({
                                ...prev,
                                shape: opt.id,
                              }))
                            }
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                              selected
                                ? 'bg-purple-600/25 border-purple-400 text-white shadow-md shadow-purple-500/20'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-5 h-5"
                              fill={selected ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              {opt.id === 'none' && (
                                <path d="M4 4l16 16M19 5H5a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1z" />
                              )}
                              {opt.id === 'diamond' && <polygon points="12,2 22,12 12,22 2,12" />}
                              {opt.id === 'circle' && <circle cx="12" cy="12" r="9" />}
                              {opt.id === 'heart' && (
                                <path d="M12 20.5s-7.5-4.8-9-9.4C1.8 7.5 4.4 4.5 7.6 4.5c2 0 3.6 1.1 4.4 2.5.8-1.4 2.4-2.5 4.4-2.5 3.2 0 5.8 3 4.6 6.6-1.5 4.6-9 9.4-9 9.4z" />
                              )}
                              {opt.id === 'star' && (
                                <polygon points="12,2.5 14.9,8.5 21.5,9.4 16.7,14 17.9,20.5 12,17.4 6.1,20.5 7.3,14 2.5,9.4 9.1,8.5" />
                              )}
                              {opt.id === 'split' && (
                                <>
                                  <rect x="3" y="4" width="9" height="16" />
                                  <line x1="12" y1="2" x2="12" y2="22" />
                                </>
                              )}
                              {opt.id === 'rectangle' && (
                                <rect x="3" y="5" width="18" height="14" rx="3" />
                              )}
                            </svg>
                            <span className="text-[10px] font-black">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {currentMaskConfig.shape !== 'none' && (
                      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">
                              Feather / Blur Edges
                            </span>
                            <span className="text-purple-300 font-bold tabular-nums">
                              {currentMaskConfig.featherPx}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={40}
                            value={currentMaskConfig.featherPx}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCurrentMask((m) => ({ ...m, featherPx: val }));
                            }}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">Mask Size</span>
                            <span className="text-cyan-300 font-bold tabular-nums">
                              {currentMaskConfig.sizePercent}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={140}
                            value={currentMaskConfig.sizePercent}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCurrentMask((m) => ({ ...m, sizePercent: val }));
                            }}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold">
                              Rotate Shape
                            </span>
                            <span className="text-amber-300 font-bold tabular-nums">
                              {currentMaskConfig.rotationDeg}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            value={currentMaskConfig.rotationDeg}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateCurrentMask((m) => ({ ...m, rotationDeg: val }));
                            }}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                          <button
                            type="button"
                            onClick={() =>
                              updateCurrentMask((m) => ({ ...m, invert: !m.invert }))
                            }
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                              currentMaskConfig.invert
                                ? 'bg-pink-600/25 border-pink-400 text-pink-200'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                            }`}
                          >
                            {currentMaskConfig.invert ? 'Inverted: ON' : 'Invert Cutout'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCurrentMask((m) => ({
                                ...m,
                                xPercent: 50,
                                yPercent: 50,
                                rotationDeg: 0,
                              }))
                            }
                            className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-bold text-neutral-300 hover:text-white cursor-pointer"
                          >
                            Center Shape
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* 11. CAPCUT PRO MODULAR TOOL PANELS (Captions, Ticker, FX, BG Remove, Volume, Crop, Anim, Keyframe, Enhance) */}
                <StudioProToolPanels
                  activeTool={activeTool}
                  playheadTime={playheadTime}
                  totalDuration={Math.max(0.5, totalDuration)}
                  hasVideoInTimeline={hasVideoInTimeline}
                  hasAttachedMusic={hasAttachedMusic}
                  exportResolution={exportResolution}
                  onSetExportResolution={setExportResolution}
                  captions={captions}
                  onSetCaptions={setCaptions}
                  ticker={ticker}
                  onSetTicker={setTicker}
                  visualEffect={visualEffect}
                  onSetVisualEffect={setVisualEffect}
                  bgRemoval={bgRemoval}
                  onSetBgRemoval={setBgRemoval}
                  onPickBgReplacementImage={handlePickBgReplacementImage}
                  originalVolume={originalVolume}
                  bgAudioVolume={bgAudioVolume}
                  onSetOriginalVolume={setOriginalVolume}
                  onSetBgAudioVolume={setBgAudioVolume}
                  onOpenMusicDrawer={() => openMusicDrawer('online')}
                  cropConfig={cropConfig}
                  onSetCropConfig={setCropConfig}
                  clipAnimation={clipAnimation}
                  onSetClipAnimation={setClipAnimation}
                  textAnimConfig={activeTextLayer.animConfig || DEFAULT_ANIMATION_CONFIG}
                  onSetTextAnimConfig={(next) =>
                    updateActiveTextLayer((t) => ({ ...t, animConfig: next }))
                  }
                  hasActiveText={activeTextLayer.text.trim().length > 0}
                  keyframes={keyframes}
                  onAddOrUpdateKeyframe={handleAddOrUpdateKeyframe}
                  onUpdateKeyframe={(id, patch) =>
                    setKeyframes((prev) =>
                      prev.map((k) => (k.id === id ? { ...k, ...patch } : k))
                    )
                  }
                  onDeleteKeyframe={(id) =>
                    setKeyframes((prev) => prev.filter((k) => k.id !== id))
                  }
                  onScrubTo={handleScrub}
                  enhanceConfig={enhanceConfig}
                  onSetEnhanceConfig={setEnhanceConfig}
                  onShowToast={onShowToast}
                />
              </div>
            </aside>
          </div>

          {/* Bottom Interactive Multi-Track Timeline */}
          <ProTimeline
            spans={spans}
            totalDuration={Math.max(0.5, totalDuration)}
            playheadTime={playheadTime}
            isPlaying={isPlaying}
            selectedClipId={selectedClip?.id || null}
            zoomLevel={zoomLevel}
            audioLabel={currentAudioLabel}
            hasAttachedMusic={hasAttachedMusic}
            audioStartOffset={audioStartOffset}
            audioFadeIn={audioFadeIn}
            audioFadeOut={audioFadeOut}
            textLayer={activeTextLayer}
            stickers={stickers}
            overlays={overlays}
            activeMaskShape={currentMaskConfig.shape}
            keyframes={keyframes}
            captionsCount={captions.length}
            hasTicker={ticker.enabled}
            activeEffectType={visualEffect.type}
            onTogglePlay={handleTogglePlay}
            onScrub={handleScrub}
            onSelectClip={(id) => setSelectedClipId(id)}
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onDuplicateSelected={handleDuplicateActiveItem}
            onDeleteSelected={handleDeleteActiveItem}
            onTrimClip={handleTrimClip}
            onZoomChange={setZoomLevel}
            onAddClipClick={() => fileInputRef.current?.click()}
            onOpenTransitionForClip={(clipId) => {
              setSelectedClipId(clipId);
              setActiveTool('transitions');
            }}
            onFocusTrackTool={(tool) => activateEditorTool(tool)}
            onAudioBarClick={() => {
              if (!hasAttachedMusic) {
                openMusicDrawer('online');
              } else {
                activateEditorTool('music');
              }
            }}
          />

          {/* Complete CapCut-Style Scrollable Bottom Toolbar */}
          <nav
            aria-label="Pro Studio Tools"
            className="shrink-0 bg-[#08080c] border-t border-neutral-800/90 px-2 py-1.5 flex items-center justify-start gap-1 overflow-x-auto no-scrollbar"
          >
            {(
              [
                { id: 'trim', label: 'Split', icon: Scissors },
                { id: 'text', label: 'Text', icon: Type },
                { id: 'captions', label: 'Captions', icon: Captions },
                { id: 'ticker', label: 'Ticker', icon: Megaphone },
                { id: 'effects', label: 'Effects', icon: Wand2 },
                { id: 'filters', label: 'Filters', icon: Sliders },
                { id: 'bg_remove', label: 'BG Remove', icon: Eraser },
                { id: 'action_duplicate', label: 'Duplicate', icon: Copy },
                { id: 'action_delete', label: 'Delete', icon: Trash2 },
                { id: 'speed', label: 'Speed', icon: Gauge },
                { id: 'volume', label: 'Volume', icon: Volume2 },
                { id: 'crop', label: 'Crop', icon: Crop },
                { id: 'animation', label: 'Animation', icon: Sparkles },
                { id: 'keyframe', label: 'Keyframe', icon: Diamond },
                { id: 'enhance', label: 'Enhance 4K', icon: Zap },
                { id: 'music', label: 'Audio', icon: Music },
                { id: 'overlay', label: 'Overlay', icon: Layers },
                { id: 'mask', label: 'Mask', icon: RotateCw },
                { id: 'stickers', label: 'Stickers', icon: Smile },
                { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
                { id: 'post', label: 'Publish', icon: Send },
              ] as const
            ).map((tool) => {
              const Icon = tool.icon;
              const isActionBtn =
                tool.id === 'action_duplicate' || tool.id === 'action_delete';
              const active = !isActionBtn && activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    if (tool.id === 'action_duplicate') {
                      handleDuplicateActiveItem();
                    } else if (tool.id === 'action_delete') {
                      handleDeleteActiveItem();
                    } else if (tool.id === 'music') {
                      activateEditorTool('music');
                      openMusicDrawer('online');
                    } else if (tool.id === 'trim' && activeTool === 'trim') {
                      handleSplitAtPlayhead();
                    } else {
                      activateEditorTool(tool.id);
                    }
                  }}
                  className={`min-w-[66px] min-h-[48px] px-2.5 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-pink-600/20 border border-pink-500/60 text-white'
                      : tool.id === 'action_delete'
                      ? 'border border-transparent text-rose-300/85 hover:text-rose-200 hover:bg-rose-950/35'
                      : 'border border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active
                        ? 'text-pink-400'
                        : tool.id === 'action_delete'
                        ? 'text-rose-400'
                        : 'text-neutral-300'
                    }`}
                  />
                  <span className="text-[10px] font-bold leading-none whitespace-nowrap">
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* 3-Tab CapCut Music & Sound Picker Drawer */}
      <StudioMusicPickerDrawer
        isOpen={isMusicDrawerOpen}
        onClose={() => setIsMusicDrawerOpen(false)}
        initialTab={musicDrawerTab}
        selectedLibraryTrack={selectedLibraryTrack}
        selectedAudioFile={selectedAudioFile}
        selectedAudioPreviewUrl={selectedAudioPreviewUrl}
        selectedOnlineSong={selectedOnlineSong}
        volume={bgAudioVolume}
        onAttachLibraryTrack={handleAttachLibraryTrackFromDrawer}
        onAttachDeviceFile={handleAttachDeviceAudioFromDrawer}
        onAttachOnlineSong={handleAttachOnlineSong}
        onShowToast={onShowToast}
      />
    </div>
  );
};

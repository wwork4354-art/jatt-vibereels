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
  ProFilterLut,
  TimelineClipItem,
  ClipTransitionType,
  SpeedCurvePresetId,
  TextAnimationStyle,
  EditorTextLayer,
  EditorStickerLayer,
  computeTimelineSpans,
  drawProTimelineFrame,
  evaluateSpeedMultiplierAtProgress,
  mapClipProgressToSourceTime,
  TimelineRenderOptions,
} from '../utils/proEditorEngine';
import { ProTimeline } from './ProTimeline';
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
  | 'speed'
  | 'filters'
  | 'text'
  | 'transitions'
  | 'stickers'
  | 'music'
  | 'post';

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
  { val: 0.5, label: '0.5x Slow-Mo' },
  { val: 1, label: '1x Normal' },
  { val: 1.5, label: '1.5x Fast' },
  { val: 2, label: '2x Turbo' },
];

const STICKER_OPTIONS = ['🔥', '👑', '❤️', '🎵', '✨', '🦁', '🎬', '💯', '😎', '🌟'];

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

  // Animated & Draggable Text Overlay
  const [textLayer, setTextLayer] = useState<EditorTextLayer>({
    text: '',
    fontId: 'modern',
    color: '#ffffff',
    size: 30,
    xPercent: 50,
    yPercent: 72,
    neonGlow: false,
    outline: true,
    backdrop: true,
    animation: 'pop',
  });

  // Draggable Stickers
  const [stickers, setStickers] = useState<EditorStickerLayer[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<'text' | string | null>(null);

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
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaElementCacheRef = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);
  const playheadRef = useRef<number>(0);
  const exportCancelRef = useRef<boolean>(false);

  playheadRef.current = playheadTime;

  const { spans, totalDuration } = useMemo(() => computeTimelineSpans(clips), [clips]);

  const selectedClip = useMemo(() => {
    if (clips.length === 0) return null;
    return clips.find((c) => c.id === selectedClipId) || clips[0];
  }, [clips, selectedClipId]);

  const hasAttachedMusic = Boolean(
    selectedAudioFile || selectedLibraryTrack || selectedOnlineSong
  );

  const renderOptions: TimelineRenderOptions = useMemo(
    () => ({
      filterLut: selectedLut,
      lutIntensity,
      brightnessAdj,
      contrastAdj,
      saturateAdj,
      vignetteAdj,
      textLayer,
      stickers,
    }),
    [
      selectedLut,
      lutIntensity,
      brightnessAdj,
      contrastAdj,
      saturateAdj,
      vignetteAdj,
      textLayer,
      stickers,
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
    return (
      clips.length > 1 ||
      lutChanged ||
      speedOrTrimChanged ||
      textLayer.text.trim().length > 0 ||
      stickers.length > 0
    );
  }, [
    clips,
    selectedLut.id,
    brightnessAdj,
    contrastAdj,
    saturateAdj,
    vignetteAdj,
    textLayer.text,
    stickers.length,
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

  // Load initialFile if opened with one
  useEffect(() => {
    if (isOpen && initialFile && clips.length === 0) {
      void addMediaFiles([initialFile]);
    }
  }, [isOpen, initialFile, clips.length, addMediaFiles]);

  // Cleanup URLs and audio on unmount or close
  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopPreviewTrack();
      setPreviewingAudioId(null);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      mediaElementCacheRef.current.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
          el.pause();
        }
      });
    }
    return () => {
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
    const envelopeVol = (bgAudioVolume / 100) * Math.min(fadeInGain, fadeOutGain);
    el.volume = Math.max(0, Math.min(1, envelopeVol));

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

      mediaElementCacheRef.current.forEach((el, srcId) => {
        if (!(el instanceof HTMLVideoElement)) return;
        const isCurrentSource = srcId === span.clip.sourceId;
        if (!isCurrentSource) {
          if (!el.paused) el.pause();
          return;
        }
        el.volume = Math.max(0, Math.min(1, originalVolume / 100));
        el.muted = originalVolume <= 1 || !playing;
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
    }

    return () => cancelAnimationFrame(rafId);
  }, [
    isOpen,
    spans,
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
      text: '',
      fontId: 'modern',
      color: '#ffffff',
      size: 30,
      xPercent: 50,
      yPercent: 72,
      neonGlow: false,
      outline: true,
      backdrop: true,
      animation: 'pop',
    });
    setStickers([]);
    setActiveStickerId(null);
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

  // Drag-to-Position Text or Stickers directly on 9:16 Video Canvas
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if near any sticker first
    let hitStickerId: string | null = null;
    let bestDist = 14;
    for (const stk of stickers) {
      const dist = Math.hypot(clickX - stk.xPercent, clickY - stk.yPercent);
      if (dist < bestDist) {
        bestDist = dist;
        hitStickerId = stk.id;
      }
    }

    let target: 'text' | string | null = null;
    if (hitStickerId) {
      target = hitStickerId;
      setActiveStickerId(hitStickerId);
      setActiveTool('stickers');
    } else if (textLayer.text.trim()) {
      const distText = Math.hypot(clickX - textLayer.xPercent, clickY - textLayer.yPercent);
      if (distText < 24 || activeTool === 'text') {
        target = 'text';
        setActiveTool('text');
      }
    }

    if (!target) return;
    setDraggingTarget(target);
    stage.setPointerCapture?.(e.pointerId);

    const updateCoords = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      const nx = Math.max(8, Math.min(92, ((clientX - r.left) / r.width) * 100));
      const ny = Math.max(8, Math.min(92, ((clientY - r.top) / r.height) * 100));
      // Subtle magnetic center snap within 2%
      const snappedX = Math.abs(nx - 50) < 2 ? 50 : Number(nx.toFixed(1));
      const snappedY = Number(ny.toFixed(1));

      if (target === 'text') {
        setTextLayer((prev) => ({ ...prev, xPercent: snappedX, yPercent: snappedY }));
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
    if (!hasAnyEdits && exportResolution === '1080p') return primary.file;

    const outW = exportResolution === '4k' ? 2160 : 1080;
    const outH = exportResolution === '4k' ? 3840 : 1920;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return primary.file;

    drawProTimelineFrame(
      ctx,
      outW,
      outH,
      0,
      spans,
      mediaElementCacheRef.current,
      renderOptions
    );

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

    const isStaticSinglePhoto =
      clips.length === 1 &&
      clips[0].mediaType === 'image' &&
      (textLayer.text.trim() === '' || textLayer.animation === 'none') &&
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
      const outW = res === '4k' ? 2160 : 1080;
      const outH = res === '4k' ? 3840 : 1920;
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

      // Best-effort attach background song (device MP3 / online stream) or synth stream with start offset & Fade-In / Fade-Out
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
          const targetVol = Math.max(0.001, Math.min(1, bgAudioVolume / 100));
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
            bgAudioVolume / 100,
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
          bgAudioVolume / 100,
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

          drawProTimelineFrame(
            ctx,
            outW,
            outH,
            Math.min(elapsed, renderDuration),
            spans,
            mediaElementCacheRef.current,
            renderOptions
          );

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
      const { file } = await renderProTimelineVideo();
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
      onShowToast?.(`Exported ${exportResolution.toUpperCase()} edit to your device!`);
    } catch (err) {
      console.error('Export failed:', err);
      onShowToast?.('Could not render export on this device.');
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

        {/* Right Header Controls: Resolution Switcher (1080p / 4K), Reset, Export, Post */}
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
                className="min-h-[38px] px-2.5 sm:px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-cyan-500/40 text-cyan-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                title="Download edited media"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handlePostToFeed}
                className="min-h-[38px] px-3 sm:px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </>
          )}
        </div>
      </header>

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
                className="relative h-full max-h-full aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl touch-none select-none gpu-accelerated"
              >
                <canvas
                  ref={previewCanvasRef}
                  width={360}
                  height={640}
                  className="w-full h-full object-contain block"
                />

                {/* Center Snapping Crosshair Guide while dragging text or sticker */}
                {draggingTarget && (
                  <>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400/55 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/55 pointer-events-none" />
                  </>
                )}

                {/* Subtle Drag Affordance when editing Text/Stickers */}
                {(activeTool === 'text' || activeTool === 'stickers') && (
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 border border-white/15 text-[10px] font-bold text-cyan-300 flex items-center gap-1 pointer-events-none">
                    <Move className="w-3 h-3" />
                    <span>Drag on canvas</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right / Lower Editing Inspector Panel */}
            <aside className="w-full lg:w-[400px] xl:w-[430px] max-h-[36vh] lg:max-h-none bg-[#0d0d13] border-t lg:border-t-0 lg:border-l border-neutral-800/90 flex flex-col shrink-0 overflow-hidden">
              {/* Compact Active Tool Inspector Header */}
              <div className="shrink-0 px-3.5 py-2 border-b border-neutral-800/90 flex items-center justify-between gap-2 bg-[#111119]">
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-200 truncate">
                    {activeTool === 'trim'
                      ? 'Edit & Split'
                      : activeTool === 'music'
                      ? 'Audio & Sound Controls'
                      : activeTool === 'text'
                      ? 'Text & Captions'
                      : activeTool === 'stickers'
                      ? 'Stickers & Emojis'
                      : activeTool === 'filters'
                      ? 'Filters & LUTs'
                      : activeTool === 'speed'
                      ? 'Speed (0.5x – 2x)'
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
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4 no-scrollbar">
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

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SPEED_QUICK_PRESETS.map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => updateSelectedClip((c) => ({ ...c, speed: opt.val }))}
                          className={`min-h-[44px] px-2 rounded-xl border text-[11px] font-black cursor-pointer transition-all ${
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
                        <span className="text-neutral-300 font-semibold">Fine Speed Control</span>
                        <span className="text-cyan-400 font-bold tabular-nums">
                          {selectedClip.speed.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={2.5}
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

                {/* 4. ANIMATED TEXT & CAPTIONS */}
                {activeTool === 'text' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">Animated Text &amp; Captions</h4>
                      <span className="text-[10px] font-semibold text-cyan-300">
                        Drag directly on preview
                      </span>
                    </div>

                    <input
                      type="text"
                      value={textLayer.text}
                      onChange={(e) =>
                        setTextLayer((prev) => ({
                          ...prev,
                          text: sanitizeInputLive(e.target.value, 80),
                        }))
                      }
                      placeholder="Type animated headline or caption..."
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
                    />

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
                            onClick={() => setTextLayer((p) => ({ ...p, fontId: f.id }))}
                            className={`px-3 min-h-[36px] rounded-lg border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                              textLayer.fontId === f.id
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
                        Caption Animation
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TEXT_ANIMATION_OPTIONS.map((anim) => (
                          <button
                            key={anim.id}
                            type="button"
                            onClick={() => setTextLayer((p) => ({ ...p, animation: anim.id }))}
                            className={`min-h-[36px] px-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                              textLayer.animation === anim.id
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
                            onClick={() => setTextLayer((p) => ({ ...p, color: hex }))}
                            style={{ backgroundColor: hex }}
                            className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                              textLayer.color === hex
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
                            setTextLayer((p) => ({ ...p, neonGlow: !p.neonGlow }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            textLayer.neonGlow
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Neon Glow
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTextLayer((p) => ({ ...p, outline: !p.outline }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            textLayer.outline
                              ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Outline
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTextLayer((p) => ({ ...p, backdrop: !p.backdrop }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                            textLayer.backdrop
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          Box
                        </button>
                      </div>
                    </div>

                    {/* Size slider */}
                    <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-300 font-semibold">Font Size</span>
                        <span className="text-pink-400 font-bold tabular-nums">
                          {textLayer.size}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={54}
                        value={textLayer.size}
                        onChange={(e) =>
                          setTextLayer((p) => ({ ...p, size: Number(e.target.value) }))
                        }
                        className="w-full accent-pink-500 cursor-pointer"
                      />
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
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white">Stickers (Drag on Canvas)</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STICKER_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddSticker(emoji)}
                          className="w-11 h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
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
                          max={100}
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
                          max={100}
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
                  </div>
                )}
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
            textLayer={textLayer}
            stickers={stickers}
            onTogglePlay={handleTogglePlay}
            onScrub={handleScrub}
            onSelectClip={(id) => setSelectedClipId(id)}
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onTrimClip={handleTrimClip}
            onZoomChange={setZoomLevel}
            onAddClipClick={() => fileInputRef.current?.click()}
            onOpenTransitionForClip={(clipId) => {
              setSelectedClipId(clipId);
              setActiveTool('transitions');
            }}
            onFocusTrackTool={(tool) => setActiveTool(tool)}
            onAudioBarClick={() => {
              if (!hasAttachedMusic) {
                openMusicDrawer('online');
              } else {
                setActiveTool('music');
              }
            }}
          />

          {/* Complete CapCut-Style Bottom Toolbar */}
          <nav
            aria-label="Pro Studio Tools"
            className="shrink-0 bg-[#08080c] border-t border-neutral-800/90 px-2 py-1.5 flex items-center justify-start sm:justify-center gap-1 overflow-x-auto no-scrollbar"
          >
            {(
              [
                { id: 'trim', label: 'Edit/Split', icon: Scissors },
                { id: 'music', label: 'Audio/Sounds', icon: Music },
                { id: 'text', label: 'Text/Captions', icon: Type },
                { id: 'stickers', label: 'Stickers', icon: Smile },
                { id: 'filters', label: 'Filters & LUTs', icon: Sliders },
                { id: 'speed', label: 'Speed (0.5x–2x)', icon: Gauge },
                { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
                { id: 'post', label: 'Publish', icon: Sparkles },
              ] as const
            ).map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    if (tool.id === 'music') {
                      setActiveTool('music');
                      openMusicDrawer('online');
                    } else if (tool.id === 'trim' && activeTool === 'trim') {
                      handleSplitAtPlayhead();
                    } else {
                      setActiveTool(tool.id);
                    }
                  }}
                  className={`min-w-[68px] min-h-[48px] px-2.5 py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-pink-600/20 border border-pink-500/60 text-white'
                      : 'border border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-pink-400' : 'text-neutral-300'}`} />
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

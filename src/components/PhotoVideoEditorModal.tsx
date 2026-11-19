import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Scissors,
  Sliders,
  Type,
  Smile,
  Music,
  Upload,
  Play,
  Pause,
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
} from 'lucide-react';
import { AudioTrackOption, CreatorProfileData, UserAccount, VideoPost } from '../types';
import { searchAudioLibrary } from '../data/audioLibrary';
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

type EditorToolTab = 'trim' | 'filters' | 'text' | 'stickers' | 'music' | 'post';

interface FilterPreset {
  id: string;
  label: string;
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
  sepia: number;
  grayscale: number;
}

interface EditorStickerItem {
  id: string;
  emoji: string;
  xPercent: number;
  yPercent: number;
  size: number;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', brightness: 100, contrast: 100, saturate: 100, hueRotate: 0, sepia: 0, grayscale: 0 },
  { id: 'vibrant', label: 'Vibrant', brightness: 106, contrast: 116, saturate: 145, hueRotate: 0, sepia: 0, grayscale: 0 },
  { id: 'punjabi_gold', label: 'Gold Glow', brightness: 108, contrast: 110, saturate: 128, hueRotate: -6, sepia: 18, grayscale: 0 },
  { id: 'neon_cyber', label: 'Neon Cyber', brightness: 104, contrast: 124, saturate: 155, hueRotate: 14, sepia: 0, grayscale: 0 },
  { id: 'warm_sunset', label: 'Sunset', brightness: 105, contrast: 108, saturate: 132, hueRotate: -12, sepia: 24, grayscale: 0 },
  { id: 'cool_ice', label: 'Cool Ice', brightness: 104, contrast: 112, saturate: 95, hueRotate: 165, sepia: 0, grayscale: 0 },
  { id: 'bw_noir', label: 'B&W Noir', brightness: 102, contrast: 132, saturate: 0, hueRotate: 0, sepia: 0, grayscale: 100 },
  { id: 'vintage', label: 'Retro Film', brightness: 96, contrast: 98, saturate: 84, hueRotate: 0, sepia: 42, grayscale: 0 },
];

const TEXT_COLOR_SWATCHES = [
  '#ffffff',
  '#f43f5e',
  '#22d3ee',
  '#facc15',
  '#a855f7',
  '#10b981',
  '#000000',
];

const STICKER_OPTIONS = ['🔥', '👑', '❤️', '🎵', '✨', '🦁', '🎬', '💯', '😎', '🌟'];

function formatSecLabel(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<EditorToolTab>('filters');

  // Playback & Trim
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [photoFitMode, setPhotoFitMode] = useState<'contain' | 'cover'>('contain');

  // Filters & Color Adjustments
  const [selectedPresetId, setSelectedPresetId] = useState('original');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [hueRotate, setHueRotate] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);

  // Text Overlay
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(26);
  const [textYPercent, setTextYPercent] = useState(75);
  const [textBackdrop, setTextBackdrop] = useState(true);

  // Stickers
  const [stickers, setStickers] = useState<EditorStickerItem[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);

  // Music & Volume Mixer
  const [audioSearch, setAudioSearch] = useState('');
  const [audioCategory, setAudioCategory] = useState<'all' | 'naat' | 'song' | 'beat'>('all');
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<AudioTrackOption | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedAudioPreviewUrl, setSelectedAudioPreviewUrl] = useState<string | null>(null);
  const [previewingAudioId, setPreviewingAudioId] = useState<string | null>(null);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [bgAudioVolume, setBgAudioVolume] = useState(80);

  // Post Metadata
  const [postTitle, setPostTitle] = useState('');
  const [hashtagsStr, setHashtagsStr] = useState('#jattvibereels #edited #trending');
  const [allowDownload, setAllowDownload] = useState(true);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [editorError, setEditorError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const filteredTracks = useMemo(
    () => searchAudioLibrary(audioSearch, audioCategory),
    [audioSearch, audioCategory]
  );

  const cssFilterString = useMemo(() => {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hueRotate}deg) sepia(${sepia}%) grayscale(${grayscale}%)`;
  }, [brightness, contrast, saturate, hueRotate, sepia, grayscale]);

  const hasVisualOrTrimEdits = useMemo(() => {
    const filterModified =
      selectedPresetId !== 'original' ||
      brightness !== 100 ||
      contrast !== 100 ||
      saturate !== 100 ||
      hueRotate !== 0 ||
      sepia !== 0 ||
      grayscale !== 0;
    const trimModified =
      mediaType === 'video' &&
      videoDuration > 0 &&
      (trimStart > 0.2 || (trimEnd > 0 && Math.abs(videoDuration - trimEnd) > 0.25));
    return (
      filterModified ||
      trimModified ||
      overlayText.trim().length > 0 ||
      stickers.length > 0
    );
  }, [
    selectedPresetId,
    brightness,
    contrast,
    saturate,
    hueRotate,
    sepia,
    grayscale,
    mediaType,
    videoDuration,
    trimStart,
    trimEnd,
    overlayText,
    stickers.length,
  ]);

  const loadMediaFile = useCallback(
    (file: File) => {
      setEditorError('');
      const check = validateSafeMediaFile(file);
      if (!check.valid) {
        const msg =
          check.reason || 'Only safe .mp4, .webm, .jpg, .png, and .webp files are allowed.';
        setEditorError(msg);
        onShowToast?.(msg);
        return;
      }

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      const nextUrl = URL.createObjectURL(file);
      const isImg = check.mediaType === 'image';
      setSelectedFile(file);
      setMediaType(isImg ? 'image' : 'video');
      setPreviewUrl(nextUrl);
      setCurrentTime(0);
      setTrimStart(0);
      setTrimEnd(0);
      setVideoDuration(0);
      setIsPlaying(true);
      setActiveTool(isImg ? 'filters' : 'trim');

      const baseName = sanitizeText(
        file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        90
      );
      if (baseName) setPostTitle(baseName);
    },
    [previewUrl, onShowToast]
  );

  useEffect(() => {
    if (isOpen && initialFile) {
      loadMediaFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFile]);

  // Stop previews when closed
  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopPreviewTrack();
      setPreviewingAudioId(null);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (previewVideoRef.current) previewVideoRef.current.pause();
    }
    return () => {
      soundEngine.stopPreviewTrack();
    };
  }, [isOpen]);

  // Keep video preview looped strictly inside [trimStart, trimEnd]
  useEffect(() => {
    const vid = previewVideoRef.current;
    if (!vid || mediaType !== 'video') return;
    vid.volume = Math.max(0, Math.min(1, originalVolume / 100));
    vid.muted = originalVolume <= 1;
  }, [originalVolume, mediaType, previewUrl]);

  // Sync audio preview volume
  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = Math.max(0, Math.min(1, bgAudioVolume / 100));
    }
  }, [bgAudioVolume]);

  if (!isOpen) return null;

  const applyPreset = (preset: FilterPreset) => {
    setSelectedPresetId(preset.id);
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturate(preset.saturate);
    setHueRotate(preset.hueRotate);
    setSepia(preset.sepia);
    setGrayscale(preset.grayscale);
  };

  const resetAllEdits = () => {
    applyPreset(FILTER_PRESETS[0]);
    setOverlayText('');
    setStickers([]);
    setActiveStickerId(null);
    setTrimStart(0);
    setTrimEnd(videoDuration);
    setSelectedLibraryTrack(null);
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl(null);
    soundEngine.stopPreviewTrack();
    setPreviewingAudioId(null);
    onShowToast?.('Editor adjustments reset');
  };

  const handleAddSticker = (emoji: string) => {
    const newItem: EditorStickerItem = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      xPercent: 50 + ((stickers.length % 3) - 1) * 14,
      yPercent: 32 + (stickers.length % 3) * 12,
      size: 44,
    };
    setStickers((prev) => [...prev, newItem]);
    setActiveStickerId(newItem.id);
  };

  const handleTogglePlay = () => {
    if (mediaType === 'video' && previewVideoRef.current) {
      const vid = previewVideoRef.current;
      if (vid.paused) {
        if (trimEnd > trimStart && (vid.currentTime < trimStart || vid.currentTime >= trimEnd)) {
          vid.currentTime = trimStart;
        }
        void vid.play().catch(() => {});
        if (selectedAudioFile && previewAudioRef.current) {
          previewAudioRef.current.volume = bgAudioVolume / 100;
          void previewAudioRef.current.play().catch(() => {});
        } else if (selectedLibraryTrack) {
          soundEngine.playPreviewTrack(selectedLibraryTrack.trackType, bgAudioVolume / 100);
          setPreviewingAudioId(selectedLibraryTrack.id);
        }
        setIsPlaying(true);
      } else {
        vid.pause();
        if (previewAudioRef.current) previewAudioRef.current.pause();
        soundEngine.stopPreviewTrack();
        setPreviewingAudioId(null);
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((p) => !p);
    }
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
    setSelectedAudioFile(file);
    setSelectedAudioPreviewUrl(url);
    setPreviewingAudioId('custom-audio');
    setTimeout(() => {
      if (previewAudioRef.current) {
        previewAudioRef.current.volume = bgAudioVolume / 100;
        void previewAudioRef.current.play().catch(() => {});
      }
    }, 40);
  };

  const handleSelectLibraryTrack = (track: AudioTrackOption) => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    const isSame = selectedLibraryTrack?.id === track.id;
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl(null);
    if (isSame) {
      setSelectedLibraryTrack(null);
      soundEngine.stopPreviewTrack();
      setPreviewingAudioId(null);
    } else {
      setSelectedLibraryTrack(track);
      soundEngine.playPreviewTrack(track.trackType, bgAudioVolume / 100);
      setPreviewingAudioId(track.id);
    }
  };

  // Draw overlays (Text + Stickers) identically for both Image & Video canvas exports
  const drawOverlaysOnContext = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.filter = 'none';

    // Text overlay
    const trimmedText = overlayText.trim();
    if (trimmedText) {
      const scaledFont = Math.max(20, Math.round((textSize / 360) * width));
      ctx.font = `900 ${scaledFont}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const yPos = (textYPercent / 100) * height;
      const metrics = ctx.measureText(trimmedText);
      const padX = scaledFont * 0.55;
      const padY = scaledFont * 0.42;

      if (textBackdrop) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
        const boxW = Math.min(width * 0.9, metrics.width + padX * 2);
        const boxH = scaledFont + padY * 1.4;
        const rx = width / 2 - boxW / 2;
        const ry = yPos - boxH / 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, boxW, boxH, 14);
        ctx.fill();
      }

      ctx.lineWidth = Math.max(2, scaledFont * 0.08);
      ctx.strokeStyle = textColor === '#000000' ? '#ffffff' : 'rgba(0,0,0,0.8)';
      ctx.strokeText(trimmedText, width / 2, yPos, width * 0.86);
      ctx.fillStyle = textColor;
      ctx.fillText(trimmedText, width / 2, yPos, width * 0.86);
    }

    // Stickers
    for (const stk of stickers) {
      const fontPx = Math.max(24, Math.round((stk.size / 360) * width));
      ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const xPos = (stk.xPercent / 100) * width;
      const yPos = (stk.yPercent / 100) * height;
      ctx.fillText(stk.emoji, xPos, yPos);
    }
  };

  // Export edited Photo as crisp PNG File
  const renderEditedPhotoFile = async (): Promise<File> => {
    if (!selectedFile || !previewUrl) throw new Error('No photo selected');
    if (!hasVisualOrTrimEdits && photoFitMode === 'contain') {
      return selectedFile;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not load image for export'));
      img.src = previewUrl;
    });

    const maxDim = 1280;
    let outW = img.naturalWidth || 1080;
    let outH = img.naturalHeight || 1920;

    if (photoFitMode === 'cover') {
      outW = 1080;
      outH = 1920;
    } else if (outW > maxDim || outH > maxDim) {
      const scale = Math.min(maxDim / outW, maxDim / outH);
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return selectedFile;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outW, outH);
    ctx.filter = cssFilterString;

    if (photoFitMode === 'cover') {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const targetAspect = outW / outH;
      let sx = 0;
      let sy = 0;
      let sW = img.naturalWidth;
      let sH = img.naturalHeight;
      if (imgAspect > targetAspect) {
        sW = img.naturalHeight * targetAspect;
        sx = (img.naturalWidth - sW) / 2;
      } else {
        sH = img.naturalWidth / targetAspect;
        sy = (img.naturalHeight - sH) / 2;
      }
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, outW, outH);
    } else {
      ctx.drawImage(img, 0, 0, outW, outH);
    }

    drawOverlaysOnContext(ctx, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
    );
    if (!blob) return selectedFile;
    return new File([blob], `jatt-edited-${Date.now()}.png`, { type: 'image/png' });
  };

  // Export edited/trimmed Video as WebM File (fast offscreen render, or instant original if unmodified)
  const renderEditedVideoFile = async (): Promise<File> => {
    if (!selectedFile || !previewUrl) throw new Error('No video selected');
    if (!hasVisualOrTrimEdits || typeof MediaRecorder === 'undefined') {
      return selectedFile;
    }

    const sourceVid = document.createElement('video');
    sourceVid.src = previewUrl;
    sourceVid.crossOrigin = 'anonymous';
    sourceVid.playsInline = true;
    sourceVid.muted = originalVolume <= 1;
    sourceVid.volume = Math.max(0, Math.min(1, originalVolume / 100));

    await new Promise<void>((resolve, reject) => {
      sourceVid.onloadedmetadata = () => resolve();
      sourceVid.onerror = () => reject(new Error('Could not initialize video renderer'));
    });

    const start = Math.max(0, trimStart);
    const end = trimEnd > start ? Math.min(sourceVid.duration, trimEnd) : sourceVid.duration;
    const clipLen = Math.max(0.4, end - start);

    const maxW = 720;
    const rawW = sourceVid.videoWidth || 720;
    const rawH = sourceVid.videoHeight || 1280;
    const scale = rawW > maxW ? maxW / rawW : 1;
    const outW = Math.max(320, Math.round((rawW * scale) / 2) * 2);
    const outH = Math.max(320, Math.round((rawH * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return selectedFile;

    const canvasStream = canvas.captureStream(30);
    // Attach audio tracks from source video if browser supports captureStream on HTMLVideoElement
    try {
      const vidWithCapture = sourceVid as HTMLVideoElement & {
        captureStream?: () => MediaStream;
      };
      if (typeof vidWithCapture.captureStream === 'function' && originalVolume > 1) {
        const audioStream = vidWithCapture.captureStream();
        audioStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      }
    } catch {
      // silent fallback if cross-origin or unsupported
    }

    const mimeTypes = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'];
    const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const recorder = supportedMime
      ? new MediaRecorder(canvasStream, { mimeType: supportedMime, videoBitsPerSecond: 4_500_000 })
      : new MediaRecorder(canvasStream);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    sourceVid.currentTime = start;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        sourceVid.removeEventListener('seeked', onSeeked);
        resolve();
      };
      sourceVid.addEventListener('seeked', onSeeked);
      setTimeout(resolve, 250);
    });

    const recordedBlob = await new Promise<Blob>((resolve) => {
      let stopped = false;
      let rafId = 0;

      const finish = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        sourceVid.pause();
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
      };

      recorder.onstop = () => {
        setExportProgress(100);
        resolve(new Blob(chunks, { type: supportedMime || 'video/webm' }));
      };

      recorder.start(150);
      void sourceVid.play().catch(() => {});

      const drawFrame = () => {
        if (stopped) return;
        const elapsed = Math.max(0, sourceVid.currentTime - start);
        setExportProgress(Math.min(99, Math.round((elapsed / clipLen) * 100)));

        ctx.filter = cssFilterString;
        ctx.drawImage(sourceVid, 0, 0, outW, outH);
        drawOverlaysOnContext(ctx, outW, outH);

        if (sourceVid.currentTime >= end - 0.04 || sourceVid.ended) {
          finish();
          return;
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      rafId = requestAnimationFrame(drawFrame);
      // Hard safety guard so export never hangs forever
      setTimeout(finish, Math.ceil((clipLen + 3) * 1000));
    });

    if (recordedBlob.size < 1024) return selectedFile;
    return new File([recordedBlob], `jatt-edited-${Date.now()}.webm`, {
      type: 'video/webm',
    });
  };

  const handleSaveToDevice = async () => {
    if (!selectedFile) {
      onShowToast?.('Choose a photo or video first.');
      return;
    }
    setIsExporting(true);
    setExportProgress(5);
    try {
      const exportedFile =
        mediaType === 'image' ? await renderEditedPhotoFile() : await renderEditedVideoFile();
      const url = URL.createObjectURL(exportedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onShowToast?.(`Saved edited ${mediaType} to your device!`);
    } catch (err) {
      console.error('Export failed:', err);
      onShowToast?.('Could not export file. Saving original media instead.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handlePostToFeed = async () => {
    if (!selectedFile) {
      onShowToast?.('Choose a photo or video first.');
      return;
    }

    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast?.(
        `Anti-spam limit: Max 5 uploads per minute. Wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }

    setIsExporting(true);
    setExportProgress(5);

    try {
      const exportedFile =
        mediaType === 'image' ? await renderEditedPhotoFile() : await renderEditedVideoFile();

      recordRateLimitEvent('upload');

      const instantMediaUrl = URL.createObjectURL(exportedFile);
      const cleanTitle =
        sanitizeText(postTitle, 120) ||
        `Edited ${mediaType === 'image' ? 'Photo' : 'Reel'} (${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })})`;

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
      const hasAttachedAudio = Boolean(selectedAudioFile || selectedLibraryTrack);

      const instantSound: VideoPost['sound'] = selectedAudioFile
        ? {
            title: sanitizeText(selectedAudioFile.name.replace(/\.[^/.]+$/, ''), 80),
            artist: authorName,
            trackType: 'ambient_lofi',
            audioUrl: instantAudioUrl,
            category: 'song',
            originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
            bgAudioVolume: bgAudioVolume / 100,
            hasAttachedAudio: true,
          }
        : selectedLibraryTrack
        ? {
            title: selectedLibraryTrack.title,
            artist: selectedLibraryTrack.artist,
            trackType: selectedLibraryTrack.trackType,
            category: selectedLibraryTrack.category,
            originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
            bgAudioVolume: bgAudioVolume / 100,
            hasAttachedAudio: true,
          }
        : {
            title: `Original Sound - ${authorName}`,
            artist: authorName,
            trackType: 'tokyo_drift',
            category: mediaType === 'image' ? 'beat' : 'original',
            originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
            bgAudioVolume: mediaType === 'image' ? bgAudioVolume / 100 : 0,
            hasAttachedAudio: mediaType === 'image',
          };

      const tempPostId = `user-edit-${Date.now()}`;
      const optimisticPost: VideoPost = {
        id: tempPostId,
        title: cleanTitle,
        description: captionText,
        hashtags: tags.length ? tags : ['jattvibereels', 'edited', 'trending'],
        videoUrl: instantMediaUrl,
        posterUrl: mediaType === 'image' ? instantMediaUrl : undefined,
        fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
        category: 'trending',
        userId,
        mediaType,
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
            mediaType === 'image' ? await compressImageFile(exportedFile, 1080, 0.85) : exportedFile;

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
                mediaType,
                caption: captionText,
                allowDownload,
                sound: syncedSound,
              })
            : null;

          const finalSyncedPost: VideoPost = supabasePost
            ? {
                ...supabasePost,
                allowDownload,
                sound: syncedSound,
              }
            : {
                ...optimisticPost,
                videoUrl: finalMediaUrl,
                posterUrl: mediaType === 'image' ? finalMediaUrl : undefined,
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

      if (hasAttachedAudio) {
        onShowToast?.('Posted edited reel with music to Jatt VibeReels!');
      } else {
        onShowToast?.('Posted edited media to Jatt VibeReels!');
      }
    } catch (err) {
      console.error('Post failed:', err);
      onShowToast?.('Failed to publish edited media.');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const activeSticker = stickers.find((s) => s.id === activeStickerId) || null;

  return (
    <div
      className="fixed inset-0 z-55 bg-black/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <audio
        ref={previewAudioRef}
        src={selectedAudioPreviewUrl || undefined}
        onEnded={() => setPreviewingAudioId(null)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) loadMediaFile(f);
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        className="hidden"
        onChange={handlePickAudioFile}
      />

      <div
        className="w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-neutral-800 flex items-center justify-between gap-2 bg-neutral-900/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                Photo &amp; Video Editor
              </h2>
              <p className="text-[11px] text-neutral-400 truncate">
                Trim video, filters, text, stickers &amp; Punjabi music
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedFile && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Change Media</span>
                </button>
                <button
                  type="button"
                  onClick={resetAllEdits}
                  className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 cursor-pointer"
                  title="Reset edits"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!previewUrl ? (
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4">
            {editorError && (
              <div className="w-full max-w-md p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-semibold">
                {editorError}
              </div>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) loadMediaFile(dropped);
              }}
              className="w-full max-w-lg border-2 border-dashed border-neutral-700 hover:border-pink-500 rounded-3xl p-8 sm:p-10 bg-neutral-900/50 hover:bg-pink-950/10 transition-all cursor-pointer space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600/25 to-cyan-500/25 border border-pink-500/40 mx-auto flex items-center justify-center gap-1">
                <VideoIcon className="w-5 h-5 text-pink-400" />
                <ImageIcon className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-base font-black text-white">
                Select a Video or Photo to Edit
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Pick any video (.mp4, .webm) or photo (.jpg, .png, .webp) from your device to
                trim, apply filters, add text, stickers, and background songs.
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-black shadow-lg">
                <Upload className="w-4 h-4" />
                <span>Choose Video / Photo</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {/* Left / Top Live 9:16 Preview Stage */}
            <div className="w-full md:w-[340px] lg:w-[380px] bg-black p-3 sm:p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-neutral-800 shrink-0">
              <div className="relative w-full max-w-[230px] sm:max-w-[260px] aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex items-center justify-center">
                {mediaType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Edit preview"
                    style={{ filter: cssFilterString }}
                    className={`w-full h-full ${
                      photoFitMode === 'cover' ? 'object-cover' : 'object-contain'
                    } [transform:translate3d(0,0,0)]`}
                  />
                ) : (
                  <video
                    ref={previewVideoRef}
                    src={previewUrl}
                    preload="auto"
                    playsInline
                    autoPlay
                    loop
                    onLoadedMetadata={() => {
                      const vid = previewVideoRef.current;
                      if (!vid) return;
                      const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
                      setVideoDuration(dur);
                      setTrimStart(0);
                      setTrimEnd(dur);
                    }}
                    onTimeUpdate={() => {
                      const vid = previewVideoRef.current;
                      if (!vid) return;
                      if (trimEnd > trimStart + 0.2 && vid.currentTime >= trimEnd) {
                        vid.currentTime = trimStart;
                      }
                      setCurrentTime(vid.currentTime);
                    }}
                    style={{ filter: cssFilterString }}
                    className="w-full h-full object-contain [transform:translate3d(0,0,0)]"
                  />
                )}

                {/* Live Text Overlay Preview */}
                {overlayText.trim() && (
                  <div
                    style={{ top: `${textYPercent}%` }}
                    className="absolute left-3 right-3 -translate-y-1/2 flex justify-center pointer-events-none px-2"
                  >
                    <span
                      style={{
                        color: textColor,
                        fontSize: `${Math.max(12, Math.round(textSize * 0.65))}px`,
                      }}
                      className={`font-black text-center leading-tight px-3 py-1 rounded-xl max-w-full break-words ${
                        textBackdrop ? 'bg-black/65' : ''
                      }`}
                    >
                      {overlayText}
                    </span>
                  </div>
                )}

                {/* Live Stickers Preview */}
                {stickers.map((stk) => (
                  <button
                    key={stk.id}
                    type="button"
                    onClick={() => {
                      setActiveStickerId(stk.id);
                      setActiveTool('stickers');
                    }}
                    style={{
                      left: `${stk.xPercent}%`,
                      top: `${stk.yPercent}%`,
                      fontSize: `${Math.max(18, Math.round(stk.size * 0.68))}px`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 select-none cursor-pointer transition-transform ${
                      activeStickerId === stk.id ? 'ring-2 ring-cyan-400 rounded-lg scale-110' : ''
                    }`}
                  >
                    {stk.emoji}
                  </button>
                ))}

                {/* Attached Music Pill */}
                {(selectedAudioFile || selectedLibraryTrack) && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/80 border border-pink-500/45 flex items-center gap-1.5 pointer-events-none">
                    <Music className="w-3 h-3 text-pink-400 shrink-0" />
                    <span className="text-[10px] font-bold text-white truncate">
                      {selectedAudioFile
                        ? selectedAudioFile.name
                        : selectedLibraryTrack?.title}
                    </span>
                  </div>
                )}

                {/* Video Play/Pause Toggle */}
                {mediaType === 'video' && (
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center cursor-pointer"
                    aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Scrubber bar for video */}
              {mediaType === 'video' && videoDuration > 0 && (
                <div className="w-full max-w-[260px] mt-2.5 space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.05}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (previewVideoRef.current) previewVideoRef.current.currentTime = val;
                    }}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 tabular-nums">
                    <span>{formatSecLabel(currentTime)}</span>
                    <span>
                      Clip: {formatSecLabel(trimStart)} – {formatSecLabel(trimEnd || videoDuration)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right / Bottom Controls & Export Panel */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Tool Tabs */}
              <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-neutral-900/40 shrink-0">
                {(
                  [
                    { id: 'trim', label: mediaType === 'video' ? 'Trim' : 'Frame', icon: Scissors },
                    { id: 'filters', label: 'Filters', icon: Sliders },
                    { id: 'text', label: 'Text', icon: Type },
                    { id: 'stickers', label: 'Stickers', icon: Smile },
                    { id: 'music', label: 'Music', icon: Music },
                    { id: 'post', label: 'Post Info', icon: Sparkles },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTool === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTool(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-400/60 text-white shadow-sm'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tool Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {activeTool === 'trim' && (
                  <div className="space-y-4">
                    {mediaType === 'video' ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-white">Trim / Cut Video</h4>
                          <span className="text-[11px] text-cyan-300 font-bold tabular-nums">
                            Length: {formatSecLabel(Math.max(0, (trimEnd || videoDuration) - trimStart))}
                          </span>
                        </div>
                        <div className="space-y-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-neutral-300 font-semibold">Start Time</span>
                              <span className="text-pink-400 font-bold tabular-nums">
                                {trimStart.toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0.5, (trimEnd || videoDuration) - 0.5)}
                              step={0.1}
                              value={trimStart}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTrimStart(val);
                                if (previewVideoRef.current) previewVideoRef.current.currentTime = val;
                              }}
                              className="w-full accent-pink-500 cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-neutral-300 font-semibold">End Time</span>
                              <span className="text-cyan-400 font-bold tabular-nums">
                                {(trimEnd || videoDuration).toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={Math.min(videoDuration, trimStart + 0.5)}
                              max={Math.max(0.5, videoDuration)}
                              step={0.1}
                              value={trimEnd || videoDuration}
                              onChange={(e) => setTrimEnd(Number(e.target.value))}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[15, 30, 60].map((sec) =>
                            videoDuration > sec ? (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  setTrimStart(0);
                                  setTrimEnd(sec);
                                  if (previewVideoRef.current) previewVideoRef.current.currentTime = 0;
                                }}
                                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 cursor-pointer"
                              >
                                First {sec}s
                              </button>
                            ) : null
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTrimStart(0);
                              setTrimEnd(videoDuration);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-cyan-300 cursor-pointer"
                          >
                            Full Video
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-white">Photo Framing</h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPhotoFitMode('contain')}
                            className={`p-3 rounded-2xl border text-xs font-bold cursor-pointer ${
                              photoFitMode === 'contain'
                                ? 'bg-pink-600/20 border-pink-500 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            Original Full Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoFitMode('cover')}
                            className={`p-3 rounded-2xl border text-xs font-bold cursor-pointer ${
                              photoFitMode === 'cover'
                                ? 'bg-pink-600/20 border-pink-500 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            Full 9:16 Reel Crop
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTool === 'filters' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white">Filter Presets</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FILTER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            selectedPresetId === preset.id
                              ? 'bg-pink-600/25 border-pink-500 text-white'
                              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Brightness</span>
                          <span className="text-pink-400 font-bold tabular-nums">{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          value={brightness}
                          onChange={(e) => setBrightness(Number(e.target.value))}
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Contrast</span>
                          <span className="text-cyan-400 font-bold tabular-nums">{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={160}
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Saturation</span>
                          <span className="text-amber-400 font-bold tabular-nums">{saturate}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          value={saturate}
                          onChange={(e) => setSaturate(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'text' && (
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black text-white">Text Overlay</h4>
                    <input
                      type="text"
                      value={overlayText}
                      onChange={(e) => setOverlayText(sanitizeInputLive(e.target.value, 80))}
                      placeholder="Type text to show on your photo/video..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-pink-500"
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        {TEXT_COLOR_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setTextColor(hex)}
                            style={{ backgroundColor: hex }}
                            className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                              textColor === hex ? 'border-cyan-400 scale-110' : 'border-neutral-700'
                            }`}
                            aria-label={`Text color ${hex}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTextBackdrop((b) => !b)}
                        className={`px-3 py-1 rounded-xl border text-[11px] font-bold cursor-pointer ${
                          textBackdrop
                            ? 'bg-pink-600/20 border-pink-500 text-pink-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        {textBackdrop ? 'Backdrop: On' : 'Backdrop: Off'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Font Size</span>
                          <span className="text-pink-400 font-bold">{textSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={16}
                          max={48}
                          value={textSize}
                          onChange={(e) => setTextSize(Number(e.target.value))}
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold">Vertical Position</span>
                          <span className="text-cyan-400 font-bold">{textYPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={85}
                          value={textYPercent}
                          onChange={(e) => setTextYPercent(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'stickers' && (
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black text-white">Tap Sticker to Add</h4>
                    <div className="flex flex-wrap gap-2">
                      {STICKER_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddSticker(emoji)}
                          className="w-10 h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {activeSticker && (
                      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Editing Sticker: {activeSticker.emoji}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setStickers((prev) => prev.filter((s) => s.id !== activeSticker.id));
                              setActiveStickerId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-bold">Left/Right</span>
                            <input
                              type="range"
                              min={10}
                              max={90}
                              value={activeSticker.xPercent}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStickers((prev) =>
                                  prev.map((s) =>
                                    s.id === activeSticker.id ? { ...s, xPercent: val } : s
                                  )
                                );
                              }}
                              className="w-full accent-cyan-400"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-400 font-bold">Up/Down</span>
                            <input
                              type="range"
                              min={10}
                              max={90}
                              value={activeSticker.yPercent}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStickers((prev) =>
                                  prev.map((s) =>
                                    s.id === activeSticker.id ? { ...s, yPercent: val } : s
                                  )
                                );
                              }}
                              className="w-full accent-pink-500"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-400 font-bold">Size</span>
                            <input
                              type="range"
                              min={24}
                              max={92}
                              value={activeSticker.size}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setStickers((prev) =>
                                  prev.map((s) =>
                                    s.id === activeSticker.id ? { ...s, size: val } : s
                                  )
                                );
                              }}
                              className="w-full accent-amber-400"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTool === 'music' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-black text-white">Add Background Music / Naat</h4>
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FileAudio className="w-3.5 h-3.5" />
                        <span>Pick MP3/M4A</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={audioSearch}
                          onChange={(e) => setAudioSearch(sanitizeInputLive(e.target.value, 80))}
                          placeholder="Search Punjabi songs, naats, beats..."
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-pink-500"
                        />
                      </div>
                      <div className="flex gap-1 text-[10px] font-bold">
                        {(['all', 'song', 'naat', 'beat'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAudioCategory(cat)}
                            className={`px-2 py-1 rounded-lg border capitalize cursor-pointer ${
                              audioCategory === cat
                                ? 'bg-pink-600/25 border-pink-500 text-pink-200'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 no-scrollbar">
                      {filteredTracks.map((track) => {
                        const selected = selectedLibraryTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                              selected
                                ? 'bg-pink-600/20 border-pink-500'
                                : 'bg-neutral-900 border-neutral-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {track.artist} · {track.duration}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectLibraryTrack(track)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                selected
                                  ? 'bg-pink-600 text-white'
                                  : 'bg-neutral-800 text-neutral-200 hover:bg-pink-600'
                              }`}
                            >
                              {selected ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>{previewingAudioId === track.id ? 'Playing' : 'Selected'}</span>
                                </>
                              ) : (
                                <span>Use</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {mediaType === 'video' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-neutral-300 font-semibold flex items-center gap-1">
                              <Volume2 className="w-3 h-3 text-cyan-400" /> Video Volume
                            </span>
                            <span className="text-cyan-300 font-bold">{originalVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={originalVolume}
                            onChange={(e) => setOriginalVolume(Number(e.target.value))}
                            className="w-full accent-cyan-400"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-300 font-semibold flex items-center gap-1">
                            <Music className="w-3 h-3 text-pink-400" /> Music Volume
                          </span>
                          <span className="text-pink-300 font-bold">{bgAudioVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={bgAudioVolume}
                          onChange={(e) => setBgAudioVolume(Number(e.target.value))}
                          className="w-full accent-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                        onChange={(e) => setHashtagsStr(sanitizeHashtagsInput(e.target.value, 180))}
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
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
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
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                            !allowDownload
                              ? 'bg-rose-500/15 border-rose-400 text-rose-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>No, Keep Private</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Export Actions */}
              <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-900/70 space-y-2 shrink-0">
                {isExporting && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-cyan-300">
                      <span>Rendering edited {mediaType}...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-cyan-400 transition-all"
                        style={{ width: `${Math.max(8, exportProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleSaveToDevice}
                    className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-cyan-300 border border-cyan-500/40 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save to Device</span>
                  </button>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handlePostToFeed}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Post to Jatt VibeReels</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

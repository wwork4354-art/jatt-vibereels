import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  SwitchCamera,
  Sparkles,
  Moon,
  Zap,
  Grid,
  Volume2,
  Video,
  Upload,
  Film,
  Flame,
  RotateCcw,
  Square,
  Image as ImageIcon,
  Download,
  Check,
  Music,
  Play,
  Pause,
  Send,
  Clock,
  Search,
  CheckCircle2,
  Lock,
  Aperture,
  Gauge,
  Layers,
} from 'lucide-react';
import {
  VideoPost,
  UserAccount,
  CreatorProfileData,
  AudioTrackOption,
  LiveStoryItem,
  DirectSnapMessage,
  DirectSnapRecipient,
} from '../types';
import { soundEngine } from '../utils/soundEngine';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  getOrCreateUserProfileId,
  saveLocalPostRecord,
  savePostAudioMeta,
  savePostPrivacyMeta,
} from '../lib/supabaseService';
import { publishLiveStory, sendDirectSnap } from '../lib/liveSnapService';
import { savePostForOffline } from '../lib/offlineMediaStore';
import { CURATED_AUDIO_LIBRARY } from '../data/audioLibrary';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import {
  sanitizeInputLive,
  sanitizeText,
  sanitizeHashtagsInput,
  sanitizeSearchQuery,
  validateSafeMediaFile,
  checkRateLimit,
  recordRateLimitEvent,
} from '../utils/security';

interface ProCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  creatorProfile?: CreatorProfileData;
  directRecipients?: DirectSnapRecipient[];
  initialSnapRecipient?: DirectSnapRecipient | null;
  onPostLiveStory?: (story: LiveStoryItem) => void;
  onDirectSnapSent?: (snap: DirectSnapMessage) => void;
  onRecordSuccess: (newPost: VideoPost) => void;
  onRecordSynced?: (tempId: string, syncedPost: VideoPost) => void;
  onCaptureToStudio?: (file: File) => void;
  onSwitchToUploadFile: () => void;
  onShowToast: (msg: string) => void;
}

import { getIsRamSaverMode } from '../lib/ramSaverMode';

type ResolutionFpsMode = '8K/60FPS' | '4K UHD/60FPS' | '1080p/120FPS' | '720p/60FPS';
type SonyProPresetId = 'sony_a1_8k' | 'sony_a9_120';

interface SonyProPresetConfig {
  id: SonyProPresetId;
  name: string;
  shortName: string;
  hudTag: string;
  targetResFps: ResolutionFpsMode;
  targetFps: number;
  cssGrade: string;
  shutterSpeed: string;
  aperture: string;
  baseIso: number;
  colorScience: string;
}

const SONY_PRO_PRESETS: Record<SonyProPresetId, SonyProPresetConfig> = {
  sony_a1_8k: {
    id: 'sony_a1_8k',
    name: 'Sony A1 8K Cinema',
    shortName: 'Sony A1 8K',
    hudTag: '8K • 60FPS • S-CINETONE',
    targetResFps: '8K/60FPS',
    targetFps: 60,
    cssGrade: 'contrast(1.16) saturate(1.14) brightness(1.02) hue-rotate(-3deg)',
    shutterSpeed: '1/120',
    aperture: 'F1.4 GM',
    baseIso: 400,
    colorScience: 'S-CINETONE',
  },
  sony_a9_120: {
    id: 'sony_a9_120',
    name: 'Sony A9 III 120fps Action',
    shortName: 'A9 III 120fps',
    hudTag: '4K • 120FPS • S-CINETONE',
    targetResFps: '1080p/120FPS',
    targetFps: 120,
    cssGrade: 'contrast(1.22) saturate(1.18) brightness(1.03)',
    shutterSpeed: '1/1000',
    aperture: 'F2.8 GM',
    baseIso: 800,
    colorScience: 'GLOBAL S-CINE',
  },
};

interface BurstFrameItem {
  id: string;
  index: number;
  url: string;
  blob: Blob;
  sharpnessScore: number;
  timestampMs: number;
}

// Fast 3x3 micro-contrast unsharp clarity pass for crisp 8K photo & burst exports
function applyCrispSharpnessKernel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.34
): void {
  if (width < 4 || height < 4 || width * height > 4_800_000) return;
  try {
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
    // ignore memory-constrained devices cleanly
  }
}

// Fast edge-contrast score on tiny downsample to auto-rank sharpest 120fps burst shot
function computeFastSharpnessScore(sourceCanvas: HTMLCanvasElement): number {
  try {
    const probeW = 64;
    const probeH = 64;
    const probe = document.createElement('canvas');
    probe.width = probeW;
    probe.height = probeH;
    const pCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!pCtx) return 0;
    pCtx.drawImage(sourceCanvas, 0, 0, probeW, probeH);
    const data = pCtx.getImageData(0, 0, probeW, probeH).data;
    let totalDiff = 0;
    for (let y = 1; y < probeH - 1; y++) {
      for (let x = 1; x < probeW - 1; x++) {
        const i = (y * probeW + x) * 4;
        const r = (y * probeW + x + 1) * 4;
        const d = ((y + 1) * probeW + x) * 4;
        const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        const lumR = data[r] * 0.3 + data[r + 1] * 0.59 + data[r + 2] * 0.11;
        const lumD = data[d] * 0.3 + data[d + 1] * 0.59 + data[d + 2] * 0.11;
        totalDiff += Math.abs(lum - lumR) + Math.abs(lum - lumD);
      }
    }
    return Math.round(totalDiff);
  } catch {
    return 0;
  }
}

export interface CameraFilterDef {
  id: string;
  name: string;
  shortLabel: string;
  cssFilter: string;
  swatchClass: string;
  drawOverlay?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export const CAMERA_FILTERS: CameraFilterDef[] = [
  {
    id: 'natural',
    name: 'Natural',
    shortLabel: 'Natural',
    cssFilter: 'none',
    swatchClass: 'from-neutral-700 to-neutral-900',
  },
  {
    id: 'vivid_hd',
    name: 'Vivid HD',
    shortLabel: 'Vivid HD',
    cssFilter: 'saturate(1.48) contrast(1.12) brightness(1.04)',
    swatchClass: 'from-pink-500 via-rose-500 to-cyan-400',
  },
  {
    id: 'cinema_pro',
    name: 'Cinema Pro',
    shortLabel: 'Cinema Pro',
    cssFilter: 'contrast(1.18) saturate(1.12) brightness(0.97) hue-rotate(-4deg)',
    swatchClass: 'from-cyan-500 via-slate-700 to-amber-500',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'golden_glow',
    name: 'Golden Glow',
    shortLabel: 'Golden Glow',
    cssFilter: 'sepia(0.22) saturate(1.34) brightness(1.06) contrast(1.04) hue-rotate(-6deg)',
    swatchClass: 'from-amber-300 via-orange-500 to-rose-500',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'soft_beauty',
    name: 'Soft Beauty',
    shortLabel: 'Soft Beauty',
    cssFilter: 'brightness(1.08) contrast(0.96) saturate(1.15)',
    swatchClass: 'from-rose-200 via-pink-400 to-fuchsia-400',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(244, 114, 182, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'dark_moody',
    name: 'Dark Moody',
    shortLabel: 'Dark Moody',
    cssFilter: 'contrast(1.26) brightness(0.9) saturate(0.84)',
    swatchClass: 'from-slate-800 via-indigo-950 to-black',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'black_white',
    name: 'Black & White',
    shortLabel: 'B&W',
    cssFilter: 'grayscale(1) contrast(1.28) brightness(1.02)',
    swatchClass: 'from-zinc-100 via-zinc-500 to-black',
  },
];

function getSupportedRecorderOptions(highBitrate = true): MediaRecorderOptions {
  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  const videoBitsPerSecond = highBitrate ? 45_000_000 : 28_000_000;

  for (const mimeType of mimeCandidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond,
        audioBitsPerSecond: 192_000,
      };
    }
  }
  return {
    videoBitsPerSecond: 20_000_000,
    audioBitsPerSecond: 192_000,
  };
}

export const ProCameraModal: React.FC<ProCameraModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  creatorProfile,
  directRecipients = [],
  initialSnapRecipient = null,
  onPostLiveStory,
  onDirectSnapSent,
  onRecordSuccess,
  onRecordSynced,
  onCaptureToStudio,
  onSwitchToUploadFile,
  onShowToast,
}) => {
  // Sony A1 / A9 III Pro Cinema Engine State
  const [sonyPreset, setSonyPreset] = useState<SonyProPresetId>('sony_a1_8k');
  const [resFps, setResFps] = useState<ResolutionFpsMode>('8K/60FPS');
  const [streamInfoLabel, setStreamInfoLabel] = useState<string>('4K/8K · 60fps');
  const [isHighFpsActive, setIsHighFpsActive] = useState<boolean>(true);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('natural');
  const [nightModeLevel, setNightModeLevel] = useState<number>(0); // 0 = off, 1 = 1.5x, 2 = 3.0x
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSimulatedFeed, setIsSimulatedFeed] = useState<boolean>(false);
  const [cameraBlockedInWebView, setCameraBlockedInWebView] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const hasInitializedOnceRef = useRef<boolean>(false);
  const cameraDeviceCacheRef = useRef<{ user?: string; environment?: string }>({});
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);

  // 120fps Burst Shot State
  const [isBurstCapturing, setIsBurstCapturing] = useState<boolean>(false);
  const [burstProgressCount, setBurstProgressCount] = useState<number>(0);
  const [burstFrames, setBurstFrames] = useState<BurstFrameItem[]>([]);
  const [selectedBurstIndex, setSelectedBurstIndex] = useState<number>(0);
  const [bestBurstFrameId, setBestBurstFrameId] = useState<string | null>(null);
  const [isCompilingBurstReel, setIsCompilingBurstReel] = useState<boolean>(false);
  const [isExportingUltraSharp, setIsExportingUltraSharp] = useState<boolean>(false);

  // Recording & Capture State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedClipUrl, setRecordedClipUrl] = useState<string | null>(null);
  const [recordedMediaType, setRecordedMediaType] = useState<'video' | 'image'>('video');
  const [isSavedToGallery, setIsSavedToGallery] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [allowDownload, setAllowDownload] = useState<boolean>(true);

  // Live Snap & Direct Send State
  const [isSnapSendSheetOpen, setIsSnapSendSheetOpen] = useState<boolean>(false);
  const [isSendingSnap, setIsSendingSnap] = useState<boolean>(false);
  const [snapFriendSearch, setSnapFriendSearch] = useState<string>('');
  const [sentRecipientIds, setSentRecipientIds] = useState<string[]>([]);

  // Post-recording caption & song form
  const [clipTitle, setClipTitle] = useState('');
  const [clipHashtags, setClipHashtags] = useState('#JattVibe #SonyA1Cinema #SCinetone #4K60FPS');
  const [selectedMusicTrack, setSelectedMusicTrack] = useState<AudioTrackOption | null>(null);
  const [previewMusicId, setPreviewMusicId] = useState<string | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState<boolean>(false);
  const viewfinderTapRef = useRef<number>(0);

  // Refs for camera stream, canvas rendering, and MediaRecorder
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedMimeRef = useRef<string>('video/webm');
  const animFrameRef = useRef<number | null>(null);
  const videoFrameCbRef = useRef<number | null>(null);
  const recordingCanvasActiveRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const burstFramesRef = useRef<BurstFrameItem[]>([]);

  // Keep live filter & transform values in refs so on-demand recording never restarts
  const activeFilterRef = useRef<CameraFilterDef>(CAMERA_FILTERS[0]);
  const sonyPresetRef = useRef<SonyProPresetId>(sonyPreset);
  const nightModeRef = useRef<number>(nightModeLevel);
  const zoomRef = useRef<number>(zoomLevel);
  const facingRef = useRef<'user' | 'environment'>(facingMode);

  const activeSonyConfig = SONY_PRO_PRESETS[sonyPreset];
  const selectedFilter =
    CAMERA_FILTERS.find((f) => f.id === selectedFilterId) || CAMERA_FILTERS[0];

  useEffect(() => {
    activeFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    sonyPresetRef.current = sonyPreset;
  }, [sonyPreset]);

  useEffect(() => {
    nightModeRef.current = nightModeLevel;
  }, [nightModeLevel]);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    facingRef.current = facingMode;
  }, [facingMode]);

  const revokeBurstFrames = useCallback(() => {
    if (burstFramesRef.current.length > 0) {
      for (const frame of burstFramesRef.current) {
        if (frame.url.startsWith('blob:')) {
          URL.revokeObjectURL(frame.url);
        }
      }
      burstFramesRef.current = [];
    }
    setBurstFrames([]);
    setSelectedBurstIndex(0);
    setBestBurstFrameId(null);
  }, []);

  // Compute combined CSS filter string (Sony S-Cinetone / 8K Action LUT + Creative Filter + Night Mode)
  const buildCompositeFilter = useCallback(
    (filterDef: CameraFilterDef, night: number, presetId: SonyProPresetId = sonyPreset): string => {
      const parts: string[] = [];
      const presetCfg = SONY_PRO_PRESETS[presetId];
      if (presetCfg?.cssGrade) {
        parts.push(presetCfg.cssGrade);
      }
      if (filterDef.cssFilter && filterDef.cssFilter !== 'none') {
        parts.push(filterDef.cssFilter);
      }
      if (night === 1) {
        parts.push('brightness(1.32) contrast(1.12)');
      } else if (night === 2) {
        parts.push('brightness(1.65) contrast(1.25) saturate(1.15)');
      }
      return parts.length > 0 ? parts.join(' ') : 'none';
    },
    [sonyPreset]
  );

  const dispatchCaptureToStudio = useCallback(
    (blobOrFile: Blob | File, mediaType: 'image' | 'video'): boolean => {
      if (initialSnapRecipient || !onCaptureToStudio) return false;

      let readyFile: File;
      if (blobOrFile instanceof File) {
        readyFile = blobOrFile;
      } else {
        const rawMime = (blobOrFile.type || '').toLowerCase();
        const ext =
          mediaType === 'image'
            ? rawMime.includes('png')
              ? 'png'
              : rawMime.includes('webp')
              ? 'webp'
              : 'jpg'
            : rawMime.includes('mp4')
            ? 'mp4'
            : 'webm';
        const safeMime =
          mediaType === 'image'
            ? ext === 'png'
              ? 'image/png'
              : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg'
            : ext === 'mp4'
            ? 'video/mp4'
            : 'video/webm';
        readyFile = new File([blobOrFile], `camera-${mediaType}-${Date.now()}.${ext}`, {
          type: safeMime,
        });
      }

      soundEngine.stopPreviewTrack();
      setPreviewMusicId(null);
      onShowToast('Opening capture in Edit (Studio)...');
      onCaptureToStudio(readyFile);
      return true;
    },
    [initialSnapRecipient, onCaptureToStudio, onShowToast]
  );

  // Fallback native camera capture handler
  const handleNativeCameraCaptured = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const check = validateSafeMediaFile(file);
      if (!check.valid) {
        onShowToast(check.reason || 'Security Alert: Only .mp4, .webm, .jpg, .png, .webp allowed.');
        e.target.value = '';
        return;
      }
      const detectedType: 'image' | 'video' =
        check.mediaType || (file.type.startsWith('image/') ? 'image' : 'video');
      if (dispatchCaptureToStudio(file, detectedType)) {
        e.target.value = '';
        return;
      }
      const url = URL.createObjectURL(file);
      recordedBlobRef.current = file;
      setRecordedMediaType(detectedType);
      setRecordedClipUrl(url);
      const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const cleanName = sanitizeText(rawName, 80);
      setClipTitle(cleanName || `HD Mobile Reel #${Math.floor(Math.random() * 900 + 100)}`);
      onShowToast('Captured from phone camera! Preview & publish below.');
    }
    e.target.value = '';
  };

  // Release cached audio track on full unmount
  useEffect(() => {
    return () => {
      if (audioTrackRef.current) {
        try {
          audioTrackRef.current.stop();
        } catch {
          // ignore
        }
        audioTrackRef.current = null;
      }
    };
  }, []);

  // Fast camera acquisition + instant front/back lens switching (caches deviceIds & reuses mic track)
  useEffect(() => {
    if (!isOpen) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioTrackRef.current) {
        try {
          audioTrackRef.current.stop();
        } catch {
          // ignore
        }
        audioTrackRef.current = null;
      }
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      hasInitializedOnceRef.current = false;
      setIsRecording(false);
      setRecordingSeconds(0);
      setRecordedClipUrl((prevUrl) => {
        if (prevUrl && prevUrl.startsWith('blob:')) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
      setIsSavedToGallery(false);
      setIsSnapSendSheetOpen(false);
      setSentRecipientIds([]);
      setSnapFriendSearch('');
      setIsBurstCapturing(false);
      setBurstProgressCount(0);
      revokeBurstFrames();
      recordedBlobRef.current = null;
      setCameraBlockedInWebView(false);
      setIsCameraReady(false);
      return;
    }

    let isMounted = true;
    if (!hasInitializedOnceRef.current) {
      setIsCameraReady(false);
    }

    async function cacheAvailableCameras(activeTrack?: MediaStreamTrack) {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        if (activeTrack) {
          const settings = activeTrack.getSettings();
          if (settings.deviceId) {
            cameraDeviceCacheRef.current[facingMode] = settings.deviceId;
          }
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
        for (const dev of videoInputs) {
          const label = (dev.label || '').toLowerCase();
          if (!cameraDeviceCacheRef.current.user && /(front|user|selfie|facetime)/.test(label)) {
            cameraDeviceCacheRef.current.user = dev.deviceId;
          } else if (
            !cameraDeviceCacheRef.current.environment &&
            /(back|rear|environment|world|main)/.test(label)
          ) {
            cameraDeviceCacheRef.current.environment = dev.deviceId;
          }
        }
        // Fallback: if 2+ cameras exist and one side is still unmapped, assign the other distinct ID
        if (videoInputs.length >= 2) {
          const activeId = activeTrack?.getSettings().deviceId;
          const otherDev = videoInputs.find((d) => d.deviceId !== activeId);
          if (otherDev) {
            const oppositeSide = facingMode === 'user' ? 'environment' : 'user';
            if (!cameraDeviceCacheRef.current[oppositeSide]) {
              cameraDeviceCacheRef.current[oppositeSide] = otherDev.deviceId;
            }
          }
        }
      } catch {
        // ignore enumerateDevices permission edge cases
      }
    }

    async function acquireBestCameraStream(): Promise<MediaStream> {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Live mediaDevices.getUserMedia not supported');
      }

      const audioHighQuality: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const want120Fps = resFps === '1080p/120FPS' || sonyPreset === 'sony_a9_120';
      const wantW =
        resFps === '8K/60FPS' || resFps === '4K UHD/60FPS'
          ? 3840
          : resFps === '1080p/120FPS'
          ? 1920
          : 1280;
      const wantH =
        resFps === '8K/60FPS' || resFps === '4K UHD/60FPS'
          ? 2160
          : resFps === '1080p/120FPS'
          ? 1080
          : 720;
      const targetFps = want120Fps ? 120 : 60;

      const hasLiveAudio = Boolean(audioTrackRef.current && audioTrackRef.current.readyState === 'live');
      const cachedDeviceId = cameraDeviceCacheRef.current[facingMode];

      const primaryVideo: MediaTrackConstraints = {
        ...(cachedDeviceId
          ? { deviceId: { exact: cachedDeviceId } }
          : { facingMode: { ideal: facingMode } }),
        width: { ideal: wantW, max: 3840 },
        height: { ideal: wantH, max: 2160 },
        frameRate: { ideal: targetFps },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: primaryVideo,
          audio: hasLiveAudio ? false : audioHighQuality,
        });
      } catch {
        // Clear potentially stale cached deviceId and do one fast fallback without audio lock
        if (cachedDeviceId) {
          delete cameraDeviceCacheRef.current[facingMode];
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 60 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      const freshAudio = stream.getAudioTracks()[0];
      if (freshAudio && freshAudio.readyState === 'live') {
        audioTrackRef.current = freshAudio;
      } else if (audioTrackRef.current && audioTrackRef.current.readyState === 'live') {
        stream.addTrack(audioTrackRef.current);
      }

      return stream;
    }

    async function setupCamera() {
      // Stop only previous VIDEO tracks before opening new lens; keep live audio track intact for zero-lag flips
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getVideoTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        mediaStreamRef.current = null;
      }

      try {
        const stream = await acquireBestCameraStream();
        if (!isMounted) {
          stream.getVideoTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const w = settings.width || 1280;
          const h = settings.height || 720;
          const fps = Math.round(settings.frameRate || 60);
          setIsHighFpsActive(fps >= 45);
          setStreamInfoLabel(`${w}x${h} · ${fps}fps`);
          void cacheAvailableCameras(videoTrack);
        }

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(() => {});
        }
        setIsCameraReady(true);
        hasInitializedOnceRef.current = true;
        setIsSimulatedFeed(false);
        setCameraBlockedInWebView(false);
      } catch (err) {
        console.warn('Live camera access blocked or unavailable:', err);
        if (isMounted) {
          setIsSimulatedFeed(true);
          setCameraBlockedInWebView(true);
          onShowToast('Live camera blocked. Tap "Open Phone Camera" below to record.');
        }
      }
    }

    void setupCamera();

    return () => {
      isMounted = false;
      if (mediaStreamRef.current) {
        // Only stop video tracks during lens/FPS switches; mic audio is released on !isOpen or unmount
        mediaStreamRef.current.getVideoTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, facingMode, resFps, sonyPreset, onShowToast, revokeBurstFrames]);

  // Draw one S-Cinetone/filtered/mirrored/zoomed frame onto offscreen canvas
  const drawVideoFrameToCanvas = useCallback(
    (maxDim = 1920, applySharpness = false): boolean => {
      const video = videoPreviewRef.current;
      const canvas = canvasPreviewRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return false;
      }

      const rawW = video.videoWidth;
      const rawH = video.videoHeight;
      const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
      const targetW = Math.max(2, Math.round(rawW * scale));
      const targetH = Math.max(2, Math.round(rawH * scale));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvasCtxRef.current = null;
      }

      if (!canvasCtxRef.current) {
        canvasCtxRef.current = canvas.getContext('2d', {
          alpha: false,
          desynchronized: true,
          willReadFrequently: applySharpness,
        } as CanvasRenderingContext2DSettings);
      }
      const ctx = canvasCtxRef.current;
      if (!ctx) return false;

      const filterDef = activeFilterRef.current;
      const compositeFilter = buildCompositeFilter(
        filterDef,
        nightModeRef.current,
        sonyPresetRef.current
      );
      const zoom = Math.max(1, zoomRef.current);

      ctx.save();
      if ('filter' in ctx) {
        ctx.filter = compositeFilter;
      }

      if (facingRef.current === 'user') {
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
      }

      const srcW = rawW / zoom;
      const srcH = rawH / zoom;
      const srcX = (rawW - srcW) / 2;
      const srcY = (rawH - srcH) / 2;

      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
      ctx.restore();

      if ('filter' in ctx) {
        ctx.filter = 'none';
      }

      // Sony S-Cinetone subtle warm midtone / deep shadow roll-off glaze
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle =
        sonyPresetRef.current === 'sony_a9_120'
          ? 'rgba(56, 189, 248, 0.06)'
          : 'rgba(251, 191, 36, 0.05)';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.restore();

      if (filterDef.drawOverlay) {
        filterDef.drawOverlay(ctx, targetW, targetH);
      }

      if (applySharpness) {
        applyCrispSharpnessKernel(ctx, targetW, targetH, 0.34);
      }

      return true;
    },
    [buildCompositeFilter]
  );

  // Stop any on-demand recording canvas frame pump immediately
  const stopRecordingFramePump = useCallback(() => {
    recordingCanvasActiveRef.current = false;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const video = videoPreviewRef.current as (HTMLVideoElement & {
      cancelVideoFrameCallback?: (handle: number) => void;
    }) | null;
    if (video && videoFrameCbRef.current !== null && typeof video.cancelVideoFrameCallback === 'function') {
      try {
        video.cancelVideoFrameCallback(videoFrameCbRef.current);
      } catch {
        // ignore
      }
      videoFrameCbRef.current = null;
    }
  }, []);

  // Start on-demand recording-only canvas pump (720p on 3GB RAM Saver, 1080p S-Cinetone otherwise)
  const startRecordingFramePump = useCallback(() => {
    stopRecordingFramePump();
    recordingCanvasActiveRef.current = true;
    const bakeMaxDim = getIsRamSaverMode() ? 720 : 1080;

    const video = videoPreviewRef.current as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    }) | null;

    if (video && typeof video.requestVideoFrameCallback === 'function') {
      const onVideoFrame = () => {
        if (!recordingCanvasActiveRef.current) return;
        drawVideoFrameToCanvas(bakeMaxDim, false);
        videoFrameCbRef.current = video.requestVideoFrameCallback!(onVideoFrame);
      };
      drawVideoFrameToCanvas(bakeMaxDim, false);
      videoFrameCbRef.current = video.requestVideoFrameCallback(onVideoFrame);
      return;
    }

    const onRaf = () => {
      if (!recordingCanvasActiveRef.current) return;
      drawVideoFrameToCanvas(bakeMaxDim, false);
      animFrameRef.current = requestAnimationFrame(onRaf);
    };
    drawVideoFrameToCanvas(bakeMaxDim, false);
    animFrameRef.current = requestAnimationFrame(onRaf);
  }, [drawVideoFrameToCanvas, stopRecordingFramePump]);

  // Ensure frame pump & audio preview clean up on modal close
  useEffect(() => {
    if (!isOpen || recordedClipUrl) {
      stopRecordingFramePump();
    }
    if (!isOpen) {
      soundEngine.stopPreviewTrack();
      setPreviewMusicId(null);
      setSelectedMusicTrack(null);
      setShowMusicPicker(false);
    }
    return () => {
      stopRecordingFramePump();
      soundEngine.stopPreviewTrack();
    };
  }, [isOpen, recordedClipUrl, stopRecordingFramePump]);

  // Stop active MediaRecorder cleanly
  const handleStopRecording = useCallback(() => {
    soundEngine.playRecordBeep(false);
    setIsRecording(false);
    stopRecordingFramePump();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        return;
      } catch (err) {
        console.warn('MediaRecorder stop error:', err);
      }
    }

    // Fallback if recorder wasn't active (e.g. simulated feed)
    onShowToast('Please use "Open Phone Camera" when live camera access is blocked.');
  }, [onShowToast, stopRecordingFramePump]);

  // Recording Timer Tracker
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRecording, handleStopRecording]);

  // Start / Stop High-Bitrate MediaRecorder (zero-copy rawStream when Normal + 1x + back cam, on-demand 1080p canvas otherwise)
  const handleToggleRecord = () => {
    if (isSimulatedFeed) {
      nativeCameraInputRef.current?.click();
      return;
    }

    if (isRecording) {
      handleStopRecording();
      return;
    }

    const canvas = canvasPreviewRef.current;
    const rawStream = mediaStreamRef.current;

    if (!canvas || !rawStream) {
      onShowToast('Camera stream is still initializing...');
      return;
    }

    try {
      // Always bake Sony S-Cinetone / A9 III LUT grade + creative filters when canvas capture is available
      const needsCanvasBake = typeof canvas.captureStream === 'function';

      let combinedStream: MediaStream;
      if (!needsCanvasBake) {
        combinedStream = rawStream;
      } else {
        startRecordingFramePump();
        const targetCaptureFps = activeSonyConfig.targetFps >= 120 ? 60 : 60;
        const canvasStream = canvas.captureStream(targetCaptureFps);
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...rawStream.getAudioTracks(),
        ]);
      }

      const options = getSupportedRecorderOptions(true);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, options);
      } catch {
        recorder = new MediaRecorder(combinedStream);
      }

      recordedChunksRef.current = [];
      recordedMimeRef.current = recorder.mimeType || options.mimeType || 'video/webm';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopRecordingFramePump();
        const mime = recordedMimeRef.current || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size > 0) {
          if (dispatchCaptureToStudio(blob, 'video')) {
            return;
          }
          recordedBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setRecordedMediaType('video');
          setRecordedClipUrl(url);
          setClipTitle(
            `${activeSonyConfig.shortName} ${
              selectedFilter.name !== 'Natural' ? `${selectedFilter.shortLabel} ` : ''
            }Reel #${Math.floor(Math.random() * 900 + 100)}`
          );
          onShowToast(
            `Captured ${activeSonyConfig.name} (${streamInfoLabel} · ${activeSonyConfig.colorScience})!`
          );
        } else {
          onShowToast('No video data captured. Please try recording for at least 1 second.');
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      soundEngine.playRecordBeep(true);
      setIsRecording(true);
      setRecordingSeconds(0);
      onShowToast(`Recording ${activeSonyConfig.hudTag}...`);
    } catch (err) {
      stopRecordingFramePump();
      console.error('Failed to start MediaRecorder:', err);
      onShowToast('Live recording unsupported on this browser — opening native phone camera.');
      nativeCameraInputRef.current?.click();
    }
  };

  // Capture Filtered High-Res Sharp 8K Photo via single on-demand snapshot
  const handleCapturePhoto = () => {
    if (isSimulatedFeed) {
      nativeCameraInputRef.current?.click();
      return;
    }
    const maxSnapDim = getIsRamSaverMode() ? 1440 : 2160;
    const ok = drawVideoFrameToCanvas(maxSnapDim, true);
    const canvas = canvasPreviewRef.current;
    if (!ok || !canvas || canvas.width === 0) {
      onShowToast('Camera preview is still loading...');
      return;
    }

    soundEngine.playCameraShutter();
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onShowToast('Could not capture photo.');
          return;
        }
        if (dispatchCaptureToStudio(blob, 'image')) {
          return;
        }
        recordedBlobRef.current = blob;
        setRecordedMediaType('image');
        setRecordedClipUrl(URL.createObjectURL(blob));
        setClipTitle(
          `${activeSonyConfig.shortName} ${
            selectedFilter.name !== 'Natural' ? `${selectedFilter.shortLabel} ` : ''
          }Shot #${Math.floor(Math.random() * 900 + 100)}`
        );
        onShowToast(`Ultra-Sharp ${activeSonyConfig.colorScience} photo captured!`);
      },
      'image/jpeg',
      0.95
    );
  };

  // 120fps Burst Shot: captures rapid action frames over ~1 second so user can pick sharpest frame or make Action Reel
  const handleBurstShot = async () => {
    if (isSimulatedFeed) {
      nativeCameraInputRef.current?.click();
      return;
    }
    if (isRecording || isBurstCapturing) return;

    const video = videoPreviewRef.current;
    const canvas = canvasPreviewRef.current;
    if (!video || !canvas || video.readyState < 2) {
      onShowToast('Camera preview is still loading...');
      return;
    }

    revokeBurstFrames();
    setIsBurstCapturing(true);
    setBurstProgressCount(0);

    const targetFrames = getIsRamSaverMode() ? 10 : 14;
    const burstMaxDim = getIsRamSaverMode() ? 960 : 1280;
    const intervalMs = 68; // ~1s total burst capture
    const captured: BurstFrameItem[] = [];
    const startTs = performance.now();

    try {
      for (let i = 0; i < targetFrames; i++) {
        const ok = drawVideoFrameToCanvas(burstMaxDim, false);
        if (ok && canvas.width > 0) {
          const sharpnessScore = computeFastSharpnessScore(canvas);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
          );
          if (blob) {
            const url = URL.createObjectURL(blob);
            captured.push({
              id: `burst-${Date.now()}-${i}`,
              index: i,
              url,
              blob,
              sharpnessScore,
              timestampMs: Math.round(performance.now() - startTs),
            });
            setBurstProgressCount(captured.length);
            if (i % 3 === 0) {
              soundEngine.playCameraShutter();
            }
          }
        }
        if (i < targetFrames - 1) {
          await new Promise((r) => window.setTimeout(r, intervalMs));
        }
      }

      if (captured.length === 0) {
        onShowToast('Could not capture burst frames.');
        return;
      }

      // Auto-select the sharpest action frame
      let bestIdx = 0;
      let bestScore = -1;
      captured.forEach((f, idx) => {
        if (f.sharpnessScore > bestScore) {
          bestScore = f.sharpnessScore;
          bestIdx = idx;
        }
      });

      burstFramesRef.current = captured;
      setBurstFrames(captured);
      setSelectedBurstIndex(bestIdx);
      setBestBurstFrameId(captured[bestIdx].id);
      soundEngine.playDownloadComplete();
      onShowToast(
        `120fps Burst Shot complete (${captured.length} frames) — Frame #${bestIdx + 1} auto-picked as Sharpest!`
      );
    } finally {
      setIsBurstCapturing(false);
    }
  };

  // Promote chosen burst shot into Studio or preview screen
  const handleSelectBurstPhotoForPreview = () => {
    const chosen = burstFrames[selectedBurstIndex];
    if (!chosen) return;
    if (dispatchCaptureToStudio(chosen.blob, 'image')) {
      revokeBurstFrames();
      return;
    }
    recordedBlobRef.current = chosen.blob;
    setRecordedMediaType('image');
    setRecordedClipUrl(URL.createObjectURL(chosen.blob));
    setClipTitle(`${activeSonyConfig.shortName} Burst #${selectedBurstIndex + 1}`);
    revokeBurstFrames();
  };

  // Stitch captured 120fps burst frames into a fast punchy Action Reel video
  const handleCompileBurstActionReel = async () => {
    if (burstFrames.length < 2 || isCompilingBurstReel) return;
    const canvas = canvasPreviewRef.current;
    if (!canvas || typeof canvas.captureStream !== 'function') {
      onShowToast('Action Reel assembly is unavailable on this browser.');
      return;
    }

    setIsCompilingBurstReel(true);
    onShowToast('Assembling Sony A9 III Action Reel...');

    try {
      // Load burst frame ImageBitmaps / Images
      const loadedImgs = await Promise.all(
        burstFrames.map(
          (f) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = f.url;
            })
        )
      );

      const first = loadedImgs[0];
      const w = Math.min(1080, first.naturalWidth || 720);
      const h = Math.min(1920, first.naturalHeight || 1280);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D unavailable');

      const stream = canvas.captureStream(30);
      const options = getSupportedRecorderOptions(true);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chunks: Blob[] = [];
      const mime = recorder.mimeType || options.mimeType || 'video/webm';
      recordedMimeRef.current = mime;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stopPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      recorder.start(100);

      // Play rapid forward + boomerang sweep across 2 cycles (~1.6s action reel)
      const sequence = [...loadedImgs, ...[...loadedImgs].reverse(), ...loadedImgs];
      for (const img of sequence) {
        ctx.drawImage(img, 0, 0, w, h);
        await new Promise((r) => window.setTimeout(r, 52));
      }

      recorder.stop();
      const reelBlob = await stopPromise;
      if (reelBlob.size > 0) {
        if (dispatchCaptureToStudio(reelBlob, 'video')) {
          revokeBurstFrames();
          return;
        }
        recordedBlobRef.current = reelBlob;
        setRecordedMediaType('video');
        setRecordedClipUrl(URL.createObjectURL(reelBlob));
        setClipTitle(`${activeSonyConfig.shortName} Action Burst Reel`);
        revokeBurstFrames();
        soundEngine.playDownloadComplete();
        onShowToast('Fast Action Reel ready for Ultra-Sharp Export or Publish!');
      } else {
        onShowToast('Action Reel assembly produced empty clip.');
      }
    } catch (err) {
      console.warn('Burst Action Reel compile warning:', err);
      onShowToast('Could not compile Action Reel on this browser.');
    } finally {
      setIsCompilingBurstReel(false);
    }
  };

  // Switch Sony Pro Preset (Sony A1 8K Cinema vs Sony A9 III 120fps Action)
  const handleSelectSonyPreset = (presetId: SonyProPresetId) => {
    if (isRecording || isBurstCapturing) return;
    soundEngine.playCameraShutter();
    setSonyPreset(presetId);
    const cfg = SONY_PRO_PRESETS[presetId];
    setResFps(cfg.targetResFps);
    onShowToast(`${cfg.name} · ${cfg.hudTag}`);
  };


  // Switch Camera (Front / Back)
  const handleFlipCamera = () => {
    if (isRecording || isBurstCapturing) {
      onShowToast('Stop recording before switching camera.');
      return;
    }
    soundEngine.playCameraShutter();
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    onShowToast(`Switched Camera: ${nextMode === 'environment' ? 'Back (Rear)' : 'Front (Selfie)'}`);
  };

  // Cycle Resolution & FPS (8K/60FPS, 4K UHD/60FPS, 1080p/120FPS, 720p/60FPS)
  const handleCycleResFps = () => {
    if (isRecording || isBurstCapturing) return;
    soundEngine.playCameraShutter();
    const nextMode: ResolutionFpsMode =
      resFps === '8K/60FPS'
        ? '4K UHD/60FPS'
        : resFps === '4K UHD/60FPS'
        ? '1080p/120FPS'
        : resFps === '1080p/120FPS'
        ? '720p/60FPS'
        : '8K/60FPS';
    setResFps(nextMode);
    onShowToast(`Pro Camera Quality: ${nextMode}`);
  };

  // Cycle Night Mode Booster
  const handleCycleNightMode = () => {
    soundEngine.playCameraShutter();
    const next = (nightModeLevel + 1) % 3;
    setNightModeLevel(next);
    const labels = ['Night Mode: OFF', 'Night Mode: 1.5x Boost', 'Night Mode: 3.0x Max'];
    onShowToast(labels[next]);
  };

  // One-Tap Ultra-Sharp Export (applies 8K clarity polish for photos/burst frames & triggers crisp high-quality download)
  const handleUltraSharpExport = async (overrideBurstFrame?: BurstFrameItem) => {
    const targetUrl = overrideBurstFrame?.url || recordedClipUrl;
    const isPhoto = Boolean(overrideBurstFrame) || recordedMediaType === 'image';
    if (!targetUrl || isExportingUltraSharp) return;

    setIsExportingUltraSharp(true);
    const baseName = (
      clipTitle.trim() ||
      `JattVibeReels_${sonyPreset === 'sony_a1_8k' ? 'SonyA1_8K' : 'SonyA9III_120fps'}`
    )
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 48);

    try {
      let exportHref = targetUrl;
      let tempExportUrl: string | null = null;

      if (isPhoto) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = targetUrl;
        });

        const exportCanvas = document.createElement('canvas');
        const maxOut = getIsRamSaverMode() ? 1600 : 2560;
        const scale = Math.min(1, maxOut / Math.max(img.naturalWidth || 1280, img.naturalHeight || 720));
        const outW = Math.max(2, Math.round((img.naturalWidth || 1280) * scale));
        const outH = Math.max(2, Math.round((img.naturalHeight || 720) * scale));
        exportCanvas.width = outW;
        exportCanvas.height = outH;
        const eCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
        if (eCtx) {
          eCtx.drawImage(img, 0, 0, outW, outH);
          applyCrispSharpnessKernel(eCtx, outW, outH, 0.42);
          const crispBlob = await new Promise<Blob | null>((resolve) =>
            exportCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.96)
          );
          if (crispBlob) {
            tempExportUrl = URL.createObjectURL(crispBlob);
            exportHref = tempExportUrl;
          }
        }
      }

      const ext = isPhoto
        ? 'jpg'
        : recordedMimeRef.current.includes('mp4')
        ? 'mp4'
        : 'webm';
      const filename = `${baseName}_UltraSharp_${Date.now()}.${ext}`;

      const link = document.createElement('a');
      link.href = exportHref;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (tempExportUrl) {
        window.setTimeout(() => URL.revokeObjectURL(tempExportUrl!), 5000);
      }

      setIsSavedToGallery(true);
      soundEngine.playDownloadComplete();
      onShowToast(`Ultra-Sharp Export saved (${filename})!`);
    } catch (err) {
      console.error('Ultra-sharp export error:', err);
      onShowToast('Could not complete Ultra-Sharp Export.');
    } finally {
      setIsExportingUltraSharp(false);
    }
  };

  // Direct Save to Device Gallery / Storage using standard <a download> blob trigger
  const handleSaveToDeviceGallery = () => {
    if (!recordedClipUrl) return;

    const baseName = (clipTitle.trim() || 'JattVibeReels_Capture')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 48);

    const ext =
      recordedMediaType === 'image'
        ? 'jpg'
        : recordedMimeRef.current.includes('mp4')
        ? 'mp4'
        : 'webm';

    const filename = `${baseName}_${Date.now()}.${ext}`;

    try {
      const link = document.createElement('a');
      link.href = recordedClipUrl;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsSavedToGallery(true);
      soundEngine.playDownloadComplete();
      onShowToast(
        `Saved ${recordedMediaType === 'image' ? 'photo' : 'HD video'} (${filename}) to device gallery!`
      );
    } catch (err) {
      console.error('Failed to trigger gallery download:', err);
      onShowToast('Could not save directly on this browser.');
    }
  };

  // Publish newly captured video or photo optimistically (instant playback) + background cloud sync
  const handlePublishReel = () => {
    if (!recordedClipUrl || isPublishing) return;

    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast(
        `Anti-spam limit: Max 5 uploads per minute. Please wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }
    recordRateLimitEvent('upload');
    setIsPublishing(true);

    const userId = creatorProfile?.id || currentUser?.id || getOrCreateUserProfileId();
    const authorName =
      sanitizeText(currentUser?.name || creatorProfile?.name || 'Jatt Creator', 60) ||
      'Jatt Creator';
    const authorUsername = currentUser?.username || creatorProfile?.username || 'jatt_official';
    const authorAvatar =
      currentUser?.avatar ||
      creatorProfile?.avatar ||
      'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';
    const authorBio = sanitizeText(
      currentUser?.bio || creatorProfile?.bio || 'Jatt VibeReels Pro Creator',
      220
    );

    const cleanTitle =
      sanitizeText(clipTitle, 100) || `Shot with Jatt VibeReels (${selectedFilter.name})`;
    const safeHashtags = sanitizeText(clipHashtags, 200);
    const caption = sanitizeText(
      `${cleanTitle} (${streamInfoLabel} · ${selectedFilter.name}) ${safeHashtags}`,
      320
    );

    const capturedBlob = recordedBlobRef.current;
    const instantMediaUrl = capturedBlob ? URL.createObjectURL(capturedBlob) : recordedClipUrl;

    const resolvedSound: VideoPost['sound'] = selectedMusicTrack
      ? {
          title: selectedMusicTrack.title,
          artist: selectedMusicTrack.artist,
          trackType: selectedMusicTrack.trackType,
          category: selectedMusicTrack.category,
          originalVolume: recordedMediaType === 'video' ? 0.55 : 0,
          bgAudioVolume: 0.85,
          hasAttachedAudio: true,
        }
      : {
          title: recordedMediaType === 'image' ? 'Photo Studio Vibe' : 'Original HD Studio Audio',
          artist: authorName,
          trackType: 'future_bass',
          category: recordedMediaType === 'image' ? 'beat' : 'original',
          originalVolume: recordedMediaType === 'video' ? 1 : 0,
          bgAudioVolume: 0,
          hasAttachedAudio: false,
        };

    const tags = clipHashtags
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#/, '').trim())
      .filter(Boolean);

    const tempId = `pro-reel-${Date.now()}`;
    const pickedAllowDl = allowDownload;

    const optimisticPost: VideoPost = {
      id: tempId,
      title: cleanTitle,
      description: caption,
      hashtags: tags.length ? tags : ['JattVibe', '4K60FPS'],
      videoUrl: instantMediaUrl,
      posterUrl: recordedMediaType === 'image' ? instantMediaUrl : undefined,
      fallbackGradient: 'from-pink-900 via-purple-900 to-black',
      category: 'trending',
      userId,
      mediaType: recordedMediaType,
      allowDownload: pickedAllowDl,
      isUserUploaded: true,
      createdAt: new Date().toISOString(),
      creator: {
        name: authorName,
        username: authorUsername,
        avatar: authorAvatar,
        isVerified: true,
        isFollowing: false,
        bio: authorBio,
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
      sound: resolvedSound,
      commentsList: [],
    };

    soundEngine.stopPreviewTrack();
    savePostPrivacyMeta([tempId, instantMediaUrl], pickedAllowDl);
    savePostAudioMeta([tempId, instantMediaUrl], resolvedSound);
    saveLocalPostRecord(optimisticPost);
    onRecordSuccess(optimisticPost);
    soundEngine.playDownloadComplete();
    onShowToast(
      `Published ${recordedMediaType === 'image' ? 'photo' : '4K UHD video'} to feed!`
    );
    setIsPublishing(false);
    onClose();

    // Sync to Supabase Storage + DB in background without interrupting playback
    const isDeviceOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    void (async () => {
      try {
        let finalMediaUrl = instantMediaUrl;
        if (capturedBlob && isSupabaseConfigured && isDeviceOnline) {
          const ext =
            recordedMediaType === 'image'
              ? 'jpg'
              : recordedMimeRef.current.includes('mp4')
              ? 'mp4'
              : 'webm';
          const uploadedUrl = await uploadMediaToReelsBucket(
            capturedBlob,
            'posts',
            `camera-${Date.now()}.${ext}`
          );
          if (uploadedUrl) {
            finalMediaUrl = uploadedUrl;
          }
        }

        const supabasePost = isDeviceOnline
          ? await createGlobalPostInSupabase({
              userId,
              username: authorUsername,
              displayName: authorName,
              avatarUrl: authorAvatar,
              mediaUrl: finalMediaUrl,
              mediaType: recordedMediaType,
              caption,
              allowDownload: pickedAllowDl,
              sound: resolvedSound,
            })
          : null;

        const finalSynced: VideoPost = supabasePost
          ? {
              ...supabasePost,
              allowDownload: pickedAllowDl,
              sound: resolvedSound,
            }
          : {
              ...optimisticPost,
              videoUrl: finalMediaUrl,
              posterUrl: recordedMediaType === 'image' ? finalMediaUrl : undefined,
            };

        savePostPrivacyMeta([finalSynced.id, finalMediaUrl, tempId], pickedAllowDl);
        savePostAudioMeta([finalSynced.id, finalMediaUrl], resolvedSound);
        saveLocalPostRecord(finalSynced);
        await savePostForOffline(finalSynced, {
          mediaBlob: capturedBlob || undefined,
          sourceType: 'recorded',
          skipRemoteFetch: true,
        });
        onRecordSynced?.(tempId, finalSynced);
      } catch (err) {
        console.warn('ProCamera background sync warning:', err);
      }
    })();
  };

  // Post recorded snap to 24-Hour Live Stories Bar
  const handlePostToLiveStories = async () => {
    if (!recordedClipUrl || isSendingSnap) return;
    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast(
        `Anti-spam limit: Max 5 uploads per minute. Please wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }
    recordRateLimitEvent('upload');
    setIsSendingSnap(true);
    try {
      const senderId = currentUser?.id || creatorProfile?.id || getOrCreateUserProfileId();
      const senderName =
        sanitizeText(currentUser?.name || creatorProfile?.name || 'Jatt Creator', 60) ||
        'Jatt Creator';
      const senderUsername = currentUser?.username || creatorProfile?.username || 'jatt_official';
      const senderAvatar =
        currentUser?.avatar ||
        creatorProfile?.avatar ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';

      const safeCaption = sanitizeText(clipTitle, 120);
      const createdStory = await publishLiveStory({
        userId: senderId,
        username: senderUsername,
        displayName: senderName,
        avatarUrl: senderAvatar,
        mediaBlob: recordedBlobRef.current,
        fallbackMediaUrl: recordedClipUrl,
        mediaType: recordedMediaType,
        caption: safeCaption || undefined,
        filterName: selectedFilter.name,
      });

      onPostLiveStory?.(createdStory);
      soundEngine.playDownloadComplete();
      onShowToast('Live Snap added to your 24-Hour Live Stories!');
      setIsSnapSendSheetOpen(false);
      onClose();
    } catch {
      onShowToast('Could not post Live Story. Please try again.');
    } finally {
      setIsSendingSnap(false);
    }
  };

  // Direct Send live snap privately to a selected friend/user
  const handleDirectSendToFriend = async (recipient: DirectSnapRecipient) => {
    if (!recordedClipUrl || isSendingSnap) return;
    const rateStatus = checkRateLimit('upload');
    if (!rateStatus.allowed) {
      onShowToast(
        `Anti-spam limit: Max 5 uploads per minute. Please wait ${rateStatus.retryAfterSeconds}s.`
      );
      return;
    }
    recordRateLimitEvent('upload');
    setIsSendingSnap(true);
    try {
      const senderId = currentUser?.id || creatorProfile?.id || getOrCreateUserProfileId();
      const senderName =
        sanitizeText(currentUser?.name || creatorProfile?.name || 'Jatt Creator', 60) ||
        'Jatt Creator';
      const senderUsername = currentUser?.username || creatorProfile?.username || 'jatt_official';
      const senderAvatar =
        currentUser?.avatar ||
        creatorProfile?.avatar ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';

      const safeCaption = sanitizeText(clipTitle, 120);
      const sentMsg = await sendDirectSnap({
        sender: {
          id: senderId,
          name: senderName,
          username: senderUsername,
          avatar: senderAvatar,
        },
        recipient,
        mediaBlob: recordedBlobRef.current,
        fallbackMediaUrl: recordedClipUrl,
        mediaType: recordedMediaType,
        caption: safeCaption || undefined,
        filterName: selectedFilter.name,
      });

      onDirectSnapSent?.(sentMsg);
      setSentRecipientIds((prev) => Array.from(new Set([...prev, recipient.username])));
      soundEngine.playDownloadComplete();
      onShowToast(`Live Snap sent directly to @${recipient.username}!`);
    } catch {
      onShowToast('Failed to send Direct Snap.');
    } finally {
      setIsSendingSnap(false);
    }
  };

  if (!isOpen) return null;

  const filteredDirectRecipients = (() => {
    const combined = [...directRecipients];
    if (
      initialSnapRecipient &&
      !combined.some(
        (r) => r.username.toLowerCase() === initialSnapRecipient.username.toLowerCase()
      )
    ) {
      combined.unshift(initialSnapRecipient);
    }
    const q = snapFriendSearch.trim().toLowerCase().replace(/^@+/, '');
    const list = !q
      ? combined
      : combined.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.username.toLowerCase().includes(q)
        );
    if (initialSnapRecipient) {
      return [...list].sort((a, b) => {
        const aTarget = a.username.toLowerCase() === initialSnapRecipient.username.toLowerCase();
        const bTarget = b.username.toLowerCase() === initialSnapRecipient.username.toLowerCase();
        if (aTarget === bTarget) return 0;
        return aTarget ? -1 : 1;
      });
    }
    return list;
  })();

  const formattedTimer = `00:${recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}`;
  const activeCanvasFallbackFilter = buildCompositeFilter(selectedFilter, nightModeLevel, sonyPreset);
  const liveIsoValue = nightModeLevel === 0 ? activeSonyConfig.baseIso : nightModeLevel === 1 ? 1600 : 6400;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none [transform:translateZ(0)]">
      {/* Offscreen canvas used strictly on-demand for photo snapshots or filtered video baking */}
      <canvas ref={canvasPreviewRef} className="hidden" />

      {/* Fallback Native Camera Input for restricted WebViews */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraCaptured}
      />

      {/* Flash / Studio Ring Light Overlay */}
      {isFlashOn && (
        <div className="absolute inset-0 pointer-events-none z-40 bg-radial from-amber-100/25 via-white/10 to-transparent mix-blend-screen" />
      )}

      {/* TOP PRO STATUS BAR + SONY A1 / A9 III ENGINE SWITCHER */}
      <div className="relative z-30 px-3 sm:px-4 pt-2.5 pb-1.5 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center border border-white/15 transition-all active:scale-95 cursor-pointer"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToUploadFile();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-xs font-bold text-neutral-300 hover:text-white border border-neutral-700/80 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-pink-400" />
              <span>Upload File</span>
            </button>
          </div>

          {/* Center: Resolution/FPS Cycle + Night Booster */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCycleResFps}
              className="min-h-[38px] px-3 py-1.5 rounded-full bg-neutral-900/95 hover:bg-neutral-800 border border-cyan-500/50 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg shadow-cyan-500/15 active:scale-95 transition-transform cursor-pointer tabular-nums"
              title="Tap to cycle 8K/60FPS, 4K UHD/60FPS, 1080p/120FPS, 720p/60FPS"
            >
              <Aperture className={`w-3.5 h-3.5 ${isHighFpsActive ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span className="tracking-wide">{isSimulatedFeed ? resFps : `${resFps.split('/')[0]} · ${streamInfoLabel}`}</span>
            </button>

            <button
              type="button"
              onClick={handleCycleNightMode}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                nightModeLevel > 0
                  ? 'bg-amber-500/20 border-amber-400/80 text-amber-300'
                  : 'bg-neutral-900/90 border-white/15 text-neutral-400 hover:text-white'
              }`}
              title="Night Mode Low-Light ISO Boost"
            >
              <Moon className={`w-3.5 h-3.5 ${nightModeLevel > 0 ? 'text-amber-400 fill-amber-400' : ''}`} />
              <span className="hidden sm:inline">
                {nightModeLevel === 0 ? 'Night' : nightModeLevel === 1 ? '1.5x' : '3.0x'}
              </span>
            </button>
          </div>

          {/* Right: Flash & Grid */}
          <div className="flex items-center gap-1.5">

            <button
              type="button"
              onClick={() => setIsFlashOn(!isFlashOn)}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isFlashOn
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'bg-neutral-900/90 text-neutral-300 border-white/15'
              }`}
              title="Toggle Studio Light"
            >
              <Zap className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                showGrid
                  ? 'bg-pink-500/25 text-pink-400 border-pink-500/50'
                  : 'bg-neutral-900/90 text-neutral-400 border-white/15'
              }`}
              title="Toggle Framing Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sony A1 8K Cinema / Sony A9 III 120fps Action Preset Switcher */}
        {!recordedClipUrl && burstFrames.length === 0 && (
          <div className="max-w-md mx-auto w-full grid grid-cols-2 gap-1.5 bg-neutral-950/90 p-1 rounded-2xl border border-white/15">
            {(['sony_a1_8k', 'sony_a9_120'] as SonyProPresetId[]).map((presetKey) => {
              const cfg = SONY_PRO_PRESETS[presetKey];
              const isSelected = sonyPreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  disabled={isRecording || isBurstCapturing}
                  onClick={() => handleSelectSonyPreset(presetKey)}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-tight flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? presetKey === 'sony_a1_8k'
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md'
                        : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{cfg.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MAIN VIEWFINDER / RECORDED PREVIEW (Snapchat-Style Edge-to-Edge) */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden bg-black px-0 sm:px-4">
        {recordedClipUrl ? (
          /* PREVIEW OF RECORDED FILTERED VIDEO OR CAPTURED PHOTO */
          <div className="relative w-full h-full sm:max-w-md sm:max-h-[760px] rounded-none sm:rounded-3xl overflow-hidden bg-black border-0 sm:border sm:border-pink-500/40 shadow-2xl flex flex-col justify-between">
            {recordedMediaType === 'image' ? (
              <img
                src={recordedClipUrl}
                alt="Captured Preview"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover bg-black gpu-accelerated"
              />
            ) : (
              <video
                src={recordedClipUrl}
                preload="auto"
                autoPlay
                loop
                controls
                playsInline
                className="w-full h-full object-cover [transform:translate3d(0,0,0)]"
              />
            )}

            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-pink-600/95 text-white text-[11px] font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Film className="w-3.5 h-3.5" />
                {recordedMediaType === 'image'
                  ? `${activeSonyConfig.shortName.toUpperCase()} SHARP PHOTO`
                  : `${activeSonyConfig.shortName.toUpperCase()} ${activeSonyConfig.colorScience}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.stopPreviewTrack();
                  setPreviewMusicId(null);
                  setShowMusicPicker(false);
                  if (recordedClipUrl && recordedClipUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(recordedClipUrl);
                  }
                  setRecordedClipUrl(null);
                  setIsSavedToGallery(false);
                  recordedBlobRef.current = null;
                }}
                className="pointer-events-auto px-3 py-1.5 rounded-full bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 text-xs font-bold border border-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Retake
              </button>
            </div>

            <div className="absolute bottom-3 left-3 right-3 z-20 bg-neutral-950/95 border border-neutral-800 rounded-2xl p-3.5 space-y-2.5">
              {/* Quick Add Song / Music Trigger */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowMusicPicker((prev) => !prev)}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    selectedMusicTrack
                      ? 'bg-pink-600/20 border-pink-500/50 text-pink-200'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="truncate">
                      {selectedMusicTrack
                        ? `Music: ${selectedMusicTrack.title}`
                        : 'Add Song / Music / Naat'}
                    </span>
                  </span>
                  <span className="text-[10px] text-cyan-300 font-black shrink-0">
                    {showMusicPicker ? 'Hide' : selectedMusicTrack ? 'Change' : 'Pick'}
                  </span>
                </button>
                {selectedMusicTrack && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.stopPreviewTrack();
                      setPreviewMusicId(null);
                      setSelectedMusicTrack(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-rose-400 text-[11px] font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {showMusicPicker && (
                <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1 p-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  {CURATED_AUDIO_LIBRARY.map((track) => {
                    const isPicked = selectedMusicTrack?.id === track.id;
                    const isPlayingPreview = previewMusicId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`px-2 py-1.5 rounded-lg flex items-center justify-between gap-2 ${
                          isPicked ? 'bg-pink-600/25 border border-pink-500/50' : 'hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPlayingPreview) {
                                soundEngine.stopPreviewTrack();
                                setPreviewMusicId(null);
                              } else {
                                soundEngine.playPreviewTrack(track.trackType, 0.8);
                                setPreviewMusicId(track.id);
                              }
                            }}
                            className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            {isPlayingPreview ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{track.title}</p>
                            <p className="text-[9px] text-neutral-400 truncate">{track.artist}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMusicTrack(isPicked ? null : track);
                            setShowMusicPicker(false);
                            soundEngine.stopPreviewTrack();
                            setPreviewMusicId(null);
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer shrink-0 ${
                            isPicked ? 'bg-pink-600 text-white' : 'bg-neutral-800 text-cyan-300'
                          }`}
                        >
                          {isPicked ? 'Using' : 'Use'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(sanitizeInputLive(e.target.value, 100))}
                  placeholder="Give your reel a title..."
                  className="w-full bg-neutral-900 text-xs text-white px-3 py-2 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-pink-500"
                />
                <input
                  type="text"
                  value={clipHashtags}
                  onChange={(e) => setClipHashtags(sanitizeHashtagsInput(e.target.value, 200))}
                  placeholder="#hashtags"
                  className="w-full bg-neutral-900 text-[11px] text-cyan-300 px-3 py-1.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              {/* Creator Download Privacy Toggle */}
              <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 px-2.5 py-2 space-y-1.5">
                <p className="text-[10px] font-bold text-neutral-300 leading-tight">
                  Allow others to download your video? (Kya koi download kar sakta hai?)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllowDownload(true)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-black border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      allowDownload
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Download className="w-3 h-3" />
                    <span>Yes, Allow Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowDownload(false)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-black border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      !allowDownload
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>No, Keep Private</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2">
                {/* One-Tap Ultra-Sharp Export (8K Clarity + High-Bitrate Download) */}
                <button
                  type="button"
                  disabled={isExportingUltraSharp}
                  onClick={() => void handleUltraSharpExport()}
                  className="py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border bg-gradient-to-r from-cyan-500 to-emerald-500 hover:brightness-110 disabled:opacity-60 border-cyan-300/60 text-black shadow-lg shadow-cyan-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
                  title="One-Tap Ultra-Sharp 8K Clarity Export"
                >
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>{isExportingUltraSharp ? 'Sharpening...' : 'Ultra-Sharp Export'}</span>
                </button>

                {/* Direct Save to Mobile Gallery / Download */}
                <button
                  type="button"
                  onClick={handleSaveToDeviceGallery}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-98 cursor-pointer shrink-0 ${
                    isSavedToGallery
                      ? 'bg-emerald-600/25 border-emerald-400 text-emerald-300'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                  title="Quick Save Raw Capture"
                >
                  {isSavedToGallery ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-cyan-400" />
                      <span>Save</span>
                    </>
                  )}
                </button>

                {/* Send Live Snap (24h Live Stories OR Direct DM to Friend) */}
                <button
                  type="button"
                  disabled={isSendingSnap || isPublishing}
                  onClick={() => {
                    if (initialSnapRecipient) {
                      void handleDirectSendToFriend(initialSnapRecipient).then(() => {
                        onClose();
                      });
                    } else {
                      setIsSnapSendSheetOpen(true);
                    }
                  }}
                  className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-105 disabled:opacity-60 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-xl shadow-amber-500/30 active:scale-98 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {initialSnapRecipient
                      ? `Send Snap to @${initialSnapRecipient.username}`
                      : 'Send Live Snap'}
                  </span>
                </button>

                {/* Publish to Global / Feed */}
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishReel}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 disabled:opacity-60 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-pink-600/30 active:scale-98 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>{isPublishing ? 'Publishing...' : 'Publish to Feed'}</span>
                </button>
              </div>
            </div>

            {/* Snapchat-Style Send Live Snap Delivery Sheet */}
            {isSnapSendSheetOpen && (
              <div
                className="absolute inset-0 z-40 bg-black/90 flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-150"
                onClick={() => setIsSnapSendSheetOpen(false)}
              >
                <div
                  className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl p-4 space-y-3.5 shadow-2xl max-h-[82vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Send Live Snap</h3>
                        <p className="text-[10px] text-neutral-400">
                          Post to 24-Hour Live Stories or Direct Send to Friends
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSnapSendSheetOpen(false)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Option A: Post to 24-Hour Live Stories Bar */}
                  <button
                    type="button"
                    disabled={isSendingSnap}
                    onClick={handlePostToLiveStories}
                    className="w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-600/20 to-fuchsia-600/20 hover:from-amber-500/30 hover:to-fuchsia-600/30 border border-pink-500/45 flex items-center justify-between gap-3 text-left transition-all active:scale-98 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-600 text-white flex items-center justify-center shadow-md">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">
                          Post to 24-Hour Live Stories
                        </p>
                        <p className="text-[10px] text-neutral-300">
                          Appears with a glowing ring at top of Home feed for 24h
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black shrink-0">
                      {isSendingSnap ? 'Posting...' : 'Add Story'}
                    </span>
                  </button>

                  {/* Option B: Direct Send to Any Friend / User */}
                  <div className="flex-1 min-h-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                        Direct Send to Friend
                      </p>
                      <span className="text-[10px] text-cyan-400 font-semibold">
                        {filteredDirectRecipients.length} available
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={snapFriendSearch}
                        onChange={(e) => setSnapFriendSearch(sanitizeSearchQuery(e.target.value, 80))}
                        placeholder="Search user or @username..."
                        className="w-full bg-neutral-900 text-xs text-white placeholder-neutral-500 pl-8.5 pr-3 py-2 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                      />
                    </div>

                    <div className="flex-1 max-h-56 overflow-y-auto no-scrollbar divide-y divide-neutral-900 rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
                      {filteredDirectRecipients.length === 0 ? (
                        <p className="p-4 text-center text-xs text-neutral-500">
                          No friends found matching your search.
                        </p>
                      ) : (
                        filteredDirectRecipients.map((friend) => {
                          const alreadySent = sentRecipientIds.includes(friend.username);
                          return (
                            <div
                              key={friend.username}
                              className="px-3 py-2 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <img
                                  src={optimizeThumbnailUrl(friend.avatar, 'grid')}
                                  alt={friend.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-bold text-white truncate">
                                      {friend.name}
                                    </p>
                                    {friend.isVerified && (
                                      <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-cyan-400 truncate">
                                    @{friend.username}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isSendingSnap || alreadySent}
                                onClick={() => handleDirectSendToFriend(friend)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
                                  alreadySent
                                    ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300'
                                    : 'bg-gradient-to-r from-pink-600 to-amber-500 hover:brightness-110 text-white'
                                }`}
                              >
                                {alreadySent ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Sent</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" />
                                    <span>Send</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : burstFrames.length > 0 ? (
          /* 120FPS BURST SHOT REVIEW & ACTION REEL STUDIO */
          <div className="relative w-full h-full sm:max-w-md sm:max-h-[760px] rounded-none sm:rounded-3xl overflow-hidden bg-neutral-950 border-0 sm:border sm:border-cyan-500/45 shadow-2xl flex flex-col justify-between">
            <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
              <img
                src={burstFrames[selectedBurstIndex]?.url}
                alt={`Burst frame ${selectedBurstIndex + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain gpu-accelerated"
              />
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full bg-black/85 border border-cyan-400/60 text-cyan-200 text-[11px] font-black tabular-nums flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    FRAME {selectedBurstIndex + 1}/{burstFrames.length}
                    {burstFrames[selectedBurstIndex]?.id === bestBurstFrameId ? ' · SHARPEST' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={revokeBurstFrames}
                  className="px-3 py-1.5 rounded-full bg-neutral-900/95 hover:bg-neutral-800 border border-white/20 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake Burst
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border-t border-neutral-800 space-y-3 shrink-0">
              {/* Filmstrip Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {burstFrames.map((frame, idx) => {
                  const isSelected = idx === selectedBurstIndex;
                  const isBest = frame.id === bestBurstFrameId;
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setSelectedBurstIndex(idx)}
                      className={`relative shrink-0 w-14 h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 scale-105 shadow-lg shadow-cyan-500/25'
                          : 'border-neutral-800 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={frame.url}
                        alt={`Shot ${idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-[9px] font-black text-white tabular-nums">
                        {idx + 1}
                      </span>
                      {isBest && (
                        <span className="absolute top-0.5 left-0.5 px-1 rounded bg-emerald-500 text-[8px] font-black text-black">
                          TOP
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isExportingUltraSharp}
                  onClick={() => void handleUltraSharpExport(burstFrames[selectedBurstIndex])}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:brightness-110 disabled:opacity-60 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>{isExportingUltraSharp ? 'Exporting...' : 'Ultra-Sharp Photo'}</span>
                </button>

                <button
                  type="button"
                  disabled={isCompilingBurstReel}
                  onClick={() => void handleCompileBurstActionReel()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 hover:brightness-110 disabled:opacity-60 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{isCompilingBurstReel ? 'Building Reel...' : 'Make Action Reel'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectBurstPhotoForPreview}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Post Shot</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE SONY A1 / A9 III HARDWARE-ACCELERATED VIEWFINDER (Double-tap to flip camera) */
          <div
            onClick={() => {
              const now = Date.now();
              if (now - viewfinderTapRef.current < 300) {
                viewfinderTapRef.current = 0;
                handleFlipCamera();
              } else {
                viewfinderTapRef.current = now;
              }
            }}
            className="relative w-full h-full sm:max-w-md sm:max-h-[760px] rounded-none sm:rounded-3xl overflow-hidden bg-black border-0 sm:border sm:border-neutral-800 shadow-2xl flex flex-col justify-between"
          >
            {!isSimulatedFeed ? (
              <div className="relative w-full h-full overflow-hidden bg-black [transform:translateZ(0)] [will-change:transform]">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedData={() => {
                    hasInitializedOnceRef.current = true;
                    setIsCameraReady(true);
                  }}
                  style={{
                    filter: activeCanvasFallbackFilter,
                    transform: `translateZ(0) scale(${zoomLevel}) scaleX(${facingMode === 'user' ? -1 : 1})`,
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                  }}
                  className="w-full h-full object-cover"
                />
                {!isCameraReady && !hasInitializedOnceRef.current && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/75 pointer-events-none">
                    <div className="px-4 py-2 rounded-full bg-neutral-900/90 border border-cyan-500/45 text-xs font-bold text-neutral-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>Initializing {activeSonyConfig.name}...</span>
                    </div>
                  </div>
                )}
                {/* Subtle S-Cinetone highlight/shadow tint */}
                <div
                  className={`absolute inset-0 pointer-events-none mix-blend-soft-light ${
                    sonyPreset === 'sony_a9_120' ? 'bg-sky-400/8' : 'bg-amber-300/6'
                  }`}
                />
                {selectedFilterId === 'golden_glow' && (
                  <div className="absolute inset-0 pointer-events-none bg-amber-400/10 mix-blend-screen" />
                )}
                {selectedFilterId === 'cinema_pro' && (
                  <div className="absolute inset-0 pointer-events-none bg-sky-500/8 mix-blend-screen" />
                )}
                {selectedFilterId === 'soft_beauty' && (
                  <div className="absolute inset-0 pointer-events-none bg-pink-300/10 mix-blend-screen" />
                )}
                {selectedFilterId === 'dark_moody' && (
                  <div className="absolute inset-0 pointer-events-none bg-slate-950/20" />
                )}
              </div>
            ) : (
              <div
                style={{ filter: activeCanvasFallbackFilter }}
                className="w-full h-full relative overflow-hidden bg-gradient-to-br from-purple-950 via-neutral-950 to-cyan-950 flex items-center justify-center p-5"
              >
                <div className="relative z-10 flex flex-col items-center gap-3 max-w-xs text-center">
                  <div className="w-16 h-16 rounded-full bg-neutral-900/90 border-2 border-pink-500/50 flex items-center justify-center text-pink-400 shadow-xl">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-wide">
                      {cameraBlockedInWebView ? 'LIVE WEBCAM BLOCKED' : 'INITIALIZING HD CAMERA...'}
                    </h3>
                    <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                      Allow camera & microphone permissions, or launch your phone&apos;s native camera directly.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="mt-1 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-bold text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Phone Native Camera</span>
                  </button>
                </div>
              </div>
            )}


            {/* 120fps Burst Capturing Overlay */}
            {isBurstCapturing && (
              <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center bg-white/10">
                <div className="px-4 py-2 rounded-full bg-black/90 border border-cyan-400 text-cyan-200 text-xs font-black tabular-nums shadow-2xl">
                  120FPS BURST · {burstProgressCount} FRAMES
                </div>
              </div>
            )}

            {/* Rule of Thirds Grid */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col divide-y divide-white/15">
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
              </div>
            )}

            {/* Red Recording Border */}
            {isRecording && (
              <div className="absolute inset-0 pointer-events-none z-20 border-4 border-red-500 rounded-2xl sm:rounded-3xl" />
            )}

            {/* Top Viewfinder Live Shutter/ISO/FPS Telemetry HUD */}
            <div className="absolute top-3 left-3 right-3 z-30 flex flex-col gap-1.5 pointer-events-none">
              <div className="flex items-center justify-between gap-2">
                {isRecording ? (
                  <div className="flex items-center gap-2 bg-red-600/95 border border-red-400 px-3 py-1 rounded-full text-white shadow-xl">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="text-xs font-black tracking-wider tabular-nums">
                      REC {formattedTimer} / 01:00
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-black/80 border border-amber-400/45 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider text-amber-300 tabular-nums">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{activeSonyConfig.hudTag}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 bg-black/80 px-2.5 py-1 rounded-full border border-white/15 text-[10px] font-bold text-neutral-200">
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
                </div>
              </div>

              {/* Pro Camera Exposure Telemetry Bar */}
              <div className="inline-flex self-start items-center gap-2 px-2.5 py-1 rounded-lg bg-black/75 border border-white/10 text-[10px] font-bold text-neutral-200 tabular-nums tracking-wide">
                <span className="text-cyan-300">SS {activeSonyConfig.shutterSpeed}</span>
                <span className="text-neutral-600">·</span>
                <span>ISO {liveIsoValue}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-emerald-300">{activeSonyConfig.aperture}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-pink-300">{selectedFilter.shortLabel}</span>
              </div>
            </div>

            {/* Bottom Overlay inside Viewfinder: Zoom Pills + Scrollable Real-Time Filter Bar */}
            <div className="absolute bottom-2 left-0 right-0 z-30 flex flex-col gap-2 px-2">
              {/* Digital Zoom Stepper */}
              <div className="flex items-center justify-center gap-1.5">
                {[1.0, 1.5, 2.0, 3.0].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => {
                      setZoomLevel(z);
                      onShowToast(`Zoom ${z}x`);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer tabular-nums ${
                      zoomLevel === z
                        ? 'bg-amber-400 text-black border-amber-300 scale-105'
                        : 'bg-black/70 text-white border-white/20 hover:bg-neutral-800'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>

              {/* Scrollable Live Camera Filters & Effects Bar */}
              <div
                className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2 py-1.5 bg-black/65 rounded-2xl border border-white/10"
                aria-label="Live camera filters"
              >
                {CAMERA_FILTERS.map((filter) => {
                  const isSelected = filter.id === selectedFilterId;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setSelectedFilterId(filter.id);
                        soundEngine.playCameraShutter();
                      }}
                      className={`shrink-0 flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-pink-600/30 border border-pink-400 scale-105'
                          : 'bg-neutral-900/75 border border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-tr ${filter.swatchClass} border-2 ${
                          isSelected ? 'border-white' : 'border-neutral-700'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold whitespace-nowrap ${
                          isSelected ? 'text-pink-300' : 'text-neutral-300'
                        }`}
                      >
                        {filter.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRO BOTTOM CAMERA CONTROLS: 120FPS BURST | PHOTO | CIRCULAR RECORD RING | FLIP CAMERA */}
      {!recordedClipUrl && burstFrames.length === 0 && (
        <div className="relative z-30 px-3 sm:px-4 py-3 bg-gradient-to-t from-black via-black/95 to-transparent shrink-0">
          <div className="max-w-md mx-auto w-full flex items-center justify-between gap-2">
            {/* 120fps Burst Shot Button */}
            <button
              type="button"
              disabled={isRecording || isBurstCapturing}
              onClick={() => void handleBurstShot()}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-2xl text-neutral-200 hover:text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer min-w-[56px]"
              title="120fps Rapid Burst Action Shot"
            >
              <div className="w-11 h-11 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center shadow-md">
                <Layers className="w-5 h-5 text-cyan-300" />
              </div>
              <span className="text-[10px] font-black text-cyan-300">Burst 120</span>
            </button>

            {/* Capture Sharp Photo Button */}
            <button
              type="button"
              disabled={isRecording || isBurstCapturing}
              onClick={handleCapturePhoto}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-2xl text-neutral-200 hover:text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer min-w-[52px]"
              title="Capture Ultra-Sharp S-Cinetone Photo"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-900/90 border border-white/20 flex items-center justify-center shadow-md">
                <ImageIcon className="w-5 h-5 text-amber-300" />
              </div>
              <span className="text-[10px] font-bold">Photo</span>
            </button>

            {/* Circular Cinema Shutter Button with Live SVG Recording Ring */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={isBurstCapturing}
                onClick={handleToggleRecord}
                className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-92 cursor-pointer disabled:opacity-50"
                aria-label={isRecording ? 'Stop Recording' : 'Record Pro Cinema Video'}
                title={isRecording ? 'Tap to Stop' : `Record ${activeSonyConfig.name}`}
              >
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth="4.5"
                  />
                  {isRecording && (
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="#ff2d55"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 * (1 - Math.min(1, recordingSeconds / 60))}
                      className="transition-all duration-300"
                    />
                  )}
                </svg>
                <div
                  className={`transition-all duration-150 flex items-center justify-center shadow-xl ${
                    isRecording
                      ? 'w-8 h-8 rounded-lg bg-red-600 shadow-red-600/50'
                      : 'w-14 h-14 rounded-full bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 border-2 border-white'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-3.5 h-3.5 fill-white text-white" />
                  ) : (
                    <Video className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
              <span className="text-[10px] font-black tracking-wide text-white tabular-nums">
                {isRecording ? `Stop ${formattedTimer}` : sonyPreset === 'sony_a1_8k' ? '8K Rec' : '120 Rec'}
              </span>
            </div>

            {/* Switch Camera Button (Front / Back) */}
            <button
              type="button"
              disabled={isRecording || isBurstCapturing}
              onClick={handleFlipCamera}
              className="flex flex-col items-center gap-1 px-2 py-1 rounded-2xl text-neutral-200 hover:text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer min-w-[52px]"
              title="Switch Front / Back Camera (or Double-Tap screen)"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-900/90 border border-white/20 flex items-center justify-center shadow-md">
                <SwitchCamera className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-[10px] font-bold">Flip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

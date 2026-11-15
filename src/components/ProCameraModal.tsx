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
  Circle,
  Image as ImageIcon,
  Download,
  Check,
} from 'lucide-react';
import { VideoPost, UserAccount, CreatorProfileData } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  getOrCreateUserProfileId,
  fileToPersistentDataUrl,
  saveLocalPostRecord,
} from '../lib/supabaseService';

interface ProCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  creatorProfile?: CreatorProfileData;
  onRecordSuccess: (newPost: VideoPost) => void;
  onSwitchToUploadFile: () => void;
  onShowToast: (msg: string) => void;
}

type ResolutionFpsMode = '4K/60FPS' | '1080p/60FPS' | '1080p/30FPS';

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
    id: 'normal',
    name: 'Normal',
    shortLabel: 'Normal',
    cssFilter: 'none',
    swatchClass: 'from-neutral-700 to-neutral-900',
  },
  {
    id: 'warm_glow',
    name: 'Warm Glow',
    shortLabel: 'Warm Glow',
    cssFilter: 'sepia(0.28) saturate(1.38) brightness(1.06) contrast(1.04) hue-rotate(-8deg)',
    swatchClass: 'from-amber-400 via-orange-500 to-rose-500',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      grad.addColorStop(0, 'rgba(255, 196, 112, 0.14)');
      grad.addColorStop(1, 'rgba(255, 107, 53, 0.12)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'cool_breeze',
    name: 'Cool Breeze',
    shortLabel: 'Cool Breeze',
    cssFilter: 'saturate(1.14) contrast(1.06) brightness(1.04) hue-rotate(14deg)',
    swatchClass: 'from-cyan-400 via-sky-500 to-indigo-600',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.12)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'vintage_retro',
    name: 'Vintage Retro',
    shortLabel: 'Vintage Retro',
    cssFilter: 'sepia(0.55) contrast(1.14) brightness(0.96) saturate(0.85)',
    swatchClass: 'from-yellow-600 via-amber-700 to-stone-800',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      vignette.addColorStop(0, 'rgba(255, 224, 160, 0.06)');
      vignette.addColorStop(1, 'rgba(24, 16, 8, 0.42)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'noir_bw',
    name: 'Black & White (Noir)',
    shortLabel: 'Noir B&W',
    cssFilter: 'grayscale(1) contrast(1.34) brightness(0.96)',
    swatchClass: 'from-zinc-200 via-zinc-500 to-black',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      vignette.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    shortLabel: 'Cyberpunk Neon',
    cssFilter: 'contrast(1.3) saturate(1.75) hue-rotate(20deg) brightness(1.04)',
    swatchClass: 'from-fuchsia-500 via-purple-600 to-cyan-400',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const neon = ctx.createLinearGradient(0, 0, w, h);
      neon.addColorStop(0, 'rgba(236, 72, 153, 0.18)');
      neon.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
      neon.addColorStop(1, 'rgba(34, 211, 238, 0.2)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = neon;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'vivid_pop',
    name: 'Vivid Pop',
    shortLabel: 'Vivid Pop',
    cssFilter: 'saturate(1.65) contrast(1.18) brightness(1.06)',
    swatchClass: 'from-pink-500 via-rose-500 to-yellow-400',
  },
  {
    id: 'soft_beauty',
    name: 'Soft Beauty',
    shortLabel: 'Soft Beauty',
    cssFilter: 'brightness(1.09) contrast(0.95) saturate(1.16) blur(0.35px)',
    swatchClass: 'from-rose-300 via-pink-400 to-fuchsia-400',
    drawOverlay: (ctx, w, h) => {
      ctx.save();
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      glow.addColorStop(0, 'rgba(255, 228, 238, 0.12)');
      glow.addColorStop(1, 'rgba(244, 114, 182, 0.08)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
];

function getSupportedRecorderOptions(): MediaRecorderOptions {
  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  for (const mimeType of mimeCandidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond: 12_000_000,
        audioBitsPerSecond: 192_000,
      };
    }
  }
  return {
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  };
}

export const ProCameraModal: React.FC<ProCameraModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  creatorProfile,
  onRecordSuccess,
  onSwitchToUploadFile,
  onShowToast,
}) => {
  // Camera Settings
  const [resFps, setResFps] = useState<ResolutionFpsMode>('4K/60FPS');
  const [streamInfoLabel, setStreamInfoLabel] = useState<string>('4K UHD · 60fps');
  const [selectedFilterId, setSelectedFilterId] = useState<string>('normal');
  const [nightModeLevel, setNightModeLevel] = useState<number>(0); // 0 = off, 1 = 1.5x, 2 = 3.0x
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSimulatedFeed, setIsSimulatedFeed] = useState<boolean>(false);
  const [cameraBlockedInWebView, setCameraBlockedInWebView] = useState<boolean>(false);

  // Recording & Capture State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedClipUrl, setRecordedClipUrl] = useState<string | null>(null);
  const [recordedMediaType, setRecordedMediaType] = useState<'video' | 'image'>('video');
  const [isSavedToGallery, setIsSavedToGallery] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Post-recording caption form
  const [clipTitle, setClipTitle] = useState('');
  const [clipHashtags, setClipHashtags] = useState('#JattVibe #HD60FPS #LiveFilter #Trending');

  // Refs for camera stream, canvas rendering, and MediaRecorder
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement | null>(null);
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

  // Keep live filter & transform values in refs so on-demand recording never restarts
  const activeFilterRef = useRef<CameraFilterDef>(CAMERA_FILTERS[0]);
  const nightModeRef = useRef<number>(nightModeLevel);
  const zoomRef = useRef<number>(zoomLevel);
  const facingRef = useRef<'user' | 'environment'>(facingMode);

  const selectedFilter =
    CAMERA_FILTERS.find((f) => f.id === selectedFilterId) || CAMERA_FILTERS[0];

  useEffect(() => {
    activeFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    nightModeRef.current = nightModeLevel;
  }, [nightModeLevel]);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    facingRef.current = facingMode;
  }, [facingMode]);

  // Compute combined CSS filter string for live canvas/fallback preview
  const buildCompositeFilter = useCallback(
    (filterDef: CameraFilterDef, night: number): string => {
      const parts: string[] = [];
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
    []
  );

  // Fallback native camera capture handler
  const handleNativeCameraCaptured = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      recordedBlobRef.current = file;
      setRecordedMediaType(file.type.startsWith('image/') ? 'image' : 'video');
      setRecordedClipUrl(url);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setClipTitle(cleanName || `HD Mobile Reel #${Math.floor(Math.random() * 900 + 100)}`);
      onShowToast('Captured from phone camera! Preview & publish below.');
    }
    e.target.value = '';
  };

  // Acquire highest available HD/4K 60fps camera stream with graceful fallback
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
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setIsRecording(false);
      setRecordingSeconds(0);
      setRecordedClipUrl(null);
      setIsSavedToGallery(false);
      recordedBlobRef.current = null;
      setCameraBlockedInWebView(false);
      return;
    }

    let isMounted = true;

    async function acquireBestCameraStream(): Promise<MediaStream> {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Live mediaDevices.getUserMedia not supported');
      }

      const audioHighQuality: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      const targetConstraints: MediaStreamConstraints[] =
        resFps === '4K/60FPS'
          ? [
              {
                video: {
                  facingMode,
                  width: { ideal: 3840 },
                  height: { ideal: 2160 },
                  frameRate: { ideal: 60, min: 30 },
                },
                audio: audioHighQuality,
              },
              {
                video: {
                  facingMode,
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                  frameRate: { ideal: 60, min: 24 },
                },
                audio: audioHighQuality,
              },
              { video: { facingMode }, audio: true },
              { video: { facingMode }, audio: false },
            ]
          : resFps === '1080p/60FPS'
          ? [
              {
                video: {
                  facingMode,
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                  frameRate: { ideal: 60, min: 30 },
                },
                audio: audioHighQuality,
              },
              { video: { facingMode }, audio: true },
              { video: { facingMode }, audio: false },
            ]
          : [
              {
                video: {
                  facingMode,
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                  frameRate: { ideal: 30 },
                },
                audio: audioHighQuality,
              },
              { video: { facingMode }, audio: true },
              { video: { facingMode }, audio: false },
            ];

      let lastErr: unknown = null;
      for (const constraints of targetConstraints) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    }

    async function setupCamera() {
      // Stop existing tracks before switching front/back or resolution
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      try {
        const stream = await acquireBestCameraStream();
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const w = settings.width || 1920;
          const h = settings.height || 1080;
          const fps = Math.round(settings.frameRate || 60);
          const qualityTag = w >= 3840 || h >= 2160 ? '4K' : w >= 1920 || h >= 1080 ? '1080p' : `${w}x${h}`;
          setStreamInfoLabel(`${qualityTag} (${w}x${h}) · ${fps}fps`);
        }

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(() => {});
        }
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

    setupCamera();

    return () => {
      isMounted = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, facingMode, resFps, onShowToast]);

  // Draw one filtered/mirrored/zoomed frame onto the offscreen canvas (used for snapshot & filtered recording only)
  const drawVideoFrameToCanvas = useCallback(
    (maxDim = 1920): boolean => {
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
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return false;

      const filterDef = activeFilterRef.current;
      const compositeFilter = buildCompositeFilter(filterDef, nightModeRef.current);
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
      if (filterDef.drawOverlay) {
        filterDef.drawOverlay(ctx, targetW, targetH);
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

  // Start on-demand recording-only canvas pump (zero overhead during normal camera preview)
  const startRecordingFramePump = useCallback(() => {
    stopRecordingFramePump();
    recordingCanvasActiveRef.current = true;

    const video = videoPreviewRef.current as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    }) | null;

    if (video && typeof video.requestVideoFrameCallback === 'function') {
      const onVideoFrame = () => {
        if (!recordingCanvasActiveRef.current) return;
        drawVideoFrameToCanvas(1080);
        videoFrameCbRef.current = video.requestVideoFrameCallback!(onVideoFrame);
      };
      drawVideoFrameToCanvas(1080);
      videoFrameCbRef.current = video.requestVideoFrameCallback(onVideoFrame);
      return;
    }

    const onRaf = () => {
      if (!recordingCanvasActiveRef.current) return;
      drawVideoFrameToCanvas(1080);
      animFrameRef.current = requestAnimationFrame(onRaf);
    };
    drawVideoFrameToCanvas(1080);
    animFrameRef.current = requestAnimationFrame(onRaf);
  }, [drawVideoFrameToCanvas, stopRecordingFramePump]);

  // Ensure frame pump cleans up on modal close
  useEffect(() => {
    if (!isOpen || recordedClipUrl) {
      stopRecordingFramePump();
    }
    return () => {
      stopRecordingFramePump();
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
      const needsCanvasBake =
        selectedFilterId !== 'normal' ||
        nightModeLevel > 0 ||
        zoomLevel > 1.0 ||
        facingMode === 'user';

      let combinedStream: MediaStream;
      if (!needsCanvasBake || typeof canvas.captureStream !== 'function') {
        combinedStream = rawStream;
      } else {
        startRecordingFramePump();
        const targetFps = resFps.includes('60FPS') ? 60 : 30;
        const canvasStream = canvas.captureStream(targetFps);
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...rawStream.getAudioTracks(),
        ]);
      }

      const options = getSupportedRecorderOptions();
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
          recordedBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setRecordedMediaType('video');
          setRecordedClipUrl(url);
          setClipTitle(
            `${selectedFilter.name !== 'Normal' ? `${selectedFilter.shortLabel} ` : ''}HD Reel #${Math.floor(
              Math.random() * 900 + 100
            )}`
          );
          onShowToast(
            `Recorded in ${streamInfoLabel} with ${selectedFilter.name} filter!`
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
      onShowToast(`Recording ${resFps} (${selectedFilter.name})...`);
    } catch (err) {
      stopRecordingFramePump();
      console.error('Failed to start MediaRecorder:', err);
      onShowToast('Live recording unsupported on this browser — opening native phone camera.');
      nativeCameraInputRef.current?.click();
    }
  };

  // Capture Filtered High-Res Photo via single on-demand snapshot
  const handleCapturePhoto = () => {
    if (isSimulatedFeed) {
      nativeCameraInputRef.current?.click();
      return;
    }
    const ok = drawVideoFrameToCanvas(1920);
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
        recordedBlobRef.current = blob;
        setRecordedMediaType('image');
        setRecordedClipUrl(URL.createObjectURL(blob));
        setClipTitle(
          `${selectedFilter.name !== 'Normal' ? `${selectedFilter.shortLabel} ` : ''}Shot #${Math.floor(
            Math.random() * 900 + 100
          )}`
        );
        onShowToast(`Photo captured with ${selectedFilter.name} filter!`);
      },
      'image/jpeg',
      0.92
    );
  };

  // Switch Camera (Front / Back)
  const handleFlipCamera = () => {
    if (isRecording) {
      onShowToast('Stop recording before switching camera.');
      return;
    }
    soundEngine.playCameraShutter();
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    onShowToast(`Switched Camera: ${nextMode === 'environment' ? 'Back (Rear)' : 'Front (Selfie)'}`);
  };

  // Cycle 4K / 60FPS modes
  const handleCycleResFps = () => {
    if (isRecording) return;
    soundEngine.playCameraShutter();
    const modes: ResolutionFpsMode[] = ['4K/60FPS', '1080p/60FPS', '1080p/30FPS'];
    const nextIdx = (modes.indexOf(resFps) + 1) % modes.length;
    setResFps(modes[nextIdx]);
    onShowToast(`Target quality: ${modes[nextIdx]}`);
  };

  // Cycle Night Mode Booster
  const handleCycleNightMode = () => {
    soundEngine.playCameraShutter();
    const next = (nightModeLevel + 1) % 3;
    setNightModeLevel(next);
    const labels = ['Night Mode: OFF', 'Night Mode: 1.5x Boost', 'Night Mode: 3.0x Max'];
    onShowToast(labels[next]);
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

  // Publish newly captured video or photo to feed (+ Supabase if configured)
  const handlePublishReel = async () => {
    if (!recordedClipUrl || isPublishing) return;
    setIsPublishing(true);

    try {
      const userId = creatorProfile?.id || currentUser?.id || getOrCreateUserProfileId();
      const authorName = currentUser?.name || creatorProfile?.name || 'Jatt Creator';
      const authorUsername = currentUser?.username || creatorProfile?.username || 'jatt_official';
      const authorAvatar =
        currentUser?.avatar ||
        creatorProfile?.avatar ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';
      const authorBio = currentUser?.bio || creatorProfile?.bio || 'VibeReels Pro Creator';

      const cleanTitle = clipTitle.trim() || `Shot with Jatt VibeReels (${selectedFilter.name})`;
      const caption = `${cleanTitle} (${streamInfoLabel} · ${selectedFilter.name}) ${clipHashtags}`.trim();

      let finalMediaUrl = recordedClipUrl;
      if (recordedBlobRef.current && isSupabaseConfigured) {
        onShowToast('Uploading high-quality capture to global feed...');
        const ext = recordedMediaType === 'image' ? 'jpg' : recordedMimeRef.current.includes('mp4') ? 'mp4' : 'webm';
        const uploadedUrl = await uploadMediaToReelsBucket(
          recordedBlobRef.current,
          'posts',
          `camera-${Date.now()}.${ext}`
        );
        if (uploadedUrl) {
          finalMediaUrl = uploadedUrl;
        }
      } else if (recordedBlobRef.current) {
        const dataUrl = await fileToPersistentDataUrl(recordedBlobRef.current);
        if (dataUrl) finalMediaUrl = dataUrl;
      }

      const supabasePost = await createGlobalPostInSupabase({
        userId,
        username: authorUsername,
        displayName: authorName,
        avatarUrl: authorAvatar,
        mediaUrl: finalMediaUrl,
        mediaType: recordedMediaType,
        caption,
      });

      const tags = clipHashtags
        .split(/[\s,]+/)
        .map((h) => h.replace(/^#/, '').trim())
        .filter(Boolean);

      const newPost: VideoPost =
        supabasePost || {
          id: `pro-reel-${Date.now()}`,
          title: cleanTitle,
          description: caption,
          hashtags: tags.length ? tags : ['JattVibe', 'HD60FPS'],
          videoUrl: finalMediaUrl,
          posterUrl: recordedMediaType === 'image' ? finalMediaUrl : undefined,
          fallbackGradient: 'from-pink-900 via-purple-900 to-black',
          category: 'trending',
          userId,
          mediaType: recordedMediaType,
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
          sound: {
            title: recordedMediaType === 'image' ? 'Photo Studio Vibe' : 'Original HD Studio Audio',
            artist: authorName,
            trackType: 'future_bass',
          },
          commentsList: [],
        };

      saveLocalPostRecord(newPost);
      onRecordSuccess(newPost);
      soundEngine.playDownloadComplete();
      onShowToast(
        supabasePost
          ? `Published ${recordedMediaType === 'image' ? 'photo' : 'HD video'} to global feed!`
          : `Published ${recordedMediaType === 'image' ? 'photo' : 'HD video'} to For You feed!`
      );
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  const formattedTimer = `00:${recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}`;
  const activeCanvasFallbackFilter = buildCompositeFilter(selectedFilter, nightModeLevel);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none [transform:translateZ(0)]">
      {/* Offscreen canvas used strictly on-demand for photo snapshots or filtered video baking */}
      <canvas ref={canvasPreviewRef} className="hidden" />

      {/* Fallback Native Camera Input for restricted WebViews */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="video/*,image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeCameraCaptured}
      />

      {/* Flash / Studio Ring Light Overlay */}
      {isFlashOn && (
        <div className="absolute inset-0 pointer-events-none z-40 bg-radial from-amber-100/25 via-white/10 to-transparent mix-blend-screen" />
      )}

      {/* TOP PRO STATUS BAR */}
      <div className="relative z-30 px-3 sm:px-4 py-2.5 bg-gradient-to-b from-black/90 via-black/55 to-transparent flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center border border-white/15 transition-all active:scale-95"
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
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-xs font-bold text-neutral-300 hover:text-white border border-neutral-700/80 transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-pink-400" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Center: Active Stream Resolution & FPS */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCycleResFps}
            className="px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-pink-500/50 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg shadow-pink-500/15 active:scale-95 transition-transform"
            title="Tap to cycle target resolution & FPS"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide">{isSimulatedFeed ? resFps : streamInfoLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleCycleNightMode}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all ${
              nightModeLevel > 0
                ? 'bg-amber-500/20 border-amber-400/80 text-amber-300'
                : 'bg-neutral-900/90 border-white/15 text-neutral-400 hover:text-white'
            }`}
            title="Night Mode Low-Light Boost"
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
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
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
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
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

      {/* MAIN VIEWFINDER / RECORDED PREVIEW */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden bg-neutral-950 px-2 sm:px-4">
        {recordedClipUrl ? (
          /* PREVIEW OF RECORDED FILTERED VIDEO OR CAPTURED PHOTO */
          <div className="relative w-full h-full max-w-md max-h-[760px] rounded-3xl overflow-hidden bg-black border border-pink-500/40 shadow-2xl flex flex-col justify-between">
            {recordedMediaType === 'image' ? (
              <img
                src={recordedClipUrl}
                alt="Captured Preview"
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <video
                src={recordedClipUrl}
                autoPlay
                loop
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            )}

            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-pink-600/95 text-white text-[11px] font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Film className="w-3.5 h-3.5" />
                {recordedMediaType === 'image' ? 'FILTERED PHOTO' : `${selectedFilter.shortLabel.toUpperCase()} HD VIDEO`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setRecordedClipUrl(null);
                  setIsSavedToGallery(false);
                  recordedBlobRef.current = null;
                }}
                className="pointer-events-auto px-3 py-1 rounded-full bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 text-xs font-bold border border-neutral-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Retake
              </button>
            </div>

            <div className="absolute bottom-3 left-3 right-3 z-20 bg-neutral-950/95 border border-neutral-800 rounded-2xl p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="Give your reel a title..."
                  className="w-full bg-neutral-900 text-xs text-white px-3 py-2 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-pink-500"
                />
                <input
                  type="text"
                  value={clipHashtags}
                  onChange={(e) => setClipHashtags(e.target.value)}
                  placeholder="#hashtags"
                  className="w-full bg-neutral-900 text-[11px] text-cyan-300 px-3 py-1.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {/* Direct Save to Mobile Gallery / Download */}
                <button
                  type="button"
                  onClick={handleSaveToDeviceGallery}
                  className={`py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-98 cursor-pointer shrink-0 ${
                    isSavedToGallery
                      ? 'bg-emerald-600/25 border-emerald-400 text-emerald-300'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/15'
                  }`}
                >
                  {isSavedToGallery ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Saved to Gallery</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-cyan-400" />
                      <span>Save to Gallery / Download</span>
                    </>
                  )}
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
          </div>
        ) : (
          /* ACTIVE HARDWARE-ACCELERATED VIDEO CAMERA VIEWFINDER */
          <div className="relative w-full h-full max-w-md max-h-[760px] rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex flex-col justify-between">
            {!isSimulatedFeed ? (
              <div className="relative w-full h-full overflow-hidden bg-black">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    filter: activeCanvasFallbackFilter,
                    transform: `translate3d(0, 0, 0) scale(${zoomLevel}) scaleX(${facingMode === 'user' ? -1 : 1})`,
                    willChange: 'transform, filter',
                  }}
                  className="w-full h-full object-cover"
                />
                {selectedFilterId === 'warm_glow' && (
                  <div className="absolute inset-0 pointer-events-none bg-radial from-amber-300/15 via-transparent to-orange-500/15 mix-blend-screen" />
                )}
                {selectedFilterId === 'cool_breeze' && (
                  <div className="absolute inset-0 pointer-events-none bg-linear-to-br from-sky-400/15 to-indigo-500/15 mix-blend-screen" />
                )}
                {selectedFilterId === 'vintage_retro' && (
                  <div className="absolute inset-0 pointer-events-none bg-radial from-amber-200/10 via-transparent to-black/45" />
                )}
                {selectedFilterId === 'noir_bw' && (
                  <div className="absolute inset-0 pointer-events-none bg-radial from-white/5 via-transparent to-black/50" />
                )}
                {selectedFilterId === 'cyberpunk_neon' && (
                  <div className="absolute inset-0 pointer-events-none bg-linear-to-br from-pink-500/20 via-purple-500/10 to-cyan-400/20 mix-blend-screen" />
                )}
                {selectedFilterId === 'soft_beauty' && (
                  <div className="absolute inset-0 pointer-events-none bg-radial from-pink-200/15 via-transparent to-pink-400/10 mix-blend-screen" />
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

            {/* Top Viewfinder Overlay: REC Timer + Filter Badge */}
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
              {isRecording ? (
                <div className="flex items-center gap-2 bg-red-600/95 border border-red-400 px-3 py-1 rounded-full text-white shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span className="text-xs font-black tracking-wider tabular-nums">
                    REC {formattedTimer} / 01:00
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-black/75 border border-white/15 px-2.5 py-1 rounded-full text-[11px] text-neutral-200">
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  <span className="font-bold">{selectedFilter.name}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-black/75 px-2.5 py-1 rounded-full border border-white/15 text-[10px] font-bold text-neutral-300">
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition-all ${
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

      {/* BOTTOM PRIMARY CAMERA CONTROLS: CAPTURE PHOTO | RECORD VIDEO / STOP | SWITCH CAMERA */}
      {!recordedClipUrl && (
        <div className="relative z-30 px-4 py-3.5 bg-gradient-to-t from-black via-black/95 to-transparent shrink-0">
          <div className="max-w-md mx-auto w-full flex items-center justify-around gap-3">
            {/* Capture Photo Button */}
            <button
              type="button"
              disabled={isRecording}
              onClick={handleCapturePhoto}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl text-neutral-200 hover:text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              title="Capture Filtered Photo"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center shadow-md">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-[10px] font-bold">Capture Photo</span>
            </button>

            {/* Primary Record Video / Stop Button */}
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-full font-black text-xs border-2 transition-all active:scale-95 cursor-pointer shadow-xl ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 border-red-300 text-white shadow-red-600/40'
                  : 'bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 border-pink-300/60 text-white shadow-pink-600/35'
              }`}
              aria-label={isRecording ? 'Stop Recording' : 'Record Video'}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span className="tabular-nums">Stop ({formattedTimer})</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 fill-white text-white" />
                  <Video className="w-4 h-4" />
                  <span>Record Video</span>
                </>
              )}
            </button>

            {/* Switch Camera Button (Front / Back) */}
            <button
              type="button"
              disabled={isRecording}
              onClick={handleFlipCamera}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl text-neutral-200 hover:text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              title="Switch Front / Back Camera"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center shadow-md">
                <SwitchCamera className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-[10px] font-bold">Switch Camera</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

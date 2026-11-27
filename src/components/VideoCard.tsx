import React, { useRef, useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Plus,
  Check,
  Music,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Users,
  ArrowLeftRight,
} from 'lucide-react';
import { DirectSnapRecipient, VideoPost } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { ProceduralCanvas } from './ProceduralCanvas';
import { formatRelativeTime } from '../lib/supabaseService';
import { savePostForOffline } from '../lib/offlineMediaStore';
import {
  getSavedVideoTimestamp,
  savePlaybackState,
  saveVideoTimestamp,
} from '../lib/playbackPersistence';
import { useRamSaverMode } from '../lib/ramSaverMode';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { VideoThumbnail } from './VideoThumbnail';
import {
  captureVideoFrameDataUrl,
  getCachedVideoThumbnail,
  setCachedVideoThumbnail,
} from '../utils/videoThumbnail';

interface VideoCardProps {
  video: VideoPost;
  cardIndex?: number;
  isActive: boolean;
  isNext?: boolean;
  isNearViewport?: boolean;
  isMuted: boolean;
  currentUserId?: string;
  currentUsername?: string;
  isFollowingCreator?: boolean;
  isFollowerCreator?: boolean;
  isMutualFriend?: boolean;
  controlsSide?: 'left' | 'right';
  onSwapControlsSide?: () => void;
  isCleanScreenMode?: boolean;
  onToggleCleanScreenMode?: () => void;
  onToggleMute: () => void;
  onLikeToggle: (id: string) => void;
  onSaveToggle: (id: string) => void;
  onFollowToggle: (creatorUsername: string) => void;
  onOpenComments: (video: VideoPost) => void;
  onOpenShare: (video: VideoPost) => void;
  onDeletePost?: (id: string) => void;
  onViewTracked?: (id: string) => void;
  onDownloadTracked?: (id: string) => void;
  onHashtagClick?: (tag: string) => void;
  onOpenCreatorProfile?: (username: string, creator?: VideoPost['creator'], userId?: string) => void;
  onMessageCreator?: (recipient: DirectSnapRecipient) => void;
  onShowToast: (msg: string) => void;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  rotation: number;
}

const VideoCardComponent: React.FC<VideoCardProps> = ({
  video,
  cardIndex,
  isActive,
  isNext = false,
  isNearViewport = true,
  isMuted,
  currentUserId,
  currentUsername,
  isFollowingCreator,
  isFollowerCreator = false,
  isMutualFriend = false,
  controlsSide = 'left',
  onSwapControlsSide,
  isCleanScreenMode: controlledCleanMode,
  onToggleCleanScreenMode,
  onToggleMute,
  onLikeToggle,
  onSaveToggle,
  onFollowToggle,
  onOpenComments,
  onOpenShare,
  onDeletePost,
  onViewTracked,
  onDownloadTracked,
  onHashtagClick,
  onOpenCreatorProfile,
  onMessageCreator,
  onShowToast,
}) => {
  const isLeftControls = controlsSide === 'left';
  const [localCleanMode, setLocalCleanMode] = useState(false);
  const cleanMode = controlledCleanMode ?? localCleanMode;
  const handleToggleClean = () => {
    if (onToggleCleanScreenMode) {
      onToggleCleanScreenMode();
    } else {
      setLocalCleanMode((prev) => !prev);
    }
  };
  const cardRootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(isActive);
  const { isRamSaverMode } = useRamSaverMode();

  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDownloadBlockedOpen, setIsDownloadBlockedOpen] = useState(false);

  const effectiveIsFollowing = isFollowingCreator ?? video.creator.isFollowing;
  const effectiveIsMutual = Boolean(isMutualFriend && effectiveIsFollowing);

  const [currentTime, setCurrentTime] = useState(() => getSavedVideoTimestamp(video.id));
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubHoverPercent, setScrubHoverPercent] = useState<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isDownloadingReel, setIsDownloadingReel] = useState(false);
  const [cachedThumb, setCachedThumb] = useState<string>(() =>
    getCachedVideoThumbnail(video.videoUrl)
  );
  const isDownloadAllowed = video.allowDownload !== false;

  const isOwnPost = Boolean(
    onDeletePost &&
      (video.isUserUploaded ||
        (currentUserId && video.userId === currentUserId) ||
        (currentUsername &&
          video.creator.username.toLowerCase() === currentUsername.toLowerCase()))
  );

  const lastTapRef = useRef<number>(0);
  const viewRecordedForActiveRef = useRef<boolean>(false);
  const lastSavedStampRef = useRef<number>(0);
  const pendingResumeTimeRef = useRef<number>(getSavedVideoTimestamp(video.id));
  const wasPlayingBeforeHideRef = useRef<boolean>(true);

  useEffect(() => {
    setIsLandscape(false);
    setCaptionExpanded(false);
    setVideoError(false);
    setCachedThumb(getCachedVideoThumbnail(video.videoUrl));
    const savedTime = getSavedVideoTimestamp(video.id);
    pendingResumeTimeRef.current = savedTime;
    setCurrentTime(savedTime);
  }, [video.id, video.videoUrl]);

  // IntersectionObserver: strictly play only when card is >=55% visible inside viewport
  useEffect(() => {
    const rootEl = cardRootRef.current;
    if (!rootEl || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(isActive);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
          setIsInViewport(visible);
        }
      },
      { threshold: [0, 0.55, 0.9] }
    );

    observer.observe(rootEl);
    return () => observer.disconnect();
  }, [isActive, isNearViewport]);

  // Increment real-time post view count (+1) ONLY after 3 full seconds of genuine active watch time
  useEffect(() => {
    if (!isActive) {
      viewRecordedForActiveRef.current = false;
      return;
    }
    if (viewRecordedForActiveRef.current) return;

    let watchedMs = 0;
    let lastTickMs = Date.now();

    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.min(500, Math.max(0, now - lastTickMs));
      lastTickMs = now;

      const tabVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
      const actuallyPlaying =
        video.mediaType === 'image'
          ? isPlaying
          : isPlaying && Boolean(videoRef.current && !videoRef.current.paused && !videoRef.current.ended);

      if (tabVisible && actuallyPlaying) {
        watchedMs += delta;
        if (watchedMs >= 3000 && !viewRecordedForActiveRef.current) {
          viewRecordedForActiveRef.current = true;
          onViewTracked?.(video.id);
          window.clearInterval(interval);
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isActive, isPlaying, video.id, video.mediaType, onViewTracked]);

  const originalVol =
    typeof video.sound.originalVolume === 'number' ? video.sound.originalVolume : 1;
  const bgVol =
    typeof video.sound.bgAudioVolume === 'number' ? video.sound.bgAudioVolume : 0.75;
  const hasExternalAudio = Boolean(video.sound.audioUrl);
  const shouldPlaySynthTrack =
    !hasExternalAudio &&
    (video.mediaType === 'image' ||
      Boolean(video.sound.hasAttachedAudio) ||
      (!video.isUserUploaded && !video.isSupabasePost));

  // Helper to start/stop background audio (external MP3/M4A or synthesized Naat/Song)
  const syncBackgroundAudio = (shouldPlay: boolean) => {
    const audioEl = bgAudioRef.current;
    if (hasExternalAudio && audioEl) {
      soundEngine.stopTrack();
      audioEl.muted = isMuted;
      audioEl.volume = Math.max(0, Math.min(1, bgVol));
      if (shouldPlay) {
        void audioEl.play().catch(() => {});
      } else {
        audioEl.pause();
      }
      return;
    }

    if (audioEl) {
      audioEl.pause();
    }

    if (shouldPlay && !isMuted && shouldPlaySynthTrack && bgVol > 0.01) {
      soundEngine.playTrack(video.sound.trackType, bgVol);
    } else {
      soundEngine.stopTrack();
    }
  };

  // Apply saved playback timestamp cleanly without resetting video to 0:00
  const applySavedTimestampIfNeeded = (el: HTMLVideoElement) => {
    const targetSec =
      pendingResumeTimeRef.current > 0.25
        ? pendingResumeTimeRef.current
        : getSavedVideoTimestamp(video.id);
    if (
      targetSec > 0.25 &&
      Number.isFinite(el.duration) &&
      el.duration > 0.5 &&
      targetSec < el.duration - 0.3 &&
      Math.abs(el.currentTime - targetSec) > 0.8
    ) {
      try {
        el.currentTime = targetSec;
        setCurrentTime(targetSec);
      } catch {
        // ignore seek errors before buffered
      }
      pendingResumeTimeRef.current = 0;
    } else if (targetSec > 0.25 && (!Number.isFinite(el.duration) || el.duration === 0) && el.currentTime < 0.25) {
      try {
        el.currentTime = targetSec;
        setCurrentTime(targetSec);
      } catch {
        // will retry in onLoadedMetadata / onCanPlay
      }
    }
  };

  // Strict IntersectionObserver + Virtualization Playback Control:
  // 1) Active AND visible in viewport: plays smoothly with preload="auto"
  // 2) Any off-screen video: paused and unloaded immediately (preload="none") to save RAM & bandwidth
  useEffect(() => {
    const shouldBePlaying = isActive && isInViewport;

    if (video.mediaType === 'image') {
      if (isNext && !isRamSaverMode && video.videoUrl) {
        const prefetch = new Image();
        prefetch.decoding = 'async';
        prefetch.src = video.videoUrl;
      }
      if (shouldBePlaying) {
        savePlaybackState({ videoId: video.id, isPlaying: true });
        setIsPlaying(true);
        syncBackgroundAudio(true);
      } else {
        setIsPlaying(false);
        if (bgAudioRef.current) bgAudioRef.current.pause();
        soundEngine.stopTrack();
      }
      return;
    }

    const el = videoRef.current;
    if (!shouldBePlaying || !el || (typeof document !== 'undefined' && document.hidden)) {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current.muted = true;
      }
      if (!isActive || (typeof document !== 'undefined' && document.hidden)) {
        soundEngine.stopTrack();
      }
      setIsPlaying(false);
      return;
    }

    if (el.getAttribute('src') !== video.videoUrl) {
      el.setAttribute('src', video.videoUrl);
      pendingResumeTimeRef.current = getSavedVideoTimestamp(video.id);
    }
    el.preload = 'auto';
    el.volume = Math.max(0, Math.min(1, originalVol));
    el.muted = isMuted || originalVol <= 0.01;
    applySavedTimestampIfNeeded(el);
    savePlaybackState({ videoId: video.id });

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          applySavedTimestampIfNeeded(el);
          setIsPlaying(true);
          setVideoError(false);
          syncBackgroundAudio(true);
        })
        .catch(() => {
          setIsPlaying(false);
          syncBackgroundAudio(false);
        });
    }

    return () => {
      if (el.currentTime > 0.2) {
        saveVideoTimestamp(video.id, el.currentTime, !el.paused);
      }
      el.pause();
      el.muted = true;
      el.preload = 'none';
      if (el.hasAttribute('src')) {
        el.removeAttribute('src');
        try {
          el.load();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    isInViewport,
    isNext,
    isMuted,
    isRamSaverMode,
    video.id,
    video.videoUrl,
    video.mediaType,
    video.sound.trackType,
    video.sound.audioUrl,
    originalVol,
    bgVol,
  ]);

  // Immediately pause & mute all active playback when app is minimized/screen-locked, and preserve exact timestamp
  useEffect(() => {
    if (!isActive) return;

    const pauseAndPersistNow = () => {
      const el = videoRef.current;
      const bgAudio = bgAudioRef.current;

      if (video.mediaType === 'image') {
        wasPlayingBeforeHideRef.current = isPlaying;
      } else if (el) {
        const nowSec = el.currentTime || 0;
        wasPlayingBeforeHideRef.current = !el.paused || isPlaying;
        if (nowSec > 0) {
          pendingResumeTimeRef.current = nowSec;
          saveVideoTimestamp(video.id, nowSec, !el.paused);
        }
        el.muted = true;
        if (!el.paused) {
          el.pause();
        }
      }

      if (bgAudio) {
        bgAudio.muted = true;
        if (!bgAudio.paused) {
          bgAudio.pause();
        }
      }

      soundEngine.suspendAll();
      setIsPlaying(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        pauseAndPersistNow();
        return;
      }

      if (document.visibilityState === 'visible' && isInViewport) {
        if (video.mediaType === 'image') {
          if (wasPlayingBeforeHideRef.current) {
            setIsPlaying(true);
            syncBackgroundAudio(true);
          }
          return;
        }

        const el = videoRef.current;
        if (!el) return;
        const savedSec =
          pendingResumeTimeRef.current > 0.2
            ? pendingResumeTimeRef.current
            : getSavedVideoTimestamp(video.id);

        if (el.getAttribute('src') !== video.videoUrl) {
          el.setAttribute('src', video.videoUrl);
        }
        if (savedSec > 0.25 && Math.abs(el.currentTime - savedSec) > 0.8) {
          try {
            el.currentTime = savedSec;
            setCurrentTime(savedSec);
          } catch {
            pendingResumeTimeRef.current = savedSec;
          }
        }
        if (wasPlayingBeforeHideRef.current) {
          el.volume = Math.max(0, Math.min(1, originalVol));
          el.muted = isMuted || originalVol <= 0.01;
          el.play()
            .then(() => {
              setIsPlaying(true);
              syncBackgroundAudio(true);
            })
            .catch(() => {
              setIsPlaying(false);
              syncBackgroundAudio(false);
            });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', pauseAndPersistNow as EventListener);
    window.addEventListener('pagehide', pauseAndPersistNow);
    window.addEventListener('blur', pauseAndPersistNow);
    window.addEventListener('beforeunload', pauseAndPersistNow);
    window.addEventListener('jatt-app-backgrounded', pauseAndPersistNow as EventListener);

    return () => {
      pauseAndPersistNow();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', pauseAndPersistNow as EventListener);
      window.removeEventListener('pagehide', pauseAndPersistNow);
      window.removeEventListener('blur', pauseAndPersistNow);
      window.removeEventListener('beforeunload', pauseAndPersistNow);
      window.removeEventListener('jatt-app-backgrounded', pauseAndPersistNow as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isInViewport, video.id, video.videoUrl, video.mediaType, isMuted, originalVol]);

  // Clean up decoder & audio on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        if (isActive && videoRef.current.currentTime > 0.2) {
          saveVideoTimestamp(video.id, videoRef.current.currentTime, !videoRef.current.paused);
        }
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        try {
          videoRef.current.load();
        } catch {
          // ignore
        }
      }
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current && isActive) {
      videoRef.current.volume = Math.max(0, Math.min(1, originalVol));
      videoRef.current.muted = isMuted || originalVol <= 0.01;
    }
    if (isActive) {
      syncBackgroundAudio(isPlaying);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, isActive, isPlaying, video.sound.trackType, video.sound.audioUrl, originalVol, bgVol]);

  // Handle single tap (play/pause) & double tap (like with burst)
  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap triggered!
      lastTapRef.current = 0;
      handleDoubleTapLike(e);
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        // If no second tap occurred within window, treat as single tap play/pause
        if (lastTapRef.current === now) {
          togglePlayPause();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleDoubleTapLike = (e: React.MouseEvent<HTMLDivElement>) => {
    soundEngine.playLikeSound();

    if (!video.isLiked) {
      onLikeToggle(video.id);
      onShowToast('Liked!');
    }

    // Skip floating particle burst animations in Lite / 3GB RAM Saver Mode
    if (isRamSaverMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x,
      y,
      rotation: (Math.random() - 0.5) * 40,
    };

    setFloatingHearts((prev) => [...prev.slice(-3), newHeart]);

    // Clean up heart after animation
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1000);
  };

  const togglePlayPause = () => {
    if (video.mediaType === 'image') {
      if (isPlaying) {
        syncBackgroundAudio(false);
        setIsPlaying(false);
      } else {
        syncBackgroundAudio(true);
        setIsPlaying(true);
      }
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 700);
      return;
    }

    const el = videoRef.current;
    if (!el && !videoError) return;

    if (isPlaying) {
      if (el) el.pause();
      syncBackgroundAudio(false);
      setIsPlaying(false);
    } else {
      if (el) el.play().catch(() => {});
      syncBackgroundAudio(true);
      setIsPlaying(true);
    }

    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 700);
  };

  // Video time update + continuous persistence (throttled ~400ms)
  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      const sec = videoRef.current.currentTime;
      setCurrentTime(sec);
      setDuration(videoRef.current.duration || 0);
      if (isActive && sec > 0) {
        const now = Date.now();
        if (now - lastSavedStampRef.current >= 400) {
          lastSavedStampRef.current = now;
          saveVideoTimestamp(video.id, sec, !videoRef.current.paused);
        }
      }
    }
  };

  // Interactive TikTok-style touch/pointer/click scrubbing
  const scrubToClientX = (clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setScrubHoverPercent(pct * 100);
    const mediaDur = videoRef.current?.duration || duration || 0;
    const targetTime = mediaDur > 0 ? pct * mediaDur : 0;
    if (videoRef.current && mediaDur > 0) {
      videoRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
    if (isActive && mediaDur > 0) {
      saveVideoTimestamp(video.id, targetTime, !videoRef.current?.paused);
    }
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unsupported
    }
    wasPlayingBeforeScrubRef.current = Boolean(videoRef.current && !videoRef.current.paused);
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    setIsScrubbing(true);
    scrubToClientX(e.clientX);
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    scrubToClientX(e.clientX);
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    scrubToClientX(e.clientX);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    setIsScrubbing(false);
    setScrubHoverPercent(null);
    if (wasPlayingBeforeScrubRef.current && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Format large numbers (e.g. 142800 -> 142.8K)
  const formatCount = (num: number): string => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Direct download to device gallery for videos/images in the feed (checks creator privacy)
  const handleDownloadMedia = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (!isDownloadAllowed) {
      setIsDownloadBlockedOpen(true);
      onShowToast(
        'Download Disabled: The creator has kept this video private and it cannot be downloaded.'
      );
      return;
    }

    if (!video.videoUrl || isDownloadingReel) return;

    const cleanName = (video.title || 'JattVibeReels_Media')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40);
    const ext =
      video.mediaType === 'image'
        ? 'jpg'
        : video.videoUrl.toLowerCase().includes('.webm')
        ? 'webm'
        : 'mp4';
    const filename = `${cleanName}_${Date.now()}.${ext}`;

    setIsDownloadingReel(true);
    soundEngine.playDownloadStart();
    onShowToast('Saving to device gallery...');

    try {
      let downloadHref = video.videoUrl;
      let createdObjectUrl: string | null = null;
      let fetchedMediaBlob: Blob | undefined;

      if (!video.videoUrl.startsWith('blob:') && !video.videoUrl.startsWith('data:')) {
        try {
          const response = await fetch(video.videoUrl);
          if (response.ok) {
            fetchedMediaBlob = await response.blob();
            createdObjectUrl = URL.createObjectURL(fetchedMediaBlob);
            downloadHref = createdObjectUrl;
          }
        } catch {
          // Cross-origin fallback: let browser anchor handle download/open
        }
      }

      const link = document.createElement('a');
      link.href = downloadHref;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (createdObjectUrl) {
        setTimeout(() => URL.revokeObjectURL(createdObjectUrl!), 8000);
      }

      // Also store inside Profile -> Saved / Downloads for instant offline playback
      void savePostForOffline(video, {
        mediaBlob: fetchedMediaBlob,
        sourceType: 'downloaded',
      });

      onDownloadTracked?.(video.id);
      soundEngine.playDownloadComplete();
      onShowToast('Downloaded & saved for Offline Mode! Check Saved / Downloads.');
    } catch {
      void savePostForOffline(video, { sourceType: 'downloaded' });
      onDownloadTracked?.(video.id);
      onShowToast('Download triggered (check browser downloads).');
    } finally {
      setIsDownloadingReel(false);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const optimizedPoster = optimizeThumbnailUrl(
    video.posterUrl,
    isRamSaverMode ? 'grid' : 'hero',
    isRamSaverMode
  );
  const effectivePoster = cachedThumb || optimizedPoster;

  // Strict virtualization: unmount video DOM completely for off-screen cards outside [active-1 .. active+1]
  if (!isNearViewport && !isActive && !isNext) {
    return (
      <div
        ref={cardRootRef}
        data-reel-index={cardIndex}
        className="relative w-full h-full snap-item gpu-accelerated bg-neutral-950 flex items-center justify-center overflow-hidden"
        style={{ contain: 'strict' }}
      >
        <VideoThumbnail
          videoUrl={video.videoUrl}
          posterUrl={effectivePoster}
          mediaType={video.mediaType}
          title={video.title}
          mode="grid"
          isRamSaverMode={isRamSaverMode}
          fallbackGradient={video.fallbackGradient}
          className="w-full h-full object-cover sm:object-contain sm:max-w-md opacity-45"
        />
      </div>
    );
  }

  // Strictly ONLY 1 active <video> and <audio> element mounted in the entire DOM at any time
  const canPlayMediaNow = isActive && isInViewport;

  return (
    <div
      ref={cardRootRef}
      data-reel-index={cardIndex}
      className="relative w-full h-full snap-item turbo-card gpu-accelerated flex items-center justify-center bg-black select-none overflow-hidden"
    >
      <div className="relative w-full h-full gpu-accelerated flex items-center justify-center overflow-hidden">
      {/* Attached Custom Song / Naat Audio Player (strictly mounted ONLY on active visible card) */}
      {hasExternalAudio && canPlayMediaNow && (
        <audio
          ref={bgAudioRef}
          src={video.sound.audioUrl}
          loop
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          className="hidden"
        />
      )}

      {/* Video / Procedural Viewport Area */}
      <div
        className="relative w-full h-full gpu-accelerated flex items-center justify-center cursor-pointer"
        onClick={handleVideoAreaClick}
      >
        {/* Image Post OR HTML5 Video element (9:16 Vertical Reels or Natural Landscape) */}
        {video.mediaType === 'image' ? (
          <div
            className={
              isLandscape
                ? 'relative w-full max-w-4xl aspect-video mx-auto rounded-none sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800/60 flex items-center justify-center gpu-accelerated'
                : 'relative w-full h-full sm:max-w-[440px] mx-auto flex items-center justify-center gpu-accelerated'
            }
          >
            <img
              src={video.videoUrl}
              alt={video.title}
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > img.naturalHeight * 1.12) {
                  setIsLandscape(true);
                }
              }}
              className="w-full h-full object-contain gpu-accelerated"
            />
            {isPlaying && !cleanMode && (
              <div
                className={`absolute top-16 z-20 px-2.5 py-1 rounded-full bg-neutral-950/85 border border-pink-500/40 flex items-center gap-1.5 pointer-events-none ${
                  isLeftControls ? 'right-4' : 'left-4'
                }`}
              >
                <Music className={`w-3 h-3 text-pink-400 ${isRamSaverMode ? '' : 'animate-pulse'}`} />
                <span className="text-[10px] font-black text-pink-200 tracking-wide">
                  {video.sound.category === 'naat' ? 'Naat Audio-Visual' : 'Photo + Audio'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {!videoError && canPlayMediaNow ? (
              <div
                className={
                  isLandscape
                    ? 'w-full max-w-4xl aspect-video mx-auto rounded-none sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800/60 flex items-center justify-center gpu-accelerated'
                    : 'w-full h-full sm:max-w-[440px] mx-auto flex items-center justify-center gpu-accelerated'
                }
              >
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  poster={effectivePoster || undefined}
                  playsInline
                  loop
                  muted={isMuted}
                  preload="auto"
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onCanPlay={() => {
                    if (isActive && videoRef.current) {
                      applySavedTimestampIfNeeded(videoRef.current);
                    }
                  }}
                  onLoadedData={() => {
                    if (videoRef.current && !effectivePoster && video.videoUrl) {
                      const captured = captureVideoFrameDataUrl(videoRef.current, 360);
                      if (captured) {
                        setCachedVideoThumbnail(video.videoUrl, captured);
                        setCachedThumb(captured);
                      }
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                      if (isActive) {
                        applySavedTimestampIfNeeded(videoRef.current);
                      }
                      const { videoWidth, videoHeight } = videoRef.current;
                      if (videoWidth > 0 && videoHeight > 0) {
                        setIsLandscape(videoWidth > videoHeight * 1.12);
                      }
                    }
                  }}
                  onError={() => {
                    if (isActive) setVideoError(true);
                  }}
                  className={
                    isLandscape
                      ? 'w-full h-full object-contain [transform:translate3d(0,0,0)] will-change-transform'
                      : 'w-full h-full object-cover sm:object-contain [transform:translate3d(0,0,0)] will-change-transform'
                  }
                />
              </div>
            ) : !videoError ? (
              /* Off-screen adjacent card: strict preloading for Next +1 video ONLY; zero video DOM for prev cards */
              <div className="w-full h-full sm:max-w-[440px] mx-auto flex items-center justify-center bg-neutral-950 gpu-accelerated">
                <VideoThumbnail
                  videoUrl={video.videoUrl}
                  posterUrl={effectivePoster}
                  mediaType={video.mediaType}
                  title={video.title}
                  mode={isRamSaverMode ? 'grid' : 'hero'}
                  isRamSaverMode={isRamSaverMode}
                  fallbackGradient={video.fallbackGradient}
                  className="w-full h-full object-cover sm:object-contain opacity-90 gpu-accelerated"
                />
                {isNext && !isActive && video.videoUrl && (
                  <video
                    src={video.videoUrl}
                    preload={isRamSaverMode ? 'none' : 'metadata'}
                    muted
                    playsInline
                    crossOrigin="anonymous"
                    className="hidden"
                    aria-hidden="true"
                  />
                )}
              </div>
            ) : null}

            {/* Fallback visual if video fails or is unsupported (lightweight static card in RAM Saver Mode) */}
            {videoError && (
              <div
                className={`relative w-full h-full flex items-center justify-center [transform:translateZ(0)] ${
                  isRamSaverMode ? `bg-gradient-to-b ${video.fallbackGradient || 'from-neutral-900 to-black'}` : ''
                }`}
              >
                {!isRamSaverMode && <ProceduralCanvas theme={video.category} isPlaying={isPlaying} />}
                <div className="absolute top-16 left-4 z-20 bg-neutral-900/90 px-3 py-1.5 rounded-full border border-neutral-700/60 flex items-center gap-2 [transform:translateZ(0)]">
                  <span className={`w-2 h-2 rounded-full bg-pink-500 ${isRamSaverMode ? '' : 'animate-ping'}`} />
                  <span className="text-[11px] font-semibold text-neutral-300">Live Visual Reel</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Play/Pause Animated Center Icon */}
        {showPlayIcon && (
          <div className="absolute z-30 pointer-events-none w-20 h-20 rounded-full bg-neutral-950/85 border border-white/20 flex items-center justify-center text-white scale-110 transition-transform duration-200 animate-in zoom-in-50 [transform:translateZ(0)]">
            {isPlaying ? (
              <Play className="w-10 h-10 fill-white translate-x-1" />
            ) : (
              <Pause className="w-10 h-10 fill-white" />
            )}
          </div>
        )}

        {/* Floating Heart Bursts from Double Tap */}
        {floatingHearts.map((h) => (
          <div
            key={h.id}
            style={{
              left: `${h.x}px`,
              top: `${h.y}px`,
              transform: `translate3d(-50%, -50%, 0) rotate(${h.rotation}deg)`,
            }}
            className="absolute z-40 pointer-events-none animate-in fade-in zoom-in-150 duration-500 ease-out flex items-center justify-center text-rose-500 filter drop-shadow-lg [transform:translateZ(0)]"
          >
            <Heart className="w-24 h-24 fill-rose-500 text-rose-500 stroke-2 animate-bounce" />
          </div>
        ))}
      </div>

      {/* Top Scrim Bar & Floating Quick-Action Pill (Hide/Show UI + Swap L/R) */}
      <div
        className={`absolute top-0 left-0 right-0 h-24 pointer-events-none z-40 flex items-start justify-between px-3 sm:px-4 pt-4 sm:mx-auto transition-all duration-200 [transform:translateZ(0)] ${
          cleanMode ? 'bg-transparent' : 'bg-gradient-to-b from-black/80 via-black/30 to-transparent'
        } ${isLandscape ? 'sm:max-w-4xl' : 'sm:max-w-[440px]'}`}
      >
        {/* Left: Audio Mute / Unmute (hidden in Clean Screen Mode) */}
        <div
          className={`flex items-center gap-1.5 transition-all duration-200 [transform:translateZ(0)] ${
            cleanMode ? 'opacity-0 pointer-events-none scale-95' : 'pointer-events-auto opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
              soundEngine.setMuted(!isMuted);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-neutral-900/90 border border-white/15 text-white hover:bg-neutral-800 active:scale-95 transition-all text-xs font-semibold [transform:translateZ(0)]"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-neutral-300" />
                <span className="text-[11px] text-neutral-300 hidden xs:inline">Tap to unmute</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-pink-400 animate-pulse" />
                <span className="text-[11px] text-pink-400 hidden xs:inline">Audio on</span>
              </>
            )}
          </button>
        </div>

        {/* Center/Right: Floating Quick-Action Pill + Views + Delete */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Floating Quick-Action Pill: (1) Hide/Show UI  (2) Swap Left/Right */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center rounded-full border shadow-lg transition-all [transform:translateZ(0)] ${
              cleanMode
                ? 'bg-neutral-950/85 border-white/25 hover:bg-neutral-900'
                : 'bg-neutral-900/95 border-white/15'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleClean();
                onShowToast(
                  cleanMode
                    ? 'Video controls restored'
                    : 'Clean Screen Mode — tap Show UI anytime'
                );
              }}
              aria-pressed={cleanMode}
              aria-label={cleanMode ? 'Show video UI' : 'Hide video UI'}
              title={cleanMode ? 'Show UI controls' : 'Clean Screen Mode (Hide UI)'}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                cleanMode
                  ? 'text-cyan-300 hover:text-white rounded-full'
                  : 'text-white hover:text-cyan-300 rounded-l-full'
              }`}
            >
              {cleanMode ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Show UI</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Hide UI</span>
                </>
              )}
            </button>

            {onSwapControlsSide && !cleanMode && (
              <>
                <span className="w-px h-3.5 bg-white/15" aria-hidden="true" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwapControlsSide();
                    onShowToast(
                      isLeftControls
                        ? 'Controls swapped to Right side'
                        : 'Controls swapped to Left side'
                    );
                  }}
                  aria-pressed={isLeftControls}
                  aria-label="Swap left and right feed controls"
                  title={
                    isLeftControls
                      ? 'Controls on Left — tap to switch to Right side'
                      : 'Controls on Right — tap to switch to Left side'
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-r-full text-[11px] font-bold transition-colors cursor-pointer ${
                    isLeftControls
                      ? 'text-white hover:text-pink-300'
                      : 'text-pink-300 hover:text-white'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-pink-400" />
                  <span>Swap</span>
                </button>
              </>
            )}
          </div>

          {!cleanMode && (
            <>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-neutral-900/90 border border-white/15 text-white text-[11px] font-bold tabular-nums [transform:translateZ(0)]"
                title="Total Views"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>{formatCount(video.stats.views)}</span>
              </div>

              {isOwnPost && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmingDelete(true);
                  }}
                  className="p-1.5 rounded-full bg-rose-600/85 hover:bg-rose-500 text-white border border-rose-300/40 shadow-md active:scale-95 transition-all cursor-pointer [transform:translateZ(0)]"
                  title="Delete this uploaded post"
                  aria-label="Delete post"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* In-App Delete Post Confirmation Modal */}
      {isConfirmingDelete && (
        <div
          className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsConfirmingDelete(false);
          }}
        >
          <div
            className="w-full max-w-xs bg-neutral-950 border border-rose-500/45 rounded-2xl p-5 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">Delete Uploaded Post?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This will permanently remove &ldquo;{video.title}&rdquo; from your feed and Profile.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="flex-1 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold border border-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  onDeletePost?.(video.id);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Download Privacy Warning Popup */}
      {isDownloadBlockedOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsDownloadBlockedOpen(false);
          }}
        >
          <div
            className="w-full max-w-xs bg-neutral-950 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-white">Download Disabled</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Download Disabled: The creator has kept this video private and it cannot be downloaded.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDownloadBlockedOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:brightness-110 text-white text-xs font-black shadow-lg cursor-pointer"
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {/* Vertical Overlay Action Buttons (Left Side by default, switchable via Swap toggle, hidden in Clean Screen Mode) */}
      <div
        className={`absolute bottom-24 sm:bottom-20 z-30 flex flex-col items-center gap-4 sm:max-w-md transition-all duration-300 ease-out [transform:translateZ(0)] ${
          isLeftControls ? 'left-3' : 'right-3'
        } ${cleanMode ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto'}`}
      >
        {/* Creator Avatar with Follow Button */}
        <div className="relative mb-1 flex flex-col items-center">
          <button
            type="button"
            className="relative w-11 h-11 rounded-full p-0.5 border-2 border-white/80 overflow-hidden shadow-md hover:scale-105 active:scale-95 transition-transform bg-neutral-900 cursor-pointer [transform:translateZ(0)]"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenCreatorProfile) {
                onOpenCreatorProfile(video.creator.username, video.creator, video.userId);
              } else {
                onShowToast(`Viewing profile @${video.creator.username}`);
              }
            }}
            title={`Open @${video.creator.username} channel`}
          >
            <img
              src={video.creator.avatar}
              alt={video.creator.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
          {!isOwnPost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFollowToggle(video.creator.username);
              }}
              className={`absolute -bottom-2 w-5 h-5 rounded-full text-white flex items-center justify-center shadow-sm active:scale-90 transition-transform cursor-pointer ${
                effectiveIsMutual
                  ? 'bg-cyan-500 hover:bg-cyan-400'
                  : effectiveIsFollowing
                  ? 'bg-emerald-500 hover:bg-emerald-400'
                  : 'bg-rose-500 hover:bg-rose-400'
              }`}
              aria-label={
                effectiveIsMutual
                  ? 'Mutual Friends - click to unfollow'
                  : effectiveIsFollowing
                  ? 'Following - click to unfollow'
                  : 'Follow creator'
              }
              title={
                effectiveIsMutual
                  ? 'Mutual Friends (tap to unfollow)'
                  : effectiveIsFollowing
                  ? 'Following (tap to unfollow)'
                  : isFollowerCreator
                  ? 'Follow Back'
                  : 'Follow'
              }
            >
              {effectiveIsMutual ? (
                <Users className="w-3 h-3 stroke-[2.5]" />
              ) : effectiveIsFollowing ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </button>
          )}
        </div>

        {/* Like Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLikeToggle(video.id);
            soundEngine.playLikeSound();
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          aria-label={video.isLiked ? 'Unlike' : 'Like'}
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all [transform:translateZ(0)] ${
              video.isLiked
                ? 'bg-red-500/25 border border-red-500/40 text-red-500 shadow-md shadow-red-500/20'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/10'
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-all ${
                video.isLiked
                  ? 'fill-red-500 text-red-500 scale-110'
                  : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {video.stats.likes.toLocaleString()}
          </span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments(video);
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          aria-label="Comments"
        >
          <div className="w-11 h-11 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/10 flex items-center justify-center transition-all group-hover:scale-105 [transform:translateZ(0)]">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {video.stats.comments.toLocaleString()}
          </span>
        </button>

        {/* Save / Bookmark Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSaveToggle(video.id);
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          aria-label={video.isSaved ? 'Remove from bookmarks' : 'Bookmark video'}
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all [transform:translateZ(0)] ${
              video.isSaved
                ? 'bg-amber-500/25 border border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/10'
            }`}
          >
            <Bookmark
              className={`w-5 h-5 transition-all ${
                video.isSaved
                  ? 'fill-amber-400 text-amber-400 scale-110'
                  : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {formatCount(video.stats.saves)}
          </span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenShare(video);
          }}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
          aria-label="Share reel"
        >
          <div className="w-11 h-11 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/10 flex items-center justify-center transition-all group-hover:scale-105 [transform:translateZ(0)]">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {formatCount(video.stats.shares)}
          </span>
        </button>

        {/* Direct Download / Save to Gallery Button */}
        <button
          type="button"
          disabled={isDownloadingReel}
          onClick={handleDownloadMedia}
          className="flex flex-col items-center gap-1 group active:scale-90 transition-transform disabled:opacity-60"
          aria-label={isDownloadAllowed ? 'Download or save to gallery' : 'Download disabled by creator'}
          title={
            isDownloadAllowed
              ? 'Download / Save to Device Gallery'
              : 'Private Video: Download Disabled by Creator'
          }
        >
          <div
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all group-hover:scale-105 [transform:translateZ(0)] ${
              isDownloadAllowed
                ? 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-400/40'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-amber-400 border border-amber-500/45'
            }`}
          >
            {isDownloadAllowed ? (
              <Download className={`w-5 h-5 text-cyan-300 ${isDownloadingReel ? 'animate-bounce' : ''}`} />
            ) : (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <span
            className={`text-[11px] font-bold drop-shadow-md tabular-nums ${
              isDownloadAllowed ? 'text-cyan-300' : 'text-amber-300'
            }`}
          >
            {isDownloadAllowed
              ? isDownloadingReel
                ? 'Saving'
                : formatCount(video.stats.downloads)
              : 'Private'}
          </span>
        </button>

        {/* Spinning Vinyl Record with Floating Musical Notes */}
        <div
          className="relative mt-1 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onShowToast(`Sound: "${video.sound.title}" by ${video.sound.artist}`);
          }}
        >
          {/* Floating musical note particles (disabled in RAM Saver Mode) */}
          {isPlaying && !isRamSaverMode && (
            <>
              <span className="absolute text-pink-400 text-xs font-bold pointer-events-none animate-float-note-1">
                ♪
              </span>
              <span className="absolute text-purple-300 text-xs font-bold pointer-events-none animate-float-note-2">
                ♫
              </span>
            </>
          )}
          <div
            className={`w-11 h-11 rounded-full bg-neutral-900 border-2 border-neutral-700/80 p-1 flex items-center justify-center shadow-xl ${
              isPlaying && !isRamSaverMode ? 'animate-spin-slow' : ''
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-neutral-950 border border-neutral-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Information & Caption Scrim (Hidden cleanly in Clean Screen Mode) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 pt-16 pb-6 px-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none flex flex-col justify-end sm:mx-auto transition-opacity duration-200 ${
          isLandscape ? 'sm:max-w-4xl' : 'sm:max-w-[440px]'
        } ${cleanMode ? 'opacity-0' : 'opacity-100'}`}
      >
        <div
          className={`flex flex-col transition-all duration-300 ease-out ${
            cleanMode ? 'pointer-events-none' : 'pointer-events-auto'
          } ${
            isLeftControls
              ? 'pl-16 pr-0 right-4 items-end text-right'
              : 'pr-16 pl-0 items-start text-left'
          }`}
        >
          {/* Clickable Creator Handle + Interactive Follow / Following / Friends Pill */}
          <div
            className={`flex items-center flex-wrap gap-1.5 mb-1 ${
              isLeftControls ? 'justify-end' : 'justify-start'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenCreatorProfile) {
                  onOpenCreatorProfile(video.creator.username, video.creator, video.userId);
                } else {
                  onShowToast(`Viewing profile @${video.creator.username}`);
                }
              }}
              className="text-sm font-bold text-white hover:text-pink-400 hover:underline tracking-tight drop-shadow-md transition-colors cursor-pointer"
              title={`Visit @${video.creator.username} channel`}
            >
              @{video.creator.username}
            </button>
            {video.creator.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/20 shrink-0" />
            )}
            {!isOwnPost && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFollowToggle(video.creator.username);
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                  effectiveIsMutual
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30'
                    : effectiveIsFollowing
                    ? 'bg-neutral-900/90 border-emerald-500/50 text-emerald-300 hover:bg-neutral-800'
                    : isFollowerCreator
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 border-pink-400/50 text-white shadow-sm'
                    : 'bg-rose-600 hover:bg-rose-500 border-rose-400/50 text-white shadow-sm'
                }`}
                title={
                  effectiveIsMutual
                    ? 'Mutual Friends — tap to unfollow'
                    : effectiveIsFollowing
                    ? 'Following — tap to unfollow'
                    : isFollowerCreator
                    ? 'Follow Back to become Friends'
                    : 'Follow creator'
                }
              >
                {effectiveIsMutual ? (
                  <>
                    <Users className="w-2.5 h-2.5" />
                    <span>Friends</span>
                  </>
                ) : effectiveIsFollowing ? (
                  <>
                    <Check className="w-2.5 h-2.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <span>{isFollowerCreator ? 'Follow Back' : 'Follow'}</span>
                )}
              </button>
            )}
            {!isOwnPost && onMessageCreator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageCreator({
                    id: video.userId || `creator-${video.creator.username}`,
                    name: video.creator.name,
                    username: video.creator.username,
                    avatar: video.creator.avatar,
                    isVerified: video.creator.isVerified,
                  });
                }}
                className="px-2 py-0.5 rounded-full text-[10px] font-black border border-white/25 bg-black/55 hover:bg-pink-600/80 hover:border-pink-400 text-white flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title={`Message @${video.creator.username}`}
              >
                <MessageCircle className="w-2.5 h-2.5 text-pink-300" />
                <span>Message</span>
              </button>
            )}
            <span className="text-xs text-neutral-400 font-medium">
              · {video.createdAt ? formatRelativeTime(video.createdAt) : '1d ago'}
            </span>
          </div>

          {/* Caption & Hashtags Hidden Under More / Less Toggle */}
          {(() => {
            const hasInlineTags = /(?:^|\s)#[^\s#]+/.test(video.description || '');
            const collapsedText = (video.description || '')
              .replace(/(?:^|\s)#[^\s#]+/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            const canToggleExpand =
              (video.description || '').length > 70 ||
              video.hashtags.length > 0 ||
              hasInlineTags;

            return (
              <div
                className={`text-xs text-neutral-100 leading-relaxed drop-shadow-sm mb-2.5 flex flex-col ${
                  isLeftControls ? 'items-end text-right' : 'items-start text-left'
                }`}
              >
                {captionExpanded ? (
                  <p>{video.description}</p>
                ) : (
                  collapsedText && <p className="line-clamp-2">{collapsedText}</p>
                )}

                {/* Hashtags remain completely hidden by default until user clicks "More" */}
                {captionExpanded && video.hashtags.length > 0 && (
                  <div
                    className={`flex flex-wrap gap-1.5 mt-2 ${
                      isLeftControls ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {video.hashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onHashtagClick?.(tag);
                          onShowToast(`Filtered by #${tag}`);
                        }}
                        className="text-xs font-bold text-pink-400 hover:text-pink-300 hover:underline transition-colors cursor-pointer"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {canToggleExpand && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCaptionExpanded((prev) => !prev);
                    }}
                    className="text-[11px] font-bold text-neutral-300 hover:text-white mt-1 inline-block cursor-pointer"
                  >
                    {captionExpanded ? 'Less' : 'More'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Sound Ticker Marquee */}
          <div
            className={`flex items-center gap-2 text-xs text-neutral-200 overflow-hidden max-w-[260px] ${
              isLeftControls ? 'justify-end ml-auto text-right' : 'justify-start text-left'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            {video.sound.category === 'naat' && (
              <span className="px-1.5 py-0.2 rounded-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase shrink-0">
                Naat
              </span>
            )}
            <div className="overflow-hidden whitespace-nowrap">
              {isRamSaverMode ? (
                <span className="inline-block font-medium truncate max-w-[215px]">
                  {video.sound.title} · {video.sound.artist}
                </span>
              ) : (
                <span className="animate-marquee inline-block font-medium">
                  {video.sound.title} · {video.sound.artist} &nbsp;&nbsp;&nbsp;&nbsp; {video.sound.title} · {video.sound.artist}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TikTok-Style Interactive Video Progress Bar (Scrubber) */}
        {video.mediaType !== 'image' && (
          <div
            ref={progressBarRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={handleScrubPointerUp}
            onPointerCancel={handleScrubPointerUp}
            className="pointer-events-auto relative group mt-3 w-full h-7 flex items-end cursor-pointer touch-none select-none pb-1"
            role="slider"
            aria-label="Seek video timeline"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(currentTime)}
          >
            {/* Floating Current Time / Total Duration Pill while Scrubbing */}
            {isScrubbing && (
              <div
                style={{
                  left: `${Math.max(12, Math.min(88, scrubHoverPercent ?? progressPercent))}%`,
                }}
                className=" -translate-x-1/2 -top-8 absolute px-3 py-1 rounded-full bg-neutral-950/95 border border-pink-500/60 text-white text-xs font-black tracking-wider tabular-nums shadow-xl whitespace-nowrap pointer-events-none z-40"
              >
                <span className="text-pink-400">{formatTime(currentTime)}</span>
                <span className="text-neutral-500 mx-1">/</span>
                <span className="text-neutral-200">{formatTime(duration)}</span>
              </div>
            )}

            <div
              className={`relative w-full rounded-full transition-all duration-100 ${
                isScrubbing
                  ? 'h-2 bg-white/35 shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                  : 'h-1 bg-white/25 group-hover:h-1.5'
              }`}
            >
              <div
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-cyan-400 rounded-full relative"
              >
                <div
                  className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-2 ring-pink-500 transition-transform ${
                    isScrubbing
                      ? 'w-4 h-4 scale-110 opacity-100'
                      : 'w-2.5 h-2.5 opacity-0 group-hover:opacity-100'
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export const VideoCard = React.memo(VideoCardComponent);

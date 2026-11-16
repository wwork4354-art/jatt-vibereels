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
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { VideoPost } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { ProceduralCanvas } from './ProceduralCanvas';
import { formatRelativeTime } from '../lib/supabaseService';
import { savePostForOffline } from '../lib/offlineMediaStore';

interface VideoCardProps {
  video: VideoPost;
  isActive: boolean;
  isNext?: boolean;
  isNearViewport?: boolean;
  isMuted: boolean;
  currentUserId?: string;
  currentUsername?: string;
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
  isActive,
  isNext = false,
  isNearViewport = true,
  isMuted,
  currentUserId,
  currentUsername,
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
  onShowToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFillScreen, setIsFillScreen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isDownloadingReel, setIsDownloadingReel] = useState(false);

  const isOwnPost = Boolean(
    onDeletePost &&
      (video.isUserUploaded ||
        (currentUserId && video.userId === currentUserId) ||
        (currentUsername &&
          video.creator.username.toLowerCase() === currentUsername.toLowerCase()))
  );

  const lastTapRef = useRef<number>(0);
  const viewRecordedForActiveRef = useRef<boolean>(false);

  useEffect(() => {
    setIsLandscape(false);
    setVideoError(false);
  }, [video.id]);

  // Increment real-time post view count once the reel has been actively watched for 1.2s
  useEffect(() => {
    if (!isActive) {
      viewRecordedForActiveRef.current = false;
      return;
    }
    if (viewRecordedForActiveRef.current) return;

    const timer = window.setTimeout(() => {
      if (!viewRecordedForActiveRef.current) {
        viewRecordedForActiveRef.current = true;
        onViewTracked?.(video.id);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isActive, video.id, onViewTracked]);

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

  // Strict Lazy-Loading & Virtualization:
  // 1) Active reel: plays immediately at 60fps
  // 2) Very next reel (isNext): strictly preload="metadata" to save RAM & bandwidth
  // 3) All off-screen reels: pause & unload src/decoder immediately
  useEffect(() => {
    if (video.mediaType === 'image') {
      if (isNext && video.videoUrl) {
        const prefetch = new Image();
        prefetch.decoding = 'async';
        prefetch.src = video.videoUrl;
      }
      if (isActive) {
        setIsPlaying(true);
        syncBackgroundAudio(true);
      } else {
        if (bgAudioRef.current) bgAudioRef.current.pause();
        soundEngine.stopTrack();
      }
      return;
    }

    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      if (el.getAttribute('src') !== video.videoUrl) {
        el.setAttribute('src', video.videoUrl);
      }
      el.preload = 'auto';
      el.volume = Math.max(0, Math.min(1, originalVol));
      el.muted = isMuted || originalVol <= 0.01;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setVideoError(false);
            syncBackgroundAudio(true);
          })
          .catch(() => {
            setIsPlaying(false);
            syncBackgroundAudio(false);
          });
      }
    } else if (isNext) {
      el.pause();
      if (bgAudioRef.current) bgAudioRef.current.pause();
      setIsPlaying(false);
      el.muted = true;
      el.preload = 'metadata';
      if (video.videoUrl && el.getAttribute('src') !== video.videoUrl) {
        el.setAttribute('src', video.videoUrl);
      }
    } else {
      el.pause();
      if (bgAudioRef.current) bgAudioRef.current.pause();
      setIsPlaying(false);
      if (el.hasAttribute('src')) {
        el.removeAttribute('src');
        el.preload = 'none';
        try {
          el.load();
        } catch {
          // ignore
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isActive,
    isNext,
    isMuted,
    video.videoUrl,
    video.mediaType,
    video.sound.trackType,
    video.sound.audioUrl,
    originalVol,
    bgVol,
  ]);

  // Clean up decoder & audio on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
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
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x,
      y,
      rotation: (Math.random() - 0.5) * 40,
    };

    setFloatingHearts((prev) => [...prev, newHeart]);
    soundEngine.playLikeSound();

    if (!video.isLiked) {
      onLikeToggle(video.id);
      onShowToast('Liked!');
    }

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

  // Video time update
  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  // Scrubbing/seeking
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = percentage * (videoRef.current.duration || 1);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Format large numbers (e.g. 142800 -> 142.8K)
  const formatCount = (num: number): string => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Direct download to device gallery for videos/images in the feed
  const handleDownloadMedia = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
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

  // Strict virtualization: unmount video DOM completely for off-screen cards outside [active-1 .. active+1]
  if (!isNearViewport && !isActive && !isNext) {
    return (
      <div
        className="relative w-full h-[100dvh] snap-item bg-neutral-950 flex items-center justify-center overflow-hidden"
        style={{ contain: 'strict' }}
      >
        {video.posterUrl && (
          <img
            src={video.posterUrl}
            alt={video.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover sm:object-contain sm:max-w-md opacity-40"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] snap-item flex items-center justify-center bg-black select-none overflow-hidden">
      {/* Attached Custom Song / Naat Audio Player (when audioUrl exists) */}
      {hasExternalAudio && (
        <audio
          ref={bgAudioRef}
          src={isActive || isNext ? video.sound.audioUrl : undefined}
          loop
          playsInline
          crossOrigin="anonymous"
          preload={isActive ? 'auto' : isNext ? 'metadata' : 'none'}
          className="hidden"
        />
      )}

      {/* Video / Procedural Viewport Area */}
      <div
        className="relative w-full h-full flex items-center justify-center cursor-pointer"
        onClick={handleVideoAreaClick}
      >
        {/* Image Post OR HTML5 Video element (Playit-style Fill Screen or crisp 16:9 / 9:16 fit) */}
        {video.mediaType === 'image' ? (
          <div
            className={
              isFillScreen
                ? 'relative w-full h-full flex items-center justify-center overflow-hidden bg-black'
                : isLandscape
                ? 'relative w-full max-w-4xl aspect-video mx-auto rounded-none sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800/60 flex items-center justify-center'
                : 'relative w-full h-full sm:max-w-[440px] mx-auto flex items-center justify-center'
            }
          >
            <img
              src={video.videoUrl}
              alt={video.title}
              loading={isActive || isNext ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > img.naturalHeight * 1.12) {
                  setIsLandscape(true);
                }
              }}
              className={`w-full h-full [transform:translate3d(0,0,0)] will-change-transform ${
                isFillScreen ? 'object-cover' : 'object-contain'
              }`}
            />
            {isPlaying && (
              <div className="absolute top-16 left-4 z-20 px-2.5 py-1 rounded-full bg-neutral-950/85 border border-pink-500/40 flex items-center gap-1.5 pointer-events-none">
                <Music className="w-3 h-3 text-pink-400 animate-pulse" />
                <span className="text-[10px] font-black text-pink-200 tracking-wide">
                  {video.sound.category === 'naat' ? 'Naat Audio-Visual' : 'Photo + Audio'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {!videoError && (
              <div
                className={
                  isFillScreen
                    ? 'w-full h-full flex items-center justify-center overflow-hidden bg-black'
                    : isLandscape
                    ? 'w-full max-w-4xl aspect-video mx-auto rounded-none sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800/60 flex items-center justify-center'
                    : 'w-full h-full sm:max-w-[440px] mx-auto flex items-center justify-center'
                }
              >
                <video
                  ref={videoRef}
                  src={isActive || isNext ? video.videoUrl : undefined}
                  poster={video.posterUrl}
                  playsInline
                  loop
                  muted={isMuted || !isActive}
                  preload={isActive ? 'auto' : isNext ? 'metadata' : 'none'}
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
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
                    isFillScreen
                      ? 'w-full h-full object-cover [transform:translate3d(0,0,0)] will-change-transform'
                      : isLandscape
                      ? 'w-full h-full object-contain [transform:translate3d(0,0,0)] will-change-transform'
                      : 'w-full h-full object-cover sm:object-contain [transform:translate3d(0,0,0)] will-change-transform'
                  }
                />
              </div>
            )}

            {/* Fallback procedural 60fps canvas if video fails or is unsupported */}
            {videoError && (
              <div className="relative w-full h-full flex items-center justify-center [transform:translateZ(0)]">
                <ProceduralCanvas theme={video.category} isPlaying={isPlaying} />
                <div className="absolute top-16 left-4 z-20 bg-neutral-900/90 px-3 py-1.5 rounded-full border border-neutral-700/60 flex items-center gap-2 [transform:translateZ(0)]">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
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

      {/* Top Scrim Bar for Controls */}
      <div
        className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-20 flex items-start justify-between px-4 pt-4 sm:mx-auto [transform:translateZ(0)] ${
          isFillScreen ? 'max-w-none' : isLandscape ? 'sm:max-w-4xl' : 'sm:max-w-[440px]'
        }`}
      >
        {/* Audio Mute / Unmute + Playit Fill Screen Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
              soundEngine.setMuted(!isMuted);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-white/15 text-white hover:bg-neutral-800 active:scale-95 transition-all text-xs font-semibold [transform:translateZ(0)]"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-neutral-300" />
                <span className="text-[11px] text-neutral-300">Tap to unmute</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-pink-400 animate-pulse" />
                <span className="text-[11px] text-pink-400">Audio on</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFillScreen((prev) => !prev);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[10px] font-black tracking-wide transition-all cursor-pointer [transform:translateZ(0)] ${
              isFillScreen
                ? 'bg-pink-600/90 border-pink-400 text-white shadow-md shadow-pink-500/25'
                : 'bg-neutral-900/90 hover:bg-neutral-800 border-white/15 text-cyan-300'
            }`}
            title={isFillScreen ? 'Switch to Original Aspect Ratio' : 'Stretch to Fill Screen (Playit Style)'}
          >
            {isFillScreen ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
            <span>{isFillScreen ? 'Fit' : 'Fill Screen'}</span>
          </button>
        </div>

        {/* Live View Counter + Delete Post Button (own posts) */}
        <div className="pointer-events-auto flex items-center gap-1.5">
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

      {/* Right Side Overlay Action Buttons */}
      <div className="absolute right-3 bottom-18 sm:bottom-20 z-30 flex flex-col items-center gap-4.5 sm:max-w-md pointer-events-auto [transform:translateZ(0)]">
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
          {!video.creator.isFollowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFollowToggle(video.creator.username);
                onShowToast(`Followed @${video.creator.username}`);
              }}
              className="absolute -bottom-2 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-sm active:scale-90 transition-transform"
              aria-label="Follow creator"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}
          {video.creator.isFollowing && (
            <div className="absolute -bottom-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
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
          aria-label="Download or save to gallery"
          title="Download / Save to Device Gallery"
        >
          <div className="w-11 h-11 rounded-full bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-400/40 flex items-center justify-center transition-all group-hover:scale-105 [transform:translateZ(0)]">
            <Download className={`w-5 h-5 text-cyan-300 ${isDownloadingReel ? 'animate-bounce' : ''}`} />
          </div>
          <span className="text-[11px] font-bold text-cyan-300 drop-shadow-md tabular-nums">
            {isDownloadingReel ? 'Saving' : formatCount(video.stats.downloads)}
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
          {/* Floating musical note particles */}
          {isPlaying && (
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
              isPlaying ? 'animate-spin-slow' : ''
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-neutral-950 border border-neutral-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Information & Caption Scrim */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 pt-16 pb-6 px-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none flex flex-col justify-end sm:mx-auto ${
          isLandscape ? 'sm:max-w-4xl' : 'sm:max-w-[440px]'
        }`}
      >
        <div className="pointer-events-auto pr-14">
          {/* Clickable Creator Handle */}
          <div className="flex items-center gap-2 mb-1">
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
              <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/20" />
            )}
            <span className="text-xs text-neutral-400 font-medium">
              · {video.createdAt ? formatRelativeTime(video.createdAt) : '1d ago'}
            </span>
          </div>

          {/* Caption with Expand/Collapse */}
          <div className="text-xs text-neutral-100 leading-relaxed drop-shadow-sm mb-2">
            <p className={captionExpanded ? '' : 'line-clamp-2'}>
              {video.description}
            </p>
            {video.description.length > 70 && (
              <button
                type="button"
                onClick={() => setCaptionExpanded(!captionExpanded)}
                className="text-[11px] font-bold text-neutral-300 hover:text-white mt-0.5 inline-block"
              >
                {captionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>

          {/* Clickable Hashtags */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {video.hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHashtagClick?.(tag);
                  onShowToast(`Filtered by #${tag}`);
                }}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 hover:underline transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>

          {/* Sound Ticker Marquee */}
          <div className="flex items-center gap-2 text-xs text-neutral-200 overflow-hidden max-w-[260px]">
            <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            {video.sound.category === 'naat' && (
              <span className="px-1.5 py-0.2 rounded-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase shrink-0">
                Naat
              </span>
            )}
            <div className="overflow-hidden whitespace-nowrap">
              <span className="animate-marquee inline-block font-medium">
                {video.sound.title} · {video.sound.artist} &nbsp;&nbsp;&nbsp;&nbsp; {video.sound.title} · {video.sound.artist}
              </span>
            </div>
          </div>
        </div>

        {/* Video Scrubber / Progress Bar */}
        {video.mediaType !== 'image' && (
          <div
            ref={progressBarRef}
            onClick={(e) => {
              e.stopPropagation();
              handleScrub(e);
            }}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            className="pointer-events-auto group mt-3 w-full h-2.5 flex items-end cursor-pointer py-1"
          >
            <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
              <div
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-pink-500 rounded-full transition-all duration-75 relative"
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-md" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const VideoCard = React.memo(VideoCardComponent);

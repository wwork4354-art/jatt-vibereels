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
} from 'lucide-react';
import { VideoPost } from '../types';
import { soundEngine } from '../utils/soundEngine';
import { ProceduralCanvas } from './ProceduralCanvas';

interface VideoCardProps {
  video: VideoPost;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onLikeToggle: (id: string) => void;
  onSaveToggle: (id: string) => void;
  onFollowToggle: (creatorUsername: string) => void;
  onOpenComments: (video: VideoPost) => void;
  onOpenShare: (video: VideoPost) => void;
  onHashtagClick?: (tag: string) => void;
  onShowToast: (msg: string) => void;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  rotation: number;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isActive,
  isMuted,
  onToggleMute,
  onLikeToggle,
  onSaveToggle,
  onFollowToggle,
  onOpenComments,
  onOpenShare,
  onHashtagClick,
  onShowToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const lastTapRef = useRef<number>(0);

  // Smart Video Lazy-Loading: Only load and play the single video currently visible in viewport.
  // Pause and unload (preload='none') off-screen videos immediately so memory stays low and scrolling is 60fps.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      if (el.src !== video.videoUrl) {
        el.src = video.videoUrl;
      }
      el.preload = 'auto';
      el.currentTime = 0;
      el.muted = isMuted;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setVideoError(false);
            if (!isMuted) {
              soundEngine.playTrack(video.sound.trackType);
            }
          })
          .catch(() => {
            // Autoplay policy or format error
            setIsPlaying(false);
          });
      }
    } else {
      // Off-screen: pause, unload buffer, release hardware decoder
      el.pause();
      setIsPlaying(false);
      el.removeAttribute('src');
      el.preload = 'none';
      try {
        el.load(); // Forces immediate memory flush in mobile WebViews
      } catch {
        // ignore
      }
    }
  }, [isActive, isMuted, video.videoUrl, video.sound.trackType]);

  // Clean up decoder on unmount
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
    };
  }, []);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current && isActive) {
      videoRef.current.muted = isMuted;
    }
    if (isActive) {
      if (!isMuted) {
        soundEngine.playTrack(video.sound.trackType);
      } else {
        soundEngine.stopTrack();
      }
    }
  }, [isMuted, isActive, video.sound.trackType]);

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
    const el = videoRef.current;
    if (!el && !videoError) return;

    if (isPlaying) {
      if (el) el.pause();
      soundEngine.stopTrack();
      setIsPlaying(false);
    } else {
      if (el) el.play().catch(() => {});
      if (!isMuted) soundEngine.playTrack(video.sound.trackType);
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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full h-[100dvh] snap-item flex items-center justify-center bg-black select-none overflow-hidden">
      {/* Video / Procedural Viewport Area */}
      <div
        className="relative w-full h-full flex items-center justify-center cursor-pointer"
        onClick={handleVideoAreaClick}
      >
        {/* HTML5 Video element: only mounted/buffered when active */}
        {!videoError && (
          <video
            ref={videoRef}
            src={isActive ? video.videoUrl : undefined}
            poster={video.posterUrl}
            playsInline
            loop
            muted={isMuted}
            preload={isActive ? 'auto' : 'none'}
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
              }
            }}
            onError={() => {
              if (isActive) setVideoError(true);
            }}
            className="w-full h-full object-cover sm:object-contain sm:max-w-md mx-auto [transform:translateZ(0)]"
          />
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
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-20 flex items-start justify-between px-4 pt-4 sm:max-w-md sm:mx-auto [transform:translateZ(0)]">
        {/* Audio Mute / Unmute Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
            soundEngine.setMuted(!isMuted);
          }}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-white/15 text-white hover:bg-neutral-800 active:scale-95 transition-all text-xs font-semibold [transform:translateZ(0)]"
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
      </div>

      {/* Right Side Overlay Action Buttons */}
      <div className="absolute right-3 bottom-18 sm:bottom-20 z-30 flex flex-col items-center gap-4.5 sm:max-w-md pointer-events-auto [transform:translateZ(0)]">
        {/* Creator Avatar with Follow Button */}
        <div className="relative mb-1 flex flex-col items-center">
          <button
            type="button"
            className="relative w-11 h-11 rounded-full p-0.5 border-2 border-white/80 overflow-hidden shadow-md hover:scale-105 active:scale-95 transition-transform bg-neutral-900 [transform:translateZ(0)]"
            onClick={(e) => {
              e.stopPropagation();
              onShowToast(`Viewing profile @${video.creator.username}`);
            }}
          >
            <img
              src={video.creator.avatar}
              alt={video.creator.name}
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
                ? 'bg-rose-500/25 border border-rose-500/40 text-rose-500 shadow-md shadow-rose-500/20'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/10'
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-all ${
                video.isLiked
                  ? 'fill-rose-500 text-rose-500 scale-110'
                  : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {formatCount(video.stats.likes)}
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
            {formatCount(video.stats.comments)}
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
      <div className="absolute bottom-0 left-0 right-0 z-20 pt-16 pb-6 px-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none flex flex-col justify-end sm:max-w-md sm:mx-auto">
        <div className="pointer-events-auto pr-14">
          {/* Creator handle */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white tracking-tight drop-shadow-md">
              @{video.creator.username}
            </span>
            {video.creator.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-sky-400 fill-sky-400/20" />
            )}
            <span className="text-xs text-neutral-400 font-medium">· 1d ago</span>
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
          <div className="flex items-center gap-2 text-xs text-neutral-200 overflow-hidden max-w-[240px]">
            <Music className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
            <div className="overflow-hidden whitespace-nowrap">
              <span className="animate-marquee inline-block font-medium">
                {video.sound.title} · {video.sound.artist} &nbsp;&nbsp;&nbsp;&nbsp; {video.sound.title} · {video.sound.artist}
              </span>
            </div>
          </div>
        </div>

        {/* Video Scrubber / Progress Bar */}
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
      </div>
    </div>
  );
};

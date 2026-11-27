import React, { useState, useRef, useEffect } from 'react';
import { Film, Image as ImageIcon } from 'lucide-react';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import {
  appendMediaTimeFragment,
  captureVideoFrameDataUrl,
  getCachedVideoThumbnail,
  setCachedVideoThumbnail,
} from '../utils/videoThumbnail';

interface VideoThumbnailProps {
  videoUrl?: string;
  posterUrl?: string;
  mediaType?: 'video' | 'image';
  title?: string;
  mode?: 'grid' | 'hero';
  isRamSaverMode?: boolean;
  className?: string;
  fallbackGradient?: string;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  videoUrl = '',
  posterUrl = '',
  mediaType = 'video',
  title = 'Reel Preview',
  mode = 'grid',
  isRamSaverMode = false,
  className = 'w-full h-full object-cover',
  fallbackGradient = 'from-neutral-900 via-fuchsia-950/50 to-neutral-950',
}) => {
  const isImagePost = mediaType === 'image';
  const optimizedImageSrc = optimizeThumbnailUrl(
    isImagePost ? videoUrl : posterUrl,
    mode,
    isRamSaverMode
  );

  const [cachedFrame, setCachedFrame] = useState<string>(() =>
    !isImagePost && videoUrl ? getCachedVideoThumbnail(videoUrl) : ''
  );
  const [posterFailed, setPosterFailed] = useState<boolean>(false);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);
  const [didSeekFallback, setDidSeekFallback] = useState<boolean>(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setPosterFailed(false);
    setVideoFailed(false);
    setDidSeekFallback(false);
    setCachedFrame(!isImagePost && videoUrl ? getCachedVideoThumbnail(videoUrl) : '');
  }, [videoUrl, posterUrl, isImagePost]);

  const tryExtractFrame = (videoEl: HTMLVideoElement) => {
    if (!videoUrl) return;
    const captured = captureVideoFrameDataUrl(videoEl, mode === 'grid' ? 320 : 480);
    if (captured) {
      setCachedVideoThumbnail(videoUrl, captured);
      setCachedFrame(captured);
      return;
    }
    // Frame 0 was black and browser stayed at t=0: seek slightly forward once
    if (!didSeekFallback && videoEl.currentTime < 0.25 && Number.isFinite(videoEl.duration) && videoEl.duration > 0.6) {
      setDidSeekFallback(true);
      try {
        videoEl.currentTime = Math.min(0.8, Math.max(0.35, videoEl.duration * 0.15));
      } catch {
        // ignore seek restrictions on live/streaming URLs
      }
    }
  };

  // Priority 1: Valid image or poster image (with cached extracted frame override)
  const displayImageSrc = isImagePost
    ? !posterFailed
      ? optimizedImageSrc
      : ''
    : cachedFrame || (!posterFailed ? optimizedImageSrc : '');

  if (displayImageSrc) {
    return (
      <img
        src={displayImageSrc}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (cachedFrame && displayImageSrc === cachedFrame) {
            setCachedFrame('');
          } else {
            setPosterFailed(true);
          }
        }}
        className={className}
      />
    );
  }

  // Priority 2: Metadata-preloaded video preview at #t=0.5 (never blank black frame)
  if (!isImagePost && videoUrl && !videoFailed) {
    return (
      <video
        ref={previewVideoRef}
        src={appendMediaTimeFragment(videoUrl, 0.5)}
        muted
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedData={(e) => tryExtractFrame(e.currentTarget)}
        onSeeked={(e) => {
          const captured = captureVideoFrameDataUrl(e.currentTarget, mode === 'grid' ? 320 : 480);
          if (captured && videoUrl) {
            setCachedVideoThumbnail(videoUrl, captured);
            setCachedFrame(captured);
          }
        }}
        onError={() => setVideoFailed(true)}
        className={className}
      />
    );
  }

  // Priority 3: Branded non-broken fallback tile if offline / unreachable URL
  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-2 text-center select-none`}
    >
      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-pink-300 mb-1.5">
        {isImagePost ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
      </div>
      <span className="text-[10px] font-bold text-neutral-300 line-clamp-2 px-1 leading-tight">
        {title || 'JATT VibeReels'}
      </span>
    </div>
  );
};

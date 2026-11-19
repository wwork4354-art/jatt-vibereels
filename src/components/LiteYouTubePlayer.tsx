import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Zap } from 'lucide-react';
import { getIsRamSaverMode, useRamSaverMode } from '../lib/ramSaverMode';

export type YouTubeQualityId = 'auto' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'highres';

export interface YouTubeQualityOption {
  id: YouTubeQualityId;
  label: string;
  shortBadge: string;
  ytQuality: string;
  vqParam: string;
  isUltraHd?: boolean;
}

export const YOUTUBE_QUALITY_OPTIONS: YouTubeQualityOption[] = [
  {
    id: 'highres',
    label: '4K (2160p)',
    shortBadge: '4K ULTRA HD',
    ytQuality: 'highres',
    vqParam: 'hd2160',
    isUltraHd: true,
  },
  {
    id: 'hd1080',
    label: '1080p Full HD',
    shortBadge: '1080p FULL HD',
    ytQuality: 'hd1080',
    vqParam: 'hd1080',
  },
  {
    id: 'hd720',
    label: '720p HD',
    shortBadge: '720p HD',
    ytQuality: 'hd720',
    vqParam: 'hd720',
  },
  {
    id: 'large',
    label: '480p',
    shortBadge: '480p SD',
    ytQuality: 'large',
    vqParam: 'large',
  },
  {
    id: 'medium',
    label: '360p (Data Saver)',
    shortBadge: '360p SAVER',
    ytQuality: 'medium',
    vqParam: 'medium',
  },
  {
    id: 'auto',
    label: 'Auto',
    shortBadge: 'AUTO HD',
    ytQuality: 'default',
    vqParam: '',
  },
];

export function getQualityOption(id: YouTubeQualityId): YouTubeQualityOption {
  return YOUTUBE_QUALITY_OPTIONS.find((q) => q.id === id) || YOUTUBE_QUALITY_OPTIONS[0];
}

export function getYouTubeThumbSources(videoId: string, ramSaver = getIsRamSaverMode()): string[] {
  if (ramSaver) {
    // 3GB RAM / Lite mode: lightweight 320x180 (~9KB) mqdefault.jpg saves ~70% RAM
    return [
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ];
  }
  return [
    `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`,
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

export const LiteYouTubeThumb: React.FC<{
  videoId: string;
  alt: string;
  fallbackUrl?: string;
  className?: string;
  ramSaverMode?: boolean;
}> = React.memo(({ videoId, alt, fallbackUrl, className = 'w-full h-full object-cover', ramSaverMode }) => {
  const { isRamSaverMode: hookRamSaver } = useRamSaverMode();
  const effectiveRamSaver = ramSaverMode ?? hookRamSaver;

  const candidates = useMemo(() => {
    const list = getYouTubeThumbSources(videoId, effectiveRamSaver);
    if (!effectiveRamSaver && fallbackUrl && !list.includes(fallbackUrl)) {
      list.push(fallbackUrl);
    }
    return list;
  }, [videoId, fallbackUrl, effectiveRamSaver]);

  const [tierIdx, setTierIdx] = useState(0);

  useEffect(() => {
    setTierIdx(0);
  }, [videoId, effectiveRamSaver]);

  const currentSrc = candidates[Math.min(tierIdx, candidates.length - 1)];

  const advanceFallback = () => {
    setTierIdx((prev) => (prev < candidates.length - 1 ? prev + 1 : prev));
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={advanceFallback}
      onLoad={(e) => {
        // YouTube serves a 120x90 grey placeholder when maxresdefault does not exist
        if (
          !effectiveRamSaver &&
          e.currentTarget.naturalWidth > 0 &&
          e.currentTarget.naturalWidth <= 120 &&
          tierIdx < candidates.length - 1
        ) {
          advanceFallback();
        }
      }}
    />
  );
});

interface LiteYouTubePlayerProps {
  youtubeId: string;
  title: string;
  thumbnailUrl?: string;
  autoActivate?: boolean;
  isCinemaMode: boolean;
  playerScaleMode: 'fill' | 'fit';
  cssLandscapeActive: boolean;
  selectedQuality: YouTubeQualityId;
  serverIndex: number;
  reloadNonce: number;
  onPlayerError: (message: string) => void;
}

export const LiteYouTubePlayer: React.FC<LiteYouTubePlayerProps> = ({
  youtubeId,
  title,
  thumbnailUrl,
  autoActivate = true,
  isCinemaMode,
  playerScaleMode,
  cssLandscapeActive,
  selectedQuality,
  serverIndex,
  reloadNonce,
  onPlayerError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isActivated, setIsActivated] = useState<boolean>(autoActivate);
  const [isInViewport, setIsInViewport] = useState<boolean>(true);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);

  // Reset activation cleanly whenever video changes or user triggers reload
  useEffect(() => {
    setIsActivated(autoActivate);
    setIframeLoaded(false);
  }, [youtubeId, reloadNonce, serverIndex, autoActivate]);

  // Immediately unmount/destroy off-screen iframe players when scrolled away (unless in fullscreen cinema mode)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = Boolean(entries[0]?.isIntersecting);
        setIsInViewport(visible);
        if (!visible && !isCinemaMode) {
          // Destroy iframe while off-screen to keep RAM and bandwidth 100% focused
          setIsActivated(false);
          setIframeLoaded(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isCinemaMode]);

  const qualityOption = getQualityOption(selectedQuality);
  const serverOrigin =
    serverIndex % 2 === 1 ? 'https://www.youtube.com' : 'https://www.youtube-nocookie.com';

  const embedSrc = useMemo(() => {
    const vqClause = qualityOption.vqParam ? `&vq=${qualityOption.vqParam}` : '';
    return `${serverOrigin}/embed/${youtubeId}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1&playsinline=1&fs=1&iv_load_policy=3${vqClause}`;
  }, [serverOrigin, youtubeId, qualityOption.vqParam]);

  const sendPlaybackQualityCommand = (iframe: HTMLIFrameElement | null, ytQuality: string) => {
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: youtubeId || 'yt-player', channel: 'widget' }),
        '*'
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: [ytQuality] }),
        '*'
      );
      if (ytQuality !== 'default') {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setPlaybackQualityRange',
            args: [ytQuality, ytQuality],
          }),
          '*'
        );
      }
    } catch {
      // ignore cross-origin postMessage restrictions
    }
  };

  // Apply quality live via YouTube IFrame Player API whenever user changes resolution
  useEffect(() => {
    if (!isActivated || !iframeLoaded) return;
    sendPlaybackQualityCommand(iframeRef.current, qualityOption.ytQuality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuality, isActivated, iframeLoaded, youtubeId]);

  const shouldMountIframe = isActivated && (isInViewport || isCinemaMode);

  // Explicitly clear iframe src on unmount or off-screen destruction to release native decoder RAM
  useEffect(() => {
    if (shouldMountIframe) {
      const iframe = iframeRef.current;
      return () => {
        if (iframe) {
          try {
            iframe.src = 'about:blank';
          } catch {
            // ignore
          }
        }
      };
    }
    return undefined;
  }, [shouldMountIframe, youtubeId, serverIndex, reloadNonce]);

  const iframeClassName = isCinemaMode
    ? cssLandscapeActive || playerScaleMode === 'fit'
      ? 'w-full h-full border-0'
      : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100vw,calc(100dvh*16/9))] h-[max(100dvh,calc(100vw*9/16))] border-0'
    : playerScaleMode === 'fill'
    ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100%,calc(44vh*16/9))] h-[max(100%,calc(100vw*9/16))] border-0'
    : 'w-full h-full border-0';

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {shouldMountIframe ? (
        <>
          {/* Lightweight poster underneath while iframe initializes so zero blank flash */}
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <LiteYouTubeThumb
                videoId={youtubeId}
                alt={title}
                fallbackUrl={thumbnailUrl}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <div className="px-3.5 py-2 rounded-full bg-black/80 border border-white/20 text-xs font-black text-white flex items-center gap-2 shadow-xl">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>Loading {qualityOption.shortBadge}...</span>
                </div>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            key={`${youtubeId}-${serverIndex}-${reloadNonce}`}
            src={embedSrc}
            title={title}
            onLoad={() => {
              setIframeLoaded(true);
              sendPlaybackQualityCommand(iframeRef.current, qualityOption.ytQuality);
              // Re-assert quality after widget handshake completes (~450ms)
              window.setTimeout(() => {
                sendPlaybackQualityCommand(iframeRef.current, qualityOption.ytQuality);
              }, 450);
            }}
            onError={() =>
              onPlayerError(
                'Unable to embed this YouTube video in-app. Tap Fast Server or open directly on YouTube.'
              )
            }
            className={iframeClassName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </>
      ) : (
        /* Lightweight Lite-YouTube Facade (Thumbnail Only — Zero Iframe Overhead Until Clicked) */
        <button
          type="button"
          onClick={() => setIsActivated(true)}
          className="relative w-full h-full group cursor-pointer block text-left"
          aria-label={`Play ${title}`}
        >
          <LiteYouTubeThumb
            videoId={youtubeId}
            alt={title}
            fallbackUrl={thumbnailUrl}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/40 flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-12 rounded-2xl bg-red-600 group-hover:bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-600/40 group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>
            <span className="px-3 py-1 rounded-full bg-black/75 border border-white/15 text-[11px] font-black text-white">
              Tap to Stream {qualityOption.shortBadge}
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  ArrowLeft,
  Search,
  Music,
  Smartphone,
  Tv,
  Film,
  Smile,
  BookOpen,
  Sparkles,
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  HardDrive,
  Trash2,
  ExternalLink,
  Star,
  SlidersHorizontal,
  X,
  Volume2,
  VolumeX,
  Youtube,
  Link2,
  Bookmark,
  Globe,
  Maximize2,
  Minimize2,
  WifiOff,
  ArrowRight,
} from 'lucide-react';
import { DownloadItem, DownloadCategory } from '../types';
import { INITIAL_DOWNLOADS, DOWNLOAD_CATEGORIES } from '../data/mockDownloads';
import { soundEngine } from '../utils/soundEngine';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const OFFLINE_WATCHLIST_STORAGE_KEY = 'jatt_offline_watchlist';

interface GlobalHubTab {
  id: 'all' | 'hollywood_english' | 'english_dubbed' | 'dramas' | 'songs' | 'viral';
  label: string;
  query: string;
}

const GLOBAL_HUB_TABS: GlobalHubTab[] = [
  { id: 'all', label: 'All', query: '' },
  {
    id: 'hollywood_english',
    label: 'Hollywood & English',
    query: 'Hollywood English full action adventure movies clean HD',
  },
  {
    id: 'english_dubbed',
    label: 'English Dubbed Movies',
    query: 'English dubbed full action sci-fi fantasy movies HD',
  },
  {
    id: 'dramas',
    label: 'Dramas',
    query: 'Pakistani Turkish family dramas full episodes HD',
  },
  {
    id: 'songs',
    label: 'Trending Songs',
    query: 'Trending Punjabi English hit songs official music video',
  },
  {
    id: 'viral',
    label: 'Viral Videos',
    query: 'viral trending sports comedy nature clean videos HD',
  },
];

const QUICK_MOVIEBOX_CHIPS = [
  'Hollywood & English',
  'English Dubbed Movies',
  'Trending Movies',
  'Punjabi Songs',
  'Pakistani Dramas',
  'Viral Videos',
];

const CURATED_FALLBACK_VIDEOS: Record<string, DownloadItem[]> = {
  'Hollywood & English': [
    {
      id: 'yt-R6MlUcmOul8',
      title: 'Tears of Steel - English Sci-Fi Action Short Film 4K',
      subtitle: 'Blender Foundation Studio',
      category: 'movies',
      categoryLabel: 'Hollywood & English',
      fileSize: 'Streaming 4K',
      sizeBytes: 180000000,
      durationOrVersion: 'Movie 4K',
      qualityBadge: '4K Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/hqdefault.jpg',
      fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Hollywood & English', 'Sci-Fi', '4K'],
      description: 'Clean English sci-fi action short film in 4K UHD.',
      youtubeId: 'R6MlUcmOul8',
    },
    {
      id: 'yt-YE7VzlLtp-4',
      title: 'Big Buck Bunny - Full Family Animated Adventure 4K 60fps',
      subtitle: 'Blender Foundation',
      category: 'movies',
      categoryLabel: 'Hollywood & English',
      fileSize: 'Streaming 4K',
      sizeBytes: 150000000,
      durationOrVersion: '4K 60FPS',
      qualityBadge: '4K Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/YE7VzlLtp-4/hqdefault.jpg',
      fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Hollywood & English', 'Family', '4K'],
      description: 'Award-winning family animated comedy film.',
      youtubeId: 'YE7VzlLtp-4',
    },
  ],
  'English Dubbed Movies': [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Sintel - English Fantasy Adventure Movie HD',
      subtitle: 'Cinema Fantasy Studio',
      category: 'movies',
      categoryLabel: 'English Dubbed',
      fileSize: 'Streaming HD',
      sizeBytes: 125000000,
      durationOrVersion: 'English HD',
      qualityBadge: 'English Dubbed',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['English Dubbed', 'Fantasy', 'HD'],
      description: 'Full dramatic fantasy adventure feature in English.',
      youtubeId: 'eRsGyueVLvQ',
    },
    {
      id: 'yt-aqz-KE-bpKQ',
      title: 'Cosmos & Action Showcase - Open Cinema 4K 60FPS',
      subtitle: 'Open Movie Channel',
      category: 'movies',
      categoryLabel: 'English Dubbed',
      fileSize: 'Streaming 4K',
      sizeBytes: 160000000,
      durationOrVersion: '4K 60FPS',
      qualityBadge: 'English Dubbed',
      thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
      fallbackGradient: 'from-indigo-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.8,
      tags: ['English Dubbed', 'Action', '4K'],
      description: 'High frame-rate cinematic showcase.',
      youtubeId: 'aqz-KE-bpKQ',
    },
  ],
  'Trending Movies': [
    {
      id: 'yt-aqz-KE-bpKQ',
      title: 'Action Blockbuster Showcase | Open Movie 4K 60fps',
      subtitle: 'Cinema Central',
      category: 'movies',
      categoryLabel: 'YouTube Live',
      fileSize: 'Streaming HD',
      sizeBytes: 150000000,
      durationOrVersion: 'Movie HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
      fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Trending Movies', 'HD'],
      description: 'Big Buck Bunny 4K Open Movie showcase stream.',
      youtubeId: 'aqz-KE-bpKQ',
    },
    {
      id: 'yt-YE7VzlLtp-4',
      title: 'Big Buck Bunny - Full Animated Comedy Movie 4K 60fps',
      subtitle: 'Blender Foundation',
      category: 'movies',
      categoryLabel: 'YouTube Live',
      fileSize: 'Streaming HD',
      sizeBytes: 150000000,
      durationOrVersion: '4K 60FPS',
      qualityBadge: '4K Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/YE7VzlLtp-4/hqdefault.jpg',
      fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Trending Movies', '4K'],
      description: 'Full length animated comedy feature.',
      youtubeId: 'YE7VzlLtp-4',
    },
  ],
  'Punjabi Songs': [
    {
      id: 'yt-6MgsHSAcI9k',
      title: 'Top Punjabi Hit Tracks & Bhangra Bass Mix',
      subtitle: 'Punjabi Beats Official',
      category: 'songs',
      categoryLabel: 'Trending Songs',
      fileSize: 'Streaming HD',
      sizeBytes: 12000000,
      durationOrVersion: 'Audio/Video HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/hqdefault.jpg',
      fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Punjabi Songs', 'Trending Songs'],
      description: 'Non-stop Punjabi music stream.',
      youtubeId: '6MgsHSAcI9k',
    },
  ],
  'Trending Songs': [
    {
      id: 'yt-6MgsHSAcI9k',
      title: 'Global Top Music Mix & Punjabi Bass Hits HD',
      subtitle: 'Vibe Music Global',
      category: 'songs',
      categoryLabel: 'Trending Songs',
      fileSize: 'Streaming HD',
      sizeBytes: 12000000,
      durationOrVersion: 'Music HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/hqdefault.jpg',
      fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Trending Songs', 'Music'],
      description: 'Clean trending global and Punjabi hits.',
      youtubeId: '6MgsHSAcI9k',
    },
  ],
  'Pakistani Dramas': [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Sintel - Award Winning Fantasy Drama Short Film',
      subtitle: 'Blender Studio',
      category: 'dramas',
      categoryLabel: 'Dramas',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: 'Drama HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Dramas', 'HD'],
      description: 'Full dramatic feature stream.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
  Dramas: [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Epic Family & Fantasy Drama Showcase HD',
      subtitle: 'Drama Central Global',
      category: 'dramas',
      categoryLabel: 'Dramas',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: 'Drama HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Dramas', 'HD'],
      description: 'Clean family drama showcase.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
  'Viral Videos': [
    {
      id: 'yt-aqz-KE-bpKQ',
      title: 'Amazing 4K 60FPS Nature & Viral Shorts Compilation',
      subtitle: 'Global Viral Hub',
      category: 'movies',
      categoryLabel: 'Viral Videos',
      fileSize: 'Streaming 4K',
      sizeBytes: 95000000,
      durationOrVersion: '4K 60FPS',
      qualityBadge: 'Viral HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
      fallbackGradient: 'from-emerald-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Viral Videos', '4K'],
      description: 'Clean trending viral clips & highlights.',
      youtubeId: 'aqz-KE-bpKQ',
    },
  ],
  'Action Movies': [
    {
      id: 'yt-R6MlUcmOul8',
      title: 'Tears of Steel - Sci-Fi Action Movie 4K',
      subtitle: 'Mango Open Movie',
      category: 'movies',
      categoryLabel: 'YouTube Live',
      fileSize: 'Streaming HD',
      sizeBytes: 180000000,
      durationOrVersion: 'Action 4K',
      qualityBadge: 'YouTube 4K',
      thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/hqdefault.jpg',
      fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Action Movies', 'Sci-Fi'],
      description: 'High-octane sci-fi action film.',
      youtubeId: 'R6MlUcmOul8',
    },
  ],
};

interface DownloadHubProps {
  onBackToFeed: () => void;
  onOpenSavedOffline?: () => void;
  onShowToast: (msg: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

interface DownloadProgressState {
  progress: number; // 0 - 100
  isDownloading: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  speed: string; // e.g. "14.2 MB/s"
  downloadedBytes: number;
}

export const DownloadHub: React.FC<DownloadHubProps> = ({
  onBackToFeed,
  onOpenSavedOffline,
  onShowToast,
  isMuted,
  onToggleMute,
}) => {
  const isOnline = useOnlineStatus();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [items] = useState<DownloadItem[]>(INITIAL_DOWNLOADS);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      return sessionStorage.getItem('jatt_hub_selected_category') || 'all';
    } catch {
      return 'all';
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return sessionStorage.getItem('jatt_yt_search_query') || '';
    } catch {
      return '';
    }
  });
  const [sortBy, setSortBy] = useState<'popular' | 'size_desc' | 'size_asc' | 'rating'>('popular');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my_downloads'>('marketplace');

  // Track download progress per item ID
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadProgressState>>(() => {
    try {
      const stored = sessionStorage.getItem('jatt_downloads_state');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Track active video player item, 16:9 cinema mode & Playit-style stretch/fill mode
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [playerScaleMode, setPlayerScaleMode] = useState<'fill' | 'fit'>('fill');
  const cinemaViewportRef = React.useRef<HTMLDivElement | null>(null);
  const inlineIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const cinemaIframeRef = React.useRef<HTMLIFrameElement | null>(null);

  const buildYouTube1080Url = (youtubeId: string) =>
    `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1&vq=hd1080&hd=1&modestbranding=1&iv_load_policy=3&enablejsapi=1`;

  const enforceYouTube1080p = (iframe: HTMLIFrameElement | null) => {
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }),
        '*'
      );
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'hd1080'] }),
        '*'
      );
    } catch {
      // ignore cross-origin postMessage restrictions
    }
  };

  const handleToggleFullscreenApi = () => {
    const el = cinemaViewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  // YouTube Search States
  const [isSearchingYouTube, setIsSearchingYouTube] = useState<boolean>(false);

  // Instant Caching: Cache YouTube search results and thumbnails in sessionStorage for instant tab switching
  const [youtubeLiveResults, setYoutubeLiveResults] = useState<DownloadItem[]>(() => {
    try {
      const cached = sessionStorage.getItem('jatt_yt_search_results');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [searchSource, setSearchSource] = useState<'catalog' | 'youtube'>(() => {
    try {
      const saved = sessionStorage.getItem('jatt_yt_search_source');
      if (saved === 'youtube') return 'youtube';
    } catch {
      // ignore
    }
    return 'catalog';
  });
  const [activeGlobalTab, setActiveGlobalTab] = useState<GlobalHubTab['id']>(() => {
    try {
      const saved = sessionStorage.getItem('jatt_hub_global_tab') as GlobalHubTab['id'] | null;
      if (saved && GLOBAL_HUB_TABS.some((t) => t.id === saved)) return saved;
    } catch {
      // ignore
    }
    return 'all';
  });

  // Offline Watchlist saved in localStorage
  const [offlineWatchlist, setOfflineWatchlist] = useState<DownloadItem[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_WATCHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [directUrlInput, setDirectUrlInput] = useState<string>('');

  // Extract valid 11-char YouTube Video ID from any URL format or direct ID
  // Decode HTML entities returned by YouTube Data API (e.g. &#39; -> ', &amp; -> &)
  const decodeHtmlEntities = (str: string): string => {
    if (!str) return '';
    try {
      const parser = new DOMParser();
      const dom = parser.parseFromString(str, 'text/html');
      return dom.body.textContent || str;
    } catch {
      return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }
  };

  // Extract valid 11-char YouTube Video ID from any URL format or direct ID
  const extractYouTubeId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    const longMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (longMatch) return longMatch[1];
    const embedMatch = trimmed.match(/(?:embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
    return null;
  };

  const openVideoPlayer = (item: DownloadItem) => {
    setPreviewItem(item);
    setActiveTab('marketplace');
    if (!isOnline && item.youtubeId) {
      onShowToast('You are offline. Online YouTube streaming needs internet — check Saved / Downloads!');
    }
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 30);
  };

  // Play any custom YouTube link or video ID directly in standard embed player
  const handlePlayDirectUrl = () => {
    if (!isOnline) {
      onShowToast('Offline Mode: Connect to internet to stream YouTube links, or open Saved / Downloads.');
      return;
    }
    const ytid = extractYouTubeId(directUrlInput);
    if (!ytid) {
      onShowToast('Please enter a valid YouTube video link or 11-char ID.');
      return;
    }
    const directItem: DownloadItem = {
      id: `custom-yt-${ytid}`,
      title: 'YouTube Custom Stream',
      subtitle: `Official Privacy-Enhanced Embed (ID: ${ytid})`,
      category: 'movies',
      categoryLabel: 'Movie Box Stream',
      fileSize: 'Streaming 1080p',
      sizeBytes: 150000000,
      durationOrVersion: 'Live / HD',
      qualityBadge: 'YouTube 1080p Embed',
      thumbnailUrl: `https://i.ytimg.com/vi/${ytid}/hqdefault.jpg`,
      fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
      downloadsCount: 'Stream',
      rating: 5.0,
      tags: ['YouTube Stream', 'Movie Box'],
      description: 'Streamed cleanly using privacy-enhanced YouTube embed player.',
      youtubeId: ytid,
    };
    openVideoPlayer(directItem);
    setDirectUrlInput('');
    onShowToast('Playing in Movie Box! 🎬🔥');
  };

  // Toggle Offline Watchlist / Cache thumbnail locally for YouTube-sourced movies & videos
  const handleToggleWatchlist = (item: DownloadItem) => {
    setOfflineWatchlist((prev) => {
      const exists = prev.some((w) => w.id === item.id);
      const next = exists ? prev.filter((w) => w.id !== item.id) : [item, ...prev];
      try {
        localStorage.setItem(OFFLINE_WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      if (!exists && typeof caches !== 'undefined' && item.thumbnailUrl) {
        caches
          .open('jatt-watchlist-v1')
          .then((cache) => cache.add(item.thumbnailUrl))
          .catch(() => {});
      }
      if (!exists) {
        soundEngine.playDownloadComplete();
        onShowToast(`Saved "${item.title}" to Offline Watchlist!`);
      } else {
        onShowToast(`Removed "${item.title}" from Offline Watchlist`);
      }
      return next;
    });
  };

  // Switch between Global Content Hub category tabs with instant sessionStorage cache
  const handleSelectGlobalTab = (tab: GlobalHubTab) => {
    setActiveGlobalTab(tab.id);
    try {
      sessionStorage.setItem('jatt_hub_global_tab', tab.id);
    } catch {
      // ignore
    }

    if (tab.id === 'all') {
      setSearchSource('catalog');
      setSelectedCategory('all');
      setSearchQuery('');
      return;
    }

    // Check sessionStorage per-tab cache first for instant switching
    try {
      const rawCache = sessionStorage.getItem('jatt_yt_tab_cache');
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as Record<string, DownloadItem[]>;
        if (Array.isArray(parsed?.[tab.id]) && parsed[tab.id].length > 0) {
          setYoutubeLiveResults(parsed[tab.id]);
          setSearchQuery(tab.label);
          setSearchSource('youtube');
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    setSearchQuery(tab.label);
    void handleSearchYouTubeLive(tab.query, tab.id, tab.label);
  };

  // Bulletproof multi-tier search: YouTube Data API v3 (safeSearch=strict) -> Public Invidious/Piped -> Verified Local Fallback
  const handleSearchYouTubeLive = async (
    targetQuery?: string,
    tabCacheKey?: GlobalHubTab['id'],
    displayLabel?: string
  ) => {
    if (!isOnline) {
      onShowToast('Offline Mode: Online YouTube search needs internet. Watch Saved / Downloads offline!');
      return;
    }
    const query = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (!query) {
      onShowToast('Type a movie, drama, or song title to search.');
      return;
    }
    if (targetQuery !== undefined && displayLabel === undefined) {
      setSearchQuery(targetQuery);
    }

    const effectiveKey = (
      (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) ||
      localStorage.getItem('jatt_youtube_api_key') ||
      ''
    ).trim();

    setIsSearchingYouTube(true);

    const fetchWithTimeout = async (url: string, ms = 5500) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(url, { signal: controller.signal });
      } finally {
        window.clearTimeout(timer);
      }
    };

    try {
      let mappedResults: DownloadItem[] = [];

      // Tier 1: Official YouTube Data API v3 (safeSearch=strict for clean, family-friendly global results)
      if (effectiveKey) {
        try {
          const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=18&type=video&safeSearch=strict&q=${encodeURIComponent(
            query
          )}&key=${encodeURIComponent(effectiveKey)}`;
          const res = await fetchWithTimeout(endpoint, 6000);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.items) && data.items.length > 0) {
              mappedResults = data.items
                .filter((item: any) => item.id?.videoId)
                .map((item: any) => ({
                  id: `yt-${item.id.videoId}`,
                  title: decodeHtmlEntities(item.snippet?.title || 'YouTube Video'),
                  subtitle: decodeHtmlEntities(item.snippet?.channelTitle || 'YouTube Channel'),
                  category: (selectedCategory === 'all' ? 'movies' : selectedCategory) as DownloadCategory,
                  categoryLabel: 'YouTube Live',
                  fileSize: 'Streaming HD',
                  sizeBytes: 150000000,
                  durationOrVersion: 'YouTube HD',
                  qualityBadge: 'YouTube HD',
                  thumbnailUrl:
                    item.snippet?.thumbnails?.high?.url ||
                    item.snippet?.thumbnails?.medium?.url ||
                    `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
                  fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
                  downloadsCount: 'YouTube',
                  rating: 4.9,
                  tags: ['YouTube Live', 'Movie Box'],
                  description: decodeHtmlEntities(item.snippet?.description || ''),
                  youtubeId: item.id.videoId,
                }));
            }
          }
        } catch {
          // Silently fall back to Tier 2 public search APIs
        }
      }

      // Tier 2: Public Invidious & Piped YouTube search APIs fallback
      if (mappedResults.length === 0) {
        const invidiousInstances = [
          `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
          `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
          `https://yewtu.be/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        ];

        for (const url of invidiousInstances) {
          if (mappedResults.length > 0) break;
          try {
            const res = await fetchWithTimeout(url, 5500);
            if (!res.ok) continue;
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              mappedResults = list
                .filter((item: any) => item?.videoId && (item.type === 'video' || !item.type))
                .slice(0, 18)
                .map((item: any) => {
                  const vidId = item.videoId as string;
                  const bestThumb =
                    item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url ||
                    item.videoThumbnails?.[0]?.url ||
                    '';
                  const safeThumb = bestThumb.startsWith('http')
                    ? bestThumb
                    : `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

                  return {
                    id: `yt-${vidId}`,
                    title: decodeHtmlEntities(item.title || 'YouTube Video'),
                    subtitle: decodeHtmlEntities(item.author || 'YouTube Channel'),
                    category: (selectedCategory === 'all' ? 'movies' : selectedCategory) as DownloadCategory,
                    categoryLabel: 'YouTube Live',
                    fileSize: 'Streaming HD',
                    sizeBytes: 150000000,
                    durationOrVersion: 'YouTube HD',
                    qualityBadge: 'YouTube HD',
                    thumbnailUrl: safeThumb,
                    fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
                    downloadsCount: 'YouTube',
                    rating: 4.9,
                    tags: ['YouTube Live', 'Movie Box'],
                    description: decodeHtmlEntities(item.description || ''),
                    youtubeId: vidId,
                  };
                });
            }
          } catch {
            // Try next mirror
          }
        }
      }

      if (mappedResults.length === 0) {
        const pipedInstances = [
          `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=all`,
          `https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=all`,
        ];

        for (const url of pipedInstances) {
          if (mappedResults.length > 0) break;
          try {
            const res = await fetchWithTimeout(url, 5500);
            if (!res.ok) continue;
            const data = await res.json();
            const list = Array.isArray(data?.items) ? data.items : [];
            const streams = list.filter((it: any) => it?.url && it.url.includes('v='));
            if (streams.length > 0) {
              mappedResults = streams.slice(0, 18).map((item: any) => {
                const vidId = extractYouTubeId(item.url) || '';
                const safeThumb =
                  typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http')
                    ? item.thumbnail
                    : `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

                return {
                  id: `yt-${vidId}`,
                  title: decodeHtmlEntities(item.title || 'YouTube Video'),
                  subtitle: decodeHtmlEntities(item.uploaderName || 'YouTube Channel'),
                  category: (selectedCategory === 'all' ? 'movies' : selectedCategory) as DownloadCategory,
                  categoryLabel: 'YouTube Live',
                  fileSize: 'Streaming HD',
                  sizeBytes: 150000000,
                  durationOrVersion: 'YouTube HD',
                  qualityBadge: 'YouTube HD',
                  thumbnailUrl: safeThumb,
                  fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
                  downloadsCount: 'YouTube',
                  rating: 4.9,
                  tags: ['YouTube Live', 'Movie Box'],
                  description: decodeHtmlEntities(item.shortDescription || ''),
                  youtubeId: vidId,
                };
              }).filter((r: DownloadItem) => Boolean(r.youtubeId));
            }
          } catch {
            // Try next mirror
          }
        }
      }

      // Tier 3: Guaranteed local curated fallback so search never fails or errors out
      if (mappedResults.length === 0) {
        const lookupText = (displayLabel || query).toLowerCase();
        const curatedKey = Object.keys(CURATED_FALLBACK_VIDEOS).find(
          (k) => lookupText.includes(k.toLowerCase()) || k.toLowerCase().includes(lookupText)
        );
        const catalogMatches = INITIAL_DOWNLOADS.filter(
          (it) =>
            Boolean(it.youtubeId) &&
            (it.title.toLowerCase().includes(lookupText) ||
              it.subtitle.toLowerCase().includes(lookupText) ||
              it.tags.some((t) => t.toLowerCase().includes(lookupText)))
        );
        const allCatalogYoutube = INITIAL_DOWNLOADS.filter((it) => Boolean(it.youtubeId));

        mappedResults = [
          ...(curatedKey ? CURATED_FALLBACK_VIDEOS[curatedKey] : []),
          ...catalogMatches,
          ...(!curatedKey && catalogMatches.length === 0 ? allCatalogYoutube : []),
        ]
          .slice(0, 12)
          .map((it) => ({
            ...it,
            id: it.id.startsWith('yt-') ? it.id : `yt-${it.youtubeId}`,
          }));
      }

      if (tabCacheKey && mappedResults.length > 0) {
        try {
          const rawCache = sessionStorage.getItem('jatt_yt_tab_cache');
          const parsed = rawCache ? JSON.parse(rawCache) : {};
          parsed[tabCacheKey] = mappedResults;
          sessionStorage.setItem('jatt_yt_tab_cache', JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }

      setYoutubeLiveResults(mappedResults);
      setSearchSource('youtube');
      onShowToast(
        `Showing ${mappedResults.length} playable videos${displayLabel ? ` in ${displayLabel}` : ` for "${query}"`}`
      );
    } finally {
      setIsSearchingYouTube(false);
    }
  };

  // Sync to session
  useEffect(() => {
    try {
      sessionStorage.setItem('jatt_downloads_state', JSON.stringify(downloadStates));
    } catch {
      // ignore
    }
  }, [downloadStates]);

  // Instantly cache YouTube search results and navigation state in sessionStorage
  useEffect(() => {
    try {
      if (youtubeLiveResults.length > 0) {
        sessionStorage.setItem('jatt_yt_search_results', JSON.stringify(youtubeLiveResults));
      } else {
        sessionStorage.removeItem('jatt_yt_search_results');
      }
      sessionStorage.setItem('jatt_yt_search_query', searchQuery);
      sessionStorage.setItem('jatt_yt_search_source', searchSource);
      sessionStorage.setItem('jatt_hub_selected_category', selectedCategory);
    } catch {
      // ignore
    }
  }, [youtubeLiveResults, searchQuery, searchSource, selectedCategory]);

  // Simulate progress timer for active downloads
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloadStates((prev) => {
        let hasChanges = false;
        const next = { ...prev };

        Object.keys(next).forEach((id) => {
          const state = next[id];
          if (state && state.isDownloading && !state.isPaused && !state.isCompleted) {
            hasChanges = true;
            // Increment progress smoothly
            const item = items.find((it) => it.id === id);
            const totalBytes = item?.sizeBytes || 20000000;
            const stepIncrement = Math.floor(Math.random() * 8) + 6; // 6-13%
            const newProgress = Math.min(100, state.progress + stepIncrement);
            const downloadedBytes = Math.floor((newProgress / 100) * totalBytes);
            const speeds = ['12.8 MB/s', '16.4 MB/s', '19.2 MB/s', '24.1 MB/s', '14.5 MB/s'];
            const randomSpeed = speeds[Math.floor(Math.random() * speeds.length)];

            if (newProgress >= 100) {
              soundEngine.playDownloadComplete();
              onShowToast(`Downloaded "${item?.title || 'Item'}" successfully!`);
              next[id] = {
                ...state,
                progress: 100,
                isDownloading: false,
                isCompleted: true,
                speed: 'Completed',
                downloadedBytes: totalBytes,
              };
            } else {
              next[id] = {
                ...state,
                progress: newProgress,
                speed: randomSpeed,
                downloadedBytes,
              };
            }
          }
        });

        return hasChanges ? next : prev;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [items, onShowToast]);

  // Start or resume download
  const handleStartDownload = (item: DownloadItem) => {
    soundEngine.playDownloadStart();
    onShowToast(`Downloading "${item.title}"...`);

    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        progress: prev[item.id]?.progress || 4,
        isDownloading: true,
        isPaused: false,
        isCompleted: false,
        speed: '12.4 MB/s',
        downloadedBytes: Math.floor(((prev[item.id]?.progress || 4) / 100) * item.sizeBytes),
      },
    }));
  };

  // Pause download
  const handlePauseDownload = (item: DownloadItem) => {
    onShowToast(`Paused download: ${item.title}`);
    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        isPaused: true,
      },
    }));
  };

  // Resume download
  const handleResumeDownload = (item: DownloadItem) => {
    soundEngine.playDownloadStart();
    onShowToast(`Resumed download: ${item.title}`);
    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        isPaused: false,
        isDownloading: true,
      },
    }));
  };

  // Cancel / Remove download
  const handleRemoveDownload = (itemId: string, itemTitle?: string) => {
    onShowToast(`Removed download${itemTitle ? `: ${itemTitle}` : ''}`);
    setDownloadStates((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Category filter
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchSubtitle = item.subtitle.toLowerCase().includes(q);
          const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
          const matchBadge = item.qualityBadge.toLowerCase().includes(q);
          return matchTitle || matchSubtitle || matchTags || matchBadge;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'size_desc') return b.sizeBytes - a.sizeBytes;
        if (sortBy === 'size_asc') return a.sizeBytes - b.sizeBytes;
        // default: popular
        return parseInt(b.downloadsCount) - parseInt(a.downloadsCount);
      });
  }, [items, selectedCategory, searchQuery, sortBy]);

  // Merge live YouTube search results or catalog items
  const displayedItems = useMemo(() => {
    if (searchSource === 'youtube' && youtubeLiveResults.length > 0) {
      return youtubeLiveResults;
    }
    return filteredItems;
  }, [searchSource, youtubeLiveResults, filteredItems]);

  // Completed downloads for "My Downloads"
  const completedDownloads = useMemo(() => {
    return items.filter((it) => downloadStates[it.id]?.isCompleted);
  }, [items, downloadStates]);

  // Total downloaded size in bytes
  const totalDownloadedSizeStr = useMemo(() => {
    const total = completedDownloads.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    if (total === 0) return '0 MB';
    if (total > 1024 * 1024 * 1024) {
      return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(total / (1024 * 1024)).toFixed(1)} MB`;
  }, [completedDownloads]);

  // Render category icon
  const renderCategoryIcon = (catId: string, className = 'w-4 h-4') => {
    switch (catId) {
      case 'songs':
        return <Music className={className} />;
      case 'apps':
        return <Smartphone className={className} />;
      case 'dramas':
        return <Tv className={className} />;
      case 'movies':
        return <Film className={className} />;
      case 'cartoons':
        return <Smile className={className} />;
      case 'quran':
        return <BookOpen className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-neutral-950/95 border-b border-neutral-800/80 [transform:translateZ(0)] flex items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToFeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all shadow-md active:scale-95"
            title="Return to Reels Feed"
          >
            <ArrowLeft className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Back to Reels Feed</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                Movie Box & <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Download Hub</span>
              </h1>
              <p className="text-[10px] text-neutral-400 hidden sm:block">
                Standard YouTube Embed Players · Stream Movies, Dramas, Songs & Tilawat with zero 3rd-party blocks
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: Marketplace vs My Downloads */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my_downloads')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'my_downloads'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Saved & Downloads</span>
              {(completedDownloads.length + offlineWatchlist.length) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-black text-[10px] font-black">
                  {completedDownloads.length + offlineWatchlist.length}
                </span>
              )}
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              isMuted
                ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
                : 'bg-pink-600/20 text-pink-400 border-pink-500/40'
            }`}
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {activeTab === 'marketplace' ? (
        /* ========================================================================= */
        /* MARKETPLACE VIEW: TOP VIDEO PLAYER + GLOBAL HUB TABS + VIDEO GRID          */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ========================================================================= */}
          {/* PINNED RESPONSIVE YOUTUBE VIDEO PLAYER AT THE TOP OF THE SCREEN           */}
          {/* ========================================================================= */}
          {previewItem && (
            <div className="shrink-0 bg-neutral-950 border-b border-pink-500/40 px-3 sm:px-6 py-3 shadow-2xl z-20">
              <div className="max-w-5xl mx-auto space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="p-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
                      <Youtube className="w-4 h-4 fill-red-500" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-black text-white truncate">
                        {previewItem.title}
                      </h2>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {previewItem.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleWatchlist(previewItem)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                        offlineWatchlist.some((w) => w.id === previewItem.id)
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          offlineWatchlist.some((w) => w.id === previewItem.id) ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                      <span className="hidden sm:inline">
                        {offlineWatchlist.some((w) => w.id === previewItem.id) ? 'Saved' : 'Offline Watchlist'}
                      </span>
                    </button>

                    {previewItem.youtubeId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${previewItem.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download Helper</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setPlayerScaleMode((prev) => (prev === 'fill' ? 'fit' : 'fill'))
                      }
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        playerScaleMode === 'fill'
                          ? 'bg-pink-600/25 border-pink-400 text-pink-200'
                          : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                      }`}
                      title="Toggle Playit-style Stretch Fill vs 16:9 Fit"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {playerScaleMode === 'fill' ? 'Stretch Fill' : 'Fit 16:9'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlayerScaleMode('fill');
                        setIsCinemaMode(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-pink-600/30 hover:from-cyan-600/45 hover:to-pink-600/45 text-white border border-cyan-400/50 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      title="Open Full-Screen Stretched Player (Playit Style)"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="hidden sm:inline">Full Screen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCinemaMode(false);
                        setPreviewItem(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Close</span>
                    </button>
                  </div>
                </div>

                {/* Responsive Player Container (16:9 Fit or Playit-style Stretch Fill) */}
                {!isCinemaMode && (
                  <div
                    className={`relative mx-auto overflow-hidden bg-black border border-neutral-800 shadow-2xl transition-all ${
                      playerScaleMode === 'fill'
                        ? 'w-full h-[38vh] sm:h-[44vh] rounded-xl sm:rounded-2xl'
                        : 'w-[min(100%,calc(38vh*16/9))] sm:w-[min(100%,calc(44vh*16/9))] max-w-4xl aspect-video rounded-xl sm:rounded-2xl'
                    }`}
                  >
                    <span className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-full bg-black/80 border border-cyan-400/50 text-cyan-300 text-[10px] font-black tracking-wide pointer-events-none">
                      1080p FHD · {playerScaleMode === 'fill' ? 'STRETCH FILL' : '16:9 FIT'}
                    </span>

                    {!isOnline && previewItem.youtubeId ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-neutral-950/95 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                          <WifiOff className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 max-w-md">
                          <h3 className="text-sm sm:text-base font-black text-white">
                            You&apos;re in Offline Mode
                          </h3>
                          <p className="text-xs text-neutral-300 leading-relaxed">
                            Online YouTube streaming needs an internet connection. Your saved reels, photos, songs, and naats are ready in <strong>Saved / Downloads</strong>!
                          </p>
                        </div>
                        {onOpenSavedOffline && (
                          <button
                            type="button"
                            onClick={onOpenSavedOffline}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>Open Saved / Downloads</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : previewItem.youtubeId ? (
                      <iframe
                        ref={inlineIframeRef}
                        key={previewItem.youtubeId}
                        src={buildYouTube1080Url(previewItem.youtubeId)}
                        title={previewItem.title}
                        onLoad={() => enforceYouTube1080p(inlineIframeRef.current)}
                        className={
                          playerScaleMode === 'fill'
                            ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100%,calc(44vh*16/9))] h-[max(100%,calc(100vw*9/16))] border-0'
                            : 'w-full h-full border-0'
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full relative flex flex-col items-center justify-center p-4 text-center">
                        <img
                          src={previewItem.thumbnailUrl}
                          alt={previewItem.title}
                          className={`absolute inset-0 w-full h-full opacity-55 ${
                            playerScaleMode === 'fill' ? 'object-cover' : 'object-contain'
                          }`}
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <Film className="w-10 h-10 text-cyan-400" />
                          <p className="text-sm text-white font-bold">{previewItem.title}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full-Screen Playit-Style Stretched / 16:9 Cinema Lightbox */}
          {previewItem && isCinemaMode && (
            <div
              ref={cinemaViewportRef}
              className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-150 overflow-hidden ${
                playerScaleMode === 'fill' ? 'p-0' : 'p-3 sm:p-6'
              }`}
              onClick={() => setIsCinemaMode(false)}
            >
              {/* Floating Controls Header */}
              <div
                className={`z-30 flex items-center justify-between gap-2 transition-all ${
                  playerScaleMode === 'fill'
                    ? 'absolute top-3 left-3 right-3 px-3 py-2 rounded-2xl bg-black/65 backdrop-blur-md border border-white/15'
                    : 'w-[min(95vw,calc(80vh*16/9))] max-w-6xl mb-3 px-1'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-[10px] font-black shrink-0">
                    1080p FHD
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-sm font-black text-white truncate">
                      {previewItem.title}
                    </h2>
                    <p className="text-[11px] text-neutral-400 truncate hidden sm:block">
                      {previewItem.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerScaleMode((prev) => (prev === 'fill' ? 'fit' : 'fill'))
                    }
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      playerScaleMode === 'fill'
                        ? 'bg-pink-600 text-white border-pink-400'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-neutral-700'
                    }`}
                    title="Switch between Playit Stretch Fill and 16:9 Fit"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{playerScaleMode === 'fill' ? 'Fill Screen' : 'Fit 16:9'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFullscreenApi}
                    className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-bold items-center gap-1 cursor-pointer"
                    title="Browser True Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Device FS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCinemaMode(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-neutral-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Minimize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCinemaMode(false);
                      setPreviewItem(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Close</span>
                  </button>
                </div>
              </div>

              <div
                onClick={(e) => e.stopPropagation()}
                className={
                  playerScaleMode === 'fill'
                    ? 'relative w-screen h-[100dvh] overflow-hidden bg-black'
                    : 'relative w-[min(95vw,calc(80vh*16/9))] max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl'
                }
              >
                {!isOnline && previewItem.youtubeId ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-950 space-y-3">
                    <WifiOff className="w-10 h-10 text-amber-400" />
                    <h3 className="text-base font-black text-white">Online YouTube Streaming Unavailable Offline</h3>
                    <p className="text-xs text-neutral-400 max-w-md">
                      Connect to Wi-Fi or mobile data to watch YouTube streams, or play your downloaded reels, songs &amp; naats in Profile &rarr; Saved / Downloads.
                    </p>
                    {onOpenSavedOffline && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCinemaMode(false);
                          onOpenSavedOffline();
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black cursor-pointer"
                      >
                        Go to Saved / Downloads
                      </button>
                    )}
                  </div>
                ) : previewItem.youtubeId ? (
                  <iframe
                    ref={cinemaIframeRef}
                    key={`cinema-${previewItem.youtubeId}`}
                    src={buildYouTube1080Url(previewItem.youtubeId)}
                    title={previewItem.title}
                    onLoad={() => enforceYouTube1080p(cinemaIframeRef.current)}
                    className={
                      playerScaleMode === 'fill'
                        ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100vw,calc(100dvh*16/9))] h-[max(100dvh,calc(100vw*9/16))] border-0'
                        : 'w-full h-full border-0'
                    }
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-6 text-center">
                    <img
                      src={previewItem.thumbnailUrl}
                      alt={previewItem.title}
                      className={`absolute inset-0 w-full h-full opacity-55 ${
                        playerScaleMode === 'fill' ? 'object-cover' : 'object-contain'
                      }`}
                    />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <Film className="w-12 h-12 text-cyan-400" />
                      <p className="text-base text-white font-bold">{previewItem.title}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Search & Video Cards Area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4 pb-24 lg:pb-8"
          >
            {/* Friendly Offline Notice inside Movie Box when internet is disconnected */}
            {!isOnline && (
              <div className="max-w-6xl mx-auto p-3.5 rounded-2xl bg-amber-950/35 border border-amber-500/45 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-300">
                      Offline Mode — Online YouTube Streaming Unavailable
                    </p>
                    <p className="text-[11px] text-neutral-300">
                      Reconnect to stream YouTube movies, or watch your locally saved reels, songs &amp; naats in Profile.
                    </p>
                  </div>
                </div>
                {onOpenSavedOffline && (
                  <button
                    type="button"
                    onClick={onOpenSavedOffline}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Open Saved / Downloads</span>
                  </button>
                )}
              </div>
            )}
            {/* Top Search & Filter Bar */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Input with Search CTA Button in Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchYouTubeLive();
                }}
                className="flex-1 flex flex-col sm:flex-row items-stretch gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Trending Movies, Punjabi Songs, Pakistani Dramas..."
                    className="w-full bg-neutral-900/90 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-9 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchSource('catalog');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* YouTube Live Search CTA */}
                <button
                  type="submit"
                  disabled={isSearchingYouTube}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 active:scale-95 transition-all shrink-0 border border-red-400/30 cursor-pointer"
                >
                  <Youtube className="w-4 h-4 fill-white" />
                  <span>{isSearchingYouTube ? 'Searching...' : 'Search'}</span>
                </button>
              </form>

              {/* Sort Dropdown (Catalog view) */}
              {searchSource !== 'youtube' && (
                <div className="flex items-center gap-2 shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs text-neutral-400 font-semibold hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-neutral-900 text-xs text-white border border-neutral-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-cyan-500 transition-colors"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="size_desc">Largest File Size</option>
                    <option value="size_asc">Smallest File Size</option>
                  </select>
                </div>
              )}
            </div>

            {/* Global Content Hub Dedicated Category Tabs */}
            <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Global Hub:
              </span>
              {GLOBAL_HUB_TABS.map((tab) => {
                const isTabActive = activeGlobalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectGlobalTab(tab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                      isTabActive
                        ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white border-cyan-400 shadow-md shadow-pink-600/20'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-pink-500/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Quick Movie Box YouTube Search Category Chips */}
            <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
                Quick Search:
              </span>
              {QUICK_MOVIEBOX_CHIPS.map((chip) => {
                const isChipActive =
                  searchSource === 'youtube' &&
                  searchQuery.trim().toLowerCase() === chip.toLowerCase();
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSearchYouTubeLive(chip)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                      isChipActive
                        ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white border-red-400 shadow-md shadow-red-600/25'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800 hover:border-pink-500/40'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {/* Inline Status Header: Directly Above the Grid */}
            {searchSource === 'youtube' && youtubeLiveResults.length > 0 && (
              <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-red-950/25 border border-red-500/35 text-xs">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-white font-bold">
                    Showing {youtubeLiveResults.length} playable videos
                    {searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSearchSource('youtube')}
                    className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-red-600 text-white"
                  >
                    Playable Videos ({youtubeLiveResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchSource('catalog')}
                    className="px-2.5 py-1 rounded-lg font-bold text-[11px] text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 cursor-pointer"
                  >
                    Catalog
                  </button>
                </div>
              </div>
            )}

            {/* Catalog Category Pills (only when viewing Catalog mode so YouTube results appear directly below "Showing X playable videos") */}
            {searchSource !== 'youtube' && (
              <div className="max-w-6xl mx-auto overflow-x-auto no-scrollbar pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  {youtubeLiveResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchSource('youtube')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 cursor-pointer"
                    >
                      <Youtube className="w-3.5 h-3.5 fill-red-400" />
                      <span>YouTube Results ({youtubeLiveResults.length})</span>
                    </button>
                  )}
                  {DOWNLOAD_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const count =
                      cat.id === 'all'
                        ? items.length
                        : items.filter((it) => it.category === cat.id).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white border-pink-400/60 shadow-lg shadow-pink-600/30 scale-102'
                            : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800'
                        }`}
                      >
                        {renderCategoryIcon(cat.id, 'w-3.5 h-3.5')}
                        <span>{cat.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected
                              ? 'bg-black/40 text-white'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Marketplace / Fetched Videos Grid (Directly below "Showing X playable videos") */}
            <div className="max-w-6xl mx-auto">
              {isSearchingYouTube ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-3 animate-pulse"
                    >
                      <div className="w-full aspect-video rounded-xl bg-neutral-800/80" />
                      <div className="space-y-2">
                        <div className="h-4 w-4/5 rounded-md bg-neutral-800" />
                        <div className="h-3 w-1/2 rounded-md bg-neutral-800/70" />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-neutral-800/80">
                        <div className="h-8 w-16 rounded-xl bg-neutral-800" />
                        <div className="h-8 flex-1 rounded-xl bg-neutral-800/80" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 space-y-3">
                  <Search className="w-10 h-10 mx-auto text-neutral-600" />
                  <p className="text-sm font-bold text-neutral-300">
                    {searchSource === 'youtube'
                      ? 'No live YouTube results found for your query'
                      : 'No items matched your query'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSearchSource('catalog');
                      setYoutubeLiveResults([]);
                      try {
                        sessionStorage.removeItem('jatt_yt_search_results');
                        sessionStorage.setItem('jatt_yt_search_query', '');
                        sessionStorage.setItem('jatt_yt_search_source', 'catalog');
                        sessionStorage.setItem('jatt_hub_selected_category', 'all');
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-pink-400 rounded-xl transition-colors cursor-pointer"
                  >
                    Reset to Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [transform:translateZ(0)]">
                  {displayedItems.map((item) => {
                    const state = downloadStates[item.id] || {
                      progress: 0,
                      isDownloading: false,
                      isPaused: false,
                      isCompleted: false,
                      speed: '',
                      downloadedBytes: 0,
                    };
                    const isCurrentlyPlaying = previewItem?.id === item.id;
                    const isYouTubeCard =
                      Boolean(item.youtubeId) && (searchSource === 'youtube' || item.id.startsWith('yt-'));

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.youtubeId) {
                            openVideoPlayer(item);
                            onShowToast(`Playing "${item.title}"`);
                          }
                        }}
                        className={`group cv-auto-card bg-neutral-900/90 hover:bg-neutral-900 border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between [transform:translateZ(0)] relative overflow-hidden ${
                          isCurrentlyPlaying
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : item.youtubeId
                            ? 'border-neutral-800 hover:border-pink-500/60 cursor-pointer'
                            : 'border-neutral-800 hover:border-pink-500/50'
                        }`}
                      >
                        {/* Top Media Info Row: Prominent 16:9 Widescreen Clickable Thumbnail for YouTube results */}
                        <div>
                          {isYouTubeCard ? (
                            <div className="space-y-2.5">
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800 group-hover:border-red-500/60 transition-colors">
                                <img
                                  src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-12 h-12 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="w-5 h-5 fill-white ml-0.5" />
                                  </div>
                                </div>
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600/90 text-[10px] font-black text-white uppercase flex items-center gap-1">
                                  <Youtube className="w-3 h-3 fill-white" />
                                  <span>{isCurrentlyPlaying ? 'Playing' : 'YouTube'}</span>
                                </span>
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-pink-400 transition-colors">
                                  {item.title}
                                </h3>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>
                          ) : (
                          <>
                            <div className="flex gap-3.5">
                              {/* Thumbnail with quality badge & Hover Play Overlay */}
                              <div className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/80 shadow-md group-hover:scale-102 transition-transform">
                                <img
                                  src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                                {/* Category Icon Badge */}
                                <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/70 text-pink-400 text-[10px]">
                                  {renderCategoryIcon(item.category, 'w-3 h-3')}
                                </span>

                                {/* Hover Play Indicator for YouTube streams */}
                                {item.youtubeId && (
                                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10 pointer-events-none">
                                    <div className="w-9 h-9 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg shadow-red-600/60 scale-90 group-hover:scale-100 transition-transform">
                                      <Play className="w-4 h-4 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                )}

                                {/* Duration / Version Pill */}
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-sm bg-black/80 text-[9px] font-bold text-neutral-200">
                                  {item.durationOrVersion}
                                </span>
                              </div>

                              {/* Item Details */}
                              <div className="flex-1 min-w-0">
                                {/* Quality Badge */}
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                                    {item.qualityBadge}
                                  </span>
                                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                                    {item.rating}
                                  </span>
                                  {item.youtubeId && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-0.5">
                                      <Youtube className="w-2.5 h-2.5 fill-red-400" />
                                      <span>Tap to Play</span>
                                    </span>
                                  )}
                                </div>

                                <h3 className="text-sm font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                                  {item.title}
                                </h3>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>

                                {/* File Size & Downloads Counter Layout */}
                                <div className="flex items-center gap-2 mt-2 text-xs">
                                  <span className="px-2 py-0.5 rounded-md bg-neutral-800/80 font-black text-white tabular-nums border border-neutral-700/60">
                                    📦 {item.fileSize}
                                  </span>
                                  <span className="text-[11px] text-neutral-400 font-semibold">
                                    {item.downloadsCount} DLs
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Description & Tags */}
                            {item.description && (
                              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-3 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </>
                        )}

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-800/50 text-neutral-400 border border-neutral-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* PROMINENT GLOW-STYLED "DOWNLOAD NOW" PROGRESS BUTTON      */}
                      {/* ========================================================= */}
                      <div className="mt-4 pt-3 border-t border-neutral-800/80">
                        {state.isCompleted ? (
                          /* COMPLETED STATE */
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                Downloaded & Ready
                              </span>
                              <span className="text-neutral-400 text-[10px] tabular-nums">
                                {item.fileSize}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVideoPlayer(item);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-98 transition-all border border-emerald-400/40 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Open / Play File</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartDownload(item);
                                }}
                                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs transition-colors cursor-pointer"
                                title="Re-download"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : state.isDownloading ? (
                          /* IN-PROGRESS DOWNLOADING STATE */
                          <div className="space-y-2">
                            {/* Live Stats Header */}
                            <div className="flex items-center justify-between text-xs font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                <span className="text-cyan-400 font-bold">
                                  {state.isPaused ? 'Paused' : `Downloading (${state.progress}%)`}
                                </span>
                              </div>
                              <span className="text-neutral-300 text-[11px] tabular-nums">
                                {state.speed}
                              </span>
                            </div>

                            {/* Heavy Glow Progress Bar */}
                            <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden p-0.5 border border-cyan-500/30 shadow-inner">
                              <div
                                style={{ width: `${state.progress}%` }}
                                className="h-full bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-500 rounded-full transition-all duration-300 shadow-md shadow-cyan-500/50"
                              />
                            </div>

                            {/* Control Actions (Pause/Resume, Cancel) */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-neutral-400 tabular-nums">
                                {(state.downloadedBytes / (1024 * 1024)).toFixed(1)} MB of {item.fileSize}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {state.isPaused ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResumeDownload(item);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Resume</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePauseDownload(item);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pause className="w-3 h-3" />
                                    <span>Pause</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDownload(item.id, item.title);
                                  }}
                                  className="p-1 text-neutral-500 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                                  title="Cancel download"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* DEFAULT IDLE STATE: WATCHLIST / DOWNLOAD HELPER / DIRECT DOWNLOAD */
                          item.youtubeId ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVideoPlayer(item);
                                }}
                                className="py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all shrink-0 cursor-pointer"
                                title="Play in Movie Box Embed Player"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Play</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWatchlist(item);
                                }}
                                className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-98 cursor-pointer min-w-0 ${
                                  offlineWatchlist.some((w) => w.id === item.id)
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                                }`}
                                title="Save to Offline Watchlist"
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    offlineWatchlist.some((w) => w.id === item.id)
                                      ? 'fill-amber-400 text-amber-400'
                                      : ''
                                  }`}
                                />
                                <span className="truncate">
                                  {offlineWatchlist.some((w) => w.id === item.id) ? 'Saved' : 'Watchlist'}
                                </span>
                              </button>

                              <a
                                href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-1 shrink-0"
                                title="External YouTube / Download Helper Link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Save / Link</span>
                              </a>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartDownload(item);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/40 group/btn min-w-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-white shrink-0 group-hover/btn:translate-y-0.5 transition-transform" />
                                <span className="tracking-wide truncate">Download</span>
                                <span className="text-[10px] font-bold text-neutral-200/80 bg-black/30 px-1 py-0.2 rounded-md shrink-0">
                                  {item.fileSize}
                                </span>
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Direct YouTube Link Streamer Bar (placed cleanly below results so fetched cards come first) */}
          <div className="max-w-6xl mx-auto p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-semibold text-[11px] sm:text-xs">
                Paste any YouTube link or Video ID to play:
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:max-w-md">
              <input
                type="text"
                value={directUrlInput}
                onChange={(e) => setDirectUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePlayDirectUrl()}
                placeholder="Paste YouTube link (https://youtube.com...) or Video ID"
                className="w-full bg-black/60 text-xs text-white placeholder-neutral-500 px-3 py-1.5 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handlePlayDirectUrl}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : (
        /* ========================================================================= */
        /* "MY DOWNLOADS" SESSION MANAGER VIEW                                       */
        /* ========================================================================= */
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-5">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Storage Header Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Offline Watchlist & Local Downloads</h2>
                  <p className="text-xs text-neutral-400">
                    {offlineWatchlist.length} watchlist video(s) · {completedDownloads.length} downloaded file(s) ({totalDownloadedSizeStr})
                  </p>
                </div>
              </div>

              {(completedDownloads.length > 0 || offlineWatchlist.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setDownloadStates({});
                    setOfflineWatchlist([]);
                    try {
                      localStorage.removeItem(OFFLINE_WATCHLIST_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                    onShowToast('Cleared all saved watchlist items & local downloads');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Saved YouTube Offline Watchlist Section */}
            {offlineWatchlist.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Offline Watchlist ({offlineWatchlist.length})</span>
                </h3>
                {offlineWatchlist.map((item) => (
                  <div
                    key={`wl-${item.id}`}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-11 rounded-xl object-cover border border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openVideoPlayer(item)}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play</span>
                      </button>
                      {item.youtubeId && (
                        <a
                          href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700"
                          title="Open External Watch / Download Helper"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleWatchlist(item)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedDownloads.length === 0 && offlineWatchlist.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 rounded-2xl border border-dashed border-neutral-800 space-y-3">
                <Download className="w-10 h-10 mx-auto text-neutral-600" />
                <h3 className="text-sm font-bold text-neutral-300">No saved videos or downloads yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Browse the Global Content Hub to save Hollywood movies, English dubbed films, dramas, or trending songs to your watchlist.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('marketplace')}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Explore Global Hub
                </button>
              </div>
            ) : completedDownloads.length > 0 ? (
              <div className="space-y-2.5">
                {completedDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3 shadow-md hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 rounded-xl object-cover border border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                            {item.categoryLabel}
                          </span>
                          <span className="text-[10px] text-neutral-500">·</span>
                          <span className="text-[10px] text-neutral-400">{item.fileSize}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openVideoPlayer(item)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDownload(item.id, item.title)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

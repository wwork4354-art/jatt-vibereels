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
} from 'lucide-react';
import { DownloadItem, DownloadCategory } from '../types';
import { INITIAL_DOWNLOADS, DOWNLOAD_CATEGORIES } from '../data/mockDownloads';
import { soundEngine } from '../utils/soundEngine';

const QUICK_MOVIEBOX_CHIPS = [
  'Trending Movies',
  'Punjabi Songs',
  'Pakistani Dramas',
  'Action Movies',
];

const CURATED_FALLBACK_VIDEOS: Record<string, DownloadItem[]> = {
  'Trending Movies': [
    {
      id: 'yt-q6T0wOMHKDU',
      title: 'Action Blockbuster Full Movie in HD | Sci-Fi Thriller',
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
      categoryLabel: 'YouTube Live',
      fileSize: 'Streaming HD',
      sizeBytes: 12000000,
      durationOrVersion: 'Audio/Video HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/hqdefault.jpg',
      fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Punjabi Songs', 'Trending'],
      description: 'Non-stop Punjabi music stream.',
      youtubeId: '6MgsHSAcI9k',
    },
  ],
  'Pakistani Dramas': [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Sintel - Award Winning Fantasy Drama Short Film',
      subtitle: 'Blender Studio',
      category: 'dramas',
      categoryLabel: 'YouTube Live',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: 'Drama HD',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Pakistani Dramas', 'HD'],
      description: 'Full dramatic feature stream.',
      youtubeId: 'eRsGyueVLvQ',
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
  onShowToast,
  isMuted,
  onToggleMute,
}) => {
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

  // Track active video player item
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

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
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 30);
  };

  // Play any custom YouTube link or video ID directly in standard embed player
  const handlePlayDirectUrl = () => {
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

  // Bulletproof multi-tier search: YouTube Data API v3 -> Public Invidious/Piped APIs -> Verified Local Fallback
  const handleSearchYouTubeLive = async (targetQuery?: string) => {
    const query = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (!query) {
      onShowToast('Type a movie, drama, or song title to search.');
      return;
    }
    if (targetQuery !== undefined) {
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

      // Tier 1: Official YouTube Data API v3 (only if key is configured)
      if (effectiveKey) {
        try {
          const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=18&type=video&q=${encodeURIComponent(
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
        const qLower = query.toLowerCase();
        const curatedKey = Object.keys(CURATED_FALLBACK_VIDEOS).find((k) =>
          qLower.includes(k.toLowerCase()) || k.toLowerCase().includes(qLower)
        );
        const catalogMatches = INITIAL_DOWNLOADS.filter(
          (it) =>
            Boolean(it.youtubeId) &&
            (it.title.toLowerCase().includes(qLower) ||
              it.subtitle.toLowerCase().includes(qLower) ||
              it.tags.some((t) => t.toLowerCase().includes(qLower)))
        );
        const allCatalogYoutube = INITIAL_DOWNLOADS.filter((it) => Boolean(it.youtubeId));

        mappedResults = [
          ...(curatedKey ? CURATED_FALLBACK_VIDEOS[curatedKey] : []),
          ...catalogMatches,
          ...(!curatedKey && catalogMatches.length === 0 ? allCatalogYoutube : []),
        ].slice(0, 12);
      }

      setYoutubeLiveResults(mappedResults);
      setSearchSource('youtube');
      onShowToast(`Showing ${mappedResults.length} playable videos for "${query}" 🎬`);
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
              <span>My Downloads</span>
              {completedDownloads.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-black text-[10px] font-black">
                  {completedDownloads.length}
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
        /* MARKETPLACE VIEW: CATEGORIES, SEARCH, PLAYER SCREEN & VIDEO CARDS        */
        /* ========================================================================= */
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4 pb-20 lg:pb-8"
        >
          {/* ========================================================================= */}
          {/* RESPONSIVE VIDEO PLAYER SCREEN AT THE TOP WHEN VIDEO SELECTED             */}
          {/* ========================================================================= */}
          {previewItem && (
            <div className="max-w-6xl mx-auto bg-neutral-900 border border-pink-500/40 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
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
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close Player</span>
                </button>
              </div>

              <div className="relative w-full aspect-video max-h-[460px] rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-neutral-800">
                {previewItem.youtubeId ? (
                  <iframe
                    key={previewItem.youtubeId}
                    src={`https://www.youtube-nocookie.com/embed/${previewItem.youtubeId}?autoplay=1&rel=0&playsinline=1`}
                    title={previewItem.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-4 text-center">
                    <img
                      src={previewItem.thumbnailUrl}
                      alt={previewItem.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                    />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <Film className="w-10 h-10 text-cyan-400" />
                      <p className="text-sm text-white font-bold">{previewItem.title}</p>
                    </div>
                  </div>
                )}
              </div>
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

            {/* Sort Dropdown */}
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

          {/* Quick Direct YouTube Video Streamer Bar */}
          <div className="max-w-6xl mx-auto p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-semibold text-[11px] sm:text-xs">
                Stream any YouTube video in Movie Box (Zero 3rd-Party Blocks):
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
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-all shadow-md"
              >
                Play
              </button>
            </div>
          </div>

          {/* Search Source Toggle Pills if live search was used */}
          {youtubeLiveResults.length > 0 && (
            <div className="max-w-6xl mx-auto flex items-center justify-between p-2.5 rounded-xl bg-red-950/20 border border-red-500/30 text-xs">
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                <span className="text-white font-bold">
                  Showing {searchSource === 'youtube' ? 'YouTube Live Results' : 'Standard Catalog'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchSource('youtube')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                    searchSource === 'youtube' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  YouTube Live ({youtubeLiveResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchSource('catalog')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                    searchSource === 'catalog' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Verified Catalog
                </button>
              </div>
            </div>
          )}

          {/* Categorization Pills (Songs, Apps, Dramas, Movies, Cartoons, Quran Tilawat) */}
          <div className="max-w-6xl mx-auto overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-2 min-w-max">
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
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
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

          {/* Marketplace Media Grid */}
          <div className="max-w-6xl mx-auto">
            {displayedItems.length === 0 ? (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [transform:translateZ(0)]">
                {displayedItems.map((item) => {
                  const state = downloadStates[item.id] || {
                    progress: 0,
                    isDownloading: false,
                    isPaused: false,
                    isCompleted: false,
                    speed: '',
                    downloadedBytes: 0,
                  };

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.youtubeId) {
                          openVideoPlayer(item);
                          onShowToast(`Playing "${item.title}" in Movie Box! 🎬🔥`);
                        }
                      }}
                      className={`group bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between [transform:translateZ(0)] relative overflow-hidden ${
                        item.youtubeId ? 'cursor-pointer hover:border-pink-500/60' : ''
                      }`}
                    >
                      {/* Top Media Info Row: Prominent 16:9 Widescreen Clickable Thumbnail for YouTube Live results */}
                      <div>
                        {item.id.startsWith('yt-') && item.youtubeId ? (
                          <div className="space-y-2.5">
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800 group-hover:border-red-500/60 transition-colors">
                              <img
                                src={item.thumbnailUrl}
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
                                <span>YouTube</span>
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
                                  src={item.thumbnailUrl}
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
                          /* DEFAULT IDLE STATE: WATCH MOVIE BOX STREAM & GLOW DOWNLOAD BUTTON */
                          <div className="flex items-center gap-2">
                            {item.youtubeId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVideoPlayer(item);
                                }}
                                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600/25 to-pink-600/25 hover:from-red-600/40 hover:to-pink-600/40 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-red-500/40 shadow-md active:scale-98 transition-all shrink-0 cursor-pointer"
                                title="Watch in official standard YouTube embed player"
                              >
                                <Youtube className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                                <span className="hidden sm:inline">Movie Box</span>
                                <span className="sm:hidden">Play</span>
                              </button>
                            )}
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
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  <h2 className="text-base font-bold text-white">Local App Storage</h2>
                  <p className="text-xs text-neutral-400">
                    {completedDownloads.length} item(s) saved in this session · {totalDownloadedSizeStr} downloaded
                  </p>
                </div>
              </div>

              {completedDownloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDownloadStates({});
                    onShowToast('Cleared all local downloads');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Storage</span>
                </button>
              )}
            </div>

            {completedDownloads.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 rounded-2xl border border-dashed border-neutral-800 space-y-3">
                <Download className="w-10 h-10 mx-auto text-neutral-600" />
                <h3 className="text-sm font-bold text-neutral-300">No media downloaded yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Browse the marketplace to download your favorite Punjabi songs, Android apps, 4K movies, or Quran recitations.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('marketplace')}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Explore Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {completedDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3 shadow-md hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};

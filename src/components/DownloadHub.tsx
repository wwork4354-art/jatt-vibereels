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
  AlertTriangle,
  Key,
  Link2,
} from 'lucide-react';
import { DownloadItem, DownloadCategory, FeedTab } from '../types';
import { INITIAL_DOWNLOADS, DOWNLOAD_CATEGORIES } from '../data/mockDownloads';
import { soundEngine } from '../utils/soundEngine';

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
  const [items] = useState<DownloadItem[]>(INITIAL_DOWNLOADS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'size_desc' | 'size_asc' | 'rating'>('popular');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my_downloads'>('marketplace');

  // Track download progress per item ID
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadProgressState>>(() => {
    // Check if any were stored in session
    try {
      const stored = sessionStorage.getItem('jatt_downloads_state');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Track media preview modal
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // YouTube Data API & Movie Box States
  const [apiKey, setApiKey] = useState<string>(() => {
    return (
      (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) ||
      localStorage.getItem('jatt_youtube_api_key') ||
      ''
    );
  });
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [showKeyManager, setShowKeyManager] = useState<boolean>(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [isSearchingYouTube, setIsSearchingYouTube] = useState<boolean>(false);
  const [youtubeLiveResults, setYoutubeLiveResults] = useState<DownloadItem[]>([]);
  const [searchSource, setSearchSource] = useState<'catalog' | 'youtube'>('catalog');
  const [directUrlInput, setDirectUrlInput] = useState<string>('');

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
      subtitle: `Official Standard Embed (ID: ${ytid})`,
      category: 'movies',
      categoryLabel: 'Movie Box Stream',
      fileSize: 'Streaming 1080p',
      sizeBytes: 150000000,
      durationOrVersion: 'Live / HD',
      qualityBadge: 'YouTube 1080p Embed',
      thumbnailUrl: `https://img.youtube.com/vi/${ytid}/hqdefault.jpg`,
      fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
      downloadsCount: 'Stream',
      rating: 5.0,
      tags: ['YouTube Stream', 'Standard Embed', 'No 3rd-Party Blocks'],
      description: 'Streamed directly using official standard YouTube iframe player (https://youtube.com/embed/...) with zero third-party blocks.',
      youtubeId: ytid,
    };
    setPreviewItem(directItem);
    setDirectUrlInput('');
    onShowToast('Loading in standard YouTube embed player! 🎬🔥');
  };

  // Query YouTube Data API for live Movies, Dramas, and Songs
  const handleSearchYouTubeLive = async (targetQuery?: string) => {
    const query = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (!query) {
      onShowToast('Type a movie, drama, or song title to search YouTube.');
      return;
    }

    // Check if API key is missing
    if (!apiKey.trim()) {
      setApiErrorMessage(
        'YouTube Data API Key is missing: To search live YouTube movies, dramas, and songs, please configure VITE_YOUTUBE_API_KEY in your .env or enter your Google Cloud API key below. Meanwhile, you can stream from our verified standard YouTube embed collection or paste any YouTube URL.'
      );
      setShowKeyManager(true);
      onShowToast('YouTube Data API key is missing! Check settings.');
      return;
    }

    setIsSearchingYouTube(true);
    setApiErrorMessage(null);

    try {
      const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&type=video&q=${encodeURIComponent(
        query
      )}&key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || `YouTube API returned status ${res.status}`);
      }

      if (!data.items || data.items.length === 0) {
        onShowToast(`No live YouTube results found for "${query}".`);
        setYoutubeLiveResults([]);
      } else {
        const mapped: DownloadItem[] = data.items
          .filter((item: any) => item.id?.videoId)
          .map((item: any) => ({
            id: `yt-${item.id.videoId}`,
            title: item.snippet.title,
            subtitle: item.snippet.channelTitle,
            category: (selectedCategory === 'all' ? 'movies' : selectedCategory) as DownloadCategory,
            categoryLabel: 'YouTube Live',
            fileSize: 'Streaming HD',
            sizeBytes: 150000000,
            durationOrVersion: 'YouTube Stream',
            qualityBadge: 'YouTube 1080p Embed',
            thumbnailUrl:
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.medium?.url ||
              `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
            fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
            downloadsCount: 'YouTube',
            rating: 4.9,
            tags: ['YouTube Live', 'Standard Embed', 'Movie Box'],
            description: item.snippet.description,
            youtubeId: item.id.videoId,
          }));
        setYoutubeLiveResults(mapped);
        setSearchSource('youtube');
        onShowToast(`Found ${mapped.length} live YouTube titles!`);
      }
    } catch (err: any) {
      console.error('YouTube Data API query failed:', err);
      setApiErrorMessage(
        `YouTube Data API Error: ${err.message || 'Failed to search YouTube'}. Please verify your API key and quota permissions.`
      );
      onShowToast('YouTube API error: Key missing or invalid.');
    } finally {
      setIsSearchingYouTube(false);
    }
  };

  // Save or clear custom YouTube Data API key
  const handleSaveCustomKey = () => {
    const trimmed = customKeyInput.trim();
    if (!trimmed) {
      localStorage.removeItem('jatt_youtube_api_key');
      const envKey = (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) || '';
      setApiKey(envKey);
      if (!envKey) {
        setApiErrorMessage('YouTube Data API Key is missing.');
      } else {
        setApiErrorMessage(null);
      }
      onShowToast('Custom YouTube API key cleared.');
      return;
    }
    localStorage.setItem('jatt_youtube_api_key', trimmed);
    setApiKey(trimmed);
    setApiErrorMessage(null);
    setShowKeyManager(false);
    onShowToast('YouTube Data API Key saved successfully!');
  };

  // Sync to session
  useEffect(() => {
    try {
      sessionStorage.setItem('jatt_downloads_state', JSON.stringify(downloadStates));
    } catch {
      // ignore
    }
  }, [downloadStates]);

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
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-neutral-950/90 border-b border-neutral-800/80 backdrop-blur-md flex items-center justify-between gap-3 z-30">
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
        /* MARKETPLACE VIEW: CATEGORIES, SEARCH, SORTS & GLOW DOWNLOAD CARDS        */
        /* ========================================================================= */
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4">
          {/* Top Search & Filter Bar */}
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input with YouTube Live Search Button */}
            <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchSource === 'youtube') {
                        handleSearchYouTubeLive();
                      }
                    }
                  }}
                  placeholder="Search Punjabi drill, apps, 4K movies, Quran tilawat..."
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
                type="button"
                onClick={() => handleSearchYouTubeLive()}
                disabled={isSearchingYouTube}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 active:scale-95 transition-all shrink-0 border border-red-400/30"
                title="Search Official YouTube Data API"
              >
                <Youtube className="w-4 h-4 fill-white" />
                <span>{isSearchingYouTube ? 'Searching...' : 'Search YouTube'}</span>
              </button>

              {/* API Key Status / Toggle Button */}
              <button
                type="button"
                onClick={() => setShowKeyManager(!showKeyManager)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  apiKey.trim()
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
                }`}
                title={apiKey.trim() ? 'YouTube API Key Active' : 'YouTube API Key Missing - Click to configure'}
              >
                {apiKey.trim() ? (
                  <>
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">API Key Active</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>API Key Missing</span>
                  </>
                )}
              </button>
            </div>

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

          {/* ========================================================= */}
          {/* CLEAR ERROR MESSAGE WHEN YOUTUBE API KEY IS MISSING       */}
          {/* ========================================================= */}
          {apiErrorMessage && (
            <div className="max-w-6xl mx-auto p-4 rounded-2xl bg-amber-950/40 border-2 border-amber-500/60 text-amber-200 text-xs space-y-2.5 shadow-2xl backdrop-blur-md animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>YouTube Data API Notice</span>
                </div>
                <button
                  type="button"
                  onClick={() => setApiErrorMessage(null)}
                  className="text-neutral-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-neutral-300 leading-relaxed text-xs">
                {apiErrorMessage}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="password"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="Enter or paste YouTube Data API v3 Key..."
                  className="w-full sm:flex-1 bg-black/80 border border-amber-500/40 text-xs text-white px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-amber-400"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSaveCustomKey}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Save & Test Key
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApiErrorMessage(null);
                      setSearchSource('catalog');
                    }}
                    className="px-3 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold rounded-xl border border-neutral-700"
                  >
                    Use Verified Catalog
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expandable Key Manager Panel */}
          {showKeyManager && !apiErrorMessage && (
            <div className="max-w-6xl mx-auto p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xs space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>Configure YouTube Data API v3 Key</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowKeyManager(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Provide your Google Cloud YouTube Data API v3 key for live search queries across YouTube.
                Alternatively, standard verified embeds play for all movies, dramas, and songs without requiring a key.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder={apiKey ? 'API Key is currently set (paste new to replace)...' : 'Paste YouTube Data API key...'}
                  className="flex-1 bg-black/60 border border-neutral-700 text-xs text-white px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomKey}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Save Key
                </button>
              </div>
            </div>
          )}

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
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-pink-400 rounded-xl transition-colors"
                >
                  Reset to Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      className="group bg-neutral-900/70 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/40 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between shadow-xl backdrop-blur-md relative overflow-hidden"
                    >
                      {/* Top Media Info Row */}
                      <div>
                        <div className="flex gap-3.5">
                          {/* Thumbnail with quality badge */}
                          <div className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/80 shadow-md group-hover:scale-102 transition-transform">
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                            
                            {/* Category Icon Badge */}
                            <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/70 backdrop-blur-md text-pink-400 text-[10px]">
                              {renderCategoryIcon(item.category, 'w-3 h-3')}
                            </span>

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
                                onClick={() => setPreviewItem(item)}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-98 transition-all border border-emerald-400/40"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Open / Play File</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartDownload(item)}
                                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs transition-colors"
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
                                    onClick={() => handleResumeDownload(item)}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Resume</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handlePauseDownload(item)}
                                    className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1"
                                  >
                                    <Pause className="w-3 h-3" />
                                    <span>Pause</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDownload(item.id, item.title)}
                                  className="p-1 text-neutral-500 hover:text-red-400 rounded-md transition-colors"
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
                                onClick={() => setPreviewItem(item)}
                                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600/25 to-pink-600/25 hover:from-red-600/40 hover:to-pink-600/40 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-red-500/40 shadow-md active:scale-98 transition-all shrink-0"
                                title="Watch in official standard YouTube embed player"
                              >
                                <Youtube className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                                <span className="hidden sm:inline">Movie Box</span>
                                <span className="sm:hidden">Play</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartDownload(item)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/40 group/btn min-w-0"
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
                        onClick={() => setPreviewItem(item)}
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

      {/* ========================================================================= */}
      {/* MEDIA PREVIEW / PLAYER MODAL                                              */}
      {/* ========================================================================= */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700/80 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
                  {renderCategoryIcon(previewItem.category, 'w-4 h-4')}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{previewItem.title}</h3>
                  <p className="text-xs text-neutral-400">{previewItem.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standard Embeddable YouTube Player (https://youtube.com...) */}
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center border border-neutral-800 shadow-2xl">
              {previewItem.youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${previewItem.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title={previewItem.title}
                  className="w-full h-full border-0 rounded-2xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full relative flex flex-col items-center justify-center p-4 text-center bg-gradient-to-t from-black via-neutral-900 to-black">
                  <img
                    src={previewItem.thumbnailUrl}
                    alt={previewItem.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <Film className="w-10 h-10 text-cyan-400 animate-pulse" />
                    <p className="text-sm text-white font-bold">{previewItem.title}</p>
                    <p className="text-xs text-neutral-400">Offline Local Storage Item</p>
                  </div>
                </div>
              )}
            </div>

            {/* Official Standard YouTube Embed Trust Banner */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px]">
              <div className="flex items-center gap-1.5 text-neutral-300">
                <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                <span className="font-semibold">Official Standard Embed Player</span>
              </div>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Web & APK Safe
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              <span className="text-xs text-neutral-400">
                {previewItem.qualityBadge} · {previewItem.fileSize}
              </span>
              <div className="flex items-center gap-2">
                {previewItem.youtubeId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${previewItem.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-500/40 transition-colors"
                  >
                    <Youtube className="w-3.5 h-3.5 fill-red-400" />
                    <span>Watch on YouTube</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleStartDownload(previewItem);
                    onShowToast(`Downloading "${previewItem.title}" to device...`);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                All-in-One <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Download Hub</span>
              </h1>
              <p className="text-[10px] text-neutral-400 hidden sm:block">
                High-speed downloads for Songs, Apps, Dramas, Movies, Cartoons & Quran
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
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-5">
          {/* Top Search & Filter Bar */}
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Punjabi drill, apps, 4K movies, Quran tilawat..."
                className="w-full bg-neutral-900/90 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-9 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-3">
                <Search className="w-10 h-10 mx-auto text-neutral-600" />
                <p className="text-sm font-bold text-neutral-300">No items matched your query</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-pink-400 rounded-xl transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
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
                          /* DEFAULT IDLE STATE: PROMINENT NEON GLOW DOWNLOAD BUTTON */
                          <button
                            type="button"
                            onClick={() => handleStartDownload(item)}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/40 group/btn"
                          >
                            <Download className="w-4 h-4 text-white group-hover/btn:translate-y-0.5 transition-transform" />
                            <span className="tracking-wide">Download Now</span>
                            <span className="text-[10px] font-bold text-neutral-200/80 bg-black/30 px-1.5 py-0.2 rounded-md">
                              {item.fileSize}
                            </span>
                          </button>
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

            {/* Simulated Player Display */}
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center border border-neutral-800">
              <img
                src={previewItem.thumbnailUrl}
                alt={previewItem.title}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-4">
                <div className="flex items-center justify-between text-xs text-neutral-200 font-bold mb-2">
                  <span>Playing from Download Hub</span>
                  <span className="text-cyan-400">{previewItem.qualityBadge}</span>
                </div>
                {/* Audio/Video Scrub Bar */}
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div className="w-2/5 h-full bg-gradient-to-r from-pink-500 to-cyan-400 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 tabular-nums">
                  <span>01:14</span>
                  <span>{previewItem.durationOrVersion}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-neutral-400">File size: {previewItem.fileSize}</span>
              <button
                type="button"
                onClick={() => {
                  onShowToast(`Exported "${previewItem.title}" to device storage!`);
                  setPreviewItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Export / Share</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

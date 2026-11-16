import React, { useState, useMemo } from 'react';
import {
  X,
  Flame,
  TrendingUp,
  Music,
  Hash,
  Play,
  Pause,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  ArrowUpRight,
  Search,
  Volume2,
} from 'lucide-react';
import { VideoPost, TrendingHashtag, TrendingAudio } from '../types';
import { TRENDING_HASHTAGS, TRENDING_AUDIOS } from '../data/mockTrends';
import { soundEngine } from '../utils/soundEngine';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

interface TrendsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoPost[];
  onSelectReel: (videoIndex: number) => void;
  onSelectHashtag: (tag: string) => void;
  onShowToast: (msg: string) => void;
}

type TrendsTab = 'all' | 'reels' | 'hashtags' | 'sounds';

export const TrendsDashboard: React.FC<TrendsDashboardProps> = ({
  isOpen,
  onClose,
  videos,
  onSelectReel,
  onSelectHashtag,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<TrendsTab>('all');
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Ranked videos sorted by real views + likes engagement (memoized before early return)
  const rankedVideos = useMemo(
    () =>
      [...videos].sort(
        (a, b) =>
          b.stats.views + b.stats.likes * 3 - (a.stats.views + a.stats.likes * 3)
      ),
    [videos]
  );

  // Dynamically compute real trending hashtags from uploaded/global posts
  const realTrendingHashtags = useMemo<TrendingHashtag[]>(() => {
    const tagMap = new Map<string, { views: number; reelsCount: number; likes: number }>();
    for (const v of videos) {
      for (const rawTag of v.hashtags || []) {
        const clean = rawTag.replace(/^#+/, '').trim();
        if (!clean) continue;
        const prev = tagMap.get(clean) || { views: 0, reelsCount: 0, likes: 0 };
        tagMap.set(clean, {
          views: prev.views + (v.stats.views || 0),
          reelsCount: prev.reelsCount + 1,
          likes: prev.likes + (v.stats.likes || 0),
        });
      }
    }
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1].views + b[1].likes - (a[1].views + a[1].likes))
      .map(([tag, info], idx) => ({
        rank: idx + 1,
        tag,
        views: info.views.toLocaleString(),
        reelsCount: info.reelsCount,
        growth: `${info.likes.toLocaleString()} likes`,
        isBreakout: idx === 0 && info.reelsCount > 0,
      }));
  }, [videos]);

  // Dynamically compute real trending audio from uploaded/global posts
  const realTrendingAudios = useMemo<TrendingAudio[]>(() => {
    const soundMap = new Map<
      string,
      { title: string; artist: string; count: number; trackType: TrendingAudio['trackType'] }
    >();
    for (const v of videos) {
      const title = v.sound?.title || 'Original Sound';
      const artist = v.sound?.artist || v.creator.name;
      const key = `${title}::${artist}`;
      const prev = soundMap.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        soundMap.set(key, {
          title,
          artist,
          count: 1,
          trackType: v.sound?.trackType || 'ambient_lofi',
        });
      }
    }
    return Array.from(soundMap.values())
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({
        id: `real-audio-${idx}-${item.title}`,
        rank: idx + 1,
        title: item.title,
        artist: item.artist,
        usesCount: `${item.count} ${item.count === 1 ? 'reel' : 'reels'}`,
        duration: '0:30',
        trackType: item.trackType,
      }));
  }, [videos]);

  const totalRealPlatformViews = useMemo(
    () => videos.reduce((sum, v) => sum + (v.stats.views || 0), 0),
    [videos]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredVideos = useMemo(
    () =>
      !normalizedQuery
        ? rankedVideos
        : rankedVideos.filter(
            (v) =>
              v.title.toLowerCase().includes(normalizedQuery) ||
              v.creator.name.toLowerCase().includes(normalizedQuery) ||
              v.hashtags.some((t) => t.toLowerCase().includes(normalizedQuery))
          ),
    [rankedVideos, normalizedQuery]
  );

  const filteredHashtags = useMemo(() => {
    const q = normalizedQuery.replace(/^#/, '');
    const source = realTrendingHashtags.length > 0 ? realTrendingHashtags : TRENDING_HASHTAGS;
    return !q ? source : source.filter((h) => h.tag.toLowerCase().includes(q));
  }, [normalizedQuery, realTrendingHashtags]);

  const filteredAudios = useMemo(() => {
    const source = realTrendingAudios.length > 0 ? realTrendingAudios : TRENDING_AUDIOS;
    return !normalizedQuery
      ? source
      : source.filter(
          (a) =>
            a.title.toLowerCase().includes(normalizedQuery) ||
            a.artist.toLowerCase().includes(normalizedQuery)
        );
  }, [normalizedQuery, realTrendingAudios]);

  if (!isOpen) return null;

  const formatRealViews = (views: number) => views.toLocaleString();

  const handleToggleAudio = (audio: TrendingAudio) => {
    if (playingAudioId === audio.id) {
      soundEngine.stopTrack();
      setPlayingAudioId(null);
    } else {
      soundEngine.setMuted(false);
      soundEngine.playTrack(audio.trackType);
      setPlayingAudioId(audio.id);
      onShowToast(`Playing preview: "${audio.title}"`);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 text-black font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/25">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-slate-200 to-neutral-400 text-black font-black text-xs flex items-center justify-center shadow-md shadow-neutral-400/20">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-700 to-orange-400 text-white font-black text-xs flex items-center justify-center shadow-md shadow-orange-500/20">
          3
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-400 font-bold text-xs flex items-center justify-center border border-neutral-700/60">
        {rank}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-pink-600/25">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Trends Dashboard</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                  Live Real Stats
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Real-time user views &amp; engagement across <span className="text-pink-400 font-semibold">Jatt VibeReels</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.stopTrack();
              onClose();
            }}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="Close trends dashboard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search + Tab Switcher + Timeframe */}
        <div className="px-5 sm:px-6 py-3 border-b border-neutral-800/70 bg-neutral-900/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-bold overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Trends
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reels')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'reels'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Trending Reels</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hashtags')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'hashtags'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Hashtags</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sounds')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'sounds'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Sounds</span>
            </button>
          </div>

          {/* Search + Timeframe */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trends, tags, audio..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
              />
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex bg-neutral-950 p-0.5 rounded-xl border border-neutral-800 text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setTimeframe('today')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeframe === 'today' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('week')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  timeframe === 'week' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 no-scrollbar space-y-6">
          {/* TAB: ALL (Overview Grid) */}
          {activeTab === 'all' && (
            <div className="space-y-6">
              {/* Highlight Real Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">#1 Trending Reel</span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm font-bold text-white truncate">
                    {rankedVideos[0]?.title || 'No reels uploaded yet'}
                  </p>
                  <p className="text-[10px] text-pink-400 font-semibold mt-0.5">
                    {rankedVideos[0]
                      ? `${rankedVideos[0].stats.views.toLocaleString()} Views · ${rankedVideos[0].stats.likes.toLocaleString()} Likes`
                      : '0 Views · 0 Likes'}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Top Hashtag</span>
                    <Hash className="w-4 h-4 text-pink-400" />
                  </div>
                  <p className="text-sm font-bold text-white truncate">
                    {realTrendingHashtags[0] ? `#${realTrendingHashtags[0].tag}` : 'None yet'}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    {realTrendingHashtags[0]
                      ? `${realTrendingHashtags[0].reelsCount} reels · ${realTrendingHashtags[0].views} views`
                      : 'Post a reel to trend'}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Top Audio Track</span>
                    <Music className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-sm font-bold text-white truncate">
                    {realTrendingAudios[0]?.title || 'No audio used yet'}
                  </p>
                  <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                    {realTrendingAudios[0] ? realTrendingAudios[0].usesCount : '0 reels created'}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Total Real Views</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-sm font-bold text-white">
                    {totalRealPlatformViews.toLocaleString()} Views
                  </p>
                  <p className="text-[10px] text-purple-400 font-semibold mt-0.5">
                    {videos.length} {videos.length === 1 ? 'reel' : 'reels'} active
                  </p>
                </div>
              </div>

              {/* 2-Column Split: Top Reels on Left, Top Tags & Sounds on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Top 4 Trending Short Reels */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Top Trending Reels</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reels')}
                      className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1"
                    >
                      <span>View All</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {rankedVideos.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-center text-xs text-neutral-400">
                      No real reels uploaded yet. Post your first reel to see live stats here!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rankedVideos.slice(0, 4).map((video, idx) => (
                        <div
                          key={video.id}
                          className="p-3 bg-neutral-950/60 hover:bg-neutral-800/50 rounded-2xl border border-neutral-800/80 transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {getRankBadge(idx + 1)}
                            <img
                              src={optimizeThumbnailUrl(video.creator.avatar, 'grid')}
                              alt={video.creator.name}
                              loading="lazy"
                              decoding="async"
                              className="w-9 h-9 rounded-xl object-cover bg-neutral-800 shrink-0 border border-neutral-700/60"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                                {video.title}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                                <span>@{video.creator.username}</span>
                                <span>·</span>
                                <span className="text-neutral-300 font-semibold flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-neutral-500" />
                                  {formatRealViews(video.stats.views)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const originalIdx = videos.findIndex((v) => v.id === video.id);
                              onSelectReel(originalIdx >= 0 ? originalIdx : 0);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm active:scale-95 transition-all"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>Watch</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Viral Hashtags + Popular Sounds */}
                <div className="space-y-6">
                  {/* Hashtags Mini */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Hash className="w-4 h-4 text-pink-400" />
                        <span>Active Hashtags</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('hashtags')}
                        className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1"
                      >
                        <span>View All</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {realTrendingHashtags.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400">
                        Hashtags from real uploaded reels will rank here automatically.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {realTrendingHashtags.slice(0, 6).map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => {
                              onSelectHashtag(item.tag);
                              onClose();
                            }}
                            className="p-2.5 bg-neutral-950/60 hover:bg-neutral-800/80 rounded-xl border border-neutral-800 text-left transition-all hover:border-pink-500/50 flex items-center gap-2 group"
                          >
                            <div className="w-6 h-6 rounded-lg bg-pink-500/15 text-pink-400 flex items-center justify-center text-xs font-bold">
                              #{item.rank}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors">
                                #{item.tag}
                              </p>
                              <p className="text-[10px] text-neutral-400 font-medium">
                                {item.views} views · {item.reelsCount} reels
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Popular Audio Mini */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Music className="w-4 h-4 text-cyan-400" />
                        <span>Active Sounds</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sounds')}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                      >
                        <span>View All</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {realTrendingAudios.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400">
                        Sounds used in real user reels will appear here.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {realTrendingAudios.slice(0, 3).map((audio) => (
                          <div
                            key={audio.id}
                            className="p-2.5 bg-neutral-950/60 rounded-xl border border-neutral-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleAudio(audio)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  playingAudioId === audio.id
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-neutral-800 text-white hover:bg-neutral-700'
                                }`}
                              >
                                {playingAudioId === audio.id ? (
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{audio.title}</p>
                                <p className="text-[10px] text-neutral-400 truncate">
                                  {audio.artist} · {audio.usesCount}
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md font-semibold border border-cyan-500/20 shrink-0">
                              {audio.duration}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRENDING REELS */}
          {activeTab === 'reels' && (
            <div className="space-y-3">
              {filteredVideos.length === 0 ? (
                <div className="p-8 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-center text-xs text-neutral-400">
                  No matching reels found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredVideos.map((video, idx) => (
                    <div
                      key={video.id}
                      className="p-3.5 bg-neutral-950/60 hover:bg-neutral-800/40 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3 transition-colors group cv-auto-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getRankBadge(idx + 1)}
                        <img
                          src={optimizeThumbnailUrl(video.creator.avatar, 'grid')}
                          alt={video.creator.name}
                          loading="lazy"
                          decoding="async"
                          className="w-11 h-11 rounded-xl object-cover bg-neutral-800 shrink-0 border border-neutral-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                            {video.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            @{video.creator.username} · {video.creator.name}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400">
                            <span className="flex items-center gap-1 text-pink-400 font-semibold">
                              <Heart className="w-3 h-3 fill-pink-500/40" />
                              {video.stats.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {video.stats.comments.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <Eye className="w-3 h-3" />
                              {formatRealViews(video.stats.views)} views
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const originalIdx = videos.findIndex((v) => v.id === video.id);
                          onSelectReel(originalIdx >= 0 ? originalIdx : 0);
                          onClose();
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-md shadow-pink-600/20 active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Watch</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: HASHTAGS */}
          {activeTab === 'hashtags' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredHashtags.map((h) => (
                <div
                  key={h.tag}
                  onClick={() => {
                    onSelectHashtag(h.tag);
                    onClose();
                  }}
                  className="p-4 bg-neutral-950/60 hover:bg-neutral-800/60 rounded-2xl border border-neutral-800 cursor-pointer transition-all hover:border-pink-500/50 flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between mb-2">
                    {getRankBadge(h.rank)}
                    {h.isBreakout && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        Top Tag
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white group-hover:text-pink-400 transition-colors">
                      #{h.tag}
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      {h.views} Total Views · {h.reelsCount.toLocaleString()} Videos
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold">{h.growth}</span>
                    <span className="text-pink-400 group-hover:translate-x-0.5 transition-transform font-semibold text-[11px] flex items-center gap-0.5">
                      View reels →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: POPULAR SOUNDS */}
          {activeTab === 'sounds' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAudios.map((audio) => (
                  <div
                    key={audio.id}
                    className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {getRankBadge(audio.rank)}
                      <button
                        type="button"
                        onClick={() => handleToggleAudio(audio)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
                          playingAudioId === audio.id
                            ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-black shadow-cyan-500/25'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        }`}
                        title={playingAudioId === audio.id ? 'Pause sound' : 'Preview sound'}
                      >
                        {playingAudioId === audio.id ? (
                          <Pause className="w-5 h-5 fill-current animate-pulse" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{audio.title}</p>
                          {playingAudioId === audio.id && (
                            <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          Artist: {audio.artist}
                        </p>
                        <p className="text-[10px] text-cyan-400 font-semibold mt-1">
                          Used in {audio.usesCount}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-neutral-400 font-mono tabular-nums">
                        {audio.duration}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onShowToast(`Sound "${audio.title}" ready for your next reel!`);
                        }}
                        className="text-[11px] text-pink-400 hover:text-pink-300 font-semibold hover:underline"
                      >
                        Use Sound
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
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
  Share2,
  Sparkles,
  ArrowUpRight,
  Search,
  Volume2,
} from 'lucide-react';
import { VideoPost, TrendingHashtag, TrendingAudio } from '../types';
import { TRENDING_HASHTAGS, TRENDING_AUDIOS } from '../data/mockTrends';
import { soundEngine } from '../utils/soundEngine';

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

  if (!isOpen) return null;

  // Ranked videos sorted by likes/engagement
  const rankedVideos = [...videos].sort((a, b) => b.stats.likes - a.stats.likes);

  // Filtered lists based on search
  const filteredVideos = rankedVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.hashtags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHashtags = TRENDING_HASHTAGS.filter((h) =>
    h.tag.toLowerCase().includes(searchQuery.toLowerCase().replace(/^#/, ''))
  );

  const filteredAudios = TRENDING_AUDIOS.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatViews = (likes: number) => {
    const estimatedViews = likes * 4.2;
    if (estimatedViews >= 1_000_000) {
      return (estimatedViews / 1_000_000).toFixed(1) + 'M';
    }
    return (estimatedViews / 1_000).toFixed(0) + 'K';
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
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
                  Live Radar
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                What&apos;s exploding on <span className="text-pink-400 font-semibold">Jatt VibeReels</span> right now
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
              <span>Viral Hashtags</span>
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
              <span>Popular Sounds</span>
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
              {/* Highlight Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">#1 Trending Reel</span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm font-bold text-white truncate">{rankedVideos[0]?.title}</p>
                  <p className="text-[10px] text-pink-400 font-semibold mt-0.5">
                    {rankedVideos[0]?.stats.likes.toLocaleString()} Likes · 99% Viral Score
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Breakout Hashtag</span>
                    <Hash className="w-4 h-4 text-pink-400" />
                  </div>
                  <p className="text-sm font-bold text-white">#jattvibes</p>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">+142% Velocity Today</p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Top Audio Track</span>
                    <Music className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-sm font-bold text-white truncate">{TRENDING_AUDIOS[0]?.title}</p>
                  <p className="text-[10px] text-cyan-400 font-semibold mt-0.5">215.4K Reels Created</p>
                </div>

                <div className="p-3.5 bg-neutral-950/60 rounded-2xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-[11px] font-semibold">Platform Volume</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-sm font-bold text-white">24.8M Views</p>
                  <p className="text-[10px] text-purple-400 font-semibold mt-0.5">+18% vs Yesterday</p>
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

                  <div className="space-y-2">
                    {rankedVideos.slice(0, 4).map((video, idx) => (
                      <div
                        key={video.id}
                        className="p-3 bg-neutral-950/60 hover:bg-neutral-800/50 rounded-2xl border border-neutral-800/80 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getRankBadge(idx + 1)}
                          <img
                            src={video.creator.avatar}
                            alt={video.creator.name}
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
                                {formatViews(video.stats.likes)}
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
                </div>

                {/* Right: Viral Hashtags + Popular Sounds */}
                <div className="space-y-6">
                  {/* Viral Hashtags Mini */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Hash className="w-4 h-4 text-pink-400" />
                        <span>Viral Hashtags</span>
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

                    <div className="flex flex-wrap gap-2">
                      {TRENDING_HASHTAGS.slice(0, 6).map((item) => (
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
                              {item.views} views · {item.growth}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Popular Audio Mini */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Music className="w-4 h-4 text-cyan-400" />
                        <span>Trending Sounds</span>
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

                    <div className="space-y-2">
                      {TRENDING_AUDIOS.slice(0, 3).map((audio) => (
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRENDING REELS */}
          {activeTab === 'reels' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredVideos.map((video, idx) => (
                  <div
                    key={video.id}
                    className="p-3.5 bg-neutral-950/60 hover:bg-neutral-800/40 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getRankBadge(idx + 1)}
                      <img
                        src={video.creator.avatar}
                        alt={video.creator.name}
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
                            {formatViews(video.stats.likes)} views
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
            </div>
          )}

          {/* TAB: VIRAL HASHTAGS */}
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
                        Breakout
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

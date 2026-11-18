import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Users,
  CheckCircle2,
  Eye,
  Heart,
  Video,
  UserPlus,
  Check,
  Sparkles,
  ArrowRight,
  Music,
  Play,
  Pause,
  Film,
} from 'lucide-react';
import {
  AudioTrackOption,
  CreatorChannelSummary,
  CreatorProfileData,
  VideoPost,
} from '../types';
import { advancedSearchAll } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { soundEngine } from '../utils/soundEngine';
import { sanitizeSearchQuery } from '../utils/security';

interface CreatorDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoPost[];
  ownProfile: CreatorProfileData;
  onSelectCreator: (username: string) => void;
  onPlayVideo?: (videoId: string) => void;
  onFollowToggle: (username: string) => void;
  onShowToast: (msg: string) => void;
}

type SearchCategoryTab = 'all' | 'users' | 'videos' | 'songs';

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const CreatorDirectoryModal: React.FC<CreatorDirectoryModalProps> = ({
  isOpen,
  onClose,
  videos,
  ownProfile,
  onSelectCreator,
  onPlayVideo,
  onFollowToggle,
  onShowToast,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchCategoryTab>('all');
  const [creators, setCreators] = useState<CreatorChannelSummary[]>([]);
  const [matchedPosts, setMatchedPosts] = useState<VideoPost[]>([]);
  const [matchedSongs, setMatchedSongs] = useState<AudioTrackOption[]>([]);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopPreviewTrack();
      setPreviewTrackId(null);
      return;
    }
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => {
      window.clearTimeout(focusTimer);
      soundEngine.stopPreviewTrack();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await advancedSearchAll(query, videos, ownProfile);
        if (!cancelled) {
          setCreators(res.creators);
          setMatchedPosts(res.posts);
          setMatchedSongs(res.audioTracks);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, query ? 150 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, query, videos, ownProfile]);

  if (!isOpen) return null;

  const showCreators = activeTab === 'all' || activeTab === 'users';
  const showPosts = activeTab === 'all' || activeTab === 'videos';
  const showSongs = activeTab === 'all' || activeTab === 'songs';

  const visibleCreators = showCreators ? (activeTab === 'all' ? creators.slice(0, 5) : creators) : [];
  const visiblePosts = showPosts ? (activeTab === 'all' ? matchedPosts.slice(0, 6) : matchedPosts) : [];
  const visibleSongs = showSongs ? (activeTab === 'all' ? matchedSongs.slice(0, 6) : matchedSongs) : [];

  const totalVisibleCount = visibleCreators.length + visiblePosts.length + visibleSongs.length;

  const handleToggleSongPreview = (track: AudioTrackOption) => {
    if (previewTrackId === track.id) {
      soundEngine.stopPreviewTrack();
      setPreviewTrackId(null);
    } else {
      soundEngine.playPreviewTrack(track.trackType, 0.85);
      setPreviewTrackId(track.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] [transform:translateZ(0)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                Advanced Search
              </h2>
              <p className="text-[11px] text-neutral-400">
                Search users, exact @IDs, videos, photos, songs &amp; naats
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
            aria-label="Close advanced search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input + Filter Tabs */}
        <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(sanitizeSearchQuery(e.target.value, 120))}
              placeholder="Search @username, user ID, video title, #hashtag, or song..."
              className="w-full bg-neutral-900 text-sm text-white placeholder-neutral-500 pl-10 pr-10 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/40 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
            {(
              [
                { id: 'all', label: `All (${creators.length + matchedPosts.length + matchedSongs.length})` },
                { id: 'users', label: `Users & IDs (${creators.length})` },
                { id: 'videos', label: `Videos & Photos (${matchedPosts.length})` },
                { id: 'songs', label: `Songs & Naats (${matchedSongs.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categorized Search Results */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-5">
          {isSearching && totalVisibleCount === 0 ? (
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-full bg-neutral-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-36 bg-neutral-800 rounded" />
                    <div className="h-3 w-24 bg-neutral-800/70 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : totalVisibleCount === 0 ? (
            <div className="py-12 text-center space-y-2.5">
              <Sparkles className="w-9 h-9 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-neutral-300">
                No results matched &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-neutral-500">
                Try another @username, user ID, video caption, or song title.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Users & @IDs */}
              {visibleCreators.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Users &amp; Channel IDs</span>
                    </h3>
                    {activeTab === 'all' && creators.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="text-[11px] font-bold text-pink-400 hover:text-pink-300 cursor-pointer"
                      >
                        See all ({creators.length})
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {visibleCreators.map((channel) => {
                      const isOwn =
                        channel.id === ownProfile.id ||
                        channel.username.toLowerCase() === ownProfile.username.toLowerCase();

                      return (
                        <div
                          key={channel.username}
                          onClick={() => {
                            onSelectCreator(channel.username);
                            onClose();
                          }}
                          className="group p-3 rounded-2xl bg-neutral-900/85 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 transition-all flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shrink-0">
                              <img
                                src={optimizeThumbnailUrl(channel.avatar, 'grid')}
                                alt={channel.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full rounded-full object-cover bg-neutral-950"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-pink-400 transition-colors">
                                  {channel.name}
                                </h4>
                                {channel.isVerified && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                )}
                                {isOwn && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-pink-500/20 text-pink-300 text-[9px] font-black uppercase border border-pink-500/30">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-cyan-400 truncate">
                                @{channel.username}
                              </p>

                              <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-neutral-400 tabular-nums">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-pink-400" />
                                  <strong className="text-neutral-200">{formatCompact(channel.followersCount)}</strong>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3 h-3 text-rose-400" />
                                  <strong className="text-neutral-200">{formatCompact(channel.totalLikes)}</strong>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Video className="w-3 h-3 text-purple-400" />
                                  <strong className="text-neutral-200">{channel.videosCount}</strong> Reels
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isOwn && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFollowToggle(channel.username);
                                  onShowToast(
                                    channel.isFollowing
                                      ? `Unfollowed @${channel.username}`
                                      : `Followed @${channel.username}`
                                  );
                                }}
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                  channel.isFollowing
                                    ? 'bg-neutral-800 text-emerald-300 border-emerald-500/40'
                                    : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white border-pink-400/40'
                                }`}
                              >
                                {channel.isFollowing ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                                <span className="hidden sm:inline">
                                  {channel.isFollowing ? 'Following' : 'Follow'}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCreator(channel.username);
                                onClose();
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 group-hover:bg-pink-600 text-neutral-200 group-hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>Profile</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 2. Videos & Photos */}
              {visiblePosts.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5" />
                      <span>Videos &amp; Photo Reels</span>
                    </h3>
                    {activeTab === 'all' && matchedPosts.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('videos')}
                        className="text-[11px] font-bold text-pink-400 hover:text-pink-300 cursor-pointer"
                      >
                        See all ({matchedPosts.length})
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visiblePosts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onPlayVideo?.(post.id);
                        }}
                        className="p-2.5 rounded-2xl bg-neutral-900/85 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-black border border-neutral-800 shrink-0">
                          {post.mediaType === 'image' || post.posterUrl ? (
                            <img
                              src={optimizeThumbnailUrl(
                                post.mediaType === 'image' ? post.videoUrl : post.posterUrl,
                                'grid'
                              )}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={post.videoUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-pink-300">
                            {post.title}
                          </p>
                          <p className="text-[11px] text-cyan-400 truncate">
                            @{post.creator.username}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 tabular-nums">
                            <span className="flex items-center gap-0.5">
                              <Eye className="w-3 h-3 text-cyan-400" />
                              {formatCompact(post.stats.views)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Heart className="w-3 h-3 text-rose-400" />
                              {formatCompact(post.stats.likes)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Songs, Naats & Audio Tracks */}
              {visibleSongs.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5" />
                      <span>Songs, Naats &amp; Beats</span>
                    </h3>
                    {activeTab === 'all' && matchedSongs.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('songs')}
                        className="text-[11px] font-bold text-pink-400 hover:text-pink-300 cursor-pointer"
                      >
                        See all ({matchedSongs.length})
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {visibleSongs.map((track) => {
                      const isPlaying = previewTrackId === track.id;
                      const linkedPost = videos.find(
                        (v) =>
                          v.sound.title.toLowerCase() === track.title.toLowerCase() ||
                          v.sound.trackType === track.trackType
                      );

                      return (
                        <div
                          key={track.id}
                          className="p-2.5 rounded-2xl bg-neutral-900/85 border border-neutral-800 flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleSongPreview(track)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                isPlaying
                                  ? 'bg-pink-600 text-white'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-pink-300'
                              }`}
                              title={isPlaying ? 'Stop preview' : 'Play preview'}
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4 translate-x-0.2" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white truncate">
                                  {track.title}
                                </p>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${
                                    track.category === 'naat'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : track.category === 'song'
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'bg-purple-500/20 text-purple-300'
                                  }`}
                                >
                                  {track.category}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {track.artist} · {track.mood}
                              </p>
                            </div>
                          </div>

                          {linkedPost && onPlayVideo && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onPlayVideo(linkedPost.id);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-pink-600 text-neutral-200 hover:text-white text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                            >
                              Watch Reel
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

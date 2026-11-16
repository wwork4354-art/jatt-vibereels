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
} from 'lucide-react';
import { CreatorChannelSummary, CreatorProfileData, VideoPost } from '../types';
import { searchCreatorsDirectory } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

interface CreatorDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoPost[];
  ownProfile: CreatorProfileData;
  onSelectCreator: (username: string) => void;
  onFollowToggle: (username: string) => void;
  onShowToast: (msg: string) => void;
}

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
  onFollowToggle,
  onShowToast,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CreatorChannelSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const list = await searchCreatorsDirectory(query, videos, ownProfile);
        if (!cancelled) {
          setResults(list);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, query ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, query, videos, ownProfile]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh] [transform:translateZ(0)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                Find Creators &amp; Channels
              </h2>
              <p className="text-[11px] text-neutral-400">
                Search any creator by name or @username to view their public channel
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
            aria-label="Close creator search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators by name or @username (e.g. @jatt_official)..."
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
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-2.5">
          {isSearching && results.length === 0 ? (
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
                  <div className="h-8 w-20 bg-neutral-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center space-y-2.5">
              <Sparkles className="w-9 h-9 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-neutral-300">
                No creators matched &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-neutral-500">
                Try another name or @username handle.
              </p>
            </div>
          ) : (
            results.map((channel) => {
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
                  className="group p-3.5 rounded-2xl bg-neutral-900/85 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 transition-all flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shrink-0">
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
                        <h3 className="text-sm font-black text-white truncate group-hover:text-pink-400 transition-colors">
                          {channel.name}
                        </h3>
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

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-neutral-400 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-pink-400" />
                          <strong className="text-neutral-200">{formatCompact(channel.followersCount)}</strong> Followers
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-400" />
                          <strong className="text-neutral-200">{formatCompact(channel.totalLikes)}</strong> Likes
                        </span>
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3 text-purple-400" />
                          <strong className="text-neutral-200">{channel.videosCount}</strong> Reels
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <Eye className="w-3 h-3 text-cyan-400" />
                          <strong className="text-neutral-200">{formatCompact(channel.profileViews)}</strong> Views
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                          channel.isFollowing
                            ? 'bg-neutral-800 hover:bg-neutral-700 text-emerald-300 border-emerald-500/40'
                            : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white border-pink-400/40 shadow-md shadow-pink-600/20'
                        }`}
                      >
                        {channel.isFollowing ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCreator(channel.username);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 group-hover:bg-pink-600 text-neutral-200 group-hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

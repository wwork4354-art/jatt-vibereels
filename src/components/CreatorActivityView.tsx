import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Check,
  Copy,
  Database,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ActivityEvent,
  CreatorProfileData,
  InteractionType,
  VideoPost,
} from '../types';
import {
  formatExactTimestamp,
  formatRelativeTime,
  getSchemaSyncStatus,
  SUPABASE_SCHEMA_SQL,
} from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

interface CreatorActivityPanelProps {
  events: ActivityEvent[];
  videos: VideoPost[];
  profile: CreatorProfileData;
  onPlayVideo: (videoId: string) => void;
  onMarkAllRead?: () => void;
  embedded?: boolean;
  onBackToFeed?: () => void;
  onShowToast: (msg: string) => void;
}

type FilterType = 'all' | 'like' | 'comment' | 'save' | 'download';

function formatCompactCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const ActivityTypeBadge: React.FC<{ type: InteractionType }> = ({ type }) => {
  switch (type) {
    case 'like':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
          <Heart className="w-3 h-3 fill-rose-400" />
          Liked
        </span>
      );
    case 'comment':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
          <MessageCircle className="w-3 h-3" />
          Commented
        </span>
      );
    case 'save':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
          <Bookmark className="w-3 h-3 fill-amber-400" />
          Saved
        </span>
      );
    case 'download':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
          <Download className="w-3 h-3" />
          Downloaded
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
          <Eye className="w-3 h-3" />
          Viewed
        </span>
      );
  }
};

export const CreatorActivityView: React.FC<CreatorActivityPanelProps> = ({
  events,
  videos,
  profile,
  onPlayVideo,
  onMarkAllRead,
  embedded = false,
  onBackToFeed,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [scope, setScope] = useState<'my_posts' | 'all'>('all');
  const [selectedPostForInsights, setSelectedPostForInsights] = useState<VideoPost | null>(null);
  const [showSchemaSql, setShowSchemaSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const schemaStatus = getSchemaSyncStatus();
  const hasMissingOptionalTables =
    schemaStatus.isSupabaseConfigured &&
    (!schemaStatus.interactionsTableAvailable ||
      !schemaStatus.commentsTableAvailable ||
      !schemaStatus.postsHasViews);

  const myPosts = useMemo(
    () =>
      videos.filter(
        (v) =>
          v.userId === profile.id ||
          v.isUserUploaded ||
          v.creator.username.toLowerCase() === profile.username.toLowerCase()
      ),
    [videos, profile.id, profile.username]
  );

  const myPostIds = useMemo(() => new Set(myPosts.map((p) => p.id)), [myPosts]);

  // Aggregate KPI totals across creator's uploaded posts
  const myTotals = useMemo(() => {
    return myPosts.reduce(
      (acc, v) => ({
        views: acc.views + (v.stats.views || 0),
        likes: acc.likes + (v.stats.likes || 0),
        comments: acc.comments + (v.stats.comments || 0),
        saves: acc.saves + (v.stats.saves || 0),
        downloads: acc.downloads + (v.stats.downloads || 0),
      }),
      { views: 0, likes: 0, comments: 0, saves: 0, downloads: 0 }
    );
  }, [myPosts]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterType !== 'all' && ev.type !== filterType) return false;
      if (scope === 'my_posts') {
        const belongsToMe =
          myPostIds.has(ev.postId) ||
          ev.postOwnerId === profile.id ||
          (ev.postOwnerUsername &&
            ev.postOwnerUsername.toLowerCase() === profile.username.toLowerCase());
        if (!belongsToMe) return false;
      }
      return true;
    });
  }, [events, filterType, scope, myPostIds, profile.id, profile.username]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      onShowToast('Supabase SQL schema copied!');
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      onShowToast('Copy from the SQL box below.');
    }
  };

  const content = (
    <div className="space-y-5">
      {/* Creator Totals Dashboard Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pink-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
              My Creator Post Insights ({myPosts.length} {myPosts.length === 1 ? 'post' : 'posts'})
            </h3>
          </div>
          {onMarkAllRead && events.length > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
          <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col items-center text-center">
            <Eye className="w-4 h-4 text-purple-400 mb-1" />
            <span className="text-sm sm:text-base font-black text-white tabular-nums">
              {formatCompactCount(myTotals.views)}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">Views</span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col items-center text-center">
            <Heart className="w-4 h-4 text-rose-400 mb-1" />
            <span className="text-sm sm:text-base font-black text-white tabular-nums">
              {formatCompactCount(myTotals.likes)}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">Likes</span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col items-center text-center">
            <MessageCircle className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-sm sm:text-base font-black text-white tabular-nums">
              {formatCompactCount(myTotals.comments)}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">Comments</span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col items-center text-center">
            <Bookmark className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-sm sm:text-base font-black text-white tabular-nums">
              {formatCompactCount(myTotals.saves)}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">Saves</span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col items-center text-center">
            <Download className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-sm sm:text-base font-black text-white tabular-nums">
              {formatCompactCount(myTotals.downloads)}
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">Downloads</span>
          </div>
        </div>
      </div>

      {/* Per-Post Analytics Strip (if user has uploaded posts) */}
      {myPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Post-by-Post Performance (Tap for full insights)
          </p>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {myPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPostForInsights(post)}
                className="shrink-0 w-56 p-2.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 flex items-center gap-2.5 text-left transition-all cursor-pointer"
              >
                <div className="w-12 h-16 rounded-xl overflow-hidden bg-neutral-800 shrink-0 relative">
                  {post.mediaType === 'image' || post.posterUrl ? (
                    <img
                      src={optimizeThumbnailUrl(
                        post.mediaType === 'image' ? post.videoUrl : post.posterUrl,
                        'grid'
                      )}
                      alt={post.title}
                      loading="lazy"
                      decoding="async"
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
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-bold text-white truncate">{post.title}</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-neutral-300 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-purple-400" />
                      {formatCompactCount(post.stats.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-400" />
                      {formatCompactCount(post.stats.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-amber-400" />
                      {formatCompactCount(post.stats.saves)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3 text-emerald-400" />
                      {formatCompactCount(post.stats.downloads)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional Supabase Schema Sync Helper */}
      {hasMissingOptionalTables && (
        <div className="p-3 rounded-2xl bg-neutral-900/80 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-cyan-300 font-bold">
              <Database className="w-4 h-4 shrink-0" />
              <span>Enable Cross-Device Analytics Tables in Supabase</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSchemaSql((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 cursor-pointer"
            >
              {showSchemaSql ? 'Hide SQL' : 'View SQL'}
            </button>
          </div>
          {showSchemaSql && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-neutral-400">
                Events are currently saved locally &amp; likes sync to Supabase. Run this SQL in your Supabase SQL Editor to persist comments, views, saves, downloads, and activity logs across devices:
              </p>
              <pre className="p-2.5 rounded-xl bg-black/80 border border-neutral-800 text-[10px] text-emerald-300 overflow-x-auto max-h-40 font-mono">
                {SUPABASE_SCHEMA_SQL}
              </pre>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied SQL' : 'Copy SQL Schema'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity Feed Controls */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                scope === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Activity
            </button>
            <button
              type="button"
              onClick={() => setScope('my_posts')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                scope === 'my_posts'
                  ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              My Posts ({myPosts.length})
            </button>
          </div>

          <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">
            Showing {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'like', label: 'Likes' },
              { id: 'comment', label: 'Comments' },
              { id: 'save', label: 'Saves' },
              { id: 'download', label: 'Downloads' },
            ] as { id: FilterType; label: string }[]
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilterType(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all cursor-pointer ${
                filterType === chip.id
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400/50 shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 mx-auto flex items-center justify-center text-pink-400">
            <Bell className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">No interactions recorded yet</h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            {scope === 'my_posts' && myPosts.length === 0
              ? 'Upload or record a video first, then see everyone who likes, comments, saves, or downloads your posts here.'
              : 'When anyone likes, comments on, saves, or downloads a reel, their username and timestamp appear here in real time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="p-3 rounded-2xl bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800/90 flex items-center gap-3 transition-colors cv-auto-card"
            >
              <img
                src={optimizeThumbnailUrl(ev.actorAvatar, 'grid')}
                alt={ev.actorName}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 rounded-full object-cover bg-neutral-800 border border-neutral-700 shrink-0"
                referrerPolicy="no-referrer"
              />

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">
                    {ev.actorName}
                  </span>
                  <span className="text-[11px] font-semibold text-cyan-400">
                    @{ev.actorUsername}
                  </span>
                  <ActivityTypeBadge type={ev.type} />
                </div>

                {ev.commentText && (
                  <p className="text-xs text-neutral-200 bg-neutral-950/80 px-2.5 py-1.5 rounded-lg border border-neutral-800 line-clamp-2">
                    &ldquo;{ev.commentText}&rdquo;
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                  <span className="truncate max-w-[200px]">on {ev.postTitle}</span>
                  <span>·</span>
                  <span title={formatExactTimestamp(ev.createdAt)}>
                    {formatRelativeTime(ev.createdAt)} · {formatExactTimestamp(ev.createdAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onPlayVideo(ev.postId)}
                className="w-11 h-14 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 hover:border-pink-500 shrink-0 relative group cursor-pointer"
                title="Watch post"
              >
                {ev.postThumbnail ? (
                  <img
                    src={optimizeThumbnailUrl(ev.postThumbnail, 'grid')}
                    alt={ev.postTitle}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-pink-900/60 to-purple-900/60">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedPostForInsights && (
        <PostInsightsModal
          post={selectedPostForInsights}
          events={events}
          onClose={() => setSelectedPostForInsights(null)}
          onPlayVideo={(id) => {
            setSelectedPostForInsights(null);
            onPlayVideo(id);
          }}
        />
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white overflow-y-auto no-scrollbar pb-20 lg:pb-8 [transform:translateZ(0)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 bg-neutral-950/95 border-b border-neutral-800/80 flex items-center justify-between gap-3">
        {onBackToFeed ? (
          <button
            type="button"
            onClick={onBackToFeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-pink-400" />
            <span>Feed</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-black text-white">Activity &amp; Post Insights</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Live</span>
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto px-4 pt-5">{content}</div>
    </div>
  );
};

// Focused Modal showing detailed stats + interaction list for a single post
export const PostInsightsModal: React.FC<{
  post: VideoPost;
  events: ActivityEvent[];
  onClose: () => void;
  onPlayVideo: (postId: string) => void;
}> = ({ post, events, onClose, onPlayVideo }) => {
  const postEvents = useMemo(
    () => events.filter((ev) => ev.postId === post.id),
    [events, post.id]
  );

  const totalEngagements =
    post.stats.likes + post.stats.comments + post.stats.saves + post.stats.downloads;
  const engagementRate =
    post.stats.views > 0
      ? Math.min(100, (totalEngagements / post.stats.views) * 100).toFixed(1)
      : '0.0';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <TrendingUp className="w-5 h-5 text-pink-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">Post Insights</h3>
              <p className="text-[11px] text-neutral-400 truncate">{post.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post Preview + Engagement Rate */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <button
            type="button"
            onClick={() => onPlayVideo(post.id)}
            className="w-16 h-24 rounded-xl overflow-hidden bg-black border border-neutral-700 shrink-0 relative group cursor-pointer"
          >
            {post.mediaType === 'image' || post.posterUrl ? (
              <img
                src={post.mediaType === 'image' ? post.videoUrl : post.posterUrl}
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
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-xs font-bold text-white line-clamp-2">{post.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
              <span>{post.createdAt ? formatExactTimestamp(post.createdAt) : 'Published reel'}</span>
              <span>·</span>
              <span className="text-cyan-400 font-bold">{engagementRate}% engagement</span>
            </div>
          </div>
        </div>

        {/* 5 Real-Time Metrics */}
        <div className="grid grid-cols-5 gap-1.5">
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
            <Eye className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white tabular-nums">
              {post.stats.views.toLocaleString()}
            </p>
            <p className="text-[10px] text-neutral-400">Views</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
            <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white tabular-nums">
              {post.stats.likes.toLocaleString()}
            </p>
            <p className="text-[10px] text-neutral-400">Likes</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
            <MessageCircle className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white tabular-nums">
              {post.stats.comments.toLocaleString()}
            </p>
            <p className="text-[10px] text-neutral-400">Comments</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
            <Bookmark className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white tabular-nums">
              {post.stats.saves.toLocaleString()}
            </p>
            <p className="text-[10px] text-neutral-400">Saves</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-center">
            <Download className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs font-black text-white tabular-nums">
              {post.stats.downloads.toLocaleString()}
            </p>
            <p className="text-[10px] text-neutral-400">Downloads</p>
          </div>
        </div>

        {/* Who Interacted */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-300">
            Recent Interactions ({postEvents.length})
          </h4>
          {postEvents.length === 0 ? (
            <div className="p-5 text-center rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-400">
              No tracked user activity on this post yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {postEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start gap-2.5"
                >
                  <img
                    src={ev.actorAvatar}
                    alt={ev.actorName}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{ev.actorName}</span>
                      <span className="text-[11px] text-cyan-400">@{ev.actorUsername}</span>
                      <ActivityTypeBadge type={ev.type} />
                    </div>
                    {ev.commentText && (
                      <p className="text-xs text-neutral-200 mt-1">&ldquo;{ev.commentText}&rdquo;</p>
                    )}
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      {formatRelativeTime(ev.createdAt)} · {formatExactTimestamp(ev.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

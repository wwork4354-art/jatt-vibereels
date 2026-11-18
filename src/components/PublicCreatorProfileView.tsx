import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Heart,
  Play,
  Share2,
  UserPlus,
  Check,
  Edit3,
  Video,
  Sparkles,
  Flame,
  Clock,
  Users,
  UserMinus,
} from 'lucide-react';
import { CreatorProfileData, VideoPost } from '../types';
import {
  buildCreatorChannelSummary,
  fetchPostsByUser,
  fetchUserProfileFromSupabase,
  incrementProfileViewsForUsername,
  normalizeCreatorUsername,
} from '../lib/supabaseService';
import {
  SocialEdgesMap,
  buildMergedSocialEdges,
  getFollowRelationship,
  getFollowersList,
  getFollowingList,
} from '../lib/socialGraph';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

interface PublicCreatorProfileViewProps {
  username: string;
  videos: VideoPost[];
  ownProfile: CreatorProfileData;
  socialEdges?: SocialEdgesMap;
  onBack: () => void;
  onFollowToggle: (username: string) => void;
  onRemoveFriend?: (username: string) => void;
  onPlayVideo: (videoId: string) => void;
  onEditOwnProfile: () => void;
  onShowToast: (msg: string) => void;
}

function formatCompactCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const PublicCreatorProfileView: React.FC<PublicCreatorProfileViewProps> = ({
  username,
  videos,
  ownProfile,
  socialEdges,
  onBack,
  onFollowToggle,
  onRemoveFriend,
  onPlayVideo,
  onEditOwnProfile,
  onShowToast,
}) => {
  const cleanTarget = normalizeCreatorUsername(username) || username.toLowerCase();
  const [remoteProfile, setRemoteProfile] = useState<CreatorProfileData | null>(null);
  const [extraCreatorPosts, setExtraCreatorPosts] = useState<VideoPost[]>([]);
  const [liveProfileViews, setLiveProfileViews] = useState<number | null>(null);
  const [sortTab, setSortTab] = useState<'latest' | 'popular'>('latest');
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  // Track which normalized username has already counted a visit in this open view
  const viewedChannelRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRemoteProfile(null);
    setExtraCreatorPosts([]);
    setIsLoadingRemote(true);

    const loadCreatorChannel = async () => {
      try {
        const fetchedProfile = await fetchUserProfileFromSupabase({ username: cleanTarget });
        if (cancelled) return;
        if (fetchedProfile) {
          setRemoteProfile(fetchedProfile);
        }

        const fetchedPosts = await fetchPostsByUser(
          fetchedProfile?.id || '',
          cleanTarget,
          ownProfile.id
        );
        if (!cancelled && fetchedPosts.length > 0) {
          setExtraCreatorPosts(fetchedPosts);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRemote(false);
        }
      }
    };

    void loadCreatorChannel();

    return () => {
      cancelled = true;
    };
  }, [cleanTarget, ownProfile.id]);

  // Merge in-memory videos + any fetched cloud posts for this creator
  const combinedVideos = useMemo(() => {
    const seen = new Set<string>();
    return [...videos, ...extraCreatorPosts].filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [videos, extraCreatorPosts]);

  const summary = useMemo(
    () => buildCreatorChannelSummary(cleanTarget, combinedVideos, ownProfile, remoteProfile),
    [cleanTarget, combinedVideos, ownProfile, remoteProfile]
  );

  const activeEdges = useMemo(
    () => socialEdges || buildMergedSocialEdges(ownProfile.username),
    [socialEdges, ownProfile.username]
  );
  const relationship = useMemo(
    () => getFollowRelationship(ownProfile.username, cleanTarget, activeEdges),
    [ownProfile.username, cleanTarget, activeEdges]
  );
  const targetFollowingCount = useMemo(
    () => Math.max(summary.followingCount, getFollowingList(cleanTarget, activeEdges).length),
    [summary.followingCount, cleanTarget, activeEdges]
  );
  const targetFollowersCount = useMemo(
    () => Math.max(summary.followersCount, getFollowersList(cleanTarget, activeEdges).length),
    [summary.followersCount, cleanTarget, activeEdges]
  );

  // Increment real-time Profile Views counter once per channel visit
  useEffect(() => {
    if (viewedChannelRef.current === cleanTarget) return;
    viewedChannelRef.current = cleanTarget;
    const updatedViews = incrementProfileViewsForUsername(cleanTarget, summary.profileViews);
    setLiveProfileViews(updatedViews);
  }, [cleanTarget, summary.profileViews]);

  const isOwnChannel =
    normalizeCreatorUsername(ownProfile.username) === cleanTarget ||
    summary.id === ownProfile.id;

  const creatorVideos = useMemo(() => {
    const list = combinedVideos.filter((v) => {
      const vUname = normalizeCreatorUsername(v.creator.username);
      if (isOwnChannel) {
        return vUname === cleanTarget || v.userId === ownProfile.id || Boolean(v.isUserUploaded);
      }
      return vUname === cleanTarget;
    });

    if (sortTab === 'popular') {
      return [...list].sort(
        (a, b) => (b.stats.views + b.stats.likes * 3) - (a.stats.views + a.stats.likes * 3)
      );
    }
    return list;
  }, [combinedVideos, cleanTarget, isOwnChannel, ownProfile.id, sortTab]);

  const displayedProfileViews = Math.max(
    summary.profileViews,
    liveProfileViews ?? 0
  );

  const handleShareChannel = async () => {
    const shareText = `Check out @${summary.username} (${summary.name}) on Jatt VibeReels!`;
    const shareUrl = `${window.location.origin}/?creator=${encodeURIComponent(summary.username)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${summary.name} (@${summary.username}) - Jatt VibeReels`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      onShowToast(`Copied @${summary.username} channel link!`);
    } catch {
      onShowToast(`Channel handle: @${summary.username}`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white overflow-y-auto no-scrollbar pb-20 lg:pb-8 [transform:translateZ(0)]">
      {/* Sticky Channel Header */}
      <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 bg-neutral-950/95 border-b border-neutral-800/80 flex items-center justify-between gap-2 [transform:translateZ(0)]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-pink-400" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-black text-white truncate">{summary.name}</span>
          {summary.isVerified && (
            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          )}
        </div>

        <button
          type="button"
          onClick={handleShareChannel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-neutral-800 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          title="Share Creator Channel"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Main Channel Container */}
      <div className="max-w-3xl w-full mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3.5">
          {/* Avatar Ring */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-lg shadow-pink-500/20">
            <img
              src={optimizeThumbnailUrl(summary.avatar, 'grid')}
              alt={summary.name}
              className="w-full h-full rounded-full object-cover bg-neutral-900 border-2 border-neutral-950"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Display Name & @username + Mutual Friends Badge */}
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center justify-center gap-1.5 flex-wrap">
              <span>{summary.name}</span>
              {summary.isVerified && (
                <Sparkles className="w-4 h-4 text-pink-400" />
              )}
              {!isOwnChannel && relationship.isMutualFriend && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                  <Users className="w-3 h-3" />
                  <span>Friends</span>
                </span>
              )}
            </h1>
            <p className="text-xs font-bold text-cyan-400">@{summary.username}</p>
            {!isOwnChannel && relationship.isFollower && !relationship.isMutualFriend && (
              <p className="text-[11px] font-bold text-pink-300">Follows you</p>
            )}
          </div>

          {/* TikTok-Style 4-Stat Bar: Following | Followers | Total Likes | Profile Views */}
          <div className="grid grid-cols-4 gap-2 sm:gap-6 py-3 px-4 sm:px-6 rounded-2xl bg-neutral-900/85 border border-neutral-800/90 w-full max-w-lg">
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {formatCompactCount(targetFollowingCount)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">
                Following
              </span>
            </div>

            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {formatCompactCount(targetFollowersCount)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">
                Followers
              </span>
            </div>

            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-pink-400 tabular-nums">
                {formatCompactCount(summary.totalLikes)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">
                Total Likes
              </span>
            </div>

            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-cyan-400 tabular-nums flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-cyan-400 hidden sm:inline" />
                {formatCompactCount(displayedProfileViews)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">
                Profile Views
              </span>
            </div>
          </div>

          {/* Creator Bio */}
          <p className="text-xs sm:text-sm text-neutral-300 max-w-md leading-relaxed px-2">
            {summary.bio || 'Sharing reels and music vibes on Jatt VibeReels.'}
          </p>

          {/* Follow / Friends CTA OR Edit Own Channel */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {isOwnChannel ? (
              <button
                type="button"
                onClick={onEditOwnProfile}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-pink-600/25 active:scale-95 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit My Channel</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onFollowToggle(summary.username)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 border transition-all active:scale-95 cursor-pointer ${
                    relationship.isMutualFriend
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border-cyan-400/60'
                      : relationship.isFollowing || summary.isFollowing
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-emerald-300 border-emerald-500/45'
                      : 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white border-pink-400/40 shadow-lg shadow-pink-600/30'
                  }`}
                >
                  {relationship.isMutualFriend ? (
                    <>
                      <Users className="w-4 h-4 text-cyan-300" />
                      <span>Friends · Unfollow</span>
                    </>
                  ) : relationship.isFollowing || summary.isFollowing ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Following</span>
                    </>
                  ) : relationship.isFollower ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Follow Back</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Follow Channel</span>
                    </>
                  )}
                </button>

                {relationship.isMutualFriend && onRemoveFriend && (
                  <button
                    type="button"
                    onClick={() => onRemoveFriend(summary.username)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="Remove mutual friendship"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Remove Friend</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleShareChannel}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Share Channel</span>
            </button>
          </div>
        </div>

        {/* Videos Sort Tabs */}
        <div className="border-b border-neutral-800 flex items-center">
          <button
            type="button"
            onClick={() => setSortTab('latest')}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              sortTab === 'latest'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Reels &amp; Videos ({creatorVideos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSortTab('popular')}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              sortTab === 'popular'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Most Popular</span>
          </button>
        </div>

        {/* Creator Videos Grid */}
        {isLoadingRemote && creatorVideos.length === 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-[9/16] rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : creatorVideos.length === 0 ? (
          <div className="py-14 px-4 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 space-y-2.5">
            <Video className="w-10 h-10 text-neutral-600 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-200">
              No reels uploaded yet
            </h3>
            <p className="text-xs text-neutral-500">
              @{summary.username} hasn&apos;t posted any reels or videos yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 [transform:translateZ(0)]">
            {creatorVideos.map((vid) => (
              <button
                key={vid.id}
                type="button"
                onClick={() => onPlayVideo(vid.id)}
                className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-pink-500/60 transition-all text-left cursor-pointer cv-auto-card [transform:translateZ(0)]"
              >
                {vid.mediaType === 'image' || vid.posterUrl ? (
                  <img
                    src={optimizeThumbnailUrl(
                      vid.mediaType === 'image' ? vid.videoUrl : vid.posterUrl,
                      'grid'
                    )}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <video
                    src={vid.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent pointer-events-none" />

                {vid.mediaType === 'image' && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-cyan-600/90 text-[9px] font-black text-white uppercase">
                    Photo
                  </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white shrink-0 tabular-nums">
                    <Eye className="w-3 h-3 text-cyan-300" />
                    {formatCompactCount(vid.stats.views)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-white shrink-0 tabular-nums">
                    <Heart
                      className={`w-3 h-3 ${
                        vid.isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'
                      }`}
                    />
                    {formatCompactCount(vid.stats.likes)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

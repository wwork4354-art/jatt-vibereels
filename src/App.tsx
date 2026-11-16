import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Sparkles,
  Music,
  Compass,
  Camera,
  Upload,
  Film,
} from 'lucide-react';
import { INITIAL_VIDEOS } from './data/mockVideos';
import {
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
} from './data/mockUsers';
import {
  VideoPost,
  FeedTab,
  UserAccount,
  UserRole,
  UserStatus,
  CreatorProfileData,
  ActivityEvent,
  CommentItem,
  LiveStoryItem,
  DirectSnapMessage,
  DirectSnapRecipient,
} from './types';
import { VideoCard } from './components/VideoCard';
import { LiveStoriesBar } from './components/LiveStoriesBar';
import { SidebarDesktop } from './components/SidebarDesktop';
import { MobileNavigation } from './components/MobileNavigation';
import { TopBar } from './components/TopBar';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { soundEngine } from './utils/soundEngine';
import { compressImageFile } from './utils/imageOptimize';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  isStoryActive,
  getStoredLiveStories,
  fetchActiveLiveStories,
  markLiveStoryViewed,
  deleteLiveStoryById,
  getStoredDirectSnaps,
  fetchDirectSnaps,
  sendDirectSnap,
  markDirectSnapViewed,
  fetchDirectSendRecipients,
  subscribeToLiveSnapsRealtime,
} from './lib/liveSnapService';
import {
  getAllOfflineSavedPosts,
  hydratePostWithOfflineRecord,
  savePostForOffline,
} from './lib/offlineMediaStore';
import { loadPlaybackState, savePlaybackState } from './lib/playbackPersistence';

// Lazy-load offscreen tabs and modals so initial page load is fast
const CommentsDrawer = lazy(() =>
  import('./components/CommentsDrawer').then((m) => ({ default: m.CommentsDrawer }))
);
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal }))
);
const UploadModal = lazy(() =>
  import('./components/UploadModal').then((m) => ({ default: m.UploadModal }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);
const TrendsDashboard = lazy(() =>
  import('./components/TrendsDashboard').then((m) => ({ default: m.TrendsDashboard }))
);
const LiveStreamModal = lazy(() =>
  import('./components/LiveStreamModal').then((m) => ({ default: m.LiveStreamModal }))
);
const LiveStreamMainView = lazy(() =>
  import('./components/LiveStreamMainView').then((m) => ({ default: m.LiveStreamMainView }))
);
const DownloadHub = lazy(() =>
  import('./components/DownloadHub').then((m) => ({ default: m.DownloadHub }))
);
const ProCameraModal = lazy(() =>
  import('./components/ProCameraModal').then((m) => ({ default: m.ProCameraModal }))
);
const CreatorProfileView = lazy(() =>
  import('./components/CreatorProfileView').then((m) => ({ default: m.CreatorProfileView }))
);
const CreatorActivityView = lazy(() =>
  import('./components/CreatorActivityView').then((m) => ({ default: m.CreatorActivityView }))
);
const CreatorDirectoryModal = lazy(() =>
  import('./components/CreatorDirectoryModal').then((m) => ({ default: m.CreatorDirectoryModal }))
);
const PublicCreatorProfileView = lazy(() =>
  import('./components/PublicCreatorProfileView').then((m) => ({ default: m.PublicCreatorProfileView }))
);
const DirectSnapsModal = lazy(() =>
  import('./components/DirectSnapsModal').then((m) => ({ default: m.DirectSnapsModal }))
);

const LazyTabFallback = () => (
  <div className="w-full h-full bg-neutral-950 p-4 sm:p-6 flex flex-col gap-4 overflow-hidden">
    <div className="flex items-center justify-between gap-3">
      <div className="h-9 w-44 rounded-xl bg-neutral-900 animate-pulse" />
      <div className="h-9 w-28 rounded-xl bg-neutral-900 animate-pulse" />
    </div>
    <div className="h-11 w-full rounded-xl bg-neutral-900 animate-pulse" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-neutral-900/90 border border-neutral-800/80 p-4 space-y-3 animate-pulse"
        >
          <div className="w-full aspect-video rounded-xl bg-neutral-800/80" />
          <div className="h-4 w-3/4 rounded-md bg-neutral-800" />
          <div className="h-3 w-1/2 rounded-md bg-neutral-800/70" />
        </div>
      ))}
    </div>
  </div>
);
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  USER_PROFILE_ID_KEY,
  SupabasePostRow,
  SupabaseCommentRow,
  SupabaseInteractionRow,
  getOrCreateUserProfileId,
  getStoredLikedPostIds,
  saveStoredLikedPostIds,
  getStoredSavedPostIds,
  saveStoredSavedPostIds,
  getStoredFollowedUsernames,
  saveStoredFollowedUsernames,
  getStoredLocalPosts,
  saveLocalPostRecord,
  getStoredPostMetrics,
  getStoredPostComments,
  savePostCommentsForPost,
  getPostAudioMeta,
  getStoredActivityEvents,
  getActivityLastReadAt,
  setActivityLastReadAt,
  fileToPersistentDataUrl,
  fetchGlobalPosts,
  fetchPostsByUser,
  fetchUserProfileFromSupabase,
  fetchCommentsFromSupabase,
  fetchActivityEventsFromSupabase,
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  updatePostMetricsInSupabase,
  createCommentInSupabase,
  recordActivityEventInSupabase,
  upsertUserProfileInSupabase,
  mapSupabaseRowToVideoPost,
  mapSupabaseCommentRow,
  mapSupabaseInteractionRow,
  adjustCreatorFollowerDelta,
  normalizeCreatorUsername,
  GLOBAL_FEED_CACHE_KEY,
  deletePostEverywhere,
} from './lib/supabaseService';

const CREATOR_PROFILE_STORAGE_KEY = 'jatt_creator_profile';

function getCachedGlobalFeedPosts(): VideoPost[] {
  try {
    const raw = localStorage.getItem(GLOBAL_FEED_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => p && typeof p.videoUrl === 'string' && !p.videoUrl.startsWith('blob:'));
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function saveCachedGlobalFeedPosts(posts: VideoPost[]): void {
  try {
    const cacheable = posts
      .filter((p) => p.isSupabasePost && p.videoUrl && !p.videoUrl.startsWith('blob:') && !p.videoUrl.startsWith('data:'))
      .slice(0, 40);
    localStorage.setItem(GLOBAL_FEED_CACHE_KEY, JSON.stringify(cacheable));
  } catch {
    // ignore quota errors
  }
}

const getInitialCreatorProfile = (user: UserAccount | null): CreatorProfileData => {
  const profileId = getOrCreateUserProfileId();

  try {
    const raw = localStorage.getItem(CREATOR_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.username === 'string') {
        const resolvedId = typeof parsed.id === 'string' && parsed.id ? parsed.id : profileId;
        localStorage.setItem(USER_PROFILE_ID_KEY, resolvedId);
        return {
          id: resolvedId,
          name: parsed.name,
          username: parsed.username,
          bio: parsed.bio || '',
          avatar: parsed.avatar || 'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
          baseFollowers:
            typeof parsed.baseFollowers === 'number' && parsed.baseFollowers !== 12400
              ? parsed.baseFollowers
              : 0,
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  return {
    id: profileId,
    name: user?.name || 'Jatt Creator',
    username: user?.username || 'jatt_official',
    bio: user?.bio || 'Creating neon vibes & Punjabi reels on Jatt VibeReels.',
    avatar: user?.avatar || 'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
    baseFollowers: 0,
  };
};

function mergeCommentsLists(baseList: CommentItem[], extraList: CommentItem[]): CommentItem[] {
  if (!extraList || extraList.length === 0) return baseList;
  const seen = new Set(baseList.map((c) => c.id));
  const merged = [...baseList];
  for (const item of extraList) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.unshift(item);
    }
  }
  return merged;
}

function hydrateVideosFromStorage(
  baseList: VideoPost[],
  currentUserId: string,
  currentUsername: string
): VideoPost[] {
  const likedIds = getStoredLikedPostIds();
  const savedIds = getStoredSavedPostIds();
  const followedUsernames = getStoredFollowedUsernames();
  const localPosts = getStoredLocalPosts();
  const metricsMap = getStoredPostMetrics();
  const commentsMap = getStoredPostComments();

  const seenIds = new Set<string>();
  const combined = [...localPosts, ...baseList].filter((v) => {
    if (seenIds.has(v.id)) return false;
    seenIds.add(v.id);
    return true;
  });

  return combined.map((v) => {
    const m = metricsMap[v.id];
    const extraComments = commentsMap[v.id] || [];
    const mergedComments = mergeCommentsLists(v.commentsList || [], extraComments);
    const isMine =
      v.userId === currentUserId ||
      Boolean(v.isUserUploaded) ||
      v.creator.username.toLowerCase() === currentUsername.toLowerCase();

    const savedSound = getPostAudioMeta(v.id, v.videoUrl);

    return {
      ...v,
      isUserUploaded: isMine,
      sound: savedSound || v.sound,
      isLiked: likedIds.has(v.id) ? true : v.isLiked && m?.likes === undefined ? v.isLiked : likedIds.has(v.id),
      isSaved: savedIds.has(v.id) ? true : v.isSaved && m?.saves === undefined ? v.isSaved : savedIds.has(v.id),
      creator: {
        ...v.creator,
        isFollowing: followedUsernames.has(v.creator.username) || v.creator.isFollowing,
      },
      commentsList: mergedComments,
      stats: {
        views: m?.views !== undefined ? Math.max(v.stats.views, m.views) : v.stats.views,
        likes: m?.likes !== undefined ? m.likes : v.stats.likes,
        comments: Math.max(
          m?.comments !== undefined ? m.comments : v.stats.comments,
          mergedComments.length
        ),
        shares: m?.shares !== undefined ? Math.max(v.stats.shares, m.shares) : v.stats.shares,
        saves: m?.saves !== undefined ? m.saves : v.stats.saves,
        downloads:
          m?.downloads !== undefined ? Math.max(v.stats.downloads, m.downloads) : v.stats.downloads,
      },
    };
  });
}

function filterFeedVideos(
  list: VideoPost[],
  tab: FeedTab,
  selectedTag: string | null
): VideoPost[] {
  if (
    tab === 'live' ||
    tab === 'downloads' ||
    tab === 'profile' ||
    tab === 'activity' ||
    tab === 'channel'
  ) {
    return [];
  }
  const filtered = list.filter((v) => {
    if (selectedTag) {
      return v.hashtags.includes(selectedTag);
    }
    if (tab === 'saved') {
      return v.isSaved;
    }
    if (tab === 'following') {
      return v.creator.isFollowing;
    }
    return true;
  });

  if (tab === 'trending') {
    return [...filtered].sort(
      (a, b) =>
        b.stats.views + b.stats.likes * 3 - (a.stats.views + a.stats.likes * 3)
    );
  }
  return filtered;
}

export default function App() {
  const [users, setUsers] = useState<UserAccount[]>(getStoredUsers);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getStoredCurrentUser);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData>(() =>
    getInitialCreatorProfile(getStoredCurrentUser())
  );
  const [videos, setVideos] = useState<VideoPost[]>(() => {
    const initialProf = getInitialCreatorProfile(getStoredCurrentUser());
    const cachedCloud = getCachedGlobalFeedPosts();
    const seen = new Set<string>();
    const combinedBase = [...cachedCloud, ...INITIAL_VIDEOS].filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    return hydrateVideosFromStorage(combinedBase, initialProf.id, initialProf.username);
  });
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(getStoredActivityEvents);
  const [lastReadActivityAt, setLastReadActivityAt] = useState<string>(getActivityLastReadAt);

  const [savedInitialPlayback] = useState(() => loadPlaybackState());
  const [currentTab, setCurrentTab] = useState<FeedTab>(() => {
    if (!savedInitialPlayback) return 'foryou';
    if (savedInitialPlayback.activeTab === 'channel' && !savedInitialPlayback.selectedChannelUsername) {
      return 'foryou';
    }
    return savedInitialPlayback.activeTab;
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(
    () => savedInitialPlayback?.selectedTag ?? null
  );
  const [selectedChannelUsername, setSelectedChannelUsername] = useState<string | null>(
    () => savedInitialPlayback?.selectedChannelUsername ?? null
  );
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (!savedInitialPlayback?.videoId) return 0;
    const restoredTab: FeedTab =
      savedInitialPlayback.activeTab === 'channel' && !savedInitialPlayback.selectedChannelUsername
        ? 'foryou'
        : savedInitialPlayback.activeTab;
    const filtered = filterFeedVideos(
      videos,
      restoredTab,
      savedInitialPlayback.selectedTag ?? null
    );
    const matchedIndex = filtered.findIndex((v) => v.id === savedInitialPlayback.videoId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  });
  const [isMuted, setIsMuted] = useState(true);

  // Modals state
  const [commentsVideo, setCommentsVideo] = useState<VideoPost | null>(null);
  const [shareVideo, setShareVideo] = useState<VideoPost | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [preselectedUploadFile, setPreselectedUploadFile] = useState<File | null>(null);
  const [isProCameraOpen, setIsProCameraOpen] = useState(false);
  const [isTrendsOpen, setIsTrendsOpen] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isCreatorSearchOpen, setIsCreatorSearchOpen] = useState(false);
  const [liveStories, setLiveStories] = useState<LiveStoryItem[]>(getStoredLiveStories);
  const [directSnaps, setDirectSnaps] = useState<DirectSnapMessage[]>(getStoredDirectSnaps);
  const [directRecipients, setDirectRecipients] = useState<DirectSnapRecipient[]>([]);
  const [isDirectSnapsOpen, setIsDirectSnapsOpen] = useState(false);
  const [isStoriesBarOpen, setIsStoriesBarOpen] = useState(false);
  const [storiesDragOffsetPx, setStoriesDragOffsetPx] = useState<number | null>(null);
  const [snapReplyTarget, setSnapReplyTarget] = useState<DirectSnapRecipient | null>(null);
  const [profileInitialSubTab, setProfileInitialSubTab] = useState<
    'videos' | 'saved' | 'liked' | 'activity' | undefined
  >(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastFeedScrollTopRef = useRef<number>(0);
  const storiesSwipeRef = useRef<{
    active: boolean;
    startY: number;
    startX: number;
    fromTopZone: boolean;
    atFeedTop: boolean;
    wasOpen: boolean;
    engaged: boolean;
    lastDeltaY: number;
  } | null>(null);
  const videosRef = useRef<VideoPost[]>(videos);
  const expectedVideoIdRef = useRef<string>(savedInitialPlayback?.videoId || '');
  const needsScrollSyncRef = useRef<boolean>(activeIndex > 0);
  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    if (currentTab !== 'foryou' && currentTab !== 'following') {
      setIsStoriesBarOpen(false);
      setStoriesDragOffsetPx(null);
    }
  }, [currentTab]);

  // Sync users to localStorage
  const updateUsers = useCallback((newUsers: UserAccount[]) => {
    setUsers(newUsers);
    saveStoredUsers(newUsers);
  }, []);

  // Sync current user to localStorage
  const updateCurrentUser = useCallback((user: UserAccount | null) => {
    setCurrentUser(user);
    saveStoredCurrentUser(user);
  }, []);

  // Show brief toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  // Load global posts, user's own posts, comments & activity from Supabase + listen for real-time changes
  useEffect(() => {
    let isCancelled = false;

    const loadCloudData = async () => {
      const [globalPosts, myCloudPosts, cloudProfile, commentsMap, cloudEvents] =
        await Promise.all([
          fetchGlobalPosts(creatorProfile.id, creatorProfile.username),
          fetchPostsByUser(creatorProfile.id, creatorProfile.username, creatorProfile.id),
          fetchUserProfileFromSupabase({ id: creatorProfile.id }),
          fetchCommentsFromSupabase(),
          fetchActivityEventsFromSupabase(),
        ]);

      if (isCancelled) return;

      if (cloudProfile && cloudProfile.id === creatorProfile.id) {
        setCreatorProfile((prev) => ({
          ...prev,
          name: cloudProfile.name || prev.name,
          username: cloudProfile.username || prev.username,
          bio: cloudProfile.bio || prev.bio,
          avatar: cloudProfile.avatar || prev.avatar,
        }));
      }

      if (cloudEvents.length > 0) {
        setActivityEvents(cloudEvents);
      }

      const combinedCloud = [...myCloudPosts, ...globalPosts];
      if (combinedCloud.length > 0) {
        saveCachedGlobalFeedPosts(combinedCloud);
      }
      if (combinedCloud.length > 0 || Object.keys(commentsMap).length > 0) {
        setVideos((prev) => {
          const cloudMap = new Map<string, VideoPost>();
          for (const p of combinedCloud) {
            if (!cloudMap.has(p.id)) cloudMap.set(p.id, p);
          }
          const mergedRemote = Array.from(cloudMap.values()).map((p) => {
            const cList = mergeCommentsLists(p.commentsList, commentsMap[p.id] || []);
            return {
              ...p,
              commentsList: cList,
              stats: {
                ...p.stats,
                comments: Math.max(p.stats.comments, cList.length),
              },
            };
          });
          const remaining = prev
            .filter((v) => !cloudMap.has(v.id))
            .map((v) => {
              const cList = mergeCommentsLists(v.commentsList, commentsMap[v.id] || []);
              return {
                ...v,
                commentsList: cList,
                stats: {
                  ...v.stats,
                  comments: Math.max(v.stats.comments, cList.length),
                },
              };
            });
          return [...mergedRemote, ...remaining];
        });
      }
    };

    // Hydrate locally cached offline videos/audio blobs from IndexedDB on startup / offline mode
    const hydrateFromOfflineDB = async () => {
      const offlineRecords = await getAllOfflineSavedPosts();
      if (isCancelled || offlineRecords.length === 0) return;
      const offlineMap = new Map(offlineRecords.map((r) => [r.id, r]));

      setVideos((prev) => {
        const updated = prev.map((v) => {
          const rec = offlineMap.get(v.id);
          if (!rec) return v;
          if (!isOnline || !v.videoUrl || v.videoUrl.startsWith('blob:')) {
            return hydratePostWithOfflineRecord(v, rec);
          }
          return v;
        });
        const existingIds = new Set(updated.map((v) => v.id));
        const missingOfflinePosts = offlineRecords
          .filter((rec) => !existingIds.has(rec.id))
          .map((rec) => hydratePostWithOfflineRecord(rec.post, rec));
        return missingOfflinePosts.length > 0 ? [...missingOfflinePosts, ...updated] : updated;
      });
    };

    void hydrateFromOfflineDB();
    if (isOnline) {
      void loadCloudData();
    }

    // Idle-preload heavy tab/modal chunks so tab switches are instant
    const preloadChunks = () => {
      void import('./components/DownloadHub');
      void import('./components/CreatorProfileView');
      void import('./components/TrendsDashboard');
      void import('./components/CreatorActivityView');
      void import('./components/ProCameraModal');
      void import('./components/CreatorDirectoryModal');
      void import('./components/PublicCreatorProfileView');
      void import('./components/DirectSnapsModal');
    };
    const idleWin = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId =
      typeof idleWin.requestIdleCallback === 'function'
        ? idleWin.requestIdleCallback(preloadChunks, { timeout: 1500 })
        : window.setTimeout(preloadChunks, 350);

    if (!supabase || !isSupabaseConfigured) {
      return () => {
        isCancelled = true;
      };
    }

    const client = supabase;
    const channel = client
      .channel('global-posts-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const row = payload.new as SupabasePostRow;
            if (!row?.media_url) return;
            const likedIds = getStoredLikedPostIds();
            const savedIds = getStoredSavedPostIds();
            const followedUsernames = getStoredFollowedUsernames();
            const mapped = mapSupabaseRowToVideoPost(
              row,
              likedIds,
              creatorProfile.id,
              savedIds,
              followedUsernames,
              creatorProfile.username
            );
            setVideos((prev) => {
              if (prev.some((v) => v.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const row = payload.new as SupabasePostRow;
            const rowId = String(row.id);
            setVideos((prev) =>
              prev.map((v) =>
                v.id === rowId
                  ? {
                      ...v,
                      description: row.caption || v.description,
                      stats: {
                        ...v.stats,
                        views:
                          typeof row.views_count === 'number'
                            ? Math.max(v.stats.views, row.views_count)
                            : v.stats.views,
                        likes:
                          typeof row.likes_count === 'number'
                            ? Math.max(0, row.likes_count)
                            : v.stats.likes,
                        comments:
                          typeof row.comments_count === 'number'
                            ? Math.max(v.stats.comments, row.comments_count)
                            : v.stats.comments,
                        saves:
                          typeof row.saves_count === 'number'
                            ? Math.max(0, row.saves_count)
                            : v.stats.saves,
                        downloads:
                          typeof row.downloads_count === 'number'
                            ? Math.max(v.stats.downloads, row.downloads_count)
                            : v.stats.downloads,
                      },
                    }
                  : v
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments' },
        (payload) => {
          if (!payload.new) return;
          const row = payload.new as SupabaseCommentRow;
          const postId = String(row.post_id);
          const mappedComment = mapSupabaseCommentRow(row);
          setVideos((prev) =>
            prev.map((v) => {
              if (v.id !== postId) return v;
              if (v.commentsList.some((c) => c.id === mappedComment.id)) return v;
              const nextList = [mappedComment, ...v.commentsList];
              savePostCommentsForPost(postId, nextList);
              return {
                ...v,
                commentsList: nextList,
                stats: { ...v.stats, comments: Math.max(v.stats.comments + 1, nextList.length) },
              };
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_interactions' },
        (payload) => {
          if (!payload.new) return;
          const row = payload.new as SupabaseInteractionRow;
          const mappedEvent = mapSupabaseInteractionRow(row);
          setActivityEvents((prev) => {
            if (prev.some((ev) => ev.id === mappedEvent.id)) return prev;
            return [mappedEvent, ...prev].slice(0, 200);
          });
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      if (typeof idleWin.cancelIdleCallback === 'function') {
        idleWin.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      client.removeChannel(channel);
    };
  }, [creatorProfile.id, creatorProfile.username, isOnline]);

  // Load & sync 24-hour Live Stories + Direct Snaps + Direct Send friend recipients
  useEffect(() => {
    let cancelled = false;

    const loadSnapsAndStories = async () => {
      const [stories, snaps, recipients] = await Promise.all([
        fetchActiveLiveStories(),
        fetchDirectSnaps(),
        fetchDirectSendRecipients(videosRef.current, creatorProfile, users),
      ]);
      if (cancelled) return;
      setLiveStories(stories);
      setDirectSnaps(snaps);
      setDirectRecipients(recipients);
    };

    void loadSnapsAndStories();

    const unsubscribeRealtime = subscribeToLiveSnapsRealtime({
      onNewStory: (story) => {
        setLiveStories((prev) => [story, ...prev.filter((s) => s.id !== story.id)]);
      },
      onNewDirectSnap: (snap) => {
        setDirectSnaps((prev) => [snap, ...prev.filter((m) => m.id !== snap.id)]);
        const ownClean = normalizeCreatorUsername(creatorProfile.username);
        if (
          snap.recipientId === creatorProfile.id ||
          (ownClean && normalizeCreatorUsername(snap.recipientUsername) === ownClean)
        ) {
          showToast(`New Live Snap from @${snap.senderUsername}!`);
        }
      },
    });

    const expiryPruner = window.setInterval(() => {
      const now = Date.now();
      setLiveStories((prev) => prev.filter((s) => isStoryActive(s, now)));
    }, 60_000);

    return () => {
      cancelled = true;
      unsubscribeRealtime();
      window.clearInterval(expiryPruner);
    };
  }, [creatorProfile, users, showToast]);

  // Update creator profile and persist to localStorage + Supabase
  const handleUpdateCreatorProfile = useCallback(
    (updated: CreatorProfileData) => {
      setCreatorProfile(updated);
      try {
        localStorage.setItem(USER_PROFILE_ID_KEY, updated.id);
        localStorage.setItem(CREATOR_PROFILE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }

      void upsertUserProfileInSupabase(updated);

      if (currentUser) {
        const updatedCurrentUser: UserAccount = {
          ...currentUser,
          name: updated.name,
          username: updated.username,
          bio: updated.bio,
          avatar: updated.avatar,
        };
        updateCurrentUser(updatedCurrentUser);
        const updatedUsers = users.map((u) =>
          u.id === currentUser.id ? updatedCurrentUser : u
        );
        updateUsers(updatedUsers);
      }

      setVideos((prev) =>
        prev.map((v) =>
          v.userId === updated.id ||
          v.isUserUploaded ||
          v.creator.username.toLowerCase() === updated.username.toLowerCase()
            ? {
                ...v,
                isUserUploaded: true,
                creator: {
                  ...v.creator,
                  name: updated.name,
                  username: updated.username,
                  avatar: updated.avatar,
                  bio: updated.bio,
                },
              }
            : v
        )
      );
    },
    [currentUser, users, updateCurrentUser, updateUsers]
  );

  // Cross-device Profile & Posts Sync by @username
  const handleSyncProfileByUsername = useCallback(
    async (rawUsername: string): Promise<boolean> => {
      const clean = rawUsername.trim().replace(/^@+/, '').toLowerCase();
      if (!clean) return false;

      const foundProfile = await fetchUserProfileFromSupabase({ username: clean });
      if (!foundProfile) {
        showToast(`No cloud profile found for @${clean} yet.`);
        return false;
      }

      setCreatorProfile(foundProfile);
      try {
        localStorage.setItem(USER_PROFILE_ID_KEY, foundProfile.id);
        localStorage.setItem(CREATOR_PROFILE_STORAGE_KEY, JSON.stringify(foundProfile));
      } catch {
        // ignore
      }

      const cloudUserPosts = await fetchPostsByUser(
        foundProfile.id,
        foundProfile.username,
        foundProfile.id
      );
      if (cloudUserPosts.length > 0) {
        setVideos((prev) => {
          const map = new Map(cloudUserPosts.map((p) => [p.id, p]));
          const rest = prev.filter((v) => !map.has(v.id));
          return [...cloudUserPosts, ...rest];
        });
      }

      showToast(
        `Synced @${foundProfile.username} (${cloudUserPosts.length} ${
          cloudUserPosts.length === 1 ? 'post' : 'posts'
        } loaded)!`
      );
      return true;
    },
    [showToast]
  );

  // Filter videos based on current tab and selected tag (memoized for 60fps scroll & instant tab switching)
  const displayedVideos = useMemo(
    () => filterFeedVideos(videos, currentTab, selectedTag),
    [videos, currentTab, selectedTag]
  );

  // Keep currently watched video aligned if cloud/offline hydration prepends new posts
  useEffect(() => {
    if (displayedVideos.length === 0) return;

    if (!expectedVideoIdRef.current) {
      expectedVideoIdRef.current =
        displayedVideos[activeIndex]?.id || displayedVideos[0]?.id || '';
      return;
    }

    const currentAtIdx = displayedVideos[activeIndex];
    if (currentAtIdx?.id === expectedVideoIdRef.current) {
      return;
    }

    const targetIdx = displayedVideos.findIndex((v) => v.id === expectedVideoIdRef.current);
    if (targetIdx >= 0) {
      needsScrollSyncRef.current = true;
      setActiveIndex(targetIdx);
    } else {
      expectedVideoIdRef.current =
        displayedVideos[activeIndex]?.id || displayedVideos[0]?.id || '';
    }
  }, [displayedVideos, activeIndex]);

  // Snap scroll position cleanly to restored video index on mount or return to feed
  useEffect(() => {
    if (!needsScrollSyncRef.current) return;
    const el = containerRef.current;
    if (!el || el.clientHeight <= 0 || displayedVideos.length === 0) return;

    needsScrollSyncRef.current = false;
    const safeIdx = Math.max(0, Math.min(displayedVideos.length - 1, activeIndex));
    el.scrollTop = safeIdx * el.clientHeight;
  }, [activeIndex, displayedVideos.length, currentTab]);

  // Switch dynamically to TikTok Live Stream view
  const handleOpenLive = useCallback(() => {
    setSelectedTag(null);
    setCurrentTab('live');
    showToast('Switched to TikTok-style LIVE Stream');
  }, [showToast]);

  // Switch dynamically to All-in-One Download Hub
  const handleOpenDownloads = useCallback(() => {
    setSelectedTag(null);
    setCurrentTab('downloads');
    showToast('Opened All-in-One Download Hub');
  }, [showToast]);

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number) => {
      if (!containerRef.current) return;
      const targetIndex = Math.max(0, Math.min(displayedVideos.length - 1, index));
      expectedVideoIdRef.current = displayedVideos[targetIndex]?.id || '';
      const targetY = targetIndex * containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: targetY,
        behavior: 'smooth',
      });
      setActiveIndex(targetIndex);
    },
    [displayedVideos]
  );

  // Track active index on scroll & auto-hide Live Stories bar when scrolling down
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight === 0) return;

    if (scrollTop > lastFeedScrollTopRef.current + 6) {
      setIsStoriesBarOpen((prev) => (prev ? false : prev));
    }
    lastFeedScrollTopRef.current = scrollTop;

    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < displayedVideos.length) {
      expectedVideoIdRef.current = displayedVideos[newIndex]?.id || '';
      setActiveIndex(newIndex);
    }
  }, [activeIndex, displayedVideos]);

  // Smooth touch + desktop mouse/wheel swipe gestures for collapsible Live Stories Bar
  const beginStoriesSwipe = useCallback(
    (clientY: number, clientX: number) => {
      if (currentTab !== 'foryou' && currentTab !== 'following') return;
      const stageRect = stageRef.current?.getBoundingClientRect();
      const fromTopZone = stageRect ? clientY - stageRect.top <= 145 : false;
      const atFeedTop = (containerRef.current?.scrollTop || 0) <= 6;
      if (!isStoriesBarOpen && !fromTopZone && !atFeedTop) return;

      storiesSwipeRef.current = {
        active: true,
        startY: clientY,
        startX: clientX,
        fromTopZone,
        atFeedTop,
        wasOpen: isStoriesBarOpen,
        engaged: false,
        lastDeltaY: 0,
      };
    },
    [currentTab, isStoriesBarOpen]
  );

  const moveStoriesSwipe = useCallback((clientY: number, clientX: number) => {
    const swipe = storiesSwipeRef.current;
    if (!swipe || !swipe.active) return;

    const dy = clientY - swipe.startY;
    const dx = clientX - swipe.startX;
    if (!swipe.engaged && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      storiesSwipeRef.current = null;
      setStoriesDragOffsetPx(null);
      return;
    }

    if (!swipe.wasOpen) {
      // Swipe DOWN from top area (or from top of feed) to pull Live Stories bar down
      if (dy > 10 && (swipe.fromTopZone || swipe.atFeedTop)) {
        swipe.engaged = true;
        const clamped = Math.min(112, dy);
        swipe.lastDeltaY = clamped;
        setStoriesDragOffsetPx(clamped);
      }
    } else {
      // Swipe UP while Live Stories bar is open to slide it back up & hide
      if (dy < -10) {
        swipe.engaged = true;
        const clamped = Math.max(-112, dy);
        swipe.lastDeltaY = clamped;
        setStoriesDragOffsetPx(clamped);
      }
    }
  }, []);

  const endStoriesSwipe = useCallback(() => {
    const swipe = storiesSwipeRef.current;
    if (!swipe) return;
    storiesSwipeRef.current = null;
    setStoriesDragOffsetPx(null);

    if (!swipe.engaged) return;

    if (!swipe.wasOpen) {
      if (swipe.lastDeltaY >= 34) {
        setIsStoriesBarOpen(true);
      }
    } else if (swipe.lastDeltaY <= -26) {
      setIsStoriesBarOpen(false);
    }
  }, []);

  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (!storiesSwipeRef.current?.active) return;
      moveStoriesSwipe(e.clientY, e.clientX);
    };
    const onWinMouseUp = () => {
      if (!storiesSwipeRef.current?.active) return;
      endStoriesSwipe();
    };
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [moveStoriesSwipe, endStoriesSwipe]);

  // Helper to get active actor info for activity logging & comments
  const getActiveActor = useCallback(
    () => ({
      actorId: currentUser?.id || creatorProfile.id,
      actorName: currentUser?.name || creatorProfile.name,
      actorUsername: currentUser?.username || creatorProfile.username,
      actorAvatar: currentUser?.avatar || creatorProfile.avatar,
    }),
    [currentUser, creatorProfile]
  );

  // Log engagement event to activity feed + Supabase
  const logActivity = useCallback(
    (
      targetVideo: VideoPost,
      type: ActivityEvent['type'],
      commentText?: string
    ) => {
      const actor = getActiveActor();
      void recordActivityEventInSupabase({
        postId: targetVideo.id,
        postTitle: targetVideo.title,
        postThumbnail:
          targetVideo.mediaType === 'image'
            ? targetVideo.videoUrl
            : targetVideo.posterUrl,
        postMediaType: targetVideo.mediaType,
        postOwnerId: targetVideo.userId,
        postOwnerUsername: targetVideo.creator.username,
        ...actor,
        type,
        commentText,
      }).then((created) => {
        setActivityEvents((prev) => [created, ...prev.filter((e) => e.id !== created.id)].slice(0, 200));
      });
    },
    [getActiveActor]
  );

  // Mark notifications/activity read
  const handleMarkActivityRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadActivityAt(now);
    setActivityLastReadAt(now);
  }, []);

  // Like toggle (persists liked post IDs locally + updates likes_count globally in Supabase + logs activity)
  const handleLikeToggle = useCallback(
    (id: string) => {
      const targetVideo = videos.find((v) => v.id === id);
      if (!targetVideo) return;

      const willLike = !targetVideo.isLiked;
      const nextLikes = Math.max(
        0,
        willLike ? targetVideo.stats.likes + 1 : targetVideo.stats.likes - 1
      );

      const likedIds = getStoredLikedPostIds();
      if (willLike) {
        likedIds.add(id);
      } else {
        likedIds.delete(id);
      }
      saveStoredLikedPostIds(likedIds);

      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                isLiked: willLike,
                stats: {
                  ...v.stats,
                  likes: nextLikes,
                },
              }
            : v
        )
      );

      void updatePostMetricsInSupabase(
        id,
        { likes: nextLikes },
        targetVideo.isSupabasePost
      );

      if (willLike) {
        logActivity(targetVideo, 'like');
      }
    },
    [videos, logActivity]
  );

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => {
          const next = !prev;
          soundEngine.setMuted(next);
          showToast(next ? 'Muted' : 'Audio Unmuted');
          return next;
        });
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const curVid = displayedVideos[activeIndex];
        if (curVid) {
          handleLikeToggle(curVid.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, displayedVideos, scrollToIndex, showToast, handleLikeToggle]);

  // Stable mute handler for VideoCard memoization
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Save/Bookmark toggle (persisted + logged)
  const handleSaveToggle = useCallback(
    (id: string) => {
      const targetVideo = videos.find((v) => v.id === id);
      if (!targetVideo) return;

      const willSave = !targetVideo.isSaved;
      const nextSaves = Math.max(
        0,
        willSave ? targetVideo.stats.saves + 1 : targetVideo.stats.saves - 1
      );

      const savedIds = getStoredSavedPostIds();
      if (willSave) {
        savedIds.add(id);
      } else {
        savedIds.delete(id);
      }
      saveStoredSavedPostIds(savedIds);

      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                isSaved: willSave,
                stats: {
                  ...v.stats,
                  saves: nextSaves,
                },
              }
            : v
        )
      );

      showToast(
        willSave
          ? 'Saved to Profile Saved / Downloads (Offline Ready)!'
          : 'Removed from Saved Videos'
      );
      if (willSave) {
        void savePostForOffline(targetVideo, { sourceType: 'saved' });
        logActivity(targetVideo, 'save');
      }
      if (isOnline) {
        void updatePostMetricsInSupabase(
          id,
          { saves: nextSaves },
          targetVideo.isSupabasePost
        );
      }
    },
    [videos, showToast, logActivity, isOnline]
  );

  const handleOpenSavedDownloadsOffline = useCallback(() => {
    setSelectedTag(null);
    setProfileInitialSubTab('saved');
    setCurrentTab('profile');
  }, []);

  // Track real-time views (+1 only when genuinely watched >= 3 seconds)
  const handleViewTracked = useCallback(
    (id: string) => {
      const targetVideo = videosRef.current.find((v) => v.id === id);
      if (!targetVideo) return;
      const nextViews = (targetVideo.stats.views || 0) + 1;

      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                stats: {
                  ...v.stats,
                  views: nextViews,
                },
              }
            : v
        )
      );

      void updatePostMetricsInSupabase(
        id,
        { views: nextViews },
        targetVideo.isSupabasePost
      );
    },
    []
  );

  // Track real-time downloads + log creator activity
  const handleDownloadTracked = useCallback(
    (id: string) => {
      const targetVideo = videos.find((v) => v.id === id);
      if (!targetVideo) return;
      const nextDownloads = (targetVideo.stats.downloads || 0) + 1;

      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                stats: {
                  ...v.stats,
                  downloads: nextDownloads,
                },
              }
            : v
        )
      );

      void updatePostMetricsInSupabase(
        id,
        { downloads: nextDownloads },
        targetVideo.isSupabasePost
      );
      logActivity(targetVideo, 'download');
    },
    [videos, logActivity]
  );

  // Follow toggle (persisted + updates creator follower delta)
  const handleFollowToggle = useCallback((username: string) => {
    const followed = getStoredFollowedUsernames();
    const isCurrentlyFollowing = followed.has(username);
    if (isCurrentlyFollowing) {
      followed.delete(username);
    } else {
      followed.add(username);
    }
    saveStoredFollowedUsernames(followed);
    adjustCreatorFollowerDelta(username, isCurrentlyFollowing ? -1 : 1);

    setVideos((prev) =>
      prev.map((v) => {
        if (
          v.creator.username === username ||
          normalizeCreatorUsername(v.creator.username) === normalizeCreatorUsername(username)
        ) {
          return {
            ...v,
            creator: {
              ...v.creator,
              isFollowing: !isCurrentlyFollowing,
            },
          };
        }
        return v;
      })
    );
  }, []);

  const handleOpenCreatorProfile = useCallback((username: string) => {
    const clean = normalizeCreatorUsername(username) || username.trim().replace(/^@+/, '');
    if (!clean) return;
    setIsCreatorSearchOpen(false);
    setIsTrendsOpen(false);
    setCommentsVideo(null);
    setSelectedTag(null);
    setSelectedChannelUsername(clean);
    setCurrentTab('channel');
  }, []);

  const handleOpenComments = useCallback((vid: VideoPost) => setCommentsVideo(vid), []);
  const handleOpenShare = useCallback((vid: VideoPost) => setShareVideo(vid), []);
  const handleHashtagClick = useCallback((tag: string) => setSelectedTag(tag), []);

  // Permanently delete a user's uploaded post across UI state, local cache, IndexedDB & Supabase
  const handleDeletePost = useCallback(
    async (postId: string) => {
      const target = videosRef.current.find((v) => v.id === postId);

      setVideos((prev) => prev.filter((v) => v.id !== postId));
      setActivityEvents((prev) => prev.filter((ev) => ev.postId !== postId));
      setCommentsVideo((prev) => (prev?.id === postId ? null : prev));
      setShareVideo((prev) => (prev?.id === postId ? null : prev));
      setActiveIndex((prev) => Math.max(0, prev > 0 ? prev - 1 : 0));

      await deletePostEverywhere({
        postId,
        mediaUrl: target?.videoUrl,
        audioUrl: target?.sound?.audioUrl,
        isSupabasePost: target?.isSupabasePost,
      });

      showToast('Post deleted permanently');
    },
    [showToast]
  );

  // Stable UI modal & navigation callbacks for speed / React.memo effectiveness
  const handleOpenUpload = useCallback(() => setIsUploadOpen(true), []);
  const handleOpenTrends = useCallback(() => setIsTrendsOpen(true), []);
  const handleOpenProCamera = useCallback(() => setIsProCameraOpen(true), []);
  const handleOpenAdminPanel = useCallback(() => setIsAdminPanelOpen(true), []);
  const handleOpenCreatorSearch = useCallback(() => setIsCreatorSearchOpen(true), []);
  const handleOpenAuthLogin = useCallback(() => {
    setAuthMode('login');
    setIsAuthOpen(true);
  }, []);
  const handleOpenAuthRegister = useCallback(() => {
    setAuthMode('register');
    setIsAuthOpen(true);
  }, []);
  const handleOpenProfileTab = useCallback(() => {
    setSelectedTag(null);
    setProfileInitialSubTab('videos');
    setCurrentTab('profile');
  }, []);
  const handleOpenActivityTab = useCallback(() => {
    setSelectedTag(null);
    setCurrentTab('activity');
    handleMarkActivityRead();
  }, [handleMarkActivityRead]);
  const handleBackToFeed = useCallback(() => {
    setSelectedTag(null);
    needsScrollSyncRef.current = true;
    setCurrentTab('foryou');
  }, []);

  // Add comment (real username + ISO timestamp + persistent DB/local sync + activity log)
  const handleAddComment = (text: string) => {
    if (!commentsVideo) return;
    const actor = getActiveActor();
    const nowIso = new Date().toISOString();

    const newComment: CommentItem = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user: {
        name: actor.actorName,
        username: actor.actorUsername,
        avatar: actor.actorAvatar,
        isCreator:
          currentUser?.role === 'creator' ||
          commentsVideo.userId === creatorProfile.id ||
          commentsVideo.creator.username === actor.actorUsername,
        isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
      },
      text,
      timestamp: 'Just now',
      createdAt: nowIso,
      likes: 0,
      isLiked: false,
    };

    const nextCommentsList = [newComment, ...commentsVideo.commentsList];
    const nextCommentsCount = Math.max(
      commentsVideo.stats.comments + 1,
      nextCommentsList.length
    );

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === commentsVideo.id) {
          const updatedVideo: VideoPost = {
            ...v,
            stats: { ...v.stats, comments: nextCommentsCount },
            commentsList: nextCommentsList,
          };
          setCommentsVideo(updatedVideo);
          return updatedVideo;
        }
        return v;
      })
    );

    void createCommentInSupabase({
      postId: commentsVideo.id,
      userId: actor.actorId,
      comment: newComment,
      nextCommentsList,
      isSupabasePost: commentsVideo.isSupabasePost,
    });
    logActivity(commentsVideo, 'comment', text);
  };

  // Like comment
  const handleLikeComment = (commentId: string) => {
    if (!commentsVideo) return;
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === commentsVideo.id) {
          const updatedComments = v.commentsList.map((c) => {
            if (c.id === commentId) {
              const willLike = !c.isLiked;
              return {
                ...c,
                isLiked: willLike,
                likes: willLike ? c.likes + 1 : c.likes - 1,
              };
            }
            return c;
          });
          const updatedVideo = { ...v, commentsList: updatedComments };
          setCommentsVideo(updatedVideo);
          return updatedVideo;
        }
        return v;
      })
    );
  };

  // Upload new post success
  const handleUploadSuccess = (newPost: VideoPost) => {
    expectedVideoIdRef.current = newPost.id;
    setVideos((prev) => [newPost, ...prev.filter((v) => v.id !== newPost.id)]);
    setSelectedTag(null);
    setCurrentTab('foryou');
    setActiveIndex(0);
    setIsMuted(false);
    soundEngine.setMuted(false);
    showToast(
      newPost.sound?.hasAttachedAudio
        ? `Published with "${newPost.sound.title}"!`
        : 'Published to global feed!'
    );

    // Increment video count for current user
    if (currentUser) {
      const updatedUsers = users.map((u) =>
        u.id === currentUser.id ? { ...u, videosCount: u.videosCount + 1 } : u
      );
      updateUsers(updatedUsers);
      updateCurrentUser({ ...currentUser, videosCount: currentUser.videosCount + 1 });
    }

    setTimeout(() => {
      scrollToIndex(0);
    }, 100);
  };

  // Quick Mobile Upload Handler (Gallery selection opens UploadModal with Song/Naat editor; Live Capture posts fast)
  const handleQuickGalleryUpload = useCallback(
    async (file: File, source?: 'live' | 'gallery') => {
      if (source === 'gallery') {
        setPreselectedUploadFile(file);
        setIsUploadOpen(true);
        return;
      }
      try {
        const isImage = file.type.startsWith('image/');
        const mediaType: 'video' | 'image' = isImage ? 'image' : 'video';
        const localPreviewUrl = URL.createObjectURL(file);
        const isLive = source === 'live';
        const rawName = file.name ? file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : isImage ? 'Photo' : 'Video';
        const cleanTitle = isLive
          ? `Live Video (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
          : rawName.charAt(0).toUpperCase() + rawName.slice(1);

        const captionText = isLive
          ? `${cleanTitle} 🎥 Recorded fresh with live mobile camera #liverecord #jattswag #vibereels`
          : isImage
          ? `${cleanTitle} 📸 Shared on Jatt VibeReels #photo #jattswag #vibereels`
          : `${cleanTitle} 🎬✨ Picked from device gallery #mobilegallery #jattswag #vibereels`;

        if (isSupabaseConfigured) {
          showToast(`Uploading ${isImage ? 'image' : 'video'} to global feed...`);
        }

        const uploadFile = isImage ? await compressImageFile(file, 1080, 0.8) : file;
        const uploadedUrl = await uploadMediaToReelsBucket(uploadFile, 'posts', uploadFile.name);
        let finalMediaUrl = uploadedUrl || localPreviewUrl;
        if (!uploadedUrl) {
          const persistentDataUrl = await fileToPersistentDataUrl(uploadFile);
          if (persistentDataUrl) {
            finalMediaUrl = persistentDataUrl;
          }
        }

        const authorName = currentUser?.name || creatorProfile.name;
        const authorUsername = currentUser?.username || creatorProfile.username;
        const authorAvatar = currentUser?.avatar || creatorProfile.avatar;

        const supabasePost = await createGlobalPostInSupabase({
          userId: creatorProfile.id,
          username: authorUsername,
          displayName: authorName,
          avatarUrl: authorAvatar,
          mediaUrl: finalMediaUrl,
          mediaType,
          caption: captionText,
        });

        const finalPost: VideoPost =
          supabasePost || {
            id: `reel-${isLive ? 'live' : 'gallery'}-${Date.now()}`,
            title: cleanTitle,
            description: captionText,
            hashtags: isLive
              ? ['liverecord', 'camera', 'vibereels', 'jattstyle']
              : isImage
              ? ['photo', 'vibereels', 'jattstyle', 'trending']
              : ['mobilegallery', 'vibereels', 'jattstyle', 'trending'],
            videoUrl: finalMediaUrl,
            posterUrl: isImage
              ? finalMediaUrl
              : 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
            fallbackGradient: isLive
              ? 'from-rose-900/50 via-pink-900/40 to-black'
              : 'from-pink-900/40 via-purple-900/30 to-black',
            category: 'trending',
            userId: creatorProfile.id,
            mediaType,
            isUserUploaded: true,
            createdAt: new Date().toISOString(),
            creator: {
              name: authorName,
              username: authorUsername,
              avatar: authorAvatar,
              isVerified: currentUser?.role === 'admin',
              isFollowing: false,
              bio: currentUser?.bio || creatorProfile.bio,
            },
            sound: {
              title: isLive
                ? `Live Mic Audio - ${cleanTitle.slice(0, 24)}`
                : isImage
                ? `Photo Vibe - ${cleanTitle.slice(0, 24)}`
                : `Gallery Sound - ${cleanTitle.slice(0, 24)}`,
              artist: authorName,
              trackType: 'tokyo_drift',
            },
            stats: {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,
              downloads: 0,
            },
            isLiked: false,
            isSaved: false,
            commentsList: [],
          };

        saveLocalPostRecord(finalPost);
        // 1. Prepend this new post to the top of the main feed array (deduping realtime)
        expectedVideoIdRef.current = finalPost.id;
        setVideos((prev) => [finalPost, ...prev.filter((v) => v.id !== finalPost.id)]);

        // 2. Switch to main vertical feed mode & reset tag filters
        setSelectedTag(null);
        setCurrentTab('foryou');
        setActiveIndex(0);
        setIsMuted(false);
        soundEngine.setMuted(false);

        // 3. Increment video count for current logged-in user
        if (currentUser) {
          const updatedUsers = users.map((u) =>
            u.id === currentUser.id ? { ...u, videosCount: u.videosCount + 1 } : u
          );
          updateUsers(updatedUsers);
          updateCurrentUser({ ...currentUser, videosCount: currentUser.videosCount + 1 });
        }

        // 4. Automatically scroll to top so activeIndex 0 immediately auto-plays full-screen
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: 0,
              behavior: 'smooth',
            });
          }
        }, 50);

        showToast(
          supabasePost
            ? `Published ${isImage ? 'photo' : 'video'} to global feed!`
            : isLive
            ? 'Recorded live video! Playing now in For You feed'
            : `Selected ${isImage ? 'photo' : 'video'}! Playing now in For You feed`
        );
      } catch (err) {
        console.error('Failed to process uploaded media:', err);
        showToast('Could not upload the selected media file.');
      }
    },
    [currentUser, creatorProfile, users, updateUsers, updateCurrentUser, showToast]
  );

  // User Management Handlers (Admin Panel)
  const handleUpdateUserRole = (userId: string, newRole: UserRole) => {
    const updated = users.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
    updateUsers(updated);
    if (currentUser?.id === userId) {
      updateCurrentUser({ ...currentUser, role: newRole });
    }
  };

  const handleToggleUserStatus = (userId: string) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        const nextStatus: UserStatus = u.status === 'active' ? 'suspended' : 'active';
        return { ...u, status: nextStatus };
      }
      return u;
    });
    updateUsers(updated);
  };

  const handleDeleteUser = (userId: string) => {
    const updated = users.filter((u) => u.id !== userId);
    updateUsers(updated);
  };

  const handleAddNewUser = (newUser: UserAccount) => {
    const updated = [newUser, ...users];
    updateUsers(updated);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    updateCurrentUser(user);
    void handleSyncProfileByUsername(user.username).then((synced) => {
      if (!synced) {
        const nextProfile: CreatorProfileData = {
          ...creatorProfile,
          name: user.name,
          username: user.username,
          avatar: user.avatar || creatorProfile.avatar,
          bio: user.bio || creatorProfile.bio,
        };
        handleUpdateCreatorProfile(nextProfile);
      }
    });
    showToast(`Welcome back, @${user.username}! (${user.role.toUpperCase()})`);
  };

  const handleLogout = () => {
    updateCurrentUser(null);
    showToast('You have logged out');
  };

  const savedCount = useMemo(() => videos.filter((v) => v.isSaved).length, [videos]);
  const unreadActivityCount = useMemo(() => {
    if (!lastReadActivityAt) return activityEvents.length;
    const cutoff = new Date(lastReadActivityAt).getTime();
    return activityEvents.filter((ev) => new Date(ev.createdAt).getTime() > cutoff).length;
  }, [activityEvents, lastReadActivityAt]);

  const unreadDirectSnapsCount = useMemo(() => {
    const ownClean = normalizeCreatorUsername(creatorProfile.username);
    return directSnaps.filter((snap) => {
      if (snap.isViewed) return false;
      const recipClean = normalizeCreatorUsername(snap.recipientUsername);
      const isAddressedToMe =
        snap.recipientId === creatorProfile.id ||
        (Boolean(ownClean) && recipClean === ownClean);
      return isAddressedToMe;
    }).length;
  }, [directSnaps, creatorProfile.id, creatorProfile.username]);

  const currentActiveVideo = displayedVideos[activeIndex];

  // Continuously save active tab, filters, channel & current video ID in localStorage + sessionStorage
  const latestNavSnapshotRef = useRef({
    currentTab,
    selectedTag,
    selectedChannelUsername,
    activeVideoId: currentActiveVideo?.id || expectedVideoIdRef.current || '',
  });

  useEffect(() => {
    const resolvedVideoId =
      currentActiveVideo?.id ||
      expectedVideoIdRef.current ||
      latestNavSnapshotRef.current.activeVideoId ||
      '';
    latestNavSnapshotRef.current = {
      currentTab,
      selectedTag,
      selectedChannelUsername,
      activeVideoId: resolvedVideoId,
    };
    savePlaybackState({
      activeTab: currentTab,
      selectedTag,
      selectedChannelUsername,
      ...(resolvedVideoId ? { videoId: resolvedVideoId } : {}),
    });
  }, [currentTab, selectedTag, selectedChannelUsername, currentActiveVideo?.id]);

  useEffect(() => {
    const persistSnapshot = () => {
      const snap = latestNavSnapshotRef.current;
      savePlaybackState({
        activeTab: snap.currentTab,
        selectedTag: snap.selectedTag,
        selectedChannelUsername: snap.selectedChannelUsername,
        ...(snap.activeVideoId ? { videoId: snap.activeVideoId } : {}),
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        persistSnapshot();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', persistSnapshot);
    window.addEventListener('beforeunload', persistSnapshot);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', persistSnapshot);
      window.removeEventListener('beforeunload', persistSnapshot);
    };
  }, []);

  // Real-time total likes & following count for Creator Profile (memoized)
  const { totalProfileLikes, followingCount } = useMemo(() => {
    let likesSum = 0;
    let likedOthers = 0;
    const followedSet = new Set<string>();

    for (const v of videos) {
      const isMine =
        v.userId === creatorProfile.id ||
        v.isUserUploaded ||
        v.creator.username === creatorProfile.username;

      if (isMine) {
        likesSum += v.stats.likes;
      } else if (v.isLiked) {
        likedOthers += 1;
      }

      if (v.creator.isFollowing) {
        followedSet.add(v.creator.username);
      }
    }

    return {
      totalProfileLikes: likesSum + likedOthers,
      followingCount: followedSet.size,
    };
  }, [videos, creatorProfile.id, creatorProfile.username]);

  // Play video from Creator Profile grid in full-screen vertical feed
  const handlePlayVideoFromProfile = useCallback(
    (videoId: string) => {
      expectedVideoIdRef.current = videoId;
      needsScrollSyncRef.current = true;
      const targetIdx = videos.findIndex((v) => v.id === videoId);
      setSelectedTag(null);
      setCurrentTab('foryou');
      if (targetIdx >= 0) {
        setActiveIndex(targetIdx);
        setTimeout(() => {
          if (containerRef.current) {
            const targetY = targetIdx * containerRef.current.clientHeight;
            containerRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
          }
        }, 60);
      }
    },
    [videos]
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-neutral-950 text-white overflow-hidden select-none">
      {/* Top Bar with Registration, Login, Video Upload, Go Live & Admin Panel */}
      <TopBar
        currentUser={currentUser}
        videos={videos}
        ownProfile={creatorProfile}
        onSelectCreator={handleOpenCreatorProfile}
        onPlayVideo={handlePlayVideoFromProfile}
        onOpenLogin={handleOpenAuthLogin}
        onOpenRegister={handleOpenAuthRegister}
        onOpenUpload={handleOpenUpload}
        onOpenTrends={handleOpenTrends}
        onOpenLive={handleOpenLive}
        onOpenDownloads={handleOpenDownloads}
        onOpenProCamera={handleOpenProCamera}
        onOpenAdmin={handleOpenAdminPanel}
        onOpenProfile={handleOpenProfileTab}
        onOpenCreatorSearch={handleOpenCreatorSearch}
        onOpenActivity={handleOpenActivityTab}
        unreadActivityCount={unreadActivityCount}
        onOpenDirectSnaps={() => setIsDirectSnapsOpen(true)}
        unreadDirectSnapsCount={unreadDirectSnapsCount}
        onLogout={handleLogout}
        currentTab={currentTab}
      />

      {/* Offline Mode Connectivity Banner */}
      <OfflineBanner onOpenSavedOffline={handleOpenSavedDownloadsOffline} />

      {/* Floating PWA Install App Banner (auto-hides when installed) */}
      <PWAInstallButton variant="banner" onShowToast={showToast} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-60 bg-neutral-900/95 text-white px-4 py-2 rounded-full border border-neutral-700/80 shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-150 [transform:translateZ(0)]">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Body with Sidebar + Stage */}
      <div className="flex flex-1 pt-12 sm:pt-13 h-[calc(100dvh-48px)] overflow-hidden relative">
        {/* Desktop Navigation Sidebar */}
        <SidebarDesktop
          currentTab={currentTab}
          onSelectTab={(tab) => {
            expectedVideoIdRef.current = '';
            setSelectedTag(null);
            if (tab === 'profile') setProfileInitialSubTab('videos');
            setCurrentTab(tab);
            setActiveIndex(0);
          }}
          onOpenUpload={handleOpenUpload}
          onOpenTrends={handleOpenTrends}
          onOpenCreatorSearch={handleOpenCreatorSearch}
          onOpenLive={handleOpenLive}
          onOpenProCamera={handleOpenProCamera}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          savedCount={savedCount}
          unreadActivityCount={unreadActivityCount}
          currentUser={currentUser}
          onOpenAdmin={handleOpenAdminPanel}
          onOpenLogin={handleOpenAuthLogin}
        />

        {/* Main Snap Scrolling Stage OR TikTok Live Stream View OR Download Hub */}
        <main className="flex-1 h-full flex flex-col items-center justify-center relative overflow-hidden">
          {/* Mobile Navigation Controls */}
          <MobileNavigation
            currentTab={currentTab}
            onSelectTab={(tab) => {
              expectedVideoIdRef.current = '';
              setSelectedTag(null);
              setCurrentTab(tab);
              setActiveIndex(0);
              if (tab === 'activity') {
                handleMarkActivityRead();
              }
            }}
            onOpenUpload={handleOpenUpload}
            onOpenTrends={handleOpenTrends}
            onOpenCreatorSearch={handleOpenCreatorSearch}
            videos={videos}
            ownProfile={creatorProfile}
            onSelectCreator={handleOpenCreatorProfile}
            onPlayVideo={handlePlayVideoFromProfile}
            onOpenLive={handleOpenLive}
            onOpenProCamera={handleOpenProCamera}
            onQuickVideoUpload={handleQuickGalleryUpload}
            savedCount={savedCount}
            unreadActivityCount={unreadActivityCount}
            onOpenDirectSnaps={() => setIsDirectSnapsOpen(true)}
            unreadDirectSnapsCount={unreadDirectSnapsCount}
            currentUser={currentUser}
            creatorAvatar={creatorProfile.avatar}
            onOpenLogin={handleOpenAuthLogin}
            onOpenRegister={handleOpenAuthRegister}
            onOpenAdmin={handleOpenAdminPanel}
            onLogout={handleLogout}
          />


          {currentTab === 'live' ? (
            /* DYNAMIC TIKTOK-STYLE LIVE STREAM LAYOUT IN MAIN VIEW */
            <Suspense fallback={<LazyTabFallback />}>
              <LiveStreamMainView
                currentUser={currentUser}
                onSelectTab={(tab) => {
                  expectedVideoIdRef.current = '';
                  setSelectedTag(null);
                  setCurrentTab(tab);
                  setActiveIndex(0);
                }}
                onShowToast={showToast}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
              />
            </Suspense>
          ) : currentTab === 'downloads' ? (
            /* ALL-IN-ONE DOWNLOAD HUB (SONGS, APPS, DRAMAS, MOVIES, CARTOONS, QURAN) */
            <Suspense fallback={<LazyTabFallback />}>
              <DownloadHub
                onBackToFeed={handleBackToFeed}
                onOpenSavedOffline={handleOpenSavedDownloadsOffline}
                onShowToast={showToast}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
              />
            </Suspense>
          ) : currentTab === 'profile' ? (
            /* TIKTOK-STYLE CREATOR PROFILE TAB */
            <Suspense fallback={<LazyTabFallback />}>
              <CreatorProfileView
                profile={creatorProfile}
                onUpdateProfile={handleUpdateCreatorProfile}
                onSyncProfileByUsername={handleSyncProfileByUsername}
                videos={videos}
                activityEvents={activityEvents}
                unreadActivityCount={unreadActivityCount}
                onMarkActivityRead={handleMarkActivityRead}
                totalProfileLikes={totalProfileLikes}
                followingCount={followingCount}
                initialSubTab={profileInitialSubTab}
                onPlayVideo={handlePlayVideoFromProfile}
                onDeletePost={handleDeletePost}
                onOpenUpload={handleOpenUpload}
                onOpenPublicChannel={() => handleOpenCreatorProfile(creatorProfile.username)}
                onBackToFeed={handleBackToFeed}
                onShowToast={showToast}
              />
            </Suspense>
          ) : currentTab === 'channel' && selectedChannelUsername ? (
            /* TIKTOK-STYLE PUBLIC CREATOR CHANNEL PAGE */
            <Suspense fallback={<LazyTabFallback />}>
              <PublicCreatorProfileView
                username={selectedChannelUsername}
                videos={videos}
                ownProfile={creatorProfile}
                onBack={() => {
                  setSelectedChannelUsername(null);
                  setCurrentTab('foryou');
                }}
                onFollowToggle={handleFollowToggle}
                onPlayVideo={handlePlayVideoFromProfile}
                onEditOwnProfile={() => {
                  setSelectedChannelUsername(null);
                  setCurrentTab('profile');
                }}
                onShowToast={showToast}
              />
            </Suspense>
          ) : currentTab === 'activity' ? (
            /* CREATOR NOTIFICATIONS / ACTIVITY LOG & POST INSIGHTS */
            <Suspense fallback={<LazyTabFallback />}>
              <CreatorActivityView
                events={activityEvents}
                videos={videos}
                profile={creatorProfile}
                onPlayVideo={handlePlayVideoFromProfile}
                onMarkAllRead={handleMarkActivityRead}
                onBackToFeed={() => {
                  setSelectedTag(null);
                  setCurrentTab('foryou');
                }}
                onShowToast={showToast}
              />
            </Suspense>
          ) : (
            <>
              {/* Filter bar pill if tag is selected */}
              {selectedTag && (
                <div className="absolute top-12 sm:top-11 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 px-3.5 py-1.5 rounded-full border border-pink-500/50 flex items-center gap-2 text-xs shadow-lg [transform:translateZ(0)]">

                  <span className="text-pink-400 font-bold">#{selectedTag}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-neutral-400 hover:text-white font-bold ml-1"
                  >
                    × Clear
                  </button>
                </div>
              )}

              {/* Center Snap Reel Stage with collapsible swipeable 24-Hour Live Stories overlay */}
              <div
                ref={stageRef}
                onTouchStart={(e) => {
                  if (e.touches.length === 1) {
                    beginStoriesSwipe(e.touches[0].clientY, e.touches[0].clientX);
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 1) {
                    moveStoriesSwipe(e.touches[0].clientY, e.touches[0].clientX);
                  }
                }}
                onTouchEnd={() => endStoriesSwipe()}
                onTouchCancel={() => endStoriesSwipe()}
                onMouseDown={(e) => {
                  if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input')) return;
                  beginStoriesSwipe(e.clientY, e.clientX);
                }}
                onWheel={(e) => {
                  if (currentTab !== 'foryou' && currentTab !== 'following') return;
                  if (isStoriesBarOpen && e.deltaY > 18) {
                    setIsStoriesBarOpen(false);
                  } else if (
                    !isStoriesBarOpen &&
                    e.deltaY < -35 &&
                    (containerRef.current?.scrollTop || 0) <= 6
                  ) {
                    setIsStoriesBarOpen(true);
                  }
                }}
                className="relative w-full flex-1 min-h-0 max-w-5xl mx-auto bg-black flex flex-col overflow-hidden [transform:translateZ(0)]"
              >
                {(currentTab === 'foryou' || currentTab === 'following') && (
                  <LiveStoriesBar
                    stories={liveStories}
                    currentUserId={currentUser?.id || creatorProfile.id}
                    currentUsername={currentUser?.username || creatorProfile.username}
                    currentAvatar={currentUser?.avatar || creatorProfile.avatar}
                    isExpanded={isStoriesBarOpen}
                    onExpandedChange={setIsStoriesBarOpen}
                    externalDragOffsetPx={storiesDragOffsetPx}
                    onAddStory={() => {
                      setSnapReplyTarget(null);
                      setIsProCameraOpen(true);
                    }}
                    onStoryViewed={(storyId) => {
                      const viewerId = currentUser?.id || creatorProfile.id;
                      setLiveStories((prev) =>
                        prev.map((s) =>
                          s.id === storyId
                            ? {
                                ...s,
                                viewedByIds: Array.from(
                                  new Set([...(s.viewedByIds || []), viewerId])
                                ),
                              }
                            : s
                        )
                      );
                      void markLiveStoryViewed(storyId, viewerId);
                    }}
                    onDeleteStory={(storyId) => {
                      setLiveStories((prev) => prev.filter((s) => s.id !== storyId));
                      void deleteLiveStoryById(storyId);
                      showToast('Live Story deleted');
                    }}
                    onReplyWithSnap={(recipient) => {
                      setSnapReplyTarget(recipient);
                      setIsProCameraOpen(true);
                    }}
                    onOpenDirectSnaps={() => setIsDirectSnapsOpen(true)}
                    unreadDirectSnapsCount={unreadDirectSnapsCount}
                  />
                )}

                {displayedVideos.length === 0 ? (
                  <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center p-6 text-center">
                    <Compass className="w-12 h-12 text-pink-500/80 mb-3" />
                    <h3 className="text-base font-black text-white">
                      {currentTab === 'saved'
                        ? 'No saved reels yet'
                        : currentTab === 'following'
                        ? 'No followed creators yet'
                        : 'No reels posted yet — be the first!'}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1.5 max-w-sm">
                      {currentTab === 'saved'
                        ? 'Tap the bookmark icon on any reel to save it for offline playback.'
                        : currentTab === 'following'
                        ? 'Follow creators to see their latest vertical reels here.'
                        : 'Shoot a 4K/60fps reel in Pro Camera, upload from your phone gallery, or post a Live Story Snap.'}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSnapReplyTarget(null);
                          setIsProCameraOpen(true);
                        }}
                        className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-amber-500 hover:brightness-110 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-pink-600/25 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Open Pro Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenUpload}
                        className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-cyan-400" />
                        <span>Upload Video / Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenDownloads}
                        className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Film className="w-4 h-4" />
                        <span>Movie Box</span>
                      </button>
                      {currentTab !== 'foryou' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTag(null);
                            setCurrentTab('foryou');
                          }}
                          className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          Back to For You
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex-1 min-h-0 w-full snap-container overflow-y-scroll overflow-x-hidden overscroll-y-contain no-scrollbar [transform:translateZ(0)] [will-change:scroll-position]"
                  >
                    {displayedVideos.map((video, idx) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        isActive={idx === activeIndex}
                        isNext={idx === activeIndex + 1}
                        isNearViewport={Math.abs(idx - activeIndex) <= 1}
                        isMuted={isMuted}
                        currentUserId={creatorProfile.id}
                        currentUsername={creatorProfile.username}
                        onToggleMute={handleToggleMute}
                        onLikeToggle={handleLikeToggle}
                        onSaveToggle={handleSaveToggle}
                        onFollowToggle={handleFollowToggle}
                        onOpenComments={handleOpenComments}
                        onOpenShare={handleOpenShare}
                        onViewTracked={handleViewTracked}
                        onDownloadTracked={handleDownloadTracked}
                        onDeletePost={handleDeletePost}
                        onHashtagClick={handleHashtagClick}
                        onOpenCreatorProfile={handleOpenCreatorProfile}
                        onShowToast={showToast}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop Flanking Navigation & Info Widgets (xl screens) */}
              <div className="hidden xl:flex flex-col gap-6 absolute right-8 top-1/2 -translate-y-1/2 z-30 [transform:translateZ(0)]">
                {/* Next / Previous Snap Buttons */}
                <div className="flex flex-col gap-2 p-1.5 bg-neutral-900/95 rounded-2xl border border-neutral-800 shadow-lg">
                  <button
                    type="button"
                    disabled={activeIndex === 0}
                    onClick={() => scrollToIndex(activeIndex - 1)}
                    className="w-11 h-11 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800/80 text-white flex items-center justify-center transition-all group"
                    aria-label="Previous reel"
                    title="Previous (↑ or K)"
                  >
                    <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                  <div className="text-[10px] text-center font-bold text-neutral-400 tabular-nums">
                    {displayedVideos.length > 0 ? `${activeIndex + 1}/${displayedVideos.length}` : '0/0'}
                  </div>
                  <button
                    type="button"
                    disabled={activeIndex >= displayedVideos.length - 1}
                    onClick={() => scrollToIndex(activeIndex + 1)}
                    className="w-11 h-11 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800/80 text-white flex items-center justify-center transition-all group"
                    aria-label="Next reel"
                    title="Next (↓ or J)"
                  >
                    <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                  </button>
                </div>

                {/* Current Reel Mini Card */}
                {currentActiveVideo && (
                  <div className="w-56 p-3.5 bg-neutral-900/95 rounded-2xl border border-neutral-800 shadow-lg text-xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={currentActiveVideo.creator.avatar}
                        alt={currentActiveVideo.creator.name}
                        loading="lazy"
                        decoding="async"
                        className="w-8 h-8 rounded-full object-cover bg-neutral-800 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-[11px]">
                          {currentActiveVideo.creator.name}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          @{currentActiveVideo.creator.username}
                        </p>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-neutral-800/80 flex items-center gap-1.5 text-neutral-300">
                      <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <p className="text-[11px] font-medium truncate">
                        {currentActiveVideo.sound.title}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Lazy-Loaded Modals: Only fetched and mounted when opened */}
      {isAuthOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            initialMode={authMode}
            onLoginSuccess={handleLoginSuccess}
            registeredUsers={users}
            onRegisterUser={(newUser) => {
              updateUsers([newUser, ...users]);
              showToast(`Registered successfully as @${newUser.username}!`);
            }}
          />
        </Suspense>
      )}

      {isAdminPanelOpen && (
        <Suspense fallback={null}>
          <AdminPanel
            isOpen={isAdminPanelOpen}
            onClose={() => setIsAdminPanelOpen(false)}
            users={users}
            currentUser={currentUser}
            onUpdateUserRole={handleUpdateUserRole}
            onToggleUserStatus={handleToggleUserStatus}
            onDeleteUser={handleDeleteUser}
            onAddNewUser={handleAddNewUser}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {commentsVideo && (
        <Suspense fallback={null}>
          <CommentsDrawer
            isOpen={Boolean(commentsVideo)}
            onClose={() => setCommentsVideo(null)}
            comments={commentsVideo.commentsList}
            onAddComment={handleAddComment}
            onLikeComment={handleLikeComment}
            activeUsername={currentUser?.username || creatorProfile.username}
            activeAvatar={currentUser?.avatar || creatorProfile.avatar}
            onOpenCreatorProfile={(uname) => handleOpenCreatorProfile(uname)}
          />
        </Suspense>
      )}

      {shareVideo && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={Boolean(shareVideo)}
            onClose={() => setShareVideo(null)}
            video={shareVideo}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isUploadOpen && (
        <Suspense fallback={null}>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => {
              setIsUploadOpen(false);
              setPreselectedUploadFile(null);
            }}
            currentUser={currentUser}
            creatorProfile={creatorProfile}
            preselectedFile={preselectedUploadFile}
            onUploadSuccess={handleUploadSuccess}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isProCameraOpen && (
        <Suspense fallback={<LazyTabFallback />}>
          <ProCameraModal
            isOpen={isProCameraOpen}
            onClose={() => {
              setIsProCameraOpen(false);
              setSnapReplyTarget(null);
            }}
            currentUser={currentUser}
            creatorProfile={creatorProfile}
            directRecipients={directRecipients}
            initialSnapRecipient={snapReplyTarget}
            onPostLiveStory={(createdStory) => {
              setLiveStories((prev) => [
                createdStory,
                ...prev.filter((s) => s.id !== createdStory.id),
              ]);
              setCurrentTab('foryou');
            }}
            onDirectSnapSent={(sentSnap) => {
              setDirectSnaps((prev) => [
                sentSnap,
                ...prev.filter((m) => m.id !== sentSnap.id),
              ]);
            }}
            onRecordSuccess={(newPost) => {
              expectedVideoIdRef.current = newPost.id;
              setVideos((prev) => [newPost, ...prev.filter((v) => v.id !== newPost.id)]);
              setSelectedTag(null);
              setCurrentTab('foryou');
              setActiveIndex(0);
              setTimeout(() => scrollToIndex(0), 60);
            }}
            onSwitchToUploadFile={() => setIsUploadOpen(true)}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isDirectSnapsOpen && (
        <Suspense fallback={null}>
          <DirectSnapsModal
            isOpen={isDirectSnapsOpen}
            onClose={() => setIsDirectSnapsOpen(false)}
            currentUserId={currentUser?.id || creatorProfile.id}
            currentUsername={currentUser?.username || creatorProfile.username}
            currentName={currentUser?.name || creatorProfile.name}
            currentAvatar={currentUser?.avatar || creatorProfile.avatar}
            snaps={directSnaps}
            recipients={directRecipients}
            onMarkSnapViewed={(snapId) => {
              setDirectSnaps((prev) =>
                prev.map((m) => (m.id === snapId ? { ...m, isViewed: true } : m))
              );
              void markDirectSnapViewed(snapId);
            }}
            onReplyWithCamera={(recipient) => {
              setIsDirectSnapsOpen(false);
              setSnapReplyTarget(recipient);
              setIsProCameraOpen(true);
            }}
            onSendTextMessage={async (recipient, text) => {
              const sent = await sendDirectSnap({
                sender: {
                  id: currentUser?.id || creatorProfile.id,
                  name: currentUser?.name || creatorProfile.name,
                  username: currentUser?.username || creatorProfile.username,
                  avatar: currentUser?.avatar || creatorProfile.avatar,
                },
                recipient,
                mediaBlob: null,
                fallbackMediaUrl: '',
                mediaType: 'video',
                textMessage: text,
              });
              setDirectSnaps((prev) => [sent, ...prev.filter((m) => m.id !== sent.id)]);
            }}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isTrendsOpen && (
        <Suspense fallback={null}>
          <TrendsDashboard
            isOpen={isTrendsOpen}
            onClose={() => setIsTrendsOpen(false)}
            videos={videos}
            onSelectReel={(videoIndex) => {
              setSelectedTag(null);
              setCurrentTab('foryou');
              setIsTrendsOpen(false);
              setTimeout(() => {
                scrollToIndex(videoIndex);
              }, 120);
            }}
            onSelectHashtag={(tag) => {
              setSelectedTag(tag);
              setIsTrendsOpen(false);
              setTimeout(() => {
                scrollToIndex(0);
              }, 120);
              showToast(`Filtered by #${tag}`);
            }}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isLiveOpen && (
        <Suspense fallback={null}>
          <LiveStreamModal
            isOpen={isLiveOpen}
            onClose={() => setIsLiveOpen(false)}
            currentUser={currentUser}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {isCreatorSearchOpen && (
        <Suspense fallback={null}>
          <CreatorDirectoryModal
            isOpen={isCreatorSearchOpen}
            onClose={() => setIsCreatorSearchOpen(false)}
            videos={videos}
            ownProfile={creatorProfile}
            onSelectCreator={handleOpenCreatorProfile}
            onPlayVideo={(vid) => {
              setIsCreatorSearchOpen(false);
              handlePlayVideoFromProfile(vid);
            }}
            onFollowToggle={handleFollowToggle}
            onShowToast={showToast}
          />
        </Suspense>
      )}
    </div>
  );
}

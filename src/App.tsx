import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Sparkles,
  Music,
  Compass,
} from 'lucide-react';
import { INITIAL_VIDEOS } from './data/mockVideos';
import {
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
} from './data/mockUsers';
import { VideoPost, FeedTab, UserAccount, UserRole, UserStatus, CreatorProfileData } from './types';
import { VideoCard } from './components/VideoCard';
import { CommentsDrawer } from './components/CommentsDrawer';
import { ShareModal } from './components/ShareModal';
import { UploadModal } from './components/UploadModal';
import { SidebarDesktop } from './components/SidebarDesktop';
import { MobileNavigation } from './components/MobileNavigation';
import { TopBar } from './components/TopBar';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { TrendsDashboard } from './components/TrendsDashboard';
import { LiveStreamModal } from './components/LiveStreamModal';
import { LiveStreamMainView } from './components/LiveStreamMainView';
import { DownloadHub } from './components/DownloadHub';
import { ProCameraModal } from './components/ProCameraModal';
import { CreatorProfileView } from './components/CreatorProfileView';
import { soundEngine } from './utils/soundEngine';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  USER_PROFILE_ID_KEY,
  SupabasePostRow,
  getOrCreateUserProfileId,
  getStoredLikedPostIds,
  saveStoredLikedPostIds,
  fetchGlobalPosts,
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  updatePostLikesInSupabase,
  upsertUserProfileInSupabase,
  mapSupabaseRowToVideoPost,
} from './lib/supabaseService';

const CREATOR_PROFILE_STORAGE_KEY = 'jatt_creator_profile';

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
          baseFollowers: typeof parsed.baseFollowers === 'number' ? parsed.baseFollowers : 12400,
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
    baseFollowers: 12400,
  };
};

export default function App() {
  const [videos, setVideos] = useState<VideoPost[]>(INITIAL_VIDEOS);
  const [users, setUsers] = useState<UserAccount[]>(getStoredUsers);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getStoredCurrentUser);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData>(() =>
    getInitialCreatorProfile(getStoredCurrentUser())
  );

  const [currentTab, setCurrentTab] = useState<FeedTab>('foryou');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Modals state
  const [commentsVideo, setCommentsVideo] = useState<VideoPost | null>(null);
  const [shareVideo, setShareVideo] = useState<VideoPost | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProCameraOpen, setIsProCameraOpen] = useState(false);
  const [isTrendsOpen, setIsTrendsOpen] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Load global posts from Supabase and listen for real-time inserts/likes
  useEffect(() => {
    let isCancelled = false;

    const loadGlobalFeed = async () => {
      const globalPosts = await fetchGlobalPosts(creatorProfile.id);
      if (isCancelled || globalPosts.length === 0) return;

      setVideos((prev) => {
        const globalIds = new Set(globalPosts.map((p) => p.id));
        const remaining = prev.filter((v) => !globalIds.has(v.id));
        return [...globalPosts, ...remaining];
      });
    };

    loadGlobalFeed();

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
            const mapped = mapSupabaseRowToVideoPost(row, likedIds, creatorProfile.id);
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
                        likes:
                          typeof row.likes_count === 'number'
                            ? Math.max(0, row.likes_count)
                            : v.stats.likes,
                      },
                    }
                  : v
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      client.removeChannel(channel);
    };
  }, [creatorProfile.id]);

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
          v.userId === updated.id || v.isUserUploaded
            ? {
                ...v,
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

  // Filter videos based on current tab and selected tag
  const displayedVideos = videos.filter((v) => {
    if (currentTab === 'live' || currentTab === 'downloads' || currentTab === 'profile') {
      return false;
    }
    if (selectedTag) {
      return v.hashtags.includes(selectedTag);
    }
    if (currentTab === 'saved') {
      return v.isSaved;
    }
    if (currentTab === 'following') {
      return v.creator.isFollowing;
    }
    if (currentTab === 'trending') {
      return v.stats.likes > 100000;
    }
    return true; // 'foryou'
  });

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
      const targetY = targetIndex * containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: targetY,
        behavior: 'smooth',
      });
      setActiveIndex(targetIndex);
    },
    [displayedVideos.length]
  );

  // Track active index on scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight === 0) return;
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < displayedVideos.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, displayedVideos.length]);

  // Like toggle (persists liked post IDs locally + updates likes_count globally in Supabase)
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

      if (targetVideo.isSupabasePost) {
        void updatePostLikesInSupabase(id, nextLikes);
      }
    },
    [videos]
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

  // Save/Bookmark toggle
  const handleSaveToggle = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const willSave = !v.isSaved;
          showToast(willSave ? 'Saved to bookmarks!' : 'Removed from bookmarks');
          return {
            ...v,
            isSaved: willSave,
            stats: {
              ...v.stats,
              saves: willSave ? v.stats.saves + 1 : v.stats.saves - 1,
            },
          };
        }
        return v;
      })
    );
  };

  // Follow toggle
  const handleFollowToggle = (username: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.creator.username === username) {
          return {
            ...v,
            creator: {
              ...v.creator,
              isFollowing: !v.creator.isFollowing,
            },
          };
        }
        return v;
      })
    );
  };

  // Add comment
  const handleAddComment = (text: string) => {
    if (!commentsVideo) return;
    const authorName = currentUser?.name || 'You';
    const authorUsername = currentUser?.username || 'you';
    const authorAvatar =
      currentUser?.avatar ||
      'https://api.dicebear.com/7.x/bottts/svg?seed=YouUser&backgroundColor=ec4899';

    const newComment = {
      id: `comm-${Date.now()}`,
      user: {
        name: authorName,
        username: authorUsername,
        avatar: authorAvatar,
        isCreator: currentUser?.role === 'creator',
        isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
      },
      text,
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
    };

    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === commentsVideo.id) {
          const updatedComments = [newComment, ...v.commentsList];
          const updatedVideo = {
            ...v,
            stats: { ...v.stats, comments: v.stats.comments + 1 },
            commentsList: updatedComments,
          };
          setCommentsVideo(updatedVideo);
          return updatedVideo;
        }
        return v;
      })
    );
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
    setVideos((prev) => [newPost, ...prev.filter((v) => v.id !== newPost.id)]);
    setSelectedTag(null);
    setCurrentTab('foryou');
    showToast('Published to global feed!');

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

  // Quick Mobile Upload Handler (Live Recording or Gallery Video/Image -> Supabase Storage + posts table)
  const handleQuickGalleryUpload = useCallback(
    async (file: File, source?: 'live' | 'gallery') => {
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

        const uploadedUrl = await uploadMediaToReelsBucket(file, 'posts', file.name);
        const finalMediaUrl = uploadedUrl || localPreviewUrl;

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
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,
            },
            isLiked: false,
            isSaved: false,
            commentsList: [],
          };

        // 1. Prepend this new post to the top of the main feed array (deduping realtime)
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
    showToast(`Welcome back, @${user.username}! (${user.role.toUpperCase()})`);
  };

  const handleLogout = () => {
    updateCurrentUser(null);
    showToast('You have logged out');
  };

  const savedCount = videos.filter((v) => v.isSaved).length;
  const currentActiveVideo = displayedVideos[activeIndex];

  // Real-time total likes & following count for Creator Profile
  const userUploadedVideos = videos.filter(
    (v) =>
      v.userId === creatorProfile.id ||
      v.isUserUploaded ||
      v.creator.username === creatorProfile.username
  );
  const userVideosLikes = userUploadedVideos.reduce((sum, v) => sum + v.stats.likes, 0);
  const likedFeedVideosCount = videos.filter(
    (v) =>
      !(
        v.userId === creatorProfile.id ||
        v.isUserUploaded ||
        v.creator.username === creatorProfile.username
      ) && v.isLiked
  ).length;
  const totalProfileLikes = userVideosLikes + likedFeedVideosCount;
  const followingCount = new Set(
    videos.filter((v) => v.creator.isFollowing).map((v) => v.creator.username)
  ).size;

  // Play video from Creator Profile grid in full-screen vertical feed
  const handlePlayVideoFromProfile = useCallback(
    (videoId: string) => {
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
        onOpenLogin={() => {
          setAuthMode('login');
          setIsAuthOpen(true);
        }}
        onOpenRegister={() => {
          setAuthMode('register');
          setIsAuthOpen(true);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenTrends={() => setIsTrendsOpen(true)}
        onOpenLive={handleOpenLive}
        onOpenDownloads={handleOpenDownloads}
        onOpenProCamera={() => setIsProCameraOpen(true)}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenProfile={() => {
          setSelectedTag(null);
          setCurrentTab('profile');
        }}
        onLogout={handleLogout}
        currentTab={currentTab}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-60 bg-neutral-900/95 text-white px-4 py-2 rounded-full border border-neutral-700/80 shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
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
            setSelectedTag(null);
            setCurrentTab(tab);
            setActiveIndex(0);
          }}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenTrends={() => setIsTrendsOpen(true)}
          onOpenLive={handleOpenLive}
          onOpenProCamera={() => setIsProCameraOpen(true)}
          isMuted={isMuted}
          onToggleMute={() => {
            setIsMuted((prev) => {
              const next = !prev;
              soundEngine.setMuted(next);
              return next;
            });
          }}
          savedCount={savedCount}
          currentUser={currentUser}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
          onOpenLogin={() => {
            setAuthMode('login');
            setIsAuthOpen(true);
          }}
        />

        {/* Main Snap Scrolling Stage OR TikTok Live Stream View OR Download Hub */}
        <main className="flex-1 h-full flex items-center justify-center relative overflow-hidden">
          {/* Mobile Navigation Controls */}
          <MobileNavigation
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setSelectedTag(null);
              setCurrentTab(tab);
              setActiveIndex(0);
            }}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenTrends={() => setIsTrendsOpen(true)}
            onOpenLive={handleOpenLive}
            onOpenProCamera={() => setIsProCameraOpen(true)}
            onQuickVideoUpload={handleQuickGalleryUpload}
            savedCount={savedCount}
            currentUser={currentUser}
            creatorAvatar={creatorProfile.avatar}
            onOpenLogin={() => {
              setAuthMode('login');
              setIsAuthOpen(true);
            }}
            onOpenRegister={() => {
              setAuthMode('register');
              setIsAuthOpen(true);
            }}
            onOpenAdmin={() => setIsAdminPanelOpen(true)}
            onLogout={handleLogout}
          />


          {currentTab === 'live' ? (
            /* DYNAMIC TIKTOK-STYLE LIVE STREAM LAYOUT IN MAIN VIEW */
            <LiveStreamMainView
              currentUser={currentUser}
              onSelectTab={(tab) => {
                setSelectedTag(null);
                setCurrentTab(tab);
                setActiveIndex(0);
              }}
              onShowToast={showToast}
              isMuted={isMuted}
              onToggleMute={() => {
                setIsMuted((prev) => {
                  const next = !prev;
                  soundEngine.setMuted(next);
                  return next;
                });
              }}
            />
          ) : currentTab === 'downloads' ? (
            /* ALL-IN-ONE DOWNLOAD HUB (SONGS, APPS, DRAMAS, MOVIES, CARTOONS, QURAN) */
            <DownloadHub
              onBackToFeed={() => {
                setSelectedTag(null);
                setCurrentTab('foryou');
                setActiveIndex(0);
              }}
              onShowToast={showToast}
              isMuted={isMuted}
              onToggleMute={() => {
                setIsMuted((prev) => {
                  const next = !prev;
                  soundEngine.setMuted(next);
                  return next;
                });
              }}
            />
          ) : currentTab === 'profile' ? (
            /* TIKTOK-STYLE CREATOR PROFILE TAB */
            <CreatorProfileView
              profile={creatorProfile}
              onUpdateProfile={handleUpdateCreatorProfile}
              videos={videos}
              totalProfileLikes={totalProfileLikes}
              followingCount={followingCount}
              onPlayVideo={handlePlayVideoFromProfile}
              onOpenUpload={() => setIsUploadOpen(true)}
              onBackToFeed={() => {
                setSelectedTag(null);
                setCurrentTab('foryou');
              }}
              onShowToast={showToast}
            />
          ) : (
            <>
              {/* Filter bar pill if tag is selected */}
              {selectedTag && (
                <div className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-pink-500/50 flex items-center gap-2 text-xs shadow-xl">

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

              {/* Center Vertical Reel Stage */}
              <div className="relative w-full h-full sm:max-w-[460px] mx-auto bg-black border-x border-neutral-900/60 flex flex-col justify-center [transform:translateZ(0)]">
                {displayedVideos.length === 0 ? (
                  <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
                    <Compass className="w-12 h-12 text-neutral-600 mb-3" />
                    <h3 className="text-base font-bold text-white">No reels here yet</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      {currentTab === 'saved'
                        ? 'Tap the bookmark icon on any reel to save it for later.'
                        : 'Follow more creators to see their latest vertical reels here.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTag(null);
                        setCurrentTab('foryou');
                      }}
                      className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      Explore For You Feed
                    </button>
                  </div>
                ) : (
                  <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="h-full w-full snap-container overflow-y-scroll overflow-x-hidden no-scrollbar [transform:translateZ(0)] [will-change:scroll-position]"
                  >
                    {displayedVideos.map((video, idx) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        isActive={idx === activeIndex}
                        isMuted={isMuted}
                        onToggleMute={() => {
                          setIsMuted((prev) => {
                            const next = !prev;
                            soundEngine.setMuted(next);
                            return next;
                          });
                        }}
                        onLikeToggle={handleLikeToggle}
                        onSaveToggle={handleSaveToggle}
                        onFollowToggle={handleFollowToggle}
                        onOpenComments={(vid) => setCommentsVideo(vid)}
                        onOpenShare={(vid) => setShareVideo(vid)}
                        onHashtagClick={(tag) => setSelectedTag(tag)}
                        onShowToast={showToast}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop Flanking Navigation & Info Widgets (xl screens) */}
              <div className="hidden xl:flex flex-col gap-6 absolute right-8 top-1/2 -translate-y-1/2 z-30">
                {/* Next / Previous Snap Buttons */}
                <div className="flex flex-col gap-2 p-1.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-xl backdrop-blur-md">
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
                  <div className="w-56 p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-xl backdrop-blur-md text-xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={currentActiveVideo.creator.avatar}
                        alt={currentActiveVideo.creator.name}
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

      {/* User Registration & Login Modal */}
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

      {/* Admin Panel Layout */}
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

      {/* Interactive Comments Drawer */}
      {commentsVideo && (
        <CommentsDrawer
          isOpen={Boolean(commentsVideo)}
          onClose={() => setCommentsVideo(null)}
          comments={commentsVideo.commentsList}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
        />
      )}

      {/* Interactive Share Modal */}
      {shareVideo && (
        <ShareModal
          isOpen={Boolean(shareVideo)}
          onClose={() => setShareVideo(null)}
          video={shareVideo}
          onShowToast={showToast}
        />
      )}

      {/* Upload Custom Reel Modal (from device file or URL) */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentUser={currentUser}
        creatorProfile={creatorProfile}
        onUploadSuccess={handleUploadSuccess}
        onShowToast={showToast}
      />

      {/* Heavy Pro Camera Interface (4K/60FPS, Beauty Filters, Night Mode, AI Motion Tracking) */}
      <ProCameraModal
        isOpen={isProCameraOpen}
        onClose={() => setIsProCameraOpen(false)}
        currentUser={currentUser}
        creatorProfile={creatorProfile}
        onRecordSuccess={(newPost) => {
          setVideos((prev) => [newPost, ...prev]);
          setSelectedTag(null);
          setCurrentTab('foryou');
          setActiveIndex(0);
        }}
        onSwitchToUploadFile={() => setIsUploadOpen(true)}
        onShowToast={showToast}
      />


      {/* Trends Dashboard Panel */}
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

      {/* TikTok-style Live Stream Interface Modal */}
      <LiveStreamModal
        isOpen={isLiveOpen}
        onClose={() => setIsLiveOpen(false)}
        currentUser={currentUser}
        onShowToast={showToast}
      />
    </div>
  );
}

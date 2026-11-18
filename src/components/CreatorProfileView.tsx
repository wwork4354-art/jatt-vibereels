import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Edit3,
  Heart,
  Play,
  Plus,
  Video,
  Bookmark,
  CheckCircle2,
  Camera,
  X,
  Upload,
  Check,
  Sparkles,
  User as UserIcon,
  Eye,
  Bell,
  TrendingUp,
  RefreshCw,
  Globe,
  AlertCircle,
  HardDrive,
  Music,
  Trash2,
  WifiOff,
  CheckCircle,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ActivityEvent, CreatorProfileData, VideoPost } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { PWAInstallButton } from './PWAInstallButton';
import {
  uploadMediaToReelsBucket,
  checkUsernameAvailability,
  getProfileViewsForUsername,
  normalizeCreatorUsername,
} from '../lib/supabaseService';
import { CreatorActivityView, PostInsightsModal } from './CreatorActivityView';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import {
  OfflineMediaRecord,
  OFFLINE_STORE_EVENT,
  getAllOfflineSavedPosts,
  savePostForOffline,
  removeOfflineSavedPost,
  hydratePostWithOfflineRecord,
  formatOfflineBytes,
} from '../lib/offlineMediaStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { soundEngine } from '../utils/soundEngine';
import {
  sanitizeInputLive,
  sanitizeText,
  sanitizeSafeUrl,
  validateSafeMediaFile,
} from '../utils/security';

interface CreatorProfileViewProps {
  profile: CreatorProfileData;
  onUpdateProfile: (updated: CreatorProfileData) => void;
  onSyncProfileByUsername?: (username: string) => Promise<boolean>;
  videos: VideoPost[];
  activityEvents: ActivityEvent[];
  unreadActivityCount?: number;
  onMarkActivityRead?: () => void;
  totalProfileLikes: number;
  followingCount: number;
  initialSubTab?: 'videos' | 'saved' | 'liked' | 'activity';
  onPlayVideo: (videoId: string) => void;
  onDeletePost?: (videoId: string) => void;
  onOpenUpload: () => void;
  onOpenPublicChannel?: () => void;
  onBackToFeed: () => void;
  onShowToast: (msg: string) => void;
}

const NEON_AVATAR_PRESETS = [
  'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
  'https://api.dicebear.com/7.x/bottts/svg?seed=JattNeon&backgroundColor=ec4899',
  'https://api.dicebear.com/7.x/bottts/svg?seed=CyberVibe&backgroundColor=06b6d4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PunjabiPulse&backgroundColor=8b5cf6',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=JattCreator',
];

function formatCompactCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onSyncProfileByUsername,
  videos,
  activityEvents,
  unreadActivityCount = 0,
  onMarkActivityRead,
  totalProfileLikes,
  followingCount,
  initialSubTab,
  onPlayVideo,
  onDeletePost,
  onOpenUpload,
  onOpenPublicChannel,
  onBackToFeed,
  onShowToast,
}) => {
  const isOnline = useOnlineStatus();
  const [activeSubTab, setActiveSubTab] = useState<'videos' | 'saved' | 'liked' | 'activity'>(
    initialSubTab || 'videos'
  );
  const [offlineRecords, setOfflineRecords] = useState<OfflineMediaRecord[]>([]);
  const [savedFilter, setSavedFilter] = useState<'all' | 'reels' | 'audio'>('all');
  const [offlinePlayerPost, setOfflinePlayerPost] = useState<VideoPost | null>(null);
  const [offlinePlayerFill, setOfflinePlayerFill] = useState<boolean>(false);
  const [postPendingDelete, setPostPendingDelete] = useState<VideoPost | null>(null);
  const [cachingPostId, setCachingPostId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncUsernameInput, setSyncUsernameInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [insightsPost, setInsightsPost] = useState<VideoPost | null>(null);

  // Edit form states
  const [editName, setEditName] = useState(profile.name);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editAvatar, setEditAvatar] = useState(profile.avatar);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean;
    normalized: string;
    reason?: string;
  }>({
    checking: false,
    available: true,
    normalized: normalizeCreatorUsername(profile.username),
  });

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  React.useEffect(() => {
    const loadOffline = () => {
      void getAllOfflineSavedPosts().then((list) => {
        setOfflineRecords(list);
      });
    };
    loadOffline();
    window.addEventListener(OFFLINE_STORE_EVENT, loadOffline);
    return () => window.removeEventListener(OFFLINE_STORE_EVENT, loadOffline);
  }, []);

  React.useEffect(() => {
    if (!offlinePlayerPost) {
      soundEngine.stopTrack();
      return;
    }
    const shouldSynth =
      !offlinePlayerPost.sound?.audioUrl &&
      (offlinePlayerPost.mediaType === 'image' ||
        Boolean(offlinePlayerPost.sound?.hasAttachedAudio) ||
        offlinePlayerPost.sound?.category === 'naat' ||
        offlinePlayerPost.sound?.category === 'song');
    if (shouldSynth) {
      soundEngine.setMuted(false);
      soundEngine.playTrack(offlinePlayerPost.sound.trackType, 0.85);
    }
    return () => {
      soundEngine.stopTrack();
    };
  }, [offlinePlayerPost]);

  const userVideos = videos.filter(
    (v) =>
      v.userId === profile.id ||
      v.isUserUploaded ||
      v.creator.username.toLowerCase() === profile.username.toLowerCase()
  );
  const likedVideos = videos.filter((v) => v.isLiked);
  const savedVideos = videos.filter((v) => v.isSaved);

  const offlineRecordMap = React.useMemo(() => {
    const map = new Map<string, OfflineMediaRecord>();
    for (const rec of offlineRecords) {
      map.set(rec.id, rec);
    }
    return map;
  }, [offlineRecords]);

  // Combined Saved / Downloads list (bookmarked reels + IndexedDB downloaded/uploaded/recorded items)
  const combinedSavedDownloads = React.useMemo(() => {
    const seen = new Set<string>();
    const list: VideoPost[] = [];

    for (const rec of offlineRecords) {
      if (!seen.has(rec.id)) {
        seen.add(rec.id);
        list.push(rec.post);
      }
    }
    for (const v of savedVideos) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        list.push(v);
      }
    }

    if (savedFilter === 'audio') {
      return list.filter(
        (v) =>
          v.mediaType === 'image' ||
          Boolean(v.sound?.hasAttachedAudio) ||
          Boolean(v.sound?.audioUrl) ||
          v.sound?.category === 'naat' ||
          v.sound?.category === 'song' ||
          v.category === 'music'
      );
    }
    if (savedFilter === 'reels') {
      return list.filter((v) => v.mediaType !== 'image');
    }
    return list;
  }, [offlineRecords, savedVideos, savedFilter]);

  const totalSavedDownloadsCount = React.useMemo(() => {
    const ids = new Set<string>([
      ...offlineRecords.map((r) => r.id),
      ...savedVideos.map((v) => v.id),
    ]);
    return ids.size;
  }, [offlineRecords, savedVideos]);

  const totalOwnViews = userVideos.reduce((sum, v) => sum + (v.stats.views || 0), 0);
  const profileViewsCount = getProfileViewsForUsername(
    profile.username,
    profile.profileViews ?? 0
  );

  React.useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    const normalized = normalizeCreatorUsername(editUsername);

    if (normalized === normalizeCreatorUsername(profile.username) && normalized.length >= 3) {
      setUsernameStatus({ checking: false, available: true, normalized });
      return;
    }

    setUsernameStatus((prev) => ({ ...prev, checking: true, normalized }));
    const timer = window.setTimeout(async () => {
      const check = await checkUsernameAvailability(editUsername, profile.id, videos);
      if (!cancelled) {
        setUsernameStatus({
          checking: false,
          available: check.available,
          normalized: check.normalized,
          reason: check.reason,
        });
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isEditing, editUsername, profile.id, profile.username, videos]);

  const currentGridVideos =
    activeSubTab === 'videos'
      ? userVideos
      : activeSubTab === 'liked'
      ? likedVideos
      : combinedSavedDownloads;

  const handleOpenSavedOfflineItem = (vid: VideoPost) => {
    const rec = offlineRecordMap.get(vid.id);
    if (rec && (rec.mediaBlob || rec.audioBlob)) {
      setOfflinePlayerPost(hydratePostWithOfflineRecord(vid, rec));
      return;
    }
    if (!isOnline && (vid.videoUrl.startsWith('http') || vid.sound?.audioUrl?.startsWith('http'))) {
      setOfflinePlayerPost(vid);
      return;
    }
    if (activeSubTab === 'saved') {
      setOfflinePlayerPost(vid);
    } else {
      onPlayVideo(vid.id);
    }
  };

  const handleCacheForOffline = async (e: React.MouseEvent, vid: VideoPost) => {
    e.stopPropagation();
    if (cachingPostId === vid.id) return;
    setCachingPostId(vid.id);
    try {
      const saved = await savePostForOffline(vid, { sourceType: 'saved' });
      if (saved && (saved.mediaBlob || saved.audioBlob)) {
        onShowToast(`Saved "${vid.title}" for Offline Mode (${formatOfflineBytes(saved.sizeBytes)})!`);
      } else {
        onShowToast(`Saved "${vid.title}" metadata for Offline Mode.`);
      }
    } finally {
      setCachingPostId(null);
    }
  };

  const handleDeleteOfflineCopy = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    await removeOfflineSavedPost(postId);
    onShowToast('Removed local offline download');
  };

  const openEditModal = () => {
    setEditName(profile.name);
    setEditUsername(profile.username);
    setEditBio(profile.bio);
    setEditAvatar(profile.avatar);
    setPendingAvatarBlob(null);
    setIsEditing(true);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateSafeMediaFile(file, { allowedKind: 'image' });
    if (!check.valid) {
      onShowToast(
        check.reason || 'Blocked unsafe avatar image. Only .jpg, .png, and .webp are allowed.'
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_SIZE = 256;
          const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
          const targetWidth = Math.max(1, Math.round(img.width * scale));
          const targetHeight = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
            setEditAvatar(compressedDataUrl);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  setPendingAvatarBlob(blob);
                }
              },
              'image/jpeg',
              0.8
            );
            onShowToast('Profile picture compressed & ready!');
            return;
          }
        } catch {
          // fallback below
        }
        setEditAvatar(reader.result as string);
        setPendingAvatarBlob(file);
      };
      img.onerror = () => {
        setEditAvatar(reader.result as string);
        setPendingAvatarBlob(file);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const check = await checkUsernameAvailability(editUsername, profile.id, videos);
      if (!check.available) {
        setUsernameStatus({
          checking: false,
          available: false,
          normalized: check.normalized,
          reason: check.reason,
        });
        onShowToast(check.reason || 'Choose a unique @username first.');
        return;
      }

      const cleanUsername = check.normalized || 'jatt_official';

      let finalAvatarUrl =
        sanitizeSafeUrl(editAvatar) || NEON_AVATAR_PRESETS[0];
      if (pendingAvatarBlob) {
        const uploadedUrl = await uploadMediaToReelsBucket(
          pendingAvatarBlob,
          'avatars',
          `${cleanUsername || 'avatar'}.jpg`
        );
        if (uploadedUrl) {
          finalAvatarUrl = sanitizeSafeUrl(uploadedUrl) || finalAvatarUrl;
        }
      }

      const updated: CreatorProfileData = {
        ...profile,
        name: sanitizeText(editName, 80) || 'Jatt Creator',
        username: cleanUsername,
        bio: sanitizeText(editBio, 240),
        avatar: finalAvatarUrl,
        profileViews: profileViewsCount,
      };

      onUpdateProfile(updated);
      setIsEditing(false);
      setPendingAvatarBlob(null);
      onShowToast('Creator channel saved & synced!');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCloudRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSyncProfileByUsername || !syncUsernameInput.trim()) return;
    setIsSyncing(true);
    try {
      const found = await onSyncProfileByUsername(syncUsernameInput.trim());
      if (found) {
        setIsSyncOpen(false);
        setSyncUsernameInput('');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white overflow-y-auto no-scrollbar pb-20 lg:pb-8 [transform:translateZ(0)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 bg-neutral-950/95 border-b border-neutral-800/80 flex items-center justify-between gap-2 [transform:translateZ(0)]">
        <button
          type="button"
          onClick={onBackToFeed}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-pink-400" />
          <span>Feed</span>
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-black text-white truncate">{profile.name}</span>
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('activity');
              onMarkActivityRead?.();
            }}
            className={`relative p-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              activeSubTab === 'activity'
                ? 'bg-pink-600/25 border-pink-500/50 text-pink-300'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
            }`}
            title="Creator Activity & Post Insights"
          >
            <Bell className="w-4 h-4" />
            {unreadActivityCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadActivityCount > 9 ? '9+' : unreadActivityCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={openEditModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/40 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Main Profile Hero Container */}
      <div className="max-w-3xl w-full mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3.5">
          {/* Avatar with quick edit trigger */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-lg shadow-pink-500/20">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-full h-full rounded-full object-cover bg-neutral-900 border-2 border-neutral-950"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              type="button"
              onClick={openEditModal}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-neutral-900 hover:bg-pink-600 text-white border border-pink-500/50 flex items-center justify-center shadow-md transition-colors cursor-pointer"
              title="Change profile photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Name & Handle */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{profile.name}</span>
              <Sparkles className="w-4 h-4 text-pink-400" />
            </h2>
            <p className="text-xs font-bold text-cyan-400">@{profile.username}</p>
          </div>

          {/* TikTok-Style Stats Row */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-5 py-2.5 px-3 sm:px-6 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 w-full max-w-xl">
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {followingCount.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Following</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-1.5 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {formatCompactCount(profile.baseFollowers)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Followers</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-1.5 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-pink-400 tabular-nums">
                {formatCompactCount(totalProfileLikes)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Likes</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-1.5 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-cyan-400 tabular-nums">
                {formatCompactCount(totalOwnViews)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Post Views</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-1.5 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-emerald-400 tabular-nums">
                {formatCompactCount(profileViewsCount)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Profile Views</span>
            </div>
          </div>

          {/* Bio */}
          <p className="text-xs sm:text-sm text-neutral-300 max-w-md leading-relaxed px-2">
            {profile.bio || 'No bio added yet. Tap Edit Profile to customize your creator bio.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={openEditModal}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              onClick={onOpenUpload}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black flex items-center gap-1.5 border border-pink-400/40 shadow-md shadow-pink-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Upload / Record</span>
            </button>
            {onOpenPublicChannel && (
              <button
                type="button"
                onClick={onOpenPublicChannel}
                className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-pink-300 border border-pink-500/35 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="View how others see your public creator channel"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public Channel</span>
              </button>
            )}
            {onSyncProfileByUsername && (
              <button
                type="button"
                onClick={() => setIsSyncOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-cyan-500/35 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="Sync profile & posts from another device"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cloud Sync</span>
              </button>
            )}
            <PWAInstallButton variant="topbar" onShowToast={onShowToast} />
          </div>
        </div>

        {/* Sub-Tabs (My Posts | Saved | Liked | Insights & Activity) */}
        <div className="border-b border-neutral-800 flex items-center justify-around">
          <button
            type="button"
            onClick={() => setActiveSubTab('videos')}
            className={`flex-1 py-3 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'videos'
                ? 'border-pink-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Video className="w-4 h-4 shrink-0" />
            <span>Posts ({userVideos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('saved')}
            className={`flex-1 py-3 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'saved'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">Saved / Downloads ({totalSavedDownloadsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('liked')}
            className={`flex-1 py-3 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'liked'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Heart className="w-4 h-4 shrink-0" />
            <span>Liked ({likedVideos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('activity');
              onMarkActivityRead?.();
            }}
            className={`flex-1 py-3 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold border-b-2 transition-all cursor-pointer relative ${
              activeSubTab === 'activity'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Insights</span>
            {unreadActivityCount > 0 && activeSubTab !== 'activity' && (
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
            )}
          </button>
        </div>

        {/* Offline / Saved Filter Toolbar */}
        {activeSubTab === 'saved' && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Saved' },
                  { id: 'reels', label: 'Videos & Reels' },
                  { id: 'audio', label: 'Songs & Naats' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSavedFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    savedFilter === chip.id
                      ? 'bg-gradient-to-r from-amber-500 to-pink-600 text-white shadow-sm'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold px-2">
              {isOnline ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{offlineRecords.length} cached offline</span>
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline Playback Ready</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sub-Tab Body */}
        {activeSubTab === 'activity' ? (
          <CreatorActivityView
            embedded={true}
            events={activityEvents}
            videos={videos}
            profile={profile}
            onPlayVideo={onPlayVideo}
            onMarkAllRead={onMarkActivityRead}
            onShowToast={onShowToast}
          />
        ) : currentGridVideos.length === 0 ? (
          <div className="py-14 px-4 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 mx-auto flex items-center justify-center text-pink-400">
              {activeSubTab === 'videos' ? (
                <Video className="w-6 h-6" />
              ) : activeSubTab === 'liked' ? (
                <Heart className="w-6 h-6" />
              ) : (
                <HardDrive className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <h3 className="text-sm font-bold text-white">
              {activeSubTab === 'videos'
                ? 'No uploaded or recorded videos yet'
                : activeSubTab === 'liked'
                ? 'No liked reels yet'
                : 'No Saved / Downloaded items yet'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              {activeSubTab === 'videos'
                ? 'Tap the (+) camera button below or Upload / Record to share your first vertical reel permanently!'
                : activeSubTab === 'liked'
                ? 'Tap the Heart icon on any reel in the feed and it will appear here.'
                : 'Bookmark or Download any reel, song, or naat — or record with Pro Camera — to watch it anytime even without internet.'}
            </p>
            {activeSubTab === 'videos' && (
              <button
                type="button"
                onClick={onOpenUpload}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold shadow-md active:scale-95 transition-transform cursor-pointer"
              >
                Upload First Video
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 [transform:translateZ(0)]">
            {currentGridVideos.map((vid) => {
              const offlineRec = offlineRecordMap.get(vid.id);
              const isOfflinePlayable = Boolean(offlineRec?.mediaBlob || offlineRec?.audioBlob);
              const isAudioOrNaat =
                Boolean(vid.sound?.hasAttachedAudio) ||
                vid.sound?.category === 'naat' ||
                vid.sound?.category === 'song';

              return (
                <div
                  key={vid.id}
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-pink-500/60 transition-all cv-auto-card [transform:translateZ(0)]"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSavedOfflineItem(vid)}
                    className="w-full h-full text-left cursor-pointer block"
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

                    {/* Top Left Tag: Offline / Audio / Mine */}
                    <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start pointer-events-none">
                      {activeSubTab === 'saved' && isOfflinePlayable ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-[8px] sm:text-[9px] font-black text-white uppercase flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>Offline · {formatOfflineBytes(offlineRec?.sizeBytes || 0)}</span>
                        </span>
                      ) : (vid.isUserUploaded ||
                          vid.userId === profile.id ||
                          vid.creator.username.toLowerCase() === profile.username.toLowerCase()) ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-pink-600/90 text-[9px] font-black text-white uppercase">
                          Mine
                        </span>
                      ) : null}

                      {isAudioOrNaat && (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-[8px] font-black text-white uppercase flex items-center gap-0.5">
                          <Music className="w-2.5 h-2.5" />
                          <span>{vid.sound.category === 'naat' ? 'Naat' : 'Audio'}</span>
                        </span>
                      )}
                    </div>

                    {/* Center Hover Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Bottom Overlay Stats: Title/Audio & Views/Likes */}
                    <div className="absolute bottom-1.5 left-2 right-2 space-y-0.5">
                      {activeSubTab === 'saved' && (
                        <p className="text-[10px] font-bold text-white truncate drop-shadow">
                          {vid.title}
                        </p>
                      )}
                      <div className="flex items-end justify-between gap-1">
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
                    </div>
                  </button>

                  {/* Top-right Action Button: Cache/Delete offline in Saved tab OR Insights + Delete in Posts tab */}
                  {activeSubTab === 'saved' ? (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      {!isOfflinePlayable && isOnline && (
                        <button
                          type="button"
                          onClick={(e) => handleCacheForOffline(e, vid)}
                          disabled={cachingPostId === vid.id}
                          className="p-1.5 rounded-lg bg-cyan-600/85 hover:bg-cyan-500 text-white border border-white/20 transition-colors cursor-pointer"
                          title="Save locally for Offline Playback"
                        >
                          <Download className={`w-3 h-3 ${cachingPostId === vid.id ? 'animate-bounce' : ''}`} />
                        </button>
                      )}
                      {offlineRec && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteOfflineCopy(e, vid.id)}
                          className="p-1.5 rounded-lg bg-black/75 hover:bg-rose-600 text-white border border-white/15 transition-colors cursor-pointer"
                          title="Delete offline copy"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInsightsPost(vid);
                        }}
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-pink-600 text-white border border-white/15 transition-colors cursor-pointer"
                        title="View Post Insights & Activity"
                      >
                        <TrendingUp className="w-3 h-3" />
                      </button>
                      {activeSubTab === 'videos' && onDeletePost && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPostPendingDelete(vid);
                          }}
                          className="p-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white border border-rose-300/30 transition-colors cursor-pointer"
                          title="Delete this uploaded post"
                          aria-label="Delete uploaded post"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Developer Attribution Footer */}
        <div className="pt-4">
          <DeveloperCreditBadge variant="modal" showDetails={true} />
        </div>
      </div>

      {/* In-App Delete Uploaded Post Confirmation Modal */}
      {postPendingDelete && (
        <div
          className="fixed inset-0 z-55 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPostPendingDelete(null)}
        >
          <div
            className="w-full max-w-xs bg-neutral-950 border border-rose-500/45 rounded-3xl p-5 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">Delete Uploaded Post?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This will permanently remove &ldquo;{postPendingDelete.title}&rdquo; from your Profile and global feed.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPostPendingDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold border border-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = postPendingDelete.id;
                  setPostPendingDelete(null);
                  onDeletePost?.(targetId);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-In Offline Media Player Modal (Videos, Photos, Songs & Naats) */}
      {offlinePlayerPost && (
        <div
          className={`fixed inset-0 z-55 bg-black/95 flex items-center justify-center animate-in fade-in duration-150 ${
            offlinePlayerFill ? 'p-0' : 'p-3 sm:p-5'
          }`}
          onClick={() => setOfflinePlayerPost(null)}
        >
          <div
            className={`w-full bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl flex flex-col ${
              offlinePlayerFill
                ? 'h-[100dvh] max-w-none rounded-none border-0'
                : 'max-w-md rounded-3xl max-h-[90vh]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[9px] font-black uppercase">
                    {isOnline ? 'Saved Player' : 'Offline Mode Player'}
                  </span>
                  {offlinePlayerPost.sound?.category === 'naat' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-black uppercase">
                      Naat
                    </span>
                  )}
                </div>
                <h3 className="text-xs sm:text-sm font-black text-white truncate mt-1">
                  {offlinePlayerPost.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setOfflinePlayerFill((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    offlinePlayerFill
                      ? 'bg-pink-600 text-white border-pink-400'
                      : 'bg-neutral-900 text-cyan-300 border-neutral-700'
                  }`}
                  title="Toggle Playit-style Stretch Fill Screen"
                >
                  {offlinePlayerFill ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  <span>{offlinePlayerFill ? 'Fit' : 'Fill Screen'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOfflinePlayerFill(false);
                    setOfflinePlayerPost(null);
                  }}
                  className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className={`relative bg-black flex items-center justify-center overflow-hidden ${
                offlinePlayerFill ? 'flex-1 w-full' : 'aspect-[9/14] max-h-[60vh]'
              }`}
            >
              {offlinePlayerPost.mediaType === 'image' ? (
                <img
                  src={offlinePlayerPost.videoUrl}
                  alt={offlinePlayerPost.title}
                  className={`w-full h-full ${offlinePlayerFill ? 'object-cover' : 'object-contain'}`}
                />
              ) : (
                <video
                  src={offlinePlayerPost.videoUrl}
                  poster={offlinePlayerPost.posterUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className={`w-full h-full ${offlinePlayerFill ? 'object-cover' : 'object-contain'}`}
                />
              )}
            </div>

            {offlinePlayerPost.sound?.audioUrl && (
              <div className="px-4 pt-3 bg-neutral-950 shrink-0">
                <audio
                  src={offlinePlayerPost.sound.audioUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-9"
                />
              </div>
            )}

            <div className="p-4 flex items-center justify-between gap-2 bg-neutral-950 border-t border-neutral-800 shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <Music className="w-4 h-4 text-pink-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {offlinePlayerPost.sound?.title || 'Original Audio'}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">
                    @{offlinePlayerPost.creator.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetId = offlinePlayerPost.id;
                  setOfflinePlayerFill(false);
                  setOfflinePlayerPost(null);
                  onPlayVideo(targetId);
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-black shrink-0 cursor-pointer"
              >
                Open in Feed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focused Single-Post Insights Modal */}
      {insightsPost && (
        <PostInsightsModal
          post={insightsPost}
          events={activityEvents}
          onClose={() => setInsightsPost(null)}
          onPlayVideo={(id) => {
            setInsightsPost(null);
            onPlayVideo(id);
          }}
        />
      )}

      {/* Cross-Device Cloud Profile Sync Modal */}
      {isSyncOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsSyncOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Restore Profile Across Devices</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Enter your creator <span className="text-cyan-400 font-bold">@username</span> to load your saved profile, avatar, bio, and all uploaded posts from Supabase cloud storage.
            </p>
            <form onSubmit={handleCloudRestoreSubmit} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={syncUsernameInput}
                  onChange={(e) => setSyncUsernameInput(sanitizeInputLive(e.target.value, 40))}
                  placeholder="jatt_official"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSyncOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold border border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                  <UserIcon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-white">Edit Profile &amp; Channel</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Picker */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <img
                    src={editAvatar || NEON_AVATAR_PRESETS[0]}
                    alt="Avatar Preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-pink-500 bg-neutral-900"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center shadow-md cursor-pointer"
                    title="Upload photo from device"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />

                {/* Preset Quick Avatars */}
                <div className="flex items-center gap-2">
                  {NEON_AVATAR_PRESETS.map((presetUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditAvatar(presetUrl)}
                      className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 cursor-pointer ${
                        editAvatar === presetUrl
                          ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                          : 'border-neutral-700'
                      }`}
                    >
                      <img
                        src={presetUrl}
                        alt={`Preset ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Picture URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300">
                  Profile Picture URL (or upload above)
                </label>
                <input
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(sanitizeInputLive(e.target.value, 500))}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              {/* Display Name (unrestricted custom characters, spaces & emojis) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">Display Name</label>
                  <span className="text-[10px] text-neutral-400">
                    Spaces &amp; emojis allowed · HTML stripped
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(sanitizeInputLive(e.target.value, 80))}
                  placeholder="Enter any custom display name..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              {/* Unique Channel @Username */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">Unique @Username</label>
                  {usernameStatus.checking ? (
                    <span className="text-[10px] font-bold text-neutral-400">Checking...</span>
                  ) : usernameStatus.available ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> @{usernameStatus.normalized} available
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Taken / Invalid
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(sanitizeInputLive(e.target.value, 40))}
                    placeholder="unique_handle"
                    className={`w-full bg-neutral-900 border rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-hidden ${
                      usernameStatus.available
                        ? 'border-neutral-800 focus:border-pink-500'
                        : 'border-rose-500/70 focus:border-rose-400'
                    }`}
                  />
                </div>
                {!usernameStatus.available && usernameStatus.reason && (
                  <p className="text-[11px] text-rose-400 font-medium">{usernameStatus.reason}</p>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300">Creator Bio</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(sanitizeInputLive(e.target.value, 240))}
                  placeholder="Tell viewers about your reels..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold border border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile || !usernameStatus.available}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

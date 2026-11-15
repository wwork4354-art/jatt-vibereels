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
} from 'lucide-react';
import { ActivityEvent, CreatorProfileData, VideoPost } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { uploadMediaToReelsBucket } from '../lib/supabaseService';
import { CreatorActivityView, PostInsightsModal } from './CreatorActivityView';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

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
  onPlayVideo: (videoId: string) => void;
  onOpenUpload: () => void;
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
  onPlayVideo,
  onOpenUpload,
  onBackToFeed,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'videos' | 'saved' | 'liked' | 'activity'>('videos');
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

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const userVideos = videos.filter(
    (v) =>
      v.userId === profile.id ||
      v.isUserUploaded ||
      v.creator.username.toLowerCase() === profile.username.toLowerCase()
  );
  const likedVideos = videos.filter((v) => v.isLiked);
  const savedVideos = videos.filter((v) => v.isSaved);

  const totalOwnViews = userVideos.reduce((sum, v) => sum + (v.stats.views || 0), 0);

  const currentGridVideos =
    activeSubTab === 'videos'
      ? userVideos
      : activeSubTab === 'liked'
      ? likedVideos
      : savedVideos;

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
      const cleanUsername = editUsername
        .trim()
        .replace(/^@+/, '')
        .replace(/\s+/g, '_')
        .toLowerCase();

      let finalAvatarUrl = editAvatar.trim() || NEON_AVATAR_PRESETS[0];
      if (pendingAvatarBlob) {
        const uploadedUrl = await uploadMediaToReelsBucket(
          pendingAvatarBlob,
          'avatars',
          `${cleanUsername || 'avatar'}.jpg`
        );
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        }
      }

      const updated: CreatorProfileData = {
        ...profile,
        name: editName.trim() || 'Jatt Creator',
        username: cleanUsername || 'jatt_official',
        bio: editBio.trim(),
        avatar: finalAvatarUrl,
      };

      onUpdateProfile(updated);
      setIsEditing(false);
      setPendingAvatarBlob(null);
      onShowToast('Profile saved & synced to cloud!');
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
            <span>Edit</span>
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
          <div className="grid grid-cols-4 gap-2 sm:gap-6 py-2.5 px-4 sm:px-6 rounded-2xl bg-neutral-900/80 border border-neutral-800/90">
            <div className="flex flex-col items-center">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {followingCount.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Following</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums">
                {formatCompactCount(profile.baseFollowers)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Followers</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-pink-400 tabular-nums">
                {formatCompactCount(totalProfileLikes)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Likes</span>
            </div>
            <div className="flex flex-col items-center border-l border-neutral-800 pl-2 sm:pl-4">
              <span className="text-sm sm:text-lg font-black text-cyan-400 tabular-nums">
                {formatCompactCount(totalOwnViews)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 font-semibold">Views</span>
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
            <Bookmark className="w-4 h-4 shrink-0" />
            <span>Saved ({savedVideos.length})</span>
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
                <Bookmark className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-sm font-bold text-white">
              {activeSubTab === 'videos'
                ? 'No uploaded or recorded videos yet'
                : activeSubTab === 'liked'
                ? 'No liked reels yet'
                : 'No saved reels yet'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              {activeSubTab === 'videos'
                ? 'Tap the (+) camera button below or Upload / Record to share your first vertical reel permanently!'
                : activeSubTab === 'liked'
                ? 'Tap the Heart icon on any reel in the feed and it will appear here.'
                : 'Tap the Bookmark icon on any reel in the feed to keep it in Saved Videos.'}
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
            {currentGridVideos.map((vid) => (
              <div
                key={vid.id}
                className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-pink-500/60 transition-all cv-auto-card [transform:translateZ(0)]"
              >
                <button
                  type="button"
                  onClick={() => onPlayVideo(vid.id)}
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

                  {/* Top Upload Tag */}
                  {(vid.isUserUploaded ||
                    vid.userId === profile.id ||
                    vid.creator.username.toLowerCase() === profile.username.toLowerCase()) && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-pink-600/90 text-[9px] font-black text-white uppercase">
                      Mine
                    </span>
                  )}

                  {/* Center Hover Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Bottom Overlay Stats: Views & Likes */}
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

                {/* Post Insights Trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInsightsPost(vid);
                  }}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/70 hover:bg-pink-600 text-white border border-white/15 transition-colors cursor-pointer"
                  title="View Post Insights & Activity"
                >
                  <TrendingUp className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Developer Attribution Footer */}
        <div className="pt-4">
          <DeveloperCreditBadge variant="modal" showDetails={true} />
        </div>
      </div>

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
                  onChange={(e) => setSyncUsernameInput(e.target.value)}
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
                <h3 className="text-base font-black text-white">Edit Creator Profile</h3>
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
                  accept="image/*"
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
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300">Username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300">Creator Bio</label>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
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
                  disabled={isSavingProfile}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

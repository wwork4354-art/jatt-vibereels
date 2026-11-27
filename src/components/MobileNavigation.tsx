import React, { useState, useRef } from 'react';
import {
  Home,
  Compass,
  Plus,
  User,
  Shield,
  Radio,
  Camera,
  Film,
  X,
  LogOut,
  Sparkles,
  Bell,
  Search,
  CheckCircle2,
  ArrowRight,
  Music,
  Play,
  Pause,
  Image as ImageIcon,
  Send,
  Wand2,
  Youtube,
  Sliders,
  Zap,
  Menu,
  ArrowLeftRight,
  MessageCircle,
} from 'lucide-react';
import { useRamSaverMode } from '../lib/ramSaverMode';
import {
  FeedTab,
  UserAccount,
  VideoPost,
  CreatorProfileData,
  AudioTrackOption,
} from '../types';
import { BRAND_LOGO_SRC } from './TopBar';
import {
  BRAND_CONFIG,
  BRAND_LOGO_SVG_DATA_URI,
  BUNDLED_BRAND_LOGO_FALLBACK,
  useBrandLogo,
} from '../config/brandConfig';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { advancedSearchAll, AdvancedSearchResults } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { soundEngine } from '../utils/soundEngine';
import { PWAInstallButton } from './PWAInstallButton';
import { isMainAdminAccount } from '../data/mockUsers';
import { sanitizeSearchQuery, validateSafeMediaFile } from '../utils/security';
import { VideoThumbnail } from './VideoThumbnail';

interface MobileNavigationProps {
  currentTab: FeedTab;
  onSelectTab: (tab: FeedTab) => void;
  onOpenUpload: () => void;
  onOpenTrends: () => void;
  onOpenCreatorSearch?: () => void;
  videos?: VideoPost[];
  ownProfile?: CreatorProfileData;
  onSelectCreator?: (username: string) => void;
  onPlayVideo?: (videoId: string) => void;
  onOpenLive: () => void;
  onOpenProCamera: () => void;
  onOpenEditor?: () => void;
  onOpenAIStudio?: () => void;
  onQuickVideoUpload?: (file: File, source?: 'live' | 'gallery') => void;
  savedCount: number;
  unreadActivityCount?: number;
  onOpenDirectSnaps?: () => void;
  unreadDirectSnapsCount?: number;
  currentUser: UserAccount | null;
  creatorAvatar?: string;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
  onLogout?: () => void;
  onShowToast?: (msg: string) => void;
  isBottomNavOpen: boolean;
  onToggleBottomNav: () => void;
  feedControlsSide?: 'left' | 'right';
  onToggleFeedControlsSide?: () => void;
}

const MobileNavigationComponent: React.FC<MobileNavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenTrends,
  onOpenCreatorSearch,
  videos = [],
  ownProfile,
  onSelectCreator,
  onPlayVideo,
  onOpenLive,
  onOpenProCamera,
  onOpenEditor,
  onOpenAIStudio,
  onQuickVideoUpload,
  savedCount,
  unreadActivityCount = 0,
  onOpenDirectSnaps,
  unreadDirectSnapsCount = 0,
  currentUser,
  creatorAvatar,
  onOpenLogin,
  onOpenRegister,
  onOpenAdmin,
  onLogout,
  onShowToast,
  isBottomNavOpen,
  onToggleBottomNav,
  feedControlsSide = 'left',
  onToggleFeedControlsSide,
}) => {
  const { isRamSaverMode, toggleRamSaverMode } = useRamSaverMode();
  const activeLogoSrc = useBrandLogo();
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSearchResults, setMobileSearchResults] = useState<AdvancedSearchResults>({
    creators: [],
    posts: [],
    audioTracks: [],
  });
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  // Dual upload inputs:
  // Option 1: Record live video right now using phone camera (capture="environment")
  const liveRecordInputRef = useRef<HTMLInputElement | null>(null);
  // Option 2: Choose from phone mobile gallery / file manager (WITHOUT capture)
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!isMobileSearchOpen || !ownProfile) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await advancedSearchAll(mobileSearchQuery, videos, ownProfile);
      if (!cancelled) {
        setMobileSearchResults({
          creators: res.creators.slice(0, 3),
          posts: res.posts.slice(0, 3),
          audioTracks: res.audioTracks.slice(0, 3),
        });
      }
    }, mobileSearchQuery ? 120 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMobileSearchOpen, mobileSearchQuery, videos, ownProfile]);

  const handleToggleMobileTrack = (track: AudioTrackOption) => {
    if (previewTrackId === track.id) {
      soundEngine.stopPreviewTrack();
      setPreviewTrackId(null);
    } else {
      soundEngine.playPreviewTrack(track.trackType, 0.85);
      setPreviewTrackId(track.id);
    }
  };

  const handleVideoFileSelected = (e: React.ChangeEvent<HTMLInputElement>, source: 'live' | 'gallery') => {
    const file = e.target.files?.[0];
    if (file) {
      const check = validateSafeMediaFile(file);
      if (!check.valid) {
        setIsUploadSheetOpen(false);
        onShowToast?.(
          check.reason ||
            'Blocked unsafe file. Only .mp4, .webm, .jpg, .png, and .webp are allowed.'
        );
        e.target.value = '';
        return;
      }
      setIsUploadSheetOpen(false);
      onQuickVideoUpload?.(file, source);
    }
    e.target.value = '';
  };


  return (
    <>
      {/* Mobile Top Header (Notch/Status-bar safe + 100% viewport fit + Zero right-edge clipping) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 w-full max-w-full overflow-x-hidden bg-neutral-950/95 border-b border-neutral-800/80 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1.5 px-1.5 min-[420px]:px-3 flex flex-col gap-1">
        {/* Top Row: Swappable Profile/Logout cluster & Brand Logo with compact utility strip */}
        {(() => {
          const isLeftHeaderProfile = feedControlsSide === 'left';

          const brandLogoNode = (
            <div className="flex items-center shrink-0">
              <img
                src={activeLogoSrc || BRAND_LOGO_SRC || BUNDLED_BRAND_LOGO_FALLBACK}
                alt={BRAND_CONFIG.appName}
                loading="eager"
                decoding="sync"
                onError={(e) => {
                  const stage = e.currentTarget.dataset.fallbackStage || '0';
                  if (stage === '0') {
                    e.currentTarget.dataset.fallbackStage = '1';
                    e.currentTarget.src = BUNDLED_BRAND_LOGO_FALLBACK;
                  } else if (stage === '1') {
                    e.currentTarget.dataset.fallbackStage = '2';
                    e.currentTarget.src = BRAND_LOGO_SVG_DATA_URI;
                  }
                }}
                className="h-6 min-[420px]:h-7 w-auto max-w-[54px] min-[375px]:max-w-[66px] min-[420px]:max-w-[92px] object-contain bg-black rounded-md px-0.5 shrink-0"
              />
            </div>
          );

          const utilityIconsNode = (
            <div className="flex items-center gap-0.5 min-[420px]:gap-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  const next = toggleRamSaverMode();
                  onShowToast?.(
                    next
                      ? 'Lite / RAM Saver Mode ON (3GB RAM Optimized)'
                      : 'Lite / RAM Saver Mode OFF (Full Visuals)'
                  );
                }}
                className={`px-1 py-0.5 min-[420px]:px-1.5 min-[420px]:py-1 rounded-lg border text-[9px] min-[420px]:text-[10px] font-black flex items-center gap-0.5 shrink-0 cursor-pointer ${
                  isRamSaverMode
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
                title="Toggle Lite / RAM Saver Mode for 3GB RAM Android devices"
                aria-label="Toggle Lite RAM Saver Mode"
              >
                <Zap className="w-2.5 h-2.5 min-[420px]:w-3 min-[420px]:h-3 shrink-0" />
                <span className="hidden min-[360px]:inline">
                  {isRamSaverMode ? 'Lite' : 'RAM'}
                </span>
              </button>
              <div className="shrink-0">
                <PWAInstallButton variant="mobile-header" />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                className={`p-1 min-[420px]:p-1.5 rounded-lg border shrink-0 transition-colors ${
                  isMobileSearchOpen
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-800 text-cyan-400 hover:text-white'
                }`}
                title="Search User ID (@username) or Creator Name"
                aria-label="Search Creators"
              >
                {isMobileSearchOpen ? (
                  <X className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                ) : (
                  <Search className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                )}
              </button>
              {onOpenDirectSnaps && (
                <button
                  type="button"
                  onClick={onOpenDirectSnaps}
                  className="relative p-1 min-[420px]:p-1.5 rounded-lg border shrink-0 bg-neutral-900 border-pink-500/40 text-pink-300 hover:text-white cursor-pointer"
                  title="Messages / Inbox"
                  aria-label="Messages"
                >
                  <MessageCircle className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                  {unreadDirectSnapsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[13px] h-3.5 px-0.5 rounded-full bg-pink-500 text-white text-[8px] font-black flex items-center justify-center tabular-nums">
                      {unreadDirectSnapsCount > 99 ? '99+' : unreadDirectSnapsCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectTab('activity')}
                className={`relative p-1 min-[420px]:p-1.5 rounded-lg border shrink-0 transition-colors ${
                  currentTab === 'activity'
                    ? 'bg-pink-600/25 border-pink-500/50 text-pink-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
                title="Notifications & Activity"
                aria-label="Activity"
              >
                <Bell className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                {unreadActivityCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[13px] h-3.5 px-0.5 rounded-full bg-pink-500 text-white text-[8px] font-black flex items-center justify-center">
                    {unreadActivityCount > 9 ? '9+' : unreadActivityCount}
                  </span>
                )}
              </button>
            </div>
          );

          const profileAuthClusterNode = !currentUser ? (
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-2 py-0.5 min-[420px]:px-2.5 min-[420px]:py-1 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 text-white rounded-lg text-[9.5px] min-[420px]:text-[10px] font-black border border-pink-400/50 shadow-md shadow-pink-600/25 active:scale-95 shrink-0 cursor-pointer"
            >
              Log In
            </button>
          ) : (
            <div className="flex items-center gap-0.5 min-[420px]:gap-1 shrink-0">
              {isMainAdminAccount(currentUser) && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="p-1 min-[420px]:p-1.5 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-xs shrink-0 cursor-pointer"
                  title="Admin Panel"
                  aria-label="Admin Panel"
                >
                  <Shield className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileProfileOpen(true)}
                className="relative rounded-full ring-2 ring-pink-500/60 p-0.5 active:scale-95 transition-transform shrink-0 cursor-pointer"
                title="Open Profile & Logout Menu"
                aria-label="Open Profile Menu"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  loading="lazy"
                  decoding="async"
                  className="w-5.5 h-5.5 min-[420px]:w-7 min-[420px]:h-7 rounded-full object-cover bg-neutral-800"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-neutral-950" />
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1 min-[420px]:p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-500/20 border border-neutral-800 hover:border-rose-500/40 text-rose-400 shrink-0 cursor-pointer active:scale-95 transition-colors"
                  title="Log Out"
                  aria-label="Log Out"
                >
                  <LogOut className="w-3 h-3 min-[420px]:w-3.5 min-[420px]:h-3.5" />
                </button>
              )}
            </div>
          );

          return (
            <div className="flex items-center justify-between gap-1 min-[420px]:gap-1.5 w-full max-w-full min-w-0">
              {isLeftHeaderProfile ? (
                <>
                  {profileAuthClusterNode}
                  <div className="flex items-center gap-1 min-[420px]:gap-1.5 min-w-0 flex-1 justify-end">
                    {utilityIconsNode}
                    {brandLogoNode}
                  </div>
                </>
              ) : (
                <>
                  {brandLogoNode}
                  <div className="flex items-center gap-1 min-[420px]:gap-1.5 min-w-0 flex-1 justify-end">
                    {utilityIconsNode}
                    {profileAuthClusterNode}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Lower Compact Tabs Row: LIVE / Following / For You / MOVIX / AI / Menu (100% visible on mobile without clipping Menu) */}
        <nav
          aria-label="Feed feeds"
          className="w-full max-w-full overflow-x-auto no-scrollbar pt-0.5 pb-0.5"
        >
          <div className="flex items-center justify-between min-[420px]:justify-center gap-0.5 min-[375px]:gap-1 min-[420px]:gap-2 sm:gap-3 w-full min-w-max mx-auto px-0.5">
            <button
              type="button"
              onClick={onOpenLive}
              className={`flex items-center gap-0.5 min-[400px]:gap-1 px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9px] min-[390px]:text-[10px] font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                currentTab === 'live'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/35 border border-red-400'
                  : 'bg-red-600/20 border border-red-500/40 text-red-400'
              }`}
              title="Open TikTok-style Live Stream"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <Radio className="w-2.5 h-2.5 shrink-0" />
              <span>Live</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('following')}
              className={`px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9.5px] min-[390px]:text-[10.5px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                currentTab === 'following'
                  ? 'bg-white/15 text-white border border-white/30'
                  : 'text-neutral-400 hover:text-white border border-transparent'
              }`}
            >
              Following
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('foryou')}
              className={`px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9.5px] min-[390px]:text-[10.5px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                currentTab === 'foryou'
                  ? 'bg-white/15 text-white border border-white/30'
                  : 'text-neutral-400 hover:text-white border border-transparent'
              }`}
            >
              For You
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('downloads')}
              className={`flex items-center gap-0.5 min-[400px]:gap-1 px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9px] min-[390px]:text-[10px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                currentTab === 'downloads'
                  ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white shadow-sm border border-cyan-400'
                  : 'bg-cyan-600/15 border border-cyan-500/30 text-cyan-300'
              }`}
              title="Open MOVIX (Movie Box)"
            >
              <Film className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span>MOVIX</span>
            </button>

            {onOpenAIStudio && (
              <button
                type="button"
                onClick={onOpenAIStudio}
                className="flex items-center gap-0.5 min-[400px]:gap-1 px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9px] min-[390px]:text-[10px] font-black whitespace-nowrap shrink-0 transition-all cursor-pointer bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-400/45 text-cyan-200 hover:text-white"
                title="Open AI Image & Video Studio"
              >
                <Sparkles className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                <span>AI</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleBottomNav}
              aria-expanded={isBottomNavOpen}
              aria-label={isBottomNavOpen ? 'Hide bottom navigation menu' : 'Show bottom navigation menu'}
              title={isBottomNavOpen ? 'Hide Navigation Bar' : 'Open Bottom Menu'}
              className={`flex items-center gap-0.5 min-[400px]:gap-1 px-1.5 min-[400px]:px-2 py-0.5 rounded-full text-[9px] min-[390px]:text-[10px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                isBottomNavOpen
                  ? 'bg-pink-600 border-pink-400 text-white shadow-sm shadow-pink-600/30'
                  : 'bg-neutral-900 border-neutral-700/80 text-neutral-200 hover:text-white'
              }`}
            >
              {isBottomNavOpen ? <X className="w-2.5 h-2.5 shrink-0" /> : <Menu className="w-2.5 h-2.5 text-pink-400 shrink-0" />}
              <span>{isBottomNavOpen ? 'Hide' : 'Menu'}</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Expandable Top Creator ID & Name Search Bar */}
      {isMobileSearchOpen && (
        <div className="lg:hidden fixed top-[calc(4.6rem+env(safe-area-inset-top))] left-0 right-0 z-40 bg-neutral-950/98 border-b border-neutral-800 p-3 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(sanitizeSearchQuery(e.target.value, 120))}
                placeholder="Search @ID, user, video, or song..."
                className="w-full bg-neutral-900 text-xs text-white placeholder-neutral-400 pl-8.5 pr-8 py-2 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-pink-500"
              />
              {mobileSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMobileSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {onOpenCreatorSearch && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.stopPreviewTrack();
                  setPreviewTrackId(null);
                  setIsMobileSearchOpen(false);
                  onOpenCreatorSearch();
                }}
                className="px-2.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                <span>All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-neutral-900 rounded-xl border border-neutral-800/80 bg-neutral-900/50">
            {mobileSearchResults.creators.length === 0 &&
            mobileSearchResults.posts.length === 0 &&
            mobileSearchResults.audioTracks.length === 0 ? (
              <p className="py-3 text-center text-xs text-neutral-400">
                No users, videos, or songs matched &ldquo;{mobileSearchQuery}&rdquo;
              </p>
            ) : (
              <>
                {mobileSearchResults.creators.length > 0 && (
                  <div>
                    <div className="px-3 py-1 bg-neutral-950/70 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                      Users &amp; IDs
                    </div>
                    {mobileSearchResults.creators.map((channel) => (
                      <div
                        key={channel.username}
                        onClick={() => {
                          soundEngine.stopPreviewTrack();
                          setPreviewTrackId(null);
                          setIsMobileSearchOpen(false);
                          setMobileSearchQuery('');
                          onSelectCreator?.(channel.username);
                        }}
                        className="px-3 py-2 flex items-center justify-between gap-2 active:bg-neutral-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={optimizeThumbnailUrl(channel.avatar, 'grid')}
                            alt={channel.name}
                            loading="lazy"
                            decoding="async"
                            className="w-8 h-8 rounded-full object-cover bg-neutral-800 border border-pink-500/40 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-white truncate">
                                {channel.name}
                              </span>
                              {channel.isVerified && (
                                <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-cyan-400 truncate">@{channel.username}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundEngine.stopPreviewTrack();
                            setPreviewTrackId(null);
                            setIsMobileSearchOpen(false);
                            setMobileSearchQuery('');
                            onSelectCreator?.(channel.username);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[10px] font-black shrink-0"
                        >
                          View Profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {mobileSearchResults.posts.length > 0 && (
                  <div>
                    <div className="px-3 py-1 bg-neutral-950/70 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                      Videos &amp; Photos
                    </div>
                    {mobileSearchResults.posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          soundEngine.stopPreviewTrack();
                          setPreviewTrackId(null);
                          setIsMobileSearchOpen(false);
                          setMobileSearchQuery('');
                          onPlayVideo?.(post.id);
                        }}
                        className="px-3 py-2 flex items-center justify-between gap-2 active:bg-neutral-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700/80 shrink-0 relative">
                            <VideoThumbnail
                              videoUrl={post.videoUrl}
                              posterUrl={post.posterUrl}
                              mediaType={post.mediaType}
                              title={post.title}
                              mode="grid"
                              fallbackGradient={post.fallbackGradient}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white">
                              {post.mediaType === 'image' ? (
                                <ImageIcon className="w-2.5 h-2.5" />
                              ) : (
                                <Play className="w-2.5 h-2.5 fill-current" />
                              )}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{post.title}</p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              @{post.creator.username}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold shrink-0">
                          Watch
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {mobileSearchResults.audioTracks.length > 0 && (
                  <div>
                    <div className="px-3 py-1 bg-neutral-950/70 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                      Songs &amp; Naats
                    </div>
                    {mobileSearchResults.audioTracks.map((track) => {
                      const isPlaying = previewTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => handleToggleMobileTrack(track)}
                          className="px-3 py-2 flex items-center justify-between gap-2 active:bg-neutral-800"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-500/35 text-pink-300 flex items-center justify-center shrink-0">
                              {isPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Music className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {track.artist}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-pink-500/15 text-pink-300 border border-pink-500/30 text-[10px] font-bold shrink-0">
                            {isPlaying ? 'Playing' : 'Play'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


      {/* Collapsible Mobile Bottom Tab Bar */}
      <nav
        aria-hidden={!isBottomNavOpen}
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-neutral-950/95 border-t border-neutral-800/80 px-1 py-1.5 flex items-center justify-between gap-0.5 pb-safe transition-[transform,opacity] duration-200 ease-out ${
          isBottomNavOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectTab('foryou')}
          className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 min-h-[44px] justify-center transition-colors cursor-pointer ${
            currentTab === 'foryou' ? 'text-pink-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Home className="w-[18px] h-[18px] shrink-0" />
          <span className="text-[9.5px] leading-tight truncate max-w-full">Home</span>
        </button>

        <button
          type="button"
          onClick={onOpenTrends}
          className="flex-1 min-w-0 flex flex-col items-center gap-0.5 min-h-[44px] justify-center transition-colors text-amber-400 hover:text-amber-300 active:scale-95 cursor-pointer"
        >
          <Compass className="w-[18px] h-[18px] text-amber-400 shrink-0" />
          <span className="text-[9.5px] leading-tight font-bold text-amber-300 truncate max-w-full">
            Trends
          </span>
        </button>

        {/* Option 1: Live Photo/Video Camera Recording with capture="environment" */}
        <input
          ref={liveRecordInputRef}
          type="file"
          accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          style={{ display: 'none' }}
          onChange={(e) => handleVideoFileSelected(e, 'live')}
        />

        {/* Option 2: Choose Video or Image from Mobile Gallery WITHOUT capture attribute */}
        <input
          ref={galleryInputRef}
          type="file"
          accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
          className="hidden"
          style={{ display: 'none' }}
          onChange={(e) => handleVideoFileSelected(e, 'gallery')}
        />

        {/* Central Camera (+) Button: Opens clean Bottom Sheet Menu with Dual Upload Options */}
        <button
          type="button"
          onClick={() => setIsUploadSheetOpen(true)}
          className="relative shrink-0 flex items-center justify-center px-1 py-1 active:scale-90 transition-transform group cursor-pointer"
          aria-label="Upload or Record Reel"
          title="Create Reel: Record Live Video or Choose from Gallery"
        >
          {/* Outer Breathing Neon Halo */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500/40 via-purple-600/40 to-cyan-400/40 blur-xs group-hover:scale-110 transition-transform animate-pulse" />

          {/* Heavy Bezel Shutter */}
          <div className="relative w-11 h-8 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-pink-600/50 flex items-center justify-center border border-pink-300/40">
            <div className="w-full h-full bg-black/40 rounded-[9px] flex items-center justify-center gap-0.5 text-white">
              <Camera className="w-3.5 h-3.5 text-white group-hover:text-pink-200 transition-colors" />
              <Plus className="w-3 h-3 stroke-[3] text-pink-300" />
            </div>
          </div>
        </button>

        {/* Global YouTube / Movies & Dramas Hub Tab (right next to Templates) */}
        <button
          type="button"
          onClick={() => onSelectTab('downloads')}
          className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 min-h-[44px] justify-center transition-colors cursor-pointer ${
            currentTab === 'downloads'
              ? 'text-red-400 font-bold'
              : 'text-neutral-300 hover:text-white'
          }`}
          title="YouTube, Movies, Dramas & Songs Hub"
        >
          <Youtube
            className={`w-[18px] h-[18px] shrink-0 ${
              currentTab === 'downloads' ? 'text-red-400' : 'text-rose-400'
            }`}
          />
          <span className="text-[9.5px] leading-tight truncate max-w-full">YouTube</span>
        </button>

        {/* Dedicated CapCut-Style Video & Photo Templates Tab Button (Right beside YouTube) */}
        <button
          type="button"
          onClick={() => onSelectTab('templates')}
          className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 min-h-[44px] justify-center transition-colors cursor-pointer ${
            currentTab === 'templates' ? 'text-pink-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
          title="Video & Photo Templates Studio"
        >
          <Wand2
            className={`w-[18px] h-[18px] shrink-0 ${
              currentTab === 'templates' ? 'text-pink-400' : 'text-cyan-400'
            }`}
          />
          <span className="text-[9.5px] leading-tight truncate max-w-full">Templates</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className={`relative flex-1 min-w-0 flex flex-col items-center gap-0.5 min-h-[44px] justify-center transition-colors cursor-pointer ${
            currentTab === 'profile' ? 'text-pink-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
          title="Creator Profile & Uploaded Videos"
        >
          {creatorAvatar || currentUser?.avatar ? (
            <img
              src={currentUser?.avatar || creatorAvatar}
              alt="Profile"
              loading="lazy"
              decoding="async"
              className={`w-[18px] h-[18px] rounded-full object-cover border shrink-0 ${
                currentTab === 'profile' ? 'border-pink-400 ring-2 ring-pink-500/30' : 'border-neutral-600'
              }`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-[18px] h-[18px] shrink-0" />
          )}
          <span className="text-[9.5px] leading-tight truncate max-w-full">Profile</span>
          {savedCount > 0 && currentTab !== 'profile' && (
            <span className="absolute top-1.5 right-2.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
          )}
        </button>
      </nav>

      {/* Mobile Profile & Developer Attribution Modal */}
      {isMobileProfileOpen && currentUser && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setIsMobileProfileOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 rounded-2xl object-cover bg-neutral-900 border-2 border-pink-500/50"
                />
                <div>
                  <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
                  <p className="text-xs text-neutral-400">@{currentUser.username}</p>
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    {currentUser.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileProfileOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* App Creator Attribution Badge */}
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1.5">
                Application Creator
              </p>
              <DeveloperCreditBadge variant="modal" showDetails={true} />
            </div>

            {/* Actions */}
            <div className="pt-1 flex flex-col gap-2">
              <PWAInstallButton variant="menu" />
              {onToggleFeedControlsSide && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleFeedControlsSide();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/35 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>
                    Swap Header &amp; Feed Controls (
                    {feedControlsSide === 'left' ? 'Move to Right' : 'Move to Left'})
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsMobileProfileOpen(false);
                  onSelectTab('profile');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Open Creator Profile</span>
              </button>
              {isMainAdminAccount(currentUser) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileProfileOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>Open Admin Panel</span>
                </button>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-800 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* UPLOAD & CAMERA OPTIONS BOTTOM SHEET MENU                 */}
      {/* ========================================================= */}
      {isUploadSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsUploadSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-150 pb-safe [transform:translateZ(0)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Header */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-1 bg-neutral-700 rounded-full mb-3" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Create New Reel</h3>
                    <p className="text-[11px] text-neutral-400">Record HD 60fps with filters or upload</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadSheetOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Distinct 3 Primary Create Options: Choose Gallery | Choose Camera | Edit */}
            <div className="space-y-2.5 pt-1">
              {/* Option 1: Choose Gallery */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  galleryInputRef.current?.click();
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20 hover:from-cyan-600/30 hover:to-purple-600/30 border border-cyan-500/45 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-cyan-600/10 cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/40 group-hover:scale-105 transition-transform">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                      Choose Gallery
                    </span>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Pick photo or video + add TikTok-style music
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Gallery
                </span>
              </button>

              {/* Option 2: Choose Camera (4K/1080p 60FPS Live Camera) */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  onOpenProCamera();
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-pink-600/20 via-rose-600/20 to-amber-500/20 hover:from-pink-600/30 hover:to-amber-500/30 border border-pink-500/45 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-pink-600/10 cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-pink-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-pink-600/40 group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white group-hover:text-pink-300 transition-colors">
                      Choose Camera
                    </span>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Launch instant 4K/60fps Pro Camera with filters
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/35">
                  4K 60fps
                </span>
              </button>

              {/* Option 3: Edit (Built-in Photo & Video Editor) */}
              {onOpenEditor && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadSheetOpen(false);
                    onOpenEditor();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-amber-500/20 hover:from-purple-600/30 hover:to-amber-500/30 border border-purple-500/45 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-purple-600/10 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-purple-600/40 group-hover:scale-105 transition-transform">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                        Edit
                      </span>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Trim video, apply filters, overlays, masks &amp; music
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/35">
                    Studio
                  </span>
                </button>
              )}

              {/* Option 4: AI Image & Video Studio */}
              {onOpenAIStudio && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadSheetOpen(false);
                    onOpenAIStudio();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-pink-500/20 to-amber-500/20 hover:from-cyan-500/30 hover:to-amber-500/30 border border-cyan-400/45 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-cyan-600/10 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 via-pink-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-cyan-600/40 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                        AI Image &amp; Video
                      </span>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Generate crisp AI images or cinematic AI videos
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/35">
                    Dual AI
                  </span>
                </button>
              )}

              {/* Optional secondary links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadSheetOpen(false);
                    onOpenUpload();
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-pink-300 hover:text-white border border-pink-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-pink-400" />
                  <span>Paste URL / Post</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadSheetOpen(false);
                    liveRecordInputRef.current?.click();
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Phone Camera</span>
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => setIsUploadSheetOpen(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const MobileNavigation = React.memo(MobileNavigationComponent);


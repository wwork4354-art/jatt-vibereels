import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  LogIn,
  UserPlus,
  Shield,
  LogOut,
  Flame,
  Radio,
  Camera,
  Film,
  ChevronDown,
  User,
  Bell,
  Search,
  X,
  CheckCircle2,
  ArrowRight,
  Music,
  Play,
  Pause,
  Image as ImageIcon,
  Send,
  Sliders,
  Zap,
  ArrowLeftRight,
} from 'lucide-react';
import { useRamSaverMode } from '../lib/ramSaverMode';
import { UserAccount, VideoPost, CreatorProfileData, AudioTrackOption } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { advancedSearchAll, AdvancedSearchResults } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../utils/soundEngine';
import { isMainAdminAccount } from '../data/mockUsers';
import { sanitizeSearchQuery } from '../utils/security';

/**
 * PLACEHOLDER: Replace this URL or path with your custom logo image.
 * Examples: "https://your-domain.com/my-logo.png" or "/assets/logo.png"
 */
export const BRAND_LOGO_SRC = "/src/assets/images/jatt_vibereels_neon_logo.png"; // <-- PASTE YOUR LOGO IMAGE SRC HERE

interface TopBarProps {
  currentUser: UserAccount | null;
  videos?: VideoPost[];
  ownProfile?: CreatorProfileData;
  onSelectCreator?: (username: string) => void;
  onPlayVideo?: (videoId: string) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenUpload: () => void;
  onOpenTrends: () => void;
  onOpenLive: () => void;
  onOpenDownloads?: () => void;
  onOpenProCamera?: () => void;
  onOpenEditor?: () => void;
  onOpenAdmin: () => void;
  onOpenProfile?: () => void;
  onOpenCreatorSearch?: () => void;
  onOpenActivity?: () => void;
  unreadActivityCount?: number;
  onOpenDirectSnaps?: () => void;
  unreadDirectSnapsCount?: number;
  onLogout: () => void;
  onShowToast?: (msg: string) => void;
  currentTab?: string;
  feedControlsSide?: 'left' | 'right';
  onToggleFeedControlsSide?: () => void;
}

const TopBarComponent: React.FC<TopBarProps> = ({
  currentUser,
  videos = [],
  ownProfile,
  onSelectCreator,
  onPlayVideo,
  onOpenLogin,
  onOpenRegister,
  onOpenUpload,
  onOpenTrends,
  onOpenLive,
  onOpenDownloads,
  onOpenProCamera,
  onOpenEditor,
  onOpenAdmin,
  onOpenProfile,
  onOpenCreatorSearch,
  onOpenActivity,
  unreadActivityCount = 0,
  onOpenDirectSnaps,
  unreadDirectSnapsCount = 0,
  onLogout,
  onShowToast,
  currentTab,
  feedControlsSide = 'left',
  onToggleFeedControlsSide,
}) => {
  const { isRamSaverMode, toggleRamSaverMode } = useRamSaverMode();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<AdvancedSearchResults>({
    creators: [],
    posts: [],
    audioTracks: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instant live search across @IDs, creators, videos & songs
  useEffect(() => {
    if (!isSearchOpen || !ownProfile) return;
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await advancedSearchAll(searchQuery, videos, ownProfile);
        if (!cancelled) {
          setSearchResults({
            creators: res.creators.slice(0, 4),
            posts: res.posts.slice(0, 4),
            audioTracks: res.audioTracks.slice(0, 3),
          });
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, searchQuery ? 120 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, searchQuery, videos, ownProfile]);

  const handleOpenCreator = (username: string) => {
    soundEngine.stopPreviewTrack();
    setPreviewTrackId(null);
    setIsSearchOpen(false);
    setSearchQuery('');
    if (onSelectCreator) {
      onSelectCreator(username);
    } else {
      onOpenCreatorSearch?.();
    }
  };

  const handleOpenPost = (videoId: string) => {
    soundEngine.stopPreviewTrack();
    setPreviewTrackId(null);
    setIsSearchOpen(false);
    setSearchQuery('');
    onPlayVideo?.(videoId);
  };

  const handleToggleTrackPreview = (track: AudioTrackOption) => {
    if (previewTrackId === track.id) {
      soundEngine.stopPreviewTrack();
      setPreviewTrackId(null);
    } else {
      soundEngine.playPreviewTrack(track.trackType, 0.85);
      setPreviewTrackId(track.id);
    }
  };

  const hasAnyResults =
    searchResults.creators.length > 0 ||
    searchResults.posts.length > 0 ||
    searchResults.audioTracks.length > 0;

  const isProfileOnLeft = feedControlsSide === 'left';

  const profileAuthCluster = !currentUser ? (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onOpenLogin}
        className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-pink-600/25 via-purple-600/20 to-cyan-500/25 hover:from-pink-600/40 hover:to-cyan-500/40 text-white border border-pink-500/50 hover:border-pink-400 shadow-md shadow-pink-600/20 active:scale-95 text-xs font-black transition-all group cursor-pointer"
        title="Sign In to your Account"
      >
        <LogIn className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
        <span>Log In</span>
      </button>
      <button
        type="button"
        onClick={onOpenRegister}
        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold border border-neutral-700/80 transition-all active:scale-95 cursor-pointer"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Register</span>
      </button>
    </div>
  ) : (
    <div className="relative shrink-0" ref={profileMenuRef}>
      <div className="flex items-center gap-2">
        {isMainAdminAccount(currentUser) && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/35 text-pink-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="Open user management admin panel"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/40 transition-all active:scale-95 cursor-pointer"
          title="View user profile & logout menu"
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            loading="lazy"
            decoding="async"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover bg-neutral-800 border border-pink-500/40"
            referrerPolicy="no-referrer"
          />
          <div className="hidden sm:flex flex-col text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-white max-w-[90px] truncate">
                {currentUser.name}
              </span>
              <span
                className={`text-[8px] font-black uppercase px-1 py-0.2 rounded-xs ${
                  currentUser.role === 'admin'
                    ? 'bg-pink-500/20 text-pink-400'
                    : currentUser.role === 'creator'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {currentUser.role}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 leading-none">
              @{currentUser.username}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="p-1.5 sm:p-2 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {isProfileMenuOpen && (
        <div
          className={`absolute ${
            isProfileOnLeft ? 'left-0' : 'right-0'
          } top-full mt-2 w-72 sm:w-80 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3.5 [transform:translateZ(0)]`}
        >
          <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              loading="lazy"
              decoding="async"
              className="w-11 h-11 rounded-xl object-cover bg-neutral-900 border border-neutral-700"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
              <p className="text-xs text-neutral-400 truncate">@{currentUser.username}</p>
              <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                {currentUser.role} account
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1.5">
              Application Credits
            </p>
            <DeveloperCreditBadge variant="menu" showDetails={true} />
          </div>

          <div className="pt-1 flex flex-col gap-1.5">
            <PWAInstallButton variant="menu" />
            {onToggleFeedControlsSide && (
              <button
                type="button"
                onClick={onToggleFeedControlsSide}
                className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>
                  Swap Header &amp; Feed Controls (
                  {feedControlsSide === 'left' ? 'Move to Right' : 'Move to Left'})
                </span>
              </button>
            )}
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Creator Profile &amp; Videos</span>
              </button>
            )}
            {isMainAdminAccount(currentUser) && (
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="w-full py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Management Console</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen(false);
                onLogout();
              }}
              className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-xs font-bold flex items-center justify-between border border-neutral-800 transition-colors cursor-pointer"
            >
              <span>Log Out</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 bg-neutral-950/95 border-b border-neutral-800/80 px-4 sm:px-6 py-2.5 items-center justify-between gap-3 [transform:translateZ(0)]">
      {/* Left Cluster: Profile/Logout when swapped Left + Brand Logo */}
      <div className="flex items-center gap-3 shrink-0">
        {isProfileOnLeft && profileAuthCluster}
        <img
          src={BRAND_LOGO_SRC} /* <-- PLACEHOLDER: Link your logo here */
          alt="Jatt VibeReels"
          loading="lazy"
          decoding="async"
          className="h-8 sm:h-9 w-auto max-w-[155px] object-contain rounded-md shadow-sm"
        />
      </div>

      {/* Prominent Inline User ID & Creator Channel Search Bar */}
      <div ref={searchBoxRef} className="relative flex-1 max-w-xs md:max-w-sm">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(sanitizeSearchQuery(e.target.value, 120));
              setIsSearchOpen(true);
            }}
            placeholder="Search @ID, user, video, or song..."
            className="w-full bg-neutral-900/95 hover:bg-neutral-900 text-xs text-white placeholder-neutral-400 pl-8.5 pr-8 py-2 rounded-xl border border-neutral-700/80 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/40 transition-all"
            aria-label="Search creators, videos, and songs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-neutral-400 hover:text-white p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Instant Advanced Search Dropdown */}
        {isSearchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 border-b border-neutral-800/80 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              <span>{searchQuery ? 'Instant Results' : 'Suggested Channels & Videos'}</span>
              {onOpenCreatorSearch && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.stopPreviewTrack();
                    setPreviewTrackId(null);
                    setIsSearchOpen(false);
                    onOpenCreatorSearch();
                  }}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Search All</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto no-scrollbar divide-y divide-neutral-900">
              {isSearching && !hasAnyResults ? (
                <div className="p-4 text-center text-xs text-neutral-400">
                  Searching users, videos &amp; songs...
                </div>
              ) : !hasAnyResults ? (
                <div className="p-4 text-center text-xs text-neutral-400">
                  No match found for &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <>
                  {/* Accounts / User IDs */}
                  {searchResults.creators.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-neutral-900/60 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                        Users &amp; IDs
                      </div>
                      {searchResults.creators.map((channel) => (
                        <div
                          key={channel.username}
                          onClick={() => handleOpenCreator(channel.username)}
                          className="px-3 py-2 hover:bg-neutral-900/90 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-white truncate">
                                  {channel.name}
                                </span>
                                {channel.isVerified && (
                                  <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] font-semibold text-cyan-400 truncate">
                                @{channel.username}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCreator(channel.username);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[10px] font-black shrink-0 shadow-xs cursor-pointer"
                          >
                            View Profile
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matching Videos & Photos */}
                  {searchResults.posts.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-neutral-900/60 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                        Videos &amp; Photos
                      </div>
                      {searchResults.posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => handleOpenPost(post.id)}
                          className="px-3 py-2 hover:bg-neutral-900/90 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/80 relative flex items-center justify-center">
                              {post.mediaType === 'image' ? (
                                <img
                                  src={optimizeThumbnailUrl(post.videoUrl, 'grid')}
                                  alt={post.title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img
                                  src={optimizeThumbnailUrl(post.posterUrl, 'grid')}
                                  alt={post.title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <span className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white">
                                {post.mediaType === 'image' ? (
                                  <ImageIcon className="w-2.5 h-2.5" />
                                ) : (
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate">{post.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                @{post.creator.username} · {post.sound.title}
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

                  {/* Songs & Naats */}
                  {searchResults.audioTracks.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-neutral-900/60 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                        Songs &amp; Naats
                      </div>
                      {searchResults.audioTracks.map((track) => {
                        const isPlaying = previewTrackId === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => handleToggleTrackPreview(track)}
                            className="px-3 py-2 hover:bg-neutral-900/90 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border border-pink-500/35 text-pink-300 flex items-center justify-center shrink-0">
                                {isPlaying ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Music className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{track.title}</p>
                                <p className="text-[10px] text-neutral-400 truncate">
                                  {track.artist} · {track.category}
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
      </div>

      {/* Primary Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Lite / RAM Saver Mode Toggle */}
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
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
            isRamSaverMode
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
          }`}
          title="Toggle Lite / RAM Saver Mode (Disables blur/particles & caps thumbnails to 320x180)"
        >
          <Zap className={`w-3.5 h-3.5 ${isRamSaverMode ? 'text-emerald-400 fill-emerald-400/30' : 'text-neutral-400'}`} />
          <span className="hidden xl:inline">{isRamSaverMode ? 'RAM Saver' : 'Lite RAM'}</span>
        </button>

        <PWAInstallButton variant="topbar" />

        {/* Search Creators Modal Trigger */}
        {onOpenCreatorSearch && (
          <button
            type="button"
            onClick={onOpenCreatorSearch}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 hover:border-pink-500/50 text-neutral-200 hover:text-white text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Browse Full Creators Directory"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Creators</span>
          </button>
        )}

        {/* Trends Dashboard Button */}
        <button
          type="button"
          onClick={onOpenTrends}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-rose-500/15 hover:from-amber-500/25 hover:to-rose-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
          title="Open Trends Dashboard"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Trends</span>
        </button>

        {/* Go Live Button */}
        <button
          type="button"
          onClick={onOpenLive}
          className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm group ${
            currentTab === 'live'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/35 border border-red-400'
              : 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 shadow-red-500/10'
          }`}
          title="Start or Watch Live Stream"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <Radio className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Go Live</span>
          <span className="sm:hidden">Live</span>
        </button>

        {/* Movie Box & Download Hub Button */}
        {onOpenDownloads && (
          <button
            type="button"
            onClick={onOpenDownloads}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
              currentTab === 'downloads'
                ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white shadow-md shadow-cyan-500/25 border border-cyan-400'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-cyan-300 border border-cyan-500/35 hover:border-cyan-400/60 shadow-xs'
            }`}
            title="Open Movie Box & Download Hub (Movies, Dramas, Songs, Apps, Quran)"
          >
            <Film className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Movie Box</span>
            <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded-sm bg-cyan-400/20 text-cyan-300 hidden md:inline">
              Hub
            </span>
          </button>
        )}

        {/* Choose Camera (Pro 4K Camera) Button */}
        {onOpenProCamera && (
          <button
            type="button"
            onClick={onOpenProCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-pink-600/20 to-purple-600/20 hover:from-pink-600/30 hover:to-purple-600/30 text-pink-300 border border-pink-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Choose Camera (4K/60FPS & Live Filters)"
          >
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Choose Camera</span>
          </button>
        )}

        {/* Choose Gallery / Upload Video Button */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700/80 text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
          title="Choose Gallery or upload photo/video with song"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Choose Gallery</span>
          <span className="sm:hidden">Gallery</span>
        </button>

        {/* Edit Photo & Video Button */}
        {onOpenEditor && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Edit Photo & Video (Trim, Filters, Text, Stickers, Music)"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        {/* Direct Chat / Live Snaps Inbox Button */}
        {onOpenDirectSnaps && (
          <button
            type="button"
            onClick={onOpenDirectSnaps}
            className="relative p-2 rounded-xl border bg-neutral-900 hover:bg-neutral-800 border-amber-500/40 text-amber-300 hover:text-amber-200 transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Direct Chat & Live Snaps Inbox"
            aria-label="Direct Chat & Live Snaps"
          >
            <Send className="w-4 h-4" />
            {unreadDirectSnapsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-black text-[9px] font-black flex items-center justify-center">
                {unreadDirectSnapsCount > 9 ? '9+' : unreadDirectSnapsCount}
              </span>
            )}
          </button>
        )}

        {/* Notifications / Creator Activity Button */}
        {onOpenActivity && (
          <button
            type="button"
            onClick={onOpenActivity}
            className={`relative p-2 rounded-xl border transition-all active:scale-95 shadow-sm ${
              currentTab === 'activity'
                ? 'bg-pink-600/25 border-pink-500/50 text-pink-300'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300 hover:text-white'
            }`}
            title="Notifications, Activity & Post Insights"
            aria-label="Creator Activity"
          >
            <Bell className="w-4 h-4" />
            {unreadActivityCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadActivityCount > 9 ? '9+' : unreadActivityCount}
              </span>
            )}
          </button>
        )}


        {/* Right Cluster: Profile/Logout when swapped Right */}
        {!isProfileOnLeft && profileAuthCluster}
      </div>
    </header>
  );
};

export const TopBar = React.memo(TopBarComponent);

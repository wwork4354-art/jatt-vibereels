import {
  Compass,
  Home,
  Users,
  Bookmark,
  PlusSquare,
  Volume2,
  VolumeX,
  Keyboard,
  Sparkles,
  Shield,
  LogIn,
  Flame,
  Radio,
  Download,
  Camera,
  Film,
  User as UserIcon,
} from 'lucide-react';
import { FeedTab, UserAccount } from '../types';
import { BRAND_LOGO_SRC } from './TopBar';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';


interface SidebarDesktopProps {
  currentTab: FeedTab;
  onSelectTab: (tab: FeedTab) => void;
  onOpenUpload: () => void;
  onOpenTrends: () => void;
  onOpenLive: () => void;
  onOpenProCamera?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  savedCount: number;
  currentUser: UserAccount | null;
  onOpenAdmin: () => void;
  onOpenLogin: () => void;
}


export const SidebarDesktop: React.FC<SidebarDesktopProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenTrends,
  onOpenLive,
  onOpenProCamera,
  isMuted,
  onToggleMute,
  savedCount,
  currentUser,
  onOpenAdmin,
  onOpenLogin,
}) => {
  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 h-screen border-r border-neutral-800 bg-neutral-950 px-5 py-6 shrink-0 z-30 select-none">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-1">
          <img
            src={BRAND_LOGO_SRC} /* <-- PLACEHOLDER: Linked from BRAND_LOGO_SRC in TopBar */
            alt="Jatt VibeReels Logo"
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-amber-500/40 shadow-lg shadow-amber-500/20"
          />
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1">
              Jatt <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-500 bg-clip-text text-transparent">VibeReels</span>
            </h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
              Shorts Feed
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectTab('foryou')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${
              currentTab === 'foryou'
                ? 'bg-neutral-800 text-pink-500 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Home className="w-5 h-5 shrink-0" />
            <span>For You</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('following')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${
              currentTab === 'following'
                ? 'bg-neutral-800 text-pink-500 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Users className="w-5 h-5 shrink-0" />
            <span>Following</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('trending')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${
              currentTab === 'trending'
                ? 'bg-neutral-800 text-pink-500 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Compass className="w-5 h-5 shrink-0" />
            <span>Trending Feed</span>
          </button>

          {/* Trends Dashboard Action */}
          <button
            type="button"
            onClick={onOpenTrends}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all shadow-xs"
          >
            <Flame className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span>Trends Radar</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
          </button>

          {/* Go Live / Live Streams */}
          <button
            type="button"
            onClick={onOpenLive}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all shadow-xs group ${
              currentTab === 'live'
                ? 'bg-neutral-800 text-red-400 border border-red-500/40 shadow-sm'
                : 'text-red-400 bg-red-600/10 hover:bg-red-600/20 border border-red-500/25'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Radio className={`w-5 h-5 group-hover:scale-110 transition-transform ${currentTab === 'live' ? 'text-red-400 animate-pulse' : 'text-red-400'}`} />
              <span>Go Live</span>
            </div>
            <span className={`flex items-center gap-1.5 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
              currentTab === 'live'
                ? 'bg-red-500 text-white border-red-400'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              LIVE
            </span>
          </button>

          {/* Movie Box & Download Hub Tab */}
          <button
            type="button"
            onClick={() => onSelectTab('downloads')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all shadow-xs group ${
              currentTab === 'downloads'
                ? 'bg-gradient-to-r from-pink-600/30 to-cyan-600/30 text-cyan-300 border border-cyan-400 shadow-md'
                : 'text-cyan-400 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/25'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Film className="w-5 h-5 shrink-0 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Movie Box</span>
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/35">
              Stream/DL
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('saved')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${
              currentTab === 'saved'
                ? 'bg-neutral-800 text-amber-400 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Bookmark className="w-5 h-5 shrink-0" />
              <span>Saved</span>
            </div>
            {savedCount > 0 && (
              <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-amber-400 font-semibold tabular-nums border border-neutral-700">
                {savedCount}
              </span>
            )}
          </button>

          {/* Admin Console Item */}
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-all mt-2"
            >
              <Shield className="w-5 h-5 shrink-0" />
              <span>Admin Console</span>
            </button>
          )}
        </nav>

        {/* Action CTAs: Pro Camera & File Upload */}
        <div className="pt-2 space-y-2">
          {onOpenProCamera && (
            <button
              type="button"
              onClick={onOpenProCamera}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 active:scale-98 transition-all border border-pink-400/30"
              title="Launch Heavy Pro 4K Camera"
            >
              <Camera className="w-4 h-4 animate-pulse" />
              <span>Pro 4K Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenUpload}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-800 active:scale-98 transition-all"
          >
            <PlusSquare className="w-4 h-4 text-pink-400" />
            <span>Upload From Device</span>
          </button>
        </div>


        {/* Audio Mute Bar */}
        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-neutral-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-pink-400" />
              )}
              <span className="text-xs font-semibold text-neutral-300">Sound</span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                isMuted
                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
              }`}
            >
              {isMuted ? 'Muted' : 'Playing'}
            </button>
          </div>
        </div>

        {/* App Creator / Developer Credit Badge */}
        <div className="pt-1">
          <DeveloperCreditBadge variant="sidebar" showDetails={true} />
        </div>


        {/* User Account Quick Card in Sidebar */}
        {currentUser ? (
          <div className="p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover bg-neutral-800 border border-neutral-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[10px] text-neutral-400 truncate">@{currentUser.username}</p>
              </div>
            </div>
            <span
              className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-xs shrink-0 ${
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
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800/90 text-neutral-200 hover:text-white border border-neutral-800 hover:border-pink-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5 text-pink-400" />
            <span>Sign In to Account</span>
          </button>
        )}
      </div>

      {/* Keyboard Shortcuts Helper & Footer */}
      <div className="space-y-3">

        <div className="p-3 bg-neutral-900/40 rounded-xl border border-neutral-800/60 text-xs text-neutral-400 space-y-2">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-[11px] uppercase tracking-wider">
            <Keyboard className="w-3.5 h-3.5 text-pink-400" />
            <span>Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded-md border border-neutral-700 font-mono text-[10px]">
                ↑ / ↓
              </kbd>
              <span>Scroll</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded-md border border-neutral-700 font-mono text-[10px]">
                Space
              </kbd>
              <span>Play</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded-md border border-neutral-700 font-mono text-[10px]">
                L
              </kbd>
              <span>Like</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded-md border border-neutral-700 font-mono text-[10px]">
                M
              </kbd>
              <span>Mute</span>
            </div>
          </div>
        </div>

        <div className="px-1 text-[11px] text-neutral-500">
          <span>Jatt VibeReels</span>
          <span className="mx-1.5">·</span>
          <span>Short Video Feed</span>
        </div>
      </div>
    </aside>
  );
};

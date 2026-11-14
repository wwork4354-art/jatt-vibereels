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
} from 'lucide-react';
import { UserAccount } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';

/**
 * PLACEHOLDER: Replace this URL or path with your custom logo image.
 * Examples: "https://your-domain.com/my-logo.png" or "/assets/logo.png"
 */
export const BRAND_LOGO_SRC = "/src/assets/images/jatt_vibereels_neon_logo.png"; // <-- PASTE YOUR LOGO IMAGE SRC HERE

interface TopBarProps {
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenUpload: () => void;
  onOpenTrends: () => void;
  onOpenLive: () => void;
  onOpenDownloads?: () => void;
  onOpenProCamera?: () => void;
  onOpenAdmin: () => void;
  onOpenProfile?: () => void;
  onLogout: () => void;
  currentTab?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onOpenLogin,
  onOpenRegister,
  onOpenUpload,
  onOpenTrends,
  onOpenLive,
  onOpenDownloads,
  onOpenProCamera,
  onOpenAdmin,
  onOpenProfile,
  onLogout,
  currentTab,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
      {/* Brand Zone: Replaced text with Image Logo Tag */}
      <div className="flex items-center shrink-0">
        <img
          src={BRAND_LOGO_SRC} /* <-- PLACEHOLDER: Link your logo here */
          alt="Jatt VibeReels"
          className="h-8 sm:h-9 w-auto max-w-[180px] object-contain rounded-md shadow-sm"
        />
      </div>

      {/* Primary Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

        {/* Pro Camera Button */}
        {onOpenProCamera && (
          <button
            type="button"
            onClick={onOpenProCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-pink-600/20 to-purple-600/20 hover:from-pink-600/30 hover:to-purple-600/30 text-pink-300 border border-pink-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Launch Heavy Pro Camera (4K/60FPS & Beauty Filters)"
          >
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Pro Camera</span>
          </button>
        )}

        {/* Upload Video Button */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700/80 text-xs font-bold transition-all active:scale-95 shadow-sm"
          title="Upload short video from device"
        >
          <Upload className="w-3.5 h-3.5 text-pink-400" />
          <span className="hidden sm:inline">Upload Video</span>
          <span className="sm:hidden">Upload</span>
        </button>


        {/* If Logged Out */}
        {!currentUser ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-pink-600/25 via-purple-600/20 to-cyan-500/25 hover:from-pink-600/40 hover:to-cyan-500/40 text-white border border-pink-500/50 hover:border-pink-400 shadow-md shadow-pink-600/20 active:scale-95 text-xs font-black transition-all group"
              title="Sign In to your Account"
            >
              <LogIn className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
              <span>Log In</span>
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold border border-neutral-700/80 transition-all active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Register</span>
            </button>
          </div>
        ) : (
          /* If Logged In */
          <div className="relative" ref={profileMenuRef}>
            <div className="flex items-center gap-2">
              {/* Admin Panel button if role is admin */}
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/35 text-pink-400 text-xs font-bold transition-all active:scale-95"
                  title="Open user management admin panel"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}

              {/* User Profile Badge Button (toggles interactive profile menu) */}
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/40 transition-all active:scale-95"
                title="View user profile & developer credit"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
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

              {/* Quick Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 sm:p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive User Profile Menu Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3.5">
                {/* User Info Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
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

                {/* DEDICATED DEVELOPER ATTRIBUTION BADGE INSIDE USER PROFILE MENU */}
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1.5">
                    Application Credits
                  </p>
                  <DeveloperCreditBadge variant="menu" showDetails={true} />
                </div>

                {/* Menu Actions */}
                <div className="pt-1 flex flex-col gap-1.5">
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Creator Profile & Videos</span>
                    </button>
                  )}
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center gap-2 transition-colors"
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
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-xs font-bold flex items-center justify-between border border-neutral-800 transition-colors"
                  >
                    <span>Log Out</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
};

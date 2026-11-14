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
} from 'lucide-react';
import { FeedTab, UserAccount } from '../types';
import { BRAND_LOGO_SRC } from './TopBar';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';

interface MobileNavigationProps {
  currentTab: FeedTab;
  onSelectTab: (tab: FeedTab) => void;
  onOpenUpload: () => void;
  onOpenTrends: () => void;
  onOpenLive: () => void;
  onOpenProCamera: () => void;
  onQuickVideoUpload?: (file: File, source?: 'live' | 'gallery') => void;
  savedCount: number;
  currentUser: UserAccount | null;
  creatorAvatar?: string;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
  onLogout?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenTrends,
  onOpenLive,
  onOpenProCamera,
  onQuickVideoUpload,
  savedCount,
  currentUser,
  creatorAvatar,
  onOpenLogin,
  onOpenRegister,
  onOpenAdmin,
  onLogout,
}) => {
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [isUploadSheetOpen, setIsUploadSheetOpen] = useState(false);

  // Dual upload inputs:
  // Option 1: Record live video right now using phone camera (capture="environment")
  const liveRecordInputRef = useRef<HTMLInputElement | null>(null);
  // Option 2: Choose from phone mobile gallery / file manager (WITHOUT capture)
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const handleVideoFileSelected = (e: React.ChangeEvent<HTMLInputElement>, source: 'live' | 'gallery') => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadSheetOpen(false);
      onQuickVideoUpload?.(file, source);
    }
    e.target.value = '';
  };


  return (
    <>
      {/* Mobile Top Header (Branding Header: Image Logo + Tabs + Actions) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-neutral-950/95 border-b border-neutral-800/80 px-3 py-2 flex items-center justify-between gap-2 [transform:translateZ(0)]">
        {/* Left: Brand Image Logo Tag with placeholder src */}
        <div className="flex items-center shrink-0">
          <img
            src={BRAND_LOGO_SRC}
            alt="Jatt VibeReels"
            className="h-7 w-auto max-w-[110px] object-contain rounded-md"
          />
        </div>

        {/* Center Tabs, Live & Trends */}
        <div className="flex items-center gap-2 text-xs font-bold overflow-x-auto no-scrollbar">
          {/* Live Tab Button */}
          <button
            type="button"
            onClick={onOpenLive}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-all ${
              currentTab === 'live'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/35 border border-red-400'
                : 'bg-red-600/20 border border-red-500/40 text-red-400'
            }`}
            title="Open TikTok-style Live Stream"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <Radio className="w-2.5 h-2.5" />
            <span>LIVE</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('following')}
            className={`shrink-0 transition-all ${
              currentTab === 'following'
                ? 'text-white border-b-2 border-white pb-0.5'
                : 'text-neutral-400 hover:text-white pb-0.5'
            }`}
          >
            Following
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('foryou')}
            className={`shrink-0 transition-all ${
              currentTab === 'foryou'
                ? 'text-white border-b-2 border-white pb-0.5'
                : 'text-neutral-400 hover:text-white pb-0.5'
            }`}
          >
            For You
          </button>
          {/* Movie Box & Downloads Hub Button */}
          <button
            type="button"
            onClick={() => onSelectTab('downloads')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-all ${
              currentTab === 'downloads'
                ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white shadow-md border border-cyan-400'
                : 'bg-cyan-600/15 border border-cyan-500/30 text-cyan-300'
            }`}
            title="Open Movie Box & Download Hub (Movies, Dramas, Songs, Apps, Quran)"
          >
            <Film className="w-2.5 h-2.5 text-cyan-400" />
            <span>Movie Box</span>
          </button>
        </div>

        {/* Right Auth / Admin */}
        <div className="flex items-center gap-1.5">
          {!currentUser ? (
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-2.5 py-1 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 text-white rounded-lg text-[11px] font-black border border-pink-400/50 shadow-md shadow-pink-600/25 active:scale-95"
            >
              Log In
            </button>
          ) : (
            <div className="flex items-center gap-1">
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="p-1 bg-pink-500/20 text-pink-400 border border-pink-500/30 rounded-lg text-xs"
                  title="Admin Panel"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileProfileOpen(true)}
                className="rounded-full ring-2 ring-pink-500/40 p-0.5 active:scale-95 transition-transform"
                title="View user profile & developer credit"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover bg-neutral-800"
                  referrerPolicy="no-referrer"
                />
              </button>
            </div>
          )}
        </div>
      </header>


      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-neutral-950/98 border-t border-neutral-800/80 px-2 py-1.5 flex items-center justify-around pb-safe [transform:translateZ(0)]">
        <button
          type="button"
          onClick={() => onSelectTab('foryou')}
          className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors ${
            currentTab === 'foryou' ? 'text-pink-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={onOpenTrends}
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors text-amber-400 hover:text-amber-300 active:scale-95"
        >
          <Compass className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-300">Trends</span>
        </button>

        {/* Option 1: Live Video Recording with capture="environment" */}
        <input
          ref={liveRecordInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          style={{ display: 'none' }}
          onChange={(e) => handleVideoFileSelected(e, 'live')}
        />

        {/* Option 2: Choose Video or Image from Mobile Gallery WITHOUT capture attribute */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          style={{ display: 'none' }}
          onChange={(e) => handleVideoFileSelected(e, 'gallery')}
        />

        {/* Central Camera (+) Button: Opens clean Bottom Sheet Menu with Dual Upload Options */}
        <button
          type="button"
          onClick={() => setIsUploadSheetOpen(true)}
          className="relative flex items-center justify-center p-1 active:scale-90 transition-transform group"
          aria-label="Upload or Record Reel"
          title="Create Reel: Record Live Video or Choose from Gallery"
        >
          {/* Outer Breathing Neon Halo */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500/40 via-purple-600/40 to-cyan-400/40 blur-xs group-hover:scale-110 transition-transform animate-pulse" />

          {/* Heavy Bezel Shutter */}
          <div className="relative w-12 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-pink-600/50 flex items-center justify-center border border-pink-300/40">
            <div className="w-full h-full bg-black/40 rounded-[10px] flex items-center justify-center gap-1 text-white">
              <Camera className="w-4 h-4 text-white group-hover:text-pink-200 transition-colors" />
              <Plus className="w-3.5 h-3.5 stroke-[3] text-pink-300" />
            </div>
          </div>
        </button>

        {/* Dedicated Movie Box & Downloads Tab Button */}
        <button
          type="button"
          onClick={() => onSelectTab('downloads')}
          className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors ${
            currentTab === 'downloads' ? 'text-cyan-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
          title="Movie Box & All-in-One Media Hub"
        >
          <Film className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px]">Movie Box</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className={`relative flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors ${
            currentTab === 'profile' ? 'text-pink-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
          title="Creator Profile & Uploaded Videos"
        >
          {creatorAvatar || currentUser?.avatar ? (
            <img
              src={currentUser?.avatar || creatorAvatar}
              alt="Profile"
              className={`w-5 h-5 rounded-full object-cover border ${
                currentTab === 'profile' ? 'border-pink-400 ring-2 ring-pink-500/30' : 'border-neutral-600'
              }`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-5 h-5" />
          )}
          <span className="text-[10px]">Profile</span>
          {savedCount > 0 && currentTab !== 'profile' && (
            <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-pink-500" />
          )}
        </button>
      </nav>

      {/* Mobile Profile & Developer Attribution Modal */}
      {isMobileProfileOpen && currentUser && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200"
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
              <button
                type="button"
                onClick={() => {
                  setIsMobileProfileOpen(false);
                  onSelectTab('profile');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Open Creator Profile</span>
              </button>
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileProfileOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-xs font-bold flex items-center justify-center gap-2"
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
                  className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-800"
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
      {/* DUAL UPLOAD OPTIONS BOTTOM SHEET / MODAL MENU             */}
      {/* ========================================================= */}
      {isUploadSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsUploadSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200 pb-safe"
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
                    <p className="text-[11px] text-neutral-400">Select upload method</p>
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

            {/* Two Distinct Upload Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {/* Option 1: Record Live Video Button (capture="environment") */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  liveRecordInputRef.current?.click();
                }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-pink-600/20 via-rose-600/20 to-red-600/20 hover:from-pink-600/30 hover:to-red-600/30 border border-pink-500/40 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-pink-600/10"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-600/40 group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white group-hover:text-pink-300 transition-colors">
                        Record Live Video
                      </span>
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Record a new video right now using your phone camera
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  Live
                </span>
              </button>

              {/* Option 2: Choose Video or Image from Gallery Button (WITHOUT capture attribute) */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  galleryInputRef.current?.click();
                }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20 hover:from-cyan-600/30 hover:to-purple-600/30 border border-cyan-500/40 text-left flex items-center justify-between group active:scale-98 transition-all shadow-lg shadow-cyan-600/10"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/40 group-hover:scale-105 transition-transform">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                      Choose Video or Image
                    </span>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Pick a video or photo from phone gallery to post globally
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Gallery
                </span>
              </button>

              {/* Option 3: Upload with Custom Caption Modal */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  onOpenUpload();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-pink-300 hover:text-white border border-pink-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-pink-400" />
                <span>Post Video / Image with Custom Caption</span>
              </button>

              {/* Heavy Pro 4K Camera Viewfinder Option */}
              <button
                type="button"
                onClick={() => {
                  setIsUploadSheetOpen(false);
                  onOpenProCamera();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Heavy Pro 4K Studio Camera Viewfinder</span>
              </button>
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


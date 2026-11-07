import React, { useState } from 'react';
import {
  Home,
  Compass,
  Plus,
  Bookmark,
  User,
  Shield,
  LogIn,
  Upload,
  Flame,
  Radio,
  Download,
  Camera,
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
  savedCount: number;
  currentUser: UserAccount | null;
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
  savedCount,
  currentUser,
  onOpenLogin,
  onOpenRegister,
  onOpenAdmin,
  onLogout,
}) => {
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);


  return (
    <>
      {/* Mobile Top Header (Branding Header: Image Logo + Tabs + Actions) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 px-3 py-2 flex items-center justify-between gap-2">
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
          {/* Downloads Hub Button */}
          <button
            type="button"
            onClick={() => onSelectTab('downloads')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-all ${
              currentTab === 'downloads'
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white shadow-md border border-cyan-400'
                : 'bg-cyan-600/15 border border-cyan-500/30 text-cyan-300'
            }`}
            title="Open All-in-One Download Hub"
          >
            <Download className="w-2.5 h-2.5 text-cyan-400" />
            <span>Downloads</span>
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-md border-t border-neutral-800/80 px-2 py-1.5 flex items-center justify-around pb-safe">
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

        {/* Central "+" Shutter Button: Triggers Heavy Pro Camera Interface */}
        <button
          type="button"
          onClick={onOpenProCamera}
          className="relative flex items-center justify-center p-1 active:scale-90 transition-transform group"
          aria-label="Launch Heavy Pro Camera"
          title="Launch Heavy Pro 4K Camera"
        >
          {/* Outer Breathing Neon Halo */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500/40 via-purple-600/40 to-cyan-400/40 blur-xs group-hover:scale-110 transition-transform" />

          {/* Heavy Bezel Shutter */}
          <div className="relative w-12 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-pink-600/40 flex items-center justify-center border border-pink-300/40">
            <div className="w-full h-full bg-black/40 rounded-[10px] flex items-center justify-center gap-0.5 text-white">
              <Camera className="w-4 h-4 text-white" />
              <Plus className="w-3.5 h-3.5 stroke-[3] text-pink-300" />
            </div>
          </div>
        </button>

        {/* Dedicated Downloads Tab Button */}
        <button
          type="button"
          onClick={() => onSelectTab('downloads')}
          className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors ${
            currentTab === 'downloads' ? 'text-cyan-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
          title="All-in-One Download Hub"
        >
          <Download className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px]">Downloads</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('saved')}
          className={`relative flex flex-col items-center gap-0.5 min-w-[48px] min-h-[44px] justify-center transition-colors ${
            currentTab === 'saved' ? 'text-amber-400 font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px]">Saved</span>
          {savedCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400" />
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
    </>
  );
};


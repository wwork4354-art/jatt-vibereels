import React, { useEffect, useState } from 'react';
import { WifiOff, HardDrive, ArrowRight } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getAllOfflineSavedPosts, OFFLINE_STORE_EVENT } from '../lib/offlineMediaStore';

interface OfflineBannerProps {
  onOpenSavedOffline: () => void;
}

const OfflineBannerComponent: React.FC<OfflineBannerProps> = ({ onOpenSavedOffline }) => {
  const isOnline = useOnlineStatus();
  const [cachedCount, setCachedCount] = useState<number>(0);

  useEffect(() => {
    const refresh = () => {
      void getAllOfflineSavedPosts().then((list) => {
        setCachedCount(list.length);
      });
    };
    refresh();
    window.addEventListener(OFFLINE_STORE_EVENT, refresh);
    return () => window.removeEventListener(OFFLINE_STORE_EVENT, refresh);
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-12.5 sm:top-13.5 left-0 right-0 z-45 px-3 sm:px-6 pointer-events-none gpu-accelerated"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl bg-neutral-950/95 border border-amber-500/50 shadow-2xl shadow-amber-500/15 px-3.5 py-2 flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <span>Offline Mode</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                {cachedCount} {cachedCount === 1 ? 'item' : 'items'} ready
              </span>
            </p>
            <p className="text-[11px] text-neutral-300 truncate">
              Pro Camera &amp; Saved reels, songs &amp; naats work offline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSavedOffline}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white text-[11px] font-black flex items-center gap-1 shrink-0 shadow-md cursor-pointer active:scale-95 transition-all"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Saved / Downloads</span>
          <span className="sm:hidden">Saved</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const OfflineBanner = React.memo(OfflineBannerComponent);

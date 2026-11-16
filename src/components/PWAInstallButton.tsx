import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar';
  onShowToast?: (msg: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'topbar',
  onShowToast,
}) => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleClick = async () => {
    const result = await promptInstall();
    if (result === 'accepted') {
      onShowToast?.('Jatt VibeReels installed for offline access!');
    } else if (result === 'ios') {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          title="Install Jatt VibeReels app for offline playback"
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Install Offline App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          title="Install Jatt VibeReels App (Offline Ready)"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Install App</span>
        </button>
      )}

      {showIosGuide && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Install Jatt VibeReels</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Install this app on your iPhone or iPad to open the UI, Pro Camera, and saved reels/naats without internet:
            </p>
            <ol className="space-y-2.5 text-xs text-neutral-200">
              <li className="flex items-center gap-2.5 bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
                <Share className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  1. Tap the <strong>Share</strong> icon in Safari toolbar
                </span>
              </li>
              <li className="flex items-center gap-2.5 bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
                <PlusSquare className="w-4 h-4 text-pink-400 shrink-0" />
                <span>
                  2. Select <strong>Add to Home Screen</strong>
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 text-white text-xs font-black cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

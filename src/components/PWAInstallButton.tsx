import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  X,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { BRAND_CONFIG, DEFAULT_BRAND_LOGO_SRC, useBrandLogo } from '../config/brandConfig';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'menu' | 'banner' | 'mobile-header';
  onShowToast?: (msg: string) => void;
}

const BANNER_DISMISSED_KEY = 'jatt_pwa_banner_dismissed_v1';

const PWAInstallButtonComponent: React.FC<PWAInstallButtonProps> = ({
  variant = 'topbar',
  onShowToast,
}) => {
  const { isInstalled, isIos, hasNativePrompt, promptInstall } = usePWAInstall();
  const activeLogoSrc = useBrandLogo();
  const [guideMode, setGuideMode] = useState<'ios' | 'chrome' | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Automatically suppress install UI when running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  // Show the floating banner automatically when native Chrome prompt is ready OR on mobile, unless dismissed
  if (variant === 'banner') {
    if (isBannerDismissed) return null;
    const isLikelyMobile =
      typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!hasNativePrompt && !isLikelyMobile && !isIos) {
      return null;
    }
  }

  const handleClick = async () => {
    const result = await promptInstall();
    if (result === 'accepted') {
      onShowToast?.(`${BRAND_CONFIG.appName} installed to your home screen!`);
    } else if (result === 'ios') {
      setGuideMode('ios');
    } else if (result === 'manual') {
      setGuideMode('chrome');
    }
  };

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="fixed bottom-16 lg:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:w-88 z-45 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="rounded-2xl bg-neutral-950/95 border border-pink-500/45 shadow-2xl shadow-pink-600/20 p-3 flex items-center justify-between gap-2.5 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={activeLogoSrc || DEFAULT_BRAND_LOGO_SRC}
                alt={BRAND_CONFIG.appName}
                loading="lazy"
                decoding="async"
                className="w-12 h-10 rounded-xl bg-black object-contain border border-pink-500/40 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-black text-white flex items-center gap-1 truncate">
                  <span>Install {BRAND_CONFIG.appName}</span>
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                </p>
                <p className="text-[10px] text-neutral-300 truncate">
                  One-tap home screen app &amp; offline mode
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleClick}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:brightness-110 text-white text-[11px] font-black flex items-center gap-1 shadow-md cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                aria-label="Dismiss install banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          title={`Install ${BRAND_CONFIG.appName} app to home screen`}
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Install {BRAND_CONFIG.appName}</span>
        </button>
      ) : variant === 'menu' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/15 to-pink-500/20 hover:from-emerald-500/30 hover:to-pink-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Install {BRAND_CONFIG.appName}</span>
        </button>
      ) : variant === 'mobile-header' ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-0.5 min-[420px]:gap-1 px-1.5 py-0.5 min-[420px]:px-2 min-[420px]:py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/45 text-emerald-300 text-[9px] min-[420px]:text-[10px] font-black shrink-0 active:scale-95 cursor-pointer"
          title={`Install ${BRAND_CONFIG.appName} App`}
          aria-label={`Install ${BRAND_CONFIG.appName}`}
        >
          <Download className="w-2.5 h-2.5 min-[420px]:w-3 min-[420px]:h-3 text-emerald-400" />
          <span>Install</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer ${
            hasNativePrompt
              ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 hover:from-emerald-500/35 hover:to-cyan-500/35 border-emerald-400/60 text-emerald-200 shadow-sm shadow-emerald-500/20'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
          }`}
          title={`Install ${BRAND_CONFIG.appName} App to Home Screen`}
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Install {BRAND_CONFIG.appName}</span>
        </button>
      )}

      {guideMode && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setGuideMode(null)}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeLogoSrc || DEFAULT_BRAND_LOGO_SRC}
                  alt={BRAND_CONFIG.appName}
                  loading="lazy"
                  decoding="async"
                  className="w-10 h-8 rounded-lg bg-black object-contain border border-pink-500/40"
                />
                <div>
                  <h3 className="text-sm font-black text-white">Install {BRAND_CONFIG.appName}</h3>
                  <p className="text-[10px] text-neutral-400">
                    {guideMode === 'ios' ? 'iPhone & iPad Safari' : 'Chrome / Android / Desktop'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideMode(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {guideMode === 'ios' ? (
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
                    2. Scroll down and tap <strong>Add to Home Screen</strong>
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-neutral-200">
                <li className="flex items-center gap-2.5 bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
                  <MoreVertical className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    1. Open the browser menu (<strong>⋮</strong>) or install icon in the address bar
                  </span>
                </li>
                <li className="flex items-center gap-2.5 bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
                  <Smartphone className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>
                    2. Tap <strong>Install App</strong> or <strong>Add to Home screen</strong>
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideMode(null)}
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

export const PWAInstallButton = React.memo(PWAInstallButtonComponent);

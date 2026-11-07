import React, { useState } from 'react';
import { BadgeCheck, Sparkles, Code2, ExternalLink, ShieldCheck } from 'lucide-react';

/**
 * Custom Square Image Path for the Creator's Profile Image.
 */
export const JATT_DEVELOPER_IMAGE_SRC: string = "https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png";

interface DeveloperCreditBadgeProps {
  variant?: 'modal' | 'sidebar' | 'menu' | 'compact';
  className?: string;
  showDetails?: boolean;
}

export const DeveloperCreditBadge: React.FC<DeveloperCreditBadgeProps> = ({
  variant = 'modal',
  className = '',
  showDetails = true,
}) => {
  const [imgError, setImgError] = useState(false);

  // Check if custom URL provided
  const isCustomUrlProvided =
    Boolean(JATT_DEVELOPER_IMAGE_SRC) &&
    JATT_DEVELOPER_IMAGE_SRC !== 'APNI_PHOTO_KA_LINK_YAHAN_PASTE_KAREIN' &&
    (JATT_DEVELOPER_IMAGE_SRC.startsWith('http://') ||
      JATT_DEVELOPER_IMAGE_SRC.startsWith('https://') ||
      JATT_DEVELOPER_IMAGE_SRC.startsWith('/') ||
      JATT_DEVELOPER_IMAGE_SRC.startsWith('data:image/'));

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        variant === 'modal'
          ? 'bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-cyan-500/40 shadow-xl shadow-cyan-500/10 p-3.5'
          : variant === 'sidebar'
          ? 'bg-neutral-900/80 hover:bg-neutral-900 border-neutral-800 hover:border-pink-500/40 p-3 shadow-lg'
          : 'bg-neutral-950/90 border-neutral-800 p-2.5'
      } ${className}`}
    >
      {/* Subtle neon corner highlight */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/15 via-pink-500/10 to-transparent pointer-events-none rounded-bl-full" />

      <div className="flex items-center gap-3 relative z-10">
        {/* ========================================================= */}
        {/* CUSTOM SQUARE PLACEHOLDER FOR CREATOR'S PROFILE IMAGE     */}
        {/* ========================================================= */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-xl overflow-hidden bg-neutral-950 border-2 border-cyan-400/80 shadow-md shadow-cyan-500/30 flex items-center justify-center p-0.5 group">
            {isCustomUrlProvided && !imgError ? (
              <img
                src={JATT_DEVELOPER_IMAGE_SRC}
                alt="Jatt Developer"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover rounded-[10px] transition-transform duration-300 group-hover:scale-105"
              />
            ) : (

              /* High-tech square fallback avatar with neon monogram */
              <div className="w-full h-full rounded-[10px] bg-gradient-to-tr from-pink-950/80 via-neutral-900 to-cyan-950/80 flex flex-col items-center justify-center text-center border border-cyan-500/20">
                <span className="text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-cyan-400">
                  JD
                </span>
                <span className="text-[7px] font-black uppercase text-cyan-400 tracking-wider">DEV</span>
              </div>
            )}
          </div>


          {/* Glowing Verified Developer Badge Icon pinned to corner of image */}
          <div
            className="absolute -bottom-1 -right-1 bg-neutral-950 rounded-full p-0.5 shadow-md shadow-cyan-400/40 border border-cyan-400/60"
            title="Verified App Developer"
          >
            <BadgeCheck className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />
          </div>
        </div>

        {/* ========================================================= */}
        {/* DEVELOPER ATTRIBUTION TEXT & BADGE DETAILS                */}
        {/* ========================================================= */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Verified Developer
            </span>
            <span className="text-[10px] font-bold text-pink-400 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Official
            </span>
          </div>

          {/* Prominent Developer Attribution Title */}
          <h4 className="text-xs sm:text-sm font-black text-white tracking-tight mt-1 flex items-center gap-1 truncate">
            <span>App Developed by</span>
            <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 bg-clip-text text-transparent drop-shadow-sm font-black">
              Jatt Developer
            </span>
          </h4>

          {showDetails && (
            <p className="text-[11px] text-neutral-400 truncate mt-0.5 flex items-center gap-1.5">
              <span>Lead Architect & UI Engineer</span>
              <span className="text-neutral-600">·</span>
              <span className="text-neutral-400 font-mono text-[10px]">Jatt VibeReels Pro</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

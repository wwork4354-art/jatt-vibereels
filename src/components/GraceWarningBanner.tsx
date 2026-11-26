import React from 'react';
import { AlertTriangle, Wallet, Clock } from 'lucide-react';
import { LicenseCheckResult } from '../config/brandConfig';

interface GraceWarningBannerProps {
  licenseStatus: LicenseCheckResult;
  onOpenPayRent: () => void;
}

export const GraceWarningBanner: React.FC<GraceWarningBannerProps> = ({
  licenseStatus,
  onOpenPayRent,
}) => {
  if (licenseStatus.phase !== 'grace') return null;

  const daysLeft = licenseStatus.graceDaysRemaining;
  const dayUnit = daysLeft === 1 ? 'day' : 'days';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-[calc(4.6rem+env(safe-area-inset-top))] lg:top-[54px] left-0 right-0 z-45 px-2.5 sm:px-6 pointer-events-none"
    >
      <div className="max-w-4xl mx-auto pointer-events-auto rounded-2xl bg-neutral-950/95 border border-amber-500/70 shadow-2xl shadow-amber-500/20 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/45 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-[13px] font-black text-amber-200 leading-snug">
              ⚠️ Rent Overdue! Your subscription expired ({licenseStatus.expiryDateLabel}). Pay within{' '}
              <span className="text-white underline decoration-amber-400 underline-offset-2 tabular-nums">
                {daysLeft} {dayUnit}
              </span>{' '}
              to avoid automatic app shutdown.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-amber-300/85 mt-0.5 tabular-nums">
              <Clock className="w-3 h-3 shrink-0" />
              <span>
                Grace Period: {daysLeft} {dayUnit} left before Hard Auto-Lock
              </span>
              {licenseStatus.clockTamperDetected && (
                <span className="text-rose-300 font-semibold">· Server time enforced</span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPayRent}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 shrink-0 cursor-pointer active:scale-[0.99] transition-all"
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Pay Rent Now</span>
        </button>
      </div>
    </div>
  );
};

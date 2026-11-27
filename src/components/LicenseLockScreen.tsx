import React, { useState } from 'react';
import {
  Lock,
  MessageCircle,
  Copy,
  Check,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  Wallet,
  Building2,
  AlertTriangle,
  Unlock,
} from 'lucide-react';
import {
  BRAND_CONFIG,
  LicenseCheckResult,
  getBrandNameParts,
  getWhatsAppRenewalUrl,
} from '../config/brandConfig';
import { activateWithRenewalKey } from '../lib/licenseService';
import { EasyPaymentModal } from './EasyPaymentModal';

interface LicenseLockScreenProps {
  licenseStatus: LicenseCheckResult;
  onLicenseUpdated: (nextStatus: LicenseCheckResult) => void;
  onRefreshRemoteStatus?: () => Promise<void>;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  licenseStatus,
  onLicenseUpdated,
  onRefreshRemoteStatus,
}) => {
  const [logoError, setLogoError] = useState(false);
  const [copiedProvider, setCopiedProvider] = useState<'jazzcash' | 'easypaisa' | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Renewal Activation Key form state
  const [activationKey, setActivationKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState('');
  const [activatingKey, setActivatingKey] = useState(false);
  const [checkingRemote, setCheckingRemote] = useState(false);

  const brandParts = getBrandNameParts(BRAND_CONFIG.appName);
  const whatsappUrl = getWhatsAppRenewalUrl(BRAND_CONFIG);
  const paymentNumber = BRAND_CONFIG.paymentNumber || '03214383976';
  const isSuspended = licenseStatus.reason === 'suspended';

  if (!BRAND_CONFIG.enableRentalLock || (licenseStatus.isValid && licenseStatus.phase !== 'locked')) {
    return null;
  }

  const handleCopyNumber = async (provider: 'jazzcash' | 'easypaisa') => {
    try {
      await navigator.clipboard.writeText(paymentNumber);
      setCopiedProvider(provider);
      window.setTimeout(() => {
        setCopiedProvider((prev) => (prev === provider ? null : prev));
      }, 2000);
    } catch {
      // Clipboard may be restricted in some embedded frames
    }
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');
    setKeySuccess('');
    setActivatingKey(true);
    try {
      const result = await activateWithRenewalKey(activationKey);
      if (!result.ok || !result.licenseStatus) {
        setKeyError(result.error || 'Invalid Renewal Activation Key.');
        return;
      }
      setKeySuccess(
        `Unlocked for 30 days (Valid until ${result.unlockedUntilDate}). Loading ${BRAND_CONFIG.appName}...`
      );
      setActivationKey('');
      onLicenseUpdated(result.licenseStatus);
    } finally {
      setActivatingKey(false);
    }
  };

  const handleCheckRemote = async () => {
    if (!onRefreshRemoteStatus || checkingRemote) return;
    setCheckingRemote(true);
    try {
      await onRefreshRemoteStatus();
    } finally {
      setCheckingRemote(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-neutral-950 text-white overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-6 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-locked-heading"
    >
      <div className="w-full max-w-xl my-auto rounded-3xl bg-neutral-900/95 border border-rose-500/40 p-5 sm:p-7 shadow-2xl space-y-5">
        {/* Brand Identity Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3 min-w-0">
            {!logoError && BRAND_CONFIG.logoUrl ? (
              <img
                src={BRAND_CONFIG.logoUrl}
                alt={BRAND_CONFIG.appName}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-11 h-11 rounded-full object-cover border border-neutral-700 shrink-0 bg-neutral-950"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 border border-neutral-700"
                style={{ backgroundColor: BRAND_CONFIG.accentColor }}
              >
                {brandParts.primary.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight text-white truncate">
                {brandParts.primary}{' '}
                {brandParts.accent && (
                  <span style={{ color: BRAND_CONFIG.accentColor }}>{brandParts.accent}</span>
                )}
              </p>
              <p className="text-xs text-neutral-400 truncate">{BRAND_CONFIG.tagline}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckRemote}
            disabled={checkingRemote}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
            title="Check remote subscription status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingRemote ? 'animate-spin' : ''}`} />
            <span>{checkingRemote ? 'Checking...' : 'Check Status'}</span>
          </button>
        </div>

        {/* Hard Lock Banner */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center border border-rose-500/45 bg-rose-500/15 text-rose-400 shrink-0"
              aria-hidden="true"
            >
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1
                id="app-locked-heading"
                className="text-lg sm:text-xl font-black tracking-tight text-white leading-snug"
              >
                🚫 APP LOCKED — Monthly Rent Expired
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 tabular-nums mt-0.5">
                <span className="inline-flex items-center gap-1 text-rose-300 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isSuspended ? 'Account Suspended' : 'Grace Period Ended'}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>Expiry: {licenseStatus.expiryDateLabel}</span>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            {isSuspended
              ? `This ${BRAND_CONFIG.appName} rental instance has been suspended by the ${BRAND_CONFIG.supportProviderName}. Complete your monthly rent payment and enter your Renewal Activation Key below to unlock immediately.`
              : `Your monthly rental subscription and 3-day grace window have expired. Pay rent via JazzCash or EasyPaisa below and enter your Renewal Activation Key to unlock ${BRAND_CONFIG.appName} immediately for 30 days.`}
          </p>

          {licenseStatus.clockTamperDetected && (
            <div className="rounded-xl bg-rose-950/70 border border-rose-500/50 px-3 py-2 flex items-center gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                Anti-Tamper Protection active: local device clock rollback ignored (verified against server time).
              </span>
            </div>
          )}
        </div>

        {/* Direct JazzCash & EasyPaisa Payment Details */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-400">
              JazzCash &amp; EasyPaisa Payment
            </span>
            <span className="text-neutral-300 font-semibold">
              Title: {BRAND_CONFIG.accountTitle}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* JazzCash */}
            <div className="rounded-2xl bg-neutral-950 border border-rose-500/35 p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-rose-400">JazzCash (IBFT Ready)</p>
                <p className="text-base font-black font-mono text-white tabular-nums mt-0.5">
                  {paymentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyNumber('jazzcash')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedProvider === 'jazzcash' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* EasyPaisa */}
            <div className="rounded-2xl bg-neutral-950 border border-emerald-500/35 p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-400">EasyPaisa (IBFT Ready)</p>
                <p className="text-base font-black font-mono text-white tabular-nums mt-0.5">
                  {paymentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyNumber('easypaisa')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedProvider === 'easypaisa' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-neutral-950/80 border border-neutral-800 px-3 py-2 flex items-start gap-2 text-[11px] text-neutral-300">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              Send from any Bank App (Meezan, HBL, SadaPay, NayaPay) directly to JazzCash or EasyPaisa on{' '}
              <span className="font-mono font-bold text-white tabular-nums">{paymentNumber}</span>.
            </span>
          </div>
        </div>

        {/* WhatsApp Proof Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors active:scale-[0.99]"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Send Payment Proof on WhatsApp ({BRAND_CONFIG.supportWhatsApp})</span>
          </a>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-pink-400 shrink-0" />
            <span>Fill Payment Proof &amp; TID Form</span>
          </button>
        </div>

        {/* Instant Renewal Activation Key Box */}
        <form
          onSubmit={handleActivateKey}
          className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="renewal-activation-key"
              className="text-xs font-black text-white flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Enter Renewal Activation Key</span>
            </label>
            <span className="text-[11px] text-neutral-400">Instant +30 Days Unlock</span>
          </div>

          {keyError && (
            <p className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/35 rounded-lg px-3 py-2">
              {keyError}
            </p>
          )}
          {keySuccess && (
            <p className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/35 rounded-lg px-3 py-2">
              {keySuccess}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="renewal-activation-key"
              type="text"
              value={activationKey}
              onChange={(e) => {
                setActivationKey(e.target.value.toUpperCase());
                if (keyError) setKeyError('');
              }}
              placeholder="e.g. JATT-DEC26-PRO"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-h-[46px] bg-neutral-900 border border-neutral-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-sm font-mono uppercase tracking-wider text-white placeholder-neutral-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={activatingKey || !activationKey.trim()}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer shrink-0"
            >
              <Unlock className="w-4 h-4 shrink-0" />
              <span>{activatingKey ? 'Verifying...' : 'Activate & Unlock'}</span>
            </button>
          </div>
        </form>
      </div>

      <EasyPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        initialBrandName={BRAND_CONFIG.appName}
        onLicenseUpdated={onLicenseUpdated}
      />
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  X,
  Wallet,
  Copy,
  Check,
  Building2,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Unlock,
} from 'lucide-react';
import {
  BRAND_CONFIG,
  LicenseCheckResult,
  PaymentMethodOption,
  PaymentPlanOption,
  getPaymentProofWhatsAppUrl,
} from '../config/brandConfig';
import { activateWithRenewalKey, evaluateLicenseSync } from '../lib/licenseService';
import { sanitizeInputLive, sanitizeText } from '../utils/security';

interface EasyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
  initialBrandName?: string;
  onLicenseUpdated?: (nextStatus: LicenseCheckResult) => void;
}

const PLAN_OPTIONS: { id: PaymentPlanOption; subtitle: string }[] = [
  { id: 'Standard Monthly', subtitle: 'Full monthly rental access' },
  { id: 'VIP Exclusive', subtitle: 'Priority support & custom branding' },
];

const METHOD_OPTIONS: PaymentMethodOption[] = ['JazzCash', 'EasyPaisa', 'Bank Transfer'];

export const EasyPaymentModal: React.FC<EasyPaymentModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  initialBrandName = '',
  onLicenseUpdated,
}) => {
  const [copiedCard, setCopiedCard] = useState<'jazzcash' | 'easypaisa' | null>(null);
  const [clientName, setClientName] = useState(initialBrandName);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanOption>('Standard Monthly');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>('JazzCash');
  const [transactionId, setTransactionId] = useState('');
  const [formError, setFormError] = useState('');
  const [renewalKey, setRenewalKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [activatingKey, setActivatingKey] = useState(false);

  useEffect(() => {
    if (isOpen && !clientName && initialBrandName) {
      setClientName(initialBrandName);
    }
  }, [isOpen, initialBrandName, clientName]);

  if (!isOpen) return null;

  const licenseStatus = evaluateLicenseSync();
  const paymentNumber = BRAND_CONFIG.paymentNumber || '03214383976';
  const cleanName = sanitizeText(clientName, 80);
  const cleanTid = sanitizeText(transactionId, 60);
  const isFormReady = cleanName.length > 0 && cleanTid.length > 0;

  const whatsappProofUrl = getPaymentProofWhatsAppUrl(
    {
      clientName: cleanName,
      plan: selectedPlan,
      method: selectedMethod,
      transactionId: cleanTid,
    },
    BRAND_CONFIG
  );

  const handleCopyNumber = async (provider: 'jazzcash' | 'easypaisa', label: string) => {
    try {
      await navigator.clipboard.writeText(paymentNumber);
      setCopiedCard(provider);
      onShowToast?.(`${label} number copied: ${paymentNumber}`);
      window.setTimeout(() => {
        setCopiedCard((prev) => (prev === provider ? null : prev));
      }, 2000);
    } catch {
      onShowToast?.(`Copy failed — transfer to ${paymentNumber}`);
    }
  };

  const handleIncompleteSubmit = () => {
    if (!cleanName && !cleanTid) {
      setFormError('Please enter your Name / Brand Name and Transaction ID (TID).');
      return;
    }
    if (!cleanName) {
      setFormError('Please enter your Name or Brand Name.');
      return;
    }
    setFormError('Please enter your Transaction ID (TID) from your receipt.');
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-800/90 bg-neutral-900/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white tracking-tight truncate">
                Easy Payment &amp; Rent Renewal
              </h2>
              <p className="text-xs text-neutral-400 truncate tabular-nums">
                {BRAND_CONFIG.appName} · Expiry: {licenseStatus.expiryDateLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close payment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          {/* 1. Payment Options (JazzCash & EasyPaisa) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                1. Transfer Rent Directly
              </h3>
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Title: {BRAND_CONFIG.accountTitle}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* JazzCash Card */}
              <div className="rounded-2xl bg-neutral-900 border border-rose-500/35 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-rose-400">JazzCash</span>
                    <span className="text-[11px] font-semibold text-neutral-400">Mobile Account</span>
                  </div>
                  <p className="text-xl font-black font-mono tracking-wide text-white tabular-nums">
                    {paymentNumber}
                  </p>
                  <p className="text-xs text-neutral-300">
                    Title: <span className="font-semibold text-white">{BRAND_CONFIG.accountTitle}</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Also supports Bank-to-JazzCash IBFT transfers
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyNumber('jazzcash', 'JazzCash')}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  {copiedCard === 'jazzcash' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Number Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>
              </div>

              {/* EasyPaisa Card */}
              <div className="rounded-2xl bg-neutral-900 border border-emerald-500/35 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-emerald-400">EasyPaisa</span>
                    <span className="text-[11px] font-semibold text-neutral-400">Mobile Account</span>
                  </div>
                  <p className="text-xl font-black font-mono tracking-wide text-white tabular-nums">
                    {paymentNumber}
                  </p>
                  <p className="text-xs text-neutral-300">
                    Title: <span className="font-semibold text-white">{BRAND_CONFIG.accountTitle}</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Also supports Bank-to-EasyPaisa IBFT transfers
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyNumber('easypaisa', 'EasyPaisa')}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  {copiedCard === 'easypaisa' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Number Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Universal Bank App Note */}
            <div className="rounded-xl bg-neutral-900/80 border border-neutral-800 px-3.5 py-3 flex items-start gap-2.5 text-xs text-neutral-300 leading-relaxed">
              <Building2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p>
                You can send payment from any Bank App (Meezan, HBL, SadaPay, NayaPay, etc.) directly to JazzCash or EasyPaisa on{' '}
                <span className="font-mono font-bold text-white tabular-nums">{paymentNumber}</span>.
              </p>
            </div>
          </section>

          {/* 2. Instant Payment Proof Form */}
          <section className="space-y-3.5 pt-2 border-t border-neutral-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              2. Send Payment Proof for Instant Activation
            </h3>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Name / Brand Name */}
              <div>
                <label
                  htmlFor="payment-client-name"
                  className="block text-xs font-bold text-neutral-300 mb-1.5"
                >
                  Your Name / Brand Name
                </label>
                <input
                  id="payment-client-name"
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(sanitizeInputLive(e.target.value, 80));
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. Ali Khan / Vibe Studio"
                  className="w-full min-h-[44px] bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden"
                />
              </div>

              {/* Selected Plan */}
              <div>
                <span className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Selected Plan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PLAN_OPTIONS.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black">{plan.id}</span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{plan.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Used */}
              <div>
                <span className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Method Used
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {METHOD_OPTIONS.map((method) => {
                    const isSelected = selectedMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedMethod(method)}
                        className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transaction ID (TID) */}
              <div>
                <label
                  htmlFor="payment-tid"
                  className="block text-xs font-bold text-neutral-300 mb-1.5"
                >
                  Transaction ID (TID)
                </label>
                <input
                  id="payment-tid"
                  type="text"
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(sanitizeInputLive(e.target.value, 60));
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. 04192837465"
                  className="w-full min-h-[44px] bg-neutral-900 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-neutral-500 focus:outline-hidden tabular-nums"
                />
              </div>
            </div>

            {/* Send Proof CTA */}
            <div className="pt-1">
              {isFormReady ? (
                <a
                  href={whatsappProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onShowToast?.('Opening WhatsApp with payment details...')}
                  className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-colors active:scale-[0.99]"
                >
                  <MessageCircle className="w-5 h-5 shrink-0" />
                  <span>Send Payment Proof on WhatsApp</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleIncompleteSubmit}
                  className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 shrink-0" />
                  <span>Send Payment Proof on WhatsApp</span>
                </button>
              )}
              <p className="text-[11px] text-neutral-500 text-center mt-2">
                Sends all details directly to WhatsApp ({BRAND_CONFIG.supportWhatsApp}) for instant verification.
              </p>
            </div>
          </section>

          {/* 3. Instant Activation Key Box */}
          <section className="space-y-2.5 pt-3 border-t border-neutral-800/80">
            <label
              htmlFor="modal-renewal-key"
              className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              <span>3. Already Have a Renewal Activation Key?</span>
            </label>

            {keyError && (
              <p className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/35 rounded-lg px-3 py-2">
                {keyError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="modal-renewal-key"
                type="text"
                value={renewalKey}
                onChange={(e) => {
                  setRenewalKey(e.target.value.toUpperCase());
                  if (keyError) setKeyError('');
                }}
                placeholder="e.g. JATT-DEC26-PRO"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-h-[44px] bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-sm font-mono uppercase text-white placeholder-neutral-500 focus:outline-hidden"
              />
              <button
                type="button"
                disabled={activatingKey || !renewalKey.trim()}
                onClick={async () => {
                  setKeyError('');
                  setActivatingKey(true);
                  try {
                    const res = await activateWithRenewalKey(renewalKey);
                    if (!res.ok || !res.licenseStatus) {
                      setKeyError(res.error || 'Invalid Renewal Activation Key.');
                      return;
                    }
                    setRenewalKey('');
                    onLicenseUpdated?.(res.licenseStatus);
                    onShowToast?.(`Subscription extended for 30 days (until ${res.unlockedUntilDate})`);
                    onClose();
                  } finally {
                    setActivatingKey(false);
                  }
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Unlock className="w-4 h-4 shrink-0" />
                <span>{activatingKey ? 'Verifying...' : 'Activate Key'}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

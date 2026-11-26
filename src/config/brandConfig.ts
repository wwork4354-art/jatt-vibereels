export interface BrandConfig {
  /** Primary application brand name shown across headers, auth, and PWA prompts */
  appName: string;
  /** Short brand tagline shown in sidebars, welcome banners, and license screen */
  tagline: string;
  /** Square/horizontal brand logo URL or local asset path */
  logoUrl: string;
  /** Short brand badge label shown next to verified/brand surfaces */
  brandBadge: string;
  /** Primary brand accent hex color */
  accentColor: string;
  /** Secondary highlight hex color */
  secondaryAccentColor: string;
  /** Master Admin login & Admin Vault PIN (change per white-label deployment) */
  adminPin: string;
  /** Security PIN for unlocking the Registered App Users tracker */
  usersTrackerPin: string;
  /** Account holder title shown on JazzCash & EasyPaisa cards for client verification */
  accountTitle: string;
  /** JazzCash & EasyPaisa receiving mobile number (03XXXXXXXXX) */
  paymentNumber: string;
  /** Platform provider WhatsApp number in international format (e.g. +923214383976) */
  supportWhatsApp: string;
  /** Display label for the platform provider on renewal/support screens */
  supportProviderName: string;
  /** Unique client license ID matched against `masterLicenseUrl` multi-client JSON */
  licenseId: string;
  /** Optional read-only HTTPS JSON URL hosted strictly by the Platform Provider for remote status/expiry overrides */
  masterLicenseUrl: string;
  /** Primary rental expiry date in YYYY-MM-DD format (inclusive through end of that day) */
  expiryDate: string;
  /** Provider-controlled billing status: 'active' allows normal/grace operation; 'suspended' locks immediately */
  status: 'active' | 'suspended';
  /** Number of days after expiryDate before Hard Auto-Lock activates (default: 3) */
  gracePeriodDays: number;
  /** Alias for expiryDate kept for backwards compatibility */
  licenseExpiryDate: string;
  /** Master kill-switch for remote rental licensing; set false to lock instance immediately */
  isLicenseActive: boolean;
}

/**
 * ============================================================================
 * CLIENT ONBOARDING NOTE (NEW RENTAL DEPLOYMENT CHECKLIST)
 * ============================================================================
 * 1. CLIENT APP DATA ONLY (Client's Own Supabase Project):
 *    Paste the client's Supabase credentials in `.env` / Hosting Environment Vars:
 *      VITE_SUPABASE_URL="https://YOUR-CLIENT-PROJECT.supabase.co"
 *      VITE_SUPABASE_ANON_KEY="YOUR-CLIENT-SUPABASE-ANON-KEY"
 *    - Used STRICTLY for app data (users, reels, posts, comments, DMs).
 *    - Client Supabase NEVER reads or overrides rental billing/licensing.
 *
 * 2. MASTER PROVIDER LICENSE CONTROL (Controlled Only By Platform Provider):
 *    - Set `licenseId`, `expiryDate`, `status`, and `gracePeriodDays` below.
 *    - Optional Remote Override: Host a read-only HTTPS JSON file (e.g. GitHub
 *      Gist raw / Cloudflare Worker / static JSON) and set `masterLicenseUrl`.
 *      Supported JSON formats:
 *        Single client:
 *          { "status": "active", "expiryDate": "2030-12-31" }
 *        Multi-client (keyed by `licenseId`):
 *          { "clients": { "jatt-vibereels-main": { "status": "active", "expiryDate": "2030-12-31" } } }
 * ============================================================================
 */
export const BRAND_CONFIG: BrandConfig = {
  appName: 'JATT VibeReels',
  tagline: 'Create & Share AI Reels',
  logoUrl: '/src/assets/images/jatt_vibereels_neon_logo.png',
  brandBadge: 'Official',
  accentColor: '#ec4899',
  secondaryAccentColor: '#06b6d4',
  adminPin: '942815',
  usersTrackerPin: '7860',
  accountTitle: 'JATT VibeReels Official',
  paymentNumber: '03214383976',
  supportWhatsApp: '+923214383976',
  supportProviderName: 'Platform Provider',
  licenseId: 'jatt-vibereels-main',
  masterLicenseUrl: '',
  licenseExpiryDate: '2030-12-31',
  expiryDate: '2030-12-31',
  status: 'active',
  gracePeriodDays: 3,
  isLicenseActive: true,
};

export type PaymentPlanOption = 'Standard Monthly' | 'VIP Exclusive';
export type PaymentMethodOption = 'JazzCash' | 'EasyPaisa' | 'Bank Transfer';

export interface PaymentProofDetails {
  clientName: string;
  plan: PaymentPlanOption;
  method: PaymentMethodOption;
  transactionId: string;
}

export type LicensePhase = 'active' | 'grace' | 'locked';

export interface LicenseCheckResult {
  phase: LicensePhase;
  isValid: boolean;
  reason: 'active' | 'grace' | 'suspended' | 'expired';
  expiryDateLabel: string;
  daysRemaining: number;
  graceDaysRemaining: number;
  daysOverdue: number;
  clockTamperDetected: boolean;
  source: 'config' | 'remote' | 'activation_key';
}

export interface LicenseEvaluationOverrides {
  expiryDate?: string;
  status?: 'active' | 'suspended';
  clockTamperDetected?: boolean;
  source?: 'config' | 'remote' | 'activation_key';
}

/**
 * Parses a YYYY-MM-DD date string using `new Date(licenseExpiryDate + "T23:59:59")`
 * so future dates and the expiry date itself stay 100% active through 23:59:59.
 */
export function parseExpiryEndMs(dateStr: string): number {
  const cleanDate = (dateStr || '').trim();
  if (!cleanDate) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const endOfDay = new Date(`${cleanDate}T23:59:59`);
    if (Number.isFinite(endOfDay.getTime())) {
      return endOfDay.getTime();
    }
  }
  const parsed = new Date(cleanDate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Evaluates whether the white-label rental instance is:
 * - 'active': `now <= new Date(licenseExpiryDate + "T23:59:59")`
 * - 'grace': 1 to gracePeriodDays (default 3) days past expiryDate
 * - 'locked': >3 days past expiryDate OR status === 'suspended' OR !isLicenseActive
 */
export function checkLicenseStatus(
  config: BrandConfig = BRAND_CONFIG,
  nowMs: number = Date.now(),
  overrides?: LicenseEvaluationOverrides
): LicenseCheckResult {
  const cleanDate = (
    overrides?.expiryDate ||
    config.licenseExpiryDate ||
    config.expiryDate ||
    ''
  ).trim();
  const effectiveStatus = overrides?.status ?? config.status;
  const graceDays = Math.max(0, Math.floor(config.gracePeriodDays ?? 3));
  const clockTamperDetected = Boolean(overrides?.clockTamperDetected);
  const source = overrides?.source ?? 'config';

  if (!config.isLicenseActive || effectiveStatus === 'suspended') {
    return {
      phase: 'locked',
      isValid: false,
      reason: 'suspended',
      expiryDateLabel: cleanDate || 'Suspended',
      daysRemaining: 0,
      graceDaysRemaining: 0,
      daysOverdue: 0,
      clockTamperDetected,
      source,
    };
  }

  const expiryEndMs = parseExpiryEndMs(cleanDate);
  if (!Number.isFinite(expiryEndMs) || expiryEndMs <= 0) {
    return {
      phase: 'locked',
      isValid: false,
      reason: 'expired',
      expiryDateLabel: cleanDate || 'Unknown',
      daysRemaining: 0,
      graceDaysRemaining: 0,
      daysOverdue: 0,
      clockTamperDetected,
      source,
    };
  }

  const currentDateObj = new Date(nowMs);
  const expiryDateObj = new Date(expiryEndMs);

  if (!(currentDateObj > expiryDateObj)) {
    const daysRemaining = Math.max(1, Math.ceil((expiryEndMs - nowMs) / 86_400_000));
    return {
      phase: 'active',
      isValid: true,
      reason: 'active',
      expiryDateLabel: cleanDate,
      daysRemaining,
      graceDaysRemaining: graceDays,
      daysOverdue: 0,
      clockTamperDetected,
      source,
    };
  }

  const msPastExpiry = nowMs - expiryEndMs;
  const daysOverdue = Math.max(1, Math.ceil(msPastExpiry / 86_400_000));
  const graceWindowMs = graceDays * 86_400_000;

  if (graceDays > 0 && msPastExpiry <= graceWindowMs) {
    const daysElapsedIntoGrace = Math.floor((msPastExpiry - 1) / 86_400_000);
    const graceDaysRemaining = Math.max(1, graceDays - daysElapsedIntoGrace);
    return {
      phase: 'grace',
      isValid: true,
      reason: 'grace',
      expiryDateLabel: cleanDate,
      daysRemaining: 0,
      graceDaysRemaining,
      daysOverdue,
      clockTamperDetected,
      source,
    };
  }

  return {
    phase: 'locked',
    isValid: false,
    reason: 'expired',
    expiryDateLabel: cleanDate,
    daysRemaining: 0,
    graceDaysRemaining: 0,
    daysOverdue,
    clockTamperDetected,
    source,
  };
}

/**
 * Builds a clean WhatsApp click-to-chat URL for rental license renewal.
 */
export function getWhatsAppRenewalUrl(config: BrandConfig = BRAND_CONFIG): string {
  const digits = (config.supportWhatsApp || '').replace(/[^\d]/g, '');
  const activeExpiry = config.licenseExpiryDate || config.expiryDate;
  const message = `Hello, I need to renew the monthly license for ${config.appName} (Expiry: ${activeExpiry}).`;
  if (!digits) return 'https://wa.me/';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a pre-filled WhatsApp click-to-chat URL containing the client's payment proof & TID.
 */
export function getPaymentProofWhatsAppUrl(
  proof: PaymentProofDetails,
  config: BrandConfig = BRAND_CONFIG
): string {
  const digits = (config.supportWhatsApp || '').replace(/[^\d]/g, '');
  const lines = [
    `*Rent Renewal Payment Proof — ${config.appName}*`,
    `• Name / Brand: ${proof.clientName.trim()}`,
    `• Selected Plan: ${proof.plan}`,
    `• Payment Method: ${proof.method}`,
    `• Account Number: ${config.paymentNumber} (${config.accountTitle})`,
    `• Transaction ID (TID): ${proof.transactionId.trim()}`,
    '',
    'Please verify my payment and activate/renew my app subscription.',
  ];
  const message = lines.join('\n');
  if (!digits) return 'https://wa.me/';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Splits `appName` into leading word and trailing accent words for stylized headers.
 */
export function getBrandNameParts(appName: string = BRAND_CONFIG.appName): {
  primary: string;
  accent: string;
} {
  const trimmed = (appName || '').trim();
  if (!trimmed) return { primary: 'JATT', accent: 'VibeReels' };
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { primary: trimmed, accent: '' };
  return {
    primary: trimmed.slice(0, spaceIdx),
    accent: trimmed.slice(spaceIdx + 1),
  };
}

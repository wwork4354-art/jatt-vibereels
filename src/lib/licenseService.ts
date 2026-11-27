import {
  BRAND_CONFIG,
  LicenseCheckResult,
  checkLicenseStatus,
  parseExpiryEndMs,
  resolveConfiguredExpiryDate,
} from '../config/brandConfig';
import {
  constantTimeEqual,
  getLockoutStatus,
  recordFailedAttempt,
  resetLockout,
  sha256HexAsync,
  LockoutStatus,
} from '../utils/security';

const HWM_STORAGE_KEY = 'jatt_hwm_clock_v1';
const HWM_SESSION_KEY = 'jatt_hwm_clock_s1';
const UNLOCK_GRANT_KEY = 'jatt_rental_unlock_v1';
const MASTER_CACHE_KEY = 'jatt_master_license_cache_v1';
const REDEEMED_KEYS_KEY = 'jatt_redeemed_rental_keys_v1';

// Integrity salt for tamper-evident client storage verification
const INTEGRITY_SALT = 'jatt_billing_integrity_2026_v1';

// Salted SHA-256 digests (`jatt_rental_key_v1:${KEY}`) matching server-side verification
const FALLBACK_KEY_HASHES = new Set<string>([
  'fc74381319eee9a045043749920a9ca7c8def524bee9e6749eb23ff7fc2d1a93', // JATT-NOV26-PRO
  'edcbd48e8b2cfacd1efb56f4ba1f147e747a37f6915203d858afec37e8fdf059', // JATT-DEC26-PRO
  'e5b820633d7883534ce39d35e6631996896c375a2ae12412b8c6ce481683222a', // JATT-JAN27-PRO
  'e4dceda24c479deca51d896c0528ab17475c977af18d6ecea28890d2d5e21b6f', // JATT-FEB27-PRO
  '02898be5b3d145a77819161f082d18b2b5c583e021fe3f0a2da3edda359bf694', // JATT-MAR27-PRO
  'b13195e97eb15616073dd44c5cd040820453208334ca62b89d39a46e7f430188', // JATT-APR27-PRO
  '0b60581622f78572fc83b883473f2b62c321fa1484b5788eb7fa0918a255f903', // JATT-MAY27-PRO
  '115acc615791c294a73f520c16ca4c6156c9aaa28b9ff24a00c520320ec7d996', // JATT-JUN27-PRO
  'acc60a18a01a1b1489afc0eb02f407a60ccd5536f02ae25f0651edf7f2ed061e', // JATT-JUL27-PRO
  '654ca6361aede47c878e8aa8717b1adfec50a6ba2b342c4e83a60be4f153e0d9', // JATT-AUG27-PRO
  '47db9815dbc486e7024d00275fa46097dd7c3a6f361a01d5b02afc74e9ebcd44', // JATT-SEP27-PRO
  'dd6d205c8657e5caebb840eab8b2ce6790c536fc1d319e631dfa89334bff640c', // JATT-OCT27-PRO
  'a1a3277357b1171b74cbe792addfe3449416e9148cc83d66819a5e4c77fef33f', // JATT-NOV27-PRO
  '2b901f52ca3358c24f3369a00fd43120298149cb0048ccc194b9e0c5fbedb735', // JATT-DEC27-PRO
]);

interface MasterLicensePayload {
  status?: string;
  expiryDate?: string;
  expiry_date?: string;
  activationKey?: string | null;
  activation_key?: string | null;
  updatedAt?: string;
  updated_at?: string;
  clients?: Record<string, MasterLicensePayload>;
}

interface StoredUnlockGrant {
  unlockedUntilDate: string;
  activatedAtMs: number;
  keyFingerprint: string;
  sig: string;
}

interface StoredMasterCache {
  endpointUrl: string;
  status: 'active' | 'suspended';
  expiryDate: string;
  activationKeyHash?: string;
  updatedAtMs: number;
  fetchedAtMs: number;
  sig: string;
}

async function signPayload(raw: string): Promise<string> {
  return sha256HexAsync(`${INTEGRITY_SALT}:${raw}`);
}

function isAllowedMasterUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function readLocalHighWaterMark(): number {
  let best = 0;
  try {
    const rawLocal = localStorage.getItem(HWM_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as { ts?: number };
      if (typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)) {
        best = Math.max(best, parsed.ts);
      }
    }
  } catch {
    // ignore
  }
  try {
    const rawSess = sessionStorage.getItem(HWM_SESSION_KEY);
    if (rawSess) {
      const parsed = JSON.parse(rawSess) as { ts?: number };
      if (typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)) {
        best = Math.max(best, parsed.ts);
      }
    }
  } catch {
    // ignore
  }
  return best;
}

async function writeLocalHighWaterMark(tsMs: number, forceSync = false): Promise<void> {
  const existing = readLocalHighWaterMark();
  const nextTs = forceSync ? tsMs : Math.max(existing, tsMs);
  const sig = await signPayload(`hwm:${nextTs}`);
  const serialized = JSON.stringify({ ts: nextTs, sig });
  try {
    localStorage.setItem(HWM_STORAGE_KEY, serialized);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(HWM_SESSION_KEY, serialized);
  } catch {
    // ignore
  }
}

async function readVerifiedUnlockGrant(): Promise<StoredUnlockGrant | null> {
  try {
    const raw = localStorage.getItem(UNLOCK_GRANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUnlockGrant>;
    if (
      typeof parsed.unlockedUntilDate !== 'string' ||
      typeof parsed.activatedAtMs !== 'number' ||
      typeof parsed.keyFingerprint !== 'string' ||
      typeof parsed.sig !== 'string'
    ) {
      return null;
    }
    const expectedSig = await signPayload(
      `unlock:${parsed.unlockedUntilDate}:${parsed.activatedAtMs}:${parsed.keyFingerprint}`
    );
    if (!constantTimeEqual(parsed.sig, expectedSig)) {
      return null;
    }
    return parsed as StoredUnlockGrant;
  } catch {
    return null;
  }
}

function readUnlockGrantUnsafeSync(): StoredUnlockGrant | null {
  try {
    const raw = localStorage.getItem(UNLOCK_GRANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUnlockGrant>;
    if (
      typeof parsed.unlockedUntilDate === 'string' &&
      typeof parsed.activatedAtMs === 'number' &&
      typeof parsed.sig === 'string'
    ) {
      return parsed as StoredUnlockGrant;
    }
    return null;
  } catch {
    return null;
  }
}

async function readVerifiedMasterCache(expectedUrl: string): Promise<StoredMasterCache | null> {
  try {
    const raw = localStorage.getItem(MASTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMasterCache>;
    if (
      parsed.endpointUrl !== expectedUrl ||
      (parsed.status !== 'active' && parsed.status !== 'suspended') ||
      typeof parsed.expiryDate !== 'string' ||
      typeof parsed.fetchedAtMs !== 'number' ||
      typeof parsed.sig !== 'string'
    ) {
      return null;
    }
    const expectedSig = await signPayload(
      `master:${parsed.endpointUrl}:${parsed.status}:${parsed.expiryDate}:${parsed.fetchedAtMs}`
    );
    if (!constantTimeEqual(parsed.sig, expectedSig)) {
      return null;
    }
    return parsed as StoredMasterCache;
  } catch {
    return null;
  }
}

function readMasterCacheSync(expectedUrl: string): StoredMasterCache | null {
  try {
    const raw = localStorage.getItem(MASTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMasterCache>;
    if (
      parsed.endpointUrl === expectedUrl &&
      (parsed.status === 'active' || parsed.status === 'suspended') &&
      typeof parsed.expiryDate === 'string'
    ) {
      return parsed as StoredMasterCache;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveMasterCache(cache: Omit<StoredMasterCache, 'sig'>): Promise<void> {
  const sig = await signPayload(
    `master:${cache.endpointUrl}:${cache.status}:${cache.expiryDate}:${cache.fetchedAtMs}`
  );
  try {
    localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify({ ...cache, sig }));
  } catch {
    // ignore
  }
}

function getRedeemedKeyFingerprints(): string[] {
  try {
    const raw = localStorage.getItem(REDEEMED_KEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function recordRedeemedKeyFingerprint(fp: string): void {
  try {
    const existing = getRedeemedKeyFingerprints();
    if (!existing.includes(fp)) {
      localStorage.setItem(REDEEMED_KEYS_KEY, JSON.stringify([...existing.slice(-24), fp]));
    }
  } catch {
    // ignore
  }
}

/**
 * Fetches authoritative server time and checks for client clock rollback tampering.
 * Uses `/api/license/time` first, falling back to same-origin HTTP Date header.
 */
export async function fetchAuthoritativeClock(): Promise<{
  effectiveNowMs: number;
  serverTimeMs: number | null;
  clockTamperDetected: boolean;
}> {
  const localNowMs = Date.now();
  const hwmMs = readLocalHighWaterMark();
  let serverTimeMs: number | null = null;

  try {
    const res = await fetch('/api/license/time', {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { serverTimeMs?: number };
      if (typeof data.serverTimeMs === 'number' && Number.isFinite(data.serverTimeMs)) {
        serverTimeMs = data.serverTimeMs;
      }
    }
  } catch {
    // Fallback to HTTP Date header
  }

  if (serverTimeMs === null) {
    try {
      const headRes = await fetch('/', { method: 'HEAD', cache: 'no-store' });
      const dateHeader = headRes.headers.get('date');
      if (dateHeader) {
        const parsed = Date.parse(dateHeader);
        if (Number.isFinite(parsed) && parsed > 0) {
          serverTimeMs = parsed;
        }
      }
    } catch {
      // Offline / unreachable
    }
  }

  const SKEW_TOLERANCE_MS = 120_000;
  const tamperVsServer = serverTimeMs !== null && localNowMs < serverTimeMs - SKEW_TOLERANCE_MS;
  const tamperVsHwm = serverTimeMs === null && hwmMs > 0 && localNowMs < hwmMs - SKEW_TOLERANCE_MS;
  const clockTamperDetected = tamperVsServer || tamperVsHwm;

  // When online serverTimeMs is available, treat it as authoritative so stale client HWM cannot cause false expiry
  const effectiveNowMs =
    serverTimeMs !== null ? Math.max(serverTimeMs, Math.min(localNowMs, serverTimeMs + 86_400_000)) : Math.max(localNowMs, hwmMs);

  await writeLocalHighWaterMark(effectiveNowMs, serverTimeMs !== null);

  return {
    effectiveNowMs,
    serverTimeMs,
    clockTamperDetected,
  };
}

/**
 * Fetches the Platform Provider's optional read-only `masterLicenseUrl` JSON endpoint.
 * NOTE: Strictly isolated from client Supabase (`VITE_SUPABASE_URL`), which is reserved
 * exclusively for client app data and NEVER has access to alter rental licensing.
 */
export async function fetchMasterProviderLicense(): Promise<StoredMasterCache | null> {
  const endpointUrl = isAllowedMasterUrl(BRAND_CONFIG.masterLicenseUrl);
  if (!endpointUrl) {
    try {
      localStorage.removeItem(MASTER_CACHE_KEY);
    } catch {
      // ignore
    }
    return null;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(endpointUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      return readVerifiedMasterCache(endpointUrl);
    }

    // Also harvest HTTP Date header from the provider host as an anti-tamper clock anchor
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const headerMs = Date.parse(dateHeader);
      if (Number.isFinite(headerMs) && headerMs > 0) {
        await writeLocalHighWaterMark(headerMs);
      }
    }

    const json = (await res.json()) as MasterLicensePayload;
    if (!json || typeof json !== 'object') {
      return readVerifiedMasterCache(endpointUrl);
    }

    const clientEntry =
      json.clients && typeof json.clients === 'object' && BRAND_CONFIG.licenseId
        ? json.clients[BRAND_CONFIG.licenseId]
        : json;

    if (!clientEntry || typeof clientEntry !== 'object') {
      return readVerifiedMasterCache(endpointUrl);
    }

    const rawStatus = String(clientEntry.status || '').trim().toLowerCase();
    const remoteStatus: 'active' | 'suspended' =
      rawStatus === 'suspended' ? 'suspended' : 'active';

    const rawExpiry = (clientEntry.expiryDate || clientEntry.expiry_date || '').trim();
    const defaultExpiry = resolveConfiguredExpiryDate(BRAND_CONFIG);
    const remoteExpiry = rawExpiry ? rawExpiry.slice(0, 10) : defaultExpiry;

    const rawKey = (clientEntry.activationKey || clientEntry.activation_key || '').trim();
    const activationKeyHash = rawKey
      ? await sha256HexAsync(`jatt_rental_key_v1:${rawKey.toUpperCase()}`)
      : undefined;

    const rawUpdated = (clientEntry.updatedAt || clientEntry.updated_at || '').trim();
    const updatedAtMs =
      rawUpdated && Number.isFinite(Date.parse(rawUpdated)) ? Date.parse(rawUpdated) : 0;

    const cachePayload: Omit<StoredMasterCache, 'sig'> = {
      endpointUrl,
      status: remoteStatus,
      expiryDate: remoteExpiry,
      activationKeyHash,
      updatedAtMs,
      fetchedAtMs: Date.now(),
    };
    await saveMasterCache(cachePayload);
    return { ...cachePayload, sig: '' };
  } catch {
    return readVerifiedMasterCache(endpointUrl);
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Fast synchronous license check for immediate initial React render (zero flicker).
 * Uses ONLY BRAND_CONFIG + optional cached master provider JSON + verified activation key grants.
 */
export function evaluateLicenseSync(): LicenseCheckResult {
  const localNow = Date.now();
  const hwmMs = readLocalHighWaterMark();
  const masterEndpoint = isAllowedMasterUrl(BRAND_CONFIG.masterLicenseUrl);
  const masterCache = masterEndpoint ? readMasterCacheSync(masterEndpoint) : null;
  const unlockGrant = readUnlockGrantUnsafeSync();

  const defaultExpiry = resolveConfiguredExpiryDate(BRAND_CONFIG);
  const isOwnerLongTermBuild =
    !masterEndpoint &&
    BRAND_CONFIG.isLicenseActive &&
    BRAND_CONFIG.status === 'active' &&
    defaultExpiry >= '2030-01-01';

  const clockTamperDetected = !isOwnerLongTermBuild && hwmMs > 0 && localNow < hwmMs - 120_000;
  const effectiveNowMs = isOwnerLongTermBuild ? localNow : Math.max(localNow, hwmMs);

  const remoteSuspendedAfterGrant = Boolean(
    masterCache?.status === 'suspended' &&
      (!unlockGrant || (masterCache.updatedAtMs || 0) > unlockGrant.activatedAtMs)
  );
  const configSuspendedWithoutGrant =
    (BRAND_CONFIG.status === 'suspended' || !BRAND_CONFIG.isLicenseActive) && !unlockGrant;

  const baseStatus: 'active' | 'suspended' =
    remoteSuspendedAfterGrant || configSuspendedWithoutGrant ? 'suspended' : 'active';

  let bestExpiryDate = masterCache?.expiryDate || defaultExpiry;
  let source: 'config' | 'remote' | 'activation_key' = masterCache ? 'remote' : 'config';

  if (unlockGrant && baseStatus !== 'suspended') {
    const grantEndMs = parseExpiryEndMs(unlockGrant.unlockedUntilDate);
    const currentEndMs = parseExpiryEndMs(bestExpiryDate);
    if (grantEndMs > currentEndMs || BRAND_CONFIG.status === 'suspended' || !BRAND_CONFIG.isLicenseActive) {
      bestExpiryDate = unlockGrant.unlockedUntilDate;
      source = 'activation_key';
    }
  }

  return checkLicenseStatus(BRAND_CONFIG, effectiveNowMs, {
    expiryDate: bestExpiryDate,
    status: baseStatus,
    clockTamperDetected,
    source,
  });
}

/**
 * Full authoritative evaluation combining server time, anti-rollback high-water mark,
 * Master Provider `masterLicenseUrl` state (if configured), and verified 30-day activation keys.
 */
export async function evaluateFullLicenseState(): Promise<LicenseCheckResult> {
  const [clock, masterState, unlockGrant] = await Promise.all([
    fetchAuthoritativeClock(),
    fetchMasterProviderLicense(),
    readVerifiedUnlockGrant(),
  ]);

  const masterEndpoint = isAllowedMasterUrl(BRAND_CONFIG.masterLicenseUrl);
  const defaultExpiry = resolveConfiguredExpiryDate(BRAND_CONFIG);
  const isOwnerLongTermBuild =
    !masterEndpoint &&
    BRAND_CONFIG.isLicenseActive &&
    BRAND_CONFIG.status === 'active' &&
    defaultExpiry >= '2030-01-01';

  const remoteSuspendedAfterGrant = Boolean(
    masterState?.status === 'suspended' &&
      (!unlockGrant || (masterState.updatedAtMs || 0) > unlockGrant.activatedAtMs)
  );
  const configSuspendedWithoutGrant =
    (BRAND_CONFIG.status === 'suspended' || !BRAND_CONFIG.isLicenseActive) && !unlockGrant;

  const baseStatus: 'active' | 'suspended' =
    remoteSuspendedAfterGrant || configSuspendedWithoutGrant ? 'suspended' : 'active';

  let bestExpiryDate = masterState?.expiryDate || defaultExpiry;
  let source: 'config' | 'remote' | 'activation_key' = masterState ? 'remote' : 'config';

  if (unlockGrant && baseStatus !== 'suspended') {
    const grantEndMs = parseExpiryEndMs(unlockGrant.unlockedUntilDate);
    const currentEndMs = parseExpiryEndMs(bestExpiryDate);
    if (grantEndMs > currentEndMs || BRAND_CONFIG.status === 'suspended' || !BRAND_CONFIG.isLicenseActive) {
      bestExpiryDate = unlockGrant.unlockedUntilDate;
      source = 'activation_key';
    }
  }

  const effectiveNowMs = isOwnerLongTermBuild
    ? clock.serverTimeMs ?? Date.now()
    : clock.effectiveNowMs;

  return checkLicenseStatus(BRAND_CONFIG, effectiveNowMs, {
    expiryDate: bestExpiryDate,
    status: baseStatus,
    clockTamperDetected: isOwnerLongTermBuild ? false : clock.clockTamperDetected,
    source,
  });
}

export function getActivationKeyLockout(): LockoutStatus {
  return getLockoutStatus('rental_activation_key');
}

/**
 * Validates a monthly Renewal Activation Key (e.g. `JATT-DEC26-PRO`) via server API,
 * Master Provider `masterLicenseUrl`, or salted SHA-256 verification and unlocks for 30 days.
 */
export async function activateWithRenewalKey(rawKeyInput: string): Promise<{
  ok: boolean;
  error?: string;
  licenseStatus?: LicenseCheckResult;
  unlockedUntilDate?: string;
}> {
  const lock = getLockoutStatus('rental_activation_key');
  if (lock.isLocked) {
    return {
      ok: false,
      error: `Too many invalid key attempts. Try again in ${lock.remainingSeconds}s.`,
    };
  }

  const normalizedKey = (rawKeyInput || '').trim().toUpperCase();
  if (!normalizedKey || normalizedKey.length < 6) {
    return { ok: false, error: 'Please enter a valid Renewal Activation Key.' };
  }

  const inputDigest = await sha256HexAsync(`jatt_rental_key_v1:${normalizedKey}`);
  const fingerprint = inputDigest.slice(0, 16);

  const redeemed = getRedeemedKeyFingerprints();
  const existingGrant = await readVerifiedUnlockGrant();
  const isAlreadyActiveSameKey = existingGrant?.keyFingerprint === fingerprint;
  if (redeemed.includes(fingerprint) && !isAlreadyActiveSameKey) {
    return {
      ok: false,
      error: 'This activation key has already been used for a previous billing cycle.',
    };
  }

  let verified = false;
  let serverUnlockedUntilDate = '';
  let authoritativeNowMs = Date.now();

  // 1. Server-side verification first (preferred & authoritative)
  try {
    const res = await fetch('/api/license/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: normalizedKey }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        valid?: boolean;
        serverTimeMs?: number;
        unlockedUntilDate?: string;
      };
      if (data.valid && data.unlockedUntilDate) {
        verified = true;
        serverUnlockedUntilDate = data.unlockedUntilDate;
        if (typeof data.serverTimeMs === 'number') {
          authoritativeNowMs = data.serverTimeMs;
        }
      }
    }
  } catch {
    // Fall back to provider endpoint / offline salted SHA-256 verification
  }

  // 2. Check against Provider's optional read-only masterLicenseUrl JSON
  if (!verified) {
    const masterState = await fetchMasterProviderLicense();
    if (
      masterState?.activationKeyHash &&
      constantTimeEqual(inputDigest, masterState.activationKeyHash)
    ) {
      verified = true;
    }
  }

  // 3. Offline / static fallback salted SHA-256 verification
  if (!verified) {
    for (const allowedHash of FALLBACK_KEY_HASHES) {
      if (constantTimeEqual(inputDigest, allowedHash)) {
        verified = true;
        break;
      }
    }
  }

  if (!verified) {
    const nextLock = recordFailedAttempt('rental_activation_key');
    return {
      ok: false,
      error: nextLock.isLocked
        ? 'Too many invalid attempts. Please wait 5 minutes or contact support.'
        : `Invalid Renewal Activation Key. (${nextLock.attemptsLeft} attempt${
            nextLock.attemptsLeft === 1 ? '' : 's'
          } left)`,
    };
  }

  // Verified! Compute +30 days from authoritative time
  resetLockout('rental_activation_key');
  const clock = await fetchAuthoritativeClock();
  const baseNowMs = Math.max(authoritativeNowMs, clock.effectiveNowMs);
  const unlockedUntilDate =
    serverUnlockedUntilDate || new Date(baseNowMs + 30 * 86_400_000).toISOString().slice(0, 10);

  const sig = await signPayload(`unlock:${unlockedUntilDate}:${baseNowMs}:${fingerprint}`);
  const grant: StoredUnlockGrant = {
    unlockedUntilDate,
    activatedAtMs: baseNowMs,
    keyFingerprint: fingerprint,
    sig,
  };

  try {
    localStorage.setItem(UNLOCK_GRANT_KEY, JSON.stringify(grant));
  } catch {
    // ignore storage errors
  }
  recordRedeemedKeyFingerprint(fingerprint);

  const licenseStatus = await evaluateFullLicenseState();

  return {
    ok: true,
    unlockedUntilDate,
    licenseStatus,
  };
}

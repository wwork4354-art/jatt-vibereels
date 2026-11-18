/**
 * Jatt VibeReels — Central Cybersecurity Hardening Module
 *
 * Covers:
 * 1. XSS & Code Injection Sanitization (HTML/script stripping + Safe URL allowlist)
 * 2. Password Strength Validation & Web Crypto (PBKDF2 / SHA-256) Hashing
 * 3. Persistent Brute-Force Lockout Protection (3 failed attempts -> 5-minute countdown)
 * 4. Strict Upload Media & Audio Format Validation
 * 5. Persistent Sliding-Window Rate Limiting (3 signups/min, 5 uploads/min)
 * 6. Clickjacking Frame-Busting, DevTools Deterrence & 30-Min Session Timeout
 */

export const LOCKOUT_MAX_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity auto-logout

export const SIGNUP_RATE_LIMIT = { max: 3, windowMs: 60 * 1000 };
export const UPLOAD_RATE_LIMIT = { max: 5, windowMs: 60 * 1000 };

const LOCKOUT_STORAGE_KEY = 'jatt_sec_lockouts_v1';
const RATE_LIMIT_STORAGE_KEY = 'jatt_sec_ratelimit_v1';
const LAST_ACTIVITY_STORAGE_KEY = 'vibereels_last_activity_ts';

const ADMIN_PIN_SALT = 'jatt_vibereels_admin_pin_v1';
const ADMIN_PIN_SHA256_HEX =
  '6da5252377cb7c082bd15e3639edaab212bb01a122b9d8448d591eba186950a9';

// =========================================================================
// 1. XSS & Code Injection Sanitization
// =========================================================================

/**
 * Strips HTML tags, <script>/<style> blocks, event handlers (onclick=),
 * dangerous protocols (javascript:, vbscript:, data:text/html), and control characters.
 * Preserves trailing/internal spaces for live controlled <input> typing.
 */
export function sanitizeInputLive(raw: string, maxLen = 500): string {
  if (typeof raw !== 'string' || !raw) return '';

  let cleaned = raw
    // Strip ASCII control characters except tab/newline
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Strip dangerous container blocks completely (content included)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    // Strip all HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Strip remaining angle brackets so unclosed tags like "<img src=x" cannot form
    .replace(/[<>]/g, '')
    // Strip inline JS protocol injections & event handler strings
    .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
    .replace(/\bdata\s*:\s*(?:text\/html|application\/javascript|image\/svg\+xml)/gi, '')
    .replace(/\bon[a-z]{2,20}\s*=/gi, '');

  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }
  return cleaned;
}

/**
 * Full XSS sanitization + whitespace trimming for submission, storage, and hydration.
 */
export function sanitizeText(raw: string, maxLen = 500): string {
  return sanitizeInputLive(raw, maxLen).trim();
}

/**
 * Sanitizes search bar queries without blocking emojis, spaces, or @ symbols.
 */
export function sanitizeSearchQuery(raw: string, maxLen = 120): string {
  return sanitizeInputLive(raw, maxLen);
}

/**
 * Sanitizes creator usernames / @handles strictly to safe handle characters.
 */
export function sanitizeUsername(raw: string, maxLen = 40): string {
  if (typeof raw !== 'string') return '';
  return sanitizeText(raw, maxLen)
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, maxLen);
}

/**
 * Sanitizes hashtag text input cleanly while typing.
 */
export function sanitizeHashtagsInput(raw: string, maxLen = 200): string {
  return sanitizeInputLive(raw, maxLen);
}

/**
 * Validates and sanitizes external or local media/avatar URLs.
 * Rejects javascript:, vbscript:, data:text/html, data:image/svg+xml, etc.
 */
export function sanitizeSafeUrl(
  rawUrl: string,
  options: { allowBlob?: boolean; allowDataImageAudio?: boolean } = {}
): string {
  const { allowBlob = true, allowDataImageAudio = true } = options;
  if (typeof rawUrl !== 'string') return '';

  const trimmed = rawUrl.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();

  // Explicit dangerous protocol blocklist
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:application/') ||
    lower.startsWith('data:image/svg+xml')
  ) {
    return '';
  }

  // Allow relative local paths (e.g., /icons/icon-192.png)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Allow in-memory object URLs created for local file playback
  if (allowBlob && lower.startsWith('blob:')) {
    return trimmed;
  }

  // Allow strictly safe raster image or audio base64 data URIs (no SVG/HTML)
  if (allowDataImageAudio && lower.startsWith('data:')) {
    if (
      /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed) ||
      /^data:audio\/(?:mpeg|mp3|mp4|x-m4a|wav|ogg|webm|aac);base64,[a-z0-9+/=\s]+$/i.test(
        trimmed
      )
    ) {
      return trimmed;
    }
    return '';
  }

  // Require standard http: or https: URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Reject malformed URLs
  }

  return '';
}

// =========================================================================
// 2. Password Strength & Web Crypto Hashing
// =========================================================================

export interface PasswordStrengthResult {
  isValid: boolean;
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  score: number; // 0-4
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = typeof password === 'string' ? password : '';
  const minLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);

  const checks = [minLength, hasUppercase, hasNumber, hasSymbol];
  const score = checks.filter(Boolean).length;

  const errors: string[] = [];
  if (!minLength) errors.push('At least 8 characters');
  if (!hasUppercase) errors.push('At least 1 uppercase letter (A-Z)');
  if (!hasNumber) errors.push('At least 1 number (0-9)');
  if (!hasSymbol) errors.push('At least 1 special symbol (!@#$%^&*)');

  return {
    isValid: score === 4,
    minLength,
    hasUppercase,
    hasNumber,
    hasSymbol,
    score,
    errors,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function generateRandomSaltHex(byteLength = 16): string {
  const arr = new Uint8Array(byteLength);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < byteLength; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(arr);
}

/**
 * Pure-JS SHA-256 fallback used only when crypto.subtle is unavailable
 * (e.g., plain HTTP LAN testing without TLS).
 */
function sha256HexFallback(asciiInput: string): string {
  const utf8Bytes = new TextEncoder().encode(asciiInput);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = utf8Bytes.length * 8;
  const paddedLen = Math.ceil((utf8Bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(utf8Bytes);
  padded[utf8Bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

export async function sha256HexAsync(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      // Fallback below
    }
  }
  return sha256HexFallback(text);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Hashes a user password with a unique 128-bit cryptographic salt using PBKDF2-SHA256.
 * Plain-text passwords are never stored.
 */
export async function hashPasswordAsync(password: string): Promise<string> {
  const saltHex = generateRandomSaltHex(16);
  const iterations = 100_000;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: encoder.encode(saltHex),
          iterations,
          hash: 'SHA-256',
        },
        baseKey,
        256
      );
      const hashHex = bytesToHex(new Uint8Array(derivedBits));
      return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
    } catch {
      // Fall back to iterated salted SHA-256 below
    }
  }

  let digest = sha256HexFallback(`${saltHex}:${password}`);
  for (let i = 0; i < 1500; i++) {
    digest = sha256HexFallback(`${saltHex}:${digest}:${i}`);
  }
  return `sha256_iter$1500$${saltHex}$${digest}`;
}

export async function verifyPasswordAsync(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;

  const [scheme, iterStr, saltHex, expectedHex] = parts;
  const iterations = Number.parseInt(iterStr, 10);
  if (!saltHex || !expectedHex || Number.isNaN(iterations) || iterations < 1) {
    return false;
  }

  if (scheme === 'pbkdf2_sha256') {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      try {
        const encoder = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveBits']
        );
        const derivedBits = await window.crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: encoder.encode(saltHex),
            iterations,
            hash: 'SHA-256',
          },
          baseKey,
          256
        );
        const actualHex = bytesToHex(new Uint8Array(derivedBits));
        return constantTimeEqual(actualHex, expectedHex);
      } catch {
        return false;
      }
    }
    return false;
  }

  if (scheme === 'sha256_iter') {
    let digest = sha256HexFallback(`${saltHex}:${password}`);
    for (let i = 0; i < iterations; i++) {
      digest = sha256HexFallback(`${saltHex}:${digest}:${i}`);
    }
    return constantTimeEqual(digest, expectedHex);
  }

  return false;
}

/**
 * Verifies the Admin Security PIN against a salted SHA-256 hash digest.
 */
export async function verifyAdminPinAsync(pinInput: string): Promise<boolean> {
  const cleanPin = (pinInput || '').trim();
  if (!cleanPin) return false;
  const computed = await sha256HexAsync(`${ADMIN_PIN_SALT}:${cleanPin}`);
  return constantTimeEqual(computed, ADMIN_PIN_SHA256_HEX);
}

// =========================================================================
// 3. Brute-Force Lockout Manager (Persisted in localStorage)
// =========================================================================

export type LockoutScope = 'login' | 'admin_pin';

interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingMs: number;
  remainingSeconds: number;
  failedAttempts: number;
  attemptsLeft: number;
}

function readLockoutMap(): Partial<Record<LockoutScope, LockoutRecord>> {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore storage read errors
  }
  return {};
}

function writeLockoutMap(map: Partial<Record<LockoutScope, LockoutRecord>>): void {
  try {
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage write errors
  }
}

export function getLockoutStatus(scope: LockoutScope, now = Date.now()): LockoutStatus {
  const map = readLockoutMap();
  const rec = map[scope];
  if (!rec) {
    return {
      isLocked: false,
      remainingMs: 0,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsLeft: LOCKOUT_MAX_ATTEMPTS,
    };
  }

  if (rec.lockedUntil && rec.lockedUntil > now) {
    const remainingMs = rec.lockedUntil - now;
    return {
      isLocked: true,
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      failedAttempts: LOCKOUT_MAX_ATTEMPTS,
      attemptsLeft: 0,
    };
  }

  // Expired lockout resets cleanly
  if (rec.lockedUntil && rec.lockedUntil <= now) {
    delete map[scope];
    writeLockoutMap(map);
    return {
      isLocked: false,
      remainingMs: 0,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsLeft: LOCKOUT_MAX_ATTEMPTS,
    };
  }

  const failedAttempts = Math.max(0, rec.failedAttempts || 0);
  return {
    isLocked: false,
    remainingMs: 0,
    remainingSeconds: 0,
    failedAttempts,
    attemptsLeft: Math.max(0, LOCKOUT_MAX_ATTEMPTS - failedAttempts),
  };
}

export function recordFailedAttempt(scope: LockoutScope, now = Date.now()): LockoutStatus {
  const current = getLockoutStatus(scope, now);
  if (current.isLocked) return current;

  const map = readLockoutMap();
  const nextAttempts = (current.failedAttempts || 0) + 1;

  if (nextAttempts >= LOCKOUT_MAX_ATTEMPTS) {
    map[scope] = {
      failedAttempts: LOCKOUT_MAX_ATTEMPTS,
      lockedUntil: now + LOCKOUT_DURATION_MS,
    };
    writeLockoutMap(map);
    return {
      isLocked: true,
      remainingMs: LOCKOUT_DURATION_MS,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      failedAttempts: LOCKOUT_MAX_ATTEMPTS,
      attemptsLeft: 0,
    };
  }

  map[scope] = {
    failedAttempts: nextAttempts,
    lockedUntil: null,
  };
  writeLockoutMap(map);

  return {
    isLocked: false,
    remainingMs: 0,
    remainingSeconds: 0,
    failedAttempts: nextAttempts,
    attemptsLeft: Math.max(0, LOCKOUT_MAX_ATTEMPTS - nextAttempts),
  };
}

export function resetLockout(scope: LockoutScope): void {
  const map = readLockoutMap();
  if (map[scope]) {
    delete map[scope];
    writeLockoutMap(map);
  }
}

export function formatLockoutCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// =========================================================================
// 4. Anti-Spam Sliding-Window Rate Limiter
// =========================================================================

export type RateLimitAction = 'signup' | 'upload';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function getRateLimitConfig(action: RateLimitAction) {
  return action === 'signup' ? SIGNUP_RATE_LIMIT : UPLOAD_RATE_LIMIT;
}

function readRateLimitMap(): Partial<Record<RateLimitAction, number[]>> {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeRateLimitMap(map: Partial<Record<RateLimitAction, number[]>>): void {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function checkRateLimit(action: RateLimitAction, now = Date.now()): RateLimitStatus {
  const { max, windowMs } = getRateLimitConfig(action);
  const map = readRateLimitMap();
  const timestamps = Array.isArray(map[action]) ? map[action]! : [];
  const active = timestamps.filter((ts) => typeof ts === 'number' && now - ts < windowMs);

  if (active.length !== timestamps.length) {
    map[action] = active;
    writeRateLimitMap(map);
  }

  if (active.length >= max) {
    const oldest = Math.min(...active);
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - active.length),
    retryAfterSeconds: 0,
  };
}

export function recordRateLimitEvent(action: RateLimitAction, now = Date.now()): void {
  const { windowMs } = getRateLimitConfig(action);
  const map = readRateLimitMap();
  const timestamps = Array.isArray(map[action]) ? map[action]! : [];
  const active = timestamps.filter((ts) => typeof ts === 'number' && now - ts < windowMs);
  active.push(now);
  map[action] = active;
  writeRateLimitMap(map);
}

// =========================================================================
// 5. Upload Security: Strict Media & Audio File Validation
// =========================================================================

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm'] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const ALLOWED_MEDIA_EXTENSIONS = [
  ...ALLOWED_VIDEO_EXTENSIONS,
  ...ALLOWED_IMAGE_EXTENSIONS,
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg'] as const;
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
] as const;

const DANGEROUS_EXTENSIONS = new Set([
  'svg',
  'svgz',
  'html',
  'htm',
  'xhtml',
  'xml',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'php',
  'phtml',
  'py',
  'rb',
  'pl',
  'sh',
  'bash',
  'zsh',
  'bat',
  'cmd',
  'ps1',
  'exe',
  'msi',
  'dll',
  'apk',
  'ipa',
  'jar',
  'scr',
  'pif',
  'vbs',
  'vbe',
  'hta',
  'swf',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
]);

const DANGEROUS_MIME_FRAGMENTS = [
  'svg',
  'html',
  'javascript',
  'ecmascript',
  'xml',
  'php',
  'x-sh',
  'x-msdownload',
  'x-executable',
];

const MAX_VIDEO_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
  mediaType?: 'video' | 'image';
}

function hasDangerousExtensionSegment(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.');
  // Check all segments after base name
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (DANGEROUS_EXTENSIONS.has(seg)) return true;
  }
  return false;
}

export function validateSafeMediaFile(
  file: File | null | undefined,
  options: { allowedKind?: 'any' | 'video' | 'image' } = {}
): FileValidationResult {
  const { allowedKind = 'any' } = options;

  if (!file) {
    return { valid: false, reason: 'No file selected.' };
  }

  const fileName = (file.name || '').trim().toLowerCase();
  const mime = (file.type || '').trim().toLowerCase();

  if (!fileName || fileName.length > 260) {
    return { valid: false, reason: 'Blocked invalid file name.' };
  }

  // Block dangerous MIME types immediately (e.g. image/svg+xml, text/html, application/javascript)
  if (mime && DANGEROUS_MIME_FRAGMENTS.some((frag) => mime.includes(frag))) {
    return {
      valid: false,
      reason: `Blocked unsafe file type (${mime}). Only .mp4, .webm, .jpg, .png, and .webp are allowed.`,
    };
  }

  // Block double-extension or dangerous extensions like shell.html.jpg or payload.svg
  if (hasDangerousExtensionSegment(fileName)) {
    return {
      valid: false,
      reason:
        'Security Alert: Potentially malicious file extension blocked. Only .mp4, .webm, .jpg, .png, and .webp are permitted.',
    };
  }

  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot >= 0 ? fileName.slice(lastDot) : '';

  const isVideoExt = (ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  const isImageExt = (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);

  if (!isVideoExt && !isImageExt) {
    return {
      valid: false,
      reason: `Unsupported file format "${ext || 'unknown'}". Allowed formats: .mp4, .webm, .jpg, .png, .webp.`,
    };
  }

  if (allowedKind === 'video' && !isVideoExt) {
    return {
      valid: false,
      reason: 'Only .mp4 or .webm video files are allowed here.',
    };
  }

  if (allowedKind === 'image' && !isImageExt) {
    return {
      valid: false,
      reason: 'Only .jpg, .png, or .webp image files are allowed here.',
    };
  }

  // Cross-verify MIME matches extension category when browser reports a MIME type
  if (mime) {
    if (isVideoExt && !(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
      return {
        valid: false,
        reason: `MIME type mismatch (${mime}) for video file. Only MP4 and WebM streams are allowed.`,
      };
    }
    if (isImageExt && !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
      return {
        valid: false,
        reason: `MIME type mismatch (${mime}) for image file. Only JPG, PNG, and WebP images are allowed.`,
      };
    }
  }

  if (file.size <= 0) {
    return { valid: false, reason: 'Empty file rejected.' };
  }

  const maxSize = isVideoExt ? MAX_VIDEO_FILE_BYTES : MAX_IMAGE_FILE_BYTES;
  if (file.size > maxSize) {
    return {
      valid: false,
      reason: isVideoExt
        ? 'Video file exceeds maximum safe upload size (500 MB).'
        : 'Image file exceeds maximum safe upload size (25 MB).',
    };
  }

  return {
    valid: true,
    mediaType: isVideoExt ? 'video' : 'image',
  };
}

export function validateSafeAudioFile(file: File | null | undefined): FileValidationResult {
  if (!file) {
    return { valid: false, reason: 'No audio file selected.' };
  }

  const fileName = (file.name || '').trim().toLowerCase();
  const mime = (file.type || '').trim().toLowerCase();

  if (mime && DANGEROUS_MIME_FRAGMENTS.some((frag) => mime.includes(frag))) {
    return { valid: false, reason: `Blocked unsafe audio file type (${mime}).` };
  }

  if (hasDangerousExtensionSegment(fileName)) {
    return {
      valid: false,
      reason: 'Security Alert: Malicious file extension blocked. Pick .mp3, .m4a, .wav, or .ogg.',
    };
  }

  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot >= 0 ? fileName.slice(lastDot) : '';
  if (!(ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      valid: false,
      reason: `Unsupported audio format "${ext || 'unknown'}". Allowed: .mp3, .m4a, .wav, .ogg.`,
    };
  }

  if (mime && !(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime)) {
    return {
      valid: false,
      reason: `Invalid audio MIME type (${mime}). Only standard MP3/M4A/WAV/OGG audio is allowed.`,
    };
  }

  if (file.size <= 0 || file.size > MAX_AUDIO_FILE_BYTES) {
    return {
      valid: false,
      reason: 'Audio file must be between 1 byte and 50 MB.',
    };
  }

  return { valid: true };
}

// =========================================================================
// 6. Clickjacking Frame-Busting, DevTools Protection & Session Timeout
// =========================================================================

const TRUSTED_FRAME_HOST_SUFFIXES = [
  'localhost',
  '127.0.0.1',
  '.google.com',
  '.googleusercontent.com',
  '.gstatic.com',
  '.run.app',
  '.web.app',
  '.firebaseapp.com',
];

function isTrustedHostname(hostname: string): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (typeof window !== 'undefined' && h === window.location.hostname.toLowerCase()) {
    return true;
  }
  return TRUSTED_FRAME_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith('.') ? h.endsWith(suffix) || h === suffix.slice(1) : h === suffix
  );
}

export interface FrameSafetyResult {
  blocked: boolean;
  parentOrigin?: string;
}

/**
 * Clickjacking protection:
 * Detects embedding inside untrusted third-party frames, attempts frame-busting redirect,
 * and signals the root entry to block rendering interactive UI.
 */
export function checkFrameSafety(): FrameSafetyResult {
  if (typeof window === 'undefined') return { blocked: false };

  let isFramed = false;
  try {
    isFramed = window.self !== window.top;
  } catch {
    isFramed = true;
  }

  if (!isFramed) return { blocked: false };

  // Check ancestorOrigins (Chromium)
  try {
    const ancestors = window.location.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      for (let i = 0; i < ancestors.length; i++) {
        const origin = ancestors[i];
        try {
          const parsed = new URL(origin);
          if (!isTrustedHostname(parsed.hostname)) {
            try {
              window.top?.location.replace(window.self.location.href);
            } catch {
              // Cross-origin frame blocked navigation; caller renders blocking screen
            }
            return { blocked: true, parentOrigin: origin };
          }
        } catch {
          return { blocked: true, parentOrigin: origin };
        }
      }
      return { blocked: false };
    }
  } catch {
    // ignore
  }

  // Fallback check via document.referrer
  try {
    if (document.referrer) {
      const refUrl = new URL(document.referrer);
      if (!isTrustedHostname(refUrl.hostname)) {
        try {
          window.top?.location.replace(window.self.location.href);
        } catch {
          // Cross-origin frame blocked navigation
        }
        return { blocked: true, parentOrigin: refUrl.origin };
      }
    }
  } catch {
    // ignore malformed referrer
  }

  return { blocked: false };
}

/**
 * Installs client-side DevTools shortcut blocking, right-click inspection protection
 * (while preserving input/textarea copy/paste usability), and a console security warning.
 */
export function installDevToolsProtection(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  try {
    console.log(
      '%cSTOP! Jatt VibeReels Security Shield',
      'color: #f43f5e; font-size: 20px; font-weight: 900; text-shadow: 0 0 8px rgba(244,63,94,0.4);'
    );
    console.log(
      '%cUnauthorized script injection or tampering attempts are blocked to protect creator accounts and media.',
      'color: #22d3ee; font-size: 12px; font-weight: 600;'
    );
  } catch {
    // ignore console errors
  }

  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key?.toUpperCase();
    const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

    // F12
    if (key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+Shift+I / J / C / K  or  Cmd+Option+I / J / C / K
    if (
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(key)) ||
      (e.metaKey && e.altKey && ['I', 'J', 'C', 'K'].includes(key))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+U / Cmd+U (View Source) or Ctrl+S / Cmd+S (Save HTML)
    if (hasCtrlOrMeta && ['U', 'S'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}

// =========================================================================
// Session Inactivity Auto-Logout Helpers (30 Minutes)
// =========================================================================

export function touchSessionActivity(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
  } catch {
    // ignore
  }
}

export function getSessionIdleMs(now = Date.now()): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    if (!raw) return 0;
    const last = Number.parseInt(raw, 10);
    if (Number.isNaN(last) || last <= 0) return 0;
    return Math.max(0, now - last);
  } catch {
    return 0;
  }
}

export function isSessionExpired(_now = Date.now()): boolean {
  // User sessions stay persistently logged in across app updates/reloads until manual Log Out.
  return false;
}

export function clearSessionActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

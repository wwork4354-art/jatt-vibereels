import { UserAccount } from '../types';
import { sanitizeSafeUrl, sanitizeText, sanitizeUsername } from '../utils/security';

export const MAIN_ADMIN_EMAIL = 'wwork4354@gmail.com';
export const MAIN_ADMIN_USERNAME = 'admin';
export const MAIN_ADMIN_ALT_USERNAME = 'jatt_vibereels_admin';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Admin System',
    username: 'admin',
    email: MAIN_ADMIN_EMAIL,
    phone: '+92 300 0000001',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminVibe&backgroundColor=ec4899',
    role: 'admin',
    status: 'active',
    joinedAt: 'Nov 2026',
    createdAtIso: '2026-11-01T09:00:00.000Z',
    lastActiveAt: new Date().toISOString(),
    isOnline: true,
    videosCount: 6,
    bio: 'Main Platform Administrator & Owner',
  },
  {
    id: 'usr-creator-1',
    name: 'Dr. Stella Vance',
    username: 'cosmic_explorer',
    email: 'stella@nasa.gov',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=StellaCosmic&backgroundColor=6366f1',
    role: 'creator',
    status: 'active',
    joinedAt: 'Oct 2026',
    createdAtIso: '2026-10-14T14:20:00.000Z',
    lastActiveAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    videosCount: 14,
    bio: 'Astrophysicist sharing the wonders of space exploration.',
  },
  {
    id: 'usr-creator-2',
    name: 'Kenji Takahashi',
    username: 'neon_shibuya',
    email: 'kenji@tokyovibes.jp',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Kenji&backgroundColor=ec4899',
    role: 'creator',
    status: 'active',
    joinedAt: 'Oct 2026',
    createdAtIso: '2026-10-20T18:45:00.000Z',
    lastActiveAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    videosCount: 22,
    bio: 'Cinematographer documenting nocturnal city aesthetics across East Asia.',
  },
  {
    id: 'usr-creator-3',
    name: 'Julian Vance',
    username: 'slow_bar_coffee',
    email: 'julian@slowbar.coffee',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=JulianCoffee&backgroundColor=d97706',
    role: 'creator',
    status: 'active',
    joinedAt: 'Sep 2026',
    createdAtIso: '2026-09-25T08:15:00.000Z',
    lastActiveAt: new Date(Date.now() - 48 * 60_000).toISOString(),
    videosCount: 9,
    bio: 'Q-Grader and artisan coffee roaster.',
  },
  {
    id: 'usr-user-1',
    name: 'Nova Chase',
    username: 'novachase',
    email: 'nova.chase@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nova',
    role: 'user',
    status: 'active',
    joinedAt: 'Nov 2026',
    createdAtIso: '2026-11-05T11:30:00.000Z',
    lastActiveAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    videosCount: 2,
    bio: 'Music enthusiast and night owl.',
  },
  {
    id: 'usr-user-2',
    name: 'Marcus Bell',
    username: 'marcus_groove',
    email: 'marcus@soundwave.io',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    role: 'user',
    status: 'active',
    joinedAt: 'Nov 2026',
    createdAtIso: '2026-11-09T16:10:00.000Z',
    lastActiveAt: new Date(Date.now() - 90 * 60_000).toISOString(),
    videosCount: 1,
    bio: 'Street percussionist and drummer.',
  },
  {
    id: 'usr-user-3',
    name: 'Spam Bot 404',
    username: 'crypto_giveaway_99',
    email: 'suspicious@botnet.xyz',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SpamBot&backgroundColor=ef4444',
    role: 'user',
    status: 'suspended',
    joinedAt: 'Nov 2026',
    createdAtIso: '2026-11-12T04:05:00.000Z',
    lastActiveAt: '2026-11-12T04:05:00.000Z',
    videosCount: 0,
    bio: 'Flagged for automated spam promotion.',
  },
];

export const STORAGE_USERS_KEY = 'vibereels_users_data';
export const STORAGE_CURRENT_USER_KEY = 'vibereels_current_user';
export const STORAGE_PERSISTENT_AUTH_TOKEN_KEY = 'vibereels_persistent_auth_token';

export interface PersistentAuthToken {
  token: string;
  userId: string;
  username: string;
  issuedAt: string;
  persistent: true;
}

function generatePersistentToken(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const arr = new Uint8Array(24);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  return `vr_tok_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function writePersistentAuthToken(user: UserAccount): void {
  try {
    const existingRaw = localStorage.getItem(STORAGE_PERSISTENT_AUTH_TOKEN_KEY);
    let tokenStr = '';
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as Partial<PersistentAuthToken>;
      if (
        existing &&
        typeof existing.token === 'string' &&
        existing.token &&
        existing.userId === user.id
      ) {
        tokenStr = existing.token;
      }
    }
    const payload: PersistentAuthToken = {
      token: tokenStr || generatePersistentToken(),
      userId: user.id,
      username: user.username,
      issuedAt: new Date().toISOString(),
      persistent: true,
    };
    localStorage.setItem(STORAGE_PERSISTENT_AUTH_TOKEN_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearPersistentAuthToken(): void {
  try {
    localStorage.removeItem(STORAGE_PERSISTENT_AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Strictly restricts Admin privileges & Admin Dashboard / Registered App Users Tracker
 * exclusively to the logged-in Main Admin account (@jatt_vibereels_admin, @admin, or wwork4354@gmail.com).
 */
export function isMainAdminAccount(user: UserAccount | null | undefined): boolean {
  if (!user || typeof user !== 'object') return false;
  if (user.role !== 'admin') return false;
  const emailLower = (user.email || '').trim().toLowerCase();
  const usernameLower = (user.username || '').trim().toLowerCase().replace(/^@+/, '');
  if (!emailLower && !usernameLower) return false;
  return (
    emailLower === MAIN_ADMIN_EMAIL ||
    usernameLower === MAIN_ADMIN_USERNAME ||
    usernameLower === MAIN_ADMIN_ALT_USERNAME
  );
}

export function isUserOnlineNow(user: UserAccount, nowMs = Date.now()): boolean {
  if (user.status === 'suspended') return false;
  if (user.lastActiveAt) {
    const t = new Date(user.lastActiveAt).getTime();
    if (!Number.isNaN(t) && nowMs - t <= 5 * 60_000) {
      return true;
    }
  }
  return Boolean(user.isOnline);
}

export function formatAccountCreatedDateTime(user: UserAccount): {
  dateLabel: string;
  timeLabel: string;
} {
  const iso = user.createdAtIso;
  if (iso) {
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) {
      return {
        dateLabel: dt.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        timeLabel: dt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    }
  }
  return {
    dateLabel: user.joinedAt || 'Nov 2026',
    timeLabel: 'Registered',
  };
}

function sanitizeStoredUser(raw: UserAccount & { password?: unknown }): UserAccount {
  const { password: _discardedPlaintextPassword, ...rest } = raw;
  const cleanHandle = sanitizeUsername(rest.username || 'user', 40) || 'user';
  return {
    ...rest,
    id: sanitizeText(rest.id || '', 80) || `usr-${Date.now()}`,
    name: sanitizeText(rest.name || cleanHandle, 80) || cleanHandle,
    username: cleanHandle,
    email: sanitizeText(rest.email || '', 120).toLowerCase(),
    phone: rest.phone ? sanitizeText(rest.phone, 32) : undefined,
    avatar:
      sanitizeSafeUrl(rest.avatar || '') ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanHandle)}&backgroundColor=ec4899`,
    bio: rest.bio ? sanitizeText(rest.bio, 240) : undefined,
    createdAtIso: rest.createdAtIso || undefined,
    lastActiveAt: rest.lastActiveAt || undefined,
  };
}

/**
 * Checks legacy pre-hash password stored directly on a user record in localStorage (if any).
 * Returns:
 * - true: legacy plaintext password matches
 * - false: legacy plaintext password exists and does NOT match
 * - null: no legacy plaintext password was recorded (seamless upgrade allowed)
 */
export function verifyLegacyPasswordForUser(
  userId: string,
  username: string,
  candidatePassword: string
): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const targetLower = (username || '').trim().toLowerCase();
    const matched = parsed.find(
      (item: Record<string, unknown>) =>
        item &&
        (item.id === userId ||
          (typeof item.username === 'string' && item.username.toLowerCase() === targetLower))
    ) as Record<string, unknown> | undefined;
    if (matched && typeof matched.password === 'string' && matched.password.length > 0) {
      return matched.password === candidatePassword;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export const getStoredUsers = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((u: UserAccount) => sanitizeStoredUser(u));
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_USERS;
};

export const saveStoredUsers = (users: UserAccount[]): void => {
  try {
    const sanitized = users.map((u) => sanitizeStoredUser(u));
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore
  }
};

export const getStoredCurrentUser = (): UserAccount | null => {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const clean = sanitizeStoredUser(parsed);
        // Never keep passwordHash inside active session object
        const { passwordHash: _omitHash, ...sessionUser } = clean;
        // Ensure permanent persistent auth token is synced for existing sessions
        writePersistentAuthToken(sessionUser);
        return sessionUser;
      }
    }

    // Fallback: restore permanent logged-in session from persistent auth token across updates
    const tokenRaw = localStorage.getItem(STORAGE_PERSISTENT_AUTH_TOKEN_KEY);
    if (tokenRaw) {
      const tokenData = JSON.parse(tokenRaw) as Partial<PersistentAuthToken>;
      if (tokenData && tokenData.token && (tokenData.userId || tokenData.username)) {
        const allUsers = getStoredUsers();
        const found = allUsers.find(
          (u) =>
            u.status !== 'suspended' &&
            ((tokenData.userId && u.id === tokenData.userId) ||
              (tokenData.username &&
                u.username.toLowerCase() === tokenData.username.toLowerCase()))
        );
        if (found) {
          const { passwordHash: _omitHash, ...sessionUser } = found;
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(sessionUser));
          return sessionUser;
        }
      }
    }
  } catch {
    // fallback
  }
  return null;
};

export const saveStoredCurrentUser = (user: UserAccount | null): void => {
  try {
    if (user) {
      const clean = sanitizeStoredUser(user);
      const { passwordHash: _omitHash, ...sessionUser } = clean;
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(sessionUser));
      writePersistentAuthToken(sessionUser);
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      clearPersistentAuthToken();
    }
  } catch {
    // ignore
  }
};

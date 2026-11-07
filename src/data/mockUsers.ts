import { UserAccount } from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-admin-1',
    name: 'Admin System',
    username: 'admin',
    email: 'wwork4354@gmail.com',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminVibe&backgroundColor=ec4899',
    role: 'admin',
    status: 'active',
    joinedAt: 'Nov 2026',
    videosCount: 6,
    bio: 'Platform Administrator & Content Operations',
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
    videosCount: 0,
    bio: 'Flagged for automated spam promotion.',
  },
];

const STORAGE_USERS_KEY = 'vibereels_users_data';
const STORAGE_CURRENT_USER_KEY = 'vibereels_current_user';

export const getStoredUsers = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return INITIAL_USERS;
};

export const saveStoredUsers = (users: UserAccount[]): void => {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
};

export const getStoredCurrentUser = (): UserAccount | null => {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return null;
};

export const saveStoredCurrentUser = (user: UserAccount | null): void => {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    }
  } catch {
    // ignore
  }
};

import { FeedTab } from '../types';

const PLAYBACK_STATE_KEY = 'jatt_vibereels_playback_state_v1';
const VIDEO_TIMESTAMPS_KEY = 'jatt_vibereels_video_times_v1';

export interface SavedPlaybackState {
  videoId: string;
  activeTab: FeedTab;
  selectedTag: string | null;
  selectedChannelUsername: string | null;
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

const VALID_TABS: ReadonlySet<FeedTab> = new Set<FeedTab>([
  'foryou',
  'following',
  'trending',
  'saved',
  'live',
  'downloads',
  'profile',
  'activity',
  'channel',
]);

let inMemoryPlaybackState: SavedPlaybackState | null = null;

function readStorageJson<T>(key: string): T | null {
  try {
    const sessRaw = window.sessionStorage.getItem(key);
    if (sessRaw) {
      return JSON.parse(sessRaw) as T;
    }
  } catch {
    // ignore sessionStorage read errors
  }

  try {
    const localRaw = window.localStorage.getItem(key);
    if (localRaw) {
      return JSON.parse(localRaw) as T;
    }
  } catch {
    // ignore localStorage read errors
  }

  return null;
}

function writeBothStorages(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(key, serialized);
  } catch {
    // ignore quota errors
  }
  try {
    window.localStorage.setItem(key, serialized);
  } catch {
    // ignore quota errors
  }
}

export function loadPlaybackState(): SavedPlaybackState | null {
  if (inMemoryPlaybackState) {
    return inMemoryPlaybackState;
  }

  const parsed = readStorageJson<Partial<SavedPlaybackState>>(PLAYBACK_STATE_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const activeTab: FeedTab =
    parsed.activeTab && VALID_TABS.has(parsed.activeTab) ? parsed.activeTab : 'foryou';

  const normalized: SavedPlaybackState = {
    videoId: typeof parsed.videoId === 'string' ? parsed.videoId : '',
    activeTab,
    selectedTag: typeof parsed.selectedTag === 'string' ? parsed.selectedTag : null,
    selectedChannelUsername:
      typeof parsed.selectedChannelUsername === 'string' ? parsed.selectedChannelUsername : null,
    currentTime:
      typeof parsed.currentTime === 'number' && Number.isFinite(parsed.currentTime) && parsed.currentTime >= 0
        ? parsed.currentTime
        : 0,
    isPlaying: typeof parsed.isPlaying === 'boolean' ? parsed.isPlaying : true,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
  };

  inMemoryPlaybackState = normalized;
  return normalized;
}

export function savePlaybackState(patch: Partial<SavedPlaybackState>): SavedPlaybackState {
  const current = loadPlaybackState() || {
    videoId: '',
    activeTab: 'foryou' as FeedTab,
    selectedTag: null,
    selectedChannelUsername: null,
    currentTime: 0,
    isPlaying: true,
    updatedAt: Date.now(),
  };

  const next: SavedPlaybackState = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };

  inMemoryPlaybackState = next;
  writeBothStorages(PLAYBACK_STATE_KEY, next);
  return next;
}

export function getSavedVideoTimestamp(videoId: string): number {
  if (!videoId) return 0;

  // Prefer active state timestamp if matching the same video ID
  const state = loadPlaybackState();
  if (state && state.videoId === videoId && state.currentTime > 0) {
    return state.currentTime;
  }

  const map = readStorageJson<Record<string, number>>(VIDEO_TIMESTAMPS_KEY);
  if (map && typeof map[videoId] === 'number' && Number.isFinite(map[videoId]) && map[videoId] >= 0) {
    return map[videoId];
  }
  return 0;
}

export function saveVideoTimestamp(videoId: string, seconds: number, isPlaying = true): void {
  if (!videoId || !Number.isFinite(seconds) || seconds < 0) return;

  const cleanSeconds = Math.round(seconds * 100) / 100;
  savePlaybackState({
    videoId,
    currentTime: cleanSeconds,
    isPlaying,
  });

  const map = readStorageJson<Record<string, number>>(VIDEO_TIMESTAMPS_KEY) || {};
  map[videoId] = cleanSeconds;

  // Keep map bounded to latest 50 videos
  const entries = Object.entries(map);
  const bounded = entries.length > 50 ? Object.fromEntries(entries.slice(-50)) : map;
  writeBothStorages(VIDEO_TIMESTAMPS_KEY, bounded);
}

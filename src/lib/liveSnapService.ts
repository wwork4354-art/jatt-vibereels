import { supabase, isSupabaseConfigured } from './supabase';
import {
  CreatorProfileData,
  DirectSnapMessage,
  DirectSnapRecipient,
  LiveStoryItem,
  UserAccount,
  VideoPost,
} from '../types';
import {
  fileToPersistentDataUrl,
  normalizeCreatorUsername,
  searchCreatorsDirectory,
  uploadMediaToReelsBucket,
} from './supabaseService';
import { sanitizeText, sanitizeUsername, sanitizeSafeUrl } from '../utils/security';

const LIVE_STORIES_STORAGE_KEY = 'jatt_live_stories_v1';
const DIRECT_SNAPS_STORAGE_KEY = 'jatt_direct_snaps_v1';
const SNAP_REALTIME_CHANNEL = 'vibereels-snaps-realtime';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const optionalTablesAvailable = {
  liveStories: true,
  directSnaps: true,
};

function isMissingTableOrColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

// =========================================================================
// 24-Hour Live Stories Helpers
// =========================================================================
export function isStoryActive(story: LiveStoryItem, nowMs = Date.now()): boolean {
  const exp = new Date(story.expiresAt).getTime();
  return Number.isFinite(exp) && exp > nowMs;
}

export function getStoredLiveStories(): LiveStoryItem[] {
  try {
    const raw = localStorage.getItem(LIVE_STORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const active = parsed.filter(
      (s: LiveStoryItem) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.mediaUrl === 'string' &&
        isStoryActive(s, now)
    );
    if (active.length !== parsed.length) {
      localStorage.setItem(LIVE_STORIES_STORAGE_KEY, JSON.stringify(active));
    }
    return active;
  } catch {
    return [];
  }
}

export function saveStoredLiveStories(stories: LiveStoryItem[]): void {
  try {
    const now = Date.now();
    const active = stories
      .filter((s) => isStoryActive(s, now) && s.mediaUrl && !s.mediaUrl.startsWith('blob:'))
      .slice(0, 80);
    localStorage.setItem(LIVE_STORIES_STORAGE_KEY, JSON.stringify(active));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchActiveLiveStories(): Promise<LiveStoryItem[]> {
  const localStories = getStoredLiveStories();
  if (!supabase || !isSupabaseConfigured || !optionalTablesAvailable.liveStories) {
    return localStories;
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('live_stories')
      .select('*')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      if (isMissingTableOrColumn(error)) {
        optionalTablesAvailable.liveStories = false;
      }
      return localStories;
    }

    if (!Array.isArray(data)) return localStories;

    const remoteStories: LiveStoryItem[] = data
      .filter((row) => row && row.media_url && sanitizeSafeUrl(String(row.media_url)))
      .map((row) => {
        const safeUsername = sanitizeUsername(String(row.username || 'creator')) || 'creator';
        return {
          id: String(row.id),
          userId: String(row.user_id || ''),
          username: safeUsername,
          displayName: sanitizeText(String(row.display_name || safeUsername), 60) || safeUsername,
          avatarUrl:
            sanitizeSafeUrl(String(row.avatar_url || '')) ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
              safeUsername
            )}&backgroundColor=ec4899`,
          mediaUrl: sanitizeSafeUrl(String(row.media_url)),
          mediaType: row.media_type === 'image' ? 'image' : 'video',
          caption: row.caption ? sanitizeText(String(row.caption), 160) || undefined : undefined,
          filterName: row.filter_name
            ? sanitizeText(String(row.filter_name), 40) || undefined
            : undefined,
          createdAt: String(row.created_at || nowIso),
          expiresAt: String(
            row.expires_at || new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString()
          ),
          viewedByIds: Array.isArray(row.viewed_by_ids) ? row.viewed_by_ids.map(String) : [],
          isSupabaseBacked: true,
        };
      });

    const seen = new Set(remoteStories.map((s) => s.id));
    const merged = [
      ...remoteStories,
      ...localStories.filter((s) => !seen.has(s.id)),
    ].filter((s) => isStoryActive(s));

    saveStoredLiveStories(merged);
    return merged;
  } catch {
    return localStories;
  }
}

export async function publishLiveStory(params: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  mediaBlob: Blob | null;
  fallbackMediaUrl: string;
  mediaType: 'video' | 'image';
  caption?: string;
  filterName?: string;
}): Promise<LiveStoryItem> {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + TWENTY_FOUR_HOURS_MS).toISOString();
  const id = `story-${now}-${Math.random().toString(36).slice(2, 7)}`;

  let finalMediaUrl = params.fallbackMediaUrl;
  const isDeviceOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (params.mediaBlob) {
    if (isSupabaseConfigured && isDeviceOnline) {
      const ext = params.mediaType === 'image' ? 'jpg' : params.mediaBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const uploaded = await uploadMediaToReelsBucket(
        params.mediaBlob,
        'posts',
        `story-${now}.${ext}`
      );
      if (uploaded) {
        finalMediaUrl = uploaded;
      }
    }
    if (finalMediaUrl.startsWith('blob:')) {
      const dataUrl = await fileToPersistentDataUrl(params.mediaBlob, 3_500_000);
      if (dataUrl) {
        finalMediaUrl = dataUrl;
      }
    }
  }

  const safeUsername = sanitizeUsername(params.username) || 'creator';
  const safeDisplayName = sanitizeText(params.displayName, 60) || safeUsername;
  const safeAvatarUrl =
    sanitizeSafeUrl(params.avatarUrl) ||
    'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png';

  const newStory: LiveStoryItem = {
    id,
    userId: params.userId,
    username: safeUsername,
    displayName: safeDisplayName,
    avatarUrl: safeAvatarUrl,
    mediaUrl: sanitizeSafeUrl(finalMediaUrl),
    mediaType: params.mediaType,
    caption: params.caption ? sanitizeText(params.caption, 160) || undefined : undefined,
    filterName: params.filterName ? sanitizeText(params.filterName, 40) || undefined : undefined,
    createdAt,
    expiresAt,
    viewedByIds: [],
    isSupabaseBacked: false,
  };

  if (supabase && isSupabaseConfigured && isDeviceOnline) {
    if (optionalTablesAvailable.liveStories) {
      try {
        const { error } = await supabase.from('live_stories').insert([
          {
            id: newStory.id,
            user_id: newStory.userId,
            username: newStory.username,
            display_name: newStory.displayName,
            avatar_url: newStory.avatarUrl,
            media_url: newStory.mediaUrl,
            media_type: newStory.mediaType,
            caption: newStory.caption || null,
            filter_name: newStory.filterName || null,
            created_at: newStory.createdAt,
            expires_at: newStory.expiresAt,
            viewed_by_ids: [],
          },
        ]);
        if (error && isMissingTableOrColumn(error)) {
          optionalTablesAvailable.liveStories = false;
        } else if (!error) {
          newStory.isSupabaseBacked = true;
        }
      } catch {
        // fallback cleanly to local + realtime broadcast
      }
    }

    // Also broadcast live story event to connected clients
    try {
      const channel = supabase.channel(SNAP_REALTIME_CHANNEL);
      await channel.send({
        type: 'broadcast',
        event: 'live_story_created',
        payload: newStory,
      });
    } catch {
      // ignore broadcast errors
    }
  }

  const existing = getStoredLiveStories();
  saveStoredLiveStories([newStory, ...existing.filter((s) => s.id !== newStory.id)]);
  return newStory;
}

export async function markLiveStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const existing = getStoredLiveStories();
  let updatedViewed: string[] = [];
  const next = existing.map((s) => {
    if (s.id !== storyId) return s;
    const set = new Set(s.viewedByIds || []);
    set.add(viewerId);
    updatedViewed = Array.from(set);
    return { ...s, viewedByIds: updatedViewed };
  });
  saveStoredLiveStories(next);

  if (
    supabase &&
    isSupabaseConfigured &&
    optionalTablesAvailable.liveStories &&
    updatedViewed.length > 0
  ) {
    try {
      await supabase
        .from('live_stories')
        .update({ viewed_by_ids: updatedViewed })
        .eq('id', storyId);
    } catch {
      // ignore
    }
  }
}

export async function deleteLiveStoryById(storyId: string): Promise<void> {
  const next = getStoredLiveStories().filter((s) => s.id !== storyId);
  saveStoredLiveStories(next);

  if (supabase && isSupabaseConfigured && optionalTablesAvailable.liveStories) {
    try {
      await supabase.from('live_stories').delete().eq('id', storyId);
    } catch {
      // ignore
    }
  }
}

// =========================================================================
// Direct Snaps & DM Chat Helpers
// =========================================================================
export function getStoredDirectSnaps(): DirectSnapMessage[] {
  try {
    const raw = localStorage.getItem(DIRECT_SNAPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m: DirectSnapMessage) => m && typeof m.id === 'string');
  } catch {
    return [];
  }
}

export function saveStoredDirectSnaps(messages: DirectSnapMessage[]): void {
  try {
    const clean = messages
      .filter((m) => !m.mediaUrl || !m.mediaUrl.startsWith('blob:'))
      .slice(0, 150);
    localStorage.setItem(DIRECT_SNAPS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore quota errors
  }
}

export async function fetchDirectSnaps(): Promise<DirectSnapMessage[]> {
  const localMessages = getStoredDirectSnaps();
  if (!supabase || !isSupabaseConfigured || !optionalTablesAvailable.directSnaps) {
    return localMessages;
  }

  try {
    const { data, error } = await supabase
      .from('direct_snaps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      if (isMissingTableOrColumn(error)) {
        optionalTablesAvailable.directSnaps = false;
      }
      return localMessages;
    }

    if (!Array.isArray(data)) return localMessages;

    const remoteMessages: DirectSnapMessage[] = data.map((row) => {
      const safeSenderUname = sanitizeUsername(String(row.sender_username || '')) || 'user';
      const safeRecipUname = sanitizeUsername(String(row.recipient_username || '')) || 'friend';
      return {
        id: String(row.id),
        senderId: String(row.sender_id || ''),
        senderUsername: safeSenderUname,
        senderName: sanitizeText(String(row.sender_name || safeSenderUname || 'User'), 60),
        senderAvatar: sanitizeSafeUrl(String(row.sender_avatar || '')),
        recipientId: String(row.recipient_id || ''),
        recipientUsername: safeRecipUname,
        recipientName: sanitizeText(String(row.recipient_name || safeRecipUname || 'Friend'), 60),
        recipientAvatar: sanitizeSafeUrl(String(row.recipient_avatar || '')),
        mediaUrl: sanitizeSafeUrl(String(row.media_url || '')),
        mediaType: row.media_type === 'image' ? 'image' : 'video',
        caption: row.caption ? sanitizeText(String(row.caption), 160) || undefined : undefined,
        filterName: row.filter_name
          ? sanitizeText(String(row.filter_name), 40) || undefined
          : undefined,
        textMessage: row.text_message
          ? sanitizeText(String(row.text_message), 500) || undefined
          : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        isViewed: Boolean(row.is_viewed),
        isSupabaseBacked: true,
      };
    });

    const seen = new Set(remoteMessages.map((m) => m.id));
    const merged = [
      ...remoteMessages,
      ...localMessages.filter((m) => !seen.has(m.id)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    saveStoredDirectSnaps(merged);
    return merged;
  } catch {
    return localMessages;
  }
}

export async function sendDirectSnap(params: {
  sender: { id: string; name: string; username: string; avatar: string };
  recipient: DirectSnapRecipient;
  mediaBlob: Blob | null;
  fallbackMediaUrl: string;
  mediaType: 'video' | 'image';
  caption?: string;
  filterName?: string;
  textMessage?: string;
}): Promise<DirectSnapMessage> {
  const now = Date.now();
  const id = `dm-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date(now).toISOString();

  let finalMediaUrl = params.fallbackMediaUrl;
  const isDeviceOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (params.mediaBlob) {
    if (isSupabaseConfigured && isDeviceOnline) {
      const ext = params.mediaType === 'image' ? 'jpg' : params.mediaBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const uploaded = await uploadMediaToReelsBucket(
        params.mediaBlob,
        'posts',
        `snap-${now}.${ext}`
      );
      if (uploaded) {
        finalMediaUrl = uploaded;
      }
    }
    if (finalMediaUrl.startsWith('blob:')) {
      const dataUrl = await fileToPersistentDataUrl(params.mediaBlob, 3_500_000);
      if (dataUrl) {
        finalMediaUrl = dataUrl;
      }
    }
  }

  const newSnap: DirectSnapMessage = {
    id,
    senderId: params.sender.id,
    senderUsername: sanitizeUsername(params.sender.username) || 'user',
    senderName: sanitizeText(params.sender.name, 60) || 'User',
    senderAvatar: sanitizeSafeUrl(params.sender.avatar),
    recipientId: params.recipient.id,
    recipientUsername: sanitizeUsername(params.recipient.username) || 'friend',
    recipientName: sanitizeText(params.recipient.name, 60) || 'Friend',
    recipientAvatar: sanitizeSafeUrl(params.recipient.avatar),
    mediaUrl: sanitizeSafeUrl(finalMediaUrl),
    mediaType: params.mediaType,
    caption: params.caption ? sanitizeText(params.caption, 160) || undefined : undefined,
    filterName: params.filterName ? sanitizeText(params.filterName, 40) || undefined : undefined,
    textMessage: params.textMessage
      ? sanitizeText(params.textMessage, 500) || undefined
      : undefined,
    createdAt,
    isViewed: false,
    isSupabaseBacked: false,
  };

  if (supabase && isSupabaseConfigured && isDeviceOnline) {
    if (optionalTablesAvailable.directSnaps) {
      try {
        const { error } = await supabase.from('direct_snaps').insert([
          {
            id: newSnap.id,
            sender_id: newSnap.senderId,
            sender_username: newSnap.senderUsername,
            sender_name: newSnap.senderName,
            sender_avatar: newSnap.senderAvatar,
            recipient_id: newSnap.recipientId,
            recipient_username: newSnap.recipientUsername,
            recipient_name: newSnap.recipientName,
            recipient_avatar: newSnap.recipientAvatar,
            media_url: newSnap.mediaUrl,
            media_type: newSnap.mediaType,
            caption: newSnap.caption || null,
            filter_name: newSnap.filterName || null,
            text_message: newSnap.textMessage || null,
            created_at: newSnap.createdAt,
            is_viewed: false,
          },
        ]);
        if (error && isMissingTableOrColumn(error)) {
          optionalTablesAvailable.directSnaps = false;
        } else if (!error) {
          newSnap.isSupabaseBacked = true;
        }
      } catch {
        // fallback cleanly
      }
    }

    try {
      const channel = supabase.channel(SNAP_REALTIME_CHANNEL);
      await channel.send({
        type: 'broadcast',
        event: 'direct_snap_sent',
        payload: newSnap,
      });
    } catch {
      // ignore broadcast errors
    }
  }

  const existing = getStoredDirectSnaps();
  saveStoredDirectSnaps([newSnap, ...existing.filter((m) => m.id !== newSnap.id)]);
  return newSnap;
}

export async function markDirectSnapViewed(snapId: string): Promise<void> {
  const existing = getStoredDirectSnaps();
  const next = existing.map((m) => (m.id === snapId ? { ...m, isViewed: true } : m));
  saveStoredDirectSnaps(next);

  if (supabase && isSupabaseConfigured && optionalTablesAvailable.directSnaps) {
    try {
      await supabase.from('direct_snaps').update({ is_viewed: true }).eq('id', snapId);
    } catch {
      // ignore
    }
  }
}

export async function fetchDirectSendRecipients(
  allVideos: VideoPost[],
  ownProfile: CreatorProfileData,
  registeredUsers: UserAccount[]
): Promise<DirectSnapRecipient[]> {
  const ownClean = normalizeCreatorUsername(ownProfile.username);
  const byUsername = new Map<string, DirectSnapRecipient>();

  const creators = await searchCreatorsDirectory('', allVideos, ownProfile);
  for (const c of creators) {
    const clean = normalizeCreatorUsername(c.username);
    if (!clean || clean === ownClean || c.id === ownProfile.id) continue;
    byUsername.set(clean, {
      id: c.id,
      name: c.name,
      username: c.username,
      avatar: c.avatar,
      isVerified: c.isVerified,
    });
  }

  for (const u of registeredUsers) {
    if (u.status === 'suspended') continue;
    const clean = normalizeCreatorUsername(u.username);
    if (!clean || clean === ownClean || u.id === ownProfile.id) continue;
    if (!byUsername.has(clean)) {
      byUsername.set(clean, {
        id: u.id,
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        isVerified: u.role === 'admin' || u.role === 'creator',
      });
    }
  }

  return Array.from(byUsername.values());
}

export function subscribeToLiveSnapsRealtime(handlers: {
  onNewStory?: (story: LiveStoryItem) => void;
  onNewDirectSnap?: (snap: DirectSnapMessage) => void;
}): () => void {
  if (!supabase || !isSupabaseConfigured) {
    return () => {};
  }

  const client = supabase;
  const channel = client
    .channel(SNAP_REALTIME_CHANNEL)
    .on('broadcast', { event: 'live_story_created' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const story = payload as LiveStoryItem;
        if (story.id && isStoryActive(story)) {
          const existing = getStoredLiveStories();
          if (!existing.some((s) => s.id === story.id)) {
            saveStoredLiveStories([story, ...existing]);
          }
          handlers.onNewStory?.(story);
        }
      }
    })
    .on('broadcast', { event: 'direct_snap_sent' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const snap = payload as DirectSnapMessage;
        if (snap.id) {
          const existing = getStoredDirectSnaps();
          if (!existing.some((m) => m.id === snap.id)) {
            saveStoredDirectSnaps([snap, ...existing]);
          }
          handlers.onNewDirectSnap?.(snap);
        }
      }
    })
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

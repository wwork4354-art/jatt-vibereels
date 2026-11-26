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
  fetchRegisteredUsersFromCloud,
  fileToPersistentDataUrl,
  normalizeCreatorUsername,
  searchCreatorsDirectory,
  uploadMediaToReelsBucket,
} from './supabaseService';
import { getStoredUsers } from '../data/mockUsers';
import { sanitizeText, sanitizeUsername, sanitizeSafeUrl } from '../utils/security';

const LIVE_STORIES_STORAGE_KEY = 'jatt_live_stories_v1';
const DIRECT_SNAPS_STORAGE_KEY = 'jatt_direct_snaps_v1';
const SNAP_REALTIME_CHANNEL = 'vibereels-snaps-realtime';
const DM_BROADCAST_CHANNEL = 'jatt_dm_channel_v1';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const optionalTablesAvailable = {
  liveStories: true,
  directSnaps: true,
  messages: true,
};

function isMissingTableOrColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the')
  );
}

function postLocalDmBroadcast(
  event:
    | { type: 'DM_NEW'; message: DirectSnapMessage }
    | { type: 'DM_SEEN'; messageIds: string[] }
    | { type: 'DM_REACTION'; messageId: string; reactions: Record<string, string[]> }
): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DM_BROADCAST_CHANNEL);
      bc.postMessage(event);
      bc.close();
    }
  } catch {
    // ignore BroadcastChannel failures
  }
}

function sanitizeReactionsMap(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, string[]> = {};
  for (const [emoji, users] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof emoji === 'string' && emoji.trim() && Array.isArray(users)) {
      const cleanUsers = Array.from(
        new Set(
          users
            .map((u) => sanitizeUsername(String(u)) || String(u).trim())
            .filter(Boolean)
        )
      );
      if (cleanUsers.length > 0) {
        result[emoji.slice(0, 8)] = cleanUsers;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapSupabaseDmRow(row: Record<string, unknown>): DirectSnapMessage {
  const safeSenderUname = sanitizeUsername(String(row.sender_username || '')) || 'user';
  const safeRecipUname =
    sanitizeUsername(String(row.recipient_username ?? row.receiver_username ?? '')) || 'friend';
  const isSeen = Boolean(row.is_viewed ?? row.is_seen ?? row.is_read);
  const rawText = row.text_message ?? row.content ?? row.message ?? row.text ?? '';
  const textStr = rawText ? sanitizeText(String(rawText), 500) || undefined : undefined;
  const mediaUrl = sanitizeSafeUrl(String(row.media_url || ''));

  return {
    id: String(row.id),
    senderId: String(row.sender_id || ''),
    senderUsername: safeSenderUname,
    senderName: sanitizeText(String(row.sender_name || safeSenderUname || 'User'), 60),
    senderAvatar: sanitizeSafeUrl(String(row.sender_avatar || '')),
    recipientId: String(row.recipient_id ?? row.receiver_id ?? ''),
    recipientUsername: safeRecipUname,
    recipientName: sanitizeText(
      String(row.recipient_name ?? row.receiver_name ?? (safeRecipUname || 'Friend')),
      60
    ),
    recipientAvatar: sanitizeSafeUrl(String(row.recipient_avatar ?? row.receiver_avatar ?? '')),
    mediaUrl,
    mediaType: row.media_type === 'image' ? 'image' : 'video',
    caption: row.caption ? sanitizeText(String(row.caption), 160) || undefined : undefined,
    filterName: row.filter_name
      ? sanitizeText(String(row.filter_name), 40) || undefined
      : undefined,
    textMessage: textStr,
    reactions: sanitizeReactionsMap(row.reactions),
    deliveryStatus: isSeen ? 'seen' : 'delivered',
    createdAt: String(row.created_at || new Date().toISOString()),
    isViewed: isSeen,
    isSupabaseBacked: true,
  };
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
      const ext =
        params.mediaType === 'image'
          ? 'jpg'
          : params.mediaBlob.type.includes('mp4')
          ? 'mp4'
          : 'webm';
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
// Direct Messaging (DM / Chat) & Live Snaps Helpers (Supabase `messages` + local fallback)
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
      .slice(0, 250);
    localStorage.setItem(DIRECT_SNAPS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore quota errors
  }
}

export async function fetchDirectSnaps(): Promise<DirectSnapMessage[]> {
  const localMessages = getStoredDirectSnaps();
  if (!supabase || !isSupabaseConfigured) {
    return localMessages;
  }

  const remoteMap = new Map<string, DirectSnapMessage>();

  // 1. Query primary Supabase `messages` table if present
  if (optionalTablesAvailable.messages) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (isMissingTableOrColumn(error)) {
          optionalTablesAvailable.messages = false;
        }
      } else if (Array.isArray(data)) {
        for (const row of data) {
          if (row && typeof row === 'object') {
            const mapped = mapSupabaseDmRow(row as Record<string, unknown>);
            remoteMap.set(mapped.id, mapped);
          }
        }
      }
    } catch {
      // keep instant local fallback
    }
  }

  // 2. Also check `direct_snaps` table if present so media snaps & chats unify cleanly
  if (optionalTablesAvailable.directSnaps) {
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
      } else if (Array.isArray(data)) {
        for (const row of data) {
          if (row && typeof row === 'object') {
            const mapped = mapSupabaseDmRow(row as Record<string, unknown>);
            if (!remoteMap.has(mapped.id)) {
              remoteMap.set(mapped.id, mapped);
            }
          }
        }
      }
    } catch {
      // keep instant local fallback
    }
  }

  if (remoteMap.size === 0) {
    return localMessages;
  }

  const merged = [
    ...Array.from(remoteMap.values()),
    ...localMessages.filter((m) => !remoteMap.has(m.id)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  saveStoredDirectSnaps(merged);
  return merged;
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
      const ext =
        params.mediaType === 'image'
          ? 'jpg'
          : params.mediaBlob.type.includes('mp4')
          ? 'mp4'
          : 'webm';
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
    deliveryStatus: 'delivered',
    createdAt,
    isViewed: false,
    isSupabaseBacked: false,
  };

  // Persist immediately in localStorage + notify open browser tabs
  const existing = getStoredDirectSnaps();
  saveStoredDirectSnaps([newSnap, ...existing.filter((m) => m.id !== newSnap.id)]);
  postLocalDmBroadcast({ type: 'DM_NEW', message: newSnap });

  if (supabase && isSupabaseConfigured && isDeviceOnline) {
    const dbRow = {
      id: newSnap.id,
      sender_id: newSnap.senderId,
      sender_username: newSnap.senderUsername,
      sender_name: newSnap.senderName,
      sender_avatar: newSnap.senderAvatar,
      recipient_id: newSnap.recipientId,
      recipient_username: newSnap.recipientUsername,
      recipient_name: newSnap.recipientName,
      recipient_avatar: newSnap.recipientAvatar,
      media_url: newSnap.mediaUrl || null,
      media_type: newSnap.mediaType,
      caption: newSnap.caption || null,
      filter_name: newSnap.filterName || null,
      text_message: newSnap.textMessage || null,
      created_at: newSnap.createdAt,
      is_viewed: false,
    };

    // Primary `messages` table sync
    if (optionalTablesAvailable.messages) {
      try {
        const { error } = await supabase.from('messages').insert([dbRow]);
        if (error && isMissingTableOrColumn(error)) {
          optionalTablesAvailable.messages = false;
        } else if (!error) {
          newSnap.isSupabaseBacked = true;
        }
      } catch {
        // fallback cleanly
      }
    }

    // Secondary `direct_snaps` table sync when available
    if (optionalTablesAvailable.directSnaps) {
      try {
        const { error } = await supabase.from('direct_snaps').insert([dbRow]);
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

  return newSnap;
}

export async function markDirectSnapViewed(snapId: string): Promise<void> {
  await markMessagesSeen([snapId]);
}

export async function markMessagesSeen(messageIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(messageIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const idSet = new Set(uniqueIds);
  const existing = getStoredDirectSnaps();
  const next = existing.map((m) =>
    idSet.has(m.id) ? { ...m, isViewed: true, deliveryStatus: 'seen' as const } : m
  );
  saveStoredDirectSnaps(next);
  postLocalDmBroadcast({ type: 'DM_SEEN', messageIds: uniqueIds });

  if (!supabase || !isSupabaseConfigured) return;

  if (optionalTablesAvailable.messages) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_viewed: true })
        .in('id', uniqueIds);
      if (error && isMissingTableOrColumn(error)) {
        optionalTablesAvailable.messages = false;
      }
    } catch {
      // ignore
    }
  }

  if (optionalTablesAvailable.directSnaps) {
    try {
      const { error } = await supabase
        .from('direct_snaps')
        .update({ is_viewed: true })
        .in('id', uniqueIds);
      if (error && isMissingTableOrColumn(error)) {
        optionalTablesAvailable.directSnaps = false;
      }
    } catch {
      // ignore
    }
  }

  try {
    const channel = supabase.channel(SNAP_REALTIME_CHANNEL);
    await channel.send({
      type: 'broadcast',
      event: 'messages_seen',
      payload: { messageIds: uniqueIds },
    });
  } catch {
    // ignore broadcast errors
  }
}

export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
  reactorUsername: string
): Promise<Record<string, string[]>> {
  const cleanUser = normalizeCreatorUsername(reactorUsername) || reactorUsername;
  const cleanEmoji = emoji.trim().slice(0, 8);
  let nextReactions: Record<string, string[]> = {};

  const existing = getStoredDirectSnaps();
  const updated = existing.map((msg) => {
    if (msg.id !== messageId) return msg;
    const current = { ...(msg.reactions || {}) };
    const list = Array.isArray(current[cleanEmoji]) ? [...current[cleanEmoji]] : [];
    const already = list.some((u) => normalizeCreatorUsername(u) === cleanUser);
    const updatedList = already
      ? list.filter((u) => normalizeCreatorUsername(u) !== cleanUser)
      : [...list, cleanUser];
    if (updatedList.length > 0) {
      current[cleanEmoji] = updatedList;
    } else {
      delete current[cleanEmoji];
    }
    nextReactions = current;
    return {
      ...msg,
      reactions: Object.keys(current).length > 0 ? current : undefined,
    };
  });
  saveStoredDirectSnaps(updated);
  postLocalDmBroadcast({ type: 'DM_REACTION', messageId, reactions: nextReactions });

  if (supabase && isSupabaseConfigured) {
    if (optionalTablesAvailable.messages) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ reactions: nextReactions })
          .eq('id', messageId);
        if (error && isMissingTableOrColumn(error)) {
          optionalTablesAvailable.messages = false;
        }
      } catch {
        // ignore
      }
    }

    if (optionalTablesAvailable.directSnaps) {
      try {
        const { error } = await supabase
          .from('direct_snaps')
          .update({ reactions: nextReactions })
          .eq('id', messageId);
        if (error && isMissingTableOrColumn(error)) {
          optionalTablesAvailable.directSnaps = false;
        }
      } catch {
        // ignore
      }
    }

    try {
      const channel = supabase.channel(SNAP_REALTIME_CHANNEL);
      await channel.send({
        type: 'broadcast',
        event: 'message_reaction',
        payload: { messageId, reactions: nextReactions },
      });
    } catch {
      // ignore broadcast errors
    }
  }

  return nextReactions;
}

export async function fetchDirectSendRecipients(
  allVideos: VideoPost[],
  ownProfile: CreatorProfileData,
  registeredUsers: UserAccount[]
): Promise<DirectSnapRecipient[]> {
  const ownClean = normalizeCreatorUsername(ownProfile.username);
  const byUsername = new Map<string, DirectSnapRecipient>();

  // Combine passed users, stored users & cloud-registered users
  const mergedUsers: UserAccount[] = [...registeredUsers, ...getStoredUsers()];
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const cloudUsers = await fetchRegisteredUsersFromCloud();
      if (cloudUsers.length > 0) {
        mergedUsers.push(...cloudUsers);
      }
    } catch {
      // ignore offline cloud user lookup failures
    }
  }

  for (const u of mergedUsers) {
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

  const creators = await searchCreatorsDirectory('', allVideos, ownProfile);
  for (const c of creators) {
    const clean = normalizeCreatorUsername(c.username);
    if (!clean || clean === ownClean || c.id === ownProfile.id) continue;
    if (!byUsername.has(clean)) {
      byUsername.set(clean, {
        id: c.id,
        name: c.name,
        username: c.username,
        avatar: c.avatar,
        isVerified: c.isVerified,
      });
    }
  }

  return Array.from(byUsername.values());
}

export function subscribeToLiveSnapsRealtime(handlers: {
  onNewStory?: (story: LiveStoryItem) => void;
  onNewDirectSnap?: (snap: DirectSnapMessage) => void;
  onMessagesSeen?: (messageIds: string[]) => void;
  onMessageReaction?: (messageId: string, reactions: Record<string, string[]>) => void;
}): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(DM_BROADCAST_CHANNEL);
      bc.onmessage = (ev) => {
        const data = ev.data as
          | { type: 'DM_NEW'; message: DirectSnapMessage }
          | { type: 'DM_SEEN'; messageIds: string[] }
          | { type: 'DM_REACTION'; messageId: string; reactions: Record<string, string[]> }
          | undefined;
        if (!data) return;
        if (data.type === 'DM_NEW' && data.message?.id) {
          handlers.onNewDirectSnap?.(data.message);
        } else if (data.type === 'DM_SEEN' && Array.isArray(data.messageIds)) {
          handlers.onMessagesSeen?.(data.messageIds);
        } else if (data.type === 'DM_REACTION' && data.messageId) {
          handlers.onMessageReaction?.(data.messageId, data.reactions || {});
        }
      };
    }
  } catch {
    // ignore BroadcastChannel failures
  }

  if (!supabase || !isSupabaseConfigured) {
    return () => {
      bc?.close();
    };
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
    .on('broadcast', { event: 'messages_seen' }, ({ payload }) => {
      const ids = Array.isArray((payload as { messageIds?: unknown })?.messageIds)
        ? ((payload as { messageIds: unknown[] }).messageIds.map(String))
        : [];
      if (ids.length > 0) {
        handlers.onMessagesSeen?.(ids);
      }
    })
    .on('broadcast', { event: 'message_reaction' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const p = payload as { messageId?: string; reactions?: Record<string, string[]> };
        if (p.messageId) {
          handlers.onMessageReaction?.(p.messageId, p.reactions || {});
        }
      }
    });

  if (optionalTablesAvailable.messages) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const mapped = mapSupabaseDmRow(payload.new as Record<string, unknown>);
          const existing = getStoredDirectSnaps();
          if (!existing.some((m) => m.id === mapped.id)) {
            saveStoredDirectSnaps([mapped, ...existing]);
          }
          handlers.onNewDirectSnap?.(mapped);
        }
      }
    );
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const mapped = mapSupabaseDmRow(payload.new as Record<string, unknown>);
          if (mapped.isViewed) {
            handlers.onMessagesSeen?.([mapped.id]);
          }
          if (mapped.reactions) {
            handlers.onMessageReaction?.(mapped.id, mapped.reactions);
          }
        }
      }
    );
  }

  channel.subscribe();

  return () => {
    bc?.close();
    void client.removeChannel(channel);
  };
}

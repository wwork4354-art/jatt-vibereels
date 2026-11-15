import { supabase, REELS_MEDIA_BUCKET, isSupabaseConfigured } from './supabase';
import {
  ActivityEvent,
  CommentItem,
  CreatorProfileData,
  InteractionType,
  VideoPost,
} from '../types';

export const USER_PROFILE_ID_KEY = 'jatt_user_profile_id';
export const LIKED_POST_IDS_KEY = 'jatt_liked_post_ids';
export const SAVED_POST_IDS_KEY = 'jatt_saved_post_ids';
export const FOLLOWED_USERNAMES_KEY = 'jatt_followed_usernames';
export const LOCAL_USER_POSTS_KEY = 'jatt_local_user_posts_v1';
export const POST_METRICS_OVERRIDES_KEY = 'jatt_post_metrics_v1';
export const POST_COMMENTS_KEY = 'jatt_post_comments_v1';
export const ACTIVITY_EVENTS_KEY = 'jatt_activity_events_v1';
export const ACTIVITY_LAST_READ_KEY = 'jatt_activity_last_read_v1';

export interface SupabasePostRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  media_url: string;
  media_type: 'video' | 'image' | string;
  caption: string;
  likes_count: number;
  views_count?: number;
  comments_count?: number;
  saves_count?: number;
  downloads_count?: number;
  shares_count?: number;
  created_at?: string;
}

export interface SupabaseCommentRow {
  id: string;
  post_id: string;
  user_id?: string;
  author_name: string;
  author_username: string;
  author_avatar?: string;
  text: string;
  likes_count?: number;
  created_at?: string;
}

export interface SupabaseInteractionRow {
  id: string;
  post_id: string;
  post_title?: string;
  post_thumbnail?: string;
  post_media_type?: string;
  post_owner_id?: string;
  post_owner_username?: string;
  actor_id: string;
  actor_name: string;
  actor_username: string;
  actor_avatar?: string;
  interaction_type: InteractionType;
  comment_text?: string;
  created_at?: string;
}

export interface PostMetricsOverride {
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  downloads?: number;
  shares?: number;
}

// Track optional schema capabilities detected dynamically from Supabase responses
const schemaCapabilities = {
  postsHasViews: false,
  postsHasComments: false,
  postsHasSaves: false,
  postsHasDownloads: false,
  postsHasShares: false,
  profilesTableAvailable: true,
  commentsTableAvailable: true,
  interactionsTableAvailable: true,
};

function isMissingRelationError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

function detectPostsColumns(rows: Record<string, unknown>[]): void {
  if (!rows || rows.length === 0) return;
  const sample = rows[0];
  if ('views_count' in sample) schemaCapabilities.postsHasViews = true;
  if ('comments_count' in sample) schemaCapabilities.postsHasComments = true;
  if ('saves_count' in sample) schemaCapabilities.postsHasSaves = true;
  if ('downloads_count' in sample) schemaCapabilities.postsHasDownloads = true;
  if ('shares_count' in sample) schemaCapabilities.postsHasShares = true;
}

export function getSchemaSyncStatus() {
  return {
    isSupabaseConfigured,
    ...schemaCapabilities,
  };
}

export const SUPABASE_SCHEMA_SQL = `-- Run in Supabase SQL Editor for full multi-device engagement & analytics sync
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downloads_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count bigint DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  followers_count bigint DEFAULT 12400,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id text PRIMARY KEY,
  post_id text NOT NULL,
  user_id text,
  author_name text NOT NULL,
  author_username text NOT NULL,
  author_avatar text DEFAULT '',
  text text NOT NULL,
  likes_count bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_interactions (
  id text PRIMARY KEY,
  post_id text NOT NULL,
  post_title text DEFAULT '',
  post_thumbnail text DEFAULT '',
  post_media_type text DEFAULT 'video',
  post_owner_id text DEFAULT '',
  post_owner_username text DEFAULT '',
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  actor_username text NOT NULL,
  actor_avatar text DEFAULT '',
  interaction_type text NOT NULL,
  comment_text text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public profiles access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public comments access" ON public.post_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public interactions access" ON public.post_interactions FOR ALL USING (true) WITH CHECK (true);`;

// =========================================================================
// Timestamp formatting helpers
// =========================================================================
export function formatRelativeTime(dateInput?: string): string {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 45_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatExactTimestamp(dateInput?: string): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =========================================================================
// LocalStorage Persistence Helpers
// =========================================================================
export function getOrCreateUserProfileId(): string {
  try {
    const existing = localStorage.getItem(USER_PROFILE_ID_KEY);
    if (existing && existing.trim()) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(USER_PROFILE_ID_KEY, generated);
    return generated;
  } catch {
    return `user-${Date.now()}`;
  }
}

function readJsonSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(String));
    }
  } catch {
    // ignore storage errors
  }
  return new Set();
}

function writeJsonSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export function getStoredLikedPostIds(): Set<string> {
  return readJsonSet(LIKED_POST_IDS_KEY);
}

export function saveStoredLikedPostIds(ids: Set<string>): void {
  writeJsonSet(LIKED_POST_IDS_KEY, ids);
}

export function getStoredSavedPostIds(): Set<string> {
  return readJsonSet(SAVED_POST_IDS_KEY);
}

export function saveStoredSavedPostIds(ids: Set<string>): void {
  writeJsonSet(SAVED_POST_IDS_KEY, ids);
}

export function getStoredFollowedUsernames(): Set<string> {
  return readJsonSet(FOLLOWED_USERNAMES_KEY);
}

export function saveStoredFollowedUsernames(usernames: Set<string>): void {
  writeJsonSet(FOLLOWED_USERNAMES_KEY, usernames);
}

export function getStoredLocalPosts(): VideoPost[] {
  try {
    const raw = localStorage.getItem(LOCAL_USER_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out defunct blob: URLs from previous closed browser tabs
    return parsed.filter(
      (p: VideoPost) => p && typeof p.videoUrl === 'string' && !p.videoUrl.startsWith('blob:')
    );
  } catch {
    return [];
  }
}

export function saveLocalPostRecord(post: VideoPost): void {
  try {
    if (!post.videoUrl || post.videoUrl.startsWith('blob:')) return;
    const existing = getStoredLocalPosts();
    const next = [post, ...existing.filter((p) => p.id !== post.id)].slice(0, 60);
    localStorage.setItem(LOCAL_USER_POSTS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors on large local data URLs
  }
}

export function getStoredPostMetrics(): Record<string, PostMetricsOverride> {
  try {
    const raw = localStorage.getItem(POST_METRICS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePostMetricOverride(
  postId: string,
  patch: PostMetricsOverride
): void {
  try {
    const map = getStoredPostMetrics();
    map[postId] = {
      ...(map[postId] || {}),
      ...patch,
    };
    localStorage.setItem(POST_METRICS_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getStoredPostComments(): Record<string, CommentItem[]> {
  try {
    const raw = localStorage.getItem(POST_COMMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePostCommentsForPost(postId: string, comments: CommentItem[]): void {
  try {
    const map = getStoredPostComments();
    map[postId] = comments.slice(0, 100);
    localStorage.setItem(POST_COMMENTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getStoredActivityEvents(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredActivityEvents(events: ActivityEvent[]): void {
  try {
    localStorage.setItem(ACTIVITY_EVENTS_KEY, JSON.stringify(events.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function getActivityLastReadAt(): string {
  try {
    return localStorage.getItem(ACTIVITY_LAST_READ_KEY) || '';
  } catch {
    return '';
  }
}

export function setActivityLastReadAt(iso: string): void {
  try {
    localStorage.setItem(ACTIVITY_LAST_READ_KEY, iso);
  } catch {
    // ignore
  }
}

// Helper to convert smaller local files into persistent Data URLs when Supabase isn't available
export function fileToPersistentDataUrl(file: Blob, maxBytes = 2_500_000): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size > maxBytes) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// =========================================================================
// Post Mapping
// =========================================================================
function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#([a-zA-Z0-9_]+)/g);
  if (!matches || matches.length === 0) {
    return ['foryou', 'vibereels'];
  }
  return matches.map((tag) => tag.replace(/^#/, '').toLowerCase());
}

export function mapSupabaseRowToVideoPost(
  row: SupabasePostRow,
  likedIds: Set<string>,
  currentUserId: string,
  savedIds: Set<string> = getStoredSavedPostIds(),
  followedUsernames: Set<string> = getStoredFollowedUsernames(),
  currentUsername?: string
): VideoPost {
  const id = String(row.id);
  const caption = row.caption || 'Shared on Jatt VibeReels';
  const displayName = row.display_name || row.username || 'VibeReels Creator';
  const username = row.username || 'creator';
  const mediaType = row.media_type === 'image' ? 'image' : 'video';

  const metricsMap = getStoredPostMetrics();
  const metricOverride = metricsMap[id] || {};
  const storedCommentsMap = getStoredPostComments();
  const localComments = storedCommentsMap[id] || [];

  const dbLikes = typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0;
  const dbViews = typeof row.views_count === 'number' ? Math.max(0, row.views_count) : 0;
  const dbComments = typeof row.comments_count === 'number' ? Math.max(0, row.comments_count) : 0;
  const dbSaves = typeof row.saves_count === 'number' ? Math.max(0, row.saves_count) : 0;
  const dbDownloads =
    typeof row.downloads_count === 'number' ? Math.max(0, row.downloads_count) : 0;
  const dbShares = typeof row.shares_count === 'number' ? Math.max(0, row.shares_count) : 0;

  const isOwnPost =
    row.user_id === currentUserId ||
    (Boolean(currentUsername) &&
      username.toLowerCase() === currentUsername!.toLowerCase());

  return {
    id,
    title: caption.slice(0, 60),
    description: caption,
    hashtags: extractHashtags(caption),
    videoUrl: row.media_url,
    posterUrl: mediaType === 'image' ? row.media_url : undefined,
    fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
    category: 'trending',
    userId: row.user_id,
    mediaType,
    isSupabasePost: true,
    isUserUploaded: isOwnPost,
    createdAt: row.created_at,
    creator: {
      name: displayName,
      username,
      avatar:
        row.avatar_url ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
      isVerified: true,
      isFollowing: followedUsernames.has(username),
      bio: 'Creator on Jatt VibeReels',
    },
    stats: {
      views: Math.max(dbViews, metricOverride.views ?? 0),
      likes: Math.max(dbLikes, metricOverride.likes ?? 0),
      comments: Math.max(dbComments, localComments.length, metricOverride.comments ?? 0),
      shares: Math.max(dbShares, metricOverride.shares ?? 0),
      saves: Math.max(dbSaves, metricOverride.saves ?? 0),
      downloads: Math.max(dbDownloads, metricOverride.downloads ?? 0),
    },
    isLiked: likedIds.has(id),
    isSaved: savedIds.has(id),
    sound: {
      title: `${displayName}'s Original Audio`,
      artist: displayName,
      trackType: 'future_bass',
    },
    commentsList: localComments,
  };
}

// =========================================================================
// Supabase Storage & Posts CRUD
// =========================================================================
export async function uploadMediaToReelsBucket(
  fileOrBlob: File | Blob,
  folder: 'posts' | 'avatars',
  filenameHint?: string
): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  try {
    const rawExt = filenameHint?.split('.').pop()?.toLowerCase();
    const mimeExt = fileOrBlob.type?.split('/').pop()?.split('+')[0]?.toLowerCase();
    const ext = rawExt || mimeExt || (folder === 'avatars' ? 'jpg' : 'mp4');
    const cleanRandom = Math.random().toString(36).slice(2, 8);
    const filePath = `${folder}/${Date.now()}-${cleanRandom}.${ext}`;

    const { error } = await supabase.storage
      .from(REELS_MEDIA_BUCKET)
      .upload(filePath, fileOrBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: fileOrBlob.type || undefined,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage
      .from(REELS_MEDIA_BUCKET)
      .getPublicUrl(filePath);

    return data?.publicUrl || null;
  } catch (err) {
    console.warn('Supabase storage upload failed:', err);
    return null;
  }
}

export async function fetchGlobalPosts(
  currentUserId: string,
  currentUsername?: string
): Promise<VideoPost[]> {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error || !Array.isArray(data)) {
      if (error) console.warn('Supabase fetch posts error:', error.message);
      return [];
    }

    detectPostsColumns(data as Record<string, unknown>[]);

    const likedIds = getStoredLikedPostIds();
    const savedIds = getStoredSavedPostIds();
    const followedUsernames = getStoredFollowedUsernames();

    return (data as SupabasePostRow[])
      .filter((row) => Boolean(row?.media_url))
      .map((row) =>
        mapSupabaseRowToVideoPost(
          row,
          likedIds,
          currentUserId,
          savedIds,
          followedUsernames,
          currentUsername
        )
      );
  } catch (err) {
    console.warn('Supabase fetch posts failed:', err);
    return [];
  }
}

export async function fetchPostsByUser(
  userId: string,
  username: string,
  currentUserId: string
): Promise<VideoPost[]> {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    const cleanUsername = username.trim().replace(/^@+/, '');
    const filterExpr = cleanUsername
      ? `user_id.eq.${userId},username.eq.${cleanUsername}`
      : `user_id.eq.${userId}`;

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .or(filterExpr)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !Array.isArray(data)) {
      return [];
    }

    detectPostsColumns(data as Record<string, unknown>[]);

    const likedIds = getStoredLikedPostIds();
    const savedIds = getStoredSavedPostIds();
    const followedUsernames = getStoredFollowedUsernames();

    return (data as SupabasePostRow[])
      .filter((row) => Boolean(row?.media_url))
      .map((row) =>
        mapSupabaseRowToVideoPost(
          row,
          likedIds,
          currentUserId,
          savedIds,
          followedUsernames,
          cleanUsername
        )
      );
  } catch {
    return [];
  }
}

export async function createGlobalPostInSupabase(params: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  caption: string;
}): Promise<VideoPost | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  try {
    const basePayload: Record<string, unknown> = {
      user_id: params.userId,
      username: params.username,
      display_name: params.displayName,
      avatar_url: params.avatarUrl,
      media_url: params.mediaUrl,
      media_type: params.mediaType,
      caption: params.caption,
      likes_count: 0,
    };

    if (schemaCapabilities.postsHasViews) basePayload.views_count = 0;
    if (schemaCapabilities.postsHasComments) basePayload.comments_count = 0;
    if (schemaCapabilities.postsHasSaves) basePayload.saves_count = 0;
    if (schemaCapabilities.postsHasDownloads) basePayload.downloads_count = 0;

    const { data, error } = await supabase
      .from('posts')
      .insert([basePayload])
      .select()
      .single();

    if (error || !data) {
      if (error) console.warn('Supabase insert post error:', error.message);
      return null;
    }

    detectPostsColumns([data as Record<string, unknown>]);

    const likedIds = getStoredLikedPostIds();
    const savedIds = getStoredSavedPostIds();
    const followedUsernames = getStoredFollowedUsernames();
    return mapSupabaseRowToVideoPost(
      data as SupabasePostRow,
      likedIds,
      params.userId,
      savedIds,
      followedUsernames,
      params.username
    );
  } catch (err) {
    console.warn('Supabase create post failed:', err);
    return null;
  }
}

export async function updatePostLikesInSupabase(
  postId: string,
  newLikesCount: number
): Promise<boolean> {
  savePostMetricOverride(postId, { likes: Math.max(0, newLikesCount) });

  if (!supabase || !isSupabaseConfigured) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('posts')
      .update({ likes_count: Math.max(0, newLikesCount) })
      .eq('id', postId);

    if (error) {
      console.warn('Supabase likes update error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase likes update failed:', err);
    return false;
  }
}

export async function updatePostMetricsInSupabase(
  postId: string,
  patch: PostMetricsOverride,
  isSupabasePost?: boolean
): Promise<void> {
  savePostMetricOverride(postId, patch);

  if (!supabase || !isSupabaseConfigured || !isSupabasePost) {
    return;
  }

  const dbPatch: Record<string, number> = {};
  if (typeof patch.likes === 'number') {
    dbPatch.likes_count = Math.max(0, patch.likes);
  }
  if (typeof patch.views === 'number' && schemaCapabilities.postsHasViews) {
    dbPatch.views_count = Math.max(0, patch.views);
  }
  if (typeof patch.comments === 'number' && schemaCapabilities.postsHasComments) {
    dbPatch.comments_count = Math.max(0, patch.comments);
  }
  if (typeof patch.saves === 'number' && schemaCapabilities.postsHasSaves) {
    dbPatch.saves_count = Math.max(0, patch.saves);
  }
  if (typeof patch.downloads === 'number' && schemaCapabilities.postsHasDownloads) {
    dbPatch.downloads_count = Math.max(0, patch.downloads);
  }
  if (typeof patch.shares === 'number' && schemaCapabilities.postsHasShares) {
    dbPatch.shares_count = Math.max(0, patch.shares);
  }

  if (Object.keys(dbPatch).length === 0) return;

  try {
    await supabase.from('posts').update(dbPatch).eq('id', postId);
  } catch {
    // ignore optional column failure
  }
}

// =========================================================================
// Profiles Sync (Cross-Device Recovery)
// =========================================================================
export async function upsertUserProfileInSupabase(
  profile: CreatorProfileData
): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    return false;
  }

  try {
    if (schemaCapabilities.profilesTableAvailable) {
      const { error } = await supabase.from('profiles').upsert({
        id: profile.id,
        username: profile.username,
        display_name: profile.name,
        bio: profile.bio,
        avatar_url: profile.avatar,
        followers_count: profile.baseFollowers,
        updated_at: new Date().toISOString(),
      });
      if (error && isMissingRelationError(error)) {
        schemaCapabilities.profilesTableAvailable = false;
      } else if (!error) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function fetchUserProfileFromSupabase(params: {
  id?: string;
  username?: string;
}): Promise<CreatorProfileData | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const cleanUsername = params.username?.trim().replace(/^@+/, '').toLowerCase();

  try {
    if (schemaCapabilities.profilesTableAvailable) {
      let query = supabase.from('profiles').select('*');
      if (cleanUsername && params.id) {
        query = query.or(`id.eq.${params.id},username.eq.${cleanUsername}`);
      } else if (cleanUsername) {
        query = query.eq('username', cleanUsername);
      } else if (params.id) {
        query = query.eq('id', params.id);
      } else {
        return null;
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error && isMissingRelationError(error)) {
        schemaCapabilities.profilesTableAvailable = false;
      } else if (data) {
        return {
          id: String(data.id),
          name: data.display_name || data.username || 'Jatt Creator',
          username: data.username || 'jatt_official',
          bio: data.bio || '',
          avatar:
            data.avatar_url ||
            'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
          baseFollowers:
            typeof data.followers_count === 'number' ? data.followers_count : 12400,
        };
      }
    }

    // Fallback: reconstruct profile from user's latest global post in `posts`
    if (cleanUsername || params.id) {
      let postQuery = supabase
        .from('posts')
        .select('user_id, username, display_name, avatar_url')
        .order('created_at', { ascending: false })
        .limit(1);

      if (cleanUsername) {
        postQuery = postQuery.eq('username', cleanUsername);
      } else if (params.id) {
        postQuery = postQuery.eq('user_id', params.id);
      }

      const { data: postRow } = await postQuery.maybeSingle();
      if (postRow) {
        return {
          id: String(postRow.user_id || params.id || getOrCreateUserProfileId()),
          name: postRow.display_name || postRow.username || 'Jatt Creator',
          username: postRow.username || cleanUsername || 'jatt_official',
          bio: 'Creator on Jatt VibeReels',
          avatar:
            postRow.avatar_url ||
            'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
          baseFollowers: 12400,
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// =========================================================================
// Comments Sync (Supabase `post_comments` + Local Persistence)
// =========================================================================
export function mapSupabaseCommentRow(row: SupabaseCommentRow): CommentItem {
  return {
    id: String(row.id),
    user: {
      name: row.author_name || row.author_username || 'VibeReels User',
      username: row.author_username || 'user',
      avatar:
        row.author_avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
          row.author_username || 'user'
        )}&backgroundColor=ec4899`,
      isVerified: false,
    },
    text: row.text,
    timestamp: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    likes: typeof row.likes_count === 'number' ? row.likes_count : 0,
    isLiked: false,
  };
}

export async function fetchCommentsFromSupabase(): Promise<Record<string, CommentItem[]>> {
  const localMap = getStoredPostComments();
  if (!supabase || !isSupabaseConfigured || !schemaCapabilities.commentsTableAvailable) {
    return localMap;
  }

  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingRelationError(error)) {
        schemaCapabilities.commentsTableAvailable = false;
      }
      return localMap;
    }

    if (!Array.isArray(data)) return localMap;

    const merged: Record<string, CommentItem[]> = { ...localMap };
    for (const raw of data as SupabaseCommentRow[]) {
      const pid = String(raw.post_id);
      const item = mapSupabaseCommentRow(raw);
      const existing = merged[pid] || [];
      if (!existing.some((c) => c.id === item.id)) {
        merged[pid] = [...existing, item];
      }
    }

    try {
      localStorage.setItem(POST_COMMENTS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    return merged;
  } catch {
    return localMap;
  }
}

export async function createCommentInSupabase(params: {
  postId: string;
  userId: string;
  comment: CommentItem;
  nextCommentsList: CommentItem[];
  isSupabasePost?: boolean;
}): Promise<void> {
  savePostCommentsForPost(params.postId, params.nextCommentsList);
  void updatePostMetricsInSupabase(
    params.postId,
    { comments: params.nextCommentsList.length },
    params.isSupabasePost
  );

  if (!supabase || !isSupabaseConfigured || !schemaCapabilities.commentsTableAvailable) {
    return;
  }

  try {
    const { error } = await supabase.from('post_comments').insert([
      {
        id: params.comment.id,
        post_id: params.postId,
        user_id: params.userId,
        author_name: params.comment.user.name,
        author_username: params.comment.user.username,
        author_avatar: params.comment.user.avatar,
        text: params.comment.text,
        likes_count: 0,
        created_at: params.comment.createdAt || new Date().toISOString(),
      },
    ]);
    if (error && isMissingRelationError(error)) {
      schemaCapabilities.commentsTableAvailable = false;
    }
  } catch {
    // ignore
  }
}

// =========================================================================
// Creator Activity / Interactions Tracking (Likes, Comments, Saves, Downloads)
// =========================================================================
export function mapSupabaseInteractionRow(row: SupabaseInteractionRow): ActivityEvent {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    postTitle: row.post_title || 'Reel Post',
    postThumbnail: row.post_thumbnail || undefined,
    postMediaType: row.post_media_type === 'image' ? 'image' : 'video',
    postOwnerId: row.post_owner_id || undefined,
    postOwnerUsername: row.post_owner_username || undefined,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_username || 'Viewer',
    actorUsername: row.actor_username || 'viewer',
    actorAvatar:
      row.actor_avatar ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        row.actor_username || 'viewer'
      )}&backgroundColor=06b6d4`,
    type: row.interaction_type,
    commentText: row.comment_text || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function fetchActivityEventsFromSupabase(): Promise<ActivityEvent[]> {
  const localEvents = getStoredActivityEvents();
  if (!supabase || !isSupabaseConfigured || !schemaCapabilities.interactionsTableAvailable) {
    return localEvents;
  }

  try {
    const { data, error } = await supabase
      .from('post_interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      if (isMissingRelationError(error)) {
        schemaCapabilities.interactionsTableAvailable = false;
      }
      return localEvents;
    }

    if (!Array.isArray(data)) return localEvents;

    const remoteEvents = (data as SupabaseInteractionRow[]).map(mapSupabaseInteractionRow);
    const seenIds = new Set(remoteEvents.map((e) => e.id));
    const combined = [
      ...remoteEvents,
      ...localEvents.filter((e) => !seenIds.has(e.id)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    saveStoredActivityEvents(combined);
    return combined;
  } catch {
    return localEvents;
  }
}

export async function recordActivityEventInSupabase(
  eventInput: Omit<ActivityEvent, 'id' | 'createdAt'>
): Promise<ActivityEvent> {
  const newEvent: ActivityEvent = {
    ...eventInput,
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = getStoredActivityEvents();
  saveStoredActivityEvents([newEvent, ...existing]);

  if (supabase && isSupabaseConfigured && schemaCapabilities.interactionsTableAvailable) {
    try {
      const { error } = await supabase.from('post_interactions').insert([
        {
          id: newEvent.id,
          post_id: newEvent.postId,
          post_title: newEvent.postTitle,
          post_thumbnail: newEvent.postThumbnail || '',
          post_media_type: newEvent.postMediaType || 'video',
          post_owner_id: newEvent.postOwnerId || '',
          post_owner_username: newEvent.postOwnerUsername || '',
          actor_id: newEvent.actorId,
          actor_name: newEvent.actorName,
          actor_username: newEvent.actorUsername,
          actor_avatar: newEvent.actorAvatar,
          interaction_type: newEvent.type,
          comment_text: newEvent.commentText || null,
          created_at: newEvent.createdAt,
        },
      ]);
      if (error && isMissingRelationError(error)) {
        schemaCapabilities.interactionsTableAvailable = false;
      }
    } catch {
      // ignore
    }
  }

  return newEvent;
}

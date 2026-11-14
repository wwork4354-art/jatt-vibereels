import { supabase, REELS_MEDIA_BUCKET, isSupabaseConfigured } from './supabase';
import { CreatorProfileData, VideoPost } from '../types';

export const USER_PROFILE_ID_KEY = 'jatt_user_profile_id';
export const LIKED_POST_IDS_KEY = 'jatt_liked_post_ids';

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
  created_at?: string;
}

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

export function getStoredLikedPostIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_POST_IDS_KEY);
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

export function saveStoredLikedPostIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LIKED_POST_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage errors
  }
}

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
  currentUserId: string
): VideoPost {
  const id = String(row.id);
  const caption = row.caption || 'Shared on Jatt VibeReels';
  const displayName = row.display_name || row.username || 'VibeReels Creator';
  const username = row.username || 'creator';
  const mediaType = row.media_type === 'image' ? 'image' : 'video';

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
    isUserUploaded: row.user_id === currentUserId,
    createdAt: row.created_at,
    creator: {
      name: displayName,
      username,
      avatar:
        row.avatar_url ||
        'https://i.ibb.co/4RL7mmcB/Cinematic-Urban-Fashion-Poster.png',
      isVerified: true,
      isFollowing: false,
      bio: 'Creator on Jatt VibeReels',
    },
    stats: {
      likes: typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0,
      comments: 0,
      shares: 0,
      saves: 0,
    },
    isLiked: likedIds.has(id),
    isSaved: false,
    sound: {
      title: `${displayName}'s Original Audio`,
      artist: displayName,
      trackType: 'future_bass',
    },
    commentsList: [],
  };
}

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

export async function fetchGlobalPosts(currentUserId: string): Promise<VideoPost[]> {
  if (!supabase || !isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error || !Array.isArray(data)) {
      if (error) console.warn('Supabase fetch posts error:', error.message);
      return [];
    }

    const likedIds = getStoredLikedPostIds();
    return (data as SupabasePostRow[])
      .filter((row) => Boolean(row?.media_url))
      .map((row) => mapSupabaseRowToVideoPost(row, likedIds, currentUserId));
  } catch (err) {
    console.warn('Supabase fetch posts failed:', err);
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
    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          user_id: params.userId,
          username: params.username,
          display_name: params.displayName,
          avatar_url: params.avatarUrl,
          media_url: params.mediaUrl,
          media_type: params.mediaType,
          caption: params.caption,
          likes_count: 0,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      if (error) console.warn('Supabase insert post error:', error.message);
      return null;
    }

    const likedIds = getStoredLikedPostIds();
    return mapSupabaseRowToVideoPost(
      data as SupabasePostRow,
      likedIds,
      params.userId
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

export async function upsertUserProfileInSupabase(
  profile: CreatorProfileData
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    return;
  }

  try {
    await supabase.from('profiles').upsert({
      id: profile.id,
      username: profile.username,
      display_name: profile.name,
      bio: profile.bio,
      avatar_url: profile.avatar,
    });
  } catch {
    // Optional profiles table; ignore if only posts table + storage are provisioned
  }
}

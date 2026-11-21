export type SoundTrackType =
  | 'ambient_lofi'
  | 'future_bass'
  | 'chill_synth'
  | 'cosmic_pulse'
  | 'tokyo_drift'
  | 'naat_serene'
  | 'naat_medina'
  | 'punjabi_dhol'
  | 'sufi_acoustic'
  | 'punjabi_tribute';

export interface AudioTrackOption {
  id: string;
  title: string;
  artist: string;
  category: 'naat' | 'song' | 'beat';
  duration: string;
  mood: string;
  trackType: SoundTrackType;
}

export interface CommentItem {
  id: string;
  user: {
    name: string;
    username: string;
    avatar: string;
    isCreator?: boolean;
    isVerified?: boolean;
  };
  text: string;
  timestamp: string;
  createdAt?: string;
  likes: number;
  isLiked: boolean;
}

export interface VideoPost {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  videoUrl: string;
  posterUrl?: string;
  fallbackGradient: string;
  category: 'trending' | 'nature' | 'urban' | 'music' | 'cute' | 'creative';
  creator: {
    name: string;
    username: string;
    avatar: string;
    isVerified: boolean;
    isFollowing: boolean;
    bio?: string;
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    downloads: number;
  };
  isLiked: boolean;
  isSaved: boolean;
  isUserUploaded?: boolean;
  isSupabasePost?: boolean;
  userId?: string;
  mediaType?: 'video' | 'image';
  allowDownload?: boolean;
  createdAt?: string;
  sound: {
    title: string;
    artist: string;
    trackType: SoundTrackType;
    audioUrl?: string;
    category?: 'song' | 'naat' | 'beat' | 'original';
    originalVolume?: number;
    bgAudioVolume?: number;
    hasAttachedAudio?: boolean;
  };
  commentsList: CommentItem[];
}

export type InteractionType = 'like' | 'comment' | 'save' | 'download' | 'view' | 'follow';

export interface ActivityEvent {
  id: string;
  postId: string;
  postTitle: string;
  postThumbnail?: string;
  postMediaType?: 'video' | 'image';
  postOwnerId?: string;
  postOwnerUsername?: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorAvatar: string;
  type: InteractionType;
  commentText?: string;
  createdAt: string;
}

export type UserRole = 'admin' | 'creator' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  createdAtIso?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
  videosCount: number;
  bio?: string;
  passwordHash?: string;
}

export interface CreatorProfileData {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  baseFollowers: number;
  followingCount?: number;
  profileViews?: number;
  isVerified?: boolean;
}

export interface CreatorChannelSummary {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  isVerified: boolean;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
  totalLikes: number;
  profileViews: number;
  videosCount: number;
}

export type FeedTab =
  | 'foryou'
  | 'following'
  | 'trending'
  | 'saved'
  | 'live'
  | 'downloads'
  | 'templates'
  | 'profile'
  | 'activity'
  | 'channel';

export type ContentStyleTag =
  | 'Movie'
  | 'Drama'
  | 'Song'
  | 'Cartoon'
  | 'Realistic'
  | 'Rhymes'
  | 'Naat'
  | 'Tilawat'
  | 'Program'
  | 'Talk Show';

export type DownloadCategory =
  | 'movies'
  | 'dramas'
  | 'songs'
  | 'cartoons'
  | 'realistic'
  | 'rhymes'
  | 'naat'
  | 'tilawat'
  | 'quran'
  | 'programs'
  | 'talk_shows'
  | 'apps';

export interface DownloadItem {
  id: string;
  title: string;
  subtitle: string;
  category: DownloadCategory;
  categoryLabel: string;
  fileSize: string;
  sizeBytes: number;
  durationOrVersion: string;
  durationSeconds?: number;
  contentTypeTag?: ContentStyleTag;
  qualityBadge: string;
  thumbnailUrl: string;
  fallbackGradient: string;
  downloadsCount: string;
  rating: number;
  tags: string[];
  description?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  directVideoUrl?: string;
  embedUrl?: string;
}

export interface TrendingHashtag {
  rank: number;
  tag: string;
  views: string;
  reelsCount: number;
  growth: string;
  isBreakout?: boolean;
}

export interface TrendingAudio {
  id: string;
  rank: number;
  title: string;
  artist: string;
  usesCount: string;
  duration: string;
  trackType: SoundTrackType;
}

export interface LiveStoryItem {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  caption?: string;
  filterName?: string;
  createdAt: string;
  expiresAt: string;
  viewedByIds: string[];
  isSupabaseBacked?: boolean;
}

export interface DirectSnapMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  recipientUsername: string;
  recipientName: string;
  recipientAvatar: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  caption?: string;
  filterName?: string;
  textMessage?: string;
  createdAt: string;
  isViewed: boolean;
  isSupabaseBacked?: boolean;
}

export interface DirectSnapRecipient {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isVerified?: boolean;
}


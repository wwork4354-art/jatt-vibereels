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
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  isLiked: boolean;
  isSaved: boolean;
  sound: {
    title: string;
    artist: string;
    trackType: 'ambient_lofi' | 'future_bass' | 'chill_synth' | 'cosmic_pulse' | 'tokyo_drift';
  };
  commentsList: CommentItem[];
}

export type UserRole = 'admin' | 'creator' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  videosCount: number;
  bio?: string;
}

export type FeedTab = 'foryou' | 'following' | 'trending' | 'saved' | 'live' | 'downloads';

export type DownloadCategory = 'songs' | 'apps' | 'dramas' | 'movies' | 'cartoons' | 'quran';

export interface DownloadItem {
  id: string;
  title: string;
  subtitle: string;
  category: DownloadCategory;
  categoryLabel: string;
  fileSize: string;
  sizeBytes: number;
  durationOrVersion: string;
  qualityBadge: string;
  thumbnailUrl: string;
  fallbackGradient: string;
  downloadsCount: string;
  rating: number;
  tags: string[];
  description?: string;
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
  trackType: 'ambient_lofi' | 'future_bass' | 'chill_synth' | 'cosmic_pulse' | 'tokyo_drift';
}


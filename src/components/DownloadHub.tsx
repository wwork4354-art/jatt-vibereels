import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  ArrowLeft,
  Search,
  Music,
  Smartphone,
  Tv,
  Film,
  Smile,
  BookOpen,
  Sparkles,
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  HardDrive,
  Trash2,
  ExternalLink,
  Star,
  SlidersHorizontal,
  X,
  Volume2,
  VolumeX,
  Youtube,
  Link2,
  Bookmark,
  Globe,
  Maximize2,
  Minimize2,
  RectangleHorizontal,
  WifiOff,
  ArrowRight,
  AlertTriangle,
  Settings,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Compass,
  Baby,
  HeartHandshake,
  Radio,
  Mic,
  ShieldCheck,
  Languages,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import Hls from 'hls.js';
import { DownloadItem, ContentStyleTag, UserAccount } from '../types';
import { INITIAL_DOWNLOADS, DOWNLOAD_CATEGORIES } from '../data/mockDownloads';
import { isMainAdminAccount } from '../data/mockUsers';
import { soundEngine } from '../utils/soundEngine';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import {
  parseIso8601DurationToSeconds,
  formatVideoDuration,
  classifyVideoContentType,
  mapStyleTagToCategory,
  getContentTagBadgeClasses,
} from '../utils/mediaClassifier';
import { getIsRamSaverMode, useRamSaverMode } from '../lib/ramSaverMode';
import {
  LiteYouTubePlayer,
  LiteYouTubeThumb,
  YOUTUBE_QUALITY_OPTIONS,
  getQualityOption,
  YouTubeQualityId,
} from './LiteYouTubePlayer';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  getFullscreenElement,
  isPortraitViewport,
  requestElementFullscreen,
  lockScreenLandscape,
  unlockOrientationToPortrait,
  addFullscreenChangeListener,
} from '../utils/fullscreenOrientation';
import {
  sanitizeSearchQuery,
  sanitizeInputLive,
  sanitizeText,
  sanitizeSafeUrl,
} from '../utils/security';
import {
  MOVIX_INSTANT_ROWS,
  MOVIX_LANGUAGES,
  containsAdultSearchTerms,
  getMovixApiKeys,
  isFamilySafeMediaItem,
  resolveMovixDownloadUrl,
  saveMovixApiKeys,
  searchMovixWorldwide,
} from '../utils/movixApi';

const OFFLINE_WATCHLIST_STORAGE_KEY = 'jatt_offline_watchlist';
const HUB_PAGE_SIZE = 12;

interface GlobalHubTab {
  id:
    | 'all'
    | 'movies'
    | 'dramas'
    | 'songs'
    | 'cartoons'
    | 'realistic'
    | 'rhymes'
    | 'naat'
    | 'tilawat'
    | 'programs'
    | 'talk_shows';
  label: string;
  query: string;
}

const GLOBAL_HUB_TABS: GlobalHubTab[] = [
  { id: 'all', label: 'All', query: '' },
  {
    id: 'movies',
    label: 'Movies',
    query: 'full movies Hollywood Hindi dubbed Punjabi Korean action adventure HD',
  },
  {
    id: 'dramas',
    label: 'Dramas',
    query: 'Pakistani Indian Turkish Korean full dramas episodes HD',
  },
  {
    id: 'songs',
    label: 'Songs',
    query: 'Punjabi Hindi English Arabic latest official music video songs HD',
  },
  {
    id: 'cartoons',
    label: 'Cartoons',
    query: 'full cartoons anime episodes animated adventure kids HD',
  },
  {
    id: 'realistic',
    label: 'Realistic',
    query: '4K realistic nature wildlife travel documentary real life tour',
  },
  {
    id: 'rhymes',
    label: 'Rhymes',
    query: 'kids nursery rhymes baby songs phonics learning animation HD',
  },
  {
    id: 'naat',
    label: 'Naat',
    query: 'beautiful Islamic Naat Sharif Urdu Arabic Punjabi latest studio HD',
  },
  {
    id: 'tilawat',
    label: 'Tilawat',
    query: 'heart soothing Quran Tilawat full surah Qari Mishary Sudais HD',
  },
  {
    id: 'programs',
    label: 'Programs',
    query: 'worldwide TV programs cooking reality documentary show full episode HD',
  },
  {
    id: 'talk_shows',
    label: 'Talk Shows',
    query: 'popular talk show comedy show podcast interview full episode HD',
  },
];

const QUICK_MOVIEBOX_CHIPS = [
  'Hollywood & English',
  'Pakistani Dramas',
  'Turkish Dramas',
  'Korean Dramas',
  'Punjabi & Hindi Songs',
  'Urdu & Punjabi Naat',
  'Quran Tilawat',
  'Kids Rhymes',
  '4K Realistic Nature',
  'TV Talk Shows',
  'TV Programs',
];

const CURATED_FALLBACK_VIDEOS: Record<string, DownloadItem[]> = {
  Movies: [
    {
      id: 'yt-R6MlUcmOul8',
      title: 'Tears of Steel - Sci-Fi Action Feature Film 4K',
      subtitle: 'Blender Foundation Cinema',
      category: 'movies',
      categoryLabel: 'Movies',
      fileSize: 'Streaming 4K',
      sizeBytes: 180000000,
      durationOrVersion: '12:14',
      durationSeconds: 734,
      contentTypeTag: 'Movie',
      qualityBadge: '4K Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/mqdefault.jpg',
      fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Movies', 'Sci-Fi', '4K'],
      description: 'Clean sci-fi action film in 4K UHD.',
      youtubeId: 'R6MlUcmOul8',
    },
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Sintel - Global Fantasy Adventure Movie HD',
      subtitle: 'Cinema Fantasy Studio',
      category: 'movies',
      categoryLabel: 'Movies',
      fileSize: 'Streaming HD',
      sizeBytes: 125000000,
      durationOrVersion: '14:48',
      durationSeconds: 888,
      contentTypeTag: 'Movie',
      qualityBadge: '1080p Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/mqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Movies', 'Fantasy', 'HD'],
      description: 'Award-winning dramatic fantasy adventure feature.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
  Songs: [
    {
      id: 'yt-6MgsHSAcI9k',
      title: 'Top Punjabi & Hindi Bass Mix Hits',
      subtitle: 'Punjabi & Desi Music Global',
      category: 'songs',
      categoryLabel: 'Songs',
      fileSize: 'Streaming HD',
      sizeBytes: 12000000,
      durationOrVersion: '04:32',
      durationSeconds: 272,
      contentTypeTag: 'Song',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/mqdefault.jpg',
      fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Songs', 'Punjabi', 'Hindi'],
      description: 'Non-stop Punjabi & Hindi hit music stream.',
      youtubeId: '6MgsHSAcI9k',
    },
    {
      id: 'yt-jfKfPfyJRdk',
      title: '24/7 Chill Beats & Late Night Study Radio',
      subtitle: 'Global Music Radio Live',
      category: 'songs',
      categoryLabel: 'Songs',
      fileSize: 'Live Stream',
      sizeBytes: 45000000,
      durationOrVersion: 'LIVE',
      durationSeconds: 0,
      contentTypeTag: 'Song',
      qualityBadge: 'Live Audio HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
      fallbackGradient: 'from-rose-950 via-purple-950 to-black',
      downloadsCount: 'Live',
      rating: 4.95,
      tags: ['Songs', 'Live Radio'],
      description: 'Continuous 24/7 music broadcast.',
      youtubeId: 'jfKfPfyJRdk',
    },
  ],
  Cartoons: [
    {
      id: 'yt-YE7VzlLtp-4',
      title: 'Big Buck Bunny - Full Animated Adventure 4K 60fps',
      subtitle: 'Blender Animation Studio',
      category: 'cartoons',
      categoryLabel: 'Cartoons',
      fileSize: 'Streaming HD',
      sizeBytes: 150000000,
      durationOrVersion: '09:56',
      durationSeconds: 596,
      contentTypeTag: 'Cartoon',
      qualityBadge: 'Cartoon HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/YE7VzlLtp-4/mqdefault.jpg',
      fallbackGradient: 'from-amber-950 via-purple-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.95,
      tags: ['Cartoons', 'Animation'],
      description: 'Full family animated comedy adventure.',
      youtubeId: 'YE7VzlLtp-4',
    },
    {
      id: 'yt-aqz-KE-bpKQ',
      title: 'Cosmos & 3D Animated Showcase 60FPS',
      subtitle: 'Open Animation Central',
      category: 'cartoons',
      categoryLabel: 'Cartoons',
      fileSize: 'Streaming HD',
      sizeBytes: 140000000,
      durationOrVersion: '12:10',
      durationSeconds: 730,
      contentTypeTag: 'Cartoon',
      qualityBadge: 'Cartoon HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg',
      fallbackGradient: 'from-cyan-950 via-indigo-950 to-neutral-950',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Cartoons', 'Anime'],
      description: 'Ultra-crisp 60fps animated feature.',
      youtubeId: 'aqz-KE-bpKQ',
    },
  ],
  Dramas: [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Epic Family & Fantasy Drama Showcase HD',
      subtitle: 'Drama Central Global',
      category: 'dramas',
      categoryLabel: 'Dramas',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: '44:15',
      durationSeconds: 2655,
      contentTypeTag: 'Drama',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/mqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Dramas', 'HD'],
      description: 'Clean family drama showcase.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
  Realistic: [
    {
      id: 'yt-LXb3EKWsInQ',
      title: 'Costa Rica & Alpine Wildlife 4K Realistic Nature Film',
      subtitle: '4K Nature Realistic Documentary',
      category: 'realistic',
      categoryLabel: 'Realistic',
      fileSize: 'Streaming 4K',
      sizeBytes: 140000000,
      durationOrVersion: '05:14',
      durationSeconds: 314,
      contentTypeTag: 'Realistic',
      qualityBadge: '4K HDR Real',
      thumbnailUrl: 'https://i.ytimg.com/vi/LXb3EKWsInQ/mqdefault.jpg',
      fallbackGradient: 'from-emerald-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.96,
      tags: ['Realistic', 'Wildlife', '4K Documentary'],
      description: 'Ultra-realistic 4K wildlife and nature filming.',
      youtubeId: 'LXb3EKWsInQ',
    },
  ],
  Rhymes: [
    {
      id: 'yt-hq3yfQnllfQ',
      title: 'Classic ABC Phonics & Kids Nursery Rhymes HD',
      subtitle: 'Kids Learning Studio',
      category: 'rhymes',
      categoryLabel: 'Rhymes',
      fileSize: 'Streaming HD',
      sizeBytes: 42000000,
      durationOrVersion: '03:54',
      durationSeconds: 234,
      contentTypeTag: 'Rhymes',
      qualityBadge: 'Kids Rhymes HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/hq3yfQnllfQ/mqdefault.jpg',
      fallbackGradient: 'from-lime-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.92,
      tags: ['Rhymes', 'Nursery', 'Kids'],
      description: 'Educational kids rhymes and joyful learning songs.',
      youtubeId: 'hq3yfQnllfQ',
    },
  ],
  Naat: [
    {
      id: 'yt-8p0Q6X4vKzU',
      title: 'Mustafa Jaan e Rehmat Pe Lakhon Salam (Studio Naat)',
      subtitle: 'Islamic Naat Global Studio',
      category: 'naat',
      categoryLabel: 'Naat',
      fileSize: 'Streaming HD',
      sizeBytes: 18000000,
      durationOrVersion: '06:42',
      durationSeconds: 402,
      contentTypeTag: 'Naat',
      qualityBadge: 'Studio Acoustic',
      thumbnailUrl: 'https://i.ytimg.com/vi/8p0Q6X4vKzU/mqdefault.jpg',
      fallbackGradient: 'from-teal-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.99,
      tags: ['Naat', 'Hamd', 'Islamic'],
      description: 'Soulful Islamic Naat Sharif recitation.',
      youtubeId: '8p0Q6X4vKzU',
    },
  ],
  Tilawat: [
    {
      id: 'yt-Vq9s8N4cQ4Q',
      title: 'Surah Ar-Rahman Full Tilawat - Qari Mishary Alafasy',
      subtitle: 'Quran Recitation Worldwide',
      category: 'tilawat',
      categoryLabel: 'Tilawat',
      fileSize: 'Streaming HD',
      sizeBytes: 24000000,
      durationOrVersion: '16:40',
      durationSeconds: 1000,
      contentTypeTag: 'Tilawat',
      qualityBadge: 'Tilawat 320k',
      thumbnailUrl: 'https://i.ytimg.com/vi/Vq9s8N4cQ4Q/mqdefault.jpg',
      fallbackGradient: 'from-green-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.99,
      tags: ['Tilawat', 'Quran', 'Surah Rahman'],
      description: 'Heart-soothing Quran Tilawat with crystal clarity.',
      youtubeId: 'Vq9s8N4cQ4Q',
    },
  ],
  Programs: [
    {
      id: 'yt-LXb3EKWsInQ',
      title: 'Global Heritage & Wildlife TV Program Special',
      subtitle: 'Discovery World Broadcast',
      category: 'programs',
      categoryLabel: 'Programs',
      fileSize: 'Streaming HD',
      sizeBytes: 110000000,
      durationOrVersion: '42:15',
      durationSeconds: 2535,
      contentTypeTag: 'Program',
      qualityBadge: 'Broadcast HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/LXb3EKWsInQ/mqdefault.jpg',
      fallbackGradient: 'from-indigo-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.85,
      tags: ['Programs', 'TV Show', 'Culture'],
      description: 'Full-length cultural & exploration TV program.',
      youtubeId: 'LXb3EKWsInQ',
    },
  ],
  'Talk Shows': [
    {
      id: 'yt-YE7VzlLtp-4',
      title: 'Global Comedy & Celebrity Late Night Talk Show',
      subtitle: 'Entertainment Stage Podcast',
      category: 'talk_shows',
      categoryLabel: 'Talk Shows',
      fileSize: 'Streaming HD',
      sizeBytes: 98000000,
      durationOrVersion: '38:50',
      durationSeconds: 2330,
      contentTypeTag: 'Talk Show',
      qualityBadge: 'Talk Show HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/YE7VzlLtp-4/mqdefault.jpg',
      fallbackGradient: 'from-orange-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.88,
      tags: ['Talk Shows', 'Interview', 'Comedy'],
      description: 'Engaging host interviews and lively panel talk show.',
      youtubeId: 'YE7VzlLtp-4',
    },
  ],
  'Hollywood & English': [
    {
      id: 'yt-R6MlUcmOul8',
      title: 'Tears of Steel - English Sci-Fi Action Short Film 4K',
      subtitle: 'Blender Foundation Studio',
      category: 'movies',
      categoryLabel: 'Hollywood & English',
      fileSize: 'Streaming 4K',
      sizeBytes: 180000000,
      durationOrVersion: '12:14',
      durationSeconds: 734,
      contentTypeTag: 'Movie',
      qualityBadge: '4K Stream',
      thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/mqdefault.jpg',
      fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Hollywood & English', 'Sci-Fi', '4K'],
      description: 'Clean English sci-fi action short film in 4K UHD.',
      youtubeId: 'R6MlUcmOul8',
    },
  ],
  'Pakistani Dramas': [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Sintel - Award Winning Fantasy Drama Short Film',
      subtitle: 'Blender Studio',
      category: 'dramas',
      categoryLabel: 'Dramas',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: '44:00',
      durationSeconds: 2640,
      contentTypeTag: 'Drama',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/mqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Dramas', 'HD'],
      description: 'Full dramatic feature stream.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
  'Turkish Dramas': [
    {
      id: 'yt-eRsGyueVLvQ',
      title: 'Epic Historical & Family Drama Feature HD',
      subtitle: 'Drama Central Global',
      category: 'dramas',
      categoryLabel: 'Turkish Dramas',
      fileSize: 'Streaming HD',
      sizeBytes: 85000000,
      durationOrVersion: '52:10',
      durationSeconds: 3130,
      contentTypeTag: 'Drama',
      qualityBadge: 'YouTube HD',
      thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/mqdefault.jpg',
      fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
      downloadsCount: 'YouTube',
      rating: 4.9,
      tags: ['Turkish Dramas', 'Family', 'HD'],
      description: 'Clean family drama showcase.',
      youtubeId: 'eRsGyueVLvQ',
    },
  ],
};

interface DownloadHubProps {
  onBackToFeed: () => void;
  onOpenSavedOffline?: () => void;
  onShowToast: (msg: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  currentUser?: UserAccount | null;
}

interface DownloadProgressState {
  progress: number; // 0 - 100
  isDownloading: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  speed: string; // e.g. "14.2 MB/s"
  downloadedBytes: number;
}

const DownloadHubComponent: React.FC<DownloadHubProps> = ({
  onBackToFeed,
  onOpenSavedOffline,
  onShowToast,
  isMuted,
  onToggleMute,
  currentUser,
}) => {
  const isAdmin = isMainAdminAccount(currentUser);
  const isOnline = useOnlineStatus();
  const { isRamSaverMode, toggleRamSaverMode } = useRamSaverMode();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [items] = useState<DownloadItem[]>(INITIAL_DOWNLOADS);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [isMovixSettingsOpen, setIsMovixSettingsOpen] = useState<boolean>(false);
  const [tmdbKeyInput, setTmdbKeyInput] = useState<string>(() => getMovixApiKeys().tmdbApiKey);
  const [youtubeKeyInput, setYoutubeKeyInput] = useState<string>(() => getMovixApiKeys().youtubeApiKey);
  const [showApiKeys, setShowApiKeys] = useState<boolean>(false);
  const [resolvingDownloadId, setResolvingDownloadId] = useState<string | null>(null);
  const [watchPlaybackTrigger, setWatchPlaybackTrigger] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      return sessionStorage.getItem('jatt_hub_selected_category') || 'all';
    } catch {
      return 'all';
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return sessionStorage.getItem('jatt_yt_search_query') || '';
    } catch {
      return '';
    }
  });
  const [sortBy, setSortBy] = useState<'popular' | 'size_desc' | 'size_asc' | 'rating'>('popular');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'my_downloads'>('marketplace');

  // Track download progress per item ID
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadProgressState>>(() => {
    try {
      const stored = sessionStorage.getItem('jatt_downloads_state');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Track active video player item, 16:9 cinema fullscreen mode, HLS/MP4 direct playback, & never-blank error state
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);
  const [playerScaleMode, setPlayerScaleMode] = useState<'fill' | 'fit'>('fit');
  const [orientationLockBlocked, setOrientationLockBlocked] = useState<boolean>(false);
  const [viewportPortrait, setViewportPortrait] = useState<boolean>(() => isPortraitViewport());
  const cinemaViewportRef = React.useRef<HTMLDivElement | null>(null);
  const directVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const didEnterCinemaFullscreenRef = React.useRef<boolean>(false);

  // Resolution Selector: defaults to 480p ('large') on 3GB/low-RAM devices for zero-buffer playback
  const hasManualQualityRef = React.useRef<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<YouTubeQualityId>(() =>
    getIsRamSaverMode() ? 'large' : 'hd1080'
  );
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false);
  const [serverIndex, setServerIndex] = useState<number>(0);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Pagination states (maxResults=10 per page to keep RAM low)
  const [ytPage, setYtPage] = useState<number>(1);
  const [ytNextPageToken, setYtNextPageToken] = useState<string | null>(null);
  const [ytPrevPageToken, setYtPrevPageToken] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const lastSearchContextRef = React.useRef<{
    query: string;
    tabCacheKey?: GlobalHubTab['id'];
    displayLabel?: string;
  } | null>(null);

  useEffect(() => {
    if (!hasManualQualityRef.current) {
      setSelectedQuality(isRamSaverMode ? 'large' : 'hd1080');
    }
  }, [isRamSaverMode]);

  const activeQualityOption = getQualityOption(selectedQuality);
  const cssLandscapeActive = isCinemaMode && orientationLockBlocked && viewportPortrait;

  const handleFastServerReload = () => {
    setPlayerError(null);
    setIsQualityMenuOpen(false);
    setServerIndex((prev) => {
      const next = (prev + 1) % 2;
      onShowToast(
        next === 1
          ? 'Switched to Fast Mirror Server & reloaded player!'
          : 'Switched to Privacy Fast Server & reloaded player!'
      );
      return next;
    });
    setReloadNonce((n) => n + 1);
  };

  // Detect YouTube IFrame embedding restrictions (errors 100, 101, 150, 2, 5) so screen is NEVER blank
  useEffect(() => {
    if (!previewItem?.youtubeId) return;
    const handleYouTubeMessage = (event: MessageEvent) => {
      if (
        typeof event.origin !== 'string' ||
        (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com'))
      ) {
        return;
      }
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || typeof data !== 'object') return;
        if (data.event === 'onError') {
          const code = Number(data.info);
          if (code === 101 || code === 150) {
            setPlayerError(
              'The video owner restricted in-app embedding for this video. Tap below to watch it directly on YouTube.'
            );
          } else if (code === 100) {
            setPlayerError('This video is private or unavailable for embed playback.');
          } else {
            setPlayerError('In-app YouTube playback encountered an error. Open directly on YouTube.');
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleYouTubeMessage);
    return () => window.removeEventListener('message', handleYouTubeMessage);
  }, [previewItem?.youtubeId]);

  // Attach HLS.js / direct MP4 streaming when previewItem has directVideoUrl
  useEffect(() => {
    const videoEl = directVideoRef.current;
    const rawUrl = previewItem?.directVideoUrl;
    if (!videoEl || !rawUrl) return;

    const safeUrl = sanitizeSafeUrl(rawUrl, { allowBlob: false, allowDataImageAudio: false });
    if (!safeUrl) {
      setPlayerError('Blocked unsafe or invalid video URL.');
      return;
    }

    const isHls = /\.m3u8(?:$|\?|#)/i.test(safeUrl);
    let hlsInstance: Hls | null = null;

    if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = safeUrl;
      void videoEl.play().catch(() => {});
    } else if (isHls && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsInstance.loadSource(safeUrl);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        void videoEl.play().catch(() => {});
      });
      hlsInstance.on(Hls.Events.ERROR, (_ev, data) => {
        if (data.fatal) {
          setPlayerError('Could not load this live .m3u8 stream (CORS or offline source).');
        }
      });
    } else {
      videoEl.src = safeUrl;
      void videoEl.play().catch(() => {});
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      videoEl.pause();
      videoEl.removeAttribute('src');
      try {
        videoEl.load();
      } catch {
        // ignore
      }
    };
  }, [previewItem?.directVideoUrl]);

  // Track viewport orientation for CSS rotation fallback
  useEffect(() => {
    const syncViewport = () => setViewportPortrait(isPortraitViewport());
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const exitFullscreenAndRestorePortrait = React.useCallback(async () => {
    didEnterCinemaFullscreenRef.current = false;
    setIsCinemaMode(false);
    setOrientationLockBlocked(false);
    await unlockOrientationToPortrait();
  }, []);

  const enterFullscreenAndLandscape = React.useCallback(
    async (scaleMode?: 'fill' | 'fit') => {
      if (scaleMode) setPlayerScaleMode(scaleMode);
      setIsCinemaMode(true);
      didEnterCinemaFullscreenRef.current = true;

      const targetEl = cinemaViewportRef.current || document.documentElement;
      const enteredFs = await requestElementFullscreen(targetEl);
      if (!enteredFs) {
        didEnterCinemaFullscreenRef.current = false;
      }

      const locked = await lockScreenLandscape();
      if (!locked) {
        setOrientationLockBlocked(true);
        setViewportPortrait(isPortraitViewport());
      } else {
        setOrientationLockBlocked(false);
      }
    },
    []
  );

  // Sync orientation lock when entering/exiting fullscreen natively (including YouTube iframe FS button or Esc/Back)
  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = getFullscreenElement();
      if (fsEl) {
        void lockScreenLandscape().then((locked) => {
          setOrientationLockBlocked(!locked);
          setViewportPortrait(isPortraitViewport());
        });
      } else {
        if (didEnterCinemaFullscreenRef.current) {
          didEnterCinemaFullscreenRef.current = false;
          setIsCinemaMode(false);
        }
        setOrientationLockBlocked(false);
        void unlockOrientationToPortrait();
      }
    };

    return addFullscreenChangeListener(handleFsChange);
  }, []);

  // Ensure orientation unlocks back to portrait on unmount
  useEffect(() => {
    return () => {
      void unlockOrientationToPortrait();
    };
  }, []);

  const handleToggleFullscreenApi = () => {
    if (getFullscreenElement() || isCinemaMode) {
      void exitFullscreenAndRestorePortrait();
    } else {
      void enterFullscreenAndLandscape();
    }
  };

  // YouTube Search States
  const [isSearchingYouTube, setIsSearchingYouTube] = useState<boolean>(false);

  // Instant Caching: Cache max 10 YouTube search results per page in sessionStorage
  const [youtubeLiveResults, setYoutubeLiveResults] = useState<DownloadItem[]>(() => {
    try {
      const cached = sessionStorage.getItem('jatt_yt_search_results');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, HUB_PAGE_SIZE);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [searchSource, setSearchSource] = useState<'catalog' | 'youtube'>(() => {
    try {
      const saved = sessionStorage.getItem('jatt_yt_search_source');
      if (saved === 'youtube') return 'youtube';
    } catch {
      // ignore
    }
    return 'catalog';
  });
  const [activeGlobalTab, setActiveGlobalTab] = useState<GlobalHubTab['id']>(() => {
    try {
      const saved = sessionStorage.getItem('jatt_hub_global_tab') as GlobalHubTab['id'] | null;
      if (saved && GLOBAL_HUB_TABS.some((t) => t.id === saved)) return saved;
    } catch {
      // ignore
    }
    return 'all';
  });

  // Offline Watchlist saved in localStorage
  const [offlineWatchlist, setOfflineWatchlist] = useState<DownloadItem[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_WATCHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [directUrlInput, setDirectUrlInput] = useState<string>('');

  // Extract valid 11-char YouTube Video ID from any URL format or direct ID
  // Decode HTML entities returned by YouTube Data API (e.g. &#39; -> ', &amp; -> &)
  const decodeHtmlEntities = (str: string): string => {
    if (!str) return '';
    try {
      const parser = new DOMParser();
      const dom = parser.parseFromString(str, 'text/html');
      return dom.body.textContent || str;
    } catch {
      return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }
  };

  // Extract valid 11-char YouTube Video ID from any URL format (/watch?v=, youtu.be/, /shorts/, /live/, /embed/, music.youtube.com) or direct ID
  const extractYouTubeId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Attempt standard URL parsing first so ?si=, &t=, m.youtube.com, music.youtube.com all work cleanly
    try {
      const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const url = new URL(withProto);
      const host = url.hostname.toLowerCase();

      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        const seg = url.pathname.split('/').filter(Boolean)[0];
        if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) return seg;
      }

      if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
        const vParam = url.searchParams.get('v');
        if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

        const segments = url.pathname.split('/').filter(Boolean);
        if (
          segments.length >= 2 &&
          ['shorts', 'live', 'embed', 'v'].includes(segments[0].toLowerCase()) &&
          /^[a-zA-Z0-9_-]{11}$/.test(segments[1])
        ) {
          return segments[1];
        }
      }
    } catch {
      // Fall back to regex below
    }

    const fallbackMatch = trimmed.match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/i
    );
    return fallbackMatch ? fallbackMatch[1] : null;
  };

  type ParsedPlayableLink =
    | { kind: 'youtube'; youtubeId: string }
    | { kind: 'direct_video'; directVideoUrl: string; isHls: boolean }
    | { kind: 'embed'; embedUrl: string }
    | null;

  const parseUniversalPlayableLink = (rawInput: string): ParsedPlayableLink => {
    const clean = sanitizeText(rawInput, 600);
    if (!clean) return null;

    const ytid = extractYouTubeId(clean);
    if (ytid) {
      return { kind: 'youtube', youtubeId: ytid };
    }

    if (/^(?:https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}\/)/i.test(clean)) {
      const withProto = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      const safeUrl = sanitizeSafeUrl(withProto, {
        allowBlob: false,
        allowDataImageAudio: false,
      });
      if (!safeUrl) return null;

      try {
        const parsed = new URL(safeUrl);
        const pathLower = parsed.pathname.toLowerCase();
        if (
          pathLower.endsWith('.mp4') ||
          pathLower.endsWith('.webm') ||
          pathLower.endsWith('.m3u8') ||
          /\.(?:mp4|webm|m3u8)(?:$|\?|&)/i.test(safeUrl)
        ) {
          return {
            kind: 'direct_video',
            directVideoUrl: safeUrl,
            isHls: pathLower.endsWith('.m3u8') || /\.m3u8(?:$|\?|&)/i.test(safeUrl),
          };
        }
        return { kind: 'embed', embedUrl: safeUrl };
      } catch {
        return null;
      }
    }

    return null;
  };

  const openVideoPlayer = (item: DownloadItem) => {
    setPlayerError(null);
    setPreviewItem(item);
    setActiveTab('marketplace');
    if (!isOnline && (item.youtubeId || item.directVideoUrl || item.embedUrl)) {
      onShowToast('You are offline. Online streaming needs internet — check Saved / Downloads!');
    }
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 30);
  };

  const playParsedUniversalLink = (parsed: NonNullable<ParsedPlayableLink>): DownloadItem => {
    if (parsed.kind === 'youtube') {
      return {
        id: `custom-yt-${parsed.youtubeId}`,
        title: 'YouTube Custom Stream',
        subtitle: `Privacy-Enhanced Player (ID: ${parsed.youtubeId})`,
        category: 'movies',
        categoryLabel: 'YouTube Stream',
        fileSize: 'Streaming 1080p',
        sizeBytes: 150000000,
        durationOrVersion: 'YouTube HD',
        qualityBadge: 'YouTube 1080p',
        thumbnailUrl: `https://i.ytimg.com/vi/${parsed.youtubeId}/hqdefault.jpg`,
        fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
        downloadsCount: 'Stream',
        rating: 5.0,
        tags: ['YouTube', '16:9 Widescreen'],
        description: 'Streamed via privacy-enhanced youtube-nocookie player.',
        youtubeId: parsed.youtubeId,
      };
    }

    if (parsed.kind === 'direct_video') {
      return {
        id: `custom-vid-${Date.now()}`,
        title: parsed.isHls ? 'Live HLS (.m3u8) Stream' : 'Direct Video Stream',
        subtitle: parsed.directVideoUrl,
        category: 'movies',
        categoryLabel: parsed.isHls ? 'Live HLS' : 'Direct MP4',
        fileSize: 'Direct Stream',
        sizeBytes: 120000000,
        durationOrVersion: parsed.isHls ? 'LIVE .m3u8' : 'HD Video',
        qualityBadge: parsed.isHls ? 'HLS Adaptive' : 'Direct MP4',
        thumbnailUrl: '',
        fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
        downloadsCount: 'Direct',
        rating: 5.0,
        tags: ['Direct Video', '16:9 Widescreen'],
        description: 'Direct HTML5 / HLS adaptive stream inside built-in 16:9 widescreen player.',
        directVideoUrl: parsed.directVideoUrl,
      };
    }

    return {
      id: `custom-embed-${Date.now()}`,
      title: 'Public Video Embed Stream',
      subtitle: parsed.embedUrl,
      category: 'movies',
      categoryLabel: 'Public Embed',
      fileSize: 'Web Embed',
      sizeBytes: 100000000,
      durationOrVersion: 'Embed Player',
      qualityBadge: 'Public Embed',
      thumbnailUrl: '',
      fallbackGradient: 'from-indigo-950 via-neutral-950 to-black',
      downloadsCount: 'Embed',
      rating: 4.9,
      tags: ['Embed URL', '16:9 Widescreen'],
      description: 'Public embed URL loaded in built-in 16:9 widescreen viewport.',
      embedUrl: parsed.embedUrl,
    };
  };

  // Play any custom YouTube URL, .mp4/.m3u8 direct link, or public embed URL in 16:9 Landscape Fullscreen Player
  const handlePlayDirectUrl = (overrideInput?: string) => {
    if (!isOnline) {
      onShowToast('Offline Mode: Connect to internet to stream links, or open Saved / Downloads.');
      return;
    }
    const raw = (overrideInput !== undefined ? overrideInput : directUrlInput).trim();
    if (!raw && previewItem) {
      void enterFullscreenAndLandscape('fit');
      onShowToast('Entered 16:9 Widescreen Landscape mode');
      return;
    }
    const parsed = parseUniversalPlayableLink(raw);
    if (!parsed) {
      onShowToast('Paste a valid YouTube link, .mp4 / .m3u8 URL, or public embed URL.');
      return;
    }
    const directItem = playParsedUniversalLink(parsed);
    openVideoPlayer(directItem);
    void enterFullscreenAndLandscape('fit');
    if (overrideInput === undefined) setDirectUrlInput('');
    onShowToast('Playing in 16:9 Widescreen Landscape Fullscreen!');
  };

  // Toggle Offline Watchlist / Cache thumbnail locally for MOVIX movies, dramas, songs & Quran
  const handleToggleWatchlist = (item: DownloadItem) => {
    setOfflineWatchlist((prev) => {
      const exists = prev.some((w) => w.id === item.id);
      const next = exists ? prev.filter((w) => w.id !== item.id) : [item, ...prev];
      try {
        localStorage.setItem(OFFLINE_WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      if (!exists && typeof caches !== 'undefined' && item.thumbnailUrl) {
        caches
          .open('jatt-watchlist-v1')
          .then((cache) => cache.add(item.thumbnailUrl))
          .catch(() => {});
      }
      if (!exists) {
        soundEngine.playDownloadComplete();
        onShowToast(`Saved "${item.title}" to MOVIX Watchlist!`);
      } else {
        onShowToast(`Removed "${item.title}" from Watchlist`);
      }
      return next;
    });
  };

  // Trigger real media file download (iTunes MP4, Archive.org MP4, Direct Video, or muxed stream)
  const handleMovixDownloadItem = async (item: DownloadItem) => {
    if (resolvingDownloadId === item.id) return;
    setResolvingDownloadId(item.id);
    handleStartDownload(item);

    try {
      const directUrl = await resolveMovixDownloadUrl(item);
      if (directUrl) {
        const safeHref = sanitizeSafeUrl(directUrl, {
          allowBlob: false,
          allowDataImageAudio: false,
        });
        if (safeHref) {
          const safeFileName = `${(item.title || 'movix-media')
            .replace(/[^a-z0-9\-_ ]+/gi, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 48)}.mp4`;
          const link = document.createElement('a');
          link.href = safeHref;
          link.download = safeFileName;
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          onShowToast(`Downloading "${item.title}" MP4 file...`);
          return;
        }
      }

      // If stream is YouTube embed-only without CORS-accessible MP4 mirror, save to Watchlist too
      setOfflineWatchlist((prev) => {
        if (prev.some((w) => w.id === item.id)) return prev;
        const next = [item, ...prev];
        try {
          localStorage.setItem(OFFLINE_WATCHLIST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      onShowToast(`Saved "${item.title}" to Saved & Watchlist for quick access!`);
    } finally {
      setResolvingDownloadId(null);
    }
  };

  // Watch CTA handler inside Full HD Player Modal
  const handleWatchAction = (item: DownloadItem) => {
    setWatchPlaybackTrigger((n) => n + 1);
    if (directVideoRef.current) {
      void directVideoRef.current.play().catch(() => {});
    }
    if (item.youtubeId) {
      setReloadNonce((n) => n + 1);
    }
    void enterFullscreenAndLandscape('fit');
    onShowToast(`Watching "${item.title}" in Full HD!`);
  };

  // Switch between Global Content Hub category tabs with instant sessionStorage cache (max 10/page)
  const handleSelectGlobalTab = (tab: GlobalHubTab) => {
    setActiveGlobalTab(tab.id);
    setYtPage(1);
    setCatalogPage(1);
    setYtNextPageToken(null);
    setYtPrevPageToken(null);
    try {
      sessionStorage.setItem('jatt_hub_global_tab', tab.id);
    } catch {
      // ignore
    }

    if (tab.id === 'all') {
      setSearchSource('catalog');
      setSelectedCategory('all');
      setSearchQuery('');
      return;
    }

    lastSearchContextRef.current = {
      query: tab.query,
      tabCacheKey: tab.id,
      displayLabel: tab.label,
    };

    // Check sessionStorage per-tab cache first for instant switching
    try {
      const rawCache = sessionStorage.getItem('jatt_yt_tab_cache');
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as Record<
          string,
          DownloadItem[] | { items: DownloadItem[]; nextPageToken?: string | null }
        >;
        const entry = parsed?.[tab.id];
        const cachedItems = Array.isArray(entry)
          ? entry
          : Array.isArray(entry?.items)
          ? entry.items
          : [];
        if (cachedItems.length > 0) {
          setYoutubeLiveResults(cachedItems.slice(0, HUB_PAGE_SIZE));
          setYtNextPageToken(Array.isArray(entry) ? null : entry?.nextPageToken || null);
          setSearchQuery(tab.label);
          setSearchSource('youtube');
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    setSearchQuery(tab.label);
    void handleSearchYouTubeLive(tab.query, tab.id, tab.label, 1, null);
  };

  // Paginated multi-provider family-safe worldwide MOVIX search (TMDB + YouTube + iTunes + Archive + Invidious/Piped)
  const handleSearchYouTubeLive = async (
    targetQuery?: string,
    tabCacheKey?: GlobalHubTab['id'],
    displayLabel?: string,
    targetPage = 1,
    pageToken: string | null = null,
    languageOverride?: string
  ) => {
    const query = sanitizeText(targetQuery !== undefined ? targetQuery : searchQuery, 600);
    if (!query) {
      onShowToast('Type a movie, drama, song, clip, or Quran title in any language.');
      return;
    }

    // Strict Family-Safe Shield: Block adult / 18+ / NSFW queries immediately
    if (containsAdultSearchTerms(query)) {
      onShowToast('MOVIX Family-Safe Filter: Adult / 18+ content is strictly blocked.');
      return;
    }

    if (!isOnline) {
      onShowToast('Offline Mode: Live worldwide search needs internet. Watch Saved & Watchlist offline!');
      return;
    }

    // If user pasted a direct YouTube/MP4/M3U8/Embed link in the search bar, play it right away in 16:9 Landscape!
    if (targetQuery === undefined && targetPage === 1 && !pageToken) {
      const parsedLink = parseUniversalPlayableLink(query);
      if (parsedLink) {
        const playable = playParsedUniversalLink(parsedLink);
        openVideoPlayer(playable);
        void enterFullscreenAndLandscape('fit');
        onShowToast('Link loaded in MOVIX Full HD Player!');
        return;
      }
    }

    if (targetQuery !== undefined && displayLabel === undefined) {
      setSearchQuery(query);
    }

    lastSearchContextRef.current = {
      query,
      tabCacheKey,
      displayLabel,
    };

    setIsSearchingYouTube(true);

    try {
      const effectiveLang = languageOverride ?? selectedLanguage;
      const liveRes = await searchMovixWorldwide({
        query,
        languageId: effectiveLang,
        page: targetPage,
        pageToken,
        hintLabel: displayLabel || tabCacheKey,
      });

      if (liveRes.blockedForSafety) {
        onShowToast('MOVIX Family-Safe Filter: Adult / 18+ content is strictly blocked.');
        return;
      }

      let mappedResults: DownloadItem[] = liveRes.items.filter((it) => isFamilySafeMediaItem(it));
      const resolvedNextToken = liveRes.nextPageToken;
      const resolvedPrevToken = liveRes.prevPageToken;

      // Guaranteed local family-safe curated fallback if all live providers returned empty
      if (mappedResults.length === 0) {
        const lookupText = (displayLabel || query).toLowerCase();
        const curatedKey = Object.keys(CURATED_FALLBACK_VIDEOS).find(
          (k) => lookupText.includes(k.toLowerCase()) || k.toLowerCase().includes(lookupText)
        );
        const movixCuratedPool = MOVIX_INSTANT_ROWS.flatMap((row) => row.items);
        const combinedSource = [...movixCuratedPool, ...INITIAL_DOWNLOADS];
        const catalogMatches = combinedSource.filter(
          (it) =>
            isFamilySafeMediaItem(it) &&
            (it.title.toLowerCase().includes(lookupText) ||
              it.subtitle.toLowerCase().includes(lookupText) ||
              it.categoryLabel.toLowerCase().includes(lookupText) ||
              (it.languageLabel && it.languageLabel.toLowerCase().includes(lookupText)) ||
              (it.contentTypeTag && it.contentTypeTag.toLowerCase().includes(lookupText)) ||
              it.tags.some((t) => t.toLowerCase().includes(lookupText)))
        );
        const combinedPool = [
          ...(curatedKey ? CURATED_FALLBACK_VIDEOS[curatedKey] : []),
          ...catalogMatches,
          ...(!curatedKey && catalogMatches.length === 0 ? movixCuratedPool : []),
        ];
        const dedupedPool = combinedPool.filter(
          (it, idx, arr) =>
            isFamilySafeMediaItem(it) && arr.findIndex((other) => other.id === it.id) === idx
        );
        const startOffset = ((targetPage - 1) * HUB_PAGE_SIZE) % Math.max(1, dedupedPool.length);

        mappedResults = dedupedPool
          .slice(startOffset, startOffset + HUB_PAGE_SIZE)
          .map((it) => {
            const styleTag =
              it.contentTypeTag ||
              classifyVideoContentType({
                title: it.title,
                subtitle: it.subtitle,
                description: it.description,
                tags: it.tags,
                category: it.category,
                tabHint: displayLabel || tabCacheKey,
                durationSeconds: it.durationSeconds,
              });
            return {
              ...it,
              contentTypeTag: styleTag,
              durationOrVersion:
                it.durationSeconds !== undefined
                  ? formatVideoDuration(it.durationSeconds)
                  : it.durationOrVersion,
            };
          });
      }

      if (tabCacheKey && targetPage === 1 && mappedResults.length > 0 && effectiveLang === 'all') {
        try {
          const rawCache = sessionStorage.getItem('jatt_yt_tab_cache');
          const parsed = rawCache ? JSON.parse(rawCache) : {};
          parsed[tabCacheKey] = {
            items: mappedResults.slice(0, HUB_PAGE_SIZE),
            nextPageToken: resolvedNextToken,
          };
          sessionStorage.setItem('jatt_yt_tab_cache', JSON.stringify(parsed));
        } catch {
          // ignore
        }
      }

      setYtPage(targetPage);
      setYtNextPageToken(resolvedNextToken);
      setYtPrevPageToken(resolvedPrevToken);
      setYoutubeLiveResults(mappedResults.slice(0, HUB_PAGE_SIZE));
      setSearchSource('youtube');
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      onShowToast(
        `MOVIX found ${mappedResults.length} family-safe results${
          displayLabel ? ` in ${displayLabel}` : ` for "${query}"`
        }`
      );
    } finally {
      setIsSearchingYouTube(false);
    }
  };

  const handleLoadYouTubePage = (direction: 'prev' | 'next') => {
    const ctx = lastSearchContextRef.current || {
      query: searchQuery || 'World Movies',
    };
    if (direction === 'next') {
      const nextToken = ytNextPageToken && !ytNextPageToken.startsWith('page-') ? ytNextPageToken : null;
      void handleSearchYouTubeLive(ctx.query, ctx.tabCacheKey, ctx.displayLabel, ytPage + 1, nextToken);
    } else if (ytPage > 1) {
      const prevToken = ytPrevPageToken && !ytPrevPageToken.startsWith('page-') ? ytPrevPageToken : null;
      void handleSearchYouTubeLive(ctx.query, ctx.tabCacheKey, ctx.displayLabel, ytPage - 1, prevToken);
    }
  };

  // Sync to session
  useEffect(() => {
    try {
      sessionStorage.setItem('jatt_downloads_state', JSON.stringify(downloadStates));
    } catch {
      // ignore
    }
  }, [downloadStates]);

  // Instantly cache YouTube search results and navigation state in sessionStorage
  useEffect(() => {
    try {
      if (youtubeLiveResults.length > 0) {
        sessionStorage.setItem('jatt_yt_search_results', JSON.stringify(youtubeLiveResults));
      } else {
        sessionStorage.removeItem('jatt_yt_search_results');
      }
      sessionStorage.setItem('jatt_yt_search_query', searchQuery);
      sessionStorage.setItem('jatt_yt_search_source', searchSource);
      sessionStorage.setItem('jatt_hub_selected_category', selectedCategory);
    } catch {
      // ignore
    }
  }, [youtubeLiveResults, searchQuery, searchSource, selectedCategory]);

  // Simulate progress timer for active downloads
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloadStates((prev) => {
        let hasChanges = false;
        const next = { ...prev };

        Object.keys(next).forEach((id) => {
          const state = next[id];
          if (state && state.isDownloading && !state.isPaused && !state.isCompleted) {
            hasChanges = true;
            // Increment progress smoothly across catalog, MOVIX rows, and live search results
            const allKnownItems = [
              ...items,
              ...MOVIX_INSTANT_ROWS.flatMap((r) => r.items),
              ...youtubeLiveResults,
              ...offlineWatchlist,
            ];
            const item = allKnownItems.find((it) => it.id === id);
            const totalBytes = item?.sizeBytes || 20000000;
            const stepIncrement = Math.floor(Math.random() * 8) + 6; // 6-13%
            const newProgress = Math.min(100, state.progress + stepIncrement);
            const downloadedBytes = Math.floor((newProgress / 100) * totalBytes);
            const speeds = ['12.8 MB/s', '16.4 MB/s', '19.2 MB/s', '24.1 MB/s', '14.5 MB/s'];
            const randomSpeed = speeds[Math.floor(Math.random() * speeds.length)];

            if (newProgress >= 100) {
              soundEngine.playDownloadComplete();
              onShowToast(`Downloaded "${item?.title || 'MOVIX Media'}" successfully!`);
              next[id] = {
                ...state,
                progress: 100,
                isDownloading: false,
                isCompleted: true,
                speed: 'Completed',
                downloadedBytes: totalBytes,
              };
            } else {
              next[id] = {
                ...state,
                progress: newProgress,
                speed: randomSpeed,
                downloadedBytes,
              };
            }
          }
        });

        return hasChanges ? next : prev;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [items, onShowToast]);

  // Start or resume download
  const handleStartDownload = (item: DownloadItem) => {
    soundEngine.playDownloadStart();
    onShowToast(`Downloading "${item.title}"...`);

    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        progress: prev[item.id]?.progress || 4,
        isDownloading: true,
        isPaused: false,
        isCompleted: false,
        speed: '12.4 MB/s',
        downloadedBytes: Math.floor(((prev[item.id]?.progress || 4) / 100) * item.sizeBytes),
      },
    }));
  };

  // Pause download
  const handlePauseDownload = (item: DownloadItem) => {
    onShowToast(`Paused download: ${item.title}`);
    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        isPaused: true,
      },
    }));
  };

  // Resume download
  const handleResumeDownload = (item: DownloadItem) => {
    soundEngine.playDownloadStart();
    onShowToast(`Resumed download: ${item.title}`);
    setDownloadStates((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        isPaused: false,
        isDownloading: true,
      },
    }));
  };

  // Cancel / Remove download
  const handleRemoveDownload = (itemId: string, itemTitle?: string) => {
    onShowToast(`Removed download${itemTitle ? `: ${itemTitle}` : ''}`);
    setDownloadStates((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Category filter
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'tilawat') {
            if (item.category !== 'tilawat' && item.category !== 'quran') return false;
          } else if (item.category !== selectedCategory) {
            return false;
          }
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchSubtitle = item.subtitle.toLowerCase().includes(q);
          const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
          const matchBadge = item.qualityBadge.toLowerCase().includes(q);
          const matchType = item.contentTypeTag?.toLowerCase().includes(q) || false;
          return matchTitle || matchSubtitle || matchTags || matchBadge || matchType;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'size_desc') return b.sizeBytes - a.sizeBytes;
        if (sortBy === 'size_asc') return a.sizeBytes - b.sizeBytes;
        // default: popular
        return parseInt(b.downloadsCount) - parseInt(a.downloadsCount);
      });
  }, [items, selectedCategory, searchQuery, sortBy]);

  // Paginated Catalog or Live YouTube results (max 10 cards mounted per page to save 3GB RAM)
  const totalCatalogPages = Math.max(1, Math.ceil(filteredItems.length / HUB_PAGE_SIZE));
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);

  useEffect(() => {
    setCatalogPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  const displayedItems = useMemo(() => {
    if (searchSource === 'youtube' && youtubeLiveResults.length > 0) {
      return youtubeLiveResults.slice(0, HUB_PAGE_SIZE);
    }
    const start = (safeCatalogPage - 1) * HUB_PAGE_SIZE;
    return filteredItems.slice(start, start + HUB_PAGE_SIZE);
  }, [searchSource, youtubeLiveResults, filteredItems, safeCatalogPage]);

  // Completed downloads for "Watchlist & Saved"
  const completedDownloads = useMemo(() => {
    const pool = [
      ...items,
      ...MOVIX_INSTANT_ROWS.flatMap((r) => r.items),
      ...youtubeLiveResults,
      ...offlineWatchlist,
    ];
    const seen = new Set<string>();
    return pool.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return Boolean(downloadStates[it.id]?.isCompleted);
    });
  }, [items, youtubeLiveResults, offlineWatchlist, downloadStates]);

  // Total downloaded size in bytes
  const totalDownloadedSizeStr = useMemo(() => {
    const total = completedDownloads.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    if (total === 0) return '0 MB';
    if (total > 1024 * 1024 * 1024) {
      return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(total / (1024 * 1024)).toFixed(1)} MB`;
  }, [completedDownloads]);

  // Render category icon
  const renderCategoryIcon = (catId: string, className = 'w-4 h-4') => {
    switch (catId) {
      case 'songs':
        return <Music className={className} />;
      case 'apps':
        return <Smartphone className={className} />;
      case 'dramas':
        return <Tv className={className} />;
      case 'movies':
        return <Film className={className} />;
      case 'cartoons':
        return <Smile className={className} />;
      case 'realistic':
        return <Compass className={className} />;
      case 'rhymes':
        return <Baby className={className} />;
      case 'naat':
        return <HeartHandshake className={className} />;
      case 'tilawat':
      case 'quran':
        return <BookOpen className={className} />;
      case 'programs':
        return <Radio className={className} />;
      case 'talk_shows':
        return <Mic className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white overflow-hidden select-none">
      {/* Top Header Bar — MOVIX World Cinema, Dramas, Songs & Quran */}
      <div className="shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 bg-neutral-950/95 border-b border-neutral-800/80 [transform:translateZ(0)] flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToFeed}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
            title="Return to Reels Feed"
          >
            <ArrowLeft className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Reels Feed</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/25 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1 truncate">
                  <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                    MOVIX
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400 hidden xs:inline">
                    · Movie Box
                  </span>
                </h1>
                <span
                  className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0"
                  title="Zero Adult / 18+ Content — Strictly Family-Safe"
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span className="hidden md:inline">Family-Safe</span>
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 hidden sm:block truncate">
                Worldwide Movies · Dramas · Full HD Songs · Video Clips · Quran &amp; Bayans
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Controls: MOVIX Settings (Admin), RAM Saver, Explore vs Watchlist, Mute */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                const keys = getMovixApiKeys();
                setTmdbKeyInput(keys.tmdbApiKey);
                setYoutubeKeyInput(keys.youtubeApiKey);
                setIsMovixSettingsOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
              title="MOVIX Settings (Admin: Configure TMDB & YouTube API Keys)"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">MOVIX Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const next = toggleRamSaverMode();
              onShowToast(
                next
                  ? 'Lite / RAM Saver Mode ON (480p default, mqdefault thumbs, zero blur)'
                  : 'Lite / RAM Saver Mode OFF (Full visuals)'
              );
            }}
            className={`px-2 sm:px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors ${
              isRamSaverMode
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Toggle Lite / 3GB RAM Saver Mode"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isRamSaverMode ? 'RAM Saver' : 'Lite RAM'}</span>
          </button>

          <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800 text-[11px] sm:text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'marketplace'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my_downloads')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'my_downloads'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Watchlist &amp; Saved</span>
              <span className="sm:hidden">Saved</span>
              {completedDownloads.length + offlineWatchlist.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-black text-[10px] font-black">
                  {completedDownloads.length + offlineWatchlist.length}
                </span>
              )}
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isMuted
                ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
                : 'bg-pink-600/20 text-pink-400 border-pink-500/40'
            }`}
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {activeTab === 'marketplace' ? (
        /* ========================================================================= */
        /* MARKETPLACE VIEW: SCROLLABLE CONTAINER WITH AUTO-UNMOUNTING VIDEO PLAYER   */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar pb-24 lg:pb-8"
          >
            {/* ===================================================================== */}
            {/* FULL HD VIDEO PLAYER MODAL (Watch, Save to Watchlist, & Download)      */}
            {/* ===================================================================== */}
            {previewItem && (
              <div
                className={
                  isCinemaMode
                    ? 'fixed inset-0 z-[75] bg-black'
                    : 'fixed inset-0 z-[65] bg-black/90 flex items-center justify-center p-2 sm:p-5 overflow-y-auto'
                }
                onClick={() => {
                  if (!isCinemaMode) {
                    setIsQualityMenuOpen(false);
                    setPreviewItem(null);
                  }
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={
                    isCinemaMode
                      ? 'w-full h-full'
                      : 'w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]'
                  }
                >
                  {/* Modal Header */}
                  {!isCinemaMode && (
                    <div className="px-3.5 sm:px-5 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 bg-neutral-950">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="p-2 rounded-xl bg-gradient-to-tr from-pink-600/25 to-cyan-500/25 text-cyan-300 border border-cyan-500/35 shrink-0">
                          {previewItem.youtubeId ? (
                            <Youtube className="w-4 h-4 text-red-400" />
                          ) : (
                            <Film className="w-4 h-4 text-cyan-300" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {previewItem.contentTypeTag && (
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${getContentTagBadgeClasses(
                                  previewItem.contentTypeTag
                                )}`}
                              >
                                {previewItem.contentTypeTag}
                              </span>
                            )}
                            {previewItem.languageLabel && (
                              <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-[9px] font-bold">
                                {previewItem.languageLabel}
                              </span>
                            )}
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              Family-Safe
                            </span>
                          </div>
                          <h2 className="text-xs sm:text-sm font-black text-white truncate mt-0.5">
                            {previewItem.title}
                          </h2>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {previewItem.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 relative">
                        {previewItem.youtubeId && (
                          <>
                            <button
                              type="button"
                              onClick={handleFastServerReload}
                              className="px-2.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              title="Switch Fast Server or Reload"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Fast Server</span>
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsQualityMenuOpen((o) => !o)}
                                className={`px-2.5 py-2 rounded-xl text-xs font-black flex items-center gap-1 border cursor-pointer ${
                                  activeQualityOption.isUltraHd
                                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-cyan-300'
                                }`}
                                title="Resolution (360p to 4K)"
                              >
                                <Settings className="w-3.5 h-3.5" />
                                <span>{activeQualityOption.shortBadge}</span>
                              </button>

                              {isQualityMenuOpen && (
                                <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl p-1.5 z-50">
                                  <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                    Video Resolution
                                  </p>
                                  {YOUTUBE_QUALITY_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => {
                                        hasManualQualityRef.current = true;
                                        setSelectedQuality(opt.id);
                                        setIsQualityMenuOpen(false);
                                        onShowToast(`Resolution set to ${opt.label}`);
                                      }}
                                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer ${
                                        selectedQuality === opt.id
                                          ? 'bg-pink-600/25 text-white border border-pink-500/40'
                                          : 'text-neutral-300 hover:bg-neutral-800'
                                      }`}
                                    >
                                      <span>{opt.label}</span>
                                      {opt.isUltraHd && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">
                                          4K
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setPlayerScaleMode((prev) => (prev === 'fill' ? 'fit' : 'fill'))
                          }
                          className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 cursor-pointer"
                          title="Toggle Stretch Fill / 16:9 Fit"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void exitFullscreenAndRestorePortrait();
                            setIsQualityMenuOpen(false);
                            setPreviewItem(null);
                          }}
                          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white cursor-pointer"
                          aria-label="Close player modal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Unified Persistent Player Viewport */}
                  <div
                    ref={cinemaViewportRef}
                    onClick={
                      isCinemaMode
                        ? () => void exitFullscreenAndRestorePortrait()
                        : undefined
                    }
                    className={
                      isCinemaMode
                        ? 'fixed inset-0 z-[75] bg-black flex items-center justify-center overflow-hidden'
                        : 'relative w-full aspect-video max-h-[52dvh] bg-black overflow-hidden'
                    }
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={
                        cssLandscapeActive
                          ? {
                              position: 'fixed',
                              top: '50%',
                              left: '50%',
                              width: '100dvh',
                              height: '100vw',
                              transform: 'translate3d(-50%, -50%, 0) rotate(90deg)',
                              transformOrigin: 'center center',
                            }
                          : undefined
                      }
                      className={
                        cssLandscapeActive
                          ? 'bg-black flex flex-col items-center justify-center overflow-hidden'
                          : isCinemaMode
                          ? `w-full h-full flex flex-col items-center justify-center relative overflow-hidden ${
                              playerScaleMode === 'fill' ? 'p-0' : 'p-3 sm:p-6'
                            }`
                          : 'relative w-full h-full flex items-center justify-center overflow-hidden'
                      }
                    >
                      {!isCinemaMode && (
                        <>
                          <span
                            className={`absolute top-2.5 left-2.5 z-20 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide pointer-events-none border ${
                              activeQualityOption.isUltraHd
                                ? 'bg-amber-500/90 border-amber-300 text-black shadow-lg'
                                : 'bg-black/80 border-cyan-400/50 text-cyan-300'
                            }`}
                          >
                            {previewItem.directVideoUrl
                              ? 'FULL HD MP4'
                              : `${activeQualityOption.shortBadge} · ${
                                  playerScaleMode === 'fill' ? 'FILL' : '16:9 FIT'
                                }`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void enterFullscreenAndLandscape('fit');
                            }}
                            className="absolute top-2.5 right-2.5 z-20 p-2 rounded-xl bg-black/80 hover:bg-cyan-600/80 text-white border border-cyan-400/50 shadow-lg transition-all active:scale-95 cursor-pointer"
                            title="Enter Full Screen & Lock Landscape"
                            aria-label="Enter Full Screen Landscape"
                          >
                            <Maximize2 className="w-4 h-4 text-cyan-300" />
                          </button>
                        </>
                      )}

                      {/* Floating Cinema / Fullscreen Controls Header */}
                      {isCinemaMode && (
                        <div
                          className={`z-30 flex items-center justify-between gap-2 transition-all ${
                            playerScaleMode === 'fill' || cssLandscapeActive
                              ? 'absolute top-2.5 left-3 right-3 px-3 py-1.5 rounded-2xl bg-black/80 border border-white/15'
                              : 'w-[min(95vw,calc(80vh*16/9))] max-w-6xl mb-3 px-1'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 border ${
                                activeQualityOption.isUltraHd
                                  ? 'bg-amber-500 text-black border-amber-300'
                                  : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                              }`}
                            >
                              {activeQualityOption.shortBadge}
                              {cssLandscapeActive ? ' · LANDSCAPE' : ''}
                            </span>
                            <div className="min-w-0">
                              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                                {previewItem.title}
                              </h2>
                              <p className="text-[11px] text-neutral-400 truncate hidden sm:block">
                                {previewItem.subtitle}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 relative">
                            {previewItem.youtubeId && (
                              <>
                                <button
                                  type="button"
                                  onClick={handleFastServerReload}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  title="Fast Server / Reload"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Fast Server</span>
                                </button>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setIsQualityMenuOpen((o) => !o)}
                                    className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-neutral-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    title="Select Video Resolution"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{activeQualityOption.label}</span>
                                  </button>
                                  {isQualityMenuOpen && (
                                    <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl p-1.5 z-50">
                                      {YOUTUBE_QUALITY_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => {
                                            hasManualQualityRef.current = true;
                                            setSelectedQuality(opt.id);
                                            setIsQualityMenuOpen(false);
                                            onShowToast(`Resolution set to ${opt.label}`);
                                          }}
                                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer ${
                                            selectedQuality === opt.id
                                              ? 'bg-pink-600/25 text-white border border-pink-500/40'
                                              : 'text-neutral-300 hover:bg-neutral-800'
                                          }`}
                                        >
                                          <span>{opt.label}</span>
                                          {opt.isUltraHd && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">
                                              4K
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPlayerScaleMode((prev) => (prev === 'fill' ? 'fit' : 'fill'))
                              }
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                                playerScaleMode === 'fill'
                                  ? 'bg-pink-600 text-white border-pink-400'
                                  : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-neutral-700'
                              }`}
                            >
                              <RectangleHorizontal className="w-3.5 h-3.5" />
                              <span className="hidden xs:inline">
                                {playerScaleMode === 'fill' ? 'Fill' : '16:9'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void exitFullscreenAndRestorePortrait()}
                              className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border border-neutral-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              title="Exit Fullscreen"
                            >
                              <Minimize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void exitFullscreenAndRestorePortrait();
                                setIsQualityMenuOpen(false);
                                setPreviewItem(null);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inner Media Box */}
                      <div
                        className={
                          isCinemaMode
                            ? cssLandscapeActive
                              ? playerScaleMode === 'fill'
                                ? 'relative w-full h-full overflow-hidden bg-black'
                                : 'relative h-full aspect-video max-w-full mx-auto overflow-hidden bg-black'
                              : playerScaleMode === 'fill'
                              ? 'relative w-screen h-[100dvh] overflow-hidden bg-black'
                              : 'relative w-[min(95vw,calc(80vh*16/9))] max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl'
                            : 'relative w-full h-full overflow-hidden bg-black'
                        }
                      >
                        {!isOnline &&
                        (previewItem.youtubeId || previewItem.directVideoUrl || previewItem.embedUrl) ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-neutral-950/95 space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                              <WifiOff className="w-6 h-6" />
                            </div>
                            <div className="space-y-1 max-w-md">
                              <h3 className="text-sm sm:text-base font-black text-white">
                                You&apos;re in Offline Mode
                              </h3>
                              <p className="text-xs text-neutral-300 leading-relaxed">
                                Online streaming needs an internet connection. Your saved reels, songs, and naats are ready in <strong>Saved / Downloads</strong>!
                              </p>
                            </div>
                            {onOpenSavedOffline && (
                              <button
                                type="button"
                                onClick={() => {
                                  void exitFullscreenAndRestorePortrait();
                                  onOpenSavedOffline();
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg"
                              >
                                <HardDrive className="w-3.5 h-3.5" />
                                <span>Open Saved / Downloads</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : playerError ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center p-5 text-center bg-neutral-950 space-y-3">
                            {previewItem.thumbnailUrl && (
                              <img
                                src={previewItem.thumbnailUrl}
                                alt={previewItem.title}
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
                              />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-2.5 max-w-md">
                              <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/45 text-red-400 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <h3 className="text-sm sm:text-base font-black text-white line-clamp-1">
                                {previewItem.title}
                              </h3>
                              <p className="text-xs text-neutral-300 leading-relaxed">{playerError}</p>
                              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleFastServerReload}
                                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  <span>Fast Server / Reload</span>
                                </button>
                                <a
                                  href={
                                    previewItem.youtubeId
                                      ? `https://www.youtube.com/watch?v=${previewItem.youtubeId}`
                                      : previewItem.directVideoUrl || previewItem.embedUrl || '#'
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-red-600/35"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open Source</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : previewItem.directVideoUrl ? (
                          <video
                            ref={directVideoRef}
                            key={`${previewItem.directVideoUrl}-${watchPlaybackTrigger}`}
                            controls
                            autoPlay
                            playsInline
                            poster={previewItem.thumbnailUrl || undefined}
                            onError={() => {
                              if (previewItem.youtubeId) {
                                setPlayerError(null);
                              } else {
                                setPlayerError(
                                  'This direct video URL could not play in-app. Tap Open Source to stream.'
                                );
                              }
                            }}
                            className={`w-full h-full bg-black ${
                              playerScaleMode === 'fill' ? 'object-cover' : 'object-contain'
                            }`}
                          />
                        ) : previewItem.embedUrl ? (
                          <iframe
                            key={previewItem.embedUrl}
                            src={sanitizeSafeUrl(previewItem.embedUrl, {
                              allowBlob: false,
                              allowDataImageAudio: false,
                            })}
                            title={previewItem.title}
                            onError={() =>
                              setPlayerError('Remote embed blocked playback inside frame.')
                            }
                            className="w-full h-full border-0 bg-black"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                          />
                        ) : previewItem.youtubeId ? (
                          <LiteYouTubePlayer
                            youtubeId={previewItem.youtubeId}
                            title={previewItem.title}
                            thumbnailUrl={previewItem.thumbnailUrl}
                            autoActivate={true}
                            isCinemaMode={isCinemaMode}
                            playerScaleMode={playerScaleMode}
                            cssLandscapeActive={cssLandscapeActive}
                            selectedQuality={selectedQuality}
                            serverIndex={serverIndex}
                            reloadNonce={reloadNonce}
                            onPlayerError={(msg) => setPlayerError(msg)}
                          />
                        ) : (
                          <div className="w-full h-full relative flex flex-col items-center justify-center p-4 text-center">
                            {previewItem.thumbnailUrl && (
                              <img
                                src={previewItem.thumbnailUrl}
                                alt={previewItem.title}
                                loading="lazy"
                                decoding="async"
                                className={`absolute inset-0 w-full h-full opacity-55 ${
                                  playerScaleMode === 'fill' ? 'object-cover' : 'object-contain'
                                }`}
                              />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-2">
                              <Film className="w-10 h-10 text-cyan-400" />
                              <p className="text-sm text-white font-bold">{previewItem.title}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer: Description + Working Watch, Save to Watchlist & Download CTAs */}
                  {!isCinemaMode && (
                    <div className="p-3.5 sm:p-5 bg-neutral-950 border-t border-neutral-800 space-y-3 overflow-y-auto">
                      {previewItem.description && (
                        <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                          {previewItem.description}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 1. WATCH CTA */}
                        <button
                          type="button"
                          onClick={() => handleWatchAction(previewItem)}
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:brightness-110 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Watch Full HD</span>
                        </button>

                        {/* 2. SAVE TO WATCHLIST CTA */}
                        <button
                          type="button"
                          onClick={() => handleToggleWatchlist(previewItem)}
                          className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 border active:scale-[0.98] transition-all cursor-pointer ${
                            offlineWatchlist.some((w) => w.id === previewItem.id)
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              offlineWatchlist.some((w) => w.id === previewItem.id)
                                ? 'fill-amber-400 text-amber-400'
                                : ''
                            }`}
                          />
                          <span>
                            {offlineWatchlist.some((w) => w.id === previewItem.id)
                              ? 'Saved to Watchlist'
                              : 'Save to Watchlist'}
                          </span>
                        </button>

                        {/* 3. DOWNLOAD CTA */}
                        <button
                          type="button"
                          disabled={resolvingDownloadId === previewItem.id}
                          onClick={() => void handleMovixDownloadItem(previewItem)}
                          className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 border active:scale-[0.98] transition-all cursor-pointer ${
                            downloadStates[previewItem.id]?.isCompleted
                              ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-300'
                              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 border-cyan-400/50 text-white shadow-lg shadow-cyan-600/25'
                          }`}
                        >
                          {resolvingDownloadId === previewItem.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Preparing...</span>
                            </>
                          ) : downloadStates[previewItem.id]?.isCompleted ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>Downloaded</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Hub Controls & Video Cards Area */}
            <div className="p-4 sm:p-6 space-y-4">
            {/* Friendly Offline Notice inside Movie Box when internet is disconnected */}
            {!isOnline && (
              <div className="max-w-6xl mx-auto p-3.5 rounded-2xl bg-amber-950/35 border border-amber-500/45 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-300">
                      Offline Mode — Online YouTube Streaming Unavailable
                    </p>
                    <p className="text-[11px] text-neutral-300">
                      Reconnect to stream YouTube movies, or watch your locally saved reels, songs &amp; naats in Profile.
                    </p>
                  </div>
                </div>
                {onOpenSavedOffline && (
                  <button
                    type="button"
                    onClick={onOpenSavedOffline}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Open Saved / Downloads</span>
                  </button>
                )}
              </div>
            )}
            {/* Top Search & Filter Bar */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Input with Search CTA Button in Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchYouTubeLive();
                }}
                className="flex-1 flex flex-col sm:flex-row items-stretch gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(sanitizeSearchQuery(e.target.value, 400))}
                    placeholder="Search worldwide movies, dramas, songs, clips, Quran in ANY language..."
                    className="w-full bg-neutral-900/90 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-9 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchSource('catalog');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Universal MOVIX Search CTA */}
                <button
                  type="submit"
                  disabled={isSearchingYouTube}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-500 hover:brightness-110 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/30 active:scale-95 transition-all shrink-0 border border-pink-400/30 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>{isSearchingYouTube ? 'Searching...' : 'Search MOVIX'}</span>
                </button>
              </form>

              {/* Sort Dropdown (Catalog view) */}
              {searchSource !== 'youtube' && (
                <div className="flex items-center gap-2 shrink-0">
                  <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs text-neutral-400 font-semibold hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-neutral-900 text-xs text-white border border-neutral-800 rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-cyan-500 transition-colors"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="rating">Highest Rated</option>
                    <option value="size_desc">Largest File Size</option>
                    <option value="size_asc">Smallest File Size</option>
                  </select>
                </div>
              )}
            </div>

            {/* Universal Link Bar: Paste YouTube, Shorts, Live, .mp4, .m3u8, or Public Embed URL */}
            <div className="max-w-6xl mx-auto p-2.5 sm:p-3 rounded-2xl bg-neutral-900/75 border border-cyan-500/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-cyan-300 shrink-0">
                <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-bold text-[11px] sm:text-xs">
                  Paste Any Link (YouTube, Shorts, .mp4, .m3u8, Embed):
                </span>
              </div>
              <div className="flex items-center gap-2 flex-1 sm:max-w-lg">
                <input
                  type="text"
                  value={directUrlInput}
                  onChange={(e) => setDirectUrlInput(sanitizeInputLive(e.target.value, 500))}
                  onKeyDown={(e) => e.key === 'Enter' && handlePlayDirectUrl()}
                  placeholder="youtube.com/..., youtu.be/..., .../video.mp4, .../live.m3u8"
                  className="w-full bg-black/70 text-xs text-white placeholder-neutral-500 px-3 py-2 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => handlePlayDirectUrl()}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black rounded-xl shrink-0 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  Play 16:9
                </button>
              </div>
            </div>

            {/* Worldwide Language Filter Strip */}
            <div className="max-w-6xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Languages className="w-3.5 h-3.5" />
                Language:
              </span>
              {MOVIX_LANGUAGES.map((lang) => {
                const isLangActive = selectedLanguage === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(lang.id);
                      if (searchQuery.trim()) {
                        void handleSearchYouTubeLive(
                          searchQuery.trim(),
                          undefined,
                          undefined,
                          1,
                          null,
                          lang.id
                        );
                      } else if (lang.id !== 'all') {
                        void handleSearchYouTubeLive(
                          `${lang.searchSuffix} movies dramas songs`,
                          undefined,
                          lang.label,
                          1,
                          null,
                          lang.id
                        );
                      }
                    }}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                      isLangActive
                        ? 'bg-amber-500 text-black border-amber-300 shadow-sm'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>

            {/* Global Content Hub Dedicated Category Tabs */}
            <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                MOVIX Hub:
              </span>
              {GLOBAL_HUB_TABS.map((tab) => {
                const isTabActive = activeGlobalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectGlobalTab(tab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                      isTabActive
                        ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white border-cyan-400 shadow-md shadow-pink-600/20'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-pink-500/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Quick Movie Box YouTube Search Category Chips */}
            <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
                Quick Search:
              </span>
              {QUICK_MOVIEBOX_CHIPS.map((chip) => {
                const isChipActive =
                  searchSource === 'youtube' &&
                  searchQuery.trim().toLowerCase() === chip.toLowerCase();
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSearchYouTubeLive(chip)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                      isChipActive
                        ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white border-red-400 shadow-md shadow-red-600/25'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800 hover:border-pink-500/40'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {/* Inline Status Header: Directly Above the Grid */}
            {searchSource === 'youtube' && youtubeLiveResults.length > 0 && (
              <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-red-950/25 border border-red-500/35 text-xs">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="text-white font-bold">
                    Showing {youtubeLiveResults.length} family-safe MOVIX videos
                    {searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSearchSource('youtube')}
                    className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-pink-600 text-white cursor-pointer"
                  >
                    Live Results ({youtubeLiveResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchSource('catalog');
                      setActiveGlobalTab('all');
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="px-2.5 py-1 rounded-lg font-bold text-[11px] text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 cursor-pointer"
                  >
                    MOVIX Home Rows
                  </button>
                </div>
              </div>
            )}

            {/* INSTANT PRE-LOADED WORLDWIDE ROWS (No Empty Screen on MOVIX Open!) */}
            {searchSource !== 'youtube' &&
              activeGlobalTab === 'all' &&
              selectedCategory === 'all' &&
              !searchQuery.trim() && (
                <div className="max-w-6xl mx-auto space-y-6 pb-2">
                  {MOVIX_INSTANT_ROWS.map((row) => (
                    <section key={row.id} className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                              {row.title}
                            </h2>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-gradient-to-r ${row.accentGradient} text-white`}
                            >
                              {row.badgeText}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {row.subtitle}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void handleSearchYouTubeLive(row.liveSearchQuery, undefined, row.title)
                          }
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>Search More</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {row.items.map((item) => {
                          const isSaved = offlineWatchlist.some((w) => w.id === item.id);
                          const durationText =
                            item.durationSeconds !== undefined
                              ? formatVideoDuration(item.durationSeconds)
                              : item.durationOrVersion;

                          return (
                            <div
                              key={item.id}
                              onClick={() => openVideoPlayer(item)}
                              className="group turbo-card cv-auto-card bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 hover:border-pink-500/60 rounded-2xl p-3 flex flex-col justify-between gap-2.5 cursor-pointer transition-all [transform:translateZ(0)] [will-change:transform]"
                            >
                              <div>
                                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800">
                                  {item.youtubeId ? (
                                    <LiteYouTubeThumb
                                      videoId={item.youtubeId}
                                      alt={item.title}
                                      fallbackUrl={item.thumbnailUrl}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <img
                                      src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                                      alt={item.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full bg-pink-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                      <Play className="w-4 h-4 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                  {item.languageLabel && (
                                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 border border-white/15 text-[9px] font-black text-amber-300">
                                      {item.languageLabel}
                                    </span>
                                  )}
                                  {item.contentTypeTag && (
                                    <span
                                      className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${getContentTagBadgeClasses(
                                        item.contentTypeTag
                                      )}`}
                                    >
                                      {item.contentTypeTag}
                                    </span>
                                  )}
                                  <span
                                    className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums border ${
                                      durationText === 'LIVE'
                                        ? 'bg-red-600 text-white border-red-300/60'
                                        : 'bg-black/90 text-white border-white/15'
                                    }`}
                                  >
                                    {durationText}
                                  </span>
                                </div>

                                <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 mt-2 group-hover:text-pink-400 transition-colors">
                                  {item.title}
                                </h3>
                                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/80">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openVideoPlayer(item);
                                  }}
                                  className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>Watch</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleWatchlist(item);
                                  }}
                                  className={`p-1.5 rounded-lg border cursor-pointer ${
                                    isSaved
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                                  }`}
                                  title={isSaved ? 'Saved in Watchlist' : 'Save to Watchlist'}
                                >
                                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-400' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMovixDownloadItem(item);
                                  }}
                                  className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 cursor-pointer"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

            {/* Catalog Category Pills (only when viewing Catalog mode) */}
            {searchSource !== 'youtube' && (
              <div className="max-w-6xl mx-auto overflow-x-auto no-scrollbar pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  {youtubeLiveResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchSource('youtube')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 cursor-pointer"
                    >
                      <Youtube className="w-3.5 h-3.5 fill-red-400" />
                      <span>YouTube Results ({youtubeLiveResults.length})</span>
                    </button>
                  )}
                  {DOWNLOAD_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const count =
                      cat.id === 'all'
                        ? items.length
                        : cat.id === 'tilawat'
                        ? items.filter((it) => it.category === 'tilawat' || it.category === 'quran').length
                        : items.filter((it) => it.category === cat.id).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-white border-pink-400/60 shadow-lg shadow-pink-600/30 scale-102'
                            : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-800'
                        }`}
                      >
                        {renderCategoryIcon(cat.id, 'w-3.5 h-3.5')}
                        <span>{cat.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected
                              ? 'bg-black/40 text-white'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Marketplace / Fetched Videos Grid (Directly below "Showing X playable videos") */}
            <div className="max-w-6xl mx-auto">
              {isSearchingYouTube ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-3 animate-pulse"
                    >
                      <div className="w-full aspect-video rounded-xl bg-neutral-800/80" />
                      <div className="space-y-2">
                        <div className="h-4 w-4/5 rounded-md bg-neutral-800" />
                        <div className="h-3 w-1/2 rounded-md bg-neutral-800/70" />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-neutral-800/80">
                        <div className="h-8 w-16 rounded-xl bg-neutral-800" />
                        <div className="h-8 flex-1 rounded-xl bg-neutral-800/80" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="py-16 text-center text-neutral-400 space-y-3">
                  <Search className="w-10 h-10 mx-auto text-neutral-600" />
                  <p className="text-sm font-bold text-neutral-300">
                    {searchSource === 'youtube'
                      ? 'No live YouTube results found for your query'
                      : 'No items matched your query'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSearchSource('catalog');
                      setYoutubeLiveResults([]);
                      try {
                        sessionStorage.removeItem('jatt_yt_search_results');
                        sessionStorage.setItem('jatt_yt_search_query', '');
                        sessionStorage.setItem('jatt_yt_search_source', 'catalog');
                        sessionStorage.setItem('jatt_hub_selected_category', 'all');
                      } catch {
                        // ignore
                      }
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-pink-400 rounded-xl transition-colors cursor-pointer"
                  >
                    Reset to Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [transform:translateZ(0)]">
                  {displayedItems.map((item) => {
                    const state = downloadStates[item.id] || {
                      progress: 0,
                      isDownloading: false,
                      isPaused: false,
                      isCompleted: false,
                      speed: '',
                      downloadedBytes: 0,
                    };
                    const isCurrentlyPlaying = previewItem?.id === item.id;
                    const isYouTubeCard =
                      Boolean(item.youtubeId) && (searchSource === 'youtube' || item.id.startsWith('yt-'));
                    const styleTag: ContentStyleTag | null =
                      item.category === 'apps'
                        ? null
                        : item.contentTypeTag ||
                          classifyVideoContentType({
                            title: item.title,
                            subtitle: item.subtitle,
                            description: item.description,
                            tags: item.tags,
                            category: item.category,
                            durationSeconds: item.durationSeconds,
                          });
                    const formattedDuration =
                      item.durationSeconds !== undefined
                        ? formatVideoDuration(item.durationSeconds)
                        : item.durationOrVersion;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.youtubeId || item.directVideoUrl || item.embedUrl) {
                            openVideoPlayer(item);
                            onShowToast(`Playing "${item.title}"`);
                          }
                        }}
                        className={`group turbo-card cv-auto-card bg-neutral-900/90 hover:bg-neutral-900 border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between [transform:translateZ(0)] [will-change:transform] relative overflow-hidden ${
                          isCurrentlyPlaying
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : item.youtubeId || item.directVideoUrl || item.embedUrl
                            ? 'border-neutral-800 hover:border-pink-500/60 cursor-pointer'
                            : 'border-neutral-800 hover:border-pink-500/50'
                        }`}
                      >
                        {/* Top Media Info Row: Prominent 16:9 Widescreen Clickable Thumbnail for YouTube results */}
                        <div>
                          {isYouTubeCard ? (
                            <div className="space-y-2.5">
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800 group-hover:border-red-500/60 transition-colors">
                                {item.youtubeId ? (
                                  <LiteYouTubeThumb
                                    videoId={item.youtubeId}
                                    alt={item.title}
                                    fallbackUrl={item.thumbnailUrl}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <img
                                    src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-12 h-12 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="w-5 h-5 fill-white ml-0.5" />
                                  </div>
                                </div>

                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-red-600/90 text-[10px] font-black text-white uppercase flex items-center gap-1">
                                  <Youtube className="w-3 h-3 fill-white" />
                                  <span>{isCurrentlyPlaying ? 'Playing' : 'Lite HD'}</span>
                                </span>

                                {/* Bottom-Left: Bold Color-Coded Category & Style Tag */}
                                {styleTag && (
                                  <span
                                    className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide shadow-md ${getContentTagBadgeClasses(
                                      styleTag
                                    )}`}
                                  >
                                    {styleTag}
                                  </span>
                                )}

                                {/* Bottom-Right: Exact Duration Pill Badge */}
                                <span
                                  className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black tabular-nums shadow-md border ${
                                    formattedDuration === 'LIVE'
                                      ? 'bg-red-600/95 text-white border-red-300/60'
                                      : 'bg-black/90 text-white border-white/15'
                                  }`}
                                >
                                  {formattedDuration}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-pink-400 transition-colors">
                                  {item.title}
                                </h3>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>
                          ) : (
                          <>
                            <div className="flex gap-3.5">
                              {/* Thumbnail with quality badge & Hover Play Overlay */}
                              <div className="relative w-24 h-24 sm:w-28 sm:h-24 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/80 shadow-md group-hover:scale-102 transition-transform">
                                {item.youtubeId ? (
                                  <LiteYouTubeThumb
                                    videoId={item.youtubeId}
                                    alt={item.title}
                                    fallbackUrl={item.thumbnailUrl}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                                {/* Category Icon Badge */}
                                <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/75 text-pink-400 text-[10px]">
                                  {renderCategoryIcon(item.category, 'w-3 h-3')}
                                </span>

                                {/* Hover Play Indicator for YouTube streams */}
                                {item.youtubeId && (
                                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10 pointer-events-none">
                                    <div className="w-9 h-9 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg shadow-red-600/60 scale-90 group-hover:scale-100 transition-transform">
                                      <Play className="w-4 h-4 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                )}

                                {/* Bottom-Right: Clean Dark Duration Pill Badge */}
                                <span
                                  className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums border shadow-md ${
                                    formattedDuration === 'LIVE'
                                      ? 'bg-red-600/95 text-white border-red-300/60'
                                      : 'bg-black/90 text-white border-white/15'
                                  }`}
                                >
                                  {formattedDuration}
                                </span>
                              </div>

                              {/* Item Details */}
                              <div className="flex-1 min-w-0">
                                {/* Content Type & Quality Badge Row */}
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  {styleTag && (
                                    <span
                                      className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md border ${getContentTagBadgeClasses(
                                        styleTag
                                      )}`}
                                    >
                                      {styleTag}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                                    {item.qualityBadge}
                                  </span>
                                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                                    {item.rating}
                                  </span>
                                  {item.youtubeId && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-0.5">
                                      <Youtube className="w-2.5 h-2.5 fill-red-400" />
                                      <span>Play</span>
                                    </span>
                                  )}
                                </div>

                                <h3 className="text-sm font-bold text-white truncate group-hover:text-pink-400 transition-colors">
                                  {item.title}
                                </h3>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>

                                {/* File Size & Downloads Counter Layout */}
                                <div className="flex items-center gap-2 mt-2 text-xs">
                                  <span className="px-2 py-0.5 rounded-md bg-neutral-800/80 font-black text-white tabular-nums border border-neutral-700/60">
                                    📦 {item.fileSize}
                                  </span>
                                  <span className="text-[11px] text-neutral-400 font-semibold">
                                    {item.downloadsCount} DLs
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Description & Tags */}
                            {item.description && (
                              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-3 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </>
                        )}

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-800/50 text-neutral-400 border border-neutral-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* ========================================================= */}
                      {/* PROMINENT GLOW-STYLED "DOWNLOAD NOW" PROGRESS BUTTON      */}
                      {/* ========================================================= */}
                      <div className="mt-4 pt-3 border-t border-neutral-800/80">
                        {state.isCompleted ? (
                          /* COMPLETED STATE */
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                Downloaded & Ready
                              </span>
                              <span className="text-neutral-400 text-[10px] tabular-nums">
                                {item.fileSize}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVideoPlayer(item);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-98 transition-all border border-emerald-400/40 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Open / Play File</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartDownload(item);
                                }}
                                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs transition-colors cursor-pointer"
                                title="Re-download"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : state.isDownloading ? (
                          /* IN-PROGRESS DOWNLOADING STATE */
                          <div className="space-y-2">
                            {/* Live Stats Header */}
                            <div className="flex items-center justify-between text-xs font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                <span className="text-cyan-400 font-bold">
                                  {state.isPaused ? 'Paused' : `Downloading (${state.progress}%)`}
                                </span>
                              </div>
                              <span className="text-neutral-300 text-[11px] tabular-nums">
                                {state.speed}
                              </span>
                            </div>

                            {/* Heavy Glow Progress Bar */}
                            <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden p-0.5 border border-cyan-500/30 shadow-inner">
                              <div
                                style={{ width: `${state.progress}%` }}
                                className="h-full bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-500 rounded-full transition-all duration-300 shadow-md shadow-cyan-500/50"
                              />
                            </div>

                            {/* Control Actions (Pause/Resume, Cancel) */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-neutral-400 tabular-nums">
                                {(state.downloadedBytes / (1024 * 1024)).toFixed(1)} MB of {item.fileSize}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {state.isPaused ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResumeDownload(item);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Resume</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePauseDownload(item);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pause className="w-3 h-3" />
                                    <span>Pause</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveDownload(item.id, item.title);
                                  }}
                                  className="p-1 text-neutral-500 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                                  title="Cancel download"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* DEFAULT IDLE STATE: WATCH / WATCHLIST / DOWNLOAD */
                          item.youtubeId || item.directVideoUrl || item.embedUrl ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVideoPlayer(item);
                                }}
                                className="py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all shrink-0 cursor-pointer"
                                title="Watch in MOVIX Full HD Player"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Watch</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWatchlist(item);
                                }}
                                className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-98 cursor-pointer min-w-0 ${
                                  offlineWatchlist.some((w) => w.id === item.id)
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                                }`}
                                title="Save to Watchlist"
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    offlineWatchlist.some((w) => w.id === item.id)
                                      ? 'fill-amber-400 text-amber-400'
                                      : ''
                                  }`}
                                />
                                <span className="truncate">
                                  {offlineWatchlist.some((w) => w.id === item.id) ? 'Saved' : 'Watchlist'}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={resolvingDownloadId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMovixDownloadItem(item);
                                }}
                                className="py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                                title="Download MP4 / Save Offline"
                              >
                                {resolvingDownloadId === item.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">Download</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartDownload(item);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/40 group/btn min-w-0 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-white shrink-0 group-hover/btn:translate-y-0.5 transition-transform" />
                                <span className="tracking-wide truncate">Download</span>
                                <span className="text-[10px] font-bold text-neutral-200/80 bg-black/30 px-1 py-0.2 rounded-md shrink-0">
                                  {item.fileSize}
                                </span>
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

              {/* Paginated Navigation (12 items/page keeps RAM low on 3GB Android phones) */}
              {!isSearchingYouTube && displayedItems.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800">
                  {searchSource === 'youtube' ? (
                    <>
                      <button
                        type="button"
                        disabled={ytPage <= 1}
                        onClick={() => handleLoadYouTubePage('prev')}
                        className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Prev</span>
                      </button>
                      <span className="text-xs font-black text-neutral-300 tabular-nums">
                        Page {ytPage} · 12 / page ({isRamSaverMode ? '3GB RAM Lite' : 'MOVIX HD'})
                      </span>
                      <button
                        type="button"
                        disabled={!ytNextPageToken && displayedItems.length < HUB_PAGE_SIZE}
                        onClick={() => handleLoadYouTubePage('next')}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-xs font-black text-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={safeCatalogPage <= 1}
                        onClick={() => {
                          setCatalogPage((p) => Math.max(1, p - 1));
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Prev</span>
                      </button>
                      <span className="text-xs font-black text-neutral-300 tabular-nums">
                        Page {safeCatalogPage} of {totalCatalogPages} · 12 / page
                      </span>
                      <button
                        type="button"
                        disabled={safeCatalogPage >= totalCatalogPages}
                        onClick={() => {
                          setCatalogPage((p) => Math.min(totalCatalogPages, p + 1));
                          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-xs font-black text-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* "MY DOWNLOADS" SESSION MANAGER VIEW                                       */
        /* ========================================================================= */
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-5">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Storage Header Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Offline Watchlist & Local Downloads</h2>
                  <p className="text-xs text-neutral-400">
                    {offlineWatchlist.length} watchlist video(s) · {completedDownloads.length} downloaded file(s) ({totalDownloadedSizeStr})
                  </p>
                </div>
              </div>

              {(completedDownloads.length > 0 || offlineWatchlist.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setDownloadStates({});
                    setOfflineWatchlist([]);
                    try {
                      localStorage.removeItem(OFFLINE_WATCHLIST_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                    onShowToast('Cleared all saved watchlist items & local downloads');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Saved YouTube Offline Watchlist Section */}
            {offlineWatchlist.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Offline Watchlist ({offlineWatchlist.length})</span>
                </h3>
                {offlineWatchlist.map((item) => (
                  <div
                    key={`wl-${item.id}`}
                    className="turbo-card p-3.5 rounded-2xl bg-neutral-900/90 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md [transform:translateZ(0)] [will-change:transform]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-11 rounded-xl object-cover border border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openVideoPlayer(item)}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play</span>
                      </button>
                      {item.youtubeId && (
                        <a
                          href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700"
                          title="Open External Watch / Download Helper"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleWatchlist(item)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedDownloads.length === 0 && offlineWatchlist.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 rounded-2xl border border-dashed border-neutral-800 space-y-3">
                <Download className="w-10 h-10 mx-auto text-neutral-600" />
                <h3 className="text-sm font-bold text-neutral-300">No saved videos or downloads yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Browse the Global Content Hub to save Hollywood movies, English dubbed films, dramas, or trending songs to your watchlist.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('marketplace')}
                  className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Explore Global Hub
                </button>
              </div>
            ) : completedDownloads.length > 0 ? (
              <div className="space-y-2.5">
                {completedDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3 shadow-md hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={optimizeThumbnailUrl(item.thumbnailUrl, 'grid')}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 rounded-xl object-cover border border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                            {item.categoryLabel}
                          </span>
                          <span className="text-[10px] text-neutral-500">·</span>
                          <span className="text-[10px] text-neutral-400">{item.fileSize}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openVideoPlayer(item)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDownload(item.id, item.title)}
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADMIN-ONLY "MOVIX SETTINGS" MODAL (TMDB + YouTube Data API v3 Keys)   */}
      {/* ===================================================================== */}
      {isMovixSettingsOpen && isAdmin && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setIsMovixSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-neutral-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">MOVIX Settings</h3>
                  <p className="text-[11px] text-neutral-400">
                    Admin API Config · Keyless Mode Always Active
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMovixSettingsOpen(false)}
                className="p-1.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-200 leading-relaxed">
                <strong>Keyless Search &amp; Family-Safe Filter Active:</strong> Apple iTunes Cinema, Internet Archive Open Cinema, and curated worldwide feeds work 100% out-of-the-box with zero adult/18+ content.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Free TMDB API Key (<code className="text-amber-300">VITE_TMDB_API_KEY</code>)
                </label>
                <div className="relative">
                  <input
                    type={showApiKeys ? 'text' : 'password'}
                    value={tmdbKeyInput}
                    onChange={(e) => setTmdbKeyInput(sanitizeInputLive(e.target.value, 160))}
                    placeholder="Paste optional free TMDB v3 API key..."
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-amber-400 rounded-xl px-3 py-2.5 pr-9 text-xs text-white focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeys((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  YouTube Data API v3 Key (<code className="text-cyan-300">VITE_YOUTUBE_API_KEY</code>)
                </label>
                <input
                  type={showApiKeys ? 'text' : 'password'}
                  value={youtubeKeyInput}
                  onChange={(e) => setYoutubeKeyInput(sanitizeInputLive(e.target.value, 160))}
                  placeholder="Paste optional YouTube Data API v3 key..."
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-cyan-400 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  saveMovixApiKeys('', '');
                  setTmdbKeyInput('');
                  setYoutubeKeyInput('');
                  onShowToast('Cleared custom MOVIX keys (using Keyless & env defaults)');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  saveMovixApiKeys(tmdbKeyInput, youtubeKeyInput);
                  try {
                    sessionStorage.removeItem('jatt_yt_tab_cache');
                  } catch {
                    // ignore
                  }
                  setIsMovixSettingsOpen(false);
                  onShowToast('Saved MOVIX API settings!');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 text-white text-xs font-black cursor-pointer shadow-lg"
              >
                Save MOVIX Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DownloadHub = React.memo(DownloadHubComponent);

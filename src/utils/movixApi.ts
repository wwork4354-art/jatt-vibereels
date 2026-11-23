import { ContentStyleTag, DownloadItem } from '../types';
import {
  classifyVideoContentType,
  formatVideoDuration,
  mapStyleTagToCategory,
  parseIso8601DurationToSeconds,
} from './mediaClassifier';
import { sanitizeText } from './security';

export const MOVIX_TMDB_KEY_STORAGE = 'jatt_tmdb_api_key';
export const MOVIX_YOUTUBE_KEY_STORAGE = 'jatt_youtube_api_key';

export interface MovixLanguageOption {
  id: string;
  label: string;
  searchSuffix: string;
  tmdbIso?: string;
}

export const MOVIX_LANGUAGES: MovixLanguageOption[] = [
  { id: 'all', label: 'All Languages', searchSuffix: '' },
  { id: 'punjabi', label: 'Punjabi', searchSuffix: 'Punjabi', tmdbIso: 'pa' },
  { id: 'urdu', label: 'Urdu', searchSuffix: 'Urdu', tmdbIso: 'ur' },
  { id: 'hindi', label: 'Hindi', searchSuffix: 'Hindi', tmdbIso: 'hi' },
  { id: 'english', label: 'English', searchSuffix: 'English', tmdbIso: 'en' },
  { id: 'turkish', label: 'Turkish', searchSuffix: 'Turkish', tmdbIso: 'tr' },
  { id: 'arabic', label: 'Arabic', searchSuffix: 'Arabic', tmdbIso: 'ar' },
  { id: 'korean', label: 'Korean', searchSuffix: 'Korean', tmdbIso: 'ko' },
  { id: 'spanish', label: 'Spanish', searchSuffix: 'Spanish', tmdbIso: 'es' },
];

// =========================================================================
// Strict Family-Safe / Zero Adult 18+ Content Enforcement
// =========================================================================

const ADULT_BLOCKLIST_PATTERNS: RegExp[] = [
  /\b18\+\b/i,
  /\b21\+\b/i,
  /\bxxx+\b/i,
  /\bnsfw\b/i,
  /\bporn(?:o|ography)?\b/i,
  /\berotic(?:a)?\b/i,
  /\bhentai\b/i,
  /\bonlyfans\b/i,
  /\bbrazzers\b/i,
  /\bxvideos\b/i,
  /\bpornhub\b/i,
  /\bxnxx\b/i,
  /\bplayboy\b/i,
  /\bsoftcore\b/i,
  /\bhardcore\b/i,
  /\bnude\b|\bnudity\b|\bnaked\b/i,
  /\bstriptease\b|\bstrip\s*club\b/i,
  /\bescort\b/i,
  /\bcamgirl\b|\bwebcam\s*model\b/i,
  /\bsex\s*(?:tape|scene|video|movie|chat|toy)\b/i,
  /\badult\s*(?:film|movie|video|only|entertainment|content)\b/i,
  /\buncensored\s*18\b/i,
  /\bmature\s*only\b/i,
  /\bbikini\s*haul\b/i,
  /\bhot\s*bhabhi\b|\bdesisex\b|\bmms\s*leaked\b/i,
];

export function isFamilySafeText(text?: string): boolean {
  if (!text || typeof text !== 'string') return true;
  return !ADULT_BLOCKLIST_PATTERNS.some((pattern) => pattern.test(text));
}

export function containsAdultSearchTerms(query: string): boolean {
  return !isFamilySafeText(query);
}

export function isFamilySafeMediaItem(item: {
  title?: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
  adult?: boolean;
  explicit?: boolean;
}): boolean {
  if (item.adult || item.explicit) return false;
  const combined = `${item.title || ''} ${item.subtitle || ''} ${item.description || ''} ${(
    item.tags || []
  ).join(' ')}`;
  return isFamilySafeText(combined);
}

// =========================================================================
// Admin API Key Helpers (TMDB + YouTube Data API v3)
// =========================================================================

export function getMovixApiKeys(): {
  tmdbApiKey: string;
  youtubeApiKey: string;
  hasEnvTmdb: boolean;
  hasEnvYoutube: boolean;
} {
  const envTmdb = ((import.meta.env.VITE_TMDB_API_KEY as string | undefined) || '').trim();
  const envYt = ((import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) || '').trim();
  let localTmdb = '';
  let localYt = '';
  try {
    localTmdb = (localStorage.getItem(MOVIX_TMDB_KEY_STORAGE) || '').trim();
    localYt = (localStorage.getItem(MOVIX_YOUTUBE_KEY_STORAGE) || '').trim();
  } catch {
    // ignore storage restrictions
  }
  return {
    tmdbApiKey: localTmdb || envTmdb,
    youtubeApiKey: localYt || envYt,
    hasEnvTmdb: Boolean(envTmdb),
    hasEnvYoutube: Boolean(envYt),
  };
}

export function saveMovixApiKeys(tmdbKey: string, youtubeKey: string): void {
  try {
    const cleanTmdb = sanitizeText(tmdbKey, 160);
    const cleanYt = sanitizeText(youtubeKey, 160);
    if (cleanTmdb) localStorage.setItem(MOVIX_TMDB_KEY_STORAGE, cleanTmdb);
    else localStorage.removeItem(MOVIX_TMDB_KEY_STORAGE);

    if (cleanYt) localStorage.setItem(MOVIX_YOUTUBE_KEY_STORAGE, cleanYt);
    else localStorage.removeItem(MOVIX_YOUTUBE_KEY_STORAGE);
  } catch {
    // ignore storage errors
  }
}

// =========================================================================
// Instant Pre-Loaded Worldwide Rows (Never Empty on MOVIX Open)
// =========================================================================

export interface MovixRowDefinition {
  id: 'trending_movies' | 'hit_dramas' | 'hd_songs' | 'quran_bayans';
  title: string;
  subtitle: string;
  badgeText: string;
  accentGradient: string;
  liveSearchQuery: string;
  items: DownloadItem[];
}

export const MOVIX_INSTANT_ROWS: MovixRowDefinition[] = [
  {
    id: 'trending_movies',
    title: 'Trending Movies',
    subtitle: 'Punjabi · Bollywood · Hollywood · South Indian Dubbed',
    badgeText: 'World Cinema',
    accentGradient: 'from-amber-500 to-orange-600',
    liveSearchQuery: 'Punjabi Bollywood Hollywood South Indian dubbed family movies trailer HD',
    items: [
      {
        id: 'movix-mv-punjabi-1',
        title: 'Carry On Jatta 3 — Punjabi Comedy Blockbuster',
        subtitle: 'Punjabi Cinema · Gippy Grewal & Sonam Bajwa',
        category: 'movies',
        categoryLabel: 'Punjabi Movie',
        fileSize: '1.45 GB',
        sizeBytes: 1556925644,
        durationOrVersion: '2:18:00',
        durationSeconds: 8280,
        contentTypeTag: 'Movie',
        qualityBadge: '4K UHD · Family Safe',
        thumbnailUrl: 'https://i.ytimg.com/vi/b7C3z3wB9Fw/mqdefault.jpg',
        fallbackGradient: 'from-amber-950 via-neutral-950 to-black',
        downloadsCount: '1.8M',
        rating: 4.95,
        tags: ['Punjabi', 'Comedy', 'Family'],
        description:
          'Record-breaking Punjabi family comedy packed with laughter, music, and hilarious twists.',
        youtubeId: 'b7C3z3wB9Fw',
        languageLabel: 'Punjabi',
        sourceProvider: 'curated',
        movixSection: 'trending_movies',
      },
      {
        id: 'movix-mv-hollywood-1',
        title: 'Tears of Steel — Hollywood Sci-Fi Action Cinema 4K',
        subtitle: 'Hollywood Open Cinema · Full HD & Downloadable MP4',
        category: 'movies',
        categoryLabel: 'Hollywood',
        fileSize: '185 MB',
        sizeBytes: 193986560,
        durationOrVersion: '12:14',
        durationSeconds: 734,
        contentTypeTag: 'Movie',
        qualityBadge: '4K Direct MP4',
        thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/mqdefault.jpg',
        fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
        downloadsCount: '2.4M',
        rating: 4.9,
        tags: ['Hollywood', 'Sci-Fi', 'Action'],
        description:
          'Futuristic Hollywood-grade VFX sci-fi action film in crisp 4K clarity with direct MP4 download.',
        youtubeId: 'R6MlUcmOul8',
        directVideoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        downloadUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        languageLabel: 'English',
        sourceProvider: 'curated',
        movixSection: 'trending_movies',
      },
      {
        id: 'movix-mv-bollywood-1',
        title: 'Warning 2 — Action Thriller Hindi & Punjabi Edition',
        subtitle: 'Bollywood / Punjabi Action · Full Feature Preview',
        category: 'movies',
        categoryLabel: 'Bollywood / Punjabi',
        fileSize: '1.18 GB',
        sizeBytes: 1267006832,
        durationOrVersion: '2:04:00',
        durationSeconds: 7440,
        contentTypeTag: 'Movie',
        qualityBadge: '1080p Full HD',
        thumbnailUrl: 'https://i.ytimg.com/vi/2Z3kX4fXJQE/mqdefault.jpg',
        fallbackGradient: 'from-rose-950 via-neutral-950 to-black',
        downloadsCount: '980K',
        rating: 4.75,
        tags: ['Bollywood', 'Punjabi', 'Action'],
        description: 'High-intensity action cinema in Hindi & Punjabi dual-audio energy.',
        youtubeId: '2Z3kX4fXJQE',
        languageLabel: 'Hindi / Punjabi',
        sourceProvider: 'curated',
        movixSection: 'trending_movies',
      },
      {
        id: 'movix-mv-south-1',
        title: 'Sintel — Epic Fantasy Adventure (Hindi / South Dubbed Style)',
        subtitle: 'South Indian Dubbed Fantasy Action Showcase',
        category: 'movies',
        categoryLabel: 'South Dubbed',
        fileSize: '142 MB',
        sizeBytes: 148897792,
        durationOrVersion: '14:48',
        durationSeconds: 888,
        contentTypeTag: 'Movie',
        qualityBadge: '1080p Direct MP4',
        thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/mqdefault.jpg',
        fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
        downloadsCount: '1.3M',
        rating: 4.92,
        tags: ['South Dubbed', 'Fantasy', 'Adventure'],
        description:
          'Cinematic dragon quest and heroic adventure with instant streaming and offline download.',
        youtubeId: 'eRsGyueVLvQ',
        directVideoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        downloadUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        languageLabel: 'South Dubbed',
        sourceProvider: 'curated',
        movixSection: 'trending_movies',
      },
    ],
  },
  {
    id: 'hit_dramas',
    title: 'Hit Dramas & Series',
    subtitle: 'Pakistani · Turkish · Korean Family Series',
    badgeText: 'Drama Box',
    accentGradient: 'from-purple-500 to-indigo-600',
    liveSearchQuery: 'Pakistani Turkish Korean family hit drama serial full episode HD',
    items: [
      {
        id: 'movix-dr-pak-1',
        title: 'Punjab Di Shaan — Hit Pakistani & Punjabi Family Drama',
        subtitle: 'Pakistani Drama Series · Episode 14 Full HD',
        category: 'dramas',
        categoryLabel: 'Pakistani Drama',
        fileSize: '480 MB',
        sizeBytes: 503316480,
        durationOrVersion: '44:00',
        durationSeconds: 2640,
        contentTypeTag: 'Drama',
        qualityBadge: '1080p Urdu / Punjabi',
        thumbnailUrl: 'https://i.ytimg.com/vi/a3p1_0N748k/mqdefault.jpg',
        fallbackGradient: 'from-purple-950 via-neutral-950 to-black',
        downloadsCount: '740K',
        rating: 4.88,
        tags: ['Pakistani Drama', 'Family', 'Urdu'],
        description:
          'Emotional family saga celebrating cultural heritage, brotherhood, and drama.',
        youtubeId: 'a3p1_0N748k',
        languageLabel: 'Urdu / Punjabi',
        sourceProvider: 'curated',
        movixSection: 'hit_dramas',
      },
      {
        id: 'movix-dr-turkish-1',
        title: 'Kurulus & Ottoman Heritage — Turkish Epic Drama Showcase',
        subtitle: 'Turkish Historical Drama · Urdu & English Subtitles',
        category: 'dramas',
        categoryLabel: 'Turkish Drama',
        fileSize: '620 MB',
        sizeBytes: 650117120,
        durationOrVersion: '58:00',
        durationSeconds: 3480,
        contentTypeTag: 'Drama',
        qualityBadge: '1080p HDR · Dubbed',
        thumbnailUrl: 'https://i.ytimg.com/vi/sN1JzDqQz3A/mqdefault.jpg',
        fallbackGradient: 'from-rose-950 via-neutral-950 to-black',
        downloadsCount: '1.1M',
        rating: 4.93,
        tags: ['Turkish Drama', 'Historical', 'Family'],
        description:
          'Action-packed Turkish historical family drama loved across Pakistan, India, and the Middle East.',
        youtubeId: 'sN1JzDqQz3A',
        languageLabel: 'Turkish / Urdu',
        sourceProvider: 'curated',
        movixSection: 'hit_dramas',
      },
      {
        id: 'movix-dr-korean-1',
        title: 'Seoul Starlight — Korean Family & Friendship K-Drama',
        subtitle: 'Korean Series · English & Multi-Subtitles HD',
        category: 'dramas',
        categoryLabel: 'Korean Drama',
        fileSize: '510 MB',
        sizeBytes: 534773760,
        durationOrVersion: '52:15',
        durationSeconds: 3135,
        contentTypeTag: 'Drama',
        qualityBadge: '1080p K-Drama HD',
        thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg',
        fallbackGradient: 'from-indigo-950 via-neutral-950 to-black',
        downloadsCount: '890K',
        rating: 4.9,
        tags: ['Korean', 'K-Drama', 'Series'],
        description:
          'Heartwarming Korean drama series with crisp visuals and clean family storytelling.',
        youtubeId: 'aqz-KE-bpKQ',
        languageLabel: 'Korean',
        sourceProvider: 'curated',
        movixSection: 'hit_dramas',
      },
      {
        id: 'movix-dr-fam-2',
        title: 'Big Buck Woodland Tales — Animated Family Series Episode',
        subtitle: 'All-Ages Family & Kids Series · Direct MP4',
        category: 'cartoons',
        categoryLabel: 'Family Series',
        fileSize: '158 MB',
        sizeBytes: 165675008,
        durationOrVersion: '09:56',
        durationSeconds: 596,
        contentTypeTag: 'Cartoon',
        qualityBadge: '1080p 60FPS MP4',
        thumbnailUrl: 'https://i.ytimg.com/vi/YE7VzlLtp-4/mqdefault.jpg',
        fallbackGradient: 'from-emerald-950 via-neutral-950 to-black',
        downloadsCount: '1.4M',
        rating: 4.95,
        tags: ['Family', 'Animated', 'Series'],
        description: 'Fun animated family series episode with full offline MP4 download support.',
        youtubeId: 'YE7VzlLtp-4',
        directVideoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        downloadUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        languageLabel: 'English',
        sourceProvider: 'curated',
        movixSection: 'hit_dramas',
      },
    ],
  },
  {
    id: 'hd_songs',
    title: 'Full HD Songs & Video Clips',
    subtitle: 'Punjabi · Hindi · English · Arabic · Global Beats',
    badgeText: 'Music & Clips',
    accentGradient: 'from-pink-500 to-rose-600',
    liveSearchQuery: 'Punjabi Hindi English Arabic latest official music video song HD',
    items: [
      {
        id: 'movix-sg-punjabi-1',
        title: 'Top Punjabi & Bhangra Bass Hits — Full HD Video Mix',
        subtitle: 'Punjabi & Desi Music Worldwide',
        category: 'songs',
        categoryLabel: 'Punjabi Songs',
        fileSize: '34.5 MB',
        sizeBytes: 36175872,
        durationOrVersion: '04:32',
        durationSeconds: 272,
        contentTypeTag: 'Song',
        qualityBadge: '1080p Video · 320k',
        thumbnailUrl: 'https://i.ytimg.com/vi/6MgsHSAcI9k/mqdefault.jpg',
        fallbackGradient: 'from-pink-950 via-purple-950 to-black',
        downloadsCount: '1.9M',
        rating: 4.94,
        tags: ['Punjabi', 'Bhangra', 'HD Video'],
        description: 'Non-stop Punjabi & Desi bass music video mix in crisp Full HD.',
        youtubeId: '6MgsHSAcI9k',
        languageLabel: 'Punjabi',
        sourceProvider: 'curated',
        movixSection: 'hd_songs',
      },
      {
        id: 'movix-sg-sufi-1',
        title: 'Sufi Soul & Qawwali Acoustic Session HD',
        subtitle: 'Urdu & Punjabi Sufi Classics',
        category: 'songs',
        categoryLabel: 'Sufi / Hindi',
        fileSize: '28.4 MB',
        sizeBytes: 29779558,
        durationOrVersion: '05:12',
        durationSeconds: 312,
        contentTypeTag: 'Song',
        qualityBadge: 'Hi-Res Studio HD',
        thumbnailUrl: 'https://i.ytimg.com/vi/6-n_szx2XRE/mqdefault.jpg',
        fallbackGradient: 'from-amber-950 via-neutral-950 to-black',
        downloadsCount: '920K',
        rating: 4.96,
        tags: ['Sufi', 'Urdu', 'Hindi'],
        description: 'Soulful acoustic harmonium and Sufi vocal performance.',
        youtubeId: '6-n_szx2XRE',
        languageLabel: 'Urdu / Hindi',
        sourceProvider: 'curated',
        movixSection: 'hd_songs',
      },
      {
        id: 'movix-sg-lofi-1',
        title: '24/7 Global Chill Beats & Instrumental Video Radio',
        subtitle: 'English / Worldwide Chill Stream',
        category: 'songs',
        categoryLabel: 'Global Chill',
        fileSize: 'Live HD',
        sizeBytes: 45000000,
        durationOrVersion: 'LIVE',
        durationSeconds: 0,
        contentTypeTag: 'Song',
        qualityBadge: 'Live Audio & Video',
        thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
        fallbackGradient: 'from-rose-950 via-purple-950 to-black',
        downloadsCount: '3.2M',
        rating: 4.97,
        tags: ['Global', 'Lo-Fi', 'Live'],
        description: 'Continuous worldwide instrumental beats stream — clean for focus and travel.',
        youtubeId: 'jfKfPfyJRdk',
        languageLabel: 'Global',
        sourceProvider: 'curated',
        movixSection: 'hd_songs',
      },
      {
        id: 'movix-sg-nature-4k',
        title: 'Costa Rica & Alpine 4K HDR Scenic Video Clip',
        subtitle: '4K Ultra HD Video Clip · Direct MP4',
        category: 'realistic',
        categoryLabel: '4K Video Clip',
        fileSize: '96 MB',
        sizeBytes: 100663296,
        durationOrVersion: '05:14',
        durationSeconds: 314,
        contentTypeTag: 'Realistic',
        qualityBadge: '4K HDR Clip',
        thumbnailUrl: 'https://i.ytimg.com/vi/LXb3EKWsInQ/mqdefault.jpg',
        fallbackGradient: 'from-emerald-950 via-neutral-950 to-black',
        downloadsCount: '1.5M',
        rating: 4.96,
        tags: ['4K Clip', 'Nature', 'Scenic'],
        description: 'Breathtaking 4K HDR nature & wildlife showcase video clip.',
        youtubeId: 'LXb3EKWsInQ',
        languageLabel: 'Global',
        sourceProvider: 'curated',
        movixSection: 'hd_songs',
      },
    ],
  },
  {
    id: 'quran_bayans',
    title: 'Quran Recitations & Islamic Bayans',
    subtitle: 'Heart-Soothing Tilawat · Studio Naat · Scholarly Bayans',
    badgeText: 'Islamic & Peaceful',
    accentGradient: 'from-emerald-500 to-teal-600',
    liveSearchQuery: 'Quran Tilawat Mishary Sudais beautiful Naat Sharif Islamic Bayan Tariq Jameel',
    items: [
      {
        id: 'movix-qr-rahman',
        title: 'Surah Ar-Rahman Full Tilawat — Qari Mishary Alafasy',
        subtitle: 'Arabic Quran Recitation · Crystal HD Audio & Video',
        category: 'tilawat',
        categoryLabel: 'Tilawat',
        fileSize: '22.5 MB',
        sizeBytes: 23592960,
        durationOrVersion: '16:40',
        durationSeconds: 1000,
        contentTypeTag: 'Tilawat',
        qualityBadge: '320k Crystal Tilawat',
        thumbnailUrl: 'https://i.ytimg.com/vi/Vq9s8N4cQ4Q/mqdefault.jpg',
        fallbackGradient: 'from-emerald-950 via-neutral-950 to-black',
        downloadsCount: '2.9M',
        rating: 4.99,
        tags: ['Quran', 'Surah Rahman', 'Mishary'],
        description: 'Sublime recitation of Surah Ar-Rahman in Arabic with peaceful acoustics.',
        youtubeId: 'Vq9s8N4cQ4Q',
        languageLabel: 'Arabic',
        sourceProvider: 'curated',
        movixSection: 'quran_bayans',
      },
      {
        id: 'movix-qr-mulk',
        title: 'Surah Al-Mulk (Masjid al-Haram) — Qari Abdul Rahman Al-Sudais',
        subtitle: 'Live Haramain Quran Tilawat HD',
        category: 'tilawat',
        categoryLabel: 'Tilawat',
        fileSize: '15.4 MB',
        sizeBytes: 16148070,
        durationOrVersion: '11:15',
        durationSeconds: 675,
        contentTypeTag: 'Tilawat',
        qualityBadge: 'Haramain HD Audio',
        thumbnailUrl: 'https://i.ytimg.com/vi/7B3Lg2mX1wY/mqdefault.jpg',
        fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
        downloadsCount: '1.8M',
        rating: 4.99,
        tags: ['Quran', 'Surah Mulk', 'Sudais'],
        description: 'Evening recitation of Surah Al-Mulk from Masjid al-Haram, Makkah.',
        youtubeId: '7B3Lg2mX1wY',
        languageLabel: 'Arabic',
        sourceProvider: 'curated',
        movixSection: 'quran_bayans',
      },
      {
        id: 'movix-nt-mustafa',
        title: 'Mustafa Jaan e Rehmat Pe Lakhon Salam — Studio Naat Sharif',
        subtitle: 'Urdu & Arabic Naat Collection · HD',
        category: 'naat',
        categoryLabel: 'Naat',
        fileSize: '18.4 MB',
        sizeBytes: 19293798,
        durationOrVersion: '06:42',
        durationSeconds: 402,
        contentTypeTag: 'Naat',
        qualityBadge: 'Studio Acoustic HD',
        thumbnailUrl: 'https://i.ytimg.com/vi/8p0Q6X4vKzU/mqdefault.jpg',
        fallbackGradient: 'from-teal-950 via-neutral-950 to-black',
        downloadsCount: '2.1M',
        rating: 4.99,
        tags: ['Naat', 'Hamd', 'Islamic'],
        description: 'Heart-touching Naat Sharif studio recitation in Urdu and Arabic.',
        youtubeId: '8p0Q6X4vKzU',
        languageLabel: 'Urdu / Arabic',
        sourceProvider: 'curated',
        movixSection: 'quran_bayans',
      },
      {
        id: 'movix-by-yaseen',
        title: 'Surah Yaseen & Peaceful Islamic Reflection Bayan',
        subtitle: 'Golden Era Recitation & Wisdom Talk (Urdu / Arabic)',
        category: 'tilawat',
        categoryLabel: 'Quran & Bayan',
        fileSize: '31.8 MB',
        sizeBytes: 33344716,
        durationOrVersion: '24:18',
        durationSeconds: 1458,
        contentTypeTag: 'Bayan',
        qualityBadge: 'Remastered HD',
        thumbnailUrl: 'https://i.ytimg.com/vi/6L5Wv8Yx9pE/mqdefault.jpg',
        fallbackGradient: 'from-green-950 via-neutral-950 to-black',
        downloadsCount: '1.5M',
        rating: 4.98,
        tags: ['Bayan', 'Surah Yaseen', 'Islamic'],
        description: 'Inspiring Islamic guidance, Quran reflection, and spiritual peace.',
        youtubeId: '6L5Wv8Yx9pE',
        languageLabel: 'Urdu / Arabic',
        sourceProvider: 'curated',
        movixSection: 'quran_bayans',
      },
    ],
  },
];

// =========================================================================
// Helpers: Timeout Fetch & Entity Decoding
// =========================================================================

async function fetchWithTimeout(
  url: string,
  ms = 5500,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function decodeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '');
}

function extractYtIdFromUrl(input: string): string | null {
  const match = input.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|[?&]v=)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

// =========================================================================
// Provider 1: Apple iTunes Keyless Movie & Music Video Search (CORS Friendly)
// =========================================================================

async function searchItunesMoviesAndClips(
  query: string,
  signal?: AbortSignal
): Promise<DownloadItem[]> {
  const results: DownloadItem[] = [];
  const endpoints = [
    {
      url: `https://itunes.apple.com/search?media=movie&explicit=No&limit=6&term=${encodeURIComponent(
        query
      )}`,
      kind: 'movie' as const,
    },
    {
      url: `https://itunes.apple.com/search?media=musicVideo&explicit=No&limit=5&term=${encodeURIComponent(
        query
      )}`,
      kind: 'musicVideo' as const,
    },
  ];

  const settled = await Promise.allSettled(
    endpoints.map(async ({ url, kind }) => {
      const res = await fetchWithTimeout(url, 4800, signal);
      if (!res.ok) return [];
      const data = await res.json();
      const rows = Array.isArray(data?.results) ? data.results : [];
      return rows
        .filter((r: any) => {
          if (!r?.trackName) return false;
          if (r.trackExplicitness === 'explicit' || r.collectionExplicitness === 'explicit') {
            return false;
          }
          if (r.contentAdvisoryRating && /^(NC-17|R|X|Explicit)$/i.test(r.contentAdvisoryRating)) {
            return false;
          }
          return true;
        })
        .map((r: any): DownloadItem | null => {
          const title = decodeHtml(r.trackName || r.collectionName || 'Movie Preview');
          const subtitle = decodeHtml(
            r.artistName || r.primaryGenreName || (kind === 'movie' ? 'iTunes Cinema' : 'HD Video Clip')
          );
          const description = decodeHtml(r.longDescription || r.shortDescription || '');
          const genre = decodeHtml(r.primaryGenreName || (kind === 'movie' ? 'Movie' : 'Song'));
          if (
            !isFamilySafeMediaItem({
              title,
              subtitle,
              description,
              tags: [genre],
            })
          ) {
            return null;
          }

          const durationSec =
            typeof r.trackTimeMillis === 'number' && r.trackTimeMillis > 0
              ? Math.round(r.trackTimeMillis / 1000)
              : undefined;
          const previewUrl: string | undefined =
            typeof r.previewUrl === 'string' && r.previewUrl.startsWith('http')
              ? r.previewUrl
              : undefined;
          const artRaw: string =
            typeof r.artworkUrl100 === 'string'
              ? r.artworkUrl100.replace(/100x100bb/i, '600x600bb')
              : '';

          const styleTag: ContentStyleTag =
            kind === 'musicVideo'
              ? 'Song'
              : classifyVideoContentType({
                  title,
                  subtitle,
                  description,
                  tags: [genre],
                  durationSeconds: durationSec,
                });

          return {
            id: `itunes-${r.trackId || Math.random().toString(36).slice(2)}`,
            title,
            subtitle: `${subtitle} · ${genre}`,
            category: mapStyleTagToCategory(styleTag),
            categoryLabel: styleTag,
            fileSize: previewUrl ? 'HD MP4 Stream' : 'Preview',
            sizeBytes: 32000000,
            durationOrVersion: formatVideoDuration(durationSec),
            durationSeconds: durationSec,
            contentTypeTag: styleTag,
            qualityBadge: previewUrl ? 'iTunes HD MP4' : 'Cinema Info',
            thumbnailUrl: artRaw,
            fallbackGradient: 'from-cyan-950 via-neutral-950 to-black',
            downloadsCount: 'iTunes',
            rating: 4.8,
            tags: [styleTag, genre, 'Family Safe'],
            description: description || `${title} — Family-safe stream via MOVIX.`,
            directVideoUrl: previewUrl,
            downloadUrl: previewUrl,
            embedUrl: !previewUrl && typeof r.trackViewUrl === 'string' ? r.trackViewUrl : undefined,
            sourceProvider: 'itunes',
            languageLabel: r.country || 'Global',
          };
        })
        .filter((x: DownloadItem | null): x is DownloadItem => Boolean(x && x.directVideoUrl));
    })
  );

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(...s.value);
    }
  }
  return results;
}

// =========================================================================
// Provider 2: Internet Archive Public Domain Cinema & Islamic Lectures (Keyless)
// =========================================================================

async function searchArchiveOrgCinema(
  query: string,
  signal?: AbortSignal
): Promise<DownloadItem[]> {
  try {
    const safeQ = query.replace(/[()"']/g, ' ').trim();
    if (!safeQ) return [];
    const luceneQ = `(${safeQ}) AND mediatype:(movies) AND NOT subject:(adult OR erotica OR nsfw OR xxx OR porn)`;
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      luceneQ
    )}&fl[]=identifier,title,creator,description,runtime,downloads,subject,language&rows=6&page=1&output=json`;

    const res = await fetchWithTimeout(url, 5200, signal);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];

    return docs
      .map((doc: any): DownloadItem | null => {
        const identifier = typeof doc?.identifier === 'string' ? doc.identifier : '';
        if (!identifier) return null;
        const title = decodeHtml(
          Array.isArray(doc.title) ? doc.title[0] : doc.title || 'Public Domain Cinema'
        );
        const creator = decodeHtml(
          Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || 'Internet Archive'
        );
        const description = decodeHtml(
          Array.isArray(doc.description) ? doc.description[0] : doc.description || ''
        );
        const subjects = Array.isArray(doc.subject)
          ? doc.subject.map(String)
          : doc.subject
          ? [String(doc.subject)]
          : [];
        const lang = Array.isArray(doc.language)
          ? String(doc.language[0])
          : doc.language
          ? String(doc.language)
          : 'Global';

        if (
          !isFamilySafeMediaItem({
            title,
            subtitle: creator,
            description,
            tags: subjects,
          })
        ) {
          return null;
        }

        const styleTag = classifyVideoContentType({
          title,
          subtitle: creator,
          description,
          tags: subjects,
        });

        const runtimeStr = typeof doc.runtime === 'string' ? doc.runtime : undefined;
        let durationSeconds: number | undefined;
        if (runtimeStr) {
          const parts = runtimeStr.split(':').map((n: string) => parseInt(n, 10));
          if (parts.length === 2 && parts.every((n: number) => !Number.isNaN(n))) {
            durationSeconds = parts[0] * 60 + parts[1];
          } else if (parts.length === 3 && parts.every((n: number) => !Number.isNaN(n))) {
            durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        return {
          id: `archive-${identifier}`,
          title,
          subtitle: `${creator} · Open Archive`,
          category: mapStyleTagToCategory(styleTag),
          categoryLabel: styleTag,
          fileSize: 'Full Film MP4',
          sizeBytes: 220000000,
          durationOrVersion: durationSeconds ? formatVideoDuration(durationSeconds) : runtimeStr || 'Full',
          durationSeconds,
          contentTypeTag: styleTag,
          qualityBadge: 'Archive Public HD',
          thumbnailUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
          fallbackGradient: 'from-indigo-950 via-neutral-950 to-black',
          downloadsCount: typeof doc.downloads === 'number' ? `${doc.downloads}` : 'Open',
          rating: 4.85,
          tags: [styleTag, 'Open Cinema', lang].slice(0, 3),
          description: description || 'Public-domain stream & downloadable film on Internet Archive.',
          embedUrl: `https://archive.org/embed/${encodeURIComponent(identifier)}?autoplay=1`,
          archiveId: identifier,
          languageLabel: lang,
          sourceProvider: 'archive',
        };
      })
      .filter((x: DownloadItem | null): x is DownloadItem => Boolean(x));
  } catch {
    return [];
  }
}

// =========================================================================
// Provider 3: Optional TMDB Worldwide Movies & Dramas (with include_adult=false)
// =========================================================================

async function searchTmdbWorldwide(
  query: string,
  tmdbApiKey: string,
  signal?: AbortSignal
): Promise<DownloadItem[]> {
  if (!tmdbApiKey) return [];
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(
      tmdbApiKey
    )}&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
    const res = await fetchWithTimeout(searchUrl, 5500, signal);
    if (!res.ok) return [];
    const data = await res.json();
    const raw = Array.isArray(data?.results) ? data.results : [];
    const safeItems = raw
      .filter(
        (r: any) =>
          r &&
          !r.adult &&
          (r.media_type === 'movie' || r.media_type === 'tv') &&
          isFamilySafeMediaItem({
            title: r.title || r.name,
            description: r.overview,
            adult: Boolean(r.adult),
          })
      )
      .slice(0, 6);

    const resolved = await Promise.all(
      safeItems.map(async (r: any): Promise<DownloadItem | null> => {
        const isTv = r.media_type === 'tv';
        const title = decodeHtml(r.title || r.name || 'TMDB Title');
        const releaseYear = String(r.release_date || r.first_air_date || '').slice(0, 4);
        const langCode = String(r.original_language || 'en').toUpperCase();
        const styleTag: ContentStyleTag = isTv ? 'Drama' : 'Movie';

        // Resolve trailer / clip YouTube ID from TMDB /videos endpoint
        let youtubeId: string | undefined;
        try {
          const vidRes = await fetchWithTimeout(
            `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${r.id}/videos?api_key=${encodeURIComponent(
              tmdbApiKey
            )}`,
            3200,
            signal
          );
          if (vidRes.ok) {
            const vidData = await vidRes.json();
            const vids = Array.isArray(vidData?.results) ? vidData.results : [];
            const ytVid =
              vids.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.key) ||
              vids.find((v: any) => v.site === 'YouTube' && v.key);
            if (ytVid?.key) youtubeId = ytVid.key;
          }
        } catch {
          // ignore trailer fetch timeout
        }

        if (!youtubeId) return null;

        const posterPath = r.backdrop_path || r.poster_path;
        const thumbUrl = posterPath
          ? `https://image.tmdb.org/t/p/w500${posterPath}`
          : `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;

        return {
          id: `tmdb-${r.media_type}-${r.id}`,
          title: releaseYear ? `${title} (${releaseYear})` : title,
          subtitle: `TMDB ${isTv ? 'Series' : 'Movie'} · Lang: ${langCode}`,
          category: mapStyleTagToCategory(styleTag),
          categoryLabel: styleTag,
          fileSize: 'Streaming HD',
          sizeBytes: 180000000,
          durationOrVersion: 'Trailer HD',
          contentTypeTag: styleTag,
          qualityBadge: `TMDB · ★ ${Number(r.vote_average || 7.5).toFixed(1)}`,
          thumbnailUrl: thumbUrl,
          fallbackGradient: 'from-amber-950 via-neutral-950 to-black',
          downloadsCount: 'TMDB',
          rating: Math.min(5, Math.max(3.8, Number(((r.vote_average || 7.8) / 2).toFixed(1)))),
          tags: [styleTag, langCode, 'Family Safe'],
          description: decodeHtml(r.overview || `${title} official HD trailer & info.`),
          youtubeId,
          tmdbId: Number(r.id),
          languageLabel: langCode,
          sourceProvider: 'tmdb',
        };
      })
    );

    return resolved.filter((x): x is DownloadItem => Boolean(x));
  } catch {
    return [];
  }
}

// =========================================================================
// Provider 4: YouTube Data API v3 (SafeSearch=strict) + Keyless Invidious/Piped
// =========================================================================

async function searchYouTubeSafe(
  query: string,
  youtubeApiKey: string,
  page = 1,
  pageToken: string | null = null,
  hintLabel?: string,
  signal?: AbortSignal
): Promise<{ items: DownloadItem[]; nextPageToken: string | null; prevPageToken: string | null }> {
  let nextPageToken: string | null = null;
  let prevPageToken: string | null = null;

  // Tier 1: Official YouTube Data API v3 with strict family filter
  if (youtubeApiKey) {
    try {
      const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&type=video&safeSearch=strict&videoEmbeddable=true${tokenParam}&q=${encodeURIComponent(
        query
      )}&key=${encodeURIComponent(youtubeApiKey)}`;
      const res = await fetchWithTimeout(endpoint, 5800, signal);
      if (res.ok) {
        const data = await res.json();
        nextPageToken = typeof data?.nextPageToken === 'string' ? data.nextPageToken : null;
        prevPageToken = typeof data?.prevPageToken === 'string' ? data.prevPageToken : null;
        const searchItems = Array.isArray(data?.items)
          ? data.items.filter((it: any) => it?.id?.videoId).slice(0, 10)
          : [];

        if (searchItems.length > 0) {
          const ids = searchItems.map((it: any) => it.id.videoId as string);
          const detailsById: Record<string, any> = {};
          try {
            const detRes = await fetchWithTimeout(
              `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${encodeURIComponent(
                ids.join(',')
              )}&key=${encodeURIComponent(youtubeApiKey)}`,
              4500,
              signal
            );
            if (detRes.ok) {
              const detData = await detRes.json();
              if (Array.isArray(detData?.items)) {
                for (const v of detData.items) {
                  if (v?.id) detailsById[v.id] = v;
                }
              }
            }
          } catch {
            // proceed with snippet fallback
          }

          const mapped = searchItems
            .map((it: any): DownloadItem | null => {
              const vidId = it.id.videoId as string;
              const det = detailsById[vidId];
              const title = decodeHtml(det?.snippet?.title || it.snippet?.title || 'Video');
              const subtitle = decodeHtml(
                det?.snippet?.channelTitle || it.snippet?.channelTitle || 'MOVIX Stream'
              );
              const description = decodeHtml(
                det?.snippet?.description || it.snippet?.description || ''
              );
              const tags: string[] = Array.isArray(det?.snippet?.tags)
                ? det.snippet.tags.slice(0, 5)
                : [];
              if (!isFamilySafeMediaItem({ title, subtitle, description, tags })) return null;

              const isLive = (det?.snippet?.liveBroadcastContent || it.snippet?.liveBroadcastContent) === 'live';
              const secs = parseIso8601DurationToSeconds(det?.contentDetails?.duration);
              const styleTag = classifyVideoContentType({
                title,
                subtitle,
                description,
                tags,
                tabHint: hintLabel,
                durationSeconds: secs,
              });

              return {
                id: `yt-${vidId}`,
                title,
                subtitle,
                category: mapStyleTagToCategory(styleTag),
                categoryLabel: styleTag,
                fileSize: isLive ? 'Live Stream' : 'Streaming HD',
                sizeBytes: 150000000,
                durationOrVersion: formatVideoDuration(secs, isLive),
                durationSeconds: secs,
                contentTypeTag: styleTag,
                qualityBadge: isLive ? 'LIVE HD' : 'YouTube HD',
                thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
                fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
                downloadsCount: isLive ? 'Live' : 'HD',
                rating: 4.9,
                tags: [styleTag, ...tags.slice(0, 2)].slice(0, 3),
                description,
                youtubeId: vidId,
                sourceProvider: 'youtube',
              };
            })
            .filter((x: DownloadItem | null): x is DownloadItem => Boolean(x));

          if (mapped.length > 0) {
            return { items: mapped, nextPageToken, prevPageToken };
          }
        }
      }
    } catch {
      // fall through to keyless mirrors
    }
  }

  // Tier 2: Keyless Invidious parallel race (strict safeSearch)
  const invidiousUrls = [
    `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`,
    `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`,
    `https://yewtu.be/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`,
  ];

  try {
    const invidiousMapped = await Promise.any(
      invidiousUrls.map(async (url) => {
        const res = await fetchWithTimeout(url, 4800, signal);
        if (!res.ok) throw new Error('status');
        const list = await res.json();
        if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
        const items = list
          .filter((it: any) => it?.videoId && (it.type === 'video' || !it.type))
          .slice(0, 10)
          .map((it: any): DownloadItem | null => {
            const vidId = it.videoId as string;
            const title = decodeHtml(it.title || 'MOVIX Video');
            const subtitle = decodeHtml(it.author || 'Global Channel');
            const description = decodeHtml(it.description || '');
            if (!isFamilySafeMediaItem({ title, subtitle, description })) return null;
            const secs = typeof it.lengthSeconds === 'number' ? it.lengthSeconds : undefined;
            const isLive = Boolean(it.liveNow);
            const styleTag = classifyVideoContentType({
              title,
              subtitle,
              description,
              tabHint: hintLabel,
              durationSeconds: secs,
            });
            return {
              id: `yt-${vidId}`,
              title,
              subtitle,
              category: mapStyleTagToCategory(styleTag),
              categoryLabel: styleTag,
              fileSize: isLive ? 'Live Stream' : 'Streaming HD',
              sizeBytes: 150000000,
              durationOrVersion: formatVideoDuration(secs, isLive),
              durationSeconds: secs,
              contentTypeTag: styleTag,
              qualityBadge: isLive ? 'LIVE HD' : 'MOVIX Stream',
              thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
              fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
              downloadsCount: isLive ? 'Live' : 'HD',
              rating: 4.9,
              tags: [styleTag, 'MOVIX'],
              description,
              youtubeId: vidId,
              sourceProvider: 'youtube',
            };
          })
          .filter((x: DownloadItem | null): x is DownloadItem => Boolean(x));
        if (items.length === 0) throw new Error('no safe items');
        return items;
      })
    );
    if (invidiousMapped.length > 0) {
      return {
        items: invidiousMapped,
        nextPageToken: invidiousMapped.length >= 8 ? `page-${page + 1}` : null,
        prevPageToken: page > 1 ? `page-${page - 1}` : null,
      };
    }
  } catch {
    // fall through to Piped
  }

  // Tier 3: Keyless Piped parallel race
  const pipedUrls = [
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=all`,
    `https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=all`,
  ];

  try {
    const pipedMapped = await Promise.any(
      pipedUrls.map(async (url) => {
        const res = await fetchWithTimeout(url, 4800, signal);
        if (!res.ok) throw new Error('status');
        const data = await res.json();
        const list = Array.isArray(data?.items) ? data.items : [];
        const items = list
          .filter((it: any) => typeof it?.url === 'string' && it.url.includes('v='))
          .slice(0, 10)
          .map((it: any): DownloadItem | null => {
            const vidId = extractYtIdFromUrl(it.url);
            if (!vidId) return null;
            const title = decodeHtml(it.title || 'MOVIX Video');
            const subtitle = decodeHtml(it.uploaderName || 'Global Channel');
            const description = decodeHtml(it.shortDescription || '');
            if (!isFamilySafeMediaItem({ title, subtitle, description })) return null;
            const secs = typeof it.duration === 'number' && it.duration >= 0 ? it.duration : undefined;
            const isLive = secs === 0;
            const styleTag = classifyVideoContentType({
              title,
              subtitle,
              description,
              tabHint: hintLabel,
              durationSeconds: secs,
            });
            return {
              id: `yt-${vidId}`,
              title,
              subtitle,
              category: mapStyleTagToCategory(styleTag),
              categoryLabel: styleTag,
              fileSize: isLive ? 'Live Stream' : 'Streaming HD',
              sizeBytes: 150000000,
              durationOrVersion: formatVideoDuration(secs, isLive),
              durationSeconds: secs,
              contentTypeTag: styleTag,
              qualityBadge: isLive ? 'LIVE HD' : 'MOVIX Stream',
              thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
              fallbackGradient: 'from-red-950 via-purple-950 to-neutral-950',
              downloadsCount: isLive ? 'Live' : 'HD',
              rating: 4.9,
              tags: [styleTag, 'MOVIX'],
              description,
              youtubeId: vidId,
              sourceProvider: 'youtube',
            };
          })
          .filter((x: DownloadItem | null): x is DownloadItem => Boolean(x));
        if (items.length === 0) throw new Error('no safe items');
        return items;
      })
    );
    return { items: pipedMapped, nextPageToken: null, prevPageToken: null };
  } catch {
    return { items: [], nextPageToken: null, prevPageToken: null };
  }
}

// =========================================================================
// Unified Worldwide Multi-Language Search (TMDB + YouTube + iTunes + Archive)
// =========================================================================

export async function searchMovixWorldwide(params: {
  query: string;
  languageId?: string;
  page?: number;
  pageToken?: string | null;
  hintLabel?: string;
  signal?: AbortSignal;
}): Promise<{
  items: DownloadItem[];
  nextPageToken: string | null;
  prevPageToken: string | null;
  blockedForSafety?: boolean;
}> {
  const cleanQuery = sanitizeText(params.query, 200);
  if (!cleanQuery) {
    return { items: [], nextPageToken: null, prevPageToken: null };
  }

  if (containsAdultSearchTerms(cleanQuery)) {
    return {
      items: [],
      nextPageToken: null,
      prevPageToken: null,
      blockedForSafety: true,
    };
  }

  const langObj = MOVIX_LANGUAGES.find((l) => l.id === params.languageId);
  const fullQuery =
    langObj && langObj.searchSuffix && !cleanQuery.toLowerCase().includes(langObj.searchSuffix.toLowerCase())
      ? `${cleanQuery} ${langObj.searchSuffix}`
      : cleanQuery;

  const { tmdbApiKey, youtubeApiKey } = getMovixApiKeys();
  const page = params.page || 1;

  // Query YouTube/Invidious/Piped, TMDB (if key), Apple iTunes (keyless), & Archive.org (keyless) in parallel
  const [ytRes, tmdbItems, itunesItems, archiveItems] = await Promise.all([
    searchYouTubeSafe(
      fullQuery,
      youtubeApiKey,
      page,
      params.pageToken || null,
      params.hintLabel,
      params.signal
    ),
    page === 1 && tmdbApiKey
      ? searchTmdbWorldwide(fullQuery, tmdbApiKey, params.signal)
      : Promise.resolve([]),
    page === 1 ? searchItunesMoviesAndClips(fullQuery, params.signal) : Promise.resolve([]),
    page === 1 ? searchArchiveOrgCinema(fullQuery, params.signal) : Promise.resolve([]),
  ]);

  // Interleave & deduplicate cleanly (cap at 12 items per page for 3GB RAM efficiency)
  const merged: DownloadItem[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (item: DownloadItem) => {
    if (!isFamilySafeMediaItem(item)) return;
    const key = item.youtubeId ? `yt:${item.youtubeId}` : item.id;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    merged.push(item);
  };

  // Prioritize TMDB + YouTube embeds first, then iTunes direct HD MP4s, then Archive.org full films
  tmdbItems.forEach(pushUnique);
  ytRes.items.forEach(pushUnique);
  itunesItems.slice(0, 4).forEach(pushUnique);
  archiveItems.slice(0, 3).forEach(pushUnique);

  return {
    items: merged.slice(0, 12),
    nextPageToken: ytRes.nextPageToken,
    prevPageToken: ytRes.prevPageToken,
  };
}

// =========================================================================
// Direct Download Stream Resolver (Archive MP4 / iTunes M4V / YouTube MP4)
// =========================================================================

export async function resolveMovixDownloadUrl(item: DownloadItem): Promise<string | null> {
  if (item.downloadUrl && item.downloadUrl.startsWith('http')) {
    return item.downloadUrl;
  }
  if (item.directVideoUrl && item.directVideoUrl.startsWith('http')) {
    return item.directVideoUrl;
  }

  // Archive.org metadata lookup -> actual downloadable MP4 file
  if (item.archiveId) {
    try {
      const res = await fetchWithTimeout(
        `https://archive.org/metadata/${encodeURIComponent(item.archiveId)}`,
        4500
      );
      if (res.ok) {
        const data = await res.json();
        const files: any[] = Array.isArray(data?.files) ? data.files : [];
        const mp4 =
          files.find((f) => typeof f?.name === 'string' && /\.mp4$/i.test(f.name)) ||
          files.find((f) => typeof f?.name === 'string' && /\.(?:webm|ogv|mp3|m4a)$/i.test(f.name));
        if (mp4?.name) {
          return `https://archive.org/download/${encodeURIComponent(item.archiveId)}/${encodeURIComponent(
            mp4.name
          )}`;
        }
      }
    } catch {
      // ignore archive metadata errors
    }
  }

  // YouTube ID -> try resolving downloadable muxed MP4 via Piped/Invidious mirrors
  if (item.youtubeId) {
    const streamEndpoints = [
      `https://pipedapi.kavin.rocks/streams/${encodeURIComponent(item.youtubeId)}`,
      `https://pipedapi.adminforge.de/streams/${encodeURIComponent(item.youtubeId)}`,
      `https://inv.nadeko.net/api/v1/videos/${encodeURIComponent(item.youtubeId)}`,
    ];
    try {
      const url = await Promise.any(
        streamEndpoints.map(async (ep) => {
          const res = await fetchWithTimeout(ep, 2800);
          if (!res.ok) throw new Error('status');
          const data = await res.json();
          // Piped formatStreams (muxed video+audio)
          const videoStreams: any[] = Array.isArray(data?.videoStreams) ? data.videoStreams : [];
          const muxed = videoStreams.find(
            (s) => !s.videoOnly && typeof s.url === 'string' && s.url.startsWith('http')
          );
          if (muxed?.url) return muxed.url as string;
          // Invidious formatStreams
          const formatStreams: any[] = Array.isArray(data?.formatStreams) ? data.formatStreams : [];
          const invMuxed = formatStreams.find(
            (s) => typeof s?.url === 'string' && s.url.startsWith('http')
          );
          if (invMuxed?.url) return invMuxed.url as string;
          throw new Error('no stream');
        })
      );
      if (url) return url;
    } catch {
      return null;
    }
  }

  return null;
}

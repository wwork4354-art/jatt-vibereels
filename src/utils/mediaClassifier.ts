import { ContentStyleTag, DownloadCategory } from '../types';

/**
 * Parse ISO 8601 duration returned by YouTube Data API v3 (`contentDetails.duration`),
 * e.g. "PT4M32S", "PT2H15M40S", "PT1H5M", "PT45S", "P0D".
 */
export function parseIso8601DurationToSeconds(isoDuration?: string): number | undefined {
  if (!isoDuration || typeof isoDuration !== 'string') return undefined;
  const trimmed = isoDuration.trim().toUpperCase();
  if (!trimmed) return undefined;
  if (trimmed === 'P0D' || trimmed === 'PT0S') return 0;

  const match = trimmed.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return undefined;

  const days = match[1] ? parseInt(match[1], 10) : 0;
  const hours = match[2] ? parseInt(match[2], 10) : 0;
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  const seconds = match[4] ? parseInt(match[4], 10) : 0;

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format duration in seconds to clean YouTube-style timestamp:
 * - e.g. `04:32` for songs/naats (< 1h)
 * - e.g. `2:15:40` for full movies (>= 1h)
 * - `LIVE` for live broadcasts
 */
export function formatVideoDuration(seconds?: number, isLive = false): string {
  if (isLive || seconds === 0) return 'LIVE';
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return 'HD';

  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const KEYWORD_RULES: { tag: ContentStyleTag; patterns: RegExp[]; weight: number }[] = [
  {
    tag: 'Tilawat',
    weight: 10,
    patterns: [
      /\btilawat\b/i,
      /\bquran\b/i,
      /\bqur'?an\b/i,
      /\bsurah\b/i,
      /\bayat\b/i,
      /\bqari\b/i,
      /\brecitation\b/i,
      /\balafasy\b/i,
      /\bmishary\b/i,
      /\bsudais\b/i,
      /\bghamdi\b/i,
      /\babdul\s*basit\b/i,
      /\btajweed\b/i,
      /\btarteel\b/i,
      /\bharamain\b/i,
    ],
  },
  {
    tag: 'Naat',
    weight: 10,
    patterns: [
      /\bnaat\b/i,
      /\bnaat\s*sharif\b/i,
      /\bhamd\b/i,
      /\bnasheed\b/i,
      /\bmadina\b/i,
      /\bmustafa\b/i,
      /\brasool\b/i,
      /\bowais\s*raza\b/i,
      /\bjunaid\s*jamshed\b/i,
      /\bmanqabat\b/i,
      /\bqasida\b/i,
    ],
  },
  {
    tag: 'Talk Show',
    weight: 9,
    patterns: [
      /\btalk\s*show\b/i,
      /\bpodcast\b/i,
      /\binterview\b/i,
      /\blate\s*night\b/i,
      /\btonight\s*show\b/i,
      /\bmazaaq\s*raat\b/i,
      /\bhasb\s*e?\s*haal\b/i,
      /\bdebate\b/i,
      /\broundtable\b/i,
      /\bhost\b/i,
    ],
  },
  {
    tag: 'Program',
    weight: 8,
    patterns: [
      /\btv\s*program\b/i,
      /\bprogram\b/i,
      /\bmorning\s*show\b/i,
      /\bcooking\s*show\b/i,
      /\breality\s*show\b/i,
      /\bgame\s*show\b/i,
      /\btalent\s*show\b/i,
      /\bcomedy\s*show\b/i,
      /\bquiz\s*show\b/i,
      /\bspecial\s*transmission\b/i,
    ],
  },
  {
    tag: 'Rhymes',
    weight: 9,
    patterns: [
      /\brhymes?\b/i,
      /\bnursery\b/i,
      /\bcocomelon\b/i,
      /\bbaby\s*shark\b/i,
      /\babc\s*song\b/i,
      /\blullaby\b/i,
      /\bphonics\b/i,
      /\btoddler\b/i,
      /\btwin?kle\b/i,
      /\bwheels\s*on\s*the\s*bus\b/i,
      /\bkids\s*poems?\b/i,
    ],
  },
  {
    tag: 'Cartoon',
    weight: 8,
    patterns: [
      /\bcartoons?\b/i,
      /\banime\b/i,
      /\banimated\b/i,
      /\banimation\b/i,
      /\bbheem\b/i,
      /\bmotu\s*patlu\b/i,
      /\btom\s*(?:and|&)\s*jerry\b/i,
      /\boggy\b/i,
      /\bdoraemon\b/i,
      /\bshinchan\b/i,
      /\bpokemon\b/i,
      /\bpixar\b/i,
    ],
  },
  {
    tag: 'Realistic',
    weight: 8,
    patterns: [
      /\brealistic\b/i,
      /\breal\s*life\b/i,
      /\bdocumentary\b/i,
      /\bwildlife\b/i,
      /\bwalking\s*tour\b/i,
      /\b4k\s*walk\b/i,
      /\btravel\s*vlog\b/i,
      /\bnature\s*4k\b/i,
      /\bnational\s*geographic\b/i,
      /\bdiscovery\b/i,
      /\bbbc\s*earth\b/i,
      /\blive\s*action\b/i,
      /\bstreet\s*food\b/i,
    ],
  },
  {
    tag: 'Drama',
    weight: 8,
    patterns: [
      /\bdramas?\b/i,
      /\bkdrama\b/i,
      /\bk-drama\b/i,
      /\bturkish\s*drama\b/i,
      /\bpakistani\s*drama\b/i,
      /\bserial\b/i,
      /\bepisode\s*\d+/i,
      /\bep\s*\d+\b/i,
      /\bseason\s*\d+\b/i,
      /\bhum\s*tv\b/i,
      /\bary\s*digital\b/i,
      /\bgeo\s*entertainment\b/i,
    ],
  },
  {
    tag: 'Song',
    weight: 7,
    patterns: [
      /\bsongs?\b/i,
      /\bofficial\s*(?:music\s*)?video\b/i,
      /\bofficial\s*audio\b/i,
      /\blyric(?:al|s)?\b/i,
      /\bremix\b/i,
      /\bbhangra\b/i,
      /\bmusic\s*video\b/i,
      /\bmix\b/i,
      /\blofi\b|\blo-fi\b/i,
      /\btrack\b/i,
      /\bsinger\b/i,
      /\balbum\b/i,
      /\bqawwali\b/i,
      /\bghazal\b/i,
    ],
  },
  {
    tag: 'Movie',
    weight: 7,
    patterns: [
      /\bfull\s*movie\b/i,
      /\bmovies?\b/i,
      /\bfilms?\b/i,
      /\bcinema\b/i,
      /\bblockbuster\b/i,
      /\bhollywood\b/i,
      /\bbollywood\b/i,
      /\blollywood\b/i,
      /\bdubbed\b/i,
      /\bthriller\b/i,
      /\bsci-fi\b/i,
      /\baction\s*film\b/i,
      /\bfeature\s*film\b/i,
    ],
  },
];

const TAB_OR_CATEGORY_TO_TAG: Record<string, ContentStyleTag> = {
  movies: 'Movie',
  movie: 'Movie',
  world_movies: 'Movie',
  dramas: 'Drama',
  drama: 'Drama',
  songs: 'Song',
  song: 'Song',
  cartoons: 'Cartoon',
  cartoon: 'Cartoon',
  realistic: 'Realistic',
  rhymes: 'Rhymes',
  naat: 'Naat',
  tilawat: 'Tilawat',
  quran: 'Tilawat',
  programs: 'Program',
  program: 'Program',
  talk_shows: 'Talk Show',
  talk_show: 'Talk Show',
  'talk show': 'Talk Show',
};

/**
 * Automatically classify a video into one of the 10 canonical Movie Box content types:
 * Movie, Drama, Song, Cartoon, Realistic, Rhymes, Naat, Tilawat, Program, or Talk Show.
 */
export function classifyVideoContentType(params: {
  title: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
  category?: string;
  tabHint?: string;
  durationSeconds?: number;
}): ContentStyleTag {
  const titleText = params.title || '';
  const bodyText = `${params.subtitle || ''} ${(params.tags || []).join(' ')} ${params.description || ''}`;

  let bestTag: ContentStyleTag | null = null;
  let bestScore = 0;

  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(titleText)) {
        score += rule.weight * 2;
      } else if (pattern.test(bodyText)) {
        score += rule.weight;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTag = rule.tag;
    }
  }

  if (bestTag && bestScore >= 8) {
    return bestTag;
  }

  const hintKey = (params.tabHint || params.category || '').trim().toLowerCase();
  if (hintKey && TAB_OR_CATEGORY_TO_TAG[hintKey]) {
    return TAB_OR_CATEGORY_TO_TAG[hintKey];
  }

  if (bestTag) return bestTag;

  // Duration-based smart fallback when keywords are minimal
  if (typeof params.durationSeconds === 'number') {
    if (params.durationSeconds >= 3600) return 'Movie';
    if (params.durationSeconds >= 1800) return 'Drama';
    if (params.durationSeconds > 60 && params.durationSeconds <= 420) return 'Song';
  }

  return 'Movie';
}

export function mapStyleTagToCategory(tag: ContentStyleTag): DownloadCategory {
  switch (tag) {
    case 'Movie':
      return 'movies';
    case 'Drama':
      return 'dramas';
    case 'Song':
      return 'songs';
    case 'Cartoon':
      return 'cartoons';
    case 'Realistic':
      return 'realistic';
    case 'Rhymes':
      return 'rhymes';
    case 'Naat':
      return 'naat';
    case 'Tilawat':
      return 'tilawat';
    case 'Program':
      return 'programs';
    case 'Talk Show':
      return 'talk_shows';
    default:
      return 'movies';
  }
}

export function getContentTagBadgeClasses(tag: ContentStyleTag): string {
  switch (tag) {
    case 'Movie':
      return 'bg-amber-500 text-black border-amber-300';
    case 'Drama':
      return 'bg-purple-600 text-white border-purple-400';
    case 'Song':
      return 'bg-pink-600 text-white border-pink-400';
    case 'Cartoon':
      return 'bg-cyan-400 text-black border-cyan-200';
    case 'Realistic':
      return 'bg-emerald-600 text-white border-emerald-400';
    case 'Rhymes':
      return 'bg-lime-400 text-black border-lime-200';
    case 'Naat':
      return 'bg-teal-600 text-white border-teal-300';
    case 'Tilawat':
      return 'bg-green-600 text-white border-emerald-300';
    case 'Program':
      return 'bg-indigo-600 text-white border-indigo-400';
    case 'Talk Show':
      return 'bg-orange-600 text-white border-orange-300';
    default:
      return 'bg-neutral-800 text-white border-neutral-600';
  }
}

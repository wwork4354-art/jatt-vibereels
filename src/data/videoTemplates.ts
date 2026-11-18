export type TemplateCategory =
  | 'all'
  | 'beat_sync'
  | 'attitude'
  | 'neon'
  | 'cinematic'
  | 'lyrics';

export type TemplateTransitionStyle =
  | 'beat_zoom'
  | 'bass_shake'
  | 'neon_flash'
  | 'ken_burns'
  | 'lyrics_frame'
  | 'spiritual_aura';

export interface VideoTemplateDef {
  id: string;
  name: string;
  tagline: string;
  category: Exclude<TemplateCategory, 'all'>;
  categoryLabel: string;
  durationSec: number;
  bpm: number;
  minClips: number;
  maxClips: number;
  aspectRatio: '9:16';
  defaultOverlayText: string;
  defaultSecondaryText: string;
  lyricLines?: string[];
  defaultAudioTrackId: string;
  filterCss: string;
  accentColor: string;
  accentGradient: string;
  transitionStyle: TemplateTransitionStyle;
  hashtags: string[];
  previewColors: [string, string, string];
  previewBadge: string;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'attitude', label: 'Punjabi & Tribute' },
  { id: 'lyrics', label: 'Sad Lyrics & Naat' },
  { id: 'cinematic', label: 'Drone & Cinema' },
  { id: 'neon', label: 'Neon FX' },
  { id: 'beat_sync', label: 'Beat Sync' },
];

export const VIDEO_TEMPLATES: VideoTemplateDef[] = [
  {
    id: 'tpl-moose-wala-tribute',
    name: 'Sidhu Moose Wala Tribute Beat',
    tagline: 'Iconic 92 BPM dark tumbi & 808 tribute beat with moody film grade & legacy lyrics.',
    category: 'attitude',
    categoryLabel: 'Tribute Beat',
    durationSec: 12,
    bpm: 92,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'LEGENDS NEVER DIE',
    defaultSecondaryText: 'Dil Da Ni Maada · Rest in Power 295',
    lyricLines: [
      'Dil Da Ni Maada · Rest in Power 295',
      'Sach Bolda Reha · Forever In Our Hearts',
      'Thapiyan Te Tumbi · Legend Forever',
    ],
    defaultAudioTrackId: 'song-moose-tribute',
    filterCss: 'contrast(1.22) saturate(0.9) brightness(0.94)',
    accentColor: '#f59e0b',
    accentGradient: 'from-amber-600 via-red-600 to-neutral-900',
    transitionStyle: 'bass_shake',
    hashtags: ['sidhumoosewala', '295', 'tribute', 'vibereels'],
    previewColors: ['#18100a', '#b45309', '#dc2626'],
    previewBadge: '295 Tribute · 808',
  },
  {
    id: 'tpl-punjabi-attitude-zoom',
    name: 'Punjabi Jatt Attitude Slow-Mo',
    tagline: 'Hard dhol kick-punch zooms, rhythmic bass shake & warm golden amber slow-mo.',
    category: 'attitude',
    categoryLabel: 'Punjabi Swag',
    durationSec: 10,
    bpm: 128,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'JATT DA SWAG',
    defaultSecondaryText: 'Royal Attitude · No Competition',
    lyricLines: [
      'Royal Attitude · No Competition',
      'Sardaari Vibe · High Standard Living',
      'Punjab Da Sher · Full Power 60FPS',
    ],
    defaultAudioTrackId: 'song-jatt-swag',
    filterCss: 'contrast(1.2) saturate(1.28) sepia(0.14)',
    accentColor: '#f59e0b',
    accentGradient: 'from-amber-500 via-orange-500 to-rose-600',
    transitionStyle: 'bass_shake',
    hashtags: ['jattswag', 'punjabi', 'attitude', 'vibereels'],
    previewColors: ['#291306', '#d97706', '#e11d48'],
    previewBadge: '0.7x Dhol Slow-Mo',
  },
  {
    id: 'tpl-romantic-sad-lyrics',
    name: 'Romantic Sad Song Lyrics',
    tagline: 'Soulful acoustic strings with editorial frosted lyric card & synced poetic lines.',
    category: 'lyrics',
    categoryLabel: 'Sad Lyrics',
    durationSec: 14,
    bpm: 82,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'Tu Judaa Ho Ke Bhi',
    defaultSecondaryText: 'Khamoshiyan bhi aaj teri yaad dilati hain...',
    lyricLines: [
      'Khamoshiyan bhi aaj teri yaad dilati hain...',
      'Har saans mein bas tera hi naam aata hai...',
      'Kuch rishte toot kar bhi dil mein rehte hain...',
    ],
    defaultAudioTrackId: 'song-sad-lyrics',
    filterCss: 'contrast(1.06) saturate(0.92) brightness(0.94)',
    accentColor: '#ec4899',
    accentGradient: 'from-purple-600 via-pink-500 to-rose-500',
    transitionStyle: 'lyrics_frame',
    hashtags: ['sadlyrics', 'romanticsong', 'lofi', 'vibereels'],
    previewColors: ['#1c102b', '#7e22ce', '#ec4899'],
    previewBadge: 'Synced Lyrics',
  },
  {
    id: 'tpl-cinematic-drone-zoom',
    name: 'Cinematic Drone Zoom',
    tagline: 'Sweeping aerial Ken Burns orbital zoom in 2.39:1 widescreen cinema letterbox.',
    category: 'cinematic',
    categoryLabel: 'Cinematic',
    durationSec: 14,
    bpm: 78,
    minClips: 1,
    maxClips: 8,
    aspectRatio: '9:16',
    defaultOverlayText: 'ABOVE THE CLOUDS',
    defaultSecondaryText: '35mm Aerial Cinema · Horizon Motion',
    defaultAudioTrackId: 'beat-cosmic-pulse',
    filterCss: 'contrast(1.1) saturate(1.12) brightness(0.98)',
    accentColor: '#38bdf8',
    accentGradient: 'from-sky-500 via-indigo-500 to-purple-600',
    transitionStyle: 'ken_burns',
    hashtags: ['dronezoom', 'cinematic', 'travel', 'vibereels'],
    previewColors: ['#0f172a', '#1d4ed8', '#38bdf8'],
    previewBadge: '2.39:1 Drone',
  },
  {
    id: 'tpl-neon-bass-shake',
    name: 'Neon Bass Shake',
    tagline: 'Cyber-magenta & cyan flash cuts with sub-bass screen shake synced to phonk beat.',
    category: 'neon',
    categoryLabel: 'Neon FX',
    durationSec: 10,
    bpm: 120,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'NEON OVERDRIVE',
    defaultSecondaryText: 'Sub-Bass Shake · Cyber Flash 60fps',
    defaultAudioTrackId: 'beat-tokyo-drift',
    filterCss: 'contrast(1.18) saturate(1.38) hue-rotate(-8deg)',
    accentColor: '#06b6d4',
    accentGradient: 'from-cyan-500 via-purple-600 to-pink-500',
    transitionStyle: 'neon_flash',
    hashtags: ['neonbass', 'cyberedit', 'phonk', 'vibereels'],
    previewColors: ['#090d24', '#0891b2', '#c026d3'],
    previewBadge: 'Bass Shake FX',
  },
  {
    id: 'tpl-slowmo-beat-sync',
    name: 'Slow-Mo Beat Sync',
    tagline: 'Velvet 0.7x slow-motion flow with sharp bass-drop zoom pulses on every beat.',
    category: 'beat_sync',
    categoryLabel: 'Beat Sync',
    durationSec: 12,
    bpm: 110,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'FEEL THE BEAT',
    defaultSecondaryText: 'Slow-Mo Velocity · Jatt VibeReels',
    defaultAudioTrackId: 'beat-future-neon',
    filterCss: 'contrast(1.12) saturate(1.18) brightness(1.02)',
    accentColor: '#ec4899',
    accentGradient: 'from-pink-600 via-rose-500 to-amber-500',
    transitionStyle: 'beat_zoom',
    hashtags: ['slowmo', 'beatsync', 'vibereels', 'trending'],
    previewColors: ['#1e1b4b', '#be185d', '#f59e0b'],
    previewBadge: '0.7x Velocity',
  },
  {
    id: 'tpl-naat-spiritual-aura',
    name: 'Naat Spiritual Aura',
    tagline: 'Serene emerald & golden halo glow with peaceful devotional typography frame.',
    category: 'lyrics',
    categoryLabel: 'Devotional',
    durationSec: 15,
    bpm: 68,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'Hasbi Rabbi Jallallah',
    defaultSecondaryText: 'Peace · Noor · Spiritual Reflections',
    lyricLines: [
      'Hasbi Rabbi Jallallah · Ma Fi Qalbi Ghairullah',
      'Noor-e-Muhammad Sallallah · La Ilaha Illallah',
    ],
    defaultAudioTrackId: 'naat-hasbi-rabbi',
    filterCss: 'contrast(1.04) saturate(1.06) brightness(1.03)',
    accentColor: '#10b981',
    accentGradient: 'from-emerald-500 via-teal-500 to-amber-400',
    transitionStyle: 'spiritual_aura',
    hashtags: ['naat', 'islamicreels', 'peace', 'vibereels'],
    previewColors: ['#042f2e', '#059669', '#f59e0b'],
    previewBadge: 'Noor Halo',
  },
];

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
  { id: 'beat_sync', label: 'Beat Sync' },
  { id: 'attitude', label: 'Punjabi Swag' },
  { id: 'neon', label: 'Neon FX' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'lyrics', label: 'Lyrics & Naat' },
];

export const VIDEO_TEMPLATES: VideoTemplateDef[] = [
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
    id: 'tpl-punjabi-attitude-zoom',
    name: 'Punjabi Attitude Zoom',
    tagline: 'Hard dhol kick-punch zooms, rhythmic bass shake & warm golden amber swag.',
    category: 'attitude',
    categoryLabel: 'Punjabi Swag',
    durationSec: 10,
    bpm: 128,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'JATT DA SWAG',
    defaultSecondaryText: 'Royal Attitude · No Competition',
    defaultAudioTrackId: 'song-jatt-swag',
    filterCss: 'contrast(1.2) saturate(1.28) sepia(0.14)',
    accentColor: '#f59e0b',
    accentGradient: 'from-amber-500 via-orange-500 to-rose-600',
    transitionStyle: 'bass_shake',
    hashtags: ['jattswag', 'punjabi', 'attitude', 'vibereels'],
    previewColors: ['#291306', '#d97706', '#e11d48'],
    previewBadge: 'Dhol Punch FX',
  },
  {
    id: 'tpl-neon-glow-transition',
    name: 'Neon Glow Transition',
    tagline: 'Cyber-magenta & cyan flash cuts with glowing edge bloom synced to phonk tempo.',
    category: 'neon',
    categoryLabel: 'Neon FX',
    durationSec: 10,
    bpm: 120,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'NIGHT RUNNER',
    defaultSecondaryText: 'Neon Flash Cut · 60fps Edit',
    defaultAudioTrackId: 'beat-tokyo-drift',
    filterCss: 'contrast(1.18) saturate(1.38) hue-rotate(-8deg)',
    accentColor: '#06b6d4',
    accentGradient: 'from-cyan-500 via-purple-600 to-pink-500',
    transitionStyle: 'neon_flash',
    hashtags: ['neonglow', 'cyberedit', 'phonk', 'vibereels'],
    previewColors: ['#090d24', '#0891b2', '#c026d3'],
    previewBadge: 'Cyber Bloom',
  },
  {
    id: 'tpl-cinematic-slideshow',
    name: 'Cinematic Slideshow',
    tagline: 'Smooth Ken Burns pan & cross-dissolve framed in widescreen cinema letterbox.',
    category: 'cinematic',
    categoryLabel: 'Cinematic',
    durationSec: 14,
    bpm: 78,
    minClips: 1,
    maxClips: 8,
    aspectRatio: '9:16',
    defaultOverlayText: 'MEMORIES IN MOTION',
    defaultSecondaryText: '35mm Film Story · Timeless Vibes',
    defaultAudioTrackId: 'song-golden-sufi',
    filterCss: 'contrast(1.08) saturate(1.08) brightness(0.98)',
    accentColor: '#38bdf8',
    accentGradient: 'from-sky-500 via-indigo-500 to-purple-600',
    transitionStyle: 'ken_burns',
    hashtags: ['cinematic', 'slideshow', 'memories', 'vibereels'],
    previewColors: ['#0f172a', '#1d4ed8', '#38bdf8'],
    previewBadge: '2.39:1 Film',
  },
  {
    id: 'tpl-emotional-lyrics-frame',
    name: 'Emotional Lyrics Frame',
    tagline: 'Editorial frosted card frame over dreamy ambient backdrop with timed lyric lines.',
    category: 'lyrics',
    categoryLabel: 'Lyrics',
    durationSec: 14,
    bpm: 85,
    minClips: 1,
    maxClips: 6,
    aspectRatio: '9:16',
    defaultOverlayText: 'Dil Diyaan Gallan',
    defaultSecondaryText: 'Some moments stay forever in the heart...',
    defaultAudioTrackId: 'song-lahore-nights',
    filterCss: 'contrast(1.05) saturate(0.96) brightness(0.95)',
    accentColor: '#a855f7',
    accentGradient: 'from-purple-600 via-pink-500 to-rose-500',
    transitionStyle: 'lyrics_frame',
    hashtags: ['lyrics', 'aesthetic', 'lofi', 'vibereels'],
    previewColors: ['#1c102b', '#7e22ce', '#ec4899'],
    previewBadge: 'Lyric Card',
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

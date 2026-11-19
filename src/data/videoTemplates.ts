export type TemplateCategory =
  | 'all'
  | 'trending'
  | 'beat_sync'
  | 'slow_mo'
  | 'bhangra_punjabi'
  | 'neon_glow';

export type TemplateEffectTransition = 'zoom-in' | 'flash' | 'shake' | 'slide';

export type TemplateTransitionStyle =
  | 'beat_zoom'
  | 'bass_shake'
  | 'neon_flash'
  | 'ken_burns'
  | 'lyrics_frame'
  | 'spiritual_aura'
  | 'slide_wipe';

export interface ColorGradePreset {
  id: string;
  name: string;
  filterCss: string;
  tintRgba: string;
}

export const TEMPLATE_COLOR_GRADES: ColorGradePreset[] = [
  {
    id: 'golden_amber',
    name: 'Golden Amber',
    filterCss: 'contrast(1.18) saturate(1.28) sepia(0.16) brightness(1.02)',
    tintRgba: 'rgba(245, 158, 11, 0.14)',
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    filterCss: 'contrast(1.22) saturate(1.42) hue-rotate(-10deg)',
    tintRgba: 'rgba(6, 182, 212, 0.14)',
  },
  {
    id: 'moody_295',
    name: 'Moody 295 Film',
    filterCss: 'contrast(1.24) saturate(0.88) brightness(0.93)',
    tintRgba: 'rgba(180, 83, 9, 0.14)',
  },
  {
    id: 'velvet_rose',
    name: 'Velvet Rose',
    filterCss: 'contrast(1.12) saturate(1.22) brightness(1.01)',
    tintRgba: 'rgba(236, 72, 153, 0.12)',
  },
  {
    id: 'anamorphic_teal',
    name: 'Anamorphic Teal',
    filterCss: 'contrast(1.14) saturate(1.16) brightness(0.98)',
    tintRgba: 'rgba(56, 189, 248, 0.13)',
  },
  {
    id: 'bw_cinema',
    name: 'Mono Contrast',
    filterCss: 'grayscale(1) contrast(1.3) brightness(0.98)',
    tintRgba: 'rgba(255, 255, 255, 0.04)',
  },
];

export interface VideoTemplateDef {
  id: string;
  name: string;
  tagline: string;
  category: Exclude<TemplateCategory, 'all'>;
  categories: Exclude<TemplateCategory, 'all'>[];
  categoryLabel: string;
  durationSec: number;
  bpm: number;
  beatCutIntervalBeats: number;
  minClips: number;
  maxClips: number;
  aspectRatio: '9:16';
  defaultSpeedMultiplier: number;
  defaultOverlayText: string;
  defaultSecondaryText: string;
  lyricLines?: string[];
  defaultAudioTrackId: string;
  colorGradeName: string;
  colorTintRgba: string;
  filterCss: string;
  accentColor: string;
  accentGradient: string;
  primaryTransition: TemplateEffectTransition;
  transitions: TemplateEffectTransition[];
  transitionStyle: TemplateTransitionStyle;
  hashtags: string[];
  previewColors: [string, string, string];
  previewBadge: string;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'beat_sync', label: 'Beat Sync' },
  { id: 'slow_mo', label: 'Slow-Mo' },
  { id: 'bhangra_punjabi', label: 'Bhangra / Punjabi Vibe' },
  { id: 'neon_glow', label: 'Neon Glow' },
];

export const VIDEO_TEMPLATES: VideoTemplateDef[] = [
  {
    id: 'tpl-punjabi-attitude-zoom',
    name: 'Punjabi Jatt Attitude Slow-Mo',
    tagline: 'Hard dhol beat cuts, punch zoom-ins, bass shake & golden amber slow-mo.',
    category: 'bhangra_punjabi',
    categories: ['trending', 'bhangra_punjabi', 'slow_mo'],
    categoryLabel: 'Bhangra / Punjabi Vibe',
    durationSec: 10,
    bpm: 128,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.75,
    defaultOverlayText: 'JATT DA SWAG',
    defaultSecondaryText: 'Royal Attitude · No Competition',
    lyricLines: [
      'Royal Attitude · No Competition',
      'Sardaari Vibe · High Standard Living',
      'Punjab Da Sher · Full Power 60FPS',
    ],
    defaultAudioTrackId: 'song-jatt-swag',
    colorGradeName: 'Golden Amber',
    colorTintRgba: 'rgba(245, 158, 11, 0.14)',
    filterCss: 'contrast(1.2) saturate(1.28) sepia(0.14)',
    accentColor: '#f59e0b',
    accentGradient: 'from-amber-500 via-orange-500 to-rose-600',
    primaryTransition: 'zoom-in',
    transitions: ['zoom-in', 'shake', 'flash'],
    transitionStyle: 'bass_shake',
    hashtags: ['jattswag', 'punjabi', 'bhangra', 'vibereels'],
    previewColors: ['#291306', '#d97706', '#e11d48'],
    previewBadge: '0.75x Dhol Slow-Mo',
  },
  {
    id: 'tpl-slowmo-beat-sync',
    name: 'Slow-Mo Beat Sync',
    tagline: 'Velvet 0.75x slow-motion flow with crisp flash & zoom-in beat drops.',
    category: 'beat_sync',
    categories: ['trending', 'beat_sync', 'slow_mo'],
    categoryLabel: 'Beat Sync',
    durationSec: 12,
    bpm: 110,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.75,
    defaultOverlayText: 'FEEL THE BEAT',
    defaultSecondaryText: 'Slow-Mo Velocity · Jatt VibeReels',
    defaultAudioTrackId: 'beat-future-neon',
    colorGradeName: 'Velvet Rose',
    colorTintRgba: 'rgba(236, 72, 153, 0.13)',
    filterCss: 'contrast(1.14) saturate(1.2) brightness(1.02)',
    accentColor: '#ec4899',
    accentGradient: 'from-pink-600 via-rose-500 to-amber-500',
    primaryTransition: 'zoom-in',
    transitions: ['zoom-in', 'flash', 'slide'],
    transitionStyle: 'beat_zoom',
    hashtags: ['slowmo', 'beatsync', 'vibereels', 'trending'],
    previewColors: ['#1e1b4b', '#be185d', '#f59e0b'],
    previewBadge: '0.75x Beat Sync',
  },
  {
    id: 'tpl-bhangra-dhol-slide',
    name: 'Bhangra Dhol Beat Slide',
    tagline: 'High-energy Punjabi dhol slide transitions with punchy kicks & bright gold grade.',
    category: 'bhangra_punjabi',
    categories: ['trending', 'bhangra_punjabi', 'beat_sync'],
    categoryLabel: 'Bhangra / Punjabi Vibe',
    durationSec: 10,
    bpm: 132,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 1,
    defaultOverlayText: 'BHANGRA VIBES',
    defaultSecondaryText: 'Sher Punjabi · Dhol & Bass Drops',
    lyricLines: [
      'Sher Punjabi · Dhol & Bass Drops',
      'Chak De Phatte · Pure Desi Energy',
      'Desi Beat Sync · Non-Stop Groove',
    ],
    defaultAudioTrackId: 'song-gabru-anthem',
    colorGradeName: 'Golden Amber',
    colorTintRgba: 'rgba(245, 158, 11, 0.15)',
    filterCss: 'contrast(1.18) saturate(1.32) brightness(1.03)',
    accentColor: '#f97316',
    accentGradient: 'from-orange-500 via-amber-500 to-pink-600',
    primaryTransition: 'slide',
    transitions: ['slide', 'zoom-in', 'shake'],
    transitionStyle: 'slide_wipe',
    hashtags: ['bhangra', 'punjabivibe', 'dholbeat', 'vibereels'],
    previewColors: ['#2a1205', '#ea580c', '#f59e0b'],
    previewBadge: 'Slide · 132 BPM',
  },
  {
    id: 'tpl-neon-bass-shake',
    name: 'Neon Glow Bass Shake',
    tagline: 'Cyber-magenta & cyan strobe flash cuts with sub-bass screen shake.',
    category: 'neon_glow',
    categories: ['trending', 'neon_glow', 'beat_sync'],
    categoryLabel: 'Neon Glow',
    durationSec: 10,
    bpm: 124,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 1,
    defaultOverlayText: 'NEON OVERDRIVE',
    defaultSecondaryText: 'Sub-Bass Shake · Cyber Flash 60fps',
    defaultAudioTrackId: 'beat-tokyo-drift',
    colorGradeName: 'Cyber Neon',
    colorTintRgba: 'rgba(6, 182, 212, 0.15)',
    filterCss: 'contrast(1.2) saturate(1.4) hue-rotate(-8deg)',
    accentColor: '#06b6d4',
    accentGradient: 'from-cyan-500 via-purple-600 to-pink-500',
    primaryTransition: 'flash',
    transitions: ['flash', 'shake', 'slide'],
    transitionStyle: 'neon_flash',
    hashtags: ['neonglow', 'cyberedit', 'phonk', 'vibereels'],
    previewColors: ['#090d24', '#0891b2', '#c026d3'],
    previewBadge: 'Flash & Shake FX',
  },
  {
    id: 'tpl-moose-wala-tribute',
    name: 'Sidhu Moose Wala Tribute Beat',
    tagline: 'Iconic 92 BPM tumbi & 808 tribute cuts with moody film grade & legacy lyrics.',
    category: 'bhangra_punjabi',
    categories: ['trending', 'bhangra_punjabi'],
    categoryLabel: 'Bhangra / Punjabi Vibe',
    durationSec: 12,
    bpm: 92,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 1,
    defaultOverlayText: 'LEGENDS NEVER DIE',
    defaultSecondaryText: 'Dil Da Ni Maada · Rest in Power 295',
    lyricLines: [
      'Dil Da Ni Maada · Rest in Power 295',
      'Sach Bolda Reha · Forever In Our Hearts',
      'Thapiyan Te Tumbi · Legend Forever',
    ],
    defaultAudioTrackId: 'song-moose-tribute',
    colorGradeName: 'Moody 295 Film',
    colorTintRgba: 'rgba(180, 83, 9, 0.15)',
    filterCss: 'contrast(1.22) saturate(0.9) brightness(0.94)',
    accentColor: '#f59e0b',
    accentGradient: 'from-amber-600 via-red-600 to-neutral-900',
    primaryTransition: 'shake',
    transitions: ['shake', 'zoom-in'],
    transitionStyle: 'bass_shake',
    hashtags: ['sidhumoosewala', '295', 'tribute', 'vibereels'],
    previewColors: ['#18100a', '#b45309', '#dc2626'],
    previewBadge: '295 Tribute · 808',
  },
  {
    id: 'tpl-neon-electric-slide',
    name: 'Neon Electric Flash Slide',
    tagline: 'Fast cyber slide transitions, beat strobe flashes & glowing neon edge halo.',
    category: 'neon_glow',
    categories: ['neon_glow', 'beat_sync'],
    categoryLabel: 'Neon Glow',
    durationSec: 9,
    bpm: 128,
    beatCutIntervalBeats: 2,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 1,
    defaultOverlayText: 'GLOW MOTION',
    defaultSecondaryText: 'Electric Slide · Cyber Beat Cuts',
    defaultAudioTrackId: 'beat-future-neon',
    colorGradeName: 'Cyber Neon',
    colorTintRgba: 'rgba(192, 38, 211, 0.14)',
    filterCss: 'contrast(1.22) saturate(1.42) brightness(1.02)',
    accentColor: '#d946ef',
    accentGradient: 'from-fuchsia-600 via-cyan-500 to-indigo-600',
    primaryTransition: 'slide',
    transitions: ['slide', 'flash', 'zoom-in'],
    transitionStyle: 'neon_flash',
    hashtags: ['neonglow', 'slideedit', 'beatsync', 'vibereels'],
    previewColors: ['#140829', '#c026d3', '#06b6d4'],
    previewBadge: 'Neon Slide · Flash',
  },
  {
    id: 'tpl-velvet-golden-slowmo',
    name: 'Velvet 0.65x Golden Slow-Mo',
    tagline: 'Silky 0.65x slow-mo velocity with smooth zoom-in & slide cross-motion.',
    category: 'slow_mo',
    categories: ['slow_mo', 'trending'],
    categoryLabel: 'Slow-Mo',
    durationSec: 14,
    bpm: 80,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.65,
    defaultOverlayText: 'GOLDEN HOUR',
    defaultSecondaryText: '0.65x Dreamy Velocity · Acoustic Vibe',
    defaultAudioTrackId: 'song-golden-sufi',
    colorGradeName: 'Golden Amber',
    colorTintRgba: 'rgba(245, 158, 11, 0.13)',
    filterCss: 'contrast(1.1) saturate(1.24) sepia(0.12) brightness(1.03)',
    accentColor: '#fbbf24',
    accentGradient: 'from-amber-500 via-rose-500 to-purple-600',
    primaryTransition: 'zoom-in',
    transitions: ['zoom-in', 'slide'],
    transitionStyle: 'ken_burns',
    hashtags: ['slowmo', 'goldenhour', 'aesthetic', 'vibereels'],
    previewColors: ['#221208', '#d97706', '#f43f5e'],
    previewBadge: '0.65x Velvet Slow-Mo',
  },
  {
    id: 'tpl-pind-folk-velocity',
    name: 'Pind Di Hawa Folk Slide',
    tagline: 'Warm Punjabi countryside vibe with folk dhol beat cuts & smooth slide wipes.',
    category: 'bhangra_punjabi',
    categories: ['bhangra_punjabi', 'slow_mo'],
    categoryLabel: 'Bhangra / Punjabi Vibe',
    durationSec: 12,
    bpm: 104,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.75,
    defaultOverlayText: 'PIND DI HAWA',
    defaultSecondaryText: 'Desi Folk Roots · Punjab Vibes',
    defaultAudioTrackId: 'song-pind-vibes',
    colorGradeName: 'Golden Amber',
    colorTintRgba: 'rgba(16, 185, 129, 0.08)',
    filterCss: 'contrast(1.14) saturate(1.22) brightness(1.02)',
    accentColor: '#10b981',
    accentGradient: 'from-emerald-500 via-amber-500 to-orange-500',
    primaryTransition: 'slide',
    transitions: ['slide', 'zoom-in'],
    transitionStyle: 'slide_wipe',
    hashtags: ['punjab', 'pind', 'bhangra', 'vibereels'],
    previewColors: ['#072219', '#059669', '#f59e0b'],
    previewBadge: 'Folk Slide · 0.75x',
  },
  {
    id: 'tpl-cinematic-drone-zoom',
    name: 'Cinematic Drone Slide & Zoom',
    tagline: 'Sweeping aerial zoom-in & slide cuts in 2.39:1 widescreen cinema letterbox.',
    category: 'trending',
    categories: ['trending', 'slow_mo'],
    categoryLabel: 'Trending',
    durationSec: 14,
    bpm: 78,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.85,
    defaultOverlayText: 'ABOVE THE CLOUDS',
    defaultSecondaryText: '35mm Aerial Cinema · Anamorphic Grade',
    defaultAudioTrackId: 'beat-cosmic-pulse',
    colorGradeName: 'Anamorphic Teal',
    colorTintRgba: 'rgba(56, 189, 248, 0.13)',
    filterCss: 'contrast(1.12) saturate(1.14) brightness(0.98)',
    accentColor: '#38bdf8',
    accentGradient: 'from-sky-500 via-indigo-500 to-purple-600',
    primaryTransition: 'zoom-in',
    transitions: ['zoom-in', 'slide'],
    transitionStyle: 'ken_burns',
    hashtags: ['dronezoom', 'cinematic', 'travel', 'vibereels'],
    previewColors: ['#0f172a', '#1d4ed8', '#38bdf8'],
    previewBadge: '2.39:1 Cinema',
  },
  {
    id: 'tpl-romantic-sad-lyrics',
    name: 'Romantic Sad Song Lyrics',
    tagline: 'Soulful acoustic strings with frosted lyric frame, soft flash & slow-mo zooms.',
    category: 'slow_mo',
    categories: ['slow_mo', 'trending'],
    categoryLabel: 'Slow-Mo',
    durationSec: 14,
    bpm: 82,
    beatCutIntervalBeats: 4,
    minClips: 1,
    maxClips: 5,
    aspectRatio: '9:16',
    defaultSpeedMultiplier: 0.8,
    defaultOverlayText: 'Tu Judaa Ho Ke Bhi',
    defaultSecondaryText: 'Khamoshiyan bhi aaj teri yaad dilati hain...',
    lyricLines: [
      'Khamoshiyan bhi aaj teri yaad dilati hain...',
      'Har saans mein bas tera hi naam aata hai...',
      'Kuch rishte toot kar bhi dil mein rehte hain...',
    ],
    defaultAudioTrackId: 'song-sad-lyrics',
    colorGradeName: 'Velvet Rose',
    colorTintRgba: 'rgba(168, 85, 247, 0.12)',
    filterCss: 'contrast(1.08) saturate(0.95) brightness(0.95)',
    accentColor: '#ec4899',
    accentGradient: 'from-purple-600 via-pink-500 to-rose-500',
    primaryTransition: 'zoom-in',
    transitions: ['zoom-in', 'flash'],
    transitionStyle: 'lyrics_frame',
    hashtags: ['sadlyrics', 'romanticsong', 'lofi', 'vibereels'],
    previewColors: ['#1c102b', '#7e22ce', '#ec4899'],
    previewBadge: 'Synced Lyrics',
  },
];

import { AudioTrackOption } from '../types';

export const CURATED_AUDIO_LIBRARY: AudioTrackOption[] = [
  {
    id: 'naat-hasbi-rabbi',
    title: 'Hasbi Rabbi Jallallah (Serene Naat Vibe)',
    artist: 'Madina Acoustics',
    category: 'naat',
    duration: '0:45',
    mood: 'Peaceful · Islamic · Naat',
    trackType: 'naat_serene',
  },
  {
    id: 'naat-ya-nabi',
    title: 'Ya Nabi Salam Alaika (Spiritual Chimes)',
    artist: 'Noor Harmonies',
    category: 'naat',
    duration: '0:50',
    mood: 'Devotional · Calm · Naat',
    trackType: 'naat_medina',
  },
  {
    id: 'naat-qasida-burda',
    title: 'Qasida Burda Reflection (Sufi Naat)',
    artist: 'Al-Qalb Ensemble',
    category: 'naat',
    duration: '0:40',
    mood: 'Spiritual · Sufi · Naat',
    trackType: 'naat_serene',
  },
  {
    id: 'naat-mustafa-jaan',
    title: 'Mustafa Jaan-e-Rehmat Ambient Hum',
    artist: 'Zikr Studio',
    category: 'naat',
    duration: '0:48',
    mood: 'Reverent · Soft · Naat',
    trackType: 'naat_medina',
  },
  {
    id: 'song-moose-tribute',
    title: '295 Legend Tribute Beat (Tumbi & 808)',
    artist: 'Moose Heritage Beats',
    category: 'song',
    duration: '0:36',
    mood: 'Legend · Tumbi · 808 Tribute',
    trackType: 'punjabi_tribute',
  },
  {
    id: 'song-jatt-swag',
    title: 'Jatt Da Swag (Punjabi Dhol Anthem)',
    artist: 'Jatt Beats Official',
    category: 'song',
    duration: '0:35',
    mood: 'Desi · Bhangra · Punjabi Song',
    trackType: 'punjabi_dhol',
  },
  {
    id: 'song-sad-lyrics',
    title: 'Tu Judaa (Romantic Sad Song Lyrics)',
    artist: 'Lahore Soul Strings',
    category: 'song',
    duration: '0:44',
    mood: 'Romantic · Sad · Lyrics',
    trackType: 'sufi_acoustic',
  },
  {
    id: 'song-lahore-nights',
    title: 'Lahore Midnight Lo-Fi',
    artist: 'Sufi Waves',
    category: 'song',
    duration: '0:42',
    mood: 'Chill · Pakistani · Lo-Fi Song',
    trackType: 'ambient_lofi',
  },
  {
    id: 'song-golden-sufi',
    title: 'Ishq Sufiyana (Acoustic Strings)',
    artist: 'Ruhani Strings',
    category: 'song',
    duration: '0:46',
    mood: 'Sufi · Romantic · Song',
    trackType: 'sufi_acoustic',
  },
  {
    id: 'song-pind-vibes',
    title: 'Pind Di Hawa (Folk Strings)',
    artist: 'Punjab Folk Collective',
    category: 'song',
    duration: '0:38',
    mood: 'Punjabi · Folk · Song',
    trackType: 'punjabi_dhol',
  },
  {
    id: 'song-gabru-anthem',
    title: 'Sher Punjabi (Royal Dhol & Bass)',
    artist: 'Jatt VibeReels Studio',
    category: 'song',
    duration: '0:34',
    mood: 'Trending · Attitude · Punjabi',
    trackType: 'punjabi_tribute',
  },
  {
    id: 'song-chan-channi',
    title: 'Chan Channi Raat (Sufi Vibe)',
    artist: 'Desi Acoustic Club',
    category: 'song',
    duration: '0:42',
    mood: 'Trending · Chill · Punjabi Song',
    trackType: 'sufi_acoustic',
  },
  {
    id: 'beat-future-neon',
    title: 'Neon Cyberpunk Bass',
    artist: 'Jatt VibeReels Studio',
    category: 'beat',
    duration: '0:30',
    mood: 'Trap · Future Bass · Edit',
    trackType: 'future_bass',
  },
  {
    id: 'beat-tokyo-drift',
    title: 'Tokyo Drift Phonk',
    artist: 'Night Runner',
    category: 'beat',
    duration: '0:32',
    mood: 'High Energy · Car Reel · Beat',
    trackType: 'tokyo_drift',
  },
  {
    id: 'beat-chill-synth',
    title: 'Sunset Synthwave',
    artist: 'Aesthetic Audio',
    category: 'beat',
    duration: '0:40',
    mood: 'Retro · Travel · Beat',
    trackType: 'chill_synth',
  },
  {
    id: 'beat-cosmic-pulse',
    title: 'Cosmic Horizon Pulse',
    artist: 'Deep Space FX',
    category: 'beat',
    duration: '0:45',
    mood: 'Cinematic · Motivation · Beat',
    trackType: 'cosmic_pulse',
  },
];

export function searchAudioLibrary(
  query: string,
  category: 'all' | 'naat' | 'song' | 'beat' = 'all'
): AudioTrackOption[] {
  const q = query.trim().toLowerCase();
  return CURATED_AUDIO_LIBRARY.filter((track) => {
    if (category !== 'all' && track.category !== category) return false;
    if (!q) return true;
    return (
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.mood.toLowerCase().includes(q) ||
      track.category.toLowerCase().includes(q)
    );
  });
}

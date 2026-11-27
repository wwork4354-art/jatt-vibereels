import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Music,
  Play,
  Pause,
  Check,
  Sparkles,
  FileAudio,
  Upload,
  Loader2,
  Globe,
  Flame,
} from 'lucide-react';
import { AudioTrackOption } from '../types';
import { searchAudioLibrary } from '../data/audioLibrary';
import { soundEngine } from '../utils/soundEngine';
import { getIsRamSaverMode } from '../lib/ramSaverMode';
import { sanitizeInputLive, validateSafeAudioFile } from '../utils/security';
import {
  OnlineSongResult,
  resolveOnlineAudioStreamUrl,
  searchOnlineSongs,
} from '../utils/onlineAudioSearch';

export type MusicDrawerTab = 'online' | 'trending' | 'device';

export interface AttachedOnlineSong {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  durationLabel: string;
  durationSeconds?: number;
  streamUrl?: string | null;
}

interface StudioMusicPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: MusicDrawerTab;
  selectedLibraryTrack: AudioTrackOption | null;
  selectedAudioFile: File | null;
  selectedAudioPreviewUrl: string | null;
  selectedOnlineSong: AttachedOnlineSong | null;
  volume: number;
  onAttachLibraryTrack: (track: AudioTrackOption) => void;
  onAttachDeviceFile: (file: File, objectUrl: string, durationSec?: number) => void;
  onAttachOnlineSong: (song: AttachedOnlineSong) => void;
  onShowToast?: (msg: string) => void;
}

const QUICK_ONLINE_QUERIES = [
  'Punjabi Hits 2025',
  'Hindi Bollywood Songs',
  'Urdu Ghazal & Naat',
  'English Pop Hits',
  'Arabic Remix',
  'Turkish Phonk',
  'Spanish Latin Hits',
  'Bhangra Dhol Beat',
];

const FEATURED_BEAT_IDS = new Set([
  'beat-bhangra-drop',
  'beat-lofi-chill',
  'beat-cinematic-bass',
  'beat-phonk-drift',
]);

export const StudioMusicPickerDrawer: React.FC<StudioMusicPickerDrawerProps> = React.memo(
  ({
    isOpen,
    onClose,
    initialTab = 'online',
    selectedLibraryTrack,
    selectedAudioFile,
    selectedAudioPreviewUrl,
    selectedOnlineSong,
    volume,
    onAttachLibraryTrack,
    onAttachDeviceFile,
    onAttachOnlineSong,
    onShowToast,
  }) => {
    const isRamSaver = getIsRamSaverMode();
    const [activeTab, setActiveTab] = useState<MusicDrawerTab>(initialTab);

    // Search Songs Online state
    const [onlineQuery, setOnlineQuery] = useState('Punjabi trending songs');
    const [onlineResults, setOnlineResults] = useState<OnlineSongResult[]>([]);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);
    const [onlineError, setOnlineError] = useState('');
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    const [fallbackEmbedVideoId, setFallbackEmbedVideoId] = useState<string | null>(null);

    // Trending Sounds filter state
    const [trendingSearch, setTrendingSearch] = useState('');
    const [trendingCategory, setTrendingCategory] = useState<'all' | 'beat' | 'song' | 'naat'>('all');

    const drawerAudioRef = useRef<HTMLAudioElement | null>(null);
    const deviceFileInputRef = useRef<HTMLInputElement | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    const stopDrawerPreviews = () => {
      soundEngine.stopPreviewTrack();
      if (drawerAudioRef.current) {
        drawerAudioRef.current.pause();
      }
      setPreviewingId(null);
      setFallbackEmbedVideoId(null);
    };

    useEffect(() => {
      if (isOpen) {
        setActiveTab(initialTab);
      } else {
        stopDrawerPreviews();
        searchAbortRef.current?.abort();
      }
    }, [isOpen, initialTab]);

    useEffect(() => {
      if (!isOpen) return;
      const handleBackground = () => stopDrawerPreviews();
      const handleVisibility = () => {
        if (document.hidden || document.visibilityState === 'hidden') {
          stopDrawerPreviews();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      document.addEventListener('freeze', handleBackground as EventListener);
      window.addEventListener('pagehide', handleBackground);
      window.addEventListener('blur', handleBackground);
      window.addEventListener('jatt-app-backgrounded', handleBackground as EventListener);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.removeEventListener('freeze', handleBackground as EventListener);
        window.removeEventListener('pagehide', handleBackground);
        window.removeEventListener('blur', handleBackground);
        window.removeEventListener('jatt-app-backgrounded', handleBackground as EventListener);
      };
    }, [isOpen]);

    // Auto-run initial lightweight search when opening Online tab with empty list
    useEffect(() => {
      if (isOpen && activeTab === 'online' && onlineResults.length === 0 && !isSearchingOnline) {
        void runOnlineSearch(onlineQuery);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, activeTab]);

    useEffect(() => {
      if (drawerAudioRef.current) {
        drawerAudioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      }
    }, [volume]);

    const runOnlineSearch = async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) return;

      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setIsSearchingOnline(true);
      setOnlineError('');

      try {
        const results = await searchOnlineSongs(trimmed, controller.signal);
        if (!controller.signal.aborted) {
          setOnlineResults(results);
          if (results.length === 0) {
            setOnlineError('No matching songs found. Try another keyword or switch to Trending Sounds.');
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setOnlineError('Online song search paused. Check internet or pick a Trending Sound.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingOnline(false);
        }
      }
    };

    const filteredTrending = useMemo(
      () => searchAudioLibrary(trendingSearch, trendingCategory),
      [trendingSearch, trendingCategory]
    );

    const featuredTrendingBeats = useMemo(
      () => searchAudioLibrary('', 'beat').filter((t) => FEATURED_BEAT_IDS.has(t.id)),
      []
    );

    const handlePreviewOnlineSong = async (song: OnlineSongResult) => {
      if (previewingId === song.id) {
        stopDrawerPreviews();
        return;
      }

      stopDrawerPreviews();
      setResolvingId(song.id);

      try {
        const streamUrl = song.streamUrl || (await resolveOnlineAudioStreamUrl(song.videoId));
        if (streamUrl && drawerAudioRef.current) {
          song.streamUrl = streamUrl;
          drawerAudioRef.current.src = streamUrl;
          drawerAudioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
          await drawerAudioRef.current.play();
          setPreviewingId(song.id);
        } else {
          // Graceful YouTube embed audio preview fallback when direct CORS audio extraction isn't reachable
          setFallbackEmbedVideoId(song.videoId);
          setPreviewingId(song.id);
        }
      } catch {
        setFallbackEmbedVideoId(song.videoId);
        setPreviewingId(song.id);
      } finally {
        setResolvingId(null);
      }
    };

    const handleUseOnlineSong = async (song: OnlineSongResult) => {
      setResolvingId(song.id);
      let resolvedUrl = song.streamUrl || null;
      if (!resolvedUrl) {
        resolvedUrl = await Promise.race([
          resolveOnlineAudioStreamUrl(song.videoId).catch(() => null),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1100)),
        ]);
      }
      setResolvingId(null);
      stopDrawerPreviews();

      onAttachOnlineSong({
        id: song.id,
        videoId: song.videoId,
        title: song.title,
        artist: song.artist,
        durationLabel: song.durationLabel,
        durationSeconds: song.durationSeconds,
        streamUrl: resolvedUrl,
      });
      onShowToast?.(`Attached "${song.title}" to Audio Track`);
      onClose();
    };

    const handlePreviewTrendingTrack = (track: AudioTrackOption) => {
      if (previewingId === track.id) {
        stopDrawerPreviews();
        return;
      }
      stopDrawerPreviews();
      soundEngine.playPreviewTrack(track.trackType, Math.max(0.2, volume / 100));
      setPreviewingId(track.id);
    };

    const handleUseTrendingTrack = (track: AudioTrackOption) => {
      stopDrawerPreviews();
      onAttachLibraryTrack(track);
      onShowToast?.(`Attached "${track.title}" to Audio Track`);
      onClose();
    };

    const handlePickDeviceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      const check = validateSafeAudioFile(file);
      if (!check.valid) {
        onShowToast?.(check.reason || 'Only .mp3, .m4a, .wav, and .ogg files are supported.');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      stopDrawerPreviews();

      // Probe duration quickly for start-trim slider bounds
      const probe = new Audio(objectUrl);
      probe.onloadedmetadata = () => {
        const dur = Number.isFinite(probe.duration) ? probe.duration : undefined;
        onAttachDeviceFile(file, objectUrl, dur);
        onShowToast?.(`Added "${file.name}" to Audio Track`);
        onClose();
      };
      probe.onerror = () => {
        onAttachDeviceFile(file, objectUrl);
        onShowToast?.(`Added "${file.name}" to Audio Track`);
        onClose();
      };
    };

    const handlePreviewDeviceAudio = () => {
      if (!selectedAudioPreviewUrl || !drawerAudioRef.current) return;
      if (previewingId === 'device-file') {
        stopDrawerPreviews();
        return;
      }
      stopDrawerPreviews();
      drawerAudioRef.current.src = selectedAudioPreviewUrl;
      drawerAudioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      void drawerAudioRef.current.play().catch(() => {});
      setPreviewingId('device-file');
    };

    if (!isOpen) return null;

    return (
      <div
        className={`fixed inset-0 z-60 bg-black/75 flex items-end justify-center ${
          isRamSaver ? '' : 'backdrop-blur-xs'
        }`}
        onClick={() => {
          stopDrawerPreviews();
          onClose();
        }}
      >
        <audio
          ref={drawerAudioRef}
          crossOrigin="anonymous"
          onEnded={() => setPreviewingId(null)}
          className="hidden"
        />

        <input
          ref={deviceFileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
          className="hidden"
          onChange={handlePickDeviceFile}
        />

        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-[#0e0e16] border-t border-x border-neutral-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[82vh] animate-in slide-in-from-bottom-6 duration-200"
        >
          {/* Drawer Handle & Header */}
          <div className="shrink-0 px-4 pt-3 pb-2.5 border-b border-neutral-800/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-cyan-500 flex items-center justify-center shadow-md">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white leading-tight">
                  CapCut Music &amp; Sound Picker
                </h3>
                <p className="text-[10px] text-neutral-400">
                  Search global tracks, pick trending beats, or import MP3
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                stopDrawerPreviews();
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center cursor-pointer"
              aria-label="Close music picker"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Drawer Navigation Tabs */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 grid grid-cols-3 gap-1.5 bg-[#0b0b11] border-b border-neutral-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('online')}
              className={`min-h-[38px] px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-pink-600/25 border-pink-500 text-white'
                  : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="truncate">Search Songs Online</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trending')}
              className={`min-h-[38px] px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'trending'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                  : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Trending Sounds</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('device')}
              className={`min-h-[38px] px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'device'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                  : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">My Device (MP3)</span>
            </button>
          </div>

          {/* Drawer Tab Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3 no-scrollbar">
            {/* TAB A: SEARCH SONGS ONLINE */}
            {activeTab === 'online' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runOnlineSearch(onlineQuery);
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={onlineQuery}
                      onChange={(e) => setOnlineQuery(sanitizeInputLive(e.target.value, 90))}
                      placeholder="Search any song worldwide (Punjabi, Urdu, Hindi, English, Arabic, Turkish, Spanish...)"
                      className="w-full min-h-[40px] bg-neutral-900 border border-neutral-800 focus:border-pink-500 rounded-xl pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingOnline || !onlineQuery.trim()}
                    className="min-h-[40px] px-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isSearchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Search</span>
                  </button>
                </form>

                {/* Quick Query Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {QUICK_ONLINE_QUERIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setOnlineQuery(q);
                        void runOnlineSearch(q);
                      }}
                      className="px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-bold text-neutral-300 hover:text-white whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Inline fallback YouTube audio preview player (only mounted if CORS audio stream wasn't directly playable) */}
                {fallbackEmbedVideoId && (
                  <div className="rounded-2xl overflow-hidden border border-pink-500/40 bg-black p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-pink-300 font-bold px-1">
                      <span>Playing Online Preview</span>
                      <button
                        type="button"
                        onClick={() => stopDrawerPreviews()}
                        className="text-neutral-400 hover:text-white cursor-pointer"
                      >
                        Stop
                      </button>
                    </div>
                    <iframe
                      title="Song Audio Preview"
                      loading="lazy"
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                        fallbackEmbedVideoId
                      )}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                      allow="autoplay; encrypted-media"
                      className="w-full h-16 rounded-xl border-0"
                    />
                  </div>
                )}

                {onlineError && onlineResults.length === 0 && !isSearchingOnline && (
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 text-center">
                    {onlineError}
                  </div>
                )}

                <div className="space-y-2">
                  {onlineResults.map((song) => {
                    const isSelected = selectedOnlineSong?.videoId === song.videoId;
                    const isPreviewing = previewingId === song.id;
                    const isBusy = resolvingId === song.id;

                    return (
                      <div
                        key={song.id}
                        className={`p-2 rounded-2xl border flex items-center gap-2.5 transition-colors ${
                          isSelected
                            ? 'bg-pink-600/15 border-pink-500/60'
                            : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-950 shrink-0">
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => void handlePreviewOnlineSong(song)}
                            disabled={isBusy}
                            className="absolute inset-0 bg-black/45 hover:bg-black/60 flex items-center justify-center text-white cursor-pointer"
                            aria-label={isPreviewing ? 'Pause preview' : 'Play preview'}
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                            ) : isPreviewing ? (
                              <Pause className="w-4 h-4 fill-white" />
                            ) : (
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{song.title}</p>
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                            {song.artist} · <span className="text-cyan-300 font-semibold">{song.durationLabel}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleUseOnlineSong(song)}
                          disabled={isBusy}
                          className={`min-h-[36px] px-3 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0 transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-black'
                              : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Attached</span>
                            </>
                          ) : (
                            <span>Use Song</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB B: TRENDING SOUNDS */}
            {activeTab === 'trending' && (
              <div className="space-y-3">
                {/* Highlighted CapCut Viral Beats Strip */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Quick Viral Beats (Copyright-Free)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {featuredTrendingBeats.map((beat) => {
                      const isSel = selectedLibraryTrack?.id === beat.id;
                      return (
                        <button
                          key={beat.id}
                          type="button"
                          onClick={() => handleUseTrendingTrack(beat)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSel
                              ? 'bg-pink-600/20 border-pink-400 text-white'
                              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-200'
                          }`}
                        >
                          <p className="text-xs font-black truncate">{beat.title}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{beat.duration}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter + Search */}
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trendingSearch}
                      onChange={(e) => setTrendingSearch(sanitizeInputLive(e.target.value, 60))}
                      placeholder="Filter beats, Punjabi tracks, naats..."
                      className="w-full min-h-[36px] bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 text-xs text-white focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                  <div className="flex gap-1 text-[10px] font-bold">
                    {(['all', 'beat', 'song', 'naat'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTrendingCategory(cat)}
                        className={`px-2.5 py-1.5 rounded-xl border capitalize cursor-pointer ${
                          trendingCategory === cat
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {filteredTrending.map((track) => {
                    const selected = selectedLibraryTrack?.id === track.id;
                    const isPreviewing = previewingId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 ${
                          selected
                            ? 'bg-pink-600/15 border-pink-500'
                            : 'bg-neutral-900/80 border-neutral-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handlePreviewTrendingTrack(track)}
                          className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label={isPreviewing ? 'Pause track' : 'Preview track'}
                        >
                          {isPreviewing ? (
                            <Pause className="w-4 h-4 fill-white text-pink-400" />
                          ) : (
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{track.title}</p>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {track.artist} · {track.duration} · {track.mood}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUseTrendingTrack(track)}
                          className={`min-h-[34px] px-3 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0 ${
                            selected
                              ? 'bg-emerald-500 text-black'
                              : 'bg-pink-600 hover:bg-pink-500 text-white'
                          }`}
                        >
                          {selected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </>
                          ) : (
                            <span>Use Song</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB C: MY DEVICE (MP3 / AUDIO) */}
            {activeTab === 'device' && (
              <div className="space-y-4">
                <div
                  onClick={() => deviceFileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-700 hover:border-cyan-400 rounded-2xl p-6 bg-neutral-900/60 hover:bg-cyan-950/15 text-center space-y-3 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">
                      Upload Audio from Phone or PC
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Supports .mp3, .m4a, .wav, and .ogg audio files directly onto your timeline
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-black">
                    <FileAudio className="w-4 h-4" />
                    <span>{selectedAudioFile ? 'Choose Different Song' : 'Browse MP3 / Audio'}</span>
                  </span>
                </div>

                {selectedAudioFile && (
                  <div className="p-3 rounded-2xl bg-neutral-900 border border-cyan-500/45 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={handlePreviewDeviceAudio}
                      className="w-10 h-10 rounded-xl bg-cyan-500 text-black flex items-center justify-center shrink-0 cursor-pointer"
                      aria-label={previewingId === 'device-file' ? 'Pause audio' : 'Play audio'}
                    >
                      {previewingId === 'device-file' ? (
                        <Pause className="w-4 h-4 fill-black" />
                      ) : (
                        <Play className="w-4 h-4 fill-black ml-0.5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">
                        {selectedAudioFile.name}
                      </p>
                      <p className="text-[10px] text-cyan-300">
                        Attached to Audio Timeline Track
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-[11px] font-black cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

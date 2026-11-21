import { sanitizeText } from './security';

export interface OnlineSongResult {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  durationLabel: string;
  durationSeconds?: number;
  thumbnailUrl: string;
  streamUrl?: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseIso8601Duration(iso?: string): number | undefined {
  if (!iso || typeof iso !== 'string') return undefined;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  const hrs = Number(match[1] || 0);
  const mins = Number(match[2] || 0);
  const secs = Number(match[3] || 0);
  const total = hrs * 3600 + mins * 60 + secs;
  return total > 0 ? total : undefined;
}

export function formatSongDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:30';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function fetchWithTimeout(
  url: string,
  ms = 5500,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Searches worldwide songs, beats, dialogues & Punjabi tracks using:
 * 1) YouTube Data API v3 (if configured via VITE_YOUTUBE_API_KEY / localStorage)
 * 2) Public Invidious & Piped API fallbacks (max 10 results for 3GB RAM efficiency)
 */
export async function searchOnlineSongs(
  rawQuery: string,
  signal?: AbortSignal
): Promise<OnlineSongResult[]> {
  const query = sanitizeText(rawQuery, 100);
  if (!query) return [];

  const effectiveKey = (
    (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('jatt_youtube_api_key') : '') ||
    ''
  ).trim();

  // Tier 1: Official YouTube Data API v3 + videos?part=contentDetails,snippet
  if (effectiveKey) {
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&type=video&safeSearch=strict&videoEmbeddable=true&q=${encodeURIComponent(
        query
      )}&key=${encodeURIComponent(effectiveKey)}`;
      const res = await fetchWithTimeout(searchUrl, 6000, signal);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items.filter((it: any) => it?.id?.videoId).slice(0, 10)
          : [];
        if (items.length > 0) {
          const ids = items.map((it: any) => it.id.videoId as string);
          const durations: Record<string, number | undefined> = {};
          try {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(
              ids.join(',')
            )}&key=${encodeURIComponent(effectiveKey)}`;
            const detRes = await fetchWithTimeout(detailsUrl, 4500, signal);
            if (detRes.ok) {
              const detData = await detRes.json();
              if (Array.isArray(detData?.items)) {
                for (const v of detData.items) {
                  if (v?.id) {
                    durations[v.id] = parseIso8601Duration(v.contentDetails?.duration);
                  }
                }
              }
            }
          } catch {
            // proceed with snippet results
          }

          return items.map((it: any) => {
            const vidId = it.id.videoId as string;
            const secs = durations[vidId];
            return {
              id: `yt-song-${vidId}`,
              videoId: vidId,
              title: decodeHtmlEntities(it.snippet?.title || 'Online Track'),
              artist: decodeHtmlEntities(it.snippet?.channelTitle || 'YouTube Music'),
              durationSeconds: secs,
              durationLabel: formatSongDuration(secs),
              thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
            };
          });
        }
      }
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }

  // Tier 2: Public Invidious instances (raced in parallel for fast worldwide multi-language results)
  const invidiousUrls = [
    `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
    `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
    `https://yewtu.be/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
  ];

  try {
    const invidiousResult = await Promise.any(
      invidiousUrls.map(async (endpoint) => {
        if (signal?.aborted) throw new Error('aborted');
        const res = await fetchWithTimeout(endpoint, 4200, signal);
        if (!res.ok) throw new Error('bad status');
        const list = await res.json();
        if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
        const mapped: OnlineSongResult[] = list
          .filter((item: any) => item?.videoId && (item.type === 'video' || !item.type))
          .slice(0, 10)
          .map((item: any) => {
            const vidId = item.videoId as string;
            const secs = typeof item.lengthSeconds === 'number' ? item.lengthSeconds : undefined;
            return {
              id: `yt-song-${vidId}`,
              videoId: vidId,
              title: decodeHtmlEntities(item.title || 'Online Track'),
              artist: decodeHtmlEntities(item.author || 'Online Artist'),
              durationSeconds: secs,
              durationLabel: formatSongDuration(secs),
              thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
            };
          });
        if (mapped.length === 0) throw new Error('empty');
        return mapped;
      })
    );
    if (invidiousResult.length > 0) return invidiousResult;
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // Tier 3: Public Piped music & video search instances (raced in parallel)
  const pipedUrls = [
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=all`,
    `https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=all`,
  ];

  try {
    const pipedResult = await Promise.any(
      pipedUrls.map(async (endpoint) => {
        if (signal?.aborted) throw new Error('aborted');
        const res = await fetchWithTimeout(endpoint, 4200, signal);
        if (!res.ok) throw new Error('bad status');
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const mapped: OnlineSongResult[] = items
          .filter((it: any) => typeof it?.url === 'string' && it.url.includes('v='))
          .slice(0, 10)
          .map((it: any) => {
            const match = (it.url as string).match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            const vidId = match ? match[1] : '';
            const secs = typeof it.duration === 'number' && it.duration > 0 ? it.duration : undefined;
            return {
              id: `yt-song-${vidId}`,
              videoId: vidId,
              title: decodeHtmlEntities(it.title || 'Online Track'),
              artist: decodeHtmlEntities(it.uploaderName || 'YouTube Audio'),
              durationSeconds: secs,
              durationLabel: formatSongDuration(secs),
              thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`,
            };
          })
          .filter((r: OnlineSongResult) => Boolean(r.videoId));
        if (mapped.length === 0) throw new Error('empty');
        return mapped;
      })
    );
    if (pipedResult.length > 0) return pipedResult;
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  return [];
}

/**
 * Resolves a direct playable HTML5 audio-only stream URL for an online YouTube track
 * via parallel Piped / Invidious endpoints (fast 2.4s timeout, graceful fallback to null).
 */
export async function resolveOnlineAudioStreamUrl(
  videoId: string,
  signal?: AbortSignal
): Promise<string | null> {
  const pipedStreamEndpoints = [
    `https://pipedapi.kavin.rocks/streams/${encodeURIComponent(videoId)}`,
    `https://pipedapi.adminforge.de/streams/${encodeURIComponent(videoId)}`,
  ];

  const invidiousStreamEndpoints = [
    `https://inv.nadeko.net/api/v1/videos/${encodeURIComponent(videoId)}`,
    `https://invidious.nerdvpn.de/api/v1/videos/${encodeURIComponent(videoId)}`,
  ];

  const pipedPromises = pipedStreamEndpoints.map(async (url) => {
    if (signal?.aborted) throw new Error('aborted');
    const res = await fetchWithTimeout(url, 2400, signal);
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const audioStreams: any[] = Array.isArray(data?.audioStreams) ? data.audioStreams : [];
    const preferred =
      audioStreams.find((s) => typeof s?.mimeType === 'string' && s.mimeType.includes('audio/mp4') && s.url) ||
      audioStreams.find((s) => typeof s?.url === 'string' && s.url.startsWith('http'));
    if (preferred?.url) return preferred.url as string;
    throw new Error('no stream');
  });

  const invidiousPromises = invidiousStreamEndpoints.map(async (url) => {
    if (signal?.aborted) throw new Error('aborted');
    const res = await fetchWithTimeout(url, 2400, signal);
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const formats: any[] = Array.isArray(data?.adaptiveFormats) ? data.adaptiveFormats : [];
    const audioFmt =
      formats.find((f) => typeof f?.type === 'string' && f.type.startsWith('audio/mp4') && f.url) ||
      formats.find((f) => typeof f?.type === 'string' && f.type.startsWith('audio/') && f.url);
    if (audioFmt?.url) return audioFmt.url as string;
    throw new Error('no stream');
  });

  try {
    return await Promise.any([...pipedPromises, ...invidiousPromises]);
  } catch {
    return null;
  }
}

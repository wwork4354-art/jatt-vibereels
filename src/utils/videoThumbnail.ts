/**
 * Video Thumbnail Cache & Frame Extractor
 * Prevents black or broken video thumbnails across Feed, Profile Grid, and Insights
 * by appending #t=0.5 preview fragments and extracting non-black JPEG frames safely.
 */

const MAX_CACHE_ENTRIES = 250;
const frameThumbnailCache = new Map<string, string>();

export function getCachedVideoThumbnail(videoUrl?: string): string {
  if (!videoUrl) return '';
  return frameThumbnailCache.get(videoUrl) || '';
}

export function setCachedVideoThumbnail(videoUrl: string, dataUrl: string): void {
  if (!videoUrl || !dataUrl) return;
  if (frameThumbnailCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = frameThumbnailCache.keys().next().value;
    if (oldestKey) {
      frameThumbnailCache.delete(oldestKey);
    }
  }
  frameThumbnailCache.set(videoUrl, dataUrl);
}

/**
 * Appends `#t=0.5` media fragment so browsers decode a real visible frame instead of frame 0 (often black).
 */
export function appendMediaTimeFragment(rawUrl?: string, seconds = 0.5): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || trimmed.includes('#')) {
    return trimmed;
  }
  return `${trimmed}#t=${seconds}`;
}

/**
 * Checks whether a small canvas buffer is virtually pure black so we skip saving black frames.
 */
function isCanvasVirtuallyBlack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  try {
    const sampleW = Math.min(16, Math.max(1, width));
    const sampleH = Math.min(16, Math.max(1, height));
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    let brightPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = data[i] + data[i + 1] + data[i + 2];
      if (luma > 28) {
        brightPixels++;
        if (brightPixels >= 3) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts a compact JPEG thumbnail from a ready HTMLVideoElement.
 * Safely handles CORS-tainted videos by returning null without throwing.
 */
export function captureVideoFrameDataUrl(
  videoEl: HTMLVideoElement | null,
  maxWidth = 360
): string | null {
  if (!videoEl || videoEl.readyState < 2) return null;
  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (vw <= 0 || vh <= 0) return null;

  const scale = Math.min(1, maxWidth / vw);
  const w = Math.max(16, Math.round(vw * scale));
  const h = Math.max(16, Math.round(vh * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(videoEl, 0, 0, w, h);

    if (isCanvasVirtuallyBlack(ctx, w, h)) {
      return null;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    return dataUrl && dataUrl.startsWith('data:image/jpeg') ? dataUrl : null;
  } catch {
    // Tainted cross-origin media cannot be exported via canvas; caller keeps <video #t=0.5> visible
    return null;
  }
}

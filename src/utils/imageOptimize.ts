/**
 * Lightweight thumbnail & image compression utilities for 60fps feeds & instant grid loads.
 */

export function optimizeThumbnailUrl(url?: string, mode: 'grid' | 'hero' = 'grid'): string {
  if (!url || typeof url !== 'string') return '';

  // Optimize YouTube thumbnails: mqdefault (320x180, ~9KB) for grid cards, hqdefault for hero
  if (url.includes('i.ytimg.com/vi/')) {
    if (mode === 'grid') {
      return url.replace(/\/(maxresdefault|sddefault|hqdefault)\.(jpg|webp)/i, '/mqdefault.jpg');
    }
    return url.replace(/\/maxresdefault\.(jpg|webp)/i, '/hqdefault.jpg');
  }

  // Optimize Unsplash image sizes & quality for fast mobile decoding
  if (url.includes('images.unsplash.com/photo-')) {
    const targetW = mode === 'grid' ? '480' : '720';
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('w', targetW);
      parsed.searchParams.set('q', mode === 'grid' ? '70' : '78');
      return parsed.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export function compressImageFile(
  file: File,
  maxDim = 1080,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        // Skip re-encoding if already small and under 220KB
        if (scale === 1 && file.size < 220_000) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const cleanBase = file.name.replace(/\.[^/.]+$/, '');
            resolve(new File([blob], `${cleanBase}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

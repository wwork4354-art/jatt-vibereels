/**
 * Tracks created blob: URLs and revokes unused ones when scrolling away or unmounting
 * to keep memory flat on 3GB RAM Android devices.
 */

interface TrackedBlobEntry {
  url: string;
  postId: string;
  createdAt: number;
}

const trackedPostBlobs = new Map<string, Set<string>>();
const cloudFallbackUrlByPost = new Map<string, string>();
const blobRegistry = new Map<string, TrackedBlobEntry>();

export function registerPostBlobUrl(postId: string, url?: string | null): void {
  if (!url || !url.startsWith('blob:')) return;
  let set = trackedPostBlobs.get(postId);
  if (!set) {
    set = new Set<string>();
    trackedPostBlobs.set(postId, set);
  }
  set.add(url);
  blobRegistry.set(url, { url, postId, createdAt: Date.now() });
}

export function registerPostCloudUrl(postId: string, cloudUrl?: string | null): void {
  if (!cloudUrl || cloudUrl.startsWith('blob:') || cloudUrl.startsWith('data:')) return;
  cloudFallbackUrlByPost.set(postId, cloudUrl);
}

export function getRegisteredCloudUrl(postId: string): string | undefined {
  return cloudFallbackUrlByPost.get(postId);
}

export function safeRevokeBlobUrl(url?: string | null): void {
  if (!url || !url.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore invalid/already-revoked blob errors
  }
  const entry = blobRegistry.get(url);
  if (entry) {
    const set = trackedPostBlobs.get(entry.postId);
    set?.delete(url);
    if (set && set.size === 0) {
      trackedPostBlobs.delete(entry.postId);
    }
    blobRegistry.delete(url);
  }
}

export function revokeBlobsForPost(postId: string): void {
  const set = trackedPostBlobs.get(postId);
  if (!set) return;
  for (const url of Array.from(set)) {
    safeRevokeBlobUrl(url);
  }
  trackedPostBlobs.delete(postId);
}

export function pruneOrphanedBlobs(activeKeepIds: Set<string>): number {
  let revoked = 0;
  for (const [postId, urls] of Array.from(trackedPostBlobs.entries())) {
    if (!activeKeepIds.has(postId)) {
      for (const url of Array.from(urls)) {
        safeRevokeBlobUrl(url);
        revoked += 1;
      }
      trackedPostBlobs.delete(postId);
    }
  }
  return revoked;
}

export function getTrackedBlobCount(): number {
  return blobRegistry.size;
}

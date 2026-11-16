import { VideoPost } from '../types';

export type OfflineSourceType = 'downloaded' | 'saved' | 'uploaded' | 'recorded';

export interface OfflineMediaRecord {
  id: string;
  post: VideoPost;
  mediaBlob?: Blob;
  audioBlob?: Blob;
  savedAt: string;
  sizeBytes: number;
  sourceType: OfflineSourceType;
}

export const OFFLINE_STORE_EVENT = 'jatt-offline-store-updated';

const DB_NAME = 'jatt-vibereels-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_media';

function emitStoreUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_STORE_EVENT));
  }
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function fetchBlobQuiet(url?: string): Promise<Blob | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return blob.size > 0 ? blob : undefined;
  } catch {
    return undefined;
  }
}

export async function getOfflineMediaRecord(postId: string): Promise<OfflineMediaRecord | null> {
  try {
    const db = await openOfflineDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(postId);
      req.onsuccess = () => resolve((req.result as OfflineMediaRecord) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllOfflineSavedPosts(): Promise<OfflineMediaRecord[]> {
  try {
    const db = await openOfflineDB();
    const list = await new Promise<OfflineMediaRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OfflineMediaRecord[]) || []);
      req.onerror = () => resolve([]);
    });
    return list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

export async function savePostForOffline(
  post: VideoPost,
  options?: {
    mediaBlob?: Blob;
    audioBlob?: Blob;
    sourceType?: OfflineSourceType;
    skipRemoteFetch?: boolean;
  }
): Promise<OfflineMediaRecord | null> {
  try {
    const existing = await getOfflineMediaRecord(post.id);

    let mediaBlob = options?.mediaBlob || existing?.mediaBlob;
    if (!mediaBlob && !options?.skipRemoteFetch && post.videoUrl) {
      mediaBlob = await fetchBlobQuiet(post.videoUrl);
    }

    let audioBlob = options?.audioBlob || existing?.audioBlob;
    if (!audioBlob && !options?.skipRemoteFetch && post.sound?.audioUrl) {
      audioBlob = await fetchBlobQuiet(post.sound.audioUrl);
    }

    const sizeBytes = (mediaBlob?.size || 0) + (audioBlob?.size || 0);
    const cleanPost: VideoPost = {
      ...post,
      isSaved: post.isSaved || options?.sourceType === 'saved',
    };

    const record: OfflineMediaRecord = {
      id: post.id,
      post: cleanPost,
      mediaBlob,
      audioBlob,
      savedAt: new Date().toISOString(),
      sizeBytes,
      sourceType: options?.sourceType || existing?.sourceType || 'saved',
    };

    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    emitStoreUpdated();
    return record;
  } catch {
    return null;
  }
}

export async function removeOfflineSavedPost(postId: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(postId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    emitStoreUpdated();
  } catch {
    // ignore
  }
}

/**
 * Resolves a VideoPost into an offline-playable copy by generating fresh ObjectURLs
 * from locally cached IndexedDB mediaBlob / audioBlob when present.
 */
export function hydratePostWithOfflineRecord(
  post: VideoPost,
  record?: OfflineMediaRecord
): VideoPost {
  if (!record) return post;
  const offlineMediaUrl = record.mediaBlob ? URL.createObjectURL(record.mediaBlob) : post.videoUrl;
  const offlineAudioUrl = record.audioBlob
    ? URL.createObjectURL(record.audioBlob)
    : post.sound?.audioUrl;

  return {
    ...post,
    videoUrl: offlineMediaUrl,
    posterUrl: post.mediaType === 'image' ? offlineMediaUrl : post.posterUrl,
    sound: {
      ...post.sound,
      audioUrl: offlineAudioUrl,
    },
  };
}

export function formatOfflineBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Cached';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

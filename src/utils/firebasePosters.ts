import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface CloudOwnerPoster {
  id: string;
  title: string;
  category: string;
  badge: string;
  imageUrl: string;
  dateAdded: string;
  createdAtMs: number;
}

const MAX_CLOUD_DATA_URL_LENGTH = 260000;
const RASTER_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Compresses any uploaded poster image cleanly so it always stays compact
 * inside Firestore's free-tier read budget while remaining crisp for printing & WhatsApp.
 */
export function compressPosterImageForCloud(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (
      typeof dataUrl === 'string' &&
      dataUrl.length <= MAX_CLOUD_DATA_URL_LENGTH &&
      RASTER_DATA_URL_REGEX.test(dataUrl)
    ) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const dimensionSteps = [1200, 1080, 960, 800];
        const qualitySteps = [0.82, 0.72, 0.62, 0.5, 0.4];

        for (const maxDim of dimensionSteps) {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          // White fill ensures transparent PNGs convert cleanly to JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          for (const q of qualitySteps) {
            const candidate = canvas.toDataURL('image/jpeg', q);
            if (
              candidate.length <= MAX_CLOUD_DATA_URL_LENGTH &&
              RASTER_DATA_URL_REGEX.test(candidate)
            ) {
              resolve(candidate);
              return;
            }
          }
        }

        reject(new Error('Poster image exceeds cloud size budget even after compression.'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not decode poster image for cloud sync.'));
    img.src = dataUrl;
  });
}

const POSTER_IDB_NAME = 'maha_corner_poster_cache_v1';
const POSTER_IDB_STORE = 'cache';
const POSTER_IDB_KEY = 'owner_posters_list';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes across reloads to preserve free daily read quota

let memoryPosterCache: CloudOwnerPoster[] | null = null;
let memoryCacheTimestamp = 0;
let inflightFetchPromise: Promise<CloudOwnerPoster[]> | null = null;
let quotaCooldownUntilMs = 0;

export function isFirestoreQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('quota exceeded') ||
    lower.includes('quota limit exceeded') ||
    lower.includes('resource-exhausted') ||
    lower.includes('free daily read units')
  );
}

function openPosterCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(POSTER_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(POSTER_IDB_STORE)) {
          database.createObjectStore(POSTER_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readCachedOwnerPostersMeta(): Promise<{ updatedAt: number; items: CloudOwnerPoster[] }> {
  if (memoryPosterCache && memoryPosterCache.length > 0 && memoryCacheTimestamp > 0) {
    return { updatedAt: memoryCacheTimestamp, items: memoryPosterCache };
  }
  const database = await openPosterCacheDb();
  if (!database) return { updatedAt: 0, items: [] };
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(POSTER_IDB_STORE, 'readonly');
      const store = tx.objectStore(POSTER_IDB_STORE);
      const getReq = store.get(POSTER_IDB_KEY);
      getReq.onsuccess = () => {
        const val = getReq.result;
        if (val && Array.isArray(val.items)) {
          const valid = (val.items as CloudOwnerPoster[]).filter(
            (item) => item && typeof item.id === 'string' && RASTER_DATA_URL_REGEX.test(item.imageUrl || '')
          );
          const updatedAt = Number(val.updatedAt) || 0;
          if (valid.length > 0) {
            memoryPosterCache = valid;
            if (updatedAt > memoryCacheTimestamp) {
              memoryCacheTimestamp = updatedAt;
            }
          }
          resolve({ updatedAt, items: valid });
        } else {
          resolve({ updatedAt: 0, items: [] });
        }
      };
      getReq.onerror = () => resolve({ updatedAt: 0, items: [] });
    } catch {
      resolve({ updatedAt: 0, items: [] });
    }
  });
}

export async function readCachedOwnerPosters(): Promise<CloudOwnerPoster[]> {
  const { items } = await readCachedOwnerPostersMeta();
  return items;
}

export async function writeCachedOwnerPosters(items: CloudOwnerPoster[]): Promise<void> {
  memoryPosterCache = items;
  memoryCacheTimestamp = Date.now();
  const database = await openPosterCacheDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(POSTER_IDB_STORE, 'readwrite');
      const store = tx.objectStore(POSTER_IDB_STORE);
      store.put({ updatedAt: Date.now(), items }, POSTER_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function mapPosterDocs(docs: Array<{ id: string; data: () => Record<string, any> }>): CloudOwnerPoster[] {
  return docs
    .map((d) => {
      const data = d.data() || {};
      return {
        id: String(data.id || d.id),
        title: String(data.title || 'नवीन अधिकृत बॅनर'),
        category: String(data.category || 'शासकीय योजना'),
        badge: String(data.badge || '★ ओनर अधिकृत'),
        imageUrl: String(data.imageUrl || ''),
        dateAdded: String(data.dateAdded || 'आज'),
        createdAtMs: Number(data.createdAtMs) || 0,
      };
    })
    .filter(
      (item) =>
        item.id.length >= 3 &&
        RASTER_DATA_URL_REGEX.test(item.imageUrl)
    );
}

export async function fetchPublicOwnerPostersOnce(options?: {
  forceNetwork?: boolean;
}): Promise<CloudOwnerPoster[]> {
  const forceNetwork = Boolean(options?.forceNetwork);

  if (
    !forceNetwork &&
    memoryPosterCache &&
    Date.now() - memoryCacheTimestamp < CACHE_TTL_MS
  ) {
    return memoryPosterCache;
  }

  if (!forceNetwork) {
    const idbMeta = await readCachedOwnerPostersMeta();
    if (idbMeta.items.length > 0 && Date.now() - idbMeta.updatedAt < CACHE_TTL_MS) {
      return idbMeta.items;
    }
  }

  if (!forceNetwork && Date.now() < quotaCooldownUntilMs) {
    return memoryPosterCache || (await readCachedOwnerPosters());
  }

  if (inflightFetchPromise && !forceNetwork) {
    return inflightFetchPromise;
  }

  inflightFetchPromise = (async () => {
    try {
      const q = query(collection(db, 'owner_posters'), orderBy('createdAtMs', 'desc'), limit(100));
      const snap = await getDocs(q);
      const mapped = mapPosterDocs(snap.docs);
      await writeCachedOwnerPosters(mapped);
      return mapped;
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
      }
      handleFirestoreError(err, OperationType.LIST, 'owner_posters');
    } finally {
      inflightFetchPromise = null;
    }
  })();

  return inflightFetchPromise;
}

export function subscribePublicOwnerPosters(
  onData: (posters: CloudOwnerPoster[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'owner_posters'), orderBy('createdAtMs', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const mapped = mapPosterDocs(snap.docs);
      void writeCachedOwnerPosters(mapped);
      onData(mapped);
    },
    (error) => {
      if (isFirestoreQuotaError(error)) {
        quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, 'owner_posters');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function saveOwnerPosterInFirestore(input: {
  id?: string;
  title: string;
  category: string;
  badge?: string;
  imageUrl: string;
  dateAdded: string;
}): Promise<CloudOwnerPoster> {
  const safeIdRaw = (input.id || `owner-banner-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  const posterId = safeIdRaw.slice(0, 128);
  const compressedImage = await compressPosterImageForCloud(input.imageUrl);

  const cleanTitle = String(input.title || '').trim().slice(0, 140) || 'नवीन अधिकृत बॅनर';
  const cleanCategory = String(input.category || '').trim().slice(0, 60) || 'शासकीय योजना';
  const cleanBadge = String(input.badge || '').trim().slice(0, 40) || '★ ओनर अधिकृत';
  const cleanDate = String(input.dateAdded || '').trim().slice(0, 40) || new Date().toLocaleDateString('mr-IN');
  const createdAtMs = Math.floor(Date.now());

  try {
    await setDoc(doc(db, 'owner_posters', posterId), {
      id: posterId,
      title: cleanTitle,
      category: cleanCategory,
      badge: cleanBadge,
      imageUrl: compressedImage,
      dateAdded: cleanDate,
      createdAt: serverTimestamp(),
      createdAtMs,
    });

    const created: CloudOwnerPoster = {
      id: posterId,
      title: cleanTitle,
      category: cleanCategory,
      badge: cleanBadge,
      imageUrl: compressedImage,
      dateAdded: cleanDate,
      createdAtMs,
    };

    const existing = memoryPosterCache || (await readCachedOwnerPosters());
    const nextCache = [created, ...existing.filter((p) => p.id !== posterId)];
    await writeCachedOwnerPosters(nextCache);

    return created;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `owner_posters/${posterId}`);
  }
}

export async function deleteOwnerPosterInFirestore(posterId: string): Promise<void> {
  const safeId = String(posterId || '').trim();
  if (!safeId) return;
  try {
    await deleteDoc(doc(db, 'owner_posters', safeId));
    const existing = memoryPosterCache || (await readCachedOwnerPosters());
    const nextCache = existing.filter((p) => p.id !== safeId);
    await writeCachedOwnerPosters(nextCache);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `owner_posters/${safeId}`);
  }
}

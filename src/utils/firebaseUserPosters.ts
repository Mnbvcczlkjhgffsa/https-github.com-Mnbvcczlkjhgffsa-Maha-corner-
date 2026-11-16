import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { compressPosterImageForCloud, isFirestoreQuotaError } from './firebasePosters';

export interface UserSavedPoster {
  id: string;
  ownerUid: string;
  title: string;
  centerName: string;
  category: string;
  imageUrl: string;
  dateSaved: string;
  createdAtMs: number;
  syncedToCloud?: boolean;
}

export const DEVICE_POSTERS_UID = 'device_local_user';
const RASTER_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
const USER_POSTERS_IDB_NAME = 'maha_corner_my_posters_cache_v1';
const USER_POSTERS_IDB_STORE = 'posters';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes across reloads to minimize Firestore reads

const memoryCacheByUid = new Map<string, { ts: number; items: UserSavedPoster[] }>();
let quotaCooldownUntilMs = 0;

function openUserPosterCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(USER_POSTERS_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(USER_POSTERS_IDB_STORE)) {
          database.createObjectStore(USER_POSTERS_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readCachedUserPostersMeta(
  ownerUid: string
): Promise<{ updatedAt: number; items: UserSavedPoster[] }> {
  if (!ownerUid) return { updatedAt: 0, items: [] };
  const mem = memoryCacheByUid.get(ownerUid);
  if (mem && mem.ts > 0) {
    return { updatedAt: mem.ts, items: mem.items };
  }

  const database = await openUserPosterCacheDb();
  if (!database) return { updatedAt: 0, items: [] };
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(USER_POSTERS_IDB_STORE, 'readonly');
      const store = tx.objectStore(USER_POSTERS_IDB_STORE);
      const getReq = store.get(`uid_${ownerUid}`);
      getReq.onsuccess = () => {
        const val = getReq.result;
        if (val && Array.isArray(val.items)) {
          const valid = (val.items as UserSavedPoster[]).filter(
            (item) =>
              item &&
              typeof item.id === 'string' &&
              (item.ownerUid === ownerUid || ownerUid === DEVICE_POSTERS_UID) &&
              RASTER_DATA_URL_REGEX.test(item.imageUrl || '')
          );
          const updatedAt = Number(val.updatedAt) || 0;
          if (!memoryCacheByUid.has(ownerUid)) {
            memoryCacheByUid.set(ownerUid, { ts: updatedAt, items: valid });
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

export async function readCachedUserPosters(ownerUid: string): Promise<UserSavedPoster[]> {
  const { items } = await readCachedUserPostersMeta(ownerUid);
  return items;
}

export async function readAllPersistedUserPosters(signedInUid?: string | null): Promise<UserSavedPoster[]> {
  const merged = new Map<string, UserSavedPoster>();

  const database = await openUserPosterCacheDb();
  if (database) {
    await new Promise<void>((resolve) => {
      try {
        const tx = database.transaction(USER_POSTERS_IDB_STORE, 'readonly');
        const store = tx.objectStore(USER_POSTERS_IDB_STORE);
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const allBuckets = Array.isArray(allReq.result) ? allReq.result : [];
          for (const val of allBuckets) {
            if (val && Array.isArray(val.items)) {
              for (const item of val.items as UserSavedPoster[]) {
                if (
                  item &&
                  typeof item.id === 'string' &&
                  RASTER_DATA_URL_REGEX.test(item.imageUrl || '') &&
                  !merged.has(item.id)
                ) {
                  merged.set(item.id, item);
                }
              }
            }
          }
          resolve();
        };
        allReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  if (signedInUid) {
    const uidItems = await readCachedUserPosters(signedInUid);
    for (const item of uidItems) {
      merged.set(item.id, item);
    }
  }
  const deviceItems = await readCachedUserPosters(DEVICE_POSTERS_UID);
  for (const item of deviceItems) {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

async function writeCachedUserPosters(
  ownerUid: string,
  items: UserSavedPoster[],
  customUpdatedAt?: number
): Promise<void> {
  if (!ownerUid) return;
  const sorted = [...items].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const ts = typeof customUpdatedAt === 'number' ? customUpdatedAt : Date.now();
  memoryCacheByUid.set(ownerUid, { ts, items: sorted });
  const database = await openUserPosterCacheDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(USER_POSTERS_IDB_STORE, 'readwrite');
      const store = tx.objectStore(USER_POSTERS_IDB_STORE);
      store.put({ updatedAt: ts, items: sorted }, `uid_${ownerUid}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function fetchMyPostersFromFirestore(options?: {
  forceNetwork?: boolean;
}): Promise<UserSavedPoster[]> {
  const user = auth.currentUser;
  if (!user?.uid) {
    return readCachedUserPosters(DEVICE_POSTERS_UID);
  }
  const ownerUid = user.uid;
  const forceNetwork = Boolean(options?.forceNetwork);

  const meta = await readCachedUserPostersMeta(ownerUid);
  if (!forceNetwork && meta.updatedAt > 0 && Date.now() - meta.updatedAt < CACHE_TTL_MS) {
    return readAllPersistedUserPosters(ownerUid);
  }

  if (!forceNetwork && Date.now() < quotaCooldownUntilMs) {
    return readAllPersistedUserPosters(ownerUid);
  }

  try {
    const q = query(
      collection(db, 'user_posters'),
      where('ownerUid', '==', ownerUid),
      limit(50)
    );
    const snap = await getDocs(q);
    const cloudItems: UserSavedPoster[] = snap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: String(data.id || d.id),
          ownerUid: String(data.ownerUid || ownerUid),
          title: String(data.title || 'माझे पोस्टर'),
          centerName: String(data.centerName || 'महा कॉर्नर'),
          category: String(data.category || 'शासकीय योजना'),
          imageUrl: String(data.imageUrl || ''),
          dateSaved: String(data.dateSaved || 'आज'),
          createdAtMs: Number(data.createdAtMs) || 0,
          syncedToCloud: true,
        };
      })
      .filter(
        (item) =>
          item.id.length >= 6 &&
          item.ownerUid === ownerUid &&
          RASTER_DATA_URL_REGEX.test(item.imageUrl)
      );

    // Keep any locally queued posters that haven't synced to Firestore yet
    const localPending = meta.items.filter(
      (item) => item.syncedToCloud === false && !cloudItems.some((c) => c.id === item.id)
    );
    const combinedForUid = [...cloudItems, ...localPending].sort(
      (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
    );

    await writeCachedUserPosters(ownerUid, combinedForUid);
    return readAllPersistedUserPosters(ownerUid);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
    }
    handleFirestoreError(err, OperationType.LIST, 'user_posters');
  }
}

export async function saveMyPosterHybrid(input: {
  title: string;
  centerName: string;
  category: string;
  imageDataUrl: string;
}): Promise<{
  poster: UserSavedPoster;
  cloudSynced: boolean;
  quotaExceeded: boolean;
}> {
  const user = auth.currentUser;
  const canTryCloud = Boolean(user?.uid && user.emailVerified);
  const ownerUid = canTryCloud && user?.uid
    ? user.uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128)
    : DEVICE_POSTERS_UID;

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const posterId = `myposter-${Date.now()}-${randomSuffix}`.slice(0, 128);

  const compressedImage = await compressPosterImageForCloud(input.imageDataUrl);
  if (compressedImage.length > 450000) {
    throw new Error('पोस्टर इमेज सेव्ह मर्यादेपेक्षा मोठी आहे.');
  }

  const cleanTitle = String(input.title || '').trim().slice(0, 140) || 'माझे ब्रँडेड पोस्टर';
  const cleanCenterName = String(input.centerName || '').trim().slice(0, 100) || 'महा कॉर्नर';
  const cleanCategory = String(input.category || '').trim().slice(0, 60) || 'शासकीय योजना';
  const cleanDateSaved = new Date().toLocaleDateString('mr-IN').slice(0, 40) || 'आज';
  const createdAtMs = Math.floor(Date.now());

  const localPoster: UserSavedPoster = {
    id: posterId,
    ownerUid,
    title: cleanTitle,
    centerName: cleanCenterName,
    category: cleanCategory,
    imageUrl: compressedImage,
    dateSaved: cleanDateSaved,
    createdAtMs,
    syncedToCloud: false,
  };

  // Always save immediately to persistent IndexedDB so posters never get lost even if quota is full or signed out
  const existingForBucket = await readCachedUserPosters(ownerUid);
  await writeCachedUserPosters(
    ownerUid,
    [localPoster, ...existingForBucket.filter((p) => p.id !== posterId)],
    0
  );

  if (!canTryCloud) {
    return { poster: localPoster, cloudSynced: false, quotaExceeded: false };
  }

  try {
    await setDoc(doc(db, 'user_posters', posterId), {
      id: posterId,
      ownerUid,
      title: cleanTitle,
      centerName: cleanCenterName,
      category: cleanCategory,
      imageUrl: compressedImage,
      dateSaved: cleanDateSaved,
      createdAt: serverTimestamp(),
      createdAtMs,
    });

    const syncedPoster: UserSavedPoster = { ...localPoster, syncedToCloud: true };
    const latestBucket = await readCachedUserPosters(ownerUid);
    await writeCachedUserPosters(ownerUid, [
      syncedPoster,
      ...latestBucket.filter((p) => p.id !== posterId),
    ]);

    return { poster: syncedPoster, cloudSynced: true, quotaExceeded: false };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
      return { poster: localPoster, cloudSynced: false, quotaExceeded: true };
    }
    try {
      handleFirestoreError(err, OperationType.CREATE, `user_posters/${posterId}`);
    } catch {
      return { poster: localPoster, cloudSynced: false, quotaExceeded: false };
    }
    return { poster: localPoster, cloudSynced: false, quotaExceeded: false };
  }
}

export async function syncPendingMyPostersToFirestore(
  items: UserSavedPoster[]
): Promise<{ syncedIds: string[]; failedQuota: boolean }> {
  const user = auth.currentUser;
  if (!user?.uid || !user.emailVerified) {
    throw new Error('Cloud Sync साठी कृपया प्रथम Google लॉगिन पूर्ण करा.');
  }

  const ownerUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const pending = items.filter((p) => p.syncedToCloud !== true);
  if (pending.length === 0) {
    return { syncedIds: [], failedQuota: false };
  }

  const syncedIds: string[] = [];
  let failedQuota = false;

  for (const item of pending) {
    try {
      const compressed = await compressPosterImageForCloud(item.imageUrl);
      await setDoc(doc(db, 'user_posters', item.id), {
        id: item.id,
        ownerUid,
        title: item.title.slice(0, 140),
        centerName: item.centerName.slice(0, 100),
        category: item.category.slice(0, 60),
        imageUrl: compressed,
        dateSaved: item.dateSaved.slice(0, 40),
        createdAt: serverTimestamp(),
        createdAtMs: item.createdAtMs || Date.now(),
      });
      syncedIds.push(item.id);
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
        failedQuota = true;
        break;
      }
    }
  }

  if (syncedIds.length > 0) {
    const uidBucket = await readCachedUserPosters(ownerUid);
    const updatedUidBucket = [
      ...uidBucket.map((p) => (syncedIds.includes(p.id) ? { ...p, ownerUid, syncedToCloud: true } : p)),
      ...pending
        .filter((p) => syncedIds.includes(p.id) && !uidBucket.some((u) => u.id === p.id))
        .map((p) => ({ ...p, ownerUid, syncedToCloud: true })),
    ];
    await writeCachedUserPosters(ownerUid, updatedUidBucket);

    const deviceBucket = await readCachedUserPosters(DEVICE_POSTERS_UID);
    const remainingDevice = deviceBucket.filter((p) => !syncedIds.includes(p.id));
    if (remainingDevice.length !== deviceBucket.length) {
      await writeCachedUserPosters(DEVICE_POSTERS_UID, remainingDevice);
    }
  }

  return { syncedIds, failedQuota };
}

export async function deleteMyPosterHybrid(
  posterId: string,
  syncedToCloud?: boolean
): Promise<{ cloudDeleted: boolean; quotaExceeded: boolean }> {
  const safeId = String(posterId || '').trim();
  if (!safeId) return { cloudDeleted: true, quotaExceeded: false };

  // Remove from local persistent device store
  const deviceItems = await readCachedUserPosters(DEVICE_POSTERS_UID);
  const nextDevice = deviceItems.filter((p) => p.id !== safeId);
  if (nextDevice.length !== deviceItems.length) {
    await writeCachedUserPosters(DEVICE_POSTERS_UID, nextDevice);
  }

  const user = auth.currentUser;
  if (user?.uid) {
    const uidItems = await readCachedUserPosters(user.uid);
    const nextUid = uidItems.filter((p) => p.id !== safeId);
    if (nextUid.length !== uidItems.length) {
      await writeCachedUserPosters(user.uid, nextUid);
    }
  }

  if (!syncedToCloud || !user?.uid) {
    return { cloudDeleted: false, quotaExceeded: false };
  }

  try {
    await deleteDoc(doc(db, 'user_posters', safeId));
    return { cloudDeleted: true, quotaExceeded: false };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      quotaCooldownUntilMs = Date.now() + 5 * 60 * 1000;
      return { cloudDeleted: false, quotaExceeded: true };
    }
    handleFirestoreError(err, OperationType.DELETE, `user_posters/${safeId}`);
  }
}


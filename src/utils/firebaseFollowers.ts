import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppTab } from '../types';
import { sanitizeSpreadsheetCell } from './pdfSecurity';

export interface FirebaseFollowerRecord {
  id: string;
  name: string;
  mobile: string;
  consentGiven: boolean;
  interests: string[];
  source: string;
  createdAtIso: string;
  createdAtMs: number;
}

export interface RegisterFollowerInput {
  name: string;
  mobile: string;
  consentGiven: boolean;
  interests?: string[];
  source?: string;
}

export interface RegisterFollowerResult {
  success: boolean;
  duplicate?: boolean;
  followerId?: string;
  totalFollowers?: number;
  message: string;
}

const HASH_PEPPER = 'maha_corner_2026_mobile_guard';

export async function computeFollowerHash(mobileDigits: string): Promise<string> {
  const input = `${HASH_PEPPER}:${mobileDigits}`;
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeIndianMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

export function isValidIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

export async function registerFollowerInFirestore(
  input: RegisterFollowerInput
): Promise<RegisterFollowerResult> {
  const cleanName = String(input.name || '').trim().slice(0, 80);
  const digits = normalizeIndianMobile(input.mobile);

  if (cleanName.length < 2) {
    return {
      success: false,
      message: 'कृपया किमान २ अक्षरांचे पूर्ण नाव टाका.',
    };
  }
  if (!isValidIndianMobile(digits)) {
    return {
      success: false,
      message: 'कृपया १० अंकी वैध मोबाईल / WhatsApp नंबर टाका (६ ते ९ ने सुरू होणारा).',
    };
  }
  if (!input.consentGiven) {
    return {
      success: false,
      message: 'कृपया तुमचे नाव व मोबाईल नंबर नोंदवण्यासाठी संमती (Checkbox) टिक करा.',
    };
  }

  const rawInterests = (input.interests || [])
    .map((item) => String(item).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 6);
  const cleanInterests = rawInterests.length > 0 ? rawInterests : ['नवीन योजना व पोस्टर्स'];
  const cleanSource = String(input.source || 'follow-modal').trim().slice(0, 40) || 'follow-modal';

  const hashId = await computeFollowerHash(digits);

  // 1. Primary zero-quota persistence on Portal Server (.data/subscribers.json -> Drive Backup ready)
  let serverSaved = false;
  let serverDuplicate = false;
  let serverCount: number | undefined;
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'register',
        name: cleanName,
        mobile: digits,
        interests: cleanInterests,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      serverSaved = true;
      serverDuplicate = Boolean(data.alreadySubscribed);
      if (typeof data.followerCount === 'number') {
        serverCount = data.followerCount;
      }
    }
  } catch {
    // Fall through to Firestore best-effort
  }

  // 2. Best-effort Firestore mirror (never fails the submission if quota is exceeded)
  let firestoreSaved = false;
  let firestoreDuplicate = false;
  let currentTotal = 0;
  try {
    const hashDocRef = doc(db, 'follower_hashes', hashId);
    const existingHashSnap = await getDoc(hashDocRef);
    if (existingHashSnap.exists()) {
      firestoreDuplicate = true;
    } else {
      const nowIso = new Date().toISOString();
      // Commit follower + hash index atomically first so a stats counter race never blocks saving the follower's name
      const batch = writeBatch(db);
      batch.set(hashDocRef, { createdAt: serverTimestamp() });
      batch.set(doc(db, 'followers', hashId), {
        id: hashId,
        name: cleanName,
        mobile: digits,
        consentGiven: true,
        interests: cleanInterests,
        source: cleanSource,
        createdAt: serverTimestamp(),
        createdAtIso: nowIso,
      });
      await batch.commit();
      firestoreSaved = true;

      // Update aggregate public counter independently (best-effort)
      try {
        const summaryRef = doc(db, 'portal_stats', 'summary');
        const summarySnap = await getDoc(summaryRef);
        if (summarySnap.exists()) {
          currentTotal = Number(summarySnap.data()?.totalFollowers) || 0;
          await setDoc(
            summaryRef,
            {
              totalFollowers: increment(1),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await setDoc(summaryRef, {
            totalFollowers: 1,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Counter increment is non-fatal; follower record is already safely saved
      }
    }
  } catch (err) {
    console.warn('Firestore follower mirror warning:', err);
  }

  if (serverDuplicate || firestoreDuplicate) {
    return {
      success: false,
      duplicate: true,
      followerId: hashId,
      totalFollowers: serverCount,
      message: 'हा मोबाईल नंबर आधीच फॉलोअर यादीत नोंदणीकृत आहे! (डुप्लिकेट नोंद अनुमत नाही) ✓',
    };
  }

  if (serverSaved || firestoreSaved) {
    const finalTotal = serverCount ?? (currentTotal > 0 ? currentTotal + 1 : undefined);
    if (typeof finalTotal === 'number' && finalTotal > 0) {
      setCachedPublicFollowerCount(finalTotal);
    }
    return {
      success: true,
      duplicate: false,
      followerId: hashId,
      totalFollowers: finalTotal,
      message: 'अभिनंदन! तुमची नोंदणी सुरक्षितरीत्या सेव्ह झाली आहे. ✓',
    };
  }

  return {
    success: false,
    message: 'नोंदणी सेव्ह करताना तांत्रिक अडचण आली. कृपया पुन्हा प्रयत्न करा.',
  };
}

export async function fetchPublicFollowerCount(): Promise<number> {
  try {
    const res = await fetch('/api/updates');
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data?.followerCount === 'number' && data.followerCount > 0) {
      return data.followerCount;
    }
  } catch {}
  try {
    const snap = await getDoc(doc(db, 'portal_stats', 'summary'));
    if (snap.exists()) {
      return Number(snap.data()?.totalFollowers) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

const CACHED_FOLLOWER_COUNT_KEY = 'maha_corner_cached_follower_count_v1';
const CACHED_FOLLOWER_TS_KEY = 'maha_corner_cached_follower_ts_v1';
const FOLLOWER_COUNT_TTL_MS = 5 * 60 * 1000;

export function getCachedPublicFollowerCount(): number {
  try {
    const raw = localStorage.getItem(CACHED_FOLLOWER_COUNT_KEY);
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function setCachedPublicFollowerCount(count: number): void {
  try {
    localStorage.setItem(CACHED_FOLLOWER_COUNT_KEY, String(Math.max(0, Math.round(count))));
    localStorage.setItem(CACHED_FOLLOWER_TS_KEY, String(Date.now()));
  } catch {}
}

export async function fetchPublicFollowerCountCached(): Promise<number> {
  const cached = getCachedPublicFollowerCount();
  try {
    const count = await fetchPublicFollowerCount();
    if (count > 0) {
      const best = Math.max(count, cached);
      setCachedPublicFollowerCount(best);
      return best;
    }
    const ts = Number(localStorage.getItem(CACHED_FOLLOWER_TS_KEY) || 0);
    if (cached > 0 && Date.now() - ts < FOLLOWER_COUNT_TTL_MS) {
      return cached;
    }
    return cached;
  } catch {
    return cached;
  }
}

export function subscribePublicFollowerCount(
  onCount: (count: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const cached = getCachedPublicFollowerCount();
  if (cached > 0) {
    onCount(cached);
  }

  const ref = doc(db, 'portal_stats', 'summary');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const count = Number(snap.data()?.totalFollowers) || 0;
        setCachedPublicFollowerCount(count);
        onCount(count);
      } else {
        onCount(0);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'portal_stats/summary');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

function mapFollowerDoc(id: string, data: Record<string, any>): FirebaseFollowerRecord {
  const rawTs =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : typeof data.createdAtMs === 'number' && Number.isFinite(data.createdAtMs)
        ? data.createdAtMs
        : Date.parse(String(data.createdAtIso || data.subscribedAt || '')) || Date.now();

  const iso =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : typeof data.createdAtIso === 'string' && data.createdAtIso
        ? data.createdAtIso
        : typeof data.subscribedAt === 'string' && data.subscribedAt
          ? data.subscribedAt
          : new Date(rawTs).toISOString();

  const resolvedName = String(
    data.name || data.fullName || data.centerName || data.userName || ''
  ).trim();

  return {
    id,
    name: resolvedName || 'नाव नोंदवलेले नाही',
    mobile: String(data.mobile || data.phone || '').trim(),
    consentGiven: data.consentGiven !== false,
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
    source: String(data.source || 'firebase-cloud'),
    createdAtIso: iso,
    createdAtMs: rawTs,
  };
}

export function subscribeAdminFollowers(
  onData: (records: FirebaseFollowerRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // Query full collection without orderBy('createdAt') so legacy docs missing createdAt are never silently omitted
  const colRef = collection(db, 'followers');
  return onSnapshot(
    colRef,
    (snap) => {
      const items = snap.docs
        .map((d) => mapFollowerDoc(d.id, d.data()))
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'followers');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function fetchAdminFollowersOnce(): Promise<FirebaseFollowerRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'followers'));
    return snap.docs
      .map((d) => mapFollowerDoc(d.id, d.data()))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'followers');
  }
}

export async function syncAdminTotalCounter(exactCount: number): Promise<void> {
  try {
    await setDoc(doc(db, 'portal_stats', 'summary'), {
      totalFollowers: Math.max(0, Math.round(exactCount)),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'portal_stats/summary');
  }
}

export async function deleteFollowerAsAdmin(
  followerId: string,
  remainingCount: number
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'followers', followerId));
  batch.delete(doc(db, 'follower_hashes', followerId));
  batch.set(doc(db, 'portal_stats', 'summary'), {
    totalFollowers: Math.max(0, remainingCount),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `followers/${followerId}`);
  }
}

export async function publishLiveUpdateInFirestore(payload: {
  title: string;
  message: string;
  targetTab: AppTab;
}): Promise<string> {
  const updateId = `upd_${Date.now()}`;
  const cleanTitle = payload.title.trim().slice(0, 160);
  const cleanMsg = payload.message.trim().slice(0, 800);
  try {
    await setDoc(doc(db, 'live_updates', updateId), {
      id: updateId,
      title: cleanTitle,
      message: cleanMsg,
      targetTab: payload.targetTab,
      createdAt: serverTimestamp(),
    });
    return updateId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `live_updates/${updateId}`);
  }
}

export function exportFollowersToExcel(
  followers: FirebaseFollowerRecord[],
  filenamePrefix = 'maha-corner-followers'
): void {
  const rows = followers.map((f, idx) => {
    const dt = new Date(f.createdAtMs || f.createdAtIso);
    const dateStr = dt.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = dt.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return {
      'अ.क्र. (Sr No)': idx + 1,
      'नाव (Full Name)': sanitizeSpreadsheetCell(f.name),
      'मोबाईल नंबर (Mobile)': sanitizeSpreadsheetCell(f.mobile),
      'संमती (Consent)': f.consentGiven ? 'Yes (होय)' : 'No',
      'पसंतीचे विषय (Interests)': sanitizeSpreadsheetCell(f.interests.join(', ')),
      'तारीख (Date)': sanitizeSpreadsheetCell(dateStr),
      'वेळ (Time)': sanitizeSpreadsheetCell(timeStr),
      'स्रोत (Source)': sanitizeSpreadsheetCell(f.source),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 36 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Followers');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  XLSX.writeFile(workbook, `${filenamePrefix}-${today}.xlsx`);
}

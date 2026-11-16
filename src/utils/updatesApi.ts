import { AppTab } from '../types';

export interface LiveUpdateItem {
  id: string;
  title: string;
  message: string;
  targetTab: AppTab;
  createdAt: string;
}

export interface SubscriberRecord {
  id: string;
  name: string;
  mobile: string;
  interests: string[];
  subscribedAt: string;
}

const FOLLOWED_FLAG_KEY = 'maha_corner_followed_v1';
const LAST_SEEN_TS_KEY = 'maha_corner_last_seen_update_ts_v1';
const VISITOR_ID_KEY = 'maha_corner_anon_vid_v1';

export function getOrCreateFollowerVisitorId(): string {
  try {
    let existing = localStorage.getItem(VISITOR_ID_KEY);
    if (!existing) {
      existing =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `v_${crypto.randomUUID()}`
          : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_ID_KEY, existing);
    }
    return existing;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export function getLocalIsFollowed(): boolean {
  try {
    return localStorage.getItem(FOLLOWED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLocalIsFollowed(val: boolean): void {
  try {
    localStorage.setItem(FOLLOWED_FLAG_KEY, val ? '1' : '0');
  } catch {}
}

export function getLastSeenUpdateTs(): number {
  try {
    const raw = localStorage.getItem(LAST_SEEN_TS_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function markAllUpdatesSeenNow(latestIso?: string): number {
  const ts = latestIso ? Math.max(Date.now(), Date.parse(latestIso) || 0) : Date.now();
  try {
    localStorage.setItem(LAST_SEEN_TS_KEY, String(ts));
  } catch {}
  return ts;
}

export async function fetchLiveUpdates(): Promise<{
  success: boolean;
  updates: LiveUpdateItem[];
  followerCount: number;
}> {
  try {
    const res = await fetch('/api/updates');
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        updates: Array.isArray(data.updates) ? data.updates : [],
        followerCount: Number(data.followerCount) || 0,
      };
    }
  } catch {
    // Ignore transient network errors
  }
  return { success: false, updates: [], followerCount: 0 };
}

export async function subscribeCustomer(payload: {
  mode: 'follow' | 'whatsapp';
  name?: string;
  mobile?: string;
  interests?: string[];
}): Promise<{
  success: boolean;
  followerCount?: number;
  alreadySubscribed?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        visitorId: getOrCreateFollowerVisitorId(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || 'सबस्क्राईब करताना अडचण आली.' };
    }
    setLocalIsFollowed(true);
    return {
      success: true,
      followerCount: Number(data.followerCount) || 0,
      alreadySubscribed: Boolean(data.alreadySubscribed),
    };
  } catch {
    return { success: false, error: 'नेटवर्क त्रुटी आली, कृपया पुन्हा प्रयत्न करा.' };
  }
}

export async function postOwnerUpdate(payload: {
  pin: string;
  title: string;
  message: string;
  targetTab: AppTab;
}): Promise<{
  success: boolean;
  updates?: LiveUpdateItem[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || 'अपडेट पब्लिश करता आले नाही.' };
    }
    return { success: true, updates: data.updates || [] };
  } catch {
    return { success: false, error: 'सर्व्हरशी संपर्क होऊ शकला नाही.' };
  }
}

export async function deleteOwnerUpdate(id: string, pin: string): Promise<{
  success: boolean;
  updates?: LiveUpdateItem[];
}> {
  try {
    const res = await fetch(`/api/updates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return { success: true, updates: data.updates || [] };
    }
  } catch {}
  return { success: false };
}

export async function fetchOwnerSubscribers(pin: string): Promise<{
  success: boolean;
  subscribers: SubscriberRecord[];
  browserFollowers: number;
  followerCount: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/subscribers/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return {
        success: false,
        subscribers: [],
        browserFollowers: 0,
        followerCount: 0,
        error: data?.error || 'अधिकृत PIN चुकीचा आहे.',
      };
    }
    return {
      success: true,
      subscribers: Array.isArray(data.subscribers) ? data.subscribers : [],
      browserFollowers: Number(data.browserFollowers) || 0,
      followerCount: Number(data.followerCount) || 0,
    };
  } catch {
    return {
      success: false,
      subscribers: [],
      browserFollowers: 0,
      followerCount: 0,
      error: 'सर्व्हर त्रुटी.',
    };
  }
}

export async function deleteOwnerSubscriber(id: string, pin: string): Promise<{
  success: boolean;
  subscribers?: SubscriberRecord[];
  followerCount?: number;
}> {
  try {
    const res = await fetch(`/api/subscribers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return {
        success: true,
        subscribers: data.subscribers || [],
        followerCount: Number(data.followerCount) || 0,
      };
    }
  } catch {}
  return { success: false };
}

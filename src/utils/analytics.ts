import { AppTab } from '../types';

export interface FeatureStatItem {
  id: AppTab;
  opens: number;
  actions: number;
  total: number;
}

export interface LockedAnalyticsStats {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  totalToolOpens: number;
  totalToolActions: number;
  features: FeatureStatItem[];
}

const VISITOR_ID_KEY = 'maha_corner_anon_vid_v1';
const SESSION_VISIT_KEY = 'maha_corner_visit_logged_v1';

function getAnonymousVisitorId(): string {
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
    return '';
  }
}

async function sendTrackEvent(payload: {
  eventType: 'visit' | 'tab' | 'action';
  feature?: AppTab;
  visitorId?: string;
}): Promise<void> {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Silent failure so analytics never disrupt tool usage
  }
}

export function trackWebsiteVisit(): void {
  try {
    if (sessionStorage.getItem(SESSION_VISIT_KEY) === '1') {
      return;
    }
    sessionStorage.setItem(SESSION_VISIT_KEY, '1');
  } catch {}
  const visitorId = getAnonymousVisitorId();
  void sendTrackEvent({ eventType: 'visit', visitorId });
}

export function trackFeatureOpen(feature: AppTab): void {
  void sendTrackEvent({ eventType: 'tab', feature });
}

export function trackFeatureAction(feature: AppTab): void {
  void sendTrackEvent({ eventType: 'action', feature });
}

export async function fetchOwnerAnalytics(pin: string): Promise<{
  success: boolean;
  stats?: LockedAnalyticsStats;
  error?: string;
}> {
  const res = await fetch('/api/analytics/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return {
      success: false,
      error: data?.error || 'Unauthorized',
    };
  }
  return {
    success: true,
    stats: data.stats,
  };
}

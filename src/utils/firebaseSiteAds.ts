import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { compressPosterImageForCloud } from './firebasePosters';
import { sanitizeExternalUrl } from './pdfSecurity';

export interface SiteAdRecord {
  id: string;
  title: string;
  description: string;
  marqueeText: string;
  imageUrl: string;
  linkUrl: string;
  contactPhone: string;
  active: boolean;
  createdAtMs: number;
}

export const DEFAULT_AD_PHONE = '9373861832';
export const DEFAULT_AD_TITLE = '📢 MAHA CORNER जाहिरात';
export const DEFAULT_AD_DESCRIPTION = 'आपल्या व्यवसायाची जाहिरात आता महा कॉर्नरवर करा!';
export const DEFAULT_AD_LINK = 'https://mahacorner.in';
export const DEFAULT_MARQUEE_TEXT =
  '📢 आपल्या व्यवसायाची जाहिरात आता महा कॉर्नरवर! शाळा, कॉलेज, क्लासेस, शैक्षणिक संस्था, दुकाने, शोरूम, छोटे-मोठे व्यवसाय, शेतीविषयक उत्पादने, कृषी सेवा, शेतकरी योजना आणि इतर सर्व प्रकारच्या जाहिरातींसाठी आजच संपर्क साधा! 📞 संपर्क: 9373861832';

const RASTER_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

export function sanitizeAdPhone(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9+\-\s]/g, '').trim().slice(0, 20);
  return digits || DEFAULT_AD_PHONE;
}

export async function fetchAllSiteAds(): Promise<{
  ads: SiteAdRecord[];
  activeAd: SiteAdRecord | null;
}> {
  let serverAds: SiteAdRecord[] = [];
  try {
    const res = await fetch('/api/ads');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && Array.isArray(data.ads)) {
      serverAds = data.ads
        .filter((a: any) => a && typeof a.id === 'string' && RASTER_DATA_URL_REGEX.test(String(a.imageUrl || '')))
        .map((a: any) => ({
          id: String(a.id),
          title: String(a.title || DEFAULT_AD_TITLE),
          description: String(a.description || DEFAULT_AD_DESCRIPTION),
          marqueeText: String(a.marqueeText || ''),
          imageUrl: String(a.imageUrl),
          linkUrl: sanitizeExternalUrl(a.linkUrl, DEFAULT_AD_LINK),
          contactPhone: sanitizeAdPhone(a.contactPhone || DEFAULT_AD_PHONE),
          active: Boolean(a.active),
          createdAtMs: Number(a.createdAtMs) || 0,
        }));
    }
  } catch {
    // Fallback to Firestore below
  }

  if (serverAds.length > 0) {
    const active = serverAds.find((a) => a.active) || null;
    return { ads: serverAds, activeAd: active };
  }

  // Fallback directly to public zero-PII Firestore collection if server cache is empty
  try {
    const q = query(collection(db, 'site_ads'), orderBy('createdAtMs', 'desc'), limit(30));
    const snap = await getDocs(q);
    const fsAds: SiteAdRecord[] = snap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: String(data.id || d.id),
          title: String(data.title || DEFAULT_AD_TITLE),
          description: String(data.description || DEFAULT_AD_DESCRIPTION),
          marqueeText: String(data.marqueeText || ''),
          imageUrl: String(data.imageUrl || ''),
          linkUrl: sanitizeExternalUrl(data.linkUrl, DEFAULT_AD_LINK),
          contactPhone: sanitizeAdPhone(data.contactPhone || DEFAULT_AD_PHONE),
          active: Boolean(data.active),
          createdAtMs: Number(data.createdAtMs) || 0,
        };
      })
      .filter((a) => RASTER_DATA_URL_REGEX.test(a.imageUrl));
    const active = fsAds.find((a) => a.active) || null;
    return { ads: fsAds, activeAd: active };
  } catch {
    return { ads: [], activeAd: null };
  }
}

export async function prepareCompressedAdImage(rawDataUrl: string): Promise<string> {
  return compressPosterImageForCloud(rawDataUrl);
}

export async function saveSiteAdInFirestore(
  input: Omit<SiteAdRecord, 'createdAtMs'> & { createdAtMs?: number },
  previousAds: SiteAdRecord[] = []
): Promise<boolean> {
  const safeId = String(input.id || `ad-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const cleanTitle = String(input.title || DEFAULT_AD_TITLE).trim().slice(0, 140) || DEFAULT_AD_TITLE;
  const cleanDesc = String(input.description || DEFAULT_AD_DESCRIPTION).trim().slice(0, 500) || DEFAULT_AD_DESCRIPTION;
  const cleanMarquee = String(input.marqueeText || '').trim().slice(0, 600);
  const cleanLink = sanitizeExternalUrl(input.linkUrl, '');
  const cleanPhone = sanitizeAdPhone(input.contactPhone);
  const createdAtMs = Math.max(1700000000000, Math.floor(Number(input.createdAtMs) || Date.now()));

  if (!RASTER_DATA_URL_REGEX.test(input.imageUrl)) {
    return false;
  }

  try {
    // Deactivate previously active ads in Firestore if this ad is active
    if (input.active) {
      for (const prev of previousAds) {
        if (prev.active && prev.id !== safeId) {
          await updateDoc(doc(db, 'site_ads', prev.id), { active: false }).catch(() => {});
        }
      }
    }

    await setDoc(doc(db, 'site_ads', safeId), {
      id: safeId,
      title: cleanTitle,
      description: cleanDesc,
      marqueeText: cleanMarquee,
      imageUrl: input.imageUrl,
      linkUrl: cleanLink,
      contactPhone: cleanPhone,
      active: Boolean(input.active),
      createdAt: serverTimestamp(),
      createdAtMs,
    });
    return true;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.CREATE, `site_ads/${safeId}`);
    } catch {
      // Non-fatal: server persistence already handles save
    }
    return false;
  }
}

export async function setActiveSiteAdInFirestore(
  targetAdId: string | 'default',
  allAds: SiteAdRecord[]
): Promise<void> {
  for (const ad of allAds) {
    const shouldBeActive = targetAdId !== 'default' && ad.id === targetAdId;
    if (ad.active !== shouldBeActive) {
      try {
        await updateDoc(doc(db, 'site_ads', ad.id), { active: shouldBeActive });
      } catch {
        // Non-fatal best-effort mirror
      }
    }
  }
}

export async function deleteSiteAdInFirestore(adId: string): Promise<void> {
  const safeId = String(adId || '').trim();
  if (!safeId) return;
  try {
    await deleteDoc(doc(db, 'site_ads', safeId));
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.DELETE, `site_ads/${safeId}`);
    } catch {
      // Non-fatal
    }
  }
}

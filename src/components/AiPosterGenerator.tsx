import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Sparkles,
  Download,
  Share2,
  Phone,
  Store,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  Copy,
  Layers,
  Wand2,
  FileText,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Send,
  Loader2,
  MapPin,
  Building,
  Sliders,
  Palette,
  Eye,
  EyeOff,
  FileCheck,
  ShieldAlert,
  PlusCircle,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  Grid,
  ShieldCheck,
  RefreshCw,
  LogOut,
  BookmarkCheck,
  X,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  auth,
  googleProvider,
  ADMIN_EMAIL
} from '../firebase';
import {
  CloudOwnerPoster,
  compressPosterImageForCloud,
  deleteOwnerPosterInFirestore,
  fetchPublicOwnerPostersOnce,
  isFirestoreQuotaError,
  readCachedOwnerPosters,
  saveOwnerPosterInFirestore,
  writeCachedOwnerPosters
} from '../utils/firebasePosters';
import {
  UserSavedPoster,
  readAllPersistedUserPosters,
  fetchMyPostersFromFirestore,
  saveMyPosterHybrid,
  syncPendingMyPostersToFirestore,
  deleteMyPosterHybrid,
} from '../utils/firebaseUserPosters';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink, buildWhatsAppShareUrl, MAHA_CORNER_URL } from '../utils/shareConfig';
import { saveValidatedJsPdf } from '../utils/pdfCompat';
import { inspectUploadedFileBytes, PDF_SECURITY_LIMITS } from '../utils/pdfSecurity';

const SHOP_DETAILS_KEY = 'maha_corner_shop_details_v4';

export interface MasterBanner {
  id: string;
  title: string;
  category: string;
  badge?: string;
  imageUrl: string;
  dateAdded: string;
  isDefault?: boolean;
}

interface CenterDetails {
  centerName: string;
  centerTagline: string;
  taluka: string;
  district: string;
  village: string;
  address: string;
  phones: string[];
}

const DEFAULT_CENTER_DETAILS: CenterDetails = {
  centerName: 'महा कॉर्नर',
  centerTagline: 'आपल्या डिजिटल व बँकिंग सेवांसाठी सदैव तत्पर !',
  taluka: 'जळगाव',
  district: 'जळगाव',
  village: 'जळगाव',
  address: 'मुख्य बाजारपेठ, ग्रामपंचायत शेजारी',
  phones: ['+917972123605', '', ''],
};

const INITIAL_MASTER_BANNERS: MasterBanner[] = [
  {
    id: 'pmfby-rabbi-owner',
    title: 'PMFBY प्रधानमंत्री पीक विमा योजना २०२६ (बायोमेट्रिक e-KYC अनिवार्य)',
    category: 'पीक विमा',
    badge: '★ ओनर अधिकृत बॅनर',
    imageUrl: '/assets/aistudio/IMG-20261111-WA0003_a7b0df1a.jpg',
    dateAdded: 'आज',
    isDefault: true,
  },
];

const FOOTER_THEMES = [
  { name: 'रॉयल नेव्ही ब्लू', nameEn: 'Royal Navy Blue', bg: '#0a2540', text: '#ffffff', accent: '#f59e0b' },
  { name: 'शेतकरी हिरवा', nameEn: 'Agro Green', bg: '#064e3b', text: '#ffffff', accent: '#fbbf24' },
  { name: 'भगवा / सोनेरी', nameEn: 'Saffron & Gold', bg: '#7c2d12', text: '#ffffff', accent: '#fde047' },
  { name: 'क्लासिक डार्क', nameEn: 'Classic Dark', bg: '#0f172a', text: '#ffffff', accent: '#38bdf8' },
  { name: 'मॅरून लाल', nameEn: 'Maroon Red', bg: '#7f1d1d', text: '#ffffff', accent: '#fef08a' },
];

export const AiPosterGenerator: React.FC = () => {
  const { lang, t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Mode: 'user' (Public / Operator Mode) or 'owner' (Admin / Owner Upload Mode)
  const [appMode, setAppMode] = useState<'user' | 'owner'>('user');

  // Master Banners published by Owner (Firebase Cloud + Server Fallback + Built-in Default)
  const [cloudBanners, setCloudBanners] = useState<CloudOwnerPoster[]>([]);
  const [serverBanners, setServerBanners] = useState<MasterBanner[]>([]);
  const masterBanners = React.useMemo<MasterBanner[]>(() => {
    const mergedMap = new Map<string, MasterBanner>();
    for (const cb of cloudBanners) {
      mergedMap.set(cb.id, cb);
    }
    for (const sb of serverBanners) {
      if (!mergedMap.has(sb.id)) {
        mergedMap.set(sb.id, sb);
      }
    }
    for (const def of INITIAL_MASTER_BANNERS) {
      if (!mergedMap.has(def.id)) {
        mergedMap.set(def.id, def);
      }
    }
    return Array.from(mergedMap.values());
  }, [cloudBanners, serverBanners]);

  const [selectedBannerId, setSelectedBannerId] = useState<string>('pmfby-rabbi-owner');

  // Active Loaded Image for Canvas
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);

  // Center / Operator Branding Details
  const [center, setCenter] = useState<CenterDetails>(DEFAULT_CENTER_DETAILS);

  // Footer Banner Styling Options
  const [footerPlacement, setFooterPlacement] = useState<'overlay' | 'extend'>('overlay');
  const [selectedFooterTheme, setSelectedFooterTheme] = useState(FOOTER_THEMES[0]);
  const [footerHeight, setFooterHeight] = useState<number>(240);
  const [showWheatSheaves, setShowWheatSheaves] = useState<boolean>(true);
  const [showTalukaBadge, setShowTalukaBadge] = useState<boolean>(true);

  // Web Share & Notice State
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);

  // Owner Mode State (PIN + Firebase Google Admin Cloud Sync)
  const [ownerNewTitle, setOwnerNewTitle] = useState<string>('');
  const [ownerNewCategory, setOwnerNewCategory] = useState<string>('शासकीय योजना');
  const [ownerTempImage, setOwnerTempImage] = useState<string | null>(null);
  const [isOwnerPublishing, setIsOwnerPublishing] = useState<boolean>(false);
  const [ownerPasscode, setOwnerPasscode] = useState<string>('');
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [verifiedOwnerPin, setVerifiedOwnerPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState<boolean>(false);
  const [showPasscodePrompt, setShowPasscodePrompt] = useState<boolean>(false);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState<boolean>(false);
  const [cloudAuthError, setCloudAuthError] = useState<string>('');
  const [cloudLoadError, setCloudLoadError] = useState<string>('');
  const [isRefreshingPosters, setIsRefreshingPosters] = useState<boolean>(false);

  // 'My Posters' (Permanent IndexedDB Device Storage + Firebase Firestore Sync)
  const [myPosters, setMyPosters] = useState<UserSavedPoster[]>([]);
  const [isLoadingMyPosters, setIsLoadingMyPosters] = useState<boolean>(false);
  const [isSavingMyPoster, setIsSavingMyPoster] = useState<boolean>(false);
  const [isSyncingMyPosters, setIsSyncingMyPosters] = useState<boolean>(false);
  const [isMyPostersSigningIn, setIsMyPostersSigningIn] = useState<boolean>(false);
  const [myPostersError, setMyPostersError] = useState<string>('');
  const [deleteMyPosterConfirmId, setDeleteMyPosterConfirmId] = useState<string | null>(null);
  const [deletingMyPosterId, setDeletingMyPosterId] = useState<string | null>(null);
  const [previewMyPoster, setPreviewMyPoster] = useState<UserSavedPoster | null>(null);

  const isAuthorizedAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const isSignedInUser = Boolean(firebaseUser?.uid && firebaseUser?.emailVerified);
  const pendingCloudSyncCount = React.useMemo(
    () => myPosters.filter((p) => p.syncedToCloud !== true).length,
    [myPosters]
  );

  const loadUserMyPosters = useCallback(
    async (uid?: string | null, forceNetwork: boolean = false) => {
      try {
        const localMerged = await readAllPersistedUserPosters(uid);
        setMyPosters(localMerged);
      } catch {}

      if (!uid) {
        setMyPostersError('');
        return;
      }

      setIsLoadingMyPosters(true);
      setMyPostersError('');
      try {
        const items = await fetchMyPostersFromFirestore({ forceNetwork });
        setMyPosters(items);
      } catch (err: any) {
        if (isFirestoreQuotaError(err)) {
          setMyPostersError(
            t(
              'आजची Firebase मोफत दैनंदिन वाचन मर्यादा संपली आहे — परंतु तुमची सर्व पोस्टर्स डिव्हाइसवर कायमस्वरूपी सुरक्षित आहेत आणि उद्या कोटा रिसेट होताच Cloud वर सिंक होतील.',
              'Firebase daily free read quota is reached today — all your posters remain safely stored on this device and will sync with Cloud after quota resets.'
            )
          );
        } else {
          setMyPostersError(
            err?.message || t('Cloud सिंक करताना तात्पुरती अडचण आली (डिव्हाइसवरील पोस्टर्स सुरक्षित आहेत).', 'Cloud sync unavailable (device posters remain saved).')
          );
        }
      } finally {
        setIsLoadingMyPosters(false);
      }
    },
    [t]
  );

  const unsyncedServerBanners = React.useMemo(
    () => serverBanners.filter((sb) => !cloudBanners.some((cb) => cb.id === sb.id)),
    [serverBanners, cloudBanners]
  );

  const normalizePinInput = (val: string) =>
    val.trim().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));

  // Subscribe to Firebase Firestore Persistent Posters, Auth state & Server Posters
  useEffect(() => {
    try {
      localStorage.removeItem('maha_corner_owner_master_banners_v1');
      localStorage.removeItem('maha_corner_custom_owner_pin');
    } catch {}

    // Immediately load device-persisted 'My Posters' on boot (0 Firestore reads)
    void loadUserMyPosters(null, false);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user && (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase())) {
        setCloudAuthError(
          `प्रवेश मर्यादित: Cloud Save साठी फक्त अधिकृत Admin खाते (${ADMIN_EMAIL}) आवश्यक आहे.`
        );
      } else {
        setCloudAuthError('');
      }

      if (user?.uid && user.emailVerified) {
        void loadUserMyPosters(user.uid, false);
      } else {
        void loadUserMyPosters(null, false);
        setDeleteMyPosterConfirmId(null);
      }
    });

    let isMounted = true;

    const loadGalleryPosters = async () => {
      try {
        const cached = await readCachedOwnerPosters();
        if (isMounted && cached.length > 0) {
          setCloudBanners(cached);
        }
      } catch {}

      let serverLoadedCount = 0;
      let serverQuotaExceeded = false;
      try {
        const res = await fetch('/api/posters');
        const data = await res.json();
        if (isMounted && data?.success && Array.isArray(data.banners)) {
          serverLoadedCount = data.banners.length;
          serverQuotaExceeded = Boolean(data.quotaExceeded);
          setServerBanners(data.banners);
          if (data.banners.length > 0) {
            const normalizedCloud: CloudOwnerPoster[] = data.banners
              .filter((b: any) => b && b.id && b.imageUrl && !b.isDefault)
              .map((b: any, idx: number) => ({
                id: String(b.id),
                title: String(b.title || 'नवीन अधिकृत बॅनर'),
                category: String(b.category || 'शासकीय योजना'),
                badge: String(b.badge || '★ ओनर अधिकृत'),
                imageUrl: String(b.imageUrl),
                dateAdded: String(b.dateAdded || 'आज'),
                createdAtMs: Number(b.createdAtMs) || Date.now() - idx,
              }));
            if (normalizedCloud.length > 0) {
              setCloudBanners(normalizedCloud);
              void writeCachedOwnerPosters(normalizedCloud);
            }
          }
        }
      } catch {}

      if (!isMounted) return;

      if (serverLoadedCount > 0) {
        setCloudLoadError('');
        return;
      }

      if (serverQuotaExceeded) {
        setCloudLoadError(
          'आजची Firebase मोफत दैनंदिन वाचन मर्यादा (Free Daily Read Quota) पूर्ण झाली आहे — उद्या मर्यादा रीसेट होताच तुमची सर्व सेव्ह केलेली पोस्टर्स आपोआप दिसतील.'
        );
        return;
      }

      try {
        const posters = await fetchPublicOwnerPostersOnce();
        if (!isMounted) return;
        if (posters.length > 0) {
          setCloudBanners(posters);
        }
        setCloudLoadError('');
      } catch (err: any) {
        if (!isMounted) return;
        if (isFirestoreQuotaError(err)) {
          setCloudLoadError(
            'आजची Firebase मोफत दैनंदिन वाचन मर्यादा (Free Daily Read Quota) पूर्ण झाली आहे — उद्या मर्यादा रीसेट होताच तुमची सर्व सेव्ह केलेली पोस्टर्स आपोआप दिसतील.'
          );
        } else {
          setCloudLoadError(err?.message || 'Firebase Cloud poster sync failed');
        }
      }
    };

    void loadGalleryPosters();

    try {
      const savedShop = localStorage.getItem(SHOP_DETAILS_KEY);
      if (savedShop) {
        const parsed = JSON.parse(savedShop);
        const oldDemoPhones = ['9860792996', '8087172087', '8446792194'];
        const isOldDemoPhones =
          Array.isArray(parsed.phones) &&
          parsed.phones.length === oldDemoPhones.length &&
          parsed.phones.every((p: string, idx: number) => p === oldDemoPhones[idx]);
        setCenter((prev) => ({
          ...prev,
          ...parsed,
          phones:
            Array.isArray(parsed.phones) && parsed.phones.length > 0 && !isOldDemoPhones
              ? parsed.phones
              : prev.phones,
        }));
      }
    } catch (e) {
      console.error('Failed to load storage:', e);
    }

    return () => {
      isMounted = false;
      unsubAuth();
    };
  }, []);

  // Ensure selectedBannerId remains valid as posters load
  useEffect(() => {
    if (masterBanners.length > 0 && !masterBanners.some((b) => b.id === selectedBannerId)) {
      setSelectedBannerId(masterBanners[0].id);
    }
  }, [masterBanners, selectedBannerId]);

  // Save Center Details to LocalStorage
  const updateCenter = (field: keyof CenterDetails, val: any) => {
    setCenter((prev) => {
      const updated = { ...prev, [field]: val };
      try {
        localStorage.setItem(SHOP_DETAILS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const updatePhone = (index: number, val: string) => {
    setCenter((prev) => {
      const newPhones = [...prev.phones];
      newPhones[index] = val;
      const updated = { ...prev, phones: newPhones };
      try {
        localStorage.setItem(SHOP_DETAILS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Load the currently selected Master Banner image
  useEffect(() => {
    const current = masterBanners.find((b) => b.id === selectedBannerId) || masterBanners[0];
    if (current && current.imageUrl) {
      const img = new Image();
      img.src = current.imageUrl;
      img.onload = () => {
        setActiveImage(img);
      };
    }
  }, [selectedBannerId, masterBanners]);

  // Handle Banner Selection by user
  const handleSelectBanner = (banner: MasterBanner) => {
    setSelectedBannerId(banner.id);
    const img = new Image();
    img.src = banner.imageUrl;
    img.onload = () => {
      setActiveImage(img);
    };
  };

  const optimizePosterImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Owner: Handle New Master Poster Image Selection (Owner Only)
  const handleOwnerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOwnerAuthenticated || !verifiedOwnerPin) return;

    try {
      if (file.size > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
        setNotice({ type: 'error', text: t('इमेज २० MB पेक्षा लहान असावी.', 'Poster image must be under 20 MB.') });
        return;
      }
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'image');
      if (!inspection.valid || inspection.kind !== 'image') {
        setNotice({ type: 'error', text: t('कृपया वैध JPG/PNG/WEBP इमेज अपलोड करा.', 'Only valid JPG/PNG/WEBP raster images are allowed.') });
        return;
      }

      if (!ownerNewTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setOwnerNewTitle(cleanName);
      }

      const optimized = await optimizePosterImage(file);
      setOwnerTempImage(optimized);
    } catch {
      setNotice({
        type: 'error',
        text: t('इमेज लोड करताना त्रुटी आली.', 'Could not load poster image.'),
      });
    }
  };

  const handleGoogleCloudConnect = async (): Promise<boolean> => {
    setIsGoogleSigningIn(true);
    setCloudAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user?.email?.toLowerCase() || '';
      if (!cred.user?.emailVerified || email !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setCloudAuthError(
          t(
            `तुम्ही लॉगिन केलेला ईमेल (${email || 'अज्ञात'}) Admin नाही. कृपया ${ADMIN_EMAIL} ने लॉगिन करा.`,
            `Signed-in email (${email || 'unknown'}) is not authorized Admin (${ADMIN_EMAIL}).`
          )
        );
        return false;
      }
      setNotice({
        type: 'success',
        text: t(
          'Google Admin (Firebase Cloud) कनेक्ट झाले ✓ आता पोस्टर्स Cloud मध्ये सेव्ह राहतील!',
          'Google Admin connected ✓ Uploaded posters will sync to Firebase Cloud!'
        ),
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setCloudAuthError(
          t(
            'ब्राउझरने Google लॉगिन पॉप-अप ब्लॉक केले आहे. कृपया पॉप-अपला परवानगी द्या किंवा वरच्या "Google Admin लॉगिन जोडा" बटणावर थेट क्लिक करा.',
            'Browser blocked the Google Sign-In popup. Please allow popups and click Connect Google Admin.'
          )
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        setCloudAuthError(
          t(
            'हा डोमेन Firebase Auth मध्ये Authorized Domain म्हणून जोडलेला नाही.',
            'This domain is not authorized in Firebase Authentication settings.'
          )
        );
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setCloudAuthError(
          err?.message || t('Google लॉगिन करताना अडचण आली.', 'Failed to connect Google Admin account.')
        );
      }
      return false;
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleCloudDisconnect = async () => {
    await signOut(auth);
  };

  // Sign in any verified Google user for personal 'My Posters' Firebase Cloud sync
  const handleUserSignInForMyPosters = async (): Promise<boolean> => {
    setIsMyPostersSigningIn(true);
    setMyPostersError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!cred.user?.uid || !cred.user.emailVerified) {
        setMyPostersError(
          t(
            'कृपया पडताळणी झालेले (Verified) Google खाते वापरा.',
            'Please sign in with a verified Google account.'
          )
        );
        return false;
      }
      setNotice({
        type: 'success',
        text: t(
          'Google खाते कनेक्ट झाले ✓ आता तुमची सर्व पोस्टर्स डिव्हाइसवर व Firebase Cloud मध्ये सुरक्षित राहतील!',
          'Google account connected ✓ Your saved posters will now sync safely with Firebase Cloud!'
        ),
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setMyPostersError(
          t(
            'ब्राउझरने Google लॉगिन पॉप-अप ब्लॉक केले आहे. कृपया पॉप-अपला परवानगी देऊन पुन्हा क्लिक करा.',
            'Browser blocked the Google Sign-In popup. Please allow popups and try again.'
          )
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        setMyPostersError(
          t(
            'हा डोमेन Firebase Auth मध्ये Authorized Domain म्हणून जोडलेला नाही.',
            'This domain is not authorized in Firebase Authentication settings.'
          )
        );
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setMyPostersError(
          err?.message || t('Google लॉगिन करताना अडचण आली.', 'Failed to sign in with Google.')
        );
      }
      return false;
    } finally {
      setIsMyPostersSigningIn(false);
    }
  };

  // Save rendered branded poster cleanly (IndexedDB + Firestore when signed in)
  const handleSaveToMyPosters = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) {
      setNotice({
        type: 'error',
        text: t('कृपया आधी पोस्टर लोड होऊ द्या.', 'Please wait for the poster preview to load.'),
      });
      return;
    }

    setIsSavingMyPoster(true);
    setMyPostersError('');
    try {
      const selectedBanner =
        masterBanners.find((b) => b.id === selectedBannerId) || masterBanners[0];
      const imageDataUrl = canvas.toDataURL('image/png', 1.0);
      const { poster, cloudSynced, quotaExceeded } = await saveMyPosterHybrid({
        title: selectedBanner?.title || t('माझे ब्रँडेड पोस्टर', 'My Branded Poster'),
        centerName: center.centerName || 'महा कॉर्नर',
        category: selectedBanner?.category || 'शासकीय योजना',
        imageDataUrl,
      });

      setMyPosters((prev) => [poster, ...prev.filter((p) => p.id !== poster.id)]);
      confetti({ particleCount: 65, spread: 75 });
      trackFeatureAction('ai-poster');

      if (cloudSynced) {
        setNotice({
          type: 'success',
          text: t(
            'तुमचे पोस्टर डिव्हाइसवर व Firebase Cloud दोन्हीकडे कायमस्वरूपी सेव्ह झाले ✓ ते ऑटोमॅटिक डिलीट होणार नाही!',
            'Poster saved permanently to your device and Firebase Cloud ✓ It will never auto-delete!'
          ),
        });
      } else if (quotaExceeded) {
        setNotice({
          type: 'success',
          text: t(
            'पोस्टर डिव्हाइसवर कायमस्वरूपी सेव्ह झाले ✓ (Firebase कोटा रिसेट होताच Cloud वर सिंक होईल)',
            'Poster saved permanently on this device ✓ (Will sync with Firebase Cloud after quota reset)'
          ),
        });
      } else {
        setNotice({
          type: 'success',
          text: t(
            'तुमचे पोस्टर "माझ्या पोस्टर्स" मध्ये कायमस्वरूपी सेव्ह झाले ✓ वेबसाईट बंद केल्यानंतरही डिलीट होणार नाही.',
            'Saved permanently to My Posters on this device ✓'
          ),
        });
      }
    } catch (err: any) {
      const msg = err?.message || t('पोस्टर सेव्ह करताना त्रुटी आली.', 'Could not save poster to My Posters.');
      setMyPostersError(msg);
      setNotice({ type: 'error', text: msg });
    } finally {
      setIsSavingMyPoster(false);
    }
  };

  // Sync any pending device-saved posters up to Firestore when signed in
  const handleSyncPendingMyPosters = async () => {
    let signedIn = Boolean(auth.currentUser?.uid && auth.currentUser.emailVerified);
    if (!signedIn) {
      signedIn = await handleUserSignInForMyPosters();
      if (!signedIn) return;
    }

    setIsSyncingMyPosters(true);
    setMyPostersError('');
    try {
      const { syncedIds, failedQuota } = await syncPendingMyPostersToFirestore(myPosters);
      if (syncedIds.length > 0) {
        setMyPosters((prev) =>
          prev.map((p) => (syncedIds.includes(p.id) ? { ...p, syncedToCloud: true } : p))
        );
        setNotice({
          type: 'success',
          text: t(
            `${syncedIds.length} पोस्टर्स Firebase Cloud वर यशस्वीरित्या Sync झाले ✓`,
            `${syncedIds.length} poster(s) synced to Firebase Cloud ✓`
          ),
        });
      }
      if (failedQuota) {
        setMyPostersError(
          t(
            'Firebase दैनंदिन मर्यादा अजून पूर्ण आहे — उद्या मर्यादा रिसेट होताच पुन्हा Sync करा.',
            'Firebase daily quota is currently full — your posters are safe on this device and can sync once quota resets.'
          )
        );
      }
    } catch (err: any) {
      setMyPostersError(err?.message || t('Cloud Sync करताना त्रुटी आली.', 'Failed to sync posters to Cloud.'));
    } finally {
      setIsSyncingMyPosters(false);
    }
  };

  // Delete My Poster — manual 2-step confirmation only
  const handleDeleteMyPoster = async (poster: UserSavedPoster, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deleteMyPosterConfirmId !== poster.id) {
      setDeleteMyPosterConfirmId(poster.id);
      return;
    }

    setDeletingMyPosterId(poster.id);
    try {
      const { quotaExceeded } = await deleteMyPosterHybrid(poster.id, poster.syncedToCloud);
      setMyPosters((prev) => prev.filter((p) => p.id !== poster.id));
      setDeleteMyPosterConfirmId(null);
      if (previewMyPoster?.id === poster.id) {
        setPreviewMyPoster(null);
      }
      setNotice({
        type: 'info',
        text: quotaExceeded
          ? t('डिव्हाइसवरून पोस्टर डिलीट केले ✓ (Firebase कोटामुळे Cloud मधून उद्या हटवा)', 'Deleted from device ✓ (Firebase quota active)')
          : t('तुम्ही निवडलेले पोस्टर "माझ्या पोस्टर्स" मधून कायमचे डिलीट केले ✓', 'Selected poster deleted permanently from My Posters ✓'),
      });
    } catch (err: any) {
      const msg = err?.message || t('पोस्टर डिलीट करताना त्रुटी आली.', 'Failed to delete poster.');
      setMyPostersError(msg);
      setNotice({ type: 'error', text: msg });
    } finally {
      setDeletingMyPosterId(null);
    }
  };

  const handleDownloadSavedMyPoster = (poster: UserSavedPoster) => {
    const a = document.createElement('a');
    a.href = poster.imageUrl;
    const safeName = (poster.centerName || poster.title || 'my-poster')
      .slice(0, 18)
      .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
    a.download = `${safeName}-saved-poster.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    trackFeatureAction('ai-poster');
  };

  const handleSyncServerPostersToCloud = async () => {
    if (!isAuthorizedAdmin || unsyncedServerBanners.length === 0) return;
    setIsSyncingToCloud(true);
    try {
      const newlySaved: CloudOwnerPoster[] = [];
      for (const b of unsyncedServerBanners) {
        const saved = await saveOwnerPosterInFirestore({
          id: b.id,
          title: b.title,
          category: b.category,
          badge: b.badge || '★ ओनर अधिकृत',
          imageUrl: b.imageUrl,
          dateAdded: b.dateAdded || new Date().toLocaleDateString('mr-IN'),
        });
        newlySaved.push(saved);
      }
      if (newlySaved.length > 0) {
        setCloudBanners((prev) => [
          ...newlySaved,
          ...prev.filter((item) => !newlySaved.some((n) => n.id === item.id)),
        ]);
      }
      setNotice({
        type: 'success',
        text: t(
          `${unsyncedServerBanners.length} पोस्टर Firebase Cloud मध्ये कायमस्वरूपी सेव्ह झाले आहेत ✓`,
          `${unsyncedServerBanners.length} poster(s) synced permanently to Firebase Cloud ✓`
        ),
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || t('Cloud Sync करताना त्रुटी आली.', 'Cloud sync failed.'),
      });
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Owner: Publish New Master Poster to Server Gallery + Firebase Firestore
  const handlePublishOwnerBanner = async () => {
    if (!isOwnerAuthenticated || !verifiedOwnerPin) {
      setNotice({
        type: 'error',
        text: t('फक्त ओनरच पोस्टर अपलोड करू शकतात.', 'Only the verified owner can publish posters.'),
      });
      return;
    }

    if (!ownerTempImage) {
      setNotice({
        type: 'error',
        text: t('कृपया प्रथम पोस्टर इमेज अपलोड करा.', 'Please upload a poster image first.'),
      });
      return;
    }

    setIsOwnerPublishing(true);
    try {
      const cloudReadyImage = await compressPosterImageForCloud(ownerTempImage);
      const bannerTitle = ownerNewTitle.trim() || t('नवीन अधिकृत बॅनर', 'New Official Banner');
      const bannerCategory = ownerNewCategory || 'शासकीय योजना';
      const dateAddedStr = new Date().toLocaleDateString('mr-IN');
      const generatedPosterId = `owner-banner-${Date.now()}`;

      // 1. Publish to Server Gallery immediately (visible to all visitors)
      const res = await fetch('/api/posters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: verifiedOwnerPin,
          id: generatedPosterId,
          title: bannerTitle,
          category: bannerCategory,
          imageUrl: cloudReadyImage,
          dateAdded: dateAddedStr,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Could not publish poster to gallery.');
      }

      if (Array.isArray(data.banners)) {
        setServerBanners(data.banners);
      }

      const publishedPoster: CloudOwnerPoster = {
        id: generatedPosterId,
        title: bannerTitle,
        category: bannerCategory,
        badge: '★ ओनर अधिकृत',
        imageUrl: cloudReadyImage,
        dateAdded: dateAddedStr,
        createdAtMs: Date.now(),
      };

      setCloudBanners((prev) => {
        const next = [publishedPoster, ...prev.filter((item) => item.id !== publishedPoster.id)];
        void writeCachedOwnerPosters(next);
        return next;
      });
      setCloudLoadError('');

      // 2. Best-effort Firestore mirror if signed in as Admin (non-blocking)
      if (
        auth.currentUser?.emailVerified &&
        auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) {
        void saveOwnerPosterInFirestore({
          id: generatedPosterId,
          title: bannerTitle,
          category: bannerCategory,
          badge: '★ ओनर अधिकृत',
          imageUrl: cloudReadyImage,
          dateAdded: dateAddedStr,
        }).catch(() => {});
      }

      setSelectedBannerId(publishedPoster.id);
      setOwnerTempImage(null);
      setOwnerNewTitle('');
      setAppMode('user');

      confetti({ particleCount: 70, spread: 80 });
      setNotice({
        type: 'success',
        text: t(
          'नवीन पोस्टर गॅलरीमध्ये यशस्वीरित्या पब्लिश झाले ✓',
          'Poster published to live gallery successfully ✓'
        ),
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || t('पोस्टर सेव्ह करताना त्रुटी आली.', 'Could not save poster.'),
      });
    } finally {
      setIsOwnerPublishing(false);
    }
  };

  // Owner: Manual 2-step delete across Server Gallery + Firebase Firestore
  const handleDeleteOwnerBanner = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnerAuthenticated || !verifiedOwnerPin) return;

    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }

    setDeletingBannerId(id);
    try {
      try {
        const res = await fetch(`/api/posters/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedOwnerPin }),
        });
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data.banners)) {
          setServerBanners(data.banners);
        }
      } catch {}

      setCloudBanners((prev) => {
        const next = prev.filter((item) => item.id !== id);
        void writeCachedOwnerPosters(next);
        return next;
      });

      if (
        auth.currentUser?.emailVerified &&
        auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ) {
        void deleteOwnerPosterInFirestore(id).catch(() => {});
      }

      setDeleteConfirmId(null);
      setNotice({
        type: 'info',
        text: t('तुम्ही निवडलेले पोस्टर कायमचे डिलीट केले गेले ✓', 'Selected poster deleted permanently ✓'),
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || t('बॅनर काढताना त्रुटी आली.', 'Failed to remove banner.'),
      });
    } finally {
      setDeletingBannerId(null);
    }
  };

  // Owner Mode Authentication Toggle
  const handleOwnerModeToggle = () => {
    if (isOwnerAuthenticated && verifiedOwnerPin) {
      setAppMode(appMode === 'owner' ? 'user' : 'owner');
    } else {
      setPinError('');
      setOwnerPasscode('');
      setShowPasscodePrompt(true);
    }
  };

  const handleLockOwnerMode = () => {
    setIsOwnerAuthenticated(false);
    setVerifiedOwnerPin('');
    setOwnerPasscode('');
    setOwnerTempImage(null);
    setAppMode('user');
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPin = normalizePinInput(ownerPasscode);
    if (!cleanedPin) {
      setPinError(t('कृपया ओनर पासवर्ड टाका.', 'Please enter Owner PIN.'));
      return;
    }

    setIsVerifyingPin(true);
    setPinError('');
    try {
      const res = await fetch('/api/posters/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanedPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && data?.error) {
          setPinError(data.error);
        } else {
          setPinError(t('चुकीचा पासवर्ड! फक्त ओनरच येथे पोस्टर अपलोड करू शकतात.', 'Incorrect PIN! Poster upload is strictly restricted to the Owner.'));
        }
        return;
      }
      setVerifiedOwnerPin(cleanedPin);
      setIsOwnerAuthenticated(true);
      setShowPasscodePrompt(false);
      setAppMode('owner');
      setOwnerPasscode('');
      setPinError('');
    } catch {
      setPinError(t('पडताळणी करताना त्रुटी आली.', 'Verification failed. Please try again.'));
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Helper rounded rect
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string,
    lineWidth: number = 2
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  };

  // Draw wheat sheaf decoration
  const drawWheatSheaf = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    flip: boolean = false
  ) => {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    ctx.fillStyle = selectedFooterTheme.accent || '#fbbf24';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;

    // Stem
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.quadraticCurveTo(5, 10, 15, -30);
    ctx.stroke();

    // Grains
    for (let i = 0; i < 6; i++) {
      const gy = -25 + i * 11;
      const gx = 12 - i * 1.5;
      ctx.beginPath();
      ctx.ellipse(gx - 8, gy, 4, 9, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(gx + 8, gy - 2, 4, 9, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw Center Footer Branding on Canvas
  const drawCenterFooter = (
    ctx: CanvasRenderingContext2D,
    w: number,
    footerY: number,
    fHeight: number
  ) => {
    // 1. Background Bar
    ctx.fillStyle = selectedFooterTheme.bg;
    ctx.fillRect(0, footerY, w, fHeight);

    // 2. Top Golden Stripe
    ctx.fillStyle = selectedFooterTheme.accent;
    ctx.fillRect(0, footerY, w, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, footerY + 6, w, 2);

    // 3. Optional Wheat Ears on Left & Right
    if (showWheatSheaves) {
      drawWheatSheaf(ctx, 35, footerY + fHeight / 2 - 10, 1.7, false);
      drawWheatSheaf(ctx, w - 35, footerY + fHeight / 2 - 10, 1.7, true);
    }

    // 4. Vertical Separator Bar
    const splitX = Math.round(w * 0.62);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(splitX, footerY + 20);
    ctx.lineTo(splitX, footerY + fHeight - 20);
    ctx.stroke();

    // 5. LEFT COLUMN: Center Name, Taluka/District Badge, Tagline & Address
    const leftMargin = showWheatSheaves ? 85 : 45;
    ctx.textAlign = 'left';

    // Center Name
    ctx.fillStyle = selectedFooterTheme.text;
    ctx.font = '900 46px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(center.centerName || 'आपले सरकार सेवा केंद्र', leftMargin, footerY + 68);

    // Taluka / District Location Tag Badge
    let nextY = footerY + 115;
    if (showTalukaBadge && (center.taluka || center.district || center.village)) {
      const locText = [
        center.village ? `गाव: ${center.village}` : '',
        center.taluka ? `ता. ${center.taluka}` : '',
        center.district ? `जि. ${center.district}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      if (locText) {
        ctx.font = '800 22px "Noto Sans Devanagari", sans-serif';
        const badgeWidth = ctx.measureText(locText).width + 30;
        drawRoundedRect(
          ctx,
          leftMargin,
          nextY - 22,
          badgeWidth,
          32,
          8,
          'rgba(245, 158, 11, 0.2)',
          selectedFooterTheme.accent,
          1.5
        );
        ctx.fillStyle = selectedFooterTheme.accent;
        ctx.fillText(locText, leftMargin + 15, nextY + 2);
        nextY += 42;
      }
    }

    // Tagline
    if (center.centerTagline) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 23px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(center.centerTagline, leftMargin, nextY);
      nextY += 34;
    }

    // Address
    if (center.address) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 20px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(`पत्ता: ${center.address}`, leftMargin, nextY);
    }

    // 6. RIGHT COLUMN: Phone Circle + Phone Numbers Stack
    const phoneIconX = splitX + 55;
    const phoneIconY = footerY + fHeight / 2 - 5;

    // Golden Phone Circle
    ctx.beginPath();
    ctx.arc(phoneIconX, phoneIconY, 40, 0, Math.PI * 2);
    ctx.fillStyle = selectedFooterTheme.accent;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📞', phoneIconX, phoneIconY + 11);

    // Phone Numbers
    const validPhones = center.phones.filter(Boolean);
    const phoneTextX = phoneIconX + 52;
    const phoneRightBound = w - (showWheatSheaves ? 78 : 28);
    const maxPhoneWidth = Math.max(120, phoneRightBound - phoneTextX);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';

    if (validPhones.length === 1) {
      ctx.font = `900 ${validPhones[0].length > 10 ? 34 : 40}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText(validPhones[0], phoneTextX, phoneIconY + 12, maxPhoneWidth);
    } else if (validPhones.length === 2) {
      ctx.font = '900 32px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(validPhones[0], phoneTextX, phoneIconY - 8, maxPhoneWidth);
      ctx.fillText(validPhones[1], phoneTextX, phoneIconY + 34, maxPhoneWidth);
    } else if (validPhones.length >= 3) {
      ctx.font = '900 28px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(validPhones[0], phoneTextX, phoneIconY - 26, maxPhoneWidth);
      ctx.fillText(validPhones[1], phoneTextX, phoneIconY + 11, maxPhoneWidth);
      ctx.fillText(validPhones[2], phoneTextX, phoneIconY + 48, maxPhoneWidth);
    }
  };

  // Main Canvas Render
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!activeImage) {
      canvas.width = 1080;
      canvas.height = 1920;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px "Noto Sans Devanagari", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('बॅनर लोड होत आहे...', 540, 960);
      return;
    }

    const imgW = activeImage.naturalWidth || 1080;
    const imgH = activeImage.naturalHeight || 1920;

    // Standardize render width to high quality (1080px base)
    const renderW = 1080;
    const scale = renderW / imgW;
    const originalRenderH = Math.round(imgH * scale);

    const fHeight = footerHeight;

    if (footerPlacement === 'extend') {
      // EXTEND MODE: Canvas height is increased by footer height (No poster content is covered!)
      const totalH = originalRenderH + fHeight;
      canvas.width = renderW;
      canvas.height = totalH;

      // Draw original poster on top
      ctx.drawImage(activeImage, 0, 0, renderW, originalRenderH);

      // Draw center branding in newly added bottom section
      drawCenterFooter(ctx, renderW, originalRenderH, fHeight);
    } else {
      // OVERLAY MODE: Standard WhatsApp/Status size (covers bottom footer area)
      canvas.width = renderW;
      canvas.height = originalRenderH;

      // Draw image
      ctx.drawImage(activeImage, 0, 0, renderW, originalRenderH);

      // Draw footer overlay on bottom
      const footerY = originalRenderH - fHeight;
      drawCenterFooter(ctx, renderW, footerY, fHeight);
    }
  }, [
    activeImage,
    center,
    footerPlacement,
    selectedFooterTheme,
    footerHeight,
    showWheatSheaves,
    showTalukaBadge,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Download High-Res PNG
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const a = document.createElement('a');
    a.href = dataUrl;
    const safeName = (center.centerName || 'maha-corner')
      .slice(0, 15)
      .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
    a.download = `${safeName}-final-poster.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    confetti({ particleCount: 70, spread: 80 });
    trackFeatureAction('ai-poster');
  };

  // Download A4 PDF
  const handleDownloadPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfW = 210;
      const pdfH = 297;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

      const safeName = (center.centerName || 'poster')
        .slice(0, 15)
        .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
      await saveValidatedJsPdf(pdf, `${safeName}-a4-poster.pdf`, 1);

      confetti({ particleCount: 50, spread: 60 });
      trackFeatureAction('ai-poster');
    } catch (err) {
      console.error('Validated poster PDF export failed:', err);
      setNotice({
        type: 'error',
        text: t('PDF पडताळणी दरम्यान त्रुटी आली. कृपया पुन्हा प्रयत्न करा.', 'PDF validation failed during export. Please retry.'),
      });
    }
  };

  // Build WhatsApp Share Caption & URL
  const buildWhatsAppCaption = (customText?: string) => {
    const loc = [
      center.village ? `गाव: ${center.village}` : '',
      center.taluka ? `ता. ${center.taluka}` : '',
      center.district ? `जि. ${center.district}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const baseCaption =
      customText ||
      `📢 *महत्त्वाची व आनंदाची बातमी !*\n\n📍 *केंद्राचे नाव:* ${center.centerName}\n${loc ? `📌 *पत्ता:* ${loc}\n` : ''}${center.address ? `🏠 ${center.address}\n` : ''}📞 *मोबाईल संपर्क:* ${center.phones.filter(Boolean).join(' / ')}\n\n✨ *${center.centerTagline}*\n\n_सर्व शासकीय योजना, पीक विमा, आधार, पॅन व ऑनलाइन कामांसाठी आजच आमच्या केंद्रावर भेट द्या!_`;

    return appendPortalLink(baseCaption, lang);
  };

  const whatsappTextUrl = buildWhatsAppShareUrl(buildWhatsAppCaption(), lang);

  // Fallback to clipboard copy + notice if Web Share isn't available
  const copyCaptionFallback = async (text?: string) => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppCaption(text));
      setNotice({
        type: 'info',
        text: t(
          'मजकूर क्लिपबोर्डवर कॉपी केला! खालील "WhatsApp टेक्स्ट" बटणावरून पाठवू शकता.',
          'Caption copied! You can send it via the WhatsApp Text button below.'
        ),
      });
    } catch {
      setNotice({
        type: 'info',
        text: t(
          'पोस्टर शेअर करण्यासाठी खालील "WhatsApp टेक्स्ट" किंवा डाउनलोड बटण वापरा.',
          'Use the WhatsApp Text or Download button below to share this poster.'
        ),
      });
    }
  };

  // Web Share API to directly share the generated image file to WhatsApp
  const handleShareOnWhatsApp = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSharing(true);
    trackFeatureAction('ai-poster');
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsSharing(false);
          copyCaptionFallback();
          return;
        }

        const safeName = (center.centerName || 'maha-corner')
          .slice(0, 15)
          .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
        const imageFile = new File([blob], `${safeName}-poster.png`, {
          type: 'image/png',
        });

        const shareText = appendPortalLink(
          `📢 *${center.centerName || 'महा कॉर्नर'}*\n${center.taluka ? `ता. ${center.taluka}, ` : ''}${center.district ? `जि. ${center.district}` : ''}\n📞 संपर्क: ${center.phones.filter(Boolean).join(' / ')}\n${center.centerTagline}`,
          lang
        );

        if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          try {
            await navigator.share({
              files: [imageFile],
              title: center.centerName || 'महा कॉर्नर पोस्टर',
              text: shareText,
            });
            confetti({ particleCount: 50, spread: 60 });
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              copyCaptionFallback(shareText);
            }
          }
        } else if (navigator.share) {
          try {
            await navigator.share({
              title: center.centerName || 'महा कॉर्नर पोस्टर',
              text: shareText,
              url: MAHA_CORNER_URL,
            });
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              copyCaptionFallback(shareText);
            }
          }
        } else {
          copyCaptionFallback(shareText);
        }

        setIsSharing(false);
      }, 'image/png');
    } catch (e) {
      console.error('Error sharing image on WhatsApp:', e);
      setIsSharing(false);
      copyCaptionFallback();
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        trackFeatureAction('ai-poster');
        setNotice({
          type: 'success',
          text: t(
            'पोस्टर इमेज क्लिपबोर्डवर कॉपी झाली! (WhatsApp वर Ctrl+V करून थेट पाठवू शकता) ✓',
            'Poster image copied to clipboard! (Paste directly into WhatsApp with Ctrl+V) ✓'
          ),
        });
      });
    } catch (e) {
      setNotice({
        type: 'error',
        text: t(
          'इमेज कॉपीसाठी कृपया वरील डाउनलोड बटण वापरावे.',
          'Clipboard copy unavailable in this browser. Please use the Download button above.'
        ),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Inline Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-sm ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="px-2 py-0.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIP Premium Poster Packs Golden Highlight Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-slate-950 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 border border-amber-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
              <span>{t('👑 ५०+ रेडीमेड व्हीआयपी पोस्टर्स पॅक (लाडकी बहीण, PM किसान, पीक विमा, भरती)', '50+ Ready-made VIP Poster Packs (Govt Schemes, Farmer, Jobs)')}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black uppercase">
                VIP 4K
              </span>
            </h4>
            <p className="text-[11px] text-slate-900 font-semibold">
              {t('थेट 4K Ultra HD प्रिंट क्वालिटी, वॉटरमार्क नसलेले ओरिजिनल डिझाईन्स व थेट UPI पेमेंट.', 'Ultra HD 4K Print Quality, No Watermark & Direct UPI Access.')}
            </p>
          </div>
        </div>
        <a
          href="#vip"
          className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          {t('VIP पॅक पहा (फक्त ₹४९) →', 'View VIP Packs (From ₹49) →')}
        </a>
      </div>

      {/* Top Banner & Mode Toggle */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-emerald-950 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-500/20">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {t('अधिकृत ओनर बॅनर गॅलरी व केंद्र ब्रँडिंग पोर्टल', 'Official Banner Gallery & Center Branding Studio')}
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black">
            {t('🖼️ अधिकृत बॅनर निवडा व आपले नाव-नंबर जोडा', '🖼️ Pick an Official Banner & Add Your Shop Branding')}
          </h2>
          <p className="text-sm sm:text-base text-slate-200">
            {t(
              'येथे ओनरने अपलोड केलेले अधिकृत शासकीय व शेतकरी बॅनर उपलब्ध आहेत. आपण खालील गॅलरीतून हवे ते बॅनर निवडून त्यावर आपले नाव, गाव, तालुका व मोबाईल नंबर जोडू शकता आणि थेट WhatsApp स्टेटस किंवा प्रिंटसाठी तयार करू शकता!',
              'Choose from official government scheme and farmer posters below, stamp your center name, village, taluka, district, and phone numbers at the bottom, and export for WhatsApp Status or A4 print.'
            )}
          </p>
        </div>

        {/* Owner Panel Access Button (Strictly Locked — Citizens Cannot Upload Posters) */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOwnerModeToggle}
            title={t('फक्त ओनरसाठी पोस्टर अपलोड लॉक', 'Owner-Only Poster Upload Lock')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              appMode === 'owner' && isOwnerAuthenticated
                ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700/80'
            }`}
          >
            {appMode === 'owner' && isOwnerAuthenticated ? (
              <Unlock className="w-3.5 h-3.5 text-slate-950" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {appMode === 'owner' && isOwnerAuthenticated
                ? t('ओनर मोड सुरू (बंद करा)', 'Owner Mode Active')
                : t('ओनर लॉक', 'Owner Lock')}
            </span>
          </button>
        </div>
      </div>

      {/* Owner Passcode Prompt Modal (No PIN revealed) */}
      {showPasscodePrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <KeyRound className="w-5 h-5" />
              <span>{t('फक्त ओनरसाठी (Owner Only)', 'Owner Verification')}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t(
                'पोस्टर अपलोड करण्याची सुविधा सामान्य नागरिकांसाठी बंद आहे. फक्त ओनर पासवर्ड टाकून येथे नवीन पोस्टर अपलोड करू शकतात:',
                'Poster uploading is disabled for citizens. Only the Owner can unlock and upload official posters:'
              )}
            </p>
            <form onSubmit={handleVerifyPasscode} className="space-y-3">
              <div className="relative">
                <input
                  type={showPinText ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  autoFocus
                  placeholder={t('ओनर पासवर्ड टाका...', 'Enter Owner PIN...')}
                  value={ownerPasscode}
                  onChange={(e) => {
                    setOwnerPasscode(e.target.value);
                    setPinError('');
                  }}
                  className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-sm text-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText((v) => !v)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-amber-300 cursor-pointer"
                  aria-label={showPinText ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pinError && <p className="text-xs text-rose-400 font-semibold">{pinError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodePrompt(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  {t('रद्द करा', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 disabled:opacity-60 text-slate-950 text-xs font-black cursor-pointer"
                >
                  {isVerifyingPin ? t('तपासत आहे...', 'Checking...') : t('अनलॉक करा', 'Unlock')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OWNER UPLOAD PANEL (Strictly shown only after server-side PIN verification) */}
      {appMode === 'owner' && isOwnerAuthenticated && verifiedOwnerPin && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border-2 border-amber-400 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-300">
            <div className="flex items-center gap-2 text-amber-950">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-black">
                {t('👑 ओनर पॅनेल: सर्व वापरकर्त्यांसाठी नवीन बॅनर पब्लिश करा', '👑 Owner Panel: Publish New Banner to Gallery')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                {t('ओनर ॲडमिन मोड', 'Owner Admin Mode')}
              </span>
              <button
                type="button"
                onClick={handleLockOwnerMode}
                className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>{t('लॉक करा', 'Lock')}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-900">
            {t(
              'येथे तुम्ही अपलोड केलेले पोस्टर सर्व सामान्य नागरिक व सीएससी चालकांना गॅलरीमध्ये दिसेल. ते या पोस्टरवर स्वतःचे नाव, गाव, तालुका व मोबाईल नंबर जोडून डाऊनलोड करू शकतील.',
              'Posters published here appear in the gallery so citizens and CSC operators can add their shop branding and download them.'
            )}
          </p>

          {/* Firebase Cloud Admin Sync Bar */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
              isAuthorizedAdmin
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-white border-amber-300 text-slate-900'
            }`}
          >
            <div className="space-y-0.5 text-xs">
              <div className="font-black flex items-center gap-1.5">
                <ShieldCheck
                  className={`w-4 h-4 ${isAuthorizedAdmin ? 'text-emerald-600' : 'text-amber-600'}`}
                />
                <span>
                  {isAuthorizedAdmin
                    ? t(
                        `Firebase Cloud Admin सक्रिय (${firebaseUser?.email}) ✓`,
                        `Firebase Cloud Admin Active (${firebaseUser?.email}) ✓`
                      )
                    : t(
                        'Firebase Cloud Sync (ऐच्छिक) — पोस्टर्स गॅलरी सर्व्हर + Firebase मध्ये सुरक्षित राहतात',
                        'Firebase Cloud Sync (Optional) — Connect Google Admin for Firebase Mirror'
                      )}
                </span>
              </div>
              <p className="text-[11px] opacity-85">
                {t(
                  'येथून अपलोड केलेली सर्व पोस्टर्स थेट वेबसाइट गॅलरीमध्ये दिसतात आणि Firebase Firestore मध्ये सिंक राहतात.',
                  'Published posters appear live for all visitors and sync with Firebase Firestore.'
                )}
              </p>
              {cloudAuthError && (
                <p className="text-[11px] font-bold text-rose-600">{cloudAuthError}</p>
              )}
              {cloudLoadError && (
                <p className="text-[11px] font-bold text-rose-600">Sync Note: {cloudLoadError}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isAuthorizedAdmin && (
                <button
                  type="button"
                  disabled={isGoogleSigningIn}
                  onClick={() => void handleGoogleCloudConnect()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 shadow-xs text-slate-800 text-xs font-black cursor-pointer disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isGoogleSigningIn
                      ? t('कनेक्ट होत आहे...', 'Connecting...')
                      : t('Google Admin लॉगिन जोडा', 'Connect Google Admin')}
                  </span>
                </button>
              )}

              {isAuthorizedAdmin && unsyncedServerBanners.length > 0 && (
                <button
                  type="button"
                  disabled={isSyncingToCloud}
                  onClick={handleSyncServerPostersToCloud}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToCloud ? 'animate-spin' : ''}`} />
                  <span>{t(`Firestore Sync (${unsyncedServerBanners.length})`, `Firestore Sync (${unsyncedServerBanners.length})`)}</span>
                </button>
              )}

              {isAuthorizedAdmin && (
                <button
                  type="button"
                  onClick={handleGoogleCloudDisconnect}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{t('लॉगआउट', 'Sign Out')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Left: Upload and Details */}
            <div className="md:col-span-8 space-y-3">
              <div>
                <label className="text-xs font-bold text-amber-950 block mb-1">
                  {t('बॅनरचे शीर्षक (Title):', 'Banner Title:')}
                </label>
                <input
                  type="text"
                  placeholder={t('उदा. PMFBY रब्बी पीक विमा २०२६ (बायोमेट्रिक e-KYC)', 'e.g., PMFBY Rabi Crop Insurance 2026')}
                  value={ownerNewTitle}
                  onChange={(e) => setOwnerNewTitle(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-amber-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-amber-950 block mb-1">
                    {t('श्रेणी (Category):', 'Category:')}
                  </label>
                  <select
                    value={ownerNewCategory}
                    onChange={(e) => setOwnerNewCategory(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-amber-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="पीक विमा">{t('पीक विमा (PMFBY)', 'Crop Insurance (PMFBY)')}</option>
                    <option value="महिला योजना">{t('महिला योजना (लाडकी बहीण)', 'Women Scheme (Ladki Bahin)')}</option>
                    <option value="शेतकरी योजना">{t('शेतकरी योजना (पीएम किसान)', 'Farmer Scheme (PM-Kisan)')}</option>
                    <option value="आधार सेवा">{t('आधार कार्ड सेवा', 'Aadhaar Services')}</option>
                    <option value="पॅन कार्ड">{t('पॅन कार्ड सेवा', 'PAN Card Services')}</option>
                    <option value="आरोग्य योजना">{t('आरोग्य योजना (आयुष्मान भारत)', 'Health Scheme (Ayushman)')}</option>
                    <option value="शासकीय नोकरी भरती">{t('शासकीय नोकरी भरती', 'Govt Recruitment')}</option>
                    <option value="इतर शासकीय सेवा">{t('इतर शासकीय सेवा', 'Other Govt Services')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-950 block mb-1">
                    {t('बॅनर फाईल निवडा:', 'Select Banner Image:')}
                  </label>
                  <button
                    type="button"
                    onClick={() => ownerFileInputRef.current?.click()}
                    className="w-full h-11 px-3 rounded-xl bg-white hover:bg-amber-100/70 border border-amber-400 text-amber-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-amber-700" />
                    <span>
                      {ownerTempImage
                        ? t('बॅनर बदलण्यात आले ✓', 'Banner Image Selected ✓')
                        : t('इमेज निवडा (JPG/PNG)', 'Choose Image (JPG/PNG)')}
                    </span>
                  </button>
                  <input
                    ref={ownerFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleOwnerFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!ownerTempImage || isOwnerPublishing}
                onClick={handlePublishOwnerBanner}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
                <span>
                  {isOwnerPublishing
                    ? t('पब्लिश होत आहे...', 'Publishing...')
                    : t('🚀 हे बॅनर सर्व वापरकर्त्यांसाठी पब्लिश करा', '🚀 Publish Banner to Gallery')}
                </span>
              </button>
            </div>

            {/* Right: Uploaded Image Preview */}
            <div className="md:col-span-4 bg-white p-3 rounded-2xl border border-amber-300 shadow-sm flex flex-col items-center justify-center min-h-[180px]">
              {ownerTempImage ? (
                <div className="space-y-1.5 w-full text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block">
                    {t('अपलोड केलेले बॅनर प्रिव्ह्यू', 'Uploaded Banner Preview')}
                  </span>
                  <img
                    src={ownerTempImage}
                    alt={t('नवीन बॅनर', 'New banner')}
                    className="w-full h-40 object-contain rounded-lg border border-slate-200"
                  />
                </div>
              ) : (
                <div className="text-center p-4 space-y-1 text-amber-800/80">
                  <ImageIcon className="w-10 h-10 mx-auto text-amber-500/70" />
                  <span className="text-xs font-bold block">{t('येथे बॅनर प्रिव्ह्यू दिसेल', 'Banner preview appears here')}</span>
                  <span className="text-[10px] text-slate-500 block">
                    {t('कृपया डाव्या बाजूने इमेज निवडा', 'Please choose an image on the left')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🎯 SECTION 1: MASTER BANNER GALLERY (The Owner's Published Banners) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Grid className="w-5 h-5 text-blue-600" />
              {t('अधिकृत बॅनर गॅलरी (Select Banner):', 'Official Banner Gallery (Select Poster):')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {t(
                'ओनरने पब्लिश केलेल्या खालील बॅनरमधून निवडा आणि त्यावर आपले नाव, गाव व नंबर जोडा:',
                'Select a poster below and personalize its footer with your center name, village, taluka, and contact numbers:'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRefreshingPosters}
              onClick={async () => {
                setIsRefreshingPosters(true);
                try {
                  const res = await fetch('/api/posters?refresh=1');
                  const data = await res.json();
                  if (data?.success && Array.isArray(data.banners) && data.banners.length > 0) {
                    setServerBanners(data.banners);
                    const normalizedCloud: CloudOwnerPoster[] = data.banners
                      .filter((b: any) => b && b.id && b.imageUrl && !b.isDefault)
                      .map((b: any, idx: number) => ({
                        id: String(b.id),
                        title: String(b.title || 'नवीन अधिकृत बॅनर'),
                        category: String(b.category || 'शासकीय योजना'),
                        badge: String(b.badge || '★ ओनर अधिकृत'),
                        imageUrl: String(b.imageUrl),
                        dateAdded: String(b.dateAdded || 'आज'),
                        createdAtMs: Number(b.createdAtMs) || Date.now() - idx,
                      }));
                    if (normalizedCloud.length > 0) {
                      setCloudBanners(normalizedCloud);
                      void writeCachedOwnerPosters(normalizedCloud);
                      setCloudLoadError('');
                    }
                  } else if (data?.quotaExceeded) {
                    setCloudLoadError(
                      'आजची Firebase मोफत दैनंदिन वाचन मर्यादा (Free Daily Read Quota) पूर्ण झाली आहे — उद्या मर्यादा रीसेट होताच तुमची सर्व सेव्ह केलेली पोस्टर्स आपोआप दिसतील.'
                    );
                  }
                } catch {}
                finally {
                  setIsRefreshingPosters(false);
                }
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
              title={t('गॅलरी रिफ्रेश करा', 'Refresh gallery')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPosters ? 'animate-spin' : ''}`} />
              <span>{t('रिफ्रेश', 'Refresh')}</span>
            </button>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              {t(`एकूण बॅनर: ${masterBanners.length}`, `Total Banners: ${masterBanners.length}`)}
            </span>
          </div>
        </div>

        {cloudLoadError && masterBanners.length <= INITIAL_MASTER_BANNERS.length && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1">
            <div className="font-black flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {t(
                  'Firebase Cloud दैनंदिन वाचन मर्यादा तात्पुरती पूर्ण झाली आहे',
                  'Firebase Daily Free Read Limit Reached Temporarily'
                )}
              </span>
            </div>
            <p className="leading-relaxed">{cloudLoadError}</p>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {masterBanners.map((banner) => {
            const isSelected = selectedBannerId === banner.id;
            const isSavedInCloud = cloudBanners.some((cb) => cb.id === banner.id);
            const isConfirmingDelete = deleteConfirmId === banner.id;
            const isDeletingThis = deletingBannerId === banner.id;
            return (
              <div
                key={banner.id}
                onClick={() => handleSelectBanner(banner)}
                className={`group relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 ring-4 ring-emerald-500/20 shadow-lg scale-[1.02]'
                    : 'border-slate-200 hover:border-blue-400 bg-white hover:shadow-md'
                }`}
              >
                {/* Banner Thumbnail */}
                <div className="aspect-[9/14] bg-slate-100 overflow-hidden relative">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full shadow-md">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  {appMode === 'owner' && isOwnerAuthenticated && !banner.isDefault && (
                    <div
                      className={`absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm ${
                        isSavedInCloud
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {isSavedInCloud ? t('☁️ कायम सेव्ह', '☁️ Cloud Saved') : t('⚠️ तात्पुरते', '⚠️ Local')}
                    </div>
                  )}
                  {banner.badge && (
                    <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/40">
                      {banner.badge}
                    </div>
                  )}
                </div>

                {/* Card Title & Info */}
                <div className="p-2.5 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    {banner.category}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                    {banner.title}
                  </h4>
                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-emerald-700">
                      {isSelected ? t('✓ निवडलेले', '✓ Selected') : t('हे वापरा', 'Use This')}
                    </span>
                    {appMode === 'owner' && isOwnerAuthenticated && !banner.isDefault && (
                      isConfirmingDelete ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={(e) => handleDeleteOwnerBanner(banner.id, e)}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[10px] font-black cursor-pointer"
                          >
                            {isDeletingThis ? '...' : t('हो, डिलीट', 'Yes')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer"
                          >
                            {t('रद्द', 'No')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteOwnerBanner(banner.id, e)}
                          className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title={t('फक्त ओनरसाठी डिलीट पर्याय', 'Owner-only delete')}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('डिलीट', 'Delete')}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🎯 SECTION 2: CUSTOMIZE & BRANDING (Controls 7 cols | Live Preview 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* User / Center Details Form */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                {t('आपले नाव, गाव, तालुका व मोबाईल नंबर ॲड करा:', 'Add Your Shop Name, Village, Taluka & Mobile:')}
              </h3>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('कायम सेव्ह राहते (Auto-Saved)', 'Auto-Saved')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Center / Shop Name */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('आपल्या केंद्राचे / दुकानाचे नाव:', 'Center / Shop Name:')}
                </label>
                <input
                  type="text"
                  value={center.centerName}
                  onChange={(e) => updateCenter('centerName', e.target.value)}
                  placeholder={t('उदा. महा कॉर्नर / आपले सरकार सेवा केंद्र', 'e.g., Maha Corner / Maha E-Seva Kendra')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Village / Town */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('गाव / शहर:', 'Village / Town:')}
                </label>
                <input
                  type="text"
                  value={center.village}
                  onChange={(e) => updateCenter('village', e.target.value)}
                  placeholder={t('उदा. जळगाव', 'e.g., Jalgaon')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Taluka */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('तालुका:', 'Taluka:')}
                </label>
                <input
                  type="text"
                  value={center.taluka}
                  onChange={(e) => updateCenter('taluka', e.target.value)}
                  placeholder={t('उदा. जळगाव', 'e.g., Jalgaon')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* District */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('जिल्हा:', 'District:')}
                </label>
                <input
                  type="text"
                  value={center.district}
                  onChange={(e) => updateCenter('district', e.target.value)}
                  placeholder={t('उदा. जळगाव', 'e.g., Jalgaon')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('टॅगलाईन / ब्रीदवाक्य:', 'Tagline / Slogan:')}
                </label>
                <input
                  type="text"
                  value={center.centerTagline}
                  onChange={(e) => updateCenter('centerTagline', e.target.value)}
                  placeholder={t('आपल्या डिजिटल व बँकिंग सेवांसाठी सदैव तत्पर !', 'Always ready for your digital & banking needs!')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Mobile 1 */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('मोबाईल नंबर १:', 'Mobile Number 1:')}
                </label>
                <input
                  type="text"
                  value={center.phones[0] || ''}
                  onChange={(e) => updatePhone(0, e.target.value)}
                  placeholder="+917972123605"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Mobile 2 */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('मोबाईल नंबर २ (ऐच्छिक):', 'Mobile Number 2 (Optional):')}
                </label>
                <input
                  type="text"
                  value={center.phones[1] || ''}
                  onChange={(e) => updatePhone(1, e.target.value)}
                  placeholder={t('ऐच्छिक मोबाईल नंबर', 'Optional mobile number')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Mobile 3 */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('मोबाईल नंबर ३ (ऐच्छिक):', 'Mobile Number 3 (Optional):')}
                </label>
                <input
                  type="text"
                  value={center.phones[2] || ''}
                  onChange={(e) => updatePhone(2, e.target.value)}
                  placeholder={t('ऐच्छिक मोबाईल नंबर', 'Optional mobile number')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Full Address */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('संपूर्ण पत्ता / लोकेशन:', 'Full Address / Landmark:')}
                </label>
                <input
                  type="text"
                  value={center.address}
                  onChange={(e) => updateCenter('address', e.target.value)}
                  placeholder={t('उदा. मुख्य बाजारपेठ, ग्रामपंचायत शेजारी', 'e.g., Main Market, Near Gram Panchayat')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Banner Placement & Styling Options */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-blue-600" />
              {t('ब्रँडिंग पट्टी पर्याय व सेटिंग्ज:', 'Footer Strip Style & Settings:')}
            </h3>

            {/* Placement Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('पट्टी कशी लावायची? (Placement Mode):', 'Footer Strip Placement Mode:')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFooterPlacement('overlay')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    footerPlacement === 'overlay'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('तळाशी ओव्हरले (Bottom Overlay)', 'Bottom Overlay')}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {t(
                      'पोस्टरच्या तळाशी पट्टी बसवा (पीक विमा व रेडीमेड पोस्टरसाठी योग्य)',
                      'Places your branding strip over the bottom edge (keeps 9:16 Status ratio)'
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFooterPlacement('extend')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    footerPlacement === 'extend'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('खाली नवीन जागा वाढवा (Extend Height)', 'Extend Bottom Height')}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {t(
                      'पोस्टरचा कोणताही भाग न झाकता खाली स्वतंत्र नवीन पट्टी जोडा',
                      'Appends a separate strip below the poster without covering any artwork'
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Color Palette */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('पट्टीचा रंग (Banner Color):', 'Strip Color Theme:')}
              </label>
              <div className="flex flex-wrap gap-2">
                {FOOTER_THEMES.map((theme, i) => {
                  const isSelected = selectedFooterTheme.name === theme.name;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedFooterTheme(theme)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-slate-900 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300"
                        style={{ backgroundColor: theme.bg }}
                      ></span>
                      <span>{lang === 'en' ? theme.nameEn : theme.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Height Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>{t('पट्टीची उंची (Banner Height):', 'Strip Height:')}</span>
                <span className="text-emerald-700">{footerHeight} px</span>
              </div>
              <input
                type="range"
                min="180"
                max="320"
                step="10"
                value={footerHeight}
                onChange={(e) => setFooterHeight(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWheatSheaves}
                  onChange={(e) => setShowWheatSheaves(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{t('🌾 सोनेरी गव्हाच्या लोंब्या दाखवा', '🌾 Show Golden Wheat Sheaves')}</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTalukaBadge}
                  onChange={(e) => setShowTalukaBadge(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{t('📍 तालुका व जिल्हा टॅग दाखवा', '📍 Show Taluka & District Tag')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div className="bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-800 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-sm font-bold text-white">
                  {t('थेट प्रिव्ह्यू (Live Poster)', 'Live Poster Preview')}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                {footerPlacement === 'extend'
                  ? t('वाढीव आकार', 'Extended Size')
                  : t('१०८० × १९२० HD', '1080 × 1920 HD')}
              </span>
            </div>

            {/* Poster Canvas Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center p-1.5">
              <canvas
                ref={canvasRef}
                className="w-full h-auto max-h-[580px] object-contain rounded-xl shadow-2xl transition-all"
              />
            </div>

            {/* Download & Share Actions */}
            <div className="space-y-2.5 pt-2">
              {/* Share on WhatsApp Button via Web Share API */}
              <button
                type="button"
                disabled={isSharing}
                onClick={handleShareOnWhatsApp}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 hover:from-emerald-400 hover:to-green-600 text-white font-black text-sm shadow-xl shadow-green-900/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
              >
                {isSharing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5 text-white" />
                )}
                <span>
                  {isSharing
                    ? t('इमेज तयार होत आहे...', 'Preparing image...')
                    : t('📲 WhatsApp वर इमेज शेअर करा', '📲 Share Image on WhatsApp')}
                </span>
              </button>

              <button
                type="button"
                disabled={isSavingMyPoster || !activeImage}
                onClick={handleSaveToMyPosters}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30"
              >
                {isSavingMyPoster ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <BookmarkCheck className="w-4 h-4 text-amber-300" />
                )}
                <span>
                  {isSavingMyPoster
                    ? t('माझ्या पोस्टर्समध्ये सेव्ह होत आहे...', 'Saving to My Posters...')
                    : t('💾 माझ्या पोस्टर्समध्ये सेव्ह करा (Save to My Posters)', '💾 Save to My Posters')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t('ब्रँडेड पोस्टर डाउनलोड करा (HD Image)', 'Download Branded Poster (HD PNG)')}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('A4 प्रिंट PDF', 'A4 Print PDF')}</span>
                </button>

                <a
                  href={whatsappTextUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('WhatsApp टेक्स्ट', 'WhatsApp Text')}</span>
                </a>
              </div>

              <button
                type="button"
                onClick={handleCopyImage}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-slate-700/60 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('इमेज क्लिपबोर्डवर कॉपी करा', 'Copy Poster Image to Clipboard')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 SECTION 3: MY POSTERS (Permanent Device Storage + Firebase Cloud Sync) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-indigo-600" />
              {t('माझी सेव्ह केलेली पोस्टर्स (My Posters)', 'My Saved Posters (My Posters)')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {t(
                'तुम्ही तयार केलेली पोस्टर्स तुमच्या डिव्हाइसवर व Firebase Cloud मध्ये कायमस्वरूपी सुरक्षित राहतात. वेबसाईट बंद केल्याने ती डिलीट होत नाहीत.',
                'Your saved posters stay permanently on your device and in Firebase Cloud. They never auto-delete.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
              {t(`एकूण सेव्ह: ${myPosters.length}`, `Saved: ${myPosters.length}`)}
            </span>

            {!isSignedInUser ? (
              <button
                type="button"
                disabled={isMyPostersSigningIn}
                onClick={() => void handleUserSignInForMyPosters()}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 shadow-xs text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {isMyPostersSigningIn
                    ? t('कनेक्ट होत आहे...', 'Connecting...')
                    : t('Firebase Cloud Sync साठी Google लॉगिन', 'Sign in with Google (Cloud Sync)')}
                </span>
              </button>
            ) : (
              <>
                {pendingCloudSyncCount > 0 && (
                  <button
                    type="button"
                    disabled={isSyncingMyPosters}
                    onClick={handleSyncPendingMyPosters}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMyPosters ? 'animate-spin' : ''}`} />
                    <span>
                      {t(
                        `${pendingCloudSyncCount} Cloud वर Sync करा`,
                        `Sync ${pendingCloudSyncCount} to Cloud`
                      )}
                    </span>
                  </button>
                )}

                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                  {firebaseUser?.email}
                </span>
                <button
                  type="button"
                  onClick={handleGoogleCloudDisconnect}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('लॉगआउट', 'Sign Out')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {myPostersError && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
            <div className="font-black flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('माहिती / सूचना', 'Cloud Sync Notice')}</span>
            </div>
            <p className="leading-relaxed">{myPostersError}</p>
          </div>
        )}

        {isLoadingMyPosters && myPosters.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-bold flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>{t('तुमची सेव्ह केलेली पोस्टर्स लोड होत आहेत...', 'Loading your saved posters...')}</span>
          </div>
        ) : myPosters.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
            <BookmarkCheck className="w-8 h-8 text-indigo-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              {t('अजून कोणतेही पोस्टर सेव्ह केलेले नाही', 'No saved posters yet')}
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              {t(
                'वर आपले दुकान/केंद्र नाव व मोबाईल नंबर जोडून "💾 माझ्या पोस्टर्समध्ये सेव्ह करा" बटणावर क्लिक करा — पोस्टर लगेच कायमस्वरूपी सेव्ह होईल.',
                'Customize a poster above and click "💾 Save to My Posters" — it saves permanently to your device and Firebase Cloud!'
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {myPosters.map((poster) => {
              const isConfirmingDelete = deleteMyPosterConfirmId === poster.id;
              const isDeletingThis = deletingMyPosterId === poster.id;
              return (
                <div
                  key={poster.id}
                  className="group rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div
                    onClick={() => setPreviewMyPoster(poster)}
                    className="aspect-[9/14] bg-slate-100 overflow-hidden relative cursor-pointer"
                  >
                    <img
                      src={poster.imageUrl}
                      alt={poster.title}
                      className="w-full h-full object-cover object-top transition-transform group-hover:scale-105"
                    />
                    <span
                      className={`absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm ${
                        poster.syncedToCloud
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {poster.syncedToCloud
                        ? t('☁️ Cloud + डिव्हाइस सेव्ह', '☁️ Cloud + Device')
                        : t('💾 डिव्हाइसवर सेव्ह', '💾 Saved on Device')}
                    </span>
                  </div>

                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 truncate">
                        {poster.category}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{poster.dateSaved}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                      {poster.title}
                    </h4>
                    <p className="text-[10px] font-semibold text-slate-500 truncate">
                      {poster.centerName}
                    </p>

                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMyPoster(poster)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title={t('मोठे पहा', 'View Poster')}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{t('पहा', 'View')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSavedMyPoster(poster)}
                          className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title={t('डाउनलोड करा', 'Download Poster')}
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={(e) => handleDeleteMyPoster(poster, e)}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[10px] font-black cursor-pointer"
                          >
                            {isDeletingThis ? '...' : t('हो, डिलीट', 'Yes')}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => setDeleteMyPosterConfirmId(null)}
                            className="px-1.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer"
                          >
                            {t('रद्द', 'No')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMyPoster(poster, e)}
                          className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          title={t('फक्त तुम्हीच मॅन्युअली डिलीट करू शकता', 'Manual delete')}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('डिलीट', 'Delete')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved Poster Preview Modal */}
      {previewMyPoster && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewMyPoster(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 truncate">{previewMyPoster.title}</h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {previewMyPoster.centerName} • {previewMyPoster.dateSaved}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMyPoster(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[65vh] overflow-hidden">
              <img
                src={previewMyPoster.imageUrl}
                alt={previewMyPoster.title}
                className="max-h-[60vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-4 flex flex-wrap items-center justify-between gap-2 bg-white">
              <button
                type="button"
                onClick={() => handleDownloadSavedMyPoster(previewMyPoster)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('पोस्टर डाउनलोड करा', 'Download Poster')}</span>
              </button>

              {deleteMyPosterConfirmId === previewMyPoster.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={deletingMyPosterId === previewMyPoster.id}
                    onClick={(e) => handleDeleteMyPoster(previewMyPoster, e)}
                    className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black cursor-pointer"
                  >
                    {deletingMyPosterId === previewMyPoster.id ? '...' : t('हो, कायम डिलीट करा', 'Confirm Delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteMyPosterConfirmId(null)}
                    className="py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {t('रद्द', 'Cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleDeleteMyPoster(previewMyPoster, e)}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('डिलीट', 'Delete')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

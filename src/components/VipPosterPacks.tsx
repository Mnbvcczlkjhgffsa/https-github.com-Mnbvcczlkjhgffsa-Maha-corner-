import React, { useState, useEffect, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Download,
  Sliders,
  X,
  Settings2,
  Users,
  Search,
  FileSpreadsheet,
  MessageCircle,
  RefreshCw,
  Trash2,
  Clock,
  ShieldCheck,
  IndianRupee
} from 'lucide-react';
import { VIP_POSTER_PACKS } from '../data/vipPosterPacks';
import { VipPosterPack, VipPosterItem, AiPosterData } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction, trackFeatureOpen } from '../utils/analytics';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase';
import { isValidIndianMobile, normalizeIndianMobile } from '../utils/firebaseFollowers';
import {
  VipOrderRecord,
  saveVipOrderToFirestore,
  subscribeAdminVipOrders,
  updateVipOrderStatusAsAdmin,
  deleteVipOrderAsAdmin,
  exportVipOrdersToExcel,
  sanitizeVipUtr,
} from '../utils/firebaseVipOrders';

const LOCAL_VIP_UNLOCKED_KEY = 'maha_vip_unlocked_packs_v1';
const LOCAL_VIP_ALL_LIFETIME = 'maha_vip_lifetime_pass_v1';
const LOCAL_VIP_MONTH_PASS_EXPIRES_KEY = 'maha_vip_month_pass_expires_v1';
const SHOP_DETAILS_KEY = 'maha_corner_shop_details_v4';

interface CenterDetails {
  centerName: string;
  centerTagline: string;
  phones: string[];
  address: string;
}

const DEFAULT_CENTER: CenterDetails = {
  centerName: 'महा कॉर्नर',
  centerTagline: 'आपल्या डिजिटल व बँकिंग सेवांसाठी सदैव तत्पर !',
  phones: ['+917972123605'],
  address: 'मुख्य बाजारपेठ, ग्रामपंचायत शेजारी',
};

export const VipPosterPacks: React.FC<{
  onOpenInEditor?: (posterData: Partial<AiPosterData>) => void;
}> = ({ onOpenInEditor }) => {
  const { lang, t } = useLanguage();

  // Selected Pack & Filter
  const [selectedPackId, setSelectedPackId] = useState<string>('all');
  const [selectedPoster, setSelectedPoster] = useState<VipPosterItem | null>(null);

  // Unlocked Status
  const [unlockedPacks, setUnlockedPacks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_VIP_UNLOCKED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hasLifetimePass, setHasLifetimePass] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_VIP_ALL_LIFETIME) === 'true';
    } catch {
      return false;
    }
  });

  const [monthPassExpiresAt, setMonthPassExpiresAt] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_VIP_MONTH_PASS_EXPIRES_KEY) || '';
    } catch {
      return '';
    }
  });

  const hasActiveMonthPass = useMemo(() => {
    if (!monthPassExpiresAt) return false;
    const exp = Date.parse(monthPassExpiresAt);
    return !Number.isNaN(exp) && exp > Date.now();
  }, [monthPassExpiresAt]);

  // Shop Details
  const [centerInfo, setCenterInfo] = useState<CenterDetails>(() => {
    try {
      const raw = localStorage.getItem(SHOP_DETAILS_KEY);
      if (raw) return { ...DEFAULT_CENTER, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_CENTER;
  });

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [payingPack, setPayingPack] = useState<VipPosterPack | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [unlockSuccessBanner, setUnlockSuccessBanner] = useState<string>('');

  // Dynamic Owner UPI Config from Server
  const [ownerUpi, setOwnerUpi] = useState<string>('BHARATPE2S0D0O6O4N96959@unitype');
  const [ownerName, setOwnerName] = useState<string>('Maha Corner (कमलेश पाटील)');

  // Firebase Google Admin Auth State (for reading cloud vip_orders seamlessly)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [signingInAdmin, setSigningInAdmin] = useState<boolean>(false);
  const [firestoreOrders, setFirestoreOrders] = useState<VipOrderRecord[]>([]);
  const [firestoreOrdersError, setFirestoreOrdersError] = useState<string>('');

  // Owner Admin Earnings & Payers Modal State
  const [isOwnerAdminOpen, setIsOwnerAdminOpen] = useState<boolean>(false);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [verifiedPin, setVerifiedPin] = useState<string>('');
  const [serverOrders, setServerOrders] = useState<VipOrderRecord[]>([]);
  const [loadingServerOrders, setLoadingServerOrders] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string>('');
  const [adminSubTab, setAdminSubTab] = useState<'payers' | 'monthly' | 'settings'>('payers');
  const [payerSearch, setPayerSearch] = useState<string>('');
  const [payerStatusFilter, setPayerStatusFilter] = useState<'all' | 'verified' | 'pending' | 'today'>('all');
  const [copiedOrderField, setCopiedOrderField] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
  const [tempUpiId, setTempUpiId] = useState<string>('');
  const [tempOwnerName, setTempOwnerName] = useState<string>('');
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState<boolean>(false);

  const isGoogleAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const isPinUnlocked = Boolean(verifiedPin);
  const adminAuthenticated = isGoogleAdmin || isPinUnlocked;

  useEffect(() => {
    trackFeatureOpen('vip-posters');
    fetch('/api/vip/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.ownerUpiId) setOwnerUpi(data.ownerUpiId);
          if (data.ownerName) setOwnerName(data.ownerName);
          setTempUpiId(data.ownerUpiId || 'BHARATPE2S0D0O6O4N96959@unitype');
          setTempOwnerName(data.ownerName || 'Maha Corner (कमलेश पाटील)');
        }
      })
      .catch(() => {});

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Realtime Firestore subscription when verified Admin is signed in with Google
  useEffect(() => {
    if (!isGoogleAdmin) {
      setFirestoreOrders([]);
      return;
    }
    setFirestoreOrdersError('');
    const unsub = subscribeAdminVipOrders(
      (records) => {
        setFirestoreOrders(records);
      },
      (err) => {
        setFirestoreOrdersError(err.message || 'Firestore sync warning');
      }
    );
    return () => unsub();
  }, [isGoogleAdmin]);

  const loadServerOrdersWithPin = useCallback(
    async (pinToUse: string) => {
      if (!pinToUse) return;
      setLoadingServerOrders(true);
      setAdminError('');
      try {
        const res = await fetch('/api/vip/admin/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinToUse }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const mapped: VipOrderRecord[] = data.orders.map((o: any) => {
            const iso = String(o.createdAt || o.verifiedAt || new Date().toISOString());
            const ms = Date.parse(iso) || Date.now();
            return {
              id: String(o.id || ''),
              packId: String(o.packId || 'all'),
              packNameMr: String(o.packNameMr || 'व्हीआयपी पॅक'),
              amount: Number(o.amount) || 0,
              customerName: String(o.customerName || 'ग्राहक'),
              customerMobile: String(o.customerMobile || ''),
              utrNumber: String(o.utrNumber || ''),
              paymentMethod: o.paymentMethod === 'PROMO' ? 'PROMO' : 'UPI',
              status: o.status === 'pending' ? 'pending' : 'verified',
              expiresAtIso: String(o.expiresAt || ''),
              createdAtIso: iso,
              createdAtMs: ms,
              source: 'server',
            };
          });
          setServerOrders(mapped);
          setVerifiedPin(pinToUse);
          setTempUpiId(ownerUpi);
          setTempOwnerName(ownerName);
        } else {
          setAdminError(data.error || 'अवैध ओनर पिन (Invalid PIN)');
        }
      } catch {
        setAdminError('सर्व्हरशी संपर्क होऊ शकला नाही.');
      } finally {
        setLoadingServerOrders(false);
      }
    },
    [ownerUpi, ownerName]
  );

  // Merge Firestore + Server VIP orders cleanly without duplicates (by UTR or ID)
  const adminOrders = useMemo<VipOrderRecord[]>(() => {
    const map = new Map<string, VipOrderRecord>();
    for (const ord of serverOrders) {
      const key = (ord.utrNumber || ord.id).toUpperCase();
      map.set(key, { ...ord, source: 'server' });
    }
    for (const ord of firestoreOrders) {
      const key = (ord.utrNumber || ord.id).toUpperCase();
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          ...existing,
          ...ord,
          source: 'both',
        });
      } else {
        map.set(key, { ...ord, source: 'firestore' });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [serverOrders, firestoreOrders]);

  // Compute earnings stats from merged orders
  const orderStats = useMemo(() => {
    const now = new Date();
    const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const monthlyMap: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        revenue: number;
        orderCount: number;
        monthlyPassCount: number;
        lifetimePassCount: number;
      }
    > = {};

    let totalRevenue = 0;
    let todayPaid = 0;
    let todayOrdersCount = 0;
    let thisMonthPaid = 0;
    let thisMonthOrdersCount = 0;
    let thisMonthPassCount = 0;
    let lastMonthPaid = 0;

    for (const ord of adminOrders) {
      const amt = Number(ord.amount) || 0;
      totalRevenue += amt;
      const dt = new Date(ord.createdAtMs || ord.createdAtIso || Date.now());
      if (isNaN(dt.getTime())) continue;

      const istDay = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (istDay === todayKey) {
        todayPaid += amt;
        todayOrdersCount += 1;
      }

      const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[mKey]) {
        monthlyMap[mKey] = {
          monthKey: mKey,
          monthLabel: dt.toLocaleDateString('mr-IN', { month: 'long', year: 'numeric' }),
          revenue: 0,
          orderCount: 0,
          monthlyPassCount: 0,
          lifetimePassCount: 0,
        };
      }
      monthlyMap[mKey].revenue += amt;
      monthlyMap[mKey].orderCount += 1;
      if (ord.packId === 'month-pass') {
        monthlyMap[mKey].monthlyPassCount += 1;
      } else {
        monthlyMap[mKey].lifetimePassCount += 1;
      }

      if (mKey === currentMonthKey) {
        thisMonthPaid += amt;
        thisMonthOrdersCount += 1;
        if (ord.packId === 'month-pass') thisMonthPassCount += 1;
      } else if (mKey === lastMonthKey) {
        lastMonthPaid += amt;
      }
    }

    return {
      totalRevenue,
      todayPaid,
      todayOrdersCount,
      thisMonthPaid,
      thisMonthOrdersCount,
      thisMonthPassCount,
      lastMonthPaid,
      monthlyBreakdown: Object.values(monthlyMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    };
  }, [adminOrders]);

  const filteredAdminOrders = useMemo(() => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const q = payerSearch.trim().toLowerCase();
    return adminOrders.filter((ord) => {
      if (payerStatusFilter === 'verified' && ord.status !== 'verified') return false;
      if (payerStatusFilter === 'pending' && ord.status !== 'pending') return false;
      if (payerStatusFilter === 'today') {
        const ordDay = new Date(ord.createdAtMs || ord.createdAtIso).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Kolkata',
        });
        if (ordDay !== todayKey) return false;
      }
      if (!q) return true;
      return (
        ord.customerName.toLowerCase().includes(q) ||
        ord.customerMobile.toLowerCase().includes(q) ||
        ord.utrNumber.toLowerCase().includes(q) ||
        ord.packNameMr.toLowerCase().includes(q)
      );
    });
  }, [adminOrders, payerSearch, payerStatusFilter]);

  // Check if pack is unlocked
  const isPackUnlocked = (packId: string): boolean => {
    if (hasLifetimePass || hasActiveMonthPass) return true;
    return unlockedPacks.includes(packId);
  };

  // Generate Dynamic UPI QR Code
  const handleOpenPayment = async (pack: VipPosterPack) => {
    setPayingPack(pack);
    setUtrNumber('');
    setVerificationError('');
    if (!customerName && centerInfo.centerName && centerInfo.centerName !== DEFAULT_CENTER.centerName) {
      setCustomerName(centerInfo.centerName);
    }
    setPaymentModalOpen(true);

    const cleanPackName = pack.nameEn.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 30);
    const upiUri = `upi://pay?pa=${encodeURIComponent(ownerUpi)}&pn=${encodeURIComponent(
      ownerName
    )}&am=${pack.price}&cu=INR&tn=${encodeURIComponent(`${cleanPackName} VIP`)}`;

    try {
      const qrUrl = await QRCode.toDataURL(upiUri, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(qrUrl);
    } catch (err) {
      console.warn('QR code gen error:', err);
    }
  };

  // Verify UTR & Unlock Pack (Save to BOTH Server + Firestore so Owner sees who sent money)
  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPack) return;

    const cleanName = customerName.trim();
    const cleanMobile = normalizeIndianMobile(customerMobile);
    const cleanUtr = sanitizeVipUtr(utrNumber);

    if (cleanName.length < 2) {
      setVerificationError(
        t('कृपया पैसे पाठवणाऱ्या व्यक्तीचे किंवा केंद्राचे नाव टाका (किमान २ अक्षरे).', 'Please enter payer or center name (min 2 chars).')
      );
      return;
    }
    if (!isValidIndianMobile(cleanMobile)) {
      setVerificationError(
        t('कृपया वैध १०-अंकी मोबाईल / व्हॉट्सॲप नंबर टाका.', 'Please enter a valid 10-digit Indian mobile number.')
      );
      return;
    }
    if (!cleanUtr || cleanUtr.length < 6) {
      setVerificationError(t('कृपया वैध १२-अंकी UTR किंवा रेफरन्स नंबर टाका.', 'Please enter valid 12-digit UTR number.'));
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    const sharedOrderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiresAtIso =
      payingPack.id === 'month-pass'
        ? new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString()
        : '';

    let serverOk = false;
    let serverErrMsg = '';
    let resolvedExpiresAt = expiresAtIso;

    try {
      const res = await fetch('/api/vip/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sharedOrderId,
          packId: payingPack.id,
          packNameMr: payingPack.nameMr,
          amount: payingPack.price,
          customerMobile: cleanMobile,
          customerName: cleanName,
          utrNumber: cleanUtr,
          paymentMethod: 'UPI',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.unlocked) {
        serverOk = true;
        if (data.expiresAt) resolvedExpiresAt = String(data.expiresAt);
      } else if (data?.error) {
        serverErrMsg = String(data.error);
      }
    } catch {
      // Fall through to Firestore best-effort
    }

    const fsResult = await saveVipOrderToFirestore({
      id: sharedOrderId,
      packId: payingPack.id,
      packNameMr: payingPack.nameMr,
      amount: payingPack.price,
      customerName: cleanName,
      customerMobile: cleanMobile,
      utrNumber: cleanUtr,
      paymentMethod: 'UPI',
      status: 'verified',
      expiresAtIso: resolvedExpiresAt,
      createdAtIso: nowIso,
      createdAtMs: nowMs,
    });

    if (serverOk || fsResult.saved) {
      if (payingPack.id === 'all') {
        setHasLifetimePass(true);
        localStorage.setItem(LOCAL_VIP_ALL_LIFETIME, 'true');
      } else if (payingPack.id === 'month-pass') {
        const expIso = resolvedExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        setMonthPassExpiresAt(expIso);
        localStorage.setItem(LOCAL_VIP_MONTH_PASS_EXPIRES_KEY, expIso);
      }
      const updated = Array.from(new Set([...unlockedPacks, payingPack.id]));
      setUnlockedPacks(updated);
      localStorage.setItem(LOCAL_VIP_UNLOCKED_KEY, JSON.stringify(updated));

      trackFeatureAction('vip-posters');
      setPaymentModalOpen(false);
      setUnlockSuccessBanner(
        t(
          `अभिनंदन ${cleanName}! तुमचे ₹${payingPack.price} पेमेंट (UTR: ${cleanUtr}) नोंदवले गेले आणि व्हीआयपी पॅक अनलॉक झाला! ✓`,
          `Congratulations ${cleanName}! ₹${payingPack.price} payment (UTR: ${cleanUtr}) recorded & VIP Pack unlocked! ✓`
        )
      );

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      setVerificationError(serverErrMsg || t('पडताळणी अयशस्वी. कृपया पुन्हा प्रयत्न करा.', 'Verification failed. Please try again.'));
    }

    setIsVerifying(false);
  };

  // Promo Code Unlock
  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setIsVerifying(true);
    setVerificationError('');

    try {
      const res = await fetch('/api/vip/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (data.success && data.unlocked) {
        if (data.packId === 'all') {
          setHasLifetimePass(true);
          localStorage.setItem(LOCAL_VIP_ALL_LIFETIME, 'true');
        } else if (data.packId === 'month-pass') {
          const expIso = data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          setMonthPassExpiresAt(expIso);
          localStorage.setItem(LOCAL_VIP_MONTH_PASS_EXPIRES_KEY, expIso);
        }
        const updated = Array.from(new Set([...unlockedPacks, data.packId]));
        setUnlockedPacks(updated);
        localStorage.setItem(LOCAL_VIP_UNLOCKED_KEY, JSON.stringify(updated));

        setPaymentModalOpen(false);
        confetti({ particleCount: 70, spread: 60 });
        setUnlockSuccessBanner(
          t('VIP प्रोमो कोड यशस्वीरीत्या लागू झाला! सर्व पोस्टर्स अनलॉक झाले. ✓', 'VIP Promo code applied successfully! ✓')
        );
      } else {
        setVerificationError(data.error || t('अवैध प्रोमो कोड.', 'Invalid promo code.'));
      }
    } catch {
      setVerificationError(t('सर्व्हरशी संपर्क होऊ शकला नाही.', 'Network error.'));
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy helper
  const handleCopyText = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedOrderField(key);
    setTimeout(() => setCopiedOrderField(''), 1800);
  };

  // Copy UPI ID to clipboard
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(ownerUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Admin PIN Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadServerOrdersWithPin(ownerPin);
  };

  // Google Admin Sign-In
  const handleGoogleAdminSignIn = async () => {
    setSigningInAdmin(true);
    setAdminError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setAdminError(
          `फक्त मुख्य ॲडमिन ईमेल (${ADMIN_EMAIL}) लाच पैसे पाठवणाऱ्यांची यादी पाहण्याची परवानगी आहे.`
        );
      }
    } catch (err: any) {
      setAdminError(err?.message || 'Google लॉगिन अयशस्वी झाले.');
    } finally {
      setSigningInAdmin(false);
    }
  };

  const handleToggleOrderStatus = async (ord: VipOrderRecord) => {
    const nextStatus: 'verified' | 'pending' = ord.status === 'verified' ? 'pending' : 'verified';
    setUpdatingOrderId(ord.id);
    try {
      if (isPinUnlocked) {
        await fetch('/api/vip/admin/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin, orderId: ord.id, status: nextStatus }),
        }).catch(() => {});
        setServerOrders((prev) => prev.map((o) => (o.id === ord.id ? { ...o, status: nextStatus } : o)));
      }
      if (isGoogleAdmin && (ord.source === 'firestore' || ord.source === 'both')) {
        await updateVipOrderStatusAsAdmin(ord.id, nextStatus).catch(() => {});
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (ord: VipOrderRecord) => {
    setUpdatingOrderId(ord.id);
    try {
      if (isPinUnlocked) {
        await fetch('/api/vip/admin/delete-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin, orderId: ord.id }),
        }).catch(() => {});
        setServerOrders((prev) => prev.filter((o) => o.id !== ord.id));
      }
      if (isGoogleAdmin && (ord.source === 'firestore' || ord.source === 'both')) {
        await deleteVipOrderAsAdmin(ord.id).catch(() => {});
      }
    } finally {
      setUpdatingOrderId(null);
      setConfirmDeleteOrderId(null);
    }
  };

  // Save Owner Settings (UPI ID & Name)
  const handleSaveOwnerSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePin = verifiedPin || ownerPin;
    if (!activePin) {
      setAdminError('UPI सेटिंग्ज सेव्ह करण्यासाठी ओनर पिन (Owner PIN) आवश्यक आहे.');
      return;
    }
    try {
      const res = await fetch('/api/vip/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: activePin,
          ownerUpiId: tempUpiId,
          ownerName: tempOwnerName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOwnerUpi(tempUpiId);
        setOwnerName(tempOwnerName);
        setSaveSettingsSuccess(true);
        setTimeout(() => setSaveSettingsSuccess(false), 2000);
      } else {
        setAdminError(data.error || 'सेटिंग्ज सेव्ह करण्यात अडचण आली.');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // All posters aggregated for display
  const allPostersList = useMemo(() => {
    const list: VipPosterItem[] = [];
    VIP_POSTER_PACKS.forEach((pack) => {
      pack.posters.forEach((p) => {
        list.push(p);
      });
    });
    return list;
  }, []);

  const displayedPosters = useMemo(() => {
    if (selectedPackId === 'all') {
      return allPostersList;
    }
    const pack = VIP_POSTER_PACKS.find((p) => p.id === selectedPackId);
    return pack ? pack.posters : allPostersList;
  }, [selectedPackId, allPostersList]);

  // Export 4K Ultra HD Poster
  const handleDownloadUltraHd = (poster: VipPosterItem) => {
    const unlocked = isPackUnlocked(poster.packId);
    if (!unlocked) {
      const targetPack = VIP_POSTER_PACKS.find((p) => p.id === poster.packId) || VIP_POSTER_PACKS[0];
      handleOpenPayment(targetPack);
      return;
    }

    trackFeatureAction('vip-posters');

    // Create 300 DPI ultra-HD canvas (2480 x 3508 px for A4 at 300 DPI)
    const cv = document.createElement('canvas');
    cv.width = 2480;
    cv.height = 3508;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
    grad.addColorStop(0, poster.bgGradient[0]);
    grad.addColorStop(1, poster.bgGradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cv.width, cv.height);

    // Top Header Banner
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(80, 80, cv.width - 160, 200);
    ctx.fillStyle = poster.accentColor;
    ctx.fillRect(80, 275, cv.width - 160, 15);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poster.templateData.topBadge || 'महाराष्ट्र शासन विशेष योजना', cv.width / 2, 200);

    // Main Tag
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 120px sans-serif';
    ctx.fillText(poster.templateData.mainTag || 'MAHA CORNER', cv.width / 2, 450);

    // Main Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 110px sans-serif';
    ctx.fillText(poster.templateData.title || poster.titleMr, cv.width / 2, 600);

    // Subtitle
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 70px sans-serif';
    ctx.fillText(poster.templateData.subTitle || '', cv.width / 2, 720);

    // Notice Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(120, 820, cv.width - 240, 240);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(120, 820, cv.width - 240, 240);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 55px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(poster.templateData.noticeTitle || 'महत्त्वाची सूचना:', 160, 910);

    ctx.fillStyle = '#ffffff';
    ctx.font = '50px sans-serif';
    ctx.fillText(poster.templateData.noticeText || '', 160, 990);

    // Services
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 65px sans-serif';
    ctx.fillText(poster.templateData.servicesHeadline || 'आमच्या केंद्रावर मिळणाऱ्या सुविधा:', cv.width / 2, 1180);

    ctx.textAlign = 'left';
    poster.templateData.services?.forEach((srv, idx) => {
      const y = 1290 + idx * 110;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(200, y - 20, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 55px sans-serif';
      ctx.fillText(srv, 250, y);
    });

    // 2-Column Boxes: Benefits & Documents
    const boxY = 1680;
    const boxW = (cv.width - 320) / 2;
    const boxH = 750;

    // Col 1
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(120, boxY, boxW, boxH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(120, boxY, boxW, boxH);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poster.templateData.col1Title || 'पात्रता व लाभ', 120 + boxW / 2, boxY + 100);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '50px sans-serif';
    poster.templateData.col1Items?.forEach((item, idx) => {
      ctx.fillText(`• ${item}`, 160, boxY + 220 + idx * 110);
    });

    // Col 2
    const col2X = 120 + boxW + 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(col2X, boxY, boxW, boxH);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(col2X, boxY, boxW, boxH);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poster.templateData.col2Title || 'आवश्यक कागदपत्रे', col2X + boxW / 2, boxY + 100);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '50px sans-serif';
    poster.templateData.col2Items?.forEach((item, idx) => {
      ctx.fillText(`• ${item}`, col2X + 40, boxY + 220 + idx * 110);
    });

    // Urgency text banner
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(120, 2520, cv.width - 240, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poster.templateData.urgencyText || 'आजच केंद्रावर भेट द्या !', cv.width / 2, 2620);

    // Footer with Operator Center Name & Phone
    const footerY = 2760;
    ctx.fillStyle = '#0a2540';
    ctx.fillRect(0, footerY, cv.width, cv.height - footerY);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, footerY, cv.width, 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 85px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏛️ ${centerInfo.centerName}`, cv.width / 2, footerY + 150);

    ctx.font = '52px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(centerInfo.centerTagline, cv.width / 2, footerY + 240);

    ctx.font = 'bold 65px sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`📞 संपर्क: ${centerInfo.phones[0]} • ${centerInfo.address}`, cv.width / 2, footerY + 340);

    ctx.font = 'bold 45px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('महा कॉर्नर व्हीआयपी पोस्टर • mahacorner.in • 4K Ultra HD Print Ready', cv.width / 2, cv.height - 80);

    // Save as JPEG / PDF
    cv.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MahaCorner_VIP_${poster.id}_4K.jpg`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(url);
        }, 1500);

        confetti({ particleCount: 50, spread: 60 });
      }
    }, 'image/jpeg', 0.98);
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900 text-white p-6 sm:p-8 border border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('व्हीआयपी / प्रीमियम पोस्टर पॅक', 'VIP & Premium Poster Packs')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {hasLifetimePass ? (
                <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('👑 लाइफटाइम VIP पास सक्रिय', '👑 Lifetime VIP Pass Active')}</span>
                </span>
              ) : hasActiveMonthPass ? (
                <span className="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-xs font-black flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>
                    {t(
                      `⭐ १ महिना VIP पास सक्रिय (${new Date(monthPassExpiresAt).toLocaleDateString('mr-IN')} पर्यंत)`,
                      `⭐ 1-Month Paid Pass Active (Until ${new Date(monthPassExpiresAt).toLocaleDateString()})`
                    )}
                  </span>
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  {t('⚡ थेट UPI पेमेंटद्वारे तात्काळ अनलॉक', 'Instant Unlock via Direct UPI')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              {t('सीएससी केंद्रासाठी तयार', 'Ready-made High Impact Flyers')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">
                {t('५०+ रेडीमेड हाय-इम्पॅक्ट डिझाईन्स व 4K प्रिंट क्वालिटी', '50+ High-Impact Marathi Poster Designs')}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                'लाडकी बहीण, PM किसान, पीक विमा, ७/१२, ई-पीक पाहणी, पोलीस भरती व सण-उत्सव अशा सर्व विषयांचे तयार आकर्षक पोस्टर्स. केंद्राचे नाव व नंबर जोडून १ सेकंदात 4K प्रिंट करा व व्हॉट्सॲपवर शेअर करा!',
                'Ready-made Marathi banners for Ladki Bahin, PM Kisan, PMFBY, Satbara, Police Bharti, and Festivals with your shop name, phone, and address in Ultra HD 4K.'
              )}
            </p>
          </div>

          {/* Quick CTA Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            {!hasLifetimePass && !hasActiveMonthPass && (
              <button
                type="button"
                onClick={() => handleOpenPayment(VIP_POSTER_PACKS[0])}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>{t('⭐ १ महिना VIP पास घ्या (फक्त ₹२९)', 'Get 1-Month Paid VIP Pass (₹29)')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOwnerAdminOpen(true);
                setAdminSubTab('payers');
                if (verifiedPin) {
                  void loadServerOrdersWithPin(verifiedPin);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-amber-200 font-bold text-xs border border-amber-400/40 transition-all cursor-pointer shadow-md"
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>{t('💰 कोणी पैसे पाठवले? (पेमेंट यादी)', 'Who Paid? (Payment List)')}</span>
              {adminAuthenticated && adminOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">
                  {adminOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {unlockSuccessBanner && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 px-4 py-3 flex items-center justify-between gap-3 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{unlockSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setUnlockSuccessBanner('')}
            className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIP PACK CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {VIP_POSTER_PACKS.map((pack) => {
          const unlocked = isPackUnlocked(pack.id);
          return (
            <div
              key={pack.id}
              className={`rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden bg-white shadow-sm hover:shadow-xl ${
                pack.popular
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : 'border-slate-200'
              }`}
            >
              {pack.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-xs">
                  {t('सर्वाधिक पसंती (Best Value)', 'Best Value')}
                </div>
              )}

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="text-3xl p-2.5 rounded-2xl bg-slate-100 shrink-0">
                    {pack.icon}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base leading-snug">
                      {pack.nameMr}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {pack.nameEn}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {pack.taglineMr}
                </p>

                {/* Features Bullets */}
                <div className="space-y-1.5 pt-1 text-xs text-slate-700">
                  {pack.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-tight">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price & Action */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      ₹{pack.price}
                    </span>
                    <span className="text-xs text-slate-400 line-through">
                      ₹{pack.originalPrice}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-black uppercase">
                    {pack.discountBadge}
                  </span>
                </div>

                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs cursor-pointer hover:bg-emerald-500"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{t('अनलॉक आहे ✓', 'Unlocked ✓')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenPayment(pack)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition-all hover:scale-105 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{t('UPI ने अनलॉक करा', 'Unlock via UPI')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTER TABS & POSTER PREVIEW GALLERY */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>{t('व्हीआयपी पोस्टर्स गॅलरी (रेडीमेड डिझाईन्स)', 'VIP Posters Gallery')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('कोणत्याही डिझाइनवर क्लिक करून ते स्वतःच्या नावावर डाउनलोड करा', 'Select any design to customize with your shop details')}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedPackId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPackId === 'all'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t('सर्व पोस्टर्स (All)', 'All Posters')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPackId('govt-schemes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPackId === 'govt-schemes'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t('सरकारी योजना', 'Govt Schemes')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPackId('farmer-special')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPackId === 'farmer-special'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t('शेतकरी विशेष', 'Farmer Special')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPackId('bharti-jobs')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPackId === 'bharti-jobs'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t('भरती व नोकरी', 'Jobs & Bharti')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPackId('festivals-wishes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPackId === 'festivals-wishes'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t('सण व शुभेच्छा', 'Festivals')}
            </button>
          </div>
        </div>

        {/* Posters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedPosters.map((poster) => {
            const unlocked = isPackUnlocked(poster.packId);
            return (
              <div
                key={poster.id}
                className="rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between bg-white group"
              >
                <div>
                  {/* Poster Preview Card visual */}
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${poster.bgGradient[0]}, ${poster.bgGradient[1]})`,
                    }}
                    className="h-64 p-5 text-white flex flex-col justify-between relative overflow-hidden"
                  >
                    {!unlocked && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center z-10 space-y-2">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Lock className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-black text-white">
                          {t('🔒 व्हीआयपी डिझाइन सुरक्षित आहे', '🔒 VIP Design Locked')}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const pack = VIP_POSTER_PACKS.find((p) => p.id === poster.packId) || VIP_POSTER_PACKS[0];
                            handleOpenPayment(pack);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-md cursor-pointer hover:scale-105 transition-transform"
                        >
                          {t('अनलॉक करा (₹४९)', 'Unlock (₹49)')}
                        </button>
                      </div>
                    )}

                    {/* Top Tag & Badge */}
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs border border-white/20">
                        {poster.templateData.mainTag}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        {poster.badgeMr}
                      </span>
                    </div>

                    {/* Center Headline */}
                    <div className="space-y-1 my-auto">
                      <h4 className="text-lg font-black leading-tight drop-shadow-sm">
                        {poster.templateData.title}
                      </h4>
                      <p className="text-xs text-amber-200 font-bold drop-shadow-xs">
                        {poster.templateData.subTitle}
                      </p>
                    </div>

                    {/* Bottom Center Name preview */}
                    <div className="pt-2 border-t border-white/20 flex items-center justify-between text-[10px] text-slate-200">
                      <span className="font-bold truncate">🏛️ {centerInfo.centerName}</span>
                      <span className="font-mono">📞 {centerInfo.phones[0]}</span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-slate-900 text-sm leading-snug">
                      {poster.titleMr}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {poster.descMr}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadUltraHd(poster)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('4K प्रिंट डाउनलोड', 'Download 4K')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenInEditor) {
                        onOpenInEditor(poster.templateData);
                      } else {
                        handleDownloadUltraHd(poster);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{t('एडिटरमध्ये वापरा', 'Use in Editor')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DYNAMIC UPI PAYMENT MODAL */}
      {paymentModalOpen && payingPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                <Crown className="w-5 h-5 text-amber-500" />
                <span>{t('थेट UPI पेमेंटद्वारे अनलॉक करा', 'Direct UPI Payment Unlock')}</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Pack Summary */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-950 block">{payingPack.nameMr}</span>
                <span className="text-[11px] text-slate-600">{payingPack.taglineMr}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-black text-slate-900">₹{payingPack.price}</span>
                <span className="text-[10px] text-emerald-700 font-bold block">{payingPack.discountBadge}</span>
              </div>
            </div>

            {/* Dynamic QR Code & Direct App Buttons */}
            <div className="text-center space-y-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
                ) : (
                  <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-xs text-slate-400">
                    QR तयार होत आहे...
                  </div>
                )}
                <p className="text-[11px] font-bold text-slate-600 mt-2">
                  GPay • PhonePe • Paytm • BHIM वरून स्कॅन करा
                </p>
              </div>

              {/* Direct UPI Intent Link for Mobile */}
              <div>
                <a
                  href={`upi://pay?pa=${encodeURIComponent(ownerUpi)}&pn=${encodeURIComponent(
                    ownerName
                  )}&am=${payingPack.price}&cu=INR&tn=${encodeURIComponent(payingPack.nameEn)}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-md hover:scale-105 transition-transform"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>{t('मोबाईलवर थेट PhonePe / GPay उघडा →', 'Open PhonePe / GPay Directly')}</span>
                </a>
              </div>

              {/* Owner UPI ID with Copy */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                <span className="font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                  {ownerUpi}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* UTR Verification Form */}
            <form onSubmit={handleVerifyPayment} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    {t('१. पैसे पाठवणाऱ्याचे / केंद्राचे नाव *:', '1. Payer / Center Name *:')}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="उदा. राजू पाटील / श्रीराम CSC"
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    {t('२. मोबाईल / व्हॉट्सॲप नंबर *:', '2. 10-Digit Mobile No. *:')}
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={13}
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    placeholder="उदा. 9876543210"
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  {t('३. पेमेंट झाल्यावर १२-अंकी UTR / UPI Reference No. टाका *:', '3. Enter 12-digit UTR No. after payment *:')}
                </label>
                <input
                  type="text"
                  required
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="उदा. 432109876543 (PhonePe/GPay वरील UTR)"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                />
              </div>

              {verificationError && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                  {verificationError}
                </p>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isVerifying ? t('पडताळणी करत आहे...', 'Verifying...') : t('✓ व्हेरिफाय करा व VIP पॅक तात्काळ अनलॉक करा', 'Verify & Unlock VIP Pack Instantly')}</span>
              </button>
            </form>

            {/* Promo Code Alternative */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="VIP प्रोमो कोड (उदा. MAHA99)"
                className="flex-1 h-9 px-3 rounded-xl border border-slate-300 text-xs uppercase font-mono"
              />
              <button
                type="button"
                onClick={handleApplyPromoCode}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold cursor-pointer"
              >
                {t('लागू करा', 'Apply Code')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OWNER PAYERS, EARNINGS & UPI SETTINGS MODAL */}
      {isOwnerAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-900 text-sm sm:text-base">
                    {t('व्हीआयपी पेमेंट यादी — कोणी पैसे पाठवले व कमाई डॅशबोर्ड', 'VIP Payers List & Owner Earnings')}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {t('प्रत्येक ग्राहकाचे नाव, मोबाईल नंबर, रक्कम, UTR व तारीख-वेळ', 'Full sender name, mobile, amount, UTR & timestamp')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOwnerAdminOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!adminAuthenticated ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                {/* Method 1: Owner PIN */}
                <form onSubmit={handleAdminLogin} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>{t('पर्याय १: ओनर पिन (Owner PIN) ने उघडा', 'Option 1: Unlock with Owner PIN')}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {t('सर्व्हरवरील पेमेंट यादी व UPI सेटिंग्स पाहण्यासाठी ओनर पिन प्रविष्ट करा:', 'Enter Owner PIN to access server payment records & UPI settings:')}
                  </p>
                  <input
                    type="password"
                    required
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="ओनर पिन टाका"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {adminError && <p className="text-xs text-rose-600 font-bold">{adminError}</p>}
                  <button
                    type="submit"
                    disabled={loadingServerOrders}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs cursor-pointer shadow-md"
                  >
                    {loadingServerOrders ? 'तपासत आहे...' : 'पिनने पेमेंट यादी पहा (Login)'}
                  </button>
                </form>

                {/* Method 2: Admin Google Sign-In */}
                <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-black text-emerald-950 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{t('पर्याय २: ॲडमिन Google लॉगिन (Cloud Sync)', 'Option 2: Admin Google Sign-In')}</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      {t(
                        `फायरस्टोअर क्लाउड डेटाबेसमधील सर्व लाईव्ह पेमेंट्स पाहण्यासाठी ${ADMIN_EMAIL} ने साइन इन करा.`,
                        `Sign in with ${ADMIN_EMAIL} to view live cloud Firestore payment orders.`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleAdminSignIn}
                    disabled={signingInAdmin}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{signingInAdmin ? 'लॉगिन होत आहे...' : 'Google ॲडमिन लॉगिन करा'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Auth status + quick cloud/server sync bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isGoogleAdmin ? `Cloud Admin: ${currentUser?.email}` : 'Server PIN Verified'}</span>
                    </span>
                    {!isGoogleAdmin && (
                      <button
                        type="button"
                        onClick={handleGoogleAdminSignIn}
                        disabled={signingInAdmin}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
                      >
                        {signingInAdmin ? 'जोडत आहे...' : '☁️ क्लाउड (Firestore) नोंदी पण जोडा'}
                      </button>
                    )}
                    {!isPinUnlocked && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="password"
                          value={ownerPin}
                          onChange={(e) => setOwnerPin(e.target.value)}
                          placeholder="PIN (सर्व्हर नोंदीसाठी)"
                          className="h-7 px-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-[11px] w-36 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => void loadServerOrdersWithPin(ownerPin)}
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-[11px] cursor-pointer"
                        >
                          जोडा
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPinUnlocked && (
                      <button
                        type="button"
                        onClick={() => void loadServerOrdersWithPin(verifiedPin)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingServerOrders ? 'animate-spin' : ''}`} />
                        <span>रीफ्रेश</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportVipOrdersToExcel(filteredAdminOrders)}
                      disabled={filteredAdminOrders.length === 0}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel डाउनलोड</span>
                    </button>
                  </div>
                </div>

                {firestoreOrdersError && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                    क्लाउड सिंक सूचना: {firestoreOrdersError} (सर्व्हरवरील नोंदी सुरक्षित आहेत.)
                  </p>
                )}

                {/* 4 Summary Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 font-black block uppercase">
                      {t('आजचे पेमेंट (Today)', 'Today Paid')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-950">₹{orderStats.todayPaid}</span>
                    <span className="text-[10px] text-amber-700 font-bold block">
                      {orderStats.todayOrdersCount} {t('जणांनी पाठवले', 'payers today')}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-cyan-50 border border-cyan-300">
                    <span className="text-[10px] text-cyan-800 font-black block uppercase">
                      {t('चालू महिना (This Month)', 'This Month')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-cyan-950">₹{orderStats.thisMonthPaid}</span>
                    <span className="text-[10px] text-cyan-700 font-bold block">
                      {orderStats.thisMonthOrdersCount} ऑर्डर्स ({orderStats.thisMonthPassCount} मासिक)
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-black block uppercase">
                      {t('एकूण UPI कमाई', 'Total Revenue')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-950">₹{orderStats.totalRevenue}</span>
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      मागील महिना: ₹{orderStats.lastMonthPaid}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                    <span className="text-[10px] text-indigo-800 font-black block uppercase">
                      {t('एकूण पैसे पाठवणारे', 'Total Payers')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-indigo-950">{adminOrders.length}</span>
                    <span className="text-[10px] text-indigo-700 font-bold block">ग्राहक / CSC केंद्र</span>
                  </div>
                </div>

                {/* Modal Sub-Tabs */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('payers')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      adminSubTab === 'payers'
                        ? 'bg-slate-900 text-amber-300 shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    👥 कोणी पैसे पाठवले ({adminOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('monthly')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      adminSubTab === 'monthly'
                        ? 'bg-slate-900 text-amber-300 shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    📊 महिनानिहाय कमाई ({orderStats.monthlyBreakdown.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('settings')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                      adminSubTab === 'settings'
                        ? 'bg-slate-900 text-amber-300 shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ⚙️ UPI सेटिंग्स
                  </button>
                </div>

                {adminSubTab === 'payers' && (
                  <div className="space-y-3">
                    {/* Search & Filter Row */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={payerSearch}
                          onChange={(e) => setPayerSearch(e.target.value)}
                          placeholder="नाव, मोबाईल नंबर किंवा UTR ने शोधा..."
                          className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {(
                          [
                            { id: 'all', label: 'सर्व' },
                            { id: 'today', label: 'आजचे' },
                            { id: 'verified', label: 'पडताळलेले ✓' },
                            { id: 'pending', label: 'प्रलंबित' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setPayerStatusFilter(f.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                              payerStatusFilter === f.id
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detailed Payers List */}
                    <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                      {filteredAdminOrders.length === 0 ? (
                        <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-600">
                            {adminOrders.length === 0
                              ? 'अद्याप कोणीही UPI पेमेंट नोंदवलेले नाही.'
                              : 'तुमच्या शोधानुसार कोणतीही पेमेंट नोंद सापडली नाही.'}
                          </p>
                        </div>
                      ) : (
                        filteredAdminOrders.map((ord, idx) => {
                          const dt = new Date(ord.createdAtMs || ord.createdAtIso || Date.now());
                          const dateStr = dt.toLocaleDateString('mr-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          });
                          const timeStr = dt.toLocaleTimeString('mr-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          });
                          const hasValidPhone = /^[6-9][0-9]{9}$/.test(ord.customerMobile || '');
                          const waMsg = encodeURIComponent(
                            `नमस्कार ${ord.customerName} जी, महा कॉर्नर VIP पोस्टर पॅक (${ord.packNameMr}) साठी तुमचे ₹${ord.amount} पेमेंट (UTR: ${ord.utrNumber}) प्राप्त झाले आहे. धन्यवाद!`
                          );

                          return (
                            <div
                              key={ord.id || `${ord.utrNumber}_${idx}`}
                              className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 shadow-xs space-y-2.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-black">
                                      {idx + 1}
                                    </span>
                                    <span className="font-black text-slate-900 text-sm">
                                      👤 {ord.customerName || 'ग्राहक'}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        ord.status === 'verified'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                                      }`}
                                    >
                                      {ord.status === 'verified' ? '✓ Verified' : '⏳ Pending'}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                                    <span className="font-bold text-slate-800">{ord.packNameMr}</span>
                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                      <Clock className="w-3 h-3" />
                                      {dateStr} • {timeStr}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-lg font-black text-emerald-700 block">
                                    ₹{ord.amount}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                                    {ord.paymentMethod}
                                  </span>
                                </div>
                              </div>

                              {/* Mobile + UTR + Actions bar */}
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(ord.customerMobile, `mob_${ord.id}`)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold cursor-pointer"
                                    title="Copy Mobile"
                                  >
                                    <span>📱 {ord.customerMobile || 'N/A'}</span>
                                    {copiedOrderField === `mob_${ord.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(ord.utrNumber, `utr_${ord.id}`)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-mono font-bold cursor-pointer"
                                    title="Copy UTR"
                                  >
                                    <span>UTR: {ord.utrNumber}</span>
                                    {copiedOrderField === `utr_${ord.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-amber-700" />
                                    )}
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {hasValidPhone && (
                                    <a
                                      href={`https://wa.me/91${ord.customerMobile}?text=${waMsg}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      <span>WhatsApp</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    disabled={updatingOrderId === ord.id}
                                    onClick={() => void handleToggleOrderStatus(ord)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                                  >
                                    {ord.status === 'verified' ? 'Pending करा' : 'Verify करा ✓'}
                                  </button>

                                  {confirmDeleteOrderId === ord.id ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteOrder(ord)}
                                        className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                                      >
                                        हटवा
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteOrderId(null)}
                                        className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                      >
                                        रद्द
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteOrderId(ord.id)}
                                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                                      title="Delete record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {adminSubTab === 'monthly' && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-black text-slate-900 text-xs block">
                      {t('महिनानिहाय जमा तपशील (Month Paid Summary):', 'Monthly Paid Summary:')}
                    </span>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs">
                      {orderStats.monthlyBreakdown.length === 0 ? (
                        <p className="text-slate-400 text-center py-6">अद्याप कोणतीही मासिक नोंद नाही.</p>
                      ) : (
                        orderStats.monthlyBreakdown.map((m) => (
                          <div
                            key={m.monthKey}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{m.monthLabel}</span>
                              <span className="text-[10px] text-slate-500 ml-2">
                                ({m.orderCount} {t('ऑर्डर्स', 'orders')} · {m.monthlyPassCount} {t('मासिक पास', 'month pass')})
                              </span>
                            </div>
                            <span className="font-black text-emerald-700">₹{m.revenue}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {adminSubTab === 'settings' && (
                  <form onSubmit={handleSaveOwnerSettings} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="font-black text-slate-900 text-xs block">
                      {t('थेट पैसे जमा होण्यासाठी तुमचा UPI आयडी सेट करा:', 'Set Your Personal UPI ID for Direct Income:')}
                    </span>
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        value={tempUpiId}
                        onChange={(e) => setTempUpiId(e.target.value)}
                        placeholder="उदा. kamleshpatil9719@okaxis किंवा BHARATPE...@unitype"
                        className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-mono text-slate-900"
                      />
                      <input
                        type="text"
                        value={tempOwnerName}
                        onChange={(e) => setTempOwnerName(e.target.value)}
                        placeholder="नांव (उदा. Maha Corner / कमलेश पाटील)"
                        className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs text-slate-900"
                      />
                    </div>
                    {adminError && <p className="text-xs text-rose-600 font-bold">{adminError}</p>}
                    {saveSettingsSuccess && (
                      <p className="text-xs text-emerald-700 font-bold">सेटिंग्ज यशस्वीरीत्या सेव्ह झाल्या! ✓</p>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                    >
                      UPI आयडी सेव्ह करा
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

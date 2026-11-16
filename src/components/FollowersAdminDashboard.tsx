import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ShieldCheck,
  Users,
  Search,
  FileSpreadsheet,
  Calendar,
  Clock,
  Lock,
  LogOut,
  Trash2,
  MessageCircle,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  X,
  Mail,
  KeyRound
} from 'lucide-react';
import {
  auth,
  googleProvider,
  ADMIN_EMAIL
} from '../firebase';
import {
  FirebaseFollowerRecord,
  subscribeAdminFollowers,
  deleteFollowerAsAdmin,
  exportFollowersToExcel,
  syncAdminTotalCounter
} from '../utils/firebaseFollowers';
import {
  FirebaseContactRecord,
  subscribeAdminContactMessages,
  deleteContactMessageAsAdmin
} from '../utils/firebaseContact';
import { useLanguage } from '../contexts/LanguageContext';
import { MAHA_CORNER_URL } from '../utils/shareConfig';

interface FollowersAdminDashboardProps {
  onFollowerCountSync?: (count: number) => void;
}

export const FollowersAdminDashboard: React.FC<FollowersAdminDashboardProps> = ({
  onFollowerCountSync,
}) => {
  const { lang, t } = useLanguage();

  const [authReady, setAuthReady] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [signingIn, setSigningIn] = useState<boolean>(false);

  // Zero-quota Owner PIN unlock state (works independently of Firestore quota)
  const [pinInput, setPinInput] = useState<string>('');
  const [verifiedPin, setVerifiedPin] = useState<string>('');
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');

  const [adminSection, setAdminSection] = useState<'followers' | 'messages'>('followers');
  const [firestoreFollowers, setFirestoreFollowers] = useState<FirebaseFollowerRecord[]>([]);
  const [serverFollowers, setServerFollowers] = useState<FirebaseFollowerRecord[]>([]);
  const [browserFollowers, setBrowserFollowers] = useState<number>(0);
  const [legacyFollowerCount, setLegacyFollowerCount] = useState<number>(0);
  const [firestoreMessages, setFirestoreMessages] = useState<FirebaseContactRecord[]>([]);
  const [serverMessages, setServerMessages] = useState<FirebaseContactRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string>('');

  // Search, Date & Sort Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickDate, setQuickDate] = useState<'all' | 'today' | 'week'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Inline delete confirmation (never window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  const isAuthorizedAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const isPinUnlocked = Boolean(verifiedPin);
  const canAccessDashboard = isAuthorizedAdmin || isPinUnlocked;

  const followers = useMemo<FirebaseFollowerRecord[]>(() => {
    const byMobile = new Map<string, FirebaseFollowerRecord>();
    for (const s of serverFollowers) {
      byMobile.set(s.mobile || s.id, s);
    }
    for (const f of firestoreFollowers) {
      if (!byMobile.has(f.mobile || f.id)) {
        byMobile.set(f.mobile || f.id, f);
      }
    }
    return Array.from(byMobile.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [serverFollowers, firestoreFollowers]);

  const contactMessages = useMemo<FirebaseContactRecord[]>(() => {
    const byId = new Map<string, FirebaseContactRecord>();
    for (const m of serverMessages) {
      byId.set(m.id, m);
    }
    for (const m of firestoreMessages) {
      if (!byId.has(m.id)) {
        byId.set(m.id, m);
      }
    }
    return Array.from(byId.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [serverMessages, firestoreMessages]);

  const loadServerAdminLists = useCallback(
    async (pinToUse: string) => {
      if (!pinToUse) return;
      setLoadingData(true);
      try {
        const [subRes, msgRes] = await Promise.all([
          fetch('/api/subscribers/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinToUse }),
          }),
          fetch('/api/contact/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinToUse }),
          }),
        ]);

        const subData = await subRes.json().catch(() => ({}));
        if (subRes.ok && subData?.success && Array.isArray(subData.subscribers)) {
          const mapped: FirebaseFollowerRecord[] = subData.subscribers.map((s: any) => {
            const iso = String(s.subscribedAt || new Date().toISOString());
            const ms = Date.parse(iso) || Date.now();
            return {
              id: String(s.id || s.mobile),
              name: String(s.name || ''),
              mobile: String(s.mobile || ''),
              consentGiven: true,
              interests: Array.isArray(s.interests) ? s.interests.map(String) : [],
              source: 'portal-server',
              createdAtIso: iso,
              createdAtMs: ms,
            };
          });
          setServerFollowers(mapped);
          const nextBrowserFollowers = Number(subData.browserFollowers) || 0;
          const nextLegacyCount = Number(subData.legacyFollowerCount) || 0;
          setBrowserFollowers(nextBrowserFollowers);
          setLegacyFollowerCount(nextLegacyCount);
          if (onFollowerCountSync) {
            const bestCount = Math.max(
              mapped.length,
              firestoreFollowers.length,
              Number(subData.followerCount) || 0,
              nextLegacyCount
            );
            onFollowerCountSync(bestCount);
          }
        }

        const msgData = await msgRes.json().catch(() => ({}));
        if (msgRes.ok && msgData?.success && Array.isArray(msgData.messages)) {
          const mappedMsgs: FirebaseContactRecord[] = msgData.messages.map((m: any) => ({
            id: String(m.id),
            name: String(m.name || ''),
            mobile: String(m.mobile || ''),
            email: String(m.email || ''),
            message: String(m.message || ''),
            createdAtMs: Number(m.createdAtMs) || Date.now(),
          }));
          setServerMessages(mappedMsgs);
        }
      } catch {
        // Non-fatal
      } finally {
        setLoadingData(false);
      }
    },
    [onFollowerCountSync, firestoreFollowers.length]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user && (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase())) {
        setAuthError(
          t(
            `Google खाते Admin (${ADMIN_EMAIL}) नाही — तुम्ही खालील Owner PIN ने डॅशबोर्ड अनलॉक करू शकता.`,
            `Signed-in account is not Admin (${ADMIN_EMAIL}) — you can still unlock with Owner PIN.`
          )
        );
      } else {
        setAuthError('');
      }
    });
    return () => unsub();
  }, [t]);

  useEffect(() => {
    if (verifiedPin) {
      void loadServerAdminLists(verifiedPin);
    } else {
      setServerFollowers([]);
      setServerMessages([]);
      setBrowserFollowers(0);
      setLegacyFollowerCount(0);
    }
  }, [verifiedPin, loadServerAdminLists]);

  useEffect(() => {
    if (!authReady || !isAuthorizedAdmin) {
      setFirestoreFollowers([]);
      setFirestoreMessages([]);
      return;
    }

    setDataError('');
    const unsubFollowers = subscribeAdminFollowers(
      (records) => {
        setFirestoreFollowers(records);
        const bestTotal = Math.max(records.length, serverFollowers.length, legacyFollowerCount);
        if (onFollowerCountSync) {
          onFollowerCountSync(bestTotal);
        }
        void syncAdminTotalCounter(bestTotal).catch(() => {});
      },
      () => {
        // Silently degrade to zero-quota Server lists if Firestore quota is exceeded
      }
    );

    const unsubContacts = subscribeAdminContactMessages(
      (msgs) => {
        setFirestoreMessages(msgs);
      },
      () => {}
    );

    return () => {
      unsubFollowers();
      unsubContacts();
    };
  }, [authReady, isAuthorizedAdmin, onFollowerCountSync, serverFollowers.length, legacyFollowerCount]);

  const handleVerifyOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
    if (!cleaned) {
      setPinError(t('कृपया ओनर PIN टाका.', 'Please enter Owner PIN.'));
      return;
    }
    setVerifyingPin(true);
    setPinError('');
    try {
      const res = await fetch('/api/posters/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPinError(
          res.status === 429 && data?.error
            ? data.error
            : t('ओनर PIN चुकीचा आहे.', 'Invalid Owner PIN.')
        );
        return;
      }
      setVerifiedPin(cleaned);
      setPinInput('');
    } catch {
      setPinError(t('सर्व्हरशी संपर्क होऊ शकला नाही.', 'Server unreachable.'));
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleGoogleAdminSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user?.email?.toLowerCase() || '';
      if (!cred.user?.emailVerified || email !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setAuthError(
          t(
            `प्रवेश नाकारला: "${email || 'अज्ञात'}" हे अधिकृत Admin ईमेल (${ADMIN_EMAIL}) नाही.`,
            `Access denied: "${email || 'unknown'}" is not the authorized Admin email (${ADMIN_EMAIL}).`
          )
        );
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || t('Google लॉगिन करताना अडचण आली.', 'Failed to sign in with Google.'));
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleAdminSignOut = async () => {
    await signOut(auth);
    setVerifiedPin('');
    setFirestoreFollowers([]);
    setServerFollowers([]);
    setBrowserFollowers(0);
    setLegacyFollowerCount(0);
    setFirestoreMessages([]);
    setServerMessages([]);
  };

  const todayIso = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    []
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let todayCount = 0;
    let weekCount = 0;
    let consentCount = 0;

    for (const f of followers) {
      const istDate = new Date(f.createdAtMs || f.createdAtIso).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      if (istDate === todayIso) todayCount++;
      if (now - (f.createdAtMs || 0) <= weekMs) weekCount++;
      if (f.consentGiven) consentCount++;
    }

    return {
      total: Math.max(followers.length, legacyFollowerCount),
      registeredTotal: followers.length,
      todayCount,
      weekCount,
      consentCount,
    };
  }, [followers, legacyFollowerCount, todayIso]);

  const filteredFollowers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const filtered = followers.filter((f) => {
      if (q) {
        const matchName = f.name.toLowerCase().includes(q);
        const matchMobile = f.mobile.includes(q);
        const matchInterests = f.interests.some((i) => i.toLowerCase().includes(q));
        if (!matchName && !matchMobile && !matchInterests) return false;
      }

      const istDate = new Date(f.createdAtMs || f.createdAtIso).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });

      if (quickDate === 'today' && istDate !== todayIso) return false;
      if (quickDate === 'week' && now - (f.createdAtMs || 0) > weekMs) return false;
      if (fromDate && istDate < fromDate) return false;
      if (toDate && istDate > toDate) return false;

      return true;
    });

    if (sortOrder === 'oldest') {
      return [...filtered].sort((a, b) => a.createdAtMs - b.createdAtMs);
    }
    return [...filtered].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [followers, searchQuery, quickDate, fromDate, toDate, sortOrder, todayIso]);

  const handleConfirmDelete = async (followerId: string) => {
    setDeletingId(followerId);
    try {
      if (verifiedPin) {
        const res = await fetch(`/api/subscribers/${encodeURIComponent(followerId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin }),
        });
        if (res.ok) {
          setServerFollowers((prev) => prev.filter((s) => s.id !== followerId));
        }
      }
      if (isAuthorizedAdmin) {
        await deleteFollowerAsAdmin(followerId, Math.max(0, followers.length - 1)).catch(() => {});
        setFirestoreFollowers((prev) => prev.filter((f) => f.id !== followerId));
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDataError(err?.message || t('हटवताना त्रुटी आली.', 'Failed to delete follower.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmDeleteMessage = async (messageId: string) => {
    setDeletingMsgId(messageId);
    try {
      if (verifiedPin) {
        const res = await fetch(`/api/contact/${encodeURIComponent(messageId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin }),
        });
        if (res.ok) {
          setServerMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      }
      if (isAuthorizedAdmin) {
        await deleteContactMessageAsAdmin(messageId).catch(() => {});
        setFirestoreMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      setConfirmDeleteMsgId(null);
    } catch (err: any) {
      setDataError(err?.message || t('संदेश हटवताना त्रुटी आली.', 'Failed to delete message.'));
    } finally {
      setDeletingMsgId(null);
    }
  };

  const formatIstDate = (ms: number, iso: string) =>
    new Date(ms || iso).toLocaleDateString(lang === 'en' ? 'en-IN' : 'mr-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const formatIstTime = (ms: number, iso: string) =>
    new Date(ms || iso).toLocaleTimeString(lang === 'en' ? 'en-IN' : 'mr-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  // Gate 1: Non-Admin / Logged-out view
  if (!authReady) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>{t('Firebase पडताळणी तपासत आहे...', 'Checking Firebase Admin authentication...')}</span>
      </div>
    );
  }

  if (!canAccessDashboard) {
    return (
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white border border-amber-500/30 shadow-xl space-y-5 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-black">
            {t('Admin Dashboard (Followers & Messages)', 'Admin Dashboard (Followers & Messages)')}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t(
              'फॉलोअर्स यादी आणि संपर्क संदेश पाहण्यासाठी खालील Owner PIN टाका किंवा Google Admin खात्याने लॉगिन करा.',
              'Unlock with Owner PIN (zero quota) or sign in with Google Admin to manage followers and contact messages.'
            )}
          </p>
        </div>

        <form onSubmit={handleVerifyOwnerPin} className="space-y-2.5 text-left bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            <span>{t('Owner PIN ने तात्काळ अनलॉक करा (० कोटा खर्च):', 'Unlock with Owner PIN (Zero Quota):')}</span>
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder={t('ओनर PIN टाका...', 'Enter Owner PIN...')}
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={verifyingPin}
              className="px-5 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs cursor-pointer"
            >
              {verifyingPin ? t('तपासत आहे...', 'Checking...') : t('अनलॉक करा', 'Unlock')}
            </button>
          </div>
          {pinError && <p className="text-xs font-bold text-rose-400">{pinError}</p>}
        </form>

        {authError && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold text-left">
            {authError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleAdminSignIn}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {signingIn
                ? t('लॉगिन होत आहे...', 'Signing in...')
                : t('किंवा Sign in with Google Admin', 'Or Sign in with Google Admin')}
            </span>
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('साइन आउट', 'Sign Out')}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Gate 2: Authenticated Admin View
  return (
    <div className="space-y-5">
      {/* Top Admin Status Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black truncate">
              {t('Admin Dashboard (Followers & Messages)', 'Admin Dashboard (Followers & Messages)')}
            </h3>
            <p className="text-xs text-emerald-300 truncate">
              ✓ {verifiedPin ? t('Owner PIN प्रमाणित', 'Owner PIN Unlocked') : ''}{' '}
              {currentUser?.email ? `• ${currentUser.email}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {verifiedPin && (
            <button
              type="button"
              disabled={loadingData}
              onClick={() => void loadServerAdminLists(verifiedPin)}
              className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              title={t('ताजी यादी रिफ्रेश करा', 'Refresh Followers & Messages')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>{t('रिफ्रेश करा', 'Refresh')}</span>
            </button>
          )}

          {adminSection === 'followers' && (
            <button
              type="button"
              disabled={filteredFollowers.length === 0}
              onClick={() => exportFollowersToExcel(filteredFollowers)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t(`Excel डाउनलोड (${filteredFollowers.length})`, `Download Excel (${filteredFollowers.length})`)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleAdminSignOut}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('लॉगआउट / लॉक करा', 'Sign Out / Lock')}</span>
          </button>
        </div>
      </div>

      {/* Section Switcher: Followers vs Contact Messages */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAdminSection('followers')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-colors ${
            adminSection === 'followers'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t(`फॉलोअर्स यादी (${followers.length})`, `Followers (${followers.length})`)}</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminSection('messages')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-colors ${
            adminSection === 'messages'
              ? 'bg-slate-900 text-amber-400 shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>{t(`संपर्क संदेश / तक्रारी (${contactMessages.length})`, `Contact Messages (${contactMessages.length})`)}</span>
        </button>
      </div>

      {adminSection === 'messages' ? (
        <div className="space-y-3">
          {contactMessages.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
              <Mail className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                {t('अजून कोणताही संपर्क संदेश आलेला नाही.', 'No contact inquiries received yet.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contactMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900">{msg.name}</div>
                      <div className="text-xs text-slate-600 font-medium flex flex-wrap items-center gap-3 mt-0.5">
                        <span className="font-mono font-bold text-emerald-700">📞 {msg.mobile}</span>
                        <span className="break-all">✉️ {msg.email}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                      {formatIstDate(msg.createdAtMs, '')} • {formatIstTime(msg.createdAtMs, '')}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {msg.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`mailto:${msg.email}?subject=${encodeURIComponent('Re: MAHA CORNER Support')}`}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{t('ईमेल उत्तर द्या', 'Reply Email')}</span>
                      </a>
                      <a
                        href={`https://api.whatsapp.com/send?phone=91${msg.mobile}&text=${encodeURIComponent(`नमस्कार ${msg.name} जी, MAHA CORNER वर पाठवलेल्या तुमच्या संदेशाबद्दल संपर्क करत आहोत:`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    {confirmDeleteMsgId === msg.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={deletingMsgId === msg.id}
                          onClick={() => handleConfirmDeleteMessage(msg.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                        >
                          {deletingMsgId === msg.id ? '...' : t('होय हटवा', 'Confirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          {t('रद्द', 'Cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMsgId(msg.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title={t('हटवा', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('एकूण फॉलोअर्स', 'Total Followers')}</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{stats.total}</div>
          {(browserFollowers > 0 || legacyFollowerCount > stats.registeredTotal) && (
            <div className="text-[10px] font-bold text-slate-500 mt-0.5 tabular-nums">
              {t(
                `नोंदणी यादी: ${stats.registeredTotal}${browserFollowers > 0 ? ` • ब्राउझर फॉलो: ${browserFollowers}` : ''}`,
                `List: ${stats.registeredTotal}${browserFollowers > 0 ? ` • Browser: ${browserFollowers}` : ''}`
              )}
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('आजचे नवीन', 'Joined Today')}</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">{stats.todayCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            <span>{t('मागील ७ दिवस', 'Last 7 Days')}</span>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-1 tabular-nums">{stats.weekCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('संमती प्रमाणित', 'Consent Verified')}</span>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1 tabular-nums">{stats.consentCount}</div>
        </div>
      </div>

      {/* Search & Date Filter Controls */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('नाव, मोबाईल नंबर किंवा विषय शोधा...', 'Search by name, mobile, or topic...')}
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t('पासून तारीख', 'From Date')}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setQuickDate('all');
                  setFromDate(e.target.value);
                }}
                className="w-full h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t('पर्यंत तारीख', 'To Date')}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setQuickDate('all');
                  setToDate(e.target.value);
                }}
                className="w-full h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-center gap-1.5 justify-end">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800"
            >
              <option value="newest">{t('नवीन फॉलोअर्स आधी', 'Newest First')}</option>
              <option value="oldest">{t('जुने फॉलोअर्स आधी', 'Oldest First')}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: t('सर्व दिवस', 'All Time') },
                { id: 'today', label: t('फक्त आज', 'Today Only') },
                { id: 'week', label: t('मागील ७ दिवस', 'Last 7 Days') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setQuickDate(opt.id);
                  setFromDate('');
                  setToDate('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  quickDate === opt.id && !fromDate && !toDate
                    ? 'bg-slate-900 text-amber-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-500 tabular-nums">
            {t(`दाखवत आहे: ${filteredFollowers.length} / ${followers.length}`, `Showing ${filteredFollowers.length} of ${followers.length}`)}
          </span>
        </div>
      </div>

      {dataError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800">
          {dataError}
        </div>
      )}

      {/* Loading / Empty / List */}
      {loadingData ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
          <span>{t('Firebase Firestore मधून फॉलोअर्स लोड होत आहेत...', 'Loading followers from Firestore...')}</span>
        </div>
      ) : filteredFollowers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-slate-600">
            {followers.length === 0
              ? t('अजून कोणीही फॉलोअर नोंदणी केलेली नाही.', 'No followers have registered in Firestore yet.')
              : t('निवडलेल्या शोधात किंवा तारखेत कोणताही फॉलोअर आढळला नाही.', 'No followers match your current search/date filter.')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Responsive Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{t('नाव', 'Name')}</th>
                    <th className="py-3 px-4">{t('मोबाईल नंबर', 'Mobile')}</th>
                    <th className="py-3 px-4">{t('तारीख व वेळ', 'Date & Time')}</th>
                    <th className="py-3 px-4">{t('पसंती व संमती', 'Interests & Consent')}</th>
                    <th className="py-3 px-4 text-right">{t('कृती', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredFollowers.map((item, idx) => {
                    const waMsg = `नमस्कार ${item.name} जी,\nमहा कॉर्नर (MAHA CORNER) वरील नवीन योजना, GR व पोस्टर अपडेट्स तपासा:\n👉 ${MAHA_CORNER_URL}`;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700 tabular-nums">{item.mobile}</td>
                        <td className="py-3 px-4 text-slate-700 tabular-nums">
                          <div className="font-bold">{formatIstDate(item.createdAtMs, item.createdAtIso)}</div>
                          <div className="text-[11px] text-slate-500">{formatIstTime(item.createdAtMs, item.createdAtIso)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-700 font-medium truncate max-w-[200px]">
                            {item.interests.join(', ')}
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700">
                            ✓ {t('संमती दिली', 'Consented')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={`https://api.whatsapp.com/send?phone=91${item.mobile}&text=${encodeURIComponent(waMsg)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>

                            {confirmDeleteId === item.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={() => handleConfirmDelete(item.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                                >
                                  {deletingId === item.id ? '...' : t('होय हटवा', 'Confirm')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold cursor-pointer"
                                >
                                  {t('रद्द', 'Cancel')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title={t('हटवा', 'Delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Friendly Cards View */}
          <div className="md:hidden space-y-2.5">
            {filteredFollowers.map((item, idx) => {
              const waMsg = `नमस्कार ${item.name} जी,\nमहा कॉर्नर (MAHA CORNER) वरील नवीन योजना, GR व पोस्टर अपडेट्स तपासा:\n👉 ${MAHA_CORNER_URL}`;
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        <span className="text-slate-400 mr-1.5 tabular-nums">#{idx + 1}</span>
                        {item.name}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                        📞 {item.mobile}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                      ✓ {t('संमती', 'Consent')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatIstDate(item.createdAtMs, item.createdAtIso)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatIstTime(item.createdAtMs, item.createdAtIso)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500">{item.interests.join(', ')}</div>

                  <div className="pt-1 flex items-center gap-2">
                    <a
                      href={`https://api.whatsapp.com/send?phone=91${item.mobile}&text=${encodeURIComponent(waMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t('WhatsApp मेसेज', 'WhatsApp')}</span>
                    </a>

                    {confirmDeleteId === item.id ? (
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => handleConfirmDelete(item.id)}
                        className="py-2.5 px-3 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
                      >
                        {deletingId === item.id ? '...' : t('हटवा ✓', 'Delete ✓')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
        </>
      )}

    </div>
  );
};

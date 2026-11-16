import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  Send,
  Trash2,
  Users,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  UserPlus,
  Megaphone,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import {
  LiveUpdateItem,
  postOwnerUpdate,
  deleteOwnerUpdate,
  setLocalIsFollowed
} from '../utils/updatesApi';
import { registerFollowerInFirestore } from '../utils/firebaseFollowers';
import { buildWhatsAppShareUrl, getPortalInviteShareUrl, MAHA_CORNER_URL } from '../utils/shareConfig';
import { FollowersAdminDashboard } from './FollowersAdminDashboard';

export type UpdatesModalInitialTab = 'updates' | 'subscribe' | 'followers-admin' | 'owner';

interface UpdatesSubscribeModalProps {
  isOpen: boolean;
  initialTab?: UpdatesModalInitialTab;
  onClose: () => void;
  updates: LiveUpdateItem[];
  followerCount: number;
  unreadCount: number;
  lastSeenTs: number;
  isFollowed: boolean;
  onFollowedChange: (followed: boolean, nextFollowerCount?: number) => void;
  onUpdatesChange: (nextUpdates: LiveUpdateItem[]) => void;
  onMarkAllSeen: () => void;
  onNavigateTab: (tab: AppTab) => void;
}

const TARGET_TAB_LABELS: Array<{ id: AppTab; mr: string; en: string }> = [
  { id: 'ai-poster', mr: '🖼️ पोस्टर मेकर', en: '🖼️ Poster Maker' },
  { id: 'gr', mr: '📜 शासन निर्णय (GR)', en: '📜 Govt GR' },
  { id: 'jobs', mr: '💼 नोकरी भरती', en: '💼 Job Alerts' },
  { id: 'farmer-card', mr: '🌾 शेतकरी ओळखपत्र', en: '🌾 Farmer ID Card' },
  { id: 'pdf-tools', mr: '🧰 महा कॉर्नर PDF टूल्स', en: '🧰 PDF Tools' },
  { id: 'cutter', mr: '🪪 कार्ड कटर', en: '🪪 Card Cutter' },
  { id: 'portals', mr: '🌐 शासकीय पोर्टल्स', en: '🌐 Govt Portals' },
];

const INTEREST_OPTIONS = [
  { id: 'posteri', mr: 'नवीन योजना व पोस्टर्स', en: 'Schemes & Posters' },
  { id: 'gr', mr: 'ताजे शासन निर्णय (GR)', en: 'Daily Govt GR' },
  { id: 'jobs', mr: 'सरकारी नोकरी भरती', en: 'Job Alerts' },
  { id: 'farmer', mr: 'शेतकरी व पीक विमा', en: 'Farmer & Crop Insurance' },
];

export const UpdatesSubscribeModal: React.FC<UpdatesSubscribeModalProps> = ({
  isOpen,
  initialTab = 'subscribe',
  onClose,
  updates,
  followerCount,
  unreadCount,
  lastSeenTs,
  isFollowed,
  onFollowedChange,
  onUpdatesChange,
  onMarkAllSeen,
  onNavigateTab,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<UpdatesModalInitialTab>(initialTab);

  // Firebase Follow + Consent + Registration Form state
  const [subName, setSubName] = useState<string>('');
  const [subMobile, setSubMobile] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [subInterests, setSubInterests] = useState<string[]>(['नवीन योजना व पोस्टर्स', 'ताजे शासन निर्णय (GR)']);
  const [subLoading, setSubLoading] = useState<boolean>(false);
  const [subMessage, setSubMessage] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [browserBellStatus, setBrowserBellStatus] = useState<string>('');

  // Owner Announcements state
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState<boolean>(false);
  const [ownerAuthErr, setOwnerAuthErr] = useState<string>('');
  const [ownerLoading, setOwnerLoading] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newMessage, setNewMessage] = useState<string>('');
  const [newTargetTab, setNewTargetTab] = useState<AppTab>('ai-poster');
  const [postingUpdate, setPostingUpdate] = useState<boolean>(false);
  const [lastPostedShareUrl, setLastPostedShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSubMessage(null);
      setOwnerAuthErr('');
    } else {
      setIsOwnerUnlocked(false);
      setOwnerPin('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const toggleInterest = (label: string) => {
    setSubInterests((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleEnableBrowserAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserBellStatus(t('या ब्राउझरवर पुश नोटिफिकेशन उपलब्ध नाही.', 'Browser notifications not supported here.'));
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserBellStatus(t('ब्राउझर नोटिफिकेशन्स सुरू झाली आहेत ✓', 'Browser notifications enabled ✓'));
        new Notification('महा कॉर्नर (MAHA CORNER)', {
          body: t('नवीन अपडेट्स आल्यावर तुम्हाला येथे सूचना मिळेल!', 'You will receive alerts here when new updates arrive!'),
          icon: '/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png',
        });
      } else {
        setBrowserBellStatus(t('ब्राउझर परवानगी नाकारली आहे.', 'Notification permission denied in browser.'));
      }
    } catch {
      setBrowserBellStatus(t('ब्राउझर नोटिफिकेशन सुरू करता आले नाही.', 'Unable to enable notifications.'));
    }
  };

  const handleFirebaseFollowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubMessage(null);

    if (!consentChecked) {
      setSubMessage({
        type: 'err',
        text: t(
          'कृपया नाव आणि मोबाईल नंबर Firebase मध्ये सेव्ह करण्यासाठी तुमची संमती (Checkbox) टिक करा.',
          'Please check the consent box to allow saving your name & mobile number.'
        ),
      });
      return;
    }

    setSubLoading(true);
    try {
      const res = await registerFollowerInFirestore({
        name: subName,
        mobile: subMobile,
        consentGiven: consentChecked,
        interests: subInterests,
        source: 'maha-corner-follow',
      });

      if (res.duplicate) {
        setLocalIsFollowed(true);
        onFollowedChange(true);
        setSubMessage({
          type: 'warn',
          text: res.message,
        });
      } else if (res.success) {
        setLocalIsFollowed(true);
        onFollowedChange(true, res.totalFollowers);
        confetti({ particleCount: 55, spread: 70 });
        setSubMessage({
          type: 'ok',
          text: t(
            'तुमची फॉलो नोंदणी सुरक्षितरीत्या सेव्ह झाली आहे! धन्यवाद. ✓',
            'Your Follow registration is safely saved! Thank you. ✓'
          ),
        });
        setSubName('');
        setSubMobile('');
      } else {
        setSubMessage({
          type: 'err',
          text: res.message,
        });
      }
    } catch (err: any) {
      console.error('Follower registration error:', err);
      setSubMessage({
        type: 'err',
        text: t(
          'नोंदणी सेव्ह करताना अडचण आली. कृपया इंटरनेट व माहिती तपासून पुन्हा प्रयत्न करा.',
          'Could not save registration right now. Please check your details and try again.'
        ),
      });
    } finally {
      setSubLoading(false);
    }
  };

  const handleOwnerUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerLoading(true);
    setOwnerAuthErr('');
    try {
      const res = await fetch('/api/posters/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: ownerPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429 && data?.error) {
          setOwnerAuthErr(data.error);
        } else {
          setOwnerAuthErr(t('ओनर PIN चुकीचा आहे.', 'Invalid Owner PIN.'));
        }
      } else {
        setIsOwnerUnlocked(true);
      }
    } catch {
      setOwnerAuthErr(t('सर्व्हरशी संपर्क होऊ शकला नाही.', 'Server unreachable.'));
    } finally {
      setOwnerLoading(false);
    }
  };

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;
    setPostingUpdate(true);
    const res = await postOwnerUpdate({
      pin: ownerPin,
      title: newTitle.trim(),
      message: newMessage.trim(),
      targetTab: newTargetTab,
    });
    setPostingUpdate(false);
    if (res.success && res.updates) {
      onUpdatesChange(res.updates);
      const waText = `🔔 *नवीन महत्त्वाची सूचना (महा कॉर्नर)*\n\n📢 *${newTitle.trim()}*\n${newMessage.trim()}`;
      setLastPostedShareUrl(buildWhatsAppShareUrl(waText, lang));
      setNewTitle('');
      setNewMessage('');
      confetti({ particleCount: 45, spread: 60 });
    } else {
      setOwnerAuthErr(res.error || t('अपडेट सेव्ह करता आले नाही.', 'Failed to publish update.'));
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    const res = await deleteOwnerUpdate(id, ownerPin);
    if (res.success && res.updates) {
      onUpdatesChange(res.updates);
    }
  };

  const getTabLabel = (tabId: AppTab) => {
    const found = TARGET_TAB_LABELS.find((x) => x.id === tabId);
    return found ? (lang === 'en' ? found.en : found.mr) : tabId;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white px-4 sm:px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-500 p-0.5 shadow-md shadow-cyan-500/25 shrink-0">
              <img
                src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
                alt="MAHA CORNER"
                className="w-full h-full object-cover rounded-full bg-[#020817]"
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black truncate">
                {t('महा कॉर्नर फॉलो व अपडेट्स केंद्र', 'MAHA CORNER Follow & Updates Hub')}
              </h3>
              <p className="text-xs text-slate-300 tabular-nums">
                {t(`एकूण फॉलोअर्स: ${followerCount}`, `Total Followers: ${followerCount}`)} ·{' '}
                {unreadCount > 0
                  ? t(`${unreadCount} नवीन माहिती उपलब्ध`, `${unreadCount} unread updates`)
                  : t('सुरक्षित फॉलोअर्स पोर्टल (Firebase)', 'Secured Followers Portal')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('बंद करा', 'Close')}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Inside Modal */}
        <div className="px-3 sm:px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('subscribe')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'subscribe'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('फॉलो व नोंदणी करा', 'Follow & Register')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('updates')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'updates'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('नवीन अपडेट्स', 'Live Updates')}</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followers-admin')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'followers-admin'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-amber-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('Admin Dashboard (Followers)', 'Admin Dashboard')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'owner'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
            }`}
          >
            {isOwnerUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{t('सूचना पब्लिश करा', 'Post Notice')}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: FOLLOW + CONSENT + FIREBASE REGISTRATION */}
          {activeTab === 'subscribe' && (
            <div className="space-y-4">
              {subMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                    subMessage.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : subMessage.type === 'warn'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{subMessage.text}</span>
                </div>
              )}

              <form
                onSubmit={handleFirebaseFollowSubmit}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-emerald-50/90 to-white border-2 border-emerald-300 space-y-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-emerald-600" />
                      <span>{t('महा कॉर्नरला फॉलो करा (मोफत अपडेट्स)', 'Follow MAHA CORNER (Free Alerts)')}</span>
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      {t(
                        'नवीन सरकारी योजना, GR, नोकरी भरती व पोस्टर्सची माहिती वेळेवर मिळवण्यासाठी खालील माहिती संमतीसह नोंदवा.',
                        'Register your name and mobile number with consent to stay updated on new schemes, GR & jobs.'
                      )}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black tabular-nums">
                    👥 {followerCount} {t('फॉलोअर्स', 'Followers')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {t('तुमचे पूर्ण नाव / केंद्राचे नाव *', 'Your Full Name / Center Name *')}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder={t('उदा. रमेश पाटील / सेवा केंद्र', 'e.g. Ramesh Patil')}
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      {t('१० अंकी WhatsApp / मोबाईल नंबर *', '10-Digit Mobile / WhatsApp Number *')}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={10}
                      value={subMobile}
                      onChange={(e) => setSubMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder={t('उदा. 98XXXXXXXX', 'e.g. 98XXXXXXXX')}
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-800">
                    {t('कोणती माहिती हवी आहे? (पर्याय निवडा):', 'Select Alert Topics:')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {INTEREST_OPTIONS.map((opt) => {
                      const label = lang === 'en' ? opt.en : opt.mr;
                      const checked = subInterests.includes(label) || subInterests.includes(opt.mr);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleInterest(label)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          {checked ? '✓ ' : '+ '}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Explicit User Consent Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-800 leading-relaxed">
                    {t(
                      'मी स्व-इच्छेने संमती देतो/देते की माझे नाव व मोबाईल नंबर महा कॉर्नरच्या नवीन योजना, पोस्टर्स आणि सरकारी अपडेट्स मिळवण्यासाठी सुरक्षितपणे जतन केले जावेत. ही माहिती Admin व्यतिरिक्त इतर कोणालाही दिसणार नाही.',
                      'I voluntarily consent to saving my name and mobile number securely in Firebase Firestore to receive MAHA CORNER updates. My personal info stays private and visible only to Admin.'
                    )}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={subLoading}
                  className="w-full min-h-[48px] py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer transition-all"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>
                    {subLoading
                      ? t('नोंदणी सेव्ह होत आहे...', 'Saving registration...')
                      : isFollowed
                        ? t('नवीन फॉलो नोंदणी करा (सबस्क्राईब ✓)', 'Register Follower & Save')
                        : t('संमती देऊन फॉलो करा (Follow & Save)', 'Give Consent & Follow Now')}
                  </span>
                </button>
              </form>

              {/* Browser Alerts + WhatsApp Channel + Share Portal */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 font-semibold">
                  🔔 {t('ब्राउझरवर तात्काळ बेल सूचना हवी आहे का?', 'Want instant browser bell alerts?')}
                </span>
                <button
                  type="button"
                  onClick={handleEnableBrowserAlerts}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer"
                >
                  {browserBellStatus || t('ब्राउझर अलर्ट सुरू करा', 'Enable Browser Alerts')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href="https://whatsapp.com/channel/0029Va4yf9vEFeXuKxF31F43"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 flex items-center justify-between gap-2 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        {t('WhatsApp चॅनेल जॉइन करा', 'Join WhatsApp Channel')}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        {t('रोजच्या ताज्या बातम्या व पोस्ट्स', 'Daily updates on WhatsApp')}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                </a>

                <a
                  href={getPortalInviteShareUrl(lang)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-400 flex items-center justify-between gap-2 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        {t('पोर्टल लिंक शेअर करा', 'Share Website Link')}
                      </div>
                      <div className="text-[11px] text-sky-700 font-semibold truncate max-w-[150px]">
                        {MAHA_CORNER_URL}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-600 shrink-0" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE UPDATES FEED */}
          {activeTab === 'updates' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600">
                  {t(
                    'पोस्टर मेकर, शासकीय योजना व नवीन माहिती टाकल्यावर येथे तात्काळ दिसते:',
                    'Newly published posters, schemes & announcements appear here instantly:'
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllSeen}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('सर्व पाहिले मार्क करा', 'Mark all read')}</span>
                  </button>
                )}
              </div>

              {updates.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="text-sm font-black text-slate-900">
                    {t('महा कॉर्नर अपडेट्स हब तयार आहे!', 'MAHA CORNER Updates Hub is Ready!')}
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    {t(
                      'जेव्हा ओनर नवीन पोस्टर अपलोड करतील किंवा नवीन सूचना टाकतील तेव्हा ती तुम्हाला येथे लगेच दिसेल. नियमित अपडेट्ससाठी आताच फॉलो करा!',
                      'Whenever new posters or announcements are posted by the owner, they will appear right here.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('subscribe')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                  >
                    <BellRing className="w-4 h-4" />
                    <span>{t('आत्ताच फॉलो व नोंदणी करा', 'Follow & Register Now')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map((item) => {
                    const isUnread = Date.parse(item.createdAt) > lastSeenTs;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all space-y-2 ${
                          isUnread ? 'bg-amber-50/70 border-amber-300 shadow-xs' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase">
                                {t('नवीन', 'NEW')}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-600">
                              {getTabLabel(item.targetTab)}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                            {new Date(item.createdAt).toLocaleString(lang === 'en' ? 'en-IN' : 'mr-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                        <p className="text-xs text-slate-700 leading-relaxed">{item.message}</p>

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onMarkAllSeen();
                              onNavigateTab(item.targetTab);
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{t('लगेच पहा', 'Open Section')}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={buildWhatsAppShareUrl(`📢 *${item.title}*\n${item.message}`, lang)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{t('WhatsApp वर शेअर', 'Share')}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FIREBASE ADMIN FOLLOWER MANAGEMENT DASHBOARD */}
          {activeTab === 'followers-admin' && (
            <FollowersAdminDashboard
              onFollowerCountSync={(cnt) => onFollowedChange(isFollowed, cnt)}
            />
          )}

          {/* TAB 4: OWNER ANNOUNCEMENTS PUBLISHER */}
          {activeTab === 'owner' && (
            <div className="space-y-4">
              {!isOwnerUnlocked ? (
                <form
                  onSubmit={handleOwnerUnlock}
                  className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 max-w-md mx-auto"
                >
                  <div className="flex items-center gap-2 text-amber-400">
                    <Lock className="w-5 h-5" />
                    <h4 className="text-sm font-black">
                      {t('ओनर लॉक (नवीन अपडेट पब्लिश करा)', 'Owner Lock (Post Announcements)')}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      'येथून तुम्ही सर्व नियमित फॉलोअर्ससाठी नवीन माहिती/सूचना पब्लिश करू शकता. (फॉलोअर्स यादी पाहण्यासाठी "Admin Dashboard" टॅब उघडा.)',
                      'Publish live announcements for visitors. Use the "Admin Dashboard" tab for Firebase Followers.'
                    )}
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder={t('ओनर PIN टाका...', 'Enter Owner PIN...')}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {ownerAuthErr && <p className="text-xs font-bold text-rose-400">{ownerAuthErr}</p>}
                  <button
                    type="submit"
                    disabled={ownerLoading}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    {ownerLoading ? t('तपासत आहे...', 'Verifying...') : t('अनलॉक करा', 'Unlock Now')}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={handlePublishUpdate}
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-amber-950">
                      <Megaphone className="w-4 h-4 text-amber-600" />
                      <h4 className="text-sm font-black">
                        {t('सर्व ग्राहकांसाठी नवीन माहिती पब्लिश करा', 'Publish New Update to All Followers')}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder={t('शीर्षक (उदा. लाडकी बहीण नवीन पोस्टर!)', 'Headline')}
                        className="h-10 px-3 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-900"
                      />
                      <select
                        value={newTargetTab}
                        onChange={(e) => setNewTargetTab(e.target.value as AppTab)}
                        className="h-10 px-3 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-900"
                      >
                        {TARGET_TAB_LABELS.map((tab) => (
                          <option key={tab.id} value={tab.id}>
                            {lang === 'en' ? tab.en : tab.mr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      rows={2}
                      required
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('ग्राहकांना द्यायची थोडक्यात माहिती लिहा...', 'Short announcement details...')}
                      className="w-full p-3 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-slate-900"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="submit"
                        disabled={postingUpdate}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-amber-400" />
                        <span>{postingUpdate ? t('पाठवत आहे...', 'Publishing...') : t('अपडेट पब्लिश करा', 'Publish Live Update')}</span>
                      </button>

                      {lastPostedShareUrl && (
                        <a
                          href={lastPostedShareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}</span>
                        </a>
                      )}
                    </div>
                  </form>

                  {updates.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>{t('टाकलेले अपडेट्स व्यवस्थापित करा:', 'Manage Published Updates:')}</span>
                      </h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {updates.map((u) => (
                          <div
                            key={u.id}
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-bold text-slate-800 truncate">{u.title}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteUpdate(u.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                              title={t('हटवा', 'Delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

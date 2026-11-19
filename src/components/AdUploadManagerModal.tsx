import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Lock,
  Unlock,
  Upload,
  X,
  CheckCircle2,
  Trash2,
  Eye,
  ShieldCheck,
  Image as ImageIcon,
  Megaphone,
  RotateCcw,
} from 'lucide-react';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase';
import {
  SiteAdRecord,
  DEFAULT_AD_TITLE,
  DEFAULT_AD_DESCRIPTION,
  DEFAULT_AD_LINK,
  DEFAULT_AD_PHONE,
  prepareCompressedAdImage,
  saveSiteAdInFirestore,
  setActiveSiteAdInFirestore,
  deleteSiteAdInFirestore,
} from '../utils/firebaseSiteAds';

interface AdUploadManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ads: SiteAdRecord[];
  activeAd: SiteAdRecord | null;
  onAdsUpdated: (ads: SiteAdRecord[], activeAd: SiteAdRecord | null) => void;
  onPreviewPopup: () => void;
}

export const AdUploadManagerModal: React.FC<AdUploadManagerModalProps> = ({
  isOpen,
  onClose,
  ads,
  activeAd,
  onAdsUpdated,
  onPreviewPopup,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lock & Auth state
  const [pinInput, setPinInput] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  // Upload Form State
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [adTitle, setAdTitle] = useState(DEFAULT_AD_TITLE);
  const [adDescription, setAdDescription] = useState(DEFAULT_AD_DESCRIPTION);
  const [adMarqueeText, setAdMarqueeText] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState(DEFAULT_AD_LINK);
  const [adContactPhone, setAdContactPhone] = useState(DEFAULT_AD_PHONE);
  const [uploading, setUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyAdId, setBusyAdId] = useState<string | null>(null);

  const isGoogleAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isUnlocked = Boolean(verifiedPin) || isGoogleAdmin;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!pinInput.trim()) return;
    setVerifyingPin(true);
    try {
      const res = await fetch('/api/ads/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setVerifiedPin(pinInput.trim());
        setPinInput('');
      } else {
        setAuthError(data?.error || 'चुकीचा ओनर पिन (Invalid PIN). कृपया योग्य पिन टाका.');
      }
    } catch {
      setAuthError('सर्व्हरशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleGoogleAdminUnlock = async () => {
    setSigningInGoogle(true);
    setAuthError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth);
        setAuthError(`फक्त मुख्य ओनर ईमेल (${ADMIN_EMAIL}) लाच जाहिरात अपलोड करण्याची परवानगी आहे.`);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Google लॉगिन अयशस्वी झाले.');
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleLockPanel = async () => {
    setVerifiedPin('');
    setPinInput('');
    setUploadStatusMsg('');
    setUploadErrorMsg('');
    if (isGoogleAdmin) {
      try {
        await signOut(auth);
      } catch {}
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setUploadErrorMsg('कृपया फक्त JPG, PNG किंवा WEBP जाहिरात फोटो निवडा.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setUploadErrorMsg('इमेज साईझ १२ MB पेक्षा कमी असावी.');
      return;
    }
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawUrl = String(reader.result || '');
        const compressed = await prepareCompressedAdImage(rawUrl);
        setSelectedImageDataUrl(compressed);
      } catch {
        setUploadErrorMsg('इमेज प्रोसेस करताना अडचण आली. कृपया दुसरा फोटो निवडा.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadNewAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadErrorMsg('');
    setUploadStatusMsg('');

    if (!selectedImageDataUrl) {
      setUploadErrorMsg('कृपया आधी जाहिरातीचा फोटो / बॅनर इमेज निवडा.');
      return;
    }

    setUploading(true);
    const adId = `ad-${Date.now()}`;
    const createdAtMs = Date.now();
    const payload: SiteAdRecord = {
      id: adId,
      title: adTitle.trim() || DEFAULT_AD_TITLE,
      description: adDescription.trim() || DEFAULT_AD_DESCRIPTION,
      marqueeText: adMarqueeText.trim(),
      imageUrl: selectedImageDataUrl,
      linkUrl: /^https?:\/\//i.test(adLinkUrl.trim()) ? adLinkUrl.trim() : DEFAULT_AD_LINK,
      contactPhone: adContactPhone.trim() || DEFAULT_AD_PHONE,
      active: true,
      createdAtMs,
    };

    let serverSaved = false;
    let nextAdsList: SiteAdRecord[] = [payload, ...ads.map((a) => ({ ...a, active: false }))];

    if (verifiedPin) {
      try {
        const res = await fetch('/api/ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          serverSaved = true;
          if (Array.isArray(data.ads)) {
            nextAdsList = data.ads;
          }
        } else if (data?.error) {
          setUploadErrorMsg(String(data.error));
        }
      } catch {
        // Fallback to Firestore if signed in
      }
    }

    let cloudSaved = false;
    if (isGoogleAdmin) {
      cloudSaved = await saveSiteAdInFirestore(payload, ads);
    }

    if (serverSaved || cloudSaved) {
      onAdsUpdated(nextAdsList, payload);
      setUploadStatusMsg('नवीन जाहिरात यशस्वीरीत्या अपलोड व लाईव्ह झाली आहे! ✓');
      setSelectedImageDataUrl('');
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (!uploadErrorMsg) {
      setUploadErrorMsg(
        'जाहिरात सेव्ह करण्यासाठी ओनर पिन किंवा Google Admin लॉगिन आवश्यक आहे.'
      );
    }

    setUploading(false);
  };

  const handleActivateAd = async (targetId: string | 'default') => {
    setBusyAdId(targetId);
    setUploadStatusMsg('');
    setUploadErrorMsg('');
    try {
      let nextAds = ads.map((a) => ({
        ...a,
        active: targetId !== 'default' && a.id === targetId,
      }));
      if (verifiedPin) {
        const res = await fetch(`/api/ads/${encodeURIComponent(targetId)}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success && Array.isArray(data.ads)) {
          nextAds = data.ads;
        }
      }
      if (isGoogleAdmin) {
        await setActiveSiteAdInFirestore(targetId, ads);
      }
      const nextActive = nextAds.find((a) => a.active) || null;
      onAdsUpdated(nextAds, nextActive);
      setUploadStatusMsg(
        targetId === 'default'
          ? 'मूळ डिफॉल्ट Maha Corner जाहिरात पुन्हा सुरू केली आहे ✓'
          : 'निवडलेली जाहिरात आता वेबसाइटवर लाईव्ह झाली आहे ✓'
      );
    } finally {
      setBusyAdId(null);
    }
  };

  const handleDeleteAd = async (targetId: string) => {
    setBusyAdId(targetId);
    setUploadStatusMsg('');
    setUploadErrorMsg('');
    try {
      let nextAds = ads.filter((a) => a.id !== targetId);
      if (verifiedPin) {
        const res = await fetch(`/api/ads/${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: verifiedPin }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success && Array.isArray(data.ads)) {
          nextAds = data.ads;
        }
      }
      if (isGoogleAdmin) {
        await deleteSiteAdInFirestore(targetId);
      }
      const nextActive = nextAds.find((a) => a.active) || null;
      onAdsUpdated(nextAds, nextActive);
      setConfirmDeleteId(null);
      setUploadStatusMsg('जाहिरात यशस्वीरीत्या हटवली आहे ✓');
    } finally {
      setBusyAdId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs font-['Noto_Sans_Devanagari',sans-serif]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-upload-manager-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950 text-white px-5 py-4 flex items-center justify-between gap-3 border-b border-amber-500/40 rounded-t-3xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
              {isUnlocked ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <h2 id="ad-upload-manager-title" className="text-sm sm:text-base font-black text-amber-300 truncate">
                📢 नवीन जाहिरात अपलोड (Owner Lock)
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                {isUnlocked
                  ? '🔓 अनलॉक झाले आहे — नवीन जाहिरात अपलोड किंवा बदला'
                  : '🔒 सुरक्षित लॉक — फक्त ओनर जाहिरात अपलोड करू शकतात'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isUnlocked && (
              <button
                type="button"
                onClick={() => void handleLockPanel()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer"
                title="पॅनेल पुन्हा लॉक करा"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>लॉक करा</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="बंद करा"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {!isUnlocked ? (
            /* LOCK SCREEN */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <p className="font-black text-sm">🔒 जाहिरात अपलोड लॉक सुरक्षित आहे</p>
                  <p className="mt-0.5">
                    कोणताही अनोळखी व्यक्ती जाहिरात बदलू नये म्हणून हे पॅनेल लॉक केले आहे. अनलॉक करण्यासाठी तुमचा <strong>ओनर पिन (Owner PIN)</strong> किंवा <strong>ॲडमिन Google लॉगिन</strong> वापरा.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PIN Unlock */}
                <form
                  onSubmit={handlePinUnlock}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>पर्याय १: ओनर पिनने अनलॉक करा</span>
                  </div>
                  <input
                    type="password"
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="ओनर पिन टाका"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={verifyingPin}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs cursor-pointer shadow-sm"
                  >
                    {verifyingPin ? 'तपासत आहे...' : '🔓 अनलॉक करा'}
                  </button>
                </form>

                {/* Google Admin Unlock */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-black text-emerald-950 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>पर्याय २: ॲडमिन Google लॉगिन</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      <strong>{ADMIN_EMAIL}</strong> ने लॉगिन केल्यास जाहिरात क्लाउड (Firestore) मध्ये कायमस्वरूपी सेव्ह होते.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGoogleAdminUnlock()}
                    disabled={signingInGoogle}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{signingInGoogle ? 'लॉगिन होत आहे...' : 'Google ने अनलॉक करा'}</span>
                  </button>
                </div>
              </div>

              {authError && (
                <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl">
                  {authError}
                </p>
              )}
            </div>
          ) : (
            /* UNLOCKED UPLOAD & MANAGE VIEW */
            <div className="space-y-5">
              {/* Quick Sync Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGoogleAdmin ? 'Cloud Admin Unlocked' : 'Owner PIN Unlocked'}</span>
                  </span>
                  {!isGoogleAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleGoogleAdminUnlock()}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
                    >
                      ☁️ क्लाउड सेव्हसाठी Google जोडा
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPreviewPopup();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 text-[11px] font-black cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>पॉपअप प्रिव्ह्यू पहा</span>
                </button>
              </div>

              {/* Upload New Ad Form */}
              <form
                onSubmit={handleUploadNewAd}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5"
              >
                <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>नवीन जाहिरात बॅनर अपलोड करा</span>
                </div>

                {/* Image Picker & Live Preview */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    १. जाहिरातीचा फोटो / बॅनर इमेज निवडा (JPG / PNG / WEBP) *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-amber-400/70 hover:border-amber-500 bg-white rounded-2xl p-4 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {selectedImageDataUrl ? (
                      <div className="space-y-2">
                        <img
                          src={selectedImageDataUrl}
                          alt="Selected Ad Preview"
                          referrerPolicy="no-referrer"
                          className="max-h-48 mx-auto rounded-xl border border-slate-200 shadow-xs object-contain"
                        />
                        <p className="text-[11px] font-bold text-emerald-700">
                          ✓ {selectedFileName || 'इमेज तयार आहे'} (बदलण्यासाठी येथे क्लिक करा)
                        </p>
                      </div>
                    ) : (
                      <div className="py-4 space-y-1.5">
                        <ImageIcon className="w-8 h-8 text-amber-500 mx-auto" />
                        <p className="text-xs font-black text-slate-800">
                          जाहिरातीचा फोटो निवडण्यासाठी येथे क्लिक करा
                        </p>
                        <p className="text-[11px] text-slate-500">
                          JPG, PNG किंवा WEBP (ऑटो कॉम्प्रेशनसह जलद लोडिंग)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      २. पॉपअप शीर्षक (Ad Title):
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="📢 MAHA CORNER जाहिरात"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      ३. संपर्क मोबाईल नंबर:
                    </label>
                    <input
                      type="tel"
                      maxLength={20}
                      value={adContactPhone}
                      onChange={(e) => setAdContactPhone(e.target.value)}
                      placeholder="9373861832"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    ४. पॉपअप जाहिरात संदेश (Description):
                  </label>
                  <textarea
                    rows={2}
                    required
                    maxLength={500}
                    value={adDescription}
                    onChange={(e) => setAdDescription(e.target.value)}
                    placeholder="आपल्या व्यवसायाची जाहिरात आता महा कॉर्नरवर करा!"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      ५. क्लिक लिंक (Website / WhatsApp URL):
                    </label>
                    <input
                      type="url"
                      maxLength={300}
                      value={adLinkUrl}
                      onChange={(e) => setAdLinkUrl(e.target.value)}
                      placeholder="https://mahacorner.in"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      ६. वरची स्क्रोलिंग पट्टी मजकूर (ऐच्छिक):
                    </label>
                    <input
                      type="text"
                      maxLength={600}
                      value={adMarqueeText}
                      onChange={(e) => setAdMarqueeText(e.target.value)}
                      placeholder="रिकामे ठेवल्यास सध्याची पट्टी राहील"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {uploadErrorMsg && (
                  <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                    {uploadErrorMsg}
                  </p>
                )}
                {uploadStatusMsg && (
                  <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                    {uploadStatusMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'अपलोड होत आहे...' : '📤 जाहिरात अपलोड करा व तात्काळ लाईव्ह करा'}</span>
                </button>
              </form>

              {/* Existing Uploaded Ads List */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                    <span>अपलोड केलेल्या जाहिराती ({ads.length})</span>
                  </div>
                  {activeAd && (
                    <button
                      type="button"
                      disabled={busyAdId === 'default'}
                      onClick={() => void handleActivateAd('default')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>डिफॉल्ट जाहिरात परत आणा</span>
                    </button>
                  )}
                </div>

                {ads.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                    सध्या महा कॉर्नरची डिफॉल्ट जाहिरात सुरू आहे. वरून नवीन फोटो अपलोड करा.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {ads.map((ad) => (
                      <div
                        key={ad.id}
                        className={`p-3 rounded-2xl border flex items-center gap-3 ${
                          ad.active
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <img
                          src={ad.imageUrl}
                          alt={ad.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 text-xs truncate">
                              {ad.title}
                            </span>
                            {ad.active && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 truncate">{ad.description}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            📞 {ad.contactPhone}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!ad.active && (
                            <button
                              type="button"
                              disabled={busyAdId === ad.id}
                              onClick={() => void handleActivateAd(ad.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-[11px] font-black cursor-pointer"
                            >
                              चालू करा
                            </button>
                          )}

                          {confirmDeleteId === ad.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={busyAdId === ad.id}
                                onClick={() => void handleDeleteAd(ad.id)}
                                className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                              >
                                हटवा
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                              >
                                रद्द
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ad.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                              title="जाहिरात हटवा"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

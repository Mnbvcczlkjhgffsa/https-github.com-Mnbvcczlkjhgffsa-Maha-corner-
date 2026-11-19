import React, { useState, useRef, useEffect } from 'react';
import {
  UserCheck,
  Lock,
  Sparkles,
  Award,
  ShieldCheck,
  Send,
  Youtube,
  Instagram,
  MessageCircle,
  ExternalLink,
  Target,
  Compass,
  FileCheck2,
  Users2,
  Sprout,
  Briefcase,
  BookOpen,
  Palette,
  Newspaper,
  Upload,
  RefreshCw,
  Code2,
  Zap,
  Check,
  Quote,
  Unlock,
  BarChart3,
  Eye,
  EyeOff,
  Users,
  MousePointerClick,
  KeyRound,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchOwnerAnalytics, LockedAnalyticsStats } from '../utils/analytics';
import { MAHA_CORNER_URL } from '../utils/shareConfig';
import { inspectUploadedFileBytes, PDF_SECURITY_LIMITS } from '../utils/pdfSecurity';
import { FollowersAdminDashboard } from './FollowersAdminDashboard';
import { OurTeam } from './OurTeam';

const DEFAULT_FOUNDER_PHOTO = '/assets/aistudio/Gemini_Generated_Image_nqyhzinqyhzinqyh_48a1cff1.png';

export const AboutFounder: React.FC = () => {
  const { lang, t } = useLanguage();

  const [founderPhoto, setFounderPhoto] = useState<string>(DEFAULT_FOUNDER_PHOTO);

  const [activeStoryTab, setActiveStoryTab] = useState<'journey' | 'concept' | 'vision' | 'tech'>('journey');
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorPlace, setVisitorPlace] = useState<string>('');
  const [visitorMsg, setVisitorMsg] = useState<string>('');
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState<boolean>(false);
  const [photoSaving, setPhotoSaving] = useState<boolean>(false);

  const [isStatsBoxOpen, setIsStatsBoxOpen] = useState<boolean>(false);
  const [showPhotoUnlockModal, setShowPhotoUnlockModal] = useState<boolean>(false);
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [analyticsPin, setAnalyticsPin] = useState<string>('');
  const [unlockedPin, setUnlockedPin] = useState<string>('');
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string>('');
  const [analyticsStats, setAnalyticsStats] = useState<LockedAnalyticsStats | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const normalizePinInput = (val: string) =>
    val.trim().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));

  useEffect(() => {
    try {
      localStorage.removeItem('maha_founder_custom_photo');
    } catch {}
    fetch('/api/founder-photo')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && typeof data.photoUrl === 'string' && data.photoUrl.startsWith('data:image/')) {
          setFounderPhoto(data.photoUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleUnlockAnalytics = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanedPin = normalizePinInput(analyticsPin);
    if (!cleanedPin) {
      setAnalyticsError(t('कृपया पासवर्ड टाका.', 'Please enter PIN.'));
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await fetchOwnerAnalytics(cleanedPin);
      if (!res.success || !res.stats) {
        const isLocked = typeof res.error === 'string' && res.error.toLowerCase().includes('too many failed');
        setAnalyticsError(
          isLocked
            ? res.error!
            : t('चुकीचा पासवर्ड! कृपया पुन्हा प्रयत्न करा.', 'Incorrect PIN! Please try again.')
        );
        return;
      }
      setAnalyticsStats(res.stats);
      setUnlockedPin(cleanedPin);
      setAnalyticsPin('');
      setShowPhotoUnlockModal(false);
    } catch {
      setAnalyticsError(t('आकडेवारी लोड करताना त्रुटी आली.', 'Unable to load numbers right now.'));
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleRefreshAnalytics = async () => {
    if (!unlockedPin) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await fetchOwnerAnalytics(unlockedPin);
      if (res.success && res.stats) {
        setAnalyticsStats(res.stats);
      }
    } catch {
      setAnalyticsError(t('रीफ्रेश करता आले नाही.', 'Refresh failed.'));
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleLockAnalytics = () => {
    setAnalyticsStats(null);
    setUnlockedPin('');
    setAnalyticsPin('');
    setAnalyticsError('');
    setIsStatsBoxOpen(false);
  };

  const FEATURE_LABELS: Record<string, { mr: string; en: string }> = {
    'ai-poster': { mr: 'पोस्टर मेकर', en: 'Poster Maker' },
    cutter: { mr: 'कार्ड कटर', en: 'Card Cutter' },
    'farmer-card': { mr: 'शेतकरी ओळखपत्र', en: 'Farmer ID Card' },
    'age-calc': { mr: 'वय कॅल्क्युलेटर', en: 'Age Calculator' },
    'photo-resizer': { mr: 'फोटो रिसायझर', en: 'Photo Resizer' },
    'pdf-tools': { mr: '२०+ PDF साधने', en: '20+ PDF Tools' },
    gr: { mr: 'शासकीय निर्णय (GR)', en: 'Govt Resolutions (GR)' },
    jobs: { mr: 'नोकरी संदर्भ', en: 'Govt Jobs & Bharti' },
    portals: { mr: 'शासकीय पोर्टल्स', en: 'Govt Portals' },
    about: { mr: 'माझी माहिती', en: 'About Founder' },
  };

  const resizeImageForUpload = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
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
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlockedPin) return;

    setPhotoSaving(true);
    setAnalyticsError('');
    try {
      if (file.size > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
        setAnalyticsError(t('फोटो २० MB पेक्षा लहान असावा.', 'Photo must be under 20 MB.'));
        return;
      }
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'image');
      if (!inspection.valid || inspection.kind !== 'image') {
        setAnalyticsError(t('कृपया वैध JPG/PNG/WEBP फोटो निवडा.', 'Only valid JPG/PNG/WEBP raster images are allowed.'));
        return;
      }
      const optimizedDataUrl = await resizeImageForUpload(file);
      const res = await fetch('/api/founder-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: unlockedPin, photoDataUrl: optimizedDataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setAnalyticsError(t('फोटो अपडेट करता आला नाही. कृपया पुन्हा प्रयत्न करा.', 'Could not update photo. Please try again.'));
        return;
      }
      setFounderPhoto(data.photoUrl || optimizedDataUrl);
      setPhotoUploadSuccess(true);
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.5 } });
      setTimeout(() => setPhotoUploadSuccess(false), 4000);
    } catch {
      setAnalyticsError(t('फोटो अपलोड करताना त्रुटी आली.', 'Error uploading photo.'));
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleResetPhoto = async () => {
    if (!unlockedPin) return;
    setPhotoSaving(true);
    setAnalyticsError('');
    try {
      const res = await fetch('/api/founder-photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: unlockedPin }),
      });
      if (res.ok) {
        setFounderPhoto(DEFAULT_FOUNDER_PHOTO);
      }
    } catch {
      setAnalyticsError(t('मूळ फोटो रिसेट करता आला नाही.', 'Could not reset original photo.'));
    } finally {
      setPhotoSaving(false);
    }
  };

  const getDirectWhatsAppUrl = () => {
    const greeting =
      lang === 'en'
        ? `Hello Kamlesh Sir,\nI am ${visitorName || 'Citizen'} (${visitorPlace || 'Maharashtra'}),\nreaching out from the MAHA CORNER website.\n\nMessage: ${
            visitorMsg || 'I would like more information about Maha Corner.'
          }\n\n🌐 Portal: ${MAHA_CORNER_URL}`
        : `नमस्कार कमलेश सर,\nमी ${visitorName || 'नागरिक'} (${visitorPlace || 'महाराष्ट्र'}),\nMAHA CORNER वेबसाईटवरून संपर्क करत आहे.\n\nसंदेश: ${
            visitorMsg || 'मला महा कॉर्नर बद्दल अधिक माहिती हवी आहे.'
          }\n\n🌐 पोर्टल: ${MAHA_CORNER_URL}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(greeting)}`;
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Luxury Designer Hero Showcase Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-6 sm:p-10 lg:p-12 border border-amber-500/40 shadow-2xl">
        <div className="absolute top-0 right-1/4 w-[32rem] h-[32rem] bg-amber-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-[28rem] h-[28rem] bg-sky-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Portrait of Founder (Strictly Locked — Only Owner PIN Unlocks Edit) */}
          <div className="relative group shrink-0 select-none">
            <div className="relative w-52 h-72 sm:w-64 sm:h-84 rounded-3xl p-1.5 bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-200 shadow-2xl shadow-orange-500/30">
              <div className="w-full h-full rounded-[1.3rem] overflow-hidden bg-slate-900 flex items-center justify-center relative shadow-inner">
                <img
                  src={founderPhoto}
                  alt={t('कमलेश नारायण पाटील - संस्थापक व संचालक, महा कॉर्नर', 'Kamlesh Narayan Patil - Founder & Director, Maha Corner')}
                  draggable={false}
                  className={`w-full h-full object-cover filter contrast-[1.04] brightness-[1.02] pointer-events-none ${
                    founderPhoto === DEFAULT_FOUNDER_PHOTO
                      ? 'object-[58%_30%] scale-[1.05]'
                      : 'object-top'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => {
                    if (unlockedPin) {
                      photoInputRef.current?.click();
                    } else {
                      setAnalyticsError('');
                      setShowPhotoUnlockModal(true);
                    }
                  }}
                  className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full border flex items-center justify-center shadow-md transition-all cursor-pointer ${
                    unlockedPin
                      ? 'bg-emerald-600/90 hover:bg-emerald-500 border-emerald-300 text-white'
                      : 'bg-slate-950/80 hover:bg-amber-500 border-amber-400/60 text-amber-300 hover:text-slate-950'
                  }`}
                  title={
                    unlockedPin
                      ? t('फोटो बदला (Owner Unlocked)', 'Change Photo (Owner Unlocked)')
                      : t('फक्त मालकासाठी लॉक केलेले • अनलॉक करा', 'Owner Lock • Click to Unlock')
                  }
                >
                  {unlockedPin ? <Upload className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>

                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-2.5 pt-6 text-center pointer-events-none">
                  <p className="text-[11px] font-bold text-amber-300 tracking-wide">
                    {t('अधिकृत छायाचित्र', 'Official Portrait')}
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-amber-400 border border-amber-500/60 shadow-lg px-4 py-1 rounded-full text-[11px] font-black tracking-wide flex items-center gap-1.5 whitespace-nowrap">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>VERIFIED FOUNDER</span>
            </div>
          </div>

          {/* Founder Bio */}
          <div className="space-y-4 flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('MAHA CORNER • अधिकृत नेतृत्व', 'MAHA CORNER • Official Leadership')}</span>
              </span>

              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('१००% अधिकृत व सुरक्षित', '100% Verified & Secure')}</span>
              </span>
            </div>

            <div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
                {t('कमलेश नारायण पाटील', 'Kamlesh Narayan Patil')}
              </h1>
              <p className="text-sm sm:text-base font-bold text-amber-400 mt-1 flex items-center justify-center lg:justify-start gap-2">
                <Lock className="w-5 h-5 text-sky-400 shrink-0" />
                <span>{t('सायबर सुरक्षा कोर्स', 'Cyber Security Course')}</span>
              </p>
              <p className="text-sm sm:text-base font-bold text-sky-300 mt-1 flex items-center justify-center lg:justify-start gap-2">
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t('शैक्षणिक माहिती: MSC COMPUTER PUNE UNIVERSITY', 'Education: MSC COMPUTER PUNE UNIVERSITY')}</span>
              </p>
            </div>

            {/* Founder Tagline & Mission Quote */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative">
              <Quote className="w-6 h-6 text-amber-400/40 absolute top-2 right-3 pointer-events-none" />
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {t(
                  '"डिजिटल तंत्रज्ञानाच्या माध्यमातून शासकीय योजना, शासन निर्णय (GR), शैक्षणिक माहिती, रोजगार संधी आणि शेतकरी योजनांची अचूक माहिती महाराष्ट्रातील शेवटच्या घटकापर्यंत पोहोचवणे हेच आमचे उद्दिष्ट आहे."',
                  '"Our goal is to deliver accurate information on Government Schemes, Government Resolutions (GR), Education, Job Alerts, and Farmer Welfare schemes to every citizen across Maharashtra through modern digital technology."'
                )}
              </p>
              <div className="mt-2 text-xs font-black text-amber-300 tracking-wide">
                {t('माहिती अशी, जी कामी येईल!', 'Information That Truly Matters!')}
              </div>
            </div>

            {/* Quick Action Buttons Row */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <a
                href="https://whatsapp.com/channel/0029Va4yf9vEFeXuKxF31F43"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('WhatsApp चॅनेल जॉइन करा', 'Join WhatsApp Channel')}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>

              <a
                href="https://youtube.com/@mahacorner2.0"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
              >
                <Youtube className="w-4 h-4" />
                <span>YouTube (@mahacorner2.0)</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 MAHA CORNER – Our Team Component (Directly Below Founder Photo & Profile Banner) */}
      <OurTeam
        unlockedPin={unlockedPin}
        onRequireUnlock={() => {
          setAnalyticsError('');
          setShowPhotoUnlockModal(true);
        }}
      />

      {/* 4 Professional Impact & Credential Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: t('विशेष कौशल्य', 'Specialization'),
            val: t('सायबर सुरक्षा कोर्स', 'Cyber Security'),
            sub: t('डिजिटल सुरक्षा व तांत्रिक मार्गदर्शन', 'Digital Safety & Technical Guidance'),
            icon: Lock,
            color: 'from-sky-500/10 to-blue-500/10 border-sky-400/40 text-sky-600'
          },
          {
            label: t('डिजिटल व्यासपीठ', 'Digital Platform'),
            val: 'MAHA CORNER',
            sub: t('सर्व जिल्हे व ग्रामीण पोहोच', 'Statewide & Rural Citizen Reach'),
            icon: Award,
            color: 'from-amber-500/10 to-orange-500/10 border-amber-400/40 text-amber-600'
          },
          {
            label: t('सेवा व साधने', 'Tools & Services'),
            val: t('२०+ साधने', '20+ Tools'),
            sub: t('पोस्टर, PDF, कार्ड, रिसायझर', 'Posters, PDF, Cards, Resizer'),
            icon: Zap,
            color: 'from-purple-500/10 to-pink-500/10 border-purple-400/40 text-purple-600'
          },
          {
            label: t('डेटा गोपनीयता', 'Data Privacy'),
            val: t('१००% मोफत व सुरक्षित', '100% Free & Safe'),
            sub: t('क्लायंट-साइड डिव्हाइस प्रोसेस', 'Client-Side On-Device Processing'),
            icon: ShieldCheck,
            color: 'from-emerald-500/10 to-teal-500/10 border-emerald-400/40 text-emerald-600'
          }
        ].map((stat, i) => {
          const IconComp = stat.icon;
          return (
            <div
              key={i}
              className={`p-5 rounded-2xl bg-gradient-to-b ${stat.color} border bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {stat.label}
                </span>
                <IconComp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-slate-900 block tracking-tight">
                  {stat.val}
                </span>
                <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">
                  {stat.sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Story Tabs */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-amber-500" />
              <span>{t('संस्थापक विचार व व्यासपीठाची दिशा', 'Founder Vision & Platform Direction')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('व्यासपीठाची उद्दिष्टे, प्रेरणा व सामाजिक बांधिलकी:', 'Goals, inspiration, and commitment to public digital service:')}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl">
            {[
              { id: 'journey', label: t('माझ्याबद्दल', 'About Me') },
              { id: 'concept', label: t('संकल्पना', 'Concept') },
              { id: 'vision', label: t('ध्येय व विश्वास', 'Vision & Mission') },
              { id: 'tech', label: t('तंत्रज्ञान', 'Technology') }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStoryTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeStoryTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeStoryTab === 'journey' && (
          <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {t('लोकसेवेसाठी तंत्रज्ञानाची जोड', 'Connecting Technology to Citizen Empowerment')}
                </h3>
                <p>
                  {t(
                    'मी MAHA CORNER या डिजिटल माहिती व सेवा व्यासपीठाचा संस्थापक आणि संचालक आहे. सायबर सुरक्षा कोर्स व डिजिटल तंत्रज्ञानाचे प्रशिक्षण पूर्ण केल्यानंतर, ग्रामीण व शहरी भागातील नागरिकांना शासकीय योजना, शासन निर्णय आणि डिजिटल सेवा सहजतेने समजण्यात येणाऱ्या अडचणी मी जवळून पाहिल्या.',
                    'I am Kamlesh Narayan Patil, Founder & Director of the MAHA CORNER digital information and services platform. After completing Cyber Security training and technical studies, I saw firsthand the challenges citizens face in understanding complex government procedures and GRs.'
                  )}
                </p>
                <p>
                  {t(
                    'बऱ्याचदा किचकट शासन निर्णय (GR) किंवा सरकारी प्रक्रियांमुळे सामान्य नागरिक आणि शेतकरी योजनांच्या लाभापासून वंचित राहतात. हे चित्र बदलण्यासाठी आणि प्रत्येक नागरिकाला डिजिटल सेवांमध्ये सक्षम करण्यासाठी MAHA CORNER ची स्थापना केली.',
                    'Often, citizens and farmers miss scheme benefits simply due to complicated documentation or hard-to-find circulars. MAHA CORNER was founded to bridge that gap with clear Marathi & English tools and updates.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeStoryTab === 'concept' && (
          <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {t('एकाच छताखाली सर्वसमावेशक डिजिटल सेवा', 'All-in-One Digital Services Under One Roof')}
                </h3>
                <p>
                  {t(
                    'MAHA CORNER हे केवळ एक साधे माहिती देणारे पोर्टल नसून नागरिक, CSC केंद्र चालक, आपले सरकार सेवा केंद्र चालक, विद्यार्थी, शेतकरी आणि डिजिटल सेवा क्षेत्रातील व्यक्तींसाठी उपयुक्त ठरणारे व्यासपीठ आहे.',
                    'MAHA CORNER is not just an informational blog—it is a dedicated workspace for citizens, CSC & Aaple Sarkar Kendra operators, students, farmers, and digital service professionals.'
                  )}
                </p>
                <p>
                  {t(
                    'येथे अधिकृत शासन निर्णयांचे (GR) विश्लेषण, नोकरी संदर्भ व आर्मी/पोलीस भरती अपडेट्स, मोफत डिजिटल पोस्टर्स बनवण्याची सुविधा, शेतकरी स्मार्ट कार्ड मेकर, कार्ड कटर आणि सर्व २०+ PDF टूल्स एकाच ठिकाणी उपलब्ध आहेत.',
                    'Here you get live Government Resolutions (GR), Central & State Job Alerts, branded social media Poster Maker, Farmer Smart Card Maker, Card Cutter, and 20+ PDF Tools in one unified portal.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeStoryTab === 'vision' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <Target className="w-4 h-4 text-amber-600" />
                <h4>{t('आमचे ध्येय (Our Vision)', 'Our Vision')}</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {t(
                  'अचूक, सोपी आणि उपयुक्त माहिती डिजिटल माध्यमातून जास्तीत जास्त नागरिकांपर्यंत पोहोचवणे आणि डिजिटल सेवा क्षेत्राला अधिक सक्षम बनवणे.',
                  'To deliver accurate, simple, and useful digital information to citizens across Maharashtra and empower local digital service centers.'
                )}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Compass className="w-4 h-4 text-emerald-600" />
                <h4>{t('आमचा विश्वास (Our Mission)', 'Our Mission')}</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {t(
                  'माहितीचा योग्य वापर, डिजिटल तंत्रज्ञानाचा प्रसार आणि नागरिकांना उपयुक्त ठरणाऱ्या सेवांचा निरंतर विकास करणे.',
                  'Promoting responsible digital literacy, continuous improvement of citizen-friendly tools, and timely verified scheme & recruitment alerts.'
                )}
              </p>
            </div>
          </div>
        )}

        {activeStoryTab === 'tech' && (
          <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Code2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {t('आधुनिक वेब तंत्रज्ञान व १००% डेटा सुरक्षा', 'Modern Web Architecture & 100% Privacy')}
                </h3>
                <p className="text-xs leading-relaxed">
                  {t(
                    'महा कॉर्नर हे संपूर्णपणे Client-Side Engine वर तयार केले आहे. याचा अर्थ नागरिकांचे आधार कार्ड, शेतकरी कागदपत्रे, सही किंवा फोटो कधीही कोणत्याही बाहेरील सर्व्हरवर सेव्ह होत नाहीत. सर्व प्रक्रिया थेट तुमच्याच मोबाईल किंवा लॅपटॉपवर होते.',
                    'Maha Corner tools run on a privacy-first Client-Side Engine. Your Aadhaar cards, PDF documents, signatures, and photos never leave your phone or PC.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Core Focus Areas */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-6">
        <div className="text-center space-y-1 max-w-xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-xs uppercase tracking-wider">
            {t('कार्यक्षेत्र', 'Focus Areas')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            {t('आमचे प्रमुख कार्य (Core Focus Areas)', 'Core Focus Areas')}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {t(
              'नागरिकांच्या दैनंदिन गरजा आणि सेवा केंद्र चालकांच्या कामात मदत करणारे प्रमुख विभाग:',
              'Key service pillars supporting citizens, farmers, students, and CSC operators:'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: FileCheck2,
              title: t('शासकीय योजना व शासन निर्णय (GR)', 'Government Schemes & Live GR'),
              desc: t('महाराष्ट्र शासन व केंद्र सरकारच्या योजना आणि अधिकृत GR चे साध्या मराठीत विश्लेषण.', 'Daily live Maharashtra Government Resolutions with direct official PDF downloads.'),
              color: 'text-amber-600 bg-amber-50 border-amber-200'
            },
            {
              icon: Users2,
              title: t('CSC व आपले सरकार केंद्र सहाय्य', 'CSC & Aaple Sarkar Support'),
              desc: t('सेवा केंद्र चालकांसाठी उपयुक्त माहिती, पोस्टर डिझाइन व दैनंदिन कार्य साधने.', 'Daily utilities, branded poster maker & ready-to-print card cutter tools.'),
              color: 'text-sky-600 bg-sky-50 border-sky-200'
            },
            {
              icon: Sprout,
              title: t('शेतकरी योजना व कृषी अपडेट्स', 'Farmer Welfare & Agriculture'),
              desc: t('नमो शेतकरी, PM किसान, पीक विमा, ७/१२ व ई-फेरफार ताजी माहिती.', 'PM-KISAN, Namo Shetkari, Crop Insurance, 7/12 & Farmer Smart Card utilities.'),
              color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
            },
            {
              icon: Briefcase,
              title: t('सरकारी व खासगी नोकरी भरती', 'State & Central Job Alerts'),
              desc: t('पोलीस भरती, तलाठी, MPSC, इंडियन आर्मी, SSC, रेल्वे व विविध पदांच्या भरती अपडेट्स.', 'MPSC, Talathi, Police Bharti, Indian Army, SSC, RRB & Banking notifications with GR links.'),
              color: 'text-purple-600 bg-purple-50 border-purple-200'
            },
            {
              icon: BookOpen,
              title: t('शिक्षण, शिष्यवृत्ती व परीक्षा', 'Education, Scholarships & Exams'),
              desc: t('महाडीबीटी शिष्यवृत्ती, हॉल तिकीट, निकाल व शैक्षणिक प्रवेश मार्गदर्शन.', 'MahaDBT scholarships, admission circulars, age calculator & exam photo presets.'),
              color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
            },
            {
              icon: Palette,
              title: t('डिजिटल पोस्टर मेकर व साधने', 'Digital Poster Maker & PDF Suite'),
              desc: t('केंद्राचे नाव व मोबाईल नंबर जोडून मोफत सोशल मीडिया पोस्टर्स आणि २०+ PDF साधने.', 'Custom CSC social media posters and 20+ on-device PDF & image compression tools.'),
              color: 'text-rose-600 bg-rose-50 border-rose-200'
            },
            {
              icon: Newspaper,
              title: t('महत्त्वाच्या बातम्या व तंत्रज्ञान', 'Tech & Cyber Security Awareness'),
              desc: t('नागरिकांसाठी उपयुक्त चालू घडामोडी, सायबर सुरक्षा व डिजिटल मार्गदर्शन.', 'Essential digital safety practices, cyber awareness & citizen service updates.'),
              color: 'text-slate-700 bg-slate-100 border-slate-300'
            }
          ].map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-white transition-all space-y-2 group shadow-sm"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}
                >
                  <IconComp className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect With MAHA CORNER */}
      <div className="bg-slate-900 text-white rounded-[2rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-400" />
              <span>{t('MAHA CORNER शी जोडा', 'Connect With MAHA CORNER')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t(
                'अधिकृत अपडेट्स, भरती माहिती व शासन निर्णयांसाठी आमच्या अधिकृत वाहिन्यांशी जोडा:',
                'Follow our official social channels for instant GR, recruitment & scheme alerts:'
              )}
            </p>
          </div>
          <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40 self-start sm:self-center">
            {t('अधिकृत चॅनेल्स', 'Official Channels')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="https://www.instagram.com/maha_corner_/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-800/80 hover:from-purple-900/60 hover:to-pink-900/60 border border-slate-700 hover:border-pink-500/60 transition-all flex flex-col justify-between group cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 text-white flex items-center justify-center shadow-lg">
                <Instagram className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                  Instagram
                </h4>
                <p className="text-xs text-pink-400 font-mono mt-0.5">@maha_corner_</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {t('रोजचे ताजे अपडेट्स, पोस्टर्स व उपयुक्त शासकीय योजनांच्या रील्स पहा.', 'Daily updates, posters & quick government scheme reels.')}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-pink-400 group-hover:text-pink-300">
              <span>{t('फॉलो करा', 'Follow')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>

          <a
            href="https://whatsapp.com/channel/0029Va4yf9vEFeXuKxF31F43"
            target="_blank"
            rel="noopener noreferrer"
            className="p-5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-800/80 hover:from-emerald-900/60 hover:to-teal-900/60 border border-slate-700 hover:border-emerald-500/60 transition-all flex flex-col justify-between group cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  WhatsApp Channel
                </h4>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">Maha Corner Official</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {t('थेट आपल्या मोबाईलवर तात्काळ नोकरी भरती, जीआर आणि योजनांचे अलर्ट्स मिळवा.', 'Instant job alerts, GR PDFs & scheme notifications directly on WhatsApp.')}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
              <span>{t('जॉइन करा', 'Join Channel')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>

          <a
            href="https://youtube.com/@mahacorner2.0"
            target="_blank"
            rel="noopener noreferrer"
            className="p-5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-800/80 hover:from-red-900/60 hover:to-orange-900/60 border border-slate-700 hover:border-red-500/60 transition-all flex flex-col justify-between group cursor-pointer shadow-md"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg">
                <Youtube className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-red-300 transition-colors">
                  YouTube
                </h4>
                <p className="text-xs text-red-400 font-mono mt-0.5">@mahacorner2.0</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {t('सविस्तर व्हिडिओ ट्युटोरियल्स, अर्ज भरण्याची पद्धत व योजनांची माहिती.', 'Step-by-step video tutorials, online form guides & scheme explainers.')}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-red-400 group-hover:text-red-300">
              <span>{t('सबस्क्राईब करा', 'Subscribe')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>
      </div>

      {/* Interactive Direct Message to Founder */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <h3>
            {t(
              'संस्थापक कमलेश पाटील यांना थेट संदेश पाठवा (Direct Message)',
              'Send a Direct Message to Founder Kamlesh Patil'
            )}
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          {t(
            'तुमची काही सूचना, प्रतिक्रिया किंवा शंका असल्यास खालील फॉर्म भरून थेट WhatsApp वर संपर्क करा:',
            'Have feedback, a suggestion, or a query? Fill the quick form below to send a message on WhatsApp:'
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t('तुमचे नाव:', 'Your Name:')}
            </label>
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder={t('उदा. सचिन पाटील', 'e.g. Sachin Patil')}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t('तुमचे गाव / शहर:', 'Village / City:')}
            </label>
            <input
              type="text"
              value={visitorPlace}
              onChange={(e) => setVisitorPlace(e.target.value)}
              placeholder={t('उदा. जळगाव', 'e.g. Jalgaon')}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            {t('संदेश किंवा प्रश्न:', 'Message or Query:')}
          </label>
          <textarea
            rows={2}
            value={visitorMsg}
            onChange={(e) => setVisitorMsg(e.target.value)}
            placeholder={t('येथे तुमचा संदेश किंवा प्रश्न लिहा...', 'Write your message or question here...')}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <a
          href={getDirectWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md"
        >
          <Send className="w-4 h-4" />
          <span>{t('WhatsApp वर थेट मेसेज पाठवा', 'Send Direct Message on WhatsApp')}</span>
        </a>
      </div>

      {/* Master Designer Official Sign-off Card */}
      <div className="p-6 rounded-3xl bg-slate-900 text-slate-300 text-center space-y-1.5 border border-slate-800 shadow-sm">
        <p className="text-xs text-slate-300">
          {t(
            'महाराष्ट्र शासन सेवा, नागरिक व ई-सेवा केंद्र चालकांच्या सक्षमीकरणासाठी सदैव तत्पर.',
            'Dedicated to empowering citizens, students, farmers & e-Seva operators across Maharashtra.'
          )}
        </p>
        <p className="text-[11px] text-slate-500 font-mono">
          {t('© २०२६ महा कॉर्नर • सर्व हक्क सुरक्षित', '© 2026 MAHA CORNER • All Rights Reserved')}
        </p>
      </div>

      {/* Bottom-Right Corner Locked Owner Analytics Box (Numeric Only) */}
      <div className="flex justify-end pt-2">
        {!analyticsStats ? (
          <div className="w-full sm:w-80 rounded-2xl bg-slate-900 text-white border border-slate-700/90 shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-tight">
                    {t('खाजगी आकडेवारी बॉक्स', 'Owner Counter Box')}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {t('फक्त संस्थापकांसाठी लॉक केलेले', 'Locked • Numbers Only')}
                  </p>
                </div>
              </div>

              {!isStatsBoxOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsStatsBoxOpen(true);
                    setAnalyticsError('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t('उघडा', 'Unlock')}</span>
                </button>
              )}
            </div>

            {isStatsBoxOpen && (
              <form onSubmit={handleUnlockAnalytics} className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPinText ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      value={analyticsPin}
                      onChange={(e) => {
                        setAnalyticsPin(e.target.value);
                        if (analyticsError) setAnalyticsError('');
                      }}
                      placeholder={t('पासवर्ड टाका...', 'Enter password...')}
                      autoFocus
                      className="w-full h-9 pl-3 pr-8 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-white tracking-widest placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinText((v) => !v)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-amber-300 cursor-pointer"
                      aria-label={showPinText ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={analyticsLoading}
                    className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {analyticsLoading ? '...' : t('तपासा', 'Open')}
                  </button>
                </div>
                {analyticsError && (
                  <p className="text-[11px] font-bold text-rose-400">{analyticsError}</p>
                )}
              </form>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 text-white border border-amber-500/50 shadow-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <Unlock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <span>{t('महा कॉर्नर • एकूण वापर आकडेवारी (फक्त अंक)', 'MAHA CORNER • Usage Numbers')}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {t('वेबसाईट भेटी व टूल्स वापराचे निव्वळ आकडे', 'Anonymous numeric visit and feature usage counts')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshAnalytics}
                  disabled={analyticsLoading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                  <span>{t('रीफ्रेश', 'Refresh')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLockAnalytics}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('लॉक करा', 'Lock')}</span>
                </button>
              </div>
            </div>

            {analyticsError && (
              <p className="text-xs font-bold text-rose-400">{analyticsError}</p>
            )}

            {/* Top 4 Numeric KPI Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>{t('एकूण भेटी', 'Total Visits')}</span>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 tabular-nums">
                  {analyticsStats.totalVisits.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>{t('युनिक लोक', 'Unique Users')}</span>
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-2xl font-black text-sky-400 tabular-nums">
                  {analyticsStats.uniqueVisitors.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>{t('आजच्या भेटी', 'Today Visits')}</span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 tabular-nums">
                  {analyticsStats.todayVisits.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>{t('एकूण वापर', 'Total Uses')}</span>
                  <MousePointerClick className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400 tabular-nums">
                  {(analyticsStats.totalToolOpens + analyticsStats.totalToolActions).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Feature-wise Numeric Counts */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>{t('कोणते टूल्स व विभाग किती वेळा वापरले (संख्या)', 'Feature Usage Breakdown (Counts Only)')}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {t('उघडले', 'Opens')}: {analyticsStats.totalToolOpens.toLocaleString('en-IN')} •{' '}
                  {t('क्रिया', 'Actions')}: {analyticsStats.totalToolActions.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {analyticsStats.features.map((item) => {
                  const label = FEATURE_LABELS[item.id] || { mr: item.id, en: item.id };
                  return (
                    <div
                      key={item.id}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {lang === 'en' ? label.en : label.mr}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {t('उघडले', 'Opens')}: {item.opens.toLocaleString('en-IN')} •{' '}
                          {t('वापर/डाउनलोड', 'Actions')}: {item.actions.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black tabular-nums shrink-0">
                        {item.total.toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Owner-Only Locked Profile Photo Management */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t('प्रोफाईल फोटो नियंत्रण (फक्त तुमच्यासाठी)', 'Profile Photo Control (Owner Only)')}</span>
                </h5>
                <p className="text-[10px] text-slate-400">
                  {t(
                    'येथून बदललेला फोटो संपूर्ण वेबसाईटवर कायमस्वरूपी अपडेट होतो.',
                    'Photo updated here saves permanently on the server for all visitors.'
                  )}
                </p>
                {photoUploadSuccess && (
                  <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('प्रोफाईल फोटो यशस्वीरित्या अपडेट झाला! ✓', 'Profile photo updated successfully! ✓')}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={photoSaving}
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoSaving ? t('सेव्ह होत आहे...', 'Saving...') : t('माझा फोटो बदला', 'Change My Photo')}</span>
                </button>

                {founderPhoto !== DEFAULT_FOUNDER_PHOTO && (
                  <button
                    type="button"
                    disabled={photoSaving}
                    onClick={handleResetPhoto}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('मूळ फोटो रिसेट करा', 'Reset Photo')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Firebase Follower Management Admin Section (Strictly Protected by Google Admin Auth) */}
      <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>{t('फॉलोअर्स मॅनेजमेंट व Excel रिपोर्ट (Firebase Admin)', 'Follower Management & Excel Export (Firebase Admin)')}</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {t(
                'सर्व फॉलोअर्सची माहिती Firebase Firestore मध्ये कायमस्वरूपी सुरक्षित आहे. फक्त अधिकृत Admin लाच प्रवेश आहे.',
                'All follower registrations are persisted permanently in Firebase Firestore with Admin-only access.'
              )}
            </p>
          </div>
        </div>
        <FollowersAdminDashboard />
      </div>

      {/* Quick Owner Unlock Modal when Portrait Lock Icon is Clicked */}
      {showPhotoUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUnlockAnalytics}
            className="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-amber-500/40 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>{t('संस्थापक अनलॉक (Owner Unlock)', 'Founder Unlock')}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoUnlockModal(false);
                  setAnalyticsError('');
                }}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                aria-label={t('बंद करा', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t(
                'प्रोफाईल फोटो बदलण्यासाठी आणि आकडेवारी पाहण्यासाठी तुमचा पासवर्ड टाका:',
                'Enter your password to unlock profile photo editing and usage numbers:'
              )}
            </p>

            <div className="relative">
              <input
                type={showPinText ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={analyticsPin}
                onChange={(e) => {
                  setAnalyticsPin(e.target.value);
                  if (analyticsError) setAnalyticsError('');
                }}
                placeholder={t('पासवर्ड टाका...', 'Enter password...')}
                autoFocus
                className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-slate-800 border border-slate-600 text-sm font-bold text-white tracking-widest placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

            {analyticsError && <p className="text-xs font-bold text-rose-400">{analyticsError}</p>}

            <button
              type="submit"
              disabled={analyticsLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs cursor-pointer transition-colors"
            >
              {analyticsLoading ? t('तपासत आहे...', 'Checking...') : t('अनलॉक करा', 'Unlock Now')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

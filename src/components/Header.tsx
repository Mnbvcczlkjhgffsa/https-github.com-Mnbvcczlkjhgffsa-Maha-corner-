import React from 'react';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getPortalInviteShareUrl, getPmfbyPageOnlyInviteUrl } from '../utils/shareConfig';
import {
  Scissors,
  CreditCard,
  Calculator,
  Image as ImageIcon,
  Globe,
  Sparkles,
  ShieldCheck,
  FileText,
  UserCheck,
  FileCheck2,
  Briefcase,
  Languages,
  Share2,
  Bell,
  BellRing,
  Check
} from 'lucide-react';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount?: number;
  isFollowed?: boolean;
  followerCount?: number;
  onOpenUpdates?: (tab: 'updates' | 'subscribe' | 'followers-admin' | 'owner') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  unreadCount = 0,
  isFollowed = false,
  followerCount = 0,
  onOpenUpdates,
}) => {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border-b border-amber-500/30 text-white shadow-xl sticky top-0 z-40 backdrop-blur-md">
      {/* Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Official Maha Corner Logo */}
          <div className="relative group cursor-pointer" onClick={() => onTabChange('ai-poster')}>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-cyan-300 p-0.5 shadow-lg shadow-cyan-500/35 flex items-center justify-center transition-transform group-hover:scale-105">
              <img
                src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
                alt="MAHA CORNER - Since 2018"
                className="w-full h-full object-cover rounded-full bg-[#020817]"
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                {t('महा', 'MAHA')} <span className="text-amber-400">{t('कॉर्नर', 'CORNER')}</span>
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                {lang === 'mr' ? 'MAHA CORNER' : 'महा कॉर्नर'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {t('माहिती अशी, जी कामी येईल! • अधिकृत पोर्टल', 'Information That Truly Matters! • Official Portal')}
            </p>
          </div>
        </div>

        {/* Right Controls: Updates Bell + Follow Button + Admin + WhatsApp Share + Language Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenUpdates && (
            <>
              <button
                type="button"
                onClick={() => onOpenUpdates('updates')}
                title={t('नवीन अपडेट्स पहा', 'View Live Updates')}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-colors cursor-pointer shrink-0"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border border-slate-900 tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenUpdates('subscribe')}
                title={t('संमतीसह फॉलो व मोबाईल नोंदणी करा', 'Follow & Register with Consent')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black shadow-md transition-all cursor-pointer shrink-0 ${
                  isFollowed
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
                }`}
              >
                {isFollowed ? <Check className="w-3.5 h-3.5" /> : <BellRing className="w-3.5 h-3.5" />}
                <span>{isFollowed ? t('फॉलो ✓', 'Following ✓') : t('फॉलो करा', 'Follow')}</span>
                {followerCount > 0 && (
                  <span className="opacity-80 tabular-nums">({followerCount})</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenUpdates('followers-admin')}
                title={t('Admin Dashboard (Followers List & Excel)', 'Admin Follower Dashboard')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{t('Admin', 'Admin')}</span>
              </button>
            </>
          )}

          <a
            href={currentTab === 'pmfby-calc' ? getPmfbyPageOnlyInviteUrl(lang) : getPortalInviteShareUrl(lang)}
            target="_blank"
            rel="noopener noreferrer"
            title={
              currentTab === 'pmfby-calc'
                ? t('WhatsApp वर फक्त हे पीक विमा पेज शेअर करा', 'Share Only PMFBY Calculator Page on WhatsApp')
                : t('WhatsApp वर पोर्टल शेअर करा', 'Share Portal on WhatsApp')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-950/30 transition-all cursor-pointer shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {currentTab === 'pmfby-calc'
                ? t('हे पेज शेअर करा', 'Share This Page')
                : t('WhatsApp शेअर', 'WhatsApp Share')}
            </span>
            <span className="sm:hidden">{t('शेअर', 'Share')}</span>
          </a>

          {/* Bilingual Switcher */}
          <div
            className="flex items-center bg-slate-800/90 border border-amber-500/40 rounded-full p-1 shadow-md"
            role="group"
            aria-label={t('भाषा निवडा', 'Select Language')}
          >
            <Languages className="w-3.5 h-3.5 text-amber-400 ml-2 mr-1.5 hidden sm:block" />
            <button
              type="button"
              onClick={() => setLang('mr')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                lang === 'mr'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              मराठी
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                lang === 'en'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              English
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('१००% सुरक्षित व खाजगी (डिव्हाइसवरच प्रोसेस)', '100% Private & On-Device Processing')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-1.5" aria-label={t('मुख्य टॅब', 'Main Tabs')}>
          <button
            onClick={() => onTabChange('ai-poster')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'ai-poster'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 text-slate-950 shadow-lg shadow-orange-500/30 scale-[1.02] ring-2 ring-amber-300'
                : 'text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{t('🖼️ पोस्टर मेकर (नाव व नंबर जोडा)', '🖼️ Poster Maker (Add Shop Details)')}</span>
          </button>

          <button
            onClick={() => onTabChange('cutter')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'cutter'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>{t('🪪 PDF कार्ड कटर (Print Sheet)', '🪪 PDF Card Cutter (Print Sheet)')}</span>
          </button>

          <button
            onClick={() => onTabChange('farmer-card')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              currentTab === 'farmer-card'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('🌾 शेतकरी ओळखपत्र (Farmer ID)', '🌾 Farmer ID Card Maker')}</span>
          </button>

          <button
            onClick={() => onTabChange('pmfby-calc')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              currentTab === 'pmfby-calc'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>{t('🛡️ पीक विमा कॅल्क्युलेटर २०२६', '🛡️ PMFBY Calculator 2026')}</span>
          </button>

          <button
            onClick={() => onTabChange('photo-resizer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'photo-resizer'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t('🖼️ फोटो व सही रिसाइझर', '🖼️ Photo & Sign Resizer')}</span>
          </button>

          <button
            onClick={() => onTabChange('pdf-tools')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'pdf-tools'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>{t('📑 महा कॉर्नर टूल (२२ PDF टूल्स)', '📑 Maha Corner Tool (22 PDF Tools)')}</span>
          </button>

          <button
            onClick={() => onTabChange('gr')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'gr'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>{t('📜 शासकीय निर्णय (GR)', '📜 Govt Resolutions (GR)')}</span>
          </button>

          <button
            onClick={() => onTabChange('jobs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'jobs'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Briefcase className="w-4 h-4 text-sky-400" />
            <span>{t('💼 नोकरी संदर्भ (भरती)', '💼 Job Alerts & Bharti')}</span>
          </button>

          <button
            onClick={() => onTabChange('portals')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'portals'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{t('🌐 शासकीय पोर्टल्स', '🌐 Govt Portals')}</span>
          </button>

          <button
            onClick={() => onTabChange('about')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              currentTab === 'about'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/25 scale-[1.02]'
                : 'text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
            }`}
          >
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>{t('👑 संस्थापक व माहिती (About)', '👑 Founder & About')}</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

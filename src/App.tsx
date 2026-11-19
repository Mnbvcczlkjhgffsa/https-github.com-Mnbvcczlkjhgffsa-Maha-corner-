/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BellRing, ArrowRight, X, Share2, Languages } from 'lucide-react';
import { AppTab } from './types';
import { Header } from './components/Header';
import { AdvertisementMarquee } from './components/AdvertisementMarquee';
import MahaCornerPopupAd from './components/MahaCornerPopupAd';
import { AdUploadManagerModal } from './components/AdUploadManagerModal';
import { MahaCornerNews } from './components/MahaCornerNews';
import { AiPosterGenerator } from './components/AiPosterGenerator';
import { VipPosterPacks } from './components/VipPosterPacks';
import { CardCutter } from './components/CardCutter';
import { BulkCardMaker } from './components/BulkCardMaker';
import { FarmerCardMaker } from './components/FarmerCardMaker';
import { PmfbyCalculator } from './components/PmfbyCalculator';
import { PhotoResizer } from './components/PhotoResizer';
import { PdfToolbarSuite } from './components/PdfToolbarSuite';
import { GrDirectory } from './components/GrDirectory';
import { JobsDirectory } from './components/JobsDirectory';
import { PortalDirectory } from './components/PortalDirectory';
import { CscAffiliateStore } from './components/CscAffiliateStore';
import { AboutFounder } from './components/AboutFounder';
import { ImportantInfoPages } from './components/ImportantInfoPages';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GoogleAdBanner } from './components/GoogleAdBanner';
import { UpdatesSubscribeModal, UpdatesModalInitialTab } from './components/UpdatesSubscribeModal';
import { FloatingShareBar } from './components/FloatingShareBar';
import { ShareModal } from './components/ShareModal';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { trackWebsiteVisit, trackFeatureOpen } from './utils/analytics';
import { getPmfbyPageOnlyInviteUrl, TAB_TO_HASH } from './utils/shareConfig';
import {
  LiveUpdateItem,
  fetchLiveUpdates,
  getLastSeenUpdateTs,
  getLocalIsFollowed,
  markAllUpdatesSeenNow
} from './utils/updatesApi';
import {
  fetchPublicFollowerCountCached,
  getCachedPublicFollowerCount,
  setCachedPublicFollowerCount
} from './utils/firebaseFollowers';
import { SiteAdRecord, fetchAllSiteAds } from './utils/firebaseSiteAds';

const HASH_TO_TAB: Record<string, AppTab> = {
  '#ai-poster': 'ai-poster',
  '#poster': 'ai-poster',
  '#posters': 'ai-poster',
  '#maha-news': 'maha-news',
  '#news': 'maha-news',
  '#batmya': 'maha-news',
  '#daily-news': 'maha-news',
  '#vip': 'vip-posters',
  '#vip-posters': 'vip-posters',
  '#premium-posters': 'vip-posters',
  '#posters-vip': 'vip-posters',
  '#cutter': 'cutter',
  '#card-cutter': 'cutter',
  '#bulk-card': 'bulk-card',
  '#bulk-pvc': 'bulk-card',
  '#bulk-print': 'bulk-card',
  '#bulk': 'bulk-card',
  '#farmer-card': 'farmer-card',
  '#kisan-card': 'farmer-card',
  '#pmfby': 'pmfby-calc',
  '#pmfby-calc': 'pmfby-calc',
  '#pmfby-2026': 'pmfby-calc',
  '#pmfby-rabi-2026': 'pmfby-calc',
  '#photo-resizer': 'photo-resizer',
  '#resizer': 'photo-resizer',
  '#pdf-tools': 'pdf-tools',
  '#pdf': 'pdf-tools',
  '#gr': 'gr',
  '#gr-directory': 'gr',
  '#jobs': 'jobs',
  '#bharti': 'jobs',
  '#portals': 'portals',
  '#store': 'store',
  '#deals': 'store',
  '#amazon': 'store',
  '#hardware': 'store',
  '#about': 'about',
  '#about-me': 'about',
  '#team': 'about',
  '#privacy': 'privacy',
  '#privacy-policy': 'privacy',
  '#terms': 'terms',
  '#terms-conditions': 'terms',
  '#disclaimer': 'disclaimer',
  '#contact': 'contact',
  '#contact-us': 'contact',
};

function detectDedicatedPmfbyRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const params = new URLSearchParams(window.location.search);
  const pageParam = (params.get('page') || params.get('tab') || '').toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    pathname === '/pmfby-2026' ||
    pathname === '/pmfby-rabi-2026' ||
    pathname === '/pmfby' ||
    pageParam === 'pmfby-2026' ||
    pageParam === 'pmfby-rabi-2026' ||
    pageParam === 'pmfby-calc' ||
    pageParam === 'pmfby' ||
    hash === '#pmfby-2026' ||
    hash.startsWith('#pmfby-2026') ||
    hash === '#pmfby-rabi-2026' ||
    hash.startsWith('#pmfby-rabi-2026') ||
    hash === '#pmfby-calc' ||
    hash.startsWith('#pmfby-calc') ||
    hash === '#pmfby' ||
    hash.startsWith('#pmfby')
  );
}

function resolveTabFromUrl(): AppTab {
  if (typeof window === 'undefined') return 'ai-poster';
  if (detectDedicatedPmfbyRoute()) return 'pmfby-calc';

  const params = new URLSearchParams(window.location.search);
  const pageParam = (params.get('page') || params.get('tab') || params.get('tool') || '').toLowerCase().trim();
  const hash = window.location.hash.toLowerCase().trim();
  const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '').replace(/^\//, '').trim();

  const candidates = [
    hash,
    hash.replace(/^#/, ''),
    pageParam,
    pageParam.replace(/^#/, ''),
    pathname,
  ].filter(Boolean);

  for (const c of candidates) {
    if (HASH_TO_TAB[c]) return HASH_TO_TAB[c];
    if (HASH_TO_TAB[`#${c}`]) return HASH_TO_TAB[`#${c}`];
  }

  return 'ai-poster';
}

const MainShell: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const [isDedicatedPmfbyPage, setIsDedicatedPmfbyPage] = useState<boolean>(() => detectDedicatedPmfbyRoute());
  const [currentTab, setCurrentTab] = useState<AppTab>(() => resolveTabFromUrl());
  const initialLoggedRef = useRef(false);

  useEffect(() => {
    const handleRouteChange = () => {
      const dedicated = detectDedicatedPmfbyRoute();
      setIsDedicatedPmfbyPage(dedicated);
      if (dedicated) {
        setCurrentTab('pmfby-calc');
        return;
      }
      const nextTab = resolveTabFromUrl();
      setCurrentTab(nextTab);
    };
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (currentTab === 'pmfby-calc' || isDedicatedPmfbyPage) {
      document.title =
        lang === 'en'
          ? 'Maha Corner — PMFBY Rabi & Kharif 2026 Crop Insurance Calculator'
          : 'Maha Corner — PMFBY रब्बी व खरीप हंगाम पीक विमा २०२६ प्रीमियम कॅल्क्युलेटर';
    }
  }, [currentTab, isDedicatedPmfbyPage, lang]);

  // Regular customer Follow & Live Updates state
  const [updates, setUpdates] = useState<LiveUpdateItem[]>([]);
  const [followerCount, setFollowerCount] = useState<number>(() => getCachedPublicFollowerCount());
  const [isFollowed, setIsFollowed] = useState<boolean>(() => getLocalIsFollowed());
  const [lastSeenTs, setLastSeenTs] = useState<number>(() => getLastSeenUpdateTs());
  const [updatesModalOpen, setUpdatesModalOpen] = useState<boolean>(false);
  const [updatesModalTab, setUpdatesModalTab] = useState<UpdatesModalInitialTab>('updates');
  const [stripDismissed, setStripDismissed] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [shareModalMode, setShareModalMode] = useState<'page' | 'website'>('page');

  // Owner-Locked Portal Advertisements state
  const [siteAds, setSiteAds] = useState<SiteAdRecord[]>([]);
  const [activeSiteAd, setActiveSiteAd] = useState<SiteAdRecord | null>(null);
  const [adUploadModalOpen, setAdUploadModalOpen] = useState<boolean>(false);
  const [adPreviewSignal, setAdPreviewSignal] = useState<number>(0);

  useEffect(() => {
    let active = true;
    fetchAllSiteAds()
      .then(({ ads, activeAd }) => {
        if (!active) return;
        setSiteAds(ads);
        setActiveSiteAd(activeAd);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadUpdates = useCallback(async () => {
    const res = await fetchLiveUpdates();
    if (res.success) {
      setUpdates(res.updates);
      if (res.followerCount > 0) {
        setFollowerCount((prev) => {
          const next = Math.max(prev, res.followerCount);
          setCachedPublicFollowerCount(next);
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublicFollowerCountCached()
      .then((count) => {
        if (active) setFollowerCount(count);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initialLoggedRef.current) return;
    initialLoggedRef.current = true;
    trackWebsiteVisit();
    trackFeatureOpen(detectDedicatedPmfbyRoute() ? 'pmfby-calc' : 'ai-poster');
    void loadUpdates();
  }, [loadUpdates]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadUpdates();
    }, 60000);
    const onFocus = () => void loadUpdates();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadUpdates]);

  const unreadCount = useMemo(
    () => updates.filter((u) => (Date.parse(u.createdAt) || 0) > lastSeenTs).length,
    [updates, lastSeenTs]
  );

  const handleMarkAllSeen = useCallback(() => {
    const newestIso = updates[0]?.createdAt;
    const ts = markAllUpdatesSeenNow(newestIso);
    setLastSeenTs(ts);
  }, [updates]);

  const handleOpenUpdates = (tab: UpdatesModalInitialTab = 'updates') => {
    setUpdatesModalTab(tab);
    setUpdatesModalOpen(true);
    void loadUpdates();
  };

  const handleBackToMainPortal = () => {
    setIsDedicatedPmfbyPage(false);
    setCurrentTab('ai-poster');
    try {
      window.history.pushState(null, '', '/?page=ai-poster&tab=ai-poster#ai-poster');
    } catch {}
  };

  const handleTabChange = (nextTab: AppTab) => {
    if (nextTab === 'pmfby-calc') {
      setIsDedicatedPmfbyPage(true);
      setCurrentTab('pmfby-calc');
      try {
        window.history.pushState(null, '', '/pmfby-2026?page=pmfby-2026#pmfby-2026');
      } catch {}
      trackFeatureOpen('pmfby-calc');
      return;
    }
    setIsDedicatedPmfbyPage(false);
    setCurrentTab(nextTab);
    try {
      const hash = TAB_TO_HASH[nextTab] || '#ai-poster';
      const slug = hash.replace(/^#/, '');
      window.history.pushState(null, '', `/?page=${slug}&tab=${slug}#${slug}`);
    } catch {}
    if (nextTab !== currentTab) {
      trackFeatureOpen(nextTab);
    }
  };

  const latestUnread = unreadCount > 0 ? updates[0] : null;

  // Standalone Special Page Shell when opened directly via /pmfby-2026 share link
  if (isDedicatedPmfbyPage) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-['Noto_Sans_Devanagari',sans-serif]">
        <AdvertisementMarquee
          activeAd={activeSiteAd}
          onContactClick={() => {
            setIsDedicatedPmfbyPage(false);
            handleTabChange('contact');
          }}
          onOpenAdUpload={() => setAdUploadModalOpen(true)}
        />
        <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b border-emerald-500/30 text-white shadow-lg sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 p-0.5 shadow-md">
                <img
                  src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
                  alt="Maha Corner"
                  className="w-full h-full object-cover rounded-full bg-[#020817]"
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Maha <span className="text-emerald-400">Corner</span>
                </h1>
                <p className="text-[11px] text-slate-300 font-semibold">
                  {t('PMFBY रब्बी व खरीप पीक विमा २०२६ कॅल्क्युलेटर', 'PMFBY Rabi & Kharif 2026 Calculator')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToMainPortal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
                title={t('मुख्य पोर्टलवर परत जा', 'Return to Main Portal')}
              >
                <span>{t('🏠 मुख्य पोर्टल', '🏠 Main Portal')}</span>
              </button>

              <a
                href={getPmfbyPageOnlyInviteUrl(lang)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black shadow-md transition-all hover:scale-105"
                title={t('WhatsApp वर फक्त हे कॅल्क्युलेटर पेज शेअर करा', 'Share this calculator page on WhatsApp')}
              >
                <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
                </svg>
                <span>{t('📲 WhatsApp शेअर', 'Share on WhatsApp')}</span>
              </a>

              <div
                className="flex items-center bg-slate-800/90 border border-emerald-500/40 rounded-full p-1"
                role="group"
                aria-label={t('भाषा निवडा', 'Select Language')}
              >
                <Languages className="w-3.5 h-3.5 text-emerald-400 ml-2 mr-1 hidden sm:block" />
                <button
                  type="button"
                  onClick={() => setLang('mr')}
                  className={`px-2.5 py-1 rounded-full text-xs font-black cursor-pointer ${
                    lang === 'mr' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  मराठी
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 rounded-full text-xs font-black cursor-pointer ${
                    lang === 'en' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-4">
          <ErrorBoundary key="pmfby-standalone" onReset={() => window.location.reload()}>
            <PmfbyCalculator isStandalone={true} />
          </ErrorBoundary>
          <GoogleAdBanner slotId="756682336" label={t('प्रायोजित जाहिरात (Google Ads)', 'Sponsored (Google Ads)')} />
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500">
          <span>
            Maha Corner · {t('PMFBY रब्बी व खरीप हंगाम पीक विमा २०२६ प्रीमियम कॅल्क्युलेटर', 'PMFBY Rabi & Kharif 2026 Crop Insurance Calculator')}
          </span>
        </footer>

        {/* Floating Quick Share Dock */}
        <FloatingShareBar currentTab="pmfby-calc" />

        {/* Owner-Locked Advertisement Upload Modal */}
        <AdUploadManagerModal
          isOpen={adUploadModalOpen}
          onClose={() => setAdUploadModalOpen(false)}
          ads={siteAds}
          activeAd={activeSiteAd}
          onAdsUpdated={(nextAds, nextActive) => {
            setSiteAds(nextAds);
            setActiveSiteAd(nextActive);
          }}
          onPreviewPopup={() => setAdPreviewSignal((n) => n + 1)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-['Noto_Sans_Devanagari',sans-serif]">
        {/* Top Scrolling Advertisement Marquee */}
        <AdvertisementMarquee
          activeAd={activeSiteAd}
          onContactClick={() => handleTabChange('contact')}
          onOpenAdUpload={() => setAdUploadModalOpen(true)}
        />

        {/* Brand Header & Navigation */}
        <Header
          currentTab={currentTab}
          onTabChange={handleTabChange}
          unreadCount={unreadCount}
          isFollowed={isFollowed}
          followerCount={followerCount}
          onOpenUpdates={handleOpenUpdates}
        />

        {/* Unread Live Update Alert Strip for Regular Visitors */}
        {latestUnread && !stripDismissed && (
          <div className="bg-amber-50 border-b border-amber-300 text-amber-950">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-black text-rose-700 shrink-0">{t('नवीन अपडेट:', 'NEW UPDATE:')}</span>
                <span className="font-bold truncate">{latestUnread.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleMarkAllSeen();
                    handleTabChange(latestUnread.targetTab);
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('पहा', 'View')}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setStripDismissed(true)}
                  aria-label={t('बंद करा', 'Dismiss')}
                  className="p-1 rounded-lg hover:bg-amber-200/70 text-amber-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-4">

          <GoogleAdBanner slotId="756682336" className="mb-2" label={t('जाहिरात (Google Ads)', 'Advertisement (Google Ads)')} />

          <ErrorBoundary key={currentTab} onReset={() => setCurrentTab('ai-poster')}>
            {currentTab === 'ai-poster' && <AiPosterGenerator />}
            {currentTab === 'maha-news' && <MahaCornerNews onNavigateTab={handleTabChange} />}
            {currentTab === 'vip-posters' && (
              <VipPosterPacks onOpenInEditor={(_tpl) => setCurrentTab('ai-poster')} />
            )}
            {currentTab === 'cutter' && <CardCutter />}
            {currentTab === 'bulk-card' && (
              <BulkCardMaker
                onNavigateToSingleCutter={() => setCurrentTab('cutter')}
                onNavigateToStore={() => setCurrentTab('store')}
              />
            )}
            {currentTab === 'farmer-card' && <FarmerCardMaker />}
            {currentTab === 'pmfby-calc' && <PmfbyCalculator />}
            {currentTab === 'photo-resizer' && <PhotoResizer />}
            {currentTab === 'pdf-tools' && <PdfToolbarSuite />}
            {currentTab === 'gr' && <GrDirectory />}
            {currentTab === 'jobs' && <JobsDirectory />}
            {currentTab === 'portals' && <PortalDirectory />}
            {currentTab === 'store' && <CscAffiliateStore />}
            {currentTab === 'about' && <AboutFounder />}
            {(currentTab === 'privacy' ||
              currentTab === 'terms' ||
              currentTab === 'disclaimer' ||
              currentTab === 'contact') && (
              <ImportantInfoPages page={currentTab} onNavigateTab={handleTabChange} />
            )}
          </ErrorBoundary>

          <GoogleAdBanner slotId="756682336" className="mt-6" label={t('प्रायोजित जाहिरात (Sponsored)', 'Sponsored (Google Ads)')} />
        </main>

        {/* Brand Footer */}
        <Footer
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onOpenSubscribe={() => handleOpenUpdates('subscribe')}
        />
      </div>

      {/* Live Updates, Follow/Subscribe & Owner Broadcast Modal */}
      <UpdatesSubscribeModal
        isOpen={updatesModalOpen}
        initialTab={updatesModalTab}
        onClose={() => setUpdatesModalOpen(false)}
        updates={updates}
        followerCount={followerCount}
        unreadCount={unreadCount}
        lastSeenTs={lastSeenTs}
        isFollowed={isFollowed}
        onFollowedChange={(followed, nextCount) => {
          setIsFollowed(followed);
          if (typeof nextCount === 'number') {
            setFollowerCount(nextCount);
            setCachedPublicFollowerCount(nextCount);
          }
        }}
        onUpdatesChange={(next) => {
          setUpdates(next);
          setStripDismissed(false);
        }}
        onMarkAllSeen={handleMarkAllSeen}
        onNavigateTab={handleTabChange}
      />

      {/* Modal for sharing individual page or entire portal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        currentTab={currentTab}
        initialMode={shareModalMode}
      />

      {/* Floating Quick Share Dock - Always neatly accessible anywhere on the portal */}
      <FloatingShareBar
        currentTab={currentTab}
        onOpenMoreShare={() => {
          setShareModalMode('page');
          setShareModalOpen(true);
        }}
      />

      {/* Welcome Advertisement Popup */}
      <MahaCornerPopupAd
        activeAd={activeSiteAd}
        previewSignal={adPreviewSignal}
        onOpenAdUpload={() => setAdUploadModalOpen(true)}
      />

      {/* Owner-Locked Advertisement Upload & Manager Modal */}
      <AdUploadManagerModal
        isOpen={adUploadModalOpen}
        onClose={() => setAdUploadModalOpen(false)}
        ads={siteAds}
        activeAd={activeSiteAd}
        onAdsUpdated={(nextAds, nextActive) => {
          setSiteAds(nextAds);
          setActiveSiteAd(nextActive);
        }}
        onPreviewPopup={() => setAdPreviewSignal((n) => n + 1)}
      />
    </>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <MainShell />
    </LanguageProvider>
  );
}

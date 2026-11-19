import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Search,
  Sparkles,
  Globe,
  Clock,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  CloudSun,
  GraduationCap,
  Sprout,
  Coins,
  FileText,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  Building2,
  EyeOff,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { AppTab } from '../types';
import { getTabCanonicalUrl } from '../utils/shareConfig';

export interface MahaNewsItem {
  id?: string;
  title: string;
  summary: string;
  category: 'farmer' | 'insurance' | 'weather' | 'market' | 'student' | 'gov' | string;
  categoryLabelMr?: string;
  dateLabel?: string;
  bullets?: string[];
  sourceTitle?: string;
  sourceUrl?: string;
}

interface NewsSource {
  title: string;
  uri: string;
}

interface MahaCornerNewsProps {
  onNavigateTab?: (tab: AppTab) => void;
}

type NewsCategoryFilter = 'all' | 'farmer' | 'insurance' | 'weather' | 'market' | 'student' | 'gov';

const SEEN_NEWS_STORAGE_KEY = 'maha_corner_seen_news_v2';

function getStoredSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_NEWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map(String));
      }
    }
  } catch {}
  return new Set();
}

function saveStoredSeenIds(seenSet: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(seenSet).slice(-200);
    localStorage.setItem(SEEN_NEWS_STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export const MahaCornerNews: React.FC<MahaCornerNewsProps> = ({ onNavigateTab }) => {
  const { lang, t } = useLanguage();
  const [headlines, setHeadlines] = useState<MahaNewsItem[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [isLiveGrounded, setIsLiveGrounded] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');
  const [seenIds, setSeenIds] = useState<Set<string>>(() => getStoredSeenIds());
  const [filterMode, setFilterMode] = useState<'unseen' | 'all'>('unseen');
  const [statusNotification, setStatusNotification] = useState<string>('');

  // Deduplicate and filter out repetition
  const deduplicateList = useCallback((items: MahaNewsItem[]): MahaNewsItem[] => {
    const seenTitles = new Set<string>();
    const seenItemIds = new Set<string>();
    return items.filter((it) => {
      const norm = normalizeTitleKey(it.title);
      const id = it.id || norm;
      if (seenTitles.has(norm) || seenItemIds.has(id)) {
        return false;
      }
      seenTitles.add(norm);
      seenItemIds.add(id);
      return true;
    });
  }, []);

  const fetchNews = useCallback(
    async (isManualReload = false) => {
      if (isManualReload) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Mark currently visible headlines as seen if this is a manual reload
      let nextSeenIds = new Set(seenIds);
      if (isManualReload && headlines.length > 0) {
        headlines.forEach((h) => {
          const id = h.id || normalizeTitleKey(h.title);
          nextSeenIds.add(id);
        });
        setSeenIds(nextSeenIds);
        saveStoredSeenIds(nextSeenIds);
      }

      try {
        const excludeQuery = Array.from(nextSeenIds).slice(-60).join(',');
        const params = new URLSearchParams();
        if (isManualReload) params.set('refresh', '1');
        if (excludeQuery) params.set('exclude', excludeQuery);

        const url = `/api/maha-news?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data?.success) {
          const rawItems = Array.isArray(data.headlines) ? data.headlines : [];
          const deduped = deduplicateList(rawItems);

          // Check if all available news in pool was already seen
          const unseenCount = deduped.filter(
            (it) => !nextSeenIds.has(it.id || normalizeTitleKey(it.title))
          ).length;

          if (isManualReload) {
            if (unseenCount > 0) {
              setStatusNotification(t('नवीन ताज्या बातम्या लोड झाल्या! ✓', 'Loaded fresh new articles! ✓'));
            } else {
              setStatusNotification(
                t('सर्व बातम्या वाचून झाल्या आहेत. नव्या फेरीसाठी बातम्या रीफ्रेश केल्या आहेत!', 'You read all news! Starting a fresh new cycle.')
              );
            }
            setTimeout(() => setStatusNotification(''), 4000);
          }

          setHeadlines(deduped);
          setSources(Array.isArray(data.sources) ? data.sources : []);
          setFetchedAt(typeof data.fetchedAt === 'string' ? data.fetchedAt : new Date().toISOString());
          setIsLiveGrounded(Boolean(data.liveGrounded));
        }
      } catch (err) {
        console.error('Error fetching Maha News:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [seenIds, headlines, deduplicateList, t]
  );

  useEffect(() => {
    void fetchNews(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss / Mark individual news item as read
  const handleMarkAsRead = (item: MahaNewsItem) => {
    const id = item.id || normalizeTitleKey(item.title);
    const next = new Set(seenIds);
    next.add(id);
    setSeenIds(next);
    saveStoredSeenIds(next);

    setStatusNotification(t('बातमी वाचली म्हणून नोंदवली गेली व लपवली! ✓', 'News marked as read and hidden! ✓'));
    setTimeout(() => setStatusNotification(''), 3000);
  };

  // Reset all seen history so user can view everything again
  const handleResetHistory = () => {
    setSeenIds(new Set());
    saveStoredSeenIds(new Set());
    setFilterMode('unseen');
    setStatusNotification(t('वाचलेल्या बातम्यांचा इतिहास पूर्ववत केला! ✓', 'Read history reset successfully! ✓'));
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
    setTimeout(() => setStatusNotification(''), 3500);
    void fetchNews(false);
  };

  const handleCopyNews = async (item: MahaNewsItem, idx: number) => {
    const key = item.id || `news-${idx}`;
    const pageUrl = getTabCanonicalUrl('maha-news');
    const textToCopy = `📰 *${item.title}*\n\n${item.summary}\n\n${
      item.bullets && item.bullets.length > 0
        ? `📌 *महत्त्वाचे मुद्दे:*\n${item.bullets.map((b) => `• ${b}`).join('\n')}\n\n`
        : ''
    }🌐 *अधिक माहिती व बातम्यांसाठी भेट द्या:*\n👉 ${pageUrl}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(key);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedId(''), 2500);
    } catch {}
  };

  const getWhatsAppShareUrl = (item: MahaNewsItem) => {
    const pageUrl = getTabCanonicalUrl('maha-news');
    const msg = `📰 *महा कॉर्नर न्यूज (MAHA CORNER)* 🇮🇳\n━━━━━━━━━━━━━━━\n📢 *${item.title}*\n\n${item.summary}\n\n${
      item.bullets && item.bullets.length > 0
        ? `📌 *महत्त्वाचे मुद्दे:*\n${item.bullets.map((b) => `• ${b}`).join('\n')}\n\n`
        : ''
    }👉 *थेट बातमी व इतर सर्व अपडेट्स पाहण्यासाठी लिंक:*\n${pageUrl}\n\n🌐 महा कॉर्नर • mahacorner.in`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  // Filter headlines based on unseen status, category, and search query
  const filteredNews = useMemo(() => {
    return headlines.filter((item) => {
      const id = item.id || normalizeTitleKey(item.title);
      const isAlreadySeen = seenIds.has(id);

      // If user selected "unseen" mode, hide seen items (unless all items would be hidden)
      if (filterMode === 'unseen' && isAlreadySeen) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSummary = item.summary.toLowerCase().includes(query);
        const matchesCategory = (item.categoryLabelMr || '').toLowerCase().includes(query);
        const matchesBullets = (item.bullets || []).some((b) => b.toLowerCase().includes(query));
        return matchesTitle || matchesSummary || matchesCategory || matchesBullets;
      }
      return true;
    });
  }, [headlines, seenIds, filterMode, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: headlines.length };
    for (const item of headlines) {
      const cat = item.category || 'farmer';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [headlines]);

  const formattedTime = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('mr-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      })
    : '';

  const formattedDate = fetchedAt
    ? new Date(fetchedAt).toLocaleDateString('mr-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '';

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'insurance':
        return {
          label: 'पीक विमा',
          icon: ShieldCheck,
          badgeBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800',
          accentBorder: 'border-l-emerald-500',
          dotColor: 'bg-emerald-500',
        };
      case 'farmer':
        return {
          label: 'शेतकरी व कृषी',
          icon: Sprout,
          badgeBg: 'bg-amber-500/15 border-amber-500/40 text-amber-800',
          accentBorder: 'border-l-amber-500',
          dotColor: 'bg-amber-500',
        };
      case 'weather':
        return {
          label: 'हवामान अंदाज',
          icon: CloudSun,
          badgeBg: 'bg-sky-500/15 border-sky-500/40 text-sky-800',
          accentBorder: 'border-l-sky-500',
          dotColor: 'bg-sky-500',
        };
      case 'market':
        return {
          label: 'बाजारभाव व APMC',
          icon: Coins,
          badgeBg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-800',
          accentBorder: 'border-l-indigo-500',
          dotColor: 'bg-indigo-500',
        };
      case 'student':
        return {
          label: 'विद्यार्थी व नोकरी भरती',
          icon: GraduationCap,
          badgeBg: 'bg-rose-500/15 border-rose-500/40 text-rose-800',
          accentBorder: 'border-l-rose-500',
          dotColor: 'bg-rose-500',
        };
      case 'gov':
      default:
        return {
          label: 'शासकीय निर्णय व GR',
          icon: Building2,
          badgeBg: 'bg-purple-500/15 border-purple-500/40 text-purple-800',
          accentBorder: 'border-l-purple-500',
          dotColor: 'bg-purple-500',
        };
    }
  };

  const unseenTotalCount = useMemo(() => {
    return headlines.filter((it) => !seenIds.has(it.id || normalizeTitleKey(it.title))).length;
  }, [headlines, seenIds]);

  return (
    <div className="space-y-6">
      {/* 1. Hero Showcase Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 border border-emerald-500/40 text-white p-5 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs font-black shadow-inner">
                <Globe className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                <span>{t('थेट गुगल सर्च ग्राउंडेड लाईव्ह बातम्या', 'Google Search Grounded Live Feed')}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('प्रत्येक रीलोडवर नवी बातमी • पुनरावृत्ती नाही', 'Fresh News On Every Reload • No Repeats')}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-2.5">
              <span>📰 महा कॉर्नर</span>
              <span className="text-amber-400">न्यूज पोर्टल</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 text-xs sm:text-sm font-black tracking-wider uppercase">
                LIVE
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                'महाराष्ट्र व देशातील शेतकरी, पीक विमा, हवामान, बाजारभाव, विद्यार्थी भरती व शिष्यवृत्तीच्या खात्रीशीर ताज्या बातम्या. एकदा वाचलेली बातमी रीलोड केल्यावर बदलून लगेच दुसरी नवी बातमी दिसेल.',
                'Verified Marathi news bulletin. Once you read or reload, you receive a fresh unseen news batch without repeats.'
              )}
            </p>

            {formattedDate && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                <span className="inline-flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {formattedDate} {formattedTime ? `· वेळ: ${formattedTime}` : ''}
                  </span>
                </span>

                <span className="inline-flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-amber-300 font-bold">
                  <span>वाचलेल्या: {seenIds.size}</span>
                  <span>·</span>
                  <span className="text-emerald-400">उपलब्ध नवीन: {unseenTotalCount}</span>
                </span>
              </div>
            )}
          </div>

          {/* Quick Refresh & Rotation Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void fetchNews(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-300/40"
              title={t('मागील वाचलेल्या बातम्या बदलून नवीन ताज्या बातम्या लोड करा', 'Load fresh unseen news and rotate out read news')}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>
                {refreshing
                  ? t('नवीन बातम्या शोधत आहे...', 'Loading Fresh News...')
                  : t('🔄 पुढील नवीन बातम्या (रीलोड)', '🔄 Load Next Fresh News')}
              </span>
            </button>

            {seenIds.size > 0 && (
              <button
                type="button"
                onClick={handleResetHistory}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                title={t('वाचलेल्या बातम्यांचा इतिहास पूर्ववत करून सर्व बातम्या पुन्हा पहा', 'Reset read history')}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('वाचलेल्या बातम्या पूर्ववत करा', 'Reset Read History')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Status Notification */}
      {statusNotification && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs sm:text-sm font-bold text-emerald-900 flex items-center justify-between gap-2 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotification('')}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Category Filter & Unread Toggle Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'सर्व बातम्या', emoji: '🌐', count: categoryCounts.all || 0 },
              { id: 'insurance', label: 'पीक विमा', emoji: '🛡️', count: categoryCounts.insurance || 0 },
              { id: 'farmer', label: 'शेतकरी व योजना', emoji: '🌾', count: categoryCounts.farmer || 0 },
              { id: 'weather', label: 'हवामान अंदाज', emoji: '🌦️', count: categoryCounts.weather || 0 },
              { id: 'market', label: 'बाजारभाव', emoji: '💰', count: categoryCounts.market || 0 },
              { id: 'student', label: 'विद्यार्थी व भरती', emoji: '🎓', count: categoryCounts.student || 0 },
              { id: 'gov', label: 'शासकीय निर्णय', emoji: '🏛️', count: categoryCounts.gov || 0 },
            ].map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id as NewsCategoryFilter)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-amber-300 shadow-md ring-2 ring-amber-400/50'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  {cat.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        active ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Controls: Filter Toggle (Unseen vs All) + Search */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Unseen vs All Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterMode('unseen')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === 'unseen'
                    ? 'bg-white text-emerald-900 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="फक्त अद्याप न वाचलेल्या ताज्या बातम्या दाखवा"
              >
                फक्त न वाचलेल्या ({unseenTotalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="सर्व बातम्या दाखवा"
              >
                सर्व ({headlines.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('बातम्या शोधा (विमा, भरती, कापूस...)', 'Search news...')}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. News Grid */}
      {loading ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {t('थेट गुगलवरून ताज्या शेतकरी, हवामान व विद्यार्थी बातम्या मिळवत आहोत...', 'Fetching live Maharashtra news from Google Search...')}
          </p>
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            {filterMode === 'unseen'
              ? t('सर्व चालू बातम्या तुमच्या वाचून झाल्या आहेत! ✓', 'You have read all available news in this batch! ✓')
              : t('कोणतीही बातमी सापडली नाही.', 'No news found.')}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {filterMode === 'unseen'
              ? t(
                  'पुढील नवीन ताज्या बातम्या पाहण्यासाठी खालील "पुढील नवीन बातम्या (रीलोड)" बटणावर क्लिक करा किंवा वाचलेल्या बातम्या पूर्ववत करा.',
                  'Click Load Next Fresh News to load new updates, or reset read history to review earlier articles.'
                )
              : t('कृपया शोध शब्द बदलून पहा किंवा सर्व वर्गवारी निवडा.', 'Please try another search keyword.')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void fetchNews(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
            >
              🔄 पुढील नवीन बातम्या रीलोड करा
            </button>

            {seenIds.size > 0 && (
              <button
                type="button"
                onClick={handleResetHistory}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                वाचलेल्या बातम्या पूर्ववत करा
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              सर्व बातम्या दाखवा
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredNews.map((item, idx) => {
            const theme = getCategoryTheme(item.category);
            const CategoryIcon = theme.icon;
            const key = item.id || `news-${idx}`;
            const isCopied = copiedId === key;
            const isRead = seenIds.has(item.id || normalizeTitleKey(item.title));
            const shareUrl = getWhatsAppShareUrl(item);

            return (
              <article
                key={key}
                className={`rounded-3xl bg-white border border-slate-200/90 shadow-md hover:shadow-xl transition-all duration-300 p-5 sm:p-6 flex flex-col justify-between border-l-4 ${theme.accentBorder} group relative ${
                  isRead ? 'opacity-75 bg-slate-50/60' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Category & Date Strip + Dismiss Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border ${theme.badgeBg}`}
                    >
                      <CategoryIcon className="w-3.5 h-3.5" />
                      <span>{item.categoryLabelMr || theme.label}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`} />
                        <span>{item.dateLabel || 'आजची बातमी'}</span>
                      </span>

                      {/* "वाचली ✓ (लपवा)" Action */}
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(item)}
                        title={t('ही बातमी वाचली (लपवा आणि रीलोडवर पुन्हा दाखवू नका)', 'Mark as read & hide')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3 h-3 text-slate-500" />
                        <span>वाचली</span>
                      </button>
                    </div>
                  </div>

                  {/* Headline */}
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight group-hover:text-emerald-800 transition-colors">
                    {item.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.summary}</p>

                  {/* Bullet Highlights */}
                  {item.bullets && item.bullets.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-black text-slate-700 mb-1.5 flex items-center gap-1">
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>महत्त्वाचे मुद्दे:</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {item.bullets.map((b, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                  {/* Source link */}
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.sourceTitle || 'मूळ बातमी स्रोत पहा'}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline max-w-[200px] truncate"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.sourceTitle || 'मूळ बातमी स्रोत'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">अधिकृत वार्ता स्रोत</span>
                  )}

                  {/* Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => void handleCopyNews(item, idx)}
                      title={t('बातमी तपशील कॉपी करा', 'Copy news summary')}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      aria-label={t('कॉपी', 'Copy')}
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>

                    {/* WhatsApp Share Button */}
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('ही बातमी WhatsApp वर शेअर करा', 'Share this news on WhatsApp')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black shadow-sm shadow-emerald-950/20 transition-all hover:scale-105 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                        <path
                          d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z"
                          fill="white"
                        />
                      </svg>
                      <span>{t('WhatsApp शेअर', 'Share')}</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 4. Verified Sources Strip */}
      {sources.length > 0 && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 text-slate-300 p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs sm:text-sm font-black text-white">
                {t('गुगल सर्च ग्राउंडिंगने संदर्भित केलेली अधिकृत संकेतस्थळे', 'Official Portals Verified via Google Search Grounding')}
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {sources.length} Verified Sources
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {sources.map((src, sIdx) => (
              <a
                key={sIdx}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 transition-colors"
              >
                <span className="truncate max-w-[240px]">{src.title}</span>
                <ExternalLink className="w-3 h-3 text-amber-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 5. Essential Portals Quick Navigation */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border border-emerald-200 p-5 sm:p-6 space-y-3">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>{t('शेतकरी व विद्यार्थ्यांसाठी थेट उपयुक्त शासकीय पोर्टल्स', 'Direct Useful Portals for Farmers & Students')}</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {[
            { name: 'PMFBY पीक विमा', url: 'https://pmfby.gov.in', tab: 'pmfby-calc' as AppTab },
            { name: 'MahaDBT शिष्यवृत्ती', url: 'https://mahadbt.maharashtra.gov.in', tab: undefined },
            { name: 'महा कृषी विभाग', url: 'https://krishi.maharashtra.gov.in', tab: undefined },
            { name: 'IMD हवामान रडार', url: 'https://mausam.imd.gov.in', tab: undefined },
            { name: 'APMC बाजारभाव', url: 'https://www.msamb.com', tab: undefined },
            { name: 'महा शासन निर्णय GR', url: 'https://gr.maharashtra.gov.in', tab: 'gr' as AppTab },
          ].map((portal, pIdx) => (
            <div key={pIdx}>
              {portal.tab && onNavigateTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab(portal.tab!)}
                  className="w-full text-center p-2.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-slate-800 hover:text-emerald-950 shadow-sm transition-all cursor-pointer truncate"
                >
                  {portal.name}
                </button>
              ) : (
                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center p-2.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-slate-800 hover:text-emerald-950 shadow-sm transition-all truncate"
                >
                  {portal.name} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

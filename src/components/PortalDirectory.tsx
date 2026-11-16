import React, { useState } from 'react';
import { PORTAL_LINKS } from '../data/portalLinks';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { buildWhatsAppShareUrl } from '../utils/shareConfig';
import { sanitizeExternalUrl } from '../utils/pdfSecurity';
import {
  ExternalLink,
  Search,
  Globe,
  FileText,
  Building2,
  GraduationCap,
  HeartHandshake,
  CreditCard,
  FileCheck,
  Users,
  ShieldCheck,
  Zap,
  Briefcase,
  Share2
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-5 h-5 text-emerald-600" />,
  Building2: <Building2 className="w-5 h-5 text-indigo-600" />,
  GraduationCap: <GraduationCap className="w-5 h-5 text-amber-600" />,
  HeartHandshake: <HeartHandshake className="w-5 h-5 text-rose-600" />,
  CreditCard: <CreditCard className="w-5 h-5 text-sky-600" />,
  FileCheck: <FileCheck className="w-5 h-5 text-teal-600" />,
  Users: <Users className="w-5 h-5 text-purple-600" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
  Zap: <Zap className="w-5 h-5 text-amber-500" />,
  Briefcase: <Briefcase className="w-5 h-5 text-blue-600" />
};

export const PortalDirectory: React.FC = () => {
  const { lang, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categoryPairs = Array.from(
    new Map(PORTAL_LINKS.map((p) => [p.category, p.categoryEn])).entries()
  );

  const filteredLinks = PORTAL_LINKS.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.marathiName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.descriptionEn.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
            <Globe className="w-3.5 h-3.5" />
            <span>{t('महा कॉर्नर • अधिकृत पोर्टल्स डिरेक्टरी', 'MAHA CORNER • Official Portals Directory')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            {t('🌐 अधिकृत शासकीय ई-सेवा डिरेक्टरी', '🌐 Official Govt e-Service Portals')}
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            {t(
              'महा ई-सेवा केंद्र व सायबर कॅफे चालकांसाठी आवश्यक असणाऱ्या सर्व शासकीय वेबसाइट्सच्या थेट अधिकृत लिंक्स एकाच ठिकाणी उपलब्ध.',
              'Direct verified links to all essential Maharashtra & Central Government portals for citizens, CSC & Maha e-Seva operators.'
            )}
          </p>
        </div>

        <div className="shrink-0 hidden sm:block">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-500 p-0.5 shadow-xl shadow-cyan-500/25">
            <img
              src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
              alt="MAHA CORNER - Since 2018"
              className="w-full h-full object-cover rounded-full bg-[#020817] shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'पोर्टलचे नाव, योजना किंवा सेवेचे नाव शोधा (उदा. 7/12, लाडकी बहीण, पॅन...)',
              'Search portal, scheme or service (e.g., 7/12, Ladki Bahin, PAN, Aadhaar...)'
            )}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-amber-400 shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {t('सर्व', 'All')}
          </button>
          {categoryPairs.map(([catMr, catEn]) => (
            <button
              key={catMr}
              type="button"
              onClick={() => setSelectedCategory(catMr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === catMr
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {lang === 'en' ? catEn : catMr}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLinks.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-amber-400 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  {ICON_MAP[item.iconName] || <Globe className="w-5 h-5 text-slate-600" />}
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {lang === 'en' ? item.badgeEn || item.badge : item.badge}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {lang === 'en' ? item.categoryEn : item.category}
                </span>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-800 transition-colors mt-0.5">
                  {lang === 'en' ? item.name : item.marathiName}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  {lang === 'en' ? item.descriptionEn : item.description}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center gap-2">
              <a
                href={sanitizeExternalUrl(item.url, '#')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFeatureAction('portals')}
                className="inline-flex items-center justify-center gap-1.5 flex-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-amber-500 group-hover:bg-amber-500 text-slate-700 hover:text-slate-950 group-hover:text-slate-950 text-xs font-bold transition-all shadow-sm"
              >
                <span>{t('पोर्टल उघडा', 'Open Portal')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={buildWhatsAppShareUrl(
                  `🌐 *${lang === 'en' ? item.name : item.marathiName}*\n📌 ${lang === 'en' ? item.descriptionEn : item.description}\n\n🔗 *अधिकृत लिंक:* ${item.url}`,
                  lang
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFeatureAction('portals')}
                title={t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t('शेअर', 'Share')}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { ChevronRight, Share2, BellRing, ShoppingBag } from 'lucide-react';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getPortalInviteShareUrl } from '../utils/shareConfig';

interface FooterProps {
  currentTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  onOpenSubscribe?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  currentTab,
  onTabChange,
  onOpenSubscribe,
}) => {
  const { lang, t } = useLanguage();

  const handleNavigate = (tab: AppTab) => {
    if (onTabChange) {
      onTabChange(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const infoLinks: { tab: AppTab; labelMr: string; labelEn: string }[] = [
    { tab: 'store', labelMr: '🛍️ CSC साहित्य स्टोअर (Amazon Deals)', labelEn: '🛍️ CSC Store & Hardware' },
    { tab: 'about', labelMr: 'माझ्याबद्दल (About Me)', labelEn: 'About Me' },
    { tab: 'privacy', labelMr: 'गोपनीयता धोरण (Privacy Policy)', labelEn: 'Privacy Policy' },
    { tab: 'terms', labelMr: 'अटी व शर्ती (Terms & Conditions)', labelEn: 'Terms & Conditions' },
    { tab: 'disclaimer', labelMr: 'अस्वीकरण (Disclaimer)', labelEn: 'Disclaimer' },
    { tab: 'contact', labelMr: 'संपर्क करा (Contact Us)', labelEn: 'Contact Us' },
  ];

  return (
    <footer className="mt-12 bg-slate-900 border-t border-slate-800 text-slate-400">
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-500/80 via-orange-500/80 to-amber-400/80" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-6">
        {/* Top Row: Brand & Share / Follow Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-500 p-0.5 shadow-md shadow-cyan-500/25 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
                alt="MAHA CORNER - Since 2018"
                className="w-full h-full object-cover rounded-full bg-[#020817]"
              />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">
                {t('महा', 'MAHA')} <span className="text-amber-400">{t('कॉर्नर', 'CORNER')}</span>
              </h2>
              <p className="text-xs text-amber-300/90 font-medium">
                {t('माहिती अशी, जी कामी येईल!', 'Information That Truly Matters!')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs">
            <button
              type="button"
              onClick={() => handleNavigate('store')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold transition-colors shadow-sm cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('🛍️ CSC साहित्य स्टोअर', '🛍️ CSC Store')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('bulk-card')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold transition-colors shadow-sm cursor-pointer"
            >
              <span>🗂️ {t('बल्क PVC प्रिंटर', 'Bulk PVC Maker')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('vip-posters')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black transition-colors shadow-sm cursor-pointer"
            >
              <span>👑 {t('VIP पोस्टर्स', 'VIP Posters')}</span>
            </button>

            {onOpenSubscribe && (
              <button
                type="button"
                onClick={onOpenSubscribe}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-colors shadow-sm cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>{t('फॉलो / सबस्क्राईब करा', 'Follow & Subscribe')}</span>
              </button>
            )}

            <a
              href={getPortalInviteShareUrl(lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}</span>
            </a>
          </div>
        </div>

        {/* Bottom Section matching reference bar: Important Information (5 Pages) */}
        <div className="pt-5 border-t border-slate-800/90 space-y-5">
          <h3 className="text-xs sm:text-sm font-black tracking-wide uppercase text-amber-400 text-center sm:text-left">
            महत्त्वाची माहिती • IMPORTANT INFORMATION
          </h3>

          <nav
            aria-label="Important Information"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-bold"
          >
            {infoLinks.map((item) => {
              const isActive = currentTab === item.tab;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => handleNavigate(item.tab)}
                  className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-amber-400 underline underline-offset-4 decoration-amber-400'
                      : 'text-slate-200 hover:text-amber-300'
                  }`}
                >
                  <span>{t(item.labelMr, item.labelEn)}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`}
                  />
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-800/90 text-center space-y-1.5 text-xs">
            <p className="text-slate-300 font-bold flex items-center justify-center gap-1.5">
              <span>अधिकृत डोमेन:</span>
              <a
                href="https://mahacorner.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 font-mono font-black underline underline-offset-2"
              >
                mahacorner.in
              </a>
            </p>
            <p className="text-slate-400">
              {t('© २०२६ महा कॉर्नर • सर्व हक्क सुरक्षित.', '© 2026 MAHA CORNER • All Rights Reserved.')}
            </p>
            <p className="text-slate-500 text-[11px] sm:text-xs">
              {t(
                'स्वतंत्र डिजिटल माहिती व सेवा पोर्टल (अधिकृत सरकारी वेबसाईट नाही)',
                'Independent Digital Information & Services Portal (Not an Official Government Website)'
              )}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

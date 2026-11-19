import React, { useState } from 'react';
import { Globe, Copy, Check, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getPageShareDetails,
  getWebsiteShareDetails,
  PAGE_SHARE_CONFIG,
} from '../utils/shareConfig';

interface FloatingShareBarProps {
  currentTab: AppTab;
  onOpenMoreShare?: () => void;
}

export const FloatingShareBar: React.FC<FloatingShareBarProps> = ({
  currentTab,
  onOpenMoreShare,
}) => {
  const { lang, t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const pageShare = getPageShareDetails(currentTab, lang);
  const websiteShare = getWebsiteShareDetails(lang);
  const pageMeta = PAGE_SHARE_CONFIG[currentTab] || PAGE_SHARE_CONFIG['ai-poster'];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageShare.url);
      setCopied(true);
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.85 } });
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <aside
      aria-label={t('जलद शेअर पट्टी', 'Quick Share Dock')}
      className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-full bg-slate-950/90 backdrop-blur-md border border-amber-500/40 shadow-2xl shadow-black/60 select-none animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      {/* 1. Direct WhatsApp Share for Current Page (Exact PmfbyCalculator Style) */}
      <a
        href={pageShare.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t(
          `फक्त हे ${lang === 'en' ? pageMeta.nameEn : pageMeta.nameMr} पेज WhatsApp वर शेअर करा`,
          `Share this exact page directly on WhatsApp`
        )}
        className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
      >
        <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
        </svg>
        <span className="hidden xs:inline">{t('📲 WhatsApp शेअर', '📲 WhatsApp Share')}</span>
        <span className="xs:hidden">{t('📲 शेअर', '📲 Share')}</span>
      </a>

      {/* 2. Direct WhatsApp Share for Entire Website */}
      <a
        href={websiteShare.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t('संपूर्ण महा कॉर्नर पोर्टल WhatsApp वर शेअर करा', 'Share full website portal on WhatsApp')}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-950/30 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
      >
        <Globe className="w-3.5 h-3.5 text-slate-950 shrink-0" />
        <span className="hidden sm:inline">{t('🌐 सर्व वेबसाईट', '🌐 Full Site')}</span>
        <span className="sm:hidden">{t('सर्व', 'All')}</span>
      </a>

      {/* 3. 1-Click Link Copy */}
      <button
        type="button"
        onClick={handleCopyLink}
        title={t('या पेजची लिंक कॉपी करा', 'Copy this page link')}
        className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
        aria-label={t('लिंक कॉपी करा', 'Copy Link')}
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4 text-amber-300" />
        )}
      </button>

      {/* 4. More Options */}
      {onOpenMoreShare && (
        <button
          type="button"
          onClick={onOpenMoreShare}
          title={t('अधिक शेअर पर्याय', 'More Share Options')}
          className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 hidden md:block"
          aria-label={t('अधिक पर्याय', 'More options')}
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
        </button>
      )}
    </aside>
  );
};

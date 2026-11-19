import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Globe,
  FileText,
  Smartphone,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getPageShareDetails,
  getWebsiteShareDetails,
  shareNativeOrCopy,
  PAGE_SHARE_CONFIG,
} from '../utils/shareConfig';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: AppTab;
  initialMode?: 'page' | 'website';
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  currentTab,
  initialMode = 'page',
}) => {
  const { lang, t } = useLanguage();
  const [activeMode, setActiveMode] = useState<'page' | 'website'>(initialMode);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);

  if (!isOpen) return null;

  const pageData = getPageShareDetails(currentTab, lang);
  const websiteData = getWebsiteShareDetails(lang);
  const currentData = activeMode === 'page' ? pageData : websiteData;
  const pageMeta = PAGE_SHARE_CONFIG[currentTab] || PAGE_SHARE_CONFIG['ai-poster'];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentData.url);
      setCopiedLink(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const handleCopyFullMessage = async () => {
    try {
      await navigator.clipboard.writeText(currentData.message);
      setCopiedMessage(true);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    const result = await shareNativeOrCopy({
      title: currentData.title,
      text: currentData.message,
      url: currentData.url,
    });
    if (result === 'copied') {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
                <span>{t('शेअर पर्याय', 'Share Options')}</span>
                <span className="text-xs font-bold text-emerald-600">· Maha Corner</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('फक्त हे पेज किंवा संपूर्ण वेबसाईट १-क्लिकमध्ये शेअर करा', 'Share this exact page or full portal')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label={t('बंद करा', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Mode Tabs: Page vs Full Website */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveMode('page')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'page'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">
              {t(`📌 हेच पेज (${lang === 'en' ? pageMeta.nameEn : pageMeta.nameMr})`, `📌 This Page`)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('website')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'website'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="truncate">
              {t('🌐 संपूर्ण वेबसाईट (Full Website)', '🌐 Full Website')}
            </span>
          </button>
        </div>

        {/* Selected Share Card Summary */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border border-emerald-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
              {activeMode === 'page'
                ? t('फक्त या पेजची थेट लिंक', 'Direct Page Deep Link')
                : t('संपूर्ण वेबसाईट लिंक', 'Full Website Portal')}
            </span>
            <span className="text-[11px] font-mono text-emerald-800 font-bold truncate max-w-[220px]">
              {currentData.url}
            </span>
          </div>

          <h4 className="font-black text-slate-900 text-sm leading-snug">
            {currentData.title}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            {currentData.subtitle}
          </p>

          {/* Quick Copy Link Box */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentData.url}
              className="flex-1 h-9 px-3 rounded-xl bg-white border border-emerald-300 font-mono text-[11px] text-slate-700 select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? t('कॉपी झाली! ✓', 'Copied! ✓') : t('लिंक कॉपी करा', 'Copy Link')}</span>
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <a
            href={currentData.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-sm shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01]"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
            </svg>
            <span>
              {activeMode === 'page'
                ? t('📲 हे पेज WhatsApp वर पाठवा', 'Share This Page on WhatsApp')
                : t('📲 संपूर्ण वेबसाईट WhatsApp वर पाठवा', 'Share Full Website on WhatsApp')}
            </span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span>{t('इतर ॲप्स (Share via Apps)', 'Share via Apps')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFullMessage}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            >
              {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMessage ? t('मजकूर कॉपी झाला! ✓', 'Message Copied!') : t('संपूर्ण मजकूर कॉपी करा', 'Copy Full Text')}</span>
            </button>
          </div>
        </div>

        {/* Message Preview Collapsible */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">
            {t('मजकूर पूर्वावलोकन (Preview of message being sent):', 'Message Preview:')}
          </span>
          <pre className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
            {currentData.message}
          </pre>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PhoneCall, MessageCircle, ExternalLink, Lock } from 'lucide-react';
import defaultAdBanner from '../assets/images/maha_corner_ad_banner_1795067655391.jpg';
import {
  SiteAdRecord,
  DEFAULT_AD_PHONE,
  DEFAULT_AD_TITLE,
  DEFAULT_AD_DESCRIPTION,
  DEFAULT_AD_LINK,
} from '../utils/firebaseSiteAds';

interface MahaCornerPopupAdProps {
  activeAd?: SiteAdRecord | null;
  previewSignal?: number;
  onOpenAdUpload?: () => void;
}

export function MahaCornerPopupAd({
  activeAd,
  previewSignal = 0,
  onOpenAdUpload,
}: MahaCornerPopupAdProps) {
  const [showAd, setShowAd] = useState(true);

  useEffect(() => {
    if (previewSignal > 0) {
      setShowAd(true);
    }
  }, [previewSignal]);

  const closeAd = () => {
    setShowAd(false);
  };

  useEffect(() => {
    if (!showAd) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAd(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAd]);

  if (!showAd) return null;

  const title = activeAd?.title?.trim() || DEFAULT_AD_TITLE;
  const description = activeAd?.description?.trim() || DEFAULT_AD_DESCRIPTION;
  const imageSrc = activeAd?.imageUrl || defaultAdBanner;
  const linkUrl = activeAd?.linkUrl?.trim() || DEFAULT_AD_LINK;
  const contactPhone = activeAd?.contactPhone?.trim() || DEFAULT_AD_PHONE;
  const cleanDigits = contactPhone.replace(/[^0-9]/g, '').slice(-10) || DEFAULT_AD_PHONE;

  const waMessage = encodeURIComponent(
    'नमस्कार! मला महा कॉर्नर (mahacorner.in) वर माझ्या व्यवसायाची जाहिरात द्यायची आहे. कृपया माहिती द्या.'
  );

  return (
    <div
      className="maha-popup-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs font-['Noto_Sans_Devanagari',sans-serif]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maha-popup-ad-title"
      onClick={closeAd}
    >
      <div
        className="maha-popup relative w-full max-w-md rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-sky-950 to-slate-950 border border-amber-400/50 text-white shadow-2xl animate-splash-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Golden Brand Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />

        {/* Close Button */}
        <button
          type="button"
          className="maha-popup-close absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-slate-900/90 hover:bg-amber-400 text-amber-200 hover:text-slate-950 border border-amber-400/40 flex items-center justify-center text-2xl leading-none font-bold transition-colors cursor-pointer shadow-md"
          onClick={closeAd}
          aria-label="Close advertisement"
        >
          ×
        </button>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 pr-14">
          <h3
            id="maha-popup-ad-title"
            className="text-base sm:text-lg font-black tracking-tight text-amber-300"
          >
            {title}
          </h3>
        </div>

        {/* Clickable Advertisement Image */}
        <div className="px-4">
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-amber-400/30 shadow-lg group bg-slate-900"
          >
            <img
              src={imageSrc}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-72 object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </a>
        </div>

        {/* Copy & Quick Contact Actions */}
        <div className="px-5 pt-4 pb-5 space-y-3.5 text-center">
          <p className="text-sm sm:text-base font-bold text-amber-50 leading-relaxed">
            {description}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`tel:+91${cleanDigits}`}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all"
            >
              <PhoneCall className="w-4 h-4 shrink-0" />
              <span className="font-mono">{contactPhone}</span>
            </a>

            <a
              href={`https://wa.me/91${cleanDigits}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-md transition-all"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>WhatsApp करा</span>
            </a>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-amber-300/90 hover:text-amber-200 transition-colors truncate max-w-[55%]"
            >
              <span className="truncate">{linkUrl.replace(/^https?:\/\//i, '')}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>

            {onOpenAdUpload && (
              <button
                type="button"
                onClick={() => {
                  closeAd();
                  onOpenAdUpload();
                }}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-amber-300 font-bold transition-colors cursor-pointer shrink-0"
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>जाहिरात अपलोड</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MahaCornerPopupAd;

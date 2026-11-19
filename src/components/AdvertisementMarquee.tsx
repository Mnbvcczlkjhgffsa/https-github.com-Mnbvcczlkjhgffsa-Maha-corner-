import React, { useState } from 'react';
import { Megaphone, PhoneCall, Lock } from 'lucide-react';
import {
  SiteAdRecord,
  DEFAULT_AD_PHONE,
  DEFAULT_MARQUEE_TEXT,
} from '../utils/firebaseSiteAds';

interface AdvertisementMarqueeProps {
  onContactClick?: () => void;
  onOpenAdUpload?: () => void;
  activeAd?: SiteAdRecord | null;
}

export const AdvertisementMarquee: React.FC<AdvertisementMarqueeProps> = ({
  onContactClick,
  onOpenAdUpload,
  activeAd,
}) => {
  const [isTouchPaused, setIsTouchPaused] = useState(false);

  const contactPhone = activeAd?.contactPhone?.trim() || DEFAULT_AD_PHONE;
  const marqueeText = activeAd?.marqueeText?.trim() || DEFAULT_MARQUEE_TEXT;

  return (
    <div
      role="region"
      aria-label="महा कॉर्नर जाहिरात पट्टी"
      data-paused={isTouchPaused ? 'true' : 'false'}
      onTouchStart={() => setIsTouchPaused(true)}
      onTouchEnd={() => setIsTouchPaused(false)}
      onTouchCancel={() => setIsTouchPaused(false)}
      className="maha-ad-marquee-wrapper relative w-full overflow-hidden bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950 border-b border-amber-500/45 text-white select-none font-['Noto_Sans_Devanagari',sans-serif] z-50"
    >
      {/* Subtle top golden accent hairline matching Maha Corner brand */}
      <div className="h-[2px] w-full bg-gradient-to-r from-amber-500/30 via-amber-400 to-orange-500/40" />

      <div className="max-w-[1600px] mx-auto flex items-center h-10 sm:h-11">
        {/* Left Branded Badge */}
        <div className="relative z-10 shrink-0 h-full flex items-center gap-1.5 pl-3 pr-3 sm:pl-4 sm:pr-4 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 font-black text-[11px] sm:text-xs tracking-wide shadow-md">
          <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="whitespace-nowrap">जाहिरात</span>
        </div>

        {/* Continuous Smooth Right-to-Left Scrolling Area */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          {/* Soft Edge Fade Overlays */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-5 sm:w-8 bg-gradient-to-r from-slate-950 to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-5 sm:w-8 bg-gradient-to-l from-slate-950 to-transparent z-10" />

          <div className="maha-ad-marquee-track items-center">
            <div className="flex items-center shrink-0">
              <span className="text-xs sm:text-sm font-bold text-amber-50 tracking-[0.01em] whitespace-nowrap px-6 sm:px-10">
                {marqueeText}
              </span>
              <span
                aria-hidden="true"
                className="text-amber-400/90 text-xs font-black px-2"
              >
                ✦
              </span>
            </div>

            <div className="flex items-center shrink-0" aria-hidden="true">
              <span className="text-xs sm:text-sm font-bold text-amber-50 tracking-[0.01em] whitespace-nowrap px-6 sm:px-10">
                {marqueeText}
              </span>
              <span className="text-amber-400/90 text-xs font-black px-2">
                ✦
              </span>
            </div>
          </div>
        </div>

        {/* Right Quick Call, Contact & Owner-Locked Ad Upload */}
        <div className="relative z-10 shrink-0 h-full flex items-center">
          <a
            href={`tel:+91${contactPhone.replace(/[^0-9]/g, '').slice(-10)}`}
            className="h-full flex items-center gap-1.5 px-2.5 sm:px-3.5 bg-slate-900/95 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-l border-amber-500/35 text-[11px] sm:text-xs font-black font-mono tracking-wide transition-colors"
            title={`जाहिरातीसाठी कॉल करा: ${contactPhone}`}
          >
            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{contactPhone}</span>
          </a>
          {onContactClick && (
            <button
              type="button"
              onClick={onContactClick}
              className="hidden md:flex h-full items-center px-3 bg-amber-500/15 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border-l border-amber-500/35 text-xs font-black transition-colors cursor-pointer"
              title="जाहिरातीसाठी संपर्क पेज उघडा"
            >
              <span className="whitespace-nowrap">संपर्क साधा</span>
            </button>
          )}
          {onOpenAdUpload && (
            <button
              type="button"
              onClick={onOpenAdUpload}
              className="h-full flex items-center gap-1 px-2.5 sm:px-3 bg-slate-950 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border-l border-amber-500/35 text-[11px] font-black transition-colors cursor-pointer"
              title="नवीन जाहिरात अपलोड करा (Owner Lock)"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">जाहिरात अपलोड</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

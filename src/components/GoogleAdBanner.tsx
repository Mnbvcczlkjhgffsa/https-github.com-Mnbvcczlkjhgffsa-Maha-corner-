import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Settings2, Check, X, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const STORAGE_KEY_CLIENT = 'maha_adsense_client';
const STORAGE_KEY_SLOT = 'maha_adsense_slot';
const DEFAULT_CLIENT = 'ca-pub-7459802974561440';
const DEFAULT_SLOT = '756682336';

const formatPublisherId = (id: string): string => {
  const trimmed = id.trim();
  if (trimmed.startsWith('pub-')) {
    return `ca-${trimmed}`;
  }
  if (!trimmed.startsWith('ca-pub-') && /^\d+$/.test(trimmed)) {
    return `ca-pub-${trimmed}`;
  }
  return trimmed;
};

interface GoogleAdBannerProps {
  slotId?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
  label?: string;
}

export const GoogleAdBanner: React.FC<GoogleAdBannerProps> = ({
  slotId = DEFAULT_SLOT,
  format = 'auto',
  className = '',
  label = 'जाहिरात (Advertisement)',
}) => {
  const [client, setClient] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CLIENT);
      if (stored && stored !== 'ca-pub-4346549198252153') {
        return formatPublisherId(stored);
      }
      return DEFAULT_CLIENT;
    } catch {
      return DEFAULT_CLIENT;
    }
  });

  const [activeSlot, setActiveSlot] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SLOT);
      if (stored && stored !== '6661179332') {
        return stored;
      }
      return slotId || DEFAULT_SLOT;
    } catch {
      return slotId || DEFAULT_SLOT;
    }
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempClient, setTempClient] = useState(client);
  const [tempSlot, setTempSlot] = useState(activeSlot);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);
  const adRef = useRef<HTMLModElement | null>(null);

  const isRealClient = Boolean(client) && client.startsWith('ca-pub-') && client.length > 12;

  useEffect(() => {
    if (!isRealClient) {
      setAdLoaded(false);
      return;
    }

    try {
      if (typeof window !== 'undefined' && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setAdLoaded(true);
      }
    } catch (err) {
      setAdError(true);
    }
  }, [client, activeSlot, isRealClient]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClient = formatPublisherId(tempClient) || DEFAULT_CLIENT;
    const cleanSlot = tempSlot.trim() || DEFAULT_SLOT;
    setClient(cleanClient);
    setActiveSlot(cleanSlot);
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT, cleanClient);
      localStorage.setItem(STORAGE_KEY_SLOT, cleanSlot);
    } catch {}
    setIsConfigOpen(false);
  };

  return (
    <div
      className={`relative w-full my-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 shadow-xs overflow-hidden ${className}`}
    >
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/70 border-b border-slate-200/60 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{label}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
            Google AdSense
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setTempClient(client);
            setTempSlot(activeSlot);
            setIsConfigOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-200/70 text-slate-600 text-[10px] font-bold transition-colors cursor-pointer"
          title="AdSense Publisher ID सेट करा"
        >
          <Settings2 className="w-3 h-3 text-slate-500" />
          <span>{isRealClient ? 'Ad ID बदल करा' : 'AdSense ID जोडा'}</span>
        </button>
      </div>

      {/* Configuration Modal / Popover */}
      {isConfigOpen && (
        <form
          onSubmit={handleSaveConfig}
          className="p-3.5 bg-amber-50/80 border-b border-amber-200 text-xs text-slate-800 space-y-2.5 animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-black text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Google AdSense खात्याचे तपशील जोडा</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="p-0.5 rounded hover:bg-amber-200 text-amber-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-amber-900/90 leading-relaxed">
            तुमच्या Google AdSense खात्यातून मिळणारा <strong>Publisher ID (उदा. ca-pub-xxxxxxxxxxxxxxxx)</strong> आणि{' '}
            <strong>Ad Slot ID</strong> येथे टाका. सेव्ह करताच वेबसाइटवर तुमच्या जाहिराती सुरू होतील.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                AdSense Publisher ID:
              </label>
              <input
                type="text"
                value={tempClient}
                onChange={(e) => setTempClient(e.target.value)}
                placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                className="w-full h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Ad Unit Slot ID:
              </label>
              <input
                type="text"
                value={tempSlot}
                onChange={(e) => setTempSlot(e.target.value)}
                placeholder="1234567890"
                className="w-full h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href="https://www.google.com/adsense"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline"
            >
              <span>AdSense खात्यावर जा</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 font-bold text-[11px] hover:bg-slate-50 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>सेव्ह करा</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Ad Area */}
      <div className="p-3 flex items-center justify-center min-h-[90px] sm:min-h-[100px] text-center">
        {isRealClient && !adError ? (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client={client}
            data-ad-slot={activeSlot}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        ) : (
          <div className="py-2 px-4 max-w-lg mx-auto flex flex-col items-center justify-center gap-1.5 text-slate-500">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200/70 text-[11px] font-bold text-slate-700">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Google Ads जागा (728x90 / Responsive Slot)</span>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              येथे तुमची <strong>Google AdSense जाहिरात</strong> दिसेल.
            </p>
            <p className="text-[11px] text-slate-400">
              तुमचा AdSense कोड जोडण्यासाठी वरील <strong>'AdSense ID जोडा'</strong> बटणावर क्लिक करा.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

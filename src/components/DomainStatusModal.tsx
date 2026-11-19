import React, { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  X,
  FileText
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DomainStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DomainStatusModal: React.FC<DomainStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const cnameTarget = 'ais-pre-u5zuu6hzzwk3bgbikyzoim-858805629437.asia-northeast1.run.app';
  const adsenseMeta = '<meta name="google-adsense-account" content="ca-pub-7459802974561440">';
  const adsTxtLine = 'google.com, pub-7459802974561440, DIRECT, f08c47fec0942fa0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white px-5 py-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-1.5">
                <span>mahacorner.in</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {t('सक्रिय अधिकृत डोमेन', 'Active Official Domain')}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                {t('डोमेन कनेक्शन व Google AdSense स्थिती', 'Domain DNS & Google AdSense Setup')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Active Domain Overview */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-950 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>mahacorner.in ॲपमध्ये पूर्णपणे समाविष्ट आहे</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase">
                Active
              </span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              तुमचे <strong>mahacorner.in</strong> हे डोमेन हेडर, फुटर, सोशल शेअर, कॅनॉनिकल लिंक्स, गुगल ॲडसेन्स आणि साईटमॅपसह पूर्णपणे जोडलेले आहे.
            </p>
          </div>

          {/* Section 1: Google AdSense Account */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Google AdSense खात्याची पडताळणी</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  ca-pub-7459802974561440
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                  Slot: 756682336
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 block">
                Verification Meta Tag (वेबसाईटच्या &lt;head&gt; मध्ये जोडलेला):
              </span>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-800">
                <span className="truncate flex-1">{adsenseMeta}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(adsenseMeta, 'meta')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedKey === 'meta' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'meta' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 block">
                ads.txt फाईल (थेट सर्व्हरवर कार्यरत):
              </span>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-800">
                <span className="truncate flex-1">{adsTxtLine}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(adsTxtLine, 'adsTxt')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedKey === 'adsTxt' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'adsTxt' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href="/ads.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-sky-700 hover:bg-sky-50 font-bold"
              >
                <FileText className="w-3 h-3" />
                <span>ads.txt तपासा</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-sky-700 hover:bg-sky-50 font-bold"
              >
                <FileText className="w-3 h-3" />
                <span>sitemap.xml तपासा</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-sky-700 hover:bg-sky-50 font-bold"
              >
                <FileText className="w-3 h-3" />
                <span>robots.txt तपासा</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Section 2: DNS Connection Guide for GoDaddy / Hostinger / Cloudflare */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>डोमेन DNS जोडणी (GoDaddy / Hostinger / Namecheap)</span>
            </div>

            <p className="text-[11px] text-amber-900 leading-relaxed">
              तुमच्या डोमेन प्रोव्हायडरच्या DNS Management मध्ये खालील <strong>CNAME Record</strong> टाका:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-300">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Type</span>
                  <span className="font-mono font-bold text-slate-900">CNAME</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Host / Name</span>
                  <span className="font-mono font-bold text-slate-900">www (किंवा @)</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">TTL</span>
                  <span className="font-mono font-bold text-slate-900">Auto / 1 Hour</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-amber-300 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Points To / Target (खालील पत्ता कॉपी करा):
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-800 break-all select-all flex-1">
                    {cnameTarget}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cnameTarget, 'target')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'target' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'target' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dedicated GoDaddy Guide */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-300 text-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                  GoDaddy वरून mahacorner.in कसे जोडायचे:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white font-mono text-[10px] font-black">
                  GoDaddy
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                <p><strong>१.</strong> GoDaddy.com वर लॉगिन करा &rarr; <strong>My Products</strong> &rarr; <strong>mahacorner.in</strong> च्या <strong>DNS / Manage</strong> वर जा.</p>
                <p><strong>२.</strong> खाली स्क्रोल करून <strong>Forwarding</strong> विभागात जा &rarr; <strong>Add Forwarding</strong> वर क्लिक करा.</p>
                <p><strong>३.</strong> <strong>https://</strong> निवडा आणि खालील लिंक पेस्ट करा:</p>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-300 font-mono text-[11px]">
                  <span className="truncate flex-1 font-bold text-slate-900">{`https://${cnameTarget}`}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`https://${cnameTarget}`, 'godaddyUrl')}
                    className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'godaddyUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'godaddyUrl' ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
                <p><strong>४.</strong> Forward Type मध्ये <strong>"Forward with Masking"</strong> निवडा (याने ब्राऊझरमध्ये नाव mahacorner.in राहील) &rarr; <strong>Save</strong> वर क्लिक करा!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            {t('समजले, बंद करा', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

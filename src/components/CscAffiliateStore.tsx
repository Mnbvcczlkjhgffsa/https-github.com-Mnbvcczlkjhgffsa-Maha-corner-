import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Sparkles,
  ExternalLink,
  Search,
  Star,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Settings2,
  Check,
  X,
  Share2,
  Layers,
  HelpCircle,
  Zap,
  Info,
  Camera,
  Maximize2
} from 'lucide-react';
import { CSC_AFFILIATE_PRODUCTS, AffiliateProduct } from '../data/cscAffiliateProducts';
import { useLanguage } from '../contexts/LanguageContext';

const STORAGE_AMAZON_TAG = 'maha_amazon_associate_tag';
const STORAGE_FLIPKART_ID = 'maha_flipkart_affiliate_id';
const DEFAULT_AMAZON_TAG = 'mahacorner-21';
const DEFAULT_FLIPKART_ID = 'mahacorner';

export const CscAffiliateStore: React.FC = () => {
  const { lang, t } = useLanguage();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Owner Affiliate IDs
  const [amazonTag, setAmazonTag] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_AMAZON_TAG) || DEFAULT_AMAZON_TAG;
    } catch {
      return DEFAULT_AMAZON_TAG;
    }
  });

  const [flipkartId, setFlipkartId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_FLIPKART_ID) || DEFAULT_FLIPKART_ID;
    } catch {
      return DEFAULT_FLIPKART_ID;
    }
  });

  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [tempAmazonTag, setTempAmazonTag] = useState<string>(amazonTag);
  const [tempFlipkartId, setTempFlipkartId] = useState<string>(flipkartId);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [previewProduct, setPreviewProduct] = useState<AffiliateProduct | null>(null);

  const categories = [
    { id: 'all', labelMr: 'सर्व साहित्य (All)', icon: '🛍️' },
    { id: 'biometric', labelMr: 'बायोमेट्रिक स्कॅनर', icon: '🔍' },
    { id: 'pvc-lamination', labelMr: 'PVC कार्ड व लॅमिनेशन', icon: '🪪' },
    { id: 'paper-cutter', labelMr: 'प्रिंटिंग व पेपर कटर', icon: '📄' },
    { id: 'hardware', labelMr: 'कॉम्प्युटर व ॲक्सेसरीज', icon: '💻' },
  ];

  const filteredProducts = useMemo(() => {
    return CSC_AFFILIATE_PRODUCTS.filter((product) => {
      const matchCat = selectedCategory === 'all' || product.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        product.titleMr.toLowerCase().includes(q) ||
        product.titleEn.toLowerCase().includes(q) ||
        product.descMr.toLowerCase().includes(q) ||
        product.amazonSearchKeyword.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  const buildAmazonUrl = (product: AffiliateProduct) => {
    const cleanTag = amazonTag.trim() || DEFAULT_AMAZON_TAG;
    if (product.directAmazonAsin) {
      return `https://www.amazon.in/dp/${product.directAmazonAsin}?tag=${encodeURIComponent(cleanTag)}&linkCode=ll1`;
    }
    return `https://www.amazon.in/s?k=${encodeURIComponent(product.amazonSearchKeyword)}&tag=${encodeURIComponent(cleanTag)}&ref=as_li_ss_tl`;
  };

  const buildFlipkartUrl = (product: AffiliateProduct) => {
    const cleanAffId = flipkartId.trim() || DEFAULT_FLIPKART_ID;
    return `https://www.flipkart.com/search?q=${encodeURIComponent(product.flipkartSearchKeyword)}&affid=${encodeURIComponent(cleanAffId)}`;
  };

  const handleSaveAffiliateConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmazon = tempAmazonTag.trim() || DEFAULT_AMAZON_TAG;
    const cleanFlipkart = tempFlipkartId.trim() || DEFAULT_FLIPKART_ID;
    setAmazonTag(cleanAmazon);
    setFlipkartId(cleanFlipkart);
    try {
      localStorage.setItem(STORAGE_AMAZON_TAG, cleanAmazon);
      localStorage.setItem(STORAGE_FLIPKART_ID, cleanFlipkart);
    } catch {}
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsConfigOpen(false);
    }, 1500);
  };

  const shareProductOnWhatsApp = (product: AffiliateProduct) => {
    const amazonLink = buildAmazonUrl(product);
    const msg = `🛒 *महा कॉर्नर शिफारस केलेले CSC साहित्य:* \n\n👉 *${product.titleMr}*\n💰 अंदाजे किंमत: *${product.estimatedPrice}* (${product.discountBadge})\n\n🔗 Amazon वर थेट खरेदी करा:\n${amazonLink}\n\n🌐 अधिक साहित्यासाठी भेट द्या: https://mahacorner.in`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 text-white p-6 sm:p-8 border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('सीएससी केंद्र साहित्य व टूल्स स्टोअर', 'CSC Hardware & Equipment Deals')}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              {t('सीएससी, महा ई-सेवा व सायबर कॅफेसाठी', 'Official CSC & e-Seva Equipment')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">
                {t('आवश्यक साहित्य थेट Amazon व Flipkart वरून', 'Best Deals on Amazon & Flipkart')}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                'बायोमेट्रिक फिंगरप्रिंट स्कॅनर, PVC कार्ड प्रिंटिंग ट्रे, लॅमिनेशन मशीन, A4 फोटो पेपर व इतर साहित्य सर्वोत्तम डिस्काउंटसह व जलद डिलिव्हरीसह खरेदी करा.',
                'Get certified L1 biometric scanners, PVC trays, lamination machines, and photo glossy paper with genuine seller warranty.'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setTempAmazonTag(amazonTag);
                setTempFlipkartId(flipkartId);
                setIsConfigOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Settings2 className="w-4 h-4" />
              <span>{t('⚙️ माझा ॲफिलिएट कमिशन आयडी सेट करा', '⚙️ Set My Associate Tag')}</span>
            </button>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('थेट Amazon / Flipkart ओरिजिनल वॉरंटी', 'Genuine Warranty via Amazon / Flipkart')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIP Digital Products Promo Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-slate-950 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-amber-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
            <span className="text-xl">👑</span>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
              <span>{t('डिजिटल उत्पन्न: ५०+ व्हीआयपी पोस्टर पॅक्स (UPI द्वारे थेट १००% कमाई)', 'Digital Revenue: 50+ VIP Poster Packs (100% Direct UPI Earnings)')}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-slate-950 text-amber-300 text-[9px] font-black uppercase">
                DIRECT UPI
              </span>
            </h4>
            <p className="text-[11px] text-slate-900 font-semibold">
              {t('अल्ट्रा 4K प्रिंट क्वालिटी, वॉटरमार्क नसलेले ओरिजिनल डिझाईन्स व थेट बँक ट्रान्सफर.', '4K Ultra HD Print Quality, No Watermark, Instant Bank Transfer.')}
            </p>
          </div>
        </div>
        <a
          href="#vip"
          className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          {t('VIP पॅक पहा (फक्त ₹४९) →', 'View VIP Packs (From ₹49) →')}
        </a>
      </div>

      {/* Owner Commission Settings Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>{t('ॲमेझॉन व फ्लिपकार्ट कमिशन आयडी सेट करा', 'Setup Affiliate Commission Tag')}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              तुमच्या <strong>Amazon Associates</strong> खात्याचा Store ID (उदा. <code className="bg-slate-100 px-1 py-0.5 rounded text-amber-700 font-mono">mahacorner-21</code>) येथे टाका. सेव्ह करताच सर्व खरेदीचे कमिशन थेट तुमच्या खात्यात जमा होईल!
            </p>

            <form onSubmit={handleSaveAffiliateConfig} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Amazon Associate Store ID / Tag:
                </label>
                <input
                  type="text"
                  required
                  value={tempAmazonTag}
                  onChange={(e) => setTempAmazonTag(e.target.value)}
                  placeholder="e.g. mahacorner-21"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  जर तुमचे Amazon Associates खाते नसेल, तर{' '}
                  <a
                    href="https://affiliate-program.amazon.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 underline font-bold"
                  >
                    येथे मोफत खाते तयार करा &rarr;
                  </a>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Flipkart Affiliate ID (पर्यायी):
                </label>
                <input
                  type="text"
                  value={tempFlipkartId}
                  onChange={(e) => setTempFlipkartId(e.target.value)}
                  placeholder="e.g. mahacorner"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>तुमचा कमिशन आयडी यशस्वीरीत्या सेव्ह झाला!</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>सेव्ह करा (Apply ID)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real Product Full Photo Zoom Modal */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  १००% अस्सल उत्पादन छायाचित्र (Real Photo)
                </span>
                <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                  {previewProduct.categoryLabelMr}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-res Image Preview */}
            <div className="relative bg-slate-50 rounded-2xl p-4 flex items-center justify-center border border-slate-200/80 min-h-[260px] sm:min-h-[320px]">
              <img
                src={previewProduct.imageUrl}
                alt={previewProduct.titleMr}
                className="max-h-[300px] max-w-full object-contain drop-shadow-md rounded-xl"
              />
              <div className="absolute top-3 left-3 flex gap-1.5">
                <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-md">
                  {previewProduct.discountBadge}
                </span>
              </div>
            </div>

            {/* Product Title & Details */}
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {previewProduct.titleMr}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {previewProduct.titleEn}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {previewProduct.descMr}
              </p>

              {/* Key Specs */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                {previewProduct.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium truncate">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Price & Rating */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      {previewProduct.estimatedPrice}
                    </span>
                    <span className="text-sm text-slate-400 line-through">
                      {previewProduct.originalPrice}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-700 font-bold">
                    ओरिजिनल ब्रँडेड वॉरंटीसह थेट खरेदी
                  </span>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-amber-500 font-black text-sm">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{previewProduct.rating}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {previewProduct.reviewsCount} पुनरावलोकने
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <a
                href={buildAmazonUrl(previewProduct)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
              >
                <span>Amazon वर खरेदी करा</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={buildFlipkartUrl(previewProduct)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-sm shadow-md shadow-sky-600/20 transition-all hover:scale-[1.01]"
              >
                <span>Flipkart वर खरेदी करा</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Tabs & Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-amber-300 shadow-md shadow-slate-950/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.labelMr}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="साहित्य शोधा (Mantra, PVC, Lamination)..."
              className="w-full h-10 pl-9 pr-3 rounded-2xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((product) => {
          const amazonUrl = buildAmazonUrl(product);
          const flipkartUrl = buildFlipkartUrl(product);

          return (
            <div
              key={product.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
            >
              <div>
                {/* Image Header with 100% Real Photo Badge */}
                <div
                  className="relative h-52 w-full bg-slate-50 overflow-hidden cursor-pointer flex items-center justify-center p-3 border-b border-slate-100"
                  onClick={() => setPreviewProduct(product)}
                >
                  <img
                    src={product.imageUrl}
                    alt={product.titleMr}
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase shadow-md">
                      {product.discountBadge}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900/90 text-white text-[10px] font-bold backdrop-blur-xs border border-white/20">
                      {product.categoryLabelMr}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewProduct(product);
                      }}
                      title="मोठा फोटो पहा (Full Photo Preview)"
                      className="w-8 h-8 rounded-full bg-white/95 hover:bg-slate-900 hover:text-white text-slate-700 shadow-md flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`🛒 *महा कॉर्नर शिफारस केलेले CSC साहित्य:* \n\n👉 *${product.titleMr}*\n💰 अंदाजे किंमत: *${product.estimatedPrice}* (${product.discountBadge})\n\n🔗 Amazon वर थेट खरेदी करा:\n${buildAmazonUrl(product)}\n\n🌐 अधिक साहित्यासाठी भेट द्या: https://mahacorner.in/?page=store&tab=store#store`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="WhatsApp वर शेअर करा"
                      className="w-8 h-8 rounded-full bg-white/95 hover:bg-[#25D366] hover:text-white text-slate-700 shadow-md flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* 100% Real Photo Verification Badge */}
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/95 text-white text-[10px] font-black shadow-md backdrop-blur-xs">
                    <Camera className="w-3 h-3 text-emerald-200" />
                    <span>१००% खरा फोटो</span>
                  </div>

                  {/* Bottom tagline */}
                  <div className="absolute bottom-2.5 right-3 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md shadow-xs">
                    {product.taglineMr}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug group-hover:text-amber-600 transition-colors">
                      {product.titleMr}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {product.titleEn}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {product.descMr}
                  </p>

                  {/* Features Bullets */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    {product.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-slate-700 truncate">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing & Rating */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-slate-900">
                          {product.estimatedPrice}
                        </span>
                        <span className="text-xs text-slate-400 line-through">
                          {product.originalPrice}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        डील किंमत (सूटसह)
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-amber-500 font-black text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{product.rating}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {product.reviewsCount} पुनरावलोकने
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Amazon & Flipkart */}
              <div className="p-5 pt-0 grid grid-cols-2 gap-2">
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] text-center"
                >
                  <span>Amazon</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <a
                  href={flipkartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] text-center"
                >
                  <span>Flipkart</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Commission Info Banner */}
      <div className="rounded-3xl bg-amber-50/80 border border-amber-200/90 p-5 sm:p-6 text-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 font-black text-amber-950 text-sm sm:text-base">
          <Info className="w-5 h-5 text-amber-600" />
          <span>हे फिचर कसे काम करते आणि तुम्हाला कमिशन कसे मिळते?</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 block text-xs">१. ग्राहक लिंकवर क्लिक करतो:</span>
            <p>कोणताही सीएससी चालक किंवा ग्राहक तुमच्या वेबसाईटवरून "Amazon" किंवा "Flipkart" बटणावर क्लिक करून उत्पादन पाहतो.</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 block text-xs">२. खरेदी झाल्यावर कमिशन जमा:</span>
            <p>त्यांनी २४ तासांत काहीही खरेदी केली, तरी प्रत्येक ऑर्डरवर ४% ते १०% कमिशन थेट तुमच्या ॲफिलिएट खात्यात ट्रॅक होते.</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 block text-xs">३. बँक खात्यात थेट पैसे:</span>
            <p>Amazon व Flipkart दर महिन्याला तुमचे जमा झालेले पैसे थेट तुमच्या बँक खात्यात (NEFT द्वारे) जमा करतात!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

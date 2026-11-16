export const MAHA_CORNER_URL = 'https://maha-corner.ai.studio/';

export const getShareFooter = (lang: 'mr' | 'en' = 'mr'): string => {
  if (lang === 'en') {
    return `\n\n━━━━━━━━━━━━━━━\n📲 *Explore Services, Posters, GR & PDF Tools:*\n🌐 *MAHA CORNER Portal*\n👉 ${MAHA_CORNER_URL}`;
  }
  return `\n\n━━━━━━━━━━━━━━━\n📲 *अधिक सेवा, पोस्टर्स, GR व PDF टूल्ससाठी भेट द्या:*\n🌐 *महा कॉर्नर (MAHA CORNER)*\n👉 ${MAHA_CORNER_URL}`;
};

export const appendPortalLink = (message: string, lang: 'mr' | 'en' = 'mr'): string => {
  const trimmed = message.trim();
  if (trimmed.includes(MAHA_CORNER_URL)) return trimmed;
  return `${trimmed}${getShareFooter(lang)}`;
};

export const buildWhatsAppShareUrl = (message: string, lang: 'mr' | 'en' = 'mr'): string => {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(appendPortalLink(message, lang))}`;
};

export const getPortalInviteShareUrl = (lang: 'mr' | 'en' = 'mr'): string => {
  const msg =
    lang === 'en'
      ? `🌟 *MAHA CORNER — Maharashtra's Smart Citizen & e-Seva Portal*\n\n✅ *Marathi Poster Studio* (Add Shop/Center Name & Mobile)\n✅ *Farmer ID Card & PDF Card Cutter (PVC / A4)*\n✅ *22+ Smart PDF Tools* (Compress KB, Edit, Merge, N-Up, Sign)\n✅ *Daily Govt GR, Job Alerts & PMFBY 2026 Calculator*`
      : `🌟 *महा कॉर्नर (MAHA CORNER) — माहिती अशी, जी कामी येईल!*\n\n✅ *मराठी पोस्टर मेकर* (तुमच्या केंद्राचे नाव व नंबरसह)\n✅ *शेतकरी ओळखपत्र व स्मार्ट कार्ड कटर (PVC / A4)*\n✅ *२२+ स्मार्ट PDF टूल्स* (KB कॉम्प्रेस, एडिट, मर्ज, सही)\n✅ *ताजे शासन निर्णय (GR), नोकरी भरती व पीक विमा कॅल्क्युलेटर २०२६*`;
  return buildWhatsAppShareUrl(msg, lang);
};

export const PMFBY_PAGE_PATH = '/pmfby-2026?page=pmfby-2026#pmfby-2026';

export const getPmfbyPageUrl = (): string => {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/$/, '')
      : MAHA_CORNER_URL.replace(/\/$/, '');
  return `${base}/pmfby-2026?page=pmfby-2026#pmfby-2026`;
};

export const getPmfbyPageFooter = (lang: 'mr' | 'en' = 'mr'): string => {
  const pageUrl = getPmfbyPageUrl();
  if (lang === 'en') {
    return `\n\n━━━━━━━━━━━━━━━\n🌾 *Maha Corner — PMFBY Rabi 2026–27 Calculator*\n👉 Direct Calculator Page (फक्त हेच पेज उघडा):\n${pageUrl}`;
  }
  return `\n\n━━━━━━━━━━━━━━━\n🌾 *Maha Corner — PMFBY रब्बी २०२६–२७ पीक विमा कॅल्क्युलेटर*\n👉 थेट कॅल्क्युलेटर लिंक (फक्त हेच पेज उघडा):\n${pageUrl}`;
};

export const appendPmfbyPageLink = (message: string, lang: 'mr' | 'en' = 'mr'): string => {
  const trimmed = message.trim();
  const pageUrl = getPmfbyPageUrl();
  if (trimmed.includes(pageUrl) || trimmed.includes('/pmfby-2026')) return trimmed;
  return `${trimmed}${getPmfbyPageFooter(lang)}`;
};

export const buildPmfbyWhatsAppShareUrl = (message: string, lang: 'mr' | 'en' = 'mr'): string => {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(appendPmfbyPageLink(message, lang))}`;
};

export const getPmfbyPageOnlyInviteUrl = (lang: 'mr' | 'en' = 'mr'): string => {
  const pageUrl = getPmfbyPageUrl();
  const msg =
    lang === 'en'
      ? `🌾 *PMFBY Rabi 2026–27 Premium Calculator — Maha Corner*\n\n✅ 32 Maharashtra Districts & Notified Crops\n✅ Direct Farmer Share & Mix Ratio Calculator\n✅ 7/12 Print & Service Fee Combined Total\n\n👉 Open Direct Calculator Page (फक्त हेच पेज उघडा):\n${pageUrl}`
      : `🌾 *PMFBY रब्बी २०२६–२७ पीक विमा कॅल्क्युलेटर — Maha Corner*\n\n✅ महाराष्ट्रातील सर्व ३२ जिल्हे व अधिकृत अधिसूचित पिके\n✅ अचूक शेतकरी हिस्सा व मिश्र पीक प्रमाण (Ratio)\n✅ सातबारा प्रिंट व इतर शुल्क एकत्रित बेरीज\n\n👉 थेट कॅल्क्युलेटर पेज उघडा (फक्त हेच पेज उघडा):\n${pageUrl}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
};


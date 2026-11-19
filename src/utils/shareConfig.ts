import { AppTab } from '../types';

export const DEFAULT_APP_DOMAIN = 'mahacorner.in';

export const MAHA_CORNER_URL =
  typeof window !== 'undefined' &&
  window.location?.origin &&
  !window.location.origin.includes('localhost') &&
  !window.location.origin.includes('ais-dev') &&
  !window.location.origin.includes('ais-pre')
    ? window.location.origin
    : 'https://mahacorner.in';

export const TAB_TO_HASH: Record<AppTab, string> = {
  'ai-poster': '#ai-poster',
  'maha-news': '#maha-news',
  'vip-posters': '#vip-posters',
  'cutter': '#cutter',
  'bulk-card': '#bulk-card',
  'farmer-card': '#farmer-card',
  'pmfby-calc': '#pmfby-2026',
  'photo-resizer': '#photo-resizer',
  'pdf-tools': '#pdf-tools',
  'gr': '#gr',
  'jobs': '#jobs',
  'portals': '#portals',
  'store': '#store',
  'about': '#about',
  'privacy': '#privacy',
  'terms': '#terms',
  'disclaimer': '#disclaimer',
  'contact': '#contact',
};

export const getTabCanonicalUrl = (tab: AppTab): string => {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/$/, '')
      : MAHA_CORNER_URL.replace(/\/$/, '');

  if (tab === 'pmfby-calc') {
    return `${base}/pmfby-2026?page=pmfby-2026#pmfby-2026`;
  }
  const hash = TAB_TO_HASH[tab] || '#ai-poster';
  const slug = hash.replace(/^#/, '');
  return `${base}/?page=${slug}&tab=${slug}#${slug}`;
};

export interface PageShareMeta {
  tab: AppTab;
  nameMr: string;
  nameEn: string;
  headlineMr: string;
  headlineEn: string;
  taglineMr: string;
  taglineEn: string;
  bulletsMr: string[];
  bulletsEn: string[];
}

export const PAGE_SHARE_CONFIG: Record<AppTab, PageShareMeta> = {
  'ai-poster': {
    tab: 'ai-poster',
    nameMr: 'मराठी पोस्टर मेकर',
    nameEn: 'Marathi Poster Studio',
    headlineMr: '🎨 मराठी पोस्टर मेकर व AI डिझाइन स्टुडिओ — महा कॉर्नर',
    headlineEn: '🎨 Marathi Poster Studio & AI Designer — Maha Corner',
    taglineMr: 'लाडकी बहीण, PM किसान, पीक विमा व सण-उत्सवांचे १-क्लिकमध्ये 4K प्रिंट पोस्टर्स!',
    taglineEn: 'Instant 4K print-ready Marathi banners for Govt schemes, CSC & festive greetings.',
    bulletsMr: [
      'केंद्राचे नाव, २ मोबाईल नंबर व पत्ता १-क्लिकमध्ये',
      '४K Ultra HD रिझोल्यूशन प्रिंटिंग (३०० DPI)',
      'कोणताही वॉटरमार्क नाही, १००% मोफत व सुरक्षित',
      'थेट WhatsApp व सोशल मीडियावर शेअर करण्याची सुविधा',
    ],
    bulletsEn: [
      'Auto-embed shop name, 2 mobile numbers & address',
      '4K Ultra HD ready-to-print format (300 DPI)',
      '100% Free, no watermark, fast & secure',
      'Direct WhatsApp & social media sharing',
    ],
  },
  'maha-news': {
    tab: 'maha-news',
    nameMr: 'महा कॉर्नर न्यूज (लाईव्ह)',
    nameEn: 'Maha Corner News (Live)',
    headlineMr: '📰 महा कॉर्नर न्यूज — शेतकरी, विद्यार्थी, पीक विमा व हवामान ताज्या बातम्या',
    headlineEn: '📰 Maha Corner News — Farmers, Students, Crop Insurance & Weather Alerts',
    taglineMr: 'महाराष्ट्र व देशातील शेती, पीक विमा, हवामान, बाजारभाव आणि विद्यार्थी नोकरी भरती विषयी थेट ताज्या बातम्या.',
    taglineEn: 'Real-time verified Marathi news bulletin covering agriculture, PMFBY insurance, weather, APMC and student recruitment.',
    bulletsMr: [
      'थेट गुगल सर्च ग्राउंडेड ताज्या खात्रीशीर बातम्या',
      'पीक विमा भरपाई, दावे व शेतकरी योजना माहिती',
      'हवामान अंदाज, अवकाळी पाऊस व APMC बाजारभाव',
      'विद्यार्थी भरती, परीक्षा वेळापत्रक व महाडीबीटी शिष्यवृत्ती',
    ],
    bulletsEn: [
      'Google Search Grounded live verified news feed',
      'PMFBY crop insurance, compensation & farmer schemes',
      'Weather forecasts, rain alerts & APMC market prices',
      'Student recruitment alerts, exam dates & MahaDBT scholarships',
    ],
  },
  'vip-posters': {
    tab: 'vip-posters',
    nameMr: '👑 VIP पोस्टर पॅक',
    nameEn: 'VIP Poster Packs',
    headlineMr: '👑 ५०+ व्हीआयपी / प्रीमियम मराठी पोस्टर पॅक्स — महा कॉर्नर',
    headlineEn: '👑 50+ VIP / Premium Marathi Poster Packs — Maha Corner',
    taglineMr: 'सीएससी केंद्रांसाठी हाय-इम्पॅक्ट रेडीमेड ५०+ पोस्टर्स व ४K प्रिंट्स (फक्त ₹२९/महिना किंवा ₹९९ लाइफटाइम).',
    taglineEn: 'High-impact 50+ ready-made Marathi posters with 4K UHD download for CSC centers.',
    bulletsMr: [
      'सरकारी योजना, शेतकरी विशेष, भरती व सण-उत्सव पॅक्स',
      '१ महिना पास (₹२९) किंवा ऑल-इन-वन लाइफटाइम पास (₹९९)',
      'थेट BharatPe UPI द्वारे तात्काळ अनलॉक',
      '४K प्रिंट क्वालिटी व वॉटरमार्क फ्री',
    ],
    bulletsEn: [
      'Govt Schemes, Farmer Special, Job Alerts & Festival Packs',
      '1-Month Paid Pass (₹29) or Lifetime Pass (₹99)',
      'Instant unlock via direct UPI payment',
      '4K UHD print-ready resolution without watermark',
    ],
  },
  'cutter': {
    tab: 'cutter',
    nameMr: 'कार्ड कटर (सिंगल)',
    nameEn: 'Single Card Cutter',
    headlineMr: '✂️ स्मार्ट PDF कार्ड कटर (A4 व PVC) — महा कॉर्नर',
    headlineEn: '✂️ Smart PDF Card Cutter (A4 & PVC) — Maha Corner',
    taglineMr: 'आधार, पॅन, ई-श्रम व आयुष्मान कार्ड १-क्लिकमध्ये अचूक कट व प्रिंट करा.',
    taglineEn: '1-Click precise front/back cropping and A4/PVC ready card layout.',
    bulletsMr: [
      'समोरची व मागची बाजू अचूक ऑटो/मॅन्युअल क्रॉप',
      'A4 फोटो पेपर किंवा PVC प्लास्टिक कार्ड साइज',
      'सुरक्षित Local-First प्रोसेस (डेटा डिव्हाइसवरच राहतो)',
      'हाय-रिझोल्यूशन ३०० DPI PDF डाउनलोड',
    ],
    bulletsEn: [
      'Front and back precise card cropping',
      'A4 photo sheet or PVC card sizing',
      'Safe Local-First device processing',
      'High resolution 300 DPI PDF download',
    ],
  },
  'bulk-card': {
    tab: 'bulk-card',
    nameMr: 'बल्क PVC कार्ड मेकर',
    nameEn: 'Bulk PVC Card Maker',
    headlineMr: '🗂️ बल्क PVC कार्ड प्रिंटर (एकाच वेळी ५ व १० कार्ड्स) — महा कॉर्नर',
    headlineEn: '🗂️ Bulk PVC Card Maker (5 & 10 Cards Batch) — Maha Corner',
    taglineMr: 'अनेक PDF/Images अपलोड करून १ सेकंदात A4 शीट किंवा Epson L805 ट्रेवर ५-१० कार्ड्स प्रिंट करा!',
    taglineEn: 'Upload multiple cards and generate print-ready A4 5-card stacks or Epson L805 trays in 1 second.',
    bulletsMr: [
      '५-कार्ड स्टॅक (A4 मध्यभागी फोल्डिंग लाईनसह)',
      '१०-कार्ड ग्रिड (A4 ड्युप्लेक्स प्रिंटिंग)',
      'Epson L805/L8050 PVC ट्रे टेम्पलेट',
      '३०० DPI मास्टर प्रिंट PDF व PNG ZIP डाउनलोड',
    ],
    bulletsEn: [
      'A4 5-card stack with center folding guideline',
      'A4 10-card duplex grid mode',
      'Epson L805/L8050 dual PVC tray layout',
      '300 DPI master PDF & ZIP package download',
    ],
  },
  'farmer-card': {
    tab: 'farmer-card',
    nameMr: 'शेतकरी ओळखपत्र मेकर',
    nameEn: 'Farmer ID Card Maker',
    headlineMr: '🌾 स्मार्ट शेतकरी ओळखपत्र (Kisan ID Card) मेकर — महा कॉर्नर',
    headlineEn: '🌾 Smart Farmer ID Card Maker — Maha Corner',
    taglineMr: 'शेतकऱ्यांसाठी QR कोड व अधिकृत माहितीसह डिजिटल शेतकरी ओळखपत्र तयार करा.',
    taglineEn: 'Create official digital Farmer ID cards with QR code and crop details.',
    bulletsMr: [
      'शेतकऱ्याचे नाव, आधार, ७/१२ व पिकांचा तपशील',
      'अधिकृत डिजिटल QR कोड जनरेटर',
      'PVC कार्ड व लॅमिनेशन-रेडी A4 प्रिंट',
      'शेतकरी बांधवांसाठी १००% मोफत व उपयुक्त',
    ],
    bulletsEn: [
      'Farmer name, Aadhaar, Satbara and crop data',
      'Integrated QR code verification',
      'PVC & lamination ready A4 export',
      '100% Free & useful for farming community',
    ],
  },
  'pmfby-calc': {
    tab: 'pmfby-calc',
    nameMr: 'पीक विमा कॅल्क्युलेटर २०२६',
    nameEn: 'PMFBY 2026 Crop Insurance Calc',
    headlineMr: '🌾 PMFBY रब्बी व खरीप पीक विमा २०२६ कॅल्क्युलेटर — महा कॉर्नर',
    headlineEn: '🌾 PMFBY Rabi & Kharif 2026 Insurance Calculator — Maha Corner',
    taglineMr: 'महाराष्ट्रातील ३२ जिल्हे, अधिसूचित पिके व अचूक शेतकरी हिशेब १ रुपयात पीक विमा योजना!',
    taglineEn: 'Official Maharashtra 32 districts crop insurance premium and farmer share calculator.',
    bulletsMr: [
      'सर्व ३२ जिल्हे व अधिकृत अधिसूचित पिके',
      'अचूक शेतकरी हिस्सा व मिश्र पीक प्रमाण (Ratio)',
      'सातबारा प्रिंट व इतर शुल्क एकत्रित बेरीज',
      'थेट WhatsApp वर शेतकरी हिशेब पावती पाठवण्याची सोय',
    ],
    bulletsEn: [
      'All 32 Maharashtra districts notified crops',
      'Precise farmer share & mix ratio calculator',
      'Combined 7/12 & center service charges',
      'Instant WhatsApp calculation receipt share',
    ],
  },
  'photo-resizer': {
    tab: 'photo-resizer',
    nameMr: 'फोटो व सही रिसायझर',
    nameEn: 'Photo & Signature Resizer',
    headlineMr: '🖼️ सरकारी नोकरी व परीक्षा फोटो-सही रिसायझर — महा कॉर्नर',
    headlineEn: '🖼️ Govt Job & Exam Photo-Signature Resizer — Maha Corner',
    taglineMr: 'MPSC, पोलीस भरती, तलाठी, आधार, पॅन व बँक फॉर्मसाठी अचूक KB व DPI रिसायझर.',
    taglineEn: 'Accurate KB size, pixel & DPI resizer for MPSC, Police Bharti, Aadhaar & PAN.',
    bulletsMr: [
      'MPSC, पोलीस भरती, तलाठी अधिकृत प्रीसेट्स',
      'Target KB (२० ते ५० KB) कॉम्प्रेस व क्रॉप',
      'नाव व तारीख (Name & Date) जोडण्याची सोय',
      '३०० DPI प्रिंट क्वालिटी व १००% सुरक्षित',
    ],
    bulletsEn: [
      'MPSC, Police Bharti, Talathi official presets',
      'Target KB compression (20 to 50 KB)',
      'Add name & date on photo support',
      '300 DPI print quality, fully private',
    ],
  },
  'pdf-tools': {
    tab: 'pdf-tools',
    nameMr: '२२+ स्मार्ट PDF टूल्स बार',
    nameEn: '22+ Smart PDF Tools',
    headlineMr: '📑 २२+ मोफत स्मार्ट PDF टूल्स बार — महा कॉर्नर',
    headlineEn: '📑 22+ Free Smart PDF Tools Suite — Maha Corner',
    taglineMr: 'PDF कॉम्प्रेस (Target KB), मर्ज, स्प्लिट, Word/Excel रूपांतर, थेट एडिटिंग व सही एकाच ठिकाणी!',
    taglineEn: 'Compress PDF to target KB, merge, split, convert to Word/Excel, edit & sign offline.',
    bulletsMr: [
      'Target KB नुसार PDF कॉम्प्रेस (१०० KB, २०० KB)',
      'PDF ↔ Word, Excel, PPT व JPG रूपांतर',
      'थेट PDF मध्ये फोटो, मजकूर व सही जोडणे',
      'मराठी/इंग्रजी OCR, पासवर्ड Protect व Unlock',
    ],
    bulletsEn: [
      'Target KB PDF compression (100 KB, 200 KB)',
      'Convert PDF to Word, Excel, PPT and JPG',
      'Directly add text, photo and signature to PDF',
      'Marathi/English OCR, Password protect and unlock',
    ],
  },
  'gr': {
    tab: 'gr',
    nameMr: 'शासन निर्णय (GR) डायरेक्टरी',
    nameEn: 'Govt Resolutions (GR)',
    headlineMr: '📜 महाराष्ट्र शासन निर्णय (GR) थेट शोध व PDF डाउनलोड — महा कॉर्नर',
    headlineEn: '📜 Maharashtra Govt Resolutions (GR) Live Directory — Maha Corner',
    taglineMr: 'कृषी, ग्रामविकास, महसूल, शिक्षण व गृह विभागाचे सर्व ताजे शासन निर्णय (GR) एका क्लिकवर.',
    taglineEn: 'Live Maharashtra GR directory with instant search and official PDF downloads.',
    bulletsMr: [
      'मंत्रालय व विभागनिहाय ताजे शासन निर्णय (GR)',
      'कीवर्ड, विषय व तारखेनुसार झटपट शोध',
      'अधिकृत शासन PDF एका क्लिकवर डाउनलोड',
      'दररोज नवीन GR चे मोफत अपडेट्स',
    ],
    bulletsEn: [
      'Latest department-wise Maharashtra Govt GRs',
      'Instant search by keyword, title and date',
      'Official Govt PDF direct download',
      'Daily updated GR notifications',
    ],
  },
  'jobs': {
    tab: 'jobs',
    nameMr: 'नोकरी व भरती संदर्भ',
    nameEn: 'Govt Jobs & Bharti Alerts',
    headlineMr: '💼 महाराष्ट्र व केंद्र सरकारी नोकरी भरती संदर्भ २०२६ — महा कॉर्नर',
    headlineEn: '💼 Maharashtra & Central Govt Jobs Alerts 2026 — Maha Corner',
    taglineMr: 'पोलीस, तलाठी, वनविभाग, आरोग्य, बँक, रेल्वे व जिल्हा परिषद भरतीची अधिकृत जाहिरात व लिंक.',
    taglineEn: 'Latest Govt job notifications, eligibility, syllabus and direct apply links.',
    bulletsMr: [
      'सर्व चालू शासकीय भरतींची संपूर्ण माहिती व पात्रता',
      'अर्ज करण्याची अंतिम तारीख व वयोमर्यादा',
      'अधिकृत जाहिरात PDF व ऑनलाइन अर्ज लिंक',
      'मोबाईलवर थेट WhatsApp अलर्ट्स',
    ],
    bulletsEn: [
      'Comprehensive notification of active recruitments',
      'Application deadlines and eligibility criteria',
      'Official notification PDF and direct apply links',
      'Free job notification alerts on WhatsApp',
    ],
  },
  'portals': {
    tab: 'portals',
    nameMr: 'शासकीय पोर्टल्स डायरेक्टरी',
    nameEn: 'Govt Portals Directory',
    headlineMr: '🏛️ ५०+ महाराष्ट्र व भारत शासकीय पोर्टल्स — महा कॉर्नर',
    headlineEn: '🏛️ 50+ Maharashtra & India Govt Portals — Maha Corner',
    taglineMr: 'महाडीबीटी, महाभूमी, आपले सरकार, UIDAI, इनकम टॅक्स, ई-श्रम सर्व अधिकृत लिंक्स एकाच ठिकाणी.',
    taglineEn: 'All official Maharashtra & Central citizen portals with direct verified links.',
    bulletsMr: [
      'महाडीबीटी, महाभूमी, आपले सरकार, DigiLocker',
      'आधार, पॅन कार्ड, मतदान ओळखपत्र थेट लिंक्स',
      'शेतकरी योजना व शिष्यवृत्ती पोर्टल्स',
      'सुरक्षित व अधिकृत शासकीय वेब लिंक्स',
    ],
    bulletsEn: [
      'MahaDBT, Mahabhumi, Aaple Sarkar, DigiLocker',
      'Aadhaar, PAN, Voter ID verified portals',
      'Farmer schemes & scholarship access',
      '100% Safe official government links',
    ],
  },
  'store': {
    tab: 'store',
    nameMr: 'CSC हार्डवेअर स्टोअर',
    nameEn: 'CSC Hardware Store',
    headlineMr: '🛒 CSC व महा ई-सेवा केंद्र हार्डवेअर स्टोअर — महा कॉर्नर',
    headlineEn: '🛒 CSC & Cyber Cafe Hardware Store — Maha Corner',
    taglineMr: 'बायोमेट्रिक फिंगरप्रिंट स्कॅनर, मंत्रा IRIS, PVC कार्ड प्रिंटर व लॅमिनेशन मशिन्स बेस्ट ऑफर्स!',
    taglineEn: 'Authentic biometric scanners, PVC printers, and laminators with Amazon/Flipkart deals.',
    bulletsMr: [
      'मंत्रा MFS100 / MFS110, Morpho बायोमेट्रिक डिव्हाइसेस',
      'Epson L8050 / Canon PVC कार्ड प्रिंटर्स',
      'A4 लॅमिनेशन मशीन, PVC ब्लँक कार्ड्स व इंक',
      'अमेझॉन व फ्लिपकार्ट सर्वोत्तम डील्स व वॉरंटी',
    ],
    bulletsEn: [
      'Mantra MFS100 / Morpho biometric devices',
      'Epson L8050 / Canon PVC card printers',
      'Heavy-duty laminators, blank cards & ink',
      'Best Amazon & Flipkart offers with warranty',
    ],
  },
  'about': {
    tab: 'about',
    nameMr: 'संस्थापक व टीम',
    nameEn: 'About Founder & Team',
    headlineMr: '🏛️ महा कॉर्नर संस्थापक व आमची टीम — महा कॉर्नर',
    headlineEn: '🏛️ Maha Corner Founder & Official Team — Maha Corner',
    taglineMr: 'कमलेश पाटील, विकास पाटील, पवन पाटील, शुभम पाटील व जयेश वाघ — महाराष्ट्रासाठी समर्पित डिजिटल नेतृत्व.',
    taglineEn: 'Kamlesh Patil, Vikas Patil, Pawan Patil, Shubham Patil and Jayesh Wagh — Dedicated digital services team.',
    bulletsMr: [
      'संस्थापक: कमलेश नारायण पाटील (MSc Computer, Cyber Security)',
      'बिझनेस व टेक सपोर्ट: विकास गजानन पाटील',
      'तांत्रिक सपोर्ट: पवन भाईदास पाटील',
      'फोटोग्राफी व व्हिज्युअल सपोर्ट: शुभम अशोक पाटील',
      'इंजिनीयर: जयेश धर्मराज वाघ',
    ],
    bulletsEn: [
      'Founder: Kamlesh Narayan Patil (MSc Comp, Cyber Security)',
      'Business & Tech Support: Vikas Gajanan Patil',
      'Technical Support: Pawan Bhaidas Patil',
      'Photography & Visual Support: Shubham Ashok Patil',
      'Engineer: Jayesh Dharmaraj Wagh',
    ],
  },
  'privacy': {
    tab: 'privacy',
    nameMr: 'गोपनीयता धोरण',
    nameEn: 'Privacy Policy',
    headlineMr: '🔒 गोपनीयता धोरण (Privacy Policy) — महा कॉर्नर',
    headlineEn: '🔒 Privacy Policy — Maha Corner',
    taglineMr: 'तुमचा डेटा १००% सुरक्षित आणि तुमच्याच डिव्हाइसवर प्रोसेस होतो.',
    taglineEn: 'Your data is 100% private and processed on-device locally.',
    bulletsMr: ['कोणताही वैयक्तिक डेटा सर्व्हरवर सेव्ह होत नाही', 'क्लायंट-साइड लोकल प्रोसेसिंग', 'Google AdSense मार्गदर्शक तत्त्वे सुसंगत'],
    bulletsEn: ['No personal documents stored on server', 'Client-side processing', 'Full AdSense & GDPR compliance'],
  },
  'terms': {
    tab: 'terms',
    nameMr: 'नियम व अटी',
    nameEn: 'Terms & Conditions',
    headlineMr: '📋 नियम व अटी (Terms & Conditions) — महा कॉर्नर',
    headlineEn: '📋 Terms & Conditions — Maha Corner',
    taglineMr: 'महा कॉर्नर पोर्टल वापराच्या अधिकृत अटी व शर्ती.',
    taglineEn: 'Official terms and conditions for using Maha Corner portal.',
    bulletsMr: ['नागरिक व सीएससी चालकांसाठी मोफत डिजिटल सेवा', 'पारदर्शक व अधिकृत माहिती', 'शासकीय नियमांनुसार उपयोग'],
    bulletsEn: ['Free digital services for citizens', 'Transparent information', 'Fair usage guidelines'],
  },
  'disclaimer': {
    tab: 'disclaimer',
    nameMr: 'अस्वीकरण',
    nameEn: 'Disclaimer',
    headlineMr: '⚠️ अस्वीकरण (Disclaimer) — महा कॉर्नर',
    headlineEn: '⚠️ Disclaimer — Maha Corner',
    taglineMr: 'महा कॉर्नर हे केवळ जनहितार्थ माहिती व सुविधा पुरवणारे व्यासपीठ आहे.',
    taglineEn: 'Maha Corner is an informative public facilitation platform.',
    bulletsMr: ['अधिकृत शासकीय माहितीसाठी अधिकृत संकेतस्थळास भेट द्या', 'जनहितार्थ मोफत सुविधा', 'पारदर्शक माहिती'],
    bulletsEn: ['Always verify with official gov portals', 'Public non-gov facilitation', 'Transparent services'],
  },
  'contact': {
    tab: 'contact',
    nameMr: 'संपर्क करा',
    nameEn: 'Contact Us',
    headlineMr: '📞 संपर्क करा (Contact Us) — महा कॉर्नर',
    headlineEn: '📞 Contact Us — Maha Corner',
    taglineMr: 'महा कॉर्नर टीमशी थेट संपर्क करा आणि आपल्या प्रतिक्रिया नोंदवा.',
    taglineEn: 'Get in touch with Maha Corner support team directly.',
    bulletsMr: ['ईमेल: kamleshpatil9719@gmail.com', 'WhatsApp व थेट संपर्क सुविधा', 'त्वरित मार्गदर्शन'],
    bulletsEn: ['Email: kamleshpatil9719@gmail.com', 'WhatsApp community support', 'Quick help & assistance'],
  },
};

export interface ShareDataResult {
  title: string;
  subtitle: string;
  message: string;
  url: string;
  whatsappUrl: string;
}

export const getPageShareDetails = (tab: AppTab, lang: 'mr' | 'en' = 'mr'): ShareDataResult => {
  const meta = PAGE_SHARE_CONFIG[tab] || PAGE_SHARE_CONFIG['ai-poster'];
  const url = getTabCanonicalUrl(tab);

  const headline = lang === 'en' ? meta.headlineEn : meta.headlineMr;
  const tagline = lang === 'en' ? meta.taglineEn : meta.taglineMr;
  const bullets = lang === 'en' ? meta.bulletsEn : meta.bulletsMr;

  const bulletText = bullets.map((b) => `✅ ${b}`).join('\n');

  const message =
    lang === 'en'
      ? `${headline}\n\n${tagline}\n\n${bulletText}\n\n━━━━━━━━━━━━━━━\n👉 Open Direct Page:\n${url}\n\n🌐 MAHA CORNER • ${DEFAULT_APP_DOMAIN}`
      : `${headline}\n\n${tagline}\n\n${bulletText}\n\n━━━━━━━━━━━━━━━\n👉 फक्त हेच पेज उघडण्यासाठी खालील लिंकवर क्लिक करा:\n${url}\n\n🌐 महा कॉर्नर • ${DEFAULT_APP_DOMAIN}`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  return {
    title: lang === 'en' ? meta.nameEn : meta.nameMr,
    subtitle: tagline,
    message,
    url,
    whatsappUrl,
  };
};

export const getWebsiteShareDetails = (lang: 'mr' | 'en' = 'mr'): ShareDataResult => {
  const url = MAHA_CORNER_URL;

  const message =
    lang === 'en'
      ? `🌟 *MAHA CORNER (mahacorner.in) — Maharashtra's All-in-One Digital Services Portal*\n\n✅ *Marathi Poster Studio* (1-Click Shop Name & Mobile)\n✅ *VIP Poster Packs* (50+ Ultra HD Ready-made Posters)\n✅ *Bulk PVC Card Maker* (5 & 10 Cards Batch on A4 & Epson L805 Tray)\n✅ *Smart Farmer ID Card Maker* (With QR Code)\n✅ *22+ Smart PDF Tools* (Target KB Compress, Edit, Merge, OCR & Sign)\n✅ *PMFBY 2026 Crop Insurance Calculator* (32 Districts)\n✅ *Govt GR Live Directory & Job Alerts*\n✅ *CSC Equipment Store* (Biometric & PVC Printers)\n\n━━━━━━━━━━━━━━━\n👉 Visit All-in-One Portal:\n${url}\n\n🌐 MAHA CORNER • Information That Truly Matters!`
      : `🌟 *महा कॉर्नर (mahacorner.in) — माहिती अशी, जी कामी येईल!*\n\nमहाराष्ट्रातील सीएससी चालक, सेतू केंद्र, सायबर कॅफे व सर्व नागरिकांसाठी आवश्यक सर्व डिजिटल टूल्स एकाच ठिकाणी:\n\n✅ *मराठी पोस्टर मेकर* (केंद्राचे नाव व नंबरसह तयार पोस्टर्स)\n✅ *५०+ VIP पोस्टर्स पॅक* (४K प्रिंट्स व नवीन योजना अपडेट्स)\n✅ *बल्क PVC कार्ड मेकर* (५ व १० कार्ड्स एकाच वेळी प्रिंट करा)\n✅ *शेतकरी ओळखपत्र मेकर* (डिजिटल QR कोडसह)\n✅ *२२+ मोफत स्मार्ट PDF टूल्स* (Target KB कॉम्प्रेस, एडिट, सही, OCR)\n✅ *PMFBY पीक विमा कॅल्क्युलेटर २०२६* (सर्व ३२ जिल्हे)\n✅ *महाराष्ट्र शासन निर्णय (GR) व नोकरी भरती*\n✅ *CSC हार्डवेअर स्टोअर* (बायोमेट्रिक व प्रिंटर डील्स)\n\n━━━━━━━━━━━━━━━\n👉 संपूर्ण वेबसाईट उघडण्यासाठी खालील लिंकवर क्लिक करा:\n${url}\n\n🌐 महा कॉर्नर • mahacorner.in`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  return {
    title: lang === 'en' ? 'Maha Corner Portal' : 'संपूर्ण महा कॉर्नर पोर्टल',
    subtitle:
      lang === 'en'
        ? 'All-in-one Maharashtra digital services & poster studio'
        : 'सर्व डिजिटल टूल्स, पोस्टर्स व शासकीय योजनांचे अधिकृत पोर्टल',
    message,
    url,
    whatsappUrl,
  };
};

export const shareNativeOrCopy = async (options: {
  title: string;
  text: string;
  url: string;
}): Promise<'shared' | 'copied' | 'error'> => {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'shared';
    }
  }

  // Fallback to Clipboard Copy
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(options.text);
      return 'copied';
    } catch {}
  }
  return 'error';
};

// Legacy backwards compatibility functions
export const getShareFooter = (lang: 'mr' | 'en' = 'mr'): string => {
  return lang === 'en'
    ? `\n\n━━━━━━━━━━━━━━━\n📲 *Explore Services, Posters, GR & PDF Tools:*\n🌐 *MAHA CORNER Portal*\n👉 ${MAHA_CORNER_URL}`
    : `\n\n━━━━━━━━━━━━━━━\n📲 *अधिक सेवा, पोस्टर्स, GR व PDF टूल्ससाठी भेट द्या:*\n🌐 *महा कॉर्नर (MAHA CORNER)*\n👉 ${MAHA_CORNER_URL}`;
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
  return getWebsiteShareDetails(lang).whatsappUrl;
};

export const PMFBY_PAGE_PATH = '/pmfby-2026?page=pmfby-2026#pmfby-2026';

export const getPmfbyPageUrl = (): string => {
  return getTabCanonicalUrl('pmfby-calc');
};

export const getPmfbyPageOnlyInviteUrl = (lang: 'mr' | 'en' = 'mr'): string => {
  return getPageShareDetails('pmfby-calc', lang).whatsappUrl;
};

export const appendPmfbyPageLink = (message: string, lang: 'mr' | 'en' = 'mr'): string => {
  const url = getPmfbyPageUrl();
  const trimmed = message.trim();
  if (trimmed.includes(url)) return trimmed;
  const footer =
    lang === 'en'
      ? `\n\n━━━━━━━━━━━━━━━\n👉 Open Direct Calculator:\n${url}\n\n🌐 MAHA CORNER • ${DEFAULT_APP_DOMAIN}`
      : `\n\n━━━━━━━━━━━━━━━\n👉 थेट पीक विमा हिशेब पाहण्यासाठी लिंक:\n${url}\n\n🌐 महा कॉर्नर • ${DEFAULT_APP_DOMAIN}`;
  return `${trimmed}${footer}`;
};


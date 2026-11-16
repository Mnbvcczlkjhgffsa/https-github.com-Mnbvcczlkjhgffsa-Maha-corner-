import { CscPosterItem } from '../types';

export const CSC_POSTER_CATEGORIES = [
  { id: 'all', name: 'सर्व पोस्टर्स (All)' },
  { id: 'schemes', name: '🏛️ शासकीय योजना' },
  { id: 'farmer', name: '🌾 शेती व पीक विमा' },
  { id: 'aadhaar-pan', name: '🪪 आधार व पॅन कार्ड' },
  { id: 'banking', name: '💳 बँकिंग व AEPS' },
  { id: 'certificates', name: '📜 दाखले व महसूल' },
  { id: 'education-jobs', name: '📚 भरती व शिक्षण' },
  { id: 'centre-ad', name: '📢 केंद्र सेवा जाहिरात' },
];

export const CSC_POSTER_LIBRARY: CscPosterItem[] = [
  // 1. Government Schemes
  {
    id: 'ladki-bahin-yojana',
    title: 'Majhi Ladki Bahin Yojana',
    titleMr: 'मुख्यमंत्री माझी लाडकी बहीण योजना',
    category: 'schemes',
    categoryMr: 'शासकीय योजना',
    tag: 'महत्त्वाची योजना',
    summary: 'पात्र महिला भगिनींसाठी थेट बँक खात्यात आर्थिक सहाय्य लाभ सुरू!',
    keyPoints: [
      '२१ ते ६५ वयोगटातील पात्र महिलांसाठी योजना',
      'आधार लिंक बँक खात्यात थेट डीबीटी द्वारे लाभ',
      'उत्पन्नाचा दाखला / पिवळे-केशरी रेशन कार्ड आवश्यक',
      'ई-केवायसी व बँक आधार सीडिंग करून घेण्यासाठी आजच केंद्रास भेट द्या'
    ],
    bgGradient: ['#831843', '#500724'],
    accentColor: '#f472b6',
    badgeText: '★ थेट बँक खात्यात लाभ',
    recommendedServices: ['ई-केवायसी', 'आधार लिंकिंग', 'बँक सीडिंग', 'दाखले']
  },
  {
    id: 'pm-kisan-ekyc',
    title: 'PM Kisan Samman Nidhi e-KYC',
    titleMr: 'पीएम किसान सन्मान निधी ई-केवायसी व नवीन हप्ता',
    category: 'schemes',
    categoryMr: 'शासकीय योजना',
    tag: 'शेतकरी लाभ',
    summary: 'शेतकरी बांधवांसाठी पीएम किसान ई-केवायसी प्रक्रिया सुरू आहे.',
    keyPoints: [
      'ई-केवायसी बाकी असल्यास पुढील हप्ता जमा होणार नाही',
      'बायोमेट्रिक फिंगरप्रिंटद्वारे केंद्रावर तात्काळ ई-केवायसी सोय',
      'बँक खात्याला आधार लिंक असणे बंधनकारक',
      'जमीन पडताळणी (Land Seeding) स्थिती तपासून घ्या'
    ],
    bgGradient: ['#065f46', '#022c22'],
    accentColor: '#34d399',
    badgeText: '✓ ई-केवायसी अनिवार्य',
    recommendedServices: ['बायोमेट्रिक e-KYC', '७/१२ उतारा', 'आधार कार्ड', 'बँक पासबुक']
  },
  {
    id: 'namo-shetkari-yojana',
    title: 'Namo Shetkari Mahasanman Nidhi',
    titleMr: 'नमो शेतकरी महासन्मान निधी योजना',
    category: 'schemes',
    categoryMr: 'शासकीय योजना',
    tag: 'महाराष्ट्र शासन',
    summary: 'महाराष्ट्र शासनाचा शेतकरी बांधवांना वार्षिक ६,००० रुपयांचा अतिरिक्त लाभ!',
    keyPoints: [
      'पीएम किसान पात्र शेतकऱ्यांना थेट राज्य शासनाचा लाभ',
      'खात्याची पात्रता व आधार सिडींग स्थिती तपासून घ्या',
      'नवीन नोंदणी व दुरुस्तीसाठी केंद्राशी संपर्क साधा',
      'महा कॉर्नर - आपल्या विश्वासाचे आपले सरकार सेवा केंद्र'
    ],
    bgGradient: ['#14532d', '#052e16'],
    accentColor: '#4ade80',
    badgeText: '🌾 महाराष्ट्र शासन योजना',
    recommendedServices: ['शेतकरी नोंदणी', 'बँक सीडिंग', '७/१२ उतारा']
  },
  {
    id: 'ayushman-bharat-card',
    title: 'Ayushman Bharat Golden Card',
    titleMr: 'आयुष्मान भारत कार्ड (५ लाखांपर्यंत मोफत उपचार)',
    category: 'schemes',
    categoryMr: 'शासकीय योजना',
    tag: 'आरोग्य योजना',
    summary: 'कुटुंबातील प्रत्येक सदस्याचे आयुष्मान गोल्डन कार्ड आजच काढून घ्या.',
    keyPoints: [
      'दरवर्षी ५ लाख रुपयांपर्यंत मोफत वैद्यकीय उपचार',
      'नोंदणीकृत सरकारी व खाजगी नामांकित रुग्णालयांमध्ये कॅशलेस सुविधा',
      'रेशन कार्ड व आधार कार्डवरून तात्काळ पात्रता तपासणी',
      'केंद्रावर त्वरित PVC कार्ड प्रिंट उपलब्ध'
    ],
    bgGradient: ['#1e3a8a', '#172554'],
    accentColor: '#60a5fa',
    badgeText: '🩺 ५ लाखांपर्यंत मोफत उपचार',
    recommendedServices: ['आयुष्मान कार्ड', 'रेशन कार्ड', 'आधार कार्ड']
  },
  {
    id: 'sanjay-gandhi-niradhar',
    title: 'Sanjay Gandhi Niradhar Yojana',
    titleMr: 'संजय गांधी निराधार व श्रावणबाळ योजना',
    category: 'schemes',
    categoryMr: 'शासकीय योजना',
    tag: 'मासिक पेन्शन',
    summary: 'ज्येष्ठ नागरिक, विधवा, दिव्यांग व निराधार व्यक्तींसाठी मासिक मानधन योजना.',
    keyPoints: [
      '६५ वर्षे पूर्ण ज्येष्ठ नागरिक व निराधार घटकांसाठी योजना',
      'मासिक पेन्शन थेट बँक खात्यात जमा',
      'वयाचा दाखला, उत्पन्नाचा दाखला व रहिवासी आवश्यक',
      'केंद्रावर संपूर्ण अर्ज भरून अचूक कागदपत्रे जोडून दिली जातील'
    ],
    bgGradient: ['#312e81', '#1e1b4b'],
    accentColor: '#a5b4fc',
    badgeText: '🏛️ मासिक मानधन योजना',
    recommendedServices: ['उत्पन्न दाखला', 'वयाचा दाखला', 'पेन्शन अर्ज']
  },

  // 2. Farmer & Agriculture
  {
    id: 'pik-vima-kharif-rabi',
    title: 'Pik Vima Crop Insurance Scheme',
    titleMr: 'प्रधानमंत्री पीक विमा योजना (खरीप / रब्बी)',
    category: 'farmer',
    categoryMr: 'शेती व पीक विमा',
    tag: 'पीक संरक्षण',
    summary: 'नैसर्गिक आपत्ती, अवकाळी पाऊस व दुष्काळात पिकांचे नुकसान भरपाई संरक्षण!',
    keyPoints: [
      'अतिवृष्टी, दुष्काळ व गारपिटीपासून पिकांचे विमा कवच',
      '७/१२, ८-अ, पीक पेरा स्वयंघोषणापत्र व बँक पासबुक आवश्यक',
      'अर्जाची अंतिम मुदत संपण्यापूर्वी त्वरित अर्ज भरा',
      'पावती सुरक्षित ठेवा व नुकसान झाल्यास ७२ तासांत कळवा'
    ],
    bgGradient: ['#15803d', '#052e16'],
    accentColor: '#86efac',
    badgeText: '🛡️ पीक विमा संरक्षण',
    recommendedServices: ['पीक विमा अर्ज', '७/१२ उतारा', '८-अ उतारा', 'बँक पासबुक']
  },
  {
    id: 'e-pik-pahani-mobile',
    title: 'e-Pik Pahani Mobile App Entry',
    titleMr: 'ई-पीक पाहणी नोंदणी (७/१२ वर पिकाची नोंद)',
    category: 'farmer',
    categoryMr: 'शेती व पीक विमा',
    tag: 'महसूल विभाग',
    summary: 'आपल्या शेतातील पिकांची नोंद स्वतःच्या ७/१२ वर वेळेत पूर्ण करा.',
    keyPoints: [
      'पीक विम्याचा लाभ व हमीभाव खरेदीसाठी पीक पाहणी अनिवार्य',
      'शेतात प्रत्यक्ष जाऊन GPS द्वारे पिकाचा अचूक फोटो अपलोड करणे',
      'मिश्र पिके, फळबागा व जलसिंचन साधनांची अचूक नोंद',
      'ई-पीक पाहणी नोंदणीसाठी आपल्या केंद्रास भेट द्या'
    ],
    bgGradient: ['#047857', '#064e3b'],
    accentColor: '#6ee7b7',
    badgeText: '🌾 ७/१२ पीक नोंद',
    recommendedServices: ['ई-पीक पाहणी', '७/१२ उतारा', 'मोबाईल सहाय्य']
  },
  {
    id: 'thibak-tushar-subsidy',
    title: 'Micro Irrigation Drip Subsidy MahaDBT',
    titleMr: 'ठिबक व तुषार सिंचन अनुदान योजना (८०% अनुदान)',
    category: 'farmer',
    categoryMr: 'शेती व पीक विमा',
    tag: 'महाडीबीटी योजना',
    summary: 'अल्प व अत्यल्प भूधारक शेतकऱ्यांसाठी ठिबक सिंचनावर भरघोस सरकारी अनुदान!',
    keyPoints: [
      '८०% पर्यंत थेट बँक खात्यात सरकारी अनुदान उपलब्ध',
      'पाण्याची बचत • उत्पादन वाढ • विजेची बचत',
      '७/१२ उतारा, पाण्याचा दाखला व वीज बिल आवश्यक',
      'महाडीबीटी पोर्टलवर खात्रीशीर लॉटरी अर्ज भरून मिळेल'
    ],
    bgGradient: ['#0e7490', '#164e63'],
    accentColor: '#67e8f9',
    badgeText: '💧 सिंचन अनुदान योजना',
    recommendedServices: ['MahaDBT शेतकरी', '७/१२', '८-अ', 'कोटेशन']
  },
  {
    id: 'satbara-8a-ferfar-download',
    title: 'Digital Satbara 8A Ferfar Extract',
    titleMr: 'डिजिटल स्वाक्षरीत ७/१२, ८-अ व फेरफार उतारा',
    category: 'farmer',
    categoryMr: 'शेती व पीक विमा',
    tag: 'महसूल कागदपत्रे',
    summary: 'सर्व सरकारी कामांसाठी १००% कायदेशीर डिजिटल सहीचा सातबारा तात्काळ मिळेल.',
    keyPoints: [
      'तलाठी कार्यालयात न जाता केंद्रावर २ मिनिटांत उपलब्ध',
      'बँक कर्ज, पीक विमा, खरेदी-विक्री व न्यायालयीन कामांसाठी ग्राह्य',
      'फेरफार उतारा व जुने सातबारे शोधून प्रिंट काढून मिळतील',
      'वॉटरमार्कसह उच्च दर्जाची प्रिंटिंग'
    ],
    bgGradient: ['#166534', '#14532d'],
    accentColor: '#bbf7d0',
    badgeText: '📄 डिजिटल स्वाक्षरीत',
    recommendedServices: ['७/१२ उतारा', '८-अ उतारा', 'फेरफार उतारा', 'हक्कसोड']
  },

  // 3. Aadhaar & PAN Card
  {
    id: 'new-pan-card-service',
    title: 'New PAN Card & Correction',
    titleMr: 'नवीन पॅन कार्ड व पॅन दुरुस्ती सेवा',
    category: 'aadhaar-pan',
    categoryMr: '🪪 आधार व पॅन कार्ड',
    tag: 'आयकर विभाग',
    summary: 'फक्त आधार कार्डवरून अवघ्या काही दिवसांत पॅन कार्ड घरपोच मिळवा.',
    keyPoints: [
      'नवीन पॅन कार्ड (वय १८ वरील व अल्पवयीन मुलांसाठी)',
      'नाव, जन्मतारीख, पत्ता किंवा वडिलांच्या नावात अचूक दुरुस्ती',
      'हरवलेले पॅन कार्ड पुन्हा मिळवून देणे व ई-पॅन तात्काळ डाउनलोड',
      'आधार कार्ड व पॅन कार्ड लिंक स्टेटस तपासून मिळेल'
    ],
    bgGradient: ['#1e40af', '#1e3a8a'],
    accentColor: '#93c5fd',
    badgeText: '🪪 घरपोच पॅन कार्ड',
    recommendedServices: ['नवीन पॅन', 'पॅन दुरुस्ती', 'पॅन-आधार लिंक', 'e-PAN']
  },
  {
    id: 'aadhaar-address-mobile-update',
    title: 'Aadhaar Address & Mobile Link Guide',
    titleMr: 'आधार कार्ड पत्ता दुरुस्ती व पीव्हीसी कार्ड ऑर्डर',
    category: 'aadhaar-pan',
    categoryMr: '🪪 आधार व पॅन कार्ड',
    tag: 'UIDAI सेवा',
    summary: 'आधार कार्डवरील पत्ता दुरुस्ती व अधिकृत ओरिजनल PVC कार्ड मागवा.',
    keyPoints: [
      'घरी बसून येणारे मूळ UIDAI सुरक्षित स्मार्ट PVC आधार कार्ड ऑर्डर',
      'पत्ता बदलण्यासाठी आवश्यक कागदपत्रांचे मार्गदर्शन',
      'आधार बायोमेट्रिक लॉक/अनलॉक व सुरक्षितता तपासणी',
      'आधार कार्ड हरवले असल्यास नंबरवरून शोधून प्रिंट काढून मिळेल'
    ],
    bgGradient: ['#b45309', '#78350f'],
    accentColor: '#fde68a',
    badgeText: '🔒 UIDAI अधिकृत सेवा',
    recommendedServices: ['PVC आधार कार्ड', 'पत्ता दुरुस्ती', 'आधार प्रिंट', 'बायोमेट्रिक लॉक']
  },

  // 4. Banking & AEPS
  {
    id: 'aeps-micro-atm-cash',
    title: 'AEPS Micro ATM Cash Withdrawal',
    titleMr: 'आधारद्वारे पैसे काढणे (AEPS) व मायक्रो एटीएम',
    category: 'banking',
    categoryMr: '💳 बँकिंग व AEPS',
    tag: 'डिजिटल बँकिंग',
    summary: 'कोणत्याही बँकेच्या खात्यातून अंगठ्याचा ठसा लावून किंवा ATM कार्डने तात्काळ पैसे काढा!',
    keyPoints: [
      'सर्व बँकांचे पैसे काढणे व शिल्लक रक्कम (Balance) तपासणे',
      'लाडकी बहीण, पीएम किसान व पेन्शनचे पैसे थेट हातावर मिळवा',
      'मिनी स्टेटमेंट (गेल्या १० व्यवहारांची पावती)',
      'सुरक्षित व विश्वासार्ह व्यवहार • वेळेची बचत'
    ],
    bgGradient: ['#0f172a', '#1e293b'],
    accentColor: '#38bdf8',
    badgeText: '🏧 बँक तुमच्या दारात',
    recommendedServices: ['AEPS अंगठ्यावरून पैसे', 'Micro ATM', 'बँक ट्रान्सफर', 'बॅलन्स चेक']
  },
  {
    id: 'bank-account-opening',
    title: 'Zero Balance Bank Account Opening',
    titleMr: 'झिरो बॅलन्स बँक खाते उघडणे (Zero Balance A/c)',
    category: 'banking',
    categoryMr: '💳 बँकिंग व AEPS',
    tag: 'बँक खाते',
    summary: 'शासकीय अनुदाने व लाभासाठी नवीन बँक खाते अवघ्या १० मिनिटांत सुरू!',
    keyPoints: [
      'आधार कार्ड व पॅन कार्डवरून तात्काळ खाते सुरू',
      'डेबिट कार्ड / ATM कार्ड व पासबुक सुविधा',
      'लाडकी बहीण, शिष्यवृत्ती व शेतकरी योजनांसाठी डीबीटी सक्षम खाते',
      'विद्यार्थी व नागरिकांसाठी सुलभ सोय'
    ],
    bgGradient: ['#1e1b4b', '#312e81'],
    accentColor: '#818cf8',
    badgeText: '🏦 १० मिनिटांत खाते',
    recommendedServices: ['बँक खाते', 'DBT Seeding', 'ATM कार्ड', 'पासबुक']
  },

  // 5. Certificates & Revenue
  {
    id: 'income-certificate-service',
    title: 'Income Certificate Aaple Sarkar',
    titleMr: 'तहसीलदार उत्पन्नाचा दाखला (Income Certificate)',
    category: 'certificates',
    categoryMr: '📜 दाखले व महसूल',
    tag: 'आपले सरकार',
    summary: 'शाळा, कॉलेज प्रवेश, शिष्यवृत्ती व सरकारी योजनांसाठी १ वर्ष / ३ वर्षांचा दाखला.',
    keyPoints: [
      'शिष्यवृत्ती व शैक्षणिक फी सवलतीसाठी अनिवार्य दाखला',
      'रेशन कार्ड, आधार कार्ड, ७/१२ किंवा तलाठी अहवाल आवश्यक',
      'अधिकृत बारकोड व डिजिटल स्वाक्षरीसह दाखला मिळेल',
      'केंद्रावर अचूक अर्ज भरण्याची खात्रीशीर व्यवस्था'
    ],
    bgGradient: ['#701a75', '#4a044e'],
    accentColor: '#f0abfc',
    badgeText: '📜 अधिकृत दाखला',
    recommendedServices: ['उत्पन्न दाखला', 'रहिवासी दाखला', 'MahaDBT', 'रेशन कार्ड']
  },
  {
    id: 'caste-certificate-validity',
    title: 'Caste Certificate & Non Creamy Layer',
    titleMr: 'जात प्रमाणपत्र व नॉन-क्रिमीलेयर दाखला',
    category: 'certificates',
    categoryMr: '📜 दाखले व महसूल',
    tag: 'आरक्षण व सवलत',
    summary: 'नोकरी, स्पर्धा परीक्षा व शैक्षणिक प्रवेशासाठी जात प्रमाणपत्र व नॉन-क्रिमीलेयर.',
    keyPoints: [
      'SC, ST, VJNT, OBC, SBC प्रवर्गासाठी जात प्रमाणपत्र',
      'ओबीसी / एसबीसी उमेदवारांसाठी ३ वर्षांचे नॉन-क्रिमीलेयर',
      '१९६७ / १९६१ पूर्वीचे आवश्यक पुरावे व वंशावळ मार्गदर्शन',
      'आपले सरकार पोर्टलवरून ऑनलाइन अर्ज भरून मिळेल'
    ],
    bgGradient: ['#881337', '#4c0519'],
    accentColor: '#fda4af',
    badgeText: '🎓 शैक्षणिक व नोकरीसाठी',
    recommendedServices: ['जात दाखला', 'Non-Creamy Layer', 'EWS दाखला', 'डोमिसाईल']
  },

  // 6. Education & Recruitment
  {
    id: 'maharashtra-police-recruitment',
    title: 'Maharashtra Police Bharti Online Form',
    titleMr: 'महाराष्ट्र पोलीस भरती ऑनलाइन अर्ज प्रक्रिया सुरू',
    category: 'education-jobs',
    categoryMr: '📚 भरती व शिक्षण',
    tag: 'नोकरी भरती',
    summary: 'पोलीस शिपाई, चालक, बॅन्डमन व SRPF भरतीसाठी ऑनलाइन अर्ज भरून मिळतील.',
    keyPoints: [
      'शैक्षणिक पात्रता: १२ वी उत्तीर्ण (वयोमर्यादा व सूट तपासा)',
      'अचूक फोटो व स्वाक्षरी रिसाइझिंगसह खात्रीशीर फॉर्म सबमिशन',
      'कागदपत्रे: १० वी, १२ वी मार्कशीट, दाखला, जात प्रमाणपत्र, डोमिसाईल',
      'शेवटच्या दिवसांची गर्दी टाळण्यासाठी आजच केंद्रावर अर्ज भरा'
    ],
    bgGradient: ['#1e3a8a', '#0f172a'],
    accentColor: '#38bdf8',
    badgeText: '👮 महा पोलीस भरती',
    recommendedServices: ['पोलीस भरती फॉर्म', 'फोटो रिसाइझ', 'हॉल तिकीट', 'चलन भरणा']
  },
  {
    id: 'mahadbt-post-matric-scholarship',
    title: 'MahaDBT Post Matric Scholarship Scheme',
    titleMr: 'महाडीबीटी पोस्ट मॅट्रिक शिष्यवृत्ती अर्ज',
    category: 'education-jobs',
    categoryMr: '📚 भरती व शिक्षण',
    tag: 'विद्यार्थी शिष्यवृत्ती',
    summary: 'सर्व महाविद्यालयीन विद्यार्थ्यांसाठी ५०% ते १००% फी परतावा शिष्यवृत्ती!',
    keyPoints: [
      'SC, ST, OBC, VJNT, SBC, EBC व SEBC प्रवर्गासाठी योजना',
      'कॉलेज फी माफी व परीक्षा फी थेट बँक खात्यात जमा',
      'बँक खात्याला NPCI आधार लिंकिंग असणे अनिवार्य',
      'नवीन अर्ज व नूतनीकरण (Renewal) अचूक भरून मिळेल'
    ],
    bgGradient: ['#065f46', '#14532d'],
    accentColor: '#a7f3d0',
    badgeText: '🎓 फी सवलत शिष्यवृत्ती',
    recommendedServices: ['MahaDBT अर्ज', 'उत्पन्न दाखला', 'बोनाफाईड', 'आधार सीडिंग']
  },

  // 7. Centre Promotion & Advertisement
  {
    id: 'aaple-sarkar-all-services-centre',
    title: 'Aaple Sarkar CSC All Services Banner',
    titleMr: 'आपले सरकार व सर्व ऑनलाइन सेवा एकाच छताखाली!',
    category: 'centre-ad',
    categoryMr: '📢 केंद्र सेवा जाहिरात',
    tag: 'आपले केंद्र',
    summary: 'वेळेची बचत • खात्रीशीर काम • वाजवी दर • १००% विश्वासार्ह सेवा!',
    keyPoints: [
      'सर्व सरकारी दाखले, रेशन कार्ड, पॅन कार्ड व आधार कामे',
      '७/१२, ८-अ, फेरफार उतारा व पीक विमा अर्ज',
      'बँकिंग पैसे काढणे व ट्रान्सफर, वीज बिल भरणा',
      'कलर जेरॉक्स, लॅमिनेशन व पासपोर्ट फोटो सोय'
    ],
    bgGradient: ['#1e293b', '#0f172a'],
    accentColor: '#f59e0b',
    badgeText: '⭐ सर्व सेवा एकाच ठिकाणी',
    recommendedServices: ['दाखले', '७/१२', 'पॅन', 'आधार', 'बँकिंग', 'जेरॉक्स']
  },
  {
    id: 'smart-pvc-card-printing-service',
    title: 'Smart PVC Card Lamination Printing',
    titleMr: 'स्मार्ट PVC कार्ड प्रिंटिंग व लॅमिनेशन सुविधा उपलब्ध',
    category: 'centre-ad',
    categoryMr: '📢 केंद्र सेवा जाहिरात',
    tag: 'स्मार्ट कार्ड',
    summary: 'कागदी ओळखपत्रांचे रूपांतर करा वॉटरप्रूफ ओरिजनल PVC कार्डमध्ये!',
    keyPoints: [
      'आधार कार्ड, पॅन कार्ड, ड्रायव्हिंग लायसन्स, मतदार कार्ड, शेतकरी कार्ड',
      'वॉटरप्रूफ • कधीही खराब न होणारे • खिशात ठेवण्यास सोपे',
      'उच्च दर्जाचे फोटो लॅमिनेशन व टिकाऊ फिनिशिंग',
      'अवघ्या ५ मिनिटांत केंद्रावर कार्ड तयार करून मिळेल'
    ],
    bgGradient: ['#3b0764', '#1e1b4b'],
    accentColor: '#e9d5ff',
    badgeText: '🪪 वॉटरप्रूफ स्मार्ट कार्ड',
    recommendedServices: ['PVC प्रिंट', 'लॅमिनेशन', 'कटर शीट', 'आयकार्ड']
  }
];

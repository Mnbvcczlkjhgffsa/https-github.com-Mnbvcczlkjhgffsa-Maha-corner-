export interface PortalLink {
  id: string;
  category: string;
  categoryEn: string;
  name: string;
  marathiName: string;
  description: string;
  descriptionEn: string;
  url: string;
  badge?: string;
  badgeEn?: string;
  iconName: string;
}

export const PORTAL_LINKS: PortalLink[] = [
  {
    id: 'bhulekh',
    category: 'जमीन व महसूल',
    categoryEn: 'Land & Revenue',
    name: 'Mahabhulekh 7/12, 8-A & Ferfar',
    marathiName: 'महाभूलेख (७/१२, ८-अ, फेरफार उतारा)',
    description: 'डिजिटल स्वाक्षरीत व विना-स्वाक्षरीत सातबारा व आठ-अ उतारा पहा आणि डाउनलोड करा.',
    descriptionEn: 'View and download digitally signed and unsigned 7/12, 8-A, and Ferfar land extracts.',
    url: 'https://bhulekh.mahabhumi.gov.in',
    badge: 'सर्वाधिक वापरले',
    badgeEn: 'Most Popular',
    iconName: 'FileText'
  },
  {
    id: 'aaplesarkar',
    category: 'प्रमाणपत्रे व दाखले',
    categoryEn: 'Certificates & Citizen Services',
    name: 'Aaple Sarkar (Citizen Portal)',
    marathiName: 'आपले सरकार (नागरी सेवा पोर्टल)',
    description: 'उत्पन्नाचा दाखला, रहिवासी, जात प्रमाणपत्र, नॉन-क्रिमीलेयर इत्यादी सर्व दाखले मिळवा.',
    descriptionEn: 'Apply online for Income, Domicile, Caste, Non-Creamy Layer, and Age/Nationality certificates.',
    url: 'https://aaplesarkar.mahaonline.gov.in',
    badge: 'महत्त्वाचे',
    badgeEn: 'Essential',
    iconName: 'Building2'
  },
  {
    id: 'mahadbt',
    category: 'योजना व शिष्यवृत्ती',
    categoryEn: 'Schemes & Scholarships',
    name: 'MahaDBT Farmer & Scholarship',
    marathiName: 'महाडीबीटी (शिष्यवृत्ती व शेतकरी योजना)',
    description: 'पोस्ट मॅट्रिक शिष्यवृत्ती, शेती यांत्रिकीकरण, ठिबक सिंचन अनुदान, बी-बियाणे योजना अर्ज.',
    descriptionEn: 'Apply for Post-Matric Scholarships, Farm Mechanization, Drip Irrigation subsidies & Seeds.',
    url: 'https://mahadbt.maharashtra.gov.in',
    badge: 'अनुदान',
    badgeEn: 'Subsidy',
    iconName: 'GraduationCap'
  },
  {
    id: 'ladkibahin',
    category: 'शासकीय योजना',
    categoryEn: 'Government Schemes',
    name: 'Majhi Ladki Bahin Yojana Portal',
    marathiName: 'माझी लाडकी बहीण योजना पोर्टल',
    description: 'महाराष्ट्र शासनाची महिलांसाठी थेट बँक खात्यात आर्थिक लाभ देणारी योजना.',
    descriptionEn: 'Maharashtra Government direct financial benefit scheme for eligible women citizens.',
    url: 'https://ladakibahin.maharashtra.gov.in',
    badge: 'योजना',
    badgeEn: 'Scheme',
    iconName: 'HeartHandshake'
  },
  {
    id: 'uidai',
    category: 'ओळखपत्र सेवा',
    categoryEn: 'Identity Services',
    name: 'My Aadhaar (UIDAI)',
    marathiName: 'माय आधार (UIDAI)',
    description: 'आधार कार्ड डाउनलोड, पत्ता अपडेट, पीव्हीसी कार्ड ऑर्डर व ई-केवायसी पडताळणी.',
    descriptionEn: 'Download e-Aadhaar, update address, order PVC card, and check Aadhaar-bank linking.',
    url: 'https://myaadhaar.uidai.gov.in',
    badge: 'अधिकृत',
    badgeEn: 'Official',
    iconName: 'CreditCard'
  },
  {
    id: 'pan',
    category: 'ओळखपत्र सेवा',
    categoryEn: 'Identity Services',
    name: 'Protean / NSDL PAN Portal',
    marathiName: 'नवीन पॅन कार्ड व दुरुस्ती (Protean/UTI)',
    description: 'नवीन पॅन कार्ड अर्ज, पॅन-आधार लिंक स्थिती तपासणे व ई-पॅन डाउनलोड.',
    descriptionEn: 'New PAN application, correction/reprint, PAN-Aadhaar linking check & e-PAN download.',
    url: 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html',
    iconName: 'FileCheck'
  },
  {
    id: 'eshram',
    category: 'कामगार व कल्याण',
    categoryEn: 'Labour & Welfare',
    name: 'e-Shram Card Registration',
    marathiName: 'ई-श्रम कार्ड नोंदणी',
    description: 'असंघटित कामगारांसाठी मोफत ई-श्रम कार्ड नोंदणी व अपडेट.',
    descriptionEn: 'Free registration and profile updates for unorganized sector workers across India.',
    url: 'https://eshram.gov.in',
    iconName: 'Users'
  },
  {
    id: 'ayushman',
    category: 'आरोग्य',
    categoryEn: 'Healthcare',
    name: 'Ayushman Bharat (PM-JAY)',
    marathiName: 'आयुष्मान भारत (PM-JAY)',
    description: '५ लाख रुपयांपर्यंत मोफत उपचारासाठी आयुष्मान गोल्डन कार्ड डाउनलोड व पात्रता.',
    descriptionEn: 'Check eligibility and download Ayushman Golden Card for up to Rs. 5 Lakh cashless treatment.',
    url: 'https://beneficiary.nha.gov.in',
    badge: 'आरोग्य',
    badgeEn: 'Health',
    iconName: 'ShieldCheck'
  },
  {
    id: 'mahadiscom',
    category: 'उपयुक्त सेवा',
    categoryEn: 'Utility Services',
    name: 'MSEDCL Mahavitaran Billing',
    marathiName: 'महावितरण वीज बिल भरणा',
    description: 'ऑनलाइन वीज बिल भरणे, नवीन वीज जोडणी अर्ज व बिल पावती मिळवणे.',
    descriptionEn: 'Pay electricity bills online, apply for new meter connection & download bill receipts.',
    url: 'https://www.mahadiscom.in',
    iconName: 'Zap'
  },
  {
    id: 'policebharti',
    category: 'नोकरी व भरती',
    categoryEn: 'Jobs & Recruitment',
    name: 'Maharashtra Police Recruitment Portal',
    marathiName: 'महाराष्ट्र पोलीस भरती अधिकृत पोर्टल',
    description: 'पोलीस शिपाई, चालक, बॅन्डमन व SRPF भरती जाहिरात, हॉल तिकीट व निकाल.',
    descriptionEn: 'Official notifications, hall tickets & results for Police Constable, Driver & SRPF Bharti.',
    url: 'https://www.mahapolice.gov.in',
    badge: 'भरती',
    badgeEn: 'Bharti',
    iconName: 'Briefcase'
  }
];

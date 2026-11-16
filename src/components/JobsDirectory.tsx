import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Search,
  ExternalLink,
  Calendar,
  FileText,
  Share2,
  Copy,
  Check,
  Bookmark,
  Eye,
  X,
  Plus,
  Lock,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Printer,
  GraduationCap,
  Building2,
  TrainFront,
  Landmark,
  BadgeCheck,
  Clock,
  RefreshCw,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink, buildWhatsAppShareUrl } from '../utils/shareConfig';
import { escapeHtml, sanitizeExternalUrl } from '../utils/pdfSecurity';

export type JobStatus = 'active' | 'upcoming';

export type JobCategory =
  | 'महाराष्ट्र शासन (MPSC/सरळसेवा)'
  | 'पोलीस व संरक्षण'
  | 'रेल्वे (RRB)'
  | 'बँकिंग (IBPS/SBI)'
  | 'केंद्र सरकार (SSC/UPSC)'
  | 'शिक्षण व आरोग्य';

const JOB_CATEGORY_EN_MAP: Record<'सर्व' | JobCategory, string> = {
  'सर्व': 'All Categories',
  'महाराष्ट्र शासन (MPSC/सरळसेवा)': 'Maharashtra Govt (MPSC/State)',
  'पोलीस व संरक्षण': 'Police & Defence (Army/Navy)',
  'रेल्वे (RRB)': 'Indian Railways (RRB)',
  'बँकिंग (IBPS/SBI)': 'Banking (IBPS/SBI)',
  'केंद्र सरकार (SSC/UPSC)': 'Central Govt (SSC/UPSC)',
  'शिक्षण व आरोग्य': 'Education & Health (ZP/Arogya)'
};

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  category: JobCategory;
  status: JobStatus;
  vacancies: string;
  qualification: string;
  ageLimit: string;
  startDate: string;
  lastDate: string;
  examOrNoticeInfo: string;
  grRef: string;
  grUrl: string;
  applyUrl: string;
  officialPortalName: string;
  summary: string;
  documentsRequired: string[];
  isOwnerAdded?: boolean;
}

interface LiveRecruitmentGr {
  id: string;
  title: string;
  grCode: string;
  date: string;
  officialDepartment: string;
  fileSizeKb?: string;
  pdfUrl: string;
}

const STORAGE_JOBS_KEY = 'maha_corner_custom_jobs_list_v1';
const SAVED_JOB_IDS_KEY = 'maha_corner_bookmarked_job_ids_v1';

const INITIAL_JOBS_LIST: JobPosting[] = [
  {
    id: 'job-mpsc-group-c-2026',
    title: 'MPSC गट-क सेवा संयुक्त पूर्व परीक्षा २०२६ (तलाठी, लिपिक-टंकलेखक, कर सहाय्यक)',
    department: 'महाराष्ट्र लोकसेवा आयोग (MPSC) • २५ शासकीय विभाग',
    category: 'महाराष्ट्र शासन (MPSC/सरळसेवा)',
    status: 'active',
    vacancies: '१६,७१७+ पदे (तलाठी / ग्राम महसूल अधिकारी ~१,८४० पदे समाविष्ट)',
    qualification: 'कोणत्याही शाखेतील पदवी (काही तांत्रिक पदांसाठी विशेष पात्रता)',
    ageLimit: '१८ ते ३८ वर्षे (मागासवर्गीय व आरक्षित प्रवर्गासाठी ५ वर्षे सूट)',
    startDate: '१३/११/२०२६',
    lastDate: '२७/११/२०२६ (शुल्क भरणा: ३०/११/२०२६)',
    examOrNoticeInfo: 'पूर्व परीक्षा दिनांक: २४ जानेवारी २०२७',
    grRef: 'जाहिरात क्र. ०१७/२०२६ • सामान्य प्रशासन व महसूल विभाग GR',
    grUrl: 'https://gr.maharashtra.gov.in/1145/Government-Resolutions',
    applyUrl: 'https://mpsconline.gov.in',
    officialPortalName: 'mpsconline.gov.in / mpsc.gov.in',
    summary:
      'महाराष्ट्र लोकसेवा आयोगामार्फत महसूल विभागातील तलाठी (ग्राम महसूल अधिकारी), कर सहाय्यक, लिपिक-टंकलेखक व इतर गट-क संवर्गातील मेगा भरतीसाठी ऑनलाइन अर्ज व पदपसंतीक्रम प्रक्रिया सुरू आहे.',
    documentsRequired: [
      'MPSC प्रोफाईल नोंदणी',
      'पदवी प्रमाणपत्र व गुणपत्रिका',
      'आधार कार्ड व फोटो-सही',
      'जात / EWS / नॉन-क्रिमीलेअर प्रमाणपत्र',
      'मराठी-इंग्रजी टंकलेखन प्रमाणपत्र (लागू पदांसाठी)'
    ]
  },
  {
    id: 'job-rrb-isolated-apprentice-2026',
    title: 'रेल्वे भरती बोर्ड (RRB) – आयसोलेटेड / मिनिस्टेरिअल व मध्य रेल्वे शिकाऊ उमेदवार भरती',
    department: 'भारतीय रेल्वे (RRB / Central Railway)',
    category: 'रेल्वे (RRB)',
    status: 'active',
    vacancies: 'विविध झोननिहाय रिक्त पदे व अ‍ॅप्रेंटिस जागा',
    qualification: '१०वी उत्तीर्ण + ITI / पदवी / पदविका (पदानुसार)',
    ageLimit: '१८ ते ३३ वर्षे (ओबीसी +३, एससी/एसटी +५ वर्षे सूट)',
    startDate: 'नोव्हेंबर २०२६',
    lastDate: 'नोव्हेंबर अखेरीस / डिसेंबर २०२६ पहिल्या आठवड्यापर्यंत',
    examOrNoticeInfo: 'संगणक आधारित चाचणी (CBT) व गुणवत्तेनुसार निवड',
    grRef: 'केंद्रीय रेल्वे भरती अधिसूचना (CEN) २०२६',
    grUrl: 'https://www.rrbcdg.gov.in/',
    applyUrl: 'https://www.rrbapply.gov.in/',
    officialPortalName: 'rrbapply.gov.in',
    summary:
      'भारतीय रेल्वेच्या विविध विभागांतर्गत आयसोलेटेड व मिनिस्टेरिअल संवर्ग तसेच मध्य रेल्वे शिकाऊ उमेदवार (Apprentice) पदांसाठी ऑनलाइन अर्ज प्रक्रिया सक्रिय आहे.',
    documentsRequired: [
      '१०वी व ITI गुणपत्रिका',
      'आधार कार्ड व पासपोर्ट फोटो',
      'जात प्रमाणपत्र (लागू असल्यास)',
      'ई-मेल आयडी व मोबाईल नंबर'
    ]
  },
  {
    id: 'job-indian-army-agniveer-2026',
    title: 'भारतीय लष्कर (Indian Army) अग्निवीर रॅली २०२६–२७ (GD, Technical, Clerk, Tradesman)',
    department: 'भारतीय लष्कर (Indian Army / ZRO-ARO महाराष्ट्र व गोवा)',
    category: 'पोलीस व संरक्षण',
    status: 'active',
    vacancies: 'ARO निहाय (पुणे, नागपूर, कोल्हापूर, छ. संभाजीनगर, मुंबई) रॅली पदे',
    qualification: '८वी / १०वी / १२वी उत्तीर्ण (पदानुसार पात्रता)',
    ageLimit: '१७.५ ते २१/२२ वर्षे (नियमांनुसार)',
    startDate: 'ARO रॅली वेळापत्रक २०२६–२७ सुरू',
    lastDate: 'एप्रिल २०२७ पर्यंत विविध टप्प्यांत ARO रॅली',
    examOrNoticeInfo: 'ऑनलाइन CEE परीक्षा व ARO शारीरिक मैदानी/वैद्यकीय चाचणी',
    grRef: 'संरक्षण मंत्रालय अग्निवीर भरती अधिसूचना (RY 2026-27)',
    grUrl: 'https://joinindianarmy.nic.in/',
    applyUrl: 'https://joinindianarmy.nic.in/',
    officialPortalName: 'joinindianarmy.nic.in',
    summary:
      'भारतीय लष्कराच्या अग्निवीर जनरल ड्युटी (GD), टेक्निकल, क्लर्क व ट्रेड्समन पदांसाठी ARO-निहाय शारीरिक चाचणी (रॅली), कागदपत्र पडताळणी व रिलेशन भरती अपडेट्स.',
    documentsRequired: [
      'ऑनलाइन प्रवेशपत्र (Admit Card)',
      '८वी / १०वी / १२वी गुणपत्रिका',
      'अधिवास (Domicile) व जात प्रमाणपत्र',
      'शाळा सोडल्याचा दाखला व पोलीस चारित्र्य दाखला',
      'NCC / खेळाडू प्रमाणपत्र (असल्यास)'
    ]
  },
  {
    id: 'job-bank-apprentice-officer-2026',
    title: 'राष्ट्रीयकृत बँक (IBPS RRB / Bank of Baroda / Indian Bank) अधिकारी व अ‍ॅप्रेंटिस भरती',
    department: 'सार्वजनिक क्षेत्रातील बँका (PSU Banks & IBPS)',
    category: 'बँकिंग (IBPS/SBI)',
    status: 'active',
    vacancies: 'विविध राज्यांतर्गत बँक शाखा पदे',
    qualification: 'कोणत्याही शाखेतील मान्यताप्राप्त पदवी',
    ageLimit: '२० ते ३० वर्षे (शासकीय नियमांनुसार वयोमर्यादा सूट)',
    startDate: 'नोव्हेंबर २०२६',
    lastDate: 'नोव्हेंबर व डिसेंबर २०२६ (पदानुसार अंतिम मुदत)',
    examOrNoticeInfo: 'IBPS Clerk मुख्य परीक्षा: २७ डिसेंबर २०२६ रोजी नियोजित',
    grRef: 'वित्त मंत्रालय / IBPS अधिकृत भरती परिपत्रक २०२६',
    grUrl: 'https://www.ibps.in/',
    applyUrl: 'https://www.ibps.in/',
    officialPortalName: 'ibps.in',
    summary:
      'देशातील आघाडीच्या सार्वजनिक क्षेत्रातील बँकांमध्ये अधिकारी व अ‍ॅप्रेंटिस पदांसाठी ऑनलाइन अर्ज तसेच IBPS लिपिक व पीओ मुख्य परीक्षेचे वेळापत्रक प्रसिद्ध झाले आहे.',
    documentsRequired: [
      'पदवी गुणपत्रिका',
      'आधार / पॅन कार्ड',
      'फोटो, सही व डाव्या अंगठ्याचा ठसा',
      'हस्तलिखित प्रतिज्ञापत्र (Handwritten Declaration)'
    ]
  },
  {
    id: 'job-maharashtra-police-upcoming-2026',
    title: 'महाराष्ट्र राज्य पोलीस शिपाई, चालक व SRPF भरती (आगामी टप्पा)',
    department: 'गृह विभाग, महाराष्ट्र शासन',
    category: 'पोलीस व संरक्षण',
    status: 'upcoming',
    vacancies: 'जिल्हानिहाय घटक प्रमुख आकृतीबंधानुसार रिक्त पदे',
    qualification: '१२वी उत्तीर्ण (चालक पदासाठी अवजड/हलके वाहन चालक परवाना आवश्यक)',
    ageLimit: '१८ ते २८ वर्षे (मागासवर्गीय ३३ वर्षांपर्यंत व शासनाच्या विशेष वयोमर्यादा GR नुसार)',
    startDate: 'आगामी जाहिरात (लवकरच)',
    lastDate: 'अधिकृत जाहिरातीनंतर प्रसिद्ध होणार',
    examOrNoticeInfo: 'प्रथम शारीरिक चाचणी (मैदानी) व त्यानंतर लेखी परीक्षा',
    grRef: 'गृह विभाग पोलीस पदभरती शासन निर्णय व वयोमर्यादा आदेश',
    grUrl: 'https://gr.maharashtra.gov.in/1145/Government-Resolutions',
    applyUrl: 'https://www.mahapolice.gov.in/',
    officialPortalName: 'mahapolice.gov.in',
    summary:
      'राज्यातील विविध पोलीस आयुक्तालय, जिल्हा पोलीस अधीक्षक कार्यालये व राज्य राखीव पोलीस दलातील (SRPF) रिक्त पोलीस शिपाई व चालक पदांच्या आगामी भरती प्रक्रियेसाठी तयारी व GR संदर्भ.',
    documentsRequired: [
      '१०वी व १२वी उत्तीर्ण प्रमाणपत्र',
      'डोमिसाईल (अधिवास) प्रमाणपत्र',
      'जात व नॉन-क्रिमीलेअर प्रमाणपत्र',
      'वाहन चालक परवाना (चालक पदासाठी)',
      'NCC / खेळाडू / प्रकल्पग्रस्त प्रमाणपत्र (लागू असल्यास)'
    ]
  },
  {
    id: 'job-zp-arogya-upcoming-2026',
    title: 'जिल्हा परिषद (ZP) व सार्वजनिक आरोग्य विभाग – ग्रामसेवक, आरोग्य सेवक व तांत्रिक पदे',
    department: 'ग्रामविकास व सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन',
    category: 'शिक्षण व आरोग्य',
    status: 'upcoming',
    vacancies: 'राज्यस्तरीय व जिल्हास्तरीय रिक्त तांत्रिक संवर्ग पदे',
    qualification: '१०वी / १२वी विज्ञान / डिप्लोमा / B.Sc Nursing / ANM / GNM',
    ageLimit: '१८ ते ३८ वर्षे (आरक्षित प्रवर्ग ४३ वर्षे)',
    startDate: 'आगामी सूचना (लवकरच)',
    lastDate: 'अधिकृत वेळापत्रकानुसार',
    examOrNoticeInfo: 'जिल्हास्तरीय बिंदुनामावली व पदभरती GR नुसार परीक्षा',
    grRef: 'ग्रामविकास विभाग व आरोग्य विभाग पदभरती शासन निर्णय',
    grUrl: 'https://gr.maharashtra.gov.in/1145/Government-Resolutions',
    applyUrl: 'https://rdd.maharashtra.gov.in/',
    officialPortalName: 'rdd.maharashtra.gov.in / arogya.maharashtra.gov.in',
    summary:
      'जिल्हा परिषद अंतर्गत ग्रामसेवक, आरोग्य सेवक-सेविका, अंगणवाडी पर्यवेक्षिका तसेच आरोग्य विभागातील विविध तांत्रिक पदांच्या आगामी भरतीसाठीचे शासन निर्णय व पात्रता संदर्भ.',
    documentsRequired: [
      'शैक्षणिक पात्रता व तांत्रिक नोंदणी प्रमाणपत्र',
      'अधिवास व जात वैधता प्रमाणपत्र',
      'लहान कुटुंबाचे प्रतिज्ञापत्र',
      'MS-CIT / संगणक अर्हता प्रमाणपत्र'
    ]
  },
  {
    id: 'job-ssc-gd-chsl-2026',
    title: 'कर्मचारी निवड आयोग (SSC) – CHSL परीक्षा व आगामी GD कॉन्स्टेबल / MTS भरती चक्र',
    department: 'कर्मचारी निवड आयोग (SSC), भारत सरकार',
    category: 'केंद्र सरकार (SSC/UPSC)',
    status: 'upcoming',
    vacancies: 'देशभरात हजारो केंद्रीय पदे (BSF, CISF, CRPF, मंत्रालये)',
    qualification: '१०वी व १२वी उत्तीर्ण (पदानुसार)',
    ageLimit: '१८ ते २७ वर्षे (SC/ST +५ वर्षे, OBC +३ वर्षे)',
    startDate: 'SSC CHSL परीक्षा: ३० नोव्हेंबर ते ३१ डिसेंबर २०२६ · GD आगामी चक्र',
    lastDate: 'SSC वार्षिक वेळापत्रकानुसार',
    examOrNoticeInfo: 'मराठी भाषेतूनही संगणक आधारित परीक्षा (CBT) देण्याची सुविधा उपलब्ध',
    grRef: 'SSC वार्षिक परीक्षा कॅलेंडर व अधिकृत अधिसूचना २०२६-२७',
    grUrl: 'https://ssc.gov.in/',
    applyUrl: 'https://ssc.gov.in/',
    officialPortalName: 'ssc.gov.in',
    summary:
      'केंद्र शासनाच्या विविध मंत्रालये, विभाग आणि केंद्रीय सशस्त्र पोलीस दलातील (CAPF) कॉन्स्टेबल व लिपिक पदांच्या आगामी परीक्षा व भरती चक्राची अधिकृत माहिती.',
    documentsRequired: [
      'SSC OTR (One Time Registration)',
      '१०वी / १२वी गुणपत्रिका',
      'आधार कार्ड व केंद्रीय नमुन्यातील जात प्रमाणपत्र'
    ]
  },
  {
    id: 'job-upsc-cds-nda-2026',
    title: 'संघ लोकसेवा आयोग (UPSC) – NDA, CDS व नागरी सेवा आगामी भरती वेळापत्रक',
    department: 'संघ लोकसेवा आयोग (UPSC)',
    category: 'केंद्र सरकार (SSC/UPSC)',
    status: 'upcoming',
    vacancies: 'केंद्रीय अधिकारी, लष्कर, नौदल व हवाई दल अधिकारी पदे',
    qualification: '१२वी उत्तीर्ण (NDA) / पदवी उत्तीर्ण (CDS / नागरी सेवा)',
    ageLimit: '१६.५ ते ३२ वर्षे (परीक्षानुसार भिन्न)',
    startDate: 'UPSC वार्षिक कॅलेंडर २०२६-२७ नुसार',
    lastDate: 'अधिकृत जाहिरातीनुसार',
    examOrNoticeInfo: 'केंद्रीय स्तरावर लेखी परीक्षा व मुलाखत / SSB चाचणी',
    grRef: 'UPSC अधिकृत परीक्षा अधिसूचना व कॅलेंडर',
    grUrl: 'https://upsc.gov.in/',
    applyUrl: 'https://upsconline.nic.in/',
    officialPortalName: 'upsc.gov.in / upsconline.nic.in',
    summary:
      'संरक्षण दले (NDA, CDS) तसेच भारतीय प्रशासकीय व पोलीस सेवेतील आगामी केंद्रीय परीक्षांच्या नोंदणीसाठी अधिकृत पोर्टल व GR संदर्भ.',
    documentsRequired: [
      'UPSC OTR नोंदणी',
      '१०वी, १२वी / पदवी प्रमाणपत्र',
      'ओळखपत्र (आधार/पासपोर्ट/पॅन)'
    ]
  }
];

const CATEGORIES: ('सर्व' | JobCategory)[] = [
  'सर्व',
  'महाराष्ट्र शासन (MPSC/सरळसेवा)',
  'पोलीस व संरक्षण',
  'रेल्वे (RRB)',
  'बँकिंग (IBPS/SBI)',
  'केंद्र सरकार (SSC/UPSC)',
  'शिक्षण व आरोग्य'
];

const CATEGORY_ICON_MAP: Record<JobCategory, React.ReactNode> = {
  'महाराष्ट्र शासन (MPSC/सरळसेवा)': <Landmark className="w-4 h-4 text-amber-600" />,
  'पोलीस व संरक्षण': <ShieldCheck className="w-4 h-4 text-red-600" />,
  'रेल्वे (RRB)': <TrainFront className="w-4 h-4 text-sky-600" />,
  'बँकिंग (IBPS/SBI)': <Building2 className="w-4 h-4 text-emerald-600" />,
  'केंद्र सरकार (SSC/UPSC)': <BadgeCheck className="w-4 h-4 text-indigo-600" />,
  'शिक्षण व आरोग्य': <GraduationCap className="w-4 h-4 text-teal-600" />
};

interface QuickPortalItem {
  name: string;
  nameEn: string;
  url: string;
  desc: string;
  descEn: string;
}

const QUICK_JOB_PORTALS: QuickPortalItem[] = [
  {
    name: 'MPSC ऑनलाइन अर्ज',
    nameEn: 'MPSC Online Portal',
    url: 'https://mpsconline.gov.in',
    desc: 'गट-अ, ब, क व तलाठी भरती',
    descEn: 'Group A, B, C & Talathi'
  },
  {
    name: 'महाराष्ट्र शासन GR पोर्टल',
    nameEn: 'Maharashtra GR Portal',
    url: 'https://gr.maharashtra.gov.in/1145/Government-Resolutions',
    desc: 'पदभरती व सेवा नियम GR',
    descEn: 'Recruitment & Service GRs'
  },
  {
    name: 'महाराष्ट्र पोलीस भरती',
    nameEn: 'Maharashtra Police',
    url: 'https://www.mahapolice.gov.in/',
    desc: 'पोलीस शिपाई व चालक भरती',
    descEn: 'Constable & Driver Recruitment'
  },
  {
    name: 'SSC अधिकृत पोर्टल',
    nameEn: 'SSC Official Portal',
    url: 'https://ssc.gov.in/',
    desc: 'CHSL, CGL, GD, MTS भरती',
    descEn: 'CHSL, CGL, GD, MTS'
  },
  {
    name: 'रेल्वे भरती (RRB Apply)',
    nameEn: 'Railway (RRB Apply)',
    url: 'https://www.rrbapply.gov.in/',
    desc: 'NTPC, ALP व तांत्रिक भरती',
    descEn: 'NTPC, ALP & Technical'
  },
  {
    name: 'IBPS बँक भरती',
    nameEn: 'IBPS Bank Exams',
    url: 'https://www.ibps.in/',
    desc: 'PO, Clerk व RRB बँकिंग',
    descEn: 'PO, Clerk & RRB Banking'
  }
];

interface CentralDefenceUpdate {
  id: string;
  forceName: string;
  forceNameEn: string;
  badgeText: string;
  badgeTextEn: string;
  isLiveActive: boolean;
  updateTitle: string;
  updateTitleEn: string;
  eligibility: string;
  eligibilityEn: string;
  portalLabel: string;
  portalUrl: string;
  noticeUrl: string;
}

const CENTRAL_DEFENCE_BOX_UPDATES: CentralDefenceUpdate[] = [
  {
    id: 'cd-army',
    forceName: 'इंडियन आर्मी (Indian Army)',
    forceNameEn: 'Indian Army (Join Indian Army)',
    badgeText: 'ARO रॅली व अग्निवीर २०२६–२७',
    badgeTextEn: 'ARO Rally & Agniveer 2026–27',
    isLiveActive: true,
    updateTitle: 'अग्निवीर GD, टेक्निकल, क्लर्क व रिलेशन भरती रॅली व फिजिकल अपडेट्स',
    updateTitleEn: 'Agniveer GD, Technical, Clerk & Relation Rally / Physical Updates',
    eligibility: 'पात्रता: ८वी / १०वी / १२वी · वय: १७.५ ते २१/२२ वर्षे',
    eligibilityEn: 'Eligibility: 8th / 10th / 12th · Age: 17.5 to 21/22 Years',
    portalLabel: 'joinindianarmy.nic.in',
    portalUrl: 'https://joinindianarmy.nic.in/',
    noticeUrl: 'https://joinindianarmy.nic.in/'
  },
  {
    id: 'cd-airforce',
    forceName: 'भारतीय वायुदल (Air Force)',
    forceNameEn: 'Indian Air Force (Agnipath)',
    badgeText: 'अग्निवीरवायू (Agniveervayu)',
    badgeTextEn: 'Agniveervayu Intake 02/2027',
    isLiveActive: true,
    updateTitle: 'Agniveervayu Intake 02/2027 निवड प्रक्रिया व आगामी बॅच सूचना',
    updateTitleEn: 'Agniveervayu Intake 02/2027 Selection & Upcoming Batch Notices',
    eligibility: 'पात्रता: १२वी (विज्ञान/इंग्रजी) किंवा डिप्लोमा · वय: १७.५ ते २१/२२ वर्षे',
    eligibilityEn: 'Eligibility: 12th (Science/English) or Diploma · Age: 17.5–21/22',
    portalLabel: 'agnipathvayu.cdac.in',
    portalUrl: 'https://agnipathvayu.cdac.in/',
    noticeUrl: 'https://indianairforce.nic.in/'
  },
  {
    id: 'cd-navy',
    forceName: 'भारतीय नौदल (Indian Navy)',
    forceNameEn: 'Indian Navy (SSR / MR)',
    badgeText: 'SSR / MR अग्निवीर भरती',
    badgeTextEn: 'SSR / MR Agniveer Recruitment',
    isLiveActive: false,
    updateTitle: 'नौदल SSR व MR नवीन बॅच ऑनलाइन परीक्षा, PFT व वैद्यकीय अपडेट्स',
    updateTitleEn: 'Navy SSR & MR New Batch Exam, PFT & Medical Schedule Updates',
    eligibility: 'पात्रता: १०वी (MR) / १२वी विज्ञान (SSR)',
    eligibilityEn: 'Eligibility: 10th Pass (MR) / 12th Science (SSR)',
    portalLabel: 'joinindiannavy.gov.in',
    portalUrl: 'https://www.joinindiannavy.gov.in/',
    noticeUrl: 'https://www.joinindiannavy.gov.in/'
  },
  {
    id: 'cd-capf',
    forceName: 'BSF · CRPF · CISF · SSB · ITBP',
    forceNameEn: 'BSF · CRPF · CISF · SSB · ITBP',
    badgeText: 'CAPF व SSC GD कॉन्स्टेबल',
    badgeTextEn: 'CAPF & SSC GD Constable',
    isLiveActive: true,
    updateTitle: 'निमलष्करी दलात माजी अग्निवीर ५०% आरक्षण धोरण व SSC GD कॉन्स्टेबल भरती',
    updateTitleEn: 'Paramilitary Forces Ex-Agniveer 50% Quota Policy & SSC GD Constable',
    eligibility: 'पात्रता: १०वी उत्तीर्ण · गृह मंत्रालय (MHA) अधिसूचना',
    eligibilityEn: 'Eligibility: 10th Pass · Ministry of Home Affairs (MHA) Notice',
    portalLabel: 'ssc.gov.in / rectt.bsf.gov.in',
    portalUrl: 'https://ssc.gov.in/',
    noticeUrl: 'https://rectt.bsf.gov.in/'
  },
  {
    id: 'cd-railway',
    forceName: 'भारतीय रेल्वे (RRB / मध्य रेल्वे)',
    forceNameEn: 'Indian Railways (RRB / Central)',
    badgeText: 'NTPC · आयसोलेटेड · अ‍ॅप्रेंटिस',
    badgeTextEn: 'NTPC · Isolated · Apprentice',
    isLiveActive: true,
    updateTitle: 'RRB आयसोलेटेड / मिनिस्टेरिअल व मध्य रेल्वे शिकाऊ उमेदवार अर्ज सुरू',
    updateTitleEn: 'RRB Isolated / Ministerial & Central Railway Apprentice Applications Live',
    eligibility: 'पात्रता: १०वी + ITI / पदवीधर',
    eligibilityEn: 'Eligibility: 10th + ITI / Graduate',
    portalLabel: 'rrbapply.gov.in',
    portalUrl: 'https://www.rrbapply.gov.in/',
    noticeUrl: 'https://www.rrbcdg.gov.in/'
  },
  {
    id: 'cd-post-ssc',
    forceName: 'केंद्रीय SSC व इंडिया पोस्ट (GDS)',
    forceNameEn: 'Central SSC & India Post (GDS)',
    badgeText: 'SSC CHSL · MTS · टपाल विभाग',
    badgeTextEn: 'SSC CHSL · MTS · Postal GDS',
    isLiveActive: true,
    updateTitle: 'SSC CHSL परीक्षा (३० नोव्हें - ३१ डिसें २०२६) व ग्रामीण डाक सेवक अपडेट्स',
    updateTitleEn: 'SSC CHSL Exam Window (Nov–Dec 2026) & Gramin Dak Sevak Updates',
    eligibility: 'पात्रता: १०वी / १२वी उत्तीर्ण · मराठी भाषेत परीक्षा',
    eligibilityEn: 'Eligibility: 10th / 12th Pass · Exam available in Marathi',
    portalLabel: 'ssc.gov.in / indiapostgdsonline.gov.in',
    portalUrl: 'https://ssc.gov.in/',
    noticeUrl: 'https://indiapostgdsonline.gov.in/'
  }
];

const RECRUITMENT_GR_KEYWORDS = [
  'भरती',
  'पदभरती',
  'सरळसेवा',
  'नियुक्ती',
  'पदे',
  'पद',
  'पदोन्नती',
  'प्रतिनियुक्ती',
  'अनुकंपा',
  'उमेदवार',
  'परीक्षा',
  'वेतन',
  'मुदतवाढ',
  'बदली',
  'सेवा',
  'आकृतीबंध',
  'कंत्राटी',
  'अधिकारी'
];

export const JobsDirectory: React.FC = () => {
  const { lang, t } = useLanguage();
  const [customJobs, setCustomJobs] = useState<JobPosting[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<'सर्व' | JobCategory>('सर्व');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<JobPosting | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Live Recruitment GRs fetched from /api/gr/live
  const [liveGrs, setLiveGrs] = useState<LiveRecruitmentGr[]>([]);
  const [isLoadingGrs, setIsLoadingGrs] = useState<boolean>(true);
  const [grSearchFilter, setGrSearchFilter] = useState<'recruitment' | 'all'>('recruitment');

  // Owner Management Mode (Passcode Protected)
  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(false);
  const [isOwnerAuth, setIsOwnerAuth] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // New Job Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('');
  const [newCategory, setNewCategory] = useState<JobCategory>('महाराष्ट्र शासन (MPSC/सरळसेवा)');
  const [newStatus, setNewStatus] = useState<JobStatus>('active');
  const [newVacancies, setNewVacancies] = useState<string>('');
  const [newQualification, setNewQualification] = useState<string>('');
  const [newAgeLimit, setNewAgeLimit] = useState<string>('१८ ते ३८ वर्षे');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newLastDate, setNewLastDate] = useState<string>('');
  const [newGrRef, setNewGrRef] = useState<string>('');
  const [newGrUrl, setNewGrUrl] = useState<string>('https://gr.maharashtra.gov.in/1145/Government-Resolutions');
  const [newApplyUrl, setNewApplyUrl] = useState<string>('https://mpsconline.gov.in');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newDocsText, setNewDocsText] = useState<string>('');

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  useEffect(() => {
    try {
      const rawJobs = localStorage.getItem(STORAGE_JOBS_KEY);
      if (rawJobs) {
        const parsed = JSON.parse(rawJobs);
        if (Array.isArray(parsed)) {
          setCustomJobs(
            parsed.map((item: JobPosting) => ({
              ...item,
              grUrl: sanitizeExternalUrl(item.grUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions'),
              applyUrl: sanitizeExternalUrl(item.applyUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions'),
            }))
          );
        }
      }
      const rawSaved = localStorage.getItem(SAVED_JOB_IDS_KEY);
      if (rawSaved) {
        const parsedIds = JSON.parse(rawSaved);
        if (Array.isArray(parsedIds)) setSavedIds(parsedIds);
      }
    } catch (err) {
      console.error('Failed to load jobs storage:', err);
    }
  }, []);

  const fetchRecruitmentGrs = async (forceRefresh = false) => {
    setIsLoadingGrs(true);
    try {
      const res = await fetch(`/api/gr/live${forceRefresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setLiveGrs(data.items);
        if (forceRefresh) {
          showToast(t('ताजे भरती व सेवा GR अद्ययावत झाले ✓', 'Latest recruitment GRs refreshed ✓'));
        }
      }
    } catch (err) {
      console.error('Failed to fetch live GRs for Jobs page:', err);
    } finally {
      setIsLoadingGrs(false);
    }
  };

  useEffect(() => {
    fetchRecruitmentGrs(false);
  }, []);

  const allJobs = useMemo(() => {
    return [...customJobs, ...INITIAL_JOBS_LIST];
  }, [customJobs]);

  const activeCount = useMemo(
    () => allJobs.filter((j) => j.status === 'active').length,
    [allJobs]
  );
  const upcomingCount = useMemo(
    () => allJobs.filter((j) => j.status === 'upcoming').length,
    [allJobs]
  );

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesCategory = selectedCategory === 'सर्व' || job.category === selectedCategory;
      const matchesSaved = !showSavedOnly || savedIds.includes(job.id);
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.department.toLowerCase().includes(q) ||
        job.qualification.toLowerCase().includes(q) ||
        job.vacancies.toLowerCase().includes(q) ||
        job.grRef.toLowerCase().includes(q) ||
        job.summary.toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesSaved && matchesSearch;
    });
  }, [allJobs, statusFilter, selectedCategory, showSavedOnly, savedIds, searchTerm]);

  const filteredLiveGrs = useMemo(() => {
    if (grSearchFilter === 'all') return liveGrs.slice(0, 12);
    const matched = liveGrs.filter((gr) => {
      const text = `${gr.title} ${gr.officialDepartment}`.toLowerCase();
      return RECRUITMENT_GR_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
    });
    return (matched.length > 0 ? matched : liveGrs).slice(0, 12);
  }, [liveGrs, grSearchFilter]);

  const toggleBookmark = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      try {
        localStorage.setItem(SAVED_JOB_IDS_KEY, JSON.stringify(next));
      } catch {}
      showToast(
        prev.includes(id)
          ? t('बुकमार्क मधून काढले.', 'Removed from bookmarks.')
          : t('नोकरी बुकमार्क केली ✓', 'Job bookmarked ✓')
      );
      return next;
    });
  };

  const handleCopyJobInfo = (job: JobPosting) => {
    navigator.clipboard.writeText(
      appendPortalLink(
        `💼 *${job.title}*\n🏛️ ${t('विभाग', 'Department')}: ${job.department}\n📌 ${t('पदे', 'Vacancies')}: ${job.vacancies}\n🎓 ${t('पात्रता', 'Qualification')}: ${job.qualification}\n📅 ${t('अंतिम दिनांक', 'Last Date')}: ${job.lastDate}\n📜 ${t('GR लिंक', 'GR Link')}: ${job.grUrl}\n🌐 ${t('अर्ज लिंक', 'Apply Link')}: ${job.applyUrl}`,
        lang
      )
    );
    setCopiedId(job.id);
    trackFeatureAction('jobs');
    showToast(t('नोकरीची माहिती व GR लिंक कॉपी केली ✓', 'Job details & GR link copied ✓'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWhatsAppShareUrl = (job: JobPosting) => {
    const statusText = job.status === 'active' ? '🔴 चालू भरती (अर्ज सुरू)' : '⏳ आगामी / येणारी भरती';
    return buildWhatsAppShareUrl(
      `💼 *सरकारी नोकरी संदर्भ (${statusText})*\n\n*${job.title}*\n🏛️ *विभाग:* ${job.department}\n📌 *एकूण पदे:* ${job.vacancies}\n🎓 *पात्रता:* ${job.qualification}\n📅 *अंतिम दिनांक:* ${job.lastDate}\n\n📜 *अधिकृत GR लिंक:* ${job.grUrl}\n🌐 *अर्ज / पोर्टल लिंक:* ${job.applyUrl}`,
      lang
    );
  };

  const handlePrintJobSlip = (job: JobPosting) => {
    trackFeatureAction('jobs');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      showToast('प्रिंट तयार करता आले नाही.');
      return;
    }

    const safeTitle = escapeHtml(job.title);
    const safeDept = escapeHtml(job.department);
    const safeVac = escapeHtml(job.vacancies);
    const safeQual = escapeHtml(job.qualification);
    const safeAge = escapeHtml(job.ageLimit);
    const safeStart = escapeHtml(job.startDate);
    const safeLast = escapeHtml(job.lastDate);
    const safeGrRef = escapeHtml(job.grRef);
    const safeGrUrl = escapeHtml(sanitizeExternalUrl(job.grUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions'));
    const safeApplyUrl = escapeHtml(sanitizeExternalUrl(job.applyUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions'));
    const safeSummary = escapeHtml(job.summary);

    doc.open();
    doc.write(`
      <html lang="mr">
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <style>
            body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6; }
            .header { border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
            h1 { font-size: 20px; margin: 10px 0; color: #0f172a; }
            .meta { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 10px; font-size: 13px; margin-bottom: 18px; }
            .meta div { margin-bottom: 6px; }
            h3 { font-size: 15px; color: #0369a1; margin-top: 18px; margin-bottom: 8px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 6px; font-size: 14px; }
            .footer { margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><strong>महा कॉर्नर (MAHA CORNER)</strong> • नोकरी संदर्भ पत्रक</div>
            <span class="badge">${job.status === 'active' ? 'चालू भरती' : 'आगामी भरती'}</span>
          </div>
          <h1>${safeTitle}</h1>
          <div class="meta">
            <div><strong>विभाग:</strong> ${safeDept}</div>
            <div><strong>रिक्त पदे:</strong> ${safeVac}</div>
            <div><strong>पात्रता:</strong> ${safeQual}</div>
            <div><strong>वयोमर्यादा:</strong> ${safeAge}</div>
            <div><strong>अर्ज कालावधी:</strong> ${safeStart} ते ${safeLast}</div>
            <div><strong>संबंधित GR:</strong> ${safeGrRef} (${safeGrUrl})</div>
            <div><strong>अधिकृत पोर्टल:</strong> ${safeApplyUrl}</div>
          </div>
          <p>${safeSummary}</p>
          ${job.documentsRequired.length > 0 ? `<h3>आवश्यक कागदपत्रे:</h3><ul>${job.documentsRequired.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
          <div class="footer">साभार: महा कॉर्नर (MAHA CORNER) • माहिती अशी, जी कामी येईल!</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1000);
      }
    }, 150);
  };

  // Owner Passcode Auth
  const handleToggleOwner = () => {
    if (isOwnerAuth) {
      setIsOwnerMode((prev) => !prev);
    } else {
      setShowPinModal(true);
      setPinError('');
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
    if (!cleaned) {
      setPinError(t('कृपया ओनर पिन टाका.', 'Please enter Owner PIN.'));
      return;
    }
    setPinError('');
    try {
      const res = await fetch('/api/posters/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setIsOwnerAuth(true);
        setIsOwnerMode(true);
        setShowPinModal(false);
        setPinInput('');
        setPinError('');
      } else if (res.status === 429 && data?.error) {
        setPinError(data.error);
      } else {
        setPinError(t('चुकीचा पिन! कृपया योग्य पिन टाका.', 'Incorrect PIN! Please try again.'));
      }
    } catch {
      setPinError(t('पडताळणी करताना सर्व्हर त्रुटी आली.', 'Verification error. Please try again.'));
    }
  };

  const handlePublishNewJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDepartment.trim() || !newSummary.trim()) {
      showToast(t('कृपया भरतीचे नाव, विभाग आणि थोडक्यात माहिती भरा.', 'Please fill in job title, department, and summary.'));
      return;
    }

    const safeGrUrl = sanitizeExternalUrl(newGrUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions');
    const safeApplyUrl = sanitizeExternalUrl(newApplyUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions');

    const created: JobPosting = {
      id: `job-custom-${Date.now()}`,
      title: newTitle.trim(),
      department: newDepartment.trim(),
      category: newCategory,
      status: newStatus,
      vacancies: newVacancies.trim() || t('अधिसूचनेनुसार', 'As per notification'),
      qualification: newQualification.trim() || t('पदवी / १२वी / १०वी (पदानुसार)', 'Graduate / 12th / 10th (Post-wise)'),
      ageLimit: newAgeLimit.trim() || t('१८ ते ३८ वर्षे', '18 to 38 Years'),
      startDate: newStartDate.trim() || t('लवकरच / सुरू', 'Ongoing / Soon'),
      lastDate: newLastDate.trim() || t('जाहिरातीनुसार', 'As per official notice'),
      examOrNoticeInfo: t('अधिकृत संकेतस्थळावरील वेळापत्रकानुसार', 'As per official website schedule'),
      grRef: newGrRef.trim() || t('संबंधित शासन निर्णय व जाहिरात', 'Related GR & Notification'),
      grUrl: safeGrUrl,
      applyUrl: safeApplyUrl,
      officialPortalName: t('अधिकृत पोर्टल', 'Official Portal'),
      summary: newSummary.trim(),
      documentsRequired: newDocsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isOwnerAdded: true
    };

    const updated = [created, ...customJobs];
    setCustomJobs(updated);
    try {
      localStorage.setItem(STORAGE_JOBS_KEY, JSON.stringify(updated));
    } catch {
      showToast(t('स्टोरेज मर्यादेमुळे फक्त सेशनपुरते जतन झाले.', 'Saved for current session only due to storage limit.'));
    }

    setNewTitle('');
    setNewDepartment('');
    setNewVacancies('');
    setNewQualification('');
    setNewStartDate('');
    setNewLastDate('');
    setNewGrRef('');
    setNewSummary('');
    setNewDocsText('');
    confetti({ particleCount: 55, spread: 70 });
    showToast(t('नवीन नोकरी संदर्भ यशस्वीरित्या प्रकाशित झाला ✓', 'New recruitment notice published ✓'));
  };

  const handleDeleteCustomJob = (id: string) => {
    const updated = customJobs.filter((j) => j.id !== id);
    setCustomJobs(updated);
    try {
      localStorage.setItem(STORAGE_JOBS_KEY, JSON.stringify(updated));
    } catch {}
    showToast(t('निवडलेली भरती माहिती काढून टाकली.', 'Removed selected recruitment entry.'));
  };

  return (
    <div className="space-y-6">
      {/* Inline Notification Toast */}
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-amber-300 border border-amber-500/50 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-6 sm:p-8 border border-sky-400/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-bold">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>{t('महाराष्ट्र व केंद्र शासन • चालू व येणाऱ्या सरकारी नोकऱ्या', 'Maharashtra & Central Govt • Active & Upcoming Jobs')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {t('💼 सरकारी नोकरी संदर्भ व भरती GR केंद्र', '💼 Govt Job Alerts & Recruitment GR Hub')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                'सध्या सुरू असलेल्या (चालू) तसेच लवकरच प्रसिद्ध होणाऱ्या (येणाऱ्या) सर्व सरकारी भरतींची माहिती, पात्रता, अंतिम दिनांक, ऑनलाइन अर्ज लिंक आणि अधिकृत पदभरती शासन निर्णय (GR) लिंक एकाच ठिकाणी.',
                'Browse active and upcoming Maharashtra & Central Government recruitments with eligibility criteria, deadlines, direct apply links, and official recruitment GR PDFs.'
              )}
            </p>

            {/* Quick Summary Metrics */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>{t(`चालू भरती (अर्ज सुरू): ${activeCount}`, `Active Openings: ${activeCount}`)}</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Clock className="w-4 h-4" />
                <span>{t(`येणाऱ्या भरती (आगामी): ${upcomingCount}`, `Upcoming Notices: ${upcomingCount}`)}</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                <FileCheck2 className="w-4 h-4" />
                <span>{t(`ताजे भरती GR: ${filteredLiveGrs.length}`, `Live Recruitment GRs: ${filteredLiveGrs.length}`)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://gr.maharashtra.gov.in/1145/Government-Resolutions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{t('अधिकृत पदभरती GR पोर्टल', 'Official Recruitment GR Portal')}</span>
            </a>

            <button
              type="button"
              onClick={handleToggleOwner}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isOwnerMode
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isOwnerMode
                  ? t('ओनर पॅनेल बंद करा', 'Close Owner Panel')
                  : t('नवीन भरती जोडा', 'Add Job Notice')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Owner Add New Job Panel */}
      {isOwnerMode && (
        <form
          onSubmit={handlePublishNewJob}
          className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-emerald-500/40 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
              <Plus className="w-5 h-5" />
              <span>{t('नवीन सरकारी नोकरी / भरती संदर्भ जोडा (Owner Panel)', 'Publish New Job Alert (Owner Panel)')}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {t('तुमच्या डिव्हाइसवर सेव्ह होते', 'Saved locally on your device')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('भरतीचे शीर्षक *:', 'Recruitment Title *:')}</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('उदा. जिल्हा परिषद जळगाव विविध तांत्रिक पदे भरती २०२६', 'e.g. Zilla Parishad Jalgaon Technical Posts 2026')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('भरती स्थिती:', 'Status:')}</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as JobStatus)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              >
                <option value="active">{t('🔴 चालू भरती (अर्ज सुरू)', '🔴 Active (Apply Open)')}</option>
                <option value="upcoming">{t('⏳ येणारी भरती (आगामी)', '⏳ Upcoming Notice')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('विभाग / मंडळ *:', 'Department / Board *:')}</label>
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder={t('उदा. महाराष्ट्र शासन / MPSC', 'e.g. Govt of Maharashtra / MPSC')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('प्रवर्ग (Category):', 'Category:')}</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as JobCategory)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              >
                {CATEGORIES.filter((c) => c !== 'सर्व').map((c) => (
                  <option key={c} value={c}>
                    {lang === 'en' ? JOB_CATEGORY_EN_MAP[c] : c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('एकूण पदे:', 'Total Vacancies:')}</label>
              <input
                type="text"
                value={newVacancies}
                onChange={(e) => setNewVacancies(e.target.value)}
                placeholder={t('उदा. ५००+ पदे', 'e.g. 500+ Posts')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('शैक्षणिक पात्रता:', 'Qualification:')}</label>
              <input
                type="text"
                value={newQualification}
                onChange={(e) => setNewQualification(e.target.value)}
                placeholder={t('उदा. १०वी / १२वी / पदवी', 'e.g. 10th / 12th / Graduate')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('सुरुवात दिनांक:', 'Start Date:')}</label>
              <input
                type="text"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                placeholder="15/11/2026"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('अंतिम दिनांक:', 'Last Date:')}</label>
              <input
                type="text"
                value={newLastDate}
                onChange={(e) => setNewLastDate(e.target.value)}
                placeholder="30/11/2026"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('GR संदर्भ / क्रमांक:', 'GR Ref / Notice No.:')}</label>
              <input
                type="text"
                value={newGrRef}
                onChange={(e) => setNewGrRef(e.target.value)}
                placeholder={t('उदा. संकीर्ण-२०२६/प्र.क्र.१२', 'e.g. Advt No. 12/2026')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('GR PDF / पोर्टल लिंक:', 'GR PDF / Portal Link:')}</label>
              <input
                type="url"
                value={newGrUrl}
                onChange={(e) => setNewGrUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('ऑनलाइन अर्ज लिंक:', 'Online Apply Link:')}</label>
              <input
                type="url"
                value={newApplyUrl}
                onChange={(e) => setNewApplyUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('भरती माहिती व तपशील *:', 'Recruitment Summary *:')}</label>
              <textarea
                rows={2}
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder={t('भरती प्रक्रिया, पदे व परीक्षा स्वरूप थोडक्यात लिहा...', 'Briefly describe selection process, posts & exam pattern...')}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t("लागणारी कागदपत्रे (स्वल्पविराम ',' देऊन लिहा):", 'Required Documents (comma separated):')}
              </label>
              <textarea
                rows={2}
                value={newDocsText}
                onChange={(e) => setNewDocsText(e.target.value)}
                placeholder={t('आधार कार्ड, गुणपत्रिका, जात प्रमाणपत्र, फोटो-सही', 'Aadhaar, Marksheets, Caste Certificate, Photo & Signature')}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('नोकरी संदर्भ प्रकाशित करा', 'Publish Job Notice')}</span>
          </button>
        </form>
      )}

      {/* Quick Official Job & GR Portals Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {QUICK_JOB_PORTALS.map((portal) => (
          <a
            key={portal.name}
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-2xl p-3 transition-all flex flex-col justify-between gap-1 group shadow-xs"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                {lang === 'en' ? portal.nameEn : portal.name}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 shrink-0" />
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {lang === 'en' ? portal.descEn : portal.desc}
            </span>
          </a>
        ))}
      </div>

      {/* Dedicated Central Govt & Army/Defence Recruitment Box (केंद्राची भरती) */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950 text-white p-5 sm:p-7 border border-emerald-400/30 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{t('🇮🇳 भारत सरकार • संरक्षण व केंद्रीय विभाग विशेष अपडेट्स', '🇮🇳 Government of India • Defence & Central Dept Updates')}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {t('केंद्राची भरती (आर्मी, नेव्ही, एअरफोर्स, BSF, CRPF, SSC, रेल्वे)', 'Central Govt Recruitment (Army, Navy, Air Force, BSF, CRPF, SSC, Railway)')}
            </h3>
            <p className="text-xs text-slate-300">
              {t(
                'इंडियन आर्मी अग्निवीर रॅली, वायुदल, नौदल, निमलष्करी दल (BSF/CRPF/CISF), रेल्वे आणि पोस्ट ऑफिसमधील सर्व चालू व आगामी भरती अपडेट्स.',
                'Latest updates for Indian Army Agniveer Rallies, Air Force, Navy, Paramilitary Forces (BSF/CRPF/CISF), Railways, SSC & India Post.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('पोलीस व संरक्षण')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer transition-colors"
            >
              {t('आर्मी व संरक्षण भरती पहा', 'View Army & Defence Jobs')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('केंद्र सरकार (SSC/UPSC)')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs cursor-pointer transition-colors"
            >
              {t('SSC / UPSC पहा', 'View SSC / UPSC')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {CENTRAL_DEFENCE_BOX_UPDATES.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-amber-400/50 p-4 transition-all flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-black text-amber-300">
                    {lang === 'en' ? item.forceNameEn : item.forceName}
                  </span>
                  <span
                    className={`font-bold ${
                      item.isLiveActive ? 'text-emerald-300' : 'text-sky-300'
                    }`}
                  >
                    {item.isLiveActive ? t('● चालू / सक्रिय', '● Active / Live') : t('○ आगामी बॅच', '○ Upcoming Batch')}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-300">
                  {lang === 'en' ? item.badgeTextEn : item.badgeText}
                </div>
                <h4 className="text-sm font-black text-white leading-snug">
                  {lang === 'en' ? item.updateTitleEn : item.updateTitle}
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'en' ? item.eligibilityEn : item.eligibility}
                </p>
              </div>

              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                <a
                  href={item.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-300 hover:text-amber-200 font-black flex items-center gap-1 truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.portalLabel}</span>
                </a>
                <a
                  href={item.noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0"
                >
                  {t('जाहिरात / GR', 'Notice / GR')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          {/* Active vs Upcoming Switcher */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-amber-400 shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t(`सर्व भरती (${allJobs.length})`, `All Jobs (${allJobs.length})`)}
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t(`चालू भरती · अर्ज सुरू (${activeCount})`, `Active Recruitments (${activeCount})`)}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('upcoming')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'upcoming'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t(`येणाऱ्या भरती · आगामी (${upcomingCount})`, `Upcoming Jobs (${upcomingCount})`)}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSavedOnly((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all ${
              showSavedOnly
                ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-slate-950' : ''}`} />
            <span>{t(`सेव्ह केलेल्या (${savedIds.length})`, `Saved (${savedIds.length})`)}</span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'नोकरी व भरती शोधा (उदा. MPSC, तलाठी, पोलीस, रेल्वे, बँक, १०वी, १२वी, पदवी, GR...)',
              'Search jobs by exam, department, qualification (MPSC, Talathi, Police, Army, SSC, Railway...)'
            )}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat !== 'सर्व' && CATEGORY_ICON_MAP[cat]}
              <span>{lang === 'en' ? JOB_CATEGORY_EN_MAP[cat] : cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredJobs.map((job) => {
          const isSaved = savedIds.includes(job.id);
          const isActive = job.status === 'active';

          return (
            <article
              key={job.id}
              className={`bg-white rounded-3xl border p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between gap-4 group ${
                isActive
                  ? 'border-emerald-300 hover:border-emerald-500 ring-1 ring-emerald-100'
                  : 'border-slate-200/90 hover:border-amber-400'
              }`}
            >
              <div className="space-y-3">
                {/* Quiet Metadata Header */}
                <div className="flex items-start justify-between gap-2 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-slate-700">
                    {CATEGORY_ICON_MAP[job.category]}
                    <span>{lang === 'en' ? JOB_CATEGORY_EN_MAP[job.category] : job.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className={isActive ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                      {isActive ? t('चालू भरती (अर्ज सुरू)', 'Active (Apply Open)') : t('येणारी भरती (आगामी)', 'Upcoming Recruitment')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBookmark(job.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isSaved
                          ? 'bg-amber-50 border-amber-300 text-amber-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-600'
                      }`}
                      title={t('सेव्ह करा', 'Bookmark')}
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500' : ''}`} />
                    </button>

                    {job.isOwnerAdded && isOwnerMode && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomJob(job.id)}
                        className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer"
                        title={t('काढून टाका', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Dept */}
                <div>
                  <h3
                    onClick={() => setActiveJob(job)}
                    className="text-base sm:text-lg font-black text-slate-900 group-hover:text-amber-700 transition-colors cursor-pointer leading-snug"
                  >
                    {job.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">{job.department}</p>
                </div>

                {/* Key Info Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold">{t('एकूण पदे:', 'Vacancies:')}</span>{' '}
                    <span className="font-bold text-slate-900">{job.vacancies}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">{t('अंतिम दिनांक:', 'Last Date:')}</span>{' '}
                    <span className={`font-black ${isActive ? 'text-red-600' : 'text-slate-800'}`}>
                      {job.lastDate}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-semibold">{t('पात्रता:', 'Eligibility:')}</span>{' '}
                    <span className="font-bold text-slate-800">{job.qualification}</span>
                  </div>
                </div>

                {/* GR Link Row */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                  <span className="text-amber-950 font-semibold truncate">
                    📜 <strong>{t('GR संदर्भ:', 'GR Ref:')}</strong> {job.grRef}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={sanitizeExternalUrl(job.grUrl, '#')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-800 hover:text-amber-950 font-black flex items-center gap-1 underline underline-offset-2"
                    >
                      <span>{t('GR लिंक', 'GR Link')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyJobInfo(job)}
                      className="text-slate-600 hover:text-slate-900 cursor-pointer"
                      title={t('माहिती कॉपी करा', 'Copy info')}
                    >
                      {copiedId === job.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <a
                  href={sanitizeExternalUrl(job.applyUrl, '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isActive ? t('अधिकृत पोर्टल / अर्ज करा', 'Apply / Official Portal') : t('अधिकृत पोर्टल पहा', 'View Official Portal')}</span>
                </a>

                <button
                  type="button"
                  onClick={() => setActiveJob(job)}
                  className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('संपूर्ण तपशील', 'Full Details')}</span>
                </button>

                <a
                  href={getWhatsAppShareUrl(job)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                  title={t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t('शेअर', 'Share')}</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* Empty Jobs Result */}
      {filteredJobs.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {t('या शोधानुसार कोणतीही भरती माहिती आढळली नाही.', 'No recruitment notifications match your filter.')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('सर्व');
              setStatusFilter('all');
              setShowSavedOnly(false);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            {t('सर्व फिल्टर साफ करा', 'Clear All Filters')}
          </button>
        </div>
      )}

      {/* Live Recruitment & Service Rules GR Section from gr.maharashtra.gov.in */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              <span>{t('भरती व शासकीय सेवा संदर्भातील ताजे महाराष्ट्र GR (अधिकृत PDF लिंक)', 'Live Maharashtra Recruitment & Service Rules GRs (Official PDF Links)')}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {t(
                'थेट महाराष्ट्र शासन पोर्टलवरून (gr.maharashtra.gov.in) पदभरती, नियुक्ती व प्रशासन संदर्भातील नवीनतम शासन निर्णयांच्या थेट PDF लिंक.',
                'Direct PDF links for the latest recruitment, appointment & service rules GRs fetched from gr.maharashtra.gov.in.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setGrSearchFilter('recruitment')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  grSearchFilter === 'recruitment'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {t('फक्त नोकरी/सेवा GR', 'Jobs / Service GRs')}
              </button>
              <button
                type="button"
                onClick={() => setGrSearchFilter('all')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  grSearchFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t('सर्व ताजे GR', 'All Latest GRs')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchRecruitmentGrs(true)}
              disabled={isLoadingGrs}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGrs ? 'animate-spin' : ''}`} />
              <span>{t('रिफ्रेश', 'Refresh')}</span>
            </button>
          </div>
        </div>

        {isLoadingGrs && filteredLiveGrs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredLiveGrs.map((gr) => (
              <div
                key={gr.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50/60 hover:bg-white transition-all flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-bold">
                    <span className="text-amber-800 truncate">{gr.officialDepartment}</span>
                    <span className="shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {gr.date}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {gr.title}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <span className="font-mono text-[11px] text-slate-500">
                    {t('संकेतांक:', 'Code:')} {gr.grCode} {gr.fileSizeKb ? `(${gr.fileSizeKb} KB)` : ''}
                  </span>
                  <a
                    href={sanitizeExternalUrl(gr.pdfUrl, '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t('GR PDF पहा', 'View GR PDF')}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detailed Job Modal Reader */}
      {activeJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5 relative">
            <button
              type="button"
              onClick={() => setActiveJob(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              aria-label={t('बंद करा', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2 pr-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-amber-700 flex items-center gap-1">
                  {CATEGORY_ICON_MAP[activeJob.category]}
                  {lang === 'en' ? JOB_CATEGORY_EN_MAP[activeJob.category] : activeJob.category}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-black ${
                    activeJob.status === 'active' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {activeJob.status === 'active' ? t('चालू भरती (अर्ज सुरू)', 'Active (Apply Open)') : t('येणारी भरती (आगामी)', 'Upcoming Recruitment')}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {activeJob.title}
              </h3>
              <p className="text-xs font-bold text-slate-500">{activeJob.department}</p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-sm text-slate-800 leading-relaxed">
              {activeJob.summary}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-500 block font-semibold">{t('एकूण रिक्त पदे', 'Total Vacancies')}</span>
                <strong className="text-slate-900 text-sm">{activeJob.vacancies}</strong>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">{t('शैक्षणिक पात्रता', 'Eligibility / Qualification')}</span>
                <strong className="text-slate-900">{activeJob.qualification}</strong>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">{t('वयोमर्यादा', 'Age Limit')}</span>
                <strong className="text-slate-900">{activeJob.ageLimit}</strong>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">{t('अर्ज / अंतिम दिनांक', 'Application Window')}</span>
                <strong className="text-red-600">{activeJob.startDate} – {activeJob.lastDate}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block font-semibold">{t('परीक्षा व निवड माहिती', 'Exam & Selection Info')}</span>
                <strong className="text-slate-900">{activeJob.examOrNoticeInfo}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block font-semibold">{t('संबंधित शासन निर्णय (GR) संदर्भ', 'Related GR Reference')}</span>
                <strong className="text-amber-800">{activeJob.grRef}</strong>
              </div>
            </div>

            {activeJob.documentsRequired.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-900">{t('📂 अर्जासाठी आवश्यक कागदपत्रे:', '📂 Required Documents:')}</h4>
                <div className="flex flex-wrap gap-2">
                  {activeJob.documentsRequired.map((doc, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                    >
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
              <a
                href={sanitizeExternalUrl(activeJob.grUrl, '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{t('संबंधित GR पहा', 'View Related GR')}</span>
              </a>

              <a
                href={sanitizeExternalUrl(activeJob.applyUrl, '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('अधिकृत अर्ज पोर्टल', 'Official Apply Portal')}</span>
              </a>

              <button
                type="button"
                onClick={() => handlePrintJobSlip(activeJob)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t('प्रिंट / PDF', 'Print / PDF')}</span>
              </button>

              <a
                href={getWhatsAppShareUrl(activeJob)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('WhatsApp शेअर', 'Share on WhatsApp')}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Owner Pin Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyPin}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>{t('ओनर पिन पडताळणी', 'Owner PIN Verification')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {t('नवीन सरकारी नोकरी / भरती माहिती अपलोड करण्यासाठी ओनर पिन टाका.', 'Enter Owner PIN to add a new job notification.')}
            </p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={t('ओनर पिन प्रविष्ट करा', 'Enter Owner PIN')}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              autoFocus
            />
            {pinError && <p className="text-xs font-bold text-red-600">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs cursor-pointer"
            >
              {t('पडताळणी करा', 'Verify PIN')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

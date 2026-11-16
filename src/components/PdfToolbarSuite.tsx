import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Edit3,
  ScanText,
  RotateCw,
  Trash2,
  FileOutput,
  Layers,
  Lock,
  Unlock,
  Stamp,
  Hash,
  PenTool,
  Upload,
  Download,
  ShieldCheck,
  CheckCircle2,
  FileDown,
  RefreshCw,
  Search,
  Sliders,
  Copy,
  Eye,
  ArrowRight,
  ArrowUp,
  Zap,
  FileImage,
  Minimize2,
  LayoutGrid,
  Printer,
  FolderOpen,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Info,
  ListChecks,
  ExternalLink,
  AlertTriangle,
  KeyRound
} from 'lucide-react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink } from '../utils/shareConfig';
import { PdfInteractiveEditor, PdfInteractiveEditorHandle } from './PdfInteractiveEditor';
import {
  PdfOperationError,
  PdfValidationReport,
  canvasToJpegArrayBuffer,
  createUniversalPdfBlob,
  fitImageToStandardPdfPage,
  loadCleanPdfDocument,
  mergePdfBuffersUniversally,
  rebuildPdfViaCanvas,
  saveUniversalPdf,
  validatePdfDocument
} from '../utils/pdfCompat';
import {
  PDF_SECURITY_LIMITS,
  escapeHtml,
  inspectUploadedFileBytes,
  releaseCanvasMemory,
  sanitizeFilename,
  sanitizeSpreadsheetCell,
  yieldToUi
} from '../utils/pdfSecurity';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export type PdfToolId =
  | 'compress'       // 1. Compress PDF
  | 'merge'          // 2. Merge PDF
  | 'split'          // 3. Split PDF
  | 'pdf-to-word'    // 4. PDF to Word
  | 'pdf-to-jpg'     // 5. PDF to JPG
  | 'jpg-to-pdf'     // 6. JPG to PDF
  | 'word-to-pdf'    // 7. Word to PDF
  | 'pdf-to-excel'   // 8. PDF to Excel
  | 'pdf-to-ppt'     // 9. PDF to PPT
  | 'edit-pdf'       // 10. Edit PDF
  | 'ocr-pdf'        // 11. OCR PDF
  | 'rotate-pdf'     // 12. Rotate PDF
  | 'delete-pages'   // 13. Delete Pages
  | 'extract-pages'  // 14. Extract Pages
  | 'organize-pdf'   // 15. Organize PDF
  | 'protect-pdf'    // 16. Protect PDF
  | 'unlock-pdf'     // 17. Unlock PDF
  | 'watermark-pdf'  // 18. Watermark PDF
  | 'page-number'    // 19. Page Number
  | 'sign-pdf'       // 20. Sign PDF
  | 'nup-pdf'        // 21. Multiple Pages Per Sheet (N-Up)
  | 'grayscale-pdf'; // 22. Black & White Print PDF

type ToolCategory = 'optimize' | 'convert' | 'edit' | 'pages' | 'security';

interface ToolItem {
  id: PdfToolId;
  num: number;
  title: string;
  titleMr: string;
  category: ToolCategory;
  icon: React.ElementType;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  description: string;
  descriptionEn: string;
  needsPdf: boolean;
}

const PDF_TOOLS: ToolItem[] = [
  {
    id: 'compress',
    num: 1,
    title: 'Compress PDF',
    titleMr: 'PDF कॉम्प्रेस (Target KB)',
    category: 'optimize',
    icon: Minimize2,
    accentBg: 'bg-emerald-600 text-white',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-500',
    description: 'भरती व पोर्टलसाठी 50KB, 100KB, 200KB च्या आत PDF आकार कमी करा.',
    descriptionEn: 'Shrink PDF file size under 50KB, 100KB, or 200KB for online forms.',
    needsPdf: true
  },
  {
    id: 'merge',
    num: 2,
    title: 'Merge PDF',
    titleMr: 'PDF एकत्र करा (Merge)',
    category: 'optimize',
    icon: Layers,
    accentBg: 'bg-rose-600 text-white',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-500',
    description: 'दोन किंवा अधिक PDF फाइल्स एकाच क्रमात जोडून एक PDF बनवा.',
    descriptionEn: 'Combine multiple PDF documents in the exact order you want.',
    needsPdf: true
  },
  {
    id: 'split',
    num: 3,
    title: 'Split PDF',
    titleMr: 'PDF स्प्लिट (तुकडे करा)',
    category: 'optimize',
    icon: FileOutput,
    accentBg: 'bg-rose-600 text-white',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-500',
    description: 'मोठ्या PDF मधून हवी ती पाने रेंजने (उदा. 1-3) वेगळी करा.',
    descriptionEn: 'Separate selected page ranges (e.g., 1-3) into a fresh PDF.',
    needsPdf: true
  },
  {
    id: 'edit-pdf',
    num: 4,
    title: 'Edit PDF Studio',
    titleMr: 'संपूर्ण PDF एडिट स्टुडिओ',
    category: 'edit',
    icon: Edit3,
    accentBg: 'bg-orange-600 text-white',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    description: 'जुना मजकूर क्लिक करून बदला, Find & Replace, फोटो, सही, व्हाईटआऊट व आकार जोडा.',
    descriptionEn: 'Click text to edit, Find & Replace, add images, signatures, whiteout & shapes.',
    needsPdf: true
  },
  {
    id: 'pdf-to-word',
    num: 5,
    title: 'PDF to Word',
    titleMr: 'PDF चे Word मध्ये रूपांतर',
    category: 'convert',
    icon: FileText,
    accentBg: 'bg-blue-600 text-white',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-500',
    description: 'PDF मधील मराठी व इंग्रजी मजकूर संपादन करण्यायोग्य Word (.doc) मध्ये काढा.',
    descriptionEn: 'Extract editable Unicode text from PDF into a Word (.doc) file.',
    needsPdf: true
  },
  {
    id: 'pdf-to-jpg',
    num: 6,
    title: 'PDF to JPG',
    titleMr: 'PDF चे HD फोटो (JPG)',
    category: 'convert',
    icon: FileImage,
    accentBg: 'bg-amber-600 text-white',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-500',
    description: 'PDF चे प्रत्येक पान उच्च दर्जाच्या HD JPG इमेजमध्ये सेव्ह करा.',
    descriptionEn: 'Turn each PDF page into a crisp high-resolution JPG image.',
    needsPdf: true
  },
  {
    id: 'jpg-to-pdf',
    num: 7,
    title: 'JPG to PDF',
    titleMr: 'फोटोची PDF बनवा',
    category: 'convert',
    icon: FileDown,
    accentBg: 'bg-indigo-600 text-white',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-500',
    description: 'एक किंवा अनेक JPG/PNG फोटोंपासून व्यवस्थित क्रमाने PDF तयार करा.',
    descriptionEn: 'Combine one or multiple JPG/PNG images into a clean PDF document.',
    needsPdf: false
  },
  {
    id: 'word-to-pdf',
    num: 8,
    title: 'Word to PDF',
    titleMr: 'मजकूर / अर्ज ते PDF',
    category: 'convert',
    icon: FileText,
    accentBg: 'bg-blue-600 text-white',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-500',
    description: 'मराठी किंवा इंग्रजी अर्ज थेट अधिकृत A4 PDF मध्ये रूपांतरित करा.',
    descriptionEn: 'Generate a formatted official A4 PDF directly from Marathi or English text.',
    needsPdf: false
  },
  {
    id: 'sign-pdf',
    num: 9,
    title: 'Sign PDF',
    titleMr: 'डिजिटल सही जोडा (Sign)',
    category: 'edit',
    icon: PenTool,
    accentBg: 'bg-orange-600 text-white',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    description: 'स्क्रीनवर बोटाने सही काढून तारीख व नावासह PDF वर शिक्का मारा.',
    descriptionEn: 'Draw your signature on-screen and stamp it with name and date on PDF.',
    needsPdf: true
  },
  {
    id: 'watermark-pdf',
    num: 10,
    title: 'Watermark PDF',
    titleMr: 'वॉटरमार्क लावा',
    category: 'edit',
    icon: Stamp,
    accentBg: 'bg-orange-600 text-white',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    description: 'सर्व पानांवर मराठी किंवा इंग्रजीत तिरका सुरक्षित वॉटरमार्क लावा.',
    descriptionEn: 'Stamp diagonal custom text watermark across all PDF pages.',
    needsPdf: true
  },
  {
    id: 'rotate-pdf',
    num: 11,
    title: 'Rotate PDF',
    titleMr: 'पेज फिरवा (90° / 180°)',
    category: 'pages',
    icon: RotateCw,
    accentBg: 'bg-teal-600 text-white',
    accentText: 'text-teal-700',
    accentBorder: 'border-teal-500',
    description: 'आडवे किंवा उलटे स्कॅन झालेले पेजेस योग्य दिशेला फिरवून सेव्ह करा.',
    descriptionEn: 'Fix sideways or upside-down PDF pages permanently.',
    needsPdf: true
  },
  {
    id: 'nup-pdf',
    num: 12,
    title: 'N-Up Pages/Sheet',
    titleMr: 'एका पानावर २ किंवा ४ पाने',
    category: 'optimize',
    icon: LayoutGrid,
    accentBg: 'bg-emerald-600 text-white',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-500',
    description: 'प्रिंट खर्च वाचवण्यासाठी एका A4 पानावर 2 किंवा 4 PDF पाने बसवा.',
    descriptionEn: 'Combine 2 or 4 PDF pages onto a single A4 sheet for easy printing.',
    needsPdf: true
  },
  {
    id: 'delete-pages',
    num: 13,
    title: 'Delete Pages',
    titleMr: 'नको असलेली पाने काढा',
    category: 'pages',
    icon: Trash2,
    accentBg: 'bg-teal-600 text-white',
    accentText: 'text-teal-700',
    accentBorder: 'border-teal-500',
    description: 'PDF मधील रिकामे किंवा अतिरिक्त पान क्रमांक टाकून हटवा.',
    descriptionEn: 'Remove unwanted pages cleanly by page number or list.',
    needsPdf: true
  },
  {
    id: 'extract-pages',
    num: 14,
    title: 'Extract Pages',
    titleMr: 'ठरावीक पाने वेगळी काढा',
    category: 'pages',
    icon: FileOutput,
    accentBg: 'bg-teal-600 text-white',
    accentText: 'text-teal-700',
    accentBorder: 'border-teal-500',
    description: 'फक्त निवडलेली महत्त्वाची पाने वेगळ्या नवीन PDF मध्ये सेव्ह करा.',
    descriptionEn: 'Save specific pages from any PDF as a clean standalone document.',
    needsPdf: true
  },
  {
    id: 'organize-pdf',
    num: 15,
    title: 'Organize PDF',
    titleMr: 'पानांचा क्रम बदला',
    category: 'pages',
    icon: Layers,
    accentBg: 'bg-teal-600 text-white',
    accentText: 'text-teal-700',
    accentBorder: 'border-teal-500',
    description: 'पानांचा क्रम उलटा करा किंवा स्वतःचा क्रम (उदा. 3,1,2) लावा.',
    descriptionEn: 'Reorder PDF pages in reverse or custom sequence.',
    needsPdf: true
  },
  {
    id: 'page-number',
    num: 16,
    title: 'Page Numbers',
    titleMr: 'पेज नंबर टाका',
    category: 'edit',
    icon: Hash,
    accentBg: 'bg-orange-600 text-white',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    description: 'प्रत्येक पानाच्या तळाशी Page 1 of N किंवा साधा क्रमांक टाका.',
    descriptionEn: 'Add sequential page numbering at bottom center or right.',
    needsPdf: true
  },
  {
    id: 'ocr-pdf',
    num: 17,
    title: 'OCR / Extract Text',
    titleMr: 'PDF मधून मजकूर काढा',
    category: 'edit',
    icon: ScanText,
    accentBg: 'bg-orange-600 text-white',
    accentText: 'text-orange-700',
    accentBorder: 'border-orange-500',
    description: 'PDF मधील सर्व पानांचा मराठी व इंग्रजी मजकूर कॉपी करण्यासाठी काढा.',
    descriptionEn: 'Extract copyable Marathi and English text across all PDF pages.',
    needsPdf: true
  },
  {
    id: 'pdf-to-excel',
    num: 18,
    title: 'PDF to Excel',
    titleMr: 'Excel (.xlsx) मध्ये रूपांतर',
    category: 'convert',
    icon: FileSpreadsheet,
    accentBg: 'bg-indigo-600 text-white',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-500',
    description: 'PDF मधील याद्या व ओळी थेट खऱ्या Excel (.xlsx) फाईलमध्ये डाउनलोड करा.',
    descriptionEn: 'Convert tabular PDF rows directly into a genuine Microsoft Excel (.xlsx) workbook.',
    needsPdf: true
  },
  {
    id: 'pdf-to-ppt',
    num: 19,
    title: 'PDF to PPT',
    titleMr: 'PowerPoint स्लाइड्स',
    category: 'convert',
    icon: Presentation,
    accentBg: 'bg-indigo-600 text-white',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-500',
    description: 'PDF मधील माहिती PowerPoint सादरीकरण (.ppt) मध्ये रूपांतरित करा.',
    descriptionEn: 'Turn PDF pages and summaries into PowerPoint (.ppt) slides.',
    needsPdf: true
  },
  {
    id: 'protect-pdf',
    num: 20,
    title: 'Protect PDF',
    titleMr: 'PDF पासवर्ड लॉक',
    category: 'security',
    icon: Lock,
    accentBg: 'bg-violet-600 text-white',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-500',
    description: 'PDF फाईल खऱ्या पासवर्ड एन्क्रिप्शनने सुरक्षित लॉक करा (पासवर्डशिवाय उघडणार नाही).',
    descriptionEn: 'Encrypt and lock your PDF with a real open password across all PDF viewers.',
    needsPdf: true
  },
  {
    id: 'unlock-pdf',
    num: 21,
    title: 'Unlock PDF',
    titleMr: 'PDF अनलॉक करा',
    category: 'security',
    icon: Unlock,
    accentBg: 'bg-violet-600 text-white',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-500',
    description: 'प्रिंट किंवा एडिटसाठी लॉक केलेल्या PDF चे निर्बंध काढा.',
    descriptionEn: 'Strip print and edit restriction flags from readable PDFs.',
    needsPdf: true
  },
  {
    id: 'grayscale-pdf',
    num: 22,
    title: 'B&W Print PDF',
    titleMr: 'ब्लॅक-अँड-व्हाईट प्रिंट PDF',
    category: 'optimize',
    icon: Printer,
    accentBg: 'bg-emerald-600 text-white',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-500',
    description: 'रंगीत PDF ला झेरॉक्स व शासकीय प्रिंटिंगसाठी स्पष्ट B&W मध्ये बदला.',
    descriptionEn: 'Convert color PDF pages into crisp grayscale print-ready PDF.',
    needsPdf: true
  }
];

interface ToolGuideInfo {
  summaryMr: string;
  summaryEn: string;
  choicesMr: string[];
  choicesEn: string[];
  outputMr: string;
  outputEn: string;
}

const TOOL_GUIDES: Record<PdfToolId, ToolGuideInfo> = {
  compress: {
    summaryMr: 'मोठ्या PDF फाईलचा आकार सरकारी भरती, MPSC, महा-डीबीटी किंवा ऑनलाइन पोर्टलच्या अटींप्रमाणे ठरावीक KB मध्ये कमी केला जातो.',
    summaryEn: 'Shrinks heavy PDFs to exact KB targets required by government exams, scholarships, and online portals.',
    choicesMr: [
      'पहिल्या स्टेपमध्ये तुमची मूळ PDF फाईल निवडा.',
      'टार्गेट आकार (50 KB, 100 KB, 200 KB, 300 KB किंवा 500 KB) निवडा.',
      'पद्धत निवडा: "स्ट्राँग Target-KB" (स्कॅन PDF लहान करण्यासाठी) किंवा "फास्ट लॉसलेस" (अक्षर स्पष्ट ठेवण्यासाठी).'
    ],
    choicesEn: [
      'Upload your PDF file using the Select button above.',
      'Pick a Target Size preset (50 KB, 100 KB, 200 KB, 300 KB, or 500 KB).',
      'Choose Strong Target-KB (best for scans) or Fast Lossless (crisp vector text).'
    ],
    outputMr: 'कॉम्प्रेस केलेली PDF फाईल (.pdf)',
    outputEn: 'Compressed PDF file (.pdf)'
  },
  merge: {
    summaryMr: 'वेगवेगळ्या २ किंवा अधिक PDF दस्तऐवजांना एकाच सलग क्रमाने जोडून एकच PDF फाईल तयार करते.',
    summaryEn: 'Combines two or more separate PDF files into a single continuous document.',
    choicesMr: [
      'मुख्य ड्रॉपझोनमधून पहिली PDF निवडा (किंवा अनेक फाईल्स सोबत निवडा).',
      '"+ अतिरिक्त PDF जोडा" बटणावरून उरलेल्या जोडायच्या PDF फाईल्स निवडा.',
      'जोडलेल्या फाईल्सची यादी तपासून डाउनलोड बटण दाबा.'
    ],
    choicesEn: [
      'Select your primary PDF (or multiple PDFs at once).',
      'Click "+ Add More PDFs" to append extra documents in order.',
      'Review the attached list and click Merge & Download.'
    ],
    outputMr: 'एकत्र जोडलेली संयुक्त PDF (.pdf)',
    outputEn: 'Merged single PDF (.pdf)'
  },
  split: {
    summaryMr: 'जास्त पानांच्या PDF मधून तुम्हाला हवी असलेली ठरावीक पाने किंवा पानांची रेंज वेगळी करून नवीन PDF बनवते.',
    summaryEn: 'Extracts a specific range or list of pages from a multi-page PDF into a separate file.',
    choicesMr: [
      'मूळ मोठी PDF फाईल अपलोड करा (एकूण पाने लगेच दिसतील).',
      'रेंज बॉक्समध्ये पान क्रमांक टाका — उदा. "1-3" (पान १ ते ३) किंवा "1,4,6".',
      'डाउनलोड बटण दाबून निवडलेल्या पानांची स्वतंत्र PDF मिळवा.'
    ],
    choicesEn: [
      'Upload the source PDF (total page count appears automatically).',
      'Enter page range like "1-3" or comma-separated pages like "1,4,6".',
      'Click Split & Download to save only those pages.'
    ],
    outputMr: 'निवडलेल्या पानांची नवीन PDF (.pdf)',
    outputEn: 'Split PDF document (.pdf)'
  },
  'edit-pdf': {
    summaryMr: 'संपूर्ण प्रोफेशनल PDF एडिट स्टुडिओ: जुना मजकूर थेट क्लिक करून बदला, शब्द शोधा, नवीन मराठी/इंग्रजी मजकूर, फोटो, सही, व्हाईटआऊट आणि आकार जोडा.',
    summaryEn: 'Complete interactive PDF editor: click existing text to edit inline, Find & Replace, add text, logos, signatures, whiteout, redact & shapes.',
    choicesMr: [
      'PDF अपलोड झाल्यावर वरच्या पट्टीतील हवे ते साधन निवडा (निवडा/बदला, नवीन मजकूर, फोटो/लोगो, सही, व्हाईटआऊट, ब्लॅक रेडॅक्ट, आकार, पेन).',
      'जुना मजकूर बदलण्यासाठी "निवडा / बदला" मोडकडून थेट पानावरील शब्दावर क्लिक करा किंवा "शोध व बदला" वापरा.',
      'सर्व बदल झाल्यावर हिरवे "बदल सेव्ह करा" बटण किंवा खालील डाउनलोड बटण दाबा.'
    ],
    choicesEn: [
      'Upload your PDF and pick any tool from the ribbon (Edit Text, Add Text, Image, Sign, Whiteout, Redact, Shapes, Draw).',
      'Click directly on any text on the page in Edit Text mode or use Find & Replace.',
      'Click Apply & Save PDF to export all changes cleanly.'
    ],
    outputMr: 'सुधारित व एडिट केलेली PDF (.pdf)',
    outputEn: 'Edited PDF file (.pdf)'
  },
  'pdf-to-word': {
    summaryMr: 'PDF पानांमधील सर्व मराठी व इंग्रजी युनिकोड मजकूर काढून थेट MS Word मध्ये उघडता व एडिट करता येईल अशी फाईल बनवते.',
    summaryEn: 'Reads Unicode Marathi and English text across every PDF page and saves an editable Word document.',
    choicesMr: [
      'ज्या PDF मधून मजकूर हवा आहे ती PDF फाईल निवडा.',
      'खालील प्रक्रिया बटण दाबल्यावर सर्व पाने क्रमाने .doc फाईलमध्ये रूपांतरित होतील.'
    ],
    choicesEn: [
      'Upload the PDF file containing the text you need.',
      'Click Convert & Download to generate an editable .doc file.'
    ],
    outputMr: 'संपादन करण्यायोग्य Word फाईल (.doc)',
    outputEn: 'Editable Word document (.doc)'
  },
  'pdf-to-jpg': {
    summaryMr: 'PDF च्या प्रत्येक पानाचे उच्च दर्जाचे (HD) स्पष्ट JPG फोटो तयार करते जे WhatsApp वर पाठवता किंवा प्रिंट करता येतात.',
    summaryEn: 'Converts every single page of your PDF into sharp high-resolution JPG image files.',
    choicesMr: [
      'फोटोमध्ये रूपांतरित करायची PDF फाईल निवडा.',
      'डाउनलोड बटण दाबताच सर्व पानांचे स्वतंत्र HD JPG फोटो डाउनलोड होतील.'
    ],
    choicesEn: [
      'Select your PDF document.',
      'Click Convert & Download to save each page as an HD .jpg image.'
    ],
    outputMr: 'प्रत्येक पानाची HD इमेज (.jpg)',
    outputEn: 'High-resolution page images (.jpg)'
  },
  'jpg-to-pdf': {
    summaryMr: 'मोबाईलमधील कागदपत्रांचे JPG किंवा PNG फोटो निवडून त्यांची व्यवस्थित क्रमाने एकच PDF फाईल तयार करते.',
    summaryEn: 'Combines one or multiple JPG/PNG photos into one neatly sized multi-page PDF.',
    choicesMr: [
      '"+ फोटो जोडा" किंवा ड्रॉपझोनमधून एक किंवा अनेक फोटो निवडा.',
      'नको असलेला फोटो लिस्ट मधून "×" ने काढू शकता.',
      'क्रम नक्की झाल्यावर PDF तयार करून डाउनलोड करा.'
    ],
    choicesEn: [
      'Pick one or multiple JPG/PNG photos via Select or "+ Add Images".',
      'Remove any unwanted photo using × on its tag.',
      'Click Create & Download to compile them into a PDF.'
    ],
    outputMr: 'सर्व फोटोंची एकत्रित PDF (.pdf)',
    outputEn: 'Compiled PDF document (.pdf)'
  },
  'word-to-pdf': {
    summaryMr: 'अर्ज, निवेदन किंवा टाईप केलेल्या मराठी/इंग्रजी मजकुरावरून थेट अधिकृत बॉर्डर असलेली A4 PDF तयार करते.',
    summaryEn: 'Creates an official framed A4 PDF directly from typed Marathi or English application text.',
    choicesMr: [
      '"दस्तऐवज शीर्षक" बॉक्समध्ये अर्जाचे किंवा कागदाचे नाव टाका.',
      'खालील मोठ्या बॉक्समध्ये तुमचा संपूर्ण मराठी/इंग्रजी मजकूर लिहा किंवा पेस्ट करा.'
    ],
    choicesEn: [
      'Enter your document header title.',
      'Type or paste your full Marathi or English application body.'
    ],
    outputMr: 'अधिकृत A4 PDF दस्तऐवज (.pdf)',
    outputEn: 'Formatted official A4 PDF (.pdf)'
  },
  'sign-pdf': {
    summaryMr: 'स्क्रीनवर थेट बोटाने किंवा माऊसने सही काढून, स्वाक्षरी करणाऱ्याचे नाव व तारखेसह PDF वर अधिकृत डिजिटल सही लावते.',
    summaryEn: 'Stamps a signature box with your drawn signature, full name, and date onto your PDF.',
    choicesMr: [
      'सही लावायची PDF फाईल अपलोड करा.',
      '"स्वाक्षरी करणाऱ्याचे नाव" आणि "दिनांक" भरा.',
      'पांढऱ्या Sign Pad बॉक्समध्ये सही काढून डाउनलोड बटण दाबा.'
    ],
    choicesEn: [
      'Upload the PDF document to be signed.',
      'Enter Signer Name and Date.',
      'Draw your signature in the white pad and click Sign & Download.'
    ],
    outputMr: 'डिजिटल सही असलेली PDF (.pdf)',
    outputEn: 'Signed PDF document (.pdf)'
  },
  'watermark-pdf': {
    summaryMr: 'तुमच्या PDF च्या प्रत्येक पानावर नाव, संस्थेचा शिक्का किंवा "गोपनीय" असा तिरका पारदर्शक वॉटरमार्क लावते.',
    summaryEn: 'Adds a diagonal custom Marathi or English text watermark across every PDF page.',
    choicesMr: [
      'PDF फाईल निवडा.',
      '"वॉटरमार्क मजकूर" बॉक्समध्ये दाखवायचे नाव टाका.',
      '"पारदर्शकता (Opacity)" स्लायडरने मजकूर कितपत गडद/फिक्कट हवा ते निवडा.'
    ],
    choicesEn: [
      'Upload your PDF file.',
      'Enter your desired watermark label.',
      'Adjust the Opacity slider for subtle or bold visibility.'
    ],
    outputMr: 'वॉटरमार्क लावलेली PDF (.pdf)',
    outputEn: 'Watermarked PDF (.pdf)'
  },
  'rotate-pdf': {
    summaryMr: 'चुकून आडवी किंवा उलटी स्कॅन झालेली PDF पाने कायमची सरळ दिशेला फिरवून सेव्ह करते.',
    summaryEn: 'Permanently rotates upside-down or sideways PDF pages to the correct reading angle.',
    choicesMr: [
      'आडवी किंवा उलटी असलेली PDF निवडा.',
      '90°, 180° किंवा 270° यांपैकी योग्य फिरवण्याचा कोन निवडा.'
    ],
    choicesEn: [
      'Upload your PDF file.',
      'Select 90°, 180°, or 270° clockwise rotation.'
    ],
    outputMr: 'सरळ फिरवलेली PDF (.pdf)',
    outputEn: 'Rotated PDF (.pdf)'
  },
  'nup-pdf': {
    summaryMr: 'कागद व प्रिंट खर्च वाचवण्यासाठी अनेक पाने एकाच A4 शीटवर (२ पाने किंवा ४ पाने प्रति शीट) व्यवस्थित बसवते.',
    summaryEn: 'Places 2 or 4 PDF pages side-by-side onto a single A4 sheet to save paper and printing cost.',
    choicesMr: [
      'प्रिंट करायची PDF फाईल निवडा.',
      'एका A4 पानावर "2 पाने (2-Up)" किंवा "4 पाने (4-Up)" हवी ते बटण निवडा.'
    ],
    choicesEn: [
      'Select your multi-page PDF.',
      'Choose 2 Pages / Sheet (2-Up) or 4 Pages / Sheet (4-Up).'
    ],
    outputMr: 'N-Up प्रिंट-रेडी A4 PDF (.pdf)',
    outputEn: 'Multi-page A4 print sheet PDF (.pdf)'
  },
  'delete-pages': {
    summaryMr: 'PDF मधील रिकामे, चुकीचे किंवा नको असलेले पान क्रमांक काढून स्वच्छ नवीन PDF बनवते.',
    summaryEn: 'Permanently removes unwanted or blank pages from your PDF document.',
    choicesMr: [
      'तुमची PDF फाईल अपलोड करा.',
      'काढायचे पान क्रमांक टाका (उदा. "1" किंवा अनेक पानांसाठी "2,4" किंवा "2-3").'
    ],
    choicesEn: [
      'Upload your PDF document.',
      'Enter page numbers to remove (e.g., "1", "2,4", or "2-3").'
    ],
    outputMr: 'नको असलेली पाने काढलेली PDF (.pdf)',
    outputEn: 'Cleaned PDF without deleted pages (.pdf)'
  },
  'extract-pages': {
    summaryMr: 'मोठ्या फाईलमधील फक्त १ किंवा निवडलेली महत्त्वाची पाने काढून त्यांची वेगळी PDF तयार करते.',
    summaryEn: 'Pulls out only the selected important pages into a brand new standalone PDF.',
    choicesMr: [
      'मूळ PDF फाईल निवडा.',
      'हवे असलेले पान क्रमांक किंवा रेंज टाका (उदा. "1" किंवा "1-2").'
    ],
    choicesEn: [
      'Upload the source PDF file.',
      'Specify page numbers or range to keep (e.g., "1" or "1-2").'
    ],
    outputMr: 'निवडलेल्या पानांची स्वतंत्र PDF (.pdf)',
    outputEn: 'Extracted pages PDF (.pdf)'
  },
  'organize-pdf': {
    summaryMr: 'PDF मधील पानांचा क्रम मागे-पुढे बदलून तुम्हाला हवा तसा नवा क्रम लावते.',
    summaryEn: 'Reorders pages in reverse order or according to a custom sequence you type.',
    choicesMr: [
      'PDF फाईल निवडा.',
      'क्रम बॉक्समध्ये "reverse" (उलटा क्रम) ठेवा किंवा स्वतःचा क्रम टाका (उदा. "3,1,2").'
    ],
    choicesEn: [
      'Upload your PDF.',
      'Keep "reverse" or type a custom sequence like "3,1,2".'
    ],
    outputMr: 'नवीन क्रमाने लावलेली PDF (.pdf)',
    outputEn: 'Reorganized PDF (.pdf)'
  },
  'page-number': {
    summaryMr: 'दस्तऐवजाच्या प्रत्येक पानावर खालच्या बाजूला सलग पृष्ठ क्रमांक टाकते.',
    summaryEn: 'Inserts clean sequential page numbers on the footer of every page.',
    choicesMr: [
      'PDF अपलोड करा.',
      'नंबर स्वरूप निवडा ("Page 1 of N" किंवा "- 1 -").',
      'नंबरची जागा निवडा: तळाशी मध्यभागी किंवा तळाशी उजवीकडे.'
    ],
    choicesEn: [
      'Upload your PDF file.',
      'Pick number style ("Page 1 of N" or "- 1 -").',
      'Choose Bottom Center or Bottom Right placement.'
    ],
    outputMr: 'पेज नंबर असलेली PDF (.pdf)',
    outputEn: 'Numbered PDF document (.pdf)'
  },
  'ocr-pdf': {
    summaryMr: 'PDF मधील सर्व पानांचा मराठी व इंग्रजी मजकूर थेट वाचून कॉपी करण्यायोग्य स्वरूपात बाहेर काढते.',
    summaryEn: 'Extracts embedded Marathi and English text from every page of your PDF for easy copying.',
    choicesMr: [
      'मजकूर काढायची PDF अपलोड करा.',
      'खालील मुख्य बटण दाबल्यावर सर्व पानांचा मजकूर खाली दिसेल — तो एका क्लिकने "कॉपी करा".'
    ],
    choicesEn: [
      'Upload the PDF file.',
      'Click the Extract button below to view and copy all extracted text.'
    ],
    outputMr: 'थेट कॉपी करण्यायोग्य मराठी/इंग्रजी मजकूर',
    outputEn: 'Copyable plain text'
  },
  'pdf-to-excel': {
    summaryMr: 'PDF मधील सर्व ओळी, याद्या आणि नोंदी वेगळ्या करून खरी Microsoft Excel (.xlsx) फाईल तयार करते.',
    summaryEn: 'Parses text lines from every PDF page into a genuine Microsoft Excel (.xlsx) workbook.',
    choicesMr: [
      'यादी किंवा डेटा असलेली PDF फाईल निवडा.',
      'बटण दाबताच मराठी युनिकोड सपोर्ट असलेली .xlsx Excel फाईल डाउनलोड होईल.'
    ],
    choicesEn: [
      'Select your PDF containing tabular lines.',
      'Click Export to download a Unicode .xlsx Excel workbook.'
    ],
    outputMr: 'अधिकृत Microsoft Excel फाईल (.xlsx)',
    outputEn: 'Microsoft Excel workbook (.xlsx)'
  },
  'pdf-to-ppt': {
    summaryMr: 'PDF च्या प्रत्येक पानावरून सादरीकरणासाठी स्लाइड्स (PowerPoint .ppt) तयार करते.',
    summaryEn: 'Converts PDF pages into formatted PowerPoint (.ppt) presentation slides.',
    choicesMr: [
      'प्रेझेंटेशन बनवायची PDF निवडा.',
      'डाउनलोड बटण दाबून थेट .ppt फाईल मिळवा.'
    ],
    choicesEn: [
      'Upload the PDF you want as slides.',
      'Click Process & Download to get your .ppt file.'
    ],
    outputMr: 'PowerPoint स्लाइड्स फाईल (.ppt)',
    outputEn: 'PowerPoint presentation (.ppt)'
  },
  'protect-pdf': {
    summaryMr: 'PDF फाईलवर १२८-बिट पासवर्ड एन्क्रिप्शन लावून फाईल लॉक करते, जेणेकरून पासवर्डशिवाय कोणीही फाईल उघडू शकणार नाही.',
    summaryEn: 'Encrypts your PDF with standard 128-bit password protection compatible with WPS Office, Adobe Acrobat, Windows, and mobile viewers.',
    choicesMr: [
      'PDF फाईल अपलोड करा.',
      'लॉक करण्यासाठी पासवर्ड बॉक्समध्ये तुमचा पासवर्ड टाका.'
    ],
    choicesEn: [
      'Upload your PDF document.',
      'Enter the password required to open the PDF.'
    ],
    outputMr: 'पासवर्ड-लॉक केलेली PDF (.pdf)',
    outputEn: 'Password-Encrypted PDF (.pdf)'
  },
  'unlock-pdf': {
    summaryMr: 'प्रिंट किंवा कॉपी निर्बंध असलेल्या वाचनीय PDF मधून सर्व मर्यादा काढून मोकळी PDF तयार करते.',
    summaryEn: 'Removes print and edit restriction flags from readable PDF documents cleanly.',
    choicesMr: [
      'निर्बंध काढायची PDF निवडा आणि आवश्यक असल्यास संदर्भ टाका.',
      'खालील बटण दाबून मोकळी PDF डाउनलोड करा.'
    ],
    choicesEn: [
      'Upload the restricted PDF document.',
      'Click Unlock & Download to save an unrestricted copy.'
    ],
    outputMr: 'निर्बंधमुक्त PDF (.pdf)',
    outputEn: 'Unlocked PDF (.pdf)'
  },
  'grayscale-pdf': {
    summaryMr: 'रंगीत किंवा छायाचित्रे असलेल्या PDF ला झेरॉक्स व शासकीय प्रिंटिंगसाठी स्पष्ट ब्लॅक-अँड-व्हाईट PDF मध्ये बदलते.',
    summaryEn: 'Converts full-color PDF pages into sharp, ink-saving black & white grayscale pages.',
    choicesMr: [
      'रंगीत PDF निवडा.',
      'डाउनलोड बटण दाबताच सर्व पाने B&W प्रिंट स्वरूपात रूपांतरित होतील.'
    ],
    choicesEn: [
      'Upload your color PDF document.',
      'Click Convert & Download for a print-ready grayscale PDF.'
    ],
    outputMr: 'ब्लॅक-अँड-व्हाईट प्रिंट PDF (.pdf)',
    outputEn: 'Grayscale B&W PDF (.pdf)'
  }
};

export const PdfToolbarSuite: React.FC = () => {
  const { lang, t } = useLanguage();
  const [activeTool, setActiveTool] = useState<PdfToolId>('compress');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [secondaryFiles, setSecondaryFiles] = useState<File[]>([]);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<
    Array<{ url: string; filename: string; sizeKb: number; isPdf: boolean; validation?: PdfValidationReport }>
  >([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [pendingLockedPdf, setPendingLockedPdf] = useState<{ bytes: Uint8Array; file: File } | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>('');
  const processingLockRef = useRef<boolean>(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Tool Specific States
  // 1. Compress
  const [targetKb, setTargetKb] = useState<number>(200);
  const [compressionMode, setCompressionMode] = useState<'lossless' | 'strong'>('strong');

  // 3. Split PDF
  const [splitRange, setSplitRange] = useState<string>('1');

  // 6. JPG to PDF
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // 7. Word to PDF
  const [wordDocTitle, setWordDocTitle] = useState<string>('महाराष्ट्र शासन • अधिकृत अर्ज');
  const [wordContent, setWordContent] = useState<string>(
    `प्रति,\nमा. तहसीलदार साहेब,\nविषय: शासकीय कामासाठी अर्ज...\n\nमी सचिन तुकाराम पाटील, रा. पुणे. विनंती अर्ज सादर करतो की माझ्या अर्जाची पडताळणी करून प्रमाणपत्र मिळावे.\n\nधन्यवाद!\nआपला नम्र,\nसचिन पाटील`
  );

  // 10. Edit PDF
  const pdfEditorRef = useRef<PdfInteractiveEditorHandle | null>(null);

  // 11. OCR Text
  const [extractedOcrText, setExtractedOcrText] = useState<string>('');

  // 12. Rotate
  const [rotateAngle, setRotateAngle] = useState<number>(90);

  // 13. Delete pages
  const [pagesToDelete, setPagesToDelete] = useState<string>('1');

  // 14. Extract pages
  const [pagesToExtract, setPagesToExtract] = useState<string>('1');

  // 15. Organize pages
  const [organizeOrder, setOrganizeOrder] = useState<string>('reverse');

  // 16 & 17. Protect / Unlock
  const [passwordInput, setPasswordInput] = useState<string>('123456');

  // 18. Watermark
  const [watermarkText, setWatermarkText] = useState<string>('महा कॉर्नर • अधिकृत');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.25);
  const [watermarkAngle] = useState<number>(-45);
  const [watermarkColor] = useState<string>('#64748b');

  // 19. Page Number
  const [pageNumberFormat, setPageNumberFormat] = useState<'num' | 'page_x_of_y' | 'marathi'>('marathi');
  const [pageNumberPos, setPageNumberPos] = useState<'bottom-center' | 'bottom-right'>('bottom-center');

  // 20. Sign PDF
  const [signerName, setSignerName] = useState<string>('सचिन पाटील');
  const [signatureDate, setSignatureDate] = useState<string>(new Date().toLocaleDateString('en-GB'));
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // 21. N-Up Pages per sheet
  const [nupCount, setNupCount] = useState<2 | 4>(2);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const gridTopRef = useRef<HTMLDivElement | null>(null);
  const toolsStripRef = useRef<HTMLDivElement | null>(null);
  const downloadBoxRef = useRef<HTMLDivElement | null>(null);
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  const registerObjectUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

  const revokeUnusedUrls = (keepUrls: string[] = []) => {
    const keepSet = new Set(keepUrls);
    for (const url of Array.from(objectUrlsRef.current)) {
      if (!keepSet.has(url)) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
        objectUrlsRef.current.delete(url);
      }
    }
  };

  useEffect(() => {
    return () => {
      revokeUnusedUrls([]);
    };
  }, []);

  // Helper: Create Typed PDF Blob (standalone offset-0 buffer for clean OS/WPS download)
  const createPdfBlob = (bytes: Uint8Array): Blob => createUniversalPdfBlob(bytes);

  // Helper: Trigger Download reliably + populate persistent Download Card (ONLY after validation for PDFs)
  const triggerDownload = (blob: Blob, filename: string, validation?: PdfValidationReport) => {
    const cleanFilename = sanitizeFilename(filename, 'maha-document.pdf');
    const url = registerObjectUrl(blob);
    const isPdf = blob.type === 'application/pdf' || cleanFilename.toLowerCase().endsWith('.pdf');
    const sizeKb = Math.max(1, Math.round(blob.size / 1024));

    // Keep newly generated URL and current source preview cleanly; revoke stale previous outputs
    revokeUnusedUrls([url]);
    setErrorMessage('');
    setGeneratedFiles([{ url, filename: cleanFilename, sizeKb, isPdf, validation }]);
    setPreviewBlobUrl(isPdf ? url : null);

    try {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 180);
    } catch (e) {
      console.warn('Auto download fallback active via button:', e);
    }

    trackFeatureAction('pdf-tools');
    confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
    setStatusMessage(
      t(`${cleanFilename} (${sizeKb} KB) पडताळणी पूर्ण होऊन डाउनलोडसाठी तयार आहे! ✓`, `${cleanFilename} (${sizeKb} KB) validated & ready to download! ✓`)
    );
    setTimeout(() => {
      downloadBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 90);
  };

  // Common 10-point PDF Validation Gate before offering any PDF download
  const finalizeAndDownloadPdf = async (
    bytes: Uint8Array,
    filename: string,
    expectedPages?: number,
    options?: { allowEncrypted?: boolean; expectedPassword?: string }
  ): Promise<PdfValidationReport | null> => {
    setProgressPct(95);
    const report = await validatePdfDocument(bytes, {
      expectedPages,
      allowEncrypted: options?.allowEncrypted,
      expectedPassword: options?.expectedPassword,
    });
    if (!report.valid) {
      const reason = report.errors[0] || t('PDF पडताळणी अयशस्वी झाली.', 'PDF structural validation failed.');
      setErrorMessage(reason);
      setStatusMessage(t(`डाउनलोड थांबवले: ${reason}`, `Download blocked: ${reason}`));
      setGeneratedFiles([]);
      return null;
    }
    setProgressPct(100);
    triggerDownload(createPdfBlob(bytes), filename, report);
    return report;
  };

  const formatUploadRejectReason = (reason?: string): string => {
    if (reason === 'FILE_TOO_LARGE') {
      return t('फाईल खूप मोठी आहे (कमाल मर्यादा: PDF 50MB / फोटो 20MB).', 'File exceeds size limit (Max: 50MB PDF / 20MB image).');
    }
    if (reason === 'EXECUTABLE_REJECTED' || reason === 'ACTIVE_CONTENT_REJECTED') {
      return t('सुरक्षेसाठी ही संभाव्य धोकादायक फाईल नाकारली आहे.', 'Rejected unsafe executable or active script file.');
    }
    return t('अवैध फाईल फॉरमॅट! कृपया खरी PDF किंवा JPG/PNG फाईल निवडा.', 'Invalid file signature! Please pick a genuine PDF or JPG/PNG.');
  };

  const loadPdfBytesIntoWorkspace = async (uint8: Uint8Array, file: File, suppliedPassword?: string) => {
    setPendingLockedPdf(null);
    setErrorMessage('');
    const { doc: pdfDoc, wasRebuilt } = await loadCleanPdfDocument(uint8, {
      password: suppliedPassword,
      onProgress: (pct) => setProgressPct(pct),
    });
    const workingBytes = wasRebuilt
      ? await saveUniversalPdf(pdfDoc, uint8, { password: suppliedPassword })
      : uint8;
    setPdfBytes(workingBytes);

    const count = pdfDoc.getPageCount();
    setPageCount(count);
    setSplitRange(count > 1 ? `1-${Math.min(2, count)}` : '1');

    const blob = createPdfBlob(workingBytes);
    const url = registerObjectUrl(blob);
    revokeUnusedUrls([url]);
    setPreviewBlobUrl(url);
    setStatusMessage(
      wasRebuilt
        ? t(`पासवर्ड/लॉक केलेली PDF सुरक्षित अनलॉक होऊन लोड झाली! एकूण पाने: ${count} ✓`, `Unlocked & loaded cleanly! Total pages: ${count} ✓`)
        : t(`PDF लोड झाली! एकूण पाने: ${count} ✓`, `PDF loaded! Total pages: ${count} ✓`)
    );
  };

  // Shared processor for file picker & drag-and-drop with magic-byte & size checks
  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setGeneratedFiles([]);
    setErrorMessage('');
    setPendingLockedPdf(null);

    const totalBatchBytes = files.reduce((acc, f) => acc + f.size, 0);
    if (totalBatchBytes > PDF_SECURITY_LIMITS.MAX_BATCH_SIZE_BYTES) {
      const msg = t('एकत्रित फाईल्सची साईज 120MB पेक्षा जास्त आहे.', 'Total selected batch exceeds 120MB limit.');
      setErrorMessage(msg);
      setStatusMessage(msg);
      return;
    }

    setStatusMessage(
      t(
        `फाईल तपासत आहे: ${file.name} (${Math.round(file.size / 1024)} KB)...`,
        `Inspecting file: ${file.name} (${Math.round(file.size / 1024)} KB)...`
      )
    );

    try {
      const inspectedPdfs: Array<{ file: File; bytes: Uint8Array }> = [];
      const inspectedImages: File[] = [];

      for (const f of files) {
        const buf = new Uint8Array(await f.arrayBuffer());
        const check = inspectUploadedFileBytes(buf, f.name, f.type);
        if (!check.valid) {
          const rejectMsg = formatUploadRejectReason(check.reason);
          setErrorMessage(rejectMsg);
          setStatusMessage(rejectMsg);
          if (f === file) setSelectedFile(null);
          return;
        }
        if (check.kind === 'pdf') {
          inspectedPdfs.push({ file: f, bytes: buf });
        } else if (check.kind === 'image') {
          inspectedImages.push(f);
        }
      }

      if (inspectedImages.length > 0) {
        setImageFiles((prev) => (activeTool === 'jpg-to-pdf' ? [...prev, ...inspectedImages] : inspectedImages));
      }

      if (inspectedPdfs.length > 0) {
        const primary = inspectedPdfs[0];
        if (inspectedPdfs.length > 1) {
          setSecondaryFiles((prev) => [...prev, ...inspectedPdfs.slice(1).map((p) => p.file)]);
        }

        try {
          await loadPdfBytesIntoWorkspace(primary.bytes, primary.file);
        } catch (pdfErr) {
          if (
            pdfErr instanceof PdfOperationError &&
            (pdfErr.code === 'PDF_PASSWORD_REQUIRED' || pdfErr.code === 'PDF_INCORRECT_PASSWORD')
          ) {
            setPendingLockedPdf({ bytes: primary.bytes, file: primary.file });
            setErrorMessage(pdfErr.message);
            setStatusMessage(pdfErr.message);
            return;
          }
          throw pdfErr;
        }
      } else if (inspectedImages.length > 0) {
        const reader = new FileReader();
        reader.onload = () => {
          setSignatureImage(reader.result as string);
          setStatusMessage(
            t(
              `${inspectedImages.length} फोटो सुरक्षितरीत्या निवडले! PDF तयार करण्यासाठी खालील बटण दाबा.`,
              `${inspectedImages.length} verified image(s) ready! Click Process below to create PDF.`
            )
          );
        };
        reader.readAsDataURL(inspectedImages[0]);
      } else {
        const text = await file.text();
        setWordContent(text.slice(0, 20000));
        setStatusMessage(t('मजकूर फाईल लोड झाली!', 'Text file loaded!'));
      }
    } catch (err) {
      console.error(err);
      const errMsg =
        err instanceof PdfOperationError
          ? err.message
          : t('फाईल खराब (Damaged) किंवा वाचता न येणारी आहे. कृपया वैध PDF निवडा.', 'Damaged or unreadable file. Please choose a valid PDF.');
      setErrorMessage(errMsg);
      setStatusMessage(errMsg);
    } finally {
      setProgressPct(0);
    }
  };

  const handleUnlockPendingPdf = async () => {
    if (!pendingLockedPdf) return;
    if (!unlockPasswordInput.trim()) {
      setErrorMessage(t('कृपया PDF चा पासवर्ड टाका.', 'Please enter the PDF password.'));
      return;
    }
    setIsProcessing(true);
    setProgressPct(25);
    try {
      await loadPdfBytesIntoWorkspace(pendingLockedPdf.bytes, pendingLockedPdf.file, unlockPasswordInput.trim());
      setUnlockPasswordInput('');
    } catch (err) {
      const msg =
        err instanceof PdfOperationError
          ? err.message
          : t('पासवर्ड चुकीचा आहे किंवा PDF वाचता आली नाही.', 'Incorrect password or unreadable PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await processSelectedFiles(files);
  };

  const handleResetWorkspace = () => {
    revokeUnusedUrls([]);
    setSelectedFile(null);
    setSecondaryFiles([]);
    setImageFiles([]);
    setPdfBytes(null);
    setPageCount(0);
    setPreviewBlobUrl(null);
    setGeneratedFiles([]);
    setExtractedOcrText('');
    setErrorMessage('');
    setProgressPct(0);
    setPendingLockedPdf(null);
    setUnlockPasswordInput('');
    setStatusMessage(t('नवीन फाइल निवडण्यासाठी तयार.', 'Ready for a new file.'));
  };

  // Helper: Parse page range like "1-3, 5" into 0-based page indices
  const parsePageSelection = (expr: string, maxPage: number): number[] => {
    const out = new Set<number>();
    const parts = expr.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [rawA, rawB] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(rawA) && !isNaN(rawB)) {
          const start = Math.max(1, Math.min(rawA, rawB));
          const end = Math.min(maxPage, Math.max(rawA, rawB));
          for (let p = start; p <= end; p++) out.add(p - 1);
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPage) out.add(p - 1);
      }
    }
    return Array.from(out).sort((a, b) => a - b);
  };

  // -------------------------------------------------------------
  // All 22 Working Client-Side Tool Handlers
  // -------------------------------------------------------------

  // 1. Compress PDF (Lossless OR Strong Raster Compression under Target KB)
  const handleCompressPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF फाइल अपलोड करा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(10);
    setStatusMessage(t(`PDF ${targetKb} KB च्या आत कॉम्प्रेस करत आहे...`, `Compressing PDF towards ${targetKb} KB...`));

    try {
      const origSize = Math.round(pdfBytes.length / 1024);

      if (compressionMode === 'strong' && window.pdfjsLib && origSize > targetKb) {
        const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice() });
        const srcPdf = await loadingTask.promise;
        try {
          const perPageBudgetBytes = (targetKb * 1024 * 0.88) / Math.max(1, srcPdf.numPages);
          const renderScale = perPageBudgetBytes < 45000 ? 1.15 : 1.5;
          let quality = targetKb <= 100 ? 0.45 : targetKb <= 200 ? 0.62 : 0.75;

          let bestBytes: Uint8Array | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            const outDoc = await PDFDocument.create();
            for (let p = 1; p <= srcPdf.numPages; p++) {
              setProgressPct(Math.round(15 + (p / srcPdf.numPages) * 70));
              const page = await srcPdf.getPage(p);
              const vp = page.getViewport({ scale: renderScale });
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(vp.width));
              canvas.height = Math.max(1, Math.round(vp.height));
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                releaseCanvasMemory(canvas);
                continue;
              }
              try {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;

                const jpgBytes = await canvasToJpegArrayBuffer(canvas, quality);
                const img = await outDoc.embedJpg(jpgBytes);
                const baseVp = page.getViewport({ scale: 1 });
                const outW = Math.min(14400, Math.max(72, baseVp.width));
                const outH = Math.min(14400, Math.max(72, baseVp.height));
                const outPage = outDoc.addPage([outW, outH]);
                outPage.drawImage(img, { x: 0, y: 0, width: outW, height: outH });
              } finally {
                releaseCanvasMemory(canvas);
                page.cleanup?.();
              }
              if (p % 3 === 0) await yieldToUi();
            }
            const candidate = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: srcPdf.numPages });
            bestBytes = candidate;
            if (candidate.length <= targetKb * 1024) break;
            quality = Math.max(0.28, quality - 0.18);
          }

          if (bestBytes) {
            const newSize = Math.round(bestBytes.length / 1024);
            const report = await finalizeAndDownloadPdf(bestBytes, `maha-compressed-${newSize}kb.pdf`, srcPdf.numPages);
            if (report) {
              setStatusMessage(
                t(
                  `PDF यशस्वीरित्या कॉम्प्रेस व पडताळणी झाली! (मूळ: ${origSize} KB → नवीन: ${newSize} KB) ✓`,
                  `Compressed & Validated! (Original: ${origSize} KB → New: ${newSize} KB) ✓`
                )
              );
            }
            return;
          }
        } finally {
          await srcPdf.destroy?.();
        }
      }

      // Lossless metadata cleanup + universal classic xref output (WPS Office & Adobe safe)
      setProgressPct(45);
      const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
      const totalPages = srcDoc.getPageCount();
      srcDoc.setTitle('');
      srcDoc.setAuthor('');
      srcDoc.setSubject('');
      srcDoc.setKeywords([]);
      const savedBytes = await saveUniversalPdf(srcDoc, pdfBytes, { expectedPages: totalPages });
      const newSize = Math.round(savedBytes.length / 1024);
      const report = await finalizeAndDownloadPdf(savedBytes, `maha-compressed-${targetKb}kb.pdf`, totalPages);
      if (report) {
        setStatusMessage(
          t(
            `PDF कॉम्प्रेस झाली! (मूळ: ${origSize} KB → नवीन: ${newSize} KB) ✓`,
            `PDF compressed! (Original: ${origSize} KB → New: ${newSize} KB) ✓`
          )
        );
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('कॉम्प्रेस करताना त्रुटी आली.', 'Error compressing PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 2. Merge PDF (Universal Cross-Reader Safe Multi-PDF Merger)
  const handleMergePdf = async () => {
    const totalFiles = (pdfBytes ? 1 : 0) + secondaryFiles.length;
    if (totalFiles < 2) {
      const msg = t(
        'कृपया एकत्र (Merge) करण्यासाठी किमान २ PDF फाइल्स निवडा ("+ अतिरिक्त PDF जोडा" वापरा).',
        'Please select at least 2 PDF files to merge (use "+ Add More PDFs").'
      );
      setErrorMessage(msg);
      setStatusMessage(msg);
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(8);
    setStatusMessage(t('सर्व PDF फाइल्स क्रमाने एकत्र जोडत आहे...', 'Merging all PDF files in exact order...'));

    try {
      const inputs: Array<{ bytes: Uint8Array; name: string }> = [];
      if (pdfBytes) {
        inputs.push({ bytes: pdfBytes, name: selectedFile?.name || 'document-1.pdf' });
      }
      for (const file of secondaryFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const check = inspectUploadedFileBytes(bytes, file.name, file.type, 'pdf');
        if (!check.valid) {
          throw new PdfOperationError(
            'PDF_CORRUPTED',
            `${file.name}: ${formatUploadRejectReason(check.reason)}`
          );
        }
        inputs.push({ bytes, name: file.name });
      }

      const { bytes: mergedBytes, report } = await mergePdfBuffersUniversally(inputs, {
        onProgress: (pct, label) => {
          setProgressPct(pct);
          setStatusMessage(label);
        },
      });
      await finalizeAndDownloadPdf(mergedBytes, `maha-merged-${report.pageCount}pages.pdf`, report.pageCount);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof PdfOperationError
          ? err.message
          : t('Merge करताना त्रुटी आली. कृपया वैध PDF फाइल्स निवडा.', 'Error merging PDF files. Ensure all files are valid PDFs.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 3. Split PDF
  const handleSplitPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया स्प्लिट करण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first to split.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('निवडलेली पाने वेगळी करून नवीन PDF तयार करत आहे...', 'Splitting selected pages...'));

    try {
      const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
      const total = srcDoc.getPageCount();
      const indices = parsePageSelection(splitRange || '1', total);
      if (indices.length === 0) {
        const msg = t(`कृपया १ ते ${total} दरम्यान योग्य पान क्रमांक किंवा रेंज (उदा. 1-2) टाका.`, `Enter a valid page or range between 1 and ${total}.`);
        setErrorMessage(msg);
        setStatusMessage(msg);
        return;
      }
      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(srcDoc, indices);
      copied.forEach((p) => outDoc.addPage(p));
      const splitBytes = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: indices.length });
      await finalizeAndDownloadPdf(splitBytes, `maha-split-${indices.length}pages.pdf`, indices.length);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('PDF स्प्लिट करताना अडचण आली.', 'Failed to split PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 5. PDF to Word (.doc)
  const handlePdfToWord = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया Word मध्ये बदलण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage(t('PDF मधील मजकूर Word (.doc) मध्ये रूपांतरित करत आहे...', 'Extracting text to Word (.doc)...'));

    try {
      const pageSections: string[] = [];
      if (window.pdfjsLib) {
        const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice() });
        const doc = await loadingTask.promise;
        try {
          for (let p = 1; p <= doc.numPages; p++) {
            setProgressPct(Math.round((p / doc.numPages) * 90));
            const page = await doc.getPage(p);
            const textContent = await page.getTextContent();
            const linesMap = new Map<number, string[]>();
            for (const raw of textContent.items) {
              const item = raw as { str?: string; transform?: number[] };
              if (!item.str) continue;
              const yKey = Math.round((item.transform?.[5] || 0) / 8) * 8;
              if (!linesMap.has(yKey)) linesMap.set(yKey, []);
              linesMap.get(yKey)!.push(item.str);
            }
            const orderedLines = Array.from(linesMap.entries())
              .sort((a, b) => b[0] - a[0])
              .map(([, parts]) => parts.join(' ').trim())
              .filter(Boolean);
            const safeHtml = orderedLines
              .map((line) => `<p>${escapeHtml(line)}</p>`)
              .join('');
            pageSections.push(
              `<div style="margin-bottom:24px;"><h3 style="color:#9a3412;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">पान ${p}</h3>${safeHtml || '<p>(स्कॅन केलेले पान / प्रतिमा)</p>'}</div>`
            );
            page.cleanup?.();
          }
        } finally {
          await doc.destroy?.();
        }
      }

      const safeTitle = escapeHtml(selectedFile?.name || 'PDF Document');
      const htmlDoc = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>${safeTitle}</title></head>
        <body style="font-family: 'Noto Sans Devanagari', Arial, sans-serif; line-height: 1.6; padding: 24px;">
          <h2 style="color:#0f172a;">${safeTitle}</h2>
          <hr />
          ${pageSections.join('<br style="page-break-before: always" />')}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
      triggerDownload(blob, `${(selectedFile?.name || 'maha-document').replace(/\.pdf$/i, '')}.doc`);
    } catch (err) {
      console.error(err);
      const msg = t('Word मध्ये रूपांतर करताना त्रुटी आली.', 'Failed to convert PDF to Word.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 6. PDF to JPG
  const handlePdfToJpg = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया JPG बनवण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (!window.pdfjsLib) {
      setStatusMessage(t('PDF रेंडरर उपलब्ध नाही.', 'PDF renderer unavailable.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(10);
    setStatusMessage(t('PDF पानांचे उच्च दर्जाचे JPG फोटो तयार करत आहे...', 'Rendering PDF pages as JPG images...'));

    let doc: any = null;
    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice() });
      doc = await loadingTask.promise;
      const baseName = sanitizeFilename((selectedFile?.name || 'maha-page').replace(/\.pdf$/i, ''), 'maha-page');
      const createdImages: Array<{ url: string; filename: string; sizeKb: number; isPdf: boolean }> = [];
      const createdUrls: string[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        setProgressPct(Math.round(10 + (p / doc.numPages) * 85));
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          releaseCanvasMemory(canvas);
          page.cleanup?.();
          continue;
        }

        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
          );
          if (blob) {
            const url = registerObjectUrl(blob);
            createdUrls.push(url);
            const filename = `${baseName}-page-${p}.jpg`;
            const sizeKb = Math.max(1, Math.round(blob.size / 1024));
            createdImages.push({ url, filename, sizeKb, isPdf: false });

            try {
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => a.remove(), 180);
            } catch {
              // Manual download link available in generatedFiles card
            }

            if (p < doc.numPages) {
              await new Promise((res) => setTimeout(res, 180));
            }
          }
        } finally {
          releaseCanvasMemory(canvas);
          page.cleanup?.();
        }
        await yieldToUi();
      }

      if (createdImages.length > 0) {
        revokeUnusedUrls(createdUrls);
        setGeneratedFiles(createdImages);
        setPreviewBlobUrl(null);
      }
      trackFeatureAction('pdf-tools');
      confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
      setStatusMessage(
        t(`${doc.numPages} पानांचे JPG फोटो डाउनलोडसाठी तयार आहेत! ✓`, `${doc.numPages} JPG page image(s) ready to download! ✓`)
      );
      setTimeout(() => {
        downloadBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 90);
    } catch (err) {
      console.error(err);
      const msg = t('PDF चे JPG बनवताना अडचण आली.', 'Failed to convert PDF to JPG.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      await doc?.destroy?.();
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 7. JPG to PDF
  const handleJpgToPdf = async () => {
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(5);

    try {
      const sources: string[] = [];
      if (imageFiles.length > 0) {
        for (const f of imageFiles) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(f);
          });
          sources.push(dataUrl);
        }
      } else if (signatureImage) {
        sources.push(signatureImage);
      }

      if (sources.length === 0) {
        setStatusMessage(t('कृपया आधी किमान १ फोटो (JPG/PNG) अपलोड करा.', 'Please upload at least 1 image (JPG/PNG) first.'));
        return;
      }

      setStatusMessage(t(`${sources.length} फोटोंपासून PDF तयार करत आहे...`, `Building PDF from ${sources.length} image(s)...`));

      const pdfDoc = await PDFDocument.create();
      for (let i = 0; i < sources.length; i++) {
        setProgressPct(Math.round(((i + 1) / sources.length) * 88));
        const src = sources[i];
        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = src;
        });

        const rawW = imgEl.naturalWidth || 1200;
        const rawH = imgEl.naturalHeight || 1600;
        const maxSide = 2200;
        const downScale = Math.max(rawW, rawH) > maxSide ? maxSide / Math.max(rawW, rawH) : 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rawW * downScale));
        canvas.height = Math.max(1, Math.round(rawH * downScale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          releaseCanvasMemory(canvas);
          continue;
        }
        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

          const jpgBytes = await canvasToJpegArrayBuffer(canvas, 0.92);
          const embedded = await pdfDoc.embedJpg(jpgBytes);
          const { pageW, pageH, drawW, drawH, offsetX, offsetY } = fitImageToStandardPdfPage(
            canvas.width,
            canvas.height
          );
          const page = pdfDoc.addPage([pageW, pageH]);
          page.drawImage(embedded, { x: offsetX, y: offsetY, width: drawW, height: drawH });
        } finally {
          releaseCanvasMemory(canvas);
        }
        await yieldToUi();
      }

      const outBytes = await saveUniversalPdf(pdfDoc, undefined, { expectedPages: sources.length });
      await finalizeAndDownloadPdf(outBytes, `maha-photos-${sources.length}pages.pdf`, sources.length);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('फोटोवरून PDF तयार करताना अडचण आली.', 'Error creating PDF from images.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 8. Word to PDF (Multi-page Unicode & Marathi Devanagari Safe via High-Res Canvas -> PDF)
  const handleWordToPdf = async () => {
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(15);
    setStatusMessage(t('Word मजकूरावरून अधिकृत A4 PDF तयार करत आहे...', 'Creating multi-page official A4 PDF from text...'));

    try {
      const scale = 2.2;
      const pageW = Math.round(595.28 * scale);
      const pageH = Math.round(841.89 * scale);
      const maxLineW = (595.28 - 72) * scale;
      const lineStep = 20 * scale;
      const maxY = (841.89 - 55) * scale;

      // Measure & paginate wrapped lines cleanly before rendering pages
      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d');
      if (!mCtx) throw new Error('Canvas unavailable');
      mCtx.font = `500 ${12 * scale}px "Noto Sans Devanagari", sans-serif`;

      const wrappedLines: Array<{ text: string; blank?: boolean }> = [];
      for (const rawLine of wordContent.split('\n')) {
        if (!rawLine.trim()) {
          wrappedLines.push({ text: '', blank: true });
          continue;
        }
        const words = rawLine.split(' ');
        let current = '';
        for (const w of words) {
          const test = current ? `${current} ${w}` : w;
          if (mCtx.measureText(test).width > maxLineW && current) {
            wrappedLines.push({ text: current });
            current = w;
          } else {
            current = test;
          }
          // Break single oversized token (e.g., long URLs or unbroken text) across lines
          while (current && mCtx.measureText(current).width > maxLineW) {
            let cut = current.length;
            while (cut > 1 && mCtx.measureText(current.slice(0, cut)).width > maxLineW) {
              cut -= 1;
            }
            wrappedLines.push({ text: current.slice(0, cut) });
            current = current.slice(cut);
          }
        }
        if (current) wrappedLines.push({ text: current });
      }
      releaseCanvasMemory(measureCanvas);

      // Split wrapped lines into pages
      const pagesLines: Array<Array<{ text: string; blank?: boolean }>> = [[]];
      let simY = 130 * scale;
      for (const item of wrappedLines) {
        const step = item.blank ? lineStep * 0.7 : lineStep;
        if (simY + step > maxY && pagesLines[pagesLines.length - 1].length > 0) {
          pagesLines.push([]);
          simY = 92 * scale;
        }
        pagesLines[pagesLines.length - 1].push(item);
        simY += step;
      }

      const pdfDoc = await PDFDocument.create();
      for (let pageIdx = 0; pageIdx < pagesLines.length; pageIdx++) {
        setProgressPct(Math.round(25 + ((pageIdx + 1) / pagesLines.length) * 65));
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          releaseCanvasMemory(canvas);
          continue;
        }
        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageW, pageH);

          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3;
          ctx.strokeRect(20 * scale, 20 * scale, (595.28 - 40) * scale, (841.89 - 40) * scale);

          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(25 * scale, 25 * scale, (595.28 - 50) * scale, 36 * scale);

          ctx.fillStyle = '#9a3412';
          ctx.font = `900 ${11 * scale}px "Noto Sans Devanagari", sans-serif`;
          ctx.fillText('MAHA CORNER TOOL • OFFICIAL DOCUMENT', 36 * scale, 47 * scale);

          ctx.fillStyle = '#475569';
          ctx.textAlign = 'right';
          ctx.font = `700 ${10 * scale}px sans-serif`;
          ctx.fillText(new Date().toLocaleDateString('en-GB'), (595.28 - 36) * scale, 47 * scale);

          ctx.textAlign = 'left';
          let cursorY = 92 * scale;
          if (pageIdx === 0) {
            ctx.fillStyle = '#0f172a';
            ctx.font = `900 ${16 * scale}px "Noto Sans Devanagari", sans-serif`;
            ctx.fillText(wordDocTitle || 'दस्तऐवज', 36 * scale, 92 * scale, maxLineW);

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(36 * scale, 104 * scale);
            ctx.lineTo((595.28 - 36) * scale, 104 * scale);
            ctx.stroke();
            cursorY = 130 * scale;
          }

          ctx.fillStyle = '#1e293b';
          ctx.font = `500 ${12 * scale}px "Noto Sans Devanagari", sans-serif`;
          for (const line of pagesLines[pageIdx]) {
            if (line.blank) {
              cursorY += lineStep * 0.7;
              continue;
            }
            ctx.fillText(line.text, 36 * scale, cursorY);
            cursorY += lineStep;
          }

          ctx.fillStyle = '#64748b';
          ctx.font = `600 ${9 * scale}px "Noto Sans Devanagari", sans-serif`;
          ctx.fillText(
            `तयार केले: महा कॉर्नर टूल • पान ${pageIdx + 1} / ${pagesLines.length}`,
            36 * scale,
            (841.89 - 30) * scale
          );

          const jpgBytes = await canvasToJpegArrayBuffer(canvas, 0.94);
          const page = pdfDoc.addPage([595.28, 841.89]);
          const embedded = await pdfDoc.embedJpg(jpgBytes);
          page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
        } finally {
          releaseCanvasMemory(canvas);
        }
      }

      const pdfData = await saveUniversalPdf(pdfDoc, undefined, { expectedPages: pagesLines.length });
      await finalizeAndDownloadPdf(pdfData, `maha-word-to-pdf.pdf`, pagesLines.length);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('Word to PDF तयार करताना अडचण आली.', 'Error creating Word to PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 18. PDF to Excel (Extract real lines from PDF into genuine Microsoft Excel .xlsx workbook)
  const handlePdfToExcel = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया Excel मध्ये बदलण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(15);
    setStatusMessage(t('PDF मधील नोंदी खऱ्या Excel (.xlsx) फाईलमध्ये रूपांतरित करत आहे...', 'Extracting PDF lines to Excel (.xlsx)...'));

    let doc: any = null;
    try {
      const sheetRows: Array<Array<string | number>> = [['पान क्र.', 'ओळ क्र.', 'मजकूर']];
      if (window.pdfjsLib) {
        doc = await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
          setProgressPct(Math.round(15 + (p / doc.numPages) * 80));
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const linesMap = new Map<number, string[]>();
          for (const raw of content.items) {
            const item = raw as { str?: string; transform?: number[] };
            if (!item.str) continue;
            const yKey = Math.round((item.transform?.[5] || 0) / 8) * 8;
            if (!linesMap.has(yKey)) linesMap.set(yKey, []);
            linesMap.get(yKey)!.push(item.str);
          }
          let lineIdx = 1;
          for (const [, parts] of Array.from(linesMap.entries()).sort((a, b) => b[0] - a[0])) {
            const txt = parts.join(' ').trim();
            if (txt) {
              sheetRows.push([p, lineIdx, sanitizeSpreadsheetCell(txt)]);
              lineIdx++;
            }
          }
          page.cleanup?.();
        }
      }
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      worksheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 90 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'PDF Data');
      const xlsxArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const blob = new Blob([xlsxArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerDownload(blob, `${(selectedFile?.name || 'maha-table').replace(/\.pdf$/i, '')}.xlsx`);
    } catch (err) {
      console.error(err);
      const msg = t('Excel (.xlsx) रूपांतरणादरम्यान त्रुटी आली.', 'Failed to export Excel workbook.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      await doc?.destroy?.();
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 19. PDF to PPT (Builds PowerPoint slides wrapper with extracted page text)
  const handlePdfToPpt = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया PPT बनवण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(15);
    setStatusMessage(t('PowerPoint प्रेझेंटेशन तयार करत आहे...', 'Generating PowerPoint presentation...'));

    let doc: any = null;
    try {
      const slidesHtml: string[] = [];
      if (window.pdfjsLib) {
        doc = await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
          setProgressPct(Math.round(15 + (p / doc.numPages) * 80));
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const snippet = content.items
            .map((i: { str?: string }) => i.str || '')
            .join(' ')
            .trim()
            .slice(0, 700);
          slidesHtml.push(`
            <div style="border:2px solid #e11d48;padding:28px;border-radius:16px;background:#1e293b;margin-bottom:24px;">
              <h2 style="color:#fbbf24;margin-top:0;">स्लाइड ${p} / ${doc.numPages}</h2>
              <p style="color:#f1f5f9;font-size:15px;line-height:1.6;">${escapeHtml(snippet || '(प्रतिमा किंवा स्कॅन केलेले पान)')}</p>
            </div>
          `);
          page.cleanup?.();
        }
      }

      const safeTitle = escapeHtml(selectedFile?.name || 'Document');
      const pptHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint">
        <head><meta charset="utf-8"><title>महा कॉर्नर टूल सादरीकरण</title></head>
        <body style="font-family: Arial, sans-serif; background: #0f172a; color: white; padding: 36px;">
          <h1 style="color:#f43f5e;">महा कॉर्नर टूल • PowerPoint सादरीकरण</h1>
          <p>दस्तऐवज: ${safeTitle}</p>
          ${slidesHtml.join('')}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', pptHtml], { type: 'application/vnd.ms-powerpoint;charset=utf-8' });
      triggerDownload(blob, `${(selectedFile?.name || 'maha-slides').replace(/\.pdf$/i, '')}.ppt`);
    } catch (err) {
      console.error(err);
      const msg = t('PPT तयार करताना अडचण आली.', 'Failed to create PPT.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      await doc?.destroy?.();
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 4. Edit PDF
  const handleEditPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया एडिट करण्यासाठी आधी PDF फाइल निवडा.', 'Please upload a PDF file first to edit.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('एडिट केलेली PDF सेव्ह करत आहे...', 'Exporting edited PDF...'));
    try {
      await pdfEditorRef.current?.exportEditedPdf();
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('PDF एडिट करताना त्रुटी आली.', 'Error editing PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 17. OCR / Extract Real Text from PDF
  const handleOcrPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया मजकूर काढण्यासाठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(15);
    setStatusMessage(t('PDF मधील सर्व पानांचा मजकूर काढत आहे...', 'Extracting text across PDF pages...'));

    let doc: any = null;
    try {
      let fullText = '';
      if (window.pdfjsLib) {
        doc = await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
          setProgressPct(Math.round(15 + (p / doc.numPages) * 80));
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const linesMap = new Map<number, string[]>();
          for (const raw of content.items) {
            const item = raw as { str?: string; transform?: number[] };
            if (!item.str) continue;
            const yKey = Math.round((item.transform?.[5] || 0) / 8) * 8;
            if (!linesMap.has(yKey)) linesMap.set(yKey, []);
            linesMap.get(yKey)!.push(item.str);
          }
          const pageLines = Array.from(linesMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([, parts]) => parts.join(' ').trim())
            .filter(Boolean);
          fullText += `--- पान ${p} ---\n${pageLines.join('\n') || '(स्कॅन केलेल्या प्रतिमेमध्ये थेट युनिकोड मजकूर उपलब्ध नाही)'}\n\n`;
          page.cleanup?.();
        }
      }
      const cleanText = fullText.trim();
      setExtractedOcrText(cleanText);
      const baseName = (selectedFile?.name || 'maha-ocr').replace(/\.pdf$/i, '');
      triggerDownload(new Blob(['\uFEFF' + cleanText], { type: 'text/plain;charset=utf-8' }), `${baseName}-text.txt`);
      setStatusMessage(t('PDF मधील मजकूर काढला व .txt फाईल तयार झाली! ✓', 'Text extracted & .txt file ready to download! ✓'));
    } catch (err) {
      console.error(err);
      const msg = t('मजकूर काढताना त्रुटी आली.', 'Error extracting text.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      await doc?.destroy?.();
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 11. Rotate PDF
  const handleRotatePdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF फाइल निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t(`PDF पाने ${rotateAngle}° फिरवत आहे...`, `Rotating PDF pages ${rotateAngle}°...`));

    try {
      const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes, { onProgress: (pct) => setProgressPct(pct) });
      const total = pdfDoc.getPageCount();
      for (const page of pdfDoc.getPages()) {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + rotateAngle) % 360));
      }
      const rotatedBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: total });
      await finalizeAndDownloadPdf(rotatedBytes, `maha-rotated-${rotateAngle}deg.pdf`, total);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('पेज फिरवताना अडचण आली.', 'Failed to rotate PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 13. Delete Pages
  const handleDeletePages = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF फाइल निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('निवडलेली पाने हटवत आहे...', 'Deleting selected pages...'));

    try {
      const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes);
      const total = pdfDoc.getPageCount();
      const targets = parsePageSelection(pagesToDelete, total);
      if (targets.length === 0) {
        const msg = t(`अवैध पान क्रमांक! (१ ते ${total} दरम्यान निवडा)`, `Invalid page number! Choose between 1 and ${total}.`);
        setErrorMessage(msg);
        setStatusMessage(msg);
        return;
      }
      if (targets.length >= total) {
        const msg = t('सर्वच पाने डिलीट करता येत नाहीत; किमान १ पान शिल्लक ठेवा.', 'Cannot delete all pages; keep at least 1 page.');
        setErrorMessage(msg);
        setStatusMessage(msg);
        return;
      }
      for (const idx of [...targets].sort((a, b) => b - a)) {
        pdfDoc.removePage(idx);
      }
      const expected = total - targets.length;
      const cleanBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: expected });
      await finalizeAndDownloadPdf(cleanBytes, `maha-deleted-pages.pdf`, expected);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('पान डिलीट करताना त्रुटी आली.', 'Error deleting pages.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 14. Extract Pages
  const handleExtractPages = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('निवडलेली पाने वेगळी काढत आहे...', 'Extracting pages...'));

    try {
      const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
      const total = srcDoc.getPageCount();
      const indices = parsePageSelection(pagesToExtract, total);
      if (indices.length === 0) {
        const msg = t(`अवैध पान क्रमांक! (१ ते ${total} दरम्यान निवडा)`, `Invalid page number! Choose between 1 and ${total}.`);
        setErrorMessage(msg);
        setStatusMessage(msg);
        return;
      }
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(srcDoc, indices);
      copied.forEach((p) => newDoc.addPage(p));
      const extractedBytes = await saveUniversalPdf(newDoc, pdfBytes, { expectedPages: indices.length });
      await finalizeAndDownloadPdf(extractedBytes, `maha-extracted-${indices.length}pages.pdf`, indices.length);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('पान वेगळे काढताना त्रुटी आली.', 'Error extracting pages.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 15. Organize PDF
  const handleOrganizePdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('पानांचा क्रम बदलत आहे...', 'Reordering pages...'));

    try {
      const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
      const count = srcDoc.getPageCount();
      const newDoc = await PDFDocument.create();

      let order: number[] = [];
      if (organizeOrder.trim().toLowerCase() === 'reverse') {
        order = srcDoc.getPageIndices().reverse();
      } else {
        order = organizeOrder
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((idx) => !isNaN(idx) && idx >= 0 && idx < count);
        if (order.length === 0) order = srcDoc.getPageIndices().reverse();
      }

      const copied = await newDoc.copyPages(srcDoc, order);
      copied.forEach((p) => newDoc.addPage(p));
      const organizedBytes = await saveUniversalPdf(newDoc, pdfBytes, { expectedPages: order.length });
      await finalizeAndDownloadPdf(organizedBytes, `maha-organized-${order.length}pages.pdf`, order.length);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('क्रम बदलताना त्रुटी आली.', 'Error reordering pages.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 20. Protect PDF (Real RC4-128 Password Encryption via Ghostscript Engine)
  const handleProtectPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    const pwd = passwordInput.trim();
    if (!pwd || pwd.length > 64) {
      const msg = t('कृपया PDF लॉक करण्यासाठी १ ते ६४ अक्षरांचा पासवर्ड टाका.', 'Please enter a password (1–64 characters) to lock this PDF.');
      setErrorMessage(msg);
      setStatusMessage(msg);
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t('PDF पासवर्ड एन्क्रिप्शनने सुरक्षित लॉक करत आहे...', 'Encrypting PDF with real password protection...'));
    try {
      const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes);
      const total = pdfDoc.getPageCount();
      const sanitizedBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: total });
      setProgressPct(65);

      const cleanPayload = new Uint8Array(sanitizedBytes.byteLength);
      cleanPayload.set(sanitizedBytes);

      const res = await fetch('/api/pdf/protect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-pdf-password': encodeURIComponent(pwd),
        },
        body: new Blob([cleanPayload], { type: 'application/pdf' }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || `Server returned ${res.status}`);
      }

      const encryptedBuf = new Uint8Array(await res.arrayBuffer());
      await finalizeAndDownloadPdf(encryptedBuf, `maha-protected.pdf`, total, {
        allowEncrypted: true,
        expectedPassword: pwd,
      });
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof PdfOperationError
          ? err.message
          : t('पासवर्ड लॉक लावताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.', 'Failed to encrypt PDF with password. Please retry.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 21. Unlock PDF (Uses supplied password to decrypt & rebuild unlocked PDF)
  const handleUnlockPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया लॉक असलेली PDF निवडा.', 'Please select a PDF first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(20);
    setStatusMessage(t('PDF अनलॉक करत आहे...', 'Unlocking PDF...'));
    const suppliedPassword = passwordInput.trim() || unlockPasswordInput.trim() || undefined;
    try {
      let outDoc: PDFDocument;
      try {
        const probe = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        if (probe.isEncrypted && window.pdfjsLib) {
          outDoc = await rebuildPdfViaCanvas(pdfBytes, {
            scale: 2.0,
            quality: 0.92,
            password: suppliedPassword,
            onProgress: (pct) => setProgressPct(pct),
          });
        } else {
          const clean = await loadCleanPdfDocument(pdfBytes, { password: suppliedPassword });
          outDoc = clean.doc;
        }
      } catch (innerErr) {
        if (
          innerErr instanceof PdfOperationError &&
          (innerErr.code === 'PDF_PASSWORD_REQUIRED' || innerErr.code === 'PDF_INCORRECT_PASSWORD')
        ) {
          throw innerErr;
        }
        outDoc = await rebuildPdfViaCanvas(pdfBytes, {
          scale: 2.0,
          quality: 0.92,
          password: suppliedPassword,
          onProgress: (pct) => setProgressPct(pct),
        });
      }
      const total = outDoc.getPageCount();
      const unlockedBytes = await saveUniversalPdf(outDoc, pdfBytes, {
        expectedPages: total,
        password: suppliedPassword,
      });
      await finalizeAndDownloadPdf(unlockedBytes, `maha-unlocked.pdf`, total);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof PdfOperationError
          ? err.message
          : t('अनलॉक करताना अडचण आली. कृपया पासवर्ड तपासा.', 'Failed to unlock PDF. Please verify password.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 10. Watermark PDF
  const handleWatermarkPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please select a PDF first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(10);
    setStatusMessage(t('प्रत्येक पानावर वॉटरमार्क जोडत आहे...', 'Applying watermark to all pages...'));

    let srcDoc: any = null;
    try {
      if (window.pdfjsLib) {
        srcDoc = await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        const outDoc = await PDFDocument.create();

        for (let p = 1; p <= srcDoc.numPages; p++) {
          setProgressPct(Math.round(10 + (p / srcDoc.numPages) * 80));
          const jsPage = await srcDoc.getPage(p);
          const baseVp = jsPage.getViewport({ scale: 1 });
          const renderScale = 2.0;
          const vp = jsPage.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            releaseCanvasMemory(canvas);
            jsPage.cleanup?.();
            continue;
          }

          try {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await jsPage.render({ canvasContext: ctx, viewport: vp }).promise;

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((watermarkAngle * Math.PI) / 180);
            ctx.globalAlpha = watermarkOpacity;
            ctx.fillStyle = watermarkColor;
            const fontPx = Math.max(36, Math.round(Math.min(canvas.width, canvas.height) * 0.065));
            ctx.font = `900 ${fontPx}px "Noto Sans Devanagari", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(watermarkText || 'MAHA CORNER TOOL', 0, 0, canvas.width * 0.92);
            ctx.restore();

            const jpgBytes = await canvasToJpegArrayBuffer(canvas, 0.92);
            const embedded = await outDoc.embedJpg(jpgBytes);
            const outW = Math.min(14400, Math.max(72, baseVp.width));
            const outH = Math.min(14400, Math.max(72, baseVp.height));
            const outPage = outDoc.addPage([outW, outH]);
            outPage.drawImage(embedded, { x: 0, y: 0, width: outW, height: outH });
          } finally {
            releaseCanvasMemory(canvas);
            jsPage.cleanup?.();
          }
          if (p % 3 === 0) await yieldToUi();
        }

        const watermarkedBytes = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: srcDoc.numPages });
        await finalizeAndDownloadPdf(watermarkedBytes, `maha-watermarked.pdf`, srcDoc.numPages);
      } else {
        const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes);
        const total = pdfDoc.getPageCount();
        const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
        const asciiText = (watermarkText || 'MAHA CORNER TOOL').replace(/[^\x20-\x7E]/g, '').trim() || 'MAHA CORNER TOOL';
        for (const page of pdfDoc.getPages()) {
          const { width, height } = page.getSize();
          page.drawText(asciiText, {
            x: width * 0.2,
            y: height * 0.45,
            size: Math.max(24, Math.min(width, height) * 0.06),
            font,
            color: rgb(0.4, 0.45, 0.54),
            opacity: watermarkOpacity,
            rotate: degrees(Math.abs(watermarkAngle))
          });
        }
        const watermarkedBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: total });
        await finalizeAndDownloadPdf(watermarkedBytes, `maha-watermarked.pdf`, total);
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('वॉटरमार्क जोडताना अडचण आली.', 'Failed to add watermark.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      await srcDoc?.destroy?.();
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 16. Page Number
  const handlePageNumberPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(30);
    setStatusMessage(t('सर्व पानांवर पेज नंबर टाकत आहे...', 'Adding page numbers...'));
    try {
      const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes);
      const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const total = pages.length;

      pages.forEach((page, idx) => {
        const { width } = page.getSize();
        const pageNum = idx + 1;
        const text =
          pageNumberFormat === 'marathi' || pageNumberFormat === 'page_x_of_y'
            ? `Page ${pageNum} of ${total}`
            : `- ${pageNum} -`;
        const posX = pageNumberPos === 'bottom-right' ? width - 85 : width / 2 - 28;
        page.drawText(text, { x: posX, y: 20, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
      });

      const numberedBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: total });
      await finalizeAndDownloadPdf(numberedBytes, `maha-numbered-${total}pages.pdf`, total);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('पेज नंबर लावताना अडचण आली.', 'Error adding page numbers.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 9. Sign PDF
  const handleSignPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please select a PDF first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(30);
    setStatusMessage(t('डिजिटल सही PDF वर जोडत आहे...', 'Stamping signature onto PDF...'));

    const stampCanvas = document.createElement('canvas');
    try {
      const { doc: pdfDoc } = await loadCleanPdfDocument(pdfBytes);
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const targetPage = pages[pages.length - 1];
      const { width } = targetPage.getSize();

      stampCanvas.width = 520;
      stampCanvas.height = 220;
      const sCtx = stampCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#f5f9ff';
        sCtx.fillRect(0, 0, stampCanvas.width, stampCanvas.height);
        sCtx.strokeStyle = '#1e40af';
        sCtx.lineWidth = 6;
        sCtx.strokeRect(3, 3, stampCanvas.width - 6, stampCanvas.height - 6);

        sCtx.fillStyle = '#1d4ed8';
        sCtx.font = '800 22px sans-serif';
        sCtx.fillText('DIGITALLY SIGNED', 24, 42);

        sCtx.fillStyle = '#0f172a';
        sCtx.font = '900 30px "Noto Sans Devanagari", sans-serif';
        sCtx.fillText(signerName || 'Authorized Signatory', 24, 92, 250);

        sCtx.fillStyle = '#475569';
        sCtx.font = '600 20px sans-serif';
        sCtx.fillText(`Date: ${signatureDate}`, 24, 185);

        if (sigCanvasRef.current) {
          sCtx.drawImage(sigCanvasRef.current, 275, 50, 225, 130);
        }
      }

      const stampJpgBytes = await canvasToJpegArrayBuffer(stampCanvas, 0.94);
      const stampEmbed = await pdfDoc.embedJpg(stampJpgBytes);
      const boxW = 175;
      const boxH = 74;
      targetPage.drawImage(stampEmbed, {
        x: Math.max(20, width - boxW - 35),
        y: 40,
        width: boxW,
        height: boxH
      });

      const signedBytes = await saveUniversalPdf(pdfDoc, pdfBytes, { expectedPages: total });
      await finalizeAndDownloadPdf(signedBytes, `maha-digitally-signed.pdf`, total);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('सही जोडताना अडचण आली.', 'Failed to add signature.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      releaseCanvasMemory(stampCanvas);
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 12. N-Up PDF (2 or 4 Pages Per A4 Sheet via pdfDoc.embedPage)
  const handleNupPdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया N-Up साठी आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(25);
    setStatusMessage(t(`एका पानावर ${nupCount} पाने बसवत आहे...`, `Laying out ${nupCount} pages per A4 sheet...`));

    try {
      const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
      const outDoc = await PDFDocument.create();
      const embeddedPages = await outDoc.embedPages(srcDoc.getPages());

      // A4 Portrait (595.28 x 841.89) or Landscape for 2-up (841.89 x 595.28)
      const sheetW = nupCount === 2 ? 841.89 : 595.28;
      const sheetH = nupCount === 2 ? 595.28 : 841.89;
      const cols = 2;
      const rows = nupCount === 2 ? 1 : 2;
      const margin = 18;
      const cellW = (sheetW - margin * (cols + 1)) / cols;
      const cellH = (sheetH - margin * (rows + 1)) / rows;

      for (let i = 0; i < embeddedPages.length; i += nupCount) {
        const sheet = outDoc.addPage([sheetW, sheetH]);
        for (let slot = 0; slot < nupCount; slot++) {
          const ep = embeddedPages[i + slot];
          if (!ep) break;
          const col = slot % cols;
          const rowFromTop = Math.floor(slot / cols);
          const scale = Math.min(cellW / ep.width, cellH / ep.height);
          const drawW = ep.width * scale;
          const drawH = ep.height * scale;
          const cellX = margin + col * (cellW + margin);
          const cellY = sheetH - margin - (rowFromTop + 1) * cellH - rowFromTop * margin;
          sheet.drawPage(ep, {
            x: cellX + (cellW - drawW) / 2,
            y: cellY + (cellH - drawH) / 2,
            width: drawW,
            height: drawH
          });
        }
      }

      const expectedSheets = Math.ceil(embeddedPages.length / nupCount);
      const nupBytes = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: expectedSheets });
      await finalizeAndDownloadPdf(nupBytes, `maha-${nupCount}up-print-sheet.pdf`, expectedSheets);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('N-Up तयार करताना अडचण आली.', 'Failed to build N-Up sheet.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // 22. Grayscale / Black & White Print PDF
  const handleGrayscalePdf = async () => {
    if (!pdfBytes) {
      setStatusMessage(t('कृपया आधी PDF निवडा.', 'Please upload a PDF file first.'));
      return;
    }
    if (!window.pdfjsLib) {
      setStatusMessage(t('PDF रेंडरर उपलब्ध नाही.', 'PDF renderer unavailable.'));
      return;
    }
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage('');
    setProgressPct(15);
    setStatusMessage(t('PDF ब्लॅक-अँड-व्हाईट प्रिंट स्वरूपात बदलत आहे...', 'Converting PDF to crisp B&W grayscale...'));

    try {
      const outDoc = await rebuildPdfViaCanvas(pdfBytes, {
        grayscale: true,
        scale: 1.8,
        quality: 0.88,
        onProgress: (pct) => setProgressPct(pct),
      });
      const total = outDoc.getPageCount();
      const bwBytes = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: total });
      await finalizeAndDownloadPdf(bwBytes, `maha-bw-print.pdf`, total);
    } catch (err) {
      console.error(err);
      const msg = err instanceof PdfOperationError ? err.message : t('B&W रूपांतरणात त्रुटी आली.', 'Failed to convert to grayscale.');
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
      setProgressPct(0);
    }
  };

  // Sign Pad Drawing Helpers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignatureCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Filter tools based on category & search
  const filteredTools = PDF_TOOLS.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.titleMr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedToolObj = PDF_TOOLS.find((tool) => tool.id === activeTool) || PDF_TOOLS[0];
  const selectedToolGuide = TOOL_GUIDES[selectedToolObj.id];
  const displayStatus =
    statusMessage || t('वरील बटण दाबून फाईल निवडा किंवा ड्रॅग करा.', 'Click the Select File button above or drop your file.');

  const handleSelectTool = (tool: ToolItem) => {
    setActiveTool(tool.id);
    setGeneratedFiles([]);
    setStatusMessage(
      t(`${tool.titleMr} निवडले. खालील माहिती व पर्याय तपासा.`, `${tool.title} selected. Check details and options below.`)
    );
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const scrollToolsStrip = (dir: -1 | 1) => {
    toolsStripRef.current?.scrollBy({ left: dir * 460, behavior: 'smooth' });
  };

  const needsPdfUploadNow =
    selectedToolObj.needsPdf && !pdfBytes && !(activeTool === 'merge' && secondaryFiles.length > 0);
  const needsImagesUploadNow = activeTool === 'jpg-to-pdf' && imageFiles.length === 0 && !signatureImage;

  const handleExecuteActiveTool = () => {
    if (needsPdfUploadNow) {
      setStatusMessage(t('कृपया आधी PDF फाईल निवडा.', 'Please select a PDF file first.'));
      fileInputRef.current?.click();
      return;
    }
    if (needsImagesUploadNow) {
      setStatusMessage(t('कृपया आधी JPG/PNG फोटो निवडा.', 'Please select JPG/PNG images first.'));
      (imageInputRef.current || fileInputRef.current)?.click();
      return;
    }

    setGeneratedFiles([]);

    if (activeTool === 'compress') handleCompressPdf();
    else if (activeTool === 'merge') handleMergePdf();
    else if (activeTool === 'split') handleSplitPdf();
    else if (activeTool === 'pdf-to-word') handlePdfToWord();
    else if (activeTool === 'pdf-to-jpg') handlePdfToJpg();
    else if (activeTool === 'jpg-to-pdf') handleJpgToPdf();
    else if (activeTool === 'word-to-pdf') handleWordToPdf();
    else if (activeTool === 'pdf-to-excel') handlePdfToExcel();
    else if (activeTool === 'pdf-to-ppt') handlePdfToPpt();
    else if (activeTool === 'edit-pdf') handleEditPdf();
    else if (activeTool === 'ocr-pdf') handleOcrPdf();
    else if (activeTool === 'rotate-pdf') handleRotatePdf();
    else if (activeTool === 'delete-pages') handleDeletePages();
    else if (activeTool === 'extract-pages') handleExtractPages();
    else if (activeTool === 'organize-pdf') handleOrganizePdf();
    else if (activeTool === 'protect-pdf') handleProtectPdf();
    else if (activeTool === 'unlock-pdf') handleUnlockPdf();
    else if (activeTool === 'watermark-pdf') handleWatermarkPdf();
    else if (activeTool === 'page-number') handlePageNumberPdf();
    else if (activeTool === 'sign-pdf') handleSignPdf();
    else if (activeTool === 'nup-pdf') handleNupPdf();
    else if (activeTool === 'grayscale-pdf') handleGrayscalePdf();
  };

  return (
    <div className="space-y-6" ref={gridTopRef}>
      {/* Maha Corner Tool Hero Header (Clean Editorial + Search & Category Filter) */}
      <section className="rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8 relative">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-400">
                <span>{t('महा कॉर्नर टूल', 'Maha Corner Tool')}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">
                  {t('मोफत PDF कॉम्प्रेसर, कन्व्हर्टर आणि एडिट स्टुडिओ', 'Free PDF Compressor, Converter & Editor')}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight text-balance">
                {t('महा कॉर्नर टूल', 'Maha Corner Tool')}{' '}
                <span className="text-rose-500">— {t('संपूर्ण २२ PDF टूल्स', 'Every PDF Tool You Need')}</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                {t(
                  'खालील दोन ओळींमधून हवी ती सुविधा निवडा; निवडताच त्या सुविधेविषयी संपूर्ण माहिती व पर्याय लगेच खाली दिसतील.',
                  'Pick any facility from the 2-row bar below — detailed usage info and choices appear immediately below.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl shrink-0">
              <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-white">{t('१००% खाजगी व सुरक्षित', '100% Private On-Device')}</div>
                <div className="text-slate-400 mt-0.5">{t('कोणतीही फाइल सर्व्हरवर जात नाही', 'Files never leave your browser')}</div>
              </div>
            </div>
          </div>

          {/* Segmented Category Filter Bar + Live Search */}
          <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'all', mr: 'सर्व २२ टूल्स', en: 'All 22 Tools' },
                { id: 'optimize', mr: 'कॉम्प्रेस व मर्ज', en: 'Compress & Merge' },
                { id: 'convert', mr: 'कन्व्हर्टर (Word/JPG)', en: 'Convert PDF' },
                { id: 'edit', mr: 'एडिट व सही', en: 'Edit & Sign' },
                { id: 'pages', mr: 'पेज टूल्स', en: 'Page Tools' },
                { id: 'security', mr: 'सुरक्षा लॉक', en: 'Security' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-[0.98] cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {lang === 'en' ? cat.en : cat.mr}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('टूल शोधा (उदा. Edit, Compress, Split)...', 'Search tools (Edit, Compress, Split)...')}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Two-Row Compact Tool Selector ("दोन लाईन मध्ये सर्व सुविधा") */}
      <section aria-label={t('सर्व PDF टूल्स (दोन लाईन)', 'All PDF Tools (2 Rows)')} className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <span>{t('सुविधा निवडा (दोन ओळींमध्ये):', 'Select a Facility (2-Row Strip):')}</span>
            <span className="text-slate-400 font-normal hidden sm:inline">
              {t('· डावीकडे/उजवीकडे सरकवून सर्व २२ सुविधा पहा', '· Scroll sideways to browse all 22 tools')}
            </span>
          </div>
          {filteredTools.length > 5 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollToolsStrip(-1)}
                aria-label="Scroll tools left"
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-transform"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToolsStrip(1)}
                aria-label="Scroll tools right"
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-transform"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div
          ref={toolsStripRef}
          className={`grid gap-3 ${
            filteredTools.length > 4
              ? 'grid-rows-2 grid-flow-col auto-cols-[205px] sm:auto-cols-[235px] overflow-x-auto pb-2 snap-x'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {filteredTools.map((tool) => {
            const IconComp = tool.icon;
            const isSelected = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectTool(tool)}
                className={`snap-start group p-3.5 rounded-2xl bg-white border text-left transition-all duration-150 flex flex-col justify-between gap-2.5 cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'border-rose-500 ring-2 ring-rose-500/30 shadow-md shadow-rose-500/15 bg-rose-50/30'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${tool.accentBg}`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400 tabular-nums">
                        {String(tool.num).padStart(2, '0')}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-extrabold text-rose-600">
                          {t('निवडले', 'Active')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-rose-600 truncate">
                      {lang === 'en' ? tool.title : tool.titleMr}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-400 truncate">
                      {lang === 'en' ? tool.titleMr : tool.title}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                  {lang === 'en' ? tool.descriptionEn : tool.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Focused Tool Workspace (#maha-pdf-workspace) */}
      <section
        ref={workspaceRef}
        id="maha-pdf-workspace"
        className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xl space-y-5 scroll-mt-24"
      >
        {/* Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${selectedToolObj.accentBg}`}>
              {React.createElement(selectedToolObj.icon, { className: 'w-6 h-6' })}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                <span className="font-mono tabular-nums text-rose-600 font-bold">
                  {t(`टूल #${selectedToolObj.num}`, `Tool #${selectedToolObj.num}`)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedToolObj.title}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {lang === 'en' ? selectedToolObj.title : selectedToolObj.titleMr}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{t('सर्व २२ टूल्स', 'All 22 Tools')}</span>
            </button>
            {(selectedFile || imageFiles.length > 0) && (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('रीसेट', 'Reset')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Facility Detailed Information & What to Choose Panel */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-1.5">
            <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{t('या सुविधेविषयी माहिती:', 'About Selected Facility:')}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {lang === 'en' ? selectedToolGuide.summaryEn : selectedToolGuide.summaryMr}
            </p>
            <div className="pt-1.5 text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {t('मिळणारी फाईल:', 'Output:')}{' '}
                <span className="text-emerald-700">
                  {lang === 'en' ? selectedToolGuide.outputEn : selectedToolGuide.outputMr}
                </span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 lg:border-l lg:border-slate-200 lg:pl-5 space-y-1.5">
            <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{t('यामध्ये आपण काय निवडायचे / करायचे आहे:', 'What to Choose & Steps Inside This Tool:')}</span>
            </div>
            <ol className="space-y-1 text-xs text-slate-700">
              {(lang === 'en' ? selectedToolGuide.choicesEn : selectedToolGuide.choicesMr).map((step, i) => (
                <li key={i} className="flex items-start gap-2 leading-snug">
                  <span className="font-mono font-bold text-rose-600 tabular-nums shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* High-Visibility File Dropzone & Prominent Select CTA Button */}
        <input
          type="file"
          ref={fileInputRef}
          multiple={activeTool === 'jpg-to-pdf' || activeTool === 'merge'}
          onChange={handleFileChange}
          accept=".pdf,image/*,.doc,.docx,.txt"
          className="hidden"
        />

        {!selectedFile && imageFiles.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const dropped = Array.from(e.dataTransfer.files || []);
              if (dropped.length > 0) processSelectedFiles(dropped);
            }}
            className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-gradient-to-b from-rose-50/50 to-slate-50 rounded-3xl p-8 sm:p-10 text-center transition-all space-y-4"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-b from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-sm sm:text-base shadow-[0_8px_24px_-4px_rgba(225,29,72,0.55)] active:translate-y-0.5 transition-all cursor-pointer"
            >
              <FolderOpen className="w-5 h-5" />
              <span>
                {activeTool === 'jpg-to-pdf'
                  ? t('फोटो निवडा (Select JPG / PNG)', 'Select JPG / PNG Images')
                  : t('PDF / फाईल निवडा (Select PDF File)', 'Select PDF / File')}
              </span>
            </button>
            <p className="text-xs sm:text-sm font-medium text-slate-600">
              {t('किंवा तुमची फाईल थेट या बॉक्समध्ये ड्रॅग करून सोडा · १००% ब्राउझर-मध्ये सुरक्षित', 'Or drag and drop your file anywhere inside this box · 100% browser-private')}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  {selectedFile ? selectedFile.name : `${imageFiles.length} ${t('फोटो निवडले', 'Images Selected')}`}
                </div>
                <div className="text-xs text-emerald-800 font-semibold tabular-nums mt-0.5">
                  {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : ''}
                  {pageCount > 0 ? ` · ${t(`एकूण पाने: ${pageCount}`, `${pageCount} pages`)}` : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('फाईल बदला', 'Change File')}</span>
            </button>
          </div>
        )}

        {/* Tool-Specific Controls */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-5">
          {/* Tool 1: Compress PDF */}
          {activeTool === 'compress' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
                  <Sliders className="w-4 h-4 text-rose-600" />
                  {t('टार्गेट आकार निवडा (सरकारी भरती व पोर्टलसाठी):', 'Select Target Size (For Recruitment & Portals):')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[50, 100, 200, 300, 500].map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      onClick={() => setTargetKb(kb)}
                      className={`py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer tabular-nums active:scale-[0.98] ${
                        targetKb === kb
                          ? 'bg-gradient-to-b from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25'
                          : 'bg-white text-slate-800 border border-slate-300 hover:border-rose-400'
                      }`}
                    >
                      {t(`${kb} KB आत`, `Under ${kb} KB`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-700 mr-1">{t('कॉम्प्रेशन पद्धत:', 'Compression Mode:')}</span>
                <button
                  type="button"
                  onClick={() => setCompressionMode('strong')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    compressionMode === 'strong'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {t('स्ट्राँग (Target KB साठी सर्वोत्तम)', 'Strong Target-KB Compression')}
                </button>
                <button
                  type="button"
                  onClick={() => setCompressionMode('lossless')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    compressionMode === 'lossless'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {t('फास्ट लॉसलेस (मजकूर स्पष्ट)', 'Fast Lossless (Sharp Text)')}
                </button>
              </div>
            </div>
          )}

          {/* Tool 2: Merge PDF */}
          {activeTool === 'merge' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  {t('एकत्र जोडण्यासाठी अधिक PDF फाइल्स जोडा:', 'Attach additional PDF files to combine:')}
                </label>
                <button
                  type="button"
                  onClick={() => secondaryInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm"
                >
                  {t('+ अतिरिक्त PDF जोडा', '+ Add More PDFs')}
                </button>
                <input
                  type="file"
                  multiple
                  ref={secondaryInputRef}
                  onChange={async (e) => {
                    const picked = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (picked.length === 0) return;
                    const verified: File[] = [];
                    for (const f of picked) {
                      const buf = new Uint8Array(await f.arrayBuffer());
                      const check = inspectUploadedFileBytes(buf, f.name, f.type, 'pdf');
                      if (!check.valid) {
                        const msg = `${f.name}: ${formatUploadRejectReason(check.reason)}`;
                        setErrorMessage(msg);
                        setStatusMessage(msg);
                        return;
                      }
                      verified.push(f);
                    }
                    setErrorMessage('');
                    setSecondaryFiles((prev) => [...prev, ...verified]);
                  }}
                  accept=".pdf"
                  className="hidden"
                />
              </div>
              {secondaryFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {secondaryFiles.map((f, idx) => (
                    <span
                      key={`${f.name}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700"
                    >
                      <span>{idx + 2}. {f.name.slice(0, 26)}</span>
                      <button
                        type="button"
                        onClick={() => setSecondaryFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-600 font-black cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tool 3: Split PDF */}
          {activeTool === 'split' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {t(
                  `वेगळी करायची पाने किंवा रेंज (उदा. 1-2 किंवा 1,3${pageCount ? ` • एकूण पाने: ${pageCount}` : ''}):`,
                  `Pages or Range to Split (e.g., 1-2 or 1,3${pageCount ? ` • Total pages: ${pageCount}` : ''}):`
                )}
              </label>
              <input
                type="text"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
                placeholder="1-2"
                className="w-56 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900"
              />
            </div>
          )}

          {/* Tool 4: Edit PDF Studio */}
          {activeTool === 'edit-pdf' && (
            <PdfInteractiveEditor
              ref={pdfEditorRef}
              pdfBytes={pdfBytes}
              pageCount={pageCount}
              fileName={selectedFile?.name}
              onExportReady={(bytes, fname) => {
                void finalizeAndDownloadPdf(bytes, fname, pageCount || undefined);
              }}
              onStatusChange={setStatusMessage}
              t={t}
            />
          )}

          {/* Tool 7: JPG to PDF */}
          {activeTool === 'jpg-to-pdf' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  {t('PDF मध्ये समाविष्ट करायचे फोटो (JPG/PNG):', 'Images to compile into PDF (JPG/PNG):')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                  >
                    {t('+ फोटो जोडा', '+ Add Images')}
                  </button>
                  {imageFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setImageFiles([])}
                      className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                    >
                      {t('सर्व काढा', 'Clear')}
                    </button>
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={async (e) => {
                    const picked = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (picked.length === 0) return;
                    const verified: File[] = [];
                    for (const f of picked) {
                      const buf = new Uint8Array(await f.arrayBuffer());
                      const check = inspectUploadedFileBytes(buf, f.name, f.type, 'image');
                      if (!check.valid) {
                        const msg = `${f.name}: ${formatUploadRejectReason(check.reason)}`;
                        setErrorMessage(msg);
                        setStatusMessage(msg);
                        return;
                      }
                      verified.push(f);
                    }
                    setErrorMessage('');
                    setImageFiles((prev) => [...prev, ...verified]);
                    setStatusMessage(t(`${verified.length} वैध फोटो जोडले!`, `Added ${verified.length} verified image(s)!`));
                  }}
                  className="hidden"
                />
              </div>
              {imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {imageFiles.map((img, i) => (
                    <span
                      key={`${img.name}-${i}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700"
                    >
                      <span>{i + 1}. {img.name.slice(0, 22)}</span>
                      <button
                        type="button"
                        onClick={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-rose-600 font-black cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tool 8: Word to PDF */}
          {activeTool === 'word-to-pdf' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('दस्तऐवज शीर्षक:', 'Document Title:')}
                </label>
                <input
                  type="text"
                  value={wordDocTitle}
                  onChange={(e) => setWordDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('अर्ज किंवा दस्तऐवज मजकूर:', 'Application / Document Content:')}
                </label>
                <textarea
                  rows={5}
                  value={wordContent}
                  onChange={(e) => setWordContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Tool 9: Sign PDF */}
          {activeTool === 'sign-pdf' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t('स्वाक्षरी करणाऱ्याचे नाव:', 'Signer Name:')}
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t('दिनांक:', 'Date:')}
                  </label>
                  <input
                    type="text"
                    value={signatureDate}
                    onChange={(e) => setSignatureDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {t('खालील बॉक्समध्ये सही काढा:', 'Draw Signature Below:')}
                  </label>
                  <button
                    type="button"
                    onClick={clearSignatureCanvas}
                    className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    {t('पुसा (Clear)', 'Clear')}
                  </button>
                </div>
                <canvas
                  ref={sigCanvasRef}
                  width={340}
                  height={120}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="w-full sm:w-96 h-32 bg-white border-2 border-slate-300 rounded-2xl cursor-crosshair touch-none shadow-inner"
                />
              </div>
            </div>
          )}

          {/* Tool 10: Watermark */}
          {activeTool === 'watermark-pdf' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('वॉटरमार्क मजकूर:', 'Watermark Text:')}
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 tabular-nums">
                  {t(`पारदर्शकता (Opacity: ${watermarkOpacity})`, `Opacity (${watermarkOpacity})`)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Tool 11: Rotate PDF */}
          {activeTool === 'rotate-pdf' && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700">{t('फिरवण्याचा कोन:', 'Rotation Angle:')}</span>
              {[90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setRotateAngle(deg)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                    rotateAngle === deg
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {t(`${deg}° घड्याळाच्या दिशेने`, `${deg}° Clockwise`)}
                </button>
              ))}
            </div>
          )}

          {/* Tool 12: N-Up Pages per sheet */}
          {activeTool === 'nup-pdf' && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700">{t('एका A4 शीटवर पाने:', 'Pages Per A4 Sheet:')}</span>
              {[2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNupCount(n as 2 | 4)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                    nupCount === n
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {t(`${n} पाने प्रति शीट (${n}-Up)`, `${n} Pages / Sheet (${n}-Up)`)}
                </button>
              ))}
            </div>
          )}

          {/* Tool 13: Delete Pages */}
          {activeTool === 'delete-pages' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('डिलीट करायचे पान क्रमांक (उदा. 1 किंवा 2,4):', 'Pages to Delete (e.g., 1 or 2,4):')}
              </label>
              <input
                type="text"
                value={pagesToDelete}
                onChange={(e) => setPagesToDelete(e.target.value)}
                placeholder="1"
                className="w-44 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
              />
            </div>
          )}

          {/* Tool 14: Extract Pages */}
          {activeTool === 'extract-pages' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('वेगळी काढायची पाने (उदा. 1 किंवा 1-2):', 'Pages to Extract (e.g., 1 or 1-2):')}
              </label>
              <input
                type="text"
                value={pagesToExtract}
                onChange={(e) => setPagesToExtract(e.target.value)}
                placeholder="1"
                className="w-44 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
              />
            </div>
          )}

          {/* Tool 15: Organize PDF */}
          {activeTool === 'organize-pdf' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('पानांचा नवीन क्रम (reverse किंवा उदा. 2,1,3):', 'New Page Order ("reverse" or e.g., 2,1,3):')}
              </label>
              <input
                type="text"
                value={organizeOrder}
                onChange={(e) => setOrganizeOrder(e.target.value)}
                placeholder="reverse"
                className="w-56 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
              />
            </div>
          )}

          {/* Tool 16: Page Number */}
          {activeTool === 'page-number' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">{t('नंबर स्वरूप:', 'Number Format:')}</label>
                <select
                  value={pageNumberFormat}
                  onChange={(e) => setPageNumberFormat(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                >
                  <option value="marathi">Page 1 of N</option>
                  <option value="num">- 1 -</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">{t('जागा:', 'Position:')}</label>
                <select
                  value={pageNumberPos}
                  onChange={(e) => setPageNumberPos(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold"
                >
                  <option value="bottom-center">{t('तळाशी मध्यभागी (Bottom Center)', 'Bottom Center')}</option>
                  <option value="bottom-right">{t('तळाशी उजवीकडे (Bottom Right)', 'Bottom Right')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Tool 17: OCR Extracted Text Preview */}
          {activeTool === 'ocr-pdf' && extractedOcrText && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{t('काढलेला मजकूर:', 'Extracted Text:')}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(appendPortalLink(extractedOcrText, lang));
                    setStatusMessage(t('मजकूर व पोर्टल लिंक कॉपी केली! ✓', 'Copied text with portal link! ✓'));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('कॉपी करा', 'Copy')}</span>
                </button>
              </div>
              <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
                {extractedOcrText}
              </pre>
            </div>
          )}

          {/* Tool 20 & 21: Protect / Unlock */}
          {(activeTool === 'protect-pdf' || activeTool === 'unlock-pdf') && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {activeTool === 'protect-pdf'
                  ? t('PDF लॉक करण्यासाठी पासवर्ड टाका:', 'Enter Password to Lock PDF:')
                  : t('पासवर्ड (PDF लॉक असल्यास):', 'Password (if PDF is locked):')}
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={t('पासवर्ड टाका (उदा. 123456)', 'Enter password')}
                className="w-56 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
              />
            </div>
          )}

          {/* Info Note for Single-Click Conversion Tools */}
          {(activeTool === 'pdf-to-word' ||
            activeTool === 'pdf-to-jpg' ||
            activeTool === 'pdf-to-excel' ||
            activeTool === 'pdf-to-ppt' ||
            activeTool === 'grayscale-pdf') && (
            <p className="text-xs text-slate-600 font-medium">
              {t(
                'फाईल्स तुमच्याच ब्राउझरमध्ये प्रक्रिया केल्या जातील. खालील मुख्य बटण दाबून थेट डाउनलोड करा.',
                'Processed directly inside your browser. Click the main button below to generate & download.'
              )}
            </p>
          )}

          {/* Inline Password Prompt for Encrypted PDFs */}
          {pendingLockedPdf && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  {t(
                    `"${pendingLockedPdf.file.name}" पासवर्डने लॉक आहे — उघडण्यासाठी पासवर्ड टाका:`,
                    `"${pendingLockedPdf.file.name}" is password-protected — enter password to unlock:`
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={unlockPasswordInput}
                  onChange={(e) => setUnlockPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleUnlockPendingPdf();
                  }}
                  placeholder={t('PDF पासवर्ड (उदा. जन्मतारीख / पिन)', 'Enter PDF password')}
                  className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-900"
                />
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void handleUnlockPendingPdf()}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer disabled:opacity-50"
                >
                  {t('अनलॉक व लोड करा', 'Unlock & Load')}
                </button>
              </div>
            </div>
          )}

          {/* Inline Error Alert Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 flex items-start gap-2.5 text-xs font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Processing Progress Indicator */}
          {isProcessing && progressPct > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 tabular-nums">
                <span>{t('दस्तऐवज प्रक्रिया व पडताळणी सुरू आहे...', 'Processing & validating document...')}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                />
              </div>
            </div>
          )}

          {/* Primary Glossy Process & Download Action Bar */}
          <div className="pt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleExecuteActiveTool}
              className={`w-full sm:w-auto min-h-[54px] px-7 py-3.5 rounded-2xl text-white font-black text-sm sm:text-base active:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 text-center leading-snug ${
                needsPdfUploadNow || needsImagesUploadNow
                  ? 'bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                  : 'bg-gradient-to-b from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-[0_10px_25px_-5px_rgba(225,29,72,0.55)]'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
                  <span>{t('फाईल तयार होत आहे...', 'Generating File...')}</span>
                </>
              ) : needsPdfUploadNow ? (
                <>
                  <FolderOpen className="w-5 h-5 shrink-0" />
                  <span>{t('आधी PDF फाईल निवडा (Select PDF)', 'Select PDF File First')}</span>
                </>
              ) : needsImagesUploadNow ? (
                <>
                  <FolderOpen className="w-5 h-5 shrink-0" />
                  <span>{t('आधी JPG / PNG फोटो निवडा', 'Select JPG / PNG Images First')}</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 shrink-0" />
                  <span>
                    {lang === 'en'
                      ? `${selectedToolObj.title} & Download`
                      : `${selectedToolObj.titleMr} • तयार करा व डाउनलोड करा`}
                  </span>
                </>
              )}
            </button>

            <span className="text-xs text-slate-600 font-semibold leading-relaxed">{displayStatus}</span>
          </div>

          {/* Dedicated Persistent Download Ready Output Box */}
          {generatedFiles.length > 0 && (
            <div
              ref={downloadBoxRef}
              className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm sm:text-base font-black text-emerald-950">
                    {t('तुमची फाईल डाउनलोडसाठी तयार आहे!', 'Your File is Ready to Download!')}
                  </h4>
                  <p className="text-xs font-medium text-emerald-800 mt-0.5">
                    {t(
                      'ऑटोमॅटिक डाउनलोड सुरू न झाल्यास खालील हिरव्या "डाउनलोड करा" बटणावर क्लिक करा:',
                      'Click the green Download button below anytime to save your file:'
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {generatedFiles.map((item, idx) => (
                  <div
                    key={`${item.filename}-${idx}`}
                    className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        {item.isPdf ? <FileText className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 break-all">
                          {item.filename}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 tabular-nums">
                          {item.sizeKb} KB · {item.isPdf ? 'PDF' : item.filename.split('.').pop()?.toUpperCase()}
                        </div>
                        {item.validation && (
                          <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                            {t(
                              `✓ तपासणी पूर्ण · ${item.validation.pageCount} पाने · PDF ${item.validation.pdfVersion} · ${item.validation.classicXref ? 'Classic XRef' : 'Standard'}${item.validation.renderVerified ? ' · Render OK' : ''}`,
                              `✓ Validated · ${item.validation.pageCount} page(s) · PDF ${item.validation.pdfVersion} · ${item.validation.classicXref ? 'Classic XRef' : 'Standard'}${item.validation.renderVerified ? ' · Render OK' : ''}`
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={item.url}
                        download={item.filename}
                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs sm:text-sm shadow-[0_6px_18px_-4px_rgba(16,185,129,0.5)] active:translate-y-0.5 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        <span>{t('डाउनलोड करा', 'Download')}</span>
                      </a>

                      {item.isPdf && (
                        <>
                          <button
                            type="button"
                            onClick={() => previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-rose-600" />
                            <span>{t('प्रिव्ह्यू पहा', 'Preview')}</span>
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                            <span>{t('नवीन टॅब', 'New Tab')}</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Document Preview Frame (PDF only) */}
        {previewBlobUrl && (
          <div ref={previewSectionRef} className="space-y-2 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-rose-600" />
                {t('दस्तऐवज थेट प्रिव्ह्यू (Live PDF Preview):', 'Live PDF Preview:')}
              </span>
              <a
                href={previewBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-extrabold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t('नवीन टॅबमध्ये उघडा', 'Open in New Tab')}</span>
              </a>
            </div>
            <div className="w-full h-96 rounded-2xl border border-slate-300 overflow-hidden bg-slate-100 shadow-inner">
              <iframe src={`${previewBlobUrl}#toolbar=0`} title="PDF Preview" className="w-full h-full border-0" />
            </div>
          </div>
        )}
      </section>

      {/* Maha Corner Tool Features Strip (Clean 3-Column Trust Row) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              {t('भरती व सरकारी पोर्टल रेडी', 'Exam & Portal Ready')}
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t(
                'पोलीस भरती, तलाठी, MPSC आणि महा-डीबीटी पोर्टलसाठी अचूक KB मध्ये PDF व फोटो आकार तयार.',
                'Prepare documents in exact KB limits needed for recruitment & government portals.'
              )}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              {t('१००% खाजगी व अमर्यादित मोफत', '100% Private & Unlimited')}
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t(
                'लॉगिनची गरज नाही आणि सर्व फाईल्स तुमच्याच डिव्हाइसवर प्रोसेस होतात.',
                'Zero sign-up required. Every PDF tool executes securely right inside your browser.'
              )}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              {t('महा-ई-सेवा व नागरिकांसाठी खास', 'Built for CSC & Citizens')}
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t(
                'N-Up प्रिंटिंग, थेट मजकूर संपादन आणि युनिकोड मराठी सपोर्टसह संपूर्ण स्टुडिओ.',
                'Complete suite with N-Up print sheets, inline PDF editing, and Unicode Marathi fonts.'
              )}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

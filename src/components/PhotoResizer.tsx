import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Download,
  Upload,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  FileText,
  Printer,
  Share2,
  Type,
  SunMedium,
  Check,
  RefreshCw,
  FileImage,
  Smartphone,
  Eye,
  Info,
  Calendar,
  Layers,
  Sparkle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink } from '../utils/shareConfig';
import { dataUrlToBlob, saveValidatedJsPdf } from '../utils/pdfCompat';
import { inspectUploadedFileBytes, PDF_SECURITY_LIMITS, releaseCanvasMemory } from '../utils/pdfSecurity';

type UnitType = 'px' | 'cm' | 'mm' | 'inch';
type CategoryType = 'all' | 'maha' | 'central' | 'bank' | 'passport';

interface ResizerPreset {
  id: string;
  category: 'maha' | 'central' | 'bank' | 'passport';
  name: string;
  nameEn: string;
  unit: UnitType;
  w: number;
  h: number;
  dpi: number;
  targetKb: number;
  badge: string;
  badgeEn: string;
  description: string;
  descriptionEn: string;
  isSignature?: boolean;
}

const OFFICIAL_PRESETS: ResizerPreset[] = [
  // Maharashtra State
  {
    id: 'mpsc-photo',
    category: 'maha',
    name: '📸 MPSC / तलाठी / वनविभाग फोटो',
    nameEn: '📸 MPSC / Talathi / Forest Exam Photo',
    unit: 'cm',
    w: 3.5,
    h: 4.5,
    dpi: 300,
    targetKb: 50,
    badge: 'महाराष्ट्र शासन',
    badgeEn: 'Maharashtra Govt',
    description: '३.५ × ४.५ cm • २० ते ५० KB • ३०० DPI',
    descriptionEn: '3.5 × 4.5 cm • 20 to 50 KB • 300 DPI',
  },
  {
    id: 'police-photo',
    category: 'maha',
    name: '👮 महाराष्ट्र पोलीस भरती फोटो',
    nameEn: '👮 Maharashtra Police Bharti Photo',
    unit: 'cm',
    w: 3.5,
    h: 4.5,
    dpi: 300,
    targetKb: 45,
    badge: 'पोलीस भरती',
    badgeEn: 'Police Recruitment',
    description: '३.५ × ४.५ cm • १५ ते ५० KB',
    descriptionEn: '3.5 × 4.5 cm • 15 to 50 KB',
  },
  {
    id: 'maha-sign',
    category: 'maha',
    name: '✍️ उमेदवार स्वाक्षरी (Signature - MPSC/पोलीस)',
    nameEn: '✍️ Candidate Signature (MPSC / Police)',
    unit: 'cm',
    w: 3.5,
    h: 1.5,
    dpi: 300,
    targetKb: 20,
    badge: 'स्वाक्षरी',
    badgeEn: 'Signature',
    description: '३.५ × १.५ cm • १० ते २० KB',
    descriptionEn: '3.5 × 1.5 cm • 10 to 20 KB',
    isSignature: true,
  },
  {
    id: 'mahadbt',
    category: 'maha',
    name: '🎓 MahaDBT / स्कॉलरशिप फोटो',
    nameEn: '🎓 MahaDBT / Scholarship Photo',
    unit: 'px',
    w: 160,
    h: 200,
    dpi: 200,
    targetKb: 90,
    badge: 'MahaDBT',
    badgeEn: 'MahaDBT',
    description: '१६० × २०० px • ५० ते १०० KB',
    descriptionEn: '160 × 200 px • 50 to 100 KB',
  },

  // Central Exams (SSC / UPSC / NTA)
  {
    id: 'ssc-photo',
    category: 'central',
    name: '🏛️ SSC (CGL, CHSL, MTS, GD) फोटो',
    nameEn: '🏛️ SSC (CGL, CHSL, MTS, GD) Photo',
    unit: 'cm',
    w: 3.5,
    h: 4.5,
    dpi: 300,
    targetKb: 50,
    badge: 'SSC केंद्र',
    badgeEn: 'SSC Central',
    description: '३.५ × ४.५ cm • २० ते ५० KB',
    descriptionEn: '3.5 × 4.5 cm • 20 to 50 KB',
  },
  {
    id: 'ssc-sign',
    category: 'central',
    name: '✍️ SSC स्वाक्षरी (Signature)',
    nameEn: '✍️ SSC Signature',
    unit: 'cm',
    w: 4.0,
    h: 2.0,
    dpi: 300,
    targetKb: 20,
    badge: 'SSC स्वाक्षरी',
    badgeEn: 'SSC Sign',
    description: '४.० × २.० cm • १० ते २० KB',
    descriptionEn: '4.0 × 2.0 cm • 10 to 20 KB',
    isSignature: true,
  },
  {
    id: 'upsc-photo',
    category: 'central',
    name: '🇮🇳 UPSC नागरी सेवा (Civil Services)',
    nameEn: '🇮🇳 UPSC Civil Services Photo',
    unit: 'px',
    w: 350,
    h: 350,
    dpi: 300,
    targetKb: 200,
    badge: 'UPSC',
    badgeEn: 'UPSC',
    description: '३५० × ३५० px • २० ते ३०० KB',
    descriptionEn: '350 × 350 px • 20 to 300 KB',
  },
  {
    id: 'neet-photo',
    category: 'central',
    name: '🩺 NEET / JEE / NTA (नाव व तारखेसह)',
    nameEn: '🩺 NEET / JEE / NTA (With Name & Date)',
    unit: 'cm',
    w: 3.5,
    h: 4.5,
    dpi: 300,
    targetKb: 150,
    badge: 'NTA Exam',
    badgeEn: 'NTA Exam',
    description: '३.५ × ४.५ cm • १० ते २०० KB',
    descriptionEn: '3.5 × 4.5 cm • 10 to 200 KB',
  },

  // Banking (IBPS / SBI)
  {
    id: 'ibps-photo',
    category: 'bank',
    name: '🏦 IBPS / SBI बँक भरती फोटो',
    nameEn: '🏦 IBPS / SBI Bank Exam Photo',
    unit: 'px',
    w: 200,
    h: 230,
    dpi: 200,
    targetKb: 50,
    badge: 'IBPS / SBI',
    badgeEn: 'IBPS / SBI',
    description: '२०० × २३० px • २० ते ५० KB',
    descriptionEn: '200 × 230 px • 20 to 50 KB',
  },
  {
    id: 'ibps-sign',
    category: 'bank',
    name: '✍️ IBPS बँक स्वाक्षरी (Signature)',
    nameEn: '✍️ IBPS Bank Signature',
    unit: 'px',
    w: 140,
    h: 60,
    dpi: 200,
    targetKb: 20,
    badge: 'बँक स्वाक्षरी',
    badgeEn: 'Bank Sign',
    description: '१४० × ६० px • १० ते २० KB',
    descriptionEn: '140 × 60 px • 10 to 20 KB',
    isSignature: true,
  },

  // Passport & Official Cards
  {
    id: 'indian-passport',
    category: 'passport',
    name: '🛂 भारतीय पासपोर्ट (Indian Passport / Visa)',
    nameEn: '🛂 Indian Passport / Visa Photo',
    unit: 'cm',
    w: 3.5,
    h: 4.5,
    dpi: 300,
    targetKb: 100,
    badge: 'पासपोर्ट',
    badgeEn: 'Passport',
    description: '३.५ × ४.५ cm • ३०० DPI • पांढरा बॅकग्राउंड',
    descriptionEn: '3.5 × 4.5 cm • 300 DPI • White Background',
  },
  {
    id: 'us-visa',
    category: 'passport',
    name: '🇺🇸 US / विदेशी व्हिसा (2 × 2 इंच)',
    nameEn: '🇺🇸 US / Foreign Visa (2 × 2 inch)',
    unit: 'inch',
    w: 2.0,
    h: 2.0,
    dpi: 300,
    targetKb: 240,
    badge: 'व्हिसा 2x2"',
    badgeEn: 'Visa 2x2"',
    description: '२ × २ इंच (६०० × ६०० px) • ३०० DPI',
    descriptionEn: '2 × 2 inch (600 × 600 px) • 300 DPI',
  },
  {
    id: 'pan-photo',
    category: 'passport',
    name: '🪪 पॅन कार्ड फोटो (NSDL / UTI)',
    nameEn: '🪪 PAN Card Photo (NSDL / UTI)',
    unit: 'px',
    w: 213,
    h: 213,
    dpi: 300,
    targetKb: 30,
    badge: 'NSDL / UTI',
    badgeEn: 'NSDL / UTI',
    description: '२१३ × २१३ px • ३० KB च्या आत • ३०० DPI',
    descriptionEn: '213 × 213 px • Under 30 KB • 300 DPI',
  },
  {
    id: 'pan-sign',
    category: 'passport',
    name: '✍️ पॅन कार्ड स्वाक्षरी (NSDL / UTI)',
    nameEn: '✍️ PAN Card Signature (NSDL / UTI)',
    unit: 'px',
    w: 400,
    h: 200,
    dpi: 300,
    targetKb: 30,
    badge: 'पॅन स्वाक्षरी',
    badgeEn: 'PAN Sign',
    description: '४०० × २०० px • ३० KB च्या आत • ३०० DPI',
    descriptionEn: '400 × 200 px • Under 30 KB • 300 DPI',
    isSignature: true,
  },
];

export const PhotoResizer: React.FC = () => {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Original image state
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [originalSizeKb, setOriginalSizeKb] = useState<number>(0);

  // Active Category filter for presets
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('mpsc-photo');

  // Dimension settings
  const [unit, setUnit] = useState<UnitType>('cm');
  const [widthVal, setWidthVal] = useState<number>(3.5);
  const [heightVal, setHeightVal] = useState<number>(4.5);
  const [dpi, setDpi] = useState<number>(300);
  const [lockAspect, setLockAspect] = useState<boolean>(false);

  // Target KB Compression
  const [useTargetKb, setUseTargetKb] = useState<boolean>(true);
  const [targetKb, setTargetKb] = useState<number>(50);
  const [manualQuality, setManualQuality] = useState<number>(0.85);

  // Transform / Editing tools
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(false);
  const [whitenSignature, setWhitenSignature] = useState<boolean>(false);

  // Name & Date on Photo (DOP)
  const [enableNameDate, setEnableNameDate] = useState<boolean>(false);
  const [candidateName, setCandidateName] = useState<string>('SACHIN T. PATIL');
  const [photoDate, setPhotoDate] = useState<string>(new Date().toLocaleDateString('en-GB'));

  // Output
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png' | 'webp' | 'pdf'>('jpg');
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultSizeKb, setResultSizeKb] = useState<number>(0);
  const [calcPx, setCalcPx] = useState<{ w: number; h: number }>({ w: 413, h: 531 });
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Convert unit values to pixels
  const convertToPixels = useCallback(
    (w: number, h: number, u: UnitType, currentDpi: number): { w: number; h: number } => {
      if (u === 'px') {
        return { w: Math.max(10, Math.round(w)), h: Math.max(10, Math.round(h)) };
      }
      if (u === 'cm') {
        return {
          w: Math.max(10, Math.round((w / 2.54) * currentDpi)),
          h: Math.max(10, Math.round((h / 2.54) * currentDpi)),
        };
      }
      if (u === 'mm') {
        return {
          w: Math.max(10, Math.round((w / 25.4) * currentDpi)),
          h: Math.max(10, Math.round((h / 25.4) * currentDpi)),
        };
      }
      if (u === 'inch') {
        return {
          w: Math.max(10, Math.round(w * currentDpi)),
          h: Math.max(10, Math.round(h * currentDpi)),
        };
      }
      return { w: 200, h: 230 };
    },
    []
  );

  // Convert pixels back to current unit
  const convertFromPixels = useCallback(
    (wPx: number, hPx: number, targetUnit: UnitType, currentDpi: number): { w: number; h: number } => {
      if (targetUnit === 'px') return { w: wPx, h: hPx };
      if (targetUnit === 'cm') {
        return {
          w: Math.round(((wPx * 2.54) / currentDpi) * 10) / 10,
          h: Math.round(((hPx * 2.54) / currentDpi) * 10) / 10,
        };
      }
      if (targetUnit === 'mm') {
        return {
          w: Math.round(((wPx * 25.4) / currentDpi) * 10) / 10,
          h: Math.round(((hPx * 25.4) / currentDpi) * 10) / 10,
        };
      }
      if (targetUnit === 'inch') {
        return {
          w: Math.round((wPx / currentDpi) * 100) / 100,
          h: Math.round((hPx / currentDpi) * 100) / 100,
        };
      }
      return { w: wPx, h: hPx };
    },
    []
  );

  // Update calculated pixels when inputs change
  useEffect(() => {
    const px = convertToPixels(widthVal, heightVal, unit, dpi);
    setCalcPx(px);
  }, [widthVal, heightVal, unit, dpi, convertToPixels]);

  // Handle File Upload
  const handleUpload = async (file: File) => {
    if (!file) return;
    try {
      if (file.size > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
        setStatusMessage(t('इमेज फाईल २० MB पेक्षा मोठी नसावी.', 'Image file must be under 20 MB.'));
        return;
      }
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'image');
      if (!inspection.valid || inspection.kind !== 'image') {
        setStatusMessage(t('कृपया वैध इमेज फाइल (JPG/PNG/WEBP) निवडा.', 'Please select a valid raster image file (JPG/PNG/WEBP).'));
        return;
      }
    } catch {
      setStatusMessage(t('इमेज तपासताना त्रुटी आली.', 'Could not verify image file.'));
      return;
    }

    setOriginalFile(file);
    setOriginalSizeKb(Math.round(file.size / 1024));
    setStatusMessage(t('फोटो लोड होत आहे...', 'Loading image...'));

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        setOriginalImage(img);
        setStatusMessage(t('फोटो लोड झाला! आवश्यक बदल करून डाउनलोड करा ✓', 'Photo loaded! Adjust settings and download ✓'));
      };
    };
    reader.readAsDataURL(file);
  };

  // Binary search compression algorithm to hit exact target KB
  const compressToTargetKb = async (
    sourceCanvas: HTMLCanvasElement,
    maxKb: number,
    mimeType: string
  ): Promise<{ dataUrl: string; sizeKb: number }> => {
    // PNG doesn't use lossy quality parameter
    if (mimeType === 'image/png') {
      const dataUrl = sourceCanvas.toDataURL('image/png');
      const sizeKb = Math.round(((dataUrl.length - 22) * 3) / 4 / 1024);
      return { dataUrl, sizeKb };
    }

    // If manual quality mode is preferred
    if (!useTargetKb) {
      const dataUrl = sourceCanvas.toDataURL(mimeType, manualQuality);
      const sizeKb = Math.round(((dataUrl.length - 22) * 3) / 4 / 1024);
      return { dataUrl, sizeKb };
    }

    let minQ = 0.05;
    let maxQ = 0.98;
    let bestUrl = sourceCanvas.toDataURL(mimeType, 0.85);
    let bestKb = Math.round(((bestUrl.length - 22) * 3) / 4 / 1024);

    for (let i = 0; i < 7; i++) {
      const midQ = (minQ + maxQ) / 2;
      const testUrl = sourceCanvas.toDataURL(mimeType, midQ);
      const curKb = Math.round(((testUrl.length - 22) * 3) / 4 / 1024);

      if (curKb <= maxKb) {
        bestUrl = testUrl;
        bestKb = curKb;
        minQ = midQ;
      } else {
        maxQ = midQ;
      }
    }

    // Fallback if dimensions are huge and lowest quality is still over target
    if (bestKb > maxKb && sourceCanvas.width > 250) {
      const scale = Math.sqrt(maxKb / bestKb) * 0.96;
      const scaledCv = document.createElement('canvas');
      scaledCv.width = Math.max(60, Math.round(sourceCanvas.width * scale));
      scaledCv.height = Math.max(60, Math.round(sourceCanvas.height * scale));
      const sCtx = scaledCv.getContext('2d');
      if (sCtx) {
        sCtx.drawImage(sourceCanvas, 0, 0, scaledCv.width, scaledCv.height);
        const scaledUrl = scaledCv.toDataURL(mimeType, 0.82);
        const scaledKb = Math.round(((scaledUrl.length - 22) * 3) / 4 / 1024);
        return { dataUrl: scaledUrl, sizeKb: scaledKb };
      }
    }

    return { dataUrl: bestUrl, sizeKb: bestKb };
  };

  // Whiten Signature Algorithm: cleans up grey scanned papers
  const applySignatureWhiten = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > 165) {
        // Force background white
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        // Darken ink
        const factor = Math.max(0, (lum / 165) * 0.65);
        data[i] = Math.round(r * factor);
        data[i + 1] = Math.round(g * factor);
        data[i + 2] = Math.round(b * factor);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Draw Name & Date of Photo (DOP) Strip at bottom
  const applyNameDateStrip = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!candidateName && !photoDate) return;
    const stripH = Math.max(28, Math.round(h * 0.19));
    const startY = h - stripH;

    // White box at bottom
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, startY, w, stripH);

    // Black divider line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(w, startY);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    if (candidateName && photoDate) {
      const f1 = Math.max(10, Math.round(stripH * 0.36));
      ctx.font = `900 ${f1}px sans-serif`;
      ctx.fillText(candidateName.toUpperCase(), w / 2, startY + stripH * 0.42);

      const f2 = Math.max(9, Math.round(f1 * 0.9));
      ctx.font = `700 ${f2}px sans-serif`;
      ctx.fillText(`DOP: ${photoDate}`, w / 2, startY + stripH * 0.84);
    } else if (candidateName) {
      const f1 = Math.max(11, Math.round(stripH * 0.45));
      ctx.font = `900 ${f1}px sans-serif`;
      ctx.fillText(candidateName.toUpperCase(), w / 2, startY + stripH * 0.62);
    } else if (photoDate) {
      const f1 = Math.max(11, Math.round(stripH * 0.45));
      ctx.font = `700 ${f1}px sans-serif`;
      ctx.fillText(`DOP: ${photoDate}`, w / 2, startY + stripH * 0.62);
    }
  };

  // Main Processing Function
  const processImage = useCallback(async () => {
    if (!originalImage) return;

    const { w: targetW, h: targetH } = convertToPixels(widthVal, heightVal, unit, dpi);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    ctx.save();

    // Move to center for transformations
    ctx.translate(targetW / 2, targetH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Calculate scale to fill or fit
    const isSideways = rotation === 90 || rotation === 270;
    const origW = isSideways ? originalImage.height : originalImage.width;
    const origH = isSideways ? originalImage.width : originalImage.height;

    // Cover fill scale
    const scale = Math.max(targetW / origW, targetH / origH);
    const drawW = originalImage.width * scale;
    const drawH = originalImage.height * scale;

    ctx.drawImage(originalImage, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Whiten signature if enabled
    if (whitenSignature) {
      applySignatureWhiten(ctx, targetW, targetH);
    }

    // Name & Date on photo strip if enabled
    if (enableNameDate) {
      applyNameDateStrip(ctx, targetW, targetH);
    }

    // Compress to target KB
    const mime =
      outputFormat === 'png'
        ? 'image/png'
        : outputFormat === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    const { dataUrl, sizeKb } = await compressToTargetKb(canvas, targetKb, mime);
    setResultDataUrl(dataUrl);
    setResultSizeKb(sizeKb);
  }, [
    originalImage,
    widthVal,
    heightVal,
    unit,
    dpi,
    convertToPixels,
    rotation,
    flipH,
    flipV,
    whitenSignature,
    enableNameDate,
    candidateName,
    photoDate,
    outputFormat,
    useTargetKb,
    targetKb,
    manualQuality,
  ]);

  // Trigger processImage on setting changes
  useEffect(() => {
    processImage();
  }, [processImage]);

  // Apply a preset
  const handleApplyPreset = (preset: ResizerPreset) => {
    setSelectedPresetId(preset.id);
    setUnit(preset.unit);
    setWidthVal(preset.w);
    setHeightVal(preset.h);
    setDpi(preset.dpi);
    setTargetKb(preset.targetKb);
    setUseTargetKb(true);

    if (preset.isSignature) {
      setWhitenSignature(true);
      setEnableNameDate(false);
    } else {
      setWhitenSignature(false);
    }

    setStatusMessage(`${lang === 'en' ? preset.nameEn : preset.name} ${t('लागू केला! ✓', 'applied! ✓')}`);
  };

  // Download Single Resized Photo
  const handleDownloadSingle = async (format: 'jpg' | 'png' | 'webp' | 'pdf' = outputFormat) => {
    if (!resultDataUrl) return;

    const safeName = originalFile
      ? originalFile.name.replace(/\.[^/.]+$/, '').slice(0, 15)
      : 'photo';
    const ext = format === 'jpg' ? 'jpg' : format;

    if (format === 'pdf') {
      const { w: pW, h: pH } = convertToPixels(widthVal, heightVal, unit, dpi);
      const safeDpi = Math.max(72, dpi || 300);
      let mmW = (pW / safeDpi) * 25.4;
      let mmH = (pH / safeDpi) * 25.4;
      // Ensure reasonable PDF page dimensions for WPS Office & printers (at least 25mm, max 297mm)
      const maxMm = Math.max(mmW, mmH);
      if (maxMm > 297) {
        const s = 297 / maxMm;
        mmW *= s;
        mmH *= s;
      } else if (Math.min(mmW, mmH) < 20) {
        const s = 25 / Math.max(1, Math.min(mmW, mmH));
        mmW *= s;
        mmH *= s;
      }

      let jpegDataUrl = resultDataUrl;
      if (!resultDataUrl.startsWith('data:image/jpeg')) {
        jpegDataUrl = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || pW;
            c.height = img.naturalHeight || pH;
            try {
              const ctx = c.getContext('2d');
              if (!ctx) return resolve(resultDataUrl);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.drawImage(img, 0, 0, c.width, c.height);
              resolve(c.toDataURL('image/jpeg', 0.94));
            } finally {
              releaseCanvasMemory(c);
            }
          };
          img.onerror = reject;
          img.src = resultDataUrl;
        });
      }

      try {
        const doc = new jsPDF({
          orientation: mmW > mmH ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [mmW, mmH],
          compress: true,
        });
        doc.addImage(jpegDataUrl, 'JPEG', 0, 0, mmW, mmH);
        await saveValidatedJsPdf(doc, `maha-corner-${safeName}-${calcPx.w}x${calcPx.h}.pdf`, 1);
      } catch (err) {
        console.error('Validated PDF export failed:', err);
        setStatusMessage(
          t(
            'PDF पडताळणी दरम्यान त्रुटी आली. कृपया पुन्हा प्रयत्न करा.',
            'PDF validation failed during export. Please try again.'
          )
        );
        return;
      }
    } else {
      const link = document.createElement('a');
      link.href = resultDataUrl;
      link.download = `maha-corner-${safeName}-${calcPx.w}x${calcPx.h}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    confetti({ particleCount: 40, spread: 60 });
    trackFeatureAction('photo-resizer');
    setStatusMessage(
      t(`${format.toUpperCase()} फाइल यशस्वीरित्या डाउनलोड झाली! ✓`, `${format.toUpperCase()} file downloaded successfully! ✓`)
    );
  };

  // Direct WhatsApp / Web Share
  const handleShare = async () => {
    if (!resultDataUrl) return;
    try {
      const blob = dataUrlToBlob(resultDataUrl);
      const file = new File([blob], `photo-${calcPx.w}x${calcPx.h}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: t('महा कॉर्नर - रिसाइझ केलेला फोटो', 'MAHA CORNER - Resized Photo'),
          text: appendPortalLink(
            `📸 ${t('रिसाइझ केलेला फोटो', 'Resized photo')} (${calcPx.w}×${calcPx.h} px • ${resultSizeKb} KB)`,
            lang
          ),
          files: [file],
        });
        trackFeatureAction('photo-resizer');
        setStatusMessage(t('फोटो यशस्वीरित्या शेअर केला! ✓', 'Photo shared successfully! ✓'));
      } else {
        handleDownloadSingle('jpg');
      }
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  // Direct Print Dialog via hidden iframe
  const handleDirectPrint = () => {
    if (!resultDataUrl) return;
    trackFeatureAction('photo-resizer');
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
      return;
    }

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${t('फोटो प्रिंट', 'Print Photo')}</title>
          <style>
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
            img { max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>
          <img src="${resultDataUrl}" />
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
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      }
    }, 150);
  };

  const filteredPresets =
    activeCategory === 'all'
      ? OFFICIAL_PRESETS
      : OFFICIAL_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-violet-500/20">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('महा कॉर्नर • प्रगत स्टुडिओ व भरती फोटो रिसायझर', 'MAHA CORNER • Studio & Exam Photo Resizer')}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black">
            {t('🖼️ प्रगत फोटो व स्वाक्षरी रिसायझर', '🖼️ Pro Photo & Signature Resizer')}
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            {t(
              'सरकारी भरती, स्पर्धा परीक्षा, पासपोर्ट, पॅन व बँक अर्जांसाठी उमेदवाराचा फोटो व स्वाक्षरी अचूक पिक्सेल, cm, mm, इंच आणि नक्की KB साईजमध्ये (उदा. २० ते ५० KB) एका क्लिकवर रिसाइझ व कॉम्प्रेस करा.',
              'Resize & compress candidate photos and signatures to exact pixels, cm, mm, inches, and target KB sizes (e.g., 20–50 KB) for Govt exams, PAN, Passport, and Banking portals.'
            )}
          </p>
        </div>

        <div className="shrink-0 hidden sm:block">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-400 to-violet-500 p-1 shadow-2xl flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-center p-2 border-2 border-violet-400/50">
              <Crop className="w-8 h-8 text-violet-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider mt-0.5">RESIZER PRO</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Upload Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-600" />
                {t('मूळ फोटो किंवा स्वाक्षरी निवडा (JPG / PNG / WEBP):', 'Select Photo or Signature (JPG / PNG / WEBP):')}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {t('१००% प्रायव्हेट (ब्राऊझर प्रोसेस)', '100% Private (In-Browser)')}
              </span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-violet-500 hover:bg-violet-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center text-violet-600 transition-colors">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {originalFile
                    ? `${t('निवडलेली फाइल:', 'Selected file:')} ${originalFile.name}`
                    : t('फोटो किंवा स्वाक्षरी अपलोड करण्यासाठी येथे क्लिक करा', 'Click here to upload photo or signature')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t(
                    'मोबाईलने काढलेला कोणताही फोटो किंवा स्वाक्षरी चालते (JPG, PNG, WEBP)',
                    'Supports any mobile photo or scanned signature (JPG, PNG, WEBP)'
                  )}
                </p>
              </div>

              {originalSizeKb > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 text-violet-900 rounded-full text-xs font-bold border border-violet-200">
                  <span>{t('मूळ आकार:', 'Original size:')} {originalSizeKb} KB</span>
                  <span>•</span>
                  <span>
                    {originalImage?.width} × {originalImage?.height} px
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Official Exam & Document Presets */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {t('सरकारी भरती व अधिकृत नमुने (१-क्लिक प्रीसेट्स):', 'Govt Exam & Official 1-Click Presets:')}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {t('अचूक माप व KB ऑटो-सेट होते', 'Exact size & KB auto-applied')}
              </span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: t('सर्व नमुने', 'All Presets') },
                { id: 'maha', label: t('महाराष्ट्र भरती (MPSC/पोलीस)', 'Maharashtra (MPSC/Police)') },
                { id: 'central', label: t('केंद्रीय भरती (SSC/UPSC/NEET)', 'Central (SSC/UPSC/NEET)') },
                { id: 'bank', label: t('बँकिंग (IBPS/SBI)', 'Banking (IBPS/SBI)') },
                { id: 'passport', label: t('पासपोर्ट, व्हिसा व पॅन', 'Passport, Visa & PAN') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id as CategoryType)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredPresets.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-3 text-left rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-violet-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                          {lang === 'en' ? p.badgeEn : p.badge}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                      </div>
                      <p className="font-bold text-xs text-slate-900 leading-snug">
                        {lang === 'en' ? p.nameEn : p.name}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      {lang === 'en' ? p.descriptionEn : p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Custom Dimensions, Units & DPI */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-600" />
                {t('कस्टम आकार (Dimensions), एकक (Units) व DPI', 'Custom Dimensions, Units & DPI')}
              </h3>
              <span className="text-xs font-mono font-bold text-violet-700">
                {calcPx.w} × {calcPx.h} px
              </span>
            </div>

            {/* Unit Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('एकक निवडा (Units):', 'Select Unit:')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['cm', 'mm', 'px', 'inch'] as UnitType[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      if (u !== unit) {
                        const newVals = convertFromPixels(calcPx.w, calcPx.h, u, dpi);
                        setUnit(u);
                        setWidthVal(newVals.w);
                        setHeightVal(newVals.h);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      unit === u
                        ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {u === 'cm'
                      ? t('सेंटीमीटर (cm)', 'Centimeter (cm)')
                      : u === 'mm'
                      ? t('मिलीमीटर (mm)', 'Millimeter (mm)')
                      : u === 'px'
                      ? t('पिक्सेल (px)', 'Pixels (px)')
                      : t('इंच (inch)', 'Inch (in)')}
                  </button>
                ))}
              </div>
            </div>

            {/* Width, Height, DPI Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t(`रुंदी (Width - ${unit})`, `Width (${unit})`)}
                </label>
                <input
                  type="number"
                  step={unit === 'px' ? '1' : '0.1'}
                  value={widthVal}
                  onChange={(e) => setWidthVal(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t(`उंची (Height - ${unit})`, `Height (${unit})`)}
                </label>
                <input
                  type="number"
                  step={unit === 'px' ? '1' : '0.1'}
                  value={heightVal}
                  onChange={(e) => setHeightVal(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('रिझोल्यूशन (DPI)', 'Resolution (DPI)')}
                </label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="300">{t('३०० DPI (अल्ट्रा HD प्रिंट / NSDL)', '300 DPI (Ultra HD Print / NSDL)')}</option>
                  <option value="200">{t('२०० DPI (परीक्षा मानक)', '200 DPI (Exam Standard)')}</option>
                  <option value="150">{t('१५० DPI (मध्यम)', '150 DPI (Medium)')}</option>
                  <option value="100">{t('१०० DPI (हलकी फाईल)', '100 DPI (Light File)')}</option>
                  <option value="72">{t('७२ DPI (वेब)', '72 DPI (Web)')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Target File Size (KB) & Quality */}
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SunMedium className="w-4 h-4 text-amber-600" />
                {t('अचूक फाईल साईज कॉम्प्रेशन (Target KB):', 'Exact File Size Compression (Target KB):')}
              </h3>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                {useTargetKb ? t(`लक्ष्य: ${targetKb} KB च्या आत`, `Target: Under ${targetKb} KB`) : t('मॅन्युअल क्वालिटी', 'Manual Quality')}
              </span>
            </div>

            {/* Quick KB Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('सामान्यतः आवश्यक असणारे KB निवडा:', 'Quick Select Target KB Size:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { kb: 20, label: t('२० KB (स्वाक्षरी)', '20 KB (Sign)') },
                  { kb: 30, label: t('३० KB (पॅन/आधार)', '30 KB (PAN)') },
                  { kb: 50, label: t('५० KB (MPSC/पोलीस)', '50 KB (Exam)') },
                  { kb: 100, label: t('१०० KB (MahaDBT)', '100 KB (DBT)') },
                  { kb: 200, label: t('२०० KB (UPSC/NEET)', '200 KB (UPSC)') },
                ].map((item) => (
                  <button
                    key={item.kb}
                    type="button"
                    onClick={() => {
                      setTargetKb(item.kb);
                      setUseTargetKb(true);
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      useTargetKb && targetKb === item.kb
                        ? 'border-amber-500 bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-amber-50 text-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('स्वतःचे लक्ष्य KB टाका (Custom Target KB):', 'Custom Target KB:')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="5"
                    max="2000"
                    value={targetKb}
                    onChange={(e) => {
                      setTargetKb(Math.max(5, parseInt(e.target.value, 10) || 50));
                      setUseTargetKb(true);
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="self-center text-xs font-bold text-slate-500">KB</span>
                </div>
              </div>

              {/* Manual Quality Slider toggle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-semibold">{t('मॅन्युअल कॉम्प्रेशन गुणवत्ता', 'Manual Compression Quality')}</span>
                  <span className="font-bold text-violet-700">{Math.round(manualQuality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={manualQuality}
                  onChange={(e) => {
                    setManualQuality(parseFloat(e.target.value));
                    setUseTargetKb(false);
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
              </div>
            </div>
          </div>

          {/* 5. Advanced Photo Tools (Rotate, Flip, Signature Whiten, Name/Date Stamp) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Crop className="w-4 h-4 text-violet-600" />
              {t('फोटो संपादन व दुरुस्ती टूल्स (Edit & Fix Tools):', 'Photo Edit & Enhancement Tools:')}
            </h3>

            {/* Rotate & Flip Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('डावीकडे फिरवा', 'Rotate Left')}
              </button>

              <button
                type="button"
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {t('उजवीकडे फिरवा', 'Rotate Right')}
              </button>

              <button
                type="button"
                onClick={() => setFlipH((prev) => !prev)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  flipH ? 'bg-violet-100 border-violet-400 text-violet-900' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                {t('आडवे उलटा', 'Flip Horiz.')}
              </button>

              <button
                type="button"
                onClick={() => setFlipV((prev) => !prev)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  flipV ? 'bg-violet-100 border-violet-400 text-violet-900' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                {t('उभे उलटा', 'Flip Vert.')}
              </button>
            </div>

            {/* Checkboxes: Signature Whiten & Face Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={whitenSignature}
                  onChange={(e) => setWhitenSignature(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500 accent-violet-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {t('✍️ स्वाक्षरी पांढरी व स्पष्ट करा (Whiten Paper)', '✍️ Whiten Signature Paper')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {t('मोबाईलने काढलेल्या स्वाक्षरीचा पिवळा/करडा कागद काढून पांढरा करतो', 'Removes grey/yellow shadow from phone-clicked signatures')}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showFaceGuide}
                  onChange={(e) => setShowFaceGuide(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500 accent-violet-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {t('👤 फेस गाईड ओव्हरले दाखवा (Passport Oval)', '👤 Show Passport Face Guide Oval')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {t('चेहरा बरोबर ७०-८०% फ्रेममध्ये बसवण्यासाठी गाईड लाईन', 'Guide overlay to center face cleanly inside 70–80% frame')}
                  </span>
                </div>
              </label>
            </div>

            {/* Name & Date on Photo (DOP) Strip Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableNameDate}
                  onChange={(e) => setEnableNameDate(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 accent-violet-600"
                />
                <span>{t('फोटोवर नाव व तारीख टाका (NEET / SSC नियम - DOP Strip)', 'Add Name & Date on Photo (NEET / SSC DOP Strip)')}</span>
              </label>

              {enableNameDate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('उमेदवाराचे नाव (Full Name):', 'Candidate Full Name:')}
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="e.g. SACHIN T. PATIL"
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold uppercase bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('फोटो काढल्याची तारीख (DOP):', 'Date of Photo (DOP):')}
                    </label>
                    <input
                      type="text"
                      value={photoDate}
                      onChange={(e) => setPhotoDate(e.target.value)}
                      placeholder="12/11/2026"
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview & Download Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-800 text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold flex items-center gap-1.5">
                <Sparkle className="w-4 h-4 text-amber-400" />
                {t('लाईव्ह प्रिव्ह्यू व डाउनलोड', 'Live Preview & Download')}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {calcPx.w} × {calcPx.h} px
              </span>
            </div>

            {/* Processed Image Canvas Container */}
            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 min-h-[220px] flex items-center justify-center overflow-hidden">
              {resultDataUrl ? (
                <div className="relative text-center space-y-2">
                  <div className="relative inline-block">
                    <img
                      src={resultDataUrl}
                      alt="Resized Output"
                      className="max-h-64 max-w-full mx-auto rounded-lg shadow-xl border border-slate-700 object-contain"
                    />

                    {/* Passport Oval Face Guide Overlay */}
                    {showFaceGuide && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-[65%] h-[75%] border-2 border-dashed border-amber-400 rounded-[50%/60%] opacity-80 shadow-xs" />
                      </div>
                    )}
                  </div>

                  {/* Size & Dimension Badge */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${
                        useTargetKb && resultSizeKb <= targetKb
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('अंतिम आकार:', 'Final Size:')} {resultSizeKb} KB
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                      {widthVal} × {heightVal} {unit} ({dpi} DPI)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-500">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">
                    {t('फोटो अपलोड केल्यानंतर येथे प्रिव्ह्यू दिसेल.', 'Upload a photo to see live preview here.')}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {t('डाव्या बाजूने फोटो निवडून हवे ते माप सेट करा.', 'Select a photo and preset on the left panel.')}
                  </p>
                </div>
              )}
            </div>

            {/* Format Selector Tabs */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-300 block">
                {t('डाउनलोड फॉरमॅट निवडा (Format):', 'Select Output Format:')}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOutputFormat('jpg')}
                  className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    outputFormat === 'jpg'
                      ? 'border-blue-400 bg-blue-950/70 text-blue-300 font-black ring-1 ring-blue-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">JPG</span>
                  <span className="text-[9px] block text-slate-400">{t('परीक्षा फॉर्म', 'Exam Forms')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('png')}
                  className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    outputFormat === 'png'
                      ? 'border-emerald-400 bg-emerald-950/70 text-emerald-300 font-black ring-1 ring-emerald-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">PNG</span>
                  <span className="text-[9px] block text-slate-400">{t('HD स्पष्ट', 'Lossless HD')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('webp')}
                  className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    outputFormat === 'webp'
                      ? 'border-purple-400 bg-purple-950/70 text-purple-300 font-black ring-1 ring-purple-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">WEBP</span>
                  <span className="text-[9px] block text-slate-400">{t('कमी साइज', 'Compact')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('pdf')}
                  className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    outputFormat === 'pdf'
                      ? 'border-red-400 bg-red-950/70 text-red-300 font-black ring-1 ring-red-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">PDF</span>
                  <span className="text-[9px] block text-slate-400">{t('प्रिंट योग्य', 'Print Ready')}</span>
                </button>
              </div>
            </div>

            {/* Main Download Button */}
            <button
              type="button"
              disabled={!resultDataUrl}
              onClick={() => handleDownloadSingle(outputFormat)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 text-white font-black text-sm sm:text-base shadow-xl shadow-indigo-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              {t('रिसाइझ केलेला फोटो डाउनलोड करा', 'Download Resized Photo')} ({outputFormat.toUpperCase()} • {resultSizeKb} KB)
            </button>

            {/* Instant 1-Click Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={() => handleDownloadSingle('jpg')}
                className="py-2 px-2 rounded-lg bg-blue-900/60 hover:bg-blue-800 disabled:opacity-40 text-blue-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-blue-800/80 cursor-pointer"
              >
                <FileImage className="w-3.5 h-3.5" />
                JPG
              </button>

              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={() => handleDownloadSingle('png')}
                className="py-2 px-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 disabled:opacity-40 text-emerald-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-emerald-800/80 cursor-pointer"
              >
                <FileImage className="w-3.5 h-3.5" />
                PNG
              </button>

              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={() => handleDownloadSingle('webp')}
                className="py-2 px-2 rounded-lg bg-purple-900/60 hover:bg-purple-800 disabled:opacity-40 text-purple-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-purple-800/80 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                WEBP
              </button>

              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={() => handleDownloadSingle('pdf')}
                className="py-2 px-2 rounded-lg bg-red-900/60 hover:bg-red-800 disabled:opacity-40 text-red-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-red-800/80 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>

            {/* Direct Print & WhatsApp Share Row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={handleDirectPrint}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                {t('थेट प्रिंट करा', 'Direct Print')}
              </button>

              <button
                type="button"
                disabled={!resultDataUrl}
                onClick={handleShare}
                className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-200" />
                {t('WhatsApp वर शेअर', 'Share on WhatsApp')}
              </button>
            </div>

            <div className="text-center pt-1">
              <span className="text-xs text-slate-400 font-medium">
                {statusMessage || t('कृपया फोटो निवडा.', 'Please select a photo.')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

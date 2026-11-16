import React, { useState, useRef, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import {
  Scissors,
  Upload,
  Download,
  Printer,
  ShieldCheck,
  FileText,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  Move,
  FileImage,
  Share2,
  Sparkles,
  Layers,
  Settings2,
  Copy,
  Check,
  Smartphone,
  Hand,
  Crop,
  Sliders,
  Square,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SheetSize, SplitMode, PrintMode, OutputFormat, PaperSpec } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink } from '../utils/shareConfig';
import { saveValidatedJsPdf } from '../utils/pdfCompat';
import { inspectUploadedFileBytes, releaseCanvasMemory } from '../utils/pdfSecurity';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface CropBox {
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  w: number; // percentage (0 to 100)
  h: number; // percentage (0 to 100)
}

const PAPERS: Record<SheetSize, PaperSpec & { labelEn: string }> = {
  a4: { name: 'a4', label: 'A4 शीट (210 × 297 mm)', labelEn: 'A4 Sheet (210 × 297 mm)', w: 210, h: 297, dpi: 200, orientation: 'portrait' },
  '4x6': { name: '4x6', label: '4 × 6 इंच फोटो पेपर (उभी शीट 102 × 152 mm)', labelEn: '4 × 6 inch Photo Paper (Portrait 102 × 152 mm)', w: 101.6, h: 152.4, dpi: 240, orientation: 'portrait' },
  a5: { name: 'a5', label: 'A5 शीट (148 × 210 mm)', labelEn: 'A5 Sheet (148 × 210 mm)', w: 148, h: 210, dpi: 200, orientation: 'portrait' },
  '5x7': { name: '5x7', label: '5 × 7 इंच फोटो पेपर (127 × 178 mm)', labelEn: '5 × 7 inch Photo Paper (127 × 178 mm)', w: 127, h: 177.8, dpi: 220, orientation: 'portrait' },
  '3.5x5': { name: '3.5x5', label: '3.5 × 5 इंच फोटो पेपर (89 × 127 mm)', labelEn: '3.5 × 5 inch Photo Paper (89 × 127 mm)', w: 88.9, h: 127, dpi: 220, orientation: 'portrait' },
  letter: { name: 'letter', label: 'Letter शीट (216 × 279 mm)', labelEn: 'Letter Sheet (216 × 279 mm)', w: 215.9, h: 279.4, dpi: 200, orientation: 'portrait' },
};

export const CardCutter: React.FC = () => {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manualCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Loaded Card Bitmaps
  const [frontDataCanvas, setFrontDataCanvas] = useState<HTMLCanvasElement | null>(null);
  const [backDataCanvas, setBackDataCanvas] = useState<HTMLCanvasElement | null>(null);

  // Settings
  const [splitMode, setSplitMode] = useState<SplitMode>('side');
  const [sheetSize, setSheetSize] = useState<SheetSize>('4x6');
  const [sheetLayout, setSheetLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [cardFitMode, setCardFitMode] = useState<'photo-fit' | 'cr80'>('photo-fit');
  const [printMode, setPrintMode] = useState<PrintMode>('same');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');
  const [exportDpi, setExportDpi] = useState<number>(300); // 300 DPI Ultra High Res or 200 Standard
  const [showCutMarks, setShowCutMarks] = useState<boolean>(false);
  const [includeFoldingLine, setIncludeFoldingLine] = useState<boolean>(false);

  // Fine-tuning adjustments (crop percentage adjustments)
  const [cropPadding, setCropPadding] = useState<number>(0); // in percent
  const [manualSwap, setManualSwap] = useState<boolean>(false);

  // Manual Crop Coordinates (% of page)
  const [frontBox, setFrontBox] = useState<CropBox>({ x: 5, y: 69, w: 43.5, h: 26.5 });
  const [backBox, setBackBox] = useState<CropBox>({ x: 51.5, y: 69, w: 43.5, h: 26.5 });
  const [activeCropTarget, setActiveCropTarget] = useState<'front' | 'back'>('front');
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Status
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cardReady, setCardReady] = useState<boolean>(false);
  const [lastSourceCanvas, setLastSourceCanvas] = useState<HTMLCanvasElement | null>(null);

  // Draw image on preview canvas
  const renderPreview = (targetCanvas: HTMLCanvasElement | null, sourceCanvas: HTMLCanvasElement | null) => {
    if (!targetCanvas || !sourceCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    const ratio = Math.min(targetCanvas.width / sourceCanvas.width, targetCanvas.height / sourceCanvas.height);
    const w = sourceCanvas.width * ratio;
    const h = sourceCanvas.height * ratio;
    const x = (targetCanvas.width - w) / 2;
    const y = (targetCanvas.height - h) / 2;

    ctx.drawImage(sourceCanvas, x, y, w, h);

    // Decorative border around the preview
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  };

  // Crop half from source (either automatically or manually via frontBox/backBox)
  const cropSegment = useCallback(
    (source: HTMLCanvasElement, side: 'front' | 'back', mode: SplitMode): HTMLCanvasElement => {
      const sw = source.width;
      const sh = source.height;
      const cv = document.createElement('canvas');

      const effectiveSide = manualSwap ? (side === 'front' ? 'back' : 'front') : side;

      // ✋ MANUAL VISUAL CROP MODE (स्वतःच्या हाताने निवडलेली जागा)
      if (mode === 'manual') {
        const box = effectiveSide === 'front' ? frontBox : backBox;
        const sx = Math.floor((box.x / 100) * sw);
        const sy = Math.floor((box.y / 100) * sh);
        const cw = Math.floor((box.w / 100) * sw);
        const ch = Math.floor((box.h / 100) * sh);

        cv.width = Math.max(20, cw);
        cv.height = Math.max(20, ch);
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.drawImage(source, sx, sy, cw, ch, 0, 0, cv.width, cv.height);
        }
        return cv;
      }

      // 🤖 AUTOMATIC MODES
      if (mode === 'side') {
        // Left half is Front, Right half is Back
        const halfW = Math.floor(sw / 2);
        const padX = Math.floor(halfW * (cropPadding / 100));
        const padY = Math.floor(sh * (cropPadding / 100));

        const sx = effectiveSide === 'front' ? padX : halfW + padX;
        const sy = padY;
        const cw = halfW - padX * 2;
        const ch = sh - padY * 2;

        cv.width = Math.max(10, cw);
        cv.height = Math.max(10, ch);
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.drawImage(source, sx, sy, cw, ch, 0, 0, cv.width, cv.height);
        }
      } else {
        // Top half is Front, Bottom half is Back
        const halfH = Math.floor(sh / 2);
        const padX = Math.floor(sw * (cropPadding / 100));
        const padY = Math.floor(halfH * (cropPadding / 100));

        const sx = padX;
        const sy = effectiveSide === 'front' ? padY : halfH + padY;
        const cw = sw - padX * 2;
        const ch = halfH - padY * 2;

        cv.width = Math.max(10, cw);
        cv.height = Math.max(10, ch);
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.drawImage(source, sx, sy, cw, ch, 0, 0, cv.width, cv.height);
        }
      }

      return cv;
    },
    [cropPadding, manualSwap, frontBox, backBox]
  );

  // Process uploaded PDF or Image file
  const processUploadedFile = async (file: File) => {
    if (!file) return;
    let isPdf = false;
    let isImage = false;
    try {
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type);
      if (!inspection.valid || (inspection.kind !== 'pdf' && inspection.kind !== 'image')) {
        setStatus(
          t(
            'सुरक्षा तपासणी: फक्त वैध PDF किंवा इमेज (JPG/PNG/WEBP) फाईलच स्वीकारली जाते.',
            'Security check: Only verified PDF or raster image (JPG/PNG/WEBP) files are allowed.'
          )
        );
        return;
      }
      isPdf = inspection.kind === 'pdf';
      isImage = inspection.kind === 'image';
    } catch {
      setStatus(t('फाईल तपासताना त्रुटी आली.', 'Could not inspect uploaded file.'));
      return;
    }

    if (isPdf && file.size > 50 * 1024 * 1024) {
      setStatus(t('फाइल ५० MB पेक्षा मोठी नसावी.', 'PDF file exceeds 50 MB size limit.'));
      return;
    }
    if (isImage && file.size > 20 * 1024 * 1024) {
      setStatus(t('इमेज २० MB पेक्षा मोठी नसावी.', 'Image file exceeds 20 MB size limit.'));
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);

    // If it's an image file (Direct JPG/PNG upload support)
    if (isImage) {
      setStatus(t('इमेज वाचून कार्डचे भाग तयार करत आहे...', 'Processing image & splitting card sides...'));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const source = document.createElement('canvas');
          source.width = img.naturalWidth || img.width;
          source.height = img.naturalHeight || img.height;
          const ctx = source.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }
          setLastSourceCanvas(source);

          const front = cropSegment(source, 'front', splitMode);
          const back = cropSegment(source, 'back', splitMode);

          setFrontDataCanvas(front);
          setBackDataCanvas(back);

          renderPreview(frontCanvasRef.current, front);
          renderPreview(backCanvasRef.current, back);

          setCardReady(true);
          setStatus(
            t(
              'इमेजवरून दोन्ही बाजूंचा प्रिव्ह्यू तयार आहे! हवे त्या फॉरमॅटमध्ये (PDF, PNG, JPG, WEBP) डाउनलोड करा.',
              'Both Front & Back card previews are ready! Download in PDF, PNG, JPG, or WEBP.'
            )
          );
          setIsProcessing(false);
        };
        img.onerror = () => {
          setStatus(t('इमेज उघडताना त्रुटी आली. कृपया दुसरी इमेज निवडा.', 'Error reading image. Please select another file.'));
          setIsProcessing(false);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        setStatus(t('इमेज वाचताना त्रुटी आली.', 'Failed to read image file.'));
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    // PDF processing
    if (!window.pdfjsLib) {
      setStatus(t('PDF लायब्ररी लोड होत आहे, कृपया २ सेकंद थांबा...', 'PDF engine is loading, please wait 2 seconds...'));
      setIsProcessing(false);
      return;
    }

    setStatus(t('PDF वाचत आहे व उच्च रिझोल्यूशन तयार करत आहे…', 'Reading PDF at 300 DPI high resolution...'));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const doc = await loadingTask.promise;

      if (doc.numPages < 1) {
        setStatus(t('PDF मध्ये कोणतेही पान सापडले नाही.', 'No pages found in PDF.'));
        setIsProcessing(false);
        return;
      }

      // Check if multi-page duplex
      if (doc.numPages >= 2 && splitMode === 'duplex') {
        const p1 = await doc.getPage(1);
        const p2 = await doc.getPage(2);

        const v1 = p1.getViewport({ scale: 3.5 });
        const c1 = document.createElement('canvas');
        c1.width = Math.ceil(v1.width);
        c1.height = Math.ceil(v1.height);
        await p1.render({ canvasContext: c1.getContext('2d'), viewport: v1 }).promise;

        const v2 = p2.getViewport({ scale: 3.5 });
        const c2 = document.createElement('canvas');
        c2.width = Math.ceil(v2.width);
        c2.height = Math.ceil(v2.height);
        await p2.render({ canvasContext: c2.getContext('2d'), viewport: v2 }).promise;

        setFrontDataCanvas(manualSwap ? c2 : c1);
        setBackDataCanvas(manualSwap ? c1 : c2);
        renderPreview(frontCanvasRef.current, manualSwap ? c2 : c1);
        renderPreview(backCanvasRef.current, manualSwap ? c1 : c2);

        setCardReady(true);
        setStatus(t('दोन्ही पानांचा Front आणि Back प्रिव्ह्यू तयार आहे!', 'Front and Back preview ready from both PDF pages!'));
        setIsProcessing(false);
        return;
      }

      // Single-page PDF with Front + Back
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 3.5 });
      const source = document.createElement('canvas');
      source.width = Math.ceil(viewport.width);
      source.height = Math.ceil(viewport.height);

      await page.render({ canvasContext: source.getContext('2d'), viewport }).promise;
      setLastSourceCanvas(source);

      const front = cropSegment(source, 'front', splitMode);
      const back = cropSegment(source, 'back', splitMode);

      setFrontDataCanvas(front);
      setBackDataCanvas(back);

      renderPreview(frontCanvasRef.current, front);
      renderPreview(backCanvasRef.current, back);

      setCardReady(true);
      setStatus(
        t(
          'दोन्ही बाजूंचा प्रिव्ह्यू तयार आहे. योग्य फॉरमॅट (PDF, PNG, JPG) निवडून डाउनलोड करा.',
          'Both sides preview ready! Choose PDF, PNG, JPG, or WEBP to download.'
        )
      );
    } catch (err: any) {
      console.error(err);
      setStatus(t('PDF उघडताना त्रुटी आली. कृपया पासवर्ड नसलेली वैध PDF निवडा.', 'Error reading PDF. Please use an unlocked PDF file.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-crop when split mode, fine tuning, or manual crop boxes change
  useEffect(() => {
    if (lastSourceCanvas) {
      const front = cropSegment(lastSourceCanvas, 'front', splitMode);
      const back = cropSegment(lastSourceCanvas, 'back', splitMode);
      setFrontDataCanvas(front);
      setBackDataCanvas(back);
      renderPreview(frontCanvasRef.current, front);
      renderPreview(backCanvasRef.current, back);
    }
  }, [splitMode, cropSegment, lastSourceCanvas, frontBox, backBox]);

  // Draw Interactive Manual Cropper Canvas
  const drawManualCanvas = useCallback(() => {
    const cv = manualCanvasRef.current;
    if (!cv || !lastSourceCanvas) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const sw = lastSourceCanvas.width;
    const sh = lastSourceCanvas.height;

    // Set internal display dimensions matching source aspect ratio
    const displayW = 800;
    const displayH = Math.round((sh / sw) * displayW);
    if (cv.width !== displayW || cv.height !== displayH) {
      cv.width = displayW;
      cv.height = displayH;
    }

    // 1. Draw source document
    ctx.drawImage(lastSourceCanvas, 0, 0, displayW, displayH);

    // 2. Dim entire canvas slightly
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, displayW, displayH);

    const drawBox = (box: CropBox, color: string, fill: string, label: string, isActive: boolean) => {
      const bx = (box.x / 100) * displayW;
      const by = (box.y / 100) * displayH;
      const bw = (box.w / 100) * displayW;
      const bh = (box.h / 100) * displayH;

      // Clear dimming on selected box to show original content crisply
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      ctx.drawImage(lastSourceCanvas, 0, 0, displayW, displayH);
      ctx.restore();

      // Box fill overlay
      ctx.fillStyle = fill;
      ctx.fillRect(bx, by, bw, bh);

      // Box stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 3 : 2;
      if (!isActive) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Corner handles
      const handleSize = 8;
      ctx.fillStyle = color;
      ctx.fillRect(bx - handleSize / 2, by - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx + bw - handleSize / 2, by - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(bx + bw - handleSize / 2, by + bh - handleSize / 2, handleSize, handleSize);

      // Label tag
      ctx.fillStyle = color;
      const fontSize = Math.max(12, Math.round(displayW * 0.018));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const tagText = ` ${label} `;
      const textW = ctx.measureText(tagText).width;
      const tagY = by > 26 ? by - 24 : by + 4;
      ctx.fillRect(bx, tagY, textW + 8, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, bx + 4, tagY + 16);
    };

    // Draw non-active first, then active on top
    if (activeCropTarget === 'front') {
      drawBox(backBox, '#10b981', 'rgba(16, 185, 129, 0.12)', t('मागील बाजू (Back)', 'Back Side'), false);
      drawBox(frontBox, '#2563eb', 'rgba(37, 99, 235, 0.18)', t('पुढील बाजू (Front) [सक्रिय]', 'Front Side [Active]'), true);
    } else {
      drawBox(frontBox, '#2563eb', 'rgba(37, 99, 235, 0.12)', t('पुढील बाजू (Front)', 'Front Side'), false);
      drawBox(backBox, '#10b981', 'rgba(16, 185, 129, 0.18)', t('मागील बाजू (Back) [सक्रिय]', 'Back Side [Active]'), true);
    }
  }, [lastSourceCanvas, frontBox, backBox, activeCropTarget, t]);

  useEffect(() => {
    if (splitMode === 'manual') {
      drawManualCanvas();
    }
  }, [splitMode, drawManualCanvas]);

  // Coordinate helper for interactive canvas drag
  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!manualCanvasRef.current) return;
    const coords = getCanvasCoordinates(e, manualCanvasRef.current);
    setIsDraggingCrop(true);
    setDragStart(coords);
    const updateBox = activeCropTarget === 'front' ? setFrontBox : setBackBox;
    updateBox({ x: coords.x, y: coords.y, w: 2, h: 2 });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingCrop || !dragStart || !manualCanvasRef.current) return;
    const coords = getCanvasCoordinates(e, manualCanvasRef.current);
    const x = Math.min(dragStart.x, coords.x);
    const y = Math.min(dragStart.y, coords.y);
    const w = Math.max(2, Math.abs(coords.x - dragStart.x));
    const h = Math.max(2, Math.abs(coords.y - dragStart.y));

    const updateBox = activeCropTarget === 'front' ? setFrontBox : setBackBox;
    updateBox({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
    });
  };

  const handleCropMouseUp = () => {
    if (isDraggingCrop) {
      setIsDraggingCrop(false);
      setDragStart(null);
    }
  };

  // Smart presets for common government documents
  const applyPreset = (preset: 'aadhaar' | 'pan' | 'voter' | 'agristack' | 'topbottom' | 'fullside') => {
    if (preset === 'aadhaar') {
      setFrontBox({ x: 4.5, y: 69.5, w: 43.5, h: 26.5 });
      setBackBox({ x: 51.5, y: 69.5, w: 43.5, h: 26.5 });
      setStatus(t('आधार कार्ड बॉटम प्रीसेट लागू केला! ✓', 'Aadhaar Bottom Preset applied! ✓'));
    } else if (preset === 'pan') {
      setFrontBox({ x: 6, y: 72, w: 42, h: 25 });
      setBackBox({ x: 51, y: 72, w: 42, h: 25 });
      setStatus(t('पॅन कार्ड बॉटम प्रीसेट लागू केला! ✓', 'PAN Card Bottom Preset applied! ✓'));
    } else if (preset === 'voter') {
      setFrontBox({ x: 5, y: 35, w: 43, h: 28 });
      setBackBox({ x: 52, y: 35, w: 43, h: 28 });
      setStatus(t('मतदार / ई-श्रम कार्ड प्रीसेट लागू केला! ✓', 'Voter / e-Shram Preset applied! ✓'));
    } else if (preset === 'agristack') {
      setFrontBox({ x: 8, y: 12, w: 84, h: 38 });
      setBackBox({ x: 8, y: 52, w: 84, h: 36 });
      setStatus(t('शेती परिचय पत्र (AgriStack वर-खाली) प्रीसेट लागू केला! ✓', 'AgriStack / Farmer ID (Top-Bottom) Preset applied! ✓'));
    } else if (preset === 'topbottom') {
      setFrontBox({ x: 5, y: 5, w: 90, h: 42 });
      setBackBox({ x: 5, y: 52, w: 90, h: 42 });
      setStatus(t('वर-खाली (Top-Bottom) प्रीसेट लागू केला! ✓', 'Top-Bottom Preset applied! ✓'));
    } else if (preset === 'fullside') {
      setFrontBox({ x: 2, y: 5, w: 46, h: 90 });
      setBackBox({ x: 52, y: 5, w: 46, h: 90 });
      setStatus(t('डावी-उजवी बाजू प्रीसेट लागू केला! ✓', 'Left-Right Split Preset applied! ✓'));
    }
  };

  // Resolve effective paper dimensions based on sheetSize + sheetLayout
  const getEffectivePaperDims = useCallback(
    (paperKey: SheetSize): { w: number; h: number; dpi: number; isVerticalLayout: boolean } => {
      const base = PAPERS[paperKey];
      const shortSide = Math.min(base.w, base.h);
      const longSide = Math.max(base.w, base.h);
      // Two CR80 cards side-by-side require ~175 mm width; force vertical stack if paper width is narrower
      const canFitSideBySide = longSide >= 178;
      const isVerticalLayout = sheetLayout === 'vertical' || !canFitSideBySide;

      if (isVerticalLayout) {
        return { w: shortSide, h: longSide, dpi: base.dpi, isVerticalLayout: true };
      }
      // Horizontal side-by-side layout on wide sheets (A4 landscape, 5x7 landscape, Letter landscape)
      return { w: longSide, h: shortSide, dpi: base.dpi, isVerticalLayout: false };
    },
    [sheetLayout]
  );

  // Build Sheet Canvas with configurable DPI, clean Photo Fit / CR80 sizing, and optional cut marks
  const buildSheetCanvas = useCallback(
    (
      side: 'both' | 'front' | 'back',
      paperKey: SheetSize,
      customDpi?: number,
      cutMarks: boolean = showCutMarks
    ): HTMLCanvasElement => {
      const effPaper = getEffectivePaperDims(paperKey);
      const cv = document.createElement('canvas');

      const dpi = customDpi || exportDpi || effPaper.dpi;
      const widthPx = Math.round((effPaper.w / 25.4) * dpi);
      const heightPx = Math.round((effPaper.h / 25.4) * dpi);
      cv.width = widthPx;
      cv.height = heightPx;

      const ctx = cv.getContext('2d');
      if (!ctx) return cv;

      // Crisp clean white photo-paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, widthPx, heightPx);

      // Determine card slot sizing
      const usePhotoFit = cardFitMode === 'photo-fit';
      const maxSlotW_mm = usePhotoFit
        ? Math.min(91, effPaper.w - 10) // ~91mm on 4x6 (101.6mm) leaving ~5.3mm clean white side margins
        : Math.min(85.6, effPaper.w - 8);
      const maxSlotH_mm = usePhotoFit
        ? effPaper.isVerticalLayout
          ? Math.min(58, (effPaper.h - 24) / 2)
          : 58
        : 54.0;

      const computeFittedCardBox = (source: HTMLCanvasElement, maxW_mm: number, maxH_mm: number) => {
        if (!usePhotoFit) {
          return {
            wPx: (maxW_mm / 25.4) * dpi,
            hPx: (maxH_mm / 25.4) * dpi,
          };
        }
        const maxWPx = (maxW_mm / 25.4) * dpi;
        const maxHPx = (maxH_mm / 25.4) * dpi;
        const srcW = Math.max(1, source.width);
        const srcH = Math.max(1, source.height);
        const scale = Math.min(maxWPx / srcW, maxHPx / srcH);
        return {
          wPx: srcW * scale,
          hPx: srcH * scale,
        };
      };

      const drawCardSlot = (source: HTMLCanvasElement, x_px: number, y_px: number, slotW_px: number, slotH_px: number) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x_px, y_px, slotW_px, slotH_px);
        ctx.drawImage(source, x_px, y_px, slotW_px, slotH_px);

        if (cutMarks) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = Math.max(1, dpi * 0.006);
          ctx.strokeRect(x_px, y_px, slotW_px, slotH_px);

          const markerLen = Math.max(6, Math.round(dpi * 0.035));
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = Math.max(1, dpi * 0.004);

          // Top-left
          ctx.beginPath();
          ctx.moveTo(x_px - markerLen, y_px);
          ctx.lineTo(x_px + markerLen, y_px);
          ctx.moveTo(x_px, y_px - markerLen);
          ctx.lineTo(x_px, y_px + markerLen);
          ctx.stroke();

          // Top-right
          ctx.beginPath();
          ctx.moveTo(x_px + slotW_px - markerLen, y_px);
          ctx.lineTo(x_px + slotW_px + markerLen, y_px);
          ctx.moveTo(x_px + slotW_px, y_px - markerLen);
          ctx.lineTo(x_px + slotW_px, y_px + markerLen);
          ctx.stroke();

          // Bottom-left
          ctx.beginPath();
          ctx.moveTo(x_px - markerLen, y_px + slotH_px);
          ctx.lineTo(x_px + markerLen, y_px + slotH_px);
          ctx.moveTo(x_px, y_px + slotH_px - markerLen);
          ctx.lineTo(x_px, y_px + slotH_px + markerLen);
          ctx.stroke();

          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(x_px + slotW_px - markerLen, y_px + slotH_px);
          ctx.lineTo(x_px + slotW_px + markerLen, y_px + slotH_px);
          ctx.moveTo(x_px + slotW_px, y_px + slotH_px - markerLen);
          ctx.lineTo(x_px + slotW_px, y_px + slotH_px + markerLen);
          ctx.stroke();
        }
      };

      if (side === 'both') {
        const frontBoxPx = frontDataCanvas
          ? computeFittedCardBox(frontDataCanvas, maxSlotW_mm, maxSlotH_mm)
          : { wPx: (maxSlotW_mm / 25.4) * dpi, hPx: (maxSlotH_mm / 25.4) * dpi };
        const backBoxPx = backDataCanvas
          ? computeFittedCardBox(backDataCanvas, maxSlotW_mm, maxSlotH_mm)
          : { wPx: (maxSlotW_mm / 25.4) * dpi, hPx: (maxSlotH_mm / 25.4) * dpi };

        if (effPaper.isVerticalLayout) {
          // VERTICAL PHOTO SHEET (4x6 Portrait): Front Card cleanly on TOP, Back Card cleanly BELOW
          const gap_px = (7 / 25.4) * dpi; // 7mm clean breathing gap between Front & Back
          const totalCardsH = frontBoxPx.hPx + gap_px + backBoxPx.hPx;
          const startY = Math.max((4 / 25.4) * dpi, (heightPx - totalCardsH) / 2);

          if (frontDataCanvas) {
            const fx = (widthPx - frontBoxPx.wPx) / 2;
            drawCardSlot(frontDataCanvas, fx, startY, frontBoxPx.wPx, frontBoxPx.hPx);
          }
          if (backDataCanvas) {
            const bx = (widthPx - backBoxPx.wPx) / 2;
            const by = startY + frontBoxPx.hPx + gap_px;
            drawCardSlot(backDataCanvas, bx, by, backBoxPx.wPx, backBoxPx.hPx);
          }

          if (includeFoldingLine) {
            const lineY = startY + frontBoxPx.hPx + gap_px / 2;
            const maxW = Math.max(frontBoxPx.wPx, backBoxPx.wPx);
            const lineLeft = (widthPx - maxW) / 2 - 10;
            const lineRight = (widthPx + maxW) / 2 + 10;
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = Math.max(1, dpi * 0.005);
            ctx.beginPath();
            ctx.moveTo(lineLeft, lineY);
            ctx.lineTo(lineRight, lineY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          // HORIZONTAL SIDE-BY-SIDE SHEET (for wide papers like A4 Landscape / 5x7 Landscape)
          const singleMaxW_mm = Math.min(85.6, (effPaper.w - 16) / 2);
          const fBox = frontDataCanvas
            ? computeFittedCardBox(frontDataCanvas, singleMaxW_mm, 54.0)
            : { wPx: (singleMaxW_mm / 25.4) * dpi, hPx: (54.0 / 25.4) * dpi };
          const bBox = backDataCanvas
            ? computeFittedCardBox(backDataCanvas, singleMaxW_mm, 54.0)
            : { wPx: (singleMaxW_mm / 25.4) * dpi, hPx: (54.0 / 25.4) * dpi };

          const gap_px = (4 / 25.4) * dpi;
          const totalCardsW = fBox.wPx + bBox.wPx + gap_px;
          const startX = (widthPx - totalCardsW) / 2;

          if (frontDataCanvas) {
            const fy = (heightPx - fBox.hPx) / 2;
            drawCardSlot(frontDataCanvas, startX, fy, fBox.wPx, fBox.hPx);
          }
          if (backDataCanvas) {
            const by = (heightPx - bBox.hPx) / 2;
            drawCardSlot(backDataCanvas, startX + fBox.wPx + gap_px, by, bBox.wPx, bBox.hPx);
          }

          if (includeFoldingLine) {
            const maxH = Math.max(fBox.hPx, bBox.hPx);
            const lineY = (heightPx - maxH) / 2;
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = Math.max(1, dpi * 0.005);
            ctx.beginPath();
            ctx.moveTo(startX + fBox.wPx + gap_px / 2, lineY - 10);
            ctx.lineTo(startX + fBox.wPx + gap_px / 2, lineY + maxH + 10);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      } else {
        const src = side === 'front' ? frontDataCanvas : backDataCanvas;
        if (src) {
          const singleBox = computeFittedCardBox(src, maxSlotW_mm, maxSlotH_mm);
          const startX = (widthPx - singleBox.wPx) / 2;
          const startY = (heightPx - singleBox.hPx) / 2;
          drawCardSlot(src, startX, startY, singleBox.wPx, singleBox.hPx);
        }
      }

      return cv;
    },
    [
      frontDataCanvas,
      backDataCanvas,
      getEffectivePaperDims,
      exportDpi,
      showCutMarks,
      includeFoldingLine,
      cardFitMode,
    ]
  );

  // Keep Live Sheet Preview canvas synchronized whenever cutouts or sheet layout settings change
  useEffect(() => {
    const previewCv = sheetPreviewCanvasRef.current;
    if (!previewCv || !cardReady || (!frontDataCanvas && !backDataCanvas)) return;

    const generatedSheet = buildSheetCanvas(
      printMode === 'same' ? 'both' : 'front',
      sheetSize,
      120,
      showCutMarks
    );
    previewCv.width = generatedSheet.width;
    previewCv.height = generatedSheet.height;
    const pCtx = previewCv.getContext('2d');
    if (pCtx) {
      pCtx.clearRect(0, 0, previewCv.width, previewCv.height);
      pCtx.drawImage(generatedSheet, 0, 0);
    }
    releaseCanvasMemory(generatedSheet);
  }, [cardReady, frontDataCanvas, backDataCanvas, buildSheetCanvas, printMode, sheetSize, showCutMarks]);

  // Helper to trigger file download from canvas
  const downloadCanvasAsFile = (
    canvas: HTMLCanvasElement,
    filename: string,
    format: 'png' | 'jpg' | 'webp'
  ) => {
    const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    const quality = format === 'png' ? undefined : 0.96;
    const dataUrl = canvas.toDataURL(mime, quality);
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Download Individual Front or Back card as PNG / JPG / WEBP
  const handleDownloadSingleCard = (side: 'front' | 'back', format: 'png' | 'jpg' | 'webp') => {
    const target = side === 'front' ? frontDataCanvas : backDataCanvas;
    if (!target) {
      setStatus(t('कृपया आधी फाइल अपलोड करा.', 'Please upload a file first.'));
      return;
    }
    const cleanName = fileName.replace(/\.[^/.]+$/, '').slice(0, 15) || 'id-card';
    const sideLabel = side === 'front' ? 'front' : 'back';
    const ext = format === 'jpg' ? 'jpg' : format;
    downloadCanvasAsFile(target, `maha-corner-${cleanName}-${sideLabel}.${ext}`, format);
    trackFeatureAction('cutter');
    confetti({ particleCount: 30, spread: 45 });
    setStatus(
      t(
        `कार्डची ${side === 'front' ? 'पुढील (Front)' : 'मागील (Back)'} बाजू (${format.toUpperCase()}) डाउनलोड झाली! ✓`,
        `${side === 'front' ? 'Front' : 'Back'} card (${format.toUpperCase()}) downloaded! ✓`
      )
    );
  };

  // Download Both Front and Back as separate images (Instant 2 files)
  const handleDownloadBothCardsSeparate = async (format: 'png' | 'jpg' | 'webp') => {
    if (!frontDataCanvas || !backDataCanvas) {
      setStatus(t('कृपया आधी फाइल अपलोड करा.', 'Please upload a file first.'));
      return;
    }
    const cleanName = fileName.replace(/\.[^/.]+$/, '').slice(0, 15) || 'id-card';
    const ext = format === 'jpg' ? 'jpg' : format;
    downloadCanvasAsFile(frontDataCanvas, `maha-corner-${cleanName}-front.${ext}`, format);
    await new Promise((r) => setTimeout(r, 350));
    downloadCanvasAsFile(backDataCanvas, `maha-corner-${cleanName}-back.${ext}`, format);
    trackFeatureAction('cutter');
    confetti({ particleCount: 45, spread: 55 });
    setStatus(
      t(
        `दोन्ही कार्ड (Front व Back) स्वतंत्र ${format.toUpperCase()} फाइल्स म्हणून डाउनलोड झाल्या! ✓`,
        `Both Front & Back cards downloaded as separate ${format.toUpperCase()} files! ✓`
      )
    );
  };

  // Download Full Sheet (PDF, PNG, JPG, or WEBP)
  const handleDownloadSheet = async (chosenFormat: OutputFormat = outputFormat) => {
    if (!frontDataCanvas || !backDataCanvas) {
      setStatus(t('कृपया आधी PDF किंवा इमेज अपलोड करा.', 'Please upload a PDF or image first.'));
      return;
    }

    const effPaper = getEffectivePaperDims(sheetSize);
    setIsProcessing(true);
    setStatus(t(`${chosenFormat.toUpperCase()} फाइल तयार होत आहे...`, `Generating ${chosenFormat.toUpperCase()} file...`));

    try {
      const sheets: HTMLCanvasElement[] =
        printMode === 'same'
          ? [buildSheetCanvas('both', sheetSize, exportDpi, showCutMarks)]
          : [buildSheetCanvas('front', sheetSize, exportDpi, showCutMarks), buildSheetCanvas('back', sheetSize, exportDpi, showCutMarks)];

      const safeName = fileName.replace(/\.[^/.]+$/, '').slice(0, 15) || 'id-card';

      if (chosenFormat === 'pdf') {
        const orientation = effPaper.w > effPaper.h ? 'landscape' : 'portrait';
        const doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: [effPaper.w, effPaper.h],
          compress: true,
        });

        try {
          sheets.forEach((sheetCanvas, index) => {
            if (index > 0) {
              doc.addPage([effPaper.w, effPaper.h], orientation);
            }
            const dataUrl = sheetCanvas.toDataURL('image/jpeg', 0.96);
            doc.addImage(dataUrl, 'JPEG', 0, 0, effPaper.w, effPaper.h);
          });

          await saveValidatedJsPdf(doc, `maha-corner-card-${safeName}-${sheetSize}.pdf`, sheets.length);
          trackFeatureAction('cutter');
          confetti({ particleCount: 50, spread: 60 });
          setStatus(t('पडताळणी पूर्ण: अचूक ३०० DPI प्रिंट-रेडी PDF डाउनलोड झाली! ✓', 'Validated: Print-ready 300 DPI PDF downloaded! ✓'));
        } finally {
          sheets.forEach((cv) => releaseCanvasMemory(cv));
        }
      } else {
        const mime = chosenFormat === 'png' ? 'image/png' : chosenFormat === 'webp' ? 'image/webp' : 'image/jpeg';
        const ext = chosenFormat === 'jpg' ? 'jpg' : chosenFormat;

        for (let i = 0; i < sheets.length; i++) {
          const cv = sheets[i];
          const dataUrl = cv.toDataURL(mime, chosenFormat === 'png' ? undefined : 0.96);
          const a = document.createElement('a');
          const suffix = sheets.length > 1 ? (i === 0 ? '-front' : '-back') : '';
          a.download = `maha-corner-card${suffix}-${sheetSize}.${ext}`;
          a.href = dataUrl;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (i < sheets.length - 1) {
            await new Promise((r) => setTimeout(r, 400));
          }
        }

        confetti({ particleCount: 45, spread: 55 });
        trackFeatureAction('cutter');
        setStatus(
          t(
            `${chosenFormat.toUpperCase()} इमेज शीट यशस्वीरित्या डाउनलोड झाली! ✓`,
            `${chosenFormat.toUpperCase()} image sheet downloaded! ✓`
          )
        );
      }
    } catch (err: any) {
      console.error(err);
      setStatus(t('फाइल तयार करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.', 'Error generating file. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct Print Dialog via hidden iframe
  const handleDirectPrint = () => {
    if (!frontDataCanvas || !backDataCanvas) {
      setStatus(t('कृपया आधी PDF किंवा इमेज अपलोड करा.', 'Please upload a PDF or image first.'));
      return;
    }
    const sheetCanvas = buildSheetCanvas('both', sheetSize, exportDpi, showCutMarks);
    const dataUrl = sheetCanvas.toDataURL('image/png');
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
          <title>${t('महा कॉर्नर - कार्ड प्रिंट', 'MAHA CORNER - Print Card')}</title>
          <style>
            @page { size: auto; margin: 0; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
            img { max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
        </body>
      </html>
    `);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        trackFeatureAction('cutter');
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      }
    }, 150);
  };

  // Direct WhatsApp / Web Share
  const handleShareCard = async () => {
    if (!frontDataCanvas) {
      setStatus(t('कृपया आधी कार्ड अपलोड करा.', 'Please upload card first.'));
      return;
    }
    try {
      const sheetCanvas = buildSheetCanvas('both', sheetSize, exportDpi, showCutMarks);
      sheetCanvas.toBlob(async (blob) => {
        if (!blob) {
          setStatus(t('इमेज तयार करताना त्रुटी आली.', 'Error creating image.'));
          return;
        }
        const file = new File([blob], `maha-corner-card-${sheetSize}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: t('महा कॉर्नर - कार्ड प्रिंट', 'MAHA CORNER - Card Print'),
            text: appendPortalLink(
              t('🪪 महा कॉर्नर कार्ड कटरद्वारे तयार केलेले कार्ड प्रिंट', '🪪 Print-ready ID card generated with MAHA CORNER'),
              lang
            ),
            files: [file],
          });
          trackFeatureAction('cutter');
          setStatus(t('कार्ड यशस्वीरित्या शेअर केले! ✓', 'Card shared successfully! ✓'));
        } else {
          const a = document.createElement('a');
          a.download = `maha-corner-card-${sheetSize}.png`;
          a.href = URL.createObjectURL(blob);
          a.click();
          setStatus(t('डिव्हाइसवर शेअर पर्याय उपलब्ध नसल्याने PNG डाउनलोड झाली! ✓', 'Downloaded PNG because direct share is unavailable here! ✓'));
        }
      }, 'image/png');
    } catch (err) {
      console.warn('Share cancelled or not supported:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner with Logo */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('१००% सुरक्षित व डिव्हाइसवरच प्रोसेस (No Server Upload)', '100% Secure Local Browser Processing (No Upload)')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            {t('🪪 स्मार्ट कार्ड कटर (ऑटो व मॅन्युअल कट)', '🪪 Smart ID Card Cutter (Auto & Manual Crop)')}
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            {t(
              'आधार कार्ड, पॅन कार्ड, मतदार ओळखपत्र किंवा आयुष्यमान कार्डच्या एकाच पानातील Front व Back बाजू ऑटोमॅटिक किंवा स्वतःच्या हाताने (मॅन्युअल सिलेक्ट) अचूक कट करा आणि PDF, PNG, JPG मध्ये डाउनलोड करा.',
              'Split Aadhaar, PAN, Voter ID, or Ayushman cards into crisp CR80 Front & Back print sheets automatically or via interactive manual drag crop.'
            )}
          </p>
        </div>

        <div className="shrink-0 hidden sm:block">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-500 p-0.5 shadow-xl shadow-cyan-500/25">
            <img
              src="/assets/aistudio/file_000000001f788246b27e2a9dae2518e4_3f85ffd7.png"
              alt="महा कॉर्नर - Since 2018"
              className="w-full h-full object-cover rounded-full bg-[#020817] shadow-inner"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Upload Card PDF / Image */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                {t('कार्डची मूळ PDF किंवा इमेज अपलोड करा:', 'Upload Card PDF or Image:')}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {t('PDF / JPG / PNG सपोर्ट', 'PDF / JPG / PNG Support')}
              </span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processUploadedFile(file);
                }}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 group-hover:bg-amber-100 flex items-center justify-center text-indigo-600 group-hover:text-amber-700 transition-colors">
                <Scissors className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {fileName
                    ? `${t('निवडलेली फाइल:', 'Selected file:')} ${fileName}`
                    : t('येथे क्लिक करून PDF किंवा इमेज (JPG/PNG) निवडा', 'Click here to select Card PDF or Image (JPG/PNG)')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('आधार, पॅन कार्ड, ई-श्रम किंवा मतदार ओळखपत्र (PDF किंवा फोटो)', 'Aadhaar, PAN Card, e-Shram or Voter ID (PDF or Image)')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {t(
                  'गोपनीयता: तुमची फाईल तुमच्या ब्राऊजरमध्येच प्रोसेस होते. डेटा कुठेही अपलोड होत नाही.',
                  'Privacy: Your file stays strictly inside your browser. Zero server uploads.'
                )}
              </span>
            </div>
          </div>

          {/* 2. Cutting Mode Selector: Automatic vs Manual */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-600" />
                {t('कटिंग पद्धत निवडा (Cut Mode):', 'Select Cut Mode:')}
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                {t('काही भाग कट होत असल्यास "स्वतःच्या हाताने" पर्याय वापरा', 'Use "Manual Visual Crop" if auto edges clip')}
              </span>
            </div>

            {/* Toggle Buttons: Auto vs Manual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSplitMode(splitMode === 'manual' ? 'side' : splitMode)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  splitMode !== 'manual'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    {t('🤖 ऑटोमॅटिक कट (Automatic Split)', '🤖 Automatic Split')}
                  </span>
                  {splitMode !== 'manual' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <span className="text-[11px] text-slate-600 block">
                  {t('पानाचे ५०%-५०% समान दोन भाग (डावी-उजवी किंवा वर-खाली)', 'Equal 50%-50% auto split (Left-Right or Top-Bottom)')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('manual')}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  splitMode === 'manual'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    {t('✋ स्वतःच्या हाताने कट करा (Manual Visual Crop)', '✋ Manual Visual Crop')}
                  </span>
                  {splitMode === 'manual' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <span className="text-[11px] text-amber-900/90 block font-medium">
                  {t('पानावर स्वतः चौकोन ओढून हवी तेवढीच कार्ड जागा निवडा', 'Drag boxes directly over the document to select Front & Back')}
                </span>
              </button>
            </div>

            {/* IF AUTOMATIC MODE */}
            {splitMode !== 'manual' ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      {t('ऑटोमॅटिक रचना (Layout)', 'Automatic Layout')}
                    </label>
                    <select
                      value={splitMode}
                      onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="side">{t('डावीकडे Front – उजवीकडे Back (Side by Side)', 'Left Front – Right Back (Side by Side)')}</option>
                      <option value="stack">{t('वर Front – खाली Back (Top-Bottom)', 'Top Front – Bottom Back (Stacked)')}</option>
                      <option value="duplex">{t('पान १ Front – पान २ Back (Two Pages)', 'Page 1 Front – Page 2 Back (Two Pages)')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      {t('बॉर्डर क्रॉप ट्रिमिंग', 'Edge Trim Margin')} ({cropPadding}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="1"
                      value={cropPadding}
                      onChange={(e) => setCropPadding(parseInt(e.target.value, 10))}
                      className="w-full h-2 mt-4 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>
                    {t(
                      '💡 जर कार्डचा मजकूर किंवा बॉर्डर कट होत असेल तर वरून "✋ स्वतःच्या हाताने कट करा" निवडा.',
                      '💡 If card borders look slightly cut off, switch to "✋ Manual Visual Crop".'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSplitMode('manual')}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    {t('मॅन्युअल सुरू करा', 'Use Manual')}
                  </button>
                </div>
              </div>
            ) : (
              /* IF MANUAL CROP MODE */
              <div className="space-y-4 pt-2 border-t border-amber-200">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Crop className="w-4 h-4 text-amber-700" />
                      {t('खालील पानावर माऊस किंवा बोटाने चौकोन ओढून जागा सिलेक्ट करा:', 'Drag a rectangle over the page below to crop:')}
                    </span>
                    <span className="text-[11px] font-bold text-amber-800">
                      {t('सध्या निवडत आहे:', 'Currently selecting:')}{' '}
                      <strong className={activeCropTarget === 'front' ? 'text-blue-700 underline' : 'text-emerald-700 underline'}>
                        {activeCropTarget === 'front' ? t('Front (पुढील बाजू)', 'Front Side') : t('Back (मागील बाजू)', 'Back Side')}
                      </strong>
                    </span>
                  </div>

                  {/* Active Selection Target Switcher */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveCropTarget('front')}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeCropTarget === 'front'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                          : 'border-blue-300 bg-white text-blue-900 hover:bg-blue-50'
                      }`}
                    >
                      <Square className="w-3.5 h-3.5" />
                      {t('१. Front बाजू सिलेक्ट करा (निळा बॉक्स)', '1. Select Front Box (Blue)')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveCropTarget('back')}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeCropTarget === 'back'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                          : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                      }`}
                    >
                      <Square className="w-3.5 h-3.5" />
                      {t('२. Back बाजू सिलेक्ट करा (हिरवा बॉक्स)', '2. Select Back Box (Green)')}
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t('⚡ स्मार्ट प्रीसेट्स (१-क्लिक अचूक कट):', '⚡ Smart 1-Click Card Presets:')}
                    </label>
                    <span className="text-[10px] text-slate-500">{t('वारंवार लागणारे कार्ड्स', 'Common Govt Cards')}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('agristack')}
                      className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('🌾 शेती परिचय पत्र (वर-खाली)', '🌾 Farmer ID / AgriStack')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('aadhaar')}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('📋 आधार कार्ड (तळाशी)', '📋 Aadhaar (Bottom)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('pan')}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('💳 पॅन कार्ड (तळाशी)', '💳 PAN Card (Bottom)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('voter')}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('🗳️ मतदार / ई-श्रम कार्ड', '🗳️ Voter / e-Shram')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('topbottom')}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('↕️ वर व खाली (Top-Bottom)', '↕️ Full Top & Bottom')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('fullside')}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-amber-100 border border-slate-300 text-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('↔️ डावी व उजवी बाजू', '↔️ Left & Right Split')}
                    </button>
                  </div>
                </div>

                {/* Interactive Visual Canvas Editor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">{t('खालील मूळ कागदपत्रावर ड्रॅग करून बॉक्स निवडा:', 'Draw boxes over the source page below:')}</span>
                    <span className="text-[11px] text-amber-700 font-bold">{t('निळा = Front, हिरवा = Back', 'Blue = Front, Green = Back')}</span>
                  </div>

                  <div className="relative border-2 border-slate-300 rounded-2xl overflow-hidden bg-slate-900 shadow-inner flex items-center justify-center min-h-[260px] max-h-[460px]">
                    {lastSourceCanvas ? (
                      <canvas
                        ref={manualCanvasRef}
                        onMouseDown={handleCropMouseDown}
                        onMouseMove={handleCropMouseMove}
                        onMouseUp={handleCropMouseUp}
                        onTouchStart={handleCropMouseDown}
                        onTouchMove={handleCropMouseMove}
                        onTouchEnd={handleCropMouseUp}
                        className="w-full h-auto max-h-[450px] object-contain cursor-crosshair select-none"
                      />
                    ) : (
                      <div className="text-center p-8 text-slate-400 space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-slate-500" />
                        <span className="text-xs block font-bold">
                          {t('कृपया आधी वरील बॉक्समधून PDF किंवा इमेज निवडा', 'Please upload a PDF or Image first')}
                        </span>
                        <span className="text-[11px] block text-slate-500">
                          {t('त्यानंतर संपूर्ण पान येथे दिसेल व हाताने बॉक्स ओढता येईल.', 'The full page will appear here for manual box selection.')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Precision Sliders */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      {t('बारीक ऍडजस्टमेंट', 'Fine Sliders')} ({activeCropTarget === 'front' ? 'Front' : 'Back'}):
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      X: {activeCropTarget === 'front' ? frontBox.x : backBox.x}% | Y: {activeCropTarget === 'front' ? frontBox.y : backBox.y}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span>{t('X (डावी/उजवी)', 'X (Left/Right)')}</span>
                        <span className="font-bold">{activeCropTarget === 'front' ? frontBox.x : backBox.x}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="0.5"
                        value={activeCropTarget === 'front' ? frontBox.x : backBox.x}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (activeCropTarget === 'front') setFrontBox({ ...frontBox, x: val });
                          else setBackBox({ ...backBox, x: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span>{t('Y (वर/खाली)', 'Y (Top/Bottom)')}</span>
                        <span className="font-bold">{activeCropTarget === 'front' ? frontBox.y : backBox.y}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="0.5"
                        value={activeCropTarget === 'front' ? frontBox.y : backBox.y}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (activeCropTarget === 'front') setFrontBox({ ...frontBox, y: val });
                          else setBackBox({ ...backBox, y: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span>{t('रुंदी (Width)', 'Width')}</span>
                        <span className="font-bold">{activeCropTarget === 'front' ? frontBox.w : backBox.w}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="0.5"
                        value={activeCropTarget === 'front' ? frontBox.w : backBox.w}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (activeCropTarget === 'front') setFrontBox({ ...frontBox, w: val });
                          else setBackBox({ ...backBox, w: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span>{t('उंची (Height)', 'Height')}</span>
                        <span className="font-bold">{activeCropTarget === 'front' ? frontBox.h : backBox.h}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="0.5"
                        value={activeCropTarget === 'front' ? frontBox.h : backBox.h}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (activeCropTarget === 'front') setFrontBox({ ...frontBox, h: val });
                          else setBackBox({ ...backBox, h: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Print Paper & Duplex Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('प्रिंट शीटचा आकार (Paper Sheet)', 'Print Paper Size')}
                </label>
                <select
                  value={sheetSize}
                  onChange={(e) => setSheetSize(e.target.value as SheetSize)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {Object.entries(PAPERS).map(([k, p]) => (
                    <option key={k} value={k}>
                      {lang === 'en' ? p.labelEn : p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('शीटवरील कार्ड मांडणी (Sheet Arrangement)', 'Sheet Card Arrangement')}
                </label>
                <select
                  value={sheetLayout}
                  onChange={(e) => setSheetLayout(e.target.value as 'vertical' | 'horizontal')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="vertical">
                    {t('वर Front – खाली Back (४×६ उभी फोटो शीट)', 'Front on Top – Back Below (4×6 Portrait Sheet)')}
                  </option>
                  <option value="horizontal">
                    {t('डावी-उजवीकडे शेजारी (A4 / 5×7 आडवी शीट)', 'Side-by-Side (Wide A4 / 5×7 Landscape)')}
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('प्रिंट मांडणी (Print Mode)', 'Print Layout Mode')}
                </label>
                <select
                  value={printMode}
                  onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="same">{t('Front आणि Back एकाच शीटवर (Clean 4×6 / Print)', 'Front & Back on Same Sheet')}</option>
                  <option value="duplex">{t('Front व Back स्वतंत्र पानांवर (Duplex)', 'Front & Back on Separate Pages (Duplex)')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('कार्ड आकार व फिटिंग (Card Fit Mode)', 'Card Sizing on Sheet')}
                </label>
                <select
                  value={cardFitMode}
                  onChange={(e) => setCardFitMode(e.target.value as 'photo-fit' | 'cr80')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="photo-fit">
                    {t('मूळ आकार सुरक्षित (फोटो न ताणता क्लिअर ४×६ फिट)', 'Preserve Aspect Ratio (Clear Studio 4×6 Fit)')}
                  </option>
                  <option value="cr80">
                    {t('मानक PVC माप (85.6 × 54.0 mm अचूक)', 'Exact CR80 PVC Size (85.6 × 54.0 mm)')}
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t('प्रिंट गुणवत्ता (Resolution / DPI)', 'Export Resolution (DPI)')}
                </label>
                <select
                  value={exportDpi}
                  onChange={(e) => setExportDpi(parseInt(e.target.value, 10))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="300">{t('३०० DPI (अल्ट्रा HD - फोटो स्टुडिओ व लॅब प्रिंट)', '300 DPI (Ultra HD - Photo Lab & PVC Print)')}</option>
                  <option value="200">{t('२०० DPI (स्टँडर्ड प्रिंट - जलद डाउनलोड)', '200 DPI (Standard Print - Fast Export)')}</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={() => setManualSwap(!manualSwap)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 hover:border-amber-500 bg-slate-50 text-xs font-bold text-slate-700 hover:text-amber-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  {manualSwap ? t('मूळ स्थिती (Original)', 'Reset Swap (Original)') : t('Front व Back उलटा करा (Swap Front & Back)', 'Swap Front & Back')}
                </button>
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCutMarks}
                  onChange={(e) => setShowCutMarks(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                />
                <span>{t('कटिंग बॉर्डर व कॉर्नर मार्कर दाखवा', 'Show Cut Borders & Corner Marks')}</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeFoldingLine}
                  onChange={(e) => setIncludeFoldingLine(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600"
                />
                <span>{t('मध्यभागी फोल्डिंग गाईड लाईन दाखवा', 'Show Center Folding Guide Line')}</span>
              </label>
            </div>
          </div>

          {/* 3. DOWNLOAD HUB */}
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 sm:p-6 shadow-md space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Download className="w-5 h-5 text-amber-600" />
                  {t('डाउनलोड हब: फॉरमॅट निवडा (PDF, PNG, JPG, WEBP)', 'Download Hub: Select Format (PDF, PNG, JPG, WEBP)')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('आपल्या गरजेनुसार संपूर्ण शीट किंवा स्वतंत्र कार्ड इमेज डाउनलोड करा:', 'Download full print sheet or individual card sides:')}
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                {t('सर्व फॉरमॅट उपलब्ध', 'All Formats Ready')}
              </span>
            </div>

            {/* Visual Format Selector Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {t('१. शीट डाउनलोड फॉरमॅट निवडा:', '1. Choose Sheet Format:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setOutputFormat('pdf')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    outputFormat === 'pdf'
                      ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-red-700 flex items-center gap-1">
                      <FileText className="w-4 h-4" /> PDF
                    </span>
                    {outputFormat === 'pdf' && <Check className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('३०० DPI अचूक माप, प्रिंटरसाठी सर्वोत्तम', '300 DPI Exact Scale, Best for Printers')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('png')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    outputFormat === 'png'
                      ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                      <FileImage className="w-4 h-4" /> PNG
                    </span>
                    {outputFormat === 'png' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('लॉसलेस HD स्पष्टता, डिजिटल प्रिंट', 'Lossless HD Clarity, Digital Print')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('jpg')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    outputFormat === 'jpg'
                      ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-400/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-blue-700 flex items-center gap-1">
                      <FileImage className="w-4 h-4" /> JPG
                    </span>
                    {outputFormat === 'jpg' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('फोटो लॅब व स्टुडिओ प्रिंटिंग मानक', 'Photo Lab & Studio Standard')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputFormat('webp')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    outputFormat === 'webp'
                      ? 'border-purple-500 bg-purple-50/80 ring-2 ring-purple-400/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-purple-700 flex items-center gap-1">
                      <Smartphone className="w-4 h-4" /> WEBP
                    </span>
                    {outputFormat === 'webp' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('कमी साइज, व्हॉट्सॲप शेअरसाठी योग्य', 'Compact Size for WhatsApp Share')}
                  </span>
                </button>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              type="button"
              disabled={!cardReady || isProcessing}
              onClick={() => handleDownloadSheet(outputFormat)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Scissors className="w-5 h-5" />
              ✂️ {outputFormat.toUpperCase()} {t('शीट डाउनलोड करा', 'Download Print Sheet')} ({(lang === 'en' ? PAPERS[sheetSize].labelEn : PAPERS[sheetSize].label).split(' ')[0]})
            </button>

            {/* Quick 1-Click Direct Download Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">
                {t('२. एका क्लिकवर थेट डाउनलोड (Instant 1-Click Downloads):', '2. Instant 1-Click Sheet Downloads:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSheet('pdf')}
                  className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>

                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSheet('png')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  PNG HD
                </button>

                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSheet('jpg')}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  JPG
                </button>

                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSheet('webp')}
                  className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  WEBP
                </button>
              </div>
            </div>

            {/* Individual Card Downloads */}
            <div className="space-y-2 pt-3 border-t border-slate-100 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-700" />
                  {t('३. स्वतंत्र कार्ड डाउनलोड (फक्त पुढील किंवा मागील बाजू):', '3. Separate Card Sides (Front / Back Only):')}
                </label>
                <span className="text-[10px] text-amber-800 font-semibold">{t('पोर्टल व WhatsApp साठी', 'For Portals & WhatsApp')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSingleCard('front', 'png')}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-amber-100/70 border border-amber-300 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  {t('Front बाजू (PNG)', 'Front Side (PNG)')}
                </button>

                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadSingleCard('back', 'png')}
                  className="py-2 px-3 rounded-xl bg-white hover:bg-amber-100/70 border border-amber-300 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  {t('Back बाजू (PNG)', 'Back Side (PNG)')}
                </button>

                <button
                  type="button"
                  disabled={!cardReady || isProcessing}
                  onClick={() => handleDownloadBothCardsSeparate('png')}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t('दोन्ही वेगळ्या फाइल्स', 'Download Both Files')}
                </button>
              </div>
            </div>

            {/* Print & Share Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={!cardReady || isProcessing}
                onClick={handleDirectPrint}
                className="py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-600" />
                {t('थेट प्रिंट करा (Print Dialog)', 'Direct Print Sheet')}
              </button>

              <button
                type="button"
                disabled={!cardReady || isProcessing}
                onClick={handleShareCard}
                className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4 text-emerald-200" />
                {t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}
              </button>
            </div>

            <div className="text-center pt-1">
              <span className="text-xs text-slate-600 font-semibold">
                {status || t('PDF किंवा इमेज (JPG/PNG) अपलोड केल्यानंतर Front आणि Back चा प्रिव्ह्यू दिसेल.', 'Upload a PDF or Image (JPG/PNG) to preview Front and Back sides.')}
              </span>
            </div>
          </div>
        </div>

        {/* Live Preview Side (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-800 text-white">
            <h3 className="text-sm font-bold flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {t('कार्ड प्रिव्ह्यू व इन्स्टंट कटआउट्स', 'Live Card Cutouts Preview')}
              </span>
              <span className="text-xs font-mono text-amber-400">85.6 × 54.0 mm</span>
            </h3>

            {/* Front Preview */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  {t('Front Side (पुढील बाजू)', 'Front Side')}
                </span>
                <span className="text-[11px] text-slate-400">{t('मानक PVC माप', 'Standard CR80 Size')}</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center min-h-[140px]">
                <canvas ref={frontCanvasRef} width={450} height={284} className="w-full h-auto rounded-lg shadow-md" />
              </div>

              {cardReady && (
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium">{t('Front डाउनलोड:', 'Download Front:')}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('front', 'png')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400 border border-slate-700 cursor-pointer"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('front', 'jpg')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-400 border border-slate-700 cursor-pointer"
                  >
                    JPG
                  </button>
                </div>
              )}
            </div>

            {/* Back Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  {t('Back Side (मागील बाजू)', 'Back Side')}
                </span>
                <span className="text-[11px] text-slate-400">{t('मानक PVC माप', 'Standard CR80 Size')}</span>
              </div>
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center min-h-[140px]">
                <canvas ref={backCanvasRef} width={450} height={284} className="w-full h-auto rounded-lg shadow-md" />
              </div>

              {cardReady && (
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium">{t('Back डाउनलोड:', 'Download Back:')}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('back', 'png')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400 border border-slate-700 cursor-pointer"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('back', 'jpg')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-400 border border-slate-700 cursor-pointer"
                  >
                    JPG
                  </button>
                </div>
              )}
            </div>

            {/* Live Final Print Sheet Preview (4x6 Portrait / Selected Paper) */}
            {cardReady && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-200">
                  <span className="font-bold flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-amber-400" />
                    {t('तयार ४×६ / प्रिंट शीट प्रिव्ह्यू (Download Preview)', 'Final Print Sheet Preview')}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {sheetSize.toUpperCase()} • {sheetLayout === 'vertical' ? t('वर-खाली उभी', 'Portrait') : t('आडवी', 'Wide')}
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex items-center justify-center">
                  <canvas
                    ref={sheetPreviewCanvasRef}
                    className="max-h-[340px] w-auto h-auto rounded-lg shadow-xl border border-slate-700 bg-white"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 space-y-1.5">
              <p className="font-bold text-amber-300">{t('💡 प्रिंट व डाउनलोड सूचना:', '💡 Print & Export Tips:')}</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>
                  <strong className="text-white">{t('मॅन्युअल कट:', 'Manual Crop:')}</strong>{' '}
                  {t(
                    'जर कार्डचा एखादा कोपरा किंवा भाग कट होत असेल तर वर "स्वतःच्या हाताने कट करा" पर्याय निवडून बॉक्स ओढा.',
                    'Use "Manual Visual Crop" if your card edges need custom alignment.'
                  )}
                </li>
                <li>
                  <strong className="text-white">PDF:</strong>{' '}
                  {t('थेट प्रिंटरवर १:१ मापात ३०० DPI वर प्रिंट करण्यासाठी उत्तम.', 'Best for exact 1:1 300 DPI printer output.')}
                </li>
                <li>
                  <strong className="text-white">PNG / JPG:</strong>{' '}
                  {t('स्पष्ट एचडी इमेज व फोटो लॅब प्रिंटिंगसाठी.', 'Lossless HD images ready for studio lab printing.')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

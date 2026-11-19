import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  Upload,
  Printer,
  Download,
  Layers,
  Plus,
  Trash2,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Settings2,
  Scissors,
  FileText,
  Sparkles,
  Share2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  SunMedium,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Copy,
  ArrowRight,
  ShoppingBag,
  Info,
  RefreshCw,
  X,
  CreditCard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BulkCardItem, BulkCardConfig, BulkCardLayout } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction, trackFeatureOpen } from '../utils/analytics';
import { saveValidatedJsPdf } from '../utils/pdfCompat';
import { inspectUploadedFileBytes, releaseCanvasMemory } from '../utils/pdfSecurity';
import { getPageShareDetails } from '../utils/shareConfig';

// Standard Physical CR-80 Card Spec (ISO/IEC 7810 ID-1)
const CR80_WIDTH_MM = 85.6;
const CR80_HEIGHT_MM = 53.98; // ~54mm

// Standard A4 Paper Spec
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// 4x6 inch Paper Spec
const PHOTO_4X6_W_MM = 101.6;
const PHOTO_4X6_H_MM = 152.4;

export const BulkCardMaker: React.FC<{ onNavigateToSingleCutter?: () => void; onNavigateToStore?: () => void }> = ({
  onNavigateToSingleCutter,
  onNavigateToStore,
}) => {
  const { lang, t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const printContainerRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Card Queue
  const [cards, setCards] = useState<BulkCardItem[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Configuration
  const [config, setConfig] = useState<BulkCardConfig>({
    layout: 'a4-5cards',
    showCutMarks: true,
    showFoldingLine: true,
    showCornerRadius: false,
    foldingGapMm: 1.5, // 1.5 mm gap between front and back
    exportDpi: 300,
    outerBorderWidth: 0.4,
    alignMode: 'center',
    paperSize: 'a4',
  });

  // Pagination & Preview
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false);
  const [passwordAttemptFile, setPasswordAttemptFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState<string>('');

  // Cost & Profit Calculator State
  const [customerRatePerCard, setCustomerRatePerCard] = useState<number>(50); // ₹50 default
  const costPerCard = 10; // ₹10 (PVC Sheet + ink + lamination)

  // Track feature visit
  useEffect(() => {
    trackFeatureOpen('bulk-card');
  }, []);

  // Compute cards per page depending on layout
  const cardsPerPage = useMemo(() => {
    switch (config.layout) {
      case 'a4-5cards':
        return 5;
      case 'a4-10cards':
        return 10;
      case 'epson-tray':
        return 2;
      case '4x6-2cards':
        return 2;
      default:
        return 5;
    }
  }, [config.layout]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(cards.length / cardsPerPage));
  }, [cards.length, cardsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Helper to create high-resolution card canvas from dummy citizen data
  const createDemoCardCanvas = (
    citizenName: string,
    schemeName: string,
    idNumber: string,
    subText: string,
    side: 'front' | 'back',
    themeColor: string
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    // 300 DPI: 85.6mm = ~1011px, 54mm = ~638px
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (side === 'front') {
      // Header banner
      ctx.fillStyle = themeColor;
      ctx.fillRect(0, 0, canvas.width, 110);

      // Gold accent strip
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 110, canvas.width, 8);

      // Header text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(schemeName, canvas.width / 2, 60);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText('महाराष्ट्र शासन • अधिकृत ओळखपत्र', canvas.width / 2, 95);

      // Photo placeholder
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(50, 160, 240, 300);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.strokeRect(50, 160, 240, 300);

      // Silhouette head & shoulders
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(170, 270, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(170, 420, 80, Math.PI, 0);
      ctx.fill();

      // Citizen Details
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(citizenName, 320, 210);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('ओळख क्रमांक / ID Number:', 320, 260);

      ctx.font = 'bold 30px monospace';
      ctx.fillStyle = '#0284c7';
      ctx.fillText(idNumber, 320, 300);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(subText, 320, 350);

      // QR Code Box Placeholder
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(canvas.width - 230, 360, 170, 170);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(canvas.width - 220, 370, 150, 150);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(canvas.width - 210, 380, 40, 40);
      ctx.fillRect(canvas.width - 120, 380, 40, 40);
      ctx.fillRect(canvas.width - 210, 470, 40, 40);
      ctx.fillRect(canvas.width - 150, 430, 40, 40);

      // Bottom Bar
      ctx.fillStyle = themeColor;
      ctx.fillRect(0, canvas.height - 35, canvas.width, 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('महा कॉर्नर • स्मार्ट पीव्हीसी कार्ड सिस्टीम', canvas.width / 2, canvas.height - 12);
    } else {
      // Back side
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header strip
      ctx.fillStyle = themeColor;
      ctx.fillRect(0, 0, canvas.width, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('पत्ता व महत्त्वाच्या सूचना (Address & Guidelines)', canvas.width / 2, 34);

      // Address & info
      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('पत्ता (Address):', 60, 100);

      ctx.font = '22px sans-serif';
      ctx.fillText(`मु. पो. गाव, ता. जिल्हा - महाराष्ट्र, पिन कोड: ४१५००१`, 60, 140);
      ctx.fillText(`मोबाईल नं: ९८XXXXXX१२ | जारी दिनांक: ०१/०१/२०२६`, 60, 180);

      // Dotted terms box
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 220, canvas.width - 100, 260);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('१. हे ओळखपत्र सर्व शासकीय योजना व लाभांसाठी ग्राह्य मानले जाईल.', 70, 265);
      ctx.fillText('२. कार्ड हरवल्यास तात्काळ जवळच्या सीएससी केंद्राशी संपर्क साधावा.', 70, 310);
      ctx.fillText('३. बायोमेट्रिक पडताळणी किंवा e-KYC साठी हे कार्ड सोबत बाळगावे.', 70, 355);
      ctx.fillText('४. कोणत्याही मदतीसाठी १८००-१२०-८०४० या टोल फ्री क्रमांकावर कॉल करा.', 70, 400);

      // Barcode strip placeholder
      ctx.fillStyle = '#0f172a';
      for (let i = 60; i < canvas.width - 60; i += 8) {
        const barW = (i % 3 === 0 ? 5 : 2);
        ctx.fillRect(i, 510, barW, 65);
      }
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`*MC-${idNumber.replace(/\s+/g, '')}*`, canvas.width / 2, 605);
    }

    return canvas;
  };

  // 1-Click Load 5 Sample Cards
  const handleLoadSampleBatch = () => {
    setIsProcessing(true);
    setProcessingStatus(t('५ नमुना कार्डे लोड करत आहे...', 'Generating 5 sample citizen cards...'));

    setTimeout(() => {
      const samples: Array<{
        name: string;
        scheme: string;
        id: string;
        sub: string;
        type: BulkCardItem['cardType'];
        color: string;
      }> = [
        {
          name: 'रमेश विठ्ठल पाटील',
          scheme: 'आधार कार्ड (e-Aadhaar)',
          id: '७४५९ ८९०२ १४४०',
          sub: 'जन्म दिनांक: १५/०६/१९८४ • पुरुष',
          type: 'aadhaar',
          color: '#1e3a8a',
        },
        {
          name: 'सुनिता प्रकाश जाधव',
          scheme: 'आयुष्मान भारत कार्ड (PM-JAY)',
          id: 'MH-14-8902-1234',
          sub: 'कुटुंब प्रमुख • ५ लाख मोफत उपचार',
          type: 'ayushman',
          color: '#c2410c',
        },
        {
          name: 'दत्तात्रय मारुती शिंदे',
          scheme: 'शेतकरी ओळखपत्र (Kisan ID)',
          id: 'MH-AGRI-२०२६-०९१',
          sub: 'गट क्र. १४२/२ • बागायती शेती',
          type: 'farmer',
          color: '#15803d',
        },
        {
          name: 'विशाल संजय पवार',
          scheme: 'मतदार ओळखपत्र (EPIC Voter)',
          id: 'MH/४२/१२३४५६',
          sub: 'विधानसभा मतदारसंघ: बारामती',
          type: 'voter',
          color: '#0369a1',
        },
        {
          name: 'संभाजी एकनाथ मोरे',
          scheme: 'इमारत व बांधकाम कामगार',
          id: 'BOCW-२०२६-८९१२',
          sub: 'नोंदणीकृत बांधकाम कामगार स्मार्ट कार्ड',
          type: 'labour',
          color: '#b91c1c',
        },
      ];

      const newBatch: BulkCardItem[] = samples.map((s, idx) => {
        const frontCv = createDemoCardCanvas(s.name, s.scheme, s.id, s.sub, 'front', s.color);
        const backCv = createDemoCardCanvas(s.name, s.scheme, s.id, s.sub, 'back', s.color);
        return {
          id: `demo-${idx + 1}-${Date.now()}`,
          name: s.name,
          cardType: s.type,
          frontCanvas: frontCv,
          backCanvas: backCv,
          frontThumbnail: frontCv.toDataURL('image/jpeg', 0.8),
          backThumbnail: backCv.toDataURL('image/jpeg', 0.8),
          rotationFront: 0,
          rotationBack: 0,
          brightness: 0,
          contrast: 0,
          selected: true,
        };
      });

      setCards(newBatch);
      setActiveCardId(newBatch[0].id);
      setIsProcessing(false);
      setProcessingStatus('');

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }, 300);
  };

  // Handle Multi-file Upload (PDFs or Images)
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setIsProcessing(true);
    setProcessingStatus(t(`${files.length} फाईल्स तपासत आहे...`, `Processing ${files.length} files...`));

    const loadedCards: BulkCardItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingStatus(t(`फाईल ${i + 1}/${files.length} वाचत आहे (${file.name})...`, `Reading file ${i + 1}/${files.length} (${file.name})...`));

      try {
        const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
        const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type);
        if (!inspection.valid) continue;

        if (inspection.kind === 'pdf') {
          // Process PDF via PDF.js
          if (!window.pdfjsLib) {
            setProcessingStatus(t('PDF लायब्ररी लोड होत आहे...', 'Loading PDF engine...'));
            await new Promise((r) => setTimeout(r, 600));
          }

          const arrayBuf = await file.arrayBuffer();
          try {
            const loadingTask = window.pdfjsLib.getDocument({
              data: new Uint8Array(arrayBuf),
              password: pdfPassword || undefined,
            });
            const pdfDoc = await loadingTask.promise;

            if (pdfDoc.numPages >= 2) {
              // Page 1 is Front, Page 2 is Back
              const p1 = await pdfDoc.getPage(1);
              const p2 = await pdfDoc.getPage(2);
              const v1 = p1.getViewport({ scale: 3.0 });
              const v2 = p2.getViewport({ scale: 3.0 });

              const c1 = document.createElement('canvas');
              c1.width = Math.ceil(v1.width);
              c1.height = Math.ceil(v1.height);
              await p1.render({ canvasContext: c1.getContext('2d'), viewport: v1 }).promise;

              const c2 = document.createElement('canvas');
              c2.width = Math.ceil(v2.width);
              c2.height = Math.ceil(v2.height);
              await p2.render({ canvasContext: c2.getContext('2d'), viewport: v2 }).promise;

              loadedCards.push({
                id: `card-${Date.now()}-${i}`,
                name: file.name.replace(/\.[^.]+$/, ''),
                cardType: 'custom',
                frontCanvas: c1,
                backCanvas: c2,
                frontThumbnail: c1.toDataURL('image/jpeg', 0.8),
                backThumbnail: c2.toDataURL('image/jpeg', 0.8),
                rotationFront: 0,
                rotationBack: 0,
                brightness: 0,
                contrast: 0,
                selected: true,
              });
            } else if (pdfDoc.numPages === 1) {
              // Single page: split into left/right side or bottom card strip (standard Aadhaar)
              const p1 = await pdfDoc.getPage(1);
              const v1 = p1.getViewport({ scale: 3.0 });
              const fullCv = document.createElement('canvas');
              fullCv.width = Math.ceil(v1.width);
              fullCv.height = Math.ceil(v1.height);
              await p1.render({ canvasContext: fullCv.getContext('2d'), viewport: v1 }).promise;

              // Check if Aadhaar style (card in bottom 30%) or general side-by-side
              // By default, extract bottom strip: left half is front, right half is back
              const stripY = Math.floor(fullCv.height * 0.69);
              const stripH = Math.floor(fullCv.height * 0.28);
              const stripW = fullCv.width;

              const c1 = document.createElement('canvas');
              const c2 = document.createElement('canvas');
              const halfW = Math.floor(stripW / 2);

              c1.width = halfW;
              c1.height = stripH;
              const ctx1 = c1.getContext('2d');
              ctx1?.drawImage(fullCv, 0, stripY, halfW, stripH, 0, 0, halfW, stripH);

              c2.width = halfW;
              c2.height = stripH;
              const ctx2 = c2.getContext('2d');
              ctx2?.drawImage(fullCv, halfW, stripY, halfW, stripH, 0, 0, halfW, stripH);

              loadedCards.push({
                id: `card-${Date.now()}-${i}`,
                name: file.name.replace(/\.[^.]+$/, ''),
                cardType: 'aadhaar',
                frontCanvas: c1,
                backCanvas: c2,
                frontThumbnail: c1.toDataURL('image/jpeg', 0.8),
                backThumbnail: c2.toDataURL('image/jpeg', 0.8),
                rotationFront: 0,
                rotationBack: 0,
                brightness: 0,
                contrast: 0,
                selected: true,
              });
            }
          } catch (pdfErr: any) {
            if (pdfErr?.name === 'PasswordException') {
              setPasswordAttemptFile(file);
              setPasswordModalOpen(true);
            }
          }
        } else if (inspection.kind === 'image') {
          // Process Image File
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const cv = document.createElement('canvas');
                cv.width = img.naturalWidth || img.width;
                cv.height = img.naturalHeight || img.height;
                const ctx = cv.getContext('2d');
                ctx?.drawImage(img, 0, 0);

                // Split side-by-side
                const halfW = Math.floor(cv.width / 2);
                const c1 = document.createElement('canvas');
                const c2 = document.createElement('canvas');

                c1.width = halfW;
                c1.height = cv.height;
                c1.getContext('2d')?.drawImage(cv, 0, 0, halfW, cv.height, 0, 0, halfW, cv.height);

                c2.width = halfW;
                c2.height = cv.height;
                c2.getContext('2d')?.drawImage(cv, halfW, 0, halfW, cv.height, 0, 0, halfW, cv.height);

                loadedCards.push({
                  id: `img-${Date.now()}-${i}`,
                  name: file.name.replace(/\.[^.]+$/, ''),
                  cardType: 'custom',
                  frontCanvas: c1,
                  backCanvas: c2,
                  frontThumbnail: c1.toDataURL('image/jpeg', 0.8),
                  backThumbnail: c2.toDataURL('image/jpeg', 0.8),
                  rotationFront: 0,
                  rotationBack: 0,
                  brightness: 0,
                  contrast: 0,
                  selected: true,
                });
                resolve();
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          });
        }
      } catch (err) {
        console.warn('Error reading file:', file.name, err);
      }
    }

    if (loadedCards.length > 0) {
      setCards((prev) => [...prev, ...loadedCards]);
      if (!activeCardId) setActiveCardId(loadedCards[0].id);
      confetti({
        particleCount: 40,
        spread: 50,
      });
    }

    setIsProcessing(false);
    setProcessingStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Card Controls
  const rotateCardSide = (cardId: string, side: 'front' | 'back') => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        if (side === 'front') {
          const nextRot = (c.rotationFront + 90) % 360;
          return { ...c, rotationFront: nextRot };
        } else {
          const nextRot = (c.rotationBack + 90) % 360;
          return { ...c, rotationBack: nextRot };
        }
      })
    );
  };

  const swapFrontBack = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        return {
          ...c,
          frontCanvas: c.backCanvas,
          backCanvas: c.frontCanvas,
          frontThumbnail: c.backThumbnail,
          backThumbnail: c.frontThumbnail,
          rotationFront: c.rotationBack,
          rotationBack: c.rotationFront,
        };
      })
    );
  };

  const deleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (activeCardId === cardId) {
      setActiveCardId(null);
    }
  };

  const moveCard = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cards.length) return;
    const next = [...cards];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setCards(next);
  };

  const clearAllCards = () => {
    if (cards.length === 0) return;
    if (window.confirm(t('सर्व कार्डे बॅचमधून काढून टाकायची आहेत का?', 'Are you sure you want to clear all cards from the batch?'))) {
      cards.forEach((c) => {
        if (c.frontCanvas) releaseCanvasMemory(c.frontCanvas);
        if (c.backCanvas) releaseCanvasMemory(c.backCanvas);
      });
      setCards([]);
      setActiveCardId(null);
      setCurrentPage(1);
    }
  };

  // Draw Page on Canvas for Live Preview & Export
  const renderSheetCanvas = useCallback(
    (pageNumber: number, dpi: number = 200): HTMLCanvasElement => {
      const cv = document.createElement('canvas');

      // Calculate sheet dimensions in pixels
      const is4x6 = config.layout === '4x6-2cards';
      const sheetWmm = is4x6 ? PHOTO_4X6_W_MM : A4_WIDTH_MM;
      const sheetHmm = is4x6 ? PHOTO_4X6_H_MM : A4_HEIGHT_MM;

      const pxPerMm = (dpi / 25.4);
      cv.width = Math.round(sheetWmm * pxPerMm);
      cv.height = Math.round(sheetHmm * pxPerMm);

      const ctx = cv.getContext('2d');
      if (!ctx) return cv;

      // Pure white sheet background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Slice cards for this page
      const startIndex = (pageNumber - 1) * cardsPerPage;
      const pageCards = cards.slice(startIndex, startIndex + cardsPerPage);

      if (config.layout === 'a4-5cards') {
        // Standard 5 cards stacked vertically
        // Each row: Front on left, Back on right with folding line in center
        const cardWpx = CR80_WIDTH_MM * pxPerMm;
        const cardHpx = CR80_HEIGHT_MM * pxPerMm;
        const gapPx = config.foldingGapMm * pxPerMm;
        const pairWpx = cardWpx * 2 + gapPx;

        const leftMarginPx = (cv.width - pairWpx) / 2;
        const totalCardsHpx = 5 * cardHpx;
        const topMarginPx = (cv.height - totalCardsHpx) / 2;

        pageCards.forEach((card, idx) => {
          const rowY = topMarginPx + idx * cardHpx;
          const frontX = leftMarginPx;
          const backX = leftMarginPx + cardWpx + gapPx;

          // Helper to draw rotated side
          const drawSide = (source: HTMLCanvasElement | null, rot: number, x: number, y: number) => {
            if (!source) return;
            ctx.save();
            ctx.translate(x + cardWpx / 2, y + cardHpx / 2);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.drawImage(source, -cardWpx / 2, -cardHpx / 2, cardWpx, cardHpx);
            ctx.restore();
          };

          drawSide(card.frontCanvas, card.rotationFront, frontX, rowY);
          drawSide(card.backCanvas, card.rotationBack, backX, rowY);

          // Draw Cut marks / Border
          if (config.showCutMarks) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = Math.max(1, Math.round(config.outerBorderWidth * pxPerMm * 0.35));
            ctx.strokeRect(frontX, rowY, cardWpx, cardHpx);
            ctx.strokeRect(backX, rowY, cardWpx, cardHpx);
          }

          // Center Folding Line
          if (config.showFoldingLine) {
            ctx.save();
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const foldX = leftMarginPx + cardWpx + gapPx / 2;
            ctx.beginPath();
            ctx.moveTo(foldX, rowY);
            ctx.lineTo(foldX, rowY + cardHpx);
            ctx.stroke();
            ctx.restore();
          }

          // Card index number label in margin
          ctx.fillStyle = '#94a3b8';
          ctx.font = `${Math.round(10 * pxPerMm * 0.35)}px sans-serif`;
          ctx.textAlign = 'right';
          ctx.fillText(`Card ${startIndex + idx + 1}`, leftMarginPx - 10, rowY + 20);
        });
      } else if (config.layout === 'a4-10cards') {
        // 5 rows x 2 columns (10 individual cards)
        const cardWpx = CR80_WIDTH_MM * pxPerMm;
        const cardHpx = CR80_HEIGHT_MM * pxPerMm;
        const colGapPx = 8 * pxPerMm;
        const rowGapPx = 3 * pxPerMm;
        const gridWpx = cardWpx * 2 + colGapPx;
        const gridHpx = cardHpx * 5 + rowGapPx * 4;

        const leftMarginPx = (cv.width - gridWpx) / 2;
        const topMarginPx = (cv.height - gridHpx) / 2;

        pageCards.forEach((card, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = leftMarginPx + col * (cardWpx + colGapPx);
          const y = topMarginPx + row * (cardHpx + rowGapPx);

          if (card.frontCanvas) {
            ctx.save();
            ctx.translate(x + cardWpx / 2, y + cardHpx / 2);
            ctx.rotate((card.rotationFront * Math.PI) / 180);
            ctx.drawImage(card.frontCanvas, -cardWpx / 2, -cardHpx / 2, cardWpx, cardHpx);
            ctx.restore();
          }

          if (config.showCutMarks) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cardWpx, cardHpx);
          }
        });
      } else if (config.layout === 'epson-tray') {
        // Epson PVC Tray Mode (2 cards per tray)
        // Standard coordinates for dual tray: Slot 1 on top, Slot 2 on bottom
        const cardWpx = CR80_WIDTH_MM * pxPerMm;
        const cardHpx = CR80_HEIGHT_MM * pxPerMm;
        const slotGapPx = 40 * pxPerMm;
        const totalSlotsHpx = cardHpx * 2 + slotGapPx;
        const topMarginPx = (cv.height - totalSlotsHpx) / 2;
        const leftMarginPx = (cv.width - cardWpx) / 2;

        pageCards.slice(0, 2).forEach((card, idx) => {
          const y = topMarginPx + idx * (cardHpx + slotGapPx);
          if (card.frontCanvas) {
            ctx.drawImage(card.frontCanvas, leftMarginPx, y, cardWpx, cardHpx);
          }
          if (config.showCutMarks) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.strokeRect(leftMarginPx, y, cardWpx, cardHpx);
          }

          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Epson PVC Tray Slot ${idx + 1} (${card.name})`, cv.width / 2, y - 10);
        });
      }

      // Sheet Footer Information
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(11 * pxPerMm * 0.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `महा कॉर्नर बल्क PVC कार्ड मेकर • mahacorner.in • पान ${pageNumber} / ${totalPages} • स्केल: १००% अचूक`,
        cv.width / 2,
        cv.height - 15
      );

      return cv;
    },
    [config, cards, cardsPerPage, totalPages]
  );

  // Update Live Preview Canvas when state changes
  useEffect(() => {
    if (!previewCanvasRef.current) return;
    const targetCv = previewCanvasRef.current;
    const rendered = renderSheetCanvas(currentPage, 150); // fast preview DPI

    targetCv.width = rendered.width;
    targetCv.height = rendered.height;
    const ctx = targetCv.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, targetCv.width, targetCv.height);
      ctx.drawImage(rendered, 0, 0);
    }
  }, [currentPage, renderSheetCanvas]);

  // Export Master PDF (300 DPI Multi-page PDF via jsPDF)
  const handleDownloadMasterPdf = async () => {
    if (cards.length === 0) {
      alert(t('कृपया प्रथम कार्डे जोडा किंवा ५ नमुना कार्डे लोड करा.', 'Please add cards or load sample batch first.'));
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(t('३०० DPI मास्टर प्रिंट PDF तयार करत आहे...', 'Generating 300 DPI master print PDF...'));

    try {
      trackFeatureAction('bulk-card');

      const is4x6 = config.layout === '4x6-2cards';
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: is4x6 ? [PHOTO_4X6_W_MM, PHOTO_4X6_H_MM] : 'a4',
      });

      for (let p = 1; p <= totalPages; p++) {
        setProcessingStatus(t(`पान ${p}/${totalPages} तयार करत आहे...`, `Rendering page ${p}/${totalPages}...`));
        if (p > 1) {
          pdf.addPage(is4x6 ? [PHOTO_4X6_W_MM, PHOTO_4X6_H_MM] : 'a4', 'portrait');
        }

        const pageCanvas = renderSheetCanvas(p, config.exportDpi);
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.96);
        const wMm = is4x6 ? PHOTO_4X6_W_MM : A4_WIDTH_MM;
        const hMm = is4x6 ? PHOTO_4X6_H_MM : A4_HEIGHT_MM;

        pdf.addImage(imgData, 'JPEG', 0, 0, wMm, hMm, undefined, 'FAST');
        releaseCanvasMemory(pageCanvas);
      }

      const fileName = `MahaCorner_Bulk_Cards_${config.layout}_${Date.now()}.pdf`;
      await saveValidatedJsPdf(pdf, fileName, totalPages);

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert(t('PDF डाऊनलोड करताना त्रुटी आली.', 'Error generating PDF. Please try again.'));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Export High-Res PNG Sheets as ZIP
  const handleDownloadZip = async () => {
    if (cards.length === 0) return;
    setIsProcessing(true);
    setProcessingStatus(t('सर्व शीट्स ZIP मध्ये पॅक करत आहे...', 'Creating ZIP with high-res PNG sheets...'));

    try {
      const zip = new JSZip();
      for (let p = 1; p <= totalPages; p++) {
        const pageCanvas = renderSheetCanvas(p, config.exportDpi);
        const blob = await new Promise<Blob | null>((res) => pageCanvas.toBlob(res, 'image/png'));
        if (blob) {
          zip.file(`Sheet_Page_${p}.png`, blob);
        }
        releaseCanvasMemory(pageCanvas);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MahaCorner_Bulk_Cards_Sheets_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1500);

      confetti({
        particleCount: 50,
        spread: 60,
      });
    } catch (err) {
      console.error('ZIP export error:', err);
      alert(t('ZIP तयार करताना त्रुटी आली.', 'Error generating ZIP.'));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // 100% Scale Direct Browser Print
  const handleBrowserPrint = () => {
    if (cards.length === 0) {
      alert(t('कृपया प्रथम कार्डे जोडा किंवा ५ नमुना कार्डे लोड करा.', 'Please add cards first.'));
      return;
    }
    trackFeatureAction('bulk-card');
    window.print();
  };

  // WhatsApp Share (Exact PmfbyCalculator style)
  const handleShareWhatsApp = () => {
    const details = getPageShareDetails('bulk-card', lang);
    window.open(details.whatsappUrl, '_blank');
  };

  // Calculations for operator earnings
  const calculatedSheets = Math.ceil(cards.length / cardsPerPage) || 1;
  const totalCustomerFee = cards.length * customerRatePerCard;
  const totalCost = cards.length * costPerCard;
  const netProfit = totalCustomerFee - totalCost;

  return (
    <div className="space-y-6">
      {/* Hidden container for 100% scale CSS browser printing */}
      <div id="bulk-card-print-container" className="hidden print:block">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              #root > div > header,
              #root > div > main > div:not(#bulk-card-print-container),
              #root > div > footer,
              .no-print {
                display: none !important;
              }
              .bulk-print-page {
                width: 210mm !important;
                height: 297mm !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
              }
              .bulk-print-page img {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
              }
            }
          `
        }} />

        {Array.from({ length: totalPages }).map((_, pIdx) => {
          const cv = renderSheetCanvas(pIdx + 1, 300);
          const dataUrl = cv.toDataURL('image/jpeg', 0.98);
          return (
            <div key={pIdx} className="bulk-print-page">
              <img src={dataUrl} alt={`Page ${pIdx + 1}`} />
            </div>
          );
        })}
      </div>

      {/* Hero Banner */}
      <div className="no-print rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-black">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t('बल्क PVC कार्ड प्रिंटर (Bulk PVC Maker)', 'Bulk PVC Card Maker')}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                ⚡ १० पट वेळेची बचत
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                🪪 A4 वर ५ कार्डे • Epson ट्रे रेडी
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              {t('एकाच वेळी अनेक कार्डे A4 शीटवर सेट करा', 'Print Multiple PVC Cards on A4 Sheets')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300">
                {t('आधार, आयुष्यमान, शेतकरी व मतदार ओळखपत्रे १-क्लिक प्रिंट', 'Aadhaar, Ayushman & Farmer IDs in 1-Click')}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                'गावात किंवा केंद्रावर एकाच वेळी १०-२० लोकांची कार्डे प्रिंट करायची असतील, तर सुटसुटीत A4 ५-कार्ड शीट (Front डावीकडे, Back उजवीकडे + फोल्डिंग लाईन) किंवा Epson PVC ट्रेवर अचूक ८५.६ मिमी मापात प्रिंट करा.',
                'Process batches of Aadhaar, Ayushman, and Farmer ID cards on standard A4 5-card sheets or dual Epson PVC trays with exact millimeter precision.'
              )}
            </p>
          </div>

          {/* Quick CTA Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={handleLoadSampleBatch}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('🧪 ५ नमुना कार्डे लोड करा (झटपट टेस्ट)', '🧪 Load 5 Sample Cards (Instant Test)')}</span>
            </button>

            {onNavigateToSingleCutter && (
              <button
                type="button"
                onClick={onNavigateToSingleCutter}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>{t('✂️ फक्त १ कार्ड कट करायचे आहे? (Single Cutter)', '✂️ Switch to Single Card Cutter')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Controls (Upload & Queue) + Right Live Preview & Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left Column: Upload, Queue, Layout Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Multi-file Upload Box */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>{t('१. कार्डे अपलोड करा (PDF किंवा Images)', '1. Upload Cards (PDF or Images)')}</span>
              </div>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                Multi-File Support
              </span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-600 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">
                  {t('इथे क्लिक करून एकाच वेळी अनेक PDF किंवा इमेज निवडा', 'Click to choose multiple PDFs or images')}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('e-Aadhaar, Ayushman, Farmer ID, Voter ID किंवा स्कॅन केलेले कार्ड', 'Supports e-Aadhaar, Ayushman, Farmer ID, Voter ID')}
                </p>
              </div>
            </div>

            {/* Quick Helper / Demo Prompt */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 font-medium">
                {t(`सध्या बॅचमध्ये: ${cards.length} कार्डे`, `Current Batch: ${cards.length} cards`)}
              </span>
              {cards.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllCards}
                  className="text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('सर्व पुसा', 'Clear All')}</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Layout Settings */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                <Settings2 className="w-4 h-4 text-amber-600" />
                <span>{t('२. प्रिंट मांडणी व कागद (Layout & Sheet)', '2. Layout & Sheet Setup')}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                CR-80 (८५.६ × ५४ मिमी)
              </span>
            </div>

            {/* Layout Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {t('शीटचा प्रकार निवडा:', 'Select Sheet Layout:')}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'a4-5cards' })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    config.layout === 'a4-5cards'
                      ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <span>📄 A4 - ५ कार्डे</span>
                    </span>
                    {config.layout === 'a4-5cards' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('Front डावीकडे + Back उजवीकडे (CSC स्टँडर्ड फोल्डिंग)', 'Front Left + Back Right with Center Fold')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'a4-10cards' })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    config.layout === 'a4-10cards'
                      ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <span>📑 A4 - १० कार्डे</span>
                    </span>
                    {config.layout === 'a4-10cards' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('५×२ ग्रीड (Dragon Sheet / सिंगल साइड पीव्हीसी)', '5x2 Grid Single Sided / PVC Dragon Sheets')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'epson-tray' })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    config.layout === 'epson-tray'
                      ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span>🪪 Epson PVC ट्रे</span>
                    </span>
                    {config.layout === 'epson-tray' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('L805 / L8050 २-कार्ड ट्रे स्लॉट्स', 'Epson L805/L8050 2-Card Tray Template')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: '4x6-2cards' })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    config.layout === '4x6-2cards'
                      ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <span>🖼️ 4×6 फोटो पेपर</span>
                    </span>
                    {config.layout === '4x6-2cards' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-600 block leading-tight font-medium">
                    {t('१ कार्ड Front+Back किंवा २ कार्डे', '1 Card Front+Back or 2 Cards')}
                  </span>
                </button>
              </div>
            </div>

            {/* Toggle checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.showCutMarks}
                  onChange={(e) => setConfig({ ...config, showCutMarks: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <span>{t('कटींग बॉर्डर्स दाखवा', 'Show Cut Border Lines')}</span>
              </label>

              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.showFoldingLine}
                  onChange={(e) => setConfig({ ...config, showFoldingLine: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <span>{t('मध्यभागी फोल्डिंग लाईन', 'Show Center Folding Line')}</span>
              </label>
            </div>

            {/* Folding gap selector */}
            {config.layout === 'a4-5cards' && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  {t('Front व Back मधील अंतर (Gap):', 'Gap Between Front & Back:')}
                </span>
                <select
                  value={config.foldingGapMm}
                  onChange={(e) => setConfig({ ...config, foldingGapMm: parseFloat(e.target.value) })}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white"
                >
                  <option value="0">0 mm (थेट चिकटवून)</option>
                  <option value="1">1.0 mm (बारीक अंतर)</option>
                  <option value="1.5">1.5 mm (शिफारस केलेले)</option>
                  <option value="2">2.0 mm (जाड लॅमिनेशनसाठी)</option>
                </select>
              </div>
            )}
          </div>

          {/* 3. Card Queue List */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>{t(`३. कार्ड्सची यादी (${cards.length} कार्डे)`, `3. Cards Queue (${cards.length} Cards)`)}</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                पान {currentPage} / {totalPages}
              </span>
            </div>

            {cards.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <Layers className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">
                  {t('सध्या कोणतेही कार्ड जोडलेले नाही.', 'No cards added in queue yet.')}
                </p>
                <button
                  type="button"
                  onClick={handleLoadSampleBatch}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer"
                >
                  {t('५ नमुना कार्डे लोड करून पहा →', 'Load 5 sample cards to test →')}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {cards.map((card, idx) => (
                  <div
                    key={card.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      activeCardId === card.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Small Previews of Front & Back */}
                      <div className="flex items-center gap-1 shrink-0">
                        <img
                          src={card.frontThumbnail}
                          alt="Front"
                          className="w-10 h-6 object-cover rounded-sm border border-slate-300 shadow-xs"
                        />
                        <img
                          src={card.backThumbnail}
                          alt="Back"
                          className="w-10 h-6 object-cover rounded-sm border border-slate-300 shadow-xs"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {card.name}
                        </p>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">
                          {card.cardType}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons per card */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => rotateCardSide(card.id, 'front')}
                        title={t('Front ९०° फिरवा', 'Rotate Front 90°')}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => swapFrontBack(card.id)}
                        title={t('Front व Back उलटा करा', 'Swap Front and Back')}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteCard(card.id)}
                        title={t('कार्ड काढून टाका', 'Delete Card')}
                        className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Sheet Preview & Export Hub (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sheet Preview Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            {/* Header with Pagination Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  <span>{t('लाइव्ह शीट प्रिव्ह्यू (Live Print Sheet Preview)', 'Live Print Sheet Preview')}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    'कागदावर प्रत्यक्ष प्रिंट कसे निघेल ते पहा (स्केल: १००% ओरिजिनल अचूक)',
                    'Exact 1:1 preview of printable output'
                  )}
                </p>
              </div>

              {/* Page Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <span className="text-xs font-bold text-slate-800 px-2">
                  {t(`पान ${currentPage} / ${totalPages}`, `Page ${currentPage} of ${totalPages}`)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </button>
              </div>
            </div>

            {/* Interactive Preview Canvas */}
            <div className="bg-slate-100/80 rounded-2xl p-4 flex items-center justify-center border border-slate-200/80 overflow-hidden min-h-[380px] sm:min-h-[480px]">
              <div className="bg-white shadow-2xl rounded-sm border border-slate-300 max-h-[500px] max-w-full overflow-hidden flex items-center justify-center transition-transform">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[480px] max-w-full object-contain"
                />
              </div>
            </div>

            {/* Print Scale Alert */}
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('💡 अचूक मापासाठी महत्त्वाची टीप:', '💡 Important Print Tip:')}</strong>{' '}
                {t(
                  'प्रिंटरच्या सेटिंग्जमध्ये Scale: "100% / Default" ठेवा ("Fit to Page" किंवा "Shrink to fit" करू नका). यामुळे सर्व कार्ड्सचे माप अचूक ८५.६ × ५४ मिमी येईल.',
                  'Set printer scale to 100% / Default. Do NOT use "Fit to paper" to maintain exact 85.6mm card width.'
                )}
              </div>
            </div>

            {/* 4. EXPORT & PRINT BUTTONS HUB */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleBrowserPrint}
                disabled={cards.length === 0 || isProcessing}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>{t('🖨️ थेट प्रिंट करा', 'Print All (100%)')}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMasterPdf}
                disabled={cards.length === 0 || isProcessing}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-rose-500/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{t('📄 मास्टर PDF डाउनलोड', 'Master PDF (300 DPI)')}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={cards.length === 0 || isProcessing}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('📦 सर्व शीट्स ZIP', 'Download PNG ZIP')}</span>
              </button>
            </div>

            {/* Direct WhatsApp Share (Like PmfbyCalculator) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
                title={t('WhatsApp वर हे टूल शेअर करा', 'Share this tool on WhatsApp')}
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
                </svg>
                <span>{t('📲 हे टूल WhatsApp वर इतर CSC चालकांना पाठवा', 'Share this tool on WhatsApp')}</span>
              </button>
            </div>
          </div>

          {/* 5. Operator Economics & Profit Calculator */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-white rounded-3xl p-5 border border-emerald-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-emerald-950 text-sm sm:text-base">
                <span>💰</span>
                <span>{t('सीएससी केंद्राची कमाई व नफा कॅल्क्युलेटर', 'Operator Earnings & Profit Calculator')}</span>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                {cards.length} कार्डे बॅच
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('एकूण कार्डे', 'Total Cards')}</span>
                <span className="text-lg font-black text-slate-900">{cards.length}</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('लागणारी A4 शीट्स', 'A4 Sheets Needed')}</span>
                <span className="text-lg font-black text-indigo-700">{calculatedSheets} शीट्स</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('अंदाजे खर्च (₹१०/कार्ड)', 'Estimated Cost')}</span>
                <span className="text-lg font-black text-rose-600">₹{totalCost}</span>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md">
                <span className="text-[10px] text-emerald-100 block font-bold">{t('निव्वळ नफा (Net Profit)', 'Net Profit')}</span>
                <span className="text-lg font-black text-amber-300">₹{netProfit}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-xs text-slate-700 border-t border-emerald-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t('प्रति कार्ड ग्राहक दर:', 'Rate Charged to Customer:')}</span>
                <div className="flex items-center gap-1 font-bold">
                  {[30, 50, 70].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setCustomerRatePerCard(rate)}
                      className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                        customerRatePerCard === rate
                          ? 'bg-emerald-700 text-white font-black'
                          : 'bg-white border border-emerald-200 text-slate-700'
                      }`}
                    >
                      ₹{rate}
                    </button>
                  ))}
                </div>
              </div>

              {onNavigateToStore && (
                <button
                  type="button"
                  onClick={onNavigateToStore}
                  className="inline-flex items-center gap-1.5 font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{t('कोरी PVC कार्डे व साहित्य मागवा →', 'Buy Blank PVC Cards & Supplies →')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Modal if encrypted PDF is uploaded */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                <Lock className="w-5 h-5 text-amber-600" />
                <span>{t('पासवर्ड आवश्यक आहे', 'Password Required')}</span>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t(
                'ही PDF पासवर्डने सुरक्षित आहे (उदा. e-Aadhaar पासवर्ड: नावातील पहिली ४ अक्षरे CAPITAL + जन्मवर्ष, उदा. RAME1984).',
                'This PDF is password protected (e.g. e-Aadhaar: First 4 letters of name in CAPITAL + 4-digit Birth Year).'
              )}
            </p>

            <input
              type="text"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              placeholder="उदा. RAME1984"
              className="w-full h-11 px-4 rounded-xl border border-slate-300 font-mono text-sm tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {t('रद्द करा', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordModalOpen(false);
                  if (passwordAttemptFile) {
                    handleFilesSelected([passwordAttemptFile] as any);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                {t('अनलॉक करा व जोडा', 'Unlock & Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Download,
  Printer,
  Upload,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  FileText,
  User,
  Phone,
  MapPin,
  Building,
  Sprout,
  Image as ImageIcon,
  FileImage,
  Share2,
  Smartphone,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { FarmerCardData } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink } from '../utils/shareConfig';
import { saveValidatedJsPdf } from '../utils/pdfCompat';
import { escapeHtml, inspectUploadedFileBytes, PDF_SECURITY_LIMITS, releaseCanvasMemory } from '../utils/pdfSecurity';

const CARD_THEMES = [
  {
    id: 'agro-green',
    name: '🌾 समृद्ध शेतकरी (Agro Green)',
    nameEn: '🌾 Agro Green (Prosperous Farmer)',
    primary: '#075b32',
    secondary: '#14532d',
    headerBg: '#054727',
    gold: '#f59e0b',
    accent: '#dcfce7',
    cardBg: '#ffffff',
  },
  {
    id: 'royal-navy',
    name: '🏛️ महा कृषी सुवर्ण (Royal Navy)',
    nameEn: '🏛️ Maha Krishi Gold (Royal Navy)',
    primary: '#123c5a',
    secondary: '#1e3a8a',
    headerBg: '#0f2f47',
    gold: '#fcd34d',
    accent: '#e0f2fe',
    cardBg: '#ffffff',
  },
  {
    id: 'apmc-gold',
    name: '🚜 बाजार समिती विशेष (APMC Saffron)',
    nameEn: '🚜 APMC Market Special (Saffron)',
    primary: '#9a3412',
    secondary: '#c2410c',
    headerBg: '#7c2d12',
    gold: '#fbbf24',
    accent: '#ffedd5',
    cardBg: '#ffffff',
  },
  {
    id: 'modern-teal',
    name: '🌿 आधुनिक कृषी (Modern Teal)',
    nameEn: '🌿 Modern Krishi (Teal)',
    primary: '#0f766e',
    secondary: '#115e59',
    headerBg: '#134e4a',
    gold: '#f59e0b',
    accent: '#ccfbf1',
    cardBg: '#ffffff',
  },
];

const INITIAL_DATA: FarmerCardData = {
  fullName: 'श्री. सचिन तुकाराम पाटील',
  farmerId: 'MH-AGRI-2025-78421',
  aadhaarNo: 'XXXX XXXX 7842',
  mobileNo: '+917972123605',
  dob: '15/06/1984',
  gender: 'पुरुष / Male',
  bloodGroup: 'O+',
  village: 'शिरोळ',
  taluka: 'शिरोळ',
  district: 'कोल्हापूर',
  state: 'महाराष्ट्र',
  pincode: '416103',
  gatNo: '२४१ / ३-अ',
  khataNo: '५४२',
  landArea: '२ हेक्टर ४० आर (६ एकर)',
  landType: 'बागायत (बागायती जमीन)',
  issueDate: new Date().toLocaleDateString('mr-IN'),
  validity: 'आजीवन / Lifetime',
  cardTheme: 'agro-green',
  photoUrl: null,
  signatureUrl: null,
  includeWatermark: true,
};

export const FarmerCardMaker: React.FC = () => {
  const { lang, t } = useLanguage();
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<FarmerCardData>(INITIAL_DATA);
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [qrCanvas, setQrCanvas] = useState<HTMLCanvasElement | null>(null);

  const [sheetFormat, setSheetFormat] = useState<'4x6' | 'a4'>('4x6');
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'png' | 'jpg' | 'webp'>('pdf');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Generate QR Code canvas whenever card data changes (Zero website branding on the card)
  useEffect(() => {
    const generateQr = async () => {
      try {
        const qrData = `शेतकरी ओळखपत्र (FARMER ID CARD)\nनाव: ${formData.fullName}\nआयडी: ${formData.farmerId}\nआधार: ${formData.aadhaarNo}\nमोबाईल: ${formData.mobileNo}\nगाव: ${formData.village}, ता. ${formData.taluka}, जि. ${formData.district}\nगट क्र.: ${formData.gatNo} | क्षेत्र: ${formData.landArea}\nखाते क्र.: ${formData.khataNo}\nनोंदणी: शेतकरी वैयक्तिक शेती तपशील`;
        const cv = document.createElement('canvas');
        await QRCode.toCanvas(cv, qrData, {
          width: 250,
          margin: 1,
          color: {
            dark: '#14532d',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
        setQrCanvas(cv);
      } catch (e) {
        console.error('QR generation failed:', e);
      }
    };
    generateQr();
  }, [formData]);

  // Handle Input Changes
  const handleChange = (field: keyof FarmerCardData, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  // Generate Random Farmer ID
  const generateNewId = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    handleChange('farmerId', `MH-AGRI-2025-${randomNum}`);
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
        setStatusMessage(t('फोटो २० MB पेक्षा लहान असावा.', 'Photo must be under 20 MB.'));
        return;
      }
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'image');
      if (!inspection.valid || inspection.kind !== 'image') {
        setStatusMessage(t('कृपया वैध फोटो (JPG/PNG/WEBP) निवडा.', 'Please select a valid photo (JPG/PNG/WEBP).'));
        return;
      }
    } catch {
      setStatusMessage(t('फोटो तपासताना त्रुटी आली.', 'Could not verify photo file.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        setPhotoImage(img);
        handleChange('photoUrl', img.src);
      };
    };
    reader.readAsDataURL(file);
  };

  // Fill Sample Data Demo
  const handleLoadDemo = () => {
    setFormData(INITIAL_DATA);
    setPhotoImage(null);
  };

  // Helper rounded box
  const roundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string,
    stroke?: string,
    lineWidth: number = 2
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  };

  // Helper to draw authentic Krishi / Agricultural Emblem (Zero website branding)
  const drawKrishiEmblem = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    goldColor: string = '#fcd34d'
  ) => {
    ctx.save();
    // Outer circle with subtle drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    // Outer gold rim
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner deep green disc
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
    const discGrad = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy, radius - 6);
    discGrad.addColorStop(0, '#166534');
    discGrad.addColorStop(1, '#052e16');
    ctx.fillStyle = discGrad;
    ctx.fill();

    // Subtle sun rays
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + Math.cos(angle) * (radius - 12), cy - 6 + Math.sin(angle) * (radius - 12));
      ctx.stroke();
    }

    // Rising Sun
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 11, Math.PI, 0, false);
    ctx.fillStyle = '#fde047';
    ctx.fill();

    // Center Sprout (अंकुर)
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(cx - 7, cy + 4, 6, 11, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 7, cy + 4, 6, 11, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 5, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden Wheat Ears (कणीस)
    ctx.fillStyle = '#fef08a';
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < 4; k++) {
        const grainY = cy - 12 + k * 8;
        const grainX = cx + s * (radius - 18 - (k === 0 || k === 3 ? 3 : 0));
        ctx.beginPath();
        ctx.ellipse(grainX, grainY, 3, 5, (s * Math.PI) / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bottom gold badge text "कृषी"
    ctx.beginPath();
    ctx.arc(cx, cy + radius - 15, 14, 0, Math.PI);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11px "Noto Sans Devanagari", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('कृषी', cx, cy + radius - 11);

    ctx.restore();
  };

  // Helper to draw authentic Krishi watermark on background (Zero website branding)
  const drawKrishiWatermark = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Center Sprout in Watermark
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(cx - 45, cy, 35, 75, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 45, cy, 35, 75, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20, 30, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Draw Front Card Canvas
  const drawFrontCard = useCallback(() => {
    const canvas = frontCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Standard CR80 Card Dimensions: 1011 × 638 px (300 DPI for 85.6 × 54.0 mm)
    const w = 1011;
    const h = 638;
    canvas.width = w;
    canvas.height = h;

    const theme = CARD_THEMES.find((t) => t.id === formData.cardTheme) || CARD_THEMES[0];

    // 1. Card Base Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Subtle background pattern or agro grain gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.7, '#fafdf9');
    bgGrad.addColorStop(1, '#f0fdf4');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Krishi Watermark in background (No website logos)
    if (formData.includeWatermark) {
      drawKrishiWatermark(ctx, w / 2, h / 2, 340);
    }

    // 2. Header Bar
    const headerH = 138;
    const hGrad = ctx.createLinearGradient(0, 0, w, 0);
    hGrad.addColorStop(0, theme.headerBg);
    hGrad.addColorStop(0.5, theme.primary);
    hGrad.addColorStop(1, theme.headerBg);
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, w, headerH);

    // Gold decorative stripe under header
    ctx.fillStyle = theme.gold;
    ctx.fillRect(0, headerH, w, 6);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, headerH + 6, w, 2);

    // Official Krishi Emblem on Left (Replaced website logo with official agricultural emblem)
    drawKrishiEmblem(ctx, 75, headerH / 2, 50, theme.gold);

    // Header Titles
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 29px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('महाराष्ट्र राज्य • शेतकरी ओळखपत्र', w / 2 + 35, 46);

    ctx.fillStyle = theme.gold;
    ctx.font = '800 24px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('FARMER IDENTITY CARD (कृषी विभाग)', w / 2 + 35, 82);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('शासकीय योजना, कृषी बाजार समिती व अनुदानासाठी ग्राह्य', w / 2 + 35, 114);

    // 3. Farmer Photo Box
    const photoX = 40;
    const photoY = 175;
    const photoW = 210;
    const photoH = 265;

    roundedRect(ctx, photoX, photoY, photoW, photoH, 12, '#f8fafc', theme.primary, 3);

    if (photoImage) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX + 2, photoY + 2, photoW - 4, photoH - 4, 10);
      ctx.clip();
      ctx.drawImage(photoImage, photoX + 2, photoY + 2, photoW - 4, photoH - 4);
      ctx.restore();
    } else {
      // Photo Placeholder Icon
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(photoX + 2, photoY + 2, photoW - 4, photoH - 4);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 18px "Noto Sans Devanagari", sans-serif';
      ctx.fillText('शेतकऱ्याचा फोटो', photoX + photoW / 2, photoY + photoH / 2 - 15);
      ctx.font = '500 14px "Noto Sans Devanagari", sans-serif';
      ctx.fillText('(Photo Here)', photoX + photoW / 2, photoY + photoH / 2 + 15);
    }

    // "प्रमाणित" (Verified) badge on photo corner
    roundedRect(ctx, photoX + 15, photoY + photoH - 32, photoW - 30, 26, 6, '#15803d', '#ffffff', 1.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('✓ प्रमाणित शेतकरी', photoX + photoW / 2, photoY + photoH - 15);

    // 4. Farmer Details Body
    const textStartX = 280;
    let currY = 188;

    // Full Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 15px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('शेतकऱ्याचे संपूर्ण नाव / FARMER NAME:', textStartX, currY);

    currY += 28;
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(formData.fullName || 'शेतकऱ्याचे नाव', textStartX, currY);

    // Farmer ID Badge
    currY += 36;
    roundedRect(ctx, textStartX, currY - 22, 410, 36, 8, theme.accent, theme.primary, 1.5);
    ctx.fillStyle = theme.primary;
    ctx.font = '800 17px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(`आयडी: ${formData.farmerId}`, textStartX + 14, currY + 2);

    // Details Grid Lines
    const renderFieldRow = (label1: string, val1: string, label2: string, val2: string, yPos: number) => {
      // Col 1
      ctx.fillStyle = '#64748b';
      ctx.font = '700 15px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(label1, textStartX, yPos);
      ctx.fillStyle = '#1e293b';
      ctx.font = '800 17px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(val1, textStartX + 125, yPos);

      // Col 2
      const col2X = textStartX + 360;
      ctx.fillStyle = '#64748b';
      ctx.font = '700 15px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(label2, col2X, yPos);
      ctx.fillStyle = '#1e293b';
      ctx.font = '800 17px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(val2, col2X + 115, yPos);
    };

    currY += 46;
    renderFieldRow('आधार क्र.:', formData.aadhaarNo, 'मोबाईल:', formData.mobileNo, currY);

    currY += 36;
    renderFieldRow('जन्म तारीख:', formData.dob, 'रक्तगट:', formData.bloodGroup || 'N/A', currY);

    currY += 36;
    renderFieldRow('गाव / शहर:', formData.village, 'तालुका:', formData.taluka, currY);

    currY += 36;
    renderFieldRow('जिल्हा:', formData.district, 'राज्य:', formData.state, currY);

    // Hologram Gold Seal in bottom-right
    const sealX = w - 120;
    const sealY = h - 145;
    const sealR = 48;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
    const goldGrad = ctx.createRadialGradient(sealX - 10, sealY - 10, 5, sealX, sealY, sealR);
    goldGrad.addColorStop(0, '#fffbeb');
    goldGrad.addColorStop(0.5, '#fbbf24');
    goldGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = goldGrad;
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350f';
    ctx.font = '800 12px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('★ KISAN ★', sealX, sealY - 14);
    ctx.font = '900 15px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('VERIFIED', sealX, sealY + 4);
    ctx.font = '700 11px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('SEAL', sealX, sealY + 20);
    ctx.restore();

    // 5. Card Footer Bar (Zero website branding)
    const footerH = 48;
    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, h - footerH, w, footerH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('महाराष्ट्र राज्य शेतकरी नोंदणी ओळखपत्र  |  वैयक्तिक शेती तपशील व अभिलेख', w / 2, h - footerH / 2 + 5);

    // Outer Precision Border
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  }, [formData, photoImage]);

  // Draw Back Card Canvas
  const drawBackCard = useCallback(() => {
    const canvas = backCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 1011;
    const h = 638;
    canvas.width = w;
    canvas.height = h;

    const theme = CARD_THEMES.find((t) => t.id === formData.cardTheme) || CARD_THEMES[0];

    // Card Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Krishi Watermark in background (No website logos)
    if (formData.includeWatermark) {
      drawKrishiWatermark(ctx, w / 2, h / 2, 340);
    }

    // Header
    const headerH = 75;
    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, 0, w, headerH);
    ctx.fillStyle = theme.gold;
    ctx.fillRect(0, headerH, w, 5);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('जमीन, ७/१२ खाते व शेती तपशील (FARM & 7/12 DETAILS)', w / 2, 46);

    // Two Column Body Layout
    // Left Column: Land & Farm Details
    const leftX = 40;
    let bY = 125;

    const renderDetailBox = (label: string, val: string, width: number = 620) => {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      roundedRect(ctx, leftX, bY - 22, width, 48, 8, '#f8fafc', '#cbd5e1', 1.5);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '700 15px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(label, leftX + 16, bY + 6);

      ctx.fillStyle = '#0f172a';
      ctx.font = '800 17px "Noto Sans Devanagari", sans-serif';
      ctx.fillText(val || '-', leftX + 220, bY + 6);

      bY += 64;
    };

    renderDetailBox('गट / सर्व्हे क्र.:', formData.gatNo);
    renderDetailBox('७/१२ खाते क्रमांक:', formData.khataNo);
    renderDetailBox('एकूण जमीन क्षेत्र:', formData.landArea);
    renderDetailBox('जमिनीचा प्रकार:', formData.landType);
    renderDetailBox('गाव व तालुका:', `मु. पो. ${formData.village}, ता. ${formData.taluka}`);
    renderDetailBox('जिल्हा व राज्य:', `जि. ${formData.district} - ${formData.pincode} (${formData.state})`);

    // Right Column: QR Code + Authorized Signatory
    const qrX = 710;
    const qrY = 110;

    // QR Box
    roundedRect(ctx, qrX, qrY, 260, 290, 14, '#ffffff', theme.primary, 2);

    if (qrCanvas) {
      ctx.drawImage(qrCanvas, qrX + 15, qrY + 15, 230, 230);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.primary;
    ctx.font = '800 14px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('डिजिटल पडताळणी QR कोड', qrX + 130, qrY + 270);

    // Validity & Issue Info Below QR
    const infoY = 430;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 14px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(`निर्गमित तारीख: ${formData.issueDate}`, qrX, infoY);
    ctx.fillText(`वैधता: ${formData.validity}`, qrX, infoY + 24);

    // Authorized Seal & Sign
    const signBoxX = qrX;
    const signBoxY = infoY + 40;
    roundedRect(ctx, signBoxX, signBoxY, 260, 52, 6, '#f8fafc', '#cbd5e1', 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#15803d';
    ctx.font = '800 15px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('✓ अधिकृत स्वाक्षरी / डिजिटल सील', signBoxX + 130, signBoxY + 32);

    // Footer Disclaimer Bar - Explicit User Disclaimer Notice
    const footerH = 64;
    ctx.fillStyle = '#fff7ed'; // Soft amber/warning tint
    ctx.fillRect(0, h - footerH, w, footerH);
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h - footerH);
    ctx.lineTo(w, h - footerH);
    ctx.stroke();

    // Corner Warning Badge
    roundedRect(ctx, 20, h - footerH + 14, 88, 36, 6, '#ea580c', undefined);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px "Noto Sans Devanagari", sans-serif';
    ctx.fillText('⚠️ सूचना', 20 + 44, h - footerH + 37);

    // Exact Disclaimer requested by user
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9a3412';
    ctx.font = '800 16px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(
      'हे कार्ड फक्त शेतकऱ्याच्या वैयक्तिक माहितीसाठी आहे, कोणतेही शासकीय ओळखपत्र नाही.',
      120,
      h - footerH + 28
    );

    ctx.fillStyle = '#64748b';
    ctx.font = '600 12.5px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(
      '(For Farmer\'s Personal Information & Farm Record Only • Not an Official Government Card)',
      120,
      h - footerH + 50
    );

    // Precision outer border
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  }, [formData, qrCanvas]);

  // Redraw both sides whenever data changes
  useEffect(() => {
    drawFrontCard();
    drawBackCard();
    setStatusMessage(t('शेतकरी कार्ड तयार आहे ✓', 'Farmer ID card is ready ✓'));
  }, [drawFrontCard, drawBackCard, t]);

  // Build Print Sheet Canvas (4x6 or A4)
  const buildPrintSheetCanvas = (): HTMLCanvasElement => {
    const is4x6 = sheetFormat === '4x6';
    const dpi = 220;

    // Dimensions in mm
    const pageW_mm = is4x6 ? 152.4 : 210;
    const pageH_mm = is4x6 ? 101.6 : 297;

    const widthPx = Math.round((pageW_mm / 25.4) * dpi);
    const heightPx = Math.round((pageH_mm / 25.4) * dpi);

    const sheet = document.createElement('canvas');
    sheet.width = widthPx;
    sheet.height = heightPx;
    const sCtx = sheet.getContext('2d');
    if (!sCtx) return sheet;

    // Crisp White Background
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, widthPx, heightPx);

    // Standard CR80 Card Size: 85.6 mm × 54.0 mm
    const cardW_px = (85.6 / 25.4) * dpi;
    const cardH_px = (54.0 / 25.4) * dpi;

    const frontCv = frontCanvasRef.current;
    const backCv = backCanvasRef.current;

    // Header Tag on Sheet (Zero website branding)
    sCtx.fillStyle = '#64748b';
    sCtx.font = `${dpi * 0.045}px "Noto Sans Devanagari", sans-serif`;
    sCtx.textAlign = 'left';
    sCtx.fillText('शेतकरी ओळखपत्र प्रिंट शीट (FARMER IDENTITY CARD PRINT SHEET - CR80 PVC)', 15, dpi * 0.08);

    const drawCardWithCropMarks = (cv: HTMLCanvasElement, x: number, y: number) => {
      sCtx.drawImage(cv, x, y, cardW_px, cardH_px);

      // Fine cutting border line
      sCtx.strokeStyle = '#94a3b8';
      sCtx.lineWidth = 1.5;
      sCtx.strokeRect(x, y, cardW_px, cardH_px);

      // Corner markers
      const mLen = 10;
      sCtx.strokeStyle = '#334155';
      sCtx.lineWidth = 1.2;

      // Top-left
      sCtx.beginPath();
      sCtx.moveTo(x - mLen, y);
      sCtx.lineTo(x + mLen, y);
      sCtx.moveTo(x, y - mLen);
      sCtx.lineTo(x, y + mLen);
      sCtx.stroke();

      // Top-right
      sCtx.beginPath();
      sCtx.moveTo(x + cardW_px - mLen, y);
      sCtx.lineTo(x + cardW_px + mLen, y);
      sCtx.moveTo(x + cardW_px, y - mLen);
      sCtx.lineTo(x + cardW_px, y + mLen);
      sCtx.stroke();

      // Bottom-left
      sCtx.beginPath();
      sCtx.moveTo(x - mLen, y + cardH_px);
      sCtx.lineTo(x + mLen, y + cardH_px);
      sCtx.moveTo(x, y + cardH_px - mLen);
      sCtx.lineTo(x, y + cardH_px + mLen);
      sCtx.stroke();

      // Bottom-right
      sCtx.beginPath();
      sCtx.moveTo(x + cardW_px - mLen, y + cardH_px);
      sCtx.lineTo(x + cardW_px + mLen, y + cardH_px);
      sCtx.moveTo(x + cardW_px, y + cardH_px - mLen);
      sCtx.lineTo(x + cardW_px, y + cardH_px + mLen);
      sCtx.stroke();
    };

    if (is4x6) {
      // 4x6 Sheet: Front and Back side-by-side with 3mm folding margin
      const gap_px = (3 / 25.4) * dpi;
      const totalW = cardW_px * 2 + gap_px;
      const startX = (widthPx - totalW) / 2;
      const startY = (heightPx - cardH_px) / 2;

      if (frontCv) drawCardWithCropMarks(frontCv, startX, startY);
      if (backCv) drawCardWithCropMarks(backCv, startX + cardW_px + gap_px, startY);

      // Fold guideline
      sCtx.setLineDash([4, 4]);
      sCtx.strokeStyle = '#cbd5e1';
      sCtx.beginPath();
      sCtx.moveTo(startX + cardW_px + gap_px / 2, startY - 10);
      sCtx.lineTo(startX + cardW_px + gap_px / 2, startY + cardH_px + 10);
      sCtx.stroke();
      sCtx.setLineDash([]);
    } else {
      // A4 Sheet: Placed neatly centered
      const gap_px = (4 / 25.4) * dpi;
      const totalW = cardW_px * 2 + gap_px;
      const startX = (widthPx - totalW) / 2;
      const startY = (heightPx - cardH_px) / 2;

      if (frontCv) drawCardWithCropMarks(frontCv, startX, startY);
      if (backCv) drawCardWithCropMarks(backCv, startX + cardW_px + gap_px, startY);
    }

    return sheet;
  };

  // Helper to trigger download from canvas
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

  // Download Full Sheet (PDF, PNG, JPG, or WEBP)
  const handleDownloadSheet = async (format: 'pdf' | 'png' | 'jpg' | 'webp' = downloadFormat) => {
    const is4x6 = sheetFormat === '4x6';
    const paperW = is4x6 ? 152.4 : 210;
    const paperH = is4x6 ? 101.6 : 297;
    const safeName = formData.fullName.slice(0, 15).replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_') || 'farmer-id';

    const sheetCanvas = buildPrintSheetCanvas();

    try {
      if (format === 'pdf') {
        const doc = new jsPDF({
          orientation: is4x6 ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [paperW, paperH],
          compress: true,
        });

        const dataUrl = sheetCanvas.toDataURL('image/jpeg', 0.98);
        doc.addImage(dataUrl, 'JPEG', 0, 0, paperW, paperH);
        await saveValidatedJsPdf(doc, `farmer-card-${safeName}-${sheetFormat}.pdf`, 1);
        trackFeatureAction('farmer-card');
        confetti({ particleCount: 50, spread: 60 });
        setStatusMessage(
          t(
            'पडताळणी पूर्ण: ३०० DPI अचूक माप शेतकरी ओळखपत्र PDF डाउनलोड झाली! ✓',
            'Validated: 300 DPI exact-size Farmer ID Card PDF downloaded! ✓'
          )
        );
      } else {
        const ext = format === 'jpg' ? 'jpg' : format;
        downloadCanvasAsFile(sheetCanvas, `farmer-card-sheet-${safeName}-${sheetFormat}.${ext}`, format);
        trackFeatureAction('farmer-card');
        confetti({ particleCount: 50, spread: 60 });
        setStatusMessage(
          t(
            `शेतकरी ओळखपत्र ${format.toUpperCase()} शीट डाउनलोड झाली! ✓`,
            `Farmer ID Card ${format.toUpperCase()} sheet downloaded! ✓`
          )
        );
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(
        t(
          'PDF पडताळणी किंवा डाउनलोड दरम्यान त्रुटी आली. कृपया पुन्हा प्रयत्न करा.',
          'PDF validation failed during export. Please try again.'
        )
      );
    } finally {
      releaseCanvasMemory(sheetCanvas);
    }
  };

  // Download Single Side Image (Front or Back) in PNG / JPG / WEBP
  const handleDownloadSingleCard = (side: 'front' | 'back', format: 'png' | 'jpg' | 'webp' = 'png') => {
    const cv = side === 'front' ? frontCanvasRef.current : backCanvasRef.current;
    if (!cv) return;
    const safeName = formData.fullName.slice(0, 12).replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_') || 'farmer';
    const ext = format === 'jpg' ? 'jpg' : format;
    downloadCanvasAsFile(cv, `farmer-card-${side}-${safeName}.${ext}`, format);
    trackFeatureAction('farmer-card');
    confetti({ particleCount: 35, spread: 45 });
    setStatusMessage(
      t(
        `शेतकरी कार्ड ${side === 'front' ? 'पुढील (Front)' : 'मागील (Back)'} (${format.toUpperCase()}) डाउनलोड झाले! ✓`,
        `Farmer Card ${side === 'front' ? 'Front' : 'Back'} (${format.toUpperCase()}) downloaded! ✓`
      )
    );
  };

  // Download Both Cards Separately (2 files)
  const handleDownloadBothCardsSeparate = async (format: 'png' | 'jpg' | 'webp' = 'png') => {
    const frontCv = frontCanvasRef.current;
    const backCv = backCanvasRef.current;
    if (!frontCv || !backCv) return;
    const safeName = formData.fullName.slice(0, 12).replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_') || 'farmer';
    const ext = format === 'jpg' ? 'jpg' : format;
    downloadCanvasAsFile(frontCv, `farmer-card-front-${safeName}.${ext}`, format);
    await new Promise((r) => setTimeout(r, 350));
    downloadCanvasAsFile(backCv, `farmer-card-back-${safeName}.${ext}`, format);
    trackFeatureAction('farmer-card');
    confetti({ particleCount: 45, spread: 55 });
    setStatusMessage(
      t(
        `दोन्ही बाजूंचे कार्ड स्वतंत्र ${format.toUpperCase()} फाइल्स म्हणून डाउनलोड झाले! ✓`,
        `Both sides downloaded as separate ${format.toUpperCase()} files! ✓`
      )
    );
  };

  // Direct WhatsApp / Web Share
  const handleShareCard = async () => {
    const sheetCanvas = buildPrintSheetCanvas();
    sheetCanvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `farmer-card-${sheetFormat}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: t('शेतकरी ओळखपत्र (Farmer ID Card)', 'Farmer ID Card'),
            text: appendPortalLink(
              t(
                `🌾 ${formData.fullName} यांचे शेतकरी ओळखपत्र (महा कॉर्नर)`,
                `🌾 Farmer ID Card of ${formData.fullName} (MAHA CORNER)`
              ),
              lang
            ),
            files: [file],
          });
          trackFeatureAction('farmer-card');
          setStatusMessage(t('कार्ड यशस्वीरित्या शेअर केले! ✓', 'Card shared successfully! ✓'));
        } catch (err) {
          console.warn('Share cancelled', err);
        }
      } else {
        handleDownloadSheet('png');
      }
    }, 'image/png');
  };

  // Direct Print Dialog via hidden iframe
  const handleDirectPrint = () => {
    trackFeatureAction('farmer-card');
    const sheetCanvas = buildPrintSheetCanvas();
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
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>${escapeHtml(t('शेतकरी ओळखपत्र प्रिंट', 'Farmer ID Print'))}</title>
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
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1500);
      }, 300);
      setStatusMessage(t('प्रिंट संवाद उघडला आहे ✓', 'Print dialog opened ✓'));
    } else {
      iframe.remove();
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <Sprout className="w-3.5 h-3.5" />
            <span>{t('कृषी व शेतकरी ओळखपत्र स्टुडिओ', 'Agriculture & Farmer ID Card Studio')}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black">
            {t('🌾 शेतकरी ओळखपत्र मेकर (Farmer ID Card)', '🌾 Farmer ID Card Maker (CR80 PVC)')}
          </h2>
          <p className="text-sm sm:text-base text-emerald-100">
            {t(
              'महाराष्ट्रातील शेतकरी बांधवांसाठी कृषी उत्पन्न बाजार समिती, शासकीय अनुदाने, पीक विमा व महाडीबीटीसाठी अधिकृत शेतकरी ओळखपत्र तयार करा. स्टँडर्ड PVC आकारात (85.6 × 54 mm) ४×६ किंवा A4 वर थेट प्रिंट करा.',
              'Create personal Farmer ID cards for APMC market records, crop insurance, MahaDBT, and farm tracking. Print directly on 4×6 or A4 sheets at exact CR80 PVC dimensions (85.6 × 54 mm).'
            )}
          </p>
        </div>

        <div className="shrink-0 hidden sm:block">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-400 p-1 shadow-2xl flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-emerald-950 flex flex-col items-center justify-center text-center p-2 border-2 border-amber-300">
              <Sprout className="w-9 h-9 text-amber-300" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider mt-0.5">FARMER ID</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls & Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Actions & Demo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">{t('थीम निवडा:', 'Select Theme:')}</span>
              <select
                value={formData.cardTheme}
                onChange={(e) => handleChange('cardTheme', e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-emerald-500"
              >
                {CARD_THEMES.map((themeItem) => (
                  <option key={themeItem.id} value={themeItem.id}>
                    {lang === 'en' ? themeItem.nameEn : themeItem.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadDemo}
                className="py-1.5 px-3 rounded-xl border border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('नमुना माहिती भरा', 'Load Demo Data')}
              </button>

              <button
                type="button"
                onClick={generateNewId}
                className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('नवीन आयडी क्र.', 'New ID No.')}
              </button>
            </div>
          </div>

          {/* 1. Farmer Personal Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              {t('१. शेतकऱ्याची वैयक्तिक माहिती', '1. Farmer Personal Details')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('शेतकऱ्याचे संपूर्ण नाव', 'Farmer Full Name')}
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder={t('उदा. श्री. सचिन तुकाराम पाटील', 'e.g., Shri Sachin Tukaram Patil')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('शेतकरी आयडी क्र.', 'Farmer ID No.')}
                </label>
                <input
                  type="text"
                  value={formData.farmerId}
                  onChange={(e) => handleChange('farmerId', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('आधार नंबर', 'Aadhaar Number')}
                </label>
                <input
                  type="text"
                  value={formData.aadhaarNo}
                  onChange={(e) => handleChange('aadhaarNo', e.target.value)}
                  placeholder="XXXX XXXX 1234"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('मोबाईल नंबर', 'Mobile Number')}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={formData.mobileNo}
                  onChange={(e) => handleChange('mobileNo', e.target.value.replace(/[^\d+\s-]/g, ''))}
                  placeholder="+917972123605"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('जन्म तारीख / वय', 'Date of Birth / Age')}
                </label>
                <input
                  type="text"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('लिंग', 'Gender')}
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="पुरुष / Male">{t('पुरुष', 'Male')}</option>
                  <option value="महिला / Female">{t('महिला', 'Female')}</option>
                  <option value="इतर / Other">{t('इतर', 'Other')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('रक्तगट', 'Blood Group')}
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => handleChange('bloodGroup', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O-">O-</option>
                  <option value="A-">A-</option>
                  <option value="B-">B-</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            {/* Photo Upload Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {t('शेतकऱ्याचा फोटो अपलोड करा', 'Upload Farmer Photo')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {photoImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoImage(null);
                      handleChange('photoUrl', null);
                    }}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                    title={t('फोटो काढा', 'Remove photo')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Farm & 7/12 Land Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-600" />
              {t('२. जमीन, ७/१२ खाते व शेती तपशील', '2. Land, 7/12 Khata & Farm Details')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('गट क्र. / सर्व्हे नंबर', 'Gat No. / Survey No.')}
                </label>
                <input
                  type="text"
                  value={formData.gatNo}
                  onChange={(e) => handleChange('gatNo', e.target.value)}
                  placeholder={t('उदा. २४१ / ३-अ', 'e.g., 241 / 3-A')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('७/१२ खाते क्रमांक', '7/12 Khata Number')}
                </label>
                <input
                  type="text"
                  value={formData.khataNo}
                  onChange={(e) => handleChange('khataNo', e.target.value)}
                  placeholder={t('उदा. ५४२', 'e.g., 542')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('एकूण जमीन क्षेत्र', 'Total Land Area')}
                </label>
                <input
                  type="text"
                  value={formData.landArea}
                  onChange={(e) => handleChange('landArea', e.target.value)}
                  placeholder={t('उदा. २ हेक्टर ४० आर (६ एकर)', 'e.g., 2 Hectare 40 R (6 Acres)')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('जमिनीचा प्रकार', 'Land Type')}
                </label>
                <input
                  type="text"
                  value={formData.landType}
                  onChange={(e) => handleChange('landType', e.target.value)}
                  placeholder={t('उदा. बागायत / कोरडवाहू / जिरायत', 'e.g., Irrigated / Dryland')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Address Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              {t('३. पत्ता व ठिकाण तपशील', '3. Address & Location Details')}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('गाव / शहर', 'Village / City')}
                </label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={(e) => handleChange('village', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('तालुका', 'Taluka')}
                </label>
                <input
                  type="text"
                  value={formData.taluka}
                  onChange={(e) => handleChange('taluka', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('जिल्हा', 'District')}
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('पिनकोड', 'Pincode')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('निर्गमित तारीख', 'Issue Date')}
                </label>
                <input
                  type="text"
                  value={formData.issueDate}
                  onChange={(e) => handleChange('issueDate', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('वैधता', 'Validity')}
                </label>
                <input
                  type="text"
                  value={formData.validity}
                  onChange={(e) => handleChange('validity', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview & Print Sheet Export (5 cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-800 text-white space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="text-sm font-bold">{t('थेट प्रिव्ह्यू (Live ID Card)', 'Live ID Card Preview')}</h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">85.6 × 54.0 mm</span>
            </div>

            {statusMessage && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs font-semibold">
                {statusMessage}
              </div>
            )}

            {/* Front Card Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {t('पुढील बाजू (Front Side)', 'Front Side')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">{t('डाउनलोड:', 'Download:')}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('front', 'png')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('front', 'jpg')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-300 border border-slate-700 cursor-pointer"
                  >
                    JPG
                  </button>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shadow-inner">
                <canvas ref={frontCanvasRef} className="w-full h-auto rounded-lg shadow-md" />
              </div>
            </div>

            {/* Back Card Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  {t('मागील बाजू (Back Side)', 'Back Side')}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">{t('डाउनलोड:', 'Download:')}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('back', 'png')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-300 border border-slate-700 cursor-pointer"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('back', 'jpg')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-blue-300 border border-slate-700 cursor-pointer"
                  >
                    JPG
                  </button>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shadow-inner">
                <canvas ref={backCanvasRef} className="w-full h-auto rounded-lg shadow-md" />
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-1.5 mt-1">
                <span className="text-amber-400 font-bold shrink-0">{t('⚠️ स्पष्ट नोंद:', '⚠️ Disclaimer:')}</span>
                <span>
                  {t(
                    'हे कार्ड फक्त शेतकऱ्याच्या वैयक्तिक माहितीसाठी आहे, कोणतेही शासकीय ओळखपत्र नाही.',
                    'This card is solely for the farmer’s personal record and is not an official government ID.'
                  )}
                </span>
              </div>
            </div>

            {/* Print Sheet & Multi-Format Download Options */}
            <div className="pt-2 border-t border-slate-800 space-y-3.5">
              {/* Paper Format */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">{t('प्रिंट शीट आकार:', 'Print Sheet Size:')}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetFormat('4x6')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sheetFormat === '4x6'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('४ × ६ इंच फोटो पेपर', '4 × 6 in Photo Paper')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetFormat('a4')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      sheetFormat === 'a4'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('A4 शीट', 'A4 Sheet')}
                  </button>
                </div>
              </div>

              {/* Format Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  {t('डाउनलोड फॉरमॅट निवडा (PDF, PNG, JPG, WEBP):', 'Select Download Format (PDF, PNG, JPG, WEBP):')}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDownloadFormat('pdf')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      downloadFormat === 'pdf'
                        ? 'border-red-400 bg-red-950/70 text-red-300 font-black ring-1 ring-red-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs block">📄 PDF</span>
                    <span className="text-[9px] block text-slate-400">{t('प्रिंट योग्य', 'Print Ready')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDownloadFormat('png')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      downloadFormat === 'png'
                        ? 'border-emerald-400 bg-emerald-950/70 text-emerald-300 font-black ring-1 ring-emerald-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs block">🖼️ PNG</span>
                    <span className="text-[9px] block text-slate-400">{t('HD इमेज', 'HD Image')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDownloadFormat('jpg')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      downloadFormat === 'jpg'
                        ? 'border-blue-400 bg-blue-950/70 text-blue-300 font-black ring-1 ring-blue-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs block">🌅 JPG</span>
                    <span className="text-[9px] block text-slate-400">{t('फोटो लॅब', 'Photo Lab')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDownloadFormat('webp')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      downloadFormat === 'webp'
                        ? 'border-purple-400 bg-purple-950/70 text-purple-300 font-black ring-1 ring-purple-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs block">📱 WEBP</span>
                    <span className="text-[9px] block text-slate-400">WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Main Action Download Button */}
              <button
                type="button"
                onClick={() => handleDownloadSheet(downloadFormat)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                {t(
                  `🌾 शेतकरी ओळखपत्र ${downloadFormat.toUpperCase()} डाउनलोड करा (${sheetFormat === '4x6' ? '४×६ शीट' : 'A4 शीट'})`,
                  `🌾 Download Farmer ID ${downloadFormat.toUpperCase()} (${sheetFormat === '4x6' ? '4×6 Sheet' : 'A4 Sheet'})`
                )}
              </button>

              {/* Quick 1-Click Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadSheet('pdf')}
                  className="py-2 px-2 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-red-800/80 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t('PDF शीट', 'PDF Sheet')}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSheet('png')}
                  className="py-2 px-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-emerald-800/80 cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  {t('PNG शीट', 'PNG Sheet')}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSheet('jpg')}
                  className="py-2 px-2 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-blue-800/80 cursor-pointer"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  {t('JPG शीट', 'JPG Sheet')}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSheet('webp')}
                  className="py-2 px-2 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-purple-800/80 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  {t('WEBP शीट', 'WEBP Sheet')}
                </button>
              </div>

              {/* Individual Single Cards Download */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Layers className="w-3.5 h-3.5" />
                    {t('स्वतंत्र कार्ड इमेज (Single Card Exports):', 'Single Card Exports:')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('front', 'png')}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors text-center cursor-pointer"
                  >
                    {t('Front बाजू (PNG)', 'Front Side (PNG)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleCard('back', 'png')}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors text-center cursor-pointer"
                  >
                    {t('Back बाजू (PNG)', 'Back Side (PNG)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadBothCardsSeparate('png')}
                    className="py-1.5 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors text-center cursor-pointer"
                  >
                    {t('दोन्ही वेगळ्या फाइल्स', 'Both Separate Files')}
                  </button>
                </div>
              </div>

              {/* Print & Share Action Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  {t('थेट प्रिंट करा', 'Print Directly')}
                </button>

                <button
                  type="button"
                  onClick={handleShareCard}
                  className="py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs transition-all hover:scale-105 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
                  </svg>
                  <span>{t('📲 WhatsApp शेअर', 'Share on WhatsApp')}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-[11px] text-slate-300 space-y-1">
              <p className="font-bold text-amber-300">{t('💡 लॅमिनेशन सूचना:', '💡 Lamination Tip:')}</p>
              <p>
                {t(
                  '४×६ फोटो पेपरवर प्रिंट करून मध्यभागी फोल्ड करा व स्टँडर्ड PVC लॅमिनेशन पाऊचमध्ये घालून लॅमिनेट करा. कार्डवर स्कॅन करता येणारा डिजिटल QR कोड समाविष्ट आहे.',
                  'Print on 4×6 photo paper, fold in the center, and laminate inside a standard CR80 PVC pouch. Includes a scannable digital QR code.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

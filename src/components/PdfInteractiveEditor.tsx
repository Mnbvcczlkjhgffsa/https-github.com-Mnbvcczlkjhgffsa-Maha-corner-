import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import {
  MousePointer2,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Highlighter,
  Eraser,
  ShieldAlert,
  Shapes,
  Search,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Download,
  Bold,
  Circle,
  ArrowRight,
  Minus,
  Upload,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import { PdfOperationError, loadCleanPdfDocument, saveUniversalPdf } from '../utils/pdfCompat';
import { inspectUploadedFileBytes, releaseCanvasMemory, yieldToUi } from '../utils/pdfSecurity';

export interface PdfInteractiveEditorHandle {
  exportEditedPdf: () => Promise<Uint8Array | null>;
  getAnnotationCount: () => number;
}

interface PdfInteractiveEditorProps {
  pdfBytes: Uint8Array | null;
  pageCount: number;
  fileName?: string;
  onExportReady: (bytes: Uint8Array, filename: string) => void;
  onStatusChange: (msg: string) => void;
  t: (mr: string, en: string) => string;
}

type EditorTool =
  | 'select'
  | 'text'
  | 'image'
  | 'signature'
  | 'whiteout'
  | 'redact'
  | 'highlight'
  | 'shape'
  | 'draw';

type ShapeVariant = 'rect' | 'filled-rect' | 'circle' | 'arrow' | 'line' | 'check' | 'cross';

interface ExtractedTextSpan {
  id: string;
  page: number;
  text: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  fontSize: number;
}

type PdfAnnotation =
  | {
      id: string;
      kind: 'text' | 'text-replace';
      page: number;
      xPct: number;
      yPct: number;
      wPct?: number;
      hPct?: number;
      bgColor?: string;
      text: string;
      color: string;
      fontSize: number;
      bold: boolean;
    }
  | {
      id: string;
      kind: 'image' | 'signature';
      page: number;
      xPct: number;
      yPct: number;
      wPct: number;
      hPct: number;
      dataUrl: string;
    }
  | {
      id: string;
      kind: 'whiteout' | 'redact' | 'highlight';
      page: number;
      xPct: number;
      yPct: number;
      wPct: number;
      hPct: number;
    }
  | {
      id: string;
      kind: 'shape';
      variant: ShapeVariant;
      page: number;
      xPct: number;
      yPct: number;
      wPct: number;
      hPct: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      kind: 'draw';
      page: number;
      color: string;
      strokeWidth: number;
      points: Array<{ xPct: number; yPct: number }>;
    };

const COLOR_PALETTE = [
  { hex: '#0f172a', labelMr: 'काळा', labelEn: 'Black' },
  { hex: '#dc2626', labelMr: 'लाल', labelEn: 'Red' },
  { hex: '#1d4ed8', labelMr: 'निळा', labelEn: 'Blue' },
  { hex: '#15803d', labelMr: 'हिरवा', labelEn: 'Green' },
  { hex: '#7c3aed', labelMr: 'जांभळा', labelEn: 'Purple' },
  { hex: '#ffffff', labelMr: 'पांढरा', labelEn: 'White' },
];

export const PdfInteractiveEditor = forwardRef<PdfInteractiveEditorHandle, PdfInteractiveEditorProps>(
  ({ pdfBytes, pageCount, fileName, onExportReady, onStatusChange, t }, ref) => {
    const [activeTool, setActiveTool] = useState<EditorTool>('select');
    const [shapeVariant, setShapeVariant] = useState<ShapeVariant>('rect');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [zoomPct, setZoomPct] = useState<number>(100);

    // Current style settings
    const [textInput, setTextInput] = useState<string>('महा कॉर्नर • सत्यापित');
    const [activeColor, setActiveColor] = useState<string>('#0f172a');
    const [fontSize, setFontSize] = useState<number>(16);
    const [isBold, setIsBold] = useState<boolean>(true);
    const [strokeWidth, setStrokeWidth] = useState<number>(3);

    // Page state & annotations
    const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [extractedSpans, setExtractedSpans] = useState<ExtractedTextSpan[]>([]);
    const [pageLoading, setPageLoading] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [pageDims, setPageDims] = useState<{ width: number; height: number }>({
      width: 820,
      height: 1160,
    });
    const [draftBox, setDraftBox] = useState<{
      xPct: number;
      yPct: number;
      wPct: number;
      hPct: number;
    } | null>(null);

    // Find & Replace UI
    const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
    const [findText, setFindText] = useState<string>('');
    const [replaceText, setReplaceText] = useState<string>('');

    // Signature Modal UI
    const [showSigModal, setShowSigModal] = useState<boolean>(false);
    const [isSigDrawing, setIsSigDrawing] = useState<boolean>(false);
    const [typedSignature, setTypedSignature] = useState<string>('');
    const [wpsSafeMode, setWpsSafeMode] = useState<boolean>(true);

    const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const sigPadRef = useRef<HTMLCanvasElement | null>(null);
    const imageUploadRef = useRef<HTMLInputElement | null>(null);
    const sigUploadRef = useRef<HTMLInputElement | null>(null);
    const loadedImagesCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

    const dragCreateStartRef = useRef<{ xPct: number; yPct: number } | null>(null);
    const activeStrokeIdRef = useRef<string | null>(null);
    const draggingAnnRef = useRef<{
      id: string;
      startXPct: number;
      startYPct: number;
      origXPct: number;
      origYPct: number;
    } | null>(null);

    // Reset annotations when new PDF loaded
    useEffect(() => {
      setCurrentPage(1);
      setAnnotations([]);
      setSelectedId(null);
      setExtractedSpans([]);
    }, [pdfBytes]);

    // Preload any image/signature dataUrls into HTMLImageElement cache
    const ensureImageLoaded = useCallback((dataUrl: string): Promise<HTMLImageElement> => {
      const existing = loadedImagesCacheRef.current.get(dataUrl);
      if (existing && existing.complete) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          loadedImagesCacheRef.current.set(dataUrl, img);
          resolve(img);
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }, []);

    // Group raw pdf.js text items into clickable line/phrase spans
    const extractTextSpansFromPage = async (page: any, viewport: any, pageNum: number): Promise<ExtractedTextSpan[]> => {
      try {
        const textContent = await page.getTextContent();
        const rawItems: Array<{
          str: string;
          x: number;
          top: number;
          w: number;
          h: number;
          fontHeight: number;
        }> = [];

        for (const item of textContent.items || []) {
          if (!item || typeof item.str !== 'string' || !item.str.trim()) continue;
          const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]) || Math.abs(item.height * viewport.scale) || 12);
          const x = tx[4];
          const yBaseline = tx[5];
          const w = Math.max(8, (item.width || 0) * viewport.scale);
          const h = Math.max(10, fontHeight * 1.2);
          const top = yBaseline - fontHeight * 0.92;
          rawItems.push({ str: item.str, x, top, w, h, fontHeight });
        }

        // Group horizontally adjacent spans on the same baseline
        const grouped: typeof rawItems = [];
        for (const cur of rawItems) {
          const prev = grouped[grouped.length - 1];
          if (
            prev &&
            Math.abs(prev.top - cur.top) < Math.max(prev.h, cur.h) * 0.45 &&
            cur.x - (prev.x + prev.w) >= -4 &&
            cur.x - (prev.x + prev.w) <= Math.max(prev.fontHeight, cur.fontHeight) * 1.35
          ) {
            const gap = cur.x - (prev.x + prev.w);
            const spacer = gap > prev.fontHeight * 0.2 ? ' ' : '';
            prev.str = `${prev.str}${spacer}${cur.str}`;
            prev.w = cur.x + cur.w - prev.x;
            prev.h = Math.max(prev.h, cur.h);
            prev.top = Math.min(prev.top, cur.top);
            prev.fontHeight = Math.max(prev.fontHeight, cur.fontHeight);
          } else {
            grouped.push({ ...cur });
          }
        }

        return grouped.map((g, idx) => ({
          id: `span-p${pageNum}-${idx}`,
          page: pageNum,
          text: g.str,
          xPct: Math.max(0, (g.x / viewport.width) * 100),
          yPct: Math.max(0, (g.top / viewport.height) * 100),
          wPct: Math.min(100, (g.w / viewport.width) * 100),
          hPct: Math.min(100, (g.h / viewport.height) * 100),
          fontSize: Math.max(9, Math.min(44, Math.round((g.fontHeight / viewport.width) * 820))),
        }));
      } catch {
        return [];
      }
    };

    // Render active PDF page onto base canvas and extract clickable text spans
    useEffect(() => {
      if (!pdfBytes) return;
      let cancelled = false;

      const renderPage = async () => {
        if (!window.pdfjsLib) return;
        setPageLoading(true);
        let doc: any = null;
        let page: any = null;
        try {
          const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice() });
          doc = await loadingTask.promise;
          if (cancelled) return;

          const safePage = Math.min(Math.max(1, currentPage), doc.numPages);
          if (safePage !== currentPage) setCurrentPage(safePage);

          page = await doc.getPage(safePage);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const renderTargetWidth = 900;
          const scale = renderTargetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const dims = {
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
          };
          setPageDims(dims);

          const canvas = baseCanvasRef.current;
          if (canvas) {
            canvas.width = dims.width;
            canvas.height = dims.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
            }
          }

          const spans = await extractTextSpansFromPage(page, viewport, safePage);
          if (!cancelled) {
            setExtractedSpans(spans);
          }
        } catch (err) {
          console.error('Failed to render PDF page:', err);
        } finally {
          page?.cleanup?.();
          await doc?.destroy?.();
          if (!cancelled) setPageLoading(false);
        }
      };

      renderPage();
      return () => {
        cancelled = true;
      };
    }, [pdfBytes, currentPage]);

    // Sample background color around a text span from the rendered base canvas
    const sampleBackgroundColor = (xPct: number, yPct: number, hPct: number): string => {
      const canvas = baseCanvasRef.current;
      if (!canvas) return '#ffffff';
      const ctx = canvas.getContext('2d');
      if (!ctx) return '#ffffff';
      try {
        const sx = Math.max(0, Math.min(canvas.width - 1, Math.round((xPct / 100) * canvas.width) - 2));
        const sy = Math.max(0, Math.min(canvas.height - 1, Math.round(((yPct + hPct * 0.5) / 100) * canvas.height)));
        const pixel = ctx.getImageData(sx, sy, 1, 1).data;
        const brightness = (pixel[0] * 299 + pixel[1] * 587 + pixel[2] * 114) / 1000;
        if (brightness > 210) {
          return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        }
      } catch {}
      return '#ffffff';
    };

    // Draw annotations onto a 2D canvas (shared by live overlay AND high-res PDF export)
    const renderAnnotationsToContext = useCallback(
      async (
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        pageAnns: PdfAnnotation[],
        options?: {
          showHelpers?: boolean;
          spans?: ExtractedTextSpan[];
          highlightId?: string | null;
          draft?: { xPct: number; yPct: number; wPct: number; hPct: number } | null;
          draftTool?: EditorTool;
          draftShape?: ShapeVariant;
        }
      ) => {
        const scaleFactor = w / 820;

        // Subtle hover guides for existing clickable PDF text when in 'select' mode (live preview only)
        if (options?.showHelpers && options.spans && options.spans.length > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.fillStyle = 'rgba(59, 130, 246, 0.04)';
          ctx.lineWidth = 1;
          for (const sp of options.spans) {
            const sx = (sp.xPct / 100) * w;
            const sy = (sp.yPct / 100) * h;
            const sw = (sp.wPct / 100) * w;
            const sh = (sp.hPct / 100) * h;
            ctx.fillRect(sx, sy, sw, sh);
            ctx.strokeRect(sx, sy, sw, sh);
          }
          ctx.restore();
        }

        for (const ann of pageAnns) {
          if (ann.kind === 'whiteout') {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect((ann.xPct / 100) * w, (ann.yPct / 100) * h, (ann.wPct / 100) * w, (ann.hPct / 100) * h);
            ctx.restore();
          } else if (ann.kind === 'redact') {
            ctx.save();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect((ann.xPct / 100) * w, (ann.yPct / 100) * h, (ann.wPct / 100) * w, (ann.hPct / 100) * h);
            ctx.restore();
          } else if (ann.kind === 'highlight') {
            ctx.save();
            ctx.fillStyle = 'rgba(253, 224, 71, 0.42)';
            ctx.fillRect((ann.xPct / 100) * w, (ann.yPct / 100) * h, (ann.wPct / 100) * w, (ann.hPct / 100) * h);
            ctx.restore();
          } else if (ann.kind === 'shape') {
            ctx.save();
            const sx = (ann.xPct / 100) * w;
            const sy = (ann.yPct / 100) * h;
            const sw = (ann.wPct / 100) * w;
            const sh = (ann.hPct / 100) * h;
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            ctx.lineWidth = Math.max(1.5, ann.strokeWidth * scaleFactor);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (ann.variant === 'rect') {
              ctx.strokeRect(sx, sy, sw, sh);
            } else if (ann.variant === 'filled-rect') {
              ctx.globalAlpha = 0.85;
              ctx.fillRect(sx, sy, sw, sh);
            } else if (ann.variant === 'circle') {
              ctx.beginPath();
              ctx.ellipse(sx + sw / 2, sy + sh / 2, Math.abs(sw / 2), Math.abs(sh / 2), 0, 0, Math.PI * 2);
              ctx.stroke();
            } else if (ann.variant === 'line') {
              ctx.beginPath();
              ctx.moveTo(sx, sy + sh / 2);
              ctx.lineTo(sx + sw, sy + sh / 2);
              ctx.stroke();
            } else if (ann.variant === 'arrow') {
              const yMid = sy + sh / 2;
              const endX = sx + sw;
              const headLen = Math.min(20 * scaleFactor, Math.max(8 * scaleFactor, sw * 0.25));
              ctx.beginPath();
              ctx.moveTo(sx, yMid);
              ctx.lineTo(endX, yMid);
              ctx.lineTo(endX - headLen, yMid - headLen * 0.6);
              ctx.moveTo(endX, yMid);
              ctx.lineTo(endX - headLen, yMid + headLen * 0.6);
              ctx.stroke();
            } else if (ann.variant === 'check') {
              ctx.beginPath();
              ctx.moveTo(sx + sw * 0.15, sy + sh * 0.55);
              ctx.lineTo(sx + sw * 0.42, sy + sh * 0.85);
              ctx.lineTo(sx + sw * 0.88, sy + sh * 0.15);
              ctx.stroke();
            } else if (ann.variant === 'cross') {
              ctx.beginPath();
              ctx.moveTo(sx + sw * 0.18, sy + sh * 0.18);
              ctx.lineTo(sx + sw * 0.82, sy + sh * 0.82);
              ctx.moveTo(sx + sw * 0.82, sy + sh * 0.18);
              ctx.lineTo(sx + sw * 0.18, sy + sh * 0.82);
              ctx.stroke();
            }
            ctx.restore();
          } else if (ann.kind === 'draw' && ann.points.length > 0) {
            ctx.save();
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = Math.max(1.5, ann.strokeWidth * scaleFactor);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ann.points.forEach((pt, idx) => {
              const px = (pt.xPct / 100) * w;
              const py = (pt.yPct / 100) * h;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
            ctx.restore();
          } else if (ann.kind === 'image' || ann.kind === 'signature') {
            try {
              const img = await ensureImageLoaded(ann.dataUrl);
              ctx.save();
              ctx.drawImage(
                img,
                (ann.xPct / 100) * w,
                (ann.yPct / 100) * h,
                (ann.wPct / 100) * w,
                (ann.hPct / 100) * h
              );
              ctx.restore();
            } catch {}
          } else if (ann.kind === 'text' || ann.kind === 'text-replace') {
            ctx.save();
            const tx = (ann.xPct / 100) * w;
            const ty = (ann.yPct / 100) * h;
            const pxFont = Math.max(9, Math.round(ann.fontSize * scaleFactor));
            ctx.font = `${ann.bold ? '700' : '500'} ${pxFont}px "Noto Sans Devanagari", "Mukta", sans-serif`;

            if (ann.kind === 'text-replace') {
              const coverW = Math.max((ann.wPct ? (ann.wPct / 100) * w : 0) + 4 * scaleFactor, ctx.measureText(ann.text).width + 6 * scaleFactor);
              const coverH = Math.max(ann.hPct ? (ann.hPct / 100) * h : pxFont * 1.25, pxFont * 1.2);
              ctx.fillStyle = ann.bgColor || '#ffffff';
              ctx.fillRect(tx - 2 * scaleFactor, ty - 1 * scaleFactor, coverW, coverH + 2 * scaleFactor);
            }

            if (ann.text) {
              ctx.fillStyle = ann.color;
              ctx.textBaseline = 'top';
              const lines = ann.text.split('\n');
              lines.forEach((line, idx) => {
                ctx.fillText(line, tx, ty + idx * (pxFont * 1.22));
              });
            }
            ctx.restore();
          }

          // Selection outline on live canvas
          if (options?.highlightId === ann.id) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            if (ann.kind === 'draw' && ann.points.length > 0) {
              const xs = ann.points.map((p) => (p.xPct / 100) * w);
              const ys = ann.points.map((p) => (p.yPct / 100) * h);
              const minX = Math.min(...xs) - 4;
              const minY = Math.min(...ys) - 4;
              ctx.strokeRect(minX, minY, Math.max(...xs) - minX + 8, Math.max(...ys) - minY + 8);
            } else if (ann.kind === 'text' || ann.kind === 'text-replace') {
              const tx = (ann.xPct / 100) * w;
              const ty = (ann.yPct / 100) * h;
              const pxFont = Math.max(9, Math.round(ann.fontSize * scaleFactor));
              ctx.font = `${ann.bold ? '700' : '500'} ${pxFont}px "Noto Sans Devanagari", sans-serif`;
              const boxW = Math.max(40, ctx.measureText(ann.text || ' ').width + 10);
              const boxH = Math.max(pxFont * 1.3, ann.text.split('\n').length * pxFont * 1.25);
              ctx.strokeRect(tx - 4, ty - 3, boxW, boxH + 4);
            } else if ('wPct' in ann && typeof ann.wPct === 'number' && typeof ann.hPct === 'number') {
              ctx.strokeRect(
                (ann.xPct / 100) * w - 2,
                (ann.yPct / 100) * h - 2,
                (ann.wPct / 100) * w + 4,
                (ann.hPct / 100) * h + 4
              );
            }
            ctx.restore();
          }
        }

        // Draft rubber-band rect while dragging
        if (options?.draft) {
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = options.draftTool === 'redact' ? '#dc2626' : '#f59e0b';
          ctx.fillStyle =
            options.draftTool === 'whiteout'
              ? 'rgba(255,255,255,0.85)'
              : options.draftTool === 'redact'
              ? 'rgba(15,23,42,0.8)'
              : options.draftTool === 'highlight'
              ? 'rgba(253,224,71,0.45)'
              : 'rgba(245,158,11,0.12)';
          const rx = (options.draft.xPct / 100) * w;
          const ry = (options.draft.yPct / 100) * h;
          const rw = (options.draft.wPct / 100) * w;
          const rh = (options.draft.hPct / 100) * h;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();
        }
      },
      [ensureImageLoaded]
    );

    // Redraw overlay whenever state changes
    useEffect(() => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      overlay.width = pageDims.width;
      overlay.height = pageDims.height;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const pageAnns = annotations.filter((a) => a.page === currentPage);
      void renderAnnotationsToContext(ctx, overlay.width, overlay.height, pageAnns, {
        showHelpers: activeTool === 'select',
        spans: extractedSpans,
        highlightId: selectedId,
        draft: draftBox,
        draftTool: activeTool,
        draftShape: shapeVariant,
      });
    }, [
      annotations,
      currentPage,
      pageDims,
      activeTool,
      extractedSpans,
      selectedId,
      draftBox,
      shapeVariant,
      renderAnnotationsToContext,
    ]);

    const getPctPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      return { xPct, yPct };
    };

    const hitTestAnnotation = (xPct: number, yPct: number): PdfAnnotation | undefined => {
      const pageAnns = annotations.filter((a) => a.page === currentPage);
      return [...pageAnns].reverse().find((ann) => {
        if (ann.kind === 'draw') return false;
        if (ann.kind === 'text' || ann.kind === 'text-replace') {
          const estW = ann.wPct || Math.max(8, Math.min(45, ann.text.length * 1.4));
          const estH = ann.hPct || Math.max(3.5, (ann.fontSize / 16) * 3.2);
          return xPct >= ann.xPct - 1.5 && xPct <= ann.xPct + estW + 2 && yPct >= ann.yPct - 1.5 && yPct <= ann.yPct + estH + 2;
        }
        return (
          xPct >= ann.xPct - 1 &&
          xPct <= ann.xPct + (ann.wPct ?? 12) + 1 &&
          yPct >= ann.yPct - 1 &&
          yPct <= ann.yPct + (ann.hPct ?? 5) + 1
        );
      });
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { xPct, yPct } = getPctPos(e);

      // 1. Check if clicking an existing added/edited annotation to select & drag
      const hitAnn = hitTestAnnotation(xPct, yPct);
      if (
        hitAnn &&
        hitAnn.kind !== 'draw' &&
        (activeTool === 'select' ||
          activeTool === 'text' ||
          activeTool === 'image' ||
          activeTool === 'signature' ||
          activeTool === 'shape')
      ) {
        setSelectedId(hitAnn.id);
        if (hitAnn.kind === 'text' || hitAnn.kind === 'text-replace') {
          setTextInput(hitAnn.text);
          setActiveColor(hitAnn.color);
          setFontSize(hitAnn.fontSize);
          setIsBold(hitAnn.bold);
        }
        draggingAnnRef.current = {
          id: hitAnn.id,
          startXPct: xPct,
          startYPct: yPct,
          origXPct: hitAnn.xPct,
          origYPct: hitAnn.yPct,
        };
        return;
      }

      // 2. If in 'select' mode, check if clicking an existing PDF text span to edit inline!
      if (activeTool === 'select') {
        const hitSpan = extractedSpans.find(
          (sp) =>
            xPct >= sp.xPct - 0.6 &&
            xPct <= sp.xPct + sp.wPct + 1.2 &&
            yPct >= sp.yPct - 0.5 &&
            yPct <= sp.yPct + sp.hPct + 0.8
        );
        if (hitSpan) {
          const bgColor = sampleBackgroundColor(hitSpan.xPct, hitSpan.yPct, hitSpan.hPct);
          const replaceAnn: PdfAnnotation = {
            id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind: 'text-replace',
            page: currentPage,
            xPct: hitSpan.xPct,
            yPct: hitSpan.yPct,
            wPct: hitSpan.wPct,
            hPct: hitSpan.hPct,
            bgColor,
            text: hitSpan.text,
            color: '#0f172a',
            fontSize: hitSpan.fontSize,
            bold: false,
          };
          setAnnotations((prev) => [...prev, replaceAnn]);
          setSelectedId(replaceAnn.id);
          setTextInput(hitSpan.text);
          setFontSize(hitSpan.fontSize);
          setIsBold(false);
          setActiveColor('#0f172a');
          onStatusChange(
            t(
              `मजकूर निवडला: "${hitSpan.text.slice(0, 28)}" — आता वरील बॉक्समधून बदला!`,
              `Selected text "${hitSpan.text.slice(0, 28)}" — edit it in the box above!`
            )
          );
          return;
        }
        setSelectedId(null);
        return;
      }

      // 3. Add New Text Mode
      if (activeTool === 'text') {
        const newId = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newTxt: PdfAnnotation = {
          id: newId,
          kind: 'text',
          page: currentPage,
          xPct,
          yPct,
          text: textInput.trim() || t('नवीन मजकूर', 'New Text'),
          color: activeColor,
          fontSize,
          bold: isBold,
        };
        setAnnotations((prev) => [...prev, newTxt]);
        setSelectedId(newId);
        onStatusChange(t('नवीन मजकूर जोडला! ड्रॅग करून जागा बदलू शकता.', 'New text added! Drag to move.'));
        return;
      }

      // 4. Freehand Draw
      if (activeTool === 'draw') {
        const strokeId = `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        activeStrokeIdRef.current = strokeId;
        setAnnotations((prev) => [
          ...prev,
          {
            id: strokeId,
            kind: 'draw',
            page: currentPage,
            color: activeColor,
            strokeWidth,
            points: [{ xPct, yPct }],
          },
        ]);
        setSelectedId(strokeId);
        return;
      }

      // 5. Drag-to-create boxes (Whiteout, Redact, Highlight, Shape)
      if (activeTool === 'whiteout' || activeTool === 'redact' || activeTool === 'highlight' || activeTool === 'shape') {
        dragCreateStartRef.current = { xPct, yPct };
        setDraftBox({ xPct, yPct, wPct: 0, hPct: 0 });
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { xPct, yPct } = getPctPos(e);

      if (draggingAnnRef.current) {
        const drag = draggingAnnRef.current;
        const dx = xPct - drag.startXPct;
        const dy = yPct - drag.startYPct;
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === drag.id && a.kind !== 'draw'
              ? {
                  ...a,
                  xPct: Math.max(0, Math.min(96, drag.origXPct + dx)),
                  yPct: Math.max(0, Math.min(97, drag.origYPct + dy)),
                }
              : a
          )
        );
        return;
      }

      if (dragCreateStartRef.current) {
        const s = dragCreateStartRef.current;
        setDraftBox({
          xPct: Math.min(s.xPct, xPct),
          yPct: Math.min(s.yPct, yPct),
          wPct: Math.abs(xPct - s.xPct),
          hPct: Math.abs(yPct - s.yPct),
        });
        return;
      }

      if (activeStrokeIdRef.current && activeTool === 'draw') {
        const sid = activeStrokeIdRef.current;
        setAnnotations((prev) =>
          prev.map((a) => (a.id === sid && a.kind === 'draw' ? { ...a, points: [...a.points, { xPct, yPct }] } : a))
        );
      }
    };

    const handlePointerUp = () => {
      if (draggingAnnRef.current) {
        draggingAnnRef.current = null;
        return;
      }

      if (activeStrokeIdRef.current) {
        activeStrokeIdRef.current = null;
        return;
      }

      if (dragCreateStartRef.current) {
        const start = dragCreateStartRef.current;
        const box = draftBox;
        dragCreateStartRef.current = null;
        setDraftBox(null);

        const isTap = !box || (box.wPct < 1.5 && box.hPct < 1.2);
        const defaultW = activeTool === 'shape' && (shapeVariant === 'check' || shapeVariant === 'cross') ? 5 : 18;
        const defaultH = activeTool === 'shape' && (shapeVariant === 'check' || shapeVariant === 'cross') ? 4 : activeTool === 'shape' ? 8 : 4;
        const finalRect = isTap
          ? {
              xPct: Math.max(0, Math.min(92, start.xPct - defaultW / 2)),
              yPct: Math.max(0, Math.min(94, start.yPct - defaultH / 2)),
              wPct: defaultW,
              hPct: defaultH,
            }
          : box;

        const newId = `box-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (activeTool === 'whiteout' || activeTool === 'redact' || activeTool === 'highlight') {
          setAnnotations((prev) => [
            ...prev,
            { id: newId, kind: activeTool, page: currentPage, ...finalRect },
          ]);
          setSelectedId(newId);
        } else if (activeTool === 'shape') {
          setAnnotations((prev) => [
            ...prev,
            {
              id: newId,
              kind: 'shape',
              variant: shapeVariant,
              page: currentPage,
              ...finalRect,
              color: activeColor,
              strokeWidth,
            },
          ]);
          setSelectedId(newId);
        }
      }
    };

    // Update selected text item in real time as user edits contextual box
    const handleSelectedTextUpdate = (newVal: string) => {
      setTextInput(newVal);
      if (selectedId) {
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === selectedId && (a.kind === 'text' || a.kind === 'text-replace') ? { ...a, text: newVal } : a
          )
        );
      }
    };

    const handleStyleUpdate = (patch: { color?: string; fontSize?: number; bold?: boolean }) => {
      if (patch.color !== undefined) setActiveColor(patch.color);
      if (patch.fontSize !== undefined) setFontSize(patch.fontSize);
      if (patch.bold !== undefined) setIsBold(patch.bold);

      if (selectedId) {
        setAnnotations((prev) =>
          prev.map((a) => {
            if (a.id !== selectedId) return a;
            if (a.kind === 'text' || a.kind === 'text-replace') {
              return { ...a, ...patch };
            }
            if (a.kind === 'shape' && patch.color !== undefined) {
              return { ...a, color: patch.color };
            }
            return a;
          })
        );
      }
    };

    const handleResizeSelectedBox = (newWidthPct: number) => {
      if (!selectedId) return;
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== selectedId) return a;
          if ('wPct' in a && a.wPct && a.hPct) {
            const ratio = a.hPct / a.wPct;
            return { ...a, wPct: newWidthPct, hPct: Math.max(2, newWidthPct * ratio) };
          }
          return a;
        })
      );
    };

    // Find & Replace across current page extracted text spans
    const handleFindAndReplace = () => {
      const needle = findText.trim();
      if (!needle) return;
      const matches = extractedSpans.filter((sp) => sp.text.toLowerCase().includes(needle.toLowerCase()));
      if (matches.length === 0) {
        onStatusChange(t(`या पानावर "${needle}" सापडले नाही.`, `"${needle}" not found on this page.`));
        return;
      }

      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const newAnns: PdfAnnotation[] = matches.map((sp, i) => ({
        id: `fr-${Date.now()}-${i}`,
        kind: 'text-replace',
        page: currentPage,
        xPct: sp.xPct,
        yPct: sp.yPct,
        wPct: sp.wPct,
        hPct: sp.hPct,
        bgColor: sampleBackgroundColor(sp.xPct, sp.yPct, sp.hPct),
        text: sp.text.replace(regex, replaceText),
        color: activeColor,
        fontSize: sp.fontSize,
        bold: false,
      }));

      setAnnotations((prev) => [...prev, ...newAnns]);
      onStatusChange(
        t(
          `"${needle}" ची ${matches.length} ठिकाणे "${replaceText}" ने बदलली! ✓`,
          `Replaced ${matches.length} occurrence(s) of "${needle}"! ✓`
        )
      );
    };

    // Insert Image / Logo on PDF page
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = inspectUploadedFileBytes(bytes, file.name, file.type, 'image');
      if (!check.valid) {
        onStatusChange(t('अवैध फोटो फाईल! कृपया वैध JPG किंवा PNG निवडा.', 'Invalid image file. Please select a valid JPG or PNG.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const img = await ensureImageLoaded(dataUrl);
          const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
          const pageAspect = pageDims.height / Math.max(1, pageDims.width);
          const wPct = 24;
          const hPct = Math.min(50, (wPct * aspect) / pageAspect);
          const id = `img-${Date.now()}`;
          setAnnotations((prev) => [
            ...prev,
            { id, kind: 'image', page: currentPage, xPct: 35, yPct: 35, wPct, hPct, dataUrl },
          ]);
          setSelectedId(id);
          setActiveTool('select');
          onStatusChange(t('फोटो पानावर जोडला! ड्रॅग करून जागा व आकार बदला.', 'Image added! Drag to move or resize.'));
        } catch {}
      };
      reader.readAsDataURL(file);
    };

    // Signature Modal drawing handlers
    const startSigDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsSigDrawing(true);
      const canvas = sigPadRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
    };

    const moveSigDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isSigDrawing) return;
      const canvas = sigPadRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineTo(((e.clientX - rect.left) / rect.width) * canvas.width, ((e.clientY - rect.top) / rect.height) * canvas.height);
      ctx.stroke();
    };

    const clearSigPad = () => {
      const canvas = sigPadRef.current;
      if (!canvas) return;
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      setTypedSignature('');
    };

    const placeDrawnSignature = async () => {
      const canvas = sigPadRef.current;
      let sigDataUrl = '';
      if (typedSignature.trim()) {
        const tmp = document.createElement('canvas');
        tmp.width = 480;
        tmp.height = 150;
        const ctx = tmp.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'italic 700 44px "Noto Sans Devanagari", Georgia, serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(typedSignature.trim(), 16, 75, 448);
          sigDataUrl = tmp.toDataURL('image/png');
        }
      } else if (canvas) {
        sigDataUrl = canvas.toDataURL('image/png');
      }
      if (!sigDataUrl) return;

      await ensureImageLoaded(sigDataUrl);
      const id = `sig-${Date.now()}`;
      setAnnotations((prev) => [
        ...prev,
        { id, kind: 'signature', page: currentPage, xPct: 62, yPct: 76, wPct: 26, hPct: 9, dataUrl: sigDataUrl },
      ]);
      setSelectedId(id);
      setShowSigModal(false);
      setActiveTool('select');
      onStatusChange(t('सही पानावर जोडली! हवी तिथे ड्रॅग करा.', 'Signature placed! Drag to position.'));
    };

    const handleSigFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = inspectUploadedFileBytes(bytes, file.name, file.type, 'image');
      if (!check.valid) {
        onStatusChange(t('अवैध सही फोटो! कृपया वैध JPG किंवा PNG निवडा.', 'Invalid image file for signature.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await ensureImageLoaded(dataUrl);
        const id = `sig-${Date.now()}`;
        setAnnotations((prev) => [
          ...prev,
          { id, kind: 'signature', page: currentPage, xPct: 62, yPct: 76, wPct: 24, hPct: 9, dataUrl },
        ]);
        setSelectedId(id);
        setShowSigModal(false);
        setActiveTool('select');
        onStatusChange(t('सहीचा फोटो पानावर जोडला!', 'Signature image placed!'));
      };
      reader.readAsDataURL(file);
    };

    // High-Res Export to Universal Classic PDF (WPS Office, Adobe Reader, Foxit, Chrome, Mobile Safe)
    const exportEditedPdf = useCallback(async (): Promise<Uint8Array | null> => {
      if (!pdfBytes) {
        onStatusChange(t('कृपया एडिट करण्यासाठी आधी PDF फाइल निवडा.', 'Please upload a PDF file first.'));
        return null;
      }

      setIsExporting(true);
      onStatusChange(t('सर्व संगणकांवर चालणारी PDF तयार होत आहे...', 'Building universal WPS-compatible PDF...'));

      let pdfJsDoc: any = null;
      try {
        const { doc: srcDoc } = await loadCleanPdfDocument(pdfBytes);
        const outDoc = await PDFDocument.create();
        const totalPages = srcDoc.getPageCount();
        const hasEdits = annotations.length > 0;

        // Preload PDF.js doc when flattening edited pages for 100% WPS / Printer compatibility
        pdfJsDoc =
          wpsSafeMode && typeof window !== 'undefined' && window.pdfjsLib
            ? await window.pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise.catch(() => null)
            : null;

        for (let i = 0; i < totalPages; i++) {
          const pNum = i + 1;
          let pageAnns = annotations.filter((a) => a.page === pNum);

          // If user didn't place any visual item on any page yet, place current text note cleanly on page 1
          if (!hasEdits && pNum === 1 && textInput.trim()) {
            pageAnns = [
              {
                id: 'quick-note',
                kind: 'text',
                page: 1,
                xPct: 5,
                yPct: 93,
                text: textInput.trim().slice(0, 80),
                color: activeColor,
                fontSize: 13,
                bold: true,
              },
            ];
          }

          if (pageAnns.length > 0 && pdfJsDoc) {
            const jsPage = await pdfJsDoc.getPage(pNum);
            const baseVp = jsPage.getViewport({ scale: 1 });
            const renderScale = Math.min(2.4, Math.max(1.6, 1650 / Math.max(1, baseVp.width)));
            const vp = jsPage.getViewport({ scale: renderScale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(vp.width));
            canvas.height = Math.max(1, Math.round(vp.height));
            const ctx = canvas.getContext('2d');

            try {
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await jsPage.render({ canvasContext: ctx, viewport: vp }).promise;
                await renderAnnotationsToContext(ctx, canvas.width, canvas.height, pageAnns);

                const jpgBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
                  canvas.toBlob(
                    (blob) => {
                      if (!blob) return reject(new Error('JPEG export failed'));
                      blob.arrayBuffer().then(resolve, reject);
                    },
                    'image/jpeg',
                    0.92
                  );
                });

                const embeddedJpg = await outDoc.embedJpg(jpgBytes);
                const outW = Math.min(14400, Math.max(72, baseVp.width));
                const outH = Math.min(14400, Math.max(72, baseVp.height));
                const outPage = outDoc.addPage([outW, outH]);
                outPage.drawImage(embeddedJpg, { x: 0, y: 0, width: outW, height: outH });
                continue;
              }
            } finally {
              releaseCanvasMemory(canvas);
              jsPage.cleanup?.();
            }
          }

          // Copy clean page (either unedited or vector overlay mode)
          const [copiedPage] = await outDoc.copyPages(srcDoc, [i]);
          const addedPage = outDoc.addPage(copiedPage);

          if (pageAnns.length > 0) {
            const { width, height } = addedPage.getSize();
            const mb = addedPage.getMediaBox();
            const rot = ((addedPage.getRotation().angle % 360) + 360) % 360;
            const isSwapped = rot === 90 || rot === 270;
            const visualW = isSwapped ? height : width;
            const visualH = isSwapped ? width : height;

            const overlayScale = 2.2;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(820, Math.round(visualW * overlayScale));
            canvas.height = Math.max(820, Math.round(visualH * overlayScale));
            const ctx = canvas.getContext('2d');
            try {
              if (ctx) {
                await renderAnnotationsToContext(ctx, canvas.width, canvas.height, pageAnns);
                const pngBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
                  canvas.toBlob(
                    (blob) => {
                      if (!blob) return reject(new Error('PNG export failed'));
                      blob.arrayBuffer().then(resolve, reject);
                    },
                    'image/png'
                  );
                });
                const embeddedOverlay = await outDoc.embedPng(pngBytes);

                if (rot === 90) {
                  addedPage.drawImage(embeddedOverlay, {
                    x: mb.x + width,
                    y: mb.y,
                    width: height,
                    height: width,
                    rotate: degrees(90),
                  });
                } else if (rot === 180) {
                  addedPage.drawImage(embeddedOverlay, {
                    x: mb.x + width,
                    y: mb.y + height,
                    width: width,
                    height: height,
                    rotate: degrees(180),
                  });
                } else if (rot === 270) {
                  addedPage.drawImage(embeddedOverlay, {
                    x: mb.x,
                    y: mb.y + height,
                    width: height,
                    height: width,
                    rotate: degrees(-90),
                  });
                } else {
                  addedPage.drawImage(embeddedOverlay, { x: mb.x, y: mb.y, width, height });
                }
              }
            } finally {
              releaseCanvasMemory(canvas);
            }
          }

          if (i % 3 === 2) {
            await yieldToUi();
          }
        }

        const outBytes = await saveUniversalPdf(outDoc, pdfBytes, { expectedPages: totalPages });
        const baseName = (fileName || 'document.pdf').replace(/\.pdf$/i, '');
        onExportReady(outBytes, `${baseName}-edited.pdf`);
        return outBytes;
      } catch (err) {
        console.error('Export edited PDF failed:', err);
        const msg = err instanceof PdfOperationError ? err.message : t('PDF सेव्ह करताना त्रुटी आली.', 'Error exporting edited PDF.');
        onStatusChange(msg);
        return null;
      } finally {
        await pdfJsDoc?.destroy?.();
        setIsExporting(false);
      }
    }, [pdfBytes, annotations, textInput, activeColor, fileName, wpsSafeMode, onExportReady, onStatusChange, renderAnnotationsToContext, t]);

    useImperativeHandle(
      ref,
      () => ({
        exportEditedPdf,
        getAnnotationCount: () => annotations.length,
      }),
      [exportEditedPdf, annotations.length]
    );

    const selectedAnnotation = annotations.find((a) => a.id === selectedId) || null;
    const currentPageAnns = annotations.filter((a) => a.page === currentPage);

    return (
      <div className="space-y-3">
        <input ref={imageUploadRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <input ref={sigUploadRef} type="file" accept="image/*" onChange={handleSigFileUpload} className="hidden" />

        {/* Maha Corner Tool Main Editor Ribbon */}
        <div className="p-3 rounded-2xl bg-slate-950 text-white border border-slate-800 shadow-lg flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'select' as const, icon: MousePointer2, mr: 'निवडा / बदला', en: 'Edit Text' },
              { id: 'text' as const, icon: Type, mr: 'नवीन मजकूर', en: 'Add Text' },
              { id: 'image' as const, icon: ImageIcon, mr: 'फोटो / लोगो', en: 'Image' },
              { id: 'signature' as const, icon: PenTool, mr: 'सही', en: 'Sign' },
              { id: 'whiteout' as const, icon: Eraser, mr: 'व्हाईटआऊट', en: 'Whiteout' },
              { id: 'redact' as const, icon: ShieldAlert, mr: 'ब्लॅक रेडॅक्ट', en: 'Redact' },
              { id: 'highlight' as const, icon: Highlighter, mr: 'हायलाईट', en: 'Highlight' },
              { id: 'shape' as const, icon: Shapes, mr: 'आकार', en: 'Shapes' },
              { id: 'draw' as const, icon: PenTool, mr: 'पेन', en: 'Draw' },
            ].map((tool) => {
              const IconComp = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    if (tool.id === 'image') {
                      imageUploadRef.current?.click();
                      return;
                    }
                    if (tool.id === 'signature') {
                      setShowSigModal(true);
                      return;
                    }
                    setActiveTool(tool.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/25 ring-2 ring-amber-300/70'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{t(tool.mr, tool.en)}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowFindReplace((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 ${
                showFindReplace
                  ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-300/60'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-sky-300 border border-slate-700'
              }`}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>{t('शोध व बदला', 'Find & Replace')}</span>
            </button>
          </div>

          {pdfBytes && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setWpsSafeMode((v) => !v)}
                title={t(
                  'WPS Office, Adobe Reader व सर्व कॉम्प्युटर सॉफ्टवेअरवर 100% ओपन होण्यासाठी फ्लॅट मोड',
                  'Flatten edited pages for 100% compatibility in WPS Office & desktop PDF viewers'
                )}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  wpsSafeMode
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{wpsSafeMode ? t('WPS सेफ ✓', 'WPS Safe ✓') : t('Vector मोड', 'Vector Mode')}</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={exportEditedPdf}
                className="px-4 py-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 disabled:opacity-60 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{t('बदल सेव्ह करा', 'Apply & Save PDF')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Find & Replace Drawer */}
        {showFindReplace && pdfBytes && (
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 flex flex-wrap items-end gap-2.5">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t('पानावर शोधायचा शब्द:', 'Find Text on Page:')}
              </label>
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder={t('उदा. जुने नाव / तारीख...', 'e.g. Old word...')}
                className="w-full h-9 px-3 rounded-xl bg-white border border-sky-300 text-xs font-semibold text-slate-900"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t('त्याजागी नवीन मजकूर:', 'Replace With:')}
              </label>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder={t('नवीन अचूक शब्द...', 'New text...')}
                className="w-full h-9 px-3 rounded-xl bg-white border border-sky-300 text-xs font-semibold text-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={handleFindAndReplace}
              className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer"
            >
              {t('सर्व बदला', 'Replace All')}
            </button>
          </div>
        )}

        {/* Contextual Properties Bar */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
          {/* Text Input (For New Text OR Selected Text/Replacement) */}
          {(activeTool === 'text' ||
            (selectedAnnotation && (selectedAnnotation.kind === 'text' || selectedAnnotation.kind === 'text-replace'))) && (
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => handleSelectedTextUpdate(e.target.value)}
                placeholder={t('मराठी किंवा English मजकूर लिहा...', 'Type Marathi or English text...')}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleStyleUpdate({ bold: !isBold })}
                className={`h-9 px-2.5 rounded-xl border text-xs font-black cursor-pointer ${
                  isBold ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                }`}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <select
                value={fontSize}
                onChange={(e) => handleStyleUpdate({ fontSize: Number(e.target.value) })}
                className="h-9 px-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800"
              >
                {[10, 12, 14, 16, 18, 22, 26, 32, 40].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}px
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shape Variant Selector */}
          {activeTool === 'shape' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'rect' as const, icon: Square, label: t('चौकट', 'Box') },
                { id: 'filled-rect' as const, icon: Square, label: t('रंगीत बॉक्स', 'Filled') },
                { id: 'circle' as const, icon: Circle, label: t('वर्तुळ', 'Circle') },
                { id: 'arrow' as const, icon: ArrowRight, label: t('बाण', 'Arrow') },
                { id: 'line' as const, icon: Minus, label: t('रेषा', 'Line') },
                { id: 'check' as const, icon: Check, label: '✓' },
                { id: 'cross' as const, icon: X, label: '✗' },
              ].map((s) => {
                const IconS = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShapeVariant(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                      shapeVariant === s.id
                        ? 'bg-amber-400 text-slate-950 border-amber-500'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <IconS className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Resize Slider when Image / Signature / Shape Selected */}
          {selectedAnnotation &&
            (selectedAnnotation.kind === 'image' ||
              selectedAnnotation.kind === 'signature' ||
              selectedAnnotation.kind === 'shape' ||
              selectedAnnotation.kind === 'whiteout' ||
              selectedAnnotation.kind === 'redact' ||
              selectedAnnotation.kind === 'highlight') && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">{t('आकार:', 'Width:')}</span>
                <input
                  type="range"
                  min={4}
                  max={85}
                  value={Math.round(selectedAnnotation.wPct)}
                  onChange={(e) => handleResizeSelectedBox(Number(e.target.value))}
                  className="w-28 accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-700">{Math.round(selectedAnnotation.wPct)}%</span>
              </div>
            )}

          {/* Pen Stroke Thickness */}
          {(activeTool === 'draw' || activeTool === 'shape') && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">{t('जाडी:', 'Stroke:')}</span>
              {[2, 4, 7].map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setStrokeWidth(sw)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                    strokeWidth === sw
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {sw}px
                </button>
              ))}
            </div>
          )}

          {/* Color Palette */}
          <div className="flex items-center gap-1.5">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => handleStyleUpdate({ color: c.hex })}
                title={t(c.labelMr, c.labelEn)}
                className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                  activeColor === c.hex ? 'border-amber-500 scale-110 ring-2 ring-amber-300' : 'border-slate-300'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          {/* Delete Selected / Undo / Clear */}
          <div className="flex items-center gap-1.5 ml-auto">
            {selectedAnnotation && (
              <button
                type="button"
                onClick={() => {
                  setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotation.id));
                  setSelectedId(null);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('निवडलेले काढा', 'Delete')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setAnnotations((prev) => {
                  const idx = [...prev].reverse().findIndex((a) => a.page === currentPage);
                  if (idx === -1) return prev;
                  const realIdx = prev.length - 1 - idx;
                  return prev.filter((_, i) => i !== realIdx);
                });
                setSelectedId(null);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{t('मागे घ्या', 'Undo')}</span>
            </button>

            {currentPageAnns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAnnotations((prev) => prev.filter((a) => a.page !== currentPage));
                  setSelectedId(null);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 text-xs font-bold cursor-pointer"
              >
                {t('पान साफ करा', 'Clear Page')}
              </button>
            )}
          </div>
        </div>

        {/* Helpful Mode Hint */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium px-1">
          <span>
            {activeTool === 'select' &&
              t(
                '💡 PDF मधील निळ्या चौकटीतील कोणत्याही विद्यमान शब्दावर क्लिक करून तो शब्द थेट बदला, किंवा जोडलेला मजकूर/फोटो ड्रॅग करा.',
                '💡 Click any highlighted existing text on the PDF to edit/replace it directly, or drag existing edits.'
              )}
            {activeTool === 'text' &&
              t('💡 वरील बॉक्समध्ये मजकूर लिहा आणि पानावर जिथे हवा तिथे क्लिक/टॅप करा.', '💡 Type your text above and click/tap anywhere on the page to place it.')}
            {activeTool === 'whiteout' &&
              t('💡 जुना मजकूर पांढऱ्या पट्टीने झाकण्यासाठी पानावर ड्रॅग किंवा टॅप करा.', '💡 Drag or tap over old text to cover it cleanly with whiteout.')}
            {activeTool === 'redact' &&
              t('💡 गोपनीय माहिती (आधार/नंबर) काळ्या पट्टीने लपवण्यासाठी ड्रॅग किंवा टॅप करा.', '💡 Drag or tap to permanently cover sensitive text with black redaction.')}
            {activeTool === 'highlight' &&
              t('💡 महत्त्वाच्या ओळी पिवळ्या रंगात हायलाईट करण्यासाठी ड्रॅग करा.', '💡 Drag or tap to highlight important lines.')}
            {activeTool === 'shape' &&
              t('💡 पानावर चौकट, वर्तुळ, बाण किंवा ✓ चिन्ह टाकण्यासाठी ड्रॅग किंवा टॅप करा.', '💡 Drag or tap on the page to place the selected shape or ✓ mark.')}
            {activeTool === 'draw' &&
              t('💡 पानावर बोटाने किंवा माऊसने थेट लिहा / काढा.', '💡 Draw freehand directly on the page with mouse or touch.')}
          </span>

          {/* Page Switcher & Zoom Controls */}
          {pdfBytes && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.max(60, z - 15))}
                  className="p-1 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-black text-slate-800 w-10 text-center">{zoomPct}%</span>
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.min(160, z + 15))}
                  className="p-1 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-1.5 py-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 text-slate-700 disabled:opacity-35 cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-black text-slate-800 px-1.5">
                    {t(`पान ${currentPage} / ${pageCount}`, `Page ${currentPage} / ${pageCount}`)}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= pageCount}
                    onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                    className="p-1 text-slate-700 disabled:opacity-35 cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive PDF Page Workspace */}
        {pdfBytes ? (
          <div className="rounded-2xl bg-slate-200/85 border border-slate-300 p-3 sm:p-5 overflow-auto max-h-[75vh] shadow-inner">
            <div
              className="relative mx-auto bg-white shadow-2xl border border-slate-300 transition-all"
              style={{ width: `${zoomPct}%`, maxWidth: `${Math.round(900 * (zoomPct / 100))}px`, minWidth: '280px' }}
            >
              {pageLoading && (
                <div className="absolute inset-0 z-20 bg-white/85 flex items-center justify-center text-xs font-bold text-slate-700">
                  {t('PDF पान लोड होत आहे...', 'Rendering PDF page...')}
                </div>
              )}
              <canvas ref={baseCanvasRef} className="w-full h-auto block select-none" />
              <canvas
                ref={overlayCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute inset-0 w-full h-full touch-none z-10 ${
                  activeTool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'
                }`}
              />
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 text-center">
            {t(
              'प्रथम वरील बॉक्समधून तुमची PDF फाइल अपलोड करा — येथे संपूर्ण PDF एडिटर उघडेल आणि तुम्ही विद्यमान मजकूर बदलू शकाल, नवीन मजकूर, फोटो, सही, आकार, व्हाईटआऊट व हायलाईट करू शकाल.',
              'Upload your PDF file above first — the full interactive PDF Editor will open here to edit existing text, add new text, images, signatures, shapes, whiteout, and highlights.'
            )}
          </div>
        )}

        {/* Signature Modal (Draw / Type / Upload) */}
        {showSigModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-amber-600" />
                  <span>{t('डिजिटल सही तयार करा (Add Signature)', 'Create Signature')}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSigModal(false)}
                  className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{t('खाली माऊसने किंवा बोटाने सही काढा:', 'Draw signature below:')}</span>
                  <button type="button" onClick={clearSigPad} className="text-rose-600 hover:text-rose-700 cursor-pointer">
                    {t('पुसा (Clear)', 'Clear')}
                  </button>
                </div>
                <canvas
                  ref={sigPadRef}
                  width={420}
                  height={150}
                  onPointerDown={startSigDraw}
                  onPointerMove={moveSigDraw}
                  onPointerUp={() => setIsSigDrawing(false)}
                  onPointerCancel={() => setIsSigDrawing(false)}
                  className="w-full h-36 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl cursor-crosshair touch-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {t('किंवा नाव टाईप करून सही बनवा:', 'Or type name as signature:')}
                </label>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder={t('उदा. कमलेश पाटील', 'e.g. Kamlesh Patil')}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => sigUploadRef.current?.click()}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('सही फोटो अपलोड करा', 'Upload Image')}</span>
                </button>

                <button
                  type="button"
                  onClick={placeDrawnSignature}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  {t('पानावर सही ठेवा ✓', 'Place Signature on PDF ✓')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

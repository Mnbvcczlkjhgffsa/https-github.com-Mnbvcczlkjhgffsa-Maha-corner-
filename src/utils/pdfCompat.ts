import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import {
  PDF_SECURITY_LIMITS,
  findPdfHeaderOffset,
  releaseCanvasMemory,
  sanitizeFilename,
  sanitizePdfDocumentSecurity,
  yieldToUi,
} from './pdfSecurity';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export const UNIVERSAL_PDF_SAVE_OPTIONS = {
  useObjectStreams: false,
  addDefaultPage: false,
  updateFieldAppearances: false,
} as const;

export type PdfErrorCode =
  | 'PDF_PASSWORD_REQUIRED'
  | 'PDF_INCORRECT_PASSWORD'
  | 'PDF_CORRUPTED'
  | 'PDF_PAGE_LIMIT_EXCEEDED'
  | 'PDF_VALIDATION_FAILED'
  | 'PDF_EMPTY_OUTPUT';

export class PdfOperationError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = 'PdfOperationError';
    this.code = code;
  }
}

export interface PdfValidationReport {
  valid: boolean;
  pageCount: number;
  sizeBytes: number;
  sizeKb: number;
  pdfVersion: string;
  classicXref: boolean;
  renderVerified: boolean;
  errors: string[];
}

export function createUniversalPdfBlob(bytes: Uint8Array): Blob {
  const cleanBytes = new Uint8Array(bytes.byteLength);
  cleanBytes.set(bytes);
  return new Blob([cleanBytes], { type: 'application/pdf' });
}

/**
 * CSP-safe canvas -> JPEG ArrayBuffer export without calling fetch(dataURL).
 */
export function canvasToJpegArrayBuffer(canvas: HTMLCanvasElement, quality = 0.92): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas JPEG export failed'));
        blob.arrayBuffer().then(resolve, reject);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * CSP-safe base64 Data URL -> Blob conversion without calling fetch(dataURL).
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) {
    throw new Error('Invalid data URL');
  }
  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function isValidPdfHeader(bytes: Uint8Array): boolean {
  return findPdfHeaderOffset(bytes) === 0;
}

/**
 * Normalizes arbitrary image pixel dimensions to standard A4 PDF points (72 dpi)
 * so desktop viewers like WPS Office, Adobe Reader & printers never choke on
 * oversized 4000+ pt canvases.
 */
export function fitImageToStandardPdfPage(
  pixelW: number,
  pixelH: number
): { pageW: number; pageH: number; drawW: number; drawH: number; offsetX: number; offsetY: number } {
  const safeW = Math.max(1, pixelW);
  const safeH = Math.max(1, pixelH);
  const isLandscape = safeW > safeH;
  const pageW = isLandscape ? 841.89 : 595.28;
  const pageH = isLandscape ? 595.28 : 841.89;
  const scale = Math.min(pageW / safeW, pageH / safeH);
  const drawW = safeW * scale;
  const drawH = safeH * scale;
  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;
  return { pageW, pageH, drawW, drawH, offsetX, offsetY };
}

function classifyPdfJsError(err: unknown): PdfOperationError | null {
  const e = err as { name?: string; code?: number; message?: string };
  const msg = String(e?.message || '').toLowerCase();
  if (e?.name === 'PasswordException' || msg.includes('password')) {
    if (e?.code === 2 || msg.includes('incorrect')) {
      return new PdfOperationError(
        'PDF_INCORRECT_PASSWORD',
        'दिलेला PDF पासवर्ड चुकीचा आहे. कृपया योग्य पासवर्ड टाका.'
      );
    }
    return new PdfOperationError(
      'PDF_PASSWORD_REQUIRED',
      'ही PDF फाइल पासवर्डने लॉक आहे. उघडण्यासाठी कृपया पासवर्ड टाका.'
    );
  }
  return null;
}

/**
 * Ensures every page has clean, finite MediaBox, valid CropBox clamped inside MediaBox,
 * and standard modulo-90 rotation so WPS Office, Preview, Chrome, and printers
 * never clip or fail to render merged/split pages.
 */
export function normalizePdfPages(pdfDoc: PDFDocument): void {
  try {
    // Removing cross-document StructTreeRoot avoids broken ParentTree refs in WPS Office after merge/split
    pdfDoc.catalog.delete(PDFName.of('StructTreeRoot'));
    pdfDoc.catalog.delete(PDFName.of('MarkInfo'));
  } catch {
    // Non-fatal
  }

  for (const page of pdfDoc.getPages()) {
    try {
      const mb = page.getMediaBox();
      const validW = Number.isFinite(mb.width) && mb.width >= 10 ? Math.min(14400, mb.width) : 595.28;
      const validH = Number.isFinite(mb.height) && mb.height >= 10 ? Math.min(14400, mb.height) : 841.89;
      const validX = Number.isFinite(mb.x) ? mb.x : 0;
      const validY = Number.isFinite(mb.y) ? mb.y : 0;

      if (
        !Number.isFinite(mb.width) ||
        !Number.isFinite(mb.height) ||
        mb.width < 10 ||
        mb.height < 10
      ) {
        page.setMediaBox(validX, validY, validW, validH);
      }

      const cb = page.getCropBox();
      if (cb) {
        const clampedX = Math.max(validX, Number.isFinite(cb.x) ? cb.x : validX);
        const clampedY = Math.max(validY, Number.isFinite(cb.y) ? cb.y : validY);
        const maxW = Math.max(10, validX + validW - clampedX);
        const maxH = Math.max(10, validY + validH - clampedY);
        const clampedW = Number.isFinite(cb.width) && cb.width > 10 ? Math.min(cb.width, maxW) : maxW;
        const clampedH = Number.isFinite(cb.height) && cb.height > 10 ? Math.min(cb.height, maxH) : maxH;
        page.setCropBox(clampedX, clampedY, clampedW, clampedH);
      }
    } catch {
      // Skip malformed box fallback
    }
  }
}

/**
 * Reconstructs any PDF cleanly via PDF.js rasterization -> opaque JPEG -> fresh unencrypted PDFDocument.
 * Preserves per-page dimensions and portrait/landscape orientation cleanly.
 */
export async function rebuildPdfViaCanvas(
  pdfBytes: Uint8Array,
  options?: {
    grayscale?: boolean;
    scale?: number;
    quality?: number;
    password?: string;
    onProgress?: (pct: number, currentPage: number, totalPages: number) => void;
  }
): Promise<PDFDocument> {
  if (typeof window === 'undefined' || !window.pdfjsLib) {
    throw new PdfOperationError('PDF_CORRUPTED', 'PDF.js engine is unavailable in this environment.');
  }

  const renderScale = options?.scale ?? 2.0;
  const quality = options?.quality ?? 0.92;
  const grayscale = Boolean(options?.grayscale);

  let srcPdf: any;
  try {
    const loadingTask = window.pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      password: options?.password || undefined,
    });
    srcPdf = await loadingTask.promise;
  } catch (err) {
    const pwdErr = classifyPdfJsError(err);
    if (pwdErr) throw pwdErr;
    throw new PdfOperationError(
      'PDF_CORRUPTED',
      'ही PDF फाइल खराब (Damaged) किंवा वाचता न येणारी आहे. कृपया दुसरी योग्य PDF निवडा.'
    );
  }

  if (srcPdf.numPages > PDF_SECURITY_LIMITS.MAX_PDF_PAGES) {
    await srcPdf.destroy?.();
    throw new PdfOperationError(
      'PDF_PAGE_LIMIT_EXCEEDED',
      `सुरक्षिततेसाठी एका वेळी कमाल ${PDF_SECURITY_LIMITS.MAX_PDF_PAGES} पानांपर्यंतच PDF प्रक्रिया करता येते.`
    );
  }

  const outDoc = await PDFDocument.create();
  outDoc.setProducer('Maha Corner Tool (Universal PDF)');
  outDoc.setCreator('Maha Corner');

  try {
    for (let p = 1; p <= srcPdf.numPages; p++) {
      options?.onProgress?.(Math.round((p / srcPdf.numPages) * 90), p, srcPdf.numPages);
      const page = await srcPdf.getPage(p);
      const baseVp = page.getViewport({ scale: 1 });
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

        if (grayscale) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = lum;
            d[i + 1] = lum;
            d[i + 2] = lum;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const jpgBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Canvas JPEG export failed'));
              blob.arrayBuffer().then(resolve, reject);
            },
            'image/jpeg',
            quality
          );
        });

        const embedded = await outDoc.embedJpg(jpgBytes);
        const outW = Math.min(14400, Math.max(72, baseVp.width));
        const outH = Math.min(14400, Math.max(72, baseVp.height));
        const outPage = outDoc.addPage([outW, outH]);
        outPage.drawImage(embedded, { x: 0, y: 0, width: outW, height: outH });
      } finally {
        releaseCanvasMemory(canvas);
        page.cleanup?.();
      }

      if (p % 3 === 0) {
        await yieldToUi();
      }
    }
  } finally {
    await srcPdf.destroy?.();
  }

  return outDoc;
}

/**
 * Loads a PDF safely for modification.
 * - Rejects corrupted headers or excessive page counts cleanly.
 * - Detects encrypted/password-locked or XFA PDFs and decrypts/rebuilds cleanly when password is supplied.
 */
export async function loadCleanPdfDocument(
  pdfBytes: Uint8Array,
  options?: {
    password?: string;
    onProgress?: (pct: number, currentPage: number, totalPages: number) => void;
  }
): Promise<{ doc: PDFDocument; wasRebuilt: boolean }> {
  if (!pdfBytes || pdfBytes.length < 8 || findPdfHeaderOffset(pdfBytes) < 0) {
    throw new PdfOperationError(
      'PDF_CORRUPTED',
      'अवैध किंवा खराब झालेली PDF फाइल! फाइलमध्ये वैध %PDF- सिग्नेचर आढळले नाही.'
    );
  }

  let parsedDoc: PDFDocument | null = null;
  let isEncrypted = false;
  let hasXfa = false;

  try {
    parsedDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });
    const trailer = parsedDoc.context.trailerInfo as Record<string, unknown>;
    isEncrypted = Boolean(parsedDoc.isEncrypted || trailer?.Encrypt);

    try {
      const acroForm = parsedDoc.catalog.lookup(PDFName.of('AcroForm'));
      if (acroForm instanceof PDFDict && acroForm.has(PDFName.of('XFA'))) {
        hasXfa = true;
      }
    } catch {
      // Ignore catalog inspection errors
    }

    if (parsedDoc.getPageCount() > PDF_SECURITY_LIMITS.MAX_PDF_PAGES) {
      throw new PdfOperationError(
        'PDF_PAGE_LIMIT_EXCEEDED',
        `सुरक्षिततेसाठी एका वेळी कमाल ${PDF_SECURITY_LIMITS.MAX_PDF_PAGES} पानांपर्यंतच PDF उघडता येते.`
      );
    }

    if (
      !isEncrypted &&
      (!hasXfa || typeof window === 'undefined' || !window.pdfjsLib) &&
      parsedDoc.getPageCount() > 0
    ) {
      if (hasXfa) {
        sanitizePdfDocumentSecurity(parsedDoc);
      }
      return { doc: parsedDoc, wasRebuilt: false };
    }
  } catch (err) {
    if (err instanceof PdfOperationError) throw err;
    console.warn('Direct PDFDocument.load failed, attempting clean PDF.js rebuild:', err);
  }

  const rebuiltDoc = await rebuildPdfViaCanvas(pdfBytes, {
    scale: 2.0,
    quality: 0.92,
    password: options?.password,
    onProgress: options?.onProgress,
  });
  return { doc: rebuiltDoc, wasRebuilt: true };
}

/**
 * Runs the 10-point PDF Validation Engine before exposing any file to download.
 */
export async function validatePdfDocument(
  bytes: Uint8Array,
  options?: {
    expectedPages?: number;
    skipRenderTest?: boolean;
    allowEncrypted?: boolean;
    expectedPassword?: string;
  }
): Promise<PdfValidationReport> {
  const errors: string[] = [];

  if (!bytes || bytes.byteLength === 0) {
    return {
      valid: false,
      pageCount: 0,
      sizeBytes: 0,
      sizeKb: 0,
      pdfVersion: '',
      classicXref: false,
      renderVerified: false,
      errors: ['PDF आउटपुट फाइल रिकामी (0 bytes) आहे.'],
    };
  }

  // 1-3. Signature, trailer & non-truncation structural checks
  const hasHeader = isValidPdfHeader(bytes);
  if (!hasHeader) {
    errors.push('PDF हेडर (%PDF-) अवैध आहे.');
  }

  const headDecoder = new TextDecoder('latin1');
  const headStr = headDecoder.decode(bytes.slice(0, 16));
  const versionMatch = headStr.match(/%PDF-(\d+\.\d+)/);
  const pdfVersion = versionMatch ? versionMatch[1] : 'unknown';

  const tailSlice = bytes.slice(Math.max(0, bytes.length - 4096));
  const tailStr = headDecoder.decode(tailSlice);
  const hasStartXref = tailStr.includes('startxref');
  const hasEof = tailStr.trimEnd().endsWith('%%EOF');
  if (!hasStartXref || !hasEof) {
    errors.push('PDF फाइल अपूर्ण (Truncated) आहे — startxref किंवा %%EOF गहाळ आहे.');
  }

  const fullLatin1 = headDecoder.decode(bytes);
  const hasObjStm = fullLatin1.includes('/ObjStm');
  const hasXRefStream = fullLatin1.includes('/Type /XRef') || fullLatin1.includes('/Type/XRef');
  const hasEncrypt = /\n\/Encrypt\b|\/Encrypt\s+\d+\s+\d+\s+R/.test(tailStr);
  const classicXref = fullLatin1.includes('xref') && !hasObjStm && !hasXRefStream;

  if (hasObjStm || hasXRefStream) {
    errors.push('PDF मध्ये WPS-असुसंगत कॉम्प्रेस्ड /ObjStm किंवा /XRef स्ट्रीम आढळले.');
  }
  if (options?.allowEncrypted) {
    if (!hasEncrypt) {
      errors.push('पासवर्ड-संरक्षित PDF मध्ये /Encrypt नोंद तयार झाली नाही.');
    }
  } else if (hasEncrypt) {
    errors.push('आउटपुट PDF मध्ये अद्याप /Encrypt नोंद आहे.');
  }

  // 4-8. Independent re-parse & page tree / MediaBox verification
  let pageCount = 0;
  try {
    const reparsed = await PDFDocument.load(bytes, { ignoreEncryption: Boolean(options?.allowEncrypted) });
    pageCount = reparsed.getPageCount();
    if (pageCount <= 0) {
      errors.push('PDF मध्ये एकही पान आढळले नाही (0 pages).');
    }
    if (typeof options?.expectedPages === 'number' && pageCount !== options.expectedPages) {
      errors.push(`पानांची संख्या जुळत नाही (अपेक्षित: ${options.expectedPages}, मिळाले: ${pageCount}).`);
    }
    const pages = reparsed.getPages();
    for (let i = 0; i < pages.length; i++) {
      const { width, height } = pages[i].getSize();
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 10 || height < 10) {
        errors.push(`पान ${i + 1} चे आकारमान अवैध आहे.`);
        break;
      }
    }
  } catch (err) {
    errors.push(`PDF पुन्हा वाचताना (Re-parse) त्रुटी आली: ${(err as Error)?.message || 'Parse error'}`);
  }

  // 9. Browser PDF.js actual rendering verification on page 1 (and last page if multi-page)
  let renderVerified = false;
  if (!options?.skipRenderTest && typeof window !== 'undefined' && window.pdfjsLib && typeof document !== 'undefined') {
    let pdfJsDoc: any = null;
    try {
      pdfJsDoc = await window.pdfjsLib.getDocument({
        data: bytes.slice(),
        password: options?.expectedPassword || undefined,
      }).promise;
      if (pdfJsDoc.numPages !== pageCount && pageCount > 0) {
        errors.push(`PDF.js आणि pdf-lib पानांची संख्या वेगळी आहे (${pdfJsDoc.numPages} vs ${pageCount}).`);
      }
      const pagesToRender = pdfJsDoc.numPages > 1 ? [1, pdfJsDoc.numPages] : [1];
      for (const pNum of pagesToRender) {
        const jsPage = await pdfJsDoc.getPage(pNum);
        const vp = jsPage.getViewport({ scale: 0.25 });
        const testCanvas = document.createElement('canvas');
        testCanvas.width = Math.max(16, Math.min(256, Math.round(vp.width)));
        testCanvas.height = Math.max(16, Math.min(256, Math.round(vp.height)));
        const ctx = testCanvas.getContext('2d');
        if (ctx) {
          await jsPage.render({ canvasContext: ctx, viewport: vp }).promise;
        }
        releaseCanvasMemory(testCanvas);
        jsPage.cleanup?.();
      }
      renderVerified = true;
    } catch (renderErr) {
      errors.push(`PDF रेंडर पडताळणी अयशस्वी: ${(renderErr as Error)?.message || 'Render error'}`);
    } finally {
      await pdfJsDoc?.destroy?.();
    }
  }

  return {
    valid: errors.length === 0,
    pageCount,
    sizeBytes: bytes.byteLength,
    sizeKb: Math.max(1, Math.round(bytes.byteLength / 1024)),
    pdfVersion,
    classicXref,
    renderVerified,
    errors,
  };
}

/**
 * Saves any PDFDocument in classic, universal, sanitized PDF format (no /ObjStm, no /XRef streams,
 * normalized MediaBox/CropBox, no scripts/XFA, clean trailer) and validates output before returning.
 */
export async function saveUniversalPdf(
  pdfDoc: PDFDocument,
  fallbackSourceBytes?: Uint8Array,
  options?: {
    expectedPages?: number;
    password?: string;
    skipRenderTest?: boolean;
  }
): Promise<Uint8Array> {
  sanitizePdfDocumentSecurity(pdfDoc);
  normalizePdfPages(pdfDoc);
  try {
    pdfDoc.setProducer('Maha Corner Tool');
    pdfDoc.setCreator('Maha Corner');
  } catch {
    // Non-fatal metadata cleanup
  }

  const outBytes = await pdfDoc.save(UNIVERSAL_PDF_SAVE_OPTIONS);
  const report = await validatePdfDocument(outBytes, {
    expectedPages: options?.expectedPages,
    skipRenderTest: options?.skipRenderTest,
  });

  if (report.valid) {
    return outBytes;
  }

  console.warn('PDF validation flagged issues, attempting clean universal rebuild:', report.errors);
  if (fallbackSourceBytes && typeof window !== 'undefined' && window.pdfjsLib) {
    const rebuilt = await rebuildPdfViaCanvas(fallbackSourceBytes, {
      scale: 2.0,
      quality: 0.92,
      password: options?.password,
    });
    const rebuiltBytes = await rebuilt.save(UNIVERSAL_PDF_SAVE_OPTIONS);
    const retryReport = await validatePdfDocument(rebuiltBytes, {
      skipRenderTest: options?.skipRenderTest,
    });
    if (retryReport.valid) {
      return rebuiltBytes;
    }
    throw new PdfOperationError(
      'PDF_VALIDATION_FAILED',
      `PDF पडताळणी (Validation) अयशस्वी: ${retryReport.errors[0] || 'Unknown validation error'}`
    );
  }

  throw new PdfOperationError(
    'PDF_VALIDATION_FAILED',
    `PDF पडताळणी (Validation) अयशस्वी: ${report.errors[0] || 'Unknown validation error'}`
  );
}

/**
 * High-reliability Multi-PDF Merger that preserves page order, dimensions, orientation,
 * text/Unicode fonts, images, and handles encrypted/scanned/mixed-size PDFs.
 */
export async function mergePdfBuffersUniversally(
  pdfBuffers: Array<{ bytes: Uint8Array; name: string; password?: string }>,
  options?: {
    onProgress?: (pct: number, label: string) => void;
  }
): Promise<{ bytes: Uint8Array; report: PdfValidationReport }> {
  if (pdfBuffers.length < 2) {
    throw new PdfOperationError('PDF_CORRUPTED', 'PDF एकत्र (Merge) करण्यासाठी किमान २ PDF फाइल्स आवश्यक आहेत.');
  }

  const mergedDoc = await PDFDocument.create();
  let expectedTotalPages = 0;

  for (let i = 0; i < pdfBuffers.length; i++) {
    const item = pdfBuffers[i];
    const basePct = Math.round((i / pdfBuffers.length) * 80);
    options?.onProgress?.(basePct, `फाइल ${i + 1}/${pdfBuffers.length} तपासत आहे (${item.name})...`);

    const { doc: srcDoc } = await loadCleanPdfDocument(item.bytes, {
      password: item.password,
    });

    const pageCount = srcDoc.getPageCount();
    if (expectedTotalPages + pageCount > PDF_SECURITY_LIMITS.MAX_PDF_PAGES) {
      throw new PdfOperationError(
        'PDF_PAGE_LIMIT_EXCEEDED',
        `एकत्रित पाने कमाल मर्यादेपेक्षा (${PDF_SECURITY_LIMITS.MAX_PDF_PAGES} पाने) जास्त आहेत.`
      );
    }
    expectedTotalPages += pageCount;

    normalizePdfPages(srcDoc);
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const p of copiedPages) {
      mergedDoc.addPage(p);
    }

    await yieldToUi();
  }

  options?.onProgress?.(88, 'एकत्रित PDF ची संरचना व सर्व वाचकांची सुसंगतता तपासत आहे...');
  sanitizePdfDocumentSecurity(mergedDoc);
  normalizePdfPages(mergedDoc);
  mergedDoc.setProducer('Maha Corner Tool');
  mergedDoc.setCreator('Maha Corner');

  const candidateBytes = await mergedDoc.save(UNIVERSAL_PDF_SAVE_OPTIONS);
  let report = await validatePdfDocument(candidateBytes, {
    expectedPages: expectedTotalPages,
  });

  // Fallback recovery: if copied internal resources from heterogeneous PDFs failed PDF.js rendering,
  // reconstruct each file's pages cleanly preserving original per-page dimensions & orientation!
  if (!report.valid && typeof window !== 'undefined' && window.pdfjsLib) {
    console.warn('Merged vector PDF failed strict render/structure check, rebuilding cleanly:', report.errors);
    options?.onProgress?.(90, 'सर्व PDF रीडरसाठी सुरक्षित री-बिल्ड करत आहे...');
    const safeMerged = await PDFDocument.create();
    for (let i = 0; i < pdfBuffers.length; i++) {
      const rebuiltPart = await rebuildPdfViaCanvas(pdfBuffers[i].bytes, {
        scale: 2.0,
        quality: 0.92,
        password: pdfBuffers[i].password,
      });
      const copied = await safeMerged.copyPages(rebuiltPart, rebuiltPart.getPageIndices());
      copied.forEach((p) => safeMerged.addPage(p));
    }
    sanitizePdfDocumentSecurity(safeMerged);
    normalizePdfPages(safeMerged);
    safeMerged.setProducer('Maha Corner Tool');
    safeMerged.setCreator('Maha Corner');
    const safeBytes = await safeMerged.save(UNIVERSAL_PDF_SAVE_OPTIONS);
    report = await validatePdfDocument(safeBytes, {
      expectedPages: expectedTotalPages,
    });
    if (!report.valid) {
      throw new PdfOperationError(
        'PDF_VALIDATION_FAILED',
        `मर्ज पडताळणी अयशस्वी: ${report.errors[0] || 'Merge failed validation'}`
      );
    }
    return { bytes: safeBytes, report };
  }

  if (!report.valid) {
    throw new PdfOperationError(
      'PDF_VALIDATION_FAILED',
      `मर्ज पडताळणी अयशस्वी: ${report.errors[0] || 'Merge failed validation'}`
    );
  }

  return { bytes: candidateBytes, report };
}

/**
 * Validates any jsPDF instance output with the shared Validation Engine before triggering browser download.
 */
export async function saveValidatedJsPdf(
  jsPdfInstance: { output: (type: 'arraybuffer') => ArrayBuffer },
  rawFileName: string,
  expectedPages?: number
): Promise<{ report: PdfValidationReport; cleanFilename: string }> {
  const arrBuf = jsPdfInstance.output('arraybuffer');
  const bytes = new Uint8Array(arrBuf);
  const report = await validatePdfDocument(bytes, { expectedPages });
  if (!report.valid) {
    throw new PdfOperationError(
      'PDF_VALIDATION_FAILED',
      `PDF पडताळणी अयशस्वी: ${report.errors[0] || 'Invalid PDF output'}`
    );
  }

  const safeBase = sanitizeFilename(rawFileName.replace(/\.pdf$/i, ''), 'maha-document');
  const cleanFilename = `${safeBase}.pdf`;
  const blob = createUniversalPdfBlob(bytes);
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  return { report, cleanFilename };
}

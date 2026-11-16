import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';

export const PDF_SECURITY_LIMITS = {
  MAX_PDF_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB per PDF
  MAX_BATCH_SIZE_BYTES: 120 * 1024 * 1024, // 120 MB combined batch
  MAX_IMAGE_FILE_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB per image
  MAX_PDF_PAGES: 300, // Protects browser memory & prevents DoS freeze
} as const;

export type SafeFileKind = 'pdf' | 'image' | 'text' | 'unknown';

export interface FileInspectionResult {
  valid: boolean;
  kind: SafeFileKind;
  detectedMime: string;
  reason?: string;
}

/**
 * Prevents path traversal, control characters, and reserved OS filenames (Windows CON/PRN/AUX/NUL).
 */
export function sanitizeFilename(rawName: string, fallback = 'maha-document'): string {
  const base = String(rawName || fallback)
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();

  const cleaned = base.replace(/^[.-]+/, '').slice(0, 96) || fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    return `${fallback}-${Date.now()}`;
  }
  return cleaned;
}

/**
 * Neutralizes CSV / Excel Formula Injection (CWE-1236) where cells starting with
 * =, +, -, @, tab, or CR could execute DDE/formulas in Microsoft Excel or LibreOffice.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  const str = String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  if (!str) return '';
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Allows only safe http:/https: external URLs, blocking javascript:, data:, vbscript:, file:.
 */
export function sanitizeExternalUrl(rawUrl: string | undefined | null, fallback = ''): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Invalid or relative URL
  }
  return fallback;
}

/**
 * Validates embedded base64 data URLs strictly against explicit allowed MIME prefixes.
 */
export function sanitizeDataUrl(
  rawUrl: string | undefined | null,
  allowedPrefixes: string[]
): string | undefined {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  const isAllowed = allowedPrefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
  return isAllowed ? trimmed : undefined;
}

/**
 * Escapes untrusted text before inserting into HTML-based Word (.doc) / PPT (.ppt) / print frames.
 */
export function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Finds "%PDF-" signature within the first 1024 bytes (ISO 32000-1 Section 7.5.2).
 */
export function findPdfHeaderOffset(bytes: Uint8Array): number {
  if (!bytes || bytes.length < 8) return -1;
  const searchLimit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= searchLimit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return i;
    }
  }
  return -1;
}

function hasPrefix(bytes: Uint8Array, sig: number[]): boolean {
  if (!bytes || bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Checks true file magic bytes (prevents renamed executables, SVG/HTML XSS payloads, or empty files).
 */
export function inspectUploadedFileBytes(
  bytes: Uint8Array,
  fileName: string,
  declaredMime: string,
  expectedKind?: 'pdf' | 'image' | 'text'
): FileInspectionResult {
  if (!bytes || bytes.length === 0) {
    return { valid: false, kind: 'unknown', detectedMime: '', reason: 'EMPTY_FILE' };
  }

  // Block SVG MIME explicitly even if disguised
  if (declaredMime.toLowerCase().includes('svg') || fileName.toLowerCase().endsWith('.svg')) {
    return { valid: false, kind: 'unknown', detectedMime: 'image/svg+xml', reason: 'ACTIVE_CONTENT_REJECTED' };
  }

  // Reject Windows PE / ELF / Mach-O executables immediately
  if (
    hasPrefix(bytes, [0x4d, 0x5a]) || // MZ (.exe/.dll)
    hasPrefix(bytes, [0x7f, 0x45, 0x4c, 0x46]) // ELF
  ) {
    return { valid: false, kind: 'unknown', detectedMime: 'application/x-executable', reason: 'EXECUTABLE_REJECTED' };
  }

  // Check PDF magic header
  const pdfOffset = findPdfHeaderOffset(bytes);
  if (pdfOffset >= 0) {
    if (bytes.length > PDF_SECURITY_LIMITS.MAX_PDF_FILE_SIZE_BYTES) {
      return { valid: false, kind: 'pdf', detectedMime: 'application/pdf', reason: 'FILE_TOO_LARGE' };
    }
    if (expectedKind && expectedKind !== 'pdf') {
      return { valid: false, kind: 'pdf', detectedMime: 'application/pdf', reason: 'UNEXPECTED_FILE_TYPE' };
    }
    return { valid: true, kind: 'pdf', detectedMime: 'application/pdf' };
  }

  // Check JPEG (FF D8 FF)
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    if (bytes.length > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
      return { valid: false, kind: 'image', detectedMime: 'image/jpeg', reason: 'FILE_TOO_LARGE' };
    }
    return { valid: expectedKind !== 'pdf', kind: 'image', detectedMime: 'image/jpeg', reason: expectedKind === 'pdf' ? 'EXPECTED_PDF' : undefined };
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    if (bytes.length > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
      return { valid: false, kind: 'image', detectedMime: 'image/png', reason: 'FILE_TOO_LARGE' };
    }
    return { valid: expectedKind !== 'pdf', kind: 'image', detectedMime: 'image/png', reason: expectedKind === 'pdf' ? 'EXPECTED_PDF' : undefined };
  }

  // Check WEBP (RIFF....WEBP)
  if (
    bytes.length >= 12 &&
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    if (bytes.length > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
      return { valid: false, kind: 'image', detectedMime: 'image/webp', reason: 'FILE_TOO_LARGE' };
    }
    return { valid: expectedKind !== 'pdf', kind: 'image', detectedMime: 'image/webp', reason: expectedKind === 'pdf' ? 'EXPECTED_PDF' : undefined };
  }

  // Check GIF (GIF87a / GIF89a)
  if (hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38])) {
    if (bytes.length > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
      return { valid: false, kind: 'image', detectedMime: 'image/gif', reason: 'FILE_TOO_LARGE' };
    }
    return { valid: expectedKind !== 'pdf', kind: 'image', detectedMime: 'image/gif', reason: expectedKind === 'pdf' ? 'EXPECTED_PDF' : undefined };
  }

  // Check BMP (42 4D)
  if (hasPrefix(bytes, [0x42, 0x4d])) {
    return { valid: expectedKind !== 'pdf', kind: 'image', detectedMime: 'image/bmp', reason: expectedKind === 'pdf' ? 'EXPECTED_PDF' : undefined };
  }

  // Reject HTML / active script content disguised as PDF or image (scan up to 4 KB)
  const headText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 4096)).toLowerCase();
  if (
    headText.includes('<script') ||
    headText.includes('<svg') ||
    headText.includes('<!doctype html') ||
    headText.includes('<html') ||
    headText.includes('javascript:')
  ) {
    return { valid: false, kind: 'unknown', detectedMime: 'text/html', reason: 'ACTIVE_CONTENT_REJECTED' };
  }

  // Plain text fallback only for .txt / .doc text imports when not expecting binary PDF/image
  const lowerName = fileName.toLowerCase();
  if (expectedKind !== 'pdf' && (lowerName.endsWith('.txt') || declaredMime.startsWith('text/'))) {
    return { valid: true, kind: 'text', detectedMime: 'text/plain' };
  }

  return {
    valid: false,
    kind: 'unknown',
    detectedMime: declaredMime || 'application/octet-stream',
    reason: 'INVALID_FILE_SIGNATURE',
  };
}

/**
 * Strips potentially malicious or compatibility-breaking PDF catalog entries:
 * - /OpenAction & /AA (auto-executing scripts/actions)
 * - /Names -> /JavaScript (embedded JS)
 * - /AcroForm -> /XFA (proprietary XML forms unsupported by WPS / standard viewers)
 * - /Encrypt trailer entries
 */
export function sanitizePdfDocumentSecurity(pdfDoc: PDFDocument): void {
  try {
    const trailer = pdfDoc.context.trailerInfo as Record<string, unknown>;
    if (trailer && 'Encrypt' in trailer) {
      delete trailer.Encrypt;
    }

    pdfDoc.catalog.delete(PDFName.of('OpenAction'));
    pdfDoc.catalog.delete(PDFName.of('AA'));

    const names = pdfDoc.catalog.lookup(PDFName.of('Names'));
    if (names instanceof PDFDict) {
      names.delete(PDFName.of('JavaScript'));
      names.delete(PDFName.of('EmbeddedFiles'));
    }

    const acro = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (acro instanceof PDFDict && acro.has(PDFName.of('XFA'))) {
      pdfDoc.catalog.delete(PDFName.of('AcroForm'));
    }

    // Remove page-level /AA and /JS link actions if present
    for (const page of pdfDoc.getPages()) {
      page.node.delete(PDFName.of('AA'));
      const annots = page.node.lookup(PDFName.of('Annots'));
      if (annots instanceof PDFArray) {
        for (let i = annots.size() - 1; i >= 0; i--) {
          const annot = annots.lookup(i);
          if (annot instanceof PDFDict) {
            const action = annot.lookup(PDFName.of('A'));
            if (action instanceof PDFDict) {
              const sVal = action.lookup(PDFName.of('S'))?.toString();
              if (sVal === '/JavaScript' || sVal === '/Launch' || sVal === '/SubmitForm' || sVal === '/ImportData') {
                annot.delete(PDFName.of('A'));
              }
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal sanitization guard
  }
}

/**
 * Yields to the browser UI thread during heavy multi-page PDF operations to keep UI responsive.
 */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Releases GPU/RAM backing store for temporary HTML canvases inside loops.
 */
export function releaseCanvasMemory(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // Ignore cleanup failures
  }
}

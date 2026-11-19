import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { isValidIndianMobile, normalizeIndianMobile } from './firebaseFollowers';
import { sanitizeSpreadsheetCell } from './pdfSecurity';

export interface VipOrderRecord {
  id: string;
  packId: string;
  packNameMr: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  utrNumber: string;
  paymentMethod: 'UPI' | 'PROMO';
  status: 'verified' | 'pending';
  expiresAtIso: string;
  createdAtIso: string;
  createdAtMs: number;
  source?: 'firestore' | 'server' | 'both';
}

export interface SaveVipOrderInput {
  id?: string;
  packId: string;
  packNameMr: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  utrNumber: string;
  paymentMethod?: 'UPI' | 'PROMO';
  status?: 'verified' | 'pending';
  expiresAtIso?: string;
  createdAtIso?: string;
  createdAtMs?: number;
}

export function sanitizeVipUtr(rawUtr: string): string {
  return String(rawUtr || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '')
    .slice(0, 40);
}

export async function saveVipOrderToFirestore(
  input: SaveVipOrderInput
): Promise<{ saved: boolean; id: string }> {
  const safeId =
    String(input.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 128) || `ord_${Date.now()}`;

  const cleanPackId =
    String(input.packId || 'all')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40) || 'all';

  const cleanPackName = String(input.packNameMr || 'महा व्हीआयपी पॅक').trim().slice(0, 120) || 'महा व्हीआयपी पॅक';
  const cleanName = String(input.customerName || '').trim().slice(0, 80);
  const cleanMobile = normalizeIndianMobile(input.customerMobile);
  const cleanUtr = sanitizeVipUtr(input.utrNumber);
  const cleanAmount = Math.max(1, Math.min(50000, Math.round(Number(input.amount) || 29)));
  const paymentMethod: 'UPI' | 'PROMO' = input.paymentMethod === 'PROMO' ? 'PROMO' : 'UPI';
  const status: 'verified' | 'pending' = input.status === 'pending' ? 'pending' : 'verified';
  const expiresAtIso = String(input.expiresAtIso || '').trim().slice(0, 40);
  const nowMs = Math.max(1700000000000, Math.min(9999999999999, Math.floor(Number(input.createdAtMs) || Date.now())));
  const createdAtIso =
    String(input.createdAtIso || '').trim().slice(0, 40) || new Date(nowMs).toISOString();

  if (cleanName.length < 2 || !isValidIndianMobile(cleanMobile) || cleanUtr.length < 6) {
    return { saved: false, id: safeId };
  }

  try {
    await setDoc(doc(db, 'vip_orders', safeId), {
      id: safeId,
      packId: cleanPackId.length >= 2 ? cleanPackId : 'all',
      packNameMr: cleanPackName.length >= 2 ? cleanPackName : 'VIP Pack',
      amount: cleanAmount,
      customerName: cleanName,
      customerMobile: cleanMobile,
      utrNumber: cleanUtr,
      paymentMethod,
      status,
      expiresAtIso,
      createdAt: serverTimestamp(),
      createdAtIso,
      createdAtMs: nowMs,
    });
    return { saved: true, id: safeId };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.CREATE, `vip_orders/${safeId}`);
    } catch {
      // Non-fatal fallback: server order persistence already handles primary save
    }
    return { saved: false, id: safeId };
  }
}

function mapVipOrderDoc(docId: string, data: Record<string, any>): VipOrderRecord {
  const ms =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : Number(data.createdAtMs) || Date.parse(String(data.createdAtIso || '')) || Date.now();
  return {
    id: String(data.id || docId),
    packId: String(data.packId || 'all'),
    packNameMr: String(data.packNameMr || 'व्हीआयपी पॅक'),
    amount: Number(data.amount) || 0,
    customerName: String(data.customerName || 'ग्राहक'),
    customerMobile: String(data.customerMobile || ''),
    utrNumber: String(data.utrNumber || ''),
    paymentMethod: data.paymentMethod === 'PROMO' ? 'PROMO' : 'UPI',
    status: data.status === 'pending' ? 'pending' : 'verified',
    expiresAtIso: String(data.expiresAtIso || ''),
    createdAtIso: String(data.createdAtIso || new Date(ms).toISOString()),
    createdAtMs: ms,
    source: 'firestore',
  };
}

export function subscribeAdminVipOrders(
  onData: (orders: VipOrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'vip_orders'), orderBy('createdAtMs', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapVipOrderDoc(d.id, d.data() || {}));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'vip_orders');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function updateVipOrderStatusAsAdmin(
  orderId: string,
  status: 'verified' | 'pending'
): Promise<void> {
  const safeId = String(orderId || '').trim();
  if (!safeId) return;
  try {
    await updateDoc(doc(db, 'vip_orders', safeId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `vip_orders/${safeId}`);
  }
}

export async function deleteVipOrderAsAdmin(orderId: string): Promise<void> {
  const safeId = String(orderId || '').trim();
  if (!safeId) return;
  try {
    await deleteDoc(doc(db, 'vip_orders', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `vip_orders/${safeId}`);
  }
}

export function exportVipOrdersToExcel(
  orders: VipOrderRecord[],
  filenamePrefix = 'maha-corner-vip-payments'
): void {
  const rows = orders.map((ord, idx) => {
    const dt = new Date(ord.createdAtMs || ord.createdAtIso || Date.now());
    const dateStr = dt.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = dt.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return {
      'अ.क्र. (Sr No)': idx + 1,
      'पैसे पाठवणाऱ्याचे नाव (Payer Name)': sanitizeSpreadsheetCell(ord.customerName),
      'मोबाईल नंबर (Mobile)': sanitizeSpreadsheetCell(ord.customerMobile),
      'रक्कम ₹ (Amount)': Number(ord.amount) || 0,
      'पॅक (VIP Pack)': sanitizeSpreadsheetCell(ord.packNameMr),
      'UTR / Ref No.': sanitizeSpreadsheetCell(ord.utrNumber),
      'पेमेंट माध्यम (Method)': sanitizeSpreadsheetCell(ord.paymentMethod),
      'स्थिती (Status)': ord.status === 'verified' ? 'Verified (पडताळलेले)' : 'Pending (प्रलंबित)',
      'तारीख (Date)': sanitizeSpreadsheetCell(dateStr),
      'वेळ (Time)': sanitizeSpreadsheetCell(timeStr),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
    { wch: 22 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'VIP Payments');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  XLSX.writeFile(workbook, `${filenamePrefix}-${today}.xlsx`);
}

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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { normalizeIndianMobile, isValidIndianMobile } from './firebaseFollowers';

export interface ContactInquiryInput {
  name: string;
  mobile: string;
  email: string;
  message: string;
}

export interface ContactInquiryResult {
  success: boolean;
  referenceId?: string;
  feedback: string;
}

export interface FirebaseContactRecord {
  id: string;
  name: string;
  mobile: string;
  email: string;
  message: string;
  createdAtMs: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactInquiry(
  input: ContactInquiryInput
): Promise<ContactInquiryResult> {
  const cleanName = String(input.name || '').trim().slice(0, 80);
  const mobileDigits = normalizeIndianMobile(input.mobile);
  const cleanEmail = String(input.email || '').trim().toLowerCase().slice(0, 160);
  const cleanMessage = String(input.message || '').trim().slice(0, 1500);

  if (cleanName.length < 2) {
    return {
      success: false,
      feedback: 'कृपया किमान २ अक्षरांचे पूर्ण नाव टाका. / Please enter your full name.',
    };
  }
  if (!isValidIndianMobile(mobileDigits)) {
    return {
      success: false,
      feedback: 'कृपया वैध १० अंकी मोबाईल नंबर टाका (६ ते ९ ने सुरू होणारा). / Please enter a valid 10-digit Indian mobile number.',
    };
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return {
      success: false,
      feedback: 'कृपया वैध ईमेल आयडी टाका (उदा. example@gmail.com). / Please enter a valid email address.',
    };
  }
  if (cleanMessage.length < 5) {
    return {
      success: false,
      feedback: 'कृपया तुमचा संदेश किंवा अडचण सविस्तर लिहा (किमान ५ अक्षरे). / Please write your message (at least 5 characters).',
    };
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAtMs = Math.floor(Date.now());

  let serverSaved = false;
  let serverError = '';
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: messageId,
        name: cleanName,
        mobile: mobileDigits,
        email: cleanEmail,
        message: cleanMessage,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      serverSaved = true;
    } else if (data?.error) {
      serverError = String(data.error);
    }
  } catch {
    // Fall through to Firestore best-effort
  }

  let firestoreSaved = false;
  try {
    await setDoc(doc(db, 'contact_messages', messageId), {
      id: messageId,
      name: cleanName,
      mobile: mobileDigits,
      email: cleanEmail,
      message: cleanMessage,
      createdAt: serverTimestamp(),
      createdAtMs,
    });
    firestoreSaved = true;
  } catch {
    // Non-fatal if Firestore quota exceeded
  }

  if (serverSaved || firestoreSaved) {
    return {
      success: true,
      referenceId: messageId,
      feedback: 'तुमचा संदेश यशस्वीरीत्या नोंदवला गेला आहे! आम्ही लवकरच संपर्क करू. ✓',
    };
  }

  return {
    success: false,
    feedback: serverError || 'संदेश सेव्ह करताना तांत्रिक अडचण आली. कृपया पुन्हा प्रयत्न करा.',
  };
}

export function subscribeAdminContactMessages(
  onData: (records: FirebaseContactRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'contact_messages'), orderBy('createdAtMs', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: FirebaseContactRecord[] = snap.docs.map((d) => {
        const data = d.data() || {};
        const ms =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : Number(data.createdAtMs) || Date.now();
        return {
          id: String(data.id || d.id),
          name: String(data.name || ''),
          mobile: String(data.mobile || ''),
          email: String(data.email || ''),
          message: String(data.message || ''),
          createdAtMs: ms,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'contact_messages');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function deleteContactMessageAsAdmin(messageId: string): Promise<void> {
  const safeId = String(messageId || '').trim();
  if (!safeId) return;
  try {
    await deleteDoc(doc(db, 'contact_messages', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `contact_messages/${safeId}`);
  }
}

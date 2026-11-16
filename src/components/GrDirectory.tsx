import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileCheck2,
  Search,
  ExternalLink,
  Calendar,
  Building2,
  FileText,
  Share2,
  Copy,
  Check,
  Bookmark,
  Eye,
  X,
  Plus,
  Lock,
  Trash2,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Sprout,
  HeartHandshake,
  GraduationCap,
  Landmark,
  Briefcase,
  Users,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { trackFeatureAction } from '../utils/analytics';
import { appendPortalLink, buildWhatsAppShareUrl } from '../utils/shareConfig';
import {
  escapeHtml,
  inspectUploadedFileBytes,
  sanitizeDataUrl,
  sanitizeExternalUrl,
  sanitizeFilename
} from '../utils/pdfSecurity';

export type GrDepartment =
  | 'कृषी व शेतकरी'
  | 'महिला व बाल विकास'
  | 'महसूल व सातबारा'
  | 'शिक्षण व शिष्यवृत्ती'
  | 'ग्रामविकास'
  | 'नोकरी व प्रशासन'
  | 'CSC / डिजिटल सेवा';

const DEPT_EN_MAP: Record<'सर्व' | GrDepartment, string> = {
  'सर्व': 'All Departments',
  'कृषी व शेतकरी': 'Agriculture & Farmers',
  'महिला व बाल विकास': 'Women & Child Welfare',
  'महसूल व सातबारा': 'Revenue & 7/12',
  'शिक्षण व शिष्यवृत्ती': 'Education & Scholarships',
  'ग्रामविकास': 'Rural Development',
  'नोकरी व प्रशासन': 'Jobs & Administration',
  'CSC / डिजिटल सेवा': 'CSC / Digital Services'
};

export interface GovernmentResolution {
  id: string;
  title: string;
  grCode: string;
  date: string; // DD/MM/YYYY
  isoDate: string; // YYYY-MM-DD
  year: string;
  department: GrDepartment;
  officialDepartment?: string;
  fileSizeKb?: string;
  summary: string;
  keyPoints: string[];
  documentsRequired: string[];
  officialUrl: string;
  pdfDataUrl?: string;
  isLive?: boolean;
  isImportant?: boolean;
  isOwnerAdded?: boolean;
}

const STORAGE_GR_KEY = 'maha_corner_custom_gr_list_v1';
const SAVED_GR_IDS_KEY = 'maha_corner_bookmarked_gr_ids_v1';

function getClientIstIso(offsetDays = 0): string {
  const now = new Date();
  const istString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = istString.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return utc.toISOString().slice(0, 10);
}

function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function parseDisplayDateToIso(dateStr: string): string {
  const cleaned = dateStr.trim();
  const parts = cleaned.split(/[-/]/);
  if (parts.length !== 3) return '';
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  const [dd, mm, yyyy] = parts;
  if (yyyy.length !== 4) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function mapOfficialDeptToCategory(officialDept: string): GrDepartment {
  const text = officialDept.toLowerCase();
  if (
    text.includes('कृषी') ||
    text.includes('पदुम') ||
    text.includes('फलोत्पादन') ||
    text.includes('मत्स्य') ||
    text.includes('सहकार')
  ) {
    return 'कृषी व शेतकरी';
  }
  if (text.includes('महिला') || text.includes('बाल') || text.includes('सामाजिक न्याय')) {
    return 'महिला व बाल विकास';
  }
  if (
    text.includes('महसूल') ||
    text.includes('वन') ||
    text.includes('भूसंपादन') ||
    text.includes('नोंदणी') ||
    text.includes('मदत व पुनर्वसन')
  ) {
    return 'महसूल व सातबारा';
  }
  if (
    text.includes('शिक्षण') ||
    text.includes('तंत्र') ||
    text.includes('वैद्यकीय') ||
    text.includes('क्रीडा') ||
    text.includes('कौशल्य')
  ) {
    return 'शिक्षण व शिष्यवृत्ती';
  }
  if (
    text.includes('ग्रामविकास') ||
    text.includes('पंचायत') ||
    text.includes('पाणी पुरवठा') ||
    text.includes('जलसंपदा') ||
    text.includes('मृद')
  ) {
    return 'ग्रामविकास';
  }
  if (text.includes('माहिती तंत्रज्ञान') || text.includes('ई-सेवा') || text.includes('csc')) {
    return 'CSC / डिजिटल सेवा';
  }
  return 'नोकरी व प्रशासन';
}

const DEPARTMENTS: ('सर्व' | GrDepartment)[] = [
  'सर्व',
  'महसूल व सातबारा',
  'कृषी व शेतकरी',
  'ग्रामविकास',
  'नोकरी व प्रशासन',
  'शिक्षण व शिष्यवृत्ती',
  'महिला व बाल विकास',
  'CSC / डिजिटल सेवा'
];

const DEPT_ICON_MAP: Record<GrDepartment, React.ReactNode> = {
  'कृषी व शेतकरी': <Sprout className="w-4 h-4 text-emerald-600" />,
  'महिला व बाल विकास': <HeartHandshake className="w-4 h-4 text-rose-600" />,
  'महसूल व सातबारा': <Landmark className="w-4 h-4 text-amber-600" />,
  'शिक्षण व शिष्यवृत्ती': <GraduationCap className="w-4 h-4 text-indigo-600" />,
  'ग्रामविकास': <Users className="w-4 h-4 text-teal-600" />,
  'नोकरी व प्रशासन': <Briefcase className="w-4 h-4 text-blue-600" />,
  'CSC / डिजिटल सेवा': <Building2 className="w-4 h-4 text-purple-600" />
};

export const GrDirectory: React.FC = () => {
  const { lang, t } = useLanguage();
  const [liveGrList, setLiveGrList] = useState<GovernmentResolution[]>([]);
  const [customGrList, setCustomGrList] = useState<GovernmentResolution[]>([]);
  const [todayIso, setTodayIso] = useState<string>(() => getClientIstIso(0));
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const [liveFetchError, setLiveFetchError] = useState<string>('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<'सर्व' | GrDepartment>('सर्व');
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeGr, setActiveGr] = useState<GovernmentResolution | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Owner Management Mode (Passcode Protected)
  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(false);
  const [isOwnerAuth, setIsOwnerAuth] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // New GR Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(() => isoToDisplay(getClientIstIso(0)));
  const [newDept, setNewDept] = useState<GrDepartment>('कृषी व शेतकरी');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newPointsText, setNewPointsText] = useState<string>('');
  const [newDocsText, setNewDocsText] = useState<string>('');
  const [newOfficialUrl, setNewOfficialUrl] = useState<string>('https://gr.maharashtra.gov.in/1145/Government-Resolutions');
  const [newPdfDataUrl, setNewPdfDataUrl] = useState<string | undefined>(undefined);
  const [newPdfFileName, setNewPdfFileName] = useState<string>('');
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  // Load saved bookmarks & custom GRs from localStorage
  useEffect(() => {
    try {
      const todayNow = getClientIstIso(0);
      const customRaw = localStorage.getItem(STORAGE_GR_KEY);
      if (customRaw) {
        const customParsed: GovernmentResolution[] = JSON.parse(customRaw);
        if (Array.isArray(customParsed)) {
          const normalized = customParsed
            .map((item) => {
              const iso = item.isoDate || parseDisplayDateToIso(item.date);
              return {
                ...item,
                isoDate: iso,
                officialUrl: sanitizeExternalUrl(
                  item.officialUrl,
                  'https://gr.maharashtra.gov.in/1145/Government-Resolutions'
                ),
                pdfDataUrl: sanitizeDataUrl(item.pdfDataUrl, ['data:application/pdf;base64,']),
              };
            })
            .filter((item) => item.isoDate === todayNow);
          setCustomGrList(normalized);
          if (normalized.length !== customParsed.length) {
            localStorage.setItem(STORAGE_GR_KEY, JSON.stringify(normalized));
          }
        }
      }

      const savedRaw = localStorage.getItem(SAVED_GR_IDS_KEY);
      if (savedRaw) {
        const parsedIds = JSON.parse(savedRaw);
        if (Array.isArray(parsedIds)) setSavedIds(parsedIds);
      }
    } catch (err) {
      console.error('Failed to load GR storage:', err);
    }
  }, []);

  // Fetch strictly today's live GRs from official portal via backend proxy
  const fetchLiveGrs = async (forceRefresh = false) => {
    setIsLoadingLive(true);
    setLiveFetchError('');
    try {
      const res = await fetch(`/api/gr/live?today=1${forceRefresh ? '&refresh=1' : ''}`);
      const data = await res.json();
      const resolvedTodayIso = data.todayIso || getClientIstIso(0);
      if (resolvedTodayIso !== todayIso) {
        setLiveGrList([]);
        setNewDate(isoToDisplay(resolvedTodayIso));
      }
      setTodayIso(resolvedTodayIso);

      if (Array.isArray(data.items)) {
        const mapped: GovernmentResolution[] = data.items
          .filter((item: any) => item.isoDate === resolvedTodayIso)
          .map((item: any) => {
            const category = mapOfficialDeptToCategory(item.officialDepartment || '');
            return {
              id: item.id,
              title: item.title,
              grCode: item.grCode,
              date: item.date,
              isoDate: item.isoDate,
              year: item.year || item.isoDate?.slice(0, 4) || '2026',
              department: category,
              officialDepartment: item.officialDepartment,
              fileSizeKb: item.fileSizeKb,
              summary: `महाराष्ट्र शासनाच्या "${item.officialDepartment}" विभागामार्फत आज (${item.date}) प्रसिद्ध करण्यात आलेला अधिकृत लाईव्ह शासन निर्णय (संकेतांक: ${item.grCode}). मूळ PDF पाहण्यासाठी खालील बटणावर क्लिक करा.`,
              keyPoints: [
                `अधिकृत संकेतांक (Unique Code): ${item.grCode}`,
                `निर्गमित दिनांक: ${item.date}`,
                `संबंधित विभाग: ${item.officialDepartment}`
              ],
              documentsRequired: [],
              officialUrl: item.pdfUrl || 'https://gr.maharashtra.gov.in/1145/Government-Resolutions',
              isLive: true
            };
          });
        setLiveGrList(mapped);
        setLastSyncedTime(
          new Date().toLocaleTimeString(lang === 'en' ? 'en-IN' : 'mr-IN', { hour: '2-digit', minute: '2-digit' })
        );
        if (forceRefresh) {
          showToast(t(`आजचे ताजे GR अद्ययावत झाले (${mapped.length}) ✓`, `Today's live GRs refreshed (${mapped.length}) ✓`));
        }
      }

      if (!data.success && data.error) {
        setLiveFetchError(
          t(
            'सध्या अधिकृत सर्व्हरशी संपर्क साधताना अडचण आली. कृपया पुन्हा प्रयत्न करा.',
            'Unable to reach the official GR server right now. Please try again.'
          )
        );
      }
    } catch (err) {
      console.error('Failed to fetch live GRs:', err);
      setLiveFetchError(
        t(
          'ताजे शासन निर्णय लोड करता आले नाहीत. कृपया इंटरनेट किंवा रिफ्रेश तपासा.',
          'Could not load live GRs. Please check your connection or refresh.'
        )
      );
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    fetchLiveGrs(false);

    // Every 5 minutes auto-refresh today's live GRs + check midnight IST date rollover every minute
    let lastCheckedDay = getClientIstIso(0);
    const rolloverTimer = setInterval(() => {
      const currentDay = getClientIstIso(0);
      if (currentDay !== lastCheckedDay) {
        lastCheckedDay = currentDay;
        setTodayIso(currentDay);
        setNewDate(isoToDisplay(currentDay));
        setLiveGrList([]);
        setCustomGrList((prev) => prev.filter((item) => item.isoDate === currentDay));
        fetchLiveGrs(true);
      }
    }, 60 * 1000);

    const livePollTimer = setInterval(() => {
      fetchLiveGrs(false);
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentDay = getClientIstIso(0);
        if (currentDay !== lastCheckedDay) {
          lastCheckedDay = currentDay;
          setTodayIso(currentDay);
          setNewDate(isoToDisplay(currentDay));
          setLiveGrList([]);
          setCustomGrList((prev) => prev.filter((item) => item.isoDate === currentDay));
          fetchLiveGrs(true);
        } else {
          fetchLiveGrs(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(rolloverTimer);
      clearInterval(livePollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Strictly today's GR list only (Live Official + Today's Owner Added, deduplicated)
  const todayGrList = useMemo(() => {
    const map = new Map<string, GovernmentResolution>();
    for (const gr of [...customGrList, ...liveGrList]) {
      if (gr.isoDate === todayIso && !map.has(gr.id)) {
        map.set(gr.id, gr);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.grCode.localeCompare(a.grCode));
  }, [customGrList, liveGrList, todayIso]);

  // Filtered Today GR List
  const filteredGrList = useMemo(() => {
    return todayGrList.filter((gr) => {
      const matchesDept = selectedDept === 'सर्व' || gr.department === selectedDept;
      const matchesSaved = !showSavedOnly || savedIds.includes(gr.id);
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        gr.title.toLowerCase().includes(q) ||
        gr.grCode.toLowerCase().includes(q) ||
        gr.summary.toLowerCase().includes(q) ||
        gr.department.toLowerCase().includes(q) ||
        (gr.officialDepartment || '').toLowerCase().includes(q);

      return matchesDept && matchesSaved && matchesSearch;
    });
  }, [todayGrList, selectedDept, showSavedOnly, savedIds, searchTerm]);

  // Toggle Bookmark
  const toggleBookmark = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(SAVED_GR_IDS_KEY, JSON.stringify(next));
      } catch {}
      showToast(
        prev.includes(id)
          ? t('बुकमार्क मधून काढले.', 'Removed from bookmarks.')
          : t('महत्त्वाच्या यादीत सेव्ह केले ✓', 'Saved to bookmarks ✓')
      );
      return next;
    });
  };

  // Copy GR Code
  const handleCopyCode = (gr: GovernmentResolution) => {
    navigator.clipboard.writeText(
      appendPortalLink(
        `📜 *${gr.title}*\n${t('शासन निर्णय संकेतांक', 'GR Unique Code')}: ${gr.grCode}\n${t('दिनांक', 'Date')}: ${gr.date}\n${t('विभाग', 'Department')}: ${gr.officialDepartment || gr.department}\n${t('अधिकृत लिंक', 'Official PDF Link')}: ${gr.officialUrl}`,
        lang
      )
    );
    setCopiedId(gr.id);
    trackFeatureAction('gr');
    showToast(t('GR संकेतांक व लिंक कॉपी केली ✓', 'GR code and link copied ✓'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  // WhatsApp Share URL
  const getWhatsAppShareUrl = (gr: GovernmentResolution) => {
    return buildWhatsAppShareUrl(
      `📜 *महाराष्ट्र शासन निर्णय (GR)*\n\n*${gr.title}*\n🔖 *संकेतांक:* ${gr.grCode}\n📅 *दिनांक:* ${gr.date}\n🏛️ *विभाग:* ${gr.officialDepartment || gr.department}\n\n🔗 *अधिकृत PDF लिंक:* ${gr.officialUrl}`,
      lang
    );
  };

  // Print Summary Slip via hidden iframe (safe inside iframe environments)
  const handlePrintGrSummary = (gr: GovernmentResolution) => {
    trackFeatureAction('gr');
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
      showToast('प्रिंट तयार करता आले नाही.');
      return;
    }

    const safeTitle = escapeHtml(gr.title);
    const safeDept = escapeHtml(gr.officialDepartment || gr.department);
    const safeCode = escapeHtml(gr.grCode);
    const safeDate = escapeHtml(gr.date);
    const safeSummary = escapeHtml(gr.summary);
    const safeOfficialUrl = escapeHtml(
      sanitizeExternalUrl(gr.officialUrl, 'https://gr.maharashtra.gov.in/1145/Government-Resolutions')
    );

    doc.open();
    doc.write(`
      <html lang="mr">
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <style>
            body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6; }
            .header { border-bottom: 3px solid #d97706; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }
            h1 { font-size: 20px; margin: 10px 0; color: #0f172a; }
            .meta { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 18px; }
            h3 { font-size: 15px; color: #b45309; margin-top: 18px; margin-bottom: 8px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 6px; font-size: 14px; }
            .footer { margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><strong>महा कॉर्नर (MAHA CORNER)</strong> • शासकीय निर्णय सारांश</div>
            <span class="badge">${safeDept}</span>
          </div>
          <h1>${safeTitle}</h1>
          <div class="meta">
            <div><strong>शासन निर्णय क्रमांक / संकेतांक:</strong> ${safeCode}</div>
            <div><strong>दिनांक:</strong> ${safeDate}</div>
          </div>
          <p>${safeSummary}</p>
          ${gr.keyPoints.length > 0 ? `<h3>मुख्य मुद्दे व तपशील:</h3><ul>${gr.keyPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          ${gr.documentsRequired.length > 0 ? `<h3>आवश्यक कागदपत्रे:</h3><ul>${gr.documentsRequired.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
          <div class="footer">अधिकृत PDF लिंक: ${safeOfficialUrl} • साभार: महा कॉर्नर</div>
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
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1000);
      }
    }, 150);
  };

  // Owner Passcode Auth
  const handleToggleOwner = () => {
    if (isOwnerAuth) {
      setIsOwnerMode((prev) => !prev);
    } else {
      setShowPinModal(true);
      setPinError('');
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
    if (!cleaned) {
      setPinError(t('कृपया ओनर पिन टाका.', 'Please enter Owner PIN.'));
      return;
    }
    setPinError('');
    try {
      const res = await fetch('/api/posters/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setIsOwnerAuth(true);
        setIsOwnerMode(true);
        setShowPinModal(false);
        setPinInput('');
        setPinError('');
      } else if (res.status === 429 && data?.error) {
        setPinError(data.error);
      } else {
        setPinError(t('चुकीचा पिन! कृपया योग्य पिन टाका.', 'Incorrect PIN! Please try again.'));
      }
    } catch {
      setPinError(t('पडताळणी करताना सर्व्हर त्रुटी आली.', 'Verification error. Please try again.'));
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      showToast(t('PDF फाईल २.५ MB पेक्षा लहान असावी, किंवा अधिकृत लिंक टाका.', 'PDF file must be under 2.5 MB, or paste the official link.'));
      return;
    }
    try {
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'pdf');
      if (!inspection.valid || inspection.kind !== 'pdf') {
        showToast(t('फक्त वैध PDF फाईलच अपलोड करता येते.', 'Only valid PDF files are allowed.'));
        return;
      }
    } catch {
      showToast(t('PDF तपासताना त्रुटी आली.', 'Could not inspect PDF file.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const safeData = sanitizeDataUrl(reader.result as string, ['data:application/pdf;base64,']);
      if (!safeData) {
        showToast(t('अवैध PDF स्वरूप.', 'Invalid PDF format.'));
        return;
      }
      setNewPdfDataUrl(safeData);
      setNewPdfFileName(sanitizeFilename(file.name, 'gr.pdf'));
      showToast(t(`${file.name} अपलोड झाली ✓`, `${file.name} uploaded ✓`));
    };
    reader.readAsDataURL(file);
  };

  const handlePublishNewGr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim() || !newSummary.trim()) {
      showToast(t('कृपया शीर्षक, GR क्रमांक आणि सारांश भरा.', 'Please enter title, GR code, and summary.'));
      return;
    }

    const parsedIso = parseDisplayDateToIso(newDate) || todayIso;
    const safeOfficialUrl = sanitizeExternalUrl(
      newOfficialUrl,
      'https://gr.maharashtra.gov.in/1145/Government-Resolutions'
    );
    const created: GovernmentResolution = {
      id: `gr-custom-${Date.now()}`,
      title: newTitle.trim(),
      grCode: newCode.trim(),
      date: isoToDisplay(parsedIso),
      isoDate: parsedIso,
      year: parsedIso.slice(0, 4),
      department: newDept,
      officialDepartment: newDept,
      summary: newSummary.trim(),
      keyPoints: newPointsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      documentsRequired: newDocsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      officialUrl: safeOfficialUrl,
      pdfDataUrl: sanitizeDataUrl(newPdfDataUrl, ['data:application/pdf;base64,']),
      isImportant: true,
      isOwnerAdded: true
    };

    const updatedCustom = [created, ...customGrList];
    setCustomGrList(updatedCustom);

    try {
      localStorage.setItem(STORAGE_GR_KEY, JSON.stringify(updatedCustom));
    } catch {
      showToast(t('स्टोरेज मर्यादेमुळे फक्त सेशनपुरते जतन झाले.', 'Saved for current session only due to storage limit.'));
    }

    setNewTitle('');
    setNewCode('');
    setNewSummary('');
    setNewPointsText('');
    setNewDocsText('');
    setNewPdfDataUrl(undefined);
    setNewPdfFileName('');
    confetti({ particleCount: 55, spread: 70 });
    showToast(t('नवीन शासन निर्णय (GR) यशस्वीरित्या प्रकाशित झाला ✓', 'New Government Resolution (GR) published ✓'));
  };

  const handleDeleteCustomGr = (id: string) => {
    const updatedCustom = customGrList.filter((g) => g.id !== id);
    setCustomGrList(updatedCustom);
    try {
      localStorage.setItem(STORAGE_GR_KEY, JSON.stringify(updatedCustom));
    } catch {}
    showToast(t('निवडलेला GR काढून टाकला.', 'Selected GR removed.'));
  };

  return (
    <div className="space-y-6">
      {/* Inline Notification Toast */}
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-amber-300 border border-amber-500/50 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Hero Header Banner - Strictly Today's Live GRs */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-6 sm:p-8 border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-amber-300 font-bold">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {t('थेट लाईव्ह महाराष्ट्र शासन पोर्टल (gr.maharashtra.gov.in)', 'Live Maharashtra Govt Portal (gr.maharashtra.gov.in)')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200">
                {t('आजची तारीख:', 'Today Date:')} <strong className="text-amber-300">{isoToDisplay(todayIso)}</strong>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {t('📜 आजचे लाईव्ह शासन निर्णय (GR)', '📜 Today\'s Live Government Resolutions (GR)')}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(
                `फक्त आज (${isoToDisplay(todayIso)}) महाराष्ट्र शासनाच्या अधिकृत पोर्टलवरून प्रसिद्ध झालेले चालू लाईव्ह शासन निर्णय (GR), संकेतांक क्रमांक व थेट PDF डाउनलोड लिंक एकाच ठिकाणी पहा.`,
                `View strictly today's (${isoToDisplay(todayIso)}) live Maharashtra Government Resolutions (GRs) directly from gr.maharashtra.gov.in with Unique Codes and instant PDF downloads.`
              )}
            </p>

            {/* Quick Live Stats */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <Calendar className="w-4 h-4" />
                <span>
                  {t(
                    `आजचे चालू लाईव्ह GR (${isoToDisplay(todayIso)}): ${todayGrList.length}`,
                    `Today's Live GRs (${isoToDisplay(todayIso)}): ${todayGrList.length}`
                  )}
                </span>
              </div>
              {lastSyncedTime && (
                <>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-slate-400">
                    {t(`शेवटचे अपडेट: ${lastSyncedTime}`, `Last synced: ${lastSyncedTime}`)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fetchLiveGrs(true)}
              disabled={isLoadingLive}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span>
                {isLoadingLive
                  ? t('ताजे GR लोड होत आहेत...', 'Loading latest GRs...')
                  : t('ताजे GR रिफ्रेश करा', 'Refresh Live GRs')}
              </span>
            </button>

            <a
              href="https://gr.maharashtra.gov.in/1145/Government-Resolutions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('अधिकृत पोर्टल', 'Official Portal')}</span>
            </a>

            <button
              type="button"
              onClick={handleToggleOwner}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isOwnerMode
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={t('ओनर नवीन GR जोडा', 'Owner Add New GR')}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isOwnerMode
                  ? t('ओनर पॅनेल बंद करा', 'Close Owner Panel')
                  : t('नवीन GR जोडा', 'Add New GR')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Fetch Error Banner (if any) */}
      {liveFetchError && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{liveFetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchLiveGrs(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
          >
            {t('पुन्हा प्रयत्न करा', 'Try Again')}
          </button>
        </div>
      )}

      {/* Owner Add New GR Panel */}
      {isOwnerMode && (
        <form
          onSubmit={handlePublishNewGr}
          className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-emerald-500/40 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
              <Plus className="w-5 h-5" />
              <span>{t('नवीन शासन निर्णय (GR) प्रकाशित करा (Owner Panel)', 'Publish New Government Resolution (Owner Panel)')}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {t('तुमच्या डिव्हाइसवर सेव्ह होते', 'Saved locally on your device')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t('शासन निर्णयाचे शीर्षक *:', 'GR Title *:')}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('उदा. मुख्यमंत्री सौर कृषी वाहिनी योजना २०२६ सुधारित आदेश', 'e.g. Mukhyamantri Saur Krishi Vahini Yojana 2026 Revised Order')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('विभाग:', 'Department:')}</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value as GrDepartment)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              >
                {DEPARTMENTS.filter((d) => d !== 'सर्व').map((d) => (
                  <option key={d} value={d}>
                    {lang === 'en' ? DEPT_EN_MAP[d] : d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t('GR क्रमांक / संकेतांक *:', 'GR Code / Unique ID *:')}
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={t('उदा. संकीर्ण-२०२६/प्र.क्र.५१', 'e.g. Sankirna-2026/CR-51')}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('दिनांक (DD/MM/YYYY):', 'Date (DD/MM/YYYY):')}</label>
              <input
                type="text"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t('अधिकृत PDF लिंक किंवा फाईल:', 'Official PDF Link or Upload File:')}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newOfficialUrl}
                  onChange={(e) => setNewOfficialUrl(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  title={t('PDF अपलोड करा', 'Upload PDF')}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <input
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  accept="application/pdf"
                  className="hidden"
                />
              </div>
              {newPdfFileName && (
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                  {t('जोडलेली PDF:', 'Attached PDF:')} {newPdfFileName}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {t('सोप्या भाषेत सारांश *:', 'Simple Summary *:')}
            </label>
            <textarea
              rows={2}
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder={t('नागरिक व शेतकऱ्यांना समजेल अशा सोप्या मराठीत निर्णय स्पष्ट करा...', 'Explain the resolution clearly for citizens and farmers...')}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t('मुख्य मुद्दे (प्रत्येक ओळ वेगळी लिहा):', 'Key Points (one per line):')}
              </label>
              <textarea
                rows={3}
                value={newPointsText}
                onChange={(e) => setNewPointsText(e.target.value)}
                placeholder={t('पात्र लाभार्थी कोण?\nअनुदान किती मिळणार?\nअर्जाची अंतिम मुदत', 'Eligible beneficiaries\nSubsidy details\nApplication deadline')}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {t("आवश्यक कागदपत्रे (स्वल्पविराम ',' देऊन लिहा):", 'Required Documents (comma separated):')}
              </label>
              <textarea
                rows={3}
                value={newDocsText}
                onChange={(e) => setNewDocsText(e.target.value)}
                placeholder={t('आधार कार्ड, ७/१२ उतारा, बँक पासबुक, मोबाईल नंबर', 'Aadhaar Card, 7/12 Extract, Bank Passbook, Mobile Number')}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('शासन निर्णय (GR) प्रकाशित करा', 'Publish GR Notice')}</span>
          </button>
        </form>
      )}

      {/* Today Live Bar + Search + Department Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {t(
                `फक्त आजचे लाईव्ह निर्णय (${isoToDisplay(todayIso)}) · ${todayGrList.length}`,
                `Today's Live GRs Only (${isoToDisplay(todayIso)}) · ${todayGrList.length}`
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSavedOnly((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              showSavedOnly
                ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-slate-950' : ''}`} />
            <span>{t(`सेव्ह केलेले (${savedIds.length})`, `Saved (${savedIds.length})`)}</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'शासन निर्णय शोधा (उदा. बळीराजा, महसूल, ग्रामविकास, पीक विमा, संकेतांक क्रमांक...)',
              'Search GRs by keyword, department, scheme, or unique code...'
            )}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Department Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDept === dept
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {dept !== 'सर्व' && DEPT_ICON_MAP[dept]}
              <span>{lang === 'en' ? DEPT_EN_MAP[dept] : dept}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoadingLive && liveGrList.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 animate-pulse"
            >
              <div className="h-4 w-1/3 bg-slate-200 rounded" />
              <div className="h-6 w-5/6 bg-slate-200 rounded" />
              <div className="h-9 w-full bg-slate-100 rounded-xl" />
              <div className="h-14 w-full bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* GR List Grid */}
      {(!isLoadingLive || filteredGrList.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredGrList.map((gr) => {
            const isSaved = savedIds.includes(gr.id);

            return (
              <article
                key={gr.id}
                className="bg-white rounded-3xl border border-emerald-300 hover:border-emerald-500 ring-1 ring-emerald-100 p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-3">
                  {/* Quiet Metadata Header */}
                  <div className="flex items-start justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-slate-700">
                      {DEPT_ICON_MAP[gr.department]}
                      <span className="text-slate-800">{gr.officialDepartment || (lang === 'en' ? DEPT_EN_MAP[gr.department] : gr.department)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-normal text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {gr.date}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-emerald-700">
                        {t('आजचा चालू लाईव्ह GR', 'Today Live GR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleBookmark(gr.id)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isSaved
                            ? 'bg-amber-50 border-amber-300 text-amber-600'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-600'
                        }`}
                        title={t('महत्त्वाचा म्हणून सेव्ह करा', 'Save to bookmarks')}
                      >
                        <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500' : ''}`} />
                      </button>

                      {gr.isOwnerAdded && isOwnerMode && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomGr(gr.id)}
                          className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 cursor-pointer"
                          title={t('हा GR काढून टाका', 'Delete this GR')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => setActiveGr(gr)}
                    className="text-base sm:text-lg font-black text-slate-900 group-hover:text-amber-700 transition-colors cursor-pointer leading-snug"
                  >
                    {gr.title}
                  </h3>

                  {/* GR Code Copy Row */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <span className="font-mono text-slate-700 truncate">
                      <strong>{t('संकेतांक:', 'Code:')}</strong> {gr.grCode}
                      {gr.fileSizeKb ? ` (${gr.fileSizeKb} KB)` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(gr)}
                      className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedId === gr.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">{t('कॉपी झाले', 'Copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('कॉपी', 'Copy')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Summary (shown concisely) */}
                  {!gr.isLive && (
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {gr.summary}
                    </p>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {(() => {
                    const safePdf = sanitizeDataUrl(gr.pdfDataUrl, ['data:application/pdf;base64,']);
                    const safeHref = safePdf || sanitizeExternalUrl(gr.officialUrl, '#');
                    return (
                  <a
                    href={safeHref}
                    target={safePdf ? undefined : '_blank'}
                    rel={safePdf ? undefined : 'noopener noreferrer'}
                    download={safePdf ? `${sanitizeFilename(gr.grCode, 'gr')}.pdf` : undefined}
                    className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t('अधिकृत PDF उघडा', 'Open Official PDF')}</span>
                  </a>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setActiveGr(gr)}
                    className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('तपशील', 'Details')}</span>
                  </button>

                  <a
                    href={getWhatsAppShareUrl(gr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                    title={t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t('शेअर', 'Share')}</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Empty Today Live GR State */}
      {!isLoadingLive && filteredGrList.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {todayGrList.length === 0
              ? t(
                  `आजच्या (${isoToDisplay(todayIso)}) तारखेस शासनाच्या पोर्टलवर अद्याप कोणताही नवीन शासन निर्णय (GR) प्रसिद्ध झालेला नाही.`,
                  `No new Government Resolution (GR) has been published today (${isoToDisplay(todayIso)}) on the official portal yet.`
                )
              : t(
                  `आजच्या (${isoToDisplay(todayIso)}) या फिल्टरनुसार कोणताही शासन निर्णय (GR) आढळला नाही.`,
                  `No GR found for today (${isoToDisplay(todayIso)}) under this filter.`
                )}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fetchLiveGrs(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('ताजे लाईव्ह GR तपासा', 'Check Live GRs Now')}</span>
            </button>
            {(searchTerm || selectedDept !== 'सर्व' || showSavedOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDept('सर्व');
                  setShowSavedOnly(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {t('सर्व फिल्टर साफ करा', 'Clear All Filters')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detailed GR Modal Reader */}
      {activeGr && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5 relative">
            <button
              type="button"
              onClick={() => setActiveGr(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              aria-label={t('बंद करा', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2 pr-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-amber-700 flex items-center gap-1">
                  {DEPT_ICON_MAP[activeGr.department]}
                  {activeGr.officialDepartment || (lang === 'en' ? DEPT_EN_MAP[activeGr.department] : activeGr.department)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{t('दिनांक:', 'Date:')} {activeGr.date}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-700">{activeGr.grCode}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {activeGr.title}
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-sm text-slate-800 leading-relaxed">
              {activeGr.summary}
            </div>

            {activeGr.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-900">{t('📌 मुख्य तपशील:', '📌 Key Details:')}</h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  {activeGr.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeGr.documentsRequired.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-900">{t('📂 आवश्यक कागदपत्रे:', '📂 Required Documents:')}</h4>
                <div className="flex flex-wrap gap-2">
                  {activeGr.documentsRequired.map((doc, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                    >
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handlePrintGrSummary(activeGr)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>{t('सारांश प्रिंट / PDF करा', 'Print / Save Summary')}</span>
              </button>

              <a
                href={getWhatsAppShareUrl(activeGr)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('WhatsApp वर शेअर करा', 'Share on WhatsApp')}</span>
              </a>

              {(() => {
                const safeActivePdf = sanitizeDataUrl(activeGr.pdfDataUrl, ['data:application/pdf;base64,']);
                if (safeActivePdf) {
                  return (
                    <a
                      href={safeActivePdf}
                      download={`${sanitizeFilename(activeGr.grCode, 'gr')}.pdf`}
                      className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{t('GR PDF डाउनलोड', 'Download GR PDF')}</span>
                    </a>
                  );
                }
                return (
                  <a
                    href={sanitizeExternalUrl(activeGr.officialUrl, '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{t('अधिकृत PDF पहा', 'View Official PDF')}</span>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Owner Pin Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyPin}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>{t('ओनर पिन पडताळणी', 'Owner PIN Verification')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {t('नवीन शासन निर्णय (GR) अपलोड करण्यासाठी ओनर पिन टाका.', 'Enter Owner PIN to publish a new Government Resolution (GR).')}
            </p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={t('ओनर पिन प्रविष्ट करा', 'Enter Owner PIN')}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              autoFocus
            />
            {pinError && <p className="text-xs font-bold text-red-600">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs cursor-pointer"
            >
              {t('पडताळणी करा', 'Verify PIN')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

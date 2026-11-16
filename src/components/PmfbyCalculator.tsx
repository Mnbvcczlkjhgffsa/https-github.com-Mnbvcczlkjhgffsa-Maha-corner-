import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PMFBY_RABI_RECORDS,
  PmfbyCropRecord,
} from '../data/pmfbyRabiData';
import { trackFeatureAction } from '../utils/analytics';
import { appendPmfbyPageLink, getPmfbyPageUrl, getPmfbyPageOnlyInviteUrl } from '../utils/shareConfig';

// ==========================================
// Exact BigInt / Paise / Pico Precision Engine
// Source: Maharashtra Govt GR 03-07-2026 (प्रपत्र अ-35 ते अ-66)
// ==========================================
const PICO_HECTARE = 1_000_000_000_000n;
const UNIT_TO_PICO_HECTARE: Record<string, bigint> = Object.freeze({
  ha: PICO_HECTARE,
  acre: 404_685_642_240n,
  guntha: 10_117_141_056n,
  are: 10_000_000_000n,
  sqm: 100_000_000n,
});

function parseAmountToPaise(input: string | number): bigint {
  const s = String(input).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) {
    throw new Error('Invalid rupee amount in notified table');
  }
  const [intPart, frac = ''] = s.split('.');
  return BigInt(intPart) * 100n + BigInt(frac.padEnd(2, '0'));
}

function parseArea8(input: string | number): bigint {
  const s = String(input).trim();
  if (!/^(?:\d+)(?:\.\d{1,8})?$/.test(s)) {
    throw new Error('क्षेत्र 0 पेक्षा अधिक आणि जास्तीत जास्त 8 दशांशस्थाने असावे.');
  }
  const [intPart, frac = ''] = s.split('.');
  return BigInt(intPart) * 100_000_000n + BigInt(frac.padEnd(8, '0'));
}

function toPicoHectares(input: string | number, unit = 'ha'): bigint {
  if (!(unit in UNIT_TO_PICO_HECTARE)) {
    throw new Error('अयोग्य क्षेत्र एकक.');
  }
  const area8 = parseArea8(input);
  if (area8 <= 0n) {
    throw new Error('क्षेत्र शून्य किंवा ऋण असू शकत नाही.');
  }
  return (area8 * UNIT_TO_PICO_HECTARE[unit] + 50_000_000n) / 100_000_000n;
}

function roundPaiseForArea(amountPerHa: string, hectaresPico: bigint): bigint {
  const perHa = parseAmountToPaise(amountPerHa);
  if (hectaresPico < 0n) {
    throw new Error('Area must be nonnegative');
  }
  return (perHa * hectaresPico + PICO_HECTARE / 2n) / PICO_HECTARE;
}

function formatMoneyPaise(value: bigint, locale = 'en-IN'): string {
  const n = BigInt(value);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const rupees = abs / 100n;
  const paisa = String(abs % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}₹${Number(rupees).toLocaleString(locale)}.${paisa}`;
}

function formatMoneySmall(value: bigint): string {
  return formatMoneyPaise(value).replace(/\.00$/, '');
}

interface ComputedPremiumResult {
  record: PmfbyCropRecord;
  areaInput: string;
  unit: string;
  areaPico: bigint;
  insured: bigint;
  actual: bigint;
  farmer: bigint;
  central: bigint;
  state: bigint;
  roundingDifference: bigint;
}

function computePremium(
  record: PmfbyCropRecord | null,
  area: string,
  unit = 'ha'
): ComputedPremiumResult {
  if (!record || !record.id) {
    throw new Error('अधिसूचित पीक दर उपलब्ध नाही.');
  }
  const hectaresPico = toPicoHectares(area, unit);
  if (hectaresPico < PICO_HECTARE / 10n) {
    throw new Error('योजनेतील किमान क्षेत्र 0.10 हेक्टर आहे.');
  }
  if (hectaresPico > 100_000n * PICO_HECTARE) {
    throw new Error('इतके मोठे क्षेत्र तपासून पुन्हा भरा.');
  }
  const insured = roundPaiseForArea(record.sum_insured_per_ha, hectaresPico);
  const actual = roundPaiseForArea(record.actual_premium_per_ha, hectaresPico);
  const farmer = roundPaiseForArea(record.farmer_premium_per_ha, hectaresPico);
  const central = roundPaiseForArea(record.central_subsidy_per_ha, hectaresPico);
  const state = roundPaiseForArea(record.state_subsidy_per_ha, hectaresPico);
  const roundingDifference = actual - farmer - central - state;
  return {
    record,
    areaInput: String(area),
    unit,
    areaPico: hectaresPico,
    insured,
    actual,
    farmer,
    central,
    state,
    roundingDifference,
  };
}

interface CartItem {
  id: number;
  area: string;
  perHa: bigint;
  result: ComputedPremiumResult;
}

interface RatioCropItem {
  id: number;
  name: string;
  area: string;
}

function safeArea8(s: string): bigint | null {
  try {
    return parseArea8(s || '0');
  } catch {
    return null;
  }
}

function fmtRatioArea(n: bigint | number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  const val = typeof n === 'bigint' ? n : BigInt(Math.round(Number(n)));
  const s = val < 0n ? '-' : '';
  const x = val < 0n ? -val : val;
  const left = x / 100_000_000n;
  const dec = String(x % 100_000_000n).padStart(8, '0').replace(/0+$/, '');
  return s + left.toString() + (dec ? '.' + dec : '');
}

const DRAFT_STORAGE_KEY = 'mahacorner-pmfby-rabi-2026-27:draft:v1';
const QUICK_AREAS = ['0.10', '0.20', '0.30', '0.40', '0.50', '0.60', '0.70', '0.80', '0.90', '1.00'];
const FEE_PRESETS = [0, 10, 20, 50, 100, 150];

interface PmfbyCalculatorProps {
  isStandalone?: boolean;
}

export const PmfbyCalculator: React.FC<PmfbyCalculatorProps> = ({ isStandalone = false }) => {
  // Group records by district
  const { districts, byDistrict } = useMemo(() => {
    const map = new Map<string, PmfbyCropRecord[]>();
    for (const rec of PMFBY_RABI_RECORDS) {
      if (!map.has(rec.district)) map.set(rec.district, []);
      map.get(rec.district)!.push(rec);
    }
    const distList = [...map.keys()].sort((a, b) => a.localeCompare(b, 'mr'));
    return { districts: distList, byDistrict: map };
  }, []);

  const [activeTab, setActiveTab] = useState<'premium' | 'ratio'>('premium');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
    return byDistrict.has('सिंधुदुर्ग') ? 'सिंधुदुर्ग' : districts[0] || 'पुणे';
  });
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [areaInput, setAreaInput] = useState<string>('0.50');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [feePaise, setFeePaise] = useState<bigint>(0n);
  const [feeInputString, setFeeInputString] = useState<string>('0');

  const handleFeeInputChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    let finalStr = sanitized;
    if (parts.length === 2 && parts[1].length > 2) {
      finalStr = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    setFeeInputString(finalStr);

    if (!finalStr || finalStr === '.') {
      setFeePaise(0n);
      return;
    }
    const num = parseFloat(finalStr);
    if (isNaN(num) || num < 0) {
      setFeePaise(0n);
      return;
    }
    const safeNum = Math.min(num, 100_000);
    const paise = BigInt(Math.round(safeNum * 100));
    setFeePaise(paise);
  };

  const handleSelectPresetFee = (feeRupees: number) => {
    const paise = BigInt(feeRupees) * 100n;
    setFeePaise(paise);
    setFeeInputString(String(feeRupees));
  };
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mix Ratio state
  const [ratioTotalLand, setRatioTotalLand] = useState<string>('0.11');
  const [ratioCrops, setRatioCrops] = useState<RatioCropItem[]>([
    { id: 1, name: 'पीक 1', area: '0.06' },
    { id: 2, name: 'पीक 2', area: '0.05' },
  ]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Crops available in selected district
  const districtCrops = useMemo(() => {
    return byDistrict.get(selectedDistrict) || [];
  }, [selectedDistrict, byDistrict]);

  // Ensure selected crop is valid for current district
  useEffect(() => {
    if (!districtCrops.length) {
      setSelectedCropId('');
    } else if (!districtCrops.some((c) => c.id === selectedCropId)) {
      setSelectedCropId(districtCrops[0].id);
    }
  }, [districtCrops, selectedCropId]);

  const selectedRecord = useMemo(() => {
    return districtCrops.find((c) => c.id === selectedCropId) || districtCrops[0] || null;
  }, [districtCrops, selectedCropId]);

  // Live preview calculation for currently selected district + crop + area
  const previewState = useMemo(() => {
    if (!selectedRecord) {
      return { ok: false, error: 'निवडलेल्या जिल्ह्यासाठी अधिसूचित पीक उपलब्ध नाही.', result: null };
    }
    try {
      const res = computePremium(selectedRecord, areaInput, 'ha');
      return { ok: true, error: '', result: res };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'क्षेत्र तपासा.', result: null };
    }
  }, [selectedRecord, areaInput]);

  // Effective farmer premium: If cart has items, sum of cart; otherwise active preview
  const effectiveFarmerPremium = useMemo(() => {
    if (cart.length > 0) {
      return cart.reduce((sum, item) => sum + item.result.farmer, 0n);
    }
    if (previewState.ok && previewState.result) {
      return previewState.result.farmer;
    }
    return 0n;
  }, [cart, previewState]);

  // Combined total payable = विमा हप्ता + सातबारा प्रिंट व इतर शुल्क एकत्र करून
  const combinedTotalPayable = useMemo(() => {
    return effectiveFarmerPremium + feePaise;
  }, [effectiveFarmerPremium, feePaise]);

  // Cart summary calculations
  const cartSummary = useMemo(() => {
    const farmer = effectiveFarmerPremium;
    const fee = feePaise;
    const payable = combinedTotalPayable;
    return { farmer, fee, payable };
  }, [effectiveFarmerPremium, feePaise, combinedTotalPayable]);

  // Load draft from localStorage on initial render
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.v !== 1) return;
      if (typeof d.district === 'string' && byDistrict.has(d.district)) {
        setSelectedDistrict(d.district);
      }
      if (typeof d.crop === 'string') {
        setSelectedCropId(d.crop);
      }
      if (typeof d.area === 'string' && d.area.length < 24) {
        setAreaInput(d.area);
      }
      if (typeof d.fee === 'string') {
        const num = parseFloat(d.fee);
        if (!isNaN(num) && num >= 0 && num <= 100000) {
          const paise = BigInt(Math.round(num * 100));
          setFeePaise(paise);
          setFeeInputString(d.fee);
        }
      }
      if (typeof d.totalLand === 'string') {
        setRatioTotalLand(d.totalLand);
      }
      if (Array.isArray(d.ratioCrops) && d.ratioCrops.length > 0) {
        setRatioCrops(d.ratioCrops);
      }
      if (d.panel === 'ratio') {
        setActiveTab('ratio');
      }
    } catch {}
  }, [byDistrict]);

  // Save draft to localStorage
  useEffect(() => {
    try {
      const draft = {
        v: 1,
        district: selectedDistrict,
        crop: selectedCropId,
        area: areaInput,
        fee: feeInputString,
        cart: cart.map((c) => ({ recordId: c.result.record.id, area: c.area })),
        ratioCrops,
        totalLand: ratioTotalLand,
        panel: activeTab,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [selectedDistrict, selectedCropId, areaInput, feePaise, feeInputString, cart, ratioCrops, ratioTotalLand, activeTab]);

  // Add current preview crop to cart
  const handleAddCrop = () => {
    if (!previewState.ok || !previewState.result) {
      setErrorMessage(previewState.error || 'क्षेत्र तपासा.');
      return;
    }
    const result = previewState.result;
    if (cart.length && cart[0].result.record.district !== result.record.district) {
      setErrorMessage('एकाच यादीत एकाच जिल्ह्याची पिके ठेवा. आधी Reset करा.');
      return;
    }
    setErrorMessage('');
    const newCartItem: CartItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      area: areaInput,
      perHa: parseAmountToPaise(result.record.farmer_premium_per_ha),
      result,
    };
    setCart((prev) => [...prev, newCartItem]);
    showToast(`${result.record.crop} यादीत जोडले.`);
    trackFeatureAction('pmfby-calc');
  };

  const handleRemoveCrop = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setFeePaise(0n);
    setFeeInputString('0');
    setErrorMessage('');
    showToast('यादी रीसेट झाली.');
  };

  // Mix ratio math
  const mixState = useMemo(() => {
    const total = safeArea8(ratioTotalLand);
    const areas = ratioCrops.map((x) => safeArea8(x.area));
    if (!total || total <= 0n || areas.some((x) => x === null || x < 0n)) {
      return {
        ok: false,
        msg: 'Total आणि सर्व पिकांचे क्षेत्र योग्य भरा.',
        ratios: ratioCrops.map(() => 0),
        sumArea: 0n,
        totalArea: total || 0n,
        sumRatio: 0,
        diff: 0n,
      };
    }
    const sumArea = areas.reduce<bigint>((a, b) => a + (b ?? 0n), 0n);
    const match = sumArea === total;
    const exact = areas.map((a, i) => ({
      i,
      floor: ((a ?? 0n) * 1000n) / total,
      rem: ((a ?? 0n) * 1000n) % total,
    }));
    let ratios = exact.map((x) => Number(x.floor));
    if (match) {
      const remain = 1000 - ratios.reduce((a, b) => a + b, 0);
      const rank = [...exact].sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
      for (let j = 0; j < remain; j++) {
        ratios[rank[j % rank.length].i]++;
      }
    } else {
      ratios = areas.map((a) => Number(((a ?? 0n) * 1000n + total / 2n) / total));
    }
    return {
      ok: match,
      msg: match ? 'OK — Total आणि Crop Area match आहे' : 'Total आणि Crop Area जुळत नाहीत',
      ratios,
      sumArea,
      totalArea: total,
      sumRatio: ratios.reduce((a, b) => a + b, 0),
      diff: total - sumArea,
    };
  }, [ratioTotalLand, ratioCrops]);

  // Jump from Cart directly to Mix Ratio Calculator
  const handleOpenRatioFromCart = () => {
    if (!cart.length) {
      showToast('Ratio काढण्यासाठी आधी पिके यादीत टाका.');
      return;
    }
    let totalAreaPico = 0n;
    const converted = cart.map((entry, idx) => {
      const a8 = parseArea8(entry.area);
      totalAreaPico += a8;
      return {
        id: idx + 1,
        name: entry.result.record.crop,
        area: fmtRatioArea(a8),
      };
    });
    setRatioCrops(converted);
    setRatioTotalLand(fmtRatioArea(totalAreaPico));
    setActiveTab('ratio');
    showToast('Ratio कॅल्क्युलेटर उघडले.');
  };

  const handleAddRatioCrop = () => {
    if (ratioCrops.length >= 30) {
      showToast('कमाल 30 पिके जोडता येतात.');
      return;
    }
    const newId = Date.now();
    setRatioCrops((prev) => [
      ...prev,
      { id: newId, name: `पीक ${prev.length + 1}`, area: '0.00' },
    ]);
  };

  const handleRemoveRatioCrop = (id: number) => {
    if (ratioCrops.length <= 2) {
      showToast('किमान 2 पिके आवश्यक आहेत.');
      return;
    }
    setRatioCrops((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRatioCopy = async () => {
    if (!mixState.ok) {
      showToast('आधी Total आणि Crop Area जुळवा.');
      return;
    }
    const text =
      `Total Hectare: ${ratioTotalLand}\n` +
      ratioCrops.map((r, i) => `${r.name}: ${r.area} ha → ${mixState.ratios[i]}`).join('\n') +
      `\nRatio Total: ${mixState.sumRatio}\n\nMaha Corner — PMFBY Mix Ratio`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Ratio कॉपी झाले ✓');
    } catch {}
  };

  const handleResetRatio = () => {
    setRatioCrops([
      { id: 1, name: 'पीक 1', area: '0.06' },
      { id: 2, name: 'पीक 2', area: '0.05' },
    ]);
    setRatioTotalLand('0.11');
    showToast('Ratio रीसेट झाले.');
  };

  // Build Copy Summary Text
  const buildSummaryText = (): string => {
    if (!cart.length) {
      if (previewState.ok && previewState.result) {
        const preview = previewState.result;
        const raw = [
          `PMFBY रब्बी 2026–27 — Maha Corner`,
          `${selectedDistrict} / ${preview.record.crop}`,
          `क्षेत्र ${areaInput} हे.`,
          `विमा हप्ता (शेतकरी हिस्सा): ${formatMoneyPaise(preview.farmer)}`,
          `सातबारा प्रिंट व इतर शुल्क: ${formatMoneyPaise(feePaise)}`,
          `*एकूण देय रक्कम (टोटल): ${formatMoneyPaise(preview.farmer + feePaise)}*`,
          `दर/हे.: ${formatMoneyPaise(parseAmountToPaise(preview.record.farmer_premium_per_ha))}`,
          `स्रोत: महाराष्ट्र शासन निर्णय 03-07-2026, ${preview.record.form}`,
        ].join('\n');
        return appendPmfbyPageLink(raw);
      }
      return appendPmfbyPageLink('PMFBY रब्बी 2026–27 — Maha Corner');
    }

    const lines = [
      `PMFBY रब्बी 2026–27 — Maha Corner`,
      ...cart.map(
        (v, i) =>
          `${i + 1}. ${v.result.record.crop} · ${v.result.record.district} · ${v.area} हे. · ${formatMoneyPaise(v.result.farmer)}`
      ),
      `विमा हप्ता: ${formatMoneyPaise(effectiveFarmerPremium)}`,
      `सातबारा प्रिंट व इतर शुल्क: ${formatMoneyPaise(feePaise)}`,
      `*एकूण देय रक्कम (टोटल): ${formatMoneyPaise(combinedTotalPayable)}*`,
      `GR 03-07-2026 · अंतिम रक्कम अधिकृत पोर्टलवर तपासा.`,
    ];
    return appendPmfbyPageLink(lines.join('\n'));
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      showToast('कॉपी झाले ✓');
      trackFeatureAction('pmfby-calc');
    } catch {}
  };

  // WhatsApp Message (Matches exact format requested by user)
  const buildWhatsAppMessage = (): string => {
    const entries = cart.length
      ? cart
      : previewState.ok && previewState.result
      ? [
          {
            result: previewState.result,
            area: areaInput,
            perHa: parseAmountToPaise(previewState.result.record.farmer_premium_per_ha),
          },
        ]
      : [];

    if (!entries.length) {
      return (
        `🌾 *PMFBY रब्बी २०२६–२७ पीक विमा कॅल्क्युलेटर — Maha Corner*\n\n` +
        `✅ महाराष्ट्रातील सर्व ३२ जिल्हे व अधिसूचित पिकांचा अचूक शेतकरी हिस्सा\n` +
        `✅ सातबारा प्रिंट व इतर शुल्क एकत्रित बेरीज\n` +
        `✅ मिश्र पीक प्रमाण (Ratio) कॅल्क्युलेटर\n\n` +
        `👉 थेट हेच कॅल्क्युलेटर पेज उघडा (फक्त हेच पेज उघडा):\n` +
        `${getPmfbyPageUrl()}`
      );
    }

    const premium = entries.reduce((sum, entry) => sum + entry.result.farmer, 0n);
    const separateFee = feePaise;
    const district = entries[0].result.record.district;

    const lines = [
      '🌾 *प्रधानमंत्री पीक विमा योजना — रब्बी 2026–27*',
      `📍 जिल्हा: ${district}`,
      '',
      ...entries.map(
        (entry, i) =>
          `${i + 1}. *${entry.result.record.crop}*\n   क्षेत्र: ${entry.area} हेक्टर | दर: ${formatMoneyPaise(
            parseAmountToPaise(entry.result.record.farmer_premium_per_ha)
          )}/हे.\n   विमा हप्ता: ${formatMoneyPaise(entry.result.farmer)}`
      ),
      '',
      `विमा हप्ता: *${formatMoneyPaise(premium)}*`,
      `सातबारा प्रिंट व इतर शुल्क: ${formatMoneyPaise(separateFee)}`,
      `*एकूण देय रक्कम (टोटल): ${formatMoneyPaise(premium + separateFee)}*`,
      '',
      'सूचना: अंतिम विमा हप्ता अधिकृत PMFBY पोर्टलवर पडताळा. स्वतंत्र शुल्क हे विमा अर्जाचे शुल्क नाही.',
      '',
      `👉 थेट हेच कॅल्क्युलेटर पेज उघडा (Direct Calculator Page):`,
      `${getPmfbyPageUrl()}`,
      '',
      'Maha Corner',
    ];
    return lines.join('\n');
  };

  const whatsAppUrl = useMemo(() => {
    try {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(buildWhatsAppMessage())}`;
    } catch {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(getPmfbyPageUrl())}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, previewState, feePaise, selectedDistrict, areaInput]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-12 font-sans text-[#113f2b]">
      {/* =========================================================================
          HERO HEADER: Matched exactly to cspwala.in/pmfby-rabi-2026/
          Replaced CSPWala / CSPWALA.IN with MAHA CORNER
      ========================================================================= */}
      <header className="rounded-b-[22px] sm:rounded-[22px] bg-gradient-to-r from-[#076339] via-[#068544] to-[#07522f] text-white p-4 sm:p-6 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold flex-wrap gap-2">
          <span>🌾 PMFBY 2026–27 Premium Calculator</span>
          <div className="flex items-center gap-2">
            <a
              href={getPmfbyPageOnlyInviteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
              title="WhatsApp वर फक्त हे कॅल्क्युलेटर पेज शेअर करा"
            >
              <span>📲 WhatsApp शेअर</span>
            </a>
            <span className="text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-full bg-white/15 border border-white/30 backdrop-blur-xs">
              MAHA CORNER
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              PMFBY 2026–27 Premium Calculator
            </h1>
            <p className="text-[#f4d374] font-black text-sm sm:text-base mt-0.5">
              महाराष्ट्र राज्य · रब्बी हंगाम
            </p>
          </div>

          {/* Navigation Tabs: ₹ Premium & 🔢 Mix Ratio Calculator */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl bg-white/20 border border-white/30 backdrop-blur-xs w-full sm:w-auto sm:min-w-[340px]">
            <button
              type="button"
              onClick={() => setActiveTab('premium')}
              className={`h-11 sm:h-12 px-4 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'premium'
                  ? 'bg-white text-[#075f39] shadow-md'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              <span>₹</span>
              <span>Premium</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ratio')}
              className={`h-11 sm:h-12 px-4 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'ratio'
                  ? 'bg-white text-[#075f39] shadow-md'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              <span>🔢</span>
              <span>Mix Ratio Calculator</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          TAB 1: PREMIUM VIEW (दोन मुख्य कार्ड्स: डावीकडे कॅल्क्युलेटर, उजवीकडे निवडलेली पिके)
      ========================================================================= */}
      {activeTab === 'premium' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Card 1: 🧮 प्रीमियम कॅल्क्युलेटर */}
          <section className="bg-white rounded-[18px] border border-[#dcece3] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="border-b border-[#e6f2eb] pb-2">
              <h2 className="text-base sm:text-lg font-black text-[#113f2b] flex items-center gap-1.5">
                <span>🧮 प्रीमियम कॅल्क्युलेटर</span>
              </h2>
              <p className="text-xs text-[#66788a] font-semibold mt-0.5">
                जिल्हा → पीक → हेक्टर → शेतकरी हिस्सा
              </p>
            </div>

            {/* जिल्हा निवडा */}
            <div className="space-y-1">
              <label htmlFor="district-select" className="text-xs font-black text-[#445b50] block">
                जिल्हा निवडा
              </label>
              <select
                id="district-select"
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full h-12 px-3.5 rounded-[13px] border border-[#c8dfd2] bg-[#fbfffc] text-sm sm:text-base font-bold text-[#1a4230] focus:ring-2 focus:ring-[#098447] focus:outline-none"
              >
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Two Column: पीक निवडा & क्षेत्र Hectare */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="crop-select" className="text-xs font-black text-[#445b50] block">
                  पीक निवडा
                </label>
                <select
                  id="crop-select"
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  disabled={!districtCrops.length}
                  className="w-full h-12 px-3 rounded-[13px] border border-[#c8dfd2] bg-[#fbfffc] text-xs sm:text-sm font-bold text-[#1a4230] focus:ring-2 focus:ring-[#098447] focus:outline-none disabled:opacity-50"
                >
                  {districtCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.crop}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="area-input" className="text-xs font-black text-[#445b50] block">
                  क्षेत्र Hectare
                </label>
                <input
                  id="area-input"
                  type="text"
                  inputMode="decimal"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="0.50"
                  className="w-full h-12 px-3.5 rounded-[13px] border border-[#c8dfd2] bg-[#fbfffc] text-base font-black font-mono tabular-nums text-[#1a4230] focus:ring-2 focus:ring-[#098447] focus:outline-none"
                />
              </div>
            </div>

            {/* जलद hectare निवडा (10 Quick Buttons) */}
            <div className="space-y-1.5">
              <span className="text-xs font-black text-[#445b50] block">
                जलद hectare निवडा
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {QUICK_AREAS.map((amt) => {
                  const isActive = areaInput === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAreaInput(amt)}
                      className={`h-9 rounded-[10px] text-xs font-black font-mono tabular-nums transition-colors cursor-pointer border ${
                        isActive
                          ? 'bg-[#075f39] text-white border-[#075f39] shadow-xs'
                          : 'bg-white text-[#1a4230] border-[#c8dfd2] hover:bg-[#eef8f2]'
                      }`}
                    >
                      {amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                {errorMessage}
              </div>
            )}

            {/* Amount Panel: शेतकरी हिस्सा */}
            <div className="rounded-[14px] bg-[#e8f7ee] border border-[#b2e3c6] p-3.5 sm:p-4 text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#075f39] block">
                शेतकरी हिस्सा (विमा हप्ता)
              </span>
              <output className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-[#075f39] block">
                {previewState.ok && previewState.result
                  ? formatMoneyPaise(previewState.result.farmer)
                  : '—'}
              </output>
              {feePaise > 0n && previewState.ok && previewState.result && (
                <div className="text-xs text-[#075f39] font-bold font-mono pt-1 border-t border-[#b2e3c6]/60">
                  + सातबारा शुल्क {formatMoneySmall(feePaise)} = एकूण देय {formatMoneyPaise(previewState.result.farmer + feePaise)}
                </div>
              )}
            </div>

            {/* Stats Row: दर / हे. | पिके | देय */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">दर / हे.</span>
                <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                  {selectedRecord
                    ? formatMoneySmall(parseAmountToPaise(selectedRecord.farmer_premium_per_ha))
                    : '—'}
                </strong>
              </div>

              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">पिके</span>
                <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                  {cart.length}
                </strong>
              </div>

              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">एकूण देय</span>
                <strong className="text-xs sm:text-sm font-black text-[#075f39] font-mono tabular-nums">
                  {formatMoneySmall(combinedTotalPayable)}
                </strong>
              </div>
            </div>

            {/* Action Buttons: + यादीत टाका | Copy */}
            <div className="grid grid-cols-12 gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddCrop}
                className="col-span-8 h-12 rounded-[13px] bg-[#075f39] hover:bg-[#098447] text-white text-sm font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>+ यादीत टाका</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="col-span-4 h-12 rounded-[13px] bg-[#f0fbf5] hover:bg-[#e0f5ea] border border-[#b2e3c6] text-[#075f39] text-sm font-black transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Copy</span>
              </button>
            </div>
          </section>

          {/* Card 2: निवडलेली पिके (Selected Crops Cart) */}
          <section className="bg-white rounded-[18px] border border-[#dcece3] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6f2eb] pb-2">
              <h2 className="text-base sm:text-lg font-black text-[#113f2b]">
                निवडलेली पिके
              </h2>

              <div className="flex items-center gap-2">
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 rounded-xl bg-[#e9f9ef] hover:bg-[#d8f7e5] border border-[#aadbbc] text-[#087b42] text-xs font-black inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="WhatsApp वर हिशोब शेअर करा"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleClearCart}
                  className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-black transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* List of Selected Crops in Cart */}
            <div className="space-y-2 min-h-[60px]">
              {cart.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8091a5] font-semibold border-2 border-dashed border-[#e6f2eb] rounded-[14px]">
                  अजून पीक जोडलेले नाही.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-[14px] border border-[#dcece3] bg-[#fbfffc] flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-black text-sm text-[#113f2b]">
                        {item.result.record.crop}
                      </div>
                      <div className="text-xs text-[#66788a] font-semibold">
                        {item.result.record.district} · {item.area} ha · {formatMoneyPaise(item.perHa)}/हे.
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCrop(item.id)}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer mt-1 block"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#075f39]">
                        {formatMoneyPaise(item.result.farmer)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* सातबारा प्रिंट व इतर शुल्क (Other Fee / CSC Fee Buttons + Custom Edit Input) */}
            <div className="rounded-[16px] border border-[#cbe5d6] bg-[#f2f9f5] p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🖨️</span>
                  <h3 className="text-xs sm:text-sm font-black text-[#113f2b]">
                    सातबारा प्रिंट व इतर शुल्क
                  </h3>
                </div>
                <span className="text-xs font-black font-mono text-[#075f39] px-2 py-0.5 rounded-md bg-[#e1f5e8] border border-[#b8e2c8]">
                  + {formatMoneyPaise(feePaise)}
                </span>
              </div>

              {/* Editable Input Box for Custom Fee */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#113f2b]">
                  <label htmlFor="custom-fee-input" className="flex items-center gap-1">
                    <span>✏️ शुल्क रक्कम एडिट करा (रुपये):</span>
                  </label>
                  {feePaise > 0n && (
                    <button
                      type="button"
                      onClick={() => handleSelectPresetFee(0)}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      शुल्क ₹0 करा (Clear)
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sm font-black text-[#075f39]">
                    ₹
                  </div>
                  <input
                    id="custom-fee-input"
                    type="text"
                    inputMode="decimal"
                    value={feeInputString}
                    onChange={(e) => handleFeeInputChange(e.target.value)}
                    placeholder="0"
                    aria-label="सातबारा प्रिंट शुल्क रक्कम"
                    className="w-full h-10 pl-8 pr-20 rounded-xl border border-[#b8ddc8] bg-white text-sm font-black text-[#113f2b] focus:border-[#075f39] focus:ring-2 focus:ring-[#075f39]/20 outline-none font-mono tabular-nums shadow-2xs"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-black text-slate-500">
                    रुपये
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#66788a] uppercase tracking-wider block">
                  किंवा त्वरित पर्याय निवडा:
                </span>
                <div className="grid grid-cols-6 gap-1.5">
                  {FEE_PRESETS.map((fee) => {
                    const feeB = BigInt(fee) * 100n;
                    const isActive = feePaise === feeB;
                    return (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => handleSelectPresetFee(fee)}
                        className={`h-9 rounded-[10px] text-xs font-black font-mono tabular-nums transition-colors cursor-pointer border ${
                          isActive
                            ? 'bg-[#075f39] text-white border-[#075f39] shadow-xs'
                            : 'bg-white text-[#1a4230] border-[#c8dfd2] hover:bg-[#eef8f2]'
                        }`}
                      >
                        {fee === 0 ? '₹0' : `+₹${fee}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#dcece3] text-center">
                <div className="p-1.5 rounded-lg bg-white border border-[#dcece3]">
                  <span className="text-[11px] font-bold text-[#66788a] block">विमा हप्ता</span>
                  <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                    {formatMoneySmall(effectiveFarmerPremium)}
                  </strong>
                </div>

                <div className="p-1.5 rounded-lg bg-white border border-[#dcece3]">
                  <span className="text-[11px] font-bold text-[#66788a] block">सातबारा/इतर शुल्क</span>
                  <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                    {formatMoneySmall(feePaise)}
                  </strong>
                </div>

                <div className="p-1.5 rounded-lg bg-[#eaf7ef] border border-[#b2e3c6]">
                  <span className="text-[11px] font-black text-[#075f39] block">एकूण देय</span>
                  <strong className="text-xs sm:text-sm font-black text-[#075f39] font-mono tabular-nums">
                    {formatMoneySmall(combinedTotalPayable)}
                  </strong>
                </div>
              </div>
            </div>

            {/* एकूण देय रक्कम (Total Amount Panel) */}
            <div className="rounded-[15px] bg-[#075f39] text-white p-4 text-center space-y-1.5 shadow-md">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-200 block">
                एकूण देय रक्कम (विमा हप्ता + सातबारा प्रिंट शुल्क एकत्र करून)
              </span>
              <output className="text-3xl sm:text-4xl font-black font-mono tabular-nums block">
                {formatMoneyPaise(combinedTotalPayable)}
              </output>
              <div className="text-xs font-mono text-emerald-100 flex items-center justify-center gap-2 pt-1 border-t border-emerald-600/60">
                <span>विमा: {formatMoneySmall(effectiveFarmerPremium)}</span>
                <span>+</span>
                <span>सातबारा शुल्क: {formatMoneySmall(feePaise)}</span>
                <span>=</span>
                <span className="font-black text-white">{formatMoneySmall(combinedTotalPayable)}</span>
              </div>
            </div>

            {/* Direct WhatsApp Share & Copy Summary Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                title="WhatsApp वर हिशोब व डायरेक्ट लिंक पाठवा"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M20.1 11.7c0 4.6-3.7 8.3-8.3 8.3-1.3 0-2.5-.3-3.6-.8l-4.7 1.2 1.3-4.5c-.7-1.2-1.1-2.6-1.1-4.2 0-4.6 3.7-8.3 8.3-8.3 4.5 0 8.1 3.7 8.1 8.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M8.3 7.9c-.3 0-.7.1-.8.5-.2.3-.7 1.1-.7 1.7s.6 1.3.7 1.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.7 2.7.7.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .2-1.1 0-.1-.2-.2-.5-.4l-1.5-.7c-.3-.2-.5-.2-.7.2l-.7.8c-.2.2-.3.3-.6.1-.3-.1-1.1-.4-2-1.3-.7-.6-1.2-1.4-1.3-1.6-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.4.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.1-.3-.3-.4-.5-.4Z" fill="white" />
                </svg>
                <span>WhatsApp वर पाठवा</span>
              </a>

              <button
                type="button"
                onClick={handleCopySummary}
                className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>📋 हिशोब कॉपी करा</span>
              </button>
            </div>

            {/* Jump to Ratio Calculator Button */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleOpenRatioFromCart}
                className="h-10 px-5 rounded-full bg-[#f0fbf5] hover:bg-[#daf5e5] border border-[#b7e3c8] text-[#087545] text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>🔢 Calculate Ratio</span>
                <span className="text-sm">›</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MIX RATIO CALCULATOR VIEW (मिश्र पीक प्रमाण कॅल्क्युलेटर)
      ========================================================================= */}
      {activeTab === 'ratio' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Card 1: Ratio Overview */}
          <section className="bg-white rounded-[18px] border border-[#dcece3] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6f2eb] pb-2">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#113f2b]">
                  🔢 Mix Ratio Calculator
                </h2>
                <p className="text-xs text-[#66788a] font-semibold">
                  Ratio = Crop Area ÷ Total × 1000
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRatioCrop}
                className="h-9 px-3 rounded-xl bg-[#075f39] hover:bg-[#098447] text-white text-xs font-black transition-colors cursor-pointer"
              >
                + Add Crop
              </button>
            </div>

            {/* पूर्ण जमीन / Total Hectare Input */}
            <div className="space-y-1">
              <label htmlFor="total-land" className="text-xs font-black text-[#445b50] block">
                पूर्ण जमीन / Total Hectare
              </label>
              <input
                id="total-land"
                type="text"
                inputMode="decimal"
                value={ratioTotalLand}
                onChange={(e) => setRatioTotalLand(e.target.value)}
                placeholder="0.11"
                className="w-full h-12 px-3.5 rounded-[13px] border border-[#c8dfd2] bg-[#fbfffc] text-base font-black font-mono tabular-nums text-[#1a4230] focus:ring-2 focus:ring-[#098447] focus:outline-none"
              />
            </div>

            {/* Ratio Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">Crop Area</span>
                <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                  {fmtRatioArea(mixState.sumArea)}
                </strong>
              </div>

              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">Difference</span>
                <strong className="text-xs sm:text-sm font-black text-[#113f2b] font-mono tabular-nums">
                  {fmtRatioArea(mixState.diff)}
                </strong>
              </div>

              <div className="p-2.5 rounded-xl border border-[#dcece3] bg-[#f9fdfa]">
                <span className="text-[11px] font-bold text-[#66788a] block">Ratio Total</span>
                <strong className="text-xs sm:text-sm font-black text-[#075f39] font-mono tabular-nums">
                  {mixState.sumRatio}
                </strong>
              </div>
            </div>

            {/* Ratio Status Badge */}
            <div
              className={`p-3 rounded-xl text-xs font-extrabold text-center border ${
                mixState.ok
                  ? 'bg-[#eefbf3] border-[#b6dfc9] text-[#0a7a44]'
                  : 'bg-[#fff3ec] border-[#ffbe9c] text-[#a04213]'
              }`}
            >
              {mixState.msg}
            </div>

            {/* GR Document Link */}
            <div className="pt-2 text-center border-t border-[#e6f2eb] space-y-2">
              <h3 className="text-xs font-black text-[#235a3f]">
                रब्बी 2026–27 शासन निर्णय व अधिसूचना
              </h3>
              <a
                href="https://krishi.maharashtra.gov.in/Site/Common/ViewGr.aspx?Doctype=ed5a4ceb-ad07-4189-b236-f9d191d5752d"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-5 rounded-xl bg-[#075f39] hover:bg-[#098447] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <span>📄 Download / Open Link</span>
              </a>
            </div>
          </section>

          {/* Card 2: पीक यादी (Ratio Crops Card) */}
          <section className="bg-white rounded-[18px] border border-[#dcece3] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#e6f2eb] pb-2">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#113f2b]">
                  पीक यादी
                </h2>
                <p className="text-xs text-[#66788a] font-semibold">
                  2 पीके default, गरजेनुसार add करा
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRatioCrop}
                className="h-9 px-3 rounded-xl bg-[#075f39] hover:bg-[#098447] text-white text-xs font-black transition-colors cursor-pointer"
              >
                + Add Crop
              </button>
            </div>

            {/* List of Ratio Crops */}
            <div className="space-y-3">
              {ratioCrops.map((r, i) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-[#dcece3] p-3 bg-white space-y-2 shadow-2xs"
                >
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 space-y-1">
                      <label className="text-[11px] font-bold text-[#718092] block">
                        पीक नाव
                      </label>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRatioCrops((prev) =>
                            prev.map((item) => (item.id === r.id ? { ...item, name: val } : item))
                          );
                        }}
                        className="w-full h-11 px-2.5 rounded-xl border border-[#c8dfd2] bg-[#fbfffc] text-xs font-black text-[#233b2d] focus:ring-2 focus:ring-[#098447] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-4 space-y-1">
                      <label className="text-[11px] font-bold text-[#718092] block">
                        हेक्टर
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={r.area}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRatioCrops((prev) =>
                            prev.map((item) => (item.id === r.id ? { ...item, area: val } : item))
                          );
                        }}
                        className="w-full h-11 px-2.5 rounded-xl border border-[#c8dfd2] bg-[#fbfffc] text-sm font-black font-mono tabular-nums text-[#233b2d] focus:ring-2 focus:ring-[#098447] focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3 space-y-1">
                      <label className="text-[11px] font-bold text-[#718092] block">
                        Ratio
                      </label>
                      <div className="h-11 rounded-xl border border-[#c6efd5] bg-[#eefff3] text-[#168348] text-lg font-black font-mono flex items-center justify-center">
                        {mixState.ratios[i] ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#778397] font-bold pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-mono">
                      {r.area || '0'} ha → raw{' '}
                      {mixState.totalArea > 0n
                        ? (
                            (Number(safeArea8(r.area) || 0n) * 1000) /
                            Number(mixState.totalArea)
                          ).toFixed(2)
                        : '—'}
                    </span>

                    {ratioCrops.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveRatioCrop(r.id)}
                        className="text-xs font-black text-[#b52b53] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">Default</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Row: Copy Ratio | WhatsApp | Reset */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={handleRatioCopy}
                className="h-11 rounded-xl bg-[#f0fbf5] hover:bg-[#daf5e5] border border-[#b2e3c6] text-[#075f39] text-xs font-black transition-colors cursor-pointer"
              >
                Copy Ratio
              </button>

              <a
                href={getPmfbyPageOnlyInviteUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="WhatsApp वर फक्त हे कॅल्क्युलेटर पेज शेअर करा"
              >
                <span>📲 WhatsApp शेअर</span>
              </a>

              <button
                type="button"
                onClick={handleResetRatio}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-black transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </section>
        </div>
      )}



      {/* Official Footnote */}
      <div className="text-center text-xs text-[#678272] font-semibold space-y-1">
        <p>
          GR 03-07-2026 · प्रपत्र अ-35 ते अ-66 ·{' '}
          <a
            href="https://pmfby.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#075f39] underline font-bold"
          >
            अंतिम हप्ता PMFBY पोर्टलवर तपासा
          </a>
        </p>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#105d39] text-white text-xs font-black shadow-xl animate-fade-in text-center max-w-[90vw]">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

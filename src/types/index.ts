export type AppTab =
  | 'ai-poster'
  | 'maha-news'
  | 'vip-posters'
  | 'cutter'
  | 'bulk-card'
  | 'farmer-card'
  | 'pmfby-calc'
  | 'photo-resizer'
  | 'pdf-tools'
  | 'gr'
  | 'jobs'
  | 'portals'
  | 'store'
  | 'about'
  | 'privacy'
  | 'terms'
  | 'disclaimer'
  | 'contact';

export interface AiPosterData {
  id?: string;
  topBadge: string;
  mainTag: string;
  title: string;
  subTitle: string;
  statusTag: string;
  noticeTitle: string;
  noticeText: string;
  servicesHeadline: string;
  services: string[];
  col1Title: string;
  col1Items: string[];
  col2Title: string;
  col2Items: string[];
  urgencyText: string;
  visualTheme: 'farmer-biometric' | 'ladki-bahin' | 'pm-kisan' | 'aadhaar-pan' | 'health-ayushman' | 'job-recruitment' | 'general-service';
  primaryColor: string;
  headerBadgeColor: string;
  centerName: string;
  centerTagline: string;
  phones: string[];
  address?: string;
}

export interface CscPosterItem {
  id: string;
  title: string;
  titleMr: string;
  category: string;
  categoryMr: string;
  tag: string;
  summary: string;
  keyPoints: string[];
  bgGradient: [string, string];
  accentColor: string;
  badgeText: string;
  recommendedServices: string[];
}

export interface FarmerCardData {
  fullName: string;
  farmerId: string;
  aadhaarNo: string;
  mobileNo: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  pincode: string;
  gatNo: string;
  khataNo: string;
  landArea: string;
  landType: string;
  crops?: string;
  bankName?: string;
  bankAccount?: string;
  issueDate: string;
  validity: string;
  cardTheme: 'agro-green' | 'royal-navy' | 'modern-teal' | 'apmc-gold';
  photoUrl: string | null;
  signatureUrl: string | null;
  includeWatermark: boolean;
}

export interface PosterConfig {
  title: string;
  message: string;
  footerText: string;
  ownerName: string;
  businessPhone: string;
  address: string;
  bg: string;
  fg: string;
  designStyle: 'premium' | 'farmer' | 'scheme' | 'festive' | 'minimal';
  format: '1:1' | '4:5' | '9:16' | '16:9' | 'a4';
  isContentLocked: boolean;
}

export interface PaperSpec {
  name: string;
  label: string;
  w: number; // in mm
  h: number; // in mm
  dpi: number;
  orientation?: 'portrait' | 'landscape';
}

export type SplitMode = 'side' | 'stack' | 'duplex' | 'manual';
export type SheetSize = 'a4' | '4x6' | 'a5' | '5x7' | '3.5x5' | 'letter';
export type OutputFormat = 'pdf' | 'jpg' | 'png' | 'webp';
export type PrintMode = 'same' | 'duplex';

export interface SavedTemplate {
  id: string;
  name: string;
  date: string;
  config: PosterConfig;
}

export type BulkCardLayout = 'a4-5cards' | 'a4-10cards' | 'epson-tray' | '4x6-2cards';

export interface BulkCardItem {
  id: string;
  name: string;
  cardType: 'aadhaar' | 'ayushman' | 'farmer' | 'voter' | 'labour' | 'custom';
  frontCanvas: HTMLCanvasElement | null;
  backCanvas: HTMLCanvasElement | null;
  frontThumbnail: string;
  backThumbnail: string;
  rotationFront: number; // 0, 90, 180, 270
  rotationBack: number;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  selected: boolean;
}

export interface BulkCardConfig {
  layout: BulkCardLayout;
  showCutMarks: boolean;
  showFoldingLine: boolean;
  showCornerRadius: boolean;
  foldingGapMm: number; // 0, 1, 2, 3 mm
  exportDpi: number; // 200 or 300
  outerBorderWidth: number; // 0.2 to 1 pt
  alignMode: 'center' | 'top';
  paperSize: 'a4' | '4x6';
}

export interface VipPosterItem {
  id: string;
  packId: string;
  titleMr: string;
  categoryMr: string;
  descMr: string;
  badgeMr: string;
  bgGradient: [string, string];
  accentColor: string;
  previewThumbnail?: string;
  templateData: Partial<AiPosterData>;
}

export interface VipPosterPack {
  id: string;
  nameMr: string;
  nameEn: string;
  taglineMr: string;
  price: number;
  originalPrice: number;
  discountBadge: string;
  icon: string;
  color: string;
  accentBorder: string;
  features: string[];
  popular?: boolean;
  validityDays?: number; // e.g. 30 for monthly, undefined for lifetime
  billingType?: 'monthly' | 'lifetime' | 'pack';
  posters: VipPosterItem[];
}

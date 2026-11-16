import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  Mail,
  MapPin,
  UserCheck,
  Building2,
  Send,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Lock,
  Globe
} from 'lucide-react';
import { AppTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { submitContactInquiry } from '../utils/firebaseContact';

export type InfoPageTab = 'privacy' | 'terms' | 'disclaimer' | 'contact';

interface ImportantInfoPagesProps {
  page: InfoPageTab;
  onNavigateTab: (tab: AppTab) => void;
}

export const ImportantInfoPages: React.FC<ImportantInfoPagesProps> = ({
  page,
  onNavigateTab,
}) => {
  const { t } = useLanguage();

  // Contact form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    refId?: string;
  } | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const result = await submitContactInquiry({ name, mobile, email, message });
      if (result.success) {
        setSubmitStatus({
          type: 'success',
          text: result.feedback,
          refId: result.referenceId,
        });
        setName('');
        setMobile('');
        setEmail('');
        setMessage('');
      } else {
        setSubmitStatus({
          type: 'error',
          text: result.feedback,
        });
      }
    } catch {
      setSubmitStatus({
        type: 'error',
        text: t(
          'संदेश पाठवताना तांत्रिक अडचण आली. कृपया थेट kamleshpatil9719@gmail.com वर ईमेल करा.',
          'Could not submit message right now. Please email kamleshpatil9719@gmail.com directly.'
        ),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const navItems: { id: AppTab; labelMr: string; labelEn: string }[] = [
    { id: 'about', labelMr: 'माझ्याबद्दल (About Me)', labelEn: 'About Me' },
    { id: 'privacy', labelMr: 'गोपनीयता धोरण (Privacy Policy)', labelEn: 'Privacy Policy' },
    { id: 'terms', labelMr: 'अटी व शर्ती (Terms & Conditions)', labelEn: 'Terms & Conditions' },
    { id: 'disclaimer', labelMr: 'अस्वीकरण (Disclaimer)', labelEn: 'Disclaimer' },
    { id: 'contact', labelMr: 'संपर्क करा (Contact Us)', labelEn: 'Contact Us' },
  ];

  const pageMeta: Record<
    InfoPageTab,
    { titleMr: string; titleEn: string; subMr: string; subEn: string; icon: React.ReactNode }
  > = {
    privacy: {
      titleMr: 'गोपनीयता धोरण (Privacy Policy)',
      titleEn: 'Privacy Policy',
      subMr: 'तुमची माहिती, PDF फाईल्स व फोटो यांची सुरक्षितता आणि डेटा हाताळणी विषयी पारदर्शक माहिती',
      subEn: 'Transparent details on user data, local PDF & photo processing, cookies, and privacy protection',
      icon: <ShieldCheck className="w-7 h-7 text-amber-400" />,
    },
    terms: {
      titleMr: 'अटी व शर्ती (Terms & Conditions)',
      titleEn: 'Terms & Conditions',
      subMr: 'MAHA CORNER वेबसाईट व डिजिटल साधनांच्या वापराचे नियम व अटी',
      subEn: 'Website usage rules, digital & PDF tool usage terms, and user responsibilities',
      icon: <FileText className="w-7 h-7 text-amber-400" />,
    },
    disclaimer: {
      titleMr: 'अस्वीकरण (Disclaimer)',
      titleEn: 'Disclaimer',
      subMr: 'स्वतंत्र डिजिटल माहिती व सेवा पोर्टल — अधिकृत सरकारी वेबसाईट नाही',
      subEn: 'Independent Digital Information & Services Portal — Not an Official Government Website',
      icon: <AlertTriangle className="w-7 h-7 text-amber-400" />,
    },
    contact: {
      titleMr: 'आमचा पत्ता व संपर्क (Contact Us)',
      titleEn: 'Contact Us & Support',
      subMr: 'तक्रार, सूचना किंवा मदतीसाठी थेट संपर्क व निवारण फॉर्म',
      subEn: 'Official contact details and support inquiry form for MAHA CORNER',
      icon: <Mail className="w-7 h-7 text-amber-400" />,
    },
  };

  const activeMeta = pageMeta[page];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-6 sm:p-8 border border-amber-500/30 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('ai-poster')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('मुख्य पानावर जा', 'Back to Portal')}</span>
          </button>

          <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {t('महत्त्वाची माहिती • IMPORTANT INFORMATION', 'IMPORTANT INFORMATION')}
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-amber-500/40 flex items-center justify-center shrink-0">
            {activeMeta.icon}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              {t(activeMeta.titleMr, activeMeta.titleEn)}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t(activeMeta.subMr, activeMeta.subEn)}
            </p>
          </div>
        </div>

        {/* Quick switcher tabs */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = item.id === page;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigateTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                {t(item.labelMr, item.labelEn)}
              </button>
            );
          })}
        </div>
      </div>

      {/* PRIVACY POLICY CONTENT */}
      {page === 'privacy' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-sky-600" />
              <span>१. कोणती माहिती गोळा केली जाते? (Information We Collect)</span>
            </h2>
            <p>
              <strong>मराठी:</strong> MAHA CORNER वापरण्यासाठी सामान्यतः कोणत्याही लॉगिनची आवश्यकता नाही. आम्ही वैयक्तिक माहिती फक्त तेव्हाच घेतो जेव्हा तुम्ही स्वतःहून:
              (अ) "फॉलो / सबस्क्राईब" फॉर्मद्वारे नाव व मोबाईल नंबर संमतीने नोंदवता, किंवा
              (ब) "संपर्क करा (Contact Us)" फॉर्मद्वारे तुमचे नाव, मोबाईल नंबर, ईमेल व संदेश पाठवता.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> No account sign-in is required for normal visitors. We only collect personal information when you voluntarily submit the Follow/Subscribe form (Name & Mobile with explicit consent) or the Contact Us form (Name, Mobile, Email, and Message).
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" />
              <span>२. PDF फाईल्स व फोटो प्रक्रिया (How PDFs & Photos Are Processed)</span>
            </h2>
            <p>
              <strong>मराठी:</strong> या वेबसाईटवरील PDF टूल्स, फोटो रिसायझर, कार्ड कटर, शेतकरी ओळखपत्र व पोस्टर ब्रँडिंग ही साधने थेट तुमच्या स्वतःच्या ब्राउझरमध्ये (Client-Side / On-Device) काम करतात. तुम्ही वापरलेले वैयक्तिक दस्तऐवज, आधार/पॅन कार्ड किंवा फोटो कोणत्याही बाहेरील सर्व्हरवर जतन केले जात नाहीत. फक्त मालकाने (Owner) पब्लिश केलेले सार्वजनिक बॅनर्स Cloud मध्ये सेव्ह होतात.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> Our PDF utilities, Photo Resizer, Card Cutter, Farmer ID Card Maker, and Poster Branding tools process your files locally inside your own browser (Client-Side). Personal documents, ID cards, and photos you resize or convert are not uploaded or stored by us on external servers.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>३. डेटा सुरक्षा व कुकीज / Local Storage (Security & Local Storage)</span>
            </h2>
            <p>
              <strong>मराठी:</strong> तुमची भाषा निवड (मराठी/इंग्रजी) व तुमच्या केंद्राचे नाव/पत्ता पुन्हा भरण्याची गरज पडू नये म्हणून काही सेटिंग्ज तुमच्याच डिव्हाइसच्या ब्राउझर स्टोरेज (localStorage) मध्ये जतन राहतात. फॉलोअर व संपर्क संदेश Firebase Security Rules द्वारे संरक्षित केले जातात. तुमची नोंदवलेली संपर्क/फॉलोअर माहिती हटवायची असल्यास तुम्ही <span className="font-bold text-slate-900">kamleshpatil9719@gmail.com</span> वर ईमेल पाठवून विनंती करू शकता.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> Your language preference and shop footer text are saved locally in your browser&apos;s storage for convenience. Submitted follower and contact inquiry records are stored in Firebase Firestore with role-restricted security rules. You may request deletion of your submitted contact or follower record by emailing kamleshpatil9719@gmail.com.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              <span>४. तृतीय-पक्ष लिंक्स (Third-Party Links)</span>
            </h2>
            <p>
              <strong>मराठी:</strong> या पोर्टलवर अधिकृत शासकीय वेबसाईट्स (.gov.in), WhatsApp, YouTube व Instagram च्या लिंक्स दिलेल्या आहेत. त्या बाहेरील वेबसाईट्सची स्वतःची वेगळी गोपनीयता धोरणे लागू असतात.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> External links to official government portals, WhatsApp, YouTube, and Instagram are governed by their respective third-party privacy policies.
            </p>
          </section>
        </div>
      )}

      {/* TERMS & CONDITIONS CONTENT */}
      {page === 'terms' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">१. वेबसाईट वापराचे नियम (Website Usage Rules)</h2>
            <p>
              <strong>मराठी:</strong> MAHA CORNER वापरून तुम्ही या अटी व शर्तींशी सहमती दर्शवता. हे पोर्टल सामान्य नागरिक, शेतकरी, विद्यार्थी आणि डिजिटल सेवा केंद्र चालकांच्या मदतीसाठी माहिती व साधने उपलब्ध करून देते.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> By accessing MAHA CORNER, you agree to use this portal lawfully for personal, educational, agricultural, and citizen digital-service informational purposes.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900">२. PDF व डिजिटल साधनांचा वापर (PDF & Tool Usage)</h2>
            <p>
              <strong>मराठी:</strong> सर्व PDF टूल्स, फोटो रिसायझर, कार्ड कटर व पीक विमा कॅल्क्युलेटर ही साधने मदतीसाठी दिली आहेत. कोणत्याही शासकीय अर्जावर अपलोड करण्यापूर्वी तयार झालेली PDF फाईल, फोटो साईज आणि माहिती अचूक आहे की नाही याची खात्री स्वतः करावी.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> All PDF tools, photo resizer utilities, calculators, and poster tools are provided on an &quot;as-is&quot; basis. Always verify generated documents, dimensions, and details before submitting to official portals.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900">३. वापरकर्त्याची जबाबदारी व प्रतिबंधित कृती (User Responsibilities & Prohibited Activities)</h2>
            <p>
              <strong>मराठी:</strong> वापरकर्त्याने स्वतःच्या योग्य व कायदेशीर कागदपत्रांवरच प्रक्रिया करावी. बनावट सरकारी कागदपत्रे तयार करणे, वेबसाईटवर सायबर हल्ला करणे, स्पॅम संदेश पाठवणे, किंवा स्वतःला सरकारी अधिकारी म्हणून भासवणे पूर्णपणे प्रतिबंधित आहे.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> Users must process only legitimate documents they are authorized to handle. Forgery, uploading malicious scripts/malware, automated scraping, form spamming, or misrepresenting this portal as a government agency is strictly prohibited.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900">४. तृतीय-पक्ष वेबसाईट अटी (Third-Party Websites)</h2>
            <p>
              <strong>मराठी:</strong> पोर्टलवरून उघडल्या जाणाऱ्या इतर शासकीय किंवा बाहेरील वेबसाईट्सच्या सेवा, तांत्रिक बदल किंवा अटींसाठी MAHA CORNER जबाबदार राहणार नाही.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> External websites linked from our directories have their own terms of use and availability, over which MAHA CORNER has no control.
            </p>
          </section>
        </div>
      )}

      {/* DISCLAIMER CONTENT */}
      {page === 'disclaimer' && (
        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-6 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
            <div className="flex items-center gap-2 font-black text-base">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>महत्त्वाची सूचना • Important Notice</span>
            </div>
            <p className="font-bold">
              MAHA CORNER ही एक स्वतंत्र माहिती आणि डिजिटल-सेवा वेबसाईट आहे; ही कोणतीही अधिकृत सरकारी वेबसाईट नाही (Not an Official Government Website).
            </p>
            <p className="text-xs sm:text-sm text-amber-900">
              MAHA CORNER is an independent digital information and utility portal operated privately for citizen convenience. It is not affiliated with, endorsed by, or an official portal of the Government of Maharashtra or the Government of India.
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">१. शासकीय माहितीची पडताळणी (Verify from Official Sources)</h2>
            <p>
              <strong>मराठी:</strong> या वेबसाईटवरील शासकीय योजना, शासन निर्णय (GR), नोकरी भरती जाहिराती, तारखा व पोर्टल लिंक्स केवळ माहिती व मार्गदर्शनासाठी दिल्या आहेत. कोणताही अर्ज भरण्यापूर्वी किंवा निर्णय घेण्यापूर्वी संबंधित अधिकृत सरकारी वेबसाईटवर (उदा. .gov.in / .maharashtra.gov.in / gr.maharashtra.gov.in) मूळ माहिती नक्की तपासावी.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> Scheme details, GR summaries, recruitment dates, and portal links are provided for educational and informational convenience. Users should always verify details directly on official government websites (.gov.in / .maharashtra.gov.in) before applying or taking action.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-lg font-black text-slate-900">२. कोणत्याही शासकीय लाभाची किंवा मंजुरीची हमी नाही (No Guarantee of Approval)</h2>
            <p>
              <strong>मराठी:</strong> MAHA CORNER वरील माहिती, पोस्टर्स किंवा साधने वापरल्यास कोणत्याही शासकीय योजनेची मंजुरी, अनुदान किंवा नोकरीची खात्री दिली जात नाही. अंतिम निर्णय सर्वस्वी संबंधित शासकीय विभाग व पात्रता नियमांवर अवलंबून असतो.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              <strong>English:</strong> Using information, posters, or tools on MAHA CORNER does not guarantee government approval, financial benefit, or job selection. Final eligibility and decisions rest solely with the respective official authorities.
            </p>
          </section>
        </div>
      )}

      {/* CONTACT US CONTENT */}
      {page === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Exact Verified Entity & Contact Info */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {t('आमचा पत्ता व संपर्क', 'Contact Details')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('अधिकृत संपर्क माहिती:', 'Verified Portal Details:')}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Entity
                  </span>
                  <span className="font-black text-slate-900">MAHA CORNER</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <UserCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Operated By
                  </span>
                  <span className="font-black text-slate-900">Kamlesh Patil</span>
                </div>
              </div>

              <a
                href="mailto:kamleshpatil9719@gmail.com"
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 transition-colors"
              >
                <Mail className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Support Email
                  </span>
                  <span className="font-black text-slate-900 break-all">
                    kamleshpatil9719@gmail.com
                  </span>
                </div>
              </a>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <MapPin className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Location
                  </span>
                  <span className="font-black text-slate-900">Maharashtra, India</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://whatsapp.com/channel/0029Va4yf9vEFeXuKxF31F43"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <span>{t('अधिकृत WhatsApp चॅनेल पहा', 'Visit Official WhatsApp Channel')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right: Working Support / Grievance Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {t('तक्रार किंवा समस्या निवारण', 'Submit Inquiry or Feedback')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(
                  'तुमची अडचण, सूचना किंवा तक्रार खालील फॉर्ममध्ये नोंदवा:',
                  'Send us your message, feedback, or support query using the form below:'
                )}
              </p>
            </div>

            {submitStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-start gap-2.5 ${
                  submitStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {submitStatus.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p>{submitStatus.text}</p>
                  {submitStatus.refId && (
                    <p className="text-[11px] font-mono text-emerald-700">
                      Reference ID: {submitStatus.refId}
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('तुमचे नाव:', 'Your Name:')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('पूर्ण नाव', 'Full Name')}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('मोबाईल नंबर:', 'Mobile Number:')}
                  </label>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    maxLength={13}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder={t('10 अंकी मोबाईल', '10-digit Mobile')}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('ईमेल आयडी:', 'Email ID:')}
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('तुमचा संदेश / अडचण:', 'Your Message / Issue:')}
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={1500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('येथे संदेश लिहा...', 'Write your message here...')}
                  className="w-full p-3.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {submitting
                    ? t('पाठवत आहे...', 'Sending...')
                    : t('संदेश पाठवा (Submit)', 'Send Message')}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

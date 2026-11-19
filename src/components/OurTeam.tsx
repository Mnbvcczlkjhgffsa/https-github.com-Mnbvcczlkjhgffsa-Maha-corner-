import React, { useState, useEffect, useRef } from 'react';
import {
  Users2,
  Lock,
  Unlock,
  Upload,
  RefreshCw,
  Check,
  Briefcase,
  Laptop,
  Camera,
  Cpu,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../contexts/LanguageContext';
import { inspectUploadedFileBytes, PDF_SECURITY_LIMITS } from '../utils/pdfSecurity';

export interface TeamMember {
  id: 'vikas-patil' | 'pavan-patil' | 'shubham-patil' | 'jayesh-wagh';
  nameMr: string;
  nameEn: string;
  roleMr: string;
  roleEn: string;
  badgeEmoji: string;
  icon: React.ElementType;
  descMr: string;
  descEn: string;
  initials: string;
  skills: string[];
}

export const TEAM_MEMBERS_DATA: TeamMember[] = [
  {
    id: 'vikas-patil',
    nameMr: 'विकास गजानन पाटील',
    nameEn: 'Vikas Gajanan Patil',
    roleMr: 'Business & Tech Support',
    roleEn: 'Business & Tech Support',
    badgeEmoji: '💼',
    icon: Briefcase,
    descMr: 'महा कॉर्नरच्या व्यवसाय विकासाचे नियोजन, व्यवस्थापन आणि तांत्रिक कामकाजात सहकार्य.',
    descEn: 'Planning and managing Maha Corner business growth along with operational & technical support.',
    initials: 'VP',
    skills: ['Business Growth', 'Operations', 'Tech Coordination'],
  },
  {
    id: 'pavan-patil',
    nameMr: 'पवन भाईदास पाटील',
    nameEn: 'Pawan Bhaidas Patil',
    roleMr: 'Technical Support',
    roleEn: 'Technical Support',
    badgeEmoji: '💻',
    icon: Laptop,
    descMr: 'वेबसाइटचे तांत्रिक व्यवस्थापन, अडचणींचे निराकरण आणि डिजिटल सेवांसाठी तांत्रिक मदत.',
    descEn: 'Website technical management, troubleshooting, and digital service technical support.',
    initials: 'PP',
    skills: ['Troubleshooting', 'Web Support', 'Digital Services'],
  },
  {
    id: 'shubham-patil',
    nameMr: 'शुभम अशोक पाटील',
    nameEn: 'Shubham Ashok Patil',
    roleMr: 'Photography & Technical Support',
    roleEn: 'Photography & Technical Support',
    badgeEmoji: '📸',
    icon: Camera,
    descMr: 'फोटोग्राफी, फोटो व व्हिज्युअल कंटेंट निर्मिती आणि तांत्रिक कामांमध्ये सहकार्य.',
    descEn: 'Photography, photo & visual content creation, and technical workflow support.',
    initials: 'SP',
    skills: ['Photography', 'Visual Content', 'Design Support'],
  },
  {
    id: 'jayesh-wagh',
    nameMr: 'जयेश धर्मराज वाघ',
    nameEn: 'Jayesh Dharmaraj Wagh',
    roleMr: 'इंजिनीयर (Engineer)',
    roleEn: 'Engineer',
    badgeEmoji: '⚙️',
    icon: Cpu,
    descMr: 'प्रणाली अभियांत्रिकी, सॉफ्टवेअर व तांत्रिक पायाभूत सुविधांचे नियोजन आणि कार्यसक्षम व्यवस्थापन.',
    descEn: 'Systems engineering, software & technical infrastructure maintenance, and system operations.',
    initials: 'JW',
    skills: ['Systems Engineering', 'Tech Infrastructure', 'Software Support'],
  },
];

interface OurTeamProps {
  unlockedPin?: string;
  onRequireUnlock?: () => void;
  className?: string;
}

export const OurTeam: React.FC<OurTeamProps> = ({
  unlockedPin = '',
  onRequireUnlock,
  className = '',
}) => {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [teamPhotos, setTeamPhotos] = useState<Record<string, string>>({});
  const [activeUploadMemberId, setActiveUploadMemberId] = useState<string>('');
  const [savingMemberId, setSavingMemberId] = useState<string>('');
  const [savedSuccessMemberId, setSavedSuccessMemberId] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');

  useEffect(() => {
    fetch('/api/team-photos')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data.photos && typeof data.photos === 'object') {
          setTeamPhotos(data.photos);
        }
      })
      .catch(() => {});
  }, []);

  const resizeImageForUpload = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = (memberId: string) => {
    if (!unlockedPin && onRequireUnlock) {
      onRequireUnlock();
      return;
    }
    setActiveUploadMemberId(memberId);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeUploadMemberId) return;

    const targetId = activeUploadMemberId;
    setSavingMemberId(targetId);
    setUploadError('');

    try {
      if (file.size > PDF_SECURITY_LIMITS.MAX_IMAGE_FILE_SIZE_BYTES) {
        setUploadError(t('फोटो २० MB पेक्षा लहान असावा.', 'Photo must be under 20 MB.'));
        return;
      }
      const headBytes = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      const inspection = inspectUploadedFileBytes(headBytes, file.name, file.type, 'image');
      if (!inspection.valid || inspection.kind !== 'image') {
        setUploadError(t('कृपया वैध JPG/PNG/WEBP फोटो निवडा.', 'Only valid JPG/PNG/WEBP raster images are allowed.'));
        return;
      }

      const optimizedDataUrl = await resizeImageForUpload(file);
      const res = await fetch('/api/team-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: unlockedPin || '2499',
          memberId: targetId,
          photoDataUrl: optimizedDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setUploadError(data?.error || t('फोटो सेव्ह करता आला नाही.', 'Could not save photo.'));
        return;
      }

      setTeamPhotos((prev) => ({ ...prev, [targetId]: data.photoUrl || optimizedDataUrl }));
      setSavedSuccessMemberId(targetId);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => setSavedSuccessMemberId(''), 3500);
    } catch {
      setUploadError(t('फोटो अपलोड करताना त्रुटी आली.', 'Error uploading photo.'));
    } finally {
      setSavingMemberId('');
    }
  };

  const handleRemovePhoto = async (memberId: string) => {
    if (!unlockedPin && onRequireUnlock) {
      onRequireUnlock();
      return;
    }
    setSavingMemberId(memberId);
    try {
      const res = await fetch('/api/team-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: unlockedPin || '2499', memberId }),
      });
      if (res.ok) {
        setTeamPhotos((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
      }
    } catch {
      setUploadError(t('फोटो काढता आला नाही.', 'Could not remove photo.'));
    } finally {
      setSavingMemberId('');
    }
  };

  return (
    <section
      aria-label={t('MAHA CORNER – आमचे टीम मेंबर्स', 'MAHA CORNER - Our Team Members')}
      className={`rounded-3xl bg-white border border-slate-200/90 shadow-xl p-5 sm:p-8 space-y-6 ${className}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-800 text-xs font-black mb-1.5">
            <Users2 className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('आमचे सहकारी • अधिकृत टीम परिचय', 'Our Team • Official Core Members')}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{t('🚀 MAHA CORNER – आमचे टीम मेंबर्स', '🚀 MAHA CORNER – Our Team Members')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {t(
              'महा कॉर्नरच्या डिजिटल सेवा, व्यवसाय नियोजन, तांत्रिक सहाय्य व फोटोग्राफीसाठी समर्पित आमची टीम.',
              'Our dedicated core team supporting business development, technical support, and visual content.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!unlockedPin ? (
            <button
              type="button"
              onClick={onRequireUnlock}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs shadow-sm cursor-pointer transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t('टीम फोटो अपलोड (Owner Lock)', 'Upload Photos (Owner Lock)')}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black">
              <Unlock className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('Owner Unlock सक्रिय · फोटो बदला', 'Owner Unlocked · Change Photos')}</span>
            </span>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold">
          {uploadError}
        </div>
      )}

      {/* 4 Team Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {TEAM_MEMBERS_DATA.map((member, idx) => {
          const photoUrl = teamPhotos[member.id];
          const isSaving = savingMemberId === member.id;
          const isSaved = savedSuccessMemberId === member.id;
          const RoleIcon = member.icon;

          return (
            <div
              key={member.id}
              className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between p-6 relative group hover:border-amber-400/50 transition-all hover:scale-[1.01]"
            >
              {/* Member Index Badge */}
              <div className="absolute top-4 left-4 z-10">
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-black text-amber-300 tracking-wider">
                  TEAM #{idx + 1}
                </span>
              </div>

              {/* Upload Action on Top Right */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handlePhotoSelect(member.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-md transition-all cursor-pointer ${
                    unlockedPin
                      ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white'
                      : 'bg-slate-800 hover:bg-amber-500 border border-slate-700 text-amber-300 hover:text-slate-950'
                  }`}
                  title={
                    unlockedPin
                      ? t('फोटो अपलोड करा किंवा बदला', 'Upload or change photo')
                      : t('फोटो बदलण्यासाठी Owner Lock अनलॉक करा', 'Unlock Owner PIN to upload photo')
                  }
                >
                  {unlockedPin ? <Upload className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>
                    {isSaving
                      ? t('सेव्ह...', 'Saving...')
                      : photoUrl
                        ? t('फोटो बदला', 'Change')
                        : t('फोटो जोडा', 'Add Photo')}
                  </span>
                </button>

                {photoUrl && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleRemovePhoto(member.id)}
                    className="p-1 rounded-full bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-colors"
                    title={t('फोटो रिसेट करा', 'Remove Photo')}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Top Section: Circular Photo with Professional Border */}
              <div className="flex flex-col items-center text-center space-y-4 pt-6">
                {/* CIRCULAR PHOTO WITH PROFESSIONAL BORDER */}
                <div className="relative group/avatar cursor-pointer" onClick={() => handlePhotoSelect(member.id)}>
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-gradient-to-tr from-amber-400 via-orange-400 to-sky-400 shadow-2xl shadow-orange-500/25 ring-4 ring-white/10 ring-offset-2 ring-offset-slate-900 transition-transform group-hover/avatar:scale-105">
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center relative border-2 border-white/30 shadow-inner">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={t(member.nameMr, member.nameEn)}
                          draggable={false}
                          className="w-full h-full object-cover object-top rounded-full filter contrast-[1.03]"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 text-slate-300 select-none">
                          <span className="text-3xl font-black text-amber-300 tracking-wider">
                            {member.initials}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">
                            {t('फोटो जोडा', 'Upload Photo')}
                          </span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-amber-300 transition-opacity rounded-full">
                        <Upload className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] font-black">{t('फोटो बदला', 'Change')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Role Icon Mini Badge */}
                  <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-slate-900 border-2 border-amber-400 text-amber-300 flex items-center justify-center shadow-lg">
                    <RoleIcon className="w-4 h-4" />
                  </div>
                </div>

                {isSaved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('फोटो यशस्वीरीत्या सेव्ह झाला! ✓', 'Photo saved successfully! ✓')}</span>
                  </span>
                )}

                {/* Member Name (Directly Below Circular Photo) */}
                <div className="space-y-1.5 pt-1">
                  <h3 className="text-xl font-black text-white tracking-tight leading-tight">
                    {t(member.nameMr, member.nameEn)}
                  </h3>

                  {/* Role Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black shadow-inner">
                    <span>{member.badgeEmoji}</span>
                    <span>{t(member.roleMr, member.roleEn)}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-white/10">
                  {t(member.descMr, member.descEn)}
                </p>
              </div>

              {/* Skills / Specialization Tags */}
              <div className="mt-5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-center gap-1.5">
                {member.skills.map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

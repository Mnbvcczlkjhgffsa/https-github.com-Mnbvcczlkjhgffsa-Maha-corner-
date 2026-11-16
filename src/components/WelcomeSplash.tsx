import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface WelcomeSplashProps {
  onComplete: () => void;
}

const INTRO_VIDEO_SRC = '/assets/aistudio/gemini_generated_video_7a460cdc_87dd5e4b.mp4';
const TARGET_DURATION_MS = 3200;
const FADE_OUT_MS = 450;

export const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onComplete }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  const finishSplash = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, FADE_OUT_MS);
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      const applySpeed = () => {
        try {
          // 10s demo video compressed smoothly into ~3.1 seconds
          videoEl.playbackRate = 3.2;
          videoEl.defaultPlaybackRate = 3.2;
        } catch {}
      };
      applySpeed();
      videoEl.addEventListener('loadedmetadata', applySpeed);
      videoEl.addEventListener('play', applySpeed);
      videoEl.play().catch(() => {});

      const fallbackTimer = setTimeout(() => {
        finishSplash();
      }, TARGET_DURATION_MS);

      return () => {
        clearTimeout(fallbackTimer);
        videoEl.removeEventListener('loadedmetadata', applySpeed);
        videoEl.removeEventListener('play', applySpeed);
      };
    }

    const fallbackTimer = setTimeout(() => {
      finishSplash();
    }, TARGET_DURATION_MS);
    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950 px-4 py-6 transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t('वेलकम टू महा कॉर्नर', 'Welcome to Maha Corner')}
    >
      {/* Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-500/20 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-500/20 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Right Skip Button */}
      <button
        type="button"
        onClick={finishSplash}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-amber-500 text-slate-200 hover:text-slate-950 border border-white/20 hover:border-amber-400 text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
      >
        <span>{t('पुढे जा', 'Skip')}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

      {/* Main Intro Content */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center space-y-4 sm:space-y-5 animate-splash-up">
        {/* Welcome Heading */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] sm:text-xs font-black tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{t('स्वागत आहे • डिजिटल महाराष्ट्र पोर्टल', 'WELCOME • DIGITAL MAHARASHTRA PORTAL')}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-lg">
            {t('वेलकम टू ', 'Welcome to ')}
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-clip-text text-transparent">
              {t('महा कॉर्नर', 'Maha Corner')}
            </span>
          </h1>
        </div>

        {/* 16:9 Intro Logo Reveal Video */}
        <div className="w-full aspect-video rounded-3xl overflow-hidden bg-slate-950 border-2 border-amber-500/50 shadow-[0_0_65px_rgba(245,158,11,0.3)] relative">
          <video
            ref={videoRef}
            src={INTRO_VIDEO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={finishSplash}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
        </div>

        {/* Tagline & Progress Loader */}
        <div className="w-full max-w-md space-y-2.5 pt-1">
          <p className="text-xs sm:text-sm font-bold text-amber-300 tracking-wide">
            {t('माहिती अशी, जी कामी येईल!', 'Information That Truly Matters!')}
          </p>

          <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden border border-slate-700/70">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-sky-400 animate-splash-bar" />
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            {t('वेब पोर्टल सुरू होत आहे...', 'Opening Web Portal...')}
          </p>
        </div>
      </div>
    </div>
  );
};

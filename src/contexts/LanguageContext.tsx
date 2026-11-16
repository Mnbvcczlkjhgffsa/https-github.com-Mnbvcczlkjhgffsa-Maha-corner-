import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppLanguage = 'mr' | 'en';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  t: (mr: string, en: string) => string;
}

const LANG_STORAGE_KEY = 'maha_corner_lang_v1';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'mr';
    } catch {
      return 'mr';
    }
  });

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'mr' ? 'en' : 'mr';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title =
      lang === 'en'
        ? 'Maha Corner - Poster Maker, GR Updates, Jobs & Digital Tools'
        : 'महा कॉर्नर (Maha Corner) - पोस्टर मेकर, शासकीय निर्णय व नोकरी संदर्भ';
  }, [lang]);

  const t = useCallback(
    (mr: string, en: string) => (lang === 'en' ? en : mr),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

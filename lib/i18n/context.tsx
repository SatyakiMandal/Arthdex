"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SupportedLocale, Dictionary } from "./types";
import { DICTIONARIES, LOCALES_META } from "./locales";

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (loc: SupportedLocale) => void;
  dict: Dictionary;
  meta: typeof LOCALES_META[SupportedLocale];
  t: (path: string, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = "arthdex_locale_v1";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale | null;
        if (saved && DICTIONARIES[saved]) {
          setLocaleState(saved);
          document.documentElement.lang = saved;
        }
      } catch {
        // Ignore storage errors
      }
    });
  }, []);

  const setLocale = (newLoc: SupportedLocale) => {
    if (!DICTIONARIES[newLoc]) return;
    setLocaleState(newLoc);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLoc);
      document.cookie = `arthdex_locale=${newLoc}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLoc;
    } catch {
      // Ignore storage errors
    }
  };

  const dict = DICTIONARIES[locale] || DICTIONARIES.en;
  const meta = LOCALES_META[locale] || LOCALES_META.en;

  const t = (path: string, fallback?: string): string => {
    const parts = path.split(".");
    let current: any = dict;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return fallback || path;
      }
    }
    return typeof current === "string" ? current : fallback || path;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dict, meta, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Return fallback context if used outside provider
    return {
      locale: "en" as SupportedLocale,
      setLocale: () => {},
      dict: DICTIONARIES.en,
      meta: LOCALES_META.en,
      t: (path: string, fallback?: string) => fallback || path,
    };
  }
  return ctx;
}

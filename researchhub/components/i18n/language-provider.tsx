"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { localeCookie, resolveLocale, translate, type Locale } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(resolveLocale(initialLocale));
  function setLocale(value: Locale) {
    const next = resolveLocale(value);
    // UI preference only: no research content, user ID or account permission in this cookie.
    document.cookie = localeCookie(next, window.location.protocol === "https:");
    document.documentElement.lang = next;
    updateLocale(next);
  }
  return <LanguageContext.Provider value={{ locale, setLocale, t: key => translate(locale, key) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage requires LanguageProvider");
  return context;
}

"use client";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useLanguage } from "./language-provider";
import type { Locale } from "@/lib/i18n/locale";

export default function LanguageSelector() {
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
  function choose(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    startTransition(() => router.refresh());
  }
  return <div className="language-selector" role="group" aria-label={t("language.label")}>
    <svg className="language-selector-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/></svg>
    <button type="button" lang="pt-BR" aria-label={t("language.portuguese")} title={t("language.portuguese")} aria-pressed={locale === "pt-BR"} onClick={() => choose("pt-BR")}>PT</button>
    <button type="button" lang="es" aria-label={t("language.spanish")} title={t("language.spanish")} aria-pressed={locale === "es"} onClick={() => choose("es")}>ES</button>
  </div>;
}

"use client";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useLanguage } from "./language-provider";
import { resolveLocale } from "@/lib/i18n/locale";

export default function LanguageSelector() {
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();
  return <label className="language-selector"><span>{t("language.label")}</span><select aria-label={t("language.label")} value={locale} onChange={event => { setLocale(resolveLocale(event.target.value)); startTransition(() => router.refresh()); }}>
    <option value="pt-BR" lang="pt-BR">Português</option><option value="es" lang="es">Español</option>
  </select>{locale === "es" && <small className="language-progress">{t("language.partial")}</small>}</label>;
}

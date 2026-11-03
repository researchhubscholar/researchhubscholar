"use client";
import { useLanguage } from "./language-provider";
import { localizeInterfaceCopy } from "@/lib/i18n/interface-copy";

// Explicit product-owned configuration/messages only. Never pass research content.
export default function AuthoredText({ text }: { text: string | number | undefined | null }) {
  const { locale } = useLanguage();
  return <>{typeof text === "string" ? localizeInterfaceCopy(locale, text) : text ?? null}</>;
}

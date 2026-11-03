"use client";
import { useLanguage } from "./language-provider";
import { authoredScreenKeys } from "@/lib/i18n/screen-catalog";

// For explicit product-owned configuration only. Never pass user or source content.
export default function AuthoredText({ text }: { text: string }) {
  const { t } = useLanguage();
  const key = Object.prototype.hasOwnProperty.call(authoredScreenKeys, text) ? authoredScreenKeys[text] : null;
  return <>{key ? t(key) : text}</>;
}

"use client";
import { useLanguage } from "./language-provider";
import type { MessageKey } from "@/lib/i18n/catalog";

// Only explicit catalog keys are accepted; user text and scientific sources stay untouched.
export default function InterfaceText({ message }: { message: MessageKey }) {
  const { t } = useLanguage();
  return <>{t(message)}</>;
}

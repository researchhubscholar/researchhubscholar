"use client";
import { useCallback } from "react";
import { useLanguage } from "./language-provider";
import { localizeInterfaceCopy } from "@/lib/i18n/interface-copy";

// Use only for product-authored interface copy, never research content.
export function useInterfaceCopy() {
  const { locale } = useLanguage();
  return useCallback((source: string) => localizeInterfaceCopy(locale, source), [locale]);
}

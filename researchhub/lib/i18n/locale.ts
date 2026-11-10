import { portuguese, spanish, type MessageKey } from "./catalog";

export const DEFAULT_LOCALE = "pt-BR" as const;
export const LOCALE_COOKIE = "scholar_locale";
export const SUPPORTED_LOCALES = ["pt-BR", "es"] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

// Portuguese remains the default, regardless of the browser's language.
export function resolveLocale(value: unknown): Locale {
  return value === "es" ? "es" : DEFAULT_LOCALE;
}

export function translate(locale: Locale, key: MessageKey): string {
  return (locale === "es" ? spanish[key] : portuguese[key]) || portuguese[key];
}

export function localeCookie(value: Locale, secure: boolean): string {
  return `${LOCALE_COOKIE}=${resolveLocale(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}

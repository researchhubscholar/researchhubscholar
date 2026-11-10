import { resolveLocale, type Locale } from "./locale";

export function intlLocale(locale: Locale) {
  return resolveLocale(locale) === "es" ? "es-419" : "pt-BR";
}

export function formatNumber(value: number, locale: Locale, options: Intl.NumberFormatOptions = {}) {
  return Number.isFinite(value) ? new Intl.NumberFormat(intlLocale(locale), options).format(value) : "—";
}

function isoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return null;
  if (value.length === 10 && date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

// UTC is explicit: date-only deadlines must never move to the previous day.
export function formatDate(value: string, locale: Locale, options: Intl.DateTimeFormatOptions = {}) {
  const date = isoDate(value);
  return date ? new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: value.length === 10 ? "UTC" : options.timeZone || "UTC" }).format(date) : "—";
}

import { portuguese, spanish, type MessageKey } from "./catalog";
import templates from "./message-templates.json";
import { aiSpanishCopy as aiCopy } from "./ai-copy";
import type { Locale } from "./locale";

const keys = new Map<string, MessageKey>(Object.entries(portuguese).map(([key, value]) => [value, key as MessageKey]));
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(templates).map(([source, target]) => {
  const positions: string[] = [];
  const pieces = source.split(/(\{\d+\})/g).map(piece => {
    if (/^\{\d+\}$/.test(piece)) { positions.push(piece); return "([\\s\\S]*?)"; }
    return escape(piece);
  });
  return { pattern: new RegExp("^" + pieces.join("") + "$"), target, positions };
});

// Call only at explicit product-owned UI boundaries, never on research/user content.
// Captured values (field names, numbers, dates) are copied verbatim, not translated.
export function localizeInterfaceCopy(locale: Locale, source: string): string {
  if (locale === "pt-BR") return source;
  if (Object.hasOwn(aiCopy, source)) return aiCopy[source as keyof typeof aiCopy];
  const key = keys.get(source);
  if (key) return spanish[key];
  for (const { pattern, target, positions } of patterns) {
    const match = pattern.exec(source);
    if (match) return target.replace(/\{\d+\}/g, token => {
      const index = positions.indexOf(token);
      return index < 0 ? token : match[index + 1];
    });
  }
  return source; // Preserve unrecognized external diagnostics exactly.
}

// Browser dialogs run only from user actions; use the active document preference.
export function dialogCopy(source: string): string {
  const locale: Locale = typeof document !== "undefined" && document.documentElement.lang === "es" ? "es" : "pt-BR";
  return localizeInterfaceCopy(locale, source);
}

import { suggestPubmedSpelling } from "./pubmed";

const comparable = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const safeLabel = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9 -]{2,80}$/.test(value);

async function meshLabels(term: string): Promise<string[]> {
  const url = new URL("https://id.nlm.nih.gov/mesh/lookup/descriptor");
  url.search = new URLSearchParams({ label: term, match: "exact", limit: "3" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } });
  if (!response.ok) return [];
  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return data.flatMap(item => /^https?:\/\/id\.nlm\.nih\.gov\/mesh\/D\d+$/.test(item?.resource || "") && safeLabel(item?.label) && comparable(item.label) === comparable(term) ? [item.label] : []);
}

export async function officialTerminologySuggestions(terms: string[], translations: Record<string, string>) {
  const suggestions: Record<string, string[]> = {};
  for (const term of terms.filter(term => /^[a-z-]{5,60}$/.test(term) && !Object.hasOwn(translations, term)).slice(0, 2)) {
    try {
      const exact = await meshLabels(term).catch(() => []);
      if (exact.length) {
        suggestions[term] = Array.from(new Set(exact)).slice(0, 2);
        continue;
      }
      const correction = await suggestPubmedSpelling(term);
      if (safeLabel(correction) && comparable(correction) !== comparable(term)) {
        suggestions[term] = [correction];
      }
    } catch { /* Unavailability leaves the existing manual review available. */ }
  }
  return suggestions;
}

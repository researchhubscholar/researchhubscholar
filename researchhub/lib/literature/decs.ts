/**
 * IA-02 — Conservative DeCS terminology adapter.
 *
 * Uses BIREME's term endpoint (GET /api/thesaurus/term/?words=...&lang=pt),
 * which returns the multilingual descriptor record.
 * Do not interpret a fuzzy search result as a verified exact translation.
 * No credentials, personal records or user project data are sent.
 */
export type DecsResolution = { source: string; english: string; provenance: "DeCS"; descriptorId: string };

type UnknownObject = Record<string, unknown>;
const object = (value: unknown): value is UnknownObject => Boolean(value && typeof value === "object" && !Array.isArray(value));
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const safeLabel = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9 ,'-]{1,79}$/.test(value);
const safeSource = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{3,60}$/.test(value);

/** Search only bounded JSON nesting, never arbitrary untrusted prototype properties. */
function findRecords(value: unknown, depth = 0): UnknownObject[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.slice(0, 15).flatMap(item => findRecords(item, depth + 1));
  if (!object(value)) return [];
  const direct = value.descriptor_list && value.unique_identifier_nlm !== undefined ? [value] : [];
  return [...direct, ...Object.entries(value).filter(([key]) =>
    ["objects", "item", "decsws_response", "record_list", "record", "data", "results"].includes(key)
  ).flatMap(([, item]) => findRecords(item, depth + 1))];
}
function entries(value: unknown, key: string): UnknownObject[] {
  if (Array.isArray(value)) return value.filter(object).slice(0, 30);
  if (!object(value)) return [];
  if ((key === "descriptor" && typeof value.descriptor === "string")
    || (key === "synonym" && typeof value.synonym === "string")) return [value];
  if (key in value) return entries(value[key], key);
  if ("attr" in value) return [value];
  return [];
}
function multilingualLabel(item: UnknownObject) {
  const text = item.descriptor;
  const attr = object(item.attr) ? item.attr : {};
  const lang = typeof attr.lang === "string" ? attr.lang.toLowerCase() : "";
  return { text, lang };
}
export function parseDecsExactResponse(payload: unknown, source: string): DecsResolution | null {
  if (!safeSource(source)) return null;
  const matches: DecsResolution[] = [];
  for (const record of findRecords(payload)) {
    const labels = entries(record.descriptor_list, "descriptor").map(multilingualLabel);
    const english = labels.find(label => label.lang === "en" && safeLabel(label.text))?.text;
    const portuguese = labels.some(label => /^pt(?:-|$)/.test(label.lang)
      && typeof label.text === "string" && normalize(label.text) === normalize(source));
    // The API returns synonyms for the requested language. Accept them only
    // after an exact normalized match; do not accept approximate candidates.
    const synonyms = entries(record.synonym_list, "synonym");
    const alias = synonyms.some(item => typeof item.synonym === "string"
      && normalize(item.synonym) === normalize(source));
    const id = record.unique_identifier_nlm;
    if ((portuguese || alias) && safeLabel(english) && typeof id === "string" && /^[A-Z0-9]{4,18}$/.test(id)) {
      matches.push({ source, english, provenance: "DeCS", descriptorId: id });
    }
  }
  const unique = Array.from(new Map(matches.map(item => [item.descriptorId, item])).values());
  // Multiple records for a term are ambiguous: require human review.
  return unique.length === 1 ? unique[0] : null;
}

export async function resolveDecsTerms(
  terms: string[],
  options: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch; onAttempt?: (event: { outcome: "success"|"http_error"|"network_error"|"timeout"|"parse_error"|"unmatched";statusCode?:number;durationMs:number }) => Promise<void>|void } = {},
): Promise<{ translations: Record<string, string>; resolutions: DecsResolution[] }> {
  const translations: Record<string, string> = {};
  const resolutions: DecsResolution[] = [];
  const base = options.baseUrl || "https://decs-api.bvsalud.org";
  // Prevent arbitrary destinations from being used for production API calls.
  let host: URL;
  try { host = new URL(base); } catch { return { translations, resolutions }; }
  if (host.protocol !== "https:" || host.hostname !== "decs-api.bvsalud.org" || host.username || host.password || host.search || host.hash) return { translations, resolutions };
  const request = options.fetchImpl || fetch;
  const note = async (outcome: "success"|"http_error"|"network_error"|"timeout"|"parse_error"|"unmatched", started:number,statusCode?:number) => {
    try { await options.onAttempt?.({outcome,statusCode,durationMs:Math.min(300000,Math.max(0,Date.now()-started))}); } catch { /* Never change search results for telemetry. */ }
  };
  for (const term of [...new Set(terms)].filter(safeSource).slice(0, 4)) {
    const started=Date.now();
    let phase:"network"|"parse"="network";
    try {
      const url = new URL("/api/thesaurus/term/", host);
      url.searchParams.set("words", term);
      url.searchParams.set("lang", "pt");
      url.searchParams.set("format", "json");
      const response = await request(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.min(Math.max(options.timeoutMs || 2800, 500), 5000)),
      });
      if (!response.ok) { await note("http_error",started,response.status);continue; }
      if ((Number(response.headers.get("content-length")) || 0) > 150000) {await note("parse_error",started);continue;}
      phase="parse";
      const body = await response.text();
      if (body.length > 150000) {await note("parse_error",started);continue;}
      const match = parseDecsExactResponse(JSON.parse(body) as unknown, term);
      if (!match) {await note("unmatched",started);continue;}
      translations[term] = match.english;
      resolutions.push(match);
      await note("success",started,response.status);
    } catch(error) {
      const timedOut=error instanceof Error && /abort|timeout/i.test(error.name+" "+error.message);
      await note(timedOut?"timeout":phase==="parse"?"parse_error":"network_error",started);
      // DeCS outages still require human review; no fabricated terminology.
    }
  }
  return { translations, resolutions };
}

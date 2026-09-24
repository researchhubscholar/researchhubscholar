import type { Article } from "./types";

export type OpenAccessResult = {
  status: "open" | "unavailable" | "unknown";
  url: string | null;
  source: "SciELO" | "Europe PMC" | "Editora" | "Repositório aberto" | null;
  license: string | null;
  version: string | null;
  isPdf: boolean;
};

type Requester = typeof fetch;
type Candidate = Omit<OpenAccessResult, "status">;
const UNPAYWALL_EMAIL = process.env.UNPAYWALL_EMAIL || "researchhub.scholar@gmail.com";

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function sourceFromUrl(url: string, hostType?: string): Candidate["source"] {
  const host = new URL(url).hostname.toLowerCase();
  if (host === "scielo.org" || host.endsWith(".scielo.org") || host.startsWith("scielo.") || host.includes(".scielo.")) return "SciELO";
  return hostType === "publisher" ? "Editora" : "Repositório aberto";
}

async function unpaywall(doi: string, requester: Requester): Promise<{ candidate: Candidate | null; checked: boolean }> {
  try {
    const response = await requester(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(UNPAYWALL_EMAIL)}`, {
      headers: { Accept: "application/json", "User-Agent": "ResearchHub-Scholar/0.1" },
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) return { candidate: null, checked: true };
    if (!response.ok) return { candidate: null, checked: false };
    const data = await response.json();
    const location = data?.best_oa_location;
    if (!data?.is_oa || !location) return { candidate: null, checked: true };
    const pdf = safeUrl(location.url_for_pdf);
    const landing = safeUrl(location.url_for_landing_page || location.url);
    const url = pdf || landing;
    if (!url) return { candidate: null, checked: true };
    return { checked: true, candidate: { url, source: sourceFromUrl(url, location.host_type), license: location.license || null, version: location.version || null, isPdf: Boolean(pdf) } };
  } catch { return { candidate: null, checked: false }; }
}

async function europePmc(article: Pick<Article, "pmid" | "doi">, requester: Requester): Promise<{ candidate: Candidate | null; checked: boolean }> {
  const query = article.pmid ? `EXT_ID:${article.pmid} AND SRC:MED` : article.doi ? `DOI:${article.doi}` : "";
  if (!query) return { candidate: null, checked: false };
  try {
    const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "1" });
    const response = await requester(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "ResearchHub-Scholar/0.1" },
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { candidate: null, checked: false };
    const item = (await response.json())?.resultList?.result?.[0];
    if (!item) return { candidate: null, checked: true };
    const links = item?.fullTextUrlList?.fullTextUrl;
    const openLinks = Array.isArray(links) ? links.filter((link: any) => /open access|free/i.test(String(link.availability || ""))) : [];
    const preferred = openLinks.find((link: any) => /pdf/i.test(String(link.documentStyle || ""))) || openLinks[0];
    const external = safeUrl(preferred?.url);
    const pmc = item.pmcid ? safeUrl(`https://europepmc.org/articles/${item.pmcid}`) : null;
    const url = external || (item.isOpenAccess === "Y" || item.inEPMC === "Y" ? pmc : null);
    if (!url) return { candidate: null, checked: true };
    const source = sourceFromUrl(url) === "SciELO" ? "SciELO" : "Europe PMC";
    return { checked: true, candidate: { url, source, license: item.license || null, version: null, isPdf: /pdf/i.test(String(preferred?.documentStyle || "")) } };
  } catch { return { candidate: null, checked: false }; }
}

export async function resolveOpenAccess(article: Pick<Article, "pmid" | "doi">, requester: Requester = fetch): Promise<OpenAccessResult> {
  const doi = article.doi?.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "") || "";
  const [unpaywallResult, europeResult] = await Promise.all([
    doi ? unpaywall(doi, requester) : Promise.resolve({ candidate: null, checked: false }),
    europePmc({ pmid: article.pmid, doi }, requester),
  ]);
  const candidates = [unpaywallResult.candidate, europeResult.candidate].filter((item): item is Candidate => Boolean(item));
  const best = candidates.find(item => item.source === "SciELO") || candidates.find(item => item.isPdf) || candidates[0];
  if (best) return { status: "open", ...best };
  return { status: unpaywallResult.checked || europeResult.checked ? "unavailable" : "unknown", url: null, source: null, license: null, version: null, isPdf: false };
}

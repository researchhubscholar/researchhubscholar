type PubmedSearch = { count: number; ids: string[] };

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const CROSSREF_WORKS = "https://api.crossref.org/works";
const NCBI_API_KEY = process.env.NCBI_API_KEY;
const NCBI_EMAIL = process.env.NCBI_EMAIL;
const NCBI_DELAY = NCBI_API_KEY ? 120 : 420;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ncbiParams(values: Record<string, string>) {
  const params = new URLSearchParams({ ...values, tool: "researchhub-scholar" });
  if (NCBI_API_KEY) params.set("api_key", NCBI_API_KEY);
  if (NCBI_EMAIL) params.set("email", NCBI_EMAIL);
  return params;
}

async function ncbiFetch(url: string, accept = "application/json") {
  let lastStatus = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "ResearchHub-Scholar/0.1",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    lastStatus = response.status;
    if (response.ok) return response;

    // 429 é o limite de taxa do NCBI; 5xx pode ser indisponibilidade temporária.
    if (response.status !== 429 && response.status < 500) break;
    await sleep(700 * (attempt + 1));
  }

  throw new Error(`NCBI request failed (${lastStatus})`);
}

export async function pubmedSearch(term: string, retmax = 0, sort?: string, offset = 0): Promise<PubmedSearch> {
  const params = ncbiParams({ db: "pubmed", term, retmode: "json", retmax: String(retmax), retstart: String(offset) });
  if (sort) params.set("sort", sort);

  const response = await ncbiFetch(`${PUBMED_BASE}/esearch.fcgi?${params.toString()}`);
  const data = await response.json();
  return {
    count: Number(data?.esearchresult?.count ?? 0),
    ids: Array.isArray(data?.esearchresult?.idlist) ? data.esearchresult.idlist : [],
  };
}

export async function throttledPubmedSearch(term: string, retmax = 0, sort?: string) {
  const result = await pubmedSearch(term, retmax, sort);
  await sleep(NCBI_DELAY);
  return result;
}

export async function crossrefCount(term: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({ "query.bibliographic": term, rows: "0" });
    const response = await fetch(`${CROSSREF_WORKS}?${params.toString()}`, {
      headers: { "User-Agent": "ResearchHub-Scholar/0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Number(data?.message?.["total-results"] ?? 0);
  } catch {
    return null;
  }
}

export function decodeXml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAbstracts(xml: string) {
  const map = new Map<string, string>();
  const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];

  for (const article of articles) {
    const pmid = article.match(/<PMID[^>]*>([^<]+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const abstractParts = [...article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean);
    if (abstractParts.length) map.set(pmid, abstractParts.join(" "));
  }

  return map;
}

export async function fetchArticleDetails(ids: string[]) {
  if (!ids.length) return [];

  const summaryParams = ncbiParams({ db: "pubmed", id: ids.join(","), retmode: "json" });
  const summaryResponse = await ncbiFetch(`${PUBMED_BASE}/esummary.fcgi?${summaryParams.toString()}`);
  const summary = await summaryResponse.json();

  await sleep(NCBI_DELAY);

  let abstractXml = "";
  try {
    const fetchParams = ncbiParams({ db: "pubmed", id: ids.join(","), retmode: "xml" });
    const abstractResponse = await ncbiFetch(`${PUBMED_BASE}/efetch.fcgi?${fetchParams.toString()}`, "application/xml,text/xml");
    abstractXml = await abstractResponse.text();
  } catch (error) {
    // Os cards continuam funcionando sem abstract se o efetch estiver indisponível.
    console.warn("PubMed abstract fetch unavailable", error);
  }

  const abstracts = extractAbstracts(abstractXml);

  return ids.map((pmid) => {
    const item = summary?.result?.[pmid] ?? {};
    const articleIds = Array.isArray(item.articleids) ? item.articleids : [];
    const doi = articleIds.find((x: any) => x.idtype === "doi")?.value ?? null;
    const authors = Array.isArray(item.authors) ? item.authors.map((x: any) => x.name).filter(Boolean) : [];
    const pubdate = String(item.pubdate ?? "");
    const year = Number(pubdate.match(/\d{4}/)?.[0] ?? 0) || null;

    return {
      pmid,
      doi,
      title: String(item.title ?? "Sem título"),
      authors,
      journal: String(item.fulljournalname || item.source || ""),
      pubdate,
      year,
      publicationTypes: Array.isArray(item.pubtype) ? item.pubtype : [],
      abstract: abstracts.get(pmid) ?? null,
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doiUrl: doi ? `https://doi.org/${doi}` : null,
    };
  });
}


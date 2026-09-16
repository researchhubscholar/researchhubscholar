import { NextRequest, NextResponse } from "next/server";

type YearPoint = { year: number; count: number };
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
    });

    lastStatus = response.status;
    if (response.ok) return response;

    // 429 é o limite de taxa do NCBI; 5xx pode ser indisponibilidade temporária.
    if (response.status !== 429 && response.status < 500) break;
    await sleep(700 * (attempt + 1));
  }

  throw new Error(`NCBI request failed (${lastStatus})`);
}

async function pubmedSearch(term: string, retmax = 0, sort?: string): Promise<PubmedSearch> {
  const params = ncbiParams({ db: "pubmed", term, retmode: "json", retmax: String(retmax) });
  if (sort) params.set("sort", sort);

  const response = await ncbiFetch(`${PUBMED_BASE}/esearch.fcgi?${params.toString()}`);
  const data = await response.json();
  return {
    count: Number(data?.esearchresult?.count ?? 0),
    ids: Array.isArray(data?.esearchresult?.idlist) ? data.esearchresult.idlist : [],
  };
}

async function throttledPubmedSearch(term: string, retmax = 0, sort?: string) {
  const result = await pubmedSearch(term, retmax, sort);
  await sleep(NCBI_DELAY);
  return result;
}

async function crossrefCount(term: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({ "query.bibliographic": term, rows: "0" });
    const response = await fetch(`${CROSSREF_WORKS}?${params.toString()}`, {
      headers: { "User-Agent": "ResearchHub-Scholar/0.1" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Number(data?.message?.["total-results"] ?? 0);
  } catch {
    return null;
  }
}

function decodeXml(value = "") {
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

async function fetchArticleDetails(ids: string[]) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = String(body?.topic ?? "").trim();

    if (topic.length < 3 || topic.length > 300) {
      return NextResponse.json({ error: "Informe um tema entre 3 e 300 caracteres." }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    const startRecentYear = currentYear - 4;

    // Todas as chamadas ao NCBI ficam serializadas. Isso evita ultrapassar o
    // limite público de requisições quando não existe NCBI_API_KEY configurada.
    const mainSearch = await throttledPubmedSearch(topic, 8, "pub date");
    const systematic = await throttledPubmedSearch(`(${topic}) AND systematic review[Publication Type]`);
    const trials = await throttledPubmedSearch(`(${topic}) AND clinical trial[Publication Type]`);
    const recent = await throttledPubmedSearch(
      `(${topic}) AND (\"${startRecentYear}/01/01\"[Date - Publication] : \"3000\"[Date - Publication])`
    );

    // Crossref é complementar: se cair, o Radar do PubMed continua funcionando.
    const crossref = await crossrefCount(topic);

    const years = Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
    const timeline: YearPoint[] = [];
    for (const year of years) {
      const result = await throttledPubmedSearch(
        `(${topic}) AND (\"${year}/01/01\"[Date - Publication] : \"${year}/12/31\"[Date - Publication])`
      );
      timeline.push({ year, count: result.count });
    }

    let articles: Awaited<ReturnType<typeof fetchArticleDetails>> = [];
    try {
      articles = await fetchArticleDetails(mainSearch.ids);
    } catch (error) {
      // Métricas e tendência continuam disponíveis mesmo se os detalhes falharem.
      console.warn("PubMed article details unavailable", error);
    }

    const total = mainSearch.count;
    const trendFirst = timeline.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
    const trendLast = timeline.slice(-3).reduce((sum, item) => sum + item.count, 0);
    const trend = trendLast > trendFirst * 1.2 ? "growing" : trendLast < trendFirst * 0.8 ? "declining" : "stable";

    let breadth: "very_broad" | "broad" | "balanced" | "niche" | "scarce" = "balanced";
    if (total >= 5000) breadth = "very_broad";
    else if (total >= 1000) breadth = "broad";
    else if (total >= 100) breadth = "balanced";
    else if (total >= 20) breadth = "niche";
    else breadth = "scarce";

    return NextResponse.json({
      topic,
      sources: {
        pubmed: {
          total,
          recent: recent.count,
          systematicReviews: systematic.count,
          clinicalTrials: trials.count,
        },
        crossref: { total: crossref },
      },
      articles,
      timeline,
      signals: { breadth, trend, recentRatio: total > 0 ? recent.count / total : 0 },
      generatedAt: new Date().toISOString(),
      methodology:
        "As contagens e artigos são recuperados do PubMed/Crossref a partir dos termos informados. Isso não equivale a uma revisão sistemática e não comprova, isoladamente, originalidade ou lacuna científica.",
    });
  } catch (error) {
    console.error("literature/search error", error);
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      {
        error: "Não foi possível consultar o PubMed agora. Aguarde alguns segundos e tente novamente.",
        code: message.includes("429") ? "PUBMED_RATE_LIMIT" : "PUBMED_UNAVAILABLE",
      },
      { status: 502 }
    );
  }
}

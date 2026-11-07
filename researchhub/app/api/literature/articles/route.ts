import { NextRequest, NextResponse } from "next/server";
import { pubmedSearch, fetchArticleDetails } from "@/lib/literature/pubmed";
import { crossrefFetch, crossrefArticle } from "@/lib/literature/crossref";
import { mergeArticles } from "@/lib/literature/types";
import { searchLimits } from "@/lib/literature/search-limits";
export const maxDuration = 180;
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, sort, period } = body;
    const topic = String(body.topic || "").trim();
    const term = String(body.searchTerm || "").trim();
    const crossrefQuery = String(body.crossrefQuery || topic).trim();
    const offset = Number(body.offset ?? 0);
    if (!["pubmed", "crossref", "both"].includes(source) || !["recent", "relevance"].includes(sort) ||
        !["all", "3", "5", "10"].includes(period) || topic.length < 3 || topic.length > searchLimits.query ||
        term.length > searchLimits.derivedQuery || crossrefQuery.length < 2 || crossrefQuery.length > searchLimits.crossrefQuery || !Number.isInteger(offset) || offset < 0 || offset !== 0) {
      return NextResponse.json({ error: "Parâmetros de busca inválidos." }, { status: 400 });
    }
    if ((source === "pubmed" || source === "both") && !term) {
      return NextResponse.json({ error: "Consulta PubMed ausente." }, { status: 400 });
    }
    async function loadPubmed() {
      const result = await pubmedSearch(term, 30, sort === "recent" ? "pub date" : "relevance", offset);
      const articles = await fetchArticleDetails(result.ids);
      return { articles, total: result.count };
    }
    async function loadCrossref() {
      const end = new Date().toISOString().slice(0, 10);
      const filters = ["type:journal-article", `until-pub-date:${end}`];
      if (period !== "all") filters.push(`from-pub-date:${new Date().getFullYear() - Number(period) + 1}-01-01`);
      const params = new URLSearchParams({ "query.bibliographic": crossrefQuery, rows: "30", offset: String(offset), filter: filters.join(","), sort: sort === "recent" ? "published" : "score", order: "desc" });
      const result = await crossrefFetch(`?${params}`);
      const articles = (result.items || []).filter((item: any) => item.DOI).map(crossrefArticle);
      return { articles, total: Number(result["total-results"] || 0) };
    }
    if (source === "pubmed") {
      const result = await loadPubmed();
      return NextResponse.json({ articles: result.articles, total: result.total, duplicateCount: 0, nextOffset: null });
    }
    if (source === "crossref") {
      const result = await loadCrossref();
      return NextResponse.json({ articles: result.articles, total: result.total, duplicateCount: 0, nextOffset: null });
    }
    const [pubmedResult, crossrefResult] = await Promise.allSettled([loadPubmed(), loadCrossref()]);
    if (pubmedResult.status === "rejected" && crossrefResult.status === "rejected") throw new Error("As fontes estão indisponíveis.");
    const pubmed = pubmedResult.status === "fulfilled" ? pubmedResult.value : { articles: [], total: 0 };
    const crossref = crossrefResult.status === "fulfilled" ? crossrefResult.value : { articles: [], total: 0 };
    const merged = mergeArticles([...pubmed.articles, ...crossref.articles]);
    const warning = pubmedResult.status === "rejected" ? "O PubMed não respondeu; exibindo apenas Crossref." : crossrefResult.status === "rejected" ? "O Crossref não respondeu; exibindo apenas PubMed." : null;
    return NextResponse.json({ articles: merged.articles.slice(0, 30), total: pubmed.total + crossref.total, duplicateCount: merged.duplicateCount, warning,
      sourceTotals: { pubmed: pubmed.total, crossref: crossref.total }, nextOffset: null });
  } catch {
    return NextResponse.json({ error: "Não foi possível recuperar os artigos desta fonte. Tente novamente." }, { status: 502 });
  }
}

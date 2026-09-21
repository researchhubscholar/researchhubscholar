import { NextRequest, NextResponse } from "next/server";
import { pubmedSearch, fetchArticleDetails } from "@/lib/literature/pubmed";
import { crossrefFetch, crossrefArticle } from "@/lib/literature/crossref";
import { mergeArticles } from "@/lib/literature/types";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, sort, period } = body;
    const topic = String(body.topic || "").trim();
    const term = String(body.searchTerm || "").trim();
    const offset = Number(body.offset ?? 0);
    if (!["pubmed", "crossref", "both"].includes(source) || !["recent", "relevance"].includes(sort) ||
        !["all", "3", "5", "10"].includes(period) || topic.length < 3 || topic.length > 300 ||
        term.length > 1000 || !Number.isInteger(offset) || offset < 0 || offset > 9980 || offset % 20 !== 0) {
      return NextResponse.json({ error: "Parâmetros de busca inválidos." }, { status: 400 });
    }
    if ((source === "pubmed" || source === "both") && !term) {
      return NextResponse.json({ error: "Consulta PubMed ausente." }, { status: 400 });
    }
    async function loadPubmed() {
      const result = await pubmedSearch(term, 20, sort === "recent" ? "pub date" : "relevance", offset);
      const articles = await fetchArticleDetails(result.ids);
      return { articles, total: result.count, hasNext: offset + 20 < Math.min(result.count, 10000) && result.ids.length > 0 };
    }
    async function loadCrossref() {
      const end = new Date().toISOString().slice(0, 10);
      const filters = ["type:journal-article", `until-pub-date:${end}`];
      if (period !== "all") filters.push(`from-pub-date:${new Date().getFullYear() - Number(period) + 1}-01-01`);
      const params = new URLSearchParams({ "query.bibliographic": topic, rows: "20", offset: String(offset), filter: filters.join(","), sort: sort === "recent" ? "published" : "score", order: "desc" });
      const result = await crossrefFetch(`?${params}`);
      const articles = (result.items || []).filter((item: any) => item.DOI).map(crossrefArticle);
      return { articles, total: Number(result["total-results"] || 0), hasNext: offset + 20 < Math.min(Number(result["total-results"] || 0), 10000) && articles.length > 0 };
    }
    if (source === "pubmed") {
      const result = await loadPubmed();
      return NextResponse.json({ articles: result.articles, total: result.total, duplicateCount: 0, nextOffset: result.hasNext ? offset + 20 : null });
    }
    if (source === "crossref") {
      const result = await loadCrossref();
      return NextResponse.json({ articles: result.articles, total: result.total, duplicateCount: 0, nextOffset: result.hasNext ? offset + 20 : null });
    }
    const [pubmedResult, crossrefResult] = await Promise.allSettled([loadPubmed(), loadCrossref()]);
    if (pubmedResult.status === "rejected" && crossrefResult.status === "rejected") throw new Error("As fontes estão indisponíveis.");
    const pubmed = pubmedResult.status === "fulfilled" ? pubmedResult.value : { articles: [], total: 0, hasNext: false };
    const crossref = crossrefResult.status === "fulfilled" ? crossrefResult.value : { articles: [], total: 0, hasNext: false };
    const merged = mergeArticles([...pubmed.articles, ...crossref.articles]);
    const warning = pubmedResult.status === "rejected" ? "O PubMed não respondeu; exibindo apenas Crossref." : crossrefResult.status === "rejected" ? "O Crossref não respondeu; exibindo apenas PubMed." : null;
    return NextResponse.json({ articles: merged.articles, total: pubmed.total + crossref.total, duplicateCount: merged.duplicateCount, warning,
      sourceTotals: { pubmed: pubmed.total, crossref: crossref.total }, nextOffset: pubmed.hasNext || crossref.hasNext ? offset + 20 : null });
  } catch {
    return NextResponse.json({ error: "Não foi possível recuperar os artigos desta fonte. Tente novamente." }, { status: 502 });
  }
}

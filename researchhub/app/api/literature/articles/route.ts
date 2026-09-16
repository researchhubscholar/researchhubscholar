import { NextRequest, NextResponse } from "next/server";
import { pubmedSearch, fetchArticleDetails } from "@/lib/literature/pubmed";
import { crossrefFetch, crossrefArticle } from "@/lib/literature/crossref";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, sort, period } = body;
    const topic = String(body.topic || "").trim();
    const term = String(body.searchTerm || "").trim();
    const offset = Number(body.offset ?? 0);
    if (!["pubmed", "crossref"].includes(source) || !["recent", "relevance"].includes(sort) ||
        !["all", "3", "5", "10"].includes(period) || topic.length < 3 || topic.length > 300 ||
        term.length > 1000 || !Number.isInteger(offset) || offset < 0 || offset > 9980 || offset % 20 !== 0) {
      return NextResponse.json({ error: "Parâmetros de busca inválidos." }, { status: 400 });
    }
    if (source === "pubmed") {
      if (!term) return NextResponse.json({ error: "Consulta PubMed ausente." }, { status: 400 });
      const result = await pubmedSearch(term, 20, sort === "recent" ? "pub date" : "relevance", offset);
      const articles = await fetchArticleDetails(result.ids);
      return NextResponse.json({ articles, total: result.count, nextOffset: offset + 20 < Math.min(result.count, 10000) && result.ids.length ? offset + 20 : null });
    }
    const end = new Date().toISOString().slice(0, 10);
    const filters = ["type:journal-article", `until-pub-date:${end}`];
    if (period !== "all") filters.push(`from-pub-date:${new Date().getFullYear() - Number(period) + 1}-01-01`);
    const params = new URLSearchParams({ "query.bibliographic": topic, rows: "20", offset: String(offset), filter: filters.join(","), sort: sort === "recent" ? "published" : "score", order: "desc" });
    const result = await crossrefFetch(`?${params}`);
    const articles = (result.items || []).filter((item: any) => item.DOI).map(crossrefArticle);
    return NextResponse.json({ articles, total: result["total-results"], nextOffset: offset + 20 < Math.min(result["total-results"], 10000) && articles.length ? offset + 20 : null });
  } catch {
    return NextResponse.json({ error: "Não foi possível recuperar os artigos desta fonte. Tente novamente." }, { status: 502 });
  }
}

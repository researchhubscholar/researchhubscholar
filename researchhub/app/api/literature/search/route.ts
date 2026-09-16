import { NextRequest, NextResponse } from "next/server";
import { throttledPubmedSearch, crossrefCount, fetchArticleDetails } from "@/lib/literature/pubmed";
type YearPoint = { year: number; count: number };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = String(body?.topic ?? "").trim();

    if (topic.length < 3 || topic.length > 300) {
      return NextResponse.json({ error: "Informe um tema entre 3 e 300 caracteres." }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    const period = body.period ?? "5";
    const studyType = body.studyType ?? "all";
    const typeFilters: Record<string, string> = {
      all: "", systematic: "systematic review[Publication Type]",
      trial: "clinical trial[Publication Type]", observational: "observational study[Publication Type]",
      review: "review[Publication Type]", case: "case reports[Publication Type]",
    };
    if (!["all", "3", "5", "10"].includes(period) || !Object.prototype.hasOwnProperty.call(typeFilters, studyType)) {
      return NextResponse.json({ error: "Selecione um período e um tipo de estudo válidos." }, { status: 400 });
    }
    const baseTerm = typeFilters[studyType] ? `(${topic}) AND (${typeFilters[studyType]})` : `(${topic})`;
    const startRecentYear = currentYear - 4;
    const startYear = period === "all" ? null : currentYear - Number(period) + 1;
    const endDate = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
    const searchTerm = startYear ? `${baseTerm} AND ("${startYear}/01/01"[Date - Publication] : "${endDate}"[Date - Publication])` : baseTerm;

    // Todas as chamadas ao NCBI ficam serializadas. Isso evita ultrapassar o
    // limite público de requisições quando não existe NCBI_API_KEY configurada.
    const mainSearch = await throttledPubmedSearch(searchTerm, 20, "pub date");
    const systematic = await throttledPubmedSearch(`(${searchTerm}) AND systematic review[Publication Type]`);
    const trials = await throttledPubmedSearch(`(${searchTerm}) AND clinical trial[Publication Type]`);
    const recent = await throttledPubmedSearch(
      `(${searchTerm}) AND ("${startRecentYear}/01/01"[Date - Publication] : "${endDate}"[Date - Publication])`
    );

    // Crossref é complementar: se cair, o Radar do PubMed continua funcionando.
    const crossref = await crossrefCount(topic);

    // Compara somente anos completos; o ano atual não sugere uma queda artificial.
    const timelineStart = startYear ?? currentYear - 6;
    const years = Array.from({ length: currentYear - timelineStart }, (_, index) => timelineStart + index);
    const timeline: YearPoint[] = [];
    for (const year of years) {
      const result = await throttledPubmedSearch(
        `(${baseTerm}) AND ("${year}/01/01"[Date - Publication] : "${year}/12/31"[Date - Publication])`
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
    const half = Math.floor(timeline.length / 2);
    const trendFirst = timeline.slice(0, half).reduce((sum, item) => sum + item.count, 0);
    const trendLast = timeline.slice(-half).reduce((sum, item) => sum + item.count, 0);
    const trend = timeline.length < 2 || trendFirst + trendLast < 20 ? "insufficient"
      : trendLast > trendFirst * 1.2 ? "growing" : trendLast < trendFirst * 0.8 ? "declining" : "stable";

    let breadth: "very_broad" | "broad" | "balanced" | "niche" | "scarce" = "balanced";
    if (total >= 5000) breadth = "very_broad";
    else if (total >= 1000) breadth = "broad";
    else if (total >= 100) breadth = "balanced";
    else if (total >= 20) breadth = "niche";
    else breadth = "scarce";

    return NextResponse.json({
      topic,
      filters: { period, studyType, searchTerm, endDate },
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
        "As contagens e artigos são recuperados do PubMed/Crossref a partir dos termos informados. As métricas do PubMed respeitam os filtros; o Crossref usa apenas o tema e não é diretamente comparável. A tendência compara blocos de anos completos e é exploratória. Isso não equivale a uma revisão sistemática e não comprova, isoladamente, originalidade ou lacuna científica.",
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

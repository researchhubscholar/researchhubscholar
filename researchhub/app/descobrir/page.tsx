"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { Article, articleKey, sameArticle } from "@/lib/literature/types";
import { useLibrary } from "@/lib/literature/use-library";
import SavedSearches, { SearchStrategy } from "@/components/radar/saved-searches";
import SearchHistory from "@/components/radar/search-history";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { downloadResult, resultBibtex, resultCsv, resultRis } from "@/lib/literature/result-export";
import { useOpenAccess } from "@/lib/literature/use-open-access";
import { OpenAccessStatus } from "@/components/library/open-access-status";

type Result = {
  topic: string;
  filters: { period: string; studyType: string; searchTerm: string; endDate: string };
  sources: {
    pubmed: { total: number; recent: number; systematicReviews: number; clinicalTrials: number };
    crossref: { total: number | null };
  };
  articles: Article[];
  timeline: { year: number; count: number }[];
  signals: {
    breadth: "very_broad" | "broad" | "balanced" | "niche" | "scarce";
    trend: "growing" | "stable" | "declining" | "insufficient";
    recentRatio: number;
  };
  methodology: string;
};

const breadthLabels = {
  very_broad: "Muito amplo",
  broad: "Amplo",
  balanced: "Bom ponto de partida",
  niche: "Nicho específico",
  scarce: "Literatura escassa",
};
const trendLabels = { growing: "Em crescimento", stable: "Estável", declining: "Em redução", insufficient: "Dados insuficientes" };


export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-ink-soft" role="status">
          Carregando o Radar...
        </p>
      }
    >
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const params = useSearchParams();
  const [topic, setTopic] = useState(params.get("tema") || "semaglutide depression");
  const [period, setPeriod] = useState("5");
  const [studyType, setStudyType] = useState("all");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const library = useLibrary();
  const savedArticles = library.articles;
  const [projectId, setProjectId] = useState(params.get("projeto") || "");
  const [articles, setArticles] = useState<Article[]>([]);
  const [source, setSource] = useState("pubmed");
  const [sort, setSort] = useState("recent");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [articleTotal, setArticleTotal] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [mesh, setMesh] = useState("");
  const [populationTerm, setPopulationTerm] = useState("");
  const [outcomeTerm, setOutcomeTerm] = useState("");
  const [operator, setOperator] = useState("AND");
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupArticle, setLookupArticle] = useState<Article | null>(null);
  const accessArticles = useMemo(() => lookupArticle ? [...articles, lookupArticle] : articles, [articles, lookupArticle]);
  const openAccess = useOpenAccess(accessArticles);
  const effectiveQuery = useMemo(() => [topic.trim(), mesh.trim() && `\"${mesh.trim()}\"[MeSH Terms]`, populationTerm.trim(), outcomeTerm.trim()].filter(Boolean).join(` ${operator} `), [topic, mesh, populationTerm, outcomeTerm, operator]);
  const maxTimeline = useMemo(() => Math.max(1, ...(result?.timeline.map((x) => x.count) ?? [1])), [result]);

  async function recordSearch(data: Result) {
    try {
      const db = supabaseBrowser(); const { data: auth } = await db.auth.getUser();
      if (!auth.user) return;
      await db.from("search_history").insert({ owner_id: auth.user.id, query: data.topic, pubmed_total: data.sources.pubmed.total, recent_total: data.sources.pubmed.recent, systematic_reviews: data.sources.pubmed.systematicReviews, clinical_trials: data.sources.pubmed.clinicalTrials, trend: data.signals.trend, breadth: data.signals.breadth });
    } catch { /* O histórico nunca deve interromper uma busca válida. */ }
  }

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (loading || browsing) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/literature/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: effectiveQuery, period, studyType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro na busca");
      setResult(data);
      setArticles(data.articles); setSource("pubmed"); setSort("recent"); setDuplicateCount(0); setSourceWarning(null);
      setArticleTotal(data.sources.pubmed.total);
      setNextOffset(data.sources.pubmed.total > 20 ? 20 : null);
      setBrowseError(null);
      void recordSearch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível analisar o tema.");
    } finally {
      setLoading(false);
    }
  }
  function applyStrategy(item: SearchStrategy) { setTopic(item.query); setMesh(""); setPopulationTerm(""); setOutcomeTerm(""); setOperator("AND"); setPeriod(item.period); setStudyType(item.study_type); setSource(item.source); setSort(item.sort); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function applyHistory(query: string) { setTopic(query); setMesh(""); setPopulationTerm(""); setOutcomeTerm(""); setOperator("AND"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveArticle(article: Article) {
    const access = openAccess.results[articleKey(article)];
    await library.saveArticle({ ...article, fullTextUrl: access?.status === "open" ? access.url : article.fullTextUrl }, projectId || null);
  }

  async function browse(nextSource: string, nextSort: string, offset = 0) {
    if (!result || browsing || loading) return;
    setBrowsing(true); setBrowseError(null);
    try {
      const response = await fetch("/api/literature/articles", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource, sort: nextSort, offset, topic: result.topic, period: result.filters.period, searchTerm: result.filters.searchTerm }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao recuperar artigos.");
      setArticles(previous => offset === 0 ? data.articles : [...previous, ...data.articles.filter((a: Article) => !previous.some(b => sameArticle(a, b)))]);
      setSource(nextSource); setSort(nextSort); setNextOffset(data.nextOffset); setArticleTotal(data.total);
      setDuplicateCount(previous => offset === 0 ? Number(data.duplicateCount || 0) : previous + Number(data.duplicateCount || 0));
      setSourceWarning(data.warning || null);
    } catch (error) { setBrowseError(error instanceof Error ? error.message : "Falha na busca."); }
    finally { setBrowsing(false); }
  }
  async function lookup(e: React.FormEvent) {
    e.preventDefault(); if (lookupLoading) return;
    setLookupLoading(true); setLookupError(null); setLookupArticle(null);
    try {
      const response = await fetch("/api/literature/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Artigo não encontrado.");
      setLookupArticle(data.article);
    } catch (error) { setLookupError(error instanceof Error ? error.message : "Falha na busca."); }
    finally { setLookupLoading(false); }
  }

  const refinements = result
    ? [`${result.topic} AND young adults`, `${result.topic} AND clinical outcomes`, `${result.topic} AND systematic review`]
    : [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">Radar científico</p>
        <h1 className="font-display text-4xl md:text-5xl mt-3">Seu tema tem espaço para investigação?</h1>
        <p className="text-ink-soft mt-4 leading-relaxed">
          Digite um tema, hipótese ou combinação de termos. O ResearchHub consulta bases científicas em tempo real, mostra o comportamento da literatura e traz artigos reais para sua biblioteca.
        </p>
      </div>

      <form onSubmit={analyze} className="mt-8 bg-white border border-line rounded-2xl p-4 md:p-5 flex flex-wrap gap-3 shadow-sm">
        <input aria-label="Tema da busca" required minLength={3} maxLength={220} value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 border border-line rounded-card px-4 py-3 outline-none focus:border-teal" placeholder="Ex.: semaglutide depression" />
        <label className="text-xs text-ink-soft">Período<select disabled={loading || browsing} value={period} onChange={e => setPeriod(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="all">Todo o período</option><option value="3">Últimos 3 anos</option><option value="5">Últimos 5 anos</option><option value="10">Últimos 10 anos</option></select></label>
        <label className="text-xs text-ink-soft">Tipo de estudo<select disabled={loading || browsing} value={studyType} onChange={e => setStudyType(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="all">Todos os tipos</option><option value="systematic">Revisão sistemática</option><option value="trial">Ensaio clínico</option><option value="observational">Estudo observacional</option><option value="review">Revisão</option><option value="case">Relato de caso</option></select></label>
        <button disabled={loading || browsing} className="bg-teal text-white px-6 py-3 rounded-card font-medium disabled:opacity-50">
          {loading ? "Consultando PubMed..." : "Analisar tema"}
        </button>
        <details className="basis-full border-t border-line pt-4"><summary className="text-sm text-teal cursor-pointer">Busca avançada · MeSH, população e desfecho</summary><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4"><label className="text-xs text-ink-soft">Descritor MeSH<input value={mesh} maxLength={60} onChange={e=>setMesh(e.target.value)} placeholder="Ex.: Hypertension" className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft">População ou contexto<input value={populationTerm} maxLength={60} onChange={e=>setPopulationTerm(e.target.value)} placeholder="Ex.: medical residents" className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft">Desfecho ou medida<input value={outcomeTerm} maxLength={60} onChange={e=>setOutcomeTerm(e.target.value)} placeholder="Ex.: sleep quality" className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft">Combinar campos com<select value={operator} onChange={e=>setOperator(e.target.value)} className="block w-full border rounded-card px-3 py-2 mt-1 bg-white"><option value="AND">AND · todos</option><option value="OR">OR · qualquer um</option></select></label></div><p className="text-xs text-ink-soft mt-3">Use AND para aumentar a precisão e OR para ampliar a recuperação. Você também pode usar NOT, aspas e campos do PubMed no tema principal.</p></details>
      </form>
      <p className="text-xs text-ink-soft/70 mt-2">Dica: termos em inglês costumam recuperar melhor a literatura biomédica internacional.</p>
      {result && (result.topic !== effectiveQuery || result.filters.period !== period || result.filters.studyType !== studyType) && <p role="status" className="mt-4 text-sm bg-amber-soft rounded-card p-4">Os resultados abaixo são da última análise. Clique em Analisar tema para aplicar os campos atuais.</p>}
      {error && <div role="alert" className="mt-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-card text-sm">{error}</div>}
      <SavedSearches query={effectiveQuery} period={period} studyType={studyType} source={source} sort={sort} resultCount={result?.sources.pubmed.total ?? null} onApply={applyStrategy}/>
      <SearchHistory onApply={applyHistory} />

      <section className="mt-5 bg-teal-soft border border-teal/20 rounded-card p-4">
        {library.loading ? <p role="status" className="text-sm">Carregando sua biblioteca...</p> : !library.userId ? <p className="text-sm">Explore os artigos livremente. <Link href="/login" className="text-teal underline font-medium">Entre na sua conta</Link> para salvar artigos e acessar sua biblioteca em qualquer dispositivo.</p> : <label className="text-sm font-medium">Salvar novos artigos em<select aria-label="Projeto para novos artigos" value={projectId} disabled={library.working} onChange={e => setProjectId(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-white mt-2 w-full sm:max-w-md"><option value="">Biblioteca geral · sem projeto</option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || "Projeto sem título"}</option>)}</select></label>}
        {library.error && <p role="alert" className="text-sm text-red-700 mt-3">{library.error}</p>}
        {library.message && <p role="status" className="text-sm text-teal mt-3">{library.message}</p>}
      </section>
      <section className="mt-6 bg-white border border-line rounded-2xl p-5">
        <h2 className="font-display text-xl">Já encontrou um artigo em outro lugar?</h2>
        <p className="text-sm text-ink-soft mt-2">Busque pelo DOI, PMID ou link do PubMed/doi.org, independentemente dos resultados do Radar.</p>
        <form onSubmit={lookup} className="flex flex-wrap gap-3 mt-4">
          <input aria-label="DOI, PMID ou link do artigo" required maxLength={500} value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="DOI, PMID ou link" className="flex-1 min-w-0 border border-line rounded-card px-4 py-3" />
          <button disabled={lookupLoading} className="bg-ink text-white px-4 py-3 rounded-card disabled:opacity-50">{lookupLoading ? "Buscando..." : "Buscar artigo"}</button>
        </form>
        {lookupError && <p role="alert" className="text-red-700 text-sm mt-3">{lookupError}</p>}
        {lookupArticle && <div className="mt-4 border-t border-line pt-4">
          <h3 className="font-medium">{lookupArticle.title}</h3>
          <p className="text-xs text-ink-soft mt-2">{lookupArticle.journal} · {lookupArticle.year} · {lookupArticle.pmid ? `PMID ${lookupArticle.pmid}` : `DOI ${lookupArticle.doi}`}</p>
          {lookupArticle.abstract && <details className="mt-3"><summary className="text-teal text-sm cursor-pointer">Ver resumo</summary><p className="text-sm mt-2">{lookupArticle.abstract}</p></details>}
          <OpenAccessStatus result={openAccess.results[articleKey(lookupArticle)]} loading={openAccess.loading.has(articleKey(lookupArticle))} onCheck={() => void openAccess.retry(lookupArticle)} />
          <button disabled={library.loading || library.working || !library.userId || savedArticles.some(a => sameArticle(a, lookupArticle))} onClick={() => saveArticle(lookupArticle)} className="mt-3 text-sm bg-teal text-white px-4 py-2 rounded-card disabled:opacity-50">{savedArticles.some(a => sameArticle(a, lookupArticle)) ? "✓ Na biblioteca" : "+ Adicionar à biblioteca"}</button>
        </div>}
      </section>

      {!result && !loading && (
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {["cardiac rehabilitation elderly", "artificial intelligence melanoma", "sleep quality medical residents"].map((example) => (
            <button key={example} onClick={() => setTopic(example)} className="text-left bg-white border border-line rounded-card p-4 hover:border-teal transition-colors">
              <span className="text-xs text-teal uppercase tracking-wide">Exemplo</span>
              <p className="mt-2 text-sm font-medium">{example}</p>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric value={result.sources.pubmed.total.toLocaleString("pt-BR")} label="Resultados com os filtros" />
            <Metric value={result.sources.pubmed.recent.toLocaleString("pt-BR")} label="Publicados nos últimos 5 anos, dentro do recorte" />
            <Metric value={result.sources.pubmed.systematicReviews.toLocaleString("pt-BR")} label="Revisões sistemáticas" />
            <Metric value={result.sources.pubmed.clinicalTrials.toLocaleString("pt-BR")} label="Ensaios clínicos" />
          </section>

          <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-5">
            <div className="bg-white border border-line rounded-2xl p-6">
              <p className="text-xs uppercase tracking-widest text-ink-soft">Evolução por ano completo</p><p className="text-xs text-ink-soft mt-2">O ano atual é excluído da tendência para evitar uma comparação incompleta.</p>
              <div className="h-56 flex items-end gap-2 mt-6 border-b border-line pb-2">
                {result.timeline.map((item) => (
                  <div key={item.year} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                    <span className="text-[10px] text-ink-soft">{item.count}</span>
                    <div className="w-full max-w-10 bg-teal rounded-t-sm" style={{ height: `${item.count === 0 ? 0 : Math.max(4, (item.count / maxTimeline) * 170)}px` }} />
                    <span className="text-[10px] text-ink-soft">{item.year}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-teal-soft border border-teal/20 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-teal">Leitura do tema</p>
                <h2 className="font-display text-2xl mt-2">{breadthLabels[result.signals.breadth]}</h2>
                <p className="text-sm text-ink-soft mt-2">
                  Tendência: <strong className="text-ink">{trendLabels[result.signals.trend]}</strong>. Aproximadamente {Math.round(result.signals.recentRatio * 100)}% do recorte selecionado foi publicado nos últimos cinco anos.
                </p>
                <p className="text-sm mt-4 leading-relaxed">{result.signals.breadth === "very_broad" || result.signals.breadth === "broad" ? "Há bastante literatura neste recorte. Defina uma população, um contexto e um desfecho para tornar a pergunta mais precisa." : result.signals.breadth === "scarce" ? "Poucos registros foram encontrados. Teste sinônimos e termos em inglês, confira os filtros e leia os estudos antes de interpretar isso como oportunidade." : result.signals.breadth === "niche" ? "O recorte é específico. Confira se há estudos suficientes para o desenho que você pretende executar." : "O volume permite uma exploração inicial. Leia os estudos e identifique diferenças de população, método e desfechos."}</p>
                <p className="text-xs text-ink-soft mt-3">{result.signals.trend === "growing" ? "A produção aumentou nos anos completos analisados; isso não mede qualidade nem originalidade." : result.signals.trend === "insufficient" ? "A amostra anual é pequena para interpretar uma tendência." : "A tendência descreve volume de publicação, não relevância clínica."}</p>
                <p className="text-xs text-ink-soft mt-3">A classificação de amplitude é baseada no número de resultados deste recorte; não comprova uma lacuna científica.</p>
              </div>
              <div className="bg-white border border-line rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-ink-soft">Cobertura complementar</p>
                <p className="text-2xl font-semibold mt-2">{result.sources.crossref.total === null ? "—" : result.sources.crossref.total.toLocaleString("pt-BR")}</p>
                <p className="text-sm text-ink-soft mt-1">registros aproximados no Crossref, sem os filtros do PubMed. As contagens não são diretamente comparáveis.</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-line rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-line flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-teal">Artigos recuperados</p>
                <h2 className="font-display text-3xl mt-2">Explore a literatura</h2>
                <p className="text-sm text-ink-soft mt-2">Carregue mais artigos, compare fontes e salve os trabalhos relevantes.</p>
              </div>
              <Link href="/biblioteca" className="border border-line px-4 py-2.5 rounded-card text-sm font-medium hover:border-teal hover:text-teal">
                Minha biblioteca ({savedArticles.length})
              </Link>
            </div>

            <div className="p-6 border-b border-line bg-paper">
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs text-ink-soft">Fonte<select aria-label="Fonte dos artigos" disabled={browsing || loading} value={source} onChange={e => browse(e.target.value, sort)} className="block border border-line rounded-card px-3 py-2 mt-1 bg-white"><option value="pubmed">PubMed</option><option value="crossref">Crossref</option><option value="both">PubMed + Crossref</option></select></label>
                <label className="text-xs text-ink-soft">Ordenação<select aria-label="Ordenação dos artigos" disabled={browsing || loading} value={sort} onChange={e => browse(source, e.target.value)} className="block border border-line rounded-card px-3 py-2 mt-1 bg-white"><option value="recent">Mais recentes</option><option value="relevance">Relevância</option></select></label>
                <p role="status" className="text-sm text-ink-soft">{browsing ? "Recuperando artigos..." : `${articles.length} exibidos de ${articleTotal.toLocaleString("pt-BR")} registros em ${source === "pubmed" ? "PubMed" : source === "crossref" ? "Crossref" : "PubMed + Crossref"}`}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4"><span className="text-xs font-medium text-ink-soft">Exportar artigos exibidos:</span><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultCsv(articles), "text/csv;charset=utf-8", "radar-scholar.csv")} className="text-xs text-teal underline disabled:opacity-40">CSV</button><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultRis(articles), "application/x-research-info-systems", "radar-scholar.ris")} className="text-xs text-teal underline disabled:opacity-40">RIS</button><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultBibtex(articles), "application/x-bibtex", "radar-scholar.bib")} className="text-xs text-teal underline disabled:opacity-40">BibTeX</button>{source === "both" && <span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1">{duplicateCount} duplicado{duplicateCount === 1 ? "" : "s"} identificado{duplicateCount === 1 ? "" : "s"}</span>}</div>
              <p className="text-xs text-ink-soft mt-3">As métricas e o gráfico acima são do PubMed. Crossref reúne metadados de artigos com DOI; respeita o período, mas não aplica o filtro por desenho clínico. Na visão combinada, registros com o mesmo DOI ou PMID são unidos. Nem todos os registros têm resumo.</p>
              {sourceWarning && <p role="status" className="text-xs text-amber-800 bg-amber-soft rounded-card p-3 mt-3">{sourceWarning}</p>}
              {browseError && <div role="alert" className="mt-3 text-sm text-red-700">{browseError}<button className="ml-3 underline" onClick={() => browse(source, sort, nextOffset ?? 0)}>Tentar novamente</button></div>}
            </div>
            <div className="divide-y divide-line">
              {articles.map((article) => {
                const saved = savedArticles.some(a => sameArticle(a, article));
                return (
                  <article key={articleKey(article)} className="p-6">
                    <div className="flex flex-col md:flex-row md:justify-between gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          {article.year && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full">{article.year}</span>}
                          {article.duplicateSources && article.duplicateSources.length > 1 && <span className="bg-amber-soft text-ink px-2 py-1 rounded-full">Encontrado em PubMed + Crossref</span>}
                          {openAccess.results[articleKey(article)]?.status === "open" && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full">Texto completo aberto</span>}
                          {article.publicationTypes.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
                        </div>
                        <h3 className="font-display text-xl mt-3 leading-snug">{article.title}</h3>
                        <p className="text-sm text-ink-soft mt-2">
                          {article.authors.slice(0, 5).join(", ")}{article.authors.length > 5 ? " et al." : ""}
                        </p>
                        <p className="text-xs text-ink-soft/80 mt-1">{article.journal} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}{article.doi ? ` · DOI ${article.doi}` : ""}</p>

                        {article.abstract ? (
                          <details className="mt-4 group">
                            <summary className="text-sm text-teal font-medium cursor-pointer">Ver resumo</summary>
                            <p className="text-sm text-ink-soft leading-relaxed mt-3 max-w-3xl">{article.abstract}</p>
                          </details>
                        ) : (
                          <p className="text-xs text-ink-soft/60 mt-4">Resumo não disponível no registro recuperado.</p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-4 text-xs">
                          {article.pubmedUrl && <a href={article.pubmedUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">Abrir no PubMed ↗</a>}
                          {article.doiUrl && <a href={article.doiUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">Abrir DOI ↗</a>}
                        </div>
                        <OpenAccessStatus result={openAccess.results[articleKey(article)]} loading={openAccess.loading.has(articleKey(article))} onCheck={() => void openAccess.retry(article)} />
                      </div>

                      <button
                        type="button"
                        disabled={saved || library.loading || library.working || !library.userId}
                        onClick={() => saveArticle(article)}
                        className={`shrink-0 self-start px-4 py-2.5 rounded-card text-sm font-medium ${saved ? "bg-teal-soft text-teal" : "bg-ink text-white hover:bg-ink/90"}`}
                      >
                        {saved ? "✓ Na biblioteca" : library.working ? "Aguarde..." : "+ Adicionar à biblioteca"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {articles.length === 0 && <p className="p-6 text-sm text-ink-soft">Nenhum artigo detalhado foi recuperado para esta busca.</p>}
            </div>
            <div className="p-6 border-t border-line text-center">
              {nextOffset !== null ? <button disabled={browsing || loading} onClick={() => browse(source, sort, nextOffset)} className="bg-teal text-white rounded-card px-6 py-3 text-sm disabled:opacity-50">{browsing ? "Carregando..." : "Carregar mais 20 artigos"}</button> : <p className="text-sm text-ink-soft">{articleTotal > 10000 ? "Limite de navegação atingido. Refine o tema para explorar outros resultados." : "Fim dos resultados desta fonte."}</p>}
            </div>
          </section>

          <section className="bg-white border border-line rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-teal">Próxima decisão</p>
                <h2 className="font-display text-2xl mt-2">Teste recortes mais específicos</h2>
              </div>
              <Link href={`/ideias?tema=${encodeURIComponent(result.topic)}`} className="bg-ink text-white px-5 py-2.5 rounded-card text-sm font-medium text-center">Explorar ideias com este tema →</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-5">
              {refinements.map((item) => (
                <button key={item} onClick={() => { setTopic(item); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-left border border-line rounded-card p-4 hover:border-teal hover:bg-teal-soft transition-colors">
                  <p className="text-sm font-medium">{item}</p>
                  <span className="text-xs text-teal mt-2 inline-block">Analisar este recorte →</span>
                </button>
              ))}
            </div>
          </section>

          <details className="bg-white border border-line rounded-card p-4 text-xs text-ink-soft"><summary className="cursor-pointer font-medium">Como interpretar esta busca</summary><p className="mt-3">{result.methodology}</p><p className="mt-2 break-words">Consulta PubMed: {result.filters.searchTerm}</p><p className="mt-2">Consultado até {result.filters.endDate}. Os filtros por tipo dependem da indexação dos artigos.</p></details>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white border border-line rounded-card p-4">
      <p className="text-2xl md:text-3xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
    </div>
  );
}

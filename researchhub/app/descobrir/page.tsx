"use client";
import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";

import InterfaceText from "@/components/i18n/interface-text";


import { Suspense, useMemo, useRef, useState } from "react";
import { appliedPubmedStrategy, searchLimits } from "@/lib/literature/search-limits";
import { trackRadarAttempt } from "@/lib/telemetry/journey";
import LoadingDialog from "@/components/ai/loading-dialog";
import AssistantPanel from "@/components/ai/assistant-panel";
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
  filters: { period: string; studyType: string; searchTerm: string; crossrefQuery: string; endDate: string; mesh: string; population: string; outcome: string; operator: string; language: string };
  strategy: {
    interpreted: string;
    concepts: string[];
    mode: "interpreted" | "advanced";
    language: "pt" | "en" | "advanced";
    warnings: string[];
    pubmedQuery: string;
    unresolvedTerms: string[];
    manualTranslations: Array<{ source: string; target: string }>;
    requiresReview: boolean;
  };
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
type TermReview = {
  strategy: Result["strategy"];
  translations: Record<string, string>;
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
          <InterfaceText message="screen.ea07493de63e" />
        </p>
      }
    >
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const { t: uiText } = useLanguage();
  const params = useSearchParams();
  const [topic, setTopic] = useState(params.get("tema") || "semaglutide depression");
  const [period, setPeriod] = useState(params.get("origem")==="assistente"?"all":"5");
  const incomingStudy = params.get("desenho") || "";
  const [studyType, setStudyType] = useState(incomingStudy.toLowerCase().includes("revisão sistemática") ? "systematic" : incomingStudy.toLowerCase().includes("revisão") ? "review" : incomingStudy.toLowerCase().includes("ensaio") ? "trial" : incomingStudy.toLowerCase().includes("observacional") || incomingStudy.toLowerCase().includes("coorte") || incomingStudy.toLowerCase().includes("caso-controle") || incomingStudy.toLowerCase().includes("transversal") ? "observational" : incomingStudy.toLowerCase().includes("relato") ? "case" : "all");
  const [language, setLanguage] = useState(params.get("origem")==="assistente"?"en":"auto");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const searchLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [termReview, setTermReview] = useState<TermReview | null>(null);
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
  const [populationTerm, setPopulationTerm] = useState(params.get("populacao") || "");
  const [outcomeTerm, setOutcomeTerm] = useState(params.get("desfecho") || "");
  const [operator, setOperator] = useState("AND");
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupArticle, setLookupArticle] = useState<Article | null>(null);
  const accessArticles = useMemo(() => lookupArticle ? [...articles, lookupArticle] : articles, [articles, lookupArticle]);
  const openAccess = useOpenAccess(accessArticles);
  const effectiveQuery = useMemo(() => result?.strategy.pubmedQuery || [topic.trim(), mesh.trim() && `\"${mesh.trim()}\"[MeSH Terms]`, populationTerm.trim(), outcomeTerm.trim()].filter(Boolean).join(` ${operator} `), [result, topic, mesh, populationTerm, outcomeTerm, operator]);
  const maxTimeline = useMemo(() => Math.max(1, ...(result?.timeline.map((x) => x.count) ?? [1])), [result]);

  async function recordSearch(data: Result) {
    try {
      const db = supabaseBrowser(); const { data: auth } = await db.auth.getUser();
      if (!auth.user) return;
      await db.from("search_history").insert({ owner_id: auth.user.id, query: data.topic, pubmed_total: data.sources.pubmed.total, recent_total: data.sources.pubmed.recent, systematic_reviews: data.sources.pubmed.systematicReviews, clinical_trials: data.sources.pubmed.clinicalTrials, trend: data.signals.trend, breadth: data.signals.breadth });
    } catch { /* O histórico nunca deve interromper uma busca válida. */ }
  }

  async function runAnalysis(translations: Record<string, string> = {}) {
    if (searchLock.current || loading || browsing) return;
    searchLock.current = true;
    const finishAttempt = trackRadarAttempt();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/literature/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mesh, populationTerm, outcomeTerm, operator, language, period, studyType, translations }),
        signal: AbortSignal.timeout(180000),
      });
      const data = await response.json();
      if (response.status === 422 && data?.code === "TERMINOLOGY_REVIEW_REQUIRED") {
        finishAttempt("review");
        setTermReview({ strategy: data.strategy, translations: Object.fromEntries(data.strategy.unresolvedTerms.map((term: string) => [term, ""])) });
        return;
      }
      if (!response.ok) throw new Error(data?.error || "Erro na busca");
      finishAttempt("completed");
      setTermReview(null);
      setResult(data);
      setArticles(data.articles); setSource("pubmed"); setSort("relevance"); setDuplicateCount(0); setSourceWarning(null);
      setArticleTotal(data.sources.pubmed.total);
      setNextOffset(data.sources.pubmed.total > 20 ? 20 : null);
      setBrowseError(null);
      void recordSearch(data);
    } catch (err) {
      finishAttempt("failed");
      setError(err instanceof Error ? err.message : "Não foi possível analisar o tema.");
    } finally {
      searchLock.current = false;
      setLoading(false);
    }
  }
  async function analyze(e: React.FormEvent) { e.preventDefault(); await runAnalysis(); }
  async function confirmTerms(e: React.FormEvent) { e.preventDefault(); if (termReview) await runAnalysis(termReview.translations); }
  function applyStrategy(item: SearchStrategy) { setTopic(item.query); setMesh(""); setPopulationTerm(""); setOutcomeTerm(""); setOperator("AND"); setLanguage("auto"); setPeriod(item.period); setStudyType(item.study_type); setSource(item.source); setSort(item.sort); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function applyHistory(query: string) { setTopic(query); setMesh(""); setPopulationTerm(""); setOutcomeTerm(""); setOperator("AND"); setLanguage("auto"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveArticle(article: Article) {
    const access = openAccess.results[articleKey(article)];
    await library.saveArticle({ ...article, fullTextUrl: access?.status === "open" ? access.url : article.fullTextUrl }, projectId || null);
  }

  async function browse(nextSource: string, nextSort: string, offset = 0) {
    if (!result || browsing || loading) return;
    setBrowsing(true); setBrowseError(null);
    try {
      const response = await fetch("/api/literature/articles", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource, sort: nextSort, offset, topic: result.topic, period: result.filters.period, searchTerm: result.filters.searchTerm, crossrefQuery: result.filters.crossrefQuery }), signal: AbortSignal.timeout(180000) });
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
      const response = await fetch("/api/literature/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier }), signal: AbortSignal.timeout(180000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Artigo não encontrado.");
      setLookupArticle(data.article);
    } catch (error) { setLookupError(error instanceof Error ? error.message : "Falha na busca."); }
    finally { setLookupLoading(false); }
  }


  return (
    <div className="scholar-workspace radar-page max-w-5xl mx-auto">
      <LoadingDialog open={loading || browsing || lookupLoading} title={lookupLoading ? uiText("screen.d24b34adf103") : browsing ? uiText("screen.c231b9899ee8") : uiText("screen.aa188adca06b")} description={lookupLoading ? uiText("screen.dc05f1e50df1") : browsing ? uiText("screen.d33b70e4f5a7") : uiText("screen.b5e46b1f7ce3")} statusText="Aguardando a resposta das fontes científicas." />
      <div className="module-intro radar-intro max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">Radar científico</p>
        <h1 className="font-display text-4xl md:text-5xl mt-3"><InterfaceText message="screen.fae2072de0f7" /></h1>
        <p className="text-ink-soft mt-4 leading-relaxed">
          <InterfaceText message="screen.660824a466c5" />
        </p>
        <div className="radar-source-strip" aria-label={uiText("screen.0b5d2a033d7d")}>
          <span><i aria-hidden="true" />PubMed</span>
          <span><i aria-hidden="true" />Crossref</span>
          <span><i aria-hidden="true" /><InterfaceText message="screen.ec4c162c9751" /></span>
        </div>
      </div>

      {params.get("origem")==="assistente"&&<p role="status" className="mt-6 rounded-card bg-teal-soft p-4 text-sm text-teal"><InterfaceText message="screen.41f2f15677f8" /></p>}
      {params.get("origem") === "ideias" && <p role="status" className="mt-6 rounded-card bg-teal-soft p-4 text-sm text-teal"><InterfaceText message="screen.063ed0cd5381" /> <Link href="/ideias" className="underline"><InterfaceText message="screen.d08eb8b43f90" /></Link></p>}

      {params.get("origem") === "projeto" && <section className="mt-6 bg-teal-soft border border-teal/20 rounded-2xl p-5 flex flex-wrap justify-between gap-4 items-center"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.c5971fc6df9e" /></p><h2 className="font-display text-xl mt-2"><InterfaceText message="screen.4504ece4c91e" /></h2><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.f7b37c70f8eb" /></p></div>{projectId && <Link href={`/meu-trabalho?id=${projectId}`} className="text-sm text-teal"><InterfaceText message="screen.324fd80fa0d9" /></Link>}</section>}

      <form onSubmit={analyze} className="module-commandbar radar-search-panel mt-8 bg-white border border-line rounded-2xl p-4 md:p-5 flex flex-wrap gap-3 shadow-sm">
        <input aria-label={uiText("screen.a10fc0e515dd")} required minLength={3} maxLength={searchLimits.query} value={topic} onChange={(e) => { setTopic(e.target.value); setTermReview(null); }} className="flex-1 border border-line rounded-card px-4 py-3 outline-none focus:border-teal" placeholder={uiText("screen.6e0d55e597f7")} />
        <label className="text-xs text-ink-soft">Idioma<select aria-label={uiText("screen.3d5012173e48")} disabled={loading || browsing} value={language} onChange={e => { setLanguage(e.target.value); setTermReview(null); }} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="auto">Automático</option><option value="pt"><InterfaceText message="screen.d4ada8ec2764" /></option><option value="en"><InterfaceText message="screen.85a560bc1af9" /></option></select></label>
        <label className="text-xs text-ink-soft">Período<select disabled={loading || browsing} value={period} onChange={e => setPeriod(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="all"><InterfaceText message="screen.f70ad056ef46" /></option><option value="3"><InterfaceText message="screen.1028df7262f9" /></option><option value="5"><InterfaceText message="screen.ce0063e9851d" /></option><option value="10"><InterfaceText message="screen.275ab5f8225a" /></option></select></label>
        <label className="text-xs text-ink-soft"><InterfaceText message="screen.d1703a5a5185" /><select disabled={loading || browsing} value={studyType} onChange={e => setStudyType(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="all"><InterfaceText message="screen.88bfb93eb03e" /></option><option value="systematic"><InterfaceText message="screen.6e3232cec67c" /></option><option value="trial"><InterfaceText message="screen.774dd62a21e8" /></option><option value="observational"><InterfaceText message="screen.6529a74e7fb0" /></option><option value="review"><InterfaceText message="screen.f2e7f5487180" /></option><option value="case"><InterfaceText message="screen.60a84ae8356a" /></option></select></label>
        <button disabled={loading || browsing} className="bg-teal text-white px-6 py-3 rounded-card font-medium disabled:opacity-50">
          {loading ? "Consultando PubMed..." : uiText("screen.96767be14e59")}
        </button>
        <details className="basis-full border-t border-line pt-4"><summary className="text-sm text-teal cursor-pointer"><InterfaceText message="screen.cce79538ec44" /></summary><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4"><label className="text-xs text-ink-soft"><InterfaceText message="screen.a67ea4995792" /><input value={mesh} maxLength={searchLimits.field} onChange={e=>setMesh(e.target.value)} placeholder={uiText("screen.94f1f4e1eb9a")} className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft"><InterfaceText message="screen.22b2ba5d4d18" /><input value={populationTerm} maxLength={searchLimits.field} onChange={e=>setPopulationTerm(e.target.value)} placeholder={uiText("screen.b91a4112cff5")} className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft"><InterfaceText message="screen.3e31015169f5" /><input value={outcomeTerm} maxLength={searchLimits.field} onChange={e=>setOutcomeTerm(e.target.value)} placeholder={uiText("screen.c2af7282316e")} className="block w-full border rounded-card px-3 py-2 mt-1"/></label><label className="text-xs text-ink-soft"><InterfaceText message="screen.4ccc9e28b467" /><select value={operator} onChange={e=>setOperator(e.target.value)} className="block w-full border rounded-card px-3 py-2 mt-1 bg-white"><option value="AND">AND · todos</option><option value="OR"><InterfaceText message="screen.0969997e4309" /></option></select></label></div><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.9b189eb267d7" /></p></details>
      </form>
      <div id="preparar-busca-ia" className="scroll-mt-24">
      <AssistantPanel feature="radar" title={uiText("screen.72bc47fea8c7")} actionLabel={uiText("screen.6753d8a908d9")} disabled={loading || browsing || lookupLoading} description={uiText("screen.5224d7a6e3fa")} context={{ topic, language, period, studyType, mesh, population: populationTerm, outcome: outcomeTerm, operator, searchGoal: "exploratory_broad" }} projectId={projectId||null} onApply={item=>{if(item.targetField==="pubmedQuery"){try{const next=appliedPubmedStrategy(item.content);setTopic(next.topic);setMesh(next.mesh);setPopulationTerm(next.populationTerm);setOutcomeTerm(next.outcomeTerm);setOperator(next.operator);setLanguage(next.language);setTermReview(null);setResult(null);setError(null);window.scrollTo({top:0,behavior:"smooth"});}catch(error){setError(error instanceof Error?error.message:"Estratégia inválida.");}}}}/>
      </div>
      <p className="text-xs text-ink-soft/70 mt-2"><InterfaceText message="screen.525350437550" /></p>
      <details className="mt-4 bg-white border border-line rounded-card p-4 text-sm"><summary className="text-teal font-medium cursor-pointer"><InterfaceText message="screen.abee77f7118a" /></summary><ol className="mt-3 grid md:grid-cols-2 gap-2 text-xs text-ink-soft list-decimal pl-5"><li><InterfaceText message="screen.445351b59ad4" /></li><li><InterfaceText message="screen.847f1babeb29" /></li><li><InterfaceText message="screen.596a7d5cc5eb" /></li><li><InterfaceText message="screen.311ebca8bb47" /></li><li><InterfaceText message="screen.b29c68d5ecdf" /></li><li><InterfaceText message="screen.6f1c33e52dce" /></li></ol><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.825d3ed8f5c0" /></p></details>
      {result && (result.topic !== topic.trim() || result.filters.mesh !== mesh.trim() || result.filters.population !== populationTerm.trim() || result.filters.outcome !== outcomeTerm.trim() || result.filters.operator !== operator || result.filters.language !== language || result.filters.period !== period || result.filters.studyType !== studyType) && <p role="status" className="mt-4 text-sm bg-amber-soft rounded-card p-4"><InterfaceText message="screen.3a3817970c44" /></p>}
      {error && <div role="alert" className="mt-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-card text-sm"><AuthoredText text={error} /></div>}
      {termReview && <form onSubmit={confirmTerms} className="mt-5 bg-amber-soft border border-amber-200 rounded-2xl p-5" aria-label={uiText("screen.10167fd7288d")}>
        <p className="text-xs uppercase tracking-widest text-amber-800 font-semibold"><InterfaceText message="screen.97efbb872032" /></p>
        <h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.a53d1b9ad9f1" /></h2>
        <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.34e5df9bc174" /></p>
        {!!termReview.strategy.concepts.length && <div className="flex flex-wrap gap-2 mt-4">{termReview.strategy.concepts.map(concept => <span key={concept} className="bg-white text-teal rounded-full px-3 py-1 text-xs">✓ {concept}</span>)}</div>}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">{termReview.strategy.unresolvedTerms.map(term => <label key={term} className="text-sm font-medium">{term}<input required minLength={2} maxLength={80} lang="en" value={termReview.translations[term] || ""} onChange={e => setTermReview(previous => previous ? {...previous, translations: {...previous.translations, [term]: e.target.value}} : previous)} placeholder={`Equivalente de “${term}” em inglês`} className="block w-full border border-amber-300 bg-white rounded-card px-3 py-2 mt-1" /></label>)}</div>
        <div className="flex flex-wrap gap-3 mt-4"><button disabled={loading} className="bg-teal text-white px-5 py-3 rounded-card font-medium disabled:opacity-50">{loading ? uiText("screen.c98dca97594e") : uiText("screen.bc5fc9a5ff6e")}</button><button type="button" onClick={() => setTermReview(null)} className="border border-line bg-white px-4 py-3 rounded-card"><InterfaceText message="screen.413bdc3133fb" /></button></div>
        <p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.576b9df65d53" /></p>
      </form>}
      <details className="radar-disclosure mt-4 rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.b606b308b6fd" /></summary>
      <SavedSearches query={effectiveQuery} period={period} studyType={studyType} source={source} sort={sort} resultCount={result?.sources.pubmed.total ?? null} onApply={applyStrategy}/>
      <SearchHistory onApply={applyHistory} />
      </details>

      <section className="radar-library-target mt-5 bg-teal-soft border border-teal/20 rounded-card p-4">
        {library.loading ? <p role="status" className="text-sm"><InterfaceText message="screen.1a5c76655092" /></p> : !library.userId ? <p className="text-sm"><InterfaceText message="screen.a0e8789505e2" /> <Link href="/login" className="text-teal underline font-medium"><InterfaceText message="screen.84f05e0da1f9" /></Link> <InterfaceText message="screen.87f1b3b56d85" /></p> : <label className="text-sm font-medium"><InterfaceText message="screen.d7ea2d19483f" /><select aria-label={uiText("screen.5e2ff90305df")} value={projectId} disabled={library.working} onChange={e => setProjectId(e.target.value)} className="block border border-line rounded-card px-3 py-2 bg-white mt-2 w-full sm:max-w-md"><option value=""><InterfaceText message="screen.758dd50675ef" /></option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || uiText("screen.53d02a124b87")}</option>)}</select></label>}
        {library.error && <p role="alert" className="text-sm text-red-700 mt-3"><AuthoredText text={library.error} /></p>}
        {library.message && <p role="status" className="text-sm text-teal mt-3"><AuthoredText text={library.message} /></p>}
      </section>
      <details className="radar-lookup-card radar-disclosure mt-4 bg-white border border-line rounded-2xl p-5">
        <summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.9f55b6a35e27" /></summary>
        <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.f7672388197f" /></p>
        <form onSubmit={lookup} className="flex flex-wrap gap-3 mt-4">
          <input aria-label={uiText("screen.a2bd655fdd75")} required maxLength={500} value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder={uiText("screen.e73ccadd8ebd")} className="flex-1 min-w-0 border border-line rounded-card px-4 py-3" />
          <button disabled={lookupLoading} className="bg-ink text-white px-4 py-3 rounded-card disabled:opacity-50">{lookupLoading ? "Buscando..." : uiText("screen.68cd1ec180da")}</button>
        </form>
        {lookupError && <p role="alert" className="text-red-700 text-sm mt-3"><AuthoredText text={lookupError} /></p>}
        {lookupArticle && <div className="mt-4 border-t border-line pt-4">
          <h3 className="font-medium">{lookupArticle.title}</h3>
          <p className="text-xs text-ink-soft mt-2">{lookupArticle.journal} · {lookupArticle.year} · {lookupArticle.pmid ? `PMID ${lookupArticle.pmid}` : `DOI ${lookupArticle.doi}`}</p>
          {lookupArticle.abstract && <details className="mt-3"><summary className="text-teal text-sm cursor-pointer"><InterfaceText message="screen.e0ac436e7868" /></summary><p className="text-sm mt-2">{lookupArticle.abstract}</p></details>}
          <OpenAccessStatus result={openAccess.results[articleKey(lookupArticle)]} loading={openAccess.loading.has(articleKey(lookupArticle))} onCheck={() => void openAccess.retry(lookupArticle)} />
          <button disabled={library.loading || library.working || !library.userId || savedArticles.some(a => sameArticle(a, lookupArticle))} onClick={() => saveArticle(lookupArticle)} className="mt-3 text-sm bg-teal text-white px-4 py-2 rounded-card disabled:opacity-50">{savedArticles.some(a => sameArticle(a, lookupArticle)) ? uiText("screen.ca1030e614c1") : uiText("screen.16caed53e0f7")}</button>
        </div>}
      </details>

      {!result && !loading && (
        <div className="radar-examples mt-10 grid md:grid-cols-3 gap-4">
          {["qualidade do sono em residentes de medicina", "adesão ao tratamento da hipertensão", "burnout em estudantes de medicina"].map((example) => (
            <button key={example} onClick={() => setTopic(example)} className="text-left bg-white border border-line rounded-card p-4 hover:border-teal transition-colors">
              <span className="text-xs text-teal uppercase tracking-wide"><InterfaceText message="screen.6af3ef6ba0a1" /></span>
              <p className="mt-2 text-sm font-medium">{example}</p>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <section className="bg-white border border-teal/30 rounded-2xl p-5" aria-label={uiText("screen.1552cf019613")}>
            <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.aef37a1b68b9" /></p>
            <p className="font-medium mt-2">{result.strategy.interpreted}</p>
            <p className="text-xs text-ink-soft mt-2">Idioma aplicado: {result.strategy.language === "pt" ? uiText("screen.e4bf48ea4a79") : result.strategy.language === "en" ? uiText("screen.85a560bc1af9") : uiText("screen.0fd98652103f")}</p>
            {!!result.strategy.concepts.length && <div className="flex flex-wrap gap-2 mt-3">{result.strategy.concepts.map(concept => <span key={concept} className="bg-teal-soft text-teal rounded-full px-3 py-1 text-xs">{concept}</span>)}</div>}
            <p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.0d3f5add6671" /></p>
            {result.strategy.warnings.map(warning => <p key={warning} role="status" className="text-xs text-amber-800 bg-amber-soft rounded-card p-3 mt-3"><AuthoredText text={warning} /></p>)}
          </section>
          <section className="radar-metrics grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric value={result.sources.pubmed.total.toLocaleString("pt-BR")} label={uiText("screen.fd259676797d")} />
            <Metric value={result.sources.pubmed.recent.toLocaleString("pt-BR")} label={uiText("screen.84fde1dbd550")} />
            <Metric value={result.sources.pubmed.systematicReviews.toLocaleString("pt-BR")} label={uiText("screen.e834a6e2ae4a")} />
            <Metric value={result.sources.pubmed.clinicalTrials.toLocaleString("pt-BR")} label={uiText("screen.54a245bc407b")} />
          </section>

          <section className="radar-results bg-white border border-line rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-line flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.0c8337c345e0" /></p>
                <h2 className="font-display text-3xl mt-2"><InterfaceText message="screen.0c43239822f7" /></h2>
                <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.9883a14966c8" /></p>
              </div>
              <Link href="/biblioteca" className="border border-line px-4 py-2.5 rounded-card text-sm font-medium hover:border-teal hover:text-teal">
                <InterfaceText message="screen.dc1e3cdad359" />{savedArticles.length})
              </Link>
            </div>

            <div className="p-6 border-b border-line bg-paper">
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs text-ink-soft"><InterfaceText message="screen.1bdb4add5da2" /><select aria-label={uiText("screen.86844b68c2bf")} disabled={browsing || loading} value={source} onChange={e => browse(e.target.value, sort)} className="block border border-line rounded-card px-3 py-2 mt-1 bg-white"><option value="pubmed">PubMed</option><option value="crossref">Crossref</option><option value="both">PubMed + Crossref</option></select></label>
                <label className="text-xs text-ink-soft"><InterfaceText message="screen.63fbb2cee8cd" /><select aria-label={uiText("screen.4499f9a5360c")} disabled={browsing || loading} value={sort} onChange={e => browse(source, e.target.value)} className="block border border-line rounded-card px-3 py-2 mt-1 bg-white"><option value="recent"><InterfaceText message="screen.ade822bf50f9" /></option><option value="relevance"><InterfaceText message="screen.a415f1a5dcce" /></option></select></label>
                <p role="status" className="text-sm text-ink-soft">{browsing ? "Recuperando artigos..." : `${articles.length} exibidos de ${articleTotal.toLocaleString("pt-BR")} registros em ${source === "pubmed" ? "PubMed" : source === "crossref" ? "Crossref" : "PubMed + Crossref"}`}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4"><span className="text-xs font-medium text-ink-soft"><InterfaceText message="screen.975761e691ed" /></span><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultCsv(articles), "text/csv;charset=utf-8", "radar-scholar.csv")} className="text-xs text-teal underline disabled:opacity-40">CSV</button><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultRis(articles), "application/x-research-info-systems", "radar-scholar.ris")} className="text-xs text-teal underline disabled:opacity-40">RIS</button><button type="button" disabled={!articles.length} onClick={() => downloadResult(resultBibtex(articles), "application/x-bibtex", "radar-scholar.bib")} className="text-xs text-teal underline disabled:opacity-40">BibTeX</button>{source === "both" && <span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1">{duplicateCount} duplicado{duplicateCount === 1 ? "" : "s"} identificado{duplicateCount === 1 ? "" : "s"}</span>}</div>
              <p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.943580f04e2a" /></p>
              {sourceWarning && <p role="status" className="text-xs text-amber-800 bg-amber-soft rounded-card p-3 mt-3"><AuthoredText text={sourceWarning} /></p>}
              {browseError && <div role="alert" className="mt-3 text-sm text-red-700"><AuthoredText text={browseError} /><button className="ml-3 underline" onClick={() => browse(source, sort, nextOffset ?? 0)}><InterfaceText message="screen.b9e10688be01" /></button></div>}
            </div>
            <div className="divide-y divide-line">
              {articles.map((article) => {
                const saved = savedArticles.some(a => sameArticle(a, article));
                return (
                  <article key={articleKey(article)} className="radar-article p-6">
                    <div className="flex flex-col md:flex-row md:justify-between gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          {article.year && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full">{article.year}</span>}
                          {article.duplicateSources && article.duplicateSources.length > 1 && <span className="bg-amber-soft text-ink px-2 py-1 rounded-full"><InterfaceText message="screen.c7c6f861a0ff" /></span>}
                          {openAccess.results[articleKey(article)]?.status === "open" && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full"><InterfaceText message="screen.332432094ef6" /></span>}
                          {article.publicationTypes.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
                        </div>
                        <h3 className="font-display text-xl mt-3 leading-snug">{article.title}</h3>
                        <p className="text-sm text-ink-soft mt-2">
                          {article.authors.slice(0, 5).join(", ")}{article.authors.length > 5 ? " et al." : ""}
                        </p>
                        <p className="text-xs text-ink-soft/80 mt-1">{article.journal} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}{article.doi ? ` · DOI ${article.doi}` : ""}</p>

                        {article.abstract ? (
                          <details className="mt-4 group">
                            <summary className="text-sm text-teal font-medium cursor-pointer"><InterfaceText message="screen.e0ac436e7868" /></summary>
                            <p className="text-sm text-ink-soft leading-relaxed mt-3 max-w-3xl">{article.abstract}</p>
                          </details>
                        ) : (
                          <p className="text-xs text-ink-soft/60 mt-4"><InterfaceText message="screen.0df1e45d2b7e" /></p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-4 text-xs">
                          {article.pubmedUrl && <a href={article.pubmedUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline"><InterfaceText message="screen.995a21ad803a" /></a>}
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
                        {saved ? uiText("screen.ca1030e614c1") : library.working ? "Aguarde..." : uiText("screen.16caed53e0f7")}
                      </button>
                    </div>
                  </article>
                );
              })}
              {articles.length === 0 && <p className="p-6 text-sm text-ink-soft"><InterfaceText message="screen.6985a714b0cb" /></p>}
            </div>
            <div className="p-6 border-t border-line text-center">
              {nextOffset !== null ? <button disabled={browsing || loading} onClick={() => browse(source, sort, nextOffset)} className="bg-teal text-white rounded-card px-6 py-3 text-sm disabled:opacity-50">{browsing ? uiText("screen.1258573b225a") : uiText("screen.9a2446f5578e")}</button> : <p className="text-sm text-ink-soft">{articleTotal > 10000 ? uiText("screen.c75819d136e4") : "Fim dos resultados desta fonte."}</p>}
            </div>
          </section>

<details className="radar-disclosure rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.ece7f03facd1" /></summary><div className="mt-5">          <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-5">
            <div className="radar-chart-card bg-white border border-line rounded-2xl p-6">
              <p className="text-xs uppercase tracking-widest text-ink-soft"><InterfaceText message="screen.7d4c17db7f73" /></p><p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.8d6e4b9ed077" /></p>
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
              <div className="radar-insight-card bg-teal-soft border border-teal/20 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-teal"><InterfaceText message="screen.eebc284fab77" /></p>
                <h2 className="font-display text-2xl mt-2"><AuthoredText text={breadthLabels[result.signals.breadth]} /></h2>
                <p className="text-sm text-ink-soft mt-2">
                  <InterfaceText message="screen.513a550f3e5e" /> <strong className="text-ink"><AuthoredText text={trendLabels[result.signals.trend]} /></strong>. Aproximadamente {Math.round(result.signals.recentRatio * 100)}<InterfaceText message="screen.b396429b152f" />
                </p>
                <p className="text-sm mt-4 leading-relaxed">{result.signals.breadth === "very_broad" || result.signals.breadth === "broad" ? uiText("screen.fa3c7627f6d5") : result.signals.breadth === "scarce" ? uiText("screen.f009350e978c") : result.signals.breadth === "niche" ? uiText("screen.db483239926a") : uiText("screen.2b15e79c8ed4")}</p>
                <p className="text-xs text-ink-soft mt-3">{result.signals.trend === "growing" ? uiText("screen.182ae69e7108") : result.signals.trend === "insufficient" ? uiText("screen.28eb7c0557ee") : uiText("screen.9269fca87236")}</p>
                <p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.1c38c864184e" /></p>
              </div>
              <div className="bg-white border border-line rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-ink-soft"><InterfaceText message="screen.2fbeda492016" /></p>
                <p className="text-2xl font-semibold mt-2">{result.sources.crossref.total === null ? "—" : result.sources.crossref.total.toLocaleString("pt-BR")}</p>
                <p className="text-sm text-ink-soft mt-1"><InterfaceText message="screen.3ee6f3589bb4" /></p>
              </div>
            </div>
          </section>

</div></details>
          <section className="radar-next-step bg-white border border-line rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.5017b27efe6a" /></p>
                <h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.6a3b044dbc56" /></h2>
                <p className="mt-2 text-sm text-ink-soft"><InterfaceText message="screen.8bdd389e9ef0" /></p>
              </div>
              <Link href={`/ideias?tema=${encodeURIComponent(result.topic)}`} className="bg-ink text-white px-5 py-2.5 rounded-card text-sm font-medium text-center"><InterfaceText message="screen.591825296b17" /></Link>
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-5">
              <button type="button" onClick={() => { setMesh(""); setPopulationTerm(""); setOutcomeTerm(""); setStudyType("all"); setPeriod("all"); setTermReview(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-left border border-line rounded-card p-4 hover:border-teal hover:bg-teal-soft transition-colors">
                <p className="text-sm font-medium"><InterfaceText message="screen.bed353d5328a" /></p><span className="text-xs text-ink-soft mt-2 block"><InterfaceText message="screen.55272f5717d0" /></span>
              </button>
              <a href="#preparar-busca-ia" className="text-left border border-line rounded-card p-4 hover:border-teal hover:bg-teal-soft transition-colors">
                <p className="text-sm font-medium"><InterfaceText message="screen.31f21a53dd53" /></p><span className="text-xs text-ink-soft mt-2 block"><InterfaceText message="screen.1eeaa8b58621" /></span>
              </a>
            </div>
          </section>

          <details className="bg-white border border-line rounded-card p-4 text-xs text-ink-soft"><summary className="cursor-pointer font-medium"><InterfaceText message="screen.d9fec506d835" /></summary><p className="mt-3"><AuthoredText text={result.methodology} /></p><p className="mt-2 break-words">Consulta PubMed: {result.filters.searchTerm}</p><p className="mt-2 break-words"><InterfaceText message="screen.88634532ec93" /> {result.filters.crossrefQuery}</p><p className="mt-2"><InterfaceText message="screen.3ffac94c0512" /> {result.filters.endDate}<InterfaceText message="screen.11cb6c2901da" /></p></details>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white border border-line rounded-card p-4">
      <p className="text-2xl md:text-3xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-ink-soft mt-1"><AuthoredText text={label} /></p>
    </div>
  );
}

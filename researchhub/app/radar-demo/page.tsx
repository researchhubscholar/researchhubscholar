"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import PageHeading from "@/components/public/page-heading";
import type { Article } from "@/lib/literature/types";

type Strategy = {
  interpreted: string;
  concepts: string[];
  warnings: string[];
  language: "pt" | "en" | "advanced";
  unresolvedTerms: string[];
  requiresReview: boolean;
};
type Result = {
  topic: string;
  remaining: number;
  generatedAt: string;
  articles: Article[];
  timeline: { year: number; count: number }[];
  sources: { pubmed: { total: number; systematicReviews: number; clinicalTrials: number } };
  strategy: Strategy;
  methodology: string;
};
type TermReview = { strategy: Strategy; translations: Record<string, string> };

export default function Demo() {
  const [topic, setTopic] = useState("qualidade do sono em residentes de medicina");
  const [language, setLanguage] = useState("auto");
  const [result, setResult] = useState<Result | null>(null);
  const [termReview, setTermReview] = useState<TermReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  function remember() {
    try { localStorage.setItem("scholar-demo-topic", JSON.stringify({ topic: result?.topic || topic.trim(), at: Date.now() })); } catch {}
  }

  async function search(translations: Record<string, string> = {}) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/radar-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, translations }),
      });
      const data = await response.json();
      if (response.status === 422 && data?.code === "TERMINOLOGY_REVIEW_REQUIRED") {
        setTermReview({ strategy: data.strategy, translations: Object.fromEntries(data.strategy.unresolvedTerms.map((term: string) => [term, ""])) });
        return;
      }
      if (!response.ok) throw new Error(data.error || "Busca indisponível");
      setTermReview(null);
      setResult(data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Busca indisponível");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return <div className="marketing-page public-demo">
    <PageHeading eyebrow="Radar demonstrativo · sem cadastro · sem IA" title="Sua pergunta encontra a literatura." description="Pesquise em português ou inglês. O Radar organiza conceitos, sinônimos e MeSH e prioriza os artigos mais relevantes." />
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="mt-7 bg-white border border-line rounded-2xl p-5">
      <label className="block text-sm font-medium">O que você gostaria de pesquisar?
        <input required minLength={3} maxLength={300} value={topic} onChange={event => { setTopic(event.target.value); setTermReview(null); }} className="block w-full border rounded-card p-3 mt-2" />
      </label>
      <label className="block text-xs text-ink-soft mt-3">Idioma da busca
        <select value={language} onChange={event => { setLanguage(event.target.value); setTermReview(null); }} className="block border border-line rounded-card px-3 py-2 bg-paper mt-1"><option value="auto">Automático</option><option value="pt">Português</option><option value="en">Inglês</option></select>
      </label>
      <div className="flex flex-wrap gap-2 mt-3">{["qualidade do sono em residentes de medicina", "microplásticos em gestantes", "medical students burnout"].map(example => <button type="button" key={example} disabled={loading} onClick={() => { setTopic(example); setTermReview(null); }} className="text-xs text-teal border border-teal/20 rounded-full px-3 py-2">{example}</button>)}</div>
      <p className="text-xs text-ink-soft mt-3">A estratégia separa conceitos, combina sinônimos com OR, conceitos com AND e acrescenta MeSH quando disponível. Até três buscas concluídas por dia; uma confirmação terminológica não consome tentativa.</p>
      <button disabled={loading} className="public-button mt-4 disabled:opacity-50">{loading ? "Consultando a literatura..." : "Testar o Radar"}</button>
    </form>

    {termReview && <form onSubmit={event => { event.preventDefault(); void search(termReview.translations); }} className="mt-5 bg-amber-soft border border-amber-200 rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-amber-800 font-semibold">Confirmação necessária</p>
      <h2 className="font-display text-2xl mt-2">Um conceito ainda precisa de tradução biomédica.</h2>
      <p className="text-sm text-ink-soft mt-2">A busca não foi enviada ao PubMed e não consumiu uma tentativa. Confirme o equivalente em inglês.</p>
      {!!termReview.strategy.concepts.length && <div className="flex flex-wrap gap-2 mt-4">{termReview.strategy.concepts.map(concept => <span key={concept} className="bg-white text-teal rounded-full px-3 py-1 text-xs">✓ {concept}</span>)}</div>}
      <div className="grid sm:grid-cols-2 gap-3 mt-4">{termReview.strategy.unresolvedTerms.map(term => <label key={term} className="text-sm font-medium">{term}<input required minLength={2} maxLength={80} lang="en" value={termReview.translations[term] || ""} onChange={event => setTermReview(previous => previous ? { ...previous, translations: { ...previous.translations, [term]: event.target.value } } : previous)} placeholder={`Equivalente de “${term}” em inglês`} className="block w-full border border-amber-300 bg-white rounded-card px-3 py-2 mt-1" /></label>)}</div>
      <button disabled={loading} className="public-button mt-4 disabled:opacity-50">{loading ? "Validando..." : "Confirmar e pesquisar"}</button>
    </form>}

    {error && <p role="alert" className="mt-5 bg-amber-soft rounded-card p-4 text-sm">{error} <Link href="/cadastro" onClick={remember} className="text-teal underline">Criar conta</Link></p>}
    {loading && <p role="status" className="mt-5 text-sm">A busca pode levar alguns segundos. Estamos consultando as bases científicas.</p>}
    {result && <section className="mt-7">
      <h2 className="font-display text-3xl">{result.topic}</h2>
      <p className="text-xs text-ink-soft mt-2">Última consulta às bases: {new Date(result.generatedAt).toLocaleString("pt-BR")} · {result.remaining} tentativas restantes hoje</p>
      <div className="bg-teal-soft border border-teal/20 rounded-2xl p-5 mt-5"><p className="text-xs uppercase tracking-widest text-teal">Como o Radar entendeu</p><p className="font-medium mt-2">{result.strategy.interpreted}</p><p className="text-xs text-ink-soft mt-2">Idioma aplicado: {result.strategy.language === "pt" ? "Português → termos biomédicos em inglês" : result.strategy.language === "en" ? "Inglês" : "Sintaxe avançada"}</p><div className="flex flex-wrap gap-2 mt-3">{result.strategy.concepts.map(concept => <span key={concept} className="bg-white text-teal rounded-full px-3 py-1 text-xs">{concept}</span>)}</div>{result.strategy.warnings.map(warning => <p key={warning} className="text-xs text-ink-soft mt-3">{warning}</p>)}</div>
      <div className="grid sm:grid-cols-3 gap-4 mt-5">{[["Publicações no recorte", result.sources.pubmed.total], ["Revisões sistemáticas", result.sources.pubmed.systematicReviews], ["Ensaios clínicos", result.sources.pubmed.clinicalTrials]].map(([label, count]) => <div key={label} className="bg-white border border-line rounded-card p-4"><p className="text-3xl">{Number(count).toLocaleString("pt-BR")}</p><p className="text-xs mt-2">{label}</p></div>)}</div>
      <div className="bg-white border border-line rounded-2xl p-5 mt-5"><h3 className="font-medium">Publicações por ano completo</h3><div className="mt-4 space-y-3">{result.timeline.map(point => <div key={point.year} className="grid grid-cols-[45px_1fr_70px] gap-3 items-center text-sm"><span>{point.year}</span><div className="bg-paper rounded-full h-3"><div className="bg-teal h-3 rounded-full" style={{ width: `${point.count / Math.max(1, ...result.timeline.map(item => item.count)) * 100}%` }} /></div><span>{point.count.toLocaleString("pt-BR")}</span></div>)}</div></div>
      <h3 className="font-display text-2xl mt-7">Artigos mais relevantes</h3>
      {result.articles.map(article => <article key={article.pmid || article.doi || article.title} className="mt-4 border border-line bg-white rounded-2xl p-5"><p className="text-xs text-teal">{article.year || "Ano não informado"} · {article.journal}</p><h4 className="font-display text-xl mt-2">{article.title}</h4><p className="text-xs text-ink-soft mt-2">{article.authors.slice(0, 5).join(", ")}</p>{article.abstract && <details className="mt-3 text-sm"><summary className="text-teal cursor-pointer">Ler resumo</summary><p className="leading-relaxed mt-3 text-ink-soft whitespace-pre-wrap">{article.abstract}</p></details>}{article.pubmedUrl && <a href={article.pubmedUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-teal underline">Consultar no PubMed</a>}</article>)}
      {!result.articles.length && <p className="text-sm mt-4">Nenhum artigo com detalhes disponível neste recorte. Tente termos mais específicos ou sinônimos.</p>}
      <details className="mt-5 text-sm"><summary className="text-teal cursor-pointer">Como interpretar os resultados</summary><p className="text-ink-soft mt-3">{result.methodology}</p></details>
    </section>}
    <section className="public-cta"><div><h2 className="font-display text-3xl">Da busca ao seu projeto.</h2><p className="text-white/70 mt-3">Crie seu espaço para continuar a busca, selecionar referências, registrar a leitura e estruturar o protocolo. O tema poderá ser retomado neste navegador após o cadastro.</p></div><div className="flex flex-wrap gap-3 mt-5"><Link href="/cadastro" onClick={remember} className="bg-white text-ink rounded-card px-4 py-3">Criar minha conta</Link><Link href="/login" onClick={remember} className="border border-white/30 rounded-card px-4 py-3">Já tenho conta</Link></div></section>
  </div>;
}

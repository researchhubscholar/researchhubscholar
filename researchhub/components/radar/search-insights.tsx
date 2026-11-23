"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { intlLocale } from "@/lib/i18n/format";
import { searchLimits } from "@/lib/literature/search-limits";
import { postAI } from "@/lib/ai/client-request";
import type { AssistantOutput } from "@/lib/ai/assist";
import { validateSuggestionQuery } from "@/lib/literature/suggestion-query";
import type { Article } from "@/lib/literature/types";

const words = (value: string) => value.toLocaleLowerCase().normalize("NFKD")
  .replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];

export function useSearchTerms(query: string) {
  return useMemo(() => {
    const positive = query.split(/\bNOT\b/)[0].replace(/\[[^\]]*\]/g, " ");
    return [...new Set(words(positive))].filter(word =>
      word.length >= 4 && !["with", "from", "that", "this", "para", "como", "entre", "sobre", "the", "all"].includes(word));
  }, [query]);
}

export function ArticleSearchReason({ article, terms, source, sort, es }: {
  article: Article; terms: string[]; source: string; sort: string; es: boolean;
}) {
  const title = new Set(words(article.title));
  const abstract = new Set(words(article.abstract ?? ""));
  const inTitle = terms.filter(term => title.has(term)).slice(0, 6);
  const inAbstract = terms.filter(term => abstract.has(term) && !title.has(term)).slice(0, 6);
  const pubmed = source === "pubmed";
  return <details className="mt-3 max-w-3xl rounded-card border border-line bg-paper px-3 py-2">
    <summary className="cursor-pointer text-sm font-medium text-teal">{es ? "¿Por qué aparece este artículo?" : "Por que este artigo apareceu?"}</summary>
    <div className="mt-2 space-y-2 text-sm text-ink-soft">
      <p>{pubmed
        ? (es ? "Resultado de la búsqueda en PubMed." : "Resultado da busca no PubMed.")
        : (es ? "Resultado de la fuente consultada. Abajo se muestran coincidencias visibles con la consulta de PubMed." : "Resultado da fonte consultada. Abaixo estão as correspondências visíveis com a consulta do PubMed.")}</p>
      {pubmed && sort === "relevance" && <p>{es ? "El orden sigue la relevancia de PubMed. Su puntuación individual no está disponible aquí." : "A ordem segue a relevância do PubMed. A pontuação individual não está disponível aqui."}</p>}
      {inTitle.length > 0 && <p><strong>{es ? "Términos en el título" : "Termos no título"}</strong> · {inTitle.join(", ")}</p>}
      {inAbstract.length > 0 && <p><strong>{es ? "Términos en el resumen" : "Termos no resumo"}</strong> · {inAbstract.join(", ")}</p>}
      {inTitle.length + inAbstract.length === 0 && <p>{es ? "No se encontraron coincidencias literales en el título y el resumen disponibles." : "Nenhuma correspondência literal foi identificada no título e no resumo disponíveis."}</p>}
      {article.publicationTypes.length > 0 && <p><strong>{es ? "Tipo informado por la fuente" : "Tipo informado pela fonte"}</strong> · {article.publicationTypes.slice(0, 3).join(", ")}</p>}
      <p className="text-xs">{es ? "La elegibilidad y la calidad metodológica requieren revisión." : "Elegibilidade e qualidade metodológica exigem revisão."}</p>
    </div>
  </details>;
}

const designs = [
  ["trial", "Ensaios clínicos", "Ensayos clínicos", '"Clinical Trial"[Publication Type]'],
  ["observational", "Estudos observacionais", "Estudios observacionales", '"Observational Study"[Publication Type]'],
  ["systematic", "Revisões sistemáticas", "Revisiones sistemáticas", '"Systematic Review"[Publication Type]'],
] as const;
const literal = (value: string) => value.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

function NarrowSearch({ query, busy, es, onSearch }: {
  query: string; busy: boolean; es: boolean; onSearch: (query: string, label: string) => void;
}) {
  const [population, setPopulation] = useState("");
  const [outcome, setOutcome] = useState("");
  const [design, setDesign] = useState("");
  const clauses = [literal(population), literal(outcome)].filter(Boolean).map(term => `"${term}"[Title/Abstract]`);
  const selectedDesign = designs.find(option => option[0] === design);
  const designClause = selectedDesign?.[3];
  const label = [literal(population), literal(outcome), selectedDesign?.[es ? 2 : 1]].filter(Boolean).join(" · ");
  if (designClause) clauses.push(designClause);
  const preview = clauses.length ? `(${query}) AND ${clauses.join(" AND ")}` : "";
  return <details className="mt-4 rounded-card border border-line bg-white p-3">
    <summary className="cursor-pointer font-medium text-teal">{es ? "Ajustar manualmente" : "Ajustar manualmente"}</summary>
    <p className="mt-3 text-sm text-ink-soft">{es ? "Elige un recorte que responda a tu pregunta. Los campos son opcionales." : "Escolha um recorte que responda à sua pergunta. Os campos são opcionais."}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="min-w-0 text-sm">{es ? "Población" : "População"}<input maxLength={120} value={population} onChange={event => setPopulation(event.target.value)} placeholder={es ? "Ej.: adolescent athletes" : "Ex.: adolescent athletes"} className="mt-1 block w-full rounded-card border border-line bg-white p-2" /></label>
      <label className="min-w-0 text-sm">{es ? "Desenlace" : "Desfecho"}<input maxLength={120} value={outcome} onChange={event => setOutcome(event.target.value)} placeholder={es ? "Ej.: recurrent injury" : "Ex.: recurrent injury"} className="mt-1 block w-full rounded-card border border-line bg-white p-2" /></label>
      <label className="min-w-0 text-sm">{es ? "Diseño del estudio" : "Desenho do estudo"}<select value={design} onChange={event => setDesign(event.target.value)} className="mt-1 block w-full rounded-card border border-line bg-white p-2"><option value="">{es ? "Cualquiera" : "Qualquer desenho"}</option>{designs.map(([id, pt, spanish]) => <option key={id} value={id}>{es ? spanish : pt}</option>)}</select></label>
    </div>
    <p className="mt-2 text-xs text-ink-soft">{es ? "Usa términos en inglés para buscar literalmente en títulos y resúmenes." : "Use termos em inglês para buscar literalmente em títulos e resumos."}</p>
    {preview && <div className="mt-3 rounded-card bg-white p-3"><p className="text-sm font-medium">{es ? "Vista previa de la estrategia" : "Prévia da estratégia"}</p><p className="mt-1 break-words text-xs text-ink-soft">{preview}</p></div>}
    {preview.length > searchLimits.query && <p className="mt-2 text-sm">{es ? "La estrategia supera el límite de longitud." : "A estratégia excede o limite de tamanho."}</p>}
    <button type="button" className="mt-4 min-h-11 rounded-card bg-teal px-4 text-sm text-white disabled:opacity-50" disabled={busy || !preview || preview.length > searchLimits.query} onClick={() => onSearch(preview, label)}>{es ? "Buscar con este recorte" : "Buscar com este recorte"}</button>
  </details>;
}

type NarrowingOption = { label: string; rationale: string; clause: string; strategy: string; source?: Article };

function narrowingQuery(query: string, clause: string) {
  const checked = validateSuggestionQuery(clause);
  const tags = [...checked.matchAll(/\[([^\]]+)\]/g)].map(match => match[1].toLowerCase());
  if (!tags.length || tags.some(tag => tag !== "title/abstract" && tag !== "publication type")) throw new Error("Invalid refinement fields");
  return validateSuggestionQuery(`(${query}) AND (${checked})`);
}

export function SearchDeepening({ query, articles, period, studyType, projectId, broad, busy, es, baseline, total, activeLabel, timeline, onSearch, onReset }: {
  query: string; articles: Article[]; period: string; studyType: string; projectId: string | null;
  broad: boolean; busy: boolean; es: boolean; total: number; baseline?: number;
  activeLabel?: string; timeline: ReactNode;
  onSearch: (query: string, label?: string) => void; onReset: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<NarrowingOption[]>([]);
  const [refining, setRefining] = useState("");
  const [refineFailure, setRefineFailure] = useState("");
  const pending = useRef(false);
  const number = new Intl.NumberFormat(intlLocale(es ? "es" : "pt-BR"));

  async function suggest() {
    if (pending.current || busy) return;
    pending.current = true;
    setWorking(true);
    setMessage("");
    setSuggestions([]);
    setRefineFailure("");
    try {
      const sample = articles.filter(article => article.pmid).slice(0, 5);
      const { data } = await postAI<{ mode?: string; output?: Partial<AssistantOutput> }>("/api/ai/assist", {
        feature: "radar", projectId, context: { searchGoal: "narrow_results", query, period, studyType,
          articles: sample.map(({ pmid, title, abstract }) => ({ pmid, title, abstract: abstract?.slice(0, 600) })) },
      });
      const seen = new Set<string>();
      const proposed = data.mode === "simulation" ? [] : (data.output?.recommendations ?? []).slice(0, 3).flatMap(item => {
        if (item.targetField !== "radarNarrow" || item.confidence === "baixa") return [];
        try {
          const clause = item.content.trim();
          const strategy = narrowingQuery(query, clause);
          const key = strategy.toLowerCase().replace(/\s+/g, " ");
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ label: item.label, rationale: item.rationale, clause, strategy, source: sample.find(article => article.pmid === item.source.trim()) }];
        } catch {
          return [];
        }
      });
      setSuggestions(proposed);
      if (!proposed.length) setMessage(data.mode === "simulation"
        ? (es ? "La cuenta está en modo de simulación. Usa el ajuste manual." : "A conta está em modo de simulação. Use o ajuste manual.")
        : (es ? "No se encontró un recorte aplicable. Puedes ajustar la búsqueda manualmente." : "A IA não retornou um recorte aplicável. Você pode ajustar a busca manualmente."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (es ? "No se pudo preparar un recorte." : "Não foi possível preparar um recorte."));
    } finally {
      pending.current = false;
      setWorking(false);
    }
  }

  async function refineAndSearch(item: NarrowingOption) {
    if (pending.current || busy) return;
    pending.current = true;
    setRefining(item.strategy);
    setRefineFailure("");
    try {
      const { data } = await postAI<{ mode?: string; output?: Partial<AssistantOutput> }>("/api/ai/assist", {
        feature: "radar", projectId, context: { searchGoal: "refine_selected_cut", query, clause: item.clause },
      });
      const recommendations = data.output?.recommendations ?? [];
      const refined = recommendations[0];
      if (data.mode !== "live" || recommendations.length !== 1 || refined?.targetField !== "radarNarrow" || refined.confidence === "baixa") {
        throw new Error("Invalid refinement");
      }
      const clause = refined.content.trim();
      const fixedScope = /\[publication type\]|\bNOT\b/i;
      if ((fixedScope.test(item.clause) || fixedScope.test(clause)) && clause !== item.clause) throw new Error("Changed scope");
      onSearch(narrowingQuery(query, clause), item.label);
    } catch {
      setRefineFailure(item.strategy);
    } finally {
      pending.current = false;
      setRefining("");
    }
  }

  return <section className="grid items-start gap-4 lg:grid-cols-2">
    {timeline}
    <div className={`min-w-0 rounded-2xl border p-4 md:p-5 ${broad ? "border-teal/30 bg-teal-soft" : "border-line bg-white"}`}>
    <h2 className="font-display text-xl">{es ? "Afinar el recorte" : "Aprofunde o recorte"}</h2>
    <p className="mt-2 text-sm text-ink-soft">{es ? "La IA propone recortes a partir de la consulta y una muestra de los artículos encontrados." : "A IA sugere recortes a partir da consulta e de uma amostra dos artigos encontrados."}</p>
    <button type="button" disabled={working || busy || Boolean(refining) || !query} onClick={() => void suggest()} className="mt-3 min-h-11 rounded-card bg-teal px-4 text-sm font-medium text-white disabled:opacity-50">
      {working ? (es ? "Preparando sugerencias…" : "Preparando sugestões…") : (es ? "Afinar con IA" : "Aprofundar com IA")}
    </button>
    {message && <p role="status" className="mt-3 text-sm text-ink-soft">{message}</p>}
    <NarrowSearch query={query} busy={busy || working || Boolean(refining)} es={es} onSearch={onSearch} />
    </div>
    {suggestions.length > 0 && <section className="min-w-0 lg:col-span-2" aria-labelledby="radar-narrowing-options">
      <h2 id="radar-narrowing-options" className="font-display text-xl">{es ? "Recortes sugeridos" : "Recortes sugeridos"}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {suggestions.map(item => <li key={item.strategy} className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4">
          <h3 className="font-medium text-ink">{item.label}</h3>
          <p className="mt-2 break-words text-sm text-ink-soft">{item.rationale}</p>
          <details className="my-3">
            <summary className="cursor-pointer text-sm font-medium text-teal">{es ? "Ver detalles" : "Ver detalhes"}</summary>
            <p className="mt-2 break-words text-xs text-ink-soft">{item.strategy}</p>
            {item.source && <a className="mt-2 block break-words text-xs text-teal underline" href={`https://pubmed.ncbi.nlm.nih.gov/${item.source.pmid}/`} target="_blank" rel="noreferrer">{item.source.title}</a>}
          </details>
          <button type="button" disabled={busy || working || Boolean(refining)} onClick={() => void refineAndSearch(item)} className="mt-auto min-h-11 self-start rounded-card bg-teal-soft px-3 text-sm font-medium text-teal disabled:opacity-50">
            {refining === item.strategy ? (es ? "Refinando…" : "Refinando…") : (es ? "Refinar y buscar" : "Refinar e buscar")}
          </button>
          {refineFailure === item.strategy && <div className="mt-2 text-sm">
            <p role="status" className="text-ink-soft">{es ? "No se pudo aplicar el refinamiento de IA." : "Não foi possível aplicar o refinamento com IA."}</p>
            <button type="button" disabled={busy || working || Boolean(refining)} className="mt-1 min-h-11 text-teal underline" onClick={() => onSearch(item.strategy, item.label)}>
              {es ? "Buscar con el recorte sugerido" : "Buscar com o recorte sugerido"}
            </button>
          </div>}
        </li>)}
      </ul>
    </section>}
    {baseline !== undefined && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-teal/20 bg-teal-soft px-4 py-3 text-sm lg:col-span-2">
      <p className="min-w-0 break-words"><strong>{es ? "Recorte activo" : "Recorte ativo"}{activeLabel ? ` · ${activeLabel}` : ""}</strong> · {es ? "Resultados" : "Resultados"} {number.format(baseline)} → {number.format(total)}</p>
      <button type="button" disabled={busy || working || Boolean(refining)} className="text-teal underline" onClick={onReset}>{es ? "Volver a la búsqueda original" : "Voltar à busca original"}</button>
    </div>}
  </section>;
}

export function PublicationTimeline({ timeline, currentYear, trend, es }: {
  timeline: { year: number; count: number }[]; currentYear: number; trend: "growing" | "stable" | "declining" | "insufficient"; es: boolean;
}) {
  if (!timeline.length) return null;
  const max = Math.max(1, ...timeline.map(item => item.count));
  const total = timeline.reduce((sum, item) => sum + item.count, 0);
  const number = new Intl.NumberFormat(intlLocale(es ? "es" : "pt-BR"));
  const labels = es ? { growing: "En crecimiento", stable: "Estable", declining: "En descenso", insufficient: "Datos insuficientes" }
    : { growing: "Em crescimento", stable: "Estável", declining: "Em redução", insufficient: "Dados insuficientes" };
  const first = timeline[0], last = timeline[timeline.length - 1];
  return <section className="min-w-0 rounded-2xl border border-line bg-white p-4 md:p-5">
    <h2 className="font-display text-xl">{es ? "Publicaciones por año" : "Publicações por ano"}</h2>
    <p className="mt-2 text-sm text-ink-soft"><strong className="text-ink">{number.format(total)}</strong> {es ? "publicaciones en el gráfico" : "publicações no gráfico"} · {timeline[0].year}–{timeline.at(-1)?.year}</p>
    <p className="mt-2 text-sm"><strong>{labels[trend]}</strong>{trend !== "insufficient" && <> · {number.format(first.count)} ({first.year}) → {number.format(last.count)} ({last.year})</>}</p>
    {!timeline.some(item => item.year === currentYear) && <p className="mt-1 text-xs text-ink-soft">{es ? "Se muestran años completos." : "O gráfico mostra anos completos."}</p>}
    <ul className="mt-4 max-h-56 space-y-2 overflow-auto" aria-label={es ? "Recuento anual en PubMed" : "Contagem anual no PubMed"}>
      {timeline.map(({ year, count }) => <li key={year} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
        <span>{year}{year === currentYear && <small className="block">{es ? "En curso" : "Em andamento"}</small>}</span>
        <span aria-hidden="true" className="h-3 overflow-hidden rounded bg-teal-soft"><span className="block h-full rounded bg-teal" style={{ width: `${count / max * 100}%` }} /></span>
        <span className="tabular-nums">{number.format(count)}</span>
      </li>)}
    </ul>
  </section>;
}

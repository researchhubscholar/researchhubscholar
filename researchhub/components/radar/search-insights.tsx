"use client";

import { useMemo, useState } from "react";
import { intlLocale } from "@/lib/i18n/format";
import { searchLimits } from "@/lib/literature/search-limits";
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

export function NarrowSearch({ query, broad, busy, es, baseline, total, onSearch, onReset }: {
  query: string; broad: boolean; busy: boolean; es: boolean; total: number; baseline?: number;
  onSearch: (query: string) => void; onReset: () => void;
}) {
  const [population, setPopulation] = useState("");
  const [outcome, setOutcome] = useState("");
  const [design, setDesign] = useState("");
  const clauses = [literal(population), literal(outcome)].filter(Boolean).map(term => `"${term}"[Title/Abstract]`);
  const designClause = designs.find(option => option[0] === design)?.[3];
  if (designClause) clauses.push(designClause);
  const preview = clauses.length ? `(${query}) AND ${clauses.join(" AND ")}` : "";
  const number = new Intl.NumberFormat(es ? "es" : "pt-BR");
  return <details open={baseline !== undefined || undefined} className={`rounded-2xl border p-4 md:p-5 ${broad ? "bg-teal-soft border-teal/30" : "bg-white border-line"}`}>
    <summary className="cursor-pointer font-medium text-teal">{es ? "Afinar búsqueda" : "Aprofundar busca"}</summary>
    <p className="mt-3 text-sm text-ink-soft">{es ? "Elige un recorte que responda a tu pregunta. Los campos son opcionales." : "Escolha um recorte que responda à sua pergunta. Os campos são opcionais."}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="min-w-0 text-sm">{es ? "Población" : "População"}<input maxLength={120} value={population} onChange={event => setPopulation(event.target.value)} placeholder={es ? "Ej.: adolescent athletes" : "Ex.: adolescent athletes"} className="mt-1 block w-full rounded-card border border-line bg-white p-2" /></label>
      <label className="min-w-0 text-sm">{es ? "Desenlace" : "Desfecho"}<input maxLength={120} value={outcome} onChange={event => setOutcome(event.target.value)} placeholder={es ? "Ej.: recurrent injury" : "Ex.: recurrent injury"} className="mt-1 block w-full rounded-card border border-line bg-white p-2" /></label>
      <label className="min-w-0 text-sm">{es ? "Diseño del estudio" : "Desenho do estudo"}<select value={design} onChange={event => setDesign(event.target.value)} className="mt-1 block w-full rounded-card border border-line bg-white p-2"><option value="">{es ? "Cualquiera" : "Qualquer desenho"}</option>{designs.map(([id, pt, spanish]) => <option key={id} value={id}>{es ? spanish : pt}</option>)}</select></label>
    </div>
    <p className="mt-2 text-xs text-ink-soft">{es ? "Usa términos en inglés para buscar literalmente en títulos y resúmenes." : "Use termos em inglês para buscar literalmente em títulos e resumos."}</p>
    {preview && <div className="mt-3 rounded-card bg-white p-3"><p className="text-sm font-medium">{es ? "Vista previa de la estrategia" : "Prévia da estratégia"}</p><p className="mt-1 break-words text-xs text-ink-soft">{preview}</p></div>}
    {preview.length > searchLimits.query && <p className="mt-2 text-sm">{es ? "La estrategia supera el límite de longitud." : "A estratégia excede o limite de tamanho."}</p>}
    <button type="button" className="mt-4 min-h-11 rounded-card bg-teal px-4 text-sm text-white disabled:opacity-50" disabled={busy || !preview || preview.length > searchLimits.query} onClick={() => onSearch(preview)}>{es ? "Buscar con este recorte" : "Buscar com este recorte"}</button>
    {baseline !== undefined && <div className="mt-3 flex flex-wrap gap-3 text-sm">
      <p>{es ? "Búsqueda original" : "Busca original"} · {number.format(baseline)} → {es ? "Actual" : "Atual"} · {number.format(total)}</p>
      <button type="button" disabled={busy} className="text-teal underline" onClick={onReset}>{es ? "Volver a la búsqueda original" : "Voltar à busca original"}</button>
    </div>}
  </details>;
}

export function PublicationTimeline({ timeline, currentYear, es }: {
  timeline: { year: number; count: number }[]; currentYear: number; es: boolean;
}) {
  if (!timeline.length) return null;
  const max = Math.max(1, ...timeline.map(item => item.count));
  const total = timeline.reduce((sum, item) => sum + item.count, 0);
  const number = new Intl.NumberFormat(intlLocale(es ? "es" : "pt-BR"));
  return <section className="min-w-0 rounded-2xl border border-line bg-white p-4 md:p-5">
    <h2 className="font-display text-xl">{es ? "Publicaciones por año" : "Publicações por ano"}</h2>
    <p className="mt-2 text-sm text-ink-soft"><strong className="text-ink">{number.format(total)}</strong> {es ? "publicaciones en el gráfico" : "publicações no gráfico"} · {timeline[0].year}–{timeline.at(-1)?.year}</p>
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

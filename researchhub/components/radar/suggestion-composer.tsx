"use client";

import { useState } from "react";
import type { AssistantRecommendation } from "@/lib/ai/assist";
import { combineSuggestionQueries, validateSuggestionQuery, type SuggestionOperator } from "@/lib/literature/suggestion-query";
import { searchLimits } from "@/lib/literature/search-limits";

export default function SuggestionComposer({ recommendations, onApply }: {
  recommendations: AssistantRecommendation[]; onApply: (item: AssistantRecommendation) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [operator, setOperator] = useState<SuggestionOperator>("AND");
  const [edited, setEdited] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const eligible = recommendations.map((item, index) => item.targetField === "pubmedQuery" && item.content.trim() ? index : -1).filter(index => index >= 0);
  const chosen = recommendations.filter((_, index) => selected.includes(index));
  let query = edited ?? chosen.map(item => `(${item.content})`).join(` ${operator} `), error = "";
  try {
    if (edited === null) query = combineSuggestionQueries(chosen.map(item => item.content), operator);
    if (selected.length) validateSuggestionQuery(query);
  } catch (reason) { error = reason instanceof Error ? reason.message : "Confira a prévia antes de aplicar."; }

  function choose(indices: number[]) { setSelected(indices); setEdited(null); setMessage(""); }
  function toggle(index: number) { setSelected(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index]); setEdited(null); setMessage(""); }
  function apply() {
    if (!chosen.length || error) return;
    onApply({ label: "Busca combinada", targetField: "pubmedQuery", content: validateSuggestionQuery(query),
      rationale: `Sugestões selecionadas: ${chosen.map(item => item.label).join("; ")}.`,
      confidence: chosen.some(item => item.confidence === "baixa") ? "baixa" : chosen.some(item => item.confidence === "media") ? "media" : "alta",
      source: chosen.map(item => item.source).filter(Boolean).join("\n\n"),
    });
    setMessage("Combinação enviada ao campo de busca. Clique em Pesquisar artigos para consultar as fontes.");
  }

  return <div className="mt-3">
    {eligible.length > 0 && <div className="rounded-card border border-teal/20 bg-white p-4">
      <h3 className="font-medium">Combine as sugestões</h3>
      <p className="mt-2 text-sm text-ink-soft">Marque os cartões que se complementam e confira a busca antes de aplicar. Uma estratégia completa pode já incluir os conceitos dos outros cartões.</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => choose(eligible)} className="text-teal underline">Selecionar todas</button><button type="button" disabled={!selected.length} onClick={() => choose([])} className="text-teal underline disabled:opacity-40">Limpar seleção</button></div>
    </div>}
    <div className="grid md:grid-cols-2 gap-3 mt-3">{recommendations.map((item, index) => <article key={`${item.label}-${index}`} className={`bg-white border rounded-card p-4 min-w-0 ${selected.includes(index) ? "border-teal ring-1 ring-teal/30" : "border-line"}`}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium break-words">{item.label}</h3><span className="text-xs text-ink-soft">Confiança {item.confidence}</span></div>
      {eligible.includes(index) && <label className="mt-3 flex items-center gap-2 text-sm text-teal"><input type="checkbox" checked={selected.includes(index)} onChange={() => toggle(index)} className="accent-teal"/>Adicionar à combinação<span className="sr-only">: {item.label}</span></label>}
      <p className="text-sm whitespace-pre-wrap break-words mt-3">{item.content}</p><p className="text-xs text-ink-soft mt-3">{item.rationale}</p>
      {item.source && <details className="text-xs text-ink-soft mt-3"><summary className="cursor-pointer">Fonte usada</summary><p className="mt-2 whitespace-pre-wrap">{item.source}</p></details>}
      {eligible.includes(index) && <button type="button" onClick={() => onApply(item)} className="text-xs bg-ink text-white rounded-card px-3 py-2 mt-3">Usar somente esta sugestão</button>}
    </article>)}</div>
    {selected.length > 0 && <section aria-label="Prévia da busca combinada" className="mt-4 rounded-card border border-teal/30 bg-white p-4">
      <p className="text-sm font-medium">{selected.length} sugestão{selected.length === 1 ? " selecionada" : "s selecionadas"}</p>
      <label className="block text-sm mt-3">Como combinar os cartões<select value={operator} onChange={event => { setOperator(event.target.value as SuggestionOperator); setEdited(null); setMessage(""); }} className="block w-full border rounded-card px-3 py-2 mt-1 bg-white"><option value="AND">AND · exigir todos os conceitos</option><option value="OR">OR · aceitar qualquer conceito</option></select></label>
      <p className="text-xs text-ink-soft mt-2">AND restringe a busca à presença de todos os conceitos; OR amplia a busca. Termos listados no mesmo cartão são alternativas unidas por OR. Termos sem campo explícito são buscados em título/resumo.</p>
      <label className="block text-sm mt-4">Busca combinada editável<textarea rows={6} value={query} onChange={event => { setEdited(event.target.value); setMessage(""); }} aria-invalid={Boolean(error)} className="block w-full resize-y border rounded-card p-3 mt-1 text-sm font-mono"/></label>
      <p className="mt-1 text-xs text-ink-soft">{query.length.toLocaleString("pt-BR")} / {searchLimits.query.toLocaleString("pt-BR")} caracteres. Aplicar substitui o campo de busca e mantém os filtros de período e tipo de estudo.</p>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={Boolean(error)} onClick={apply} className="bg-teal text-white rounded-card px-4 py-2 text-sm disabled:opacity-40">Aplicar combinação</button>{edited !== null && <button type="button" onClick={() => { setEdited(null); setMessage(""); }} className="text-sm text-teal underline">Restaurar combinação automática</button>}</div>
      {message && <p role="status" className="mt-3 text-sm text-teal">{message}</p>}
    </section>}
  </div>;
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { AIRequestError, postAI, readAIUsage, type AIUsage } from "@/lib/ai/client-request";
import { isAssistantOutput } from "@/lib/ai/assist";
import type { WritingSource } from "./section-assistant";

type SourceStatus = { id: string; label: string; title: string; evidenceLevel: "licensed_full_text" | "abstract"; pmcid: string | null; license: string | null; pmid: string | null; doi: string | null };
type Suggestion = { original: string; proposed: string; sourceIds: string[]; sources: SourceStatus[];
  operationId: string; usage: AIUsage | null; simulated: boolean; warnings: string[]; anchors: {id: string; quote: string; kind: string}[] };

export default function ManuscriptDraftBeta({ content, project, projectId, sources, citationIds, apply }: {
  content: string; project: unknown; projectId: string; sources: WritingSource[];
  citationIds: string[];
  apply: (original: string, proposed: string, sourceIds: string[]) => Promise<boolean>;
}) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [operationId, setOperationId] = useState("");
  const [language, setLanguage] = useState("");
  const inFlight = useRef(false);

  async function generate() {
    if (inFlight.current) return;
    const chosen = sources.filter(a => selected.includes(a.id)).slice(0, 5).map(a => a.id);
    if (!chosen.length) { setError(es ? "Selecciona al menos una referencia." : "Selecione ao menos uma referência."); return; }
    if (content.length > 12000) { setError(es ? "La sección supera el límite de 12.000 caracteres." : "A seção excede o limite de 12.000 caracteres."); return; }
    inFlight.current = true; setBusy(true); setError(""); setSuggestion(null); setOperationId("");
    const original = content;
    try {
      // The server does not trust article details received from the browser.
      // It verifies project ownership and retrieves permitted content by ID.
      const { data } = await postAI<{ output: unknown; sources?: SourceStatus[]; operationId?: string;
        usage?: unknown; mode?: string }>("/api/ai/assist", {
        feature: "writing", projectId,
        context: { sectionKey: "introduction", heading: "Introdução", task: "draft",
          original, project, language: language || locale, sourceIds: chosen, sources: [] }
      });
      setOperationId(data.operationId || "");
      if (!isAssistantOutput(data.output) || data.output.recommendations.length !== 1
        || data.output.recommendations[0].targetField !== "introduction") {
        throw new Error(es ? "El borrador no tiene un formato válido." : "O rascunho não retornou em formato válido.");
      }
      const verified = data.sources || [];
      if (data.mode !== "simulation" && (verified.length !== chosen.length
        || verified.some((row, i) => row.id !== chosen[i]))) {
        throw new Error("Não foi possível conferir a proveniência das fontes.");
      }
      const merged = [...citationIds];
      chosen.forEach(id => { if (!merged.includes(id)) merged.push(id); });
      let missing = false;
      const proposed = data.output.recommendations[0].content.replace(/\[S(\d+)\]/g, (_match, number: string) => {
        const id = chosen[Number(number) - 1];
        if (!id) { missing = true; return "[A conferir]"; }
        return `[${merged.indexOf(id) + 1}]`;
      });
      if (missing || (data.mode !== "simulation" && proposed === data.output.recommendations[0].content)) {
        throw new Error("As citações do rascunho não puderam ser vinculadas às referências.");
      }
      let anchors: {id: string; quote: string; kind: string}[] = [];
      if (data.mode !== "simulation") {
        const parsed = JSON.parse(data.output.recommendations[0].source) as {anchors?:unknown};
        if (!Array.isArray(parsed.anchors)) throw new Error("A resposta não contém as evidências de suporte.");
        anchors = parsed.anchors.filter((anchor): anchor is {id:string;quote:string;kind:string} =>
          anchor !== null && typeof anchor === "object" && typeof anchor.id === "string" &&
          typeof anchor.quote === "string" && typeof anchor.kind === "string");
        if (anchors.length !== parsed.anchors.length) throw new Error("Não foi possível validar os trechos das fontes.");
      }
      setSuggestion({ original, proposed, sourceIds: chosen, sources: verified,
        anchors, warnings: data.output.warnings, operationId: data.operationId || "", usage: readAIUsage(data.usage), simulated: data.mode === "simulation" });
    } catch (e) {
      if (e instanceof AIRequestError) setOperationId(e.operationId);
      setError(e instanceof Error ? e.message : "Não foi possível preparar o rascunho.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function accept() {
    if (!suggestion || inFlight.current || suggestion.simulated) return;
    if (content !== suggestion.original) { setError("A introdução mudou. Gere uma nova prévia antes de inserir."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (!await apply(suggestion.original, suggestion.proposed, suggestion.sourceIds))
        throw new Error("Não foi possível preservar o histórico. O manuscrito não foi alterado.");
      setSuggestion(null);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao inserir rascunho."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="mt-5 rounded-card border border-teal/30 bg-teal-soft/40 p-4" aria-label="Escrever com IA Beta">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-teal">ResearchHub · Beta</p>
        <h3 className="text-base font-medium mt-1">{es ? "Redactar introducción con IA" : "Escrever introdução com IA"}</h3>
        <p className="text-xs text-ink-soft mt-1">{es ? "Borrador basado en referencias verificadas, siempre sujeto a revisión." :
          "Primeira versão fundamentada em artigos do projeto. Revisão humana obrigatória."}</p>
      </div>
      <button type="button" onClick={() => setOpen(x => !x)}
        className="rounded-card bg-teal text-white px-4 py-2 text-sm">
        {open ? (es ? "Cerrar" : "Fechar") : (es ? "Escribir con IA · Beta" : "Escrever com IA · Beta")}
      </button>
    </div>
    {open && <div className="mt-5 space-y-4">
      <p className="text-sm">{es ? "Selecciona de 1 a 5 artículos vinculados al proyecto:" :
        "Selecione de 1 a 5 artigos vinculados ao projeto:"}</p>
      <div className="grid gap-2">
        {sources.map(article => <label key={article.id} className="flex items-start gap-2 rounded-card bg-white border border-line p-3 text-sm">
          <input type="checkbox" className="mt-1" disabled={busy || (!selected.includes(article.id) && selected.length >= 5)}
            checked={selected.includes(article.id)}
            onChange={() => { setSuggestion(null); setSelected(list => list.includes(article.id)
              ? list.filter(id => id !== article.id) : [...list, article.id]); }} />
          <span className="min-w-0">{article.title}<span className="block text-xs text-ink-soft">
            {article.pmid ? `PMID: ${article.pmid}` : article.doi ? `DOI: ${article.doi}` : "Sem identificador"}
            {" · "}{article.abstract ? (es ? "Resumen disponible" : "Resumo disponível") : (es ? "Sin resumen" : "Sem resumo")}
          </span></span>
        </label>)}
        {!sources.length && <p className="text-sm text-ink-soft">{es ? "Primero vincula artículos a este proyecto en la Biblioteca." :
          "Vincule artigos a este projeto pela Biblioteca para começar."}</p>}
      </div>
      <label className="block text-sm">{es ? "Idioma" : "Idioma do rascunho"}
        <select className="block mt-1 rounded-card border border-line bg-white p-2" value={language}
          onChange={e => setLanguage(e.target.value)} disabled={busy}>
          <option value="">{es ? "Idioma del sistema" : "Idioma do sistema"}</option>
          <option value="pt-BR">Português</option><option value="es">Español</option><option value="en">English</option>
        </select>
      </label>
      <p className="text-xs text-ink-soft">{es
        ? "El sistema busca texto completo abierto con licencia compatible. Si no está disponible, usa solamente el resumen. Nunca inventa resultados."
        : "O ResearchHub procura texto completo em acesso aberto com licença compatível. Se não encontrar, usa o resumo. Não inventa resultados do seu estudo."}</p>
      <button type="button" disabled={busy || !selected.length}
        onClick={() => void generate()} className="rounded-card bg-ink text-white px-5 py-3 text-sm disabled:opacity-50">
        {busy ? (es ? "Procesando fuentes y escribiendo…" : "Analisando fontes e escrevendo…") :
          (es ? "Preparar borrador" : "Preparar rascunho")}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}
        {operationId && <Link href={`/geracoes/${operationId}`} className="ml-2 underline">Ver registro</Link>}
      </p>}
      {suggestion && <div className="rounded-card border border-line bg-white p-4 space-y-4">
        <p className="font-medium">{es ? "Borrador para revisión" : "Rascunho para revisão"}</p>
        <p className="text-xs text-ink-soft">{es
          ? "Las citas numeradas siguen las referencias del manuscrito. Verifica cada afirmación antes de usarla."
          : "As citações numéricas seguem as referências do manuscrito. Confira cada afirmação antes de utilizá-la."}</p>
        <textarea rows={14} className="w-full rounded-card border border-line p-3 text-sm"
          value={suggestion.proposed} disabled={busy || suggestion.simulated}
          onChange={e => setSuggestion(s => s ? { ...s, proposed: e.target.value } : s)} />
        <div className="space-y-1">
          <p className="text-sm font-medium">Referências do manuscrito e material consultado</p>
          <p className="text-xs text-ink-soft">Os números refletem a bibliografia já vinculada ao manuscrito; a ordem pode diferir da seleção de artigos acima.</p>
          {suggestion.sources.map(s => <p className="text-xs text-ink-soft" key={s.id}>
            [{citationIds.includes(s.id) ? citationIds.indexOf(s.id) + 1 : citationIds.length + suggestion.sourceIds.filter(id => !citationIds.includes(id)).indexOf(s.id) + 1}] · {s.title} {s.pmid && /^\d+$/.test(s.pmid) && <a className="underline text-teal" href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`} target="_blank" rel="noopener noreferrer">PMID {s.pmid}</a>} — {s.evidenceLevel === "licensed_full_text" ?
              `trechos do texto completo permitido (${s.license || "licença"})` : "apenas resumo científico"}
          </p>)}
        </div>
        {suggestion.warnings.length > 0 && <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{es ? "Aspectos que requieren revisión" : "Pontos para confirmar antes de utilizar"}</p>
          <ul className="list-disc pl-5 text-xs text-amber-950 mt-2 space-y-1">
            {suggestion.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </div>}
        {suggestion.anchors.length > 0 && <details className="rounded-card border border-line p-3">
          <summary className="text-sm cursor-pointer text-teal">Ver trechos que sustentam cada citação</summary>
          <p className="mt-2 text-xs text-ink-soft">Os trechos foram conferidos literalmente na fonte. A interpretação de cada afirmação ainda precisa de revisão científica.</p>
          <div className="mt-3 space-y-2">{suggestion.anchors.map((anchor, i) => {
            const source = suggestion.sources.find(s => s.label === anchor.id);
            return <div key={i} className="border-t border-line pt-2">
              <p className="text-xs font-medium">{i + 1}. {source?.title || anchor.id} · {anchor.kind === "abstract" ? "Resumo" : "Trecho de texto completo"}</p>
              <p className="text-xs text-ink-soft mt-1">“{anchor.quote}”</p>
            </div>;
          })}</div>
        </details>}
        <p className="text-xs text-ink-soft">{suggestion.usage
          ? `${(suggestion.usage.inputTokens + suggestion.usage.outputTokens).toLocaleString("pt-BR")} tokens consumidos`
          : "Consulte o registro da geração para verificar o consumo."}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void accept()}
            disabled={busy || suggestion.simulated || !suggestion.proposed.trim() || content !== suggestion.original}
            className="rounded-card bg-teal text-white px-4 py-2 text-sm disabled:opacity-50">
            {es ? "Insertar en el manuscrito" : "Inserir no manuscrito"}
          </button>
          <button type="button" disabled={busy} onClick={() => setSuggestion(null)}
            className="text-sm text-teal underline">{es ? "Descartar" : "Descartar"}</button>
          {suggestion.operationId && <Link href={`/geracoes/${suggestion.operationId}`}
            className="text-xs text-teal underline self-center">Ver geração</Link>}
        </div>
      </div>}
    </div>}
  </section>;
}

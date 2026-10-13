"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { isAssistantOutput, type AssistantOutput } from "@/lib/ai/assist";

export type WritingSource = { id: string; title: string; pmid: string | null; doi: string | null; abstract?: string | null; evidence?: Record<string, unknown> | null };
type Suggestion = { original: string; proposed: string; output: AssistantOutput; operationId: string; tokens: number; simulation: boolean };

export default function SectionAssistant({ sectionKey, heading, content, projectId, project, sources, apply }: {
  sectionKey: string; heading: string; content: string; projectId: string; project: unknown;
  sources: WritingSource[]; apply: (original: string, proposed: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("revise");
  const [language, setLanguage] = useState("pt-BR");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  async function run() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuggestion(null);
    const original = content;
    try {
      const response = await fetch("/api/ai/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature: "writing", projectId, context: { sectionKey, heading, task, language, original: original.slice(0, 12000), project, sources: sources.filter(source => sourceIds.includes(source.id)).slice(0, 5).map(source => ({ ...source, abstract: source.abstract?.slice(0, 1800) })) } }) });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error("A análise foi interrompida. Tente novamente."); }
      if (!response.ok) throw new Error(data.error || "Não foi possível revisar esta seção.");
      if (!isAssistantOutput(data.output)) throw new Error("A resposta não contém uma revisão válida.");
      const output: AssistantOutput = data.output;
      const recommendation = output.recommendations.find(item => item.targetField === sectionKey);
      if (!recommendation && data.mode !== "simulation") throw new Error("A IA não devolveu o texto desta seção. Tente novamente.");
      setSuggestion({ original, proposed: recommendation?.content || "", output, operationId: data.operationId || "", tokens: (data.usage?.inputTokens || 0) + (data.usage?.outputTokens || 0), simulation: data.mode === "simulation" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function accept() {
    if (!suggestion || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (content !== suggestion.original) throw new Error("O texto mudou após a análise. Descarte esta sugestão e analise a versão atual.");
      if (!await apply(suggestion.original, suggestion.proposed)) throw new Error("Não foi possível preservar a versão anterior. A sugestão não foi aplicada.");
      setSuggestion(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível aplicar."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-5 rounded-card border border-teal/20 bg-teal-soft/40 p-4"><button type="button" onClick={() => setOpen(value => !value)} className="text-sm font-medium text-teal">{open ? "Recolher assistência de IA" : `Trabalhar ${heading.toLowerCase()} com IA`}</button>{open && <div className="mt-4 space-y-4"><div className="flex flex-wrap gap-3"><label className="text-xs">Operação<select disabled={busy} value={task} onChange={event => setTask(event.target.value)} className="block mt-1 border border-line rounded-card p-2 bg-white"><option value="structure">Estruturar seção</option><option value="revise">Revisar coerência científica</option><option value="improve">Melhorar clareza e redação</option></select></label><label className="text-xs">Idioma<select disabled={busy} value={language} onChange={event => setLanguage(event.target.value)} className="block mt-1 border border-line rounded-card p-2 bg-white"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option></select></label></div><details><summary className="text-xs text-teal cursor-pointer">Escolher fontes do projeto · até 5</summary><div className="mt-3 space-y-2">{sources.map(source => <label key={source.id} className="flex gap-2 text-xs"><input type="checkbox" disabled={busy || (!sourceIds.includes(source.id) && sourceIds.length >= 5)} checked={sourceIds.includes(source.id)} onChange={() => setSourceIds(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])}/><span>{source.title}<span className="block text-ink-soft">{source.abstract ? "Resumo disponível" : "Sem resumo"}{source.evidence ? " · matriz disponível" : ""}</span></span></label>)}{!sources.length && <p className="text-xs text-ink-soft">Vincule artigos na biblioteca para usar literatura como contexto.</p>}</div></details><p className="text-xs text-ink-soft">Até 10.000 tokens por operação. O protocolo e as fontes selecionadas serão enviados para análise. Trechos acima de 12.000 caracteres usam apenas o início.</p><button type="button" onClick={() => void run()} disabled={busy} className="bg-teal text-white rounded-card px-4 py-2 text-sm disabled:opacity-50">{busy ? "Aguarde…" : "Gerar sugestão para esta seção"}</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{suggestion && <div className="space-y-4"><p className="text-sm text-ink-soft">{suggestion.output.summary}</p><div className="grid md:grid-cols-2 gap-4"><div><p className="text-xs font-medium mb-2">Original analisado</p><p className="whitespace-pre-wrap rounded-card bg-white border border-line p-3 text-sm max-h-96 overflow-y-auto">{suggestion.original || "Seção vazia"}</p></div><label className="text-xs font-medium">Sugestão · você pode editar<textarea disabled={busy || suggestion.simulation} rows={12} value={suggestion.proposed} onChange={event => setSuggestion(current => current ? { ...current, proposed: event.target.value } : current)} className="block w-full mt-2 border border-line rounded-card p-3 text-sm font-normal bg-white"/></label></div><details><summary className="text-xs text-teal cursor-pointer">Justificativas e fontes usadas</summary>{suggestion.output.recommendations.map((item, index) => <p key={index} className="text-xs text-ink-soft mt-3 whitespace-pre-wrap">{item.rationale}\nFonte: {item.source}</p>)}</details>{suggestion.output.warnings.map(warning => <p key={warning} className="text-xs bg-amber-soft p-3 rounded-card">{warning}</p>)}<p className="text-xs text-ink-soft">{suggestion.output.caution}</p><p className="text-xs text-ink-soft">Consumo real: {suggestion.tokens.toLocaleString("pt-BR")} tokens.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy || suggestion.simulation || !suggestion.proposed.trim() || content !== suggestion.original} onClick={() => void accept()} className="bg-ink text-white rounded-card px-4 py-2 text-sm disabled:opacity-50">Preservar versão e aplicar</button><button type="button" disabled={busy} onClick={() => { setSuggestion(null); setError(""); }} className="text-sm text-teal underline">Descartar</button>{suggestion.operationId && <Link href={`/geracoes/${suggestion.operationId}`} className="text-xs text-teal underline self-center">Registro, consumo e avaliação</Link>}</div>{content !== suggestion.original && <p className="text-xs text-amber-900">O texto atual mudou. Faça uma nova análise antes de aplicar.</p>}</div>}</div>}</div>;
}

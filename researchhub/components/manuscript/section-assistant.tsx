"use client";
import { intlLocale } from "@/lib/i18n/format";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";

import AILoadingDialog from "@/components/ai/loading-dialog";

import { useRef, useState } from "react";
import Link from "next/link";
import { AIRequestError, postAI, readAIUsage, type AIUsage } from "@/lib/ai/client-request";
import { isAssistantOutput, type AssistantOutput } from "@/lib/ai/assist";

export type WritingSource = { id: string; title: string; pmid: string | null; doi: string | null; abstract?: string | null; evidence?: Record<string, unknown> | null };
type Suggestion = { original: string; proposed: string; output: AssistantOutput; operationId: string; usage: AIUsage | null; elapsedMs: number; simulation: boolean };

export default function SectionAssistant({ sectionKey, heading, content, projectId, project, sources, apply }: {
  sectionKey: string; heading: string; content: string; projectId: string; project: unknown;
  sources: WritingSource[]; apply: (original: string, proposed: string) => Promise<boolean>;
}) {
 const {locale:formatLocale}=useLanguage();

  const { t: uiText, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("revise");
  const [selectedLanguage, setLanguage] = useState("");
  const language = selectedLanguage || locale;
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [operationId, setOperationId] = useState("");
  async function run() {
    if (lock.current) return;
    if (content.length > 12000) { setOperationId(""); setError("Esta seção excede 12.000 caracteres. Reduza o texto antes da análise para que a IA receba a seção completa. Nenhuma solicitação foi enviada."); return; }
    lock.current = true; setBusy(true); setThinking(true); setError(""); setSuggestion(null); setOperationId("");
    const original = content;
    try {
      const { data, elapsedMs } = await postAI<{ output: unknown; operationId?: string; mode?: string; usage?: unknown }>("/api/ai/assist", { feature: "writing", projectId, context: { sectionKey, heading, task, language, original, project, sources: sources.filter(source => sourceIds.includes(source.id)).slice(0, 5).map(source => ({ ...source, abstract: source.abstract?.slice(0, 1800) })) } });
      setOperationId(data.operationId || "");
      if (!isAssistantOutput(data.output)) throw new Error("A resposta não contém uma revisão válida.");
      const output: AssistantOutput = data.output;
      const recommendation = output.recommendations.find(item => item.targetField === sectionKey);
      if (!recommendation && data.mode !== "simulation") throw new Error("A IA não devolveu o texto desta seção. Tente novamente.");
      setSuggestion({ original, proposed: recommendation?.content || "", output, operationId: data.operationId || "", usage: readAIUsage(data.usage), elapsedMs, simulation: data.mode === "simulation" });
    } catch (caught) { if (caught instanceof AIRequestError) setOperationId(caught.operationId); setError(caught instanceof Error ? caught.message : "Não foi possível concluir."); }
    finally { lock.current = false; setBusy(false); setThinking(false); }
  }
  async function accept() {
    if (!suggestion || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (content !== suggestion.original) throw new Error("O texto mudou após a análise. Descarte esta sugestão e analise a versão atual.");
      if (!await apply(suggestion.original, suggestion.proposed)) throw new Error("Não foi possível preservar a versão anterior. A sugestão não foi aplicada.");
      setSuggestion(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível aplicar."); }
    finally { lock.current = false; setBusy(false); setThinking(false); }
  }
  return <div className="mt-5 rounded-card border border-teal/20 bg-teal-soft/40 p-4"><AILoadingDialog open={thinking} title={`Trabalhando ${heading.toLowerCase()} com IA`} description={uiText("screen.7175febeb709")} /><button type="button" onClick={() => setOpen(value => !value)} className="text-sm font-medium text-teal">{open ? uiText("screen.b6bdf03b7afd") : `Trabalhar ${heading.toLowerCase()} com IA`}</button>{open && <div className="mt-4 space-y-4"><div className="flex flex-wrap gap-3"><label className="text-xs"><InterfaceText message="screen.40e49271ddad" /><select disabled={busy} value={task} onChange={event => setTask(event.target.value)} className="block mt-1 border border-line rounded-card p-2 bg-white"><option value="structure"><InterfaceText message="screen.8de07912cb8e" /></option><option value="revise"><InterfaceText message="screen.211b7a03fa3f" /></option><option value="improve"><InterfaceText message="screen.4a81b1c536a1" /></option></select></label><label className="text-xs">Idioma<select disabled={busy} value={selectedLanguage} onChange={event => setLanguage(event.target.value)} className="block mt-1 border border-line rounded-card p-2 bg-white"><option value=""><AuthoredText text="Idioma do sistema" /></option><option value="es" lang="es"><AuthoredText text="Español" /></option><option value="pt-BR"><InterfaceText message="screen.25c0623b1a61" /></option><option value="en">English</option></select></label></div><details><summary className="text-xs text-teal cursor-pointer"><InterfaceText message="screen.ff062c6f63ab" /></summary><div className="mt-3 space-y-2">{sources.map(source => <label key={source.id} className="flex gap-2 text-xs"><input type="checkbox" disabled={busy || (!sourceIds.includes(source.id) && sourceIds.length >= 5)} checked={sourceIds.includes(source.id)} onChange={() => setSourceIds(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])}/><span>{source.title}<span className="block text-ink-soft">{source.abstract ? uiText("screen.640caa6af9f4") : "Sem resumo"}{source.evidence ? uiText("screen.d5fe0151b9d3") : ""}</span></span></label>)}{!sources.length && <p className="text-xs text-ink-soft"><InterfaceText message="screen.984402d0ed3e" /></p>}</div></details><p className="text-xs text-ink-soft"><InterfaceText message="screen.eb436b89e5a9" /></p><button type="button" onClick={() => void run()} disabled={busy} className="bg-teal text-white rounded-card px-4 py-2 text-sm disabled:opacity-50">{busy ? "Aguarde…" : uiText("screen.96a0defcba37")}</button>{error && <div role="alert"><p className="text-sm text-red-700"><AuthoredText text={error} /></p>{operationId && <Link href={`/geracoes/${operationId}`} className="text-xs text-teal underline"><InterfaceText message="screen.14127fbe5557" /></Link>}</div>}{suggestion && <div className="space-y-4"><p className="text-sm text-ink-soft">{suggestion.output.summary}</p><div className="grid md:grid-cols-2 gap-4"><div><p className="text-xs font-medium mb-2"><InterfaceText message="screen.02ec9e76fdd7" /></p><p className="whitespace-pre-wrap rounded-card bg-white border border-line p-3 text-sm max-h-96 overflow-y-auto">{suggestion.original || uiText("screen.5843ceefee47")}</p></div><label className="text-xs font-medium"><InterfaceText message="screen.a8675ebbcce4" /><textarea disabled={busy || suggestion.simulation} rows={12} value={suggestion.proposed} onChange={event => setSuggestion(current => current ? { ...current, proposed: event.target.value } : current)} className="block w-full mt-2 border border-line rounded-card p-3 text-sm font-normal bg-white"/></label></div><details><summary className="text-xs text-teal cursor-pointer"><InterfaceText message="screen.5fd67cd732e8" /></summary>{suggestion.output.recommendations.map((item, index) => <p key={index} className="text-xs text-ink-soft mt-3 whitespace-pre-wrap">{item.rationale}{"\n"}<InterfaceText message="screen.0dd6da8d793f" /> {item.source}</p>)}</details>{suggestion.output.warnings.map(warning => <p key={warning} className="text-xs bg-amber-soft p-3 rounded-card"><AuthoredText text={warning} /></p>)}<p className="text-xs text-ink-soft">{suggestion.output.caution}</p><p className="text-xs text-ink-soft">{suggestion.simulation ? uiText("screen.99d4b662f2be") : "Consumo registrado"}: {suggestion.usage ? `${(suggestion.usage.inputTokens + suggestion.usage.outputTokens).toLocaleString(intlLocale(formatLocale))} tokens` : uiText("screen.7930bde5fc19")}<InterfaceText message="screen.6458b37d4a4f" /> {Math.max(1, Math.round(suggestion.elapsedMs / 1000))} s.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy || suggestion.simulation || !suggestion.proposed.trim() || content !== suggestion.original} onClick={() => void accept()} className="bg-ink text-white rounded-card px-4 py-2 text-sm disabled:opacity-50"><InterfaceText message="screen.aa160596aada" /></button><button type="button" disabled={busy} onClick={() => { setSuggestion(null); setError(""); }} className="text-sm text-teal underline">Descartar</button>{suggestion.operationId && <Link href={`/geracoes/${suggestion.operationId}`} className="text-xs text-teal underline self-center"><InterfaceText message="screen.27db94b3f7a3" /></Link>}</div>{content !== suggestion.original && <p className="text-xs text-amber-900"><InterfaceText message="screen.c21492af5260" /></p>}</div>}</div>}</div>;
}

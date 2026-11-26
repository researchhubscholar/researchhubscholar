"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { postAI, AIRequestError, readAIUsage, type AIUsage } from "@/lib/ai/client-request";
import { isAssistantOutput } from "@/lib/ai/assist";
import type { BetaSection } from "@/lib/ai/manuscript-section-rules";

const descriptions: Record<string, string> = {
  methods: "Estrutura o método a partir do protocolo salvo, sem afirmar que o estudo já foi executado.",
  results: "Trabalha somente com resultados previamente registrados; sem dados, oferece campos para completar.",
  limitations: "Propõe potenciais limitações metodológicas, separando riscos de limitações verificadas.",
  conclusion: "Redige uma síntese restrita aos resultados efetivamente registrados no manuscrito.",
  abstract: "Sintetiza as cinco seções científicas que já foram concluídas e salvas."
};
type Suggestion = {
  original: string; proposed: string; warnings: string[]; usage: AIUsage | null;
  operationId: string; simulated: boolean;
};

export default function ManuscriptSectionDraftBeta({
  sectionKey, heading, content, projectId, apply
}: {
  sectionKey: BetaSection; heading: string; content: string; projectId: string;
  apply: (original: string, proposed: string) => Promise<boolean>;
}) {
  const {locale} = useLanguage();
  const es = locale === "es";
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [language,setLanguage] = useState("");
  const [acknowledged,setAcknowledged] = useState(false);
  const [error,setError] = useState("");
  const [operationId,setOperationId] = useState("");
  const [suggestion,setSuggestion] = useState<Suggestion|null>(null);
  const inFlight = useRef(false);
  const checkResearchData = ["results","conclusion","abstract"].includes(sectionKey);

  async function generate() {
    if (inFlight.current) return;
    if (checkResearchData && !acknowledged) {
      setError(es ? "Confirma que has revisado los datos del manuscrito." : "Confirme que os dados do manuscrito foram revisados.");
      return;
    }
    inFlight.current=true;setBusy(true);setError("");setSuggestion(null);setOperationId("");
    const original=content;
    try {
      const {data} = await postAI<{output:unknown;operationId?:string;usage?:unknown;mode?:string}>("/api/ai/assist", {
        feature:"writing",projectId,context:{sectionKey,heading,task:"section_draft",
          original,language:language||locale,sources:[]}
      });
      setOperationId(data.operationId||"");
      if (data.mode === "simulation") throw new Error("Uma licença de IA ativa é necessária para preparar o rascunho científico.");
      if (!isAssistantOutput(data.output) || data.output.recommendations.length!==1
        || data.output.recommendations[0].targetField!==sectionKey) {
        throw new Error("O rascunho não corresponde à seção solicitada.");
      }
      setSuggestion({original,proposed:data.output.recommendations[0].content,
        warnings:data.output.warnings,usage:readAIUsage(data.usage),
        operationId:data.operationId||"",simulated:false});
    } catch (cause) {
      if (cause instanceof AIRequestError) setOperationId(cause.operationId);
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar o texto.");
    } finally {inFlight.current=false;setBusy(false);}
  }

  async function accept() {
    if (!suggestion || inFlight.current || suggestion.simulated) return;
    if (content!==suggestion.original) {setError("A seção mudou. Gere uma nova prévia.");return;}
    inFlight.current=true;setBusy(true);setError("");
    try {
      if (!await apply(suggestion.original,suggestion.proposed)) {
        throw new Error("Não foi possível preservar o histórico. O texto não foi alterado.");
      }
      setSuggestion(null);setOpen(false);
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Falha ao inserir o texto.");}
    finally {inFlight.current=false;setBusy(false);}
  }

  return <section className="mt-5 rounded-card border border-teal/30 bg-teal-soft/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-teal">ResearchHub · Beta</p>
        <h3 className="text-base font-medium mt-1">{es?"Escribir con IA":"Escrever com IA"} · {heading}</h3>
        <p className="text-xs text-ink-soft mt-1">{descriptions[sectionKey]}</p>
      </div>
      <button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-card bg-teal text-white px-4 py-2 text-sm">
        {open?(es?"Cerrar":"Fechar"):(es?"Escribir con IA · Beta":"Escrever com IA · Beta")}
      </button>
    </div>
    {open && <div className="mt-4 space-y-4">
      <p className="text-xs text-ink-soft">
        {es?"Se utiliza el protocolo y las secciones guardadas en ResearchHub. No se inventan procedimientos ni resultados.":
          "O texto utiliza o protocolo e as seções salvas no ResearchHub. Procedimentos e resultados não registrados não serão inventados."}
      </p>
      {["discussion","conclusion","abstract"].includes(sectionKey) && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-card p-3">
        Salve as seções anteriores antes de gerar este texto. O ResearchHub usa o conteúdo salvo, não alterações ainda em edição.
      </p>}
      <label className="block text-sm">{es?"Idioma":"Idioma do texto"}
        <select value={language} onChange={e=>setLanguage(e.target.value)}
          disabled={busy} className="block mt-1 rounded-card border border-line bg-white p-2">
          <option value="">{es?"Idioma del sistema":"Idioma do sistema"}</option>
          <option value="pt-BR">Português</option><option value="es">Español</option><option value="en">English</option>
        </select>
      </label>
      {checkResearchData && <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" className="mt-0.5" checked={acknowledged} disabled={busy}
          onChange={e=>setAcknowledged(e.target.checked)} />
        <span>Confirmo que os dados já salvos são meus dados de pesquisa ou informações revisadas, e que conferirei toda afirmação antes de utilizar o texto.</span>
      </label>}
      <button type="button" disabled={busy||(checkResearchData&&!acknowledged)}
        onClick={()=>void generate()} className="rounded-card bg-ink px-5 py-3 text-sm text-white disabled:opacity-50">
        {busy?(es?"Preparando el texto…":"Preparando o texto…"):(es?"Preparar borrador":"Preparar rascunho")}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}
        {operationId&&<Link href={"/geracoes/"+operationId} className="underline ml-2">Ver geração</Link>}
      </p>}
      {suggestion && <div className="rounded-card border border-line bg-white p-4 space-y-3">
        <p className="text-sm font-medium">{es?"Vista previa revisable":"Prévia para revisão"}</p>
        <textarea rows={12} value={suggestion.proposed} disabled={busy}
          onChange={e=>setSuggestion(v=>v?{...v,proposed:e.target.value}:v)}
          className="w-full rounded-card border border-line p-3 text-sm leading-relaxed" />
        {suggestion.warnings.length>0 && <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">Pontos para conferir</p>
          <ul className="list-disc pl-5 text-xs text-amber-950 mt-2 space-y-1">
            {suggestion.warnings.map((w,i)=><li key={i}>{w}</li>)}
          </ul>
        </div>}
        <p className="text-xs text-ink-soft">{suggestion.usage
          ? (suggestion.usage.inputTokens+suggestion.usage.outputTokens).toLocaleString("pt-BR")+" tokens consumidos"
          : "Consulte a geração para verificar os tokens."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy||!suggestion.proposed.trim()||content!==suggestion.original}
            onClick={()=>void accept()} className="rounded-card bg-teal text-white px-4 py-2 text-sm disabled:opacity-50">
            {es?"Insertar en el manuscrito":"Inserir no manuscrito"}
          </button>
          <button type="button" disabled={busy} onClick={()=>setSuggestion(null)}
            className="text-sm text-teal underline">{es?"Descartar":"Descartar"}</button>
          {suggestion.operationId&&<Link href={"/geracoes/"+suggestion.operationId}
            className="text-xs text-teal underline self-center">Ver geração</Link>}
        </div>
      </div>}
    </div>}
  </section>;
}

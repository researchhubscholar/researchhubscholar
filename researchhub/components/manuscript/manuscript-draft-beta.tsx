"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { AIRequestError, postAI, readAIUsage, type AIUsage } from "@/lib/ai/client-request";
import { isAssistantOutput } from "@/lib/ai/assist";
import type { WritingSource } from "./section-assistant";

type SourceStatus = { id: string; label: string; title: string; evidenceLevel: "licensed_full_text" | "abstract"; pmcid: string | null; license: string | null; pmid: string | null; doi: string | null };
type Suggestion = { original: string; proposed: string; sourceIds: string[]; sources: SourceStatus[];
  operationId: string; usage: AIUsage | null; simulated: boolean; warnings: string[]; considered: number; relevant: number; anchors: {id: string; quote: string; kind: string}[] };

export default function ManuscriptDraftBeta({ content, project, projectId, sources, citationIds, apply }: {
  content: string; project: unknown; projectId: string; sources: WritingSource[];
  citationIds: string[];
  apply: (original: string, proposed: string, sourceIds: string[]) => Promise<boolean>;
}) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [largeApproved, setLargeApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [operationId, setOperationId] = useState("");
  const [language, setLanguage] = useState("");
  const inFlight = useRef(false);
  const stopRequested = useRef(false);
  const [filter, setFilter] = useState("");
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const checkpointKey = "rh-draft-beta-batches:" + projectId;
  useEffect(() => {
    try {
      const state = JSON.parse(sessionStorage.getItem(checkpointKey) || "null") as
        {selected?: string[]; original?: string} | null;
      if (state?.selected && state.original === content) {
        const available = new Set(sources.map(s => s.id));
        setSelected(state.selected.filter(id => available.has(id)));
      }
    } catch { /* Storage is optional; draft must still work. */ }
  }, [checkpointKey, content, sources]);
  const visible = sources.filter(source => source.title.toLowerCase().includes(filter.toLowerCase()));

  async function generate() {
    if (inFlight.current) return;
    const chosen = sources.filter(article => selected.includes(article.id)).map(article => article.id);
    if (!chosen.length) { setError(es ? "Selecciona referencias para analizar." : "Selecione artigos para analisar."); return; }
    if (content.length > 12000) { setError("A introdução atual excede 12.000 caracteres."); return; }
    inFlight.current = true; stopRequested.current = false; setBusy(true); setError("");
    setSuggestion(null); setOperationId(""); setProgress({done:0,total:chosen.length});
    const original = content;
    try {
      let batchIds: string[] = [];
      try {
        const checkpoint = JSON.parse(sessionStorage.getItem(checkpointKey) || "null") as
          {selected?:string[];original?:string;batchIds?:string[]}|null;
        if (checkpoint && JSON.stringify(checkpoint.selected) === JSON.stringify(chosen)
          && checkpoint.original === original && Array.isArray(checkpoint.batchIds)) {
          batchIds = checkpoint.batchIds.filter(id => /^[0-9a-f-]{36}$/i.test(id));
        }
      } catch { /* Resume is optional. */ }
      setProgress({done:Math.min(batchIds.length*5,chosen.length),total:chosen.length});
      for (let i=batchIds.length*5; i<chosen.length; i+=5) {
        if (stopRequested.current) {
          setStage(es ? "Análisis pausado. Puedes reanudar." : "Análise pausada. Você pode retomar.");
          return;
        }
        const batch = chosen.slice(i,i+5);
        setStage((es ? "Analizando artículos " : "Analisando artigos ") + (i+1) + "–" + (i+batch.length) + " / " + chosen.length);
        const { data } = await postAI<{operationId?:string; mode?:string; usage?:unknown}>("/api/ai/assist", {
          feature:"writing",projectId,context:{sectionKey:"introduction",heading:"Introdução",
            task:"evidence_batch",original,language:language||locale,sourceIds:batch,sources:[]}
        });
        if (data.mode === "simulation") throw new Error("Esta conta está em modo simulado. Use uma licença de IA ativa para analisar os artigos.");
        if (!data.operationId) throw new Error("O registro da análise não foi confirmado. Confira Minha licença antes de tentar novamente.");
        batchIds.push(data.operationId);
        try { sessionStorage.setItem(checkpointKey,JSON.stringify({selected:chosen,original,batchIds})); } catch { /* optional */ }
        setProgress({done:i+batch.length,total:chosen.length});
      }
      if (stopRequested.current) { setStage("Análise pausada; clique novamente para retomar."); return; }
      setStage(es ? "Redactando introducción fundamentada…" : "Redigindo a introdução com as evidências analisadas…");
      const {data} = await postAI<{output:unknown;sources?:SourceStatus[];operationId?:string;
        usage?:unknown;mode?:string;sourceStatistics?:{considered:number;relevant:number;selectedForWriting:number}}>("/api/ai/assist",{
        feature:"writing",projectId,context:{sectionKey:"introduction",heading:"Introdução",
          task:"draft_compose",original,language:language||locale,batchOperationIds:batchIds,sources:[]}
      });
      setOperationId(data.operationId||"");
      if (data.mode === "simulation") throw new Error("A simulação não produz conteúdo científico para inserção.");
      if (!isAssistantOutput(data.output) || data.output.recommendations.length !== 1
        || data.output.recommendations[0].targetField !== "introduction") {
        throw new Error("O rascunho retornou em um formato inesperado.");
      }
      const originalText = data.output.recommendations[0].content;
      const verified = data.sources || [];
      const labels = [...originalText.matchAll(/\[S(\d+)\]/g)].map(match => Number(match[1]));
      const citedIds = [...new Set(labels.map(index => verified[index-1]?.id).filter((id):id is string=>Boolean(id)))];
      if (!labels.length || citedIds.length < 1 || labels.some(index=>!verified[index-1])) {
        throw new Error("O texto não possui citações verificáveis para os artigos selecionados.");
      }
      const merged = [...citationIds,...citedIds.filter(id=>!citationIds.includes(id))];
      const proposed = originalText.replace(/\[S(\d+)\]/g,(_marker,index:string)=>{
        const id=verified[Number(index)-1]?.id;
        if (!id) throw new Error("Não foi possível vincular uma citação à bibliografia.");
        return "["+(merged.indexOf(id)+1)+"]";
      });
      let anchors: {id:string;quote:string;kind:string}[] = [];
      try {
        const parsed = JSON.parse(data.output.recommendations[0].source) as {anchors?:unknown};
        if (!Array.isArray(parsed.anchors)) throw new Error();
        anchors = parsed.anchors.filter((a):a is {id:string;quote:string;kind:string} =>
          !!a&&typeof a==="object"&&typeof a.id==="string"&&typeof a.quote==="string"&&typeof a.kind==="string");
        if (anchors.length !== labels.length) throw new Error();
      } catch { throw new Error("Os trechos das referências não puderam ser comprovados."); }
      const stats=data.sourceStatistics;
      if (!stats || stats.considered !== chosen.length) throw new Error("Nem todos os artigos selecionados foram registrados na análise.");
      setSuggestion({original,proposed,sourceIds:citedIds,sources:verified.filter(v=>citedIds.includes(v.id)),
        anchors,warnings:data.output.warnings,operationId:data.operationId||"",
        usage:readAIUsage(data.usage),simulated:false,considered:stats.considered,relevant:stats.relevant});
      setStage("");
    } catch (caught) {
      if (caught instanceof AIRequestError) setOperationId(caught.operationId);
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a análise.");
      setStage("");
    } finally {inFlight.current=false;setBusy(false);}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{es ? "Selecciona cuantos artículos quieras" : "Selecione quantos artigos quiser"} · <strong>{selected.length} / {sources.length}</strong></p>
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={() => {setSelected(sources.map(a=>a.id));setSuggestion(null);}}
            className="text-sm text-teal underline disabled:opacity-50">{es ? "Seleccionar todos" : "Selecionar todos"}</button>
          <button type="button" disabled={busy} onClick={() => {setSelected([]);setSuggestion(null);}}
            className="text-sm text-teal underline disabled:opacity-50">{es ? "Limpiar" : "Limpar seleção"}</button>
        </div>
      </div>
      <input aria-label={es ? "Buscar artículo" : "Buscar artigo"} value={filter} onChange={event=>setFilter(event.target.value)}
        placeholder={es ? "Buscar por título…" : "Buscar artigo pelo título…"}
        className="w-full rounded-card border border-line p-3 text-sm bg-white" />
      <details className="rounded-card border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm text-teal">{es ? "Protocolo que orienta la redacción" : "Protocolo que orienta a redação"}</summary>
        <div className="mt-3 space-y-2 text-xs text-ink-soft">{(() => {
          const p=project as {research_question?:string;objective?:string;population?:string;study_type?:string};
          return <><p><strong>Pergunta:</strong> {p.research_question || "Não definida"}</p>
            <p><strong>Objetivo:</strong> {p.objective || "Não definido"}</p>
            <p><strong>População:</strong> {p.population || "Não definida"}</p>
            <p><strong>Desenho:</strong> {p.study_type || "Não definido"}</p></>;
        })()}</div>
      </details>
      <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
        {visible.map(article => <label key={article.id} className="flex items-start gap-2 rounded-card bg-white border border-line p-3 text-sm">
          <input type="checkbox" className="mt-1" disabled={busy}
            checked={selected.includes(article.id)}
            onChange={() => { setSuggestion(null); setSelected(list => list.includes(article.id)
              ? list.filter(id => id !== article.id) : [...list, article.id]); }} />
          <span className="min-w-0">{article.title}<span className="block text-xs text-ink-soft">
            {article.pmid ? `PMID: ${article.pmid}` : article.doi ? `DOI: ${article.doi}` : "Sem identificador"}
            {" · "}{article.abstract ? (es ? "Resumen disponible" : "Resumo disponível") : (es ? "Sin resumen" : "Sem resumo")}
          </span></span>
        </label>)}
        {!visible.length && <p className="text-sm text-ink-soft">{es ? "Primero vincula artículos a este proyecto en la Biblioteca." :
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
      <p className="text-xs text-ink-soft">{es
        ? "Todos los artículos seleccionados se examinan en lotes de 5. Cada lote consume tokens; solo los más pertinentes se citan en la introducción."
        : "Todos os artigos selecionados serão avaliados em lotes de cinco. Cada lote consome tokens; apenas os mais pertinentes precisam aparecer nas citações da introdução."}</p>
      <p className="text-xs text-ink-soft">{selected.length ? Math.ceil(selected.length/5)+1 : 0} operações de IA previstas ({Math.ceil(selected.length/5)} lotes + síntese final), sujeitas à franquia e aos limites da licença.</p>
      {selected.length > 25 && <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={largeApproved} disabled={busy}
          onChange={event=>setLargeApproved(event.target.checked)} className="mt-0.5"/>
        <span>Estou ciente de que analisar muitos artigos exige várias operações de IA e consome tokens a cada lote.</span>
      </label>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !selected.length || (selected.length>25 && !largeApproved)}
          onClick={() => void generate()} className="rounded-card bg-ink text-white px-5 py-3 text-sm disabled:opacity-50">
          {busy ? (es ? "Procesando…" : "Processando…") : (es ? "Analizar y escribir con IA" : "Analisar e escrever com IA")}
        </button>
        {busy && stage.includes(es ? "Analizando" : "Analisando") && <button type="button"
          onClick={() => {stopRequested.current=true;setStage(es ? "Pausa solicitada tras este lote…" : "Pausa solicitada após este lote…");}}
          className="rounded-card border border-line p-2 text-sm">{es ? "Pausar después del lote" : "Pausar após este lote"}</button>}
        <button type="button" disabled={busy} onClick={() => {
            try {sessionStorage.removeItem(checkpointKey);} catch {}
            setProgress({done:0,total:0});setStage("");setError("");setSuggestion(null);
          }} className="text-sm text-teal underline disabled:opacity-50">
          {es ? "Reiniciar análisis" : "Reiniciar análise"}
        </button>
      </div>
      {(busy || stage) && <div role="status" className="rounded-card border border-teal/20 bg-white p-3 space-y-2">
        <p className="text-sm font-medium text-teal">{stage || (es ? "Procesando…" : "Processando…")}</p>
        {progress.total > 0 && <><p className="text-xs text-ink-soft">{progress.done} / {progress.total} artigos analisados</p>
          <div className="h-2 bg-paper rounded-full overflow-hidden"><div className="h-full bg-teal transition-all"
            style={{width:(Math.min(100,progress.done/progress.total*100))+"%"}} /></div></>}
      </div>}
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
          <p className="text-sm font-medium">Referências citadas e material consultado</p>
          <p className="text-xs text-ink-soft">Os números refletem a bibliografia já vinculada ao manuscrito; a ordem pode diferir da seleção de artigos acima.</p>
          <p className="text-xs text-ink-soft">{suggestion.considered} artigos avaliados · {suggestion.relevant} com evidências relacionadas · {suggestion.sourceIds.length} citados no rascunho.</p>
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
          ? `${(suggestion.usage.inputTokens + suggestion.usage.outputTokens).toLocaleString("pt-BR")} tokens na síntese final; os lotes anteriores são contabilizados separadamente`
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

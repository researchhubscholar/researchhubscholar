"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { useUnsavedChanges } from "@/components/projects/use-unsaved-changes";
import { emptyResults, validWorkspace, type ResultsWorkspace, type ReviewDecision } from "@/lib/results/data";

export default function ReviewScreening({ projectId, articles }: { projectId: string; articles: { id: string; title: string; abstract?: string | null }[] }) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const labels = es ? { pending:"Pendiente", included:"Incluido", excluded:"Excluido" } : { pending:"Pendente", included:"Incluído", excluded:"Excluído" };
  const [workspace,setWorkspace] = useState<ResultsWorkspace | null>(null);
  const [dirty,setDirty] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [filter,setFilter] = useState(() => "all");
  const pendingOnly = useSearchParams().get("triagem") === "pendentes";
  useEffect(() => { setFilter(pendingOnly ? "pending" : "all"); }, [pendingOnly]);
  const revision = useRef<number | null>(null);
  const lock = useRef(false);
  const url = `/api/results?project=${encodeURIComponent(projectId)}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url,{signal:controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok || (data.workspace !== null && !validWorkspace(data.workspace))) throw Error();
      if (controller.signal.aborted) return;
      revision.current = data.revision ?? null;
      setWorkspace(data.workspace ?? emptyResults);
    }).catch(() => { if (!controller.signal.aborted) setMessage("Não foi possível carregar a triagem. Atualize a página."); });
    return () => controller.abort();
  },[url]);
  const decisions = workspace?.reviewScreening ?? [];
  const byId = new Map(decisions.map(item => [item.articleId,item]));
  const counts = { pending:0, included:0, excluded:0 };
  for (const article of articles) counts[byId.get(article.id)?.status ?? "pending"]++;
  function change(articleId: string, status: ReviewDecision["status"], reason = "") {
    if (!workspace || lock.current) return;
    setWorkspace({ ...workspace, reviewScreening: [...decisions.filter(item => item.articleId !== articleId),
      ...(status === "pending" ? [] : [{articleId,status,reason:status === "excluded" ? reason : ""}])] });
    setDirty(true); setMessage("");
  }
  async function save() {
    if (!workspace || lock.current) return false;
    if (decisions.some(item => item.status === "excluded" && !item.reason.trim())) {
      setMessage(es ? "Indica el motivo de cada exclusión." : "Informe o motivo de cada exclusão."); return false;
    }
    lock.current = true; setBusy(true);
    try {
      const response = await fetch("/api/results",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({project:projectId,workspace,expectedRevision:revision.current})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      revision.current = data.revision; setDirty(false);
      setMessage(es ? "Selección guardada." : "Triagem salva."); return true;
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : es ? "No se pudo guardar." : "Não foi possível salvar."); return false;
    } finally { lock.current = false; setBusy(false); }
  }
  useUnsavedChanges({label:es?"Selección de estudios":"Triagem de estudos",dirty,busy,onSave:save});
  return <section id="triagem" className="scroll-mt-28 mb-5 rounded-2xl border border-line bg-white p-5 md:p-7">
    <h2 className="font-display text-2xl">{es?"Selección de estudios":"Triagem de estudos"}</h2>
    <p className="mt-2 text-sm text-ink-soft">{es?"Registra las decisiones sobre los artículos vinculados a esta revisión.":"Registre as decisões sobre os artigos vinculados a esta revisão."}</p>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {!workspace && !message && <p role="status" className="mt-3 text-sm">{es?"Cargando…":"Carregando…"}</p>}
    {workspace && <fieldset disabled={busy} className="mt-4">
      <div className="flex flex-wrap gap-2" aria-label={es?"Filtrar estudios":"Filtrar estudos"}>
        <button type="button" aria-pressed={filter==="all"} onClick={()=>setFilter("all")} className="rounded-card border px-3 py-2 aria-pressed:bg-teal-soft">{es?"Todos":"Todos"} · {articles.length}</button>
        {(Object.keys(labels) as (keyof typeof labels)[]).map(status=><button key={status} type="button" aria-pressed={filter===status} onClick={()=>setFilter(status)} className="rounded-card border px-3 py-2 aria-pressed:bg-teal-soft">{labels[status]} · {counts[status]}</button>)}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {articles.filter(article=>filter==="all" || (byId.get(article.id)?.status ?? "pending")===filter).map(article=>{
          const item=byId.get(article.id);
          return <li key={article.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="text-sm font-medium">{article.title}</p>
              {article.abstract?.trim() ? <details className="mt-2 rounded-card border border-line p-3 text-sm">
                <summary className="cursor-pointer font-medium text-teal">{es ? "Leer resumen" : "Ler resumo"}</summary>
                <p className="mt-2 whitespace-pre-wrap break-words">{article.abstract}</p>
              </details> : <p className="mt-2 text-xs text-ink-soft">{es ? "Resumen no disponible. Puedes dejar el estudio pendiente para consultar el texto completo." : "Resumo indisponível. Você pode deixar o estudo pendente para consultar o texto completo."}</p>}
            </div>
            <select aria-label={`${es?"Decisión":"Decisão"}: ${article.title}`} value={item?.status ?? "pending"} onChange={event=>change(article.id,event.target.value as ReviewDecision["status"],item?.reason)} className="self-start rounded-card border p-2 text-sm">
              {(Object.keys(labels) as (keyof typeof labels)[]).map(status=><option key={status} value={status}>{labels[status]}</option>)}
            </select>
            {item?.status==="excluded" && <label className="text-sm sm:col-span-2">{es?"Motivo de exclusión":"Motivo da exclusão"}
              <input required maxLength={500} value={item.reason} onChange={event=>change(article.id,"excluded",event.target.value)} className="mt-1 block w-full rounded-card border p-2" />
            </label>}
          </li>;
        })}
      </ul>
      <button type="button" disabled={!dirty} onClick={()=>void save()} className="mt-3 rounded-card bg-teal px-4 py-2 text-sm text-white disabled:opacity-50">{es?"Guardar selección":"Salvar triagem"}</button>
    </fieldset>}
  </section>;
}

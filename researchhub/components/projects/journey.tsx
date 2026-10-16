"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJourneyTemplate } from "@/lib/research/journey-templates";
import { manualMilestones, projectNextStep, registeredSteps, type ProjectActivity, type ProjectFields } from "@/lib/research/project-next-step";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Status = "pending" | "current" | "done" | "blocked";
type Item = { key:string;label:string;description:string;checklist:string[];checked:Record<string,boolean>;status:Status;note:string;dueDate:string };
const statusLabels: Record<Status,string> = { pending:"A confirmar",current:"Em andamento",done:"Confirmada",blocked:"Bloqueada" };
const unknownActivity: ProjectActivity = {references:null,searches:null,manuscriptStarted:null};
function freshItems(studyType: string): Item[] { return getJourneyTemplate(studyType).map(step=>({...step,checked:{},status:"pending",note:"",dueDate:""})); }

type Props={projectId:string|null;ownerId:string|null;studyType:string;draft:ProjectFields;radarHref:string;reviewNotes:string[];disabled?:boolean};
export default function ProjectJourney({projectId,ownerId,studyType,draft,radarHref,reviewNotes,disabled=false}:Props) {
  const template=useMemo(()=>freshItems(studyType),[studyType]);
  const scope=`${ownerId||""}:${projectId||""}`;
  const [state,setState]=useState<{scope:string;items:Item[]}>({scope,items:template});
  const items=state.scope===scope?state.items:template;
  const [activity,setActivity]=useState<{scope:string;value:ProjectActivity}>({scope,value:unknownActivity});
  const [loadedScope,setLoadedScope]=useState("");
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const lock=useRef(false);
  const [dirty,setDirty]=useState(false);const reviewRef=useRef<HTMLDetailsElement>(null);
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>{setState(current=>({scope,items:template.map(step=>{const previous=current.scope===scope?current.items.find(i=>i.key===step.key):null;return previous?{...step,checked:previous.checked,status:previous.status,note:previous.note,dueDate:previous.dueDate}:step;})}));},[template,scope]);
  useEffect(()=>{
    let active=true;setLoadedScope("");setDirty(false);setMessage("");setActivity({scope,value:unknownActivity});
    if(!projectId||!ownerId)return;
    const db=supabaseBrowser();
    void(async()=>{try{
      const [milestones,legacyLinks,links,searches,manuscripts]=await Promise.all([
        db.from("scholar_project_milestones").select("milestone_key,status,note,due_date,checklist_state").eq("owner_id",ownerId).eq("project_id",projectId),
        db.from("library_articles").select("id").eq("owner_id",ownerId).eq("project_id",projectId),
        db.from("library_article_projects").select("article_id").eq("owner_id",ownerId).eq("project_id",projectId),
        db.from("scholar_saved_searches").select("id",{count:"exact",head:true}).eq("owner_id",ownerId).eq("project_id",projectId),
        db.from("scholar_manuscripts").select("id").eq("owner_id",ownerId).eq("project_id",projectId).maybeSingle(),
      ]);
      if(!active)return;
      if(milestones.error)setMessage("Não foi possível carregar as confirmações. Você pode continuar editando o protocolo; tente recarregar antes de alterar o acompanhamento.");
      else {setState(current=>({scope,items:(current.scope===scope?current.items:[]).map(step=>{const saved=milestones.data?.find(row=>row.milestone_key===step.key);if(!saved)return step;return {...step,status:saved.status as Status,note:saved.note||"",dueDate:saved.due_date||"",checked:saved.checklist_state&&typeof saved.checklist_state==="object"&&!Array.isArray(saved.checklist_state)?saved.checklist_state as Record<string,boolean>:{}};})}));setLoadedScope(scope);}
      const references=legacyLinks.error||links.error?null:new Set([...(legacyLinks.data||[]).map(r=>r.id),...(links.data||[]).map(r=>r.article_id)]).size;
      const result:ProjectActivity={references,searches:searches.error?null:searches.count||0,manuscriptStarted:manuscripts.error?null:false};
      if(manuscripts.data){const sections=await db.from("scholar_manuscript_sections").select("content").eq("owner_id",ownerId).eq("manuscript_id",manuscripts.data.id);result.manuscriptStarted=sections.error?null:Boolean(sections.data?.some(s=>s.content?.trim()));}
      if(active)setActivity({scope,value:result});
    }catch{if(active)setMessage("Não foi possível conferir o acompanhamento. Seu protocolo continua disponível.");}})();
    return()=>{active=false;};
  },[projectId,ownerId,scope]);
  const ready=Boolean(projectId&&ownerId&&loadedScope===scope&&!disabled);
  const observed=activity.scope===scope?activity.value:unknownActivity;
  const signals=registeredSteps(draft,observed);const next=projectNextStep(draft,observed,items);
  const due=items.filter(i=>i.dueDate&&i.status!=="done").sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
  function change(key:string,patch:Partial<Item>){setState(current=>({...current,items:current.items.map(item=>item.key===key?{...item,...patch}:item)}));setDirty(true);setMessage("");}
  function openReview(key?:string){if(reviewRef.current)reviewRef.current.open=true;requestAnimationFrame(()=>{const target=key?document.getElementById(`review-${key}`):reviewRef.current;if(target instanceof HTMLDetailsElement)target.open=true;target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});target?.focus({preventScroll:true});});}
  async function save(){if(!ready||lock.current||!projectId||!ownerId)return;lock.current=true;setBusy(true);setMessage("");const who=scope;
    try{const db=supabaseBrowser();const {data:auth}=await db.auth.getUser();if(auth.user?.id!==ownerId)throw new Error("Sua sessão mudou. Entre novamente antes de salvar.");
      const rows=items.map((item,index)=>({owner_id:ownerId,project_id:projectId,milestone_key:item.key,status:item.status,note:item.note||null,due_date:item.dueDate||null,checklist_state:item.checked,position:index+1}));
      const {error}=await db.from("scholar_project_milestones").upsert(rows,{onConflict:"owner_id,project_id,milestone_key"});if(error)throw new Error("Não foi possível salvar o acompanhamento. Suas alterações permanecem nesta tela.");
      if(currentScope.current===who){setDirty(false);setMessage("Confirmações e prazos salvos na conta.");}
    }catch(error){if(currentScope.current===who)setMessage(error instanceof Error?error.message:"Não foi possível salvar.");}finally{lock.current=false;setBusy(false);}}
  const destination=next.destination==="radar"?radarHref:next.destination==="manuscript"?`/manuscrito?projeto=${projectId}`:next.destination==="documents"?`/documentos?projeto=${projectId}`:`#${next.anchor||"pergunta"}`;
  return <section className="mt-6" aria-label="Acompanhamento do projeto">
    <div className="bg-white border border-line rounded-2xl p-5 md:p-6"><p className="text-xs uppercase tracking-widest text-teal">Próximo passo</p><h3 className="font-display text-2xl mt-2">{disabled?"Carregando seu projeto…":next.title}</h3><p className="text-sm text-ink-soft mt-3 max-w-2xl">{disabled?"A recomendação aparecerá com os registros da sua conta.":next.description}</p><div className="flex flex-wrap gap-3 items-center mt-4">{!disabled&&(next.destination==="review"?<button type="button" onClick={()=>openReview(next.milestone)} className="bg-teal text-white rounded-card px-4 py-2.5">{next.label}</button>:(!projectId&&["radar","manuscript","documents"].includes(next.destination))?<a href="#project-save" className="bg-teal text-white rounded-card px-4 py-2.5">Salvar projeto para continuar</a>:<Link href={destination} className="bg-teal text-white rounded-card px-4 py-2.5">{next.label}</Link>)}{due&&<p className="text-xs text-ink-soft">Próximo prazo: {due.label} · {new Date(`${due.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</p>}</div>
      {!disabled&&projectId&&<p className="text-xs text-ink-soft mt-4">Referências vinculadas: {observed.references??"a conferir"} · Estratégias salvas: {observed.searches??"a conferir"} · Manuscrito: {observed.manuscriptStarted===null?"a conferir":observed.manuscriptStarted?"texto iniciado":"a iniciar"}</p>}
    </div>
    <details ref={reviewRef} className="mt-4 bg-white border border-line rounded-2xl p-5 md:p-6"><summary className="cursor-pointer text-teal font-medium">Revisar meu projeto · opcional</summary><p className="text-sm text-ink-soft mt-3">Os registros de tema, pergunta, método, referências e escrita são reconhecidos automaticamente. Eles não comprovam qualidade científica nem execução. Confirme ética, coleta, análise e entrega quando acontecerem.</p>
      <details className="mt-4 border border-line rounded-card p-4"><summary className="cursor-pointer text-sm text-teal">Conferir a estrutura do protocolo</summary><ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-ink-soft">{reviewNotes.map(note=><li key={note}>{note}</li>)}</ul><p className="text-xs text-ink-soft mt-3">Verificações por regras de preenchimento não substituem revisão científica ou do orientador.</p></details>
      <fieldset disabled={!ready||busy} className="space-y-3 mt-5 disabled:opacity-60"><legend className="sr-only">Revisão e acompanhamento opcional</legend>{items.map(item=>{const signal=signals[item.key as keyof typeof signals];const manual=manualMilestones.has(item.key);return <details key={item.key} id={`review-${item.key}`} tabIndex={-1} className="border border-line rounded-card p-4"><summary className="cursor-pointer flex flex-wrap justify-between gap-2"><strong className="text-sm">{item.label}</strong><span className="text-xs text-ink-soft">{manual?statusLabels[item.status]:signal===true?"Informações registradas":signal===false?"A preencher":signal===null?"A conferir":"Conferência opcional"}</span></summary><p className="text-sm text-ink-soft mt-3">{item.description}</p>{!manual&&item.status!=="pending"&&<p className="text-xs text-ink-soft mt-2">Marcação anterior preservada: {statusLabels[item.status]}.</p>}<details className="mt-3"><summary className="text-xs text-teal cursor-pointer">Conferência detalhada · opcional</summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{item.checklist.map(check=><label key={check} className="text-xs border rounded-card p-3 flex gap-2 items-start"><input type="checkbox" checked={Boolean(item.checked[check])} onChange={()=>change(item.key,{checked:{...item.checked,[check]:!item.checked[check]}})} className="accent-teal mt-0.5"/><span>{check}</span></label>)}</div></details><div className="grid md:grid-cols-2 gap-3 mt-4">{manual&&<label className="text-xs">Confirmação de execução<select value={item.status} onChange={e=>change(item.key,{status:e.target.value as Status})} className="block w-full border rounded-card p-2 mt-1"><option value="pending">A confirmar</option><option value="current">Em andamento</option><option value="done">Confirmada{item.key==="ethics"?" ou dispensada, conforme aplicável":""}</option><option value="blocked">Bloqueada</option></select></label>}<label className="text-xs">Prazo (opcional)<input type="date" value={item.dueDate} onChange={e=>change(item.key,{dueDate:e.target.value})} className="block w-full border rounded-card p-2 mt-1"/></label><label className="text-xs md:col-span-2">Pendência ou anotação<input value={item.note} maxLength={2000} onChange={e=>change(item.key,{note:e.target.value})} className="block w-full border rounded-card p-2 mt-1" placeholder="Registre somente o que precisa acompanhar"/></label></div>{!manual&&item.status==="blocked"&&<button type="button" onClick={()=>change(item.key,{status:"pending"})} className="text-xs text-teal underline mt-3">Liberar bloqueio anterior</button>}</details>;})}
      <button type="button" disabled={!dirty} onClick={save} className="bg-teal text-white rounded-card px-4 py-2.5 disabled:opacity-50">{busy?"Salvando…":"Salvar confirmações e prazos"}</button></fieldset>{!projectId&&<p className="text-sm text-ink-soft mt-4">Salve o projeto antes de registrar confirmações e prazos.</p>}{projectId&&!ready&&!disabled&&!message&&<p role="status" className="text-sm mt-4">Carregando acompanhamento…</p>}
    </details>{message&&<p role="status" className="text-sm text-ink-soft mt-3">{message}</p>}
  </section>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { getJourneyTemplate } from "@/lib/research/journey-templates";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Status = "pending" | "current" | "done" | "blocked";
type Item = { key:string;label:string;description:string;checklist:string[];status:Status;note:string;dueDate:string };
const statusLabels: Record<Status,string> = { pending:"Pendente",current:"Em andamento",done:"Concluída",blocked:"Bloqueada" };

function freshItems(studyType: string): Item[] {
  return getJourneyTemplate(studyType).map((step,index)=>({ ...step,status:index===0?"current":"pending",note:"",dueDate:"" }));
}

export default function ProjectJourney({projectId,ownerId,studyType}:{projectId:string|null;ownerId:string|null;studyType:string}) {
  const template = useMemo(()=>freshItems(studyType),[studyType]);
  const [items,setItems] = useState<Item[]>(template);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);

  useEffect(()=>{
    setItems(current=>template.map(step=>{
      const previous=current.find(item=>item.key===step.key);
      return previous?{...step,status:previous.status,note:previous.note,dueDate:previous.dueDate}:step;
    }));
  },[template]);

  useEffect(()=>{
    if(!projectId||!ownerId)return;
    let active=true;
    void(async()=>{
      const {data,error}=await supabaseBrowser().from("scholar_project_milestones").select("milestone_key,status,note,due_date,position").eq("owner_id",ownerId).eq("project_id",projectId).order("position");
      if(!active)return;
      if(error){setMessage("Ative a jornada com scholar_productivity.sql.");return;}
      if(data?.length)setItems(template.map(step=>{const saved=data.find(row=>row.milestone_key===step.key);return{...step,status:(saved?.status||step.status) as Status,note:saved?.note||"",dueDate:saved?.due_date||""};}));
    })();
    return()=>{active=false};
  },[projectId,ownerId,template]);

  function change(key:string,patch:Partial<Item>){setItems(current=>current.map(item=>item.key===key?{...item,...patch}:item));}
  async function save(){
    if(!projectId||!ownerId||busy)return;
    setBusy(true);setMessage("");
    const rows=items.map((item,index)=>({owner_id:ownerId,project_id:projectId,milestone_key:item.key,status:item.status,note:item.note||null,due_date:item.dueDate||null,position:index+1}));
    const {error}=await supabaseBrowser().from("scholar_project_milestones").upsert(rows,{onConflict:"owner_id,project_id,milestone_key"});
    setBusy(false);setMessage(error?"Não foi possível salvar a jornada. Confira a migration de produtividade.":"Jornada salva na sua conta.");
  }
  const done=items.filter(item=>item.status==="done").length;
  const journeyLabel=/revisão/i.test(studyType)?"Jornada de revisão":/relato de caso/i.test(studyType)?"Jornada de relato de caso":"Jornada do projeto";

  return <section className="mt-8 bg-white border border-line rounded-2xl p-5 md:p-6">
    <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-teal">{journeyLabel}</p><h3 className="font-display text-2xl mt-2">Do recorte à submissão</h3><p className="text-sm text-ink-soft mt-2">{done} de {items.length} etapas concluídas. Os checklists se adaptam ao desenho selecionado e não representam validação científica.</p></div>{projectId?<button type="button" disabled={busy} onClick={save} className="bg-teal text-white px-4 py-2 rounded-card disabled:opacity-50">{busy?"Salvando...":"Salvar jornada"}</button>:<p className="text-sm text-ink-soft">Salve o projeto para registrar as etapas.</p>}</div>
    <div className="mt-5 space-y-3">{items.map((item,index)=><details key={item.key} className="border border-line rounded-card p-4" open={item.status==="current"}><summary className="cursor-pointer"><span className="text-teal text-xs mr-3">{String(index+1).padStart(2,"0")}</span><strong>{item.label}</strong><span className="float-right text-xs text-ink-soft">{statusLabels[item.status]}</span></summary><p className="text-sm text-ink-soft mt-3">{item.description}</p><div className="grid sm:grid-cols-3 gap-2 mt-3" aria-label={`Checklist de ${item.label}`}>{item.checklist.map(check=><span key={check} className="text-xs bg-paper border border-line rounded-card px-3 py-2">□ {check}</span>)}</div><div className="grid md:grid-cols-[180px_170px_1fr] gap-3 mt-4"><label className="text-xs">Status<select value={item.status} onChange={e=>change(item.key,{status:e.target.value as Status})} className="block w-full border rounded-card p-2 mt-1"><option value="pending">Pendente</option><option value="current">Em andamento</option><option value="done">Concluída</option><option value="blocked">Bloqueada</option></select></label><label className="text-xs">Prazo<input type="date" value={item.dueDate} onChange={e=>change(item.key,{dueDate:e.target.value})} className="block w-full border rounded-card p-2 mt-1"/></label><label className="text-xs">Pendência ou próxima ação<input value={item.note} maxLength={2000} onChange={e=>change(item.key,{note:e.target.value})} className="block w-full border rounded-card p-2 mt-1" placeholder="O que precisa acontecer para avançar?"/></label></div></details>)}</div>
    {message&&<p role="status" className="text-sm text-ink-soft mt-4">{message}</p>}
  </section>;
}

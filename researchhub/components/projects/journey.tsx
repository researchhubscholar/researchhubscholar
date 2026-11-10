"use client";
import { intlLocale } from "@/lib/i18n/format";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJourneyTemplate } from "@/lib/research/journey-templates";
import { manualMilestones, projectNextStep, registeredSteps, type ProjectActivity, type ProjectFields } from "@/lib/research/project-next-step";
import { supabaseBrowser } from "@/lib/supabase/browser";

import { studyFormat } from "@/lib/research/study-format";
import { validWorkspace } from "@/lib/results/data";
import { systematicNextStep, type ScreeningProgress } from "@/lib/research/systematic-next-step";

import { transverseNextStep } from "@/lib/research/transverse-next-step";

type Status = "pending" | "current" | "done" | "blocked";
type Item = { key:string;label:string;description:string;checklist:string[];checked:Record<string,boolean>;status:Status;note:string;dueDate:string };
const statusLabels: Record<Status,string> = { pending:"A confirmar",current:"Em andamento",done:"Confirmada",blocked:"Bloqueada" };
const unknownActivity: ProjectActivity = {references:null,searches:null,manuscriptStarted:null};
function freshItems(studyType: string): Item[] { return getJourneyTemplate(studyType).map(step=>({...step,checked:{},status:"pending",note:"",dueDate:""})); }

type Props={projectId:string|null;ownerId:string|null;studyType:string;draft:ProjectFields;radarHref:string;reviewNotes:string[];disabled?:boolean;protocolSaved?:boolean};
export default function ProjectJourney({projectId,ownerId,studyType,draft,radarHref,reviewNotes,disabled=false,protocolSaved=false}:Props) {
 const {locale:formatLocale}=useLanguage();

  const { t: uiText } = useLanguage();
  const template=useMemo(()=>freshItems(studyType),[studyType]);
  const scope=`${ownerId||""}:${projectId||""}`;
  const [state,setState]=useState<{scope:string;items:Item[]}>({scope,items:template});
  const items=state.scope===scope?state.items:template;
  const [activity,setActivity]=useState<{scope:string;value:ProjectActivity}>({scope,value:unknownActivity});
  const transverse=studyFormat(studyType)==="transverse";
  const [dataProgress,setDataProgress]=useState<{scope:string;hasData:boolean|null;hasResultsText:boolean|null}>({scope,hasData:null,hasResultsText:null});
  const systematic=studyFormat(studyType)==="systematic";
  const [screening,setScreening]=useState<{scope:string;value:ScreeningProgress|null}>({scope,value:null});
  const [loadedScope,setLoadedScope]=useState("");
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const lock=useRef(false);
  const [dirty,setDirty]=useState(false);const reviewRef=useRef<HTMLDetailsElement>(null);
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>{setState(current=>({scope,items:template.map(step=>{const previous=current.scope===scope?current.items.find(i=>i.key===step.key):null;return previous?{...step,checked:previous.checked,status:previous.status,note:previous.note,dueDate:previous.dueDate}:step;})}));},[template,scope]);
  useEffect(()=>{
    let active=true;const controller=new AbortController();setDataProgress({scope,hasData:null,hasResultsText:null});setScreening({scope,value:null});setLoadedScope("");setDirty(false);setMessage("");setActivity({scope,value:unknownActivity});
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
      let hasResultsText:boolean|null=manuscripts.error?null:false;
      if(manuscripts.data){const sections=await db.from("scholar_manuscript_sections").select("section_key,content").eq("owner_id",ownerId).eq("manuscript_id",manuscripts.data.id);result.manuscriptStarted=sections.error?null:Boolean(sections.data?.some(s=>s.content?.trim()));hasResultsText=sections.error?null:Boolean(sections.data?.some(s=>s.section_key==="results"&&s.content?.trim()));}
      if(active)setActivity({scope,value:result});
      if(transverse){
        if(active)setDataProgress({scope,hasData:null,hasResultsText});
        const response=await fetch(`/api/results?project=${encodeURIComponent(projectId)}`,{cache:"no-store",signal:controller.signal});
        const {workspace}=await response.json();
        if(active && response.ok && (workspace===null || validWorkspace(workspace))){
          setDataProgress({scope,hasData:Boolean(workspace?.dataset.rows.some((row:string[])=>row.some(cell=>cell.trim()))),hasResultsText});
        }
      }
      if(systematic && references !== null){
        const ids = new Set([...(legacyLinks.data||[]).map(row=>row.id), ...(links.data||[]).map(row=>row.article_id)]);
        if(!ids.size){if(active)setScreening({scope,value:{total:0,pending:0,included:0,findings:0}});return;}
        const response=await fetch(`/api/results?project=${encodeURIComponent(projectId)}`,{cache:"no-store"});
        const data=await response.json();
        if(!response.ok || (data.workspace!==null && !validWorkspace(data.workspace)))return;
        const decisions=(data.workspace?.reviewScreening ?? []) as {articleId:string;status:string}[];
        const decided=new Set(decisions.filter(row=>ids.has(row.articleId)&&["included","excluded"].includes(row.status)).map(row=>row.articleId));
        const included=[...new Set(decisions.filter(row=>ids.has(row.articleId)&&row.status==="included").map(row=>row.articleId))];
        const evidence=included.length ? await db.from("evidence_matrix").select("article_id,main_finding").eq("owner_id",ownerId).in("article_id",included) : null;
        if(active&&!evidence?.error)setScreening({scope,value:{total:ids.size,pending:ids.size-decided.size,included:included.length,findings:new Set((evidence?.data??[]).filter(row=>row.main_finding?.trim()).map(row=>row.article_id)).size}});
      }
    }catch{if(active)setMessage("Não foi possível conferir o acompanhamento. Seu protocolo continua disponível.");}})();
    return()=>{active=false;controller.abort();};
  },[projectId,ownerId,scope,systematic,transverse]);
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
  const guide = (systematic || transverse) && protocolSaved && projectId && next.destination !== "field" && !items.some(item=>item.status==="blocked");
  const stage = systematicNextStep(screening.scope===scope ? screening.value : null);
  const es=formatLocale==="es";
  const guideCopy = es ? {
    check:["Consultar la selección","Abre la revisión para comprobar los estudios y las decisiones registradas."],
    search:["Buscar estudios","Usa la pregunta del protocolo y guarda los estudios candidatos."],
    start:["Iniciar la selección","Aplica los criterios del protocolo a los estudios vinculados."],
    continue:["Continuar la selección","Evalúa los estudios que todavía no tienen una decisión."],
    searchAgain:["Revisar la búsqueda","No quedaron estudios incluidos. Revisa la estrategia y los criterios con tu orientador."],
    extract:["Organizar los hallazgos","Registra el hallazgo principal de cada estudio incluido en la matriz."],
    write:["Llevar los hallazgos al manuscrito","Usa la matriz para redactar y revisar la sección de Resultados."],
  } : {
    check:["Conferir a triagem","Abra a revisão para conferir os estudos e as decisões registradas."],
    search:["Buscar estudos","Use a pergunta do protocolo e salve os estudos candidatos à triagem."],
    start:["Iniciar triagem","Aplique os critérios do protocolo aos estudos vinculados."],
    continue:["Continuar triagem","Avalie os estudos que ainda estão sem decisão."],
    searchAgain:["Revisar a busca","Nenhum estudo foi incluído. Revise a estratégia e os critérios com seu orientador."],
    extract:["Organizar os achados","Registre o achado principal de cada estudo incluído na matriz."],
    write:["Levar achados ao manuscrito","Use a matriz para redigir e revisar a seção de Resultados."],
  };
  const systematicHref = stage==="search"||stage==="searchAgain" ? radarHref : stage==="write" ? `/manuscrito?projeto=${projectId}#section-results` : `/resultados?projeto=${projectId}${stage==="continue"?"&triagem=pendentes":""}#${stage==="extract"?"matriz":"triagem"}`;
  const currentData=dataProgress.scope===scope?dataProgress:null;
  const dataStage=transverseNextStep(currentData?.hasData??null,currentData?.hasResultsText??null,items.some(item=>item.key==="collection"&&item.status==="done"));
  const dataCopy=es?{
    check:["Consultar datos y resultados","Abre el espacio de resultados para comprobar qué está guardado."],
    collect:["Preparar la recolección","Confirma las autorizaciones aplicables y prepara las variables. Si ya tienes los datos, puedes registrarlos aquí."],
    import:["Registrar los datos recolectados","Pega la tabla o importa un CSV sin identificadores personales."],
    analyze:["Revisar y llevar los hallazgos al manuscrito","Revisa los datos guardados y elige qué hallazgos incorporar."],
    write:["Continuar el manuscrito","Ya hay texto en Resultados. Revísalo y continúa la redacción."],
  }:{
    check:["Conferir dados e resultados","Abra a área de resultados para conferir o que está salvo."],
    collect:["Preparar a coleta","Confirme as autorizações aplicáveis e prepare as variáveis. Se já tiver os dados, você pode registrá-los aqui."],
    import:["Registrar os dados coletados","Cole a tabela ou importe um CSV sem identificadores pessoais."],
    analyze:["Revisar e levar os achados ao manuscrito","Confira os dados salvos e escolha quais achados incorporar."],
    write:["Continuar o manuscrito","Já há texto em Resultados. Revise essa seção e continue a escrita."],
  };
  const [guideTitle,guideDescription]=transverse?dataCopy[dataStage]:guideCopy[stage];
  const guideHref=transverse ? dataStage==="write"?`/manuscrito?projeto=${projectId}#section-results`:`/resultados?projeto=${projectId}` : systematicHref;
  const destination=next.destination==="radar"?radarHref:next.destination==="manuscript"?`/manuscrito?projeto=${projectId}`:next.destination==="documents"?`/documentos?projeto=${projectId}`:`#${next.anchor||"pergunta"}`;
  return <section className="mt-6" aria-label={uiText("screen.04be19f79e2e")}>
    <div className="bg-white border border-line rounded-2xl p-5 md:p-6"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.8979984026f0" /></p><h3 className="font-display text-2xl mt-2">{disabled?uiText("screen.36a640af1cca"):guide?guideTitle:next.title}</h3><p className="text-sm text-ink-soft mt-3 max-w-2xl">{disabled?uiText("screen.2da862aebf47"):guide?guideDescription:next.description}</p><div className="flex flex-wrap gap-3 items-center mt-4">{!disabled&&(guide?(transverse&&dataStage==="collect"?<><button type="button" onClick={()=>openReview("collection")} className="bg-teal text-white rounded-card px-4 py-2.5">{guideTitle}</button><Link href={guideHref} className="text-sm text-teal underline">{es?"Ya tengo los datos":"Já tenho os dados"}</Link></>:<Link href={guideHref} className="bg-teal text-white rounded-card px-4 py-2.5">{guideTitle}</Link>):next.destination==="review"?<button type="button" onClick={()=>openReview(next.milestone)} className="bg-teal text-white rounded-card px-4 py-2.5"><AuthoredText text={next.label} /></button>:(!projectId&&["radar","manuscript","documents"].includes(next.destination))?<a href="#project-save" className="bg-teal text-white rounded-card px-4 py-2.5"><InterfaceText message="screen.e464408181fe" /></a>:<Link href={destination} className="bg-teal text-white rounded-card px-4 py-2.5"><AuthoredText text={next.label} /></Link>)}{due&&<p className="text-xs text-ink-soft"><InterfaceText message="screen.2e26f24d9de9" /> <AuthoredText text={due.label} /> · {new Date(`${due.dueDate}T12:00:00`).toLocaleDateString(intlLocale(formatLocale))}</p>}</div>
      {!disabled&&projectId&&<p className="text-xs text-ink-soft mt-4"><InterfaceText message="screen.4785d7b832f4" /> {observed.references??"a conferir"} <InterfaceText message="screen.3b93719e2ff8" /> {observed.searches??"a conferir"} · Manuscrito: {observed.manuscriptStarted===null?"a conferir":observed.manuscriptStarted?"texto iniciado":"a iniciar"}</p>}
    </div>
    <details ref={reviewRef} className="mt-4 bg-white border border-line rounded-2xl p-5 md:p-6"><summary className="cursor-pointer text-teal font-medium"><InterfaceText message="screen.97f9b8a74112" /></summary><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.1b7b6c0b9dea" /></p>
      <details className="mt-4 border border-line rounded-card p-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.04d846d589f1" /></summary><ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-ink-soft">{reviewNotes.map(note=><li key={note}>{note}</li>)}</ul><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.62157a840f2c" /></p></details>
      <fieldset disabled={!ready||busy} className="space-y-3 mt-5 disabled:opacity-60"><legend className="sr-only"><InterfaceText message="screen.c2adc246808d" /></legend>{items.map(item=>{const signal=signals[item.key as keyof typeof signals];const manual=manualMilestones.has(item.key);return <details key={item.key} id={`review-${item.key}`} tabIndex={-1} className="border border-line rounded-card p-4"><summary className="cursor-pointer flex flex-wrap justify-between gap-2"><strong className="text-sm"><AuthoredText text={item.label} /></strong><span className="text-xs text-ink-soft">{manual?statusLabels[item.status]:signal===true?uiText("screen.eaffd4976d94"):signal===false?"A preencher":signal===null?"A conferir":uiText("screen.095d57bd653a")}</span></summary><p className="text-sm text-ink-soft mt-3"><AuthoredText text={item.description} /></p>{!manual&&item.status!=="pending"&&<p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.69917df6e25f" /> <AuthoredText text={statusLabels[item.status]} />.</p>}<details className="mt-3"><summary className="text-xs text-teal cursor-pointer"><InterfaceText message="screen.09ed651096e7" /></summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{item.checklist.map(check=><label key={check} className="text-xs border rounded-card p-3 flex gap-2 items-start"><input type="checkbox" checked={Boolean(item.checked[check])} onChange={()=>change(item.key,{checked:{...item.checked,[check]:!item.checked[check]}})} className="accent-teal mt-0.5"/><span><AuthoredText text={check} /></span></label>)}</div></details><div className="grid md:grid-cols-2 gap-3 mt-4">{manual&&<label className="text-xs"><InterfaceText message="screen.35fc093d4f98" /><select value={item.status} onChange={e=>change(item.key,{status:e.target.value as Status})} className="block w-full border rounded-card p-2 mt-1"><option value="pending"><InterfaceText message="screen.27075d2834bc" /></option><option value="current"><InterfaceText message="screen.d6f779583776" /></option><option value="done">Confirmada{item.key==="ethics"?uiText("screen.14e880fef53d"):""}</option><option value="blocked">Bloqueada</option></select></label>}<label className="text-xs"><InterfaceText message="screen.f8fb5c44fe19" /><input type="date" value={item.dueDate} onChange={e=>change(item.key,{dueDate:e.target.value})} className="block w-full border rounded-card p-2 mt-1"/></label><label className="text-xs md:col-span-2"><InterfaceText message="screen.2a5c9c5b2c17" /><input value={item.note} maxLength={2000} onChange={e=>change(item.key,{note:e.target.value})} className="block w-full border rounded-card p-2 mt-1" placeholder={uiText("screen.c94baf60298f")}/></label></div>{!manual&&item.status==="blocked"&&<button type="button" onClick={()=>change(item.key,{status:"pending"})} className="text-xs text-teal underline mt-3"><InterfaceText message="screen.c048f30b9bf3" /></button>}</details>;})}
      <button type="button" disabled={!dirty} onClick={save} className="bg-teal text-white rounded-card px-4 py-2.5 disabled:opacity-50">{busy?"Salvando…":uiText("screen.6da6853fc728")}</button></fieldset>{!projectId&&<p className="text-sm text-ink-soft mt-4"><InterfaceText message="screen.38db67686408" /></p>}{projectId&&!ready&&!disabled&&!message&&<p role="status" className="text-sm mt-4"><InterfaceText message="screen.787170dd236e" /></p>}
    </details>{message&&<p role="status" className="text-sm text-ink-soft mt-3"><AuthoredText text={message} /></p>}
  </section>;
}

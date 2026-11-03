"use client";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import { useLanguage } from "@/components/i18n/language-provider";

import { useRef, useState } from "react";
import { htmlWord, workbook, downloadBinary } from "@/lib/exports/ooxml";
import { chartData } from "@/lib/results/data";
import { figurePng, figureSvg } from "@/lib/results/figure";
import AssistantPanel from "@/components/ai/assistant-panel";
import {
  buildAdvisorReport,
  buildProjectMatrixRows,
  buildProjectSummary,
  buildStructuredProtocol,
  type ProjectDocumentData,
} from "@/lib/exports/scientific";

type DocumentKind = "protocol" | "summary" | "advisor" | "matrix" | "manuscript";
const cards: { kind:DocumentKind; eyebrow:string; title:string; description:string; format:string }[] = [
  {kind:"protocol",eyebrow:"Documento principal",title:"Protocolo estruturado",description:"Reúne identificação, pergunta, objetivos, métodos, ética, planejamento e referências vinculadas.",format:"Word nativo · .docx"},
  {kind:"summary",eyebrow:"Visão rápida",title:"Resumo executivo",description:"Sintetiza as decisões centrais, o preenchimento, as referências e as próximas etapas do projeto.",format:"Word nativo · .docx"},
  {kind:"advisor",eyebrow:"Reunião produtiva",title:"Relatório para o orientador",description:"Organiza panorama, decisões, pendências, prazos e pontos que precisam ser validados na orientação.",format:"Word nativo · .docx"},
  {kind:"manuscript",eyebrow:"Artigo completo",title:"Manuscrito com resultados",description:"Reúne autores, seções salvas, referências citadas, tabelas, figura e análises disponíveis do projeto.",format:"Word nativo · .docx"},
  {kind:"matrix",eyebrow:"Dados de leitura",title:"Matriz de evidências",description:"Exporta artigos e campos críticos da leitura em formato compatível com Excel e Google Sheets.",format:"Excel nativo · .xlsx"},
];

function filename(title:string,suffix:string,extension:string) {
  const base=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60)||"projeto";
  return `${base}-${suffix}.${extension}`;
}

export default function DocumentCenter({data}:{data:ProjectDocumentData}) {
  const { t: uiText } = useLanguage();
  const [last,setLast]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const generationLock=useRef(false);
  const p=data.project;
  const matrixCount=data.articles.filter(article=>Object.values(data.notes[article.id]||{}).some(value=>String(value||"").trim())).length;
  const pending=data.milestones.filter(item=>item.status!=="done").length;
  const title=p.title||p.theme||"projeto";
  async function generate(kind:DocumentKind) {
    if(generationLock.current)return;generationLock.current=true;setBusy(true);setError("");setLast("");
    try {
      if(kind==="matrix") { downloadBinary(workbook([{name:"Matriz",rows:buildProjectMatrixRows(data)}]),filename(title,"matriz","xlsx"),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }
      else if(kind==="manuscript") {
        const [{supabaseBrowser},{loadManuscriptExport},{manuscriptDocument}]=await Promise.all([
          import("@/lib/supabase/browser"),import("@/lib/projects/load-manuscript-export"),import("@/lib/projects/manuscript-export"),
        ]);
        const {input,results}=await loadManuscriptExport(supabaseBrowser(),p.id);
        const image=results&&chartData(results.dataset,results.figure.column,results.figure.kind).length?await figurePng(figureSvg(results)):null;
        downloadBinary(manuscriptDocument(input,results,image),filename(input.title||title,"manuscrito","docx"),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      } else { const html=kind==="protocol"?buildStructuredProtocol(data):kind==="summary"?buildProjectSummary(data):buildAdvisorReport(data);downloadBinary(htmlWord(html),filename(title,kind,"docx"),"application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
      setLast(cards.find(card=>card.kind===kind)?.title||"Documento");
    } catch(e){setError(e instanceof Error?e.message:"Falha na exportação.");} finally {generationLock.current=false;setBusy(false);}
  }
  return <>
    <section className="documents-metrics grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6" aria-label={uiText("screen.1f6aedc9700a")}>
      <Metric value={`${p.progress}%`} label={uiText("screen.28ed555beafd")} />
      <Metric value={String(data.articles.length)} label={uiText("screen.83f2bd7c3357")} />
      <Metric value={String(matrixCount)} label={uiText("screen.d78c6c760dab")} />
      <Metric value={String(pending)} label={uiText("screen.379bdcda6ae4")} />
    </section>
    <section className="documents-grid grid md:grid-cols-2 gap-4 mt-7" aria-label={uiText("screen.6e86080c2bf2")}>
      {cards.map(card=><article key={card.kind} className={`document-card document-${card.kind} bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col`}>
        <p className="text-xs uppercase tracking-widest text-teal"><AuthoredText text={card.eyebrow} /></p>
        <h2 className="font-display text-2xl mt-3"><AuthoredText text={card.title} /></h2>
        <p className="text-sm text-ink-soft leading-relaxed mt-3 flex-1"><AuthoredText text={card.description} /></p>
        {card.kind==="manuscript"&&<p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.ae59853909dd" /></p>}
        <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-line"><span className="text-xs text-ink-soft"><AuthoredText text={card.format} /></span><button type="button" onClick={()=>generate(card.kind)} disabled={busy||(card.kind==="matrix"&&!data.articles.length)} className="bg-ink text-white rounded-card px-4 py-2 text-sm disabled:opacity-40">{busy?"Preparando…":"Gerar documento"}</button></div>
      </article>)}
    </section>
    {error&&<p role="alert" className="mt-4 border rounded-card p-4"><AuthoredText text={error} /></p>}
    {last&&<p role="status" className="mt-4 text-sm bg-teal-soft border border-teal/20 rounded-card p-4"><strong>{last}</strong> <InterfaceText message="screen.ba8190e31d80" /></p>}
    <AssistantPanel feature="writing" title={uiText("screen.fb172212ce56")} description={uiText("screen.838ae14bb7b2")} projectId={p.id} context={{project:p,milestones:data.milestones,articles:data.articles.map(a=>({id:a.id,title:a.title,doi:a.doi,pmid:a.pmid})),notes:data.notes}} />
    <section className="documents-checklist mt-7 bg-teal-soft border border-teal/20 rounded-2xl p-5"><h2 className="font-display text-xl"><InterfaceText message="screen.08d093259d9a" /></h2><ul className="text-sm text-ink-soft leading-relaxed mt-3 space-y-1"><li><InterfaceText message="screen.21d2199a047f" /></li><li><InterfaceText message="screen.0e95896b04a4" /></li><li><InterfaceText message="screen.3e932e20402a" /></li><li><InterfaceText message="screen.25aa85b66d61" /></li></ul></section>
  </>;
}

function Metric({value,label}:{value:string;label:string}) { return <div className="bg-white border border-line rounded-card p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-1"><AuthoredText text={label} /></p></div>; }

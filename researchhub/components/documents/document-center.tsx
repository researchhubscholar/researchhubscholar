"use client";

import { useState } from "react";
import {
  buildAdvisorReport,
  buildProjectMatrixCsv,
  buildProjectSummary,
  buildStructuredProtocol,
  download,
  type ProjectDocumentData,
} from "@/lib/exports/scientific";

type DocumentKind = "protocol" | "summary" | "advisor" | "matrix";
const cards: { kind:DocumentKind; eyebrow:string; title:string; description:string; format:string }[] = [
  {kind:"protocol",eyebrow:"Documento principal",title:"Protocolo estruturado",description:"Reúne identificação, pergunta, objetivos, métodos, ética, planejamento e referências vinculadas.",format:"Word compatível · .doc"},
  {kind:"summary",eyebrow:"Visão rápida",title:"Resumo executivo",description:"Sintetiza as decisões centrais, o preenchimento, as referências e as próximas etapas do projeto.",format:"Word compatível · .doc"},
  {kind:"advisor",eyebrow:"Reunião produtiva",title:"Relatório para o orientador",description:"Organiza panorama, decisões, pendências, prazos e pontos que precisam ser validados na orientação.",format:"Word compatível · .doc"},
  {kind:"matrix",eyebrow:"Dados de leitura",title:"Matriz de evidências",description:"Exporta artigos e campos críticos da leitura em formato compatível com Excel e Google Sheets.",format:"Planilha · .csv"},
];

function filename(title:string,suffix:string,extension:string) {
  const base=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60)||"projeto";
  return `${base}-${suffix}.${extension}`;
}

export default function DocumentCenter({data}:{data:ProjectDocumentData}) {
  const [last,setLast]=useState("");
  const p=data.project;
  const matrixCount=data.articles.filter(article=>Object.values(data.notes[article.id]||{}).some(value=>String(value||"").trim())).length;
  const pending=data.milestones.filter(item=>item.status!=="done").length;
  const title=p.title||p.theme||"projeto";
  function generate(kind:DocumentKind) {
    if(kind==="protocol") download(buildStructuredProtocol(data),"application/msword;charset=utf-8",filename(title,"protocolo","doc"));
    if(kind==="summary") download(buildProjectSummary(data),"application/msword;charset=utf-8",filename(title,"resumo","doc"));
    if(kind==="advisor") download(buildAdvisorReport(data),"application/msword;charset=utf-8",filename(title,"orientacao","doc"));
    if(kind==="matrix") download(buildProjectMatrixCsv(data),"text/csv;charset=utf-8",filename(title,"matriz","csv"));
    setLast(cards.find(card=>card.kind===kind)?.title||"Documento");
  }
  return <>
    <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6" aria-label="Preparação dos documentos">
      <Metric value={`${p.progress}%`} label="estrutura preenchida" />
      <Metric value={String(data.articles.length)} label="referências vinculadas" />
      <Metric value={String(matrixCount)} label="leituras com matriz" />
      <Metric value={String(pending)} label="etapas pendentes" />
    </section>
    <section className="grid md:grid-cols-2 gap-4 mt-7" aria-label="Documentos disponíveis">
      {cards.map(card=><article key={card.kind} className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col">
        <p className="text-xs uppercase tracking-widest text-teal">{card.eyebrow}</p>
        <h2 className="font-display text-2xl mt-3">{card.title}</h2>
        <p className="text-sm text-ink-soft leading-relaxed mt-3 flex-1">{card.description}</p>
        <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-line"><span className="text-xs text-ink-soft">{card.format}</span><button type="button" onClick={()=>generate(card.kind)} disabled={card.kind==="matrix"&&!data.articles.length} className="bg-ink text-white rounded-card px-4 py-2 text-sm disabled:opacity-40">Gerar documento</button></div>
      </article>)}
    </section>
    {last&&<p role="status" className="mt-4 text-sm bg-teal-soft border border-teal/20 rounded-card p-4"><strong>{last}</strong> foi preparado e baixado neste dispositivo.</p>}
    <section className="mt-7 bg-teal-soft border border-teal/20 rounded-2xl p-5"><h2 className="font-display text-xl">Antes de compartilhar</h2><ul className="text-sm text-ink-soft leading-relaxed mt-3 space-y-1"><li>• confira todos os campos marcados como “A definir”;</li><li>• confirme a forma de apresentação e as normas exigidas pela instituição;</li><li>• revise referências, método, análise e aspectos éticos com o orientador;</li><li>• não inclua dados identificáveis de pacientes nos documentos.</li></ul></section>
  </>;
}

function Metric({value,label}:{value:string;label:string}) { return <div className="bg-white border border-line rounded-card p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-1">{label}</p></div>; }

"use client";

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
    <section className="documents-metrics grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6" aria-label="Preparação dos documentos">
      <Metric value={`${p.progress}%`} label="estrutura preenchida" />
      <Metric value={String(data.articles.length)} label="referências vinculadas" />
      <Metric value={String(matrixCount)} label="leituras com matriz" />
      <Metric value={String(pending)} label="etapas pendentes" />
    </section>
    <section className="documents-grid grid md:grid-cols-2 gap-4 mt-7" aria-label="Documentos disponíveis">
      {cards.map(card=><article key={card.kind} className={`document-card document-${card.kind} bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col`}>
        <p className="text-xs uppercase tracking-widest text-teal">{card.eyebrow}</p>
        <h2 className="font-display text-2xl mt-3">{card.title}</h2>
        <p className="text-sm text-ink-soft leading-relaxed mt-3 flex-1">{card.description}</p>
        {card.kind==="manuscript"&&<p className="text-xs text-ink-soft mt-3">Usa a última versão salva em Escrever artigo e Resultados. Salve suas alterações nessas abas antes de gerar o documento.</p>}
        <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-line"><span className="text-xs text-ink-soft">{card.format}</span><button type="button" onClick={()=>generate(card.kind)} disabled={busy||(card.kind==="matrix"&&!data.articles.length)} className="bg-ink text-white rounded-card px-4 py-2 text-sm disabled:opacity-40">{busy?"Preparando…":"Gerar documento"}</button></div>
      </article>)}
    </section>
    {error&&<p role="alert" className="mt-4 border rounded-card p-4">{error}</p>}
    {last&&<p role="status" className="mt-4 text-sm bg-teal-soft border border-teal/20 rounded-card p-4"><strong>{last}</strong> foi preparado e baixado neste dispositivo.</p>}
    <AssistantPanel feature="writing" title="Preparar texto para revisão" description="Estrutura um resumo ou trecho de discussão usando somente os dados já registrados. Lacunas, referências e resultados não informados permanecem sinalizados." projectId={p.id} context={{project:p,milestones:data.milestones,articles:data.articles.map(a=>({id:a.id,title:a.title,doi:a.doi,pmid:a.pmid})),notes:data.notes}} />
    <section className="documents-checklist mt-7 bg-teal-soft border border-teal/20 rounded-2xl p-5"><h2 className="font-display text-xl">Antes de compartilhar</h2><ul className="text-sm text-ink-soft leading-relaxed mt-3 space-y-1"><li>• confira todos os campos marcados como “A definir”;</li><li>• confirme a forma de apresentação e as normas exigidas pela instituição;</li><li>• revise referências, método, análise e aspectos éticos com o orientador;</li><li>• não inclua dados identificáveis de pacientes nos documentos.</li></ul></section>
  </>;
}

function Metric({value,label}:{value:string;label:string}) { return <div className="bg-white border border-line rounded-card p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-1">{label}</p></div>; }

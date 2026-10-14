"use client";

import { useState } from "react";
import { htmlWord, workbook, downloadBinary, wordDocument, type WordBlock } from "@/lib/exports/ooxml";
import { parseCsv, describe, chartData, validWorkspace } from "@/lib/results/data";
import { figurePng, figureSvg } from "@/lib/results/figure";
import AssistantPanel from "@/components/ai/assistant-panel";
import {
  buildAdvisorReport,
  buildProjectMatrixCsv,
  buildProjectSummary,
  buildStructuredProtocol,
  type ProjectDocumentData,
} from "@/lib/exports/scientific";

type DocumentKind = "protocol" | "summary" | "advisor" | "matrix" | "manuscript";
const cards: { kind:DocumentKind; eyebrow:string; title:string; description:string; format:string }[] = [
  {kind:"protocol",eyebrow:"Documento principal",title:"Protocolo estruturado",description:"Reúne identificação, pergunta, objetivos, métodos, ética, planejamento e referências vinculadas.",format:"Word nativo · .docx"},
  {kind:"summary",eyebrow:"Visão rápida",title:"Resumo executivo",description:"Sintetiza as decisões centrais, o preenchimento, as referências e as próximas etapas do projeto.",format:"Word nativo · .docx"},
  {kind:"advisor",eyebrow:"Reunião produtiva",title:"Relatório para o orientador",description:"Organiza panorama, decisões, pendências, prazos e pontos que precisam ser validados na orientação.",format:"Word nativo · .docx"},
  {kind:"manuscript",eyebrow:"Artigo completo",title:"Manuscrito com resultados",description:"Reúne as seções salvas do artigo, referências vinculadas, tabela descritiva e figura do projeto.",format:"Word nativo · .docx"},
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
  const p=data.project;
  const matrixCount=data.articles.filter(article=>Object.values(data.notes[article.id]||{}).some(value=>String(value||"").trim())).length;
  const pending=data.milestones.filter(item=>item.status!=="done").length;
  const title=p.title||p.theme||"projeto";
  async function generate(kind:DocumentKind) {
    if(busy)return;setBusy(true);setError("");
    try {
      if(kind==="matrix") { const matrix=parseCsv(buildProjectMatrixCsv(data));downloadBinary(workbook([{name:"Matriz",rows:[matrix.columns,...matrix.rows]}]),filename(title,"matriz","xlsx"),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }
      else if(kind==="manuscript") {
        const {supabaseBrowser}=await import("@/lib/supabase/browser");const db=supabaseBrowser();
        const {data:manuscript,error:me}=await db.from("scholar_manuscripts").select("id,title,keywords").eq("project_id",p.id).maybeSingle();
        if(me)throw new Error("Não foi possível carregar o manuscrito.");if(!manuscript)throw new Error("Salve um artigo em Escrever artigo antes de exportar.");
        const [sectionResult,resultResponse]=await Promise.all([db.from("scholar_manuscript_sections").select("heading,content").eq("manuscript_id",manuscript.id).order("position"),fetch(`/api/results?project=${p.id}`)]);
        if(sectionResult.error)throw new Error("Não foi possível carregar as seções.");
        if(!resultResponse.ok)throw new Error("Não foi possível conferir os resultados. Ative o módulo antes de consolidar o artigo.");
        const resultBody=await resultResponse.json();const blocks:WordBlock[]=[{text:manuscript.title||title,heading:true},{text:data.profile.name+" · "+data.profile.institution},{text:"Palavras-chave: "+(manuscript.keywords||[]).join("; ")}];
        for(const section of sectionResult.data||[])blocks.push({text:section.heading,heading:true},{text:section.content||"A definir"});
        if(validWorkspace(resultBody.workspace)) {const w=resultBody.workspace;const stats=describe(w.dataset);if(stats.length)blocks.push({text:"Apêndice: resultados descritivos",heading:true},{table:[["Variável","N","Ausentes","Média","Mediana","DP"],...stats.map(s=>[s.column,s.n,s.missing,s.mean??"",s.median??"",s.sd??""])]});if(chartData(w.dataset,w.figure.column,w.figure.kind).length){const png=await figurePng(figureSvg(w));blocks.push({image:png.bytes,width:560,height:png.height/png.width*560,caption:w.figure.caption||w.figure.title||w.figure.column});}if(w.notes)blocks.push({text:w.notes});}
        blocks.push({text:"Referências vinculadas ao projeto",heading:true});data.articles.forEach(a=>blocks.push({text:`${a.authors.join("; ")}. ${a.title}. ${a.journal||""}. ${a.year||""}. ${a.doi?"DOI: "+a.doi:""} ${a.pmid?"PMID: "+a.pmid:""}`}));
        downloadBinary(wordDocument(blocks),filename(title,"manuscrito","docx"),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      } else { const html=kind==="protocol"?buildStructuredProtocol(data):kind==="summary"?buildProjectSummary(data):buildAdvisorReport(data);downloadBinary(htmlWord(html),filename(title,kind,"docx"),"application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
      setLast(cards.find(card=>card.kind===kind)?.title||"Documento");
    } catch(e){setError(e instanceof Error?e.message:"Falha na exportação.");} finally {setBusy(false);}
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

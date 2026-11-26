"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { AIRequestError, postAI, readAIUsage, type AIUsage } from "@/lib/ai/client-request";
import { isAssistantOutput } from "@/lib/ai/assist";
import type { AuditFinding, ManuscriptAudit, ManuscriptAuditSection } from "@/lib/ai/manuscript-coherence";

const names:Record<string,string>={
  abstract:"Resumo",introduction:"Introdução",methods:"Métodos",results:"Resultados",
  discussion:"Discussão",limitations:"Limitações",conclusion:"Conclusão",
  research_question:"Pergunta de pesquisa",objective:"Objetivo",study_type:"Desenho",
  population:"População",inclusion_criteria:"Critérios de inclusão",
  exclusion_criteria:"Critérios de exclusão",primary_outcome:"Desfecho principal",
  variables:"Variáveis",analysis_plan:"Análise estatística",ethics_notes:"Ética"
};
const kinds:Record<AuditFinding["level"],{text:string;klass:string}>={
  critical:{text:"Incompatibilidade importante",klass:"bg-red-50 border-red-200 text-red-900"},
  review:{text:"Precisa de conferência",klass:"bg-amber-50 border-amber-200 text-amber-950"},
  improve:{text:"Oportunidade de melhoria",klass:"bg-paper border-line text-ink"}
};
const ordered:AuditFinding["level"][]=["critical","review","improve"];
type Preparation={missing:string[];provisional:string[];analyzed:number;truncated?:string[]};
type SavedReport={audit:ManuscriptAudit;preparation:Preparation;operationId:string;usage:AIUsage|null;signature:string;rejected:number};

export default function ManuscriptCoherenceBeta({
  projectId,dirty,saving,signature,onNavigate
}: {
  projectId:string;dirty:boolean;saving:boolean;signature:string;
  onNavigate:(section:ManuscriptAuditSection)=>void;
}) {
  const {locale}=useLanguage(),es=locale==="es";
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [errorOperation,setErrorOperation]=useState("");
  const [report,setReport]=useState<SavedReport|null>(null);
  const [ack,setAck]=useState(false);
  const [status,setStatus]=useState<Record<number,"reviewed"|"dismissed">>({});
  const [filter,setFilter]=useState<"all"|"critical"|"review"|"improve"|"pending">("all");
  const [notice,setNotice]=useState("");
  const inFlight=useRef(false);
  const signatureRef=useRef(signature);
  signatureRef.current=signature;
  const stale=!!report && signature!==report.signature;

  async function audit() {
    if(inFlight.current||dirty||saving||!ack)return;
    inFlight.current=true;setBusy(true);setError("");setErrorOperation("");
    const before=signature;
    try {
      const {data}=await postAI<{output:unknown;operationId?:string;usage?:unknown;mode?:string;
        auditPreparation?:Preparation;auditRejected?:number}>("/api/ai/assist",{
          feature:"writing",projectId,context:{task:"coherence_review",language:locale}
        });
      if(data.mode==="simulation")throw new Error("O relatório científico requer uma licença de IA ativa.");
      if(!isAssistantOutput(data.output)||data.output.recommendations.length!==1||
        data.output.recommendations[0].targetField!=="coherenceReport"||
        !data.auditPreparation)throw new Error("O relatório não retornou no formato esperado.");
      let parsed:ManuscriptAudit;
      try{parsed=JSON.parse(data.output.recommendations[0].content) as ManuscriptAudit;}
      catch{throw new Error("Não foi possível interpretar o relatório de coerência.");}
      if(!parsed||!Array.isArray(parsed.findings)||typeof parsed.overview!=="string"){
        throw new Error("O relatório recebido está incompleto.");
      }
      if(before!==signatureRef.current){
        throw new Error("O texto mudou durante a análise. Salve as alterações e execute uma nova verificação.");
      }
      setReport({audit:parsed,preparation:data.auditPreparation,
        operationId:data.operationId||"",usage:readAIUsage(data.usage),signature:before,
        rejected:Math.max(0,data.auditRejected||0)});
      setStatus({});setFilter("all");setNotice("");
    }catch(cause){
      if(cause instanceof AIRequestError)setErrorOperation(cause.operationId);
      setError(cause instanceof Error?cause.message:"Não foi possível concluir a verificação.");
    }finally{inFlight.current=false;setBusy(false);}
  }
  const counts=report?Object.fromEntries(ordered.map(level=>
    [level,report.audit.findings.filter(item=>item.level===level).length])) as Record<string,number>:null;
  const allFindings=report?.audit.findings.map((finding,i)=>({finding,i}))||[];
  const shown=allFindings.filter(({finding,i})=>
    filter==="all"||(filter==="pending"?!status[i]:finding.level===filter));
  const checkedCount=allFindings.filter(({i})=>!!status[i]).length;
  async function copyReport(){
    if(!report)return;
    const lines=[
      "ResearchHub — Verificação de coerência (revisão assistida, não certificação)",
      report.audit.overview,
      "Cobertura: "+report.preparation.analyzed+"/7 seções; trechos extensos podem ser amostrados.",
      "Alertas rejeitados na conferência: "+report.rejected,
      ...allFindings.flatMap(({finding,i})=>[
        "",
        (i+1)+". ["+kinds[finding.level].text+"] "+finding.title+
          " — "+(status[i]==="reviewed"?"Revisado":status[i]==="dismissed"?"Não aplicável":"Pendente"),
        finding.explanation,
        "Como revisar: "+finding.recommendation,
        ...finding.evidence.map(q=>(q.origin==="project"?"Protocolo":"Seção")+
          " / "+(names[q.field]||q.field)+": “"+q.quote+"”")
      ])
    ];
    try{
      await navigator.clipboard.writeText(lines.join("\n"));
      setNotice("Relatório copiado. Confira antes de compartilhar informações acadêmicas.");
    }catch{setNotice("Não foi possível copiar automaticamente neste navegador.");}
  }

  return <section id="manuscript-coherence-beta" className="xl:col-span-3 rounded-2xl border border-teal/30 bg-white p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-teal">ResearchHub · Beta</p>
        <h2 className="font-display text-xl md:text-2xl mt-2">
          {es?"Verificación de coherencia científica":"Verificador de coerência científica"}
        </h2>
        <p className="text-sm text-ink-soft mt-2">
          {es?"Compara el objetivo, el protocolo, los métodos, los resultados, la discusión y la conclusión; presenta los pasajes para revisar, sin modificar el manuscrito.":
            "Cruza pergunta e objetivo, protocolo, métodos, resultados, discussão, conclusão e resumo. Aponta diferenças com os trechos correspondentes, sem alterar o manuscrito."}
        </p>
      </div>
      <button type="button" onClick={()=>setOpen(v=>!v)}
        className="rounded-card bg-teal text-white px-4 py-2 text-sm">
        {open?(es?"Cerrar":"Fechar"):(es?"Abrir verificador":"Abrir verificador")}
      </button>
    </div>
    {open && <div className="mt-5 space-y-4">
      <p className="text-xs text-ink-soft">
        {es?"El informe utiliza solamente los apartados y el protocolo guardados, no documentos externos. Es una revisión de apoyo y consume tokens.":"O relatório analisa somente o texto e protocolo salvos, sem conferir artigos externos ou dados individuais. É uma revisão de apoio, consome tokens e não substitui o pesquisador ou orientador."}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} disabled={busy} className="mt-1"/>
        <span>{es?"Confirmo que revisé los textos guardados y eliminé datos personales de pacientes.":
          "Confirmei que os textos estão salvos e que não há dados pessoais identificáveis de pacientes nas seções."}</span>
      </label>
      {(dirty||saving)&&<p role="status" className="text-sm text-amber-900 rounded-card bg-amber-50 border border-amber-200 p-3">
        {es?"Guarda primero los cambios del manuscrito para analizar una versión consistente.":
          "Existem alterações em salvamento ou não salvas. Conclua o salvamento antes de executar a verificação."}
      </p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={()=>void audit()} disabled={busy||dirty||saving||!ack}
          className="rounded-card bg-ink text-white px-5 py-3 text-sm disabled:opacity-50">
          {busy?(es?"Revisando las secciones…":"Conferindo as seções…"):
            report?(es?"Verificar de nuevo":"Verificar novamente"):(es?"Analizar coherencia":"Analisar coerência")}
        </button>
        {report&&<button type="button" className="text-sm underline text-teal" disabled={busy}
          onClick={()=>{setReport(null);setError("");setStatus({});setNotice("");}}>
          {es?"Limpiar informe":"Limpar relatório"}
        </button>}
      </div>
      {error&&<p role="alert" className="text-sm text-red-700">{error}
        {errorOperation&&<Link href={"/geracoes/"+errorOperation} className="underline ml-2">Ver geração</Link>}
      </p>}
      {busy&&<p role="status" className="text-sm text-ink-soft">
        O ResearchHub está comparando o protocolo às seções salvas e conferindo trechos de apoio. Nenhuma alteração será feita no texto.
      </p>}
      {notice&&<p role="status" className="text-xs text-teal">{notice}</p>}
      {report&&<div className="space-y-4 pt-3 border-t border-line">
        {stale&&<p role="alert" className="rounded-card bg-amber-50 border border-amber-200 text-sm text-amber-950 p-3">
          O manuscrito foi modificado após esta verificação. O relatório se refere à versão anterior; faça uma nova análise após salvar.
        </p>}
        <div className="flex flex-wrap gap-2">
          {ordered.map(level=><span key={level} className={"text-xs rounded-full border px-3 py-1 "+kinds[level].klass}>
            {counts?.[level]||0} · {kinds[level].text}
          </span>)}
        </div>
        <p className="text-sm leading-relaxed">{report.audit.overview}</p>
        <p className="text-xs text-ink-soft">
          {report.preparation.analyzed} de 7 seções com texto. A auditoria compara trechos do início e fim das seções longas, não o manuscrito integral. Nenhuma certificação científica automática.
        </p>
        {!!report.preparation.truncated?.length&&<p role="status" className="rounded-card border border-line bg-paper p-3 text-xs text-ink-soft">
          Trechos amostrados por limite de tokens: {report.preparation.truncated.map(key=>names[key]||key).join(", ")}.
          Para uma revisão exaustiva, confira as seções completas.
        </p>}
        {(report.preparation.missing.length>0||report.preparation.provisional.length>0)&&
          <div className="rounded-card border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-950">Pendências de preenchimento identificadas automaticamente</p>
            {report.preparation.missing.length>0&&<p className="text-xs text-amber-950">
              Seções ainda vazias: {report.preparation.missing.map(key=>names[key]||key).join(", ")}.
            </p>}
            {report.preparation.provisional.length>0&&<p className="text-xs text-amber-950">
              Seções com campos provisórios: {report.preparation.provisional.map(key=>names[key]||key).join(", ")}.
            </p>}
          </div>}
        {report.rejected>0&&<div role="status" className="rounded-card border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-950"><strong>{report.rejected} alerta(s) descartado(s)</strong> porque não passaram pela conferência de trechos ou eram repetidos. Não foram mostrados como fatos científicos.</p>
        </div>}
        {!report.audit.findings.length&&<p className="text-sm bg-paper rounded-card p-4">
          {report.rejected>0
            ?"A IA não devolveu alertas que passassem pela verificação de fontes nesta tentativa. Isso não significa que o manuscrito esteja coerente; faça uma nova análise ou confira manualmente."
            :"Nenhuma incoerência específica com evidência textual foi identificada nesta análise. Isso não comprova a validade metodológica nem a veracidade das fontes ou resultados."}
        </p>}
        {allFindings.length>0&&<div className="flex flex-wrap justify-between gap-3 items-center border border-line rounded-card p-3">
          <div>
            <p className="text-sm font-medium">Revisão dos apontamentos</p>
            <p className="text-xs text-ink-soft">{checkedCount} de {allFindings.length} classificados por você · status local desta página</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs" htmlFor="coherence-filter">Mostrar</label>
            <select id="coherence-filter" value={filter}
              onChange={e=>setFilter(e.target.value as typeof filter)}
              className="rounded-card border border-line bg-white p-2 text-xs">
              <option value="all">Todos</option><option value="pending">Pendentes</option>
              <option value="critical">Importantes</option><option value="review">Conferência</option>
              <option value="improve">Melhorias</option>
            </select>
            <button type="button" onClick={()=>void copyReport()}
              className="rounded-card border border-teal/30 text-teal p-2 text-xs">
              Copiar relatório
            </button>
          </div>
        </div>}
        {shown.map(({finding,i})=>
          <article key={i} className="rounded-card border border-line p-4 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <h3 className="font-medium text-base">{finding.title}</h3>
              <span className={"text-xs rounded-full border px-2 py-1 "+kinds[finding.level].klass}>
                {kinds[finding.level].text}
              </span>
            </div>
            <p className="text-sm">{finding.explanation}</p>
            <div className="grid md:grid-cols-2 gap-2">
              {finding.evidence.map((source,index)=><div key={index} className="rounded-card bg-paper p-3">
                <p className="text-xs font-medium text-teal">
                  {source.origin==="project"?"Protocolo":"Manuscrito"} · {names[source.field]||source.field}
                </p>
                <p className="mt-2 text-xs text-ink-soft whitespace-pre-wrap">“{source.quote}”</p>
                {source.origin==="section"&&<button type="button" className="mt-2 text-xs text-teal underline"
                  onClick={()=>onNavigate(source.field as ManuscriptAuditSection)}>
                  {es?"Ir a la sección":"Ir para a seção"}
                </button>}
              </div>)}
            </div>
            <p className="text-sm"><strong>Como revisar:</strong> {finding.recommendation}</p>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-xs text-ink-soft">Sua avaliação:</span>
              <button type="button" aria-pressed={status[i]==="reviewed"}
                className={"rounded-card border px-3 py-2 text-xs "+(status[i]==="reviewed"?"bg-teal text-white border-teal":"border-line text-teal")}
                onClick={()=>setStatus(current=>current[i]==="reviewed"
                  ?Object.fromEntries(Object.entries(current).filter(([key])=>key!==String(i))) as typeof current
                  :{...current,[i]:"reviewed"})}>Conferido</button>
              <button type="button" aria-pressed={status[i]==="dismissed"}
                className={"rounded-card border px-3 py-2 text-xs "+(status[i]==="dismissed"?"bg-ink text-white border-ink":"border-line text-ink")}
                onClick={()=>setStatus(current=>current[i]==="dismissed"
                  ?Object.fromEntries(Object.entries(current).filter(([key])=>key!==String(i))) as typeof current
                  :{...current,[i]:"dismissed"})}>Não se aplica</button>
            </div>
          </article>)}
        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-3">
          <p className="text-xs text-ink-soft">{report.usage?
            (report.usage.inputTokens+report.usage.outputTokens).toLocaleString("pt-BR")+" tokens consumidos":
            "Consumo detalhado disponível no histórico."}</p>
          {report.operationId&&<Link className="text-xs text-teal underline" href={"/geracoes/"+report.operationId}>
            Ver registro da análise
          </Link>}
        </div>
      </div>}
    </div>}
  </section>;
}

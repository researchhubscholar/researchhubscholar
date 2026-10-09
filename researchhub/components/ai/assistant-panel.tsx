"use client";
import { useState } from "react";
import Link from "next/link";
import type { AssistantFeature, AssistantOutput, AssistantRecommendation } from "@/lib/ai/assist";

export default function AssistantPanel({feature,context,projectId,title,description,onApply}:{feature:AssistantFeature;context:unknown;projectId?:string|null;title:string;description:string;onApply?:(item:AssistantRecommendation)=>void}){
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<AssistantOutput|null>(null),[id,setId]=useState(""),[mode,setMode]=useState("");
 async function run(){
  setLoading(true);setError("");setResult(null);
  try{
   const response=await fetch("/api/ai/assist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({feature,context,projectId})});
   const raw=await response.text();
   let data:Record<string,unknown>={};
   try{data=raw?JSON.parse(raw) as Record<string,unknown>:{};}catch{throw new Error(response.ok?"A IA retornou uma resposta incompleta. Tente novamente.":"O serviço de IA não concluiu a solicitação. Tente novamente em alguns instantes.");}
   if(typeof data.operationId==="string")setId(data.operationId);
   if(!response.ok)throw new Error(typeof data.error==="string"?data.error:`Não foi possível concluir a análise (erro ${response.status}).`);
   if(!data.output||typeof data.output!=="object")throw new Error("A IA não retornou uma análise válida. Tente novamente.");
   setResult(data.output as AssistantOutput);
   setMode(typeof data.mode==="string"?data.mode:"live");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível concluir a análise.");}
  finally{setLoading(false);}
 }
 return <section className="mt-6 border border-teal/20 bg-teal-soft/40 rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="text-xs uppercase tracking-widest text-teal">Assistência com IA · revisão humana</p><h2 className="font-display text-2xl mt-2">{title}</h2><p className="text-sm text-ink-soft mt-2">{description}</p></div><button type="button" onClick={run} disabled={loading} className="bg-teal text-white rounded-card px-5 py-3 disabled:opacity-50">{loading?"Analisando…":"Analisar com IA"}</button></div>{error&&<div role="alert" className="mt-4"><p className="text-sm text-red-700">{error}</p>{id&&<Link href={`/geracoes/${id}`} className="inline-block text-xs text-teal underline mt-2">Ver registro desta tentativa</Link>}</div>}{result&&<div className="mt-5"><div className="bg-white border border-line rounded-card p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{result.title}</strong><span className="text-xs text-teal">{mode==="simulation"?"Simulação":"IA ativa"}</span></div><p className="text-sm text-ink-soft mt-2">{result.summary}</p></div><div className="grid md:grid-cols-2 gap-3 mt-3">{result.recommendations.map((item,index)=><article key={`${item.label}-${index}`} className="bg-white border border-line rounded-card p-4"><div className="flex justify-between gap-2"><h3 className="font-medium">{item.label}</h3><span className="text-xs text-ink-soft">Confiança {item.confidence}</span></div><p className="text-sm whitespace-pre-wrap mt-2">{item.content}</p><p className="text-xs text-ink-soft mt-3">{item.rationale}</p>{item.source&&<details className="text-xs text-ink-soft mt-3"><summary className="cursor-pointer">Fonte usada</summary><p className="mt-2 whitespace-pre-wrap">{item.source}</p></details>}{onApply&&item.targetField&&<button type="button" onClick={()=>onApply(item)} className="text-xs bg-ink text-white rounded-card px-3 py-2 mt-3">Aplicar esta sugestão</button>}</article>)}</div>{result.warnings.length>0&&<div className="bg-amber-soft border border-amber-200 rounded-card p-4 mt-3"><strong className="text-sm">Pontos para confirmar</strong><ul className="text-sm mt-2 space-y-1">{result.warnings.map(x=><li key={x}>• {x}</li>)}</ul></div>}<p className="text-xs text-ink-soft mt-4">{result.caution}</p>{id&&<Link href={`/geracoes/${id}`} className="inline-block text-sm text-teal underline mt-3">Ver registro, consumo e avaliação</Link>}</div>}</section>;
}

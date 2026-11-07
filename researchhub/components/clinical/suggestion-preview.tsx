"use client";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import { useLanguage } from "@/components/i18n/language-provider";
import { useState } from "react";
import type { AssistantRecommendation } from "@/lib/ai/assist";
import { suggestionTargets } from "@/lib/clinical/suggestions";
const kinds:Record<string,string>={number:"Número",category:"Opções de resposta",date:"Data",inclusion:"Critério de inclusão",exclusion:"Critério de exclusão"};
export default function SuggestionPreview({items,onApply,disabled}:{items:AssistantRecommendation[];onApply:(items:AssistantRecommendation[])=>boolean;disabled:boolean}){
  const { t: uiText } = useLanguage();
 const [selected,setSelected]=useState<number[]>([]),[review,setReview]=useState(false),[done,setDone]=useState(false);
 const chosen=items.filter((_,i)=>selected.includes(i));
 return <section aria-label={uiText("screen.a3db0c08db63")} className="mt-4 space-y-3"><h3 className="font-medium"><InterfaceText message="screen.4ae9317ad690" /></h3><p className="text-sm"><InterfaceText message="screen.b2700a3d6201" /></p>{items.map((item,i)=><article key={i} className="rounded-card border bg-white p-3"><label className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(i)} disabled={disabled||done||!suggestionTargets.includes(item.targetField)} onChange={e=>{setSelected(s=>e.target.checked?[...s,i]:s.filter(n=>n!==i));setReview(false);}}/><span><strong>{item.label}</strong><small className="block text-teal">{kinds[item.targetField]||uiText("screen.0e7d61acf82f")}</small></span></label><p className="text-sm whitespace-pre-wrap mt-2">{item.content}</p><p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.52363cf74a80" /> {item.rationale}</p></article>)}{!review&&!done&&<button type="button" disabled={disabled||!chosen.length} onClick={()=>setReview(true)} className="border rounded-card px-4 py-2 disabled:opacity-40"><InterfaceText message="screen.b14b778d81d3" />{chosen.length})</button>}{review&&!done&&<div className="rounded-card border border-teal bg-white p-4"><strong>Confirmar {chosen.length} <InterfaceText message="screen.b1b442630a47" /></strong><ul className="text-sm list-disc pl-5 my-3">{chosen.map((item,i)=><li key={i}>{item.label} · <AuthoredText text={kinds[item.targetField]} /></li>)}</ul><p className="text-sm mb-3"><InterfaceText message="screen.61622ab2167c" /></p><button type="button" disabled={disabled} className="bg-teal text-white rounded-card px-4 py-2" onClick={()=>{if(onApply(chosen)){setDone(true);setReview(false);}}}><InterfaceText message="screen.23ce717097d0" /></button><button type="button" className="ml-3 underline text-sm" onClick={()=>setReview(false)}><InterfaceText message="screen.af34944820cb" /></button></div>}{done&&<p role="status" className="text-sm text-teal"><InterfaceText message="screen.ccdc3ee2db4a" /></p>}</section>;
}

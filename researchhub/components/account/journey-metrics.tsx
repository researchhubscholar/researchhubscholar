"use client";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import {useEffect,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/browser";
type Metrics={flow:string;started:number;completed:number;failed:number;review:number;pending:number;unresolved:number};
export default function JourneyMetrics(){
 const [rows,setRows]=useState<Metrics[]|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;void Promise.resolve(supabaseBrowser().rpc("scholar_journey_summary")).then(({data,error})=>{if(!active)return;if(error)setError(["42883","PGRST202"].includes(error.code||"")?"Indicador indisponível: instale scholar_journey_metrics.sql neste ambiente.":"Não foi possível carregar os indicadores. Tente novamente mais tarde.");else setRows(data||[]);}).catch(()=>{if(active)setError("Não foi possível carregar os indicadores. Tente novamente mais tarde.");});return()=>{active=false;};},[]);
 const item=rows?.find(row=>row.flow==="radar_search");
 return <section className="mt-7 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.b514000675be" /></h2><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.9e63b7b75e48" /></p>{error?<p role="alert" className="text-sm mt-4"><AuthoredText text={error} /></p>:!rows?<p role="status" className="text-sm mt-4"><InterfaceText message="screen.386125b42f97" /></p>:!item?<p className="text-sm mt-4"><InterfaceText message="screen.61b28430d538" /></p>:<dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">{[["Iniciadas",item.started],["Com resultado",item.completed],["Falharam",item.failed],["Pedem revisão de termos",item.review],["Em andamento ou recentes",item.pending],["Sem resultado registrado",item.unresolved]].map(([label,value])=><div key={label}><dt className="text-sm text-ink-soft"><AuthoredText text={label} /></dt><dd className="font-semibold text-xl">{Number(value).toLocaleString("pt-BR")}</dd></div>)}</dl>}<p className="text-xs text-ink-soft mt-4"><InterfaceText message="screen.cca2893afa55" /></p></section>;
}

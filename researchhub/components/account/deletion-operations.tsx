"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import {useEffect,useRef,useState} from "react";
import {deletionBlockerLabels} from "@/lib/account/deletion";
type Pending={id:string;email:string|null;status:string;due:boolean;scheduled_for:string;blockers:string[];projects:number;articles:number;manuscripts:number;result_sets:number};
type Run={request_id:string;state:string;attempts:number;started_at:string;finished_at:string|null;error_code:string|null};
type Review={requests:Pending[];runs:Run[];checks:{label:string;tablePresent:boolean;rlsEnabled:boolean;functionPresent:boolean}[];checkedAt:string;environment?:string;databaseHost?:string};
const stateLabels:Record<string,string>={processing:"A conferir / em processamento",failed:"Recusada",completed:"Concluída"};
export default function DeletionOperations(){
  const { t: uiText } = useLanguage();
 const [review,setReview]=useState<Review|null>(null),[selected,setSelected]=useState(""),[confirmation,setConfirmation]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const lock=useRef(false),controller=useRef<AbortController|null>(null);
 async function load(signal?:AbortSignal){setLoading(true);try{const response=await fetch("/api/operations/deletions",{cache:"no-store",signal}),body=await response.json();if(!response.ok)throw Error(body.error||"Revisão indisponível.");if(!signal?.aborted)setReview(body);}catch(error){if(!signal?.aborted)setMessage(error instanceof Error?error.message:"Revisão indisponível.");}finally{if(!signal?.aborted)setLoading(false);}}
 useEffect(()=>{const abort=new AbortController();controller.current=abort;void load(abort.signal);return()=>abort.abort();},[]);
 async function act(action:"execute"|"verify",requestId:string){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage("");
  try{const response=await fetch("/api/operations/deletions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,requestId,...(action==="execute"?{confirmation}: {})})}),body=await response.json();
   setConfirmation("");if(!response.ok)throw Error(body.error||"Resultado não confirmado.");setMessage(body.message);setSelected("");
  }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível confirmar a operação.");}
  finally{await load(controller.current?.signal);lock.current=false;setBusy(false);}
 }
 const item=review?.requests.find(row=>row.id===selected);
 return <section className="mt-7 bg-white border border-line rounded-2xl p-5" aria-labelledby="deletion-heading">
  <div className="flex flex-wrap justify-between gap-3"><h2 id="deletion-heading" className="font-display text-2xl"><InterfaceText message="screen.ac8613a80075" /></h2><button type="button" disabled={busy||loading} onClick={()=>{setMessage("");void load(controller.current?.signal);}} className="text-teal underline"><InterfaceText message="screen.06dbd3c9afa2" /></button></div>
  <p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.c664ad2e8340" /></p>
  {message&&<p role="status" className="text-sm mt-4 whitespace-pre-wrap"><AuthoredText text={message} /></p>}
  {loading&&<p role="status" className="text-sm mt-4"><InterfaceText message="screen.02293457e24c" /></p>}
  {!loading&&review&&<>
   <details className="mt-4 border-t border-line pt-3"><summary className="text-sm cursor-pointer text-teal"><InterfaceText message="screen.f0226d336b8e" /></summary><p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.cf9be9c46ce7" /> {review.environment||uiText("screen.1fb15fcb7b86")} <InterfaceText message="screen.8e04f798305f" /> {review.databaseHost||uiText("screen.1fb15fcb7b86")}<InterfaceText message="screen.0e891aa8b415" /> {new Date(review.checkedAt).toLocaleString("pt-BR")}<InterfaceText message="screen.51f489689d54" /></p><ul className="text-sm mt-3 space-y-1">{review.checks.map(check=><li key={check.label}><AuthoredText text={check.label} />: {check.tablePresent&&check.rlsEnabled&&check.functionPresent?"estruturas verificadas":uiText("screen.14a45a544c59")}</li>)}</ul></details>
   <div className="mt-5 space-y-4">{review.requests.map(row=><article key={row.id} className="border-t border-line pt-4"><p className="font-medium break-all">{row.email||uiText("screen.93b4ae3bdfc7")}</p><p className="text-xs text-ink-soft mt-1">{row.status==="processing"?"Em processamento / resultado a conferir":row.due?uiText("screen.35fc85982288"):`Aguardar até ${new Date(row.scheduled_for).toLocaleDateString("pt-BR")}`}</p><div className="flex flex-wrap gap-3 mt-2"><button type="button" disabled={busy} onClick={()=>{setSelected(row.id);setConfirmation("");}} className="text-sm text-teal underline"><InterfaceText message="screen.da4829350a5f" /></button>{row.status==="processing"&&<button type="button" disabled={busy} onClick={()=>void act("verify",row.id)} className="text-sm text-teal underline">Verificar resultado</button>}</div></article>)}{!review.requests.length&&<p className="text-sm text-ink-soft"><InterfaceText message="screen.4e0519b8d0bf" /></p>}</div>
   {item&&<div className="mt-5 border-t border-line pt-5">
    <h3 className="font-medium break-all"><InterfaceText message="screen.c45fbb40cb6c" /> {item.email||"Conta sem e-mail"}</h3><p className="text-sm mt-2">{item.projects} <InterfaceText message="screen.d858ee02c7d0" /> {item.articles} <InterfaceText message="screen.4f112b26d4c3" /> {item.manuscripts} manuscritos · {item.result_sets} <InterfaceText message="screen.a4f22a8e7a4b" /></p>
    {item.blockers.length>0&&<ul role="alert" className="mt-3 text-sm text-red-700 space-y-2">{item.blockers.map(code=><li key={code}>{deletionBlockerLabels[code]||uiText("screen.247b775b65bd")}</li>)}</ul>}
    {item.status==="pending"&&item.due&&!item.blockers.length?<><label className="block text-sm mt-4"><InterfaceText message="screen.2208b32b8951" /><input type="text" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="block w-full border rounded-card p-3 mt-2"/></label><button type="button" disabled={busy||confirmation.trim().toLowerCase()!==(item.email||"").toLowerCase()} onClick={()=>void act("execute",item.id)} className="mt-3 bg-red-700 text-white rounded-card p-3 disabled:opacity-40">{busy?"Processando…":"Excluir esta conta definitivamente"}</button></>:<p className="text-sm mt-3"><InterfaceText message="screen.26dca245c2e3" /></p>}
    <button type="button" disabled={busy} onClick={()=>{setSelected("");setConfirmation("");}} className="block mt-3 text-sm text-teal underline"><InterfaceText message="screen.8b5197dc2156" /></button>
   </div>}
   <details className="mt-5 border-t border-line pt-3"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.94bcbfed43a9" /></summary><p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.d8c997f3e8b1" /></p><ul className="mt-3 text-sm space-y-2">{review.runs.map(run=><li key={run.request_id}>{stateLabels[run.state]||run.state} · {run.request_id.slice(0,8)} <InterfaceText message="screen.6607206135d1" /> {run.attempts} · {new Date(run.finished_at||run.started_at).toLocaleString("pt-BR")}{run.state==="processing"&&<button type="button" disabled={busy} onClick={()=>void act("verify",run.request_id)} className="ml-3 text-teal underline">Verificar resultado</button>}</li>)}</ul></details>
  </>}
 </section>;
}

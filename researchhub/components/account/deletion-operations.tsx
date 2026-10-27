"use client";
import {useEffect,useRef,useState} from "react";
import {deletionBlockerLabels} from "@/lib/account/deletion";
type Pending={id:string;email:string|null;status:string;due:boolean;scheduled_for:string;blockers:string[];projects:number;articles:number;manuscripts:number;result_sets:number};
type Run={request_id:string;state:string;attempts:number;started_at:string;finished_at:string|null;error_code:string|null};
type Review={requests:Pending[];runs:Run[];checks:{label:string;tablePresent:boolean;rlsEnabled:boolean;functionPresent:boolean}[];checkedAt:string;environment?:string;databaseHost?:string};
const stateLabels:Record<string,string>={processing:"A conferir / em processamento",failed:"Recusada",completed:"Concluída"};
export default function DeletionOperations(){
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
  <div className="flex flex-wrap justify-between gap-3"><h2 id="deletion-heading" className="font-display text-2xl">Revisar exclusões de conta</h2><button type="button" disabled={busy||loading} onClick={()=>{setMessage("");void load(controller.current?.signal);}} className="text-teal underline">Atualizar revisão</button></div>
  <p className="text-sm text-ink-soft mt-3">Somente solicitações do usuário após sete dias. A execução remove a conta e os dados vinculados. Revise a conta, seus vínculos e os impedimentos antes de confirmar. São mostradas até 50 solicitações mais antigas. Downloads e cópias locais não são apagados.</p>
  {message&&<p role="status" className="text-sm mt-4 whitespace-pre-wrap">{message}</p>}
  {loading&&<p role="status" className="text-sm mt-4">Conferindo solicitações e instalação…</p>}
  {!loading&&review&&<>
   <details className="mt-4 border-t border-line pt-3"><summary className="text-sm cursor-pointer text-teal">Conferir estruturas deste ambiente</summary><p className="text-xs text-ink-soft mt-2">Ambiente: {review.environment||"não informado"} · Banco: {review.databaseHost||"não informado"}. Consulta em {new Date(review.checkedAt).toLocaleString("pt-BR")}. Verifica estruturas e RLS; não comprova o histórico completo das migrations.</p><ul className="text-sm mt-3 space-y-1">{review.checks.map(check=><li key={check.label}>{check.label}: {check.tablePresent&&check.rlsEnabled&&check.functionPresent?"estruturas verificadas":"instalação a conferir"}</li>)}</ul></details>
   <div className="mt-5 space-y-4">{review.requests.map(row=><article key={row.id} className="border-t border-line pt-4"><p className="font-medium break-all">{row.email||"Conta sem e-mail · requer conferência"}</p><p className="text-xs text-ink-soft mt-1">{row.status==="processing"?"Em processamento / resultado a conferir":row.due?"Prazo de segurança encerrado":`Aguardar até ${new Date(row.scheduled_for).toLocaleDateString("pt-BR")}`}</p><div className="flex flex-wrap gap-3 mt-2"><button type="button" disabled={busy} onClick={()=>{setSelected(row.id);setConfirmation("");}} className="text-sm text-teal underline">Revisar esta conta</button>{row.status==="processing"&&<button type="button" disabled={busy} onClick={()=>void act("verify",row.id)} className="text-sm text-teal underline">Verificar resultado</button>}</div></article>)}{!review.requests.length&&<p className="text-sm text-ink-soft">Nenhuma solicitação pendente ou em processamento.</p>}</div>
   {item&&<div className="mt-5 border-t border-line pt-5">
    <h3 className="font-medium break-all">Conta escolhida: {item.email||"Conta sem e-mail"}</h3><p className="text-sm mt-2">{item.projects} projetos · {item.articles} artigos · {item.manuscripts} manuscritos · {item.result_sets} conjuntos de resultados. Os dados vinculados e suas versões também serão removidos.</p>
    {item.blockers.length>0&&<ul role="alert" className="mt-3 text-sm text-red-700 space-y-2">{item.blockers.map(code=><li key={code}>{deletionBlockerLabels[code]||"Há um impedimento que precisa de conferência administrativa."}</li>)}</ul>}
    {item.status==="pending"&&item.due&&!item.blockers.length?<><label className="block text-sm mt-4">Digite o e-mail desta conta para confirmar<input type="text" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="block w-full border rounded-card p-3 mt-2"/></label><button type="button" disabled={busy||confirmation.trim().toLowerCase()!==(item.email||"").toLowerCase()} onClick={()=>void act("execute",item.id)} className="mt-3 bg-red-700 text-white rounded-card p-3 disabled:opacity-40">{busy?"Processando…":"Excluir esta conta definitivamente"}</button></>:<p className="text-sm mt-3">A execução está bloqueada até resolver os impedimentos, encerrar o prazo ou conferir o processamento iniciado.</p>}
    <button type="button" disabled={busy} onClick={()=>{setSelected("");setConfirmation("");}} className="block mt-3 text-sm text-teal underline">Fechar revisão</button>
   </div>}
   <details className="mt-5 border-t border-line pt-3"><summary className="cursor-pointer text-sm text-teal">Comprovantes de processamento</summary><p className="text-xs text-ink-soft mt-2">Últimos 50 registros. Guardam identificadores técnicos e situação, sem e-mail ou conteúdo científico.</p><ul className="mt-3 text-sm space-y-2">{review.runs.map(run=><li key={run.request_id}>{stateLabels[run.state]||run.state} · {run.request_id.slice(0,8)} · tentativa {run.attempts} · {new Date(run.finished_at||run.started_at).toLocaleString("pt-BR")}{run.state==="processing"&&<button type="button" disabled={busy} onClick={()=>void act("verify",run.request_id)} className="ml-3 text-teal underline">Verificar resultado</button>}</li>)}</ul></details>
  </>}
 </section>;
}

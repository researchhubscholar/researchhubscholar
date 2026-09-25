"use client";

import { useEffect,useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Summary={users:number;active7d:number;events7d:number;openErrors:number;openSupport:number;pendingDeletions:number};
type Activity={activity_day:string;module:string;event_name:string;total:number};
type Ticket={id:string;user_name:string|null;user_email:string|null;category:string;subject:string;status:string;updated_at:string;last_message:string|null};
type ErrorItem={id:string;user_email:string|null;module:string;route:string;error_code:string;message:string;status:string;last_seen_at:string};
type Deletion={id:string;user_name:string|null;user_email:string|null;requested_at:string;scheduled_for:string;status:string};

const moduleLabels:Record<string,string>={dashboard:"Meu espaço",radar:"Radar",ideas:"Ideias",library:"Biblioteca",project:"Projeto",advising:"Orientação",documents:"Documentos",license:"Licença",residency:"Residência",account:"Conta",operation:"Operação",other:"Outro"};
const supportLabels:Record<string,string>={open:"Aberto",in_progress:"Em atendimento",resolved:"Resolvido",closed:"Encerrado"};

export default function OperationPage(){
  const [summary,setSummary]=useState<Summary|null>(null);const [activity,setActivity]=useState<Activity[]>([]);
  const [tickets,setTickets]=useState<Ticket[]>([]);const [errors,setErrors]=useState<ErrorItem[]>([]);const [deletions,setDeletions]=useState<Deletion[]>([]);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [denied,setDenied]=useState(false);

  async function load(){
    const db=supabaseBrowser();setLoading(true);
    const {data:auth}=await db.auth.getUser();
    if(!auth.user){setDenied(true);setLoading(false);return;}
    const admin=await db.from("scholar_platform_admins").select("role").eq("user_id",auth.user.id).maybeSingle();
    if(admin.error){setMessage("Execute scholar_operations.sql para ativar o painel.");setLoading(false);return;}
    if(!admin.data){setDenied(true);setLoading(false);return;}
    const [s,a,t,e,d]=await Promise.all([
      db.rpc("scholar_operation_summary"),db.rpc("scholar_operation_activity",{p_days:14}),
      db.rpc("scholar_operation_support"),db.rpc("scholar_operation_errors"),db.rpc("scholar_operation_deletions"),
    ]);
    const failed=[s,a,t,e,d].find(item=>item.error);
    if(failed?.error){setMessage("Não foi possível carregar os indicadores operacionais.");}
    else{setSummary(s.data as Summary);setActivity((a.data||[]) as Activity[]);setTickets((t.data||[]) as Ticket[]);setErrors((e.data||[]) as ErrorItem[]);setDeletions((d.data||[]) as Deletion[]);}
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);

  async function reply(ticketId:string,e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;const form=e.currentTarget;const value=String(new FormData(form).get("reply")||"");
    setBusy(true);const result=await supabaseBrowser().rpc("scholar_admin_reply_support",{p_request_id:ticketId,p_message:value,p_status:"in_progress"});setBusy(false);
    if(result.error){setMessage("Não foi possível enviar a resposta.");return;}form.reset();setMessage("Resposta enviada ao usuário.");await load();
  }
  async function setStatus(id:string,status:string){
    if(busy)return;setBusy(true);const result=await supabaseBrowser().rpc("scholar_admin_set_support_status",{p_request_id:id,p_status:status});setBusy(false);
    if(result.error){setMessage("Não foi possível alterar o chamado.");return;}await load();
  }
  async function resolveError(id:string){
    if(busy)return;setBusy(true);const result=await supabaseBrowser().rpc("scholar_admin_resolve_error",{p_error_id:id});setBusy(false);
    if(result.error){setMessage("Não foi possível resolver o erro.");return;}await load();
  }

  if(loading)return <p role="status">Carregando painel operacional...</p>;
  if(denied)return <div className="max-w-2xl mx-auto"><p className="text-xs uppercase tracking-widest text-teal">Operação</p><h1 className="font-display text-4xl mt-3">Acesso restrito.</h1><p className="text-ink-soft mt-4">Este painel é exclusivo da equipe responsável pelo ResearchHub Scholar.</p></div>;
  return <div className="max-w-6xl mx-auto">
    <p className="text-xs uppercase tracking-widest text-teal">Operação do produto</p><h1 className="font-display text-4xl mt-3">Saúde, uso e atendimento.</h1>
    <p className="text-ink-soft mt-4 max-w-3xl">Indicadores operacionais sem conteúdo científico dos usuários. Use-os para identificar falhas, atender solicitações e acompanhar adoção.</p>
    {message&&<p role="status" className="mt-5 bg-teal-soft rounded-card p-4 text-sm">{message}</p>}
    {summary&&<section className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-7">{[
      ["Contas",summary.users],["Ativos · 7 dias",summary.active7d],["Eventos · 7 dias",summary.events7d],
      ["Erros abertos",summary.openErrors],["Suportes abertos",summary.openSupport],["Exclusões",summary.pendingDeletions],
    ].map(([label,value])=><article key={String(label)} className="bg-white border border-line rounded-card p-4"><p className="text-2xl font-display">{Number(value).toLocaleString("pt-BR")}</p><p className="text-xs text-ink-soft mt-2">{label}</p></article>)}</section>}

    <section className="mt-7 bg-white border border-line rounded-2xl p-5 overflow-x-auto"><h2 className="font-display text-2xl">Uso por módulo · 14 dias</h2>
      <table className="w-full text-sm text-left mt-4"><thead><tr><th className="p-2">Data</th><th className="p-2">Módulo</th><th className="p-2">Evento</th><th className="p-2">Total</th></tr></thead><tbody>{activity.map((item,index)=><tr key={`${item.activity_day}-${item.module}-${item.event_name}-${index}`} className="border-t"><td className="p-2">{new Date(item.activity_day+"T12:00:00").toLocaleDateString("pt-BR")}</td><td className="p-2">{moduleLabels[item.module]||item.module}</td><td className="p-2">{item.event_name==="page_view"?"Visualização":"Ação"}</td><td className="p-2">{Number(item.total)}</td></tr>)}</tbody></table>
      {!activity.length&&<p className="text-sm text-ink-soft mt-4">Os indicadores começarão a aparecer conforme as páginas privadas forem utilizadas.</p>}
    </section>

    <section className="mt-7"><h2 className="font-display text-2xl">Atendimento</h2><div className="grid lg:grid-cols-2 gap-4 mt-4">{tickets.map(ticket=><article key={ticket.id} className="bg-white border border-line rounded-2xl p-5">
      <div className="flex justify-between gap-3"><div><p className="text-xs text-teal">{ticket.user_name||ticket.user_email||"Usuário"}</p><h3 className="font-medium mt-1">{ticket.subject}</h3></div><span className="text-xs bg-paper rounded-full px-2 py-1 self-start">{supportLabels[ticket.status]}</span></div>
      <p className="text-sm text-ink-soft mt-3">{ticket.last_message||"Sem mensagem."}</p><p className="text-[11px] text-ink-soft mt-2">{ticket.user_email} · {new Date(ticket.updated_at).toLocaleString("pt-BR")}</p>
      <form onSubmit={e=>reply(ticket.id,e)} className="flex gap-2 mt-4"><input name="reply" required minLength={2} maxLength={4000} placeholder="Responder ao usuário" className="flex-1 min-w-0 border rounded-card px-3 py-2"/><button disabled={busy} className="bg-teal text-white px-3 rounded-card">Enviar</button></form>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">{ticket.status!=="resolved"&&<button type="button" onClick={()=>setStatus(ticket.id,"resolved")} className="text-teal underline">Marcar resolvido</button>}{ticket.status!=="closed"&&<button type="button" onClick={()=>setStatus(ticket.id,"closed")} className="text-teal underline">Encerrar</button>}</div>
    </article>)}{!tickets.length&&<p className="text-sm text-ink-soft">Nenhuma solicitação registrada.</p>}</div></section>

    <section className="mt-7"><h2 className="font-display text-2xl">Erros recentes</h2><div className="space-y-3 mt-4">{errors.map(item=><article key={item.id} className="bg-white border border-line rounded-card p-4 flex flex-wrap justify-between gap-4"><div><div className="flex gap-2 text-xs"><span className={item.status==="open"?"text-red-700":"text-teal"}>{item.status==="open"?"Aberto":"Resolvido"}</span><span>{moduleLabels[item.module]||item.module}</span><span>{item.error_code}</span></div><p className="text-sm mt-2">{item.message}</p><p className="text-[11px] text-ink-soft mt-2">{item.route} · {item.user_email||"conta removida"} · {new Date(item.last_seen_at).toLocaleString("pt-BR")}</p></div>{item.status==="open"&&<button type="button" disabled={busy} onClick={()=>resolveError(item.id)} className="text-sm text-teal underline self-start">Marcar resolvido</button>}</article>)}{!errors.length&&<p className="text-sm text-ink-soft">Nenhum erro registrado.</p>}</div></section>

    <section className="mt-7 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Exclusões pendentes</h2><div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Usuário</th><th className="p-2">Solicitada</th><th className="p-2">Prevista</th></tr></thead><tbody>{deletions.map(item=><tr key={item.id} className="border-t"><td className="p-2">{item.user_name||item.user_email}</td><td className="p-2">{new Date(item.requested_at).toLocaleDateString("pt-BR")}</td><td className="p-2">{new Date(item.scheduled_for).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div>{!deletions.length&&<p className="text-sm text-ink-soft mt-3">Nenhuma exclusão pendente.</p>}</section>
  </div>;
}

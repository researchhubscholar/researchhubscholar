"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = { name: string | null; institution: string | null; specialty: string | null };
type SupportRequest = { id: string; category: string; subject: string; status: string; created_at: string; updated_at: string };
type SupportMessage = { id: string; request_id: string; sender_type: string; message: string; created_at: string };
type AccountRequest = { id: string; status: string; requested_at: string; scheduled_for: string };

const categoryLabels: Record<string,string> = { technical:"Problema técnico", billing:"Plano ou cobrança", privacy:"Privacidade e dados", suggestion:"Sugestão", other:"Outro assunto" };
const statusLabels: Record<string,string> = { open:"Aberto", in_progress:"Em atendimento", resolved:"Resolvido", closed:"Encerrado" };

export default function AccountPage() {
  const [userId,setUserId]=useState<string|null>(null);
  const [email,setEmail]=useState("");
  const [profile,setProfile]=useState<Profile>({name:"",institution:"",specialty:""});
  const [requests,setRequests]=useState<SupportRequest[]>([]);
  const [messages,setMessages]=useState<SupportMessage[]>([]);
  const [deletion,setDeletion]=useState<AccountRequest|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [moduleReady,setModuleReady]=useState(true);
  const [confirmText,setConfirmText]=useState("");

  async function load() {
    const db=supabaseBrowser();
    const {data:auth}=await db.auth.getUser();
    const user=auth.user;
    setUserId(user?.id||null);setEmail(user?.email||"");
    if(!user){setLoading(false);return;}
    const [profileResult,requestResult,messageResult,accountResult]=await Promise.all([
      db.from("profiles").select("name,institution,specialty").eq("id",user.id).maybeSingle(),
      db.from("scholar_support_requests").select("id,category,subject,status,created_at,updated_at").eq("owner_id",user.id).order("updated_at",{ascending:false}),
      db.from("scholar_support_messages").select("id,request_id,sender_type,message,created_at").eq("owner_id",user.id).order("created_at",{ascending:true}),
      db.from("scholar_account_requests").select("id,status,requested_at,scheduled_for").eq("owner_id",user.id).eq("status","pending").maybeSingle(),
    ]);
    if(profileResult.data)setProfile(profileResult.data);
    const ready=!requestResult.error&&!messageResult.error&&!accountResult.error;
    setModuleReady(ready);
    if(ready){setRequests(requestResult.data||[]);setMessages(messageResult.data||[]);setDeletion(accountResult.data||null);}
    setLoading(false);
  }

  useEffect(()=>{void load();},[]);

  async function saveProfile(e:React.FormEvent) {
    e.preventDefault();if(!userId||busy)return;setBusy(true);setMessage("");
    const {error}=await supabaseBrowser().from("profiles").update({
      name:profile.name?.trim()||null,institution:profile.institution?.trim()||null,specialty:profile.specialty?.trim()||null,
    }).eq("id",userId);
    setBusy(false);setMessage(error?"Não foi possível atualizar o perfil.":"Perfil atualizado.");
  }

  async function createSupport(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(busy)return;const form=e.currentTarget;const data=new FormData(form);
    setBusy(true);setMessage("");
    const result=await supabaseBrowser().rpc("scholar_create_support_request",{
      p_category:String(data.get("category")||""),p_subject:String(data.get("subject")||""),p_message:String(data.get("supportMessage")||""),
    });
    setBusy(false);
    if(result.error){setMessage("Não foi possível abrir o chamado. Confira os campos.");return;}
    form.reset();setMessage("Solicitação registrada. Você pode acompanhar o histórico nesta página.");await load();
  }

  async function addMessage(requestId:string,e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(busy)return;const form=e.currentTarget;const text=String(new FormData(form).get("followup")||"");
    setBusy(true);const result=await supabaseBrowser().rpc("scholar_add_support_message",{p_request_id:requestId,p_message:text});setBusy(false);
    if(result.error){setMessage("Não foi possível acrescentar a mensagem.");return;}
    form.reset();setMessage("Mensagem adicionada ao chamado.");await load();
  }

  async function exportData() {
    if(busy)return;setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/account/export");
      if(!response.ok)throw new Error("Falha");
      const blob=await response.blob();const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");anchor.href=url;anchor.download=`researchhub-scholar-dados-${new Date().toISOString().slice(0,10)}.json`;anchor.click();
      URL.revokeObjectURL(url);setMessage("Arquivo de dados preparado.");
    }catch{setMessage("Não foi possível exportar os dados agora.");}
    finally{setBusy(false);}
  }

  async function requestDeletion() {
    if(busy||confirmText!=="EXCLUIR")return;setBusy(true);setMessage("");
    const result=await supabaseBrowser().rpc("scholar_request_account_deletion");
    setBusy(false);
    if(result.error){setMessage("Não foi possível registrar a solicitação.");return;}
    setConfirmText("");setMessage("Exclusão solicitada. Você ainda pode cancelar durante o prazo de segurança.");await load();
  }

  async function cancelDeletion() {
    if(!deletion||busy)return;setBusy(true);
    const result=await supabaseBrowser().rpc("scholar_cancel_account_deletion",{p_request_id:deletion.id});setBusy(false);
    if(result.error||!result.data){setMessage("Não foi possível cancelar a solicitação.");return;}
    setDeletion(null);setMessage("Solicitação de exclusão cancelada.");
  }

  const grouped=useMemo(()=>Object.fromEntries(requests.map(request=>[request.id,messages.filter(item=>item.request_id===request.id)])),[requests,messages]);
  if(loading)return <p role="status">Carregando sua conta...</p>;

  return <div className="max-w-4xl mx-auto">
    <p className="text-xs uppercase tracking-widest text-teal">Conta e privacidade</p>
    <h1 className="font-display text-4xl mt-3">Seus dados e seu atendimento.</h1>
    <p className="text-ink-soft mt-4 max-w-2xl">Atualize informações do perfil, exporte seus dados e acompanhe solicitações sem misturar esse histórico com seus projetos científicos.</p>
    {!moduleReady&&<p role="alert" className="mt-6 bg-amber-soft border border-line rounded-card p-4 text-sm">Execute <code>scholar_account_support.sql</code> no Supabase para ativar suporte, exportação e exclusão agendada.</p>}
    {message&&<p role="status" className="mt-5 bg-teal-soft rounded-card p-4 text-sm">{message}</p>}

    <section className="mt-7 bg-white border border-line rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl">Perfil</h2>
      <p className="text-sm text-ink-soft mt-2">O e-mail de acesso é <strong>{email}</strong>.</p>
      <form onSubmit={saveProfile} className="grid md:grid-cols-3 gap-4 mt-5">
        <label className="text-sm">Nome<input value={profile.name||""} maxLength={150} onChange={e=>setProfile({...profile,name:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="text-sm">Instituição<input value={profile.institution||""} maxLength={200} onChange={e=>setProfile({...profile,institution:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="text-sm">Área ou especialidade<input value={profile.specialty||""} maxLength={160} onChange={e=>setProfile({...profile,specialty:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <button disabled={busy} className="md:col-span-3 justify-self-start bg-teal text-white px-5 py-3 rounded-card disabled:opacity-50">Salvar perfil</button>
      </form>
    </section>

    <section className="mt-6 bg-white border border-line rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl">Exportar meus dados</h2>
      <p className="text-sm text-ink-soft mt-2">Baixe um arquivo JSON com perfil, projetos, biblioteca, matriz, ideias, buscas, jornada, uso e solicitações vinculadas à sua conta.</p>
      <button type="button" disabled={busy} onClick={exportData} className="mt-4 border border-teal text-teal px-5 py-3 rounded-card disabled:opacity-50">Baixar meus dados</button>
    </section>

    <section className="mt-6 bg-white border border-line rounded-2xl p-5 md:p-6">
      <p className="text-xs uppercase tracking-widest text-teal">Suporte privado</p><h2 className="font-display text-2xl mt-2">Abrir uma solicitação</h2>
      <form onSubmit={createSupport} className="grid md:grid-cols-2 gap-4 mt-5">
        <label className="text-sm">Categoria<select name="category" className="block w-full border rounded-card p-3 mt-2">{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm">Assunto<input name="subject" required minLength={3} maxLength={160} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="md:col-span-2 text-sm">Mensagem<textarea name="supportMessage" required minLength={10} maxLength={4000} rows={5} className="block w-full border rounded-card p-3 mt-2"/></label>
        <p className="md:col-span-2 text-xs text-ink-soft">Não envie senhas, dados bancários ou informações identificáveis de pacientes.</p>
        <button disabled={busy||!moduleReady} className="justify-self-start bg-teal text-white px-5 py-3 rounded-card disabled:opacity-50">Enviar solicitação</button>
      </form>
      {requests.length>0&&<div className="mt-7 border-t border-line pt-5"><h3 className="font-display text-xl">Histórico</h3><div className="space-y-4 mt-4">{requests.map(request=><article key={request.id} className="border border-line rounded-card p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-teal">{categoryLabels[request.category]}</p><h4 className="font-medium mt-1">{request.subject}</h4></div><span className="text-xs bg-paper px-2 py-1 rounded-full self-start">{statusLabels[request.status]}</span></div>
        <div className="space-y-2 mt-4">{(grouped[request.id]||[]).map(item=><div key={item.id} className={`text-sm rounded-card p-3 ${item.sender_type==="team"?"bg-teal-soft":"bg-paper"}`}><p>{item.message}</p><p className="text-[11px] text-ink-soft mt-2">{item.sender_type==="team"?"Equipe Scholar":"Você"} · {new Date(item.created_at).toLocaleString("pt-BR")}</p></div>)}</div>
        {request.status!=="closed"&&<form onSubmit={e=>addMessage(request.id,e)} className="flex gap-2 mt-3"><input name="followup" required minLength={2} maxLength={4000} placeholder="Acrescentar informação" className="flex-1 min-w-0 border rounded-card px-3 py-2"/><button disabled={busy} className="text-sm text-teal border border-teal/30 px-3 rounded-card">Enviar</button></form>}
      </article>)}</div></div>}
    </section>

    <section className="mt-6 border border-red-200 bg-red-50 rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl text-red-800">Excluir minha conta</h2>
      {deletion?<><p className="text-sm text-red-800 mt-3">Solicitação registrada em {new Date(deletion.requested_at).toLocaleDateString("pt-BR")}. Processamento previsto após {new Date(deletion.scheduled_for).toLocaleDateString("pt-BR")}.</p><p className="text-xs text-red-700 mt-2">Até o processamento, sua conta e seus dados continuam disponíveis.</p><button type="button" disabled={busy} onClick={cancelDeletion} className="mt-4 bg-white border border-red-300 text-red-800 px-4 py-2 rounded-card">Cancelar exclusão</button></>:<>
        <p className="text-sm text-red-800 mt-3">A solicitação terá um prazo de segurança de sete dias. Depois desse período, a equipe poderá excluir autenticação, projetos, biblioteca e demais dados associados.</p>
        <label className="block text-sm text-red-900 mt-4">Digite <strong>EXCLUIR</strong> para confirmar<input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="block w-full max-w-sm border border-red-300 rounded-card p-3 mt-2 bg-white"/></label>
        <button type="button" disabled={busy||confirmText!=="EXCLUIR"||!moduleReady} onClick={requestDeletion} className="mt-4 bg-red-700 text-white px-5 py-3 rounded-card disabled:opacity-40">Solicitar exclusão</button>
      </>}
    </section>
  </div>;
}

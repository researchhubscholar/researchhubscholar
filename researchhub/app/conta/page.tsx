"use client";
import { intlLocale } from "@/lib/i18n/format";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import { useEffect, useMemo, useRef, useState } from "react";
import { accountExportSummary,accountExportMessage,type ExportSummary } from "@/lib/account/export-client";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = { name: string | null; institution: string | null; specialty: string | null };
type SupportRequest = { id: string; category: string; subject: string; status: string; created_at: string; updated_at: string };
type SupportMessage = { id: string; request_id: string; sender_type: string; message: string; created_at: string };
type AccountRequest = { id: string; status: string; requested_at: string; scheduled_for: string };

const categoryLabels: Record<string,string> = { technical:"Problema técnico", billing:"Plano ou cobrança", privacy:"Privacidade e dados", suggestion:"Sugestão", other:"Outro assunto" };
const statusLabels: Record<string,string> = { open:"Aberto", in_progress:"Em atendimento", resolved:"Resolvido", closed:"Encerrado" };

export default function AccountPage() {
 const {locale:formatLocale}=useLanguage();

  const { t: uiText } = useLanguage();
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
  const [exportSummary,setExportSummary]=useState<ExportSummary|null>(null);
  const exportLock=useRef(false);
  const exportController=useRef<AbortController|null>(null);

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
      db.from("scholar_account_requests").select("id,status,requested_at,scheduled_for").eq("owner_id",user.id).in("status",["pending","processing"]).maybeSingle(),
    ]);
    if(profileResult.data)setProfile(profileResult.data);
    const ready=!requestResult.error&&!messageResult.error&&!accountResult.error;
    setModuleReady(ready);
    if(ready){setRequests(requestResult.data||[]);setMessages(messageResult.data||[]);setDeletion(accountResult.data||null);}
    setLoading(false);
  }

  useEffect(()=>{void load();return()=>{exportController.current?.abort();};},[]);

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
    if(busy||exportLock.current)return;exportLock.current=true;const controller=new AbortController();exportController.current=controller;setBusy(true);setMessage("");setExportSummary(null);
    try{
      const response=await fetch("/api/account/export",{cache:"no-store",signal:controller.signal});
      if(!response.ok)throw new Error(response.status===401?"Sua sessão expirou. Entre novamente antes de exportar.":"Não foi possível exportar os dados agora.");
      let payload;
      try{payload=await response.json();}catch{throw new Error("A exportação foi interrompida. Nenhum arquivo foi preparado. Tente novamente.");}
      if(controller.signal.aborted)return;
      if(payload.account?.id!==userId)throw new Error("A conta mudou. Atualize a página antes de exportar.");
      const summary=accountExportSummary(payload);
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob);
      try{const anchor=document.createElement("a");anchor.href=url;anchor.download=`researchhub-scholar-dados${summary.status==="partial"?"-parcial":""}-${new Date().toISOString().slice(0,10)}.json`;anchor.click();}finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setExportSummary(summary);
    }catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"A exportação foi interrompida. Tente novamente.");}
    finally{exportController.current=null;exportLock.current=false;setBusy(false);}
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
    if(result.error||!result.data){setMessage("A solicitação não está mais disponível para cancelamento. Atualize a página para conferir se o processamento já começou.");return;}
    setDeletion(null);setMessage("Solicitação de exclusão cancelada.");
  }

  const grouped=useMemo(()=>Object.fromEntries(requests.map(request=>[request.id,messages.filter(item=>item.request_id===request.id)])),[requests,messages]);
  if(loading)return <p role="status"><InterfaceText message="screen.31a5d8e40dcf" /></p>;

  return <div className="scholar-workspace secondary-page account-page max-w-4xl mx-auto">
    <header className="account-hero">
    <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.e86a8eda4243" /></p>
    <h1 className="font-display text-4xl mt-3"><InterfaceText message="screen.9168dfed25b6" /></h1>
    <p className="text-ink-soft mt-4 max-w-2xl"><InterfaceText message="screen.668df6e883f0" /></p>
    </header>
    {!moduleReady&&<p role="alert" className="mt-6 bg-amber-soft border border-line rounded-card p-4 text-sm"><InterfaceText message="screen.e3a67d9540e9" /> <code>scholar_account_support.sql</code> <InterfaceText message="screen.71e9fdd6da59" /></p>}
    {message&&<p role="status" className="mt-5 bg-teal-soft rounded-card p-4 text-sm"><AuthoredText text={message} /></p>}

    <section className="mt-7 bg-white border border-line rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl">Perfil</h2>
      <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.b38e56408450" /> <strong>{email}</strong>.</p>
      <form onSubmit={saveProfile} className="aligned-fields grid md:grid-cols-3 gap-4 mt-5">
        <label className="text-sm"><InterfaceText message="screen.5086900635fe" /><input value={profile.name||""} maxLength={150} onChange={e=>setProfile({...profile,name:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="text-sm"><InterfaceText message="screen.46fef0b915a9" /><input value={profile.institution||""} maxLength={200} onChange={e=>setProfile({...profile,institution:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="text-sm"><InterfaceText message="screen.daf93d2ececc" /><input value={profile.specialty||""} maxLength={160} onChange={e=>setProfile({...profile,specialty:e.target.value})} className="block w-full border rounded-card p-3 mt-2"/></label>
        <button disabled={busy} className="md:col-span-3 justify-self-start bg-teal text-white px-5 py-3 rounded-card disabled:opacity-50"><InterfaceText message="screen.2ff09b01e48f" /></button>
      </form>
    </section>

    <section className="mt-6 bg-white border border-line rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl"><InterfaceText message="screen.ef46b6800c44" /></h2>
      <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.a2e2656b4595" /></p>
      <button type="button" disabled={busy} onClick={exportData} className="mt-4 border border-teal text-teal px-5 py-3 rounded-card disabled:opacity-50">{busy?"Aguarde…":uiText("screen.5c3ce731b0dc")}</button>
      {exportSummary&&<div className="mt-4 text-sm"><p role={exportSummary.status==="partial"?"alert":"status"} className={exportSummary.status==="partial"?"text-red-700":"text-teal"}>{accountExportMessage(exportSummary)}</p><details className="mt-3"><summary className="cursor-pointer text-teal"><InterfaceText message="screen.82e5aec0f8b8" /></summary><ul className="mt-3 space-y-1">{exportSummary.sections.map(section=><li key={section.key}><AuthoredText text={section.label} />: {section.rows} registros{section.status!=="complete"?uiText("screen.e56bd17d4e7c"):""}</li>)}</ul></details></div>}
    </section>

    <section className="mt-6 bg-white border border-line rounded-2xl p-5 md:p-6">
      <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.fa438ea5f391" /></p><h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.ce5c25815edf" /></h2>
      <form onSubmit={createSupport} className="aligned-fields grid md:grid-cols-2 gap-4 mt-5">
        <label className="text-sm"><InterfaceText message="screen.54276aa0307f" /><select name="category" className="block w-full border rounded-card p-3 mt-2">{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}><AuthoredText text={label} /></option>)}</select></label>
        <label className="text-sm"><InterfaceText message="screen.72c1de5e2512" /><input name="subject" required minLength={3} maxLength={160} className="block w-full border rounded-card p-3 mt-2"/></label>
        <label className="md:col-span-2 text-sm"><InterfaceText message="screen.322085898310" /><textarea name="supportMessage" required minLength={10} maxLength={4000} rows={5} className="block w-full border rounded-card p-3 mt-2"/></label>
        <p className="md:col-span-2 text-xs text-ink-soft"><InterfaceText message="screen.2dff09b2e1e6" /></p>
        <button disabled={busy||!moduleReady} className="justify-self-start bg-teal text-white px-5 py-3 rounded-card disabled:opacity-50"><InterfaceText message="screen.6b75b906a980" /></button>
      </form>
      {requests.length>0&&<div className="mt-7 border-t border-line pt-5"><h3 className="font-display text-xl"><InterfaceText message="screen.a80de96d9716" /></h3><div className="space-y-4 mt-4">{requests.map(request=><article key={request.id} className="border border-line rounded-card p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-teal"><AuthoredText text={categoryLabels[request.category]} /></p><h4 className="font-medium mt-1">{request.subject}</h4></div><span className="text-xs bg-paper px-2 py-1 rounded-full self-start"><AuthoredText text={statusLabels[request.status]} /></span></div>
        <div className="space-y-2 mt-4">{(grouped[request.id]||[]).map(item=><div key={item.id} className={`text-sm rounded-card p-3 ${item.sender_type==="team"?"bg-teal-soft":"bg-paper"}`}><p>{item.message}</p><p className="text-[11px] text-ink-soft mt-2">{item.sender_type==="team"?"Equipe Scholar":uiText("screen.b21e91730d18")} · {new Date(item.created_at).toLocaleString(intlLocale(formatLocale))}</p></div>)}</div>
        {request.status!=="closed"&&<form onSubmit={e=>addMessage(request.id,e)} className="flex gap-2 mt-3"><input name="followup" required minLength={2} maxLength={4000} placeholder={uiText("screen.87aebd06e85c")} className="flex-1 min-w-0 border rounded-card px-3 py-2"/><button disabled={busy} className="text-sm text-teal border border-teal/30 px-3 rounded-card">Enviar</button></form>}
      </article>)}</div></div>}
    </section>

    <section className="mt-6 border border-red-200 bg-red-50 rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-2xl text-red-800"><InterfaceText message="screen.37642ff749e3" /></h2>
      {deletion?<><p className="text-sm text-red-800 mt-3"><InterfaceText message="screen.83c8ca720944" /> {new Date(deletion.requested_at).toLocaleDateString(intlLocale(formatLocale))}<InterfaceText message="screen.cff4571ad61f" /> {new Date(deletion.scheduled_for).toLocaleDateString(intlLocale(formatLocale))}.</p><p className="text-xs text-red-700 mt-2">{deletion.status==="processing"?uiText("screen.644ee30ec28f"):uiText("screen.a77ad857720d")}</p><button type="button" disabled={busy||deletion.status==="processing"} onClick={cancelDeletion} className="mt-4 bg-white border border-red-300 text-red-800 px-4 py-2 rounded-card"><InterfaceText message="screen.bb3e2d70bae8" /></button></>:<>
        <p className="text-sm text-red-800 mt-3"><InterfaceText message="screen.6a6f5afbef43" /></p>
        <label className="block text-sm text-red-900 mt-4"><InterfaceText message="screen.71a5083d9777" /> <strong>EXCLUIR</strong> para confirmar<input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className="block w-full max-w-sm border border-red-300 rounded-card p-3 mt-2 bg-white"/></label>
        <button type="button" disabled={busy||confirmText!=="EXCLUIR"||!moduleReady} onClick={requestDeletion} className="mt-4 bg-red-700 text-white px-5 py-3 rounded-card disabled:opacity-40"><InterfaceText message="screen.5eb0d1baa492" /></button>
      </>}
    </section>
  </div>;
}

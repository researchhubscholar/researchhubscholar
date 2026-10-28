"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {pendingGuards} from "@/lib/navigation/unsaved";
const indexKey="__scholarHistoryIndex";
export default function NavigationProtection(){
 const [mounted,setMounted]=useState(false);
 useEffect(()=>{setMounted(true);},[]);
 const [pending,setPending]=useState<{action:()=>void}|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const bypass=useRef(false),locked=useRef(false),dialog=useRef<HTMLDialogElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const pendingRef=useRef(pending);pendingRef.current=pending;
 useEffect(()=>{
  if(pending&&dialog.current&&!dialog.current.open){returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.current.showModal();}
  if(!pending){dialog.current?.close();returnFocus.current?.focus();}
 },[pending]);
 useEffect(()=>{
  function ask(action:()=>void){if(bypass.current||!pendingGuards().length)return false;if(!pendingRef.current){setError("");pendingRef.current={action};setPending({action});}return true;}
  function request(event:Event){const action=(event as CustomEvent).detail?.action;if(typeof action==="function"&&ask(action))event.preventDefault();}
  function click(event:MouseEvent){
   if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const anchor=event.target instanceof Element?event.target.closest("a[href]") as HTMLAnchorElement|null:null;
   if(!anchor||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return;
   const url=new URL(anchor.href,location.href);if(!["http:","https:"].includes(url.protocol))return;
   if(url.pathname===location.pathname&&url.search===location.search&&url.origin===location.origin)return;
   if(ask(()=>window.location.assign(url.href))){event.preventDefault();event.stopImmediatePropagation();}
  }
  function submit(event:SubmitEvent){
   const form=event.target;if(!(form instanceof HTMLFormElement)||form.method.toLowerCase()!=="get"||(form.target&&form.target!=="_self"))return;
   const url=new URL(form.action||location.href,location.href),query=new URLSearchParams();
   for(const [key,value] of new FormData(form))if(typeof value==="string")query.append(key,value);
   const button=event.submitter as HTMLButtonElement|null;if(button?.name)query.append(button.name,button.value);url.search=query.toString();
   if(ask(()=>window.location.assign(url.href))){event.preventDefault();event.stopImmediatePropagation();}
  }
  function unload(event:BeforeUnloadEvent){if(!bypass.current&&pendingGuards().length){event.preventDefault();event.returnValue="";}}
  // Preserve Next.js state while tagging same-document back/forward entries.
  const originalPush=history.pushState,originalReplace=history.replaceState;
  let current=Number(history.state?.[indexKey]??0),restoring=false;
  originalReplace.call(history,{...history.state,[indexKey]:current},"");
  history.pushState=function(state,unused,url){const next=current+1;originalPush.call(history,{...state,[indexKey]:next},unused,url);current=next;};
  history.replaceState=function(state,unused,url){originalReplace.call(history,{...state,[indexKey]:current},unused,url);};
  function pop(event:PopStateEvent){
   const next=event.state?.[indexKey];if(restoring){restoring=false;event.stopImmediatePropagation();return;}
   if(typeof next!=="number")return;
   if(!bypass.current&&pendingGuards().length&&next!==current){const delta=next-current;event.stopImmediatePropagation();restoring=true;history.go(-delta);ask(()=>history.go(delta));}else current=next;
  }
  window.addEventListener("scholar-request-navigation",request);document.addEventListener("click",click,true);document.addEventListener("submit",submit,true);window.addEventListener("beforeunload",unload);window.addEventListener("popstate",pop,true);
  return()=>{window.removeEventListener("scholar-request-navigation",request);document.removeEventListener("click",click,true);document.removeEventListener("submit",submit,true);window.removeEventListener("beforeunload",unload);window.removeEventListener("popstate",pop,true);history.pushState=originalPush;history.replaceState=originalReplace;};
 },[]);
 function leave(){if(!pendingRef.current)return;const action=pendingRef.current.action;pendingRef.current=null;bypass.current=true;setPending(null);try{action();}finally{window.setTimeout(()=>{bypass.current=false;},1000);}}
 async function saveAndLeave(){
  if(locked.current)return;locked.current=true;setSaving(true);setError("");
  try{for(const guard of pendingGuards()){if(guard.busy())throw new Error("Aguarde o salvamento em andamento e tente novamente.");if(guard.dirty()&&!await guard.save())throw new Error("Não foi possível confirmar o salvamento. Continue editando para conferir a mensagem e preservar seu rascunho.");}leave();}
  catch(caught){setError(caught instanceof Error?caught.message:"Não foi possível salvar. Seu rascunho continua aqui.");}finally{locked.current=false;setSaving(false);}
 }
 return !mounted?null:createPortal(<dialog ref={dialog} aria-labelledby="unsaved-title" className="rounded-2xl p-6 w-[min(32rem,calc(100vw-2rem))] backdrop:bg-black/40" onCancel={event=>{event.preventDefault();if(!locked.current)setPending(null);}}><h2 id="unsaved-title" className="font-display text-2xl">Há alterações neste trabalho</h2><p className="mt-3 text-sm text-ink-soft">Salve antes de sair para manter as alterações na sua conta. Se descartar, somente a versão já salva continuará disponível.</p>{error&&<p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}<div className="flex flex-wrap gap-3 mt-5"><button autoFocus type="button" disabled={saving} onClick={()=>setPending(null)} className="border rounded-card p-3">Continuar editando</button><button type="button" disabled={saving} onClick={()=>void saveAndLeave()} className="bg-teal text-white rounded-card p-3">{saving?"Salvando…":"Salvar e sair"}</button><button type="button" disabled={saving} onClick={()=>{if(pendingGuards().some(guard=>guard.busy())){setError("Aguarde a operação em andamento antes de sair.");return;}pendingGuards().forEach(guard=>guard.discard?.());leave();}} className="text-red-700 underline p-3">Descartar e sair</button></div></dialog>,document.body);
}

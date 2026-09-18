"use client";
import {useEffect,useRef,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/browser";
export default function ProjectSharing({projectId}:{projectId:string|null}){
 const [options,setOptions]=useState<{id:string;name:string}[]>([]);const [shares,setShares]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const epoch=useRef(0);const owner=useRef<string|null>(null);const busyRef=useRef(false);
 useEffect(()=>{const ticket=++epoch.current;setOptions([]);setShares([]);setMessage("");if(!projectId)return;const client=supabaseBrowser();
  void(async()=>{try{const {data:auth}=await client.auth.getUser();if(!auth.user||ticket!==epoch.current)return;owner.current=auth.user.id;
   const {data:own}=await client.from("research_projects").select("owner_id").eq("id",projectId).eq("owner_id",auth.user.id).maybeSingle();if(!own||ticket!==epoch.current)return;
   const [orgs,links]=await Promise.all([client.from("scholar_organizations").select("id,name"),client.from("scholar_project_shares").select("organization_id").eq("project_id",projectId)]);
   if(ticket!==epoch.current)return;if(orgs.error||links.error)return;setOptions(orgs.data||[]);setShares((links.data||[]).map(s=>s.organization_id));
  }catch{}})();
  const {data:listener}=client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||(event==="SIGNED_IN"&&owner.current&&session?.user.id!==owner.current)){++epoch.current;setOptions([]);setShares([]);owner.current=null;}});
  return()=>{++epoch.current;listener.subscription.unsubscribe();};
 },[projectId]);
 async function toggle(org:string,checked:boolean){if(busyRef.current||!projectId)return;if(checked&&!window.confirm("Compartilhar o protocolo e as notas deste projeto com a coordenação? Sua biblioteca e ideias pessoais não serão compartilhadas."))return;
  const ticket=epoch.current;busyRef.current=true;setBusy(true);setMessage("");try{const client=supabaseBrowser();const {data:auth}=await client.auth.getUser();if(auth.user?.id!==owner.current)throw new Error("Sua sessão mudou.");const {error}=await client.rpc("scholar_share_project",{p_project:projectId,p_org:org,p_share:checked});if(error)throw error;if(ticket!==epoch.current)return;setShares(ids=>checked?[...ids,org]:ids.filter(id=>id!==org));setMessage(checked?"Projeto compartilhado em modo de leitura.":"Compartilhamento retirado.");}catch{if(ticket===epoch.current)setMessage("Não foi possível alterar o compartilhamento.");}finally{busyRef.current=false;setBusy(false);}}
 if(!projectId||!options.length)return null;
 return <section className="mt-6 border border-line bg-white rounded-2xl p-5"><h3 className="font-display text-2xl">Compartilhar com a residência</h3><p className="text-sm text-ink-soft mt-3">A coordenação poderá ler o protocolo salvo e suas notas. Alterações precisam ser salvas para aparecer; você pode retirar o acesso.</p><div className="space-y-3 mt-4">{options.map(o=><label key={o.id} className="text-sm flex gap-2"><input type="checkbox" checked={shares.includes(o.id)} disabled={busy} onChange={e=>toggle(o.id,e.target.checked)} />{o.name}</label>)}</div>{message&&<p role="status" className="text-sm text-teal mt-3">{message}</p>}</section>;
}

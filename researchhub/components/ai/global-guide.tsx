"use client";
import { useEffect,useState } from "react";
import { usePathname,useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { emptyResults } from "@/lib/results/data";
import { areaForPath,guideScope } from "@/lib/ai/areas";
import { sourceIds,type SourceChoice } from "@/lib/ai/guide-sources";
import dynamic from "next/dynamic";
const ProjectGuide=dynamic(()=>import("./project-guide"),{ssr:false});
type Project={id:string;title:string|null;theme:string|null};
export default function GlobalGuide(){
 const path=usePathname(),params=useSearchParams(),area=areaForPath(path);
 const [incoming,setIncoming]=useState<{key:string;choices:SourceChoice[]}|null>(null);
 const [projects,setProjects]=useState<Project[]>([]),[selected,setSelected]=useState<Record<string,string>>({}),[ready,setReady]=useState(false);
 useEffect(()=>{if(!area){setProjects([]);setReady(false);return;}if(area==='resultados')return;let active=true;const db=supabaseBrowser();void (async()=>{try{const {data:{user}}=await db.auth.getUser();if(!active)return;if(!user){setProjects([]);setReady(false);return;}if(guideScope(area)==='general'){setProjects([]);setReady(true);return;}const {data}=await db.from('research_projects').select('id,title,theme').eq('owner_id',user.id).order('updated_at',{ascending:false});if(active){setProjects(data||[]);setReady(true);}}catch{if(active)setReady(false);}})();return()=>{active=false;};},[area,path]);
 const contextKey=path+params.toString()+JSON.stringify(selected);
 useEffect(()=>{if(area!=="biblioteca")return;const receive=(event:Event)=>{try{const choices=(event as CustomEvent).detail as SourceChoice[];sourceIds(choices.map(s=>s.id));setIncoming({key:contextKey,choices:choices.map(s=>({id:s.id,title:String(s.title).slice(0,200),abstractAvailable:Boolean(s.abstractAvailable),notesAvailable:Boolean(s.notesAvailable)}))});}catch{/* Invalid selection cannot reach the request. */}};window.addEventListener("scholar-guide-sources",receive);return()=>window.removeEventListener("scholar-guide-sources",receive);},[area,contextKey]);
 if(!area||area==='resultados'||!ready)return null;
 const scope=guideScope(area),routeId=scope==='general'?null:params.get(area==='protocolo'?'id':'projeto');
 const project=scope==='general'?undefined:projects.find(p=>p.id===(routeId||selected[area]));
 const picker=scope==='general'?<p className="text-xs mt-2">Conversa sem projeto · explore livremente suas ideias e dúvidas.</p>:<label className="block text-xs mt-2">{scope==='optional'?'Vincular a um projeto (opcional)':'Escolha o projeto aberto'}<select className="block w-full border rounded-card p-2 bg-white mt-1" value={project?.id||''} onChange={e=>{setSelected(s=>({...s,[area]:e.target.value}));if(routeId||scope==='project'){const next=new URLSearchParams(params.toString());const key=area==='protocolo'?'id':'projeto';if(e.target.value)next.set(key,e.target.value);else next.delete(key);window.location.assign(`${path}?${next}`);}}}><option value="">{scope==='optional'?'Conversa sem projeto':'Selecione um projeto'}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title||p.theme||'Sem título'}</option>)}</select>{routeId&&!project&&<span className="block mt-1">O projeto indicado não está disponível para esta conversa.</span>}</label>;
 return <ProjectGuide incomingSources={incoming?.key===contextKey?incoming.choices:undefined} key={project?.id||`unlinked:${area}`} projectId={project?.id||null} title={project?.title||project?.theme||(scope==='project'?'Selecione o projeto aberto':'Conversa sem projeto')} workspace={emptyResults} stage={0} question="" dirty={false} disabled={scope==='project'&&!project} source="clinical" area={area} projectPicker={picker} onNavigate={()=>false} onQuestion={()=>false}/>;
}

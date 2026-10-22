"use client";
import { useEffect,useState } from "react";
import { usePathname,useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { emptyResults } from "@/lib/results/data";
import { areaForPath } from "@/lib/ai/areas";
import dynamic from "next/dynamic";
const ProjectGuide=dynamic(()=>import("./project-guide"),{ssr:false});
type Project={id:string;title:string|null;theme:string|null};
export default function GlobalGuide(){
 const path=usePathname(),params=useSearchParams(),area=areaForPath(path);
 const [projects,setProjects]=useState<Project[]>([]),[selected,setSelected]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{if(!area){setProjects([]);setReady(false);return;}if(area==='resultados')return;let active=true;const db=supabaseBrowser();void (async()=>{const {data:{user}}=await db.auth.getUser();if(!active)return;if(!user){setProjects([]);setReady(false);return;}const {data,error}=await db.from('research_projects').select('id,title,theme').eq('owner_id',user.id).order('updated_at',{ascending:false});if(active&&!error){setProjects(data||[]);setReady(true);}})();return()=>{active=false;};},[area,path]);
 if(!area||area==='resultados'||!ready)return null;
 const routeId=params.get(area==='protocolo'?'id':'projeto'),project=projects.find(p=>p.id===(routeId||selected))||projects[0];
 if(routeId&&!projects.some(p=>p.id===routeId))return null;
 if(!project)return <div className="fixed bottom-5 right-5 z-40 rounded-card border bg-white p-3 shadow-md text-sm"><details><summary className="cursor-pointer">Assistente · primeiros passos</summary><p className="max-w-xs my-2">Comece por uma ideia e crie seu projeto. Depois o assistente poderá acompanhar suas etapas.</p><Link href="/ideias" className="text-teal underline">Preparar minha primeira ideia →</Link></details></div>;
 return <ProjectGuide key={project.id} projectId={project.id} title={project.title||project.theme||'Projeto sem título'} workspace={emptyResults} stage={0} question="" dirty={false} disabled={false} source="clinical" area={area} projectPicker={<label className="block text-xs mt-2">Projeto da conversa<select className="block w-full border rounded-card p-2 bg-white mt-1" value={project.id} onChange={e=>{setSelected(e.target.value);if(routeId)window.location.assign(`${path}?${area==='protocolo'?'id':'projeto'}=${encodeURIComponent(e.target.value)}`);}}>{projects.map(p=><option key={p.id} value={p.id}>{p.title||p.theme||'Sem título'}</option>)}</select></label>} onNavigate={()=>false} onQuestion={()=>false}/>;
}

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
export default async function SharedProject({searchParams}:{searchParams:Promise<{id?:string;programa?:string}>}){
 const params=await searchParams;const client=await supabaseServer();const {data:{user}}=await client.auth.getUser();
 if(!user)return <Link href="/login">Entre para visualizar o protocolo.</Link>;
 if(!params.id||!params.programa)return <p>Projeto indisponível.</p>;
 const {data:director,error:permissionError}=await client.rpc("scholar_is_director",{p_org:params.programa});
 if(permissionError||!director)return <p>Este projeto não está disponível para sua conta.</p>;
 const {data:share}=await client.from("scholar_project_shares").select("project_id").eq("project_id",params.id).eq("organization_id",params.programa).maybeSingle();
 if(!share)return <p>Este projeto não está compartilhado com o programa.</p>;
 const {data:project,error}=await client.from("research_projects").select("title,research_question,objective,hypothesis,study_type,population,primary_outcome,inclusion_criteria,exclusion_criteria,variables,methods,analysis_plan,ethics_notes,manuscript_notes,status,progress").eq("id",params.id).maybeSingle();
 if(error||!project)return <p>Não foi possível carregar o projeto.</p>;
 const labels={research_question:"Pergunta",objective:"Objetivo",hypothesis:"Hipótese (quando aplicável)",study_type:"Desenho",population:"População",primary_outcome:"Desfecho",inclusion_criteria:"Inclusão",exclusion_criteria:"Exclusão",variables:"Variáveis",methods:"Métodos",analysis_plan:"Análise",ethics_notes:"Ética",manuscript_notes:"Notas do manuscrito"};
 return <div className="max-w-4xl mx-auto"><Link href="/residencia" className="text-teal underline text-sm">← Coordenação</Link><p className="text-xs uppercase text-teal mt-6">Protocolo compartilhado · somente leitura</p><h1 className="font-display text-4xl mt-3">{project.title||"Projeto sem título"}</h1><p className="text-sm text-ink-soft mt-4">{project.status} · {project.progress}% dos campos preenchidos. Preenchimento não indica validação científica.</p><div className="space-y-4 mt-6">{Object.entries(labels).map(([key,label])=><section key={key} className="bg-white border border-line rounded-2xl p-5"><h2 className="font-medium">{label}</h2><p className="whitespace-pre-wrap text-sm text-ink-soft mt-3">{project[key as keyof typeof project]||"A definir"}</p></section>)}</div></div>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ResultsEditor from "@/components/results/editor";
export const dynamic = "force-dynamic";
export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  const db = await supabaseServer(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  const { projeto } = await searchParams; const { data: projects, error } = await db.from("research_projects").select("id,title,theme").eq("owner_id",user.id).order("updated_at",{ascending:false});
  const project = projects?.find(p=>p.id===projeto)||projects?.[0];
  return <div className="scholar-workspace secondary-page documents-page"><header className="documents-hero"><Link href={project?`/meu-trabalho?id=${project.id}`:"/dashboard"} className="text-teal text-sm">← Voltar ao projeto</Link><p className="text-xs uppercase tracking-widest text-teal mt-5">Dados e apresentação</p><h1 className="font-display text-4xl mt-3">Resultados e figuras</h1><p className="text-ink-soft mt-4">Organize dados sem identificação pessoal, confira a análise descritiva e prepare tabelas e figuras para o artigo.</p></header>{error?<p role="alert">Não foi possível carregar seus projetos.</p>:!project?<Link href="/meu-trabalho?novo=1">Crie um projeto para começar.</Link>:<><form className="my-6 flex gap-3 flex-wrap"><label className="text-sm">Projeto<select name="projeto" defaultValue={project.id} className="block border rounded-card p-3 mt-2">{projects?.map(p=><option key={p.id} value={p.id}>{p.title||p.theme||"Sem título"}</option>)}</select></label><button className="text-teal self-end p-3">Abrir projeto</button></form><ResultsEditor key={project.id} projectId={project.id} title={project.title||project.theme||"Resultados"}/></>}</div>;
}

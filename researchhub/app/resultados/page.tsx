import { RememberProjectStage } from "@/components/projects/project-resume";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import InterfaceText from "@/components/i18n/interface-text";
import ProjectChoice from "@/components/projects/project-choice";
import { selectedProject } from "@/lib/projects/selection";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ReviewMatrix from "@/components/results/review-matrix";
import ResultsEditor from "@/components/results/editor";
export const dynamic = "force-dynamic";
export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
  const db = await supabaseServer(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  const { projeto } = await searchParams; const { data: projects, error } = await db.from("research_projects").select("id,title,theme,research_question,study_type,population,inclusion_criteria,exclusion_criteria,primary_outcome,variables,methods,ethics_notes").eq("owner_id",user.id).order("updated_at",{ascending:false});
  const project = selectedProject(projects || [], projeto);
  if (!error && !project) return <ProjectChoice projects={projects || []} requested={projeto} path="/resultados" label="Resultados"/>;
  return <div className="scholar-workspace secondary-page documents-page">{project && !error && <RememberProjectStage ownerId={user.id} projectId={project.id} stage="results" />}<header className="documents-hero"><Link href={project?`/meu-trabalho?id=${project.id}`:"/dashboard"} className="text-teal text-sm"><InterfaceText message="screen.997879846ae5" /></Link><p className="text-xs uppercase tracking-widest text-teal mt-5"><InterfaceText message="screen.1c65ab5a4414" /></p><h1 className="font-display text-4xl mt-3"><InterfaceText message="screen.8631846ae294" /></h1><p className="text-ink-soft mt-4"><InterfaceText message="screen.bafc663a9b51" /></p></header>{error?<p role="alert"><InterfaceText message="screen.bd0e6b32780c" /></p>:!project?<Link href="/ideias"><InterfaceText message="screen.e8558bb78065" /></Link>:<><form className="workspace-project-picker my-6"><label><InterfaceText message="screen.91aec26f5cfe" /><select name="projeto" defaultValue={project.id} className="block border rounded-card p-3 mt-2">{projects?.map(p=><option key={p.id} value={p.id}>{p.title||p.theme||uiText("screen.9469c6553b75")}</option>)}</select></label><button className="workspace-project-picker-action"><InterfaceText message="screen.7577403dd89e" /></button></form>{/revis[aã]o|revisi[oó]n|review|meta[- ]?an[aá]l[ií]s[ei]/i.test(project.study_type||"") ? <ReviewMatrix key={project.id} projectId={project.id}/> : <ResultsEditor key={project.id} projectId={project.id} title={project.title||project.theme||"Resultados"} protocol={project}/>}</>}</div>;
}

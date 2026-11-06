import InterfaceText from "@/components/i18n/interface-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import ProjectChoice from "@/components/projects/project-choice";
import { selectedProject } from "@/lib/projects/selection";
import Link from "next/link";
import { redirect } from "next/navigation";
import ManuscriptEditor from "@/components/manuscript/manuscript-editor";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManuscriptPage({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const { data: projects, error: projectError } = await db.from("research_projects").select("id,owner_id,title,theme,research_question,objective,study_type,population,inclusion_criteria,exclusion_criteria,primary_outcome,variables,methods,analysis_plan,ethics_notes").order("updated_at", { ascending: false });
  if (projectError) return <p role="alert"><InterfaceText message="screen.24d611e2acfd" /></p>;
  const project = selectedProject(projects || [], params.projeto);
  if (!project) return <ProjectChoice projects={projects || []} requested={params.projeto} path="/manuscrito" label="Manuscrito"/>;

  const isOwner = project.owner_id === user.id;
  const manuscriptResult = await db.from("scholar_manuscripts").select("*").eq("project_id", project.id).maybeSingle();
  const schemaMissing = Boolean(manuscriptResult.error && (manuscriptResult.error.code === "42P01" || manuscriptResult.error.message?.includes("schema cache")));
  if (schemaMissing) return <main className="scholar-workspace max-w-4xl mx-auto"><Link href={isOwner ? `/meu-trabalho?id=${project.id}` : `/orientacao?projeto=${project.id}`} className="text-sm text-teal">{isOwner ? <InterfaceText message="screen.997879846ae5" /> : uiText("nav.advising")}</Link><section className="bg-white border border-line rounded-2xl p-7 mt-6"><p className="text-xs uppercase tracking-widest text-teal">Editor de manuscrito</p><h1 className="font-display text-3xl mt-3"><InterfaceText message="screen.e400c3a5bd3e" /></h1><p className="text-ink-soft mt-3"><InterfaceText message="screen.d8f2c21fbc7e" /> <strong>scholar_manuscript.sql</strong><InterfaceText message="screen.104ec3ce9ee9" /></p></section></main>;
  if(manuscriptResult.error) return <p role="alert"><InterfaceText message="screen.436ec074a27c" /></p>;
  const manuscript = manuscriptResult.data;
  const [sectionsResult, versionsResult, { data: directArticles }, { data: links }, commentsResult] = await Promise.all([
    manuscript ? db.from("scholar_manuscript_sections").select("section_key,heading,content,position,updated_at").eq("manuscript_id", manuscript.id).order("position") : Promise.resolve({ data: [], error: null }),
    manuscript ? db.from("scholar_manuscript_versions").select("id,label,snapshot,created_at").eq("manuscript_id", manuscript.id).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [], error: null }),
    isOwner ? db.from("library_articles").select("id,title,authors,journal,publication_year,pmid,doi,abstract").eq("owner_id", user.id).eq("project_id", project.id) : Promise.resolve({ data: [] }),
    isOwner ? db.from("library_article_projects").select("article_id").eq("owner_id", user.id).eq("project_id", project.id) : Promise.resolve({ data: [] }),
    manuscript ? db.from("scholar_manuscript_comments").select("id,manuscript_id,project_id,author_id,section_key,body,quoted_text,status,resolved_at,resolved_by,created_at").eq("manuscript_id", manuscript.id).order("created_at") : Promise.resolve({ data: [], error: null }),
  ]);
  if(sectionsResult.error || versionsResult.error) return <p role="alert"><InterfaceText message="screen.52026fadc308" /></p>;
  const sections=sectionsResult.data, versions=versionsResult.data;
  const linkedIds = (links || []).map(row => row.article_id);
  const { data: linkedArticles } = linkedIds.length ? await db.from("library_articles").select("id,title,authors,journal,publication_year,pmid,doi,abstract").eq("owner_id", user.id).in("id", linkedIds) : { data: [] };
  const articleMap = new Map([...(directArticles || []), ...(linkedArticles || [])].map(article => [article.id, article]));
  const articleIds = [...articleMap.keys()];
  const { data: evidence } = isOwner && articleIds.length ? await db.from("evidence_matrix").select("article_id,objective,population,method,main_finding,limitation,notes,sample_size,intervention,comparator,outcomes,evidence_level,risk_of_bias").eq("owner_id", user.id).in("article_id", articleIds) : { data: [] };
  const writingArticles = [...articleMap.values()].map(article => ({ ...article, evidence: (evidence || []).find(row => row.article_id === article.id) || null }));
  const reviewAvailable = !commentsResult.error || !["42P01", "PGRST205"].includes(commentsResult.error.code || "");
  const comments = commentsResult.data || [];
  const commentIds = comments.map(comment => comment.id);
  const { data: replies } = reviewAvailable && commentIds.length
    ? await db.from("scholar_manuscript_comment_replies").select("id,comment_id,author_id,body,created_at").in("comment_id", commentIds).order("created_at")
    : { data: [] };

  return <main className="scholar-workspace manuscript-page max-w-7xl mx-auto">
    <header className="flex flex-wrap justify-between items-start gap-5 mb-7"><div><Link href={isOwner ? `/meu-trabalho?id=${project.id}` : `/orientacao?projeto=${project.id}`} className="text-sm text-teal">{isOwner ? <InterfaceText message="screen.997879846ae5" /> : uiText("nav.advising")}</Link><p className="text-xs uppercase tracking-widest text-teal mt-5"><InterfaceText message="screen.85dd6475b1a8" /></p><h1 className="font-display text-4xl md:text-5xl mt-3">{isOwner ? "Editor de manuscrito" : (requestLocale==="es"?"Revisión del manuscrito":"Revisão do manuscrito")}</h1><p className="text-ink-soft mt-3 max-w-2xl">{isOwner ? <InterfaceText message="screen.a24567ecb3ee" /> : requestLocale==="es"?"Lee el texto y comenta por sección.":"Leia o texto e deixe comentários por seção."}</p></div><form method="get" className="workspace-project-picker manuscript-project-picker"><label><InterfaceText message="screen.91aec26f5cfe" /><select name="projeto" defaultValue={project.id} className="block w-full border border-line rounded-card p-2 mt-2 bg-paper">{(projects || []).map(item => <option key={item.id} value={item.id}>{item.title || item.theme || uiText("screen.53d02a124b87")}</option>)}</select></label><button className="workspace-project-picker-action">Abrir manuscrito →</button></form></header>
    <ManuscriptEditor currentUserId={user.id} ownerId={project.owner_id} canEdit={isOwner} project={project} initialManuscript={manuscript} initialSections={sections || []} initialVersions={versions || []} initialComments={comments} initialReplies={replies || []} reviewAvailable={reviewAvailable} articles={writingArticles} />
  </main>;
}

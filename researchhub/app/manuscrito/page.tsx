import Link from "next/link";
import { redirect } from "next/navigation";
import ManuscriptEditor from "@/components/manuscript/manuscript-editor";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ManuscriptPage({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const { data: projects } = await db.from("research_projects").select("id,owner_id,title,theme,research_question,objective,study_type").order("updated_at", { ascending: false });
  const project = (projects || []).find(item => item.id === params.projeto) || (projects || [])[0];
  if (!project) return <main className="scholar-workspace max-w-4xl mx-auto"><Link href="/dashboard" className="text-sm text-teal">← Meu espaço</Link><section className="bg-white border border-line rounded-2xl p-7 mt-6"><h1 className="font-display text-3xl">Crie um projeto antes de escrever o artigo.</h1><p className="text-ink-soft mt-3">O manuscrito fica ligado ao protocolo, às referências e à matriz de evidências.</p><Link href="/meu-trabalho?novo=1" className="inline-block mt-5 bg-teal text-white rounded-card px-5 py-3">Criar projeto</Link></section></main>;

  const isOwner = project.owner_id === user.id;
  const manuscriptResult = await db.from("scholar_manuscripts").select("*").eq("project_id", project.id).maybeSingle();
  const schemaMissing = Boolean(manuscriptResult.error && (manuscriptResult.error.code === "42P01" || manuscriptResult.error.message?.includes("schema cache")));
  if (schemaMissing) return <main className="scholar-workspace max-w-4xl mx-auto"><Link href={`/meu-trabalho?id=${project.id}`} className="text-sm text-teal">← Voltar ao projeto</Link><section className="bg-white border border-line rounded-2xl p-7 mt-6"><p className="text-xs uppercase tracking-widest text-teal">Editor de manuscrito</p><h1 className="font-display text-3xl mt-3">Ative o novo módulo no Supabase.</h1><p className="text-ink-soft mt-3">Execute o arquivo <strong>scholar_manuscript.sql</strong>. O projeto e os textos atuais não serão alterados.</p></section></main>;
  const manuscript = manuscriptResult.data;
  const [{ data: sections }, { data: versions }, { data: directArticles }, { data: links }, commentsResult] = await Promise.all([
    manuscript ? db.from("scholar_manuscript_sections").select("section_key,heading,content,position,updated_at").eq("manuscript_id", manuscript.id).order("position") : Promise.resolve({ data: [] }),
    manuscript ? db.from("scholar_manuscript_versions").select("id,label,snapshot,created_at").eq("manuscript_id", manuscript.id).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    isOwner ? db.from("library_articles").select("id,title,authors,publication_year,pmid,doi").eq("owner_id", user.id).eq("project_id", project.id) : Promise.resolve({ data: [] }),
    isOwner ? db.from("library_article_projects").select("article_id").eq("owner_id", user.id).eq("project_id", project.id) : Promise.resolve({ data: [] }),
    manuscript ? db.from("scholar_manuscript_comments").select("id,manuscript_id,project_id,author_id,section_key,body,quoted_text,status,resolved_at,resolved_by,created_at").eq("manuscript_id", manuscript.id).order("created_at") : Promise.resolve({ data: [], error: null }),
  ]);
  const linkedIds = (links || []).map(row => row.article_id);
  const { data: linkedArticles } = linkedIds.length ? await db.from("library_articles").select("id,title,authors,publication_year,pmid,doi").eq("owner_id", user.id).in("id", linkedIds) : { data: [] };
  const articleMap = new Map([...(directArticles || []), ...(linkedArticles || [])].map(article => [article.id, article]));
  const reviewAvailable = !commentsResult.error || !["42P01", "PGRST205"].includes(commentsResult.error.code || "");
  const comments = commentsResult.data || [];
  const commentIds = comments.map(comment => comment.id);
  const { data: replies } = reviewAvailable && commentIds.length
    ? await db.from("scholar_manuscript_comment_replies").select("id,comment_id,author_id,body,created_at").in("comment_id", commentIds).order("created_at")
    : { data: [] };

  return <main className="scholar-workspace manuscript-page max-w-7xl mx-auto">
    <header className="flex flex-wrap justify-between items-start gap-5 mb-7"><div><Link href={`/meu-trabalho?id=${project.id}`} className="text-sm text-teal">← Voltar ao projeto</Link><p className="text-xs uppercase tracking-widest text-teal mt-5">Produção do artigo</p><h1 className="font-display text-4xl md:text-5xl mt-3">Editor de manuscrito</h1><p className="text-ink-soft mt-3 max-w-2xl">Escreva por seções, preserve versões e cite as referências vinculadas ao projeto.</p></div><form method="get" className="bg-white border border-line rounded-card p-4 min-w-[260px]"><label className="text-xs text-ink-soft">Projeto<select name="projeto" defaultValue={project.id} className="block w-full border border-line rounded-card p-2 mt-2 bg-paper">{(projects || []).map(item => <option key={item.id} value={item.id}>{item.title || item.theme || "Projeto sem título"}</option>)}</select></label><button className="text-sm text-teal mt-3">Abrir manuscrito →</button></form></header>
    <ManuscriptEditor currentUserId={user.id} ownerId={project.owner_id} canEdit={isOwner} project={project} initialManuscript={manuscript} initialSections={sections || []} initialVersions={versions || []} initialComments={comments} initialReplies={replies || []} reviewAvailable={reviewAvailable} articles={[...articleMap.values()]} />
  </main>;
}

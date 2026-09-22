import Link from "next/link";
import { redirect } from "next/navigation";
import DocumentCenter from "@/components/documents/document-center";
import type { EvidenceNote, LibraryArticle } from "@/lib/literature/library-store";
import { fromArticleRow } from "@/lib/literature/library-store";
import type { ProjectDocumentData } from "@/lib/exports/scientific";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const projectSelection="id,title,theme,research_question,objective,hypothesis,study_type,population,inclusion_criteria,exclusion_criteria,primary_outcome,variables,methods,analysis_plan,ethics_notes,manuscript_notes,status,progress,updated_at";
const milestoneLabels:Record<string,string>={theme:"Tema e recorte",question:"Pergunta e objetivos",literature:"Revisão da literatura",design:"Desenho e métodos",ethics:"Ética e autorizações",collection:"Coleta ou seleção",analysis:"Análise",writing:"Escrita e revisão",submission:"Entrega ou submissão"};

export default async function DocumentsPage({searchParams}:{searchParams:Promise<{projeto?:string}>}) {
  const db=await supabaseServer();
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect("/login");
  const params=await searchParams;
  const [{data:projects,error:projectError},{data:profile}]=await Promise.all([
    db.from("research_projects").select(projectSelection).eq("owner_id",user.id).order("updated_at",{ascending:false}),
    db.from("profiles").select("name,institution,specialty,training_stage").eq("id",user.id).maybeSingle(),
  ]);
  if(projectError) return <Message title="Não foi possível carregar seus projetos." text="Atualize a página para tentar novamente." />;
  const project=(projects||[]).find(item=>item.id===params.projeto)||(projects||[])[0];
  if(!project) return <div className="max-w-4xl mx-auto"><Link href="/dashboard" className="text-sm text-teal">← Meu espaço</Link><Message title="Crie um projeto antes de gerar documentos." text="A central usa os campos do construtor científico, a jornada e as leituras vinculadas."/><Link href="/meu-trabalho?novo=1" className="inline-block mt-5 bg-teal text-white rounded-card px-5 py-3">Criar projeto</Link></div>;
  const [{data:articleRows},{data:linkRows},{data:noteRows},{data:milestoneRows}]=await Promise.all([
    db.from("library_articles").select("*").eq("owner_id",user.id),
    db.from("library_article_projects").select("article_id,project_id").eq("owner_id",user.id).eq("project_id",project.id),
    db.from("evidence_matrix").select("*").eq("owner_id",user.id),
    db.from("scholar_project_milestones").select("milestone_key,status,note,due_date,position").eq("owner_id",user.id).eq("project_id",project.id).order("position"),
  ]);
  const linked=new Set((linkRows||[]).map(row=>row.article_id));
  const articles:LibraryArticle[]=(articleRows||[]).filter(row=>row.project_id===project.id||linked.has(row.id)).map(row=>({...fromArticleRow(row),projectIds:[project.id]}));
  const articleIds=new Set(articles.map(article=>article.id));
  const notes:Record<string,EvidenceNote>={};
  for(const row of noteRows||[]) if(articleIds.has(row.article_id)) notes[row.article_id]={objective:row.objective||"",population:row.population||"",method:row.method||"",finding:row.main_finding||"",limitation:row.limitation||"",sampleSize:row.sample_size||"",intervention:row.intervention||"",comparator:row.comparator||"",outcomes:row.outcomes||"",evidenceLevel:row.evidence_level||"",riskOfBias:row.risk_of_bias||"",generalNotes:row.notes||""};
  const value=(input:unknown)=>typeof input==="string"?input:"";
  const data:ProjectDocumentData={
    project:{id:project.id,title:value(project.title),theme:value(project.theme),question:value(project.research_question),objective:value(project.objective),hypothesis:value(project.hypothesis),studyType:value(project.study_type),population:value(project.population),inclusion:value(project.inclusion_criteria),exclusion:value(project.exclusion_criteria),outcome:value(project.primary_outcome),variables:value(project.variables),methods:value(project.methods),analysis:value(project.analysis_plan),ethics:value(project.ethics_notes),manuscript:value(project.manuscript_notes),status:value(project.status),progress:Number(project.progress)||0,updatedAt:value(project.updated_at)},
    profile:{name:value(profile?.name)||value(user.user_metadata?.name)||value(user.email?.split("@")[0]),institution:value(profile?.institution),specialty:value(profile?.specialty),trainingStage:value(profile?.training_stage)},
    articles,notes,
    milestones:(milestoneRows||[]).map(row=>({key:row.milestone_key,label:milestoneLabels[row.milestone_key]||row.milestone_key,status:row.status,note:row.note||"",dueDate:row.due_date||""})),
    generatedAt:new Date().toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}),
  };
  return <div className="max-w-5xl mx-auto">
    <div className="flex flex-wrap justify-between gap-4 items-start"><div><Link href={`/meu-trabalho?id=${project.id}`} className="text-sm text-teal">← Voltar ao projeto</Link><p className="text-xs uppercase tracking-widest text-teal mt-5">Produção científica</p><h1 className="font-display text-4xl md:text-5xl mt-3">Central de documentos</h1><p className="text-ink-soft mt-4 max-w-2xl leading-relaxed">Transforme os registros do projeto, da jornada e da biblioteca em materiais organizados para revisar, discutir e exportar.</p></div>
      <form method="get" className="bg-white border border-line rounded-card p-4 min-w-[260px]"><label className="text-xs text-ink-soft">Projeto selecionado<select name="projeto" defaultValue={project.id} className="block w-full border border-line rounded-card p-2 mt-2 bg-paper">{(projects||[]).map(item=><option key={item.id} value={item.id}>{item.title||item.theme||"Projeto sem título"}</option>)}</select></label><button className="text-sm text-teal mt-3">Abrir documentos deste projeto →</button></form>
    </div>
    <DocumentCenter data={data}/>
  </div>;
}

function Message({title,text}:{title:string;text:string}) { return <section className="bg-white border border-line rounded-2xl p-7 mt-6"><h1 className="font-display text-3xl">{title}</h1><p className="text-sm text-ink-soft mt-3">{text}</p></section>; }

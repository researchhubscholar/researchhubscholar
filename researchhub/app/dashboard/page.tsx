import { isAdvisorOnly } from "@/lib/access/advisor-mode";
import { intlLocale } from "@/lib/i18n/format";
import AuthoredText from "@/components/i18n/authored-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import InterfaceText from "@/components/i18n/interface-text";
import DeleteProject from "@/components/projects/delete-project";
import DemoResume from "@/components/access/demo-resume";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildProfileDiagnosis } from "@/lib/research/profile-diagnosis";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const tools = [
  { href: "/ideias", tag: "01 · Explorar", title: "Encontre uma direção", text: "Compare possibilidades de pesquisa com seu prazo, população e acesso a dados." },
  { href: "/descobrir", tag: "02 · Investigar", title: "Consulte a literatura", text: "Explore artigos reais do PubMed, tipos de estudo e evolução das publicações." },
  { href: "/biblioteca", tag: "03 · Organizar", title: "Leia com propósito", text: "Organize artigos e registre sua leitura na matriz de evidências." },
  { href: "/documentos", tag: "04 · Comunicar", title: "Prepare seus documentos", text: "Gere protocolo, resumo, relatório de orientação e matriz a partir dos dados do projeto." },
  { href: "/orientacao", tag: "05 · Revisar", title: "Trabalhe com o orientador", text: "Compartilhe um projeto, organize comentários, reuniões, pendências e versões." },
];
export default async function DashboardPage() {
 const formatLocale=await getRequestLocale();

  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  if (await isAdvisorOnly(db, user.id)) redirect("/orientacao");
  const [profileResult, diagnosisResult, projectResult, unreadResult] = await Promise.all([
    db.from("profiles").select("name, specialty, training_stage, onboarding_completed").eq("id", user.id).maybeSingle(),
    db.from("profiles").select("main_goal,research_experience,weekly_availability,project_deadline,advisor_access,data_access,current_research_stage,main_difficulty,onboarding_version").eq("id", user.id).maybeSingle(),
    db.from("research_projects").select("id,title,theme,research_question,objective,study_type,population,primary_outcome,methods,analysis_plan,progress,updated_at,status").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    db.from("library_articles").select("id", { count: "exact", head: true }).eq("owner_id", user.id).in("reading_status", ["unread","reading"]),
  ]);
  const profile = profileResult.data;
  const diagnosisProfile = diagnosisResult.data;
  const projects = projectResult.data ?? [];
  const latest = projects[0];
  const milestoneResult = latest ? await db.from("scholar_project_milestones").select("milestone_key,status,note,due_date,position").eq("owner_id", user.id).eq("project_id", latest.id).neq("status", "done").order("position").limit(1).maybeSingle() : null;
  const nextMilestone = milestoneResult?.data;
  const milestoneLabels: Record<string,string> = { theme:"Tema e recorte", question:"Pergunta e objetivos", literature:"Revisão da literatura", design:"Desenho e métodos", ethics:"Ética e autorizações", collection:"Coleta ou seleção", analysis:"Análise", writing:"Escrita e revisão", submission:"Entrega ou submissão" };
  const name = profile?.name?.split(" ")[0] || user.user_metadata?.name?.split(" ")[0] || "pesquisador";
  const diagnosis = buildProfileDiagnosis(diagnosisProfile || {});
  const missingProjectFields = latest ? [latest.research_question,latest.objective,latest.study_type,latest.population,latest.primary_outcome,latest.methods,latest.analysis_plan].filter(value=>!value?.trim()).length : 0;
  const pendencies: { label:string; text:string; href:string; action:string; tone?:"alert" }[] = [];
  if (!diagnosisProfile?.onboarding_version || diagnosisProfile.onboarding_version < 2) pendencies.push({label:"Diagnóstico",text:"Complete contexto, prazo, acesso a dados e principal dificuldade para personalizar sua jornada.",href:"/scholar/onboarding",action:"Completar diagnóstico"});
  if (!latest) pendencies.push({label:"Primeiro projeto",text:"Registre uma ideia real para começar a transformar o tema em decisões de pesquisa.",href:"/ideias",action:"Explorar ideias"});
  if (latest && missingProjectFields) pendencies.push({label:"Estrutura científica",text:`${missingProjectFields} decisões centrais ainda estão sem registro no projeto mais recente.`,href:`/meu-trabalho?id=${latest.id}`,action:"Completar projeto"});
  if (latest && nextMilestone) pendencies.push({label:milestoneLabels[nextMilestone.milestone_key] || "Próxima etapa",text:`${nextMilestone.note || "Defina a próxima ação concreta para avançar."}${nextMilestone.due_date ? ` Prazo: ${new Date(`${nextMilestone.due_date}T12:00:00Z`).toLocaleDateString(intlLocale(formatLocale), { timeZone: "UTC" })}.` : ""}`,href:`/meu-trabalho?id=${latest.id}`,action:"Abrir jornada"});
  if ((unreadResult.count || 0) > 0) pendencies.push({label:"Leitura pendente",text:`${unreadResult.count} artigo${unreadResult.count === 1 ? " aguarda" : "s aguardam"} leitura ou avaliação na biblioteca.`,href:latest?`/biblioteca?projeto=${latest.id}`:"/biblioteca",action:"Revisar artigos"});
  diagnosis.alerts.slice(0,2).forEach((text,index)=>pendencies.push({label:index===0?"Atenção de viabilidade":"Atenção de planejamento",text,href:"/scholar/onboarding",action:"Rever diagnóstico",tone:"alert"}));
  return <div className="scholar-workspace dashboard-page max-w-5xl mx-auto"><DemoResume />
    <section className="workspace-hero workspace-hero-refined bg-ink text-white rounded-2xl p-6 md:p-10 relative overflow-hidden">
      <p className="text-xs uppercase tracking-widest text-teal-soft"><InterfaceText message="screen.044bb68cf0c8" /></p>
      <h1 className="font-display text-4xl md:text-5xl mt-4"><InterfaceText message="screen.85fe1ca05112" /> {name}<InterfaceText message="screen.5f2be26535f9" /></h1>
      <p className="text-white/70 mt-4 max-w-2xl leading-relaxed"><InterfaceText message="screen.5b095e7adf65" /></p>
      <div className="workspace-hero-actions flex flex-wrap gap-3 mt-6"><Link href={latest ? `/meu-trabalho?id=${latest.id}` : "/ideias"} className="workspace-primary-action bg-white text-ink rounded-card px-5 py-3 font-medium">{latest ? uiText("screen.f126b8644562") : uiText("screen.a1ce526d0102")}</Link><Link href="/ideias" className="workspace-secondary-action border border-white/30 rounded-card px-5 py-3"><InterfaceText message="screen.c260f7a00b7e" /></Link></div>
    </section>
    {profile && !profile.onboarding_completed && <div className="mt-5 bg-teal-soft border border-teal/20 p-4 rounded-card text-sm"><InterfaceText message="screen.fdb6161f386c" /> <Link href="/scholar/onboarding" className="text-teal font-medium underline">Completar perfil</Link></div>}
    <section className="workspace-metrics workspace-summary grid sm:grid-cols-3 gap-4 mt-6" aria-label={uiText("screen.5136cb0f7b19")}>
      <Metric value={String(projects.length)} label={uiText("screen.fe1a547c005d")} />
      <Metric value={latest ? `${latest.progress}%` : "0%"} label={uiText("screen.0002444feeaa")} />
      <Metric value={profile?.specialty || "Sua área"} label={uiText("screen.2662ba74eebc")} />
    </section>
    <section className="workspace-priorities mt-7" aria-labelledby="pendencies-title"><div className="flex flex-wrap justify-between gap-4 items-end"><div><p className="text-xs uppercase tracking-widest text-teal">Prioridades organizadas</p><h2 id="pendencies-title" className="font-display text-3xl mt-2"><InterfaceText message="screen.2ba1d795bc48" /></h2><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.8309024bb94b" /></p></div><Link href="/scholar/onboarding" className="text-sm text-teal font-medium"><InterfaceText message="screen.8cc1636e9ba7" /></Link></div>
      {pendencies.length?<div className="grid md:grid-cols-2 gap-3 mt-5">{pendencies.slice(0,6).map((item,index)=><article key={`${<AuthoredText text={item.label} />}-${index}`} className={`workspace-priority-card rounded-2xl p-5 border ${index===0?"workspace-priority-main ":""}${item.tone==="alert"?"bg-amber-50 border-amber-200":"bg-white border-line"}`}><div className="flex items-start gap-3"><span className="font-mono text-xs text-teal bg-teal-soft rounded-card px-2 py-1">{String(index+1).padStart(2,"0")}</span><div><h3 className="font-medium">{<AuthoredText text={item.label} />}</h3><p className="text-sm text-ink-soft mt-2 leading-relaxed"><AuthoredText text={item.text} /></p><Link href={item.href} className="inline-block text-sm text-teal font-medium mt-4">{<AuthoredText text={item.action} />} →</Link></div></div></article>)}</div>:<div className="mt-5 bg-teal-soft border border-teal/20 rounded-2xl p-5"><h3 className="font-display text-xl"><InterfaceText message="screen.cbde788996b1" /></h3><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.a62ba396ea10" /></p></div>}
    </section>
    <section className="workspace-projects mt-10"><div className="flex justify-between gap-4 items-center flex-wrap"><h2 className="font-display text-3xl"><InterfaceText message="screen.cda8f82beaff" /></h2><Link href="/ideias" className="text-sm font-medium text-teal"><InterfaceText message="screen.d0349e9f37ef" /></Link></div>
      {projectResult.error ? <p role="alert" className="mt-5 text-sm text-red-700 bg-red-50 rounded-card p-4"><InterfaceText message="screen.a98718a2cf34" /></p> : projects.length ? <div className="grid md:grid-cols-2 gap-4 mt-5">{projects.map(project => <article key={project.id} className="workspace-project-card bg-white border border-line rounded-2xl p-5 hover:border-teal transition-colors">
        <p className="text-xs text-teal uppercase tracking-wider">{project.status === "completed" ? uiText("screen.2801cb53f1fa") : uiText("screen.90e590455651")}</p><h3 className="font-display text-2xl mt-3 leading-snug"><Link href={`/meu-trabalho?id=${project.id}`}>{project.title || project.theme || uiText("screen.53d02a124b87")}</Link></h3><p className="text-sm text-ink-soft mt-2">{project.study_type || uiText("screen.ec3f971e3a83")}</p>
        <div className="h-1.5 bg-line rounded-full overflow-hidden mt-5"><div className="h-full bg-teal" style={{ width: `${project.progress}%` }} /></div><div className="flex justify-between text-xs text-ink-soft mt-2"><span>{project.progress}<InterfaceText message="screen.aa45fbec40d5" /></span><span><InterfaceText message="screen.8df407f3980d" /> {new Date(project.updated_at).toLocaleDateString(intlLocale(formatLocale), { timeZone: "UTC" })}</span></div>
        <nav aria-label={`Ferramentas de ${project.title || project.theme || "projeto"}`} className="mt-5 flex flex-wrap gap-x-4 gap-y-3 border-t border-line pt-4 text-sm text-teal">{[["Projeto", `/meu-trabalho?id=${project.id}`], ["Radar", `/descobrir?${new URLSearchParams({projeto: project.id, tema: project.research_question || project.theme || project.title || "", origem: "projeto"})}`], ["Biblioteca", `/biblioteca?projeto=${project.id}`], ["Escrever artigo", `/manuscrito?projeto=${project.id}`], ["Orientação", `/orientacao?projeto=${project.id}`], ["Documentos", `/documentos?projeto=${project.id}`]].map(([label, href]) => <Link key={label} href={href} className="underline"><AuthoredText text={label} /></Link>)}</nav>
      <DeleteProject id={project.id} title={project.title || project.theme || uiText("screen.53d02a124b87")} ownerId={user.id} /></article>)}</div> : <div className="bg-white border border-dashed border-line rounded-2xl p-8 mt-5"><h3 className="font-display text-2xl"><InterfaceText message="screen.972d7db4eef9" /></h3><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.c1a58efff488" /></p><Link href="/ideias" className="inline-block mt-4 text-teal font-medium text-sm"><InterfaceText message="screen.20bc648052f8" /></Link></div>}
    </section>
    <section className="grid sm:grid-cols-2 gap-4 mt-8" aria-label={uiText("screen.4c5d768901ee")}><Link href="/licenca" className="workspace-shortcut bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.ffbd105f0426" /></h2><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.23ecaf0c5db2" /></p></Link><Link href="/residencia" className="workspace-shortcut bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.c713e9fbf79d" /></h2><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.5b6ed3e54db5" /></p></Link></section>
    <section className="workspace-tools mt-10"><h2 className="font-display text-3xl"><InterfaceText message="screen.f6d4f3998459" /></h2><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">{tools.map(tool => <Link key={tool.href} href={tool.href} className="workspace-tool-card bg-white border border-line rounded-2xl p-5 hover:border-teal"><p className="text-xs uppercase tracking-wider text-teal">{<AuthoredText text={tool.tag} />}</p><h3 className="font-display text-xl mt-4">{<AuthoredText text={tool.title} />}</h3><p className="text-sm text-ink-soft mt-3 leading-relaxed">{<AuthoredText text={tool.text} />}</p><span className="text-teal text-sm inline-block mt-5"><InterfaceText message="screen.c59a1c232ec1" /></span></Link>)}</div></section>
  </div>;
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="bg-white border border-line rounded-card p-5"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-2"><AuthoredText text={label} /></p></div>; }

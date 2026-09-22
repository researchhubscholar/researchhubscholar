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
];
export default async function DashboardPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
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
  if (latest && nextMilestone) pendencies.push({label:milestoneLabels[nextMilestone.milestone_key] || "Próxima etapa",text:`${nextMilestone.note || "Defina a próxima ação concreta para avançar."}${nextMilestone.due_date ? ` Prazo: ${new Date(`${nextMilestone.due_date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}.` : ""}`,href:`/meu-trabalho?id=${latest.id}`,action:"Abrir jornada"});
  if ((unreadResult.count || 0) > 0) pendencies.push({label:"Leitura pendente",text:`${unreadResult.count} artigo${unreadResult.count === 1 ? " aguarda" : "s aguardam"} leitura ou avaliação na biblioteca.`,href:latest?`/biblioteca?projeto=${latest.id}`:"/biblioteca",action:"Revisar artigos"});
  diagnosis.alerts.slice(0,2).forEach((text,index)=>pendencies.push({label:index===0?"Atenção de viabilidade":"Atenção de planejamento",text,href:"/scholar/onboarding",action:"Rever diagnóstico",tone:"alert"}));
  return <div className="max-w-5xl mx-auto"><DemoResume />
    <section className="bg-ink text-white rounded-2xl p-6 md:p-10 relative overflow-hidden">
      <p className="text-xs uppercase tracking-widest text-teal-soft">Seu espaço de pesquisa</p>
      <h1 className="font-display text-4xl md:text-5xl mt-4">Olá, {name}. Qual é o próximo passo?</h1>
      <p className="text-white/70 mt-4 max-w-2xl leading-relaxed">Da primeira pergunta à estrutura do protocolo, cada decisão ajuda a dar forma ao seu trabalho.</p>
      <div className="flex flex-wrap gap-3 mt-6"><Link href={latest ? `/meu-trabalho?id=${latest.id}` : "/ideias"} className="bg-white text-ink rounded-card px-5 py-3 font-medium">{latest ? "Continuar meu projeto →" : "Explorar ideias →"}</Link><Link href="/meu-trabalho?novo=1" className="border border-white/30 rounded-card px-5 py-3">Novo projeto</Link></div>
    </section>
    {profile && !profile.onboarding_completed && <div className="mt-5 bg-teal-soft border border-teal/20 p-4 rounded-card text-sm">Complete seu perfil para personalizar sua jornada. <Link href="/scholar/onboarding" className="text-teal font-medium underline">Completar perfil</Link></div>}
    <section className="grid sm:grid-cols-3 gap-4 mt-6" aria-label="Resumo da conta">
      <Metric value={String(projects.length)} label="Projetos na sua conta" />
      <Metric value={latest ? `${latest.progress}%` : "0%"} label="Estrutura do último projeto preenchida" />
      <Metric value={profile?.specialty || "Sua área"} label="Área de interesse no perfil" />
    </section>
    <section className="mt-7" aria-labelledby="pendencies-title"><div className="flex flex-wrap justify-between gap-4 items-end"><div><p className="text-xs uppercase tracking-widest text-teal">Prioridades organizadas</p><h2 id="pendencies-title" className="font-display text-3xl mt-2">Central de pendências</h2><p className="text-sm text-ink-soft mt-2">Próximas decisões calculadas pelos dados preenchidos, sem IA.</p></div><Link href="/scholar/onboarding" className="text-sm text-teal font-medium">Atualizar diagnóstico →</Link></div>
      {pendencies.length?<div className="grid md:grid-cols-2 gap-3 mt-5">{pendencies.slice(0,6).map((item,index)=><article key={`${item.label}-${index}`} className={`rounded-2xl p-5 border ${item.tone==="alert"?"bg-amber-50 border-amber-200":"bg-white border-line"}`}><div className="flex items-start gap-3"><span className="font-mono text-xs text-teal bg-teal-soft rounded-card px-2 py-1">{String(index+1).padStart(2,"0")}</span><div><h3 className="font-medium">{item.label}</h3><p className="text-sm text-ink-soft mt-2 leading-relaxed">{item.text}</p><Link href={item.href} className="inline-block text-sm text-teal font-medium mt-4">{item.action} →</Link></div></div></article>)}</div>:<div className="mt-5 bg-teal-soft border border-teal/20 rounded-2xl p-5"><h3 className="font-display text-xl">Sem pendências identificadas agora.</h3><p className="text-sm text-ink-soft mt-2">Revise seu projeto com o orientador e registre a próxima etapa da jornada.</p></div>}
    </section>
    <section className="mt-10"><div className="flex justify-between gap-4 items-center flex-wrap"><h2 className="font-display text-3xl">Meus projetos</h2><Link href="/meu-trabalho?novo=1" className="text-sm font-medium text-teal">+ Criar projeto</Link></div>
      {projectResult.error ? <p role="alert" className="mt-5 text-sm text-red-700 bg-red-50 rounded-card p-4">Não foi possível carregar seus projetos. Atualize a página para tentar novamente.</p> : projects.length ? <div className="grid md:grid-cols-2 gap-4 mt-5">{projects.map(project => <Link key={project.id} href={`/meu-trabalho?id=${project.id}`} className="bg-white border border-line rounded-2xl p-5 hover:border-teal transition-colors">
        <p className="text-xs text-teal uppercase tracking-wider">{project.status === "completed" ? "Concluído" : "Em desenvolvimento"}</p><h3 className="font-display text-2xl mt-3 leading-snug">{project.title || project.theme || "Projeto sem título"}</h3><p className="text-sm text-ink-soft mt-2">{project.study_type || "Desenho a definir"}</p>
        <div className="h-1.5 bg-line rounded-full overflow-hidden mt-5"><div className="h-full bg-teal" style={{ width: `${project.progress}%` }} /></div><div className="flex justify-between text-xs text-ink-soft mt-2"><span>{project.progress}% preenchido</span><span>Atualizado em {new Date(project.updated_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span></div>
      </Link>)}</div> : <div className="bg-white border border-dashed border-line rounded-2xl p-8 mt-5"><h3 className="font-display text-2xl">Sua primeira pesquisa começa com uma pergunta.</h3><p className="text-sm text-ink-soft mt-3">Explore possibilidades no Ideias ou abra o construtor se já tiver um tema.</p><Link href="/ideias" className="inline-block mt-4 text-teal font-medium text-sm">Encontrar um tema →</Link></div>}
    </section>
    <section className="grid sm:grid-cols-2 gap-4 mt-8" aria-label="Licença e programas"><Link href="/licenca" className="bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Licença e assistência</h2><p className="text-sm text-ink-soft mt-3">Consulte sua franquia e o histórico de consumo.</p></Link><Link href="/residencia" className="bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Minha residência</h2><p className="text-sm text-ink-soft mt-3">Vincule sua conta por convite ou acompanhe o programa como coordenador.</p></Link></section>
    <section className="mt-10"><h2 className="font-display text-3xl">Ferramentas para avançar</h2><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">{tools.map(tool => <Link key={tool.href} href={tool.href} className="bg-white border border-line rounded-2xl p-5 hover:border-teal"><p className="text-xs uppercase tracking-wider text-teal">{tool.tag}</p><h3 className="font-display text-xl mt-4">{tool.title}</h3><p className="text-sm text-ink-soft mt-3 leading-relaxed">{tool.text}</p><span className="text-teal text-sm inline-block mt-5">Abrir ferramenta →</span></Link>)}</div></section>
  </div>;
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="bg-white border border-line rounded-card p-5"><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-2">{label}</p></div>; }

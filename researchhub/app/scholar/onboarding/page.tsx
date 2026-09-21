"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProfileDiagnosis } from "@/lib/research/profile-diagnosis";
import { supabaseBrowser } from "@/lib/supabase/browser";

const goals = [
  ["tcc", "TCC"], ["article", "Artigo original"], ["congress", "Congresso"],
  ["scientific_initiation", "Iniciação científica"], ["case_report", "Relato de caso"],
  ["residency", "Projeto da residência"], ["other", "Outro"],
] as const;
const stages = [["student","Graduação"],["resident","Residência"],["postgraduate","Pós-graduação"],["other","Outro"]] as const;
const experiences = [["none","Nenhum projeto"],["one","Um projeto"],["some","De 2 a 4 projetos"],["experienced","5 ou mais"]] as const;
const availability = [["under_2h","Menos de 2h"],["2_to_4h","2 a 4h"],["5_to_8h","5 a 8h"],["over_8h","Mais de 8h"]] as const;
const advisors = [["none","Ainda não tenho"],["searching","Estou procurando"],["informal","Tenho apoio informal"],["defined","Orientador definido"]] as const;
const dataOptions = [["unknown","Ainda não sei"],["none","Sem acesso hoje"],["possible","Acesso possível"],["available","Dados disponíveis"],["collecting","Já estou coletando"]] as const;
const researchStages = [["idea","Tenho uma ideia"],["question","Definindo pergunta"],["literature","Revisando literatura"],["methods","Definindo método"],["collection","Coletando dados"],["analysis","Analisando"],["writing","Escrevendo"],["submission","Preparando entrega"]] as const;
const difficulties = [["topic","Escolher e recortar tema"],["question","Construir a pergunta"],["advisor","Encontrar ou conversar com orientador"],["literature","Buscar e organizar referências"],["methodology","Definir metodologia"],["statistics","Planejar análise estatística"],["writing","Escrever o trabalho"],["organization","Organizar etapas e prazos"],["submission","Preparar submissão"]] as const;

type FormState = {
  stage: string; specialty: string; institution: string; goal: string;
  experience: string; weeklyAvailability: string; deadline: string;
  advisorAccess: string; dataAccess: string; currentResearchStage: string; mainDifficulty: string;
};
const initial: FormState = { stage:"student",specialty:"",institution:"",goal:"article",experience:"",weeklyAvailability:"",deadline:"",advisorAccess:"",dataAccess:"",currentResearchStage:"idea",mainDifficulty:"" };

export default function ScholarOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const diagnosis = useMemo(() => buildProfileDiagnosis({ main_goal:form.goal,research_experience:form.experience,weekly_availability:form.weeklyAvailability,project_deadline:form.deadline,advisor_access:form.advisorAccess,data_access:form.dataAccess,current_research_stage:form.currentResearchStage,main_difficulty:form.mainDifficulty }), [form]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const profileParam = params.get("perfil");
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("training_stage,specialty,institution,main_goal,research_experience,weekly_availability,project_deadline,advisor_access,data_access,current_research_stage,main_difficulty").eq("id", auth.user.id).maybeSingle();
      if (!active) return;
      setForm(current => ({
        ...current,
        stage: profileParam === "resident" || profileParam === "student" ? profileParam : data?.training_stage || current.stage,
        specialty: data?.specialty || "", institution: data?.institution || "", goal: data?.main_goal || current.goal,
        experience: data?.research_experience || "", weeklyAvailability: data?.weekly_availability || "", deadline: data?.project_deadline || "",
        advisorAccess: data?.advisor_access || "", dataAccess: data?.data_access || "", currentResearchStage: data?.current_research_stage || current.currentResearchStage,
        mainDifficulty: data?.main_difficulty || "",
      }));
      setLoadingProfile(false);
    })();
    return () => { active = false; };
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm(current => ({ ...current, [key]: value })); setError(null); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.specialty.trim() || !form.institution.trim() || !form.experience || !form.weeklyAvailability || !form.advisorAccess || !form.dataAccess || !form.mainDifficulty) {
      setError("Complete os campos do diagnóstico para receber uma jornada adequada ao seu momento."); return;
    }
    setLoading(true); setError(null);
    const supabase = supabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.push("/login"); return; }
    const metadataStage = auth.user.user_metadata?.scholar_stage;
    const userType = metadataStage === "resident" ? "resident" : metadataStage === "professor" ? "advisor" : "student";
    const { error: profileError } = await supabase.from("profiles").upsert({
      id:auth.user.id,name:auth.user.user_metadata?.name || auth.user.email?.split("@")[0] || null,email:auth.user.email || null,user_type:userType,
      training_stage:form.stage,specialty:form.specialty.trim(),institution:form.institution.trim(),main_goal:form.goal,
      research_experience:form.experience,weekly_availability:form.weeklyAvailability,project_deadline:form.deadline || null,
      advisor_access:form.advisorAccess,data_access:form.dataAccess,current_research_stage:form.currentResearchStage,main_difficulty:form.mainDifficulty,
      onboarding_completed:true,onboarding_version:2,updated_at:new Date().toISOString(),
    });
    if (profileError) {
      setError(profileError.message.includes("column") || profileError.code === "PGRST204" ? "O diagnóstico novo ainda precisa da migration scholar_phase1_journey.sql no Supabase." : "Não foi possível salvar seu diagnóstico. Tente novamente.");
      setLoading(false); return;
    }
    router.push("/dashboard?onboarding=concluido"); router.refresh();
  }

  if (loadingProfile) return <div className="max-w-4xl mx-auto py-20 text-center text-ink-soft">Preparando seu diagnóstico…</div>;
  return <div className="max-w-5xl mx-auto">
    <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
      <div>
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">Diagnóstico inicial</p>
        <h1 className="font-display text-4xl md:text-5xl mt-3">Uma jornada adequada ao seu projeto.</h1>
        <p className="text-ink-soft mt-4 max-w-2xl leading-relaxed">Leva poucos minutos. Usamos as respostas somente para organizar etapas, exemplos, alertas e próximas decisões — sem IA.</p>
      </div>
      <aside className="bg-ink text-white rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-teal-soft">Diagnóstico preenchido</p>
        <p className="font-display text-4xl mt-3">{diagnosis.readiness}%</p>
        <div className="h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden"><div className="h-full bg-teal-soft transition-all" style={{width:`${diagnosis.readiness}%`}} /></div>
        <p className="text-sm text-white/65 mt-4">Foco atual: {diagnosis.focus}.</p>
      </aside>
    </div>

    <form onSubmit={save} className="mt-8 space-y-5">
      <Section number="01" title="Seu contexto" text="Formação e ambiente em que a pesquisa será desenvolvida.">
        <Choice label="Etapa de formação" value={form.stage} options={stages} onChange={value=>update("stage",value)} />
        <div className="grid md:grid-cols-2 gap-5 mt-5"><Text label="Área ou especialidade" value={form.specialty} onChange={value=>update("specialty",value)} placeholder="Ex.: Cardiologia, Clínica Médica" /><Text label="Instituição ou serviço" value={form.institution} onChange={value=>update("institution",value)} placeholder="Hospital, faculdade ou serviço" /></div>
      </Section>
      <Section number="02" title="O trabalho que você quer construir" text="O formato define etapas e decisões diferentes.">
        <Choice label="Tipo principal" value={form.goal} options={goals} onChange={value=>update("goal",value)} />
        <Choice label="Em que momento você está?" value={form.currentResearchStage} options={researchStages} onChange={value=>update("currentResearchStage",value)} className="mt-6" />
      </Section>
      <Section number="03" title="Condições reais de execução" text="A viabilidade depende de tempo, apoio e acesso aos dados.">
        <Choice label="Experiência anterior" value={form.experience} options={experiences} onChange={value=>update("experience",value)} />
        <Choice label="Tempo disponível por semana" value={form.weeklyAvailability} options={availability} onChange={value=>update("weeklyAvailability",value)} className="mt-6" />
        <div className="grid md:grid-cols-2 gap-5 mt-6"><Choice label="Acesso a orientador" value={form.advisorAccess} options={advisors} onChange={value=>update("advisorAccess",value)} compact /><Choice label="Acesso aos dados" value={form.dataAccess} options={dataOptions} onChange={value=>update("dataAccess",value)} compact /></div>
        <label className="block text-sm font-medium mt-6 max-w-sm">Prazo principal <span className="font-normal text-ink-soft">(opcional)</span><input type="date" value={form.deadline} onChange={e=>update("deadline",e.target.value)} className="block w-full mt-2 border border-line rounded-card px-4 py-3 bg-paper outline-none focus:border-teal" /></label>
      </Section>
      <Section number="04" title="Onde você mais precisa de orientação" text="Esta resposta define a prioridade exibida no seu espaço.">
        <Choice label="Principal dificuldade agora" value={form.mainDifficulty} options={difficulties} onChange={value=>update("mainDifficulty",value)} />
      </Section>

      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">{error}</div>}
      <div className="bg-teal-soft border border-teal/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between gap-5 items-start md:items-center"><div><p className="text-xs uppercase tracking-widest text-teal">Sua primeira orientação</p><p className="font-medium mt-2">{diagnosis.nextAction}</p>{diagnosis.alerts[0] && <p className="text-sm text-ink-soft mt-2">Atenção: {diagnosis.alerts[0]}</p>}</div><button disabled={loading} className="bg-teal text-white px-6 py-3 rounded-card font-medium disabled:opacity-50 shrink-0">{loading ? "Salvando…" : "Salvar e montar minha jornada"}</button></div>
    </form>
  </div>;
}

function Section({number,title,text,children}:{number:string;title:string;text:string;children:React.ReactNode}) { return <section className="bg-white border border-line rounded-2xl p-5 md:p-7"><div className="flex gap-4"><span className="font-mono text-xs text-teal bg-teal-soft rounded-card px-3 py-2 h-fit">{number}</span><div><h2 className="font-display text-2xl">{title}</h2><p className="text-sm text-ink-soft mt-1">{text}</p></div></div><div className="mt-6">{children}</div></section>; }
function Choice({label,value,options,onChange,className="",compact=false}:{label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void;className?:string;compact?:boolean}) { return <fieldset className={className}><legend className="text-sm font-medium">{label}</legend><div className={`grid gap-2 mt-3 ${compact?"grid-cols-1":"sm:grid-cols-2 lg:grid-cols-4"}`}>{options.map(([option,labelText])=><button key={option} type="button" aria-pressed={value===option} onClick={()=>onChange(option)} className={`border rounded-card px-3 py-3 text-sm text-left transition-colors ${value===option?"border-teal bg-teal-soft text-teal font-medium":"border-line text-ink-soft hover:border-teal/50"}`}>{labelText}</button>)}</div></fieldset>; }
function Text({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string}) { return <label className="block text-sm font-medium">{label}<input required value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-4 py-3 bg-paper outline-none focus:border-teal" /></label>; }

"use client";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import { useLanguage } from "@/components/i18n/language-provider";


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
  const { t: uiText } = useLanguage();
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

  if (loadingProfile) return <div className="max-w-4xl mx-auto py-20 text-center text-ink-soft"><InterfaceText message="screen.25a0d3aec5a5" /></div>;
  return <div className="max-w-5xl mx-auto">
    <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
      <div>
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">Diagnóstico inicial</p>
        <h1 className="font-display text-4xl md:text-5xl mt-3"><InterfaceText message="screen.9d50033d7c10" /></h1>
        <p className="text-ink-soft mt-4 max-w-2xl leading-relaxed"><InterfaceText message="screen.169fff3c41bf" /></p>
      </div>
      <aside className="bg-ink text-white rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-teal-soft"><InterfaceText message="screen.efd4c3094587" /></p>
        <p className="font-display text-4xl mt-3"><AuthoredText text={diagnosis.readiness} />%</p>
        <div className="h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden"><div className="h-full bg-teal-soft transition-all" style={{width:`${diagnosis.readiness}%`}} /></div>
        <p className="text-sm text-white/65 mt-4"><InterfaceText message="screen.9add80c527af" /> <AuthoredText text={diagnosis.focus} />.</p>
      </aside>
    </div>

    <form onSubmit={save} className="mt-8 space-y-5">
      <Section number="01" title={uiText("screen.c71e3af9f050")} text="Formação e ambiente em que a pesquisa será desenvolvida.">
        <Choice label={uiText("screen.b3768e5b9541")} value={form.stage} options={stages} onChange={value=>update("stage",value)} />
        <div className="grid md:grid-cols-2 gap-5 mt-5"><Text label={uiText("screen.daf93d2ececc")} value={form.specialty} onChange={value=>update("specialty",value)} placeholder={uiText("screen.d3833d042439")} /><Text label={uiText("screen.493c218dfef3")} value={form.institution} onChange={value=>update("institution",value)} placeholder={uiText("screen.acfa82ada078")} /></div>
      </Section>
      <Section number="02" title={uiText("screen.4231b9f302b4")} text="O formato define etapas e decisões diferentes.">
        <Choice label="Tipo principal" value={form.goal} options={goals} onChange={value=>update("goal",value)} />
        <Choice label={uiText("screen.ab92e4e89da6")} value={form.currentResearchStage} options={researchStages} onChange={value=>update("currentResearchStage",value)} className="mt-6" />
      </Section>
      <Section number="03" title={uiText("screen.f1e0ea62782c")} text="A viabilidade depende de tempo, apoio e acesso aos dados.">
        <Choice label={uiText("screen.e98c1e95dd05")} value={form.experience} options={experiences} onChange={value=>update("experience",value)} />
        <Choice label={uiText("screen.344f2a651fde")} value={form.weeklyAvailability} options={availability} onChange={value=>update("weeklyAvailability",value)} className="mt-6" />
        <div className="grid md:grid-cols-2 gap-5 mt-6"><Choice label={uiText("screen.a542e3af8c3a")} value={form.advisorAccess} options={advisors} onChange={value=>update("advisorAccess",value)} compact /><Choice label={uiText("screen.e7dccceb5ed9")} value={form.dataAccess} options={dataOptions} onChange={value=>update("dataAccess",value)} compact /></div>
        <label className="block text-sm font-medium mt-6 max-w-sm"><InterfaceText message="screen.baf053b596f8" /> <span className="font-normal text-ink-soft">(opcional)</span><input type="date" value={form.deadline} onChange={e=>update("deadline",e.target.value)} className="block w-full mt-2 border border-line rounded-card px-4 py-3 bg-paper outline-none focus:border-teal" /></label>
      </Section>
      <Section number="04" title={uiText("screen.6c53b7779631")} text="Esta resposta define a prioridade exibida no seu espaço.">
        <Choice label={uiText("screen.1b1063f6ae95")} value={form.mainDifficulty} options={difficulties} onChange={value=>update("mainDifficulty",value)} />
      </Section>

      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700"><AuthoredText text={error} /></div>}
      <div className="bg-teal-soft border border-teal/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between gap-5 items-start md:items-center"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.d19da076af78" /></p><p className="font-medium mt-2"><AuthoredText text={diagnosis.nextAction} /></p>{diagnosis.alerts[0] && <p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.adbd1cab20ac" /> <AuthoredText text={diagnosis.alerts[0]} /></p>}</div><button disabled={loading} className="bg-teal text-white px-6 py-3 rounded-card font-medium disabled:opacity-50 shrink-0">{loading ? "Salvando…" : uiText("screen.84040a87e273")}</button></div>
    </form>
  </div>;
}

function Section({number,title,text,children}:{number:string;title:string;text:string;children:React.ReactNode}) { return <section className="bg-white border border-line rounded-2xl p-5 md:p-7"><div className="flex gap-4"><span className="font-mono text-xs text-teal bg-teal-soft rounded-card px-3 py-2 h-fit">{number}</span><div><h2 className="font-display text-2xl"><AuthoredText text={title} /></h2><p className="text-sm text-ink-soft mt-1"><AuthoredText text={text} /></p></div></div><div className="mt-6">{children}</div></section>; }
function Choice({label,value,options,onChange,className="",compact=false}:{label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void;className?:string;compact?:boolean}) { return <fieldset className={className}><legend className="text-sm font-medium"><AuthoredText text={label} /></legend><div className={`grid gap-2 mt-3 ${compact?"grid-cols-1":"sm:grid-cols-2 lg:grid-cols-4"}`}>{options.map(([option,labelText])=><button key={option} type="button" aria-pressed={value===option} onClick={()=>onChange(option)} className={`border rounded-card px-3 py-3 text-sm text-left transition-colors ${value===option?"border-teal bg-teal-soft text-teal font-medium":"border-line text-ink-soft hover:border-teal/50"}`}><AuthoredText text={labelText} /></button>)}</div></fieldset>; }
function Text({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string}) { return <label className="block text-sm font-medium"><AuthoredText text={label} /><input required value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-4 py-3 bg-paper outline-none focus:border-teal" /></label>; }

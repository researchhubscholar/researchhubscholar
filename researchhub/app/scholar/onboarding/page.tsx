"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const goals = [
  ["tcc", "TCC"],
  ["article", "Artigo científico"],
  ["congress", "Congresso"],
  ["scientific_initiation", "Iniciação científica"],
  ["case_report", "Relato de caso"],
  ["residency", "Projeto da residência"],
  ["other", "Outro"],
] as const;

export default function ScholarOnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState("student");
  const [specialty, setSpecialty] = useState("");
  const [institution, setInstitution] = useState("");
  const [goal, setGoal] = useState("article");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profile = params.get("perfil");
    if (profile === "resident" || profile === "student") setStage(profile);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const metadataStage = auth.user.user_metadata?.scholar_stage;
    const userType = metadataStage === "resident" ? "resident" : metadataStage === "professor" ? "advisor" : "student";

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: auth.user.id,
      name: auth.user.user_metadata?.name || auth.user.email?.split("@")[0] || null,
      email: auth.user.email || null,
      user_type: userType,
      training_stage: stage,
      specialty: specialty.trim() || null,
      institution: institution.trim() || null,
      main_goal: goal,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      setError("Não foi possível salvar seu perfil Scholar. Verifique se o scholar_install.sql foi executado no Supabase novo.");
      setLoading(false);
      return;
    }

    router.push("/meu-trabalho");
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-teal font-semibold">Seu perfil Scholar</p>
      <h1 className="font-display text-4xl mt-2">Vamos personalizar sua jornada científica.</h1>
      <p className="text-ink-soft mt-3">Essas informações ajudam o ResearchHub a adaptar exemplos, temas e próximos passos ao seu momento de formação.</p>

      <form onSubmit={save} className="mt-8 bg-white border border-line rounded-2xl p-6 md:p-8 space-y-6">
        <div>
          <label className="text-sm font-medium">Etapa de formação</label>
          <div className="grid sm:grid-cols-4 gap-2 mt-3">
            {[["student","Graduação"],["resident","Residência"],["postgraduate","Pós-graduação"],["other","Outro"]].map(([value,label]) => (
              <button key={value} type="button" onClick={() => setStage(value)} className={`border rounded-card px-3 py-3 text-sm ${stage === value ? "border-teal bg-teal-soft text-teal font-medium" : "border-line text-ink-soft"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium">Área ou especialidade</label>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Cardiologia, Dermatologia, Clínica Médica" className="w-full mt-2 border border-line rounded-card px-4 py-3 outline-none focus:border-teal" />
          </div>
          <div>
            <label className="text-sm font-medium">Instituição</label>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Faculdade, hospital ou serviço" className="w-full mt-2 border border-line rounded-card px-4 py-3 outline-none focus:border-teal" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">O que você quer construir primeiro?</label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {goals.map(([value,label]) => (
              <button key={value} type="button" onClick={() => setGoal(value)} className={`border rounded-card px-3 py-3 text-sm text-left ${goal === value ? "border-teal bg-teal-soft text-teal font-medium" : "border-line text-ink-soft"}`}>{label}</button>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">{error}</div>}

        <button disabled={loading} className="w-full bg-teal text-white py-3 rounded-card font-medium disabled:opacity-50">{loading ? "Salvando..." : "Continuar para meu projeto"}</button>
      </form>
    </div>
  );
}

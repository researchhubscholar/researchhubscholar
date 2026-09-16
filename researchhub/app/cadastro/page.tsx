"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Persona = "student" | "resident" | "professor";

export default function CadastroPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState<Persona>("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const emailRedirectTo = `${window.location.origin}/login?confirmed=1`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, scholar_stage: persona }, emailRedirectTo },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!signUpData.user) {
      setError("Não foi possível criar a conta. Tente novamente.");
      setLoading(false);
      return;
    }

    if (!signUpData.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    router.push(`/scholar/onboarding?perfil=${persona}`);
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-line rounded-2xl p-8">
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">ResearchHub Scholar</p>
        <h1 className="font-display text-3xl text-ink mt-2">Confirme seu e-mail</h1>
        <p className="text-ink-soft mt-4">Enviamos um link para <strong>{email}</strong>. Depois da confirmação, você volta ao Scholar, faz login e completa seu perfil.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs uppercase tracking-widest text-teal font-semibold">Comece seu projeto científico</p>
      <h1 className="font-display text-4xl text-ink mt-2">Criar conta</h1>
      <p className="text-ink-soft mt-3">Salve seus temas, artigos, matriz de evidências e continue seu projeto de qualquer dispositivo.</p>

      <form onSubmit={handleSubmit} className="mt-8 bg-white border border-line rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-sm text-ink-soft">Nome completo</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>
        <div>
          <label className="text-sm text-ink-soft">E-mail</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Senha</label>
          <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>

        <div>
          <label className="text-sm text-ink-soft">Eu sou</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([["student", "Aluno"],["resident", "Residente"],["professor", "Orientador"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPersona(value)} className={`border rounded-card px-2 py-3 text-sm font-medium transition-colors ${persona === value ? "border-teal bg-teal-soft text-teal" : "border-line text-ink-soft hover:border-teal/50"}`}>{label}</button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-teal text-white font-medium py-3 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50">{loading ? "Criando conta..." : "Criar minha conta Scholar"}</button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">Já tem conta? <a href="/login" className="text-teal font-medium hover:underline">Entrar</a></p>
    </div>
  );
}

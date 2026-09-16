"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setConfirmed(new URLSearchParams(window.location.search).get("confirmed") === "1");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : signInError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Não foi possível abrir sua conta.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, user_type")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      const profileParam = profile?.user_type === "resident" ? "resident" : user.user_metadata?.scholar_stage || "student";
      router.push(`/scholar/onboarding?perfil=${encodeURIComponent(profileParam)}`);
    } else {
      router.push("/meu-trabalho");
    }
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-display text-3xl text-ink">Entrar</h1>
      <p className="text-ink-soft mt-2">Continue seu projeto científico de onde parou.</p>

      {confirmed && <div className="mt-5 bg-teal-soft border border-teal/20 text-teal rounded-card p-4 text-sm">E-mail confirmado. Agora entre para completar seu perfil Scholar.</div>}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 bg-white border border-line rounded-2xl p-6">
        <div>
          <label className="text-sm text-ink-soft">E-mail</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Senha</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
          <a href="/esqueci-senha" className="text-xs text-teal hover:underline mt-1 inline-block">Esqueci minha senha</a>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">Ainda não tem conta? <a href="/cadastro" className="text-teal font-medium hover:underline">Criar conta</a></p>
    </div>
  );
}

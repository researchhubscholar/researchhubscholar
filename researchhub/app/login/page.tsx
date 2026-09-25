"use client";

import Link from "next/link";
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

  useEffect(() => { setConfirmed(new URLSearchParams(window.location.search).get("confirmed") === "1"); }, []);

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
    const { data: profile } = await supabase.from("profiles").select("onboarding_completed, user_type").eq("id", user.id).maybeSingle();
    if (!profile?.onboarding_completed) {
      const profileParam = profile?.user_type === "resident" ? "resident" : user.user_metadata?.scholar_stage || "student";
      router.push(`/scholar/onboarding?perfil=${encodeURIComponent(profileParam)}`);
    } else router.push("/dashboard");
    router.refresh();
  }

  return <div className="auth-shell">
    <section className="auth-intro">
      <p className="auth-kicker">Seu espaço científico</p>
      <h1 className="auth-title">Retome sua pesquisa de onde parou.</h1>
      <p className="auth-description">Projetos, referências, matriz de evidências e decisões metodológicas permanecem organizados em uma única jornada.</p>
      <ul className="auth-points"><li>Continue o projeto mais recente</li><li>Recupere biblioteca e histórico</li><li>Acompanhe pendências e próximos passos</li></ul>
    </section>
    <section>
      {confirmed && <div className="mb-4 bg-teal-soft border border-teal/20 text-teal rounded-card p-4 text-sm">E-mail confirmado. Agora entre para completar seu perfil Scholar.</div>}
      <form onSubmit={handleSubmit} className="auth-card space-y-5">
        <div><p className="auth-kicker">Acesso à conta</p><h2 className="auth-card-title mt-2">Entrar</h2></div>
        <label className="block auth-field-label" htmlFor="login-email">E-mail
          <input id="login-email" name="email" autoComplete="email" required type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-2 border px-3 py-2.5" />
        </label>
        <label className="block auth-field-label" htmlFor="login-password">Senha
          <input id="login-password" name="password" autoComplete="current-password" required type="password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="w-full mt-2 border px-3 py-2.5" />
          <Link href="/esqueci-senha" className="text-xs text-teal hover:underline mt-2 inline-block">Esqueci minha senha</Link>
        </label>
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-card p-3">{error}</p>}
        <button type="submit" disabled={loading} className="auth-submit disabled:opacity-50">{loading ? "Entrando..." : "Entrar no Scholar"}</button>
      </form>
      <p className="auth-switch">Ainda não tem conta? <Link href="/cadastro" className="text-teal font-medium hover:underline">Criar conta</Link></p>
    </section>
  </div>;
}

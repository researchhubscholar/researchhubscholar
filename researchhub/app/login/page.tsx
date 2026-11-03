"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const { t } = useLanguage();
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
      setError(signInError.message === "Invalid login credentials" ? t("auth.invalid") : signInError.message);
      setLoading(false);
      return;
    }
    const user = data.user;
    if (!user) {
      setError(t("auth.failed"));
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
      <p className="auth-kicker"><InterfaceText message="auth.space" /></p>
      <h1 className="auth-title"><InterfaceText message="auth.resume" /></h1>
      <p className="auth-description"><InterfaceText message="auth.description" /></p>
      <ul className="auth-points"><li><InterfaceText message="auth.latest" /></li><li><InterfaceText message="auth.history" /></li><li><InterfaceText message="auth.next" /></li></ul>
    </section>
    <section>
      {confirmed && <div className="mb-4 bg-teal-soft border border-teal/20 text-teal rounded-card p-4 text-sm"><InterfaceText message="auth.confirmed" /></div>}
      <form onSubmit={handleSubmit} className="auth-card space-y-5">
        <div><p className="auth-kicker"><InterfaceText message="auth.access" /></p><h2 className="auth-card-title mt-2"><InterfaceText message="nav.login" /></h2></div>
        <label className="block auth-field-label" htmlFor="login-email"><InterfaceText message="auth.email" />
          <input id="login-email" name="email" autoComplete="email" required type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-2 border px-3 py-2.5" />
        </label>
        <label className="block auth-field-label" htmlFor="login-password"><InterfaceText message="auth.password" />
          <input id="login-password" name="password" autoComplete="current-password" required type="password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="w-full mt-2 border px-3 py-2.5" />
          <Link href="/esqueci-senha" className="text-xs text-teal hover:underline mt-2 inline-block"><InterfaceText message="auth.forgot" /></Link>
        </label>
        {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-card p-3">{error}</p>}
        <button type="submit" disabled={loading} className="auth-submit disabled:opacity-50">{loading ? t("auth.entering") : t("auth.enter")}</button>
      </form>
      <p className="auth-switch"><InterfaceText message="auth.noAccount" /> <Link href="/cadastro" className="text-teal font-medium hover:underline"><InterfaceText message="nav.signup" /></Link></p>
    </section>
  </div>;
}

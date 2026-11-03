"use client";
import AuthoredText from "@/components/i18n/authored-text";


import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Persona = "student" | "resident" | "professor";

export default function CadastroPage() {
  const { t: uiText } = useLanguage();
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
      setError(uiText("auth.signupFailed"));
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
        <h1 className="font-display text-3xl text-ink mt-2"><InterfaceText message="auth.confirmTitle" /></h1>
        <p className="text-ink-soft mt-4"><InterfaceText message="auth.confirmPrefix" /> <strong>{email}</strong><InterfaceText message="auth.confirmSuffix" /></p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-xs uppercase tracking-widest text-teal font-semibold"><InterfaceText message="auth.start" /></p>
      <h1 className="font-display text-4xl text-ink mt-2"><InterfaceText message="nav.signup" /></h1>
      <p className="text-ink-soft mt-3"><InterfaceText message="auth.signupDescription" /></p>

      <form onSubmit={handleSubmit} className="mt-8 bg-white border border-line rounded-2xl p-6 space-y-5"><label className="flex gap-3 text-sm text-ink-soft"><input name="termsAccepted" type="checkbox" required className="mt-1" /><span><InterfaceText message="auth.readTerms" /> <Link href="/termos" target="_blank" rel="noreferrer" className="text-teal underline"><InterfaceText message="auth.terms" /></Link> <InterfaceText message="auth.andPrivacy" /> <Link href="/privacidade" target="_blank" rel="noreferrer" className="text-teal underline"><InterfaceText message="auth.privacy" /></Link> <InterfaceText message="auth.testingSuffix" /></span></label>
        <div>
          <label htmlFor="signup-name" className="text-sm text-ink-soft"><InterfaceText message="auth.fullName" /></label>
          <input id="signup-name" name="name" autoComplete="name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>
        <div>
          <label htmlFor="signup-email" className="text-sm text-ink-soft"><InterfaceText message="auth.email" /></label>
          <input id="signup-email" name="email" autoComplete="email" required type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
        </div>
        <div>
          <label htmlFor="signup-password" className="text-sm text-ink-soft"><InterfaceText message="auth.password" /></label>
          <input id="signup-password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 border border-line rounded-card px-3 py-2.5 outline-none focus:border-teal bg-white" />
          <p className="text-xs text-ink-soft mt-1"><InterfaceText message="auth.passwordHelp" /></p>
        </div>

        <fieldset>
          <legend className="text-sm text-ink-soft"><InterfaceText message="auth.persona" /></legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2 mt-2">
            {([["student", "Aluno"],["resident", "Residente"],["professor", "Orientador"]] as const).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={persona === value} onClick={() => setPersona(value)} className={`border rounded-card px-2 py-3 text-sm font-medium transition-colors ${persona === value ? "border-teal bg-teal-soft text-teal" : "border-line text-ink-soft hover:border-teal/50"}`}>{uiText(value === "student" ? "auth.student" : value === "resident" ? "auth.resident" : "auth.advisor") || label}</button>
            ))}
          </div>
        </fieldset>

        {error && <p role="alert" className="text-sm text-red-600"><AuthoredText text={error} /></p>}
        <button type="submit" disabled={loading} className="w-full bg-teal text-white font-medium py-3 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50">{loading ? uiText("auth.creating") : uiText("auth.create")}</button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center"><InterfaceText message="auth.hasAccount" /> <a href="/login" className="text-teal font-medium hover:underline"><InterfaceText message="nav.login" /></a></p>
    </div>
  );
}

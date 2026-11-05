"use client";
import AuthFrame from "@/components/public/auth-frame";
import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";

import InterfaceText from "@/components/i18n/interface-text";


import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function EsqueciSenhaPage() {
  const { t: uiText } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthFrame variant="recovery">
        <h2 className="font-display text-2xl text-ink"><InterfaceText message="screen.3430568fb863" /></h2>
        <p className="text-ink-soft mt-4">
          <InterfaceText message="screen.24970da9c592" /> <strong>{email}</strong><InterfaceText message="screen.e7f939cbc1f0" />
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame variant="recovery">
      <h2 className="font-display text-2xl text-ink"><InterfaceText message="screen.16696f2ed928" /></h2>
      <p className="text-ink-soft mt-2">
        <InterfaceText message="screen.6e8b7ba41571" />
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="recovery-email" className="text-sm text-ink-soft"><InterfaceText message="screen.2550d962e536" /></label>
          <input
            id="recovery-email"
            name="email"
            autoComplete="email"
            required
            type="email"
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-600"><AuthoredText text={error} /></p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando..." : uiText("screen.69abc6afa196")}
        </button>
      </form>

      <p className="text-sm text-ink-soft mt-6">
        <InterfaceText message="screen.5ce9a70c9a7c" />{" "}
        <a href="/login" className="text-teal font-medium hover:underline">
          <InterfaceText message="screen.4105811890ae" />
        </a>
      </p>
    </AuthFrame>
  );
}

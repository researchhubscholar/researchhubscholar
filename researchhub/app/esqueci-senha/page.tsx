"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function EsqueciSenhaPage() {
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
      <div className="max-w-md">
        <h1 className="font-display text-2xl text-ink">Verifique seu e-mail</h1>
        <p className="text-ink-soft mt-4">
          Se existir uma conta com o e-mail <strong>{email}</strong>, enviamos
          um link para redefinir sua senha. Clique nele para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl text-ink">Esqueci minha senha</h1>
      <p className="text-ink-soft mt-2">
        Digite seu e-mail e enviaremos um link para você redefinir a senha.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ink-soft">E-mail</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
      </form>

      <p className="text-sm text-ink-soft mt-6">
        Lembrou a senha?{" "}
        <a href="/login" className="text-teal font-medium hover:underline">
          Entrar
        </a>
      </p>
    </div>
  );
}

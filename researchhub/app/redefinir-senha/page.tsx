"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function RedefinirSenhaPage() {
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();

    // O link do e-mail estabelece uma sessão temporária de recuperação.
    // Isso pode chegar via evento PASSWORD_RECOVERY ou já estar pronto
    // na sessão assim que a página carrega — checamos os dois casos.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setInvalidLink(true);
        return current;
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  if (success) {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-2xl text-ink">Senha atualizada</h1>
        <p className="text-ink-soft mt-4">Redirecionando para o login...</p>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-2xl text-ink">Link inválido ou expirado</h1>
        <p className="text-ink-soft mt-4">
          Solicite um novo link em{" "}
          <a href="/esqueci-senha" className="text-teal font-medium hover:underline">
            Esqueci minha senha
          </a>
          .
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-md">
        <p className="text-ink-soft">Verificando link...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl text-ink">Defina sua nova senha</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-ink-soft">Nova senha</label>
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>

        <div>
          <label className="text-sm text-ink-soft">Confirme a nova senha</label>
          <input
            required
            minLength={6}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

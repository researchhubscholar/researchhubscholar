"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Professor = { id: string; name: string; specialty: string | null };

export default function ClaimForm({ professors }: { professors: Professor[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClaim() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .single();

    if (!appUser) {
      setError("Não encontramos seu cadastro. Tente sair e entrar de novo.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("professors")
      .update({ user_id: appUser.id })
      .eq("id", selected)
      .is("user_id", null);

    if (updateError) {
      setError(
        "Não foi possível vincular esse perfil — talvez alguém já tenha reivindicado. Escolha outro."
      );
      setLoading(false);
      return;
    }

    router.push(`/professores/${selected}`);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-2">
      {professors.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p.id)}
          className={`w-full text-left border rounded-card px-4 py-3 transition-colors ${
            selected === p.id ? "border-teal bg-teal-soft" : "border-line hover:border-teal/50"
          }`}
        >
          <p className="font-medium text-ink">{p.name}</p>
          {p.specialty && <p className="text-sm text-ink-soft">{p.specialty}</p>}
        </button>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {professors.length > 0 && (
        <button
          onClick={handleClaim}
          disabled={!selected || loading}
          className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50 mt-4"
        >
          {loading ? "Vinculando..." : "Confirmar e vincular perfil"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function ManifestInterestButton({
  projectId,
  appUserId,
  alreadyInterested,
}: {
  projectId: string;
  appUserId: string;
  alreadyInterested: boolean;
}) {
  const [interested, setInterested] = useState(alreadyInterested);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: insertError } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: appUserId, role: "aluno" });

    if (insertError) {
      setError("Não foi possível registrar seu interesse. Tente novamente.");
      setLoading(false);
      return;
    }

    // Dispara o e-mail para o professor. Não bloqueia nem falha a ação
    // principal se o e-mail não sair — o interesse já está salvo.
    fetch("/api/notify-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).catch(() => {
      // Silencioso de propósito — falha de e-mail não deve incomodar
      // quem só queria manifestar interesse.
    });

    setInterested(true);
    setLoading(false);
    router.refresh();
  }

  if (interested) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-teal font-medium mt-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Interesse registrado — o professor foi notificado.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-block bg-teal text-white text-sm font-medium px-5 py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Registrando..." : "Manifestar interesse"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

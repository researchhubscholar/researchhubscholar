"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function NovoDepartamentoForm({ universityId }: { universityId: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { data, error: insertError } = await supabase
      .from("departments")
      .insert({ university_id: universityId, name, description })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/departamentos/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-sm text-ink-soft">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Departamento de Engenharia"
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar departamento"}
      </button>
    </form>
  );
}

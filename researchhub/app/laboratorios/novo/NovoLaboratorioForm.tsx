"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function NovoLaboratorioForm({
  professorId,
  departmentId,
}: {
  professorId: string;
  departmentId: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { data: lab, error: insertError } = await supabase
      .from("laboratories")
      .insert({
        department_id: departmentId,
        name,
        description,
        location,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Vincula o professor ao laboratório recém-criado.
    const { error: linkError } = await supabase
      .from("professor_laboratories")
      .insert({ professor_id: professorId, laboratory_id: lab.id, role: "Coordenador" });

    if (linkError) {
      setError(linkError.message);
      setLoading(false);
      return;
    }

    router.push(`/laboratorios/${lab.id}`);
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
          placeholder="Ex: Laboratório de Neurociência Cognitiva"
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

      <div>
        <label className="text-sm text-ink-soft">Localização</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ex: Bloco C, sala 204"
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar laboratório"}
      </button>
    </form>
  );
}

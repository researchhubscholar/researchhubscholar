"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Option = { id: string; name: string };

export default function NovoProjetoForm({
  professorId,
  lines,
  labs,
}: {
  professorId: string;
  lines: Option[];
  labs: Option[];
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [researchLineId, setResearchLineId] = useState(lines[0]?.id ?? "");
  const [laboratoryId, setLaboratoryId] = useState(labs[0]?.id ?? "");
  const [keywords, setKeywords] = useState("");
  const [acceptingStudents, setAcceptingStudents] = useState(false);
  const [scholarshipAvailable, setScholarshipAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({
        title,
        summary,
        research_line_id: researchLineId || null,
        laboratory_id: laboratoryId || null,
        lead_professor_id: professorId,
        status: "draft",
        accepting_students: acceptingStudents,
        scholarship_available: scholarshipAvailable,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/projetos/${data.id}/editar`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-sm text-ink-soft">Título</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Resumo</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      {lines.length > 0 && (
        <div>
          <label className="text-sm text-ink-soft">Linha de pesquisa</label>
          <select
            value={researchLineId}
            onChange={(e) => setResearchLineId(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {labs.length > 0 && (
        <div>
          <label className="text-sm text-ink-soft">Laboratório</label>
          <select
            value={laboratoryId}
            onChange={(e) => setLaboratoryId(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          >
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm text-ink-soft">Palavras-chave (separadas por vírgula)</label>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="reabilitação, infarto, qualidade de vida"
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={acceptingStudents}
          onChange={(e) => setAcceptingStudents(e.target.checked)}
          className="accent-teal"
        />
        Aceita alunos
      </label>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={scholarshipAvailable}
          onChange={(e) => setScholarshipAvailable(e.target.checked)}
          className="accent-teal"
        />
        Bolsa disponível
      </label>

      <p className="text-xs text-ink-soft/70">
        O projeto será criado como "Rascunho". Você pode mudar o status depois de salvar.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar projeto"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { STATUS_LABELS } from "@/lib/types";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  accepting_students: boolean;
  scholarship_available: boolean;
  keywords: string[];
};

// Depois de aprovado pela primeira vez, o professor gerencia livremente
// entre esses status — não precisa de aprovação de novo a cada mudança.
const POST_APPROVAL_STATUS_OPTIONS = ["published", "recruiting", "ongoing", "completed", "archived"];

export default function EditProjetoForm({ project }: { project: Project }) {
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary ?? "");
  const [status, setStatus] = useState(project.status);
  const [keywords, setKeywords] = useState((project.keywords ?? []).join(", "));
  const [acceptingStudents, setAcceptingStudents] = useState(project.accepting_students);
  const [scholarshipAvailable, setScholarshipAvailable] = useState(project.scholarship_available);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const isDraft = project.status === "draft";
  const isInReview = project.status === "in_review";

  async function saveFields(extra: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        title,
        summary,
        accepting_students: acceptingStudents,
        scholarship_available: scholarshipAvailable,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        ...extra,
      })
      .eq("id", project.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await saveFields(!isDraft && !isInReview ? { status } : {});
    if (ok) {
      setSaved(true);
      router.refresh();
    }
  }

  async function handleSubmitForReview() {
    const ok = await saveFields({ status: "in_review" });
    if (ok) router.refresh();
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

      {isInReview ? (
        <div className="bg-amber-soft text-amber text-sm px-4 py-3 rounded-card">
          Aguardando aprovação do coordenador. O status não pode ser alterado
          enquanto estiver em revisão.
        </div>
      ) : isDraft ? (
        <div className="bg-teal-soft text-ink text-sm px-4 py-3 rounded-card">
          Este projeto está como <strong>Rascunho</strong> — só visível para
          você. Salve suas alterações e depois envie para aprovação do
          coordenador para publicar.
        </div>
      ) : (
        <div>
          <label className="text-sm text-ink-soft">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          >
            {POST_APPROVAL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-teal">Salvo com sucesso.</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>

        {isDraft && (
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={loading}
            className="flex-1 border border-teal text-teal font-medium py-2.5 rounded-card hover:bg-teal-soft transition-colors disabled:opacity-50"
          >
            Enviar para aprovação
          </button>
        )}
      </div>
    </form>
  );
}

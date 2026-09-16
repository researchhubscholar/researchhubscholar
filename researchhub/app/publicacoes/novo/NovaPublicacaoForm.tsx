"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Project = { id: string; title: string };

const TYPE_OPTIONS = [
  { value: "artigo", label: "Artigo" },
  { value: "resumo", label: "Resumo de congresso" },
  { value: "capitulo", label: "Capítulo de livro" },
  { value: "dissertacao", label: "Dissertação" },
  { value: "tese", label: "Tese" },
];

export default function NovaPublicacaoForm({
  professorId,
  projects,
}: {
  professorId: string;
  projects: Project[];
}) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [journal, setJournal] = useState("");
  const [doi, setDoi] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [publicationType, setPublicationType] = useState("artigo");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();

    const { data: publication, error: insertError } = await supabase
      .from("publications")
      .insert({
        title,
        year: year ? parseInt(year, 10) : null,
        journal,
        doi,
        abstract,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        publication_type: publicationType,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    const { error: authorError } = await supabase
      .from("publication_authors")
      .insert({ publication_id: publication.id, professor_id: professorId, author_order: 1 });

    if (authorError) {
      setError(authorError.message);
      setLoading(false);
      return;
    }

    if (projectId) {
      await supabase
        .from("publication_projects")
        .insert({ publication_id: publication.id, project_id: projectId });
    }

    router.push(`/publicacoes/${publication.id}`);
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-ink-soft">Ano</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Tipo</label>
          <select
            value={publicationType}
            onChange={(e) => setPublicationType(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm text-ink-soft">Revista / Veículo</label>
        <input
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">DOI</label>
        <input
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          placeholder="10.xxxx/..."
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Resumo</label>
        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          rows={4}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Palavras-chave (separadas por vírgula)</label>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      {projects.length > 0 && (
        <div>
          <label className="text-sm text-ink-soft">Vincular a um projeto (opcional)</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          >
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar publicação"}
      </button>
    </form>
  );
}

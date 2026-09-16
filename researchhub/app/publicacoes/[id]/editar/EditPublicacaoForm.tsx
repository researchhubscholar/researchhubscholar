"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Publication = {
  id: string;
  title: string;
  year: number | null;
  journal: string | null;
  doi: string | null;
  abstract: string | null;
  keywords: string[];
};

export default function EditPublicacaoForm({ publication }: { publication: Publication }) {
  const [title, setTitle] = useState(publication.title);
  const [year, setYear] = useState(publication.year?.toString() ?? "");
  const [journal, setJournal] = useState(publication.journal ?? "");
  const [doi, setDoi] = useState(publication.doi ?? "");
  const [abstract, setAbstract] = useState(publication.abstract ?? "");
  const [keywords, setKeywords] = useState((publication.keywords ?? []).join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("publications")
      .update({
        title,
        year: year ? parseInt(year, 10) : null,
        journal,
        doi,
        abstract,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      })
      .eq("id", publication.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
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
          <label className="text-sm text-ink-soft">Revista</label>
          <input
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-ink-soft">DOI</label>
        <input
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-teal">Salvo com sucesso.</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}

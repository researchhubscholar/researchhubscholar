"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Line = { id: string; name: string; description: string | null };

export default function InterestsForm({
  studentId,
  lines,
  initialSelectedIds,
}: {
  studentId: string;
  lines: Line[];
  initialSelectedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();

    // Remove os interesses atuais e grava os selecionados de novo —
    // simples e suficiente para o volume de dados de um onboarding.
    const { error: deleteError } = await supabase
      .from("interests")
      .delete()
      .eq("student_id", studentId);

    if (deleteError) {
      setError(deleteError.message);
      setLoading(false);
      return;
    }

    if (selected.size > 0) {
      const rows = Array.from(selected).map((research_line_id) => ({
        student_id: studentId,
        research_line_id,
      }));
      const { error: insertError } = await supabase.from("interests").insert(rows);

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-8">
      <div className="space-y-2">
        {lines.map((line) => (
          <button
            key={line.id}
            type="button"
            onClick={() => toggle(line.id)}
            className={`w-full text-left border rounded-card px-4 py-3 transition-colors ${
              selected.has(line.id) ? "border-teal bg-teal-soft" : "border-line hover:border-teal/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-4 h-4 rounded-full border flex-shrink-0 ${
                  selected.has(line.id) ? "bg-teal border-teal" : "border-line"
                }`}
              />
              <div>
                <p className="font-medium text-ink">{line.name}</p>
                {line.description && <p className="text-sm text-ink-soft">{line.description}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {lines.length === 0 && (
        <p className="text-sm text-ink-soft">Nenhuma linha de pesquisa cadastrada ainda.</p>
      )}

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-teal text-white font-medium px-5 py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Continuar"}
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-ink-soft hover:text-teal"
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}

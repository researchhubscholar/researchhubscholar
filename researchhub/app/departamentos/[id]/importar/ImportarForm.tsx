"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Row = { name: string; email: string; specialty: string };

function parseCsv(text: string): Row[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Pula a primeira linha se parecer um cabeçalho (contém "nome" ou "email").
  const first = lines[0]?.toLowerCase() ?? "";
  const dataLines = first.includes("nome") || first.includes("email") ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const [name = "", email = "", specialty = ""] = line.split(",").map((v) => v.trim());
    return { name, email, specialty };
  });
}

export default function ImportarForm({ departmentId }: { departmentId: string }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handlePreview() {
    const parsed = parseCsv(raw).filter((r) => r.name);
    setRows(parsed);
    setError(null);
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return;
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: insertError } = await supabase.from("professors").insert(
      rows.map((r) => ({
        department_id: departmentId,
        name: r.name,
        email: r.email || null,
        specialty: r.specialty || null,
      }))
    );

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mt-8">
        <p className="text-teal font-medium">
          {rows?.length} professores importados. Eles aparecem como
          "não reivindicados" até cada um criar a própria conta e se
          vincular em /professores/vincular.
        </p>
        <button
          onClick={() => router.push(`/departamentos/${departmentId}`)}
          className="mt-4 text-sm text-teal hover:underline"
        >
          Ver departamento
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {!rows ? (
        <>
          <label className="text-sm text-ink-soft">
            Cole os dados abaixo — um professor por linha, formato:
            <span className="block font-mono text-xs bg-white border border-line rounded px-2 py-1 mt-1">
              Nome completo, email@exemplo.com, Especialidade
            </span>
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={10}
            placeholder={"Ana Beatriz Ferreira, ana@uex.br, Cardiologia Clínica\nCarlos Eduardo Lima, carlos@uex.br, Cardiologia Intervencionista"}
            className="w-full mt-2 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white font-mono text-sm"
          />
          <button
            onClick={handlePreview}
            disabled={!raw.trim()}
            className="mt-4 bg-teal text-white font-medium px-5 py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
          >
            Ver prévia
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft mb-4">
            {rows.length} {rows.length === 1 ? "professor encontrado" : "professores encontrados"} — confira antes de importar:
          </p>
          <div className="border border-line rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-line">
                <tr>
                  <th className="text-left px-3 py-2 text-ink-soft font-medium">Nome</th>
                  <th className="text-left px-3 py-2 text-ink-soft font-medium">E-mail</th>
                  <th className="text-left px-3 py-2 text-ink-soft font-medium">Especialidade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.email}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.specialty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-teal text-white font-medium px-5 py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Importando..." : `Confirmar e importar ${rows.length}`}
            </button>
            <button
              onClick={() => setRows(null)}
              className="text-sm text-ink-soft hover:text-teal px-3"
            >
              Voltar e editar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

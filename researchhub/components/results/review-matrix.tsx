"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { useUnsavedChanges } from "@/components/projects/use-unsaved-changes";
import { useLibrary } from "@/lib/literature/use-library";
import type { EvidenceNote } from "@/lib/literature/library-store";

const fields = [
  ["objective", "Objetivo", "Objetivo"],
  ["method", "Método", "Método"],
  ["finding", "Achados", "Hallazgos"],
  ["limitation", "Limitações", "Limitaciones"],
] as const;
type Draft = Partial<Pick<EvidenceNote, typeof fields[number][0]>>;

export default function ReviewMatrix({ projectId }: { projectId: string }) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const library = useLibrary();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const articles = library.articles.filter(article => article.projectIds.includes(projectId));
  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return true;
    if (!articles.some(article => article.id === id)) return false;
    if (!await library.saveNote(id, { ...library.notes[id], ...draft })) return false;
    setDrafts(current => {
      const next = { ...current };
      if (next[id] === draft) delete next[id];
      return next;
    });
    return true;
  }
  useUnsavedChanges({ label: es ? "Matriz de estudios" : "Matriz de estudos", dirty: Object.keys(drafts).length > 0, busy: library.working,
    onSave: async () => { for (const id of Object.keys(drafts)) if (!await save(id)) return false; return true; },
    onDiscard: () => setDrafts({}),
  });
  return <section className="rounded-2xl border border-line bg-white p-5 md:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl">{es ? "Matriz de estudios" : "Matriz de estudos"}</h2>
        <p className="mt-2 text-sm text-ink-soft">{es ? "Extrae los datos de cada estudio vinculado. Los cambios también aparecen en la Biblioteca." : "Registre o que cada estudo vinculado informa. As alterações também aparecem na Biblioteca."}</p>
      </div>
      <Link className="text-sm font-medium text-teal underline" href={`/biblioteca?projeto=${encodeURIComponent(projectId)}`}>{es ? "Abrir biblioteca del proyecto" : "Abrir Biblioteca do projeto"}</Link>
    </div>
    {library.error && <p role="alert" className="mt-4 text-sm text-red-700">{library.error}</p>}
    {library.message && <p role="status" className="mt-4 text-sm text-teal">{library.message}</p>}
    {library.loading ? <p role="status" className="mt-5 text-sm">{es ? "Cargando artículos…" : "Carregando artigos…"}</p> : !library.error && !articles.length &&
      <div className="mt-5 rounded-card bg-teal-soft p-4 text-sm">
        <p>{es ? "Todavía no hay artículos vinculados a este proyecto." : "Ainda não há artigos vinculados a este projeto."}</p>
        <Link className="mt-2 inline-block font-medium text-teal underline" href={`/descobrir?projeto=${encodeURIComponent(projectId)}`}>{es ? "Buscar artículos para la revisión" : "Buscar artigos para a revisão"}</Link>
      </div>}
    <div className="mt-5 space-y-3">
      {articles.map(article => {
        const note = { ...library.notes[article.id], ...drafts[article.id] };
        const filled = fields.filter(([key]) => note[key]?.trim()).length;
        return <details key={article.id} className="rounded-card border border-line p-4">
          <summary className="cursor-pointer font-medium text-teal">
            {article.title} <span className="ml-2 text-xs font-normal text-ink-soft">{filled}/4 {es ? "campos completos" : "campos preenchidos"}{drafts[article.id] ? (es ? " · Sin guardar" : " · Não salvo") : ""}</span>
          </summary>
          <fieldset disabled={library.working} className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields.map(([key, pt, spanish]) => <label key={key} className="text-sm">{es ? spanish : pt}
              <textarea rows={3} maxLength={4000} value={note[key] || ""} onChange={event => {
                const value = event.target.value;
                setDrafts(current => ({ ...current, [article.id]: { ...current[article.id], [key]: value } }));
              }} className="mt-1 block w-full rounded-card border border-line p-2" />
            </label>)}
            <button type="button" disabled={!drafts[article.id]} onClick={() => void save(article.id)} className="w-fit rounded-card bg-teal px-4 py-2 text-sm text-white disabled:opacity-50">
              {es ? "Guardar extracción" : "Salvar extração"}
            </button>
          </fieldset>
        </details>;
      })}
    </div>
  </section>;
}

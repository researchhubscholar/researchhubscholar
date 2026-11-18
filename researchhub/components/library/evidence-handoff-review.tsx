"use client";

import { useEffect, useMemo, useState } from "react";
import { buildEvidenceMatrixPreview, type MatrixSource } from "@/lib/literature/evidence-matrix-preview";
import { type EvidenceReviewDecision } from "@/lib/literature/evidence-review";
import {
  prepareProjectEvidenceHandoff, type LiteratureDestination,
  type ProjectHandoffChoice, type ProjectHandoffPreview,
} from "@/lib/literature/project-evidence-handoff";

/**
 * IA-10: controlled, preview-only review workspace. It deliberately has
 * no write callback, network request, or result/manuscript mutation.
 * Parent must load and authorize project-owned sources before rendering.
 */
const destinationOptions: { value: LiteratureDestination; label: string }[] = [
  { value: "literature_notes", label: "Notas da literatura" },
  { value: "introduction_background", label: "Contextualização da introdução" },
  { value: "discussion_evidence", label: "Evidências para a discussão" },
];

type Props = { projectId: string; sources: MatrixSource[]; disabled?: boolean };
type Decision = "accept_quote" | "reject_quote";
type Choice = { action?: Decision; destination: LiteratureDestination; confirmed: boolean };

export function EvidenceHandoffReview({ projectId, sources, disabled = false }: Props) {
  const [entries, setEntries] = useState<Record<string, Choice>>({});
  const [preview, setPreview] = useState<ProjectHandoffPreview | null>(null);
  const [error, setError] = useState("");
  const matrix = useMemo(() => {
    try { return { value: buildEvidenceMatrixPreview(sources), error: "" }; }
    catch { return { value: null, error: "Não foi possível preparar as evidências. Revise os artigos selecionados." }; }
  }, [sources]);
  useEffect(() => { setEntries({}); setPreview(null); setError(""); }, [projectId, sources]);
  const cells = useMemo(() => matrix.value?.rows.flatMap(row =>
    row.cells.map((cell, index) => ({ row, cell, index, key: row.articleId + ":" + index }))) ?? [], [matrix]);

  function edit(key: string, patch: Partial<Choice>) {
    setEntries(current => ({
      ...current, [key]: { ...current[key], destination: patch.destination ?? current[key]?.destination ?? "literature_notes",
        confirmed: patch.confirmed ?? current[key]?.confirmed ?? false,
        action: patch.action ?? current[key]?.action },
    }));
    setPreview(null);
    setError("");
  }
  function generatePreview() {
    if (disabled || !matrix.value) return;
    try {
      const reviews: EvidenceReviewDecision[] = [];
      const choices: ProjectHandoffChoice[] = [];
      for (const item of cells) {
        const entry = entries[item.key];
        if (!entry?.action) continue;
        reviews.push({
          articleId: item.row.articleId, cellIndex: item.index,
          expectedExcerpt: item.cell.excerpt, expectedMatchedText: item.cell.matchedText,
          action: entry.action, reviewerConfirmed: true,
        });
        if (entry.action === "accept_quote" && entry.confirmed) {
          choices.push({
            articleId: item.row.articleId, cellIndex: item.index,
            destination: entry.destination, destinationConfirmed: true,
          });
        }
      }
      const prepared = prepareProjectEvidenceHandoff(projectId, sources, reviews, choices);
      setPreview(prepared);
      setError(prepared.blocked.length
        ? "Alguns trechos não passaram pela validação. Revise as fontes e as escolhas."
        : "");
    } catch {
      setPreview(null);
      setError("A prévia não pôde ser preparada. Confirme o projeto, os artigos e os trechos.");
    }
  }

  if (matrix.error || !matrix.value) {
    return <p role="alert" className="rounded-card border border-line bg-paper p-4 text-sm text-ink-soft">{matrix.error}</p>;
  }
  return <section aria-labelledby="ai10-title" className="rounded-2xl border border-line bg-white p-5 space-y-5">
    <div>
      <p className="text-xs uppercase tracking-widest font-semibold text-teal">Biblioteca · revisão de evidências</p>
      <h2 id="ai10-title" className="font-display text-2xl text-ink mt-2">Conferir antes de utilizar no Meu Projeto</h2>
      <p className="text-sm text-ink-soft mt-2">Confirme os trechos dos artigos e selecione onde eles poderão ser usados. Esta etapa prepara apenas uma prévia, sem salvar ou editar o manuscrito.</p>
    </div>
    <div className="space-y-4">
      {cells.map(item => {
        const current = entries[item.key] || { destination: "literature_notes", confirmed: false };
        return <article key={item.key} className="rounded-card border border-line bg-paper p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-medium text-sm text-ink">{item.row.title}</p>
            <span className="text-xs text-ink-soft">{item.cell.kind} · {item.row.pmid ? "PMID " + item.row.pmid : item.row.doi ? "DOI " + item.row.doi : "Fonte sem identificador externo"}</span>
          </div>
          <blockquote className="border-l-2 border-teal pl-3 text-sm text-ink-soft">{item.cell.excerpt}</blockquote>
          <p className="text-xs text-ink-soft">Expressão identificada: {item.cell.matchedText}. A confirmação não valida a interpretação científica.</p>
          <fieldset disabled={disabled} className="space-y-2">
            <legend className="text-sm font-medium text-ink">O trecho corresponde ao artigo?</legend>
            <label className="inline-flex items-center gap-2 mr-5 text-sm"><input type="radio" name={"review-" + item.key} checked={current.action === "accept_quote"} onChange={() => edit(item.key, { action: "accept_quote" })}/> Confirmar trecho</label>
            <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name={"review-" + item.key} checked={current.action === "reject_quote"} onChange={() => edit(item.key, { action: "reject_quote", confirmed: false })}/> Rejeitar trecho</label>
          </fieldset>
          {current.action === "accept_quote" && <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor={"dest-" + item.key}>Destino proposto (somente literatura)</label>
            <select id={"dest-" + item.key} disabled={disabled} value={current.destination} onChange={event => edit(item.key, { destination: event.target.value as LiteratureDestination, confirmed: false })} className="w-full rounded-card border border-line bg-white px-3 py-2 text-sm text-ink">
              {destinationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" disabled={disabled} checked={current.confirmed} onChange={event => edit(item.key, { confirmed: event.target.checked })}/> Confirmo o destino da evidência publicada. Ela não será tratada como resultado original da minha pesquisa.</label>
          </div>}
        </article>;
      })}
    </div>
    {!cells.length && <p className="text-sm text-ink-soft">Nenhum trecho extraível foi identificado nos abstracts selecionados.</p>}
    <button type="button" disabled={disabled || !cells.length} onClick={generatePreview} className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Gerar prévia de incorporação</button>
    {error && <p role="alert" className="text-sm text-amber-900">{error}</p>}
    {preview && <div role="status" className="rounded-card border border-line bg-paper p-4 space-y-2">
      <h3 className="font-medium text-ink">Prévia preparada — nenhuma alteração salva</h3>
      <p className="text-sm text-ink-soft">{preview.drafts.length} trecho(s) selecionado(s) para revisão final; {preview.blocked.length} bloqueado(s).</p>
      <ul className="space-y-2 text-sm text-ink-soft">
        {preview.drafts.map((draft, index) => <li key={draft.articleId + ":" + index} className="border-t border-line pt-2">
          <strong>{draft.citation.title}</strong> · {destinationOptions.find(option => option.value === draft.destination)?.label}
          <span className="block mt-1">{draft.quote}</span>
        </li>)}
      </ul>
      <p className="text-xs text-ink-soft">A confirmação final e o salvamento autenticado ainda não foram habilitados. Revise as interpretações científicas antes de utilizar qualquer conteúdo.</p>
    </div>}
  </section>;
}

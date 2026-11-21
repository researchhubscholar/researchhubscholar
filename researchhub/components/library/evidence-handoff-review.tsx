"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import type { ReportedResultKind } from "@/lib/literature/deep-results-evidence";
import { useEffect, useMemo, useState } from "react";
import { buildEvidenceMatrixPreview, type MatrixSource } from "@/lib/literature/evidence-matrix-preview";
import { type EvidenceReviewDecision } from "@/lib/literature/evidence-review";
import {
  prepareProjectEvidenceHandoff, type LiteratureDestination,
  type ProjectHandoffChoice, type ProjectHandoffPreview, type ProjectEvidenceDraft,
} from "@/lib/literature/project-evidence-handoff";

const destinationOptions: { value: LiteratureDestination; label: [string, string] }[] = [
  { value: "literature_notes", label: ["Notas da literatura", "Notas de la literatura"] },
  { value: "introduction_background", label: ["Contextualização da introdução", "Contexto de la introducción"] },
  { value: "discussion_evidence", label: ["Evidências para a discussão", "Evidencia para la discusión"] },
];

const resultLabels: Record<ReportedResultKind, [string, string]> = {
  denominator: ["Denominador", "Denominador"],
  unit: ["Unidade de medida", "Unidad de medida"],
  group: ["Grupo", "Grupo"],
  timepoint: ["Momento da medição", "Momento de medición"],
  effect_adjustment: ["Ajuste da estimativa", "Ajuste de la estimación"],
  effect_estimate: ["Estimativa de efeito", "Estimación del efecto"],
  confidence_interval: ["Intervalo de confiança", "Intervalo de confianza"],
  rate: ["Taxa", "Tasa"],
  missingness: ["Dados ausentes", "Datos faltantes"],
};

type Props = { projectId: string; sources: MatrixSource[]; disabled?: boolean; onApply?: (drafts: ProjectEvidenceDraft[]) => boolean };
type Decision = "accept_quote" | "reject_quote";
type Choice = { action?: Decision; destination: LiteratureDestination; confirmed: boolean };

export function EvidenceHandoffReview({ projectId, sources, disabled = false, onApply }: Props) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [entries, setEntries] = useState<Record<string, Choice>>({});
  const [preview, setPreview] = useState<ProjectHandoffPreview | null>(null);
  const [error, setError] = useState<"blocked" | "preview" | "apply" | null>(null);
  const errorMessages = {
    blocked: es ? "Algunos fragmentos no pasaron la validación. Revisa las fuentes y las opciones elegidas." : "Alguns trechos não passaram pela validação. Revise as fontes e as escolhas.",
    preview: es ? "No se pudo preparar la vista previa. Comprueba el proyecto, los artículos y los fragmentos." : "A prévia não pôde ser preparada. Confirme o projeto, os artigos e os trechos.",
    apply: es ? "No se pudieron insertar los fragmentos. Revisa las fuentes vinculadas al proyecto." : "Não foi possível inserir os trechos. Confira as fontes vinculadas ao projeto.",
  };
  const matrix = useMemo(() => {
    try { return buildEvidenceMatrixPreview(sources); }
    catch { return null; }
  }, [sources]);
  const sourceSnapshot = JSON.stringify(sources);
  useEffect(() => { setEntries({}); setPreview(null); setError(null); }, [projectId, sourceSnapshot]);
  const destinations = onApply ? destinationOptions.slice(1) : destinationOptions;
  const defaultDestination = destinations[0].value;
  const cells = useMemo(() => matrix?.rows.flatMap(row =>
    row.cells.map((cell, index) => ({ row, cell, index, key: row.articleId + ":" + index }))) ?? [], [matrix]);

  function edit(key: string, patch: Partial<Choice>) {
    setEntries(current => ({
      ...current, [key]: { ...current[key], destination: patch.destination ?? current[key]?.destination ?? defaultDestination,
        confirmed: patch.confirmed ?? current[key]?.confirmed ?? false,
        action: patch.action ?? current[key]?.action },
    }));
    setPreview(null);
    setError(null);
  }
  function generatePreview() {
    if (disabled || !matrix) return;
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
      setError(prepared.blocked.length ? "blocked" : null);
    } catch {
      setPreview(null);
      setError("preview");
    }
  }

  if (!matrix) {
    return <p role="alert" className="rounded-card border border-line bg-paper p-4 text-sm text-ink-soft">{es ? "No se pudo preparar la evidencia. Revisa los artículos seleccionados." : "Não foi possível preparar as evidências. Revise os artigos selecionados."}</p>;
  }
  return <div className="min-w-0 space-y-4">
    <p className="text-sm leading-relaxed text-ink-soft">{es
      ? "Revisa el fragmento del artículo y elige en qué sección del manuscrito insertarlo."
      : "Confira o trecho do artigo e escolha em qual seção do manuscrito inseri-lo."}</p>
    <div className="space-y-4">
      {cells.map(item => {
        const current = entries[item.key] || { destination: defaultDestination, confirmed: false };
        return <article key={item.key} className="rounded-card border border-line bg-paper p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="min-w-0 break-words font-medium text-sm text-ink">{item.row.title}</p>
            <span className="text-xs text-ink-soft">{resultLabels[item.cell.kind][es ? 1 : 0]} · {item.row.pmid ? "PMID " + item.row.pmid : item.row.doi ? "DOI " + item.row.doi : (es ? "Fuente sin identificador externo" : "Fonte sem identificador externo")}</span>
          </div>
          <blockquote className="break-words border-l-2 border-teal pl-3 text-sm leading-relaxed text-ink-soft">{item.cell.excerpt}</blockquote>
          <p className="text-xs text-ink-soft">{es ? "Expresión identificada" : "Expressão identificada"}: {item.cell.matchedText}. {es ? "Revisa la interpretación científica por separado." : "Revise a interpretação científica separadamente."}</p>
          <fieldset disabled={disabled} className="space-y-2">
            <legend className="text-sm font-medium text-ink">{es ? "¿El fragmento corresponde al artículo?" : "O trecho corresponde ao artigo?"}</legend>
            <label className="mr-5 inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={"review-" + item.key} checked={current.action === "accept_quote"} onChange={() => edit(item.key, { action: "accept_quote" })}/> {es ? "Confirmar fragmento" : "Confirmar trecho"}</label>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={"review-" + item.key} checked={current.action === "reject_quote"} onChange={() => edit(item.key, { action: "reject_quote", confirmed: false })}/> {es ? "Rechazar fragmento" : "Rejeitar trecho"}</label>
          </fieldset>
          {current.action === "accept_quote" && <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor={"dest-" + item.key}>{es ? "Destino de la evidencia" : "Destino proposto (somente literatura)"}</label>
            <select id={"dest-" + item.key} disabled={disabled} value={current.destination} onChange={event => edit(item.key, { destination: event.target.value as LiteratureDestination, confirmed: false })} className="w-full rounded-card border border-line bg-white px-3 py-2 text-sm text-ink">
              {destinations.map(option => <option key={option.value} value={option.value}>{option.label[es ? 1 : 0]}</option>)}
            </select>
            <label className="flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" disabled={disabled} checked={current.confirmed} onChange={event => edit(item.key, { confirmed: event.target.checked })}/> {es ? "Confirmo el destino de la evidencia publicada. Se citará como literatura." : "Confirmo o destino da evidência publicada. Ela não será tratada como resultado original da minha pesquisa."}</label>
          </div>}
        </article>;
      })}
    </div>
    {!cells.length && <p className="text-sm text-ink-soft">{es ? "No se encontraron fragmentos en los resúmenes seleccionados." : "Nenhum trecho extraível foi identificado nos abstracts selecionados."}</p>}
    <button type="button" disabled={disabled || !cells.length} onClick={generatePreview} className="min-h-11 w-full rounded-card bg-teal px-4 py-2 sm:w-auto text-sm font-medium text-white disabled:opacity-50">{es ? "Generar vista previa" : "Gerar prévia de incorporação"}</button>
    {error && <p role="alert" className="text-sm text-amber-900">{errorMessages[error]}</p>}
    {preview && <div role="status" className="rounded-card border border-line bg-paper p-4 space-y-2">
      <h3 className="font-medium text-ink">{es ? "Vista previa lista. Falta confirmar la inserción." : "Prévia preparada — nenhuma alteração salva"}</h3>
      <p className="text-sm text-ink-soft">{es ? "Fragmentos para revisión final" : "Trechos para revisão final"}: {preview.drafts.length} · Bloqueados: {preview.blocked.length}</p>
      <ul className="space-y-2 text-sm text-ink-soft">
        {preview.drafts.map((draft, index) => <li key={draft.articleId + ":" + index} className="border-t border-line pt-2">
          <strong>{draft.citation.title}</strong> · {destinationOptions.find(option => option.value === draft.destination)?.label[es ? 1 : 0]}
          <span className="mt-1 block break-words">{draft.quote}</span>
        </li>)}
      </ul>
      {onApply && <button type="button" disabled={disabled || !preview.drafts.length || !!preview.blocked.length}
        onClick={() => {
          if (onApply(preview.drafts)) { setPreview(null); setEntries({}); }
          else setError("apply");
        }}
        className="min-h-11 w-full rounded-card bg-teal px-4 py-2 sm:w-auto text-sm text-white disabled:opacity-50">
        {es ? "Confirmar e insertar en el manuscrito" : "Confirmar e inserir no manuscrito"}
      </button>}
    </div>}
  </div>;
}

import { buildEvidenceMatrixPreview, type MatrixSource } from "./evidence-matrix-preview";
import { reviewEvidence, type EvidenceReviewDecision } from "./evidence-review";
import { verifyEvidenceAnchor, type EvidenceAnchor } from "./provenance";

/**
 * IA-09 — supervised handoff of literature evidence to a project preview.
 * The returned payload is never saved and never becomes original study results.
 * Source review is recomputed from the current abstracts (not client assertions).
 */
export type LiteratureDestination = "literature_notes" | "introduction_background" | "discussion_evidence";
export type ProjectHandoffChoice = {
  articleId: string;
  cellIndex: number;
  destination: LiteratureDestination;
  destinationConfirmed: true;
};
export type ProjectEvidenceDraft = {
  projectId: string;
  articleId: string;
  destination: LiteratureDestination;
  classification: "published_literature";
  quote: string;
  matchedText: string;
  citation: { title: string; pmid: string | null; doi: string | null };
  provenance: EvidenceAnchor;
  confirmation: "source_quote_reviewed_and_destination_selected";
  scientificInterpretationVerified: false;
  projectDataResult: false;
  saveStatus: "preview_only";
};
export type ProjectHandoffPreview = {
  status: "requires_final_confirmation";
  drafts: ProjectEvidenceDraft[];
  blocked: Array<{ articleId: string; cellIndex: number; reason: string }>;
  storageMutationPerformed: false;
  manuscriptMutationPerformed: false;
  originalResultsMutationPerformed: false;
};

const validDestinations: readonly LiteratureDestination[] = [
  "literature_notes", "introduction_background", "discussion_evidence",
];
const safeProjectId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9:_-]{1,90}$/.test(value);

/**
 * Only quotes explicitly accepted by IA-08 can be routed to a literature-only
 * destination. A final explicit write flow must re-check ownership and sources.
 */
export function prepareProjectEvidenceHandoff(
  projectId: string,
  articles: MatrixSource[],
  reviews: EvidenceReviewDecision[],
  choices: ProjectHandoffChoice[],
): ProjectHandoffPreview {
  if (!safeProjectId(projectId)) throw new Error("Projeto de destino inválido.");
  if (!Array.isArray(choices) || choices.length > 60) throw new Error("Selecione até 60 evidências.");
  const matrix = buildEvidenceMatrixPreview(articles);
  const reviewed = reviewEvidence(articles, reviews);
  const accepted = new Set(reviewed.accepted.map(item =>
    [item.articleId, item.kind, item.quote, item.matchedText, item.provenance.start].join("\u0000"),
  ));
  const sources = new Map(articles.map(item => [item.articleId, item]));
  const rows = new Map(matrix.rows.map(row => [row.articleId, row]));
  const drafts: ProjectEvidenceDraft[] = [];
  const blocked: ProjectHandoffPreview["blocked"] = [];
  const seen = new Set<string>();
  for (const choice of choices) {
    const articleId = typeof choice?.articleId === "string" ? choice.articleId : "";
    const cellIndex = choice?.cellIndex;
    if (typeof cellIndex !== "number" || !Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= 60) {
      blocked.push({articleId, cellIndex:-1, reason:"Trecho de origem inválido."});
      continue;
    }
    const index = cellIndex as number;
    const key = articleId + ":" + index;
    if (seen.has(key)) {
      blocked.push({articleId, cellIndex:index, reason:"A mesma evidência já foi selecionada."});
      continue;
    }
    seen.add(key);
    const row = rows.get(articleId);
    const source = sources.get(articleId);
    const cell = row?.cells[index];
    if (!source || !row || !cell || !verifyEvidenceAnchor(source.abstract,cell.provenance)) {
      blocked.push({articleId,cellIndex:index,reason:"A origem precisa ser verificada novamente."});
      continue;
    }
    if (choice.destinationConfirmed !== true ||
      !validDestinations.includes(choice.destination)) {
      blocked.push({articleId,cellIndex:index,reason:"Confirme um campo de literatura permitido."});
      continue;
    }
    const approvedKey = [articleId,cell.kind,cell.excerpt,cell.matchedText,cell.provenance.start].join("\u0000");
    if (!accepted.has(approvedKey)) {
      blocked.push({articleId,cellIndex:index,reason:"A evidência ainda não foi confirmada na revisão."});
      continue;
    }
    drafts.push({
      projectId,articleId,destination:choice.destination,
      classification:"published_literature",
      quote:cell.excerpt,matchedText:cell.matchedText,
      citation:{title:row.title,pmid:row.pmid,doi:row.doi},
      provenance:cell.provenance,
      confirmation:"source_quote_reviewed_and_destination_selected",
      scientificInterpretationVerified:false,projectDataResult:false,saveStatus:"preview_only",
    });
  }
  return {
    status:"requires_final_confirmation",drafts,blocked,
    storageMutationPerformed:false,
    manuscriptMutationPerformed:false,
    originalResultsMutationPerformed:false,
  };
}

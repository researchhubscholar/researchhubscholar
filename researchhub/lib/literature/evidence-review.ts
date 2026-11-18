import type { EvidenceMatrixPreview, MatrixCell, MatrixSource } from "./evidence-matrix-preview";
import { buildEvidenceMatrixPreview } from "./evidence-matrix-preview";
import { verifyEvidenceAnchor } from "./provenance";

/**
 * IA-08 — Pure, review-only decision gate for scientific evidence.
 * A reviewer confirms that a quoted fragment belongs to the source. This is
 * NOT scientific validation, interpretation approval, publication, or saving.
 * Nothing is written to Biblioteca, Meu Projeto, or patient-level datasets.
 */
export type EvidenceReviewDecision = {
  articleId: string;
  cellIndex: number;
  expectedExcerpt: string;
  expectedMatchedText: string;
  action: "accept_quote" | "reject_quote";
  reviewerConfirmed: true;
};
export type ReviewedEvidence = {
  articleId: string;
  kind: MatrixCell["kind"];
  quote: string;
  matchedText: string;
  title: string;
  pmid: string | null;
  doi: string | null;
  provenance: MatrixCell["provenance"];
  status: "source_quote_confirmed";
  interpretationVerified: false;
  approvedForManuscript: false;
};
export type EvidenceReviewResult = {
  status: "review_only";
  accepted: ReviewedEvidence[];
  rejected: number;
  pending: number;
  blocked: Array<{ articleId: string; cellIndex: number; reason: string }>;
  persistencePerformed: false;
  exportAllowedWithoutFurtherReview: false;
};

/**
 * Rebuild against the current abstracts, not an untrusted client-submitted
 * preview. Reject stale/tampered fragments by exact excerpt and match text.
 */
export function reviewEvidence(
  articles: MatrixSource[],
  decisions: EvidenceReviewDecision[],
): EvidenceReviewResult {
  if (!Array.isArray(decisions) || decisions.length > 120) {
    throw new Error("Revise no máximo 120 trechos por vez.");
  }
  const matrix: EvidenceMatrixPreview = buildEvidenceMatrixPreview(articles);
  const sources = new Map(articles.map(article => [article.articleId, article]));
  const rows = new Map(matrix.rows.map(row => [row.articleId, row]));
  const accepted: ReviewedEvidence[] = [];
  const blocked: EvidenceReviewResult["blocked"] = [];
  const keys = new Set<string>();
  let rejected = 0;

  for (const decision of decisions) {
    const articleId = typeof decision?.articleId === "string" ? decision.articleId : "";
    const index = decision?.cellIndex;
    if (!Number.isInteger(index) || index < 0 || index >= 60) {
      blocked.push({articleId, cellIndex: -1, reason:"Índice de evidência inválido."});
      continue;
    }
    const cellIndex = index as number;
    const key = articleId + ":" + cellIndex;
    if (keys.has(key)) {
      blocked.push({articleId, cellIndex, reason:"Uma evidência não pode receber duas decisões."});
      continue;
    }
    keys.add(key);
    const source = sources.get(articleId);
    const row = rows.get(articleId);
    const cell = row?.cells[cellIndex];
    if (!source || !row || !cell
      || typeof decision.expectedExcerpt !== "string"
      || typeof decision.expectedMatchedText !== "string"
      || decision.expectedExcerpt !== cell.excerpt
      || decision.expectedMatchedText !== cell.matchedText
      || !verifyEvidenceAnchor(source.abstract, cell.provenance)
      || !cell.excerpt.includes(cell.matchedText)) {
      blocked.push({articleId, cellIndex, reason:"A fonte ou o trecho mudou. Refaça a revisão."});
      continue;
    }
    if (decision.reviewerConfirmed !== true || !["accept_quote", "reject_quote"].includes(decision.action)) {
      blocked.push({articleId, cellIndex, reason:"É necessária uma decisão explícita do pesquisador."});
      continue;
    }
    if (decision.action === "reject_quote") {
      rejected++;
      continue;
    }
    accepted.push({
      articleId, kind: cell.kind, quote: cell.excerpt, matchedText: cell.matchedText,
      title: row.title, pmid: row.pmid, doi: row.doi, provenance: cell.provenance,
      status: "source_quote_confirmed",
      interpretationVerified: false,
      approvedForManuscript: false,
    });
  }
  const total = matrix.rows.reduce((count, row) => count + row.cells.length, 0);
  return {
    status: "review_only", accepted, rejected,
    pending: total - accepted.length - rejected,
    blocked, persistencePerformed: false,
    exportAllowedWithoutFurtherReview: false,
  };
}

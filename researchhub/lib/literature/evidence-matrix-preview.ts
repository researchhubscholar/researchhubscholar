import type { StudyDesign } from "./matrix-template";
import { resolveExtractionDesign } from "./structured-extraction";
import { extractDeepResultsEvidence, type ReportedResultKind } from "./deep-results-evidence";
import { verifyEvidenceAnchor, type EvidenceAnchor } from "./provenance";

/**
 * IA-07: review-only matrix preview assembled from published abstracts.
 * Never writes to evidence_matrix or to the user's original research dataset.
 * Comparison means "side by side", not meta-analysis or pooled estimates.
 */
export type MatrixSource = {
  articleId: string;
  title: string;
  abstract: string;
  publicationTypes?: string[];
  studyDesign?: StudyDesign;
  pmid?: string | null;
  doi?: string | null;
};
export type MatrixCell = {
  kind: ReportedResultKind;
  excerpt: string;
  matchedText: string;
  provenance: EvidenceAnchor;
  status: "pending_human_review";
  interpretationVerified: false;
};
export type MatrixRow = {
  articleId: string;
  title: string;
  pmid: string | null;
  doi: string | null;
  studyDesign: Exclude<StudyDesign, "auto">;
  sourceScope: "published_abstract";
  cells: MatrixCell[];
  missing: ReportedResultKind[];
  humanConfirmed: false;
};
export type EvidenceMatrixPreview = {
  kind: "review_only_preview";
  rows: MatrixRow[];
  limitations: {
    noCrossArticleInference: true;
    noPooledEstimates: true;
    noPatientLevelData: true;
    noAutomaticPersistence: true;
    fullTextNotReviewed: true;
  };
};

const safeId = (value: string): boolean => /^[a-zA-Z0-9:_-]{1,90}$/.test(value);
const safeTitle = (value: string): boolean => value.trim().length >= 2 && value.length <= 500;
const kinds: ReportedResultKind[] = ["denominator", "unit", "group", "timepoint", "effect_adjustment", "effect_estimate", "missingness"];

export function buildEvidenceMatrixPreview(articles: MatrixSource[]): EvidenceMatrixPreview {
  if (!Array.isArray(articles) || articles.length > 12) throw new Error("Selecione até 12 artigos para comparação.");
  const seen = new Set<string>();
  const rows: MatrixRow[] = [];
  for (const article of articles) {
    if (!article || typeof article.articleId !== "string" || !safeId(article.articleId)
      || typeof article.title !== "string" || !safeTitle(article.title)
      || typeof article.abstract !== "string" || article.abstract.length > 18000) {
      throw new Error("Os artigos precisam ter identificador, título e abstract válidos.");
    }
    if (seen.has(article.articleId)) throw new Error("Não repita o mesmo artigo na matriz.");
    seen.add(article.articleId);
    const { studyDesign } = resolveExtractionDesign(article.title, article.publicationTypes || [], article.studyDesign);
    const extracted = extractDeepResultsEvidence(article.abstract);
    const cells: MatrixCell[] = extracted.fragments
      .filter(fragment => verifyEvidenceAnchor(article.abstract, fragment.provenance))
      .slice(0, 60)
      .map(fragment => ({
        kind: fragment.kind,
        excerpt: fragment.context,
        matchedText: fragment.raw,
        provenance: fragment.provenance,
        status: "pending_human_review" as const,
        interpretationVerified: false as const,
      }));
    const found = new Set(cells.map(cell => cell.kind));
    rows.push({
      articleId: article.articleId, title: article.title,
      pmid: typeof article.pmid === "string" ? article.pmid.slice(0, 30) : null,
      doi: typeof article.doi === "string" ? article.doi.slice(0, 150) : null,
      studyDesign, sourceScope: "published_abstract", cells,
      missing: kinds.filter(kind => !found.has(kind)),
      humanConfirmed: false,
    });
  }
  return {
    kind: "review_only_preview", rows,
    limitations: {
      noCrossArticleInference: true, noPooledEstimates: true, noPatientLevelData: true,
      noAutomaticPersistence: true, fullTextNotReviewed: true,
    },
  };
}

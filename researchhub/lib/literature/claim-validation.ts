import { type EvidenceAnchor, verifyEvidenceAnchor } from "./provenance";

/**
 * IA-04 — conservative validation of quantitative claims from abstracts.
 * This is evidence checking, not statistical or methodological validation.
 * No numerical inference, rounding, unit conversion or causality is inferred.
 */
export type ClaimValidation = {
  status: "verifiable_excerpt" | "review_required" | "unsupported";
  numbersInClaim: string[];
  unmatchedNumbers: string[];
  evidenceChecked: boolean;
  scientificInterpretationVerified: false;
  warnings: string[];
};

const numericExpression = /(?<![\p{L}\p{N}])(?:[<>≤≥~≈]\s*)?[+-]?(?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu;

export function extractNumericExpressions(text: string): string[] {
  return [...text.matchAll(numericExpression)].map(match => match[0].replace(/\s+/g, "").trim());
}

function comparisonKey(value: string) {
  // Only whitespace normalization. Commas, decimal points, inequality signs and
  // percent signs remain significant to avoid false numeric equivalence.
  return value.replace(/\s+/g, "").trim();
}

export function validateClaimAgainstEvidence(
  claim: string,
  abstract: string,
  anchor: EvidenceAnchor,
): ClaimValidation {
  const claimNumbers = extractNumericExpressions(claim);
  const evidenceChecked = verifyEvidenceAnchor(abstract, anchor);
  if (!evidenceChecked) {
    return {
      status: "unsupported", numbersInClaim: claimNumbers,
      unmatchedNumbers: claimNumbers, evidenceChecked: false,
      scientificInterpretationVerified: false,
      warnings: ["A origem textual não foi verificada. Não incorpore esta afirmação como resultado confirmado."],
    };
  }
  const sourceNumbers = new Set(extractNumericExpressions(anchor.excerpt).map(comparisonKey));
  const missing = [...new Set(claimNumbers.filter(number => !sourceNumbers.has(comparisonKey(number))))];
  if (missing.length > 0) {
    return {
      status: "unsupported", numbersInClaim: claimNumbers,
      unmatchedNumbers: missing, evidenceChecked: true,
      scientificInterpretationVerified: false,
      warnings: ["A afirmação contém valores numéricos ausentes do trecho de origem. Revise os dados antes de usar."],
    };
  }
  return {
    status: claimNumbers.length ? "review_required" : "verifiable_excerpt",
    numbersInClaim: claimNumbers, unmatchedNumbers: [], evidenceChecked: true,
    scientificInterpretationVerified: false,
    warnings: claimNumbers.length
      ? ["Valores encontrados no trecho, mas denominadores, unidades, grupos, tempo, ajustes e interpretação exigem revisão humana."]
      : ["Trecho confirmado. A correspondência textual não valida causalidade, desenho do estudo ou força da evidência."],
  };
}

/** Safe output policy: verification never implies scientific correctness. */
export function claimMayBePresentedAsVerifiedResult(result: ClaimValidation): false {
  void result;
  return false;
}

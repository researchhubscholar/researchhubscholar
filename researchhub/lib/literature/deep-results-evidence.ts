import { anchorEvidence, verifyEvidenceAnchor, type EvidenceAnchor } from "./provenance";

/**
 * IA-06: reported-result fragments from an abstract. This deliberately does NOT
 * infer which denominator, group, outcome or timepoint belongs to another fragment.
 * These are source quotations for review, not normalized study data.
 */
export type ReportedResultKind =
  "denominator" | "unit" | "group" | "timepoint" | "effect_adjustment" | "effect_estimate" | "confidence_interval" | "rate" | "missingness";
export type ReportedResultFragment = {
  kind: ReportedResultKind;
  raw: string;
  context: string;
  provenance: EvidenceAnchor;
  source: "published_abstract";
  verification: "exact_excerpt";
  associationStatus: "unresolved";
  reviewRequired: true;
};
export type DeepResultsEvidence = {
  scope: "published_abstract";
  fragments: ReportedResultFragment[];
  notIdentifiedInAbstract: ReportedResultKind[];
  limitations: {
    originalResearchDataImported: false;
    individualPatientDataAvailable: false;
    denominatorsLinkedToOutcomes: false;
    effectsStatisticallyVerified: false;
    pageTableCellAvailable: false;
    allFragmentsRequireReview: true;
  };
};

const patterns: Record<ReportedResultKind, RegExp> = {
  denominator: /\b(?:n\s*=\s*\d+|\d+\s*(?:\/|of)\s*\d+|\d+\s+(?:patients?|participants?|subjects?|studies|trials|cases|controls))\b/gi,
  unit: /\b\d+(?:[.,]\d+)?\s*(?:mg\/dL|mmol\/L|kg\/m2|kg|mmHg|mg|µg|mcg|mL|mm|cm)\b/gi,
  group: /\b(?:intervention group|control group|placebo group|treatment group|exposed group|unexposed group|cases|controls)\b/gi,
  timepoint: /\b(?:baseline|follow[- ]up|at\s+\d+\s*(?:days?|weeks?|months?|years?)|after\s+\d+\s*(?:days?|weeks?|months?|years?))\b/gi,
  effect_adjustment: /\b(?:adjusted|multivariable|multivariate|unadjusted|crude)\s+(?:odds ratio|hazard ratio|risk ratio|relative risk|estimate|analysis|model|OR|HR|RR)\b/gi,
  effect_estimate: /\b(?:adjusted odds ratio|adjusted hazard ratio|adjusted risk ratio|odds ratio|hazard ratio|risk ratio|relative risk|aOR|aHR|aRR|OR|HR|RR)\s*[,=:]?\s*\d+(?:[.,]\d+)?\b/gi,
  confidence_interval: /\b\d+(?:[.,]\d+)?\s*%\s*(?:confidence interval(?:\s*\[CI\])?|CI)\s*[,=:]?\s*[[(]?\s*[+−-]?\d+(?:[.,]\d+)?\s*(?:to|[–—-]|[,;])\s*[+−-]?\d+(?:[.,]\d+)?\b/gi,
  rate: /\b\d+(?:[.,]\d+)?\s*%\s*(?:per|\/)\s*(?:person[- ]?)?(?:days?|weeks?|months?|years?)\b/gi,
  missingness: /\b(?:missing data|missing values|lost to follow[- ]up|attrition|dropouts?|excluded due to missing|incomplete records)\b/gi,
};

export const reportedResultKinds = Object.keys(patterns) as readonly ReportedResultKind[];

/** Never use a fragment outside the provided abstract as valid evidence. */
export function extractDeepResultsEvidence(abstract: string): DeepResultsEvidence {
  const normalized = abstract.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 18000);
  const fragments: ReportedResultFragment[] = [];
  for (const kind of reportedResultKinds) {
    const expression = new RegExp(patterns[kind].source, patterns[kind].flags);
    let match: RegExpExecArray | null;
    while ((match = expression.exec(normalized)) !== null && fragments.length < 100) {
      const start = Math.max(0, match.index - 90);
      const context = normalized.slice(start, Math.min(normalized.length, match.index + match[0].length + 90)).trim();
      const provenance = anchorEvidence(abstract, context);
      if (!verifyEvidenceAnchor(abstract, provenance)) continue;
      fragments.push({
        kind, raw: match[0], context, provenance, source: "published_abstract",
        verification: "exact_excerpt", associationStatus: "unresolved", reviewRequired: true,
      });
    }
  }
  fragments.sort((a, b) => (a.provenance.start ?? 0) - (b.provenance.start ?? 0));
  const found = new Set(fragments.map(fragment => fragment.kind));
  return {
    scope: "published_abstract",
    fragments,
    notIdentifiedInAbstract: reportedResultKinds.filter(kind => !found.has(kind)),
    limitations: {
      originalResearchDataImported: false,
      individualPatientDataAvailable: false,
      denominatorsLinkedToOutcomes: false,
      effectsStatisticallyVerified: false,
      pageTableCellAvailable: false,
      allFragmentsRequireReview: true,
    },
  };
}

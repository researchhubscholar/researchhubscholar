import { inferStudyDesign, type StudyDesign } from "./matrix-template";
import { anchorEvidence, verifyEvidenceAnchor, type EvidenceAnchor } from "./provenance";
import { validateClaimAgainstEvidence, type ClaimValidation } from "./claim-validation";

/**
 * IA-05: structured evidence extraction from the supplied abstract only.
 * Neither the abstract nor publication metadata is interpreted as patient-level data.
 * Candidates are exact excerpts for human review, never normalized effect estimates.
 */
export type EvidenceKind = "sample" | "groups" | "outcome" | "effect" | "uncertainty" | "timepoint";
export type StructuredEvidence = {
  kind: EvidenceKind;
  text: string;
  source: "abstract";
  provenance: EvidenceAnchor;
  validation: ClaimValidation;
  status: "review_required";
};
export type StructuredExtraction = {
  studyDesign: Exclude<StudyDesign, "auto">;
  designSource: "user" | "publication_metadata" | "unknown";
  sourceScope: "abstract_only";
  candidates: StructuredEvidence[];
  missing: EvidenceKind[];
  safeguards: {
    reviewRequired: true;
    evidenceIsAggregated: true;
    hasParticipantLevelData: false;
    numericalInterpretationVerified: false;
    hasPageLevelEvidence: false;
  };
};

const KINDS: readonly EvidenceKind[] = ["sample", "groups", "outcome", "effect", "uncertainty", "timepoint"];
const markers: Record<EvidenceKind, RegExp> = {
  sample: /\b(?:n\s*=\s*\d+|\d+[\s-]+(?:patients?|participants?|subjects?|individuals?|studies|trials|cases|controls|residents?|adults?|children)|sample (?:of|size)|included \d+)\b/i,
  groups: /\b(?:randomi[sz]ed|allocated|intervention|control group|treatment group|placebo|exposed|unexposed|cases? and controls?|comparison group)\b/i,
  outcome: /\b(?:primary outcome|secondary outcome|endpoint|incidence|prevalence|mortality|remission|response rate|symptoms?|quality of life)\b/i,
  effect: /\b(?:adjusted (?:odds|hazard|risk) ratio|odds ratio|hazard ratio|risk ratio|relative risk|mean difference|effect size|\b(?:aOR|aHR|OR|HR|RR)\s*[=:]?\s*\d|standardized mean difference)\b/i,
  uncertainty: /\b(?:confidence interval|credible interval|\bCI\s*[:=]?\s*\d|p\s*[<=>]\s*\d|\d+\s*%\s*CI)\b/i,
  timepoint: /\b(?:follow[- ]up|baseline|after \d+\s*(?:days?|weeks?|months?|years?)|at \d+\s*(?:days?|weeks?|months?|years?)|\d+[- ](?:day|week|month|year) follow[- ]up)\b/i,
};
const designKinds: Record<Exclude<StudyDesign, "auto">, readonly EvidenceKind[]> = {
  "clinical-trial": ["sample", "groups", "outcome", "effect", "uncertainty", "timepoint"],
  cohort: ["sample", "groups", "outcome", "effect", "uncertainty", "timepoint"],
  "case-control": ["sample", "groups", "outcome", "effect", "uncertainty"],
  "cross-sectional": ["sample", "outcome", "effect", "uncertainty"],
  "systematic-review": ["sample", "outcome", "effect", "uncertainty"],
  qualitative: ["sample", "outcome"],
  "case-report": ["sample", "outcome", "timepoint"],
  other: ["sample", "outcome", "effect", "uncertainty"],
};

/** Do not guess study design from clinical language in an abstract. */
export function resolveExtractionDesign(
  title: string,
  publicationTypes: string[],
  selected: unknown,
): { studyDesign: Exclude<StudyDesign, "auto">; designSource: StructuredExtraction["designSource"] } {
  const allowed: readonly StudyDesign[] = ["clinical-trial", "cohort", "case-control", "cross-sectional", "systematic-review", "qualitative", "case-report", "other"];
  if (typeof selected === "string" && allowed.includes(selected as StudyDesign)) {
    return { studyDesign: selected as Exclude<StudyDesign, "auto">, designSource: "user" };
  }
  const detected = inferStudyDesign({ title, publicationTypes });
  return { studyDesign: detected, designSource: detected === "other" ? "unknown" : "publication_metadata" };
}

function excerpts(abstract: string): string[] {
  // Maintain exact substrings of the normalized abstract for reproducible offsets.
  const normalized = abstract.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.split(/(?<=[.!?])\s+(?=[A-Z\d])/).map(s => s.trim()).filter(s => s.length >= 12);
}

export function extractStructuredEvidence(
  abstract: string,
  options: { title?: string; publicationTypes?: string[]; studyDesign?: StudyDesign } = {},
): StructuredExtraction {
  const { studyDesign, designSource } = resolveExtractionDesign(
    String(options.title || "").slice(0, 300),
    (options.publicationTypes || []).filter(x => typeof x === "string").slice(0, 15),
    options.studyDesign,
  );
  const candidates: StructuredEvidence[] = [];
  for (const sentence of excerpts(abstract).slice(0, 100)) {
    for (const kind of KINDS) {
      if (!markers[kind].test(sentence)) continue;
      // Multiple kinds can share a sentence but must always cite that sentence.
      const provenance = anchorEvidence(abstract, sentence);
      if (!verifyEvidenceAnchor(abstract, provenance)) continue;
      candidates.push({
        kind, text: sentence.slice(0, 520), source: "abstract",
        provenance, validation: validateClaimAgainstEvidence(sentence.slice(0, 520), abstract, provenance),
        status: "review_required",
      });
      if (candidates.length >= 30) break;
    }
    if (candidates.length >= 30) break;
  }
  const found = new Set(candidates.map(item => item.kind));
  return {
    studyDesign, designSource, sourceScope: "abstract_only", candidates,
    missing: designKinds[studyDesign].filter(kind => !found.has(kind)),
    safeguards: {
      reviewRequired: true,
      evidenceIsAggregated: true,
      hasParticipantLevelData: false,
      numericalInterpretationVerified: false,
      hasPageLevelEvidence: false,
    },
  };
}

import { NextRequest, NextResponse } from "next/server";
import { anchorEvidence, verifyEvidenceAnchor, normalizeEvidenceText, type EvidenceAnchor, type EvidenceOrigin } from "@/lib/literature/provenance";
import { validateClaimAgainstEvidence, type ClaimValidation } from "@/lib/literature/claim-validation";
import { extractStructuredEvidence } from "@/lib/literature/structured-extraction";
import type { StudyDesign } from "@/lib/literature/matrix-template";

type Suggestion = {
  value: string;
  source: string;
  confidence: "alta" | "media" | "baixa";
  provenance: EvidenceAnchor;
  validation: ClaimValidation;
};

function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sentences(text: string) {
  return clean(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function findSentence(items: string[], patterns: RegExp[]) {
  return items.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || "";
}

function section(text: string, labels: string[]) {
  const escaped = labels.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:.-]\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z /-]{2,25}\\s*[:.-]|$)`, "i");
  const match = text.match(re);
  return match?.[1] ? clean(match[1]) : "";
}

function clip(text: string, max = 420) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function make(value: string, source: string, confidence: Suggestion["confidence"], abstract: string, origin: EvidenceOrigin = "abstract"): Suggestion | null {
  if (!value.trim()) return null;
  const provenance = anchorEvidence(abstract, source, origin);
  const proposed = clip(clean(value), 520);
  const validation = validateClaimAgainstEvidence(proposed, abstract, provenance);
  return { value: proposed, source: clip(clean(source), 520), confidence, provenance, validation };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const abstract = String(body?.abstract ?? "").trim();
    const publicationTypes = Array.isArray(body?.publicationTypes) ? body.publicationTypes.map(String) : [];
    const title = typeof body?.title === "string" ? body.title.slice(0, 300) : "";
    const requestedDesign: StudyDesign | undefined = typeof body?.studyDesign === "string" ? body.studyDesign as StudyDesign : undefined;

    if (abstract.length < 40) {
      return NextResponse.json({ error: "Este artigo não possui abstract suficiente para pré-análise." }, { status: 400 });
    }

    const parts = sentences(abstract);

    const objectiveSection = section(abstract, ["OBJECTIVE", "OBJECTIVES", "AIM", "AIMS", "PURPOSE"]);
    const methodsSection = section(abstract, ["METHOD", "METHODS", "METHODOLOGY", "DESIGN"]);
    const resultsSection = section(abstract, ["RESULT", "RESULTS", "FINDINGS"]);
    const conclusionSection = section(abstract, ["CONCLUSION", "CONCLUSIONS", "INTERPRETATION"]);
    const limitationsSection = section(abstract, ["LIMITATION", "LIMITATIONS"]);

    const objectiveFallback = findSentence(parts, [
      /\b(aim|aimed|objective|purpose)\b/i,
      /\bwe (evaluated|assessed|investigated|examined|determined|compared|estimated)\b/i,
      /\bthis study (evaluated|assessed|investigated|examined|aimed|sought)\b/i,
    ]);

    const populationSentence = findSentence(parts, [
      /\b(patients?|participants?|subjects?|adults?|children|adolescents?|women|men|residents?|students?)\b.*\b(enrolled|included|recruited|participated|underwent|were)\b/i,
      /\bwe (included|enrolled|recruited|studied|analyzed)\b/i,
      /\b(n\s*=\s*\d+|\d+\s+(patients?|participants?|subjects?))\b/i,
    ]);

    const methodSentence = methodsSection || findSentence(parts, [
      /\b(randomized|randomised|double-blind|cohort|cross-sectional|case-control|retrospective|prospective|systematic review|meta-analysis|trial|survey|observational)\b/i,
      /\bwe (conducted|performed|reviewed|analyzed|analysed)\b/i,
    ]);

    const findingSentence = resultsSection || conclusionSection || findSentence(parts, [
      /\b(results?|findings?)\b/i,
      /\b(was associated|were associated|improved|reduced|increased|decreased|showed|demonstrated|suggests?|concluded)\b/i,
    ]);

    const limitationSentence = limitationsSection || findSentence(parts, [
      /\b(limitations?|limited by|small sample|single[- ]center|retrospective design|selection bias|confounding|short follow-up)\b/i,
    ]);

    const inferredMethod = publicationTypes.length > 0
      ? publicationTypes.slice(0, 3).join("; ")
      : methodSentence;

    const suggestions = {
      objective: make(objectiveSection || objectiveFallback, objectiveSection || objectiveFallback, objectiveSection ? "alta" : objectiveFallback ? "media" : "baixa", abstract),
      population: make(populationSentence, populationSentence, populationSentence ? "media" : "baixa", abstract),
      method: make(inferredMethod, publicationTypes.length ? publicationTypes.join("; ") : methodSentence, methodSentence ? "media" : publicationTypes.length ? "media" : "baixa", abstract, publicationTypes.length ? "publication_types" : "abstract"),
      finding: make(findingSentence, findingSentence, resultsSection || conclusionSection ? "alta" : findingSentence ? "media" : "baixa", abstract),
      limitation: make(limitationSentence, limitationSentence, limitationSentence ? "media" : "baixa", abstract),
    };
    const confirmed = Object.values(suggestions).filter((suggestion): suggestion is Suggestion => Boolean(suggestion))
      .filter(suggestion => suggestion.provenance.verification === "exact_excerpt"
        && verifyEvidenceAnchor(abstract, suggestion.provenance)).length;
    const normalizedAbstract = normalizeEvidenceText(abstract);
    return NextResponse.json({
      suggestions,
      ...(process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION === "true"
        ? { structuredEvidence: extractStructuredEvidence(abstract, { title, publicationTypes, studyDesign: requestedDesign }) }
        : {}),
      provenance: { scope: "abstract_only", normalizedAbstractLength: normalizedAbstract.length, verifiedExcerptCount: confirmed, fullTextAvailable: false, pageLevelAvailable: false },
      scientificValidation: { scope: "lexical_numeric_only", statisticallyVerified: false, requiresHumanReview: true },
      note: "Pré-análise automática baseada apenas no abstract e no tipo de publicação. Confirme cada campo antes de incorporar à matriz.",
    });
  } catch (error) {
    console.error("literature/extract error", error);
    return NextResponse.json({ error: "Não foi possível analisar o abstract agora." }, { status: 500 });
  }
}

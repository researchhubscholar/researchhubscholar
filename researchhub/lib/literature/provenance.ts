/**
 * IA-03 — Evidence provenance for article pre-analysis.
 * Records a verifiable location in the supplied abstract, not a PDF page or
 * a fabricated reference. Text from publication-type metadata is not evidence
 * from the article's abstract.
 */
export type EvidenceOrigin = "abstract" | "publication_types";
export type EvidenceAnchor = {
  origin: EvidenceOrigin;
  verification: "exact_excerpt" | "metadata_only" | "unverified";
  excerpt: string;
  start: number | null;
  end: number | null;
  page: null;
  table: null;
  cell: null;
};

export const normalizeEvidenceText = (text: string): string =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim();

function locate(haystack: string, needle: string): number {
  return haystack.indexOf(needle);
}

/** Anchors are offsets in the normalized abstract returned to the client. */
export function anchorEvidence(
  abstract: string,
  excerpt: string,
  origin: EvidenceOrigin = "abstract",
): EvidenceAnchor {
  const quote = normalizeEvidenceText(excerpt);
  const normalized = normalizeEvidenceText(abstract);
  if (origin === "publication_types") {
    return { origin, verification: "metadata_only", excerpt: quote.slice(0, 520),
      start: null, end: null, page: null, table: null, cell: null };
  }
  const start = quote && quote.length <= 520 ? locate(normalized, quote) : -1;
  if (start < 0) {
    return { origin, verification: "unverified", excerpt: quote.slice(0, 520),
      start: null, end: null, page: null, table: null, cell: null };
  }
  return { origin, verification: "exact_excerpt", excerpt: quote,
    start, end: start + quote.length, page: null, table: null, cell: null };
}

export function verifyEvidenceAnchor(abstract: string, anchor: EvidenceAnchor): boolean {
  if (anchor.origin !== "abstract" || anchor.verification !== "exact_excerpt") return false;
  if (!Number.isInteger(anchor.start) || !Number.isInteger(anchor.end)
    || anchor.start === null || anchor.end === null || anchor.start < 0 || anchor.end <= anchor.start) return false;
  const normalized = normalizeEvidenceText(abstract);
  return normalized.slice(anchor.start, anchor.end) === anchor.excerpt;
}

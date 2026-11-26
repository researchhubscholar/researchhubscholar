import type { DraftSource } from "../literature/manuscript-draft-sources";

export type DraftEvidenceNote = {
  label: string;
  relevance: 0 | 1 | 2 | 3;
  finding: string;
  kind: "abstract" | "fullTextExcerpt" | "none";
  quote: string;
};

const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");

/** Check that every selected publication was considered, including irrelevant
 * articles, and that each factual note has an exact source quotation. */
export function validateDraftEvidenceBatch(content: string, sources: DraftSource[]): DraftEvidenceNote[] {
  let data: unknown;
  try { data = JSON.parse(content); } catch {
    throw new Error("A análise do lote não devolveu uma ficha de evidências válida.");
  }
  if (!Array.isArray(data) || data.length !== sources.length) {
    throw new Error("A análise deve registrar cada artigo selecionado no lote.");
  }
  return data.map((item, i) => {
    const record = item as Record<string, unknown> | null;
    const source = sources[i];
    if (!record || record.label !== source.label || ![0, 1, 2, 3].includes(Number(record.relevance))
      || typeof record.finding !== "string" || record.finding.length > 480
      || typeof record.quote !== "string" || record.quote.length > 260
      || !["abstract", "fullTextExcerpt", "none"].includes(String(record.kind))) {
      throw new Error("Artigo " + (i + 1) + ": resposta inválida ou fora de ordem.");
    }
    const relevance = Number(record.relevance) as DraftEvidenceNote["relevance"];
    const finding = record.finding.trim();
    const quote = record.quote.trim();
    const kind = record.kind as DraftEvidenceNote["kind"];
    if (relevance === 0) {
      if (kind !== "none" || finding || quote) throw new Error("Fonte irrelevante não deve conter alegação científica.");
    } else {
      if (kind === "none" || finding.length < 25 || quote.length < 22
        || !normalize(kind === "abstract" ? source.abstract : source.fullTextExcerpt).includes(normalize(quote))) {
        throw new Error("Fonte " + source.label + ": a evidência literal não corresponde ao artigo.");
      }
    }
    return { label: source.label, relevance, finding, quote, kind };
  });
}

export type ConsolidatedDraftEvidence = {
  id: string;
  label: string;
  title: string;
  pmid: string | null;
  doi: string | null;
  evidenceLevel: DraftSource["evidenceLevel"];
  license: string | null;
  pmcid: string | null;
  relevance: 0 | 1 | 2 | 3;
  finding: string;
  kind: DraftEvidenceNote["kind"];
  quote: string;
};
/** All articles are reviewed in batches. The final introduction uses the
 * highest-relevance cited subset to keep the LLM prompt bounded and auditable. */
export function rankDraftEvidence(
  entries: ConsolidatedDraftEvidence[],
  limit = 24
): { considered: number; relevant: number; candidates: ConsolidatedDraftEvidence[] } {
  const unique = new Map<string, ConsolidatedDraftEvidence>();
  for (const entry of entries) {
    if (unique.has(entry.id)) throw new Error("O mesmo artigo aparece em lotes diferentes.");
    unique.set(entry.id, entry);
  }
  const all = [...unique.values()];
  const ranked = all.filter(item => item.relevance > 0 && item.quote)
    .sort((a, b) => b.relevance - a.relevance);
  return {
    considered: all.length,
    relevant: ranked.length,
    candidates: ranked.slice(0, limit).map((item, i) => ({ ...item, label: "S" + (i + 1) }))
  };
}

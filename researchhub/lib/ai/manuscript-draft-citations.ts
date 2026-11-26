/** Verify literal source anchors per in-text citation. This establishes traceability,
 * not the correctness of scientific interpretation, which remains human-reviewed. */
export type CitationSource = {
  label: string;
  abstract: string;
  fullTextExcerpt: string;
};
export type CitationAnchor = { id: string; kind: "abstract" | "fullTextExcerpt"; quote: string };
const normalized = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
export function verifyDraftCitationAnchors(
  content: string, manifest: string, sources: CitationSource[]
): CitationAnchor[] {
  const mentions = [...content.matchAll(/\[S(\d+)\]/g)].map(match => "S" + match[1]);
  if (!mentions.length || mentions.length > 20) {
    throw new Error("O rascunho precisa apresentar de uma a vinte citações rastreáveis.");
  }
  if (/\[\d+\]/.test(content)) {
    throw new Error("O rascunho misturou estilos de citações. Nenhuma alteração foi aplicada.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(manifest); } catch {
    throw new Error("A IA não apresentou a comprovação das citações.");
  }
  if (!parsed || typeof parsed !== "object" || !("anchors" in parsed)
    || !Array.isArray(parsed.anchors) || parsed.anchors.length !== mentions.length) {
    throw new Error("Cada citação precisa ter sua própria evidência de origem.");
  }
  const anchors: CitationAnchor[] = [];
  for (let i = 0; i < mentions.length; i++) {
    const item = parsed.anchors[i] as Record<string, unknown> | null;
    if (!item || item.id !== mentions[i] || !["abstract", "fullTextExcerpt"].includes(String(item.kind))
      || typeof item.quote !== "string" || item.quote.trim().length < 18 || item.quote.length > 240) {
      throw new Error("Citação " + (i + 1) + ": identificador ou trecho de apoio inválido.");
    }
    const source = sources.find(s => s.label === item.id);
    if (!source) throw new Error("Citação " + (i + 1) + ": artigo não selecionado.");
    const body = item.kind === "abstract" ? source.abstract : source.fullTextExcerpt;
    if (!body || !normalized(body).includes(normalized(item.quote))) {
      throw new Error("Citação " + (i + 1) + ": o trecho informado não consta da fonte declarada.");
    }
    anchors.push({ id: item.id, kind: item.kind as CitationAnchor["kind"], quote: item.quote.trim() });
  }
  return anchors;
}

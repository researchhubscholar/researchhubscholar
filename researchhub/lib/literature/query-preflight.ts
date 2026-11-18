/**
 * IA-01 — Conservative preflight for AI-generated PubMed Boolean suggestions.
 * Checks only structural errors; it never rewrites biomedical terms or invents descriptors.
 * Runs in addition to the existing quote/field/parenthesis balance validation.
 */
export function validateBooleanStructure(query: string): void {
  // Mask quoted phrases and PubMed field tags so literals such as "War AND Peace"
  // and [Title/Abstract] cannot be mistaken for Boolean syntax.
  const visible = query
    .replace(/"[^"]*"/g, "TERM")
    .replace(/\[[^\]]*\]/g, "");
  // PubMed's Boolean operators are uppercase. Lowercase natural-language terms
  // must not be rejected merely for containing "and", "or", or "not".
  const operator = "(?:AND|OR|NOT)";
  if (new RegExp(`^\\s*${operator}\\b`).test(visible)
      || new RegExp(`\\b${operator}\\s*$`).test(visible)
      || new RegExp(`\\b${operator}\\s+${operator}\\b`).test(visible)
      || new RegExp(`\\(\\s*${operator}\\b`).test(visible)
      || new RegExp(`\\b${operator}\\s*\\)`).test(visible)
      || /\(\s*\)/.test(visible)) {
    throw new Error("A consulta contém operadores booleanos incompletos ou grupos vazios. Revise a estratégia antes de aplicar.");
  }
}

/** Metadata for review and traceability; never claims official DeCS validation. */
export function queryPreflight(query: string) {
  validateBooleanStructure(query);
  return {
    query: query.trim(),
    validation: "boolean-structure" as const,
    terminology: "not-verified" as const,
    checkedAtRuntime: true as const,
  };
}

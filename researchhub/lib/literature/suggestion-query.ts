import { searchLimits } from "./search-limits";

export type SuggestionOperator = "AND" | "OR";

export function validateSuggestionQuery(query: string) {
  if (query.trim().length < 3 || query.length > searchLimits.query) throw new Error(`A busca deve ter entre 3 e ${searchLimits.query.toLocaleString("pt-BR")} caracteres.`);
  let quoted = false, parentheses = 0, field = false;
  for (const character of query) {
    if (character === '"' && !field) quoted = !quoted;
    if (quoted) continue;
    if (character === "[") { if (field) throw new Error("Revise os campos entre colchetes na prévia."); field = true; }
    else if (character === "]") { if (!field) throw new Error("Revise os campos entre colchetes na prévia."); field = false; }
    else if (!field && character === "(") parentheses++;
    else if (!field && character === ")" && --parentheses < 0) throw new Error("Revise os parênteses na prévia.");
  }
  if (quoted || parentheses || field) throw new Error("Feche as aspas, os parênteses e os colchetes na prévia antes de aplicar.");
  return query.trim();
}

// Commas belong to descriptors such as Burnout, Occupational. Only top-level
// semicolons (or lines without Boolean operators) delimit alternative terms.
export function normalizeSuggestionQuery(content: string) {
  const query = content.trim().replace(/[“”]/g, '"');
  validateSuggestionQuery(query);
  const boolean = /\b(?:AND|OR|NOT)\b/i.test(query.replace(/"[^"]*"|\[[^\]]*\]/g, ""));
  let quoted = false, depth = 0, field = false, start = 0;
  const terms: string[] = [];
  for (let i = 0; i < query.length; i++) {
    const character = query[i];
    if (character === '"' && !field) quoted = !quoted;
    if (quoted) continue;
    if (character === "[") field = true;
    else if (character === "]") field = false;
    else if (!field && character === "(") depth++;
    else if (!field && character === ")") depth--;
    if (!field && !depth && (character === ";" || (!boolean && /[\r\n]/.test(character)))) { terms.push(query.slice(start, i)); start = i + 1; }
  }
  terms.push(query.slice(start));
  const normalized = terms.map(term => term.trim()).filter(Boolean).map(term => {
    const syntax = term.replace(/"[^"]*"/g, "");
    if (/\[[^\]]+\]|[()]/.test(syntax) || /\b(?:AND|OR|NOT)\b/i.test(syntax)) return term;
    return `${term.startsWith('"') && term.endsWith('"') ? term : `"${term}"`}[Title/Abstract]`;
  });
  const unique = Array.from(new Map(normalized.map(term => [term.toLowerCase(), term])).values());
  if (!unique.length) throw new Error("Selecione sugestões com termos de busca.");
  return unique.length === 1 ? unique[0] : `(${unique.join(" OR ")})`;
}

export function combineSuggestionQueries(contents: string[], operator: SuggestionOperator = "AND") {
  if (!contents.length) return "";
  if (operator !== "AND" && operator !== "OR") throw new Error("Escolha AND ou OR para combinar as sugestões.");
  const queries = contents.map(normalizeSuggestionQuery);
  const unique = Array.from(new Map(queries.map(query => [query.toLowerCase().replace(/\s+/g, " "), query])).values());
  return unique.length === 1 ? unique[0] : unique.map(query => `(${query})`).join(` ${operator} `);
}

/** AI idea queries use AND between concepts and OR only between synonyms.
 * Keep explicit grouping and exclusions intact; never use this for manual queries.
 */
export function ideaRadarQuery(value: string): string {
  const query = value.trim();
  const operators: { value: string; index: number; length: number }[] = [];
  for (const match of query.matchAll(/"(?:[^"]|"")*"|\[[^\]]*\]|\(|\)|\b(?:AND|OR|NOT)\b/gi)) {
    const token = match[0];
    if (token === "(" || token === ")" || token.toUpperCase() === "NOT") return query;
    if (/^(AND|OR)$/i.test(token)) operators.push({ value: token.toUpperCase(), index: match.index!, length: token.length });
  }
  if (!operators.some(operator => operator.value === "AND") || !operators.some(operator => operator.value === "OR")) return query;
  const groups: string[] = [];
  let alternatives: string[] = [];
  let start = 0;
  for (const operator of operators) {
    const term = query.slice(start, operator.index).trim();
    if (!term) return query;
    alternatives.push(term);
    if (operator.value === "AND") {
      groups.push(alternatives.length > 1 ? `(${alternatives.join(" OR ")})` : alternatives[0]);
      alternatives = [];
    }
    start = operator.index + operator.length;
  }
  const last = query.slice(start).trim();
  if (!last) return query;
  alternatives.push(last);
  groups.push(alternatives.length > 1 ? `(${alternatives.join(" OR ")})` : alternatives[0]);
  return groups.join(" AND ");
}

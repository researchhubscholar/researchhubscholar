// Shared limits for private searches, AI strategies, pagination and saved searches.
export const searchLimits = { query: 10000, derivedQuery: 20000, crossrefQuery: 10000, field: 500 } as const;
export function appliedPubmedStrategy(query: string) {
  const topic = query.trim();
  if (topic.length < 3 || topic.length > searchLimits.query) throw new Error(`A estratégia deve ter entre 3 e ${searchLimits.query.toLocaleString("pt-BR")} caracteres.`);
  return { topic, mesh: "", populationTerm: "", outcomeTerm: "", operator: "AND" as const, language: "en" as const };
}

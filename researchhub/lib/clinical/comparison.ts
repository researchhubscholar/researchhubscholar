import { collectionDataset, type ClinicalCollection } from "./collection";
import { profileRows } from "./summary";
import { analyze, analysisRows, type AnalysisResult, type AnalysisConfig } from "../results/inference";
export type GroupComparison = { fieldKey: string; groups: string[]; analysis?: AnalysisConfig };
export function validComparison(value: unknown, collection?: ClinicalCollection): value is GroupComparison {
  if (!value || typeof value !== "object" || !collection) return false;
  const c = value as GroupComparison, field = collection.fields.find(f => f.key === c.fieldKey && f.kind === "category");
  return !!field && Array.isArray(c.groups) && c.groups.length >= 2 && c.groups.length <= 4 && new Set(c.groups).size === c.groups.length && c.groups.every(g => typeof g === "string" && field.options.includes(g)) && (!c.analysis || (["welch", "chi2"].includes(c.analysis.kind) && c.analysis.y === field.label && c.analysis.x !== field.label && collection.fields.some(f => f.label === c.analysis!.x && f.kind === (c.analysis!.kind === "welch" ? "number" : "category")) && typeof c.analysis.independent === "boolean"));
}
export function comparisonData(collection: ClinicalCollection, config: GroupComparison) {
  if (!validComparison(config, collection)) throw new Error("Revise a variável e as categorias da comparação.");
  const field = collection.fields.find(f => f.key === config.fieldKey)!;
  const included = collection.records.filter(r => r.status === "included");
  const selected = included.filter(r => config.groups.includes(r.values[field.key] || ""));
  const missing = included.filter(r => !r.values[field.key]?.trim()).length;
  const subsets = config.groups.map(group => ({ group, collection: { ...collection, records: selected.filter(r => r.values[field.key] === group) } }));
  // Preserve the chosen order in Welch's signed difference, independently of entry order.
  const dataset = collectionDataset({ ...collection, records: subsets.flatMap(s => s.collection.records) });
  const profiles = subsets.map(s => profileRows({ ...s.collection, fields: collection.fields.filter(f => f.key !== field.key) }));
  const rows: (string | number)[][] = [["Variável / categoria", ...subsets.map(s => `${s.group} (N=${s.collection.records.length})`)], ["Participantes", ...subsets.map(s => s.collection.records.length)]];
  if (profiles[0]) for (let i = 1; i < profiles[0].length; i++) rows.push([profiles[0][i][0], ...profiles.map(p => `${p[i][1]}${p[i][2] !== "" ? ` · N válido ${p[i][2]}; ausentes ${p[i][3]}` : ""}`)]);
  const note = `Agrupamento: ${field.label}. ${selected.length} participantes nos grupos selecionados; ${missing} incluídos sem grupo informado; ${included.length - selected.length - missing} em outras categorias. Percentuais usam os valores informados de cada variável dentro de cada grupo. DP amostral. Ausências não são convertidas em zero. Comparação descritiva não demonstra causalidade.`;
  return { dataset, rows, note, selected: selected.length, missing, other: included.length - selected.length - missing };
}

export function comparisonNarrative(result: AnalysisResult): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
  const p = result.p < .0001 ? "< 0,0001" : `= ${fmt(result.p)}`;
  return `Entre os participantes dos grupos selecionados, a análise de ${result.columns[0]} por ${result.columns[1]} utilizou ${result.n} observações completas (${result.excluded} excluídas por ausência nessas variáveis). ${result.method}: ${result.effect} = ${fmt(result.estimate)}${result.ci ? ` (IC95% ${fmt(result.ci[0])} a ${fmt(result.ci[1])})` : "; IC não disponível"}; p ${p}. Resultado exploratório, sem ajuste por confundidores ou comparações múltiplas; não permite concluir causalidade. Revise o texto, os pressupostos e a relevância clínica antes de usar.`;
}
export function comparisonWorkbook(collection: ClinicalCollection, config: GroupComparison) {
  const view = comparisonData(collection, config);
  const sheets = [{ name: "Comparação", rows: [...view.rows, [view.note]] }];
  if (config.analysis) {
    try { const result = analyze(view.dataset, config.analysis); sheets.push({ name: "Análise da comparação", rows: [["Medida", "Valor"], ...analysisRows(result), ["Texto para revisão", comparisonNarrative(result)]] }); }
    catch (error) { sheets.push({ name: "Análise da comparação", rows: [["Análise não calculada", error instanceof Error ? error.message : "Revise os dados."]] }); }
  }
  return sheets;
}

import type { Locale } from "../i18n/locale";
import { statCopy, statText } from "../i18n/statistics-copy";
import { intlLocale } from "../i18n/format";
import { collectionDataset, type ClinicalCollection } from "./collection";
import { profileRows } from "./summary";
import { analyze, analysisRows, analysisEffect, type AnalysisResult, type AnalysisConfig } from "../results/inference";
export type GroupComparison = { fieldKey: string; groups: string[]; analysis?: AnalysisConfig };
export function validComparison(value: unknown, collection?: ClinicalCollection): value is GroupComparison {
  if (!value || typeof value !== "object" || !collection) return false;
  const c = value as GroupComparison, field = collection.fields.find(f => f.key === c.fieldKey && f.kind === "category");
  return !!field && Array.isArray(c.groups) && c.groups.length >= 2 && c.groups.length <= 4 && new Set(c.groups).size === c.groups.length && c.groups.every(g => typeof g === "string" && field.options.includes(g)) && (!c.analysis || (["welch", "chi2"].includes(c.analysis.kind) && c.analysis.y === field.label && c.analysis.x !== field.label && collection.fields.some(f => f.label === c.analysis!.x && f.kind === (c.analysis!.kind === "welch" ? "number" : "category")) && typeof c.analysis.independent === "boolean"));
}
export function comparisonData(collection: ClinicalCollection, config: GroupComparison, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  if (!validComparison(config, collection)) throw new Error(copy("Revise a variável e as categorias da comparação."));
  const field = collection.fields.find(f => f.key === config.fieldKey)!;
  const included = collection.records.filter(r => r.status === "included");
  const selected = included.filter(r => config.groups.includes(r.values[field.key] || ""));
  const missing = included.filter(r => !r.values[field.key]?.trim()).length;
  const subsets = config.groups.map(group => ({ group, collection: { ...collection, records: selected.filter(r => r.values[field.key] === group) } }));
  // Preserve the chosen order in Welch's signed difference, independently of entry order.
  const dataset = collectionDataset({ ...collection, records: subsets.flatMap(s => s.collection.records) });
  const profiles = subsets.map(s => profileRows({ ...s.collection, fields: collection.fields.filter(f => f.key !== field.key) },locale));
  const rows: (string | number)[][] = [[copy("Variável / categoria"), ...subsets.map(s => statText(locale,"{0} (N={1})",s.group,s.collection.records.length))], ["Participantes", ...subsets.map(s => s.collection.records.length)]];
  if (profiles[0]) for (let i = 1; i < profiles[0].length; i++) rows.push([profiles[0][i][0], ...profiles.map(p => `${p[i][1]}${p[i][2] !== "" ? statText(locale," · N válido {0}; ausentes {1}",p[i][2],p[i][3]) : ""}`)]);
  const note = statText(locale,"Agrupamento: {0}. {1} participantes nos grupos selecionados; {2} incluídos sem grupo informado; {3} em outras categorias. Percentuais usam os valores informados de cada variável dentro de cada grupo. DP amostral. Ausências não são convertidas em zero. Comparação descritiva não demonstra causalidade.",field.label,selected.length,missing,included.length - selected.length - missing);
  return { dataset, rows, note, selected: selected.length, missing, other: included.length - selected.length - missing };
}

export function comparisonNarrative(result: AnalysisResult, locale:Locale="pt-BR"): string {
const copy=(source:string)=>statCopy(locale,source);
  const fmt = (n: number) => n.toLocaleString(intlLocale(locale), { maximumSignificantDigits: 4 });
  const p = result.p < .0001 ? copy("< 0,0001") : `= ${fmt(result.p)}`;
  return statText(locale,"Entre os participantes dos grupos selecionados, a análise de {0} por {1} utilizou {2} observações completas ({3} excluídas por ausência nessas variáveis). {4}: {5} = {6}{7}; p {8}. Resultado exploratório, sem ajuste por confundidores ou comparações múltiplas; não permite concluir causalidade. Revise o texto, os pressupostos e a relevância clínica antes de usar.",result.columns[0],result.columns[1],result.n,result.excluded,copy(result.method),analysisEffect(result,locale),fmt(result.estimate),result.ci ? statText(locale," (IC95% {0} a {1})",fmt(result.ci[0]),fmt(result.ci[1])) : copy("; IC não disponível"),p);
}
export function comparisonWorkbook(collection: ClinicalCollection, config: GroupComparison, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  const view = comparisonData(collection,config,locale);
  const sheets = [{ name: copy("Comparação"), rows: [...view.rows, [view.note]] }];
  if (config.analysis) {
    try { const result = analyze(view.dataset, config.analysis); sheets.push({ name: copy("Análise da comparação"), rows: [["Medida", "Valor"], ...analysisRows(result,locale), [copy("Texto para revisão"), comparisonNarrative(result,locale)]] }); }
    catch (error) { sheets.push({ name: copy("Análise da comparação"), rows: [[copy("Análise não calculada"), error instanceof Error ? copy(error.message) : copy("Revise os dados.")]] }); }
  }
  return sheets;
}

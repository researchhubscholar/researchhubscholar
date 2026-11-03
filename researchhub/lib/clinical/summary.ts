import type { Locale } from "../i18n/locale";
import { statCopy, statText } from "../i18n/statistics-copy";
import { intlLocale } from "../i18n/format";
import { adjustedWorkbook, validAdjusted } from "./adjusted";
import { repeatedWorkbook } from "./repeated";
import { pairedWorkbook } from "./paired";
import { followupWorkbook } from "./followup";
import { comparisonWorkbook, validComparison } from "./comparison";
import { describe, type ResultsWorkspace } from "../results/data";
import { collectionDataset, type ClinicalCollection } from "./collection";
export function selectionCounts(collection: ClinicalCollection) {
  return { total: collection.records.length, included: collection.records.filter(r => r.status === "included").length, excluded: collection.records.filter(r => r.status === "excluded").length, pending: collection.records.filter(r => r.status === "pending").length };
}
export function profileRows(collection: ClinicalCollection, locale:Locale="pt-BR"): (string | number)[][] {
const copy=(source:string)=>statCopy(locale,source);
const format=(value:number|null)=>value===null?"—":value.toLocaleString(intlLocale(locale),{maximumFractionDigits:2});
  const dataset = collectionDataset(collection), stats = describe(dataset);
  const rows: (string | number)[][] = [[copy("Variável / categoria"), copy("Resumo"), copy("N válido"), "Ausentes"]];
  collection.fields.forEach((field, index) => {
    const stat = stats[index], label = field.label + (field.unit ? ` (${field.unit})` : "");
    if (field.kind === "number") rows.push([label, stat.n ? statText(locale,"Média {0}; DP {1}; mediana {2}; mínimo–máximo {3}–{4}",format(stat.mean),format(stat.sd),format(stat.median),format(stat.min),format(stat.max)) : copy("Sem dados"), stat.n, stat.missing]);
    else if (field.kind === "category") {
      rows.push([label, stat.n ? copy("n (% dos valores informados)") : copy("Sem dados"), stat.n, stat.missing]);
      for (const option of field.options) {
        const n = dataset.rows.filter(row => row[index] === option).length;
        rows.push([`  ${option}`, stat.n ? `${n} (${format(100 * n / stat.n)}%)` : "0 (—)", "", ""]);
      }
    } else rows.push([label, copy("Datas: contagem de registros informados"), stat.n, stat.missing]);
  });
  return rows;
}
export function syncCollection(workspace: ResultsWorkspace, collection: ClinicalCollection): ResultsWorkspace {
  const dataset = collectionDataset(collection), counts = selectionCounts(collection);
  const column = dataset.columns.includes(workspace.figure.column) ? workspace.figure.column : dataset.columns[0] || "";
  const kind = collection.fields.find(field => field.label === column)?.kind === "number" ? workspace.figure.kind : "bar";
  const sameData = JSON.stringify(dataset) === JSON.stringify(workspace.dataset);
  const sameParticipants = JSON.stringify(workspace.collection?.records.map(r => [r.code, r.status])) === JSON.stringify(collection.records.map(r => [r.code, r.status]));
  const selectedGroups = workspace.comparison ? { ...workspace.comparison, analysis: undefined } : undefined;
  const comparison = validComparison(selectedGroups, collection) ? { ...selectedGroups, analysis: sameData && JSON.stringify(workspace.collection?.fields) === JSON.stringify(collection.fields) && validComparison(workspace.comparison, collection) ? workspace.comparison.analysis : undefined } : undefined;
  const adjusted = validAdjusted(workspace.adjusted, collection) ? { ...workspace.adjusted, confirmed: sameData && sameParticipants && JSON.stringify(workspace.collection?.fields) === JSON.stringify(collection.fields) ? workspace.adjusted.confirmed : false } : undefined;
  return { ...workspace, collection, comparison, adjusted, repeated: workspace.repeated ? { ...workspace.repeated, confirmed: sameData && sameParticipants ? workspace.repeated.confirmed : false } : undefined, paired: workspace.paired ? { ...workspace.paired, confirmed: sameData && sameParticipants ? workspace.paired.confirmed : false } : undefined, dataset, analysis: sameData ? workspace.analysis : undefined,
    figure: { ...workspace.figure, column, kind },
    flow: [{ label: "Prontuários registrados", count: counts.total }, { label: "Pendentes de conferência", count: counts.pending }, { label: "Excluídos", count: counts.excluded }, { label: "Incluídos na análise", count: counts.included }] };
}
export function collectionWorkbook(collection: ClinicalCollection, comparison?: ResultsWorkspace["comparison"], followup?: ResultsWorkspace["followup"], paired?: ResultsWorkspace["paired"], repeated?: ResultsWorkspace["repeated"], adjusted?: ResultsWorkspace["adjusted"], locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  return [
    { name: copy("Ficha"), rows: [[copy("Variável"), "Tipo", copy("Definição"), copy("Unidade"), copy("Categorias"), copy("Obrigatória"), copy("Mínimo"), copy("Máximo")], ...collection.fields.map(f => [f.label, f.kind, f.definition, f.unit, f.options.join(" | "), f.required ? copy("Sim") : copy("Não"), f.minimum ?? "", f.maximum ?? ""])] },
    { name: copy("Coleta"), rows: [["codigo_pesquisa", "situacao", "motivo_exclusao", ...collection.fields.map(f => f.label)], ...collection.records.map(r => [r.code, r.status, r.reason, ...collection.fields.map(f => r.values[f.key] || "")])] },
    { name: copy("Tabela 1"), rows: profileRows(collection,locale) },
    ...(comparison && validComparison(comparison, collection) ? comparisonWorkbook(collection,comparison,locale) : []),
    ...(followup ? followupWorkbook(followup,collection,locale) : []),
    ...(followup && paired ? pairedWorkbook(collection,followup,paired,locale) : []),
    ...(followup && repeated ? repeatedWorkbook(collection,followup,repeated,locale) : []),
    ...(adjusted ? adjustedWorkbook(collection,adjusted,locale) : []),
    { name: copy("Histórico recente"), rows: [[copy("Data"), copy("Ação"), copy("Código de pesquisa")], ...collection.history.map(h => [h.at, h.action, h.code])] },
  ];
}

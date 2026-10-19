import { repeatedWorkbook } from "./repeated";
import { pairedWorkbook } from "./paired";
import { followupWorkbook } from "./followup";
import { comparisonWorkbook, validComparison } from "./comparison";
import { describe, type ResultsWorkspace } from "../results/data";
import { collectionDataset, type ClinicalCollection } from "./collection";
const format = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export function selectionCounts(collection: ClinicalCollection) {
  return { total: collection.records.length, included: collection.records.filter(r => r.status === "included").length, excluded: collection.records.filter(r => r.status === "excluded").length, pending: collection.records.filter(r => r.status === "pending").length };
}
export function profileRows(collection: ClinicalCollection): (string | number)[][] {
  const dataset = collectionDataset(collection), stats = describe(dataset);
  const rows: (string | number)[][] = [["Variável / categoria", "Resumo", "N válido", "Ausentes"]];
  collection.fields.forEach((field, index) => {
    const stat = stats[index], label = field.label + (field.unit ? ` (${field.unit})` : "");
    if (field.kind === "number") rows.push([label, stat.n ? `Média ${format(stat.mean)}; DP ${format(stat.sd)}; mediana ${format(stat.median)}; mínimo–máximo ${format(stat.min)}–${format(stat.max)}` : "Sem dados", stat.n, stat.missing]);
    else if (field.kind === "category") {
      rows.push([label, stat.n ? "n (% dos valores informados)" : "Sem dados", stat.n, stat.missing]);
      for (const option of field.options) {
        const n = dataset.rows.filter(row => row[index] === option).length;
        rows.push([`  ${option}`, stat.n ? `${n} (${format(100 * n / stat.n)}%)` : "0 (—)", "", ""]);
      }
    } else rows.push([label, "Datas: contagem de registros informados", stat.n, stat.missing]);
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
  return { ...workspace, collection, comparison, repeated: workspace.repeated ? { ...workspace.repeated, confirmed: sameData && sameParticipants ? workspace.repeated.confirmed : false } : undefined, paired: workspace.paired ? { ...workspace.paired, confirmed: sameData && sameParticipants ? workspace.paired.confirmed : false } : undefined, dataset, analysis: sameData ? workspace.analysis : undefined,
    figure: { ...workspace.figure, column, kind },
    flow: [{ label: "Prontuários registrados", count: counts.total }, { label: "Pendentes de conferência", count: counts.pending }, { label: "Excluídos", count: counts.excluded }, { label: "Incluídos na análise", count: counts.included }] };
}
export function collectionWorkbook(collection: ClinicalCollection, comparison?: ResultsWorkspace["comparison"], followup?: ResultsWorkspace["followup"], paired?: ResultsWorkspace["paired"], repeated?: ResultsWorkspace["repeated"]) {
  return [
    { name: "Ficha", rows: [["Variável", "Tipo", "Definição", "Unidade", "Categorias", "Obrigatória", "Mínimo", "Máximo"], ...collection.fields.map(f => [f.label, f.kind, f.definition, f.unit, f.options.join(" | "), f.required ? "Sim" : "Não", f.minimum ?? "", f.maximum ?? ""])] },
    { name: "Coleta", rows: [["codigo_pesquisa", "situacao", "motivo_exclusao", ...collection.fields.map(f => f.label)], ...collection.records.map(r => [r.code, r.status, r.reason, ...collection.fields.map(f => r.values[f.key] || "")])] },
    { name: "Tabela 1", rows: profileRows(collection) },
    ...(comparison && validComparison(comparison, collection) ? comparisonWorkbook(collection, comparison) : []),
    ...(followup ? followupWorkbook(followup, collection) : []),
    ...(followup && paired ? pairedWorkbook(collection, followup, paired) : []),
    ...(followup && repeated ? repeatedWorkbook(collection, followup, repeated) : []),
    { name: "Histórico recente", rows: [["Data", "Ação", "Código de pesquisa"], ...collection.history.map(h => [h.at, h.action, h.code])] },
  ];
}

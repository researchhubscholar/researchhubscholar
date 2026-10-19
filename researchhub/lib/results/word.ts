import { assertAnalysisKinds } from "../clinical/collection";
import { profileRows, selectionCounts } from "../clinical/summary";
import { describe, type ResultsWorkspace } from "./data";
import { analyze, analysisRows } from "./inference";
import type { WordBlock } from "../exports/ooxml";

export type ExportFigure = { bytes: Uint8Array; width: number; height: number };
const format = (value: unknown) => typeof value === "number"
  ? value.toLocaleString("pt-BR", { maximumSignificantDigits: 6 }) : value;

export function resultsWordBlocks(workspace: ResultsWorkspace, figure?: ExportFigure | null): WordBlock[] {
  const blocks: WordBlock[] = [];
  const stats = describe(workspace.dataset);
  if (workspace.collection) {
    const collection = workspace.collection, counts = selectionCounts(collection);
    blocks.push({ text: "Estudo com dados próprios · coleta e seleção", heading: true },
      { text: `Unidade de observação: um participante por código. População: ${collection.population || "A definir"}. Período: ${collection.period || "A definir"}.` },
      { text: `Inclusão: ${collection.inclusion || "A definir"}. Exclusão: ${collection.exclusion || "A definir"}.` },
      { text: `${counts.total} registros; ${counts.included} incluídos; ${counts.excluded} excluídos; ${counts.pending} pendentes. Somente os incluídos compõem a tabela e as análises.` });
    if (counts.included) blocks.push({ text: "Tabela 1  Perfil dos participantes incluídos", heading: true }, { table: profileRows(collection) },
      { text: "Percentuais calculados sobre os valores informados de cada variável. Ausências são apresentadas separadamente. DP amostral; não se aplica a um único valor. Dados descritivos não demonstram causalidade." });
  }
  if (stats.length && !workspace.collection) {
    blocks.push({ text: "Tabela 1  Caracterização dos dados", heading: true }, { table: [
      ["Variável", "Tipo", "N válido", "Ausentes", "Categorias"],
      ...stats.map(s => [s.column, s.type, s.n, s.missing, s.unique]),
    ] });
    const numeric = stats.filter(s => s.type === "Numérica");
    if (numeric.length) blocks.push({ text: "Tabela 2  Resumo das variáveis numéricas", heading: true }, { table: [
      ["Variável", "Média", "Mediana", "DP amostral", "Mínimo", "Máximo"],
      ...numeric.map(s => [s.column, s.mean, s.median, s.sd ?? "—", s.min, s.max].map(format)),
    ] });
    blocks.push({ text: "Dados salvos pelo pesquisador. Células vazias foram excluídas dos cálculos; DP representa o desvio-padrão amostral." });
  }
  if (figure) blocks.push({ image: figure.bytes, width: 560, height: figure.height / figure.width * 560,
    caption: `Figura 1. ${workspace.figure.caption || workspace.figure.title || workspace.figure.column}. Fonte: dados salvos pelo pesquisador.` });
  if (workspace.analysis) {
    try {
      assertAnalysisKinds(workspace.collection ? Object.fromEntries(workspace.collection.fields.map(field => [field.label, field.kind])) : undefined, workspace.analysis);
      const result = analyze(workspace.dataset, workspace.analysis);
      blocks.push({ text: "Análise estatística", heading: true }, { table: [["Medida", "Valor"], ...analysisRows(result).map(row => row.map(format))] });
      if (result.table) blocks.push({ text: workspace.analysis.kind === "chi2" ? "Tabela de contingência" : "Resumo por grupo", heading: true }, { table: result.table.map(row => row.map(format)) });
      blocks.push({ text: "Análise exploratória sem correção para comparações múltiplas. O valor de p não mede importância clínica. Revise os pressupostos e a interpretação com o orientador." });
    } catch (error) {
      blocks.push({ text: `Análise estatística não incluída: ${error instanceof Error ? error.message : "confira os dados e os pressupostos."}` });
    }
  }
  if (workspace.notes.trim()) blocks.push({ text: "Notas de interpretação", heading: true }, { text: workspace.notes });
  // Do not present the empty default stages as actual selection results.
  if (workspace.flow.some(step => step.count > 0)) blocks.push({ text: "Fluxo de seleção", heading: true },
    { table: [["Etapa", "N"], ...workspace.flow.map(step => [step.label, step.count])] });
  return blocks;
}

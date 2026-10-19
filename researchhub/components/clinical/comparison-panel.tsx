"use client";
import { useMemo, useState } from "react";
import { comparisonData, comparisonNarrative, comparisonWorkbook, validComparison, type GroupComparison } from "@/lib/clinical/comparison";
import { analyze, analysisRows } from "@/lib/results/inference";
import type { ResultsWorkspace } from "@/lib/results/data";
import { downloadBinary, workbook, wordDocument } from "@/lib/exports/ooxml";
import { resultsWordBlocks } from "@/lib/results/word";
const control = "block w-full min-w-0 rounded-card border p-3 mt-2";
const fmt = (value: string | number) => typeof value === "number" ? value.toLocaleString("pt-BR", { maximumSignificantDigits: 6 }) : value;
export default function ComparisonPanel({ workspace, onChange }: { workspace: ResultsWorkspace; onChange: (value: ResultsWorkspace) => void }) {
  const collection = workspace.collection, config = workspace.comparison;
  const [message, setMessage] = useState("");
  const view = useMemo(() => {
    if (!collection || !config) return null;
    try { return comparisonData(collection, config); } catch { return null; }
  }, [collection, config]);
  const test = useMemo(() => {
    if (!view || !config?.analysis) return null;
    try { return { result: analyze(view.dataset, config.analysis), error: "" }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : "Revise os dados." }; }
  }, [view, config]);
  if (!collection) return null;
  const grouping = collection.fields.filter(f => f.kind === "category" && f.options.length >= 2);
  const field = collection.fields.find(f => f.key === config?.fieldKey);
  function update(next?: GroupComparison) { setMessage(""); onChange({ ...workspace, comparison: next }); }
  function selectGroups(groups: string[]) { if (config) update({ ...config, groups, analysis: undefined }); }
  function exportFile(kind: "word" | "excel") {
    try {
      if (!view || !config || !validComparison(config, collection)) return;
      if (kind === "word") downloadBinary(wordDocument([{ text: "Comparação entre grupos", style: "title" }, ...resultsWordBlocks({ ...workspace, analysis: undefined, notes: "", flow: [] })]), "comparacao-grupos.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      else downloadBinary(workbook(comparisonWorkbook(collection!, config)), "comparacao-grupos.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível exportar."); }
  }
  return <section id="comparacao" className="min-w-0 bg-white border rounded-2xl p-5 md:p-6 space-y-5">
    <div><p className="text-xs uppercase tracking-widest text-teal">Dados próprios · próxima análise</p><h2 className="font-display text-2xl mt-2">Comparar grupos de participantes</h2><p className="text-sm text-ink-soft mt-3">Escolha uma variável da ficha e de duas a quatro categorias. A tabela usa somente participantes incluídos e mostra valores informados e ausentes por grupo. Salve os resultados para levar esta comparação ao manuscrito.</p></div>
    {!grouping.length ? <p role="status" className="text-sm">Defina na ficha uma variável categórica com pelo menos duas opções para comparar grupos.</p> : <label className="block text-sm">Variável que define os grupos<select className={control} value={config?.fieldKey || ""} onChange={e => { const f = grouping.find(f => f.key === e.target.value); update(f ? { fieldKey: f.key, groups: f.options.slice(0, 2) } : undefined); }}><option value="">Selecione</option>{grouping.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>}
    {field && config && <fieldset className="min-w-0"><legend className="text-sm font-medium">Categorias da comparação · mínimo 2, máximo 4</legend><div className="flex flex-wrap gap-4 mt-3">{field.options.map(option => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.groups.includes(option)} disabled={config.groups.includes(option) ? config.groups.length <= 2 : config.groups.length >= 4} onChange={e => selectGroups(e.target.checked ? [...config.groups, option] : config.groups.filter(g => g !== option))}/>{option}</label>)}</div><p className="text-xs text-ink-soft mt-3">A ordem de seleção define a apresentação dos grupos e o sentido da diferença de médias. Para trocar uma das duas categorias, adicione a nova antes de remover a anterior.</p></fieldset>}
    {view && config && <>
      <p className="rounded-card bg-teal-soft p-4 text-sm">{view.note}</p>
      {!view.selected ? <p role="status" className="text-sm">Ainda não há participantes incluídos nos grupos selecionados. Confira a coleta.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-medium mb-3">Perfil por grupo · média, DP, mediana, mínimo–máximo ou n (%)</caption><thead><tr>{view.rows[0].map((cell, j) => <th scope="col" key={j} className="border p-3 text-left">{cell}</th>)}</tr></thead><tbody>{view.rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th scope="row" key={j} className="border p-3 text-left font-normal">{cell}</th> : <td key={j} className="border p-3 min-w-48">{cell}</td>)}</tr>)}</tbody></table></div>}
      <div className="rounded-card border p-4 space-y-4"><h3 className="font-medium">Investigar uma diferença ou associação</h3><p className="text-sm text-ink-soft">Selecione uma variável por vez. Numérica: teste de Welch entre exatamente dois grupos. Categórica: qui-quadrado, sujeito às frequências esperadas. Datas não são testadas. Não há cálculo automático de p para todas as linhas da tabela.</p><label className="block text-sm">Variável a investigar<select className={control} value={config.analysis?.x || ""} onChange={e => { const outcome = collection.fields.find(f => f.label === e.target.value); update({ ...config, analysis: outcome && field ? { kind: outcome.kind === "number" ? "welch" : "chi2", x: outcome.label, y: field.label, independent: false } : undefined }); }}><option value="">Selecione</option>{collection.fields.filter(f => f.key !== field?.key && f.kind !== "date").map(f => <option key={f.key} value={f.label}>{f.label} · {f.kind === "number" ? "numérica" : "categórica"}</option>)}</select></label>
      {config.analysis && <><p className="text-sm text-ink-soft">{config.analysis.kind === "welch" ? "Welch: revise assimetria, valores extremos e normalidade aproximada, especialmente em amostras pequenas. O cálculo exige dois grupos com pelo menos três valores válidos cada." : "Qui-quadrado: exige pelo menos duas categorias observadas por variável e frequência esperada de pelo menos 5 em cada célula. Amostras esparsas bloqueiam o cálculo."} As observações devem ser independentes. Esta etapa não analisa antes/depois, medidas repetidas ou ajustes por confundidores.</p><label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={config.analysis.independent} onChange={e => update({ ...config, analysis: { ...config.analysis!, independent: e.target.checked } })}/><span>Revisei os pressupostos e confirmo que as observações são independentes.</span></label></>}
      {test?.error && <p role="status" className="text-sm bg-paper rounded-card p-3">{test.error}</p>}
      {test?.result && <><div className="overflow-x-auto"><table className="text-sm w-full"><caption className="text-left font-medium mb-2">{test.result.method}</caption><tbody>{analysisRows(test.result).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border p-2">{fmt(cell)}</td>)}</tr>)}</tbody></table></div><div className="bg-paper rounded-card p-4 text-sm"><h4 className="font-medium">Texto sugerido para revisão</h4><p className="mt-2">{comparisonNarrative(test.result)}</p></div><p className="text-sm text-ink-soft">Resultado exploratório sem correção para comparações múltiplas. Valor de p não mede importância clínica. Revise o resultado e sua interpretação antes de usá-los no manuscrito.</p></>}
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={!view.selected} className="border rounded-card p-3 disabled:opacity-40" onClick={() => exportFile("excel")}>Comparação em Excel</button><button type="button" disabled={!view.selected} className="border rounded-card p-3 disabled:opacity-40" onClick={() => exportFile("word")}>Comparação em Word</button><button type="button" className="text-teal underline p-3" onClick={() => update(undefined)}>Remover comparação</button></div>
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}

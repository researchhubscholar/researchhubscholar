"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import { ResultReading, ReviewGuide } from "@/components/results/result-reading";
import { generalReading } from "@/lib/results/reading";
import { useMemo, useState } from "react";
import { comparisonData, comparisonNarrative, comparisonWorkbook, validComparison, type GroupComparison } from "@/lib/clinical/comparison";
import { analyze, analysisRows } from "@/lib/results/inference";
import type { ResultsWorkspace } from "@/lib/results/data";
import { downloadBinary, workbook, wordDocument } from "@/lib/exports/ooxml";
import { resultsWordBlocks } from "@/lib/results/word";
const control = "block w-full min-w-0 rounded-card border p-3 mt-2";
const fmt = (value: string | number) => typeof value === "number" ? value.toLocaleString("pt-BR", { maximumSignificantDigits: 6 }) : value;
export default function ComparisonPanel({ workspace, onChange }: { workspace: ResultsWorkspace; onChange: (value: ResultsWorkspace) => void }) {
  const { t: uiText } = useLanguage();
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
    <div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.69ff525fdac2" /></p><h2 className="font-display text-2xl mt-2">Comparar grupos de participantes</h2><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.2ef1678e43b2" /></p></div>
    {!grouping.length ? <p role="status" className="text-sm"><InterfaceText message="screen.781cb09fa6e7" /></p> : <label className="block text-sm"><InterfaceText message="screen.74eb6387db61" /><select className={control} value={config?.fieldKey || ""} onChange={e => { const f = grouping.find(f => f.key === e.target.value); update(f ? { fieldKey: f.key, groups: f.options.slice(0, 2) } : undefined); }}><option value=""><InterfaceText message="screen.987d5be9f4bf" /></option>{grouping.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>}
    {field && config && <fieldset className="min-w-0"><legend className="text-sm font-medium"><InterfaceText message="screen.babe7274aafe" /></legend><div className="flex flex-wrap gap-4 mt-3">{field.options.map(option => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.groups.includes(option)} disabled={config.groups.includes(option) ? config.groups.length <= 2 : config.groups.length >= 4} onChange={e => selectGroups(e.target.checked ? [...config.groups, option] : config.groups.filter(g => g !== option))}/>{option}</label>)}</div><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.33f8c0f9c25a" /></p></fieldset>}
    {view && config && <>
      <p className="rounded-card bg-teal-soft p-4 text-sm"><AuthoredText text={view.note} /></p>
      {!view.selected ? <p role="status" className="text-sm"><InterfaceText message="screen.c5b30b43f951" /></p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-medium mb-3"><InterfaceText message="screen.a049443193b8" /></caption><thead><tr>{view.rows[0].map((cell, j) => <th scope="col" key={j} className="border p-3 text-left">{cell}</th>)}</tr></thead><tbody>{view.rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th scope="row" key={j} className="border p-3 text-left font-normal">{cell}</th> : <td key={j} className="border p-3 min-w-48">{cell}</td>)}</tr>)}</tbody></table></div>}
      <div className="rounded-card border p-4 space-y-4"><h3 className="font-medium"><InterfaceText message="screen.bcefd8bed229" /></h3><p className="text-sm text-ink-soft"><InterfaceText message="screen.db07d3ad8b8d" /></p><label className="block text-sm"><InterfaceText message="screen.f8ade4691f6c" /><select className={control} value={config.analysis?.x || ""} onChange={e => { const outcome = collection.fields.find(f => f.label === e.target.value); update({ ...config, analysis: outcome && field ? { kind: outcome.kind === "number" ? "welch" : "chi2", x: outcome.label, y: field.label, independent: false } : undefined }); }}><option value=""><InterfaceText message="screen.987d5be9f4bf" /></option>{collection.fields.filter(f => f.key !== field?.key && f.kind !== "date").map(f => <option key={f.key} value={f.label}>{f.label} · {f.kind === "number" ? "numérica" : "categórica"}</option>)}</select></label>
      {config.analysis && <><p className="text-sm text-ink-soft">{config.analysis.kind === "welch" ? uiText("screen.e1676cf6f563") : uiText("screen.3a35e3ff5451")} <InterfaceText message="screen.1f45edc43940" /></p><ReviewGuide kind={config.analysis.kind} /><label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={config.analysis.independent} onChange={e => update({ ...config, analysis: { ...config.analysis!, independent: e.target.checked } })}/><span><InterfaceText message="screen.2d9defbd9e19" /></span></label></>}
      {test?.error && <p role="status" className="text-sm bg-paper rounded-card p-3"><AuthoredText text={test.error} /></p>}
      {test?.result && <><ResultReading reading={generalReading(test.result,config.analysis!.kind)}/><details className="border rounded-card p-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.05725214a4b6" /></summary><div className="overflow-x-auto"><table className="text-sm w-full"><caption className="text-left font-medium mb-2">{test.result.method}</caption><tbody>{analysisRows(test.result).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border p-2">{fmt(cell)}</td>)}</tr>)}</tbody></table></div></details><div className="bg-paper rounded-card p-4 text-sm"><h4 className="font-medium"><InterfaceText message="screen.42f197f5c1ee" /></h4><p className="mt-2">{comparisonNarrative(test.result)}</p></div><p className="text-sm text-ink-soft"><InterfaceText message="screen.d42eb87b47ff" /></p></>}
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={!view.selected} className="border rounded-card p-3 disabled:opacity-40" onClick={() => exportFile("excel")}><InterfaceText message="screen.5900b587dbb7" /></button><button type="button" disabled={!view.selected} className="border rounded-card p-3 disabled:opacity-40" onClick={() => exportFile("word")}><InterfaceText message="screen.50fe9e521b9e" /></button><button type="button" className="text-teal underline p-3" onClick={() => update(undefined)}><InterfaceText message="screen.0828e748e812" /></button></div>
    </>}
    {message && <p role="status" className="text-sm"><AuthoredText text={message} /></p>}
  </section>;
}

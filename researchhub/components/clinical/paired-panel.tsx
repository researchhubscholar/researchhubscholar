"use client";
import { statCopy } from "@/lib/i18n/statistics-copy";
import { intlLocale } from "@/lib/i18n/format";
import { useLanguage } from "@/components/i18n/language-provider";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";
import { ResultReading, ReviewGuide } from "@/components/results/result-reading";
import { pairedReading } from "@/lib/results/reading";
import { useMemo, useState } from "react";
import { pairedData, pairedNote, pairedNarrative, pairedResultRows, pairedTest, pairedWorkbook, validPaired, type PairedConfig } from "@/lib/clinical/paired";
import { downloadBinary, workbook, wordDocument } from "@/lib/exports/ooxml";
import { resultsWordBlocks } from "@/lib/results/word";
import type { ResultsWorkspace } from "@/lib/results/data";
const control = "block w-full min-w-0 border rounded-card p-3 mt-2";
const button = "rounded-card border p-3 text-sm text-teal disabled:opacity-40";
function Table({ rows, caption }: { rows: (string | number)[][]; caption: string }) { const {locale:formatLocale}=useLanguage(); const fmt = (v: string | number) => typeof v === "number" ? v.toLocaleString(intlLocale(formatLocale), { maximumSignificantDigits: 6 }) : v;
return <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-medium mb-2">{caption}</caption><thead><tr>{rows[0].map((v,i)=><th scope="col" className="border p-2 text-left" key={i}>{v}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,i)=><tr key={i}>{r.map((v,j)=>j===0?<th scope="row" className="border p-2 text-left font-normal" key={j}>{fmt(v)}</th>:<td className="border p-2" key={j}>{fmt(v)}</td>)}</tr>)}</tbody></table></div>; }
export default function PairedPanel({ workspace, projectId, onChange }: { workspace: ResultsWorkspace; projectId: string; onChange: (next: ResultsWorkspace) => void }) {
 const {locale:resultsLocale}=useLanguage();

  const { t: uiText } = useLanguage();
  const plan = workspace.followup, config = workspace.paired, collection = workspace.collection;
  const [draft, setDraft] = useState<PairedConfig>(() => config || { fieldKey: "", before: "", after: "", confirmed: false });
  const [message, setMessage] = useState(""), [page, setPage] = useState(0);
  const data = useMemo(() => {
    if (!collection || !plan || !config) return { value: null, error: "" };
    try { return { value: pairedData(collection, plan, config, resultsLocale), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "Revise a seleção." }; }
  }, [collection, plan, config, resultsLocale]);
  const test = useMemo(() => {
    if (!data.value || !config) return { value: null, error: "" };
    try { return { value: pairedTest(data.value, config), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "Revise os dados." }; }
  }, [data, config]);
  if (!plan || !collection) return null;
  function commit(next?: PairedConfig) {
    if (next && !validPaired(next, plan)) { setMessage("Escolha uma medida numérica e dois momentos; o momento posterior precisa ter dia previsto maior que o inicial."); return; }
    const updated = { ...workspace, paired: next };
    if (new TextEncoder().encode(JSON.stringify({ project: projectId, workspace: updated })).byteLength > 1_500_000) { setMessage("Esta alteração excederia 1,5 MB. Exporte uma cópia e reduza a base antes de salvar."); return; }
    onChange(updated); setPage(0); setMessage("Seleção atualizada. Use Salvar resultados para gravar na conta.");
  }
  function exportFile(kind: "word" | "excel") {
    if (!config || !plan || !collection) return;
    try {
      if (kind === "excel") downloadBinary(workbook(pairedWorkbook(collection, plan, config, resultsLocale)), "comparacao-antes-depois.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      else downloadBinary(wordDocument([{ text: statCopy(resultsLocale,"Comparação antes e depois"), style: "title" }, ...resultsWordBlocks({ ...workspace, analysis: undefined, comparison: undefined, notes: "", flow: [] }, undefined, resultsLocale)], resultsLocale), "comparacao-antes-depois.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível exportar."); }
  }
  const numeric = plan.fields.filter(f=>f.kind==='number'), currentPage = data.value ? Math.min(page,Math.max(0,Math.ceil(data.value.pairs.length/20)-1)) : 0;
  return <section id="antes-depois" aria-labelledby="paired-title" className="min-w-0 bg-white border rounded-2xl p-5 md:p-6 space-y-5">
    <div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.bd8e1908e141" /></p><h2 id="paired-title" className="font-display text-2xl mt-2"><InterfaceText message="screen.3533a02b9a70" /></h2><p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.b5c39e72a81c" /></p></div>
    {!numeric.length || plan.moments.length<2 ? <p role="status" className="text-sm"><InterfaceText message="screen.16a8b2b31404" /></p> : <><div className="grid md:grid-cols-3 gap-4"><label className="text-sm"><InterfaceText message="screen.ef1a3533ee45" /><select className={control} value={numeric.some(f=>f.key===draft.fieldKey)?draft.fieldKey:''} onChange={e=>setDraft({...draft,fieldKey:e.target.value,confirmed:false})}><option value=""><InterfaceText message="screen.987d5be9f4bf" /></option>{numeric.map(f=><option key={f.key} value={f.key}>{f.label}{f.unit?` (${f.unit})`:''}</option>)}</select></label>{([['before','Momento inicial · antes'],['after','Momento posterior · depois']] as const).map(([key,label])=><label key={key} className="text-sm">{label}<select className={control} value={plan.moments.some(m=>m.key===draft[key])?draft[key]:''} onChange={e=>setDraft({...draft,[key]:e.target.value,confirmed:false})}><option value=""><InterfaceText message="screen.987d5be9f4bf" /></option>{plan.moments.map(m=><option key={m.key} value={m.key}>{m.label} <InterfaceText message="screen.482b5c034f72" /> {m.day}</option>)}</select></label>)}</div><button type="button" className={button} onClick={()=>commit({...draft,confirmed:false})}><InterfaceText message="screen.7df282d9402c" /></button><p className="text-xs text-ink-soft"><InterfaceText message="screen.9214fe1e6066" /></p></>}
    {data.error&&<p role="status" className="text-sm"><AuthoredText text={data.error} /></p>}
    {data.value&&config&&<><p className="rounded-card bg-teal-soft p-4 text-sm"><strong>{data.value.field.label}{data.value.field.unit?` (${data.value.field.unit})`:''}: {data.value.before.label} → {data.value.after.label}.</strong> {data.value.counts.complete} pares completos de {data.value.counts.included} <InterfaceText message="screen.8239cd68ad79" /> {data.value.counts.included-data.value.counts.complete} <InterfaceText message="screen.5d1cdf36d0c1" /></p>
      <details className="border rounded-card p-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.6dff3b4d713e" /></summary><div className="mt-3 space-y-3"><Table rows={data.value.selection} caption={uiText("screen.3d57d2b2a9e9")}/></div></details><Table rows={data.value.rows} caption={uiText("screen.79de527243ec")}/>
      {data.value.counts.chronology>0&&<p role="alert" className="text-sm border rounded-card p-3"><InterfaceText message="screen.cd6b416615e7" /> {data.value.counts.chronology} <InterfaceText message="screen.96f86fd004dd" /></p>}
      <details className="rounded-card border p-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.fd3be976d834" /></summary><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.4625eac17ae5" /></p><div className="mt-3"><Table caption={uiText("screen.fcd546eee0bc")} rows={[["Código de pesquisa","Antes","Depois","Depois − antes"],...data.value.pairs.slice(currentPage*20,currentPage*20+20).map(p=>[p.code,p.before,p.after,p.difference])]}/></div><div className="flex flex-wrap gap-3 items-center mt-3 text-sm"><button type="button" className={button} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Pares anteriores</button><span>Página {currentPage+1} de {Math.max(1,Math.ceil(data.value.pairs.length/20))}</span><button type="button" className={button} disabled={(currentPage+1)*20>=data.value.pairs.length} onClick={()=>setPage(currentPage+1)}><InterfaceText message="screen.7aabded26d29" /></button></div></details>
      <div className="border rounded-card p-4 space-y-4"><h3 className="font-medium"><InterfaceText message="screen.80837524b59d" /></h3><details><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.ac4ce58d70b7" /></summary><p className="text-sm text-ink-soft"><InterfaceText message="screen.6a307f3ed646" /></p></details><ReviewGuide kind="paired" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={config.confirmed} onChange={e=>commit({...config,confirmed:e.target.checked})}/><span><InterfaceText message="screen.839781a01610" /></span></label>
      {test.error&&<p role="status" className="text-sm bg-paper rounded-card p-3"><AuthoredText text={test.error} /></p>}{test.value&&<><ResultReading reading={pairedReading(data.value,test.value, resultsLocale)}/><details className="border rounded-card p-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.854dc519755e" /></summary><Table rows={pairedResultRows(test.value, resultsLocale)} caption={uiText("screen.018b3769c8d6")}/></details><div className="bg-paper rounded-card p-4 text-sm"><h4 className="font-medium"><InterfaceText message="screen.42f197f5c1ee" /></h4><p className="mt-2">{pairedNarrative(data.value,test.value, resultsLocale)}</p></div></>}</div>
      <details className="border rounded-card p-3"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.66b3d7d8e8b2" /></summary><p className="text-xs text-ink-soft"><AuthoredText text={pairedNote} /></p></details><div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={()=>exportFile('excel')}><InterfaceText message="screen.694dcd34ba42" /></button><button type="button" className={button} onClick={()=>exportFile('word')}><InterfaceText message="screen.5f29cfe640cc" /></button><button type="button" className={button} onClick={()=>commit(undefined)}><InterfaceText message="screen.faf18abdced9" /></button></div><p className="text-xs text-ink-soft"><InterfaceText message="screen.ca7d80cfdbd0" /></p>
    </>}{message&&<p role="status" className="text-sm border rounded-card p-3"><AuthoredText text={message} /></p>}
  </section>;
}

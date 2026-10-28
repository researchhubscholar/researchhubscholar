"use client";
import { ResultReading, ReviewGuide } from "@/components/results/result-reading";
import { pairedReading } from "@/lib/results/reading";
import { useMemo, useState } from "react";
import { pairedData, pairedNote, pairedNarrative, pairedResultRows, pairedTest, pairedWorkbook, validPaired, type PairedConfig } from "@/lib/clinical/paired";
import { downloadBinary, workbook, wordDocument } from "@/lib/exports/ooxml";
import { resultsWordBlocks } from "@/lib/results/word";
import type { ResultsWorkspace } from "@/lib/results/data";
const control = "block w-full min-w-0 border rounded-card p-3 mt-2";
const button = "rounded-card border p-3 text-sm text-teal disabled:opacity-40";
const fmt = (v: string | number) => typeof v === "number" ? v.toLocaleString("pt-BR", { maximumSignificantDigits: 6 }) : v;
function Table({ rows, caption }: { rows: (string | number)[][]; caption: string }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-medium mb-2">{caption}</caption><thead><tr>{rows[0].map((v,i)=><th scope="col" className="border p-2 text-left" key={i}>{v}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,i)=><tr key={i}>{r.map((v,j)=>j===0?<th scope="row" className="border p-2 text-left font-normal" key={j}>{fmt(v)}</th>:<td className="border p-2" key={j}>{fmt(v)}</td>)}</tr>)}</tbody></table></div>; }
export default function PairedPanel({ workspace, projectId, onChange }: { workspace: ResultsWorkspace; projectId: string; onChange: (next: ResultsWorkspace) => void }) {
  const plan = workspace.followup, config = workspace.paired, collection = workspace.collection;
  const [draft, setDraft] = useState<PairedConfig>(() => config || { fieldKey: "", before: "", after: "", confirmed: false });
  const [message, setMessage] = useState(""), [page, setPage] = useState(0);
  const data = useMemo(() => {
    if (!collection || !plan || !config) return { value: null, error: "" };
    try { return { value: pairedData(collection, plan, config), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "Revise a seleção." }; }
  }, [collection, plan, config]);
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
      if (kind === "excel") downloadBinary(workbook(pairedWorkbook(collection, plan, config)), "comparacao-antes-depois.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      else downloadBinary(wordDocument([{ text: "Comparação antes e depois", style: "title" }, ...resultsWordBlocks({ ...workspace, analysis: undefined, comparison: undefined, notes: "", flow: [] })]), "comparacao-antes-depois.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível exportar."); }
  }
  const numeric = plan.fields.filter(f=>f.kind==='number'), currentPage = data.value ? Math.min(page,Math.max(0,Math.ceil(data.value.pairs.length/20)-1)) : 0;
  return <section id="antes-depois" aria-labelledby="paired-title" className="min-w-0 bg-white border rounded-2xl p-5 md:p-6 space-y-5">
    <div><p className="text-xs uppercase tracking-widest text-teal">Seguimento · mesmos participantes</p><h2 id="paired-title" className="font-display text-2xl mt-2">Comparar antes e depois</h2><p className="text-sm text-ink-soft mt-3">Escolha uma medida numérica e dois momentos da ficha de visitas. O código de pesquisa identifica a mesma pessoa nos dois momentos. A comparação usa todos os participantes incluídos com pares completos, independentemente dos filtros da agenda ou da comparação entre grupos.</p></div>
    {!numeric.length || plan.moments.length<2 ? <p role="status" className="text-sm">Prepare pelo menos dois momentos e uma variável numérica no plano de acompanhamento.</p> : <><div className="grid md:grid-cols-3 gap-4"><label className="text-sm">Medida para comparar<select className={control} value={numeric.some(f=>f.key===draft.fieldKey)?draft.fieldKey:''} onChange={e=>setDraft({...draft,fieldKey:e.target.value,confirmed:false})}><option value="">Selecione</option>{numeric.map(f=><option key={f.key} value={f.key}>{f.label}{f.unit?` (${f.unit})`:''}</option>)}</select></label>{([['before','Momento inicial · antes'],['after','Momento posterior · depois']] as const).map(([key,label])=><label key={key} className="text-sm">{label}<select className={control} value={plan.moments.some(m=>m.key===draft[key])?draft[key]:''} onChange={e=>setDraft({...draft,[key]:e.target.value,confirmed:false})}><option value="">Selecione</option>{plan.moments.map(m=><option key={m.key} value={m.key}>{m.label} · dia {m.day}</option>)}</select></label>)}</div><button type="button" className={button} onClick={()=>commit({...draft,confirmed:false})}>Aplicar seleção antes/depois</button><p className="text-xs text-ink-soft">Os resultados abaixo correspondem à seleção aplicada e salva neste espaço. Mudanças nos campos acima só entram ao clicar em Aplicar seleção. A inferência precisa de nova conferência após mudanças nos dados ou no plano.</p></>}
    {data.error&&<p role="status" className="text-sm">{data.error}</p>}
    {data.value&&config&&<><p className="rounded-card bg-teal-soft p-4 text-sm"><strong>{data.value.field.label}{data.value.field.unit?` (${data.value.field.unit})`:''}: {data.value.before.label} → {data.value.after.label}.</strong> {data.value.counts.complete} pares completos de {data.value.counts.included} participantes incluídos; {data.value.counts.included-data.value.counts.complete} fora por visitas ou medidas incompletas. Mudança positiva significa aumento da medida, sem julgamento automático de melhora.</p>
      <details className="border rounded-card p-4"><summary className="cursor-pointer text-sm text-teal">Conferir quem entrou na comparação</summary><div className="mt-3 space-y-3"><Table rows={data.value.selection} caption="Quem entrou na comparação"/></div></details><Table rows={data.value.rows} caption="Mesmas pessoas antes, depois e mudança individual"/>
      {data.value.counts.chronology>0&&<p role="alert" className="text-sm border rounded-card p-3">Há {data.value.counts.chronology} pares com datas reais invertidas. As contagens e os valores permanecem visíveis para conferência; o teste fica bloqueado. Revise as datas nas visitas.</p>}
      <details className="rounded-card border p-4"><summary className="cursor-pointer text-sm text-teal">Conferir diferenças por participante</summary><p className="text-xs text-ink-soft mt-3">Revise a escala, a assimetria e os valores extremos das diferenças. Esta lista usa os pares completos e não é incluída no Word ou manuscrito.</p><div className="mt-3"><Table caption="Valores pareados para conferência" rows={[["Código de pesquisa","Antes","Depois","Depois − antes"],...data.value.pairs.slice(currentPage*20,currentPage*20+20).map(p=>[p.code,p.before,p.after,p.difference])]}/></div><div className="flex flex-wrap gap-3 items-center mt-3 text-sm"><button type="button" className={button} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Pares anteriores</button><span>Página {currentPage+1} de {Math.max(1,Math.ceil(data.value.pairs.length/20))}</span><button type="button" className={button} disabled={(currentPage+1)*20>=data.value.pairs.length} onClick={()=>setPage(currentPage+1)}>Próximos pares</button></div></details>
      <div className="border rounded-card p-4 space-y-4"><h3 className="font-medium">Teste t pareado · bilateral</h3><details><summary className="cursor-pointer text-sm text-teal">Método e condições de uso</summary><p className="text-sm text-ink-soft">O teste avalia se a mudança média difere de zero. Revise a distribuição das diferenças, sobretudo em amostras pequenas. Os participantes devem ser independentes entre si, e os valores de cada par devem pertencer à mesma pessoa, na mesma escala. Esta versão exige ao menos três pares completos; esse mínimo não garante adequação. Categorias, testes não paramétricos e três ou mais momentos não são analisados aqui.</p></details><ReviewGuide kind="paired" /><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={config.confirmed} onChange={e=>commit({...config,confirmed:e.target.checked})}/><span>Conferi o pareamento e a escala, a independência entre participantes, a normalidade aproximada das diferenças e os valores extremos.</span></label>
      {test.error&&<p role="status" className="text-sm bg-paper rounded-card p-3">{test.error}</p>}{test.value&&<><ResultReading reading={pairedReading(data.value,test.value)}/><details className="border rounded-card p-4"><summary className="cursor-pointer text-sm text-teal">Detalhes estatísticos da mudança</summary><Table rows={pairedResultRows(test.value)} caption="Estimativa da mudança média e inferência pareada"/></details><div className="bg-paper rounded-card p-4 text-sm"><h4 className="font-medium">Texto sugerido para revisão</h4><p className="mt-2">{pairedNarrative(data.value,test.value)}</p></div></>}</div>
      <details className="border rounded-card p-3"><summary className="cursor-pointer text-sm text-teal">Limitações e informações do método</summary><p className="text-xs text-ink-soft">{pairedNote}</p></details><div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={()=>exportFile('excel')}>Antes/depois em Excel</button><button type="button" className={button} onClick={()=>exportFile('word')}>Antes/depois em Word</button><button type="button" className={button} onClick={()=>commit(undefined)}>Remover comparação antes/depois</button></div><p className="text-xs text-ink-soft">As exportações desta seção contêm agregados. Salvar resultados guarda a seleção para as exportações do manuscrito e do centro de documentos.</p>
    </>}{message&&<p role="status" className="text-sm border rounded-card p-3">{message}</p>}
  </section>;
}

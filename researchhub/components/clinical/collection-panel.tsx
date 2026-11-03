"use client";
import { dialogCopy } from "@/lib/i18n/interface-copy";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import { useMemo, useState } from "react";
import { applyCollectionSuggestions } from "@/lib/clinical/suggestions";
import AssistantPanel from "@/components/ai/assistant-panel";
import type { ResultsWorkspace, Dataset } from "@/lib/results/data";
import { parseCsv } from "@/lib/results/data";
import { download } from "@/lib/exports/scientific";
import { downloadBinary, workbook, wordDocument } from "@/lib/exports/ooxml";
import { addHistory, assertImportPrivacy, blankField, collectionLimit, createCollection, exclusionReasons, identifierHeader, importRecords, normalize, putRecord, recordIssues, schemaIssues, type ClinicalCollection, type CollectionField, type CollectionProtocol, type CollectionRecord } from "@/lib/clinical/collection";
import { resultsWordBlocks } from "@/lib/results/word";
import { collectionWorkbook, profileRows, selectionCounts, syncCollection } from "@/lib/clinical/summary";

const inputClass = "block w-full min-w-0 rounded-card border border-line bg-white p-2.5 mt-1 text-sm font-normal";
const actionClass = "rounded-card border border-teal/30 px-4 py-2.5 text-sm text-teal disabled:opacity-40";
const statusLabels = { pending: "Pendente", included: "Incluído", excluded: "Excluído" };
const emptyRecord = (): CollectionRecord => ({ code: "", status: "pending", reason: "", values: {} });
const csvCell = (value: string) => `"${(/^[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;

export default function CollectionPanel({ workspace, protocol = {}, projectId, onChange, view = "all" }: {
  view?: "all" | "prepare" | "records" | "profile"; workspace: ResultsWorkspace; protocol?: CollectionProtocol; projectId: string; onChange: (value: ResultsWorkspace) => void;
}) {
  const { t: uiText } = useLanguage();
  const [studyDescription,setStudyDescription]=useState("");
  const collection = workspace.collection;
  const [message, setMessage] = useState("");
  const [schemaEditing, setSchemaEditing] = useState(false);
  const [draft, setDraft] = useState<CollectionRecord>(emptyRecord);
  const [editingCode, setEditingCode] = useState<string | undefined>();
  const [recordOpen, setRecordOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pendingImport, setPendingImport] = useState<Dataset | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [codeColumn, setCodeColumn] = useState(-1);
  const [reading, setReading] = useState(false);
  const counts = collection ? selectionCounts(collection) : null;
  const issues = collection ? schemaIssues(collection) : [];
  const canEdit = Boolean(collection && schemaEditing);
  const rows = useMemo(() => collection ? profileRows(collection) : [], [collection]);
  function commit(next: ClinicalCollection) {
    const updated = syncCollection(workspace, next);
    if (new TextEncoder().encode(JSON.stringify({ project: projectId, workspace: updated })).byteLength > 1_500_000) {
      setMessage("Esta alteração ultrapassaria 1,5 MB por projeto. A base anterior foi preservada; reduza o arquivo de importação ou o conteúdo dos campos."); return false;
    }
    onChange(updated); return true;
  }
  function attempt(action: () => void) { setMessage(""); try { action(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Confira a ficha e os registros."); } }
  function start() {
    if (workspace.dataset.rows.length && !window.confirm(dialogCopy("Ativar a coleta substituirá a base de análise deste projeto. Exporte os dados atuais antes de continuar. Deseja substituir?"))) return;
    commit(addHistory(createCollection(protocol), "Ficha iniciada a partir do protocolo salvo"));
    setSchemaEditing(true); setMessage("Contexto do protocolo carregado. Defina as variáveis, categorias e regras da sua coleta.");
  }
  function editField(key: string, patch: Partial<CollectionField>) {
    if (!collection || !canEdit) return;
    commit({ ...collection, fields: collection.fields.map(field => field.key === key ? { ...field, ...patch } : field) });
  }
  function addField(label = "Nova variável", kind: CollectionField["kind"] = "category", definition = "") {
    if (!collection || !canEdit) { setMessage("Abra a revisão da ficha antes de adicionar variáveis."); return; }
    if (collection.fields.length >= collectionLimit.fields) { setMessage(`Limite de ${collectionLimit.fields} variáveis.`); return; }
    const safeLabel = label.trim().slice(0, 100);
    if (!safeLabel || identifierHeader(safeLabel)) { setMessage("Use o nome de uma variável de pesquisa, sem identificadores pessoais."); return; }
    if (collection.fields.some(field => normalize(field.label) === normalize(safeLabel))) { setMessage("Esta variável já existe na ficha. Revise o campo existente."); return; }
    let index = 1;
    while (collection.fields.some(field => field.key === `v_${index}`)) index++;
    const key = `v_${index}`;
    commit({ ...collection, fields: [...collection.fields, { ...blankField(key, safeLabel), kind, definition: definition.slice(0, 1000) }] });
  }
  function finishSchema() {
    if (!collection) return;
    if (issues.length) { setMessage(issues.join(" ")); return; }
    commit(addHistory(collection, "Dicionário de variáveis e critérios revisados")); setSchemaEditing(false); setMessage("Ficha revisada. Você pode cadastrar participantes ou importar uma planilha.");
  }
  function reviseSchema() {
    if (!collection) return;
    if (counts!.included && !window.confirm(dialogCopy("Os registros incluídos voltarão para conferência antes de serem analisados com a ficha revisada. Continuar?"))) return;
    commit(addHistory({ ...collection, records: collection.records.map(record => record.status === "included" ? { ...record, status: "pending" } : record) }, "Revisão da ficha iniciada; incluídos retornaram à conferência"));
    setSchemaEditing(true); setRecordOpen(false); setPendingImport(null);
  }
  function saveRecord(event: React.FormEvent) {
    event.preventDefault(); if (!collection || canEdit) return;
    attempt(() => { if (!commit(putRecord(collection, draft, editingCode))) return; setDraft(emptyRecord()); setEditingCode(undefined); setRecordOpen(false); setMessage("Registro atualizado na coleta. Use Salvar resultados para gravar na sua conta."); });
  }
  async function readFile(file: File) {
    setReading(true); setMessage("");
    try {
      if (file.size > 1_500_000) throw new Error("Limite de 1,5 MB por arquivo.");
      const dataset = parseCsv(await file.text()); assertImportPrivacy(dataset);
      if (dataset.rows.length + (collection?.records.length || 0) > collectionLimit.records) throw new Error(`Limite de ${collectionLimit.records} registros nesta etapa.`);
      setPendingImport(dataset);
      setCodeColumn(dataset.columns.findIndex(column => ["codigo pesquisa", "codigo estudo", "codigo"].includes(normalize(column))));
      setMapping(Object.fromEntries((collection?.fields || []).map(field => [field.key, dataset.columns.findIndex(column => normalize(column) === normalize(field.label))])));
    } catch (reason) { setPendingImport(null); setMessage(reason instanceof Error ? reason.message : "Não foi possível ler o CSV."); }
    finally { setReading(false); }
  }
  function confirmImport() {
    if (!collection || !pendingImport) return;
    attempt(() => { if (!commit(importRecords(collection, pendingImport, codeColumn, mapping))) return; setPendingImport(null); setPage(0); setMessage("Importação concluída como pendente. Confira os registros antes de incluí-los na análise."); });
  }
  function includeValid() {
    if (!collection || issues.length || canEdit) return;
    const valid = collection.records.filter(record => record.status === "pending" && !recordIssues(collection, record).length);
    if (!valid.length) { setMessage("Nenhum registro pendente atende às regras da ficha. Revise as ocorrências indicadas."); return; }
    if (!window.confirm(dialogCopy(`Você conferiu os critérios do protocolo e os valores de ${valid.length} registros válidos e deseja incluí-los? A conferência humana é necessária mesmo sem alertas automáticos.`))) return;
    const codes = new Set(valid.map(record => record.code));
    commit(addHistory({ ...collection, records: collection.records.map(record => codes.has(record.code) ? { ...record, status: "included" } : record) }, `${valid.length} registros conferidos e incluídos pelo pesquisador`));
    setMessage(`${valid.length} registros incluídos. Somente os incluídos compõem as tabelas e a base de análise.`);
  }
  return <section id="coleta" aria-labelledby="collection-title" className="min-w-0 scroll-mt-24 rounded-2xl border border-teal/30 bg-white p-5 md:p-6">
    <p className="text-xs font-semibold uppercase tracking-widest text-teal"><InterfaceText message="screen.f89d7c581eb1" /></p>
    <h2 id="collection-title" className="mt-2 font-display text-2xl"><InterfaceText message="screen.c8663c0c9387" /></h2>
    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{view==="prepare"?uiText("screen.c1ceea3a614e"):view==="records"?uiText("screen.32543845cedd"):view==="profile"?uiText("screen.de84886d0c4a"):uiText("screen.4f6041d850bc")}</p>
    <p className="mt-3 rounded-card bg-paper p-3 text-xs leading-relaxed text-ink-soft"><InterfaceText message="screen.c830789d2469" /></p>
    {message && <p role="status" className="mt-4 rounded-card border border-teal/20 bg-teal-soft/40 p-3 text-sm"><AuthoredText text={message} /></p>}
    {!collection ? <div className="mt-5"><button type="button" onClick={start} className="rounded-card bg-teal px-5 py-3 text-white"><InterfaceText message="screen.3181f993200d" /></button><p className="mt-2 text-xs text-ink-soft"><InterfaceText message="screen.5a27e413e22e" /></p></div> : <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={uiText("screen.374f60177a2c")}>{[["Registrados", counts!.total], ["Incluídos", counts!.included], ["Excluídos", counts!.excluded], ["Pendentes", counts!.pending]].map(([label, count]) => <div key={label} className="rounded-card bg-teal-soft/50 p-3"><p className="text-xs text-ink-soft"><AuthoredText text={label} /></p><p className="mt-1 text-xl font-semibold">{count}</p></div>)}</div>
      <details hidden={view!=="all"&&view!=="prepare"} open={view==="prepare"||!collection.records.length||schemaEditing} className="rounded-card border border-line p-4">
        <summary className="cursor-pointer font-medium text-teal"><InterfaceText message="screen.30f014b295cd" /></summary>
        {!canEdit && <button type="button" onClick={reviseSchema} className={`${actionClass} mt-4`}><InterfaceText message="screen.e4de3154c640" /></button>}
        <fieldset disabled={!canEdit || reading} className="mt-4 min-w-0 space-y-4 disabled:opacity-70">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium"><InterfaceText message="screen.af9739a7c390" /><select aria-label={uiText("screen.b803721c3650")} value={collection.design} onChange={event => commit({ ...collection, design: event.target.value as ClinicalCollection["design"] })} className={inputClass}><option value="profile"><InterfaceText message="screen.17a2add36ad3" /></option><option value="retrospective"><InterfaceText message="screen.98f7300d2e21" /></option></select></label>
            <label className="text-sm font-medium"><InterfaceText message="screen.10ac11217b4c" /><input value={collection.period} maxLength={3000} onChange={event => commit({ ...collection, period: event.target.value })} placeholder={uiText("screen.98fb6b064aea")} className={inputClass}/></label>
            {([["population", "População"], ["inclusion", "Critérios de inclusão"], ["exclusion", "Critérios de exclusão"]] as const).map(([key, label]) => <label key={key} className="text-sm font-medium"><AuthoredText text={label} /><textarea value={collection[key]} maxLength={3000} rows={2} onChange={event => commit({ ...collection, [key]: event.target.value })} className={inputClass}/></label>)}
          </div>
          <p className="text-xs text-ink-soft"><InterfaceText message="screen.c4ae80e53bd7" /></p>
          {collection.fields.map(field => <fieldset key={field.key} className="min-w-0 rounded-card border border-line p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium"><InterfaceText message="screen.a6245133d108" /><input maxLength={100} value={field.label} onChange={event => editField(field.key, { label: event.target.value })} className={inputClass}/></label>
              <label className="text-sm font-medium">Tipo<select value={field.kind} onChange={event => editField(field.key, { kind: event.target.value as CollectionField["kind"], minimum: null, maximum: null, unit: "", options: [] })} className={inputClass}><option value="number"><InterfaceText message="screen.2eaebc06696a" /></option><option value="category"><InterfaceText message="screen.738f7f09c8d2" /></option><option value="date"><InterfaceText message="screen.cec3a9b89b2e" /></option></select></label>
              <label className="text-sm font-medium md:col-span-2"><InterfaceText message="screen.d2ea6331d321" /><textarea maxLength={1000} rows={2} value={field.definition} onChange={event => editField(field.key, { definition: event.target.value })} placeholder={uiText("screen.f11ce0021896")} className={inputClass}/></label>
              {field.kind === "number" && <><label className="text-sm font-medium"><InterfaceText message="screen.208f2cee4cd7" /><input maxLength={50} value={field.unit} onChange={event => editField(field.key, { unit: event.target.value })} placeholder={uiText("screen.12ef4d295f9c")} className={inputClass}/></label><div className="grid grid-cols-2 gap-3">{([["minimum", "Mínimo permitido"], ["maximum", "Máximo permitido"]] as const).map(([key, label]) => <label key={key} className="text-sm font-medium"><AuthoredText text={label} /><input type="number" step="any" value={field[key] ?? ""} onChange={event => editField(field.key, { [key]: event.target.value === "" ? null : Number(event.target.value) })} className={inputClass}/></label>)}</div></>}
              {field.kind === "category" && <label className="text-sm font-medium md:col-span-2"><InterfaceText message="screen.b2b753740fc9" /><input maxLength={2000} defaultValue={field.options.join("; ")} onBlur={event => editField(field.key, { options: event.target.value.split(";").map(value => value.trim()).filter(Boolean) })} placeholder={uiText("screen.abc262f1ce69")} className={inputClass}/></label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={event => editField(field.key, { required: event.target.checked })}/><InterfaceText message="screen.b881f13ec3fc" /></label><button type="button" disabled={collection.records.some(record => Boolean(record.values[field.key]))} onClick={() => commit({ ...collection, fields: collection.fields.filter(item => item.key !== field.key), records: collection.records.map(record => ({ ...record, values: Object.fromEntries(Object.entries(record.values).filter(([key]) => key !== field.key)) })) })} className="text-sm text-teal underline disabled:opacity-40"><InterfaceText message="screen.2c264373b6c0" /></button></div>
          </fieldset>)}
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => addField()} disabled={collection.fields.length >= collectionLimit.fields} className={actionClass}><InterfaceText message="screen.e6f410208d42" /></button><button type="button" onClick={finishSchema} className="rounded-card bg-teal px-4 py-2.5 text-sm text-white"><InterfaceText message="screen.d6d8690eff9a" /></button></div>
        </fieldset>
        {canEdit && <label className="block mt-5 text-sm font-medium"><InterfaceText message="screen.96955259f053" /><textarea rows={3} maxLength={2000} value={studyDescription} onChange={e=>setStudyDescription(e.target.value)} placeholder={uiText("screen.f3d91d333230")} className={inputClass}/><span className="block text-xs text-ink-soft mt-1"><InterfaceText message="screen.b0aea9447e89" /></span></label>}
        {canEdit && <AssistantPanel feature="collection" title={uiText("screen.ca0934b13232")} description={uiText("screen.232a263cb25f")} actionLabel={uiText("screen.8f7f5f931d5d")} projectId={projectId} context={{ description:studyDescription, protocol: { ...protocol, population: collection.population, inclusion_criteria: collection.inclusion, exclusion_criteria: collection.exclusion }, fields: collection.fields.map(({ label, kind, definition, unit }) => ({ label, kind, definition, unit })) }} disabled={reading} onApplyBatch={items=>{if(!collection||!canEdit)return false;try{const next=applyCollectionSuggestions(collection,items);if(!commit(next))return false;setMessage("Sugestões adicionadas. Confira as definições, categorias e unidades antes de concluir a ficha.");return true;}catch(e){setMessage(e instanceof Error?e.message:"Revise as sugestões.");return false;}}} onApply={item => { if (!["number", "category", "date"].includes(item.targetField)) { setMessage("A sugestão não indicou um tipo de variável válido. Revise antes de adicionar manualmente."); return; } addField(item.label, item.targetField as CollectionField["kind"], item.content); }}/>}
        {issues.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-amber-900">{issues.map(issue => <li key={issue}><AuthoredText text={issue} /></li>)}</ul>}
      </details>
      <section hidden={view!=="all"&&view!=="records"} aria-label={uiText("screen.b74fca403926")} className="rounded-card border border-line p-4">
        <h3 className="font-medium"><InterfaceText message="screen.1ff6483a07fd" /></h3>{(canEdit||issues.length>0)&&<p role="status" className="mt-3 rounded-card bg-paper p-3 text-sm"><InterfaceText message="screen.41a79cf90b26" /></p>}
        <p className="mt-2 text-xs text-ink-soft"><InterfaceText message="screen.3325b04628db" /> {collectionLimit.records.toLocaleString("pt-BR")} <InterfaceText message="screen.6e6b1af5dc1b" /> {collectionLimit.fields} <InterfaceText message="screen.97d5ceb4ae52" /></p>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={canEdit || issues.length > 0 || reading} onClick={() => { setDraft(emptyRecord()); setEditingCode(undefined); setRecordOpen(true); }} className="rounded-card bg-teal px-4 py-2.5 text-sm text-white disabled:opacity-40"><InterfaceText message="screen.832043798083" /></button>
          <button type="button" disabled={issues.length > 0 || reading} className={actionClass} onClick={() => download(["codigo_pesquisa", ...collection.fields.map(field => field.label)].map(csvCell).join(";") + "\n", "text/csv;charset=utf-8", "ficha-coleta.csv")}><InterfaceText message="screen.1d2563b2669a" /></button>
          <button type="button" onClick={() => downloadBinary(workbook(collectionWorkbook(collection, workspace.comparison, workspace.followup, workspace.paired, workspace.repeated, workspace.adjusted)), "coleta-e-perfil.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} className={actionClass}><InterfaceText message="screen.9514cf16674d" /></button><button type="button" disabled={!counts!.included} onClick={() => downloadBinary(wordDocument([{text:"Perfil dos participantes",heading:true},...resultsWordBlocks(workspace)]), "perfil-participantes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")} className={actionClass}>Exportar perfil · Word</button>
        </div>
        <label className="mt-4 block text-sm font-medium"><InterfaceText message="screen.42911b7498d0" /><input type="file" accept=".csv,text/csv" disabled={canEdit || issues.length > 0 || reading} className="mt-2 block w-full text-sm" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readFile(file); }}/></label>
        {reading && <p role="status" className="mt-3 text-sm"><InterfaceText message="screen.36bb0bdc7714" /></p>}
        {pendingImport && <div className="mt-4 rounded-card bg-paper p-4"><h4 className="text-sm font-medium"><InterfaceText message="screen.876391ffcaf5" /></h4><p className="mt-2 text-xs text-ink-soft">{pendingImport.rows.length} <InterfaceText message="screen.44144fd4cfc4" /></p><div className="mt-3 grid gap-3 md:grid-cols-2">{[{ key: "__code", label: "Código de pesquisa · obrigatório" }, ...collection.fields].map(field => <label key={field.key} className="text-sm">{field.label}<select value={field.key === "__code" ? codeColumn : mapping[field.key] ?? -1} onChange={event => field.key === "__code" ? setCodeColumn(Number(event.target.value)) : setMapping(current => ({ ...current, [field.key]: Number(event.target.value) }))} className={inputClass}><option value={-1}><InterfaceText message="screen.363926d0e26e" /></option>{pendingImport.columns.map((column, index) => <option key={column} value={index}>{column}</option>)}</select></label>)}</div><div className="mt-4 flex gap-3"><button type="button" onClick={confirmImport} className={actionClass}><InterfaceText message="screen.602b7bd384f4" /></button><button type="button" onClick={() => setPendingImport(null)} className="text-sm text-teal underline"><InterfaceText message="screen.59f0e6ea2eae" /></button></div></div>}
        {recordOpen && <form onSubmit={saveRecord} aria-label={uiText("screen.cac6311205f0")} className="mt-5 rounded-card border border-teal/30 p-4">
          <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium"><InterfaceText message="screen.b9d2a8fb00bb" /><input required readOnly={Boolean(editingCode)} pattern="[A-Za-z][A-Za-z0-9_-]{0,31}" maxLength={32} value={draft.code} onChange={event => setDraft(current => ({ ...current, code: event.target.value }))} placeholder="P001" className={inputClass}/></label><label className="text-sm font-medium"><InterfaceText message="screen.cf7d46ded085" /><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as CollectionRecord["status"] }))} className={inputClass}><option value="pending"><InterfaceText message="screen.100b75f4e12d" /></option><option value="included"><InterfaceText message="screen.55c9bd965e70" /></option><option value="excluded"><InterfaceText message="screen.e660ce34d4df" /></option></select></label>
            {draft.status === "excluded" && <label className="text-sm font-medium"><InterfaceText message="screen.a206441b0713" /><select required value={draft.reason} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} className={inputClass}><option value=""><InterfaceText message="screen.987d5be9f4bf" /></option>{exclusionReasons.map(reason => <option key={reason}><AuthoredText text={reason} /></option>)}</select></label>}
            {collection.fields.map(field => <label key={field.key} className="text-sm font-medium">{field.label}{field.unit ? ` (${field.unit})` : ""}{field.required ? uiText("screen.d098db414efe") : ""}{field.kind === "category" ? <select value={draft.values[field.key] || ""} onChange={event => setDraft(current => ({ ...current, values: { ...current.values, [field.key]: event.target.value } }))} className={inputClass}><option value=""><InterfaceText message="screen.3f4900243745" /></option>{draft.values[field.key] && !field.options.includes(draft.values[field.key]) && <option value={draft.values[field.key]}><InterfaceText message="screen.9c4f6091ad4a" /> {draft.values[field.key]}</option>}{field.options.map(option => <option key={option}>{option}</option>)}</select> : <input inputMode={field.kind === "number" ? "decimal" : "text"} maxLength={200} value={draft.values[field.key] || ""} placeholder={field.kind === "date" ? "AAAA-MM-DD ou deixe vazio" : "Valor ou deixe vazio"} onChange={event => setDraft(current => ({ ...current, values: { ...current.values, [field.key]: event.target.value } }))} className={inputClass}/>}<span className="mt-1 block text-xs font-normal text-ink-soft">{field.definition}</span></label>)}
          </div>
          {recordIssues(collection, draft).length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900">{recordIssues(collection, draft).map(issue => <li key={issue}><AuthoredText text={issue} /></li>)}</ul>}
          <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="rounded-card bg-teal px-4 py-2.5 text-sm text-white"><InterfaceText message="screen.00abb64e219e" /></button><button type="button" onClick={() => setRecordOpen(false)} className="text-sm text-teal underline"><InterfaceText message="screen.f1cb621ee9d8" /></button></div>
        </form>}
        {collection.records.length > 0 && <><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-soft"><InterfaceText message="screen.314e7a0769fc" /></p><button type="button" disabled={canEdit || issues.length > 0 || !counts!.pending} onClick={includeValid} className={actionClass}><InterfaceText message="screen.d0a41741327f" /></button></div><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only"><InterfaceText message="screen.037356fd2d41" /></caption><thead><tr>{["Código", "Situação", "Conferência", "Ação"].map(label => <th scope="col" key={label} className="border-b border-line p-3"><AuthoredText text={label} /></th>)}</tr></thead><tbody>{collection.records.slice(page * 20, page * 20 + 20).map(record => { const problems = recordIssues(collection, record); return <tr key={record.code}><th scope="row" className="border-b border-line p-3">{record.code}</th><td className="border-b border-line p-3"><AuthoredText text={statusLabels[record.status]} />{record.reason && <span className="block text-xs text-ink-soft">{record.reason}</span>}</td><td className="border-b border-line p-3 text-xs">{problems.length ? problems.join(" ") : uiText("screen.4b0f6a049921")}</td><td className="border-b border-line p-3"><button type="button" disabled={canEdit} aria-label={`Conferir ${record.code}`} onClick={() => { setDraft({ ...record, values: { ...record.values } }); setEditingCode(record.code); setRecordOpen(true); }} className="text-teal underline disabled:opacity-40"><InterfaceText message="screen.2d7b851dcf83" /></button></td></tr>; })}</tbody></table></div><div className="mt-3 flex items-center justify-between gap-3 text-sm"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)} className="text-teal disabled:opacity-40">Anterior</button><span>Página {page + 1} de {Math.max(1, Math.ceil(collection.records.length / 20))}</span><button type="button" disabled={(page + 1) * 20 >= collection.records.length} onClick={() => setPage(value => value + 1)} className="text-teal disabled:opacity-40"><InterfaceText message="screen.2fe966afd7f9" /></button></div></>}
      </section>
      <section hidden={view!=="all"&&view!=="profile"} aria-label={uiText("screen.40193e50f539")} className="rounded-card border border-line p-4"><h3 className="font-medium"><InterfaceText message="screen.e686b79534aa" /></h3><details className="mt-3 rounded-card bg-paper p-3"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.fd5ab2540f9a" /></summary><p className="text-sm mt-3"><InterfaceText message="screen.83c5ea044beb" /></p></details><p className="mt-2 text-xs text-ink-soft"><InterfaceText message="screen.457f71e11a41" /> {counts!.included} <InterfaceText message="screen.5f120753108d" /></p>{counts!.included ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{rows[0].map(label => <th scope="col" key={label} className="border border-line p-3"><AuthoredText text={label} /></th>)}</tr></thead><tbody>{rows.slice(1).map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column} className="border border-line p-3">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-ink-soft"><InterfaceText message="screen.3d135777aea3" /></p>}<p className="mt-3 text-xs text-ink-soft"><InterfaceText message="screen.d26256d10901" /></p></section>
      <details hidden={view!=="all"&&view!=="records"} className="text-xs text-ink-soft"><summary className="cursor-pointer text-teal"><InterfaceText message="screen.8cc9f8ffbe86" /></summary><ol className="mt-3 space-y-2">{collection.history.slice().reverse().map((entry, index) => <li key={index}>{new Date(entry.at).toLocaleString("pt-BR")} · <AuthoredText text={entry.action} />{entry.code ? ` · ${entry.code}` : ""}</li>)}</ol><p className="mt-3"><InterfaceText message="screen.5d4befa38ab6" /></p></details>
    </div>}
  </section>;
}

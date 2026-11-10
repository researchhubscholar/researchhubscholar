"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { dialogCopy } from "@/lib/i18n/interface-copy";
import { parseCsv, type Dataset } from "@/lib/results/data";

export default function DatasetTable({ dataset, onChange, caseControl = false }: { dataset: Dataset; onChange: (data: Dataset) => void; caseControl?: boolean }) {
  const { locale } = useLanguage();
  const t = (pt: string, es: string) => locale === "es" ? es : pt;
  const [column, setColumn] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(dataset.rows.length / 20) - 1));
  const groupColumn = caseControl ? dataset.columns.findIndex(name => /^(grupo|group)$/i.test(name.trim())) : -1;
  const groupStatus = (value: string) => /^(caso|case)$/i.test(value.trim()) ? "case" : /^(controle|control)$/i.test(value.trim()) ? "control" : "";
  const groupCounts = { case: 0, control: 0, unassigned: 0 };
  if (groupColumn >= 0) for (const row of dataset.rows) groupCounts[groupStatus(row[groupColumn]) || "unassigned"]++;
  function updateCell(index: number, col: number, value: string) {
    const updated = [...dataset.rows[index]]; updated[col] = value;
    onChange({ ...dataset, rows: dataset.rows.map((item, i) => i === index ? updated : item) });
  }
  function applyPaste() {
    try {
      const next = parseCsv(paste);
      if (next.columns.some(name => name.length > 200) || next.rows.some(row => row.some(value => value.length > 2000))) throw Error(t("Há campos muito extensos.", "Hay campos demasiado largos."));
      if (dataset.rows.length && !window.confirm(dialogCopy("Substituir os dados importados deste projeto?"))) return;
      onChange(next); setPaste(""); setPage(0); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível ler a tabela.", "No se pudo leer la tabla.")); }
  }
  function addColumn() {
    const name = column.trim();
    if (!name || dataset.columns.includes(name)) { setError(t("Informe um nome de coluna único.", "Indica un nombre de columna único.")); return; }
    onChange({ columns: [...dataset.columns, name], rows: dataset.rows.map(row => [...row, ""]) });
    setColumn(""); setError("");
  }
  return <section className="bg-white border rounded-2xl p-5 mb-5 space-y-4">
    <h2 className="font-display text-2xl">{caseControl ? t("Tabela de casos e controles", "Tabla de casos y controles") : t("Montar tabela", "Crear tabla")}</h2>
    <p className="text-sm text-ink-soft">{t("Digite os dados aqui ou cole células de uma planilha. Use códigos no lugar de nomes ou identificadores pessoais.", "Escribe los datos o pega celdas de una hoja de cálculo. Usa códigos en lugar de nombres o identificadores personales.")}</p>
    {caseControl && <p className="text-sm text-ink-soft">{t("Use uma linha por participante. Registre o grupo e a exposição conforme o protocolo. Você pode adicionar outras variáveis.", "Usa una fila por participante. Registra el grupo y la exposición según el protocolo. Puedes añadir otras variables.")}</p>}
    {groupColumn >= 0 && <p className="text-sm text-teal">{groupCounts.case} {t("casos", "casos")} · {groupCounts.control} {t("controles", "controles")} · {groupCounts.unassigned} {t("sem grupo reconhecido", "sin grupo reconocido")}</p>}
    <details className="rounded-card border p-3">
      <summary className="cursor-pointer font-medium text-teal">{t("Colar dados da planilha", "Pegar datos de la hoja de cálculo")}</summary>
      <label className="block text-sm mt-3">{t("Cole as células incluindo os nomes das colunas na primeira linha.", "Pega las celdas con los nombres de las columnas en la primera fila.")}
        <textarea rows={4} maxLength={1_500_000} value={paste} onChange={event => setPaste(event.target.value)} className="mt-2 block w-full rounded-card border p-3" />
      </label>
      <button type="button" disabled={!paste.trim()} onClick={applyPaste} className="mt-3 rounded-card bg-teal px-4 py-2 text-white disabled:opacity-50">{t("Usar dados colados", "Usar datos pegados")}</button>
    </details>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">{t("Nome da coluna", "Nombre de la columna")}<input value={column} maxLength={200} onChange={event => setColumn(event.target.value)} className="mt-1 block rounded-card border p-2" /></label>
      <button type="button" disabled={!column.trim() || dataset.columns.length >= 80} onClick={addColumn} className="rounded-card border px-3 py-2 disabled:opacity-50">{t("Adicionar coluna", "Añadir columna")}</button>
      <button type="button" disabled={!dataset.columns.length || dataset.rows.length >= 5000} onClick={() => {
        onChange({ ...dataset, rows: [...dataset.rows, dataset.columns.map(() => "")] });
        setPage(Math.floor(dataset.rows.length / 20));
      }} className="rounded-card border px-3 py-2 disabled:opacity-50">{t("Adicionar linha", "Añadir fila")}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {dataset.columns.length > 0 && <div className="overflow-x-auto"><table className="text-sm w-full">
      <thead><tr><th scope="col">#</th>{dataset.columns.map(name => <th key={name} scope="col" className="border p-2 text-left">{name}</th>)}<th scope="col" className="sr-only">{t("Ações", "Acciones")}</th></tr></thead>
      <tbody>{dataset.rows.slice(current * 20, current * 20 + 20).map((row, offset) => {
        const index = current * 20 + offset;
        return <tr key={index}><th scope="row" className="p-2">{index + 1}</th>{row.map((value, col) => <td key={col} className="border">
          {col === groupColumn ? <select aria-label={`${dataset.columns[col]} · ${index + 1}`} value={groupStatus(value) || (value ? "other" : "")} onChange={event => updateCell(index,col,event.target.value === "case" ? "Caso" : event.target.value === "control" ? t("Controle","Control") : "")} className="w-full min-w-24 bg-transparent p-2">
            <option value="">{t("Selecionar","Seleccionar")}</option>
            <option value="case">Caso</option>
            <option value="control">{t("Controle","Control")}</option>
            {value && !groupStatus(value) && <option value="other" disabled>{value}</option>}
          </select> : <input aria-label={`${dataset.columns[col]} · ${index + 1}`} value={value} maxLength={2000} onChange={event => updateCell(index,col,event.target.value)} className="w-full min-w-24 bg-transparent p-2" />}
        </td>)}<td><button type="button" aria-label={`${t("Remover linha", "Eliminar fila")} ${index + 1}`} onClick={() => onChange({ ...dataset, rows: dataset.rows.filter((_, i) => i !== index) })} className="p-2 text-teal">×</button></td></tr>;
      })}</tbody>
    </table></div>}
    {dataset.rows.length > 20 && <div className="flex gap-3 text-sm">
      <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="disabled:opacity-40">{t("Anterior", "Anterior")}</button>
      <span>{current * 20 + 1}–{Math.min(dataset.rows.length, current * 20 + 20)} / {dataset.rows.length}</span>
      <button type="button" disabled={(current + 1) * 20 >= dataset.rows.length} onClick={() => setPage(current + 1)} className="disabled:opacity-40">{t("Próxima", "Siguiente")}</button>
    </div>}
  </section>;
}

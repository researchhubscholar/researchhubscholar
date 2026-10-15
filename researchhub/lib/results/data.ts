import type { AnalysisConfig } from "./inference";
export type Dataset = { columns: string[]; rows: string[][] };
export type Figure = { column: string; title: string; caption: string; kind: "bar" | "histogram" };
export type ResultsWorkspace = { dataset: Dataset; figure: Figure; flow: { label: string; count: number }[]; notes: string; analysis?: AnalysisConfig };
export const emptyResults: ResultsWorkspace = { dataset: { columns: [], rows: [] }, figure: { column: "", title: "", caption: "", kind: "bar" }, flow: [{ label: "Identificados", count: 0 }, { label: "Avaliados", count: 0 }, { label: "Incluídos", count: 0 }], notes: "" };
export function parseCsv(text: string): Dataset {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/)[0];
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') { if (quoted && source[i + 1] === '"') { value += '"'; i++; } else if (!value || quoted) quoted = !quoted; else throw new Error("Aspas inválidas no CSV."); }
    else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
      row.push(value); value = "";
      if (c !== delimiter) { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === "\r" && source[i + 1] === "\n") i++; }
    } else value += c;
  }
  if (quoted) throw new Error("O CSV contém aspas não fechadas.");
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("Inclua cabeçalho e ao menos uma linha de dados.");
  const columns = rows.shift()!.map(v => v.trim());
  if (columns.some(v => !v) || new Set(columns).size !== columns.length) throw new Error("Os nomes das colunas devem ser preenchidos e únicos.");
  if (columns.length > 80 || rows.length > 5000) throw new Error("Limite: 80 colunas e 5.000 linhas por projeto.");
  if (rows.some(r => r.length !== columns.length)) throw new Error("Todas as linhas devem ter o mesmo número de colunas.");
  return { columns, rows };
}
export function numeric(value: string): number | null {
  const s = value.trim().replace(",", ".");
  if (!s || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
export function describe(dataset: Dataset) {
  return dataset.columns.map((column, i) => {
    const values = dataset.rows.map(row => row[i].trim()).filter(Boolean);
    const numbers = values.map(numeric); const quantitative = values.length > 0 && numbers.every(n => n !== null);
    const ns = quantitative ? (numbers as number[]).sort((a, b) => a - b) : [];
    const mean = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
    const median = ns.length ? ns.length % 2 ? ns[Math.floor(ns.length / 2)] : (ns[ns.length / 2 - 1] + ns[ns.length / 2]) / 2 : null;
    const sd = ns.length > 1 ? Math.sqrt(ns.reduce((sum, n) => sum + (n - mean!) ** 2, 0) / (ns.length - 1)) : null;
    return { column, type: quantitative ? "Numérica" : "Categórica", n: values.length, missing: dataset.rows.length - values.length, unique: new Set(values).size, mean, median, sd, min: ns[0] ?? null, max: ns.at(-1) ?? null };
  });
}
export function chartData(dataset: Dataset, column: string, kind: Figure["kind"]) {
  const index = dataset.columns.indexOf(column); if (index < 0) return [];
  const values = dataset.rows.map(row => row[index].trim()).filter(Boolean);
  if (kind === "histogram") {
    const ns = values.map(numeric); if (!ns.length || ns.some(n => n === null)) return [];
    const nums = ns as number[]; const min = Math.min(...nums), max = Math.max(...nums);
    if (min === max) return [{ label: String(min), count: nums.length }];
    const bins = Math.min(10, Math.max(2, Math.ceil(Math.sqrt(nums.length)))), step = (max - min) / bins;
    const result = Array.from({ length: bins }, (_, i) => ({ label: `${(min + step * i).toFixed(2)}–${(min + step * (i + 1)).toFixed(2)}`, count: 0 }));
    nums.forEach(n => result[Math.min(bins - 1, Math.floor((n - min) / step))].count++); return result;
  }
  const counts = new Map<string, number>(); values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= 12) return sorted.map(([label, count]) => ({ label, count }));
  return [...sorted.slice(0, 11).map(([label, count]) => ({ label, count })), { label: "Outras categorias", count: sorted.slice(11).reduce((sum, [, count]) => sum + count, 0) }];
}
export function validWorkspace(input: unknown): input is ResultsWorkspace {
  if (!input || typeof input !== "object") return false;
  const x = input as ResultsWorkspace;
  return (!x.analysis || (["welch", "pearson", "chi2"].includes(x.analysis.kind) && typeof x.analysis.independent === "boolean" && [x.analysis.x, x.analysis.y].every(v => typeof v === "string" && v.length <= 200))) && !!x.dataset && Array.isArray(x.dataset.columns) && x.dataset.columns.length <= 80 && x.dataset.columns.every(c => typeof c === "string" && c.length > 0 && c.length <= 200) && new Set(x.dataset.columns).size === x.dataset.columns.length && Array.isArray(x.dataset.rows) && x.dataset.rows.length <= 5000 && x.dataset.rows.every(r => Array.isArray(r) && r.length === x.dataset.columns.length && r.every(v => typeof v === "string" && v.length <= 2000)) && !!x.figure && ["bar", "histogram"].includes(x.figure.kind) && [x.figure.column, x.figure.title, x.figure.caption, x.notes].every(v => typeof v === "string" && v.length <= 10000) && Array.isArray(x.flow) && x.flow.length <= 12 && x.flow.every(s => typeof s.label === "string" && s.label.length <= 200 && Number.isSafeInteger(s.count) && s.count >= 0);
}

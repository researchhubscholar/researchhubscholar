import type { AnalysisConfig } from "../results/inference";
import type { Dataset } from "../results/data";

export type CollectionField = {
  key: string; label: string; kind: "number" | "category" | "date";
  definition: string; unit: string; options: string[]; required: boolean;
  minimum: number | null; maximum: number | null;
};
export type CollectionRecord = { code: string; status: "pending" | "included" | "excluded"; reason: string; values: Record<string, string> };
export type ClinicalCollection = {
  version: 1; design: "profile" | "retrospective"; period: string;
  population: string; inclusion: string; exclusion: string;
  fields: CollectionField[]; records: CollectionRecord[];
  history: { at: string; action: string; code: string }[];
};
export type CollectionProtocol = {
  research_question?: string | null; population?: string | null; inclusion_criteria?: string | null;
  exclusion_criteria?: string | null; primary_outcome?: string | null; variables?: string | null;
  study_type?: string | null; methods?: string | null; ethics_notes?: string | null;
};
export const collectionLimit = { records: 1000, fields: 40, history: 100 };
export const exclusionReasons = ["Fora do período", "Não atende aos critérios de inclusão", "Atende a critério de exclusão", "Registro incompleto para os objetivos", "Outro critério previsto no protocolo"];
export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[_\s-]+/g, " ");
const missingTokens = new Set(["", "na", "n/a", "nao informado", "nao registrado"]);
const bounded = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
const numberValue = (value: string) => { const input = value.trim().replace(",", "."); return input && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input) && Number.isFinite(Number(input)) ? Number(input) : null; };
export function identifierHeader(label: string) {
  return /\b(nome|cpf|rg|cns|telefone|celular|whatsapp|email|e mail|endereco|prontuario|nascimento|name|phone|address|birth|medical record)\b/.test(normalize(label));
}
export function identifierValue(value: string) {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) || /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(value) || /\(\d{2}\)\s*\d{4,5}[- ]?\d{4}/.test(value);
}
export function blankField(key: string, label = "Nova variável"): CollectionField {
  return { key, label, kind: "category", definition: "", unit: "", options: [], required: false, minimum: null, maximum: null };
}
export function createCollection(protocol: CollectionProtocol): ClinicalCollection {
  return { version: 1, design: "profile", period: "", population: protocol.population || "", inclusion: protocol.inclusion_criteria || "", exclusion: protocol.exclusion_criteria || "", fields: [], records: [], history: [] };
}
export function schemaIssues(collection: ClinicalCollection) {
  const issues: string[] = [];
  if (!collection.population.trim()) issues.push("Defina a população da coleta.");
  if (!collection.period.trim()) issues.push("Defina o período dos registros.");
  if (!collection.inclusion.trim()) issues.push("Defina os critérios de inclusão.");
  if (!collection.fields.length) issues.push("Defina ao menos uma variável antes de incluir participantes.");
  const labels = new Set<string>();
  for (const field of collection.fields) {
    if (!field.label.trim()) issues.push("Preencha o nome de todas as variáveis.");
    if (labels.has(normalize(field.label))) issues.push(`Há variáveis com o mesmo nome: ${field.label}.`);
    labels.add(normalize(field.label));
    if (identifierHeader(field.label)) issues.push(`Retire o identificador pessoal da ficha: ${field.label}.`);
    if (field.options.some(option => missingTokens.has(normalize(option)))) issues.push(`${field.label}: represente dados ausentes com célula vazia, sem criar categorias NA ou não informado.`);
    if (field.options.some(option => option.length > 100 || identifierValue(option))) issues.push(`Revise as categorias de ${field.label}: até 100 caracteres e sem identificadores pessoais.`);
    if (new Set(field.options.map(normalize)).size !== field.options.length || field.options.length > 40) issues.push(`Revise as categorias de ${field.label}: até 40 alternativas sem duplicação.`);
    if (field.kind === "category" && !field.options.length) issues.push(`Defina as categorias de ${field.label}.`);
    if (field.minimum !== null && field.maximum !== null && field.minimum > field.maximum) issues.push(`O mínimo de ${field.label} é maior que o máximo.`);
  }
  return issues;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function recordIssues(collection: ClinicalCollection, record: CollectionRecord) {
  const issues: string[] = [];
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(record.code)) issues.push("Use um código de pesquisa iniciado por letra, como P001 (até 32 caracteres).");
  if (collection.records.some(row => normalize(row.code) === normalize(record.code) && row.code !== record.code)) issues.push("O código já está em uso.");
  for (const field of collection.fields) {
    const value = (Object.hasOwn(record.values, field.key) ? record.values[field.key] : "").trim();
    if (!value) { if (field.required) issues.push(`${field.label}: dado necessário para inclusão ausente.`); continue; }
    if (identifierValue(value)) issues.push(`${field.label}: possível identificador pessoal. Remova antes de registrar.`);
    if (field.kind === "number") {
      const number = numberValue(value);
      if (number === null) issues.push(`${field.label}: informe somente um número, sem unidade no valor.`);
      else if ((field.minimum !== null && number < field.minimum) || (field.maximum !== null && number > field.maximum)) issues.push(`${field.label}: confira o valor ou os limites definidos na ficha.`);
    } else if (field.kind === "category" && !field.options.includes(value)) issues.push(`${field.label}: escolha uma categoria prevista na ficha.`);
    else if (field.kind === "date" && !validDate(value)) issues.push(`${field.label}: use uma data válida no formato AAAA-MM-DD.`);
  }
  if (record.status === "excluded" && !exclusionReasons.includes(record.reason)) issues.push("Escolha o motivo da exclusão.");
  return issues;
}
export function collectionDataset(collection: ClinicalCollection): Dataset {
  return { columns: collection.fields.map(field => field.label), rows: collection.records.filter(row => row.status === "included").map(row => collection.fields.map(field => Object.hasOwn(row.values, field.key) ? row.values[field.key] : "")) };
}
export function addHistory(collection: ClinicalCollection, action: string, code = ""): ClinicalCollection {
  return { ...collection, history: [...collection.history, { at: new Date().toISOString(), action: action.slice(0, 200), code }].slice(-collectionLimit.history) };
}
export function putRecord(collection: ClinicalCollection, record: CollectionRecord, editingCode?: string) {
  if (collection.records.some(row => row.code !== editingCode && normalize(row.code) === normalize(record.code))) throw new Error("Código de pesquisa repetido. Confira se é o mesmo participante.");
  if (!editingCode && collection.records.length >= collectionLimit.records) throw new Error(`Limite de ${collectionLimit.records} registros nesta etapa.`);
  if (editingCode && !collection.records.some(row => row.code === editingCode)) throw new Error("O registro a editar não foi encontrado.");
  const issues = recordIssues(collection, record);
  if (record.status === "included") issues.push(...schemaIssues(collection));
  const critical = issues.filter(issue => issue.includes("código de pesquisa") || issue.includes("identificador pessoal") || issue.includes("motivo da exclusão"));
  if (critical.length || (record.status === "included" && issues.length)) throw new Error((critical.length ? critical : issues).join(" "));
  const values = Object.fromEntries(collection.fields.map(field => [field.key, (Object.hasOwn(record.values, field.key) ? record.values[field.key] : "").trim()]));
  const next = { ...record, reason: record.status === "excluded" ? record.reason : "", values };
  const records = editingCode ? collection.records.map(row => row.code === editingCode ? next : row) : [...collection.records, next];
  return addHistory({ ...collection, records }, editingCode ? "Registro conferido e atualizado" : "Registro adicionado", record.code);
}
export function validCollection(value: unknown): value is ClinicalCollection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as ClinicalCollection;
  if (x.version !== 1 || !["profile", "retrospective"].includes(x.design) || ![x.period, x.population, x.inclusion, x.exclusion].every(v => bounded(v, 3000))) return false;
  if (!Array.isArray(x.fields) || x.fields.length > collectionLimit.fields || new Set(x.fields.map(f => f?.key)).size !== x.fields.length) return false;
  if (!x.fields.every(f => f && typeof f.key === "string" && !["constructor", "prototype", "__proto__"].includes(f.key) && /^[a-z][a-z0-9_]{0,49}$/.test(f.key) && bounded(f.label, 100) && f.label.trim() && !identifierHeader(f.label) && ["number", "category", "date"].includes(f.kind) && bounded(f.definition, 1000) && bounded(f.unit, 50) && typeof f.required === "boolean" && [f.minimum, f.maximum].every(n => n === null || (typeof n === "number" && Number.isFinite(n))) && Array.isArray(f.options) && f.options.length <= 40 && f.options.every(o => bounded(o, 100) && o.trim() && !identifierValue(o)) && new Set(f.options.map(normalize)).size === f.options.length)) return false;
  if (new Set(x.fields.map(f => normalize(f.label))).size !== x.fields.length) return false;
  if (!Array.isArray(x.records) || x.records.length > collectionLimit.records || new Set(x.records.map(r => normalize(String(r?.code)))).size !== x.records.length) return false;
  if (!x.records.every(r => r && bounded(r.code, 32) && /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(r.code) && ["pending", "included", "excluded"].includes(r.status) && bounded(r.reason, 200) && (r.status !== "excluded" || exclusionReasons.includes(r.reason)) && r.values && typeof r.values === "object" && !Array.isArray(r.values) && Object.keys(r.values).every(key => x.fields.some(f => f.key === key)) && Object.values(r.values).every(v => bounded(v, 200) && !identifierValue(v as string)))) return false;
  if (x.records.some(r => r.status === "included") && (schemaIssues(x).length || x.records.filter(r => r.status === "included").some(r => recordIssues(x, r).length))) return false;
  return Array.isArray(x.history) && x.history.length <= collectionLimit.history && x.history.every(h => h && typeof h.at === "string" && h.at.length <= 30 && Number.isFinite(Date.parse(h.at)) && bounded(h.action, 200) && bounded(h.code, 32));
}
export function assertImportPrivacy(dataset: Dataset) {
  if (dataset.columns.some(identifierHeader)) throw new Error("A planilha contém colunas de identificação pessoal. Remova nomes, documentos, nascimento, contatos e número do prontuário antes de importar.");
  if (dataset.rows.some(row => row.some(identifierValue))) throw new Error("Há possíveis identificadores pessoais na planilha. Remova-os antes de importar.");
}
export function importRecords(collection: ClinicalCollection, dataset: Dataset, codeColumn: number, mapping: Record<string, number>) {
  assertImportPrivacy(dataset);
  if (!Number.isInteger(codeColumn) || codeColumn < 0 || codeColumn >= dataset.columns.length) throw new Error("Selecione a coluna com o código de pesquisa.");
  const used = Object.values(mapping).filter(index => index >= 0);
  if (used.some(index => !Number.isInteger(index) || index >= dataset.columns.length) || new Set([codeColumn, ...used]).size !== used.length + 1) throw new Error("Cada coluna deve corresponder a somente um campo da ficha.");
  if (collection.records.length + dataset.rows.length > collectionLimit.records) throw new Error(`Limite de ${collectionLimit.records} registros nesta etapa.`);
  const codes = new Set(collection.records.map(row => normalize(row.code)));
  const records = dataset.rows.map((row, index) => {
    const code = row[codeColumn].trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(code) || codes.has(normalize(code))) throw new Error(`Linha ${index + 2}: código ausente, inválido ou repetido. Use códigos como P001, nunca o número do prontuário.`);
    codes.add(normalize(code));
    const values = Object.fromEntries(collection.fields.map(field => {
      const column = mapping[field.key];
      const raw = Number.isInteger(column) && column >= 0 ? row[column].trim() : "";
      if (raw.length > 200) throw new Error(`Linha ${index + 2}: valor muito extenso para ${field.label}.`);
      const value = missingTokens.has(normalize(raw)) ? "" : field.kind === "category" ? field.options.find(option => normalize(option) === normalize(raw)) || raw : raw;
      return [field.key, value];
    }));
    return { code, status: "pending" as const, reason: "", values };
  });
  return addHistory({ ...collection, records: [...collection.records, ...records] }, `${records.length} registros importados para conferência`);
}

// Numeric category codes remain categories in exploratory inference as well.
export function assertAnalysisKinds(kinds: Record<string, CollectionField["kind"]> | undefined, config: AnalysisConfig) {
  if (!kinds || !config.x || !config.y) return;
  const x = kinds[config.x], y = kinds[config.y];
  if ((config.kind === "welch" && (x !== "number" || y !== "category")) ||
      (config.kind === "pearson" && (x !== "number" || y !== "number")) ||
      (config.kind === "chi2" && (x !== "category" || y !== "category"))) {
    throw new Error("A análise não corresponde aos tipos definidos na ficha: Welch exige uma variável numérica e um grupo categórico; Pearson, duas numéricas; qui-quadrado, duas categóricas.");
  }
}

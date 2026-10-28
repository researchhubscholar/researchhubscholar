import { identifierHeader, identifierValue, normalize, recordIssues, schemaIssues, validCollection, type ClinicalCollection, type CollectionField } from "./collection";
import { describe, type Dataset } from "../results/data";
export type FollowupMoment = { key: string; label: string; day: number };
export type FollowupVisit = { code: string; momentKey: string; status: "draft" | "completed" | "missed"; date: string; reason: string; values: Record<string, string> };
export type ClinicalFollowup = { version: 1; moments: FollowupMoment[]; fields: CollectionField[]; anchors: Record<string, string>; visits: FollowupVisit[] };
export const followupLimit = { moments: 12, fields: 20, visits: 5000 };
export const missedReasons = ["Não compareceu", "Perda de seguimento", "Retirada do estudo", "Óbito", "Não realizado no período", "Outro motivo previsto no protocolo"];
export const visitLabels = { draft: "Em conferência", completed: "Realizada e conferida", missed: "Não realizada" };
export function validFollowupDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function followupToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function fieldCollection(fields: CollectionField[], collection: ClinicalCollection): ClinicalCollection { return { ...collection, fields, records: [], history: [] }; }
export function followupPlanIssues(plan: Pick<ClinicalFollowup, "fields" | "moments">, collection: ClinicalCollection) {
  const issues = schemaIssues({ ...fieldCollection(plan.fields, collection), population: "Seguimento", period: "Momentos do protocolo", inclusion: "Participantes incluídos" });
  if (!validCollection(fieldCollection(plan.fields, collection))) issues.push("Revise os nomes, tipos, definições e limites das variáveis de acompanhamento.");
  if (!plan.fields.length || plan.fields.length > followupLimit.fields) issues.push("Defina de 1 a 20 variáveis de acompanhamento.");
  if (!plan.moments.length || plan.moments.length > followupLimit.moments) issues.push("Defina de 1 a 12 momentos de acompanhamento.");
  if (new Set(plan.moments.map(m => m.key)).size !== plan.moments.length || new Set(plan.moments.map(m => normalize(m.label))).size !== plan.moments.length || new Set(plan.moments.map(m => m.day)).size !== plan.moments.length) issues.push("Os momentos devem ter nomes, códigos e dias distintos.");
  if (plan.moments.some(m => !/^[a-z][a-z0-9_]{0,49}$/.test(m.key) || ["constructor", "prototype"].includes(m.key) || !m.label.trim() || m.label.length > 100 || identifierHeader(m.label) || identifierValue(m.label) || !Number.isInteger(m.day) || m.day < 0 || m.day > 36500)) issues.push("Cada momento precisa de nome sem identificadores e dia inteiro entre 0 e 36.500.");
  return issues;
}
export function visitIssues(plan: ClinicalFollowup, collection: ClinicalCollection, visit: FollowupVisit) {
  const issues: string[] = [];
  if (!collection.records.some(r => r.code === visit.code)) issues.push("Participante não encontrado na coleta.");
  if (!plan.moments.some(m => m.key === visit.momentKey)) issues.push("Momento não encontrado no plano.");
  if (visit.date && !validFollowupDate(visit.date)) issues.push("Informe uma data válida para a visita.");
  if (visit.status === "completed" && !visit.date) issues.push("Informe a data da visita realizada.");
  if (visit.status === "missed" && !missedReasons.includes(visit.reason)) issues.push("Selecione o motivo da visita não realizada.");
  const values = recordIssues({ ...collection, fields: plan.fields, records: [] }, { code: visit.code, status: "pending", reason: "", values: visit.values });
  if (visit.status === "completed") issues.push(...values.map(issue => issue.replace("dado necessário para inclusão ausente", "dado obrigatório da visita ausente")));
  else issues.push(...values.filter(v => v.includes("identificador pessoal")));
  return issues;
}
export function validFollowup(value: unknown, collection?: ClinicalCollection): value is ClinicalFollowup {
  if (!value || typeof value !== "object" || !collection) return false;
  const x = value as ClinicalFollowup;
  if (x.version !== 1 || !Array.isArray(x.fields) || !Array.isArray(x.moments) || x.fields.length > 20 || x.moments.length > 12) return false;
  if (!x.moments.every(m => m && typeof m.key === "string" && typeof m.label === "string" && typeof m.day === "number") || !validCollection(fieldCollection(x.fields, collection)) || followupPlanIssues(x, collection).length) return false;
  const codes = new Set(collection.records.map(r => r.code));
  if (!x.anchors || typeof x.anchors !== "object" || Array.isArray(x.anchors) || Object.entries(x.anchors).some(([code, date]) => !codes.has(code) || !validFollowupDate(date))) return false;
  if (!Array.isArray(x.visits) || x.visits.length > followupLimit.visits) return false;
  const pairs = new Set<string>();
  return x.visits.every(v => {
    if (!v || !codes.has(v.code) || !x.moments.some(m => m.key === v.momentKey) || !["draft", "completed", "missed"].includes(v.status) || typeof v.date !== "string" || typeof v.reason !== "string" || v.reason.length > 200 || identifierValue(v.reason) || (v.status !== "missed" && v.reason !== "") || !v.values || typeof v.values !== "object" || Array.isArray(v.values)) return false;
    const pair = `${v.code}/${v.momentKey}`; if (pairs.has(pair)) return false; pairs.add(pair);
    return Object.entries(v.values).every(([key, raw]) => x.fields.some(f => f.key === key) && typeof raw === "string" && raw.length <= 200 && !identifierValue(raw)) && !visitIssues(x, collection, v).length;
  });
}
export function putVisit(plan: ClinicalFollowup, collection: ClinicalCollection, visit: FollowupVisit) {
  if (collection.records.find(r => r.code === visit.code)?.status !== "included") throw new Error("Inclua e confira o participante na coleta antes de registrar visitas.");
  const existing = plan.visits.some(v => v.code === visit.code && v.momentKey === visit.momentKey);
  if (!existing && plan.visits.length >= followupLimit.visits) throw new Error("Limite de 5.000 visitas registradas por projeto.");
  const next = { ...visit, reason: visit.status === "missed" ? visit.reason : "", values: Object.fromEntries(plan.fields.map(f => [f.key, (Object.hasOwn(visit.values, f.key) ? visit.values[f.key] : "").trim()])) };
  const updated = { ...plan, visits: existing ? plan.visits.map(v => v.code === visit.code && v.momentKey === visit.momentKey ? next : v) : [...plan.visits, next] };
  if (!validFollowup(updated, collection)) throw new Error(visitIssues(updated, collection, next).join(" ") || "Revise a visita e os valores conforme a ficha de acompanhamento.");
  return updated;
}
export function applyFollowupPlan(previous: ClinicalFollowup | undefined, fields: CollectionField[], moments: FollowupMoment[], collection: ClinicalCollection) {
  if (followupPlanIssues({ fields, moments }, collection).length) throw new Error(followupPlanIssues({ fields, moments }, collection).join(" "));
  if (previous?.visits.some(v => !moments.some(m => m.key === v.momentKey))) throw new Error("Não remova momentos com visitas registradas.");
  if (previous?.fields.some(f => !fields.some(n => n.key === f.key) && previous.visits.some(v => Boolean(v.values[f.key])))) throw new Error("Não remova variáveis com valores registrados.");
  const changed = previous && (JSON.stringify(fields) !== JSON.stringify(previous.fields) || JSON.stringify(moments) !== JSON.stringify(previous.moments));
  const next: ClinicalFollowup = { version: 1, fields, moments: [...moments].sort((a,b) => a.day - b.day), anchors: previous?.anchors || {}, visits: (previous?.visits || []).map(v => ({ ...v, status: changed && v.status === "completed" ? "draft" : v.status, values: Object.fromEntries(Object.entries(v.values).filter(([key]) => fields.some(f => f.key === key))) })) };
  if (!validFollowup(next, collection)) throw new Error("Revise o plano de acompanhamento.");
  return next;
}
export function expectedDate(plan: ClinicalFollowup, code: string, day: number) {
  const anchor = Object.hasOwn(plan.anchors, code) ? plan.anchors[code] : "";
  if (!validFollowupDate(anchor)) return "";
  const date = new Date(`${anchor}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + day);
  const result = date.toISOString().slice(0, 10); return validFollowupDate(result) ? result : "";
}
export function followupSchedule(plan: ClinicalFollowup, collection: ClinicalCollection, today = followupToday()) {
  const visits = new Map(plan.visits.map(v => [`${v.code}/${v.momentKey}`, v]));
  return collection.records.filter(r => r.status === "included").flatMap(r => plan.moments.map(moment => {
    const visit = visits.get(`${r.code}/${moment.key}`), expected = expectedDate(plan, r.code, moment.day);
    const state = visit?.status === "completed" ? "Realizada e conferida" : visit?.status === "missed" ? "Não realizada" : visit ? "Em conferência" : !expected ? "Sem data de início" : expected < today ? "Prazo ultrapassado" : expected === today ? "Prevista para hoje" : "Prevista";
    return { code: r.code, moment, visit, expected, state };
  }));
}
export function followupDataset(plan: ClinicalFollowup, collection: ClinicalCollection, momentKey: string): Dataset {
  const included = new Set(collection.records.filter(r => r.status === "included").map(r => r.code));
  return { columns: plan.fields.map(f => f.label), rows: plan.visits.filter(v => included.has(v.code) && v.momentKey === momentKey && v.status === "completed").map(v => plan.fields.map(f => Object.hasOwn(v.values, f.key) ? v.values[f.key] : "")) };
}
const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export function followupSummary(plan: ClinicalFollowup, collection: ClinicalCollection) {
  const schedule = followupSchedule(plan, collection);
  return [["Momento", "Dia previsto", "Participantes incluídos", "Realizadas e conferidas", "Em conferência", "Não realizadas", "Sem registro"], ...plan.moments.map(m => {
    const rows = schedule.filter(r => r.moment.key === m.key);
    return [m.label, m.day, rows.length, rows.filter(r => r.visit?.status === "completed").length, rows.filter(r => r.visit?.status === "draft").length, rows.filter(r => r.visit?.status === "missed").length, rows.filter(r => !r.visit).length];
  })];
}
export function followupProfile(plan: ClinicalFollowup, collection: ClinicalCollection) {
  const datasets = plan.moments.map(m => followupDataset(plan, collection, m.key)), stats = datasets.map(d => describe(d));
  const rows: (string | number)[][] = [["Variável / categoria", ...plan.moments.map(m => `${m.label} (dia ${m.day})`)]];
  plan.fields.forEach((f, i) => {
    rows.push([f.label + (f.unit ? ` (${f.unit})` : ""), ...stats.map(s => `${f.kind === "number" ? `Média ${fmt(s[i].mean)}; DP ${fmt(s[i].sd)}; mediana ${fmt(s[i].median)}` : f.kind === "date" ? "Datas informadas" : "n (% dos valores informados)"} · N válido ${s[i].n}; ausentes ${s[i].missing}`)]);
    if (f.kind === "category") f.options.forEach(option => rows.push([`  ${option}`, ...datasets.map((d, j) => { const n = d.rows.filter(r => r[i] === option).length; return `${n} (${stats[j][i].n ? fmt(100 * n / stats[j][i].n) + "%" : "—"})`; })]));
  });
  return rows;
}
export const followupNote = "Resumo descritivo por momento, apenas de visitas realizadas e conferidas de participantes incluídos. Os participantes com dados podem mudar entre momentos; diferenças entre médias não são estimativas pareadas de mudança nem efeitos do tratamento. Células vazias são ausentes, sem imputação. Visitas em conferência, não realizadas ou sem registro não entram nas medidas. Atraso é relativo ao dia nominal do protocolo, sem janela de tolerância configurada. Esta tabela é descritiva; a comparação pareada de dois momentos, quando configurada, aparece em seção própria.";
export function followupWorkbook(plan: ClinicalFollowup, collection: ClinicalCollection) {
  return [
    { name: "Plano de visitas", rows: [["Momento", "Dias após início"], ...plan.moments.map(m => [m.label, m.day])] },
    { name: "Ficha de visitas", rows: [["Variável", "Tipo", "Unidade", "Definição", "Categorias", "Obrigatória", "Mínimo", "Máximo"], ...plan.fields.map(f => [f.label, f.kind, f.unit, f.definition, f.options.join(" | "), f.required ? "Sim" : "Não", f.minimum ?? "", f.maximum ?? ""])] },
    { name: "Visitas registradas", rows: [["codigo_pesquisa", "situação_participante", "momento", "data_início", "data_prevista", "data_visita", "situação_visita", "motivo", ...plan.fields.map(f => f.label)], ...plan.visits.map(v => { const m = plan.moments.find(m => m.key === v.momentKey)!; return [v.code, collection.records.find(r => r.code === v.code)?.status || "", m.label, Object.hasOwn(plan.anchors,v.code) ? plan.anchors[v.code] : "", expectedDate(plan,v.code,m.day), v.date, visitLabels[v.status], v.reason, ...plan.fields.map(f => v.values[f.key] || "")]; })] },
    { name: "Agenda de acompanhamento", rows: [["codigo_pesquisa", "momento", "data_prevista", "situação"], ...followupSchedule(plan, collection).map(r => [r.code, r.moment.label, r.expected, r.state])] },
    { name: "Seguimento por momento", rows: [...followupSummary(plan, collection), [followupNote]] },
    { name: "Medidas por momento", rows: followupProfile(plan, collection) },
  ];
}

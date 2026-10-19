import { jStat } from "../../vendor/jstat";
import { describe, numeric } from "../results/data";
import type { ClinicalCollection } from "./collection";
import type { ClinicalFollowup } from "./followup";
export type PairedConfig = { fieldKey: string; before: string; after: string; confirmed: boolean };
export function validPaired(value: unknown, plan?: ClinicalFollowup): value is PairedConfig {
  if (!value || typeof value !== "object" || !plan) return false;
  const c = value as PairedConfig, before = plan.moments.find(m => m.key === c.before), after = plan.moments.find(m => m.key === c.after);
  return typeof c.confirmed === "boolean" && plan.fields.some(f => f.key === c.fieldKey && f.kind === "number") && !!before && !!after && after.day > before.day;
}
export function pairedData(collection: ClinicalCollection, plan: ClinicalFollowup, config: PairedConfig) {
  if (!validPaired(config, plan)) throw new Error("Escolha uma medida numérica e dois momentos em ordem temporal.");
  const visits = new Map(plan.visits.map(v => [`${v.code}/${v.momentKey}`, v]));
  const counts = { included: 0, complete: 0, bothVisits: 0, beforeVisit: 0, afterVisit: 0, bothValues: 0, beforeValue: 0, afterValue: 0, chronology: 0 };
  const pairs: { code: string; before: number; after: number; difference: number }[] = [];
  for (const participant of collection.records.filter(r => r.status === "included")) {
    counts.included++;
    const a = visits.get(`${participant.code}/${config.before}`), b = visits.get(`${participant.code}/${config.after}`);
    const readyA = a?.status === "completed", readyB = b?.status === "completed";
    if (!readyA || !readyB) { counts[!readyA && !readyB ? "bothVisits" : !readyA ? "beforeVisit" : "afterVisit"]++; continue; }
    const rawA = (a.values[config.fieldKey] || "").trim(), rawB = (b.values[config.fieldKey] || "").trim();
    if (!rawA || !rawB) { counts[!rawA && !rawB ? "bothValues" : !rawA ? "beforeValue" : "afterValue"]++; continue; }
    const before = numeric(rawA), after = numeric(rawB);
    if (before === null || after === null || !Number.isFinite(after - before)) throw new Error("Há valores numéricos inválidos ou diferenças fora da precisão disponível. Confira a medida nas visitas.");
    if (b.date < a.date) counts.chronology++;
    pairs.push({ code: participant.code, before, after, difference: after - before }); counts.complete++;
  }
  const before = plan.moments.find(m => m.key === config.before)!, after = plan.moments.find(m => m.key === config.after)!, field = plan.fields.find(f => f.key === config.fieldKey)!;
  const dataset = { columns: [before.label, after.label, "Mudança (depois − antes)"], rows: pairs.map(p => [p.before, p.after, p.difference].map(String)) };
  const stats = describe(dataset);
  if (stats.some(s => [s.mean, s.sd, s.median, s.min, s.max].some(v => v !== null && !Number.isFinite(v)))) throw new Error("Os valores excedem a precisão numérica dos resumos. Revise a escala da medida.");
  const rows: (string | number)[][] = [["Medida", "N pareado", "Média", "DP amostral", "Mediana", "Mínimo", "Máximo"], ...stats.map(s => [s.column, s.n, s.mean ?? "—", s.sd ?? "—", s.median ?? "—", s.min ?? "—", s.max ?? "—"])];
  const selection: (string | number)[][] = [["Situação", "Participantes"], ["Incluídos na coleta", counts.included], ["Pares completos", counts.complete], ["Fora por visita ausente, não realizada ou em conferência nos dois momentos", counts.bothVisits], ["Fora por visita anterior ausente, não realizada ou em conferência", counts.beforeVisit], ["Fora por visita posterior ausente, não realizada ou em conferência", counts.afterVisit], ["Fora por medida vazia nos dois momentos com visitas conferidas", counts.bothValues], ["Fora por medida anterior vazia com visitas conferidas", counts.beforeValue], ["Fora por medida posterior vazia com visitas conferidas", counts.afterValue], ["Pares completos com datas reais invertidas · bloqueiam o teste", counts.chronology]];
  return { pairs, counts, stats, rows, selection, field, before, after };
}
export function pairedTest(data: ReturnType<typeof pairedData>, config: PairedConfig) {
  if (!config.confirmed) throw new Error("Confirme o pareamento, a independência entre participantes e os pressupostos das diferenças.");
  if (data.counts.chronology) throw new Error("Há pares com a data real posterior anterior à data real inicial. Confira as datas das visitas antes do teste.");
  const n = data.pairs.length;
  if (n < 3) throw new Error("Esta versão exige pelo menos três pares completos para o teste. Esse mínimo não garante adequação da amostra.");
  const mean = data.stats[2].mean!, sd = data.stats[2].sd!, se = sd / Math.sqrt(n);
  if (![mean, sd, se].every(Number.isFinite) || se <= 0 || sd < 1e-13 * Math.abs(mean)) throw new Error("As diferenças são constantes, quase constantes ou excedem a precisão numérica. O teste e o intervalo foram bloqueados; revise os dados com apoio estatístico.");
  const df = n - 1, statistic = mean / se, critical = jStat.studentt.inv(.975, df), p = Math.max(0, Math.min(1, 2 * jStat.studentt.cdf(-Math.abs(statistic), df))), ci: [number, number] = [mean - critical * se, mean + critical * se];
  if (![statistic, p, ...ci].every(Number.isFinite)) throw new Error("Não foi possível calcular uma estimativa finita. Revise a escala e os dados.");
  return { n, df, statistic, p, mean, sd, ci };
}
export const pairedNote = "Mesmos participantes nos dois momentos, pareados pelo código de pesquisa. Mudança = depois − antes, na unidade original. Os motivos de exclusão são mutuamente exclusivos: primeiro se avalia a situação das visitas, depois os valores ausentes. Não há imputação. A análise de pares completos pode ter viés por perdas. O teste t pareado bilateral pressupõe independência entre participantes e diferenças aproximadamente normais, especialmente em amostras pequenas; revise assimetria e valores extremos das diferenças. Não há ajuste por confundidores nem por comparações múltiplas. Mudança observada não demonstra efeito causal do tratamento.";
export function pairedResultRows(result: ReturnType<typeof pairedTest>): (string | number)[][] {
  return [["Medida", "Valor"], ["Motor", "Scholar paired v1 · jStat 1.9.6"], ["Método", "Teste t pareado · bilateral"], ["Pares completos", result.n], ["Mudança média · depois − antes", result.mean], ["DP amostral das diferenças", result.sd], ["IC95% inferior da mudança média", result.ci[0]], ["IC95% superior da mudança média", result.ci[1]], ["Estatística t", result.statistic], ["Graus de liberdade", result.df], ["Valor de p bilateral", result.p]];
}
export function pairedNarrative(data: ReturnType<typeof pairedData>, result: ReturnType<typeof pairedTest>) {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
  return `Para ${data.field.label}${data.field.unit ? ` (${data.field.unit})` : ""}, foram analisados ${result.n} participantes com pares completos entre ${data.before.label} e ${data.after.label}; ${data.counts.included - result.n} participantes incluídos ficaram fora por visitas ou medidas incompletas. A mudança média (depois − antes) foi ${fmt(result.mean)} (IC95% ${fmt(result.ci[0])} a ${fmt(result.ci[1])}; teste t pareado bilateral, p ${result.p < .0001 ? "< 0,0001" : `= ${fmt(result.p)}`}). Resultado exploratório: revise os pressupostos, as perdas e a relevância clínica. Não permite concluir causalidade.`;
}
export function pairedWorkbook(collection: ClinicalCollection, plan: ClinicalFollowup, config: PairedConfig) {
  const data = pairedData(collection, plan, config);
  const sheets = [{ name: "Seleção dos pares", rows: data.selection }, { name: "Antes e depois", rows: [[`${data.field.label}${data.field.unit ? ` (${data.field.unit})` : ""}`], ...data.rows, [pairedNote]] }];
  try { const result = pairedTest(data, config); sheets.push({ name: "Teste pareado", rows: [...pairedResultRows(result), ["Texto para revisão", pairedNarrative(data, result)]] }); }
  catch (error) { sheets.push({ name: "Teste pareado", rows: [["Teste não calculado", error instanceof Error ? error.message : "Revise os dados."]] }); }
  return sheets;
}

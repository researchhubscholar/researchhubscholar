import type { Locale } from "../i18n/locale";
import { statCopy, statText } from "../i18n/statistics-copy";
import { intlLocale } from "../i18n/format";
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
export function pairedData(collection: ClinicalCollection, plan: ClinicalFollowup, config: PairedConfig, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  if (!validPaired(config, plan)) throw new Error(copy("Escolha uma medida numérica e dois momentos em ordem temporal."));
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
    if (before === null || after === null || !Number.isFinite(after - before)) throw new Error(copy("Há valores numéricos inválidos ou diferenças fora da precisão disponível. Confira a medida nas visitas."));
    if (b.date < a.date) counts.chronology++;
    pairs.push({ code: participant.code, before, after, difference: after - before }); counts.complete++;
  }
  const before = plan.moments.find(m => m.key === config.before)!, after = plan.moments.find(m => m.key === config.after)!, field = plan.fields.find(f => f.key === config.fieldKey)!;
  const dataset = { columns: [before.label, after.label, copy("Mudança (depois − antes)")], rows: pairs.map(p => [p.before, p.after, p.difference].map(String)) };
  const stats = describe(dataset);
  if (stats.some(s => [s.mean, s.sd, s.median, s.min, s.max].some(v => v !== null && !Number.isFinite(v)))) throw new Error(copy("Os valores excedem a precisão numérica dos resumos. Revise a escala da medida."));
  const rows: (string | number)[][] = [["Medida", copy("N pareado"), copy("Média"), copy("DP amostral"), "Mediana", copy("Mínimo"), copy("Máximo")], ...stats.map(s => [s.column, s.n, s.mean ?? "—", s.sd ?? "—", s.median ?? "—", s.min ?? "—", s.max ?? "—"])];
  const selection: (string | number)[][] = [[copy("Situação"), "Participantes"], [copy("Incluídos na coleta"), counts.included], [copy("Pares completos"), counts.complete], [copy("Fora por visita ausente, não realizada ou em conferência nos dois momentos"), counts.bothVisits], [copy("Fora por visita anterior ausente, não realizada ou em conferência"), counts.beforeVisit], [copy("Fora por visita posterior ausente, não realizada ou em conferência"), counts.afterVisit], [copy("Fora por medida vazia nos dois momentos com visitas conferidas"), counts.bothValues], [copy("Fora por medida anterior vazia com visitas conferidas"), counts.beforeValue], [copy("Fora por medida posterior vazia com visitas conferidas"), counts.afterValue], [copy("Pares completos com datas reais invertidas · bloqueiam o teste"), counts.chronology]];
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
export function pairedResultRows(result: ReturnType<typeof pairedTest>, locale:Locale="pt-BR"): (string | number)[][] {
const copy=(source:string)=>statCopy(locale,source);
  return [["Medida", "Valor"], ["Motor", copy("Scholar paired v1 · jStat 1.9.6")], [copy("Método"), copy("Teste t pareado · bilateral")], [copy("Pares completos"), result.n], [copy("Mudança média · depois − antes"), result.mean], [copy("DP amostral das diferenças"), result.sd], [copy("IC95% inferior da mudança média"), result.ci[0]], [copy("IC95% superior da mudança média"), result.ci[1]], [copy("Estatística t"), result.statistic], [copy("Graus de liberdade"), result.df], [copy("Valor de p bilateral"), result.p]];
}
export function pairedNarrative(data: ReturnType<typeof pairedData>, result: ReturnType<typeof pairedTest>, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  const fmt = (n: number) => n.toLocaleString(intlLocale(locale), { maximumSignificantDigits: 4 });
  return statText(locale,"Para {0}{1}, foram analisados {2} participantes com pares completos entre {3} e {4}; {5} participantes incluídos ficaram fora por visitas ou medidas incompletas. A mudança média (depois − antes) foi {6} (IC95% {7} a {8}; teste t pareado bilateral, p {9}). Resultado exploratório: revise os pressupostos, as perdas e a relevância clínica. Não permite concluir causalidade.",data.field.label,data.field.unit ? ` (${data.field.unit})` : "",result.n,data.before.label,data.after.label,data.counts.included - result.n,fmt(result.mean),fmt(result.ci[0]),fmt(result.ci[1]),result.p < .0001 ? copy("< 0,0001") : `= ${fmt(result.p)}`);
}
export function pairedWorkbook(collection: ClinicalCollection, plan: ClinicalFollowup, config: PairedConfig, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
  const data = pairedData(collection,plan,config,locale);
  const sheets = [{ name: copy("Seleção dos pares"), rows: data.selection }, { name: copy("Antes e depois"), rows: [[`${data.field.label}${data.field.unit ? ` (${data.field.unit})` : ""}`], ...data.rows, [copy(pairedNote)]] }];
  try { const result = pairedTest(data, config); sheets.push({ name: copy("Teste pareado"), rows: [...pairedResultRows(result,locale), [copy("Texto para revisão"), pairedNarrative(data,result,locale)]] }); }
  catch (error) { sheets.push({ name: copy("Teste pareado"), rows: [[copy("Teste não calculado"), error instanceof Error ? copy(error.message) : copy("Revise os dados.")]] }); }
  return sheets;
}

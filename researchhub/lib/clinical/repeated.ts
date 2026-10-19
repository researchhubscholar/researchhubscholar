import { jStat } from "../../vendor/jstat";
import { describe, numeric } from "../results/data";
import type { ClinicalCollection } from "./collection";
import type { ClinicalFollowup } from "./followup";
export type RepeatedConfig = { fieldKey: string; moments: string[]; confirmed: boolean };
export function validRepeated(value: unknown, plan?: ClinicalFollowup): value is RepeatedConfig {
  if (!value || typeof value !== "object" || !plan) return false;
  const c = value as RepeatedConfig;
  return typeof c.confirmed === "boolean" && plan.fields.some(f => f.key === c.fieldKey && f.kind === "number") && Array.isArray(c.moments) && c.moments.length >= 3 && c.moments.length <= 12 && new Set(c.moments).size === c.moments.length && c.moments.every((key,i) => typeof key === "string" && plan.moments.some(m => m.key === key) && (i === 0 || plan.moments.find(m => m.key === key)!.day > plan.moments.find(m => m.key === c.moments[i-1])!.day));
}
export function repeatedData(collection: ClinicalCollection, plan: ClinicalFollowup, config: RepeatedConfig) {
  if (!validRepeated(config, plan)) throw new Error("Escolha uma medida numérica e de três a doze momentos distintos em ordem temporal.");
  const moments = config.moments.map(key => plan.moments.find(m => m.key === key)!);
  const field = plan.fields.find(f => f.key === config.fieldKey)!;
  const visits = new Map(plan.visits.map(v => [`${v.code}/${v.momentKey}`, v]));
  const counts = { included: 0, complete: 0, incompleteVisits: 0, missingValues: 0, chronology: 0 };
  const missing = moments.map(m => ({ label: m.label, visits: 0, values: 0 }));
  const subjects: { code: string; values: number[]; inverted: boolean }[] = [];
  for (const participant of collection.records.filter(r => r.status === "included")) {
    counts.included++;
    const records = moments.map((m,i) => {
      const v = visits.get(`${participant.code}/${m.key}`);
      if (v?.status !== "completed") missing[i].visits++;
      else if (!(v.values[field.key] || "").trim()) missing[i].values++;
      return v;
    });
    if (records.some(v => v?.status !== "completed")) { counts.incompleteVisits++; continue; }
    const raw = records.map(v => (v!.values[field.key] || "").trim());
    if (raw.some(v => !v)) { counts.missingValues++; continue; }
    const values = raw.map(numeric);
    if (values.some(v => v === null)) throw new Error("Há valores não numéricos na medida. Confira as visitas antes da análise.");
    const inverted = records.some((v,i) => i > 0 && v!.date < records[i-1]!.date);
    if (inverted) counts.chronology++;
    subjects.push({ code: participant.code, values: values as number[], inverted }); counts.complete++;
  }
  const stats = describe({ columns: moments.map(m=>m.label), rows: subjects.map(s=>s.values.map(String)) });
  if (stats.some(s=>[s.mean,s.sd,s.median,s.min,s.max].some(v=>v!==null&&!Number.isFinite(v)))) throw new Error("Os valores excedem a precisão numérica dos resumos. Revise a escala da medida.");
  const rows: (string | number)[][] = [["Momento", "N completo", "Média", "DP amostral", "Mediana", "Mínimo", "Máximo"], ...stats.map(s=>[s.column,s.n,s.mean??"—",s.sd??"—",s.median??"—",s.min??"—",s.max??"—"])];
  const selection: (string | number)[][] = [["Situação", "Participantes"], ["Incluídos na coleta",counts.included], ["Dados completos em todos os momentos selecionados",counts.complete], ["Fora por pelo menos uma visita ausente, não realizada ou em conferência",counts.incompleteVisits], ["Fora por medida vazia, com todas as visitas conferidas",counts.missingValues], ["Completos com datas reais invertidas · bloqueiam o teste",counts.chronology]];
  const missingRows: (string | number)[][] = [["Momento", "Visita ausente / não realizada / em conferência", "Medida vazia em visita conferida"], ...missing.map(m=>[m.label,m.visits,m.values])];
  return { subjects,counts,field,moments,stats,rows,selection,missingRows };
}
export function repeatedTest(data: ReturnType<typeof repeatedData>, config: RepeatedConfig) {
  if (!config.confirmed) throw new Error("Confirme o vínculo entre medidas, a escala, a independência entre participantes e os pressupostos da ANOVA de medidas repetidas.");
  if (data.counts.chronology) throw new Error("Há participantes completos com datas reais invertidas. Confira as datas das visitas antes do teste.");
  const n=data.subjects.length,k=data.moments.length;
  if (n <= k) throw new Error(`Esta versão exige ao menos ${k+1} participantes completos para ${k} momentos. Esse limite operacional não garante adequação estatística ou poder.`);
  // Within-subject centering removes subject offsets. Scaling keeps squared sums finite.
  const centered=data.subjects.map(s=>{const differences=s.values.map(v=>v-s.values[0]);const mean=differences.reduce((a,b)=>a+b,0)/k;return differences.map(v=>v-mean);});
  const scale=Math.max(...centered.flat().map(Math.abs));
  if (!Number.isFinite(scale)||scale===0||centered.some(row=>row.some(v=>!Number.isFinite(v)))) throw new Error("Não há variação dentro dos participantes ou os valores excedem a precisão numérica.");
  const matrix=centered.map(row=>row.map(v=>v/scale));
  const means=Array.from({length:k},(_,j)=>matrix.reduce((sum,row)=>sum+row[j],0)/n);
  const effect=n*means.reduce((sum,v)=>sum+v*v,0);
  const residuals=matrix.map(row=>row.map((v,j)=>v-means[j]));
  const error=residuals.reduce((sum,row)=>sum+row.reduce((s,v)=>s+v*v,0),0);
  if (!Number.isFinite(error)||error<=1e-14*(effect+error)) throw new Error("A variabilidade residual é nula ou pequena demais para uma inferência confiável. O teste foi bloqueado; confira os dados com apoio estatístico.");
  const covariance=Array.from({length:k},(_,a)=>Array.from({length:k},(_,b)=>residuals.reduce((sum,row)=>sum+row[a]*row[b],0)/(n-1)));
  const trace=covariance.reduce((sum,row,i)=>sum+row[i],0),squares=covariance.reduce((sum,row)=>sum+row.reduce((s,v)=>s+v*v,0),0);
  const rawEpsilon=trace*trace/((k-1)*squares);
  if (!Number.isFinite(rawEpsilon)||rawEpsilon<1/(k-1)-1e-8||rawEpsilon>1+1e-8) throw new Error("Não foi possível estimar a correção de esfericidade com precisão. Revise a escala e os dados.");
  const epsilon=Math.max(1/(k-1),Math.min(1,rawEpsilon));
  const df1=k-1,df2=(n-1)*(k-1),f=(effect/df1)/(error/df2),correctedDf1=df1*epsilon,correctedDf2=df2*epsilon;
  // F survival through the regularized beta avoids subtracting a CDF near one.
  const p=Math.max(0,Math.min(1,jStat.ibeta(correctedDf2/(correctedDf2+correctedDf1*f),correctedDf2/2,correctedDf1/2)));
  const etaPartial=effect/(effect+error);
  if (![f,p,epsilon,correctedDf1,correctedDf2,etaPartial].every(Number.isFinite)) throw new Error("A inferência excedeu a precisão numérica disponível. Confira os dados.");
  return {n,k,f,p,epsilon,df1,df2,correctedDf1,correctedDf2,etaPartial};
}
export const repeatedNote="ANOVA de medidas repetidas de um fator (momento), com correção de Greenhouse–Geisser aplicada sempre. Usa os mesmos participantes com dados completos em todos os momentos selecionados, vinculados pelo código, sem imputação. Perdas podem enviesar a análise. Exige escala comparável, independência entre participantes e adequação da normalidade dos contrastes/resíduos e dos valores extremos. A correção de esfericidade não corrige não normalidade, confundimento ou comparações múltiplas. O teste global não identifica quais momentos diferem, não modela intervalos reais entre consultas e não demonstra causalidade. Não há comparações pós-teste automáticas, modelos mistos ou ajuste por covariáveis nesta etapa.";
export function repeatedResultRows(r: ReturnType<typeof repeatedTest>): (string|number)[][] {return [["Medida","Valor"],["Motor","Scholar repeated v1 · jStat 1.9.6"],["Método","ANOVA de medidas repetidas · um fator · Greenhouse–Geisser"],["Participantes completos",r.n],["Momentos",r.k],["Estatística F",r.f],["Epsilon Greenhouse–Geisser",r.epsilon],["GL numerador original",r.df1],["GL denominador original",r.df2],["GL numerador corrigido",r.correctedDf1],["GL denominador corrigido",r.correctedDf2],["Valor de p global corrigido · GG",r.p],["Eta-quadrado parcial",r.etaPartial],["IC do tamanho de efeito","Não disponível nesta versão"]];}
export function repeatedNarrative(data: ReturnType<typeof repeatedData>, r: ReturnType<typeof repeatedTest>) {const fmt=(v:number)=>v.toLocaleString("pt-BR",{maximumSignificantDigits:4});return `Para ${data.field.label}${data.field.unit?` (${data.field.unit})`:""}, a análise incluiu ${r.n} participantes com dados completos nos ${r.k} momentos (${data.moments.map(m=>m.label).join(", ")}); ${data.counts.included-r.n} incluídos ficaram fora por visitas ou medidas incompletas. A ANOVA de medidas repetidas com correção de Greenhouse–Geisser apresentou F(${fmt(r.correctedDf1)}, ${fmt(r.correctedDf2)}) = ${fmt(r.f)}, p ${r.p<.0001?"< 0,0001":`= ${fmt(r.p)}`}, epsilon = ${fmt(r.epsilon)} e eta-quadrado parcial = ${fmt(r.etaPartial)}. O teste é global e não identifica quais momentos diferem. Revise pressupostos, perdas e relevância clínica; não permite concluir efeito causal do tratamento.`;}
export function repeatedWorkbook(collection: ClinicalCollection,plan: ClinicalFollowup,config: RepeatedConfig){const data=repeatedData(collection,plan,config);const sheets=[{name:"Seleção medidas repetidas",rows:data.selection},{name:"Ausências por momento",rows:[...data.missingRows,["Contagens por momento podem se sobrepor entre participantes; não somar para obter exclusões."]]},{name:"Resumo casos completos",rows:[[data.field.label+(data.field.unit?` (${data.field.unit})`:"")],...data.rows,[repeatedNote]]}];try{const r=repeatedTest(data,config);sheets.push({name:"ANOVA medidas repetidas",rows:[...repeatedResultRows(r),["Texto para revisão",repeatedNarrative(data,r)]]});}catch(e){sheets.push({name:"ANOVA medidas repetidas",rows:[["Teste não calculado",e instanceof Error?e.message:"Revise os dados."]]});}return sheets;}

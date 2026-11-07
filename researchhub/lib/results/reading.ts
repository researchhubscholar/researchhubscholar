import { analysisEffect } from "./inference";
import { intlLocale } from "../i18n/format";
import type { Locale } from "../i18n/locale";
import { statCopy, statText } from "../i18n/statistics-copy";
import type { AnalysisConfig, AnalysisResult } from "./inference";
import type { pairedData, pairedTest } from "../clinical/paired";
import type { repeatedData, repeatedTest } from "../clinical/repeated";
import type { adjustedData, fitAdjusted } from "../clinical/adjusted";
export type Reading = { summary: string; facts: { label: string; value: string }[]; caution: string; coefficients?: { label: string; value: string }[] };
export const readingNumber = (n:number,locale:Locale="pt-BR")=>n.toLocaleString(intlLocale(locale),{maximumSignificantDigits:4});
const interval=(ci:[number,number],locale:Locale)=>statText(locale,"{0} a {1}",readingNumber(ci[0],locale),readingNumber(ci[1],locale));
const pValue=(p:number,locale:Locale)=>p<.0001?statCopy(locale,"< 0,0001"):readingNumber(p,locale);
const missing=(n:number,excluded:number,locale:Locale)=>[{label:statCopy(locale,"Dados utilizados"),value:statText(locale,"{0} participantes ou observações completas",n)},{label:statCopy(locale,"Fora desta análise"),value:statText(locale,"{0} por dados incompletos",excluded)}];
export function generalReading(r: AnalysisResult, kind: AnalysisConfig["kind"], locale:Locale="pt-BR"): Reading {
const copy=(source:string)=>statCopy(locale,source);
 const direction = r.estimate > 0 ? copy("positiva") : r.estimate < 0 ? copy("negativa") : copy("igual a zero");
 const summary = kind === "welch" ? statText(locale,"A diferença média estimada em {0} foi {1}. O sentido da subtração está indicado abaixo; um valor negativo significa que a média do primeiro grupo foi menor.",r.columns[0],readingNumber(r.estimate,locale)) : kind === "pearson" ? statText(locale,"A relação linear observada entre {0} foi {1} (r = {2}). O coeficiente descreve como as medidas variam juntas nesta base.",r.columns.join(copy(" e ")),direction,readingNumber(r.estimate,locale)) : statText(locale,"Foi examinada a associação entre {0}. O V de Cramér observado foi {1}; ele descreve a intensidade da associação, sem indicar uma direção de aumento ou redução.",r.columns.join(copy(" e ")),readingNumber(r.estimate,locale));
 return {summary,facts:[...missing(r.n,r.excluded,locale),{label:analysisEffect(r,locale),value:readingNumber(r.estimate,locale)},...(r.ci?[{label:copy("Intervalo de confiança de 95%"),value:interval(r.ci,locale)}]:[{label:copy("Intervalo de confiança do efeito"),value:copy("Não disponível nesta versão")}]),{label:copy("Valor de p"),value:pValue(r.p,locale)}],caution:copy("Leia a estimativa, sua incerteza e o contexto do estudo em conjunto. O valor de p não mede importância clínica; associação ou diferença observada não estabelece causa e efeito.")};
}
export function pairedReading(d: ReturnType<typeof pairedData>, r: ReturnType<typeof pairedTest>, locale:Locale="pt-BR"): Reading {
const copy=(source:string)=>statCopy(locale,source);
 const change = r.mean > 0 ? copy("aumentou") : r.mean < 0 ? copy("diminuiu") : copy("teve mudança média igual a zero");
 return {summary:statText(locale,"Entre {0} e {1}, {2} {3}{4}. A comparação usa as mesmas pessoas nos dois momentos.",d.before.label,d.after.label,d.field.label,change,r.mean===0?"":statText(locale," em média {0}{1}",readingNumber(Math.abs(r.mean),locale),d.field.unit?` ${d.field.unit}`:"")),facts:[...missing(r.n,d.counts.included-r.n,locale),{label:copy("Mudança média · depois menos antes"),value:readingNumber(r.mean,locale)+(d.field.unit?` ${d.field.unit}`:"")},{label:copy("Intervalo de confiança de 95% da mudança"),value:interval(r.ci,locale)},{label:copy("Valor de p"),value:pValue(r.p,locale)}],caution:copy("Aumento ou redução da medida não significa automaticamente melhora. A mudança observada não demonstra que o tratamento a causou.")};
}
export function repeatedReading(d: ReturnType<typeof repeatedData>, r: ReturnType<typeof repeatedTest>, locale:Locale="pt-BR"): Reading {
const copy=(source:string)=>statCopy(locale,source);
 return {summary:statText(locale,"A análise compara globalmente {0} entre {1}, usando as mesmas {2} pessoas em todos os momentos.",d.field.label,d.moments.map(m=>m.label).join(", "),r.n),facts:[...missing(r.n,d.counts.included-r.n,locale),{label:copy("Momentos comparados"),value:String(r.k)},{label:copy("Valor de p da comparação global · corrigido"),value:pValue(r.p,locale)}],caution:copy("O teste global não identifica quais momentos diferem nem demonstra uma evolução contínua ou um efeito do tratamento. Confira as médias e as perdas; comparações específicas exigem planejamento próprio.")};
}
export function adjustedReading(d: ReturnType<typeof adjustedData>, r: ReturnType<typeof fitAdjusted>, locale:Locale="pt-BR"): Reading {
const copy=(source:string)=>statCopy(locale,source);
 return {summary:statText(locale,"Foram estimadas diferenças em {0}, considerando em conjunto {1}. Cada estimativa abaixo mantém constantes as demais características do modelo.",d.outcome.label,d.predictors.map(p=>p.field.label).join(", ")),facts:missing(r.n,d.counts.included-r.n,locale),coefficients:r.coefficients.slice(1).map(c=>({label:c.label,value:statText(locale,"{0}{1} · IC95% {2}",readingNumber(c.estimate,locale),d.outcome.unit?` ${d.outcome.unit}`:"",interval(c.ci,locale))})),caution:copy("Coeficiente positivo indica valor estimado maior; negativo, menor. Para números, a diferença é por 1 unidade; para categorias, em relação ao grupo de referência. Associação ajustada não estabelece causalidade ou previsão clínica validada.")};
}

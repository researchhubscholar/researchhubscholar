import type { AnalysisConfig, AnalysisResult } from "./inference";
import type { pairedData, pairedTest } from "../clinical/paired";
import type { repeatedData, repeatedTest } from "../clinical/repeated";
import type { adjustedData, fitAdjusted } from "../clinical/adjusted";
export type Reading = { summary: string; facts: { label: string; value: string }[]; caution: string; coefficients?: { label: string; value: string }[] };
export const readingNumber = (n: number) => n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
const interval = (ci: [number, number]) => `${readingNumber(ci[0])} a ${readingNumber(ci[1])}`;
const pValue = (p: number) => p < .0001 ? "< 0,0001" : readingNumber(p);
const missing = (n: number, excluded: number) => [{label:"Dados utilizados",value:`${n} participantes ou observações completas`},{label:"Fora desta análise",value:`${excluded} por dados incompletos`}];
export function generalReading(r: AnalysisResult, kind: AnalysisConfig["kind"]): Reading {
 const direction = r.estimate > 0 ? "positiva" : r.estimate < 0 ? "negativa" : "igual a zero";
 const summary = kind === "welch" ? `A diferença média estimada em ${r.columns[0]} foi ${readingNumber(r.estimate)}. O sentido da subtração está indicado abaixo; um valor negativo significa que a média do primeiro grupo foi menor.` : kind === "pearson" ? `A relação linear observada entre ${r.columns.join(" e ")} foi ${direction} (r = ${readingNumber(r.estimate)}). O coeficiente descreve como as medidas variam juntas nesta base.` : `Foi examinada a associação entre ${r.columns.join(" e ")}. O V de Cramér observado foi ${readingNumber(r.estimate)}; ele descreve a intensidade da associação, sem indicar uma direção de aumento ou redução.`;
 return {summary,facts:[...missing(r.n,r.excluded),{label:r.effect,value:readingNumber(r.estimate)},...(r.ci?[{label:"Intervalo de confiança de 95%",value:interval(r.ci)}]:[{label:"Intervalo de confiança do efeito",value:"Não disponível nesta versão"}]),{label:"Valor de p",value:pValue(r.p)}],caution:"Leia a estimativa, sua incerteza e o contexto do estudo em conjunto. O valor de p não mede importância clínica; associação ou diferença observada não estabelece causa e efeito."};
}
export function pairedReading(d: ReturnType<typeof pairedData>, r: ReturnType<typeof pairedTest>): Reading {
 const change = r.mean > 0 ? "aumentou" : r.mean < 0 ? "diminuiu" : "teve mudança média igual a zero";
 return {summary:`Entre ${d.before.label} e ${d.after.label}, ${d.field.label} ${change}${r.mean===0?"":` em média ${readingNumber(Math.abs(r.mean))}${d.field.unit?` ${d.field.unit}`:""}`}. A comparação usa as mesmas pessoas nos dois momentos.`,facts:[...missing(r.n,d.counts.included-r.n),{label:"Mudança média · depois menos antes",value:readingNumber(r.mean)+(d.field.unit?` ${d.field.unit}`:"")},{label:"Intervalo de confiança de 95% da mudança",value:interval(r.ci)},{label:"Valor de p",value:pValue(r.p)}],caution:"Aumento ou redução da medida não significa automaticamente melhora. A mudança observada não demonstra que o tratamento a causou."};
}
export function repeatedReading(d: ReturnType<typeof repeatedData>, r: ReturnType<typeof repeatedTest>): Reading {
 return {summary:`A análise compara globalmente ${d.field.label} entre ${d.moments.map(m=>m.label).join(", ")}, usando as mesmas ${r.n} pessoas em todos os momentos.`,facts:[...missing(r.n,d.counts.included-r.n),{label:"Momentos comparados",value:String(r.k)},{label:"Valor de p da comparação global · corrigido",value:pValue(r.p)}],caution:"O teste global não identifica quais momentos diferem nem demonstra uma evolução contínua ou um efeito do tratamento. Confira as médias e as perdas; comparações específicas exigem planejamento próprio."};
}
export function adjustedReading(d: ReturnType<typeof adjustedData>, r: ReturnType<typeof fitAdjusted>): Reading {
 return {summary:`Foram estimadas diferenças em ${d.outcome.label}, considerando em conjunto ${d.predictors.map(p=>p.field.label).join(", ")}. Cada estimativa abaixo mantém constantes as demais características do modelo.`,facts:missing(r.n,d.counts.included-r.n),coefficients:r.coefficients.slice(1).map(c=>({label:c.label,value:`${readingNumber(c.estimate)}${d.outcome.unit?` ${d.outcome.unit}`:""} · IC95% ${interval(c.ci)}`})),caution:"Coeficiente positivo indica valor estimado maior; negativo, menor. Para números, a diferença é por 1 unidade; para categorias, em relação ao grupo de referência. Associação ajustada não estabelece causalidade ou previsão clínica validada."};
}

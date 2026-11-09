import { validateExcerpt,type GuideExcerpt } from "./guide-excerpt";
import { sourceIds } from "./guide-sources";
import { validGuideArea, type GuideArea } from "./areas";
import type { ResultsWorkspace } from "../results/data";
import { workspaceReadings } from "../results/review";
import { identifierHeader, identifierValue } from "../clinical/collection";
export const guideStages=["Preparar a coleta","Adicionar e conferir dados","Responder à pergunta","Revisar e usar resultados"] as const;
export const guideQuestions=["","profile","groups","paired","repeated","adjusted","general"] as const;
export type GuideSnapshot={collection:boolean;records:number;included:number;pending:number;excluded:number;rows:number;fields:{label:string;kind:string}[];visits:{moments:number;completed:number;pending:number;missed:number};analyses:{title:string;status:"ready"|"pending"}[]};
export type DescriptiveRow={column:string;n:number;missing:number;mean:number|null;median:number|null;sd:number|null};
export type GuideInput={message:string;stage:number;question:string;dirty:boolean;draft:GuideSnapshot;area?:GuideArea;sourceIds?:string[];excerpt?:GuideExcerpt;descriptive?:DescriptiveRow[]};
export function guideText(value:unknown,max=600){return typeof value==="string"&&!identifierValue(value)?value.trim().slice(0,max):"";}
export function guideSnapshot(w:ResultsWorkspace):GuideSnapshot {
 const c=w.collection,records=c?.records||[],visits=w.followup?.visits||[];
 return {collection:Boolean(c),records:records.length,included:records.filter(r=>r.status==="included").length,pending:records.filter(r=>r.status==="pending").length,excluded:records.filter(r=>r.status==="excluded").length,rows:w.dataset.rows.length,
 fields:(c?c.fields.map(f=>({label:f.label,kind:f.kind})):w.dataset.columns.map(label=>({label,kind:"a conferir"}))).filter(f=>!identifierHeader(f.label)&&guideText(f.label)).slice(0,80).map(f=>({label:guideText(f.label,100),kind:f.kind})),
 visits:{moments:w.followup?.moments.length||0,completed:visits.filter(v=>v.status==="completed").length,pending:visits.filter(v=>v.status==="draft").length,missed:visits.filter(v=>v.status==="missed").length},
 analyses:workspaceReadings(w).map(r=>({title:r.title,status:r.reading?"ready":"pending"}))};
}
function count(v:unknown){if(!Number.isSafeInteger(v)||Number(v)<0||Number(v)>10000)throw Error("Resumo de dados inválido. Atualize a página e tente novamente.");return Number(v);}
export function validateGuideInput(value:unknown):GuideInput {
 if(!value||typeof value!=="object")throw Error("Envie sua pergunta ao assistente.");const v=value as Record<string,unknown>;
 if(typeof v.message!=="string"||!v.message.trim()||v.message.length>1200)throw Error("Escreva uma pergunta de até 1.200 caracteres.");
 if(identifierValue(v.message)||/\b\d{11}\b/.test(v.message))throw Error("Remova identificadores pessoais da mensagem. Descreva apenas a dúvida sobre o estudo.");
 if(!Number.isInteger(v.stage)||Number(v.stage)<0||Number(v.stage)>3||!guideQuestions.includes(v.question as typeof guideQuestions[number])||typeof v.dirty!=="boolean")throw Error("Etapa do projeto inválida. Atualize a página.");
 const d=v.draft as GuideSnapshot;if(!d||typeof d!=="object"||typeof d.collection!=="boolean"||!d.visits||!Array.isArray(d.fields)||d.fields.length>80||!Array.isArray(d.analyses)||d.analyses.length>5)throw Error("Resumo do projeto inválido.");
 const fields=d.fields.map(f=>{if(!f||typeof f.label!=="string"||f.label.length>100||!["number","category","date","a conferir"].includes(f.kind))throw Error("Definição de campo inválida.");return{label:guideText(f.label,100),kind:f.kind};}).filter(f=>f.label&&!identifierHeader(f.label));
 const analyses=d.analyses.map(a=>{if(!a||!["ready","pending"].includes(a.status)||typeof a.title!=="string")throw Error("Resumo de análise inválido.");return{title:guideText(a.title,80),status:a.status};});
 if(v.area!==undefined&&!validGuideArea(v.area))throw Error("Área do assistente inválida.");
 const excerpt=validateExcerpt(v.excerpt);
 if(excerpt&&!["protocolo","manuscrito"].includes(String(v.area)))throw Error("Selecione trechos no Protocolo ou no Manuscrito.");
 const selectedSources=sourceIds(v.sourceIds);
 if(selectedSources.length&&v.area!=="biblioteca")throw Error("Selecione fontes na Biblioteca para esta conversa.");
 let descriptive:DescriptiveRow[]|undefined;
 if(v.descriptive!==undefined){
  if(v.area!=="resultados"||excerpt||!Array.isArray(v.descriptive)||!v.descriptive.length||v.descriptive.length>40)throw Error("Tabela descritiva inválida.");
  const metric=(value:unknown)=>{if(value===null)return null;if(typeof value!=="number"||!Number.isFinite(value))throw Error("Indicador descritivo inválido.");return value;};
  descriptive=v.descriptive.map(row=>{
   const column=guideText(row?.column,100);
   if(!column||identifierHeader(column))return null;
   const n=count(row.n),missing=count(row.missing);
   if(n+missing!==d.rows)throw Error("As contagens não correspondem à tabela descritiva.");
   return {column,n,missing,mean:metric(row.mean),median:metric(row.median),sd:metric(row.sd)};
  }).filter((row):row is DescriptiveRow=>row!==null);
  if(!descriptive.length)throw Error("Nenhuma variável disponível para interpretar.");
 }
 return {descriptive,...(excerpt?{excerpt}:{}),sourceIds:selectedSources,...(v.area?{area:v.area as GuideArea}:{}),message:v.message.trim(),stage:Number(v.stage),question:String(v.question),dirty:v.dirty,draft:{collection:d.collection,records:count(d.records),included:count(d.included),pending:count(d.pending),excluded:count(d.excluded),rows:count(d.rows),fields,visits:{moments:count(d.visits.moments),completed:count(d.visits.completed),pending:count(d.visits.pending),missed:count(d.visits.missed)},analyses}};
}

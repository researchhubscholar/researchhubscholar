import { identifierHeader } from "../clinical/collection";
import type { Locale } from "../i18n/locale";
import { describe, type ResultsWorkspace } from "./data";
import { workspaceReadings } from "./review";
function canonical(value: unknown): unknown {
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function descriptiveDraft(w:ResultsWorkspace,locale:Locale){
 if(!w.dataset.rows.length)return "";
 const es=locale==="es";
 const number=new Intl.NumberFormat(es?"es":"pt-BR",{maximumFractionDigits:3});
 const rows=describe(w.dataset).filter(row=>row.mean!==null&&!identifierHeader(row.column)).slice(0,12);
 return [es?`La tabla contiene ${w.dataset.rows.length} registros.`:`A tabela contém ${w.dataset.rows.length} registros.`,...rows.map(row=>`${row.column.replaceAll("_"," ")}: ${es?"media":"média"} ${number.format(row.mean!)} (n = ${row.n}).`)].join("\n");
}
export function resultsStamp(w:ResultsWorkspace){let a=2166136261,b=5381;for(const c of JSON.stringify(canonical(w))){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return `${a>>>0}-${b>>>0}`;}
export type ResultsTransfer={text:string;stamp:string;project:string};
export function validTransfer(v:unknown,project:string):v is ResultsTransfer{const x=v as ResultsTransfer;return Boolean(x&&x.project===project&&typeof x.text==='string'&&x.text.trim()&&x.text.length<=50000&&typeof x.stamp==='string'&&/^\d+-\d+$/.test(x.stamp));}
export function appendResults(original:string,text:string){if(!text.trim())throw Error('Revise o texto antes de adicionar.');if(original.includes(text.trim()))throw Error('Este texto já está na seção Resultados.');return [original,text.trim()].filter(Boolean).join('\n\n');}
export function lastResultsStamp(versions:{snapshot:unknown}[]){for(const v of versions){const s=v.snapshot as {resultsSource?:unknown};if(s&&typeof s.resultsSource==='string')return s.resultsSource;}return '';}
export function resultsChecklist(w:ResultsWorkspace|null,dirty:boolean,source:string){return [...(dirty?['O manuscrito tem alterações ainda não salvas.']:[]),...(w?workspaceReadings(w).filter(r=>!r.reading).map(r=>`Análise pendente: ${r.title}.`):['Não há resultados salvos disponíveis.']),...(w&&source&&source!==resultsStamp(w)?['Os resultados salvos mudaram desde a última transferência. Revise o texto do manuscrito.']:[])];}

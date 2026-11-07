import type { ResultsWorkspace } from "./data";
import { workspaceReadings } from "./review";
export function resultsStamp(w:ResultsWorkspace){let a=2166136261,b=5381;for(const c of JSON.stringify(w)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return `${a>>>0}-${b>>>0}`;}
export type ResultsTransfer={text:string;stamp:string;project:string};
export function validTransfer(v:unknown,project:string):v is ResultsTransfer{const x=v as ResultsTransfer;return Boolean(x&&x.project===project&&typeof x.text==='string'&&x.text.trim()&&x.text.length<=50000&&typeof x.stamp==='string'&&/^\d+-\d+$/.test(x.stamp));}
export function appendResults(original:string,text:string){if(!text.trim())throw Error('Revise o texto antes de adicionar.');if(original.includes(text.trim()))throw Error('Este texto já está na seção Resultados.');return [original,text.trim()].filter(Boolean).join('\n\n');}
export function lastResultsStamp(versions:{snapshot:unknown}[]){for(const v of versions){const s=v.snapshot as {resultsSource?:unknown};if(s&&typeof s.resultsSource==='string')return s.resultsSource;}return '';}
export function resultsChecklist(w:ResultsWorkspace|null,dirty:boolean,source:string){return [...(dirty?['O manuscrito tem alterações ainda não salvas.']:[]),...(w?workspaceReadings(w).filter(r=>!r.reading).map(r=>`Análise pendente: ${r.title}.`):['Não há resultados salvos disponíveis.']),...(w&&source&&source!==resultsStamp(w)?['Os resultados salvos mudaram desde a última transferência. Revise o texto do manuscrito.']:[])];}

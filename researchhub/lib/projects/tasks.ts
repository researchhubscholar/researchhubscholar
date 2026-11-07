import { identifierValue } from "../clinical/collection";
export type ProjectTask={id:string;project_id:string;title:string;detail:string;status:"open"|"done";due_date:string|null;source_usage_id:string|null;source_index:number|null;updated_at:string;created_at:string};
export type TaskDraft={title:string;detail:string;dueDate:string;sourceUsageId?:string;sourceIndex?:number};
export const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validateTask(v:unknown){
 if(!v||typeof v!=="object")throw Error("Confira a tarefa.");const b=v as Record<string,unknown>;
 if(!uuid(b.id)||!uuid(b.project)||typeof b.title!=="string"||b.title.trim().length<2||b.title.length>160||typeof b.detail!=="string"||b.detail.length>2000||identifierValue(b.title)||identifierValue(b.detail)||/\b\d{11}\b/.test(b.title+" "+b.detail))throw Error("Use um título de 2 a 160 caracteres e detalhes de até 2.000, sem identificadores pessoais.");
 if(b.dueDate!==""&&(typeof b.dueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)||!Number.isFinite(Date.parse(b.dueDate))||new Date(b.dueDate).toISOString().slice(0,10)!==b.dueDate))throw Error("Confira a data da tarefa.");
 if(b.sourceUsageId!==undefined&&(!uuid(b.sourceUsageId)||!Number.isInteger(b.sourceIndex)||Number(b.sourceIndex)<0||Number(b.sourceIndex)>9))throw Error("Origem da sugestão inválida.");
 return {id:b.id,project:b.project,title:b.title.trim(),detail:b.detail.trim(),due_date:b.dueDate||null,source_usage_id:b.sourceUsageId||null,source_index:b.sourceUsageId?Number(b.sourceIndex):null};
}
export function orderedTasks(tasks:ProjectTask[]){return [...tasks].sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.created_at.localeCompare(b.created_at));}

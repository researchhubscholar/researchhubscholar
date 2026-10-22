import type { AssistantOutput } from "./assist";
import { identifierValue } from "../clinical/collection";
export function validRadarDraft(value:unknown):value is string{return typeof value==='string'&&value.trim().length>=3&&value.length<=1200&&!identifierValue(value)&&!/[<>\n\r]|https?:\/\/|javascript:|\b\d{11}\b/i.test(value);}
export function radarDraftHref(project:string,query:string){if(!/^[0-9a-f-]{36}$/i.test(project)||!validRadarDraft(query))throw Error('Revise o projeto e os termos da busca.');return '/descobrir?'+new URLSearchParams({projeto:project,tema:query.trim(),origem:'assistente'}).toString();}
export function safeGuideActions(output:AssistantOutput):AssistantOutput{return {...output,recommendations:output.recommendations.map(r=>({...r,targetField:r.targetField==='guide_radar'&&validRadarDraft(r.content)?'guide_radar':''}))};}

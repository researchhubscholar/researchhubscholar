import { parseGuideProposal } from "./idea-action";
import type { AssistantOutput } from "./assist";
import { identifierValue } from "../clinical/collection";
export function validRadarDraft(value:unknown):value is string{return typeof value==='string'&&value.trim().length>=3&&value.length<=1200&&!identifierValue(value)&&!/[<>\n\r]|https?:\/\/|javascript:|\b\d{11}\b/i.test(value);}
export function radarDraftHref(project:string|null,query:string){if(project!==null&&!/^[0-9a-f-]{36}$/i.test(project)||!validRadarDraft(query))throw Error('Revise o projeto e os termos da busca.');return '/descobrir?'+new URLSearchParams({...(project?{projeto:project}:{}),tema:query.trim(),origem:'assistente'}).toString();}
export function safeGuideActions(output:AssistantOutput,allowIdea=false,allowExcerpt=false):AssistantOutput{
 return {...output,recommendations:output.recommendations.map(r=>{
  const proposal=r.targetField==='guide_idea'&&allowIdea?parseGuideProposal(r.content):null;
  return {...r,content:proposal?JSON.stringify(proposal):r.content,targetField:allowExcerpt&&r.targetField==='guide_excerpt'&&r.content.trim()&&r.content.length<=6000&&!identifierValue(r.content)&&! /\b\d{11}\b/.test(r.content)?'guide_excerpt':proposal?'guide_idea':r.targetField==='guide_radar'&&validRadarDraft(r.content)?'guide_radar':''};
 })};
}

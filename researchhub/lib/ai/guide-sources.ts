import { aiSpanishCopy } from "../i18n/ai-copy";
import type { OutputLanguage } from "./language";
import type { AssistantOutput } from "./assist";
export type SourceChoice={id:string;title:string;abstractAvailable:boolean;notesAvailable:boolean};
export type GuideSource={id:string;label:string;title:string;pmid:string;doi:string;abstract:string;notes:string;truncated:boolean};
export type SourceManifest=Omit<GuideSource,"abstract"|"notes">&{abstractAvailable:boolean;notesAvailable:boolean};
export function sourceIds(value:unknown):string[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>3||value.some(v=>typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)))throw Error("Selecione até três artigos válidos da Biblioteca.");
 return [...new Set(value)];
}
export function sourceManifest(sources:GuideSource[]):SourceManifest[]{return sources.map(({abstract,notes,...s})=>({...s,abstractAvailable:Boolean(abstract),notesAvailable:Boolean(notes)}));}
const normalized=(s:string)=>s.replace(/\s+/g," ").trim();
export function guideSourceExcerpts(source:GuideSource,kind:"abstract"|"notes"):string[]{
 return normalized(source[kind]).match(/.{1,270}(?:\s|$)|.{1,270}/gu)?.map(part=>part.trim()).filter(part=>part.length>=12)||[];
}
export function groundGuideSources(output:AssistantOutput,sources:GuideSource[],language:OutputLanguage="pt-BR",allowPartial=false):AssistantOutput{
 if(!sources.length)return output;
 const recommendations=output.recommendations.flatMap(r=>{
 try{
 let evidence;try{evidence=JSON.parse(r.source);}catch{throw Error("A resposta não trouxe trechos verificáveis das fontes. Consulte o registro desta tentativa.");}
 if(!evidence||typeof evidence!=="object")throw Error("A fonte citada está em formato inválido.");
 const source=sources.find(s=>s.label===evidence.id),kind=evidence.kind;
 if(source&&(kind==="abstract"||kind==="notes")&&Number.isInteger(evidence.excerpt)&&evidence.excerpt>0) evidence.quote=guideSourceExcerpts(source,kind)[evidence.excerpt-1];
 if(!source||!["abstract","notes"].includes(kind)||typeof evidence.quote!=="string"||evidence.quote.length<12||evidence.quote.length>300||!normalized(source[kind as "abstract"|"notes"]).includes(normalized(evidence.quote)))throw Error("Um trecho citado não corresponde ao material enviado. A resposta não foi aplicada.");
 return [{...r,targetField:"",source:`${source.label} · ${source.title} · ${language==="es"?(kind==="abstract"?aiSpanishCopy["Resumo do artigo"]:aiSpanishCopy["Anotações do pesquisador"]):(kind==="abstract"?"Resumo do artigo":"Anotações do pesquisador")}: “${evidence.quote}”`}];
 }catch(error){if(!allowPartial)throw error;return []; }
 });
 if(!allowPartial)return {...output,recommendations};
 const summary=language==="es"
  ? (recommendations.length?"Se muestran solo los puntos con citas verificadas. No se pudo confirmar el resto con los resúmenes o las notas disponibles.":"No se pudieron verificar citas en los resúmenes o las notas disponibles para esta comparación.")
  : (recommendations.length?"Mostramos apenas os pontos com citações verificadas. Não foi possível confirmar o restante com os resumos ou as anotações disponíveis.":"Não foi possível verificar citações nos resumos ou nas anotações disponíveis para esta comparação.");
 const spanish=language==="es";
 const caution=spanish?"La comparación se limita a los resúmenes y las notas disponibles.":"A comparação se limita aos resumos e às anotações disponíveis.";
 return {
  title:spanish?"Comparación de fuentes":"Comparação de fontes",
  summary,
  recommendations:recommendations.length?recommendations:[{
   label:spanish?"Cómo continuar":"Como continuar",
   content:spanish?"Revisa los resúmenes o selecciona otros artículos con información sobre la misma pregunta.":"Confira os resumos ou selecione outros artigos com informações sobre a mesma pergunta.",
   rationale:spanish?"No hay citas verificadas para sustentar una conclusión.":"Não há citações verificadas para sustentar uma conclusão.",
   targetField:"",confidence:"baixa",source:"",
  }],
  warnings:[],
  caution,
 };
}

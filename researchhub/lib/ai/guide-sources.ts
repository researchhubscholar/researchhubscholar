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
export function groundGuideSources(output:AssistantOutput,sources:GuideSource[]):AssistantOutput{
 if(!sources.length)return output;
 return {...output,recommendations:output.recommendations.map(r=>{
 let evidence;try{evidence=JSON.parse(r.source);}catch{throw Error("A resposta não trouxe trechos verificáveis das fontes. Consulte o registro desta tentativa.");}
 if(!evidence||typeof evidence!=="object")throw Error("A fonte citada está em formato inválido.");
 const source=sources.find(s=>s.label===evidence.id),kind=evidence.kind;
 if(!source||!["abstract","notes"].includes(kind)||typeof evidence.quote!=="string"||evidence.quote.length<12||evidence.quote.length>300||!normalized(source[kind as "abstract"|"notes"]).includes(normalized(evidence.quote)))throw Error("Um trecho citado não corresponde ao material enviado. A resposta não foi aplicada.");
 return {...r,targetField:"",source:`${source.label} · ${source.title} · ${kind==="abstract"?"Resumo do artigo":"Anotações do pesquisador"}: “${evidence.quote}”`};
 })};
}

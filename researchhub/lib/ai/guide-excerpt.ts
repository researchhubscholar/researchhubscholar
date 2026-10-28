import { identifierValue } from "../clinical/collection";
export const excerptIntents={explain:"Esclarecer o trecho",improve:"Melhorar a escrita",coherence:"Revisar coerência",gaps:"Identificar lacunas"} as const;
export type GuideExcerpt={text:string;label:string;intent:keyof typeof excerptIntents};
export type ExcerptRequest=GuideExcerpt&{projectId:string;area:"protocolo"|"manuscrito";token:string};
export function validateExcerpt(value:unknown):GuideExcerpt|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=="object")throw Error("Selecione um trecho válido.");const v=value as Record<string,unknown>;
 if(typeof v.text!=="string"||!v.text.trim()||v.text.length>3000||identifierValue(v.text)||/\b\d{11}\b/.test(v.text))throw Error("Selecione até 3.000 caracteres, sem identificadores pessoais.");
 if(typeof v.label!=="string"||!v.label.trim()||v.label.length>100||identifierValue(v.label)||typeof v.intent!=="string"||!Object.hasOwn(excerptIntents,v.intent))throw Error("Confira o trecho e o tipo de ajuda.");
 return {text:v.text,label:v.label,intent:v.intent as GuideExcerpt["intent"]};
}
export function replaceExcerpt(current:string,original:string,start:number,end:number,replacement:string){
 if(current!==original||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>original.length||!replacement.trim()||replacement.length>6000)throw Error("O texto mudou ou a sugestão é inválida. Selecione o trecho novamente.");
 return current.slice(0,start)+replacement+current.slice(end);
}

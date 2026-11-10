import { identifierValue } from "../clinical/collection";
export const proposalFields=["theme","question","objective","studyType","population","outcome","methods","analysis","ethics"] as const;
export type GuideProposal=Record<typeof proposalFields[number],string>;
export function parseGuideProposal(value:string):GuideProposal|null{
 if(value.length>14000)return null;
 try{const raw=JSON.parse(value);if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const result={} as GuideProposal;
 for(const key of proposalFields){if(typeof raw[key]!=='string'||raw[key].length>1500||identifierValue(raw[key]))return null;result[key]=raw[key].trim();}
 if(!result.theme||!result.question||!result.objective)return null;
 return result;}catch{return null;}
}

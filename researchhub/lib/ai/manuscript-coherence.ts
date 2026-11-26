import type { JSONSchema7 } from "ai";

export const manuscriptAuditSections = [
  "abstract","introduction","methods","results","discussion","limitations","conclusion"
] as const;
export type ManuscriptAuditSection = (typeof manuscriptAuditSections)[number];
export const manuscriptAuditProtocolFields = [
  "research_question","objective","study_type","population","inclusion_criteria",
  "exclusion_criteria","primary_outcome","variables","methods","analysis_plan","ethics_notes"
] as const;
export type ManuscriptAuditProtocolField=(typeof manuscriptAuditProtocolFields)[number];
export type AuditSource = {
  project: Record<ManuscriptAuditProtocolField, string>;
  sections: Record<ManuscriptAuditSection, string>;
};
export type AuditEvidence = {
  origin: "project" | "section";
  field: string;
  quote: string;
};
export type AuditFinding = {
  level: "critical" | "review" | "improve";
  category: "scope" | "method" | "results" | "conclusion" | "consistency" | "reporting";
  title: string;
  explanation: string;
  recommendation: string;
  evidence: AuditEvidence[];
};
export type ManuscriptAudit = {overview:string;findings:AuditFinding[]};

const limitText=(value:unknown,limit:number)=>typeof value==="string"?value.trim().slice(0,limit):"";
const safeFields=(key:string):key is ManuscriptAuditProtocolField=>
  (manuscriptAuditProtocolFields as readonly string[]).includes(key);
const safeSection=(key:string):key is ManuscriptAuditSection=>
  (manuscriptAuditSections as readonly string[]).includes(key);
function normalizeExcerpt(value:string):string{return value.replace(/\s+/g," ").trim();}

export function buildManuscriptAuditSource(
  project:Record<string,unknown>,rows:{section_key:string;content:string|null}[]
): AuditSource {
  const protocol={} as Record<ManuscriptAuditProtocolField,string>;
  for(const key of manuscriptAuditProtocolFields)protocol[key]=limitText(project[key],1800);
  const sections={} as Record<ManuscriptAuditSection,string>;
  for(const key of manuscriptAuditSections)sections[key]="";
  for(const row of rows) if(safeSection(row.section_key)){
    sections[row.section_key]=limitText(row.content,4000);
  }
  return {project:protocol,sections};
}

/** Refuse common direct identifiers in saved manuscript content before sending
 * a multi-section snapshot to the model. Not a full PHI detection guarantee. */
export function assertManuscriptAuditPrivacy(source:AuditSource):void{
  const combined=Object.values(source.sections).join(" ");
  if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(combined) ||
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(combined) ||
    /\b(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/.test(combined)){
    throw new Error("Foram identificados possíveis dados pessoais no manuscrito. Remova e salve essas informações antes da auditoria completa.");
  }
}

export function auditSourceHasMaterial(source:AuditSource):boolean {
  return manuscriptAuditSections.filter(key=>source.sections[key].length>=60).length>=2;
}

export function manuscriptAuditResponseSchema(base:JSONSchema7):JSONSchema7 {
  const arr=base.properties?.recommendations as JSONSchema7;
  const item=arr.items as JSONSchema7;
  return {...base,properties:{
    ...base.properties,recommendations:{...arr,minItems:1,maxItems:1,items:{...item,properties:{
      ...item.properties,targetField:{type:"string",enum:["coherenceReport"]}
    }}}
  }};
}

export function validateManuscriptAuditContent(
  json:string, source:AuditSource
):ManuscriptAudit {
  let parsed:unknown;
  try{parsed=JSON.parse(json);}catch{throw new Error("O verificador não retornou um relatório estruturado válido.");}
  const report=parsed as Partial<ManuscriptAudit>|null;
  if(!report||typeof report!=="object"||typeof report.overview!=="string"||
    report.overview.length<12||report.overview.length>700||
    !Array.isArray(report.findings)||report.findings.length>10){
    throw new Error("O relatório de coerência apresentou campos inválidos.");
  }
  const findings:AuditFinding[]=report.findings.map((entry,index)=>{
    if(!entry||typeof entry!=="object"||
      !["critical","review","improve"].includes(entry.level)||
      !["scope","method","results","conclusion","consistency","reporting"].includes(entry.category)||
      !["title","explanation","recommendation"].every(key=>{
        const value=entry[key as "title"|"explanation"|"recommendation"];
        return typeof value==="string"&&value.trim().length>=12&&value.length<=450;
      })||!Array.isArray(entry.evidence)||!entry.evidence.length||entry.evidence.length>2){
      throw new Error("Achado "+(index+1)+": classificação ou justificativa inválida.");
    }
    const evidence=entry.evidence.map((q,n)=>{
      if(!q||typeof q!=="object"||!["project","section"].includes(q.origin)||
        typeof q.field!=="string"||typeof q.quote!=="string"||q.quote.length<15||q.quote.length>250){
        throw new Error("Achado "+(index+1)+": trecho de apoio inválido.");
      }
      if(q.origin==="project"?!safeFields(q.field):!safeSection(q.field)){
        throw new Error("Achado "+(index+1)+": campo de origem desconhecido.");
      }
      const original=q.origin==="project"?
        source.project[q.field as ManuscriptAuditProtocolField]:
        source.sections[q.field as ManuscriptAuditSection];
      if(!normalizeExcerpt(original).includes(normalizeExcerpt(q.quote))){
        throw new Error("Achado "+(index+1)+": a citação não existe na seção ou protocolo declarado.");
      }
      return {origin:q.origin,field:q.field,quote:q.quote.trim()} as AuditEvidence;
    });
    return {level:entry.level,category:entry.category,title:entry.title.trim(),
      explanation:entry.explanation.trim(),recommendation:entry.recommendation.trim(),evidence};
  });
  return {overview:report.overview.trim(),findings};
}

export function manuscriptAuditPreparation(source:AuditSource):{
  missing:string[]; provisional:string[]; analyzed:number
}{
  const missing=manuscriptAuditSections.filter(key=>!source.sections[key].trim());
  const provisional=manuscriptAuditSections.filter(key=>
    /\[(?:a preencher|a confirmar|to fill|pending|provis[oó]ri|pendente)[^\]]*\]/i.test(source.sections[key]) ||
    /RESUMO PROVISÓRIO|PROVISIONAL ABSTRACT/i.test(source.sections[key])
  );
  return {missing,provisional,analyzed:manuscriptAuditSections.length-missing.length};
}
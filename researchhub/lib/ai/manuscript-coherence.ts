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
  truncatedSections: ManuscriptAuditSection[];
  focus: ManuscriptAuditSection | null;
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
/** Balanced, bounded sampling of long sections. Never claim full coverage.
 * Start, middle, and end retain scope, central results and closing interpretation. */
export function auditSectionExcerpt(value:unknown,limit=1700):string{
  const raw=typeof value==="string"?value.trim():"";
  if(raw.length<=limit)return raw;
  if(limit<450) return raw.slice(0,limit);
  const marker="\n[EXCERPT OMITTED]\n";
  const budget=Math.floor((limit-marker.length*2)/3);
  const start=raw.slice(0,budget);
  const middleStart=Math.max(budget,Math.floor(raw.length/2-budget/2));
  const middle=raw.slice(middleStart,middleStart+budget);
  const end=raw.slice(-budget);
  return start+marker+middle+marker+end;
}
const safeFields=(key:string):key is ManuscriptAuditProtocolField=>
  (manuscriptAuditProtocolFields as readonly string[]).includes(key);
const safeSection=(key:string):key is ManuscriptAuditSection=>
  (manuscriptAuditSections as readonly string[]).includes(key);
function normalizeExcerpt(value:string):string{return value.replace(/\s+/g," ").trim();}

export function buildManuscriptAuditSource(
  project:Record<string,unknown>,rows:{section_key:string;content:string|null}[],
  requestedFocus:ManuscriptAuditSection|null=null
): AuditSource {
  const protocol={} as Record<ManuscriptAuditProtocolField,string>;
  for(const key of manuscriptAuditProtocolFields)protocol[key]=limitText(project[key],400);
  const focus=requestedFocus && safeSection(requestedFocus)?requestedFocus:null;
  const sections={} as Record<ManuscriptAuditSection,string>;
  for(const key of manuscriptAuditSections)sections[key]="";
  const truncatedSections:ManuscriptAuditSection[]=[];
  for(const row of rows) if(safeSection(row.section_key)){
    const raw=(row.content||"").trim();
    // Inspect the original text, including segments omitted from the AI prompt.
    assertNoObviousPersonalIdentifiers(raw);
    const budget=focus?(row.section_key===focus?4000:700):1700;
    sections[row.section_key]=auditSectionExcerpt(raw,budget);
    if(raw.length>budget)truncatedSections.push(row.section_key);
  }
  return {project:protocol,sections,truncatedSections,focus};
}

/** Refuse common direct identifiers in saved manuscript content before sending
 * a multi-section snapshot to the model. Not a full PHI detection guarantee. */
function assertNoObviousPersonalIdentifiers(text:string):void {
  if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) ||
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text) ||
    /\b(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/.test(text)){
    throw new Error("Foram identificados possíveis dados pessoais no manuscrito. Remova e salve esses dados antes da auditoria.");
  }
}

export function assertManuscriptAuditPrivacy(source:AuditSource):void{
  const combined=[...Object.values(source.sections),...Object.values(source.project)].join(" ");
  assertNoObviousPersonalIdentifiers(combined);
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
    const evidence=entry.evidence.map(q=>{
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
      if(/\[EXCERPT OMITTED\]/i.test(q.quote) || !normalizeExcerpt(original).includes(normalizeExcerpt(q.quote))){
        throw new Error("Achado "+(index+1)+": a citação não existe na seção ou protocolo declarado.");
      }
      return {origin:q.origin,field:q.field,quote:q.quote.trim()} as AuditEvidence;
    });
    return {level:entry.level,category:entry.category,title:entry.title.trim(),
      explanation:entry.explanation.trim(),recommendation:entry.recommendation.trim(),evidence};
  });
  return {overview:report.overview.trim(),findings};
}

/** Never pass through an ungrounded claim just to avoid a failed generation.
 * A partially valid report is still useful; rejected findings are disclosed.
 * Structural failures still reject the entire response. */
export type ValidatedAuditReview = {
  audit: ManuscriptAudit;
  rejected: number;
  received: number;
};
export function reviewManuscriptAuditContent(
  json:string,source:AuditSource
):ValidatedAuditReview {
  let raw:unknown;
  try { raw=JSON.parse(json); } catch {
    throw new Error("O relatório gerado não contém JSON válido.");
  }
  if(!raw || typeof raw!=="object")throw new Error("A resposta de auditoria está incompleta.");
  const data=raw as Partial<ManuscriptAudit>;
  if(typeof data.overview!=="string" || data.overview.length<12 || data.overview.length>700 ||
    !Array.isArray(data.findings) || data.findings.length>10){
    throw new Error("O relatório gerado não corresponde ao formato esperado.");
  }
  const accepted:AuditFinding[]=[];
  const seen=new Set<string>();
  let rejected=0;
  for(const finding of data.findings){
    try{
      const validated=validateManuscriptAuditContent(
        JSON.stringify({overview:data.overview,findings:[finding]}),source
      ).findings[0];
      // Duplicate findings with the same underlying passages offer no new value.
      const key=validated.evidence.map(e=>e.origin+":"+e.field+":"+e.quote.toLowerCase())
        .sort().join("|");
      if(seen.has(key)){rejected++;continue;}
      seen.add(key);
      // "Important" requires an observable cross-field discrepancy.
      // One well-formed quotation alone is not proof of inconsistency.
      const distinct=new Set(validated.evidence.map(q=>q.origin+":"+q.field));
      const calibrated=validated.level==="critical" && distinct.size<2
        ? {...validated,level:"review" as const} : validated;
      if(accepted.length<5)accepted.push(calibrated);
      else rejected++;
    }catch{rejected++;}
  }
  return {audit:{overview:data.overview.trim(),findings:accepted},rejected,received:data.findings.length};
}

export function manuscriptAuditPreparation(source:AuditSource):{
  missing:string[]; provisional:string[]; analyzed:number; truncated:string[];focus:string|null
}{
  const missing=manuscriptAuditSections.filter(key=>!source.sections[key].trim());
  const provisional=manuscriptAuditSections.filter(key=>
    /\[(?:a preencher|a confirmar|to fill|pending|provis[oó]ri|pendente)[^\]]*\]/i.test(source.sections[key]) ||
    /RESUMO PROVISÓRIO|PROVISIONAL ABSTRACT/i.test(source.sections[key])
  );
  return {missing,provisional,analyzed:manuscriptAuditSections.length-missing.length,truncated:source.truncatedSections,focus:source.focus};
}
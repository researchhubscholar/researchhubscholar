export type ExportSummary={status:"complete"|"partial";sections:{key:string;label:string;rows:number;status:string}[]};
export function accountExportSummary(value:unknown):ExportSummary{
 const body=value as {format?:unknown;manifest?:ExportSummary;data?:Record<string,unknown>},m=body?.manifest;
 if(body?.format!=="researchhub-scholar-export-v2"||!m||!["complete","partial"].includes(m.status)||!Array.isArray(m.sections)||!m.sections.length||!body.data||typeof body.data!=="object")throw Error("O arquivo de exportação está incompleto ou foi interrompido. Tente novamente.");
 const seen=new Set<string>();
 for(const s of m.sections){if(!s||typeof s.key!=="string"||typeof s.label!=="string"||seen.has(s.key)||!Number.isInteger(s.rows)||s.rows<0||!["complete","partial","unavailable"].includes(s.status)||!Array.isArray(body.data[s.key])||(body.data[s.key] as unknown[]).length!==s.rows)throw Error("Não foi possível conferir a integridade do arquivo. Tente exportar novamente.");seen.add(s.key);}
 if((m.status==="complete")!==m.sections.every(s=>s.status==="complete"))throw Error("Não foi possível conferir a integridade do arquivo.");return m;
}
export function accountExportMessage(summary:ExportSummary){const missing=summary.sections.filter(s=>s.status!=="complete");return missing.length?`Exportação PARCIAL: confira ${missing.map(s=>s.label).join(", ")}. O arquivo preserva o que foi obtido, mas não contém todos os dados. Tente novamente ou contate o suporte.`:"Exportação concluída: todas as seções previstas foram consultadas. O arquivo contém somente dados salvos na conta.";}

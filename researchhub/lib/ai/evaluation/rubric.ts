export const scientificCriteria = [
  {key:"specificity",label:"Recorte científico",help:"População, contexto e desfecho estão delimitados e mensuráveis."},
  {key:"methods",label:"Coerência metodológica",help:"Pergunta, objetivo, desenho e análise são compatíveis."},
  {key:"feasibility",label:"Viabilidade",help:"Prazo, acesso a dados, recursos e exigências éticas foram respeitados."},
  {key:"sources",label:"Fidelidade às fontes",help:"Não inventa referências, resultados, prevalências ou dados."},
  {key:"usefulness",label:"Utilidade para o pesquisador",help:"Amplia possibilidades e propõe próximos passos concretos."},
] as const;
export const scientificCases = [
  {id:"sleep-residents",scenario:"Sono em residentes, prazo de 6 meses, questionário e orientador disponíveis.",expected:"Estudo observacional com população definida, instrumento a validar e desfecho mensurável; sem atribuir causalidade."},
  {id:"retrospective-records",scenario:"Prontuários retrospectivos de hipertensão; acesso condicionado ao comitê de ética.",expected:"Explicita ética, dados ausentes e confundimento; não assume autorização ou amostra já disponível."},
  {id:"review-no-patients",scenario:"Revisão sobre diabetes, três meses, sem acesso a pacientes.",expected:"Delimita pergunta e elegibilidade, estratégia bibliográfica e viabilidade; não sugere coleta clínica inviável."},
  {id:"case-report",scenario:"Relato de caso raro, sem consentimento ainda obtido.",expected:"Sinaliza consentimento e privacidade; não inventa evolução ou resultados do caso."},
  {id:"negative-results",scenario:"Discussão de resultados sem diferença entre grupos, sem valores fornecidos.",expected:"Não cria p-valores, significância, causalidade ou conclusões definitivas."},
  {id:"language",scenario:"Pedido em português com termos de busca em inglês.",expected:"Mantém texto científico no idioma solicitado e estratégia PubMed em inglês, com sinônimos e limites coerentes."},
] as const;
export function evaluationScore(scores: Record<string,number>) { const values=scientificCriteria.map(c=>scores[c.key]);if(values.some(v=>!Number.isInteger(v)||v<1||v>5))throw new Error("Avalie todos os critérios de 1 a 5.");return values.reduce((a,b)=>a+b,0)/values.length; }
export function performanceSummary(rows: {status:string;input_tokens:number;output_tokens:number;cost_usd:number|string;created_at:string;finished_at:string|null}[]) {
  const complete=rows.filter(r=>r.status==="completed"),failed=rows.filter(r=>r.status==="failed");
  const times=rows.filter(r=>r.finished_at).map(r=>(Date.parse(r.finished_at!)-Date.parse(r.created_at))/1000).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  return {operations:rows.length,completed:complete.length,failed:failed.length,reserved:rows.filter(r=>r.status==="reserved").length,tokens:rows.reduce((s,r)=>s+r.input_tokens+r.output_tokens,0),estimatedUsd:rows.reduce((s,r)=>s+Number(r.cost_usd||0),0),p50:times.length?times[Math.floor((times.length-1)*.5)]:null,p95:times.length?times[Math.ceil((times.length-1)*.95)]:null};
}

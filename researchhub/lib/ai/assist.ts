import type { JSONSchema7 } from "ai";

export const assistantFeatures = ["radar", "protocol", "reading", "matrix", "orientation", "writing"] as const;
export type AssistantFeature = typeof assistantFeatures[number];

export type AssistantRecommendation = {
  label: string;
  content: string;
  rationale: string;
  targetField: string;
  confidence: "alta" | "media" | "baixa";
  source: string;
};
export type AssistantOutput = { title: string; summary: string; recommendations: AssistantRecommendation[]; warnings: string[]; caution: string };

export function isAssistantOutput(value: unknown): value is AssistantOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  if (!["title", "summary", "caution"].every(field => typeof output[field] === "string" && (output[field] as string).trim().length > 0)) return false;
  if (!Array.isArray(output.warnings) || !output.warnings.every(item => typeof item === "string")) return false;
  if (!Array.isArray(output.recommendations) || output.recommendations.length < 1 || output.recommendations.length > 10) return false;
  return output.recommendations.every(item => {
    if (!item || typeof item !== "object") return false;
    const recommendation = item as Record<string, unknown>;
    return ["label", "content", "rationale", "targetField", "source"].every(field => typeof recommendation[field] === "string")
      && ["alta", "media", "baixa"].includes(String(recommendation.confidence));
  });
}

const text = { type: "string", minLength: 1, maxLength: 6000 } as const;
export const assistantJsonSchema: JSONSchema7 = {
  type: "object", additionalProperties: false,
  required: ["title", "summary", "recommendations", "warnings", "caution"],
  properties: {
    title: text, summary: text,
    recommendations: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false,
      required: ["label", "content", "rationale", "targetField", "confidence", "source"],
      properties: { label: text, content: text, rationale: text, targetField: { type: "string", maxLength: 80 }, confidence: { type: "string", enum: ["alta", "media", "baixa"] }, source: { type: "string", maxLength: 3000 } },
    } },
    warnings: { type: "array", maxItems: 8, items: text }, caution: text,
  },
};

const instructions: Record<AssistantFeature, string> = {
  radar: "Interprete a pergunta, separe conceitos, traduza termos biomédicos ao inglês e entregue uma estratégia PubMed em targetField=pubmedQuery. Use MeSH apenas quando tiver segurança; sinalize termos incertos.",
  protocol: "Revise coerência entre pergunta, objetivo, desenho, população, desfecho, método, análise e ética. Sugira correções específicas usando targetField compatível com os campos recebidos. Não invente dados.",
  reading: "Extraia somente do texto do artigo. Para cada achado informe no campo source um trecho literal curto que o sustente e confiança. Use targetField objective, population, method, finding ou limitation. Se não constar, diga que não foi identificado.",
  matrix: "Compare somente os artigos fornecidos. Identifique convergências, divergências, limitações e lacunas. Cite em source os títulos/identificadores fornecidos, sem criar referências.",
  orientation: "Prepare uma reunião objetiva: decisões necessárias, perguntas ao orientador, riscos não resolvidos e próximos passos. Baseie-se apenas no projeto e registros fornecidos.",
  writing: "Ajude a estruturar ou revisar o trecho fornecido sem criar resultados, referências ou fatos. Preserve o sentido e marque lacunas que precisam ser preenchidas pelo pesquisador.",
};

export const ledgerFeature: Record<AssistantFeature, "refinement"|"protocol"|"reading"|"matrix"|"writing"> = {
  radar: "refinement", protocol: "protocol", reading: "reading", matrix: "matrix", orientation: "writing", writing: "writing",
};

export function validateAssistRequest(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Contexto não enviado.");
  const body = value as Record<string, unknown>;
  if (!assistantFeatures.includes(body.feature as AssistantFeature)) throw new Error("Ferramenta de assistência inválida.");
  const context = body.context;
  const serialized = JSON.stringify(context ?? {});
  if (serialized.length < 10) throw new Error("Inclua contexto suficiente para a análise.");
  if (serialized.length > 80_000) throw new Error("O contexto excede o limite desta operação.");
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  return { feature: body.feature as AssistantFeature, context, projectId };
}

export function assistantPrompt(feature: AssistantFeature, context: unknown) {
  return `Você é um assistente de planejamento científico em saúde. Responda em português do Brasil. ${instructions[feature]}

REGRAS: não invente evidências, referências, resultados, validações, autorizações ou dados de pacientes; não faça diagnóstico médico; explicite incertezas; produza sugestões para revisão humana, nunca decisões finais. Em source, indique a origem presente no contexto ou escreva "Contexto informado pelo usuário".

CONTEXTO\n${JSON.stringify(context)}`;
}

export function simulatedOutput(feature: AssistantFeature): AssistantOutput {
  const labels: Record<AssistantFeature,string> = { radar:"Estratégia de busca preparada",protocol:"Revisão do projeto preparada",reading:"Leitura assistida preparada",matrix:"Síntese da matriz preparada",orientation:"Pauta de orientação preparada",writing:"Revisão de texto preparada" };
  return { title: labels[feature], summary: "O fluxo completo foi validado em modo de simulação. Ative a licença de teste ao vivo para receber uma análise do conteúdo enviado.", recommendations: [{ label:"Próximo passo", content:"Ativar a IA ao vivo para esta conta de teste.", rationale:"A simulação registra operação, franquia, histórico e interface sem enviar conteúdo ao modelo.", targetField:"", confidence:"alta", source:"Configuração da licença" }], warnings:[], caution:"Simulação sem análise científica e sem cobrança de modelo." };
}

import type { JSONSchema7 } from "ai";
import { aiProposalJsonSchema, isAIProposal, type AIProposal } from "./ideas";

export type RefinementSource = { pmid: string; title: string; contribution: string };
export type IdeaRefinement = {
  refinedProposal: AIProposal;
  alternativeTitles: string[];
  framework: string;
  frameworkElements: { label: string; value: string }[];
  meshTerms: string[];
  literatureSignal: "amplo" | "equilibrado" | "nicho" | "escasso";
  gapAssessment: string;
  similarityRisk: string;
  refinementRationale: string;
  sources: RefinementSource[];
  caution: string;
};

const text = { type: "string", minLength: 3, maxLength: 1200 } as const;
const list = { type: "array", minItems: 2, maxItems: 10, items: { type: "string", minLength: 3, maxLength: 400 } } as const;

export const ideaRefinementJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["refinedProposal", "alternativeTitles", "framework", "frameworkElements", "meshTerms", "literatureSignal", "gapAssessment", "similarityRisk", "refinementRationale", "sources", "caution"],
  properties: {
    refinedProposal: aiProposalJsonSchema,
    alternativeTitles: { type: "array", minItems: 3, maxItems: 5, items: { type: "string", minLength: 8, maxLength: 300 } },
    framework: text,
    frameworkElements: { type: "array", minItems: 3, maxItems: 7, items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: text, value: text } } },
    meshTerms: list,
    literatureSignal: { type: "string", enum: ["amplo", "equilibrado", "nicho", "escasso"] },
    gapAssessment: text,
    similarityRisk: text,
    refinementRationale: text,
    sources: { type: "array", minItems: 1, maxItems: 8, items: { type: "object", additionalProperties: false, required: ["pmid", "title", "contribution"], properties: { pmid: text, title: text, contribution: text } } },
    caution: text,
  },
};

export function isIdeaRefinement(value: unknown): value is IdeaRefinement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return isAIProposal(item.refinedProposal)
    && Array.isArray(item.alternativeTitles) && item.alternativeTitles.length >= 3
    && typeof item.framework === "string"
    && Array.isArray(item.frameworkElements) && item.frameworkElements.length >= 3
    && Array.isArray(item.meshTerms) && item.meshTerms.length >= 2
    && ["amplo", "equilibrado", "nicho", "escasso"].includes(String(item.literatureSignal))
    && ["gapAssessment", "similarityRisk", "refinementRationale", "caution"].every(key => typeof item[key] === "string" && (item[key] as string).trim().length >= 3)
    && Array.isArray(item.sources) && item.sources.length >= 1;
}

type ArticleContext = { pmid: string; title: string; year: number | null; publicationTypes: string[]; abstract: string | null };

export function ideaRefinementPrompt(idea: AIProposal, total: number, articles: ArticleContext[]) {
  const evidence = articles.map(article => ({ ...article, abstract: article.abstract?.slice(0, 1400) || "Resumo não disponível" }));
  return `Você é um pesquisador sênior em epidemiologia clínica, revisão de literatura e redação científica biomédica.

Sua tarefa é refinar uma proposta usando a linguagem e os padrões dos artigos reais recuperados no PubMed. Não copie títulos. Não afirme que existe lacuna apenas porque poucos artigos foram recuperados. Não invente referências, resultados, MeSH ou instrumentos.

PROPOSTA ATUAL
${JSON.stringify(idea)}

RESULTADO DA BUSCA
Total aproximado no PubMed: ${total}
Artigos mais relevantes recuperados:
${JSON.stringify(evidence)}

PROCESSO OBRIGATÓRIO
1. Identifique como população, exposição/intervenção, comparador e desfecho são descritos nos artigos.
2. Compare a proposta com os títulos e perguntas recuperados: preserve o interesse do usuário, mas evite reproduzir um artigo existente.
3. Escolha PICO, PECO, PCC ou SPIDER e explicite seus elementos.
4. Reescreva o título no padrão de artigo biomédico: específico, conciso, informativo e coerente com o desenho. Título não é pergunta e não deve prometer causalidade indevida.
5. Reescreva pergunta, objetivo, desfecho, variáveis, método e análise para que formem um único protocolo coerente.
6. Crie de 3 a 5 títulos alternativos realmente utilizáveis.
7. Sugira termos MeSH somente quando reconhecíveis nos artigos ou como candidatos a confirmar.
8. Em sources, cite somente PMIDs presentes no contexto e explique brevemente como cada artigo orientou o refinamento.
9. Em gapAssessment, descreva o que ainda precisa ser verificado; não declare originalidade como fato.
10. Em similarityRisk, informe se o título ou a pergunta parecem próximos dos artigos encontrados e como diferenciar o recorte.

O resultado deve servir para discussão com orientador e posterior validação por busca sistemática. Produza a proposta completa, não apenas um novo título.`;
}

import type { Context, Idea } from "@/lib/ideas/generate";
import type { JSONSchema7 } from "ai";

export type AIProposal = Pick<Idea,
  "title" | "question" | "objective" | "studyType" | "population" | "outcome" |
  "hypothesis" | "eligibility" | "ethics" | "limitations" | "noveltyCheck" |
  "justification" | "feasibility" | "resources" | "difficulty" | "steps" | "radar" |
  "methods" | "analysis" | "variables" | "refinements" | "unresolved" | "plan"
>;

export type AIIdeasOutput = { proposals: AIProposal[]; caution: string };

const proposalFields: (keyof AIProposal)[] = [
  "title", "question", "objective", "studyType", "population", "outcome",
  "hypothesis", "eligibility", "ethics", "limitations", "noveltyCheck",
  "justification", "feasibility", "resources", "difficulty", "steps", "radar",
  "methods", "analysis", "variables", "refinements", "unresolved", "plan",
];

export function isAIIdeasOutput(value: unknown): value is AIIdeasOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  if (typeof output.caution !== "string" || output.caution.length < 10) return false;
  if (!Array.isArray(output.proposals) || output.proposals.length !== 3) return false;
  return output.proposals.every(item => {
    if (!item || typeof item !== "object") return false;
    const proposal = item as Record<string, unknown>;
    return proposalFields.every(field => {
      const content = proposal[field];
      if (["refinements", "unresolved", "plan"].includes(field)) {
        return Array.isArray(content) && content.length >= 2 && content.every(entry => typeof entry === "string" && entry.trim().length >= 5);
      }
      return typeof content === "string" && content.trim().length >= 8;
    });
  });
}

const text = { type: "string", minLength: 8, maxLength: 3000 } as const;
const list = { type: "array", minItems: 2, maxItems: 8, items: { type: "string", minLength: 5, maxLength: 1000 } } as const;

export const aiIdeasJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["proposals", "caution"],
  properties: {
    proposals: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "question", "objective", "studyType", "population", "outcome", "hypothesis", "eligibility", "ethics", "limitations", "noveltyCheck", "justification", "feasibility", "resources", "difficulty", "steps", "radar", "methods", "analysis", "variables", "refinements", "unresolved", "plan"],
        properties: {
          title: text, question: text, objective: text, studyType: text, population: text,
          hypothesis: text, eligibility: text, ethics: text, limitations: text, noveltyCheck: text,
          outcome: text, justification: text, feasibility: text, resources: text,
          difficulty: text, steps: text, radar: text, methods: text, analysis: text,
          variables: text, refinements: list, unresolved: list, plan: list,
        },
      },
    },
    caution: { type: "string", minLength: 10, maxLength: 1000 },
  },
};

export function validateIdeasRequest(value: unknown): { context: Context; ideas: Idea[]; projectId: string | null } {
  if (!value || typeof value !== "object") throw new Error("Dados da ideia não foram enviados.");
  const body = value as Record<string, unknown>;
  if (!body.context || typeof body.context !== "object") throw new Error("Preencha o diagnóstico antes de usar a assistência.");
  const context = body.context as Record<string, unknown>;
  const required = ["interest", "population", "months", "access"];
  for (const key of required) if (typeof context[key] !== "string" || !context[key].trim()) throw new Error("Informe o que deseja investigar, a população, o prazo e o acesso disponível.");
  const serialized = JSON.stringify(body);
  if (serialized.length > 55_000) throw new Error("O contexto excede o limite desta operação.");
  const ideas = Array.isArray(body.ideas) ? body.ideas.slice(0, 3) : [];
  if (ideas.length < 1) throw new Error("Não foi possível preparar o ponto de partida da geração.");
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  return { context: context as Context, ideas: ideas as Idea[], projectId };
}

export function ideasPrompt(context: Context, ideas: Idea[]) {
  return `Você é um assistente de planejamento de pesquisa em saúde. Aprimore os caminhos fornecidos para que pareçam propostas científicas específicas, mensuráveis e executáveis, sem inventar evidências, dados, instrumentos validados ou autorizações.

REGRAS OBRIGATÓRIAS
- Responda em português do Brasil.
- Preserve o problema e as condições reais informadas pelo usuário.
- Gere exatamente 3 alternativas substancialmente distintas; evite apenas trocar sinônimos.
- Organize os caminhos como: um desenho mais simples e seguro, um caminho equilibrado e um caminho mais ambicioso ainda compatível com as condições informadas.
- Cada pergunta deve delimitar população, contexto, exposição/intervenção quando aplicável e um desfecho mensurável.
- Formule hipótese apenas quando ela fizer sentido para o desenho; em estudos descritivos ou revisões, explique o pressuposto em vez de forçar uma hipótese causal.
- Inclua critérios de elegibilidade, riscos éticos, limitações previsíveis e como verificar originalidade ou lacuna na literatura.
- Quando o usuário não informar instrumento, desfecho ou tamanho de amostra, proponha alternativas plausíveis, mas marque explicitamente que precisam ser confirmadas; nunca apresente validação como fato.
- Não afirme causalidade em desenho transversal, não prometa originalidade e não invente resultados.
- Diferencie revisão, estudo observacional e relato de caso. Não recomende ensaio clínico sem condições explícitas.
- Aponte incertezas, risco de viés, exigências éticas e decisões que dependem do orientador.
- O campo radar deve ser uma estratégia curta em inglês, adequada para busca inicial no PubMed, sem alegar que foi validada.
- Não dê aconselhamento médico nem peça dados identificáveis de pacientes.

CONTEXTO DO USUÁRIO
${JSON.stringify(context)}

CAMINHOS INICIAIS A APRIMORAR
${JSON.stringify(ideas.map(idea => ({ title: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, methods: idea.methods, feasibility: idea.feasibility, unresolved: idea.unresolved })))}

Produza propostas completas para discussão com orientador. A cautela final deve lembrar que a saída não substitui validação metodológica, ética ou revisão da literatura.`;
}

export function mergeAIProposals(current: Idea[], output: AIIdeasOutput): Idea[] {
  return output.proposals.map((proposal, index) => ({
    ...(current[index] || current[0]),
    ...proposal,
    id: `ai-${index + 1}`,
  }));
}

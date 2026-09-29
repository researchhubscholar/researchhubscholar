import type { Context, Idea } from "@/lib/ideas/generate";
import type { JSONSchema7 } from "ai";

export type AIProposal = Pick<Idea,
  "title" | "question" | "objective" | "studyType" | "population" | "outcome" |
  "justification" | "feasibility" | "resources" | "difficulty" | "steps" | "radar" |
  "methods" | "analysis" | "variables" | "refinements" | "unresolved" | "plan"
>;

export type AIIdeasOutput = { proposals: AIProposal[]; caution: string };

const text = { type: "string", minLength: 8, maxLength: 3000 } as const;
const list = { type: "array", minItems: 2, maxItems: 8, items: { type: "string", minLength: 5, maxLength: 1000 } } as const;

export const aiIdeasJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["proposals", "caution"],
  properties: {
    proposals: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "question", "objective", "studyType", "population", "outcome", "justification", "feasibility", "resources", "difficulty", "steps", "radar", "methods", "analysis", "variables", "refinements", "unresolved", "plan"],
        properties: {
          title: text, question: text, objective: text, studyType: text, population: text,
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
  const required = ["specialty", "interest", "population", "months", "access", "measure", "setting"];
  for (const key of required) if (typeof context[key] !== "string" || !context[key].trim()) throw new Error("Complete especialidade, problema, população, prazo, acesso, desfecho e contexto.");
  const serialized = JSON.stringify(body);
  if (serialized.length > 55_000) throw new Error("O contexto excede o limite desta operação.");
  const ideas = Array.isArray(body.ideas) ? body.ideas.slice(0, 3) : [];
  if (ideas.length < 2) throw new Error("Gere pelo menos dois caminhos antes de solicitar o aprimoramento.");
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  return { context: context as Context, ideas: ideas as Idea[], projectId };
}

export function ideasPrompt(context: Context, ideas: Idea[]) {
  return `Você é um assistente de planejamento de pesquisa em saúde. Aprimore os caminhos fornecidos para que pareçam propostas científicas específicas, mensuráveis e executáveis, sem inventar evidências, dados, instrumentos validados ou autorizações.

REGRAS OBRIGATÓRIAS
- Responda em português do Brasil.
- Preserve o problema e as condições reais informadas pelo usuário.
- Gere 2 ou 3 alternativas distintas; evite apenas trocar sinônimos.
- Cada pergunta deve delimitar população, contexto, exposição/intervenção quando aplicável e um desfecho mensurável.
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

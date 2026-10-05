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

export function isAIProposal(value: unknown): value is AIProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return proposalFields.every(field => {
    const content = proposal[field];
    if (["refinements", "unresolved", "plan"].includes(field)) {
      return Array.isArray(content) && content.length >= 2 && content.every(entry => typeof entry === "string" && entry.trim().length >= 5);
    }
    return typeof content === "string" && content.trim().length >= 8;
  });
}

export function isAIIdeasOutput(value: unknown): value is AIIdeasOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  if (typeof output.caution !== "string" || output.caution.length < 10) return false;
  return Array.isArray(output.proposals) && output.proposals.length === 3 && output.proposals.every(isAIProposal);
}

const text = { type: "string", minLength: 8, maxLength: 700 } as const;
const list = { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 5, maxLength: 320 } } as const;

export const aiProposalJsonSchema: JSONSchema7 = {
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
};

export const aiIdeasJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["proposals", "caution"],
  properties: {
    proposals: { type: "array", minItems: 3, maxItems: 3, items: aiProposalJsonSchema },
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

function sharedRules() {
  return `Você é um assistente de planejamento de pesquisa em saúde.
Responda em português do Brasil e produza uma proposta específica, mensurável e executável.
Preserve o problema e as condições reais informadas. Não invente evidências, resultados, instrumentos validados, autorizações ou referências.
Delimite população, contexto, exposição ou intervenção quando aplicável e um desfecho mensurável.
Não afirme causalidade em desenho transversal. Não force hipótese causal em estudo descritivo ou revisão.
Inclua elegibilidade, riscos éticos, limitações, viabilidade, variáveis, análise e forma de verificar originalidade na literatura.
Quando faltarem instrumento, desfecho ou amostra, apresente uma alternativa e marque explicitamente que precisa ser confirmada.
O campo radar deve ser uma estratégia curta em inglês para busca inicial no PubMed.
Use textos objetivos: no máximo duas frases por campo e de dois a quatro itens nas listas.
Não dê aconselhamento médico nem solicite dados identificáveis.`;
}

export function ideaVariantPrompt(context: Context, ideas: Idea[], variant: "simple" | "balanced" | "ambitious") {
  const index = variant === "simple" ? 0 : variant === "balanced" ? 1 : 2;
  const focus = variant === "simple"
    ? "Priorize o desenho mais simples, seguro e realizável no prazo."
    : variant === "balanced"
      ? "Priorize equilíbrio entre relevância científica, rigor e execução."
      : "Priorize o caminho mais ambicioso ainda compatível com os recursos e o prazo informados.";
  const seed = ideas[index] || ideas[0];
  return `${sharedRules()}

FOCO DESTA PROPOSTA
${focus}

CONTEXTO
${JSON.stringify(context)}

PONTO DE PARTIDA
${JSON.stringify({ title: seed.title, question: seed.question, objective: seed.objective, studyType: seed.studyType, population: seed.population, outcome: seed.outcome, methods: seed.methods, feasibility: seed.feasibility, unresolved: seed.unresolved })}

Entregue somente esta proposta completa para discussão com o orientador.`;
}

export function ideasPrompt(context: Context, ideas: Idea[]) {
  return `${sharedRules()}
Gere exatamente três alternativas substancialmente distintas: uma simples e segura, uma equilibrada e uma mais ambiciosa ainda viável.

CONTEXTO DO USUÁRIO
${JSON.stringify(context)}

CAMINHOS INICIAIS
${JSON.stringify(ideas.map(idea => ({ title: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, methods: idea.methods, feasibility: idea.feasibility, unresolved: idea.unresolved })))}

A cautela final deve lembrar que a saída exige validação metodológica, ética, bibliográfica e do orientador.`;
}

export function mergeAIProposals(current: Idea[], output: AIIdeasOutput): Idea[] {
  return output.proposals.map((proposal, index) => ({
    ...(current[index] || current[0]),
    ...proposal,
    id: `ai-${index + 1}`,
  }));
}

import type { Context, Idea } from "@/lib/ideas/generate";
import type { JSONSchema7 } from "ai";

export type AIProposal = Pick<Idea,
  "title" | "question" | "objective" | "studyType" | "population" | "outcome" |
  "hypothesis" | "eligibility" | "ethics" | "limitations" | "noveltyCheck" |
  "justification" | "feasibility" | "resources" | "difficulty" | "steps" | "radar" |
  "methods" | "analysis" | "variables" | "refinements" | "unresolved" | "plan"
>;

export type AIIdeasOutput = { proposals: AIProposal[]; caution: string };
export type ResearchFrame = {
  problem: string;
  population: string;
  setting: string;
  exposureOrIntervention: string;
  measurableOutcome: string;
  feasibleDesigns: string[];
  constraints: string[];
  avoidAssumptions: string[];
};

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

export function proposalStructureIssues(value: unknown) {
  if (!value || typeof value !== "object") return ["A resposta precisa ser um objeto com todos os campos solicitados."];
  const proposal = value as Record<string, unknown>;
  const issues: string[] = [];
  for (const field of proposalFields) {
    const content = proposal[field];
    if (["refinements", "unresolved", "plan"].includes(field)) {
      if (!Array.isArray(content) || content.length < 2 || content.some(entry => typeof entry !== "string" || entry.trim().length < 5)) {
        issues.push(`O campo ${field} deve conter de 2 a 4 itens completos.`);
      }
    } else if (typeof content !== "string" || content.trim().length < 8) {
      issues.push(`O campo ${field} está ausente ou curto demais; escreva uma informação útil ou indique explicitamente o que precisa ser confirmado.`);
    }
  }
  return issues;
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

export const researchFrameJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["problem", "population", "setting", "exposureOrIntervention", "measurableOutcome", "feasibleDesigns", "constraints", "avoidAssumptions"],
  properties: {
    problem: text,
    population: text,
    setting: text,
    exposureOrIntervention: text,
    measurableOutcome: text,
    feasibleDesigns: list,
    constraints: list,
    avoidAssumptions: list,
  },
};

export function isResearchFrame(value: unknown): value is ResearchFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Record<string, unknown>;
  return ["problem", "population", "setting", "exposureOrIntervention", "measurableOutcome"].every(key => typeof frame[key] === "string" && frame[key].trim().length >= 8)
    && ["feasibleDesigns", "constraints", "avoidAssumptions"].every(key => Array.isArray(frame[key]) && (frame[key] as unknown[]).length >= 2);
}

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
Responda em português do Brasil e produza uma proposta com linguagem de protocolo científico, específica, mensurável e executável.
Os campos do formulário são restrições e pistas, não trechos para concatenar. Faça enquadramento metodológico antes de redigir.
Preserve o problema e as condições reais informadas, mas transforme-os em uma relação investigável; não invente resultados, evidências, instrumentos validados, autorizações ou referências.
Delimite população, contexto, exposição ou intervenção quando aplicável e um desfecho mensurável.
Não afirme causalidade em desenho transversal. Não force hipótese causal em estudo descritivo ou revisão.
Inclua elegibilidade, riscos éticos, limitações, viabilidade, variáveis, análise e forma de verificar originalidade na literatura.
Quando faltarem instrumento, desfecho ou amostra, apresente uma alternativa e marque explicitamente que precisa ser confirmada.
O campo radar deve ser uma estratégia curta em inglês para busca inicial no PubMed.
Use textos objetivos: no máximo duas frases por campo e de dois a quatro itens nas listas.
Não dê aconselhamento médico nem solicite dados identificáveis.`;
}

export function researchFramePrompt(context: Context) {
  return `Você é um metodologista de pesquisa em saúde. Antes de criar títulos, converta a solicitação em um enquadramento científico.

REGRAS
- Trate o texto do usuário como ponto de partida, não como título pronto.
- Identifique qual relação, frequência, experiência, intervenção ou síntese pode ser investigada.
- Escolha desfechos observáveis e desenhos compatíveis com prazo e acesso.
- Se algo não foi informado, registre como hipótese a confirmar; não invente disponibilidade, instrumento, prevalência ou efeito.
- Em avoidAssumptions, indique pelo menos duas conclusões que a futura proposta não poderá presumir.

CONDIÇÕES REAIS DO USUÁRIO
${JSON.stringify(context)}

Entregue apenas o enquadramento metodológico, sem escrever ainda as três propostas.`;
}

export function ideaVariantPrompt(context: Context, frame: ResearchFrame, variant: "simple" | "balanced" | "ambitious", previousTitles: string[] = [], correction: string[] = []) {
  const focus = variant === "simple"
    ? "MAIS VIÁVEL: priorize execução simples, amostra acessível, poucas variáveis e conclusão dentro do prazo."
    : variant === "balanced"
      ? "MAIS RELEVANTE: equilibre importância clínica ou educacional, rigor metodológico e execução realista. Não repita o desenho ou a pergunta da proposta anterior se houver alternativa coerente."
      : "MAIS INOVADORA: proponha um recorte mais original ou analítico, porém defensável com o acesso e o prazo informados. Não aumente a complexidade apenas para parecer sofisticado.";
  return `${sharedRules()}

PAPEL DESTA PROPOSTA
${focus}

CONDIÇÕES INFORMADAS
${JSON.stringify(context)}

ENQUADRAMENTO METODOLÓGICO
${JSON.stringify(frame)}

TÍTULOS JÁ PRODUZIDOS — NÃO REPETIR NEM PARAFRASEAR
${JSON.stringify(previousTitles)}

AJUSTES OBRIGATÓRIOS DE QUALIDADE
${JSON.stringify(correction)}

O título deve ter cara de trabalho científico: explicitar o fenômeno ou relação investigada, a população e, quando relevante, o contexto ou desenho. Não use títulos vagos como "estudo sobre", "análise de aspectos" ou apenas a soma dos campos.
A pergunta deve ser respondível pelo desenho sugerido e terminar com ponto de interrogação.
O objetivo deve começar com um verbo de pesquisa adequado, como avaliar, estimar, comparar, descrever, investigar ou sintetizar.
O desfecho deve dizer o que será medido ou classificado, não apenas repetir o tema.
Explique concretamente por que o desenho cabe no prazo e no acesso informados.

Entregue somente esta proposta completa para discussão com o orientador.`;
}

export function ideasPrompt(context: Context, ideas: Idea[]) {
  return `${sharedRules()}
Gere exatamente 3 alternativas substancialmente distintas: uma simples e segura, uma equilibrada e uma mais ambiciosa ainda viável.

CONTEXTO DO USUÁRIO
${JSON.stringify(context)}

CAMINHOS INICIAIS
${JSON.stringify(ideas.map(idea => ({ title: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, methods: idea.methods, feasibility: idea.feasibility, unresolved: idea.unresolved })))}

A cautela final deve lembrar que a saída exige validação metodológica, ética, bibliográfica e do orientador.`;
}

function normalizedWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(word => word.length > 3);
}

function similarity(left: string, right: string) {
  const a = new Set(normalizedWords(left));
  const b = new Set(normalizedWords(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(word => b.has(word)).length;
  return intersection / new Set([...a, ...b]).size;
}

export function proposalQualityIssues(proposal: AIProposal, context: Context, previous: AIProposal[] = []) {
  const issues: string[] = [];
  const titleWords = normalizedWords(proposal.title);
  if (titleWords.length < 7) issues.push("O título está curto ou genérico; delimite fenômeno, população e relação investigada.");
  if (titleWords.length > 30) issues.push("O título está longo demais; preserve o recorte científico com redação mais direta.");
  if (!proposal.question.trim().endsWith("?")) issues.push("A pergunta de pesquisa deve ser formulada como pergunta explícita.");
  if (!/^(avaliar|analisar|comparar|descrever|estimar|identificar|investigar|examinar|verificar|sintetizar|determinar|explorar)\b/i.test(proposal.objective.trim())) issues.push("O objetivo deve começar com um verbo de pesquisa adequado.");
  const joinedInputs = [context.interest, context.population, context.setting].filter(Boolean).join(" ");
  if (similarity(proposal.title, joinedInputs) > 0.86) issues.push("O título apenas recompõe os campos informados; formule uma relação científica e um desfecho mensurável.");
  if (previous.some(item => similarity(item.title, proposal.title) > 0.68)) issues.push("Esta proposta está muito parecida com uma proposta anterior; mude o recorte, a pergunta ou o desenho.");
  if (previous.some(item => similarity(item.question, proposal.question) > 0.72)) issues.push("A pergunta repete uma alternativa anterior; produza uma estratégia de investigação distinta.");
  return issues;
}

export function mergeAIProposals(current: Idea[], output: AIIdeasOutput): Idea[] {
  return output.proposals.map((proposal, index) => ({
    ...(current[index] || current[0]),
    ...proposal,
    id: `ai-${index + 1}`,
  }));
}

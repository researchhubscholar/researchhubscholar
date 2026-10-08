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
  questionArchetype: string;
  structuringFramework: string;
  problem: string;
  population: string;
  setting: string;
  exposureOrIntervention: string;
  comparator: string;
  measurableOutcome: string;
  timeHorizon: string;
  preferredDesign: string;
  designRationale: string;
  mainBiasThreats: string[];
  feasibleDesigns: string[];
  constraints: string[];
  avoidAssumptions: string[];
};
export type ResearchDirection = {
  angle: string;
  questionArchetype: string;
  scientificRationale: string;
  candidateExposureOrConcept: string;
  candidateOutcome: string;
  feasibleDesign: string;
  differentiator: string;
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
  required: ["questionArchetype", "structuringFramework", "problem", "population", "setting", "exposureOrIntervention", "comparator", "measurableOutcome", "timeHorizon", "preferredDesign", "designRationale", "mainBiasThreats", "feasibleDesigns", "constraints", "avoidAssumptions"],
  properties: {
    questionArchetype: text,
    structuringFramework: text,
    problem: text,
    population: text,
    setting: text,
    exposureOrIntervention: text,
    comparator: text,
    measurableOutcome: text,
    timeHorizon: text,
    preferredDesign: text,
    designRationale: text,
    mainBiasThreats: list,
    feasibleDesigns: list,
    constraints: list,
    avoidAssumptions: list,
  },
};

export const scientificIdeasJsonSchema: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["frame", "opportunityMap", "proposals", "caution"],
  properties: {
    frame: researchFrameJsonSchema,
    opportunityMap: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["angle", "questionArchetype", "scientificRationale", "candidateExposureOrConcept", "candidateOutcome", "feasibleDesign", "differentiator"],
        properties: {
          angle: text,
          questionArchetype: text,
          scientificRationale: text,
          candidateExposureOrConcept: text,
          candidateOutcome: text,
          feasibleDesign: text,
          differentiator: text,
        },
      },
    },
    proposals: { type: "array", minItems: 3, maxItems: 3, items: aiProposalJsonSchema },
    caution: { type: "string", minLength: 10, maxLength: 1000 },
  },
};

export function isResearchFrame(value: unknown): value is ResearchFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Record<string, unknown>;
  const conciseFields = ["questionArchetype", "structuringFramework", "comparator", "timeHorizon", "preferredDesign"];
  const descriptiveFields = ["problem", "population", "setting", "exposureOrIntervention", "measurableOutcome", "designRationale"];
  return conciseFields.every(key => typeof frame[key] === "string" && frame[key].trim().length >= 2)
    && descriptiveFields.every(key => typeof frame[key] === "string" && frame[key].trim().length >= 5)
    && ["mainBiasThreats", "feasibleDesigns", "constraints", "avoidAssumptions"].every(key => Array.isArray(frame[key]) && (frame[key] as unknown[]).length >= 1 && (frame[key] as unknown[]).every(entry => typeof entry === "string" && entry.trim().length >= 3));
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

export function scientificIdeasPrompt(context: Context) {
  return `Você é um pesquisador sênior em epidemiologia clínica, metodologia científica e bioestatística aplicada à saúde. Sua tarefa não é sugerir assuntos genéricos: é converter uma intenção inicial em três sinopses de pesquisa defensáveis perante um orientador ou banca.

${sharedRules()}

Faça o trabalho em três etapas dentro da mesma resposta estruturada:
1. Crie em frame apenas o território científico geral: problema, população, contexto, restrições e possibilidades metodológicas. Classifique a pergunta e escolha a estrutura apropriada entre PICO, PECO, PCC ou SPIDER. Não transforme imediatamente a frase do usuário em título.
2. Em opportunityMap, expanda o território em 5 a 8 direções de pesquisa plausíveis. Explore ângulos diferentes — frequência, fatores associados, prognóstico, diagnóstico, experiência, organização do cuidado, intervenção ou síntese de evidências — escolhendo somente os compatíveis com o tipo de trabalho, acesso e prazo. Para cada direção, indique qual conceito/exposição e qual desfecho ou fenômeno poderiam tornar a pergunta investigável.
3. Selecione as três melhores direções e converta-as em propostas completas e substancialmente distintas nesta ordem:
   - MAIS VIÁVEL: execução simples, poucas variáveis e conclusão dentro do prazo.
   - MAIS RELEVANTE: melhor equilíbrio entre importância científica, rigor e execução.
   - MAIS INOVADORA: recorte mais original ou analítico, sem inventar acesso, instrumentos ou recursos.

CONDIÇÕES REAIS DO USUÁRIO
${JSON.stringify(context)}

REGRAS DE QUALIDADE
- Use os dados do usuário como fronteiras do problema, não como peças que precisam aparecer literalmente em todos os títulos.
- Você pode introduzir conceitos, exposições, comparadores e desfechos cientificamente plausíveis para ampliar as possibilidades. Apresente-os como escolhas propostas que precisam ser confirmadas, nunca como fatos ou lacunas já comprovadas.
- Antes de escolher as três propostas, descarte direções triviais, duplicadas, amplas demais, inviáveis no prazo ou incompatíveis com o acesso informado.
- As três propostas devem nascer de direções diferentes do opportunityMap. Trocar apenas palavras, desfecho secundário ou extensão do título não cria uma nova proposta.
- Construa primeiro a cadeia lógica: lacuna → pergunta estruturada → objetivo → desenho → variáveis → desfecho → análise. Nenhum elemento pode contradizer outro.
- Cada título deve ter padrão de artigo científico em saúde e explicitar fenômeno ou relação, população e, quando relevante, contexto ou desenho.
- Não use títulos vagos como "estudo sobre", "análise de aspectos", "abordagem de", "impacto de" sem desenho causal, nem apenas concatene os campos.
- Para estudos observacionais transversais use termos como prevalência, frequência ou associação; não prometa efeito, eficácia, impacto ou causalidade.
- Para revisão, formule uma pergunta de síntese e indique o tipo correto de revisão; não proponha coleta com participantes.
- Em revisão de literatura, explore perguntas de síntese realmente diferentes, por exemplo magnitude/frequência, fatores associados, experiências, estratégias diagnósticas ou intervenções, conforme o tema permitir. Não gere três revisões com a mesma pergunta.
- Para relato ou série de casos, não formule estimativa populacional nem teste causal.
- Cada pergunta deve terminar com ponto de interrogação e ser respondível pelo desenho proposto.
- Cada objetivo deve ter um único verbo principal mensurável: estimar, comparar, descrever, investigar, explorar, determinar ou sintetizar. Evite "compreender" quando houver medida quantitativa.
- Em outcome, defina um desfecho primário operacionalizável: variável, modo de medida e momento, marcando "instrumento a confirmar" quando necessário.
- Em variables, separe exposição/intervenção, desfecho, potenciais confundidores e covariáveis essenciais.
- Em methods, informe desenho, cenário, unidade de análise, recrutamento/amostragem e procedimento principal.
- Em analysis, alinhe a análise ao tipo das variáveis e ao desenho, sem inventar tamanho de efeito ou resultado esperado.
- Em eligibility, diferencie claramente critérios de inclusão e exclusão.
- Em hypothesis, use hipótese compatível com o desenho; escreva "não se aplica" em propostas puramente descritivas ou qualitativas.
- Em noveltyCheck, forneça uma estratégia concreta para verificar lacuna, sem afirmar que ela existe antes da busca.
- As três alternativas não podem ser paráfrases: varie pergunta, recorte ou desenho de maneira metodologicamente coerente.
- A alternativa inovadora continua precisando caber no prazo e no acesso declarados; inovação não significa complexidade artificial.
- Se uma informação não foi fornecida, escreva "a confirmar" no campo apropriado; nunca deixe campo vazio.
- refinements, unresolved e plan devem conter de 2 a 4 itens completos.
- A cautela final deve exigir validação metodológica, ética, bibliográfica e do orientador.`;
}

export function automaticIdeasPrompt(context: Context) {
  return `Você é um pesquisador sênior em epidemiologia clínica, metodologia científica e bioestatística aplicada à saúde. Converta as condições informadas em três propostas de pesquisa completas, específicas e defensáveis perante um orientador ou banca.

${sharedRules()}

CONDIÇÕES REAIS DO USUÁRIO
${JSON.stringify(context)}

PROCESSO OBRIGATÓRIO
- Antes de escrever, avalie internamente pelo menos cinco direções plausíveis: frequência, fatores associados, experiência, diagnóstico, prognóstico, organização do cuidado, intervenção ou síntese de evidências. Não apresente esse rascunho na resposta.
- Descarte caminhos triviais, duplicados, amplos demais, incompatíveis com o acesso ou inviáveis no prazo.
- Entregue exatamente três propostas substancialmente distintas: MAIS VIÁVEL, MAIS RELEVANTE e MAIS INOVADORA, nesta ordem.
- Os campos do usuário são fronteiras e pistas, não frases para concatenar. Introduza exposições, comparadores e desfechos cientificamente plausíveis como escolhas a confirmar.
- Construa para cada proposta a cadeia lógica: pergunta → objetivo → desenho → população → variáveis → desfecho → análise.
- Cada título deve parecer título de artigo científico em saúde e explicitar fenômeno ou relação, população e, quando relevante, contexto ou desenho.
- Não use "estudo sobre", "análise de aspectos" ou "impacto de" sem desenho causal. Em estudos transversais, use prevalência, frequência ou associação e não prometa causalidade.
- A pergunta deve terminar com ponto de interrogação. O objetivo deve começar com um verbo mensurável, como estimar, comparar, descrever, investigar, explorar, determinar ou sintetizar.
- Em outcome, informe variável, modo de medida e momento; use "instrumento a confirmar" quando necessário.
- Em methods, informe desenho, cenário, unidade de análise, amostragem ou recrutamento e procedimento principal.
- Em variables, separe exposição ou intervenção, desfecho, confundidores e covariáveis essenciais.
- Em analysis, alinhe a análise ao desenho sem inventar resultados, efeitos ou tamanho amostral.
- Em eligibility, diferencie inclusão e exclusão. Em noveltyCheck, indique como verificar a lacuna sem afirmar que ela já existe.
- As três propostas não podem ser paráfrases nem mudar apenas o desfecho secundário.
- refinements, unresolved e plan devem conter de 2 a 4 itens completos.
- Retorne somente as três propostas completas e a cautela final. Não inclua mapa de oportunidades, enquadramento separado, explicações fora do JSON ou referências inventadas.`;
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

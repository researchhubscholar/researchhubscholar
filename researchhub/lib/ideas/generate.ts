import { diagnose } from "../research/checks";
import type { LibraryArticle, EvidenceNote } from "../literature/library-store";

export type WorkType = "open" | "tcc" | "original" | "review" | "case" | "residency";
export type Context = { theme: string; specialty: string; interest: string; population: string; stage: string; months: string; access: string; exposure: string; measure: string; setting: string; workType?: WorkType; uncertainty?: string; startingQuestion?: string; instrument?: string; support?: string; availableSample?: string; authorization?: string; requirements?: string };
type BaseIdea = { id: string; title: string; question: string; objective: string; studyType: string; population: string; outcome: string; resources: string; difficulty: string; feasibility: string; steps: string; radar: string; methods: string; analysis: string; variables: string };
export type EvaluationItem = { score: number; label: "Baixa" | "Moderada" | "Alta"; reason: string };
export type IdeaEvaluation = { relevance: EvaluationItem; feasibility: EvaluationItem; execution: EvaluationItem; overall: number };
export const initial: Context = { theme: "", specialty: "Cardiologia", interest: "adesão ao tratamento", population: "adultos", stage: "student", months: "6", access: "literature", exposure: "", measure: "", setting: "" };

function generateBase(c: Context): BaseIdea[] {
  const subject = c.theme.trim() || c.interest;
  const setting = `${c.population} em ${c.setting.trim() || "um contexto definido de " + c.specialty}`;
  const common = { methods: "", analysis: "", variables: "", population: c.population, radar: c.theme.trim() || `${c.specialty} ${c.interest} ${c.population}` };
  const short = Number(c.months) <= 3;
  const support = c.stage === "student" ? "Reserve orientação para delimitar a pergunta e revisar o método." : "Alinhe o projeto com o serviço e a disponibilidade de orientação.";
  const ideas: BaseIdea[] = [{ ...common, id: "review", title: `O que a literatura descreve sobre ${subject} em ${c.population}?`, question: `Quais resultados e limitações são descritos nos estudos sobre ${subject} em ${setting}?`, objective: `Sintetizar os resultados e as limitações dos estudos sobre ${subject} em ${setting}.`, studyType: "Revisão integrativa", outcome: `Resultados relatados nos estudos sobre ${subject}; definir categorias após a leitura inicial.`, resources: "Acesso a bases e textos completos, estratégia de busca e planilha de extração.", difficulty: "Delimitar critérios, avaliar a qualidade e evitar uma síntese apenas descritiva.", feasibility: short ? "Exige um recorte estreito para o prazo informado." : "Compatível com acesso apenas à literatura; o escopo ainda precisa ser validado.", steps: `Comece com uma busca piloto e defina critérios de seleção. ${support}` },
  { ...common, id: "systematic", title: `Síntese estruturada dos estudos sobre ${subject}`, question: `Quais resultados são encontrados nos estudos sobre ${subject} em ${setting}, considerando um desfecho e desenhos previamente definidos?`, objective: `Avaliar criticamente e sintetizar os estudos elegíveis sobre ${subject} em ${setting}.`, studyType: "Revisão sistemática", outcome: "Um desfecho específico, com definição e medida comparáveis entre estudos.", resources: "Protocolo, acesso a mais de uma base, textos completos e apoio para seleção e avaliação crítica.", difficulty: "Verificar revisões existentes, definir uma pergunta precisa e planejar seleção e síntese com rigor.", feasibility: short ? "Prazo curto: considere reduzir o escopo ou ampliar o cronograma." : "Exige equipe, orientação e disponibilidade; não é automaticamente mais simples que pesquisa de campo.", steps: `Verifique revisões recentes antes de propor uma nova síntese. ${support}` }];
  if (c.access === "records" || c.access === "both") ideas.push({ ...common, id: "records", title: `Perfil documentado de ${subject} em ${c.population}`, question: `Como se caracteriza ${subject} nos registros disponíveis de ${setting} durante um período definido?`, objective: `Descrever as características e os resultados documentados relacionados a ${subject} nos registros selecionados.`, studyType: "Observacional transversal", outcome: `Frequência ou distribuição de uma medida relacionada a ${subject}, conforme os campos existentes.`, resources: "Autorização do serviço, avaliação ética aplicável, registros com campos adequados e plano de extração e análise.", difficulty: "Dados ausentes, qualidade dos registros e definição da amostra; o desenho não permite concluir causalidade.", feasibility: short ? "Condicionada a autorizações e dados já disponíveis; o prazo pode ser insuficiente." : "Condicionada à qualidade dos dados, autorizações e volume de registros.", steps: `Confira quais variáveis estão disponíveis antes de fechar a pergunta. ${support}` });
  if (c.access === "patients" || c.access === "both") ideas.push({ ...common, id: "survey", title: `Avaliação de ${subject} em ${c.population}`, question: c.exposure.trim() && c.measure.trim() ? `Qual é a associação entre ${c.exposure} e ${c.measure} em ${setting}?` : `Qual é a frequência ou distribuição de uma medida definida de ${subject} em ${setting}?`, objective: c.exposure.trim() && c.measure.trim() ? `Avaliar a associação entre ${c.exposure} e ${c.measure} em ${setting}.` : `Estimar a frequência ou distribuição da medida escolhida para ${subject} na população selecionada.`, studyType: "Observacional transversal", outcome: c.measure.trim() || `Uma medida de ${subject}, definida com instrumento adequado antes da coleta.`, resources: "Acesso autorizado à população, instrumento adequado, planejamento amostral, consentimento e avaliação ética aplicável.", difficulty: "Recrutamento, viés de seleção e adequação do instrumento à população.", feasibility: short ? "Exige cautela: aprovação e recrutamento podem ultrapassar o prazo informado." : "Depende de recrutamento, aprovação e apoio do serviço.", steps: `Avalie o fluxo de participantes e a disponibilidade de instrumentos. ${support}` });
  if (c.workType === "original" && c.access === "literature") ideas.push({ ...common, id: "pilot", title: `Estudo piloto sobre ${subject} em ${c.population}`, question: `É possível medir ${c.measure || subject} em ${setting} com uma amostra e um instrumento acessíveis?`, objective: `Avaliar a viabilidade de um estudo original sobre ${subject} antes de ampliar a coleta.`, studyType: "Estudo observacional piloto", outcome: c.measure.trim() || "Uma medida principal definida antes da coleta.", resources: "Acesso a participantes ou registros, instrumento, autorizações, avaliação ética aplicável e apoio metodológico.", difficulty: "O acesso atual está limitado à literatura; será necessário confirmar uma fonte de dados antes de executar.", feasibility: "Ainda não executável com o acesso informado. Use este caminho para definir exatamente quais dados e autorizações precisam ser obtidos.", steps: `Mapeie um serviço, população ou conjunto de registros acessível antes de fechar o protocolo. ${support}` });
  if (c.workType === "case" || (c.workType === "residency" && (c.access === "patients" || c.access === "both"))) ideas.push({ ...common, id: "case", title: `Relato clínico de ${subject} em ${c.population}`, question: `Quais aspectos clínicos, diagnósticos, terapêuticos ou evolutivos tornam um caso de ${subject} em ${setting} relevante para discussão?`, objective: `Descrever o caso e discutir suas particularidades à luz da literatura disponível.`, studyType: "Relato de caso", outcome: c.measure.trim() || "Evolução clínica e principal aprendizado do caso, definidos sem extrapolar conclusões.", resources: "Caso elegível, dados clínicos verificáveis, consentimento e autorizações institucionais aplicáveis.", difficulty: "Demonstrar relevância educacional, preservar a identidade e evitar conclusões causais a partir de um único caso.", feasibility: c.access === "patients" || c.access === "both" ? "Pode ser executável se o caso, o consentimento e os dados necessários estiverem acessíveis." : "Você ainda não informou acesso a um caso; confirme isso antes de escolher este caminho.", steps: `Confirme elegibilidade, consentimento e completude dos registros antes de redigir. ${support}` });
  const workType = c.workType || "open";
  const allowed: Record<WorkType, string[]> = {
    open: ["review", "systematic", "records", "survey"],
    tcc: ["review", "records", "survey"],
    original: ["records", "survey", "pilot"],
    review: ["review", "systematic"],
    case: ["case"],
    residency: ["review", "records", "survey", "case"],
  };
  const filtered = ideas.filter(idea => allowed[workType].includes(idea.id));
  const available = filtered.length ? filtered : ideas.filter(idea => ["review", "systematic"].includes(idea.id));
  return available.map(idea => {
    const measure = c.measure.trim();
    const exposure = c.exposure.trim();
    if (measure && idea.id === "review") {
      idea.question = `Como ${measure} é avaliado e quais resultados e limitações são descritos nos estudos sobre ${subject} em ${setting}?`;
      idea.objective = `Sintetizar formas de avaliação, resultados e limitações relacionados a ${measure} nos estudos sobre ${subject} em ${setting}.`;
      idea.outcome = `${measure}; registrar definição, instrumentos e diferenças entre os estudos.`;
    }
    if (measure && idea.id === "systematic") {
      idea.question = exposure ? `Qual associação entre ${exposure} e ${measure} é descrita nos estudos elegíveis sobre ${subject} em ${setting}?` : `Quais resultados para ${measure} são descritos nos estudos elegíveis sobre ${subject} em ${setting}, com desenhos previamente definidos?`;
      idea.objective = `Avaliar criticamente e sintetizar ${exposure ? `a associação descrita entre ${exposure} e ${measure}` : `os resultados relacionados a ${measure}`} nos estudos elegíveis.`;
      idea.outcome = `${measure}; definir previamente quais formas de medida e períodos serão elegíveis para a síntese.`;
    }
    if (measure && idea.id === "records") {
      idea.outcome = `${measure}, apenas se documentado com qualidade suficiente nos registros.`;
      if (exposure) {
        idea.question = `Qual associação entre ${exposure} e ${measure} é documentada nos registros disponíveis de ${setting} durante um período definido?`;
        idea.objective = `Avaliar a associação entre ${exposure} e ${measure} nos registros elegíveis, considerando qualidade, dados ausentes e possíveis fatores de confusão.`;
      }
    }
    if (measure) {
      const focus = exposure ? `Associação entre ${exposure} e ${measure}` : `Avaliação de ${measure}`;
      idea.title = `${focus} em ${c.population}: ${idea.id === "review" ? "medidas e limitações na literatura" : idea.id === "systematic" ? "síntese crítica dos estudos" : idea.id === "records" ? "análise de registros" : "estudo transversal"}`;
      if (idea.id === "records" && !exposure) {
        idea.question = `Como se distribui ${measure} nos registros de ${setting}?`;
        idea.objective = `Descrever a distribuição de ${measure} nos registros elegíveis de ${setting}.`;
      }
    }
    return ({ ...idea,
    variables: idea.id === "review" || idea.id === "systematic" ? "Características dos estudos, população, desenho, medidas de resultado e limitações. Definir os campos no protocolo de extração." : [c.exposure.trim() ? `Exposição: ${c.exposure}.` : "Exposição ou condição de interesse: a delimitar.", c.measure.trim() ? `Desfecho: ${c.measure}.` : "Desfecho e forma de medida: a definir.", "Covariáveis: selecionar apenas as relevantes à pergunta e disponíveis para coleta."].join(" "),
    methods: idea.id === "review" || idea.id === "systematic" ? `Definir critérios de elegibilidade para estudos sobre ${subject} em ${setting}. Testar descritores e sinônimos nas bases escolhidas, registrar buscas e selecionar os estudos conforme o protocolo. Extrair medidas de resultado e avaliar criticamente os estudos com método adequado ao desenho.` : idea.id === "case" ? `Organizar cronologicamente apresentação, investigação, intervenção e evolução do caso. Remover identificadores, confirmar consentimento e autorizações e usar diretriz de relato apropriada antes da submissão.` : idea.id === "records" ? `Delimitar serviço e período dos registros. Verificar disponibilidade e qualidade das variáveis, definir critérios de elegibilidade e planejar extração sem identificação direta. Registrar dados ausentes e submeter o plano às autorizações e avaliações aplicáveis antes do acesso.` : `Definir o local, período e critérios de recrutamento para ${setting}. Planejar a amostra conforme o objetivo, escolher instrumentos adequados à população e registrar exposição e desfecho em uma coleta transversal, após as autorizações e avaliações aplicáveis.`,
    analysis: idea.id === "review" || idea.id === "systematic" ? "Organizar uma síntese por desenho, população e desfecho, distinguindo resultados e limitações. Para revisão sistemática, decidir no protocolo se uma síntese quantitativa é apropriada; não presumir que uma metanálise será possível." : idea.id === "case" ? "Construir uma discussão clínica comparando o caso com evidências selecionadas, explicitando incertezas, alternativas e limites de generalização." : "Descrever a amostra e a distribuição das variáveis. Avaliar a análise de associação quando prevista na pergunta, conforme a natureza dos dados e os pressupostos do método. Planejar tratamento de dados ausentes e possíveis fatores de confusão com apoio do orientador.",
  }); });
}

export type Evidence = { article: LibraryArticle; note: EvidenceNote };
export type Reference = { id: string; label: string; title: string; year: number | null; identifier: string; url: string | null; hasAbstract: boolean; observations: string[] };
export type Idea = BaseIdea & { justification: string; unresolved: string[]; plan: string[]; refinements: string[]; evaluation?: IdeaEvaluation; references: Reference[]; contextSummary: string; startingQuestion: string };

function score(labelScore: number, reason: string): EvaluationItem {
  const value = Math.max(0, Math.min(100, Math.round(labelScore)));
  return { score: value, label: value >= 75 ? "Alta" : value >= 50 ? "Moderada" : "Baixa", reason };
}

function evaluate(c: Context, idea: BaseIdea, references: Reference[]): IdeaEvaluation {
  const review = idea.id === "review" || idea.id === "systematic";
  const relevanceValue = 45 + (c.interest.trim() ? 15 : 0) + (c.population.trim() ? 10 : 0) + (c.measure.trim() ? 15 : 0) + (references.length ? 15 : 0);
  const relevance = score(relevanceValue, references.length ? "Problema, população e desfecho estão definidos e há leituras selecionadas para validar a justificativa." : "O recorte está definido, mas a relevância ainda precisa ser confrontada com a literatura.");
  let feasibilityValue = 35 + (Number(c.months) >= 6 ? 15 : 5) + (c.support === "yes" ? 15 : 0) + (c.instrument?.trim() ? 10 : 0);
  if (review) feasibilityValue += c.access === "literature" || c.access === "both" ? 20 : 10;
  else feasibilityValue += (c.authorization === "confirmed" ? 15 : 0) + (c.availableSample?.trim() ? 10 : 0);
  if (idea.id === "case" && !(c.access === "patients" || c.access === "both")) feasibilityValue -= 30;
  const feasibility = score(feasibilityValue, feasibilityValue >= 75 ? "Prazo, acesso e apoio informados são compatíveis com este desenho, sujeitos à validação final." : "Há condições ainda não confirmadas que podem impedir ou atrasar este desenho.");
  const executionValue = 35 + (c.setting.trim() ? 15 : 0) + (c.measure.trim() ? 15 : 0) + (c.instrument?.trim() ? 15 : 0) + (c.requirements?.trim() ? 10 : 0) + (c.support === "yes" ? 10 : 0);
  const execution = score(executionValue, executionValue >= 75 ? "As principais decisões operacionais foram informadas; o próximo passo é converter o recorte em protocolo." : "Instrumento, exigências ou suporte metodológico ainda precisam ser definidos.");
  return { relevance, feasibility, execution, overall: Math.round((relevance.score + feasibility.score + execution.score) / 3) };
}

function refinements(c: Context, idea: BaseIdea): string[] {
  const subject = c.theme.trim() || c.interest;
  return [
    `População e cenário: restringir ${c.population || "a população"} a ${c.setting || "um serviço ou contexto claramente definido"}.`,
    `Desfecho: usar ${c.measure || "um único resultado mensurável"}${c.instrument?.trim() ? ` medido por ${c.instrument.trim()}` : " e escolher previamente como será medido"}.`,
    idea.id === "review" || idea.id === "systematic" ? `Literatura: limitar ${subject} por desenho, período ou contexto clínico antes de fechar a estratégia de busca.` : idea.id === "case" ? "Caso: concentrar a discussão em um aprendizado clínico principal e evitar transformar o relato em prova de eficácia." : `Execução: limitar a coleta a um período compatível com ${c.months} meses e apenas às variáveis ligadas à pergunta.`,
  ];
}
export function referenceSignature(evidence: Evidence[]) {
  return JSON.stringify(evidence.map(({ article, note }) => ({ id: article.id, title: article.title, abstract: article.abstract, doi: article.doi, pmid: article.pmid, note })).sort((a, b) => a.id.localeCompare(b.id)));
}
export function generate(context: Context, evidence: Evidence[] = []): Idea[] {
  const references: Reference[] = evidence.map(({ article, note }, index) => ({ id: article.id, label: `R${index + 1}`, title: article.title, year: article.year,
    identifier: article.doi ? `DOI ${article.doi}` : `PMID ${article.pmid}`, url: article.doiUrl || article.pubmedUrl, hasAbstract: Boolean(article.abstract),
    observations: ([ ["População", note.population], ["Método", note.method], ["Achado", note.finding], ["Limitação", note.limitation] ] as const).filter(([, value]) => value?.trim()).map(([label, value]) => `${label} — sua anotação: ${value!.slice(0, 600)}`),
  }));
  return generateBase(context).map(idea => {
    const review = idea.id === "review" || idea.id === "systematic";
    const subject = context.theme.trim() || context.interest;
    const rationale: Record<string, string> = {
      review: `Este caminho organiza o que já foi publicado sobre ${subject} antes de definir uma coleta. Com ${context.months} meses, priorize uma pergunta delimitada e uma síntese crítica dos resultados, métodos e limitações.`,
      systematic: `Este caminho avalia uma pergunta específica sobre ${subject} com um protocolo de seleção e síntese. Antes de escolhê-lo, confirme se revisões recentes já respondem à mesma pergunta e se há equipe e textos completos disponíveis.`,
      records: `Seu acesso a registros permite avaliar ${subject} usando dados já documentados. A pergunta precisa caber nas variáveis realmente disponíveis; confira qualidade, volume e autorizações antes de assumir que o estudo é executável.`,
      survey: context.exposure.trim() && context.measure.trim() ? `Você indicou ${context.exposure} como exposição e ${context.measure} como medida. Uma coleta transversal pode explorar sua associação em ${context.population}, respeitando os limites para interpretar temporalidade e causalidade.` : `Seu acesso a participantes permite descrever uma medida de ${subject} em ${context.population}. O primeiro passo é escolher como medir e verificar se há participantes suficientes no prazo informado.`,
      pilot: `Você escolheu um trabalho original, mas informou acesso apenas à literatura. Este caminho explicita as condições mínimas que precisam ser conquistadas antes de iniciar uma coleta.`,
      case: `Este caminho parte de um caso clínico com valor educacional. A contribuição deve estar na particularidade clínica e na discussão crítica, não na generalização do resultado.`,
    };
    const unresolved = [
      ...diagnose(context),
      ...(context.requirements?.trim() ? [`Exigências informadas do curso ou serviço: ${context.requirements.trim()}`] : []),
      ...(context.uncertainty?.trim() ? [`Dúvida que você deseja esclarecer: ${context.uncertainty.trim()}`] : []),
      ...(references.length ? [`Verifique se as ${references.length} referências selecionadas tratam da mesma população, pergunta e desfecho. A seleção não comprova uma lacuna.`] : ["Selecione e leia referências para verificar o que já foi estudado antes de defender a justificativa."]),
      ...(!context.setting.trim() ? ["Delimite o contexto ou local ao qual a pergunta se aplica."] : []),
      ...(!context.measure.trim() ? ["Defina o desfecho e a forma de medida antes de fechar o protocolo."] : []),
      ...(review ? ["Teste uma busca piloto, confirme acesso aos textos e escolha como avaliar criticamente os desenhos elegíveis."] : idea.id === "case" ? ["Confirme consentimento, autorizações, completude dos dados e relevância educacional do caso."] : ["Estime a amostra viável e confira autorizações, avaliação ética aplicável e disponibilidade de apoio para a análise."]),
      ...(idea.id === "systematic" ? ["Não presuma que estudos suficientes ou comparáveis para metanálise serão encontrados."] : []),
      ...(Number(context.months) <= 3 && !review ? ["Prazo curto: confirme se autorizações e recrutamento cabem no cronograma antes de escolher pesquisa de campo."] : []),
    ];
    const plan = review ? [
      "Delimitação: ler as referências selecionadas, conferir revisões existentes e testar a pergunta numa busca piloto.",
      "Protocolo: definir critérios, bases, busca, seleção, extração e avaliação crítica com o orientador.",
      "Execução: realizar e registrar as buscas e a seleção; extrair e conferir os dados elegíveis.",
      "Síntese: relacionar resultados, qualidade e limitações, redigir e revisar o manuscrito.",
    ] : idea.id === "case" ? [
      "Elegibilidade: confirmar a singularidade clínica, a qualidade dos registros e o aprendizado central.",
      "Autorizações: obter consentimento e cumprir exigências institucionais e éticas aplicáveis.",
      "Redação: organizar o caso em linha do tempo e relacioná-lo a uma revisão focal da literatura.",
      "Revisão: conferir anonimização, limites da discussão e diretriz de relato antes da submissão.",
    ] : [
      "Viabilidade: conferir população acessível, variáveis, instrumentos ou qualidade dos registros.",
      "Protocolo: revisar objetivos, planejamento amostral e análise; obter as autorizações e avaliações aplicáveis.",
      idea.id === "records" ? "Execução: extrair os dados autorizados, conferir inconsistências e registrar ausências." : "Execução: recrutar conforme critérios, aplicar os instrumentos e conferir a qualidade dos dados.",
      "Análise e escrita: responder aos objetivos, discutir vieses e limitações e revisar com o orientador.",
    ];
    const measurement = context.instrument?.trim();
    const methods = idea.methods + (measurement ? ` Medida proposta por você: ${measurement}; confirme adequação, disponibilidade e condições de uso.` : "") + (!review && context.availableSample?.trim() ? ` Volume acessível informado: ${context.availableSample.trim()}; confirmar elegibilidade e planejamento amostral.` : "");
    const requirements = context.requirements?.trim();
    return { ...idea, methods, resources: idea.resources + (requirements ? ` Exigências do curso: ${requirements}.` : ""), justification: `${rationale[idea.id]} Problema priorizado por você: ${context.interest}.`, unresolved, plan, refinements: refinements(context, idea), evaluation: evaluate(context, idea, references), references, startingQuestion: context.startingQuestion || "",
      contextSummary: `${context.specialty} · ${context.population} · prazo de ${context.months} meses · ${context.access === "literature" ? "acesso apenas à literatura" : context.access === "records" ? "acesso à literatura e registros" : context.access === "patients" ? "acesso à literatura e participantes" : "acesso à literatura, registros e participantes"}` };
  });
}
export function ideaBrief(idea: Idea): string {
  return ["PROPOSTA PARA DISCUSSÃO COM O ORIENTADOR", idea.title, "", "CONTEXTO", idea.contextSummary,
    ...(idea.startingQuestion ? ["Pergunta do projeto usado como ponto de partida:", idea.startingQuestion] : []),
    "", "PERGUNTA", idea.question, "", "OBJETIVO", idea.objective, "", "DESENHO", idea.studyType,
    "", "JUSTIFICATIVA INICIAL", idea.justification, "", "POPULAÇÃO", idea.population, "", "DESFECHO", idea.outcome, "", "VARIÁVEIS", idea.variables, "", "MÉTODOS", idea.methods, "", "ANÁLISE", idea.analysis,
    "", "AVALIAÇÃO DO CAMINHO", ...(idea.evaluation ? [`Pontuação geral: ${idea.evaluation.overall}/100`, `Relevância: ${idea.evaluation.relevance.score}/100 — ${idea.evaluation.relevance.reason}`, `Viabilidade: ${idea.evaluation.feasibility.score}/100 — ${idea.evaluation.feasibility.reason}`, `Execução: ${idea.evaluation.execution.score}/100 — ${idea.evaluation.execution.reason}`] : []),
    "", "RECORTES SUGERIDOS", ...(idea.refinements || []).map(value => `• ${value}`), "", "VIABILIDADE", idea.feasibility, "", "RECURSOS NECESSÁRIOS", idea.resources, "", "DIFICULDADES", idea.difficulty, "", "DECISÕES PENDENTES", ...idea.unresolved.map(value => `• ${value}`),
    "", "PLANO DE EXECUÇÃO", ...idea.plan.map((value, index) => `${index + 1}. ${value}`),
    "", "REFERÊNCIAS SELECIONADAS PARA VERIFICAÇÃO", ...(idea.references.length ? idea.references.flatMap(ref => [`${ref.label}. ${ref.title} (${ref.year || "ano não informado"}) · ${ref.identifier}`, ...ref.observations]) : ["Nenhuma referência selecionada."]),
    "", "Proposta elaborada com estruturas guiadas, sem geração por IA. As observações citadas são anotações do usuário. Não comprova originalidade ou adequação final do método.",
  ].join("\n");
}

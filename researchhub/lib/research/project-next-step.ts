export type ProjectFields = Partial<Record<"theme" | "question" | "objective" | "population" | "outcome" | "studyType" | "inclusion" | "exclusion" | "variables" | "methods" | "analysis" | "ethics", string>>;
export type MilestoneState = { key: string; status: string; note: string; dueDate: string };
export type ProjectActivity = { references: number | null; searches: number | null; manuscriptStarted: boolean | null };
export const manualMilestones = new Set(["ethics", "collection", "analysis", "submission"]);
export function isRecorded(value = "") { return Boolean(value.trim()) && !/^(a definir|a confirmar|não informado|nao informado|pendente)[.!]?$/i.test(value.trim()); }
export function registeredSteps(draft: ProjectFields, activity: ProjectActivity) {
  const has = (...keys: (keyof ProjectFields)[]) => keys.every(key => isRecorded(draft[key]));
  return {
    theme: has("theme", "population"),
    question: has("question", "objective", "outcome"),
    design: has("studyType", "inclusion", "exclusion", "variables", "methods", "analysis"),
    literature: activity.references === null ? null : activity.references > 0,
    writing: activity.manuscriptStarted,
  };
}
export type NextStep = { title: string; description: string; label: string; destination: "field" | "radar" | "manuscript" | "review" | "documents"; anchor?: string; milestone?: string };
export function projectNextStep(draft: ProjectFields, activity: ProjectActivity, milestones: MilestoneState[]): NextStep {
  const blocked = milestones.find(m => m.status === "blocked");
  if (blocked) return { title: "Resolver uma pendência registrada", description: blocked.note || "Revise a etapa bloqueada e combine a próxima ação com seu orientador.", label: "Ver pendência", destination: "review", milestone: blocked.key };
  const required: [keyof ProjectFields, string, string][] = [
    ["theme", "Delimitar o tema", "pergunta"], ["question", "Definir a pergunta de pesquisa", "pergunta"],
    ["objective", "Registrar o objetivo principal", "objetivos"], ["population", "Delimitar a população ou os estudos elegíveis", "populacao"],
    ["outcome", "Definir o desfecho principal", "desfechos"], ["studyType", "Escolher o desenho do estudo", "populacao"],
    ["inclusion", "Registrar os critérios de inclusão", "populacao"], ["exclusion", "Registrar os critérios de exclusão", "populacao"],
    ["variables", "Definir as variáveis e medidas", "desfechos"], ["methods", "Descrever os procedimentos", "metodos"],
    ["analysis", "Registrar o plano de análise", "metodos"], ["ethics", "Registrar a avaliação ética aplicável", "metodos"],
  ];
  const missing = required.find(([key]) => !isRecorded(draft[key]));
  if (missing) return { title: missing[1], description: "Complete esta decisão no protocolo. O acompanhamento usa o que você já escreveu, sem pedir uma segunda marcação.", label: "Continuar protocolo", destination: "field", anchor: missing[2] };
  if (activity.references === 0) return { title: "Conectar a literatura ao projeto", description: "Pesquise no Radar e vincule as referências que sustentam sua pergunta.", label: "Pesquisar literatura", destination: "radar" };
  if (activity.references === null) return { title: "Conferir a literatura do projeto", description: "Não foi possível conferir as referências agora. Abra o Radar para revisar a busca sem perder suas anotações.", label: "Abrir Radar", destination: "radar" };
  if (milestones.find(m => m.key === "ethics")?.status !== "done") return { title: "Confirmar ética e autorizações", description: "Registrar um plano de ética não equivale a obter aprovação. Confirme as autorizações ou a dispensa aplicável antes da coleta.", label: "Registrar confirmação", destination: "review", milestone: "ethics" };
  if (milestones.find(m => m.key === "collection")?.status !== "done") return { title: /revisão/i.test(draft.studyType || "") ? "Acompanhar a busca e seleção" : "Acompanhar a coleta ou documentação", description: "Registre o prazo e confirme a execução quando essa etapa estiver realmente concluída.", label: "Acompanhar execução", destination: "review", milestone: "collection" };
  if (milestones.find(m => m.key === "analysis")?.status !== "done") return { title: "Conferir a análise dos resultados", description: "O plano de análise já está registrado. A conclusão da análise precisa ser confirmada por você.", label: "Registrar análise", destination: "review", milestone: "analysis" };
  if (activity.manuscriptStarted !== true) return { title: "Começar a escrever o artigo", description: "Leve as decisões do protocolo para as seções do manuscrito e avance na escrita.", label: "Escrever artigo", destination: "manuscript" };
  if (milestones.find(m => m.key === "submission")?.status !== "done") return { title: "Preparar a revisão e a entrega", description: "Seu manuscrito já tem texto. Revise com o orientador e confirme normas e documentos antes da submissão.", label: "Revisar entrega", destination: "review", milestone: "submission" };
  return { title: "Consultar o trabalho e seus documentos", description: "A entrega foi confirmada por você. As versões e documentos continuam disponíveis para consulta e atualização.", label: "Abrir documentos", destination: "documents" };
}

import type { TransferDraft, TransferOrigin } from "@/lib/ideas/transfer";
import { getJourneyTemplate } from "@/lib/research/journey-templates";

export type ProjectDiagnosis = {
  readiness: "ready_to_structure" | "needs_confirmation";
  pending: string[];
  nextAction: string;
  radarQuery: string;
};

function unresolved(value = "") {
  return !value.trim() || /a confirmar|a definir|não informado|nao informado/i.test(value);
}

export function diagnoseProjectDraft(draft: TransferDraft): ProjectDiagnosis {
  const pending = [
    ...(unresolved(draft.question) ? ["Confirmar uma pergunta de pesquisa específica e respondível."] : []),
    ...(unresolved(draft.outcome) ? ["Definir o desfecho principal e como ele será medido."] : []),
    ...(unresolved(draft.population) ? ["Delimitar a população ou os estudos elegíveis."] : []),
    ...(unresolved(draft.methods) ? ["Confirmar fonte de dados, seleção ou procedimento de coleta."] : []),
    ...(unresolved(draft.analysis) ? ["Alinhar o plano de análise ao objetivo e ao desfecho."] : []),
    ...(!/revis[aã]o/i.test(draft.studyType || "") && unresolved(draft.ethics) ? ["Verificar autorizações, proteção de dados e avaliação ética aplicável."] : []),
  ];
  const radarQuery = draft.question?.trim() || draft.theme?.trim() || "";
  return {
    readiness: pending.length ? "needs_confirmation" : "ready_to_structure",
    pending,
    nextAction: pending[0] || "Validar a estratégia bibliográfica no Radar e discutir o recorte com o orientador.",
    radarQuery,
  };
}

export function initialProjectMilestones(ownerId: string, projectId: string, draft: TransferDraft, diagnosis: ProjectDiagnosis) {
  const known: Record<string, boolean> = {
    "Problema observado": Boolean(draft.theme?.trim()),
    "População ou contexto": Boolean(draft.population?.trim()),
    "Pergunta específica": !unresolved(draft.question),
    "Objetivo responde à pergunta": !unresolved(draft.objective),
    "Desfecho mensurável": !unresolved(draft.outcome),
    "Desenho compatível": !unresolved(draft.studyType),
    "Critérios explícitos": !unresolved(draft.inclusion),
    "Variáveis ligadas aos objetivos": !unresolved(draft.variables),
  };
  return getJourneyTemplate(draft.studyType || "").map((step, index) => ({
    owner_id: ownerId,
    project_id: projectId,
    milestone_key: step.key,
    status: index === 0 ? "current" : "pending",
    checklist_state: Object.fromEntries(step.checklist.map(item => [item, Boolean(known[item])])),
    note: index === 0 ? diagnosis.nextAction : null,
    due_date: null,
    position: index + 1,
  }));
}

export function projectOriginRow(ownerId: string, projectId: string, origin: TransferOrigin, draft: TransferDraft, diagnosis: ProjectDiagnosis, referenceIds: string[]) {
  return {
    owner_id: ownerId,
    project_id: projectId,
    source_type: origin.sourceType,
    source_key: origin.sourceKey,
    idea_version_id: origin.ideaVersionId || null,
    idea_series_id: origin.seriesId || null,
    generation_id: origin.generationId || null,
    language: origin.language || null,
    snapshot: { draft, diagnosis, radarQuery: origin.radarQuery || diagnosis.radarQuery, referenceIds },
  };
}

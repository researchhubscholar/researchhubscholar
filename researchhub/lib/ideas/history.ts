import type { Context, Idea } from "./generate";
import { initial } from "./generate";
export type SavedIdea = { id: string; series_id: string; context: Context; proposal: Idea; evidence_signature: string; reason: string; created_at: string };
export type SavedIdeaComparisonRow = { key: string; label: string; values: string[] };

const workTypeLabels: Record<string, string> = {
  open: "Caminhos em comparação",
  tcc: "TCC ou trabalho de conclusão",
  original: "Artigo ou estudo original",
  review: "Revisão de literatura",
  case: "Relato de caso",
  residency: "Projeto da residência",
};

export function compareSavedIdeas(rows: SavedIdea[]): SavedIdeaComparisonRow[] {
  const fields = [
    { key: "score", label: "Pontuação geral", value: (row: SavedIdea) => row.proposal.evaluation ? `${row.proposal.evaluation.overall}/100` : "Não calculada" },
    { key: "workType", label: "Tipo de trabalho", value: (row: SavedIdea) => workTypeLabels[row.context.workType || "open"] || "Não informado" },
    { key: "studyType", label: "Desenho", value: (row: SavedIdea) => row.proposal.studyType },
    { key: "question", label: "Pergunta", value: (row: SavedIdea) => row.proposal.question },
    { key: "objective", label: "Objetivo", value: (row: SavedIdea) => row.proposal.objective },
    { key: "population", label: "População", value: (row: SavedIdea) => row.proposal.population },
    { key: "outcome", label: "Desfecho", value: (row: SavedIdea) => row.proposal.outcome },
    { key: "feasibility", label: "Viabilidade", value: (row: SavedIdea) => row.proposal.feasibility },
    { key: "context", label: "Prazo e acesso", value: (row: SavedIdea) => row.proposal.contextSummary },
    { key: "references", label: "Referências preservadas", value: (row: SavedIdea) => String(row.proposal.references.length) },
    { key: "reason", label: "Motivo da versão", value: (row: SavedIdea) => row.reason || "Versão inicial" },
  ];
  return fields.map(field => ({ key: field.key, label: field.label, values: rows.map(field.value) }));
}
export function historyError(error: { code?: string; message?: string }) {
  return ['42P01', 'PGRST205'].includes(error.code || '') ? 'O histórico precisa ser ativado no banco. Execute supabase/scholar_idea_history.sql no SQL Editor do Supabase.' : 'Não foi possível acessar o histórico. Tente novamente.';
}
// Carrega apenas estruturas conhecidas; versões futuras ou linhas incompletas não entram no editor.
export function validSavedIdea(row: SavedIdea) {
  return row.context && Object.keys(initial).every(key => typeof row.context[key as keyof Context] === 'string') && row.proposal &&
    ['id', 'title', 'question', 'objective', 'studyType', 'population', 'outcome', 'resources', 'difficulty', 'feasibility', 'steps', 'radar', 'methods', 'analysis', 'variables', 'justification', 'contextSummary', 'startingQuestion'].every(key => typeof row.proposal[key as keyof Idea] === 'string') &&
    ['unresolved', 'plan'].every(key => Array.isArray(row.proposal[key as keyof Idea]) && (row.proposal[key as 'plan'] as unknown[]).every(value => typeof value === 'string')) &&
    Array.isArray(row.proposal.references) && row.proposal.references.every(ref => ref && typeof ref.id === 'string' && typeof ref.label === 'string' && typeof ref.title === 'string' && typeof ref.identifier === 'string' && Array.isArray(ref.observations) && ref.observations.every(value => typeof value === 'string'));
}

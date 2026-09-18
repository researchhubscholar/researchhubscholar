import type { Context, Idea } from "./generate";
import { initial } from "./generate";
export type SavedIdea = { id: string; series_id: string; context: Context; proposal: Idea; evidence_signature: string; reason: string; created_at: string };
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

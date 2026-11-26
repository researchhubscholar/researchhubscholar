import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftSource } from "../literature/manuscript-draft-sources";
import type { SectionContents } from "./manuscript-section-rules";
import { rankDraftEvidence, validateDraftEvidenceBatch, type ConsolidatedDraftEvidence } from "./manuscript-draft-batches";

type SavedBatch = {
  usage_id: string;
  user_id: string;
  prompt_version: string | null;
  input_snapshot: { context?: { task?: string; sectionKey?: string; project?: Record<string, unknown>; sources?: DraftSource[]; savedSections?: SectionContents } } | null;
  output_snapshot: { recommendations?: { targetField: string; content: string }[] } | null;
};

function canonicalSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSnapshot);
  if (value && typeof value==="object") {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>)
      .sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,canonicalSnapshot(item)]));
  }
  return value;
}
export function sameDraftSnapshot(first: unknown, second: unknown): boolean {
  return JSON.stringify(canonicalSnapshot(first))===JSON.stringify(canonicalSnapshot(second));
}

const uuid = /^[0-9a-f-]{36}$/i;
export const DRAFT_BATCH_SIZE = 5;
export const FINAL_EVIDENCE_LIMIT = 24;

export type DraftComposeSource = {
  id: string; label: string; title: string; pmid: string | null; doi: string | null;
  abstract: string; fullTextExcerpt: string;
  evidenceLevel: DraftSource["evidenceLevel"]; finding: string; license: string | null; pmcid: string | null;
};

/** Existing generation artifacts act as server-verified checkpoints. No new
 * database migration or unsigned evidence supplied by the browser is needed. */
export async function loadDraftComposition(
  db: SupabaseClient, userId: string, projectId: string, batchIds: string[],
  project: Record<string, unknown>, sectionKey: "introduction" | "discussion" = "introduction",
  savedSections: SectionContents = {}
): Promise<{ sources: DraftComposeSource[]; considered: number; relevant: number }> {
  if (!Array.isArray(batchIds) || !batchIds.length || batchIds.length > 500
    || batchIds.some(id => typeof id !== "string" || !uuid.test(id))
    || new Set(batchIds).size !== batchIds.length) {
    throw new Error("O histórico de análise dos artigos é inválido.");
  }
  const rows = new Map<string, SavedBatch>();
  for (let i = 0; i < batchIds.length; i += 50) {
    const { data, error } = await db.from("scholar_generation_artifacts")
      .select("usage_id,user_id,prompt_version,input_snapshot,output_snapshot")
      .eq("user_id", userId).in("usage_id", batchIds.slice(i, i + 50));
    if (error) throw new Error("Não foi possível consultar as análises científicas já realizadas.");
    for (const record of (data || []) as SavedBatch[]) rows.set(record.usage_id, record);
  }
  if (rows.size !== batchIds.length) throw new Error("Uma das análises não foi encontrada nesta conta.");
  const entries: ConsolidatedDraftEvidence[] = [];
  for (const id of batchIds) {
    const row = rows.get(id)!;
    const context = row.input_snapshot?.context;
    const rec = row.output_snapshot?.recommendations?.[0];
    if (row.user_id !== userId || row.prompt_version !== "writing.draft-beta.v3-batch-sources"
      || context?.task !== "evidence_batch" || (context.sectionKey || "introduction") !== sectionKey
      || (sectionKey === "discussion" && !sameDraftSnapshot(context.savedSections || {},savedSections))
      || !context.project || context.project.id !== projectId
      || !sameDraftSnapshot(context.project,project)
      || !Array.isArray(context.sources) || context.sources.length > DRAFT_BATCH_SIZE
      || !rec || rec.targetField !== sectionKey) {
      throw new Error("O projeto mudou ou uma análise anterior não pertence a este rascunho. Reinicie a análise.");
    }
    const notes = validateDraftEvidenceBatch(rec.content, context.sources);
    for (let i = 0; i < notes.length; i++) {
      const src = context.sources[i], note = notes[i];
      entries.push({
        id: src.id, label: src.label, title: src.title, pmid: src.pmid, doi: src.doi,
        evidenceLevel: src.evidenceLevel, license:src.license, pmcid:src.pmcid, relevance: note.relevance,
        finding: note.finding, quote: note.quote, kind: note.kind
      });
    }
  }
  const ranked = rankDraftEvidence(entries, FINAL_EVIDENCE_LIMIT);
  if (!ranked.candidates.length) {
    throw new Error("Os artigos selecionados não apresentaram trechos suficientes para redigir esta seção com citações.");
  }
  const sources = ranked.candidates.map(item => ({
    id: item.id, label: item.label, title: item.title, pmid: item.pmid, doi: item.doi,
    abstract: item.kind === "abstract" ? item.quote : "",
    fullTextExcerpt: item.kind === "fullTextExcerpt" ? item.quote : "",
    evidenceLevel: item.evidenceLevel, finding: item.finding,
    license: item.license, pmcid: item.pmcid
  }));
  return { sources, considered: ranked.considered, relevant: ranked.relevant };
}

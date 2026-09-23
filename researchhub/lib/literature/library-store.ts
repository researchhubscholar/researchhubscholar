import type { SupabaseClient } from "@supabase/supabase-js";
import { Article, sameArticle } from "./types";
import type { StudyDesign } from "./matrix-template";

export type ReadingStatus = "unread" | "reading" | "reviewed" | "excluded";
export type LibraryArticle = Article & { id: string; projectId: string | null; projectIds: string[]; readingStatus: ReadingStatus; favorite: boolean; tags: string[]; folder: string; studyDesign: StudyDesign; exclusionReason: string; fullTextUrl: string };
export type EvidenceNote = { objective?: string; population?: string; method?: string; finding?: string; limitation?: string; sampleSize?: string; intervention?: string; comparator?: string; outcomes?: string; evidenceLevel?: string; riskOfBias?: string; generalNotes?: string };
export type ResearchProject = { id: string; title: string | null; theme: string | null };
export const noteFields = ["objective", "population", "method", "finding", "limitation", "sampleSize", "intervention", "comparator", "outcomes", "evidenceLevel", "riskOfBias", "generalNotes"] as const;
const dbFields = { objective: "objective", population: "population", method: "method", finding: "main_finding", limitation: "limitation", sampleSize: "sample_size", intervention: "intervention", comparator: "comparator", outcomes: "outcomes", evidenceLevel: "evidence_level", riskOfBias: "risk_of_bias", generalNotes: "notes" };
const confirmableFields = new Set(["objective", "population", "method", "finding", "limitation"]);

export function fromArticleRow(row: any): LibraryArticle {
  const pmid = row.pmid || null;
  const doi = row.doi || null;
  return { id: row.id, projectId: row.project_id, pmid, doi, title: row.title,
    authors: Array.isArray(row.authors) ? row.authors : [], journal: row.journal || "",
    pubdate: String(row.publication_year || ""), year: row.publication_year,
    publicationTypes: Array.isArray(row.publication_types) ? row.publication_types : [],
    abstract: row.abstract, pubmedUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
    doiUrl: doi ? `https://doi.org/${doi}` : null, source: pmid ? "PubMed" : "Crossref", savedAt: row.created_at,
    readingStatus: row.reading_status || "unread", favorite: Boolean(row.favorite), tags: Array.isArray(row.tags) ? row.tags : [], folder: row.folder || "", studyDesign: row.study_design || "auto", projectIds: row.project_id ? [row.project_id] : [], exclusionReason: row.exclusion_reason || "", fullTextUrl: row.full_text_url || "" };
}

// A stable DOI ID makes simultaneous saves on two devices converge on one row.
async function stableDoiId(ownerId: string, doi: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ownerId}:${doi.trim().toLowerCase()}`)));
  digest[6] = (digest[6] & 15) | 128;
  digest[8] = (digest[8] & 63) | 128;
  const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class LibraryStore {
  constructor(private db: SupabaseClient, private ownerId: string) {}
  private check(error: any) {
    if (error) throw new Error("Não foi possível salvar ou carregar sua biblioteca. Confira a conexão e tente novamente.");
  }
  private async allRows(table: string) {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.db.from(table).select("*").eq("owner_id", this.ownerId).order("id").range(offset, offset + 499);
      this.check(error); rows.push(...(data || []));
      if ((data || []).length < 500) return rows;
    }
  }
  private async optionalRows(table: string) {
    try { return await this.allRows(table); } catch { return []; }
  }
  async load() {
    const [articleRows, noteRows, linkRows, projectsResult] = await Promise.all([
      this.allRows("library_articles"), this.allRows("evidence_matrix"),
      this.optionalRows("library_article_projects"),
      this.db.from("research_projects").select("id,title,theme").eq("owner_id", this.ownerId).order("updated_at", { ascending: false }),
    ]);
    this.check(projectsResult.error);
    const notes: Record<string, EvidenceNote> = {};
    for (const row of noteRows) {
      notes[row.article_id] = { objective: row.objective || "", population: row.population || "", method: row.method || "", finding: row.main_finding || "", limitation: row.limitation || "", sampleSize: row.sample_size || "", intervention: row.intervention || "", comparator: row.comparator || "", outcomes: row.outcomes || "", evidenceLevel: row.evidence_level || "", riskOfBias: row.risk_of_bias || "", generalNotes: row.notes || "" };
    }
    const projectIds = new Map<string, string[]>();
    for (const row of linkRows) projectIds.set(row.article_id, [...(projectIds.get(row.article_id) || []), row.project_id]);
    return { articles: articleRows.map(fromArticleRow).map(article => ({ ...article, projectIds: Array.from(new Set([...(projectIds.get(article.id) || []), ...(article.projectId ? [article.projectId] : [])])) })).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")), notes, projects: (projectsResult.data || []) as ResearchProject[] };
  }
  private async ownedProject(projectId: string | null) {
    if (!projectId) return;
    const { data, error } = await this.db.from("research_projects").select("id").eq("owner_id", this.ownerId).eq("id", projectId).maybeSingle();
    this.check(error); if (!data) throw new Error("Escolha um projeto da sua conta.");
  }
  private async ownedArticle(id: string) {
    const { data, error } = await this.db.from("library_articles").select("*").eq("owner_id", this.ownerId).eq("id", id).maybeSingle();
    this.check(error); if (!data) throw new Error("Este artigo não está na sua biblioteca.");
    return fromArticleRow(data);
  }
  async saveArticle(article: Article, projectId: string | null) {
    if (!article.title?.trim() || (!article.pmid && !article.doi)) throw new Error("Artigo sem título ou identificador válido.");
    await this.ownedProject(projectId);
    const rows = await this.allRows("library_articles");
    const existing = rows.map(fromArticleRow).find(a => sameArticle(a, article));
    if (existing) {
      if (projectId) {
        try { await this.addProjectLink(existing.id, projectId); existing.projectIds = Array.from(new Set([...existing.projectIds, projectId])); } catch { /* o vínculo principal antigo continua preservado */ }
      }
      return existing;
    }
    const { data, error } = await this.db.from("library_articles").insert({ ...(article.doi ? { id: await stableDoiId(this.ownerId, article.doi) } : {}), owner_id: this.ownerId, project_id: projectId,
      pmid: article.pmid || null, doi: article.doi?.trim().toLowerCase() || null, title: article.title,
      authors: article.authors, journal: article.journal, publication_year: article.year,
      publication_types: article.publicationTypes, abstract: article.abstract, source_url: article.pubmedUrl || article.doiUrl,
    }).select("*").single();
    if (error?.code === "23505") {
      const duplicate = (await this.allRows("library_articles")).map(fromArticleRow).find(a => sameArticle(a, article));
      if (duplicate) return duplicate;
    }
    this.check(error);
    const saved = fromArticleRow(data);
    if (projectId) {
      try { const link = await this.db.from("library_article_projects").upsert({ owner_id: this.ownerId, article_id: saved.id, project_id: projectId }); this.check(link.error); } catch { /* project_id preserves the main link until the upgrade runs */ }
      saved.projectIds = [projectId];
    }
    return saved;
  }
  async saveNote(id: string, note: EvidenceNote) {
    const article = await this.ownedArticle(id);
    const payload: Record<string, unknown> = { owner_id: this.ownerId, article_id: id, project_id: article.projectId };
    for (const field of noteFields) {
      const value = String(note[field] || "");
      if (value.length > 20000) throw new Error("Uma anotação ultrapassou 20.000 caracteres. Reduza o texto antes de salvar.");
      payload[dbFields[field]] = value;
      if (confirmableFields.has(field)) payload[`confirmed_${dbFields[field]}`] = Boolean(value.trim());
    }
    const { error } = await this.db.from("evidence_matrix").upsert(payload, { onConflict: "owner_id,article_id" });
    this.check(error);
  }
  async assignProject(id: string, projectId: string | null) {
    await this.ownedProject(projectId); await this.ownedArticle(id);
    const { error } = await this.db.from("library_articles").update({ project_id: projectId }).eq("owner_id", this.ownerId).eq("id", id);
    this.check(error);
    const result = await this.db.from("evidence_matrix").update({ project_id: projectId }).eq("owner_id", this.ownerId).eq("article_id", id);
    this.check(result.error);
    if (projectId) {
      try { const link = await this.db.from("library_article_projects").upsert({ owner_id: this.ownerId, article_id: id, project_id: projectId }); this.check(link.error); } catch { /* project_id remains the source of truth */ }
    }
  }
  async updateArticle(id: string, metadata: { readingStatus: ReadingStatus; favorite: boolean; tags: string[]; folder: string; studyDesign: StudyDesign; exclusionReason: string; fullTextUrl: string }) {
    await this.ownedArticle(id);
    if (metadata.tags.length > 20 || metadata.tags.some(tag => tag.length > 50)) throw new Error("Use até 20 etiquetas com no máximo 50 caracteres.");
    if (metadata.folder.length > 120 || metadata.exclusionReason.length > 1000 || metadata.fullTextUrl.length > 1000) throw new Error("Revise os campos antes de salvar.");
    if (metadata.fullTextUrl && !/^https?:\/\//i.test(metadata.fullTextUrl)) throw new Error("Informe um link completo iniciado por http:// ou https://.");
    const { error } = await this.db.from("library_articles").update({ reading_status: metadata.readingStatus, favorite: metadata.favorite, tags: metadata.tags, folder: metadata.folder || null, study_design: metadata.studyDesign, exclusion_reason: metadata.exclusionReason || null, full_text_url: metadata.fullTextUrl || null }).eq("owner_id", this.ownerId).eq("id", id);
    this.check(error);
  }
  async addProjectLink(id: string, projectId: string) {
    await this.ownedArticle(id); await this.ownedProject(projectId);
    const { error } = await this.db.from("library_article_projects").upsert({ owner_id: this.ownerId, article_id: id, project_id: projectId });
    this.check(error);
  }
  async removeProjectLink(id: string, projectId: string) {
    const article = await this.ownedArticle(id); await this.ownedProject(projectId);
    if (article.projectId === projectId) throw new Error("Troque o projeto principal antes de remover este vínculo.");
    const { error } = await this.db.from("library_article_projects").delete().eq("owner_id", this.ownerId).eq("article_id", id).eq("project_id", projectId);
    this.check(error);
  }
  async mergeDuplicates(keepId: string, removeIds: string[]) {
    const uniqueRemoveIds = Array.from(new Set(removeIds)).filter(id => id !== keepId);
    if (!uniqueRemoveIds.length) throw new Error("Escolha ao menos um registro duplicado.");
    const { error } = await this.db.rpc("scholar_merge_library_duplicates", {
      p_keep: keepId,
      p_remove: uniqueRemoveIds,
    });
    if (error) {
      if (error.code === "PGRST202" || /scholar_merge_library_duplicates/i.test(error.message || "")) {
        throw new Error("Ative a união segura executando scholar_library_duplicates.sql no Supabase.");
      }
      throw new Error(error.message || "Não foi possível unir os registros. Nenhum artigo foi removido.");
    }
  }
  async attachUnassigned(ids: string[], projectId: string) {
    await this.ownedProject(projectId);
    const articles = (await this.allRows("library_articles")).map(fromArticleRow);
    let attached = 0, retained = 0, missing = 0;
    for (const id of new Set(ids)) {
      const article = articles.find(article => article.id === id);
      if (!article) { missing++; continue; }
      if (article.projectId && article.projectId !== projectId) { retained++; continue; }
      await this.assignProject(id, projectId);
      attached++;
    }
    return { attached, retained, missing };
  }
  async remove(id: string) {
    const { error } = await this.db.from("library_articles").delete().eq("owner_id", this.ownerId).eq("id", id);
    this.check(error);
  }
}

function normalizeTitle(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function duplicateMatchReason(a: LibraryArticle, b: LibraryArticle): "doi" | "pmid" | "title-year" | null {
  const doiA = a.doi?.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  const doiB = b.doi?.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  if (doiA && doiB && doiA === doiB) return "doi";
  if (a.pmid && b.pmid && a.pmid.trim() === b.pmid.trim()) return "pmid";
  if (a.year && a.year === b.year && normalizeTitle(a.title) === normalizeTitle(b.title)) return "title-year";
  return null;
}
export function findDuplicateGroups(articles: LibraryArticle[]) {
  const groups: LibraryArticle[][] = [];
  const used = new Set<string>();
  for (const article of articles) {
    if (used.has(article.id)) continue;
    const matches = articles.filter(other => other.id !== article.id && !used.has(other.id) && duplicateMatchReason(article, other));
    if (matches.length) {
      const group = [article, ...matches]; group.forEach(item => used.add(item.id)); groups.push(group);
    }
  }
  return groups;
}

export function mergeImportedNote(saved: EvidenceNote = {}, incoming: EvidenceNote = {}): EvidenceNote {
  const merged = { ...saved };
  for (const field of noteFields) if (!merged[field]?.trim() && typeof incoming[field] === "string") merged[field] = incoming[field];
  return merged;
}

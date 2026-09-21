import type { SupabaseClient } from "@supabase/supabase-js";
import { Article, sameArticle } from "./types";

export type ReadingStatus = "unread" | "reading" | "reviewed" | "excluded";
export type LibraryArticle = Article & { id: string; projectId: string | null; readingStatus: ReadingStatus; favorite: boolean; tags: string[]; exclusionReason: string; fullTextUrl: string };
export type EvidenceNote = { objective?: string; population?: string; method?: string; finding?: string; limitation?: string; sampleSize?: string; intervention?: string; comparator?: string; outcomes?: string; evidenceLevel?: string; riskOfBias?: string };
export type ResearchProject = { id: string; title: string | null; theme: string | null };
export const noteFields = ["objective", "population", "method", "finding", "limitation", "sampleSize", "intervention", "comparator", "outcomes", "evidenceLevel", "riskOfBias"] as const;
const dbFields = { objective: "objective", population: "population", method: "method", finding: "main_finding", limitation: "limitation", sampleSize: "sample_size", intervention: "intervention", comparator: "comparator", outcomes: "outcomes", evidenceLevel: "evidence_level", riskOfBias: "risk_of_bias" };
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
    readingStatus: row.reading_status || "unread", favorite: Boolean(row.favorite), tags: Array.isArray(row.tags) ? row.tags : [], exclusionReason: row.exclusion_reason || "", fullTextUrl: row.full_text_url || "" };
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
  async load() {
    const [articleRows, noteRows, projectsResult] = await Promise.all([
      this.allRows("library_articles"), this.allRows("evidence_matrix"),
      this.db.from("research_projects").select("id,title,theme").eq("owner_id", this.ownerId).order("updated_at", { ascending: false }),
    ]);
    this.check(projectsResult.error);
    const notes: Record<string, EvidenceNote> = {};
    for (const row of noteRows) {
      notes[row.article_id] = { objective: row.objective || "", population: row.population || "", method: row.method || "", finding: row.main_finding || "", limitation: row.limitation || "", sampleSize: row.sample_size || "", intervention: row.intervention || "", comparator: row.comparator || "", outcomes: row.outcomes || "", evidenceLevel: row.evidence_level || "", riskOfBias: row.risk_of_bias || "" };
    }
    return { articles: articleRows.map(fromArticleRow).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "")), notes, projects: (projectsResult.data || []) as ResearchProject[] };
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
    if (existing) return existing;
    const { data, error } = await this.db.from("library_articles").insert({ ...(article.doi ? { id: await stableDoiId(this.ownerId, article.doi) } : {}), owner_id: this.ownerId, project_id: projectId,
      pmid: article.pmid || null, doi: article.doi?.trim().toLowerCase() || null, title: article.title,
      authors: article.authors, journal: article.journal, publication_year: article.year,
      publication_types: article.publicationTypes, abstract: article.abstract, source_url: article.pubmedUrl || article.doiUrl,
    }).select("*").single();
    if (error?.code === "23505") {
      const duplicate = (await this.allRows("library_articles")).map(fromArticleRow).find(a => sameArticle(a, article));
      if (duplicate) return duplicate;
    }
    this.check(error); return fromArticleRow(data);
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
  }
  async updateArticle(id: string, metadata: { readingStatus: ReadingStatus; favorite: boolean; tags: string[]; exclusionReason: string; fullTextUrl: string }) {
    await this.ownedArticle(id);
    if (metadata.tags.length > 20 || metadata.tags.some(tag => tag.length > 50)) throw new Error("Use até 20 etiquetas com no máximo 50 caracteres.");
    if (metadata.exclusionReason.length > 1000 || metadata.fullTextUrl.length > 1000) throw new Error("Revise os campos antes de salvar.");
    if (metadata.fullTextUrl && !/^https?:\/\//i.test(metadata.fullTextUrl)) throw new Error("Informe um link completo iniciado por http:// ou https://.");
    const { error } = await this.db.from("library_articles").update({ reading_status: metadata.readingStatus, favorite: metadata.favorite, tags: metadata.tags, exclusion_reason: metadata.exclusionReason || null, full_text_url: metadata.fullTextUrl || null }).eq("owner_id", this.ownerId).eq("id", id);
    this.check(error);
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

export function mergeImportedNote(saved: EvidenceNote = {}, incoming: EvidenceNote = {}): EvidenceNote {
  const merged = { ...saved };
  for (const field of noteFields) if (!merged[field]?.trim() && typeof incoming[field] === "string") merged[field] = incoming[field];
  return merged;
}

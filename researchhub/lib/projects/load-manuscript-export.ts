import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManuscriptExport } from "./manuscript-export";
import { formattedCitedReferences } from "./references";
import { validWorkspace, type ResultsWorkspace } from "../results/data";

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

// The document center exports saved manuscript data, never profile fields or uncited library entries.
export async function loadManuscriptExport(db: SupabaseClient, projectId: string, fetcher = fetch): Promise<{ input: ManuscriptExport; results: ResultsWorkspace | null }> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) throw new Error("Entre novamente na sua conta antes de exportar.");
  const ownerId = auth.user.id;
  const manuscriptResult = await db.from("scholar_manuscripts")
    .select("id,title,subtitle,authors,affiliations,keywords,citation_ids,citation_style")
    .eq("project_id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (manuscriptResult.error) throw new Error("Não foi possível carregar o manuscrito salvo.");
  const manuscript = manuscriptResult.data;
  if (!manuscript) throw new Error("Salve um artigo em Escrever artigo antes de exportar.");
  const citationIds = strings(manuscript.citation_ids);
  const [sections, articles, response] = await Promise.all([
    db.from("scholar_manuscript_sections").select("section_key,heading,content")
      .eq("manuscript_id", manuscript.id).eq("owner_id", ownerId).order("position"),
    citationIds.length ? db.from("library_articles").select("id,title,authors,journal,publication_year,doi,pmid")
      .eq("owner_id", ownerId).in("id", citationIds) : Promise.resolve({ data: [], error: null }),
    fetcher(`/api/results?project=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: AbortSignal.timeout(20000) }),
  ]);
  if (sections.error) throw new Error("Não foi possível carregar as seções salvas.");
  if (articles.error) throw new Error("Não foi possível conferir as referências citadas.");
  if (!response.ok) throw new Error("Não foi possível conferir os resultados salvos. Tente novamente antes de exportar.");
  const body = await response.json();
  if (!body || (body.workspace !== null && !validWorkspace(body.workspace))) throw new Error("Confira os resultados salvos antes de exportar.");
  return {
    input: {
      title: manuscript.title, subtitle: manuscript.subtitle,
      authors: strings(manuscript.authors).join("\n"), affiliations: strings(manuscript.affiliations).join("\n"),
      keywords: strings(manuscript.keywords).join(", "), sections: sections.data || [],
      references: formattedCitedReferences(citationIds, articles.data || [], manuscript.citation_style || "vancouver"),
    },
    results: body.workspace,
  };
}

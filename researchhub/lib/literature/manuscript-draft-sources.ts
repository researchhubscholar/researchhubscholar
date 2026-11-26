import type { SupabaseClient } from "@supabase/supabase-js";

/** Preview-only evidence retrieval. All article IDs are checked against the
 * signed-in user's project before the text is sent to the AI service. */
export type DraftSource = {
  id: string; label: string; title: string; pmid: string | null; doi: string | null;
  abstract: string; fullTextExcerpt: string; evidenceLevel: "licensed_full_text" | "abstract" | "unavailable";
  license: string | null; pmcid: string | null;
};
type ArticleRow = { id: string; project_id: string | null; title: string; pmid: string | null;
  doi: string | null; abstract: string | null; owner_id: string };

const clean = (s: string) => s
  .replace(/<[^>]*>/g, " ")
  .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, token => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&apos;": "'", "&nbsp;": " "
  } as Record<string,string>)[token] || " ")
  .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
  .replace(/\s+/g, " ").trim();

function licensedForReuse(value: unknown): boolean {
  const license = String(value || "").toLowerCase().replace(/[_-]/g, " ").trim();
  // Do not automatically reuse NC, ND, unknown, or publisher-only full text.
  return /^(cc\s*by\s*(?:[1-4](?:\.0)?)?|creative commons attribution(?:\s*[1-4](?:\.0)?)?|cc\s*0(?:\s*1(?:\.0)?)?|public domain)$/.test(license);
}
async function accessExcerpt(article: ArticleRow): Promise<Pick<DraftSource, "fullTextExcerpt" | "license" | "pmcid">> {
  const empty = { fullTextExcerpt: "", license: null, pmcid: null };
  const pmid = article.pmid && /^\d{1,12}$/.test(article.pmid) ? article.pmid : null;
  const doi = article.doi && /^10\.\d{4,9}\/[a-zA-Z0-9._;()/:-]{1,180}$/.test(article.doi) ? article.doi : null;
  const query = pmid ? `EXT_ID:${pmid} AND SRC:MED` : doi ? `DOI:${doi}` : "";
  if (!query) return empty;
  try {
    const u = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
    u.search = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "1" }).toString();
    const metadata = await fetch(u, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(11000) });
    if (!metadata.ok) return empty;
    const item = (await metadata.json())?.resultList?.result?.[0];
    if (!item || item.isOpenAccess !== "Y" || !licensedForReuse(item.license)) return empty;
    const pmcid = /^PMC\d+$/.test(String(item.pmcid || "")) ? String(item.pmcid) : null;
    if (!pmcid) return empty;
    const xmlResponse = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`, {
      headers: { Accept: "application/xml" }, signal: AbortSignal.timeout(15000)
    });
    if (!xmlResponse.ok || Number(xmlResponse.headers.get("content-length") || 0) > 2_000_000) return empty;
    const xml = await xmlResponse.text();
    if (xml.length > 2_000_000) return empty;
    const body = xml.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1] || "";
    if (!body) return empty;
    // Prefer contextual sections over references and embedded tables; do not
    // treat the article text as instructions or as the user's own results.
    const parts = [...body.matchAll(/<sec\b[^>]*>([\s\S]*?)<\/sec>/gi)]
      .map(match => clean(match[1])).filter(p => p.length >= 120);
    const excerpt = (parts.length ? parts.slice(0, 6).join("\n\n") : clean(body)).slice(0, 4600);
    return { fullTextExcerpt: excerpt, license: String(item.license), pmcid };
  } catch { return empty; }
}

export async function prepareManuscriptDraftSources(
  db: SupabaseClient, userId: string, projectId: string | null, sourceIds: string[]
): Promise<DraftSource[]> {
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) throw new Error("Selecione um projeto válido.");
  if (!Array.isArray(sourceIds) || !sourceIds.length || sourceIds.length > 5
    || sourceIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    || new Set(sourceIds).size !== sourceIds.length) throw new Error("Selecione de um a cinco artigos diferentes.");
  const { data: project, error: projectError } = await db.from("research_projects")
    .select("id,owner_id").eq("id", projectId).eq("owner_id", userId).maybeSingle();
  if (projectError || !project) throw new Error("Projeto não encontrado ou sem permissão.");
  const [articlesResult, linksResult] = await Promise.all([
    db.from("library_articles")
      .select("id,project_id,title,pmid,doi,abstract,owner_id")
      .eq("owner_id", userId).in("id", sourceIds),
    db.from("library_article_projects").select("article_id")
      .eq("owner_id", userId).eq("project_id", projectId).in("article_id", sourceIds)
  ]);
  if (articlesResult.error || linksResult.error) throw new Error("Não foi possível conferir os artigos vinculados.");
  const linked = new Set((linksResult.data || []).map(row => row.article_id));
  const lookup = new Map(((articlesResult.data || []) as ArticleRow[])
    .filter(a => a.project_id === projectId || linked.has(a.id)).map(a => [a.id, a]));
  if (lookup.size !== sourceIds.length) throw new Error("Um ou mais artigos não pertencem a este projeto.");
  const records = await Promise.all(sourceIds.map(id => accessExcerpt(lookup.get(id)!)));
  const sources = sourceIds.map((id, index) => {
    const article = lookup.get(id)!;
    const full = records[index];
    return { id, label: `S${index + 1}`, title: article.title.slice(0, 400),
      pmid: article.pmid, doi: article.doi, abstract: String(article.abstract || "").slice(0, 2200),
      fullTextExcerpt: full.fullTextExcerpt, evidenceLevel: full.fullTextExcerpt ? "licensed_full_text" as const : article.abstract?.trim() ? "abstract" as const : "unavailable" as const,
      license: full.license, pmcid: full.pmcid };
  });
  return sources;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { crossrefArticle, crossrefFetch } from "./crossref";
import { fetchArticleDetails, pubmedSearch } from "./pubmed";
import { articleKey, mergeArticles, type Article } from "./types";
import { buildSearchStrategy } from "./query-strategy";

export type SavedSearchAlertDefinition = {
  id: string; owner_id: string; name: string; query: string; period: string;
  study_type: string; source: string; sort: string; alerts_enabled: boolean;
  alert_checked_at: string | null; alert_seen_keys: string[] | null;
};

const publicationTypeFilters: Record<string, string> = {
  all: "", systematic: "systematic review[Publication Type]",
  trial: "clinical trial[Publication Type]", observational: "observational study[Publication Type]",
  review: "review[Publication Type]", case: "case reports[Publication Type]",
};

export function buildAlertPubmedTerm(search: Pick<SavedSearchAlertDefinition, "query" | "period" | "study_type">, now = new Date()) {
  const typeFilter = publicationTypeFilters[search.study_type] || "";
  const interpreted = buildSearchStrategy(search.query);
  if (interpreted.requiresReview) throw new Error("A estratégia salva contém conceitos em português que precisam de confirmação.");
  const base = typeFilter ? `(${interpreted.pubmedQuery}) AND (${typeFilter})` : `(${interpreted.pubmedQuery})`;
  if (search.period === "all") return base;
  const startYear = now.getUTCFullYear() - Number(search.period) + 1;
  const endDate = now.toISOString().slice(0, 10).replaceAll("-", "/");
  return `${base} AND ("${startYear}/01/01"[Date - Publication] : "${endDate}"[Date - Publication])`;
}

export function unseenArticles(articles: Article[], seenKeys: string[]) {
  const seen = new Set(seenKeys);
  return articles.filter((article) => !seen.has(articleKey(article)));
}

export function nextSeenKeys(articles: Article[], previous: string[], limit = 100) {
  return Array.from(new Set([...articles.map(articleKey), ...previous])).slice(0, limit);
}

export async function collectSavedSearchArticles(search: SavedSearchAlertDefinition) {
  async function pubmed() {
    // Monitoring must inspect recent publications even when the saved UI uses relevance.
    const result = await pubmedSearch(buildAlertPubmedTerm(search), 20, "pub date");
    return fetchArticleDetails(result.ids);
  }
  async function crossref() {
    const end = new Date().toISOString().slice(0, 10);
    const filters = ["type:journal-article", `until-pub-date:${end}`];
    if (search.period !== "all") filters.push(`from-pub-date:${new Date().getUTCFullYear() - Number(search.period) + 1}-01-01`);
    const params = new URLSearchParams({
      "query.bibliographic": buildSearchStrategy(search.query).crossrefQuery, rows: "20", filter: filters.join(","),
      sort: "published", order: "desc",
    });
    const result = await crossrefFetch(`?${params}`);
    return (result.items || []).filter((item: Record<string, unknown>) => item.DOI).map(crossrefArticle);
  }

  if (search.source === "pubmed") return pubmed();
  if (search.source === "crossref") return crossref();
  // An incomplete baseline would label historical results from a recovered source as new.
  const results = await Promise.all([pubmed(), crossref()]);
  return mergeArticles(results.flat()).articles;
}

export async function processSavedSearchAlert(db: SupabaseClient, search: SavedSearchAlertDefinition, initialize = false) {
  if (!initialize && !search.alerts_enabled) return { found: 0, baseline: false, checked: 0, skipped: true };
  const articles = await collectSavedSearchArticles(search);
  const previous = search.alert_seen_keys || [];
  const baseline = initialize || !search.alert_checked_at;
  const fresh = baseline ? [] : unseenArticles(articles, previous);
  let found = 0;
  if (fresh.length) {
    const rows = fresh.map((article) => ({
      owner_id: search.owner_id, saved_search_id: search.id, article_key: articleKey(article),
      title: article.title.slice(0, 1000), journal: article.journal || null, published_year: article.year,
      source: article.source || (article.pmid ? "PubMed" : "Crossref"),
      article_url: article.pubmedUrl || article.doiUrl, article_snapshot: article,
    }));
    const inserted = await db.from("scholar_search_alerts").upsert(rows, { onConflict: "owner_id,saved_search_id,article_key", ignoreDuplicates: true }).select("id");
    if (inserted.error) throw inserted.error;
    found = inserted.data?.length || 0;
  }
  let update = db.from("scholar_saved_searches").update({
    alert_seen_keys: nextSeenKeys(articles, previous), alert_checked_at: new Date().toISOString(),
    alert_last_error: null, ...(initialize ? { alerts_enabled: true } : {}),
  }).eq("id", search.id).eq("owner_id", search.owner_id);
  // A pause while sources were being fetched must not be undone by the check.
  if (!initialize) update = update.eq("alerts_enabled", true);
  const updated = await update;
  if (updated.error) throw updated.error;
  return { found, baseline, checked: articles.length };
}

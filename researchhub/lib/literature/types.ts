export type Article = {
  pmid: string | null; doi: string | null; title: string; authors: string[];
  journal: string; pubdate: string; year: number | null; publicationTypes: string[];
  abstract: string | null; pubmedUrl: string | null; doiUrl: string | null;
  source?: "PubMed" | "Crossref"; duplicateSources?: ("PubMed" | "Crossref")[]; savedAt?: string;
};
// Existing PMID keys remain unchanged, preserving older evidence notes.
export function articleKey(article: Article): string {
  return article.pmid || `doi:${article.doi?.trim().toLowerCase()}`;
}
export function sameArticle(a: Article, b: Article): boolean {
  return Boolean((a.pmid && b.pmid && a.pmid === b.pmid) ||
    (a.doi && b.doi && a.doi.trim().toLowerCase() === b.doi.trim().toLowerCase()));
}

export function mergeArticles(articles: Article[]): { articles: Article[]; duplicateCount: number } {
  const merged: Article[] = [];
  let duplicateCount = 0;
  for (const article of articles) {
    const index = merged.findIndex(existing => sameArticle(existing, article));
    if (index < 0) {
      merged.push({ ...article, duplicateSources: article.source ? [article.source] : [] });
      continue;
    }
    duplicateCount += 1;
    const existing = merged[index];
    const sources = Array.from(new Set([...(existing.duplicateSources || (existing.source ? [existing.source] : [])), ...(article.source ? [article.source] : [])]));
    merged[index] = {
      ...article,
      ...existing,
      pmid: existing.pmid || article.pmid,
      doi: existing.doi || article.doi,
      abstract: existing.abstract || article.abstract,
      pubmedUrl: existing.pubmedUrl || article.pubmedUrl,
      doiUrl: existing.doiUrl || article.doiUrl,
      duplicateSources: sources,
    };
  }
  return { articles: merged, duplicateCount };
}

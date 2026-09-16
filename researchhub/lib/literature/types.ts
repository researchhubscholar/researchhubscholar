export type Article = {
  pmid: string | null; doi: string | null; title: string; authors: string[];
  journal: string; pubdate: string; year: number | null; publicationTypes: string[];
  abstract: string | null; pubmedUrl: string | null; doiUrl: string | null;
  source?: "PubMed" | "Crossref"; savedAt?: string;
};
// Existing PMID keys remain unchanged, preserving older evidence notes.
export function articleKey(article: Article): string {
  return article.pmid || `doi:${article.doi?.trim().toLowerCase()}`;
}
export function sameArticle(a: Article, b: Article): boolean {
  return Boolean((a.pmid && b.pmid && a.pmid === b.pmid) ||
    (a.doi && b.doi && a.doi.trim().toLowerCase() === b.doi.trim().toLowerCase()));
}

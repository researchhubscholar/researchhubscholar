type CitationArticle = { title: string; authors: unknown; journal?: string | null; publication_year: number | null; doi: string | null; pmid: string | null };
const sentence = (value: string) => /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;
function authorNames(article: CitationArticle) {
  if (!Array.isArray(article.authors) || !article.authors.length) return ["Autor não informado"];
  return article.authors.map(author => {
    if (typeof author === "string") return author;
    if (author && typeof author === "object") {
      const data = author as Record<string, unknown>;
      return String(data.name || [data.family, data.given].filter(Boolean).join(" ") || "Autor não informado");
    }
    return "Autor não informado";
  }).filter(Boolean);
}
export function formattedReference(article: CitationArticle, index: number, style: string) {
  const authors = authorNames(article);
  const locator = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : "";
  const title = sentence(article.title);
  const journal = article.journal?.trim() ? `${sentence(article.journal)} ` : "";
  const year = sentence(String(article.publication_year || "s.d."));
  if (style === "abnt") return `${sentence(authors.map(name => name.toUpperCase()).join("; "))} ${title} ${journal}${year}${locator ? ` Disponível em: ${locator}.` : ""}`;
  const authorList = authors.length > 6 ? `${authors.slice(0, 6).join(", ")}, et al.` : sentence(authors.join(", "));
  return `${index + 1}. ${authorList} ${title} ${journal}${year}${locator ? ` ${locator}` : ""}`;
}

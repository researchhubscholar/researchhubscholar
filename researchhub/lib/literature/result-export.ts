import type { Article } from "./types";

const clean = (value: unknown) => String(value ?? "").replace(/\r?\n/g, " ").trim();
const csv = (value: unknown) => `"${clean(value).replaceAll('"', '""')}"`;

export function resultCsv(articles: Article[]) {
  const headings = ["Título", "Autores", "Ano", "Periódico", "Fonte", "Tipos", "PMID", "DOI", "Link"];
  const rows = articles.map(article => [article.title, article.authors.join("; "), article.year, article.journal,
    (article.duplicateSources?.length ? article.duplicateSources : [article.source]).filter(Boolean).join(" + "),
    article.publicationTypes.join("; "), article.pmid, article.doi, article.pubmedUrl || article.doiUrl].map(csv).join(","));
  return `\uFEFF${headings.map(csv).join(",")}\n${rows.join("\n")}`;
}

export function resultRis(articles: Article[]) {
  return articles.map(article => ["TY  - JOUR", `TI  - ${clean(article.title)}`, ...article.authors.map(author => `AU  - ${clean(author)}`),
    article.journal && `JO  - ${clean(article.journal)}`, article.year && `PY  - ${article.year}`, article.doi && `DO  - ${clean(article.doi)}`,
    article.pmid && `AN  - PMID:${clean(article.pmid)}`, article.abstract && `AB  - ${clean(article.abstract)}`, "ER  - "].filter(Boolean).join("\n")).join("\n\n");
}

export function resultBibtex(articles: Article[]) {
  return articles.map((article, index) => `@article{radar${article.year || "nd"}_${index + 1},\n  title = {${clean(article.title)}},\n  author = {${article.authors.map(clean).join(" and ")}},\n  journal = {${clean(article.journal)}},\n  year = {${article.year || ""}},\n  doi = {${clean(article.doi)}},\n  pmid = {${clean(article.pmid)}}\n}`).join("\n\n");
}

export function downloadResult(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

import { Article } from "./types";
import { decodeXml } from "./pubmed";
export async function crossrefFetch(path: string) {
  const response = await fetch(`https://api.crossref.org/works${path}`, {
    headers: { Accept: "application/json", "User-Agent": "ResearchHub-Scholar/0.1" },
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Artigo não encontrado no Crossref." : "Crossref indisponível. Tente novamente.");
  return (await response.json()).message;
}
export function crossrefArticle(item: any): Article {
  const date = item.published?.["date-parts"]?.[0] || item["published-print"]?.["date-parts"]?.[0] || item["published-online"]?.["date-parts"]?.[0] || [];
  const doi = String(item.DOI || "").trim();
  return { pmid: null, doi, title: decodeXml(item.title?.[0] || "Título não informado"),
    authors: (item.author || []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ") || a.name || "").filter(Boolean),
    journal: item["container-title"]?.[0] || "", pubdate: date.join("-"), year: date[0] || null,
    publicationTypes: [item.type === "journal-article" ? "Artigo de periódico" : item.type || "Publicação"],
    abstract: item.abstract ? decodeXml(item.abstract) : null, pubmedUrl: null, doiUrl: `https://doi.org/${doi}`, source: "Crossref" };
}

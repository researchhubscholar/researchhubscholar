import { NextRequest, NextResponse } from "next/server";
import { fetchArticleDetails } from "@/lib/literature/pubmed";
import { crossrefFetch, crossrefArticle } from "@/lib/literature/crossref";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let identifier = String(body.identifier || "").trim();
    if (identifier.length > 500) return NextResponse.json({ error: "Identificador muito longo." }, { status: 400 });
    if (/^https?:\/\//i.test(identifier)) {
      const url = new URL(identifier);
      if (["doi.org", "dx.doi.org"].includes(url.hostname)) identifier = decodeURIComponent(url.pathname.slice(1));
      else if (url.hostname === "pubmed.ncbi.nlm.nih.gov") identifier = url.pathname.split("/").filter(Boolean)[0] || "";
      else return NextResponse.json({ error: "Cole o DOI, PMID ou um link de doi.org ou PubMed." }, { status: 400 });
    }
    identifier = identifier.replace(/^(doi|pmid)\s*:\s*/i, "");
    if (/^\d{1,9}$/.test(identifier)) {
      const [article] = await fetchArticleDetails([identifier]);
      if (!article || article.title === "Sem título") return NextResponse.json({ error: "PMID não encontrado." }, { status: 404 });
      return NextResponse.json({ article });
    }
    if (!/^10\.\d{4,9}\/\S+$/i.test(identifier)) return NextResponse.json({ error: "Informe um DOI ou PMID válido." }, { status: 400 });
    const article = crossrefArticle(await crossrefFetch(`/${encodeURIComponent(identifier)}`));
    return NextResponse.json({ article });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível recuperar este artigo." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchArticleDetails, pubmedSearch } from "@/lib/literature/pubmed";
import { crossrefArticle, crossrefFetch } from "@/lib/literature/crossref";
import { matchBibliography } from "@/lib/literature/bibliography";

export async function POST(request: Request) {
  try {
    const db = await supabaseServer();
    const {data: {user}} = await db.auth.getUser();
    if (!user) return NextResponse.json({error: "Entre na sua conta."}, {status: 401});
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const authors = typeof body?.authors === "string" ? body.authors.slice(0, 3000).split(";").map((s: string) => s.trim()).filter(Boolean) : [];
    const journal = typeof body?.journal === "string" ? body.journal.trim().slice(0, 500) : "";
    const doi = typeof body?.doi === "string" ? body.doi.trim().slice(0, 250) : "";
    if (title.length < 5 || title.length > 500 || (!doi && (!authors.length || !journal))) return NextResponse.json({error: "Informe título, autores e periódico, ou título e DOI."}, {status: 400});
    const input = {title, authors, journal, doi, year: /^\d{4}$/.test(body?.year) ? Number(body.year) : undefined};
    const term = title.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
    if (!term) return NextResponse.json({article: null});
    const sources = await Promise.allSettled([
      pubmedSearch(`"${term}"[Title]`, 6).then(result => fetchArticleDetails(result.ids)),
      crossrefFetch(`?${new URLSearchParams({"query.bibliographic": title, rows: "6"})}`).then(result => (result.items || []).map(crossrefArticle)),
    ]);
    if (sources.every(source => source.status === "rejected")) return NextResponse.json({error: "As fontes estão indisponíveis."}, {status: 502});
    const article = matchBibliography(input, sources.flatMap(source => source.status === "fulfilled" ? source.value : []));
    return NextResponse.json({article});
  } catch {
    return NextResponse.json({error: "Não foi possível consultar a ficha."}, {status: 502});
  }
}

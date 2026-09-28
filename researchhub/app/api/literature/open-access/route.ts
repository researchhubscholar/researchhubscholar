import { NextRequest, NextResponse } from "next/server";
import { resolveOpenAccess } from "@/lib/literature/open-access";

type Input = { key: string; pmid: string | null; doi: string | null };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const articles = Array.isArray(body.articles) ? body.articles as Input[] : [];
    if (!articles.length || articles.length > 20 || articles.some(item =>
      typeof item.key !== "string" || item.key.length > 350 ||
      (item.pmid !== null && !/^\d{1,12}$/.test(String(item.pmid))) ||
      (item.doi !== null && !/^10\.\d{4,9}\/\S{1,280}$/i.test(String(item.doi))) ||
      (!item.pmid && !item.doi))) {
      return NextResponse.json({ error: "Artigos inválidos para verificação." }, { status: 400 });
    }
    const settled = await Promise.all(articles.map(async article => ({ key: article.key, result: await resolveOpenAccess(article) })));
    return NextResponse.json({ results: Object.fromEntries(settled.map(item => [item.key, item.result])) });
  } catch {
    return NextResponse.json({ error: "Não foi possível verificar o acesso aberto agora." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { processSavedSearchAlert, type SavedSearchAlertDefinition } from "@/lib/literature/search-alerts";
import { supabaseServer } from "@/lib/supabase/server";

const fields = "id,owner_id,name,query,period,study_type,source,sort,alert_checked_at,alert_seen_keys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const savedSearchId = String(body?.savedSearchId || "");
    if (!/^[0-9a-f-]{36}$/i.test(savedSearchId)) return NextResponse.json({ error: "Busca salva inválida." }, { status: 400 });
    const db = await supabaseServer();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    const result = await db.from("scholar_saved_searches").select(fields).eq("id", savedSearchId).eq("owner_id", auth.user.id).single();
    if (result.error || !result.data) return NextResponse.json({ error: "Busca salva não encontrada. Execute scholar_search_alerts.sql se o módulo ainda não foi ativado." }, { status: 404 });
    const outcome = await processSavedSearchAlert(db, result.data as SavedSearchAlertDefinition, body?.initialize === true);
    return NextResponse.json(outcome);
  } catch (error) {
    console.error("Search alert check failed", error);
    return NextResponse.json({ error: "Não foi possível verificar novidades agora. Tente novamente." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { processSavedSearchAlert, type SavedSearchAlertDefinition } from "@/lib/literature/search-alerts";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 300;
const fields = "id,owner_id,name,query,period,study_type,source,sort,alert_checked_at,alert_seen_keys";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const db = supabaseAdmin();
    const searches = await db.from("scholar_saved_searches").select(fields).eq("alerts_enabled", true)
      .order("alert_checked_at", { ascending: true, nullsFirst: true }).limit(25);
    if (searches.error) throw searches.error;
    const outcomes: { id: string; found: number; error?: string }[] = [];
    for (const search of searches.data || []) {
      try {
        const result = await processSavedSearchAlert(db, search as SavedSearchAlertDefinition);
        outcomes.push({ id: search.id, found: result.found });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida";
        outcomes.push({ id: search.id, found: 0, error: message });
        await db.from("scholar_saved_searches").update({ alert_last_error: message }).eq("id", search.id);
      }
    }
    return NextResponse.json({ processed: outcomes.length, found: outcomes.reduce((sum, item) => sum + item.found, 0), outcomes });
  } catch (error) {
    console.error("Search alert cron failed", error);
    return NextResponse.json({ error: "Falha ao executar alertas." }, { status: 500 });
  }
}

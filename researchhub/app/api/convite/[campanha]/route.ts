import { NextResponse } from "next/server";
import { campaignIdPattern, parseLead } from "@/lib/campaigns/input";
import { campaignVisitor } from "@/lib/campaigns/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const errorResponse = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ campanha: string }> }) {
  const { campanha } = await params;
  if (campanha.length > 64 || !campaignIdPattern.test(campanha)) return errorResponse("Campanha não encontrada.", 404);
  if (request.headers.get("sec-fetch-site") === "cross-site") return errorResponse("Envie pelo formulário da campanha.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse("Solicitação inválida.", 415);
  }
  if (Number(request.headers.get("content-length")) > 4096) return errorResponse("Solicitação muito longa.", 413);

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return errorResponse("Solicitação muito longa.", 413);
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return errorResponse("Solicitação inválida.", 400);
    input = value;
  } catch {
    return errorResponse("Solicitação inválida.", 400);
  }

  try {
    const db = supabaseAdmin();
    const visitor = campaignVisitor(request.headers);
    if (input.event === "view" || input.event === "copy" || input.event === "plans") {
      const { error } = await db.rpc("scholar_campaign_event", {
        p_campaign: campanha, p_visitor: visitor, p_event: input.event,
      });
      if (error) return errorResponse("Métrica indisponível.", 503);
      return new Response(null, { status: 204 });
    }

    if (input.website) return errorResponse("Não foi possível registrar o cadastro.", 400);
    const lead = parseLead(input);
    if (typeof lead === "string") return errorResponse(lead, 400);
    const { data, error } = await db.rpc("scholar_campaign_claim", {
      p_campaign: campanha, p_visitor: visitor, p_name: lead.name, p_email: lead.email,
      p_phone: lead.phone, p_marketing: lead.marketing, p_utm_source: lead.utmSource,
      p_utm_medium: lead.utmMedium, p_utm_campaign: lead.utmCampaign,
    });
    if (!error && data?.status === "ok" && typeof data.code === "string") {
      return NextResponse.json({ code: data.code, validUntil: data.validUntil }, { headers: { "Cache-Control": "no-store" } });
    }
    if (data?.status === "expired") return NextResponse.json({ expired: true }, { headers: { "Cache-Control": "no-store" } });
    if (data?.status === "inactive") return errorResponse("Esta campanha está indisponível.", 409);
    if (data?.status === "limited") return errorResponse("Muitos cadastros nesta conexão. Tente novamente em alguns minutos.", 429);
  } catch {
    // Return a generic error without capturing contact data in logs.
  }
  return errorResponse("Não foi possível registrar seu cadastro agora. Tente novamente.", 503);
}

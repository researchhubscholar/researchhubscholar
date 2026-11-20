import "server-only";
import { createHmac } from "node:crypto";
import { visitorHash } from "@/lib/public/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function campaignVisitor(headers: Headers) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Campanha indisponível.");
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", key).update("campaign:" + day + ":" + visitorHash(headers)).digest("hex");
}

export async function campaignOffer(campaign: string) {
  try {
    const { data, error } = await supabaseAdmin().rpc("scholar_campaign_offer", { p_campaign: campaign });
    if (error || typeof data?.title !== "string" || typeof data?.subtitle !== "string" || !Number.isSafeInteger(data.discountCents)) return null;
    return { title: data.title as string, subtitle: data.subtitle as string, available: data.available === true, discountCents: data.discountCents as number };
  } catch {
    return null;
  }
}

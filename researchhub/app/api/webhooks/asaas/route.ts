import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authorizedWebhookToken, parsePaidCheckout } from "@/lib/access/asaas-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Register this URL as an Asaas Checkout webhook with an authToken:
 * https://researchhub.com.br/api/webhooks/asaas
 * Recommended event: CHECKOUT_PAID (optionally CREATED/CANCELED/EXPIRED).
 * The checkout must already be linked to a scholar_purchase_requests row.
 */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || expected.length < 32) {
    console.error("[asaas:webhook] Missing or weak ASAAS_WEBHOOK_TOKEN");
    return json({ error: "Webhook não configurado" }, 503);
  }
  if (!authorizedWebhookToken(request.headers.get("asaas-access-token"), expected)) {
    return json({ error: "Webhook não autorizado" }, 401);
  }
  const size = Number(request.headers.get("content-length") || "0");
  if (size > 100_000) return json({ error: "Payload muito grande" }, 413);

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 100_000) return json({ error: "Payload muito grande" }, 413);
    payload = JSON.parse(body);
  } catch {
    return json({ error: "Payload JSON inválido" }, 400);
  }

  let paid: ReturnType<typeof parsePaidCheckout>;
  try {
    paid = parsePaidCheckout(payload);
  } catch (error) {
    console.warn("[asaas:webhook] Invalid paid checkout", { reason: error instanceof Error ? error.message : "invalid" });
    return json({ error: "Evento de pagamento inválido" }, 422);
  }
  if (!paid) return json({ received: true, ignored: true });

  const admin = supabaseAdmin();
  const { data: purchase, error: lookupError } = await admin
    .from("scholar_purchase_requests")
    .select("id,status,provider_checkout_id,total_amount_cents,fulfilled_license_id")
    .eq("provider_checkout_id", paid.checkoutId)
    .maybeSingle();
  if (lookupError) {
    console.error("[asaas:webhook] Purchase lookup failed", { code: lookupError.code });
    return json({ error: "Não foi possível localizar a compra" }, 503);
  }
  if (!purchase) {
    // An event received before its checkout is linked must be retried by Asaas.
    console.warn("[asaas:webhook] Checkout not yet linked", { eventId: paid.eventId });
    return json({ error: "Checkout ainda não vinculado à compra" }, 503);
  }
  if (paid.externalReference && paid.externalReference !== purchase.id) {
    console.error("[asaas:webhook] Checkout reference does not match order", { eventId: paid.eventId });
    return json({ error: "Referência divergente" }, 409);
  }
  if (paid.chargedCents !== purchase.total_amount_cents) {
    console.error("[asaas:webhook] Checkout amount mismatch", { eventId: paid.eventId });
    return json({ error: "Valor divergente" }, 409);
  }
  if (purchase.status === "activated" && purchase.fulfilled_license_id) {
    return json({ received: true, alreadyActivated: true });
  }
  if (!["approved", "payment_pending"].includes(purchase.status)) {
    console.warn("[asaas:webhook] Paid checkout requires reconciliation", { eventId: paid.eventId, status: purchase.status });
    return json({ error: "Compra sem estado válido para ativação" }, 409);
  }

  const { data: licenseId, error: fulfillError } = await admin.rpc("scholar_fulfill_paid_request", {
    p_request: purchase.id,
    p_provider_event: paid.eventId,
    p_provider_payment: null,
    p_provider_subscription: null,
  });
  if (fulfillError) {
    // Retry is safe: database transaction and unique event ID prevent double grants.
    console.error("[asaas:webhook] Fulfillment failed", { code: fulfillError.code, eventId: paid.eventId });
    return json({ error: "Falha na ativação da licença" }, 503);
  }

  // The SQL function was originally authored for Stripe and defaults provider='stripe'.
  // Correct this record without altering payment amounts, tokens or the license.
  const { error: providerError } = await admin.from("scholar_payment_events")
    .update({ provider: "asaas" }).eq("provider_event_id", paid.eventId);
  if (providerError) {
    console.warn("[asaas:webhook] Provider label reconciliation needed", { code: providerError.code, eventId: paid.eventId });
  }
  console.info("[asaas:webhook] Purchase activated", { purchaseId: purchase.id, hasLicense: Boolean(licenseId) });
  return json({ received: true, activated: Boolean(licenseId) });
}

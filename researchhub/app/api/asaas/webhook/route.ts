import { validAsaasWebhookToken, verifiedAsaasPaidCheckout, type CheckoutPayload } from "@/lib/access/asaas-security";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Event = { id?: unknown; event?: unknown; checkout?: CheckoutPayload };
type Purchase = {
  id: string; status: string; kind: string; total_amount_cents: number;
  provider_checkout_id: string; fulfilled_license_id: string | null;
};

export async function POST(request: Request) {
  if (!validAsaasWebhookToken(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 128_000)
    return NextResponse.json({ error: "Evento muito grande." }, { status: 413 });
  let event: Event;
  try { event = await request.json() as Event; }
  catch { return NextResponse.json({ error: "Evento inválido." }, { status: 400 }); }
  if (typeof event.id !== "string" || !event.id || typeof event.event !== "string")
    return NextResponse.json({ error: "Evento incompleto." }, { status: 400 });
  // Asaas can deliver payment and other events to the same webhook.
  // Ignoring unrelated authenticated events prevents unnecessary queue retries.
  if (!["CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(event.event))
    return NextResponse.json({ received: true, ignored: true });
  if (!event.checkout || typeof event.checkout.id !== "string" || !event.checkout.id)
    return NextResponse.json({ error: "Checkout incompleto." }, { status: 400 });
  const checkout = event.checkout;
  const db = supabaseAdmin();
  const { data, error } = await db.from("scholar_purchase_requests")
    .select("id,status,kind,total_amount_cents,provider_checkout_id,fulfilled_license_id")
    .eq("provider_checkout_id", checkout.id).maybeSingle();
  if (error) {
    console.error("[asaas:webhook] lookup failed", { event: event.event, eventId: event.id });
    return NextResponse.json({ error: "Consulta indisponível." }, { status: 503 });
  }
  if (!data) {
    // Do not acknowledge payment of an unlinked checkout: the provider will retry.
    console.error("[asaas:webhook] unlinked checkout", { event: event.event, checkoutId: checkout.id });
    return NextResponse.json({ error: "Checkout não vinculado." }, { status: 503 });
  }
  const purchase = data as Purchase;
  if (typeof checkout.externalReference === "string" && checkout.externalReference !== purchase.id) {
    console.error("[asaas:webhook] external reference mismatch", { requestId: purchase.id });
    return NextResponse.json({ error: "Referência incompatível." }, { status: 409 });
  }

  if (event.event === "CHECKOUT_PAID") {
    if (!verifiedAsaasPaidCheckout(event.event, checkout, purchase.id, purchase.provider_checkout_id, purchase.total_amount_cents)) {
      console.error("[asaas:webhook] paid checkout mismatch", { requestId: purchase.id });
      return NextResponse.json({ error: "Valor ou estado incompatível." }, { status: 409 });
    }
    if (purchase.status === "activated" && purchase.fulfilled_license_id) {
      const { error: providerError } = await db.from("scholar_payment_events")
        .update({ provider: "asaas" }).eq("purchase_request_id", purchase.id);
      if (providerError) return NextResponse.json({ error: "Conciliação pendente." }, { status: 503 });
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }
    if (!["requested", "approved", "payment_pending"].includes(purchase.status)) {
      console.error("[asaas:webhook] paid checkout in invalid state", { requestId: purchase.id, status: purchase.status });
      return NextResponse.json({ error: "Pedido requer conciliação." }, { status: 409 });
    }
    // Server-side only: fulfillment is a SECURITY DEFINER RPC granted to service_role.
    // Its transaction credits tokens and records a unique provider event ID.
    const { data: licenseId, error: fulfillError } = await db.rpc("scholar_fulfill_paid_request", {
      p_request: purchase.id,
      p_provider_event: event.id,
      p_provider_payment: checkout.id,
      p_provider_subscription: null,
    });
    if (fulfillError || !licenseId) {
      console.error("[asaas:webhook] fulfillment failed", { requestId: purchase.id, code: fulfillError?.code });
      return NextResponse.json({ error: "Ativação pendente, tente novamente." }, { status: 503 });
    }
    // The preexisting scholar_fulfill_paid_request SQL defaults provider to "stripe".
    // Correct the ledger's provider without a database-function migration.
    const { error: providerError } = await db.from("scholar_payment_events")
      .update({ provider: "asaas" }).eq("provider_event_id", event.id)
      .eq("purchase_request_id", purchase.id);
    if (providerError) return NextResponse.json({ error: "Conciliação pendente." }, { status: 503 });
    console.info("[asaas:webhook] license activated", { requestId: purchase.id });
    return NextResponse.json({ received: true });
  }

  if (event.event === "CHECKOUT_CANCELED" || event.event === "CHECKOUT_EXPIRED") {
    const expected = event.event === "CHECKOUT_CANCELED" ? "CANCELED" : "EXPIRED";
    if (checkout.status !== expected) return NextResponse.json({ error: "Estado incompatível." }, { status: 409 });
    const { error: updateError } = await db.from("scholar_purchase_requests").update({
      status: event.event === "CHECKOUT_CANCELED" ? "cancelled" : "expired",
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id).in("status", ["requested", "approved", "payment_pending"]);
    if (updateError) return NextResponse.json({ error: "Estado não atualizado." }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}

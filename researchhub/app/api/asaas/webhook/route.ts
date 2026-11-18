import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Checkout = {
  id?: unknown; status?: unknown; externalReference?: unknown;
  items?: Array<{ value?: unknown; quantity?: unknown }>;
};
type Event = { id?: unknown; event?: unknown; checkout?: Checkout };
type Purchase = {
  id: string; status: string; kind: string; total_amount_cents: number;
  provider_checkout_id: string; fulfilled_license_id: string | null;
};

function validToken(received: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function totalCheckoutCents(checkout: Checkout): number | null {
  if (!Array.isArray(checkout.items) || !checkout.items.length) return null;
  let cents = 0;
  for (const item of checkout.items) {
    if (typeof item.value !== "number" || !Number.isFinite(item.value)
        || !Number.isInteger(item.quantity) || Number(item.quantity) < 1) return null;
    const value = Math.round(item.value * 100);
    if (Math.abs(item.value * 100 - value) > 0.001 || value < 0) return null;
    cents += value * Number(item.quantity);
  }
  return Number.isSafeInteger(cents) ? cents : null;
}

export async function POST(request: Request) {
  if (!validToken(request.headers.get("asaas-access-token")))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 128_000)
    return NextResponse.json({ error: "Evento muito grande." }, { status: 413 });
  let event: Event;
  try { event = await request.json() as Event; }
  catch { return NextResponse.json({ error: "Evento inválido." }, { status: 400 }); }
  if (typeof event.id !== "string" || !event.id || typeof event.event !== "string"
      || !event.checkout || typeof event.checkout.id !== "string" || !event.checkout.id)
    return NextResponse.json({ error: "Evento incompleto." }, { status: 400 });
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
    if (checkout.status !== "PAID" || totalCheckoutCents(checkout) !== purchase.total_amount_cents) {
      console.error("[asaas:webhook] paid checkout mismatch", { requestId: purchase.id });
      return NextResponse.json({ error: "Valor ou estado incompatível." }, { status: 409 });
    }
    if (purchase.status === "activated" && purchase.fulfilled_license_id)
      return NextResponse.json({ received: true, alreadyProcessed: true });
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
    console.info("[asaas:webhook] license activated", { requestId: purchase.id });
    return NextResponse.json({ received: true });
  }

  if (event.event === "CHECKOUT_CANCELED" || event.event === "CHECKOUT_EXPIRED") {
    const expected = event.event === "CHECKOUT_CANCELED" ? "CANCELED" : "EXPIRED";
    if (checkout.status !== expected) return NextResponse.json({ error: "Estado incompatível." }, { status: 409 });
    await db.from("scholar_purchase_requests").update({
      status: event.event === "CHECKOUT_CANCELED" ? "cancelled" : "expired",
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id).in("status", ["requested", "approved", "payment_pending"]);
  }
  return NextResponse.json({ received: true });
}

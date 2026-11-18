import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutEvent = {
  id?: string;
  event?: string;
  checkout?: {
    id?: string;
    status?: string;
    externalReference?: string;
  };
};

function validToken(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Reject unauthenticated events BEFORE parsing or touching the database.
  if (!validToken(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > 65_536) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  let event: CheckoutEvent;
  try {
    event = JSON.parse(raw) as CheckoutEvent;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!event.id || typeof event.id !== "string" || !event.checkout?.id ||
      !event.checkout.externalReference || typeof event.event !== "string") {
    return NextResponse.json({ error: "Evento incompleto" }, { status: 400 });
  }

  const { id: checkoutId, externalReference: requestId, status } = event.checkout;
  const admin = supabaseAdmin();
  const { data: purchase, error: lookupError } = await admin
    .from("scholar_purchase_requests")
    .select("id,status,provider_checkout_id,fulfilled_license_id")
    .eq("id", requestId)
    .maybeSingle();

  if (lookupError) {
    console.error("[asaas:webhook] lookup failed", { code: lookupError.code });
    return NextResponse.json({ error: "Falha temporária" }, { status: 503 });
  }
  // Do not change any purchase if IDs do not agree with the checkout
  // created by our authenticated server route.
  if (!purchase || purchase.provider_checkout_id !== checkoutId) {
    console.warn("[asaas:webhook] unmatched checkout");
    return NextResponse.json({ error: "Checkout não corresponde ao pedido" }, { status: 409 });
  }

  if (event.event === "CHECKOUT_PAID") {
    if (status !== "PAID") return NextResponse.json({ error: "Pagamento não confirmado" }, { status: 409 });
    if (purchase.status === "activated") return NextResponse.json({ ok: true, duplicate: true });
    if (purchase.status !== "payment_pending") return NextResponse.json({ error: "Pedido indisponível" }, { status: 409 });

    // This existing security-definer function locks the request, creates the license
    // and wallet, adds the payment event, and marks it activated in ONE SQL transaction.
    const { error } = await admin.rpc("scholar_fulfill_paid_request", {
      p_request: purchase.id,
      p_provider_event: event.id,
      p_provider_payment: checkoutId,
      p_provider_subscription: null,
    });
    if (error) {
      console.error("[asaas:webhook] fulfillment failed", { code: error.code });
      return NextResponse.json({ error: "Falha temporária na ativação" }, { status: 503 });
    }
    console.info("[asaas:webhook] checkout activated");
    return NextResponse.json({ ok: true });
  }

  if (event.event === "CHECKOUT_EXPIRED" || event.event === "CHECKOUT_CANCELED") {
    if (status !== (event.event === "CHECKOUT_EXPIRED" ? "EXPIRED" : "CANCELED")) {
      return NextResponse.json({ error: "Estado divergente" }, { status: 409 });
    }
    if (purchase.status === "activated") return NextResponse.json({ ok: true, ignored: true });
    const next = event.event === "CHECKOUT_EXPIRED" ? "expired" : "cancelled";
    const { error } = await admin.from("scholar_purchase_requests")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", purchase.id).eq("provider_checkout_id", checkoutId).eq("status", "payment_pending");
    if (error) return NextResponse.json({ error: "Falha temporária" }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (event.event === "CHECKOUT_CREATED") return NextResponse.json({ ok: true });
  // Unknown events may be added by the provider in future API versions.
  return NextResponse.json({ ok: true, ignored: true });
}

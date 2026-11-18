import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkoutEventAmountCents, validPaidCheckout, type CheckoutEvent } from "@/lib/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length > 256) return false;
  const left = Buffer.from(actual), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const secret = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!secret || !secretMatches(request.headers.get("asaas-access-token"), secret))
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 });

  let body: CheckoutEvent;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return NextResponse.json({ error: "Payload excessivo" }, { status: 413 });
    body = JSON.parse(raw) as CheckoutEvent;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const event = body?.event;
  if (!["CHECKOUT_CREATED", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "CHECKOUT_PAID"].includes(String(event)))
    return NextResponse.json({ acknowledged: true, ignored: true });
  if (event !== "CHECKOUT_PAID") return NextResponse.json({ acknowledged: true, ignored: true });
  if (!validPaidCheckout(body))
    return NextResponse.json({ error: "Checkout pago sem dados verificáveis" }, { status: 422 });

  try {
    const admin = supabaseAdmin();
    // Match the provider checkout ID; never trust a customer-supplied request identifier.
    const { data: purchase, error: lookupError } = await admin.from("scholar_purchase_requests")
      .select("id,status,total_amount_cents,provider_checkout_id,fulfilled_license_id")
      .eq("provider_checkout_id", body.checkout.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!purchase) return NextResponse.json({ error: "Checkout não vinculado a uma compra" }, { status: 409 });
    const amount = checkoutEventAmountCents(body);
    if (amount !== purchase.total_amount_cents)
      return NextResponse.json({ error: "Valor do checkout divergente" }, { status: 422 });
    // Audit the correct provider even though older commerce.sql defaults to "stripe".
    const { data: existing, error: existingError } = await admin.from("scholar_payment_events")
      .select("purchase_request_id,provider").eq("provider_event_id", body.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.purchase_request_id !== purchase.id)
      return NextResponse.json({ error: "Identificador de evento reutilizado" }, { status: 409 });
    if (existing) {
      if (existing.provider !== "asaas") {
        const { error: auditError } = await admin.from("scholar_payment_events")
          .update({ provider: "asaas" }).eq("provider_event_id", body.id).eq("purchase_request_id", purchase.id);
        if (auditError) throw auditError;
      }
      return NextResponse.json({ acknowledged: true, alreadyProcessed: true });
    }
    if (purchase.status === "activated" && purchase.fulfilled_license_id)
      return NextResponse.json({ acknowledged: true, alreadyActivated: true });
    if (!["approved", "payment_pending"].includes(purchase.status))
      return NextResponse.json({ error: "Compra não elegível para ativação automática" }, { status: 409 });

    const { error: fulfillmentError } = await admin.rpc("scholar_fulfill_paid_request", {
      p_request: purchase.id,
      p_provider_event: body.id,
      p_provider_payment: body.checkout.id,
      p_provider_subscription: null,
    });
    if (fulfillmentError) throw fulfillmentError;
    const { error: auditError } = await admin.from("scholar_payment_events")
      .update({ provider: "asaas" }).eq("provider_event_id", body.id).eq("purchase_request_id", purchase.id);
    if (auditError) throw auditError;
    console.info("[asaas:checkout] paid checkout activated", { checkoutId: body.checkout.id, requestId: purchase.id });
    return NextResponse.json({ acknowledged: true, activated: true });
  } catch (error) {
    console.error("[asaas:checkout] processing failed", { code: (error as { code?: string })?.code || "unknown" });
    return NextResponse.json({ error: "Não foi possível confirmar a ativação" }, { status: 503 });
  }
}

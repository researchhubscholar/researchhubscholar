import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {recordProviderEvent,type ProviderOutcome} from "@/lib/operations/provider-events";
import { checkoutEventAmountCents, validPaidCheckout, type CheckoutEvent } from "@/lib/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length > 256) return false;
  const left = Buffer.from(actual), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const receivedAt=Date.now();
  async function result(body:Record<string,unknown>,status:number,outcome:ProviderOutcome){
    await recordProviderEvent({service:"asaas",outcome,status_code:status,duration_ms:Math.min(300000,Date.now()-receivedAt)});
    return NextResponse.json(body,{status});
  }
  const secret = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!secret || !secretMatches(request.headers.get("asaas-access-token"), secret))
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 });

  let body: CheckoutEvent;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return result({ error: "Payload excessivo" },413,"invalid_payload");
    body = JSON.parse(raw) as CheckoutEvent;
  } catch {
    return result({ error: "Payload inválido" },400,"invalid_payload");
  }
  const event = body?.event;
  if (!["CHECKOUT_CREATED", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "CHECKOUT_PAID"].includes(String(event)))
    return result({ acknowledged: true, ignored: true },200,"ignored");
  if (event !== "CHECKOUT_PAID") return result({ acknowledged: true, ignored: true },200,"ignored");
  if (!validPaidCheckout(body))
    return result({ error: "Checkout pago sem dados verificáveis" },422,"invalid_payload");

  try {
    const admin = supabaseAdmin();
    // Match the provider checkout ID; never trust a customer-supplied request identifier.
    const { data: purchase, error: lookupError } = await admin.from("scholar_purchase_requests")
      .select("id,status,total_amount_cents,provider_checkout_id,fulfilled_license_id")
      .eq("provider_checkout_id", body.checkout.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!purchase) return result({ error: "Checkout não vinculado a uma compra" },409,"unlinked_checkout");
    const amount = checkoutEventAmountCents(body);
    if (amount !== purchase.total_amount_cents)
      return result({ error: "Valor do checkout divergente" },422,"amount_mismatch");
    // Audit the correct provider even though older commerce.sql defaults to "stripe".
    const { data: existing, error: existingError } = await admin.from("scholar_payment_events")
      .select("purchase_request_id,provider").eq("provider_event_id", body.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.purchase_request_id !== purchase.id)
      return result({ error: "Identificador de evento reutilizado" },409,"invalid_payload");
    if (existing) {
      if (existing.provider !== "asaas") {
        const { error: auditError } = await admin.from("scholar_payment_events")
          .update({ provider: "asaas" }).eq("provider_event_id", body.id).eq("purchase_request_id", purchase.id);
        if (auditError) throw auditError;
      }
      return result({ acknowledged: true, alreadyProcessed: true },200,"duplicate");
    }
    if (purchase.status === "activated" && purchase.fulfilled_license_id)
      return result({ acknowledged: true, alreadyActivated: true },200,"duplicate");
    if (!["approved", "payment_pending"].includes(purchase.status))
      return result({ error: "Compra não elegível para ativação automática" },409,"ineligible");

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
    return result({ acknowledged: true, activated: true },200,"success");
  } catch (error) {
    console.error("[asaas:checkout] processing failed", { code: (error as { code?: string })?.code || "unknown" });
    return result({ error: "Não foi possível confirmar a ativação" },503,"processing_failed");
  }
}

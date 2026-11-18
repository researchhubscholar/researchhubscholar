import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutEvent = {
  id?: unknown;
  event?: unknown;
  checkout?: { id?: unknown; status?: unknown; externalReference?: unknown; items?: unknown };
};
function sameToken(received: string | null, configured: string) {
  if (!received || !configured) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(configured, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function moneyMatches(items: unknown, expectedCents: number) {
  if (!Array.isArray(items) || items.length === 0) return false;
  let total = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") return false;
    const { quantity, value } = item as Record<string, unknown>;
    if (!Number.isSafeInteger(quantity) || typeof value !== "number" || !Number.isFinite(value)) return false;
    if ((quantity as number) < 1 || value < 0) return false;
    total += Math.round(value * 100) * (quantity as number);
  }
  return total === expectedCents;
}
export async function POST(request: Request) {
  const secret = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!secret || secret.length < 32) {
    console.error("[asaas:webhook] auth token not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!sameToken(request.headers.get("asaas-access-token"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") || 0) > 65_536) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let event: CheckoutEvent;
  try {
    const raw = await request.text();
    if (raw.length > 65_536) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    event = JSON.parse(raw) as CheckoutEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof event.id !== "string" || event.id.length > 180 ||
      typeof event.event !== "string" || typeof event.checkout?.id !== "string") {
    return NextResponse.json({ error: "Invalid checkout event" }, { status: 400 });
  }
  const kind = event.event;
  if (!["CHECKOUT_CREATED", "CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(kind)) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const checkoutId = event.checkout.id;
  const admin = supabaseAdmin();
  const { data: purchase, error: lookupError } = await admin.from("scholar_purchase_requests")
    .select("id,status,kind,plan,total_amount_cents,provider_checkout_id,fulfilled_license_id")
    .eq("provider_checkout_id", checkoutId).maybeSingle();
  if (lookupError) {
    console.error("[asaas:webhook] purchase lookup failed", { code: lookupError.code });
    return NextResponse.json({ error: "Temporary database error" }, { status: 503 });
  }
  if (!purchase) {
    // Asaas can dispatch CHECKOUT_CREATED before our checkout ID is saved;
    // paid events must be retried rather than silently discarded.
    return kind === "CHECKOUT_CREATED"
      ? NextResponse.json({ ok: true, ignored: true })
      : NextResponse.json({ error: "Checkout not registered" }, { status: 503 });
  }
  if (event.checkout.externalReference !== undefined &&
      event.checkout.externalReference !== null &&
      event.checkout.externalReference !== purchase.id) {
    return NextResponse.json({ error: "Checkout reference mismatch" }, { status: 409 });
  }
  if (kind === "CHECKOUT_PAID") {
    if (event.checkout.status !== "PAID") {
      return NextResponse.json({ error: "Checkout is not paid" }, { status: 409 });
    }
    if (!moneyMatches(event.checkout.items, purchase.total_amount_cents)) {
      console.error("[asaas:webhook] checkout amount mismatch", { requestId: purchase.id });
      return NextResponse.json({ error: "Checkout amount mismatch" }, { status: 409 });
    }
    if (purchase.status === "activated") return NextResponse.json({ ok: true, alreadyActivated: true });
    if (!["approved", "payment_pending"].includes(purchase.status)) {
      return NextResponse.json({ error: "Purchase is not payable" }, { status: 409 });
    }
    const { data: licenseId, error: fulfillError } = await admin.rpc("scholar_fulfill_paid_request", {
      p_request: purchase.id,
      p_provider_event: event.id,
      p_provider_payment: checkoutId,
      p_provider_subscription: null,
    });
    if (fulfillError) {
      console.error("[asaas:webhook] fulfillment failed", { code: fulfillError.code, requestId: purchase.id });
      return NextResponse.json({ error: "Fulfillment failed; retry delivery" }, { status: 503 });
    }
    console.info("[asaas:webhook] license activated", { requestId: purchase.id, licenseId });
    return NextResponse.json({ ok: true, activated: true });
  }
  if (kind === "CHECKOUT_CANCELED" || kind === "CHECKOUT_EXPIRED") {
    const expected = kind === "CHECKOUT_CANCELED" ? "CANCELED" : "EXPIRED";
    if (event.checkout.status !== expected) return NextResponse.json({ error: "Status mismatch" }, { status: 409 });
    const status = kind === "CHECKOUT_CANCELED" ? "cancelled" : "expired";
    const { error } = await admin.from("scholar_purchase_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", purchase.id).in("status", ["requested", "approved", "payment_pending"]);
    if (error) return NextResponse.json({ error: "Could not update purchase" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

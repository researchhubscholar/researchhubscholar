import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Purchase = {
  id: string; requester_id: string; kind: string; plan: string | null;
  billing_schedule: "annual" | "12x"; total_amount_cents: number;
  status: string; provider_checkout_id: string | null;
};
const allowedId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function apiBase() {
  return process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

export async function POST(request: Request) {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return NextResponse.json({ error: "Checkout não configurado." }, { status: 503 });
  const db = await supabaseServer();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Faça login para contratar." }, { status: 401 });
  let payload: { requestId?: unknown };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 }); }
  if (typeof payload.requestId !== "string" || !allowedId.test(payload.requestId))
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: settings, error: settingsError } = await admin.from("scholar_commerce_settings")
    .select("payments_enabled").eq("id", true).single();
  if (settingsError || !settings?.payments_enabled)
    return NextResponse.json({ error: "Pagamentos não habilitados." }, { status: 503 });

  const { data, error } = await admin.from("scholar_purchase_requests")
    .select("id,requester_id,kind,plan,billing_schedule,total_amount_cents,status,provider_checkout_id")
    .eq("id", payload.requestId).eq("requester_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  const order = data as Purchase;
  if (!["requested", "approved", "payment_pending"].includes(order.status))
    return NextResponse.json({ error: "Solicitação indisponível para checkout." }, { status: 409 });
  if (order.provider_checkout_id)
    return NextResponse.json({ error: "Já existe um checkout para esta solicitação. Aguarde a confirmação ou inicie uma nova contratação." }, { status: 409 });
  if (!Number.isSafeInteger(order.total_amount_cents) || order.total_amount_cents <= 0)
    return NextResponse.json({ error: "Valor de contratação inválido." }, { status: 422 });

  const site = process.env.VERCEL_ENV === "preview"
    ? request.url
    : process.env.NEXT_PUBLIC_SITE_URL || "https://researchhub.com.br";
  const origin = new URL(site).origin;
  const amount = order.total_amount_cents / 100;
  const body = {
    billingTypes: order.billing_schedule === "12x" ? ["CREDIT_CARD"] : ["PIX", "CREDIT_CARD"],
    chargeTypes: order.billing_schedule === "12x" ? ["INSTALLMENT"] : ["DETACHED"],
    ...(order.billing_schedule === "12x" ? { installment: { maxInstallmentCount: 12 } } : {}),
    minutesToExpire: 60,
    externalReference: order.id,
    callback: {
      successUrl: `${origin}/licenca`,
      cancelUrl: `${origin}/contratacao`,
      expiredUrl: `${origin}/contratacao`,
    },
    items: [{
      name: order.kind === "recharge" ? "Recarga de tokens ResearchHub" : `ResearchHub - plano ${order.plan || "institucional"}`,
      description: "Contratação ResearchHub",
      quantity: 1,
      value: amount,
    }],
  };
  try {
    const response = await fetch(`${apiBase()}/checkouts`, {
      method: "POST", headers: { "content-type": "application/json", access_token: key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store",
    });
    if (!response.ok) {
      console.error("[asaas:checkout] creation rejected", { status: response.status, requestId: order.id });
      return NextResponse.json({ error: "Não foi possível iniciar o checkout no Asaas." }, { status: 502 });
    }
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !allowedId.test(result.id))
      throw new Error("Checkout retornou identificador inválido");
    const { data: updated, error: updateError } = await admin.from("scholar_purchase_requests")
      .update({ provider_checkout_id: result.id, status: "payment_pending", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("requester_id", user.id).in("status", ["requested", "approved", "payment_pending"])
      .is("provider_checkout_id", null).select("id").maybeSingle();
    if (updateError || !updated) {
      // Checkout was created at the provider, but database linking failed.
      // Never direct a buyer to an unlinked checkout that could not be fulfilled.
      console.error("[asaas:checkout] checkout could not be linked", { requestId: order.id });
      return NextResponse.json({ error: "Falha ao vincular o checkout. Entre em contato com o suporte antes de pagar." }, { status: 503 });
    }
    const host = process.env.ASAAS_ENVIRONMENT === "sandbox" ? "sandbox.asaas.com" : "asaas.com";
    return NextResponse.json({ checkoutUrl: `https://${host}/checkoutSession/show?id=${result.id}` });
  } catch {
    return NextResponse.json({ error: "Serviço de pagamentos temporariamente indisponível." }, { status: 503 });
  }
}

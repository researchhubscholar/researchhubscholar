import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutInput = {
  kind?: "individual" | "institutional";
  plan?: "essential" | "plus" | "premium";
  billingSchedule?: "annual" | "12x";
  seats?: number;
  organizationName?: string;
  coupon?: string;
};
const apiBase = () => process.env.ASAAS_ENVIRONMENT === "sandbox"
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";
const checkoutUrl = (id: string) => {
  const defaultOrigin = process.env.ASAAS_ENVIRONMENT === "sandbox"
    ? "https://sandbox.asaas.com" : "https://asaas.com";
  const origin = process.env.ASAAS_CHECKOUT_ORIGIN || defaultOrigin;
  const url = new URL(origin);
  if (!["asaas.com", "www.asaas.com", "sandbox.asaas.com", "www.sandbox.asaas.com"].includes(url.hostname) || url.protocol !== "https:") {
    throw new Error("Asaas checkout origin is invalid");
  }
  // Legacy settings may store the complete checkout path; do not append a second copy.
  if (!url.pathname.includes("/checkoutSession/show")) url.pathname = "/checkoutSession/show";
  url.searchParams.set("id", id);
  return url.toString();
};
export async function POST(request: Request) {
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para contratar." }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Checkout temporariamente indisponível." }, { status: 503 });
  let body: CheckoutInput;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados de contratação inválidos." }, { status: 400 }); }
  if (!body || !["individual", "institutional"].includes(body.kind || "") ||
      !["essential", "plus", "premium"].includes(body.plan || "") ||
      !["annual", "12x"].includes(body.billingSchedule || "") ||
      (body.kind === "institutional" && (!Number.isInteger(body.seats) || (body.seats ?? 0) < 1 || (body.seats ?? 0) > 10000))) {
    return NextResponse.json({ error: "Selecione uma contratação válida." }, { status: 400 });
  }
  const { data: settings, error: settingsError } = await client.from("scholar_commerce_settings")
    .select("payments_enabled").eq("id", true).single();
  if (settingsError || !settings?.payments_enabled) return NextResponse.json({ error: "Pagamentos não estão habilitados." }, { status: 503 });
  const { data: purchaseId, error: createError } = await client.rpc("scholar_create_purchase_request", {
    p_kind: body.kind, p_plan: body.plan, p_billing_schedule: body.billingSchedule,
    p_seats: body.kind === "institutional" ? body.seats : 1, p_quantity: 1,
    p_organization_name: body.kind === "institutional" ? body.organizationName : null,
    p_target_license: null, p_coupon: body.coupon || null,
  });
  if (createError || typeof purchaseId !== "string") {
    return NextResponse.json({ error: createError?.message || "Não foi possível criar a solicitação." }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data: purchase, error: lookupError } = await admin.from("scholar_purchase_requests")
    .select("id,kind,plan,billing_schedule,seats,token_allowance,total_amount_cents,requester_id")
    .eq("id", purchaseId).eq("requester_id", user.id).single();
  if (lookupError || !purchase || purchase.total_amount_cents < 1) {
    return NextResponse.json({ error: "Solicitação não está pronta para pagamento." }, { status: 503 });
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://researchhub.com.br").replace(/\/$/, "");
  const isInstallment = purchase.billing_schedule === "12x";
  const payload = {
    billingTypes: isInstallment ? ["CREDIT_CARD"] : ["PIX", "CREDIT_CARD"],
    chargeTypes: isInstallment ? ["INSTALLMENT"] : ["DETACHED"],
    ...(isInstallment ? { installment: { maxInstallmentCount: 12 } } : {}),
    minutesToExpire: 60,
    externalReference: purchaseId,
    callback: {
      successUrl: `${siteUrl}/licenca`,
      cancelUrl: `${siteUrl}/contratacao`,
      expiredUrl: `${siteUrl}/contratacao`,
    },
    items: [{
      name: `ResearchHub ${purchase.plan} - licença anual`,
      description: `${purchase.token_allowance} tokens de IA`,
      quantity: 1,
      value: purchase.total_amount_cents / 100,
    }],
  };
  try {
    const response = await fetch(`${apiBase()}/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "ResearchHub/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const checkout = await response.json() as { id?: unknown };
    if (!response.ok || typeof checkout.id !== "string" || checkout.id.length > 180) {
      console.error("[asaas:checkout] create failed", { status: response.status, requestId: purchaseId });
      return NextResponse.json({ error: "Não foi possível abrir o checkout. Tente novamente." }, { status: 502 });
    }
    const { error: updateError } = await admin.from("scholar_purchase_requests").update({
      provider_checkout_id: checkout.id, status: "payment_pending", updated_at: new Date().toISOString(),
    }).eq("id", purchaseId).eq("requester_id", user.id).eq("status", "requested");
    if (updateError) {
      console.error("[asaas:checkout] checkout created but not linked", { requestId: purchaseId, code: updateError.code });
      return NextResponse.json({ error: "Não foi possível confirmar o vínculo do checkout. Contate o suporte antes de pagar." }, { status: 503 });
    }
    return NextResponse.json({ requestId: purchaseId, url: checkoutUrl(checkout.id) });
  } catch (error) {
    console.error("[asaas:checkout] provider unavailable", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Asaas temporariamente indisponível." }, { status: 503 });
  }
}

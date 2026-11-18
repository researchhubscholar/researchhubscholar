import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function checkoutPage(id: string) {
  const custom = process.env.ASAAS_CHECKOUT_ORIGIN;
  let origin = "https://asaas.com";
  if (custom) {
    const parsed = new URL(custom);
    if (parsed.protocol !== "https:" || !["asaas.com", "www.asaas.com", "sandbox.asaas.com"].includes(parsed.hostname)) {
      throw new Error("Origem de checkout Asaas inválida");
    }
    origin = parsed.origin;
  }
  return `${origin}/checkoutSession/show?id=${encodeURIComponent(id)}`;
}

export async function POST(request: Request) {
  if (!process.env.ASAAS_API_KEY) return NextResponse.json({ error: "Checkout indisponível" }, { status: 503 });
  const db = await supabaseServer();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Entre na sua conta" }, { status: 401 });
  const input = await request.json().catch(() => null) as { purchaseRequestId?: unknown } | null;
  const id = input?.purchaseRequestId;
  if (typeof id !== "string" || !uuid.test(id)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: item, error } = await admin.from("scholar_purchase_requests")
    .select("id,requester_id,kind,plan,billing_schedule,total_amount_cents,status,provider_checkout_id")
    .eq("id", id).eq("requester_id", user.id).maybeSingle();
  if (error || !item) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (item.status === "payment_pending" && item.provider_checkout_id) {
    return NextResponse.json({ url: checkoutPage(item.provider_checkout_id) });
  }
  if (item.status !== "requested" || item.provider_checkout_id || item.total_amount_cents < 1 || item.kind !== "individual") {
    return NextResponse.json({ error: "Pedido indisponível para este checkout" }, { status: 409 });
  }
  const { data: settings } = await admin.from("scholar_commerce_settings").select("payments_enabled").eq("id", true).maybeSingle();
  if (!settings?.payments_enabled) return NextResponse.json({ error: "Pagamentos indisponíveis" }, { status: 503 });

  // Claim request before calling Asaas: two concurrent clicks must never open two checkouts.
  const { data: claim, error: claimError } = await admin.from("scholar_purchase_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", item.id).eq("requester_id", user.id).eq("status", "requested")
    .is("provider_checkout_id", null).select("id").maybeSingle();
  if (claimError || !claim) return NextResponse.json({ error: "Pedido já está em processamento" }, { status: 409 });

  const base = process.env.ASAAS_ENVIRONMENT === "sandbox" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com";
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (!site || new URL(site).protocol !== "https:") throw new Error("URL pública inválida");
    const body = {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: item.billing_schedule === "12x" ? ["INSTALLMENT"] : ["DETACHED"],
      ...(item.billing_schedule === "12x" ? { installment: { maxInstallmentCount: 12 } } : {}),
      minutesToExpire: 60,
      externalReference: item.id,
      callback: {
        successUrl: `${site}/licenca`,
        cancelUrl: `${site}/contratacao`,
        expiredUrl: `${site}/contratacao`,
      },
      items: [{
        name: `ResearchHub ${String(item.plan || "").toUpperCase()} — acesso anual`,
        quantity: 1,
        value: Number((item.total_amount_cents / 100).toFixed(2)),
      }],
    };
    const res = await fetch(`${base}/v3/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": process.env.ASAAS_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const response = await res.json().catch(() => ({})) as { id?: string };
    if (!res.ok || typeof response.id !== "string" || !uuid.test(response.id)) {
      throw new Error(`Falha na API Asaas (HTTP ${res.status})`);
    }
    const { data: saved, error: saveError } = await admin.from("scholar_purchase_requests")
      .update({ status: "payment_pending", provider_checkout_id: response.id, updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("status", "approved").select("id").maybeSingle();
    if (saveError || !saved) throw new Error("Não foi possível vincular o checkout ao pedido");
    return NextResponse.json({ url: checkoutPage(response.id) });
  } catch (cause) {
    // If a checkout was created but not linked, do not silently permit an unrelated second checkout.
    console.error("[asaas:checkout] creation or binding failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "Não foi possível abrir o checkout. Entre em contato com o suporte." }, { status: 502 });
  }
}

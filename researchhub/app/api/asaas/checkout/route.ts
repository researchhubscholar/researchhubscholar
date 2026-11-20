import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { scholarAIReady } from "@/lib/ai/config";
import { asaasBaseUrl, checkoutUrl } from "@/lib/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Purchase = {
  id: string;
  requester_id: string;
  kind: "individual" | "institutional" | "recharge";
  plan: "essential" | "plus" | "premium" | null;
  status: string;
  billing_schedule: string;
  total_amount_cents: number;
  provider_checkout_id: string | null;
  coupon_code: string | null;
  gross_amount_cents: number;
  discount_cents: number;
  target_license_id: string | null;
  token_allowance: number;
};

export async function POST(request: Request) {
  const session = await supabaseServer();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Faça login antes de contratar." }, { status: 401 });

  let requestId: unknown;
  try { requestId = (await request.json()).requestId; } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  if (typeof requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(requestId))
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });

  try {
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) throw new Error("Chave do Asaas não configurada.");
    if (!scholarAIReady)
      return NextResponse.json({ error: "A assistência está em preparação. O pagamento será liberado após a configuração." }, { status: 503 });
    const production = process.env.ASAAS_ENVIRONMENT?.toLowerCase() === "production";
    const generalCheckoutEnabled = process.env.RESEARCHHUB_ASAAS_CHECKOUT_READY === "true";
    const admin = supabaseAdmin();
    const { data, error } = await admin.from("scholar_purchase_requests")
      .select("id,requester_id,kind,plan,status,billing_schedule,total_amount_cents,provider_checkout_id,coupon_code,gross_amount_cents,discount_cents,target_license_id,token_allowance")
      .eq("id", requestId).eq("requester_id", user.id).maybeSingle();
    if (error) throw error;
    const purchase = data as Purchase | null;
    if (!purchase || !["requested","approved","payment_pending"].includes(purchase.status))
      return NextResponse.json({ error: "Solicitação não disponível para pagamento." }, { status: 409 });
    if (production && !generalCheckoutEnabled) {
      // Enable ONLY the previously agreed, single-redemption Essencial test.
      // Every other purchase remains blocked until checkout is explicitly enabled for all.
      const validTestPurchase =
        purchase.kind === "individual" &&
        purchase.plan === "essential" &&
        purchase.billing_schedule === "annual" &&
        purchase.coupon_code === "TESTE99" &&
        purchase.gross_amount_cents === 59900 &&
        purchase.discount_cents === 59301 &&
        purchase.total_amount_cents === 599;
      if (!validTestPurchase)
        return NextResponse.json({ error: "Novos checkouts estão em validação. Disponível somente o teste autorizado TESTE99." }, { status: 503 });

      // Check the real coupon record, not only user-submitted text or monetary fields.
      const { data: testCoupon, error: couponError } = await admin.from("scholar_coupon_codes")
        .select("code,active,audience,plan,percent_off,amount_off_cents,max_redemptions,redemptions,valid_from,valid_until")
        .eq("code", "TESTE99").maybeSingle();
      if (couponError) throw couponError;
      if (!testCoupon || !testCoupon.active || testCoupon.audience !== "individual" ||
          testCoupon.plan !== "essential" || testCoupon.percent_off !== 99 ||
          testCoupon.amount_off_cents !== 0 || testCoupon.max_redemptions !== 1 ||
          testCoupon.redemptions !== 0 || Date.parse(testCoupon.valid_from) > Date.now() ||
          (testCoupon.valid_until && Date.parse(testCoupon.valid_until) <= Date.now()))
        return NextResponse.json({ error: "Cupom de teste não configurado ou já utilizado." }, { status: 503 });

      // Prevent reopening a second test checkout while one is already pending.
      const { data: pendingTest, error: pendingError } = await admin.from("scholar_purchase_requests")
        .select("id").eq("coupon_code", "TESTE99").eq("status", "payment_pending")
        .neq("id", purchase.id).limit(1);
      if (pendingError) throw pendingError;
      if (pendingTest?.length)
        return NextResponse.json({ error: "Já existe um checkout de teste em andamento." }, { status: 409 });
    }
    if (purchase.kind !== "individual" && purchase.kind !== "recharge")
      return NextResponse.json({ error: "Checkout automático disponível para planos individuais e recargas." }, { status: 422 });
    if (purchase.kind === "individual" && !purchase.plan)
      return NextResponse.json({ error: "Plano inválido." }, { status: 422 });
    if (purchase.kind === "recharge") {
      if (!purchase.target_license_id || purchase.billing_schedule !== "annual" ||
          !Number.isSafeInteger(purchase.token_allowance) || purchase.token_allowance <= 0)
        return NextResponse.json({ error: "Recarga inválida." }, { status: 422 });
      // RLS applies the same owner/director rule used by the purchase RPC.
      const { data: license, error: licenseError } = await session.from("scholar_licenses")
        .select("id,status,starts_at,ends_at").eq("id", purchase.target_license_id).maybeSingle();
      if (licenseError) throw licenseError;
      const now = Date.now();
      if (!license || !["active", "trial"].includes(license.status) ||
          !(Date.parse(license.starts_at) <= now && Date.parse(license.ends_at) >= now))
        return NextResponse.json({ error: "A licença precisa estar ativa para comprar tokens extras." }, { status: 409 });
    }
    const { data: commerce, error: commerceError } = await admin.from("scholar_commerce_settings")
      .select("payments_enabled,ai_enabled").eq("id", true).maybeSingle();
    if (commerceError) throw commerceError;
    if (!commerce?.payments_enabled || !commerce.ai_enabled)
      return NextResponse.json({ error: "Pagamentos e assistência estão em preparação. Tente novamente em breve." }, { status: 503 });
    if (!["annual", "12x"].includes(purchase.billing_schedule))
      return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 422 });
    if (purchase.provider_checkout_id)
      return NextResponse.json({ url: checkoutUrl(purchase.provider_checkout_id), requestId: purchase.id });

    if (!Number.isSafeInteger(purchase.total_amount_cents) || purchase.total_amount_cents <= 0)
      return NextResponse.json({ error: "Valor inválido para checkout." }, { status: 422 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin || !origin.startsWith("https://")) throw new Error("Origem HTTPS do site não configurada.");
    const site = new URL(origin).origin;
    const body = {
      billingTypes: purchase.billing_schedule === "12x" ? ["CREDIT_CARD"] : ["PIX", "CREDIT_CARD"],
      chargeTypes: purchase.billing_schedule === "12x" ? ["INSTALLMENT"] : ["DETACHED"],
      ...(purchase.billing_schedule === "12x" ? { installment: { maxInstallmentCount: 12 } } : {}),
      minutesToExpire: 60,
      externalReference: purchase.id,
      callback: {
        successUrl: site + "/contratacao?pedido=" + purchase.id + "&pagamento=retorno",
        cancelUrl: site + "/contratacao?pedido=" + purchase.id + "&pagamento=cancelado",
        expiredUrl: site + "/contratacao?pedido=" + purchase.id + "&pagamento=expirado",
      },
      items: [{
        name: purchase.kind === "recharge" ? "ResearchHub - tokens extras" : "ResearchHub - plano " + purchase.plan,
        description: purchase.kind === "recharge"
          ? purchase.token_allowance.toLocaleString("pt-BR") + " tokens; validade até o término da licença atual"
          : "Acesso anual à plataforma ResearchHub",
        quantity: 1,
        value: purchase.total_amount_cents / 100,
      }],
    };
    const response = await fetch(asaasBaseUrl() + "/checkouts", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json", "access_token": apiKey, "User-Agent": "ResearchHub/1.0" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error("[asaas:checkout] create failed", { httpStatus: response.status });
      return NextResponse.json({ error: "O Asaas não conseguiu abrir a cobrança." }, { status: 502 });
    }
    const checkout = await response.json() as { id?: unknown };
    if (typeof checkout.id !== "string")
      throw new Error("Resposta do Asaas sem identificador de checkout.");
    const { data: linked, error: linkError } = await admin.from("scholar_purchase_requests")
      .update({ provider_checkout_id: checkout.id, status: "payment_pending", updated_at: new Date().toISOString() })
      .eq("id", purchase.id).eq("requester_id", user.id)
      .in("status", ["requested", "approved"]).is("provider_checkout_id", null)
      .select("id").maybeSingle();
    if (linkError) throw linkError;
    if (!linked) {
      console.error("[asaas:checkout] checkout created but order linking lost race", { purchaseId: purchase.id });
      return NextResponse.json({ error: "Checkout criado, mas não vinculado. Contate o suporte antes de pagar." }, { status: 409 });
    }
    return NextResponse.json({ url: checkoutUrl(checkout.id), requestId: purchase.id });
  } catch (error) {
    console.error("[asaas:checkout] unexpected failure", { code: (error as { code?: string })?.code || "unknown" });
    return NextResponse.json({ error: "Não foi possível iniciar o checkout agora." }, { status: 503 });
  }
}

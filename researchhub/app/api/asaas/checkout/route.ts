import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
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
    const admin = supabaseAdmin();
    const { data, error } = await admin.from("scholar_purchase_requests")
      .select("id,requester_id,kind,plan,status,billing_schedule,total_amount_cents,provider_checkout_id")
      .eq("id", requestId).eq("requester_id", user.id).maybeSingle();
    if (error) throw error;
    const purchase = data as Purchase | null;
    if (!purchase || !["requested","approved","payment_pending"].includes(purchase.status))
      return NextResponse.json({ error: "Solicitação não disponível para pagamento." }, { status: 409 });
    if (purchase.kind !== "individual" || !purchase.plan)
      return NextResponse.json({ error: "Checkout automático disponível inicialmente apenas para planos individuais." }, { status: 422 });
    if (purchase.billing_schedule !== "annual")
      return NextResponse.json({ error: "O parcelamento ainda não foi ativado neste checkout. Escolha pagamento anual." }, { status: 422 });
    if (purchase.provider_checkout_id)
      return NextResponse.json({ url: checkoutUrl(purchase.provider_checkout_id), requestId: purchase.id });

    if (!Number.isSafeInteger(purchase.total_amount_cents) || purchase.total_amount_cents <= 0)
      return NextResponse.json({ error: "Valor inválido para checkout." }, { status: 422 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin || !origin.startsWith("https://")) throw new Error("Origem HTTPS do site não configurada.");
    const site = new URL(origin).origin;
    const body = {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 60,
      externalReference: purchase.id,
      callback: {
        successUrl: site + "/licenca",
        cancelUrl: site + "/contratacao",
        expiredUrl: site + "/contratacao",
      },
      items: [{
        name: "ResearchHub - plano " + purchase.plan,
        description: "Acesso anual à plataforma ResearchHub",
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

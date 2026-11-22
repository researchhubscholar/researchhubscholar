import { NextResponse } from "next/server";
import { asaasBaseUrl } from "@/lib/payments/asaas";
import { purchaseOrderId } from "@/lib/access/purchase-journey";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await supabaseServer();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = body?.requestId;
  if (typeof id !== "string" || !purchaseOrderId.test(id))
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    const { data: order, error } = await admin.from("scholar_purchase_requests")
      .select("status,provider_checkout_id").eq("id", id).eq("requester_id", user.id).maybeSingle();
    if (error) throw error;
    if (order?.status === "cancelled") return NextResponse.json({ cancelled: true });
    if (!order || !["requested", "approved", "payment_pending"].includes(order.status))
      return NextResponse.json({ error: "Pedido indisponível para cancelamento." }, { status: 409 });

    if (order.provider_checkout_id) {
      const key = process.env.ASAAS_API_KEY;
      if (!key) throw new Error("Asaas indisponível");
      const result = await fetch(asaasBaseUrl() + "/checkouts/" + encodeURIComponent(order.provider_checkout_id) + "/cancel", {
        method: "POST",
        headers: { accept: "application/json", access_token: key, "User-Agent": "ResearchHub/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) return NextResponse.json({ error: "O Asaas não confirmou o cancelamento. Confira a situação do pagamento antes de tentar novamente." }, { status: 409 });
    }

    let update = admin.from("scholar_purchase_requests").update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id).eq("requester_id", user.id).eq("status", order.status);
    update = order.provider_checkout_id ? update.eq("provider_checkout_id", order.provider_checkout_id) : update.is("provider_checkout_id", null);
    const { data: cancelled, error: updateError } = await update.select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!cancelled) {
      const current = await admin.from("scholar_purchase_requests").select("status").eq("id", id).eq("requester_id", user.id).maybeSingle();
      if (current.data?.status !== "cancelled")
        return NextResponse.json({ error: "O pedido mudou de situação. Atualize a página e confira o status." }, { status: 409 });
    }
    return NextResponse.json({ cancelled: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível confirmar o cancelamento agora." }, { status: 503 });
  }
}

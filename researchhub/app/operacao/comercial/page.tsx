"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money, plans, type PlanKey } from "@/lib/access/plans";
import { requestStatus } from "@/lib/access/commerce";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Summary = {
  requested: number;
  paymentPending: number;
  activated: number;
  pipelineCents: number;
  activeLicenses: number;
  expiring30d: number;
};

type RequestItem = {
  id: string;
  user_email: string;
  kind: "individual" | "institutional" | "recharge";
  plan: PlanKey | null;
  billing_schedule: "annual" | "12x";
  seats: number;
  quantity: number;
  organization_name: string | null;
  total_amount_cents: number;
  token_allowance: number;
  status: string;
  created_at: string;
};

export default function CommerceAdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(10);
  const [couponLimit, setCouponLimit] = useState(10);

  async function load() {
    const db = supabaseBrowser();
    const [summaryResult, requestsResult] = await Promise.all([
      db.rpc("scholar_admin_commerce_summary"),
      db.rpc("scholar_admin_purchase_requests"),
    ]);
    if (summaryResult.error || requestsResult.error) {
      setMessage("Execute scholar_commerce.sql para ativar a operação comercial.");
    } else {
      setSummary(summaryResult.data as Summary);
      setRequests((requestsResult.data || []) as RequestItem[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("scholar_admin_set_purchase_status", {
      p_request: id,
      p_status: status,
    });
    setBusy(false);
    if (error) setMessage(error.message || "Não foi possível alterar o pedido.");
    else {
      setMessage("Status comercial atualizado.");
      await load();
    }
  }

  async function activateTest(id: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("scholar_admin_activate_test_request", { p_request: id });
    setBusy(false);
    if (error) setMessage(error.message || "Não foi possível ativar o teste. A conta pode já possuir uma licença.");
    else {
      setMessage("Licença de teste ativada sem pagamento e sem consumo real de IA.");
      await load();
    }
  }

  async function createCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("scholar_admin_upsert_coupon", {
      p_code: couponCode,
      p_audience: null,
      p_plan: null,
      p_percent_off: couponPercent,
      p_amount_off_cents: 0,
      p_max_redemptions: couponLimit,
      p_valid_until: null,
      p_active: true,
    });
    setBusy(false);
    if (error) setMessage(error.message || "Não foi possível criar o cupom.");
    else {
      setMessage(`Cupom ${couponCode.toUpperCase()} salvo.`);
      setCouponCode("");
    }
  }

  if (loading) return <p role="status">Carregando operação comercial...</p>;

  return <div className="max-w-6xl mx-auto">
    <Link href="/operacao" className="text-sm text-teal underline">← Voltar para Operação</Link>
    <p className="mt-6 text-xs uppercase tracking-widest text-teal">Operação comercial</p>
    <h1 className="font-display text-4xl mt-3">Pedidos, licenças e testes.</h1>
    <p className="mt-4 max-w-3xl text-ink-soft">
      Acompanhe solicitações individuais e institucionais. Ativações desta tela são testes de 30 dias;
      pagamentos reais continuam bloqueados até a futura integração do Stripe.
    </p>
    {message ? <p role="status" className="mt-5 rounded-card border border-line bg-white p-4 text-sm">{message}</p> : null}

    {summary ? <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
      {[
        ["Novos pedidos", summary.requested],
        ["Aguardando pagamento", summary.paymentPending],
        ["Ativados", summary.activated],
        ["Pipeline", money(summary.pipelineCents)],
        ["Licenças ativas", summary.activeLicenses],
        ["Vencem em 30 dias", summary.expiring30d],
      ].map(([label, value]) => <article key={String(label)} className="rounded-card border border-line bg-white p-4">
        <p className="font-display text-2xl">{value}</p><p className="mt-2 text-xs text-ink-soft">{label}</p>
      </article>)}
    </section> : null}

    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">Solicitações recentes</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Conta</th><th className="p-2">Pedido</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">Ações</th></tr></thead>
          <tbody>{requests.map(item => <tr key={item.id} className="border-t align-top">
            <td className="p-2">{item.user_email}<br/><span className="text-xs text-ink-soft">{new Date(item.created_at).toLocaleString("pt-BR")}</span></td>
            <td className="p-2">{item.kind === "recharge" ? `${item.quantity} recarga(s)` : `${item.plan ? plans[item.plan].name : "—"} · ${item.seats} vaga(s)`}{item.organization_name ? <><br/><span className="text-xs">{item.organization_name}</span></> : null}</td>
            <td className="p-2">{money(item.total_amount_cents)}<br/><span className="text-xs text-ink-soft">{item.token_allowance.toLocaleString("pt-BR")} tokens</span></td>
            <td className="p-2">{requestStatus(item.status)}</td>
            <td className="p-2"><div className="flex min-w-44 flex-col items-start gap-2">
              {item.status === "requested" ? <button type="button" disabled={busy} onClick={() => setStatus(item.id, "approved")} className="text-teal underline">Aprovar proposta</button> : null}
              {["requested", "approved", "payment_pending"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => activateTest(item.id)} className="text-teal underline">Ativar teste sem cobrança</button> : null}
              {!["paid", "activated", "cancelled", "expired"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => setStatus(item.id, "cancelled")} className="text-red-700 underline">Cancelar</button> : null}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!requests.length ? <p className="mt-3 text-sm text-ink-soft">Nenhuma solicitação comercial registrada.</p> : null}
    </section>

    <form onSubmit={createCoupon} className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">Cupom para grupo de teste</h2>
      <p className="mt-2 text-sm text-ink-soft">O cupom calcula o desconto na solicitação, mas não ativa cobrança ou licença automaticamente.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">Código
          <input required minLength={3} maxLength={40} value={couponCode} onChange={event => setCouponCode(event.target.value.toUpperCase())} className="mt-2 block w-full rounded-card border p-3 uppercase" placeholder="GRUPOFUNDADOR" />
        </label>
        <label className="text-sm">Desconto percentual
          <input type="number" min={1} max={100} value={couponPercent} onChange={event => setCouponPercent(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
        <label className="text-sm">Limite de utilizações
          <input type="number" min={1} value={couponLimit} onChange={event => setCouponLimit(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
      </div>
      <button disabled={busy} className="mt-4 rounded-card bg-teal px-4 py-2 text-white disabled:opacity-50">Salvar cupom</button>
    </form>
  </div>;
}

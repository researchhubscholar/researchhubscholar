"use client";
import AuthoredText from "@/components/i18n/authored-text";

import InterfaceText from "@/components/i18n/interface-text";


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

  if (loading) return <p role="status"><InterfaceText message="screen.efd9b19a0388" /></p>;

  return <div className="scholar-workspace secondary-page admin-page sales-page max-w-6xl mx-auto">
    <Link href="/operacao" className="text-sm text-teal underline"><InterfaceText message="screen.5afd266e6d52" /></Link>
    <p className="mt-6 text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.d1ef12c530a2" /></p>
    <h1 className="font-display text-4xl mt-3"><InterfaceText message="screen.25e5cec314c7" /></h1>
    <p className="mt-4 max-w-3xl text-ink-soft">
      <InterfaceText message="screen.a0c1e53bc0dd" />
    </p>
    {message ? <p role="status" className="mt-5 rounded-card border border-line bg-white p-4 text-sm"><AuthoredText text={message} /></p> : null}

    {summary ? <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
      {[
        ["Novos pedidos", summary.requested],
        ["Aguardando pagamento", summary.paymentPending],
        ["Ativados", summary.activated],
        ["Pipeline", money(summary.pipelineCents)],
        ["Licenças ativas", summary.activeLicenses],
        ["Vencem em 30 dias", summary.expiring30d],
      ].map(([label, value]) => <article key={String(label)} className="rounded-card border border-line bg-white p-4">
        <p className="font-display text-2xl">{value}</p><p className="mt-2 text-xs text-ink-soft"><AuthoredText text={label} /></p>
      </article>)}
    </section> : null}

    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl"><InterfaceText message="screen.b79b4049f7a9" /></h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2"><InterfaceText message="screen.5a4cc65d866b" /></th><th className="p-2"><InterfaceText message="screen.9e9ea5774a2d" /></th><th className="p-2"><InterfaceText message="screen.b2f530c46991" /></th><th className="p-2"><InterfaceText message="screen.920e413c7d41" /></th><th className="p-2"><InterfaceText message="screen.7d3e4d6dc900" /></th></tr></thead>
          <tbody>{requests.map(item => <tr key={item.id} className="border-t align-top">
            <td className="p-2">{item.user_email}<br/><span className="text-xs text-ink-soft">{new Date(item.created_at).toLocaleString("pt-BR")}</span></td>
            <td className="p-2">{item.kind === "recharge" ? `${item.quantity} recarga(s)` : `${item.plan ? plans[item.plan].name : "—"} · ${item.seats} vaga(s)`}{item.organization_name ? <><br/><span className="text-xs">{item.organization_name}</span></> : null}</td>
            <td className="p-2">{money(item.total_amount_cents)}<br/><span className="text-xs text-ink-soft">{item.token_allowance.toLocaleString("pt-BR")} tokens</span></td>
            <td className="p-2">{requestStatus(item.status)}</td>
            <td className="p-2"><div className="flex min-w-44 flex-col items-start gap-2">
              {item.status === "requested" ? <button type="button" disabled={busy} onClick={() => setStatus(item.id, "approved")} className="text-teal underline"><InterfaceText message="screen.b122d6de137d" /></button> : null}
              {["requested", "approved", "payment_pending"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => activateTest(item.id)} className="text-teal underline"><InterfaceText message="screen.efecb7f677a7" /></button> : null}
              {!["paid", "activated", "cancelled", "expired"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => setStatus(item.id, "cancelled")} className="text-red-700 underline">Cancelar</button> : null}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!requests.length ? <p className="mt-3 text-sm text-ink-soft"><InterfaceText message="screen.2d55833ce8b8" /></p> : null}
    </section>

    <form onSubmit={createCoupon} className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl"><InterfaceText message="screen.bd47b41be036" /></h2>
      <p className="mt-2 text-sm text-ink-soft"><InterfaceText message="screen.60ef71adf983" /></p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">Código
          <input required minLength={3} maxLength={40} value={couponCode} onChange={event => setCouponCode(event.target.value.toUpperCase())} className="mt-2 block w-full rounded-card border p-3 uppercase" placeholder="GRUPOFUNDADOR" />
        </label>
        <label className="text-sm"><InterfaceText message="screen.8bc664702b95" />
          <input type="number" min={1} max={100} value={couponPercent} onChange={event => setCouponPercent(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
        <label className="text-sm"><InterfaceText message="screen.28755c78c153" />
          <input type="number" min={1} value={couponLimit} onChange={event => setCouponLimit(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
      </div>
      <button disabled={busy} className="mt-4 rounded-card bg-teal px-4 py-2 text-white disabled:opacity-50"><InterfaceText message="screen.9efaf1b0bdf1" /></button>
    </form>
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { localQuote, requestStatus, type BillingSchedule, type CommerceKind } from "@/lib/access/commerce";
import { money, plans, type PlanKey } from "@/lib/access/plans";
import { supabaseBrowser } from "@/lib/supabase/browser";

type PurchaseRequest = {
  id: string;
  kind: CommerceKind;
  plan: PlanKey | null;
  billing_schedule: BillingSchedule;
  seats: number;
  quantity: number;
  organization_name: string | null;
  total_amount_cents: number;
  token_allowance: number;
  status: string;
  created_at: string;
};

type LicenseOption = {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
  plan: PlanKey;
  status: string;
};

export default function CommercePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [kind, setKind] = useState<Exclude<CommerceKind, "recharge">>("individual");
  const [plan, setPlan] = useState<PlanKey>("plus");
  const [schedule, setSchedule] = useState<BillingSchedule>("annual");
  const [seats, setSeats] = useState(30);
  const [organizationName, setOrganizationName] = useState("");
  const [coupon, setCoupon] = useState("");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [rechargeLicense, setRechargeLicense] = useState("");
  const [rechargeQuantity, setRechargeQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const quote = useMemo(() => localQuote(kind, plan, seats), [kind, plan, seats]);
  const rechargeQuote = useMemo(
    () => localQuote("recharge", "essential", 1, rechargeQuantity),
    [rechargeQuantity]
  );

  async function load() {
    const db = supabaseBrowser();
    const { data: auth } = await db.auth.getUser();
    setUserId(auth.user?.id || null);
    if (!auth.user) {
      setLoading(false);
      return;
    }
    const [requestResult, licenseResult, settingsResult] = await Promise.all([
      db.from("scholar_purchase_requests")
        .select("id,kind,plan,billing_schedule,seats,quantity,organization_name,total_amount_cents,token_allowance,status,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("scholar_licenses")
        .select("id,owner_id,organization_id,plan,status")
        .in("status", ["active", "trial"]),
      db.from("scholar_commerce_settings").select("payments_enabled").eq("id", true).maybeSingle(),
    ]);
    if (requestResult.error || licenseResult.error || settingsResult.error) {
      setMessage("Execute scholar_commerce.sql no Supabase para ativar esta área.");
    } else {
      setRequests((requestResult.data || []) as PurchaseRequest[]);
      setLicenses((licenseResult.data || []) as LicenseOption[]);
      setPaymentsEnabled(Boolean(settingsResult.data?.payments_enabled));
      setRechargeLicense(previous =>
        (licenseResult.data || []).some(item => item.id === previous)
          ? previous
          : licenseResult.data?.[0]?.id || ""
      );
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createRequest() {
    if (!userId || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabaseBrowser().rpc("scholar_create_purchase_request", {
      p_kind: kind,
      p_plan: plan,
      p_billing_schedule: schedule,
      p_seats: kind === "institutional" ? seats : 1,
      p_quantity: 1,
      p_organization_name: kind === "institutional" ? organizationName : null,
      p_target_license: null,
      p_coupon: coupon || null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message || "Não foi possível registrar a solicitação.");
      return;
    }
    setMessage(paymentsEnabled
      ? "Solicitação criada. O checkout será aberto quando a integração de pagamento estiver concluída."
      : "Solicitação registrada sem cobrança. A equipe poderá acompanhar o pedido no painel operacional.");
    await load();
  }

  async function createRechargeRequest() {
    if (!rechargeLicense || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabaseBrowser().rpc("scholar_create_purchase_request", {
      p_kind: "recharge",
      p_plan: null,
      p_billing_schedule: "annual",
      p_seats: 1,
      p_quantity: rechargeQuantity,
      p_organization_name: null,
      p_target_license: rechargeLicense,
      p_coupon: coupon || null,
    });
    setBusy(false);
    if (error) setMessage(error.message || "Não foi possível solicitar a recarga.");
    else {
      setMessage("Recarga solicitada sem cobrança. Nenhum saldo foi alterado nesta etapa.");
      await load();
    }
  }

  async function cancelRequest(id: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("scholar_cancel_purchase_request", { p_request: id });
    setBusy(false);
    if (error) setMessage("Não foi possível cancelar a solicitação.");
    else {
      setMessage("Solicitação cancelada.");
      await load();
    }
  }

  if (loading) return <p role="status">Carregando opções de contratação...</p>;
  if (!userId) return <div className="max-w-3xl mx-auto">
    <h1 className="font-display text-4xl">Entre para escolher sua licença.</h1>
    <Link href="/login" className="inline-block mt-5 text-teal underline">Entrar na conta</Link>
  </div>;

  return <div className="max-w-5xl mx-auto">
    <p className="text-xs uppercase tracking-widest text-teal">Contratação e recargas</p>
    <h1 className="font-display text-4xl mt-3">Prepare sua licença anual.</h1>
    <p className="text-ink-soft mt-4 max-w-3xl">
      Escolha o plano, a forma de pagamento desejada e, para residências, a quantidade exata de vagas.
      Nesta fase a solicitação é registrada, mas não abre checkout nem gera cobrança.
    </p>

    <div className="mt-5 rounded-card border border-teal/20 bg-teal-soft p-4 text-sm">
      <strong>{paymentsEnabled ? "Ambiente de pagamento em preparação." : "Cobrança desativada."}</strong>{" "}
      Nenhum cartão será solicitado e nenhuma licença paga será ativada automaticamente.
    </div>
    {message ? <p role="status" className="mt-5 rounded-card border border-line bg-white p-4 text-sm">{message}</p> : null}

    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">Nova solicitação</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Tipo de licença
          <select value={kind} onChange={event => setKind(event.target.value as typeof kind)} className="mt-2 block w-full rounded-card border p-3">
            <option value="individual">Individual</option>
            <option value="institutional">Programa de residência</option>
          </select>
        </label>
        <label className="text-sm">Plano
          <select value={plan} onChange={event => setPlan(event.target.value as PlanKey)} className="mt-2 block w-full rounded-card border p-3">
            {Object.entries(plans).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Condição desejada
          <select value={schedule} onChange={event => setSchedule(event.target.value as BillingSchedule)} className="mt-2 block w-full rounded-card border p-3">
            <option value="annual">Pagamento anual</option>
            <option value="12x">Licença anual em 12 parcelas</option>
          </select>
        </label>
        {kind === "institutional" ? <label className="text-sm">Quantidade de vagas
          <input type="number" min={1} max={10000} value={seats} onChange={event => setSeats(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label> : <div />}
        {kind === "institutional" ? <label className="text-sm md:col-span-2">Nome do programa ou instituição
          <input required minLength={2} maxLength={200} value={organizationName} onChange={event => setOrganizationName(event.target.value)} className="mt-2 block w-full rounded-card border p-3" placeholder="Ex.: Residência de Clínica Médica" />
        </label> : null}
        <label className="text-sm md:col-span-2">Cupom de teste ou condição especial
          <input maxLength={40} value={coupon} onChange={event => setCoupon(event.target.value.toUpperCase())} className="mt-2 block w-full rounded-card border p-3 uppercase" placeholder="Opcional" />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft">Licença anual</p><p className="mt-2 text-xl">{money(quote.grossAmountCents)}</p></div>
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft">{schedule === "12x" ? "Referência em 12x" : "Pagamento"}</p><p className="mt-2 text-xl">{schedule === "12x" ? money(Math.ceil(quote.grossAmountCents / 12)) : "1 parcela"}</p></div>
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft">Franquia planejada</p><p className="mt-2 text-xl">{quote.tokenAllowance.toLocaleString("pt-BR")}</p><p className="text-xs">tokens</p></div>
      </div>
      <p className="mt-3 text-xs text-ink-soft">O valor final e eventual desconto são recalculados com segurança no servidor ao registrar a solicitação.</p>
      <button type="button" disabled={busy || (kind === "institutional" && organizationName.trim().length < 2)} onClick={createRequest} className="mt-5 rounded-card bg-teal px-5 py-3 text-white disabled:opacity-50">
        {busy ? "Registrando..." : "Registrar solicitação sem cobrança"}
      </button>
    </section>

    {licenses.length ? <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">Recarga opcional</h2>
      <p className="mt-2 text-sm text-ink-soft">Cada pacote adicionará 1 milhão de tokens e será válido até o fim da licença escolhida.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Licença
          <select value={rechargeLicense} onChange={event => setRechargeLicense(event.target.value)} className="mt-2 block w-full rounded-card border p-3">
            {licenses.map(item => <option key={item.id} value={item.id}>{item.organization_id ? "Institucional" : "Individual"} · {plans[item.plan].name}</option>)}
          </select>
        </label>
        <label className="text-sm">Pacotes
          <input type="number" min={1} max={100} value={rechargeQuantity} onChange={event => setRechargeQuantity(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
      </div>
      <p className="mt-4 text-sm"><strong>{money(rechargeQuote.grossAmountCents)}</strong> · {rechargeQuote.tokenAllowance.toLocaleString("pt-BR")} tokens</p>
      <button type="button" disabled={busy || !rechargeLicense} onClick={createRechargeRequest} className="mt-4 rounded-card border border-teal px-4 py-2 text-teal disabled:opacity-50">Solicitar recarga sem cobrança</button>
    </section> : null}

    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">Minhas solicitações</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Data</th><th className="p-2">Tipo</th><th className="p-2">Plano/vagas</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">Ação</th></tr></thead>
          <tbody>{requests.map(item => <tr key={item.id} className="border-t">
            <td className="p-2">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
            <td className="p-2">{item.kind === "individual" ? "Individual" : item.kind === "institutional" ? "Residência" : "Recarga"}</td>
            <td className="p-2">{item.kind === "recharge" ? `${item.quantity} pacote(s)` : `${item.plan ? plans[item.plan].name : "—"} · ${item.seats} vaga(s)`}</td>
            <td className="p-2">{money(item.total_amount_cents)}</td>
            <td className="p-2">{requestStatus(item.status)}</td>
            <td className="p-2">{["requested", "approved", "payment_pending"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => cancelRequest(item.id)} className="text-teal underline">Cancelar</button> : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!requests.length ? <p className="mt-3 text-sm text-ink-soft">Nenhuma solicitação registrada.</p> : null}
    </section>

    <div className="mt-6 flex flex-wrap gap-5 text-sm">
      <Link href="/licenca" className="text-teal underline">Voltar para licença e consumo</Link>
      <Link href="/planos" className="text-teal underline">Comparar planos</Link>
    </div>
  </div>;
}

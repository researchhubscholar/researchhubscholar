"use client";
import { purchaseHref, readPurchaseIntent, type PurchaseIntent } from "@/lib/access/purchase-journey";
import { publicDesignCopy } from "@/lib/i18n/public-design-copy";
import { advisorCopy } from "@/lib/i18n/advisor-copy";
import { intlLocale } from "@/lib/i18n/format";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


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
 const {locale:formatLocale}=useLanguage();
 const c=publicDesignCopy(formatLocale);const advisor=advisorCopy(formatLocale);

  const { t: uiText } = useLanguage();
  const [purchase, setPurchase] = useState<PurchaseIntent>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [kind, setKind] = useState<Exclude<CommerceKind, "recharge">>("individual");
  const [plan, setPlan] = useState<PlanKey>("essential");
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
  const [quotePreview, setQuotePreview] = useState<{ grossAmountCents: number; discountCents: number; totalAmountCents: number; tokenAllowance: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const quote = useMemo(() => localQuote(kind, plan, seats), [kind, plan, seats]);
  const [rechargeQuote, setRechargeQuote] = useState<{ totalAmountCents: number; tokenAllowance: number } | null>(null);
  const [rechargeQuoteLoading, setRechargeQuoteLoading] = useState(false);
  const [rechargeQuoteError, setRechargeQuoteError] = useState("");

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

  useEffect(() => {
    const intent = readPurchaseIntent(new URLSearchParams(window.location.search));
    setPurchase(intent);
    if (intent.plan) setPlan(intent.plan);
    if (intent.coupon) setCoupon(intent.coupon);
    void load();
  }, []);

  // Callback navigation never grants access. Only a fulfilled order under RLS
  // can redirect the buyer to their active workspace or credited wallet.
  useEffect(() => {
    if (!userId) return;
    const params = new URL(window.location.href).searchParams;
    const orderId = params.get("pedido"), outcome = params.get("pagamento");
    if (!orderId || !/^[a-f0-9-]{36}$/i.test(orderId)) return;
    const es = formatLocale === "es";
    if (outcome === "cancelado" || outcome === "expirado") {
      setMessage(es ? "El pago no se completó. Consulta tu pedido antes de intentarlo de nuevo." : "O pagamento não foi concluído. Confira seu pedido antes de tentar novamente.");
      return;
    }
    if (outcome !== "retorno") return;
    let active = true;
    const deadline = Date.now() + 90_000;
    let checking = false;
    setMessage(es ? "Esperando la confirmación del pago. La activación es automática." : "Aguardando a confirmação do pagamento. A ativação é automática.");
    const check = async () => {
      if (!active || checking) return;
      checking = true;
      try {
        const { data, error } = await supabaseBrowser().from("scholar_purchase_requests")
          .select("status,fulfilled_license_id,kind").eq("id", orderId).eq("requester_id", userId).maybeSingle();
        if (!active) return;
        if (!error && data?.status === "activated" && data.fulfilled_license_id) {
          active = false;
          window.location.assign(data.kind === "recharge" ? "/licenca" : "/dashboard");
        } else if (Date.now() >= deadline) {
          active = false;
          setMessage(es ? "El pago sigue en confirmación. Tu pedido está guardado; consulta Mi licencia en unos minutos." : "O pagamento continua em confirmação. Seu pedido está salvo; confira Minha licença em alguns minutos.");
        }
      } catch {
        if (active && Date.now() >= deadline) {
          active = false;
          setMessage(es ? "Consulta Mi licencia para verificar la confirmación del pago." : "Confira Minha licença para verificar a confirmação do pagamento.");
        }
      } finally { checking = false; }
    };
    void check();
    const timer = setInterval(() => { void check(); }, 3_000);
    return () => { active = false; clearInterval(timer); };
  }, [userId, formatLocale]);

  // Preview exactly the same authoritative server quote used when creating a purchase.
  // Never display an unverified discount or let a stale quote authorize checkout.
  useEffect(() => {
    let active = true;
    setQuoteLoading(true);
    setQuoteError("");
    setQuotePreview(null);
    const handle = setTimeout(async () => {
      const { data, error } = await supabaseBrowser().rpc("scholar_commerce_quote", {
        p_kind: kind, p_plan: plan, p_seats: kind === "institutional" ? seats : 1,
        p_quantity: 1, p_coupon: coupon.trim() || null,
      });
      if (!active) return;
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        setQuoteError(error?.message || "Não foi possível calcular o valor final. Confira os dados e tente novamente.");
      } else {
        setQuotePreview({
          grossAmountCents: Number(data.grossAmountCents),
          discountCents: Number(data.discountCents),
          totalAmountCents: Number(data.totalAmountCents),
          tokenAllowance: Number(data.tokenAllowance),
        });
      }
      setQuoteLoading(false);
    }, 300);
    return () => { active = false; clearTimeout(handle); };
  }, [kind, plan, seats, coupon]);

  useEffect(() => {
    if (!rechargeLicense) return;
    let active = true;
    setRechargeQuoteLoading(true);
    setRechargeQuote(null);
    setRechargeQuoteError("");
    const timer = setTimeout(async () => {
      const { data, error } = await supabaseBrowser().rpc("scholar_commerce_quote", {
        p_kind: "recharge", p_plan: null, p_seats: 1,
        p_quantity: rechargeQuantity, p_coupon: coupon.trim() || null,
      });
      if (!active) return;
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        setRechargeQuoteError(error?.message || (formatLocale === "es" ? "No se pudo calcular la recarga." : "Não foi possível calcular a recarga."));
      } else {
        setRechargeQuote({ totalAmountCents: Number(data.totalAmountCents), tokenAllowance: Number(data.tokenAllowance) });
      }
      setRechargeQuoteLoading(false);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [rechargeLicense, rechargeQuantity, coupon, formatLocale]);

  async function openCheckout(purchaseId: string) {
      try {
        const checkoutResponse = await fetch("/api/asaas/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: purchaseId }),
        });
        const checkout = await checkoutResponse.json() as { url?: string; error?: string };
        if (!checkoutResponse.ok || !checkout.url) {
          setMessage(checkout.error || "Não foi possível abrir o checkout.");
        } else {
          window.location.assign(checkout.url);
          return true;
        }
      } catch {
        setMessage("Não foi possível conectar ao pagamento. Tente novamente.");
      }
    return false;
  }

  async function resumeCheckout(purchaseId: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    if (await openCheckout(purchaseId)) return;
    setBusy(false);
    await load();
  }

  async function createRequest() {
    if (!userId || busy || quoteLoading || quoteError || !quotePreview) return;
    setBusy(true);
    setMessage("");
    const { data: purchaseId, error } = await supabaseBrowser().rpc("scholar_create_purchase_request", {
      p_kind: kind,
      p_plan: plan,
      p_billing_schedule: schedule,
      p_seats: kind === "institutional" ? seats : 1,
      p_quantity: 1,
      p_organization_name: kind === "institutional" ? organizationName : null,
      p_target_license: null,
      p_coupon: coupon || null,
    });
    if (error || !purchaseId) {
      setBusy(false);
      setMessage(error?.message || "Não foi possível registrar a solicitação.");
      return;
    }
    if (paymentsEnabled && kind === "individual") {
      if (await openCheckout(purchaseId)) return;
    } else if (paymentsEnabled) {
      setMessage("Solicitação institucional registrada. A equipe entrará em contato para concluir a contratação.");
    } else {
      setMessage("Solicitação registrada sem cobrança. A equipe poderá acompanhar o pedido no painel operacional.");
    }
    setBusy(false);
    await load();
  }

  async function createRechargeRequest() {
    if (!rechargeLicense || busy || rechargeQuoteLoading || rechargeQuoteError || !rechargeQuote) return;
    setBusy(true);
    setMessage("");
    const { data: purchaseId, error } = await supabaseBrowser().rpc("scholar_create_purchase_request", {
      p_kind: "recharge",
      p_plan: null,
      p_billing_schedule: "annual",
      p_seats: 1,
      p_quantity: rechargeQuantity,
      p_organization_name: null,
      p_target_license: rechargeLicense,
      p_coupon: coupon || null,
    });
    if (error || !purchaseId) {
      setBusy(false);
      setMessage(error?.message || "Não foi possível solicitar a recarga.");
      return;
    }
    if (paymentsEnabled) {
      try {
        const response = await fetch("/api/asaas/checkout", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: purchaseId }),
        });
        const checkout = await response.json() as { url?: string; error?: string };
        if (response.ok && checkout.url) {
          window.location.assign(checkout.url);
          return;
        }
        setMessage(checkout.error || "Não foi possível abrir o pagamento da recarga.");
      } catch {
        setMessage("Não foi possível conectar ao pagamento da recarga. Tente novamente.");
      }
    } else {
      setMessage("Recarga registrada. O pagamento ainda não está disponível.");
    }
    setBusy(false);
    await load();
  }

  async function cancelRequest(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/asaas/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: id }),
      });
      const result = await response.json();
      if (!response.ok || !result.cancelled) throw new Error(result.error || "Não foi possível cancelar a solicitação.");
      setMessage(formatLocale === "es" ? "Solicitud cancelada." : "Solicitação cancelada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !licenses.length || window.location.hash !== "#recarga") return;
    const section = document.querySelector<HTMLDetailsElement>("#recarga");
    if (section) {
      section.open = true;
      section.scrollIntoView();
    }
  }, [loading, licenses.length]);

  if (loading) return <div className="scholar-workspace secondary-page commerce-page checkout-workspace max-w-5xl mx-auto"><p role="status"><InterfaceText message="screen.2c1aafb83914" /></p></div>;
  if (!userId) return <div className="scholar-workspace secondary-page commerce-page checkout-workspace max-w-5xl mx-auto">
    <h1 className="font-display text-4xl"><InterfaceText message="screen.083cff630878" /></h1>
    <div className="mt-5 flex flex-wrap gap-4">
      <Link href={purchaseHref("/cadastro", purchase)} className="public-button"><InterfaceText message="nav.signup" /></Link>
      <Link href={purchaseHref("/login", purchase)} className="inline-flex items-center text-teal underline"><InterfaceText message="nav.login" /></Link>
    </div>
  </div>;

  const currentPlan = licenses.find(item => !item.organization_id && item.owner_id === userId && item.status === "active");
  const pending = requests.find(item => item.kind !== "institutional" && item.status === "payment_pending");
  return <div className="scholar-workspace secondary-page commerce-page checkout-workspace max-w-5xl mx-auto">
    <header className="checkout-page-header">
      <p className="text-xs uppercase tracking-widest text-teal">{formatLocale === "es" ? "Contratación" : "Contratação"}</p>
      <h1 className="font-display mt-2">{formatLocale === "es" ? "Suscripción" : "Assinatura"}</h1>
      <p className="text-ink-soft mt-2">
        {formatLocale === "es" ? "Selecciona tu plan, revisa el valor final y continúa al pago. Tu acceso se activará después de confirmar el pago." : "Selecione seu plano, confira o valor final e siga para o pagamento. Seu acesso será liberado após a confirmação."}
      </p>
    </header>

    {currentPlan && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
      <p className="text-sm">{formatLocale === "es" ? "Plan actual" : "Plano atual"} · <strong>{plans[currentPlan.plan].name}</strong></p>
      <Link href="/licenca" className="text-sm text-teal underline">{formatLocale === "es" ? "Ver mi licencia" : "Ver minha licença"}</Link>
    </div>}
    {pending && paymentsEnabled && <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal-soft p-4">
      <div><h2 className="font-medium">{formatLocale === "es" ? "Pago pendiente" : "Pagamento pendente"}</h2>
        <p className="text-sm text-ink-soft">{pending.plan ? plans[pending.plan].name : "Recarga"} · {money(pending.total_amount_cents)}</p></div>
      <button type="button" disabled={busy} onClick={() => void resumeCheckout(pending.id)} className="min-h-11 rounded-card bg-teal px-4 py-2 text-sm text-white disabled:opacity-50">{formatLocale === "es" ? "Reanudar pago" : "Retomar pagamento"}</button>
    </section>}
    <div className="checkout-notice mt-5 text-sm" role="note">
      <span className="checkout-notice-dot" aria-hidden="true" />
      <p><strong>{paymentsEnabled ? (formatLocale === "es" ? "Pago seguro." : "Pagamento seguro.") : (formatLocale === "es" ? "Pago no disponible." : "Pagamento indisponível.")}</strong>{" "}
      {paymentsEnabled ? (formatLocale === "es" ? "Consulta el total antes de continuar a Asaas." : "Confira o total antes de continuar para o Asaas.") : (formatLocale === "es" ? "Inténtalo más tarde." : "Tente novamente mais tarde.")}</p>
    </div>
    {message ? <p role="status" className="mt-5 rounded-card border border-line bg-white p-4 text-sm"><AuthoredText text={message} /></p> : null}

    <div className="purchase-layout"><section className="purchase-main rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-2xl">{formatLocale === "es" ? "Datos de contratación" : "Dados da contratação"}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm"><InterfaceText message="screen.94f633413108" />
          <select value={kind} onChange={event => setKind(event.target.value as typeof kind)} className="mt-2 block w-full rounded-card border p-3">
            <option value="individual">Individual</option>
            <option value="institutional">{uiText("screen.dc953d4ca934")}</option>
          </select>
        </label>
        <label className="text-sm"><InterfaceText message="screen.6c55806376ab" />
          <select value={plan} onChange={event => setPlan(event.target.value as PlanKey)} className="mt-2 block w-full rounded-card border p-3">
            {Object.entries(plans).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm"><InterfaceText message="screen.957bc40226f7" />
          <select value={schedule} onChange={event => setSchedule(event.target.value as BillingSchedule)} className="mt-2 block w-full rounded-card border p-3">
            <option value="annual">{uiText("screen.9d4f11e25866")}</option>
            <option value="12x">{uiText("screen.4d43a6558c98")}</option>
          </select>
        </label>
        {kind === "institutional" ? <label className="text-sm"><InterfaceText message="screen.33ad4aad4288" />
          <input type="number" min={1} max={10000} value={seats} onChange={event => setSeats(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label> : null}
        {kind === "institutional" ? <label className="text-sm md:col-span-2"><InterfaceText message="screen.8f92935483c2" />
          <input required minLength={2} maxLength={200} value={organizationName} onChange={event => setOrganizationName(event.target.value)} className="mt-2 block w-full rounded-card border p-3" placeholder={uiText("screen.f24b447bf58e")} />
        </label> : null}
        <label className="text-sm md:col-span-2"><InterfaceText message="screen.0145d934eb76" />
          <input maxLength={40} value={coupon} onChange={event => setCoupon(event.target.value.toUpperCase())} className="mt-2 block w-full rounded-card border p-3 uppercase" placeholder={formatLocale === "es" ? "Código de descuento (opcional)" : "Código de desconto (opcional)"} />
        </label>
      </div>

      <p className="mt-3 text-xs text-ink-soft">{formatLocale === "es" ? "El valor final se valida antes de abrir el pago." : "O valor final será validado antes de abrir o pagamento."}</p>
      {quoteError ? <p role="alert" className="mt-3 text-sm text-red-700">{quoteError}</p> : null}
      {message && <p className="mb-3 text-sm text-ink-soft"><AuthoredText text={message} /></p>}
      <button type="button" disabled={busy || quoteLoading || !quotePreview || Boolean(quoteError) || (kind === "institutional" && organizationName.trim().length < 2)} onClick={createRequest} className="purchase-continue mt-5 rounded-card bg-teal px-5 py-3 text-white font-semibold disabled:opacity-50">
        {busy ? (formatLocale === "es" ? "Preparando..." : "Preparando...") : kind === "institutional" ? (formatLocale === "es" ? "Solicitar contratación institucional" : "Solicitar contratação institucional") : (formatLocale === "es" ? "Continuar al pago seguro" : "Continuar para pagamento seguro")}
      </button>
    </section><aside className="purchase-summary" aria-label={formatLocale === "es" ? "Resumen de suscripción" : "Resumo da assinatura"}><p className="checkout-summary-eyebrow">{c.purchaseSummary}</p><h2>{plans[plan].name}</h2><p className="purchase-price">{quoteLoading ? "—" : money(quotePreview?.totalAmountCents ?? quote.grossAmountCents)}</p><p>{c.annual}</p>
      {quotePreview && quotePreview.discountCents > 0 ? <p className="purchase-discount mt-2 text-sm"><span className="line-through opacity-65">{money(quotePreview.grossAmountCents)}</span> <strong>{formatLocale === "es" ? "Descuento" : "Desconto"}: -{money(quotePreview.discountCents)}</strong></p> : null}      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft"><InterfaceText message="screen.920c48e9ba3e" /></p><p className="mt-2 text-xl">{quoteLoading ? "—" : money(quotePreview?.grossAmountCents ?? quote.grossAmountCents)}</p></div>
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft">{schedule === "12x" ? uiText("screen.5767a5fa021e") : "Pagamento"}</p><p className="mt-2 text-xl">{quoteLoading ? "—" : schedule === "12x" ? money(Math.ceil((quotePreview?.totalAmountCents ?? quote.grossAmountCents) / 12)) : "1 parcela"}</p></div>
        <div className="rounded-card bg-paper p-4"><p className="text-xs text-ink-soft"><InterfaceText message="screen.9dea6203ae5a" /></p><p className="mt-2 text-xl">{(quotePreview?.tokenAllowance ?? quote.tokenAllowance).toLocaleString(intlLocale(formatLocale))}</p><p className="text-xs">tokens</p></div>
      </div>
{kind==="individual"?<p className="purchase-advisor">{advisor.benefit(plans[plan].advisorsPerProject)}</p>:null}</aside></div>

    {licenses.length ? <details id="recarga" className="mt-7 scroll-mt-24 rounded-2xl border border-line bg-white p-5">
      <summary className="cursor-pointer font-medium">{formatLocale === "es" ? "Comprar tokens adicionales" : "Comprar tokens extras"}</summary>
      <p className="mt-2 text-sm text-ink-soft"><InterfaceText message="screen.b5cacf9e1de6" /></p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm"><InterfaceText message="screen.70dfbb512f68" />
          <select value={rechargeLicense} onChange={event => setRechargeLicense(event.target.value)} className="mt-2 block w-full rounded-card border p-3">
            {licenses.map(item => <option key={item.id} value={item.id}>{item.organization_id ? "Institucional" : "Individual"} · {plans[item.plan].name}</option>)}
          </select>
        </label>
        <label className="text-sm"><InterfaceText message="screen.3cbfc4850066" />
          <input type="number" min={1} max={100} value={rechargeQuantity} onChange={event => setRechargeQuantity(Number(event.target.value))} className="mt-2 block w-full rounded-card border p-3" />
        </label>
      </div>
      {rechargeQuote ? <p className="mt-4 text-sm"><strong>{money(rechargeQuote.totalAmountCents)}</strong> · {rechargeQuote.tokenAllowance.toLocaleString(intlLocale(formatLocale))} tokens</p> : <p role="status" className="mt-4 text-sm">{rechargeQuoteError || (formatLocale === "es" ? "Calculando recarga..." : "Calculando recarga...")}</p>}
      <button type="button" disabled={busy || !rechargeLicense || rechargeQuoteLoading || Boolean(rechargeQuoteError) || !rechargeQuote} onClick={createRechargeRequest} className="mt-4 rounded-card border border-teal px-4 py-2 text-teal disabled:opacity-50">{busy ? (formatLocale === "es" ? "Preparando..." : "Preparando...") : (formatLocale === "es" ? "Comprar tokens adicionales" : "Comprar tokens extras")}</button>
    </details> : null}

    <details className="mt-7 rounded-2xl border border-line bg-white p-5">
      <summary className="cursor-pointer font-medium"><InterfaceText message="screen.609493ad3ecc" /></summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2"><InterfaceText message="screen.cec3a9b89b2e" /></th><th className="p-2">Tipo</th><th className="p-2"><InterfaceText message="screen.5b41dbc68c28" /></th><th className="p-2"><InterfaceText message="screen.b2f530c46991" /></th><th className="p-2"><InterfaceText message="screen.920e413c7d41" /></th><th className="p-2"><InterfaceText message="screen.1dfbdde6410a" /></th></tr></thead>
          <tbody>{requests.map(item => <tr key={item.id} className="border-t">
            <td className="p-2">{new Date(item.created_at).toLocaleDateString(intlLocale(formatLocale))}</td>
            <td className="p-2">{item.kind === "individual" ? "Individual" : item.kind === "institutional" ? uiText("screen.418f4046fd07") : "Recarga"}</td>
            <td className="p-2">{item.kind === "recharge" ? `${item.quantity} pacote(s)` : `${item.plan ? plans[item.plan].name : "—"} · ${item.seats} vaga(s)`}</td>
            <td className="p-2">{money(item.total_amount_cents)}</td>
            <td className="p-2">{requestStatus(item.status)}</td>
            <td className="p-2">
              {paymentsEnabled && item.kind !== "institutional" && ["requested", "approved", "payment_pending"].includes(item.status) &&
                <button type="button" disabled={busy} onClick={() => void resumeCheckout(item.id)} className="mr-3 text-teal underline">
                  {formatLocale === "es" ? "Reanudar pago" : "Retomar pagamento"}
                </button>}
              {["requested", "approved", "payment_pending"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => cancelRequest(item.id)} className="text-teal underline">Cancelar</button> : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!requests.length ? <p className="mt-3 text-sm text-ink-soft"><InterfaceText message="screen.68842c1604b0" /></p> : null}
    </details>

    <div className="checkout-links mt-6 flex flex-wrap gap-5 text-sm">
      <Link href="/licenca" className="text-teal underline"><InterfaceText message="screen.1ee0fcabfabd" /></Link>
      <Link href="/planos" className="text-teal underline"><InterfaceText message="screen.f273f15de044" /></Link>
    </div>
  </div>;
}

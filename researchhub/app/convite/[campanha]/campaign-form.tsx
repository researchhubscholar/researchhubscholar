"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { campaignPhoneCountries } from "../../../lib/campaigns/phone-countries";

const field = "mt-1.5 w-full rounded-card border border-[var(--campaign-field-line)] bg-[var(--public-paper)] px-3 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal";
const primary = "inline-flex min-h-12 items-center justify-center rounded-card bg-teal px-4 py-3 text-sm font-semibold text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60";

export default function CampaignForm({ campaign, available, discountCents }: { campaign: string; available: boolean; discountCents: number }) {
  const endpoint = "/api/convite/" + campaign;
  const discount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: discountCents % 100 ? 2 : 0 }).format(discountCents / 100);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const viewed = useRef(false);
  const sending = useRef(false);
  const successTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!available || viewed.current) return;
    viewed.current = true;
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "view" }),
    }).catch(() => undefined);
  }, [available, endpoint]);

  useEffect(() => {
    if (code) successTitle.current?.focus();
  }, [code]);

  function track(event: "copy" | "plans") {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || sending.current) return;
    const values = new FormData(event.currentTarget);
    const utm = new URLSearchParams(window.location.search);
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"), email: values.get("email"), phone: values.get("phone"),
          phone_country: values.get("phone_country"),
          website: values.get("website"), marketing: values.get("marketing") === "on",
          utm_source: utm.get("utm_source"), utm_medium: utm.get("utm_medium"), utm_campaign: utm.get("utm_campaign"),
        }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.code !== "string") {
        setError(result.error || "Não foi possível concluir seu cadastro. Tente novamente.");
        return;
      }
      setCode(result.code);
    } catch {
      setError("Não foi possível conectar. Confira sua internet e tente novamente.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function copyCode() {
    track("copy");
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Cupom copiado.");
    } catch {
      setFeedback("Selecione e copie o código manualmente.");
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-[var(--campaign-panel)] p-4 sm:p-6" aria-labelledby="campaign-form-title">
      {code ? <>
        <h2 ref={successTitle} tabIndex={-1} id="campaign-form-title" className="font-display text-3xl text-ink">
          Seu desconto está garantido!
        </h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Você acaba de receber {discount} de desconto para começar sua jornada científica com o ResearchHub.
        </p>
        <p className="my-4 break-words rounded-card border border-line bg-[var(--public-sage)] p-4 text-center font-mono text-2xl font-semibold tracking-wider text-ink">
          {code}
        </p>
        <div className="mt-5 grid gap-3">
          <Link href={`/planos?cupom=${encodeURIComponent(code)}`} className={primary} onClick={() => track("plans")}>Ver planos anuais</Link>
          <button type="button" className="min-h-11 rounded-card bg-teal-soft px-4 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal" onClick={copyCode}>Copiar cupom</button>
        </div>
        <p role="status" className="mt-3 text-sm text-ink">{feedback}</p>
      </> : <>
        <h2 id="campaign-form-title" className="font-display text-3xl text-ink">Receba seu cupom</h2>
        {!available && <p className="mt-3 rounded-card bg-[var(--public-sage)] px-3 py-2.5 text-sm leading-relaxed text-ink" role="status">As inscrições desta campanha estão indisponíveis no momento.</p>}
        <form className="mt-4" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy || !available} className="min-w-0 space-y-3.5">
            <label className="block text-sm font-medium text-ink">
              Nome completo
              <input className={field} name="name" autoComplete="name" required minLength={3} maxLength={120} />
            </label>
            <label className="block text-sm font-medium text-ink">
              E-mail
              <input className={field} type="email" name="email" autoComplete="email" required maxLength={254} />
            </label>
            <div className="grid grid-cols-[minmax(8rem,0.85fr)_minmax(0,1fr)] gap-2">
              <label className="min-w-0 text-sm font-medium text-ink">
                País
                <select className={field} name="phone_country" defaultValue="BR" aria-label="País do WhatsApp">
                  {campaignPhoneCountries.map(({ country, label, code }) =>
                    <option key={country} value={country}>{label} ({code})</option>,
                  )}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium text-ink">
                WhatsApp
                <input className={field} type="tel" name="phone" autoComplete="tel-national" aria-describedby="campaign-phone-help" required maxLength={32} />
              </label>
              <p id="campaign-phone-help" className="col-span-2 text-xs text-ink-soft">
                Inclua o código de área, se houver. Você também pode colar o número com o código do país.
              </p>
            </div>
            <div hidden aria-hidden="true">
              <label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <p className="text-xs leading-relaxed text-ink-soft">
              Usamos seus dados para registrar sua participação. Consulte nossa{" "}
              <Link href="/privacidade#campanhas" className="font-medium text-teal underline underline-offset-2">Política de Privacidade</Link>.
            </p>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
              <input className="mt-1 h-4 w-4 shrink-0 accent-[var(--public-green)]" type="checkbox" name="marketing" />
              <span>Quero receber novidades, campanhas e comunicações promocionais do ResearchHub por e-mail ou WhatsApp. (Opcional)</span>
            </label>
            {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
            <button className={primary + " w-full"} type="submit">{busy ? "REGISTRANDO..." : "GARANTIR MEU DESCONTO"}</button>
            {available && <p className="text-center text-xs text-ink-soft">Seu cupom será liberado imediatamente após o cadastro.</p>}
          </fieldset>
        </form>
      </>}
    </section>
  );
}

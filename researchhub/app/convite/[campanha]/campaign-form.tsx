"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { campaignPhoneCountries } from "../../../lib/campaigns/phone-countries";

const spanishErrors: Record<string, string> = {
  "Informe seu nome completo.": "Introduce tu nombre completo.",
  "Informe um endereço de e-mail válido.": "Introduce un correo electrónico válido.",
  "Selecione o país do seu WhatsApp.": "Selecciona el país de tu número de WhatsApp.",
  "Confira o número de WhatsApp e inclua o código de área, se houver.": "Revisa tu número de WhatsApp e incluye el código de área, si corresponde.",
  "Esta campanha está indisponível.": "Esta campaña no está disponible.",
  "Muitos cadastros nesta conexão. Tente novamente em alguns minutos.": "Se han recibido demasiados registros. Inténtalo en unos minutos.",
  "Não foi possível conectar. Confira sua internet e tente novamente.": "Revisa tu conexión a internet y vuelve a intentarlo."
};

const field = "mt-1.5 w-full rounded-card border border-[var(--campaign-field-line)] bg-[var(--public-paper)] px-3 py-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal";
const primary = "inline-flex min-h-12 items-center justify-center rounded-card bg-teal px-4 py-3 text-sm font-semibold text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60";

export default function CampaignForm({ campaign, available, discountCents }: { campaign: string; available: boolean; discountCents: number }) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const endpoint = "/api/convite/" + campaign;
  const discount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: discountCents % 100 ? 2 : 0 }).format(discountCents / 100);
  const [code, setCode] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 60000));
  useEffect(() => {
    if (deadline === null || remaining === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline, remaining]);
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
      if (response.ok && result.expired) {
        setDeadline(0);
        return;
      }
      if (!response.ok || typeof result.code !== "string") {
        setError(result.error || "Não foi possível concluir seu cadastro. Tente novamente.");
        return;
      }
      setNow(Date.now());
      setDeadline(result.validUntil ? Date.parse(result.validUntil) : null);
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
      {remaining === 0 ? <>
        <h2 id="campaign-form-title" className="font-display text-3xl text-ink">{es ? "Tu cupón ha caducado" : "Seu cupom expirou"}</h2>
        <Link href="/planos" className={primary}>{es ? "Ver planes anuales" : "Ver planos anuais"}</Link>
      </> : code ? <>
        <h2 ref={successTitle} tabIndex={-1} id="campaign-form-title" className="font-display text-3xl text-ink">
          {es ? "¡Tu descuento está listo!" : "Seu desconto está garantido!"}
        </h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          {es ? `Acabas de recibir un descuento de ${discount} para comenzar tu investigación con ResearchHub.` : `Você acaba de receber ${discount} de desconto para começar sua jornada científica com o ResearchHub.`}
        </p>
        <p className="my-4 break-words rounded-card border border-line bg-[var(--public-sage)] p-4 text-center font-mono text-2xl font-semibold tracking-wider text-ink">
          {code}
        </p>
        {remaining !== null && <div className="text-center text-ink">
          <div role="timer" aria-live="off" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-card bg-[#a52232] px-4 py-3 text-white">
            <span className="font-semibold">{es ? "Tu cupón vence en" : "Seu cupom expira em"}</span>
            <strong className="whitespace-nowrap text-2xl tabular-nums">{Math.floor(remaining / 60)}h {String(remaining % 60).padStart(2, "0")}min</strong>
          </div>
          <p className="mt-2 text-sm">{es ? "Usa este mismo correo electrónico al comprar para aplicar el descuento." : "Use este mesmo e-mail na compra para aplicar o desconto."}</p>
        </div>}
        <div className="mt-5 grid gap-3">
          <Link href={`/planos?cupom=${encodeURIComponent(code)}`} className={primary} onClick={() => track("plans")}>{es ? "Ver planes anuales" : "Ver planos anuais"}</Link>
          <button type="button" className="min-h-11 rounded-card bg-teal-soft px-4 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal" onClick={copyCode}>{es ? "Copiar cupón" : "Copiar cupom"}</button>
        </div>
        <p role="status" className="mt-3 text-sm text-ink">{es && feedback ? (feedback === "Cupom copiado." ? "Cupón copiado." : "Selecciona y copia el código manualmente.") : feedback}</p>
      </> : <>
        <h2 id="campaign-form-title" className="font-display text-3xl text-ink">{es ? "Obtén tu cupón" : "Receba seu cupom"}</h2>
        {!available && <p className="mt-3 rounded-card bg-[var(--public-sage)] px-3 py-2.5 text-sm leading-relaxed text-ink" role="status">{es ? "El registro para esta campaña no está disponible en este momento." : "As inscrições desta campanha estão indisponíveis no momento."}</p>}
        <form className="mt-4" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy || !available} className="min-w-0 space-y-3.5">
            <label className="block text-sm font-medium text-ink">
              {es ? "Nombre completo" : "Nome completo"}
              <input className={field} name="name" autoComplete="name" required minLength={3} maxLength={120} />
            </label>
            <label className="block text-sm font-medium text-ink">
              {es ? "Correo electrónico" : "E-mail"}
              <input className={field} type="email" name="email" autoComplete="email" required maxLength={254} />
            </label>
            <div className="grid grid-cols-[minmax(8rem,0.85fr)_minmax(0,1fr)] gap-2">
              <label className="min-w-0 text-sm font-medium text-ink">
                País
                <select className={field} name="phone_country" defaultValue="BR" aria-label={es ? "País de tu número de WhatsApp" : "País do WhatsApp"}>
                  {campaignPhoneCountries.map(({ country, label, code }) =>
                    <option key={country} value={country}>{es ? new Intl.DisplayNames(["es"], { type: "region" }).of(country) : label} ({code})</option>,
                  )}
                </select>
              </label>
              <label className="min-w-0 text-sm font-medium text-ink">
                WhatsApp
                <input className={field} type="tel" name="phone" autoComplete="tel-national" aria-describedby="campaign-phone-help" required maxLength={32} />
              </label>
              <p id="campaign-phone-help" className="col-span-2 text-xs text-ink-soft">
                {es ? "Incluye el código de área, si corresponde. También puedes pegar el número con el prefijo internacional." : "Inclua o código de área, se houver. Você também pode colar o número com o código do país."}
              </p>
            </div>
            <div hidden aria-hidden="true">
              <label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <p className="text-xs leading-relaxed text-ink-soft">
              {es ? "Usamos tus datos para registrar tu participación. Consulta nuestra" : "Usamos seus dados para registrar sua participação. Consulte nossa"}{" "}
              <Link href="/privacidade#campanhas" className="font-medium text-teal underline underline-offset-2">{es ? "Política de privacidad" : "Política de Privacidade"}</Link>.
            </p>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
              <input className="mt-1 h-4 w-4 shrink-0 accent-[var(--public-green)]" type="checkbox" name="marketing" />
              <span>{es ? "Quiero recibir novedades, campañas y comunicaciones promocionales de ResearchHub por correo electrónico o WhatsApp. (Opcional)" : "Quero receber novidades, campanhas e comunicações promocionais do ResearchHub por e-mail ou WhatsApp. (Opcional)"}</span>
            </label>
            {error && <p role="alert" className="text-sm text-red-800">{es ? spanishErrors[error] ?? "No se pudo completar el registro. Inténtalo de nuevo." : error}</p>}
            <button className={primary + " w-full"} type="submit">{busy ? "REGISTRANDO..." : es ? "OBTENER MI DESCUENTO" : "GARANTIR MEU DESCONTO"}</button>
            {available && <p className="text-center text-xs text-ink-soft">{es ? "Recibirás tu cupón en cuanto completes el formulario." : "Seu cupom será liberado imediatamente após o cadastro."}</p>}
          </fieldset>
        </form>
      </>}
    </section>
  );
}

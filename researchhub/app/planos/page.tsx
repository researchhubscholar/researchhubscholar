import { purchaseHref, readPurchaseIntent } from "@/lib/access/purchase-journey";
import { publicDesignCopy } from "@/lib/i18n/public-design-copy";
import { advisorCopy } from "@/lib/i18n/advisor-copy";
import { intlLocale } from "@/lib/i18n/format";
import InterfaceText from "@/components/i18n/interface-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import PageHeading from "@/components/public/page-heading";
import Link from "next/link";
import { plans, money, policy } from "@/lib/access/plans";
export default async function Plans({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }){
 const formatLocale=await getRequestLocale();
 const c=publicDesignCopy(formatLocale);
 const advisor=advisorCopy(formatLocale);

  const requestLocale = await getRequestLocale();
  const intent = readPurchaseIntent(await searchParams);
  const uiText = (key: MessageKey) => translate(requestLocale, key);return <div className="marketing-page"><PageHeading eyebrow={uiText("screen.170960641b2a")} title={c.pricingTitle} description={c.pricingDescription} /><p className="concept-annual">{c.annual}</p><div className="pricing-grid">{Object.entries(plans).map(([key,p])=><section key={p.name} className={`pricing-card ${p.name==="Plus"?"pricing-featured":""}`}><p className="public-eyebrow">{p.name==="Essencial"?uiText("screen.6a443a23e725"):p.name==="Plus"?uiText("screen.795ac56c9efa"):(requestLocale === "es" ? "Mayor cuota de IA" : "Maior franquia de IA")}</p><h2 className="font-display text-3xl mt-3">{p.name}</h2><p className="plan-price">{money(p.annualCents)}<span className="text-sm text-ink-soft"> <InterfaceText message="screen.e2f94f11c39b" /></span></p><p className="plan-quota">{(p.tokens/1000000).toLocaleString(intlLocale(formatLocale))} {requestLocale === "es" ? "millones de tokens en la cuota anual" : "milhões de tokens na franquia anual"}</p><p className="text-sm text-ink-soft mt-4">{requestLocale === "es" ? "Ideas, Radar, biblioteca, matriz, proyectos e historial." : "Ideias, Radar, biblioteca, matriz, projetos e histórico."}</p><p className="text-sm mt-3">{advisor.benefit(p.advisorsPerProject)}</p><Link href={purchaseHref("/contratacao", { plan: key as keyof typeof plans, coupon: intent.coupon })} className="public-button plan-button">Contratar</Link></section>)}</div><section className="plan-comparison"><h2><InterfaceText message="screen.522a6d06616f" /></h2><div className="table-scroll"><table><caption className="sr-only"><InterfaceText message="screen.6f5d8fbb8e49" /></caption><thead><tr><th scope="col">{requestLocale === "es" ? "Función" : "Recurso"}</th>{Object.values(plans).map(p=><th key={p.name} scope="col">{p.name}</th>)}</tr></thead><tbody><tr><th scope="row"><InterfaceText message="screen.854b4303e304" /></th><td><InterfaceText message="screen.da9282445f88" /></td><td><InterfaceText message="screen.da9282445f88" /></td><td><InterfaceText message="screen.da9282445f88" /></td></tr><tr><th scope="row"><InterfaceText message="screen.1a7b10910f1f" /></th>{Object.values(plans).map(p=><td key={p.name}>{p.tokens/1000000} <InterfaceText message="screen.ae1862861afa" /></td>)}</tr><tr><th scope="row"><InterfaceText message="screen.dd9e1a351a01" /></th><td><InterfaceText message="screen.48262d7ce9f9" /></td><td><InterfaceText message="screen.48262d7ce9f9" /></td><td><InterfaceText message="screen.48262d7ce9f9" /></td></tr><tr><th scope="row">{advisor.comparison}</th>{Object.values(plans).map(p=><td key={p.name}>{p.advisorsPerProject || "—"}</td>)}</tr></tbody></table></div><p>{advisor.freeShort}</p></section><div className="mt-8 grid gap-4 md:grid-cols-2">
    <section className="rounded-2xl border border-line bg-white p-6 md:p-8">
      <h2 className="font-display text-2xl text-ink">{requestLocale === "es" ? "Cuota de IA y recargas" : "Franquia de IA e recargas"}</h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{requestLocale === "es" ? "La cuota anual se comparte entre las herramientas de IA. Si necesitas más, puedes comprar una recarga." : "A franquia anual é compartilhada entre as ferramentas de IA. Se precisar de mais tokens, você pode comprar uma recarga."}</p>
      <p className="mt-5 border-t border-line pt-4"><strong className="font-display text-2xl text-ink">{money(policy.rechargeCents)}</strong><span className="ml-2 text-sm text-ink-soft">{requestLocale === "es" ? "por millón de tokens" : "por milhão de tokens"}</span></p>
    </section>
    <section className="rounded-2xl bg-ink p-6 text-white md:p-8">
      <h2 className="font-display text-2xl text-white">{requestLocale === "es" ? "Residencias y planes institucionales" : "Residências e planos institucionais"}</h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/80">{requestLocale === "es" ? "Para residencias médicas y multiprofesionales e instituciones que acompañan proyectos de investigación. Configura plazas, organiza cohortes y acompaña el progreso." : "Para residências médicas e multiprofissionais e instituições que acompanham projetos de pesquisa. Configure vagas, organize turmas e acompanhe o progresso."}</p>
      <Link href="/para-residencias" className="public-button public-button-light mt-5">{requestLocale === "es" ? "Conocer los planes institucionales" : "Conhecer os planos institucionais"}</Link>
    </section>
  </div><p className="text-xs text-ink-soft mt-6"><InterfaceText message="screen.8b4a1c9a419d" /> <Link href="/cancelamento" className="underline"><InterfaceText message="screen.770beb0d8461" /></Link> · <Link href="/termos" className="underline"><InterfaceText message="screen.a6f04fc4cc1e" /></Link></p></div>;}

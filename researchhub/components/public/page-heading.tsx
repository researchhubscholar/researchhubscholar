import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
export default function PageHeading({ eyebrow, title, description, children, visual }: { eyebrow: string; title: string; description: string; children?: React.ReactNode; visual?: React.ReactNode }) {
  return <header className={`public-heading ${visual?"public-heading-with-visual":""}`}><div><p className="public-eyebrow"><AuthoredText text={eyebrow} /></p><h1><AuthoredText text={title} /></h1><p className="public-description"><AuthoredText text={description} /></p>{children}</div>{visual?<div className="public-heading-visual">{visual}</div>:null}</header>;
}
export async function PublicCTA({ title, description }: { title?: string; description?: string }) {
 const es = (await getRequestLocale()) === "es";
 title ??= es ? "Elige un plan para tu investigación." : "Escolha um plano para sua pesquisa.";
 description ??= es ? "Compara las cuotas de IA y las funciones de los planes de ResearchHub." : "Compare as franquias de IA e os recursos dos planos do ResearchHub.";
 return <section className="public-cta"><div><p className="public-eyebrow"><InterfaceText message="screen.6820b3abc103" /></p><h2><AuthoredText text={title} /></h2><p><AuthoredText text={description} /></p></div><Link href="/planos" className="public-button public-button-light"><InterfaceText message="nav.plans" /> <span aria-hidden="true">↗</span></Link></section>;
}

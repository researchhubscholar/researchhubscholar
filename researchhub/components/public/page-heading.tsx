import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import Link from "next/link";
export default function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <header className="public-heading"><div><p className="public-eyebrow"><AuthoredText text={eyebrow} /></p><h1><AuthoredText text={title} /></h1><p className="public-description"><AuthoredText text={description} /></p>{children}</div><div className="public-heading-mark" aria-hidden="true"><span>ResearchHub</span><strong><InterfaceText message="screen.b461966c2ff4" /><br /><InterfaceText message="screen.0ca1b9c85afd" /></strong><div className="public-thread"><i /><i /><i /><i /></div><span>Explorar · Investigar · Construir</span></div></header>;
}
export function PublicCTA({title="Seu próximo passo pode começar com uma busca.",description="Experimente o Radar com um tema da sua área, sem cadastro e sem IA."}:{title?:string;description?:string}) {
 return <section className="public-cta"><div><p className="public-eyebrow"><InterfaceText message="screen.6820b3abc103" /></p><h2><AuthoredText text={title} /></h2><p><AuthoredText text={description} /></p></div><Link href="/radar-demo" className="public-button public-button-light"><InterfaceText message="screen.3d764ea18b22" /> <span aria-hidden="true">↗</span></Link></section>;
}

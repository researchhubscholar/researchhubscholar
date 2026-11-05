import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import Link from "next/link";
export default function PageHeading({ eyebrow, title, description, children, visual }: { eyebrow: string; title: string; description: string; children?: React.ReactNode; visual?: React.ReactNode }) {
  return <header className={`public-heading ${visual?"public-heading-with-visual":""}`}><div><p className="public-eyebrow"><AuthoredText text={eyebrow} /></p><h1><AuthoredText text={title} /></h1><p className="public-description"><AuthoredText text={description} /></p>{children}</div>{visual?<div className="public-heading-visual">{visual}</div>:null}</header>;
}
export function PublicCTA({title="Seu próximo passo pode começar com uma busca.",description="Experimente o Radar com um tema da sua área, sem cadastro e sem IA."}:{title?:string;description?:string}) {
 return <section className="public-cta"><div><p className="public-eyebrow"><InterfaceText message="screen.6820b3abc103" /></p><h2><AuthoredText text={title} /></h2><p><AuthoredText text={description} /></p></div><Link href="/radar-demo" className="public-button public-button-light"><InterfaceText message="screen.3d764ea18b22" /> <span aria-hidden="true">↗</span></Link></section>;
}

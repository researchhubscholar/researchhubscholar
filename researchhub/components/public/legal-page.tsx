import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import Link from "next/link";
import PageHeading from "./page-heading";
export default async function LegalPage({title,intro,sections}:{title:string;intro:string;sections:{title:string;text:string}[]}) {
  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
 return <div className="marketing-page"><PageHeading eyebrow={uiText("screen.54b80d965c1b")} title={title} description={intro} /><div className="legal-layout"><aside className="legal-index"><p className="public-eyebrow"><InterfaceText message="screen.55535e7c82a1" /></p><nav aria-label={uiText("screen.cd60f97aa29a")}>{sections.map((s,i)=><a key={s.title} href={`#secao-${i+1}`}><span>{String(i+1).padStart(2,"0")}</span><AuthoredText text={s.title} /></a>)}</nav><div className="legal-related"><Link href="/termos"><InterfaceText message="screen.a6f04fc4cc1e" /></Link><Link href="/privacidade"><InterfaceText message="screen.2bb2d8436a5c" /></Link><Link href="/cancelamento"><InterfaceText message="screen.770beb0d8461" /></Link></div></aside><div className="legal-content">{sections.map((s,i)=><section key={s.title} id={`secao-${i+1}`}><p className="public-eyebrow">{String(i+1).padStart(2,"0")}</p><h2><AuthoredText text={s.title} /></h2><p><AuthoredText text={s.text} /></p></section>)}<div className="legal-help"><h2><InterfaceText message="screen.5c88abe88d0b" /></h2><p><InterfaceText message="screen.5cc4d0f4ed31" /></p><Link href="/contato" className="public-button"><InterfaceText message="screen.fced486294c7" /></Link></div></div></div></div>;
}

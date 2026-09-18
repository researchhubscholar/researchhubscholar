import Link from "next/link";
export default function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <header className="public-heading"><div><p className="public-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="public-description">{description}</p>{children}</div><div className="public-heading-mark" aria-hidden="true"><span>ResearchHub</span><strong>Uma pergunta.<br />Um caminho.</strong><div className="public-thread"><i /><i /><i /><i /></div><span>Explorar · Investigar · Construir</span></div></header>;
}
export function PublicCTA({title="Seu próximo passo pode começar com uma busca.",description="Experimente o Radar com um tema da sua área, sem cadastro e sem IA."}:{title?:string;description?:string}) {
 return <section className="public-cta"><div><p className="public-eyebrow">Da curiosidade à pesquisa</p><h2>{title}</h2><p>{description}</p></div><Link href="/radar-demo" className="public-button public-button-light">Experimentar o Radar <span aria-hidden="true">↗</span></Link></section>;
}

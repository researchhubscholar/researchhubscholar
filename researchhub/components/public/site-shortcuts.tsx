"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const publicPages = new Set([
  "/", "/como-funciona", "/para-residencias", "/contato",
  "/termos", "/privacidade", "/cancelamento", "/radar-demo",
]);

export default function SiteShortcuts() {
  const pathname = usePathname();
  return <>
    {pathname !== "/" && <div className="site-return">
      <Link href="/" className="site-return-link"><span aria-hidden="true">←</span> Voltar ao início</Link>
    </div>}
    {publicPages.has(pathname) && <Link href="/planos" className="floating-plans">
      Ver planos <span aria-hidden="true">↗</span>
    </Link>}
  </>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { returnNavigation } from "@/lib/navigation/return-link";

const publicPages = new Set([
  "/", "/como-funciona", "/para-residencias", "/contato",
  "/termos", "/privacidade", "/cancelamento", "/radar-demo",
]);

export default function SiteShortcuts() {
  const pathname = usePathname();
  const back = returnNavigation(pathname);
  return <>
    {back && <div className="site-return">
      <Link href={back.href} className="site-return-link"><span aria-hidden="true">←</span> {back.label}</Link>
    </div>}
    {publicPages.has(pathname) && <Link href="/planos" className="floating-plans">
      Ver planos <span aria-hidden="true">↗</span>
    </Link>}
  </>;
}

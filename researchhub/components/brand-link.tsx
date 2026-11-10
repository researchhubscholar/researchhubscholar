"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/language-provider";
import { returnNavigation } from "@/lib/navigation/return-link";

export default function BrandLink() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const workspace = pathname === "/dashboard" || returnNavigation(pathname)?.href === "/dashboard";
  return <Link href={workspace ? "/dashboard" : "/"} className="brand-lockup" aria-label={t(workspace ? "nav.workspace" : "nav.homeLabel")}>
    <span className="brand-symbol" aria-hidden="true">R</span>
    <span><span className="brand-name">Research<span className="brand-product">Hub</span></span></span>
  </Link>;
}

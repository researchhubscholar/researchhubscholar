"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import LanguageSelector from "@/components/i18n/language-selector";
import type { MessageKey } from "@/lib/i18n/catalog";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SessionState = { authenticated: boolean; displayName: string | null; isAdmin: boolean };

const publicLinks = [
  ["/radar-demo", "Testar Radar"],
  ["/como-funciona", "Como funciona"],
  ["/para-residencias", "Residências"],
  ["/planos", "Planos"],
] as const;

const privateLinks = [
  ["/dashboard", "Meu espaço"],
  ["/ideias", "Ideias"],
  ["/descobrir", "Radar"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
  ["/conta", "Conta"],
] as const;

const adminLinks = [["/operacao", "Operação"]] as const;
const navigationMessages: Record<string, MessageKey> = {
  "/dashboard":"nav.workspace", "/ideias":"nav.ideas", "/descobrir":"nav.radar",
  "/biblioteca":"nav.library", "/meu-trabalho":"nav.project", "/orientacao":"nav.advising",
  "/conta":"nav.account", "/operacao":"nav.operations", "/radar-demo":"nav.testRadar",
  "/como-funciona":"nav.how", "/para-residencias":"nav.residencies", "/planos":"nav.plans",
};

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export default function SessionNavigation() {
  const pathname = usePathname();
  const { t: uiText } = useLanguage();
  const [session, setSession] = useState<SessionState>({ authenticated: false, displayName: null, isAdmin: false });

  useEffect(() => {
    const db = supabaseBrowser();
    let active = true;
    async function load() {
      const { data: { user } } = await db.auth.getUser();
      if (!active || !user) {
        if (active) setSession({ authenticated: false, displayName: null, isAdmin: false });
        return;
      }
      const [profileResult, adminResult] = await Promise.all([
        db.from("profiles").select("name").eq("id", user.id).maybeSingle(),
        db.from("scholar_platform_admins").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (active) setSession({
        authenticated: true,
        displayName: profileResult.data?.name || user.user_metadata?.name || user.email?.split("@")[0] || null,
        isAdmin: Boolean(adminResult.data),
      });
    }
    void load();
    const { data: listener } = db.auth.onAuthStateChange(() => { void load(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const isLandingPage = pathname === "/";
  const isWorkspace = ["/dashboard", "/ideias", "/descobrir", "/biblioteca", "/meu-trabalho", "/manuscrito", "/orientacao", "/conta", "/operacao", "/resultados", "/documentos", "/residencia", "/scholar/onboarding", "/geracoes", "/licenca"].some(href => isCurrent(pathname, href));
  const links = session.authenticated && isWorkspace ? [...privateLinks, ...(session.isAdmin ? adminLinks : [])] : session.authenticated && isLandingPage ? [] : [...publicLinks];
  const renderLink = ([href, label]: (typeof links)[number], mobile = false) => (
    <Link
      key={href}
      href={href}
      aria-current={isCurrent(pathname, href) ? "page" : undefined}
      className={`primary-nav-link ${mobile ? "" : "desktop-only-link"}`}
    >{uiText(navigationMessages[href]) || label}</Link>
  );

  return <>
    <nav aria-label={uiText("nav.mainLabel")} className="primary-nav" data-workspace={isWorkspace ? "true" : undefined}>
      <LanguageSelector />
      {links.map(link => renderLink(link))}
      {session.authenticated ? <>
        {!isWorkspace ? <Link href="/dashboard" className="primary-nav-link nav-signup">{uiText("nav.workspace")}</Link> : session.displayName && <Link href="/conta" className="primary-nav-link account-link hidden xl:block" aria-label={uiText("nav.openAccount")}>{session.displayName.split(" ")[0]}</Link>}
        <span className="nav-signout"><LogoutButton /></span>
      </> : <>
        <Link href="/login" aria-current={pathname === "/login" ? "page" : undefined} className="primary-nav-link">{uiText("nav.login")}</Link>
        <Link href="/cadastro" aria-current={pathname === "/cadastro" ? "page" : undefined} className="primary-nav-link nav-signup">{uiText("nav.signup")}</Link>
      </>}
    </nav>
    {links.length > 0 && <nav aria-label={uiText("nav.toolsLabel")} className="mobile-nav">
      {links.map(link => renderLink(link, true))}
    </nav>}
  </>;
}

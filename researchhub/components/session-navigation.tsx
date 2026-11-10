"use client";

import { isAdvisorOnly } from "@/lib/access/advisor-mode";
import ReviewBell from "@/components/manuscript/review-bell";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import LanguageSelector from "@/components/i18n/language-selector";
import type { MessageKey } from "@/lib/i18n/catalog";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SessionState = { authenticated: boolean; displayName: string | null; isAdmin: boolean; advisorOnly?: boolean; userId?: string };

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

const workspaceIcons: Record<string, string> = {
  "/dashboard": "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  "/ideias": "M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2Z",
  "/descobrir": "M12 12l7-7M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5",
  "/biblioteca": "M4 4h5v16H4zm5 0h5v16H9zm5 1 4-1 4 15-4 1z",
  "/meu-trabalho": "M3 7h7l2 2h9v11H3z",
  "/orientacao": "M4 4h16v12H9l-5 4zM8 8h8m-8 4h5",
  "/conta": "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2",
  "/operacao": "M4 20V4m0 16h16m-12-4v-4m5 4V8m5 8v-6",
};
const sidebarPreference = "researchhub.sidebar-compact";

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export default function SessionNavigation() {
  const pathname = usePathname();
  const { t: uiText, locale } = useLanguage();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    try { setCompact(localStorage.getItem(sidebarPreference) === "true"); } catch { /* Preference is optional. */ }
  }, []);

  const toggleSidebar = () => {
    const next = !compact;
    setCompact(next);
    try { localStorage.setItem(sidebarPreference, String(next)); } catch { /* Keep the current layout in memory. */ }
  };
  const sidebarLabel = compact
    ? (locale === "es" ? "Expandir menú lateral" : "Expandir menu lateral")
    : (locale === "es" ? "Contraer menú lateral" : "Recolher menu lateral");

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
      const [profileResult, adminResult, advisorOnly] = await Promise.all([
        db.from("profiles").select("name").eq("id", user.id).maybeSingle(),
        db.from("scholar_platform_admins").select("role").eq("user_id", user.id).maybeSingle(),
        isAdvisorOnly(db, user.id),
      ]);
      if (active) setSession({
        authenticated: true,
        userId: user.id,
        displayName: profileResult.data?.name || user.user_metadata?.name || user.email?.split("@")[0] || null,
        isAdmin: Boolean(adminResult.data),
        advisorOnly,
      });
    }
    void load();
    const { data: listener } = db.auth.onAuthStateChange(() => { void load(); });
    const refreshRole = () => { void load(); };
    window.addEventListener("scholar-advisor-access", refreshRole);
    return () => { active = false; listener.subscription.unsubscribe(); window.removeEventListener("scholar-advisor-access", refreshRole); };
  }, []);

  const isLandingPage = pathname === "/";
  const isWorkspace = ["/dashboard", "/ideias", "/descobrir", "/biblioteca", "/meu-trabalho", "/manuscrito", "/orientacao", "/conta", "/operacao", "/resultados", "/documentos", "/residencia", "/scholar/onboarding", "/geracoes", "/licenca"].some(href => isCurrent(pathname, href));
  const links = session.authenticated && isWorkspace ? [...privateLinks.filter(([href]) => !session.advisorOnly || href === "/orientacao" || href === "/conta"), ...(session.isAdmin ? adminLinks : [])] : session.authenticated && isLandingPage ? [] : [...publicLinks];
  const renderLink = ([href, label]: (typeof links)[number], mobile = false) => {
    const name = session.advisorOnly && href === "/orientacao"
      ? (locale === "es" ? "Proyectos compartidos" : "Projetos compartilhados")
      : uiText(navigationMessages[href]) || label;
    const icon = compact && !mobile && isWorkspace && workspaceIcons[href];
    return (
      <Link
        key={href}
        href={href}
        title={icon ? name : undefined}
        aria-current={isCurrent(pathname, href) ? "page" : undefined}
        className={`primary-nav-link ${href === "/dashboard" ? "workspace-home-link" : ""} ${mobile ? "" : "desktop-only-link"}`}
      >
        {icon ? <><svg className="workspace-rail-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg><span className="workspace-rail-label">{name}</span></> : name}
      </Link>
    );
  };

  return <>
    <nav aria-label={uiText("nav.mainLabel")} className="primary-nav" data-workspace={isWorkspace ? "true" : undefined} data-sidebar-compact={isWorkspace && session.authenticated && compact ? "true" : undefined} data-advisor-only={session.advisorOnly && isWorkspace ? "true" : undefined}>
      {isWorkspace && session.authenticated && (
        <button type="button" className="workspace-sidebar-toggle" aria-label={sidebarLabel} title={sidebarLabel} aria-expanded={!compact} onClick={toggleSidebar}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14" /><path d={compact ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
          </svg>
        </button>
      )}
      <LanguageSelector />
      {links.map(link => renderLink(link))}
      {session.authenticated ? <>
        {!isWorkspace ? <Link href={session.advisorOnly ? "/orientacao" : "/dashboard"} className="primary-nav-link nav-signup">{session.advisorOnly ? uiText("nav.advising") : uiText("nav.workspace")}</Link> : !session.advisorOnly && session.displayName && <Link href="/conta" className="primary-nav-link account-link hidden xl:block" aria-label={uiText("nav.openAccount")}>{session.displayName.split(" ")[0]}</Link>}
        {isWorkspace && !session.advisorOnly && session.userId && <ReviewBell key={session.userId} userId={session.userId} />}
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

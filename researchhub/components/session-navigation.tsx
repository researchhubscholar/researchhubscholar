"use client";

import Link from "next/link";
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
  ["/descobrir", "Radar"],
  ["/ideias", "Ideias"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
  ["/conta", "Conta"],
] as const;

const adminLinks = [["/operacao", "Operação"]] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export default function SessionNavigation() {
  const pathname = usePathname();
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

  const links = session.authenticated ? [...privateLinks, ...(session.isAdmin ? adminLinks : [])] : [...publicLinks];
  const renderLink = ([href, label]: (typeof links)[number], mobile = false) => (
    <Link
      key={href}
      href={href}
      aria-current={isCurrent(pathname, href) ? "page" : undefined}
      className={`primary-nav-link ${mobile ? "" : "desktop-only-link"}`}
    >{label}</Link>
  );

  return <>
    <nav aria-label="Navegação principal" className="primary-nav">
      {links.map(link => renderLink(link))}
      {session.authenticated ? <>
        {session.displayName && <Link href="/conta" className="primary-nav-link account-link hidden xl:block" aria-label="Abrir minha conta">{session.displayName.split(" ")[0]}</Link>}
        <span className="nav-signout"><LogoutButton /></span>
      </> : <>
        <Link href="/login" aria-current={pathname === "/login" ? "page" : undefined} className="primary-nav-link">Entrar</Link>
        <Link href="/cadastro" aria-current={pathname === "/cadastro" ? "page" : undefined} className="primary-nav-link nav-signup">Criar conta</Link>
      </>}
    </nav>
    <nav aria-label="Navegação das ferramentas" className="mobile-nav">
      {links.map(link => renderLink(link, true))}
    </nav>
  </>;
}

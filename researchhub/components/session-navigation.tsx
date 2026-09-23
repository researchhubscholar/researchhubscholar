"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SessionState = { authenticated: boolean; displayName: string | null };

const publicLinks = [
  ["/como-funciona", "Como funciona"],
  ["/para-residencias", "Residências"],
  ["/planos", "Planos"],
  ["/radar-demo", "Testar Radar"],
] as const;

const privateLinks = [
  ["/dashboard", "Meu espaço"],
  ["/ideias", "Ideias"],
  ["/descobrir", "Radar"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
] as const;

export default function SessionNavigation() {
  const [session, setSession] = useState<SessionState>({ authenticated: false, displayName: null });

  useEffect(() => {
    const db = supabaseBrowser();
    let active = true;

    async function load() {
      const { data: { user } } = await db.auth.getUser();
      if (!active || !user) {
        if (active) setSession({ authenticated: false, displayName: null });
        return;
      }
      const { data: profile } = await db.from("profiles").select("name").eq("id", user.id).maybeSingle();
      if (active) {
        setSession({
          authenticated: true,
          displayName: profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || null,
        });
      }
    }

    void load();
    const { data: listener } = db.auth.onAuthStateChange(() => { void load(); });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const links = session.authenticated ? privateLinks : publicLinks;

  return <>
    <nav aria-label="Navegação principal" className="flex items-center justify-self-end gap-3 text-sm text-ink-soft md:gap-5">
      {links.slice(0, 3).map(([href, label], index) => <Link key={href} href={href} className={`hover:text-teal ${index === 0 ? "hidden sm:block" : "hidden lg:block"}`}>{label}</Link>)}
      {session.authenticated ? <>
        {session.displayName && <span className="text-ink-soft/70 hidden xl:inline">{session.displayName}</span>}
        <LogoutButton />
      </> : <>
        <Link href="/login" className="hover:text-teal">Entrar</Link>
        <Link href="/cadastro" className="text-white bg-teal px-3 py-1.5 rounded-card hover:bg-teal/90 transition-colors">Criar conta</Link>
      </>}
    </nav>
    <nav aria-label="Mais opções" className="col-span-2 flex gap-5 overflow-x-auto border-t border-line pt-3 text-sm text-ink-soft lg:hidden">
      {links.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap">{label}</Link>)}
    </nav>
  </>;
}

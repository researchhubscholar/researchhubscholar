import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { supabaseServer } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "ResearchHub Scholar — Pesquisa científica guiada",
  description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || null;
  }

  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <header className="border-b border-line bg-paper/95 sticky top-0 z-30 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="font-display text-xl tracking-tight text-ink whitespace-nowrap">
              Research<span className="text-teal">Hub</span>{" "}
              <span className="text-xs font-sans uppercase tracking-wider text-ink-soft">Scholar</span>
            </Link>
            <nav aria-label="Navegação principal" className="text-sm text-ink-soft flex items-center gap-4 md:gap-6">
              {user && <Link href="/dashboard" className="hover:text-teal hidden sm:block">Meu espaço</Link>}
              <Link href={user ? "/descobrir" : "/radar-demo"} className="hover:text-teal hidden sm:block">{user ? "Radar" : "Testar Radar"}</Link>
              {user ? <Link href="/ideias" className="hover:text-teal hidden sm:block">Ideias</Link> : <><Link href="/como-funciona" className="hover:text-teal hidden lg:block">Como funciona</Link><Link href="/para-residencias" className="hover:text-teal hidden lg:block">Residências</Link><Link href="/planos" className="hover:text-teal hidden md:block">Planos</Link></>}
              {user && <Link href="/biblioteca" className="hover:text-teal hidden md:block">Biblioteca</Link>}
              {user && <Link href="/meu-trabalho" className="hover:text-teal hidden md:block">Meu projeto</Link>}
              {user ? (
                <>
                  {displayName && <span className="text-ink-soft/70 hidden xl:inline">{displayName}</span>}
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-teal">Entrar</Link>
                  <Link href="/cadastro" className="text-white bg-teal px-3 py-1.5 rounded-card hover:bg-teal/90 transition-colors">Criar conta</Link>
                </>
              )}
            </nav>
          </div>
          <nav aria-label="Mais opções" className="lg:hidden flex gap-5 overflow-x-auto px-6 pb-3 text-sm text-ink-soft">
            {(user ? [["/dashboard","Meu espaço"],["/ideias","Ideias"],["/descobrir","Radar"],["/biblioteca","Biblioteca"],["/meu-trabalho","Meu projeto"]] : [["/como-funciona","Como funciona"],["/para-residencias","Residências"],["/planos","Planos"],["/radar-demo","Testar Radar"]]).map(([href,label])=><Link key={href} href={href} className="whitespace-nowrap">{label}</Link>)}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8 md:py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-ink-soft/70 border-t border-line mt-16 flex flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-4"><Link href="/como-funciona">Como funciona</Link><Link href="/para-residencias">Para residências</Link><Link href="/planos">Planos</Link><Link href="/contato">Contato</Link><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/cancelamento">Cancelamento</Link></div>
          <span>ResearchHub Scholar — transforme curiosidade em pesquisa estruturada.</span>
          <span>Ferramenta de apoio acadêmico; não substitui orientação científica ou avaliação ética.</span>
        </footer>
      </body>
    </html>
  );
}

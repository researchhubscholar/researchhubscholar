import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import SiteShortcuts from "@/components/public/site-shortcuts";
import SessionNavigation from "@/components/session-navigation";
import ProductTelemetry from "@/components/product-telemetry";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://researchhubscholar.vercel.app"),
  title: "ResearchHub Scholar — Pesquisa científica guiada",
  description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
  applicationName: "ResearchHub Scholar",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "ResearchHub Scholar — Pesquisa científica guiada",
    description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
    url: "/",
    siteName: "ResearchHub Scholar",
  },
  twitter: {
    card: "summary",
    title: "ResearchHub Scholar — Pesquisa científica guiada",
    description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <ProductTelemetry />
        <header className="border-b border-line bg-paper/95 sticky top-0 z-30 backdrop-blur">
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="font-display text-lg sm:text-xl tracking-tight text-ink whitespace-nowrap">
              Research<span className="text-teal">Hub</span>{" "}
              <span className="hidden sm:inline text-xs font-sans uppercase tracking-wider text-ink-soft">Scholar</span>
            </Link>
            <SessionNavigation />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-10"><SiteShortcuts />{children}</main>
        <footer className="bg-ink text-white mt-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid md:grid-cols-[1.3fr_1fr_1fr] gap-8">
            <div><Link href="/" className="font-display text-2xl">ResearchHub <span className="text-teal-soft">Scholar</span></Link><p className="text-sm leading-relaxed text-white/60 mt-4 max-w-sm">Transforme curiosidade em pesquisa estruturada, com literatura real e um percurso para desenvolver seu trabalho.</p><p className="text-xs text-white/50 mt-4">Versão em testes · IA e pagamentos ainda não ativados.</p></div>
            <nav aria-label="Conheça o Scholar" className="flex flex-col gap-3 text-sm text-white/70"><p className="text-xs uppercase tracking-widest text-white mb-1">Conheça</p><Link href="/como-funciona">Como funciona</Link><Link href="/para-residencias">Para residências</Link><Link href="/planos">Planos e franquias</Link><Link href="/radar-demo">Experimentar o Radar</Link></nav>
            <nav aria-label="Ajuda e informações" className="flex flex-col gap-3 text-sm text-white/70"><p className="text-xs uppercase tracking-widest text-white mb-1">Ajuda e transparência</p><Link href="/contato">Contato</Link><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/cancelamento">Cancelamento</Link></nav>
          </div><div className="border-t border-white/10 mx-auto max-w-6xl px-4 sm:px-6 py-6 text-xs text-white/50">Ferramenta de apoio acadêmico; não substitui orientação científica ou avaliação ética.</div>
        </footer>
      </body>
    </html>
  );
}

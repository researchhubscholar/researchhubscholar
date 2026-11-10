import BrandLink from "@/components/brand-link";
import type { MessageKey } from "@/lib/i18n/catalog";
import InterfaceText from "@/components/i18n/interface-text";
import LanguageProvider from "@/components/i18n/language-provider";
import { translate } from "@/lib/i18n/locale";
import { getRequestLocale } from "@/lib/i18n/server";
import NavigationProtection from "@/components/projects/navigation-protection";
import { Suspense } from "react";
import GlobalGuide from "@/components/ai/global-guide";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./workspace.css";
import "./concept-workspace.css";
import "./public-concepts.css";
import SiteShortcuts from "@/components/public/site-shortcuts";
import SessionNavigation from "@/components/session-navigation";
import ProductTelemetry from "@/components/product-telemetry";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://researchhubscholar.vercel.app"),
  title: "ResearchHub — Pesquisa científica guiada",
  description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
  applicationName: "ResearchHub",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "ResearchHub — Pesquisa científica guiada",
    description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
    url: "/",
    siteName: "ResearchHub",
  },
  twitter: {
    card: "summary",
    title: "ResearchHub — Pesquisa científica guiada",
    description: "Da ideia ao trabalho científico para estudantes de medicina e residentes.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <LanguageProvider initialLocale={locale}>
        <NavigationProtection />
        <ProductTelemetry />
        <Suspense fallback={null}><GlobalGuide /></Suspense>
        <header className="app-header">
          <div className="app-header-inner">
            <BrandLink />
            <SessionNavigation />
          </div>
        </header>
        <main className="app-content"><SiteShortcuts />{children}</main>
        <footer className="app-footer">
          <div className="app-footer-inner grid md:grid-cols-[1.3fr_1fr_1fr] gap-8">
            <div><Link href="/" className="font-display text-2xl">ResearchHub</Link><p className="text-sm leading-relaxed text-white/60 mt-4 max-w-sm"><InterfaceText message="footer.intro" /></p><p className="text-xs text-white/50 mt-4"><InterfaceText message="footer.testing" /></p></div>
            <nav aria-label={uiText("screen.da53c8aaf6fe")} className="flex flex-col gap-3 text-sm text-white/70"><p className="text-xs uppercase tracking-widest text-white mb-1"><InterfaceText message="footer.about" /></p><Link href="/como-funciona"><InterfaceText message="nav.how" /></Link><Link href="/para-residencias"><InterfaceText message="footer.residencies" /></Link><Link href="/planos"><InterfaceText message="footer.plans" /></Link><Link href="/radar-demo"><InterfaceText message="footer.tryRadar" /></Link></nav>
            <nav aria-label={uiText("screen.86202fa087ac")} className="flex flex-col gap-3 text-sm text-white/70"><p className="text-xs uppercase tracking-widest text-white mb-1"><InterfaceText message="footer.help" /></p><Link href="/contato"><InterfaceText message="footer.contact" /></Link><Link href="/termos"><InterfaceText message="footer.terms" /></Link><Link href="/privacidade"><InterfaceText message="footer.privacy" /></Link><Link href="/cancelamento"><InterfaceText message="footer.cancel" /></Link></nav>
          </div>
          <div className="border-t border-white/10"><div className="mx-auto max-w-[78rem] px-4 sm:px-6 py-6 text-xs text-white/50"><InterfaceText message="footer.disclaimer" /></div></div>
        </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}

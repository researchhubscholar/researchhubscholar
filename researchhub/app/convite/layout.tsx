import BrandMark from "@/components/brand-mark";

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <div lang="pt-BR" className="campaign-layout min-h-svh">
    <header className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-9">
      <div className="brand-lockup"><BrandMark /></div>
    </header>
    <main>{children}</main>
  </div>;
}

import { getRequestLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { campaignIdPattern, pesquisa100 } from "@/lib/campaigns/input";
import { campaignOffer } from "@/lib/campaigns/server";
import CampaignForm from "./campaign-form";

type Props = { params: Promise<{ campanha: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Convite ResearchHub",
  description: "Conheça a campanha do ResearchHub para planos anuais.",
  robots: { index: false, follow: false },
};

export default async function CampaignPage({ params }: Props) {
  const { campanha } = await params;
  if (campanha.length > 64 || !campaignIdPattern.test(campanha)) notFound();
  const offer = await campaignOffer(campanha);
  if (!offer && campanha !== "pesquisa100") notFound();
  const es = (await getRequestLocale()) === "es";
  const copy = offer ?? pesquisa100;

  return (
    <div className="mx-auto grid w-full max-w-6xl items-start gap-7 px-5 pb-10 pt-6 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16">
      <section className="min-w-0 lg:pt-8" aria-labelledby="campaign-title">
        <h1 id="campaign-title" className="max-w-xl font-display text-[clamp(1.95rem,7vw,3.75rem)] leading-[1.1]">
          {es && campanha === "pesquisa100" ? "Tu investigación comienza con una oportunidad especial." : copy.title}
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed sm:text-lg">{es && campanha === "pesquisa100" ? `Regístrate y recibe un descuento de R$ ${copy.discountCents / 100} para empezar tu trabajo científico con ResearchHub.` : copy.subtitle}</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft sm:text-base">
          {es ? "De la idea inicial al manuscrito, una plataforma para organizar y simplificar tu investigación." : "Da ideia inicial ao manuscrito, uma plataforma para organizar e simplificar sua jornada de pesquisa."}
        </p>
      </section>
      <CampaignForm campaign={campanha} available={offer?.available === true} discountCents={copy.discountCents} />
    </div>
  );
}

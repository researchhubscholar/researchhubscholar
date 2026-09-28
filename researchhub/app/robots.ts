import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://researchhubscholar.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/como-funciona", "/para-residencias", "/planos", "/radar-demo", "/contato", "/termos", "/privacidade", "/cancelamento"],
      disallow: ["/dashboard", "/descobrir", "/ideias", "/biblioteca", "/meu-trabalho", "/documentos", "/orientacao", "/licenca", "/residencia", "/scholar"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

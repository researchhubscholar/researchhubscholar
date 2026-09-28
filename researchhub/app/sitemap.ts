import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/como-funciona",
  "/para-residencias",
  "/planos",
  "/radar-demo",
  "/contato",
  "/termos",
  "/privacidade",
  "/cancelamento",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://researchhubscholar.vercel.app";
  return publicRoutes.map((route, index) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: index < 5 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : index < 5 ? 0.8 : 0.5,
  }));
}

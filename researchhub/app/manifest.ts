import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResearchHub Scholar",
    short_name: "Scholar",
    description: "Pesquisa científica guiada para estudantes de medicina e residentes.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#0F6E66",
    lang: "pt-BR",
  };
}

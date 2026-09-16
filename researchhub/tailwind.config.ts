import type { Config } from "tailwindcss";

// Direção de design: "caderno de laboratório" — papel, tinta, teal científico.
// Evita deliberadamente os defaults genéricos de IA (creme+terracota, preto+verde ácido).
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF7",
        ink: "#14213D",
        "ink-soft": "#3D4A6B",
        teal: "#0F6E66",
        "teal-soft": "#E4F1EF",
        amber: "#B45309",
        "amber-soft": "#FBEEE0",
        line: "#DEDACF",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "6px",
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

// Direção de design: "caderno de laboratório" — papel, tinta, teal científico.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F9F6",
        ink: "#14213D",
        "ink-soft": "#4C5873",
        teal: "#0F6E66",
        "teal-soft": "#E4F1EF",
        amber: "#B45309",
        "amber-soft": "#FBEEE0",
        line: "#DFE5E2",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: { card: "10px" },
      boxShadow: { soft: "0 18px 46px -36px rgba(20,33,61,.5)" },
    },
  },
  plugins: [],
} satisfies Config;

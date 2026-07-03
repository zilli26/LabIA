import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "var(--lab-bg)",
          "surface-1": "var(--lab-surface-1)",
          "surface-2": "var(--lab-surface-2)",
          border: "var(--lab-border)",
          "border-strong": "var(--lab-border-strong)",
          text: "var(--lab-text)",
          "text-dim": "var(--lab-text-dim)",
          "text-muted": "var(--lab-text-muted)",
          reagent: "var(--lab-reagent)",
          "reagent-dim": "var(--lab-reagent-dim)",
          success: "var(--lab-success)",
          warning: "var(--lab-warning)",
          danger: "var(--lab-danger)",
          info: "var(--lab-info)",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        lab: "12px",
        control: "8px",
      },
      boxShadow: {
        "lab-focus": "0 0 0 1px var(--lab-reagent), 0 0 24px var(--lab-reagent-dim)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

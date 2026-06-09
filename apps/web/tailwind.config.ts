import type { Config } from "tailwindcss";

// Design tokens from docs/01-MASTER-PLAN.md §22.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0E17",
        surface: "rgba(16,24,40,0.6)",
        neon: { cyan: "#00F0FF", magenta: "#FF2E97", volt: "#CCFF00", danger: "#FF3B3B" },
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        "neon-cyan": "0 0 20px rgba(0,240,255,0.35)",
        "neon-magenta": "0 0 20px rgba(255,46,151,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

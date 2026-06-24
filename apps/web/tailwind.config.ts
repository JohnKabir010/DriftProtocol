import type { Config } from "tailwindcss";

// Design tokens from docs/01-MASTER-PLAN.md §22.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0E17",
        surface: {
          DEFAULT: "rgba(14,21,38,0.72)",
          hi: "rgba(18,28,50,0.88)",
        },
        neon: {
          cyan: "#00F0FF",
          magenta: "#FF2E97",
          volt: "#CCFF00",
          danger: "#FF3B3B",
          amber: "#FF9500",
        },
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        "neon-cyan":
          "0 0 18px rgba(0,240,255,0.4), 0 0 50px rgba(0,240,255,0.12)",
        "neon-magenta":
          "0 0 18px rgba(255,46,151,0.4), 0 0 50px rgba(255,46,151,0.12)",
        "neon-volt":
          "0 0 18px rgba(204,255,0,0.4), 0 0 50px rgba(204,255,0,0.12)",
        "neon-danger": "0 0 18px rgba(255,59,59,0.4)",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.7", filter: "brightness(1.4)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        float: "float 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

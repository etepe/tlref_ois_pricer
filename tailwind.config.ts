import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Bloomberg-terminal style dark palette
        bg: {
          DEFAULT: "#0a0e17",
          panel: "#111827",
        },
        line: {
          DEFAULT: "#1e2736",
        },
        fg: {
          DEFAULT: "#c8ccd4",
          muted: "#6b7280",
          dimmed: "#374151",
        },
        accent: {
          DEFAULT: "#ff8c00",
        },
        value: {
          DEFAULT: "#f59e0b",
        },
        positive: {
          DEFAULT: "#10b981",
        },
        negative: {
          DEFAULT: "#ef4444",
        },
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          "Consolas",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;

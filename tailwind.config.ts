import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Bloomberg-terminal style dark palette (placeholder, refined later)
        bg: {
          DEFAULT: "#0b0d10",
          raised: "#11141a",
          sunken: "#070809",
        },
        accent: {
          amber: "#ffb000",
          green: "#00d26a",
          red: "#ff4d4f",
        },
        fg: {
          DEFAULT: "#e6e8ec",
          muted: "#8a93a3",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#08090c",
          card: "#0e1015",
          hover: "#14171e",
          border: "#1a1e28",
          "border-hover": "#262b38",
          input: "#0a0c10",
        },
        accent: {
          green: "#10b981",
          red: "#ef4444",
          blue: "#3b82f6",
          yellow: "#eab308",
        },
      },
      borderRadius: {
        "2xl": "16px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(59, 130, 246, 0.06)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;

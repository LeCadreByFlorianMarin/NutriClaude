import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:        "#0f1117",
        surface:   "#1a1d27",
        surface2:  "#232735",
        border:    "#2e3345",
        text:      "#e4e6ef",
        muted:     "#8b90a5",
        accent:    "#6c63ff",
        "accent-light": "#8b84ff",
        green:     "#34d399",
        orange:    "#f59e0b",
        red:       "#ef4444",
        blue:      "#3b82f6",
        cyan:      "#06b6d4",
        pink:      "#ec4899",
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#05101e", 900: "#0a1929", 800: "#0d2137", 700: "#122646", 600: "#183158" },
        graphite: { 900: "#111827", 800: "#1a2235", 700: "#1e2a3e", 600: "#243047", 500: "#2d3c52" },
        cyan: { 400: "#22d3ee", 300: "#67e8f9", 500: "#06b6d4" },
        electric: { 500: "#3b82f6", 400: "#60a5fa", 300: "#93c5fd" },
        amber: { 400: "#fbbf24", 500: "#f59e0b" },
        danger: { 400: "#f87171", 500: "#ef4444", 600: "#dc2626" },
        warning: { 400: "#fb923c", 500: "#f97316" },
      },
      fontFamily: { mono: ["JetBrains Mono", "Fira Code", "monospace"] },
    },
  },
  plugins: [],
};

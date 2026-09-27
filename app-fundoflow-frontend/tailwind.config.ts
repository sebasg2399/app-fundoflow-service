import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design system from Stitch (FundoFlow Theme)
        forest: {
          DEFAULT: "#0F4C3A",
          50: "#E6F0EC",
          100: "#C2D9CD",
          200: "#9DC3AE",
          300: "#78AC8F",
          400: "#529670",
          500: "#2E7F56",
          600: "#0F4C3A",
          700: "#0C3E30",
          800: "#082D23",
          900: "#041D17",
        },
        tan: "#D4A574",
        ember: "#F4A261",
        cream: "#FAFAF7",
        ink: "#191C1B",
        muted: "#6B7672",
        warn: "#F59E0B",
        ok: "#10B981",
        err: "#EF4444",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 76, 58, 0.04), 0 4px 12px rgba(15, 76, 58, 0.06)",
        floating: "0 8px 24px rgba(15, 76, 58, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;

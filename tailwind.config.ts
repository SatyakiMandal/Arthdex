import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          muted: "hsl(var(--surface-muted))",
          raised: "hsl(var(--surface-raised))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        /* Directional semantics — gains / losses / neutral baseline */
        up: "hsl(var(--up))",
        down: "hsl(var(--down))",
        flat: "hsl(var(--flat))",
        gold: "hsl(var(--gold))",
      },
      /* Compressed scale: legacy rounded-xl/2xl/3xl land on the same 8-10px panel radius */
      borderRadius: {
        "3xl": "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 2px)",
        xl: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /* Hairline elevation tinted to the ink, never a soft black blur */
      boxShadow: {
        sm: "0 1px 0 hsl(var(--foreground) / 0.04)",
        DEFAULT: "0 1px 2px hsl(var(--foreground) / 0.05)",
        md: "0 2px 6px -2px hsl(var(--foreground) / 0.08)",
        lg: "0 8px 24px -12px hsl(var(--foreground) / 0.16)",
        xl: "0 16px 40px -20px hsl(var(--foreground) / 0.22)",
        "2xl": "0 24px 56px -24px hsl(var(--foreground) / 0.28)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        brand: ["var(--font-brand)", "Georgia", "serif"],
        deva: ["var(--font-deva)", "Noto Sans Devanagari", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        /* 12px floor: the old 11px size failed legibility on phones */
        "2xs": ["0.75rem", { lineHeight: "1rem" }],
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        marquee: "marquee 60s linear infinite",
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

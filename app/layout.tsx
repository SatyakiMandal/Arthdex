import type { Metadata, Viewport } from "next";
import { Funnel_Display, Geist, Geist_Mono, Noto_Sans_Devanagari, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RefreshControl } from "@/components/layout/refresh-control";

// One family carries text, headings and figures; Geist Mono sets every number in tabular columns
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Display cut for page titles only: a grotesk with enough character to carry the brand
const display = Funnel_Display({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-funnel", display: "swap" });
const brand = Source_Serif_4({ subsets: ["latin"], weight: ["700"], variable: "--font-brand", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari", "latin"], weight: ["400", "600"], variable: "--font-noto-deva", display: "swap", preload: false });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Arthdex · Quantitative Market Intelligence", template: "%s" },
  description:
    "Indian market intelligence computed from source: NSE prices, company fundamentals, quant risk models, unlisted valuations and IPO analytics.",
  applicationName: "Arthdex",
  keywords: ["NSE", "Indian stock market", "stock screener", "IPO", "unlisted shares", "quant", "fundamentals", "Nifty"],
  openGraph: {
    type: "website",
    siteName: "Arthdex",
    locale: "en_IN",
    title: "Arthdex · Quantitative Market Intelligence",
    description: "Indian market analytics computed from source, covering listed, unlisted and IPO companies.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${display.variable} ${deva.variable} ${brand.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only z-[70] rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <RefreshControl />
      </body>
    </html>
  );
}

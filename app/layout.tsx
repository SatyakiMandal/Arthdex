import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RefreshControl } from "@/components/layout/refresh-control";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { StructuredData } from "@/components/seo/structured-data";

// Fonts are bundled (app/fonts, built from the Google Fonts sources, SIL OFL) rather than
// downloaded at build time: a transient fetch failure once broke a production build.
// Each file covers Latin and Latin Extended, which is where the rupee sign lives.

// One family carries text, headings and figures; Geist Mono sets every number in tabular columns
const sans = localFont({ src: "./fonts/geist.woff2", weight: "100 900", variable: "--font-geist", display: "swap" });
const mono = localFont({ src: "./fonts/geist-mono.woff2", weight: "100 900", variable: "--font-geist-mono", display: "swap" });
// Display cut for page titles only: a grotesk with enough character to carry the brand
const display = localFont({ src: "./fonts/funnel-display.woff2", weight: "500 700", variable: "--font-funnel", display: "swap" });
const brand = localFont({ src: "./fonts/source-serif-4-bold.woff2", weight: "700", variable: "--font-brand", display: "swap" });
const deva = localFont({ src: "./fonts/noto-sans-devanagari.woff2", weight: "400 600", variable: "--font-noto-deva", display: "swap", preload: false });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Arthdex · Quantitative Market Intelligence", template: "%s" },
  description:
    "Indian market intelligence computed from source: NSE prices, company fundamentals, quant risk models, unlisted valuations and IPO analytics.",
  applicationName: "Arthdex",
  keywords: ["NSE", "Indian stock market", "stock screener", "IPO", "unlisted shares", "quant", "fundamentals", "Nifty"],
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    siteName: "Arthdex",
    locale: "en_IN",
    title: "Arthdex · Quantitative Market Intelligence",
    description: "Indian market analytics computed from source, covering listed, unlisted and IPO companies.",
    url: SITE,
  },
  twitter: {
    card: "summary_large_image",
    title: "Arthdex · Quantitative Market Intelligence",
    description: "Indian market analytics computed from source, covering listed, unlisted and IPO companies.",
  },
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
      <head>
        <StructuredData />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-[70] rounded-none bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <RefreshControl />
        <CookieConsent />
      </body>
    </html>
  );
}

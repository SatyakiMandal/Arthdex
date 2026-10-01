import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RefreshControl } from "@/components/layout/refresh-control";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sora", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari", "latin"], weight: ["400", "600"], variable: "--font-noto-deva", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Arthdex · Quantitative Market Intelligence", template: "%s" },
  description:
    "Institutional-grade Indian market intelligence: listed fundamentals, quant risk models, unlisted valuation and IPO analytics.",
  openGraph: {
    type: "website",
    siteName: "Arthdex",
    title: "Arthdex · Quantitative Market Intelligence",
    description: "Indian market analytics computed from source, covering listed, unlisted and IPO companies.",
  },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${deva.variable}`}>
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

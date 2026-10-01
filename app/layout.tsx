import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RefreshControl } from "@/components/layout/refresh-control";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sora", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari", "latin"], weight: ["400", "600"], variable: "--font-noto-deva", display: "swap" });

export const metadata: Metadata = {
  title: "Arthdex · Quantitative Market Intelligence",
  description:
    "Institutional-grade Indian market intelligence: listed fundamentals, quant risk models, unlisted valuation and IPO analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${deva.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <RefreshControl />
      </body>
    </html>
  );
}

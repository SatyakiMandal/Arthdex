import type { Metadata } from "next";
import { ScanSearch } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MacdScreener } from "@/components/technicals/macd-screener";

export const metadata: Metadata = {
  title: "Technical Screener · Arthdex",
  description: "Find stocks whose MACD just crossed above or below its signal line, on 5-minute to daily bars.",
};

export default function ScreenerPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <Eyebrow icon={ScanSearch}>Technical screener</Eyebrow>
        <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">MACD crossovers</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Stocks whose MACD line has just crossed above or below its signal line. Choose the bar size and how many
          bars back to look, so the same screen works for a 5-minute scalp or a daily swing.
        </p>
        <div className="mt-8">
          <MacdScreener />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

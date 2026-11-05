import type { Metadata } from "next";
import { Filter } from "lucide-react";
import { SectionHead } from "@/components/ui/section-head";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MacdScreener } from "@/components/technicals/macd-screener";
import { FundamentalScreen } from "@/components/screener/fundamental-screen";
import { getFundamentalScreen } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Screener · Arthdex",
  description: "Screen the Nifty 500 on vetted fundamentals with live multiples, and find fresh MACD crossovers on any bar size.",
};

interface PageProps {
  searchParams: Promise<{ q?: string; preset?: string; sort?: string; order?: string }>;
}

export default async function ScreenerPage({ searchParams }: PageProps) {
  const { q = "", preset, sort = "mcap", order = "desc" } = await searchParams;
  const usePreset = preset ?? (q ? undefined : "quality");
  const screen = await getFundamentalScreen({ q, preset: usePreset, sort, order });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        {/* Bloomberg Top Command Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-lg sm:text-xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-accent" />
              <span>Multi-Factor Screener</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Vetted Fundamentals, Live Price Multiples & Technical Momentum Engine
            </span>
          </div>
          <div className="flex items-center gap-2 text-2xs font-mono text-muted-foreground">
            <span className="border border-border bg-surface px-2 py-0.5">Universe: NIFTY 500</span>
          </div>
        </div>

        <section id="fundamental" aria-labelledby="fundamental-head" className="mt-3.5 scroll-mt-20">
          <SectionHead id="fundamental-head" title="Fundamental Screen" note="Vetted figures, live NSE multiples" />
          <div className="mt-2.5">
            <FundamentalScreen
              data={screen.ok ? screen.data : null}
              q={q}
              sort={sort}
              order={order}
              error={screen.ok ? undefined : screen.message}
            />
          </div>
        </section>

        <section id="macd" aria-labelledby="macd-head" className="mt-5 scroll-mt-20">
          <SectionHead id="macd-head" title="MACD Crossovers" note="MACD line crossing its signal, all bar frequencies" />
          <div className="mt-2.5">
            <MacdScreener />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

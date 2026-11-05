import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/eyebrow";
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
      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-6 sm:px-4 lg:px-6">
        <Eyebrow>Research</Eyebrow>
        <h1 className="mt-4 text-balance text-4xl sm:text-5xl">Screener</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Filter the Nifty 500 on fundamentals that have been checked against a second source and the companies&apos; own filings, or find stocks whose
          momentum just turned.
        </p>

        <section id="fundamental" aria-labelledby="fundamental-head" className="mt-10 scroll-mt-28">
          <SectionHead id="fundamental-head" title="Fundamental screen" note="Vetted figures, live multiples" />
          <div className="mt-6">
            <FundamentalScreen
              data={screen.ok ? screen.data : null}
              q={q}
              sort={sort}
              order={order}
              error={screen.ok ? undefined : screen.message}
            />
          </div>
        </section>

        <section id="macd" aria-labelledby="macd-head" className="mt-14 scroll-mt-28">
          <SectionHead id="macd-head" title="MACD crossovers" note="MACD line crossing its signal, any bar size" />
          <div className="mt-6">
            <MacdScreener />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

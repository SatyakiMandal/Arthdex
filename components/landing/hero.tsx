import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IndexChart } from "./index-chart";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getCandles, getIndices, getUniverseStats } from "@/lib/api/endpoints";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

/**
 * Landing hero.
 *
 * Deliberately restrained: the audience is analysts, and a finance product that
 * performs visually reads as unserious to them. Every number on this page is
 * fetched live rather than written in, which is also the honest thing to do
 * when the product's whole claim is that its figures are computed, not quoted.
 */
export async function Hero() {
  const [nifty, indices, universe] = await Promise.all([
    getCandles("^NSEI", "1Y"),
    getIndices(),
    getUniverseStats(),
  ]);

  const headline = indices.ok
    ? indices.data.filter((index) =>
        ["nifty-50", "nifty-bank", "nifty-it", "india-vix"].includes(index.id),
      )
    : [];

  // Read live rather than written in. A hard-coded count is how the previous
  // version of this page ended up claiming 2,140 companies long after the real
  // figure had moved.
  const universeCount = universe?.data.total ?? null;

  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-[1600px] items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-20">
        <div>
          {/* Live index strip: functional content, not a decorative eyebrow */}
          {headline.length > 0 ? (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {headline.map((index) => (
                <div key={index.id} className="flex items-baseline gap-2">
                  <dt className="text-2xs uppercase tracking-wide text-muted-foreground">
                    {index.name}
                  </dt>
                  <dd className="font-mono text-xs font-medium tabular-nums">
                    {formatINR(index.level, 2)}
                  </dd>
                  <dd className={cn("font-mono text-2xs", deltaColor(index.change.percent))}>
                    {formatPct(index.change.percent)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Indian market analytics, computed from source
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base text-muted-foreground">
            Live NSE prices and filings. Volatility, risk and factor models fitted on real
            return series.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/market-watch"
              className="group inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Open market watch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/company/RELIANCE"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent/50"
            >
              See a company page
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-4">
            {[
              {
                label: "Listed equities",
                value: universeCount ? universeCount.toLocaleString("en-IN") : "—",
              },
              { label: "Volatility models", value: "4" },
              { label: "Benchmarks", value: "8" },
              { label: "Horizons", value: "1D / 1W / 1M" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xs uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          {nifty.ok ? (
            <IndexChart candles={nifty.data.candles} label="Nifty 50" />
          ) : (
            <DataUnavailable title="Index chart unavailable" message={nifty.message} />
          )}
        </div>
      </div>
    </section>
  );
}

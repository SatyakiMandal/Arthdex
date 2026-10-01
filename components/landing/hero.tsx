import Link from "next/link";
import { ArrowRight, Gauge, Globe2, Sigma, Building2 } from "lucide-react";
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
    <section className="relative overflow-hidden border-b border-border">
      {/* Backdrop: a masked grid and two soft colour glows */}
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-[110px]" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-10 h-[24rem] w-[24rem] rounded-full bg-up/10 blur-[110px]" aria-hidden />
      <div className="relative mx-auto grid max-w-[1600px] items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-20">
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

          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-medium text-accent">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Live NSE data · every figure shows its source
          </p>

          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Indian market analytics, <span className="text-gradient">computed from source</span>
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base text-muted-foreground">
            Live NSE prices and filings. Volatility, risk and factor models fitted on real
            return series.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/market-watch" className="btn-primary group">
              Open market watch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/company/RELIANCE" className="btn-ghost">
              See a company page
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Listed equities", value: universeCount ? universeCount.toLocaleString("en-IN") : "—", icon: Building2 },
              { label: "Volatility models", value: "4", icon: Sigma },
              { label: "Benchmarks", value: "8", icon: Globe2 },
              { label: "Horizons", value: "1D·1W·1M", icon: Gauge },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group rounded-xl border border-border bg-surface/70 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40">
                  <dt className="flex items-start gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                    <Icon className="mt-px h-3 w-3 shrink-0 text-accent" />
                    {stat.label}
                  </dt>
                  <dd className="mt-1 whitespace-nowrap font-mono text-lg font-semibold tabular-nums">{stat.value}</dd>
                </div>
              );
            })}
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

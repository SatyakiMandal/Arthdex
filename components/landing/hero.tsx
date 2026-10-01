import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { IndexChart } from "./index-chart";
import { GlowSection, Reveal, Stagger, StaggerItem } from "./motion";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getCandles, getIndices } from "@/lib/api/endpoints";
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
  const [nifty, indices] = await Promise.all([
    getCandles("^NSEI", "1Y"),
    getIndices(),
  ]);

  const headline = indices.ok
    ? indices.data.filter((index) =>
        ["nifty-50", "nifty-bank", "nifty-it", "india-vix"].includes(index.id),
      )
    : [];

  return (
    <GlowSection className="overflow-hidden border-b border-border">
      {/* Backdrop: a masked grid and two soft colour glows */}
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] hero-aurora rounded-full bg-accent/15 blur-[110px]" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-10 h-[24rem] w-[24rem] rounded-full bg-up/10 blur-[110px]" aria-hidden />
      <div className="relative mx-auto grid max-w-[1600px] items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-20">
        <Stagger className="relative">
          <StaggerItem>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-2xs font-medium text-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live NSE data, every figure sourced
            </p>
          </StaggerItem>

          <StaggerItem>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl xl:text-6xl">
              Indian market analytics, <span className="text-gradient">computed from source</span>
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-5 max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
              Live NSE prices and filings, with volatility, risk and factor models fitted on real return series.
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/market-watch" className="btn-primary group px-5 active:scale-[0.98]">
                Open market watch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/company/RELIANCE" className="btn-ghost group px-5 active:scale-[0.98]">
                See a company page
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            </div>
          </StaggerItem>

          {/* Live index strip: each tile links to its market page */}
          {headline.length > 0 ? (
            <StaggerItem>
              <dl className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {headline.map((index) => (
                  <Link
                    key={index.id}
                    href="/market-watch"
                    className="group rounded-xl border border-border bg-surface/60 px-3 py-2.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface"
                  >
                    <dt className="truncate text-2xs uppercase tracking-wide text-muted-foreground">{index.name}</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{formatINR(index.level, 2)}</dd>
                    <dd className={cn("font-mono text-2xs tabular-nums", deltaColor(index.change.percent))}>
                      {formatPct(index.change.percent)}
                    </dd>
                  </Link>
                ))}
              </dl>
            </StaggerItem>
          ) : null}
        </Stagger>

        <Reveal delay={0.15} className="relative">
          {nifty.ok ? (
            <IndexChart candles={nifty.data.candles} label="Nifty 50" />
          ) : (
            <DataUnavailable title="Index chart unavailable" message={nifty.message} />
          )}
        </Reveal>
      </div>
    </GlowSection>
  );
}

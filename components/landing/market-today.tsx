import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { IndexChart } from "./index-chart";
import { Reveal } from "./motion";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getCandles, getPulse } from "@/lib/api/endpoints";
import { cn, formatPct } from "@/lib/utils";

/**
 * The year behind today: Nifty 50 over twelve months beside the sector board,
 * where each sector's market-cap-weighted move is a bar growing left or right
 * from a shared zero line, so leaders and laggards read at a glance.
 */
export async function MarketToday() {
  const [nifty, pulse] = await Promise.all([getCandles("^NSEI", "1Y"), getPulse()]);
  const sectors = pulse.ok ? pulse.data.sectors.filter((s) => s.count >= 1).slice(0, 12) : [];
  const scale = Math.max(1, ...sectors.map((s) => Math.abs(s.changePct)));

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6 lg:py-24">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-balance text-3xl sm:text-4xl">The year behind today</h2>
        <Link href="/market-watch" className="inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline">
          All indices
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Reveal>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        <Reveal className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-7">
          {nifty.ok ? (
            <IndexChart candles={nifty.data.candles} label="Nifty 50" />
          ) : (
            <div className="p-4">
              <DataUnavailable title="Index chart unavailable" message={nifty.message} />
            </div>
          )}
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col rounded-xl border border-border bg-surface lg:col-span-5">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">Sectors today</h3>
            <p className="text-2xs text-muted-foreground">Nifty 50, weighted by market cap</p>
          </div>
          {sectors.length ? (
            <ul className="flex-1 divide-y divide-border/60 px-4 py-1">
              {sectors.map((s) => {
                const width = `${(Math.abs(s.changePct) / scale) * 50}%`;
                const up = s.changePct >= 0;
                return (
                  <li key={s.industry} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 py-2 text-sm">
                    <span className="truncate text-foreground/85">{s.industry}</span>
                    <span className="relative h-2" aria-hidden>
                      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
                      <span
                        className={cn("absolute inset-y-0 rounded-sm", up ? "left-1/2 bg-up/70" : "right-1/2 bg-down/70")}
                        style={{ width }}
                      />
                    </span>
                    <span className={cn("text-right font-mono text-xs tabular-nums", up ? "text-up" : "text-down")}>
                      {formatPct(s.changePct, 2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4">
              <DataUnavailable title="Sector moves unavailable" message={pulse.ok ? "No sector data." : pulse.message} />
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

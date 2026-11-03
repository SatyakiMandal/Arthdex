import Link from "next/link";
import { ArrowRight, Command } from "lucide-react";
import { Pulse } from "./pulse";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getIndices, getPulse, getUniverseStats, getUnlistedDirectory } from "@/lib/api/endpoints";
import type { ApiIndex, ApiPulse } from "@/lib/api/types";
import { formatINR, formatPct } from "@/lib/utils";

const SECTOR_SHORT: Record<string, string> = {
  "Fast Moving Consumer Goods": "FMCG",
  "Oil Gas & Consumable Fuels": "oil and gas",
  "Information Technology": "IT",
  "Financial Services": "financials",
};
const short = (s: string) => SECTOR_SHORT[s] ?? s.toLowerCase();

/** One sentence about today, written from the figures rather than about them. */
function todayInOneLine(nifty: ApiIndex | undefined, pulse: ApiPulse | null): string | null {
  if (!nifty) return null;
  const pct = nifty.change.percent;
  const verb = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  let line = `Nifty 50 is ${verb}${verb === "flat" ? "" : ` ${Math.abs(pct).toFixed(2)}%`} at ${formatINR(nifty.level, 0)}.`;
  if (pulse && pulse.stocks.length) {
    const ranked = pulse.sectors.filter((s) => s.count >= 2).sort((a, b) => b.changePct - a.changePct);
    const lead = ranked[0];
    const lag = ranked[ranked.length - 1];
    line += ` ${pulse.advances} of ${pulse.stocks.length} members are rising`;
    if (lead && lag && lead !== lag) {
      line += `, led by ${short(lead.industry)} (${formatPct(lead.changePct, 1)}) while ${short(lag.industry)} trails (${formatPct(lag.changePct, 1)}).`;
    } else {
      line += ".";
    }
  }
  return line;
}

/**
 * Landing hero.
 *
 * The left column states what Arthdex is and what the market is doing today, in
 * a sentence built from live figures. The right column is the market itself:
 * every Nifty 50 member as a tile. The headline paints on first render, so it is
 * the LCP element and never waits on an animation.
 */
export async function Hero() {
  const [indices, pulse, universe, unlisted] = await Promise.all([getIndices(), getPulse(), getUniverseStats(), getUnlistedDirectory()]);
  const nifty = indices.ok ? indices.data.find((i) => i.id === "nifty-50") : undefined;
  const line = todayInOneLine(nifty, pulse.ok ? pulse.data : null);
  const stats = [
    universe ? { label: "Listed equities", value: formatINR(universe.data.total, 0) } : null,
    unlisted.ok ? { label: "Unlisted tracked", value: formatINR(unlisted.data.total, 0) } : null,
    pulse.ok ? { label: "Price delay", value: `${pulse.meta.delayedMinutes} min` } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <section className="relative border-b border-border">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:pb-20 lg:pt-16">
        <div className="flex flex-col lg:col-span-5 lg:py-6">
          <p className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="h-px w-6 bg-gold" aria-hidden />
            {today}
          </p>

          <h1 className="mt-6 text-balance text-[2.75rem] font-semibold leading-[0.98] sm:text-6xl lg:text-[3.25rem] xl:text-[3.85rem] 2xl:text-[4.5rem]">
            Indian markets, read from source.
          </h1>

          {line ? (
            <p className="mt-7 max-w-[34rem] text-pretty text-lg leading-relaxed text-foreground/80">{line}</p>
          ) : (
            <p className="mt-7 max-w-[34rem] text-pretty text-lg leading-relaxed text-muted-foreground">
              NSE prices, filings and fundamentals, with risk and factor models fitted on real return series.
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/market-watch" className="btn-primary group h-11 px-5">
              Open market watch
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <span className="inline-flex h-11 items-center gap-2 px-1 text-sm text-muted-foreground">
              or press
              <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-2xs text-foreground">
                <Command className="h-3 w-3" aria-hidden />K
              </kbd>
              to find any company or tool
            </span>
          </div>

          {stats.length ? (
            <dl className="mt-auto hidden grid-cols-3 gap-6 border-t border-border pt-6 text-sm lg:grid">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-2xs text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            {pulse.ok && pulse.data.stocks.length ? (
              <Pulse pulse={pulse.data} />
            ) : (
              <div className="p-4">
                <DataUnavailable title="Market pulse unavailable" message={pulse.ok ? "NSE returned no members." : pulse.message} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { getMovers } from "@/lib/api/endpoints";
import { DataUnavailable, FreshnessBadge } from "@/components/ui/data-provenance";
import { Reveal, Stagger, StaggerItem } from "@/components/landing/motion";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";
import type { ApiMover } from "@/lib/api/types";

function MoverList({ rows, tone }: { rows: ApiMover[]; tone: "up" | "down" }) {
  const Icon = tone === "up" ? TrendingUp : TrendingDown;
  const peak = Math.max(...rows.map((r) => Math.abs(r.change.percent)), 0.01);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", tone === "up" ? "bg-up/10" : "bg-down/10")}>
          <Icon className={tone === "up" ? "h-4 w-4 text-up" : "h-4 w-4 text-down"} />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{tone === "up" ? "Top Gainers" : "Top Losers"}</h3>
      </header>

      <ul>
        {rows.map((row) => (
          <li key={row.symbol}>
            <Link
              href={`/company/${row.symbol}`}
              className="group relative flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
            >
              {/* On hover, the bar shows this move relative to the biggest on the list */}
              <span
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100",
                  tone === "up" ? "bg-up/10" : "bg-down/10",
                )}
                style={{ width: `${(Math.abs(row.change.percent) / peak) * 100}%` }}
                aria-hidden
              />
              <span className="relative flex items-center gap-2 font-mono text-xs font-semibold">
                {row.symbol}
                <ArrowRight className="h-3 w-3 -translate-x-1 text-accent opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className="relative flex items-baseline gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatINR(row.cmp)}</span>
                <span className={cn("w-16 text-right font-mono text-xs font-semibold tabular-nums", deltaColor(row.change.percent))}>
                  {formatPct(row.change.percent)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact live preview on the landing page; the full table lives at /market-watch. */
export async function MoversPreview() {
  const [gainers, losers] = await Promise.all([
    getMovers("gainers", "gt20", 6),
    getMovers("losers", "gt20", 6),
  ]);

  return (
    <section id="market-watch" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 py-16 sm:px-6 lg:py-24">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Today&rsquo;s movers</h2>
          <p className="mt-3 text-muted-foreground">
            Live NSE variation lists. Rights entitlements are excluded, since they are not shares in the company.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gainers.ok ? <FreshnessBadge meta={gainers.meta} /> : null}
          <Link
            href="/market-watch"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:scale-[0.98]"
          >
            Full market watch
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>

      {!gainers.ok || !losers.ok ? (
        <div className="mt-8">
          <DataUnavailable message={gainers.ok ? (losers.ok ? "" : losers.message) : gainers.message} />
        </div>
      ) : (
        <Stagger className="mt-8 grid gap-4 lg:grid-cols-2" gap={0.12}>
          <StaggerItem>
            <MoverList rows={gainers.data} tone="up" />
          </StaggerItem>
          <StaggerItem>
            <MoverList rows={losers.data} tone="down" />
          </StaggerItem>
        </Stagger>
      )}
    </section>
  );
}

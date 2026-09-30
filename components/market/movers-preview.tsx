import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { getMovers } from "@/lib/api/endpoints";
import { DataUnavailable, FreshnessBadge } from "@/components/ui/data-provenance";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";
import type { ApiMover } from "@/lib/api/types";

function MoverList({ rows, tone }: { rows: ApiMover[]; tone: "up" | "down" }) {
  const Icon = tone === "up" ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className={tone === "up" ? "h-4 w-4 text-up" : "h-4 w-4 text-down"} />
        <h3 className="text-sm font-semibold tracking-tight">
          {tone === "up" ? "Top Gainers" : "Top Losers"}
        </h3>
      </header>

      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.symbol}>
            <Link
              href={`/company/${row.symbol}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
            >
              <span className="font-mono text-xs font-semibold">{row.symbol}</span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-xs tabular-nums">{formatINR(row.cmp)}</span>
                <span
                  className={cn(
                    "w-16 text-right font-mono text-xs font-medium tabular-nums",
                    deltaColor(row.change.percent),
                  )}
                >
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
    <section id="market-watch" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Today&rsquo;s movers
          </h2>
          <p className="mt-3 text-muted-foreground">
            Live NSE variation lists. Rights entitlements are excluded, since they are not shares in the company.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gainers.ok ? <FreshnessBadge meta={gainers.meta} /> : null}
          <Link
            href="/market-watch"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent"
          >
            Full market watch
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {!gainers.ok || !losers.ok ? (
        <div className="mt-8">
          <DataUnavailable message={gainers.ok ? losers.ok ? "" : losers.message : gainers.message} />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <MoverList rows={gainers.data} tone="up" />
          <MoverList rows={losers.data} tone="down" />
        </div>
      )}
    </section>
  );
}

import type { ResponseMeta } from "@/lib/api/client";
import type { ApiProfile, ApiQuote, ApiValuation } from "@/lib/api/types";
import { WatchButton } from "@/components/watchlist/watch-button";
import { DataUnavailable, FreshnessBadge } from "@/components/ui/data-provenance";
import { cn, deltaColor, formatDelta, formatINR, formatPct } from "@/lib/utils";

/** Where CMP sits inside the 52-week band, as a percentage. */
function bandPosition(quote: ApiQuote): number {
  const span = quote.high52w - quote.low52w;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((quote.cmp - quote.low52w) / span) * 100));
}

export function CompanyHeader({
  symbol,
  quote,
  meta,
  error,
  profile,
  valuation,
}: {
  symbol: string;
  quote: ApiQuote | null;
  meta: ResponseMeta | null;
  error: string | null;
  profile: ApiProfile | null;
  valuation: ApiValuation | null;
}) {
  if (!quote) {
    return (
      <section className="border-b border-border bg-surface-muted/40">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{symbol}</h1>
          <div className="mt-4">
            <DataUnavailable
              title={`Could not load a quote for ${symbol}`}
              message={error ?? "Unknown error"}
            />
          </div>
        </div>
      </section>
    );
  }

  const stats = [
    { label: "Open", value: formatINR(quote.open) },
    { label: "Prev Close", value: formatINR(quote.previousClose) },
    { label: "Day High", value: formatINR(quote.dayHigh) },
    { label: "Day Low", value: formatINR(quote.dayLow) },
    {
      label: "Market Cap",
      value: quote.marketCapCr ? `₹${formatINR(quote.marketCapCr, 0)} Cr` : "—",
    },
    { label: "P/E", value: valuation?.peRatio ? valuation.peRatio.toFixed(2) : "—" },
  ];

  return (
    <section className="border-b border-border bg-surface-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{quote.symbol}</h1>
              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {quote.exchange}
              </span>
              {meta ? <FreshnessBadge meta={meta} /> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{profile?.name ?? quote.symbol}</p>
            {profile ? (
              <p className="mt-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {profile.sector} · {profile.industry}
                {profile.employees ? ` · ${profile.employees.toLocaleString("en-IN")} employees` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-end">
            <WatchButton kind="listed" id={quote.symbol} name={profile?.name ?? quote.symbol} className="mb-3" />
            <div className="font-mono text-3xl font-semibold tabular-nums">
              ₹{formatINR(quote.cmp)}
            </div>
            <div
              className={cn("mt-1 font-mono text-sm tabular-nums", deltaColor(quote.change.percent))}
            >
              {formatDelta(quote.change.absolute)} ({formatPct(quote.change.percent)})
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface px-3 py-2">
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {/* 52-week range rail */}
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-2xs text-muted-foreground">
            <span>52W Low ₹{formatINR(quote.low52w)}</span>
            <span>52W High ₹{formatINR(quote.high52w)}</span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent"
              style={{ left: `${bandPosition(quote)}%` }}
              title={`CMP sits at ${bandPosition(quote).toFixed(0)}% of the 52-week range`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

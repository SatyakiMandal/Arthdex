import type { ResponseMeta } from "@/lib/api/client";
import type { ApiProfile, ApiQuote, ApiValuation } from "@/lib/api/types";
import { WatchButton } from "@/components/watchlist/watch-button";
import { DataUnavailable, FreshnessBadge } from "@/components/ui/data-provenance";
import { cn, deltaColor, formatDelta, formatINR, formatPct } from "@/lib/utils";

/** A value's position inside [low, high], as a clamped percentage. */
function position(value: number, low: number, high: number): number {
  const span = high - low;
  if (span <= 0) return 50;
  return Math.max(0, Math.min(100, ((value - low) / span) * 100));
}

/** "Reliance Industries Limited" reads as "Reliance Industries" in running text. */
function shortName(name: string): string {
  return name.replace(/\s+(Limited|Ltd\.?)$/i, "");
}

/**
 * One sentence that says where the stock stands, written from the quote itself:
 * today's move, distance from the 52-week extremes, and the earnings multiple.
 */
function readQuote(name: string, quote: ApiQuote, valuation: ApiValuation | null): string {
  const pct = quote.change.percent;
  const today =
    Math.abs(pct) < 0.05 ? "flat today" : `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% today`;

  const fromHigh = ((quote.high52w - quote.cmp) / quote.high52w) * 100;
  const fromLow = ((quote.cmp - quote.low52w) / quote.low52w) * 100;
  let band: string;
  if (fromHigh <= 2) band = "near 52W high";
  else if (fromLow <= 2) band = "near 52W low";
  else if (fromHigh <= fromLow) band = `${fromHigh.toFixed(1)}% below 52W high`;
  else band = `${fromLow.toFixed(1)}% above 52W low`;

  const pe = valuation?.peRatio;
  const multiple = pe && pe > 0 ? `, ${pe.toFixed(1)}x trailing P/E` : "";
  return `${shortName(name)} is ${today} (${band}${multiple}).`;
}

/** Volume in lakh or crore shares, the way Indian market data is usually read. */
function formatVolume(shares: number): string {
  if (shares >= 1e7) return `${(shares / 1e7).toFixed(2)} Cr`;
  if (shares >= 1e5) return `${(shares / 1e5).toFixed(2)} L`;
  return shares.toLocaleString("en-IN");
}

/**
 * A range drawn as a hairline: the extremes at either end, the price as an ink
 * tick, and the stretch from a reference point (previous close, or the low)
 * filled so the eye reads direction before it reads numbers.
 */
function RangeRail({
  label,
  low,
  high,
  value,
  from,
  tone,
}: {
  label: string;
  low: number;
  high: number;
  value: number;
  from: number;
  tone: "up" | "down" | "flat" | "ink";
}) {
  const at = position(value, low, high);
  const start = position(from, low, high);
  const left = Math.min(at, start);
  const width = Math.abs(at - start);
  const fill = { up: "bg-up", down: "bg-down", flat: "bg-muted-foreground", ink: "bg-foreground/40" }[tone];

  return (
    <div className="border border-border/60 bg-surface/50 px-2.5 py-1.5 rounded-none">
      <div className="flex items-baseline justify-between gap-2 text-2xs font-mono">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-3xs text-muted-foreground">
          {at >= 99 ? "At High" : at <= 1 ? "At Low" : `${at.toFixed(0)}% in band`}
        </span>
      </div>
      <div className="relative my-1.5 h-1 bg-border/60 overflow-hidden" aria-hidden>
        <span className={cn("absolute top-0 bottom-0", fill)} style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="absolute top-0 bottom-0 w-1 bg-foreground" style={{ left: `calc(${at}% - 2px)` }} />
      </div>
      <div className="flex justify-between font-mono text-3xs tabular-nums text-muted-foreground">
        <span>₹{formatINR(low, 0)}</span>
        <span>₹{formatINR(high, 0)}</span>
      </div>
    </div>
  );
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
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1920px] px-3 py-4 sm:px-4">
          <h1 className="font-mono text-2xl font-semibold">{symbol}</h1>
          <div className="mt-3">
            <DataUnavailable title={`Could not load a quote for ${symbol}`} message={error ?? "Unknown error"} />
          </div>
        </div>
      </section>
    );
  }

  const name = profile?.name ?? quote.symbol;
  const pct = quote.change.percent;
  const dayTone = pct > 0 ? "up" : pct < 0 ? "down" : "flat";

  const ledger = [
    { label: "Market Cap", value: quote.marketCapCr ? `₹${formatINR(quote.marketCapCr, 0)} Cr` : "—" },
    { label: "P/E", value: valuation?.peRatio ? valuation.peRatio.toFixed(2) : "—" },
    { label: "P/B", value: valuation?.pbRatio ? valuation.pbRatio.toFixed(2) : "—" },
    { label: "ROE", value: valuation?.roePct != null ? `${valuation.roePct.toFixed(1)}%` : "—" },
    { label: "Div Yield", value: valuation?.dividendYieldPct != null ? `${valuation.dividendYieldPct.toFixed(2)}%` : "—" },
    { label: "Volume", value: quote.volume ? formatVolume(quote.volume) : "—" },
    { label: "Open", value: `₹${formatINR(quote.open)}` },
    { label: "Prev Close", value: `₹${formatINR(quote.previousClose)}` },
  ];

  return (
    <section className="border-b border-border bg-surface/30">
      <div className="mx-auto max-w-[1920px] px-3 py-3 sm:px-4 lg:py-3.5">
        {/* Ticker strip top line */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5 min-w-0">
            <span className="font-mono text-base font-bold text-accent tracking-tight">{quote.symbol}</span>
            <span className="text-border">|</span>
            <h1 className="text-base sm:text-lg font-serif font-semibold text-foreground truncate">{name}</h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground uppercase tracking-wider">
              {profile ? `${profile.sector} · ${profile.industry}` : quote.exchange}
            </span>
            {profile?.isin ? (
              <>
                <span className="text-border hidden sm:inline">|</span>
                <span className="text-3xs font-mono text-muted-foreground hidden sm:inline">{profile.isin}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {meta ? <FreshnessBadge meta={meta} /> : null}
            <WatchButton kind="listed" id={quote.symbol} name={name} />
          </div>
        </div>

        {/* Central Metric Strip */}
        <div className="mt-2.5 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          {/* Price & Change */}
          <div className="flex items-baseline gap-3 shrink-0">
            <div className="flex items-baseline">
              <span className="mr-1 text-sm font-mono text-muted-foreground">₹</span>
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {formatINR(quote.cmp)}
              </span>
            </div>
            <div className={cn("flex items-baseline gap-1.5 font-mono text-xs font-semibold tabular-nums", deltaColor(pct))}>
              <span>{formatDelta(quote.change.absolute)}</span>
              <span>({formatPct(pct)})</span>
            </div>
            <span className="text-3xs font-mono text-muted-foreground hidden sm:inline">
              {readQuote(name, quote, valuation)}
            </span>
          </div>

          {/* Intraday & 52W Range Rails */}
          <div className="grid gap-2 sm:grid-cols-2">
            <RangeRail
              label="Day Range"
              low={Math.min(quote.dayLow, quote.adjustedBase ?? quote.previousClose)}
              high={Math.max(quote.dayHigh, quote.adjustedBase ?? quote.previousClose)}
              value={quote.cmp}
              from={quote.adjustedBase ?? quote.previousClose}
              tone={dayTone}
            />
            <RangeRail
              label="52-Week Range"
              low={quote.low52w}
              high={quote.high52w}
              value={quote.cmp}
              from={quote.low52w}
              tone="ink"
            />
          </div>
        </div>

        {/* Multiples Micro-Ledger */}
        <dl className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8 border-t border-border/50 pt-2">
          {ledger.map((item) => (
            <div key={item.label} className="border border-border/40 bg-surface/40 px-2 py-1 rounded-none">
              <dt className="text-3xs uppercase font-mono tracking-wider text-muted-foreground">{item.label}</dt>
              <dd className={cn("mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground", item.value === "—" && "text-muted-foreground")}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

import type { ResponseMeta } from "@/lib/api/client";
import type { ApiProfile, ApiQuote, ApiValuation } from "@/lib/api/types";
import { WatchButton } from "@/components/watchlist/watch-button";
import { Eyebrow } from "@/components/ui/eyebrow";
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
    Math.abs(pct) < 0.05 ? "is flat today" : `is ${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% today`;

  const fromHigh = ((quote.high52w - quote.cmp) / quote.high52w) * 100;
  const fromLow = ((quote.cmp - quote.low52w) / quote.low52w) * 100;
  let band: string;
  if (fromHigh <= 2) band = "close to its 52-week high";
  else if (fromLow <= 2) band = "close to its 52-week low";
  else if (fromHigh <= fromLow) band = `${fromHigh.toFixed(1)}% below its 52-week high`;
  else band = `${fromLow.toFixed(1)}% above its 52-week low`;

  const pe = valuation?.peRatio;
  const multiple = pe && pe > 0 ? `, at ${pe.toFixed(1)} times trailing earnings` : "";
  const ex = quote.adjustedBase
    ? ` It went ex today: the change is measured from ₹${formatINR(quote.adjustedBase)}, the previous close of ₹${formatINR(quote.previousClose)} adjusted by the exchange.`
    : "";
  return `${shortName(name)} ${today}, ${band}${multiple}.${ex}`;
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
  const fill = { up: "bg-up", down: "bg-down", flat: "bg-muted-foreground", ink: "bg-foreground/35" }[tone];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {at >= 99 ? "at the high" : at <= 1 ? "at the low" : `${at.toFixed(0)}% of the way up`}
        </span>
      </div>
      <div className="relative mt-3 h-px bg-border" aria-hidden>
        <span className={cn("absolute top-1/2 h-[3px] -translate-y-1/2", fill)} style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="absolute top-1/2 h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: `${at}%` }} />
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span>₹{formatINR(low)}</span>
        <span>₹{formatINR(high)}</span>
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
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
          <h1 className="font-mono text-3xl font-semibold">{symbol}</h1>
          <div className="mt-5">
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
    { label: "Market cap", value: quote.marketCapCr ? `₹${formatINR(quote.marketCapCr, 0)} Cr` : "—" },
    { label: "P/E", value: valuation?.peRatio ? valuation.peRatio.toFixed(2) : "—" },
    { label: "P/B", value: valuation?.pbRatio ? valuation.pbRatio.toFixed(2) : "—" },
    { label: "Return on equity", value: valuation?.roePct != null ? `${valuation.roePct.toFixed(1)}%` : "—" },
    { label: "Dividend yield", value: valuation?.dividendYieldPct != null ? `${valuation.dividendYieldPct.toFixed(2)}%` : "—" },
    { label: "Volume", value: quote.volume ? formatVolume(quote.volume) : "—" },
    { label: "Open", value: `₹${formatINR(quote.open)}` },
    { label: "Previous close", value: `₹${formatINR(quote.previousClose)}` },
  ];

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1600px] px-4 pb-8 pt-8 sm:px-6 lg:pt-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
          <div className="min-w-0">
            <Eyebrow>{profile ? `${profile.sector} · ${profile.industry}` : quote.exchange}</Eyebrow>
            <h1 className="mt-4 text-balance text-[2.5rem] leading-[1.02] sm:text-5xl lg:text-[3.6rem]">{name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{quote.symbol}</span>
              <span aria-hidden>·</span>
              <span>{quote.exchange}</span>
              {profile?.isin ? (
                <>
                  <span aria-hidden className="hidden sm:inline">·</span>
                  <span className="hidden font-mono text-xs sm:inline">{profile.isin}</span>
                </>
              ) : null}
              {meta ? <FreshnessBadge meta={meta} /> : null}
            </div>
            <p className="mt-5 max-w-[62ch] text-pretty text-base leading-relaxed text-muted-foreground">
              {readQuote(name, quote, valuation)}
            </p>
          </div>

          <div className="flex items-end justify-between gap-6 lg:flex-col lg:items-end lg:justify-end">
            <div className="lg:text-right">
              <p className="text-xs text-muted-foreground">Last price</p>
              <p className="mt-1 font-mono text-[2.75rem] font-medium leading-none tracking-tight tabular-nums sm:text-[3.25rem]">
                <span className="mr-1 align-top text-[0.5em] font-normal text-muted-foreground">₹</span>
                {formatINR(quote.cmp)}
              </p>
              <p className={cn("mt-2 font-mono text-sm tabular-nums", deltaColor(pct))}>
                {formatDelta(quote.change.absolute)} · {formatPct(pct)}
                <span className="ml-1.5 font-sans text-muted-foreground">today</span>
              </p>
            </div>
            <WatchButton kind="listed" id={quote.symbol} name={name} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:gap-16">
          <RangeRail
            label="Today"
            low={Math.min(quote.dayLow, quote.adjustedBase ?? quote.previousClose)}
            high={Math.max(quote.dayHigh, quote.adjustedBase ?? quote.previousClose)}
            value={quote.cmp}
            from={quote.adjustedBase ?? quote.previousClose}
            tone={dayTone}
          />
          <RangeRail label="52 weeks" low={quote.low52w} high={quote.high52w} value={quote.cmp} from={quote.low52w} tone="ink" />
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
          {ledger.map((item) => (
            <div key={item.label} className="border-t border-border pt-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className={cn("mt-1 font-mono text-[15px] font-medium tabular-nums", item.value === "—" && "text-muted-foreground")}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

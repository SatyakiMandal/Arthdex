import type { ApiExchangeComparison, ApiExchangeSide } from "@/lib/api/types";
import { cn, deltaColor, formatDelta, formatINR, formatPct } from "@/lib/utils";

function volume(shares: number | null): string {
  if (shares == null) return "—";
  if (shares >= 1e7) return `${(shares / 1e7).toFixed(2)} Cr`;
  if (shares >= 1e5) return `${(shares / 1e5).toFixed(2)} L`;
  return shares.toLocaleString("en-IN");
}

const money = (v: number | null | undefined, digits = 2) => (v == null ? "—" : `₹${formatINR(v, digits)}`);

const ROWS: { label: string; value: (s: ApiExchangeSide) => string }[] = [
  { label: "Last price", value: (s) => money(s.cmp) },
  { label: "Change", value: (s) => `${formatDelta(s.change.absolute)} (${formatPct(s.change.percent)})` },
  { label: "Open", value: (s) => money(s.open) },
  { label: "Day range", value: (s) => (s.dayLow != null && s.dayHigh != null ? `${money(s.dayLow)} – ${money(s.dayHigh)}` : "—") },
  { label: "Previous close", value: (s) => money(s.previousClose) },
  { label: "Volume", value: (s) => volume(s.volume) },
  { label: "Turnover", value: (s) => (s.turnoverCr != null ? `₹${formatINR(s.turnoverCr, 2)} Cr` : "—") },
  { label: "VWAP", value: (s) => money(s.vwap) },
  { label: "52-week range", value: (s) => (s.low52w != null && s.high52w != null ? `${money(s.low52w)} – ${money(s.high52w)}` : "—") },
];

/** Daily NSE-minus-BSE gap as a share of price, over the shared trading days. */
function GapChart({ history }: { history: ApiExchangeComparison["history"] }) {
  if (history.length < 2) return null;
  const W = 600;
  const H = 120;
  const max = Math.max(0.05, ...history.map((h) => Math.abs(h.gapPct)));
  const x = (i: number) => (i / (history.length - 1)) * W;
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 6);
  const points = history.map((h, i) => `${x(i).toFixed(1)},${y(h.gapPct).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-28 w-full" role="img" aria-label="Daily price gap between NSE and BSE">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
        <polyline points={points} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-3xs text-muted-foreground">
        <span>{history[0].date}</span>
        <span>
          ±{max.toFixed(2)}% scale · above the line, NSE closed higher
        </span>
        <span>{history[history.length - 1].date}</span>
      </figcaption>
    </figure>
  );
}

export function ExchangeComparison({ data }: { data: ApiExchangeComparison }) {
  const { nse, bse, gap, volumeShare, historySummary: hs } = data;
  const missing = !nse ? "NSE" : !bse ? "BSE" : null;

  return (
    <section aria-labelledby="exchange-compare" className="border-b border-border bg-surface/20">
      <div className="mx-auto max-w-[1920px] px-2 py-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="exchange-compare" className="font-mono text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            NSE {data.nseSymbol} against BSE {data.bseCode}
            {data.bseScripId && data.bseScripId !== data.nseSymbol ? ` (${data.bseScripId})` : ""}
          </h2>
          {gap ? (
            <p className="font-mono text-xs">
              {Math.abs(gap.absolute) < 0.005 ? (
                <span className="text-muted-foreground">Same price on both exchanges</span>
              ) : (
                <>
                  <span className="font-semibold">{gap.absolute > 0 ? "NSE" : "BSE"}</span>
                  <span className="text-muted-foreground"> is higher by </span>
                  <span className="font-semibold tabular-nums">₹{formatINR(Math.abs(gap.absolute))}</span>
                  <span className="text-muted-foreground"> ({Math.abs(gap.percent).toFixed(3)}%)</span>
                </>
              )}
            </p>
          ) : null}
        </div>

        {missing ? (
          <p role="note" className="mt-2 text-xs text-muted-foreground">
            {missing}&apos;s own quote is unavailable right now, so the two cannot be compared. Another source&apos;s price is not shown in its place.
          </p>
        ) : null}

        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 text-left font-medium">As of {nse?.exchangeTime ?? bse?.exchangeTime ?? "now"}</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">NSE</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">BSE</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-border/50">
                    <th scope="row" className="py-1.5 pr-3 text-left font-sans font-normal text-muted-foreground">{r.label}</th>
                    {[nse, bse].map((s, i) => (
                      <td key={i} className={cn("px-2 py-1.5 text-right tabular-nums", r.label === "Change" && s ? deltaColor(s.change.percent) : "", !s && "text-muted-foreground")}>
                        {s ? r.value(s) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            {volumeShare ? (
              <div>
                <p className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Today&apos;s volume</span>
                  <span className="font-mono tabular-nums">
                    NSE {volumeShare.nse.toFixed(1)}% · BSE {volumeShare.bse.toFixed(1)}%
                  </span>
                </p>
                <div className="mt-1.5 flex h-1.5 overflow-hidden bg-border/60" aria-hidden>
                  <span className="bg-foreground" style={{ width: `${volumeShare.nse}%` }} />
                  <span className="bg-muted-foreground/50" style={{ width: `${volumeShare.bse}%` }} />
                </div>
              </div>
            ) : null}

            {hs.days >= 2 ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  Over the last {hs.days} shared sessions the closes differed by{" "}
                  <span className="font-mono text-foreground">{hs.meanAbsGapPct?.toFixed(3)}%</span> on average, at most{" "}
                  <span className="font-mono text-foreground">{hs.maxAbsGapPct?.toFixed(3)}%</span>. NSE closed higher on {hs.daysNseHigher} days, BSE on{" "}
                  {hs.daysBseHigher}
                  {hs.nseVolumeSharePct != null ? `; NSE carried ${hs.nseVolumeSharePct.toFixed(1)}% of the shares traded` : ""}.
                </p>
                <div className="mt-2">
                  <GapChart history={data.history} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Too few shared sessions in the exchanges&apos; daily records to compare closes.</p>
            )}
          </div>
        </div>

        <p className="mt-2 text-3xs text-muted-foreground">
          Each column is that exchange&apos;s own quote; daily closes are each exchange&apos;s own records. Gaps are measured against the average of the two prices.
        </p>
      </div>
    </section>
  );
}

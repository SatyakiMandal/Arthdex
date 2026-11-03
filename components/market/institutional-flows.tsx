import type { ApiFlows } from "@/lib/api/types";
import { cn, deltaColor, formatINR } from "@/lib/utils";

const crore = (v: number | null | undefined, digits = 0) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}₹${formatINR(Math.abs(v), digits)} Cr`;

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const compact = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatINR(Math.abs(v), 0)}`;

function streakText(n: number, who: string) {
  // A one-day "streak" says nothing the figure above does not
  if (Math.abs(n) < 2) return null;
  const days = Math.abs(n);
  return `${who} have been net ${n > 0 ? "buyers" : "sellers"} for ${days} trading day${days === 1 ? "" : "s"} running.`;
}

/**
 * Daily diverging bars, foreign above domestic, sharing one scale so the two can be
 * compared by length. With little recorded history it says so instead of looking thin.
 */
function FlowBars({ series }: { series: ApiFlows["series"] }) {
  const rows = series.slice(-30);
  const peak = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.fii ?? 0), Math.abs(r.dii ?? 0)]));
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5" role="img" aria-label="Daily net flows, foreign and domestic institutions">
      {rows.flatMap((r) =>
        (["fii", "dii"] as const).map((who) => {
          const v = r[who] ?? 0;
          const w = (Math.abs(v) / peak) * 50;
          return [
            <span key={`${r.date}-${who}-l`} className="font-mono text-xs tabular-nums text-muted-foreground">
              {who === "fii" ? day(r.date) : ""}
            </span>,
            <div key={`${r.date}-${who}-b`} className="relative h-3">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
              <span
                className={cn("absolute inset-y-0.5", who === "fii" ? "bg-accent" : "bg-gold", v < 0 && "opacity-60")}
                style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
              />
            </div>,
          ];
        }),
      )}
    </div>
  );
}

export function InstitutionalFlows({ flows }: { flows: ApiFlows }) {
  const { latest, latestNsdl, totals, streak } = flows;
  const fii = latest.allExchanges.fii;
  const dii = latest.allExchanges.dii;
  const disagree = flows.directionCheck.filter((c) => !c.agree);

  const legs = [
    { who: "Foreign institutions (FII/FPI)", leg: fii, month: totals.fiiMonth, d5: totals.fii5d, d20: totals.fii20d, mark: "bg-accent" },
    { who: "Domestic institutions (DII)", leg: dii, month: totals.diiMonth, d5: totals.dii5d, d20: totals.dii20d, mark: "bg-gold" },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <div>
        <p className="text-sm text-muted-foreground">
          ₹ crore, cash market, all exchanges, provisional for {new Date(`${latest.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <div className="mt-5 grid gap-8 sm:grid-cols-2">
          {legs.map(({ who, leg, month, d5, d20, mark }) => (
            <div key={who}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("h-2.5 w-2.5", mark)} aria-hidden />
                {who}
              </p>
              <p className={cn("mt-2 font-mono text-3xl font-medium tabular-nums", deltaColor(leg.net ?? 0))}>{crore(leg.net)}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                Bought {formatINR(leg.buy ?? 0, 0)} · sold {formatINR(leg.sell ?? 0, 0)}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
                {[
                  ["This month", month],
                  ["5 days", d5],
                  ["20 days", d20],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className={cn("mt-0.5 font-mono text-sm tabular-nums", value == null ? "text-muted-foreground" : deltaColor(value as number))}>
                      {compact(value as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted-foreground empty:hidden">
          {[streakText(streak.fii, "Foreign institutions"), streakText(streak.dii, "Domestic institutions")].filter(Boolean).join(" ")}
        </p>

        {latestNsdl ? (
          <div className="mt-6 border-t border-border pt-4 text-sm">
            <p className="font-medium">NSDL custodial report, {day(latestNsdl.reportedOn)}</p>
            <p className="mt-1 text-muted-foreground">
              Foreign portfolio investors only, as their custodians reported it a trading day later. Equity through the exchanges{" "}
              <span className={cn("font-mono", deltaColor(latestNsdl.equity.stockExchange.net ?? 0))}>{crore(latestNsdl.equity.stockExchange.net)}</span>
              ; including primary market{" "}
              <span className={cn("font-mono", deltaColor(latestNsdl.equity.total.net ?? 0))}>{crore(latestNsdl.equity.total.net)}</span>
              {latestNsdl.equity.total.netUsdMn != null ? ` ($${formatINR(Math.abs(latestNsdl.equity.total.netUsdMn), 0)} mn)` : ""}. A different
              measure from NSE&apos;s provisional figure, so the two are shown side by side, not reconciled.
            </p>
          </div>
        ) : null}
        {disagree.length ? (
          <p role="note" className="mt-3 text-xs text-muted-foreground">
            On {disagree.length === 1 ? "one day" : `${disagree.length} days`} the two measures pointed opposite ways by a wide margin, most recently{" "}
            {day(disagree.at(-1)!.tradeDate)}.
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium">Daily net, recorded</p>
        <div className="mt-4">
          {flows.days >= 5 ? (
            <FlowBars series={flows.series} />
          ) : (
            <p className="text-sm text-muted-foreground">
              NSE publishes only the latest day, so Arthdex records each day as it is published. History began on{" "}
              {flows.historyStarts ? day(flows.historyStarts) : "the first recording"}; the chart appears after five trading days, and the
              5- and 20-day totals once there are enough days to sum.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

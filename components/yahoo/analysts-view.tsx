import { CalendarClock, Target, ThumbsUp, TrendingUp } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import type { ApiYAnalysts, YEstimateRow } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { BarChart, num } from "./shared";

const REC = [
  ["strongBuy", "Strong buy", "hsl(var(--up))"],
  ["buy", "Buy", "hsl(var(--up) / 0.6)"],
  ["hold", "Hold", "hsl(var(--flat))"],
  ["sell", "Sell", "hsl(var(--down) / 0.6)"],
  ["strongSell", "Strong sell", "hsl(var(--down))"],
] as const;

const RATING_LABEL: Record<string, string> = { strong_buy: "Strong buy", buy: "Buy", hold: "Hold", underperform: "Underperform", sell: "Sell" };

function EstTable({ rows, cols, money }: { rows: YEstimateRow[]; cols: [string, string][]; money?: boolean }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">Not provided for this company.</p>;
  const f = (v: unknown, k: string) => {
    if (typeof v !== "number") return "—";
    if (k === "growth" || k === "numberOfAnalysts") return k === "growth" ? `${(v * 100).toFixed(1)}%` : String(v);
    return money ? v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : v.toFixed(2);
  };
  return (
    <div className="overflow-x-auto">
      <table className="data-table yf-table w-full text-left text-[0.8125rem]">
        <thead>
          <tr>
            <th>Period</th>
            {cols.map(([, l]) => (
              <th key={l} className="text-right">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-medium">{r.period}</td>
              {cols.map(([k]) => (
                <td key={k} className="text-right font-mono tabular-nums">
                  {f(r[k], k)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalystsView({ data }: { data: ApiYAnalysts }) {
  const { targets: t, currentPrice: px } = data;
  const lo = t.low;
  const hi = t.high;
  const span = lo != null && hi != null ? hi - lo : null;
  const pos = (v: number | null) => (span && lo != null && v != null ? Math.min(100, Math.max(0, ((v - lo) / span) * 100)) : null);
  const upside = t.mean != null && px ? (t.mean / px - 1) * 100 : null;
  const latest = data.recommendations[0];
  const total = latest ? REC.reduce((a, [k]) => a + (latest[k] ?? 0), 0) : 0;
  const beats = data.earningsHistory.filter((e) => (e.surprisePct ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <DataCard
        title="Analyst price targets"
        subtitle={t.analysts != null ? `${t.analysts} analysts` : undefined}
        icon={Target}
        badge={t.key ? <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-2xs font-medium text-accent">{RATING_LABEL[t.key] ?? t.key}</span> : undefined}
      >
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Current price", num(px)],
              ["Mean target", num(t.mean)],
              ["Implied move", upside != null ? `${upside > 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"],
              ["Mean rating (1 buy – 5 sell)", num(t.meanRating)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
                <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className={cn("font-mono text-lg font-semibold tabular-nums", k === "Implied move" && upside != null && (upside >= 0 ? "text-up" : "text-down"))}>{v}</p>
              </div>
            ))}
          </div>
          {span ? (
            <div>
              <div className="relative mt-6 h-2 rounded-full bg-gradient-to-r from-down/40 via-flat/30 to-up/40">
                {([["Low", t.low], ["Mean", t.mean], ["High", t.high]] as const).map(([l, v]) => (
                  <span key={l} className="absolute -top-5 -translate-x-1/2 text-center text-2xs text-muted-foreground" style={{ left: `${pos(v) ?? 0}%` }}>
                    {l}
                    <span className="block font-mono text-foreground">{num(v, 0)}</span>
                  </span>
                ))}
                {pos(px) != null ? <span className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-accent shadow" style={{ left: `${pos(px)}%` }} title={`Price ${num(px)}`} /> : null}
              </div>
              <p className="mt-2 text-2xs text-muted-foreground">The accent marker is today&apos;s price against the range of analyst targets.</p>
            </div>
          ) : null}
        </div>
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Recommendation trend" subtitle="Analysts by rating, by month" icon={ThumbsUp}>
          {data.recommendations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No recommendation breakdown from Yahoo Finance.</p>
          ) : (
            <div className="space-y-3 p-4">
              {data.recommendations.map((r) => {
                const sum = REC.reduce((a, [k]) => a + (r[k] ?? 0), 0) || 1;
                return (
                  <div key={r.period}>
                    <p className="mb-1 text-2xs text-muted-foreground">{r.period === "0m" ? "This month" : r.period.replace("-", "") + " ago"}</p>
                    <div className="flex h-5 overflow-hidden rounded-md">
                      {REC.map(([k, label, color]) =>
                        (r[k] ?? 0) > 0 ? (
                          <span key={k} className="grid place-items-center text-[0.625rem] font-medium text-white" style={{ width: `${((r[k] ?? 0) / sum) * 100}%`, background: color }} title={`${label}: ${r[k]}`}>
                            {r[k]}
                          </span>
                        ) : null,
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-3 pt-1 text-2xs text-muted-foreground">
                {REC.map(([k, label, color]) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
              {latest ? <p className="text-2xs text-muted-foreground">{total} analysts in the latest period.</p> : null}
            </div>
          )}
        </DataCard>

        <DataCard
          title="Earnings history"
          subtitle="Reported vs estimated EPS (dashed outline = estimate)"
          icon={TrendingUp}
          badge={data.earningsHistory.length ? <span className="text-2xs text-muted-foreground">{beats} of {data.earningsHistory.length} beat</span> : undefined}
        >
          {data.earningsHistory.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No earnings history from Yahoo Finance.</p>
          ) : (
            <div className="p-4">
              <BarChart
                items={data.earningsHistory.map((e) => ({
                  label: e.date.slice(2, 7),
                  value: e.actual ?? 0,
                  ghost: e.estimate,
                  color: (e.surprisePct ?? 0) >= 0 ? "hsl(var(--up))" : "hsl(var(--down))",
                }))}
                fmt={(v) => v.toFixed(1)}
              />
              {data.nextEarnings ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  Next report {data.nextEarnings.date}
                  {data.nextEarnings.epsEstimate != null ? `, EPS estimate ${data.nextEarnings.epsEstimate}` : ""}
                </p>
              ) : null}
            </div>
          )}
        </DataCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Earnings estimate" subtitle="EPS, ₹" icon={TrendingUp}>
          <EstTable rows={data.earningsEstimate} cols={[["avg", "Avg"], ["low", "Low"], ["high", "High"], ["yearAgoEps", "Year ago"], ["growth", "Growth"], ["numberOfAnalysts", "Analysts"]]} />
        </DataCard>
        <DataCard title="Revenue estimate" subtitle="₹ crore" icon={TrendingUp}>
          <EstTable money rows={data.revenueEstimate} cols={[["avg", "Avg"], ["low", "Low"], ["high", "High"], ["yearAgoRevenue", "Year ago"], ["growth", "Growth"], ["numberOfAnalysts", "Analysts"]]} />
        </DataCard>
        <DataCard title="EPS trend" subtitle="How the consensus has moved" icon={TrendingUp}>
          <EstTable rows={data.epsTrend} cols={[["current", "Current"], ["7daysAgo", "7d ago"], ["30daysAgo", "30d ago"], ["60daysAgo", "60d ago"], ["90daysAgo", "90d ago"]]} />
        </DataCard>
        <DataCard title="EPS revisions" subtitle="Analysts revising up / down" icon={TrendingUp}>
          <EstTable rows={data.epsRevisions} cols={[["upLast7days", "Up 7d"], ["upLast30days", "Up 30d"], ["downLast7Days", "Down 7d"], ["downLast30days", "Down 30d"]]} />
        </DataCard>
      </div>

      {data.growthEstimates.length > 0 ? (
        <DataCard title="Growth estimates" icon={TrendingUp}>
          <div className="overflow-x-auto">
            <table className="data-table yf-table w-full text-left text-[0.8125rem]">
              <thead>
                <tr>
                  <th>Period</th>
                  {Object.keys(data.growthEstimates[0]).filter((k) => k !== "period" && k !== "key").map((k) => (
                    <th key={k} className="text-right">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.growthEstimates.map((r) => (
                  <tr key={r.period}>
                    <td className="font-medium">{r.period}</td>
                    {Object.keys(r).filter((k) => k !== "period" && k !== "key").map((k) => (
                      <td key={k} className="text-right font-mono tabular-nums">
                        {typeof r[k] === "number" ? `${((r[k] as number) * 100).toFixed(1)}%` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      ) : null}
    </div>
  );
}

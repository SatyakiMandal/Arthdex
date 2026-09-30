import {
  Activity,
  BarChart3,
  FlaskConical,
  Gauge,
  LineChart,
  Newspaper,
  ShieldAlert,
  Target,
  Landmark,
} from "lucide-react";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";
import type { ListedSummary, UnlistedSummary } from "@/types/analyzer";

const dash = "—";
const num = (v: number | null | undefined, d = 2) => (v == null ? dash : v.toFixed(d));
const pct = (v: number | null | undefined, d = 2) => (v == null ? dash : formatPct(v, d));
/** Backend sends returns / volatilities as fractions. */
const frac = (v: number | null | undefined, d = 2) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
const fracSigned = (v: number | null | undefined, d = 2) => (v == null ? dash : formatPct(v * 100, d));
const inr = (v: number | null | undefined) => (v == null ? dash : `₹${formatINR(v)}`);

function stanceTone(stance: string | null): "up" | "down" | "flat" {
  const s = (stance ?? "").toLowerCase();
  if (s.includes("bull") || s.includes("buy") || s.includes("accumulate")) return "up";
  if (s.includes("bear") || s.includes("sell") || s.includes("reduce")) return "down";
  return "flat";
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm", tone)}>{value}</p>
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3">{children}</div>;
}

function Pill({ label, tone }: { label: string; tone: "up" | "down" | "flat" }) {
  return <StatusPill label={label} tone={tone} />;
}

export function ListedSummaryView({ s }: { s: ListedSummary }) {
  const v = s.verdict;
  const varRows = [
    { label: "1-day 95%", row: s.risk.var1d95 },
    { label: "1-day 99%", row: s.risk.var1d99 },
  ];

  return (
    <div className="space-y-4">
      {v ? (
        <DataCard
          title="Investment call"
          subtitle={`Synthesised from five weighted pillars${v.asOf ? ` · as of ${v.asOf}` : ""}`}
          icon={Target}
          badge={v.call ? <Pill label={v.call} tone={stanceTone(v.call)} /> : undefined}
          footnote="A model output that combines the event study, technicals, valuation, macro and solvency scores. It is not investment advice."
        >
          <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <p className="text-2xs uppercase tracking-wider text-muted-foreground">Conviction</p>
              <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">
                {num(v.conviction, 1)}
                <span className="text-lg text-muted-foreground"> / 100</span>
              </p>
              {v.summary ? <p className="mt-3 text-sm text-muted-foreground">{v.summary}</p> : null}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <Stat label="Price" value={inr(v.price)} />
                <Stat label="Entry zone" value={v.entryLow != null ? `${inr(v.entryLow)} – ${inr(v.entryHigh)}` : dash} />
                <Stat label="Target 1" value={`${inr(v.target1)} (${pct(v.target1Pct, 1)})`} tone="text-up" />
                <Stat label="Target 2" value={`${inr(v.target2)} (${pct(v.target2Pct, 1)})`} tone="text-up" />
                <Stat label="Stop" value={`${inr(v.stop)} (${v.stopPct != null ? `-${v.stopPct.toFixed(1)}%` : dash})`} tone="text-down" />
                <Stat label="Risk / reward" value={v.riskReward ?? dash} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Pillar</th>
                    <th className="pb-2 text-right font-medium">Weight</th>
                    <th className="pb-2 text-right font-medium">Score</th>
                    <th className="pb-2 pl-3 font-medium">Stance</th>
                  </tr>
                </thead>
                <tbody>
                  {v.pillars.map((p, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-2 pr-2">
                        <p>{p.name}</p>
                        {p.highlight ? <p className="mt-0.5 text-2xs text-muted-foreground">{p.highlight}</p> : null}
                      </td>
                      <td className="py-2 text-right font-mono">{p.weight != null ? `${p.weight}%` : dash}</td>
                      <td className={cn("py-2 text-right font-mono", p.score != null ? deltaColor(p.score) : "")}>
                        {num(p.score, 0)}
                      </td>
                      <td className="py-2 pl-3">
                        {p.stance ? <Pill label={p.stance} tone={stanceTone(p.stance)} /> : dash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {v.thesis ? <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{v.thesis}</p> : null}
        </DataCard>
      ) : null}

      <DataCard
        title="Flagged event days"
        subtitle={`${s.incidentCount} candidate day${s.incidentCount === 1 ? "" : "s"} where unusual coverage met an unusual benchmark-adjusted move`}
        icon={Newspaper}
        footnote="Descriptive association between coverage and price, not proof that the news caused the move."
      >
        {s.incidents.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No day cleared both the coverage and return thresholds in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-2 py-2 text-right font-medium">Abnormal ret.</th>
                  <th className="px-2 py-2 text-right font-medium">z</th>
                  <th className="px-2 py-2 text-right font-medium">Articles</th>
                  <th className="px-2 py-2 text-right font-medium">Sentiment</th>
                  <th className="px-4 py-2 font-medium">Event · emotion</th>
                </tr>
              </thead>
              <tbody>
                {s.incidents.map((i) => (
                  <tr key={i.day} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono">{i.day}</td>
                    <td className={cn("px-2 py-2 text-right font-mono", i.abnormalReturn != null ? deltaColor(i.abnormalReturn) : "")}>
                      {fracSigned(i.abnormalReturn)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{num(i.z, 1)}</td>
                    <td className="px-2 py-2 text-right font-mono">{i.items ?? dash}</td>
                    <td className={cn("px-2 py-2 text-right font-mono", i.sentiment != null ? deltaColor(i.sentiment) : "")}>
                      {i.sentiment != null ? (i.sentiment > 0 ? "+" : "") + i.sentiment.toFixed(2) : dash}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[i.event, i.emotion].filter(Boolean).join(" · ") || dash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard
          title="Return forecast"
          subtitle="Conformal prediction intervals"
          icon={LineChart}
          badge={s.forecast.bias ? <Pill label={s.forecast.bias} tone={stanceTone(s.forecast.bias)} /> : undefined}
          footnote={s.forecast.confidence ?? undefined}
        >
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Horizon</th>
                  <th className="pb-2 text-right font-medium">P10</th>
                  <th className="pb-2 text-right font-medium">Median</th>
                  <th className="pb-2 text-right font-medium">P90</th>
                </tr>
              </thead>
              <tbody>
                {s.forecast.horizons.map((h) => (
                  <tr key={h.days} className="border-t border-border">
                    <td className="py-2 font-mono">{h.days}d</td>
                    <td className="py-2 text-right font-mono text-down">{pct(h.p10)}</td>
                    <td className={cn("py-2 text-right font-mono", h.p50 != null ? deltaColor(h.p50) : "")}>{pct(h.p50)}</td>
                    <td className="py-2 text-right font-mono text-up">{pct(h.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.forecast.inferences.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-2xs text-muted-foreground">
                {s.forecast.inferences.slice(0, 3).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </DataCard>

        <DataCard
          title="Risk"
          subtitle="Value-at-risk, solvency and volatility regime"
          icon={ShieldAlert}
          badge={s.risk.regime ? <Pill label={s.risk.regime} tone="flat" /> : undefined}
          footnote={s.risk.regimeGuidance ?? undefined}
        >
          <div className="overflow-x-auto px-4 pt-4">
            <table className="w-full text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Loss at</th>
                  <th className="pb-2 text-right font-medium">Historical</th>
                  <th className="pb-2 text-right font-medium">Parametric</th>
                  <th className="pb-2 text-right font-medium">Monte Carlo</th>
                </tr>
              </thead>
              <tbody>
                {varRows.map(({ label, row }) => (
                  <tr key={label} className="border-t border-border">
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-right font-mono">{frac(row.historical)}</td>
                    <td className="py-2 text-right font-mono">{frac(row.parametric)}</td>
                    <td className="py-2 text-right font-mono">{frac(row.monte_carlo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatGrid>
            <Stat label="Annualised vol" value={frac(s.risk.annualisedVol, 1)} />
            <Stat label="Vol consensus" value={frac(s.risk.consensusVol, 1)} />
            <Stat
              label="Distance to default"
              value={s.risk.distanceToDefault != null ? `${s.risk.distanceToDefault.toFixed(1)}σ` : dash}
            />
          </StatGrid>
        </DataCard>

        <DataCard
          title="Technical picture"
          subtitle="Composite of trend, momentum and volatility indicators"
          icon={Activity}
          badge={s.technical.rating ? <Pill label={s.technical.rating} tone={stanceTone(s.technical.rating)} /> : undefined}
          footnote={s.technical.verdict ?? undefined}
        >
          <StatGrid>
            <Stat label="Composite" value={num(s.technical.score, 0)} tone={s.technical.score != null ? deltaColor(s.technical.score) : undefined} />
            <Stat label="RSI (14)" value={num(s.technical.rsi, 1)} />
            <Stat label="ADX (14)" value={num(s.technical.adx, 1)} />
            <Stat label="MACD" value={s.technical.macd ?? dash} />
            <div className="col-span-2">
              <Stat label="Trend" value={s.technical.trend ?? dash} />
            </div>
          </StatGrid>
        </DataCard>

        <DataCard
          title="Fundamentals & valuation"
          subtitle={s.fundamental.asOf ? `Latest quarter to ${s.fundamental.asOf}` : undefined}
          icon={Landmark}
          badge={s.fundamental.valuationRating ? <Pill label={s.fundamental.valuationRating} tone="flat" /> : undefined}
          footnote={s.fundamental.valuationStance ?? undefined}
        >
          <StatGrid>
            <Stat
              label={`Revenue${s.fundamental.unit ? ` (${s.fundamental.unit})` : ""}`}
              value={s.fundamental.revenue != null ? formatINR(s.fundamental.revenue, 0) : dash}
            />
            <Stat label="Revenue YoY" value={fracSigned(s.fundamental.revenueYoY, 1)} tone={s.fundamental.revenueYoY != null ? deltaColor(s.fundamental.revenueYoY) : undefined} />
            <Stat label="Net profit YoY" value={fracSigned(s.fundamental.netProfitYoY, 1)} tone={s.fundamental.netProfitYoY != null ? deltaColor(s.fundamental.netProfitYoY) : undefined} />
            <Stat label="P/E" value={num(s.fundamental.pe, 1)} />
            <Stat label="P/B" value={num(s.fundamental.pb, 2)} />
            <Stat label="EV/EBITDA" value={num(s.fundamental.evEbitda, 1)} />
          </StatGrid>
        </DataCard>

        <DataCard
          title="Market model & news"
          subtitle={s.market.model ? `${s.market.model} vs ${s.benchmark}` : undefined}
          icon={Gauge}
        >
          <StatGrid>
            <Stat label="Beta" value={num(s.market.beta, 2)} />
            <Stat label="Alpha (daily)" value={s.market.alpha != null ? s.market.alpha.toExponential(2) : dash} />
            <Stat label="R²" value={num(s.market.rSquared, 2)} />
            <Stat label="Articles kept" value={s.news.items ?? dash} />
            <Stat label="Duplicates removed" value={s.news.duplicates ?? dash} />
            <Stat
              label="Sentiment ↔ return r"
              value={s.news.sentimentReturnR != null ? `${s.news.sentimentReturnR.toFixed(2)} (n=${s.news.sentimentReturnN})` : dash}
            />
          </StatGrid>
        </DataCard>

        <DataCard
          title="Backtests"
          subtitle="How the model’s own signals would have fared in this window"
          icon={FlaskConical}
        >
          <StatGrid>
            <Stat label="Events tested" value={s.backtest.events ?? dash} />
            <Stat label="Win rate" value={s.backtest.winRatePct != null ? `${s.backtest.winRatePct.toFixed(1)}%` : dash} />
            <Stat label="Profit factor" value={num(s.backtest.profitFactor, 2)} />
            <Stat
              label="Interval coverage"
              value={s.backtest.conformalCoveragePct != null ? `${s.backtest.conformalCoveragePct.toFixed(1)}%` : dash}
            />
          </StatGrid>
        </DataCard>
      </div>

      {s.caveats.length > 0 ? (
        <DataCard title="Caveats from the run" icon={BarChart3}>
          <ul className="space-y-2 p-4 text-sm text-muted-foreground">
            {s.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </DataCard>
      ) : null}
    </div>
  );
}

export function UnlistedSummaryView({ s }: { s: UnlistedSummary }) {
  const p = s.price;
  return (
    <div className="space-y-4">
      <DataCard
        title="Dealer-price trajectory"
        subtitle={p.firstDate && p.lastDate ? `${p.firstDate} → ${p.lastDate} · ${p.observations} quotes` : undefined}
        icon={LineChart}
        footnote="Unlisted prices are private dealer quotes, not exchange prints. Price gaps are attributed to headlines by timing only."
      >
        <StatGrid>
          <Stat label="First quote" value={inr(p.first)} />
          <Stat label="Latest quote" value={inr(p.last)} />
          <Stat label="Change" value={pct(p.changePct)} tone={p.changePct != null ? deltaColor(p.changePct) : undefined} />
          <Stat label="High" value={inr(p.high)} />
          <Stat label="Low" value={inr(p.low)} />
          <Stat label="Price revisions" value={s.moveCount} />
        </StatGrid>
      </DataCard>

      <DataCard
        title="Largest price moves"
        subtitle="With the headlines published between the two quotes"
        icon={Newspaper}
      >
        {s.moves.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No price revisions in this window.</p>
        ) : (
          <ul className="divide-y divide-border">
            {s.moves.map((m, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm">
                    {m.from} → {m.to}
                  </p>
                  <p className={cn("font-mono text-sm", deltaColor(m.changePct))}>
                    {inr(m.startPrice)} → {inr(m.endPrice)} ({pct(m.changePct)})
                  </p>
                </div>
                {m.headlines.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {m.headlines.map((h, j) => (
                      <li key={j} className="text-2xs text-muted-foreground">
                        <span className="font-mono uppercase">{h.source}</span>{" "}
                        {h.url ? (
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                            {h.headline}
                          </a>
                        ) : (
                          h.headline
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-2xs text-muted-foreground">No matching headlines found.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard title="News coverage" subtitle={`${s.news.items ?? 0} unique articles after de-duplication`} icon={BarChart3}>
        <StatGrid>
          {Object.entries(s.news.perSource).map(([src, n]) => (
            <Stat key={src} label={src.replace(/_/g, " ")} value={n} />
          ))}
          {Object.keys(s.news.perSource).length === 0 ? <Stat label="Sources" value="None returned articles" /> : null}
        </StatGrid>
      </DataCard>
    </div>
  );
}

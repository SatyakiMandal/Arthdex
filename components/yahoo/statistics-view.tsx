import { Building2, CalendarDays, Coins, Gauge, Globe, LineChart as LineIcon, Users, Wallet } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import type { ApiYStats } from "@/lib/api/types";
import { BarChart, StatList, big, cr, num, pct } from "./shared";

export function StatisticsView({ data }: { data: ApiYStats }) {
  const { about, officers, valuation: v, highlights: h, trading: t, dividends: d, calendar } = data;
  const range52 = t.high52w != null && t.low52w != null ? t.high52w - t.low52w : null;
  const facts: [string, string][] = [
    ["Employees", about.employees != null ? about.employees.toLocaleString("en-IN") : "—"],
    ["Headquarters", [about.city, about.state, about.country].filter(Boolean).join(", ") || "—"],
    ["Phone", about.phone ?? "—"],
  ];
  return (
    <div className="space-y-4">
      <DataCard title={about.name ?? data.symbol} subtitle={[about.sector, about.industry].filter(Boolean).join(" · ") || undefined} icon={Building2}>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <p className="text-sm leading-relaxed text-muted-foreground">{about.summary ?? "Yahoo Finance has no business description for this company."}</p>
          <dl className="space-y-1.5 text-[0.8125rem]">
            {facts.map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right">{val}</dd>
              </div>
            ))}
            {about.website ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Website</dt>
                <dd>
                  <a className="inline-flex items-center gap-1 text-accent hover:underline" href={about.website} target="_blank" rel="noreferrer noopener">
                    <Globe className="h-3 w-3" />
                    {about.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </DataCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DataCard title="Valuation measures" subtitle="₹ crore" icon={Gauge}>
          <StatList
            rows={[
              ["Market cap", cr(v.marketCap)],
              ["Enterprise value", cr(v.enterpriseValue)],
              ["Trailing P/E", num(v.trailingPE)],
              ["Forward P/E", num(v.forwardPE)],
              ["PEG ratio", num(v.pegRatio)],
              ["Price / sales", num(v.priceToSales)],
              ["Price / book", num(v.priceToBook)],
              ["EV / revenue", num(v.evToRevenue)],
              ["EV / EBITDA", num(v.evToEbitda)],
            ]}
          />
        </DataCard>
        <DataCard title="Profitability and growth" subtitle="Trailing twelve months" icon={LineIcon}>
          <StatList
            rows={[
              ["Profit margin", pct(h.profitMargin)],
              ["Operating margin", pct(h.operatingMargin)],
              ["Gross margin", pct(h.grossMargin)],
              ["Return on assets", pct(h.returnOnAssets)],
              ["Return on equity", pct(h.returnOnEquity)],
              ["Revenue", cr(h.revenue)],
              ["Revenue growth (yoy)", pct(h.revenueGrowth)],
              ["EBITDA", cr(h.ebitda)],
              ["Net income", cr(h.netIncome)],
              ["EPS (trailing / forward)", `${num(h.eps)} / ${num(h.forwardEps)}`],
              ["Earnings growth", pct(h.earningsGrowth)],
            ]}
          />
        </DataCard>
        <DataCard title="Balance sheet and cash flow" subtitle="Most recent quarter" icon={Wallet}>
          <StatList
            rows={[
              ["Total cash", cr(h.cash)],
              ["Total debt", cr(h.debt)],
              ["Debt / equity", num(h.debtToEquity)],
              ["Current ratio", num(h.currentRatio)],
              ["Book value per share", num(h.bookValue)],
              ["Operating cash flow", cr(h.operatingCashflow)],
              ["Free cash flow", cr(h.freeCashflow)],
            ]}
          />
        </DataCard>
        <DataCard title="Trading information" icon={CalendarDays}>
          <StatList
            rows={[
              ["Beta", num(t.beta)],
              ["52-week high / low", `${num(t.high52w)} / ${num(t.low52w)}`],
              ["52-week range width", num(range52)],
              ["52-week change", pct(t.change52w)],
              ["50-day average", num(t.ma50)],
              ["200-day average", num(t.ma200)],
              ["Avg volume (3m / 10d)", `${big(t.avgVolume)} / ${big(t.avgVolume10d)}`],
            ]}
          />
        </DataCard>
        <DataCard title="Share statistics" icon={Users}>
          <StatList
            rows={[
              ["Shares outstanding", big(t.sharesOutstanding)],
              ["Float", big(t.floatShares)],
              ["Held by insiders", pct(t.heldByInsiders)],
              ["Held by institutions", pct(t.heldByInstitutions)],
              ["Short ratio", num(t.shortRatio)],
            ]}
          />
        </DataCard>
        <DataCard title="Dividends and splits" icon={Coins}>
          <StatList
            rows={[
              ["Annual dividend", num(d.rate)],
              ["Yield", d.yieldPct != null ? `${d.yieldPct.toFixed(2)}%` : "—"],
              ["5-year avg yield", d.fiveYearAvgYieldPct != null ? `${d.fiveYearAvgYieldPct.toFixed(2)}%` : "—"],
              ["Payout ratio", pct(d.payoutRatio)],
              ["Last dividend", d.lastValue != null ? `${num(d.lastValue)} on ${d.lastDate ?? "—"}` : "—"],
              ["Ex-dividend date", d.exDividendDate ?? "—"],
              ["Last split", d.lastSplitFactor ? `${d.lastSplitFactor} on ${d.lastSplitDate ?? "—"}` : "None on record"],
              ["Next earnings", calendar.earningsDates[0] ?? "—"],
            ]}
          />
        </DataCard>
      </div>

      {d.byYear.length > 1 ? (
        <DataCard title="Dividend per share by year" subtitle="Sum of declared dividends, ₹ per share" icon={Coins}>
          <div className="p-4">
            <BarChart items={d.byYear.map((r) => ({ label: String(r.year), value: r.amount }))} />
          </div>
        </DataCard>
      ) : null}

      {officers.length > 0 ? (
        <DataCard title="Key executives" icon={Users}>
          <div className="overflow-x-auto">
            <table className="data-table yf-table w-full text-left text-[0.8125rem]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th className="text-right">Age</th>
                  <th className="text-right">Pay (₹ Cr)</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((o, i) => (
                  <tr key={i}>
                    <td className="font-medium">{o.name}</td>
                    <td className="text-muted-foreground">{o.title}</td>
                    <td className="text-right font-mono tabular-nums">{o.age ?? "—"}</td>
                    <td className="text-right font-mono tabular-nums">{o.pay != null ? o.pay.toFixed(2) : "—"}</td>
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

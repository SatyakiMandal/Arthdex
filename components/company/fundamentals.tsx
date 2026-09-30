import type { ApiFinancials } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn, formatINR } from "@/lib/utils";

/** Renders a figure, or an em dash when the upstream did not report it. */
function num(value: number | null | undefined, digits = 0, suffix = ""): string {
  return value === null || value === undefined ? "—" : `${formatINR(value, digits)}${suffix}`;
}

/**
 * Quarterly P&L, transposed: metrics down the rows and periods across the
 * columns, which is how these are read — you scan one line for a trend rather
 * than comparing across a row of mixed units.
 */
export function QuarterlyPnLPanel({ financials }: { financials: ApiFinancials }) {
  const quarters = financials.quarterly;

  if (quarters.length === 0) {
    return (
      <DataCard title="Quarterly P&amp;L" subtitle="₹ crore" icon={undefined as never}>
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No quarterly statements reported upstream for this company.
        </p>
      </DataCard>
    );
  }

  const rows = [
    { label: "Revenue", get: (i: number) => num(quarters[i].revenue), emphasis: true },
    { label: "Operating Expenses", get: (i: number) => num(quarters[i].operatingExpenses) },
    { label: "Operating Profit", get: (i: number) => num(quarters[i].operatingProfit), emphasis: true },
    {
      label: "OPM %",
      get: (i: number) =>
        quarters[i].opmPct === null ? "—" : `${quarters[i].opmPct!.toFixed(1)}%`,
      accent: true,
    },
    { label: "EBITDA", get: (i: number) => num(quarters[i].ebitda) },
    { label: "Net Profit (PAT)", get: (i: number) => num(quarters[i].netProfit), emphasis: true },
    {
      label: "EPS (₹)",
      get: (i: number) => (quarters[i].eps === null ? "—" : quarters[i].eps!.toFixed(2)),
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Quarterly P&amp;L</h3>
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          ₹ crore · {quarters.length} quarters reported
        </span>
      </header>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">Metric</th>
              {quarters.map((q) => (
                <th key={q.periodEnd} className="px-3 py-2 text-right font-medium">
                  {q.quarter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 bg-surface px-3 py-2 text-left text-xs font-normal",
                    row.emphasis ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {row.label}
                </th>
                {quarters.map((q, i) => (
                  <td
                    key={q.periodEnd}
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      row.accent && "text-accent",
                      row.emphasis && "font-medium",
                    )}
                  >
                    {row.get(i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
        Periods are shown exactly as reported by the source. Gaps are real gaps in upstream
        coverage, not omissions here.
      </p>
    </section>
  );
}

export function AnnualPnLPanel({ financials }: { financials: ApiFinancials }) {
  const years = financials.annual;
  if (years.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Annual P&amp;L</h3>
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          ₹ crore
        </span>
      </header>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[460px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Year</th>
              <th className="px-3 py-2 text-right font-medium">Revenue</th>
              <th className="px-3 py-2 text-right font-medium">Op Profit</th>
              <th className="px-3 py-2 text-right font-medium">OPM %</th>
              <th className="px-3 py-2 text-right font-medium">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr
                key={year.periodEnd}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
              >
                <th scope="row" className="px-3 py-2 text-left font-mono text-xs font-medium">
                  {year.period}
                </th>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{num(year.revenue)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {num(year.operatingProfit)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-accent">
                  {year.opmPct === null ? "—" : `${year.opmPct.toFixed(1)}%`}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums font-medium">
                  {num(year.netProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BalanceSheetPanel({ financials }: { financials: ApiFinancials }) {
  const rows = financials.balanceSheet;
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Balance Sheet Highlights</h3>
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          ₹ crore
        </span>
      </header>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Borrowings</th>
              <th className="px-3 py-2 text-right font-medium">Net Worth</th>
              <th className="px-3 py-2 text-right font-medium">Total Assets</th>
              <th className="px-3 py-2 text-right font-medium">D/E</th>
              <th className="px-3 py-2 text-right font-medium">Current Ratio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.periodEnd}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
              >
                <th scope="row" className="px-3 py-2 text-left font-mono text-xs font-medium">
                  {row.period}
                </th>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {num(row.borrowings)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{num(row.netWorth)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {num(row.totalAssets)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono tabular-nums",
                    row.debtToEquity === null
                      ? "text-muted-foreground"
                      : row.debtToEquity > 1
                        ? "text-down"
                        : row.debtToEquity < 0.1
                          ? "text-up"
                          : "text-foreground",
                  )}
                >
                  {row.debtToEquity === null ? "—" : `${row.debtToEquity.toFixed(2)}x`}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {row.currentRatio === null ? "—" : `${row.currentRatio.toFixed(2)}x`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function KeyRatiosPanel({ financials }: { financials: ApiFinancials }) {
  const ratios = financials.ratios;

  const tiles = [
    {
      label: "ROE",
      value: ratios.roePct === null ? "—" : `${ratios.roePct.toFixed(1)}%`,
      tone: ratios.roePct !== null && ratios.roePct >= 18 ? 1 : 0,
    },
    {
      label: "ROCE",
      value: ratios.rocePct === null ? "—" : `${ratios.rocePct.toFixed(1)}%`,
      tone: ratios.rocePct !== null && ratios.rocePct >= 20 ? 1 : 0,
    },
    {
      label: "Current Ratio",
      value: ratios.currentRatio === null ? "—" : `${ratios.currentRatio.toFixed(2)}x`,
      tone: ratios.currentRatio !== null && ratios.currentRatio >= 1.5 ? 1 : 0,
    },
    {
      label: "Debt / Equity",
      value: ratios.debtToEquity === null ? "—" : `${ratios.debtToEquity.toFixed(2)}x`,
      tone: ratios.debtToEquity !== null && ratios.debtToEquity < 0.5 ? 1 : 0,
    },
    { label: "Revenue", value: num(ratios.revenueCr, 0, " Cr"), tone: 0 },
    { label: "Net Profit", value: num(ratios.netProfitCr, 0, " Cr"), tone: 0 },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Key Ratios</h3>
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {ratios.period}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{tile.label}</dt>
            <dd
              className={cn(
                "mt-1 font-mono text-lg font-semibold tabular-nums",
                tile.tone === 1 && "text-up",
                tile.value === "—" && "text-muted-foreground",
              )}
            >
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* The window these ratios cover is stated explicitly: a fiscal-year ROE
          must never be read as a trailing-twelve-month one. */}
      <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
        Computed over the {ratios.basis}.
        {ratios.ttmNote ? ` ${ratios.ttmNote}` : ""}
      </p>
    </section>
  );
}

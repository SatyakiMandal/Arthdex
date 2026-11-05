import { CalendarRange } from "lucide-react";
import type { ApiFinancials, ApiSeriesSource } from "@/lib/api/types";
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
/**
 * Says where a series came from when it is not the primary source, and why, so a
 * table that changes source never changes silently. Disagreements between the two
 * sources on the periods shown are listed rather than hidden.
 */
const FIELD_NAMES: Record<string, string> = {
  revenue: "revenue",
  eps: "EPS",
  netWorth: "net worth",
  totalAssets: "total assets",
  borrowings: "borrowings",
};

function SourceNote({ source, lender }: { source?: ApiSeriesSource; lender?: boolean }) {
  if (!source) return null;
  const switched = source.used === "screener";
  const settled = (source.disagreements ?? []).filter((d) => d.settled);
  const corrected = settled.filter((d) => d.settled && d.settled.correct !== source.used && d.settled.correct !== "restated");
  const open = source.unresolved ?? [];
  if (!switched && settled.length === 0 && open.length === 0) return null;
  const name = (field: string) => FIELD_NAMES[field] ?? field;
  const inr = (v: number) => v.toLocaleString("en-IN");
  return (
    <p role="note" className="border-b border-border bg-surface-muted px-4 py-2 text-xs text-muted-foreground">
      {switched ? <>Shown from screener.in. {source.reason}.</> : null}
      {switched && lender ? " For a lender, revenue here is gross interest earned." : null}
      {settled.length ? (
        <>
          {" "}
          Where Yahoo Finance and screener.in disagreed, the company&apos;s own filing with NSE settled{" "}
          {settled.length === 1 ? "it" : `all ${settled.length}`}
          {corrected.length ? (
            <>
              {"; "}the filed figure is shown for {name(corrected[0].field)} at {corrected[0].period}: {inr(corrected[0].settled!.filed)}
              {corrected.length > 1 ? ` and ${corrected.length - 1} more` : ""}
            </>
          ) : null}
          .
        </>
      ) : null}
      {open.length ? (
        <>
          {" "}
          The two sources still disagree on {open.length === 1 ? "one figure" : `${open.length} figures`} that no filing could settle, for
          example {name(open[0].field)} at {open[0].period}: {inr(open[0].yahoo)} on Yahoo Finance against {inr(open[0].screener)} on
          screener.in.
        </>
      ) : null}
    </p>
  );
}

export function QuarterlyPnLPanel({ financials }: { financials: ApiFinancials }) {
  const quarters = financials.quarterly;

  if (quarters.length === 0) {
    return (
      <DataCard title="Quarterly results" subtitle="₹ crore" icon={CalendarRange}>
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No quarterly statements reported upstream for this company.
        </p>
      </DataCard>
    );
  }

  // Companies file within 45 to 60 days of quarter end, so a newest quarter older than
  // 150 days means the source is missing at least one filed quarter.
  const staleDays = financials.latestQuarterAgeDays ?? 0;

  const rows = [
    { label: "Revenue", get: (i: number) => num(quarters[i].revenue), emphasis: true },
    { label: "Operating expenses", get: (i: number) => num(quarters[i].operatingExpenses) },
    { label: "Operating profit", get: (i: number) => num(quarters[i].operatingProfit), emphasis: true },
    {
      label: "Operating margin",
      get: (i: number) =>
        quarters[i].opmPct === null ? "—" : `${quarters[i].opmPct!.toFixed(1)}%`,
      accent: true,
    },
    { label: "EBITDA", get: (i: number) => num(quarters[i].ebitda) },
    { label: "Net profit", get: (i: number) => num(quarters[i].netProfit), emphasis: true },
    {
      label: "EPS (₹)",
      get: (i: number) => (quarters[i].eps === null ? "—" : quarters[i].eps!.toFixed(2)),
    },
  ];

  return (
    <section className="rounded-none border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-sans text-sm font-semibold tracking-normal">Quarterly results</h3>
        <span className="font-mono text-2xs text-muted-foreground">
          ₹ crore · {quarters.length} quarters reported
        </span>
      </header>
      <SourceNote source={financials.sources?.quarterly} lender={quarters.some((q) => q.lender)} />
      {staleDays > 150 ? (
        <p role="note" className="border-b border-border bg-flat/10 px-4 py-2 text-xs text-foreground">
          The latest quarter on file is {quarters.at(-1)?.quarter}, which ended {staleDays} days ago. Later results
          have been filed with the exchanges but neither data source has them yet.
        </p>
      ) : null}

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs text-muted-foreground">
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
    <section className="rounded-none border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-sans text-sm font-semibold tracking-normal">Annual results</h3>
        <span className="font-mono text-2xs text-muted-foreground">
          ₹ crore
        </span>
      </header>
      <SourceNote source={financials.sources?.annual} />

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[460px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Year</th>
              <th className="px-3 py-2 text-right font-medium">Revenue</th>
              <th className="px-3 py-2 text-right font-medium">Operating profit</th>
              <th className="px-3 py-2 text-right font-medium">Margin</th>
              <th className="px-3 py-2 text-right font-medium">Net profit</th>
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
    <section className="rounded-none border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-sans text-sm font-semibold tracking-normal">Balance sheet</h3>
        <span className="font-mono text-2xs text-muted-foreground">
          ₹ crore
        </span>
      </header>
      <SourceNote source={financials.sources?.balanceSheet} />

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Borrowings</th>
              <th className="px-3 py-2 text-right font-medium">Net worth</th>
              <th className="px-3 py-2 text-right font-medium">Total assets</th>
              <th className="px-3 py-2 text-right font-medium">D/E</th>
              <th className="px-3 py-2 text-right font-medium">Current ratio</th>
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
  const yearEnd = financials.balanceSheet.at(-1)?.period ?? null;

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
      label: "Current ratio",
      value: ratios.currentRatio === null ? "—" : `${ratios.currentRatio.toFixed(2)}x`,
      tone: ratios.currentRatio !== null && ratios.currentRatio >= 1.5 ? 1 : 0,
    },
    {
      label: "Debt to equity",
      value: ratios.debtToEquity === null ? "—" : `${ratios.debtToEquity.toFixed(2)}x`,
      tone: ratios.debtToEquity !== null && ratios.debtToEquity < 0.5 ? 1 : 0,
    },
    { label: "Revenue", value: num(ratios.revenueCr, 0, " Cr"), tone: 0 },
    { label: "Net profit", value: num(ratios.netProfitCr, 0, " Cr"), tone: 0 },
  ];

  return (
    <section className="rounded-none border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-sans text-sm font-semibold tracking-normal">Key ratios</h3>
        <span className="font-mono text-2xs text-muted-foreground">
          {ratios.period}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface px-4 py-3">
            <dt className="text-2xs text-muted-foreground">{tile.label}</dt>
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
        Profit figures cover the {ratios.basis}
        {yearEnd ? `; balance-sheet figures are at the ${yearEnd} year-end, and ROE divides one by the other` : ""}.
        {ratios.ttmNote ? ` ${ratios.ttmNote}` : ""}
      </p>
    </section>
  );
}

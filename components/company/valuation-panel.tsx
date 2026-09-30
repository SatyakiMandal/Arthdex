import { Scale } from "lucide-react";
import type { ApiValuation } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";

/**
 * Valuation multiples as reported.
 *
 * Yahoo omits several of these for many Indian tickers — return on equity in
 * particular. A missing figure renders as an em dash rather than a zero, since
 * "not reported" and "zero" are very different claims.
 */
export function ValuationPanel({ valuation }: { valuation: ApiValuation }) {
  const tiles = [
    { label: "P/E", value: valuation.peRatio, digits: 2 },
    { label: "P/B", value: valuation.pbRatio, digits: 2 },
    { label: "EV / EBITDA", value: valuation.evToEbitda, digits: 2 },
    { label: "EV / Sales", value: valuation.evToSales, digits: 2 },
    { label: "EPS (₹)", value: valuation.eps, digits: 2 },
    { label: "Book Value (₹)", value: valuation.bookValue, digits: 2 },
    { label: "Profit Margin", value: valuation.profitMarginPct, digits: 2, suffix: "%" },
    { label: "Dividend Yield", value: valuation.dividendYieldPct, digits: 2, suffix: "%" },
  ];

  const reported = tiles.filter((tile) => tile.value !== null).length;

  return (
    <DataCard
      title="Valuation Multiples"
      subtitle="As reported by the data source"
      icon={Scale}
      badge={
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {reported}/{tiles.length} reported
        </span>
      }
      footnote={
        reported < tiles.length
          ? "Dashes are metrics the upstream does not report for this ticker, not zeros."
          : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{tile.label}</dt>
            <dd
              className={cn(
                "mt-1 font-mono text-lg font-semibold tabular-nums",
                tile.value === null && "text-muted-foreground",
              )}
            >
              {tile.value === null
                ? "—"
                : `${tile.value.toFixed(tile.digits)}${tile.suffix ?? ""}`}
            </dd>
          </div>
        ))}
      </dl>
    </DataCard>
  );
}

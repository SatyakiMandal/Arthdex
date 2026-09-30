import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ApiFactorScreens, ApiScreenRow } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

const SCREENS = [
  {
    key: "highVolatility" as const,
    label: "High Beta",
    hint: "Highest beta against the Nifty 50, amplifying index moves in both directions",
  },
  {
    key: "lowVolatility" as const,
    label: "Low Volatility",
    hint: "Lowest annualised realised volatility over the last year",
  },
  {
    key: "alpha" as const,
    label: "Alpha",
    hint: "Highest Jensen's alpha, the return beyond what CAPM required at that beta",
  },
];

function ScreenTable({ rows }: { rows: ApiScreenRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Scrip</th>
            <th className="px-3 py-2 text-right font-medium">CMP</th>
            <th className="px-3 py-2 text-right font-medium">Beta</th>
            <th className="px-3 py-2 text-right font-medium">Ann. Vol</th>
            <th className="px-3 py-2 text-right font-medium">Jensen α</th>
            <th className="px-3 py-2 text-right font-medium">R²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/company/${row.symbol}`}
                  className="font-mono text-xs font-semibold hover:text-accent"
                >
                  {row.symbol}
                </Link>
                <div className="truncate text-2xs text-muted-foreground">{row.industry}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatINR(row.cmp)}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-mono tabular-nums",
                  row.beta > 1.3 ? "text-down" : row.beta < 0.7 ? "text-up" : "text-foreground",
                )}
              >
                {row.beta.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {row.annualisedVolPct.toFixed(1)}%
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-mono tabular-nums",
                  deltaColor(row.jensensAlphaPct),
                )}
              >
                {formatPct(row.jensensAlphaPct, 1)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {row.rSquared.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Factor screens over a real index universe.
 *
 * Every figure is a genuine regression against the Nifty 50 over a year of
 * daily returns — a symbol with too little overlapping history is excluded
 * rather than given a default beta of 1.
 */
export function FactorScreens({ screens }: { screens: ApiFactorScreens }) {
  return (
    <DataCard
      title="Factor Screens"
      subtitle={`${screens.indexLabel} · regressed on ${screens.benchmark}`}
      icon={SlidersHorizontal}
      badge={
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {screens.computed}/{screens.universeSize} computed
        </span>
      }
      footnote="Beta, volatility and alpha are computed from one year of daily returns. Constituents whose overlapping history is too short to estimate a reliable beta are excluded from the screens rather than defaulted."
    >
      <div className="divide-y divide-border">
        {SCREENS.map((screen) => (
          <section key={screen.key}>
            <header className="flex flex-wrap items-baseline gap-2 bg-surface-muted/50 px-4 py-2">
              <h3 className="text-sm font-semibold tracking-tight">{screen.label}</h3>
              <span className="text-2xs text-muted-foreground">{screen.hint}</span>
            </header>
            <div className="p-2">
              <ScreenTable rows={screens[screen.key]} />
            </div>
          </section>
        ))}
      </div>
    </DataCard>
  );
}

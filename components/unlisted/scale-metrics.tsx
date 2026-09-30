import { TrendingUp } from "lucide-react";
import type { UnlistedCompany } from "@/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";
import { DataCard } from "@/components/ui/data-card";

export function ScaleMetrics({ company }: { company: UnlistedCompany }) {
  const m = company.metrics;

  const tiles = [
    { label: "Revenue CAGR (3Y)", value: formatPct(m.revenueCagr3yPct, 1), tone: m.revenueCagr3yPct > 0 ? 1 : -1 },
    { label: "EBITDA CAGR (3Y)", value: formatPct(m.ebitdaCagr3yPct, 1), tone: m.ebitdaCagr3yPct > 0 ? 1 : -1 },
    { label: "Operating Cash Flow", value: `₹${formatINR(m.operatingCashFlowCr, 1)} Cr`, tone: m.operatingCashFlowCr >= 0 ? 1 : -1 },
    { label: "Free Cash Flow", value: `₹${formatINR(m.freeCashFlowCr, 1)} Cr`, tone: m.freeCashFlowCr >= 0 ? 1 : -1 },
    { label: "Total Order Book", value: `₹${formatINR(m.totalOrderBookCr, 0)} Cr`, tone: 0 },
    { label: "Order Book / Revenue", value: `${m.orderBookToRevenue.toFixed(2)}x`, tone: m.orderBookToRevenue >= 2 ? 1 : 0 },
  ];

  // EBITDA compounding faster than revenue means margins are expanding
  const marginsExpanding = m.ebitdaCagr3yPct > m.revenueCagr3yPct;
  const fcfNegative = m.freeCashFlowCr < 0;

  return (
    <DataCard
      title="Valuation &amp; Growth"
      subtitle={`Last deal ₹${formatINR(company.lastDealPrice, 0)} · implied valuation ₹${formatINR(company.impliedValuationCr, 0)} Cr`}
      icon={TrendingUp}
      badge={
        <div className="flex gap-4 text-right">
          <div>
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">Implied P/E</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{company.impliedPe.toFixed(1)}</div>
          </div>
          <div>
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">EV/EBITDA</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{company.impliedEvToEbitda.toFixed(1)}</div>
          </div>
        </div>
      }
      footnote={
        fcfNegative
          ? "Free cash flow is negative while operating cash flow is positive. The gap is capital expenditure, which is expected for a company scaling capacity but leaves it dependent on external funding."
          : "Multiples are struck off the last observed secondary-market deal, not a screen price, so they can lag public-market repricing."
      }
    >
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-surface px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{t.label}</dt>
            <dd
              className={cn(
                "mt-1 font-mono text-lg font-semibold tabular-nums",
                t.tone === 1 && "text-up",
                t.tone === -1 && "text-down",
              )}
            >
              {t.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center justify-between text-2xs">
          <span className="uppercase tracking-wide text-muted-foreground">Margin trajectory</span>
          <span className={cn("font-mono", marginsExpanding ? "text-up" : "text-down")}>
            {marginsExpanding ? "Expanding" : "Compressing"} ·{" "}
            {formatPct(m.ebitdaCagr3yPct - m.revenueCagr3yPct, 1)} spread
          </span>
        </div>
        {/* Revenue vs EBITDA CAGR on a shared scale */}
        <div className="mt-2 space-y-1.5">
          {[
            { label: "Revenue", value: m.revenueCagr3yPct },
            { label: "EBITDA", value: m.ebitdaCagr3yPct },
          ].map((row) => {
            const max = Math.max(m.revenueCagr3yPct, m.ebitdaCagr3yPct, 1);
            return (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-16 text-2xs text-muted-foreground">{row.label}</span>
                <span className="h-1.5 flex-1 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(row.value / max) * 100}%` }}
                  />
                </span>
                <span className={cn("w-14 text-right font-mono text-2xs tabular-nums", deltaColor(row.value))}>
                  {formatPct(row.value, 1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </DataCard>
  );
}

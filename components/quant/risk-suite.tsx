import { ShieldAlert } from "lucide-react";
import type { ApiMerton, ApiVaR } from "@/lib/api/types";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn, formatINR } from "@/lib/utils";

/** Investment-grade structural credit reads well above 3 sigma from the barrier. */
function creditTone(dd: number | null | undefined): { tone: "up" | "flat" | "down"; label: string } {
  if (dd === null || dd === undefined) return { tone: "flat", label: "Not computed" };
  if (dd >= 4) return { tone: "up", label: "Remote" };
  if (dd >= 2.5) return { tone: "flat", label: "Contained" };
  return { tone: "down", label: "Stressed" };
}

export function RiskSuite({ merton, varSuite }: { merton: ApiMerton; varSuite: ApiVaR }) {
  const credit = creditTone(merton.distanceToDefault);

  const varRows = [
    { label: "Parametric VaR", value: varSuite.parametricVaRPct, note: "Gaussian closed form" },
    { label: "Historical VaR", value: varSuite.historicalVaRPct, note: "Empirical 1st percentile" },
    {
      label: "Monte Carlo VaR",
      value: varSuite.monteCarloVaRPct,
      note: varSuite.monteCarloDistribution ?? "Simulated",
    },
    {
      label: "Expected Shortfall",
      value: varSuite.expectedShortfallPct,
      note: `Mean loss beyond the ${varSuite.esBasis ?? "historical"} VaR`,
      emphasis: true,
    },
  ].filter((row) => row.value !== null && row.value !== undefined);

  const maxVar = Math.max(...varRows.map((row) => row.value as number), 0.01);

  return (
    <DataCard
      title="Risk &amp; Default Suite"
      subtitle={`Merton structural model · ${varSuite.horizonDays ?? 1}-day ${varSuite.confidencePct ?? 99}% VaR`}
      icon={ShieldAlert}
      badge={<StatusPill label={credit.label} tone={credit.tone} />}
      footnote="Expected Shortfall is paired with the historical VaR, and exceeds it by construction. It is not forced above the other methods: comparing an ES computed under one distribution with a VaR computed under another is not meaningful, and Monte Carlo can legitimately sit higher when the fitted tail is fatter than the realised sample."
    >
      {merton.note ? (
        <p className="border-b border-border px-4 py-3 text-2xs text-muted-foreground">
          Merton model not computed: {merton.note}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <div className="bg-surface px-4 py-3">
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">
              Distance to Default
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              {merton.distanceToDefault?.toFixed(2) ?? "—"}
              <span className="ml-1 text-xs font-normal text-muted-foreground">σ</span>
            </div>
          </div>
          <div className="bg-surface px-4 py-3">
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">
              Default Probability
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-xl font-semibold tabular-nums",
                (merton.defaultProbabilityPct ?? 0) < 0.5 ? "text-up" : "text-down",
              )}
            >
              {merton.defaultProbabilityPct === null || merton.defaultProbabilityPct === undefined
                ? "—"
                : merton.defaultProbabilityPct < 0.01
                  ? "<0.01%"
                  : `${merton.defaultProbabilityPct.toFixed(2)}%`}
            </div>
          </div>
          <div className="bg-surface px-4 py-3">
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Asset Value</div>
            <div className="mt-1 font-mono text-sm font-medium tabular-nums">
              ₹{formatINR(merton.assetValueCr ?? 0, 0)} Cr
            </div>
            <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
              σ<sub>A</sub> {merton.assetVolPct?.toFixed(1) ?? "—"}%
            </div>
          </div>
          <div className="bg-surface px-4 py-3">
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">
              Solvency Barrier
            </div>
            <div className="mt-1 font-mono text-sm font-medium tabular-nums">
              ₹{formatINR(merton.debtBarrierCr ?? 0, 0)} Cr
            </div>
            <div className="mt-0.5 text-2xs text-muted-foreground">{merton.barrierBasis}</div>
          </div>
        </div>
      )}

      {varRows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {varSuite.note ?? "Not enough history to compute value at risk."}
        </p>
      ) : (
        <div className="border-t border-border p-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Measure</th>
                <th className="w-1/3 px-3 py-2 text-left font-medium">Magnitude</th>
                <th className="px-3 py-2 text-right font-medium">1D Loss</th>
              </tr>
            </thead>
            <tbody>
              {varRows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                >
                  <th scope="row" className="px-3 py-2 text-left text-xs font-normal">
                    <span className={row.emphasis ? "font-medium text-foreground" : "text-foreground"}>
                      {row.label}
                    </span>
                    <span className="block text-2xs text-muted-foreground">{row.note}</span>
                  </th>
                  <td className="px-3 py-2">
                    <span className="block h-1.5 rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          row.emphasis ? "bg-down" : "bg-down/55",
                        )}
                        style={{ width: `${((row.value as number) / maxVar) * 100}%` }}
                      />
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums text-down",
                      row.emphasis && "font-semibold",
                    )}
                  >
                    −{(row.value as number).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}

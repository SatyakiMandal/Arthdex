import { Gauge } from "lucide-react";
import type { ApiSensitivity } from "@/lib/api/types";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn, deltaColor, formatPct } from "@/lib/utils";

/** Below roughly 0.3 the index explains little of the stock's variance. */
function fitLabel(r2: number): { label: string; tone: "up" | "flat" | "down" } {
  if (r2 >= 0.6) return { label: "Strong fit", tone: "up" };
  if (r2 >= 0.3) return { label: "Partial fit", tone: "flat" };
  return { label: "Weak fit", tone: "down" };
}

export function BenchmarkSensitivityPanel({ sensitivity }: { sensitivity: ApiSensitivity }) {
  const { rows, primary } = sensitivity;

  if (rows.length === 0) {
    return (
      <DataCard title="Benchmark Sensitivity" subtitle="OLS regression" icon={Gauge}>
        <p className="px-4 py-8 text-sm text-muted-foreground">
          {sensitivity.note ?? "Not enough overlapping history to run a regression."}
        </p>
      </DataCard>
    );
  }

  const primaryRow = rows.find((row) => row.benchmarkId === primary) ?? rows[0];
  const primaryFit = fitLabel(primaryRow.rSquared ?? 0);

  return (
    <DataCard
      title="Benchmark Sensitivity"
      subtitle={`OLS over ${primaryRow.observationWindowDays} overlapping sessions · risk-free ${sensitivity.riskFreePct ?? 6.5}%`}
      icon={Gauge}
      badge={
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              Best fit
            </div>
            <div className="font-mono text-sm font-semibold">{primaryRow.benchmarkName}</div>
          </div>
          <StatusPill label={primaryFit.label} tone={primaryFit.tone} />
        </div>
      }
      footnote="Alpha is risk-adjusted: realised return less the CAPM-required return at that beta. Abnormal return is the plain cumulative excess over the index. They differ because beta scales the benchmark's contribution."
    >
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Benchmark</th>
              <th className="px-3 py-2 text-right font-medium">Index</th>
              <th className="px-3 py-2 text-right font-medium">Beta β</th>
              <th className="px-3 py-2 text-right font-medium">Alpha α</th>
              <th className="w-28 px-3 py-2 text-left font-medium">R²</th>
              <th className="px-3 py-2 text-right font-medium">Abnormal</th>
              <th className="px-3 py-2 text-right font-medium">t(β)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPrimary = row.benchmarkId === primary;
              const r2 = row.rSquared ?? 0;

              return (
                <tr
                  key={row.benchmarkId}
                  className={cn(
                    "border-b border-border/60 last:border-0",
                    isPrimary ? "bg-accent/[0.07]" : "hover:bg-surface-muted",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{row.benchmarkName}</span>
                      {isPrimary ? (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-accent">
                          Primary
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      deltaColor(row.indexReturnPct ?? 0),
                    )}
                  >
                    {row.indexReturnPct === null ? "—" : formatPct(row.indexReturnPct, 1)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      (row.beta ?? 1) > 1.3
                        ? "text-down"
                        : (row.beta ?? 1) < 0.7
                          ? "text-up"
                          : "text-foreground",
                    )}
                  >
                    {row.beta?.toFixed(2) ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      deltaColor(row.alphaPct ?? 0),
                    )}
                  >
                    {row.alphaPct === null ? "—" : formatPct(row.alphaPct, 1)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            r2 >= 0.6 ? "bg-up" : r2 >= 0.3 ? "bg-flat" : "bg-muted-foreground/50",
                          )}
                          style={{ width: `${r2 * 100}%` }}
                        />
                      </span>
                      <span className="w-9 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                        {r2.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      deltaColor(row.abnormalReturnPct ?? 0),
                    )}
                  >
                    {row.abnormalReturnPct === null ? "—" : formatPct(row.abnormalReturnPct, 1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {row.tStatBeta?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-border px-4 py-2">
        <p className="text-2xs text-muted-foreground">
          A low R² means the benchmark explains little of this stock&rsquo;s movement. Read its
          beta and alpha with caution, since both are estimated from a poor fit.
        </p>
        {sensitivity.unavailableBenchmarks.length ? (
          <p className="text-2xs text-muted-foreground">
            Not shown: {sensitivity.unavailableBenchmarks.join(", ")}. These sector indices have
            no usable price history on the free data source, so no regression is possible.
          </p>
        ) : null}
      </div>
    </DataCard>
  );
}

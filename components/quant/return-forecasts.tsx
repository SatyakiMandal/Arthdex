import { Target } from "lucide-react";
import type { ApiForecast } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatPct } from "@/lib/utils";

/**
 * Conformal prediction intervals.
 *
 * All horizons share one symmetric scale built from the widest interval, so a
 * longer horizon visibly widens rather than being re-normalised to look the
 * same width as a shorter one.
 */
export function ReturnForecasts({ forecasts }: { forecasts: ApiForecast[] }) {
  if (forecasts.length === 0) {
    return (
      <DataCard
        title="Multi-Horizon Return Forecasts"
        subtitle="Conformal prediction intervals"
        icon={Target}
      >
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Not enough return history to fit a forecast model.
        </p>
      </DataCard>
    );
  }

  const extent = Math.max(
    ...forecasts.flatMap((f) => [Math.abs(f.lowerBoundPct ?? 0), Math.abs(f.upperBoundPct ?? 0)]),
    0.01,
  );
  const toPct = (value: number) => ((value + extent) / (2 * extent)) * 100;

  return (
    <DataCard
      title="Multi-Horizon Return Forecasts"
      subtitle="AR(1) point estimate with a 95% split-conformal interval"
      icon={Target}
      footnote="The interval half-width is the 95th percentile of absolute residuals on a held-out window, so it inherits the real tail of this series rather than assuming a Gaussian one. Signal confidence is the drift-to-width ratio. It rises with horizon because drift scales with time while the interval scales with its square root, not because long forecasts are more reliable."
    >
      <div className="divide-y divide-border/60">
        {forecasts.map((forecast) => {
          const expected = forecast.expectedReturnPct ?? 0;
          const lower = forecast.lowerBoundPct ?? 0;
          const upper = forecast.upperBoundPct ?? 0;

          return (
            <div key={forecast.horizon} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold">{forecast.horizon}</span>
                  <span className="text-2xs text-muted-foreground">{forecast.label}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "font-mono text-lg font-semibold tabular-nums",
                      deltaColor(expected),
                    )}
                  >
                    {formatPct(expected)}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {forecast.signalConfidencePct?.toFixed(1) ?? "—"}% conf
                  </span>
                </div>
              </div>

              <div className="relative mt-3 h-6">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/45"
                  style={{
                    left: `${toPct(lower)}%`,
                    width: `${toPct(upper) - toPct(lower)}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-border"
                  style={{ left: `${toPct(0)}%` }}
                />
                <div
                  className={cn(
                    "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
                    expected >= 0 ? "bg-up" : "bg-down",
                  )}
                  style={{ left: `${toPct(expected)}%` }}
                />
              </div>

              <div className="flex justify-between font-mono text-2xs text-muted-foreground">
                <span>{formatPct(lower)}</span>
                <span className="uppercase tracking-wide">95% CI</span>
                <span>{formatPct(upper)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </DataCard>
  );
}

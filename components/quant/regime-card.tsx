import { Activity, Waypoints } from "lucide-react";
import type { ApiMicrostructure, ApiRegime } from "@/lib/api/types";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { IllustrativeBanner } from "@/components/ui/data-provenance";
import { cn } from "@/lib/utils";

export function RegimeCard({ regime }: { regime: ApiRegime }) {
  if (regime.note || regime.currentState === undefined) {
    return (
      <DataCard
        title="Markov-Switching Regime"
        subtitle="Hamilton two-state model"
        icon={Waypoints}
      >
        <p className="px-4 py-8 text-sm text-muted-foreground">
          {regime.note ?? "Regime model not available for this series."}
        </p>
      </DataCard>
    );
  }

  const lowPct = (regime.lowVolProbability ?? 0) * 100;
  const highPct = (regime.highVolProbability ?? 0) * 100;
  const isLow = regime.currentState === "BULL_LOW_VOL";

  return (
    <DataCard
      title="Markov-Switching Regime"
      subtitle="Hamilton two-state model with regime-dependent variance"
      icon={Waypoints}
      badge={
        <StatusPill
          label={isLow ? "Low volatility" : "High volatility"}
          tone={isLow ? "up" : "down"}
        />
      }
      footnote="States are labelled by their fitted volatility, not by the estimator's internal numbering, which is arbitrary. Transition rows read from-state to to-state and sum to one."
    >
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-surface px-4 py-3">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Low-vol regime
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-up">
            {regime.lowVolAnnualisedPct?.toFixed(1) ?? "—"}%
          </div>
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">annualised</div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            High-vol regime
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-down">
            {regime.highVolAnnualisedPct?.toFixed(1) ?? "—"}%
          </div>
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">annualised</div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">
            Current state probability
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            Expected duration {regime.expectedDurationDays?.toFixed(1) ?? "—"} trading days
          </span>
        </div>

        <div className="mt-2 flex h-7 overflow-hidden rounded-md border border-border">
          <div
            className="flex items-center justify-center bg-up/20 font-mono text-2xs font-medium text-up"
            style={{ width: `${lowPct}%` }}
          >
            {lowPct >= 18 ? `${lowPct.toFixed(1)}%` : ""}
          </div>
          <div
            className="flex items-center justify-center bg-down/20 font-mono text-2xs font-medium text-down"
            style={{ width: `${highPct}%` }}
          >
            {highPct >= 18 ? `${highPct.toFixed(1)}%` : ""}
          </div>
        </div>

        <div className="mt-1.5 flex justify-between text-2xs">
          <span className={cn(isLow ? "font-medium text-up" : "text-muted-foreground")}>
            Low volatility {isLow ? "· current" : ""}
          </span>
          <span className={cn(!isLow ? "font-medium text-down" : "text-muted-foreground")}>
            High volatility {!isLow ? "· current" : ""}
          </span>
        </div>

        {regime.transitionMatrix ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 font-mono text-2xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>P(low → low)</dt>
              <dd className="tabular-nums text-foreground">
                {regime.transitionMatrix[0]?.[0]?.toFixed(3) ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>P(high → high)</dt>
              <dd className="tabular-nums text-foreground">
                {regime.transitionMatrix[1]?.[1]?.toFixed(3) ?? "—"}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </DataCard>
  );
}

/**
 * Microstructure is not estimated. Kyle's lambda and VPIN need tick-level order
 * flow, which no free or retail feed exposes, so the card says that outright
 * rather than showing a plausible-looking number.
 */
export function MicrostructureCard({ micro }: { micro: ApiMicrostructure }) {
  return (
    <DataCard
      title="Microstructure"
      subtitle="Order-flow toxicity and price impact"
      icon={Activity}
      badge={<StatusPill label="Not available" tone="neutral" />}
    >
      <div className="p-4">
        <IllustrativeBanner
          title="Not estimated: requires tick data"
          detail={micro.note}
        />
        <dl className="mt-3 grid grid-cols-2 gap-px bg-border">
          <div className="bg-surface px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-muted-foreground">
              Kyle&rsquo;s λ
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-muted-foreground">—</dd>
          </div>
          <div className="bg-surface px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-muted-foreground">VPIN</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-muted-foreground">—</dd>
          </div>
        </dl>
      </div>
    </DataCard>
  );
}

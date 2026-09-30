import { Waves } from "lucide-react";
import type { ApiVolatility } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";

export function VolatilityEnsemble({ volatility }: { volatility: ApiVolatility }) {
  if (volatility.models.length === 0) {
    return (
      <DataCard
        title="Volatility Ensemble"
        subtitle="Conditional-variance models"
        icon={Waves}
        footnote={volatility.note ?? undefined}
      >
        <div className="px-4 py-8">
          <p className="text-sm text-muted-foreground">
            No volatility model could be fitted for this series.
          </p>
          {volatility.realisedAnnualisedVolPct !== null ? (
            <p className="mt-2 font-mono text-2xs text-muted-foreground">
              Realised volatility over the sample: {volatility.realisedAnnualisedVolPct.toFixed(2)}%
            </p>
          ) : null}
        </div>
      </DataCard>
    );
  }

  const maxVol = Math.max(...volatility.models.map((m) => m.annualisedVolPct));
  const weightSum = volatility.models.reduce((sum, m) => sum + m.weight, 0);

  return (
    <DataCard
      title="Volatility Ensemble"
      subtitle={`Fitted on ${volatility.observations} daily observations`}
      icon={Waves}
      badge={
        <div className="text-right">
          <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            Consensus
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums text-accent">
            {volatility.consensusAnnualisedVolPct?.toFixed(2) ?? "—"}%
          </div>
        </div>
      }
      footnote={
        volatility.weighting
          ? `${volatility.weighting}. Consensus is the weight-times-volatility sum of the rows above, not a separate estimate.`
          : undefined
      }
    >
      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[440px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Ann. Vol</th>
              <th className="w-32 px-3 py-2 text-left font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {volatility.models.map((model) => (
              <tr
                key={model.model}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
              >
                <th scope="row" className="px-3 py-2 text-left font-mono text-xs font-medium">
                  {model.model}
                </th>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {model.annualisedVolPct.toFixed(2)}%
                  <span className="mt-1 block h-0.5 rounded-full bg-accent/30">
                    <span
                      className="block h-full rounded-full bg-accent/70"
                      style={{ width: `${(model.annualisedVolPct / maxVol) * 100}%` }}
                    />
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-up"
                        style={{ width: `${model.weight * 100}%` }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                      {(model.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th
                scope="row"
                className="px-3 py-2 text-left text-2xs uppercase tracking-wide text-muted-foreground"
              >
                Realised (sample)
              </th>
              <td className="px-3 py-2 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                {volatility.realisedAnnualisedVolPct?.toFixed(2) ?? "—"}%
              </td>
              <td className="px-3 py-2 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                {(weightSum * 100).toFixed(0)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DataCard>
  );
}

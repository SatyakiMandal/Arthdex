import { CheckCircle2, FlaskConical, Gauge, LineChart } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Gauge as ScoreGauge } from "@/components/ui/gauge";
import { deltaColor } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, num, str } from "./shared";

export function ValidationTab({ s }: { s: ListedSummary }) {
  const b = s.detail.backtests;
  const conf: Blk = b.conformal ?? {};
  const vol: Blk = b.volatility ?? {};
  const tech: Blk = b.technical ?? {};
  const confRows = (conf.evaluation_table as Blk[]) ?? [];
  const volRows = (vol.models_comparison as Blk[]) ?? [];

  return (
    <div className="space-y-4">
      <DataCard
        title="Validation summary"
        subtitle="How far the model outputs on this page can be trusted, judged on its own past forecasts"
        icon={CheckCircle2}
        badge={b.status ? <Pill label={b.status.split("(")[0].trim()} tone={(b.score ?? 0) >= 70 ? "up" : (b.score ?? 0) >= 40 ? "flat" : "down"} hint={b.status} /> : undefined}
        footnote="Each backtest replays the model over a short window of this one stock. Passing is encouraging, not proof of out-of-sample skill."
      >
        <div className="grid items-center gap-6 p-4 md:grid-cols-[220px_1fr]">
          <ScoreGauge value={b.score ?? 0} label="Validation score" />
          <p className="text-sm text-muted-foreground">{b.summary ?? "No validation summary was produced."}</p>
        </div>
      </DataCard>

      <DataCard
        title="Forecast-cone calibration"
        subtitle="Did the 90% intervals contain the outcome about 90% of the time?"
        icon={Gauge}
        badge={conf.calibration_diagnosis ? <Pill label={String(conf.calibration_diagnosis).split("(")[0].trim()} tone="up" hint={String(conf.calibration_diagnosis)} /> : undefined}
      >
        <StatGrid cols={4}>
          <Stat label="Target coverage" value={conf.target_coverage_pct != null ? `${conf.target_coverage_pct}%` : dash} />
          <Stat label="Observed coverage" value={conf.observed_coverage_pct != null ? `${num(conf.observed_coverage_pct, 1)}%` : dash} />
          <Stat label="Average width" value={conf.avg_interval_width_pct != null ? `${num(conf.avg_interval_width_pct, 1)}%` : dash} />
          <Stat label="Median direction hit rate" value={conf.p50_directional_hit_rate_pct != null ? `${num(conf.p50_directional_hit_rate_pct, 1)}%` : dash} />
        </StatGrid>
        {confRows.length > 0 ? (
          <Table min={520} head={["Horizon", { label: "Target", right: true }, { label: "Empirical", right: true }, { label: "Width", right: true }, { label: "Hit rate", right: true }]}>
            {confRows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <Td>{str(r.Horizon)}</Td>
                <Td right>{str(r["Target Coverage"])}</Td>
                <Td right>{str(r["Empirical Coverage"])}</Td>
                <Td right>{str(r.Width)}</Td>
                <Td right>{str(r["Hit Rate"])}</Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </DataCard>

      <DataCard
        title="Volatility models, out of sample"
        subtitle={`${vol.validation_sample_days ?? "—"} held-out days; lower error is better`}
        icon={LineChart}
        footnote={vol.diagnosis ?? undefined}
      >
        {volRows.length === 0 ? (
          <Empty>Not enough history for an out-of-sample comparison.</Empty>
        ) : (
          <Table min={620} head={["Model", { label: "RMSE %", right: true }, { label: "MAE %", right: true }, { label: "QLIKE", right: true }, { label: "DM p-value", right: true }, "Rank"]}>
            {volRows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <Td>{str(r["Volatility Model"])}</Td>
                <Td right>{num(r["RMSE (%)"])}</Td>
                <Td right>{num(r["MAE (%)"])}</Td>
                <Td right>{num(r["QLIKE Loss"], 3)}</Td>
                <Td right>{num(r["DM Test p-val"], 3)}</Td>
                <Td>{str(r["Efficiency Rank"])}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>

      <DataCard
        title="Technical-rule strategy backtest"
        subtitle="The indicator rules traded over this window, against buy and hold"
        icon={FlaskConical}
        footnote="Costs and slippage are not modelled, and a handful of trades is a small sample."
      >
        <StatGrid cols={4}>
          <Stat label="Strategy return" value={tech.strategy_return_pct != null ? `${num(tech.strategy_return_pct)}%` : dash} tone={deltaColor(Number(tech.strategy_return_pct ?? 0))} />
          <Stat label="Buy & hold" value={tech.buy_and_hold_return_pct != null ? `${num(tech.buy_and_hold_return_pct)}%` : dash} tone={deltaColor(Number(tech.buy_and_hold_return_pct ?? 0))} />
          <Stat label="Alpha" value={tech.alpha_pct != null ? `${num(tech.alpha_pct)}%` : dash} />
          <Stat label="Sharpe" value={num(tech.strategy_sharpe_ratio)} hint={`Buy & hold ${num(tech.buy_and_hold_sharpe)}`} />
          <Stat label="Max drawdown" value={tech.max_drawdown_pct != null ? `${num(tech.max_drawdown_pct)}%` : dash} tone="text-down" />
          <Stat label="Win rate" value={tech.win_rate_pct != null ? `${num(tech.win_rate_pct, 1)}%` : dash} />
          <Stat label="Profit factor" value={num(tech.profit_factor)} />
          <Stat label="Trades" value={tech.total_trades ?? dash} />
        </StatGrid>
        {b.trades.length > 0 ? (
          <Table min={720} head={Object.keys(b.trades[0]).map((k, i) => ({ label: k, right: i >= 3 }))}>
            {b.trades.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {Object.keys(b.trades[0]).map((k, j) => (
                  <Td key={k} right={j >= 3} mono={j >= 3}>{String(r[k] ?? "")}</Td>
                ))}
              </tr>
            ))}
          </Table>
        ) : null}
      </DataCard>
    </div>
  );
}
